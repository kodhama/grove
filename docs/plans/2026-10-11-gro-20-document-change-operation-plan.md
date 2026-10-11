---
title: story-worker documents a change at the completion checkpoint - Plan
date: 2026-10-11
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
origin: GRO-20, and the lead's rulings on it of 2026-10-11
---

# story-worker documents a change at the completion checkpoint - Plan

## Goal Capsule

- **Objective:** a pull request that adds a module, a data shape, a contract, a dependency or a design change also carries the update to the repo's reference, architecture or design docs. Where no update was needed, the pull request's body and the receipt say why.
- **Means:** a `document-change` operation in story-worker's routing table, run at the completion checkpoint before the learning capture (KTD1, KTD3).
- **Authority:**
  1. The lead's rulings on GRO-20 (2026-10-11), carried as KTD1 to KTD6.
  2. GRO-20's description.
  3. This plan.
- **Stop conditions:** stop and ask the lead if:
  - a change turns out to need a `Capture:` line, a `Plan:` field, a receipt-check flag that reads the pull request's body, a change to `plan`'s row, or any edit under `skills/project-lead/` (GRO-21 and GRO-22 own those);
  - the fixture cannot bind `document-change` by fallback without changing another test's expectation;
  - the version number is still unnamed when the branch is otherwise final.
- **Execution profile:** test-first. The tests prove the table's shape, the fixture and the wiring of the skill text. Whether discovery leaves an unrelated documentation skill unbound is a model judgment, proven by a setup run after release, outside this pull request.
- **Who finishes:** the GRO-20 worker carries it to a draft pull request, then to ready. The lead names the version at merge-in time. The maintainer approves the merge.

---

## Product Contract

### Summary

story-worker's routing table gains one operation, `document-change`, placed before `capture-learning`. At the completion checkpoint the worker runs it when the diff adds a module, a data shape, a contract, a dependency or a design change. Its performer is the repo's own knowledge-base skill, bound by the repo's override or by setup's discovery; the default table suggests none. The receipt gains a `Docs:` line, and the pull request's body carries the same line before the pull request is marked ready.

### Problem Frame

The maintainer wants architecture and design written back into docs. An audit of 90 pull requests in a consuming repo found that its architecture and data-model reference docs were never updated for three subsystems. story-worker has no docs-update operation: its only write-back at the completion checkpoint is `capture-learning`, which records a lesson and not the reference docs.

### Requirements

Each requirement traces to a sentence of GRO-20's "Wanted" paragraph, or to a lead ruling where the story is silent.

