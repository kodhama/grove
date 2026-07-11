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

**Open** (live questions — this draft moves items here to Decided as they
resolve):
1. **(Expanded scope, maintainer-directed, 2026-07-11 — noted explicitly
   per this repo's scope-guard convention, not silently folded in.)**
   Given model 4, what the required shape of an in-place amendment/delta
   note should be. The maintainer confirmed the five-field template as a
   base but added two requirements: (a) acceptance criteria should be
   Gherkin-shaped (Given/When/Then) to drive tests — this is grove#21's
   own ask, adopted here as a prerequisite for the delta mechanism to
   work well, not duplicated as a separate requirement; (b) asked for a
   PO-with-AI lens on what fields are actually valuable, beyond engineering
   trigger/scope. Proposed synthesis below — not yet confirmed by the
   maintainer, still open:

   **Two altitudes, not one uniform note:**
   - **Scenario-level** (routine — a single Given/When/Then changes):
     tag the scenario's own id inline, matching math-quest's *already-
     working* practice exactly — `S8 (amended <date>, <trigger-ref>; was:
     <one-line prior Then-clause>)`. No separate blockquote needed; the
     id + tag *is* the delta note.
   - **Section/spec-level** (broader — more than one scenario, or the
     spec's own scope/purpose changes): the five-field blockquote,
     **plus two new fields**:
     - **VALUE** — one sentence, in user/persona terms, of what changes
       for whom (not "the mechanism changed" but "as a `<persona>`, X
       now happens instead of Y"). This is the field a PO reads first,
       and it's the same language a story-map/user-activity view would
       use — deliberately connecting this item to Open item 2, not
       treating them as unrelated.
     - **CONFIDENCE** — `verified` | `inferred`, the exact tagging
       convention this family's own research/shaping practice already
       uses successfully (see this ADR's own Context section) — states
       plainly whether the delta reflects a confirmed fact or a judgment
       call, so a PO deciding whether to act on it knows which.
2. Whether — and how — to formalize story-map (user-activity) organization
   for specs, given math-quest already has a working, unprompted example
   of this (see below) that predates this issue.

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

## Consequences (drafted, pending Open items above)

- **`specs/README.md` fixes, once this ADR is approved** (in scope, per
  Decided above): `grove/specs/README.md`, `design-system/specs/README.md`,
  `wisp/specs/README.md` — currently identical, word-for-word copies
  stating specs inherit decisions' append-only discipline — corrected to
  state the model-4 rule (revise-in-place; significant changes get a
  decision citing this ADR; minor edits don't). Not executed by this ADR
  itself (per this repo's own stage discipline: implementation follows
  approval, doesn't precede it) — a follow-on pass across the three repos
  once this merges.

*(remaining consequences left blank pending resolution of the other Open
items — filled in as this draft converges, not asserted ahead of the
maintainer's actual decision)*

## Rejected options

*(none yet — options move here only when the maintainer rejects them,
per this repo's shaping convention, with a one-line reason)*
