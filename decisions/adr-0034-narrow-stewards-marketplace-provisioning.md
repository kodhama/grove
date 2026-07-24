---
id: adr-0034-narrow-stewards-marketplace-provisioning
type: adr
status: approved
depends_on: [adr-0029-non-interactive-loading, adr-0031-multi-host-distribution, adr-0033-adopt-family-plugin-contracts]
owner: agent
updated: 2026-07-24
---

# ADR-0034: narrow Stewards integration to marketplace metadata and CI provisioning

## Decision state

### Decided

- Grove retires ADR-0033's shared family release-certification contract.
- Grove retains its existing product-owned `VERSION`, manifests,
  `surfaces.json`, evidence, release validator, and release workflow unchanged.
- Stewards may own factual metadata describing surfaces on which a marketplace
  was tested.
- Stewards may provide a skill that adds the appropriate Claude and/or Codex
  marketplace and plugin setup step to an existing CI job.
- Stewards provisioning does not decide Grove's release identity or behavioral
  support and does not replace Grove's product tests.

### Open

*(none)*

### Parked

- Cloud-environment setup remains outside this reset. A later decision may
  reuse the same marketplace-install command after the CI path is proven.

## Context

ADR-0033 adopted an end-to-end family release and distribution architecture.
During implementation, that scope expanded into a universal release engine,
immutable validator runtimes, sandbox enforcement, approval resolution,
append-only cross-repository history, and product-specific candidate
transactions.

The intended outcome was much smaller: metadata recording where marketplaces
had actually been tested, plus a Stewards skill that can add the required
marketplace setup step to CI. The maintainer directed the family to remove the
overarching theme before implementing that narrow capability.

Grove already has working product release and support machinery. None of it
needs to move into Stewards to satisfy the intended CI provisioning outcome.

## Decision

### 1. Retire shared release certification

ADR-0033 is superseded. Grove does not consume a shared family release engine,
common release-history ledger, approval-artifact protocol, validator runtime,
or effective-support derivation.

No shared family-contract checker is added to Grove PR CI. Grove's existing
product checks remain authoritative for Grove.

### 2. Preserve the narrow ownership transfer

ADR-0029 D4 remains superseded only for generic marketplace setup that can be
implemented once and reused across consumers. Stewards may own:

- a small schema and record of tested marketplace availability by exact
  surface;
- host-specific marketplace/plugin install command templates; and
- a skill that locates an explicitly selected CI job and adds the required
  setup step.

Grove continues to own its load path, role discovery, lifecycle behavior,
surface matrix, and evidence. Marketplace installation is an input to those
tests, never proof that they passed.

### 3. Preserve Grove's multi-host product contract

ADR-0031 remains current. Its one-kernel/two-adapter architecture, Grove
version authority, Codex bridge, surface matrix, and release process are not
changed by this reset.

## Consequences and propagation

1. ADR-0033 becomes historical and receives this forward pointer.
2. ADR-0029 and ADR-0031 receive narrow forward annotations.
3. No Grove spec, source, generated artifact, workflow, version, surface row,
   evidence record, or tag changes in this decision.
4. Grove waits for the narrow Stewards metadata and CI-authoring skill; it
   does not wait for or adopt a family release-certification engine.

## Acceptance criteria

- **AC1:** Only this ADR, forward annotations in ADRs 0029 and 0031, and
  ADR-0033's required `approved → superseded` lifecycle transition plus top
  forward pointer change.
- **AC2:** Grove release, support, evidence, and workflow files are
  byte-identical.
- **AC3:** Stewards ownership is limited to marketplace-test metadata and CI
  marketplace/plugin setup authoring.
- **AC4:** Marketplace availability never implies Grove behavioral support.
- **AC5:** No universal release, approval, history, runtime, sandbox, or
  effective-support obligation remains active.

## Self-check (gate)

- **Intent:** directly records the maintainer's request to remove the
  overarching theme and retain only metadata plus CI marketplace setup.
- **Scope:** decision-only; no implementation is inferred.
- **History:** supersedes ADR-0033 instead of deleting it.
- **Independence:** Grove's existing product release/support machinery remains
  authoritative and unchanged.
- **Result:** the independent decision adversary returned `SOUND`; the
  maintainer's explicit reset direction promotes this ADR to `approved`.

## Lifecycle record

The maintainer explicitly directed the family reset on 2026-07-24. The
independent decision adversary returned `SOUND` after one bounded acceptance-
criteria wording fix. Those acts promote this ADR from `gated` to `approved`.

No conformance upstream exists for this decision-layer artifact: its
`depends_on` decisions provide settled ground but are not an `implements`
contract. The conformance reviewer therefore correctly could not issue a
fidelity `PASS`; that is not a substitute for or contradiction of the
decision's human intent gate.
