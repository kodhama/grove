import {
  mkdir,
  lstat,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

const PRESETS = Object.freeze({
  steward: Object.freeze({ intent: 'human', spec: 'agent', build: 'agent', ship: 'human' }),
  guardian: Object.freeze({ intent: 'human', spec: 'human', build: 'agent', ship: 'human' }),
  initiator: Object.freeze({ intent: 'agent', spec: 'agent', build: 'agent', ship: 'human' }),
});
const GATES = Object.freeze(['intent', 'spec', 'build', 'ship']);
const LEGACY_STATUS_PATH = '.claude/skills/grove-status/SKILL.md';
const OWNED_LAUNCHER_MARKER = '# GENERATED — DO NOT EDIT; canonical-source: charters/';
const OPERATION_INPUTS = Object.freeze({
  setup: Object.freeze(['host', 'surface', 'choices']),
  refresh: Object.freeze(['host', 'surface']),
  'set-profile': Object.freeze(['host', 'surface', 'preset']),
  remove: Object.freeze(['host', 'surface', 'selection']),
});

export function describeOperation(operation) {
  const requiredInputs = OPERATION_INPUTS[operation];
  if (!requiredInputs) throw new Error(`unknown operation "${operation}"`);
  return {
    operation,
    required_inputs: [...requiredInputs],
    flow: ['plan', 'disclose', 'confirm-exact-action-ids', 'apply'],
    plan_fields_to_disclose: [
      'summary',
      'skew',
      'inventory',
      'legacy',
      'actions',
      'skipped',
      'refusals',
    ],
    rules: [
      'Use one explicit host-matched surface invocation record; never infer it from the environment.',
      'A failed plan is pre-write and cannot be applied.',
      'Show the exact plan and obtain explicit confirmation of every action id before apply.',
      'Apply revalidates all file preconditions before the first mutation.',
      'Perform no git action and make no landing recommendation.',
    ],
    input_contract: operationInputContract(operation),
    cli: {
      plan: `node <grove-plugin-root>/runtime/lifecycle/bin/grove-operation.mjs plan ${operation} <request.json>`,
      apply: 'node <grove-plugin-root>/runtime/lifecycle/bin/grove-operation.mjs apply <plan.json> <confirmation.json>',
    },
  };
}

function operationInputContract(operation) {
  const shared = {
    repoRoot: 'absolute or working-directory-relative consumer repository path',
    packageRoot: 'optional Grove package root; the CLI resolves its own package when absent',
    host: '"claude" or "codex"',
    surface: {
      surface_id: 'one exact id from the declared surface matrix',
      provenance: '"user-explicit" or "host-runtime"',
      runtime_discriminator: 'required only for a matrix row that declares an exact host-runtime discriminator',
    },
  };
  if (operation === 'setup') {
    return {
      ...shared,
      choices: {
        preset: Object.keys(PRESETS),
        config: 'object keyed by metadata/config-tokens.json; honest absent strings are valid',
        overwritePaths: 'optional exact consumer-authoritative paths separately approved for overwrite',
      },
    };
  }
  if (operation === 'set-profile') {
    return { ...shared, preset: Object.keys(PRESETS) };
  }
  if (operation === 'remove') {
    return {
      ...shared,
      selection: {
        hosts: 'subset of ["claude", "codex"]',
        sharedFloor: 'boolean',
        legacyStatus: 'boolean',
        consumerPaths: 'individually confirmed .grove/config.toml, .grove/gates.toml, or .grove/agents paths',
        legacyMigration: {
          migrateRuntimeDir: 'boolean; separately confirm removal of the exact top-level legacy runtime_dir override',
          restartAcknowledged: 'boolean; required before any proven legacy payload deletion',
          deletePaths: 'exact inventory-proven legacy file or complete-tree paths',
        },
      },
      inventory_first: 'plan once with an empty selection, disclose inventory, then re-plan the selected removals',
    };
  }
  if (operation === 'refresh') {
    return {
      ...shared,
      legacyMigration: {
        migrateRuntimeDir: 'boolean; separately confirm removal of the exact top-level legacy runtime_dir override',
        restartAcknowledged: 'boolean; required before any proven legacy payload deletion',
        deletePaths: 'exact inventory-proven legacy file or complete-tree paths',
      },
    };
  }
  return shared;
}

export async function planSetup(input) {
  const context = await prepare(input, 'setup');
  if (!context.ok) return context.plan;
  const { plan, adapter, choices = {}, repoRoot, packageRoot } = context;
  if (!PRESETS[choices.preset]) {
    return fail(plan, `setup requires one preset: ${Object.keys(PRESETS).join(', ')}`);
  }
  if (choices.config == null || typeof choices.config !== 'object' || Array.isArray(choices.config)) {
    return fail(plan, 'setup requires an explicit config object (an empty object is allowed)');
  }
  let serializedConfig;
  try {
    const tokenConfig = JSON.parse(await readRequired(join(packageRoot, context.config.config_tokens)));
    serializedConfig = serializeConfig(choices.config, tokenConfig);
  } catch (error) {
    return fail(plan, `invalid setup config tokens: ${error.message}`);
  }

  const blockResult = await planManagedBlock(context);
  if (!blockResult.ok) return fail(plan, blockResult.reason);

  await planManagedFloor(context, { mode: 'setup' });
  await planConsumerSeed(
    context,
    '.grove/gates.toml',
    seedPreset(await readRequired(join(packageRoot, 'reference/gates/gates.toml')), choices.preset),
    new Set(choices.overwritePaths ?? []),
  );
  await planConsumerSeed(
    context,
    '.grove/config.toml',
    serializedConfig,
    new Set(choices.overwritePaths ?? []),
  );
  addWriteIfChanged(plan, adapter.instruction_file, blockResult.content);
  if (context.host === 'codex') await planLaunchers(context);

  plan.summary = summary(context, `setup selected ${context.surfaceRow.surface_id} (${context.surface.provenance})`);
  return settlePlan(plan);
}

export async function planRefresh(input) {
  const context = await prepare(input, 'refresh');
  if (!context.ok) return context.plan;
  const { plan, adapter } = context;
  const blockResult = await planManagedBlock(context);
  if (!blockResult.ok) return fail(plan, blockResult.reason);

  await planManagedFloor(context, { mode: 'refresh' });
  addWriteIfChanged(plan, adapter.instruction_file, blockResult.content);
  if (context.host === 'codex') await planLaunchers(context);
  await detectLegacyStatus(context);
  await inspectLegacyState(context);
  await planLegacyMigration(context, input.legacyMigration);
  plan.summary = summary(context, `refresh selected ${context.surfaceRow.surface_id} (${context.surface.provenance})`);
  return settlePlan(plan);
}

export async function planSetProfile(input) {
  const context = await prepare(input, 'set-profile');
  if (!context.ok) return context.plan;
  const { plan, packageRoot, preset } = context;
  if (!PRESETS[preset]) {
    return fail(plan, `unknown preset "${preset}" — known presets: ${Object.keys(PRESETS).join(', ')}`);
  }
  if (!(await repoPathExists(context, '.grove'))) {
    return fail(plan, `Grove is not composed here; run ${context.adapter.setup_command} first`);
  }

  const original = await readRepoOptional(context, '.grove/gates.toml')
    ?? await readRequired(join(packageRoot, 'reference/gates/gates.toml'));
  let parsed;
  try {
    parsed = parseProfile(original);
  } catch (error) {
    return fail(plan, `cannot switch an unreadable gates.toml: ${error.message}`);
  }
  const next = seedPreset(original, preset);
  const verified = parseProfile(next);
  if (!verified.floor) return fail(plan, 'generated preset violates the Grove human intent floor');
  plan.changes = GATES
    .filter((gate) => parsed.gates[gate] !== PRESETS[preset][gate])
    .map((gate) => ({ gate, from: parsed.gates[gate] ?? null, to: PRESETS[preset][gate] }));
  addWriteIfChanged(plan, '.grove/gates.toml', next, { confirmationRequired: true });
  plan.summary = summary(
    context,
    `set-profile selected ${context.surfaceRow.surface_id} (${context.surface.provenance}); ` +
      `${preset} changes: ${plan.changes.map((c) => `${c.gate} ${c.from} -> ${c.to}`).join(', ') || 'none'}`,
  );
  return settlePlan(plan);
}

export async function planRemove(input) {
  const context = await prepare(input, 'remove');
  if (!context.ok) return context.plan;
  const { plan, adapters, selection = {} } = context;
  const selectedHosts = new Set(selection.hosts ?? []);
  const surfacePresence = new Map();
  const failedSelectedHosts = new Set();
  const gatesMigrationConflict =
    selection.legacyMigration?.migrateRuntimeDir === true
    && (selection.consumerPaths ?? []).includes('.grove/gates.toml');
  if (gatesMigrationConflict) {
    refuse(
      plan,
      '.grove/gates.toml',
      'conflicting Remove selection would rewrite and delete the same gates.toml',
    );
  }
  await inspectLegacyState(context);
  await planLegacyMigration(
    context,
    gatesMigrationConflict
      ? { ...selection.legacyMigration, migrateRuntimeDir: false }
      : selection.legacyMigration,
  );

  for (const [host, adapter] of Object.entries(adapters)) {
    const text = await readRepoOptional(context, adapter.instruction_file);
    const block = text == null ? { present: false } : inspectBlock(text, adapter);
    const launchers = host === 'codex' ? await launcherStates(context) : [];
    const present = block.present || launchers.some((item) => item.owned);
    surfacePresence.set(host, present);
    if (block.present) {
      plan.inventory.push({
        path: adapter.instruction_file,
        kind: 'managed-block',
        host,
        owned: block.valid,
      });
    }
    for (const launcher of launchers) {
      if (launcher.exists) {
        plan.inventory.push({
          path: launcher.path,
          kind: 'launcher',
          host,
          owned: launcher.owned,
        });
      }
    }

    if (!selectedHosts.has(host)) continue;
    if (text != null && block.present) {
      if (!block.valid) {
        refuse(plan, adapter.instruction_file, `malformed Grove managed block: ${block.reason}`);
        failedSelectedHosts.add(host);
      } else {
        const stripped = stripManagedBlock(text, block);
        if (stripped.trim() === '') {
          addAction(plan, {
            type: 'delete',
            path: adapter.instruction_file,
            expected: { kind: 'file', content: text },
            confirmationRequired: true,
          });
        } else {
          addWriteIfChanged(plan, adapter.instruction_file, stripped, { confirmationRequired: true });
        }
      }
    }
    if (host === 'codex') {
      for (const launcher of launchers) {
        if (launcher.owned) {
          addAction(plan, {
            type: 'delete',
            path: launcher.path,
            expected: { kind: 'file', content: launcher.existingText },
            confirmationRequired: true,
          });
        } else if (launcher.exists) {
          refuse(plan, launcher.path, 'consumer-authored launcher collision is not Grove-owned');
        }
      }
    }
  }

  const retainedHosts = [...surfacePresence]
    .filter(([host, present]) => present && (!selectedHosts.has(host) || failedSelectedHosts.has(host)))
    .map(([host]) => host);
  for (const path of [
    '.grove/README.md',
    '.grove/gates.toml',
    '.grove/config.toml',
    '.grove/agents',
  ]) {
    if (await repoPathExists(context, path)) {
      plan.inventory.push({
        path,
        kind: isConsumerFloorPath(path) ? 'consumer-floor' : 'managed-floor',
        owned: !isConsumerFloorPath(path),
      });
    }
  }
  if (selection.sharedFloor) {
    if (retainedHosts.length > 0) {
      refuse(plan, '.grove/', `shared floor retained because host adapter(s) remain: ${retainedHosts.join(', ')}`);
    } else {
      for (const path of [
        '.grove/README.md',
      ]) {
        if (await repoPathExists(context, path)) {
          const target = await safeRepoTarget(context.repoRoot, path);
          addAction(plan, {
            type: 'delete',
            path,
            expected: { kind: 'file', content: await readRequired(target) },
            confirmationRequired: true,
          });
        }
      }
    }
  }

  for (const path of selection.consumerPaths ?? []) {
    if (gatesMigrationConflict && path === '.grove/gates.toml') continue;
    if (!isConsumerFloorPath(path)) {
      refuse(plan, path, 'not a declared consumer-authoritative Grove path');
    } else {
      const target = await safeRepoTarget(context.repoRoot, path);
      if (!(await pathExists(target))) continue;
      const directory = (await stat(target)).isDirectory();
      addAction(plan, {
        type: directory ? 'delete-tree' : 'delete',
        path,
        expected: directory
          ? { kind: 'tree', entries: await snapshotTree(target) }
          : { kind: 'file', content: await readRequired(target) },
        confirmationRequired: true,
      });
    }
  }

  await detectLegacyStatus(context);
  if (selection.legacyStatus) {
    const legacy = plan.legacy.find((item) => item.path === LEGACY_STATUS_PATH);
    if (legacy?.owned) {
      addAction(plan, {
        type: 'delete',
        path: LEGACY_STATUS_PATH,
        expected: {
          kind: 'file',
          content: await readRepoRequired(context, LEGACY_STATUS_PATH),
        },
        confirmationRequired: true,
      });
    } else if (legacy) {
      refuse(plan, LEGACY_STATUS_PATH, 'legacy path exists but Grove ownership could not be confirmed');
    }
  }
  plan.summary = summary(
    context,
    `remove inventory selected ${context.surfaceRow.surface_id} (${context.surface.provenance}); ` +
      'repository removal does not uninstall a host plugin or change Wisp',
  );
  return settlePlan(plan);
}

export async function applyPlan(plan, { confirmedActionIds = [] } = {}) {
  if (!plan?.ok) throw new Error('cannot apply a failed lifecycle plan');
  const confirmed = new Set(confirmedActionIds);
  const missing = plan.actions
    .filter((action) => !confirmed.has(action.id))
    .map((action) => action.id);
  if (missing.length > 0) {
    throw new Error(`explicit confirmation required for action(s): ${missing.join(', ')}`);
  }

  // Preflight the complete plan before the first mutation. A consumer edit or
  // newly-created collision after planning invalidates the whole plan.
  for (const action of plan.actions) {
    const target = safeTarget(plan.repoRoot, action.path);
    await assertNoSymlinkComponents(plan.repoRoot, target, action.path);
    if (action.expected?.kind === 'file') {
      const current = await readOptional(target);
      if (current !== action.expected.content) {
        throw new Error(`${action.path} changed after planning; no lifecycle write was applied`);
      }
    } else if (action.expected?.kind === 'tree') {
      const current = await snapshotTree(target);
      if (JSON.stringify(current) !== JSON.stringify(action.expected.entries)) {
        throw new Error(`${action.path} changed after planning; no lifecycle write was applied`);
      }
    }
  }

  const applied = [];
  for (const action of plan.actions) {
    const target = safeTarget(plan.repoRoot, action.path);
    if (action.type === 'write') {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, action.content);
    } else if (action.type === 'delete') {
      await rm(target, { force: true });
    } else if (action.type === 'delete-tree') {
      await rm(target, { force: true, recursive: true });
    } else {
      throw new Error(`unknown lifecycle action type: ${action.type}`);
    }
    applied.push({ id: action.id, type: action.type, path: action.path });
  }
  return { applied, skipped: plan.skipped, refusals: plan.refusals };
}

