import { createHash } from 'node:crypto';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  stat,
  symlink,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

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
const DISCOVERY_ARTIFACTS = Object.freeze([
  'host-version.txt',
  'marketplace-install-transcript.txt',
  'discovered-components.json',
  'invocation-results.json',
  'package-tree-sha256.txt',
]);
const DISCOVERY_CASES = Object.freeze([
  ['claude', 'shallow'],
  ['claude', 'deep-with-spaces'],
  ['codex', 'shallow'],
  ['codex', 'deep-with-spaces'],
]);

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
    '<!-- grove-surface-matrix:begin (generated from plugins/grove/metadata/surfaces.json) -->',
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
  const pattern = /<!-- grove-surface-matrix:begin \(generated from plugins\/grove\/metadata\/surfaces\.json\) -->[\s\S]*?<!-- grove-surface-matrix:end -->\n?/;
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
  if (manifest?.skills !== './adapters/codex/skills/') {
    errors.push('.codex-plugin/plugin.json skills must equal ./adapters/codex/skills/');
  }
  if ('agents' in (manifest ?? {})) errors.push('.codex-plugin/plugin.json agents is forbidden');
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

export function validateClaudeManifest(manifest, version, inventory) {
  const errors = [];
  validateManifest(manifest, '.claude-plugin/plugin.json', version, errors);
  const expectedAgents = (inventory?.components ?? [])
    .filter((component) => component.class === 'agent')
    .map((component) => `./${component.path}`);
  if (
    !Array.isArray(manifest?.agents)
    || JSON.stringify(manifest.agents) !== JSON.stringify(expectedAgents)
  ) {
    errors.push('.claude-plugin/plugin.json agents must equal the explicit inventory-derived agent array');
  }
  if (manifest?.skills !== './adapters/claude/skills/') {
    errors.push('.claude-plugin/plugin.json skills must equal ./adapters/claude/skills/');
  }
  return errors;
}

export function validateHostDeclarations(config) {
  const errors = [];
  if (config?.version !== 'VERSION') errors.push('metadata/hosts.json must declare VERSION as the shared version authority');
  if (config?.surface_matrix !== 'metadata/surfaces.json') errors.push('metadata/hosts.json must declare metadata/surfaces.json as the surface authority');
  if (config?.config_tokens !== 'metadata/config-tokens.json') {
    errors.push('metadata/hosts.json must declare metadata/config-tokens.json as the config-token authority');
  }
  return errors;
}

function exactDiscoveryArtifactBindings(actual, expected) {
  if (!plainObject(actual) || !plainObject(expected)) return false;
  const names = [...DISCOVERY_ARTIFACTS].sort();
  if (JSON.stringify(Object.keys(actual).sort()) !== JSON.stringify(names)) return false;
  if (JSON.stringify(Object.keys(expected).sort()) !== JSON.stringify(names)) return false;
  return names.every((name) => (
    plainObject(actual[name])
    && plainObject(expected[name])
    && JSON.stringify(Object.keys(actual[name]).sort()) === JSON.stringify(['path', 'sha256'])
    && JSON.stringify(Object.keys(expected[name]).sort()) === JSON.stringify(['path', 'sha256'])
    && actual[name].path === expected[name].path
    && actual[name].sha256 === expected[name].sha256
  ));
}

async function lstatWithoutSymlinks(baseDir, target) {
  const segments = relative(baseDir, target).split(sep).filter(Boolean);
  let current = baseDir;
  const baseInfo = await lstat(current);
  if (baseInfo.isSymbolicLink()) throw new Error(`symlink in evidence path: ${current}`);
  for (const segment of segments) {
    current = join(current, segment);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error(`symlink in evidence path: ${current}`);
  }
  return lstat(target);
}

