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
  // The grammar returns a flow sequence as a real array, so the old
  // `!== '[]'` string comparison — which existed because `implements: []`
  // used to arrive as the two-character string — is now unreachable and has
  // been dropped rather than left to imply a case that cannot occur.
  // No trim() here either: an accepted value cannot carry leading or trailing
  // YAML whitespace (yamlTrim removed it) and cannot be empty (the grammar
  // rejects an empty scalar; an empty value means a BARE KEY, which is the
  // only way a field holds '').
  const implementsValue = frontmatter.fields.get('implements');
  const implementsBearing = Array.isArray(implementsValue)
    ? implementsValue.length > 0
    : typeof implementsValue === 'string' && implementsValue !== '';
  const classes = implementsBearing ? [base, 'implements-bearing'] : [base];
  return { classes, base, implementsBearing };
}

// ============================================================================
// THE ACCEPTED FRONTMATTER GRAMMAR - a closed whitelist, not a skip list.
// ============================================================================
// Six rounds of review each added one rule for a malformed shape nobody had
// thought of, because this reader had BLACKLIST semantics: it enumerated the
// shapes that were safe to discard and accepted whatever failed to trip a
// rule. That accepting set is unbounded, so it cannot converge by patching -
// and it did not. `type: research` followed by an indented `  garbage` is the
// YAML value "research garbage", outside the enum, yet a "safe to skip"
// continuation rule preserved `research` and classified the file `reviewless`,
// which owes nothing and is invisible to observer mode.
//
// The polarity is inverted below. This classifier reads exactly ONE field
// (`type`, plus `implements`), so it does not need to parse YAML. It accepts
// the closed list of line forms grove's own frontmatter uses and treats
// EVERYTHING else as malformed. There are no skip branches: a line matches an
// accepted form, or the block is malformed.
//
// ACCEPTED LINE FORMS (tested after comment stripping; nothing else is accepted):
//   B  blank            zero or more spaces/tabs and nothing else
//   D  close delimiter  exactly `---`
//   K  key with value   `key: <VALUE>` - key in [A-Za-z0-9_-]+, one or more
//                       spaces/tabs after the colon
//   E  bare key         `key:` with no value; may be followed by I lines
//   I  sequence item    optional indent, `-`, one or more spaces/tabs, <SCALAR>
//                       - accepted ONLY directly under an E line or another I
//
// ACCEPTED VALUES (nothing else is accepted). The rules split on whether the
// classifier READS the key, because that is exactly where byte-equivalence
// with a conforming YAML reader has to be a property rather than an argument:
//   S  plain scalar     non-empty; first character is not a YAML indicator
//                       (-?:,[]{}#&*!|>'"%@` ); contains no ":" followed by a
//                       space or tab and does not end in ":" (either is a
//                       mapping-value indicator); in FLOW context contains no
//                       [ ] { } (forbidden in a flow plain scalar); contains
//                       no ambiguous character (below); and
//   N  narrow scalar    for a READ key (`type`, `implements`) additionally
//                       matches [A-Za-z0-9_-]+ exactly
//   F  flow sequence    `[` + comma-separated S/N items (possibly none) + `]`
//
// WHY THE SPLIT, stated because it is the load-bearing design choice. A value
// this classifier reads must mean the same thing to every reader, and
// [A-Za-z0-9_-]+ delivers that as a property: such a scalar has no whitespace
// to trim, no indicator, no flow delimiter, no comment marker, no escape, and
// no character whose line-break class differs between YAML 1.1 and 1.2. A
// value it does NOT read only has to be structurally equivalent — one mapping
// entry ending at the line break — which the S rules plus the line grammar's
// refusal of indented continuations already guarantee. Measured: requiring the
// narrow class of EVERY value would reclassify 31 tracked files, because
// unread keys legitimately carry prose and cross-repository ids
// (`trellis/decision-0045`, `spec-0004-dual-host-distribution@v6`); requiring
// it of read keys alone reclassifies none, because the corpus's 7 distinct
// `type` values and 7 distinct `implements` values are already within it.
//
// WHITESPACE IS YAML'S, NOT JAVASCRIPT'S. Values are trimmed with s-white —
// space and tab, and nothing else. JS trim() also strips 13 characters YAML
// treats as ordinary scalar content (NBSP U+00A0, the U+2000 block, U+FEFF,
// VT, FF, LS, PS, ...), so `type: research<NBSP>` was trimmed to `research`,
// matched the enum, and classified reviewless — owing nothing and invisible to
// observer mode — while every conforming reader keeps the NBSP and reads a
// value that is NOT `research`. That was one instance of a 13-member class,
// closed at the mechanism: yamlTrim below is the only trim on the path.
//
// AMBIGUOUS CHARACTERS, rejected anywhere in a value: C0 controls except tab,
// DEL, the C1 range (which contains NEL U+0085), LS U+2028, PS U+2029, and the
// byte-order mark. The rationale is not taste: YAML 1.1 treats NEL/LS/PS as
// line breaks and YAML 1.2 does not, so a document containing one is read
// differently by two conforming parsers. Input whose meaning depends on which
// parser reads it is what "ambiguous" means here, and ambiguous is malformed.
//
// THE PROPERTY THIS BUYS, in two halves that are now both properties:
//   1. STRUCTURE. Any input not matching this grammar is malformed; malformed
//      classifies `unclaimed`; `unclaimed` owes the full record set and is
//      observer-visible. So no input outside the grammar can under-owe review.
//      This holds by the shape of the code - every exit from readFrontmatter
//      is `block` (every line matched) or `malformed`.
//   2. CONTENT. For inputs INSIDE the grammar, a value the classifier reads is
//      [A-Za-z0-9_-]+, and every conforming YAML reader produces exactly those
//      bytes for such a plain scalar. Round seven left this as an argument and
//      named it the residual; round eight found three defects in it and
//      nothing outside half 1, so the residual was real and the structure was
//      sound. It is now a property of the charset.
//
// WHAT REMAINS, stated precisely rather than declared closed. Two residuals,
// both measured, neither claimed shut:
//
//   A. TAG RESOLUTION of values. YAML 1.1 resolves `no`, `y`, `on`, `null` to
//      boolean/null where 1.2 keeps a string, and all of those spellings are
//      inside the narrow class. This cannot change a `type` decision: no enum
//      member (adr, spec, charter, research, feedback) is one of those
//      spellings, and resolution changes a node's TYPE, never its spelling, so
//      "is this value one of those five strings" has one answer under every
//      reader. On `implements` it can only make the value MORE present, which
//      over-owes. Fail-closed in both directions.
//
//   B. TAG RESOLUTION of KEYS, which the charset does NOT close. Two DISTINCT
//      key spellings can resolve to one scalar under YAML 1.1 — `y:` and
//      `yes:` both to true, `1:` and `0x1:` both to 1 — so a strict reader
//      sees a duplicate key and rejects the document while this reader sees
//      two ordinary keys and classifies by the declared `type`. Measured:
//      `y: 1 / yes: 2 / type: research` classifies reviewless here. The
//      duplicate-key check catches identical SPELLINGS only. Not closed, and
//      deliberately not papered over: closing it means shipping YAML 1.1
//      resolution tables for bools, nulls and octal/hex integers, which is
//      more machinery than a two-field classifier justifies. It is bounded —
//      it needs a hand-written key pair that no corpus file contains, and the
//      two key names this classifier reads (`type`, `implements`) cannot
//      participate, since no resolution produces those strings.
//
// A DIFFERENTIAL TEST against a real YAML implementation is NOT required and
// is not being requested. Both residuals are semantic (tag resolution), not
// syntactic; a parser comparison would re-derive exactly the finite, published
// spelling sets named above, at the cost of this repository's first
// dependency.
//
// THE COST, accepted deliberately: legal-but-exotic YAML that grove does not
// use - quoted scalars, block scalars, nested maps, anchors, flow mappings,
// multi-document streams - is malformed, so such a file classifies `unclaimed`
// rather than by its type. That over-owes review instead of under-owing it,
// which is the correct direction. Measured against the corpus before landing:
// zero of the 233 tracked files change class.

