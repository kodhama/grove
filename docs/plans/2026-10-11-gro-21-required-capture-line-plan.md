---
title: A required Capture line in the pull request's body and the receipt - Plan
date: 2026-10-11
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
origin: GRO-21, and the lead's rulings on it of 2026-10-11
---

# A required Capture line in the pull request's body and the receipt - Plan

## Goal Capsule

- **Objective:** every story's pull request and receipt say whether a lesson was captured and where, or why it was not. A hand-back that does not say so is stopped before the maintainer is asked to merge.
- **Means:** the receipt check reads the pull request's saved body through a new `--pr-body` flag and fails on a missing line, and the lead's hand-back check reads the receipt's own lines (KTD1).
- **Authority:**
  1. The lead's rulings on GRO-21 (2026-10-11), carried as KTD1, KTD2 and KTD10.
  2. GRO-21's description.
  3. This plan.
- **Stop conditions:** stop and ask the lead if:
  - pull request #14 lands with wording for step 7 item 5, or for the receipt's `Docs:` field, other than what "After #14" below quotes;
  - a change turns out to need a `Plan:` field, a change to `plan`'s row, or a change to the `document-change` operation;
  - the checker would have to reach the network, change its `summary:` line, or change the shape of a `used` line;
  - the lead's clause cannot pass the portability test on `skills/project-lead/SKILL.md` without changing that test;
  - the version number is still unnamed when the branch is otherwise final.
- **Execution profile:** test-first. The checker's behaviour is proven by tests that run it. The skill text is proven by wiring tests, and by a by-eye portability read where the tests do not reach.
- **Who finishes:** the GRO-21 worker carries it to a draft pull request, merges `main` in once #14 has merged, then marks it ready. The lead names the version. The maintainer approves the merge.

---

## Product Contract

### Summary

story-worker's receipt gains a `Capture:` field, and the pull request's body carries the same line before the pull request is marked ready. The receipt check takes the saved body as a file and exits 1 when its `Capture:` or `Docs:` line is missing, malformed or repeated. project-lead's hand-back check sends back a ready hand-back whose receipt lacks either line.

### Problem Frame

The maintainer wants work to run through planning, building and capture with real artifacts. An audit of 90 pull requests in a consuming repo found 5 solutions docs, and none from about 50 epic pull requests. No pull request records why it skipped capture. In story-worker, `routing.toml` makes capture optional, and a skip shows only in the hand-back, where nothing checks it.

### Requirements

| ID | Requirement | From | Lands in |
| --- | --- | --- | --- |
| R1 | The pull request's body carries a `Capture:` line before the pull request is marked ready: `captured <path>` or `skipped: <reason>`. | "a required `Capture:` line in both the PR body and the receipt, either `captured <path>` or `skipped: <reason>`" | `skills/story-worker/SKILL.md`, step 7 item 5 (U3) |
| R2 | The receipt carries the same line, as a `Capture:` field. | same sentence | `skills/story-worker/references/receipt.md` (U3) |
| R3 | A skip's reason is the answer the capture's test gives for the story. | "The reason applies the repo's own capture test" | the receipt field, step 7 item 5 and the `capture-learning` fallback (U3) |
| R4 | The receipt check, given the pull request's body as a file, exits 1 when a required line is missing, malformed or repeated, with one line per problem. | "The receipt check, or the hand-back check, fails a story that has no Capture line"; lead ruling D2(c) | `skills/supervision-setup/scripts/` (U2) |
| R5 | The required lines are `Capture:` and `Docs:`. | lead ruling D3 | the checker's list (U2) |
| R6 | The check reads files only. A body path that is not a readable file is unusable input: exit 2. | the checker's own contract; lead ruling D2(c) | U2 |
| R7 | Without the body, the check's verdict is what it is today, and a story's report says the body was not checked. | the lead's design point on sessions that pass no body | U2 |
| R8 | The lead's hand-back check sends back a ready hand-back whose receipt lacks either line. | lead ruling D2(c) | `skills/project-lead/SKILL.md`, step 7 item 1 (U4) |
| R9 | At the hand-back the worker saves the pull request's body to a file and passes it to the check. | lead ruling on step 8 | `skills/story-worker/SKILL.md`, step 8 (U3) |
| R10 | Skill text stays portable: no repo path, tracker id, version, plan tag or harness-specific or host-specific command. | `AGENTS.md`, "The skills are portable" | every edit under `skills/` (U3, U4) |
| R11 | Text that restates the check's command line, or what a pull request's body holds, agrees with the change. | story-worker's "Check what points at your change" | U2, U3, U5 |