export async function validateHostDiscoveryContract(input, {
  release = false,
  expectedPackageTreeSha256 = null,
} = {}) {
  const errors = [];
  let contract;
  let baseDir = null;
  if (typeof input === 'string') {
    try {
      contract = JSON.parse(await readFile(input, 'utf8'));
      baseDir = dirname(resolve(input));
    } catch (error) {
      return [`host discovery contract cannot be read: ${error.message}`];
    }
  } else if (plainObject(input) && 'document' in input) {
    contract = input.document;
    baseDir = typeof input.baseDir === 'string' ? resolve(input.baseDir) : null;
  } else {
    contract = input;
  }
  const prefix = 'host discovery contract';
  if (
    contract?.schema_version !== 1
    || contract?.contract !== 'grove-live-host-clean-install-discovery'
    || typeof contract?.release_blocking !== 'boolean'
    || typeof contract?.claimed_pass !== 'boolean'
    || !Array.isArray(contract?.cases)
    || !nonEmpty(contract?.precondition)
    || !nonEmpty(contract?.completion_rule)
  ) {
    return [`${prefix} has an invalid envelope`];
  }
  if (contract.release_blocking === contract.claimed_pass) {
    errors.push(`${prefix} release_blocking must be the inverse of claimed_pass`);
  }
  const expectedCases = new Set(DISCOVERY_CASES.map(([host, layout]) => `${host}\0${layout}`));
  const seen = new Set();
  const packageDigests = new Set();
  for (const item of contract.cases) {
    const key = `${item?.host}\0${item?.layout}`;
    if (!expectedCases.has(key)) {
      errors.push(`${prefix} has unexpected case ${String(item?.host)}/${String(item?.layout)}`);
      continue;
    }
    if (seen.has(key)) errors.push(`${prefix} duplicates case ${item.host}/${item.layout}`);
    seen.add(key);
    if (
      !nonEmpty(item.consumer_path_shape)
      || (
        item.layout === 'deep-with-spaces'
        && (
          !item.consumer_path_shape.includes(' ')
          || item.consumer_path_shape.split('/').filter(Boolean).length < 9
        )
      )
    ) {
      errors.push(`${prefix} case ${item.host}/${item.layout} has an invalid path shape`);
    }
    if (
      !Array.isArray(item.required_artifacts)
      || JSON.stringify([...item.required_artifacts].sort()) !== JSON.stringify([...DISCOVERY_ARTIFACTS].sort())
    ) {
      errors.push(`${prefix} case ${item.host}/${item.layout} must name the exact required artifacts`);
    }
    if (!contract.claimed_pass) continue;
    const evidence = item.evidence;
    if (
      !plainObject(evidence)
      || !nonEmpty(evidence.host_version)
      || !/^[0-9a-f]{64}$/.test(evidence.package_tree_sha256 ?? '')
      || evidence.review?.verdict !== 'pass'
      || !nonEmpty(evidence.review?.reviewer)
      || !/^\d{4}-\d{2}-\d{2}$/.test(evidence.review?.reviewed_at ?? '')
      || !plainObject(evidence.review?.artifact)
      || !nonEmpty(evidence.review.artifact.path)
      || !/^[0-9a-f]{64}$/.test(evidence.review.artifact.sha256 ?? '')
      || !plainObject(evidence.artifacts)
    ) {
      errors.push(`${prefix} case ${item.host}/${item.layout} lacks a reviewed evidence binding`);
      continue;
    }
    packageDigests.add(evidence.package_tree_sha256);
    if (baseDir == null) {
      errors.push(`${prefix} claimed-pass evidence requires a base directory`);
      continue;
    }
    for (const artifactName of DISCOVERY_ARTIFACTS) {
      const binding = evidence.artifacts[artifactName];
      if (
        !plainObject(binding)
        || !nonEmpty(binding.path)
        || !/^[0-9a-f]{64}$/.test(binding.sha256 ?? '')
      ) {
        errors.push(`${prefix} case ${item.host}/${item.layout} lacks binding for ${artifactName}`);
        continue;
      }
      const target = resolve(baseDir, binding.path);
      const rel = relative(baseDir, target);
      if (
        rel === ''
        || rel === '..'
        || rel.startsWith(`..${sep}`)
        || isAbsolute(binding.path)
      ) {
        errors.push(`${prefix} evidence path escapes for ${item.host}/${item.layout}/${artifactName}`);
        continue;
      }
      try {
        const info = await lstatWithoutSymlinks(baseDir, target);
        if (!info.isFile() || info.isSymbolicLink()) {
          errors.push(`${prefix} evidence is not a regular file: ${binding.path}`);
          continue;
        }
        const bytes = await readFile(target);
        const digest = createHash('sha256').update(bytes).digest('hex');
        if (digest !== binding.sha256) {
          errors.push(`${prefix} evidence digest differs: ${binding.path}`);
        }
        if (
          artifactName === 'package-tree-sha256.txt'
          && bytes.toString('utf8').trim() !== evidence.package_tree_sha256
        ) {
          errors.push(`${prefix} package-tree claim differs: ${binding.path}`);
        }
        if (
          artifactName === 'host-version.txt'
          && bytes.toString('utf8').trim() !== evidence.host_version
        ) {
          errors.push(`${prefix} host-version claim differs: ${binding.path}`);
        }
      } catch (error) {
        errors.push(`${prefix} evidence cannot be read at ${binding.path}: ${error.message}`);
      }
    }
    const reviewBinding = evidence.review.artifact;
    const reviewTarget = resolve(baseDir, reviewBinding.path);
    const reviewRel = relative(baseDir, reviewTarget);
    if (
      reviewRel === ''
      || reviewRel === '..'
      || reviewRel.startsWith(`..${sep}`)
      || isAbsolute(reviewBinding.path)
    ) {
      errors.push(`${prefix} review evidence path escapes for ${item.host}/${item.layout}`);
    } else {
      try {
        const info = await lstatWithoutSymlinks(baseDir, reviewTarget);
        if (!info.isFile() || info.isSymbolicLink()) {
          errors.push(`${prefix} review evidence is not a regular file: ${reviewBinding.path}`);
        } else {
          const bytes = await readFile(reviewTarget);
          const digest = createHash('sha256').update(bytes).digest('hex');
          if (digest !== reviewBinding.sha256) {
            errors.push(`${prefix} review evidence digest differs: ${reviewBinding.path}`);
          } else {
            const reviewDocument = JSON.parse(bytes.toString('utf8'));
            if (
              reviewDocument.host !== item.host
              || reviewDocument.layout !== item.layout
              || reviewDocument.reviewer !== evidence.review.reviewer
              || reviewDocument.reviewed_at !== evidence.review.reviewed_at
              || reviewDocument.verdict !== evidence.review.verdict
              || reviewDocument.package_tree_sha256 !== evidence.package_tree_sha256
            ) {
              errors.push(`${prefix} review evidence content differs: ${reviewBinding.path}`);
            }
            if (!exactDiscoveryArtifactBindings(reviewDocument.artifacts, evidence.artifacts)) {
              errors.push(`${prefix} review artifact bindings differ: ${reviewBinding.path}`);
            }
          }
        }
      } catch (error) {
        errors.push(`${prefix} review evidence cannot be read at ${reviewBinding.path}: ${error.message}`);
      }
    }
    const extraArtifacts = Object.keys(evidence.artifacts)
      .filter((name) => !DISCOVERY_ARTIFACTS.includes(name));
    if (extraArtifacts.length > 0) {
      errors.push(`${prefix} case ${item.host}/${item.layout} has unexpected artifact bindings`);
    }
  }
  for (const key of expectedCases) {
    if (!seen.has(key)) {
      const [host, layout] = key.split('\0');
      errors.push(`${prefix} is missing case ${host}/${layout}`);
    }
  }
  if (contract.cases.length !== expectedCases.size) {
    errors.push(`${prefix} must contain exactly four cases`);
  }
  if (contract.claimed_pass && packageDigests.size !== 1) {
    errors.push(`${prefix} claimed-pass cases must bind one exact package tree digest`);
  }
  if (
    contract.claimed_pass
    && (
      !/^[0-9a-f]{64}$/.test(expectedPackageTreeSha256 ?? '')
      || packageDigests.size !== 1
      || !packageDigests.has(expectedPackageTreeSha256)
    )
  ) {
    errors.push(`${prefix} claimed-pass digest must equal the exact package snapshot digest`);
  }
  if (release && (contract.release_blocking || !contract.claimed_pass)) {
    errors.push(`${prefix} is release-blocking until all live-host evidence is reviewed and claimed_pass`);
  }
  return errors;
}

