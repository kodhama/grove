// Guard core (spec-0006 §The guard, §Transition rules; INV11, INV16).
// Deterministic and zero-model: Node, filesystem and git only — no model
// call, no network, and NO writes. Pure computation over explicit inputs
// where possible; git and the filesystem are read through child_process and
// fs reads only.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { parseToml } from './toml.mjs';
import { RECORD_TYPES } from './transitions.mjs';

const execFileAsync = promisify(execFile);

// The empty-input SHA-256 sentinel (spec-0006 §Verdict-record contract):
// equals a zero-byte file's digest by construction, and that coincidence
// decides nothing — subject_state, not the digest, separates absence from a
// present empty file.
export const EMPTY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export const RECORD_FILENAME = /^[a-z0-9][a-z0-9.-]*\.toml$/;

const RECORD_KEYS = Object.freeze([
  'schema', 'record_type', 'subject', 'subject_state', 'subject_sha256',
  'verdict', 'by', 'date',
]);
const SHA256_HEX = /^[0-9a-f]{64}$/;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

// --- subject classification (deterministic, frontmatter-derived) ---
//
// "Artifact frontmatter present" is read fail-closed as: the file begins with
// a `---` YAML frontmatter block. A frontmatter-bearing file whose `type` is
// absent or outside the known enum classifies `unclaimed` and owes the full
// set — deterministic classification beats charitable coverage.
export function classifyContent(content) {
  if (content == null) return { classes: ['missing'], base: 'missing', implementsBearing: false };
  const text = String(content);
  const frontmatter = readFrontmatter(text);
  if (frontmatter == null) {
    return { classes: ['code'], base: 'code', implementsBearing: false };
  }
  const type = frontmatter.get('type');
  let base;
  if (type === 'adr') base = 'decision';
  else if (type === 'spec') base = 'spec';
  else if (type === 'charter') base = 'charter';
  else if (type === 'research' || type === 'feedback') base = 'reviewless';
  else base = 'unclaimed';
  const implementsValue = frontmatter.get('implements');
  const implementsBearing = typeof implementsValue === 'string'
    && implementsValue.trim() !== ''
    && implementsValue.trim() !== '[]';
  const classes = implementsBearing ? [base, 'implements-bearing'] : [base];
  return { classes, base, implementsBearing };
}

function readFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) return null;
  const lines = text.split(/\r?\n/);
  const fields = new Map();
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '---') return fields;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match && !fields.has(match[1])) fields.set(match[1], match[2].trim());
  }
  return null; // unterminated frontmatter is not frontmatter
}

// --- derived change set (one definition, both modes) ---
//
// Uncommitted changes plus commits not on the merge-base with the default
// branch, resolved as origin/HEAD when set and the local main otherwise; if
// neither resolves this throws a guard-internal error (CLI exit 1) rather
// than guessing.
export async function deriveChangeSet({ repoRoot }) {
  const base = await resolveBase(repoRoot);
  const paths = new Set();
  const mergeBase = (await git(repoRoot, ['merge-base', 'HEAD', base])).trim();
  for (const line of (await git(repoRoot, [
    'diff', '--name-only', '--no-renames', mergeBase, 'HEAD',
  ])).split('\n')) {
    if (line.trim() !== '') paths.add(line.trim());
  }
  for (const line of (await git(repoRoot, ['status', '--porcelain'])).split('\n')) {
    if (line.trim() === '') continue;
    const entry = line.slice(3);
    for (const half of entry.split(' -> ')) {
      const path = half.trim().replace(/^"|"$/g, '');
      if (path !== '') paths.add(path);
    }
  }
  return paths;
}

async function resolveBase(repoRoot) {
  try {
    await git(repoRoot, ['rev-parse', '--verify', '--quiet', 'origin/HEAD']);
    return 'origin/HEAD';
  } catch {
    // fall through to local main
  }
  try {
    await git(repoRoot, ['rev-parse', '--verify', '--quiet', 'refs/heads/main']);
    return 'main';
  } catch {
    throw guardInternal(
      'cannot derive the change set: neither origin/HEAD nor a local main resolves',
    );
  }
}

async function git(repoRoot, args) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repoRoot, ...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    throw guardInternal(`git ${args.join(' ')} failed: ${error.message}`);
  }
}

function guardInternal(message) {
  const error = new Error(message);
  error.guardInternal = true;
  return error;
}

