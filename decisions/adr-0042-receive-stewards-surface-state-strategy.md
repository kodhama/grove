---
id: adr-0042-receive-stewards-surface-state-strategy
type: adr
status: approved
depends_on: [adr-0040-receive-stewards-adoption-posture-strategy, stewards/kodhama-0023-separate-operational-availability-from-support]
superseded_in_part_by: [stewards/kodhama-0025-retire-the-surface-matrix]
owner: agent
updated: 2026-07-28
---

# ADR-0042: receive the Stewards surface-state strategy

> **Superseded in part by
> [`stewards/kodhama-0025`](https://github.com/kodhama/stewards/blob/main/decisions/0025-retire-the-surface-matrix.md)
> (2026-07-28).** It supersedes `kodhama-0023` in full, so this receipt's
> *"Decision 0023 remains the sole authority for the shared strategy"* no
> longer holds — there is no family surface contract for it to be the
> authority of. **Grove's own use of the grammar is untouched**, and that is
> `kodhama-0025`'s explicit intent: Grove has the family's only runtime
> consumer of these fields, a lifecycle gate deciding whether to write into a
> consumer repository, which 0025 names as *"a product mechanism answering a
> product question, not a family contract."* `0025:123` states the permission
> exactly — *"Grove may keep the names for its own runtime"* — and no other
> repository is obliged to match Grove's shape.
>
> **Permission is not adoption, and the difference is a live gap.** `adr-0041`
> twice defers the *combination invariants* to the retired upstream (`:31-34`,
> `:167-170` — *"combination invariants come from Stewards decision 0023"*), so
> the `unavailable + claimed` rule enforced in `release.mjs` now has no live
> decision behind it. Adopting it as Grove-owned is grove#166. Nothing
> executable changes meanwhile; what is missing is the authority, and naming it
> is the point of this pointer.

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
