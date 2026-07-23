---
id: spec-0004-dual-host-distribution
type: spec
status: gated  # v3 self-checked 2026-07-23; spec-adversary APPROVE-READY and conformance-reviewer PASS on independent re-review; under steward's agent-owned spec gate these verdicts ratify downstream use while the human-only approved flip remains untouched
implements: adr-0031-multi-host-distribution
depends_on: [adr-0031-multi-host-distribution, adr-0032-status-emission-belongs-to-wisp]
owner: agent
updated: 2026-07-23
version: 3
---

# spec-0004 — dual-host distribution

This contract realizes `adr-0031-multi-host-distribution`: one authored Grove
methodology, generated Claude and Codex adapters, and an installable marketplace
channel for each host. It constrains the build, packages, lifecycle operations,
compatibility evidence, and release checks. It does not authorize the Codex
self-contained-agent fallback that the decision reserves for a later intent
gate.

> **Amendment (2026-07-23, `adr-0032-status-emission-belongs-to-wisp` +
> Codex compatibility spike).**
> **WHAT:** The Codex bridge, surface matrix, lifecycle operations, failure
> behavior, acceptance criteria, open questions, and self-check now record the
> observed launcher results and Grove's removal of status emission.
> **WHY:** The spike proved thin project launchers viable on non-ephemeral
> `codex exec`, proved only a partial skill-loading primitive in ephemeral
> mode, and left the interactive and other modes unverified; ADR-0032 removed the
> previously preserved Claude/Wisp exception.
> **SCOPE:** Behavioral version `v2`; canonical generation, dual manifests,
> release authority, marketplace boundaries, and the ban on self-contained
> charter TOML remain unchanged.
> **POINTER:** Current requirements live in “Codex compatibility evidence and
> bridge contract,” “Shared setup, refresh, set-profile, and remove contract,” “Surface
> matrix,” and the amended acceptance criteria below.
> **VALUE:** A maintainer can build the proven thin bridge without mistaking a
> launcher experiment for full release support or carrying a removed
> telemetry adapter into the new host.
> **CONFIDENCE:** `verified` — ADR-0032 is approved in the corpus, and the
> corrected observed results are retained in
> `plugins/grove/reference/surfaces/codex-bridge-spike-2026-07-23.json`.

> **Amendment (2026-07-23, independent spec-adversary and conformance reviews).**
> **WHAT:** Surface selection, exposure-specific discovery oracles, and
> existing-tag verification now have deterministic inputs and failure
> behavior.
> **WHY:** The v2 review found that an executor otherwise had to guess the
> active Codex mode, what counted as role discovery, and whether an existing
> release tag represented a valid rerun or a conflict. The conformance review
> also found a misreported spike result plus omitted set-profile, stamp-skew,
> evidence-retention, and ADR-propagation obligations.
> **SCOPE:** Behavioral version `v3`; no host capability, role behavior, or
> distribution authority changed.
> **POINTER:** Current requirements live in “Codex compatibility evidence and
> bridge contract,” “Shared setup, refresh, set-profile, and remove contract,”
> “Version and tag,” the propagation deliverables, and acceptance criteria
> `INV19`–`INV22` / `S17`–`S20`.
> **VALUE:** Lifecycle and release implementations can now fail closed without
> inventing mode detection, identity tests, or tag-conflict policy.
> **CONFIDENCE:** `verified` — the amendment directly closes the three
> independent review findings without changing ADR-0031's approved choices;
> the spike facts are retained in the package-local evidence record.

## Terms

| Term | Meaning |
|---|---|
| **kernel** | The canonical role and companion charters in `charters/`, plus host-neutral runtime behavior under `plugins/grove/`. |
| **adapter** | Host metadata, an invocation/loading pointer, or a deterministic projection required to expose the kernel on Claude or Codex. |
| **authored source** | A file a maintainer or agent edits directly as normative input. Generated output is never an authored source. |
| **projection** | A byte-deterministic file produced from an authored source and adapter metadata. |
| **role inventory** | The thirteen canonical role ids, their Codex-native underscore ids, and their permitted exposures: interactive driving-session role, cold native role, and, for `dispatcher`, the distinct scoped spawned advisor. It contains metadata and source paths, never charter instructions. |
| **bridge-viable** | A thin project TOML launcher successfully resolved and loaded its plugin-carried skill/reference on the exact Codex mode tested. This proves the loading primitive only; it is not a release-support claim. |
| **surface matrix** | One machine-readable record of host surfaces, support state, explicit load path, test evidence, and supported role identities. |
| **supported** | The recorded load path passed on a fresh instance of that exact surface for the release under test. |
| **unsupported** | Grove makes no role-loading claim for the surface and every Grove entrypoint available there reports that limitation rather than claiming or simulating role parity. |
| **host adapter surface** | The managed instruction block and any host-native launcher files composed into a consumer repository. |
| **surface invocation record** | The lifecycle input containing one exact `surface_id` from the surface matrix and its provenance (`host-runtime` or `user-explicit`). It carries no role instructions. |
| **discovery probe** | A host-neutral diagnostic request that returns only canonical role id, exposure class, canonical source path, and canonical-source digest. It proves identity/loading, not substantive role behavior. |