// --- verdict records ---
//
// Schema validity beyond the spec-named fields is under-enumerated upstream
// ("otherwise unparseable"); this validation fails CLOSED — exactly the
// eight named fields, correct enumerations and shapes, no undeclared keys.
// A record failing any of it is a defect and satisfies no predicate.
// (Disclosed concretization — spec-0006 bounce candidate.)
export function validateRecord(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reason: 'record is not a table' };
  }
  for (const key of Object.keys(value)) {
    if (!RECORD_KEYS.includes(key)) {
      return { ok: false, reason: `undeclared record key "${key}"` };
    }
  }
  if (value.schema !== 1) return { ok: false, reason: 'record schema must be 1' };
  if (!RECORD_TYPES.includes(value.record_type)) {
    return {
      ok: false,
      reason: `record_type ${JSON.stringify(value.record_type)} is outside the enumerated types`,
    };
  }
  if (typeof value.subject !== 'string' || value.subject === '') {
    return { ok: false, reason: 'record requires a subject path' };
  }
  if (value.subject_state !== 'present' && value.subject_state !== 'absent') {
    return { ok: false, reason: 'record requires subject_state present|absent' };
  }
  if (typeof value.subject_sha256 !== 'string' || !SHA256_HEX.test(value.subject_sha256)) {
    return { ok: false, reason: 'record requires a hex subject_sha256' };
  }
  if (value.subject_state === 'absent' && value.subject_sha256 !== EMPTY_SHA256) {
    return { ok: false, reason: 'an absence record carries the empty-input sentinel digest' };
  }
  for (const key of ['verdict', 'by', 'date']) {
    if (typeof value[key] !== 'string' || value[key] === '') {
      return { ok: false, reason: `record requires ${key}` };
    }
  }
  return { ok: true };
}

// A record counts for a subject only while all three bind: its own `subject`
// field names the subject's path, its subject_state matches the subject's
// current state, and — for present — its digest matches the current bytes
// (INV11; the subject binding is load-bearing, not bookkeeping).
export function recordSatisfies({ record, subject, state, sha256: digest }) {
  if (validateRecord(record).ok !== true) return false;
  if (record.subject !== subject) return false;
  if (record.subject_state !== state) return false;
  if (state === 'present' && record.subject_sha256 !== digest) return false;
  return true;
}

// Record lookup spans EVERY run's records directory — the per-run directory
// is a write-home, never a read-boundary; closed and aborted runs included.
export async function collectRecords({ repoRoot }) {
  const runsRoot = join(repoRoot, '.grove', 'runs');
  const records = [];
  const defects = [];
  let runs;
  try {
    runs = (await readdir(runsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') return { records, defects };
    throw error;
  }
  for (const run of runs) {
    const recordsDir = join(runsRoot, run, 'records');
    let entries;
    try {
      entries = (await readdir(recordsDir, { withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort();
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const name of entries) {
      const relative = `.grove/runs/${run}/records/${name}`;
      if (!RECORD_FILENAME.test(name)) {
        defects.push({ path: relative, reason: 'record filename fails the filename grammar' });
        continue;
      }
      let parsed;
      try {
        parsed = parseToml(await readFile(join(recordsDir, name), 'utf8'));
      } catch (error) {
        defects.push({ path: relative, reason: `unparseable record: ${error.message}` });
        continue;
      }
      const validity = validateRecord(parsed);
      if (!validity.ok) {
        defects.push({ path: relative, reason: validity.reason });
        continue;
      }
      records.push({ path: relative, record: parsed });
    }
  }
  return { records, defects };
}

// --- subject binding ---

export async function bindSubject({ repoRoot, path, changeSet }) {
  let content = null;
  try {
    content = await readFile(join(repoRoot, path), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error;
  }
  const classification = classifyContent(content);
  return {
    path,
    state: content == null ? 'absent' : 'present',
    sha256: content == null ? null : sha256(content),
    classes: classification.classes,
    changed: changeSet.has(path),
  };
}

// --- enabled-and-unfired (owed work: computed, stored nowhere) ---

export function computeEnabled({ transitions, subjects, records }) {
  const enabled = [];
  const recordValues = records.map((item) => (item.record ? item.record : item));
  for (const transition of transitions) {
    for (const subject of subjects) {
      let missingRecordType = null;
      const holds = transition.preconditions.every((predicate) => {
        if (predicate.form === 'changed') {
          return subject.changed
            && subject.classes.some((cls) => predicate.classes.includes(cls));
        }
        const satisfied = recordValues.some((candidate) => recordSatisfies({
          record: candidate,
          subject: subject.path,
          state: subject.state,
          sha256: subject.sha256,
        }) && candidate.record_type === predicate.recordType);
        if (predicate.form === 'record') return satisfied;
        if (predicate.form === 'no-record') {
          if (!satisfied) missingRecordType = predicate.recordType;
          return !satisfied;
        }
        return false;
      });
      if (holds) {
        enabled.push({
          id: transition.id,
          subject: subject.path,
          missingRecordType,
          fire: transition.fire,
        });
      }
    }
  }
  return enabled;
}
