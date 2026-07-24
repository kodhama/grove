---
id: adr-0035-plugin-and-consumer-boundary
type: adr
status: approved  # maintainer intent: “let's do this change first” after selecting the no-internal, host-isolated target; decision-adversary NEEDS-REVISION twice, both graph/wording findings folded, then SOUND on scoped re-review; ship remains human
depends_on: [adr-0018-gate-profile-and-trigger-split, adr-0020-dispatcher-honors-gate-profile, adr-0021-gate-profile-self-adoption, adr-0026-thin-vendor-boundary, adr-0027-retire-ci-for-now, adr-0031-multi-host-distribution, adr-0034-narrow-stewards-marketplace-provisioning]
owner: agent
updated: 2026-07-24
---

# ADR-0035: make the plugin the runtime boundary and `.grove/` the consumer contract

## Decision state

### Decided

- The installable `plugins/grove/` subtree contains only Grove's release
  declarations, host adapters, shared runtime, runtime references, and package
  metadata.
- Claude and Codex components live under separate adapter directories and are
  exposed only through their own manifests. The plugin root contains no
  default-discovered `skills/`, `agents/`, `commands/`, or root `SKILL.md`.
- Consumer repositories keep only their configuration, optional role addenda,
  and the short generated dial explainer under `.grove/`. Grove installs no
  executable or fixed enforcement data under `.grove/internal/`.
- Gate-profile resolution remains deterministic and occurs at every handover.
  The active host adapter invokes the resolver from the installed plugin when
  `runtime_dir` is absent. An explicit non-legacy `runtime_dir` remains a
  consumer override.
- Existing `.grove/internal/` installations migrate through inventory and
  explicit confirmation. A legacy `runtime_dir = ".grove/internal/gates/"`
  cannot be invalidated silently.
- Build, release, test, and probe machinery stays in this repository but moves
  outside the installable plugin subtree. The dormant review-bookkeeping code
  remains preserved outside the plugin. Whether any of that machinery should
  later be deleted is explicitly out of scope.

### Open

*(none)*

### Parked

- A later repository audit may retire unnecessary build, release, test, probe,
  or dormant-review machinery. This decision changes placement and loading,
  not whether those tools have earned their continued existence.

## Context

ADR-0018 originally used `.grove/internal/` to mean Grove-authoritative files
vendored into a consumer repository. That boundary predated the plugin-carried
fleet. ADR-0026 later moved the fleet and companions into the plugin so a
consumer would keep only what it owns, but the gate resolver and fixed
enforcement file remained copied into `.grove/internal/`.

The dual-host package then inherited that installed floor. Setup currently
copies the package's gate runtime into `.grove/internal/gates/` and copies
`reference/gates/enforcement.toml` into
`.grove/internal/enforcement.toml`. The dispatcher invokes the copied resolver
at every handover by default.

This produces three boundary failures:

1. executable plugin code is duplicated into every consumer and refreshed as a
   second runtime copy;
2. the meaning of `internal` is ambiguous between plugin-private and
   Grove-managed consumer content; and
3. Claude and Codex share root discovery directories, so host-specific role
   skills can become visible on the wrong host.

The package subtree also contains build generators, release validators, tests,
probes, and the dormant review-bookkeeping implementation. Git-subdirectory
marketplaces install that selected subtree as the plugin package, so those
maintainer tools travel with every installation even though setup never uses
them.

## Decision

### 1. `.grove/` is the consumer contract

The standard composed tree is:

```text
.grove/
  README.md
  gates.toml
  config.toml
  agents/
```

Ownership remains explicit:

- `.grove/gates.toml` and `.grove/config.toml` are
  consumer-authoritative;
- `.grove/agents/<role>.md` is an optional consumer-authored addendum; and
- `.grove/README.md` is a short Grove-managed explanation of those dials.

No standard setup or refresh operation creates `.grove/internal/`. Fixed
methodology data and executable behavior are plugin-owned and remain in the
installed package.

