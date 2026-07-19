// grove-review-ask parsing, effectiveness, and serialization (spec-0003 §A;
// adr-0023 D2). Shadow machinery: NOTHING here is read by the shipped
// spec-0002 check (spec-0003 INV1 — asks are inert to it by fail-closed
// non-recognition).
//
// An ask record is a fenced `grove-review-ask` block (YAML per spec-0003
// §A.2) on a PR comment — the structural sibling of the `grove-verdict`
// block. Carrier, delimitation, per-block isolation, and inertness-by-
// non-recognition are spec-0002 §A.1's, inherited verbatim via
// `extractTaggedBlocks` (adr-0019: a comment may batch several blocks; a
// malformed/unclosed/schema-invalid block is inert ON ITS OWN and never
// inerts a well-formed sibling). §A.4 admissibility is inherited whole:
// callers gate comments through `records.mjs`'s `checkAdmissibility`
// unchanged before treating their blocks as records.
//
// An ask declares an OBLIGATION, never a content attestation — it carries
// no fingerprint and no manifest (spec-0003 §A.2's deliberately-absent
// fields); it can only ADD obligations, never remove them (§A.3).

import { parseYaml, YamlError } from './yaml.mjs';
import { normalizePath } from './normalize.mjs';
import { extractFencedBlocks, extractTaggedBlocks } from './blocks.mjs';

// --- parse / validate (§A.1, §A.2) ---

