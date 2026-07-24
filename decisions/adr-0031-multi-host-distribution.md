---
id: adr-0031-multi-host-distribution
type: adr
status: approved  # maintainer's intent act 2026-07-23 ("Approved ... go ahead, I'll check at the end"); self-checked by the shaper; conformance scoped re-review PASS after graph fixes; decision-adversary NEEDS-REVISION on draft readiness, revision folded, scoped re-review SOUND; the later ship gate remains human
depends_on: [adr-0014-install-is-invisible-and-ungated, adr-0026-thin-vendor-boundary, adr-0027-retire-ci-for-now, adr-0028-plugin-release-tagging, adr-0029-non-interactive-loading]
owner: agent
updated: 2026-07-23
---

# ADR-0031: one grove fleet, distributed through Claude and Codex

> **Approved direction; implementation remains gated by its contract and ship review.** The maintainer asked for Grove to work on
> Claude and Codex and to have a distribution channel for each, without
> repeating instruction files or agent charters. This canvas records the
> smallest architecture that appears to satisfy that intent. Nothing here
> authorizes implementation or changes an approved decision until it passes
> independent review and the maintainer's intent gate.

## Decision state

### Decided

- **Target and constraint only** *(maintainer, 2026-07-23)*: Grove should be
  deployable on both Claude and Codex, with a distribution channel for each,
  without establishing another authored instruction or charter corpus.
- **D1 — one kernel, two generated host adapters** *(shaper recommendation,
  2026-07-23; ratified by the maintainer 2026-07-23)*: keep one host-neutral authored
  kernel and generate/package thin Claude and Codex adapters from it.
- **D2 — one host-neutral Grove release version** *(shaper recommendation,
  2026-07-23; ratified by the maintainer 2026-07-23)*: replace the Claude manifest
  as universal version authority with one Grove release version that both host
  manifests must match.
- **D3 — the Codex native-role bridge is fixed by a compatibility spike**
  *(shaper recommendation, 2026-07-23; ratified by the maintainer 2026-07-23)*:
  prefer thin project-scoped custom-agent launchers which load plugin-carried
  role instructions. If the supported surfaces cannot resolve those
  instructions reliably, return to the intent gate with the evidence before
  adopting generated standalone TOML projections as an explicit degraded
  fallback. The fallback is not pre-approved by this decision.

### Open