export async function resolveGateRuntime({ packageRoot, repoRoot, gatesText }) {
  const root = resolve(repoRoot);
  let sectionSeen = false;
  let declared = null;
  for (const raw of String(gatesText ?? '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    if (/^\[/.test(line)) sectionSeen = true;
    if (!sectionSeen && line.startsWith('runtime_dir')) {
      const match = line.match(/^runtime_dir\s*=\s*"([^"]+)"$/);
      if (!match) throw new Error('runtime_dir must be one non-empty quoted path');
      if (declared != null) throw new Error('runtime_dir must be declared at most once');
      declared = match[1];
    }
  }
  const runtimeRoot = declared == null
    ? resolve(packageRoot, 'runtime/gates')
    : resolve(root, declared);
  const source = declared == null ? 'installed-package-default' : 'declared-runtime-dir';
  const normalizedLegacy = declared == null
    ? false
    : normalizeSlashes(relative(root, runtimeRoot)) === '.grove/internal/gates';
  const executable = join(runtimeRoot, 'bin', 'resolve-profile.mjs');
  let details;
  try {
    details = await lstat(executable);
  } catch (error) {
    throw new Error(`${source} gate runtime is unavailable at ${executable}: ${error.message}`);
  }
  if (!details.isFile() || details.isSymbolicLink()) {
    throw new Error(`${source} gate runtime is not a regular executable file: ${executable}`);
  }
  return {
    runtimeRoot,
    executable,
    source,
    legacy: normalizedLegacy,
  };
}

