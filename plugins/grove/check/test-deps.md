---
id: ledger-grove-review-bookkeeping-check
type: ledger
status: gated
implements: spec-0002-review-bookkeeping-check
depends_on: [spec-0002-review-bookkeeping-check, spec-0003-review-asks-and-audit, adr-0006-operational-conformance-mechanism, adr-0013-check-scope-mode, adr-0014-install-is-invisible-and-ungated, adr-0015-reviewer-machine-boundary, adr-0018-gate-profile-and-trigger-split, adr-0019-batched-verdict-records, adr-0023-review-triage-blackboard]
owner: agent
updated: 2026-07-19
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

The **review-policy split** tests (`test/policy-toml.test.mjs`, and the
`.grove/review.toml` discovery + carrier fail-close cases in
`test/git-adapter.test.mjs`) rest on `adr-0018` D10: the consumer carrier
splits into `.grove/review.toml` (scope + corpus policy, TOML) +
`.grove/internal/review-wiring.toml` (the carrier keys). The check reads
the split by synthesizing the equivalent `grove-review-policy` block, so
`adr-0013` AC4's protected-branch carrier fail-close is preserved
byte-identically. `adr-0018` D5 also relocates the consumer check runtime
to `.grove/internal/check/` (the carrier-dir default).

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

The **review-ask** tests (`test/asks.test.mjs`, over `lib/asks.mjs`)
rest on `spec-0003-review-asks-and-audit` (@v1, approved 2026-07-19)
and its authorizing decision `adr-0023-review-triage-blackboard`: the
`grove-review-ask` record class (§A.1–§A.2 — spec-0002 §A.1
delimitation and §A.4 admissibility inherited by reference, `adr-0019`
batching), the two deterministic §A.3 effectiveness rules with the
both-fire flagged multiplicity, the fail-closed union of effective ask
types per frontmatterless subject, ask coverage (`ask_covered_files`,
§D.1/Terms), and the fingerprint-free ask serializer (an ask declares
an obligation, never a content attestation). This is **shadow
machinery** (adr-0023 D5): nothing in the shipped spec-0002 derivation
reads `lib/asks.mjs`, and the suite carries the spec-0003 INV1
regression proof — a `grove-review-ask` fence is invisible to the
`grove-verdict` extractor. The `spec-0002@v4` pin below is untouched
(spec-0003 amends no clause of it).

The **audit** tests (`test/audit.test.mjs`, over `lib/audit.mjs`) rest
on the same `spec-0003` (@v1) pin, §B–§C, and `adr-0023` D4 — the
phase-1 build (Consequence 3): the two deterministic residues
(`coverage residue = diff_files ∖ ask_covered_files`; the judgment
residue via the shared `scope.mjs` jurisdiction and `frontmatter.mjs`
type bases) and the §B.2 residue-conditional rule; the `grove-audit`
record class under the `adr-0015` judgment/stamp split (the emitter
stamps the coverage-residue manifest with per-path hashes, the
content/policy `grove-fp-1` fingerprints, the typed record-stream HWM
with the pinned `record_hwm: 0` empty-stream sentinel, and the flagged
rows — the auditor supplies only `auditor`/`dispositions`/`findings`);
§C.3 freshness (content, policy-carrier content/membership, and
typed-HWM staleness under the inherited exact-tag tokenizer — prose and
`grove-audit` blocks never invalidate); §C.4 auditor separation
including `resumed_by` dual attribution over the full stream
(rejection never un-produces); and §C.5's vacuity rule one level up.
Shadow machinery like the ask suite: the INV1 regression proves a
`grove-audit` fence invisible to both the `grove-verdict` extractor
and the ask reader.

The **shadow-comparator** tests (`test/compare.test.mjs`, over
`lib/compare.mjs`) rest on the same `spec-0003` (@v1) pin, §D, and
`adr-0023` D5 — the phase-2 build (Consequence 4): the five §D.1
per-PR metrics, derived by reuse only — the table-side owed set is
READ from `runCheck`'s own derivation (never re-derived), the
audit-side owed set composes `asks.mjs` effectiveness + the
fail-closed union, `audit.mjs` residues/§C.5 selection-and-vacuity/
§C.3 freshness (metric 4 naming the failed binding), and
`policy.owed`; metric 5's HWM races share `audit.mjs`'s
typed-fence membership rule via `typedRacesPast` (single-homed);
metric 3 pins the `0/0 (empty diff)` rendering (N1). §C.5 selection
is exercised as the read side (latest admissible audit wins; an
`auditor ∈ P` exclusion is reported, S7), and the §D.1 findings
surface covers flagged rows plus stamped-field-vs-recomputation
mismatches (INV9). The suite carries the phase's LOAD-BEARING
regression (adr-0023 AC3 / spec-0003 INV1, S11): the shipped check's
derivation, rendered view, and structured output are byte-identical
with and without ask/audit records in the stream — the comparator is
report-only (INV16), wired in `bin/check.mjs` as a stdout-only (the step
  itself extracted to `shell/compare-step.mjs` with its own suite)
section after the verdict, excluded from the job summary and the
structured output.

```grove-test-deps
schema: 1
specs:
  - spec-0002-review-bookkeeping-check@v4
  - spec-0003-review-asks-and-audit@v1
decisions:
  - adr-0012-methodology-delivery-machinery
  - adr-0005-tdd-and-artifact-gated-dispatch
  - adr-0006-operational-conformance-mechanism
  - adr-0013-check-scope-mode
  - adr-0014-install-is-invisible-and-ungated
  - adr-0015-reviewer-machine-boundary
  - adr-0018-gate-profile-and-trigger-split
  - adr-0019-batched-verdict-records
  - adr-0023-review-triage-blackboard
```

## The shadow-metrics sweep (`lib/metrics.mjs`, `shell/sweep.mjs`, `bin/shadow-metrics.mjs`)

Read-only measurement tooling (adr-0023 D5 follow-up ①, grove#91 milestone
list): ask→review closure/ordering and annotation-consumption metrics
(`test/metrics.test.mjs`) plus the per-PR sweep composition over the tested
shell pieces (`test/sweep.test.mjs`). A consumer of both record classes —
spec-0003 §A asks and spec-0002 §A verdicts — deriving no obligations and
gating nothing; the pins above (`spec-0003-review-asks-and-audit@v1`,
`spec-0002-review-bookkeeping-check@v4`) already carry its upstream context,
so no block change is owed.
