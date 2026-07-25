---
id: adr-0034-pre-execution-planning
type: adr
status: gated  # scoped preview found D9's zero/zero remediation comparison undefined; revision remains open
depends_on: [adr-0004-spec-lifecycle-and-organization, adr-0005-tdd-and-artifact-gated-dispatch, adr-0012-methodology-delivery-machinery, adr-0026-thin-vendor-boundary, adr-0031-multi-host-distribution, adr-0033-adopt-family-plugin-contracts]
owner: agent
updated: 2026-07-25
---

# ADR-0034: pre-execution planning as an advisory cold role

> **Gated decision canvas — nothing here authorizes implementation.** The
> maintainer wants to test whether a stronger planning pass can make a
> lower-cost executor effective without weakening Grove's artifact authority,
> strict TDD, independent review, or dual-host delivery. The scoped adversarial
> preview confirmed the original routing, fleet, recovery, and resource
> revisions, then found one experiment gap and two graph/propagation omissions.
> Those are folded; the latest narrow preview found only D9's zero/zero
> remediation-comparison edge case.

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
  ordinary path performs no external write. If an identifiable
  task/change-request already exists and its checkpoint/resume seam fires, that
  checkpoint carries the packet or its validated remainder. Without such a
  carrier, loss before executor dispatch costs a replan, never a correctness or
  gate claim.
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
  completion by at least 20%. D9 separately makes the required advantage over
  medium-only control B testable.
- **D9 — require a material planner advantage over medium-only control**
  *(maintainer, 2026-07-24; chose Option A)*. Across nine runs per arm,
  treatment C must earn at least one more accepted-quality result than B or,
  when their accepted-quality counts tie, use at least 20% fewer total
  remediation dispatches. Planner retries, executor retries, and
  reviewer-return loops all count once in that total. Together with D8, this
  prevents adopting an extra premium planning call when medium execution alone
  already performs equivalently.
- **D10 — Grove owns portable resource intent; host adapters own concrete
  mapping** *(maintainer, 2026-07-24; chose Option A)*. Canonical dispatch
  metadata in `plugins/grove/roles.json` assigns the planner
  `reasoning-heavy` and the executor `execution-medium`;
  `plugins/grove/install/hosts.json` owns each versioned host default; and an
  optional consumer-owned `.grove/config.toml` override may replace that
  host's class mappings. The experiment harness pins and records the effective
  mappings. A surface that cannot honor or explicitly reject a class cannot
  silently substitute a model and claim support for the optimized route.
- **D11 — name the role `implementation-planner`** *(maintainer, 2026-07-24;
  chose Option A)*. This is the normative machine-readable role identity. Its
  specificity distinguishes implementation decomposition from Grove's
  interactive shaping role and from a host's generic planning mode.
- **D12 — declare planning triggers locally, never as dispatcher-owned flow**
  *(maintainer, 2026-07-24; chose Option A after adversary F1)*. The
  `implementation-planner` declaration triggers on code-bearing spec work; the
  executor declaration requires its advisory packet except for D5's localized
  implementation-slip route. The generic dispatcher discovers and enacts
  those declarations. No central pipeline or ADR-0012 exception is added.
- **D13 — derive fleet completeness from canonical inventory, with an exact
  release count** *(maintainer, 2026-07-24; chose Option A after adversary
  F2)*. This decision partially amends ADR-0031 §5 item 3: host-equivalence
  requires discovery of every role identity declared by the canonical
  inventory, while each release's evidence records and asserts the exact
  expected count. The first release containing `implementation-planner` must
  prove fourteen. A same-change forward annotation on ADR-0031 carries the
  append-only amendment.
- **D14 — do not require a task/change-request for relay recovery**
  *(maintainer, 2026-07-24; chose Option A after adversary F3)*. Existing
  checkpoint behavior is available only when the dispatched work already has
  an identifiable task/change-request. The planner route neither creates nor
  requires one. If no carrier exists and the transient relay is lost, the
  dispatcher cold-runs the planner again from the unchanged authoritative
  artifact and repository basis.
