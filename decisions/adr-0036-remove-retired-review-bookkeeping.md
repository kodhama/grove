---
id: adr-0036-remove-retired-review-bookkeeping
type: adr
status: approved  # maintainer's explicit intent act in conversation, 2026-07-25: "Yes, I want to really remove it."
depends_on: [adr-0027-retire-ci-for-now, adr-0035-plugin-and-consumer-boundary]
superseded_in_part_by: [adr-0053-record-layer-shedding]
owner: human
updated: 2026-08-03
---

# ADR-0036: remove the retired review-bookkeeping implementation

## Decision state

### Decided

- **D1 — delete the dormant review-bookkeeping implementation.** Remove the
  `retired/review-bookkeeping/` runtime, its tests and test-dependency ledger,
  and the dormant CI templates. A future review-bookkeeping mechanism, if
  wanted, is a new implementation decision; it is not a re-wiring of retained
  code.
- **D2 — remove its now-orphaned policy artifacts and live references.** Delete
  the check-only policy and precedent carriers, and remove the check from
  Grove's CI, shared command configuration, package documentation, and the
  current distribution specification.
- **D3 — retain historical rationale, not runnable machinery.** Existing ADRs
  and specs remain readable as archival records. Their current retirement
  notices point here and no longer claim that code is preserved or revivable.

### Open

*(none)*

### Parked

Any future deterministic review gate needs a new decision, specification, and
implementation; ADR-0027's provider-agnostic installer route is retired.

## Consequences and propagation

- ADR-0027 D1/D4's preservation and re-wiring clauses are superseded in part.
- ADR-0035's source-side preservation clauses are superseded in part.
- Specs 0002 and 0003 remain approved historical contracts but are not backed
  by a shipped runtime.
  *(Superseded in part by `adr-0053-record-layer-shedding`, 2026-08-03: both
  specs now carry `status: superseded` — operational retirement completed
  with supersession; this bullet records D3's original non-action.)*
- Existing consumer installations are out of scope: Grove has not installed
  this runtime since ADR-0027 unwired it.

## Acceptance criteria

- No `retired/review-bookkeeping/` payload remains.
- CI and `.grove/config.toml` do not invoke the check.
- No current Grove documentation presents the check as retained or revivable.
- No live repository reference resolves to the deleted runtime or templates.

## Self-check

- **Scope:** removes only the retired bookkeeping implementation and its
  direct carriers; independent human review and prose hand-offs remain.
- **Graph:** ADR-0027, ADR-0035, and the two dormant specs gain forward
  pointers; archived rationale is preserved rather than rewritten.
- **Intent:** the maintainer explicitly directed permanent removal.
