---
id: ledger-grove-gate-profile
type: ledger
status: gated
depends_on: [adr-0018-gate-profile-and-trigger-split, adr-0021-gate-profile-self-adoption]
owner: agent
updated: 2026-07-19
---

# test-deps — gate-profile machinery

> Per-package test-deps ledger (`adr-0006` dec 4). This package
> (`tooling/grove/tests/gates/`) verifies the gate-profile machinery shipped at
> `plugins/grove/runtime/gates/`, introduced by
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

The `runtime_dir` tests derive from `adr-0021` (grove-to-grove
self-adoption):

- **D2 (adr-0021)** — an optional top-level `runtime_dir` key: tolerated
  by the parser, surfaced in the resolved output when present, and
  **omitted** from the output when absent (AC2 — byte-identical behavior
  on profiles without the key; zero migration). Top-level only: a
  `runtime_dir` inside `[gates]` is an unknown gate row and still fails
  strictness (AC3).

These are behavioral tests (adr-0018 / adr-0021 acceptance criteria), so
they carry no spec `@vN` pin — both upstreams are decisions, not
versioned specs.

```grove-test-deps
schema: 1
specs: []
decisions:
  - adr-0018-gate-profile-and-trigger-split
  - adr-0021-gate-profile-self-adoption
```