## Deliverables and ownership

| Deliverable | Authority | Required property |
|---|---|---|
| Role and companion charters | `charters/` | The only authored normative role/method prose. |
| Role inventory and host metadata | One machine-readable source in the Grove package | Metadata only; exactly thirteen unique role ids; every entry points to one canonical charter. |
| Claude role payload and companion copies | Generated | Deterministic projections from the kernel. |
| Codex plugin package | Generated or metadata-only | Carries skills/references, not custom-agent definitions; no separately authored charter body. |
| Codex project role bridge | Generated by setup from package metadata | Uses native underscore ids and thin TOML launchers only on bridge-viable surfaces. |
| Setup, refresh, set-profile, and remove behavior | One host-neutral operation source | Claude and Codex entrypoints are thin generated adapters over the same operation semantics. |
| Claude manifest | `plugins/grove/.claude-plugin/plugin.json` | Host metadata plus the shared release version. |
| Codex manifest | `plugins/grove/.codex-plugin/plugin.json` | Host metadata plus the same shared release version. |
| Release version | `plugins/grove/VERSION` | One line containing the current semantic version without a `v` prefix. |
| Surface matrix and spike evidence | Declared machine-readable sources in the Grove package | The matrix is the sole source for support claims and links immutable evidence records such as `reference/surfaces/codex-bridge-spike-2026-07-23.json`. |
| Claude marketplace entry | Existing Claude marketplace | Resolves the released Grove Claude package. |
| Codex marketplace entry | A Git-backed repo catalog at `.agents/plugins/marketplace.json` | Resolves the released Grove Codex package. |

An implementation may choose filenames for the role inventory and surface
matrix, but their paths shall be declared once in the generator configuration.
Tests shall consume those declared paths rather than searching for whichever
file happens to exist.

The build also owns ADR-0031's append-only corpus propagation. It shall add
forward annotations to:

- `adr-0014` for the shared, host-neutral, git-neutral lifecycle operation;
- `adr-0026` for the generated dual-adapter boundary and Codex project
  launcher exception;
- `adr-0028` for `plugins/grove/VERSION` replacing the Claude manifest as
  release authority while preserving the human-cut release; and
- `adr-0029` for the surface matrix and explicit per-surface load/support
  evidence.

Those annotations point forward to ADR-0031 and describe only the amended
boundary. They do not rewrite the earlier decisions in place.

## Canonical-source and generation contract

### Source boundary

- Every role-instruction paragraph originates in its corresponding
  `charters/<role>.md`.
- Every companion paragraph originates in `charters/lifecycle.md`,
  `charters/versioning.md`, or `charters/relations.md`.
- Host metadata may name a role, description, tool policy, source path,
  execution class, and output path. It shall not contain method, boundary, or
  workflow instructions copied from a charter.
- Setup/refresh/set-profile/remove semantics have one authored host-neutral source.
  Host-specific skill files contain only host invocation metadata and generated
  projections or pointers to that source.
- Generated output shall never be read as the source for another host's
  output. Both adapters derive from the kernel and host metadata directly.

### Generator behavior

The repository shall expose one documented generation command and a non-writing
check mode.

The generator shall:

1. validate that the role inventory contains exactly the thirteen roles named
   by the approved decision, only their permitted exposures, and one unique
   Codex-native id per native exposure;
2. reject duplicate role ids, missing charter sources, unexpected authored
   instruction fields, Codex-native ids containing hyphens, and output paths
   outside declared generated roots;
3. produce the Claude agent envelopes and companion projections;
4. produce the Codex skill/reference projections and the setup inputs for
   bridge-viable thin project launchers, but no plugin-carried custom agents;
5. produce host lifecycle entrypoints from the shared operation source;
6. mark every projection as generated and record its canonical source path;
7. write outputs in stable path and byte order; and
8. in check mode, exit non-zero and list every stale, missing, or unexpected
   generated output without modifying the working tree.

Generation tests shall change one canonical charter in a fixture and prove
that both affected host projections change, while unrelated role projections
remain byte-identical. A direct edit to either generated projection shall make
check mode fail.

