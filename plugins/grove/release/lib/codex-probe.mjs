import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SURFACE_ID = 'codex-exec-non-ephemeral';
const CONFIG_SENTINEL = 'fixture-support-command-030';
const ADDENDUM_SENTINEL = 'fixture-executor-addendum-030';

function slug(value) {
  return String(value).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function invocationToken(prefix, value, commit) {
  return `${prefix}-${String(value).replace(/[^A-Za-z0-9]+/g, '-').toUpperCase()}-${commit.slice(0, 12).toUpperCase()}`;
}

async function exists(path) {
  return lstat(path).then(() => true, (error) => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
}

function pathIsInside(parent, candidate) {
  const rel = relative(parent, candidate);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..');
}

async function canonicalDestination(outputRoot) {
  const resolved = resolve(outputRoot);
  if (await exists(resolved)) {
    const info = await lstat(resolved);
    if (info.isSymbolicLink()) {
      throw new Error(`probe output must not be a symbolic link: ${resolved}`);
    }
    return realpath(resolved);
  }

  let ancestor = dirname(resolved);
  while (!(await exists(ancestor))) ancestor = dirname(ancestor);
  return resolve(await realpath(ancestor), relative(ancestor, resolved));
}

export async function ensureFreshOutputRoot(repositoryRoot, outputRoot) {
  const resolved = resolve(outputRoot);
  const canonicalRepository = await realpath(repositoryRoot);
  const intendedCanonical = await canonicalDestination(resolved);
  if (pathIsInside(canonicalRepository, intendedCanonical)) {
    throw new Error('probe output must be outside the repository working tree');
  }
  if (await exists(resolved)) {
    const info = await lstat(resolved);
    if (!info.isDirectory()) throw new Error(`probe output exists and is not a directory: ${resolved}`);
    if ((await readdir(resolved)).length > 0) throw new Error(`probe output directory is not empty: ${resolved}`);
  } else {
    await mkdir(resolved, { recursive: true });
  }
  const createdCanonical = await realpath(resolved);
  if (pathIsInside(canonicalRepository, createdCanonical)) {
    throw new Error('probe output resolved inside the repository working tree');
  }
  return resolved;
}

async function gitState(repositoryRoot, { repositoryCommit, requireCleanGit }) {
  let commit = repositoryCommit;
  if (!commit) {
    ({ stdout: commit } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot }));
    commit = commit.trim();
  }
  if (requireCleanGit) {
    const { stdout } = await execFileAsync(
      'git',
      ['status', '--porcelain', '--', 'charters', 'plugins/grove'],
      { cwd: repositoryRoot },
    );
    if (stdout.trim() !== '') {
      throw new Error('charters/ or plugins/grove/ is dirty; commit the exact candidate before preparing support evidence');
    }
  }
  return commit;
}

async function verifyCandidateTree(repositoryRoot) {
  const commands = [
    ['plugins/grove/build/bin/generate.mjs', '--check'],
    ['plugins/grove/release/bin/validate-release.mjs', '--check'],
    ['plugins/grove/release/bin/smoke-codex-projection.mjs'],
  ];
  for (const [script, ...args] of commands) {
    await execFileAsync(process.execPath, [join(repositoryRoot, script), ...args], {
      cwd: repositoryRoot,
    });
  }
  return commands.map(([script, ...args]) => [process.execPath, script, ...args]);
}

async function walkFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`candidate package contains unsupported filesystem entry: ${path}`);
    }
  }
  await visit(root);
  return files.sort();
}

