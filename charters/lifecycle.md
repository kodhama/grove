---
id: charter-lifecycle
type: charter
status: gated
depends_on: [adr-0008-lifecycle-enum-companion]
owner: agent
updated: 2026-07-12
---

# lifecycle — the artifact state enum, stated once

> Provenance: created per `adr-0008-lifecycle-enum-companion`
> (2026-07-12), which resolved where the lifecycle enum lives once no
> repo restates it: a dedicated companion artifact, shipped in the
> payload. Canonical here, vendored to
> `plugins/grove/reference/lifecycle.md`, installed by `/grove:setup`
> to each consuming project's `.grove/lifecycle.md` (grove's own inert
> namespace — not Claude Code's `.claude/agents/` loader directory;
> `adr-0008` as amended 2026-07-12).

> **This file is not an agent role.** Like `grove-status.md`, it has no
> pipeline stage and is never dispatched. It is the methodology
> statement every role — and the `corpus-reviewer`'s
> lifecycle-membership check — sources instead of a per-repo
> restatement. Every other statement of the enum, in grove itself or in
> a consuming project, is a pointer to this file, never a copy.

## The state enum

Every artifact in a grove-managed corpus (`decisions/`, `specs/`, and
kindred record directories) declares a `status`, and that status is one
of exactly four values, in transition order:

`draft → gated → approved → superseded`

## What each state means

- **`draft`** — not yet self-checked; **not a valid downstream input**.
  No role builds on a draft: a `contract-author` never derives a spec
  from a draft decision; an `executor` never implements against a
  draft spec.
- **`gated`** — self-checked by its own author against the relevant
  rubric or acceptance criteria; agent-consumable, but not yet
  independently reviewed. For specs, the `spec-adversary` runs against
  `gated` drafts before a human ever sees them.
- **`approved`** — ratified by a **human intent act** (in review, in
  conversation, or by merging); the status flip records that act. **An
  agent never flips `approved` without a recorded human act**, and no
  artifact's author approves their own work.
- **`superseded`** — retired. A forward pointer at the top of the
  superseded text names the replacement's `id`; the original content is
  never edited away. Terminal.

## Who moves an artifact between states

- **`draft` → `gated`:** the artifact's own author (agent or human),
  immediately after writing it, once every required section for the
  artifact's type is present and the self-check has run and been
  recorded honestly — a failing self-check is listed, never silently
  passed.
- **`gated` → `approved`:** a human — the approval is a human intent
  act, recorded by the status flip; an in-PR flip recording that act is
  legitimate (grove's recorded practice, `adr-0007`'s precedent), and
  the merge is one way to perform the act, not the only way. No PR is
  merged by its own author when the artifact's contract requires human
  approval.
- **`approved` → `superseded`:** whoever proposes the change that makes
  the old artifact obsolete — by writing the new artifact and marking
  the old one `superseded` with a forward pointer. For **partial**
  supersession the old artifact's status stays `approved` and the
  outgrown part carries a forward pointer to its successor — the
  `status` field itself never takes a fifth value. Never by editing the
  old one's content in place.

## Per-type mutability — a pointer, not a copy

Whether an artifact type may be edited in place is a **separate
property**, homed where it already lives; this companion points at it
and does not restate it:

- **Append-only** (decisions): the rule lives in `decisions/README.md`
  — in a consuming project, its own.
- **Revise-in-place** (specs): the rule lives in grove's
  `adr-0004-spec-lifecycle-and-organization`.

## Boundaries

- **Single home.** No grove-managed repo — grove itself included —
  restates the enum-as-set or the four-state semantics; each former
  restatement is a one-line pointer here (`adr-0008`).
- **Not a per-repo dial.** The labels are shared across every artifact
  type and every consuming project; per-type mutability (above) is the
  only per-type variation, and it lives elsewhere.
