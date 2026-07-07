---
name: espalier-status
description: Emit runtime status onto the Espalier bus while working as a gardener (or head-gardener) in an Espalier run — so the maintainer's dashboard shows who is working, on what, and who is blocked. Use at role start, at every state transition (working/blocked/awaiting-gate/done/failed), when issuing a verdict, when parking a question, and poll for commands at step seams.
---

# espalier-status — report yourself on the runtime bus

You are a gardener in an Espalier run. Alongside your artifact work,
report your state onto the runtime bus so the human can see the swarm
live. The bus is telemetry, NOT truth: artifact state remains the source
of truth (ADR-0030 — "state derived from artifact existence, never
agent claims"). Never report progress you have not actually made; a
false "working" claim is worse than silence.

**This skill talks to a vendored [espial](https://github.com/kodhama/espial)
install.** Espial is a separate repo; espalier never requires it to
function (telemetry is optional by construction) but this skill is the
gardener-flavored wrapper around it once a consuming project vendors it.
Replace `<ESPIAL_VENDOR_PATH>` below with wherever your project vendored
or installed espial (its own README names the emitter entrypoint — as
of espial v1 that's an `emit.ts`/`emit.js` at the vendor root).

## When to emit

| Moment | Command |
|---|---|
| Role start (cold start) | `status --state spawned --activity "<brief>"` |
| Starting/advancing a step | `status --state working --activity "<what, concretely>" --ref <artifact-anchor>` |
| Parked on a question | `question --id <q-id> --text "<the question>"` then `status --state blocked` |
| Waiting on a human gate | `status --state awaiting_gate --activity "<which gate>"` |
| Issuing a gate/review verdict | `verdict --verdict <YOUR-ROLE'S-CONSTRAINED-GRAMMAR> --activity "<one-line basis>"` |
| Long silent step (>60s) | `heartbeat` |
| Finished | `status --state done` (or `--state failed` — loudly, with the reason in `--activity`) |

All commands share the prefix (run from the repo root, plain `node` —
some JS runners auto-load `.env`/`.env.local` files, which can leak
secrets into a simple status ping; avoid a runner with that behavior for
this call):

```sh
node <ESPIAL_VENDOR_PATH>/emit.ts <subcommand> --run <run-id> --agent <your-role> [...]
```

`<run-id>` is the furrow/run identifier the head-gardener gave you (e.g.
`furrow-42`). `<your-role>` is your role name (`executor`,
`spec-adversary`, …). Use your verdict grammar's exact tokens
(`PASS`/`DRIFT`, `APPROVE-READY`/`NEEDS-REVISION`/`UNSOUND`) in
`--verdict`.

**Addressing (the swarm graph).** When an event is *for* someone — a
hand-off, a verdict about their artifact — add `--to <role>` so it draws
a directed edge on the graph. If the flow logically targets another
gardener but actually routes through the head-gardener (the v0 norm),
also add `--via head-gardener`: the edge renders dashed (transitive)
instead of claiming a direct channel that doesn't exist. Report the
channel you actually used — addressing is a claim like any other.

## Command seams (inbound)

At every step seam — between steps, before starting a new file, after a
test run — poll for commands addressed to you and acknowledge what you
handle:

```sh
node <ESPIAL_VENDOR_PATH>/emit.ts check --run <run-id> --agent <your-role>
node <ESPIAL_VENDOR_PATH>/emit.ts ack --run <run-id> --agent <your-role> \
  --command-id <cmd-id> --result accepted --note "<what you did about it>"
```

Semantics: `pause` → finish the current atomic step, emit
`status --state blocked --activity "paused by command"`, and wait (poll)
for `resume`. `abort` → stop loudly, leave resumable state (WIP + todo),
emit `status --state failed --activity "aborted by command"`. `answer` →
the human answered your parked question: record it under
`## Assumptions`/the issue and resume. `steer` → treat `payload.text` as
maintainer input at the next decision point. Never silently drop a
command — ack with `--result rejected --note "<why>"` if you cannot
comply.

## Honesty rules

- Emit transitions when they happen, not retroactively in a batch.
- `--activity` states what IS happening, not what you hope; keep it one
  line.
- If emitting fails (a missing bus directory is auto-created; a real
  failure means a broken environment), say so in your run output — do
  not swallow it.

## Placeholders

- `<ESPIAL_VENDOR_PATH>` — where your project vendored or installed
  espial (e.g. `tools/espial/`, or a package's installed bin path).
