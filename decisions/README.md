# decisions/

This repo's own architecture decision records (ADRs) — the intent-layer
artifacts for grove itself (naming, role boundaries, workflow changes,
lift/supersession pointers to and from the source project's ADR-0030).

## Artifact contract

Every artifact in this repo (here, `specs/`, and `charters/`) begins with
YAML frontmatter:

```yaml
---
id: adr-000x-short-slug   # kebab-case, prefixed by type
type: adr                 # adr | spec | charter | plan | rubric | ...
status: draft | gated | approved | superseded
depends_on: [adr-0000-...]   # ids of upstream artifacts this one builds on
owner: agent | human
updated: YYYY-MM-DD
---
```

- `draft` — not yet self-checked; not a valid downstream input.
- `gated` — self-checked against its rubric (if any); agent-consumable.
- `approved` — ratified by human merge. Never set by hand.
- `superseded` — retired; a forward pointer names the replacement.

## Decisions are append-only

**Never edit a ratified (`approved`) decision in place.** To change one:
write a new decision, mark the old one `status: superseded` (or
`superseded in part` for a partial change), and add a one-line forward
pointer at the top of the superseded text naming the new decision's `id`.
No reader should ever land on stale text without a link forward. This is
how "why is it this way?" stays answerable later — the history is the
record, not just the current state.
