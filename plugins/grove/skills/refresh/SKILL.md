---
name: refresh
description: Bring an installed grove overlay to the current plugin version — re-copy the grove-managed floor verbatim, regenerate the dial-explainer, and bump the AGENTS.md version stamp while maintaining Claude's adapter. Never rewrites consumer-authored prose. Use when the user asks to refresh, update, upgrade, or roll out grove in a repo that already has it. First installs are /grove:setup, not this.
---

# Refresh an installed grove overlay

Setup composes grove's repo-owned floor onto a project once, interactively;
**refresh brings an existing install to the current plugin version,
mechanically.** Since `adr-0026` the agent fleet is plugin-carried
(`grove:<role>`, auto-loaded), so a fleet update is a **plugin update, not a
repo edit** — what refresh maintains in the repo is only the thin floor:

1. **floor re-copy** — the grove-managed machinery, verbatim;
2. **dial-explainer regeneration** — `.grove/README.md`;
3. **stamp bump** — the AGENTS.md `grove plugin@<version>` record (`adr-0026`
   D4), which is where a fleet update gets its in-repo review seam (the PR
   that lands the bump links the release changelog).

The old refresh's three-way charter-merge engine is **retired entirely**
(`adr-0026` D6 — there are no vendored charters left to merge in a
thin-vendor install; the merge class is deleted, not mitigated).

The disciplines are deliberately inverted from setup's: setup asks before
every overwrite (the file might be the consumer's); refresh re-copies the
**grove-managed** surfaces without asking (they are grove's, regenerated on
update — `adr-0018` D5) and **never touches** the consumer-authoritative
ones. When in doubt about a file, treat it as consumer-authoritative and
leave it alone, flagging it in the hand-back.

## 0. Work in a fresh working copy

If there is **any** possibility of in-flight work in the local checkout
(another agent, uncommitted WIP), do the refresh in a **fresh clone or
worktree** — never the shared checkout. The plugin source
(`${CLAUDE_PLUGIN_ROOT}`) is **read-only** throughout.

## 1. Read the installed state — and gate on the install's generation

- **Version stamp:** the `grove plugin@<version>` line inside the
  `grove:begin`/`grove:end` block in `AGENTS.md` or a legacy `CLAUDE.md`.
  Record old → new (new = the `version`
  field of `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`). **Disclose
  the comparison loudly** (`adr-0026` D4) — including the case where the
  stamp already differs from what a collaborator's install would run. An
  older `plugin@<git-sha>` stamp form, or a missing stamp, is a finding, not
  a blocker: proceed and land the current-form stamp.
- **Generation gate — pre-`adr-0026` installs stop here.** If the repo still
  carries a **vendored fleet** (grove role files in `.claude/agents/` —
  charter-length role definitions, possibly locally adapted) or **installed
  companions** (`.grove/lifecycle.md`, `.grove/versioning.md`,
  `.grove/relations.md`, or their `.grove/internal/` forms), this install
  predates the thin-vendor boundary. **Do not half-refresh it**: harvesting
  local charter adaptations into `.grove/config.toml` / `.grove/agents/`
  addenda and deleting the vendored copies is the one-time **D6 migration
  campaign** (grove#116), a reviewed pass of its own, not this skill. Say so,
  point at the campaign, and stop — a stamp bump on an unmigrated layout
  would record a version whose shape the repo doesn't have.
- **What's installed:** gates machinery (`.grove/internal/gates/` +
  `.grove/gates.toml`), the shared config (`.grove/config.toml`), the
  dial-explainer (`.grove/README.md`), and whether the removed pre-`adr-0032`
  status adapter remains at `.claude/skills/grove-status/SKILL.md`. If present,
  flag it as legacy and point to `/grove:remove`; do not maintain or rewrite it.
- **Retired CI check (pre-adr-0027 installs):** a repo may still carry the
  retired review-bookkeeping check — `.grove/internal/check/`, the
  `.github/workflows/grove-review-bookkeeping.yml` workflow,
  `.grove/review.toml`, `.grove/internal/review-wiring.toml`. Refresh **no
  longer maintains those** (grove stopped vendoring CI carriers); do not
  re-copy or update them — flag their presence in the hand-back and point at
  adr-0027 (removal is `/grove:remove`'s check step, the consumer's call).

## 2. The authority split — the load-bearing table

**Grove-managed — re-copy VERBATIM, no asking** (delete files that no longer
exist upstream; never copy grove's `test/` dirs or `test-deps.md`):

| Destination | Source |
|---|---|
| `.grove/internal/gates/{lib,bin,package.json}` | `${CLAUDE_PLUGIN_ROOT}/gates/` |
| `.grove/internal/enforcement.toml` | `reference/gates/enforcement.toml` |

**Grove-managed — regenerate:** `.grove/README.md`, the dial-explainer
(setup step 4's content, citing the companions standard-form with the new
stamp). If the consumer hand-edited it, flag the overwrite in the hand-back —
its own header says it is regenerated.

**Consumer-authoritative — NEVER touch:** `.grove/gates.toml`,
`.grove/config.toml`, the `.grove/agents/` addenda, `.grove/review.toml`
where a pre-adr-0027 install left one, `decisions/`, `specs/`, the repo's own
code and docs, and anything in `.claude/agents/` (a repo's **own** roles live
there — `adr-0026` D5 — and are none of grove's business). A refresh that
"fixes" consumer content is a clobber, not a refresh. Stale `config.toml`
values are the **agents'** job to catch at use time (the D3 verified-prior
posture), never refresh's to rewrite.

**Project entrypoints — deterministic migration:** run setup step 6's bundled
helper with `compose`, then `check`. It updates only Grove's marked block,
migrates a legacy `CLAUDE.md` block into canonical `AGENTS.md`, ensures the
Claude adapter, and preserves unrelated prose. A refusal is a loud stop; never
hand-edit around it.

## 3. Verify — every claim empirically, before handing back

- `node .grove/internal/gates/bin/resolve-profile.mjs .grove/gates.toml`
  exits 0.
- `node --check` passes on the refreshed runtime's entry points (at minimum
  `.grove/internal/gates/bin/resolve-profile.mjs`).
- `git status --short` touches **only**: `.grove/internal/`,
  `.grove/README.md`, `AGENTS.md`, and `CLAUDE.md`. The helper may touch one or
  both entrypoints according to `spec-0004`; anything else is a bug in this
  refresh — fix or revert it.

## 4. Hand back

Setup step 10's restraint applies — **perform no git of your own**: no add,
commit, branch, push, or PR — with one carve-out setup does not have (stated
here as this skill's own rule): when the user has **explicitly directed a
landing** (e.g. "open the PR"), follow their direction exactly and stop at
their gate; never merge. Report: old → new stamp (and the loud D4 disclosure
of any divergence found), every surface re-copied or regenerated, every legacy
piece flagged (pre-adr-0032 status adapter; pre-adr-0027 CI carriers; a
pre-adr-0026 layout means you stopped and pointed at the migration), the
verification results, and — plainly — anything you were unsure of. The
consumer-authoritative surfaces you did not touch are part of the report, not
an omission.