async function prepare(input, operation) {
  const repoRoot = resolve(input.repoRoot);
  const packageRoot = resolve(input.packageRoot);
  const config = await loadHostConfig(packageRoot);
  const plan = newPlan(repoRoot, operation);
  const host = input.host;
  const adapter = config.hosts?.[host];
  if (!adapter) return { ok: false, plan: fail(plan, `unknown host "${host}"`) };

  let matrix;
  try {
    matrix = JSON.parse(await readRequired(join(packageRoot, config.surface_matrix)));
  } catch (error) {
    return { ok: false, plan: fail(plan, `cannot load declared surface matrix: ${error.message}`) };
  }
  const validation = validateSurface({ host, surface: input.surface, matrix, operation });
  if (!validation.ok) {
    return { ok: false, plan: fail(plan, `${validation.reason}; valid ${host} surface ids: ${validation.valid.join(', ')}`) };
  }
  const installedVersion = (await readRequired(join(packageRoot, config.version))).trim();
  const context = {
    ...input,
    ok: true,
    operation,
    repoRoot,
    packageRoot,
    config,
    adapters: config.hosts,
    adapter,
    host,
    surface: input.surface,
    surfaceRow: validation.row,
    installedVersion,
    unsupportedDisclosure: validation.unsupportedDisclosure ?? null,
    plan,
  };
  if (operation !== 'remove') {
    const malformed = await malformedCarrier(context);
    if (malformed) {
      return { ok: false, plan: fail(plan, malformed) };
    }
  }
  context.skew = await inspectSkew(context);
  plan.skew = context.skew;
  return context;
}

async function malformedCarrier(context) {
  for (const adapter of Object.values(context.adapters)) {
    const text = await readRepoOptional(context, adapter.instruction_file);
    if (text == null) continue;
    const block = inspectBlock(text, adapter);
    if (block.present && !block.valid) {
      return `${adapter.instruction_file}: malformed Grove carrier: ${block.reason}`;
    }
  }
  return null;
}

