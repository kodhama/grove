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
- **Routing is transition rules, not a fixed pipeline.** *(maintainer,
  2026-07-28, confirming the retained architecture)*: *"not a fixed routing, more
  like the transition rules. Like, as you formulated — precondition, activation,
  and the postcondition."*
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
6. **Does the Stop guard have a cursor-less layer?** Maintainer **leans
   option 3** — two layers, the cursor-less one warns rather than blocks — and
   asked for a fuller explanation before deciding. **Lean recorded, not the act.**
   In one line: option 1 cannot see the failure that started this thread; option 2
   sees it and refuses to let go, conscripting people who never opted in; option 3
   sees it and tells you, so the strong guarantee lives inside a run and a loud
   notice lives outside one.
7. **How cold does the dispatcher go — and what is lost by going there?**
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
open question, not a resolution of one. Both are returned to `Open`; the
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

### Under evaluation — the two-skill entry model (maintainer's proposal)

*Proposed by the maintainer 2026-07-28 and explicitly submitted for adversarial
evaluation, not for adoption: "I'm not saying this is a hypothesis. I need it
evaluated."*

- **`/grove:enter`** — sets the rules and nothing else. Writes nothing. *"Enter
  the grove"*, where grove carries its double meaning: the stand of trees and the
  company of druids. After entering, **the model is free to choose** whether to
  use the agents.
- **`/grove:start`** — **implicitly enters**, then opens a run on whichever agent
  fits. The deterministic path.

Neither requires the other in sequence: you can *be in the grove*, or *start
working with the grove of druids*.

**Why this is better than the single-skill model this draft proposed**, stated
because the draft was wrong and the reason is mechanical rather than aesthetic:

1. **The maintainer's own objection is decisive.** A single `enter`-style skill
   leaves engagement dependent on the model noticing — *"it's just not
   deterministic in that it will, for sure, use it."* `start` supplies the
   deterministic path the single-skill model has no way to express.