export function validateLegacyOwnershipInventory(inventory) {
  const errors = [];
  if (
    inventory?.schema_version !== 1
    || !Array.isArray(inventory.records)
    || inventory.records.length === 0
  ) {
    return ['metadata/legacy-ownership.json must declare schema_version 1 and a non-empty records array'];
  }
  const composite = new Set();
  const byVersion = new Map();
  for (const record of inventory.records) {
    const key = `${record?.grove_version}\0${record?.candidate_path}`;
    if (!/^\d+\.\d+\.\d+$/.test(record?.grove_version ?? '')) {
      errors.push(`legacy record has invalid grove_version: ${String(record?.grove_version)}`);
    }
    if (composite.has(key)) errors.push(`duplicate legacy composite key: ${record?.grove_version}/${record?.candidate_path}`);
    composite.add(key);
    const paths = byVersion.get(record?.grove_version) ?? new Set();
    paths.add(record?.candidate_path);
    byVersion.set(record?.grove_version, paths);
    if (record?.candidate_path === '.grove/internal/enforcement.toml') {
      if (record.candidate_kind !== 'regular-file' || !/^[0-9a-f]{64}$/.test(record.sha256 ?? '')) {
        errors.push(`${record.grove_version} enforcement legacy record must be a regular-file with sha256`);
      }
    } else if (record?.candidate_path === '.grove/internal/gates') {
      if (record.candidate_kind !== 'tree' || !Array.isArray(record.leaves) || record.leaves.length === 0) {
        errors.push(`${record.grove_version} gates legacy record must be a non-empty tree`);
        continue;
      }
      const leafPaths = new Set();
      for (const leaf of record.leaves) {
        if (
          leaf?.kind !== 'regular-file'
          || typeof leaf.relative_path !== 'string'
          || leaf.relative_path.startsWith('/')
          || leaf.relative_path.includes('..')
          || !/^[0-9a-f]{64}$/.test(leaf.sha256 ?? '')
        ) {
          errors.push(`${record.grove_version} gates legacy record has malformed leaf`);
        }
        if (leafPaths.has(leaf?.relative_path)) {
          errors.push(`${record.grove_version} gates legacy record has duplicate leaf ${leaf?.relative_path}`);
        }
        leafPaths.add(leaf?.relative_path);
      }
    } else {
      errors.push(`unexpected legacy candidate path: ${String(record?.candidate_path)}`);
    }
  }
  const required = new Set(['.grove/internal/enforcement.toml', '.grove/internal/gates']);
  for (const [version, paths] of byVersion) {
    for (const path of required) {
      if (!paths.has(path)) errors.push(`${version} legacy inventory omits prior record ${path}`);
    }
  }
  return errors;
}

