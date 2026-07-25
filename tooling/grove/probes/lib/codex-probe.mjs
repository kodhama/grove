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
import {
  assemblePackageSnapshot,
  packageTreeDigest,
  validatePackageTree,
} from '../../release/lib/release.mjs';

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
    ['tooling/grove/build/bin/generate.mjs', '--check'],
    ['tooling/grove/release/bin/validate-release.mjs', '--check'],
    ['tooling/grove/probes/bin/smoke-codex-projection.mjs'],
  ];
  for (const [script, ...args] of commands) {
    await execFileAsync(process.execPath, [join(repositoryRoot, script), ...args], {
      cwd: repositoryRoot,
    });
  }
  return commands.map(([script, ...args]) => [process.execPath, script, ...args]);
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

function sameJsonValue(actual, expected) {
  if (actual === expected) return true;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return (
      Array.isArray(actual)
      && Array.isArray(expected)
      && actual.length === expected.length
      && actual.every((value, index) => sameJsonValue(value, expected[index]))
    );
  }
  if (
    actual === null
    || expected === null
    || typeof actual !== 'object'
    || typeof expected !== 'object'
  ) {
    return false;
  }
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    sameJsonValue(actualKeys, expectedKeys)
    && actualKeys.every((key) => sameJsonValue(actual[key], expected[key]))
  );
}

export function parseCodexSessionEvidenceJsonl(text, sessionMetadata, rootThreadId) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const records = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const record = records[0];
  if (record?.type !== 'session_meta' || !record.payload?.id) return null;
  const turnContext = records.find((item) => item?.type === 'turn_context')?.payload;
  const finalMessage = records
    .filter((item) => (
      item?.type === 'response_item'
      && item.payload?.type === 'message'
      && item.payload?.role === 'assistant'
    ))
    .flatMap((item) => item.payload.content ?? [])
    .filter((item) => item?.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text)
    .at(-1) ?? null;
  const common = {
    thread_id: record.payload.id,
    cli_version: record.payload.cli_version ?? null,
    model: turnContext?.model ?? null,
    model_provider: record.payload.model_provider ?? null,
    multi_agent_version: turnContext?.multi_agent_version ?? null,
    session_meta_sha256: createHash('sha256').update(firstLine).digest('hex'),
    session_metadata: sessionMetadata,
  };
  if (record.payload.id === rootThreadId) {
    const collaborationCalls = records
      .filter((item) => (
        item?.type === 'response_item'
        && item.payload?.type === 'function_call'
        && item.payload?.namespace === 'collaboration'
      ))
      .map((item) => {
        const parsed = JSON.parse(item.payload.arguments);
        const { message: _encryptedMessage, ...argumentsWithoutMessage } = parsed;
        return {
          name: item.payload.name,
          call_id: item.payload.call_id,
          arguments: argumentsWithoutMessage,
        };
      });
    return {
      kind: 'root',
      ...common,
      collaboration_calls: collaborationCalls,
    };
  }
  const source = record.payload.source?.subagent?.thread_spawn;
  if (!source) return null;
  return {
    kind: 'child',
    ...common,
    agent_role: source.agent_role ?? record.payload.agent_role ?? null,
    agent_path: source.agent_path ?? record.payload.agent_path ?? null,
    agent_nickname: source.agent_nickname ?? record.payload.agent_nickname ?? null,
    parent_thread_id: source.parent_thread_id ?? record.payload.parent_thread_id ?? null,
    final_message: finalMessage,
  };
}

