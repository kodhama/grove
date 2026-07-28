---
id: research-supervisor-composition
type: research
status: recorded  # reviewless type; informs, never decides.
depends_on: []
informed_by: [adr-0046-how-dispatch-rules-reach-a-session, spec-0006-voluntary-dispatch]
owner: agent
updated: 2026-07-28
---

# research note: grove's dispatch is a composition of supervisors, not one

Maintainer's observation, 2026-07-28, shared during the spec-0006
implementation-planning pause: *"we're not just dealing with a single
supervisor, but more like a composition of supervisors… some supervisors can
work on some events, some others can work on other events. One of them
supervising the transitions themselves — after code, we run those two
reviewers. The other is the supervisor running the gates — also displayed in
the fact that we have different configuration files for those things."*

## The decomposition, made explicit

| supervisor | specification | enforcement | alphabet (events it may disable) |
|---|---|---|---|
| **transitions** | `transitions.toml` | the guard (spec-0006) | `stop`, `close` |
| **gates** | `gates.toml` | the D2 floor check at run open; per-handover profile re-resolution; the human acts | the ratification acts; via its floor, `open` and `ship` |

The composed behaviour is the conjunction: an event proceeds only if no
supervisor disables it. This refines `adr-0046`'s identity clause — *"the
supervisor is the activation rules plus the guard"* — without contradicting
it: that sentence described the transitions supervisor, and the gates
supervisor was already present in the same decision as the floor check and
the profile reads, unnamed as such.

## Evidence the model is right rather than decorative

The spec-0006 implementation plan **factors along exactly this boundary
without having been asked to**: `guard-core.mjs` (slice S2) is the
transitions supervisor pure — it never reads `gates.toml`; the D2 floor check
lives in the run operations (slice S5), which is where `gates.toml` is read.
Module seams landing on theory seams unprompted is the useful kind of
confirmation.

## The one warning composition carries

The standard result in modular supervisory control: **two individually
nonblocking supervisors can jointly block.** v1 does not conflict — the
alphabets share only `close`/`ship`, and a `FAIL` verdict record deliberately
*satisfies* the transitions supervisor (a completion token), so a failed
review cannot wedge a close against a human gate.

But that non-conflict is a property of the **current specifications**, not of
the architecture. An amendment that grows either alphabet — a gates rule
reaching into transition firing, or a transition precondition naming a
ratification state — could create a joint deadlock neither supervisor
exhibits alone. **Any amendment that widens either supervisor's alphabet owes
a conflict check on the composition** (cheap at this size: enumerate shared
events, walk the joint reachability of close). This is the offline-analysis
class the corpus already parks as discretionary — composition is the specific
trigger that should un-park it.

## No implementation bearing today

Recorded as a mental model with one future obligation, exactly as the
maintainer framed it. No replanning; spec-0006 and its plan stand.
