---
id: adr-0034-pre-execution-planning
type: adr
status: draft
depends_on: [adr-0004-spec-lifecycle-and-organization, adr-0005-tdd-and-artifact-gated-dispatch, adr-0012-methodology-delivery-machinery, adr-0031-multi-host-distribution, adr-0033-adopt-family-plugin-contracts]
owner: agent
updated: 2026-07-24
---

# ADR-0034: pre-execution planning as an advisory cold role

> **Draft shaping canvas — nothing here authorizes implementation.** The
> maintainer wants to test whether a stronger planning pass can make a
> lower-cost executor effective without weakening Grove's artifact authority,
> strict TDD, independent review, or dual-host delivery. This draft records the
> settled starting boundary and the questions still requiring a maintainer
> decision.

## Decision state

### Decided

- **D1 — start without a plan gate** *(maintainer, 2026-07-24)*. Planning is
  an execution-side handoff, not a separately ratified stage. The existing
  `build` and `ship` gates remain unchanged.
- **D2 — start without a committed plan artifact** *(maintainer,
  2026-07-24)*. A plan does not enter the repo corpus, gain lifecycle
  frontmatter, become a code `implements:` upstream, or replace the ratified
  spec/decision.
- **D3 — evaluate before making the production routing permanent**
  *(maintainer, 2026-07-23/24)*. The first evidence should compare cold runs
  from the same ratified input and repository state, separating planner value
  from the effect of changing the executor's model tier.

### Open

- **O1 — transient transport.** Should the planner return a bounded advisory
  packet which the driving-session dispatcher relays verbatim into a fresh
  executor invocation (recommended), with task/change-request checkpoint prose
  used only when the existing resume seam fires? Alternatives are a temporary
  filesystem file or a durable task/change-request comment for every plan.
- **O2 — routing obligation.** Is planning required before every executor
  invocation, required only for code-bearing work derived from a spec, or
  selected case-by-case by a complexity judgment?
- **O3 — experiment and adoption threshold.** Which task sample, repetitions,
  quality floor, and cost improvement are enough to adopt the role? The
  current recommendation is a three-arm cold comparison: current premium
  executor; medium executor without a planner; premium planner followed by a
  medium executor.
- **O4 — model/resource ownership.** Does Grove define portable resource
  classes such as `reasoning-heavy` and `execution-medium` for adapters to map,
  or does concrete model selection remain entirely in the experiment harness
  and consumer/runtime configuration?
- **O5 — role name.** `implementation-planner` is the working name. The
  decision has not yet made that machine-readable identity normative.

### Parked

- **A durable `plan` artifact and fifth gate.** Revisit only if evidence shows
  the plan itself must become authoritative, reusable, and independently
  ratified. That future shape would require its own fidelity and intrinsic
  quality review; it is deliberately outside this first increment.
- **Exact release bump and support-row promotion.** Adding a role changes the
  public fleet and invalidates old candidate evidence for a future release,
  but the version judgment and exact-surface requalification belong to the
  implementation/release step after this decision settles.
- **A persistent runner-hosted dispatcher.** ADR-0031 parks it already. This
  decision uses the existing driving-session dispatcher and does not create
  orchestration infrastructure.

## What the sources establish

### The planning seam already exists, but is unsettled

ADR-0004 parks exactly this question: whether the executor's
plan/task-decomposition format should be standardized while remaining
unpersisted as a repo artifact. The current executor then crosses the whole
distance itself: it reads the ratified spec/decision and dependency graph,
derives failing tests, implements, refactors, and verifies.

Separating codebase reconnaissance and implementation decomposition from the
write-capable executor is therefore a new role boundary, not a new requirement
layer. The planner may make the implementation route explicit; it may not
invent behavior absent from the ratified upstream.

### The authoritative-input wording needs a deliberate refinement

The executor charter currently says all context travels through the artifact
and its `depends_on` graph, and rejects a conversational prose brief as a
substitute. ADR-0005 makes the load-bearing guarantee precise: executor must
have a `gated`/`approved` spec or decision, never conversation in its place.

An advisory plan can coexist with that guarantee only if the new contract says:

- all **authoritative requirements** still travel through the ratified
  artifact graph;
- the executor always reopens that artifact itself;
- the plan is supplemental execution orientation, not another upstream;
- the plan cannot extend, soften, or override the artifact; and
- stale, contradictory, or unverified plan anchors cause a surfaced finding or
  a replan, never silent implementation.

Code's fidelity review remains against the spec. No reviewer treats the plan
as evidence that the code conforms.

### The role must remain host-neutral

ADR-0031 fixes one authored Grove kernel with generated Claude and Codex
adapters. The planning method and packet semantics therefore belong in one
canonical charter. Host adapters may differ in how they launch a cold role and
select a model, but neither may restate or fork the role contract.

Current distribution proves cold native roles and structured child results on
Codex, but the role inventory and generated launchers do not yet carry a
portable per-role model tier. “Premium planner / medium executor” is therefore
an experiment-harness condition until O4 is decided and independently proven
on supported surfaces.

## Candidate role contract

The working `implementation-planner` is cold-started and read-only.

### Inputs

- one exact `gated`/`approved` spec for code-bearing work, plus its declared
  dependency graph;
- the repository revision and disclosed working-tree basis to plan against;
- consumer-owned Grove configuration/addenda relevant to locating tests,
  commands, and conventions.

