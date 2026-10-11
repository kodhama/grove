---
title: Planning every story that is not a defect, with the plan's path in the receipt - Plan
date: 2026-10-11
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
origin: GRO-22, and the lead's rulings on it of 2026-10-11
---

# Planning every story that is not a defect, with the plan's path in the receipt - Plan

## Goal Capsule

- **Objective:** every story that is not a defect leaves a plan a reader can open, and every defect leaves its diagnosis. The story's receipt says where each one is, and a ready hand-back that does not say so is stopped before the maintainer is asked to merge.
- **Means:** story-worker's text makes planning unskippable, the receipt gains a `Plan:` field, and project-lead's hand-back check reads it (KTD1, KTD2).
- **Authority:**
  1. The lead's rulings on GRO-22 (2026-10-11), carried as KTD1 and KTD2.
  2. GRO-22's description.
  3. This plan.
- **Stop conditions:** stop and ask the lead if:
  - a change turns out to need `required = true` on `plan`'s row, a `Plan:` line in the pull request's body, or a new check in a script;
  - the lead answers an open question below against the wording this plan gives;
  - pull request #14 or #15 lands with wording other than what was read at `f601f90` and `8b38342`, and the merge in U6 then conflicts;
  - the new text cannot pass the portability tests without changing those tests;
  - the version number is still unnamed when the branch is otherwise final.
- **Execution profile:** test-first. The change is skill text and one table field, so the tests pin wording, and a by-eye portability read covers what they do not reach.
- **Who finishes:** the GRO-22 worker carries it to a draft pull request, merges `main` in once #14 and #15 have merged, then marks it ready. The lead names the version. The maintainer approves the merge.

---

## Product Contract

### Summary

story-worker plans every story that is not a defect, asks its planner for a plan written to a file, commits that file, and gives its path on a new `Plan:` line in the receipt. For a defect the diagnosis stands as the plan, and the line links it. The hand-written plan stays only as the fallback for a session with no planner, and the line then says so. project-lead sends back a ready hand-back whose `Plan:` line is missing or names nothing.

### Problem Frame

The maintainer wants work to run through planning, building and capture with real artifacts. An audit of 90 pull requests in a consuming repo since 2026-10-01 found a plan in about 52. story-worker lets a worker skip planning without saying so: the plan step never says a story must be planned, the table's fallback invites "a short plan" that need not be written anywhere, and the receipt has no place for a plan's path.

### Requirements

| ID | Requirement | From | Lands in |
| --- | --- | --- | --- |
| R1 | Every story that is not a defect is planned before it is built. | "`plan` is required for every story that isn't a defect" | `skills/story-worker/SKILL.md`, step 3 (U2) |
| R2 | For a defect, the diagnosis stands as its plan, and it is kept where the lead can open it. | "For a defect, the diagnosis artifact counts as its plan" | `skills/story-worker/SKILL.md`, "A defect: diagnose first" (U2) |
| R3 | The receipt shows the plan's path, or for a defect where the diagnosis is. | "The receipt shows the plan's path" | `skills/story-worker/references/receipt.md`, a `Plan:` field (U2) |
| R4 | A hand-written plan is written only when no planning performer is bound, it is written to a file, and the receipt says the plan was written by fallback. | "Drop the hand-written-plan fallback, or keep it only where no planning performer is available, and say so in the receipt" | `skills/story-worker/routing.toml`, `plan`'s `fallback`, and step 3 (U2, U3) |
| R5 | A ready hand-back whose receipt does not name the plan, or for a defect the diagnosis, goes back to the worker. | lead ruling 2 | `skills/project-lead/SKILL.md`, step 7 item 2 (U4) |
| R6 | `plan`'s row keeps `required = false` and keeps a fallback. | lead ruling 1 | `skills/story-worker/routing.toml` (U3), held by a test (U1) |
| R7 | Skill text stays portable: no repo path, tracker name, version, plan tag or harness-specific invocation. | `AGENTS.md`, "The skills are portable" | every edit under `skills/` (U2, U3, U4) |
| R8 | Text that restates or points at the plan step agrees with the change. | story-worker's "Check what points at your change" | U5, and the table under "What restates or points at the change" |

### Scope Boundaries

- No `Plan:` line in the pull request's body. A plan file is already in the pull request's diff, and a defect's diagnosis is a note on its work item.
- No new script and no new check in `receipt-check.mjs`. It already fails a planner that was bound and never called (fact F8).
- No change to `plan`'s `required`, `intent`, `step` or `performers`.
- No change to step 7, step 8, `By fallback:` or `Not run:`. #14 and #15 own the first two, and the last two already say what this story needs.
- The lead's check does not judge whether a plan is a good one.
- No new decision record: `AGENTS.md` asks for one only when a dependency is added, and none is.

### Sources

- GRO-22, and the lead's two rulings of 2026-10-11.
- The files under "Facts" below, read at `main` = `07a003f`.
- Pull request #14 at `f601f90` and #15 at `8b38342`, read in sibling clones: each one's diff from `07a003f`, and each one's plan under `docs/plans/`.

---

## Planning Contract

### Facts at `07a003f`

