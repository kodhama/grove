---
id: adr-0011-transient-specs-frozen-at-fulfillment
type: adr
status: draft  # DELIBERATELY parked at draft — validation-gated; see Consequences. Nothing builds on this.
depends_on: [adr-0004-spec-lifecycle-and-organization, adr-0008-lifecycle-enum-companion]
owner: agent
updated: 2026-07-13
---

# ADR-0011 (draft): specs as transient gated contracts, frozen at fulfillment

> Provenance: shaped from a maintainer conversation (2026-07-13, kodhama
> session) on corpus entropy and spec lifecycle in agent-driven
> development. Evidence base: `research-0011-spec-lifecycle-prior-art`
> (deep-research annex, same date, in `decisions/research/`). This draft
> is **not awaiting approval** — it is parked by explicit maintainer
> intent pending pre-registered empirical validation (the experiment
> protocol, homed in the study repo once created). If approved later, it
> supersedes `adr-0004` **in part** (items 1–2: current-behavior specs,
> revise-in-place) — adr-0004 items 3 (GWT+EARS criteria), and the
> delta-note fields of item 4, carry forward into this model.

## Decision (proposed — in force nowhere while `draft`)

In development where agents write most code and prose and the human
cannot review either at volume:

1. **The spec's live window is unchanged**: rigorous, human-gated before
   implementation (`draft → gated → approved` per the lifecycle
   companion), revise-in-place *within* that window. The spec is the
   human's primary control surface.
2. **Enforced binding at the conformance gate**: a spec may be marked
   fulfilled only when every acceptance criterion maps to a named
   automated test, and each such test names its upstream (the spec id) —
   the binding is a checked gate, not a norm. (The test-names-upstream
   half is already trellis doctrine, `inv-graph-maintenance`.)
3. **Freeze at fulfillment**: at that gate the spec becomes an
   append-only record — terminal state **`fulfilled`** (lifecycle
   amendment, see Consequences), forward-pointing to its merge and
   tests. It is never reconciled against later code changes.
4. **Code + tests are the sole source of truth for current behavior.**
   Rationale stays in decisions (append-only, as today).
5. **Delta specs**: later observable-behavior changes require a new,
   small, gated spec through the same gate — no observable change
   without a gated upstream artifact. Deltas are retained append-only
   (they are the reconstructable intent log), formatted per adr-0004
   item 4's field set (WHAT/WHY/SCOPE/POINTER/VALUE/CONFIDENCE) plus
   acceptance criteria.
6. **Verification independent of the executor's tests**: the conformance
   review derives held-out probes from the criteria it reads, never
   shown to the executor. (Answer to the SpecBench finding — visible
   suites are saturatable; see annex. This is `inv-independent-judgment`
   applied to test suites.)
7. **Overviews are generated, never hand-maintained**; periodically a
   reconstruction (fold of the delta log) may be human-ratified as a
   checkpoint baseline — the cheapest whole-system review the human
   gets, and the leak detector (reconstruction vs. code+tests divergence
   signals an ungated change or a bad delta).
8. **Durability doctrine + sensor**: an artifact may be durable only if
   append-only or machine-enforced. Runs as a report-only
   corpus-reviewer check with an append-only firing ledger
   (`promote_when` criterion in its frontmatter); promotion to a trellis
   principle only from that ledger's evidence.

## Context

**Why reopen adr-0004 two days after ratification.** Not a re-litigation
of its inputs — a new question and new evidence. adr-0004 answered "how
does a spec absorb change" assuming the spec corpus is *maintainable*;
the new question is what happens at agent volume where no human reviews
reconciliation, making the revise-in-place corpus **mutable durable
prose maintained by unreviewed generators** — drift with a certificate
of authority. New evidence (annex, verified): living-doc maintenance
lost in its own tradition (Adzic 2020: 12% vs 57%); prose-code drift at
scale (Wen 2019, 1.3B changes); link maintenance as the dominant
traceability cost (Tian 2021); agents saturating visible test suites
while failing held-out intent (SpecBench 2026, ~28pp/10x). Counter-
evidence carried honestly: Mäder & Egyed 2015 (maintained links: +24%
speed, +50% correctness) — answered by proposal item 2's persistent
test→spec annotations (frozen ≠ unlinked); Reeves' staleness critique —
attenuated (targets design docs frozen *before* implementation; this
freezes a requirements artifact *after* merge).

**This proposal vs. adr-0004's rejected models 2 and 3** — the
rejections are answered, not ignored:

- Model 2 (durable delta artifacts) was rejected as "one behavioral
  contract split across two documents." That objection assumed a living
  spec *plus* deltas. This model keeps **no living spec**: behavior has
  one home (code + tests); deltas are historical intent records, a
  different kind of information. Note the incumbent model itself keeps
  behavior in two homes (spec AND code+tests) — the drift surface this
  proposal removes.
