---
id: spec-0004-dual-host-distribution
type: spec
status: gated  # v5 conformance PASS covered 239874d; residual intrinsic findings folded and self-checked 2026-07-25; fresh spec-adversary and scoped conformance re-reviews are owed on the changed final SHA before implementation
implements: adr-0031-multi-host-distribution
depends_on: [adr-0031-multi-host-distribution, adr-0032-status-emission-belongs-to-wisp, adr-0035-plugin-and-consumer-boundary, adr-0036-pre-execution-planning]
owner: agent
updated: 2026-07-25
version: 5
---

# spec-0004 — dual-host distribution

This contract realizes `adr-0031-multi-host-distribution`: one authored Grove
methodology, generated Claude and Codex adapters, and an installable marketplace
channel for each host. It constrains the build, packages, lifecycle operations,
compatibility evidence, package/consumer boundary, migration, and release
checks. As amended by `adr-0036-pre-execution-planning`, it also constrains the
advisory implementation-planning role, local handoff, portable resource
intent, experiment, and fourteen-role first-release requalification. It does
not authorize the Codex self-contained-agent fallback that the decision
reserves for a later intent gate.

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

> **Amendment (2026-07-24, `adr-0035-plugin-and-consumer-boundary`).**
> **WHAT:** The package tree, host discovery and driving-session loaders,
> consumer floor and stamps, gate-runtime location, versioned legacy ownership
> migration, per-surface lifecycle writes, source-side tooling placement,
> package snapshot, and their acceptance criteria now state the plugin-only
> runtime and isolated host-adapter boundary.
> **WHY:** The former package duplicated executable gate code into
> `.grove/internal/`, mixed maintainer machinery into the installable subtree,
> and allowed root discovery directories to blur Claude and Codex exposure.
> **SCOPE:** Behavioral version `v4`; canonical role generation, the Codex
> bridge and surface evidence, shared lifecycle ownership, release authority,
> marketplace channels, status-emission absence, and immutable-tag behavior
> remain unchanged except where their paths or package inputs follow the new
> boundary.
> **POINTER:** Current requirements live in “Deliverables and ownership,”
> “Installable package and host-discovery contract,” “Gate runtime contract,”
> “Shared setup, refresh, set-profile, and remove contract,” “Release and
> publication contract,” and acceptance criteria `INV23`–`INV36` /
> `S21`–`S34`.
> **VALUE:** A Grove consumer keeps only its own dials and addenda while each
> host loads exactly its intended adapter from one package-resident runtime.
> **CONFIDENCE:** `verified` — approved ADR-0035 selects this boundary,
> preserves the existing dual-host and release semantics, and requires exact
> package, discovery, installed-cache, and migration evidence.

> **Amendment (2026-07-25, `adr-0036-pre-execution-planning`).**
> **WHAT:** Inventory completeness, the canonical role/generation contract,
> deterministic work-scope collection, route classification and activation,
> executor authority, advisory packet wire/coverage and typed-reference rules,
> bounded relay/recovery, context-bound resource resolution, experimental
> accounting, release requalification, acceptance criteria, open questions,
> and the rubric check now include the `implementation-planner` increment and
> the independent-review refinements.
> **WHY:** ADR-0036 approved an advisory cold planning handoff before
> code-bearing spec execution, required an inventory-derived fleet contract
> with fourteen roles in its first release, and preregistered the experiment
> that must justify any permanent optimized route.
> **SCOPE:** Behavioral version `v5`; the v4 package boundary, lifecycle
> operations, surface classifications, marketplace authority, gate semantics,
> status-emission absence, and immutable release-tag behavior remain
> unchanged.
> **POINTER:** Current requirements live in “Pre-execution planning contract,”
> “Portable resource-resolution contract,” “Planning experiment and
> evidence,” the inventory-derived generation/support/release clauses, and
> acceptance criteria `INV37`–`INV57` / `S35`–`S58`.
> **VALUE:** As a maintainer, I can test whether an explicit implementation
> plan lets a medium executor retain accepted quality without making that plan
> authoritative or weakening Grove’s dual-host guarantees.
> **CONFIDENCE:** `inferred` — approved ADR-0036 fixes the role boundary,
> routing exceptions, packet fields, resource ownership, experiment arms,
> metrics, truth tables, thresholds, and first-release count; the exact
> oracle, wire schema, classification evidence, retry bound, probe contract,
> work-scope and cross-reference namespaces, context-bound resource bindings,
> and accounting normalization are the narrow deterministic contract
> resolutions needed to make those approved choices executable after
> independent review, without changing product intent.

## Terms

| Term | Meaning |
|---|---|
| **kernel** | The canonical role and companion charters in `charters/`, plus the host-neutral runtime shipped under `plugins/grove/runtime/` and its package-carried projections under `plugins/grove/reference/`. |
| **adapter** | Host metadata, an invocation/loading pointer, or a deterministic projection required to expose the kernel on Claude or Codex. |
| **authored source** | A file a maintainer or agent edits directly as normative input. Generated output is never an authored source. |
| **projection** | A byte-deterministic file produced from an authored source and adapter metadata. |
| **role inventory** | Every canonical role id declared by `plugins/grove/metadata/roles.json`, its Codex-native underscore id where applicable, permitted exposure, local dispatch declarations, portable resource class where applicable, and canonical source/output paths. It contains metadata, never charter instructions. The first release containing `implementation-planner` must be bijective with this spec's independent fourteen-id oracle. |
| **ratified spec** | An `approved` spec, or a `gated` spec whose active agent-owned gate has a posted independent convergence record ratifying that exact version for downstream use. |
| **advisory plan packet** | The bounded, non-authoritative output of a cold `implementation-planner`; it is relayed beside the ratified artifact pointer, never added to the artifact graph or used as review evidence. |
| **resource class** | A host-neutral role intent declared in `metadata/roles.json`; in an applicable binding context, a host resolves it to one exact concrete model selector through versioned defaults and optional consumer override. |
| **effective resource map** | The exact resource-class-to-model-selector mapping after applying one host's defaults and any exact consumer override; it is recorded in support and experiment evidence. |
| **resource binding context** | The dispatch context that selects either the preserved pre-adoption direct selector, arm A's exact premium pin, or the class map for experiment B/C and activated production. |
| **bridge-viable** | A thin project TOML launcher successfully resolved and loaded its plugin-carried skill/reference on the exact Codex mode tested. This proves the loading primitive only; it is not a release-support claim. |
| **surface matrix** | One machine-readable record of host surfaces, support state, explicit load path, test evidence, and supported role identities. |
| **supported** | The recorded load path passed on a fresh instance of that exact surface for the release under test. |
| **unsupported** | Grove makes no role-loading claim for the surface and every Grove entrypoint available there reports that limitation rather than claiming or simulating role parity. |
| **host adapter surface** | The managed instruction block and any host-native launcher files composed into a consumer repository. |
| **surface invocation record** | The lifecycle input containing one exact `surface_id` from the surface matrix and its provenance (`host-runtime` or `user-explicit`). It carries no role instructions. |
| **discovery probe** | A host-neutral diagnostic request that returns only canonical role id, exposure class, canonical source path, and canonical-source digest. It proves identity/loading, not substantive role behavior. |
| **consumer contract** | The standard `.grove/` tree: consumer-authoritative `gates.toml`, `config.toml`, optional `agents/` addenda, and the Grove-managed short `README.md`; it contains no executable runtime or fixed enforcement payload. |
| **package allowlist** | The declared exact set of installable paths under `plugins/grove/`; validation rejects every path not in the set and every missing declared path. |
| **legacy internal state** | The known prior Grove-managed paths `.grove/internal/gates/` and `.grove/internal/enforcement.toml`, plus a `runtime_dir` whose repository-relative normalized target is `.grove/internal/gates`. |
| **repository stamp** | The exact `grove plugin@<MAJOR.MINOR.PATCH>` line inside a valid Grove-managed host instruction block; it records the package version that last successfully wrote that block and is not release authority. |
| **valid-unsupported surface** | A known, host-matched surface-matrix row with valid provenance whose release state is `unsupported`; its identity is valid input even though Grove role loading is unavailable there. |
| **invalid surface input** | An absent, malformed, unknown, host-mismatched, multiply selected, or provenance-contradictory surface invocation record. |

## Deliverables and ownership

| Deliverable | Authority | Required property |
|---|---|---|
| Role and companion charters | `charters/` | The only authored normative role/method prose. |
| Role inventory, lifecycle inventory, surface matrix, host metadata, stamp schema, and legacy ownership inventory | `plugins/grove/metadata/` | Metadata only; role completeness derives from every unique canonical row in `metadata/roles.json`, whose first `implementation-planner` release is checked bijectively against this spec's fourteen-id oracle; `metadata/hosts.json` carries versioned per-host resource defaults and the fixture-proven pre-adoption direct selector; host inventories declare exact positive discovery and driving-session loaders; the versioned legacy inventory declares exact historical managed bytes without carrying old executable code. |
| Implementation-planner charter | `charters/implementation-planner.md` | The only authored normative planning-role contract: cold-started, read-only, advisory, locally triggered, and bounded to ratified code-bearing spec work. |
| Claude adapter | `plugins/grove/adapters/claude/` | Generated native-agent envelopes plus only the four lifecycle skill entrypoints; its manifest exposes only this adapter. |
| Codex adapter | `plugins/grove/adapters/codex/` | Generated lifecycle and role skills, no custom-agent definitions; its manifest exposes only this adapter. |
| Shared runtime | `plugins/grove/runtime/lifecycle/` and `plugins/grove/runtime/gates/` | The only installed executable lifecycle and gate behavior; host adapters invoke it in place and setup never copies it into a consumer. |
| Runtime references | `plugins/grove/reference/` | Deterministic frontmatter-free projections and fixed package data; no path is a host-discovery root. |
| Codex project role bridge | Generated by setup from package metadata | Uses native underscore ids and thin TOML launchers only on bridge-viable surfaces. |
| Setup, refresh, set-profile, and remove behavior | One host-neutral operation source | Claude and Codex entrypoints are thin generated adapters over the same operation semantics. |
| Claude manifest | `plugins/grove/.claude-plugin/plugin.json` | Host metadata plus the shared release version. |
| Codex manifest | `plugins/grove/.codex-plugin/plugin.json` | Host metadata plus the same shared release version. |
| Release version | `plugins/grove/VERSION` | One line containing the current semantic version without a `v` prefix. |
| Package declarations | `plugins/grove/README.md`, both manifest directories, `VERSION`, `adapters/`, `runtime/`, `reference/`, and `metadata/` | These are the only permitted package-root entries; an exact recursive leaf allowlist is declared once and validated before any package or release claim. |
| Surface matrix and spike evidence | Declared machine-readable sources under `plugins/grove/metadata/` or `plugins/grove/reference/` | The matrix is the sole source for support claims and links immutable evidence records such as `reference/surfaces/codex-bridge-spike-2026-07-23.json`. |
| Maintainer machinery | `tooling/grove/build/`, `tooling/grove/release/`, `tooling/grove/tests/`, and `tooling/grove/probes/` | Retained source-repository inputs outside the installable package; tests import package modules and release/probe commands operate on an exact ephemeral package snapshot. |
| Planning experiment harness | Source-side maintainer machinery outside `plugins/grove/` | Runs the preregistered three-arm study without changing the source tree and writes preregistration/results only to a caller-supplied out-of-tree evidence root. |
| Dormant review bookkeeping | `retired/review-bookkeeping/` | Preserved, dormant, and outside the installable package; no lifecycle or release path installs it. |
| Claude marketplace entry | Existing Claude marketplace | Resolves the released Grove Claude package. |
| Codex marketplace entry | A Git-backed repo catalog at `.agents/plugins/marketplace.json` | Resolves the released Grove Codex package. |

An implementation may choose filenames for the role inventory, lifecycle
inventory, surface matrix, host inventories, stamp schema, legacy ownership
inventory, and recursive package allowlist, but their paths shall be declared
once in the generator configuration. Tests shall consume those declared paths
rather than searching for whichever file happens to exist. The package
allowlist itself shall be one of its declared leaves; it shall not authorize a
path merely because that path is beneath an allowed directory.

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

## Installable package and host-discovery contract

### Exact package tree

The installable package root shall contain exactly these top-level entries:

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

The package allowlist shall enumerate every permitted regular-file or symlink
leaf below that shape by repository-relative path and declared kind. A
directory prefix or glob is not an allowlist entry. Package validation shall
compare the complete physical `plugins/grove/` tree with that declared set and
fail on any missing, extra, duplicate, case-colliding, escaping, broken, or
kind-mismatched path. A symlink is permitted only when its exact path and link
target are declared, its resolved target remains within the package root, and
the target is also allowlisted.

No package path may be named root `skills/`, root `agents/`, root `commands/`,
or root `SKILL.md`. No leaf under `plugins/grove/` may be build, release, test,
probe, fixture, coverage, temporary, cache, or dormant review-bookkeeping
implementation. Generated files required by a Git-subdirectory marketplace
remain committed; generation check mode proves them current.

Maintainer commands shall assemble an ephemeral package snapshot from the
allowlisted leaves, then prove that its path set and bytes equal the validated
source package. Release validation and marketplace probes shall operate on
that snapshot, not on the repository root or on an unvalidated subset that
could hide an unexpected package file. Runtime tests may remain source-side
but shall import the modules from the package snapshot or the exact
package-resident paths they exercise.

Snapshot equality shall compare path, file kind, and regular-file bytes. For a
declared symlink it shall compare the literal link target without
dereferencing, recreate the same symlink in the snapshot, and revalidate that
its resolved target remains inside the snapshot and is allowlisted. Replacing
a symlink with its target bytes, or a regular file with a symlink, fails
snapshot fidelity.

### Exact host discovery

The authored role inventory and lifecycle inventory shall determine the
expected host sets. Host-equivalence shall discover every unique role row in
the canonical role inventory; tests shall not carry an independent standing
role count. Each release candidate shall nevertheless declare and assert its
exact expected inventory count, and the first release candidate containing
`implementation-planner` shall prove a bijection between its inventory ids and
this independent first-release oracle:

```text
code-reviewer
conformance-reviewer
contract-author
corpus-reviewer
decision-adversary
dispatcher
divergent-researcher
executor
implementation-planner
propagation-remediator
run-resumer
shaper
spec-adversary
validator
```

The comparison shall reject a missing, extra, duplicate, or renamed id and
shall assert exactly fourteen only after that set comparison passes. Later
releases shall continue to derive completeness from the canonical inventory
and shall carry their own release-declared exact-count evidence; they shall not
reuse this first-release set as a permanent fleet allowlist. The lifecycle
inventory contains exactly `setup`, `refresh`, `set-profile`, and `remove`.
The role inventory shall assign
`shaper` only `driving-session`, `dispatcher` exactly `driving-session` then
`scoped-advisor`, and every other role exactly its approved `cold-native`
exposure. A driving-session exposure has no `native_id`; a `cold-native` or
`scoped-advisor` exposure has exactly one unique `native_id`. The generator
shall reject a cold full-dispatcher or cold shaper exposure.

For a clean installed package:

| Host | Manifest declaration | Exact discovered Grove components | Components that shall not be discovered |
|---|---|---|---|
| Claude | Every generated file under `adapters/claude/agents/` is declared explicitly; the only skill path is `adapters/claude/skills/`. | One native agent for each role-inventory exposure classified `cold-native` or `scoped-advisor`, exactly once, plus the four lifecycle skills. The dispatcher native agent loads only its scoped-advisor fragment; shaper has no native agent. | A cold full dispatcher or shaper; every Codex `role-*` skill; every path under `adapters/codex/`; `runtime/`, `reference/`, and `metadata/` as skills or agents; any undeclared Grove component. |
| Codex | The only skill path is `adapters/codex/skills/`; no plugin agent path is declared. | One lifecycle skill for each lifecycle-inventory entry plus one generated `role-<canonical-id>` skill for every role-inventory row, each exactly once. Setup generates project launchers only for exposures classified `cold-native` or `scoped-advisor`; the dispatcher launcher selects only `scoped-advisor`, and shaper has no launcher. | A cold full dispatcher or shaper; every Claude native-agent envelope; every path under `adapters/claude/`; `runtime/`, `reference/`, and `metadata/` as skills or agents; any plugin custom-agent TOML or undeclared Grove component. |

Host-discovery tests shall derive the expected positive and negative sets from
the authored inventories and manifest declarations, never from the files a
host happened to discover. Each host inventory shall store the exact raw
host-visible identifier, including the one literal namespace prefix declared
by that host's manifest metadata. Tests first compare raw identifiers exactly.
Only after that comparison may cross-host reporting remove exactly one leading
declared prefix; it shall not fold case, rewrite punctuation, translate
hyphens/underscores, remove a second prefix, or otherwise normalize.
Missing, extra, duplicate, wrong-kind, wrong-adapter, wrong-source, or
wrong-digest entries fail the host.

### Driving-session loaders

The generated managed instruction block is the routing trigger and names an
exact generated loader for both `dispatcher` and `shaper`; saying merely that
the driving task “retains” those roles is insufficient.

- **Claude:** the generated `CLAUDE.md` block shall name
  `${CLAUDE_PLUGIN_ROOT}/reference/charters/dispatcher.md` and
  `${CLAUDE_PLUGIN_ROOT}/reference/charters/shaper.md` as plugin-root-relative
  complete projections and direct the current driving task to read the
  selected projection before enacting that role. It shall select the complete
  dispatcher projection, never the scoped-agent fragment.
- **Codex:** the generated `AGENTS.md` block shall name the exact raw installed
  skill ids for the generated `role-dispatcher` and `role-shaper` skills under
  `adapters/codex/skills/` and direct the current driving task to invoke the
  selected skill without delegation. Each skill shall read its corresponding
  complete projection under `reference/charters/`; the dispatcher skill shall
  select the complete driving-session contract unless a generated project
  launcher supplies the exact `scoped-advisor` selector.

These blocks and loaders contain only generated pointers, selectors,
canonical ids, source paths, and digests. They shall not copy a charter body or
become an authored instruction source. A driving-session probe passes only if
the current task follows the declared loader, reports the inventory source and
digest, and spawns no agent. A native dispatcher probe passes only if it
selects the scoped-advisor fragment. No native probe may report
`driving-session`.

Each host shall pass this contract from a clean marketplace install in a fresh
host state in two fixtures outside a source checkout: one cache no more than
two directories below its fixture root and one cache at least eight
directories below its fixture root whose path contains spaces. Neither fixture
may expose a source-checkout fallback. A test that succeeds only when run
inside this repository does not satisfy installed discovery.

## Canonical-source and generation contract

### Source boundary

- Every role-instruction paragraph originates in its corresponding
  `charters/<role>.md`.
- Every companion paragraph originates in `charters/lifecycle.md`,
  `charters/versioning.md`, or `charters/relations.md`.
- Host metadata may name a role, description, tool policy, source path,
  exposure/execution class, portable resource class, output path, and the
  machine-readable local trigger or input-route declaration assigned to that
  role. It shall not contain method, boundary, or workflow instructions copied
  from a charter or a central pipeline ordering.
- Setup/refresh/set-profile/remove semantics have one authored host-neutral source.
  Host-specific skill files contain only host invocation metadata and generated
  projections or pointers to that source.
- Generated output shall never be read as the source for another host's
  output. Both adapters derive from the kernel and host metadata directly.

### Generator behavior

The repository shall expose one documented generation command and a non-writing
check mode.

The generator shall:

1. validate every unique canonical role row in the authored inventory,
   including `implementation-planner`; require `shaper` only as
   driving-session, `dispatcher` only as driving-session plus scoped-advisor,
   every other role only as its declared cold-native exposure, and one unique
   native id per non-driving exposure; and prove an exact bijection to the
   fourteen-id first-release oracle for the first release containing
   `implementation-planner`;
2. reject duplicate role ids, missing charter sources, unexpected authored
   instruction fields, Codex-native ids containing hyphens, and output paths
   outside declared generated roots;
3. produce Claude agent envelopes only for cold-native and scoped-advisor
   exposures under `adapters/claude/agents/`, the
   Claude lifecycle entrypoints under `adapters/claude/skills/`, and shared
   reference projections plus the generated Claude driving-session loader
   pointers;
4. produce the Codex role and lifecycle projections under
   `adapters/codex/skills/`, the generated Codex driving-session skill
   selectors, and setup inputs for bridge-viable thin project launchers only
   for cold-native and scoped-advisor exposures, but no plugin-carried custom
   agents;
5. produce both hosts' lifecycle entrypoints from the shared operation source;
6. mark every projection as generated and record its canonical source path;
7. produce the host inventories and recursive package allowlist from declared
   source/configuration, without learning expected paths from existing output;
8. write outputs in stable path and byte order; and
9. in check mode, exit non-zero and list every stale, missing, or unexpected
   generated output without modifying the working tree.

Generation tests shall change one canonical charter in a fixture and prove
that both affected host projections change, while unrelated role projections
remain byte-identical. A direct edit to either generated projection shall make
check mode fail.

## Pre-execution planning contract

### Canonical role and generated projections

`charters/implementation-planner.md` shall be the single authored normative
source for `implementation-planner`. Its shared artifact frontmatter shall
identify `charter-implementation-planner`, declare the scalar
`implements: adr-0036-pre-execution-planning`, include that ADR in
`depends_on`, and use the ordinary charter lifecycle. The charter shall define
a cold-started, read-only role that:

1. accepts one ratified code-bearing spec and its declared dependency graph,
   the exact repository revision and disclosed working-tree basis, and the
   consumer-owned configuration/addenda needed to locate commands and
   conventions;
2. performs repository reconnaissance and decomposes the accepted criteria
   into a test-first implementation route without changing repository or
   external state;
3. returns the advisory packet grammar below, separating verified repository
   facts from inferences;
4. returns a blocked, non-executable packet when load-bearing ambiguity,
   invalid upstream authority, or an unverifiable basis prevents a trustworthy
   route; and
5. never resolves product intent, writes tests or implementation, edits an
   artifact, becomes a gate, or claims that its packet is authoritative.

The charter shall declare `<TEST_CMD>`, `<TYPECHECK_CMD>`, `<LINT_CMD>`, and
`<CONVENTIONS_PATH>` as repository-locating config tokens and the optional
consumer addendum `.grove/agents/implementation-planner.md`. Like every Grove
role, it shall treat configured values as verified priors: verify present
paths and command declarations without performing a mutating command, surface
stale values as configuration findings, classify a command as unverified when
only execution could establish it, disclose self-detection when absent, and
preserve an explicit `none` without silently substituting another value.

The `implementation-planner` row in `plugins/grove/metadata/roles.json` shall
declare:

- canonical id `implementation-planner`;
- source `charters/implementation-planner.md`;
- one `cold-native` exposure with one unique underscore-form native id;
- portable resource class `reasoning-heavy`;
- its local code-bearing-spec trigger declaration, including
  `inactive-experiment-only` activation and the optional adoption-decision
  reference; and
- the generated reference, Claude-agent, and Codex-skill output paths.

The existing `executor` row shall declare portable resource class
`execution-medium` and its activation-conditional local input-route
requirements. The generator shall
produce the planner's Claude native-agent envelope, Codex role skill, and
frontmatter-free reference projection through the same canonical-source
pipeline as every other cold role. Host metadata or a generated projection
shall not restate, extend, or fork the charter.

`charters/executor.md` shall add `adr-0036-pre-execution-planning` to its
declared upstreams and state the authority, packet verification, explicit
direct-route, stale/conflict, and reviewer-target rules below. Its generated
reference, Claude-agent, and Codex-skill projections shall change from that
canonical edit; adapters shall not patch executor behavior independently.

### Advisory packet grammar

The planner result shall be exactly one canonical UTF-8 JSON byte sequence:
one object, no byte-order mark, no leading/trailing whitespace or newline, no
prefix, suffix, prose, or Markdown fence. Object keys shall be ASCII and sorted
by ascending UTF-8 byte value; arrays preserve semantic order; numbers shall be
base-10 integers; strings shall escape only quote, backslash, and control
characters (control escapes use lowercase `\u00xx`) and emit every other
Unicode scalar as its original UTF-8 without normalization. Parsers shall
reject a duplicate key before materializing the object, every unknown field at every
schema-defined object level, every missing required field, invalid UTF-8, and
any byte outside the single object. The byte boundary relayed verbatim is the
entire cold-role result.

That object shall have `packet_schema: 1`,
`outcome: "executable" | "blocked"`, and exactly these required fields:

| Field | Required content |
|---|---|
| `artifact` | Authoritative artifact id, repository-relative path, lifecycle status, and version or content identity. |
| `repository_basis` | Exact revision plus an explicit clean-tree statement or the disclosed paths/diff identity on which reconnaissance relied. |
| `authority` | The literal semantic marker `advisory — artifact wins`. |
| `criterion_test_map` | Exactly one entry for every EARS invariant and GWT scenario id in the artifact, with a disposition defined below; artifact criteria may not be omitted or excluded. |
| `code_anchors` | Relevant code anchors in the `CA<n>` namespace, each classified `verified` or `inferred` with its file/symbol locator and supporting observation or inference. |
| `test_anchors` | Intended or existing test anchors in the `TA<n>` namespace, each bound to artifact criteria and one verification command. |
| `slices` | An ordered sequence of uniquely identified entries whose criterion references and phase preserve red → green → refactor order. |
| `verification` | Exact commands in the `CMD<n>` namespace for test, typecheck, lint, and other declared verification, including an explicit `none` for a command class not configured. |
| `verification_oracles` | Verify-only oracles in the `OR<n>` namespace, each bound to artifact criteria and one or more verification commands. |
| `risks_and_gaps` | Risks, blockers, non-criterion scope exclusions, and unresolved ambiguities, each with whether it blocks execution. |

The nested shape is closed:

- `artifact` has exactly string keys `id`, `path`, `status`, and `identity`.
- `repository_basis` has exactly string keys `revision`, `worktree_kind`
  (`clean` or `disclosed-dirty`), `worktree_identity` (`clean` or a lowercase
  SHA-256), plus array keys `worktree_manifest` and `assumptions`. A clean
  basis has an empty manifest. Each dirty-manifest entry has exactly `path`,
  `state` (`added`, `modified`, or `deleted`), `kind` (`regular`, `symlink`,
  or `deleted`), `mode`, and `content_identity` (lowercase SHA-256 of current
  bytes or literal `deleted`); entries sort by path. `worktree_identity` is
  the SHA-256 of that manifest's canonical JSON bytes.
- every `criterion_test_map` entry has `criterion_id` and `disposition`, plus
  only its disposition-specific keys: `failing_test_ids` and `slice_ids` for
  `implement`; `oracle_id` for `verify-only`; or `gap_id` for `blocked`.
- every `code_anchors` entry has exactly `code_anchor_id`, `path`, `symbol`,
  `fact_class` (`verified` or `inferred`), and `evidence`.
- every `test_anchors` entry has exactly `test_anchor_id`, `criterion_ids`,
  `path`, `symbol`, `fact_class` (`verified` or `inferred`), `evidence`, and
  `command_id`.
- every `slices` entry has exactly `slice_id`, `criterion_ids`, `phase`
  (`red`, `green`, or `refactor`), `code_anchor_ids`, and `test_anchor_ids`.
- every `verification` entry has exactly `command_id`, `class` (`test`,
  `typecheck`, `lint`, or `other`), and `command`; an unavailable class uses
  the literal prefix `none — ` followed by its configured reason.
- every `verification_oracles` entry has exactly `oracle_id`,
  `criterion_ids`, `command_ids`, `expected_result`, and
  `basis_observation`.
- `risks_and_gaps` has exactly the array keys `risks`, `blockers`,
  `scope_exclusions`, and `ambiguities`; every entry has exactly `id`, `text`,
  and Boolean `blocking`.

