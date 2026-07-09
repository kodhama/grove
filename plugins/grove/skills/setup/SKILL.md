---
name: setup
description: Compose grove onto this project — pick which agent roles to install, resolve every placeholder to this project's real conventions, and wire the managed CLAUDE.md block (augment-never-clobber). Use when the user asks to set up, add, install, or compose grove in their repo.
---

# Compose grove into this project

You are composing **grove** — a portable agent-swarm operating model — onto the user's project.
This is **composition, not code generation**: you copy vendored, ready-to-run agent definitions
out of this plugin's `reference/` payload and resolve their placeholders to this project's real
values. Nothing here is invented from scratch, and nothing outside what's listed below is touched
(augment, never clobber — the same discipline Trellis's own `/trellis:setup` uses).

## 1. Pick which agent roles to compose

Ask which of the eleven agent roles to install; default to **all eleven** if the user has no
preference. Show the roster (from `${CLAUDE_PLUGIN_ROOT}/reference/agents/README.md`) so they can
pick a subset if they want a lighter install:

`divergent-researcher`, `shaper`, `contract-author`, `spec-adversary`, `executor`,
`conformance-reviewer`, `validator`, `dispatcher`, `run-resumer`, `propagation-remediator`,
`corpus-reviewer`.

## 2. Copy the chosen agent definitions

For each chosen role, copy `${CLAUDE_PLUGIN_ROOT}/reference/agents/<role>.md` into this project's
`.claude/agents/<role>.md`, **stripping the vendoring header** (the first line, a
`<!-- vendored from ... -->` HTML comment — it exists only so the payload inside this plugin stays
traceable to grove's own canonical copy; the file Claude Code loads as a subagent must start with
its `---` frontmatter delimiter, not a comment above it).

Also copy `reference/agents/README.md` into `.claude/agents/README.md` (same header-stripping),
adapted in step 3 below along with everything else. If any chosen role's file already exists at the
destination, **never overwrite it silently** — ask the user whether to overwrite, skip, or diff
first, and honor their answer per file.

## 3. Resolve every placeholder, interactively

Grep the freshly copied files for every remaining angle-bracket placeholder:

```sh
grep -rn '<[A-Z_]\+>' .claude/agents/
```

This project's copies carry these tokens (not all appear in every file):

| Token | Appears in | What to ask |
|---|---|---|
| `<TEST_CMD>` | `executor.md`, `conformance-reviewer.md` | this project's test command |
| `<TYPECHECK_CMD>` | `executor.md`, `conformance-reviewer.md` | this project's typecheck command (or "none — untyped" if genuinely none) |
| `<PR_CONTRACT_SECTIONS>` | `conformance-reviewer.md`, `propagation-remediator.md`, `run-resumer.md` | which sections a PR body must carry (e.g. `## Propagation`, `## Recommended next task`) — first ask which VCS/host and issue tracker this project uses (GitHub PRs, GitLab MRs, plain git + no tracker, …), since the answer shapes how this resolves |
| `<PARKED_ITEM_STORE>` | `conformance-reviewer.md`, `propagation-remediator.md` | where this project tracks deferred/parked items (a TODO/ROADMAP file, a `decisions/` entry, issue labels, …) |
| `<SPEC_RUBRIC_PATH>` | `contract-author.md` | this project's spec-quality rubric path |
| `<RESEARCH_RUBRIC_PATH>` | `divergent-researcher.md` | this project's research-quality rubric path |
| `<ARTIFACT_DIRS>` | `corpus-reviewer.md` | this project's corpus directories (family default: `decisions/`, `specs/`; add what the project keeps) |
| `<ARTIFACT_CONTRACT_PATHS>` | `corpus-reviewer.md` | where this project declares its artifact contract (family default: `decisions/README.md` + `specs/README.md`) |
| `<REPO_TYPED_CHECKS>` | `corpus-reviewer.md` | any repo-typed extra checks this project declares beyond the family core ("none" is a valid resolution) |

Ask about each token **once** (the same answer applies everywhere it appears), then edit it inline
in every file that carries it — the resolved value replaces the token, in place, in running prose.

**Where the project genuinely has no such convention, write an explicit honest statement instead of
inventing process** — e.g. "this project has no CI-enforced PR-body contract as of this writing (no
`.github/workflows`, no PR template) — flagged here rather than silently assumed; check this by hand
until one exists." This is not a fallback of last resort — it is the correct resolution whenever the
convention genuinely doesn't exist yet. The precedent for this exact move is
[wisp's own B4 install](https://github.com/kodhama/wisp) (grove composed onto wisp itself,
lane B4 of the suite-lift plan): several of its resolved placeholders read exactly this way.