export function validateHostInventory(inventory, { host, roleInventory, lifecycleInventory }) {
  const errors = [];
  if (
    inventory?.schema_version !== 1
    || inventory?.host !== host
    || inventory?.literal_prefix !== 'grove:'
    || !Array.isArray(inventory?.components)
  ) {
    return [`metadata/${host}-inventory.json has an invalid envelope`];
  }
  const expectedIds = new Set([
    ...(lifecycleInventory?.operations ?? []).map((operation) => `grove:${operation}`),
    ...(roleInventory?.roles ?? [])
      .filter((role) => host === 'codex' || role.outputs?.claude_agent)
      .map((role) => host === 'codex' ? `grove:role-${role.id}` : `grove:${role.id}`),
  ]);
  const seen = new Set();
  for (const component of inventory.components) {
    if (seen.has(component.raw_id)) errors.push(`${host} inventory duplicates ${component.raw_id}`);
    seen.add(component.raw_id);
    if (!expectedIds.has(component.raw_id)) errors.push(`${host} inventory has unexpected ${component.raw_id}`);
    if (
      typeof component.path !== 'string'
      || typeof component.canonical_source !== 'string'
      || !/^[0-9a-f]{64}$/.test(component.canonical_digest ?? '')
    ) {
      errors.push(`${host} inventory component ${String(component.raw_id)} lacks path/source/digest`);
    }
  }
  for (const id of expectedIds) {
    if (!seen.has(id)) errors.push(`${host} inventory is missing ${id}`);
  }
  if (seen.size !== expectedIds.size) errors.push(`${host} inventory component count differs from authored inventory`);
  for (const role of ['dispatcher', 'shaper']) {
    const loader = inventory.driving_loaders?.[role];
    if (
      !loader
      || loader.canonical_source !== `charters/${role}.md`
      || !/^[0-9a-f]{64}$/.test(loader.canonical_digest ?? '')
    ) {
      errors.push(`${host} driving loader ${role} lacks exact source/digest`);
    }
  }
  return errors;
}

function plainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
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
  if (!plainObject(actual) || !plainObject(expected)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    sameJsonValue(actualKeys, expectedKeys)
    && actualKeys.every((key) => sameJsonValue(actual[key], expected[key]))
  );
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