## Codex compatibility evidence and bridge contract

The compatibility spike settled the bridge mechanism on a bounded set of
surfaces:

| Codex mode | Observed bridge result | Release implication |
|---|---|---|
| Local CLI, interactive | Not tested. | No support claim; interactive TTY smoke test required. |
| `codex exec`, non-ephemeral project | Thin project TOML launcher loaded a plugin-carried skill/reference. | `bridge-viable`; full release-support evidence remains required. |
| `codex exec`, ephemeral project | Thin launcher loaded the plugin skill; the plugin-relative role reference was not tested. | Partial primitive only; unsupported until the complete bridge and support record pass. |
| Desktop local | Not smoke-tested. | No support claim; desktop smoke test required. |
| IDE | Documentation-derived constraint; not tested in the spike. | Unsupported until an explicit supported path is verified. |
| Cloud/web | Not verified. | No support claim; classify unsupported for release until verified. |
| SDK | Not verified. | No support claim; classify unsupported for release until verified. |

Two facts constrain the implementation:

1. Codex plugins carry skills/references but do not install native custom-agent
   definitions.
2. Codex native agent ids use underscores. For a native Grove exposure, the
   generated id shall equal the role inventory's unique `native_id`, contain
   underscores rather than hyphens, and leave the canonical charter id and
   prose unchanged.

The bridge is therefore project-scoped
`.codex/agents/<native_id>.toml`, composed by setup on bridge-viable surfaces.
Each launcher points to its plugin-carried role skill/reference and contains
only Codex-required metadata, a Grove source reference, and loading
instructions; it contains no charter body. The plugin package itself shall
contain no custom-agent TOML.

Codex lifecycle operations shall receive a surface invocation record in
addition to the host id. A host adapter may populate `surface_id`
automatically only when the host exposes a stable runtime discriminator that
maps one-to-one to a matrix row; the adapter shall record that discriminator
as `host-runtime` provenance. In every other case, including the initial
Codex CLI implementation, the entrypoint shall require the caller to select
one exact matrix `surface_id` and record `user-explicit` provenance. It shall
not infer a mode from repository contents, terminal environment, process
ancestry, or the fact that a launcher file can be written.

An absent, unknown, contradictory, or host-mismatched surface id is a
pre-write failure: the operation lists the valid ids for that host and changes
no file. Setup and refresh may emit Codex launchers only when the selected row
is both `bridge-viable` and not classified `unsupported`. Selecting
`codex-exec-ephemeral`, `codex-desktop-local`, `codex-cloud-web`,
`codex-ide`, or `codex-sdk` at v3 therefore produces the row's unsupported
disclosure and no launcher write. A future runtime detector or newly supported
row changes the matrix/adapter metadata and its tests, not this precedence
rule.

Bridge viability proves only that this pointer/load primitive works. A surface
may be marked `supported` only after a fresh release candidate additionally
passes the full support record:

- host and surface id;
- Grove version and Codex build/version;
- clean-environment setup used;
- exact plugin install/load path;
- launcher form under test;
- all thirteen role identities and their expected execution class;
- observed discoverability for every identity;
- proof that a cold producer and an independent read-only reviewer can be
  invoked separately;
- proof that the driving task, not a spawned subagent, holds the full
  dispatcher and interactive-shaper responsibilities;
- proof that a spawned `dispatcher` is the one-shot advisory role only;
- proof that a cold role reads `.grove/config.toml` and an optional
  `.grove/agents/<role>.md` addendum; and
- pass/fail evidence with date and reproducible command or manual procedure.

“Observed discoverability” in that record has one oracle per exposure:

- **Driving-session exposure:** from a fresh supported session, invoke the
  generated Grove discovery entrypoint in the driving task. It passes only
  when the task returns the inventory-declared canonical id, exposure class,
  canonical source path, and digest matching the packaged canonical
  projection, without dispatching a subagent. The inventory shall assign this
  exposure to the full `dispatcher` and interactive `shaper`.
- **Cold native exposure:** enumerate the host-native agent id, invoke that
  exact id with the discovery probe, and require the same four fields to match
  its inventory row. Perform this independently for every inventory row that
  declares a native exposure; aggregate success requires every expected id
  exactly once and no undeclared Grove id.
- **Scoped spawned-dispatcher exposure:** enumerate and invoke its distinct
  native id with the discovery probe. In addition to the four matching fields,
  the returned exposure class shall be `scoped-advisor`, never
  `driving-session`.

