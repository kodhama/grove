# charters/

The portable role charters — what grove actually ships. Each file
charters one agent: what it is, its method, its boundaries, and (where
the role needs a project-specific value) an explicit config token the
consuming repo resolves (`adr-0026` D3, below). These are narrative
artifacts; their executable counterparts — the Claude Code subagent
definitions generated from the same charters, auto-loaded as
`grove:<role>` wherever the grove plugin is enabled — live in the
plugin payload, [`plugins/grove/agents/`](../plugins/grove/agents/).
The two are a **two-copy lockstep** (`adr-0026` P1, ex `adr-0021` D4):
a charter edit updates its payload counterpart in the same PR.

One file, [`grove-status.md`](grove-status.md), charters a skill rather
than an agent role — the shared runtime-telemetry contract every role
composes into its own work. It has no agent-payload counterpart and
no pipeline stage; its own charter says so explicitly rather than
forcing the "one file, one agent" shape above onto it. Another,
[`lifecycle.md`](lifecycle.md), is the lifecycle companion (`adr-0008`)
— the artifact state enum, stated once and shipped in the plugin
payload under the version stamp (`adr-0026` D7) — not a role either.

## Artifact contract

Every artifact in this repo (here, `decisions/`, and `specs/`) begins with
YAML frontmatter:

```yaml
---
id: charter-role-slug     # kebab-case, prefixed by type
type: charter
status: ...               # ∈ the state enum in lifecycle.md (the lifecycle companion, adr-0008)
depends_on: [...]         # ids of upstream artifacts this one builds on
owner: agent | human
updated: YYYY-MM-DD
---
```

Charters in this wave are `status: gated` — self-checked against the
acceptance grep (below) and against their source material, but not yet
independently reviewed by a human or a `spec-adversary` pass. They carry
`owner: agent` (the source project's convention: `owner:` means *author*;
the accountable human is the repo maintainer, recorded once here rather
than swept across every file).

## The config-token door (`adr-0026` D3 — supersedes the placeholder door)

A charter is written to be **cold-started in any consuming project**, so
it never hardcodes a project-specific value. Where the role genuinely
needs one (a test command, a spec path, a parked-item store, an issue
tracker convention), the charter declares an explicit token —
angle-bracketed, e.g. `<TYPECHECK_CMD>` — instead of quietly assuming a
default. Tokens resolve **at use time** from the consuming repo's shared
config file, `.grove/config.toml` (key = the token name), plus an
optional per-role addendum `.grove/agents/<role>.md` for local rules
and worked examples — both consumer-authoritative: `/grove:setup` seeds
them, grove never clobbers them. Every resolved value is a **verified
prior, not ground truth**: a role verifies it on use and, on mismatch,
discloses loudly and routes a fix to the config file — never a silent
substitution; absent a value, it self-detects and discloses. An honest
"none exists yet" is a value, not a gap. Nothing in a charter is a
silent assumption about the host repo — a role's charter must be
writable, and read as correct, **without** any noun specific to the
project it was lifted from.

## Provenance

These charters generalize the role definitions chartered in ADR-0030
("Espalier: the gardener swarm") from the project grove was lifted
out of, plus that project's own operating sections (dispatch contract,
workflows W1–W6, bug-pipeline roles, checkpoint-resume). Where a charter
cites that lineage, it cites the ADR id or "the source project" — never
the project's own name or product nouns (self-checked: see the repo
root's acceptance grep).