All ids and cross-references are case-sensitive strings. Namespace ids shall
match `CA[1-9][0-9]*`, `TA[1-9][0-9]*`, `CMD[1-9][0-9]*`,
`OR[1-9][0-9]*`, or `SL[1-9][0-9]*` for code anchors, test anchors,
commands, oracles, and slices respectively, and shall be unique within their
collection. Set-like arrays (`criterion_test_map`, `code_anchors`,
`test_anchors`, `verification`, and `verification_oracles`) shall sort by
their typed id; `slices` shall retain execution order; `assumptions` and each
risks/gaps array shall sort by id or, for assumption strings, by ascending
UTF-8 byte value.

Each `criterion_test_map` entry shall use exactly one disposition:

- `implement`: names at least one intended failing-test id and one or more
  slice ids, including a red slice before its green slice; or
- `verify-only`: allowed only when no implementation change is proposed for
  that criterion and names one exact verification oracle that supplies its
  command links, expected result, and basis observation; or
- `blocked`: names the load-bearing gap and appears only when packet
  `outcome` is `blocked`.

For an `executable` packet, every artifact criterion shall appear exactly once
as `implement` or `verify-only`, at least one entry shall be `implement`, every
slice criterion reference shall resolve to an `implement` entry, and no
blocking gap may exist. For every `implement` entry, each
`failing_test_ids` value shall resolve exactly once in `test_anchors`, that
test anchor shall include the same criterion id, and its `command_id` shall
resolve exactly once to a non-`none` `verification` entry of class `test`.
Each referenced slice shall include the same criterion id; its typed code/test
anchor ids shall resolve only in their corresponding collections; and its red
slice shall reference at least one of the criterion's failing test anchors.

For every `verify-only` entry, `oracle_id` shall resolve exactly once in
`verification_oracles`, that oracle shall include the same criterion id, and
its nonempty `command_ids` shall each resolve exactly once to a non-`none`
entry in `verification`.
Every test anchor, oracle, slice, and code anchor shall be reached by at least
one criterion/slice reference; every criterion id carried by a test anchor,
oracle, or slice shall point back to a compatible criterion-map entry. A
`verify-only` entry shall not name a slice or failing test.

A `blocked` packet shall still enumerate every artifact criterion exactly
once, contain at least one `blocked` entry, contain no slices, code/test
anchors, verification oracles, or executable test target, and identify the
upstream or repository-basis failure.

`risks_and_gaps.scope_exclusions` may name repository work outside the
artifact only; naming an artifact criterion is invalid. A criterion id
appearing twice, an unreferenced slice, a disposition inconsistent with its
fields or packet outcome, an id in the wrong namespace, an inference labeled
verified, an orphan namespace entry, or any failed/cross-criterion reference
shall make the packet unusable.

The packet is transient working material. It shall not gain artifact
frontmatter, enter `depends_on` or `implements`, become a committed repo file,
or serve as conformance, code-quality, gate-clearance, or release evidence.

### Local routing declarations

The generic dispatcher shall derive planning behavior from the
`implementation-planner` and `executor` rows in `metadata/roles.json`; no
central pipeline branch or dispatcher-owned role list shall encode it.

Before classification, a work-scope collector shall snapshot this closed
source set:

1. the exact dispatch-request bytes; and
2. every task, change-request, issue body, or comment referenced by a stable
   locator in those bytes, at its exact revision/edit identity.

The collector shall not silently add conversation memory or omit a referenced
source. It shall assign sources stable ids `SRC1`, `SRC2`, …: `SRC1` is the
dispatch request and the rest sort by canonical locator then revision. Each
source record has exactly `source_id`, `locator`, `revision`, `byte_length`,
`sha256`, and standard padded `bytes_base64`; decoding shall reproduce the
hashed bytes. A missing, mutable-without-identity, unreadable, or invalid-UTF-8
referent makes collection ambiguous.

For every source, `source_coverage` shall partition byte offsets
`[0, byte_length)` into ordered, non-overlapping, gap-free intervals. Each
interval has exactly `source_id`, `start_byte`, `end_byte`, `disposition`
(`desired-behavior` or `context`), and `reason`. Every desired-behavior
interval points to exactly one stable work item `WB1`, `WB2`, …, assigned by
source order then start byte. Interval boundaries shall fall on UTF-8 scalar
boundaries. A work item has exactly `work_id`, `source_id`,
`start_byte`, `end_byte`, `text_sha256`, and `statement`. Context may cover
formatting or explanatory text only and shall state why it imposes no outcome
or constraint; uncertainty about that judgment makes the collection
ambiguous. Each work item corresponds to exactly one desired-behavior
interval; distinct behaviors shall be split into distinct intervals and
non-adjacent or cross-source text shall remain separate.

`work_scope_identity` is the lowercase SHA-256 of the canonical JSON bytes of
the ordered source records, coverage intervals, and work items, using the
packet serialization rules below. The collector shall record a source-level
coverage summary proving every byte is classified and every
`desired-behavior` interval resolves to exactly one work id. This transient
collection is the route-classification oracle; it is not an implementation
authority, repo artifact, or gate record.

Before selecting a route, the dispatcher shall produce one transient
`route_classification` record with `classification_schema: 1`, artifact and
repository-basis identities, `work_scope_identity`, the complete ordered work
items, requested deliverable/path classes, and the evidence fields below. The
record is routing evidence only: it is neither a repo artifact nor a gate
record.

| Predicate | It is true exactly when the record contains |
|---|---|
| `wrong_decision` | One or more exact work ids plus an exact approved-decision id/clause that contradicts each; disagreement with implementation or a planner inference is insufficient. |
| `spec_gap` | At least one exact work id not entailed by any acceptance criterion in the ratified spec, with the exhaustive criterion search recorded, and no `wrong_decision` evidence for that work id. |
| `adequate_spec` | Every work id in the complete work-scope oracle maps to one or more exact ratified-spec criterion ids, with no uncovered behavior, contradiction, context-classification ambiguity, or unresolved mapping. |
| `reproduced` | A deterministic command or bounded manual procedure, its exact failing observation, and the repository basis on which it repeated. |
| `root_caused` | A causal trace from the reproduced observation to exact implementation file/symbol anchors, with contrary contract-gap evidence ruled out. |
| `localized` | The root-cause trace and proposed regression-test target remain within one declared component/package boundary and require no public interface, schema, cross-component, dispatch, or artifact-contract change. |
| `decision_only_non_code` | The eligible authoritative input is a decision and every work id requests only non-executable prose/metadata with no source, test, build, runtime, or package-behavior change. |
| `code_bearing` | At least one work id requests creation or change of source, tests, build/runtime behavior, package behavior, or other executable behavior governed by a spec. |
| `ambiguous` | Required evidence is absent, mutually inconsistent, stale against the basis, or makes more than one same-precedence terminal class true. |

Classification shall apply this precedence and stop at the first satisfied
row:

| Precedence | Predicate | Required route |
|---:|---|---|
| 1 | `wrong_decision` | Route to shaping; no planner or executor. |
| 2 | `spec_gap` | Amend and reconverge the spec; only then reclassify and plan the corrected ratified spec. |
| 3 | `ambiguous`, or neither `adequate_spec` nor `decision_only_non_code` is proven | Fail closed with the evidence defect; no planner or executor. |
| 4 | `decision_only_non_code` | Direct to executor with the eligible decision; no packet. |
| 5 | `adequate_spec AND reproduced AND root_caused AND localized` | Direct to executor with the ratified spec and failing regression target; no packet. |
| 6 | `adequate_spec AND code_bearing` | Planner-candidate route; the activation contract below decides experiment/planner versus pre-adoption direct executor. This includes non-local slips and forward construction. |
| 7 | Any other combination | Fail closed as unclassified; no planner or executor. |

The record shall retain the truth value and supporting evidence or explicit
missing-evidence reason for every predicate, the selected precedence row, and
the route result. It shall carry exactly one mapping result for every work id:
mapped artifact criterion ids, `wrong_decision`, `spec_gap`, or `ambiguous`.
No work id may be omitted, duplicated, or classified only as context after
collection. A changed source, work-scope identity, artifact, or repository
basis invalidates the record. The classifier shall not use token count, line
count, task size, model tier, or ad-hoc complexity.

A `gated` spec without the active agent-owned gate's posted independent
convergence record is not ratified: classification shall fail before planner
or executor dispatch and wait for `approved` or that record. A packet is never
ratification.

### Experiment availability and production activation

The first release containing `implementation-planner` shall ship its canonical
role, generated projections, local planner/executor declarations, resource
resolution, and experiment harness with the optimized production route marked
`inactive-experiment-only`. The experiment harness may explicitly invoke the
planner route for arm C after validating the same local declarations; an
ordinary dispatcher shall continue the pre-adoption direct spec → executor
route and shall not invoke the planner or require a packet merely because the
declarations are installed. The planner declaration's trigger and the
executor declaration's packet requirement shall therefore be conditional on
either `experiment-arm-c` or an active adoption reference; they remain local
role declarations rather than a dispatcher-owned branch.

Before activation, `execution-medium` is available to experiment arm B and the
`reasoning-heavy` / `execution-medium` pair to arm C, but neither shall
downgrade the ordinary direct executor: ordinary dispatch retains the
fixture-proven premium/no-planner baseline-A selection. After activation, the
optimized planner route resolves the declared class pair. This availability
rule does not change the canonical class values stored on the role rows.

Production activation requires both a completed valid twenty-seven-run result
that passes the A and B conditions and a later approved decision recording the
maintainer's adoption intent for the exact evidence identity and release
candidate. The activation flag shall reference that decision. Missing,
draft, mismatched, or evidence-only activation input shall leave the route
inactive. Installing the first release, passing the nine-run screen, or
passing support/resource probes shall not activate production planning.

### Relay, executor authority, checkpoint, and replan

On the ordinary route, the cold planner shall return one bounded packet to the
driving-session dispatcher. The dispatcher shall validate it, compute the
lowercase SHA-256 of the exact packet bytes, and pass those same bytes
verbatim, alongside the authoritative artifact pointer, into a separately cold
executor invocation. The ordinary relay shall perform no repo, tracker, or
other external write and shall not require or create a task/change-request.

The executor shall independently reopen the ratified artifact and declared
dependency graph, verify the packet's artifact identity, repository basis,
criterion coverage, typed code/test anchors, verification oracles, and
commands, and then apply strict red → green → refactor from the artifact. The
artifact wins every conflict. A stale
repository basis, contradictory packet requirement, invalid or unverifiable
anchor, softened/extended criterion, or unusable packet shall be surfaced
before executor mutation and may trigger at most one automatic replan when the
same artifact and repository basis remain reproducible. Ordinary dispatch
therefore permits at most two planner invocations total: the initial attempt
and one replan. A second unusable result, a changed/unreproducible basis, or an
unresolved blocking gap is terminal: the dispatcher shall emit a planning
failure with both attempt findings, dispatch no executor, and return control
for human/shaping resolution. The packet shall never be silently repaired or
treated as executor authority. Reviewers shall judge code against the artifact
and code-quality contract, never against packet adherence.

If dispatched work already has an identifiable task/change-request and the
existing checkpoint/resume seam fires, its carrier may contain one canonical
UTF-8 JSON checkpoint envelope and no rewritten/reduced plan. The envelope has
the packet grammar's serialization, duplicate-key, unknown-field, and
trailing-byte rules, `checkpoint_schema: 1`, and exactly:

- the original `artifact` and `repository_basis` objects;
- `packet_sha256` and standard padded `packet_base64` encoding the exact
  original packet bytes;
- `checkpoint_basis`, using the same basis-object grammar for executor state
  at checkpoint time;
- `completed_slice_ids`, `remaining_slice_ids`,
  `verified_criterion_ids`, and `pending_verify_only_criterion_ids`; and
- `completion_evidence`, with exactly one evidence entry for every completed
  slice and verified criterion.

`packet_base64` shall use the standard alphabet with required `=` padding and
no whitespace. Decoding it shall reproduce bytes matching `packet_sha256` and
the original executable packet. Completed slice ids shall be one exact prefix
of the packet's ordered slices and remaining ids its exact suffix, with no
duplicate, omission, insertion, or reorder. Verified and pending verify-only
ids shall be a disjoint exhaustive partition of the packet's verify-only
criterion ids. Each completion-evidence entry shall reference one member of
those completed/verified sets and have exactly `subject_kind` (`slice` or
`criterion`), `subject_id`, and `evidence`, recording its command or
observation result at `checkpoint_basis`. Completed/remaining ids retain
packet order, verify-only partitions sort by criterion id, and completion
evidence sorts by `(subject_kind, subject_id)`.

The artifact identity, original basis identity, packet digest, and progress
partitions together are the checkpoint identity. A mismatch, invalid envelope,
non-prefix “remainder,” stale checkpoint basis, or changed packet shall refuse
resume and dispatch no executor; it shall not synthesize a second packet from
the remainder. The planning route shall not create a carrier merely to gain
recovery.

If no carrier exists and relay is lost before executor dispatch, the
dispatcher may use the one ordinary automatic replan against the unchanged
authoritative artifact and repository basis. If that basis is no longer
reproducible or the replan fails, planning shall terminate with no executor
rather than reuse hidden session state or stale bytes. The experiment's D19
shared remediation budget governs experimental planner retries separately and
does not enlarge this ordinary-path cap.

## Portable resource-resolution contract

Portable resource intent shall live only on role rows in
`plugins/grove/metadata/roles.json`: `implementation-planner` is
`reasoning-heavy`, and `executor` is `execution-medium`. The executor class is
route-bound intent for the optimized planner route and experiment arms B/C;
it is not a claim that every executor invocation is medium. Canonical charters
and generated role projections shall not pin provider-specific model names.

`plugins/grove/metadata/hosts.json` shall carry a schema version and a
versioned default mapping for every supported host from each referenced
resource class to one exact host-valid model selector. For every host/surface
that claims a class, it shall also name `selector_capability_source` as the
exact versioned host-runtime model catalog or provider model catalog
authoritative for that selector, and `selector_capability_probe` as the exact
read-only command/API operation plus response field that proves the selector
exists and the surface may invoke it. `hosts.json`, consumer configuration,
documentation, and prior evidence declare intent but are not themselves
capability sources.