Every line number is from `07a003f`. "Verified" means the text was read at that line. "Inferred" means reasoning from what was read.

| ID | Fact | Where | Status |
| --- | --- | --- | --- |
| F1 | `plan`'s row: `performers = ["ce-plan"]`, `required = false`, and the fallback "Write a short plan yourself: the files to change, the failing tests to write first, and how the result is verified. Keep it within the story's scope." The issue cites these lines from 0.2.1, and they have not moved. | `skills/story-worker/routing.toml:44-52` | Verified |
| F2 | `required = true` means the worker cannot run without the operation, setup stops when nothing binds, and the row carries no fallback. A test fails a required row that has one. | `skills/story-worker/routing.toml:13-16`; `skills/supervision-setup/SKILL.md:214-216`; `test/supervision-routing-tables.test.ts:133-136` | Verified |
| F3 | Step 3 opens "For a defect, the diagnosis above runs first and may skip this step." It then invokes the performer bound to `plan`. It never says a story must be planned, and it names no file or path. | `skills/story-worker/SKILL.md:149-161` | Verified |
| F4 | The defect section asks the `diagnose` performer to "stop at a summary, with no fix, no commit and no push". A contained fix skips the plan: "skip the plan and build it". A fix that needs a design choice is planned. A defect that needs no change is handed back blocked with nothing built. | `skills/story-worker/SKILL.md:121-125`, `129-140` | Verified |
| F5 | The receipt template has no `Plan:` field. Its first line holds `Story:` and `Source:`, then `Owner:`. | `skills/story-worker/references/receipt.md:18-20` | Verified |
| F6 | `By fallback:` reads "<operation: suggested <names> unavailable, step run by fallback — or "none">". `Not run:` reads "<table/operation: why, …>". | `skills/story-worker/references/receipt.md:40-41` | Verified |
| F7 | project-lead's hand-back check: item 1, "Check the claims", ends "The receipt on the work item names that head." Item 2, "Accept on the evidence", ends "is not acceptable work." Both sit under "When the pull request is ready". | `skills/project-lead/SKILL.md:282-291` | Verified |
| F8 | The receipt check reads the bindings file, transcripts and a handoff, never the receipt. An operation bound by fallback reads `by fallback` and passes. A bound performer that was never called reads `bound-but-unused` and exits 1, unless the caller passes `--not-run`. | `skills/supervision-setup/scripts/operation-state.mjs:123`; `skills/supervision-setup/scripts/receipt-check.mjs:127`, `451`; `test/supervision-receipt-check.test.ts:1707` | Verified |
| F9 | The text tests live in `test/supervision-routing-tables.test.ts`. They pin: `diagnose` comes before `plan` in the table (284-293), the defect section exists and names `` `diagnose` `` before `## 3. Plan` (533-545), `plan`'s `step` matches `diagnosis` (547-550), and the receipt says "filed from plain intent" (622-627). | as cited | Verified |
| F10 | The path, version and invocation patterns (`NON_PORTABLE`) are applied to all of `routing.toml`, all of `skills/project-lead/SKILL.md`, story-worker's defect section and its "What you are given". They are not applied to step 3 or to the receipt. The tracker-word and plan-tag patterns are applied to every Markdown file and script under `skills/`. | `test/supervision-routing-tables.test.ts:62-74`, `174`, `559-565`, `599-605`, `661`, `679-702` | Verified |
| F11 | The tests read files from the working tree with `readFileSync`. `npm test` is `vitest run` and `npm run typecheck` is `tsc --noEmit`. Nothing in the repo ties either to the git index. | `test/supervision-routing-tables.test.ts:86-88`, `520`; `package.json` | Verified |
| F12 | No test pins `plan`'s fallback text or the story table's hash: the receipt-check tests hash the live table. | `test/supervision-receipt-check.test.ts:73-75` | Verified |
| F13 | `README.md` says a missing performer means the operation runs its fallback, "the session does the step itself from the table's instructions". Nothing there says planning may be skipped. | `README.md:94-102` | Verified |
| F14 | No script under `skills/supervision-setup/scripts/` reads a receipt field or the plan step. Their hits for "Plan:" are header comments that cite math-quest plans. | grep over the folder | Verified |
| F15 | Both manifests read `0.2.3`. A test holds them equal and semver-shaped. | `.claude-plugin/plugin.json:3`; `.codex-plugin/plugin.json:3`; `test/plugin-manifests.test.ts:30-34` | Verified |
| F16 | A `diagnose` performer leaves no file. story-worker asks it for a summary, and Compound Engineering's debug skill writes its diagnosis-only summary into the conversation. So nothing exists today that a receipt could name for a defect. | F4; the debug skill's own text | Inferred |
| F17 | A planner can answer a small request in the conversation and write no file. Compound Engineering's plan skill writes a file when the request asks for one. So the worker has to ask for a file. | the plan skill's output contract | Inferred |
| F18 | The planned edits merge with #14 and with #15 without a conflict. | a trial merge in a scratch clone, see U6 | Verified by simulation |

### Key Technical Decisions