function validateSurface({ host, surface, matrix, operation }) {
  const rows = Array.isArray(matrix?.rows) ? matrix.rows : [];
  const valid = rows.filter((row) => row.host === host).map((row) => row.surface_id).sort();
  if (!surface || typeof surface !== 'object') return { ok: false, reason: 'surface invocation record is absent', valid };
  if (!['user-explicit', 'host-runtime'].includes(surface.provenance)) {
    return { ok: false, reason: 'surface invocation provenance is absent or unknown', valid };
  }
  const row = rows.find((item) => item.surface_id === surface.surface_id);
  if (!row) return { ok: false, reason: `unknown surface id "${surface.surface_id}"`, valid };
  if (row.host !== host) return { ok: false, reason: `surface "${surface.surface_id}" belongs to ${row.host}, not ${host}`, valid };
  if (surface.provenance === 'host-runtime') {
    if (!row.runtime_discriminator || surface.runtime_discriminator !== row.runtime_discriminator) {
      return { ok: false, reason: 'contradictory host-runtime provenance or discriminator', valid };
    }
  } else if (surface.runtime_discriminator != null) {
    return { ok: false, reason: 'user-explicit provenance contradicts a runtime discriminator', valid };
  }
  if (row.release_state !== 'supported') {
    const disclosure = `${row.disclosure ?? `${row.release_state} surface "${row.surface_id}" is not write-authorized`}` +
      `${row.missing_capability ? ` Missing capability: ${row.missing_capability}.` : ''}`;
    if (operation === 'remove') {
      return { ok: true, row, valid, unsupportedDisclosure: disclosure };
    }
    return {
      ok: false,
      reason: disclosure,
      valid,
    };
  }
  if (
    host === 'codex'
    && operation !== 'set-profile'
    && operation !== 'remove'
    && row.bridge_state !== 'bridge-viable'
  ) {
    return { ok: false, reason: `Codex surface "${row.surface_id}" is not bridge-viable`, valid };
  }
  return { ok: true, row, valid };
}

async function loadHostConfig(packageRoot) {
  const path = join(packageRoot, 'metadata/hosts.json');
  const text = await readOptional(path);
  if (text != null) return JSON.parse(text);
  return {
    surface_matrix: 'metadata/surfaces.json',
    version: 'VERSION',
    config_tokens: 'metadata/config-tokens.json',
    codex_launchers: 'metadata/codex-launchers.json',
    legacy_ownership: 'metadata/legacy-ownership.json',
    hosts: {
      claude: {
        instruction_file: 'CLAUDE.md',
        begin_marker: '<!-- grove:begin (managed by grove — dials live in .grove/, not this block) -->',
        end_marker: '<!-- grove:end -->',
        setup_command: '/grove:setup',
        inventory: 'metadata/claude-inventory.json',
      },
      codex: {
        instruction_file: 'AGENTS.md',
        begin_marker: '<!-- grove:begin (managed by grove — dials live in .grove/, not this block) -->',
        end_marker: '<!-- grove:end -->',
        setup_command: 'grove setup',
        launcher_root: '.codex/agents',
        inventory: 'metadata/codex-inventory.json',
      },
    },
  };
}

async function planManagedFloor(context) {
  addWriteIfChanged(
    context.plan,
    '.grove/README.md',
    floorReadme(context.installedVersion),
  );
}

async function planConsumerSeed(context, path, content, overwritePaths) {
  const existing = await readRepoOptional(context, path);
  if (existing == null) {
    addAction(context.plan, {
      type: 'write',
      path,
      content,
      expected: { kind: 'file', content: null },
      confirmationRequired: true,
    });
  } else if (overwritePaths.has(path)) {
    addWriteIfChanged(context.plan, path, content, { confirmationRequired: true });
  } else {
    skip(context.plan, path, 'consumer-authoritative file already exists');
  }
}

async function planManagedBlock(context) {
  const { adapter, installedVersion } = context;
  const existing = await readRepoOptional(context, adapter.instruction_file);
  let loaders;
  try {
    loaders = await loadDrivingLoaders(context);
  } catch (error) {
    return { ok: false, reason: error.message };
  }
  const block = managedBlock(context.host, adapter, installedVersion, loaders);
  if (existing == null) return { ok: true, content: block };
  const inspection = inspectBlock(existing, adapter);
  if (!inspection.present) {
    const separator = existing === '' || existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
    return { ok: true, content: existing + separator + block };
  }
  if (!inspection.valid) return { ok: false, reason: `${adapter.instruction_file}: ${inspection.reason}` };
  return {
    ok: true,
    content: existing.slice(0, inspection.start) + block + existing.slice(inspection.end),
  };
}

async function loadDrivingLoaders(context) {
  const inventoryPath = context.adapter.inventory;
  if (typeof inventoryPath !== 'string' || inventoryPath === '') {
    throw new Error(`${context.host} adapter has no declared host inventory`);
  }
  let inventory;
  try {
    inventory = JSON.parse(await readRequired(join(context.packageRoot, inventoryPath)));
  } catch (error) {
    throw new Error(`cannot load ${context.host} driving-loader inventory: ${error.message}`);
  }
  if (
    inventory?.schema_version !== 1
    || inventory.host !== context.host
    || typeof inventory.driving_loaders !== 'object'
  ) {
    throw new Error(`${inventoryPath} has an invalid driving-loader envelope`);
  }
  const field = context.host === 'claude' ? 'raw_reference' : 'raw_skill_id';
  const dispatcher = inventory.driving_loaders?.dispatcher?.[field];
  const shaper = inventory.driving_loaders?.shaper?.[field];
  if (
    typeof dispatcher !== 'string'
    || dispatcher === ''
    || typeof shaper !== 'string'
    || shaper === ''
  ) {
    throw new Error(`${inventoryPath} must declare exact dispatcher and shaper ${field} values`);
  }
  return { dispatcher, shaper };
}

function managedBlock(host, adapter, version, loaders) {
  const hostLoader = host === 'claude'
    ? [
      `Load the complete driving-session dispatcher from \`${loaders.dispatcher}\` in this current task.`,
      `Load the complete interactive shaper from \`${loaders.shaper}\` in this current task.`,
      'Do not delegate or spawn either driving-session role. A native dispatcher remains only the scoped advisor.',
    ]
    : [
      `Invoke the exact installed skill \`${loaders.dispatcher}\` in this current task for the complete driving-session dispatcher.`,
      `Invoke the exact installed skill \`${loaders.shaper}\` in this current task for the complete interactive shaper.`,
      'Do not delegate or spawn either driving-session role. A generated dispatcher project launcher selects only scoped-advisor.',
    ];
  return `${adapter.begin_marker}
${hostLoader.join('\n')}
At every handover, an absent \`runtime_dir\` resolves \`runtime/gates/\` relative to the active installed Grove package. A declared non-legacy runtime is exact authority and is never searched or replaced.
grove plugin@${version}
${adapter.end_marker}
`;
}

