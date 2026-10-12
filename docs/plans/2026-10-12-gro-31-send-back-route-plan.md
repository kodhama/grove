---
title: A route for a hand-back its lead sends back - Plan
date: 2026-10-12
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
origin: GRO-31
---

# A route for a hand-back its lead sends back - Plan

## Goal Capsule

- **Objective:** a story whose hand-back the lead sends back still reaches a ready pull request with a receipt the lead can accept, whether or not the worker that handed back is still running.
- **Means:** one new section in story-worker and one passage in project-lead's step 7 hold the rule, and the clauses that send work back point at them (KTD1).
- **Authority:**
  1. The lead's rulings on the open decisions below, once given.
  2. GRO-31's description.
  3. This plan.
- **Stop conditions:** stop and ask the lead if:
  - the lead rules an open decision against the default this plan builds;
  - a change turns out to need a script change, a new table row, a new `STATUS` shape or a new receipt field;
  - an existing test's assertion would have to be edited to go green;
  - the new text cannot pass the portability tests without changing those tests;
  - `main` has moved the text read at `8cf2f13`, so an insertion point below no longer exists.
- **Execution profile:** test-first. The change is skill text, so the tests pin whole sentences, and a by-eye portability read covers what they do not reach.
- **Who finishes:** the GRO-31 worker carries it to a draft pull request and marks it ready. The lead rules on OD1 and OD2. The maintainer approves the merge.

---

## Product Contract

### Summary

story-worker gains one section, "A hand-back that comes back". It tells a worker whose hand-back is sent back to fix what the lead named, rerun the receipt check, post the receipt again and resend `STATUS: ready`, and it tells a new worker how to take up a story whose first worker has ended. project-lead gains one passage, "Sending it back", in step 7. It says how the lead sends a hand-back back, who picks the story up when the worker's session has ended, and how to read what returns. Three one-sentence pointers tie the existing clauses to those two places.

### Problem Frame

The lead's text sends work back to the worker in four places: a missing `Capture:` or `Docs:` line, a `Plan:` line that names nothing, a real defect after review, and the maintainer's answer to a `STATUS: refused` line. story-worker has no receiving side for the first three: its hand-back "ends the story", and step 8 closes with "Then stop." Nothing says what the worker does next, whether the receipt is the same one, or who acts when the worker's session is gone.

### Requirements

| ID | Requirement | From | Lands in |
| --- | --- | --- | --- |
| R1 | A worker whose hand-back is sent back fixes what the lead named, reruns the receipt check, posts the receipt again and resends `STATUS: ready`. | "What a sent-back worker does" | `skills/story-worker/SKILL.md`, new section (U2) |
| R2 | The text says who picks a story up when its worker's session has ended, and what that session starts from. | "What happens when the worker's session has ended" | both skills (U2, U3) |
| R3 | One passage on each side holds the rule. Each clause that sends work back points at it and restates none of it. | "One place that says it" | U2, U3 |
| R4 | The lead knows how to send a hand-back back and how to read what returns. | "One place that says it", the lead's half | `skills/project-lead/SKILL.md`, step 7 (U3) |
| R5 | Each of the issue's three open questions ends answered in the skill text, or flagged for the lead. | "Open questions for the story" | KTD2 to KTD5, Open Questions |
| R6 | Skill text stays portable: no repo path, tracker name, version or harness-specific invocation. | `AGENTS.md`, "The skills are portable" | U2, U3, held by U1 |
| R7 | Text that restates or points at the change agrees with it. | story-worker's "Check what points at your change" | the table under "What restates or points at the change" |
| R8 | Both plugin manifests carry `0.2.12`. | `AGENTS.md`, "Branch, commit, and PR rules" | U4 |

### Scope Boundaries

- No new `STATUS` shape. The resent line is `STATUS: ready`, as the issue proposes.
- No new receipt field, and no edit to `references/receipt.md`. The reposted receipt says in its first line that it replaces the earlier one.
- No script change and no new row in either routing table.
- No rewording of the existing "goes back to the worker" sentences. Tests pin four of them whole (F12).
- No README sentence and no decision-record entry (KTD9).

### Deferred to Follow-Up Work

Gaps found while planning. None is planned here.

- **A blocked hand-back whose blocker the lead removes has no route back either.** The lead's text says "remove the blocker if it is yours to remove" (`skills/project-lead/SKILL.md:301-302`) and nothing after it. The worker's text counts a blocked hand-back as an ending (`skills/story-worker/SKILL.md:374-376`).
- **Nothing caps how often a hand-back is sent back over a line.** Item 4's cap counts fix passes after automated review rounds only (`skills/project-lead/SKILL.md:344-345`).
- **The lead's own handoff does not name a send-back awaiting its answer.** It carries each story's "last `STATUS`" and "any message held for it" (`skills/project-lead/SKILL.md:439-444`), so a resumed lead reads `ready` for a hand-back it already sent back.
- **A worker that ends mid-story with no refusal open and no handoff** has no pick-up rule. This plan covers the ended worker only after a hand-back, and after a refused line.
- **"If it is still up" has no test.** Neither skill says how a lead tells a live worker from an ended one (`skills/project-lead/SKILL.md:343`).
- **The story table has no operation for reading a work note.** A new worker reads the earlier receipt's note the way every worker reads its assignment note today, with no binding (`skills/story-worker/routing.toml`, operation ids).
- **Step 8 names `--handoff` only for a session resumed from a handoff** (`skills/story-worker/SKILL.md:390-392`). The new section adds a second case in another section.
- **Uncommitted work an ended worker left in the worktree** gets one clause here, "goes to its lead before it touches it". Keeping or discarding it has no rule.

