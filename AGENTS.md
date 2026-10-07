# AGENTS.md — Agent Operating Instructions

**This file is the tool-neutral instruction set for grove.** Claude Code reads
it through the `@AGENTS.md` import atop `CLAUDE.md`; every other agent reads
it directly.

Grove holds kodhama's agent supervision skills (`project-lead`,
`story-worker`, `supervision-setup`, `session-restart`, `context-gauge`) and
the receipt checker, shipped as one plugin for Claude Code and Codex. Other
repos consume them; their routing overrides and bindings stay in those repos.

## Workflow

**Compound Engineering (CE) is the default route for planned work**: reach
for the CE skill whose description fits before hand-building what it already
does (`ce-brainstorm`, `ce-plan`, `ce-work`, `ce-debug`, `ce-doc-review`). The
plugin is declared for both hosts (`.claude/settings.json`,
`.codex/config.toml`), but it must be installed on the machine before a
session sees it. If a skill is absent, do not hand-roll a stand-in: say in
your hand-back that it was unavailable and that step did not run.

**Trellis** rules arrive at session start via the trellis plugin
(hook-driven); `.trellis/rules.toml` selects which are active, and its rows
govern. The rules live in the plugin, not here.

**Write for a reader with ADD.** Applies to anything the maintainer reads:
chat, reports, PRs, issues and comments.

- First line = the point, and what the maintainer needs to do (if anything).
- Short paragraphs, one idea each. Bullets for several items. Bold the key phrase.
- One question at a time, recommendation first.

## The skills are portable

The skills travel into other repos and harnesses. **Keep their text free of
repo paths, tracker names, versions and harness-specific invocations**.
`test/supervision-routing-tables.test.ts` holds the patterns and applies them
to the routing tables and parts of the skill text; it does not yet cover all
of it, so check the rest by eye. A repo binds
the skills to its own tools through its routing overrides, never through
skill text.

## Review loop

**Review runs before the PR, always, sized by scope**: every change gets an
in-session review on the branch before a PR opens. The native single-pass
reviewer (`/code-review` in Claude Code) is the floor; bigger scope escalates
to `ce-code-review` (report-only). The repo's automated GitHub reviewers, the
Codex connector and Gemini Code Assist, are the second round:

- **Gemini** reviews on open and on every push, and skips drafts. **Open a PR
  as a draft while fixes are still landing, and mark it ready when the branch
  is final.** If no review appears once it is ready, comment `/gemini review`.
- **Codex** reviews on open and when a draft is marked ready, and re-reviews
  only when asked: comment `@codex review` after a fix that changes behavior,
  a test, config, or what an instruction tells agents to do.

## Checks that must stay green

`.github/workflows/test.yml` runs its `test` job on every push to `main` and
every PR; `main`'s ruleset makes it a required check once it has first
reported.

| step      | command             |
| --------- | ------------------- |
| typecheck | `npm run typecheck` |
| tests     | `npm test`          |
| secrets   | CI only (gitleaks)  |

Run them locally before pushing. A red is a real failure: fix it, never merge
past it.

## Where work lives

**Linear tracks the work (`GRO-*` in the kodhama workspace); GitHub hosts the
code**, its pull requests and CI.

**A comment an agent writes ends by saying so**: last line, own paragraph, as
literal plain text: `— Posted by <your tool name> (agent session) on behalf
of @<maintainer-handle>.` Comments only: a PR body is covered by its branch and
`Fixes GRO-<n>` line, commits by `Co-authored-by`.

## Branch, commit, and PR rules

- **Branch `feature/gro-<n>-<slug>`**, the shape Linear generates. The
  identifier is what links the PR to Linear.
- **Put `Fixes GRO-<n>` in the PR body** (or `Part of GRO-<n>` when the PR is
  one of several for the issue).
- Conventional Commits; linear history (rebase-merge or squash with a
  hand-edited message).
- **Every change reaches `main` through a PR.** A ruleset on `main` enforces
  it: PR required, review threads resolved, the `test` check green, squash or
  rebase only, no force-push, no deletion. It requires zero approving reviews,
  since a PR author cannot approve their own PR.
- **The maintainer approves every merge**; an agent never merges.
- Code changes are test-first: failing test, then implementation, then green.
- Keep diffs reviewable from a phone: small, focused, well-described.

## What you must NOT do

- Do not invent requirements or broaden focused work: requirements are
  measured against the issue you were given.
- Do not add a dependency without recording the decision under
  `docs/decisions/`.
- Do not commit a secret, a token, a real home path or personal data. Fixtures
  use obvious placeholders such as `/Users/maintainer`.
