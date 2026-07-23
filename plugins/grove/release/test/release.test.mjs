// Upstream: spec-0004-dual-host-distribution@v3.
// INV6/11/12/15/17/21 and S3/S10/S11/S15/S19.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import {
  decideTagAction,
  renderSurfaceDocumentation,
  validateCodexManifest,
  validateHostDeclarations,
  validateReleaseTree,
  validateSupportRecord,
  validateSurfaceMatrix,
  validateVersionText,
} from '../lib/release.mjs';
import {
  ensureFreshOutputRoot,
  prepareCodexSupportProbe,
  validateCodexExecEvidence,
} from '../lib/codex-probe.mjs';

const execFileAsync = promisify(execFile);
const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const fixtureRoots = new Set();

after(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixtureRoot() {
  const root = await mkdtemp(join(tmpdir(), 'grove-release-'));
  fixtureRoots.add(root);
  return root;
}

const SURFACE_IDS = [
  'claude-interactive',
  'claude-cloud',
  'claude-github-action',
  'claude-headless',
  'claude-agent-sdk',
  'codex-cli-interactive',
  'codex-exec-non-ephemeral',
  'codex-exec-ephemeral',
  'codex-desktop-local',
  'codex-cloud-web',
  'codex-ide',
  'codex-sdk',
];

function row(surfaceId, overrides = {}) {
  const host = surfaceId.startsWith('claude-') ? 'claude' : 'codex';
  return {
    surface_id: surfaceId,
    host,
    bridge_state: host === 'claude' ? 'host-native' : 'unknown',
    release_state: 'unsupported',
    load_path: null,
    evidence: [],
    missing_capability: 'No complete fresh-release support record exists.',
    disclosure: `${surfaceId} is unsupported in this release.`,
    ...overrides,
  };
}

function matrix(overrides = {}) {
  return {
    schema_version: 1,
    version: '0.3.0',
    rows: SURFACE_IDS.map((id) => row(id)),
    ...overrides,
  };
}

test('INV11 — VERSION accepts one strict semver line and rejects ambiguous carriers', () => {
  assert.equal(validateVersionText('0.3.0\n'), '0.3.0');
  assert.throws(() => validateVersionText('v0.3.0\n'), /semantic version/i);
  assert.throws(() => validateVersionText('0.3.0\n0.3.1\n'), /one line/i);
});

test('INV6/S3 — bridge viability remains a candidate until full support evidence exists', () => {
  const value = matrix();
  value.rows = value.rows.map((item) => item.surface_id === 'codex-exec-non-ephemeral'
    ? row(item.surface_id, {
      bridge_state: 'bridge-viable',
      release_state: 'candidate',
      load_path: 'project .codex/agents/<native_id>.toml -> plugin skill/reference',
      evidence: ['reference/surfaces/codex-bridge-spike-2026-07-23.json'],
      missing_capability: 'The full thirteen-role fresh-release support record is incomplete.',
      disclosure: 'Bridge-viable for integration; not a supported release surface.',
    })
    : item);

  assert.deepEqual(validateSurfaceMatrix(value, { release: false }), []);
  assert.match(validateSurfaceMatrix(value, { release: true }).join('\n'), /candidate/i);
});

test('INV12 — supported claims require an explicit load path and complete support record', () => {
  const value = matrix();
  value.rows[0] = row('claude-interactive', {
    release_state: 'supported',
    load_path: 'Claude marketplace install and fresh interactive session',
    missing_capability: null,
    disclosure: 'Supported.',
  });
  assert.match(validateSurfaceMatrix(value, { release: true }).join('\n'), /support_record/i);
});

test('INV20/S18 — support records reject false identity and separation claims', () => {
  const supportedRow = row('codex-exec-non-ephemeral', {
    release_state: 'supported',
    bridge_state: 'bridge-viable',
    load_path: 'project launchers',
    support_record: 'record.json',
  });
  const inventory = {
    schema: 1,
    roles: [
      {
        id: 'dispatcher',
        source: 'charters/dispatcher.md',
        exposures: [
          { class: 'driving-session' },
          { class: 'scoped-advisor', native_id: 'grove_dispatcher' },
        ],
      },
      {
        id: 'shaper',
        source: 'charters/shaper.md',
        exposures: [{ class: 'driving-session' }],
      },
      {
        id: 'executor',
        source: 'charters/executor.md',
        exposures: [{ class: 'cold-native', native_id: 'grove_executor' }],
      },
      {
        id: 'code-reviewer',
        source: 'charters/code-reviewer.md',
        exposures: [{ class: 'cold-native', native_id: 'grove_code_reviewer' }],
      },
    ],
  };
  const falseRecord = {
    host: 'codex',
    surface_id: 'codex-exec-non-ephemeral',
    grove_version: '0.3.0',
    host_version: 'codex-cli test',
    clean_environment: { consumer_empty: true, candidate_only: true },
    install_load_path: 'test',
    launcher_form: { count: 2, contains_charter_body: false },
    role_identities: { driving_session: [], native: [] },
    producer_reviewer_separation: { separate: false },
    driving_session_roles: { delegated: true, matched_inventory: false },
    spawned_dispatcher: { exposure: 'driving-session', advertised_driving_session: true },
    config_and_addendum: { both_observed: false },
    outcome: 'pass',
    observed_at: '2026-07-23',
    procedure: ['test'],
  };
  const errors = validateSupportRecord(falseRecord, supportedRow, '0.3.0', {
    inventory,
    sourceDigests: {
      dispatcher: 'd'.repeat(64),
      shaper: 's'.repeat(64),
      executor: 'e'.repeat(64),
      'code-reviewer': 'c'.repeat(64),
    },
  }).join('\n');
  assert.match(errors, /driving.*identit/i);
  assert.match(errors, /native.*identit/i);
  assert.match(errors, /separate/i);
  assert.match(errors, /delegat/i);
  assert.match(errors, /scoped-advisor/i);
  assert.match(errors, /config.*addendum/i);
});

test('INV20/S18 — each discovered role requires a distinct invocation token', () => {
  const supportedRow = row('codex-exec-non-ephemeral', {
    release_state: 'supported',
    bridge_state: 'bridge-viable',
    load_path: 'project launchers',
    support_record: 'record.json',
  });
  const inventory = {
    schema: 1,
    roles: [
      {
        id: 'dispatcher',
        source: 'charters/dispatcher.md',
        exposures: [
          { class: 'driving-session' },
          { class: 'scoped-advisor', native_id: 'grove_dispatcher' },
        ],
      },
      {
        id: 'shaper',
        source: 'charters/shaper.md',
        exposures: [{ class: 'driving-session' }],
      },
      {
        id: 'executor',
        source: 'charters/executor.md',
        exposures: [{ class: 'cold-native', native_id: 'grove_executor' }],
      },
      {
        id: 'code-reviewer',
        source: 'charters/code-reviewer.md',
        exposures: [{ class: 'cold-native', native_id: 'grove_code_reviewer' }],
      },
    ],
  };
  const digests = {
    dispatcher: 'd'.repeat(64),
    shaper: 'a'.repeat(64),
    executor: 'e'.repeat(64),
    'code-reviewer': 'c'.repeat(64),
  };
  const identity = (canonical_id, exposure, native_id = null) => ({
    canonical_id,
    native_id,
    exposure,
    source: `charters/${canonical_id}.md`,
    digest: digests[canonical_id],
    invocation: 'REUSED-TOKEN',
  });
  const record = {
    host: 'codex',
    surface_id: 'codex-exec-non-ephemeral',
    grove_version: '0.3.0',
    host_version: 'codex-cli test',
    clean_environment: { consumer_empty: true, candidate_only: true, fresh_session: true },
    install_load_path: 'test',
    launcher_form: { count: 3, contains_charter_body: false },
    role_identities: {
      driving_session: [
        identity('dispatcher', 'driving-session'),
        identity('shaper', 'driving-session'),
      ],
      native: [
        identity('dispatcher', 'scoped-advisor', 'grove_dispatcher'),
        identity('executor', 'cold-native', 'grove_executor'),
        identity('code-reviewer', 'cold-native', 'grove_code_reviewer'),
      ],
    },
    producer_reviewer_separation: {
      separate: true,
      producer: { native_id: 'grove_executor', invocation: 'EXECUTOR' },
      reviewer: { native_id: 'grove_code_reviewer', invocation: 'REVIEWER' },
    },
    driving_session_roles: {
      delegated: false,
      matched_inventory: true,
      dispatcher_invocation: 'DRIVING-DISPATCHER',
      shaper_invocation: 'DRIVING-SHAPER',
    },
    spawned_dispatcher: {
      native_id: 'grove_dispatcher',
      exposure: 'scoped-advisor',
      advertised_driving_session: false,
      invocation: 'SCOPED-DISPATCHER',
    },
    config_and_addendum: {
      role: 'grove_executor',
      config_sentinel: 'config',
      addendum_sentinel: 'addendum',
      both_observed: true,
    },
    outcome: 'pass',
    observed_at: '2026-07-23',
    procedure: ['test'],
  };

  const errors = validateSupportRecord(record, supportedRow, '0.3.0', {
    inventory,
    sourceDigests: digests,
  }).join('\n');
  assert.match(errors, /invocation.*unique|unique.*invocation/i);
});

test('INV15/S11 — actual package composes and discovers its inventory-derived Codex projection', async () => {
  const script = resolve(import.meta.dirname, '..', 'bin', 'smoke-codex-projection.mjs');
  const { stdout } = await execFileAsync(process.execPath, [script]);
  assert.match(stdout, /package smoke passed/i);
  assert.match(stdout, /12 native/i);
  assert.match(stdout, /2 driving/i);
});

test('INV20/S18 — probe preparation isolates candidate state without launching Codex', async () => {
  const root = await fixtureRoot();
  const outputRoot = join(root, 'codex-probe');
  const result = await prepareCodexSupportProbe({
    repositoryRoot: REPOSITORY_ROOT,
    outputRoot,
    repositoryCommit: 'test-commit',
    requireCleanGit: false,
    verifyCandidate: false,
  });

  const manifest = JSON.parse(await readFile(join(outputRoot, 'probe-manifest.json'), 'utf8'));
  const marketplace = JSON.parse(await readFile(
    join(outputRoot, 'marketplace', '.agents', 'plugins', 'marketplace.json'),
    'utf8',
  ));
  const runner = await readFile(join(outputRoot, 'run-probe.mjs'), 'utf8');
  const launchers = await readdir(join(outputRoot, 'consumer', '.codex', 'agents'));
  const config = await readFile(join(outputRoot, 'consumer', '.grove', 'config.toml'), 'utf8');
  const addendum = await readFile(join(outputRoot, 'consumer', '.grove', 'agents', 'executor.md'), 'utf8');
  const probeConfig = await readFile(join(outputRoot, 'codex-home', 'config.toml'), 'utf8');
  const drivingPrompt = await readFile(
    join(outputRoot, 'prompts', '01-driving-session.md'),
    'utf8',
  );
  const nativePrompt = await readFile(
    join(outputRoot, 'prompts', '02-native-batch-1.md'),
    'utf8',
  );
  const scopedPrompt = await readFile(
    join(outputRoot, 'prompts', '06-scoped-dispatcher.md'),
    'utf8',
  );
  const configPrompt = await readFile(
    join(outputRoot, 'prompts', '07-config-addendum.md'),
    'utf8',
  );
  const help = await execFileAsync(process.execPath, [join(outputRoot, 'run-probe.mjs'), '--help']);

  assert.equal(result.codexLaunched, false);
  assert.equal(manifest.surface_id, 'codex-exec-non-ephemeral');
  assert.equal(manifest.repository_commit, 'test-commit');
  assert.equal(manifest.expected.native.length, 12);
  assert.equal(manifest.expected.driving_session.length, 2);
  assert.deepEqual(manifest.phases.map((phase) => phase.expected_count), [2, 4, 4, 4, 2, 1, 1]);
  assert.deepEqual(
    marketplace.plugins[0].source,
    { source: 'local', path: './plugins/grove' },
  );
  assert.equal(launchers.filter((name) => name.endsWith('.toml')).length, 12);
  assert.match(config, /fixture-support-command-030/);
  assert.match(addendum, /fixture-executor-addendum-030/);
  assert.match(probeConfig, /cli_auth_credentials_store = "file"/);
  assert.match(probeConfig, /max_concurrent_threads_per_session = 1/);
  assert.match(
    drivingPrompt,
    /"native_id": null/,
    'driving-role assignments must disambiguate adapter skill names from native agent ids',
  );
  assert.doesNotMatch(drivingPrompt, new RegExp(manifest.expected.driving_session[0].digest));
  assert.doesNotMatch(nativePrompt, new RegExp(manifest.expected.native[0].digest));
  assert.doesNotMatch(nativePrompt, new RegExp(manifest.expected.native[0].source));
  assert.doesNotMatch(scopedPrompt, /scoped-advisor/);
  assert.doesNotMatch(configPrompt, /fixture-support-command-030/);
  assert.doesNotMatch(configPrompt, /fixture-executor-addendum-030/);
  assert.match(runner, /CODEX_HOME/);
  assert.match(runner, /codex exec/);
  assert.doesNotMatch(runner, /--ephemeral/);
  assert.match(
    runner,
    /const args = \[\s*'-a',\s*'never',\s*'exec',/,
    'the global approval flag must precede the exec subcommand',
  );
  assert.doesNotMatch(runner, /\.\.\.process\.env/);
  assert.match(runner, /activeChild === childForSignal/);
  assert.match(runner, /terminatePid\(pid, 'SIGKILL'\)/);
  assert.match(help.stdout, /external Terminal/);
  assert.equal(await readdir(join(outputRoot, 'codex-home')).then((items) => items.length), 2);

  const resultsMarker = join(outputRoot, 'results', 'keep.txt');
  const retainedRoleProof = join(outputRoot, 'logs', '02-native-batch-1-agent-metadata.json');
  await writeFile(resultsMarker, 'retain\n');
  await writeFile(
    retainedRoleProof,
    `${JSON.stringify([{
      thread_id: 'child-1',
      observed_agent_role: 'grove_executor',
      observed_parent_thread_id: 'root',
      observed_cli_version: '0.145.0',
      session_meta_sha256: 'a'.repeat(64),
    }])}\n`,
  );
  manifest.paths.sqlite_home = 'results';
  await writeFile(join(outputRoot, 'probe-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await assert.rejects(
    execFileAsync(process.execPath, [join(outputRoot, 'run-probe.mjs'), '--sanitize']),
    /manifest path sqlite_home/i,
  );
  assert.equal(await readFile(resultsMarker, 'utf8'), 'retain\n');

  manifest.paths.sqlite_home = 'codex-sqlite';
  await writeFile(join(outputRoot, 'probe-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const sqliteMarker = join(outputRoot, 'codex-sqlite', '.grove-probe-state.json');
  const marker = JSON.parse(await readFile(sqliteMarker, 'utf8'));
  await rm(sqliteMarker);
  await assert.rejects(
    execFileAsync(process.execPath, [join(outputRoot, 'run-probe.mjs'), '--sanitize']),
    /ENOENT|probe state marker/i,
  );
  await writeFile(sqliteMarker, `${JSON.stringify({ ...marker, repository_commit: 'other' })}\n`);
  await assert.rejects(
    execFileAsync(process.execPath, [join(outputRoot, 'run-probe.mjs'), '--sanitize']),
    /probe state marker does not match/i,
  );
  await writeFile(sqliteMarker, `${JSON.stringify(marker)}\n`);
  await execFileAsync(process.execPath, [join(outputRoot, 'run-probe.mjs'), '--sanitize']);
  assert.equal(await readFile(resultsMarker, 'utf8'), 'retain\n');
  assert.match(await readFile(retainedRoleProof, 'utf8'), /observed_agent_role/);
  await assert.rejects(readFile(join(outputRoot, 'codex-home', 'config.toml')), /ENOENT/);
});

test('INV20 — probe output containment rejects a symlink into the repository', async () => {
  const root = await fixtureRoot();
  const repositoryRoot = join(root, 'repository');
  const inside = join(repositoryRoot, 'probe-output');
  const outsideAlias = join(root, 'outside-alias');
  await mkdir(inside, { recursive: true });
  await symlink(inside, outsideAlias);
  await assert.rejects(
    ensureFreshOutputRoot(repositoryRoot, outsideAlias),
    /symbolic link|outside the repository/i,
  );
});

test('S18 — raw Codex events must prove exact sequential custom-agent invocations', () => {
  const expected = [
    {
      native_id: 'grove_executor',
      invocation: 'EXECUTOR-CHALLENGE',
      required_observations: ['cold-native'],
    },
    { native_id: 'grove_code_reviewer', invocation: 'REVIEWER-CHALLENGE' },
  ];
  const spawn = (threadId, invocation) => ({
    type: 'item.completed',
    item: {
      type: 'collab_tool_call',
      tool: 'spawn_agent',
      status: 'completed',
      prompt: `return ${invocation}`,
      sender_thread_id: 'root',
      receiver_thread_ids: [threadId],
      agents_states: { [threadId]: { status: 'running', message: null } },
    },
  });
  const wait = (threadId, invocation) => ({
    type: 'item.completed',
    item: {
      type: 'collab_tool_call',
      tool: 'wait',
      status: 'completed',
      receiver_thread_ids: [threadId],
      agents_states: { [threadId]: { status: 'completed', message: invocation } },
    },
  });
  const valid = [
    { type: 'thread.started', thread_id: 'root' },
    spawn('child-1', 'EXECUTOR-CHALLENGE'),
    wait('child-1', 'EXECUTOR-CHALLENGE cold-native'),
    spawn('child-2', 'REVIEWER-CHALLENGE'),
    wait('child-2', 'REVIEWER-CHALLENGE'),
    { type: 'turn.completed', usage: {} },
  ];
  const roles = {
    'child-1': {
      agent_role: 'grove_executor',
      parent_thread_id: 'root',
      cli_version: '0.145.0',
      session_meta_sha256: 'a'.repeat(64),
      session_metadata: 'codex-home/sessions/child-1.jsonl',
    },
    'child-2': {
      agent_role: 'grove_code_reviewer',
      parent_thread_id: 'root',
      cli_version: '0.145.0',
      session_meta_sha256: 'b'.repeat(64),
      session_metadata: 'codex-home/sessions/child-2.jsonl',
    },
  };
  assert.deepEqual(
    validateCodexExecEvidence(valid, expected, roles).invocations.map((item) => item.native_id),
    ['grove_executor', 'grove_code_reviewer'],
  );
  assert.deepEqual(
    validateCodexExecEvidence(valid, expected, roles).invocations.map((item) => ({
      role: item.observed_agent_role,
      parent: item.observed_parent_thread_id,
      version: item.observed_cli_version,
      hash: item.session_meta_sha256,
    })),
    [
      {
        role: 'grove_executor',
        parent: 'root',
        version: '0.145.0',
        hash: 'a'.repeat(64),
      },
      {
        role: 'grove_code_reviewer',
        parent: 'root',
        version: '0.145.0',
        hash: 'b'.repeat(64),
      },
    ],
  );
  assert.throws(
    () => validateCodexExecEvidence(valid, expected, {
      ...roles,
      'child-1': { ...roles['child-1'], agent_role: 'worker' },
    }),
    /does not prove custom agent role grove_executor/i,
  );
  assert.throws(
    () => validateCodexExecEvidence(
      [valid[0], valid[1], valid[3], valid[4], valid[5]],
      expected,
      roles,
    ),
    /completed sequential work by grove_executor/i,
  );
  assert.throws(
    () => validateCodexExecEvidence(
      [
        valid[0],
        valid[1],
        wait('child-1', 'EXECUTOR-CHALLENGE'),
        valid[3],
        valid[4],
        valid[5],
      ],
      expected,
      roles,
    ),
    /completed sequential work by grove_executor/i,
  );
});

test('surface matrix rejects missing, duplicate, extra, and unclassified rows', () => {
  const value = matrix();
  value.rows.pop();
  value.rows.push(row('codex-ide'));
  value.rows.push(row('made-up-surface', { release_state: 'pending' }));
  const errors = validateSurfaceMatrix(value, { release: false }).join('\n');
  assert.match(errors, /duplicate.*codex-ide/i);
  assert.match(errors, /missing.*codex-sdk/i);
  assert.match(errors, /unexpected.*made-up-surface/i);
  assert.match(errors, /pending/i);
});

test('matrix-generated support documentation is byte-validated, not separately authored', () => {
  const value = matrix();
  const rendered = renderSurfaceDocumentation(value);
  assert.match(rendered, /codex-exec-non-ephemeral/);
  assert.match(rendered, /Unsupported/);
});

test('INV11/S10 — validation reports every disagreeing version carrier', async () => {
  const root = await fixtureRoot();
  await mkdir(join(root, '.claude-plugin'), { recursive: true });
  await mkdir(join(root, '.codex-plugin'), { recursive: true });
  await mkdir(join(root, 'install'), { recursive: true });
  await mkdir(join(root, 'reference', 'surfaces'), { recursive: true });
  await writeFile(join(root, 'VERSION'), '0.3.0\n');
  await writeFile(join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'grove', version: '0.2.0' }));
  await writeFile(join(root, '.codex-plugin', 'plugin.json'), JSON.stringify({ name: 'grove', version: '0.4.0' }));
  await writeFile(join(root, 'surfaces.json'), JSON.stringify(matrix({ version: '0.5.0' })));
  await writeFile(join(root, 'install', 'hosts.json'), JSON.stringify({
    version: 'VERSION',
    surface_matrix: 'surfaces.json',
    config_tokens: 'install/config-tokens.json',
  }));

  const result = await validateReleaseTree(root, { release: false, docs: [] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /\.claude-plugin.*0\.2\.0/);
  assert.match(result.errors.join('\n'), /\.codex-plugin.*0\.4\.0/);
  assert.match(result.errors.join('\n'), /surfaces\.json.*0\.5\.0/);
});

test('INV17/S15 — the Codex plugin package rejects plugin-carried custom-agent TOML', async () => {
  const root = await fixtureRoot();
  await mkdir(join(root, '.codex', 'agents'), { recursive: true });
  await writeFile(join(root, '.codex', 'agents', 'executor.toml'), 'name = "executor"\n');
  const result = await validateReleaseTree(root, { release: false, docs: [], allowIncomplete: true });
  assert.match(result.errors.join('\n'), /custom-agent TOML/i);
});

test('dual manifests — Codex validation enforces ingestion-required interface metadata', () => {
  const errors = validateCodexManifest({
    name: 'grove',
    version: '0.3.0',
    description: 'Grove',
    author: { name: 'kodhama' },
    skills: './skills/',
    interface: {
      displayName: 'Grove',
      shortDescription: 'Grove',
      longDescription: 'Grove',
      developerName: 'kodhama',
      category: 'Developer Tools',
      capabilities: ['Skills'],
    },
  }, '0.3.0');
  assert.match(errors.join('\n'), /defaultPrompt/);
});

test('INV11/S10 — host adapters declare the shared VERSION and surface authorities', () => {
  assert.deepEqual(validateHostDeclarations({
    version: 'VERSION',
    surface_matrix: 'surfaces.json',
    config_tokens: 'install/config-tokens.json',
  }), []);
  assert.match(validateHostDeclarations({
    version: '.claude-plugin/plugin.json',
    surface_matrix: 'surfaces.json',
    config_tokens: 'install/config-tokens.json',
  }).join('\n'), /VERSION/);
  assert.match(validateHostDeclarations({
    version: 'VERSION',
    surface_matrix: 'surfaces.json',
    config_tokens: 'README.md',
  }).join('\n'), /config-tokens/);
});

test('INV21/S19 — an existing tag no-ops only at the intended peeled commit', () => {
  assert.deepEqual(decideTagAction({ intendedCommit: 'a'.repeat(40), tagCommit: null }), { action: 'create' });
  assert.deepEqual(decideTagAction({ intendedCommit: 'a'.repeat(40), tagCommit: 'a'.repeat(40) }), { action: 'noop' });
  assert.deepEqual(decideTagAction({ intendedCommit: 'a'.repeat(40), tagCommit: 'b'.repeat(40) }), {
    action: 'conflict',
    intendedCommit: 'a'.repeat(40),
    tagCommit: 'b'.repeat(40),
  });
});