- **D15 — preregister accepted quality, bounded remediation, and cost
  arithmetic** *(maintainer, 2026-07-24; chose Option A after adversary F4)*.
  One experimental run includes its arm-defined base sequence and at most two
  additional remediation dispatches, classified without double-counting as a
  planner retry, executor retry, or reviewer-return loop. It is accepted only
  when all required tests/typechecks pass, conformance returns `PASS`, and code
  review has no blocking finding within that bound. Every triggered model call
  is priced from the dated provider snapshot; zero acceptances yields infinite
  cost per acceptance. A genuinely upstream-invalid task is replaced across
  all three arms.
- **D16 — use versioned adapter defaults plus consumer-owned overrides**
  *(maintainer, 2026-07-24; chose Option A after adversary F5)*. Role resource
  intent lives in `plugins/grove/roles.json`; concrete per-host defaults live
  in `plugins/grove/install/hosts.json`; and optional overrides live under
  `[resources.<host>]` in consumer-authoritative `.grove/config.toml`. An exact
  host override wins over its default. Missing classes, unknown selectors, and
  cross-host fallback fail before dispatch. Experiment and support evidence
  record the effective class-to-model map.
- **D17 — complete local gating and scoped adversarial preview before posting**
  *(maintainer, 2026-07-24; chose Option A)*. The shaper reruns the complete
  self-check and moves this decision to `gated`, then dispatches a scoped
  re-review of F1–F5 in the isolated clone. That session report is diagnostic
  only: once authentication is available, a fresh independent verdict must be
  posted on the change-request before ratification.
- **D18 — make configuration coupling and the operative dual-host spec
  explicit** *(shaper correction after scoped adversary F6/F7, 2026-07-24)*.
  ADR-0026 is a `depends_on` upstream because D16 relies on its
  consumer-authoritative configuration boundary. Before implementation,
  `specs/0004-dual-host-distribution.md` must be revised in place,
  version-bumped, and re-gated to replace every thirteen-role invariant and
  scenario with inventory-derived completeness plus the exact fourteen-role
  expectation for the first planner release.
- **D19 — planner retries share the two-dispatch remediation budget**
  *(maintainer, 2026-07-25; chose Option A after scoped adversary F4)*. A failed
  or unusable planner output may be cold-retried, but each retry consumes one
  of the same two remediation dispatches available to the whole run. It is
  classified as a `planner retry` and counts in D9. If the budget expires
  without an executable plan or accepted implementation, treatment C is
  unaccepted; every call still counts toward tokens, cost, and elapsed time.
  A planner-indicted upstream is excluded only through D15's matched,
  independently established upstream-invalid replacement rule.

### Open

- **O20 — zero-remediation comparison.** When B and C tie on accepted quality
  and both use zero remediation dispatches, define whether D9's planner-value
  criterion fails, passes, or uses a different absolute comparison; “20%
  fewer” is undefined at a zero denominator.

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
portable per-role model tier. D10 makes that tier intent part of the follow-up
contract without pretending it is already supported: the experiment harness
must pin exact models, and each host adapter must independently prove its
mapping before the optimized route is supportable there.

The ownership chain is explicit: `plugins/grove/roles.json` is the canonical
role-to-resource-class declaration; `plugins/grove/install/hosts.json` carries
Grove's versioned per-host defaults; and optional
`.grove/config.toml [resources.<host>]` entries are consumer-authoritative
overrides under ADR-0026 D3. Resolution never crosses hosts and never silently
falls back. The effective mapping is evidence, not hidden runtime state.

## `implementation-planner` role contract

