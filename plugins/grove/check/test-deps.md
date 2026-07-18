---
id: ledger-grove-review-bookkeeping-check
type: ledger
status: gated
implements: spec-0002-review-bookkeeping-check
depends_on: [spec-0002-review-bookkeeping-check, adr-0006-operational-conformance-mechanism, adr-0013-check-scope-mode, adr-0014-install-is-invisible-and-ungated, adr-0015-reviewer-machine-boundary, adr-0019-batched-verdict-records]
owner: agent
updated: 2026-07-18
---

# test-deps — review-bookkeeping check core

> Per-package test-deps ledger (`adr-0006` dec 4). This is the **first
> worked example** of the ledger, and it pins the concrete convention
> `spec-0002` Open Q8 parked (location, format, file→package mapping).
> Being a real, read-by-the-harness ledger closes `adr-0006`'s unexecuted
> AC ("a worked example of a per-package test deps ledger exists").

## The convention this ledger pins (Q8)

- **File → package mapping.** A file named `test-deps.md` sits at a test
  package's **root**. The package that owns a given code path is the one
  rooted at the **nearest ancestor directory** containing a
  `test-deps.md` (the same nearest-ancestor rule tools use to find
  `package.json`/`tsconfig.json`). This package root is
  `plugins/grove/check/`; every `lib/*.mjs` and `test/*.mjs` under it
  belongs to it.
- **Format.** A fenced ```` ```grove-test-deps ```` block (mirroring
  grove's `grove-verdict` / `grove-review-declaration` /
  `grove-review-policy` machine-readable fenced-block precedent). Fields:
  `schema` (int, `1`), `specs` (list of spec ids, each may carry an
  `@vN` pin), `decisions` (list of decision ids). Version suffixes are
  stripped before resolution (`versioning.md`). The prose around the
  block is for humans; only the fenced block is read.
- **How the check reads it (`spec-0002` §A.3 step 3).** For a code
  subject path (no frontmatter), the check walks HEAD-tree ancestors
  from the code path upward to the nearest `test-deps.md`, parses its
  `grove-test-deps` block, and resolves each declared spec/decision id
  through the artifact index to a path — those paths are the code's
  fidelity upstream `U`. A code path with no ancestor ledger, or a
  ledger id that does not resolve, is fail-closed
  (`no-reviewable-upstream` / `unresolvable-reference`, `adr-0005` dec 3).

## Declared upstreams (the tests rest on these)

The behavioral tests in `test/` derive from `spec-0002`'s GWT scenarios
(S1–S23) and EARS invariants (INV1–INV22); the fingerprint, policy,
admissibility, scope-mode, and ledger conventions they encode trace to
the decisions below. The scope-mode tests (INV19–INV22, S21–S23) rest on
`adr-0013-check-scope-mode` (approved 2026-07-17), the durable decision
the `spec-0002` v2 amendment cites. The shell bootstrap self-detect tests
(the `groveInstalledOnBase` / `bootstrapSelfDetect` discriminator — "grove
does not gate its own arrival") rest on
`adr-0014-install-is-invisible-and-ungated` (approved 2026-07-18); this is
shell orchestration governed by that decision, not a spec-0002 core
algorithm, so it carries no spec-0002 amendment.

The **record-emitter** tests (`test/judgment.test.mjs`,
`test/emit.test.mjs`, `test/emitter.test.mjs`, and `test/basis.test.mjs`
for the shared-basis extraction) rest on
`adr-0015-reviewer-machine-boundary` (approved 2026-07-18): the machine
half of the reviewer/machine boundary — a reviewer emits CI-agnostic
judgment, the machine stamps the `§A.2` record with a machine-computed
`grove-fp-1`. The emitter shares the check's own `reviewBasis` +
`fingerprint`, so the stamp and the freshness check agree by construction;
the round-trip test (judgment -> emit -> the actual `runCheck` -> GREEN) is
that agreement's proof. The emitter follows `match.mjs`'s **per-file**
basis (one record per reviewed file) — the referent the check actually
verifies. `spec-0002` §A.3's whole-`S` basis prose has since been
**reconciled to that per-file referent** by the 2026-07-18
`adr-0015` amendment (`spec-0002@v3`): §A.3, **INV3**, and the §Terms
`fingerprint` shorthand now state the per-owed-pair-path basis (`[f]` /
`[f] ∪ U(f, C)`), closing the discrepancy this note once flagged. Because
`match.mjs` already computes per-file, the corrected INV3 already holds —
the `@v2 → @v3` pin bump was a **mechanical re-verification, not an
owed code change**.

The **batched-verdict-records** tests (the `records.mjs` multi-block
read — each well-formed `grove-verdict` block in a comment is its own
record; a malformed block is inert per-block, not per-comment — and the
`match.mjs` within-comment **block-index tiebreak** in latest-covering
selection) rest on `adr-0019-batched-verdict-records` (approved
2026-07-18): the lift of the "one comment = one record" packaging cap.
`spec-0002`'s §A.1 carrier/selection rules, **INV9**, and **S7** were
re-cast by the 2026-07-18 `adr-0019` amendment (`spec-0002@v3 → @v4`) —
so the pin below advances to `@v4`. Unlike the `@v2 → @v3` bump, this one
**owes a code change**: `lib/records.mjs`'s `blocks.length > 1 ⇒ inert`
rejection is removed (one record per well-formed block) and `lib/match.mjs`
selection gains the block-index minor key (`adr-0019` Consequence 2–3).

```grove-test-deps
schema: 1
specs:
  - spec-0002-review-bookkeeping-check@v4
decisions:
  - adr-0012-methodology-delivery-machinery
  - adr-0005-tdd-and-artifact-gated-dispatch
  - adr-0006-operational-conformance-mechanism
  - adr-0013-check-scope-mode
  - adr-0014-install-is-invisible-and-ungated
  - adr-0015-reviewer-machine-boundary
  - adr-0019-batched-verdict-records
```
