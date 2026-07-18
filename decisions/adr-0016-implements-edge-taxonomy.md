---
id: adr-0016-implements-edge-taxonomy
type: adr
status: approved  # maintainer intent act 2026-07-18 ("approved") after decision-adversary round-1 SOUND; in-conversation flip, adr-0015/adr-0011 precedent
depends_on: [adr-0011-relations-companion, adr-0012-methodology-delivery-machinery, adr-0006-operational-conformance-mechanism]
owner: agent
updated: 2026-07-18
---

# ADR-0016: `implements:` joins the edge taxonomy — the fidelity upstream is flow + drift-bearing

## Context

`adr-0011` (approved 2026-07-13) established the artifact **edge taxonomy**
as *"exactly one of the following four"*: `depends_on`, `informed_by`,
`superseded_by`/`superseded_in_part_by`, and `changes:`. It **predates
`adr-0012`'s `implements:` edge** — the machine-readable realized-contract
edge (a spec its decision, a charter its ADR; code names its spec(s) via the
`adr-0006` test-deps ledger) that the bookkeeping check reads as the
**fidelity upstream** (`plugins/grove/check/lib/upstream.mjs`,
`lib/graph.mjs`) and the `conformance-reviewer` binds fidelity to. So
`implements:` is a real, load-bearing edge the taxonomy **never
enumerated** (`adr-0012` F5 already names it distinct from `depends_on`:
*"`U` is the implements edge, not `depends_on`"*).

Two gaps follow (grove#68):

1. **Documentation.** `relations.md`'s *"exactly four"* omits
   `implements:` — the single-home taxonomy file lacks the taxonomy's most
   consequential fidelity edge; a reader can't find there the one edge the
   fidelity gate turns on.
2. **Drift.** `relations.md` marks **only `depends_on`** drift-bearing, and
   `validator.md`'s triggered drift audit walks **`depends_on` only** (a
   version bump upstream never obligates re-checking across a non-drift
   edge). So an artifact whose fidelity upstream lives **solely in
   `implements:`** silently drops out of an upstream-repair sweep — the one
   edge whose change **most** obligates a re-check, since fidelity is
   contingent on that upstream by definition. **Documenting the edge alone
   does not fix this** (grove#68 part b is the load-bearing half).

Discovered dogfooding on `kodhama/math-quest#305`: its ADR-0046 adopts
`implements:` but is forced to **also** list the realized decision's id in
`depends_on` — an additive bridge — precisely because the validator won't
walk `implements:`. That dual-listing is a workaround for this gap, and a
fail-open one: a forgotten bridge leaves a fidelity upstream silently
unwatched.

## Decision

Extend the edge taxonomy (`adr-0011`) with **`implements:` as a fifth
edge**, classed **flow: yes, drift-bearing: yes**.

1. **`implements:` — the realized-contract / fidelity upstream. Flow: yes.
   Drift-bearing: yes. Grammar: a scalar (one `id`).**
   - **Meaning.** The one contract an artifact realizes — a spec its
     decision, a charter its ADR; **code** names its spec(s) via the
     `adr-0006` per-package test-deps ledger. Distinct from `depends_on`
     (general **coupling**, a list): `implements:` is the **single fidelity
     upstream** the `conformance-reviewer` and the bookkeeping check read
     (`adr-0012` F5). A `depends_on` entry is *builds-on* and never the
     fidelity upstream; the two are not interchangeable and neither
     substitutes for the other.
   - **Flow: yes.** Directional-flow is walked over it — **no
     `gated`/`approved` artifact `implements:` a `draft` upstream.** This
     records, in the taxonomy's flow column, the operational edge-class of
     an **already-standing constraint**: the `conformance-reviewer` already
     requires the `implements` upstream to be `approved` before it reviews
     against it. Flow is the structural directional-flow layer; the
     conformance gate is the stricter fidelity layer (it demands
     `approved`, not merely non-`draft`) — two consistent layers, not a
     redundancy.
   - **Drift-bearing: yes.** An upstream change to the `implements` target
     obligates a downstream re-check (re-derive fidelity). This is the edge
     whose change **most** strongly obligates re-check — fidelity is
     definitionally contingent on the upstream.

2. **The `validator`'s triggered drift audit walks `depends_on` **and**
   `implements:`** — the two drift-bearing edges — outward from the changed
   artifact, with the **same** non-transitive, blast-radius-scoped
   semantics it already uses for `depends_on` (no transitive closure).
   `informed_by`, `superseded_by`/`superseded_in_part_by`, and `changes:`
   remain **non-drift**, unchanged.

3. **Consumers MAY retire the `implements:`+`depends_on` dual-listing
   bridge.** Once the validator walks `implements:`, an artifact no longer
   needs to *also* name its realized contract in `depends_on` for drift
   coverage. Retirement is the **consumer audit's call** (as with
   `adr-0011`'s migration), not forced by this decision; append-only frozen
   artifacts are exempt from editing either way.

## Relationship to `adr-0011` (the taxonomy, extended — not superseded)

`adr-0011` (approved) states the taxonomy as *"exactly one of the following
four."* This decision **extends that enumeration to five** (adds
`implements:`) — and says so explicitly rather than silently diverging
(grove's append-only rule: *fix the decision, don't patch around it*).