### Scope Boundaries

- No `Plan:` field, and no change to `plan`'s row: a later story owns them.
- No change to the `document-change` operation, its row or its fixture: #14 owns them.
- The check does not test that a `captured` path exists, or that a reason is a good one. The lead's acceptance read covers both.
- The check never fetches a pull request. The caller saves the body.
- No new decision record: `AGENTS.md` asks for one only when a dependency is added, and none is.

### Sources

- GRO-21, and the lead's rulings of 2026-10-11 (D2(c), D3, and the rulings on the receipt field, steps 7 and 8, the fallback and the version).
- Pull request #14, read at `0198c35` in a sibling clone: its diff to `skills/`, `README.md` and `test/`.
- `skills/supervision-setup/scripts/receipt-check.mjs`: the header comment's Usage paragraph, `readOptions`, `main` and `formatReport`.
- `skills/supervision-setup/scripts/handoff-receipt.mjs`: `USED_LINE`, `SINCE_LINE` and the `transcript` pattern, which read a report pasted into a handoff.
- `test/supervision-routing-tables.test.ts`: `NON_PORTABLE`, `TRACKER_WORDS`, `PLAN_TAG`, and which text each is applied to.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Both enforcement points.** The receipt check reads the body, and the lead's hand-back check reads the receipt. The check cannot read the receipt, because its own output is pasted into it. (lead ruling D2(c))
- KTD2. **The required lines are a small list in code, one entry per line.** Each entry is a label and the value forms it accepts, so a later line is one more entry. (lead ruling D3)

  ```text
  Directional, not a specification:
    Capture:  "captured " + path    |  "skipped: " + reason
    Docs:     "updated " + paths    |  "none needed, because " + why
  ```

- KTD3. **Without `--pr-body` the verdict does not change.** A report for a story's bindings file prints one line, `pr-body: not checked (no --pr-body given)`. A report for any other level skill's bindings prints no such line. Chosen over failing a story's check that has no body: that would break a blocked hand-back with no pull request, every restart handoff, and a story in flight when the plugin updates. The level skill is read from the routing table the check already loaded, whose `skill` it has already matched to the bindings file's.
- KTD4. **Exit 1 for the body's contents, exit 2 for the body's file.** A missing, malformed or repeated line exits 1, as an unused operation does. A `--pr-body` path that is not a readable file, the empty path included, exits 2 with one line on stderr, `receipt-check: no pull-request body file at <path>`, as a handoff that is not a file does today. Exit 2 is decided before anything is read, so it wins over exit 1. The `summary:` line does not change: two tests anchor its ending.
- KTD5. **A line counts only at the start of a line, with nothing before it.** The label, a colon, one space, then the value. A bullet, bold, a quote mark, leading spaces or another case is not the line, and reads as missing. Each label appears exactly once: two lines can disagree, and the lead reads one. A trailing carriage return and trailing spaces are dropped first, since a host can return a body with CRLF endings. Chosen over tolerating Markdown decoration: one rule the worker can follow and the check can state in its message.
- KTD6. **The lines live in a new sibling module, `pr-body-lines.mjs`.** The scripts folder holds one module per concern, and `receipt-check.mjs` keeps the command line: the flag, the file check, the report lines and the exit code. The scripts are plain `.mjs`. `tsc --noEmit` does not check them: `tsconfig.json` includes only `test` and `vitest.config.ts`, with no `allowJs`. A test that imports the new module needs the `// @ts-expect-error -- no type declarations for this .mjs script` line the other script imports carry.
- KTD7. **The body is checked only on a ready hand-back.** A blocked hand-back and a restart's handoff leave `--pr-body` out. So the check accepts the two `Docs:` forms of D3 and no third.
  - **Conflict call-out against #14:** its receipt gives `Docs:` a third value, `not reached: <why>`, for a story that ended before its completion checkpoint, and says the body carries the same line. The check would call that line malformed. It never meets one, because such a story is blocked and passes no body. See Open Questions.
