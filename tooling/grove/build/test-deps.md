---
id: ledger-grove-role-projections
type: ledger
status: gated
implements: spec-0004-dual-host-distribution
depends_on: [spec-0004-dual-host-distribution, adr-0031-multi-host-distribution, adr-0032-status-emission-belongs-to-wisp, adr-0035-plugin-and-consumer-boundary]
owner: agent
updated: 2026-07-23
---

# test-deps — Grove role projections

This package owns the metadata-only role inventory and the deterministic
Claude/Codex role projections generated from canonical charters. Its tests
derive from `spec-0004-dual-host-distribution@v4`, especially INV1, INV2,
INV5–INV7, INV17, INV20, INV23–INV28, and INV33 and scenarios S1, S2, S15,
S18, S21–S24, and S31.

```grove-test-deps
schema: 1
specs:
  - spec-0004-dual-host-distribution@v4
decisions:
  - adr-0031-multi-host-distribution
  - adr-0032-status-emission-belongs-to-wisp
  - adr-0035-plugin-and-consumer-boundary
```