The `implementation-planner` is cold-started and read-only.

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
| Recovery | If an identifiable task/change-request already exists and its resume seam fires, checkpoint the packet or its validated remainder; without one, rerun planning. | Available to any resumer without an additional checkpoint act. |
| Failure cost | A relay lost before executor start requires a replan; after start, normal executor checkpointing applies. | The post survives dispatcher/session death immediately. |
| Portability | Uses the host-neutral parent → cold child → parent → cold child primitive already required by Grove. | Requires a writable, authenticated task/change-request channel on every supported execution path. |
| Preconditions | A ratified artifact and an agent-launch path. A task/change-request is optional; without one there is no resumable carrier. | A task/change-request must already exist before implementation. |
| Project record | No permanent record for a successful transient optimization. | Every plan becomes permanent project history even though it is neither contract nor review evidence. |
| Writes/noise | Zero external writes on the ordinary path. | One additional external write per planned executor run, plus update/supersession conventions when a plan goes stale. |
| Auditability | Final code, tests, review findings, and any exceptional checkpoint remain auditable; the discarded working route does not. | The exact proposed route is auditable even when execution immediately disproves or abandons it. |
| Main risk | A narrow loss/recompute window between planner completion and executor/checkpoint. | Platform coupling, history noise, stale-plan ambiguity, and readers mistaking advisory prose for a governed artifact. |

### A. Direct dispatcher relay, checkpoint only when needed — chosen

The planner returns the packet as its bounded final output. The driving-session
dispatcher passes that output verbatim, alongside the authoritative artifact
pointer, into a separately cold executor invocation. The executor reopens the
artifact and verifies the packet's anchors before acting.

If the work already has an identifiable task/change-request and the existing
checkpoint/resume seam fires before or during execution, that checkpoint
carries the packet or its remaining validated steps. The planner route never
creates a task/change-request merely to gain this carrier.

If no such carrier exists, an interrupted relay is not resumable: the
dispatcher reruns the planner against the same authoritative artifact and
repository basis. This is recomputation, not recovery from hidden session
state.

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
cleared. Where an identifiable task/change-request already exists, Grove's
checkpoint/resume seam can carry it; where none exists, D14 deliberately buys
recomputation rather than a new durable carrier. Option A keeps the common path
host-neutral and write-free.

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

One run starts with the arm's first model invocation and ends when it earns an
accepted-quality result, exhausts its remediation budget, or reaches a terminal
failure. Its **base sequence** is the executor call for A/B and the
planner-then-executor calls for C. On top of that base sequence, every arm may
contain at most two remediation dispatches:

- a **planner retry** repeats a failed or unusable planner call before
  execution;
- an **executor retry** repeats execution after failure or unusable output
  before independent review; and
- a **reviewer-return loop** is one blocking independent-review result followed
  by a fresh executor remediation dispatch.

Each remediation dispatch receives exactly one classification, so D9's total
cannot double-count it. A failed or unusable planner may retry only while this
shared budget remains; exhausting it without an executable plan makes treatment
C unaccepted. A run earns one **accepted-quality result** only when, within the
two-dispatch bound, all declared required test and typecheck commands pass,
conformance returns `PASS`, and code review reports no blocking finding.
Reaching the bound without all three conditions is an unaccepted run.

Weighted cost is the sum, across every planner, executor, reviewer, and
remediation model call triggered by the run, of each reported token category
multiplied by its dated provider price (including a distinct cached-token rate
where the provider publishes one). Cost per accepted completion is total arm
cost divided by its accepted-quality count; a zero count is positive infinity,
never omitted or coerced to zero.

If independent review establishes that the ratified upstream itself is invalid
rather than an arm failing to implement it, the matched task is removed from
all three arms and replaced with a preregistered task from the same size
stratum. No single arm receives a selective exclusion.

After all 27 runs, treatment C may be adopted only if, across its nine runs, it:

- finishes at most one accepted-quality result behind baseline A;
- introduces no additional blocking independent-review finding;
- consumes at least 30% fewer premium-model tokens than A; and
- reduces weighted cost per accepted completion by at least 20% versus A.

Against medium-only control B, C must earn at least one additional
accepted-quality result or, when accepted-quality counts tie, use at least 20%
fewer total remediation dispatches. Each planner retry, executor retry, or
reviewer-return loop counts once. Fewer total raw tokens are desirable but not
assumed.

## Consequences and propagation if approved

This decision would authorize a follow-up spec before implementation. That
contract would cover:

