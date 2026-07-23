import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

export const REQUIRED_SURFACE_IDS = Object.freeze([
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
]);

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const RELEASE_STATES = new Set(['supported', 'unsupported', 'candidate']);
const BRIDGE_STATES = new Set(['host-native', 'bridge-viable', 'partial-primitive', 'unknown', 'documentation-constraint']);

export function validateVersionText(text) {
  const normalized = text.endsWith('\n') ? text.slice(0, -1) : text;
  if (normalized.includes('\n') || normalized.includes('\r')) {
    throw new Error('VERSION must contain exactly one line');
  }
  if (!SEMVER.test(normalized)) {
    throw new Error('VERSION must be a strict semantic version without a v prefix');
  }
  return normalized;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateSurfaceMatrix(matrix, { release = false } = {}) {
  const errors = [];
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) return ['surfaces.json must contain an object'];
  if (matrix.schema_version !== 1) errors.push('surfaces.json schema_version must equal 1');
  if (!SEMVER.test(matrix.version ?? '')) errors.push('surfaces.json version must be strict semver');
  if (!Array.isArray(matrix.rows)) return [...errors, 'surfaces.json rows must be an array'];

  const counts = new Map();
  for (const item of matrix.rows) {
    const id = item?.surface_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (!REQUIRED_SURFACE_IDS.includes(id)) errors.push(`unexpected surface row: ${String(id)}`);
    const expectedHost = id?.startsWith('claude-') ? 'claude' : id?.startsWith('codex-') ? 'codex' : null;
    if (item?.host !== expectedHost) errors.push(`${String(id)} host must equal ${String(expectedHost)}`);
    if (!BRIDGE_STATES.has(item?.bridge_state)) errors.push(`${String(id)} has unclassified bridge_state ${String(item?.bridge_state)}`);
    if (!RELEASE_STATES.has(item?.release_state)) errors.push(`${String(id)} has unclassified release_state ${String(item?.release_state)}`);
    if (!Array.isArray(item?.evidence)) errors.push(`${String(id)} evidence must be an array`);

    if (item?.release_state === 'candidate') {
      if (item?.bridge_state !== 'bridge-viable') errors.push(`${String(id)} candidate state requires bridge-viable`);
      if (release) errors.push(`${String(id)} remains candidate; release requires supported or unsupported`);
      if (!nonEmpty(item?.missing_capability) || !nonEmpty(item?.disclosure)) {
        errors.push(`${String(id)} candidate state requires missing_capability and disclosure`);
      }
    }
    if (item?.release_state === 'unsupported') {
      if (!nonEmpty(item?.missing_capability)) errors.push(`${String(id)} unsupported state requires missing_capability`);
      if (!nonEmpty(item?.disclosure)) errors.push(`${String(id)} unsupported state requires disclosure`);
    }
    if (item?.release_state === 'supported') {
      if (!nonEmpty(item?.load_path)) errors.push(`${String(id)} supported state requires load_path`);
      if (!nonEmpty(item?.support_record)) errors.push(`${String(id)} supported state requires support_record path`);
    }
  }

  for (const id of REQUIRED_SURFACE_IDS) {
    const count = counts.get(id) ?? 0;
    if (count === 0) errors.push(`missing surface row: ${id}`);
    if (count > 1) errors.push(`duplicate surface row: ${id}`);
  }
  return errors;
}

function displayState(row) {
  if (row.release_state === 'supported') return 'Supported';
  if (row.release_state === 'candidate') return 'Candidate — not supported';
  return 'Unsupported';
}

export function renderSurfaceDocumentation(matrix) {
  const rows = [...matrix.rows].sort((a, b) => REQUIRED_SURFACE_IDS.indexOf(a.surface_id) - REQUIRED_SURFACE_IDS.indexOf(b.surface_id));
  const lines = [
    '<!-- grove-surface-matrix:begin (generated from plugins/grove/surfaces.json) -->',
    '| Surface | Release state | Load/bridge state | Disclosure |',
    '|---|---|---|---|',
  ];
  for (const row of rows) {
    const disclosure = String(row.disclosure).replaceAll('|', '\\|').replaceAll('\n', ' ');
    lines.push(`| \`${row.surface_id}\` | ${displayState(row)} | ${row.bridge_state} | ${disclosure} |`);
  }
  lines.push('<!-- grove-surface-matrix:end -->');
  return `${lines.join('\n')}\n`;
}

