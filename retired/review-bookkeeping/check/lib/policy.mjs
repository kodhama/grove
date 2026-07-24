// Policy assembly + the owed-map (spec-0002 §B, §C.1, §C.2).
//
// The owed-map is NOT a stored table: it is assembled at run-time from the
// reviewer charters' `grove-review-declaration` blocks plus the
// `grove-review-policy` block — all read from the PROTECTED default branch
// (never PR HEAD). The four canonical reviews and the fail-closed override
// are explicit check rules on top of the assembly (pure assembly fails OPEN
// for an unclaimed type).

import { parseYaml } from './yaml.mjs';
import { parseToml } from './toml.mjs';
import { extractFencedBlocks } from './blocks.mjs';
import { normalizePath } from './normalize.mjs';

export const ALL_REVIEWS = ['conformance', 'code-reviewer', 'spec-adversary', 'decision-adversary'];

const DEFAULT_ARTIFACT_DIRS = ['decisions', 'specs', 'charters'];
const DEFAULT_PROSE_EXTENSIONS = ['.md', '.txt', '.rst'];

// adr-0013 dec 1 install defaults for the carrier-of-record keys (§C.1):
// an absent key falls to these, NEVER to silent exclusion. The runtime dir
// default tracks the consumer install path, which adr-0018 D5 relocates from
// `.grove/check/` to `.grove/internal/check/` (grove-authoritative internal
// namespace). grove-self sets `check_runtime_dir` explicitly, so this backstop
// only governs a consumer whose policy omits the key.
const DEFAULT_CHECK_RUNTIME_DIR = '.grove/internal/check/';
const DEFAULT_CHECK_WORKFLOW_PATH = '.github/workflows/grove-review-bookkeeping.yml';

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

  // §C.1 scope key (adr-0013 dec 1/2; INV19): absent ⇒ strict (fail-closed
  // silence default); an UNRECOGNIZED value likewise resolves to strict — a
  // misparse never softens jurisdiction — with the raw value preserved so the
  // §D header can name it on every run (INV22, round-3 W2).
  let scope = 'strict';
  let scopeRaw = null;
  let scopeUnrecognized = false;
  if (obj.scope != null) {
    scopeRaw = String(obj.scope);
    // Only a STRING value exactly `strict`/`scoped` is honored. A non-string
    // scope (a YAML list/mapping) must not coerce via String() into a soft
    // mode — e.g. `scope: [scoped]` would stringify to 'scoped' and silently
    // enable scoped without the unrecognized note. Route it to the
    // unrecognized ⇒ strict path like any malformed value (INV19; adr-0013
    // dec 2: softness is never inferred). Strictly more fail-closed.
    if (typeof obj.scope === 'string' && (scopeRaw === 'strict' || scopeRaw === 'scoped')) scope = scopeRaw;
    else scopeUnrecognized = true; // resolves to strict
  }

  // §C.1 carrier-of-record keys (adr-0013 dec 1): absent ⇒ install default,
  // never silent exclusion; provenance (written|defaulted) feeds the
  // carrier-unresolved payload (§D).
  const carrier = (key, dflt) =>
    obj[key] != null
      ? { path: String(obj[key]), provenance: 'written' }
      : { path: dflt, provenance: 'defaulted' };

  return {
    scope,
    scopeRaw,
    scopeUnrecognized,
    checkRuntimeDir: carrier('check_runtime_dir', DEFAULT_CHECK_RUNTIME_DIR),
    checkWorkflowPath: carrier('check_workflow_path', DEFAULT_CHECK_WORKFLOW_PATH),
    artifactDirs: obj.artifact_dirs != null ? toList(obj.artifact_dirs) : DEFAULT_ARTIFACT_DIRS,
    reviewlessTypes: toList(obj.reviewless_types),
    allowlist: toList(obj.non_behavioral_allowlist).map(normalizePath).filter(Boolean),
    proseExtensions: obj.prose_extensions != null ? toList(obj.prose_extensions) : DEFAULT_PROSE_EXTENSIONS,
    recordPosterAllowlist: obj.record_poster_allowlist != null ? toList(obj.record_poster_allowlist) : null,
  };
}

