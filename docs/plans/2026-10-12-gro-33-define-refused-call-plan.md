---
title: Defining a refused call, and where its line goes - Plan
date: 2026-10-12
type: fix
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
origin: GRO-33 and its three comments (the lead's two of 2026-10-12, the worker's of 2026-10-12)
---

# Defining a refused call, and where its line goes - Plan

**Six decisions wait on the lead (see Open Decisions). The units below build the recommended option of each, and each decision names what changes if the lead picks another.**

## Goal Capsule

- **Objective:** a worker can tell a refused call from a failed one, knows where its `STATUS: refused` line goes when the usual route is shut, and finds the procedure in one short section instead of a 30-line bullet.
- **Means:** story-worker gets a section, "A refused call", holding the definition, the moved procedure and one ladder of routes. Its Never bullet keeps the rule and points there. The setup skill's harness notes gain what each harness was seen to show.
- **Authority:**
  1. The lead's rulings on the Open Decisions below, once given.
  2. GRO-33's description and its three comments.
  3. This plan.
- **Stop conditions:** stop and ask the lead if:
  - a moved sentence cannot keep its words (beyond the one string in OD4);
  - the new text cannot pass the portability patterns without changing them;
  - an edit turns out to need story-worker's step 8 or project-lead's step 7, where an unmerged story is working;
  - the harness-notes section would need a claim no source shows;
  - the version number is still unnamed when the branch is otherwise final.
- **Execution profile:** test-first. The change is skill text, so the tests pin wording, and a by-eye portability read covers what the patterns do not reach.
- **Who finishes:** the GRO-33 worker carries it to a draft pull request and marks it ready. The lead rules on the Open Decisions and names the version. The maintainer approves the merge.

---

## Product Contract

### Summary

story-worker says what "refused" means: a guard stopped the call, rather than the call running and failing. It names the four guards, says a sandbox denial cleared by a documented declared-need re-run is not a refusal, and gives one ladder for a line that cannot be sent. The procedure leaves the Never bullet for its own section.

### Problem Frame

The refused-call rule (GRO-17) tells a worker to stop and report "a command or any other call" its harness's permission check refused. It never says what a refusal looks like from inside the session, so a worker cannot tell a sandbox denial, a hook's block or a declined prompt from an ordinary failure. Three reviewers raised it. Two more gaps were folded in: a call refused during setup has no route, and a refused send whose fallback note is refused too has none either. The bullet that carries all of it has grown to 30 lines.

### Requirements

| ID | Requirement | From | Lands in |
| --- | --- | --- | --- |
| R1 | story-worker says what counts as refused, naming what the agent sees for each kind: a sandbox denial, a hook's block, the harness's built-in check, a declined prompt, and the permission check deciding alone. | issue: "one sentence in story-worker that names what the agent sees in each case" | `skills/story-worker/SKILL.md`, "A refused call" (U3) |
| R2 | It says whether a sandbox denial that a documented declared-host re-run fixes is a refusal. | issue: "It should also say whether…" | same paragraph (U3) |
| R3 | A call refused before setup completes has a route. | comment 1, C1 | "A refused call" and step 1 (U3) |
| R4 | A refused send whose `post-work-note` fallback is refused too has a route. | comment 1, C2 | "A refused call" and "Talking to your lead" (U3) |
| R5 | R3 and R4 are one ladder of fallbacks, not two rules. | comment 1: "Design them together, as one ladder" | "A refused call" (U3) |
| R6 | The procedure is its own short section, and the Never bullet points to it. | comment 2 | `skills/story-worker/SKILL.md` (U3) |
| R7 | The answer to a `STATUS: refused` line whose worker has ended is designed, or its split is recorded. | comment 3 | OD6; `skills/project-lead/SKILL.md`, step 5 (U5) |
| R8 | Skill text stays portable: no repo path, tracker name, version, plan tag or harness-specific invocation. | `AGENTS.md`, "The skills are portable" | every edit under `skills/*/SKILL.md` (U3, U5) |
| R9 | Only what a source shows is written as observed. | the lead's brief; `skills/supervision-setup/references/harness-notes.md:8-11` | U4 |
| R10 | Text that restates or points at the rule still agrees with it. | story-worker's "Check what points at your change" | the table under "What restates or points at the change" |

### Scope Boundaries

- No change to the `STATUS: refused` line's shape, to the choice the lead brings, or to what each answer means.
- No change to any script, to `routing.toml`, to the receipt or to the receipt check.
- No edit to story-worker's step 8 or to project-lead's step 7.
- No new decision record: `AGENTS.md` asks for one only when a dependency is added.

#### Deferred to Follow-Up Work