- KTD8. **Every line the check prints about the body starts with the word `pr-body`.** The handoff parser reads a `used` line by a first word that holds a slash, and reads `transcript` and `since` lines by their first word. A `pr-body` line matches none, whatever text of the body it quotes. A test pins this (U1).
- KTD9. **Skill text says "save the pull request's body to a file" and names no command.** The command belongs to the repo's host, so grove's own `AGENTS.md` names it for grove (U5).
- KTD10. **No version bump is planned now.** The lead names the number at merge-in. `.claude-plugin/plugin.json` reads 0.2.3 today. (lead ruling)

### The report's new lines

Planned here so the tests can be written first. `<file>` is the path as given.

```text
pr-body: not checked (no --pr-body given)
pr-body <file>: found "Capture: skipped: <reason>"
pr-body <file>: missing "Capture:": no line starts with it
pr-body <file>: malformed "Docs: none": write "Docs: updated <paths>" or "Docs: none needed, because <why>"
pr-body <file>: repeated "Capture:": 2 lines start with it, keep one
```

One line per required label, in the list's order, after the operation and `used-but-unbound` lines and before `summary:`. A `found` line quotes the body's line, so the lead reads the value in the pasted output.

A line "starts with" a label when its first characters are the label and a colon. Such a line that fits no value form is malformed. So `Capture:captured x` is malformed, and `- Capture: skipped: x` is missing.

### Assumptions

- #14 merges before this pull request, with the step 7 item 5 and `Docs:` field wording read at `0198c35`.
- A ready story has reached its completion checkpoint, so its body's `Docs:` line holds one of the two D3 forms.
- A pull request's body, saved by the host's own tool, is plain text with LF or CRLF line endings.

### What restates or points at the change

Every hit for `--not-run`, `--since`, `--handoff`, `receipt-check.mjs`, "Usage:", "It reads files only", "Check the claims", `capture-learning`, "say in the hand-back" and "Capture", outside `docs/plans/`.

| Where | What it says | Edit? |
| --- | --- | --- |
| `skills/supervision-setup/scripts/receipt-check.mjs`, header comment | the Usage paragraph, the exit codes, "It reads files only" | **Yes** (U2): add the flag, the exit 1 and exit 2 cases, and a short paragraph on the body's lines and their limits. "It reads files only" stays true and stays. |
| same file, `readOptions` and `main` | the argument parser, the usage string | **Yes** (U2) |
| same file, `formatReport` | the report's lines | **Yes** (U2): the new lines. The `summary:` line does not change. |
| `skills/supervision-setup/scripts/handoff-receipt.mjs` | parses a report pasted into a handoff | No code edit. A test pins that it ignores `pr-body` lines (U1). |
| `call-scope.mjs`, `operation-state.mjs`, `routing-table.mjs`, `transcript-uses.mjs` | name the checker or `--since` in comments | No |
| `skills/story-worker/SKILL.md`, step 7 item 5 (lines 269-281) | "Capture, then ready" | **Yes** (U3) |
| same file, step 8, "Run the receipt check" (lines 294-306) | the command line and its flags | **Yes** (U3) |
| same file, step 1 (lines 81-87) and "Context and restart" (lines 397-400) | `--since` at the story's start and in a handoff | No: a restart's check takes no body, and its output says so. |
| `skills/story-worker/references/receipt.md`, `Receipt check:` (line 43) | "run with --since the Started time" | **Yes** (U3): name `--pr-body` too. |
| same file, after `Acceptance:` | no `Capture:` field | **Yes** (U3) |
| `skills/story-worker/routing.toml`, `capture-learning` fallback (lines 146-148) | "say in the hand-back what the lesson was" | **Yes** (U3) |
| same file, the `review`, `review-escalation` and `browser-test` fallbacks | "say in the hand-back" | No: other operations. |
| `skills/project-lead/SKILL.md`, step 7 item 1 (lines 284-286) | "Check the claims" | **Yes** (U4) |
| `skills/project-lead/references/intent-run.md` (line 136) | the check counts from the story's Started time | No |
| `skills/session-restart/SKILL.md`, the handoff's "Receipt check" section and the text under it (lines 152-204) | the check's command line, with `--since` and `--handoff` | No: a handoff's check never takes the body. A worker's handoff will now show the `not checked` line, which is true, and which the next check ignores. `test/session-restart-skill.test.ts` pins this command line and stays green. |
| `skills/session-restart/scripts/*.sh` | their own `--handoff` and usage strings | No: other scripts. |
| `skills/supervision-setup/SKILL.md` (lines 77, 98) and `references/harness-notes.md` | what the check reads from transcripts | No |
| `README.md`, "Adopt it in a repo" | what a consuming repo sets up | **Yes** (U5): one bullet. |
| `README.md` lines 15, 99, 110, 134 | "Ships the receipt checker", "learning capture", Node, history | No |
| `AGENTS.md`, "Branch, commit, and PR rules" | "Put `Fixes GRO-<n>` in the PR body" | **Yes** (U5): one bullet. |
| `AGENTS.md` line 100 | a PR body needs no agent footer | No |
| `docs/decisions/` | no hit for capture | No |
| `test/fixtures/supervision/bindings.example.json` | the `capture-learning` binding | No |
| `test/supervision-receipt-check.test.ts`, `test/supervision-receipt-credit.test.ts`, `test/session-restart-skill.test.ts` | the usage prefix, the exit 2 table, the `summary:` shape, the handoff carry | New tests (U1). Every existing assertion stays as it is and stays green. |
| `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` | `version` | Waits (U7). |