async function treeDigest(root) {
  const hash = createHash('sha256');
  for (const path of await walkFiles(root)) {
    hash.update(relative(root, path).split(sep).join('/'));
    hash.update('\0');
    hash.update(await readFile(path));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function completedCollabItems(events, tool) {
  return events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => (
      event?.type === 'item.completed'
      && event.item?.type === 'collab_tool_call'
      && event.item?.tool === tool
      && event.item?.status === 'completed'
    ));
}

export function validateCodexExecEvidence(events, expectedInvocations, threadRoles = {}) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('Codex JSONL contains no events');
  }
  if (!events.some((event) => event?.type === 'thread.started')) {
    throw new Error('Codex JSONL contains no thread.started event');
  }
  if (!events.some((event) => event?.type === 'turn.completed')) {
    throw new Error('Codex JSONL contains no turn.completed event');
  }

  const spawns = completedCollabItems(events, 'spawn_agent');
  if (spawns.length !== expectedInvocations.length) {
    throw new Error(
      `Codex JSONL proves ${spawns.length} completed agent spawn(s); expected ${expectedInvocations.length}`,
    );
  }
  const waits = completedCollabItems(events, 'wait');
  const invocations = [];
  for (let index = 0; index < expectedInvocations.length; index += 1) {
    const expected = expectedInvocations[index];
    const spawn = spawns[index];
    const receiverIds = spawn.event.item.receiver_thread_ids;
    if (
      !Array.isArray(receiverIds)
      || receiverIds.length !== 1
      || !receiverIds[0]
    ) {
      throw new Error(
        `Codex JSONL spawn ${index + 1} does not identify exactly one child thread`,
      );
    }
    const receiverId = receiverIds[0];
    const roleProof = threadRoles[receiverId];
    if (
      roleProof?.agent_role !== expected.native_id
      || roleProof?.parent_thread_id !== spawn.event.item.sender_thread_id
    ) {
      throw new Error(
        `isolated session metadata does not prove custom agent role ${expected.native_id}`,
      );
    }
    if (!spawn.event.item.prompt?.includes(expected.invocation)) {
      throw new Error(
        `Codex JSONL spawn for ${expected.native_id} lacks its invocation challenge`,
      );
    }
    const nextSpawnIndex = spawns[index + 1]?.index ?? Number.POSITIVE_INFINITY;
    const wait = waits.find(({ event, index: waitIndex }) => {
      const state = event.item.agents_states?.[receiverId];
      return (
        waitIndex > spawn.index
        && waitIndex < nextSpawnIndex
        && state?.status === 'completed'
        && state?.message?.includes(expected.invocation)
        && (expected.required_observations ?? [])
          .every((observation) => state.message.includes(String(observation)))
      );
    });
    if (!wait) {
      throw new Error(
        `Codex JSONL does not prove completed sequential work by ${expected.native_id}`,
      );
    }
    invocations.push({
      native_id: expected.native_id,
      invocation: expected.invocation,
      thread_id: receiverId,
      observed_agent_role: roleProof.agent_role,
      observed_parent_thread_id: roleProof.parent_thread_id,
      observed_cli_version: roleProof.cli_version,
      session_meta_sha256: roleProof.session_meta_sha256,
      session_metadata: roleProof.session_metadata,
    });
  }
  return {
    raw_event_count: events.length,
    completed_spawn_count: spawns.length,
    invocations,
  };
}

function identitySchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['identities'],
    properties: {
      identities: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['canonical_id', 'native_id', 'exposure', 'source', 'digest', 'invocation'],
          properties: {
            canonical_id: { type: 'string' },
            native_id: { type: ['string', 'null'] },
            exposure: { type: 'string' },
            source: { type: 'string' },
            digest: { type: 'string' },
            invocation: { type: 'string' },
          },
        },
      },
    },
  };
}

function separationSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['separate', 'producer', 'reviewer'],
    properties: {
      separate: { type: 'boolean' },
      producer: {
        type: 'object',
        additionalProperties: false,
        required: ['native_id', 'invocation'],
        properties: {
          native_id: { type: 'string' },
          invocation: { type: 'string' },
        },
      },
      reviewer: {
        type: 'object',
        additionalProperties: false,
        required: ['native_id', 'invocation'],
        properties: {
          native_id: { type: 'string' },
          invocation: { type: 'string' },
        },
      },
    },
  };
}

function scopedDispatcherSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['native_id', 'exposure', 'invocation', 'advertised_driving_session'],
    properties: {
      native_id: { type: 'string' },
      exposure: { type: 'string' },
      invocation: { type: 'string' },
      advertised_driving_session: { type: 'boolean' },
    },
  };
}

function configSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['role', 'config_sentinel', 'addendum_sentinel', 'both_observed', 'invocation'],
    properties: {
      role: { type: 'string' },
      config_sentinel: { type: 'string' },
      addendum_sentinel: { type: 'string' },
      both_observed: { type: 'boolean' },
      invocation: { type: 'string' },
    },
  };
}

function expectedBlock(identities) {
  return JSON.stringify(identities, null, 2);
}