### Sources

- GRO-31's description, quoted in the assignment.
- The files under "Facts", read at `8cf2f13`.

---

## Planning Contract

### Facts at `8cf2f13`

Every line number is from `8cf2f13`. "Verified" means the text was read at that line. "Inferred" means reasoning from what was read. No test was run: this plan was written without building.

| ID | Fact | Where | Status |
| --- | --- | --- | --- |
| F1 | The lead sends a hand-back back over the capture and docs lines: "A hand-back missing either line in either place, or with a line whose value differs between the two, goes back to the worker, and so does one whose pasted check shows a body line as anything but `found`." | `skills/project-lead/SKILL.md:312-315` | Verified |
| F2 | The lead sends one back over the plan line: "A hand-back goes back to the worker when its line is missing, reads `not reached`, gives a path or link that does not resolve…" and "So does one that lists `plan` as not run for a story that is not a defect, or whose pasted receipt check shows `plan` as `bound-but-unused`". | `skills/project-lead/SKILL.md:330-335` | Verified |
| F3 | The lead already says who takes a fix pass: "A real defect goes back to the same worker, if it is still up, for one more fix pass. Otherwise it goes to a new worker." | `skills/project-lead/SKILL.md:343-344` | Verified |
| F4 | The lead already says how a new head is read: "A fix pass makes a new head, and that head goes through items 1 to 4 again before you ask for the merge: its claims, its receipt, its acceptance, and a fresh review of what the fix changed. A review or receipt of an earlier head does not cover it." | `skills/project-lead/SKILL.md:349-353` | Verified |
| F5 | The lead passes a refusal's answer back: "Pass the answer back as what they did: they ran it, and the worker reads its branch's head again before it goes on; they allowed it…". | `skills/project-lead/SKILL.md:226-231` | Verified |
| F6 | The lead closes a worker's session only after the merge: "Merge only on their approval… Then close the worker's session". A defect run ends a cancelled worker the same way. | `skills/project-lead/SKILL.md:359-363`; `skills/project-lead/references/defect-run.md:144-146` | Verified |
| F7 | The `restart-owner: lead` route starts from a handoff: "Launch it through `start-worker` from the handoff's launch line". | `skills/project-lead/SKILL.md:369-373` | Verified |
| F8 | story-worker's hand-back has no receiving side: "A hand-back ends the story… Those are the only two endings." and "Then stop. The maintainer approves the merge, through your lead." Step 8 writes no handoff: its only mention of one is the `--handoff` flag. | `skills/story-worker/SKILL.md:374-376`, `390-392`, `417` | Verified |
| F9 | A worker makes one fix pass, and a re-review's findings go up: "What a re-review raises goes to your lead, not into a second fix pass. Repeated passes are where rounds churn. Your lead triages it." | `skills/story-worker/SKILL.md:369-370` | Verified |
| F10 | A story's start is recorded once, and a later session keeps it: "A session that resumes the story keeps the Started its handoff carries and never records a new one". | `skills/story-worker/SKILL.md:117-123` | Verified |
| F11 | The receipt check cuts every call before `--since`: "With `--since <zoned time>`, calls before that time do not count either, in any session". The worker passes its Started as `--since`. | `skills/supervision-setup/scripts/receipt-check.mjs:64-67`; `skills/story-worker/SKILL.md:382-385` | Verified |
| F12 | Tests pin these sentences whole with `toContain`: the capture and docs sentence of F1 (`:1396`), the plan sentences of F2 (`:767-768`), the pass-back sentence of F5 (`:1098`, `:1188`, `:1197`), the refused bullet's last sentence (`:1190`), and step 8's "Those are the only two endings." and "An open `DECISION` is not one…" (`:1247`, `:1250`). No test pins `:304`, `:343-344` or `:417`. | `test/supervision-routing-tables.test.ts` | Verified |
| F13 | The receipt is "One page per story, filled from observed values and posted as the hand-back's work note." The only note operation a worker has is `post-work-note`, whose step is "with every hand-back". | `skills/story-worker/references/receipt.md:3-4`; `skills/story-worker/routing.toml:220-225` | Verified |
| F14 | A worker with a refusal open keeps going and is woken by the answer: "end your turn only when nothing independent is left; the answer arrives as a message". Never says what each answer means. | `skills/story-worker/SKILL.md:458-460`, `59-62` | Verified |
| F15 | The check takes an earlier result from a file's `## Receipt check` section, for a session it cannot read. An existing test gives it a bindings file that lists only the later session and expects the earlier session's operation to read `used … (carried from handoff)`. A carried use is dropped unless both checks ran with the same `--since`. | `skills/supervision-setup/scripts/handoff-receipt.mjs:32-33`; `receipt-check.mjs:228-241`; `test/supervision-receipt-check.test.ts:1775-1787`, `2030` | Verified by reading, not run |
| F16 | A first setup lists only its own transcript. Only a run seeded with a handoff keeps the earlier ones. | `skills/supervision-setup/SKILL.md:94-98` | Verified |
| F17 | The decision record says "A lead does not restart its workers." | `docs/decisions/supervision-operating-model.md:135-136` | Verified |
| F18 | The portability patterns run over all of project-lead's `SKILL.md`. In story-worker they run over the defect section, step 3, "What you are given" and Never, so a new section is not reached. The tracker-word and plan-tag patterns run over every Markdown file under `skills/`. | `test/supervision-routing-tables.test.ts:618-624`, `779-786`, `808-813`, `1049-1052`, `1301` | Verified |
| F19 | Both manifests read `0.2.11`. A test holds them equal and semver-shaped. | `.claude-plugin/plugin.json:3`; `.codex-plugin/plugin.json:3`; `test/plugin-manifests.test.ts:30-34` | Verified |
| F20 | A lead keeps a wake-up armed while "a story's pull request is in review, from its hand-back until it merges or closes", so a send-back's answer is already watched for. | `skills/project-lead/SKILL.md:279-283` | Verified |
| F21 | A worker that handed back and then ended left no handoff, so the `restart-owner: lead` route has nothing to launch from. | F7, F8 | Inferred |
| F22 | A worker that recorded a new Started on a send-back would fail its own check: the check would cut the story's planning, build and review calls. | F11 | Inferred |
| F23 | A new worker's check cannot read the first worker's transcripts, so without help it reads the first worker's operations as `bound-but-unused`, and item 2 of the lead's check would send it back again. | F2, F16 | Inferred |

