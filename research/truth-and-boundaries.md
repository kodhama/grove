---
id: research-truth-and-boundaries
type: research
status: recorded  # research is a reviewless type — it informs, never decides; sits outside the gate ratchet (grove#188 gap unresolved here). Supersede with a newer statement.
depends_on: []
informed_by: [research-layer-design-sketch, research-bmad-loop-assessment]
owner: human
updated: 2026-08-05
---

# Truth, intent, and deterministic boundaries

The maintainer's statement, 2026-08-05, verbatim — the core this note exists
to preserve:

> My own conclusion is that specs can only express the truth of intent, and
> code is the only expression of behavioral truth. Tests are the
> deterministic boundaries inside which the truth resides, and the
> hypothesis is more that we don't need to know the truth, we just need to
> make sure we can rely on the deterministic boundaries to the set of
> possible application behaviors.

## The trichotomy

Three layers, three different epistemic roles — none reducible to another:

- **Specs express intent.** Intent is allowed to be wrong and is revised
  every cycle (the maintainer's work evidence: every implementation cycle
  implied a spec revision). A spec claiming to describe behavior is claiming
  a thing it structurally cannot hold.
- **Code is behavioral truth — and unreadable as such.** The actual behavior
  space of a program is unobservable in full; "code as truth" names where
  truth *lives*, not something anyone can consult.
- **Tests are deterministic boundaries.** Not descriptions of the truth —
  constraints on where it can be. The governance question is never "is the
  description accurate" but **"can the boundaries be relied on?"**

The verification target therefore shifts from *truth-description
maintenance* (the spec-anchored and spec-as-source aspiration) to
**boundary trustworthiness**. A boundary is trustworthy when crossing it
reddens — mutation-checking is this made operational, and the week's own
evidence ran the experiment before the philosophy named it: the browser
suite's mutation-verified assertions; the INV-M1-4 case where the intent
document asserted a gap the truth had closed and only the test held; the
pin-rate metric, which was intent-with-boundaries coverage all along.

## The falsifier, and a free-running experiment

The hypothesis fails where wrongness lives **inside** the boundaries: tests
green, product wrong, boundary too loose to notice. Observational protocol,
runnable on math-quest from now with no apparatus: classify every surfaced
defect as (a) **escaped a boundary** — a test should have caught it
(boundary gap), (b) **inside boundaries, wrong intent** — the only bucket
that would vindicate spec-anchoring, or (c) **boundary rot** — a test
weakened or deleted silently (mutation spot-checks are the detector). If
bucket (b) stays near-empty over months of real work, spec-as-source is
maintaining a description nobody needed. Whether the deferred sdd-gauntlet
program hosts a formal version of this is the maintainer's later call.

## Governance consequences

**Detection and authorization are different things.** An engine should
detect staleness and cascade universally — when intent revises, everything
derived from it is of unknown validity, and that fact is computed, always.
Whether the revision *propagates* is not the engine's call: it belongs to
the gate owner. The maintainer's formulation, verbatim:

> I don't necessarily think that downstream surfacing changes to the spec
> should be bubbled up automatically, I think that all depends on the gate
> owner. […] the more complete model would be something like
> spec.downstream = agent, spec.upstream = human as an option. spec = agent
> basically defines both.

**Directional gate ownership**: each gate configures an owner per direction
of change flow. `spec.downstream` governs forward derivation (spec →
implementation); `spec.upstream` governs backward surfacing
(implementation-found problems revising the spec). The shorthand
`spec = agent` sets both. The frozen-spec regime — downstream done, no
code-surfaced contract changes allowed — becomes *configuration*, not
philosophy: upstream closed. The maintainer's own judgment of that regime,
kept with it: "I still think it's illusory but it fits [the field's
dominant] approach" — notably the field's best loop engine hard-codes
exactly that regime as its only mode (bmad-loop's "frozen intent
contract"; see research-bmad-loop-assessment).

For the engine rubric this refines R1 without weakening it: **cascade
detection is unconditional; cascade authorization is per-gate,
per-direction.** Reviews divide accordingly — a proposal adversary polices
intent coherence; conformance polices boundary adequacy (new behavior gets
binding boundaries, mutation-spot-checked), with "tests green" as the weak
form of evidence.

## A closing consistency note

The maintainer builds the engine with interest and declines to author or
review charters — intent roughly expressed, models drafting the rest. Under
this note's own epistemology that is not a compromise: charters are
intent-expression aids, and reliability was never going to live there. It
lives in the boundaries.