function drivingPrompt(identities) {
  const assignments = identities.map(({ canonical_id, invocation }) => ({
    canonical_id,
    native_id: null,
    invocation,
  }));
  return `This is a Grove support-evidence probe, not role work.
Do not delegate or spawn any agent. In this driving session, load and inspect
the installed Grove dispatcher and shaper role skills. Discover each role's
source, canonical digest, and driving-session exposure from the installed
skill/reference, then return only JSON matching the supplied schema. Preserve
each assigned invocation token exactly. These driving roles have no native
custom-agent id: preserve native_id as null; role-* skill names are loading
adapters, not native ids.

Assignments:
${expectedBlock(assignments)}
`;
}

function nativePrompt(identities) {
  const assignments = identities.map(({ native_id, invocation }) => ({
    native_id,
    invocation,
  }));
  return `This is a Grove support-evidence probe, not role work.
For each assignment below, sequentially spawn the exact custom agent
named by native_id, wait for it, and ask it only to load its installed Grove
role skill/reference and discover its canonical id, source, digest, and
exposure. Spawn no other agents and never run two concurrently. Preserve every
invocation token exactly. Return only one JSON object matching the supplied
schema, with identities in the listed order.

Assignments:
${expectedBlock(assignments)}
`;
}

function separationPrompt({ producer, reviewer }) {
  return `This is a Grove support-evidence probe, not implementation or review.
Sequentially spawn exactly two distinct custom agents: grove_executor and
grove_code_reviewer. Wait for each. Ask each only to load its Grove role and
return its assigned invocation token. Do not let either agent perform role
work. Return only JSON matching the supplied schema:
${JSON.stringify({ separate: true, producer, reviewer }, null, 2)}
`;
}

function scopedPrompt(expected) {
  return `This is a Grove support-evidence probe, not dispatch work.
Spawn exactly the custom agent grove_dispatcher and wait for it. Ask it to
load the installed dispatcher role and discover its actual exposure plus
whether that role advertises driving-session responsibility. Ask the child to
return only a compact JSON object containing native_id, exposure,
advertised_driving_session, and its assigned invocation token. Return only
JSON matching the supplied schema:
${JSON.stringify({
    native_id: expected.native_id,
    invocation: expected.invocation,
  }, null, 2)}
`;
}

function configPrompt(expected) {
  return `This is a Grove support-evidence probe, not implementation work.
Spawn exactly grove_executor and wait for it. Ask it to load its Grove role,
read the consumer's .grove/config.toml and .grove/agents/executor.md, and
discover the config and addendum sentinel values without running either
command or modifying the repository. Ask the child to return only a compact
JSON object containing role, config_sentinel, addendum_sentinel,
both_observed, and its assigned invocation token. Return only JSON matching
the supplied schema:
${JSON.stringify({
    role: expected.role,
    invocation: expected.invocation,
  }, null, 2)}
`;
}

function makePhases({ driving, native, commit }) {
  const nativeBatches = [native.slice(0, 4), native.slice(4, 8), native.slice(8, 12)];
  const producer = {
    native_id: 'grove_executor',
    invocation: invocationToken('SEPARATION', 'executor', commit),
  };
  const reviewer = {
    native_id: 'grove_code_reviewer',
    invocation: invocationToken('SEPARATION', 'code-reviewer', commit),
  };
  const scoped = {
    native_id: 'grove_dispatcher',
    exposure: 'scoped-advisor',
    invocation: invocationToken('SCOPED', 'dispatcher', commit),
    advertised_driving_session: false,
  };
  const config = {
    role: 'grove_executor',
    config_sentinel: CONFIG_SENTINEL,
    addendum_sentinel: ADDENDUM_SENTINEL,
    both_observed: true,
    invocation: invocationToken('CONFIG', 'executor', commit),
  };
  return [
    {
      id: '01-driving-session',
      kind: 'driving-session',
      expected_count: driving.length,
      schema: 'schemas/identity-batch.json',
      prompt: 'prompts/01-driving-session.md',
      expected: driving,
      promptText: drivingPrompt(driving),
    },
    ...nativeBatches.map((batch, index) => ({
      id: `0${index + 2}-native-batch-${index + 1}`,
      kind: 'native-batch',
      expected_count: batch.length,
      schema: 'schemas/identity-batch.json',
      prompt: `prompts/0${index + 2}-native-batch-${index + 1}.md`,
      expected: batch,
      promptText: nativePrompt(batch),
    })),
    {
      id: '05-producer-reviewer-separation',
      kind: 'separation',
      expected_count: 2,
      schema: 'schemas/separation.json',
      prompt: 'prompts/05-producer-reviewer-separation.md',
      expected: { separate: true, producer, reviewer },
      promptText: separationPrompt({ producer, reviewer }),
    },
    {
      id: '06-scoped-dispatcher',
      kind: 'scoped-dispatcher',
      expected_count: 1,
      schema: 'schemas/scoped-dispatcher.json',
      prompt: 'prompts/06-scoped-dispatcher.md',
      expected: scoped,
      promptText: scopedPrompt(scoped),
    },
    {
      id: '07-config-addendum',
      kind: 'config-addendum',
      expected_count: 1,
      schema: 'schemas/config-addendum.json',
      prompt: 'prompts/07-config-addendum.md',
      expected: config,
      promptText: configPrompt(config),
    },
  ];
}