The support fixture shall derive the expected set from the thirteen-row role
inventory, not from generated host files. It shall fail for a missing,
duplicate, extra, wrong-class, wrong-source, or wrong-digest identity. The
dispatcher/shaper boundary check shall additionally prove that the driving
task answers both driving-session probes without spawning, that no cold native
identity advertises the interactive-shaper class, and that the spawned
dispatcher advertises only `scoped-advisor`. These are loading and exposure
oracles; substantive role conformance remains governed by the canonical
charters and their own tests.

A bridge-viable surface is not `supported` until every support assertion
passes on that exact surface. A bridge failure or incomplete support record has
exactly two legal outcomes:

1. mark that surface `unsupported`, with the failed assertion visible in the
   surface matrix and install documentation; or
2. stop and return the evidence to the maintainer's intent gate.

The generator, setup skill, and executor shall not select or emit
self-contained TOML containing charter bodies. That fallback remains
unauthorized unless a later approved decision amends this contract.

## Dual plugin manifests

Both manifests shall:

- pass their host's manifest validation;
- identify the package as Grove;
- expose the host-appropriate generated skills and references;
- carry a `version` exactly equal to the trimmed contents of
  `plugins/grove/VERSION`; and
- describe only capabilities supported by the surface matrix.

The Codex manifest alone shall not be treated as proof that native roles load.
It supplies no custom agents. The Codex package is valid only when the
project-launcher bridge evidence and surface claims also validate.

The Claude install contract remains the existing marketplace install followed
by Grove setup. The Codex install contract is marketplace registration,
plugin installation, a fresh session, and Grove setup. Neither manifest nor
marketplace entry contains charter or lifecycle-operation prose.

## Shared setup, refresh, set-profile, and remove contract

The four consumer operations shall share one semantic implementation and
take the active host and surface invocation record as adapter parameters. Host
adapters may vary only in
manifest lookup, instruction-file target, marker text, launcher destination,
and host-facing command names. Per
`adr-0032-status-emission-belongs-to-wisp`, status emission is absent from the
shared lifecycle: setup does not compose it, refresh does not maintain it, and
remove recognizes only a legacy Grove-installed adapter for confirmed cleanup.

Before any write, each operation shall compare the installed package version
with every existing Grove-managed repository stamp. A mismatch is skew, not
automatic breakage: report both versions and whether the installation is ahead
or behind, then follow that operation's ordinary ownership/confirmation rules.
No operation may silently rewrite a stamp merely to hide skew.

### Setup

Setup shall:

- compose the shared consumer-owned `.grove/` floor exactly once;
- preserve existing consumer-authoritative `.grove/config.toml`,
  `.grove/gates.toml`, and `.grove/agents/` content unless the user explicitly
  approves a documented overwrite;
- create or update only the invoking host's marker-bounded block:
  `CLAUDE.md` for Claude and `AGENTS.md` for Codex;
- validate the surface invocation record before the first write and report its
  selected id and provenance;
- on Codex, compose only the spike-approved generated launcher files and
  refuse to overwrite a same-path consumer file that lacks Grove's generated
  ownership marker;
- compose no status-emission charter, skill, or adapter on either host;
- copy no charter or companion prose into the consumer repository;
- leave another host's existing managed block and launchers unchanged;
- remain git-neutral and make no recommendation about how the consumer lands
  the resulting files;
- keep the retired review-bookkeeping CI uninstalled; and
- report every path written, skipped, or refused.

Running setup twice for one host shall be idempotent. Running it once from each
host, in either order, shall produce one shared `.grove/` floor and one managed
adapter per installed host.

### Refresh

Refresh shall:

- regenerate Grove-managed floor files and the dial explainer from the
  installed package;
- preserve all consumer-authoritative `.grove/` files and addenda;
- update the invoking host's managed block and generated launchers;
- never create the other host's adapter if that adapter is absent;
- preserve an existing other-host adapter byte-for-byte;
- never install or refresh a status-emission adapter, and report a detected
  legacy Grove-installed copy as removable legacy state;
- disclose old stamp, installed version, and new stamp;
- fail without a partial stamp update when generation or managed-block
  verification fails; and
- perform no git action unless the user separately and explicitly requested
  that action.

### Set-profile

Set-profile shall preserve the existing Grove profile contract on both hosts:
accept only a named preset, show the effective row changes, obtain explicit
confirmation, replace only the preset-owned rows and provenance marker,
preserve the consumer-owned trigger/intent sections and optional runtime path,
and validate the floor after writing. It shall resolve the installed template
and host-facing setup command through adapter metadata rather than a
Claude-only environment variable or command name. Its only repository write is
the confirmed consumer-authoritative `.grove/gates.toml`; it shall never
create, refresh, or remove a host adapter.

### Remove