function validateCodexProbeEvidence(record, row, errors) {
  const evidence = record?.probe_evidence;
  const phases = evidence?.phases;
  if (!Array.isArray(phases)) {
    errors.push(`${row.surface_id} support record requires retained probe_evidence phases`);
    return;
  }
  const native = record?.role_identities?.native ?? [];
  const expectedInvocation = (childResult, nativeId = childResult?.native_id) => ({
    native_id: nativeId,
    invocation: childResult?.invocation,
    child_result: childResult,
  });
  const phasePlan = [
    { id: '01-driving-session', kind: 'driving-session', invocations: [] },
    {
      id: '02-native-batch-1',
      kind: 'native-batch',
      invocations: native.slice(0, 4).map((item) => expectedInvocation(item)),
    },
    {
      id: '03-native-batch-2',
      kind: 'native-batch',
      invocations: native.slice(4, 8).map((item) => expectedInvocation(item)),
    },
    {
      id: '04-native-batch-3',
      kind: 'native-batch',
      invocations: native.slice(8, 12).map((item) => expectedInvocation(item)),
    },
    {
      id: '05-producer-reviewer-separation',
      kind: 'separation',
      invocations: [
        expectedInvocation(record?.producer_reviewer_separation?.producer),
        expectedInvocation(record?.producer_reviewer_separation?.reviewer),
      ],
    },
    {
      id: '06-scoped-dispatcher',
      kind: 'scoped-dispatcher',
      invocations: [expectedInvocation(record?.spawned_dispatcher)],
    },
    {
      id: '07-config-addendum',
      kind: 'config-addendum',
      invocations: [expectedInvocation(
        record?.config_and_addendum,
        record?.config_and_addendum?.role,
      )],
    },
  ];
  if (phases.length !== phasePlan.length) {
    errors.push(`${row.surface_id} probe_evidence must contain exactly ${phasePlan.length} phases`);
  }
  const rootThreadIds = new Set();
  const childThreadIds = new Set();
  const artifactKeys = ['raw_jsonl', 'final_output', 'stderr', 'agent_metadata'];
  for (let index = 0; index < phasePlan.length; index += 1) {
    const expected = phasePlan[index];
    const phase = phases[index];
    if (!phase || phase.id !== expected.id || phase.kind !== expected.kind) {
      errors.push(`${row.surface_id} probe_evidence phase ${index + 1} must be ${expected.id}/${expected.kind}`);
      continue;
    }
    if (
      phase.verdict !== 'pass'
      || phase.exit_code !== 0
      || !Number.isInteger(phase.raw_event_count)
      || phase.raw_event_count < 1
      || phase.completed_spawn_count !== expected.invocations.length
      || !nonEmpty(phase.raw_jsonl)
      || !nonEmpty(phase.final_output)
      || !nonEmpty(phase.stderr)
      || !nonEmpty(phase.agent_metadata)
      || !Array.isArray(phase.argv)
      || phase.argv[0] !== 'codex'
      || !phase.argv.includes('exec')
      || !phase.argv.includes('--json')
    ) {
      errors.push(`${row.surface_id} probe_evidence phase ${expected.id} lacks complete passing raw evidence`);
    }
    if (
      !nonEmpty(phase.root_thread_id)
      || rootThreadIds.has(phase.root_thread_id)
      || childThreadIds.has(phase.root_thread_id)
    ) {
      errors.push(`${row.surface_id} probe_evidence phase ${expected.id} requires a unique root thread`);
    } else {
      rootThreadIds.add(phase.root_thread_id);
    }
    if (
      !plainObject(phase.artifact_sha256)
      || artifactKeys.some((key) => !/^[0-9a-f]{64}$/.test(phase.artifact_sha256[key] ?? ''))
    ) {
      errors.push(`${row.surface_id} probe_evidence phase ${expected.id} requires SHA-256 bindings for every raw artifact`);
    }
    if (
      !nonEmpty(phase.model)
      || !nonEmpty(phase.model_provider)
      || phase.multi_agent_version !== 'v2'
      || phase.model !== record?.clean_environment?.model
      || phase.model_provider !== record?.clean_environment?.model_provider
      || phase.multi_agent_version !== record?.clean_environment?.multi_agent_version
    ) {
      errors.push(`${row.surface_id} probe_evidence phase ${expected.id} model/backend differs from the support record`);
    }
    if (!Array.isArray(phase.invocations) || phase.invocations.length !== expected.invocations.length) {
      errors.push(`${row.surface_id} probe_evidence phase ${expected.id} has the wrong invocation proof count`);
      continue;
    }
    const taskNames = new Set();
    for (let invocationIndex = 0; invocationIndex < expected.invocations.length; invocationIndex += 1) {
      const expectedInvocation = expected.invocations[invocationIndex];
      const observed = phase.invocations[invocationIndex];
      if (
        !expectedInvocation
        || observed?.native_id !== expectedInvocation.native_id
        || observed?.invocation !== expectedInvocation.invocation
        || observed?.observed_agent_role !== expectedInvocation.native_id
        || !/^[a-z0-9_]+$/.test(observed?.task_name ?? '')
        || taskNames.has(observed?.task_name)
        || observed?.observed_agent_path !== `/root/${observed?.task_name}`
        || observed?.fork_turns !== 'none'
        || !nonEmpty(observed?.thread_id)
        || childThreadIds.has(observed?.thread_id)
        || rootThreadIds.has(observed?.thread_id)
        || observed?.observed_parent_thread_id !== phase.root_thread_id
        || !nonEmpty(observed?.observed_cli_version)
        || !nonEmpty(observed?.observed_model)
        || !nonEmpty(observed?.observed_model_provider)
        || observed?.observed_model !== record?.clean_environment?.model
        || observed?.observed_model_provider !== record?.clean_environment?.model_provider
        || observed?.observed_multi_agent_version !== record?.clean_environment?.multi_agent_version
        || !sameJsonValue(observed?.observed_child_result, expectedInvocation.child_result)
        || !/^[0-9a-f]{64}$/.test(observed?.session_meta_sha256 ?? '')
        || !nonEmpty(observed?.session_metadata)
      ) {
        errors.push(
          `${row.surface_id} probe_evidence phase ${expected.id} does not prove invocation ${invocationIndex + 1}`,
        );
      }
      if (nonEmpty(observed?.task_name)) taskNames.add(observed.task_name);
      if (nonEmpty(observed?.thread_id)) childThreadIds.add(observed.thread_id);
    }
  }
  if (
    !nonEmpty(evidence?.plugin_list)
    || !/^[0-9a-f]{64}$/.test(evidence?.plugin_list_sha256 ?? '')
    || !nonEmpty(evidence?.codex_version)
    || !/^[0-9a-f]{64}$/.test(evidence?.codex_version_sha256 ?? '')
  ) {
    errors.push(`${row.surface_id} probe_evidence requires SHA-256-bound plugin-list and Codex-version artifacts`);
  }
  if (evidence?.promotion_requires_raw_evidence_review !== true) {
    errors.push(`${row.surface_id} probe_evidence must require independent raw-evidence review before promotion`);
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
  if (row.host === 'codex') required.push('probe_evidence');
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
    row.host === 'codex'
    && (
      !nonEmpty(record?.clean_environment?.model)
      || !nonEmpty(record?.clean_environment?.model_provider)
      || record?.clean_environment?.multi_agent_version !== 'v2'
    )
  ) {
    errors.push(`${row.surface_id} clean environment must declare the proven Codex model, provider, and V2 backend`);
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
  if (row.host === 'codex') validateCodexProbeEvidence(record, row, errors);
  return errors;
}

async function supportContext(root, errors) {
  const inventory = await readJson(join(root, 'metadata', 'roles.json'), 'metadata/roles.json', errors);
  if (!inventory || !Array.isArray(inventory.roles)) return { inventory, sourceDigests: {} };
  const sourceDigests = {};
  for (const role of inventory.roles) {
    try {
      const projection = await readFile(join(root, 'reference', 'charters', `${role.id}.md`), 'utf8');
      const digest = projection.match(/sha256:\s*([0-9a-f]{64})/i)?.[1];
      if (!digest) throw new Error('generated projection has no canonical digest');
      sourceDigests[role.id] = digest;
    } catch (error) {
      errors.push(`packaged role projection ${String(role.id)}: ${error.message}`);
    }
  }
  return { inventory, sourceDigests };
}

async function physicalLeaves(root) {
  const leaves = [];
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const details = await lstat(absolute);
      if (details.isSymbolicLink()) {
        const targetBytes = await readlink(absolute, { encoding: 'buffer' });
        const target = targetBytes.toString('utf8');
        leaves.push({
          path,
          kind: 'symlink',
          target,
          targetIsValidUtf8: Buffer.from(target, 'utf8').equals(targetBytes),
        });
      } else if (details.isDirectory()) {
        await visit(absolute, path);
      } else if (details.isFile()) {
        leaves.push({ path, kind: 'file' });
      } else {
        leaves.push({ path, kind: 'special' });
      }
    }
  }
  await visit(root);
  return leaves.sort((left, right) => left.path.localeCompare(right.path));
}