export function validateCodexV2SessionEvidence(
  events,
  expectedInvocations,
  {
    rootThreadId,
    model,
    expectedModel,
    modelProvider,
    expectedModelProvider,
    multiAgentVersion,
    collaborationCalls = [],
    threadRoles = {},
  } = {},
) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('Codex JSONL contains no events');
  }
  const started = events.find((event) => event?.type === 'thread.started');
  if (!started?.thread_id || started.thread_id !== rootThreadId) {
    throw new Error('Codex JSONL thread id does not match persisted root session');
  }
  if (!events.some((event) => event?.type === 'turn.completed')) {
    throw new Error('Codex JSONL contains no turn.completed event');
  }
  if (multiAgentVersion !== 'v2') {
    throw new Error(`persisted root session is not MultiAgentV2: ${multiAgentVersion ?? 'unknown'}`);
  }
  if (!expectedModel || model !== expectedModel) {
    throw new Error(
      `persisted root session model ${model ?? 'unknown'} does not match pinned model ${expectedModel ?? 'missing'}`,
    );
  }
  if (!expectedModelProvider || modelProvider !== expectedModelProvider) {
    throw new Error(
      `persisted root session model provider ${modelProvider ?? 'unknown'} does not match pinned provider ${expectedModelProvider ?? 'missing'}`,
    );
  }

  const calls = collaborationCalls.filter((call) => (
    call?.name === 'spawn_agent' || call?.name === 'wait_agent'
  ));
  if (calls.length !== expectedInvocations.length * 2) {
    throw new Error(
      `persisted root session proves ${calls.length} spawn/wait call(s); expected ${expectedInvocations.length * 2}`,
    );
  }
  const children = Object.values(threadRoles).filter(
    (role) => role?.parent_thread_id === rootThreadId,
  );
  if (children.length !== expectedInvocations.length) {
    throw new Error(
      `persisted sessions prove ${children.length} direct child agent(s); expected ${expectedInvocations.length}`,
    );
  }

  const invocations = [];
  const taskNames = new Set();
  for (let index = 0; index < expectedInvocations.length; index += 1) {
    const expected = expectedInvocations[index];
    const spawn = calls[index * 2];
    const wait = calls[(index * 2) + 1];
    if (spawn?.name !== 'spawn_agent' || wait?.name !== 'wait_agent') {
      throw new Error(`persisted root session does not prove sequential spawn/wait pair ${index + 1}`);
    }
    const taskName = spawn.arguments?.task_name;
    if (
      spawn.arguments?.agent_type !== expected.native_id
      || !/^[a-z0-9_]+$/.test(taskName ?? '')
      || taskNames.has(taskName)
      || spawn.arguments?.fork_turns !== 'none'
    ) {
      throw new Error(
        `persisted root session does not invoke exact custom agent role ${expected.native_id}`,
      );
    }
    taskNames.add(taskName);
    const matches = children.filter((role) => (
      role.agent_role === expected.native_id
      && role.agent_path === `/root/${taskName}`
      && role.multi_agent_version === 'v2'
      && role.model === expectedModel
      && role.model_provider === expectedModelProvider
    ));
    if (matches.length !== 1) {
      throw new Error(
        `isolated session metadata does not prove exactly one custom agent role ${expected.native_id}`,
      );
    }
    const roleProof = matches[0];
    let childResult;
    try {
      childResult = JSON.parse(roleProof.final_message);
    } catch {
      throw new Error(
        `persisted child session returned non-JSON discovery evidence for ${expected.native_id}`,
      );
    }
    if (!sameJsonValue(childResult, expected.child_result)) {
      throw new Error(
        `persisted child session returned wrong discovery evidence for ${expected.native_id}`,
      );
    }
    invocations.push({
      native_id: expected.native_id,
      invocation: expected.invocation,
      thread_id: roleProof.thread_id,
      task_name: taskName,
      fork_turns: spawn.arguments.fork_turns,
      observed_agent_role: roleProof.agent_role,
      observed_agent_path: roleProof.agent_path,
      observed_parent_thread_id: roleProof.parent_thread_id,
      observed_cli_version: roleProof.cli_version,
      observed_model: roleProof.model,
      observed_model_provider: roleProof.model_provider,
      observed_multi_agent_version: roleProof.multi_agent_version,
      observed_child_result: childResult,
      session_meta_sha256: roleProof.session_meta_sha256,
      session_metadata: roleProof.session_metadata,
    });
  }
  return {
    raw_event_count: events.length,
    completed_spawn_count: expectedInvocations.length,
    root_thread_id: rootThreadId,
    model,
    model_provider: modelProvider,
    multi_agent_version: multiAgentVersion,
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
  const assignments = identities.map(({ canonical_id, native_id, invocation }) => ({
    canonical_id,
    native_id,
    invocation,
  }));
  return `This is a Grove support-evidence probe, not role work.
For each assignment below, sequentially spawn with agent_type set to the exact
native_id and fork_turns set to "none"; use a unique lowercase task_name, wait
for it, and ask it only to load its installed Grove
role skill/reference and discover its canonical id, source, digest, and
exposure. Require each child to return only one compact JSON object containing
canonical_id, native_id, exposure, source, digest, and invocation. Spawn no
other agents and never run two concurrently. Preserve every
invocation token exactly. Return only one JSON object matching the supplied
schema, with identities in the listed order.

Assignments:
${expectedBlock(assignments)}
`;
}

function separationPrompt({ producer, reviewer }) {
  return `This is a Grove support-evidence probe, not implementation or review.
Sequentially spawn exactly two distinct custom agents with agent_type set to
grove_executor and grove_code_reviewer respectively, fork_turns set to "none",
and unique lowercase task_name values. Wait for each. Ask each only to load its Grove role and
return only compact JSON containing native_id and its assigned invocation
token. Do not let either agent perform role
work. Return only JSON matching the supplied schema:
${JSON.stringify({ separate: true, producer, reviewer }, null, 2)}
`;
}

function scopedPrompt(expected) {
  return `This is a Grove support-evidence probe, not dispatch work.
Spawn with agent_type set exactly to grove_dispatcher, fork_turns set to "none",
and a lowercase task_name, then wait for it. Pass the assigned native_id and
invocation token to the child and require it to preserve both exactly;
the canonical role id is distinct and must not replace native_id. Ask it to
load the installed dispatcher role and discover this spawned custom agent's
selected exposure plus whether that selected exposure itself claims authority
to enact or sequence the full driving-session dispatcher. For
advertised_driving_session, return true only when the spawned adapter claims
that authority; a statement that a separate driving task retains the full
dispatcher is not such a claim. Ask the child to return only one compact JSON
object containing native_id, exposure, advertised_driving_session, and its
assigned invocation token. Return only JSON matching the supplied schema:
${JSON.stringify({
    native_id: expected.native_id,
    invocation: expected.invocation,
  }, null, 2)}
`;
}