### Sequencing

1. U1, the failing tests.
2. U2 makes the checker's tests pass.
3. U3 and U4 make the text tests pass.
4. U5 is wording with no test.
5. U6 runs once #14 has merged.
6. U7 waits for the lead's version number.

---

## Implementation Units

### U1. Failing tests

- **Goal:** pin the checker's behaviour and the wiring of the skill text before either changes.
- **Requirements:** R1 to R9.
- **Files:** `test/supervision-receipt-check.test.ts`, `test/supervision-routing-tables.test.ts`.
- **Patterns:**
  - In the checker's tests: the `describe("MQ-353 · the command line")` block, with its temp `dir` and its `run(file, ...args)`. The clean baseline is the one in "exits 0 when every operation is used or declared not run": `bindingsReading([AFTER, "claude-after-restart"])`, its operations filtered to `build` and `plan`, run with `--not-run story-worker/plan`. The failing baseline is `bindingsReading([BY_HAND, "claude-built-by-hand"])`.
  - In the text tests: `section`, `read`, `LEAD`, `WORKER`, `operationsOf`, `readTable` and `textProblems`.
- **Approach:**
  1. Add a `describe` to the checker's tests after the command-line block, with a helper that writes a body to a temp file. Rows that test only the value forms may call the new module's exported check directly.
  2. Add a `describe` to the text tests **at the end of the file**, and declare no file-level constant in it. #14 adds its own block in the middle of that file and moves `RECEIPT` to file level, so a block at the end merges cleanly.