*(none — D1–D3 are the agent's proposal presented for independent review and
the maintainer's intent decision.)*

### Parked

- **Public-directory publication.** A repo marketplace is enough for the first
  Codex channel; public directory submission adds review, metadata, and support
  obligations that have not yet earned their place.
- **Reviving review-bookkeeping CI.** `adr-0027` already assigns that future
  work to a provider-agnostic installer. A second host is not by itself the
  enforcement trigger.
- **A persistent runner-hosted dispatcher.** This proposal maps the live
  dispatcher to the driving session. It does not invent durable orchestration
  infrastructure.

## What the sources establish

### Grove today

- `charters/` is the portable role corpus; `.grove/config.toml` and optional
  `.grove/agents/<role>.md` are the consumer-owned customization door
  (`charters/README.md`; `adr-0026` D3).
- The current distribution is Claude-specific: a
  `.claude-plugin/plugin.json`, Claude agent envelopes, `/plugin` installation,
  `/grove:*` skill invocation, and a managed `CLAUDE.md` routing block.
- The root and plugin READMEs call the Claude payload generated, but
  `CONTRIBUTING.md` says it is currently hand-authored in parallel and that no
  generator exists. The latter is the operative implementation fact; the
  documentation is already drifting.
- `adr-0026` keeps the fleet plugin-carried and consumer prose thin.
  `adr-0029` requires an explicit, verified load path on every supported
  surface and treats silent fallback to a generic agent as a defect.
- `adr-0028` makes the Claude manifest authoritative because the current
  marketplace reads it. A second host manifest invalidates that reason even
  though the human-cut release and deterministic tag remain sound.

### Codex today

The current Codex product documentation establishes these host constraints:

- A Codex plugin has a `.codex-plugin/plugin.json` entry point and may package
  skills, hooks, MCP configuration, apps, and assets.
- Codex CLI and the ChatGPT desktop app can install plugins from configured
  marketplaces. A repo marketplace lives at
  `.agents/plugins/marketplace.json`; the CLI can also add a Git-backed
  marketplace with `codex plugin marketplace add`.
- Native custom subagents are standalone TOML files under `.codex/agents/`
  (project) or `~/.codex/agents/` (user). Each requires `name`,
  `description`, and `developer_instructions`.
- Plugins are not available in the IDE extension, although skills are.

Sources:
[Build plugins](https://learn.chatgpt.com/docs/build-plugins),
[Plugins](https://learn.chatgpt.com/docs/plugins), and the Codex manual's
Custom agents section.

**Inference:** a Codex manifest alone can distribute Grove's skills but cannot
honestly promise that the thirteen native role identities are installed. Codex
needs a separate role-loading bridge and a surface-by-surface load test.

## Proposal

### 1. Keep one authored methodology kernel

The only authored normative sources remain:

- role and companion charters in `charters/`;
- host-neutral gate/config/check runtimes already under `plugins/grove/`;
- consumer-owned `.grove/` configuration and addenda.

No Claude envelope, Codex TOML, skill, managed instruction block, README, or
marketplace entry restates a charter. Host artifacts carry only metadata,
loading instructions, and pointers. Where a host requires a self-contained
payload, that payload is a deterministic build projection: generated, marked
as generated, and rejected by CI when it differs from its source.

This removes the current hand-maintained two-copy failure rather than adding a
third copy.

### 2. Build two adapters from that kernel

#### Claude adapter

Preserve the current user contract:

- Claude marketplace install;
- namespaced `grove:<role>` agents;
- `/grove:setup`, `/grove:refresh`, `/grove:set-profile`, and
  `/grove:remove`;
- a marker-bounded managed block in `CLAUDE.md`.

The behavioral change is in production, not use: Claude agent payloads become
generated projections of the canonical charters and adapter metadata.

#### Codex adapter

Add a `.codex-plugin/plugin.json` to the Grove package. Reuse the same
host-neutral lifecycle skills and references, with Codex-facing invocation
metadata rather than copied instructions.

Map roles by behavior:

- the primary Codex task enacts the full `dispatcher` and interactive
  `shaper`, because both require live multi-turn state;
- cold-started producer and reviewer roles map to Codex custom subagents;
- a spawned `dispatcher` remains only the chartered one-shot classification
  and next-dispatch advisor.

The Codex setup path composes the same `.grove/` floor, adds the same semantic
conditional-routing rule to `AGENTS.md` through its own marker-bounded adapter,
and installs only the minimum native role bridge that the spike proves
necessary. It never rewrites unrelated `AGENTS.md` content and remains
git-neutral, matching `adr-0014`.

The preferred role bridge is a set of small `.codex/agents/<role>.toml`
launchers that select a plugin-carried Grove role skill/reference. Those files
contain no charter body. Setup, refresh, and remove own the launchers as one
marked/generated surface; consumer-authored `.codex/agents/` files outside
that surface are untouched.

This bridge is conditional on proof. If a custom subagent cannot reliably load
the installed plugin role across the supported Codex surfaces, the fallback
candidate is generated self-contained TOML. That fallback must return to the
maintainer's intent gate with the spike evidence; it is not authorized here.
If later approved, it must be disclosed as a generated projection and would
partially supersede `adr-0026`'s no-fleet-in-consumer boundary for Codex only.
It cannot be chosen silently.

### 3. Publish one channel per host

| Host | First distribution channel | Install experience |
|---|---|---|
| Claude Code | existing `kodhama/stewards` Claude marketplace | existing `/plugin marketplace add`, `/plugin install`, then `/grove:setup` |
| Codex CLI / desktop | a Grove entry in a repo-backed `.agents/plugins/marketplace.json` | `codex plugin marketplace add <source>`, install Grove, start a new session, then run the Grove setup skill |

The marketplace repositories are catalogs, not new homes for Grove's method.
They point at a versioned package or generated release projection. Workspace
sharing and public-directory publication may follow only after the repo channel
proves the package.

### 4. Give Grove, not either host, the release identity

Introduce one host-neutral release-version file at the package root. Both
`.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` derive from, or are
validated against, that value. `grove-v<version>` remains the release tag.

The release PR remains the human-cut boundary from `adr-0028`: an agent
proposes the semver level and the maintainer ratifies it by merging. The tag
workflow becomes path-aware for the host-neutral version and verifies both
packages before tagging.

This supersedes only `adr-0028` D1's Claude-manifest authority. Its rationale
was correct for one host and becomes the coupling it was designed to avoid
once two manifests exist.

### 5. Define equivalence as contracts, not identical files

A Grove release is host-equivalent when both adapters pass the same black-box
contract:

1. install from the host's documented marketplace;
2. start a fresh supported session;
3. prove all thirteen role identities are discoverable;
4. prove the driving session can enact the full dispatcher while the spawned
   dispatcher stays advisory;
5. prove a cold role reads `.grove/config.toml` and its optional addendum;
6. prove an independent read-only reviewer can be dispatched separately from a
   producer;
7. prove setup/refresh/remove touch only their declared, marker-bounded files;
8. prove installed-version versus repo-stamp skew is surfaced;
9. prove an unsupported surface fails loudly rather than degrading to generic
   agents.

The matrix must name at least Claude interactive and non-interactive modes plus
Codex CLI interactive, `codex exec`, desktop local, cloud/web, and IDE. A
surface is supported only after its explicit load path passes. The first
release may support fewer surfaces; the omission must be visible in the
install docs and manifest metadata.

## Why this shape

- **One authored corpus:** fixes the drift already present between README claims
  and the hand-maintained Claude payload, and does not multiply it for Codex.
- **Thin host adapters:** preserves `.grove/` as the shared consumer contract
  while isolating genuine host differences—manifest, role envelope,
  instruction-file target, invocation syntax, and marketplace.
- **Native role identities where available:** keeps dispatch observable and
  preserves producer/reviewer separation instead of reducing Grove to one
  generic prompt.
- **Capability-tested parity:** honors `adr-0029`; installed files do not count
  as a loaded fleet.
- **One release identity:** prevents the Claude and Codex channels from
  publishing different Grove versions under one tag.

## Rejected options

- **Copy the charters into Codex TOML by hand.** Rejected: creates a third
  authority and worsens an already documented drift failure.
- **Ship only one large Grove skill on Codex.** Rejected as the target: it
  makes installation easy but collapses named role discovery and weakens
  independent dispatch. It is useful only as a bootstrap/spike tool.
- **Treat `.codex-plugin/plugin.json` as sufficient.** Rejected: the documented
  plugin payload does not include native custom-agent definitions.
- **Keep the Claude manifest as universal version authority.** Rejected:
  Codex-only changes would still require a semantically unrelated Claude
  manifest bump.
- **Make Codex setup install the dormant CI/check runtime.** Rejected:
  contradicts `adr-0027`; distribution and enforcement are separate concerns.
- **Promise every Codex surface in the first release.** Rejected: plugin
  availability differs by surface. Support is earned by an explicit load test,
  not inferred from another surface.

## Consequences and propagation if approved

Approval authorizes a contract/spec and a compatibility spike; it does not
authorize an all-at-once packaging rewrite.

1. Amend `adr-0014` with a partial-supersession pointer for the Codex
   marker-bounded `AGENTS.md` and generated `.codex/agents/` write surfaces.
2. Amend `adr-0026` with a partial-supersession pointer for generated adapters
   and any Codex bridge that must live in a consumer.
3. Amend `adr-0028` with a partial-supersession pointer for D1's version
   authority; keep its human-cut release and tag mechanics.
4. Extend `adr-0029` with the ratified Claude/Codex surface matrix and explicit
   load mechanisms. If a later intent decision approves generated
   self-contained TOML in a consumer, that later decision must add a
   partial-supersession pointer for `adr-0029`'s no-revendoring rule; the
   preferred thin-launcher path does not require that supersession.
5. Write a spec for the adapter compiler, dual manifests, managed-file
   ownership, parity checks, and release validation.
6. Run the Codex role-loading spike before fixing the spec's bridge shape.
7. Update setup/refresh/remove around a shared core plus thin
   `CLAUDE.md`/`AGENTS.md` adapters.
8. Add the Codex marketplace entry in the chosen marketplace repository; keep
   that outside-repo change on its own branch and review.
9. Replace the current "generated" documentation claim only when a generator
   actually exists; until then, describe the payload as hand-maintained.

## Acceptance criteria for this decision

- Names exactly one authored home for every normative charter and companion.
- Defines both host channels without claiming identical package mechanics.
- Preserves the full-dispatcher and interactive-shaper session boundary.
- Preserves `.grove/` as the shared consumer-owned configuration surface.
- Provides a fail-loud surface/load matrix consistent with `adr-0029`.
- Names the release authority and the approved decisions it partially
  supersedes.
- Does not revive the suspended review-bookkeeping machinery.
- Records every consumer write and outside-repository propagation explicitly.
- Receives an independent decision-adversary verdict before the maintainer is
  asked to ratify it.

## Self-check

- **Directional flow:** `gated` after this self-check; no implementation is
  authorized until the maintainer approves the decision.
- **Single home:** points to charters and companions; copies none of their
  method or boundary prose.
- **Graph maintenance:** identifies the exact approved decisions requiring
  forward pointers if this is approved.
- **Minimal first:** one kernel, two adapters, two channels; public publication,
  CI revival, and persistent orchestration remain parked.
- **Transparency:** the Codex native-agent packaging gap and the possible
  generated-TOML fallback are explicit.
- **Intent gate:** no recommendation is recorded as maintainer-approved.

## Forward annotation — ADR-0033 (2026-07-24)

ADR-0033 adopts the Stewards family release/surface and distribution contracts
without changing this decision's one kernel, dual adapters, Grove-owned
`VERSION`, manifests, tag, or product support matrix. Read §3's external host
channels through the new boundary: Grove owns the package and behavioral
evidence; Stewards owns catalog/provisioner availability and acquisition
evidence; the consumer owns selection and environment prerequisites. A mutable
catalog selector is publication only, not Grove support, release identity, or
effective support.

## Forward annotation — ADR-0034 (2026-07-24)

ADR-0034 supersedes ADR-0033's shared release-certification adoption.
This ADR's Grove-owned version, adapters, surface matrix, evidence, release
validator, and tag workflow remain current. Stewards integration is narrowed
to marketplace-test metadata and CI marketplace/plugin setup authoring.