function inspectBlock(text, adapter) {
  const begins = exactLineIndices(text, adapter.begin_marker);
  const ends = exactLineIndices(text, adapter.end_marker);
  if (begins.length === 0 && ends.length === 0) return { present: false, valid: true };
  if (begins.length !== 1 || ends.length !== 1) {
    return { present: true, valid: false, reason: `expected exactly one Grove marker pair, found ${begins.length}/${ends.length}` };
  }
  const start = text.lastIndexOf('\n', begins[0] - 1) + 1;
  const endMarkerEnd = ends[0] + adapter.end_marker.length;
  let end = endMarkerEnd;
  if (text.slice(end, end + 2) === '\r\n') end += 2;
  else if (text[end] === '\n') end += 1;
  if (ends[0] < begins[0]) return { present: true, valid: false, reason: 'end marker precedes begin marker' };
  const body = text.slice(begins[0], endMarkerEnd);
  const stampLines = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith('grove plugin@'));
  if (stampLines.length !== 1) {
    return {
      present: true,
      valid: false,
      reason: `expected exactly one repository stamp line, found ${stampLines.length}`,
    };
  }
  if (!/^grove plugin@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(stampLines[0])) {
    return { present: true, valid: false, reason: 'repository stamp line is schema-invalid' };
  }
  return { present: true, valid: true, start, end, stamp: stampLines[0].slice('grove plugin@'.length) };
}

function stripManagedBlock(text, block) {
  let start = block.start;
  if (start >= 1 && text[start - 1] === '\n') {
    const precedingLineStart = text.lastIndexOf('\n', start - 2) + 1;
    if (text.slice(precedingLineStart, start).trim() === '') start = precedingLineStart;
  }
  return text.slice(0, start) + text.slice(block.end);
}

async function planLaunchers(context) {
  for (const launcher of await launcherStates(context)) {
    if (!launcher.declared && launcher.owned) {
      addAction(context.plan, {
        type: 'delete',
        path: launcher.path,
        expected: { kind: 'file', content: launcher.existingText },
      });
      continue;
    }
    if (!launcher.exists || launcher.owned) {
      addWriteIfChanged(context.plan, launcher.path, launcher.content);
    } else {
      refuse(context.plan, launcher.path, 'consumer-authored launcher collision; Grove ownership marker absent');
    }
  }
}