Remove shall first inventory the shared floor and both host adapter surfaces,
then ask before deleting any file. It shall remove only confirmed
Grove-owned files or exact marker-bounded blocks. Consumer-authored launcher
collisions, addenda, config, gates, and non-Grove instruction text shall be
preserved unless individually confirmed.

If one host adapter is retained, remove shall retain the shared `.grove/`
floor. The shared floor may be removed only when no retained host adapter
depends on it and the user confirms its removal. Removing repository files
shall not claim to uninstall either host plugin. A legacy Grove-installed
status adapter may be removed only through the same inventory and confirmation
path; remove shall not claim to change Wisp.

## Release and publication contract

### Version and tag

`plugins/grove/VERSION` is the release authority. Its value shall match
`MAJOR.MINOR.PATCH`. The Claude manifest, Codex manifest, generated package
metadata, and consumer stamp template shall match that value. At publication,
each marketplace entry shall resolve a package carrying that released value;
a catalog may continue to expose the preceding release until its publication
change lands. The release tag is `grove-v<VERSION>`.

The release workflow shall trigger on a change to the release authority and
shall, before creating a tag:

1. run generation in check mode;
2. validate both manifests;
3. validate exact version equality across all declared carriers;
4. validate that the surface matrix has no unclassified or pending row;
5. run package-level installation and role-discovery smoke tests for every
   supported automatable surface;
6. verify that unsupported rows are disclosed in generated install
   documentation; and
7. resolve the intended release commit as the workflow event commit for the
   merged version-authority change; and
8. create the tag only if it does not already exist; if it exists, peel it to
   a commit and no-op only when that commit equals the intended release commit,
   otherwise fail and report both commit ids without moving or replacing the
   tag.

The workflow is deterministic and idempotent. It does not choose the semantic
version level, publish a GitHub Release, merge a change, or revive the retired
review-bookkeeping gate. The maintainer's merge of the version-bump change is
the human release act.

### Marketplace channels

- The Claude catalog shall keep the existing `kodhama/stewards` channel and
  resolve the released Claude package.
- The Codex catalog shall be a Git-backed marketplace containing
  `.agents/plugins/marketplace.json` and an installable Grove entry resolving
  the released Codex package.
- The Codex catalog change is an outside-repository deliverable and shall be
  prepared in its own working copy, branch, and review.
- A channel smoke test shall start from a clean host environment, add the
  documented marketplace source, install Grove, start a fresh session, run
  setup, and execute the role-discovery checks for that surface.
- A marketplace is a catalog only. It shall not contain copied charters,
  companions, lifecycle-operation instructions, or an independently versioned
  Grove method.

## Surface matrix

The matrix shall contain at least these rows:

| Surface id | Bridge state at v3 | Release state at v3 |
|---|---|---|
| `claude-interactive` | Host-native agents; not a Codex bridge row. | Evidence required. |
| `claude-cloud` | Host-native agents; not a Codex bridge row. | Evidence required. |
| `claude-github-action` | Host-native agents; not a Codex bridge row. | Evidence required. |
| `claude-headless` | Host-native agents; not a Codex bridge row. | Evidence required. |
| `claude-agent-sdk` | Host-native agents; not a Codex bridge row. | Evidence required. |
| `codex-cli-interactive` | Not tested. | Unsupported until verified. |
| `codex-exec-non-ephemeral` | Verified bridge-viable. | Full support evidence required. |
| `codex-exec-ephemeral` | Partial skill-loading primitive; role reference untested. | Unsupported until the complete bridge and support record pass. |
| `codex-desktop-local` | Unknown; smoke test required. | Unsupported until verified. |
| `codex-cloud-web` | Unknown. | Unsupported until verified. |
| `codex-ide` | Documentation-derived constraint; not spike-tested. | Unsupported until an explicit path is verified. |
| `codex-sdk` | Unknown. | Unsupported until verified. |

Before release, every row shall resolve to `supported` or `unsupported`.
There is no implied support by host family: evidence for one row cannot satisfy
another, and `bridge-viable` does not satisfy the release state. Every supported
row names its explicit install/load path and full support record. Every
unsupported row names the missing capability and the user-visible failure or
disclosure. Generated documentation and manifest support claims shall be
derived from, or mechanically validated against, this matrix.

## Failure behavior

- A missing or stale generated output is a build failure.
- A manifest/version mismatch is a release failure.
- A marketplace entry that resolves a different version is a publication
  failure.
- A missing bridge or full-support record for a claimed Codex surface is a
  Codex release failure.
- A missing or invalid surface invocation record is a pre-write lifecycle
  failure.
- A role-discovery failure on a claimed-supported surface is a surface failure
  and removes that support claim until reverified.