### Key Technical Decisions

- KTD1. **One section in story-worker and one passage in project-lead's step 7 own the rule. Three pointer sentences reach them, and no existing clause is reworded.** The pinned sentences (F12) stay as they are. One lead-in sentence above the lead's numbered list covers every "goes back to the worker" in items 1, 2 and 4. One sentence ends the refused bullet in step 5. One sentence ends the worker's step 8.
- KTD2. **A sent-back hand-back is the same story: the same Started, the same receipt page, posted again as a new note.** This answers the issue's first question for a worker that is still running, from the repo's text: one page per story (F13), a start recorded once (F10), and a check that would fail under a new start (F22). The earlier note stays untouched, since a note is what the lead read and the table offers no way to edit one (F13).
- KTD3. **A send-back fix that changes the branch is a fix pass under step 7's existing rules.** This answers the third question from the repo's text. Item 6 holds, so what a re-review of the new head raises goes to the lead (F9). The fix also gets its own review, which is the lead's: the new head goes through items 1 to 4 again (F4). The worker runs no review of its own on the fix, as for any fix pass today, and its receipt's Shipped revision says what covers the new head.
- KTD4. **When the worker's session has ended, the lead starts a new worker on the story. It is not a restart, and it does not go to the maintainer.** This answers the second question from the repo's text: the lead already sends a fix pass "to a new worker" (F3), the restart route needs a handoff the ended worker never wrote (F21), and a lead does not restart its workers (F17). Applying F3's sentence to the other send-backs is this plan's inference.
- KTD5. **A new worker keeps the story's Started and its one receipt page, and hands the check the earlier worker's result through `--handoff`.** The repo's text does not settle this (OD1). The default follows KTD2, and it uses the route a successor on another machine already uses (F15), so the pasted check reads `used … (carried from handoff)` and the lead's item 2 does not misfire (F23).
- KTD6. **The refused-line answer is covered in the same two places, with the least text.** A live worker already has its receiving side (F14). The new text adds only the ended session: the lead gives the answer to a new worker, which finds where the story stands from the branch, the pull request and the notes (OD2).
- KTD7. **The tests pin whole sentences, so a name one text quotes from another cannot drift unseen.** The worker's step 8 and the lead's passage quote the heading "A hand-back that comes back". The lead's two pointers quote "Sending it back". The worker's section quotes the restart skill's `## Receipt check` heading, which one more test holds in the restart skill and in the script that reads it. A heading renamed on one side turns a test red.
- KTD8. **The new worker section gets its own portability test.** The patterns do not reach a new story-worker section today (F18).
- KTD9. **No README sentence and no decision-record entry.** The README names the hand-back once, as something the lead accepts on its evidence, and restates none of its flow (`README.md:13`). The decision record holds the maintainer's rulings and "makes none of its own". This change agrees with its D21 (F17).

### Assumptions

Bets this plan made without asking. Each can be cut on its own.

- The worker measures its context when a send-back arrives. Cutting it removes one sentence from U2 and one test string.
- The lead reads items 1 and 2 through before it sends a hand-back back over a line, so one message names everything. Cutting it removes one sentence from U3.
- A worker that cannot fix what was named sends a `DECISION` or hands back blocked. Cutting it removes one paragraph from U2.
- The reposted receipt's first line says it replaces the earlier one. The receipt gets no new field for a send-back.
- The implementing pull request's `Docs:` line reads `none needed`: no reference, architecture or design doc restates the hand-back's flow (KTD9).
- No other open pull request appends a test block at the end of `test/supervision-routing-tables.test.ts`.

