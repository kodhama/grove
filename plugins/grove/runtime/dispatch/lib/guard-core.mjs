// Guard core (spec-0006 §The guard, §Transition rules; INV11, INV16).
// Deterministic and zero-model: Node, filesystem and git only — no model
// call, no network, and NO writes. Pure computation over explicit inputs
// where possible; git and the filesystem are read through child_process and
// fs reads only.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readFile, readdir, readlink, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { parseTomlDocument, parseYamlDocument } from './parsers.mjs';
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

// Bytes become text in exactly one way on the classification path: a FATAL
// decode. Buffer.toString('utf8') silently replaces malformed bytes with
// U+FFFD, so a file carrying byte 0xff in a comment or an unread value
// decoded to a well-formed document and classified by its `type` — reaching
// `reviewless`, which owes nothing and is observer-invisible — while a
// conforming YAML reader rejects the stream outright. Returns null when the
// bytes are not valid UTF-8; every caller maps null to the fail-closed
// outcome for its own path.
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true });
export function decodeUtf8Strict(bytes) {
  try {
    return UTF8_STRICT.decode(bytes);
  } catch {
    return null;
  }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

// --- subject classification (deterministic, frontmatter-derived) ---
//
// "Artifact frontmatter present" is read fail-closed as: the file begins with
// a `---` YAML frontmatter block. A frontmatter-bearing file whose `type` is
// absent or outside the known enum classifies `unclaimed` and owes the full
// set — deterministic classification beats charitable coverage.
//
// The reading that matters, and the one this code got wrong: OPENING a block
// is what makes a file frontmatter-bearing. Whether it CLOSES the block is
// exactly the malformed-input case the fail-closed rule exists for. Every
// malformed-block shape used to fall through to `code`, which owes 2 records
// instead of `unclaimed`'s 4 AND is not in the guard's observer-mode class
// set at all — so in observer mode a truncated artifact was not merely
// under-reviewed, it was never looked at. readFrontmatter therefore reports
// THREE outcomes, not two: no block (genuinely code), a malformed block
// (unclaimed), and a complete block (classified by its `type`).
export function classifyContent(content) {
  if (content == null) return { classes: ['missing'], base: 'missing', implementsBearing: false };
  const text = String(content);
  const frontmatter = readFrontmatter(text);
  if (frontmatter.kind === 'none') {
    return { classes: ['code'], base: 'code', implementsBearing: false };
  }
  if (frontmatter.kind === 'malformed') {
    // A block was opened and something is wrong with it. Never `code`.
    return { classes: ['unclaimed'], base: 'unclaimed', implementsBearing: false };
  }
  const type = frontmatter.fields.get('type');
  let base;
  if (type === 'adr') base = 'decision';
  else if (type === 'spec') base = 'spec';
  else if (type === 'charter') base = 'charter';
  else if (type === 'research' || type === 'feedback') base = 'reviewless';
  else base = 'unclaimed';
  // UNCHANGED by the v3 amendment, which says so explicitly: "This amendment
  // does not change the `implements-bearing` row. Its non-empty test stands as
  // written, applied now only to the values the schema clause admits." Those
  // values are exactly a string or an array of strings — every other spelling
  // was already refused above and took the whole document to `unclaimed` — so
  // the two branches below are the complete case analysis, and no trim or
  // string comparison is needed to reach it.
  const implementsValue = frontmatter.fields.get('implements');
  const implementsBearing = Array.isArray(implementsValue)
    ? implementsValue.length > 0
    : typeof implementsValue === 'string' && implementsValue !== '';
  const classes = implementsBearing ? [base, 'implements-bearing'] : [base];
  return { classes, base, implementsBearing };
}

// ============================================================================
// FRONTMATTER: GROVE'S DELIMITER, THE LIBRARY'S DOCUMENT
// ============================================================================
// spec-0006 §Frontmatter reading (v3), INV16's parse clause and INV28;
// adr-0048 D1/D3/D6/D7. What stood here was a ~270-line hand-rolled YAML
// grammar — a closed whitelist of line and value forms that converged over
// eight rounds of review. It is gone, and the replacement is the boundary the
// spec draws rather than a smaller version of the same thing:
//
//   THE DELIMITER IS GROVE'S. Whether a file bears artifact frontmatter is
//   decided by the `---` block convention below, hand-written, on the RAW
//   lines. This is a boundary, not an exception: the block convention is a
//   format grove defines, and only the document between the delimiters is a
//   format it borrows. Measured basis (adr-0048 D3): handing the delimiter to
//   the parser too regressed EIGHT inputs — byte-order-mark-prefixed, padded
//   `--- `, unterminated — from `unclaimed` into `code`, which owes 2 records
//   instead of 4 and is not in the guard's observer-mode class set at all.
//   Under-owing AND invisible, which is the one direction fail-closed typing
//   exists to prevent.
//
//   THE DOCUMENT IS YAML 1.2, CORE SCHEMA, read by the bundled parser. The
//   version is named in the spec because four measured inputs classify
//   differently under 1.1, so without it the class of a subject would be
//   fixed by a build flag no spec text mentions (INV16). It is fixed once, at
//   the parser boundary in the bundle's entry module, so no call site can
//   choose a different dialect.
//
//   EVERY FAILURE IS `unclaimed`, NEVER `code`. Three routes reach it and all
//   three are the same class: the delimiter rules refuse the block, the parse
//   throws, or the schema clause rejects what parsed. `readFrontmatter` could
//   not throw; a library reader can, and `stop-guard.sh` maps a guard-internal
//   error to exit 4 while promising it "shall NEVER exit 2" — so a throwing
//   parser at Stop would not hold the session, it would just fail. The parse
//   call is therefore wrapped: a parse failure becomes a CLASSIFICATION, never
//   an internal error.
//
//   THE SCHEMA CLAUSE IS GROVE'S, CHECKED AFTER THE PARSE, NEVER COERCING.
//   The document shall be a mapping; `type` when present a string;
//   `implements` when present a string or a sequence of strings. Anything else
//   — including a successful parse to a NON-MAPPING — is schema-invalid and
//   classifies `unclaimed`. This is the D1 split applied one level down: the
//   parser decides what is legal YAML, grove's schema decides which legal
//   documents are an artifact header.
//
// WHAT THIS CHANGES, accepted by adr-0048 D7 and recorded as a LOWER BOUND
// rather than a bound: legal-but-exotic YAML — quoted scalars, block scalars,
// nested maps, anchors, aliases, flow collections, quoted KEYS — used to
// classify `unclaimed` REGARDLESS of its `type`, which the spec calls "a
// divergence from this table, not a reading of it". It now classifies by its
// `type` like any other document. At least 19 measured inputs fall from four
// owed records to zero and at least 15 leave observer scope. That is a real
// coverage reduction, and it is the decision's, not this module's.
//
// WHAT THE LIBRARY DOES NOT ENFORCE, named rather than left to be discovered.
// YAML 1.2's `c-printable` production excludes the C0 controls (except tab,
// LF and CR), DEL, and the C1 range; `yaml@2.9.0` accepts all of them as
// ordinary scalar content. The old grammar rejected them as "ambiguous" and
// so classified such a file `unclaimed`; it now classifies by its `type`,
// which for `research`/`feedback` means zero owed records. Grove does not
// define YAML and does not get to be stricter than the parser it delegates to
// (the same ruling the TOML swap recorded for raw TAB), so this is DISCLOSED,
// not patched here. It is bounded by what a control character can reach: the
// classifier reads `type` and `implements` only, and neither is printed into
// an operator report — the one-line report fields carry their own C0/DEL
// refusal in `run.mjs`.

// YAML 1.2 b-char: line feed and carriage return, with CRLF as ONE break. The
// previous split was /\r?\n/, which left a bare-CR document entirely in
// lines[0] - a CR-terminated spec classified `code` and so was filtered out of
// observer mode entirely. Line splitting is DELIMITER logic, so it stays here.
const FM_LINE_BREAK = /\r\n|\r|\n/;
const FM_DELIMITER = /^---$/;
const FM_DELIMITER_LOOKALIKE = /^\s*---\s*$/;

// The schema clause (spec-0006 §Frontmatter reading, fourth bullet). Returns
// null when the document conforms, or the reason it does not.
function frontmatterSchemaFailure(document) {
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    const shape = document === null ? 'null' : Array.isArray(document) ? 'a sequence' : typeof document;
    return `the frontmatter document is ${shape}, not a mapping`;
  }
  if (Object.hasOwn(document, 'type') && typeof document.type !== 'string') {
    return 'the frontmatter `type` is not a string';
  }
  if (Object.hasOwn(document, 'implements')) {
    const value = document.implements;
    const conforms = typeof value === 'string'
      || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
    if (!conforms) {
      return 'the frontmatter `implements` is neither a string nor a sequence of strings';
    }
  }
  return null;
}