function configPrompt(expected) {
  return `This is a Grove support-evidence probe, not implementation work.
Spawn with agent_type set exactly to grove_executor, fork_turns set to "none",
and a lowercase task_name, then wait for it.
Ask it to load its Grove role,
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
  const compositionRoot = join(destination, 'composition-fixture', 'grove');
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
    dirname(compositionRoot),
    join(destination, 'harness', 'probes', 'lib'),
    join(destination, 'harness', 'release', 'lib'),
  ]) {
    await mkdir(path, { recursive: true });
  }

  const packageValidation = await validatePackageTree(packageRoot);
  if (!packageValidation.ok) {
    throw new Error(`candidate package is invalid:\n${packageValidation.errors.join('\n')}`);
  }
  await assemblePackageSnapshot(packageRoot, snapshotRoot, packageValidation);
  const packageTreeSha256 = await packageTreeDigest(snapshotRoot);
  await cp(snapshotRoot, compositionRoot, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  });
  const compositionSurfacesPath = join(compositionRoot, 'metadata', 'surfaces.json');
  const compositionSurfaces = JSON.parse(await readFile(compositionSurfacesPath, 'utf8'));
  const compositionRow = compositionSurfaces.rows.find(
    (row) => row.surface_id === SURFACE_ID,
  );
  if (!compositionRow || compositionRow.release_state !== 'candidate') {
    throw new Error(`${SURFACE_ID} must remain candidate in the exact package before probe composition`);
  }
  compositionRow.release_state = 'supported';
  compositionRow.support_record = 'composition-only-plan-fixture.json';
  delete compositionRow.missing_capability;
  compositionRow.disclosure =
    'Composition-only supported override for isolated plan generation; never installed or used as release evidence.';
  await writeFile(
    compositionSurfacesPath,
    `${JSON.stringify(compositionSurfaces, null, 2)}\n`,
  );
  const compositionTreeSha256 = await packageTreeDigest(compositionRoot);
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

  const lifecycleUrl = pathToFileURL(join(compositionRoot, 'runtime', 'lifecycle', 'lib', 'lifecycle.mjs')).href;
  const { applyPlan, planSetup } = await import(`${lifecycleUrl}?probe=${Date.now()}`);
  const plan = await planSetup({
    packageRoot: compositionRoot,
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

  const inventory = JSON.parse(await readFile(join(packageRoot, 'metadata', 'roles.json'), 'utf8'));
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
    '# Pin the current V2 path so this support record is model/backend-specific and reproducible.\n' +
    'model = "gpt-5.6-sol"\n\n' +
    '[features]\n' +
    'multi_agent_v2 = true\n\n' +
    '[agents]\n' +
    'enabled = true\n' +
    'max_concurrent_threads_per_session = 1\n\n' +
    '# Codex loads project-scoped .codex/agents only for a trusted project.\n' +
    `[projects.${JSON.stringify(await realpath(consumerRoot))}]\n` +
    'trust_level = "trusted"\n',
  );
  const runnerSource = join(repoRoot, 'tooling', 'grove', 'probes', 'bin', 'run-codex-support-probe.mjs');
  const harnessSources = [
    {
      source: runnerSource,
      path: 'run-probe.mjs',
    },
    {
      source: join(repoRoot, 'tooling', 'grove', 'probes', 'lib', 'codex-probe.mjs'),
      path: 'harness/probes/lib/codex-probe.mjs',
    },
    {
      source: join(repoRoot, 'tooling', 'grove', 'release', 'lib', 'release.mjs'),
      path: 'harness/release/lib/release.mjs',
    },
  ];
  for (const file of harnessSources) {
    await cp(file.source, join(destination, file.path));
  }
  const harnessFiles = await Promise.all(harnessSources.map(async (file) => ({
    path: file.path,
    sha256: createHash('sha256').update(await readFile(join(destination, file.path))).digest('hex'),
  })));

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
    model: 'gpt-5.6-sol',
    model_provider: 'openai',
    multi_agent_version: 'v2',
    project_trust: 'explicit isolated consumer',
    paths: {
      marketplace: 'marketplace',
      package_snapshot: 'marketplace/plugins/grove',
      composition_fixture: 'composition-fixture/grove',
      consumer: 'consumer',
      codex_home: 'codex-home',
      sqlite_home: 'codex-sqlite',
      runtime_tmp: 'runtime-tmp',
      logs: 'logs',
      results: 'results',
    },
    composition_fixture: {
      path: 'composition-fixture/grove',
      surface_id: SURFACE_ID,
      release_state_override: 'supported',
      exact_package_tree_sha256: packageTreeSha256,
      fixture_tree_sha256: compositionTreeSha256,
      changed_file: 'metadata/surfaces.json',
      disclosure: 'Composition-only supported override for plan generation; marketplace installation and evidence use the untouched exact candidate snapshot.',
    },
    harness: {
      probe_module: 'harness/probes/lib/codex-probe.mjs',
      release_module: 'harness/release/lib/release.mjs',
      files: harnessFiles,
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