**`.claude/agents/README.md` needs the same treatment, but in prose, not tokens.** Its own text
mentions placeholder tokens illustratively (e.g. "angle-bracketed tokens like `<TEST_CMD>`") — once
real values are resolved, rewrite that sentence to describe what was resolved (test command,
typecheck command, spec-rubric path, parked-item store, PR-contract sections, and so on — named in
words, not repeating the bracket syntax) rather than leaving a literal token sitting in a file that
claims to be fully resolved. Follow wisp's own vendored `README.md` as the model for this rewrite.

**Zero literal `<[A-Z_]+>` markers may remain in `.claude/agents/` when this step is done.** Re-run
the grep above to confirm.

## 4. Drop the `## Placeholders` section from each resolved file

Once a file's placeholders are all resolved inline, delete its trailing `## Placeholders` section
entirely (the wisp/math-quest precedent: a fully resolved file doesn't carry a section listing
tokens that no longer exist in it).

## 5. Seed minimal `decisions/` and `specs/` stores, if missing

If this project has no `decisions/README.md` or `specs/README.md`, seed minimal ones — model:
grove's own (`decisions/README.md`, `specs/README.md` in the grove repo). Each should cover: the
shared artifact frontmatter (`id/type/status/depends_on/owner/updated`), the four `status` values
(`draft → gated → approved (→ superseded)`) and who moves an artifact between them, and — for
`decisions/` — the append-only rule (never edit a ratified decision in place; supersede with a
forward pointer). Adapt, don't invent a heavier process than grove's own.

## 6. Compose the managed block into `CLAUDE.md`

Append this block to the project's `CLAUDE.md` (create the file if it doesn't exist). Touch
**nothing else** in the file. Fill in `<ROLES_LIST>` with the roles actually installed (e.g. "all
eleven roles" or a named subset) and `<SHA>` with the output of
`git -C "${CLAUDE_PLUGIN_ROOT}" rev-parse --short HEAD` (if that command fails — not a git checkout
— use `unknown`; an honest stamp beats none):

```
<!-- grove:begin (managed by grove — edit .claude/agents/, not this block) -->
This project is **grove-managed**: work items run as grove runs, sequenced through the
chartered agent roles in `.claude/agents/` (<ROLES_LIST>).
grove plugin@<SHA>
<!-- grove:end -->
```

If a `grove:begin … grove:end` block already exists (a re-run), **replace only what is between the
markers** — idempotent, never a second block, never a change outside the markers.

## 7. Telemetry (optional — grove never requires it)

Ask whether [wisp](https://github.com/kodhama/wisp) is vendored or otherwise available in this
project.

- **If yes:** copy `${CLAUDE_PLUGIN_ROOT}/reference/skills/grove-status/SKILL.md` into this
  project's `.claude/skills/grove-status/SKILL.md` (stripping the vendoring header, same as step 2),
  resolve `<WISP_VENDOR_PATH>` to wherever wisp actually lives in this project (e.g. `tools/wisp/`,
  or `.` if this project *is* wisp), and drop its own `## Placeholders` section once resolved.
- **If no:** don't install the skill. Mention `github.com/kodhama/wisp` as where it lives if they
  want live dashboard telemetry later, and move on — grove's agent roles work fully without it.

## 8. Recommend, don't install, Trellis

Close by telling the user grove pairs with the governance layer it runs under, but do **not**
install it yourself:

> grove composes the swarm; [Trellis](https://github.com/kodhama/trellis) is the governance layer
> it runs under. If you want that too: `/plugin install trellis@kodhama` then `/trellis:setup`.
> Recommended, not required — grove works standalone.

## 9. Confirm

Tell the user exactly what you wrote: which roles landed in `.claude/agents/` (and which existing
files, if any, you skipped rather than overwrote), every placeholder you resolved and to what value
(or the honest "none exists yet" statements you wrote instead), whether `decisions/`/`specs/` were
seeded, the `CLAUDE.md` block, and whether the telemetry skill was composed. They can remove all of
it any time with `/grove:remove`.