- **What is preserved.** `adr-0011`'s four edges and their edge-classes are
  **unchanged**; `implements:` is *added*, not a re-litigation of the four.
  `adr-0011`'s taxonomy was correct for the edges it covered — it simply
  predated `implements:` (introduced later by `adr-0012`).
- **This is a scoped extension, not a supersession.** `adr-0011` stands; a
  **forward pointer** is added on its *"four"* enumeration (same change,
  append-only), so a later reader of *"exactly four"* is not left in silent
  tension with this decision.

## Considered and rejected

- **Document `implements:` in `relations.md` without making it
  drift-bearing** (grove#68 part a alone). Rejected: it fixes the omission
  but leaves the real defect — the validator still wouldn't walk
  `implements:`, so the fidelity upstream still drops out of drift sweeps
  and consumers still dual-list. Part (b) is what actually fixes it.
- **Status quo — keep `implements:` out of the taxonomy; consumers
  dual-list into `depends_on`.** Rejected: it makes the fidelity upstream's
  drift coverage depend on a manual, redundant, **fail-open** bridge (a
  forgotten dual-listing = a fidelity upstream silently unwatched), and it
  divorces the single fidelity edge from its own drift behavior.
- **Make `implements:` drift-bearing but NOT flow.** Rejected: the
  `conformance-reviewer` already forbids implementing a non-`approved`
  upstream, so classing `implements:` non-flow would leave that standing
  constraint unrecorded in the taxonomy's flow column and split flow from
  drift for an edge that plainly bears both. `flow: yes` records the
  existing constraint; it invents no new one.
- **Amend `adr-0011` in place** instead of a new ADR. Rejected in favor of
  the append-only extension (a new decision with a forward pointer on
  `adr-0011`), preserving `adr-0011`'s approved *"four"* verbatim — though
  this is a maintainer home-call (Open questions).

## Consequences (execution — after approval)

1. **Extend `charters/relations.md`**: add the `implements:` entry
   (flow: yes, drift-bearing: yes; scalar; the realized-contract / fidelity
   upstream, distinct from `depends_on` coupling); change *"exactly one of
   the following four"* → *"five"*. Re-vendor: canonical →
   `plugins/grove/reference/relations.md` → the `/grove:setup` copy to a
   consumer's `.grove/relations.md` (the `adr-0008` three-copy sync).
2. **Amend `charters/validator.md`**: the triggered drift audit walks
   `depends_on` **and** `implements:` (the drift-bearing edges), same
   non-transitive / blast-radius-scoped semantics; `informed_by` /
   `superseded_by` / `changes:` stay non-drift. Three-copy sync.
3. **Forward pointer on `adr-0011`** at its *"four"* enumeration → this
   decision (append-only, same change; original text preserved).
4. **Consumer migration (optional, audit's call):** consumers may retire
   the `implements:`+`depends_on` dual-listing (e.g. `math-quest` ADR-0046);
   not forced here.
5. **No bookkeeping-check core change.** The check already reads
   `implements:` as the fidelity upstream (`lib/upstream.mjs`); this
   decision concerns the **taxonomy documentation** and the **`validator`
   drift-walk**, not the check's freshness algorithm or `spec-0002`'s
   basis. (Confirmed in Open questions that no `spec-0002` testable clause
   is implicated.)

## Acceptance criteria

- **AC1** `charters/relations.md` enumerates **five** edges, with
  `implements:` defined **flow + drift-bearing**, scalar, and distinguished
  from `depends_on` coupling; every other statement of the taxonomy remains
  a pointer to this single home (`adr-0011` AC1 unbroken).
- **AC2** `charters/validator.md`'s triggered drift audit walks
  `implements:` **as well as** `depends_on`, same non-transitive
  blast-radius semantics; the three non-drift edges are unchanged.
- **AC3** `adr-0011` carries a forward pointer from its *"four"*
  enumeration to this decision — **annotation only, no content edit**; its
  four edges and their classes are otherwise unchanged (append-only).
- **AC4** The three-copy sync (canonical / `reference` / consumer `.grove/`)
  is intact for both amended companions.
- **AC5** An artifact whose fidelity upstream is declared **only** in
  `implements:` is now inside the validator's triggered-audit blast radius
  when that upstream changes (the grove#68 defect closed); no consumer is
  *forced* to retain the `depends_on` dual-listing for drift coverage.

## Open questions (parked, ≤3)

- **New ADR vs. amend `adr-0011` in place** — drafted as a new ADR
  (append-only, forward-pointer). Maintainer's home call; if amend-in-place
  is preferred, the content folds into `adr-0011` with a recorded
  amendment note instead.
- **Directional-flow enforcement mechanism for `implements:` flow** —
  `relations.md` *states* the flow class; the actual directional-flow
  enforcement for `depends_on` today is per-role (corpus-reviewer /
  conformance-reviewer judgment) rather than a standalone check.
  `implements:` `flow: yes` should ride **whatever mechanism `depends_on`
  flow already rides** — this decision adds a documented class, not a new
  enforcement engine. Confirm no new enforcement code is implied during the
  build.
- **`spec-0002` touchpoint** — the `validator` is a charter role, not the
  bookkeeping-check code; making `implements:` drift-bearing changes the
  validator's walk, not the check's freshness algorithm. Expected: **no**
  `spec-0002` testable clause changes. Confirm at build time (and if one is
  implicated, surface it rather than silently editing).

## Self-check (rubric)

Self-checked to `gated` 2026-07-18. **Problem stated from an observed
failure** (grove#68, surfaced dogfooding on `kodhama/math-quest#305`/ADR-0046
— the dual-listing workaround), diagnosed against the actual artifacts: the
`adr-0011` *"exactly four"* enumeration, `relations.md`'s single drift-bearing
mark, and `validator.md`'s `depends_on`-only walk. The decision is **largely
forced**: `implements:` is a standing, code-read edge absent from the
taxonomy, and its fidelity semantics make *drift-bearing* the obligated
class — the fidelity upstream is exactly the change that must fire a
re-check. Each alternative is rejected with a reason, including the
tempting-but-insufficient "document only" (grove#68 part a), which leaves the
load-bearing drift gap open. **Relationship to `adr-0011` is reconciled
explicitly** (a scoped append-only extension with a forward pointer — the
four edges preserved verbatim), mirroring the `adr-0015`↔`adr-0012`
precedent, so no silent divergence from an approved decision. `flow: yes` is
justified as *recording an already-standing constraint* (the conformance
gate's approved-upstream rule), inventing no new enforcement; the one genuine
mechanism uncertainty (how `depends_on` flow is enforced today) is named as an
open question, not pretended settled. `depends_on` is genuine coupling —
`adr-0011` (the taxonomy extended), `adr-0012` (which introduced the
`implements:` edge and the check that reads it), `adr-0006` (the ledger
resolving code's `implements` upstream); all `approved`, no draft consumed.
Execution (the two companion amendments, the forward pointer, the optional
consumer migration) is scoped downstream, not performed here.

**Decision-adversary round 1 (2026-07-18): SOUND.** No load-bearing break
on any of the four axes; each factual premise corroborated against the
cited artifacts (the conformance approved-upstream rule at
`conformance-reviewer.md` Method 1 + `adr-0012` AC12; `validator.md`'s
`depends_on`-only walk; `relations.md`'s single drift-bearing mark;
`lib/upstream.mjs`/`graph.mjs` already reading `implements:`), all three
`depends_on` targets `approved`, and the *"exactly four"* tension handled
via grove's own append-only annotation precedent (the `adr-0012`→`adr-0006`
forward-pointer pattern) rather than a silent contradiction. The adversary
confirmed the sharp coherence probe — `flow: yes` records a constraint that
is a strict **subset** of the already-enforced conformance rule (flow
forbids a `draft` upstream; conformance forbids `draft` *and* `gated`), so
"invents no new enforcement" holds. One non-blocking wording note (AC3's
"byte-unchanged" vs. the forward-pointer annotation) applied.

**Not claiming adversary validation** — the decision-adversary pass precedes
the human gate; the `approved` intent act is the maintainer's
(`gated → approved` flip), never the shaper's.