For each supported host/surface, `hosts.json` shall also record
`pre_adoption_direct_executor` with the exact selector and selection-source
identity observed before the planner change. Release validation shall compare
that record with a clean pre-change fixture and its capability probe; mismatch
fails the candidate rather than redefining the baseline. This record preserves
inactive production behavior and is not a third portable resource class.

Resource binding is exhaustive:

| Context | Executor binding | Planner binding |
|---|---|---|
| Ordinary production while activation is inactive | Exact `pre_adoption_direct_executor`; the new class map and consumer resource overrides do not apply. | None. |
| Experiment arm A | Exact preregistered premium selector, which shall equal the recorded pre-adoption selector and pass its source/probe at run time; it is not resolved through `execution-medium`. | None. |
| Experiment arm B | Effective active-host `execution-medium` class mapping. | None. |
| Experiment arm C | Effective active-host `execution-medium` class mapping. | Effective active-host `reasoning-heavy` class mapping. |
| Ordinary production after approved activation | Effective active-host `execution-medium` class mapping. | Effective active-host `reasoning-heavy` class mapping. |

A consumer may replace a default only through an exact key in its
consumer-authoritative
`.grove/config.toml` table:

```toml
[resources.<host>]
reasoning-heavy = "<host model selector>"
execution-medium = "<host model selector>"
```

These overrides participate only in the class-bound rows of the context table;
they shall not alter `pre_adoption_direct_executor` or arm A's exact pin.

For an experiment B/C or activated-production class-bound dispatch, resolution
shall:

1. select only the active host's default map;
2. replace a class only when `[resources.<active-host>]` supplies that exact
   class;
3. execute the declared capability probe against its exact authoritative
   source and validate that the selected model exists and is permitted for
   that host and surface;
4. reject an absent, inaccessible, stale-version, unauthenticated,
   unparseable, or contradictory source/probe result as unavailable
   validation;
5. reject missing required classes, unknown host or class keys, unknown or
   unsupported selectors, ambiguous duplicates, and any attempt to fall back
   to another host; and
6. return and record the complete effective class-to-model map, context,
   source
   identity/version, probe identity, response-field evidence, and probe time
   before the first role dispatch.

For experiment arm A, the harness shall bypass class resolution, pin the exact
premium selector in preregistration, and execute the same authoritative
capability-source/probe validation directly against that selector. It shall
fail the matched block if the selector differs from
`pre_adoption_direct_executor`, is not preregistered as premium, or cannot be
validated. Inactive ordinary production shall continue its recorded direct
selection and shall not consult `execution-medium`; the candidate's release
evidence, not a new runtime routing dependency, proves that selection was
preserved.

A surface that cannot honor a class shall explicitly reject the optimized
route before dispatch. It shall not silently substitute a model or claim
planner-route support. Support evidence and every experimental run shall
record the binding context, the pre-adoption/arm-A exact selector or effective
class map as applicable, defaults version, overrides used, and exact concrete
model ids plus the capability-source/probe evidence. The Grove-managed
`.grove/README.md` shall document the valid
host/class keys, precedence, and failure behavior, but setup and refresh shall
not create or change a consumer's optional resource overrides.

## Planning experiment and evidence

The experiment harness shall require a caller-supplied evidence root outside
the source repository and shall refuse an evidence destination within the
repository tree. It shall make no source-tree change. Before any run, one
retained preregistration shall record:

- three ratified code-bearing specs and exact repository revisions, one each
  in predeclared small, medium, and large strata;
- one replacement task per stratum for an independently established invalid
  upstream;
- all required test/typecheck commands and review procedures;
- the recorded pre-adoption direct-executor selector and fixture proof; arm
  A's exact equal premium selector; B/C's effective host/resource maps; every
  binding's capability-source/probe result; and exact planner, executor, and
  reviewer model ids;
- a dated provider-price snapshot and normalization table that maps each
  provider-reported input, output, cached, reasoning, and other billed token
  field to one disjoint billable leaf bucket and one rate for each model;
- randomized execution order; and
- the two-remediation bound, futility rule, acceptance rule, metrics, and
  adoption truth tables below.

For each task/revision cell, the harness shall run these three arms cold and in
the preregistered randomized order from fresh isolated repository fixtures
with identical ratified input and repository/working-tree basis:

| Arm | Base sequence |
|---|---|
| A — current baseline | Exact preregistered, capability-validated premium selector equal to `pre_adoption_direct_executor`; no planner and no executor-class lookup. |
| B — downgrade control | Executor resolved through active-host `execution-medium`; no planner. |
| C — planner treatment | Planner resolved through `reasoning-heavy`, followed by a separately cold executor resolved through `execution-medium`. |

Phase one shall complete each of the nine cells in a three-valid-task ×
three-arm matched block once, for exactly nine valid cold analysis runs. Raw
attempts later invalidated as upstream-invalid do not count toward nine. The
harness shall evaluate futility only after one complete valid matched block
exists for all three strata and arms, and shall stop when either:

1. C is unaccepted on at least two tasks for which matched A is accepted; or
2. none of the three matched tasks has C use fewer premium-model tokens than A
   or incur lower total weighted model-call cost than A.

Every other phase-one result shall add exactly two valid repetitions of every
task/arm cell, yielding exactly twenty-seven valid analysis runs and nine
valid runs per arm. Raw attempt count may be higher only because retained
invalidated attempts were replaced symmetrically. Passing phase one shall
never authorize adoption.

One run starts at its arm's first model invocation and ends on acceptance,
shared-remediation-budget exhaustion, or terminal failure. In addition to its
base sequence, every arm may use at most two remediation dispatches total,
each classified exactly once:

| Classification | Meaning |
|---|---|
| `planner retry` | Repeats a failed or unusable planner before execution; available only while the shared budget remains. |
| `executor retry` | Repeats execution after failure or unusable output before independent review. |
| `reviewer-return loop` | One blocking independent-review result followed by one fresh executor remediation dispatch. |

Exhausting the shared budget without an executable plan or accepted
implementation makes the run unaccepted. Every call still counts toward
tokens, cost, remediation, and elapsed time.

A run has exactly one accepted-quality result if and only if, within that
bound, all declared required test and typecheck commands pass, conformance
returns `PASS`, and the terminal required code-review pass reports no blocking
finding. Otherwise it has zero. A blocking-finding run is counted once when
any independent code-review pass reports at least one blocking finding,
irrespective of finding count or later remediation.

For every model call, the harness shall retain the provider's raw input,
output, cached, reasoning, and total fields; role; arm; task; attempt; elapsed
time; model id/tier; dated price identity; and a normalized
`billable_buckets` list of `(bucket, count, rate)`. The preregistered
normalization shall form a partition: one billed token may contribute to
exactly one leaf bucket. An overlapping provider total is informational only.
When reasoning or cached counts are provider-documented subsets of another
field, the normalization shall subtract them into disjoint leaf operands; an
undocumented overlap, negative residual, missing priced bucket, or inability
to form the partition invalidates that run's measurement. A
measurement-invalid run makes the experiment ineligible for adoption until
the preregistration and complete matched block are rerun with valid
instrumentation; it is not an upstream-invalid task and shall not be
selectively omitted or replaced.

`premium_tokens` shall equal the sum of all disjoint billable-bucket counts
from calls whose exact model id is preregistered as premium, across planner,
executor, reviewer, and remediation roles. `total_tokens` is informational and
shall equal the sum of disjoint bucket counts across all calls; any raw
provider `total` shall be retained separately and shall not be added again or
used as a cost operand.

Weighted run cost shall sum `count * rate` once for every disjoint bucket in
every triggered planner, executor, reviewer, and remediation call, using the
dated model-specific price snapshot and distinct cached-token rate where
published. The harness shall also retain per-run and per-arm premium tokens,
informational total tokens, weighted cost, test/typecheck outcomes,
conformance and code-review findings, blocking-finding incidence, all three
remediation counts, invalid packet anchors, executor deviations and reasons,
unused plan steps, and ambiguities caught before implementation. For each arm,
`cost_per_acceptance = total_weighted_cost / accepted_quality_count`; zero
acceptances yields positive infinity.

If independent review establishes that a ratified upstream is itself invalid,
the harness shall mark every attempt for that task/stratum across all three
arms `invalidated-upstream`, retain any packets plus findings, tokens,
weighted cost, remediation, and elapsed time in a separate
audit/invalidation-overhead ledger, and exclude those cells from futility, arm
metrics, exact valid-run counts, and adoption arithmetic. Gross experiment
spend shall report that overhead separately and shall not add it to analyzed
arm cost.

The harness shall then use the preregistered same-stratum replacement and run
every required arm/repetition cell for it. It shall not exclude the task from
only one arm or classify a planner-indicted upstream as invalid without that
independent finding. An invalidation before or after a preliminary screen
voids that screen; futility shall be recomputed only after the complete valid
replacement block exists. Phase two likewise reaches twenty-seven only from
three complete valid task × arm × repetition blocks.

After twenty-seven valid analysis runs, C passes the baseline-A floor only
when all four conditions are true across nine valid runs per arm:

- `C_accepted >= A_accepted - 1`;
- `C_blocking_finding_runs <= A_blocking_finding_runs`;
- `C_premium_tokens <= 0.70 * A_premium_tokens`; and
- the A/C cost condition in this truth table is true.

| `A_cost` | `C_cost` | A/C cost condition |
|---|---|---|
| finite and positive | finite and `C_cost <= 0.80 * A_cost` | true |
| positive infinity | finite | true |
| finite and positive | positive infinity or above the 20% reduction threshold | false |
| positive infinity | positive infinity | false |
| zero | any value | false |

Treatment C passes the medium-only-B advantage only under this truth table:

| Accepted-quality relation | B remediation | Required result |
|---|---:|---|
| `C_accepted >= B_accepted + 1` | any | true |
| `C_accepted = B_accepted` | `> 0` | true only when `(B_remediation - C_remediation) / B_remediation >= 0.20` |
| `C_accepted = B_accepted` | `0` | false, including zero/zero |
| `C_accepted < B_accepted` | any | false |

The optimized production route may be proposed for adoption only when the
full experiment comprising twenty-seven valid analysis runs passes both the
baseline-A floor and the medium-only-B advantage. The evidence shall remain
out of tree and shall not change a surface support row, resource default,
gate, or production route by itself.

Adding `implementation-planner`, its resource declarations, or its generated
outputs invalidates prior release-candidate fleet evidence. Generation,
package snapshots, exact host discovery, driving/cold exposure checks,
resource resolution, supported-surface records, and both marketplace channel
smokes shall be rerun from the changed candidate. Each host shall discover the
inventory-derived set exactly, and the first such candidate shall prove
bijection to the fourteen-id first-release oracle. The release change shall
separately judge and human-ratify the semantic version bump; this spec does
not choose it.

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

An absent, malformed, multiply selected, unknown, contradictory, or
host-mismatched surface id is invalid input: the operation lists the valid ids
for that host and changes no repository path. Setup and refresh may emit Codex
launchers only when the selected row is classified `supported` and declares
the bridge load path. Selecting
`codex-exec-ephemeral`, `codex-desktop-local`, `codex-cloud-web`,
`codex-ide`, or `codex-sdk` while its current row is unsupported therefore
produces the row's unsupported
disclosure and the per-operation valid-unsupported behavior. A future runtime
detector or newly supported row changes the matrix/adapter metadata and its
tests, not this precedence rule.

Bridge viability proves only that this pointer/load primitive works. A surface
may be marked `supported` only after a fresh release candidate additionally
passes the full support record:

- host and surface id;
- Grove version and Codex build/version;
- clean-environment setup used;
- exact plugin install/load path;
- launcher form under test;
- every role identity derived from the canonical inventory, the release's
  exact expected count, and each identity's expected execution class; the
  first support record containing `implementation-planner` shall prove
  bijection to the fourteen-id oracle;
- the exact fixture-proven `pre_adoption_direct_executor`, arm-A premium
  selector equality where the surface is experiment-capable, host-defaults
  version, any consumer overrides, B/C effective resource maps, exact concrete
  model ids, and every capability-source/probe result, or explicit evidence
  that the optimized route is rejected before dispatch;
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

The support fixture shall derive the future expected set and count from the
canonical role inventory, not from generated host files. For the first
candidate containing `implementation-planner`, it shall additionally prove
that the inventory is bijective with the independent fourteen-id oracle. It
shall fail for a missing,
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
- expose only the host-appropriate adapter paths declared in the exact
  host-discovery table;
- carry a `version` exactly equal to the trimmed contents of
  `plugins/grove/VERSION`; and
- describe only capabilities supported by the surface matrix.

The Claude manifest shall enumerate each generated Claude agent file and shall
declare `adapters/claude/skills/` as its sole skill root. The Codex manifest
shall declare `adapters/codex/skills/` as its sole skill root and no agent
root. Neither manifest shall expose the other host's adapter or make
`runtime/`, `reference/`, or `metadata/` a discovery root. Physical receipt of
both adapter trees through the single package does not authorize either host
to load the other tree.

The Codex manifest alone shall not be treated as proof that native roles load.
It supplies no custom agents. The Codex package is valid only when the
project-launcher bridge evidence and surface claims also validate.

The Claude install contract remains the existing marketplace install followed
by Grove setup. The Codex install contract is marketplace registration,
plugin installation, a fresh session, and Grove setup. Neither manifest nor
marketplace entry contains charter or lifecycle-operation prose.

## Gate runtime contract

Gate-profile resolution semantics remain unchanged. At every gate and
handover, the active host adapter shall invoke one resolver, re-read the
consumer's current profile, validate the human-intent floor, and fail loudly
to the guardian posture on missing or invalid input.

Runtime selection is deterministic:

1. When `runtime_dir` is absent, the adapter shall resolve
   `runtime/gates/` relative to its own installed Grove package root and invoke
   that resolver in place.
2. When `runtime_dir` is present and its repository-relative normalized target
   is not `.grove/internal/gates`, the adapter shall invoke exactly that
   consumer-declared directory. It shall not search, copy, substitute, or fall
   back to the package runtime.
3. When `runtime_dir` targets `.grove/internal/gates`, the adapter shall treat
   it as an explicit legacy override until the consumer confirms migration. It
   shall not silently reinterpret absence or failure at that path as permission
   to use the package runtime.

