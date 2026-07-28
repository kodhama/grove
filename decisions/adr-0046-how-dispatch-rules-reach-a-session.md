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
- **Run state is a committed, per-run file.** *(maintainer, 2026-07-28, from RPI
  Team practice — internal to CGM, not consultable here)*: *"RPI team uses a state
  file per run, but commits it so it's resumable."* Committing buys resumption
  across session, machine and compaction, in git, for free.
- **Direction: toward a cold, artifact-inferring dispatcher — partially.**
  *(maintainer, 2026-07-28)*: *"even their dispatcher is cold and all the agents
  do is read and write to disk. They infer everything from artifacts. I'm not
  thinking of going ALL the way there, not yet at least, but a bit would be ok."*
  How far is Open question 6.
- **The field agrees.** No plugin-class system was found doing always-on
  orchestration injection; Anthropic's own `/deep-research` lost auto-activation
  in v2.1.218; BMAD is migrating off always-on `.clinerules` onto invoked
  workflows. *(`research-rule-delivery-and-activation`, verified)*

### Open

1. **Where do the dispatch rules live — in context, or outside it?**
   **Narrowed to C** *(maintainer leans C, 2026-07-28: "I like C but…")* —
   floors in an invoked skill, sequence driven by a Stop hook — **conditional on
   the emergence constraint below.** Not yet ratified; the lean is recorded, not
   the act.
2. **Is entry model-invocable or user-invocable only?** `adr-0003` rejected
   inferred dispatch from descriptions, citing `claude-code#5688`.
3. **What carries the dispatcher-only floors** — the rules no subagent charter
   restates, so no spawned role catches them for us.
4. **Codex parity.** Codex ships fourteen `role-*` skills and **no agents**; any
   Claude-shaped answer needs its Codex twin or an explicit scope limit.
5. **What happens to the existing managed block**, and to the five consumers
   still running the compliant `0.1.0` text.
6. **How cold does the dispatcher go?** The maintainer has said *"a bit"* and
   explicitly not *"all the way"*. Where the line falls decides how much stays
   resident.

### Constraint — do not foreclose emergent sequencing

*(maintainer, 2026-07-28: "which strategy is the most consistent with the idea,
which I haven't dropped, of letting the sequence be emergent somehow… I don't
want to lean into a fixed workflow so far it makes that harder.")*

**The mechanism that forecloses emergence is not the Stop hook — it is what the
hook returns.**

- **Hook as router** — *"next phase is `plan`; run `/grove:plan`"* (SpecSwarm's
  shape). Encodes an **itinerary**. Forecloses emergence, and separately
  contradicts `dispatcher.md`, where gate ownership is *"read at run time from
  the profile"* and explicitly *"not hardcoded in this charter"*.
- **Hook as completeness guard** — *"a changed artifact has no conformance
  verdict record; you may not stop."* Encodes an **invariant**. The model decides
  *how* to satisfy it, which is where emergent sequencing would live.

**This record adopts the guard form and forbids the router form.** A guard
constrains the end state; a router constrains the path. Grove already leans this
way: *"the dispatcher sequences; it does not grade"* (`dispatcher.md:434-435`),
and a gate advances only on a **record**, never on memory. A Stop hook checking
for records is that floor made deterministic — which is what hooks are for
(*"use hooks to enforce behavior deterministically"*) when prose degrades.

Ranked on emergence-compatibility: **A ≈ C > B-as-SpecSwarm-builds-it**. A and C
leave sequencing to rules the model reasons over.

**What this record does not attempt.** Emergent dispatch is blocked today by
something outside its scope: subagents do not self-awake. grove#102
(query-before-dispatch / contract-net) and grove#101 (fit-probe) are the existing
shaping for that. This decision's obligation is narrower and testable: **encode no
itinerary anywhere a future fit-based dispatcher would have to unpick.**

### Correction — committed run state is not the ownership class we removed

An earlier turn of this shaping framed a run-state file as *"reintroducing a small
piece of the thing we just spent a day removing."* **That was wrong, and the
distinction matters enough to record.**

The managed block was fragile because it was **plugin-generated, owned by nobody,
and drifting against a version stamp** — hence #164, #169, #170. A committed
run-state file is **authored by the run, owned by the repo, versioned in git, and
disposable on completion.** It does not weaken *"state derived from artifact
existence, never agent claims"* (`dispatcher.md:421-422`) — **it satisfies it**,
because the state file *is* an artifact.

### Consequence — a cold dispatcher shrinks the resident payload

If the marking is inferred from artifacts, much of what this record was budgeting
as resident prose becomes **mechanically checkable** by the Stop guard, from git
and disk:

| floor | cold-checkable? |
|---|---|
| owed reviews unrun (no verdict record for a changed subject) | **yes** |
| `executor` dispatched without a `gated`/`approved` artifact | **yes** |
| an agent flipped `approved` (a human act) | **yes** — git diff |
| every skip is a recorded skip | **yes** |
| per-run floor check: ≥1 human-owned intent-locus gate | **yes** — `gates.toml` + run state |
| D5: approval came by in-session act or merge, not a tracker comment | **yes** |
| *"the dispatcher sequences; it does not grade"* | **no** — behavioural stance |
| re-resolve the profile at **every** handover, never cached | **partly** — a guard can warn, not compel |
| fail-closed typing of an unclaimed artifact | **partly** |

**So the resident payload is smaller than this record first assumed.** The skill
carries orientation and the two-and-a-half non-mechanizable stances; the guard
carries the rest deterministically. That is the shape Anthropic's own guidance
points at — *"use hooks to enforce behavior deterministically"* when prose
degrades.

### Constraint — encode transitions as precondition-sets, not event-agent pairs

*(maintainer, 2026-07-28: "those simple rules are essentially the DAG transitions
with a trigger -> agent firing encoding or something like it… in the future, I
think there's some ideas for this routing table that could be taken from petri
nets.")*

**The maintainer's own example is the argument.** `conformance gate ∥ code-review
gate → HUMAN merge` (`dispatcher.md:306`) is a **join**: the merge gate becomes
eligible when *both* verdicts exist. A `trigger → agent` table expresses fan-out
but not join — "fire when both" has nowhere to live. A transition with two
preconditions expresses it directly.

**Grove's charter is already written in this vocabulary**, which is evidence the
structure fits rather than is imposed: `∥` for the paired gate; *"serialize
across every dependency edge on any ratification"*; *"batch only human gates
within an **antichain**"* (`:236-253`) — poset language; repair cascades *"bound at
generation 2"*.

**The unification.** A marking *is* the completeness guard adopted above. *"You
may not stop while any place holds a token"* and *"you may not stop while an owed
review is unrun"* are the same statement at two resolutions. The guard and the
net are one mechanism, not two.

**What this record commits to, and what it does not.** It does **not** build a
Petri-net engine — `inv-minimal-first`, and grove needs a table, not a runtime.
It commits to one encoding choice that is nearly free now and expensive to
retrofit:

> Transitions are expressed as **precondition-set → fire → postconditions**,
> never as `event → agent` pairs.

That shape yields, without further machinery: **fan-out** (several transitions
enabled by one marking — the parallel dispatch the maintainer wants), **join** (a
transition with two preconditions), **the guard** (stopping is disabled while any
transition is enabled), and **Petri-net semantics later as an interpretation
rather than a rewrite**.

Explicitly parked, not adopted: coloured tokens, inhibitor arcs, capacities, and
any reachability analysis. Named so a later reader knows they were considered and
deferred, not missed.

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
