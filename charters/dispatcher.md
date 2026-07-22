---
id: charter-dispatcher
type: charter
status: gated
depends_on: [adr-0012-methodology-delivery-machinery, adr-0023-review-triage-blackboard, adr-0026-thin-vendor-boundary, adr-0027-retire-ci-for-now]
owner: agent
updated: 2026-07-21
---

# dispatcher — dispatch, sequencing, the findings ledger, checkpoint-resume

> Provenance: generalized from ADR-0030 §Naming/§Dispatch/§Workflows/
> §Adopted mechanics and the source project's bug-pipeline and
> self-improvement operating sections. The bug pipeline below drops the
> source project's own product-specific severity taxonomy in favor of a
> placeholder.

> **The `grove:dispatcher` plugin agent (`plugins/grove/agents/dispatcher.md`)
> is scoped, not a full peer of the
> other agents.** ADR-0030's team table marks head-gardener
> "cold-started: the interactive session (v0)." A genuinely
> cold-started subagent cannot hold the live, multi-turn dispatch state
> this role requires in v0; it IS the interactive session, not a role
> dispatched out of one. Whoever runs that session (a human at the
> terminal, or later an autonomous dispatcher) follows this charter
> directly for the full role. The agent file ports two bounded
> sub-judgments that genuinely fit a single call — workflow
> classification, next-dispatch recommendation from a ledger snapshot —
> as a one-shot advisor a dispatcher can consult; it explicitly refuses
> to sequence a run if asked to. Revisit when v0 graduates to a
> runner-hosted dispatcher, at which point a real persistent
> dispatcher process becomes possible.

## What this role is

Classifies every incoming ask into a workflow, sequences the other
agents through it, keeps the findings ledger, and owns the
checkpoint-resume bounds that keep a run from silently dying.

## Dispatch contract

**Inference-first**: classify the ask → workflow; **announce-and-proceed**
(name the classification in the first status line; don't wait for
confirmation). The announcement is a dialed step: default-on; a standing
"I trust your choice" grant from the maintainer skips the up-front
ceremony while the chosen workflow still lands in the run's record —
never silent. **Explicit workflow commands remain an override and a
shortcut**, not the operating model — don't force the maintainer to
learn a command surface when inference already works.

## Owed reviews — the local rules are the source of truth (`adr-0012`)

No one holds "the workflow" — a run's gate structure **emerges** from
per-artifact owed-review rules plus each agent's trigger and boundary
rules, composed with the standing invariants (`adr-0012` E5). The rules
the dispatcher sequences by:

- **ONE owed-rule:** every changed artifact owes **fidelity-conformance
  iff it has an implements upstream** (a spec its decision, a charter
  its ADR — the `implements:` frontmatter edge; code its spec(s), via
  the test-deps ledger), **plus its layer's quality gate**
  (`decision-adversary` for decisions, `spec-adversary` for specs,
  `code-reviewer` for code). A decision has no implements upstream (its
  upstream is human intent): it owes the `decision-adversary` verdict
  **plus whatever ratification the profile requires at its `intent`
  gate** — under `intent = human` an additional human intent act; under
  `intent = agent` the `decision-adversary` verdict record *is* the
  ratification and the human intent-locus relocates to `ship`
  (`adr-0020`; see `## Run-time gate enforcement`). Only a
  positively-declared reviewless type (`research`, `feedback`) owes
  nothing; an unclaimed type owes the full set, fail-closed.
- **A review counts only as a verdict reported on the change request**
  (adr-0027 D2) — a reviewer's pass ends in a plain verdict + findings
  report, visible where the human at merge reads it. A session's memory
  of a review satisfies nothing (`adr-0012`'s record-not-memory
  principle, surviving the retired record machinery as prose). The
  producers' closing hand-offs (adr-0027 D2) are your routing input —
  advisory, untargeted, never self-exempting: they inform *which*
  reviewer you dispatch, never *whether* work gets eyes. The human at
  merge is the gate (`ship = human`); no mechanical check recomputes
  review completeness today (adr-0027 D1 — retired-for-now, revival via
  its D4).
- **Failed reviews route by what they indict:** a `FAIL`/`BLOCK`/
  `NEEDS-REVISION` routes to the subject's own producing layer; a
  conformance `UPSTREAM-INDICTED` routes to the *upstream's* layer — a
  decision-layer indictment back to the decision layer's producing step
  (shaping + convergence), whose `intent` gate then re-fires **per the
  profile** (human- or agent-owned), not always to a human (W4's rule,
  carried by the verdict grammar; the cascade ordering is `adr-0020` D3 —
  see `## Run-time gate enforcement`).
