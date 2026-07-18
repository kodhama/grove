---
name: remove
description: Remove grove from this project — delete the composed agents/skill, strip the managed CLAUDE.md block, and ask before deleting anything, touching nothing else. Use when the user asks to remove, uninstall, undo, or take out grove from their repo.
---

# Remove grove from this project

Cleanly reverse what `/grove:setup` composed. This is augment-never-clobber **in reverse**: remove
only what grove added, asking before any deletion, and preserve everything else byte-for-byte.

## 1. Find what was composed

List the agent files present in `.claude/agents/` (the thirteen possible roles:
`divergent-researcher`, `shaper`, `decision-adversary`, `contract-author`, `spec-adversary`,
`executor`, `conformance-reviewer`, `code-reviewer`, `validator`, `dispatcher`, `run-resumer`,
`propagation-remediator`, `corpus-reviewer`, plus their `README.md`), and check whether
`.claude/skills/grove-status/` exists. Also check whether the **GitHub bookkeeping check** was
installed — whether via setup step 7 or the standalone `/grove:check-install`, both write the same
pieces: the `.grove/internal/check/` runtime directory, the workflow file
`.github/workflows/grove-review-bookkeeping.yml`, and `.grove/review-policy.md`.

Also look for the **tooling-ignore entry** setup (or `/grove:check-install`) may have added: a
`.grove/` line (or a `.grove/**` glob) in any of the consumer's ignore files — `.eslintignore`,
`.prettierignore`, `.markdownlintignore`, the `ignores` field of `eslint.config.*`, or the
`files.ignore` array in `biome.json`. Setup writes this only with consent, so it may not be present;
find it if it is (step 6 reverses it).

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

## 5. Remove the GitHub bookkeeping check, if installed

If the check was installed (setup step 7 or `/grove:check-install` — same pieces either way),
reverse exactly those three pieces (augment-never-clobber in reverse — remove only what the
install wrote, and **ask before deleting anything unexpected**):

- **`.grove/internal/check/`** — the vendored check runtime. Safe to delete if it matches the vendored copy;
  if the user has hand-edited it, ask before removing. (Zero deps were installed, so there is no
  `node_modules` to clean up.)
- **`.github/workflows/grove-review-bookkeeping.yml`** — the workflow file. Remove **only** this
  file; **touch no other workflow** in `.github/workflows/`. If the directory is left empty and
  grove created it, removing the empty directory is fine; if it holds other workflows, leave it.
- **`.grove/review-policy.md`** — the policy carrier. This file also holds the install-recorded
  `scope` mode and the `check_runtime_dir` / `check_workflow_path` carrier keys (`adr-0013`), so
  deleting it removes the recorded scope choice with it — nothing else carries those keys, and
  nothing further needs cleaning up for them. If the user has since edited its `artifact_dirs` /
  allowlist / `reviewless_types` / `scope` for their own corpus, **ask first** (same as step 2)
  rather than discarding their tuning; an untouched install-written copy is safe to remove on
  confirmation.

Leave the rest of `.grove/` (the `internal/lifecycle.md` / `internal/versioning.md` / `internal/relations.md` companions,
handled with the agents above) exactly as it was. If the check was never installed, skip this step.

## 6. Strip the `.grove/` tooling-ignore entry, if setup added one

The symmetric inverse of setup's step 8 (**augment-never-clobber in reverse**): if setup added a
`.grove/` (or `.grove/**`) line to any linter/formatter ignore — the entries found in step 1 —
offer to remove it, and on a **yes** remove **only that one line**, touching **nothing else** in the
file. Discipline, per ignore file:

- Remove **only** the `.grove/` entry setup wrote; every other ignore line the user maintains stays
  exactly as it was.
- If setup **created** a dedicated ignore file solely to hold that line (e.g. a `.prettierignore`
  or `.markdownlintignore` that now contains only `.grove/`), removing the now-empty file is fine on
  confirmation; if the file holds other entries, leave the file and strip only the one line.
- If a `.grove/` line's origin is unclear (the user may have added it themselves), **ask rather than
  delete** — same discipline as step 2. If no such entry exists, skip this step.

## 7. Confirm

Tell the user exactly what you removed (which agent files, the `grove-status` skill if present, the
GitHub bookkeeping check pieces — `.grove/internal/check/`, the workflow, `.grove/review-policy.md` — if they
were installed, any `.grove/` tooling-ignore line stripped and from which file, and the `CLAUDE.md`
block). If nothing was present, say so plainly — **do not invent changes**.
