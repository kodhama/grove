---
id: adr-0033-agents-canonical-project-instructions
type: adr
status: approved
depends_on:
  - adr-0003-managed-block-routing-rule
  - adr-0014-install-is-invisible-and-ungated
  - adr-0026-thin-vendor-boundary
  - adr-0029-non-interactive-loading
owner: human
updated: 2026-07-23
---

# ADR-0033: `AGENTS.md` is the canonical shared project-instruction entrypoint

> **Human intent act (2026-07-23).** The maintainer asked to remove repeated
> project rules and explicitly confirmed that the solution must tell Claude
> where future shared rules are written, not merely make both hosts load them.

## Context

Grove has historically composed its routing rule and plugin-version stamp into
`CLAUDE.md`. Projects that also support Codex have consequently copied the same
content into `AGENTS.md`. The copies load, but they have no authoritative edit
location: an agent can amend either file and silently create drift.

Claude Code supports importing `AGENTS.md` from `CLAUDE.md`. Codex discovers
`AGENTS.md` directly. A shared source with a host adapter therefore serves both
load paths without repeating the rules.

## Decision

### D1. One shared source

`AGENTS.md` is the canonical home for project-wide instructions shared by
Claude Code and Codex. Grove's managed routing block and
`grove plugin@<version>` stamp live there exactly once.

New shared rules are written to unmarked prose in `AGENTS.md`. They are never
copied into `CLAUDE.md`.

### D2. Claude is an adapter

`CLAUDE.md` contains exactly one active `@AGENTS.md` import. It may also contain
genuinely Claude-specific instructions or managed overlays, but shared
instructions do not live there. In Grove's own repository, Trellis's managed
import block remains in `CLAUDE.md`: Codex's documented instruction discovery
does not include Claude's `@file` imports, so moving that block to `AGENTS.md`
would not make its imported content available to Codex.

Grove preserves existing Claude-specific prose byte-for-byte while ensuring the
import. When no Claude-specific prose exists, the whole file is:

```md
@AGENTS.md
```

### D3. Ownership remains explicit

- Grove owns only its marked block, `.grove/README.md`, and
  `.grove/internal/**`.
- A consumer owns unmarked `AGENTS.md` prose, `.grove/config.toml`,
  `.grove/gates.toml`, and `.grove/agents/**`.
- Another overlay may own its own marked block in `AGENTS.md`.
- `CLAUDE.md` is an adapter plus optional Claude-only prose; Grove never treats
  either as shared-rule authority.
- A Claude-only overlay such as Trellis may retain its marked block in
  `CLAUDE.md`; Grove preserves it as unrelated prose.

### D4. Setup and refresh migrate safely

Setup and refresh use one deterministic helper rather than asking an agent to
perform a multi-file prose rewrite.

The helper:

1. refuses unmatched or repeated Grove markers;
2. refuses an `AGENTS.md` → `CLAUDE.md` import cycle;
3. replaces or appends the Grove block in `AGENTS.md`;
4. removes a legacy Grove block from `CLAUDE.md`;
5. collapses byte-identical `AGENTS.md` / `CLAUDE.md` copies to the canonical
   `AGENTS.md` plus the adapter, while moving a valid Trellis managed block
   byte-for-byte to `CLAUDE.md`;
6. preserves all unrelated prose; and
7. is idempotent.

If both entrypoints contain non-identical Grove blocks, the state is ambiguous
and the helper stops without writing.

### D5. Removal is ownership-safe

Removal strips the Grove block wherever a legacy or current installation keeps
it, after the skill's existing human confirmation. It does not remove the
`@AGENTS.md` adapter: shared project instructions or another overlay may still
need it. Empty entrypoint cleanup remains an explicit human decision.

### D6. Current truth and future installs move together

Grove's setup, refresh, remove, documentation, agent references, self-hosted
configuration, and generated consumer dial-explainer all name `AGENTS.md` as
the shared convention/stamp home. Historical decisions retain their rationale
and receive forward pointers where their old `CLAUDE.md` location would
otherwise mislead.

## Alternatives considered

### Keep identical files

Rejected. It makes reading portable but leaves editing ambiguous and permits
silent drift.

### Make `CLAUDE.md` canonical and teach Codex to reference it

Rejected. Codex's native project-instruction entrypoint is `AGENTS.md`; making
it a prose pointer would weaken startup discovery and preserve a
Claude-specific authority boundary.

### Symlink both names to one file

Rejected as the distribution contract. Symlink support and repository handling
vary across platforms; Claude's documented import is explicit and portable.

## Consequences

- Shared rules have one load path and one edit path.
- Claude-specific rules remain possible without contaminating shared policy.
- Legacy consumers migrate during their next setup or refresh.
- Grove gains a small zero-dependency helper and fixture suite because
  cross-file migration is no longer safe as prose-only agent work.