- A Grove entrypoint on an unsupported surface shall state that Grove roles
  are unavailable there and shall not silently continue under generic-agent
  identities.
- A lifecycle operation that cannot prove ownership of a target file shall
  leave it untouched and report the collision.
- An existing `grove-v<VERSION>` tag that does not peel to the intended
  release commit is a release conflict; automation shall not move it.

## Non-goals

- Publishing to a public Codex plugin directory.
- Guaranteeing support for every named surface in the first release.
- A persistent runner-hosted dispatcher.
- A full dispatcher or interactive shaper running as a cold subagent.
- Self-contained Codex TOML containing generated charter bodies.
- A third authored charter, companion, instruction, or lifecycle-operation
  corpus.
- Reintroducing the retired review-bookkeeping CI or installing its dormant
  runtime through either host plugin.
- Changing Grove's gate semantics, role charters, or consumer-authoritative
  `.grove/` dials.
- Performing repository git actions from setup, refresh, or remove.
- Publishing a GitHub Release object or making a marketplace the version
  authority.

## Acceptance criteria

### EARS invariants

- **INV1 — canonical role source:** The build system shall derive every
  host-carried role instruction from exactly one `charters/<role>.md` source.
- **INV2 — no authored duplication:** The repository and marketplace catalogs
  shall contain no separately authored copy of charter, companion, or
  lifecycle-operation prose.
- **INV3 — deterministic adapters:** When canonical inputs and adapter metadata
  are unchanged, repeated generation shall produce byte-identical outputs.
- **INV4 — drift detection:** When any generated output differs from its
  expected projection, generation check mode shall exit non-zero without
  writing files and shall name the divergent path.
- **INV5 — inventory completeness:** The role inventory shall contain exactly
  thirteen unique canonical role ids, each resolving to one canonical charter,
  only its declared exposure set, and a unique underscore-form native id where
  a native exposure exists.
- **INV6 — bridge/support separation:** When a Codex surface is only
  bridge-viable, the release validator shall not classify it as supported
  until the full support record passes on that exact surface.
- **INV7 — fallback prohibition:** If the thin Codex bridge fails, the build
  shall not emit self-contained role TOML unless a later approved decision
  explicitly authorizes it.
- **INV8 — shared floor:** When both host adapters are installed, the consumer
  repository shall contain one shared `.grove/` floor and no host-specific
  copy of consumer configuration.
- **INV9 — bounded writes:** A lifecycle operation shall modify only declared
  Grove-managed files, exact managed blocks, and individually confirmed
  consumer-owned files.
- **INV10 — consumer authority:** Refresh shall never modify
  `.grove/config.toml`, `.grove/gates.toml`, or consumer-authored
  `.grove/agents/` addenda.
- **INV11 — version equality:** Before tagging, every in-package version
  carrier shall equal `plugins/grove/VERSION`; before publishing a channel,
  that channel's marketplace entry shall resolve a package with the same
  released version.
- **INV12 — evidence per surface:** A support claim shall be backed by evidence
  from the exact surface claimed; evidence shall not flow across matrix rows.
- **INV13 — fail loud:** When Grove cannot load its role identities on a
  surface, every available Grove entrypoint shall report the unsupported state
  and shall not label generic agents as Grove roles.
- **INV14 — channel parity:** Each host's documented marketplace path shall
  install the same Grove release version and expose only the capabilities
  classified for that host's surface.
- **INV15 — release gate:** The tag workflow shall create
  `grove-v<VERSION>` only after generation, manifest, version, surface, and
  package checks pass, and shall no-op only if an existing tag peels to the
  intended release commit.
- **INV16 — git neutrality:** Setup, refresh, set-profile, and remove shall perform no git
  add, commit, branch, push, pull-request, merge, or landing recommendation.
- **INV17 — plugin/agent boundary:** The Codex plugin shall carry no native
  custom-agent definitions; setup shall compose thin project launchers only
  for bridge-viable surfaces.
- **INV18 — status absence:** Setup and refresh shall compose or maintain no
  status-emission adapter; remove shall treat only a detected legacy
  Grove-installed copy as confirmed cleanup state.
- **INV19 — explicit surface selection:** Before a Codex lifecycle write, the
  operation shall validate one exact host-matched surface id with declared
  provenance; absent, ambiguous, unknown, contradictory, or unsupported input
  shall produce no launcher write.
- **INV20 — exposure-specific discovery:** A supported-surface discovery run
  shall derive all expected identities and exposure classes from the
  thirteen-row authored inventory and shall pass only when each declared
  driving-session, cold-native, and scoped-advisor exposure satisfies its
  corresponding oracle exactly once.
