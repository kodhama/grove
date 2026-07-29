<!-- entry-behavior.md — the single authored source of the entry skills'
verb and shared body text (spec-0006 §Entry contract, §Floor extract and
skill generation). Projected byte-deterministically into both hosts'
enter/start skills by tooling/grove/build; generated output is never a
source. Section markers below are the projection seams. -->
<!-- grove:entry:enter -->
# Grove enter — be available to govern

You have entered Grove governance without opening a run. Entry performs no
repository mutation of any kind: `enter` writes nothing, ever.

After entry you may use Grove's agents or not. When you detect conditions
where swarm governance could apply, ask the user — never open a run on your
own inference. A yes IS a start: the affirmative in-session answer is the
human intent act, and the flow continues exactly as `start`, confirm gate
included. A no leaves the session ungoverned and writes nothing.
<!-- grove:entry:start -->
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
<!-- grove:entry:shared -->
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