- **Test scenarios, `test/supervision-receipt-check.test.ts`:**
  - Both lines present, for each pairing of the two `Capture:` forms with the two `Docs:` forms: exit 0, two `found` lines that quote the body's lines, and no `not checked` line.
  - Both lines among other Markdown, with CRLF line endings and trailing spaces: exit 0.
  - No `Capture:` line: exit 1, a `missing "Capture:"` line, and the `Docs:` line still `found`.
  - No `Docs:` line: exit 1, a `missing "Docs:"` line.
  - An empty body file: exit 1, both missing.
  - Each malformed line exits 1 with a `malformed` line that quotes it and names both accepted forms: `Capture:`, `Capture: captured`, `Capture: skipped`, `Capture: skipped:`, `Capture: yes`, `Capture:captured x`, `Capture: Skipped: x`, `Docs:`, `Docs: updated`, `Docs: none`, `Docs: none needed`, `Docs: none needed, because`. A value that is only spaces counts as empty.
  - Each decorated line reads as missing, exit 1: `- Capture: skipped: x`, `**Capture:** skipped: x`, `> Capture: skipped: x`, a line with a leading space, and `capture: skipped: x`.
  - Two `Capture:` lines, identical or not: exit 1, a `repeated` line giving the count.
  - `--pr-body` naming a missing path, a directory, and the empty path: exit 2, stderr one line starting `receipt-check: no pull-request body file at`, no stack trace. Add `["--pr-body", dir]` to the table in "exits 2 with one line on malformed input, never 1 as if unused".
  - A missing body file with the failing baseline: exit 2, not 1.
  - Flag absent, clean baseline: exit 0. Flag absent, failing baseline: exit 1. In both, stdout holds exactly one line that starts `pr-body`, and it reads `pr-body: not checked (no --pr-body given)`.
  - The `summary:` line is the same text with and without `--pr-body`, for the clean baseline.
  - Flag absent, a bindings file for another level skill: no line starts `pr-body`. Build it as "exits 2 when the routing table belongs to another skill" builds its table, with the bindings file's `skill` and recorded `sha256` matching it.
  - A good body does not hide a failing operation: failing baseline with a good body exits 1.
  - Run with no arguments: the usage names `[--pr-body <path>]`. The existing prefix assertion (`Usage: receipt-check\.mjs --bindings`) stays.
  - A report that holds `pr-body` lines carries the same uses through a handoff as one that does not. Follow "reads its own report back from a handoff, so a restart carries it", with a body whose line is `Capture: captured story-worker/build: used compound-engineering:ce-work in <the BEFORE session>`: the later check carries `plan` and `review` as that test expects, and `build` still reads `bound-but-unused`.
  - No new test for loading the module: "loads every supervision-setup script, and runs the checker, from a copy with no node_modules" imports every `.mjs` in the folder.