### 2. One package carries two isolated adapters

The installable package has this top-level shape:

```text
plugins/grove/
  .claude-plugin/
  .codex-plugin/
  VERSION
  README.md
  adapters/
    claude/
      agents/
      skills/
    codex/
      skills/
  runtime/
    lifecycle/
    gates/
  reference/
  metadata/
```

`adapters/claude/agents/` contains generated Claude agent envelopes.
`adapters/claude/skills/` contains only Claude lifecycle entrypoints.
`adapters/codex/skills/` contains Codex lifecycle entrypoints and role skills.
They are generated read-through adapters over one runtime and one canonical
charter corpus; they are not new authored instruction sources.

The Claude manifest declares its generated agent files explicitly and points
its skill path at `adapters/claude/skills/`. The Codex manifest points its skill
path only at `adapters/codex/skills/`. The root default discovery directories
are absent. Static and clean-install tests assert exact positive and negative
inventories for both hosts.

Both hosts may physically receive both small adapter trees because they install
one Git package root. They load only their declared adapter. Physically
host-specific packages would require separate package roots or published build
artifacts and are not introduced here.

### 3. The resolver runs from the active plugin

ADR-0020's semantic requirement stands: the dispatcher resolves the profile at
every gate and handover, catches mid-run edits, validates the human intent
floor, and fails loudly to the guardian posture on invalid input.

Only the runtime location changes:

- absent `runtime_dir` means the resolver shipped by the active Grove plugin;
- a declared non-legacy `runtime_dir` remains an explicit consumer choice and
  is never searched around or silently substituted;
- host adapters resolve their installed package path without writing an
  absolute cache path into the repository; and
- the canonical dispatcher charter states the semantic operation while each
  generated host adapter supplies the host-specific invocation.

Claude and Codex must each prove this path from a clean installed cache at an
arbitrary directory depth and at a path containing spaces. A source-checkout
success is not evidence of an installed-package path.

The package-local enforcement file may remain until the later tooling audit,
but setup does not copy it into the consumer. No release may claim that fixed
enforcement data is active unless an executable reader consumes it.

### 4. Tooling remains source-side and uninstalled

Maintainer machinery moves outside `plugins/grove/`:

```text
tooling/grove/
  build/
  release/
  tests/
  probes/

retired/review-bookkeeping/
```

This is a packaging move, not a deletion or judgment that every tool is
necessary. Runtime tests continue to import and exercise the installed-package
modules from their new source locations. Release and probe commands build an
ephemeral package snapshot from the exact `plugins/grove/` allowlist and
operate on that snapshot.

Generated host adapters and frontmatter-free charter projections remain
committed because the Git marketplace installs the source tree and performs no
build. CI regenerates them ephemerally and fails on drift; no separately
published distribution artifact or distribution repository is introduced.

### 5. Migration is explicit and bounded

New setup creates no `.grove/internal/`.

Refresh:

1. inventories the known legacy `.grove/internal/gates/` and
   `.grove/internal/enforcement.toml` paths;
2. reports unexpected or symlinked content and refuses tree deletion unless
   ownership is confirmed;
3. if `runtime_dir` is absent, may offer confirmed removal of the legacy
   managed files because the active adapter uses the plugin runtime;
4. if `runtime_dir` names `.grove/internal/gates/`, offers a separate confirmed
   consumer-config migration before removing its target; and
5. preserves any other explicit runtime path.

Remove continues to recognize the old internal tree as legacy Grove-managed
state. Removing one host retains shared consumer configuration for the other.
Removing both hosts still preserves unconfirmed consumer configuration and
addenda.

Concurrent sessions using the old runtime are not silently invalidated.
Migration reports that existing Grove sessions must be restarted before
confirmed deletion; automatic deletion is not used to force convergence.

## Consequences and propagation