async function launcherStates(context) {
  const codexAdapter = context.adapters.codex;
  const bundlePath = join(context.packageRoot, context.config.codex_launchers);
  const bundle = JSON.parse(await readRequired(bundlePath));
  if (!bundle.generated || !Array.isArray(bundle.launchers)) {
    throw new Error(`invalid generated launcher bundle at ${context.config.codex_launchers}`);
  }
  const states = [];
  const declaredPaths = new Set();
  for (const launcher of bundle.launchers) {
    const path = normalizeSlashes(launcher.output);
    if (!path.startsWith(`${codexAdapter.launcher_root}/`) || path.includes('..') || !launcher.content.startsWith(OWNED_LAUNCHER_MARKER)) {
      throw new Error(`unsafe or unowned generated launcher entry: ${JSON.stringify(path)}`);
    }
    declaredPaths.add(path);
    const existing = await readRepoOptional(context, path);
    states.push({
      path,
      content: launcher.content,
      declared: true,
      exists: existing != null,
      owned: existing?.startsWith(OWNED_LAUNCHER_MARKER) ?? false,
      existingText: existing,
    });
  }
  const launcherRoot = await safeRepoTarget(context.repoRoot, codexAdapter.launcher_root);
  if (await pathExists(launcherRoot)) {
    for (const entry of await readdir(launcherRoot, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.toml')) continue;
      const path = normalizeSlashes(join(codexAdapter.launcher_root, entry.name));
      if (declaredPaths.has(path)) continue;
      const existing = await readRepoRequired(context, path);
      if (existing.startsWith(OWNED_LAUNCHER_MARKER)) {
        states.push({
          path,
          content: null,
          declared: false,
          exists: true,
          owned: true,
          existingText: existing,
        });
      }
    }
  }
  states.sort((a, b) => a.path.localeCompare(b.path));
  return states;
}

async function detectLegacyStatus(context) {
  const text = await readRepoOptional(context, LEGACY_STATUS_PATH);
  if (text == null) return;
  context.plan.legacy.push({
    path: LEGACY_STATUS_PATH,
    owned: /^---[^\n]*\n[\s\S]*?^name:\s*grove-status\s*$/m.test(text) || text.includes('managed by grove'),
    reason: 'pre-adr-0032 Grove status adapter; removable legacy state, never refreshed',
  });
  context.plan.inventory.push({
    path: LEGACY_STATUS_PATH,
    kind: 'legacy-status',
    owned: context.plan.legacy.at(-1).owned,
  });
}

async function inspectLegacyState(context) {
  const inventoryPath = context.config.legacy_ownership ?? 'metadata/legacy-ownership.json';
  let inventoryText = null;
  try {
    inventoryText = await readOptional(join(context.packageRoot, inventoryPath));
  } catch {
    inventoryText = null;
  }
  let inventory = null;
  let inventoryError = null;
  if (inventoryText != null) {
    try {
      inventory = JSON.parse(inventoryText);
      inventoryError = validateLegacyInventoryShape(inventory);
    } catch (error) {
      inventoryError = `invalid JSON: ${error.message}`;
    }
  }
  const inventoryValid = inventoryText != null && inventoryError == null;
  context.legacyOwnershipValid = inventoryValid;
  if (inventoryError != null) {
    refuse(context.plan, '.grove/internal/', `legacy ownership inventory is invalid: ${inventoryError}`);
  }
  const declared = new Map();
  const treeRecords = [];
  if (inventoryValid) {
    for (const record of inventory.records) {
      if (record.candidate_kind === 'regular-file' && typeof record.sha256 === 'string') {
        const records = declared.get(record.candidate_path) ?? [];
        records.push({ grove_version: record.grove_version, sha256: record.sha256 });
        declared.set(record.candidate_path, records);
      } else if (record.candidate_kind === 'tree' && Array.isArray(record.leaves)) {
        const normalizedLeaves = record.leaves.map((leaf) => {
          const candidatePath = `${record.candidate_path}/${leaf.relative_path}`;
          const records = declared.get(candidatePath) ?? [];
          records.push({ grove_version: record.grove_version, sha256: leaf.sha256 });
          declared.set(candidatePath, records);
          return { candidatePath, sha256: leaf.sha256 };
        });
        treeRecords.push({
          grove_version: record.grove_version,
          candidate_path: record.candidate_path,
          leaves: normalizedLeaves,
        });
      }
    }
  }

  const internalRoot = safeTarget(context.repoRoot, '.grove/internal');
  const entries = await walkNoFollow(internalRoot);
  const observed = new Map();
  for (const entry of entries) {
    const candidatePath = normalizeSlashes(join('.grove/internal', entry.relative));
    let digest = null;
    let owned = false;
    let matchingVersions = [];
    if (entry.kind === 'file') {
      const bytes = await readFile(entry.absolute);
      digest = createHash('sha256').update(bytes).digest('hex');
      matchingVersions = (declared.get(candidatePath) ?? [])
        .filter((record) => record.sha256 === digest)
        .map((record) => record.grove_version);
      owned = matchingVersions.length > 0;
    }
    observed.set(candidatePath, { kind: entry.kind, digest });
    context.plan.legacy.push({
      path: candidatePath,
      kind: entry.kind,
      owned,
      sha256: digest,
      matching_versions: matchingVersions,
      reason: owned
        ? 'exact schema-v1 legacy ownership match'
        : 'unexpected or unprovable legacy state; preserved',
    });
  }
  for (const record of treeRecords) {
    const expectedPaths = new Set(record.leaves.map((leaf) => leaf.candidatePath));
    const actualPaths = [...observed.keys()]
      .filter((path) => path.startsWith(`${record.candidate_path}/`));
    const complete = actualPaths.length === expectedPaths.size
      && actualPaths.every((path) => expectedPaths.has(path))
      && record.leaves.every((leaf) => {
        const value = observed.get(leaf.candidatePath);
        return value?.kind === 'file' && value.digest === leaf.sha256;
      });
    context.plan.legacy.push({
      path: record.candidate_path,
      kind: 'tree',
      owned: complete,
      matching_versions: complete ? [record.grove_version] : [],
      reason: complete
        ? 'complete schema-v1 legacy tree match'
        : 'legacy tree has missing, changed, mixed, or unexpected leaves; preserved',
    });
  }
}

function validateLegacyInventoryShape(inventory) {
  if (
    inventory?.schema_version !== 1
    || !Array.isArray(inventory.records)
    || inventory.records.length === 0
  ) {
    return 'schema_version 1 and a non-empty records array are required';
  }
  const composite = new Set();
  const byVersion = new Map();
  for (const record of inventory.records) {
    if (!/^\d+\.\d+\.\d+$/.test(record?.grove_version ?? '')) {
      return 'every grove_version must be strict semver';
    }
    const key = `${record.grove_version}\0${record.candidate_path}`;
    if (composite.has(key)) return `duplicate composite key ${record.grove_version}/${record.candidate_path}`;
    composite.add(key);
    const paths = byVersion.get(record.grove_version) ?? new Set();
    paths.add(record.candidate_path);
    byVersion.set(record.grove_version, paths);
    if (record.candidate_path === '.grove/internal/enforcement.toml') {
      if (record.candidate_kind !== 'regular-file' || !/^[0-9a-f]{64}$/.test(record.sha256 ?? '')) {
        return `${record.grove_version} enforcement record is malformed`;
      }
      continue;
    }
    if (record.candidate_path !== '.grove/internal/gates') {
      return `unexpected candidate path ${String(record.candidate_path)}`;
    }
    if (record.candidate_kind !== 'tree' || !Array.isArray(record.leaves) || record.leaves.length === 0) {
      return `${record.grove_version} gates record is not a non-empty tree`;
    }
    const leafPaths = new Set();
    for (const leaf of record.leaves) {
      const segments = typeof leaf?.relative_path === 'string'
        ? leaf.relative_path.split('/')
        : [];
      if (
        leaf?.kind !== 'regular-file'
        || segments.length === 0
        || segments.some((segment) => segment === '' || segment === '.' || segment === '..')
        || leaf.relative_path.startsWith('/')
        || leaf.relative_path.includes('\\')
        || leafPaths.has(leaf.relative_path)
        || !/^[0-9a-f]{64}$/.test(leaf.sha256 ?? '')
      ) {
        return `${record.grove_version} gates record has a malformed or duplicate leaf`;
      }
      leafPaths.add(leaf.relative_path);
    }
  }
  for (const [version, paths] of byVersion) {
    for (const required of ['.grove/internal/enforcement.toml', '.grove/internal/gates']) {
      if (!paths.has(required)) return `${version} inventory omits ${required}`;
    }
  }
  return null;
}

async function planLegacyMigration(context, request = null) {
  const migration = request ?? {
    migrateRuntimeDir: false,
    restartAcknowledged: false,
    deletePaths: [],
  };
  if (
    typeof migration.migrateRuntimeDir !== 'boolean'
    || typeof migration.restartAcknowledged !== 'boolean'
    || !Array.isArray(migration.deletePaths)
    || migration.deletePaths.some((path) => typeof path !== 'string')
  ) {
    refuse(context.plan, '.grove/internal/', 'legacyMigration has an invalid shape');
    return;
  }

  const gatesPath = '.grove/gates.toml';
  const gatesText = await readRepoOptional(context, gatesPath);
  let legacyOverride = false;
  let migratedGates = null;
  if (gatesText != null) {
    const parsed = topLevelRuntimeDir(gatesText);
    if (parsed.error) {
      refuse(context.plan, gatesPath, parsed.error);
      return;
    } else if (parsed.value != null) {
      const target = resolve(context.repoRoot, parsed.value);
      legacyOverride =
        normalizeSlashes(relative(context.repoRoot, target)) === '.grove/internal/gates';
      if (migration.migrateRuntimeDir) {
        if (!legacyOverride) {
          refuse(context.plan, gatesPath, 'runtime_dir is not the exact legacy .grove/internal/gates target');
        } else {
          migratedGates = parsed.withoutLine;
          addWriteIfChanged(context.plan, gatesPath, migratedGates, {
            confirmationRequired: true,
          });
        }
      }
    } else if (migration.migrateRuntimeDir) {
      refuse(context.plan, gatesPath, 'no legacy runtime_dir override exists to migrate');
    }
  } else if (migration.migrateRuntimeDir) {
    refuse(context.plan, gatesPath, 'no gates.toml exists to migrate');
  }

  const requested = [...new Set(migration.deletePaths)];
  if (requested.length === 0) return;
  if (!migration.restartAcknowledged) {
    for (const path of requested) {
      refuse(context.plan, path, 'restart acknowledgement is required before legacy deletion');
    }
    return;
  }
  if (legacyOverride && !migration.migrateRuntimeDir) {
    for (const path of requested) {
      refuse(context.plan, path, 'migrate the legacy runtime_dir override before deleting its target');
    }
    return;
  }

  for (const path of requested) {
    const proof = context.plan.legacy.find((item) => item.path === path && item.owned);
    if (!proof) {
      refuse(context.plan, path, 'legacy path is unexpected or ownership-unproven');
      continue;
    }
    const target = await safeRepoTarget(context.repoRoot, path);
    if (proof.kind === 'tree') {
      addAction(context.plan, {
        type: 'delete-tree',
        path,
        expected: { kind: 'tree', entries: await snapshotTree(target) },
        confirmationRequired: true,
      });
    } else if (proof.kind === 'file') {
      addAction(context.plan, {
        type: 'delete',
        path,
        expected: { kind: 'file', content: await readRequired(target) },
        confirmationRequired: true,
      });
    } else {
      refuse(context.plan, path, `legacy ${proof.kind} is never deletion-proven`);
    }
  }
}

function topLevelRuntimeDir(text) {
  const lines = text.split(/\r?\n/);
  let sectionSeen = false;
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/#.*$/, '').trim();
    if (!line) continue;
    if (/^\[/.test(line)) sectionSeen = true;
    if (!sectionSeen && /^runtime_dir\s*=/.test(line)) {
      const parsed = line.match(/^runtime_dir\s*=\s*"([^"]+)"$/);
      if (!parsed) return { error: 'top-level runtime_dir is malformed' };
      matches.push({ index, value: parsed[1] });
    }
  }
  if (matches.length > 1) return { error: 'top-level runtime_dir is duplicated' };
  if (matches.length === 0) return { value: null, withoutLine: text };
  lines.splice(matches[0].index, 1);
  return {
    value: matches[0].value,
    withoutLine: lines.join('\n'),
  };
}

