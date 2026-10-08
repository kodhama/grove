---
type: decision
title: "Supervision operating model: the live decisions"
description: The supervision epic's live decisions, moved out of the retired epic state file. Each is restated as it stands today, with its original date, where it is carried now and a link to its archived D-entry; every other D-entry gets one line saying what carries or closed it, and D07 an entry for its 2026-10-02 supersession.
tags: [agent-workflow, supervision, decisions]
decided: 2026-10-02
status: restates the decisions of 2026-09-20 to 2026-09-23 and where each is carried now; records later maintainer rulings (D07, 2026-10-02; D27, 2026-10-08), and makes none of its own
ticket: MQ-355
---

# Supervision operating model: the live decisions

**Moved to grove on 2026-10-07 (GRO-6)** from kodhama/math-quest's
[`docs/decisions/supervision-operating-model.md`](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/decisions/supervision-operating-model.md)
at `65747f43`, with the skills it governs. Supersede an entry here from now
on. Read the entries below as of that move:

- **Every path and quoted section** in them, linked or not, names
  math-quest's files at that commit: `.agents/skills/`, its `AGENTS.md`, its
  `.compound-engineering/config.yaml`. In grove the skills are under
  `skills/`, and grove's own `AGENTS.md` does not restate math-quest's rules.
- **MQ ids** name math-quest's work items.
- **One change in meaning:** Codex's in-place restart, MQ-366 there, is GRO-3
  here.

**2026-10-02 · MQ-355.** The supervision epic kept its decisions, D01 to D25, in
an epic state file. The
[operating model plan](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md)
retired that file (R27–R29, KTD13). It is now frozen at
[`docs/archive/reproducible-agent-supervision-epic-state.md`](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md),
and the issue list it kept stays in Linear. This record is where those decisions
can be superseded from now on.

It makes no ruling of its own. Each live decision is restated as it stands
today, with its original date, who decided it, the files or issues that carry
it now, and any way it has changed since. Two later maintainer
rulings are recorded: D07's supersession, and D03's by D26. Every entry from
D01 to D25 links to its archived D-entry, which keeps the original reasoning
and source; D26 is new here. The skill paths below are under
`.agents/skills/`.

**How it is kept.** Entries are append-only, as the state file's were. To change
a decision, add a new entry, and give the old one a `Superseded by` line and
nothing else.

## Live decisions

These still govern what the skills do. KTD13 named them. The story worker's
review and draft-PR steps rest on D08, D11, D17, D25 and D26.

### D08 — The PR's automated reviewers are the second round, not the first

- 2026-09-20 · supervision lead · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d08--the-shipped-revision-is-not-re-reviewed-before-push-the-prs-reviewers-are-the-second-round)
- **Decision:** a change is reviewed on its branch before its PR opens. The
  repo's automated PR reviewers are the second round.
- **Carried by:** `AGENTS.md`, "Review loop"; `story-worker/SKILL.md`, step 7
  ("The repo's automated reviewers are the second round").
- **Changed since:** the original entry said the shipped revision is not
  reviewed again before push. The project lead now reviews the final head again
  from fresh context before asking for the merge, and does so again for every
  head a fix pass makes (`project-lead/SKILL.md`, step 7).

### D11 — A diff that makes claims about files outside itself is reviewed with the checkout

- 2026-09-20 · supervision lead, replacing D09 · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d11--a-diff-that-makes-claims-about-files-outside-itself-is-reviewed-with-the-checkout)
- **Decision:** if a change cites, quotes or makes claims about files it does
  not change, its reviewer gets read access to the repository.
- **Carried by:** `story-worker/SKILL.md`, step 5 ("Give it the checkout when
  the diff reaches outside itself").

### D13 — A session detects what it can use, in stages

- 2026-09-21 · maintainer · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d13--a-supervisor-detects-what-it-can-use-in-stages)
- **Decision:** the session checks a named target first and searches openly only
  when that target is missing.
- **Carried by:** `supervision-setup/SKILL.md`, which runs an exact-match check
  of each operation's suggested performers and only then a discovery step (plan
  R11, R12). MQ-272 is closed on it.
- **Changed since:** the original entry persisted the epic's choice in its
  tracked state, so that a restart could reuse it. Bindings now belong to each
  session, kept in the gitignored `.context/supervision/<session-name>/` (KTD2),
  and a restart rechecks them rather than trusting them.

