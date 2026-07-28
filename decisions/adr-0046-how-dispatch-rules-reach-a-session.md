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
- **The marking lives in a committed per-run cursor; the places stay
  artifact-derived.** *(maintainer, 2026-07-28: "I think option 2 is fine exactly
  because it's not too strict about it.")* The weighing they asked for is in
  §Considered and rejected.
- **Host scope: the artifact half is host-neutral; only enforcement is
  Claude-first.** *(maintainer, 2026-07-28, option C)* The transition table and
  the run cursor are **files**, so both hosts get the same rules. The
  deterministic Stop guard is Claude-side until Codex's hook vocabulary is
  measured. Codex is *un-guarded*, not *unsupported*.
- **The managed block shrinks to a one-line entry pointer plus the stamp.**
  *(maintainer, 2026-07-28)* It carries no rules — only *"grove `@<version>` is
  installed; run `/grove:start` to enter dispatch."*

  **The maintainer's reason, which is better than the one this draft offered:**
  *"even if the line is deleted, it just collapses to option one… this way the
  whole system is not as susceptible to changing the managed block."* The block
  becomes **non-load-bearing**, so damaging it degrades gracefully instead of
  breaking. See §Reframing.

  **Reservation recorded, not smoothed:** *"I'm not sure I want to manage the
  blocks."* Adopted as the least-bad option, not as an enthusiasm.
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
4. ~~Codex parity?~~ **Answered** — see Decided (option C).
5. ~~What happens to the existing managed block?~~ **Answered** — see Decided.
6. **How cold does the dispatcher go — and what is lost by going there?**
   **Requires adversarial review of the pros and cons before adoption**
   *(maintainer, 2026-07-28)*. The pro side is drafted in the analysis section;
   the con side is not, and the maintainer's stated instinct is that something is
   lost. Not a shaping turn — this needs its own pass.
7. ~~Where does the marking live?~~ **Answered** — see Decided.
8. **Does the cursor have a lifecycle?** A committed file that a dead run leaves
   behind is a new drift class, and grove has been bitten by drift three times
   this week. What creates it, what clears it, and what a stale one means are
   unanswered.

### Constraint — the enforcement asymmetry must be disclosed, not silent

Option C creates a real asymmetry: Claude sessions get rules **plus** a
deterministic Stop guard; Codex sessions get rules **only**, enforced by prose.

**Checked against `adr-0031`, because that is the host-equivalence contract and
it has already been violated once in this area:**

- `:157-158` requires *"the same semantic conditional-routing rule"* on
  `AGENTS.md`. **Satisfied** — the table and cursor are files; both hosts read the
  same rules.
- `:219-220` item 9 requires proving an unsupported surface *"fails loudly rather
  than degrading to generic agents"*. **Not tripped** — Codex is not unsupported.
  It runs grove's rules; it lacks the deterministic backstop.

**But a difference nobody is told about is exactly the failure this whole thread
is about.** So: **a Codex session must be told, at entry, that it is running
without the deterministic guard.** Without that line, C recreates silent
degradation in a new place, which would be the third instance this month.

**Obligation before implementation, not before this decision:** measure Codex's
hook vocabulary. Trellis ships `hooks/codex-hooks.json` with a `SessionStart`
matcher, so Codex has *a* hook system; whether it has a `Stop` event is
**unknown** and unmeasured. If it does, the asymmetry may be temporary and the
disclosure line becomes conditional.

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

### Correction — two items were recorded as Decided that were not

*(maintainer, 2026-07-28: "I'm not saying I want to go there, not without some
adversarial review of the pros and cons. Just saying they do it that way… I was
merely pointing out that the state file you proposed had* some *of that aspect
in.")*

The previous turn moved **committed per-run state** and **a partially cold
dispatcher** into `Decided`, attributed to the maintainer. **Neither was an intent
act.** The maintainer reported how another system works and observed that the
proposed state file shares some of its character. That is evidence informing an
open question, not a resolution of one. Both are returned to `Open`; the RPI Team
observation is recorded below as evidence, where it belongs.

Logged rather than silently rewritten because it is the second time in this
shaping that enthusiasm was read as approval, and the charter forbids exactly
that: *"never infer approval from enthusiasm or silence."*

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

### Analysis (option not taken) — a cold dispatcher would shrink the resident payload

**Not adopted.** Recorded as the pro side of an option that needs its con side
argued before it can be considered. If the marking were inferred from artifacts,
much of what this record budgets as resident prose would become **mechanically
checkable** by the Stop guard, from git and disk:

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

That is the **pro** side, and it is the shape Anthropic's guidance points at —
*"use hooks to enforce behavior deterministically"* when prose degrades.

**The con side is unargued, and the maintainer's instinct is that it exists:**
*"I'm sure something is lost."* That instinct should be taken seriously rather
than designed past. Candidates worth an adversary's attention, none of them
established here: a cold dispatcher re-derives state on every handover, so it
cannot notice anything a single derivation cannot see — trends, oscillation, a
repair loop that keeps almost-converging; artifact-inferred state is only as
honest as the artifacts, so a role that writes a verdict record without doing the
work is indistinguishable from one that did; and "everything on disk" moves cost
from context into I/O and into the consumer's diff, which is not free either.

**Nothing here is adopted.** See Open question 6.

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

## Reframing — the risk class was load-bearing content, not blocks

Worth stating plainly, because this record spent two turns treating "a consumer
file" as the thing to avoid, and that was the wrong abstraction.

`#164` (unparseable markers), `#169` (a stamp that stopped identifying its
content) and `#170` (a refresh wave nobody can safely run) were severe **because
the block carried the routing rules**. A damaged block meant *no dispatch*, and
the damage was silent.

A block that carries only *"grove `@<version>` is installed; run `/grove:start`"*
has no such failure mode. Delete it, mangle its markers, let its stamp rot — the
worst case is that a reader is not told grove exists, and the system collapses to
the option where nothing is written at all. **Nothing that matters is downstream
of it.**

So the ownership fragility is not eliminated; it is made **harmless**, which is
cheaper and more honest than eliminating it. This also preserves `adr-0026` D4's
PR review seam and the stamp, which a full retirement would have voided.

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
- **reported, not verifiable here** — RPI Team (internal to CGM) uses a **state
  file per run, committed so it is resumable**; its dispatcher is **cold**, its
  agents only read and write disk, and it **infers everything from artifacts**.
  The maintainer supplied this as evidence and explicitly did not propose
  adopting it. It cannot be consulted from here and must not be cited as
  verified.
- **inferred** — trellis's hook declares only `startup|resume`, so its injected
  rules are plausibly lost at compaction and never restored. One-line fix if it
  holds; unmeasured.

## Decision

*Not yet drafted — the canvas is open at Open question 1.*

## Consequences

*Follows the decision.*

## Considered and rejected

### Pure artifact derivation, with no run cursor — **rejected**

**One line:** it cannot express the thing the design exists for.

Weighed properly, because it is the stricter reading of grove's own floor and
deserves better than a dismissal. **For it:** nothing to drift, nothing to
garbage-collect, no consumer-side file at all, and the most literal satisfaction
of *"state derived from artifact existence, never agent claims"*.

**Against it, decisively:** run scope is not derivable from artifacts. The paired
gate this record is built around — `conformance ∥ code-review → merge` — is a
**join**, and a join needs a defined set of participants. "Fire when both are
present" has no meaning without a "both". Two further losses follow from the same
root: a transition that fired and legitimately produced nothing is
indistinguishable from one that never fired, and resumption is impossible because
nothing marks a run as in progress.

### A fully cold, artifact-inferring dispatcher — **not rejected; deferred**

**Not** in this section as a retired option. It remains Open 6 and requires
adversarial review of its pros and cons before it can be adopted or rejected.

Recorded here only because the weighing is relevant to the choice above:
**the adopted option is a proper subset of the cold direction, not a fork away
from it.** A cursor plus artifact-derived places is one step along that road;
going colder later — moving the transition table to disk, then the rules — is
**additive rather than a rewrite**. That is why this could be settled now without
waiting for the cold review, and it is the specific sense in which the maintainer
was right that *"the state file you proposed had some of that aspect in"*.

**The cost the adopted option carries, named rather than discovered later:** a
committed cursor is a consumer-side file that can go stale, and a run that dies
leaves one behind. It is a smaller and more disposable risk than the managed
block (see §Correction) but it is not zero, and it creates the obligation now
tracked as Open 8.

## Open questions

See `## Decision state` → Open. This section carries anything surfacing
mid-shaping that is out of scope for this record.

## Lifecycle record

Shaping opened 2026-07-28 on the maintainer's instruction, with
`research-rule-delivery-and-activation` as the basis and the question *"how do we
solve the dispatching problem in grove"*.

`status: draft`. This role never promotes past `gated`.
