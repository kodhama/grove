---
id: ledger-grove-gate-profile
type: ledger
status: gated
depends_on: [adr-0018-gate-profile-and-trigger-split]
owner: agent
updated: 2026-07-18
---

# test-deps — gate-profile machinery

> Per-package test-deps ledger (`adr-0006` dec 4). This package
> (`plugins/grove/gates/`) holds the gate-profile machinery introduced by
> `adr-0018`: preset expansion, the intent-locus floor validator, the
> `gates.toml` reader, and the load-time floor-guard with its `guardian`
> fallback. Every `lib/*.mjs` and `bin/*.mjs` under this root belongs to
> this package (nearest-ancestor `test-deps.md` rule).

## Declared upstreams (the tests rest on these)

The behavioral tests in `test/` derive directly from `adr-0018`'s Decided
list and its floor (F1):

- **D3** — the three shipped presets and their exact C2 rows
  (`steward = {human, agent, agent, human}`,
  `guardian = {human, human, agent, human}`,
  `initiator = {agent, agent, agent, human}`).
- **D4** — the profile is a single C2 axis; `gates.toml` carries no C1.
- **D7** — `gates.toml` is an explicit full table; the four rows are the
  source of truth, read directly (no inheritance).
- **D8** — the floor-guard is a load-time reader with a unified `guardian`
  fallback: a missing / unreadable / floor-violating profile falls back to
  `guardian` with a loud warning.
- **Floor (F1)** — reject any profile with 0 human intent-locus gates
  (`intent = human` OR `ship = human`); `initiator` passes via `ship`, an
  all-agent profile fails.

These are behavioral tests (adr-0018 acceptance criteria), so they carry
no spec `@vN` pin — `adr-0018` is a decision, not a versioned spec.

```grove-test-deps
schema: 1
specs: []
decisions:
  - adr-0018-gate-profile-and-trigger-split
```