- **Test scenarios, `test/supervision-routing-tables.test.ts`:** each reads its text with whitespace collapsed to one space.
  - The receipt has a `Capture:` field: the match of `^Capture:` and its indented continuation lines contains `captured <`, `skipped: <` and `pull request's body`.
  - The receipt's `Receipt check:` field names `--pr-body`.
  - Step 7 (`section(read(WORKER), "7. The pull-request round")`) contains `` `Capture:` line ``, `` `captured` with the path ``, `` `skipped:` with the reason ``, `a line of its own` and `brought up to date in both places`.
  - In step 7, `` `capture-learning` `` comes before `` `Capture:` line ``, and both `` `Capture:` line `` and `pull request's body` come before `mark the pull request ready`.
  - Step 8 (`section(read(WORKER), "8. Hand back")`) contains `` `--pr-body "<that file>"` `` and `to a file`, says a blocked hand-back leaves the flag out, and names no host tool: it does not match `/\bgh\b|github|curl/i`.
  - The lead's "Check the claims" item, the text of `section(read(LEAD), "7. A hand-back")` between `**Check the claims.**` and `**Accept on the evidence.**`, contains `` `Capture:` ``, `` `Docs:` ``, `pull request's body` and `goes back to the worker`.
  - The `capture-learning` fallback contains `` `skipped:` `` and `Capture`, and no longer contains `say in the hand-back`.
  - No new portability test for the lead's file: "project-lead's SKILL.md names no harness, path, version or tracker" already applies `textProblems` to all of it, and the table test applies it to all of `routing.toml`.
- **Verification:** `npm test` shows exactly these tests red, and every test that existed before green.

### U2. The checker reads the pull request's body

- **Goal:** `--pr-body <file>` makes the check fail a body that lacks a required line.
- **Requirements:** R4, R5, R6, R7, R11.
- **Dependencies:** U1.
- **Files:**
  - `skills/supervision-setup/scripts/pr-body-lines.mjs` (new);
  - `skills/supervision-setup/scripts/receipt-check.mjs`.
- **Approach:**
  1. The new module holds the list (KTD2) and one function from a body's text to one result per required label: found with its line, missing, malformed with its line, or repeated with its count (KTD5). It opens with a header comment in the shape of `handoff-receipt.mjs`: what it does in plain words, one worked example, and its limit.
  2. `readOptions` takes `pr-body` as a string option. An empty value is a path, not an absent flag.
  3. `main` refuses a path that is not a readable file beside the handoff's file check, before anything is read (KTD4). A read that throws gets the same one line and exit 2.
  4. `formatReport` prints the lines "The report's new lines" gives, in the place it gives. The `not checked` line follows KTD3.
  5. `main` returns 1 when any required label is not found, as well as for the reasons it has today.
  6. Bring the header comment and the usage string up to date. Say the limits: the check proves the file it was given, not the pull request, and a line inside a fenced block counts as a line.
- **Patterns:** the handoff flag end to end: `handoff` in `readOptions`, the file check in `main`, the `handoff:` line in `formatReport`.
- **Execution note:** strings in the module's code, as opposed to its comments, hold no tracker id and no plan tag. "what an agent or a user reads names no work tracker or plan tag" reads every `.mjs` under `skills/` with its comments removed.
- **Test scenarios:** U1's checker scenarios.
- **Verification:** U1's checker tests pass, and every earlier checker test passes unchanged.

### U3. story-worker's text: step 7, step 8, the receipt and the fallback

- **Goal:** the worker writes the line in both places, and hands the body to the check.
- **Requirements:** R1, R2, R3, R9, R10.
- **Dependencies:** U1.
- **Files:**
  - `skills/story-worker/SKILL.md` (step 7 item 5, and step 8's "Run the receipt check");
  - `skills/story-worker/references/receipt.md`;
  - `skills/story-worker/routing.toml` (`capture-learning`'s `fallback` only).
- **Approach:** the wording below, re-wrapped to the file's line length. Each edit is an insertion, so the lines around it stay as they are.

**Step 7 item 5, on today's `main`.** Two insertions into the paragraph. After "…so the learning ships in this pull request and every reviewer sees it.":

```text
Write the receipt's `Capture:` line, as `references/receipt.md` gives it, and
put the same line in the pull request's body, at the start of a line of its
own: `captured` with the path of what the capture wrote, or `skipped:` with the
reason, which is the answer the test above gives for this story.
```

And "…then it runs once more and ships in that pass's push" gains, before its full stop:

```text
, and the `Capture:` line is brought up to date in both places
```

**Step 7 item 5, after #14.** #14's paragraph, whole, with one insertion and one changed clause. After #14's "Write the receipt's `Docs:` line, as `references/receipt.md` gives it, and put the same line in the pull request's body.":

```text
Write its `Capture:` line the same way: `captured` with the path of what the
capture wrote, or `skipped:` with the reason, which is the answer the capture's
test gives for this story. In the body, each of the two starts a line of its
own, with nothing before it: the receipt check reads them there.
```

And #14's "and the `Docs:` line is brought up to date in both places" becomes:

```text
and the `Docs:` and `Capture:` lines are brought up to date in both places
```

**Step 8, the same both ways.** Appended to the "Run the receipt check" bullet, after "…the check drops its uses and says how many.":

```text
When the pull request is ready, save its body to a file beside your bindings
file, unchanged and after your last edit to it, with the repo host's own tool,
and add `--pr-body "<that file>"`. The check reads that file, never the host,
and fails a body that lacks a line the receipt requires of it, or holds one
malformed or twice. A blocked hand-back leaves `--pr-body` out, and the check's
output then says the body was not checked.
```

**The receipt's `Capture:` field, the same text both ways.** On today's `main` it goes after the `Acceptance:` field. After #14 it goes after the `Docs:` field.

```text
Capture:         <captured <the path of the learning this pull request adds> | skipped: <the
                  reason, as the capture's test gives it: what the final code, tests and docs
                  already preserve; or, where the capture ran by fallback, the lesson and that
                  it was not recorded; or that the story ended before its completion
                  checkpoint>. The pull request's body carries the same line>
```

**The receipt's `Receipt check:` field, the same both ways.**

```text
Receipt check:   <the check's output, run with --since the Started time and, when the pull
                  request is ready, --pr-body its saved body, pasted unchanged; or
                  "unavailable: <why it could not run>">
