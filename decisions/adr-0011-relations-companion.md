---
id: adr-0011-relations-companion
type: adr
status: approved  # maintainer's intent act 2026-07-13 ("#58 approved. Passes the gate.") — in-PR flip recording the act (adr-0007 / lifecycle-companion precedent); two adversary rounds preceded the gate; executed to the same PR
depends_on: [adr-0006-operational-conformance-mechanism, adr-0008-lifecycle-enum-companion, adr-0010-versioning-is-operational, trellis/decision-0047]
owner: agent
updated: 2026-07-18  # append-only amendment (adr-0018 D5): install target -> .grove/internal/relations.md
---

# ADR-0011: the relations companion — the artifact edge taxonomy, and the `informed_by` provenance relation

> **Amendment (2026-07-18, append-only — superseded in part by
> `adr-0018` D5, the install-path split):** the relations companion's
> consumer install target moves from `.grove/relations.md` to
> **`.grove/internal/relations.md`**. `adr-0018` D5 splits the consumer
> `.grove/` namespace by **authority** — the grove-authoritative
> companions live under `.grove/internal/` (regenerated verbatim on
> update); the consumer-authoritative config (`gates.toml`,
> `review.toml`) keeps the `.grove/` root. Wherever this decision's
> ratified text below reads `.grove/relations.md`, read
> `.grove/internal/relations.md`. The ratified text is unedited per the
> append-only rule; `adr-0018` is the authoritative record.

## Context

**trellis/decision-0047** (approved) ruled the mechanism-free principle:
*the dependency edge means genuine coupling — a source the artifact's
correctness is or was contingent on; provenance (a source that informed
construction without coupling) is categorically distinct and not modeled as
a dependency.* Per the family layering (kodhama-0008 / adr-0010) it named
**no grammar** and routed the encoding to grove's operating model (grove#57).

grove owns the encoding. Two calls the maintainer made in the shaping
sitting (2026-07-13):

1. **Home:** a **new companion, consolidated** — not a scoped add nor an
   extension of `versioning.md`. The artifact **edge taxonomy** becomes its
   own `.grove/` axis (adr-0008 pattern), and the edge-relation content
   currently sitting in `versioning.md` (the `changes:` relation, the
   `depends_on`-class language) moves into it, leaving `versioning.md` about
   version *forms and pins* only. One home for "how artifacts relate."
