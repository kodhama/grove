---
name: refresh
description: Bring an existing grove install up to the current plugin version — re-copy the grove-authoritative surfaces verbatim, port template resolutions, migrate a pre-adr-0018 layout, and never touch a consumer-authoritative file. Use when the user asks to refresh, update, upgrade, or roll out grove in a repo that already has it. First installs are /grove:setup, not this.
---

# Refresh an installed grove overlay

Setup composes grove onto a project once, interactively; **refresh brings
an existing install to the current plugin version, mechanically.** The
disciplines are deliberately inverted: setup asks before every overwrite
(non-clobber, the file might be the consumer's); refresh re-copies the
grove-authoritative surfaces **without asking** (they are grove's, vendored,
regenerated on update — `adr-0018` D5) and **never touches** the
consumer-authoritative ones. Everything in this skill hangs off that
authority split — when in doubt about a file, treat it as
consumer-authoritative and leave it alone, flagging it in the hand-back.

Provenance: distilled from the 2026-07-21 fleet rollout (math-quest
refresh + trellis/wisp/design-system layout migrations), the third
hand-derived refresh — the repetition that justified this skill.

## 0. Work in a fresh working copy

If there is **any** possibility of in-flight work in the local checkout
(another agent, uncommitted WIP), do the refresh in a **fresh clone or
worktree** — never the shared checkout. The plugin source
(`${CLAUDE_PLUGIN_ROOT}`) is **read-only** throughout.

## 1. Read the installed state

- **Version stamp:** the `grove plugin@<sha>` line inside CLAUDE.md's
  `grove:begin`/`grove:end` block. Record old → new
  (`git -C "${CLAUDE_PLUGIN_ROOT}" rev-parse --short HEAD`; `unknown` if
  not a checkout — an honest stamp beats none). A missing stamp is a
  finding, not a blocker: proceed by content-diff and **add** the stamp.
- **Layout generation:** companions at `.grove/` **root** = pre-`adr-0018`
  → step 4 (migration) applies. Companions under `.grove/internal/` =
  modern → skip step 4.
- **What's installed:** which roles in `.claude/agents/`, whether the
  check is installed (`.grove/internal/check/` + the workflow +
  `.grove/review.toml`), whether gates machinery exists
  (`.grove/internal/gates/` + `.grove/gates.toml`), and whether the
  optional telemetry skill is installed
  (`.claude/skills/grove-status/SKILL.md` — setup step 9).

## 2. The authority split — the load-bearing table

**Grove-authoritative — re-copy VERBATIM, no asking** (delete files that
no longer exist upstream; never copy grove's `test/` dirs or
`test-deps.md`):

| Destination | Source |
|---|---|
| `.grove/internal/check/{lib,shell,bin,package.json}` *(if check installed)* | `${CLAUDE_PLUGIN_ROOT}/check/` |
| `.grove/internal/gates/{lib,bin,package.json}` | `${CLAUDE_PLUGIN_ROOT}/gates/` |
| `.grove/internal/enforcement.toml` | `reference/gates/enforcement.toml` |
| `.grove/internal/{lifecycle,versioning,relations}.md` | `reference/{lifecycle,versioning,relations}.md` — strip a first-line `<!-- vendored from … -->` comment |

**Resolved-template class — diff the template; if it changed, re-copy it
re-applying the resolutions the install already made** (read the resolved
values out of the currently-installed file; the resolutions are the
consumer's, the template is grove's):

- `.github/workflows/grove-review-bookkeeping.yml` *(if check installed)* —
  resolutions: `<INSTALL_PATH>`, `<NODE_VERSION>`.
- `.grove/internal/review-wiring.toml` *(if check installed)* —
  resolutions: the two carrier-path keys.
- `.claude/skills/grove-status/SKILL.md` *(if the telemetry skill is
  installed — setup step 9)* ← `reference/skills/grove-status/SKILL.md`,
  vendoring header stripped — resolution: `<WISP_VENDOR_PATH>`, read from
  the installed copy; drop its `## Placeholders` section once resolved
  (setup step 9's closing instruction — the reference copy carries one).

**Agent charters (`.claude/agents/`) — the same idea, per role:**

- A role whose reference charter is **unchanged** since the installed
  version: leave the installed copy **byte-untouched**.
- A role whose reference charter **changed**: **three-way merge, never a
  blind re-copy** — base = the reference charter at the *installed*
  version, local = the installed copy, remote = the current reference
  (e.g. `git merge-file`; header-stripped throughout). The reason: an
  installed charter may carry **non-token local adaptations** (project
  idioms, worked examples, localized rules) that "new text + token
  re-application" silently drops — a lossy path two repos hit in the
  2026-07-21 rollout (design-system's pinned-tag rule; wisp's
  machinery-absent adaptations). Resolve conflicts with **upstream
  winning where content genuinely competes** (the reference is grove's),
  local adaptations kept where they merely extend; re-apply token
  values; drop `## Placeholders`. **Flag every conflict resolution and
  every kept local adaptation in the hand-back.** *(No stamp / the
  installed-version reference unavailable → fall back to a careful
  two-way diff of installed vs current reference, same flagging.)*
- A role **added** upstream since the install: copy it in, resolve every
  `<[A-Z_]+>` token — **port-first** (the same token's resolved value in
  this repo's other installed roles), else **derive** from the repo's own
  conventions (package.json scripts, docs), else the honest explicit
  *"none exists yet — flagged rather than silently assumed"* statement
  (setup step 3's idiom). Drop `## Placeholders` once resolved.
- **Grove-self-relative paths are not tokens but still need adapting:**
  a reference charter may carry paths that only resolve in the grove repo
  itself (e.g. `plugins/grove/check/lib/…`, a bare `charters/…` file). A
  verbatim copy would dangle in the consumer. Adapt each: an installed
  counterpart exists → the install-layout path (`.grove/internal/check/…`);
  grove-only content → the absolute grove URL (the grove#55 convention).
  **Flag every such adaptation in the hand-back** — it is a judgment,
  not a copy. *(Surfaced by the auditor charter in the 2026-07-21
  rollout, math-quest #329.)*
- `.claude/agents/README.md`: update the roster prose; keep the
  repo-specific resolved prose.
- Removing a role the consumer chose at setup is **not** refresh's call —
  refresh adds and updates, never subtracts roles.

**Consumer-authoritative — NEVER touch:** `.grove/gates.toml`,
`.grove/review.toml` (including its allowlist), `decisions/`, `specs/`,
the repo's own code and docs — with exactly one carve-out: step 4's
**migration repointing** edits consumer files, but only the stale
old-root companion paths in them, each edit listed in the hand-back. A
refresh that "fixes" any other consumer content is a clobber, not a
refresh.

**CLAUDE.md — managed block only:** update the roles phrase and the
`grove plugin@<sha>` stamp **between the markers**, nothing else. Setup
step 6's discipline verbatim: pre-edit copy first; after, exactly one
`grove:begin` and one `grove:end`, and a diff against the pre-edit copy
showing changes only between them. A misfire fires `adr-0003`'s trigger —
report it, never leave a mangled CLAUDE.md.

## 3. Placeholder hygiene

When step 2 is done: `grep -rn '<[A-Z_]\+>' .claude/agents/` must return
**zero** matches. A leftover token is an unfinished refresh, not a nit.

## 4. Layout migration (pre-`adr-0018` installs only)

- Delete the root companions (`.grove/lifecycle.md`, `.grove/versioning.md`,
  `.grove/relations.md`); land fresh copies in `.grove/internal/` (step 2
  table).
- **Update every pointer:** `grep -rn '\.grove/\(lifecycle\|versioning\|relations\)'`
  across the repo (excluding `.git`) and repoint each old-root reference
  to `.grove/internal/…`. List every updated pointer in the hand-back;
  flag an ambiguous one rather than guessing.
- If the install predates the gates machinery entirely (no
  `.grove/internal/gates/`, no `.grove/gates.toml`): install it per setup
  step 2a — the machinery copies are mechanical, but the **preset choice
  is the consumer's** (ask, `steward` default — this is the one
  interactive moment a migration can have; a plain refresh has none).
  Validate with `node .grove/internal/gates/bin/resolve-profile.mjs
  .grove/gates.toml` → exit 0.

## 5. Verify — every claim empirically, before handing back

- `node .grove/internal/gates/bin/resolve-profile.mjs .grove/gates.toml`
  exits 0.
- `node --check` passes on the refreshed runtime's entry points (at
  minimum `check/bin/check.mjs`, `check/bin/preview.mjs`,
  `gates/bin/resolve-profile.mjs` — those that exist).
- *(check installed)* The refreshed runtime parses this repo's own policy
  (`parseToml` over `.grove/review.toml` succeeds), and the live proof:
  `node .grove/internal/check/bin/preview.mjs` runs exit-0 and prints the
  branch's owed-map — the refreshed machinery working on the very change
  that refreshes it.
- Placeholder grep (step 3) returns zero.
- `git status --short` touches **only**: `.grove/`, `.claude/agents/`,
  `.claude/skills/grove-status/` (if the telemetry skill was refreshed),
  CLAUDE.md, the workflow file (if re-copied), and step-4 pointer files.
  Anything else in the diff is a bug in this refresh — fix or revert it.

## 6. Hand back

Setup step 12's restraint applies — **perform no git of your own**: no
add, commit, branch, push, or PR — with one carve-out setup does not
have (stated here as this skill's own rule, not attributed to setup):
when the user has **explicitly directed a landing** (e.g. "open the
PR"), follow their direction exactly and stop at their gate; never
merge. Report: old →
new stamp, every surface re-copied, every template re-resolution and
ported value, every added role with each token's resolution provenance
(port / derive / honest-absent), every pointer updated by a migration,
the verification results, and — plainly — anything you were unsure of.
The consumer-authoritative surfaces you did not touch are part of the
report, not an omission.