### What restates or points at the change

Every hit outside `docs/plans/` for: "goes back to", "back to the worker", "fix pass", "still up", "new worker", "ends the story", "Then stop", "only two endings", "restart-owner", "Pass the answer back", "hand-back", "handed back", "Started", "--handoff".

| Where | What it says | Edit? |
| --- | --- | --- |
| `skills/story-worker/SKILL.md:417` | "Then stop." | **Yes** (U2): one sentence appended |
| same file, `374-380`, step 8's opening | a hand-back ends the story; the only two endings | No. Pinned (F12). The appended sentence at `:417` says the story opens again. |
| same file, `382-402`, the receipt-check bullet | `--since` the Started; `--handoff` for a session resumed from a handoff | No. The new section reruns it as written, and adds the new worker's use of `--handoff`. |
| same file, `336-340`, `361-364`, `369-370`, step 7 items 4 to 6 | one fix pass; when docs and capture rerun; a re-review goes to the lead | No. The new section cites them. |
| same file, `117-123`, Started | recorded once; a resumed session keeps it | No. The new section extends the same rule to a new worker. |
| same file, `48-77`, Never's refused bullet | what each answer to a refusal means | No. The new section points at it. |
| same file, `131-134`, step 2 | an unexplained branch or worktree is a stop | No. The assignment explains them. |
| same file, `447-452`, the two message shapes | `ready <url> <head sha>` | No. The resent line has the same shape. |
| same file, `477`, "Context and restart" | measure at each step boundary | No. The new section names the message's arrival as one. |
| `skills/story-worker/references/receipt.md:3-4`, `35`, `59-61` | one page per story; Started; the Receipt check field | No. All three agree with KTD2. |
| `skills/story-worker/routing.toml:208-225` | `hand-back` runs "last"; `post-work-note` "with every hand-back" | No |
| `skills/project-lead/SKILL.md:304` | "**When the pull request is ready:**" | **Yes** (U3): the lead-in gains the pointer |
| same file, `312-315`, `330-335` | the capture, docs and plan send-backs | No. Pinned (F12). The lead-in above them points at the passage. |
| same file, `341-353`, item 4 | same worker if it is still up, otherwise a new worker; a new head goes through items 1 to 4 again | No. The new passage agrees with both sentences and builds on them. |
| same file, after `367` | end of item 7 | **Yes** (U3): the new passage goes here |
| same file, `369-389` | the `restart-owner: lead` handoff | No. The new passage names it as the one exception. |
| same file, `218-234`, the refused bullet | pass the answer back | **Yes** (U3): one sentence appended after the pinned last sentence |
| same file, `151-167`, step 4 | look for existing work; make its worktree; post its assignment | No. The new passage says what the assignment adds and that the worktree is reused. |
| same file, `268-286`, step 6 | notes read at every event; a wake-up while a pull request is in review | No (F20) |
| same file, `439-444`, the lead's handoff | each story's last `STATUS` and any message held | No. Listed under "Deferred to Follow-Up Work". |
| `skills/project-lead/routing.toml:195-200` | `review-before-merge` runs "at each hand-back whose pull request is ready" | No. A resent hand-back is one. |
| `skills/project-lead/references/defect-run.md:140-146`, `intent-run.md:71-75`, `131-139` | a blocked defect; a lead carrying its own story | No. For a lead carrying its own story the maintainer is its lead, and the section's "your lead" reads so (`skills/story-worker/SKILL.md:440`). |
| `skills/session-restart/SKILL.md:152-160`, `184-192` | the `## Receipt check` section and what `--handoff` carries | No. U1 holds the heading. |
| `skills/supervision-setup/scripts/*.mjs` | `--since`, `--handoff` | No. No script changes. |
| `README.md:13`, `AGENTS.md`, `docs/decisions/supervision-operating-model.md:132-140` | the lead accepts a hand-back; D21 | No (KTD9) |
| `test/supervision-routing-tables.test.ts` | the pins of F12 | **Yes** (U1): a new block. No existing assertion changes. |
| `test/supervision-receipt-check.test.ts:1775-1787`, `2030` | a carried use counts for an unlisted session, under one `--since` | No. They are the evidence for KTD5. |
| `.claude-plugin/plugin.json:3`, `.codex-plugin/plugin.json:3` | `version` | **Yes** (U4) |

### Sequencing

1. U1, the failing tests.
2. U2 and U3 make them pass.
3. U4 bumps the version once the branch is otherwise final.

---

## Implementation Units

### U1. Failing tests

