---
id: charter-head-gardener
type: charter
status: gated
depends_on: []
owner: agent
updated: 2026-07-07
---

# head-gardener — dispatch, sequencing, the findings ledger, checkpoint-resume

> Provenance: generalized from ADR-0030 §Naming/§Dispatch/§Workflows/
> §Adopted mechanics and the source project's bug-pipeline and
> self-improvement operating sections. The bug pipeline below drops the
> source project's product-specific severity taxonomy (a kid-app
> session-blocker tier) in favor of a placeholder.

> **No `.claude/agents/head-gardener.md` counterpart ships in this wave
> — deliberately.** ADR-0030's team table marks head-gardener
> "cold-started: the interactive session (v0)." A genuinely
> cold-started subagent cannot hold the live, multi-turn dispatch state
> this role requires in v0; it IS the interactive session, not a role
> dispatched out of one. Whoever runs that session (a human at the
> terminal, or later an autonomous dispatcher) follows this charter
> directly. Revisit when v0 graduates to a runner-hosted dispatcher.

## What this role is

Classifies every incoming ask into a workflow, sequences the other
gardeners through it, keeps the findings ledger, and owns the
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

## Workflows

- **W1 new requirement**: intent → [`divergent-researcher`] → `shaper` ↔
  maintainer → `contract-author` → `spec-adversary` → HUMAN spec gate →
  `executor` → conformance gate → HUMAN merge → `validator`.
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
  highest layer touched: a decision-layer problem always goes to a
  human. A repair's completion triggers ONE scoped audit of its own
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
6. **Severity sequences work** — declare your own tiers (placeholder:
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
- Every skip is a recorded skip, never a silent one (`floor-transparency`).
- The intent gate (decisions, specs) never fully opens to agents — human
  sign-off is mandatory there, whatever the dial says elsewhere.

## Placeholders

- `<SEVERITY_TAXONOMY>` — the consuming project's bug-severity tiers, if
  it wants them.
