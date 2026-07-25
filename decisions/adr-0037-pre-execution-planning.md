---
id: adr-0037-pre-execution-planning
type: adr
status: approved  # maintainer approved the planning-agent implementation, then explicitly separated the experiment into issue #143; ship remains human
depends_on: [adr-0004-spec-lifecycle-and-organization, adr-0005-tdd-and-artifact-gated-dispatch, adr-0012-methodology-delivery-machinery, adr-0020-dispatcher-honors-gate-profile, adr-0026-thin-vendor-boundary, adr-0031-multi-host-distribution, adr-0035-plugin-and-consumer-boundary]
changes: [spec-0004-dual-host-distribution@v6]
owner: agent
updated: 2026-07-25
---

# ADR-0037: add advisory pre-execution planning

> **Partial supersession (2026-07-25):** Approved ADR-0039 resolves only this
> decision's parked adoption choice by classifying the existing qualifying
> planner route as Grove dogfood. The experiment, model and token claims,
> routing contract, transient handoff, host support, release behavior, and
> every other boundary remain unchanged.

## Decision state

### Decided

- Add `implementation-planner` as a cold, read-only Grove agent.
- Route ratified code-bearing specification work through the planner before a
  separately cold executor.
- Keep the plan transient, advisory, and gate-free. The authoritative
  specification and dependency graph always win.
- Let the dispatcher relay the planner's complete output directly to the
  executor. If that relay is lost, rerun the planner rather than persisting a
  new artifact.
- Bypass planning for decision-only non-code work and for a reproduced,
  root-caused, localized implementation slip that does not change a public
  interface, schema, dispatch behavior, or governing artifact.
- Deliver the role through the existing canonical charter and generated
  Claude/Codex adapter system.

### Open

*(none)*

### Parked

- The controlled planner-assisted execution experiment is tracked separately
  in GitHub issue #143. Its models, token accounting, metrics, thresholds,
  evidence, and adoption decision are not part of this change.

## Context

The executor currently turns an approved or ratified-gated artifact directly
into test-first implementation. Larger code-bearing specifications benefit
from a separate reconnaissance and decomposition pass before implementation,
especially when the executor is cold-started.

That planning pass must not become another source of authority. Persisting it
as a repository artifact or adding a plan gate would create lifecycle and
review obligations without improving the specification's authority.

An earlier combined design coupled the role to a token-optimization
experiment. The maintainer explicitly separated those concerns: this decision
adds the agent and its ordinary handoff only. Issue #143 retains the experiment
design and prototype reference.

## Decision

### 1. Role and authority

`implementation-planner` reads the ratified code-bearing specification, its
declared dependency graph, and the relevant repository basis. It performs
reconnaissance and returns a bounded advisory plan containing:

- the intended outcome and governing artifact;
- acceptance-criterion coverage;
- relevant code and test anchors, distinguishing verified facts from
  inferences;
- ordered red → green → refactor slices;
- exact verification commands; and
- risks, ambiguities, and blockers.

It does not edit files, run implementation mutations, amend the artifact,
clear a gate, or review its own output.

### 2. Routing

The dispatcher applies this precedence:

1. a wrong or conflicting approved decision returns to shaping;
2. a missing, inadequate, or ambiguous specification returns to specification
   convergence;
3. decision-only non-code work follows the existing direct route;
4. a reproduced, root-caused, localized implementation slip may route directly
   to the executor;
5. other ratified code-bearing specification work routes to a cold
   `implementation-planner`, then to a separately cold executor.

The localized-slip exception is unavailable when the work changes a public
interface, schema, dispatch behavior, cross-component behavior, or governing
artifact.

### 3. Transient handoff

The dispatcher relays the complete planner output in the driving session
together with the authoritative artifact pointer. The executor independently
reopens the artifact and dependency graph before mutation.

The plan may sequence work but cannot add, remove, or reinterpret
requirements. A stale, incomplete, or conflicting plan is a surfaced finding;
the artifact wins. The plan is not committed, does not enter `depends_on` or
`implements`, and creates no gate.

If session interruption loses the relay, the dispatcher reruns the planner
from the authoritative inputs. No temporary repository carrier or checkpoint
schema is introduced.

### 4. Delivery

The canonical charter joins the role inventory and is projected through the
existing Claude agent and Codex skill/reference adapters. Inventory-derived
discovery and probe batching expand from thirteen roles to fourteen (thirteen
Codex-native roles plus the scoped dispatcher advisor) without adding a
planner-specific runtime or central pipeline branch.

## Consequences

- Executors receive a separate implementation decomposition without ceding
  authority to it.
- Small, well-understood localized fixes retain a direct path.
- Interrupted plans are recomputed rather than persisted.
- The role increases the canonical fleet from thirteen to fourteen and
  requires the normal generated-adapter and discovery propagation.
- Model selection, token economics, experiment evidence, and adoption are
  deferred to issue #143 and do not affect plugin delivery or release
  qualification.

## Acceptance criteria

1. The canonical role inventory contains exactly one
   `implementation-planner` row with cold, read-only exposure.
2. Claude and Codex receive deterministic generated projections from the same
   canonical charter.
3. Dispatcher and executor charters state the routing precedence, artifact
   authority, cold separation, and transient relay.
4. The role creates no plan artifact, plan gate, experiment runtime, resource
   selector, or release-activation mechanism.
5. Existing inventory-derived build, package, discovery, and probe checks pass
   with fourteen canonical roles and thirteen Codex-native roles.

## Self-check

- **Bounded:** yes — one role and its ordinary handoff.
- **Authoritative:** yes — the specification remains the sole implementation
  contract.
- **Reversible:** yes — the role and generated projections can be removed
  without migrating persisted plan state.
- **Testable:** yes — inventory, projections, charter invariants, package
  contents, discovery, and probe batching are mechanically checkable.
- **Separated:** yes — the experiment and any adoption decision live in issue
  #143, not this implementation.