- the canonical planning-role charter and generated host projections;
- the exact packet grammar and stale/conflict behavior;
- local planner/executor trigger declarations and generic dispatcher enactment,
  including verbatim relay behavior;
- executor authority/verification wording;
- checkpoint/resume behavior;
- the three-arm experiment harness and retained out-of-tree evidence;
- role-inventory resource intent, host-default maps, consumer override schema,
  and fail-loud resolution;
- an explicit revise-in-place, version-bump, and re-gate of
  `specs/0004-dual-host-distribution.md`, replacing every thirteen-role
  contract point with inventory-derived completeness and the first
  fourteen-role expectation;
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
- **Require C both to gain a quality result over B and to cut its return loops
  by 20%.** Not chosen: either a material quality gain or a material workflow
  gain is enough to show planner value; requiring both would discard one kind
  of successful treatment.
- **Accept any measurable improvement over B.** Not chosen: a one-off token or
  timing fluctuation does not justify adding a premium planning call.
- **Leave all model selection to consumers and the experiment harness.** Not
  chosen: Grove would have no portable way to preserve the resource asymmetry
  whose value the experiment is testing, so host configurations could silently
  erase the optimization.
- **Pin exact host-specific model names in the canonical role contract.** Not
  chosen: concrete names would couple the one authored kernel to provider
  catalogs and model churn. Exact selections belong in adapter/runtime mapping
  and reproducible support evidence.
- **Name the role `execution-planner`.** Not chosen: it can be read as planning
  orchestration or execution generally rather than decomposing an approved
  contract for implementation.
- **Name the role `planner`.** Not chosen: the generic identity is easily
  confused with host plan modes and does not state the role's bounded subject.
- **Make the planner route a dispatcher-owned workflow branch.** Rejected
  after adversary F1: ADR-0012 requires routing to emerge from local
  agent/artifact declarations so adding an agent does not edit a central flow.
- **Replace ADR-0031's hardcoded thirteen with hardcoded fourteen.** Rejected
  after adversary F2: it repairs this release but requires another standing-ADR
  amendment for every future role addition. Inventory-derived completeness
  keeps the rule stable while exact release evidence still catches omissions.
- **Require a task/change-request before every planned execution.** Rejected
  after adversary F3: reliable crash recovery would require eagerly posting
  the plan, recreating the durable-write path rejected by D4. The chosen route
  accepts rare replanning without adding a platform/authentication precondition
  to every successful run.
- **Allow only one remediation dispatch per experiment run.** Not chosen after
  adversary F4: it is cheaper but makes one stochastic miss dominate a small
  task/arm sample.
- **Allow three remediation dispatches per experiment run.** Not chosen after
  adversary F4: it raises and varies the maximum spend while letting repeated
  repair obscure whether the original planning treatment helped.
- **Ship adapter defaults with no consumer override.** Not chosen after
  adversary F5: it is reproducible but prevents a consumer from selecting an
  available model that satisfies the same portable resource intent.
- **Require every consumer to provide every concrete mapping.** Not chosen
  after adversary F5: it removes Grove's versioned default behavior and makes a
  missing project configuration block otherwise supported dispatch.
- **Make the first failed planner call immediately fail treatment C.** Not
  chosen after scoped adversary F4: it gives the additional stage no bounded
  recovery from a stochastic failure even though every other failed call can
  consume the shared remediation budget.
- **Give the planner one separate retry in addition to two executor
  remediations.** Not chosen after scoped adversary F4: it raises treatment C's
  maximum call budget and makes the arm comparison structurally uneven.

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

The self-check recorded at commit `0ae6a48` is stale. Scoped independent
preview confirmed routing, fleet amendment, recovery, resource ownership,
planner-failure scoring, ADR-0026 coupling, and `spec-0004` propagation closed.
It returned `NEEDS-REVISION` only because D9 leaves a zero/zero remediation
comparison undefined (O20).

The canvas has nineteen Decided items and one Open item. It remains `gated`
with the failed preview disclosed, but is not ready for the intent gate.
Resolve O20, rerun the self-check, and obtain one narrow re-review. Session
previews remain diagnostic until posted on an authenticated change-request.
