// Policy assembly + the owed-map (spec-0002 §B, §C.1, §C.2).
//
// The owed-map is NOT a stored table: it is assembled at run-time from the
// reviewer charters' `grove-review-declaration` blocks plus the
// `grove-review-policy` block — all read from the PROTECTED default branch
// (never PR HEAD). The four canonical reviews and the fail-closed override
// are explicit check rules on top of the assembly (pure assembly fails OPEN
// for an unclaimed type).

import { parseYaml } from './yaml.mjs';
import { extractFencedBlocks } from './blocks.mjs';
import { normalizePath } from './normalize.mjs';

export const ALL_REVIEWS = ['conformance', 'code-reviewer', 'spec-adversary', 'decision-adversary'];

const DEFAULT_ARTIFACT_DIRS = ['decisions', 'specs', 'charters'];
const DEFAULT_PROSE_EXTENSIONS = ['.md', '.txt', '.rst'];

function toList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}

// Parse the grove-review-policy block. Absent keys fall to the fail-closed
// interims (spec-0002 Q7).
export function parseReviewPolicy(text) {
  const blocks = extractFencedBlocks(text, 'grove-review-policy');
  const obj = blocks.length ? (parseYaml(blocks[0]) || {}) : {};
  return {
    artifactDirs: obj.artifact_dirs != null ? toList(obj.artifact_dirs) : DEFAULT_ARTIFACT_DIRS,
    reviewlessTypes: toList(obj.reviewless_types),
    allowlist: toList(obj.non_behavioral_allowlist).map(normalizePath).filter(Boolean),
    proseExtensions: obj.prose_extensions != null ? toList(obj.prose_extensions) : DEFAULT_PROSE_EXTENSIONS,
    recordPosterAllowlist: obj.record_poster_allowlist != null ? toList(obj.record_poster_allowlist) : null,
  };
}

// Parse a single charter body's grove-review-declaration block (or null).
export function parseReviewDeclaration(text) {
  const blocks = extractFencedBlocks(text, 'grove-review-declaration');
  if (blocks.length !== 1) return null; // 0 or ambiguous multi => no declaration
  const obj = parseYaml(blocks[0]) || {};
  if (obj.schema !== 1 || typeof obj.review !== 'string') return null;
  return {
    review: obj.review,
    types: toList(obj.types),
    passClass: toList(obj.pass_class),
  };
}

// assemblePolicy({ reviewPolicyText, charterTexts }) -> resolved policy.
export function assemblePolicy({ reviewPolicyText = '', charterTexts = [] } = {}) {
  const rp = parseReviewPolicy(reviewPolicyText);
  const declarations = [];
  for (const t of charterTexts) {
    const d = parseReviewDeclaration(t);
    if (d) declarations.push(d);
  }
  const passClassByReview = new Map();
  const typesByReview = new Map();
  for (const d of declarations) {
    passClassByReview.set(d.review, d.passClass);
    typesByReview.set(d.review, new Set(d.types));
  }
  const reviewlessTypes = new Set(rp.reviewlessTypes);

  function owed(type) {
    if (reviewlessTypes.has(type)) return [];
    const declared = [];
    for (const [review, types] of typesByReview) {
      if (types.has(type)) declared.push(review);
    }
    // fail-closed override: an unclaimed, non-reviewless type owes the full set
    if (declared.length === 0) return [...ALL_REVIEWS];
    return declared;
  }

  return {
    ...rp,
    declarations,
    reviewlessTypesSet: reviewlessTypes,
    owed,
    passClass: (review) => (passClassByReview.has(review) ? passClassByReview.get(review) : null),
    allReviews: ALL_REVIEWS,
  };
}

// §C.2 allowlist prose predicate (INV14): an allowlisted path is honored only
// if its extension is a declared prose extension AND its first line is not a
// shebang. A path failing the predicate is treated as if unlisted.
export function allowlistExempts(policy, path, content) {
  const norm = normalizePath(path);
  if (norm == null) return false;
  if (!policy.allowlist.includes(norm)) return false;
  const ext = extOf(norm);
  if (!policy.proseExtensions.includes(ext)) return false;
  const firstLine = String(content == null ? '' : content).split(/\r\n?|\n/, 1)[0] || '';
  if (firstLine.startsWith('#!')) return false;
  return true;
}

function extOf(path) {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot < 0 ? '' : base.slice(dot);
}