// YAML 1.2 b-char: line feed and carriage return, with CRLF as ONE break. The
// previous split was /\r?\n/, which left a bare-CR document entirely in
// lines[0] - a CR-terminated spec classified `code` and so was filtered out of
// observer mode entirely.
const FM_LINE_BREAK = /\r\n|\r|\n/;
const FM_DELIMITER = /^---$/;
const FM_DELIMITER_LOOKALIKE = /^\s*---\s*$/;
const FM_BLANK = /^[ \t]*$/;
const FM_KEY = /^([A-Za-z0-9_-]+):(?:[ \t]+(.*))?$/;
const FM_ITEM = /^[ \t]*-[ \t]+(.*)$/;
const FM_INDICATOR = /^[-?:,[\]{}#&*!|>'"%@`]/;
// A ":" followed by space or tab is a mapping-value indicator. Testing only
// ": " missed the tab spelling, so `implements: a:<TAB>b` was recorded as a
// plain scalar that no conforming reader would produce.
const FM_MAPPING_INDICATOR = /:[ \t]/;
// Forbidden inside a plain scalar in FLOW context only. The block-context
// check tests the FIRST character, so it accepted `[a[b]` as the item `a[b`.
const FM_FLOW_INDICATOR = /[[\]{}]/;
// The keys whose value this classifier actually reads.
const FM_READ_KEYS = new Set(['type', 'implements']);
const FM_NARROW = /^[A-Za-z0-9_-]+$/;
const FM_AMBIGUOUS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029\uFEFF]/;
// YAML's comment rule: `#` begins a comment at the start of a line, or when
// preceded by a space or tab. A `#` NOT preceded by whitespace belongs to the
// scalar (`grove#101` stays whole), which is why this scans rather than
// splitting on '#'.
// YAML s-white: space and tab only. Never String.prototype.trim().
function yamlTrim(value) {
  return value.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
}