Each adapter shall derive its installed package root at invocation time. It
shall not write an absolute plugin-cache path into `.grove/`, either
instruction file, a Codex launcher, or any other consumer file. Both hosts
shall prove default resolution from a clean installed cache at arbitrary
directory depth and at a path containing spaces; executing the resolver from a
source checkout does not satisfy this contract.

Fixed enforcement data may remain under the package `reference/` allowlist,
but lifecycle operations shall not copy it into `.grove/`. Documentation,
metadata, manifests, and release claims shall not call that data active
enforcement unless a package-resident executable reader is declared and tested.

## Shared setup, refresh, set-profile, and remove contract

The four consumer operations shall share one semantic implementation and
take the active host and surface invocation record as adapter parameters. Host
adapters may vary only in
manifest lookup, instruction-file target, marker text, launcher destination,
and host-facing command names. Per
`adr-0032-status-emission-belongs-to-wisp`, status emission is absent from the
shared lifecycle: setup does not compose it, refresh does not maintain it, and
remove recognizes only a legacy Grove-installed adapter for confirmed cleanup.

The standard consumer contract contains only:

```text
.grove/
  README.md
  gates.toml
  config.toml
  agents/
```

`gates.toml`, `config.toml`, and any `agents/<role>.md` are
consumer-authoritative. `README.md` is Grove-managed and shall explain the
dials without containing executable behavior. An empty `agents/` directory
need not be materialized. No lifecycle operation shall create
`.grove/internal/` during a new setup or as a runtime destination.

### Repository stamp contract

Stamp metadata has `schema_version: 1` and declares exactly two possible
carriers:

| Host | Carrier | Owned region |
|---|---|---|
| Claude | `CLAUDE.md` | The one valid Claude Grove marker-bounded block. |
| Codex | `AGENTS.md` | The one valid Codex Grove marker-bounded block. |

Each host adapter metadata record shall declare its exact begin and end marker
strings. A valid carrier contains exactly one ordered, non-nested pair of those
markers and exactly one whole line matching
`grove plugin@(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)` between
them, with no leading or trailing whitespace. The single stamp template is
`grove plugin@${VERSION}`, shared by both generated host-block templates; no
other stamp template is authoritative. The generated block template owns that
stamp line. A matching line outside the owned block is consumer text, not a
carrier; `.grove/README.md`, Codex launchers, and other generated files are not
repository-stamp carriers.

An existing candidate carrier is malformed when its Grove markers are
unpaired, duplicated, reversed, or nested, or when its valid block has a
missing, duplicate, or schema-invalid stamp line. Setup, refresh, and
set-profile shall inventory both carrier paths and fail before every write if
either existing candidate is malformed. Remove may inventory and offer
confirmed deletion of a malformed owned block or carrier file under its normal
ownership rules, but shall not rewrite it or use its value for skew.

`plugins/grove/VERSION` is authoritative for the running operation. Valid
repository stamps are observations only: neither host has precedence over the
other and no stamp overrides the installed version. Before any write, every
operation shall report each valid carrier path/value, the installed value, and
for each mismatch whether the installation is ahead or behind. Disagreement
between two valid carriers is reported per carrier and never resolved by
choosing one. No carriers present means `unstamped`, not malformed.

Stamp update ownership is exact:

| Operation | Stamp behavior |
|---|---|
| Setup | May create or replace only the invoking host's stamp as part of its confirmed valid managed-block write; the value is the installed version. |
| Refresh | May replace only the invoking host's stamp, and only in the final managed-block write after all planned generation and ownership checks succeed; failure leaves its old stamp unchanged. |
| Set-profile | Never creates, changes, or removes a stamp. |
| Remove | May delete a stamp only by confirmed deletion of its containing managed block or carrier file; it never rewrites a retained stamp. |

No operation may update a stamp merely to hide skew, and no update to one
host's stamp permits changing the other host's block.

### Surface classification and write permissions

Every operation shall classify the invocation record before stamp or
repository writes as exactly one of: host-matched `supported`,
host-matched `valid-unsupported`, or `invalid`. “Supported” means the selected
matrix row's release state is `supported`; bridge viability alone does not
qualify. The permitted mutations are:

| Operation | Supported | Valid-unsupported | Invalid |
|---|---|---|---|
| Setup | The bounded Setup writes below, including Codex launchers only for their declared native exposures. | Report the row and missing capability; create, update, or delete no repository path. | Report valid ids and the input defect; create, update, or delete no repository path. |
| Refresh | The bounded Refresh writes and confirmation-bound legacy migration below. | Report the row and missing capability; create, update, or delete no repository path, including stamps and legacy state. | Report valid ids and the input defect; create, update, or delete no repository path. |
| Set-profile | After its ordinary diff and confirmation, only `.grove/gates.toml`. | Report the row and missing capability; do not write `.grove/gates.toml` or any other path. | Report valid ids and the input defect; create, update, or delete no repository path. |
| Remove | Only the inventory-derived, individually confirmed deletions allowed by Remove; no creation, replacement, or stamp rewrite. | The same confirmation-bound deletions, so a user can remove Grove from an unsupported surface; no creation, replacement, or stamp rewrite. | Report valid ids and the input defect; create, update, or delete no repository path. |

Read-only inventory and disclosure are permitted in every class. An operation
shall not perform an allowed write from one row and then fail on a disallowed
write from another; classification precedes the complete mutation plan.

### Setup

Setup shall:

- compose the shared `.grove/` consumer contract exactly once;
- preserve existing consumer-authoritative `.grove/config.toml`,
  `.grove/gates.toml`, and `.grove/agents/` content unless the user explicitly
  approves a documented overwrite;
- generate only `.grove/README.md` as Grove-managed floor content and install
  no executable, fixed enforcement data, charter, or companion beneath
  `.grove/`;
- create or update only the invoking host's marker-bounded block:
  `CLAUDE.md` for Claude and `AGENTS.md` for Codex;
- validate the surface invocation record before the first write and report its
  selected id and provenance;
- on Codex, compose only the spike-approved generated launcher files and
  refuse to overwrite a same-path consumer file that lacks Grove's generated
  ownership marker;
- compose no status-emission charter, skill, or adapter on either host;
- copy no charter or companion prose into the consumer repository;
- create no `.grove/internal/` path, regardless of host or selected surface;
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

- regenerate only the Grove-managed dial explainer under `.grove/` from the
  installed package;
- preserve all consumer-authoritative `.grove/` files and addenda;
- update the invoking host's managed block and generated launchers;
- never create the other host's adapter if that adapter is absent;
- preserve an existing other-host adapter byte-for-byte;
- never install or refresh a status-emission adapter, and report a detected
  legacy Grove-installed copy as removable legacy state;
- inventory legacy internal state before proposing any cleanup, using the
  migration contract below;
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

Remove shall first inventory the shared floor, legacy internal state, and both
host adapter surfaces, then ask before deleting any file. It shall remove only confirmed
Grove-owned files or exact marker-bounded blocks. Consumer-authored launcher
collisions, addenda, config, gates, and non-Grove instruction text shall be
preserved unless individually confirmed.

If one host adapter is retained, remove shall retain the shared `.grove/`
floor. The shared floor may be removed only when no retained host adapter
depends on it and the user confirms its removal. Removing repository files
shall not claim to uninstall either host plugin. A legacy Grove-installed
status adapter may be removed only through the same inventory and confirmation
path; remove shall not claim to change Wisp.

### Legacy `.grove/internal/` migration

Refresh and remove shall recognize only these legacy Grove-managed candidates:

- `.grove/internal/gates/`; and
- `.grove/internal/enforcement.toml`.

The package shall carry a generated legacy ownership inventory with
`schema_version: 1`. It contains one immutable record for every
`(grove_version, candidate_path)` pair installed by a released Grove version.
Each record declares `grove_version`, candidate repository-relative path,
candidate kind
(`regular-file` or `tree`), and, for every regular-file leaf, its exact
repository-relative path and SHA-256 of its installed bytes. A tree record is a
complete leaf set, not a glob. Release validation shall reject duplicate
composite `(grove_version, candidate_path)` keys, non-canonical paths,
non-SHA-256 digests, symlink entries, and omission or mutation of any
previously published record. The initial
inventory shall cover every released upgrade fixture that contains either
legacy candidate; subsequent records are append-only.

Before offering deletion, the operation shall apply this proof algorithm:

1. `lstat` `.grove/internal/` and recursively enumerate its entries in sorted
   repository-relative path order without following symlinks.
2. Reject path traversal and classify every entry by file kind. A symlink,
   special file, unreadable file, or path outside the two known candidates is
   `unprovable`.
3. Hash the bytes of each regular-file leaf. A leaf is
   `ownership-proven(version-set)` only when its exact path and digest match
   the same leaf in one or more valid inventory records; a generated marker,
   filename, repository stamp, or directory location alone is not proof.
4. A known tree is `ownership-proven(version-set)` only when all descendants
   are regular files and the complete descendant path/digest map equals one
   version record's complete tree map. Its version set is the set of exact
   matching records. A mixed-version or extra-leaf tree is not proven as a
   tree, although individually matching regular-file leaves retain their own
   leaf proof.
5. Report, for each candidate and leaf, its kind, digest where readable,
   proof state, matching inventory versions, and whether any valid repository
   stamp names one of those versions. Stamp agreement is corroboration only;
   byte/path proof is mandatory and exact byte/path proof may stand when a
   stamp is absent or skewed.

A missing, malformed, or incomplete legacy inventory proves nothing. Any
unexpected or unprovable path shall be reported individually and shall block
whole-tree deletion. The operation may still offer separately confirmed
deletion of each ownership-proven regular-file leaf; it shall preserve every
unconfirmed, unexpected, or unprovable path and shall not remove a non-empty
parent directory. Directory deletion is allowed only after its complete tree
was proven, every leaf deletion was confirmed, and the directory is empty at
mutation time.

When `runtime_dir` is absent, refresh may offer deletion of ownership-proven
legacy files because the invoking adapter resolves the package runtime. Before
any confirmed deletion it shall report that existing Grove sessions may still
be executing the legacy copy and require acknowledgement that those sessions
must be restarted. Declining either cleanup or the restart acknowledgement
leaves the legacy files unchanged and does not prevent ordinary refresh of
unrelated managed surfaces.

When normalized `runtime_dir` targets `.grove/internal/gates`, refresh shall
first offer a separate, explicit config migration that removes that override
so future handovers select the active plugin runtime. Declining the config
migration preserves both the declared value and its target and permits no
target deletion. Confirming the config migration does not itself delete the
target: deletion additionally requires the completed legacy inventory,
restart acknowledgement, and its own confirmation.

Any other explicit `runtime_dir` is outside legacy cleanup. Refresh, remove,
setup, and set-profile shall preserve its value and target unless the consumer
separately and explicitly confirms their change or removal under the ordinary
consumer-authority rules. A missing or invalid explicit target fails loudly
under the runtime-selection contract; it is never repaired by searching for
or substituting the package runtime.

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
2. validate the exact physical package tree against the recursive allowlist
   and assemble the byte-identical ephemeral package snapshot;
3. validate both manifests from that snapshot;
4. validate exact version equality across all declared carriers;
5. validate that the surface matrix has no unclassified or pending row;
6. run package-level installation and exact host-discovery smoke tests from
   the snapshot for every
   supported automatable surface;
7. derive the canonical role count from `metadata/roles.json`, assert the
   candidate's declared expected count, and prove exact bijection to the
   fourteen-id oracle for the first candidate containing
   `implementation-planner`;
8. fixture-prove each claimed-supported surface's pre-adoption direct selector,
   capability-validate the exact arm-A premium pin on each
   experiment-capable surface, resolve B/C's required resource classes through
   their authoritative source/probes, and retain all context bindings and
   effective maps;
9. verify the first planner-bearing candidate marks ordinary production
   planning `inactive-experiment-only`, unless a later approved adoption
   decision bound to completed valid evidence explicitly activates it;
10. verify that unsupported rows are disclosed in generated install
   documentation;
11. resolve the intended release commit as the workflow event commit for the
    merged version-authority change; and
12. create the tag only if it does not already exist; if it exists, peel it to
   a commit and no-op only when that commit equals the intended release commit,
   otherwise fail and report both commit ids without moving or replacing the
   tag.

The workflow is deterministic and idempotent. It does not choose the semantic
version level, publish a GitHub Release, merge a change, or revive the retired
review-bookkeeping gate. Relocating its validator source outside
`plugins/grove/` does not change those semantics. The maintainer's merge of the
version-bump change is the human release act.

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
  setup, and execute the exact positive and negative host-discovery checks for
  that surface.
- A marketplace is a catalog only. It shall not contain copied charters,
  companions, lifecycle-operation instructions, or an independently versioned
  Grove method.

## Surface matrix

The matrix shall contain at least these rows:

| Surface id | Current bridge state | Current release state |
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
- A missing, extra, duplicate, case-colliding, escaping, broken, or
  kind-mismatched package path is a package failure; snapshot, probe, and
  release steps shall not proceed from it.
- Any host discovery result outside that host's exact positive inventory, or
  any absent expected result, is a host-support failure.
- A manifest/version mismatch is a release failure.
- A marketplace entry that resolves a different version is a publication
  failure.
- A missing bridge or full-support record for a claimed Codex surface is a
  Codex release failure.
- A missing or invalid surface invocation record is a pre-write lifecycle
  failure.
- A valid-unsupported surface is not invalid input; it follows the exact
  no-write or Remove-only cell and shall not be promoted by bridge viability.
- A role-discovery failure on a claimed-supported surface is a surface failure
  and removes that support claim until reverified.
- A Grove entrypoint on an unsupported surface shall state that Grove roles
  are unavailable there and shall not silently continue under generic-agent
  identities.
- A lifecycle operation that cannot prove ownership of a target file shall
  leave it untouched and report the collision.
- A default package runtime that cannot be resolved from the active installed
  adapter, or an explicit `runtime_dir` that cannot be invoked, is a handover
  failure; the adapter shall not search for another resolver.
- Unexpected or symlinked legacy internal content is a migration refusal for
  whole-tree deletion, not permission to delete around or follow it.