export async function packageTreeDigest(root) {
  const entries = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) entries.push({ kind: 'file', path });
      else if (entry.isSymbolicLink()) {
        entries.push({ kind: 'symlink', path, target: await readlink(path, { encoding: 'buffer' }) });
      }
      else throw new Error(`candidate package contains unsupported filesystem entry: ${path}`);
    }
  }
  await visit(root);
  const hash = createHash('sha256');
  const records = entries.map((entry) => ({
    ...entry,
    relativePath: relative(root, entry.path).split(sep).join('/'),
  }));
  records.sort((left, right) => (
    left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0
  ));
  const updateUint64 = (value) => {
    const bytes = Buffer.allocUnsafe(8);
    bytes.writeBigUInt64BE(BigInt(value));
    hash.update(bytes);
  };
  const updateField = (value) => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
    updateUint64(bytes.length);
    hash.update(bytes);
  };
  hash.update('grove-package-tree-sha256-v2\0');
  updateUint64(records.length);
  // Canonical record: length-prefixed kind, normalized path, and raw file/link payload.
  for (const entry of records) {
    updateField(entry.kind);
    updateField(entry.relativePath);
    updateField(entry.kind === 'file' ? await readFile(entry.path) : entry.target);
  }
  return hash.digest('hex');
}

