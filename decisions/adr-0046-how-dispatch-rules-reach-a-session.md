---
id: adr-0046-how-dispatch-rules-reach-a-session
type: adr
status: draft  # shaping canvas — the shaper drafts, the maintainer decides. Not promoted past `gated` by this role.
depends_on: [adr-0003-managed-block-routing-rule]
informed_by: [research-rule-delivery-and-activation, research-orchestrator-patterns]
owner: agent
updated: 2026-07-28
---

# ADR-0046: how grove's dispatch rules reach a session

**Shaping canvas.** One canvas, this branch, this change-request. Read
`## Decision state` for where things stand.

## The problem, stated once

Grove routes work through fourteen chartered roles and a dispatcher that
sequences gates. **The dispatcher is a driving-session role — it has no
subagent, so its rules must be *in* the session to work.** Every mechanism grove
has tried for getting them there has failed:

- **The managed `CLAUDE.md` block** (`adr-0003`) worked, and still works in the
  five consumers that have the `0.1.0` text. It failed on *ownership*: markers
  that became unparseable (#164), a version stamp that stopped identifying its
  content (#169), and a refresh wave nobody can safely run (#170).
- **A `SessionStart` hook** was drafted and abandoned: a plugin **structurally
  cannot ship always-on context** — *"To ship instructions that load into
  Claude's context, put them in a skill"*, and there is no `rules` component in
  the plugin manifest schema (`research-rule-delivery-and-activation`, verified).

Measured consequence today: **one consumer (`kodhama/stewards`) has no routing
rule at all**, and dispatch stopped happening there. Reviewers — including
`conformance-reviewer` — were not being run.

## Decision state

### Decided

- **Always-on rules and an always-on swarm are no longer the target.**
  *(maintainer, 2026-07-28)* — *"I think I am getting a bit tired with the
  direction I've been driving us to… there's probably a reason why other
  frameworks just use commands to start things."*
- **Voluntary session entry is acceptable**, provided handovers after entry are
  autonomous and follow the dispatch rules. *(maintainer, 2026-07-28)*
- **Superseding previous decisions is permitted** where the evidence warrants.
  *(maintainer, 2026-07-28)*
- **The field agrees.** No plugin-class system was found doing always-on
  orchestration injection; Anthropic's own `/deep-research` lost auto-activation
  in v2.1.218; BMAD is migrating off always-on `.clinerules` onto invoked
  workflows. *(`research-rule-delivery-and-activation`, verified)*

### Open

1. **Where do the dispatch rules live — in context, or outside it?** The
   architecture fork. Everything below narrows once this is answered.
2. **Is entry model-invocable or user-invocable only?** `adr-0003` rejected
   inferred dispatch from descriptions, citing `claude-code#5688`.
3. **What carries the dispatcher-only floors** — the rules no subagent charter
   restates, so no spawned role catches them for us.
4. **Codex parity.** Codex ships fourteen `role-*` skills and **no agents**; any
   Claude-shaped answer needs its Codex twin or an explicit scope limit.
5. **What happens to the existing managed block**, and to the five consumers
   still running the compliant `0.1.0` text.

### Parked

- **Trellis's own delivery.** Separate product, separate decision. The
  `.claude/rules/` option raised for `.trellis/` is written up in the research
  note; it is Claude-only and consumer-side, and it is not this record's call.
- **`spec-0004`'s revision** and the `adr-0003` conflict it created. Recorded and
  pointed at in #173; resolving it is downstream of this decision, not upstream.
- **grove#169's version/cache collision.** Must be fixed before any refresh wave,
  but it is independent of which mechanism wins here.

## Evidence carried into this shaping

Cited so the trade-offs are not relitigated. Tags are the research note's.

- **verified** — invoked skill bodies survive compaction, *"capped at 5,000
  tokens per skill and 25,000 tokens total; oldest dropped first"*, and
  *"truncation keeps the start of the file"*. So a `/grove:start` skill persists,
  with a budget — and is evicted by grove's own role skills in long sessions.
- **verified** — unscoped `.claude/rules/` and project-root `CLAUDE.md` are
  *"re-injected from disk"*. They are the only mechanisms that fully survive, and
  both are consumer-side.
- **verified** — SpecSwarm's orchestration is a **Stop hook** that blocks the
  model from stopping and returns the next slash command, driven off a state
  file. Per-phase rules are never resident; compaction is a non-issue by
  construction. Its `SessionStart` hook emits one line of *state*, not rules.
- **inferred** — trellis's hook declares only `startup|resume`, so its injected
  rules are plausibly lost at compaction and never restored. One-line fix if it
  holds; unmeasured.

## Decision

*Not yet drafted — the canvas is open at Open question 1.*

## Consequences

*Follows the decision.*

## Considered and rejected

*Populated as options are retired, each with its one-line reason.*

## Open questions

See `## Decision state` → Open. This section carries anything surfacing
mid-shaping that is out of scope for this record.

## Lifecycle record

Shaping opened 2026-07-28 on the maintainer's instruction, with
`research-rule-delivery-and-activation` as the basis and the question *"how do we
solve the dispatching problem in grove"*.

`status: draft`. This role never promotes past `gated`.