// Three outcomes, never two:
//   { kind: 'none' }              no block was opened - genuinely code
//   { kind: 'malformed', reason } a block was opened and is broken - unclaimed
//   { kind: 'block', fields }     a block was opened AND closed, its document
//                                 parsed, and the schema clause admits it
function readFrontmatter(text) {
  const malformed = (reason) => ({ kind: 'malformed', reason });
  // A BOM matters only when a block is actually present: a byte-order mark on
  // an ordinary source file is not frontmatter and must stay `code`. When a
  // block IS present the mark means the block does not begin at byte 0 - the
  // same malformed class.
  const hasByteOrderMark = text.charCodeAt(0) === 0xfeff;
  const body = hasByteOrderMark ? text.slice(1) : text;
  const lines = body.split(FM_LINE_BREAK);
  if (!FM_DELIMITER_LOOKALIKE.test(lines[0])) return { kind: 'none' };
  if (!FM_DELIMITER.test(lines[0])) {
    return malformed('the opening delimiter is not exactly `---`');
  }
  if (hasByteOrderMark) {
    return malformed('a byte-order mark precedes the opening delimiter');
  }

  // The closing delimiter is matched on the RAW line, deliberately: anything
  // that trimmed it first would turn a padded `--- ` back into a clean `---`
  // and re-open the route round six of the old reader's review closed.
  let close = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (FM_DELIMITER.test(lines[index])) { close = index; break; }
  }
  if (close === -1) {
    // A file that opened a block IS frontmatter-bearing; a block with no
    // closing delimiter is malformed, and malformed owes the full set.
    return malformed('the frontmatter block has no closing delimiter');
  }

  // Only the inner document crosses the boundary, rejoined with LF because the
  // split above already resolved grove's three line spellings into one.
  const document = lines.slice(1, close).join('\n');
  let parsed;
  try {
    parsed = parseYamlDocument(document);
  } catch (error) {
    // EVERY throw, not one error class: the library signals a malformed
    // document with a YAMLParseError but signals alias-expansion exhaustion
    // with a plain ReferenceError, and frontmatter is open input, so both
    // arrive here from a consumer's tree.
    return malformed(`the frontmatter document does not parse: ${error && error.message}`);
  }
  const failure = frontmatterSchemaFailure(parsed);
  if (failure != null) return malformed(failure);
  // Own enumerable entries only. A `__proto__` key arrives from the library as
  // an OWN data property (measured, and no prototype is written), and reading
  // the fields through a Map keeps that true of every consumer of this result
  // without bolting a prototype-nulling step onto the parser.
  return { kind: 'block', fields: new Map(Object.entries(parsed)) };
}