async function inspectSkew(context) {
  const reports = [];
  for (const [host, adapter] of Object.entries(context.adapters)) {
    const text = await readRepoOptional(context, adapter.instruction_file);
    if (text == null) continue;
    const block = inspectBlock(text, adapter);
    if (!block.present || !block.valid) continue;
    const stamp = block.stamp;
    if (!stamp) continue;
    const comparison = compareSemver(context.installedVersion, stamp);
    reports.push({
      host,
      carrierPath: adapter.instruction_file,
      repositoryVersion: stamp,
      installedVersion: context.installedVersion,
      direction: comparison === 0
        ? 'match'
        : comparison > 0
          ? 'installation-ahead'
          : comparison < 0
            ? 'installation-behind'
            : 'unknown',
    });
  }
  return reports;
}

function summary(context, main) {
  const notices = [];
  if (context.unsupportedDisclosure) notices.push(context.unsupportedDisclosure);
  const mismatches = context.skew.filter((item) => item.direction !== 'match');
  if (mismatches.length === 0) return notices.length ? `${notices.join(' ')} ${main}` : main;
  const skew = mismatches
    .map((item) => `${item.host}: repository ${item.repositoryVersion}, installed ${item.installedVersion} (${item.direction.replace('-', ' ')})`)
    .join('; ');
  notices.push(skew);
  return `${notices.join(' ')}. ${main}`;
}

function floorReadme(version) {
  return `# Grove repository dials

> Grove-managed; regenerated by refresh. Consumer-authoritative files are never overwritten.

- \`gates.toml\`: who must ratify each gate; switch presets through the shared set-profile operation.
- \`config.toml\`: shared role tokens, treated as verified priors.
- \`agents/<role>.md\`: optional consumer-authored role addenda.
The gate runtime and fixed enforcement data remain in the active installed
Grove package. This consumer floor never contains executable machinery.

The operating model ships in the Grove plugin, \`plugin@${version}\`.
`;
}

function seedPreset(text, preset) {
  const rows = PRESETS[preset];
  if (!rows) throw new Error(`unknown preset: ${preset}`);
  const lines = text.split('\n');
  let section = '';
  let seeded = false;
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const sectionMatch = lines[i].trim().match(/^\[([A-Za-z0-9_]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    if (section === '' && /^\s*seeded_from\s*=/.test(lines[i])) {
      lines[i] = `seeded_from = "${preset}"`;
      seeded = true;
    }
    if (section === 'gates') {
      const match = lines[i].match(/^\s*(intent|spec|build|ship)\s*=/);
      if (match) {
        lines[i] = `${match[1]} = "${rows[match[1]]}"`;
        seen.add(match[1]);
      }
    }
  }
  if (!seeded || seen.size !== GATES.length) {
    throw new Error('gates template/profile must contain seeded_from and exactly four gate rows');
  }
  return lines.join('\n');
}

function parseProfile(text) {
  const result = { gates: {} };
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const header = line.match(/^\[([A-Za-z0-9_]+)\]$/);
    if (header) {
      section = header[1];
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_]+)\s*=\s*"([^"]*)"$/);
    if (section === 'gates') {
      const key = line.match(/^([A-Za-z0-9_]+)\s*=/)?.[1];
      if (key && !GATES.includes(key)) throw new Error(`unknown gate row ${key}`);
      if (!kv) throw new Error(`invalid gate row ${line}`);
      if (result.gates[kv[1]] != null) throw new Error(`duplicate gate row ${kv[1]}`);
      result.gates[kv[1]] = kv[2];
    }
  }
  for (const gate of GATES) {
    if (!['human', 'agent'].includes(result.gates[gate])) throw new Error(`missing or invalid gate row ${gate}`);
  }
  result.floor = result.gates.intent === 'human' || result.gates.ship === 'human';
  return result;
}