- **Goal:** pin the new wording before any skill text changes.
- **Requirements:** R1 to R7.
- **Files:** `test/supervision-routing-tables.test.ts`.
- **Patterns:** the `describe("GRO-21 · the Capture line's text")` block and the `GRO-17` block, with the file's helpers `section`, `read`, `LEAD`, `WORKER`, `idsOf` and `textProblems`. Collapse whitespace to one space before comparing, as those blocks do.
- **Approach:**
  1. Add one `describe`, titled for GRO-31, at the end of the file, after the `GRO-21` block.
  2. Give it a doc comment in the file's style: the tracker id, then the rule in two or three lines.
  3. Declare three readers inside the block: the worker's new section, by `section(read(WORKER), "A hand-back that comes back")`; the worker's step 8; and the lead's passage, as the text of `section(read(LEAD), "7. A hand-back")` from `**Sending it back.**` up to ``**A `restart-owner: lead` handoff**``.
  4. Pin each sentence whole, from its first word to its full stop, as U2 and U3 give it.
- **Test scenarios.** Scenarios 1 to 12 are red on `8cf2f13`: the section and the passage do not exist, so each reader returns an empty string. Scenario 13 is green before and after.
  1. The worker's file has the section "A hand-back that comes back", after `## 8. Hand back` and before `## Talking to your lead, and to the maintainer`.
  2. Step 8 ends by pointing at it: it contains `If your lead sends the hand-back back to you, the story is open again: see "A hand-back that comes back".`
  3. The section says the story is the same one: it contains `That opens the story again.` and `It is the same story, with the same Started time and the same receipt, never a new one.`
  4. The section has the worker measure first: it contains `The message's arrival is a step boundary: measure your context before you act on it (see "Context and restart").`
  5. The section's three steps, each sentence whole: `**Fix what your lead named, and only that.**`; `What a re-review of the new head raises goes to your lead (item 6), never into another pass.`; `A fix to the receipt or to the pull request's body alone makes no new head.`; `Rerun the receipt check on the same bindings file with the same Started, with the body saved again after your last edit to it.`; the whole sentence that posts the receipt as a new note; ``Send `STATUS: ready` again, with the head as it now stands and the new note's link.``
  6. The section covers a fix that cannot be made: it contains the whole sentence that starts `Where you cannot fix what was named`.
  7. The section covers a new worker: it contains `If that is you, run setup as step 1 says, but record no new Started: keep the one the earlier receipt carries, as a resumed session keeps its handoff's.`, `Plan and build nothing again: do the three steps above, with two differences.`, the whole sentence on carrying fields over, and the whole sentence that passes the earlier check's output as `--handoff`.
  8. The section covers a refusal's answer: it contains the whole paragraph that starts ``**The answer to a `STATUS: refused` line** comes back the same two ways.``, sentence by sentence.
  9. The section names no harness, path, version or tracker: it is not empty, and `textProblems` returns nothing for it.
  10. The lead's passage, each sentence whole, as U3 gives it. It sits after `**Merge only on their approval**` and before ``**A `restart-owner: lead` handoff**``. `start-worker` is an operation of the lead's table.
  11. The lead's list opens with the pointer: step 7 contains `**When the pull request is ready**, take these in order. Where one sends the hand-back back to the worker, "Sending it back", below them, says how:`, and no longer contains `**When the pull request is ready:**`.
  12. The lead's refused bullet ends with the pointer: step 5 contains `Where the worker's session has ended before the answer comes, the answer goes to a new worker, as step 7's "Sending it back" says.`
  13. The heading the worker's section quotes from the restart skill still exists: `skills/session-restart/SKILL.md` has a line `## Receipt check`, and `skills/supervision-setup/scripts/handoff-receipt.mjs` holds the same string. The other quoted names need no test of their own: scenarios 1, 2 and 10 to 12 already fail when "A hand-back that comes back" or "Sending it back" is renamed on one side only.
- **Verification:** `npm test` shows scenarios 1 to 12 red and every test that existed before green. `npm run typecheck` passes.

### U2. story-worker: step 8's last line and the new section

- **Goal:** a worker whose hand-back comes back, and a new worker started on such a story, each know what to do.
- **Requirements:** R1, R2, R3, R5, R6.
- **Dependencies:** U1.
- **Files:** `skills/story-worker/SKILL.md`.
- **Approach:** the wording below, as written. Nothing else in the file changes.

**Step 8's last line** (`:417`). Append one sentence:

```text
Then stop. The maintainer approves the merge, through your lead. If your lead
sends the hand-back back to you, the story is open again: see "A hand-back
that comes back".
```

**The new section**, inserted after step 8 and before `## Talking to your lead, and to the maintainer`:

