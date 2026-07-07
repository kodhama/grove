# charters/

The portable role charters — what grove actually ships. Each file
charters one gardener: what it is, its method, its boundaries, and (where
the role needs a project-specific value) an explicit placeholder for the
consuming project to fill in. These are narrative artifacts; their
executable counterparts — ready-to-drop-in Claude Code subagent
definitions generated from the same charters — live in
[`.claude/agents/`](../.claude/agents/).

## Artifact contract

Every artifact in this repo (here, `decisions/`, and `specs/`) begins with
YAML frontmatter:

```yaml
---
id: charter-role-slug     # kebab-case, prefixed by type
type: charter
status: draft | gated | approved | superseded
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

## The placeholder door

A charter is written to be **cold-started in any consuming project**, so
it never hardcodes a project-specific value. Where the role genuinely
needs one (a test command, a spec path, a parked-item store, an issue
tracker convention), the charter declares an explicit placeholder —
angle-bracketed, e.g. `<TYPECHECK_CMD>` — instead of quietly assuming a
default. The consuming project fills the placeholder in; nothing in a
charter is a silent assumption about the host repo. This is the
signature-pair door: a role's charter must be writable, and read as
correct, **without** any noun specific to the project it was lifted from.

## Provenance

These charters generalize the role definitions chartered in ADR-0030
("Espalier: the gardener swarm") from the project grove was lifted
out of, plus that project's own operating sections (dispatch contract,
workflows W1–W6, bug-pipeline roles, checkpoint-resume). Where a charter
cites that lineage, it cites the ADR id or "the source project" — never
the project's own name or product nouns (self-checked: see the repo
root's acceptance grep).
