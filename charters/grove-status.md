---
id: charter-grove-status
type: charter
status: draft
depends_on: []
owner: agent
updated: 2026-07-10
---

# grove-status — the runtime-status contract every role composes in

> Provenance: drafted per the maintainer's decision on
> [grove#24](https://github.com/kodhama/grove/issues/24) — a full
> charter, matching the existing agent-role charter pattern, not a
> lighter decision and not deferred. Every sibling charter in this
> directory was generalized from ADR-0030 and gated together in this
> repo's bootstrap wave; this one has had no equivalent shaping
> conversation. `status: draft`, not `gated`, is deliberate: the
> maintainer decided grove-status **should** have a full charter and in
> what form (matching the agent-role pattern); the actual content below
> — what to include, how to frame a skill rather than a pipeline stage —
> is this author's first pass, not yet reviewed. See the PR this file
> ships in for an explicit split of what's a confident description of
> grove-status's real behavior (verified against its own source) vs.
> this author's own judgment calls about charter scope.

> **This charter is shaped differently from its siblings.** grove-status
> is not a dispatched agent role: it has no stage in the W1–W6 pipeline,
> no `.claude/agents/grove-status.md` counterpart, and the dispatcher
> never sequences it as a step. It is the shared runtime-reporting
> contract every *other* chartered role composes into its own work, at
> its own state transitions — SKILL.md's own description: "Use at role
> start, at every state transition (working/blocked/awaiting-gate/done/
> failed), when issuing a verdict, when parking a question, and poll for
> commands at step seams." This charter describes that contract
> directly — commands, addressing, invariants — rather than forcing a
> "what stage is this" shape that doesn't apply.

## What this is

`.claude/skills/grove-status/SKILL.md` is the agent-facing wrapper
around a vendored [wisp](https://github.com/kodhama/wisp) event bus.
Any chartered role — cold-started or the interactive dispatcher session
— composes it into its own work to report itself onto the runtime bus,
so a human watching a live run's telemetry sees who is working, on
what, and who is blocked. The skill's own opening line states the
non-negotiable invariant under all of this: **"The bus is telemetry,
NOT truth: artifact state remains the source of truth (ADR-0030 —
'state derived from artifact existence, never agent claims')."** A
false "working" claim is worse than silence.

It is optional by construction: grove does not require wisp to
function, and this skill is only load-bearing once a consuming project
actually vendors wisp. This repo (grove itself) does not currently
vendor it either — confirmed by inspection, no `.grove/` or wisp
install present in this checkout.

## Commands

Six subcommands, all sharing the prefix
`node <WISP_VENDOR_PATH>/emit.ts <subcommand> --run <run-id> --agent <your-role> [...]`.
This is exactly the set SKILL.md documents and exactly the set wisp's
own `emit.ts` CLI exposes — the skill neither adds to nor hides
anything from its vendored dependency (checked directly against
wisp's `emit.ts` subcommand switch).

| Command | Does | Key args |
|---|---|---|
| `status` | Reports a state transition. | `--state <spawned\|working\|blocked\|awaiting_gate\|done\|failed>`, `--activity "<what, concretely>"`, `--ref <artifact-anchor>` (repeatable) |
| `heartbeat` | Liveness only — no state change, safe to emit from a hook on a long silent step (>60s). | none |
| `verdict` | Records a gate/reviewer outcome, in the caller's own constrained grammar (e.g. `PASS`/`DRIFT`, `APPROVE-READY`/`NEEDS-REVISION`/`UNSOUND`). | `--verdict <your-grammar's-exact-token>`, `--activity "<one-line basis>"` |
| `question` | Parks on a question — the runtime-bus companion to park-file-and-exit. | `--id <q-id>`, `--text "<the question>"` |
| `check` | Polls for commands addressed to the caller (read-only). | none |
| `ack` | Acknowledges/resolves a polled command by id. | `--command-id`, `--result <accepted\|rejected\|completed>`, `--note "<what you did>"` |

## Addressing

`--to <role>` marks an event as addressed to a specific recipient,
drawing a directed edge on the swarm graph. When the logical recipient
is reached only by routing through the dispatcher (the v0 norm — "the
head-gardener" in the underlying protocol's own comments, i.e. today's
`dispatcher`), also set `--via dispatcher`: the edge then renders
dashed (transitive) rather than claiming a direct channel that doesn't
exist. SKILL.md's own framing: **"Report the channel you actually
used — addressing is a claim like any other."**

## Invariants it guarantees

- **Telemetry is a claim, never truth.** Never report progress not
  actually made (stated above, load-bearing enough to repeat here).
- **Crash-safety is inherited from the vendored bus, not from this
  skill's own code.** Confirmed by reading wisp's `bus.ts` directly: the
  bus is an append-only NDJSON file, written with single `O_APPEND`
  line writes, so — in `bus.ts`'s own words — "a dying agent loses at
  most its own last line." This charter states that as wisp's guarantee
  (an upstream dependency), not something grove-status implements
  itself.
- **Vacuity is detectable.** Wisp's own reducer carries a `telemetry:
  boolean` flag distinguishing "the bus has no events at all" from "all
  agents are quiet" (confirmed in wisp's `protocol.ts`) — this is why
  SKILL.md tells the caller to say so loudly if emitting itself fails,
  rather than let a silent gap read as "nothing is happening."
- **Emit live, not retroactively.** "Emit transitions when they happen,
  not retroactively in a batch" (SKILL.md, verbatim).
- **Never silently drop an inbound command.** Ack `--result rejected
  --note "<why>"` if you cannot comply — a command that goes
  unacknowledged is indistinguishable from one nobody saw.
- **No secret-leaking runners.** SKILL.md calls out plain `node` for
  the emit call specifically because some JS runners auto-load
  `.env`/`.env.local` into the process — a status ping must not be able
  to see secrets.

## Command-seam handling — confirmed vs. this author's inference

SKILL.md gives agent-side semantics for **five** of the underlying
protocol's commands: `pause` (finish the current atomic step, emit
`blocked`, then poll for `resume`), `resume` (the pause counterpart),
`abort` (stop loudly, leave resumable state, emit `failed`), `answer`
(record the human's answer, resume), and `steer` (treat the payload as
maintainer input at the next decision point) — all confirmed verbatim
against SKILL.md's own "Command seams" section.

Wisp's protocol additionally defines `gate` and `dispatch` command
types (confirmed in wisp's `protocol.ts`), for which SKILL.md gives no
agent-side handling at all. This charter does **not** invent behavior
for those two. My own read — an inference, not confirmed by any
decision — is that this is intentional scoping rather than an
oversight: a `gate` verdict is recorded by a human's artifact merge,
not polled for by a generic cold-started role, and `dispatch` starts a
workflow, which is the dispatcher's own job rather than any role's. If
that read is wrong, it's a gap in SKILL.md itself, not in this charter
— flagged for the maintainer rather than silently assumed either way.

## Boundaries

- **Never a required dependency.** A project with no wisp vendor simply
  never wires this skill in; nothing else in grove degrades.
- **Never authoritative.** A role's real state is derived from its
  artifacts; the bus is a claim-overlay for humans watching a live run,
  never a substitute consulted by another role to decide what's true.
- **Never itself sequenced.** The dispatcher does not dispatch
  grove-status as a step — every role calls it inline, at its own state
  transitions, alongside its artifact work.
- **Never a gate.** Emitting (or failing to emit) status never blocks
  or approves anything; it has no pass/fail verdict of its own.

## Placeholders

- `<WISP_VENDOR_PATH>` — where the consuming project vendored or
  installed wisp (e.g. `tools/wisp/`, or `.` if the project *is* wisp).
  This is SKILL.md's own placeholder; this charter does not introduce a
  new one.