2. **Name:** the provenance relation is **`informed_by`** — deliberately
   **not `cites`**: trellis's own `inv-directional-flow` text uses "cites"
   to mean the *flow/dependency* edge ("no ratified artifact cites a draft
   upstream"), so `cites` would collide.

## Decision

1. **A new companion `charters/relations.md` (`.grove/relations.md` in a
   consumer)** — the single home for the artifact **edge taxonomy**: which
   relations exist, and for each, its **edge class** (is it *flow* — walked
   by directional-flow; does it *bear drift*). Canonical at
   `charters/relations.md`, vendored to
   `plugins/grove/reference/relations.md`, installed by `/grove:setup` to
   `.grove/relations.md` (the adr-0008 axis pattern, one file per axis).

2. **The taxonomy it states (once):**
   <!-- Forward pointer (adr-0016, 2026-07-18; annotation only, no
   content edit): this enumeration was complete at 2026-07-13, before
   adr-0012 introduced the `implements:` edge. adr-0016 extends it with a
   FIFTH edge — `implements:` (flow + drift-bearing) — as a scoped
   append-only extension; the four below stand unchanged. See
   decisions/adr-0016-implements-edge-taxonomy.md. -->
   - **`depends_on`** — genuine **coupling**; a **flow, drift-bearing** edge.
     Directional-flow is walked over it (no ratified artifact depends on a
     draft); an upstream change surfaces its dependents. (The *principle*
     that this edge means coupling is trellis's, `decision-0047`; relations.md
     records the operational edge-class.)
   - **`informed_by`** *(new — the provenance relation)* — **provenance**: a
     source that informed construction without the artifact's correctness
     being contingent on it (research/discovery evidence, a feedback
     artifact, a point-in-time external reference). A **non-flow,
     non-drift** forward-pointer. **A draft `informed_by` referent does NOT
     trip directional-flow** (that is the whole point — it removes the
     gating burden decision-0047 names). **Grammar:** a list of `id`s;
     cross-repo `<repo>/<id>` referents permitted (decision-0044 form —
     evidence may live in another repo); a **`@version` pin on an
     `informed_by` entry is a category error** — a version pin is a
     drift-comparison device, void for a **non-drift** relation. (Same
     *category* as `versioning.md`'s append-only pin error, different
     mechanism: there the referent has no marker to pin; here the relation
     is non-drift.) Referents **resolve like any `id`** (a resolution duty,
     Consequence 3).
     **Honesty pairing — the mirror of decision-0047's forward rule.** The
     non-flow exemption is not a blank cheque: decision-0047 forbids
     provenance-in-`depends_on`; **symmetrically, coupling-in-`informed_by`
     is forbidden** — relabeling a genuine coupling as `informed_by` to
     reference a draft and dodge the gate is non-conformant. Whether an
     `informed_by` edge is *genuinely* provenance (correctness not
     contingent) is a **judgment the `conformance-reviewer` adjudicates**;
     `corpus-reviewer` surfaces an `informed_by → draft` edge as a **flag**
     for that judgment, never a silent structural pass. (The *standing*
     flag covers the `→ draft` case, where the dodge is structurally
     detectable; a coupling mislabeled toward an *approved* upstream is
     caught at **build time** by the `conformance-reviewer`, not by a
     standing post-merge audit — stated so the enforcement scope is
     explicit, not a silent gap.)
   - **`superseded_by` / `superseded_in_part_by`** — **history/supersession**;
     a non-flow forward-pointer (the succession record).
   - **`changes:`** — a decision's forward-pointer to the versioned
     artifact(s) it changed; **the `superseded_by` class, non-flow, never
     walked as flow**. Its *edge nature* is stated here; its **version
     cross-check** (declared `@vN` vs record) stays in `versioning.md` as
     version mechanics, pointing here for what the edge *is*.

3. **Consolidation — what moves, what stays.**
   - **Moves to `relations.md`:** the `changes:`-relation *edge* definition
     and the `depends_on`-class / forward-pointer-class language currently in
     `versioning.md` §"The `changes:` relation".
   - **Stays in `versioning.md`:** version forms, the counter + presence +
     initialization rules, the **`@version` pin grammar** (a version
     *qualifier on* a `depends_on` edge — version mechanics, referencing
     relations.md for the edge), and the **`changes:` cross-check**
     (version reconciliation). Where `versioning.md` names an edge, it
     points at `relations.md`; it no longer defines edge classes itself.
   - Result: `relations.md` = *how artifacts relate*; `versioning.md` = *how
     versions are formed, pinned, and cross-checked over those relations*.

4. **`informed_by`, not `cites`** — recorded, with the collision reason
   (inv-directional-flow's flow-edge "cites").

## Considered and rejected

- **Extend `versioning.md`** (the scoped/cheap option) — rejected by the
  maintainer: provenance is not versioning; it would stretch that file's
  "conformance-detection" charter and leave the edge taxonomy split across
  two files. The consolidation gives edges one home.
- **A scoped `relations.md` that leaves `changes:` in `versioning.md`** —
  rejected for the same one-home reason: edges would still have two homes.
- **Spelling it `cites`** — rejected (collision, above).
- **Provenance stays in `depends_on`** — forbidden by `decision-0047`.

## Consequences (execution — downstream, deferred to ratification)

1. **Create `charters/relations.md`** (canonical), vendor to
   `plugins/grove/reference/relations.md`, add the `/grove:setup` copy line
   (`reference/relations.md` → `.grove/relations.md`) — one line, the
   adr-0008 mechanism.
2. **Amend `charters/versioning.md`** (revise-in-place, delta note): move the
   `changes:`-relation edge definition + edge-class language to
   `relations.md`; leave the version cross-check + `@version` pin, repointed
   to `relations.md` for edge definitions. Re-vendor (three-copy sync).
3. **Charter duty edits** (three-copy sync) — **all four** consuming roles
   source the edge taxonomy from `relations.md`:
   - **`shaper`** records research/evidence as **`informed_by`, not
     `depends_on`**.
   - **`corpus-reviewer`** types `informed_by` **non-flow** (a draft
     `informed_by` is not a directional-flow violation, check 5) and
     **resolves `informed_by` referents** like `depends_on` (check 4) — but
     **first flags a `@version` pin on any `informed_by` entry as a category
     error**, *before* the strip-and-resolve step (which would otherwise
     silently swallow the pin); and **flags an `informed_by → draft` edge**
     for the honesty judgment (Decision §2).
   - **`conformance-reviewer`** adjudicates the honesty judgment — a
     coupling relabeled as `informed_by` to dodge the gate is a
     decision-0047 violation to surface.
   - **`validator`** learns `informed_by` is a **non-drift** edge: its
     triggered drift audit walks `depends_on`, **not `informed_by`** (a
     version bump upstream does not obligate re-checking a provenance
     citation).
   (The `corpus-reviewer` `changes:` cross-check is **unchanged** — it stays
   in `versioning.md` and already points there for full semantics; no edge
   reference in it to repoint.)
4. **Consumer migration (triggers a consumer audit).** Live/revise-in-place
   artifacts move provenance edges from `depends_on` into `informed_by`;
   frozen append-only artifacts are exempt (append-only forbids editing them
   — `decision-0047` Consequence 4). math-quest (~22 discovery + 3 feedback
   edges) is the main consumer.

## Acceptance criteria

- **AC1** `charters/relations.md` exists, ships, and is the single home of
  the edge taxonomy; `informed_by` is defined non-flow/non-drift; every
  other statement of an edge class (in grove or a consumer) is a pointer.
- **AC2** `versioning.md` no longer defines edge classes — it points at
  `relations.md` — and retains only version forms/pins/cross-check.
- **AC3** The **four** consuming roles (`shaper`, `corpus-reviewer`,
  `conformance-reviewer`, `validator`) source `relations.md`; a draft
  `informed_by` referent does not trip any directional-flow check; the
  three-copy sync is intact.
- **AC4** The honesty pairing is live: an `informed_by` edge that is
  genuinely a coupling is surfaced as non-conformant (not silently
  exempted), and a `@version` pin on `informed_by` is flagged as a category
  error.

## Open questions (parked, ≤3)

- **Split boundary for `changes:`:** does `versioning.md` keep a one-line
  stub pointing to `relations.md` for the relation, or drop the relation
  mention entirely and only speak of the cross-check? (Execution detail;
  recommend a pointer stub so a version reader isn't stranded.)
- **Migration timing:** does the math-quest audit run in the same wave as
  the encoding, or as its own follow-on? (Downstream; the audit's call.)

*(The `@version` pin stays version-mechanics in `versioning.md` — Decision §3
— not an open question; it is a version qualifier on a `depends_on` edge, not
an edge itself.)*

## Self-check (gate)

Implements `trellis/decision-0047` (approved) on the operating-model side;
mirrors adr-0008/adr-0010's companion pattern and single-home discipline.
The maintainer's two shaping calls (consolidated relations companion;
`informed_by`) are recorded with their rejected alternatives. `informed_by`
is defined by its edge class (non-flow, non-drift), naming the collision
that ruled out `cites`. The consolidation's move/stay boundary is enumerated
(edges → relations.md; version mechanics → versioning.md, repointed), with
the residual split detail parked. Depends only on approved/ratified upstreams
(adr-0006, adr-0008, adr-0010, trellis/decision-0047), no draft consumed.
Execution scoped downstream (the companion, the versioning.md amendment, the
duty edits, and the migration are not performed here). **Two** independent
adversary rounds folded: R1 — F1 (`validator` added, the fourth role), F2
(the safety hole — the `informed_by` non-flow exemption paired with its
honesty mirror: coupling-in-`informed_by` is non-conformant, adjudicated by
`conformance-reviewer`), F3 (grammar), F4/F5 (instruction + open-questions).
R2 — confirmed the honesty pairing **sound** (enforceable via 0047's
contingency test, charter-consistent with the pin-currency flag rail,
proportionate — no forced promotion, `→ draft`-scoped); closed one AC4-vs-
Consequence gap (the `@version`-on-`informed_by` flag is now an assigned
`corpus-reviewer` duty, ahead of strip-and-resolve), tightened the
category-error reason to *non-drift*, and stated the standing-vs-build-time
enforcement scope. The consolidation split, layering, and dependency hygiene
held **both** rounds. Promote `draft → gated` on self-check; **`approved` is the
maintainer's intent act** (the lifecycle companion / adr-0007 precedent), not
this author's.
