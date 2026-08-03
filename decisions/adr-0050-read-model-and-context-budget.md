---
id: adr-0050-read-model-and-context-budget
type: adr
status: gated  # self-checked against the adr-0051 body contract this set proposes; the trunk proposal (rev 3) was ratified in-session by the maintainer 2026-08-03 ("ratify the trunk" — D5 channel); the approved flip awaits the maintainer's review of this text
depends_on: [adr-0004-spec-lifecycle-and-organization, adr-0011-relations-companion]
owner: agent
updated: 2026-08-03
---

# ADR-0050: the read model — what a cold-started role loads, and a context budget

## Context

Grove has never defined how much of the corpus a dispatched role reads. The
executor charter says both "all context must travel through the artifact and its
`depends_on` graph" (executor.md:21-22) and "read exactly the spec/decision you
were pointed at, plus what it `depends_on`" (executor.md:32-34), and the two were
never reconciled. On one traced task (spec-0005), defensible readings of that
rule span **1.63× the subject's word count** (one hop, decision dep included) to
**10.8×** (transitive closure — which reaches the 21,622-word operationally-dead
spec-0002 through approved adr-0026). Nothing in the runtime walks the graph;
the read model is pure convention, and the convention is ambiguous. grove#197's
reconnaissance quoted 3.5× as the executor's context multiplier; adversarial
re-verification showed that number was a third reading of the same undefined
rule, not a mandated cost.

The corpus already contains the correct doctrine, stated for one role only: the
contract-author "re-read[s] decisions only to recover rationale, not to
reconstruct current truth" (contract-author.md:30-32). Meanwhile `depends_on`
serves four semantics at once — genuine coupling (adr-0011), the adr-0016
dual-listing bridge, the adr-0044 amendment leg, and machinery-compat padding —
and doubles as an implied preload list. The shipped charter projections already
strip frontmatter, so the runtime executor never sees its charter's dependency
list; convention and delivery disagree.

## Decision

1. A new companion, `charters/context.md`, becomes the single home of the **read
   model**, with the same no-restatement clause as `lifecycle.md`,
   `relations.md`, and `versioning.md` (the adr-0008/0011/0010 homing pattern).
2. The read model: a cold-started role's working context is exactly (a) its
   charter projection; (b) the subject artifact; (c) the subject's `depends_on`
   targets at **depth exactly 1, no transitive closure**, filtered to
   current-truth types (`spec`, `charter`, config/companion carriers) in
   `gated`/`approved` status; (d) the named config carriers the charter already
   specifies (`.grove/config.toml`, its tokens, the test-deps ledger).
3. **Decisions are never preloaded.** A `type: adr` target in `depends_on` is
   consulted on demand to recover rationale, never read to reconstruct current
   truth — the contract-author's existing clause, generalized to every reading
   role. A role that finds a genuine gap routes it as a finding, as the executor
   charter already directs.
4. **`depends_on` is a maintenance edge, not a reading list.** It remains the
   flow/drift/blast-radius edge exactly as `relations.md` defines it; the
   validator's use is unchanged. The executor charter's "all context must
   travel" sentence is amended to point at the read model.
5. **Self-containment duty.** A charter or spec states every rule its reader
   must apply — inline or via a named companion. Citing a decision is
   provenance, never delegation of operative content.
6. **Budget.** Context multiplier := words loaded under the read model ÷ subject
   words. Target: **p50 ≤ 1.5×**; any single dispatch above 3× is a loud
   anomaly to report. The budget is a canary, never a block. The operative
   baseline is re-measured at this set's landing commit under adr-0054's method
   (the historical 1.63× reading included a decision dependency this model
   excludes; under the model as defined the traced task is ~1.24× plus config).

## Consequences

`charters/context.md` is authored; the executor and implementation-planner
charters' Method wording is amended to reference it; `relations.md` gains a
one-line pointer. These are landing obligations enumerated on this decision's
change request, tracked per adr-0052 — not body checklists here.

Curve 2 of grove#197 becomes well-defined. Stated honestly: its fall from
"3.5×" is largely definitional — the old number was one reading of an undefined
rule. The enforced, non-definitional content is the budget, the depth-1 rule,
and decisions-off-the-read-path. The multiplier definition is offered to the
sdd-gauntlet program as the shared currency for its H4 review-cost proxy
(adr-0054). Draft adr-0038's assumption that bounded context includes "live
decisions" is re-anchored under adr-0054's fork-preservation clauses; this
decision is a prerequisite for either fork path — freeze bounds the store only
if exclusion is mechanical.

Floors are untouched: the executor still reads a whole `gated`/`approved`
artifact (adr-0005 D2); no plan or derived carrier is created (adr-0037).

## Considered and rejected

- **Compiled task briefs** (generated, word-budgeted executor context): a
  derived carrier of contract content is a second source of authority — the
  defect class grove litigated on the #186 persisted plan ("the artifact wins",
  adr-0037), and a brief either fails adr-0005 D2 or becomes a rival contract by
  satisfying it. Also centralizes assembly against adr-0012 E5. The surviving
  kernel — budgeted context — lands here with the artifact itself remaining the
  thing read.
- **Retargeting decision edges to `informed_by`** to get decisions off the read
  path: forbidden by the relations honesty mirror — the coupling is real; what
  changes is read semantics, not the edge.
- **A transitive-closure read model with pruning**: rejected for depth-1 —
  closure reaches dead contracts today, and no machinery exists to prune it.

## Open questions

- Whether the validator's blast-radius reads deserve their own stated budget
  (parked; the validator is already non-transitive by adr-0016).