// Return the raw inner text of every well-formed fenced grove-review-ask
// block in a body (structural sibling of extractVerdictBlocks).
export function extractAskBlocks(body) {
  return extractFencedBlocks(body, 'grove-review-ask');
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

// Validate a parsed block against the §A.2 schema. Returns the record object
// (normalized) or null if it fails recognition (=> inert, fail-closed).
function validate(obj) {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return null;
  if (obj.schema !== 1) return null; // absent or != 1 => inert (§A.2)
  if (!isNonEmptyString(obj.producer)) return null;
  if (!isNonEmptyString(obj.type)) return null; // ONE type per block (§A.2)
  if (!Array.isArray(obj.subject) || obj.subject.length === 0) return null;
  const subject = [];
  for (const s of obj.subject) {
    if (typeof s !== 'string') return null;
    subject.push(s); // normalization happens at effectiveness time; keep raw + norm
  }
  return {
    schema: 1,
    producer: obj.producer,
    type: obj.type,
    subject,
    subjectNormalized: subject.map(normalizePath),
    annotations: obj.annotations != null ? String(obj.annotations) : undefined,
    resumed_by: obj.resumed_by != null ? String(obj.resumed_by) : undefined,
  };
}

function parseBlock({ inner, index, wellFormed }) {
  if (!wellFormed) return { status: 'inert', cause: 'unclosed', blockIndex: index };
  let parsed;
  try {
    parsed = parseYaml(inner);
  } catch (e) {
    // Fail-closed: ANY parser throw yields an inert block, never an escape
    // (the records.mjs contract, mirrored).
    return { status: 'inert', cause: e instanceof YamlError ? 'malformed' : 'parse-error', blockIndex: index };
  }
  const record = validate(parsed);
  if (record == null) return { status: 'inert', cause: 'schema', blockIndex: index };
  return { status: 'record', record, blockIndex: index };
}

// Parse a comment into { status: 'none'|'multi', blocks } — the exact shape
// of records.mjs's parseComment, over the grove-review-ask tag (spec-0003
// §A.1: spec-0002 §A.1 delimitation by reference, adr-0019 batching).
export function parseAskComment(comment) {
  const richBlocks = extractTaggedBlocks(comment.body, 'grove-review-ask');
  if (richBlocks.length === 0) return { status: 'none', blocks: [] };
  return { status: 'multi', blocks: richBlocks.map(parseBlock) };
}

// --- effectiveness (§A.3) ---
//
// Evaluation context `ctx`:
//   typeOf(normalizedPath) -> string|null — the spec-0002 §C.2 HEAD-frontmatter
//     type basis: the raw `type:` declaration (recognized or not), null when
//     the file is frontmatterless or carries no `type:` key.
//   reviewlessTypes — iterable of the policy's positively-declared reviewless
//     types, read from the protected branch (spec-0002 §C.1).
// Both §A.3 rules are deterministic; asks only ever ADD obligations.

function reviewlessSet(ctx) {
  const src = ctx && ctx.reviewlessTypes != null ? ctx.reviewlessTypes : [];
  return src instanceof Set ? src : new Set([...src].map((t) => String(t)));
}

function typeOf(ctx, path) {
  if (ctx && typeof ctx.typeOf === 'function') return ctx.typeOf(path);
  return null;
}

// Distinct normalized subjects of a record, in document order. A path that
// cannot be normalized matches nothing (fail-closed by non-match, §A.2): it
// is neither covered nor flagged. Duplicates within one record collapse —
// flagged rows are one per (record, subject, cause) triple (§A.3).
function normalizedSubjects(record) {
  const seen = new Set();
  const out = [];
  for (const norm of record.subjectNormalized || record.subject.map(normalizePath)) {
    if (norm == null || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

// Evaluate ONE schema-valid record against the two §A.3 hard rules.
// Returns { covered: [path], flagged: [{ path, cause, comment }] } in
// document order; for a both-fire (record, subject) pair the block-wide
// `reviewless-type` row precedes the per-file `frontmatter-divergence` row —
// both emit, neither suppresses the other (§A.3 both-fire; INV4).
export function evaluateAskEffectiveness(record, ctx, commentId) {
  const askType = String(record.type).trim();
  const isReviewless = reviewlessSet(ctx).has(askType); // rule 1: block-wide
  const covered = [];
  const flagged = [];
  for (const path of normalizedSubjects(record)) {
    const fmType = typeOf(ctx, path);
    // rule 2: for a frontmatter-bearing subject the frontmatter type wins —
    // exact string equality after trimming (§A.2); divergence inerts the ask
    // for THAT file only.
    const diverges = fmType != null && String(fmType).trim() !== askType;
    if (isReviewless) flagged.push({ path, cause: 'reviewless-type', comment: commentId });
    if (diverges) flagged.push({ path, cause: 'frontmatter-divergence', comment: commentId });
    if (!isReviewless && !diverges) covered.push(path);
  }
  return { covered, flagged };
}

function unwrap(entry) {
  if (entry != null && typeof entry === 'object' && 'record' in entry) {
    return { record: entry.record, commentId: entry.commentId };
  }
  return { record: entry, commentId: undefined };
}

// `ask_covered_files` (spec-0003 Terms / §D.1): the union of effectively
// covered subject paths over every ask record given. Callers pass only
// records drawn from ADMISSIBLE comments (§A.4 inherited whole — gate with
// records.mjs checkAdmissibility first). Accepts [{ record, commentId }] or
// bare records.
export function askCoveredFiles(asks, ctx) {
  const covered = new Set();
  for (const entry of asks) {
    const { record, commentId } = unwrap(entry);
    for (const p of evaluateAskEffectiveness(record, ctx, commentId).covered) covered.add(p);
  }
  return covered;
}

// The §A.3 inert-per-subject rows across every record, machine-derived —
// one row per (record, subject, cause) triple, in stream order (the §C.1
// `flagged` surface; recomputable, never anyone's claim).
export function flaggedRows(asks, ctx) {
  const rows = [];
  for (const entry of asks) {
    const { record, commentId } = unwrap(entry);
    rows.push(...evaluateAskEffectiveness(record, ctx, commentId).flagged);
  }
  return rows;
}

// The fail-closed UNION of effective ask types per FRONTMATTERLESS subject
// (§A.3 / INV3): several effective asks may declare different types for one
// subject — its ask-derived owed set is the union over every effective ask
// type, never latest-wins (a correction can only ADD). Frontmatter-bearing
// subjects never enter this map: they stay frontmatter-resolved (§D.1 —
// the table's own derivation governs them).
export function effectiveAskTypes(asks, ctx) {
  const byPath = new Map();
  for (const entry of asks) {
    const { record, commentId } = unwrap(entry);
    const { covered } = evaluateAskEffectiveness(record, ctx, commentId);
    for (const path of covered) {
      if (typeOf(ctx, path) != null) continue; // frontmatter-resolved
      if (!byPath.has(path)) byPath.set(path, new Set());
      byPath.get(path).add(String(record.type).trim());
    }
  }
  return byPath;
}

// --- serializer (§A.2, §A.4) ---
//
// Emit one fenced grove-review-ask block for a producer pass's subjects of
// ONE produced type (a mixed-type pass posts several blocks batched in one
// comment — §A.4; the record-ask skill owns posting). Deliberately absent:
// fingerprint / manifest_hashes — an ask declares an obligation, not a
// content attestation (§A.2's design fact). Fails LOUDLY on input that
// cannot serialize into a parseable block — a broken record must never be
// posted silently.

const FENCE_LINE = /(^|\n)\s*`{3,}/;

function requireScalar(name, v) {
  if (!isNonEmptyString(v)) throw new Error(`serializeAsk: ${name} must be a non-empty string`);
  if (/[\n\r]/.test(v)) throw new Error(`serializeAsk: ${name} must be single-line`);
  return v.trim();
}

function yamlScalar(v) {
  return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

export function serializeAsk({ producer, type, subject, annotations, resumed_by } = {}) {
  const prod = requireScalar('producer', producer);
  const t = requireScalar('type', type);
  if (!Array.isArray(subject) || subject.length === 0) {
    throw new Error('serializeAsk: subject must be a non-empty list of paths');
  }
  const lines = ['```grove-review-ask', 'schema: 1', `producer: ${yamlScalar(prod)}`, `type: ${yamlScalar(t)}`];
  lines.push('subject:');
  for (const s of subject) {
    const path = requireScalar('subject path', s);
    lines.push(`  - ${yamlScalar(path)}`);
  }
  if (annotations != null && String(annotations).trim() !== '') {
    const text = String(annotations);
    // A 3+-backtick line inside the block would terminate the fence early
    // (spec-0002 §A.1 delimitation) — refuse rather than post a broken record.
    if (FENCE_LINE.test(text)) {
      throw new Error('serializeAsk: annotations must not contain a code-fence line');
    }
    lines.push('annotations: |');
    for (const l of text.split(/\r\n?|\n/)) lines.push(l === '' ? '' : `  ${l}`);
  }
  if (resumed_by != null) {
    lines.push(`resumed_by: ${yamlScalar(requireScalar('resumed_by', resumed_by))}`);
  }
  lines.push('```');
  return lines.join('\n');
}