- **INV21 — immutable tag identity:** When `grove-v<VERSION>` already exists,
  release automation shall peel it to a commit and shall fail without changing
  the tag unless that commit equals the workflow event commit for the merged
  version-authority change.
- **INV22 — stamp skew disclosure:** When the installed Grove version differs
  from an existing consumer-repository Grove stamp, every Grove consumer
  operation shall report both values and the direction of skew before
  continuing; it shall never silently rewrite the stamp as reconciliation.

### GWT scenarios

#### S1 — a charter change reaches both hosts

**Given** a fixture containing generated Claude and Codex projections for one
role,
**When** that role's canonical charter changes and generation runs,
**Then** both projections update from that charter, unrelated roles remain
byte-identical, and check mode passes afterward.

#### S2 — a generated file is hand-edited

**Given** all projections match their sources,
**When** a generated host file is edited directly,
**Then** check mode exits non-zero, names that file, changes no file, and does
not accept the edit as a new source.

#### S3 — a bridge loads but support remains unproven

**Given** non-ephemeral `codex exec` loads one plugin-carried role
through a thin project launcher,
**When** the matrix records the spike result without a complete fresh-release
support record,
**Then** the surface is bridge-viable but not supported.

#### S4 — a bridge fails

**Given** an ephemeral `codex exec` project proves only skill loading, or
another proposed surface has an incomplete bridge record,
**When** the spike records that incomplete evidence,
**Then** the surface becomes unsupported or the work returns to the intent
gate, and no self-contained TOML is generated.

#### S5 — setup from both hosts

**Given** a clean consumer repository,
**When** Claude setup and Codex setup run in either order,
**Then** one shared `.grove/` floor exists, each host has exactly one managed
instruction block, Codex has only the spike-approved generated launchers, and
no charter, companion, or status-emission adapter was copied into the
repository.

#### S6 — setup meets a launcher collision

**Given** a consumer-authored file occupies a planned Codex launcher path and
lacks Grove's ownership marker,
**When** Codex setup runs,
**Then** setup leaves that file byte-identical, reports the collision, and does
not claim the affected role is installed.

#### S7 — refresh preserves consumer and other-host state

**Given** both host adapters exist and consumer config/addenda are edited,
**When** refresh runs from one host,
**Then** it refreshes the shared managed floor and invoking-host adapter,
preserves the consumer files and other-host adapter byte-for-byte, and reports
the version comparison; a legacy Grove status adapter is reported and not
maintained.

#### S8 — partial host removal

**Given** both host adapters share one `.grove/` floor,
**When** the user confirms removal of one adapter but retains the other,
**Then** remove deletes only the confirmed adapter surface and preserves the
shared floor and retained adapter.

#### S9 — full removal

**Given** Grove-owned files, consumer-owned dials, and unrelated instruction
text coexist,
**When** the user confirms full Grove removal,
**Then** remove deletes only confirmed Grove surfaces and exact managed blocks,
preserves unrelated text and unconfirmed consumer files, and does not claim
either plugin was uninstalled.

#### S10 — versions disagree

**Given** `plugins/grove/VERSION` differs from either manifest, generated
metadata, or the stamp template,
**When** release validation runs,
**Then** it exits non-zero and identifies every disagreeing carrier without
creating a tag; and **given** a supplied marketplace entry resolves a different
released version, **when** publication validation runs, **then** publication
fails and identifies that entry.

#### S11 — release validation succeeds

**Given** generation is clean, both manifests validate, all version carriers
match, every surface row is classified, and all supported-surface tests pass,
**When** the release workflow handles the merged version bump,
**Then** it creates `grove-v<VERSION>` once and a rerun performs no tag write
only after proving the existing tag resolves to that same workflow commit.

#### S12 — install through each marketplace

**Given** clean Claude and Codex environments and the documented catalog
sources,
**When** each environment adds its marketplace, installs Grove, starts a fresh
session, and runs setup,
**Then** each installs the same Grove version and passes the discovery contract
for its supported surface.

#### S13 — unsupported surface invocation

**Given** a surface matrix row marked unsupported,
**When** a user invokes an available Grove entrypoint on that surface,
**Then** the entrypoint reports the unsupported surface and missing capability
and does not silently substitute generic agents.

#### S14 — marketplace contents stay thin

**Given** both marketplace catalog changes,
**When** publication validation scans their Grove entries,
**Then** each entry contains only catalog/package metadata and no charter,
companion, or lifecycle-operation body.

#### S15 — native Codex ids and package boundary