### Output: the advisory plan packet

1. the authoritative artifact id, path, status, version/content identity;
2. the repository revision and any working-tree assumptions;
3. an explicit `authority: advisory — artifact wins` marker;
4. acceptance-criterion → failing-test → file/symbol mapping;
5. relevant code/test anchors, separating verified facts from inferences;
6. ordered red → green → refactor slices;
7. test, typecheck, lint, and other verification commands;
8. risks, blockers, scope exclusions, and unresolved ambiguity.

If a load-bearing ambiguity prevents a trustworthy route, the planner returns
no executable plan and surfaces the gap upstream. It never resolves product
intent, writes tests/code, edits the spec, or disguises an inference as a
verified repository fact.

## O1 options — how the packet reaches the executor

### A. Direct dispatcher relay, checkpoint only when needed — recommended

The planner returns the packet as its bounded final output. The driving-session
dispatcher passes that output verbatim, alongside the authoritative artifact
pointer, into a separately cold executor invocation. The executor reopens the
artifact and verifies the packet's anchors before acting.

If the existing checkpoint/resume seam fires before or during execution, the
task/change-request checkpoint carries the packet or its remaining validated
steps. Persistence is paid for only when persistence is actually needed.

**Benefits:** smallest new mechanism; no cleanup or repo pollution; works with
the existing parent → cold child → parent → cold child pattern; keeps the
planner and executor as genuinely separate model calls.

**Cost:** an interrupted relay must use the existing checkpoint convention or
rerun planning. The packet is working material, not durable evidence.

### B. Temporary filesystem packet

The planner writes an ignored file outside the repo corpus and executor reads
it by path.

**Benefit:** survives context compaction on one machine.

**Costs:** invents location, ownership, cleanup, lifetime, and remote-host
semantics; a path is not portable across Codex/Claude surfaces; tempts later
code to treat an advisory file as authority.

### C. Always post the packet to a task/change-request

The plan is a clearly marked advisory comment, not a repo artifact.

**Benefit:** durable, visible, and naturally available to run-resumer.

**Costs:** assumes a task/change-request exists before implementation; adds
platform-coupled noise and a write for every plan; turns a transient
optimization into permanent project history.

## O2 options — when planning fires

### A. Every executor invocation

Simple and maximally consistent, but spends a planning call on non-code edits,
localized regressions, and trivial mechanical work.

### B. Every code-bearing spec → executor handoff — recommended candidate

Code-bearing forward construction from a spec receives a plan. Decision-only
non-code work continues directly to executor. A localized W3 implementation
slip may go directly from reproduced failing test to executor; a spec gap
routes upstream and receives planning after the amended spec converges.

This is a semantic boundary already present in ADR-0005, not a token-count or
line-count threshold. It is observable and testable.

### C. Dispatcher judgment based on complexity

Potentially cheapest per task, but “complex enough” is not yet defined. It
creates selection bias in the experiment and recreates ADR-0005's parked,
ad-hoc size/stakes threshold.

## Proposed cold experiment

For each selected ratified spec and exact repository revision, prepare fresh,
isolated runs in randomized order:

1. **A — current baseline:** premium executor, no planner;
2. **B — downgrade control:** medium executor, no planner;
3. **C — planner treatment:** premium planner → medium executor.

Use at least three tasks spanning small/medium/large code-bearing work and,
where budget permits, repeat each arm. The planner arm always plans within the
sample so routing discretion cannot bias the result.

Measure:

- input/output/cached/reasoning tokens by role, premium tokens separately, and
  total tokens;
- a dated price snapshot, total cost, and cost per accepted completion;
- test/typecheck outcomes and independent conformance/code-review findings;
- retries, reviewer → executor loops, and elapsed time;
- invalid plan anchors, executor deviations with reasons, unused steps, and
  ambiguities caught before implementation.

The adoption floor should be preregistered before running the sample:
treatment C must be non-inferior to baseline A on completion and independent
review quality, materially reduce premium-token spend or weighted cost, and
outperform control B sufficiently to show that the planner earned its extra
cold run. Fewer total raw tokens are desirable but not assumed.

## Consequences and propagation if approved

This decision would authorize a follow-up spec before implementation. That
contract would cover:

- the canonical planning-role charter and generated host projections;
- the exact packet grammar and stale/conflict behavior;
- dispatcher trigger and verbatim relay behavior;
- executor authority/verification wording;
- checkpoint/resume behavior;
- the three-arm experiment harness and retained out-of-tree evidence;
- generated role inventory/counts, discovery, and dual-host parity tests; and
- release-candidate requalification and a separately judged version bump.

No gate-profile row, lifecycle state, artifact type, `depends_on` relation, or
conformance target is added.

## Rejected options

*(none yet — O1/O2 alternatives remain live.)*

## Acceptance criteria for this decision

- Distinguishes planner orientation from the ratified behavioral contract.
- Keeps the spec/decision as executor's mandatory authoritative input.
- Adds no plan gate or repo plan artifact.
- Defines a host-neutral planner/executor boundary without promising a model
  control unsupported by current adapters.
- Makes routing deterministic or records why it remains discretionary.
- Defines an experiment that isolates planner value from executor downgrade.
- Names the generated-fleet, support-evidence, and release consequences without
  implementing them in the decision PR.
- Receives independent decision-adversary review before ratification.

## Self-check

Not yet run. The draft has five Open items and is not converged.
