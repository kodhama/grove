# specs/

This repo's own specs — contract-layer artifacts for grove's own
tooling or process (e.g., a spec for a future runner-hosted dispatch
mechanism), written by a `contract-author` agent from an approved
decision and never from a draft.

## Artifact contract

Every artifact in this repo (here, `decisions/`, and `charters/`) begins
with YAML frontmatter:

```yaml
---
id: spec-short-slug       # kebab-case, prefixed by type
type: spec                # adr | spec | charter | plan | rubric | ...
status: draft | gated | approved | superseded
depends_on: [adr-0000-...]   # ids of upstream artifacts this one builds on
owner: agent | human
updated: YYYY-MM-DD
---
```

- `draft` — not yet self-checked; not a valid downstream input. An
  `executor` agent never implements against a `draft` spec.
- `gated` — self-checked against its rubric (if any); agent-consumable.
  The `spec-adversary` agent runs against `gated` specs, before a human
  ever sees them.
- `approved` — ratified by human merge (the spec gate — ADR-0009-style
  gate authority — is human, always). Never set by hand.
- `superseded` — retired; a forward pointer names the replacement (see
  `decisions/README.md` for the append-only discipline this inherits).

Every spec must carry `## Acceptance criteria` (checkable) and
`## Open questions` (may be empty, but must exist) — a spec that cannot
say what "done" means is not yet a spec.