```text
## A hand-back that comes back

Your lead reads every hand-back and may send one back, in a message that
names what it lacks or gets wrong. That opens the story again. It is the same
story, with the same Started time and the same receipt, never a new one.

The message's arrival is a step boundary: measure your context before you act
on it (see "Context and restart"). Then:

1. **Fix what your lead named, and only that.** Anything else you notice goes
   to your lead as a line of its own.
2. **A fix that changes the branch is a fix pass**, and step 7's rules for one
   hold: run the checks, commit and push, wait for the new head's checks with
   a deadline, and rerun the docs or the capture only where item 5 says a fix
   pass does. What a re-review of the new head raises goes to your lead
   (item 6), never into another pass. A fix to the receipt or to the pull
   request's body alone makes no new head.
3. **Hand back again, as step 8 says.** Rerun the receipt check on the same
   bindings file with the same Started, with the body saved again after your
   last edit to it. Bring the receipt up to date in every field the fix
   touched, and post it as a new note whose first line says it replaces the
   earlier receipt and what changed. Leave the earlier note as it is: it is
   what your lead read. Send `STATUS: ready` again, with the head as it now
   stands and the new note's link. Then stop, as before.

Where you cannot fix what was named, say so rather than hand back the same
thing: a `DECISION` where your lead has a choice to make, a blocked hand-back
where it has none.

**Where the worker that handed back has ended**, your lead starts a new worker
on the story, and its assignment says so: what was sent back, the pull
request, and the note that holds the earlier receipt. If that is you, run
setup as step 1 says, but record no new Started: keep the one the earlier
receipt carries, as a resumed session keeps its handoff's. The branch and the
worktree are the story's own, and your assignment is what explains them. Plan
and build nothing again: do the three steps above, with two differences. The
receipt stays the story's one page, so carry over from the earlier receipt
each field you did not observe yourself, and say that it comes from that
receipt, with its link. And your receipt check cannot read the earlier
worker's transcripts, so give it that worker's result: save the check output
the earlier receipt holds, unchanged and line for line, to a file beside your
bindings file under a `## Receipt check` heading, as a handoff carries it, and
pass that file as `--handoff`. Where the check then carries no use from it,
say so under the pasted output: the earlier receipt's check is the evidence
for those operations.

**The answer to a `STATUS: refused` line** comes back the same two ways. While
your session lives, the message wakes it, and Never says what each answer
means. Where your session has ended, your lead gives the answer to a new
worker in its assignment, with your last `STATUS` line. No receipt was posted
then, so that worker finds where the story stands from the branch, the pull
request and the notes on the work item, and takes it up at the first step
they do not show done. Anything there it cannot explain, uncommitted changes
included, goes to its lead before it touches it, and its receipt marks
`unverified` whatever it did not observe.
```

- **Execution note:** keep `` `## Receipt check` `` inside its backticks wherever the line wraps. The tests' `section` helper splits the file on a line that starts with `## `.
- **Test scenarios:** U1's scenarios 1 to 9 and 13. The existing tests on step 8 (`test/supervision-routing-tables.test.ts:1244-1253`, and the `GRO-21` block's `step8` assertions) stay green: none of their strings is touched.
- **Verification:** those tests pass. `section(read(WORKER), "8. Hand back")` still ends at the new heading, and "Talking to your lead, and to the maintainer" still parses as its own section.

### U3. project-lead: the lead-in, "Sending it back", and the refused bullet

- **Goal:** the lead sends a hand-back back one way, knows who picks the story up, and knows how to read what returns.
- **Requirements:** R2, R3, R4, R5, R6.
- **Dependencies:** U1.
- **Files:** `skills/project-lead/SKILL.md`.
- **Approach:** three edits, as written. Items 1 to 7 keep every word.

**The lead-in to the list** (`:304`) changes from `**When the pull request is ready:**` to:

```text
**When the pull request is ready**, take these in order. Where one sends the
hand-back back to the worker, "Sending it back", below them, says how:
```

**The new passage**, two paragraphs after item 7 (`:367`) and before ``**A `restart-owner: lead` handoff**``:

```text
**Sending it back.** Wherever this step sends a hand-back or a defect back to
the worker, do it one way. Before you send one back over a line, read items 1
and 2 through, so that one message names everything the hand-back lacks, and
send it as step 5 says. While the worker's session is live, the message goes
to it: its skill's "A hand-back that comes back" has it fix what you named,
post its receipt again as a new note, and send `STATUS: ready` again. It is
the same story, with the same Started time and the same receipt. Read what
comes back from item 1 again, as you would a fix pass's head: the earlier
note does not cover it.

Where the worker's session has ended, start a new worker on the story as step
4 says, in the story's own worktree and on its branch. That is a new worker,
never a restart: a worker that handed back left no handoff to restart from.
Its assignment adds what you are sending back, the pull request, and the note
that holds the earlier receipt. Its receipt carries over, from the earlier
one, what it did not observe itself, and its pasted check shows the earlier
worker's operations as carried, or says it could carry none: the earlier
receipt's check is then the evidence for them. A worker that ended after
posting a handoff is the one exception: "A `restart-owner: lead` handoff",
below, covers it. The answer to a `STATUS: refused` line whose worker has
ended goes the same way, in a new worker's assignment, with that worker's
last `STATUS` line.
```

**The refused bullet in step 5** (`:218-234`). Append one sentence after "…and never tell the worker to retry it.":

```text
Where the worker's session has ended before the answer comes, the answer goes
to a new worker, as step 7's "Sending it back" says.
```

- **Test scenarios:** U1's scenarios 10 to 13, and the existing "project-lead's SKILL.md names no harness, path, version or tracker", which runs every pattern over the whole file. The existing pins of F12 stay green with no edit.
- **Verification:** those tests pass. Read step 7 once through: items 1, 2 and 4 each still say "goes back", the lead-in above them points at the passage, and the passage agrees with item 4's two sentences (F3, F4).