```

**`capture-learning`'s fallback, the same both ways.**

```text
Skip the capture, and write the Capture line, in the receipt and in the pull
request's body, as `skipped:` with the reason: what the lesson was, and that
no performer was available to record it.
```

- **Test scenarios:** U1's receipt, step 7, step 8 and fallback scenarios.
- **Verification:** those tests pass. The table's own tests still pass, which apply every portability pattern to `routing.toml`. The by-eye check in the Verification Contract passes for step 7, step 8 and the receipt.

### U4. project-lead's hand-back check

- **Goal:** a ready hand-back whose receipt lacks a line goes back to the worker.
- **Requirements:** R8, R10.
- **Dependencies:** U1.
- **Files:** `skills/project-lead/SKILL.md` (step 7, "When the pull request is ready", item 1).
- **Approach:** append to item 1, after "The receipt on the work item names that head.":

```text
The receipt carries a `Capture:` line and a `Docs:` line, each with a value,
and the pull request's body carries the same two: the receipt check reads the
body it was given, never the receipt its output is pasted into, so read the
receipt's lines yourself. A hand-back missing either line, or whose pasted
check says the body was not checked, goes back to the worker.
```

  The stricter patterns apply to this whole file. The text passes them: a backticked label is followed by a backtick or a space, never by a letter, so it is not a `word:word` token, and it holds no slash, no number and no dollar sign.
- **Test scenarios:** U1's lead scenario, and the existing "project-lead's SKILL.md names no harness, path, version or tracker".
- **Verification:** both pass.

### U5. README and grove's own instructions

- **Goal:** a consuming repo knows the body's two lines exist, and grove's own contributors know how to save a body here.
- **Requirements:** R11.
- **Files:** `README.md`, `AGENTS.md`.
- **Approach:**
  1. `README.md`, "Adopt it in a repo": a new bullet **between** "Ignore session state" and "Project instructions". #14 edits the bullets on both sides and leaves the lines between them alone.

     ```text
     - **Pull request bodies:** a story's pull request carries a `Capture:` line
       and a `Docs:` line, each at the start of a line of its own. The receipt
       check fails a hand-back whose saved body lacks one, so keep a pull-request
       template, or a bot that rewrites bodies, from dropping them.
     ```

  2. `AGENTS.md`, "Branch, commit, and PR rules": a new bullet after "Put `Fixes GRO-<n>` in the PR body".

     ```text
     - **A story's PR body carries a `Capture:` line and a `Docs:` line**, each at
       the start of its own line, as `story-worker` gives them. To hand the body
       to the receipt check, save it with
       `gh pr view <n> --json body --jq .body > <file>` and pass `--pr-body <file>`.
     ```

- **Test scenarios:** `Test expectation: none -- prose outside the skills, with no behaviour.`
- **Verification:** read both bullets against U3's wording.

### U6. Merge `main` in after #14

- **Goal:** the branch carries #14 and this story's wording together.
- **Dependencies:** #14 merged to `main`; U3.
- **Files:** `skills/story-worker/SKILL.md`, `skills/story-worker/references/receipt.md`.
- **Approach:** merge `main` into the branch, never rebase: the branch is pushed. Resolve as below, then run the full check set.

  | File | Expect | Resolve |
  | --- | --- | --- |
  | `skills/story-worker/SKILL.md`, step 7 item 5 | **Conflict**: both sides rewrite the paragraph. | Take `main`'s paragraph whole, then apply U3's "after #14" insertion and changed clause. |
  | `skills/story-worker/references/receipt.md`, after `Acceptance:` | **Conflict**: both sides add a field at one point. | Keep both, `Docs:` first, `Capture:` second. |
  | same file, `Receipt check:` | Clean: #14's `By fallback:` change sits two lines above. | If git reports it, keep both changes. |
  | `skills/story-worker/routing.toml` | Clean: #14 adds its row nine lines above the fallback this story changes. | none |
  | `test/supervision-routing-tables.test.ts` | Clean: this story's block is at the end of the file. | Afterwards the block may read the file-level `RECEIPT` #14 adds. |
  | `README.md` | Clean: this story's bullet sits between #14's two hunks. | If git reports it, keep both. |
  | `test/fixtures/supervision/bindings.example.json`, `test/supervision-bindings.test.ts`, `skills/supervision-setup/SKILL.md` | #14 only. | none |

- **Test scenarios:** none new. #14's own tests on step 7 must stay green with this story's insertions: they find `` `Docs:` line ``, `pull request's body` and `` `capture-learning` `` before `mark the pull request ready`, and the "after #14" wording keeps all three there.
- **Verification:** `npm run typecheck` and `npm test` pass on the merged tree. Read step 7 item 5 once through as one paragraph.

### U7. Version bump

- **Goal:** the change reaches installs.
- **Dependencies:** the lead's version number.
- **Files:** `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`.
- **Test scenarios:** the existing manifest test, which checks that the two versions are equal and semver-shaped.
- **Verification:** `npm test`.

