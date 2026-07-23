#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdir,
  lstat,
  open,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const bundleRoot = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(bundleRoot, 'probe-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const timeoutMs = Number(process.env.GROVE_PROBE_TIMEOUT_MS ?? 15 * 60 * 1000);
let activeChild = null;
let interrupted = null;
const FIXED_PATHS = Object.freeze({
  marketplace: 'marketplace',
  package_snapshot: 'marketplace/plugins/grove',
  consumer: 'consumer',
  codex_home: 'codex-home',
  sqlite_home: 'codex-sqlite',
  runtime_tmp: 'runtime-tmp',
  logs: 'logs',
  results: 'results',
});

function bundlePath(relativePath) {
  const path = resolve(bundleRoot, relativePath);
  const rel = relative(bundleRoot, path);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`)) {
    throw new Error(`probe path escapes bundle: ${relativePath}`);
  }
  return path;
}

for (const [key, expected] of Object.entries(FIXED_PATHS)) {
  if (manifest.paths?.[key] !== expected) {
    throw new Error(`probe manifest path ${key} must equal ${expected}`);
  }
}
const paths = Object.fromEntries(
  Object.entries(FIXED_PATHS).map(([key, value]) => [key, bundlePath(value)]),
);
const inheritedEnvironment = {};
for (const key of [
  'PATH',
  'TERM',
  'COLORTERM',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'USER',
  'LOGNAME',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
]) {
  if (process.env[key] != null) inheritedEnvironment[key] = process.env[key];
}
const probeEnv = {
  ...inheritedEnvironment,
  CODEX_HOME: paths.codex_home,
  CODEX_SQLITE_HOME: paths.sqlite_home,
  TMPDIR: paths.runtime_tmp,
};

function terminatePid(pid, signal) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      if (activeChild?.pid === pid) activeChild.kill(signal);
    } else {
      process.kill(-pid, signal);
    }
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

function assertNotInterrupted() {
  if (interrupted) throw new Error(`probe interrupted by ${interrupted}`);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = signal;
    const childForSignal = activeChild;
    const pid = childForSignal?.pid;
    terminatePid(pid, 'SIGTERM');
    if (pid) {
      const signalKillTimer = setTimeout(() => {
        if (activeChild === childForSignal) terminatePid(pid, 'SIGKILL');
      }, 5_000);
      signalKillTimer.unref();
    }
  });
}

async function runCodex(args, {
  cwd = bundleRoot,
  input = null,
  stdoutPath = null,
  stderrPath = null,
  inherit = false,
  allowFailure = false,
  timeout = null,
} = {}) {
  assertNotInterrupted();
  let stdoutHandle;
  let stderrHandle;
  let child;
  let timer = null;
  let killTimer = null;
  const stdio = inherit
    ? 'inherit'
    : [
      input == null ? 'ignore' : 'pipe',
      stdoutPath ? (stdoutHandle = await open(stdoutPath, 'wx')) : 'pipe',
      stderrPath ? (stderrHandle = await open(stderrPath, 'wx')) : 'pipe',
    ];
  const startedAt = new Date().toISOString();
  let stdout = '';
  let stderr = '';
  let exitCode;
  try {
    child = spawn('codex', args, {
      cwd,
      env: probeEnv,
      stdio,
      detached: process.platform !== 'win32',
    });
    activeChild = child;
    if (!inherit && !stdoutPath) child.stdout?.on('data', (chunk) => { stdout += chunk; });
    if (!inherit && !stderrPath) child.stderr?.on('data', (chunk) => { stderr += chunk; });
    if (input != null) child.stdin.end(input);
    if (timeout != null) {
      const pid = child.pid;
      timer = setTimeout(() => {
        interrupted = `timeout after ${timeout}ms`;
        terminatePid(pid, 'SIGTERM');
        killTimer = setTimeout(() => terminatePid(pid, 'SIGKILL'), 5_000);
        killTimer.unref();
      }, timeout);
    }
    exitCode = await new Promise((resolveExit, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolveExit(code ?? (signal ? 128 : 1)));
    });
  } finally {
    if (timer) clearTimeout(timer);
    if (killTimer) clearTimeout(killTimer);
    if (activeChild === child) activeChild = null;
    await stdoutHandle?.close();
    await stderrHandle?.close();
  }
  const result = {
    argv: ['codex', ...args],
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    exit_code: exitCode,
    stdout,
    stderr,
  };
  if (interrupted || (exitCode !== 0 && !allowFailure)) {
    throw Object.assign(
      new Error(`codex ${args[0]} exited ${exitCode}${interrupted ? ` (${interrupted})` : ''}`),
      { commandResult: result },
    );
  }
  return result;
}

function sameJson(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function validatePhaseOutput(phase, output) {
  const actual = phase.kind === 'driving-session' || phase.kind === 'native-batch'
    ? output?.identities
    : output;
  if (!sameJson(actual, phase.expected)) {
    throw new Error(`${phase.id} output differs from its exact expected contract`);
  }
}

async function parseJsonl(path) {
  const lines = (await readFile(path, 'utf8')).split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) throw new Error(`${path} contains no Codex events`);
  return lines.map((line) => JSON.parse(line));
}

async function collectSessionRoleMetadata() {
  const files = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(path);
    }
  }
  await visit(join(paths.codex_home, 'sessions'));
  await visit(join(paths.codex_home, 'archived_sessions'));

  const result = {};
  for (const path of files) {
    const firstLine = (await readFile(path, 'utf8')).split(/\r?\n/, 1)[0];
    const record = JSON.parse(firstLine);
    if (record?.type !== 'session_meta' || !record.payload?.id) continue;
    const source = record.payload.source?.subagent?.thread_spawn;
    if (!source) continue;
    result[record.payload.id] = {
      thread_id: record.payload.id,
      agent_role: source.agent_role ?? record.payload.agent_role ?? null,
      agent_nickname: source.agent_nickname ?? record.payload.agent_nickname ?? null,
      parent_thread_id: source.parent_thread_id ?? record.payload.parent_thread_id ?? null,
      cli_version: record.payload.cli_version ?? null,
      session_meta_sha256: createHash('sha256').update(firstLine).digest('hex'),
      session_metadata: relativeResultPath(path),
    };
  }
  return result;
}

function expectedAgentInvocations(phase) {
  if (phase.kind === 'driving-session') return [];
  if (phase.kind === 'native-batch') {
    return phase.expected.map((identity) => ({
      native_id: identity.native_id,
      invocation: identity.invocation,
      required_observations: [
        identity.canonical_id,
        identity.source,
        identity.digest,
        identity.exposure,
      ],
    }));
  }
  if (phase.kind === 'separation') {
    return [phase.expected.producer, phase.expected.reviewer];
  }
  if (phase.kind === 'scoped-dispatcher') {
    return [{
      native_id: phase.expected.native_id,
      invocation: phase.expected.invocation,
      required_observations: [
        phase.expected.exposure,
        String(phase.expected.advertised_driving_session),
      ],
    }];
  }
  if (phase.kind === 'config-addendum') {
    return [{
      native_id: phase.expected.role,
      invocation: phase.expected.invocation,
      required_observations: [
        phase.expected.config_sentinel,
        phase.expected.addendum_sentinel,
        String(phase.expected.both_observed),
      ],
    }];
  }
  throw new Error(`unknown probe phase kind: ${phase.kind}`);
}

async function validateLaunchers() {
  const expected = manifest.expected.native;
  const names = (await readdir(join(paths.consumer, '.codex', 'agents')))
    .filter((name) => name.endsWith('.toml'))
    .sort();
  const expectedNames = expected.map((item) => `${item.native_id}.toml`).sort();
  if (!sameJson(names, expectedNames)) throw new Error('consumer launcher set differs from the native inventory');
  for (const identity of expected) {
    const launcher = await readFile(join(paths.consumer, '.codex', 'agents', `${identity.native_id}.toml`), 'utf8');
    if (
      !launcher.includes(`canonical-source: ${identity.source}`)
      || !launcher.includes(identity.digest)
      || launcher.includes('\n## Method\n')
      || launcher.length > 2_500
    ) {
      throw new Error(`launcher ${identity.native_id} is not a thin source-addressed projection`);
    }
  }
}

async function packageTreeDigest(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`candidate snapshot contains unsupported filesystem entry: ${path}`);
    }
  }
  await visit(root);
  const hash = createHash('sha256');
  for (const path of files.sort()) {
    hash.update(relative(root, path).split(sep).join('/'));
    hash.update('\0');
    hash.update(await readFile(path));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function ensureUnusedEvidenceDirectory() {
  for (const path of [paths.logs, paths.results]) {
    await mkdir(path, { recursive: true });
    if ((await readdir(path)).length > 0) {
      throw new Error(`probe evidence directory is not empty; prepare a new attempt instead of overwriting ${path}`);
    }
  }
}

async function sanitize() {
  for (const [path, markerName, expectedKind] of [
    [paths.codex_home, '.grove-probe-home.json', null],
    [paths.sqlite_home, '.grove-probe-state.json', 'sqlite-home'],
    [paths.runtime_tmp, '.grove-probe-state.json', 'runtime-tmp'],
  ]) {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`refusing to sanitize unmarked or symlinked probe path: ${path}`);
    }
    const marker = JSON.parse(await readFile(join(path, markerName), 'utf8'));
    if (
      marker.repository_commit !== manifest.repository_commit
      || (expectedKind != null && marker.kind !== expectedKind)
    ) {
      throw new Error(`probe state marker does not match: ${path}`);
    }
  }
  await rm(paths.codex_home, { recursive: true });
  await rm(paths.sqlite_home, { recursive: true });
  await rm(paths.runtime_tmp, { recursive: true });
  process.stdout.write(
    `Removed isolated Codex auth/session state. Evidence remains at ${paths.results}\n`,
  );
}

async function main() {
  const [command] = process.argv.slice(2);
  if (command === '--help' || command === '-h') {
    process.stdout.write(
      'Run with no arguments from an external Terminal. Use --sanitize after retaining evidence.\n',
    );
    return;
  }
  if (command === '--sanitize') {
    await sanitize();
    return;
  }
  if (command != null) throw new Error(`unknown argument: ${command}`);
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('run-probe.mjs must be launched from an interactive external Terminal');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 60_000) {
    throw new Error('GROVE_PROBE_TIMEOUT_MS must be at least 60000');
  }
  await ensureUnusedEvidenceDirectory();

  const phaseReports = [];
  try {
    await validateLaunchers();
    const observedPackageDigest = await packageTreeDigest(paths.package_snapshot);
    if (observedPackageDigest !== manifest.package_tree_sha256) {
      throw new Error('candidate package snapshot changed after probe preparation');
    }
    await writeFile(join(paths.logs, 'package-tree-sha256.txt'), `${observedPackageDigest}\n`);
    const probeModule = await import(
      pathToFileURL(join(paths.package_snapshot, 'release', 'lib', 'codex-probe.mjs')).href
    );

    const login = await runCodex(['login', 'status'], { allowFailure: true });
    await writeFile(join(paths.logs, 'login-status.txt'), `${login.stdout}${login.stderr}`);
    if (login.exit_code !== 0) {
      process.stdout.write('The isolated Codex home needs authentication; starting device login.\n');
      await runCodex(['login', '--device-auth'], { inherit: true });
    }

    await runCodex(
      ['plugin', 'marketplace', 'add', paths.marketplace, '--json'],
      {
        stdoutPath: join(paths.logs, 'marketplace-add.json'),
        stderrPath: join(paths.logs, 'marketplace-add.stderr'),
      },
    );
    await runCodex(
      ['plugin', 'add', `grove@${manifest.marketplace_name}`, '--json'],
      {
        stdoutPath: join(paths.logs, 'plugin-add.json'),
        stderrPath: join(paths.logs, 'plugin-add.stderr'),
      },
    );
    const versionResult = await runCodex(['--version']);
    await writeFile(join(paths.logs, 'codex-version.txt'), versionResult.stdout);
    const pluginList = await runCodex(['plugin', 'list', '--json']);
    await writeFile(join(paths.logs, 'plugin-list.json'), pluginList.stdout);
    const installed = JSON.parse(pluginList.stdout).installed ?? [];
    const enabledGrove = installed.filter((plugin) => plugin.name === 'grove' && plugin.enabled === true);
    if (
      enabledGrove.length !== 1
      || enabledGrove[0].pluginId !== `grove@${manifest.marketplace_name}`
      || enabledGrove[0].version !== manifest.grove_version
    ) {
      throw new Error('isolated host is not candidate-only: expected exactly the prepared Grove plugin');
    }

    for (const phase of manifest.phases) {
      process.stdout.write(`Running ${phase.id} (${phase.expected_count} identity check(s))…\n`);
      const prompt = await readFile(bundlePath(phase.prompt), 'utf8');
      const jsonl = join(paths.logs, `${phase.id}.jsonl`);
      const stderr = join(paths.logs, `${phase.id}.stderr`);
      const final = join(paths.results, `${phase.id}.json`);
      const args = [
        'exec',
        '-C',
        paths.consumer,
        '-s',
        'read-only',
        '-a',
        'never',
        '--json',
        '--output-schema',
        bundlePath(phase.schema),
        '-o',
        final,
        '-',
      ];
      let report;
      try {
        report = await runCodex(args, {
          cwd: paths.consumer,
          input: prompt,
          stdoutPath: jsonl,
          stderrPath: stderr,
          timeout: timeoutMs,
        });
      } catch (error) {
        const failed = error.commandResult;
        phaseReports.push({
          id: phase.id,
          kind: phase.kind,
          argv: failed?.argv ?? ['codex', ...args],
          started_at: failed?.started_at ?? null,
          finished_at: failed?.finished_at ?? new Date().toISOString(),
          exit_code: failed?.exit_code ?? null,
          final_output: relativeResultPath(final),
          raw_jsonl: relativeResultPath(jsonl),
          stderr: relativeResultPath(stderr),
          verdict: 'fail',
          validation_error: error.message,
        });
        throw error;
      }
      assertNotInterrupted();
      const phaseReport = {
        id: phase.id,
        kind: phase.kind,
        argv: report.argv,
        started_at: report.started_at,
        finished_at: report.finished_at,
        exit_code: report.exit_code,
        final_output: relativeResultPath(final),
        raw_jsonl: relativeResultPath(jsonl),
        stderr: relativeResultPath(stderr),
        verdict: 'validating',
      };
      phaseReports.push(phaseReport);
      try {
        const output = JSON.parse(await readFile(final, 'utf8'));
        validatePhaseOutput(phase, output);
        const events = await parseJsonl(jsonl);
        const threadRoles = await collectSessionRoleMetadata();
        const eventProof = probeModule.validateCodexExecEvidence(
          events,
          expectedAgentInvocations(phase),
          threadRoles,
        );
        const metadataProofPath = join(paths.logs, `${phase.id}-agent-metadata.json`);
        await writeFile(
          metadataProofPath,
          `${JSON.stringify(eventProof.invocations, null, 2)}\n`,
        );
        Object.assign(phaseReport, eventProof, { verdict: 'pass' });
        phaseReport.agent_metadata = relativeResultPath(metadataProofPath);
        assertNotInterrupted();
      } catch (error) {
        phaseReport.verdict = 'fail';
        phaseReport.validation_error = error.message;
        throw error;
      }
    }

    assertNotInterrupted();
    const phaseOutput = async (id) => JSON.parse(
      await readFile(join(paths.results, `${id}.json`), 'utf8'),
    );
    const driving = (await phaseOutput('01-driving-session')).identities;
    const native = [];
    for (const id of ['02-native-batch-1', '03-native-batch-2', '04-native-batch-3']) {
      native.push(...(await phaseOutput(id)).identities);
    }
    const separation = await phaseOutput('05-producer-reviewer-separation');
    const scopedDispatcher = await phaseOutput('06-scoped-dispatcher');
    const configAndAddendum = await phaseOutput('07-config-addendum');
    const hostVersion = (await readFile(join(paths.logs, 'codex-version.txt'), 'utf8')).trim();
    const record = {
      schema_version: 1,
      host: 'codex',
      surface_id: manifest.surface_id,
      grove_version: manifest.grove_version,
      host_version: hostVersion,
      candidate: {
        repository_commit: manifest.repository_commit,
        package_tree_sha256: manifest.package_tree_sha256,
      },
      clean_environment: {
        consumer_empty: manifest.consumer_empty_before_compose,
        candidate_only: true,
        fresh_session: true,
        fresh_sessions: manifest.phases.length,
        profile: manifest.profile,
        surface_provenance: manifest.surface_provenance,
        session: 'sequential fresh non-ephemeral codex exec probes',
        sandbox: manifest.sandbox,
        approval_policy: manifest.approval_policy,
        enabled_grove_plugins: [`grove@${manifest.marketplace_name} ${manifest.grove_version}`],
      },
      install_load_path: `isolated CODEX_HOME -> local marketplace ${manifest.marketplace_name} -> exact package snapshot -> project launchers`,
      launcher_form: {
        count: manifest.expected.native.length,
        contains_charter_body: false,
      },
      role_identities: {
        driving_session: driving,
        native,
        unexpected_native_ids: [],
      },
      producer_reviewer_separation: separation,
      driving_session_roles: {
        dispatcher_invocation: driving.find((item) => item.canonical_id === 'dispatcher')?.invocation,
        shaper_invocation: driving.find((item) => item.canonical_id === 'shaper')?.invocation,
        delegated: false,
        matched_inventory: true,
      },
      spawned_dispatcher: scopedDispatcher,
      config_and_addendum: configAndAddendum,
      outcome: 'pass',
      observed_at: new Date().toISOString().slice(0, 10),
      procedure: [
        'Prepared an empty consumer and exact immutable candidate snapshot without launching Codex.',
        'Used a fresh isolated CODEX_HOME and verified exactly one enabled Grove plugin.',
        'Ran driving roles without delegation and twelve native identities in three sequential batches.',
        'Ran separate executor/reviewer, scoped-dispatcher, and executor config/addendum probes.',
        'Validated completed custom-agent roles and invocation challenges in raw collaboration events.',
        'Retained raw JSONL, exact argv, timestamps, exit codes, and structured final output for every phase.',
      ],
      probe_evidence: {
        phases: phaseReports,
        plugin_list: 'logs/plugin-list.json',
        codex_version: 'logs/codex-version.txt',
      },
    };

    const packageRoot = bundlePath(manifest.paths.package_snapshot);
    const inventory = JSON.parse(await readFile(join(packageRoot, 'roles.json'), 'utf8'));
    const surfaces = JSON.parse(await readFile(join(packageRoot, 'surfaces.json'), 'utf8'));
    const row = surfaces.rows.find((item) => item.surface_id === manifest.surface_id);
    const releaseModule = await import(pathToFileURL(join(packageRoot, 'release', 'lib', 'release.mjs')).href);
    const errors = releaseModule.validateSupportRecord(
      record,
      { ...row, release_state: 'supported', support_record: 'candidate-support-record.json' },
      manifest.grove_version,
      { inventory, sourceDigests: manifest.expected.source_digests },
    );
    if (errors.length > 0) {
      throw Object.assign(new Error(`assembled support record failed validation: ${errors.join('; ')}`), {
        assembledRecord: record,
      });
    }
    assertNotInterrupted();
    await writeFile(
      join(paths.results, 'candidate-support-record.json'),
      `${JSON.stringify(record, null, 2)}\n`,
    );
    assertNotInterrupted();
    await writeFile(
      join(paths.results, 'summary.json'),
      `${JSON.stringify({
        schema_version: 1,
        outcome: 'pass',
        support_record: 'candidate-support-record.json',
        phases: phaseReports,
        note: 'Review raw JSONL before promoting surfaces.json; this runner never edits the matrix.',
      }, null, 2)}\n`,
    );
    assertNotInterrupted();
    process.stdout.write(
      `Probe passed. Review ${join(paths.results, 'summary.json')} and raw JSONL before promotion.\n` +
      `The isolated CODEX_HOME may contain credentials; sanitize it with:\n` +
      `  node ${JSON.stringify(fileURLToPath(import.meta.url))} --sanitize\n`,
    );
  } catch (error) {
    await rm(join(paths.results, 'candidate-support-record.json'), { force: true });
    await rm(join(paths.results, 'summary.json'), { force: true });
    const failure = {
      schema_version: 1,
      outcome: 'incomplete-probe',
      failed_at: new Date().toISOString(),
      error: error.message,
      interrupted,
      command: error.commandResult ?? null,
      phases: phaseReports,
      assembled_record: error.assembledRecord ?? null,
    };
    await writeFile(join(paths.results, 'attempt.json'), `${JSON.stringify(failure, null, 2)}\n`);
    throw error;
  }
}

function relativeResultPath(path) {
  return path.slice(bundleRoot.length + 1);
}

main().catch((error) => {
  process.stderr.write(`Grove Codex support probe failed: ${error.message}\n`);
  process.exitCode = 1;
});
