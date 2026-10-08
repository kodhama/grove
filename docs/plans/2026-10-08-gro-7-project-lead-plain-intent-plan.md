---
title: project-lead accepts plain intent
date: 2026-10-08
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
origin: GRO-7, and the GRO-1 comment of 2026-10-03
---

# project-lead accepts plain intent

## Goal Capsule

- **Objective:** a maintainer, or majordomo acting for them, can start a project lead with only a prompt describing a task. No epic, no work item and no plan are needed. The lead then decides how to carry the task: itself, with one worker, or as a breakdown.
- **Means:** an intent run, written as a project-lead reference beside the defect run's. It sizes the task, routes it through the approved run shape, and files the work items once the shape is approved (KTD1, KTD2).
- **Authority:**
  1. The maintainer's calls M1 and M2 (2026-10-08).
  2. The supervision lead's rulings L1 to L9 on the proposal.
  3. GRO-7's description.
  4. This plan.
- **Stop conditions:** stop and ask the lead if:
  - a change needs a new routing operation, or a renamed or removed one;
  - an untracked mode turns out to be needed;
  - a rebase onto the GRO-11 fix conflicts beyond the lines this plan cites.
- **Execution profile:** test-first. The tests prove wiring, portability and consumer compatibility. Behaviour is proven by an acceptance run after release, outside this PR.
- **Who finishes:** gro-7-worker carries it to a draft PR, then to ready. The maintainer approves the merge.

---

## Product Contract

### Summary

project-lead gains a third kind of run beside the epic and the defect run: the intent run.

1. Setup runs with the task alone.
2. A read-only subagent sizes the task against the code.
3. Open questions go to the maintainer.
4. The maintainer approves the run's shape, which picks one of three routes:
   - **carry it itself:** the session becomes the one story's own story worker, with the maintainer as its lead;
   - **one worker;**
   - **a breakdown** into workers.
5. The lead files the work items after the approval. The existing flow runs unchanged from there.

### Problem Frame

project-lead today requires an epic's work item and a source plan before it starts ("What you are given"). It names workers by story number. It never writes code.

majordomo, the first consumer, therefore routes plain-intent asks to an interim lead brief in hq instead of to the skill. The maintainer's direction (2026-10-02, recorded on GRO-1) is that a lead's input can be "just a very big task", and that a lead should not force the full machinery onto a task that turns out small.

### Requirements

**Intake**

- R1. project-lead accepts a plain-intent prompt as its input: the intent, the authorisation, and a reporter. It needs no work item and no plan.
- R2. Setup runs with the task alone, as it already does for a defect run.
- R3. The lead sizes the task before choosing a route, through a fresh read-only subagent given the intent as a question. Open questions go to the maintainer one at a time, before the shape.

**Routing**

- R4. The approved run shape names one route: carry it itself, one worker, or a breakdown. Each route has stated criteria.
- R5. Carry it itself: the session makes the story's worktree and runs the `story-worker` skill there, with the maintainer as its lead. From then on it is a worker, with every worker gate intact.
- R6. One worker and breakdown run the existing flow from the breakdown step on.

**Tracking and naming**

- R7. The lead files work items after the shape is approved:
  - one unit gets a single item that holds the intent and the sizing, and serves as both the story's own source and the run's item;
  - a breakdown gets a run item standing in for the epic's, plus one item per story.

  No untracked mode.
- R8. The lead is named `<run-short>-lead`. A worker is named `<lead>-<story key>`, where the key is the story's number in the tracker, or its position in the approved order when its id has no number.
- R9. story-worker accepts a work item filed from plain intent as its story's own source.

**Records, release and portability**

- R10. The decision record says that the lead may carry a one-story intent run itself (D01 changed since), and that a lead also takes plain intent (D06).
- R11. Both manifests read 0.2.0. The README says how to update the plugin on Claude Code and on Codex.
- R12. Skill text stays portable. The routing tables keep every operation id, and add no operation without a performer.

### Scope Boundaries

- No untracked mode (M2).
- No new routing operation (L2).
- No change to the epic or defect-run flows beyond naming and wording.
- **Deferred to follow-up work:**
  - math-quest's lock bump: a separate PR under an MQ chore, started on the lead's word (L5);
  - hq's dispatch update: the lead passes it to majordomo;
  - the post-release acceptance run (L8).
- No comment on GRO-11 (L7).

### Sources

