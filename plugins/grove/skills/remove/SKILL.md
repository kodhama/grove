---
name: remove
description: Remove grove from this project — delete the composed agents/skill, strip the managed CLAUDE.md block, and ask before deleting anything, touching nothing else. Use when the user asks to remove, uninstall, undo, or take out grove from their repo.
---

# Remove grove from this project

Cleanly reverse what `/grove:setup` composed. This is augment-never-clobber **in reverse**: remove
only what grove added, asking before any deletion, and preserve everything else byte-for-byte.

## 1. Find what was composed

List the agent files present in `.claude/agents/` (the twelve possible roles:
`divergent-researcher`, `shaper`, `contract-author`, `spec-adversary`, `executor`,
`conformance-reviewer`, `code-reviewer`, `validator`, `dispatcher`, `run-resumer`,
`propagation-remediator`, `corpus-reviewer`, plus their `README.md`), and check whether
`.claude/skills/grove-status/` exists.

## 2. Ask before deleting

Show the user the exact list of files you found and ask for confirmation before deleting any of
them. Delete only what they confirm — if they want to keep a role they've since hand-edited or
diverged from the vendored copy, leave it. Do not assume every file in `.claude/agents/` was put
there by grove; if a file's origin is unclear (no way to tell it apart from something the user wrote
themselves), ask rather than delete it.

## 3. Strip the managed block from `CLAUDE.md`

In the project's `CLAUDE.md`, remove the managed block **between and including** these markers:

```
<!-- grove:begin … -->
   … (the grove routing rule + version stamp) …
<!-- grove:end -->
```

Remove **only** that block (and the single blank line that preceded it). **Touch nothing else** —
every other line of the user's `CLAUDE.md` must stay exactly as it was. If, after removal,
`CLAUDE.md` contains only whitespace (grove created the file and nothing else was ever added to
it), delete it; otherwise leave it in place.

## 4. decisions/ and specs/ stores

If `/grove:setup` seeded `decisions/README.md` and/or `specs/README.md` and the user has since
added real decisions/specs into those directories, **do not delete the directories** — ask first,
same as step 2. An empty seeded store with nothing added since is safe to remove if the user
confirms; a store with real content is not grove's to delete.

## 5. Confirm

Tell the user exactly what you removed (which agent files, the `grove-status` skill if present, and
the `CLAUDE.md` block). If nothing was present, say so plainly — **do not invent changes**.
