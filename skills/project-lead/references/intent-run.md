# An intent run

Load this when the maintainer starts you on plain intent instead of an epic: a
prompt describing a task, with no work item and no plan. An intent run sizes
the task, picks how to carry it, and files the work items once the maintainer
has approved that choice. Everything in `SKILL.md` holds, except the steps this
file replaces by name below.

## What changes from an epic

- **The intent is the source.** Keep the maintainer's prompt word for word.
  It and the sizing below stand in for the epic's plan until a breakdown or a
  filed work item replaces them.
- **Setup has no work item yet.** Read this file before setup. In step 1 of
  `SKILL.md`, "Setup", give setup the task alone, with no work item, as a
  defect run does: you file the run's work item once the shape is approved.
  Your name is `<run-short>-lead`, a short name for the task, under the same
  rules as an epic lead's.
- **Sizing comes before the shape.** The shape names a route, and only sizing
  can tell which, so step 2's approval comes after sizing, below.
- **Nothing is filed before the OK.** The work items wait for the approved
  shape, so a rejected shape leaves nothing to clean up.

## 1. Sizing

Size the task before anything else. The sizing is a fresh subagent you start
for it, given the intent, not your assignment, and told that it is answering a
question, not running the run. It only reads: the code and its history, the
work tracker's items and the merged pull requests, to find earlier work on the
same ask. It runs no code and writes nothing. Where your harness offers no
subagent, size the task yourself under the same limits.

The sizing returns:

- **Outcome:** what is true once the task is done, in one or two sentences.
- **Units:** the pieces of work, each small enough for one worker and one pull
  request, with the files each likely touches and how each is verified.
- **Size:** for a single unit, whether it can be built, reviewed and handed
  back before a session reaches its restart line.
- **Open questions:** each with its options, or "none".
- **Already done:** the commit, pull request or work item that already covers
  the ask, or "no".

## 2. Questions

Put each open question to the maintainer through the performer bound to
`report-to-maintainer`, one at a time, before the shape. A worker must never
start on a guess about what the maintainer meant.

If the sizing finds the ask already done, or answered by reading alone, tell
the maintainer what it found and end the run. File nothing.

## 3. The run's shape, approved

Step 2 of `SKILL.md` holds, with these changes. The run's source is the intent
with its sizing, and its authorisation is the maintainer's start plus their OK
on the shape. The shape's first line names one route:

- **Carry it itself** when all of these hold: the sizing found one unit; no
  other worker of yours is in flight or planned; and the sizing says the unit
  can be built, reviewed and handed back before this session reaches its
  restart line.
- **One worker** when the sizing found one unit but carrying it yourself does
  not fit.
- **A breakdown** when the sizing found more than one unit.

If the maintainer changes the shape, revise it and ask again. Start nothing
before the OK.

## 4. Filing

Once the shape is approved, file the work through the performer bound to
`file-stories`:

- **One unit**, carried by you or by one worker: one work item that holds the
  intent word for word and the sizing's summary. It is the story's own source
  and the run's work item at once.
- **A breakdown:** step 3 of `SKILL.md` holds. Invoke the performer bound to
  `produce-breakdown` from the intent and the sizing; its plan becomes the
  source, and the maintainer confirms it before anything is filed. Then file a
  run item, which stands in for the epic's work item, and one work item per
  story pointing at its section of the plan.

Post the sizing on the run's work item through the performer bound to
`post-work-note`, so a successor can read it. Where `file-stories` runs by its
fallback, the maintainer files, and no worker starts on a story without a work
item, as step 3 of `SKILL.md` says.

## 5. One worker, or a breakdown

From here the run is an epic's: start each ready story as step 4 of `SKILL.md`
says, through `start-worker`, and carry on from step 5. A worker filed from
plain intent takes its work item as its own source.

## 6. Carrying it yourself

When the approved route is to carry the one story yourself, you stop being a
lead and become its worker:

1. **Make its worktree** as step 4 of `SKILL.md` says: one for the story, on
   the branch name the repo's instructions give, from the current base at a
   full commit SHA. Work only there from now on.
2. **Run the `story-worker` skill** there on the story, with "none: the
   maintainer" as your lead. It runs its own setup in the worktree, so its
   bindings sit apart from yours.
3. **From then on, `story-worker` governs.** Its review, receipt, draft pull
   request and merge gate all hold: the maintainer approves the merge. The
   lead's steps no longer apply, and you start no other worker. If the story
   grows past one pull request, that is work beyond the story, and it goes to
   the maintainer as `story-worker` says.

This is the one case where a project lead's session writes code, and only
because the session is no longer leading anything.

## Your handoff

An intent run restarts like any other lead. Before filing, its handoff also
carries: that you run this reference, `references/intent-run.md`; the intent
word for word; the sizing; each open question with its answer or "waiting";
and the approved shape, if there is one. After filing, it names the run's work
item and the stories, as an epic lead's does. A session carrying the story
itself restarts as a worker, through `story-worker`'s own restart, and its
handoff names that skill.