- GRO-7, and the GRO-1 comment of 2026-10-03.
- The proposal at `.context/supervision/gro-7-worker/plan-proposal.md` (gitignored).
- The lead's rulings and the maintainer's calls, by message, 2026-10-08.
- Codex's update path, read in `openai/codex` at tag `rust-v0.160.0`:
  - `core-plugins/src/manager.rs:2975-2984`: a changed snapshot force-reinstalls the enabled plugins;
  - `manager.rs:2841`: a session start runs the same upgrade in the background.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **The intent run is a reference file, `skills/project-lead/references/intent-run.md`, linked from `SKILL.md`.** It follows the defect-run precedent: a run kind that replaces named steps lives in its own reference and leaves `SKILL.md` readable. (session-settled: user-approved — chosen over inlining it in SKILL.md: matches the defect-run pattern; lead ruling L1)
- KTD2. **The lead files work items after the shape is approved; there is no untracked mode.** Every downstream contract already rests on a work item:
  - story-worker's required `post-work-note`;
  - receipts;
  - new-session handoffs;
  - cloud workers.

  (session-settled: user-directed — chosen over building an untracked mode now: that touches story-worker's required work note, the hand-back channel, the receipt and session-restart; maintainer call M2)
- KTD3. **"Carry it itself" means the session runs story-worker on the one story, with the maintainer as its lead.** It keeps review, receipt, the draft PR and the merge gate. D01 changes for this route only. (session-settled: user-directed — chosen over ad-hoc lead edits with only a fresh review, and over no self route for code; maintainer call M1)
- KTD4. **No new routing operation.** Sizing uses the lead's existing rule of handing reading to a fresh subagent. The table changes only intent and event wording, so consumers' overrides and CI stay green. (session-settled: user-approved — chosen over a new size-task op that every consumer's setup must bind; lead ruling L2)
- KTD5. **Worker key: the tracker number, else the position in the approved order.** (session-settled: user-approved — chosen over always using an ordinal: keeps today's epic names; lead ruling L3)
- KTD6. **Version 0.2.0**, since this adds a capability and stays backward compatible. (session-settled: user-approved — chosen over 0.1.1, which GRO-11's fix takes; lead ruling L4)
- KTD7. **The dependent wording lands in this one PR.** That covers story-worker's source rule, the receipt's `Source:` slot, session-restart's "the epic's for a lead", and supervision-setup's example. Edits in `supervision-setup/SKILL.md` and `session-restart/SKILL.md` stay on the cited lines, because GRO-11 edits other lines in the same files and merges first. (session-settled: user-approved — lead ruling L9)

### Route criteria (directional, for `intent-run.md`)

- **Carry it itself** when all three hold:
  - the sizing finds one unit;
  - no other worker of this lead is in flight or planned;
  - the sizing says the unit can be built, reviewed and handed back before the session reaches its restart line.
- **One worker** when there is one unit but the "itself" criteria fail.
- **Breakdown** when there is more than one unit.
- **No change at all** (the intent is answered by reading, or needs nothing built): report the finding to the maintainer and file nothing.

### Flow edges the reference covers

- **The maintainer rejects or edits the shape:** revise it and ask again. Start nothing before the OK.
- **Restart before filing:** the lead's handoff carries the intent verbatim, the sizing summary, the open questions and their answers, and the approved shape.
- **Restart after filing:** the handoff names the run item and the stories, as an epic lead's does.
- **Carry it itself:**
  - the project-lead duties end at the switch. The session follows story-worker from setup on, in the new worktree, so its bindings file is separate from the lead's;
  - a story that grows past one pull request goes to its lead, the maintainer, as story-worker's "work beyond the story" rule already says.

### Assumptions

- The repo's work tracker is bound for `file-stories` wherever plain intent is used. Where `file-stories` runs by its fallback, the existing rule holds: the maintainer files, and no worker starts on an unfiled story.
- GRO-11's fix merges first as 0.1.1. This branch rebases on it and keeps 0.2.0.

### Sequencing

Units run in order:

1. U1, the failing tests, first.
2. U2, U3 and U4 make them pass.
3. U5 and U6 are wording and release text with no test dependency. They come before the review.

---

## Implementation Units

### U1. Failing tests for the intent route

- **Goal:** pin the wiring, portability and consumer compatibility before any skill text changes.
- **Requirements:** R1, R5, R7, R9, R12.
- **Files:** `test/supervision-routing-tables.test.ts` (a new `describe` beside the defect route's).
- **Patterns:** the defect route's block, "the defect route's text", in the same file.
- **Test scenarios:**
  - project-lead's `SKILL.md` contains `references/intent-run.md`, and that file exists.
  - `intent-run.md`, project-lead's `SKILL.md` and story-worker's "What you are given" section name no harness, path, version or tracker (`textProblems`).
  - Every lead operation `intent-run.md` names in backticks exists in the lead table: `produce-breakdown`, `file-stories`, `post-work-note`, `start-worker`, `report-to-maintainer`.
  - `intent-run.md` names the `story-worker` skill for the carry-it-itself route.
  - project-lead's frontmatter description mentions plain intent.
  - story-worker's "What you are given" section, and the receipt's `Source:` slot, accept a work item filed from plain intent.
  - The lead table still defines every tracker operation id a consumer overrides, `file-stories` included.
- **Verification:** `npm test` shows exactly these new tests red before U2 to U4, and every pre-existing test green.

### U2. The intent-run reference and project-lead's text

- **Goal:** the lead can run from plain intent.
- **Requirements:** R1 to R8.
- **Files:**
  - `skills/project-lead/references/intent-run.md` (new);
  - `skills/project-lead/SKILL.md`: the description, the opening paragraph beside the defect-run one, the no-code rule and its Never entry, "What you are given", naming, setup, step 3's breakdown note, step 4's naming, step 6 and the handoff paragraph.
- **Approach:**
  - Mirror `defect-run.md`'s shape: what changes from an epic, then sizing, questions, shape and routes, filing, carrying it itself, and the handoff.
  - Reuse `SKILL.md`'s steps by name, and never restate them.
- **Test scenarios:** covered by U1.
- **Verification:** U1's project-lead tests pass. Read `SKILL.md` once through for contradictions with the new exception.

### U3. Routing-table wording

- **Goal:** the lead table's intents say what an intent run does with each operation.
- **Requirements:** R6, R8, R12.
- **Files:** `skills/project-lead/routing.toml`:
  - `start-worker`: "the story's key";
  - `produce-breakdown`: also an intent run sized at more than one story;
  - `file-stories`: also an intent run's run item;
  - `post-work-note` and `read-work-notes`: "the epic's or the run's item".
- **Test scenarios:** the existing table-shape and portability tests stay green, and no id changes.
- **Verification:** `npm test`.

### U4. Dependent wording in the other skills

- **Goal:** no skill contradicts the intent run.
- **Requirements:** R9.
- **Files:**
  - `skills/story-worker/SKILL.md` ("What you are given", the source item);
  - `skills/story-worker/references/receipt.md` (the `Source:` slot);
  - `skills/session-restart/SKILL.md` (the post-the-handoff step's "the epic's for a lead" only);
  - `skills/supervision-setup/SKILL.md` (the Inputs example of a task given alone only).
- **Test scenarios:** covered by U1's story-worker and receipt cases.
- **Verification:** `npm test`. `git diff` shows only the cited lines changed in the two files GRO-11 also edits.

### U5. Decision record

- **Goal:** the change to "the lead never writes code" is recorded, not edited in place.
- **Requirements:** R10.
- **Files:** `docs/decisions/supervision-operating-model.md`:
  - a new live decision for the carry-it-itself route;
  - a "Changed since" pointer on the D01 bullet;
  - a note on the D06 bullet.
- **Test scenarios:** none, since this is a record.
- **Verification:** read-through. Every earlier entry is untouched apart from the appended pointers.

### U6. Release text

- **Goal:** the change reaches installs, and readers know how to update.
- **Requirements:** R11.
- **Files:**
  - `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` (0.2.0);
  - `README.md`: the opening line's run kinds, plus an "Updating" section with `claude plugin update grove@grove`, and `codex plugin marketplace upgrade grove` then a fresh session, marked as read from Codex's source and not run.
- **Test scenarios:** the existing manifest test, which checks that the two versions are equal and semver-shaped.
- **Verification:** `npm test`.

---

## Verification Contract

| check | command | when |
| --- | --- | --- |
| typecheck | `npm run typecheck` | after staging, before every push |
| tests | `npm test` | after staging, before every push |
| secrets | gitleaks | CI only |
| review | `/code-review` floor, plus the `ce-code-review` escalation, since the change crosses five skills | before the PR opens |

---

## Definition of Done

- U1's tests were red before the skill changes and are green after, and every other test stays green.
- Typecheck and tests pass locally on the staged tree, and CI's `test` job is green on the PR head.
- No routing operation id is added, renamed or removed, and both manifests read 0.2.0.
- The branch is rebased on GRO-11's merge, if that has landed, with the cited-lines rule holding.
- A fresh-context review ran and its findings were triaged. The PR is a draft until final, and its body has `Fixes GRO-7`.
- No abandoned-attempt text is left in the diff.
