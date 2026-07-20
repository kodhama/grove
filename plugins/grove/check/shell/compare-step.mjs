// The shadow-comparator bin step (spec-0003 §D.2; adr-0023 D5 phase 2),
// extracted from bin/check.mjs so the report-only guarantee is unit-tested
// rather than living in the disclosed-untested bin zone (code-review medium
// on the phase-2 pass). Pure orchestration over the tested lib pieces:
// assembles the §C.3.2 policy-fingerprint recomputation basis (the SAME
// protected-branch carrier texts the policy was assembled from), computes the
// comparison, renders it, and writes ONE delimited section via the injected
// `write` — stdout only at the bin call site. Any error is swallowed into a
// written note: report-only means this step can never red (or green) the
// shipped check, alter its exit code, or touch its structured output
// (spec-0003 INV1/INV16, adr-0023 AC3). Throws only when the catch-path
// write itself throws — the honest bound its test pins.

import { computeComparison, renderComparison } from '../lib/compare.mjs';
import { normalizePath } from '../lib/normalize.mjs';

// The §C.3.2 policy-carrier basis (review-policy source + every discovered
// declaration file, first-wins) — SINGLE-HOMED here; the sweep imports it
// (code-review medium: a hand-copy had begun to drift the moment it existed).
export function buildProtectedTree({ policy, reviewPolicyText, charterEntries }) {
  const protectedTree = new Map();
  if (policy.reviewPolicyPath != null) protectedTree.set(policy.reviewPolicyPath, reviewPolicyText);
  for (const e of charterEntries) {
    const p = normalizePath(e.path);
    if (p != null && !protectedTree.has(p)) protectedTree.set(p, e.text);
  }
  return protectedTree;
}

// runComparatorStep({ changed, tree, comments, policy, derivation,
//   reviewPolicyText, charterEntries, write }) -> void (all output via write)
export function runComparatorStep({
  changed,
  tree,
  comments,
  policy,
  derivation,
  reviewPolicyText,
  charterEntries,
  write,
}) {
  try {
    const protectedTree = buildProtectedTree({ policy, reviewPolicyText, charterEntries });
    const comparison = computeComparison({
      diffFiles: changed,
      tree,
      comments,
      policy,
      derivation,
      protectedTree,
    });
    write('\n' + renderComparison(comparison) + '\n');
  } catch (err) {
    write(
      `\ngrove shadow comparator: skipped on error (report-only, never gating): ` +
        `${err && err.message ? err.message : err}\n`,
    );
  }
}
