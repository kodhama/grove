---
id: ledger-grove-host-probes
type: ledger
status: gated
implements: spec-0004-dual-host-distribution
depends_on: [spec-0004-dual-host-distribution, adr-0031-multi-host-distribution, adr-0035-plugin-and-consumer-boundary]
owner: agent
updated: 2026-07-24
---

# test-deps — Grove host probes

This package (`tooling/grove/probes/`) owns isolated support-probe preparation,
the hash-bound non-interactive preflight, static package composition smoke, and
the release-blocking external clean-install discovery contract. Its tests
derive from `spec-0004-dual-host-distribution@v4`, especially INV20, INV23,
INV26–INV27, INV32 and S18, S22–S23, S30.

```grove-test-deps
schema: 1
specs:
  - spec-0004-dual-host-distribution@v4
decisions:
  - adr-0031-multi-host-distribution
  - adr-0035-plugin-and-consumer-boundary
```
