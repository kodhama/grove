---
id: adr-0004-spec-lifecycle-and-organization
type: adr
status: draft
depends_on: [decision-0014, spec-0001]
owner: agent
updated: 2026-07-11
---

# ADR-0004: how a spec absorbs change, and how specs are organized for discovery

> Provenance: shaping grove#22 (spec lifecycle: current-behavior vs.
> delta), with grove#21 (GWT/EARS structured specs) and grove#20 (the
> process-gap incident that motivated both) as direct context. Research
> pass completed 2026-07-11, findings tagged `verified`/`inferred`
> throughout this draft — cited inline, not re-argued.

## Decision state

**Decided:**
- Specs represent **current behavior**, not a delta on top of some other
  document — settled in grove#22 itself, prior to this shaping pass, not
  reopened here.
- **Model 4 (formalized-but-transient) is the family rule for ALL specs**
  (2026-07-11, maintainer): revise-in-place current-truth; a change gets a
  structured delta note at the point of edit but that note isn't retained
  as its own artifact; significant changes additionally get a durable
  decision, minor/editorial edits don't. This **generalizes**
  `decision-0014`'s already-ratified shape (previously scoped to the
  invariant set specifically) to specs generally, rather than writing the
  rule fresh — `decision-0014` itself is not edited (it already works fine
  scoped to invariants); this ADR states the same shape as the general
  case and cites 0014 as precedent/proof-of-practice.
- **The `specs/README.md` contradiction fix is in scope for this ADR**
  (2026-07-11, maintainer): grove's, design-system's, and wisp's
  `specs/README.md` files (which currently say specs are append-only,
  inheriting from `decisions/README.md`) get corrected to state the
  model-4 rule, as part of this same change — landing the decision and
  the docs that describe it together, not as separate follow-up. See
  Consequences for the concrete file list.
- **Spec acceptance-criteria format, confirmed 2026-07-11 — corrected
  same turn.** Grove#21's full ask is adopted as-is for specs
  themselves: acceptance criteria are written in **both** GWT
  (Given/When/Then, for scenarios) **and** EARS (the "shall" forms, for
  invariants/requirements), exactly matching math-quest's own existing
  dual-format practice (S-prefixed scenarios in GWT; INV-prefixed
  invariants in EARS) — not one grammar standing in for the other.