// --- derived change set (one definition, both modes) ---
//
// Uncommitted changes plus commits not on the merge-base with the default
// branch, resolved as origin/HEAD when set and the local main otherwise; if
// neither resolves this throws a guard-internal error (CLI exit 1) rather
// than guessing.
export async function deriveChangeSet({ repoRoot }) {
  // The provided root must BE the repository toplevel: repo-relative subject
  // paths and the derived change set are meaningless from a subdirectory,
  // and git happily answers from one — an empty-looking change set that
  // silently passes. Fail loud instead (guard-internal, CLI exit 1).
  const toplevel = (await git(repoRoot, ['rev-parse', '--show-toplevel'])).trim();
  const provided = await realpath(resolve(repoRoot)).catch(() => resolve(repoRoot));
  const physicalToplevel = await realpath(toplevel).catch(() => toplevel);
  if (provided !== physicalToplevel) {
    throw guardInternal(
      `repoRoot ${provided} is not the repository toplevel (${physicalToplevel}); `
        + 'run the guard from the repository root',
    );
  }
  const base = await resolveBase(repoRoot);
  const paths = new Set();
  const mergeBase = (await git(repoRoot, ['merge-base', 'HEAD', base])).trim();
  // NUL-separated output on both reads: git's default core.quotePath
  // C-style-escapes non-ASCII paths ("caf\303\251"), and parsing that quoted
  // form silently dropped the real path — an unreviewed change both modes
  // then passed over. With -z every path arrives verbatim, unquoted.
  for (const token of (await git(repoRoot, [
    'diff', '--name-only', '--no-renames', '-z', mergeBase, 'HEAD',
  ])).split('\0')) {
    if (token !== '') paths.add(token);
  }
  for (const path of parseStatusZ(await git(repoRoot, [
    'status', '--porcelain', '--untracked-files=all', '-z',
  ]))) {
    paths.add(path);
  }
  return paths;
}

