---
id: adr-0039-dogfood-implementation-planner
type: adr
status: approved
depends_on: [adr-0037-pre-execution-planning, adr-0040-receive-stewards-adoption-posture-strategy, stewards/kodhama-0021-separate-adoption-posture-from-support]
owner: agent
updated: 2026-07-25
---

# ADR-0039: dogfood the implementation planner in Grove

## Decision state

### Decided

- Grove classifies the planner use already required by ADR-0037's qualifying
  code-bearing route as **dogfood** under Stewards decision `kodhama-0021`.
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
- Product, release, support, package, catalog, setup, and documentation
  changes already parked by ADR-0040; each retains its current owner and
  requires separate authority.

## Context

ADR-0037 added the planner and its qualifying code-bearing route, while
parking the planner experiment and any adoption decision. ADR-0040 received
the Stewards adoption-posture strategy and explicitly reserved this separate
Grove product choice. Stewards decision `kodhama-0021` remains authoritative
for the shared term.

Grove now selects `dogfood` for the existing ADR-0037 route. This is a
classification of current repository use, not activation or expansion of the
route.

## Decision

The planner use already required by ADR-0037 for qualifying code-bearing
specification work has the `dogfood` posture defined by
`stewards/kodhama-0021-separate-adoption-posture-from-support`.
No support claim follows from that classification.

ADR-0037 remains authoritative for routing, including its direct routes,
localized-slip exception, cold planner and executor separation, transient
advisory handoff, and specification authority. This decision changes none of
them.

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

1. The planner use already required by ADR-0037's qualifying code-bearing
   route is explicitly classified as dogfood by reference to Stewards
   decision 0021.
2. ADR-0037's routing, exceptions, authority, and transient handoff remain
   unchanged.
3. No host support, surface state, release behavior, or experiment result is
   inferred.
4. The change is decision-only.

## Self-check

All three correctness dependencies are approved. There are no open questions.
The decision makes one local posture choice, imports the collective vocabulary
without redefining it, and partially supersedes only ADR-0037's parking of the
adoption choice. It changes no code, specification, route, release, catalog,
surface, support claim, or experiment.

## Lifecycle record

The original draft used ADR-0038, but older open PR #142 already owned that
identifier. The still-draft canvas was therefore renumbered to ADR-0039 and
rebased onto current main, including approved ADR-0040. After the dependency,
scope, parked-item, and forward-pointer reconciliation, the author completed
the self-check and moved the artifact to `gated` for independent review. The
independent decision adversary returned `SOUND` for exact commit `0124ba8`.
On 2026-07-25, the maintainer explicitly ratified this decision and authorized
its merge; `approved` records that human intent act.