- **Delta-note format, confirmed 2026-07-11, then corrected in the same
  turn: the delta note itself is NOT required to be written in GWT/EARS
  grammar.** It's a plain structured annotation *describing* a change to
  a GWT/EARS-shaped spec, not itself a scenario. **Two altitudes, not one
  uniform note:**
  - **Scenario-level** (routine — a single Given/When/Then or EARS
    statement changes): tag the scenario/invariant's own id inline,
    matching math-quest's *already-working* practice exactly — `S8
    (amended <date>, <trigger-ref>; was: <one-line prior Then-clause>)`.
    The id + tag *is* the delta note; no separate blockquote, no Gherkin
    sentence required for the tag itself.
  - **Section/spec-level** (broader — more than one scenario, or the
    spec's own scope/purpose changes): the five-field blockquote
    (dated marker / WHAT / WHY / SCOPE / POINTER, per Context), **plus two
    new fields**: **VALUE** (one sentence, in user/persona terms — "as a
    `<persona>`, X now happens instead of Y," not "the mechanism
    changed" — the field a PO reads first, and the same language a
    story-map view uses) and **CONFIDENCE** (`verified` | `inferred`,
    this family's own existing research-tagging convention, states
    plainly whether the delta is confirmed fact or judgment call).
- **Story-map organization, confirmed 2026-07-11: physical reorg, not an
  index-over-reorg overlay** — a deliberate choice against this draft's
  own research-based recommendation (see Context: index-over-reorg was
  the mechanically cheaper option, costing no id/`depends_on` churn).
  The maintainer chose structural reorganization anyway — specs are
  physically grouped by user activity (directory/path, not a separate
  index document). **Churn scope, also confirmed:** move files only,
  keep existing ids stable (e.g. `specs/installing/0005-curl-install-
  mechanical-vendoring.md`, same `id: spec-0005-...`) — `depends_on`
  references are unaffected since ids don't change; only file-path
  citations (if any exist in prose) need updating.

**Open:** none — all four items converged. Ready for self-check against
this repo's rubric before promoting past `draft`.

**Parked** (explicitly deferred, not part of this decision):
- The narrower "should executor's plan format be standardized" question
  from grove#22's tail — the maintainer flagged this as its own,
  more speculative question; it doesn't gate the lifecycle/organization
  decision here.

## Context

Research pass (full report available on request) read: grove#20/#21/#22
in full, trellis's `spec-0001` §3 (the ratified artifact contract),
`decision-0014` (2026-07-01, invariants-as-revise-in-place precedent),
`decision-0028` (checked directly — does **not** actually support the
citation grove#22 makes to it; the real precedent for "specs are living
current-truth" is spec-0001 §3.7 + decision-0014, not 0028), grove's own
`specs/README.md`/`decisions/README.md`, and the real spec corpora of
trellis, math-quest, wisp, and design-system.

**Load-bearing verified fact**: trellis's already-ratified `spec-0001` §3
point 7 states specs are **revise-in-place**, explicitly named as the
contrasting category to append-only decisions — this isn't a green-field
choice, it's already the family's ratified default. `decision-0014` gives
the working reasoning: "the invariant set is a compiled, revise-in-place
spec... not re-ratified per change... significant invariant changes are
recorded as ADRs; minor/editorial edits are just spec edits — no ADR." That
is structurally identical to model 4 below, ratified and running since
2026-07-01, a week before #22 raised the question — nobody in #22's
discussion cited it.

### The four candidate models (from grove#22), evaluated

1. **Informal delta** — edit in place, no dedicated marker at all. Cheapest,
   but weakest traceability; `verified`: this is closest to how trellis's
   own specs 0001-0005 are actually edited today (plain commits, no
   in-file amendment marker).
2. **Durable, separate "spec-delta" artifact type.** `verified` risk: this
   is exactly the "one behavioral contract split across two documents"
   shape math-quest's own `spec-slice-01-first-loop.md` explicitly
   rejected in its own "Reconciliation (amend vs. fork)" section, citing
   this family's "one home per kind of information" principle. Worst
   storage growth of the four (unbounded artifact count).
3. **Specs adopt decisions' supersede pattern** (walk a lineage to find
   "current"). `verified` tension: math-quest's own CLAUDE.md rule 7
   frames the bounded-context invariant as "spec + code + the live
   decisions it cites — never the whole archive... never [read ADRs] to
   reconstruct current-truth" — the whole reason decisions are append-only
   is that nobody needs them to answer "what's true right now." Making
   specs work the way decisions do reverses that property for the
   document type specifically meant to answer "what's true right now."
4. **Formalized but transient** (maintainer's stated lean) — real
   structure at delta time (ideally GWT/EARS-shaped, per #21), but not
   retained as a separate artifact; folded into the current-behavior spec,
   "why" afterward lives in git history + the motivating decision/issue.
   This is `decision-0014`'s exact shape, already ratified and exercised.

**All four models pay a real cost under many revisions, just in different
currencies** — models 2/3 pay it as "which of N files is current"; models
1/4 pay it as a single growing file where history and current-truth
interleave (`verified`: math-quest's `spec-slice-01-first-loop.md` is now
555 lines with amendment markers threaded through nearly every invariant,
e.g. "INV-1 (amended by ADR-0026, #121; was: 9 of the last 10)"). Neither
failure mode is free; this draft doesn't pretend model 4 is costless, only
that its cost is already being paid successfully in this family's largest
real spec corpus.

### An existing, unformalized delta template (verified, not invented for this draft)

Every real amendment note found in this family's corpus — kodhama-0005,
kodhama-0007, kodhama-0003, math-quest's `spec-placement.md` and
`spec-slice-01-first-loop.md` — independently converges on the same
five-field shape, without anyone naming it as a rule:

> `[dated marker] (DATE, trigger)` — **WHAT** changed (name the rule/id,
> quote the old reading) — **WHY** (the concrete trigger: incident,
> ruling, review finding) — **SCOPE** (what's preserved vs. superseded,
> explicit) — **POINTER** (where the live text now is, if not right here).

Where a spec is already GWT/EARS-scenario-shaped (per #21), the delta
collapses further: keep the scenario/invariant id, edit its Given/When/Then
in place, tag the id with what changed and why — math-quest already does
exactly this ("S8 (amended by #145)").

### Story-map organization

`verified`: math-quest already has a **working, unprompted precedent** —
component specs (`spec-mastery-engine`, `spec-placement`, etc.) keep
technical names; a lighter, ungated "living document"
(`design/Scope Prioritization.md`) provides the user-journey/story-map view
(Milestones → named Epics reading like user stories: "M1-E1 Página de
exercício"), and "slice specs" (`spec-slice-01-first-loop`,
`spec-slice-02-placement`) sit between the two, `depends_on`-citing the
component specs directly. This wasn't built in response to #22 — it
predates it, which is real evidence the pattern works in practice, not
just a proposal.

Sketching the same shape against trellis's actual 5 specs (installing,
leaving cleanly, keeping the corpus honest, tuning strictness) shows the
index-over-reorg approach costs nothing structurally — no id/frontmatter
churn, no `depends_on` graph disruption — while a physical reorg
(renaming/moving spec files into activity-named directories) would need to
either break existing ids or add redirection machinery for no clear
discovery gain at trellis's current corpus size (5 specs).

## Consequences

None of the following is executed by this ADR itself — per this repo's
own stage discipline, implementation follows approval, it doesn't
precede it. All four are follow-on work once this merges and is bumped
to `approved`:

1. **`specs/README.md` fixes** — `grove/specs/README.md`,
   `design-system/specs/README.md`, `wisp/specs/README.md` (currently
   identical, word-for-word copies stating specs inherit decisions'
   append-only discipline) corrected to state the model-4 rule
   (revise-in-place; significant changes get a decision citing this ADR;
   minor edits don't).
2. **Spec acceptance-criteria format** — existing specs across the
   family should move toward GWT (scenarios) + EARS (invariants/
   requirements) acceptance criteria where they aren't already there;
   this ADR doesn't mandate a retroactive rewrite of every existing spec
   in one pass, but new specs and any spec undergoing a significant
   revision should conform going forward.
3. **Delta-note format adoption** — `contract-author`'s and `executor`'s
   charters (wherever they describe how a spec gets amended) should
   reference this ADR's two-altitude format, so the convention is
   discoverable from the roles that actually write/consume it, not just
   from this ADR.
4. **Physical reorg by user activity** — each repo's own `specs/`
   directory gets restructured into activity-grouped paths (ids stable,
   only file location changes), following math-quest's own slice/
   component precedent as the worked model. Trellis's 5 specs are the
   smallest, cheapest test case (see Context's sketch: installing,
   leaving cleanly, keeping the corpus honest, tuning strictness).
   Math-quest's own corpus, which already has a partial, organic version
   of this via slice specs, is the strongest existing precedent to
   generalize from, not a green-field design.

## Rejected options

*(none yet — options move here only when the maintainer rejects them,
per this repo's shaping convention, with a one-line reason)*
