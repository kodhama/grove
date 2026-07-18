---
id: charter-dispatcher
type: charter
status: gated
depends_on: [adr-0012-methodology-delivery-machinery, adr-0017-dispatcher-posts-records-self-adoption]
owner: agent
updated: 2026-07-18
---

# dispatcher — dispatch, sequencing, the findings ledger, checkpoint-resume

> Provenance: generalized from ADR-0030 §Naming/§Dispatch/§Workflows/
> §Adopted mechanics and the source project's bug-pipeline and
> self-improvement operating sections. The bug pipeline below drops the
> source project's own product-specific severity taxonomy in favor of a
> placeholder.

> **`.claude/agents/dispatcher.md` is scoped, not a full peer of the
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
  **plus the human intent gate**. Only a positively-declared reviewless
  type (`research`, `feedback`) owes nothing; an unclaimed type owes the
  full set, fail-closed.
- **A review counts only as a posted verdict record** on the change
  request (`spec-0002` §A). When a reviewer's judgment lands, hand it to
  the **`record-verdict` skill** — the skill is the mechanism's home and
  turns the judgment into the posted record (`adr-0017`); you invoke it
  and know nothing else about how records are made or delivered. A
  session's memory of a review satisfies nothing; the bookkeeping check
  recomputes completeness, freshness, coverage, and separation from the
  records and goes red on any gap. Its green means "bookkeeping done — a
  human still judges genuineness and merges," never approval.
- **Failed reviews route by what they indict:** a `FAIL`/`BLOCK`/
  `NEEDS-REVISION` routes to the subject's own producing layer; a
  conformance `UPSTREAM-INDICTED` routes to the *upstream's* layer — a
  decision-layer indictment always to the human (W4's rule, now carried
  by the verdict grammar).
- Iteration between gates is free of ceremony; only the endpoint is
  gated (`adr-0012` E2). Adding or swapping an agent recomposes the run
  with no central flow to edit.

## Worked examples: W1–W6 (descriptive, not prescriptive)

The labeled workflows below are **worked examples of what the local
rules above emit** for common asks — kept for classification vocabulary
and orientation, not as pipelines to enforce or edit. Where an example
and the owed/trigger rules disagree, the rules win.

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
- **A review the dispatcher "remembers" ran does not count** — only its
  posted verdict record does (`adr-0012`; `spec-0002` §A). Never mark an
  owed review satisfied from session context.
- Every skip is a recorded skip, never a silent one (`floor-transparency`).
- The intent gate (decisions, specs) never fully opens to agents — human
  sign-off is mandatory there, whatever the dial says elsewhere.
- **Never dispatch `executor` without a `gated`/`approved` artifact** for
  it to read — a spec or a decision, but never a conversational prose
  brief synthesized from the session (`adr-0005`, decision 2). Where the
  line falls between "a decision is enough" and "a spec is required first"
  is not fixed here (parked in `adr-0005`); what is fixed is that *some*
  reviewable `gated`/`approved` artifact must exist — conversation alone
  never qualifies.

## Placeholders

- `<SEVERITY_TAXONOMY>` — the consuming project's bug-severity tiers, if
  it wants them.
