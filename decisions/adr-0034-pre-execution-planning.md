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
- **D4 — relay the advisory plan directly; persist only on checkpoint**
  *(maintainer, 2026-07-24; chose Option A)*. The planner returns a bounded
  packet to the driving-session dispatcher, which passes it verbatim alongside
  the authoritative artifact pointer into a separately cold executor. The
  ordinary path performs no external write. If the existing checkpoint/resume
  seam fires, its task/change-request checkpoint carries the packet or its
  validated remainder. Loss before executor dispatch costs a replan, never a
  correctness or gate claim.
- **D5 — plan code-bearing spec work, with a bounded localized-bug
  exception** *(maintainer, 2026-07-24; chose Option B)*. Every code-bearing
  handoff from a ratified spec routes through the planner. Under W3, a spec gap
  first amends and reconverges the spec and then plans; a wrong upstream
  decision returns to shaping; and only a reproduced, root-caused, localized
  implementation slip against an adequate spec may route directly to
  executor. A non-local implementation slip still receives a plan without
  manufacturing a spec amendment. Decision-only non-code work remains direct.
- **D6 — use a staged 9 → 27 run experiment** *(maintainer, 2026-07-24;
  chose Option C)*. Phase one runs three task sizes across all three arms once
  (nine cold runs). A preregistered futility rule may stop an unpromising
  treatment; otherwise phase two adds two repetitions of every task/arm cell
  for 27 runs total. Nine runs can reject an evidently poor direction but
  cannot establish adoption by themselves.
- **D7 — make phase one a conservative, one-way futility screen**
  *(maintainer delegated this experiment-detail choice, 2026-07-24)*. Stop
  after nine runs if treatment C loses independent quality on at least two of
  the three tasks that baseline A passes, or if C reduces neither premium
  tokens nor weighted cost on any task. Otherwise expand to 27 runs. Passing
  this screen never authorizes early adoption.
- **D8 — use the balanced baseline-adoption floor** *(maintainer, 2026-07-24;
  chose Option A)*. Across the nine treatment runs in the completed experiment,
  C may finish at most one accepted-quality result behind A, must introduce no
  additional blocking independent-review finding, must consume at least 30%
  fewer premium-model tokens, and must reduce weighted cost per accepted
  completion by at least 20%. Whether C has sufficiently outperformed
  medium-only control B remains to be made testable.

### Open

- **O3 — planner-value threshold.** What exact advantage over medium executor
  control B proves that the planner earned its additional cold call? The
  phase-one rule and final comparison against premium baseline A are settled.
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

## D4 — how the packet reaches the executor

| Dimension | A — relay + checkpoint on demand | B — always durable task/change-request post |
|---|---|---|
| Normal path | Planner output is passed verbatim by the dispatcher into the fresh executor invocation. | Planner output is posted first, then the executor is pointed to the post. |
| Authority | Advisory working material; the executor reopens the ratified artifact and it wins every conflict. | Still advisory, but permanent placement beside decisions/reviews makes accidental authority inflation more likely. |
| Recovery | If the existing resume seam fires, checkpoint the packet or its validated remainder; otherwise no persistence. | Available to any resumer without an additional checkpoint act. |
| Failure cost | A relay lost before executor start requires a replan; after start, normal executor checkpointing applies. | The post survives dispatcher/session death immediately. |
| Portability | Uses the host-neutral parent → cold child → parent → cold child primitive already required by Grove. | Requires a writable, authenticated task/change-request channel on every supported execution path. |
| Preconditions | Only a ratified artifact and an agent-launch path. | A task/change-request must already exist before implementation. |
| Project record | No permanent record for a successful transient optimization. | Every plan becomes permanent project history even though it is neither contract nor review evidence. |
| Writes/noise | Zero external writes on the ordinary path. | One additional external write per planned executor run, plus update/supersession conventions when a plan goes stale. |
| Auditability | Final code, tests, review findings, and any exceptional checkpoint remain auditable; the discarded working route does not. | The exact proposed route is auditable even when execution immediately disproves or abandons it. |
| Main risk | A narrow loss/recompute window between planner completion and executor/checkpoint. | Platform coupling, history noise, stale-plan ambiguity, and readers mistaking advisory prose for a governed artifact. |

### A. Direct dispatcher relay, checkpoint only when needed — chosen

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
rerun planning. The packet is working material, not durable evidence. This
accepts a small recomputation risk because no correctness or gate-clearance
claim rests on the packet.

### B. Always post the packet to a task/change-request — rejected

The plan is a clearly marked advisory comment, not a repo artifact.

**Benefits:** durable from the instant planning finishes, visible, naturally
available to run-resumer, and useful if exact plan-versus-execution comparison
is itself a product requirement.

**Costs:** assumes a task/change-request exists before implementation; adds
platform-coupled noise and a write for every plan; needs a stale/superseded
comment convention; turns a transient optimization into permanent project
history.

### Why A is recommended

The plan is deliberately neither a ratified artifact nor review evidence.
Grove's record-not-memory rule therefore does not need it to prove that a gate
cleared. Its only durability requirement is operational continuation, and
Grove already has a checkpoint/resume seam for exactly that need. Option A
keeps the common path host-neutral and write-free while paying persistence
only on the exceptional path that consumes it.