### D15 — herdr is the fleet view and the cross-harness message broker

- 2026-09-22 · maintainer · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d15--herdr-is-the-fleet-view-and-the-cross-harness-message-broker)
- **Decision:** messages go by SendMessage between Claude sessions and by herdr
  to every other harness. herdr is also the maintainer's view of the fleet.
- **Carried by:** plan R19 and R24; the `SendMessage, herdr` performers in
  `project-lead/routing.toml` and `story-worker/routing.toml`.

### D16 — Leads run with Remote Control, including after a restart

- 2026-09-22 · maintainer · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d16--leads-run-with-remote-control-including-after-a-self-restart)
- **Decision:** a lead's session keeps Remote Control, so the maintainer can
  follow it from the Claude app, and keeps it across a restart.
- **Carried by:** `session-restart/SKILL.md`. An in-place restart keeps the
  session's Remote Control connection, and a successor session is launched with
  remote control on.
- **Changed since:** workers now launch with remote control on as well
  (`project-lead/routing.toml`, `start-worker`).

### D17 — CE's standing PR babysit watch is off

- 2026-09-22 · maintainer · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d17--ces-standing-pr-babysit-watch-is-off-repo-wide)
- **Decision:** CE keeps no standing watch over the PRs it opens. A run turns
  that watch off with the invocation token, not only with the config setting.
  `lfg`'s own in-pipeline babysit is bounded and still runs.
- **Carried by:** `auto_babysit: false` in `.compound-engineering/config.yaml`;
  `story-worker/SKILL.md`, step 6 (`babysit:off`).

### D18 — The maintainer approves every worker merge

- 2026-09-22 · maintainer · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d18--the-maintainer-approves-every-worker-merge-for-now)
- **Decision:** no worker merges. The maintainer approves each merge, and the
  approval covers the specific head the lead read.
- **Carried by:** `story-worker/SKILL.md`, Never ("The maintainer approves every
  merge"); `project-lead/SKILL.md`, Never and step 7 ("Merge only on their
  approval of the head you read").
- **Changed since:** the skills drop the original "for now". The lead, not the
  worker, carries out an approved merge.

### D19 — No agent delivers a message by typing into a terminal the maintainer may be using

- 2026-09-22 · maintainer · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d19--no-agent-delivers-a-message-by-typing-into-a-terminal-the-maintainer-may-be-using)
- **Decision:** typed text lands inside whatever the maintainer is typing, so no
  agent delivers a message by typing into a pane the maintainer may be using.
- **Carried by:** `AGENTS.md`, "What you must NOT do"; the Never lists of
  `project-lead/SKILL.md` and `session-restart/SKILL.md`.

### D21 — Each session owns its own continuity

- 2026-09-23 · maintainer · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d21--command-is-decentralised-each-session-owns-its-own-continuity)
- **Decision:** leads and workers restart themselves between tasks when their
  context calls for it. A lead does not restart its workers.
- **Carried by:** plan R20 and R33; the "Context and restart" sections of
  `story-worker/SKILL.md` and `project-lead/SKILL.md`; `session-restart`.
- **Changed since:** a restart now happens in place first, keeping the session's
  `-n` name (KTD7), which settles the original's open question about the
  address. A worker that cannot restart itself, such as a Codex worker until
  GRO-3, hands its restart to its lead (`restart-owner: lead`).

### D23 — The self-restart sits behind a skill

- 2026-09-23 · maintainer, for a reusable procedure; skill rather than agent
  is the supervision lead's reasoning, on MQ-285 · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d23--the-self-restart-sits-behind-a-skill-proved-first-on-the-supervision-lead-and-its-workers)
- **Decision:** the restart procedure is a skill, loaded by the session that is
  leaving.
- **Carried by:** `session-restart/SKILL.md`, merged in #812 and wired into
  setup in #823; MQ-285 is closed on it.

### D24 — Workers' herdr workspaces sit under the lead's, fixed at launch

- 2026-09-23 · maintainer · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d24--workers-herdr-workspaces-sit-under-the-leads-fixed-when-they-are-launched)
- **Decision:** a lead launches each worker inside its own terminal workspace,
  so herdr shows who is doing what.