---

## Verification Contract

| check | command | when |
| --- | --- | --- |
| stage | `git add -A` | before the two checks below |
| typecheck | `npm run typecheck` | before every push |
| tests | `npm test` | before every push |
| secrets | gitleaks | CI only |
| restatement sweep | `grep -rnI --exclude-dir=node_modules --exclude-dir=.git -e "pr-body" -e "say in the hand-back what the lesson" -e "Capture:" .` | before the review |
| review | `/code-review` floor, plus the `ce-code-review` escalation: the change is code and three skills' instructions | before the pull request opens |
| own body | the branch's checker, run with `--pr-body` on this pull request's own saved body | before the pull request is marked ready |

The sweep should show "say in the hand-back what the lesson" gone, and `pr-body` only in the files the table above marks "Yes".

The "own body" check proves the line shapes on a real body. Its two `pr-body` lines must read `found`. Its exit code may be 1 for other reasons, since the session's bindings belong to the installed plugin, not to this branch.

**By-eye portability check.** The tests apply every portability pattern to `routing.toml` and to all of `skills/project-lead/SKILL.md`, and the tracker-word and plan-tag patterns to all Markdown and all script code under `skills/`. They do not apply the path, version and invocation-form patterns to step 7, step 8 or the receipt, which already hold text those patterns fail. Read this story's insertions there for:

- no host or harness command, and no tool's name, for saving the body;
- no repo path beyond `references/receipt.md`, which step 7 already cites;
- no version-like number, tracker id or plan tag;
- no `word:word` token beyond the labels themselves.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| The saved file is stale, or is not the pull request's body. The check proves the file. | Step 8 says to save after the last edit. The lead's clause has the lead read the body itself. |
| A performer that rewrites the body later, at `commit-and-pr` or `resolve-pr-feedback`, drops the lines. | The hand-back's check then exits 1, which is the check working. |
| A line inside a fenced block, or in a template's example, counts as the line. | Accepted, and said in the checker's header comment. |
| A story in flight when the plugin updates runs skill text that passes no body. | Its report says `not checked`, and its lead sends it back once with what is missing. |
| This branch, before `main` is merged in, requires a `Docs:` line its own skill text never mentions. | The pull request stays a draft until U6, and its body says so (below). |

---

## Documentation / Operational Notes

**For the pull request's body.** Besides `Fixes GRO-21` and its own `Capture:` and `Docs:` lines, the body carries this note until U6 is done:

```text
The checker requires a `Docs:` line as well as `Capture:` (lead ruling D3). Until
main is merged in, this branch's story-worker text and receipt template do not
mention `Docs:`: that text arrives with #14, which merges first. This pull
request must not merge before #14.
```

---

## Open Questions

None blocks the build. Each has the answer this plan assumes.

- **Should the check accept `Docs: not reached: <why>`?** #14's receipt gives that value for a story that ended before its checkpoint. Assumed: no. The body is checked only on a ready hand-back, and accepting it would let a ready pull request pass with `not reached` (KTD7). If the lead wants it accepted, it is one more form on the `Docs:` entry and one more test row.
- **Are the two bullets of U5 wanted?** The rulings name neither file. Assumed: yes, since the README states what a consuming repo sets up, and grove's own instructions are where the skill leaves the host's command. Cutting U5 changes nothing else.
- **Does the lead's clause keep its second half?** "or whose pasted check says the body was not checked" goes past the ruling's one clause. Assumed: yes. Without it, leaving the flag out skips the check and nothing reads the line that says so.

---

## Definition of Done

- U1's tests were red before U2 to U4 and are green after, and every test that existed before stays green without an edit to its assertions.
- Typecheck and tests pass locally on the staged tree, and CI's `test` job is green on the pull request's head.
- `main` is merged in after #14, with the two conflicts resolved as U6 says, and #14's tests green.
- The restatement sweep and the by-eye portability check are done.
- This pull request's own body carries a `Capture:` line and a `Docs:` line, and the branch's checker finds both.
- A fresh-context review ran and its findings were triaged. The pull request is a draft until final, and its body has `Fixes GRO-21`.
- Both manifests carry the version the lead named, or the pull request is still a draft waiting for it.
- No abandoned-attempt code or text is left in the diff.