**Given** the thirteen-role inventory and generated Codex package,
**When** generation and package validation run,
**Then** every native exposure has a unique underscore-form id, the plugin
contains skills/references but no custom-agent TOML, and setup owns generation
of the project launchers.

#### S16 — removed status adapter stays removed

**Given** a new dual-host install and a separate legacy consumer containing a
Grove-installed status adapter,
**When** setup and refresh run on the new install and remove inventories the
legacy consumer,
**Then** setup and refresh write no status-emission surface, while remove
offers only the detected legacy adapter for explicit confirmed cleanup and
makes no Wisp change.

#### S17 — Codex surface input fails closed

**Given** a Codex lifecycle invocation with no surface id, an unknown id, a
Claude id, contradictory provenance, or a v3 unsupported Codex id,
**When** setup or refresh validates its surface invocation record,
**Then** it reports the valid Codex ids and the reason for refusal, writes no
launcher or managed block, and does not infer a mode from the environment;
and **given** an explicit `codex-exec-non-ephemeral` record, **when** setup
validates it, **then** the selected id and provenance are reported before the
bounded writes proceed.

#### S18 — discovery is complete by exposure

**Given** a fresh candidate on a claimed-supported surface and the authored
thirteen-row inventory,
**When** discovery runs,
**Then** the driving task returns matching source identity for full dispatcher
and interactive shaper without spawning, every declared cold-native id is
enumerated and returns matching source identity independently, the spawned
dispatcher returns `scoped-advisor`, no cold identity claims interactive
shaper, and any missing, duplicate, extra, wrong-class, wrong-source, or
wrong-digest result fails the surface record.

#### S19 — an existing release tag is either identical or conflicting

**Given** all release checks pass and `grove-v<VERSION>` already exists,
**When** release automation peels the tag,
**Then** it performs no tag write if the peeled commit equals the workflow
event commit; **but given** a different peeled commit, **when** the same check
runs, **then** it fails, reports both commit ids, and does not move, delete, or
replace the tag.

#### S20 — installed and stamped versions disagree

**Given** a consumer repository stamped with one Grove version and a different
installed Grove version,
**When** setup, refresh, set-profile, or remove starts,
**Then** the operation reports both versions and whether the installation is
ahead of or behind the repository before any write, preserves the stamp unless
that operation's separately authorized managed update owns it, and never
describes the mismatch as silently reconciled.

## Open questions

None. The thin bridge is settled as viable for non-ephemeral `codex exec`;
interactive CLI and desktop local still owe their smoke tests, and that does
not settle release support, which remains earned per matrix row. Unknown surfaces
remain unsupported until verified. A failed thin bridge returns to the
maintainer's intent gate before any fallback is adopted. The exact Git
repository hosting the Codex catalog is a publication input, not a second
method authority; the selected source must satisfy the marketplace-channel
criteria above.

## Rubric check

`SPEC_RUBRIC_PATH` is explicitly configured as
`none — no spec rubric exists yet`; that absence was verified in
`.grove/config.toml`, and no contract-author addendum exists. Self-check
against the contract-author charter:

- **Settled input:** PASS — `adr-0031-multi-host-distribution` and
  `adr-0032-status-emission-belongs-to-wisp` are approved; ADR-0031 remains
  the single `implements:` upstream and both appear in `depends_on`.
- **Required shape:** PASS — shared frontmatter, behavioral `version: 3`, the
  section-level amendment note, explicit non-goals, acceptance criteria, open
  questions, and this rubric check are present.
- **Both test grammars:** PASS — behavioral examples use Given/When/Then and
  requirements use EARS `shall` statements.
- **No invented fallback:** PASS — thin-launcher failure returns to the intent
  gate; self-contained TOML remains unauthorized.
- **No duplicated corpus:** PASS — the contract defines canonical sources,
  metadata-only adapters, deterministic projections, and drift rejection
  without repeating any charter or lifecycle-operation body.
- **Bounded scope:** PASS — public-directory publication, universal first-wave
  support, persistent orchestration, CI-bookkeeping revival, and unrelated
  role/gate changes are excluded; ADR-0032's removed status surface is not
  reintroduced.
- **Testability:** PASS — generation drift, explicit surface selection,
  exposure-specific discovery, immutable tag identity, stamp-skew disclosure,
  bridge evidence, managed-file
  ownership, underscore ids, plugin/agent boundaries, status absence, version
  equality, channel installs, and per-surface support each have observable
  pass/fail behavior.
- **Lifecycle:** PASS — these significant revise-in-place amendments have
  durable decision/review inputs and bump `v1 → v2 → v3`; the spec remains self-checked at
  `gated`, with independent intrinsic-quality and fidelity reviews owed before
  implementation proceeds under the project gate profile.