Option B would become preferable if the maintainer wanted **plan history itself** to
be a product capability: humans routinely inspect plans before execution,
post-hoc plan adherence is evaluated, or planning and execution commonly cross
asynchronous sessions. None of those requirements is established yet.

A temporary filesystem packet is not a competitive third option: it inherits
A's lack of durable project visibility while adding path, cleanup, lifetime,
and cross-host semantics. It remains available to the experiment harness for
capturing measurements outside the repo, but is not recommended as production
transport.

## D5 — when planning fires

### A. Every executor invocation — rejected

Simple and maximally consistent, but spends a planning call on non-code edits,
localized regressions, and trivial mechanical work.

### B. Every code-bearing spec → executor handoff — chosen

Code-bearing forward construction from a spec receives a plan. Decision-only
non-code work continues directly to executor.

For bugs, Grove's existing W3 classification supplies the boundary:

- **implementation slip, adequate spec:** the spec already states the expected
  behavior. If reproduction and root-cause work localize a bounded fix, the
  failing regression test may route directly to executor. If the slip spans
  components or still needs implementation decomposition, it remains
  code-bearing spec work and receives a plan; no false spec amendment is
  created merely to invoke the planner;
- **spec gap:** the expected behavior is real but absent. Amend and reconverge
  the spec first, then plan against the corrected contract; and
- **upstream decision wrong:** route to shaping before either planning or
  execution.

This is a semantic boundary already present in ADR-0005, not a token-count or
line-count threshold. It is observable and testable, preserves the rule that
implementation-slip regressions need not manufacture a spec change, and still
gives non-local bugs access to planning.

### C. Dispatcher judgment based on complexity — rejected

Potentially cheapest per task, but “complex enough” is not yet defined. It
creates selection bias in the experiment and recreates ADR-0005's parked,
ad-hoc size/stakes threshold.

## Proposed cold experiment

For each selected ratified spec and exact repository revision, prepare fresh,
isolated runs in randomized order:

1. **A — current baseline:** premium executor, no planner;
2. **B — downgrade control:** medium executor, no planner;
3. **C — planner treatment:** premium planner → medium executor.

Phase one uses three tasks spanning small/medium/large code-bearing work and
runs every arm once: nine cold runs. A preregistered futility rule decides
whether to stop; the pilot cannot adopt the role at this sample size. If it
continues, phase two adds two repetitions of every task/arm cell, producing 27
runs total. The planner arm always plans within the sample so routing
discretion cannot bias the result.

Phase one stops for futility when either:

- treatment C fails independent quality on at least two tasks for which
  baseline A passes; or
- treatment C reduces neither premium tokens nor weighted cost on any of the
  three tasks.

Every other phase-one result expands to 27 runs. The screen is deliberately
one-way: it avoids the full expense of an evidently poor treatment without
claiming that one run per task/arm cell is enough evidence to adopt it.

Measure:

- input/output/cached/reasoning tokens by role, premium tokens separately, and
  total tokens;
- a dated price snapshot, total cost, and cost per accepted completion;
- test/typecheck outcomes and independent conformance/code-review findings;
- retries, reviewer → executor loops, and elapsed time;
- invalid plan anchors, executor deviations with reasons, unused steps, and
  ambiguities caught before implementation.

After all 27 runs, treatment C may be adopted only if, across its nine runs, it:

- finishes at most one accepted-quality result behind baseline A;
- introduces no additional blocking independent-review finding;
- consumes at least 30% fewer premium-model tokens than A; and
- reduces weighted cost per accepted completion by at least 20% versus A.

It must also outperform control B sufficiently to show that the planner earned
its extra cold run; that last operational threshold remains open. Fewer total
raw tokens are desirable but not assumed.

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

- **Always post every plan to a task/change-request.** Rejected for the first
  increment in favor of D4: immediate durability does not justify an
  authenticated external write, permanent history noise, platform coupling,
  and stale-plan conventions when the packet is advisory and the existing
  checkpoint seam already covers interrupted work.
- **Use a temporary filesystem packet as production transport.** Rejected:
  inherits direct relay's lack of durable project visibility while adding
  path, ownership, cleanup, lifetime, and cross-host semantics. Out-of-tree
  files remain valid experiment evidence, not runtime transport.
- **Plan every executor invocation.** Rejected: it spends a planning call on
  decision-only non-code work and on bounded implementation slips for which
  reproduction and root-cause localization already supply the executable
  route.
- **Let the dispatcher decide whether work is “complex enough” to plan.**
  Rejected: no observable threshold exists, so the rule would introduce
  selection bias into the experiment and create an under-specified bypass
  around the planner.
- **Adopt from a fixed nine-run pilot.** Rejected: one run per task/arm cell is
  useful as a futility screen but too exposed to run variance to justify
  adoption.
- **Commit to all 27 runs before screening the treatment.** Rejected: it spends
  the full budget even when the first complete task/arm block already shows
  that the planner treatment is plainly unpromising. D6 retains the 27-run
  endpoint while preregistering the early-stop boundary.
- **Require treatment C to match every baseline-A quality result and save 40%
  of premium tokens plus 25% of weighted cost.** Not chosen: this strict
  package increases false rejection risk in a nine-run treatment sample.
- **Allow C to trail A by two quality results while saving only 20% of premium
  tokens and 10% of weighted cost.** Not chosen: this package can adopt a
  material quality regression for a modest efficiency gain.

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

Not yet run. The draft has three Open items and is not converged.