export function replaceSurfaceDocumentation(text, rendered) {
  const pattern = /<!-- grove-surface-matrix:begin \(generated from plugins\/grove\/surfaces\.json\) -->[\s\S]*?<!-- grove-surface-matrix:end -->\n?/;
  if (!pattern.test(text)) throw new Error('document has no Grove surface-matrix markers');
  return text.replace(pattern, rendered);
}

export function decideTagAction({ intendedCommit, tagCommit }) {
  if (!/^[0-9a-f]{40}$/i.test(intendedCommit ?? '')) throw new Error('intended commit must be a full commit id');
  if (tagCommit === null) return { action: 'create' };
  if (!/^[0-9a-f]{40}$/i.test(tagCommit ?? '')) throw new Error('peeled tag commit must be a full commit id');
  if (tagCommit === intendedCommit) return { action: 'noop' };
  return { action: 'conflict', intendedCommit, tagCommit };
}

async function readJson(path, label, errors) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
    return null;
  }
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function findCustomAgentToml(root) {
  const found = [];
  async function walk(path) {
    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) await walk(child);
      if (entry.isFile() && entry.name.endsWith('.toml') && relative(root, child).split('/').includes('agents')) {
        found.push(relative(root, child));
      }
    }
  }
  await walk(root);
  return found;
}

function validateManifest(manifest, label, version, errors) {
  if (!manifest) return;
  if (manifest.name !== 'grove') errors.push(`${label} name must equal grove`);
  if (manifest.version !== version) errors.push(`${label} version ${String(manifest.version)} differs from VERSION ${version}`);
  if (!nonEmpty(manifest.description)) errors.push(`${label} description is required`);
  if (!nonEmpty(manifest.author?.name)) errors.push(`${label} author.name is required`);
}

