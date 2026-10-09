---
name: session-restart
description: Restart this session at a quiet point, in place in its own herdr pane when it can, or as a new session when it cannot. In place, it writes a handoff, starts a detached helper that clears the session and prompts it to resume, and ends the turn; the resumed session reruns setup seeded with the handoff's table. Use when a session's restart trigger fires (for example context past its line) between tasks, when a prompt says to resume from a session-restart handoff, when a session-restart helper asks for the handoff to be refreshed, or when a successor is launched from a posted handoff. Works from the bindings supervision-setup writes for this skill's own routing table.
---

# session-restart

A restart swaps a full context for an empty one that reads a handoff. **In
place** keeps the session's process, pane, name, inbox and Remote Control
connection: nothing inside a session can type `/clear` into itself, so a small
detached helper, `scripts/restart-in-place.sh`, does it from outside once the
turn has ended and nobody is using the pane. **A new session** is the fallback
when a clear is impossible: the process has died, the work moves to
another machine or container, the model, harness or permission mode changes,
no pane is reachable, or a binding the in-place path needs is missing.

Every harness-specific call goes through this skill's own routing table,
`routing.toml` beside this file, bound by `supervision-setup`. The bindings
live in `.context/supervision/<session-name>/bindings.json`, with
`table: session-restart` on this skill's operations.

## Never

- Type into, or let the helper type into, a pane that is focused or holds
  unsent text in its input line. The maintainer may be typing there, and
  herdr submits a draft together with whatever it types next.
- Start the helper with a loop that never ends. Every wait in it is bounded;
  keep it that way.
- Restart mid-step. Finish the step in hand first, and never with a subagent,
  a background task or a Monitor of yours still running.
- Hand-type a field the live system can tell you. Read each identity field
  from a command and note which one.
- Start the helper by hand. `scripts/start-restart.sh` starts it, from the
  bindings, or says why it must not.

## Before the first restart: bindings

A session that runs a level skill already has this table bound: its setup
binds a bound skill's own table in the same run. A session that runs no level
skill runs `supervision-setup` with this skill's `routing.toml` as the table,
once, before its first restart. Either way, read the bindings file; a
restart does nothing until it has `complete`.

## Choose the path

Two checks, in order:

1. **What only you know.** The work stays on this machine and in this
   container, with the same model, harness and permission mode. If not, take
   the new-session path.
2. **What the bindings and the live system say.** Write the handoff (below),
   then run the launcher from the repository root:

   ```sh
   D=.context/supervision/<session-name>
   "<this skill's folder>/scripts/start-restart.sh" --bindings "$D/bindings.json" \
     --handoff "$D/handoff.md" --reporter <reporter-name>
   ```

   The reporter is a live Claude Code session other than you that relays the
   helper's reports to the maintainer: your lead, or for a session with no
   lead, one the maintainer has named. The launcher prints one line:

   - `in-place: …` — it started the helper and wrote `restart-pending` beside
     the handoff. End the turn.
   - `new-session: …` — the in-place path is closed, for the reason it gives.
     Take the new-session path. A Codex session always lands here for now,
     since Codex does not restart in place yet, and since that path is
     Claude Code only, it tells the maintainer instead.
   - `fix: …` — something to fix first, such as setup not having run or the
     handoff lacking the table. Fix it and run it again.

## In place: before the turn ends

1. **Stop what you launched.** A cleared conversation cannot see its own
   background tasks, Monitors or subagents, and they keep running until the
   process ends. Stop each one, or wait for it to finish.
2. **Write the handoff** at `.context/supervision/<session-name>/handoff.md`,
   from the template below.
3. **Run the launcher** as "Choose the path" says.
4. **End the turn.** Say in one line that a restart is pending and where the
   handoff is.

**While `restart-pending` exists**, every turn you take, for a hand-back, a
message or anything else, rewrites the handoff's live commitments before it
ends. The helper will not clear a session whose handoff is older than the
latest message it received. If a prompt from the helper asks you to refresh
the handoff, rewrite it and end the turn.

## What the helper does

It waits until the pane is `idle` or `done`, not focused, not held at a
dialog, and its input line empty. herdr shows a question or permission dialog
as `done`, so the helper also reads the transcript: a tool call with no result
yet means a dialog is open, and it types nothing. It reads the input line
through `scripts/read-input-line.sh`, and treats an input line it cannot find,
as after a change to the harness's screen, like unsent text. If the pane stays
focused or holds text past its bound (10 minutes by default), it reports that
once and keeps waiting without typing. If the handoff is stale, it prompts you
to refresh it, up to three times, and then gives up. Then it types a bare
`/clear`, confirms the session id changed, rechecks focus and the input line,
and sends one prompt naming the handoff. Right before the clear it rechecks
freshness. Before the clear, a refresh prompt included, it types nothing into
a pane that no longer holds the session it started on: it reports that and
stops. Finally it confirms the resumed session reads as working, idle or done
and is not held at a dialog; a pane it cannot read then is reported as an
unconfirmed resume.