- **Carried by:** `project-lead/SKILL.md`, step 4 ("in your own terminal
  workspace, without taking focus"); plan U7.
- **Changed since:** the original said that a restart opens a new tab in the
  session's workspace. An in-place restart keeps the session's own pane, so
  that now holds only on the new-session path. No skill names the herdr command.

### D25 — Fixes land in draft; Gemini re-reviews every push, Codex only when asked

- 2026-09-23 · the CI-reviewer lead, under MQ-305 · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d25--fixes-land-in-draft-gemini-re-reviews-every-push-by-itself-codex-only-when-asked)
- **Decision:** a PR stays a draft while fixes are still landing and is marked
  ready when the branch is final. Gemini skips drafts and re-reviews every push;
  Codex re-reviews only on `@codex review`.
- **Carried by:** `AGENTS.md`, "Review loop"; `story-worker/SKILL.md`, steps 6
  and 7.

### D26 — The reviewer runs in a subagent, never a sibling session

- 2026-10-03 · maintainer, on the MQ-357 run plan · supersedes D03
- **Decision:** the reviewer is never the author. Each worker starts its own
  reviewer in a subagent with a fresh context (on Codex, a `spawn_agent`
  child), never in a sibling session, and the lead does not supply one.
- **Why:** the receipt check reads a session's own transcripts and the
  subagent transcripts beside them, so a review in a sibling session read as
  bound-but-unused (MQ-357, the first of its three findings from U8).
- **Carried by:** `story-worker/SKILL.md`, step 5 ("Someone else reviews") and
  its Never list; the `review` fallback in `story-worker/routing.toml`; the
  receipt's "Reviewed by" line in `story-worker/references/receipt.md`.

### D27 — A lead may carry a one-story intent run itself, as that story's worker

- 2026-10-08 · maintainer, on GRO-7 · changes D01 for this route only
- **Decision:** a lead started on plain intent, with no epic, work item or
  plan, sizes the task and puts a route in its run's shape. When the maintainer
  approves carrying a one-story run itself, the lead's session becomes that
  story's worker: it runs `story-worker` on the story with the maintainer as
  its lead, keeping the worker's review, receipt, draft pull request and merge
  gate. Every other lead still never writes code. The lead files the work items
  once the shape is approved; there is no untracked run.
- **Why:** the maintainer's direction of 2026-10-02 (on GRO-1) that a lead's
  input can be just a big task, and that a task which turns out small should
  not go through the full breakdown-and-workers machinery. Carrying it as a
  worker, not as ad-hoc edits by the lead, keeps every gate a worker's change
  passes. Filing keeps the work note, the receipt and the handoffs, which all
  rest on a work item.
- **Carried by:** `project-lead/references/intent-run.md`; the intent-run
  paragraph, the code exception and its Never entry in `project-lead/SKILL.md`.

## Carried or closed by the plan