- KTD1. **The rule lives in story-worker's text and a receipt field. `plan`'s row keeps `required = false`.** (session-settled: user-directed — the lead's ruling, chosen over setting `required = true` on the row: in this table that forbids a fallback and stops setup when no planner binds, and a defect rightly skips the plan.)
- KTD2. **The one enforcement point is a clause in the lead's hand-back check.** (session-settled: user-directed — the lead's ruling, chosen over a `Plan:` entry in the receipt check or the pull request's body: no new script check is wanted for this story.) The check that exists already covers the commonest miss (F8): a worker that binds a planner and never calls it gets `bound-but-unused` and exit 1, unless it declares `plan` not run, and the lead's clause then reads why.
- KTD3. **The skill text never calls `plan` "required".** In these skills that word means "no fallback, and setup stops". Step 3 says "is planned before it is built" instead. A test whose title gives the reason holds the row at `required = false` (U1).
- KTD4. **Every story that is not a defect gets its own plan file, committed on the branch.** One rule, one form for the line, and a plan in every such pull request, which is what the audit counted. Chosen over letting a story whose source is already a plan unit name that unit and write nothing. See Open Questions.
- KTD5. **The worker asks the planner for a plan written to a file.** Without the ask a planner may answer in the conversation (F17), and the receipt has no path to give.
- KTD6. **A defect's diagnosis is posted as a note on its work item, and the `Plan:` line links the note.** The `diagnose` performer leaves no file (F16). A note is readable from any machine, it exists on the route that builds nothing, and `post-work-note` is the one operation every story has bound. See Open Questions.
- KTD7. **`Plan:` sits right under `Story:` and `Source:`.** The plan is what the source became, so the two read together. #14 and #15 both add a field after `Acceptance:` and edit lines 40 to 44, so this place merges without a conflict (F18). The other place considered was beside `Docs:` and `Capture:`, which would put three inserts at one point.
- KTD8. **The lead's clause goes at the end of item 2, "Accept on the evidence".** #15 rewrites the last sentence of item 1, and its new text is about the pull request's body, which never carries `Plan:`. Item 2 already says what else the receipt must show. This place merges without a conflict (F18).
- KTD9. **`By fallback:` and `Not run:` are not edited.** A plan written by fallback already lands in `By fallback:` as "plan: suggested ce-plan unavailable, step run by fallback". The `Plan:` line repeats it in three words so the lead reads one line.
- KTD10. **No version bump until the lead names the number**, after `main` is merged in (U7).

### What the `Plan:` line says

| Story | The line |
| --- | --- |
| Not a defect, planner bound | `Plan: <path of the plan file on the branch>` |
| Not a defect, no planner bound | `Plan: <path>, written by fallback` |
| Defect, contained fix: planning skipped | `Plan: diagnosis <link to the note>, no plan: contained fix` |
| Defect, the fix needed a plan | `Plan: diagnosis <link to the note>, plan <path>`, with `, written by fallback` where it applies |
| Defect, nothing built: it does not reproduce, is a duplicate, is already fixed, or diagnosis could not proceed | `Plan: diagnosis <link to the note>, no plan: nothing built` |
| Any story that ended before it was planned, or for a defect before it was diagnosed | `Plan: not reached: <why>` |

How the rest of the receipt agrees:

- **Contained fix.** `Not run:` lists `story-worker/plan` with the reason, and the receipt check gets `--not-run story-worker/plan`, as step 8 already says.
- **By fallback.** `By fallback:` lists `plan`, and the check prints `story-worker/plan: by fallback (no performer to find)`.
- **Not reached.** Only a blocked hand-back can carry it. The lead's clause sits under "When the pull request is ready", so a ready hand-back that says `not reached` goes back.

### Assumptions

These are bets this plan made without asking. Each has an open question below.

- A story whose source is already a plan unit still gets its own short plan file (KTD4).
- A defect's diagnosis summary goes in a work-item note (KTD6).
- The lead's clause may say the pull request's head must hold the plan's file, which is a few words past the ruling's wording.
- One sentence in `README.md` is wanted (U5).
- #14 and #15 merge before this pull request, with the wording read at `f601f90` and `8b38342`.

### What restates or points at the change

Every hit outside `docs/plans/` for: `` `plan` ``, "short plan", "skip the plan", "may skip this step", "Plan:", "planning", "By fallback", "Not run", "Accept on the evidence".

| Where | What it says | Edit? |
| --- | --- | --- |
| `skills/story-worker/SKILL.md:149-156`, step 3 | a defect "may skip this step"; invoke the performer bound to `plan` | **Yes** (U2) |
| same file, `121-125`, the defect section | the diagnosis ends at a summary | **Yes** (U2): one new paragraph after it |
| same file, `129-140`, the four routes | "skip the plan and build it"; "plan it" | No. Step 3 and the receipt say what each route records. |
| same file, `42-43`, "Never" | a fallback is reported as run by fallback | No. It already covers a plan written by fallback. |
| same file, `294-309`, step 8 | `--not-run` for each operation not run; write the receipt from `references/receipt.md` | No. #15 edits this bullet, and it already covers `plan` and the new field. |
| same file, `360-368`, "Bindings mid-story" | an operation with no replacement runs by its fallback, "or stops the story if it is required" | No. `plan` stays not required in the table's sense, so a planner lost mid-story falls back (KTD3). |
| same file, `396-397`, "Context and restart" | the handoff carries "the receipt so far" | No. The `Plan:` line travels in it. |
| `skills/story-worker/references/receipt.md:18-19` | `Story:` and `Source:` | **Yes** (U2): the new field goes after them |
| same file, `40-41` | `By fallback:`, `Not run:` | No (KTD9). #14 edits `By fallback:`. |
| `skills/story-worker/routing.toml:50-52` | `plan`'s fallback | **Yes** (U3) |
| same file, `13-16`, `46-47` | what `required` means; `plan`'s `intent` and `step` | No. All three stay true. |
| same file, `33`, `diagnose`'s intent | "before any plan" | No |
| `skills/project-lead/SKILL.md:287-291` | "Accept on the evidence" | **Yes** (U4) |
| same file, `252-255` | check a report's claims against git and the pull request | No. It is why the lead opens the path the line gives. |
| `skills/project-lead/references/defect-run.md`, `intent-run.md` | triage routes; a breakdown's plan posted on the run item | No. Neither restates the worker's plan step. |
| `skills/project-lead/routing.toml:110` | `produce-breakdown` suggests `ce-plan` | No: the lead's own operation. |
| `skills/supervision-setup/SKILL.md:205-216` | how a fallback is bound | No |
| `skills/supervision-setup/scripts/*.mjs` | nothing reads a receipt field (F14) | No |
| `skills/session-restart/SKILL.md` | the handoff and its receipt-check section | No |
| `README.md:98-102` | each operation runs its fallback without Compound Engineering | **Yes** (U5): one sentence |
| `AGENTS.md`, `docs/decisions/` | no hit that restates the plan step | No |
| `test/fixtures/supervision/bindings.example.json:29-41` | `plan` bound to `ce-plan` | No |
| `test/supervision-receipt-check.test.ts`, `test/supervision-receipt-credit.test.ts` | `story-worker/plan` as a sample operation in the check's own tests | No (F12) |
| `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` | `version` | Waits (U7) |

### Sequencing

1. U1, the failing tests.
2. U2, U3 and U4 make them pass.
3. U5 is wording with no test.
4. U6 runs once #14 and #15 have merged.
5. U7 waits for the lead's version number, and comes after U6.

---

## Implementation Units

### U1. Failing tests

- **Goal:** pin the new wording before any skill text changes.
- **Requirements:** R1 to R7.
- **Files:** `test/supervision-routing-tables.test.ts`.
- **Patterns:** the `describe("MQ-373 · the defect route's text")` block, and its helpers `section`, `read`, `LEAD`, `WORKER`, `operationsOf`, `readTable`, `idsOf` and `textProblems`. #14 and #15 both read a receipt field with the match of the label at a line's start plus its indented continuation lines, and collapse whitespace to one space before they compare. Do the same.
- **Approach:**
  1. Add one `describe`, titled for GRO-22, **between the end of the `MQ-373` block and the doc comment that opens the `GRO-7` block**. #14 adds its block after the `GRO-7` block and #15 adds its own at the end of the file, so a block at either of those places conflicts (F18).
  2. Declare no file-level constant. Build the receipt's path inside the block, as #15 does. #14 moves `RECEIPT` to file level, and the block must compile before and after that.
  3. Give the block a doc comment in the file's style: the tracker id, then what the rule is in two or three lines.
- **Test scenarios.** Each reads its text with whitespace collapsed to one space. Scenarios 1 to 9 are red on `07a003f`. Scenario 10 is green before and after.
  1. `plan`'s row keeps its fallback because a defect skips the plan and setup must not stop without a planner: `required` is `false`, `performers` is `["ce-plan"]`, and the fallback contains `No planning performer is available`, `to a file` and `written by fallback`, and no longer contains `Write a short plan yourself`.
  2. Step 3 (`section(read(WORKER), "3. Plan")`) contains `Every story that is not a defect is planned before it is built`, and no longer contains `may skip this step`.
  3. Step 3 contains `ask it for a plan written to a file`, `ships in the pull request` and `` `Plan:` line ``.
  4. Step 3 contains `bound by fallback` and `to a file all the same`.
  5. Step 3 contains `its diagnosis stands as its plan` and `under Not run only when it ended before this step`.
  6. The defect section (`section(read(WORKER), "A defect: diagnose first")`) contains `The diagnosis stands as the defect's plan`, `` `post-work-note` `` and `` `Plan:` line links that note ``, and `post-work-note` is an operation of the story table.
  7. The receipt's `Plan:` field contains `the plan this story was built from`, `", written by fallback"`, `for a defect: diagnosis <`, `"plan <path>"`, `"no plan: contained fix"`, `"no plan: nothing built"` and `not reached: <why>`.
  8. In the receipt, the line that starts `Plan:` comes after the line that starts `Story:` and before the line that starts `Owner:`.
  9. The lead's "Accept on the evidence" item, the text of `section(read(LEAD), "7. A hand-back")` between `**Accept on the evidence.**` and `**Review it again, from fresh context.**`, contains `` `Plan:` line ``, `which the pull request's head must hold`, `for a defect, the link to its diagnosis` and `goes back to the worker`.
  10. Step 3 and the receipt's `Plan:` field name no harness, path, version or tracker: `textProblems` returns nothing for each. This extends the portability patterns to text they do not reach today (F10).
  - No new portability test for the lead's file, the defect section or the table: existing tests apply every pattern to all three.
- **Verification:** `npm test` shows scenarios 1 to 9 red and every test that existed before green. `npm run typecheck` passes.

### U2. story-worker's text: the defect section, step 3 and the receipt

- **Goal:** the worker plans every story that is not a defect, keeps a defect's diagnosis where the lead can open it, and writes the `Plan:` line.
- **Requirements:** R1, R2, R3, R4, R7.
- **Dependencies:** U1.
- **Files:**
  - `skills/story-worker/SKILL.md` (the defect section, and step 3);
  - `skills/story-worker/references/receipt.md`.
- **Approach:** the wording below, as written. Leave step 7 and step 8 alone.

**The defect section.** A new paragraph between "…and that it never uses the shared stash." and "The diagnosis decides the route:". The four routes stay as they are.

```text
The diagnosis stands as the defect's plan. Post its summary as a note on the
work item, through the performer bound to `post-work-note`, before you act on
it, so your lead can open it. The receipt's `Plan:` line links that note.
```

**Step 3.** These three paragraphs replace the step's first two, "For a defect, the diagnosis above runs first and may skip this step." and "Invoke the performer bound to `plan` … how the result is verified." The paragraph that starts "Build only on settled ground." stays as it is.

```text
Every story that is not a defect is planned before it is built, however small
it looks. A defect comes here only when its diagnosis says the fix needs a
plan (see "A defect: diagnose first"). Otherwise its diagnosis stands as its
plan, and `plan` goes under Not run with that reason.

Invoke the performer bound to `plan`, from the story's source, and ask it for
a plan written to a file. For a story whose source is already a plan unit,
this confirms it is enough to build from, or fills the gaps: the files to
change, the failing tests to write first, and how the result is verified.

Commit the plan's file on your branch, so it ships in the pull request, and
give its path on the receipt's `Plan:` line, as `references/receipt.md` gives
it. Where `plan` is bound by fallback, you write the plan yourself, to a file
all the same, and the line says so. A story that is not a defect lists `plan`
under Not run only when it ended before this step.
```

**The receipt's `Plan:` field.** Inserted after the `Story:` field's second line, "…defect, or a story filed from plain intent, the work item itself>", and before `Owner:`.

```text
Plan:            <the path, on the branch, of the plan this story was built from, adding
                  ", written by fallback" where no planning performer was bound
                  | for a defect: diagnosis <the link to the note that holds its summary>,
                  then "plan <path>" where the fix needed one, "no plan: contained fix" where
                  it did not, or "no plan: nothing built" where there was no fix to make
                  | not reached: <why>, for a story that ended before it was planned, or,
                  for a defect, diagnosed>
```

- **Test scenarios:** U1's scenarios 2 to 8 and 10, and the existing "story-worker's defect section names no harness, path, version or tracker".
- **Verification:** those tests pass. The existing tests on the defect section and on `\n## 3. Plan\n` still pass: the heading and its place do not change.

### U3. The `plan` row's fallback

- **Goal:** the fallback is only for a session with no planner, it writes a file, and it tells the worker to say so.
- **Requirements:** R4, R6, R7.
- **Dependencies:** U1.
- **Files:** `skills/story-worker/routing.toml` (`plan`'s `fallback` only).
- **Approach:** replace the fallback's text with the text below. `id`, `intent`, `step`, `performers` and `required` do not change.

```text
No planning performer is available, so write the plan yourself, to a file
where the repo keeps its plans: the files to change, the failing tests to
write first, and how the result is verified. Keep it within the story's
scope, and say on the receipt's Plan line that it was written by fallback.
```

- **Test scenarios:** U1's scenario 1, and the existing "story-worker: parses, and every operation is complete and portable".
- **Verification:** both pass.

### U4. project-lead's hand-back check

- **Goal:** a ready hand-back whose receipt names no plan, or for a defect no diagnosis, goes back to the worker.
- **Requirements:** R5, R7.
- **Dependencies:** U1.
- **Files:** `skills/project-lead/SKILL.md` (step 7, "When the pull request is ready", item 2).
- **Approach:** append to item 2, after "…is not acceptable work." Item 1 is not touched.

```text
The receipt's `Plan:` line must give the path of the plan the story was built
from, which the pull request's head must hold, or, for a defect, the link to
its diagnosis: a hand-back whose line is missing, gives neither, or says the
plan was not reached goes back to the worker.
```

- **Test scenarios:** U1's scenario 9, and the existing "project-lead's SKILL.md names no harness, path, version or tracker", which applies every pattern to the whole file.
- **Verification:** both pass.

### U5. README

- **Goal:** a repo that adopts the skills knows each story's pull request now carries a plan file.
- **Requirements:** R8.
- **Files:** `README.md`, "What the routing tables expect", the **compound-engineering** bullet.
- **Approach:** append to the bullet, after "…and still never reviews its own work." #14 adds a bullet seven lines below this one, and #15 adds one in the section above, so this edit merges cleanly (F18).

```text
Planning is the one step a story never skips: a story that is not a defect
ships a plan file in its pull request either way, written by the planner or,
without one, by the worker.
```

- **Test scenarios:** `Test expectation: none -- prose outside the skills, with no behaviour.`
- **Verification:** read the sentence against U2's step 3.

### U6. Merge `main` in after #14 and #15

- **Goal:** the branch carries #14, #15 and this story's wording together.
- **Dependencies:** #14 and #15 merged to `main`; U2 to U5.
- **Files:** none expected beyond what git merges.
- **Approach:** merge `main` into the branch, never rebase: the branch is pushed. Then run the full check set.

  A trial merge in a scratch clone applied U2 to U5's wording and a test block at U1's place on `07a003f`. It merged #14's head `f601f90`, #15's head `8b38342`, and a tree carrying both. All three merges were clean. So no conflict is expected, and the table says why for each file.

  | File | Expect | If git reports a conflict anyway |
  | --- | --- | --- |
  | `skills/story-worker/SKILL.md` | Clean. #14 edits the opening paragraph on project instructions and step 7 item 5. #15 edits step 7 item 5 and step 8's receipt-check bullet. This story edits the defect section and step 3. | Keep `main`'s step 7 and step 8 whole, and this story's defect section and step 3 whole. |
  | `skills/story-worker/references/receipt.md` | Clean. #14 edits `By fallback:` and adds `Docs:` after `Acceptance:`. #15 edits `Receipt check:` and adds `Capture:` after `Acceptance:`. This story adds `Plan:` after `Story:`. | Keep all three fields. `Plan:` stays under `Story:`. |
  | `skills/story-worker/routing.toml` | Clean. #14 edits the header comment and adds a row after `resolve-pr-feedback`. #15 edits `capture-learning`'s fallback. This story edits `plan`'s fallback. | Keep each side's own row. |
  | `skills/project-lead/SKILL.md` | Clean. #15 rewrites the last sentence of item 1. This story appends to item 2, four lines below. | Keep #15's item 1 and this story's item 2. |
  | `test/supervision-routing-tables.test.ts` | Clean, because of where U1 puts the block. | Keep all three blocks. |
  | `README.md` | Clean. | Keep every side's text. |
  | `AGENTS.md`, `skills/supervision-setup/`, `test/supervision-bindings.test.ts`, `test/supervision-receipt-check.test.ts`, `test/fixtures/` | #14 and #15 only. | none |

  After the merge, three things change for this pull request without any conflict:

  1. **Its body needs a `Capture:` line and a `Docs:` line**, since #15's check reads the saved body at the hand-back. The `Docs:` line names `README.md`, which U5 updates and which #14 makes "the doc a change keeps current".
  2. **Read the lead's items 1 and 2 once through.** Item 1 then lists `Capture:` and `Docs:`, and item 2 lists `Plan:`. That split is deliberate (KTD8).
  3. **If #14 or #15 changed after the heads read here**, run the merge and read each file in the table before trusting "clean".

- **Test scenarios:** none new. #14's and #15's tests read step 7, step 8, the `Docs:`, `Capture:`, `By fallback:` and `Receipt check:` fields, and the lead's text between "Check the claims" and "Accept on the evidence". This story changes none of that text.
- **Verification:** `npm run typecheck` and `npm test` pass on the merged tree.

### U7. Version bump

- **Goal:** the change reaches installs.
- **Dependencies:** U6, and the lead's version number. Bump after the merge: #14 and #15 each bump the same two lines.
- **Files:** `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, together.
- **Test scenarios:** the existing manifest test, which holds the two versions equal and semver-shaped.
- **Verification:** `npm test`.

---

## Verification Contract

| check | command | when |
| --- | --- | --- |
| stage | `git add -A` | before the two checks below, as the lead asked |
| typecheck | `npm run typecheck` | before every push |
| tests | `npm test` | before every push |
| secrets | gitleaks | CI only |
| restatement sweep | `grep -rnI --exclude-dir=node_modules --exclude-dir=.git -e "short plan" -e "may skip this step" -e "Plan:" .` | before the review |
| review | the native single-pass review; `ce-code-review` on top, since the change is what two skills tell agents to do | before the pull request opens |

The sweep should show "short plan" and "may skip this step" gone outside `docs/plans/`, and `Plan:` only in the files U2 to U4 edit, the test, and the scripts' header comments (F14).

On staging: the lead's brief says the tests read a staged snapshot. The repo does not show that (F11). Staging first costs nothing, so the table keeps it.

**By-eye portability check.** The tests apply every pattern to the table, the lead's file, the defect section, and after U1 to step 3 and the `Plan:` field. Read the new text once more for what a pattern cannot see:

- no tool, skill or plugin named as the planner;
- no folder named as where plans live;
- no word "required" used of `plan` (KTD3).

---

## Risks

| Risk | Mitigation |
| --- | --- |
| No script reads the `Plan:` line. A worker can give a path the head does not hold. | The lead's clause says the head must hold it, and the lead already checks a report against git (`skills/project-lead/SKILL.md:252-255`). |
| A planner answers in the conversation and writes no file. | Step 3 has the worker ask for a file (KTD5). A line with no path goes back. |
| A repo's override replaces `plan`'s fallback, and its text does not say "to a file". | Step 3 says it too, and an override cannot change step 3. |
| The table says `required = false` and the story's title says "required". Someone later flips the row, and a session with no planner stops at setup. | U1's first scenario fails, and its title gives the reason. |
| A story in flight when the plugin updates hands back with no `Plan:` line. | Its lead sends it back once with what is missing. |
| A full plan is heavy for a one-line story. | Not solved here. The planner sizes its own plan. Raise it if the first stories show it. |
| A defect gets one more note on its work item, and a tracker may notify the maintainer for it. | Accepted. See the open question on where the diagnosis lives. |
| #14 or #15 changes before it merges. | U6 reruns the merge, and a conflict there is a stop condition. |

---

## Open Questions

None blocks the build. Each has the answer this plan assumes.

- **Does a story whose source is already a plan unit still get its own plan file?** Assumed: yes (KTD4). It gives one rule and a plan in every such pull request, which is what the audit counted. The cost is a short file that mostly points at the unit. The other answer: the planner confirms the unit, writes nothing, and the line names the unit. That needs one more sentence in step 3 and one more form in the field, and those pull requests would still show no plan.
- **Where does a defect's diagnosis live?** Assumed: a note on its work item (KTD6). The story says "diagnosis artifact", and no artifact exists today (F16). The other answers: a file on the branch, which does not exist on the route that builds nothing, or the cause in one line on the `Plan:` line with no artifact, which is smaller but gives the lead nothing to open.
- **Does the lead's clause keep "which the pull request's head must hold"?** Assumed: yes. It goes a few words past the ruling. Without it, the commonest slip, a plan written and never committed, passes. Cutting it changes one test string.
- **Does the lead's clause belong in item 2 or item 1?** Assumed: item 2 (KTD8). If the lead wants the three receipt lines read in one place, move it into item 1 after U6, when #15's text is there to sit beside.
- **Is the README sentence wanted?** Assumed: yes. The rulings name only skill files. Cutting U5 changes nothing else, and then this pull request's `Docs:` line would read "none needed".
- **Is staging before the checks needed?** Assumed: do it, since the lead asked. The repo shows no reason for it (F11).

---

## Definition of Done

- U1's scenarios 1 to 9 were red before U2 to U4 and are green after. Every test that existed before stays green with no edit to its assertions.
- Typecheck and tests pass locally, and CI's `test` job is green on the pull request's head.
- `main` is merged in after #14 and #15, and their tests are green on the merged tree.
- The restatement sweep and the by-eye portability check are done.
- This story's own receipt carries a `Plan:` line that names this file, `docs/plans/2026-10-11-gro-22-required-plan-operation-plan.md`, and the pull request's head holds it.
- After U6, the pull request's body carries a `Capture:` line and a `Docs:` line.
- A fresh-context review ran and its findings were triaged. The pull request is a draft until final, and its body has `Fixes GRO-22`.
- Both manifests carry the version the lead named, or the pull request is still a draft waiting for it.
- No abandoned-attempt text is left in the diff.

---

## Amendments after the lead's rulings (2026-10-11)

The lead ruled on the open questions after this plan was written. **Where this section and the text above disagree, this section wins.**

- **Open question 1, ruled (b) with one exception: KTD4 is reversed.** Where a story's source is already a plan unit and the unit is enough to build from, the unit is the story's plan: the `Plan:` line names it (that plan's path and the unit's id) and the story writes no copy. Where the planner fills gaps in the unit, it writes those to the story's own plan file, and the line gives that file's path and the unit. A story with any other source gets its own plan file, as planned.
- **Open question 2, ruled (a): KTD6 stands.** The diagnosis summary is posted as a note on the work item before the worker acts on it, and the `Plan:` line links the note.
- **Open question 3, adjusted.** The lead's clause does not say the pull request's head must hold the plan's file, which would fail a story built from a plan unit, and a defect. It says the line's path resolves at the pull request's head or on its base branch, or, for a defect, the line links the diagnosis note.
- Open questions 4, 5 and 6 stand as recommended.

### The `Plan:` line, amended

| Story | The line |
| --- | --- |
| Not a defect, its own plan file | `Plan: <path of the plan file on the branch>`, with `, written by fallback` where no planner was bound |
| Not a defect, built from a plan unit that was enough | `Plan: <that plan's path>, unit <the unit's id>` |
| Not a defect, a plan unit whose gaps a file fills | `Plan: <path of the story's file>, filling <that plan's path>, unit <the unit's id>`, with `, written by fallback` where it applies |
| A defect, or a story that ended before planning | as the table above gives it |

### U2, amended wording

**Step 3.** These three paragraphs replace the three given in U2:

```text
Every story that is not a defect is planned before it is built, however small
it looks. A defect comes here only when its diagnosis says the fix needs a
plan (see "A defect: diagnose first"). Otherwise its diagnosis stands as its
plan, and `plan` goes under Not run with that reason.

Invoke the performer bound to `plan`, from the story's source. For a story
whose source is already a plan unit, this confirms the unit is enough to build
from, or fills the gaps: the files to change, the failing tests to write
first, and how the result is verified. A unit that is enough is the story's
plan: write no copy of it. In every other case, ask the performer for a plan
written to a file: the whole plan, or, for a plan unit, only the gaps it
filled.

Commit a plan file on your branch, so it ships in the pull request. Give the
receipt's `Plan:` line as `references/receipt.md` gives it: the file's path,
the plan unit the story was built from, or both where a file fills a unit's
gaps. Where `plan` is bound by fallback, you do the planning yourself, any
plan you write goes to a file all the same, and the line says so. A story
that is not a defect lists `plan` under Not run only when it ended before this
step.
```

**The receipt's `Plan:` field** replaces the one given in U2:

```text
Plan:            <the plan this story was built from: the path, on the branch, of its plan
                  file; or, where its source is a plan unit that was enough to build from, that
                  plan's path and the unit's id, with no copy written; or both, where a file
                  fills the unit's gaps. A file written with no planning performer bound adds
                  ", written by fallback"
                  | for a defect: diagnosis <the link to the note that holds its summary>,
                  then "plan <path>" where the fix needed one, "no plan: contained fix" where
                  it did not, or "no plan: nothing built" where there was no fix to make
                  | not reached: <why>, for a story that ended before it was planned, or,
                  for a defect, diagnosed>
```

### U3, amended fallback

```text
No planning performer is available, so do the planning yourself. A plan unit
that is enough to build from is the plan: name it and write no copy. In every
other case write the plan, or the gaps you fill in a unit, to a file where the
repo keeps its plans: the files to change, the failing tests to write first,
and how the result is verified. Keep it within the story's scope, and say on
the receipt's Plan line that it was written by fallback.
```

### U4, amended clause

```text
The receipt's `Plan:` line must name the plan the story was built from, by a
path that resolves at the pull request's head or on its base branch, or, for a
defect, link its diagnosis note: a hand-back whose line is missing, does
neither, or says the plan was not reached goes back to the worker.
```

### U5, amended sentence

```text
Planning is the one step a story that is not a defect never skips: its receipt
names the plan it was built from, either a plan file in its pull request,
written by the planner or, without one, by the worker, or the plan unit the
story came from.
```

### U1, amended strings

The scenarios keep their shape; the strings they pin follow the amended wording:

- Scenario 1: the fallback contains `No planning performer is available`, `to a file`, `write no copy` and `written by fallback`, and no longer contains `Write a short plan yourself`.
- Scenario 3: step 3 contains `ask the performer for a plan written to a file`, `ships in the pull request` and `` `Plan:` line ``.
- A new scenario beside it: step 3 contains `A unit that is enough is the story's plan: write no copy of it`, `only the gaps it filled` and `or both where a file fills a unit's gaps`.
- Scenario 4: step 3 contains `bound by fallback` and `goes to a file all the same`.
- Scenario 7: the receipt's `Plan:` field also contains `that plan's path and the unit's id, with no copy written` and `or both, where a file fills the unit's gaps`.
- Scenario 9: the lead's item contains `` `Plan:` line ``, `resolves at the pull request's head or on its base branch`, `for a defect, link its diagnosis note` and `goes back to the worker`, and does not contain `must hold`.

## After the floor review (2026-10-11)

The review of the built branch changed four things this plan, amended, still says otherwise:

- **A plan held in a note counts** (the lead's ruling). A breakdown's confirmed plan is posted as a note on its run item, so a story built from one can only link it. The receipt's plan-unit form and the lead's clause now accept that link, the clause checks a plan path a defect gives beside its diagnosis link, and it names the line's own `not reached`.
- **One marker, `, by fallback`, ends any line that names a plan** where no planner was bound. `, written by fallback` covered only a file, and three texts disagreed on when it appeared.
- **The work-note operation's row names the diagnosis note** among its uses, and the note ends with the agent footer.
- **The README sentence** no longer calls planning the one step never skipped, since review is never skipped either.

The tests now pin whole sentences, since a rule reversed inside a pinned fragment passed.

## After the full review (2026-10-11)

The full review of the pull request changed four more things; the text below wins over everything above it:

- **The lead's clause checks every path and link, and the Not run list** (the lead's ruling). A line whose second path did not resolve passed "names nothing that resolves", and a story built from a plan unit could list `plan` as not run and repeat its source as its plan. The clause now reads: every path and link the line gives must resolve, and a story that is not a defect never lists `plan` under Not run.
- **The two plan-unit forms have fixed shapes**: `<that plan's path or link>, unit <id or heading>`, and `<the file's path>, filling <that plan's path or link>, unit <id or heading>`. A unit with no id is named by its section's heading.
- **`, by fallback` ends only a line that gives a plan's path or a plan unit.** A defect's "no plan" line and a "not reached" line never take it, and the rule sits inside the one field.
- **Step 3 commits "any plan file written for the story"**, since a unit that is enough leaves no file.

What a worker does when its hand-back goes back to it is its own work item, by the lead's ruling, not part of this change.

The tests pin each of these sentences whole, and four earlier pins that stopped mid-sentence now run to the full stop.