- **A worker that takes up a story mid-flight** (comment 3): what counts as evidence for the steps an ended worker ran, and what the new worker's receipt and check carry. See OD6.
- **The lead's own Never bullet** (`skills/project-lead/SKILL.md:60-61`) uses "your harness's permission check refused" with no definition and no pointer.
- **supervision-setup says nothing about a probe its harness refuses**: whether the operation binds, falls back or stops. This plan gives the worker a route for the line only.
- **A hook whose block names its own fix**, such as a commit-message check. Under the definition here it is a refusal, and "they run it, or they allow it" fits it badly. No source in the repo shows such a hook, so no rule is written for it.
- **Route 4 of the ladder relies on someone opening the worker's session.** project-lead's step 6 has the lead read notes and pull requests on each wake, never a silent worker's last reply.
- **The receipt has no place for a refusal** that was open during the story.
- **Unknown rows in the harness notes** (a hook's block, the built-in check, Codex's sandbox, Claude Code's wording for a denial) stay unknown until someone sees them.

### Sources

- GRO-33's description and three comments, as quoted in the lead's brief.
- The files under "Facts" below, read at `8cf2f13`.

---

## Planning Contract

### Facts at `8cf2f13`

"Verified" means the text was read at that line. "Inferred" means reasoning from what was read. "Not sourced" means no file in the repo shows it.

| ID | Fact | Where | Status |
| --- | --- | --- | --- |
| F1 | The refused-call bullet runs 30 lines and holds the whole procedure: the rule, the line, the choice, each answer, the clone and where session files stay. | `skills/story-worker/SKILL.md:48-77` | Verified |
| F2 | The rule's wording is "a command or any other call your harness's permission check refused". Nothing in the skill says what a refusal looks like. | same, `:48-50`; grep for "sandbox", "hook", "declin" over the file | Verified |
| F3 | A setup stop is the only message with a route before bindings exist: "as one `STATUS: blocked` line carrying setup's report line, sent back over the channel your launch came from, since no binding is loaded yet. With no lead, tell the maintainer directly. Then do nothing else." | same, `:106-110` | Verified |
| F4 | A refused send falls back to a work note: "Post its line as a note on the story's work item through the performer bound to `post-work-note` instead, with the `STATUS: refused` line for the send." Nothing says what follows a refused post. | same, `:433-438` | Verified |
| F5 | Going straight to the maintainer is defined only with no lead: "With no lead (\"none: the maintainer\"), the maintainer is your lead… A `STATUS: refused` line is a question too". The paragraph above it allows direct talk "only for real back-and-forth". | same, `:440-445`, `:421-426` | Verified |
| F6 | The rule "run the restart from the worktree after a move" is stated twice: "run setup and the restart with the worktree as the working directory" in Never, and "After a move to a clone, run it with the worktree as the working directory" under "Context and restart". Lines `:504-507` are a different rule, what the handoff carries. | same, `:73-77`, `:486-488` | Verified. That this is comment 2's "appears twice" is Inferred: the comment cites no line. |
| F7 | One moved sentence points at the list it sits in: "keep to every rule in this list, this one included". Outside the Never list those words point at nothing. | same, `:71` | Verified |
| F8 | `section()` reads from a `## ` heading to the next, so a sentence moved to a new `## ` section leaves `workerNever()`. | `test/supervision-routing-tables.test.ts:570-575`, `:1040` | Verified |
| F9 | The GRO-17 block pins all 14 sentences of the bullet whole, each through `workerNever()`. No test pins step 1's setup-stop sentences, "the only exception being a setup stop", or "Talk to the maintainer directly only". | same, `:1049-1142`; grep over `test/*.ts` | Verified |
| F10 | The portability patterns run over story-worker's Never, its defect section, "What you are given", step 3, and all of project-lead's `SKILL.md`. They catch paths, versions, `mcp__`, `word:word`, slash commands and `Skill(`. They would not catch `Operation not permitted`, `<sandbox_violations>` or `allowed_domains`. | same, `:70-82`, `:152-160`, `:618-624`, `:780-786`, `:809-814`, `:1049-1052` | Verified |
| F11 | The tracker and plan-tag patterns run over every Markdown file and script under `skills/`, the harness notes included. | same, `:1293-1318` | Verified |
| F12 | The harness notes hold per-harness observations under one rule: "Every claim here is **observed**, with the version and date it was seen on… or marked **unknown**." They already use "**reported, not re-observed**". | `skills/supervision-setup/references/harness-notes.md:8-11`, `:49` | Verified |
| F13 | The lead's side: it brings the maintainer one choice and passes the answer back "as what they did". Nothing says what happens when the worker's session has ended. | `skills/project-lead/SKILL.md:218-234` | Verified |
| F14 | A hand-back whose receipt check shows `plan` as `bound-but-unused` goes back to the worker, and so does one listing `plan` as not run for a story that is not a defect. The check reads only the sessions the bindings file lists. | `skills/project-lead/SKILL.md:330-335`; `skills/supervision-setup/scripts/receipt-check.mjs:49`, `:85-87` | Verified |
| F15 | `hand-back` is not required and falls back to a work note. `post-work-note` is required and has no fallback. | `skills/story-worker/routing.toml:208-217`, `:220-227` | Verified |
| F16 | `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/decisions/` and `docs/solutions/` do not restate the refused-call rule. `docs/solutions/` holds one file, on gitleaks. | grep for "refus" over the repo | Verified |
| F17 | Both manifests read `0.2.11`. | `.claude-plugin/plugin.json:3`; `.codex-plugin/plugin.json:3` | Verified |
| F18 | An unmerged story adds a section right after story-worker's step 8 and a passage in project-lead's step 7. | the lead's brief | Not verified here: the sibling clone was not read. |

### What the agent sees, by kind of refusal

Only what a file in the repo shows. Everything else is "not sourced", and its wording is an open question (OD2).

| Kind | Claude Code | Codex |
| --- | --- | --- |
| The permission check deciding alone (auto mode) | The call's result has `is_error` set to true: "such as a `<tool_use_error>` or a denied permission, means the call was refused" (`harness-notes.md:143-146`, observed 2026-10-04). That a classifier refuses calls is named in `skills/session-restart/scripts/restart-in-place.sh:13` and `skills/project-lead/SKILL.md:183`. **Its wording: not sourced.** | The item has `status: "failed"` (`harness-notes.md:277-280`, codex-cli 0.160.0, 2026-10-03). A fixture "trimmed from real records" (`test/supervision-receipt-check.test.ts:16-19`) gives the error as `This action was rejected due to unacceptable risk.` then `Reason:` (`test/fixtures/supervision/receipt-check/codex-outcomes/sessions/2026/10/03/rollout-2026-10-03T09-00-00-…a1.jsonl`, line 3). Which guard rejected it: not sourced. |
| A prompt the maintainer declined | "a denied permission" gives `is_error` true (`harness-notes.md:145`). **Its wording: not sourced.** | A command's item with `status: "declined"` and no exit code (the same rollout, line 7). That it is a declined prompt is inferred from the status's name. `codex-uses.mjs:46-48` adds that a call refused at an approval prompt "still writes its output". |
| A hook's block | **Not sourced.** | **Not sourced.** |
| The built-in removal check | **Not sourced** (named only in the issue). | **Not sourced.** |
| A sandbox denial | "`sandbox-exec` answers `Operation not permitted` (exit 71)" (`harness-notes.md:254-265`, Claude Code 2.1.288, 2026-10-03). The Bash call takes `allowed_domains`, a list of hosts, valid only for a sandboxed command (`test/fixtures/supervision/receipt-check/claude-outcomes/77770007-….jsonl`, lines 4-5). **A `<sandbox_violations>` block, and that a re-run with `allowed_domains` clears a denial: not sourced** (named only in the issue). | **Not sourced.** |

### Key Technical Decisions

- KTD1. **The definition turns on who stopped the call, not on a harness's wording.** "A guard stopped it, rather than the call running and failing by itself" holds on any harness, so it can live in skill text (R8). Each harness's wording goes in the harness notes (OD2).
- KTD2. **The pinned phrase "your harness's permission check" keeps its words and gains a meaning.** One sentence says it means any of the four guards. Every sentence that uses the phrase, in story-worker's steps 2 and 6, "Talking to your lead" and the bullet, stays as it is.
- KTD3. **Sentences move whole.** Eleven sentences move, and ten keep every word. One cannot (F7). See OD4.
- KTD4. **The bullet keeps the rule's first three sentences**, through "keep working on anything independent." The second, "Say so in each request…", needs the first as its antecedent, so it stays. Both of that test's assertions keep their reader.
- KTD5. **The section sits between "Talking to your lead, and to the maintainer" and "Bindings mid-story".** It is an event that can come at any step, like a binding that stops fitting, and the line's shape is defined just above it. It is also 45 lines clear of step 8's end, where the unmerged story inserts (F18).
- KTD6. **"(see Never)" stays where it is used.** The bullet still states the rule, and it forwards to the section. Five pinned strings keep their words (OD4, option B).
- KTD7. **One ladder, four routes, for any line whose send was refused**: lead, note, maintainer, own reply. Before setup completes, route 1 is the launch channel and route 2 is not yet bound, so C1 is the ladder's first rows and C2 its last (R5, OD3).
- KTD8. **When in doubt, refused.** A worker that cannot tell a refusal from a failure reports it. A needless report costs one message; a retry of a real refusal can hold the session at a prompt.
- KTD9. **The restart rule stays in both places** (OD5). Both copies are pinned whole, so they cannot drift apart unseen, and each sits where a worker reads it.
- KTD10. **Comment 3 is split out**, with one sentence here so the lead does not improvise (OD6).

### The proposed text

**T1. The Never bullet** (`skills/story-worker/SKILL.md:48-77`). The first three sentences stay. Everything from "While a command that rewrites…" to the end of the bullet leaves, and one sentence is added:

```text
- Retry, rephrase or hand to another session, a subagent or a performer a
  command or any other call your harness's permission check refused: repeated
  refusals hold a session at a prompt only the maintainer can answer. Say so
  in each request to a subagent or a performer: a call refused there comes
  back to you as it stands, never retried. Stop the work that depends on it,
  tell your lead at once with a `STATUS: refused` line, and keep working on
  anything independent. "A refused call" says what counts as refused, what the
  line carries, what each answer means, when a fresh clone is offered and
  where the line goes when it cannot be sent.
```

**T2. The new section**, between "Talking to your lead, and to the maintainer" and "Bindings mid-story". Sentences marked *(moved)* come from the bullet word for word. The one marked *(changed)* is OD4's string.

```text
## A refused call

**What counts as refused.** A call is refused when a guard stopped it,
rather than the call running and failing by itself, and what comes back is
the guard's answer, not the call's result. The guard is the harness's check on
what a session may run, whether it decides alone or puts a prompt to the
maintainer, who declines it; a hook that blocks the call; a check built into
the harness, such as one on a removal; or the sandbox. A sandbox denial is the
one that comes back inside a command's own output, as the system's "not
permitted" error. "Your harness's permission check" in this skill means any of
these. A non-zero exit, a command not found or a remote's own rejection is a
failure, not a refusal; when you cannot tell which you have, treat it as
refused. One sandbox denial is not a refusal: where your harness documents a
way to declare what a command needs, such as a host it must reach, run it once
with that declared. That is a declared need, not a way round the guard, and a
denial of that run is a refusal. The wording each harness gives is in
supervision-setup's harness notes, under "A refused call".

**The `STATUS: refused` line.** The line names the directory you ran it in,
which after a move says which of your two checkouts, and the exact command or
call. (moved) While a command that rewrites the branch or the worktree, such
as a reset or a rebase, awaits its answer, nothing in that checkout is
independent: change nothing there, and commit nothing. (moved)

**The answer.** Your lead brings the maintainer one choice: they run it, or
they allow it. Where they ran it, read the branch's head again before you go
on; where they allowed it, run it once, as it was. Where they declined, hand
back blocked, unless your lead rules another way. Once they have run or
allowed a command, running it again at a later step is a new command: if it is
refused again, report it again, and never retry it. (all moved)

**A fresh clone.** Only where a fresh clone removes the need for the command
does the choice become that they run it, or you redo the work in a fresh clone
of your own. A command that rewrites the branch or the worktree is such a
case. A refused fetch or push is not: the clone needs the same push, and
cloning is the same fetch. (moved) Take the clone only on that OK: first
commit on the worktree's branch whatever is uncommitted there, then bring into
the clone only the unpushed commits the redo keeps, keep to every rule under
Never, the one on refused calls included, work on the branch in that clone
from then on, and tell your lead with a `STATUS: moved` line. (changed) Your
session's own files, its bindings, its handoff and any restart marker, stay in
the worktree, where your lead looks for them: run setup and the restart with
the worktree as the working directory, reached by its full path, never from
the clone, since both write those files under the directory they run in.
(moved)

**When the line cannot be sent.** A refused send is a refused call too, and
its line still has to arrive. Send each line by the first of these routes that
is open, never twice by the same one, and with it a `STATUS: refused` line
for each send that was refused:

1. your lead, through the performer bound to `hand-back`, or, before setup
   completes, over the channel your launch came from, since nothing is bound
   yet;
2. a note on the story's work item, through the performer bound to
   `post-work-note`, once setup has bound it;
3. the maintainer directly, as a worker with no lead does: one question,
   through the question tool where your harness has one;
4. your own reply: write the lines there, where whoever opens your session
   reads them, and end your turn, changing nothing more until an answer comes.

With no lead, routes 1 and 3 are one. Once a route higher up opens again, tell
your lead in one line what went round them and what the maintainer answered.
```

The marks in brackets are this plan's, not the skill's: leave them out.

**T3. Step 1**, a new paragraph after "…With no lead, tell the maintainer directly. Then do nothing else." (`:110`):

```text
A call refused before setup completes is not a setup stop. Its line goes back
over that same channel, as a `STATUS: refused` line, and you start no story
work while it is open (see "A refused call").
```

**T4. "Talking to your lead"**, two edits in the paragraph at `:428-438`. Neither touches a pinned string.

- "the only exception being a setup stop, when nothing is bound yet" becomes "the only exceptions being a setup stop and a call refused before setup completes, when nothing is bound yet".
- One sentence is added at the paragraph's end, after "…the line already posted as a note is not sent again.":

```text
Where that post is refused as well, go on as "A refused call" says, which is
the one other case where you go to the maintainer directly.
```

**T5. project-lead's step 5**, one sentence at the end of the `STATUS: refused` bullet, after "…never tell the worker to retry it." (`:234`). See OD6.

```text
Where the worker's session has ended before the answer comes, no one is left
to take it: tell the maintainer so, and ask how the story is taken up.
```

**T6. The harness notes**, a new section between "herdr" and "Choosing a reviewer". Every claim is one the table above sources. The worker writing it adds nothing it has not read in a file or seen itself.

```text
## A refused call

What a session sees when a guard stops a call, by kind of guard.
story-worker's "A refused call" says which of these count as refused. Only
what was observed is described; the rest is **unknown**, so when one of them
happens to you, add what came back, word for word, with the version and date.

- **The harness's check, deciding alone.** Claude Code: the call's result has
  `is_error` set to true (see "A call that did not run"); the words it carries
  are **unknown**. Codex: the call's item has `status: "failed"`, and in the
  calls read its error began `This action was rejected due to unacceptable
  risk.`, then a line starting `Reason:` (refused `<tracker>.save_comment`
  calls, codex-cli 0.160.0, 2026-10-03; which guard rejected them was not
  recorded).
- **A prompt the maintainer declined.** Claude Code: the result has `is_error`
  set to true, as for any denied permission (observed 2026-10-04; the version
  was not recorded); its words are **unknown**. Codex: a command's item came
  back with `status: "declined"` and no exit code (a rollout of codex-cli
  0.160.0, 2026-10-03); that this was a declined prompt is inferred from the
  status's name.
- **A hook's block.** **Unknown** on both.
- **A check built into the harness**, such as one on a removal. **Unknown** on
  both.
- **A sandbox denial.** Claude Code: the command runs, and the system answers
  `Operation not permitted`, as `sandbox-exec` did with exit 71 (observed on
  2.1.288, 2026-10-03). Its Bash tool takes `allowed_domains`, a list of
  hosts, which applies only to a command that runs in the sandbox (seen in a
  transcript; the version and date were not recorded). That a denied host
  shows as a `<sandbox_violations>` block, and that a re-run naming the host
  in `allowed_domains` clears it, are **reported, not re-observed**. Codex:
  **unknown**.
```

**Portability.** T1 to T5 were run through the nine `NON_PORTABLE` patterns, the tracker pattern and the plan-tag pattern as copied from `test/supervision-routing-tables.test.ts:70-82` and `:1275`. None matched, and each moved sentence was matched word for word against the skill at `8cf2f13`. T6 is under the tracker and plan-tag patterns only (F11), and matched neither. By eye: T1 to T5 name no harness, no tool and no parameter.

### Existing assertions the restructure touches

All in `test/supervision-routing-tables.test.ts`, in the `GRO-17` block. "Reader" means the section the assertion reads.

| Lines | Test | Sentence | Change |
| --- | --- | --- | --- |
| `1071-1075` | nothing in a checkout moves while a command that rewrites it awaits its answer | "While a command that rewrites…" | reader only |
| `1077-1080` | the worker's refused line names the directory first… (first `expect` of three) | "The line names the directory…" | reader only |
| `1101-1110` | the worker is offered a clone only where… (three `expect`s) | "Your lead brings…"; "Only where a fresh clone…"; the clone case and the fetch-or-push sentence | reader only |
| `1112-1116` | the worker reads the head again… | "Where they ran it…" | reader only |
| `1118-1122` | a worker whose command the maintainer declined… | "…as it was. Where they declined…" | reader only |
| `1124-1130` | a command is a new command… (both `expect`s) | "Once they have run or allowed…" | reader only |
| `1138-1142` | a moved worker's session files stay in the worktree… | "Your session's own files…" | reader only |
| `1132-1136` | the worker takes the clone only on the maintainer's OK… | "Take the clone only on that OK…" | reader, **and the string**: "keep to every rule in this list, this one included" becomes "keep to every rule under Never, the one on refused calls included" |

That is 7 tests and 10 `expect`s whose reader changes from `workerNever()` to the new section's, and 1 test whose string changes too. Nothing is deleted.

Not touched: `1049-1052` (the patterns over Never), `1054-1063` and `1065-1069` (the three sentences that stay), every "(see Never)" assertion (`1144-1154`, `1218-1223`, `1231-1235`, `1261-1265`), and every assertion on the lead's text.

### Assumptions

Bets this plan made without asking.

- "The channel your launch came from" means the same thing for a refusal's line as for a setup stop's. The plan reuses the words and does not define them.
- A worker's own reply is somewhere a person can read. Route 4 rests on it.
- A question put through the question tool reaches the maintainer. story-worker already relies on it for a worker with no lead (`:440-445`).
- Bold lead-ins inside a section are in house style: steps 5 and 7 use them.
- The unmerged story edits where the lead's brief says, and nowhere this plan edits (F18).

### What restates or points at the change

Every hit outside `docs/plans/` for "refus", "(see Never)", "permission check", "sandbox", "declin" and "setup stop".

| Where | What it says | Edit? |
| --- | --- | --- |
| `skills/story-worker/SKILL.md:48-77` | the bullet | **Yes** (T1) |
| same, `:106-110`, step 1 | the setup stop | **Yes** (T3): a paragraph after it |
| same, `:131-132`, `:139-141`, step 2 | "after a refused command (see Never)"; "A refused fetch is a refused command (see Never)" | No (KTD6) |
| same, `:302-303`, step 6 | "A push your harness's permission check refuses is a refused command (see Never)." | No (KTD2, KTD6) |
| same, `:374-380`, step 8 | a refused call awaiting its answer is not an ending | No. Route 4 ends a turn, not the story. |
| same, `:421-426` | direct talk with the maintainer "only for real back-and-forth" | No. T4's new sentence names the one other case. |
| same, `:428-438` | every message goes through `hand-back`; a refused send goes as a note | **Yes** (T4) |
| same, `:440-445` | with no lead, the maintainer is the lead | No. Route 3 cites it. |
| same, `:447-452` | the two message shapes | No |
| same, `:458-463` | keep working while a refusal is open | No |
| same, `:486-488`, `:504-507` | restart from the worktree after a move; the handoff carries the clone | No (KTD9) |
| `skills/story-worker/routing.toml:208-227` | `hand-back`'s fallback is a work note; `post-work-note` is required | No. Both agree with the ladder. |
| `skills/story-worker/references/receipt.md` | no mention of a refusal | No |
| `skills/project-lead/SKILL.md:60-61` | the lead's own Never bullet | No (deferred) |
| same, `:160-161`, `:181-185` | a worktree left only on an approved move; a refused launch | No |
| same, `:218-234` | the lead's side of `STATUS: refused` | **Yes** (T5): one sentence at the end |
| same, `:235-237`, `:270-272` | `STATUS: moved`; a line posted as a note because its send was refused | No. Both stay true. |
| same, step 7 (`:296-389`) | the hand-back check | No, and not to be touched (F18) |
| `skills/project-lead/references/defect-run.md:146`, `intent-run.md` | a clone a worker moved to | No |
| `skills/supervision-setup/SKILL.md` | setup's stops; no mention of a refusal | No (deferred) |
| `skills/supervision-setup/references/harness-notes.md:143-146`, `:254-265`, `:277-280` | a call that did not run; a nested sandbox; a refused Codex call | **Yes** (T6): a new section that cites them |
| `skills/supervision-setup/scripts/transcript-uses.mjs:29-30`, `codex-uses.mjs:34`, `:46-48`, `receipt-check.mjs:32` | "refused" as one way a call did not run | No. The check counts calls; it does not define the rule. |
| `skills/session-restart/SKILL.md:253-291`, its scripts | herdr refusing a name; a helper's own `refuse` | No: other senses of the word |
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/decisions/`, `docs/solutions/` | nothing on the rule (F16) | No |
| `test/supervision-routing-tables.test.ts:1031-1272` | the `GRO-17` block | **Yes** (U1, U2) |
| `test/fixtures/` | the outcome fixtures the table above cites | No |
| `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` | `version` | Waits (U6) |

### Sequencing

1. U1, the new failing tests.
2. U2 repoints the existing assertions, which turns them red.
3. U3 makes U1's story-worker tests and all of U2 green.
4. U4 and U5 make the rest of U1 green.
5. U6 waits for the lead's version number.

---

## Implementation Units

### U1. Failing tests for the new text

- **Goal:** pin the definition, the ladder, the pointer and the lead's sentence before any skill text changes.
- **Requirements:** R1 to R9.
- **Files:** `test/supervision-routing-tables.test.ts`.
- **Patterns:** the `GRO-17` block and its helpers `section`, `read`, `flat`, `WORKER`, `LEAD`, `idsOf` and `textProblems`.
- **Approach:**
  1. Add one `describe`, titled for GRO-33, right after the `GRO-17` block and before the `PLAN_TAG` constant. Not at the end of the file, where another story may add its own.
  2. Give it a doc comment in the file's style: the tracker id, then the rule in two or three lines.
  3. Declare its readers inside the block: the new section, Never, step 1, "Talking to your lead", the lead's step 5, and the notes' section. Build the notes' path inside the block.
- **Test scenarios.** Each reads its text with whitespace collapsed to one space. All are red at `8cf2f13`: scenarios 1 to 7 because the section does not exist, 8 to 11 because the sentence is absent.
  1. story-worker has a section "A refused call", and it sits after "Talking to your lead, and to the maintainer" and before "Bindings mid-story".
  2. That section names no harness, path, version or tracker: it is not empty, and `textProblems` returns nothing.
  3. It defines a refusal by who stopped the call: it contains T2's first sentence, the sentence listing the four guards, and "\"Your harness's permission check\" in this skill means any of these."
  4. It tells a refusal from a failure: it contains "A non-zero exit, a command not found or a remote's own rejection is a failure, not a refusal; when you cannot tell which you have, treat it as refused."
  5. It says a declared need is not a refusal: it contains T2's two sentences from "One sandbox denial is not a refusal" to "a denial of that run is a refusal."
  6. It gives one ladder: it contains the opening sentence of "When the line cannot be sent", each of the four routes whole and in order, and the closing two sentences.
  7. Its pointer resolves: it contains "supervision-setup's harness notes, under \"A refused call\"", and the harness notes have a section of that name.
  8. The notes' section names all five kinds and marks what was not seen: it contains each of the five bold lead-ins, and "- **A hook's block.** **Unknown** on both."
  9. The bullet keeps the rule and points on: Never contains T1's last sentence, and no longer contains "Your lead brings the maintainer one choice" or "Take the clone only on that OK".
  10. A call refused before setup completes has a route: step 1 contains T3 whole, and "Talking to your lead" contains T4's reworded clause and its new sentence.
  11. The lead asks how a story is taken up when its worker has ended: the lead's step 5 contains T5 whole.
- **Verification:** the eleven scenarios are red, every earlier test is green, and the typecheck passes.

### U2. Repoint the assertions on the moved sentences

- **Goal:** the existing assertions follow their sentences to the new section, before the sentences move.
- **Requirements:** R6.
- **Dependencies:** U1, and the lead's ruling on OD4.
- **Files:** `test/supervision-routing-tables.test.ts`.
- **Approach:**
  1. Add one reader to the `GRO-17` block for the new section.
  2. Change the reader, and nothing else, in the seven tests the table above marks "reader only".
  3. In the test at `1132-1136`, change the reader and the one string, and bring its title's "this one included" into line.
  4. Leave every other assertion in the block as it is.
- **Test scenarios:** the eight tests of the table, now reading the new section.
- **Verification:** those eight are red, since the section does not exist yet. `1049-1069` stay green.

### U3. story-worker's text

- **Goal:** the definition, the moved procedure, the ladder and the two pointers.
- **Requirements:** R1 to R6, R8.
- **Dependencies:** U1, U2.
- **Files:** `skills/story-worker/SKILL.md`.
- **Approach:**
  1. Write T2 as a new section in the place KTD5 names.
  2. Cut the bullet down to T1. Move each sentence rather than retyping it, so the one changed string is the only difference.
  3. Add T3 after step 1's setup stop.
  4. Make T4's two edits.
  5. Leave steps 2, 6 and 8, "Context and restart" and the message shapes alone.
- **Test scenarios:** U1's scenarios 1 to 7, 9 and 10, and U2's eight.
- **Verification:** they pass. The test on Never's portability still passes. A by-eye read finds no harness, tool or parameter named in the new text.

### U4. The harness notes

- **Goal:** one place for what each harness shows, with the unseen marked unknown.
- **Requirements:** R1, R9.
- **Dependencies:** U1.
- **Files:** `skills/supervision-setup/references/harness-notes.md`.
- **Approach:** write T6 between "herdr" and "Choosing a reviewer". Check each claim against the source the table above gives before writing it. Where the worker has itself seen one of the unknowns in this story, it adds what it saw, with the version and date, and says so in its hand-back.
- **Test scenarios:** U1's scenarios 7 and 8, and the existing tracker and plan-tag tests over `skills/`.
- **Verification:** they pass.

### U5. The lead's sentence

- **Goal:** a lead whose worker has ended asks, rather than improvising a successor.
- **Requirements:** R7, R8.
- **Dependencies:** U1, and the lead's ruling on OD6.
- **Files:** `skills/project-lead/SKILL.md`.
- **Approach:** add T5 at the end of step 5's `STATUS: refused` bullet. Touch nothing in step 7.
- **Test scenarios:** U1's scenario 11, and the existing portability test over the whole file.
- **Verification:** they pass, and every `GRO-17` assertion on the lead's text still passes.

### U6. Version bump

- **Goal:** installs pick the change up.
- **Files:** `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`.
- **Approach:** both to the next free number, named by the lead at merge time. They read `0.2.11` today.
- **Test expectation:** none new. `test/plugin-manifests.test.ts` already holds the two equal.

---

## Verification Contract

- The repo's two checks pass: the typecheck and the tests.
- U1's eleven scenarios were red before U3 to U5 and are green after.
- No assertion that existed at `8cf2f13` was deleted, and only the one string in OD4 changed.
- The pull request's diff does not touch story-worker's step 8 or project-lead's step 7.
- Every claim in T6 traces to a line the table "What the agent sees" cites.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| The definition makes workers stop on ordinary permission errors, since `Operation not permitted` is also what a plain file-permission failure prints. | KTD8 accepts it: the cost is one message. OD1's option C removes it. |
| A flat rule on hooks stalls a worker on a hook that only wants a change to the call. | Deferred, and named in Scope Boundaries. No source shows such a hook here. |
| Route 4 leaves lines where nobody looks. | Deferred. A session at a question (route 3) comes first, and that does reach the maintainer. |
| The unmerged story lands in the same test file or near "Talking to your lead". | KTD5 and U1 keep 45 lines and a separate block between them. A conflict there is mechanical. |
| A reviewer reads "(see Never)" as stale once the procedure has moved. | KTD6: the bullet still states the rule and names the section. OD4's option B repoints all five. |

---

## Open Decisions

### OD1. Which guards count as a refusal?

The issue asks about four. The text does not settle it.

- **A (recommended, planned).** All of them count: the permission check deciding alone, a declined prompt, a hook's block, the built-in check, and a sandbox denial. One exception, the issue's own suggestion: a sandbox denial that a documented declared-need re-run clears. When in doubt, refused.
  - Why: every one is a guard's decision, and the rule's reason, not working round a guard, covers each. The issue's wording treats a sandbox denial as a refusal by default, or its exception would not be needed.
  - Consequence to accept: a worker never re-runs a command outside the sandbox on its own. It reports.
- **B.** A sandbox denial is a failure, not a refusal. Any re-run the harness offers goes through the permission check, and only that check's answer is a refusal. Delta: drop "or the sandbox" and the two sandbox sentences from T2; scenario 5 goes.
- **C.** As A, without "when you cannot tell which you have, treat it as refused". Delta: one clause of T2 and of scenario 4.

### OD2. Where do the per-harness signs live?

- **A (recommended, planned).** A harness-neutral definition in story-worker, and a new section in the harness notes holding what each harness was seen to show, the rest marked unknown.
  - Why: `AGENTS.md` keeps harness-specific forms out of skill text, and the notes are where observations already live under an observed-or-unknown rule (F12).
  - What it leaves open: five of the ten cells are unknown outright, and three more lack the wording. The issue's examples, `<sandbox_violations>` and the `allowed_domains` re-run, go in as reported, not observed.
- **B.** The definition only. Delta: drop U4, T2's last sentence and scenarios 7 and 8.
- **C.** Name the signs in story-worker itself, as step 5 names Codex's `spawn_agent`. It would pass the patterns (F10) and fail `AGENTS.md` by eye, and it would put strings no source shows into skill text.

### OD3. The ladder's lower routes

- **A (recommended, planned).** Lead, then note, then the maintainer directly, then the worker's own reply and a stop. Before setup completes, route 1 is the launch channel.
  - Why: each route is one the skill already has for another case (F3, F4, F5), so nothing new has to be bound. A reply cannot be refused, so the ladder always ends.
- **B.** No direct route to the maintainer for a worker that has a lead: after a refused note, write the lines in the reply and stop. Delta: drop route 3, "With no lead, routes 1 and 3 are one", and the last clause of T4's new sentence.
- **C.** At route 4 the worker keeps working on what is independent before it ends its turn. Delta: route 4's last clause. Not recommended: with every send refused, nobody knows what the worker is doing.

### OD4. May these existing assertions change?

The exact list is under "Existing assertions the restructure touches".

- **A (recommended, planned).** Seven tests change their reader only, and one changes its reader and one string, because "in this list" points at nothing outside the Never list (F7).
- **B.** Also repoint "(see Never)" to the new section in steps 2 and 6 and "Talking to your lead". Delta: five more strings change, at `1146`, `1152`, `1221`, `1233` and `1263`.
- **C.** Change no string: leave "Take the clone only on that OK…" in the bullet. Delta: the bullet keeps five lines of the clone procedure, and the section reads with a hole.

### OD5. The restart rule appears twice. Remove one copy?

- **A (recommended, planned).** Keep both, each moved or left whole. No assertion changes for it.
  - Why: both are pinned whole, so they cannot drift unseen, and each is where a worker reads it. Stated plainly: this leaves comment 2's "appears twice" as it found it.
- **B.** Keep the rule under "Context and restart" and trim the moved sentence to setup. Delta: the string at `1138-1142` changes to "…run setup with the worktree as the working directory, reached by its full path, never from the clone, since it writes those files under the directory it runs in; so does the restart (see \"Context and restart\")."
- **C.** Keep the moved sentence and make the one at `:486-488` a pointer. Delta: the string at `1156-1160` changes.

### OD6. Comment 3: plan it here, or split it?

- **A.** Plan the mid-flight rule here.
- **B (recommended, planned).** Split it into its own story, and add T5 here so a lead with an answer and no worker asks the maintainer.
  - Why split: it is not a refused-call rule. The comment says it is the same gap as any worker that ends with no handoff. It needs a rule for what counts as evidence of an ended worker's steps, and either a way for the new worker's check to read the ended session or a change to what the lead accepts (F14). The second lands in project-lead's step 7, where an unmerged story is working, and would weaken a pinned assertion. It would double this diff.
  - What the new story must settle: whether the new worker's bindings list the ended worker's sessions; what stands in for a step with no transcript (a plan file on the branch, a review); where Started comes from with no handoff; and what the lead's check accepts.
- **C.** Split it and add nothing here. Delta: drop U5, T5 and scenario 11.

---

## Definition of Done

- The lead has ruled on OD1 to OD6, and the text follows the rulings.
- U1 to U5 are done, and the repo's checks pass.
- The in-session review ran before the pull request opened, sized as `AGENTS.md` says.
- The pull request is a draft until the branch is final, links GRO-33, and names the deferred items.
- Both manifests carry the version the lead named.

---

## The worker's notes on this plan (2026-10-12, before the lead's ruling)

Written by the story's worker after reading the plan against the source. The plan above is as the planner wrote it.

- **Checked by the worker at `8cf2f13`:** the reader `workerNever()` at `test/supervision-routing-tables.test.ts:1040` and its twelve uses; the string "in this list, this one included" at `:1134`; the five "(see Never)" strings at `:1146`, `:1152`, `:1221`, `:1233` and `:1263`; `hand-back` not required and `post-work-note` required in `skills/story-worker/routing.toml`; the harness notes' lines `:143`, `:258` and `:278`; the two Codex fixtures and the Claude Code fixture the table cites. No file outside `docs/plans/` holds the words `sandbox_violations`.
- **One claim in T2 is thinner than it reads.** "A sandbox denial is the one that comes back inside a command's own output, as the system's "not permitted" error" rests on one observation, a nested sandbox refusing to start (`harness-notes.md:258`), and on the issue's own wording. It is inferred for every other denial.
- **The worker will look for real refusals before writing T6.** This worker's own earlier sessions on this machine may hold calls a guard stopped. Each one found goes into the harness notes as observed, with the harness version and the date, and every row with none found stays **unknown**. The pull request says which rows were filled this way.
- **Not run on this plan:** the plan skill's document review and its research subagents, to keep the run small. The lead reads the proposal instead.