export function validateCodexManifest(manifest, version) {
  const errors = [];
  validateManifest(manifest, '.codex-plugin/plugin.json', version, errors);
  if (!nonEmpty(manifest?.skills) || !manifest.skills.startsWith('./')) {
    errors.push('.codex-plugin/plugin.json skills must be a ./-relative path');
  }
  if ('hooks' in (manifest ?? {})) errors.push('.codex-plugin/plugin.json hooks is unsupported');
  const requiredInterface = [
    'displayName',
    'shortDescription',
    'longDescription',
    'developerName',
    'category',
  ];
  for (const field of requiredInterface) {
    if (!nonEmpty(manifest?.interface?.[field])) errors.push(`.codex-plugin/plugin.json interface.${field} is required`);
  }
  if (!Array.isArray(manifest?.interface?.capabilities) || manifest.interface.capabilities.length === 0) {
    errors.push('.codex-plugin/plugin.json interface.capabilities is required');
  }
  const prompts = manifest?.interface?.defaultPrompt;
  if (!Array.isArray(prompts) || prompts.length === 0 || prompts.length > 3) {
    errors.push('.codex-plugin/plugin.json interface.defaultPrompt must contain one to three prompts');
  } else {
    for (const prompt of prompts) {
      if (!nonEmpty(prompt) || prompt.length > 128) errors.push('.codex-plugin/plugin.json defaultPrompt entries must be non-empty and at most 128 characters');
    }
  }
  for (const field of ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
    const value = manifest?.interface?.[field];
    if (value !== undefined && !/^https:\/\//.test(value)) errors.push(`.codex-plugin/plugin.json interface.${field} must use https`);
  }
  return errors;
}

export function validateHostDeclarations(config) {
  const errors = [];
  if (config?.version !== 'VERSION') errors.push('install/hosts.json must declare VERSION as the shared version authority');
  if (config?.surface_matrix !== 'surfaces.json') errors.push('install/hosts.json must declare surfaces.json as the surface authority');
  if (config?.config_tokens !== 'install/config-tokens.json') {
    errors.push('install/hosts.json must declare install/config-tokens.json as the config-token authority');
  }
  return errors;
}

function plainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function validateIdentitySet(actual, expected, label, errors) {
  if (!Array.isArray(actual)) {
    errors.push(`${label} identities must be an array`);
    return;
  }
  const seen = new Set();
  const invocationTokens = new Set();
  for (const identity of actual) {
    if (!plainObject(identity)) {
      errors.push(`${label} identity entries must be objects`);
      continue;
    }
    const key = `${identity.canonical_id}\0${identity.exposure}`;
    if (seen.has(key)) errors.push(`${label} identities contain duplicate ${identity.canonical_id}/${identity.exposure}`);
    seen.add(key);
    const match = expected.find((item) => (
      item.canonical_id === identity.canonical_id
      && item.exposure === identity.exposure
    ));
    if (!match) {
      errors.push(`${label} identities contain unexpected ${identity.canonical_id}/${identity.exposure}`);
      continue;
    }
    for (const field of ['native_id', 'source', 'digest']) {
      if (identity[field] !== match[field]) {
        errors.push(`${label} identity ${identity.canonical_id}/${identity.exposure} has wrong ${field}`);
      }
    }
    if (!nonEmpty(identity.invocation)) {
      errors.push(`${label} identity ${identity.canonical_id}/${identity.exposure} requires an invocation token`);
    } else if (invocationTokens.has(identity.invocation)) {
      errors.push(`${label} identity invocation tokens must be unique`);
    } else {
      invocationTokens.add(identity.invocation);
    }
  }
  for (const identity of expected) {
    const key = `${identity.canonical_id}\0${identity.exposure}`;
    if (!seen.has(key)) errors.push(`${label} identities are missing ${identity.canonical_id}/${identity.exposure}`);
  }
  if (actual.length !== expected.length) {
    errors.push(`${label} identities must contain exactly ${expected.length} entries`);
  }
}

export function validateSupportRecord(record, row, version, {
  inventory = null,
  sourceDigests = null,
} = {}) {
  const errors = [];
  const required = [
    'host_version',
    'clean_environment',
    'install_load_path',
    'launcher_form',
    'role_identities',
    'producer_reviewer_separation',
    'driving_session_roles',
    'spawned_dispatcher',
    'config_and_addendum',
    'outcome',
    'observed_at',
    'procedure',
  ];
  if (record?.host !== row.host) errors.push(`${row.surface_id} support record host does not match`);
  if (record?.surface_id !== row.surface_id) errors.push(`${row.surface_id} support record surface_id does not match`);
  if (record?.grove_version !== version) errors.push(`${row.surface_id} support record Grove version does not match ${version}`);
  for (const field of required) {
    const value = record?.[field];
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      errors.push(`${row.surface_id} support record is missing ${field}`);
    }
  }
  if (record?.outcome !== 'pass') errors.push(`${row.surface_id} support record outcome must equal pass`);
  if (!inventory || inventory.schema !== 1 || !Array.isArray(inventory.roles) || !plainObject(sourceDigests)) {
    errors.push(`${row.surface_id} support record validation requires the canonical role inventory and source digests`);
    return errors;
  }

  const driving = [];
  const native = [];
  for (const role of inventory.roles) {
    const digest = sourceDigests[role.id];
    if (!/^[0-9a-f]{64}$/.test(digest ?? '')) {
      errors.push(`${row.surface_id} canonical digest is unavailable for ${role.id}`);
      continue;
    }
    for (const exposure of role.exposures ?? []) {
      const identity = {
        canonical_id: role.id,
        native_id: exposure.native_id ?? null,
        exposure: exposure.class,
        source: role.source,
        digest,
      };
      if (exposure.class === 'driving-session') driving.push(identity);
      else native.push(identity);
    }
  }
  validateIdentitySet(record?.role_identities?.driving_session, driving, `${row.surface_id} driving`, errors);
  validateIdentitySet(record?.role_identities?.native, native, `${row.surface_id} native`, errors);

  if (
    record?.clean_environment?.consumer_empty !== true
    || record?.clean_environment?.candidate_only !== true
    || record?.clean_environment?.fresh_session !== true
  ) {
    errors.push(`${row.surface_id} clean environment must prove an empty consumer, candidate-only plugin state, and fresh session`);
  }
  if (
    record?.launcher_form?.count !== native.length
    || record?.launcher_form?.contains_charter_body !== false
  ) {
    errors.push(`${row.surface_id} launcher form must prove ${native.length} thin native launchers`);
  }
  const separation = record?.producer_reviewer_separation;
  if (
    separation?.separate !== true
    || separation?.producer?.native_id !== 'grove_executor'
    || separation?.reviewer?.native_id !== 'grove_code_reviewer'
    || !nonEmpty(separation?.producer?.invocation)
    || !nonEmpty(separation?.reviewer?.invocation)
    || separation?.producer?.invocation === separation?.reviewer?.invocation
  ) {
    errors.push(`${row.surface_id} producer and reviewer must be separate executor/code-reviewer invocations`);
  }
  if (
    record?.driving_session_roles?.delegated !== false
    || record?.driving_session_roles?.matched_inventory !== true
    || !nonEmpty(record?.driving_session_roles?.dispatcher_invocation)
    || !nonEmpty(record?.driving_session_roles?.shaper_invocation)
  ) {
    errors.push(`${row.surface_id} driving-session roles must match inventory without delegation`);
  }
  if (
    record?.spawned_dispatcher?.native_id !== 'grove_dispatcher'
    || record?.spawned_dispatcher?.exposure !== 'scoped-advisor'
    || record?.spawned_dispatcher?.advertised_driving_session !== false
    || !nonEmpty(record?.spawned_dispatcher?.invocation)
  ) {
    errors.push(`${row.surface_id} spawned dispatcher must prove only the scoped-advisor exposure`);
  }
  if (
    record?.config_and_addendum?.role !== 'grove_executor'
    || record?.config_and_addendum?.both_observed !== true
    || !nonEmpty(record?.config_and_addendum?.config_sentinel)
    || !nonEmpty(record?.config_and_addendum?.addendum_sentinel)
  ) {
    errors.push(`${row.surface_id} config and addendum must both be observed by grove_executor`);
  }
  return errors;
}

