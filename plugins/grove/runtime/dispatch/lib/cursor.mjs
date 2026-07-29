// Run cursor contract (spec-0006 §Run cursor contract; INV7, INV8's minimal
// aborted shape). Parse, validate, and serialize the committed per-run TOML
// cursor at .grove/runs/<run-id>/cursor.toml. "Well-formed" throughout means
// parseable AND schema-valid.
import { parseTomlDocument, stringifyTomlDocument } from './parsers.mjs';

export const RUN_ID = /^[0-9]{8}-[0-9]{6}-[a-z0-9][a-z0-9-]*$/;
const STATUSES = Object.freeze(['open', 'closed', 'aborted']);
// `claims` is schema-RESERVED: written by no current path, reported by the
// guard as a schema defect when present — but its presence is a defect on a
// parseable cursor, never a parse failure (spec-0006 §Defect handling row 1).
const DECLARED_KEYS = Object.freeze([
  'schema', 'run', 'opened', 'intent', 'subjects', 'status', 'closed', 'reason',
  'claims',
]);

// THE single status-line grammar, RE-DERIVED FROM TOML (adr-0048). Its former
// derivation was "from toml.mjs's line handling, mechanism by mechanism" — and
// that basis is gone: the reader is a conforming TOML parser now, so the legal
// spellings are the FORMAT's.
//
// This probe exists for exactly one situation: a cursor that FAILED to parse.
// The library cannot help there, so the probe is a deliberately narrow textual
// heuristic over the two single-line string forms TOML gives a scalar:
//   status | "status" | 'status'   -> bare, basic-quoted, and literal-quoted keys
//   "open" | 'open'                -> basic and literal string values
//   surrounding whitespace, a trailing #-comment, an optional trailing \r
// Everything else a conforming reader would accept — multi-line strings,
// escape-spelled values — is deliberately NOT read here, because resolving an
// escape inside a file that does not parse is guesswork. Those spellings come
// back `null`, which every caller reads as "unreadable", which is "open".
// FAIL CLOSED IS THE WHOLE DESIGN: an unreadable status keeps the session in
// supervisor mode and blocks a second open cursor.
//
// It is no longer shared with the close/abort edit. That edit is a
// read-modify-write through the parsed DOCUMENT now (INV8 v3: fields, not
// bytes), so it has no grammar to diverge from — which is what removed the
// wedge where six legal spellings were schema-valid, open, and un-editable.
export function statusLinePattern(status, flags = '') {
  return new RegExp(
    `^\\s*(?:status|"status"|'status')\\s*=\\s*(?:"${status}"|'${status}')\\s*(?:#.*)?\\r?$`,
    flags,
  );
}

// THE table-header grammar, RE-DERIVED FROM TOML the same way. Every cursor key
// the schema declares lives in the ROOT table, and in TOML the root table is
// exactly the lines BEFORE the first table header — `[table]` or
// `[[array-of-tables]]`. A line whose first non-space character is `[` opens
// one. (A leading `[` can also begin an array VALUE, but only after `key =`,
// which this anchors against by requiring `[` to lead the line.)
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
  // WIDENED with adr-0048, and the reason is worth stating because it is a
  // property that used to hold BY ACCIDENT. The hand-rolled reader accepted
  // only \" \\ \n \t as escapes, so any other control character failed the
  // pre-write round-trip probe and never reached a cursor. Real TOML has
  // \uXXXX, so a conforming writer/reader pair round-trips ESC, NUL and the
  // rest perfectly — the probe is working, and the incidental guard is gone.
  //
  // The guard is kept, moved to where it belongs: this is grove's own declared
  // field contract over a borrowed format, which is the "keep, hand-written"
  // side of adr-0048 D1. `intent` and `reason` are rendered into one-line
  // operator reports, and a raw ESC in a value the guard prints is a terminal
  // control sequence in someone's console.
  const control = value.match(/[\u0000-\u001f\u007f]/);
  if (control) {
    return `${field} must be one line; it contains the control character `
      + `U+${control[0].charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}`;
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
  // Same widening, same reason as oneLineFailure above: the old parser's narrow
  // escape set rejected a control character in a subject path as a side effect
  // of its round-trip probe, and a conforming parser round-trips it fine. Every
  // subject is printed in the guard's stderr report.
  const control = subject.match(/[\u0000-\u001f\u007f]/);
  if (control) {
    return `subject ${JSON.stringify(subject)} contains the control character `
      + `U+${control[0].charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}; subjects are printable repo-relative file paths`;
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
    root = parseTomlDocument(text);
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

// Serialization goes through the library too (adr-0048 D3: every hand-rolled
// WRITER of an external format is replaced, not only the readers). The declared
// key order is preserved by insertion order; the visible byte change from the
// hand-rolled writer is the array form, `[ "a.md" ]` rather than `["a.md"]`,
// which is the library's spacing and not grove's to choose.
export function serializeCursor(cursor) {
  const document = { schema: cursor.schema, run: String(cursor.run) };
  if (cursor.opened != null) document.opened = String(cursor.opened);
  if (cursor.intent != null) document.intent = String(cursor.intent);
  if (cursor.subjects != null) document.subjects = cursor.subjects.map(String);
  document.status = String(cursor.status);
  if (cursor.closed != null) document.closed = String(cursor.closed);
  if (cursor.reason != null) document.reason = String(cursor.reason);
  return stringifyTomlDocument(document);
}

// THE close/abort write (INV8 as clarified at v3: the invariant constrains
// which FIELDS change, not which bytes). Read the parsed document, set exactly
// the named fields, re-serialize the whole thing.
//
// This REPLACES a surgical line edit rather than widening it (adr-0048 D3). The
// line edit's tolerance was documented as derived from the old reader "mechanism
// by mechanism", and that derivation could not survive its basis: a line regex
// is not derivable from full TOML at all, because a legal value spans lines and
// a legal key may be quoted. Six measured spellings were schema-valid, open, and
// un-editable, leaving a run unclosable AND unabortable — INV8's whole-file
// exception is deliberately unreachable on a well-formed cursor. Rewriting
// through the document removes the regex and the whole class with it.
//
// EVERY other key survives, including a `claims` key already present: `claims`
// is schema-reserved and its presence is a defect on a parseable cursor, never
// a parse failure, so dropping it here would violate INV8's immutability while
// looking like it only wrote `status`. Root scalars are emitted before tables by
// the library, which is what the old edit had to arrange by hand.
export function rewriteCursorFields(document, changes) {
  const next = { ...document };
  for (const [key, value] of Object.entries(changes)) next[key] = value;
  return stringifyTomlDocument(next);
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