function stripFrontmatterComment(line) {
  if (/^[ \t]*#/.test(line)) return '';
  const comment = /[ \t]#/.exec(line);
  // TRAILING whitespace only, never yamlTrim. Leading whitespace is
  // STRUCTURAL — it is what distinguishes an indented continuation from a
  // column-0 key — and stripping it here made `  owner: me` match the key form
  // and re-opened the continuation hole round seven closed. Caught by the
  // round-seven battery when this function briefly used yamlTrim.
  const body = comment == null ? line : line.slice(0, comment.index);
  return body.replace(/[ \t]+$/, '');
}

// Forms S and N. Returns the scalar, or null when it is outside the grammar.
// `read` selects the narrow charset; `inFlow` adds the flow-context rule.
function acceptScalar(value, { read, inFlow }) {
  if (value === '' || FM_AMBIGUOUS.test(value)) return null;
  if (FM_INDICATOR.test(value)) return null;
  if (FM_MAPPING_INDICATOR.test(value) || value.endsWith(':')) return null;
  if (inFlow && FM_FLOW_INDICATOR.test(value)) return null;
  if (read && !FM_NARROW.test(value)) return null;
  return value;
}

// Form F. Items are scalars in FLOW context, so they carry the extra rule.
function acceptFlowSequence(value, read) {
  if (!value.startsWith('[') || !value.endsWith(']')) return null;
  if (FM_AMBIGUOUS.test(value)) return null;
  const inner = yamlTrim(value.slice(1, -1));
  if (inner === '') return [];
  const items = [];
  for (const token of inner.split(',')) {
    const item = acceptScalar(yamlTrim(token), { read, inFlow: true });
    if (item == null) return null;
    items.push(item);
  }
  return items;
}

function acceptValue(value, read) {
  const scalar = acceptScalar(value, { read, inFlow: false });
  return scalar == null ? acceptFlowSequence(value, read) : scalar;
}

// Three outcomes, never two:
//   { kind: 'none' }              no block was opened - genuinely code
//   { kind: 'malformed', reason } a block was opened and is broken - unclaimed
//   { kind: 'block', fields }     a block was opened AND closed, and EVERY
//                                 line between them matched an accepted form
function readFrontmatter(text) {
  const malformed = (reason) => ({ kind: 'malformed', reason });
  // A BOM matters only when a block is actually present: a byte-order mark on
  // an ordinary source file is not frontmatter and must stay `code`. When a
  // block IS present the mark means the block does not begin at byte 0 - the
  // same malformed class, and toml.mjs already rules a BOM invalid rather than
  // silently strippable ("keys start at byte 0").
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

  const fields = new Map();
  // The only state the grammar carries: which bare key, if any, the next
  // sequence item belongs to. An item with no key above it matches no form.
  let sequenceKey = null;
  for (let index = 1; index < lines.length; index += 1) {
    const at = `line ${index + 1}`;
    // The delimiter is tested on the RAW line, deliberately and before comment
    // stripping: the stripper also trims trailing whitespace, which would turn
    // a padded `--- ` back into a clean `---` and re-open the exact route
    // round six closed. Both delimiters are therefore compared against the raw
    // bytes; everything else is compared after stripping.
    if (FM_DELIMITER.test(lines[index])) return { kind: 'block', fields };
    const line = stripFrontmatterComment(lines[index]);

    if (FM_BLANK.test(line)) { sequenceKey = null; continue; }

    const item = FM_ITEM.exec(line);
    if (item) {
      if (sequenceKey == null) {
        return malformed(`${at}: a sequence item with no bare key above it`);
      }
      const scalar = acceptScalar(yamlTrim(item[1]), {
        read: FM_READ_KEYS.has(sequenceKey), inFlow: false,
      });
      if (scalar == null) return malformed(`${at}: the sequence item is not an accepted scalar`);
      const held = fields.get(sequenceKey);
      fields.set(sequenceKey, Array.isArray(held) ? [...held, scalar] : [scalar]);
      continue;
    }

    const key = FM_KEY.exec(line);
    if (key == null) return malformed(`${at} matches no accepted frontmatter line form`);
    const name = key[1];
    // A duplicate key is ambiguous, and YAML forbids it outright. First-wins
    // silently resolved that ambiguity in the writer's favour.
    if (fields.has(name)) return malformed(`${at}: duplicate key "${name}"`);
    const raw = yamlTrim(key[2] ?? '');
    if (raw === '') {
      fields.set(name, '');
      sequenceKey = name;
      continue;
    }
    const value = acceptValue(raw, FM_READ_KEYS.has(name));
    if (value == null) {
      return malformed(`${at}: the value of "${name}" is outside the accepted grammar`);
    }
    fields.set(name, value);
    sequenceKey = null;
  }
  // Unterminated. A file that opened a block IS frontmatter-bearing; a block
  // with no closing delimiter is malformed, and malformed owes the full set.
  return malformed('the frontmatter block has no closing delimiter');
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
    return {
      path,
      state: 'present',
      sha256: subjectDigest('file', bytes),
      classes: classifyContent(bytes.toString('utf8')).classes,
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
