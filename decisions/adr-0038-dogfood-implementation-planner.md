---
id: adr-0038-dogfood-implementation-planner
type: adr
status: draft
depends_on: [adr-0034-narrow-stewards-marketplace-provisioning, adr-0037-pre-execution-planning, stewards/kodhama-0021-separate-adoption-posture-from-support]
owner: agent
updated: 2026-07-25
---

# ADR-0038: dogfood the implementation planner in Grove

## Decision state

### Decided

- Grove classifies its ordinary use of the implemented
  `implementation-planner` during Grove development as **dogfood** under
  Stewards decision `kodhama-0021`.
- ADR-0037's planner routing, authority, and transient handoff remain
  unchanged.
- Dogfood is repository-level reliance for learning; it is not a support
  claim or a host-surface state.
- This decision changes no code, package, catalog, release, or support
  evidence.

### Open

*(none)*

### Parked

- Issue #143's controlled experiment, model choices, token accounting,
  metrics, thresholds, and adoption evidence.
- Any promotion from dogfood to supported.
- Candidate-surface behavior, release validation, setup authorization,
  manifests, versions, catalogs, and public documentation.
- Claude-versus-Codex rollout sequencing; evidence never transfers between
  hosts.
- Later steward acknowledgments and any Math Quest preview choice.

## Context

ADR-0037 added the planner and deferred its token-optimization experiment.
Approved Stewards decision `kodhama-0021` now distinguishes honest internal
dogfood from an evidence-backed support promise and names Grove planner use as
the first bounded application.

Grove therefore needs only to record its local posture. It does not need a
new lifecycle state, release tier, surface row, gate, or implementation.

## Decision

Grove will use `implementation-planner` during Grove development under the
`dogfood` posture defined by
`stewards/kodhama-0021-separate-adoption-posture-from-support`.
Breakage and learning are acceptable within normal repository review, and no
support claim follows from that use.

The existing ADR-0037 route remains authoritative: qualifying code-bearing
specification work passes through a cold planner and then a separately cold
executor using a transient advisory handoff. This decision neither widens that
route nor changes the specification's authority.

The planner experiment remains wholly parked in issue #143. Dogfood permits
real use before that experiment concludes; it does not pre-judge whether the
planner reduces tokens, justifies a lower-tier executor, or should become
supported.

## Consequences

- Grove can learn from real planner use without mislabeling it as support.
- Support and release evidence remain exact-host, exact-surface, and
  product-owned.
- Other repositories receive no posture automatically.
- Any behavioral or delivery change still requires its own governing
  artifact.

## Acceptance criteria

1. Grove planner use is explicitly classified as dogfood by reference to
   Stewards decision 0021.
2. ADR-0037's routing and transient handoff remain unchanged.
3. No host support, surface state, release behavior, or experiment result is
   inferred.
4. The change is decision-only.

## Self-check

The decision makes one local posture choice, imports the collective vocabulary
without restating it, and leaves every implementation and support boundary
where its current owner placed it.

