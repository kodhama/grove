---
id: adr-0042-receive-stewards-surface-state-strategy
type: adr
status: approved
depends_on: [adr-0040-receive-stewards-adoption-posture-strategy, stewards/kodhama-0023-separate-operational-availability-from-support]
owner: agent
updated: 2026-07-26
---

# ADR-0042: receive the Stewards surface-state strategy

## Decision state

### Decided

- Grove records receipt of Stewards
  [`kodhama-0023`](https://github.com/kodhama/stewards/blob/main/decisions/0023-separate-operational-availability-from-support.md)
  under the propagation model already received through `adr-0040`.
- Decision 0023 remains the sole authority for the shared strategy.
- The strategy applies because Grove declares exact surfaces for its current
  plugin.
- This receipt authorizes no product or implementation change.

### Open

*(none)*

### Parked

- Grove's surface values, lifecycle behavior, migration, validation, tests,
  and planner-dogfood setup. Those product decisions remain in
  [PR #146](https://github.com/kodhama/grove/pull/146).

## Local applicability

The shared strategy governs Grove's exact-surface metadata. This ADR records
only that the strategy is visible in Grove's local decision graph.

Any corresponding Grove change requires the separate product authority in
PR #146. This receipt does not authorize implementation, setup, release, an
adoption posture, or a support claim.

## Self-check

Both dependencies are approved. The Stewards authority is linked directly and
is not summarized or redefined; local applicability and follow-up are explicit.

## Lifecycle record

The maintainer ratified Stewards decision 0023 and explicitly directed its
thin receipt memos to roll out on 2026-07-26. An independent decision
adversary returned `SOUND` for exact commit `74ad240`. The advance
authorization covers this exact bounded receipt: it adds only the required
cross-link and local applicability statement, with product work left to
PR #146. `approved` records that human intent act.