Anything that fails goes to the reporter through `scripts/report-to-session.sh`,
which types into the reporter's pane only when that pane is not focused,
blocked, at a dialog or holding unsent text, and asks the reporter to tell the
maintainer with `AskUserQuestion`. A line it cannot deliver yet is held in
`restart-unreported.txt` beside the handoff and retried, within a bound. The
helper gives up after two hours by default; run it with no arguments for its
bounds. One helper runs per handoff: it holds `restart-helper.lock` beside the
handoff while it runs, and a second one exits without typing and reports that
it did. If a helper was killed and the lock stayed, delete it before starting
another.

## Handoff template

```markdown
# Handoff: <session-name>, <date and time>

## Identity (each read from the command named)

- -n name: <value> (`ListAgents`, or the transcript's `agent-name` record)
- herdr pane: <value> (`echo $HERDR_PANE_ID`)
- herdr name: <value> (`herdr agent get $HERDR_PANE_ID`)
- session id: <value> (`echo $CLAUDE_CODE_SESSION_ID`)
- Remote Control name: <value> (<how observed>)
- reporter: <name> (`herdr agent list`)
- work item: <id and link, or none>
- restart-owner: self

## Launch

<the exact argv that started this session>

## Routing table

- skill: <the bindings file's skill>; table <path> (sha256 <hex>); override <path or none> (sha256 <hex>)
- bindings file: .context/supervision/<session-name>/bindings.json
- harness: <name> <version> (<the bindings file's harness evidence>)
- transcripts: <every session id and path the bindings file lists>

| table | operation | how bound | kind | performer | source |
| ----- | --------- | --------- | ---- | --------- | ------ |

<one row per binding in the bindings file, this skill's own included>

## Receipt check

<the receipt check's output, pasted unchanged, line for line:
`node "<supervision-setup's folder>/scripts/receipt-check.mjs" --bindings "<the bindings file>"`,
supervision-setup's folder being the one beside this skill's own, adding
`--since <the story's Started time>` in a session working a story, and
leaving it out in one with no story, and adding `--handoff "<path>"`, with
the handoff you started from saved to that path, whenever that handoff's own
receipt-check section holds a result; or `unavailable: <why it could not run>`>

## What I am doing

<the task, where it stands, and the next step>

## Live commitments

<promises pending, answers awaited, unsent drafts; "none" if none>

## Blocked decisions

<what waits on whom; "none" if none>

## Resume steps

Resume with the session-restart skill: follow its "After the clear" section,
or "The successor" on the new-session path.

## Restart record

<left empty; the resumed session or successor writes here>
```

The routing table is inline because a successor on another machine cannot
read the bindings file. The harness and transcripts lines let its
seeded setup keep the earlier transcripts all the same, and the table's
and the override's sha256 let it see a table or override that changed since. The receipt check is
inline for the same reason: such a successor cannot read your transcripts, so
its own check reads your result from this section (`--handoff`) and counts
each operation it shows used in a session it cannot read itself. A carried
use has no time, so no later check can cut it: `--since` is what keeps a use
from before the story out of this handoff, and so out of the restarts that
carry it on. That
transcript stays listed, and missing, through every later restart, so each
one passes on the handoff it started from in the same way; a result it does
not need is ignored, never harmful. A line
reformatted on the way (bulleted, indented) is not read. Mid-story, a step
not yet reached reads bound-but-unused; that is expected, not a fault.

## After the clear

The prompt that wakes you names the handoff.

1. Read the handoff in full, and any file it says to read first.
2. Check you are the same session: `echo $HERDR_PANE_ID` and your name in
   `ListAgents` match the handoff's identity fields. If they do not, tell the
   maintainer and stop.
3. Read `restart-helper.log` and `restart-unreported.txt` beside the handoff.
   Tell the maintainer yourself any line that was never reported.
4. **Run `supervision-setup`, seeded with the handoff**: the table is the
   `routing.toml` beside the level skill you run or, for a session that runs
   no level skill, beside this skill. The table path the handoff records is a
   record only, since an update or a move can take that folder away. Setup
   rechecks every seeded binding, or binds every operation as on a first run
   when the table changed, and appends your new transcript. Do no task work
   until it completes. If it reports "the routing table changed since the
   earlier setup", tell your lead that line, or your reporter when you have
   no lead.
5. Write `resumed <date and time>, session <new session id>` under Restart
   record, and delete `restart-pending`.
6. Carry on from "What I am doing", keeping the live commitments.

## New session: the outgoing session

These steps are for Claude Code only: they read `ListAgents` and
`$CLAUDE_CODE_SESSION_ID`, and how a Codex session reads its own identity is
not known yet. A Codex session that lands here tells the maintainer.

1. **Stop what you launched**, background tasks above all: a session with a
   live background task cannot exit without a dialog.
2. **Write the handoff** as for in place, with a `## Launch` line for the
   successor: the same `-n` name, remote control on, and the permission mode
   set explicitly. Set `restart-owner: self`, or `restart-owner: lead`
   when you cannot launch the successor yourself, as from a cloud session.
