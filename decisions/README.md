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
status: ...               # ∈ the state enum in charters/lifecycle.md (the lifecycle companion, adr-0008)
depends_on: [adr-0000-...]   # ids of upstream artifacts this one builds on
owner: agent | human
updated: YYYY-MM-DD
---
```

What each `status` value means, and who moves an artifact between
states, lives in [`charters/lifecycle.md`](../charters/lifecycle.md) —
the lifecycle companion (`adr-0008`) — not restated here.

## Decisions are append-only

**Never edit a ratified (`approved`) decision's substance in place.** To
change one, write a new decision and add a one-line forward pointer at the top
of the old text naming the new decision's `id`. A fully retired decision moves
to `status: superseded` and declares `superseded_by`; for partial supersession
its status remains `approved` and it declares `superseded_in_part_by`, as
defined by the lifecycle companion. No reader should ever land on stale text
without a link forward. This is how "why is it this way?" stays answerable
later — the history is the record, not just the current state.
