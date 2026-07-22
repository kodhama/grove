---
name: setup
description: Compose grove's repo-owned floor onto this project — the gate-profile, the shared role config (.grove/config.toml), the dial-explainer, and the managed CLAUDE.md block with the plugin version stamp. The agent roles themselves are plugin-carried (grove:<role>) and are never copied. Use when the user asks to set up, add, install, or compose grove in their repo.
---

# Compose grove into this project

You are composing **grove** — a portable agent-swarm operating model — onto the user's project.
Since `adr-0026` (the thin-vendor boundary), the thirteen agent roles are **plugin-carried**: they
load automatically as namespaced `grove:<role>` subagents wherever this plugin is enabled, so
**setup copies no charter prose and no agent definitions** — there is no role-picking step, and
unused roles are simply inert. What you compose is exactly what the repo owns: the gate-profile
floor, the shared role config, a short dial-explainer, and the managed `CLAUDE.md` block. Augment,
never clobber — the same discipline Trellis's own `/trellis:setup` uses; nothing outside what's
listed below is touched.

## 0. Gate on the install's generation — a pre-`adr-0026` layout stops here

**First runs proceed; a re-run onto an unmigrated (pre-thin-vendor) layout does not.** Before
composing anything, check whether this repo already carries a **pre-`adr-0026` install**: a
**vendored fleet** (grove role files in `.claude/agents/` — charter-length role definitions,
possibly locally adapted; a repo's *own* roles under their bare names are **not** this) or
**installed companions** (`.grove/lifecycle.md`, `.grove/versioning.md`, `.grove/relations.md`, or
their `.grove/internal/` forms). If either is present, this layout predates the thin-vendor
boundary — **do not compose the new-form managed block or bump the stamp (step 6).** A stamp that
records the thin-vendor shape onto a layout that still has the old one is exactly the misrecording
`/grove:refresh` refuses (its step 1 generation gate); setup must refuse it symmetrically rather
than stamp a shape the repo doesn't have. **Stop and route the user to the one-time D6 migration
campaign** (grove#116): harvest local charter adaptations into `.grove/config.toml` /
`.grove/agents/` addenda, delete the vendored copies and installed companions, then setup/refresh
applies normally. A **clean repo** (no vendored fleet, no installed companions) is a first run —
proceed to step 1 unchanged; a current thin-vendor re-run (step 6's re-run path) is likewise fine,
it is only the **pre-`adr-0026`** layout that stops here.

## 1. Orient the user (nothing to pick, nothing copied)

Tell the user the thirteen roles are already loaded as `grove:<role>` subagents by the plugin
itself: `divergent-researcher`, `shaper`, `decision-adversary`, `contract-author`,
`spec-adversary`, `executor`, `conformance-reviewer`, `code-reviewer`, `validator`, `dispatcher`,
`run-resumer`, `propagation-remediator`, `corpus-reviewer`. A role the repo genuinely owns keeps
living in its own `.claude/agents/` under its bare name — namespacing makes coexistence
collision-free (`adr-0026` D5); setup neither adds nor removes anything there.

## 2. The gate-profile floor — every install gets one (`adr-0018`)

The **gate-profile** assigns **C2** — who is *required* at each of grove's four
gates (`intent` / `spec` / `build` / `ship`), `human` or `agent` — and is core,
not optional. Three pieces:

1. **The floor-guard machinery.** Copy `${CLAUDE_PLUGIN_ROOT}/gates/` — its
   `lib/`, `bin/`, and `package.json` — into this project's
   **`.grove/internal/gates/`** (grove-authoritative; regenerated on refresh).
   Zero-dependency, so **no `npm install`**. Do **not** copy grove's own `test/`
   dir or `test-deps.md`. This is the load-time floor-guard (`adr-0018` D8):
   whatever sequences a run reads `.grove/gates.toml` through
   `node .grove/internal/gates/bin/resolve-profile.mjs` and gets a `guardian`
   fallback + loud warning on any missing / unreadable / floor-violating profile.

2. **The C1 enforcement defaults.** Copy
   `${CLAUDE_PLUGIN_ROOT}/reference/gates/enforcement.toml` into
   **`.grove/internal/enforcement.toml`** (grove-managed C1; `adr-0018` D4 — the
   profile configures only C2, C1 is grove-fixed and not a user surface).

3. **The gate-profile itself — ask ONE optional question, then write the rows.**
   The preset choice is an **optional question with `steward` as the default** —
   **never a forced pick** (honors `adr-0014`: install is invisible and ungated;
   `adr-0018` D1/D6). Offer the three, one line each, and take `steward` if the
   user has no preference:

   - **steward** *(default)* — "you approve direction + final result; agents
     handle spec and build";
   - **guardian** — "you also approve the spec before build";
   - **initiator** — "you kick off intent and approve only the final result".

   Then write **`.grove/gates.toml`** (consumer-authoritative — the `.grove/`
   root, not `internal/`) as an **explicit full table** seeded from the chosen
   preset (`adr-0018` D7). Use `${CLAUDE_PLUGIN_ROOT}/reference/gates/gates.toml`
   as the shape and set the four `[gates]` rows + `seeded_from` to the chosen
   preset's values:

   | Preset | intent | spec | build | ship |
   |---|---|---|---|---|
   | **steward** | human | agent | agent | human |
   | **guardian** | human | human | agent | human |
   | **initiator** | agent | agent | agent | human |

   Keep the template's `[trigger]` and `[intent_external]` sections verbatim.
   The four rows are the **source of truth**; `seeded_from` is provenance only.
   **Non-clobber:** if `.grove/gates.toml` already exists, ask before
   overwriting (same discipline as everything below). Then **validate the write**
   with `node .grove/internal/gates/bin/resolve-profile.mjs .grove/gates.toml` —
   it must exit `0` (a clean, floor-satisfying profile); exit `2` means the
   guard fell back to `guardian`, which a fresh preset seed should never trigger
   — fix the file rather than leave it. Tell the user they can switch presets
   later with **`/grove:set-profile <preset>`** or hand-edit a single row, and
   that the **floor** (`adr-0018`) always holds: at least one human intent-locus
   gate (`intent = human` OR `ship = human`), enforced on every run-sequencing
   read.

## 3. Seed the shared role config — `.grove/config.toml` (`adr-0026` D3)

One file, shared across roles (tokens cross roles — `TEST_CMD` feeds `executor` *and*
`conformance-reviewer`; per-role duplication would reintroduce drift). **Consumer-authoritative:
you seed it once; grove never clobbers it.** Ask about each token **once**, interactively, and
write one key per token (key = the token name). **Where the project genuinely has no such
convention, write an explicit honest statement as the value instead of inventing process** — e.g.
`"none — no PR-body contract exists as of this writing; check by hand until one does"`.
Honest-absent is a *value*, not a gap, and repo evolution never requires re-running setup: agents
treat every value as a **verified prior** (verify on use; disclose + route a fix here on mismatch;
self-detect on absence — `adr-0026` D3).

| Key | Read by | What to ask |
|---|---|---|
| `TEST_CMD` | executor, conformance-reviewer | this project's test command |
| `TYPECHECK_CMD` | executor, conformance-reviewer | this project's typecheck command (or "none — untyped") |
| `LINT_CMD` | code-reviewer | this project's lint/formatter command (or "none — no linter configured") |
| `TEST_DEPS_LEDGER` | executor, conformance-reviewer | this project's per-package test-deps ledger location/convention (`adr-0006`; grove's worked example: a nearest-ancestor `test-deps.md` with a fenced `grove-test-deps` block) |
| `PR_CONTRACT_SECTIONS` | conformance-reviewer, propagation-remediator, run-resumer | which sections a PR body must carry — first ask which VCS/host and issue tracker this project uses, since the answer shapes how this resolves |
| `PARKED_ITEM_STORE` | conformance-reviewer, propagation-remediator | where this project tracks deferred/parked items (a TODO/ROADMAP file, a `decisions/` entry, issue labels, …) |
| `CONVENTIONS_PATH` | code-reviewer | where this project declares its code conventions (its CLAUDE.md, a style guide; "none exists yet" is valid — the charter's fallback then applies) |
| `QUALITY_RUBRIC_PATH` | code-reviewer | this project's code-quality rubric path — optional by charter |
| `SPEC_RUBRIC_PATH` | contract-author | this project's spec-quality rubric path |
| `RESEARCH_RUBRIC_PATH` | divergent-researcher | this project's research-quality rubric path |
| `ARTIFACT_DIRS` | corpus-reviewer | this project's corpus directories (family default: `decisions/`, `specs/`) |
| `ARTIFACT_CONTRACT_PATHS` | corpus-reviewer | where this project declares its artifact contract (family default: `decisions/README.md` + `specs/README.md`) |
| `REPO_TYPED_CHECKS` | corpus-reviewer | any repo-typed extra checks beyond the family core ("none" is valid) |
| `SEVERITY_TAXONOMY` | dispatcher (full charter, bug pipeline) | this project's bug-severity tiers, if it wants them ("none declared" is valid) |

Head the file with a short comment naming what it is (the `adr-0026` D3 shared config, key = token
name, consumer-authoritative, values are verified priors). Use TOML strings; the two list-shaped
keys (`ARTIFACT_DIRS`, `ARTIFACT_CONTRACT_PATHS`) may be arrays. This file is **agent-read config**
— grove agents read it with judgment; it is never a deterministic machinery read (`adr-0026` D3's
boundary).

Also mention (do not create): **optional per-role addenda** at `.grove/agents/<role>.md` — local
rules and worked examples a generic `grove:<role>` agent reads when present and replaces with
judgment when absent. Consumer-authored; seed nothing empty.

## 4. Seed the dial-explainer — `.grove/README.md` (`adr-0026` D7)

Grove-managed (regenerated by `/grove:refresh` — say so in its header). A short file explaining
the **effect** of each consumer-facing dial, so a repo reader needs no plugin to understand what
the knobs do — while the normative model itself is **never restated per-repo** (`adr-0008` holds):

- `gates.toml` — yours: who must approve at each of the four gates; the floor (intent or ship =
  human); `/grove:set-profile` to switch presets.
- `config.toml` — yours: the shared role tokens grove agents resolve at use time, as verified
  priors (mismatches get disclosed and routed back here, never silently worked around).
- `agents/<role>.md` — yours, optional: per-role addenda.
- `internal/` — grove's: floor-guard machinery + C1 defaults, re-copied verbatim on refresh; not
  a consumer surface.

Close it citing the companions **standard-form**: *"the operating model (lifecycle enum,
versioning grammar, edge taxonomy) ships in the grove plugin — per the grove lifecycle /
versioning / relations companions, `plugin@<stamp>` (the stamp in this repo's CLAUDE.md)."* No
copy of the companions is installed (`adr-0026` D7).

## 5. Seed minimal `decisions/` and `specs/` stores, if missing

If this project has no `decisions/README.md` or `specs/README.md`, seed minimal ones — model:
grove's own (`decisions/README.md`, `specs/README.md` in the grove repo). Each should cover: the
shared artifact frontmatter (`id/type/status/depends_on/owner/updated`) and — for `decisions/` —
the append-only rule (never edit a ratified decision in place; supersede with a forward pointer).
Do **not** seed the lifecycle state enum or its state semantics — the seeded README cites the
lifecycle companion standard-form (*"per the grove lifecycle companion, `plugin@<stamp>`"*),
never a restatement (`adr-0008`; `adr-0026` D7). Adapt, don't invent a heavier process than
grove's own.

## 6. Compose the managed block into `CLAUDE.md` — the stamp + the skew rule (`adr-0026` D4)

Read the installed plugin version from `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` (the
`version` field). Append this block to the project's `CLAUDE.md` (create the file if it doesn't
exist). Touch **nothing else** in the file. **Before editing, save a pre-write copy** of the
existing `CLAUDE.md` somewhere temporary (skip if the file doesn't exist yet) — the verification
below diffs against it. Fill `<VERSION>` with that version:

```
<!-- grove:begin (managed by grove — dials live in .grove/, not this block) -->
Work items matching a grove workflow (W1–W6 — e.g. a bug report → the bug
pipeline, a research ask → divergent research) run as grove runs, sequenced
through grove's chartered agent roles, loaded from the grove plugin as
`grove:<role>` subagents (all thirteen). Anything else — conversation, trivial
asks, out-of-scope questions — proceeds normally. This repo's dials live in
`.grove/` (see its README). Version skew (adr-0026 D4): at role start, if the
installed grove plugin's version differs from the stamp below, disclose the
divergence loudly in your report and continue — the stamp is the in-repo
ratified record, never a lock; grove never enforces it.
grove plugin@<VERSION>
<!-- grove:end -->
```

This block is **the D4 mismatch check's home**: the stamp is the record, and the instruction
travels in every session's context — every `grove:<role>` agent (and the driving session) sees it
at role start. On a **re-run** of setup, additionally compare the installed version against the
existing stamp yourself and disclose any divergence before updating.

If a `grove:begin … grove:end` block already exists (a re-run), **replace only what is between the
markers** — idempotent, never a second block, never a change outside the markers.

**Verify the write.** After composing the block, check both of these:

1. **Exactly one block**: `grep -c 'grove:begin' CLAUDE.md` and `grep -c 'grove:end' CLAUDE.md`
   must each print `1`.
2. **Nothing outside the markers changed**: `diff` the pre-write copy against the new file — every
   changed or added line must lie between the markers (on a first install: one appended block and
   nothing else; on a file grove created: the block is the whole file).

If either check fails, **fix it before moving on**: restore from the pre-write copy and re-attempt
the edit once. If it fails again, stop — show the user the pre-write copy's location, the exact
diff, and the intended block, and say plainly that the write misfired. **Never leave a mangled
`CLAUDE.md` silently in place.** A misfire here — observed by you or reported by a user — fires the
armed trigger in grove's `decisions/adr-0003-managed-block-routing-rule.md`: report it as an issue
on `kodhama/grove`, so this prose edit gets replaced by a bundled deterministic upsert script.

## 7. Offer to make grove invisible to the consumer's tooling (whole `.grove/`)

`.grove/` is grove's per-repo namespace — the dials and the gate-profile machinery. It is a
**dependency surface, not the consumer's own source**, so the consumer's linters and formatters
have no business reading it. A *formatter* is the acute danger, not just lint noise: `.grove/`
carries markdown and TOML a formatter could rewrite. So **offer** — never impose — to add the
whole `.grove/` namespace to each detected tool's ignore.

**Detect** which of these the project uses, by config presence. Report each honestly: a tool whose
config is genuinely absent is **"none found,"** never a false claim of having ignored it.

| Tool | Detect by | Where `.grove/` goes |
|---|---|---|
| ESLint | `.eslintrc*`, `eslint.config.*`, or an `eslintConfig` key in `package.json` | `.eslintignore` if it exists; else the `ignores` field of `eslint.config.*`; else create `.eslintignore` |
| Prettier | `.prettierrc*` or `.prettierignore` | `.prettierignore` (create it if only a `.prettierrc*` exists) |
| Biome | `biome.json` | the `files.ignore` array in `biome.json` |
| markdownlint | `.markdownlint*` (e.g. `.markdownlintrc`, `.markdownlint.json`, `.markdownlint.yaml`) | `.markdownlintignore` if it exists; else create it |

For each **detected** tool, ask the user whether to add `.grove/` to its ignore (one grouped offer
naming each found tool is fine). Only on a **yes** do you write — **consent is required; write
nothing without it.** If declined, note that plainly and move on; nothing is changed.

**Augment-never-clobber, the same discipline as everywhere else in setup:**

- If `.grove/` (or a glob that already covers it, e.g. `.grove/**`) is already ignored, it is
  already done — **skip it, touch nothing.**
- Add the single `.grove/` entry and **touch no other line** of the file.
- Create an ignore file **only** when the tool uses a dedicated one and none exists (per the table
  above); never create config a tool doesn't already use.

**This is the one place setup writes outside grove's own footprint** — outside the `.grove/`
namespace and the managed `CLAUDE.md` block. Treat it as exactly that: an **offered, consented,
augment-never-clobber exception**, and in the step 10 confirm name precisely which ignore file and
which line you touched (or that none were, or that the offer was declined). Never a silent write.

## 8. Telemetry (optional — grove never requires it)

Ask whether [wisp](https://github.com/kodhama/wisp) is vendored or otherwise available in this
project.

- **If yes:** copy `${CLAUDE_PLUGIN_ROOT}/reference/skills/grove-status/SKILL.md` into this
  project's `.claude/skills/grove-status/SKILL.md` (stripping the first-line vendoring header),
  resolve `<WISP_VENDOR_PATH>` to wherever wisp actually lives in this project (e.g. `tools/wisp/`,
  or `.` if this project *is* wisp), and drop its own `## Placeholders` section once resolved.
  (This is the one per-repo-vendored skill left — parked as `adr-0026` P3, to ride into the plugin
  with a config lookup at a later migration.)
- **If no:** don't install the skill. Mention `github.com/kodhama/wisp` as where it lives if they
  want live dashboard telemetry later, and move on — grove's agent roles work fully without it.

## 9. Recommend, don't install, Trellis

Close by telling the user grove pairs with the governance layer it runs under, but do **not**
install it yourself:

> grove composes the swarm; [Trellis](https://github.com/kodhama/trellis) is the governance layer
> it runs under. If you want that too: `/plugin install trellis@kodhama` then `/trellis:setup`.
> Recommended, not required — grove works standalone.

## 10. Confirm

Tell the user exactly what you wrote: the **gate-profile** — which preset you seeded
`.grove/gates.toml` from (or `steward` by default) and that the floor-guard machinery
(`.grove/internal/gates/`) and C1 defaults (`.grove/internal/enforcement.toml`) landed — every
`config.toml` key you seeded and to what value (or the honest "none exists yet" statements you
wrote instead), the dial-explainer (`.grove/README.md`), whether `decisions/`/`specs/` were
seeded, the `CLAUDE.md` block + the exact version stamped, whether the telemetry skill was
composed, and **which tooling-ignore files and lines step 7 touched** (naming each `.grove/` line
and its file — or that no linter/formatter was found, or that the offer was declined). Remind them
nothing was copied into `.claude/agents/` — the roles are the plugin's. They can remove all of it
any time with `/grove:remove`.

## 11. Hand back — grove wrote no git; landing is yours

Setup composes files; it does **not** land them. Perform **no git** of your own — no `add`, no
`commit`, no branch, no push, no PR — and **recommend no landing approach**: not a direct commit,
not a PR, not committing anywhere. **Never** commit onto the current branch (least of all
`main`/`master`). Instead, surface the uncommitted state plainly (run `git status --short`) and hand
the decision back:

> Setup is done — and I performed no git: no add, no commit, no branch, no push, no PR. Here is
> what is now uncommitted in your working tree: **[list the changed/added paths]**. Landing these is
> yours, your project's own way — I'm not recommending a direct commit, a PR, or committing
> anywhere. Setup runs inline in this session, so any landing opinion here would bias how you handle
> git for your own unrelated work; that call is yours, not grove's.

**Why the restraint, stated (not just done):** setup runs inline in the consumer's own session, so
a landing recommendation ("commit it to `main`," "open a PR") injects grove's git preference into a
project that has its own conventions. The neutral hand-back points back at *their* defaults; the
recommendation is the opinion setup must not carry.

**On an autonomous run with no human to answer** (an unattended session), do not improvise a
landing: leave the change in the working tree, report what is uncommitted, and stop. Never land
unasked.