function safePackageTarget(root, path) {
  const target = resolve(root, path);
  const rel = relative(root, target);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`)) {
    throw new Error(`package path escapes or equals package root: ${path}`);
  }
  return target;
}

export async function validatePackageTree(root) {
  const packagePrefix = 'plugins/grove/';
  const errors = [];
  let allowlist;
  try {
    allowlist = JSON.parse(
      await readFile(join(root, 'metadata', 'package-allowlist.json'), 'utf8'),
    );
  } catch (error) {
    return { ok: false, errors: [`metadata/package-allowlist.json: ${error.message}`], leaves: [] };
  }
  if (allowlist?.schema_version !== 1 || !Array.isArray(allowlist.leaves)) {
    return { ok: false, errors: ['metadata/package-allowlist.json must declare schema_version 1 and leaves'], leaves: [] };
  }
  const declared = new Map();
  const caseNames = new Map();
  for (const leaf of allowlist.leaves) {
    if (
      !leaf
      || typeof leaf.path !== 'string'
      || !leaf.path.startsWith(packagePrefix)
      || !['file', 'symlink'].includes(leaf.kind)
    ) {
      errors.push(`invalid package allowlist leaf: ${JSON.stringify(leaf)}`);
      continue;
    }
    const localPath = leaf.path.slice(packagePrefix.length);
    if (!localPath || localPath.startsWith('/') || localPath.includes('\\')) {
      errors.push(`invalid repository-relative package allowlist path: ${leaf.path}`);
      continue;
    }
    if (declared.has(localPath)) errors.push(`duplicate package allowlist path: ${leaf.path}`);
    const folded = leaf.path.toLocaleLowerCase('en-US');
    if (caseNames.has(folded) && caseNames.get(folded) !== leaf.path) {
      errors.push(`case-colliding package allowlist paths: ${caseNames.get(folded)} / ${leaf.path}`);
    }
    caseNames.set(folded, leaf.path);
    declared.set(localPath, leaf);
  }
  if (!declared.has('metadata/package-allowlist.json')) {
    errors.push('package allowlist must include plugins/grove/metadata/package-allowlist.json');
  }

  const actual = await physicalLeaves(root);
  const actualByPath = new Map(actual.map((leaf) => [leaf.path, leaf]));
  const actualCaseNames = new Map();
  for (const leaf of actual) {
    const folded = leaf.path.toLocaleLowerCase('en-US');
    if (actualCaseNames.has(folded) && actualCaseNames.get(folded) !== leaf.path) {
      errors.push(`case-colliding physical package paths: ${actualCaseNames.get(folded)} / ${leaf.path}`);
    }
    actualCaseNames.set(folded, leaf.path);
    const expected = declared.get(leaf.path);
    if (!expected) {
      errors.push(`unexpected package path: ${leaf.path}`);
      continue;
    }
    if (leaf.kind !== expected.kind) {
      errors.push(`package kind mismatch at ${leaf.path}: expected ${expected.kind}, found ${leaf.kind}`);
    }
    if (leaf.kind === 'symlink') {
      if (!leaf.targetIsValidUtf8) {
        errors.push(`package symlink target is not valid UTF-8 at ${leaf.path}`);
        continue;
      }
      if (typeof expected.target !== 'string' || leaf.target !== expected.target) {
        errors.push(`package symlink target mismatch at ${leaf.path}`);
      }
      if (isAbsolute(leaf.target)) {
        errors.push(`package symlink target escapes package at ${leaf.path}: ${leaf.target}`);
      } else {
        try {
          const resolvedTarget = safePackageTarget(root, join(dirname(leaf.path), leaf.target));
          const targetPath = relative(root, resolvedTarget).split(sep).join('/');
          if (!declared.has(targetPath)) {
            errors.push(`package symlink target is not allowlisted at ${leaf.path}: ${leaf.target}`);
          }
        } catch (error) {
          errors.push(`${leaf.path}: ${error.message}`);
        }
      }
    }
  }
  for (const [path] of declared) {
    if (!actualByPath.has(path)) errors.push(`missing package path: ${path}`);
  }
  return { ok: errors.length === 0, errors, leaves: allowlist.leaves };
}

export async function assemblePackageSnapshot(root, snapshotRoot, validation = null) {
  const checked = validation ?? await validatePackageTree(root);
  if (!checked.ok) {
    throw new Error(`cannot snapshot invalid package:\n${checked.errors.join('\n')}`);
  }
  await mkdir(snapshotRoot, { recursive: true });
  for (const leaf of checked.leaves) {
    const localPath = leaf.path.slice('plugins/grove/'.length);
    const source = safePackageTarget(root, localPath);
    const destination = safePackageTarget(snapshotRoot, localPath);
    await mkdir(dirname(destination), { recursive: true });
    if (leaf.kind === 'symlink') await symlink(leaf.target, destination);
    else await copyFile(source, destination);
  }
  const snapshotValidation = await validatePackageTree(snapshotRoot);
  if (!snapshotValidation.ok) {
    throw new Error(`assembled package snapshot is invalid:\n${snapshotValidation.errors.join('\n')}`);
  }
  for (const leaf of checked.leaves) {
    const localPath = leaf.path.slice('plugins/grove/'.length);
    const source = safePackageTarget(root, localPath);
    const destination = safePackageTarget(snapshotRoot, localPath);
    if (leaf.kind === 'symlink') {
      if (await readlink(source) !== await readlink(destination)) {
        throw new Error(`snapshot symlink target differs at ${leaf.path}`);
      }
    } else {
      const [sourceBytes, snapshotBytes] = await Promise.all([readFile(source), readFile(destination)]);
      if (!sourceBytes.equals(snapshotBytes)) throw new Error(`snapshot bytes differ at ${leaf.path}`);
    }
  }
  return { root: snapshotRoot, leaves: checked.leaves };
}

export async function validateReleaseTree(root, {
  release = false,
  docs = [],
  allowIncomplete = false,
  hostDiscoveryContract = null,
} = {}) {
  const errors = [];
  let snapshotWorkspace = null;
  let exactPackageTreeSha256 = null;
  if (!allowIncomplete || await exists(join(root, 'metadata', 'package-allowlist.json'))) {
    const packageValidation = await validatePackageTree(root);
    if (!packageValidation.ok) {
      return { ok: false, version: null, errors: packageValidation.errors };
    }
    snapshotWorkspace = await mkdtemp(join(tmpdir(), 'grove-package-snapshot-'));
    const snapshotRoot = join(snapshotWorkspace, 'grove');
    await assemblePackageSnapshot(root, snapshotRoot, packageValidation);
    exactPackageTreeSha256 = await packageTreeDigest(snapshotRoot);
    root = snapshotRoot;
  }
  if (hostDiscoveryContract == null) {
    if (release) errors.push('host discovery contract is required for release validation');
  } else {
    errors.push(...await validateHostDiscoveryContract(hostDiscoveryContract, {
      release,
      expectedPackageTreeSha256: exactPackageTreeSha256,
    }));
  }
  let version = null;
  try {
    version = validateVersionText(await readFile(join(root, 'VERSION'), 'utf8'));
  } catch (error) {
    if (!allowIncomplete) errors.push(`VERSION: ${error.message}`);
  }

  const claude = await readJson(join(root, '.claude-plugin', 'plugin.json'), '.claude-plugin/plugin.json', errors);
  const codex = await readJson(join(root, '.codex-plugin', 'plugin.json'), '.codex-plugin/plugin.json', errors);
  const surfaces = await readJson(join(root, 'metadata', 'surfaces.json'), 'metadata/surfaces.json', errors);
  const hostDeclarations = allowIncomplete
    ? null
    : await readJson(join(root, 'metadata', 'hosts.json'), 'metadata/hosts.json', errors);
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
      errors.push(`metadata/surfaces.json version ${String(surfaces.version)} differs from VERSION ${version}`);
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
  if (!allowIncomplete || await exists(join(root, 'metadata', 'legacy-ownership.json'))) {
    const [legacy, roleInventory, lifecycleInventory, claudeInventory, codexInventory] = await Promise.all([
      readJson(join(root, 'metadata', 'legacy-ownership.json'), 'metadata/legacy-ownership.json', errors),
      readJson(join(root, 'metadata', 'roles.json'), 'metadata/roles.json', errors),
      readJson(join(root, 'metadata', 'lifecycle-inventory.json'), 'metadata/lifecycle-inventory.json', errors),
      readJson(join(root, 'metadata', 'claude-inventory.json'), 'metadata/claude-inventory.json', errors),
      readJson(join(root, 'metadata', 'codex-inventory.json'), 'metadata/codex-inventory.json', errors),
    ]);
    if (legacy) errors.push(...validateLegacyOwnershipInventory(legacy));
    if (roleInventory && lifecycleInventory && claudeInventory) {
      if (version) errors.push(...validateClaudeManifest(claude, version, claudeInventory));
      errors.push(...validateHostInventory(claudeInventory, {
        host: 'claude',
        roleInventory,
        lifecycleInventory,
      }));
    }
    if (roleInventory && lifecycleInventory && codexInventory) {
      errors.push(...validateHostInventory(codexInventory, {
        host: 'codex',
        roleInventory,
        lifecycleInventory,
      }));
    }
  }

  for (const path of await findCustomAgentToml(root)) errors.push(`Codex plugin contains custom-agent TOML: ${path}`);
  if (snapshotWorkspace) await rm(snapshotWorkspace, { recursive: true, force: true });
  return { ok: errors.length === 0, version, errors };
}
