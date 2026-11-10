# grove

**Agent supervision skills for Claude Code and Codex, shipped as one plugin
and installable with the kodhama CLI.** A project lead runs an epic, a defect
run or a task given as plain intent, and starts one story worker per story, or
carries a small one-story task itself as its worker; each worker carries its
story to a pull request ready for review. Neither merges: the maintainer
approves every merge.

## The skills

| skill | what it does |
| --- | --- |
| `project-lead` | Leads one epic, defect run or plain-intent task: gets its shape approved, starts the workers, carries decisions, accepts each hand-back on its evidence. Never writes the code, unless it carries a one-story intent run itself as that story's worker. |
| `story-worker` | Carries one story or defect to a pull request ready for review, through its routing table, with a review by someone other than itself. |
| `supervision-setup` | Binds a level skill's routing table to the performers this session can invoke, and writes the session's bindings file. Ships the receipt checker. |
| `session-restart` | Restarts a session at a quiet point from a handoff, in place in its own pane when it can. |
| `context-gauge` | Reads the session's context as a share of its model's window. |

A host lists each as `grove:<skill>` from the plugin, or as the bare
`<skill>` from a kodhama install. Setup matches the part after the last `:`,
so a routing table that suggests `story-worker` binds it unchanged.

## Install

Install once per machine, at user scope, on each host you use.

**With the kodhama CLI**, which reads `kodhama.json` at this repo's root and
installs the newest `vX.Y.Z` tag into both hosts' skills folders
(`~/.claude/skills/` and `~/.agents/skills/`):

```sh
npx -y github:kodhama/stewards install grove
npx -y github:kodhama/stewards check grove
```

The CLI refuses while grove is enabled as a plugin; `install grove --migrate`
takes the plugin enables out first and keeps a receipt for rollback.

**As a plugin**, until the plugin packaging is retired:

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

**A bare copy the kodhama CLI installed is not a clash.** A skill listed both
as `grove:story-worker` and as a bare `story-worker` whose folder carries the
CLI's marker is one skill to setup, which binds the bare copy on a first setup
and keeps a restarted session's earlier binding. Whether Codex lists a plugin's
skills qualified, which the rule needs, is not yet observed. Any other bare
copy, one you placed by hand, still clashes, and setup binds that operation by
discovery: remove it first.

## Updating

A merged version bump reaches an install only when the install updates, and,
like an install, an update reaches new sessions only: start a fresh one after
updating.

**A kodhama install** moves to the newest tag:

```sh
npx -y github:kodhama/stewards update grove
```

**A plugin install, Claude Code:**

```sh
claude plugin update grove@grove
```

**A plugin install, Codex:**

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
  its table has: setup stops on any other. Some operations have no default
  performer, because their performer is your repo's own. `story-worker`'s
  `document-change` is one: name the skill that keeps your reference,
  architecture and design docs. With none named, and none that setup finds,
  the worker updates the stale docs itself: the ones your project instructions
  name, or, where they name none, the reference, architecture and design docs
  your repo keeps. Add the line only once every machine and host runs a grove
  that has the operation: an older table lacks it, and setup stops there.
  The work-tracker operations are the others, and your overrides name your
  tracker's tools:
  - `story-worker`: `post-work-note`;
  - `project-lead`: `post-work-note`, `read-work-notes`, `file-stories`,
    `find-work-items` and `update-work-item`;
  - `session-restart`: `post-work-note` and `read-work-notes`, which only
    its new-session path uses.
- **Ignore session state:** add `.context/supervision/` to `.gitignore`.
  Bindings and handoffs name transcript paths under a real home directory.
- **Pull request bodies:** a story's pull request carries a `Capture:` line
  and a `Docs:` line, each once, at the start of a line of its own. The
  receipt check fails a hand-back whose saved body lacks one, so keep a bot
  that rewrites bodies from dropping them. A pull-request template may hold
  each line once, with a placeholder in angle brackets for its value: the
  check fails it until it is filled in. Name the command that saves a body to
  a file in your project instructions.