export async function prepareCodexSupportProbe({
  repositoryRoot,
  outputRoot = null,
  repositoryCommit = null,
  requireCleanGit = true,
  verifyCandidate = true,
} = {}) {
  const repoRoot = resolve(repositoryRoot);
  const packageRoot = join(repoRoot, 'plugins', 'grove');
  const destination = await ensureFreshOutputRoot(
    repoRoot,
    outputRoot ?? await mkdtemp(join(tmpdir(), 'grove-codex-support-')),
  );
  const commit = await gitState(repoRoot, { repositoryCommit, requireCleanGit });
  const preflightCommands = verifyCandidate ? await verifyCandidateTree(repoRoot) : [];
  const version = (await readFile(join(packageRoot, 'VERSION'), 'utf8')).trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`invalid Grove VERSION: ${version}`);

  const marketplaceRoot = join(destination, 'marketplace');
  const snapshotRoot = join(marketplaceRoot, 'plugins', 'grove');
  const consumerRoot = join(destination, 'consumer');
  const codexHome = join(destination, 'codex-home');
  const sqliteHome = join(destination, 'codex-sqlite');
  const runtimeTmp = join(destination, 'runtime-tmp');
  for (const path of [
    dirname(snapshotRoot),
    consumerRoot,
    codexHome,
    sqliteHome,
    runtimeTmp,
    join(destination, 'logs'),
    join(destination, 'results'),
    join(destination, 'prompts'),
    join(destination, 'schemas'),
  ]) {
    await mkdir(path, { recursive: true });
  }

  await cp(packageRoot, snapshotRoot, {
    recursive: true,
    filter: (source) => basename(source) !== 'node_modules',
  });
  const packageTreeSha256 = await treeDigest(snapshotRoot);
  const shortCommit = slug(commit).slice(0, 12) || packageTreeSha256.slice(0, 12);
  const marketplaceName = `grove-probe-${version.replaceAll('.', '-')}-${shortCommit}`;
  await mkdir(join(marketplaceRoot, '.agents', 'plugins'), { recursive: true });
  await writeFile(
    join(marketplaceRoot, '.agents', 'plugins', 'marketplace.json'),
    `${JSON.stringify({
      name: marketplaceName,
      interface: { displayName: `Grove ${version} isolated support probe` },
      plugins: [{
        name: 'grove',
        source: { source: 'local', path: './plugins/grove' },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        category: 'Developer Tools',
      }],
    }, null, 2)}\n`,
  );

  await execFileAsync('git', ['init', '--quiet'], { cwd: consumerRoot });
  const consumerEmptyBeforeCompose = (await readdir(consumerRoot))
    .filter((name) => name !== '.git')
    .length === 0;
  if (!consumerEmptyBeforeCompose) throw new Error('fresh consumer was not empty before Grove composition');

  const lifecycleUrl = pathToFileURL(join(snapshotRoot, 'operations', 'lib', 'lifecycle.mjs')).href;
  const { applyPlan, planSetup } = await import(`${lifecycleUrl}?probe=${Date.now()}`);
  const plan = await planSetup({
    packageRoot: snapshotRoot,
    repoRoot: consumerRoot,
    host: 'codex',
    surface: { surface_id: SURFACE_ID, provenance: 'user-explicit' },
    choices: {
      preset: 'steward',
      config: {
        TEST_CMD: `printf '${CONFIG_SENTINEL}\\n'`,
        TYPECHECK_CMD: "printf 'fixture-typecheck-command-030\\n'",
        TEST_DEPS_LEDGER: 'none exists yet',
      },
    },
  });
  if (!plan.ok) throw new Error(`Grove setup plan failed: ${plan.summary}`);
  await applyPlan(plan, { confirmedActionIds: plan.actions.map((action) => action.id) });
  await mkdir(join(consumerRoot, '.grove', 'agents'), { recursive: true });
  await writeFile(
    join(consumerRoot, '.grove', 'agents', 'executor.md'),
    `# Probe-only executor addendum\n\nSentinel: ${ADDENDUM_SENTINEL}\n`,
  );

  const inventory = JSON.parse(await readFile(join(packageRoot, 'roles.json'), 'utf8'));
  const driving = [];
  const native = [];
  const sourceDigests = {};
  for (const role of inventory.roles) {
    const digest = createHash('sha256').update(await readFile(join(repoRoot, role.source))).digest('hex');
    sourceDigests[role.id] = digest;
    for (const exposure of role.exposures) {
      const identity = {
        canonical_id: role.id,
        native_id: exposure.native_id ?? null,
        exposure: exposure.class,
        source: role.source,
        digest,
        invocation: invocationToken(
          exposure.class === 'driving-session' ? 'DRIVING' : 'NATIVE',
          exposure.native_id ?? role.id,
          commit,
        ),
      };
      if (exposure.class === 'driving-session') driving.push(identity);
      else native.push(identity);
    }
  }
  const phases = makePhases({ driving, native, commit });

  const schemas = {
    'identity-batch.json': identitySchema(),
    'separation.json': separationSchema(),
    'scoped-dispatcher.json': scopedDispatcherSchema(),
    'config-addendum.json': configSchema(),
  };
  for (const [name, schema] of Object.entries(schemas)) {
    await writeFile(join(destination, 'schemas', name), `${JSON.stringify(schema, null, 2)}\n`);
  }
  for (const phase of phases) {
    await writeFile(join(destination, phase.prompt), phase.promptText);
    delete phase.promptText;
  }

  await writeFile(
    join(codexHome, '.grove-probe-home.json'),
    `${JSON.stringify({ schema_version: 1, marketplace: marketplaceName, repository_commit: commit }, null, 2)}\n`,
  );
  for (const [path, kind] of [
    [sqliteHome, 'sqlite-home'],
    [runtimeTmp, 'runtime-tmp'],
  ]) {
    await writeFile(
      join(path, '.grove-probe-state.json'),
      `${JSON.stringify({ schema_version: 1, kind, repository_commit: commit }, null, 2)}\n`,
    );
  }
  await writeFile(
    join(codexHome, 'config.toml'),
    '# Probe-local configuration; credentials must not use the shared OS keyring.\n' +
    'cli_auth_credentials_store = "file"\n\n' +
    '[agents]\n' +
    'enabled = true\n' +
    'max_concurrent_threads_per_session = 1\n',
  );
  const runnerSource = join(packageRoot, 'release', 'bin', 'run-codex-support-probe.mjs');
  await cp(runnerSource, join(destination, 'run-probe.mjs'));

  const manifest = {
    schema_version: 1,
    prepared_at: new Date().toISOString(),
    host: 'codex',
    surface_id: SURFACE_ID,
    grove_version: version,
    repository_commit: commit,
    package_tree_sha256: packageTreeSha256,
    preflight_commands: preflightCommands,
    marketplace_name: marketplaceName,
    consumer_empty_before_compose: consumerEmptyBeforeCompose,
    surface_provenance: 'user-explicit',
    profile: 'steward',
    sandbox: 'read-only',
    approval_policy: 'never',
    paths: {
      marketplace: 'marketplace',
      package_snapshot: 'marketplace/plugins/grove',
      consumer: 'consumer',
      codex_home: 'codex-home',
      sqlite_home: 'codex-sqlite',
      runtime_tmp: 'runtime-tmp',
      logs: 'logs',
      results: 'results',
    },
    expected: {
      driving_session: driving,
      native,
      source_digests: sourceDigests,
      config_sentinel: CONFIG_SENTINEL,
      addendum_sentinel: ADDENDUM_SENTINEL,
    },
    phases,
  };
  await writeFile(join(destination, 'probe-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    outputRoot: destination,
    runCommand: `node ${JSON.stringify(join(destination, 'run-probe.mjs'))}`,
    codexLaunched: false,
    manifest,
  };
}