// adr-0018 D10 — the consumer review-policy split. The consumer scope choice +
// corpus policy live in `.grove/review.toml` (TOML); the two grove-wiring
// carrier keys live in an internal TOML file. The check reads the split by
// SYNTHESIZING the equivalent `grove-review-policy` fenced block from the two
// TOML sources, so every downstream consumer (parseReviewPolicy, the bootstrap
// self-detect's block-presence check, resolveCarriers) is byte-identical to the
// single-file (grove-self `charters/review-policy.md`) path.
//
// Fail-close (adr-0013 AC4): a carrier key ABSENT from the wiring file is
// OMITTED from the synthesized block — never forged into a passing value — so
// parseReviewPolicy falls it to the install default (`defaulted` provenance),
// which resolveCarriers then reds if that path does not exist on the protected
// branch. The split changes WHERE the key lives, never THAT its absence fails
// closed.
const SYNTH_SCALAR_KEYS = ['scope'];
const SYNTH_ARRAY_KEYS = [
  'artifact_dirs',
  'reviewless_types',
  'non_behavioral_allowlist',
  'prose_extensions',
  'record_poster_allowlist',
];
const SYNTH_CARRIER_KEYS = ['check_runtime_dir', 'check_workflow_path'];

function yamlScalar(v) {
  return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function yamlFlowArray(arr) {
  return '[' + arr.map((x) => yamlScalar(x)).join(', ') + ']';
}

export function synthesizePolicyBlock({ reviewToml = '', wiringToml = null } = {}) {
  // Parse each source separately and TAG which file failed, so the caller
  // (git-adapter) can name the right path in its error rather than blaming
  // review.toml for a malformed wiring file.
  let review;
  let wiring;
  try {
    review = parseToml(reviewToml || '');
  } catch (e) {
    e.source = 'review';
    throw e;
  }
  try {
    wiring = wiringToml == null ? {} : parseToml(wiringToml);
  } catch (e) {
    e.source = 'wiring';
    throw e;
  }
  const lines = ['```grove-review-policy', 'schema: 1'];
  for (const k of SYNTH_SCALAR_KEYS) {
    if (review[k] == null) continue;
    // Fail-CLOSED equivalence (adr-0013 dec 2 / INV19): a scalar key must reach
    // parseReviewPolicy's `typeof === 'string'` guard with its ORIGINAL type. A
    // non-string (e.g. `scope = ["scoped"]`) must NOT be String()-coerced into a
    // soft value — emit it in a shape parseYaml reads back as non-string so the
    // guard fires and resolves to strict/unrecognized, byte-equivalent to the
    // single-file YAML path. (Softness is never inferred from malformed input.)
    const v = review[k];
    if (typeof v === 'string') lines.push(`${k}: ${yamlScalar(v)}`);
    else if (Array.isArray(v)) lines.push(`${k}: ${yamlFlowArray(v)}`);
    else lines.push(`${k}: ${String(v)}`); // boolean/number -> a non-string YAML literal
  }
  for (const k of SYNTH_ARRAY_KEYS) {
    if (review[k] != null) lines.push(`${k}: ${yamlFlowArray(toList(review[k]))}`);
  }
  // Carrier keys come ONLY from the wiring file; an absent key is omitted so the
  // parser applies the install default (the fail-close, adr-0013 AC4).
  for (const k of SYNTH_CARRIER_KEYS) {
    if (wiring[k] != null) lines.push(`${k}: ${yamlScalar(wiring[k])}`);
  }
  lines.push('```');
  return lines.join('\n');
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

// assemblePolicy({ reviewPolicyText, reviewPolicyPath?, charterTexts }) ->
// resolved policy. `charterTexts` entries may be bare strings (back-compat) or
// { path, text } objects — the paths of entries carrying a
// grove-review-declaration block become `declarationPaths`, the
// "reviewer-declaration files" of INV21's gate-carriers scope basis.
export function assemblePolicy({ reviewPolicyText = '', reviewPolicyPath = null, charterTexts = [] } = {}) {
  const rp = parseReviewPolicy(reviewPolicyText);
  const declarations = [];
  const declarationPaths = [];
  for (const entry of charterTexts) {
    const isEntry = entry != null && typeof entry === 'object';
    const text = isEntry ? entry.text : entry;
    const d = parseReviewDeclaration(text);
    if (d) {
      declarations.push(d);
      if (isEntry && entry.path != null) {
        const p = normalizePath(entry.path);
        if (p != null) declarationPaths.push(p);
      }
    }
  }
  const passClassByReview = new Map();
  const typesByReview = new Map();
  for (const d of declarations) {
    passClassByReview.set(d.review, d.passClass);
    typesByReview.set(d.review, new Set(d.types));
  }
  const reviewlessTypes = new Set(rp.reviewlessTypes);

  function declaredFor(type) {
    const declared = [];
    for (const [review, types] of typesByReview) {
      if (types.has(type)) declared.push(review);
    }
    return declared;
  }

  function owed(type) {
    if (reviewlessTypes.has(type)) return [];
    // fail-closed override: an unclaimed, non-reviewless type owes the full set
    const declared = declaredFor(type);
    if (declared.length === 0) return [...ALL_REVIEWS];
    return declared;
  }

  // §D remedy-hint substrate (round 3): true iff `type` owes the full set via
  // INV7's fail-closed override — no reviewer declares it AND it is not
  // positively declared reviewless. Distinct from a declared type that merely
  // happens to owe all four, and from a reviewless type that owes nothing.
  function unclaimedType(type) {
    if (reviewlessTypes.has(type)) return false;
    return declaredFor(type).length === 0;
  }

  return {
    ...rp,
    declarations,
    declarationPaths,
    reviewPolicyPath: reviewPolicyPath != null ? normalizePath(reviewPolicyPath) : null,
    reviewlessTypesSet: reviewlessTypes,
    owed,
    unclaimedType,
    passClass: (review) => (passClassByReview.has(review) ? passClassByReview.get(review) : null),
    allReviews: ALL_REVIEWS,
  };
}

// The §C.2/INV14 prose predicate, membership-agnostic: returns the normalized
// path if it is prose-shaped (extension in the declared prose set AND first line
// not a shebang), else null. `allowlistExempts` (listed ⇒ exempt) and
// `allowlistEligible` (unlisted ⇒ hint-eligible, adr-0022 D1) share this exact
// shape and differ ONLY on allowlist membership — extracted so a future change
// to the predicate cannot silently diverge the two (code-review advisory,
// adr-0022 executor pass).
function proseShapedPath(policy, path, content) {
  const norm = normalizePath(path);
  if (norm == null) return null;
  if (!policy.proseExtensions.includes(extOf(norm))) return null;
  const firstLine = String(content == null ? '' : content).split(/\r\n?|\n/, 1)[0] || '';
  if (firstLine.startsWith('#!')) return null;
  return norm;
}

// §C.2 allowlist prose predicate (INV14): an allowlisted path is honored only
// if it is prose-shaped (declared prose extension, first line not a shebang). A
// path failing the predicate is treated as if unlisted.
export function allowlistExempts(policy, path, content) {
  const norm = proseShapedPath(policy, path, content);
  return norm != null && policy.allowlist.includes(norm);
}

// §D remedy-hint support (adr-0022 D1): a prose-shaped path that is NOT currently
// listed — the discoverability case the allowlist remedy hint targets. Grants no
// exemption (INV14 untouched); it only reports that the explicit, human-owned
// allowlist add is an available cure. Frontmatter is checked by the caller (the
// hint is for no-frontmatter orientation prose).
export function allowlistEligible(policy, path, content) {
  const norm = proseShapedPath(policy, path, content);
  return norm != null && !policy.allowlist.includes(norm);
}

function extOf(path) {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot < 0 ? '' : base.slice(dot);
}