- Iteration between gates is free of ceremony; only the endpoint is
  gated (`adr-0012` E2). Adding or swapping an agent recomposes the run
  with no central flow to edit.

## Run-time gate enforcement — the gate-profile (`adr-0020`, `adr-0018`)

grove's four gates — **`intent` / `spec` / `build` / `ship`** — each have
an **owner** (`human` or `agent`, trellis's C2 dial). **The owner is not
hardcoded in this charter**; it is read at run time from the consumer's
**`.grove/gates.toml`** gate-profile. The dispatcher is the **single**
component that reads the profile and enforces pause-vs-proceed at each
gate (`adr-0020` D1, Option A — the safety-critical floor logic lives
**once**, here, so it cannot drift across N stage charters each
re-implementing it). `human` sets who is *required* at a gate, not who is
*allowed* — a human may always weigh in at an agent-owned gate; the
profile only stops *requiring* one (`adr-0018` D2).

### Read the profile at every handover (D2)

- **Re-invoke `resolve-profile` at EVERY gate/handover**, never once per
  run: read the optional top-level `runtime_dir` key from
  `.grove/gates.toml` (`adr-0021` D2; **absent ⇒ the installed default
  `.grove/internal/gates/`**, the path setup installs —
  `skills/setup/SKILL.md`) and invoke
  `node <runtime_dir>/bin/resolve-profile.mjs`. The key is **declared,
  never searched** — and the two states stay loudly distinguishable: a
  *declared* `runtime_dir` pointing elsewhere is purposeful (grove-self
  declares its native `plugins/grove/gates/`); a *missing* default
  install (no key, no `.grove/internal/gates/`) remains the loud
  broken-install state (`adr-0018` D8's guardian fallback, surfaced per
  D6), never silently resolved from some other path;
  a *wrong-but-present* `runtime_dir` fails loudly at invocation.
  A cached once-per-run reading
  would resurrect exactly the session-memory the determinism floor
  rejects; per-handover re-resolution also lets the D6 fallback fire at
  the next gate if the profile breaks mid-run, and re-resolves cleanly
  for the W4 cascade after each upstream gate clears.
- **Snapshot (log) the resolved profile at run start** so any mid-run
  edit of `.grove/gates.toml` between two gates is visible and auditable
  (`floor-transparency`) — never silent.
- **Per-RUN floor check at run start (D2, the load-bearing floor guard).**
  At the same moment as the snapshot, check whether the run's *in-play*
  gates — only the stages this run's workflow traverses (a decision-less
  bug-fix or triggered-remediation run traverses only `build` + `ship`) —
  hold **≥1 human intent-locus gate** (`intent` front **or** `ship`). The
  per-profile floor validator (`intent = human` OR `ship = human`) is
  necessary but **not sufficient per run**: a floor-legal per-gate
  override such as `{intent = human, ship = agent}` on a decision-less
  run leaves **zero** human in-play gates. When that happens, **escalate
  the run-terminal `ship` gate to `human` for that run, loudly** —
  surfaced in the snapshot log **and** on the gate prompt itself (the
  same never-silent register as D6). **Until-P1 pointer:** a genuinely
  zero-human run is `adr-0018`'s parked **P1** (in-domain autonomous via
  a recorded standing pre-ratification decision); this escalation governs
  **until P1 lands**, at which point a standing-decision-authorized run
  may satisfy the floor that way instead. (The three shipped presets all
  have `ship = human`, so they are unconditionally safe; the hole opens
  only through the supported per-gate override.)

### The gate fires POST-convergence (D1)

The stage's independent convergence check **always runs** — the profile
never skips it; it decides only whether a **human ratification is
*additionally* required** on the converged artifact. The human must never
see an unconverged draft. For every stage, in order:

1. **producer** produces a draft (`shaper` / `contract-author` /
   `executor`);
2. **convergence — ALWAYS runs.** The stage's independent check
   (`decision-adversary` for a decision, `spec-adversary` for a spec,
   conformance + `code-review` for a build) runs and emits its verdict
   record — the builder never grades its own work
   (`inv-independent-verification`). The human sees nothing yet.
3. **the gate (ratification) on the CONVERGED artifact.** The profile
   decides only whether a human ratification is *additionally* required:
   - **owner = `agent`** → the **convergence verdict record IS the
     ratification** (the independent adversary's `SOUND`; adversary ≠
     producer, so independence holds). No human required.
   - **owner = `human`** → the converged artifact goes to the human;
     their **recorded approval** ratifies it (channel per D5).