// status --porcelain v1 -z (derived from the git-status format
// documentation, probed on git 2.39): every entry is "XY PATH"
// NUL-terminated, and when EITHER the index column X (staged rename/copy,
// `git mv`) or the worktree column Y (worktree rename/copy, `mv` +
// `git add -N`) is R or C, ONE extra NUL-terminated token follows carrying
// the ORIGINAL path. Both halves are changes — the original is an
// unreviewed deletion — and consuming the extra token on either column
// keeps the stream in sync for the entries after it.
export function parseStatusZ(output) {
  const paths = new Set();
  const tokens = String(output).split('\0');
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '') continue;
    const status = token.slice(0, 2);
    const path = token.slice(3);
    if (path !== '') paths.add(path);
    const renamedOrCopied = ['R', 'C'].includes(status[0])
      || ['R', 'C'].includes(status[1]);
    if (renamedOrCopied) {
      index += 1;
      const original = tokens[index];
      if (original) paths.add(original);
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
      // Same mechanism as the subject decode, found by the bounded byte-level
      // audit rather than reported: a record read with 'utf8' had its malformed
      // bytes repaired to U+FFFD, and since `verdict`, `by` and `date` are only
      // checked for non-emptiness, such a record VALIDATED and satisfied a
      // transition — silencing owed work a conforming reader would refuse to
      // parse at all.
      const decoded = decodeUtf8Strict(await readFile(join(recordsDir, name)));
      if (decoded == null) {
        defects.push({ path: relative, reason: 'record is not valid UTF-8' });
        continue;
      }
      let parsed;
      try {
        parsed = parseTomlDocument(decoded);
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

// Every digest an entry kind produces is domain-separated by a tag, so a
// subject that CHANGES KIND cannot keep a record alive by coincidence: an
// untagged symlink to `target.txt` digested identically to a regular file
// whose bytes are exactly `target.txt` (measured: 199b3bad…), which let a
// code-review record on the file survive its replacement by a symlink.
// That tag was applied to ONE SIDE, which is not domain separation: with the
// regular-file bytes still hashed raw, a regular file whose bytes were exactly
// `grove:symlink-target:target.txt` reproduced the symlink's digest exactly
// (measured: bf1b65c9…), so every record made for the reviewed symlink still
// satisfied the unreviewed replacement CODE file — and the same mechanism, not
// only the demonstrated case, also collided a fifo with a regular file holding
// `grove:non-regular-entry:fifo` (measured: d6b36a5b…). EVERY kind is tagged
// below, through one constructor, and the tags are mutually PREFIX-FREE: they
// share `grove:` and then diverge at byte 6, so no byte string can be read as
// two different kinds' representations. That closes cross-kind collision by
// construction rather than case by case.
//
// Residual, restated honestly against what this now does: `recordSatisfies`
// still compares subject/state/digest and never the entry kind, so a record
// still cannot NAME which kind it reviewed. It no longer needs to. With
// prefix-free tags the digest itself is injective over (kind, representation),
// so a digest match already implies a kind match — the entry kind in the
// comparison would be redundant, not additive. What remains genuinely open is
// only what a digest cannot express: SHA-256 collision resistance, and the
// fact that a record read in isolation is not self-describing.
//
// Record churn, stated exactly. Tagging the regular-file side changes EVERY
// regular-file digest, so every pre-existing record on a regular-file subject
// is shed and re-owes its review — a bigger churn than the symlink-only tag,
// and named rather than discovered. Verified in this repository: no `.grove/
// runs/` directory exists, so there are no verdict records here to shed. Every
// direction is fail-closed — a shed record re-owes its review, never the
// reverse.
const DIGEST_TAGS = Object.freeze({
  file: 'grove:file-bytes:',
  symlink: 'grove:symlink-target:',
  'non-regular': 'grove:non-regular-entry:',
});

// THE one place a subject digest is constructed. `value` is raw bytes for the
// kinds that have them (regular-file contents, a readlink target) — never a
// decoded string, which collapsed distinct invalid byte sequences to one
// digest.
export function subjectDigest(kind, value) {
  const tag = DIGEST_TAGS[kind];
  if (tag == null) {
    throw new Error(`unknown subject digest kind "${kind}"`);
  }
  return sha256(Buffer.concat([
    Buffer.from(tag),
    Buffer.isBuffer(value) ? value : Buffer.from(String(value)),
  ]));
}

// The prefix-free property the separation rests on, checkable rather than
// asserted: exported so a test can quantify over every pair instead of
// re-listing the tags.
export function digestTagList() {
  return Object.values(DIGEST_TAGS);
}

// Subject binding (INV11/AC7): the digest binds the subject's ACTUAL bytes,
// and presence is established WITHOUT dereferencing. Entry-type case list
// derived from node:fs lstat's documented types — lstat NEVER follows, so
// the kind below is the kind of the named entry itself:
//   regular file  -> present; digest of the RAW buffer (a lossy utf8 decode
//                    collapsed distinct invalid byte sequences to one
//                    digest); classification decodes the buffer for
//                    frontmatter reading only. A HARD LINK is a regular file
//                    and is bound as one: link count is not consulted, so two
//                    names for one inode bind identically and independently —
//                    stated, not overlooked.
//   symbolic link -> present; the subject IS the link, so the digest is of
//                    its readlink target's RAW BYTES, tagged (a utf8 decode
//                    of the target collapsed distinct invalid byte sequences
//                    to one digest — the same fault this case list was
//                    written to remove, reintroduced on the link side).
//                    Following it let a retarget between identical-content
//                    files keep a stale verdict alive, and a dangling link
//                    masquerade as absent. This row covers a symlink to a
//                    DIRECTORY too: lstat reports the link, never its target,
//                    so a symlink-to-directory lands here, not in the
//                    directory row below. Classification is fail-closed
//                    `unclaimed` (owes the full set) — bytes cannot be read
//                    without dereferencing, and `code` by accident would owe
//                    less.
//   directory     -> a REAL directory at the path: the FILE subject is absent
//                    (`missing` class) — the prior EISDIR behavior, kept and
//                    now stated.
//   anything else -> (fifo/socket/device) present, fail-closed `unclaimed`,
//                    digest of a tagged constant naming the entry kind.
export async function bindSubject({ repoRoot, path, changeSet }) {
  const target = join(repoRoot, path);
  const changed = changeSet.has(path);
  let entry = null;
  try {
    entry = await lstat(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (entry == null || entry.isDirectory()) {
    return { path, state: 'absent', sha256: null, classes: ['missing'], changed };
  }
  if (entry.isSymbolicLink()) {
    return {
      path,
      state: 'present',
      sha256: subjectDigest('symlink', await readlink(target, { encoding: 'buffer' })),
      classes: ['unclaimed'],
      changed,
    };
  }
  if (entry.isFile()) {
    const bytes = await readRegularFile(target); // raw Buffer, no decoding
    // The digest binds the RAW bytes either way, so a subject that fails to
    // decode still has a stable digest and a verdict record can still bind to
    // it — it simply owes the full set until it decodes.
    const text = decodeUtf8Strict(bytes);
    return {
      path,
      state: 'present',
      sha256: subjectDigest('file', bytes),
      classes: text == null ? ['unclaimed'] : classifyContent(text).classes,
      changed,
    };
  }
  return {
    path,
    state: 'present',
    sha256: subjectDigest('non-regular', entryKind(entry)),
    classes: ['unclaimed'],
    changed,
  };
}

// lstat-then-read looks the same name up twice, and the entry can be swapped
// between the two. Only one direction of that race fails OPEN — regular file
// -> symlink, where a path-based read follows the new link and digests bytes
// that are not the subject's — so the bytes come through ONE handle opened
// `O_NOFOLLOW`, and that handle's OWN stat is what confirms it is still a
// regular file. The other direction throws, which is fail-closed everywhere
// this is called from (the guard maps a throw to exit 1, and close-run
// requires exit 0). POSIX only: `O_NOFOLLOW` is absent on Windows, where the
// bitwise OR drops it and the pre-existing behavior stands. `O_NONBLOCK`
// keeps the open from parking forever on a FIFO swapped in mid-race.
async function readRegularFile(target) {
  const handle = await open(
    target,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const info = await handle.stat();
    if (!info.isFile()) {
      throw new Error(`${target} stopped being a regular file while it was being read`);
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function entryKind(entry) {
  if (entry.isFIFO()) return 'fifo';
  if (entry.isSocket()) return 'socket';
  if (entry.isBlockDevice()) return 'block-device';
  if (entry.isCharacterDevice()) return 'character-device';
  return 'unknown';
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
