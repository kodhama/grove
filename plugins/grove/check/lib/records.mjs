// Verdict-record parsing and admissibility (spec-0002 §A.1, §A.2, §A.4).
//
// A verdict record is a fenced `grove-verdict` block (YAML per §A.2) inside a
// PR comment. Recognition is fail-closed: a comment with zero blocks is not a
// record; a comment with 2+ blocks is wholly inert; a block that fails the
// §A.2 schema (including absent/unknown `schema`) is inert. Admissibility
// (§A.4) then gates whether a schema-valid record may enter selection.

import { parseYaml, YamlError } from './yaml.mjs';
import { normalizePath } from './normalize.mjs';
import { extractFencedBlocks } from './blocks.mjs';

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

// Parse a comment into { status, record?, cause? }.
//   status 'none'   — no grove-verdict block at all (not a candidate record)
//   status 'inert'  — a candidate that fails recognition (multi-block or
//                     schema-invalid); never a record, never satisfies anything
//   status 'record' — a schema-valid record
export function parseRecord(comment) {
  const blocks = extractVerdictBlocks(comment.body);
  if (blocks.length === 0) return { status: 'none' };
  if (blocks.length > 1) return { status: 'inert', cause: 'multi-block' };
  let parsed;
  try {
    parsed = parseYaml(blocks[0]);
  } catch (e) {
    // Fail-closed: ANY parser throw yields an inert record, never an escape.
    // A YamlError is a malformed block; a non-YamlError (e.g. a RangeError
    // from deeply nested input overflowing the recursive parser) must not
    // crash runCheck — it too becomes inert.
    return { status: 'inert', cause: e instanceof YamlError ? 'malformed' : 'parse-error' };
  }
  const record = validate(parsed);
  if (record == null) return { status: 'inert', cause: 'schema' };
  return { status: 'record', record, comment };
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