function serializeConfig(config, tokenConfig) {
  if (
    tokenConfig?.schema_version !== 1
    || !Array.isArray(tokenConfig.tokens)
    || !Array.isArray(tokenConfig.list_tokens)
  ) {
    throw new Error('metadata/config-tokens.json must declare schema_version 1, tokens, and list_tokens');
  }
  const known = new Set(tokenConfig.tokens);
  const listTokens = new Set(tokenConfig.list_tokens);
  for (const key of listTokens) {
    if (!known.has(key)) throw new Error(`list token ${key} is absent from tokens`);
  }
  const lines = [
    '# .grove/config.toml — consumer-authoritative shared Grove role config.',
    '# Values are verified priors; Grove lifecycle operations never refresh this file.',
    '',
  ];
  for (const key of Object.keys(config).sort()) {
    if (!known.has(key)) throw new Error(`unknown config token: ${key}`);
    const value = config[key];
    if (listTokens.has(key)) {
      if (!Array.isArray(value)) throw new Error(`list token ${key} requires an array`);
      lines.push(`${key} = [${value.map((item) => JSON.stringify(String(item))).join(', ')}]`);
    } else {
      if (Array.isArray(value)) throw new Error(`scalar token ${key} does not accept an array`);
      lines.push(`${key} = ${JSON.stringify(String(value))}`);
    }
  }
  return lines.join('\n') + '\n';
}

function isConsumerFloorPath(path) {
  if (
    typeof path !== 'string'
    || path.includes('\\')
    || normalizeSlashes(normalize(path)) !== path
  ) {
    return false;
  }
  return path === '.grove/gates.toml'
    || path === '.grove/config.toml'
    || path === '.grove/agents'
    || path.startsWith('.grove/agents/');
}

function compareSemver(a, b) {
  const av = a.split('.').map(Number);
  const bv = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (av[i] !== bv[i]) return av[i] > bv[i] ? 1 : -1;
  }
  return 0;
}

function newPlan(repoRoot, operation) {
  return {
    ok: true,
    operation,
    repoRoot,
    summary: '',
    actions: [],
    skipped: [],
    refusals: [],
    legacy: [],
    inventory: [],
    skew: [],
  };
}

function fail(plan, reason) {
  plan.ok = false;
  plan.summary = reason;
  plan.actions = [];
  return plan;
}

function addWriteIfChanged(plan, path, content, options = {}) {
  const existing = readRepoOptional(plan, path);
  addDeferredWrite(plan, path, content, existing, options);
}

function addDeferredWrite(plan, path, content, existingPromise, options) {
  // Plans are built asynchronously, but this helper keeps action construction
  // deterministic while allowing callers to avoid a second read.
  plan._pending ??= [];
  plan._pending.push((async () => {
    const existing = await existingPromise;
    if (existing === content) {
      skip(plan, path, 'already current');
      return;
    }
    addAction(plan, {
      type: 'write',
      path,
      content,
      expected: { kind: 'file', content: existing },
      ...options,
    });
  })());
}

function addAction(plan, action) {
  action.path = normalizeSlashes(action.path);
  action.id = `${action.type}:${action.path}`;
  if (!plan.actions.some((item) => item.id === action.id)) plan.actions.push(action);
}

function skip(plan, path, reason) {
  if (!plan.skipped.some((item) => item.path === path && item.reason === reason)) {
    plan.skipped.push({ path: normalizeSlashes(path), reason });
  }
}

function refuse(plan, path, reason) {
  if (!plan.refusals.some((item) => item.path === path && item.reason === reason)) {
    plan.refusals.push({ path: normalizeSlashes(path), reason });
  }
}

async function settlePlan(plan) {
  if (plan._pending) await Promise.all(plan._pending);
  delete plan._pending;
  plan.actions.sort((a, b) => a.path.localeCompare(b.path) || a.type.localeCompare(b.type));
  return plan;
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readRequired(path) {
  return readFile(path, 'utf8');
}

async function safeRepoTarget(repoRoot, path) {
  const target = safeTarget(repoRoot, path);
  await assertNoSymlinkComponents(repoRoot, target, path);
  return target;
}

async function readRepoOptional(context, path) {
  return readOptional(await safeRepoTarget(context.repoRoot, path));
}

async function readRepoRequired(context, path) {
  return readRequired(await safeRepoTarget(context.repoRoot, path));
}

async function repoPathExists(context, path) {
  return pathExists(await safeRepoTarget(context.repoRoot, path));
}

async function pathExists(path) {
  return stat(path).then(() => true, (error) => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
}

async function walkFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

async function walkNoFollow(root) {
  let rootInfo;
  try {
    rootInfo = await lstat(root);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    return [{
      absolute: root,
      relative: '',
      kind: rootInfo.isSymbolicLink() ? 'symlink' : 'special',
    }];
  }
  const entries = [];
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      const relativePath = normalizeSlashes(join(prefix, entry.name));
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) {
        entries.push({ absolute, relative: relativePath, kind: 'symlink' });
      } else if (info.isDirectory()) {
        await visit(absolute, relativePath);
      } else if (info.isFile()) {
        entries.push({ absolute, relative: relativePath, kind: 'file' });
      } else {
        entries.push({ absolute, relative: relativePath, kind: 'special' });
      }
    }
  }
  await visit(root);
  return entries.sort((left, right) => left.relative.localeCompare(right.relative));
}

async function snapshotTree(root) {
  if (!(await pathExists(root))) return null;
  const entries = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const rel = normalizeSlashes(relative(root, path));
      if (entry.isDirectory()) {
        entries.push({ path: `${rel}/`, type: 'directory' });
        await visit(path);
      } else if (entry.isFile()) {
        entries.push({ path: rel, type: 'file', content: await readRequired(path) });
      } else {
        entries.push({ path: rel, type: 'other' });
      }
    }
  }
  await visit(root);
  return entries;
}

function safeTarget(repoRoot, path) {
  const target = resolve(repoRoot, path);
  const rel = relative(repoRoot, target);
  if (rel === '' || rel.startsWith(`..${sep}`) || rel === '..') {
    throw new Error(`lifecycle target escapes or equals repository root: ${path}`);
  }
  return target;
}

async function assertNoSymlinkComponents(repoRoot, target, displayPath) {
  const rel = relative(repoRoot, target);
  let cursor = repoRoot;
  for (const component of rel.split(sep)) {
    cursor = join(cursor, component);
    let info;
    try {
      info = await lstat(cursor);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    if (info.isSymbolicLink()) {
      throw new Error(`${displayPath} crosses symbolic link ${relative(repoRoot, cursor)}; no lifecycle write was applied`);
    }
  }
}

function normalizeSlashes(path) {
  return normalize(path).split(sep).join('/');
}

function exactLineIndices(text, marker) {
  const result = [];
  let offset = 0;
  for (const rawLine of String(text).split(/(?<=\n)/)) {
    const line = rawLine.replace(/\r?\n$/, '');
    if (line === marker) result.push(offset);
    offset += rawLine.length;
  }
  return result;
}
