// Verdict-record parsing and admissibility (spec-0002 §A.1, §A.2, §A.4).
//
// A verdict record is a fenced `grove-verdict` block (YAML per §A.2) inside a
// PR comment. A comment MAY carry several such blocks and the check reads EACH
// well-formed block as its own record (spec-0002 §A.1 v4 / adr-0019). Recognition
// is fail-closed PER BLOCK: a comment with zero blocks is not a record; a block
// that is malformed/unclosed or fails the §A.2 schema (including absent/unknown
// `schema`) is inert ON ITS OWN and never inerts a well-formed sibling in the
// same comment (per-block isolation, not per-comment poison). Admissibility
// (§A.4) is whole-comment and gates whether a schema-valid record enters
// selection.

import { parseYaml, YamlError } from './yaml.mjs';
import { normalizePath } from './normalize.mjs';
import { extractFencedBlocks, extractTaggedBlocks } from './blocks.mjs';

const REVIEWS = new Set(['conformance', 'code-reviewer', 'spec-adversary', 'decision-adversary']);
const DEFAULT_POSTER_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

// Return the raw inner text of every fenced grove-verdict block in a body.
export function extractVerdictBlocks(body) {
  return extractFencedBlocks(body, 'grove-verdict');
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

// Validate a parsed block against the §A.2 schema. Returns the record object
// (normalized) or null if it fails recognition (=> inert).
function validate(obj) {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return null;
  // schema recognition gate
  if (obj.schema !== 1) return null;
  if (!REVIEWS.has(obj.review)) return null;
  if (!isNonEmptyString(obj.verdict)) return null;
  if (!Array.isArray(obj.subject) || obj.subject.length === 0) return null;
  const subject = [];
  for (const s of obj.subject) {
    if (typeof s !== 'string') return null;
    subject.push(s); // normalization happens at match time; keep raw + norm
  }
  if (obj.manifest_hashes == null || typeof obj.manifest_hashes !== 'object' || Array.isArray(obj.manifest_hashes)) {
    return null;
  }
  if (!isNonEmptyString(obj.fingerprint)) return null;
  if (!isNonEmptyString(obj.producer)) return null;
  if (!isNonEmptyString(obj.reviewer)) return null;
  if (!('findings' in obj)) return null; // findings key required (may be empty => vacuous)
  const findings = obj.findings == null ? '' : String(obj.findings);
  return {
    schema: 1,
    review: obj.review,
    verdict: obj.verdict,
    subject,
    subjectNormalized: subject.map(normalizePath),
    subject_id: obj.subject_id != null ? String(obj.subject_id) : undefined,
    manifest_hashes: obj.manifest_hashes,
    fingerprint: obj.fingerprint,
    producer: obj.producer,
    reviewer: obj.reviewer,
    findings,
    reviewed_at_commit: obj.reviewed_at_commit != null ? String(obj.reviewed_at_commit) : undefined,
  };
}

// Parse a single grove-verdict block into a per-block result:
//   { status: 'inert', cause, blockIndex } — malformed/unclosed or schema-invalid
//   { status: 'record', record, blockIndex } — a schema-valid record
function parseBlock({ inner, index, wellFormed }) {
  // A block not bare-closed before the next opening fence / end-of-input is
  // malformed (unclosed) — inert on its own (spec-0002 §A.1 delimitation).
  if (!wellFormed) return { status: 'inert', cause: 'unclosed', blockIndex: index };
  let parsed;
  try {
    parsed = parseYaml(inner);
  } catch (e) {
    // Fail-closed: ANY parser throw yields an inert block, never an escape.
    // A YamlError is a malformed block; a non-YamlError (e.g. a RangeError
    // from deeply nested input overflowing the recursive parser) must not
    // crash runCheck — it too becomes inert.
    return { status: 'inert', cause: e instanceof YamlError ? 'malformed' : 'parse-error', blockIndex: index };
  }
  const record = validate(parsed);
  if (record == null) return { status: 'inert', cause: 'schema', blockIndex: index };
  return { status: 'record', record, blockIndex: index };
}

// Parse a comment into { status, blocks? } (spec-0002 §A.1 v4 / adr-0019).
//   status 'none'  — no grove-verdict block at all (not a candidate record)
//   status 'multi' — one or more candidate blocks, each parsed INDEPENDENTLY:
//                    blocks: [{ status: 'record'|'inert', record?/cause?, blockIndex }]
//                    in document order (blockIndex 0-based, higher = later).
// A malformed/schema-invalid block is inert on its own and never inerts a
// well-formed sibling in the same comment (per-block isolation, adr-0019 Dec 2).
export function parseComment(comment) {
  const richBlocks = extractTaggedBlocks(comment.body, 'grove-verdict');
  if (richBlocks.length === 0) return { status: 'none', blocks: [] };
  return { status: 'multi', blocks: richBlocks.map(parseBlock) };
}

// Single-block back-compat surface (the emit round-trip posts one block per
// comment). Returns the FIRST block's result in the legacy shape.
//   status 'none' | 'inert' (with cause) | 'record' (with record + comment).
export function parseRecord(comment) {
  const parsed = parseComment(comment);
  if (parsed.status === 'none') return { status: 'none' };
  const first = parsed.blocks[0];
  if (first.status === 'record') return { status: 'record', record: first.record, comment };
  return { status: 'inert', cause: first.cause };
}

// §A.4 admissibility over platform metadata.
// posterPolicy: { record_poster_allowlist?: string[] }
export function checkAdmissibility(comment, posterPolicy = {}) {
  // unedited
  const created = comment.createdAt;
  const updated = comment.updatedAt;
  const edited = comment.edited === true || (updated != null && created != null && updated !== created);
  if (edited) return { admissible: false, cause: 'edited' };
  // authorized poster
  const allowlist = posterPolicy && posterPolicy.record_poster_allowlist;
  let authorized;
  if (Array.isArray(allowlist)) {
    authorized = allowlist.includes(comment.author);
  } else {
    authorized = DEFAULT_POSTER_ASSOCIATIONS.has(comment.authorAssociation);
  }
  if (!authorized) return { admissible: false, cause: 'unauthorized' };
  return { admissible: true };
}
