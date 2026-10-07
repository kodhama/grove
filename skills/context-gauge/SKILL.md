---
name: context-gauge
description: Measure this session's own context as a share of its model's window, from the harness's session file, and print one line (percentage, tokens, window, source) or "unavailable". Use at each step boundary or event a level skill names, before deciding whether to restart, and when setup checks whether measuring works on this harness. Claude Code and Codex have recipes; any other harness reads unavailable.
---

# context-gauge

A session cannot feel its context filling up. This skill reads it from the
file the harness writes for the session and prints it as a share of the
model's window, so the restart decision follows a number, not a hunch.

## Run it

```sh
<this skill's folder>/scripts/measure-context.sh --harness <claude-code|codex> --window <tokens>
```

- `--harness`: the harness from the session's bindings. Pass it: a session
  started from another harness's shell carries both harnesses' session
  variables, and then the gauge cannot tell which it is. Without it the gauge
  detects the harness from `CLAUDE_CODE_SESSION_ID` or `CODEX_THREAD_ID`.
- `--window`: the model's context window, as setup recorded it in the
  session's bindings. Only the Claude Code recipe uses it, because the
  transcript carries no window size; Codex reads its own from the rollout.
  **Never pass a guessed window.** On Claude Code with none recorded, run
  without it and the gauge reads unavailable.
- `--transcript <path>` or `--session-id <id>`: only when the session's own
  id is not in its environment. The gauge otherwise finds the file by that id,
  which follows every clear. A worktree session's transcript lives under the
  worktree's own project dir; the gauge searches every project dir, so either
  is found.

**It measures a top-level session only.** A Claude Code subagent inherits its
parent's session id and writes its own transcript under the parent's, so run
from a subagent the gauge reads the parent's context, not the subagent's.

## Read the line

```text
context=36.2% tokens=362351 window=1000000 source=claude-transcript file=<path>
context=unavailable reason=<plain words>
```

Exit 0 is a reading, 1 is unavailable, 2 is bad arguments. **Unavailable is
never zero**: do not restart on it, and do not treat the session as empty.

- If the reason names no measuring recipe for the harness, measuring is
  unavailable for this session. Setup binds the operation as unavailable and
  says once that the session will not restart itself (R31); nothing restarts
  it on a measurement.
- Any other reason (no transcript yet, no usage yet or since a compaction,
  no window given, no `jq`) is a gap: measure again at the next event, and if it persists, tell whoever you
  report to that your context cannot be measured.

## When to measure, and what the number means

- **A worker** measures at each step boundary.
- **A lead** measures at every event it handles: each hand-back, each
  maintainer message and each worker launch. Supervision has no natural step
  boundaries, so the events are its boundaries.
- **From 35%**, prefer the gap between tasks: finish the step in hand, and
  restart before starting the next one rather than carrying it past the line.
- **At 40%**, restart at the next step boundary, through the performer bound
  to restarting the session.

On a 1M window these are the 350k and 400k lines; on Codex's 258,400-token
window they are about 90k and 103k.

## Recipes

| harness | reads | against |
| --- | --- | --- |
| Claude Code | the transcript's latest `usage`: input plus cache read plus cache creation | the window passed with `--window` |
| Codex | the rollout's latest `token_count` event: `last_token_usage.input_tokens` | that event's `model_context_window` |

The Claude recipe skips sidechain lines and lines whose usage sums to zero,
such as the `<synthetic>` assistant lines Claude Code writes after an API
error, so a reading is always a real request's size.

**The reading lags one request behind.** Both harnesses write a request's
usage only once its tool calls have run, so the gauge reads the request before
the one that ran it, without what has been read since. **After a
compaction** the gauge reads unavailable until a request after it is written,
never the size from before the compaction: on Claude Code a `compact_boundary`
line after the latest usage, on Codex a latest `token_count` with no usage.

A percentage the harness reports itself would come first where it is shown
accurate, but on Claude Code it reaches only the status-line command, so a
skill cannot read it without a change to the maintainer's status line. The
transcript recipe agreed with it to within its integer rounding in the three
samples taken (`docs/research/supervision-restart-spike-2026-09-27/findings.md`,
item 7).