2. **`disable-model-invocation` is set per skill, not per argument** (skills
   reference: *"Set to `true` to prevent Claude from automatically loading this
   skill"*). One skill with a flag or an argument cannot hold two invocation
   policies. Two skills let `enter` stay model-invocable — the conversational
   discovery the maintainer wants — while `start`, which has side effects, can be
   user-only. **The seam is the only place that policy can attach.**
3. **The sequence ambiguity is pre-solved.** `start` implicitly enters, so
   *"must I enter first?"* never arises. This is the failure still open in
   BMAD#1618, avoided by construction rather than by documentation.

**Open concerns for the adversary**, not resolved here: whether `start` and
`enter` share one generated payload or duplicate it; whether three states
(none / entered / running) is more ambiguity than two; whether `enter` is
model-matchable enough given that the *description*, not the name, is what the
model matches on.

### RESOLVED — the rejected clause was a SpecSwarm steal-list entry

Traced to source at the maintainer's insistence rather than inferred, which was
the right call: the inference and the provenance point the same way, but only the
provenance is evidence.

`charters/dispatcher.md:432-435` carries the clause; it entered grove at `627165d`
(2026-07-07) in `charters/head-gardener.md:125`, the dispatcher's predecessor,
whose commit message names its source as *"ADR-0030's team table +
Dispatch/Workflows/Adopted-mechanics sections"*. That resolves to
`math-quest/decisions/adr-0030-espalier.md:94`, and the section heading is the
answer:

> **## Adopted mechanics (specswarm mining, 2026-07-07 — steal-list)**

**The list is what grove looked at in SpecSwarm and chose not to take.**
SpecSwarm's continuation hook is `go-loop-hook.sh` — a **router** that blocks stop
and names the next phase of a fixed ladder. That is precisely the form this canvas
forbade three turns before anyone knew the clause existed.

**The same list records what grove *did* take**, and two entries are load-bearing
here:

> …**vacuity detection at every gate**…; **state derived from artifact existence,
> never agent claims**; …**a deterministic zero-LLM artifact-graph preflight**
> (depends_on targets exist and are `gated|approved`; test-provenance anchors
> resolve) — buildable, a strong early furrow

**Grove adopted the check and rejected the router.** The completeness guard *is*
that adopted deterministic zero-LLM artifact check. Supersession is therefore the
wrong instrument — there is nothing to supersede.

**What is genuinely novel is the timing.** The adopted preflight is *"an early,
cheap check"* — at run start. Running it at **Stop** is a moment the charter never
contemplated: not the rejected thing, not explicitly the permitted thing.

**Resolution, taken under the maintainer's explicit deferral** (*"I don't have
enough sensibility to pick either way, so I'm deferring to your judgment"*):
**run the adopted check at run start and at every handover, AND at Stop.** The
handover checks are free, conflict-free, and catch owed work earlier than a stop
guard would; the Stop check is the backstop for the one case handovers cannot
see — a session abandoned mid-run. The record states that the Stop placement
extends an adopted mechanic to a new moment, rather than pretending the charter
already blessed it.

**A loop worth recording:** grove mined SpecSwarm in July 2026 and rejected its
continuation hook. Today's research re-derived SpecSwarm's architecture
independently and proposed adopting it. The same source, mined twice, reaching
opposite conclusions — which is why the provenance was worth chasing.

### Superseded framing — the clause as a blocking conflict

Found by adversarial review 2026-07-28, missed by this draft and by an earlier
adversary pass. `charters/dispatcher.md:432-435`, verbatim:

> **Rejected, with reasons**: fail-open on verifier timeout, score-threshold merge
> gates, free-text dependency parsing, **session-holding continuation hooks** —
> each contradicts the loud-failure floor or binary conformance-to-upstream.

**A Stop guard that blocks the model from stopping is a session-holding
continuation hook.** That mechanism underlies option C, the guard-not-router
constraint, and the cursor-less-layer question — four turns of this canvas.

**What this record must NOT do is read the clause in its own favour.** There is an
available argument that the rejection's stated *reason* — *"contradicts the
loud-failure floor"* — does not apply to a guard whose entire purpose is to fail
loudly, as opposed to a SpecSwarm-style router that silently continues a ladder.
That argument may well be right. **It is also exactly the self-serving reading
that would save the design already drafted**, and this shaping has twice recorded
enthusiasm as approval. The distinction is the maintainer's to draw, and if the
guard survives it needs `adr-0003`-style open supersession of this clause, not a
favourable interpretation.

### Refinement — the ask is the boundary (maintainer, 2026-07-28)

*"We don't need this enter path to then automatically start a run if the model
finds out… when it detects the conditions that could apply for swarm governance,
then it asks the user. So we never get away from the user intent."*

Two verbs, two **user intentions**:

- **`/grove:start`** — *"govern this from the get-go."* All in, up front.
- **`/grove:enter`** — *"be available to govern."* On detecting conditions where
  swarm governance could apply, the model **asks**. The user answers. A yes
  becomes a start.

**This resolves two blocking findings and converts a third.**

- **D2 is no longer disabled.** The state that broke it — *entered + governed work
  + no run* — is no longer a designed path. Governed work is preceded by an ask;
  a yes opens a run and D2 runs at run start. What remains is the model failing to
  ask, which is model unreliability rather than a designed hole, and its failure
  mode is *grove did not engage* — the same outcome as grove not being installed.
  Not nothing, but not the floor being silently off.
- **The cursor fork gets a third answer the review did not consider.** Not *"yes,
  `enter` creates a cursor"* (safety evaporates) and not *"no, cursor-less governed
  mode"* (the rejected design). **The ask is the boundary**: `enter` writes nothing
  ever; the ask converts it into a start, and the start writes. Consistent with
  `dispatcher.md` D5, since an in-session ask-and-answer is an in-session approval.
- **The justification moves from mechanism to intent — and that dissolves the
  Codex asymmetry.** The split is no longer argued from
  `disable-model-invocation`, so nothing rests on a Claude-only frontmatter key.
  Both hosts ship both verbs meaning the same thing. The MAJOR finding below
  stands as a correction of the *old* rationale, not of this one.

**It also makes `enter` genuinely safe to leave model-invocable**, which is what
the maintainer wanted: a spurious model invocation costs a question, and the
worst case is the user saying no.

**Still unresolved by this refinement:** the payload question, and the charter's
rejection of session-holding continuation hooks. Both below.

### BLOCKING — the two-skill rationale does not follow from its own premise

The premise is confirmed: `disable-model-invocation` is frontmatter, therefore
per file, with no per-argument control. **The conclusion drawn from it is
refuted twice over.**

1. **`start` supplies no deterministic path that one skill lacks.** Default skill
   frontmatter is user-invocable **and** model-invocable. A single skill already
   gives a typed deterministic entry plus best-effort discovery. The claim at
   §Under evaluation benefit 1 is false against the documented default. The
   split's actual yield is one narrow thing: *the model cannot cause a cursor
   write*.
2. **Grove already attaches per-operation invocation policy inside one skill, in
   code.** `lifecycle.mjs:34` emits the flow
   `['plan','disclose','confirm-exact-action-ids','apply']`, and `applyPlan`
   **throws** on any unconfirmed action id (`:403-408`). `setup` — which writes
   the consumer's `CLAUDE.md` — and `remove` — which deletes consumer surfaces —
   both ship **model-invocable with no flag at all**; their side effects are gated
   at the confirm step, not at a skill seam. **A one-skill `/grove:start` whose
   cursor write goes through that same confirm gate is strictly stronger than the
   frontmatter flag**, because it also catches a *user*-invoked mistake, which the
   flag does not.

**`inv-self-improvement`:** adopting the flag would be grove's first use of it,
leaving `remove` — the destructive one — outside the new convention. Migrate it or
name the exemption.

**Superseded in part by the Refinement above.** The mechanical argument for the
split is still refuted — one skill *can* hold both invocation modes, and grove's
confirm gate is the stronger control. What survives is a **different and better
argument**: the two verbs encode two user intentions, not two invocation
policies. That argument does not depend on the refuted premise.

### BLOCKING — `enter` mode turns off D2, the charter's named load-bearing floor

`charters/dispatcher.md:140` — *"**Per-RUN floor check at run start (D2, the
load-bearing floor guard).**"* — and `:446-449`: every run keeps ≥1 human-owned
intent-locus gate, *"enforced on every per-handover read **and** by the per-run
floor check at run start."*

