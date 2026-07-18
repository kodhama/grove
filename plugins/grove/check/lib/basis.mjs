// Review-class basis selection (spec-0002 §A.3), shared by BOTH the freshness
// check (`match.mjs`) and the record-emitter (`emit.mjs`) — adr-0015 Decision 2.
//
// The basis is the set of paths grove-fp-1 is computed over for a record:
//   - quality review (decision-adversary/spec-adversary/code-reviewer): the
//     subject ALONE.
//   - fidelity review (conformance): the subject PLUS its check-derived
//     implements upstream U(S, C) (never read from the record).
//
// The emitter stamps the fingerprint the check will later verify; sharing this
// exact selection is the load-bearing correctness constraint — a reimplementation
// would drift and mint permanently-stale records. Per-file: `file` is a single
// subject path (adr-0015 Consequence 2 basis-granularity pin — the check
// recomputes freshness per owed-pair file, so a record certifies one file).

import { resolveUpstream } from './upstream.mjs';

export const FIDELITY = new Set(['conformance']);

// reviewBasis({ file, review, tree, index }) ->
//   { isFidelity, U: Set<path>, errors: [...], basis: [...paths], basisComputable }
// For fidelity, U is derived from HEAD (the implements edge for artifacts, the
// ledger for code); an unresolvable/absent upstream makes the basis
// non-computable (fail-closed, §A.3) — the caller reds with the upstream error.
export function reviewBasis({ file, review, tree, index }) {
  const isFidelity = FIDELITY.has(review);
  let U = new Set();
  let errors = [];
  if (isFidelity) {
    const ru = resolveUpstream([file], tree, index);
    U = ru.U;
    errors = ru.errors;
  }
  const basisComputable = !(isFidelity && errors.length);
  const basis = isFidelity ? [file, ...U] : [file];
  return { isFidelity, U, errors, basis, basisComputable };
}