| ID | Requirement | From the story | Lands in |
| --- | --- | --- | --- |
| R1 | story-worker's routing table has a `document-change` operation, run at the completion checkpoint. | "a `document-change` operation in story-worker's routing table, run at the completion checkpoint" | `skills/story-worker/routing.toml` (U2) |
| R2 | The worker runs it when the diff adds a module, a data shape, a contract, a dependency or a design change. Otherwise it lists the operation under Not run, with the reason. | "When the diff adds a module, data shape, contract, dependency or design change, the worker updates the repo's reference, architecture or design docs" | `skills/story-worker/SKILL.md`, step 7 item 5 (U3) |
| R3 | Its performer is the repo's knowledge-base skill. The default table suggests none; the repo's override or setup's discovery binds it. | "through the repo's knowledge-base skill, if it has one. [A consuming repo's override binds that to its own skill.]" | the row's empty `performers` and its `intent` (U2); the widened allow-list (U1) |
| R4 | With no such skill bound, the worker updates the stale docs itself, as the repo's project instructions say. | "if it has one"; lead ruling on the fallback | the row's `fallback` (U2) |
| R5 | The docs update runs before the learning capture, and is checked, committed and pushed in the same pull request. | lead ruling on the order | the row's position (U2); step 7 item 5 (U3) |
| R6 | The receipt carries a `Docs:` line: `updated <paths>`, or `none needed, because …`. | "The PR body and the receipt say what was updated, or 'none needed, because …'" | `skills/story-worker/references/receipt.md` (U3) |
| R7 | The pull request's body carries the same line before the pull request is marked ready. | same sentence | step 7 item 5 (U3) |
| R8 | Skill text names "the repo's knowledge-base skill" and no product, tracker, repo path or version. | "Skill text stays portable: name 'the repo's knowledge-base skill'" | every edit under `skills/` (U2, U3) |
| R9 | The README says that `document-change` has no default performer, and how a repo binds it. | lead ruling D1(a), on the prose that restates the rule | `README.md` (U4) |

### Scope Boundaries

- No `Capture:` line, no `Plan:` field and no change to `plan`'s row.
- No receipt-check flag that reads the pull request's body, and no change to `skills/supervision-setup/scripts/`.
- No edit under `skills/project-lead/`.
- No change to `test/fixtures/supervision/routing-overrides/story-worker.toml`: its header says it is a copy of a consumer's override at a pinned commit.
- **Deferred to follow-up work:**
  - GRO-21 and GRO-22 own the first three bullets above.
  - A consuming repo's override that binds `document-change` to its own skill lands in that repo, with its lock bump.

### Sources

- GRO-20's description, and the lead's rulings of 2026-10-11.
- `test/supervision-routing-tables.test.ts`: the table's schema, the allow-list of operations that may have no performer, and the portability patterns applied to the whole text of each `routing.toml`, comments included.
- `test/supervision-bindings.test.ts`: one binding per table operation, and the example's "has no discovery rows" rule.
- `skills/supervision-setup/SKILL.md`, sections 4 to 6: the check, discovery, and fallback.
- `skills/supervision-setup/scripts/operation-state.mjs`: a binding with `how_bound: "fallback"` reads `by fallback` before any transcript is searched.

---

## Planning Contract

### Key Technical Decisions

KTD1 to KTD4 and KTD6 are the lead's rulings. KTD5 is this plan's own. Nothing in the tests or in setup's rules contradicts a ruling.

- KTD1. **The new row has `performers = []`.** The repo's override or setup's discovery fills it. The row's `intent` names the repo's own knowledge-base skill, so discovery has grounds to leave an unrelated documentation skill unbound. (lead ruling D1(a))
- KTD2. **The test's allow-list widens from "tracker operations" to "operations only the repo can bind".** `TRACKER_OPERATIONS` in `test/supervision-routing-tables.test.ts` is the only gate on an empty `performers`. It gains `document-change` and a name that says what the list now holds. Any other operation with no performer still fails. (lead ruling D1(a))
- KTD3. **Order at the checkpoint: document, then capture, then ready.** The capture's own test asks what "the final code, tests and docs would not preserve", so the docs must be final first. The row sits before `capture-learning` in the table. (lead ruling)
- KTD4. **The row is not required, so it carries a `fallback`.** The table's schema fails a not-required operation with no fallback. (lead ruling)
- KTD5. **The fixture binds `document-change` by `fallback`.** The table suggests no performer, the fixture's override names none, and `test/supervision-bindings.test.ts` fails any discovery row in the example. `post-work-note`, the other empty row, is bound through the override, which this plan does not touch. (planning decision, within KTD1)
- KTD6. **No version bump is planned now.** The lead names the number at merge-in time. `.claude-plugin/plugin.json` reads 0.2.3 today. (lead ruling)

### Assumptions

- A docs update follows the capture's rule after a ready-time fix pass: it does not rerun, unless that pass itself adds something the docs must carry. The rulings do not cover this case.
- The knowledge-base skill runs without stopping for questions, by its invocation token where it has one, as the capture does. A worker asks only its lead.
- The `Docs:` paths are read from the diff at the head, in line with the receipt's rule that every observed field says how it was observed.

### What restates or points at the change

Every hit for `capture-learning`, "Capture, then ready", "completion checkpoint", "tracker operation", "leaves performers empty" and `TRACKER_OPERATIONS`, plus the adjacent wording found while reading.

| Where | What it says | Edit? |
| --- | --- | --- |
| `skills/story-worker/routing.toml`, header comment (lines 25-26) | "The tracker operation (post-work-note) leaves performers empty" | **Yes** (U2) |
| `skills/story-worker/routing.toml`, `capture-learning` row | step "at the completion checkpoint, before the pull request is final" | No. Still true; the new row goes above it. |
| `skills/story-worker/SKILL.md`, step 7 item 5 (lines 269-281) | "Capture, then ready" | **Yes** (U3) |
| `skills/story-worker/SKILL.md`, step 8, the `--not-run` rule | every operation the story did not run goes in the Not run list | No. It already covers a bound `document-change` that was not invoked. |
| `skills/story-worker/references/receipt.md`, the field block | no docs field | **Yes** (U3) |
| `skills/story-worker/references/receipt.md`, "After the pull request is marked ready … step 7" | points at step 7's finish signals | No. Step and item numbers do not move. |
| `README.md`, "Adopt it in a repo" (lines 75-84) | "The work-tracker operations have no default performer" | **Yes** (U4) |
| `README.md`, "What the routing tables expect" (lines 94-112) | lists what each table expects; nothing on docs | **Yes**, one new bullet (U4) |
| `README.md`, the compound-engineering bullet (line 99) | "learning capture and handoffs" | No. `document-change` suggests no skill of that plugin. |
| `test/supervision-routing-tables.test.ts`, header comment (lines 14-21) | "The tracker operations are the only ones a default table may leave without a performer … After this repo's overrides are merged, every operation has one." | **Yes** (U1). No test holds the last sentence, and the new row makes it false for the fixture override. |
| same file, `TRACKER_OPERATIONS` (lines 47-54) and its use (line 124) | the allow-list | **Yes**, renamed and widened (U1) |
| same file, "lets only a tracker operation go without a performer" (line 439) | test title | **Yes**, retitled (U1) |
| same file, the `it.each` over `find-work-items` and `update-work-item` (line 447) | tracker operations may be empty | No. Still true; a sibling case covers `document-change`. |
| same file, the sample case "no suggested performer" on `build` (line 398) | an arbitrary operation may not be empty | No. It is the proof that the widening stays narrow. |
| same file, "only the three review operations carry fresh_context" (lines 312-323) | exact list of marked operations | No. It fails if the new row carries the mark. |
| `test/supervision-receipt-check.test.ts`, line 456 | destructures the example's first two rows as `plan` and `build` | No, but it fixes where the new fixture row may go. |
| `test/supervision-receipt-check.test.ts`, line 1130 | `story-worker/capture-learning` is not `used` | No. |
| `test/fixtures/supervision/bindings.example.json` | one row per table operation; `capture-learning` at line 135 | **Yes**, one new row (U2) |
| `skills/project-lead/routing.toml`, header (lines 24-26) | "The tracker operations (…) leave performers empty" | No. True of that table, and out of scope. |
| `skills/session-restart/routing.toml`, header (lines 19-21) | "the two work-note operations leave performers empty" | No. True of that table. |
| `skills/supervision-setup/SKILL.md`, sections 4 to 6 | an unmatched operation goes to discovery, then to its fallback | No. The rules are general. See Risks for the evidence wording. |
| `docs/decisions/supervision-operating-model.md`, line 57 | "`story-worker/SKILL.md`, step 7" carries the review loop | No. The step number does not move. |
| `docs/plans/2026-10-08-gro-7-project-lead-plain-intent-plan.md`, lines 80 and 171 | "add no operation without a performer"; "every tracker operation id" | No. A merged story's plan, stating that story's own scope. |
| `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` | `version` | Waits (U5). |

### Sequencing

1. U1, the failing tests.
2. U2, the table row and the fixture row together: either one alone turns an existing test red.
3. U3, the skill text and the receipt.
4. U4, the README.
5. U5 waits for the lead's version number.

---

## Implementation Units

### U1. Failing tests, and the widened allow-list

- **Goal:** pin the row's shape, its place, the fixture and the skill text before any of them change.
- **Requirements:** R1, R2, R3, R5, R6, R7; KTD2.
- **Dependencies:** none.
- **Files:** `test/supervision-routing-tables.test.ts`, `test/supervision-bindings.test.ts`.
- **Patterns to follow:** the `diagnose` test ("the story table has a diagnose operation for a defect, before plan") for the row; the `GRO-7 · the intent route's text` block and its `section()` helper for the skill text; the "binds the logical name ce-work …" test for the fixture row.
- **Approach:**
  1. In the schema block, add the sample case first: `SAMPLE` with its id replaced by `document-change` and `performers = []` has no problems. See it fail with `document-change: no suggested performer`.
  2. Rename `TRACKER_OPERATIONS` to a name that says "operations only the repo can bind", add `document-change`, and update the use at the empty-performers check. The sample case turns green.
  3. Rewrite the constant's doc comment and the header comment's sentence (proposed wording below). Retitle "lets only a tracker operation go without a performer" to say "an operation only the repo can bind".
  4. Add the table, text and fixture scenarios below. They stay red until U2 and U3.
- **Execution note:** the allow-list lives in the test file, so its red and green both happen inside this unit, in the order above.
- **Test scenarios** (`test/supervision-routing-tables.test.ts`). Every text comparison collapses whitespace first, as the GRO-7 block does, since the skill text is hard-wrapped:
  - The story table has `document-change`: `performers` is empty, `required` is false, `fallback` is non-empty text, and `step` matches "completion checkpoint".
  - Its index in the table is lower than `capture-learning`'s.
  - Its `intent`, with whitespace collapsed, contains "the repo's own knowledge-base skill".
  - It carries no `fresh_context`: the existing "only the three review operations" test covers this and must stay green.
  - `SAMPLE` renamed to `document-change` with no performer has no problems (step 1 above).
  - `SAMPLE` as `build` with no performer still reports "no suggested performer": the existing case at line 398 stays green and unchanged.
  - Step 7's section of story-worker's `SKILL.md` names `` `document-change` `` before `` `capture-learning` ``, and `document-change` is an id of the story table.
  - That section, with whitespace collapsed, contains "a module, a data shape, a contract, a dependency or a design change" and "Not run".
  - That section mentions the `Docs:` line and the pull request's body before the words "mark the pull request ready".
  - The receipt has a line that starts `Docs:`, and its text contains "none needed, because" and "pull request's body".
- **Test scenarios** (`test/supervision-bindings.test.ts`):
  - The example binds `document-change` with `required: false`, `suggested: []`, `suggested_by: "skill"`, `how_bound: "fallback"`, `kind: "instructions"`, and `native_id` and `source` both `null`.
  - "is well formed", "is complete" and "has no discovery rows" stay green after U2, unchanged.
- **Verification:** exactly the new scenarios are red, apart from the sample case, and every test that existed before is green.

Proposed wording for the header comment in `test/supervision-routing-tables.test.ts`, replacing the two sentences from "The tracker operations" to "every operation has one.":

```text
The operations only the repo can bind, a work tracker's and `document-change`,
whose performer is the repo's own knowledge-base skill (GRO-20), are the only
ones a default table may leave without a performer: the repo's override, or
setup's discovery, supplies it, and a not-required one that neither supplies
runs by its fallback.
```

### U2. The table row and the fixture row

- **Goal:** the story table defines `document-change`, and the example bindings file binds it.
- **Requirements:** R1, R3, R4, R5, R8; KTD1, KTD3, KTD4, KTD5.
- **Dependencies:** U1.
- **Files:** `skills/story-worker/routing.toml`, `test/fixtures/supervision/bindings.example.json`.
- **Approach:**
  1. Insert the row below between `resolve-pr-feedback` and `capture-learning`.
  2. Replace the header comment's last two lines with the wording below.
  3. Insert the fixture row immediately before the `capture-learning` row. `plan` and `build` stay first and second.
  4. Leave `table.sha256` in the fixture alone: it already differs from the table's current hash, and the tests that need a current one compute it.
- **Test scenarios:** covered by U1.
- **Verification:** U1's table and fixture scenarios pass, and the whole suite is green except U1's text scenarios.

Proposed row. The worker may adjust words, not fields. The text avoids digits, a colon between two words, and a leading slash, which the portability patterns fail anywhere in the file.

```toml
[[operation]]
id = "document-change"
intent = """
Update the repo's reference, architecture and design docs for what the change
adds: a module, a data shape, a contract, a dependency or a design change. The
performer is the repo's own knowledge-base skill, the one the repo ships or its
project instructions name for keeping those docs. A general writing,
documentation or learning-capture skill is not one."""
step = "at the completion checkpoint, before any learning is captured, when the diff adds a module, a data shape, a contract, a dependency or a design change"
performers = []
required = false
fallback = """
Update the docs the change makes stale yourself, where the repo's project
instructions say they live and in the shape they ask for. Where nothing is
stale, or the instructions name no such docs, change nothing, and say none
needed and why."""
```

Proposed header comment, replacing lines 25-26:

```toml
# The table names no work tracker and no knowledge-base skill. The two
# operations only the repo can bind (post-work-note, document-change) leave
# performers empty for the repo's override or setup's discovery to fill.
```

Proposed fixture row:

```json
{
  "table": "story-worker",
  "id": "document-change",
  "required": false,
  "suggested": [],
  "suggested_by": "skill",
  "how_bound": "fallback",
  "kind": "instructions",
  "native_id": null,
  "source": null,
  "invoke": "Run the document-change operation's fallback instructions from the table.",
  "evidence": "the table and the override suggest no performer, and discovery found no knowledge-base skill in the skill listing: the nearest entry, \"- compound-engineering:ce-compound: Document a solved problem as a durable repo learning.\", records a lesson, not the repo's reference docs"
}
```

### U3. Step 7 item 5, and the receipt's `Docs:` field

- **Goal:** the worker knows when to run `document-change`, in what order, and where to report it.
- **Requirements:** R2, R5, R6, R7, R8; KTD3.
- **Dependencies:** U2.
- **Files:** `skills/story-worker/SKILL.md` (step 7, item 5 only), `skills/story-worker/references/receipt.md` (one field in the block).
- **Approach:**
  1. Replace item 5's text up to "Check that each automated reviewer" with the wording below. The sentences from "Check that each automated reviewer" on stay as they are, and the item keeps its number.
  2. Add the `Docs:` field to the receipt's block after `Acceptance:` and before `Reviewed by:`, aligned with the other fields.
- **Test scenarios:** covered by U1.
- **Verification:** U1's text scenarios pass. Read step 7 and step 8 once through for a sentence that still describes the checkpoint as capture alone.

Proposed item 5, first part:

```markdown
5. **Document, then capture, then ready.** Before you call the branch final,
   bring the repo's docs up to the change. When the diff adds a module, a data
   shape, a contract, a dependency or a design change, invoke the performer
   bound to `document-change`, which updates the repo's reference,
   architecture and design docs. When the diff adds none of them, do not
   invoke it: list the operation under Not run, with that reason. The docs come
   first because the capture's test is what the final code, tests and docs
   would not preserve. Then invoke the performer bound to `capture-learning`,
   only when the story produced a lesson the final code, tests and docs would
   not preserve. Run each without stopping for questions, by its invocation
   token where it has one (`mode:non-interactive` for Compound Engineering's
   capture skill). Run the checks on what they write, then commit and push it,
   so the docs and the learning ship in this pull request and every reviewer
   sees them. Write the receipt's `Docs:` line, as `references/receipt.md`
   gives it, and put the same line in the pull request's body. Then mark the
   pull request ready. Neither operation reruns after the fix pass that
   follows a ready-time first review, unless that pass itself adds something
   the docs must carry, or produced a lesson that meets the capture's test;
   then that one runs once more and ships in that pass's push, and the `Docs:`
   line is brought up to date in both places.
```

Proposed receipt field:

```text
Docs:            <updated <each doc's path, as the diff at the head lists it> | none needed,
                  because <why: the diff adds no module, data shape, contract, dependency or
                  design change, or the docs already cover what it adds> — the same line the
                  pull request's body carries>
```

### U4. README

- **Goal:** an adopter learns that `document-change` has no default performer, and how to bind it.
- **Requirements:** R9.
- **Dependencies:** U2.
- **Files:** `README.md`.
- **Approach:**
  1. In "Adopt it in a repo", reword the routing-overrides bullet as below. The three sub-bullets that list the tracker operations stay.
  2. In "What the routing tables expect", add the new bullet after "Your work tracker".
  3. In the "Project instructions" bullet, add which docs a change keeps current to the list of what the instructions name. The row's fallback reads them there. This phrase is OQ1; the lead may strike it.
- **Test expectation:** none. No test reads the README's prose.
- **Verification:** the README's account of empty performers matches the table's header comment and the test's header comment.

Proposed sentence, replacing "The work-tracker operations have no default performer, so your overrides name your tracker's tools:":

```markdown
Some operations have no default performer, because only your repo can bind
them. `story-worker`'s `document-change` is one: name the skill that keeps
your reference, architecture and design docs. With none named, the worker
updates the stale docs itself, as your project instructions say. The
work-tracker operations are the others, and your overrides name your
tracker's tools:
```

Proposed bullet:

```markdown
- **Your knowledge-base skill**, through your override: `document-change`
  updates your reference, architecture and design docs at the completion
  checkpoint, when a change adds a module, a data shape, a contract, a
  dependency or a design change. It is optional. Without it the worker
  updates those docs itself, and the receipt says the step ran by fallback.
```

### U5. Version bump

- **Goal:** the change reaches installs.
- **Requirements:** KTD6.
- **Dependencies:** the lead's version number.
- **Files:** `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, together.
- **Test scenarios:** the existing manifest test, which checks that the two versions are equal and semver-shaped.
- **Verification:** `npm test`. This unit waits: do not pick a number.

---

## Verification Contract

| check | command | when |
| --- | --- | --- |
| focused tests | `npx vitest run test/supervision-routing-tables.test.ts test/supervision-bindings.test.ts` | after U1, U2 and U3 |
| typecheck | `npm run typecheck` | after staging, before every push |
| tests | `npm test` | after staging, before every push |
| restatement sweep | `grep -rnI --exclude-dir=node_modules --exclude-dir=.git -e "TRACKER_OPERATIONS" -e "tracker operation" -e "Capture, then ready" -e "completion checkpoint" .` | before the review |
| secrets | gitleaks | CI only |
| review | `/code-review` in a fresh-context subagent; `@codex review` after any fix, since the change alters what an instruction tells agents to do | before the pull request opens |

The lead's instruction is to stage before running the checks. In this checkout `npm test` is `vitest run` and `npm run typecheck` is `tsc --noEmit`, and nothing in the repo ties either to the index, so the plan could not confirm that from the repo.

The sweep should show `TRACKER_OPERATIONS` and "Capture, then ready" gone, and "tracker operation" only in the rows the table above marks "No".

**By-eye portability check.** The tests apply every portability pattern to `routing.toml`, and the tracker-word and plan-tag patterns to all Markdown under `skills/`. They do not apply the path, version and invocation-form patterns to step 7 or to the receipt, both of which already hold text those patterns fail (`mode:non-interactive`, `file:line`). Read the new sentences in `SKILL.md` and `receipt.md` against this list:

- no absolute path, and no repo path beyond `references/receipt.md`;
- no version-like number;
- no `word:word` token and no slash command beyond the `mode:non-interactive` token already there;
- no product, plugin or tracker name for the knowledge-base skill: only "the repo's knowledge-base skill" or "the performer bound to `document-change`".

---

## Risks

- **Discovery may still bind an unrelated documentation skill.** The row's `intent` is the only lever (KTD1), and discovery is a model's judgment that no test here can run. A consuming repo avoids it by binding through its override. A setup run after release, in a session that lists a general documentation skill and no knowledge-base skill, shows whether the wording holds.
- **A consuming repo's tests may go red on its lock bump.** A repo that holds a bindings example against the installed table, as this repo's fixture does, fails "complete, but story-worker/document-change has no binding" until it adds a row. This is inferred from this repo's tests, not confirmed in any consumer.
- **Setup has no evidence wording for an unmatched operation with no suggested name.** `skills/supervision-setup/SKILL.md` gives one clause per suggested name. Optional tracker operations with no override already meet this gap; `document-change` meets it in every repo that binds no knowledge-base skill. The fixture row's evidence quotes the nearest rejected entry instead. See OQ2.
- **"A design change" is a judgment.** A worker may decide the diff adds none. The `Docs:` line puts that judgment and its reason in front of the lead and the reviewers; nothing here enforces it.
- **The fixture row is assumed inert in the other suites.** Reading `operation-state.mjs` and the report's summary shows a `by fallback` row is neither searched for nor counted, and for a story-worker row `start-restart.sh` reads only its table and id. No test was run while planning: the full `npm test` run confirms or refutes it.

## Open Questions

Neither blocks the work.

- OQ1. Should the README's "Project instructions" bullet, and `SKILL.md`'s opening list of what those instructions hold, say that they name which docs a change keeps current? The fallback depends on it. The plan adds the phrase to the README (U4) and leaves `SKILL.md`'s list alone.
- OQ2. Should supervision-setup say what evidence a fallback binding records when its operation has no suggested name? The plan leaves setup alone and expects the worker to report it under "Skill got wrong".

---

## Definition of Done

- U1's scenarios were red before U2 and U3 and are green after, and every other test stays green.
- Typecheck and tests pass locally, and CI's `test` job is green on the pull request's head.
- `document-change` sits before `capture-learning`, has no performer, is not required, has a fallback, and carries no `fresh_context`.
- The table's header comment, the test's header comment and the README give the same account of which operations may have no performer.
- The by-eye portability check was done on the new sentences in `SKILL.md` and `receipt.md`.
- Nothing listed under Scope Boundaries changed.
- Both manifests carry the version the lead named, or the pull request is still a draft waiting for it.
- A fresh-context review ran and its findings were triaged. The pull request's body has `Fixes GRO-20`.
- No abandoned-attempt text is left in the diff.

---

## After the reviews

This plan is the record of what was planned. Two things it says were left alone changed afterwards, in the fix commit that followed the floor review:

- **OQ1 went further than planned.** `skills/story-worker/SKILL.md`'s opening list of what project instructions hold now names which docs a change keeps current, as the README does.
- **OQ2 was closed.** `skills/supervision-setup/SKILL.md` now gives the evidence wording for an operation with no suggested name, and the fixture row uses it, so the "What restates or points at the change" row for setup and the Risks entry on evidence wording no longer describe the branch.

The receipt's `Docs:` field also gained a third value, `not reached: <why>`, and its `By fallback:` field says where an operation bound by fallback that did not run is listed.

**The fallback this plan quotes changed after the full review.** As planned, a repo whose project instructions named no docs got nothing changed and a `none needed` line, though it might still keep reference docs. The fallback now looks at the reference, architecture and design docs the repo keeps, and only a repo that keeps none is a reason to change nothing; the receipt's `Docs:` reason says the same. grove's `AGENTS.md` names `README.md` as the doc a change here keeps current, and `docs/decisions/` where the change supersedes a decision recorded there. The fallback also says the `Docs:` line lists a doc the pull request updated before the checkpoint, and the README gives an adopter the order: update grove everywhere, then name the operation in an override.
