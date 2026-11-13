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
  instruction file or a plugin manifest. A manifest change that touches only
  its version is ignored.
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
  **perl**, to bound each call. The merge gate's sources
  (`skills/supervision-setup/scripts/gate-sources.mjs`) need **git 2.39 or
  newer** (for `git patch-id --verbatim`) and an authenticated **gh**.

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
  `<from>` is the base branch as just fetched (the remote-tracking ref, not
  a local branch that may be stale) for a full review, or the last reviewed head
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

## The merge gate

**The gate checks one pinned pull-request head.** Run
`node skills/supervision-setup/scripts/merge-gate.mjs --pr <owner/repo#n> --head <sha> --bindings <path>`.
It reads live pull-request state through `gh` and history from the local
checkout through git. Review coverage arrives in a later unit: **a
pull-request check currently never exits 0**, even when every checked
condition passes.

| Argument | Meaning |
| --- | --- |
| `--pr <owner/repo#n>` | Required; a positive pull-request number. Owner and repo use letters, digits, `_`, `.`, or `-`. |
| `--head <sha>` | Required; a full lowercase 40- or 64-character hex commit id. Every commit-specific read uses this head. |
| `--bindings <path>` | Required at least once; repeatable. Parsed and retained for later review coverage; not opened yet. |
| `--receipt <path>` | Optional readable story receipt. Its single `Shipped revision:` line must give 7 to 40 hex characters as its first token, a case-insensitive prefix of `--head`. |
| `--carried <path>` | Optional carried evidence; parsed, not opened yet. |
| `--codex-rollout <path>` | Optional, repeatable review evidence; parsed, not opened yet. |
| `--bot <name>` | Optional, repeatable automated reviewer. Names match logins ignoring case and a trailing `[bot]`. |
| `--bot-unavailable <name>:<reason>` | Optional, repeatable exemption with a non-empty reason on one line; a name cannot also be passed with `--bot`. |
| `--checkout <dir>` | Optional git checkout, also where `gh` runs; defaults to the working directory. |
| `--help` | Prints usage and exits 0 only when given alone. |

The report prints these lines in order, checking every condition even when
another fails. Every printed GitHub or process value uses JSON escaping,
plus escapes for all remaining Unicode control and line-separator characters,
including U+2028, U+2029 and U+0085. Check names, bot names and thread paths
also have surrounding quotes.

- `head: pass ...` or `fail ...`: the pull request is open, its live head
  equals `--head`, and the receipt's shipped revision agrees when given.
  The receipt is checked even when the live head cannot be read; a mismatch
  still fails, with the live-read error included on the head line.
- `ci: pass <n> checks passed on <sha>` or `fail ...`: every check has
  completed with `success`, `neutral`, or `skipped`, and at least one
  concluded `success`. No checks, all-neutral, and all-skipped fail.
- `review coverage: not checked (not built yet)` until review coverage is implemented.
- `threads: pass none unresolved` or `fail <n> unresolved: ...`;
  outdated unresolved threads still block.
- One `bot "<name>": pass ...`, `fail ...`, or `unavailable <reason>` per
  named bot in argument order, then unnamed reviewing bots by login.
  Each signal must come from the named bot's `Bot` account: a review on
  the head whose body is not blank; a `+1` reaction on the pull request itself, strictly
  after the head's earliest check suite; or a summary row in a top-level pull-request comment.
  The summary must contain the whole word `Completed` and the head's SHA
  on the same row: every whole-word hex token of 7 to 40 characters must be
  a prefix of the head, with at least one such token. A longer hex run, such
  as a 64-character SHA, is not read as a token, so a 64-character head must
  be named by a prefix of 7 to 40 characters. The row
  must not contain `Running` or whole-word `not`, ignoring case.
  Check suites are read only when that bot has a `+1` reaction. A valid
  summary row still passes if that check-suite read fails.
  An `unavailable` bot counts as neither failed nor unchecked; its reason
  is the caller’s word, which the gate does not verify.
  An unnamed bot account that left a review fails. With none named and no
  bot reviews: `bots: pass none named and no other bot reviewed`.
- `attributes: warn the pull request changes a .gitattributes file, which can change how git reads its lines`
  appears only when the whole pull-request range touches attributes.
  Missing history instead prints `attributes: could not check ...`, asking
  for a fetch when a commit is missing. If the live head read fails, it prints
  `attributes: could not check (needs the live base)`. A warning does not fail the gate.
- `not checked: whether each finding was fixed or rejected on evidence, or whether a fix went beyond the findings`
  states the gate's scope boundary; it is not counted in the summary.
- `blocked <sha>: <n> failed, <m> not checked` ends every current
  pull-request check. Once review coverage is implemented, a run that
  passes every condition can end in `ok <sha>`.

**Exit 1 wins when any condition fails.** Otherwise exit 2 means a condition
could not be checked or remains unchecked. Transport failures print
`<condition>: could not check (<call>: <reason>)`, including one `bots:`
line if reviews could not be read; the other conditions still run. Failed
reads of comments, reactions, or check suites appear on the affected named
bot's line, preserving every other bot verdict and any unnamed-bot failures. Bad
arguments and unreadable receipt files exit 2 before any process runs, with
`merge-gate: <reason>` and usage on stderr and no stdout. Internal errors
exit 2 with `merge-gate: internal error: <message>` on stderr. Exit 0 is
reserved for all conditions holding; currently only `--help` alone returns it.

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
- **A Codex reviewer's base is never recorded as named.** A Codex skill use
  carries no arguments, so `review-reads.mjs` records `args` as null and
  `baseNamed` as false, and the receipt check prints `args none` for each
  Codex in-session review it finds. The merge gate the KOD-44 plan describes
  credits a review by its arguments (the base for a full review, every
  changed markdown file for a doc review), so as planned it cannot credit a
  Codex in-session review. Until KOD-44 U4 records a rule for crediting such
  a review, the gap stands.

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