- **Project instructions** (`AGENTS.md` or your harness's equivalent) name
  your review loop, the checks that must pass, how a pull request links its
  work item, which docs a change keeps current, and the footer an agent signs
  its comments with. The skills read them there.

## What the routing tables expect

Every performer a table suggests is a suggestion. When it is absent, setup
binds the operation's fallback, and the hand-back says so. Grove declares no
plugin dependency.

- **compound-engineering** (plugin): planning, building, simplifying, review,
  commit and pull request, PR feedback, learning capture and handoffs
  (`ce-plan`, `ce-work`, `ce-code-review` and the rest). Without it, each of
  those operations runs its fallback: the session does the step itself from
  the table's instructions, and still never reviews its own work. A story
  that is not a defect is always planned: its receipt names the plan it was
  built from, which is a plan file in its pull request (the planner's, or the
  worker's own where no planner is bound), the plan unit the story came from,
  or both.
- **Reviews:** story-worker's `review` binds `ce-code-review` first, then
  the native single-pass reviewer, and runs on every change. Its `doc-review`
  binds `ce-doc-review`, in place of `review`, for a docs-only change: every
  changed path is a markdown file, and none is a skill's file, an agent
  instruction file or a plugin manifest.
- **herdr** (CLI): starting and messaging sessions in panes, and the in-place
  restart. **A project lead needs it:** `start-worker` is required and has no
  fallback, so a lead's setup stops without herdr. A worker without it still
  hands back through its harness's own messaging where it has one, and by
  work note where it has none; its restart takes the new-session path.
  Every herdr call goes through the pane-tool adapter (below).
- **Your work tracker**, through your overrides: posting a work note is
  required at both levels, and a lead also needs to read them.
- **Your knowledge-base skill**, through your override: `document-change`
  updates your reference, architecture and design docs at the completion
  checkpoint, when a change adds a module, a data shape, a contract, a
  dependency or a design change. It is optional. Without it the worker
  updates those docs itself, and the receipt says the step ran by fallback.
- **Node 24, or 26 and newer** (`package.json`'s `engines`) runs the receipt
  checker, which uses `node:fs`'s `globSync`. **jq** runs the restart scripts,
  the pane-tool adapter and the context gauge, and the adapter also needs
  **perl**, to bound each call.

## The pane-tool adapter

**Grove reaches a pane tool only through one script**:
`skills/supervision-setup/scripts/adapter/<tool>.sh`, named after the tool's
binary. herdr is the only implementation today, `herdr.sh`. Callers name an
operation (`self`, `list`, `find`, `get`, `workspace-list`, `read-screen`,
`prompt`, `wait`, `launch`, `resume`, `rename`, `close`, and a few the herdr
backend marks unsupported) and read neutral JSON back, never the tool's own
output.
`interface.md` beside it is the contract: each operation's arguments,
output, exit codes and herdr command.

- **The binding picks the backend.** A pane-tool binary bound as
  `/path/to/<tool>` is served by `<tool>.sh`. A binary with no file there has
  no adapter, and session-restart takes the new-session path with
  `no adapter for <binary>`.
- **Adding a backend** is one new `<tool>.sh` that implements the same
  operations and output, and one binding to its binary. No caller changes.
  An operation the tool cannot serve exits 5, and a field it cannot tell is
  `null`, which callers read as unsafe.
- **A script outside grove** runs the adapter by its path, with no grove skill
  involved:
  `<grove>/skills/supervision-setup/scripts/adapter/herdr.sh --bin <herdr> get <pane>`.

## The lease

**One live session per agent** (the clusters spec, §5.4 steps 2 and 3):
`skills/supervision-setup/scripts/lease.mjs`. No skill calls it yet; the
resume that does is a later unit.

- **The claim** is one JSON file, never committed, at
  `<home>/.kodhama/grove/local/<name>/claim`:
  `{"state": "pending|live", "nonce", "resumer", "boot", "expires", "pane", "session"}`.
- **`acquire`** creates it exclusively as `pending`, with a fresh nonce, this
  boot's id and a 10-minute expiry. It takes over, by compare-and-swap on the
  whole claim it judged (not only its nonce, which adoption keeps), a claim
  from an earlier boot, an expired `pending` one, or a `live`
  one whose pane is gone or holds another session. A `live` claim whose
  session runs, an unexpired `pending` one, and anything it cannot judge are
  left alone and reported.
- **`adopt`** turns `pending` into `live` before any work, recording the
  session's pane and session id. It stops the session on a nonce that does
  not match, a claim from an earlier boot (the resumed session takes the new
  nonce), an expired `pending` claim, or a lease another session already holds
  live in another pane. The same pane with a new session id, as after an
  in-place restart, rebinds the live claim to it. **`release`** deletes the
  claim on a clean exit, while it carries the session's nonce and, once
  `live`, its session id: after an in-place restart the cleared session's
  late release leaves the lease its successor holds.
- **`checkPaneReuse`** runs right before a send to a restored pane: its name
  and session id match the restart record, it is unfocused and idle or done,
  its transcript shows no open dialog, and its input line is empty. Any
  mismatch is quarantined: nothing is sent and no second session starts.
- **The boot id** is `kern.bootsessionuuid` on macOS and
  `/proc/sys/kernel/random/boot_id` on Linux.

## The review read

**A review records what it read**, so a merge gate can later tell whether
the last review read a pull request's final head (KOD-44). The receipt
check lists it; later units of that plan build the gate on it.

- **The read command** is the reviewer's first call, run alone:
  `node skills/supervision-setup/scripts/review-read.mjs --checkout <dir> --from <commit>`.
  `<from>` is the base branch for a full review, or the last reviewed head
  for a re-check. It prints `head <sha>`, `status <n>` (0 is a clean tree)
  and `base <sha>` (the merge-base of HEAD and `<from>`), all three or none.
  The reviewer then names that base, by its commit id, to the review
  performer (`base:<sha>` for `ce-code-review`).
- **`review-reads.mjs`** reads, from the listed transcripts, their subagents,
  the Codex rollouts they started and any rollout named by path, one record
  per review call: the head, clean flag and base of the last read before it
  in the same file, whether the call's args name that base (`baseNamed`, by
  hex commit ids only), and whether its context was fresh. A rollout named
  by path is fresh only as one `codex exec` run. Which records come back
  does not depend on the order rollouts are named in (their sequence
  follows it), and a transcript or rollout that cannot be found is reported
  as missing, never skipped.
- **The receipt check lists every review.** For an operation the routing
  table marks `fresh_context`, it prints one `used` line per review that
  could credit it, rather than one per operation: those a handoff carries
  first, then each fresh-subagent call in time order. Each line ends in what
  that reviewer read and the call's arguments, as one JSON string:
  `…; read <head> from <base>; args "base:<sha>"`, with `(dirty tree)` after
  the base when the tree was not clean. Each part is set on its own: the
  read is `read: none recorded` when the reviewer ran no read command first,
  and the args are `args none` for a call with none, or `args unknown` when
  the check found no record of the call. A run of the review skill's own
  script gets a line, with neither part, only when no review call credits
  the operation. A handoff carries every such line, with its read and args.
  The operation's verdict and the exit code are unchanged.

## Versions

**Every PR bumps `version` in both `.claude-plugin/plugin.json` and
`.codex-plugin/plugin.json`, together.** An install keeps its cached copy
until `version` changes, so an unbumped merge reaches nobody. The bump also
lets a consuming repo name the commit it pins by its version.

## Known gaps

- **The lease's mycelium check reads `unverified`.** No mycelium command that
  reads a named agent's binding is agreed yet, so `checkPaneReuse` records
  that check as `unverified` and never runs mycelium, installed or not.
- **A lock a killed holder leaves blocks that agent's lease until the next
  boot.** A process killed while it holds `<claim>.lock-<boot id>` leaves the
  directory behind, and the lease never breaks a lock held in this boot,
  since a pid can be reused. Each `acquire`, `adopt` and `release` then gives
  up after a short wait and names the lock and its owner's pid. To recover by
  hand, confirm that pid is no longer running, then remove that lock
  directory. A reboot clears it too, since the next boot's lock has another
  name.
- **An in-place restart can lose its lease to a takeover.** If a manager's
  `acquire` runs between the clear and the new session's re-adopt, it takes
  the claim over. The new session's re-adopt then stops on the nonce, and the
  pane-reuse check quarantines the pane. No second session starts, but the
  agent has none until the next resume.
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