### U4. Version bump

- **Goal:** the change reaches installs.
- **Requirements:** R8.
- **Dependencies:** U2, U3.
- **Files:** `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, together, `0.2.11` to `0.2.12`.
- **Test scenarios:** the existing manifest test, which holds the two versions equal and semver-shaped.
- **Verification:** `npm test`.

---

## Verification Contract

| check | command | when |
| --- | --- | --- |
| typecheck | `npm run typecheck` | before every push |
| tests | `npm test` | before every push |
| secrets | gitleaks | CI only |
| restatement sweep | `grep -rnI --exclude-dir=node_modules --exclude-dir=.git -e "goes back to" -e "comes back" -e "Sending it back" -e "Then stop" skills README.md AGENTS.md docs/decisions` | before the review |
| review | the native single-pass review; `ce-code-review` on top, since the change is what two skills tell agents to do | before the pull request opens |

The sweep should show "A hand-back that comes back" in the worker's step 8, its own heading and the lead's passage, and "Sending it back" in the lead's lead-in, its passage and the refused bullet, and nowhere else.

**By-eye portability check.** The tests run every pattern over the lead's file and, after U1, over the worker's new section. Read the new text once more for what a pattern cannot see:

- no tool, launcher or tracker named as how a message is sent or a note is read;
- no folder named beyond "beside your bindings file";
- no word "restart" used for starting a new worker (KTD4).

---

## Risks

| Risk | Mitigation |
| --- | --- |
| The earlier receipt's pasted check was indented or reflowed in its note, so the check reads no line from it. | The section tells the new worker to say so under its pasted output, and the lead's passage tells the lead to read the earlier receipt's check then. |
| A new worker rebuilds or replans a story that is already built. | "Plan and build nothing again" is pinned by U1. |
| A new worker on a half-built story after a refusal misjudges where it stands. | Its receipt marks `unverified` what it did not observe, and anything it cannot explain goes to its lead first. The depth of that route is OD2. |
| A lead reads "Otherwise it goes to a new worker" in item 4 and the new passage as two rules. | They agree, and the lead-in above the list points item 4 at the passage. Item 4 is unpinned if the lead wants it shortened later. |
| A story in flight when the plugin updates is sent back to a worker whose loaded skill has no such section. | It acts on the lead's message alone, as it would today. |
| A sent-back hand-back circles over the same line. | Not solved here: see "Deferred to Follow-Up Work". |

---

## Open Questions

### The issue's three questions

- **Does a sent-back hand-back reopen the same story, or is it a new round with its own receipt?** For a worker that is still running: the same story, answered from the repo's text (KTD2; F10, F11, F13, F22). For a new worker the text is silent: OD1.
- **Who restarts a worker whose session has ended?** Answered from the repo's text: the lead, by starting a new worker as step 4 says, and through the `restart-owner: lead` route only where a handoff was posted (KTD4; F3, F7, F17, F21). One step is this plan's inference: F3's sentence is written for a defect's fix pass, and the plan applies it to every send-back. The lead can overrule it.
- **Does step 7's item 6 apply to a send-back fix, or does the fix get its own review?** Both, answered from the repo's text (KTD3; F4, F9). Item 6 applies to the worker, and the lead's fresh review of the new head is the fix's own review.

### Open decisions for the lead

**OD1. What do a new worker's receipt and check look like?** The plan builds option A.

- **A (recommended).** One story, one page. The new worker keeps the story's Started, carries over the fields it did not observe and says they come from the earlier receipt, and passes the earlier check's output as `--handoff`. The lead reads one complete receipt, and its item 2 reads the check as it does today (F15, F23).
- **B.** A second-round receipt of its own, with its own Started and its own check, linking the first. Delta: the new-worker paragraph in U2 is rewritten; the lead's passage has it read two pages; item 2 needs an exception, because the second page lists `plan` as not run for a story that is not a defect.
- **C.** As A, without the carry: the check shows the earlier worker's operations as `bound-but-unused`, with a note under it. Delta: one sentence shorter in U2; the lead's item 2 needs the same exception as B.

**OD2. How far does the refused-line case go?** The plan builds option A.

- **A (recommended).** Cover the ended session in the same two places: one pointer sentence in step 5, one sentence in the lead's passage, one paragraph in the worker's section. The issue lists the refused line among the places a lead sends work back.
- **B.** Leave it out and file it. Delta: drop the worker's last paragraph, the lead's last sentence, the step 5 pointer and U1's scenarios 8 and 12. A refusal's answer whose worker has ended then still has no route.

### Assumed, and cheap to change

- **Should step 8's opening, "A hand-back ends the story", be reworded?** Assumed: no. The sentence appended at `:417` reconciles it, and the opening's second half is pinned (F12).
- **Is a README sentence wanted?** Assumed: no (KTD9).

---

## Definition of Done

- U1's scenarios 1 to 12 were red before U2 and U3 and are green after. Every test that existed before stays green with no edit to its assertions.
- Typecheck and tests pass locally, and CI's `test` job is green on the pull request's head.
- The restatement sweep and the by-eye portability check are done.
- The lead has ruled on OD1 and OD2, or the pull request says it builds the defaults.
- This story's own receipt carries a `Plan:` line that names this file, `docs/plans/2026-10-12-gro-31-send-back-route-plan.md`, and the pull request's head holds it.
- The pull request's body carries a `Capture:` line and a `Docs:` line.
- A fresh-context review ran and its findings were triaged. The pull request is a draft until final, and its body has `Fixes GRO-31`.
- Both manifests read `0.2.12`.
- No abandoned-attempt text is left in the diff.

---

## The worker's notes on this plan (2026-10-12, before the lead's ruling)

Written by the story's worker after reading the plan against the source. The plan above is as the planner wrote it.

- **F15 now rests on a run, not on reading.** The check was run with a bindings file that lists only a later session, the same `--since`, and an earlier check's output saved under `## Receipt check` and passed as `--handoff`. Its handoff line read `16 earlier uses carried`, and each earlier operation read `used … (carried from handoff)`. With every line of the saved output indented two spaces it read `0 earlier uses carried`: the first row under Risks is real.
- **A gap in U2's new-worker paragraph, found by that run.** Only `used` lines carry. An operation the earlier worker declared with `--not-run` reads `bound-but-unused` in the new worker's check, and the check exits 1, unless the new worker passes the earlier receipt's Not run list as `--not-run` again. The paragraph needs that clause.
- **OD2: the worker recommends B, against the plan's A.** A new worker that takes up a story mid-flight has no earlier receipt, so nothing carries. Its check then reads `plan` as `bound-but-unused`, and the lead's own item 2 sends that hand-back back (`skills/project-lead/SKILL.md:333-335`). Option A's paragraph would send a new worker down a route the lead's check rejects. That case is the same gap as "a worker that ends mid-story with no handoff" under Deferred, and it belongs with it. A live worker's answer needs no new text (F14).
- **Not run on this plan:** the planner skipped the plan skill's document review and its research subagents, to keep the run small. The lead reads the proposal instead.
- **A residual the plan does not list (inferred, not tested):** a new worker gets the ended worker's name, since the name is built from the lead's name and the story's key (`skills/project-lead/SKILL.md:154-157`), so its session folder already holds the ended worker's bindings file, which a first setup overwrites, and any restart files that worker left.