async function supportContext(root, errors) {
  const inventory = await readJson(join(root, 'roles.json'), 'roles.json', errors);
  if (!inventory || !Array.isArray(inventory.roles)) return { inventory, sourceDigests: {} };
  const sourceDigests = {};
  for (const role of inventory.roles) {
    try {
      const canonical = await readFile(resolve(root, '..', '..', role.source));
      sourceDigests[role.id] = createHash('sha256').update(canonical).digest('hex');
    } catch (error) {
      errors.push(`canonical role source ${String(role.source)}: ${error.message}`);
    }
  }
  return { inventory, sourceDigests };
}

export async function validateReleaseTree(root, {
  release = false,
  docs = [],
  allowIncomplete = false,
} = {}) {
  const errors = [];
  let version = null;
  try {
    version = validateVersionText(await readFile(join(root, 'VERSION'), 'utf8'));
  } catch (error) {
    if (!allowIncomplete) errors.push(`VERSION: ${error.message}`);
  }

  const claude = await readJson(join(root, '.claude-plugin', 'plugin.json'), '.claude-plugin/plugin.json', errors);
  const codex = await readJson(join(root, '.codex-plugin', 'plugin.json'), '.codex-plugin/plugin.json', errors);
  const surfaces = await readJson(join(root, 'surfaces.json'), 'surfaces.json', errors);
  const hostDeclarations = allowIncomplete
    ? null
    : await readJson(join(root, 'install', 'hosts.json'), 'install/hosts.json', errors);
  if (version) {
    validateManifest(claude, '.claude-plugin/plugin.json', version, errors);
    errors.push(...validateCodexManifest(codex, version));
    if (codex?.skills && !await exists(join(root, codex.skills))) {
      errors.push(`.codex-plugin/plugin.json skills path does not exist: ${codex.skills}`);
    }
  }
  if (surfaces) {
    errors.push(...validateSurfaceMatrix(surfaces, { release }));
    if (version && surfaces.version !== version) {
      errors.push(`surfaces.json version ${String(surfaces.version)} differs from VERSION ${version}`);
    }
    const supportedRows = (surfaces.rows ?? []).filter((row) => row.release_state === 'supported');
    const recordContext = supportedRows.length > 0
      ? await supportContext(root, errors)
      : { inventory: null, sourceDigests: null };
    for (const row of surfaces.rows ?? []) {
      for (const evidence of row.evidence ?? []) {
        if (!await exists(join(root, evidence))) errors.push(`${row.surface_id} evidence does not exist: ${evidence}`);
      }
      if (row.release_state === 'supported' && nonEmpty(row.support_record)) {
        const record = await readJson(join(root, row.support_record), `${row.surface_id} support_record`, errors);
        if (record && version) errors.push(...validateSupportRecord(record, row, version, recordContext));
      }
    }
    const rendered = renderSurfaceDocumentation(surfaces);
    for (const docPath of docs) {
      try {
        const text = await readFile(docPath, 'utf8');
        const expected = replaceSurfaceDocumentation(text, rendered);
        if (text !== expected) errors.push(`${docPath} surface matrix documentation is stale`);
      } catch (error) {
        errors.push(`${docPath}: ${error.message}`);
      }
    }
  }
  if (hostDeclarations) errors.push(...validateHostDeclarations(hostDeclarations));

  for (const path of await findCustomAgentToml(root)) errors.push(`Codex plugin contains custom-agent TOML: ${path}`);
  return { ok: errors.length === 0, version, errors };
}