- A missing, malformed, or non-matching legacy ownership inventory leaves the
  affected content unprovable and preserved.
- A malformed candidate repository-stamp carrier blocks setup, refresh, and
  set-profile writes; it is never repaired by taking the other host's stamp as
  precedent.
- An existing `grove-v<VERSION>` tag that does not peel to the intended
  release commit is a release conflict; automation shall not move it.
- A missing, malformed, blocked, stale, contradictory, extending, softening,
  or unverifiable advisory packet is a planned-route failure; it shall not be
  silently repaired or treated as artifact authority.
- A missing work-scope source/range/work id, or a packet test/oracle reference
  that is absent, duplicated, orphaned, wrong-namespace, or
  cross-criterion, is a pre-relay failure.
- An ambiguous, stale, incomplete, or unclassified route record is a
  pre-dispatch failure; its precedence/evidence defect shall be reported and
  no planner or executor shall run.
- An inactive or unratified production-planning activation is not support for
  ordinary planner routing; only the experiment harness may exercise the
  experiment-only declaration.
- A second unusable ordinary planner result, changed basis, invalid checkpoint
  identity, or non-prefix remainder is terminal with no executor dispatch.
- A missing resource class, unknown or unsupported selector, or cross-host
  fallback, unavailable authoritative capability source, or failed selector
  probe is a pre-dispatch failure; no concrete model shall be silently
  substituted.
- A pre-adoption fixture mismatch or arm-A selector that is unpinned,
  non-premium, unequal to the recorded baseline, or capability-unverified
  invalidates release/experiment evidence; it shall not be resolved through
  `execution-medium` or change inactive production selection.
- In-tree experiment evidence is invalid; a nine-run result cannot authorize
  adoption; invalidated task attempts remain audit overhead but not valid
  analysis cells; an unresolved billable-token overlap invalidates the
  experiment rather than being dropped; and old fleet/support evidence cannot
  qualify a candidate that adds `implementation-planner`.

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
- Deleting or judging the necessity of retained build, release, test, probe,
  or dormant review-bookkeeping machinery; that is reserved for the later
  repository audit.
- Changing Grove's gate semantics, unrelated role charters, or
  consumer-authoritative `.grove/` dials outside the optional
  `[resources.<host>]` override schema.
- Adding a plan artifact, plan gate, committed production packet, persistent
  planner service, or task/change-request precondition.
- Pinning provider-specific model names in canonical role charters or silently
  substituting across resource classes or hosts.
- Adopting the optimized route from the nine-run pilot or from evidence that
  fails either completed-experiment comparison.
- Activating ordinary production planning in the first role-bearing release
  without a later approved adoption decision bound to completed valid
  evidence.
- Changing any surface support classification, marketplace authority, release
  version, or release tag merely because package paths move.
- Physically separate Claude and Codex package roots or a published generated
  distribution artifact.
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
- **INV5 — inventory completeness:** Host, generation, and support expectations
  shall derive from every unique canonical role row in `metadata/roles.json`,
  each resolving to one canonical charter; each release shall declare and
  assert its exact count, the first release containing
  `implementation-planner` shall prove bijection to this spec's fourteen-id
  oracle, shaper shall be driving-session only, dispatcher shall be
  driving-session plus scoped-advisor only, every other role shall have only
  its declared cold-native exposure, and every non-driving exposure shall have
  one unique underscore-form native id.
- **INV6 — bridge/support separation:** When a Codex surface is only
  bridge-viable, the release validator shall not classify it as supported
  until the full support record passes on that exact surface.
- **INV7 — fallback prohibition:** If the thin Codex bridge fails, the build
  shall not emit self-contained role TOML unless a later approved decision
  explicitly authorizes it.
- **INV8 — shared floor:** When both host adapters are installed, the consumer
  repository shall contain one shared `.grove/` consumer contract, no
  host-specific copy of consumer configuration, and no standard
  `.grove/internal/` runtime or enforcement payload.
- **INV9 — bounded writes:** A lifecycle operation shall modify only declared
  Grove-managed files, exact managed blocks, and individually confirmed
  consumer-owned files.
- **INV10 — consumer authority:** Refresh shall never modify
  `.grove/config.toml`, `.grove/gates.toml`, or consumer-authored
  `.grove/agents/` addenda, except that it may remove the legacy
  `.grove/internal/gates` `runtime_dir` from `gates.toml` after the separate
  explicit migration confirmation.
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
  classified for that host's surface and the components in that host's exact
  discovery inventory.
- **INV15 — release gate:** The tag workflow shall create
  `grove-v<VERSION>` only after generation, manifest, version, surface, and
  package checks pass, and shall no-op only if an existing tag peels to the
  intended release commit.
- **INV16 — git neutrality:** Setup, refresh, set-profile, and remove shall perform no git
  add, commit, branch, push, pull-request, merge, or landing recommendation.
- **INV17 — plugin/agent boundary:** The Codex plugin shall carry no native
  custom-agent definitions; setup shall compose thin project launchers only
  for bridge-viable surfaces, and Codex shall discover only
  `adapters/codex/skills/`.
- **INV18 — status absence:** Setup and refresh shall compose or maintain no
  status-emission adapter; remove shall treat only a detected legacy
  Grove-installed copy as confirmed cleanup state.
- **INV19 — explicit surface selection:** Before a Codex lifecycle write, the
  operation shall validate one exact host-matched surface id with declared
  provenance; invalid input shall produce no repository mutation, and a
  valid-unsupported input shall permit only the operation-specific behavior in
  the surface write-permissions table.
- **INV20 — exposure-specific discovery:** A supported-surface discovery run
  shall derive all expected identities and exposure classes from the
  canonical authored inventory and shall pass only when each declared
  driving-session, cold-native, and scoped-advisor exposure satisfies its
  corresponding oracle exactly once; the first release containing
  `implementation-planner` shall additionally prove bijection to the
  independent fourteen-id oracle.
- **INV21 — immutable tag identity:** When `grove-v<VERSION>` already exists,
  release automation shall peel it to a commit and shall fail without changing
  the tag unless that commit equals the workflow event commit for the merged
  version-authority change.
- **INV22 — stamp skew disclosure:** When the installed Grove version differs
  from an existing consumer-repository Grove stamp, every Grove consumer
  operation shall report both values and the direction of skew before
  continuing; it shall never silently rewrite the stamp as reconciliation.
- **INV23 — exact package allowlist:** Before any package, probe, or release
  claim, validation shall require the complete physical `plugins/grove/` tree
  to equal the declared recursive leaf allowlist and shall reject every
  missing, extra, duplicate, case-colliding, escaping, broken, or
  kind-mismatched path, while preserving and comparing the literal target of
  every declared internal symlink.
- **INV24 — source-side machinery:** Build, release, test, and probe
  implementation shall reside under `tooling/grove/`, dormant review
  bookkeeping shall reside under `retired/review-bookkeeping/`, and neither
  shall appear in the installable package snapshot.
- **INV25 — no default discovery roots:** The package root shall contain no
  `skills/`, `agents/`, `commands/`, or `SKILL.md`, and neither manifest shall
  expose `runtime/`, `reference/`, `metadata/`, or the opposite-host adapter as
  a discovery root.
- **INV26 — Claude isolation:** From a clean installed cache, Claude discovery
  shall return exactly one generated Claude native agent for every
  `cold-native` or `scoped-advisor` exposure and the four lifecycle skills,
  each from `adapters/claude/`; shaper shall have no native agent and the
  dispatcher agent shall expose only scoped-advisor.
- **INV27 — Codex isolation:** From a clean installed cache, Codex discovery
  shall return exactly the four lifecycle skills and one `role-<canonical-id>`
  skill for every canonical role row, all from
  `adapters/codex/skills/`; generated project launchers shall exist only for
  `cold-native` or `scoped-advisor` exposures, with no shaper launcher or
  full-dispatcher launcher; the first candidate containing
  `implementation-planner` shall derive exactly the fourteen oracle-matched
  role skills.
- **INV28 — package-resident default runtime:** When `runtime_dir` is absent,
  every handover shall invoke `runtime/gates/` relative to the active installed
  plugin without writing an absolute cache path or falling back to a source
  checkout.
- **INV29 — explicit runtime authority:** When any `runtime_dir` is present,
  the resolver shall invoke exactly that declared target or fail loudly; it
  shall not search for, copy, or substitute another runtime.
- **INV30 — consumer-only floor:** New setup and ordinary refresh shall create
  or manage only `.grove/README.md` beneath the Grove-managed floor and shall
  install no executable or fixed enforcement data under `.grove/`.
- **INV31 — confirmation-bound legacy migration:** When legacy internal state
  is found, refresh or remove shall inventory it without following symlinks,
  prove ownership only by the versioned inventory's exact path/byte algorithm,
  preserve unexpected, unprovable, or unconfirmed content, and perform config
  migration, restart acknowledgement, and target deletion only through their
  distinct required confirmations.
- **INV32 — snapshot fidelity:** Release and marketplace probes shall operate
  on an ephemeral package snapshot whose allowlisted path set and bytes equal
  the validated `plugins/grove/` source package and whose symlink kinds and
  literal targets are identical; snapshot construction shall not dereference a
  link or hide an unexpected source-package path.
- **INV33 — generated driving-session loading:** On both hosts, the managed
  instruction block shall select generated complete-projection loaders for
  dispatcher and shaper in the current task; it shall not copy charter prose,
  spawn those full roles, or allow a native dispatcher/shaper to advertise
  driving-session.
- **INV34 — versioned legacy proof:** The package shall carry the schema-v1,
  append-only legacy ownership inventory for every released legacy upgrade
  fixture, and cleanup shall classify a path as ownership-proven only after
  exact kind, path-set, and SHA-256 comparison with a valid version record.
- **INV35 — exact repository stamps:** The only repository stamp carriers
  shall be the exact schema-v1 stamp line inside valid Grove blocks in
  `CLAUDE.md` and `AGENTS.md`; malformed candidate carriers shall block setup,
  refresh, and set-profile writes, and each operation shall obey its declared
  carrier-update ownership without precedence or silent reconciliation.
- **INV36 — surface-bounded operations:** Each lifecycle operation shall
  classify its surface input before mutation and shall perform no creation,
  replacement, or deletion beyond the exact cell for that operation and
  `supported`, `valid-unsupported`, or `invalid` class.
- **INV37 — canonical planner generation:** The build shall derive every
  `implementation-planner` instruction from
  `charters/implementation-planner.md`, whose frontmatter shall declare scalar
  `implements: adr-0036-pre-execution-planning`; generate its reference,
  Claude-agent, and Codex-skill projections; and expose it as one read-only
  `cold-native` role with a unique underscore-form native id and
  `reasoning-heavy` resource intent.
- **INV38 — packet validity:** When `implementation-planner` returns a result,
  the relay shall accept only the closed canonical UTF-8 JSON schema with no
  duplicate/unknown/trailing bytes, exact artifact and repository identities,
  exhaustive one-entry-per-artifact-criterion coverage, disposition-consistent
  typed code/test/command/oracle cross-references, fact-classified anchors,
  ordered slices, verification commands, and risks/gaps.
- **INV39 — local deterministic routing:** The generic dispatcher shall derive
  planning from the planner and executor rows' local declarations and shall
  snapshot and completely cover the closed work-scope source set, emit every
  stable work id in the route-classification record, evaluate observable
  predicates in declared precedence, fail closed on ambiguity or missing
  coverage, and select only the corresponding direct, planning,
  reconvergence, or shaping route.
- **INV40 — artifact authority:** When an executor receives an advisory
  packet, it shall reopen and implement the ratified artifact, verify packet
  identity and typed code/test/oracle references, let the artifact win every
  conflict, and surface stale, contradictory, extending, softening, or
  unverifiable packet content for replan rather than silently following it.
- **INV41 — direct relay and bounded recovery:** The dispatcher shall relay a
  valid packet's exact bytes and digest beside the artifact pointer into a
  separately cold executor without an ordinary-path external write; it shall
  allow at most one automatic ordinary replan and terminate without executor
  after a second failure or changed basis.
- **INV42 — resource ownership and precedence:** The role inventory shall
  declare planner `reasoning-heavy` and executor `execution-medium` intent;
  versioned defaults shall live in `metadata/hosts.json`; and an exact
  `[resources.<active-host>]` consumer key shall override only the same
  host/class default in class-bound contexts, never pre-adoption or arm A,
  while lifecycle operations shall document but never create or change
  consumer overrides.
- **INV43 — fail-loud resource resolution:** Before role dispatch, resolution
  shall follow the binding-context table, execute every applicable exact
  `hosts.json` capability probe against its named versioned
  host-runtime/provider catalog, and reject unavailable validation, missing
  classes, unknown host/class/selectors, unsupported selectors, ambiguity, or
  cross-host fallback; declaration files and prior evidence shall not
  substitute for a current authoritative probe.
- **INV44 — exact experiment shape:** The harness shall run preregistered
  small/medium/large tasks across A premium-executor, B medium-executor, and C
  premium-planner → medium-executor from fresh isolated identical-basis
  fixtures, once for exactly nine valid phase-one analysis runs, apply the
  one-way futility rule only to a complete valid matched block, and otherwise
  add two valid repetitions per cell for exactly twenty-seven valid analysis
  runs and nine valid runs per arm.
- **INV45 — bounded run truth:** Each experimental run shall allow at most two
  additional dispatches classified exactly once as planner retry, executor
  retry, or reviewer-return loop, and shall award one accepted-quality result
  only when required tests/typechecks pass, conformance is `PASS`, and code
  review's terminal required pass has no blocking finding within that shared
  bound.
- **INV46 — complete experiment accounting:** The harness shall retain every
  raw provider token field and normalize billed tokens into a preregistered
  disjoint leaf-bucket partition; premium tokens and weighted cost shall use
  each billable bucket exactly once, raw provider totals shall remain
  informational, and unresolvable overlaps shall invalidate measurement.
