---
name: review-preview
description: Preview what the review-bookkeeping check would owe on the current branch BEFORE pushing to CI, and propose remedies (allowlist adds, frontmatter types) from session context. Self-detects whether the check is installed (no-op when absent). Read-only — it proposes policy edits, it never applies an exemption itself. Use before opening or updating a PR whenever the diff adds files outside the artifact dirs, or whenever the owed-map is in doubt.
---

# Preview the owed-map locally + propose remedies

The bookkeeping check's red-list is most useful **before** CI sees it
(grove#108: `.trellis/` overlay files hitting math-quest CI with ~16 owed
rows was the motivating friction). This skill runs the same computation
CI runs — offline, over an empty record stream — and turns the raw rows
into **classified suggestions**, using what you (the session agent)
already know about the change's intent. It moves the existing CI
allowlist-remedy hint earlier and extends it to the cases CI's hint
cannot cover (typed/unclaimed-frontmatter files).

## 0. Self-detect + locate the runtime

Same discipline as `record-verdict`: the install discriminator is
**policy presence on the protected default branch** (`adr-0014`) —
**never machinery-file presence** (a missing runtime with policy present
is `adr-0013`'s carrier-red state, where CI still gates).

- **First, the policy question** (protected branch only, never PR
  HEAD/working tree): `git show origin/<default>:charters/review-policy.md`
  contains a `grove-review-policy` block (grove-self), else
  `git show origin/<default>:.grove/review.toml` exists (consumer,
  `adr-0018` D10). **Absent** → **not installed** → say plainly
  "bookkeeping check not installed on `<default>` — nothing owed;
  preview skipped" and stop. **Cannot read** (no remote, git failure) →
  fail loudly and stop — never fold a read failure into the no-op.
- **Policy present → the check gates.** Now locate the preview runtime:
  **consumer** — the `check_runtime_dir` in
  `.grove/internal/review-wiring.toml` (default `.grove/internal/check/`),
  entry `node <runtime>/bin/preview.mjs`; **grove-self** —
  `node plugins/grove/check/bin/preview.mjs`.
- **Policy present but the runtime or its `bin/preview.mjs` is absent**
  (an older or broken install): say "**cannot preview** — the installed
  runtime is missing or predates the preview; **the check still gates
  on CI**; suggest a grove refresh" and stop. **Never** say "nothing
  owed" here — that would be a false pre-push green in exactly the
  carrier-red state. Do NOT improvise a substitute (the CI entry needs
  a PR + token and is not this preview).
- If the bin itself reports not-installed (its own `adr-0014`
  bootstrap), relay that and stop.

## 1. Run the preview

```
node <runtime>/bin/preview.mjs [--default-branch <name>] [--json]
```

- It previews **committed content** (`origin/<default>...HEAD`,
  merge-base, same as CI). Uncommitted work is invisible — if the
  working tree is dirty, say so and preview anyway (or ask to commit
  first when the dirty files are the point).
- Exit 0 with red rows is the NORMAL informative outcome, not an error.
  Exit 2 is a hard error (unresolvable default branch, malformed
  protected policy) — surface it, don't work around it.

## 2. Classify every owed row — with context, into exactly one bucket

For each subject file in the owed rows, judge from the diff, the file's
content, and what this session knows about the change's intent:

1. **Genuinely owed** — artifact-class content (decisions/specs/charters,
   ledgered code, anything with an `implements:` upstream). The row is
   the methodology working. Say which reviews to expect and move on —
   never propose exempting these.
2. **Type it** — the file IS a methodology artifact but its frontmatter
   is missing/unclaimed (`__untyped__` or a type no reviewer declares),
   so it fail-closed-owes the FULL review set. The remedy is the right
   `type:` (or a `reviewless_types` entry if the type is genuinely
   reviewless), not an allowlist add.
3. **Allowlist candidate** — orientation/overlay prose: README-class
   files, methodology overlays (`.trellis/*.md`), install scaffolding —
   prose-shaped (`.md/.txt/.rst`, no shebang), no `implements:`
   upstream, and its content does not *bear behavior* this project's
   reviews are meant to gate. Propose the exact
   `non_behavioral_allowlist` entries (explicit per-file paths — the
   predicate accepts no globs/directories).
4. **Not exemptible — say it plainly** — non-prose files (`.toml`,
   extensionless, code) that are also not genuinely reviewable
   artifacts. The allowlist cannot cover them (INV14: never a
   review-free zone for non-prose). State the honest options: post a
   real review record, or accept the advisory red. Never bend bucket 3
   to swallow them.

When unsure between buckets, prefer 1 (owed) — the fail-closed default
is the check's own posture.

## 3. Propose — never apply silently

- Draft the policy edit as a **diff for the human**: consumer →
  `.grove/review.toml`; grove-self → `charters/review-policy.md`. Show
  it, explain each entry in one line, and let the human land it.
- **Inline array only** for `.grove/review.toml`: installed runtimes may
  predate grove#92's multi-line parser fix; a multi-line array
  hard-errors there. Keep the list on one line.
- Say the guardrail out loud when proposing: the allowlist is a
  human-owned per-file add (spec-0002 INV14) — the policy edit itself
  goes through a PR the check reds fail-closed until it merges on the
  protected branch. **This skill proposes; the human's merge approves.**
- Policy is read from the protected branch, so the exemption takes
  effect only **after** the policy PR merges — sequence the policy PR
  first when the goal is greening a busy PR.

## 4. Report

One compact summary: N changed files → M owed rows; per bucket, the
files and the proposed action; the drafted policy diff (if any); and
what will STILL be red after the remedies (bucket 4 + bucket 1) so CI
holds no surprises.
