# charters/

The portable role charters — what grove actually ships. Each file
charters one agent: what it is, its method, its boundaries, and (where
the role needs a project-specific value) an explicit config token the
consuming repo resolves (`adr-0026` D3, below). These are the sole authored
role contracts. Deterministic host projections for Claude Code and Codex live
under [`plugins/grove/`](../plugins/grove/); a charter edit regenerates those
read-through adapters in the same PR (`adr-0031`). The projections are
validated outputs, never a second role corpus.

## Companion charters — not roles

Four files in this directory are **companions**, not role charters. Each
states one methodology grammar once, so no role and no consuming repo
restates it; each is shipped in the plugin payload under the version stamp
(`adr-0026` D7), has no pipeline stage, and is never dispatched:

- [`lifecycle.md`](lifecycle.md) — the artifact state enum (`adr-0008`)
- [`relations.md`](relations.md) — the edge taxonomy (`adr-0011`)
- [`versioning.md`](versioning.md) — the versioning grammar (`adr-0010`)
- [`context.md`](context.md) — the read model and context budget (`adr-0050`)

A companion carries its own shape — the grammar it states, plus provenance —
not the role sections named below; it declares its authoring decision in
`depends_on`. Everything else in this directory is a role charter and follows
the role contract.

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

Each artifact's frontmatter is authoritative for its current lifecycle state
and author. `owner:` means *author*; accountability remains with the repo
maintainer. Do not infer one shared status or owner for the directory.

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