- Model 3 (supersession lineage) was rejected because "nobody reads the
  archive to reconstruct current truth" (math-quest CLAUDE.md rule 7).
  Preserved here: current truth is answered by code + tests, never by
  archive-walking; reconstruction is exceptional (checkpoints, audits,
  rewrites), not routine. The bounded context becomes code + tests +
  live decisions — specs leave it entirely once fulfilled.
- Model 2's "unbounded artifact count" — answered by ratified
  checkpoints (fold-and-baseline) and archive-loading discipline:
  `fulfilled` artifacts are loaded by nobody.
- adr-0004's own cost admission stands as motivation: math-quest's
  555-line spec with amendment markers "threaded through nearly every
  invariant" is the interleaving cost paid *today*, growing with agent
  throughput.

## Considered and rejected

- **Status quo (adr-0004 model 4)** — not rejected; it is the incumbent,
  remains in force, and is the control arm of the validation experiment.
  This ADR proposes; the protocol decides.
- **Spec-as-living-source-of-truth** (OpenSpec-style merge-deltas-into-
  living-corpus; Tessl-style spec-as-source) — rejected on the annex's
  verified evidence (maintenance economics; non-deterministic
  regeneration observed first-hand by Böckeler) and on this family's
  constraint: no human reviews the reconciliation.
- **Executable-GWT durable specs** (feature files as the living
  contract) — coherent under the durability doctrine (machine-enforced),
  rejected for re-buying BDD's documented glue economics; plain
  falsifiable criteria + semantic binding achieve the same guarantee
  (per the GWT analysis in the shaping conversation).
- **Immediate rollout on approval** — rejected by maintainer intent:
  adoption is validation-gated even if the maintainer is persuaded.

## Consequences

- **While `draft`: nothing changes anywhere.** adr-0004 governs; no
  overlay, charter, or README moves. This ADR may not be cited as
  `depends_on` by any building artifact (lifecycle rule).
- **If approved, the rollout owes, in order**: (1) an upstream partial
  supersession of `trellis/spec-0001` §3.7 (revise-in-place is ratified
  *at trellis level* — grove cannot contradict its dependency; this is
  a trellis-side decision first); (2) lifecycle companion amendment
  (`fulfilled` terminal state — touches `adr-0008`'s companion, vendored
  family-wide); (3) adr-0004 marked superseded-in-part with forward
  pointer; (4) charter updates (contract-author, executor,
  conformance-reviewer: binding gate + held-out probes); (5) the
  durability sensor ships (report-only) — the only piece that may ship
  **before** approval, being model-agnostic measurement.
- **Validation gate**: this ADR moves from `draft` only on the
  experiment protocol's pre-registered pass/fail bars (protocol homed in
  the study repo; summary of results to be folded into this file's
  evidence at gate time so grove stays self-contained).

## Acceptance criteria

- [ ] The experiment protocol (study repo) is `approved` and frozen
      before any non-calibration run, and names this ADR as the decision
      it gates.
- [ ] Protocol bars met or the ADR is retired: each pre-registered
      hypothesis resolves pass/fail; a failed core hypothesis (H4 or H5,
      per protocol) retires this draft with a recorded reason.
- [ ] Before any status change: the upstream `trellis/spec-0001` §3.7
      question has a trellis-side decision (even if that decision is
      "trellis delegates spec mutability to the operating model").
- [ ] The durability sensor exists as a report-only corpus-reviewer
      check with an append-only firing ledger, deployable independent of
      this ADR's fate.

## Open questions (parked, ≤3)

- Materiality line mechanics: the criteria themselves draw the
  implementation-detail vs. observable-behavior line, but the
  conformance-reviewer needs a stated tie-break for edge cases
  (performance regressions, error-message text).
- Checkpoint cadence and who gates a checkpoint (human intent act, like
  any approval — but scheduled how?).
- Whether `fulfilled` is a fifth enum value or a convention over
  `superseded`-with-forward-pointer-to-tests (adr-0008 companion
  explicitly says the status field "never takes a fifth value" — the
  amendment must engage that sentence honestly).

## Self-check (gate) — run, with gating deliberately withheld

- Frontmatter present, well-typed; `depends_on` resolve (`adr-0004`
  approved, `adr-0008` approved — no draft dependencies; the research
  annex is cited in Provenance, not `depends_on`, because it is itself
  `draft`). PASS.
- Required sections present, matching sibling ADRs. PASS.
- Open questions: 3, at the ≤3 bound. PASS.
- Append-only discipline: new artifact; adr-0004 untouched. PASS.
- **Status**: self-check passes, but this artifact is held at `draft`
  **deliberately** — not because it is unfinished, but because the
  maintainer's recorded intent (2026-07-13) is that it must not be
  agent-consumable (`gated`) until validation evidence exists. Said out
  loud per trellis: this is an intentional deviation from the usual
  draft→gated flip-on-self-check, not an oversight.
