---
id: charter-relations
type: charter
status: approved  # maintainer's intent act 2026-07-13 (grove#58 "#58 approved. Passes the gate. Execute to the same PR.") — conformance-reviewed against adr-0011 before approval; in-PR flip recording the act
depends_on: [adr-0011-relations-companion]
owner: agent
updated: 2026-07-13
---

# relations — the artifact edge taxonomy, stated once

> Provenance: created per `adr-0011-relations-companion` (2026-07-13),
> which ruled the artifact **edge taxonomy** its own consolidated
> `.grove/` axis — not a scoped add to `versioning.md` (the maintainer's
> home call) — and named the new provenance relation `informed_by`
> (deliberately not `cites`, which collides with
> `inv-directional-flow`'s own use of "cites" for the flow/dependency
> edge). Canonical at `charters/relations.md`, vendored to
> `plugins/grove/reference/relations.md`, installed by `/grove:setup` to
> each consuming project's `.grove/relations.md` (the `adr-0008` axis
> pattern, one file per config axis).

> **This file is not an agent role.** Like `lifecycle.md` and
> `versioning.md`, it has no pipeline stage and is never dispatched. It
> is the methodology statement the relation-touching roles source —
> `shaper` (records research/evidence as `informed_by`, not
> `depends_on`), `corpus-reviewer` (types and resolves `informed_by`
> referents), `conformance-reviewer` (adjudicates the honesty pairing),
> `validator` (walks `depends_on`, not `informed_by`, on a triggered
> drift audit) — instead of any per-repo restatement. Every other
> statement of the edge taxonomy, in grove itself or in a consuming
> project, is a pointer to this file, never a copy.

## The edge taxonomy

Every relation an artifact declares (in frontmatter or body) is exactly
one of the following four. Each is stated with its **edge class**: is it
**flow** (walked by directional-flow — no `gated`/`approved` artifact
may point across it at a `draft`), and does it **bear drift** (does an
upstream change obligate a downstream re-check, the `validator`'s
triggered-audit graph)?

### `depends_on` — coupling. Flow: yes. Drift-bearing: yes.

Genuine coupling: a source the artifact's correctness is or was
contingent on. The *principle* that this edge means coupling is
trellis's (`decision-0047`, the mechanism-free ruling); this file
records the operational edge-class. **Flow** — directional-flow is
walked over it: no `gated`/`approved` artifact `depends_on` a `draft`.
**Drift-bearing** — an upstream change surfaces its dependents (the
`validator`'s triggered audit walks this edge outward from the changed
artifact).

### `informed_by` — provenance. Flow: no. Drift-bearing: no.

A source that informed construction **without** the artifact's
correctness being contingent on it — research/discovery evidence, a
feedback artifact, a point-in-time external reference. A **non-flow,
non-drift** forward-pointer.

- **A draft `informed_by` referent does NOT trip directional-flow** —
  that is the whole point of the relation: it removes the gating burden
  `decision-0047` names for genuine provenance.
- **Grammar:** a list of `id`s. Cross-repo `<repo>/<id>` referents are
  permitted (the `decision-0044` qualified form — evidence may live in
  another repo). A **`@version` pin on an `informed_by` entry is a
  category error**: a version pin is a drift-comparison device, void for
  a **non-drift** relation (the same *category* as `versioning.md`'s
  append-only pin error, a different mechanism — there the referent
  carries no marker to pin; here the relation itself is non-drift).
  Referents **resolve like any `id`** — a `corpus-reviewer` reference-
  resolution duty, the same check that resolves `depends_on`.
- **Honesty pairing — the mirror of `decision-0047`'s forward rule.**
  The non-flow exemption is not a blank cheque: `decision-0047` forbids
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
  standing post-merge audit.)

### `superseded_by` / `superseded_in_part_by` — history. Flow: no. Drift-bearing: no.

Supersession: a non-flow forward-pointer recording what replaced an
artifact (or, for a partial supersession, the outgrown part of it).

### `changes:` — a decision's forward-pointer to what it changed. Flow: no (superseded_by class). Drift-bearing: no, never walked as flow.

A significant-change decision's forward-pointer to the versioned
artifact(s) it changed; **the `superseded_by` class, non-flow, never
walked as flow** (a decision `depends_on` X while its `changes:` names X
is a benign two-relation pair, not a cycle). Its *edge nature* is stated
here; its **version cross-check** (the declared `@vN` vs. `X`'s version
record) is version mechanics and stays in `versioning.md`, which points
back here for what the edge *is*.

## Boundaries

- **Single home.** No grove-managed repo — grove itself included —
  restates the edge taxonomy; every former restatement is a one-line
  pointer here (`adr-0011`).
- **Version mechanics live in `versioning.md`, not here.** This file
  states *what a relation is* and its edge class (flow/drift); it does
  not state version forms, pin grammar, or the `changes:` cross-check —
  those are `versioning.md`'s (`adr-0010`), which points here for the
  edges it qualifies or cross-checks.
- **Duties live in the role charters** (who does what, when); this file
  carries only what the relations mean.