3. **Post the handoff** as a work note on your work item, the story's, or the
   epic's or run's for a lead, through the bound `post-work-note`, headed
   `session-restart handoff for <name>`. With no work item or no binding, tell
   the maintainer and stop: this path cannot hand off across machines without it.
4. **Launch the successor** through the bound `launch-session`, with a
   prompt that fits one short line, since a launch rejects long or multi-line
   prompts:

   ```text
   Resume with the session-restart skill from the handoff at <the note's link>.
   ```

   herdr cannot give it your herdr name yet: it refuses a name a live
   session holds (`agent_name_taken`). Start it under a temporary herdr name:
   the first 30 characters of your herdr name, then `-n`, since a herdr name
   has at most 32. The successor takes your name once you have exited.
   Its `-n` name stays yours: two Claude Code sessions can share one, told
   apart by their refs. If herdr refuses the launch, `launch-session` is
   unavailable, or `restart-owner` is not `self`, ask the restart owner to
   launch it from the handoff's launch line.
5. **Wait for `successor-up`**, for at most 30 minutes. Nothing wakes you on
   its own, so give yourself a wake source: one bounded background timer,
   such as a background shell command that sleeps five minutes and exits.
   Each time one wakes you, read the work item's notes through the bound
   `read-work-notes`, and start the next only while `successor-up` is absent
   and the 30 minutes last. Never sleep inside the turn. If it does not
   appear in time, tell the maintainer and stay up.
6. **Once it appears, start no more timers and end your last turn.** Say in
   one line that the successor is up, and do nothing more: the successor
   closes this session, and a live background task would hold its close at
   a dialog.

## New session: the successor

These steps are for Claude Code only, as the outgoing session's are: how a
Codex session reads its own identity is not known yet.

1. Read the handoff, from the note the launch prompt names.
2. Read your actual name and your ref from `ListAgents`. While the outgoing
   session lives, your name may be shared with it or carry a suffix; only
   the ref is yours alone.
3. Run `supervision-setup`, seeded with the handoff, as "After the clear"
   step 4 says. Where the handoff's bindings file does not resolve on this
   machine, setup takes the earlier transcripts and harness from the handoff.
   The handoff's performers may not exist here, so use none of them before
   setup has rechecked them.
4. Post `successor-up: <actual name> [<ref>], session <id>` as a work note on
   the same work item, through the bound `post-work-note`.
5. Announce yourself to your peers, your lead or reporter at least, with your
   actual name and your ref: while another row shares your name, a
   bare-name send to you is refused as ambiguous.
6. **Close the outgoing session** when you run in the same herdr and
   `type-into-pane` is bound to it, with this skill's script and the bound
   herdr, the handoff's pane and the outgoing session's transcript, the last
   the handoff's transcripts line lists:

   ```sh
   "<this skill's folder>/scripts/close-outgoing.sh" "<herdr>" <pane> "<transcript>"
   ```

   It types `/exit` only when the helper's own checks pass right before the
   send: no dialog open in that transcript, an empty input line, and the pane
   idle or done, unfocused, and still holding that session. If it prints
   `not sent: …`, try again at your next wake-up, and after three tries tell
   the maintainer that line. If `type-into-pane` is unbound or cannot reach
   that pane, as from another machine, ask the maintainer to close it: the
   outgoing session cannot exit itself. Once its pane holds no agent, and
   when you run in the same herdr, take its herdr name, which the launcher
   and the relay find sessions by:
   `herdr agent rename "$HERDR_PANE_ID" <the handoff's herdr name>`.
7. Write `successor-up <date and time>, <actual name> [<ref>]` under Restart
   record, in the handoff note's thread or the local handoff, and carry on
   from "What I am doing".