None of these has a `Superseded by` line in the archive. Each is now carried by
the plan or a skill, or closed. D07, which KTD13 listed here too, has its own
entry under [Superseded since](#superseded-since).

- **D01**, layered planning (2026-09-20, [archived](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d01--planning-is-layered-the-supervisor-keeps-state-and-does-not-touch-code)):
  carried. The lead never writes code (`project-lead/SKILL.md`), and each
  worker decides how its story is built (`story-worker/SKILL.md`). Its
  persisted state with HTML views is closed by the plan's retirement of the
  state file (R27, R29). **Changed since:** [D27](#d27--a-lead-may-carry-a-one-story-intent-run-itself-as-that-storys-worker),
  2026-10-08: a lead carrying a one-story intent run itself writes its code,
  as that story's worker.
- **D02**, two supervisory layers (2026-09-20, [archived](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d02--two-supervisory-layers-epic-supervisor-and-issue-owner)):
  carried as the project lead and the story worker (plan R1, R2). Only the lead
  asks for the OK before it starts. The worker reports its setup and starts.
- **D04**, discovery per run, configuration as a seed (2026-09-20, [archived](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d04--who-does-what-is-discovered-per-run-configuration-is-a-seed)):
  carried by `supervision-setup`. The seed is each skill's `routing.toml` plus
  `.agents/routing-overrides/`, bound once per session (plan KTD1, R11–R16).
- **D05**, a layer may hand its whole run to a runner (2026-09-20, [archived](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d05--a-layer-may-hand-its-whole-run-to-a-runner)):
  carried by `supervision-setup/references/harness-notes.md`, "Runners" ("a
  story worker might hand its story to Compound Engineering's `lfg`, a lead an
  epic to Droid's Missions"), and by the receipt's "Operating model" line.
- **D06**, an epic, not a mission (2026-09-20, [archived](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d06--the-unit-of-work-above-an-issue-is-an-epic-not-a-mission)):
  carried by `AGENTS.md` ("An epic is a Linear project") and
  `project-lead/SKILL.md`. **Changed since:** 2026-10-08, a lead also starts
  from plain intent, with no epic, and files the work items itself
  ([D27](#d27--a-lead-may-carry-a-one-story-intent-run-itself-as-that-storys-worker)).
- **D10**, epic state tracked in git (2026-09-20, [archived](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d10--epic-state-is-tracked-in-git-under-docs-provisionally)):
  closed. The plan retires the state file (R27, KTD13).
- **D14**, the MQ-232 bug supervisor as a working base (2026-09-22, [archived](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d14--the-mq-232-bug-supervisor-is-merged-as-a-working-base-to-generalise-from)):
  carried as precedent. The story worker reuses the bug kit's wording and takes
  no dependency on its engine (plan KTD15). Moving bug work onto this model is
  deferred.
  - **2026-10-06 note:** no longer deferred. MQ-373 moved bug work onto this
    model: a project lead runs a defect run, and a story worker takes each
    defect. The kit D14 carried as precedent was retired in the same change
    ([plan](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/plans/2026-10-06-0604-refactor-bug-work-onto-operating-model-plan.md)).
- **D22**, M2 resumes (2026-09-23, [archived](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d22--m2-resumes-on-this-project)):
  closed. The plan redefines M2 (R29, R30), and MQ-304 was closed as superseded
  on 2026-09-27.

## Superseded since

### D07 — Opus orchestrates; Fable advises only on high-stakes planning and hard research

- 2026-09-20 · maintainer · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d07--opus-orchestrates-fable-advises-only-on-high-stakes-planning-and-hard-research)
- **Superseded by:** the maintainer's ruling of 2026-10-02, relayed on MQ-355.
  The maintainer's global agent instructions (user-level, not in this repo)
  govern instead.
- **Why:** KTD13 listed D07 as carried by the plan or closed by it, but nothing
  carried it. "Opus orchestrates" stays as the global policy's default. The
  "Fable advises" clause is withdrawn, because that policy finds no verified
  win for Fable over Opus, treats trying Fable as an untested hunch, and sends
  adversarial review to Codex.

### D03 — Review is always delegated; the worker procures its own reviewer

- 2026-09-20 · maintainer · [archived entry](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md#d03--review-is-always-delegated-and-the-issue-owner-procures-its-own-reviewer)
- **Decision:** the reviewer is never the author. Each worker starts its own
  reviewer in a subagent or a sibling session, and the lead does not supply one.
- **Superseded by:** [D26](#d26--the-reviewer-runs-in-a-subagent-never-a-sibling-session), 2026-10-03.

## Already superseded in the archive

D09 by D11, D12 by D22, and D20 by D25. Each keeps its `Superseded by` line in
the [archived file](https://github.com/kodhama/math-quest/blob/65747f43afd97956700023e39d074b010a0defec/docs/archive/reproducible-agent-supervision-epic-state.md).

## Observations in harness-notes, and the runs behind them

`skills/supervision-setup/references/harness-notes.md` cites what it saw by
date and harness version only, so a reader outside kodhama has nothing to
resolve (2026-10-07, GRO-6). The math-quest work behind each citation:

| harness-notes says | run |
| --- | --- |
| a successor launched with the same `-n` kept the name, observed once (2026-09-23) | MQ-285, data point 4 |
| the first Codex setup bound the work-note tool by check (codex-cli 0.160.0, 2026-10-03) | MQ-357 |
| a spawn bound as `review` read as the review (codex-cli 0.160.0, 2026-10-03) | the MQ-250 run |
| a child spawned with `fork_turns: "all"` inherits the author's context (codex-cli 0.160.0, 2026-10-03) | the MQ-250 run |
| the catalog from the first Codex setup (codex-cli 0.160.0, 2026-10-03) | MQ-357 |

The tool those notes write as `<tracker>.save_comment` was the Linear
connector's `linear.save_comment`.
