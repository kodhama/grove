---
title: Pane adapter title and workspaces - Plan
type: feat
date: 2026-11-07
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Pane adapter title and workspaces - Plan

## Goal Capsule

- **Objective:** hq's broadcast can find unnamed Claude panes by their title, and hq's dashboard can show each agent's workspace, with its label and checkout path, using only the pane-tool adapter and never calling herdr directly.
- **Means:** two nullable fields on the agent record, plus a `workspace-list` operation (KTD1, KTD2).
- **Authority:** GRO-65, the GRO-65 brief, then this plan. `skills/supervision-setup/scripts/adapter/interface.md` is the contract the code must match.
- **Stop conditions:** stop if any existing field or exit code of `list`, `find` or `get` would have to change meaning.
- **Who ships:** the story worker opens the PR. On hq-resume-lead's acceptance, kodhama-pm merges it pinned to the reviewed head and tags v0.3.4 on the merge commit, under the maintainer's standing approval.

---

## Product Contract

### Summary

Add `title` and `workspace` to the adapter's agent record, and a `workspace-list` operation that gives each workspace's id, label, checkout path and status rollup. Ship it as grove 0.3.4.

### Problem Frame

hq is porting broadcast and its dashboard onto the adapter. The adapter's record drops two fields the old herdr calls used, and it has no workspace call, so the dashboard still calls `herdr workspace list` directly and derives each agent's workspace from its pane id.

### Requirements

**Agent record**
- R1. Every record from `list`, `find` and `get` carries `title`: the pane's terminal title with the harness's status glyph removed, or `null` when the tool gives none or an empty one.
- R2. Every such record carries `workspace`: an opaque id of the workspace the pane is in, or `null` when unknown. It is the join key for `workspace-list`.
- R3. The change is additive. Every existing field, outcome and exit code of `list`, `find`, `get` and every other operation keeps its meaning.
- R4. `title` is for display and matching hints only, never an address. Names stay the only address, and a caller confirms a pane by `get` before typing into it.

**Workspaces**
- R5. `workspace-list` prints `{"workspaces": [{"workspace", "label", "path", "status"}]}`. `label` and `path` are `null` when unknown, and `status` is the workspace's agent-status rollup, normalized like the record's `status`.
- R6. An answer with no workspace list in it, or a workspace with no id, is a failure (exit 4), never an empty list. An empty list is exit 0.

**Contract and release**
- R7. interface.md documents both fields, the operation, the null semantics, and an `Orca:` note on each, in the file's existing per-operation form, giving `unknown` or unconfirmed values.
- R8. Both plugin manifests read 0.3.4, and the PR says the release also ships U12a's `lease.mjs`, which nothing calls yet.

### Scope Boundaries