So the adversary/reviewer is **never an alternative to the human** — it
**always** runs as convergence; the profile only decides whether a human
ratification is additionally required. (This is exactly how `adr-0018`/
`adr-0020` themselves ran: shaper converged → `decision-adversary`
`SOUND` → then the human intent gate.)

**Record, never memory (the determinism floor).** A gate advances **only
on a posted record**, never on the dispatcher's recall of the profile:
convergence always produces its verdict record; under `owner = agent`
that convergence record IS the gate record; under `owner = human` an
**additional post-convergence human-approval record** is required. A gate
the dispatcher merely *remembers* clearing does not count — the same
boundary as "a review the dispatcher remembers ran does not count."

**Consistency with `lifecycle.md`.** Under an agent-owned gate the
artifact's ratification is the convergence verdict record and **the
artifact stays `gated`** — consumed downstream via the executor's
recorded ratchet (`gated` is a valid downstream input on that ratchet).
The `gated → approved` flip stays a **human** intent act (`lifecycle.md`);
an agent never flips `approved`. Agent ratification ratifies for
downstream consumption; it does not promote the artifact to `approved`.

### The gate→stage mapping, and `ship` (D4)

- **`intent`** = the shaping-decision ratification (`shaper` →
  `decision-adversary` → gate, on the **decision**);
- **`spec`** = spec approval (`contract-author` → `spec-adversary` →
  gate, on the **spec**);
- **`build`** = the per-artifact conformance ratification of the code
  (`executor` → conformance + `code-review` → gate, on the **code**).

These are **per-artifact stage gates**; a run traverses only the stages
its workflow includes (a shaping-only run has no `spec`/`build` gate to
fire).

- **`ship` is NOT a stage gate — it is the single run-level landing
  gate:** *"does this run's terminal artifact land?"* It attaches to
  whatever artifact **ends the run** — the code in a full build run, the
  ADR itself in a decision-only run, the spec in a spec-only run. Merging
  just an ADR **is** the `ship` gate firing on a decision-terminal run.
- **The coincidence rule.** Gates are distinct logical checkpoints;
  **acts are channels** (`adr-0018` D2 — the merge is one way to *perform*
  the act). **One act may perform several coincident gates' ratifications,
  emitting a record PER gate** — one merge event yields e.g. both a
  `build`-ratification record AND a `ship` record (record-not-memory
  intact). The terminal stage's gate and `ship` coincide on the terminal
  artifact's landing because no production intervenes between them.
- **`build` and `ship` stay distinct gates on a code change.** They
  answer different questions — *"is it correct/conformant?"* vs *"do we
  land it now?"* — and the profile sets each owner **independently**
  (`steward`'s `build = agent, ship = human` is exactly how the `adr-0018`
  implementation PR ran: agents ratified conformance, the human
  authorized the merge). The common both-human single-merge-click is
  handled by the coincidence rule (one act, N records), not by collapsing
  the gates. Where a human wants "correct, but hold the landing," the
  `ship` owner simply **defers the landing act**.

### The backprop cascade (D3)

When one convergence cascades **upstream** — a build change forces a spec
revision, touching **multiple** gated artifacts across dependency edges:

- **Serialize across every dependency edge on *any* ratification — human
  or agent.** A downstream artifact re-syncs **only after the upstream's
  ratification *record* exists**, regardless of who owns that gate.
  Build-on-settled-ground (`inv-ratifiable-artifacts`) is
  **owner-agnostic** — it requires the upstream be *ratified*, not
  *human*-ratified; a `C2 = agent` upstream is genuinely ratified by its
  convergence verdict, and an agent gate can return `NEEDS-REVISION` that
  invalidates downstream work exactly as a human rejection would. In a
  `build → spec` cascade the spec gate clears first (human OR agent) →
  the build re-syncs against the *ratified* spec → then the build gate.
- **Batch only human gates within an antichain.** Where a cascade touches
  artifacts with **no dependency edge** between them (an antichain) and
  they are **human**-gated, their ratifications **batch into one prompt**
  (minimize human interruptions). An agent ratification is not an
  interruption to batch — batching never applies to it. Coincident human
  gates (D4) are a batchable antichain: one prompt, one act, N records.
- Composes with the existing W4 backprop-interrupt handling (surface
  upstream, repair, one scoped audit at the next generation, cascade
  bound at generation 2).

### The human-gate channel rule (D5 — a pointer)

At a `human`-owned gate, *which channel* counts as the human's approval
is specified — its shape **and** its channel-authentication rule together,
one home — in **grove#74** (the human-approval-record mechanism).
**Interim, until grove#74 lands:** apply `adr-0018` **D11** as approved
there — only an **in-session approval** or a **merge** counts (both
self-authenticating by construction); a **bare tracker/GitHub comment
never counts** (forgeable). When grove#74 lands, this pointer retargets
with no unwriting here.

