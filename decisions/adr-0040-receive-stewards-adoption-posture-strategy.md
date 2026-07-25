---
id: adr-0040-receive-stewards-adoption-posture-strategy
type: adr
status: approved
depends_on: [stewards/kodhama-0021-separate-adoption-posture-from-support, stewards/kodhama-0022-propagate-collective-strategy]
owner: agent
updated: 2026-07-25
---

# ADR-0040: receive the Stewards adoption-posture strategy

## Decision state

### Decided

- Grove records receipt of Stewards
  [`kodhama-0021`](https://github.com/kodhama/stewards/blob/main/decisions/0021-separate-adoption-posture-from-support.md)
  under the propagation model established by
  [`kodhama-0022`](https://github.com/kodhama/stewards/blob/main/decisions/0022-propagate-collective-strategy.md).
- Decision 0021 remains the sole authority for the shared strategy.
- The strategy applies because Grove owns a current Kodhama plugin.
- This receipt authorizes no product or implementation change.

### Open

*(none)*

### Parked

- Any Grove adoption-posture choice. PR #144 separately proposes planner
  dogfood and is neither approved nor replaced by this receipt.
- Candidate-surface, release, support, package, catalog, setup, documentation,
  and experiment changes; each requires its own Grove authority.

## Local applicability

The shared distinction between adoption posture and support governs Grove
plugin distribution and support language. This ADR records only that the
strategy is visible in Grove's local decision graph.

No follow-up is required by this receipt itself. It does not adopt or
configure a plugin, authorize implementation, change a package or release,
make a support claim, select an adoption posture, or certify compliance.

## Self-check

Both upstream decisions are approved and linked through qualified
cross-repository dependencies. The shared strategy is not copied or redefined;
local applicability and follow-up are explicit.

## Lifecycle record

The maintainer authorized rolling out the cross-link ADRs on 2026-07-25. An
independent decision adversary returned `SOUND` for exact commit `e86527a`.
On 2026-07-25, the maintainer explicitly ratified this receipt and authorized
its merge; `approved` records that human intent act.