---

## As ruled (2026-10-12)

The lead ruled on both open decisions. Where this section and the plan above differ, this section is what gets built.

- **OD1 = A, with one clause added.** In U2's paragraph "Where the worker that handed back has ended", this sentence goes in after the one that ends "and pass that file as `--handoff`.":

  ```text
  Only the operations that output shows used carry, so pass the earlier
  receipt's Not run list as `--not-run` again.
  ```

  U1's scenario 7 pins it whole. The evidence is the run in the worker's notes above.
- **OD2 = B.** The ended-session case of a refused line is left out and moves to the story that defines a refused call. Not built:
  - U2's last paragraph, from ``**The answer to a `STATUS: refused` line**`` to its end;
  - the last sentence of U3's passage, from ``The answer to a `STATUS: refused` line whose worker has ended``;
  - U3's sentence appended to step 5's refused bullet, so step 5 is not edited at all;
  - U1's scenarios 8 and 12.

  The pull request says the issue's third bullet is covered for a live worker by existing text (F14) and deferred for an ended one.
- **The three assumptions stay in:** the worker measures its context when a send-back arrives, the lead reads items 1 and 2 through before sending one back, and the cannot-fix paragraph.
- **Version: `0.2.13`, not `0.2.12`.** Another pull request takes `0.2.12` first. U4 runs after `main` is merged in.
- **Review:** one full review from a fresh context, aimed at the clone by its full path, each reviewer quoting its top level and head. No floor pass, by the lead's economy ruling.
- **Residuals** go in the pull request's Limits. Nothing new is filed from them yet.

---

## After the review (2026-10-12)

The full review of `4ba6017` returned "Ready with fixes", with nothing at its two highest severities. The worker's fix pass changed one sentence of U2 and added tests. Where this section and the text above differ, this section is what ships.

- **The save instruction no longer says "unchanged and line for line".** The check reads a saved line only from the start of its line, and the receipt's template sets the pasted output after a label, so a faithful copy of an indented, bulleted or quoted paste carried nothing. In U2's paragraph "Where the worker that handed back has ended", the sentence now ends "save the check output the earlier receipt holds to a file beside your bindings file under a `## Receipt check` heading, as a handoff carries it, and pass that file as `--handoff`.", and this one follows it, before the `--not-run` sentence:

  ```text
  Save each line as the check printed it, from the start of its line: one
  the note indented, bulleted or quoted is not read.
  ```

  U1's scenario 7 pins the three sentences in that order.
- **Tests added for what those sentences rest on.** The receipt check's own tests now run a new worker's check with `--handoff` and `--not-run` together (exit 0 with both, exit 1 without the flag), and with the saved lines indented, bulleted and quoted (nothing carries).
- **The heading test reads the constant.** It matched the heading anywhere in the reader's file, so a comment satisfied it; it now matches the line that defines the constant.