- `self` is unchanged: it prints only `{"pane"}` and makes no call, so it has no record to extend.
- Out: GRO-66 (pane lifecycle), GRO-64 (close-outgoing's dialog stall), and any change to hq's callers.

### Acceptance Examples

- AE1 (G65.1). Given a stub herdr answer with every existing field, when `list` and `get` run, then every 0.3.3 field and exit code is unchanged, and only `title` and `workspace` are added.
- AE2 (G65.2). Given `terminal_title_stripped: "majordomo"`, `title` is `"majordomo"`. Given no such field, or `""`, it is `null`.
- AE3 (G65.3). Given `herdr workspace list` with two workspaces, `workspace-list` returns the same ids and labels in the same order.
- AE4 (G65.5). Removing `title` from the record makes a test fail.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **A `workspace` id on the record plus `workspace-list`, rather than `workspace-list` alone.** The dashboard joins each agent to its workspace (gather.py:236-237). Without an id on the record, a caller has to parse the pane id, which the dashboard does today (gather.py:289) and which is herdr's id format, not the contract's.
- KTD2. **`title` reads herdr's `terminal_title_stripped`, not `terminal_title`.** The raw title carries the harness's spinner glyph ("✳ majordomo"), which a matcher would have to strip itself.
- KTD3. **The workspace keeps `status`, as a rollup.** The dashboard shows it (gather.py:317). It reuses the record's normalization, so a value outside the four reads `unknown` and keeps "unknown is unsafe".
- KTD4. **A non-string or empty value becomes `null`**, in the `// null` style of the existing `RECORD` filter. A workspace without an id fails the whole answer, since an unjoinable row would mislead the join.

### Assumptions

- herdr 0.9.3's shapes, as observed on 2026-11-07: agent records carry `workspace_id` and `terminal_title_stripped`; `workspace list` answers `.result.workspaces[]` with `workspace_id`, `label`, `agent_status`, and an optional `worktree.checkout_path`.

---

## Implementation Units

### U1. Title and workspace on the agent record

- **Goal:** R1, R2 and R3 in herdr.sh's `RECORD` filter.
- **Requirements:** R1, R2, R3; KTD2, KTD4.
- **Dependencies:** none.
- **Files:** `skills/supervision-setup/scripts/adapter/herdr.sh`, `test/adapter-boundary.test.ts`.
- **Approach:** extend the existing record filter with two fields. Update the `get` exact-equality test at its full-record assertion to the nine-key record.
- **Execution note:** test-first. The new assertions fail before the filter changes.
- **Patterns to follow:** the `session` field's empty-to-null rule in `RECORD`. The stub's `herdrAgent()` fixture.
- **Test scenarios:**
  - Covers AE1. `get` and `list` on the full fixture: every 0.3.3 field and exit equal, plus `title` and `workspace`.
  - Covers AE2. The stripped title is passed through. A missing title gives `null`, and so does an empty one.
  - A missing `workspace_id` gives `workspace: null`, and a non-string one gives `null`.
  - `find` carries both fields on its matches.
  - Covers AE4. A mutation check: the title assertions fail when the field is removed.
- **Verification:** the adapter boundary tests pass, and the session-restart tests pass unchanged.

### U2. The workspace-list operation

- **Goal:** R5 and R6.
- **Requirements:** R5, R6; KTD1, KTD3, KTD4.
- **Dependencies:** U1, for the shared status normalization.
- **Files:** `skills/supervision-setup/scripts/adapter/herdr.sh`, `test/adapter-boundary.test.ts`.
- **Approach:**
  1. Add `workspace-list` to the operations list and the usage check. It takes no arguments.
  2. Call `workspace list`, and map each row as R5 says.
  3. A failed call takes the generic failure path (exit 4 with herdr's code). A missing list, or a row with no id, also exits 4.
- **Patterns to follow:** `get`'s failure path for the call itself: call `workspace list` at top level, then `[ "$rc" -eq 0 ] || gone_or_failed`, so herdr's code survives. (`agents()` sets `code` inside a command substitution, so `list` always prints `code: null`.) `agents()` and `list` remain the pattern for treating an answer with no list as a failure.
- **Test scenarios:**
  - Covers AE3. Two workspaces, one with a worktree and one without: ids, labels and order match, and `path` is `null` for the second.
  - An empty list gives exit 0 and `{"workspaces": []}`.
  - A status outside the four reads `unknown`.
  - A missing `.result.workspaces` exits 4, and so does a row with no `workspace_id`.
  - A failed herdr call exits 4, and the JSON's `code` equals herdr's code.
  - An extra argument is a usage error (exit 2).
- **Verification:** the stub tests pass, and the "interface.md and herdr.sh list the same operations" test passes once U3 lands.

### U3. Contract, docs and version

- **Goal:** R4, R7 and R8.
- **Requirements:** R4, R7, R8.
- **Dependencies:** U1, U2.
- **Files:** `skills/supervision-setup/scripts/adapter/interface.md`, `README.md` if it lists the adapter's operations, `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`.
- **Approach:**
  1. In interface.md, add the record fields with their null rules and R4's caller rule, and an `Orca:` note on the record: `title` is unconfirmed from `terminal list`, and `workspace` is unknown.
  2. Add a `workspace-list` section with its herdr realization and an `Orca:` note: unknown.
  3. Bump both manifests.
- **Test expectation:** none beyond U2's operations-match test. This unit is contract text and version metadata.
- **Verification:** the routing-table portability test and the full suite pass.

---

## Verification Contract

| Gate | Command |
| --- | --- |
| Types | `npm run typecheck` |
| Tests | `npm test`, including `test/adapter-boundary.test.ts` and `test/session-restart.test.ts` |
| Live check | hq-resume-lead runs G65.1–3 on the PR head's herdr.sh by path, before merge |

## Definition of Done

- R1–R8 hold, and every test scenario above exists and passes.
- No existing test's expectation changed except the `get` full-record equality, which gains the two fields.
- No experimental code is left in the diff.