- **INV47 — baseline adoption floor:** After twenty-seven valid analysis runs,
  treatment C
  shall fail the A comparison unless it trails A by at most one accepted
  result, has no more blocking-finding runs, uses at least 30% fewer premium
  tokens, and satisfies the totalized 20%-cost-reduction truth table,
  including its finite, zero, and infinity cases.
- **INV48 — medium-control advantage:** Treatment C shall fail the B
  comparison unless it has at least one more accepted result or, on an
  accepted-count tie with nonzero B remediation, uses at least 20% fewer total
  remediation dispatches; a tie with zero B remediation shall be false.
- **INV49 — out-of-tree evidence and requalification:** The harness shall
  retain preregistration and results outside the source repository; preserve
  invalidated task attempts as separately reported audit overhead while
  excluding them from valid counts and adoption arithmetic; replace every arm
  symmetrically and recompute futility from a complete valid block; and rerun
  release qualification before a separately human-ratified version bump and
  adoption decision.
- **INV50 — independent first-release oracle:** The first release containing
  `implementation-planner` shall prove a bijection between
  `metadata/roles.json` and the fourteen ids enumerated in this spec, rejecting
  missing, extra, duplicate, or renamed ids; later releases shall return to
  inventory-derived completeness with release-declared exact counts.
- **INV51 — experiment-only activation:** The first planner-bearing release
  shall mark ordinary production planning `inactive-experiment-only`; only arm
  C may invoke the installed local declarations until a later approved
  adoption decision binds a passing valid twenty-seven-run evidence identity
  to the exact candidate, and ordinary direct execution shall retain the
  fixture-proven pre-adoption premium/no-planner selector rather than applying
  `execution-medium`.
- **INV52 — criterion non-exclusion:** An executable packet shall map every
  artifact EARS/GWT id exactly once to `implement` or justified
  `verify-only`; a blocked packet shall enumerate all ids and use `blocked` for
  unresolved criteria; no scope exclusion shall name an artifact criterion.
- **INV53 — checkpoint identity:** A checkpoint shall embed the unchanged
  original packet bytes, digest, artifact/basis identities, current checkpoint
  basis, prefix/suffix slice partition, verify-only partition, and matching
  completion evidence in the closed checkpoint schema; mismatch shall refuse
  resume without inventing a remainder packet.
- **INV54 — terminal planning bound:** Ordinary planning shall permit only an
  initial call plus one same-basis automatic replan; when neither yields a
  usable packet, the dispatcher shall surface both findings and dispatch no
  executor, independently of the experiment-only remediation budget.
- **INV55 — complete requested-work oracle:** Route classification shall
  snapshot the dispatch request and every stable referenced source, partition
  every source byte without gaps/overlap, assign every desired-behavior
  interval one stable work id, and require each work id to map to artifact
  criteria or produce `wrong_decision`, `spec_gap`, or `ambiguous`; an omitted
  source, byte range, or work id shall preclude `adequate_spec`.
- **INV56 — typed packet namespaces:** Every `failing_test_ids` value shall
  resolve exactly once to a criterion-consistent `TA<n>` entry whose `CMD<n>`
  is a real test command, every verify-only `oracle_id` shall resolve exactly
  once to a criterion-consistent `OR<n>` whose nonempty command list resolves
  to real verification commands, and every
  slice/code/test reference shall resolve in its declared namespace with no
  orphan or cross-criterion entry.
- **INV57 — context-bound executor resources:** While production activation is
  inactive, ordinary execution shall retain the fixture-proven pre-adoption
  selector; arm A shall pin that exact capability-validated premium selector
  without class lookup; and only experiment B/C or activated production shall
  apply `execution-medium`, with `reasoning-heavy` additionally applying to C
  or activated planner calls.

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
no `.grove/internal/`, executable, fixed enforcement file, charter, companion,
or status-emission adapter was copied into the repository.

#### S6 — setup meets a launcher collision

**Given** a consumer-authored file occupies a planned Codex launcher path and
lacks Grove's ownership marker,
**When** Codex setup runs,
**Then** setup leaves that file byte-identical, reports the collision, and does
not claim the affected role is installed.

#### S7 — refresh preserves consumer and other-host state

**Given** both host adapters exist and consumer config/addenda are edited,
**When** refresh runs from one host,
**Then** it refreshes only `.grove/README.md` in the shared floor plus the
invoking-host adapter,
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

**Given** the canonical role inventory and generated Codex package for the
first release containing `implementation-planner`,
**When** generation and package validation run,
**Then** the inventory ids are bijective with the independent fourteen-id
oracle, every native exposure has a unique underscore-form id, the plugin
contains its skills only under `adapters/codex/skills/`, contains no
custom-agent TOML, and setup owns generation of the project launchers.

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
Claude id, contradictory provenance, or a currently unsupported Codex id,
**When** setup or refresh validates its surface invocation record,
**Then** invalid input reports the valid Codex ids and reason and makes no
repository mutation, while a valid-unsupported id reports its missing
capability and follows the operation's no-write cell; neither infers a mode
from the environment;
and **given** an explicit `codex-exec-non-ephemeral` record, **when** setup
validates it, **then** the selected id and provenance are reported before the
bounded writes proceed.

#### S18 — discovery is complete by exposure

**Given** a fresh candidate on a claimed-supported surface, the canonical
authored inventory, and the independent first-release fourteen-id oracle,
**When** discovery runs,
**Then** the inventory is bijective with that oracle, the driving task follows
the host's declared generated loaders and
returns matching source identity for full dispatcher and interactive shaper
without spawning, every inventory exposure classified cold-native is
enumerated and returns matching source identity independently, the one native
dispatcher selects and returns `scoped-advisor`, shaper has no native id, no
native identity claims driving-session, and any missing, duplicate, extra,
wrong-class, wrong-source, or wrong-digest result fails the surface record.

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
**Then** the operation inventories both exact carrier paths, reports every
valid carrier value plus whether the installation is ahead or behind it before
any write, preserves every carrier the operation does not own, and never
describes the mismatch as silently reconciled.

#### S21 — the package tree is exact

**Given** a generated package whose physical path set equals the recursive
allowlist,
**When** validation adds one build fixture, test, root discovery directory,
undeclared adapter file, or other unexpected path beneath `plugins/grove/`,
**Then** package validation names the path and fails before snapshot, probe, or
release work; **and given** any declared leaf is absent or has the wrong kind,
**when** validation runs, **then** it names that mismatch and fails likewise;
**and given** a declared symlink, **when** the snapshot changes its literal
target, dereferences it, or places its resolved target outside the snapshot,
**then** fidelity validation fails.

#### S22 — Claude discovers only its adapter

**Given** Grove installed for Claude in both an outside-checkout shallow cache
and an at-least-eight-level-deep cache whose path contains spaces,
**When** Claude component discovery runs from a fresh host state,
**Then** its raw host-visible result equals the authored Claude inventory
exactly: one generated agent per cold-native or scoped-advisor exposure and the
four lifecycle skills come from `adapters/claude/`, dispatcher is scoped only,
shaper has no native agent, and no Codex role skill, package
reference/runtime path, duplicate, or undeclared Grove component is
discovered.

#### S23 — Codex discovers only its adapter

**Given** Grove installed for Codex in both an outside-checkout shallow cache
and an at-least-eight-level-deep cache whose path contains spaces,
**When** Codex component discovery runs from a fresh host state,
**Then** its result equals the authored Codex positive inventory exactly: the
four lifecycle skills and one `role-<canonical-id>` skill for every canonical
role row come from
`adapters/codex/skills/`, project launchers exist only for cold-native and
scoped-advisor exposures, dispatcher is scoped only, shaper has no launcher,
the first candidate containing `implementation-planner` derives exactly the
fourteen oracle-matched role skills, and no Claude agent envelope, plugin
custom-agent TOML, package
reference/runtime path, duplicate, or undeclared Grove component is
discovered.

#### S24 — both hosts resolve the installed gate runtime

**Given** a clean installed Grove package outside a source checkout, a
consumer with no `runtime_dir`, and a cache path at arbitrary depth containing
spaces,
**When** Claude and Codex each perform a handover,
**Then** each invokes `runtime/gates/` relative to its active installed package,
applies the same profile, intent-floor, and guardian-fallback semantics, and
writes no absolute cache path into the consumer.

#### S25 — an explicit runtime remains authoritative

**Given** a consumer declares a non-legacy `runtime_dir`,
**When** a handover resolves its gate profile,
**Then** the adapter invokes exactly that directory; **and given** the target is
missing or invalid, **when** resolution runs, **then** it fails loudly without
searching for or substituting the package runtime.

#### S26 — new setup keeps the consumer floor thin

**Given** a clean consumer repository with either host selected,
**When** setup completes,
**Then** `.grove/` contains the preserved or seeded consumer-authoritative
dials, optional addenda, and Grove-managed `README.md`, creates no
`.grove/internal/`, and contains no copied resolver or fixed enforcement data.

#### S27 — an absent runtime override permits confirmed cleanup

**Given** a consumer with no `runtime_dir` and ownership-proven legacy gates
and enforcement files,
**When** schema-v1 inventory comparison proves their complete path/byte maps
and the consumer declines cleanup or restart
acknowledgement,
**Then** refresh leaves the legacy files byte-identical while refreshing
unrelated owned surfaces; **and when** both restart acknowledgement and cleanup
are confirmed, **then** it removes only the proven legacy files and removes a
parent directory only if empty.

#### S28 — a legacy runtime override migrates in two acts

**Given** `runtime_dir` normalizes to `.grove/internal/gates` and its legacy
target exists,
**When** refresh inventories the state,
**Then** declining config migration preserves both the override and target;
**and when** config migration is confirmed, **then** refresh removes only that
override and still preserves the target until restart acknowledgement and a
separate target-deletion confirmation are both supplied.

#### S29 — unexpected legacy content blocks tree deletion

**Given** `.grove/internal/` contains an unexpected file, a symlink, or a known
path whose kind/path/digest does not exactly match a valid legacy inventory
record,
**When** refresh or remove inventories legacy state,
**Then** it reports each such path without following symlinks, refuses
whole-tree deletion, preserves every unexpected or unconfirmed path, and may
remove only separately confirmed known managed leaves without removing a
non-empty parent.

#### S30 — source-side tooling exercises the exact snapshot

**Given** build, release, test, and probe sources under `tooling/grove/`, dormant
review bookkeeping under `retired/review-bookkeeping/`, and a valid package
allowlist,
**When** release validation assembles and tests the ephemeral package snapshot,
**Then** the snapshot's path set and bytes equal the validated package, contains
none of that source-side or dormant machinery, preserves all v3 surface and
release classifications, and no version or tag changes merely because the
paths moved.

#### S31 — driving roles load in the current task

**Given** a fresh supported Claude session and a fresh supported Codex session
whose managed blocks were generated from the host inventories,
**When** the driving task selects full dispatcher and then interactive shaper,
**Then** Claude reads the two exact `${CLAUDE_PLUGIN_ROOT}` complete
projections, Codex invokes the two exact raw installed driving-session skill
ids, both hosts report the declared source/digest without spawning, and
neither managed block or loader contains copied charter prose; **and given** a
native dispatcher invocation, **when** it loads, **then** it selects only the
scoped-advisor fragment.

#### S32 — legacy ownership proof is conservative

**Given** one legacy tree exactly matching a published schema-v1 version
record, a second tree with one changed byte, a third with a mixed-version leaf
set, and a missing or malformed inventory case,
**When** refresh performs the sorted no-follow ownership proof,
**Then** it proves the first complete tree and reports its matching versions,
proves only individually exact leaves in the second and third cases, proves
nothing in the missing/malformed-inventory case, and preserves every
unexpected, unprovable, or unconfirmed path.

#### S33 — stamp carriers are exact and operation-owned

**Given** valid, skewed Grove stamps in both host blocks,
**When** setup or refresh succeeds from one host,
**Then** it reports both carrier comparisons and may update only the invoking
host's exact stamp line to the installed version; **when** set-profile runs,
**then** it changes no stamp; **when** remove is confirmed, **then** it deletes
a stamp only with its containing owned block; **and given** duplicate markers
or a missing, duplicate, or invalid stamp inside either candidate block,
**when** setup, refresh, or set-profile runs, **then** it reports the malformed
carrier and writes nothing.

#### S34 — every operation obeys the surface write cell

**Given** one supported record, one host-matched valid-unsupported record, and
one invalid record for each host,
**When** setup, refresh, set-profile, and remove each plan against all three,
**Then** supported input permits only that operation's bounded writes,
valid-unsupported input permits no mutation for setup, refresh, or set-profile
and only individually confirmed Remove deletions, invalid input permits no
mutation for any operation, and read-only disclosure in no case becomes a
partial write.

#### S35 — the planner joins both generated fleets

**Given** the canonical role inventory has added `implementation-planner` with
its charter, one cold-native exposure, local trigger, output paths, and
`reasoning-heavy` intent,
**When** generation and exact host-discovery checks run,
**Then** the charter declares scalar
`implements: adr-0036-pre-execution-planning`, both host projections derive
from it, the inventory ids are bijective with the spec's fourteen-id oracle,
Claude and Codex each expose the planner exactly once through their declared
adapter, and unrelated projections remain byte-identical.

#### S36 — code-bearing spec work plans before execution

**Given** a ratified code-bearing spec, its dependency graph, a reproducible
repository basis, and either experiment arm C or an active later adoption
decision,
**When** the generic dispatcher evaluates the planner and executor rows' local
declarations and the route-classification record,
**Then** it cold-runs `implementation-planner`, validates a complete executable
packet, and relays that packet and artifact pointer into a separately cold
executor without consulting a central workflow branch.

#### S37 — explicit direct routes remain direct

**Given** one classification record proving adequate-spec criterion coverage,
a repeated failing observation, an exact causal trace, and a single-component
localized boundary, plus another record proving decision-only non-code
deliverables,
**When** precedence evaluates them,
**Then** each routes directly to executor without a packet; **but given** an
adequate non-local code-bearing slip, **when** row 6 evaluates under experiment
or active adoption, **then** it plans without manufacturing a spec amendment;
**and given** exact wrong-decision or spec-gap evidence, **when** precedence
runs, **then** the former routes to shaping first and the latter reconverges
before any reclassification.

