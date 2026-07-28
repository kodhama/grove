---
name: enter
description: "Make Grove's dispatch rules available to govern this session without opening a run; writes nothing, ever. Use when the user asks Grove to be available to govern."
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

# Grove enter — be available to govern

You have entered Grove governance without opening a run. Entry performs no
repository mutation of any kind: `enter` writes nothing, ever.

After entry you may use Grove's agents or not. When you detect conditions
where swarm governance could apply, ask the user — never open a run on your
own inference. A yes IS a start: the affirmative in-session answer is the
human intent act, and the flow continues exactly as `start`, confirm gate
included. A no leaves the session ungoverned and writes nothing.

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