1. ADR-0018 D5 is partially superseded: placement by authority still
   distinguishes consumer-owned from Grove-managed files, but Grove-managed
   runtime no longer implies a consumer `.grove/internal/` home.
2. ADR-0021 D2 is partially superseded: `runtime_dir` remains declared-never-
   searched, but its absent default becomes the active plugin runtime rather
   than `.grove/internal/gates/`.
3. ADR-0026's narrow repo-installed gate-runtime exception is superseded; its
   plugin-carried fleet, consumer config/addenda, and single release pin stand.
4. ADR-0031's one-kernel/two-adapter decision stands and gains an explicit
   physical adapter boundary and package-only runtime.
5. ADR-0034's product-owned package and behavioral validation boundary stands,
   but its statement that the then-current release validator and workflow
   remain unchanged is partially superseded: validator and probe sources move
   outside the installable package, while the release workflow stays under
   `.github/workflows/` and its wiring changes to invoke the relocated
   validator against the exact package snapshot. Their authority and behavior
   remain Grove-owned. Marketplace setup remains an external input rather than
   behavior proof.
6. `spec-0004-dual-host-distribution` is revised in place, version-bumped, and
   independently reviewed before implementation.
7. The dispatcher charter, gate template, lifecycle operations, generator,
   release validator, probes, documentation, and test-deps ledgers follow the
   revised spec in the implementation step.
8. Package version judgment remains a later release act. This decision does
   not bump `VERSION` or promote a surface.

## Acceptance criteria

- **AC1:** the standard setup result contains no `.grove/internal/`.
- **AC2:** the installable package has an exact allowlist and contains no
  build, release, test, probe, or dormant review-bookkeeping implementation.
- **AC3:** a clean Claude install exposes only the declared Claude lifecycle
  skills and generated native agents; no Codex `role-*` skill is discovered.
- **AC4:** a clean Codex install exposes only the declared Codex lifecycle and
  role skills; no Claude agent is treated as a Codex component.
- **AC5:** both hosts invoke the same package-resident gate semantics from an
  installed cache without repository-absolute cache paths.
- **AC6:** per-handover guardian fallback and human-intent-floor validation are
  behaviorally unchanged.
- **AC7:** legacy internal runtime and legacy `runtime_dir` migration are
  inventoried, confirmation-bound, and covered by upgrade fixtures.
- **AC8:** build, release, tests, probes, and dormant check code remain in the
  source repository for the later audit.
- **AC9:** generated projections remain deterministic and CI rejects drift or
  host-component leakage.
- **AC10:** no surface support row, marketplace authority, release tag, or
  version changes merely because of the packaging move.

## Self-check

- **Settled intent:** the maintainer selected the no-`internal` consumer target,
  requested host-isolated plugin structure, and explicitly asked to perform
  this change before auditing whether the retained tooling is necessary.
- **Minimal first:** no tool is deleted and no distribution repository,
  installer build step, or new release authority is introduced.
- **Directional flow:** implementation remains blocked until this decision is
  independently challenged and Spec 0004 is revised and gated.
- **Graph maintenance:** every superseded location contract and the dual-host
  spec are named explicitly.
- **Migration:** existing managed copies, consumer overrides, and concurrent
  old sessions are not silently discarded.
- **Intent gate:** the maintainer's explicit direction records the human intent
  act; independent decision review returned `SOUND` after two bounded
  graph/wording revision rounds. The later ship gate remains human.

## Lifecycle record

The maintainer selected the no-`.grove/internal/`, host-isolated package target
and then directed: “let's do this change first,” explicitly deferring the
tooling-necessity audit. The independent decision adversary returned
`NEEDS-REVISION` for dependency-edge and ADR-0034 wording defects, returned a
second bounded `NEEDS-REVISION` for validator-versus-workflow placement
precision, and then returned `SOUND` after both revisions. Those acts promote
this decision to `approved`; they do not perform the later human-owned ship
gate.
