// Run cursor contract (spec-0006 §Run cursor contract; INV7, INV8's minimal
// aborted shape). Parse, validate, and serialize the committed per-run TOML
// cursor at .grove/runs/<run-id>/cursor.toml. "Well-formed" throughout means
// parseable AND schema-valid.
import { parseToml } from './toml.mjs';

export const RUN_ID = /^[0-9]{8}-[0-9]{6}-[a-z0-9][a-z0-9-]*$/;
const STATUSES = Object.freeze(['open', 'closed', 'aborted']);
// `claims` is schema-RESERVED: written by no current path, reported by the
// guard as a schema defect when present — but its presence is a defect on a
// parseable cursor, never a parse failure (spec-0006 §Defect handling row 1).
const DECLARED_KEYS = Object.freeze([
  'schema', 'run', 'opened', 'intent', 'subjects', 'status', 'closed', 'reason',
  'claims',
]);

// THE single status-line grammar. Its tolerance is DERIVED FROM toml.mjs's
// line handling, mechanism by mechanism — never from an example list:
//   split(/\r?\n/)            -> an optional trailing \r on every line
//   stripComment()            -> a #-comment to end of line, outside strings
//   .trim() after that        -> leading AND trailing whitespace
//   line.slice(0, eq).trim()  -> whitespace between the key and '='
//   line.slice(eq + 1).trim() -> whitespace between '=' and the value
// Every reader of a status line (the close/abort field edit, the two
// status-unreadable probes) uses this one source so they cannot diverge.
export function statusLinePattern(status, flags = '') {
  return new RegExp(
    `^\\s*status\\s*=\\s*"${status}"\\s*(?:#.*)?\\r?$`,
    flags,
  );
}

// Exactly one readable status line -> that status; anything else (none,
// several, an out-of-enum value) is unreadable = null. Fail closed at the
// call sites: an unreadable status is open for mode selection.
export function probeStatus(text) {
  const pattern = statusLinePattern('(open|closed|aborted)');
  const found = [];
  for (const line of String(text).split('\n')) {
    const match = line.match(pattern);
    if (match) found.push(match[1]);
  }
  return found.length === 1 ? found[0] : null;
}

// A cursor subject is a repo-relative file path: never absolute, never a
// traversal, never backslashed. Enforced at cursor validation AND at
// open-run planning, always naming the offending subject.
export function validateSubjectPath(subject) {
  if (typeof subject !== 'string' || subject === '') {
    return `subject ${JSON.stringify(subject)} is not a non-empty repo-relative file path`;
  }
  if (subject.startsWith('/')) {
    return `subject ${JSON.stringify(subject)} is absolute; subjects are repo-relative file paths`;
  }
  if (subject.includes('\\')) {
    return `subject ${JSON.stringify(subject)} contains a backslash; subjects use forward slashes`;
  }
  if (subject.split('/').some((segment) => segment === '..')) {
    return `subject ${JSON.stringify(subject)} contains a ".." segment; subjects never traverse`;
  }
  // Canonical form, derived from what git emits for the change set: no "."
  // segments (leading "./" or internal "/./") and no empty segments ("//"
  // or a trailing "/"). A non-canonical subject can never equal a
  // change-set path, so its owed work would silently never enable.
  if (subject.split('/').some((segment) => segment === '' || segment === '.')) {
    return `subject ${JSON.stringify(subject)} is not in canonical repo-relative form (no "./", "/./", "//", or trailing "/")`;
  }
  return null;
}

export function parseCursor(text, { runId } = {}) {
  let root;
  try {
    root = parseToml(text);
  } catch (error) {
    return { ok: false, reason: `unparseable cursor: ${error.message}` };
  }
  for (const key of Object.keys(root)) {
    if (!DECLARED_KEYS.includes(key)) {
      return { ok: false, reason: `undeclared cursor key "${key}"` };
    }
  }
  if (root.schema !== 1) {
    return { ok: false, reason: `cursor schema must be 1, found ${JSON.stringify(root.schema)}` };
  }
  if (typeof root.run !== 'string' || !RUN_ID.test(root.run)) {
    return { ok: false, reason: `cursor run id ${JSON.stringify(root.run)} fails the run-id grammar` };
  }
  if (runId != null && root.run !== runId) {
    return { ok: false, reason: `cursor run "${root.run}" does not equal its directory name "${runId}"` };
  }
  if (!STATUSES.includes(root.status)) {
    return { ok: false, reason: `cursor status ${JSON.stringify(root.status)} is not open|closed|aborted` };
  }
  if (root.status === 'open') {
    for (const key of ['opened', 'intent']) {
      if (typeof root[key] !== 'string' || root[key] === '') {
        return { ok: false, reason: `open cursor requires ${key}` };
      }
    }
    if (!Array.isArray(root.subjects)) {
      return { ok: false, reason: 'open cursor requires subjects as repo-relative file paths' };
    }
    for (const item of root.subjects) {
      const invalid = validateSubjectPath(item);
      if (invalid) return { ok: false, reason: invalid };
    }
    if (root.closed !== undefined || root.reason !== undefined) {
      return { ok: false, reason: 'closed/reason are present only when status != open' };
    }
  } else {
    if (typeof root.closed !== 'string' || root.closed === '') {
      return { ok: false, reason: `${root.status} cursor requires a closed timestamp` };
    }
    if (root.status === 'aborted') {
      if (typeof root.reason !== 'string' || root.reason === '') {
        return { ok: false, reason: 'aborted cursor requires a one-line reason' };
      }
    } else if (root.reason !== undefined) {
      return { ok: false, reason: 'reason is present only when status = aborted' };
    }
    if (root.subjects !== undefined) {
      if (!Array.isArray(root.subjects)) {
        return { ok: false, reason: 'subjects, when present, must be repo-relative file paths' };
      }
      for (const item of root.subjects) {
        const invalid = validateSubjectPath(item);
        if (invalid) return { ok: false, reason: invalid };
      }
    }
  }
  return {
    ok: true,
    cursor: root,
    claimsPresent: Object.prototype.hasOwnProperty.call(root, 'claims'),
  };
}

export function serializeCursor(cursor) {
  const lines = [`schema = ${cursor.schema}`, `run = ${quote(cursor.run)}`];
  if (cursor.opened != null) lines.push(`opened = ${quote(cursor.opened)}`);
  if (cursor.intent != null) lines.push(`intent = ${quote(cursor.intent)}`);
  if (cursor.subjects != null) {
    lines.push(`subjects = [${cursor.subjects.map(quote).join(', ')}]`);
  }
  lines.push(`status = ${quote(cursor.status)}`);
  if (cursor.closed != null) lines.push(`closed = ${quote(cursor.closed)}`);
  if (cursor.reason != null) lines.push(`reason = ${quote(cursor.reason)}`);
  return `${lines.join('\n')}\n`;
}

// INV8's one named exception: a confirmed abort-run on an unparseable or
// schema-invalid cursor replaces the file WHOLE with this minimal aborted
// shape — schema-valid by construction, never a standing defect.
export function minimalAbortedCursor({ runId, closed, reason }) {
  if (!RUN_ID.test(String(runId))) {
    throw new Error(`minimal aborted cursor requires a grammatical run id, got ${JSON.stringify(runId)}`);
  }
  return serializeCursor({
    schema: 1,
    run: runId,
    status: 'aborted',
    closed,
    reason,
  });
}

function quote(value) {
  return JSON.stringify(String(value));
}