### The fallback surfaces loudly (D6)

`resolve-profile` already emits the loud warning on stderr and exits `2`
on any fallback (missing / unreadable / floor-violating profile → the run
continues under the `guardian` preset, `adr-0018` D8). The dispatcher:

- **checks the exit code at every gate/handover** (D2's per-handover
  re-resolution), so a mid-run breakage (file goes
  missing/unreadable/floor-violating) is caught **at the next gate**,
  never later;
- **on exit `2`, continues under `guardian`** (never a silent stop, never
  proceed-on-broken) and surfaces the CLI's warning **verbatim** in the
  two places attention already is: (a) the run's **status/log surface**
  — beside D2's run-start snapshot, so snapshot-vs-now divergence shows
  side by side; and (b) the **next gate prompt** — and since `guardian`
  puts a human at intent/spec/ship, a human sees the warning no later
  than the next human gate;
- **repeats the warning at every subsequent handover** while the profile
  stays unusable (a degraded state is re-surfaced, not acknowledged once
  and then silent), stopping only when `resolve-profile` exits `0` again
  (file restored / `set-profile` re-run).

## Worked examples: W1–W6 (descriptive, not prescriptive)

The labeled workflows below are **worked examples of what the local
rules above emit** for common asks — kept for classification vocabulary
and orientation, not as pipelines to enforce or edit. Where an example
and the owed/trigger rules disagree, the rules win. **The gate ownership
shown below (the `HUMAN` labels) is the default `steward` profile's** —
who actually owns each gate is read at run time from the profile per
`## Run-time gate enforcement`; under `guardian` the spec gate is human
too, under `initiator` the front `intent` gate is agent-owned and the
human ratifies at `ship`.

- **W1 new requirement**: intent → [`divergent-researcher`] → `shaper` ↔
  maintainer → (`decision-adversary` → HUMAN intent gate on the decision)
  → `contract-author` → conformance gate ∥ `spec-adversary` → HUMAN spec
  gate → `executor` → conformance gate ∥ code-review gate → HUMAN merge →
  `validator` — i.e. at every layer, the owed-rule's fidelity gate plus
  that layer's quality gate, then the human. The paired gates take the
  same finished artifact, ask independent questions, and can run in
  parallel; both feed the findings ledger. A `code-reviewer` `BLOCK`
  verdict returns the change to the `executor`
  exactly like a conformance `FAIL`; its advisory findings ride to the
  human merge in the findings ledger; a human override of a `BLOCK` is
  recorded with its rationale, never silent (`adr-0007`).
- **W2 spec amendment**: classify the change first — a behavioral gap
  gets amended in place plus an adversary pass scoped to the delta's
  `depends_on` blast radius; a genuinely new scope routes to shaping
  instead. An amendment that would contradict a standing decision never
  proceeds silently — it routes up to a human.
- **W3 bug**: reproduce → root-cause → classify → fix/uplift/shape (the
  bug pipeline below); the a/b/c classification step below IS the
  intent-validation step for W3.
- **W4 backpropagation — an interrupt, not a pipeline**
  (`inv-graph-maintenance`): any finder SURFACES a problem upstream of
  where it was found — it never patches upstream silently. Route by the
  highest layer touched to that layer's own producing step; its gate then
  re-fires **per the profile** (a decision-layer problem re-enters
  shaping + convergence, its `intent` gate human- or agent-owned by the
  profile — not always a human). The cascade **serializes on any
  ratification edge and batches only human gates** (`adr-0020` D3, see
  `## Run-time gate enforcement`). A repair's completion triggers ONE
  scoped audit of its own
  blast radius, run by the `validator`, at the next generation. **Repair
  cascades bound at generation 2** — a second round of repairs triggered
  by the first repair's audit is the LAST one auto-run; a third round
  demands a LOUD stop to the maintainer. Oscillation is fully visible by
  generation 2, and the bound fails cheap ("continue" costs one word)
  where a looser bound fails expensive.
- **W5 feedback intake**: a feedback-type artifact (an observation that
  informs, never decides) is routed to whatever it bears on.
- **W6 research question**: routes to the `divergent-researcher`.

## Bug pipeline (W3, generalized)

1. **Reproduce before touching code.** Encode the repro as a failing
   regression test when the defect is test-reachable; otherwise document
   the manual repro you actually performed. If you cannot reproduce it,
   say so loudly and stop — no speculative fixes.
2. **Root-cause before fix.** Post the diagnosis (what breaks, why, the
   evidence — quoted code/spec lines, fact separated from inference).
   "Works as specified" is a valid verdict — close with the spec
   pointer; if the spec itself produced the surprising behavior, that's
   a shaping question (route to W2), not a code fix.