**`enter` starts no run, so D2 never runs.** A session that entered, holds the
rules, and does governed work sits **outside the human-intent floor**. And under
Open 6's recorded lean the cursor-less layer only *warns* — so the state where the
floor is unenforced is the state that gets a warning.

That is the failure that opened this thread (*"reviewers silently not running"*)
in a better-camouflaged form: a session that looks entered, has the rules, and is
outside the floor.

### BLOCKING — the cursor fork breaks something already Decided, either way

The proposal does not say whether `enter` + governed work creates a cursor.

- **If yes** — *"writes nothing"* is false in effect, and benefit 2's safety
  rationale evaporates: the model's side effect was delayed, not prevented.
- **If no** — `enter` mode is a cursor-less governed mode, **which this canvas
  rejected** in §Considered and rejected: run scope is not derivable, the join has
  no defined "both", resumption is impossible. The proposal re-admits the rejected
  design as a first-class mode in the same document that rejected it.
- **If `enter` mode is not governed at all** — then loading the rules buys
  nothing: under the adopted precondition-set semantics, stopping is disabled
  while any transition is enabled, and with no marking nothing is enabled. Rules
  present, semantics vacuous.

### MAJOR — the payload cannot have both properties this canvas assumed

Grove's shipped skill idiom is a ~15-line **read-through pointer**
(`generate.mjs:354-376`: *"This is a read-through entrypoint, not a lifecycle
authority"*). What survives compaction in that idiom is **the pointer**, not the
rules — the rules arrive by a `Read` into message history, which compaction
summarizes away. The §Evidence section banks on invoked skill bodies persisting.
**Both cannot hold.** Inlining instead means a hand-cut floor extract generated
from a 27,601-byte charter — a new generated artifact of exactly the class that
produced #164, #169 and #170.

Corollary, in the proposal's favour: **payload duplication is a non-issue.**
`config.mjs:35-48` already builds lifecycle skills as a cross-product of
operations × hosts from one source. Two entry skills duplicate nothing.

### MAJOR — the split's justification is Claude-only; its cost is dual-host

`disable-model-invocation` is a Claude Code frontmatter key. Grove's Codex
projections emit `name` + `description` only (`generate.mjs:320-324`), and
`spec-0004`'s Codex contract carries no invocation-policy field. **On Codex the
two skills have no enforced difference — the entire mechanical justification
collapses while the three-state cost is still paid.** A new asymmetry, which the
Constraint above requires be disclosed rather than left silent.

### Correction — the eviction argument was Codex-shaped, not Claude-shaped

This draft's §Evidence warned that grove's own role skills would evict
`/grove:start` from the 25,000-token budget. **On Claude that is wrong**: roles are
**agents** (13 files in `adapters/claude/agents/`), which do not consume the skill
budget; `adapters/claude/skills/` holds four. The pressure is modest. The real cost
of a broadly-matching description is not budget — it is `adr-0003:73-76`'s
anti-hijack floor, which this canvas engaged only on its #5688 half.

### Open — how is work transferred? (maintainer, 2026-07-28)

*"How the work is transferred… whether we're using any specific records as
requests for work. They seem roughly conceptually similar to the tokens in the
Petri nets… when code is created, which generates the needs for two different
reviewers to work in parallel, and then the continuation requires those two
reviewers to finish."*

**The observation exposes an asymmetry in grove as it stands.** Completions are
records — verdict records, artifact status. **Requests are not.** A dispatch is an
act, not a record. So grove can see tokens consumed and cannot see them produced.

**That asymmetry is the original bug.** *"Reviewers silently not running"* is
exactly *owed work that was never materialised anywhere*. If the obligation had
been a thing on disk, its absence would have been visible.

**A modelling note, offered because it decides whether the parked features stay
parked.** There are two ways to place the token, and they are not equivalent:

- **Token = obligation** (a token sits in "conformance review owed" until
  discharged). The merge transition then fires on *absence* of tokens, which is
  an **inhibitor arc** — explicitly parked by this record.
- **Token = completion** (a token appears in "conformance verdict exists for X"
  when the record exists). The merge transition **consumes from both places**.
  Plain Petri net, no inhibitor, and artifact-derived: a token is present iff a
  record is present.

**The second matches both the maintainer's fork/join example and the already-
Decided artifact-derived marking, and it keeps the parked features parked.** Owed
work is then not a token but an *enabled-and-unfired transition* — which is
precisely what the completeness guard checks.

Not adopted; recorded so the next turn starts from a sharper question.

### Parked

- **The multi-repo use case — parked; the disjointness theory it produced —
  live.** *(maintainer, 2026-07-28, scoping the parking precisely)*: what is
  parked is the **use case**, not the theory built while discussing it. The
  theory — closure-based disjointness, per-ask assessment, type-derived safety —
  is general, and multi-repo is merely its most distant instance. **Its nearest
  instances are already in scope**: research fanning out beside epic work, and
  the paired reviewers themselves, are single-repo parallelism the current
  design should permit now.

  **The discipline**: no construct may be justified by multi-repo alone. It may
  be cited as evidence a construct *generalises* — never as the reason the
  construct exists. The theory stands to this design as `informed_by`, not
  `depends_on`.

  Cognition's *"writes stay single-threaded"* is a blanket heuristic for what is
  actually a **condition**: writers may fan out iff their write-sets are
  disjoint. The refinements:

  1. **Disjointness is over the downstream *closure*, at repo granularity.**
     Code and a spec in one repo are NOT disjoint even when the files differ —
     the spec's consequences reach the same code. The closure is assessed
     **crudely, per repo**, by the maintainer's explicit precision choice:
     finer-grained analysis (*"do these exact specs influence that exact part of
     the code base"*) costs more than it buys.
  2. **Per-ask assessment, by the running agent.** Some safety falls out of
     artifact typing for free: `research` and `feedback` are the reviewless
     types *because* they inform and never decide, so their downstream closure
     is **empty until a consuming task is triggered** — research fans out safely
     beside epic work. The rest (*"merge this PR after that one"*) is a
     dispatch-time judgment. Placing it in the **running agent** rather than an
     encoding is consistent with the emergence constraint: per-ask parallelism
     assessment is the opposite of an itinerary. The design's obligation is only
     to *allow* the fan-out the agent judges safe.
  3. **The upstream wrinkle, and its resolution.** Apparently-disjoint repo sets
     under one mandate are only *conditionally* disjoint, because
     `UPSTREAM-INDICTED` findings travel upstream — potentially all the way to
     the shared trigger point. But W4 already forbids the dangerous form:
     upstream is never *patched* concurrently, it is **surfaced as a record**.
     So upstream consequences converge as records, and the maintainer's
     mechanism — the apex waits for all downstream sets, then decides on the
     **conjunction of records** — is a **join with the apex as consumer**. Same
     construct as the merge gate, one level up; no new machinery; marking stays
     artifact-derived. Honest cost, the same as every join: a mandate-level
     fan-out is only as parallel as its slowest branch whenever the apex must
     act.

  **One immediate payoff, recorded rather than parked:** the same disjointness
  argument dissolves the research note's join-collision hazard (two reviewers
  writing the join postcondition simultaneously). The reviewers already write
  **disjoint artifacts** — each its own verdict record — and under the Decided
  artifact-derived marking **nobody writes the join at all; the join is a derived
  fact.** The cursor takes writes only at run open and close. No shared place, no
  race. (Research note open question 2: answered.)

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
- **verified against source (private; primary not citable)** — the maintainer
  supplied the private reference framework for direct reading, 2026-07-28. Its
  load-bearing mechanics, confirmed in the charters themselves rather than taken
  from any summary:

  - **The far cold pole, working in production shape.** The driver is a
    *read-only orchestrator with no file tools at all* — every read and write is
    delegated; a dedicated bookkeeping role owns the run-state file; the driver
    treats its own context as *disposable scratch space*, and any phase boundary
    may be crossed by a **fresh driver invocation that reconstructs the run from
    disk**. Cost, visible in the same charters: one extra standing role, a fixed
    state schema, and a driver that must re-query everything each turn.
  - **The run-state directory is committed — but the framework never commits.**
    It is written by the run as a *reviewable audit trail* and enters git only
    through the human's normal commit flow; aborts set a status field rather
    than deleting. (Partial answer to Open 8: creation by the run, the commit is
    the human's act, and a dead run leaves a *marked* cursor, not a mystery.)
  - **Compact-return discipline.** Every specialist returns 1–3 lines, an
    artifact path, and a machine verdict; anything longer is summarised to one
    line and discarded; human checkpoints link artifacts, never inline them.
    Borrowable at either pole — it is what keeps any driver lean.
  - **Preflighted disjoint write allowlists** — the disjointness theory this
    canvas developed, already shipped: every parallel worker gets an exhaustive
    per-worker write allowlist, shared/generated paths are checked, and **any
    overlap falls back to sequential**. Assessed per-plan by the planning role.
  - **Convergences with grove, verified**: retry bounds of 2 then escalate to
    the human; state from artifacts, never from the driver's memory; accountable
    human decisions carried as **blocking dependencies owned by named human
    roles** that no agent may resolve or mark done.
  - **The divergence NOT to import**: the pipeline is a fixed, centrally
    scripted phase ladder — precisely the itinerary shape this canvas forbade.
    The state discipline transfers; the sequencing model does not.

  The framework also confirms the earlier reported claim: a **state
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
