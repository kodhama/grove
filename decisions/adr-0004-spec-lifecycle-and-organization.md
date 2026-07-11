---
id: adr-0004-spec-lifecycle-and-organization
type: adr
status: gated  # self-checked 2026-07-11, shaping converged — see Self-check section
depends_on: [trellis/decision-0014, trellis/spec-0001]
owner: agent
updated: 2026-07-11
---

# ADR-0004: how a spec absorbs change, and how specs are organized for discovery

> Provenance: shaped interactively with the maintainer (2026-07-11),
> resolving grove#22 (spec lifecycle: current-behavior vs. delta), with
> grove#21 (GWT/EARS structured specs) and grove#20 (the process-gap
> incident that motivated both) as direct context. Research pass
> completed same day, findings tagged `verified`/`inferred` in Context,
> cited not re-argued.

## Decision

1. **Specs represent current behavior**, not a delta on top of some
   other document (settled in grove#22 itself, not reopened here).

2. **Lifecycle model: formalized-but-transient, generalized from
   `trellis/decision-0014`.** Specs are revise-in-place current-truth. A
   change gets a structured delta note at the point of edit, but that
   note is not retained as its own artifact. Significant changes
   additionally get a durable decision recording why; minor/editorial
   edits don't. This generalizes `decision-0014`'s already-ratified shape
   (previously scoped to the invariant set specifically) to specs
   generally — `decision-0014` itself is not edited; it already works
   fine scoped to invariants. This ADR states the same shape as the
   general case and cites 0014 as precedent/proof-of-practice.

3. **Spec acceptance criteria: GWT + EARS, both.** Scenarios are written
   Given/When/Then; invariants/requirements are written in EARS "shall"
   form — matching math-quest's own existing dual-format practice
   exactly (S-prefixed scenarios in GWT, INV-prefixed invariants in
   EARS), not one grammar standing in for the other. Adopts grove#21's
   ask in full.

4. **Delta-note format: two altitudes, not one uniform note — and the
   note itself is NOT required to be GWT/EARS grammar.** It's a plain
   structured annotation describing a change to a GWT/EARS-shaped spec,
   not itself a scenario. **Why, argued explicitly, not just asserted:**
   item 1 already establishes that specs — not deltas — are the artifact
   holding current behavior; the behavioral specification therefore
   belongs entirely in the spec's own Given/When/Then and EARS
   statements (item 3), and the delta's job is categorically different
   (provenance: what changed, when, why, what to trust it against — not
   a second statement of behavior). This is the **same "one home per
   kind of information" principle that already rejected model 2**
   (Context, Considered and rejected) applied to this choice too:
   forcing the delta into full Gherkin would re-derive a Given/When/Then
   of the *new* behavior in a second place, one that then gets discarded
   — worse than model 2's rejected duplication, not better, since one of
   the two copies is disposable by design. The organic evidence backs
   this: every real delta tag found (`S8 (amended by #145)`, `INV-1
   (amended by ADR-0026, #121; was: 9 of the last 10)`) is a compact tag
   that **quotes** the prior state rather than re-authoring a fresh
   Gherkin sentence — the actual working shape, not a hypothetical one.
   - **Scenario-level** (routine — a single Given/When/Then or EARS
     statement changes): tag the scenario/invariant's own id inline,
     matching math-quest's already-working practice exactly — `S8
     (amended <date>, <trigger-ref>; was: <one-line prior Then-clause>)`.
     The id + tag *is* the delta note.
   - **Section/spec-level** (broader — more than one scenario, or the
     spec's own scope/purpose changes): the five-field blockquote (dated
     marker / WHAT / WHY / SCOPE / POINTER — see Context), plus two new
     fields: **VALUE** (one sentence, in user/persona terms — "as a
     `<persona>`, X now happens instead of Y," not "the mechanism
     changed") and **CONFIDENCE** (`verified` | `inferred`, this
     family's own existing research-tagging convention).

5. **Story-map organization: physical reorg by user activity, ids
   stable.** Each repo's `specs/` directory is physically restructured
   into activity-grouped paths (e.g.
   `specs/installing/0005-curl-install-mechanical-vendoring.md`) — a
   deliberate choice against this draft's own research-based
   recommendation (index-over-reorg was mechanically cheaper; see
   Context). Churn is scoped to file moves only: existing `id:` values
   are unchanged, so `depends_on` references are unaffected; only
   file-path citations in prose (if any) need updating.

6. **`specs/README.md` fix is in scope for this ADR.** grove's,
   design-system's, and wisp's `specs/README.md` files (currently
   identical copies stating specs inherit decisions' append-only
   discipline) are corrected to state this ADR's rule, landing together
   with the decision rather than as separate follow-up.

## Context

Research pass read: grove#20/#21/#22 in full, trellis's `spec-0001` §3
(the ratified artifact contract), `decision-0014` (2026-07-01,
invariants-as-revise-in-place precedent), `decision-0028` (checked
directly — does **not** actually support the citation grove#22 makes to
it; the real precedent for "specs are living current-truth" is
`spec-0001` §3.7 + `decision-0014`, not 0028), grove's own
`specs/README.md`/`decisions/README.md`, and the real spec corpora of
trellis, math-quest, wisp, and design-system.

**Load-bearing verified fact**: trellis's already-ratified `spec-0001`
§3 point 7 states specs are **revise-in-place**, explicitly named as the
contrasting category to append-only decisions — this isn't a
green-field choice, it's already the family's ratified default.
`decision-0014` gives the working reasoning: "the invariant set is a
compiled, revise-in-place spec... not re-ratified per change...
significant invariant changes are recorded as ADRs; minor/editorial
edits are just spec edits — no ADR." That is structurally identical to
the model decided above, ratified and running since 2026-07-01, a week
before #22 raised the question — nobody in #22's discussion cited it.

### The four candidate models from grove#22 (model 2 chosen: see Decision item 2)

1. **Informal delta** — edit in place, no dedicated marker at all.
   Cheapest, but weakest traceability; `verified`: this is closest to
   how trellis's own specs 0001-0005 are actually edited today (plain
   commits, no in-file amendment marker).
2. **Durable, separate "spec-delta" artifact type.** `verified` risk:
   this is exactly the "one behavioral contract split across two
   documents" shape math-quest's own `spec-slice-01-first-loop.md`
   explicitly rejected in its own "Reconciliation (amend vs. fork)"
   section, citing this family's "one home per kind of information"
   principle. Worst storage growth of the four (unbounded artifact
   count).
3. **Specs adopt decisions' supersede pattern** (walk a lineage to find
   "current"). `verified` tension: math-quest's own CLAUDE.md rule 7
   frames the bounded-context invariant as "spec + code + the live
   decisions it cites — never the whole archive... never [read ADRs] to
   reconstruct current-truth" — the whole reason decisions are
   append-only is that nobody needs them to answer "what's true right
   now." Making specs work the way decisions do reverses that property
   for the document type specifically meant to answer "what's true
   right now."
4. **Formalized but transient** (chosen) — real structure at delta time
   (GWT/EARS-shaped, per #21), but not retained as a separate artifact;
   folded into the current-behavior spec, "why" afterward lives in git
   history + the motivating decision/issue. This is `decision-0014`'s
   exact shape, already ratified and exercised.

**All four models pay a real cost under many revisions, just in
different currencies** — models 2/3 pay it as "which of N files is
current"; models 1/4 pay it as a single growing file where history and
current-truth interleave (`verified`: math-quest's
`spec-slice-01-first-loop.md` is now 555 lines with amendment markers
threaded through nearly every invariant, e.g. "INV-1 (amended by
ADR-0026, #121; was: 9 of the last 10)"). Neither failure mode is free;
this ADR doesn't pretend model 4 is costless, only that its cost is
already being paid successfully in this family's largest real spec
corpus.

### An existing, unformalized delta template (verified, not invented for this ADR)

Every real amendment note found in this family's corpus — kodhama-0005,
kodhama-0007, kodhama-0003, math-quest's `spec-placement.md` and
`spec-slice-01-first-loop.md` — independently converges on the same
five-field shape, without anyone naming it as a rule:

> `[dated marker] (DATE, trigger)` — **WHAT** changed (name the rule/id,
> quote the old reading) — **WHY** (the concrete trigger: incident,
> ruling, review finding) — **SCOPE** (what's preserved vs. superseded,
> explicit) — **POINTER** (where the live text now is, if not right
> here).

Where a spec is already GWT/EARS-scenario-shaped, the delta collapses
further: keep the scenario/invariant id, edit its Given/When/Then in
place, tag the id with what changed and why — math-quest already does
exactly this ("S8 (amended by #145)").

### Story-map organization

`verified`: math-quest already has a **working, unprompted precedent** —
component specs (`spec-mastery-engine`, `spec-placement`, etc.) keep
technical names; a lighter, ungated "living document"
(`design/Scope Prioritization.md`) provides the user-journey/story-map
view (Milestones → named Epics reading like user stories: "M1-E1 Página
de exercício"), and "slice specs" (`spec-slice-01-first-loop`,
`spec-slice-02-placement`) sit between the two, `depends_on`-citing the
component specs directly. This wasn't built in response to #22 — it
predates it, which is real evidence the pattern works in practice.

Sketching the same shape against trellis's actual 5 specs (installing,
leaving cleanly, keeping the corpus honest, tuning strictness): an
index-over-reorg would have cost nothing structurally (no id/frontmatter
churn, no `depends_on` disruption). The maintainer chose physical reorg
anyway (Decision item 5) — the cost is scoped to file moves only, ids
held stable, so the graph-disruption risk this section originally
flagged doesn't materialize.

## Considered and rejected

- **Models 1, 2, 3** (informal delta; durable spec-delta artifact;
  decisions'-style supersession) — rejected in favor of model 4, per the
  Context analysis above.
- **Index-over-reorg for story-map organization** — rejected in favor of
  physical reorg; the maintainer weighed the added structural churn as
  worth it for genuine, physical discoverability rather than an overlay
  index. One-line reason: physical grouping was preferred over a
  cross-referencing index despite the index being the cheaper option.
- **Renaming spec ids to match the new activity grouping** (as part of
  the physical reorg) — rejected in favor of keeping ids stable and
  moving files only. One-line reason: avoids `depends_on`-graph rework
  across every repo that cites an affected id, for no discovery benefit
  beyond what a stable-id file move already provides.
- **Requiring GWT/EARS grammar for the delta note itself** (reviewed
  explicitly, 2026-07-11, not just asserted) — rejected in favor of a
  plain structured annotation. One-line reason: specs, not deltas, are
  the artifact that holds behavior (item 1) — forcing the delta into
  Gherkin would duplicate the spec's own Given/When/Then in a second,
  disposable place, the same "one home per kind of information" defect
  that already killed model 2, and the family's real, working delta
  tags (`S8 (amended by #145)`) already quote the prior state rather
  than re-authoring it in Gherkin.

## Consequences

Implementation follows approval, not the reverse. The maintainer's
approval of this decision was a **conversational intent act**
(2026-07-11) — the intent gate opening — after which the **grove-side
execution was folded into this same PR**; the record's `gated →
approved` state flip is applied on merge, per this repo's current
mechanic (`decision-0022`/`0042`). *(This exercised the current
mechanic, not the intent-act-decouples-from-merge refinement that this
decision's own parked note flags for a separate trellis decision.)*

**Done in this PR (grove-side execution):**

- `contract-author` / `executor` charter updates — the two-altitude
  delta-note format, the GWT+EARS acceptance-criteria requirement, and
  the revise-in-place model, discoverable from the roles that
  write/consume specs.
- grove's own `specs/README.md` corrected to state this ADR's rule.
- a worked seven-field delta-note example in grove's `specs/README.md`
  (satisfies Acceptance criterion 4 — proof the format is usable, not
  just specified).

**Genuine follow-on work, each in its own PR once this merges:**

1. **Cross-repo `specs/README.md` fixes** — `design-system/specs/README.md`
   and `wisp/specs/README.md` corrected to state this ADR's rule
   (grove's own is done above). These are separate repos, so they cannot
   ride this grove PR.
2. **Spec acceptance-criteria format** — existing specs across the
   family move toward GWT (scenarios) + EARS (invariants/requirements)
   where they aren't already there; not a mandated retroactive rewrite
   in one pass, but new specs and any spec undergoing a significant
   revision should conform going forward.
3. **Physical reorg by user activity** — each repo's `specs/` directory
   restructured into activity-grouped paths (ids stable, only file
   location changes), following math-quest's own slice/component
   precedent as the worked model. Trellis's 5 specs are the smallest,
   cheapest test case (installing, leaving cleanly, keeping the corpus
   honest, tuning strictness). Math-quest's own corpus, which already
   has a partial, organic version of this via slice specs, is the
   strongest existing precedent to generalize from, not a green-field
   design.

## Acceptance criteria

- [ ] `grove/specs/README.md`, `design-system/specs/README.md`,
      `wisp/specs/README.md` all state the revise-in-place model-4 rule,
      not the append-only rule, and all three cite this ADR.
- [ ] At least one repo's `specs/` directory is physically reorganized
      into activity-grouped paths, with every existing spec `id:` value
      unchanged (verifiable: a `depends_on` resolution check before and
      after the reorg returns identical results).
- [x] `contract-author`'s and `executor`'s charters (in whichever
      repo(s) define them) reference this ADR's two-altitude delta-note
      format. *(Done in this PR — grove's `charters/contract-author.md`
      and `charters/executor.md`.)*
- [x] A worked example exists of a section/spec-level delta note using
      all seven fields (dated marker, WHAT, WHY, SCOPE, POINTER, VALUE,
      CONFIDENCE) — proof the format is usable, not just specified.
      *(Done in this PR — grove's `specs/README.md`, "Worked example"
      subsection.)*

## Open questions (parked, ≤3)

- Whether executor's own plan/task-decomposition format (turning a spec
  into concrete implementation steps) should be standardized in shape —
  not persisted as a repo artifact, just consistent in format across
  agents/loops. Explicitly speculative per the maintainer; does not gate
  this decision.
- This decision surfaced a follow-on **versioning / conformance-sync**
  concern: how a charter (or code) stays in sync with the ADR/spec that
  governs it once that upstream changes — the
  decision → (spec) → charter/code sync question. To be shaped
  separately, grove-side (no issue filed yet; recorded here so the
  lineage is on the record).

## Self-check (gate)

- **Frontmatter**: `id`/`type`/`status`/`depends_on`/`owner`/`updated`
  present, well-typed. PASS.
- **`depends_on` resolution**: `trellis/decision-0014` and
  `trellis/spec-0001` — qualified `<repo>/<id>` form, per
  `trellis/decision-0044` (approved, merged) and `trellis/spec-0001` §1's
  registry (grove is a recognized member; trellis is too). Both
  referents confirmed `status: ratified`/`approved` in trellis's own
  corpus — not `draft`. PASS. *(Caught and fixed during this self-check:
  the working draft initially cited these unqualified, which would have
  been a dangling reference under the now-approved contract.)*
- **Directional flow**: this artifact is being promoted to `status:
  gated`; both dependencies are ratified/approved, not draft — no
  violation either at `draft` or `gated`. PASS.
- **Required body sections**: Decision, Context, Considered and
  rejected, Consequences, Acceptance criteria, Open questions,
  Self-check — present, matching sibling ADRs (`adr-0002`, `adr-0003`).
  PASS.
- **Open questions count**: 2, within this repo's own ≤3 convention.
  PASS.
- **Append-only discipline**: this is a new artifact, nothing edited in
  place. N/A, no violation possible.

**Overall: ready to promote `draft` → `gated`.** The maintainer's own
merge remains the `approved` act, per this repo's convention — this
self-check only certifies the artifact is internally sound and
consumable, not that it's ratified.