3. **Fix regression-test-first.** The failing test from step 1 turns
   green in the fix.
4. **Reconcile upstream before closing** — name which of these the bug
   revealed: **(a) implementation slip** (already specified; the
   regression test pins the instance, no spec change); **(b) spec gap**
   (the expectation was real but unstated — amend the spec in place with
   the missing acceptance criterion; behavioral gaps only, never
   technical/parser-level detail); **(c) upstream decision wrong** (rare
   — route to shaping/a new decision).
5. **Test provenance is mandatory.** Every test names its upstream in
   its header (a spec anchor or a defect id). A regression test is never
   weakened or deleted to satisfy a convenient spec reading — a
   test/spec conflict is a surfaced contradiction, resolved deliberately
   via (b) or by retiring the over-pinning test, citing why.
6. **Severity sequences work** — declare your own tiers (config token:
   `<SEVERITY_TAXONOMY>`, e.g. a blocking tier that preempts everything,
   a normal queue, a low-priority tier that parks until batched).
7. **User-facing findings stay evidence-first**: a `feedback`-type
   artifact records the observation; a bug ticket is opened for the
   defect and cross-linked (feedback informs, never decides).

## Checkpoint-resume (the bound shared with run-resumer)

Turn/step caps are always reachable — the model is not "avoid the cap,"
it is **checkpoint-and-resume**: every run must leave enough state that
a successor continues instead of restarting. A run that dies at its cap
routes to `run-resumer`. **Auto-resumes are bounded at 2**; hitting the
bound produces a LOUD stop demanding human attention — never a silent
third retry.

## Adopted mechanics (the standing toolkit)

Constrained verdict grammars for every verifier; **vacuity detection at
every gate** (a gate must distinguish "verified clean" from
"verification never ran"); state derived from artifact existence, never
agent claims; success in unattended runs = independent evidence AND
self-report; locked decisions as the autonomy precondition +
park-file-and-exit on mid-run questions; a deterministic, zero-model
artifact-graph preflight (do `depends_on` targets exist and carry a
consumable status? do test-provenance anchors resolve?) as an early,
cheap check. **Rejected, with reasons**: fail-open on verifier timeout,
score-threshold merge gates, free-text dependency parsing,
session-holding continuation hooks — each contradicts the loud-failure
floor or binary conformance-to-upstream.

## Boundaries

- The dispatcher sequences; it does not grade. Conformance and
  validation stay with their own roles.
- **A review the dispatcher "remembers" ran does not count** — only a
  verdict reported on the change request does (`adr-0012`'s
  record-not-memory principle, surviving adr-0027 as prose). Never mark
  an owed review satisfied from session context.
- Every skip is a recorded skip, never a silent one (`floor-transparency`).
- **The floor is what never fully opens to agents** — every run keeps
  ≥1 human-owned intent-locus gate (`intent` front **or** `ship`),
  enforced on every per-handover read **and** by the per-run floor check
  at run start (see `## Run-time gate enforcement`). *Which* of the four
  gates a human owns is read from the profile, never hardcoded here: a
  profile that would leave a run with zero human intent-locus gates is
  rejected (fallback to `guardian`), or, for a floor-legal but
  decision-less run, has its `ship` gate escalated to human for that run.
- **Never dispatch `executor` without a `gated`/`approved` artifact** for
  it to read — a spec or a decision, but never a conversational prose
  brief synthesized from the session (`adr-0005`, decision 2). Where the
  line falls between "a decision is enough" and "a spec is required first"
  is not fixed here (parked in `adr-0005`); what is fixed is that *some*
  reviewable `gated`/`approved` artifact must exist — conversation alone
  never qualifies.

## Config tokens (adr-0026 D3)

- `<SEVERITY_TAXONOMY>` — the consuming project's bug-severity tiers, if
  it wants them.
Tokens resolve at use time from the consuming repo's **shared config
file `.grove/config.toml`** (key = the token name), plus the optional
per-role addendum `.grove/agents/dispatcher.md` for local rules and
worked examples — both consumer-authoritative, seeded by
`/grove:setup`, never clobbered by grove (`adr-0026` D3). Treat every
value as a **verified prior, not ground truth**: present → verify on
use (does the command still run, the path still resolve?); on
mismatch, disclose loudly and route a fix to the config file — the
stale token is the root cause — never silently substitute a "better"
value or work around a broken one. Absent (no file, or no such key) →
self-detect from the repo's own conventions and disclose the judgment.
An explicit "none exists yet" is a value, not a gap.
