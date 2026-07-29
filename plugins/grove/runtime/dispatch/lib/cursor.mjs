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

// THE table-header grammar, derived from toml.mjs the same way the status-line
// pattern above is — mechanism by mechanism, never from an example list:
//   stripComment() then .trim()   -> leading whitespace, and a trailing comment
//   /^\[\[([^\]]+)\]\]$/          -> an array-of-tables header; every key AFTER
//                                    it belongs to that table, not the root
//   line.startsWith('[') -> throw -> any other '[' line is unparseable
// Every cursor key the schema declares lives in the ROOT table, so the root
// table is exactly the lines BEFORE the first line matching this. A reader
// that appends a key without honouring the boundary writes it into the last
// table instead of the root — which is how a field edit on a cursor carrying
// a `[[claims]]` table produced a schema-invalid result.
export const TABLE_HEADER_LINE = /^\s*\[/;

// Exactly one readable ROOT-TABLE status line -> that status; anything else
// (none, several, an out-of-enum value) is unreadable = null. Fail closed at
// the call sites: an unreadable status is open for mode selection.
//
// The root-table bound is the whole point, and its absence was the READ twin
// of the cursor-EDIT bug fixed one round earlier: this probe scanned the whole
// file, so a cursor whose ROOT carries no `status` at all but which contains
// `status = "closed"` inside a `[[claims]]` table answered "closed". Both
// callers run this ONLY on a cursor that already failed parseCursor, and both
// read a non-open answer as "not open" — so the smuggled value took the Stop
// hook out of supervisor mode into non-holding observer mode, and let open-run
// admit a second cursor beside the malformed one. Scanning stops at the first
// TABLE_HEADER_LINE, which is where editCursorText already stops; one grammar,
// both directions.
export function probeStatus(text) {
  const pattern = statusLinePattern('(open|closed|aborted)');
  const found = [];
  for (const line of String(text).split('\n')) {
    if (TABLE_HEADER_LINE.test(line)) break;
    const match = line.match(pattern);
    if (match) found.push(match[1]);
  }
  return found.length === 1 ? found[0] : null;
}

// THE cursor's declared field contracts, in one place, enforced on BOTH sides
// — parseCursor when a cursor is read, and every planner before one is
// written. They were previously enforced on neither: each site checked only
// "a non-empty string", so `opened = "not-a-time"`, a whitespace-only
// timestamp, and a multi-line `intent` all planned, committed, and read back
// clean, and the committed audit boundary said something the spec's §Run
// cursor contract does not allow. Same mechanism each time — a declared
// contract with no enforcing code — so the contracts live here rather than at
// the call sites that happened to be reviewed.

// `opened`/`closed` are declared "RFC 3339 UTC" (§Run cursor contract). Closed
// deliberately to the UTC `Z` spelling: an offset form would make two
// spellings of one instant compare unequal as strings, and the cursor compares
// them as strings. Leap seconds (`:60`) are rejected — a narrowing of RFC 3339
// stated rather than hidden, matching the run id's wall-clock instant.
export const RFC3339_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;

export function timestampFailure(field, value) {
  const match = typeof value === 'string' ? RFC3339_UTC.exec(value) : null;
  if (match == null) {
    return `${field} ${JSON.stringify(value)} is not an RFC 3339 UTC instant `
      + '(YYYY-MM-DDThh:mm:ss[.fff]Z)';
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    return `${field} ${JSON.stringify(value)} names no real instant`;
  }
  // The grammar plus Date.parse is NOT enough, measured: Date rolls an
  // impossible day over instead of rejecting it (2026-02-30 -> March 2;
  // 2026-02-29, a non-leap year, -> March 1) while it does reject an
  // out-of-range hour or minute. So the parsed instant must SPELL BACK the
  // calendar date that was written.
  const [, year, month, day] = match;
  if (
    instant.getUTCFullYear() !== Number(year)
    || instant.getUTCMonth() + 1 !== Number(month)
    || instant.getUTCDate() !== Number(day)
  ) {
    return `${field} ${JSON.stringify(value)} names no such calendar date`;
  }
  return null;
}

// `intent` and `reason` are both declared "one line". A line break survives
// the round trip intact — JSON.stringify escapes it and the parser decodes it
// again — so nothing downstream catches it; only a check here does. CR counts:
// the abort planner tested `\n` alone, and a lone CR still breaks a one-line
// report just as a LF does.
export function oneLineFailure(field, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return `${field} must be a non-empty one-line string`;
  }
  if (/[\r\n]/.test(value)) {
    return `${field} must be one line; it contains a line break`;
  }
  return null;
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

// §Run cursor contract: the run id is "UTC `YYYYMMDD-HHMMSS` open moment plus
// a slug", and `opened` is its "deliberate duplicate of the run-id instant".
// Validated in isolation, each field passed while the pair disagreed, so a
// cursor could claim to open at two different moments — and an impossible date
// carried only in the run id was never checked at all, because nothing parsed
// that prefix as a date. Comparing the two enforces both: the prefix must equal
// an `opened` that has already passed the calendar spell-back.
export function runInstantMismatch(runId, opened) {
  const instant = RFC3339_UTC.exec(String(opened));
  if (instant == null) return null; // timestampFailure reports this
  const [, year, month, day, hour, minute, second] = instant;
  const expected = `${year}${month}${day}-${hour}${minute}${second}`;
  const prefix = String(runId).slice(0, expected.length);
  if (prefix !== expected) {
    return `run id ${JSON.stringify(runId)} opens at ${prefix}, but opened is `
      + `${JSON.stringify(opened)} (${expected}); the run-id prefix IS the open moment`;
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
    const openedInvalid = timestampFailure('opened', root.opened);
    if (openedInvalid) return { ok: false, reason: openedInvalid };
    const intentInvalid = oneLineFailure('intent', root.intent);
    if (intentInvalid) return { ok: false, reason: intentInvalid };
    const instantMismatch = runInstantMismatch(root.run, root.opened);
    if (instantMismatch) return { ok: false, reason: instantMismatch };
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
    const closedInvalid = timestampFailure('closed', root.closed);
    if (closedInvalid) return { ok: false, reason: closedInvalid };
    if (root.status === 'aborted') {
      if (typeof root.reason !== 'string' || root.reason === '') {
        return { ok: false, reason: 'aborted cursor requires a one-line reason' };
      }
      const reasonInvalid = oneLineFailure('reason', root.reason);
      if (reasonInvalid) return { ok: false, reason: reasonInvalid };
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
// shape — schema-valid by construction, never a standing defect. "By
// construction" has to mean it: this checks all THREE fields it writes, not
// just the run id it happened to check. It is exported, so a planner's gate is
// not its gate, and the whole point of this shape is that the file it replaces
// was already a defect — producing a second one here would leave the run with
// no exit at all.
export function minimalAbortedCursor({ runId, closed, reason }) {
  if (!RUN_ID.test(String(runId))) {
    throw new Error(`minimal aborted cursor requires a grammatical run id, got ${JSON.stringify(runId)}`);
  }
  for (const failure of [timestampFailure('closed', closed), oneLineFailure('reason', reason)]) {
    if (failure) throw new Error(`minimal aborted cursor requires ${failure}`);
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
