---
id: ledger-grove-release-validation
type: ledger
status: gated
implements: spec-0004-dual-host-distribution
depends_on: [spec-0004-dual-host-distribution, adr-0031-multi-host-distribution, adr-0032-status-emission-belongs-to-wisp]
owner: agent
updated: 2026-07-23
---

# test-deps — Grove release validation

This package (`plugins/grove/release/`) validates Grove's shared release
identity, dual host manifests, surface-support claims, generated support
documentation, and immutable-tag behavior.

```grove-test-deps
schema: 1
specs:
  - spec-0004-dual-host-distribution@v3
decisions:
  - adr-0031-multi-host-distribution
  - adr-0032-status-emission-belongs-to-wisp
```