#### S38 — blocked or stale advice cannot become authority

**Given** a planner encounters a load-bearing ambiguity, or an executor
receives a packet with a stale basis, duplicate/unknown wire field,
non-exhaustive criterion map, contradictory criterion, extended or softened
requirement, or unverifiable anchor,
**When** packet or executor validation runs,
**Then** it reports a blocked/unusable packet and the exact gap, performs no
implementation from that advice, and uses at most one same-basis replan;
reviewers continue to judge eventual code against the artifact, not plan
adherence.

#### S39 — the ordinary relay is verbatim and write-free

**Given** one valid executable advisory packet and no checkpoint event,
**When** the driving-session dispatcher hands off to executor,
**Then** the executor receives the exact canonical UTF-8 JSON byte sequence and
its matching SHA-256 verbatim beside the authoritative pointer, independently
reopens and verifies the artifact plus typed code/test/oracle references, and
no repo, tracker, task, or change-request write occurs.

#### S40 — relay interruption checkpoints or replans

**Given** planned work with an existing identifiable task/change-request,
**When** its established checkpoint seam fires,
**Then** the checkpoint carries the unchanged packet bytes/digest and valid
prefix/suffix plus verify-only partitions in the closed checkpoint envelope,
without elevating authority or creating a second packet; **but given** no such
carrier and a relay lost before executor dispatch, **when** dispatch resumes,
**then** the dispatcher uses at most its one same-basis replan and does not
create a carrier or recover hidden session state.

#### S41 — resource selection honors one host and fails closed

**Given** versioned active-host defaults and an exact
`[resources.<active-host>]` override for `reasoning-heavy`,
**When** experiment C or activated production resolves class-bound resources,
**Then** only that class is replaced, `execution-medium` retains the same
host's default, the exact declared authoritative capability probe proves both
selectors, and the complete map/source/probe evidence is recorded; **but
given** a missing class, unknown selector, unsupported model, unavailable
source/probe, or only an other-host mapping, **when** resolution runs, **then**
it fails before dispatch without substitution or optimized-route support.

#### S42 — the nine-run futility screen is one-way

**Given** preregistered small, medium, and large tasks and one valid cold run of
A, B, and C for each,
**When** the complete valid matched block shows C unaccepted on at least two
tasks where A is accepted, or no matched task has C use fewer premium tokens
or lower weighted cost than A,
**Then** the experiment stops after exactly nine valid analysis runs as futile
and cannot adopt; **but when** neither condition holds, **then** the pilot still
cannot adopt and proceeds to phase two.

#### S43 — a passing screen expands to exactly twenty-seven

**Given** phase one did not meet futility,
**When** phase two runs,
**Then** it adds exactly two valid cold repetitions for every task/arm cell in
the preregistered randomized order and ends with twenty-seven valid analysis
runs total and nine valid runs per arm, irrespective of separately retained
invalidated attempts.

#### S44 — retries share one two-dispatch budget

**Given** a treatment-C planner fails once, retries successfully, and later
independent review returns one blocking finding,
**When** the run accounts for remediation,
**Then** the planner retry and reviewer-return loop consume the two shared
dispatches exactly once each, every call remains in cost/token/time totals,
and no further retry is allowed; the run is accepted only if required
tests/typechecks, conformance `PASS`, and a blocking-free terminal required
code-review pass all occur within that bound, while the earlier blocking pass
still counts the run once as a blocking-finding run.

#### S45 — cost comparison totalizes zero acceptance

**Given** raw provider fields, a preregistered disjoint bucket normalization,
model tiers, and a dated price snapshot,
**When** weighted cost per accepted completion is calculated,
**Then** each billed token is priced exactly once, raw provider totals remain
informational, premium tokens include every disjoint bucket from premium-model
calls, and zero acceptances yields positive infinity; **and when** the A/C
baseline cost condition is evaluated, **then** it passes only for finite
positive A with C at most 80% of A, or infinite A with finite C, and fails for
infinite C, both infinite, zero A, or a smaller reduction.

#### S46 — planner value must exceed medium-only control

**Given** twenty-seven completed valid analysis runs,
**When** C has at least one more accepted-quality result than B,
**Then** the B-advantage condition passes; **and given** tied accepted counts
with positive B remediation, **when** C's reduction is at least 20%, **then**
it passes; **but given** tied counts with zero B remediation or fewer C
acceptances, **when** the condition runs, **then** it fails, including
zero/zero.

#### S47 — evidence stays outside the tree and release proof is fresh

**Given** a caller selects a repository-contained evidence path, or an old
release candidate predates `implementation-planner`,
**When** the harness or release validation starts,
**Then** the harness rejects the in-tree destination and release validation
rejects the stale fleet evidence; **and given** a valid outside-tree root,
**when** a matched task is independently found upstream-invalid, **then** all
three arms' invalidated attempts remain separately costed audit overhead,
every valid cell uses the preregistered same-stratum replacement, futility is
recomputed only from a complete valid block, evidence records the effective
mappings, and the changed candidate must freshly prove generated parity,
bijection to the fourteen-id oracle, supported surfaces, package/channel
installation, and a separately judged version bump.

#### S48 — packet criteria cannot self-exclude

**Given** a ratified artifact with EARS and GWT ids, including one criterion
already satisfied on the repository basis,
**When** an executable packet is validated,
**Then** every id appears exactly once, changed behavior uses `implement` with
resolved typed test-anchor/slice references, the already-satisfied criterion
uses `verify-only` with an exact command-linked oracle and basis observation,
and any omission, criterion-naming scope exclusion, duplicate id, wrong
namespace, cross-criterion reference, or `verify-only` slice makes the packet
unusable.

#### S49 — ambiguous route evidence fails before dispatch

**Given** classification evidence that lacks a repeatable failure, cannot rule
out a spec gap, contains stale anchors, or makes conflicting same-precedence
classes true,
**When** the route classifier records every predicate and applies precedence,
**Then** it selects `ambiguous` or unclassified, names the missing/conflicting
evidence, and dispatches neither planner nor executor.

#### S50 — the first role-bearing release is experiment-only

**Given** the first candidate installs the planner and local trigger
declarations but has no later approved adoption decision,
**When** an ordinary dispatcher receives ratified code-bearing spec work,
**Then** production planning remains `inactive-experiment-only` and the
ordinary fixture-proven pre-adoption premium/no-planner selector remains in
force without `execution-medium`; **but when** experiment arm C invokes the
declarations, **then** planning and the reasoning-heavy/execution-medium pair
are available only inside that measured run and do not activate production.

#### S51 — ordinary replanning terminates after one retry

**Given** an initial packet is unusable while its artifact and basis remain
reproducible,
**When** the dispatcher requests its one automatic replan and that result is
also blocked or unusable,
**Then** it reports both attempt findings, performs no third planner call,
dispatches no executor, and returns control for human/shaping resolution.

#### S52 — checkpoint progress cannot rewrite the plan

**Given** an executable packet with ordered slices and verify-only criteria,
**When** a checkpoint records completed work,
**Then** it embeds the original packet bytes and digest, a completed prefix and
remaining suffix, a disjoint exhaustive verify-only partition, matching
completion evidence, and exact artifact/original/current basis identities;
**but given** any digest mismatch, reordered remainder, changed packet, or
stale basis, **when** resume validates it, **then** resume refuses with no
executor and creates no reduced packet.

#### S53 — selector declarations do not prove capability

**Given** `hosts.json` and consumer config name a concrete selector but the
declared host-runtime/provider catalog or read-only capability probe is absent,
unauthenticated, stale, or unparseable,
**When** resource resolution runs,
**Then** it fails before planner/executor dispatch and does not treat the
declaration, documentation, prior evidence, or another host's probe as proof.

#### S54 — overlapping token reports are normalized once

**Given** a provider reports total output including reasoning output and a
separate reasoning subset,
**When** the preregistered normalization produces billable operands,
**Then** it creates disjoint reasoning and non-reasoning output buckets,
retains raw total output informationally, and prices each token once; **but
given** no documented subtraction can form nonnegative disjoint leaves,
**when** normalization runs, **then** measurement is invalid rather than
double-counted.

#### S55 — invalid upstream attempts do not distort the matched experiment

**Given** independent review invalidates one task after some A/B/C attempts,
**When** the harness applies the same-stratum replacement,
**Then** it retains all invalidated attempts and their cost/time/token data in
the audit-overhead ledger, excludes every invalidated cell symmetrically from
valid metrics and adoption arithmetic, completes every arm/repetition for the
replacement, and evaluates or recomputes futility only after a complete valid
matched block yields exactly nine or twenty-seven valid analysis runs.

#### S56 — requested behavior cannot disappear before classification

**Given** a dispatch request with two desired behaviors and one stably
referenced issue containing a third,
**When** the work-scope collector snapshots the closed sources,
**Then** their byte coverage is gap-free/non-overlapping, all three desired
intervals receive stable ordered work ids and source provenance, and
`adequate_spec` is true only if every work id maps to artifact criteria; **but
given** the issue is unreadable, a byte range is omitted, or one desired span
is labeled context without a non-normative reason, **when** classification
runs, **then** it records `ambiguous` or `spec_gap` and dispatches neither a
planner nor executor under `adequate_spec`.

#### S57 — packet references resolve through typed closed collections

**Given** an implement criterion naming `TA1` and a verify-only criterion
naming `OR1`,
**When** packet validation runs,
**Then** `TA1` resolves exactly once to a test anchor carrying that criterion
and a real class-test `CMD<n>`, `OR1` resolves exactly once to an oracle
carrying the verify-only criterion and nonempty real command ids, and every
slice/code/test back-reference is criterion-consistent; **but given** a missing
collection entry, duplicate typed id, wrong namespace, orphan entry,
non-test failing command, or cross-criterion link, **when** validation runs,
**then** the packet is unusable before relay.

#### S58 — resource binding depends on activation and experiment arm

**Given** inactive production and a fixture-proven pre-adoption premium
executor selector,
**When** ordinary work and experiment arms A, B, and C resolve models,
**Then** ordinary work retains that direct selector, A pins the exact equal
premium selector and capability-validates it without class lookup, B resolves
only `execution-medium`, and C resolves `reasoning-heavy` plus
`execution-medium`; **but given** A differs from the baseline, is not premium,
or lacks capability proof, **when** the harness validates preregistration,
**then** the matched experiment fails without changing inactive production or
using the executor class as an A fallback.

## Open questions

None. The thin bridge is settled as viable for non-ephemeral `codex exec`;
interactive CLI and desktop local still owe their smoke tests, and that does
not settle release support, which remains earned per matrix row. Unknown surfaces
remain unsupported until verified. A failed thin bridge returns to the
maintainer's intent gate before any fallback is adopted. The exact Git
repository hosting the Codex catalog is a publication input, not a second
method authority; the selected source must satisfy the marketplace-channel
criteria above. The experiment result, exact semantic release bump, and
surface-by-surface ability to honor the new resource classes are future
evidence or human release/adoption judgments under the fixed requirements
above, not unresolved contract choices.

## Rubric check

`SPEC_RUBRIC_PATH` is explicitly configured as
`none exists yet`; that exact value was verified in `.grove/config.toml`, no
rubric path is present in the repository, and no
`.grove/agents/contract-author.md` addendum exists. Self-check
against the contract-author charter:

- **Settled input:** PASS — `adr-0031-multi-host-distribution`,
  `adr-0032-status-emission-belongs-to-wisp`,
  `adr-0035-plugin-and-consumer-boundary`, and
  `adr-0036-pre-execution-planning` are approved; ADR-0031 remains the original
  `implements:` upstream and all four appear in `depends_on`.
- **Required shape:** PASS — shared frontmatter, behavioral `version: 5`, the
  seven-field section-level amendment note, explicit non-goals, acceptance
  criteria, open questions, and this rubric check are present; the future
  planner charter's scalar `implements:` edge is explicit.
- **Both test grammars:** PASS — behavioral examples use Given/When/Then and
  requirements use EARS `shall` statements.
- **No invented fallback:** PASS — thin-launcher failure returns to the intent
  gate; self-contained TOML remains unauthorized.
- **No duplicated corpus:** PASS — the contract defines canonical sources,
  metadata-only adapters, deterministic projections, and host-specific
  generated driving loaders without repeating any charter or
  lifecycle-operation body.
- **Bounded scope:** PASS — public-directory publication, universal first-wave
  support, persistent orchestration, CI-bookkeeping revival, and unrelated
  role/gate changes are excluded; retained tooling is relocated rather than
  judged or deleted, ADR-0032's removed status surface is not reintroduced,
  and the advisory packet adds neither an artifact nor a gate.
- **Testability:** PASS — generation drift, explicit surface selection,
  exposure-specific discovery, immutable tag identity, stamp-skew disclosure,
  bridge evidence, exact package contents, positive and negative host
  discovery, current-task dispatcher/shaper loading, installed-cache runtime
  lookup, versioned legacy byte/path proof, exact stamp carriers and malformed
  handling, per-operation surface writes, legacy migration confirmations,
  managed-file ownership, underscore ids, status absence, version equality,
  channel installs, and per-surface support each have observable pass/fail
  behavior; planner routing, packet validation, relay/replan, resource
  resolution, independent fourteen-id bijection, route predicate precedence,
  closed source/byte coverage for every desired behavior, experiment-only
  activation, closed packet/checkpoint wire schemas and typed test/oracle
  namespaces, criterion non-exclusion, bounded terminal replanning,
  authoritative selector probes, context-bound baseline/A/B/C resource
  bindings, disjoint token arithmetic, symmetric invalid-task replacement,
  the 9 → 27 harness, control comparisons, out-of-tree evidence, and release
  requalification are likewise executable.
- **Lifecycle:** PASS — these significant revise-in-place amendments have
  durable approved decision input and bump `v4 → v5`; these review-driven
  corrections converge that same unratified v5 rather than creating a second
  behavioral release. The conformance review at `239874d` returned `PASS`, but
  it does not cover this changed exact artifact. The spec remains self-checked
  at `gated`, with fresh independent intrinsic-quality and scoped conformance
  re-reviews owed on the final SHA before implementation proceeds under the
  project gate profile.
