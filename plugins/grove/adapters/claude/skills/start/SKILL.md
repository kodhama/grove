---
name: start
description: "Govern this from the get-go: opens a committed run — the confirm-gated run cursor — then runs the run-start floor check. Use when the user asks Grove to govern this work from the start."
---
<!-- GENERATED — DO NOT EDIT; canonical-source: tooling/grove/build/sources/entry-behavior.md; sha256: f1c936193c84c58f37c96e1d76845b5f99664e5388ae786bdd033697c7907971 -->

- Every changed governed subject owes its verdict records; a review counts only as a posted record, never session memory. `floor-owed-reviews`
- An unclaimed artifact type owes the full review set, fail-closed. `floor-fail-closed-typing`
- Never dispatch `executor` without a `gated`/`approved` artifact to read; conversation alone never qualifies. `floor-executor-needs-artifact`
- The `gated` to `approved` flip is a human act; an agent never flips it. `floor-approved-flip-human`
- Every skip is a recorded skip, never silent. `floor-recorded-skips`
- Every run keeps at least one human-owned intent-locus gate (`intent` front or `ship`), checked at run start. `floor-human-intent-locus`
- Human approval counts only as an in-session act or a merge, never a bare tracker comment. `floor-d5-channel`
- Re-resolve the gate profile at every handover, never cached. `floor-profile-per-handover`
- The dispatcher sequences; it does not grade. `floor-sequences-not-grades`

# Grove start — govern this from the get-go

Open a committed run now. `start` implicitly enters — this body already
carries the dispatcher floor above, so no prior `enter` is ever required.
Then:

1. Disclose any existing open cursors first; while one exists, run creation
   is refused — adopt (resume that run) or confirmed abort-run are the only
   resolutions, never a silent deletion.
2. Plan the cursor-create write through the run operations
   (`node <grove-plugin-root>/runtime/dispatch/bin/grove-run.mjs plan
   open-run <request.json>`) — never write a cursor directly.
3. Show the exact plan and obtain explicit confirmation of every action id,
   then apply through the same CLI.
4. Re-resolve the gate profile, perform the run-start floor check (D2) per
   the dispatcher charter, and run the guard.

## Entry duties (both verbs)

- The ask is the boundary: a run opens only on an explicit affirmative user
  answer routed through the confirm-gated `open-run` path; a negative
  writes nothing.
- Run the deterministic guard at run start and at every handover:
  `node <grove-plugin-root>/runtime/dispatch/bin/guard.mjs --repo <repo>`.
  Exit `0` permits close; `3` reports owed work; `2` reports defects and
  denies close; `1` is an internal error. Treat its lines as the
  authoritative owed-work report — never session memory.
- Disclose every open cursor this session did not open (a stale cursor) at
  entry and at every guard moment; resolution is the human's choice — adopt
  or confirmed abort-run — never silent, and never a deletion.
- Records are the tokens: a review counts only as a posted verdict record
  whose subject, state, and digest still bind, and the change-request
  verdict report (adr-0027 D2) stays owed beside it.

## Pointers

- Full dispatcher projection: ${CLAUDE_PLUGIN_ROOT}/reference/charters/dispatcher.md
- Transition rules (data): ${CLAUDE_PLUGIN_ROOT}/reference/dispatch/transitions.toml
- Guard CLI: ${CLAUDE_PLUGIN_ROOT}/runtime/dispatch/bin/guard.mjs
- Run operations CLI: ${CLAUDE_PLUGIN_ROOT}/runtime/dispatch/bin/grove-run.mjs
- Cursor contract: `.grove/runs/<run-id>/cursor.toml` (schema and lifecycle in the dispatcher projection and spec-0006)
