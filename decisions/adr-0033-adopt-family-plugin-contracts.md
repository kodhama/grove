---
id: adr-0033-adopt-family-plugin-contracts
type: adr
status: superseded
depends_on: [adr-0028-plugin-release-tagging, adr-0029-non-interactive-loading, adr-0031-multi-host-distribution, stewards/kodhama-0015-family-plugin-release-and-surface-contract, stewards/kodhama-0016-distribution-availability-and-effective-support]
owner: agent
updated: 2026-07-24
---

# ADR-0033: Grove adopts the family plugin release, surface, and distribution contracts

> **Superseded by `adr-0034-narrow-stewards-marketplace-provisioning`.**

## Decision state

### Decided

- Grove adopts the merged Stewards package/surface contract
  (`kodhama-0015`) and distribution-availability ownership contract
  (`kodhama-0016`).
- Grove's existing `VERSION`, dual manifests, `surfaces.json`, tag workflow,
  and product-specific release validator remain its release machinery.
- Grove will validate its package and matrix against the immutable Stewards
  schema/registry artifacts once Stewards publishes them. Grove retains its
  stricter bridge and role-discovery checks as product extensions.
- Stewards owns generic catalog registration, package acquisition, and
  pre-agent headless/cloud provisioning. Grove continues to own its behavioral
  load paths, launchers, lifecycle setup, and exact-surface evidence.
- Grove PR CI gains read-only generated-tree, release-candidate, and shared
  family-contract checks before the existing post-merge tag workflow can run.
- No surface support state changes under this decision.

### Open

*(none)*

### Parked

*(none — exact schema/checker paths are implementation inputs Stewards has not
published yet, not Grove design questions. Implementation waits for those
immutable artifacts rather than guessing them.)*

## Context

Grove already implements the product half of the family contract at `0.3.0`:

- `plugins/grove/VERSION` is the declared host-neutral SemVer authority;
- both host manifests and `plugins/grove/surfaces.json` carry `0.3.0`;
- `grove-v0.3.0` identifies the release commit;
- release validation rejects carrier disagreement, incomplete surface
  classification, missing evidence, stale generated support documentation,
  and Grove-specific role-discovery defects; and
- only `codex-exec-non-ephemeral` is supported. Every other matrix row is
  explicitly unsupported.

`kodhama-0015` standardizes that release/surface shape across family plugins
without prescribing one authority filename or replacing product validators.
It names Grove's machinery as the reference implementation. Grove therefore
does not need a new version source, a second matrix, a new tag form, or a
rewrite of its release logic.

`kodhama-0016` makes a separate family-level decision: Stewards owns catalog
and provisioner availability, while products own behavioral support.
Marketplace presence, a clean install, and product behavior are independent
facts. Effective support is derived only when their exact release and surface
evidence agree.

That changes one Grove ownership decision. ADR-0029 D4 assigned Grove the
generic rollout carrier because no family provisioner existed. The new
Stewards carrier removes the reason for every product to duplicate marketplace
registration, acquisition, caching, and host setup. It does not remove
Grove's obligation to prove that the installed package exposes the complete
Grove role contract on each exact surface.

## Decision

### 1. Keep Grove's release identity and machinery

Grove declares:

- canonical SemVer authority:
  `plugins/grove/VERSION`;
- host carriers:
  `plugins/grove/.claude-plugin/plugin.json` and
  `plugins/grove/.codex-plugin/plugin.json`;
- product surface contract:
  `plugins/grove/surfaces.json`; and
- release tag:
  `grove-v<version>`.

Those sources, their equality checks, the human release act, and the
deterministic tag materializer remain exactly as decided by ADR-0028 and
ADR-0031. The current `0.3.0` values and tag remain valid; this decision does
not bump them.

Grove adopts `kodhama-0015`'s plugin-public-contract definition for future
bump judgment. ADR-0028 D3's existing operational result also stands:
pre-`1.0` breaking changes occupy the minor slot. The family decision now
states accurately that this is a Kodhama convention layered on SemVer, not a
rule SemVer itself prescribes.

Whether the later implementation requires a patch or minor release is judged
in its own version-bump PR from the resulting consumer-visible change. This
ADR does not pre-authorize that judgment or couple Grove to another product's
version.

### 2. Conform the existing matrix; do not replace it

`plugins/grove/surfaces.json` remains the sole Grove support authority. It
continues to bind its `version` to `VERSION` and to carry Grove-specific
`bridge_state`, evidence, support-record, missing-capability, and disclosure
fields.

Once Stewards publishes the versioned family surface schema, canonical
registry, and conformance fixtures, Grove shall:

1. declare the exact immutable family-contract artifact version/source used
   by the package;
2. validate every `surface_id`, host, common release state, and common
   state-required field against that pinned source;
3. run Grove's current extension validation afterward, including fixed
   inventory coverage, bridge-state rules, role identities, evidence paths,
   support-record contents, and generated README parity;
4. reject unknown, duplicated, or cross-host surface ids; and
5. keep a local copy only if it is a generated, checksum-bound derivative of
   the pinned Stewards authority. A hand-maintained second registry is
   forbidden.

The follow-up spec selects the concrete immutable artifact and invocation
after Stewards publishes it. Until then, Grove changes no schema field and
makes no claim of shared-schema conformance.

Family availability state is not copied into Grove's matrix. Grove records
behavior; Stewards records catalogs and provisioners. Any rendered effective
support view joins those authorities by exact package version, release tag,
source commit, and surface id.

### 3. Partially supersede only ADR-0029 D4's generic rollout ownership

ADR-0029 D1–D3 stand:

- the fleet remains plugin-carried and is never re-vendored;
- each supported surface needs an explicit install/load path; and
- cloud, CI, headless, and SDK behavior is proven independently.

ADR-0029 D4 is superseded only for the **generic rollout carrier**. Stewards
owns reusable marketplace registration, exact package acquisition, and
pre-agent provisioning adapters. The consumer explicitly selects the plugin,
host, surface, and version through that carrier.

Grove retains:

- the product-specific post-install setup/refresh behavior;
- generated project launchers and their ownership rules;
- the load/bridge requirement for each matrix row;
- complete Grove role discovery and producer/reviewer separation; and
- promotion or withdrawal of Grove support rows.

ADR-0029's cloud recipe and other D3 paths remain evidence targets for Grove
behavior. A Stewards provisioner may supply their generic acquisition step,
but its success cannot promote a Grove row. For example, `claude-cloud`
remains unsupported until a fresh cloud session proves the complete Grove
contract, regardless of whether Stewards can install the package there.

### 4. Read ADR-0031's channels through the new distribution boundary

ADR-0031's one kernel, two adapters, one Grove release identity, and thin
external catalogs stand. Its host-channel section now has a sharper ownership
boundary:

- Grove owns the installable package, manifests, setup contract, surface
  matrix, and behavioral evidence;
- Stewards owns whether a catalog selector is merely published, whether an
  immutable selector or exact-release provisioner is verified, and the
  corresponding acquisition evidence; and
- the consumer/environment owns selection, credentials, trust, and runtime
  prerequisites.

The current Stewards repository/path selectors are mutable catalog facts. They
do not become Grove release identity, distribution verification, or effective
support. A verified distribution route must select `grove-v<version>` or its
exact commit, whether through an immutable catalog selector or an
exact-release provisioner.

### 5. Move release-tree failures before merge

The write-capable `.github/workflows/release-tag.yml` remains isolated and
post-merge. It continues to rerun generation, tests, typechecks, package smoke,
release validation, and immutable-tag conflict checks before creating a tag.

The read-only PR workflow currently runs unit tests and syntax checks but does
not check the actual generated tree or actual release candidate. The
implementation adds a read-only PR job that runs:

```sh
npm run check --prefix plugins/grove/build
npm run check:release --prefix plugins/grove/release
<pinned Stewards family-contract conformance check>
```

The shared check is added only after its immutable artifact exists. It
validates the common contract; the existing Grove release command remains the
product-specific gate. This is deterministic mechanical CI, consistent with
ADR-0027's retained-CI boundary, and prevents a stale matrix, carrier,
generated table, or shared-schema mismatch from landing and being discovered
only by the post-merge tag job.

## Consequences and propagation

1. This decision PR adds no implementation and changes no release carrier,
   matrix row, evidence record, generated table, workflow, or package version.
2. ADR-0029 gains an append-only forward pointer limited to D4's generic
   rollout-carrier ownership.
3. ADR-0031 gains an append-only clarification of package/product ownership
   versus Stewards distribution availability.
4. Before implementation, `spec-0004-dual-host-distribution` is revised and
   version-bumped to consume this ADR and the published Stewards
   schema/registry artifacts. Its contract retains all Grove-specific support
   proof and adds the shared-conformance and PR-CI requirements above.
5. The implementation updates the applicable test-deps ledgers, adds common
   positive/negative fixtures without weakening Grove's fixtures, and passes
   both PR and release-tag validation.
6. No surface row is promoted by adoption. `codex-exec-non-ephemeral` remains
   the only supported `0.3.0` row unless a separate exact-surface support
   record passes the existing promotion gate.

## Acceptance criteria

- **AC1:** The ADR and its two forward pointers are the only files changed in
  this decision step.
- **AC2:** `VERSION`, both host manifests, `surfaces.json`, support evidence,
  generated documentation, workflows, and `grove-v0.3.0` are unchanged.
- **AC3:** Only ADR-0029 D4's generic rollout ownership is superseded; D1–D3
  and every Grove behavioral proof obligation stand.
- **AC4:** ADR-0031 continues to own Grove's package, release, adapters, and
  behavior while Stewards owns catalog/provisioner availability.
- **AC5:** The follow-up spec cannot select or implement a family checker
  until it can pin an immutable Stewards schema/registry artifact.
- **AC6:** PR CI fails on generated-tree drift, an invalid Grove release
  candidate, or common-contract nonconformance before merge; the tag workflow
  remains the isolated write-capable materializer.
- **AC7:** No unsupported row becomes supported from a catalog entry,
  provisioner result, another surface's evidence, or this adoption decision.

## Self-check (gate)

- **Settled ground:** the ADR depends on approved Grove ADRs and approved
  Stewards decisions. No unimplemented Stewards schema is treated as if it
  exists.
- **Exact delta:** Grove's working release identity and stricter product
  validator are preserved. Only ADR-0029 D4's generic carrier ownership moves;
  ADR-0031 receives an ownership clarification, not a behavioral rewrite.
- **Graph maintenance:** both approved upstream ADRs receive forward pointers;
  the revise-in-place spec and test-deps propagation are explicit pre-build
  obligations.
- **No inferred support:** the current one-supported/eleven-unsupported matrix
  is stated and unchanged; distribution evidence cannot promote behavior.
- **Review seams:** decision, revised spec, implementation, release bump, and
  exact-surface support promotion remain separate reviewable steps.
- **Intent gate:** the maintainer authorized this family-wide rollout and
  allowed merge after independent review; the decision-adversary returned
  SOUND, so `approved` records that prior human intent act.
