# grove

**Agent supervision skills, shipped as one plugin for Claude Code and
Codex.** A project lead runs an epic, a defect run or a task given as plain
intent, and starts one story worker per story, or carries a small one-story
task itself as its worker; each worker carries its story to a pull request
ready for review. Neither merges: the maintainer approves every merge.

## The skills

| skill | what it does |
| --- | --- |
| `project-lead` | Leads one epic, defect run or plain-intent task: gets its shape approved, starts the workers, carries decisions, accepts each hand-back on its evidence. Never writes the code, unless it carries a one-story intent run itself as that story's worker. |
| `story-worker` | Carries one story or defect to a pull request ready for review, through its routing table, with a review by someone other than itself. |
| `supervision-setup` | Binds a level skill's routing table to the performers this session can invoke, and writes the session's bindings file. Ships the receipt checker. |
| `session-restart` | Restarts a session at a quiet point from a handoff, in place in its herdr pane when it can. |
| `context-gauge` | Reads the session's context as a share of its model's window. |

A host lists each as `grove:<skill>`. Setup matches the part after the last
`:`, so a routing table that suggests `story-worker` binds it unchanged.

## Install

Install once per machine, at user scope, on each host you use.

**Claude Code:**

```sh
claude plugin marketplace add kodhama/grove
claude plugin install grove@grove
```

**Codex:** register grove as a user-level git marketplace in
`~/.codex/config.toml`, and enable the plugin:

```toml
[marketplaces.grove]
source_type = "git"
source = "https://github.com/kodhama/grove.git"

[plugins."grove@grove"]
enabled = true
```

An install reaches new sessions only: start a fresh one after installing.

**Remove any bare copy first.** A skill installed both as `grove:story-worker`
and as a bare `story-worker` in a skills folder is a clash under setup's
matching rule, and setup then binds that operation by discovery.

## Updating

A merged version bump reaches an install only when the install updates, and,
like an install, an update reaches new sessions only: start a fresh one after
updating.

**Claude Code:**

```sh
claude plugin update grove@grove
```

**Codex:**

```sh
codex plugin marketplace upgrade grove
```

This refreshes grove's marketplace copy and reinstalls the enabled plugin from
it; a new Codex session also runs the same upgrade in the background when it
starts. This was read from Codex's source at codex-cli 0.160.0, not yet run.

## Adopt it in a repo

- **Routing overrides** go in `.agents/routing-overrides/<skill>.toml`, one
  per level skill you override. An override replaces an operation's
  `performers` and `fallback`, nothing else, and it names only operations
  its table has: setup stops on any other. The work-tracker operations have
  no default performer, so your overrides name your tracker's tools:
  - `story-worker`: `post-work-note`;
  - `project-lead`: `post-work-note`, `read-work-notes`, `file-stories`,
    `find-work-items` and `update-work-item`;
  - `session-restart`: `post-work-note` and `read-work-notes`, which only
    its new-session path uses.
- **Ignore session state:** add `.context/supervision/` to `.gitignore`.
  Bindings and handoffs name transcript paths under a real home directory.
- **Project instructions** (`AGENTS.md` or your harness's equivalent) name
  your review loop, the checks that must pass, how a pull request links its
  work item, and the footer an agent signs its comments with. The skills read
  them there.

## What the routing tables expect

Every performer a table suggests is a suggestion. When it is absent, setup
binds the operation's fallback, and the hand-back says so. Grove declares no
plugin dependency.

- **compound-engineering** (plugin): planning, building, simplifying, review,
  commit and pull request, PR feedback, learning capture and handoffs
  (`ce-plan`, `ce-work`, `ce-code-review` and the rest). Without it, each of
  those operations runs its fallback: the session does the step itself from
  the table's instructions, and still never reviews its own work.
- **herdr** (CLI): starting and messaging sessions in panes, and the in-place
  restart. **A project lead needs it:** `start-worker` is required and has no
  fallback, so a lead's setup stops without herdr. A worker without it still
  hands back through its harness's own messaging where it has one, and by
  work note where it has none; its restart takes the new-session path.
- **Your work tracker**, through your overrides: posting a work note is
  required at both levels, and a lead also needs to read them.
- **Node 24, or 26 and newer** (`package.json`'s `engines`) runs the receipt
  checker, which uses `node:fs`'s `globSync`. **jq** runs the restart scripts
  and the context gauge.

## Versions

**Every PR bumps `version` in both `.claude-plugin/plugin.json` and
`.codex-plugin/plugin.json`, together.** An install keeps its cached copy
until `version` changes, so an unbumped merge reaches nobody. The bump also
lets a consuming repo name the commit it pins by its version.

## Known gaps

- **Codex does not restart in place yet** (GRO-3). A Codex session takes the
  new-session path, and a Codex worker hands its restart to its lead.

## History

The skills were built in
[kodhama/math-quest](https://github.com/kodhama/math-quest) and moved here
with GRO-6. Code comments keep the MQ ids and plan tags of the change that
wrote them, which point into math-quest's history, chiefly the
[operating model plan](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md)
and the
[receipt-check plan](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/plans/2026-10-04-0734-feat-receipt-check-credits-calls-that-ran-plan.md).
The live decisions are in
[`docs/decisions/supervision-operating-model.md`](docs/decisions/supervision-operating-model.md),
and why each dependency is here in
[`docs/decisions/dependency-adoption.md`](docs/decisions/dependency-adoption.md).

To contribute, read [`AGENTS.md`](AGENTS.md).
