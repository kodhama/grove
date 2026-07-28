---
id: research-work-transfer-and-join-mechanics
type: research
status: recorded  # reviewless type; informs, never decides. Supersede with a newer research doc.
depends_on: []
informed_by: [research-rule-delivery-and-activation, research-orchestrator-patterns, adr-0046-how-dispatch-rules-reach-a-session]
owner: agent
updated: 2026-07-28
---

# research: how comparable systems transfer work, and how they join

Second pass, commissioned 2026-07-28 while shaping `adr-0046`. The first note
(`research-rule-delivery-and-activation`) covered **activation** — how rules reach
a session. This one covers **orchestration and work-transfer mechanics**: what
carries work between roles, how routing is encoded, and what waits at a join.

The case that drove it, from the maintainer: *code change → conformance review ∥
code review → merge gate.* Fork to two, join before continuing.

## Answer first

**Nobody in the coding-agent space ships a Petri net.** The formalism appears only
in research and in one vendor's advocacy. What the field converged on for this
exact case is a **DAG with an explicit join operator plus artifact-derived
gates** — and the join real teams actually rely on is **git forge branch
protection**: N required status checks and M approvals before merge.

Three mechanics are worth taking, and all three are small:

1. **The ready-set rule as the only dispatch primitive** — *pending ∧ all
   dependencies satisfied*. Task Master's `next`, beads' `bd ready`.
2. **An explicit join policy per join** — `all_of` / `any_of`. Conductor requires
   a `joinOn` list or *"workflow registration will fail"*; Argo's `depends` is a
   boolean expression (`"conformance.Succeeded && codereview.Succeeded"`). The
   workflow-engine world's scar tissue says **the bugs live in the implicit join.**
3. **Atomic claim on the work record** to prevent double dispatch — beads'
   `bd update <id> --claim`, agent-traffic-control's assignee + `wip` label with a
   24-hour stale sweep.

## The finding that most supports a decision already taken

Systems that advance on **evidence artifacts** do not suffer the state-desync
that systems advancing on **agent-written markers** do. Two cautionary cases,
both directly about a cursor:

- **Kiro #8859** — the IDE marks a task `[-]` (in progress) *before* dispatching;
  the agent then reads the file, *"sees `[-]`, and refuses to execute the task."*
  Two components disagreed about whether the marker meant *claimed by me* or
  *claimed by someone else*. The run stopped dead.
- **claude-flow #1397** — *"no execution engine exists: MCP tools perform JSON
  CRUD on registry files, but nothing spawns a Claude subprocess."* Agents
  registered `idle`, health 1, zero work done. **The state store said the role was
  dispatched; nothing had been.**

That is empirical support for `adr-0046`'s *places derived from artifacts, never
agent claims* — and a direct warning about the committed cursor it also adopted.

## Comparison — the systems that answer the question

Full table in the source pass; the entries that carry information for grove:

| system | handoff carrier | routing | join |
|---|---|---|---|
| **MetaGPT** | `Message` on a shared pool, tagged `cause_by` | **`self._watch([SimpleWriteCode])`** — a role declares a precondition on message *provenance* and fires when a match appears | **none** — fires on *any* match; no conjunction |
| **Kiro** | checkbox in `tasks.md` | fixed 3-phase | **waves** — a bulk-synchronous barrier, not a per-join condition |
| **Task Master** | `tasks.json` rows with `dependencies` | ready-set rule | none; completion just unblocks |
| **beads** | graph issue records, typed edges | `bd ready` | none; atomic claim prevents double-dispatch |
| **loki-mode** | gate verdicts + **evidence receipts** under `.loki/proofs/<run_id>/`, separating *"deterministic FACTS"* from *"AI ASSESSMENTS"* | gate-driven loop | **blind 3-reviewer council in parallel** with severity blocking — **aggregation rule undocumented** |
| **Copilot coding agent** | issue → draft PR | platform pipeline | **branch protection / required checks / merge queue** |
| **VoltAgent** | function handoff | `createWorkflowChain` | **`andAll`** — starts together, waits for all, merges results; any failure fails the whole |

**MetaGPT's `_watch` is the closest existing thing to `adr-0046`'s transition
rules** — a place/transition shape without the vocabulary. Its weakness is the one
grove would inherit: **no conjunctive precondition.** "Fire when both reviews are
present" needs an extra role that counts.

**loki-mode is the only coding-agent system found running grove's exact
fork/join** — three reviewers, concurrent, blind to each other. **Its aggregation
rule is not documented**, which is itself the finding: the hard part — quorum,
disagreement, one-reviewer-fails — is where these systems go quiet.

## The Petri-net question, answered honestly

**Coding agents: nobody.** What exists:

- **TB-CSPN** — colored Petri nets for the coordination layer only, LLMs confined
  to semantic processing. Claims large speedups. **Maturity check: the reference
  implementation is 26 commits and 1 star**, and the primary paper was unfetchable
  (403). Treat the numbers as a self-reported micro-benchmark.
- **Agentproof** — static verification of agent workflow *graphs*, naming the
  lineage: *"Van der Aalst's work on Petri-net-based soundness checking… ensures
  that every case can complete and no dead transitions exist."* Six predicates,
  including **human-gate coverage** (sensitive tools must be preceded by a human
  approval node) — which is grove's intent floor, independently arrived at.
- **HASH** is the only vendor arguing for it publicly, with no evidence of
  production deployment. `@statelyai/agent` (statecharts on XState) is alpha and
  *"not ready for production."*

**The traffic runs the other way.** Camunda 8.7/8.8 added an **AI Agent task** on
a BPMN ad-hoc sub-process where *"tasks can be activated dynamically, removing
requirements for modeling task sequence, task order or task completion"* — a
mature workflow engine deliberately **weakening its own sequencing** to host an
agent. The mirror image of the question grove is asking.

**Borrowable at grove's size:** the vocabulary, and two cheap soundness checks —
*can every run reach a terminal place* (exit reachability) and *is any transition
dead* (a role that can never fire). Both trivial over 14 roles.

**Over-engineering at grove's size:** colored tokens, typed arc inscriptions, full
reachability analysis, inhibitor arcs, a generic net interpreter. Conductor and
Argo earned their machinery at thousands of concurrent instances with retries,
timers and compensation. Grove has a per-run cursor in git.

**One borrowable from Temporal rather than the net world:** split **deterministic
orchestration** from **non-deterministic side effects** — *"the workflow performs
no I/O, no LLM calls, and no non-deterministic logic."* Mapped onto grove: rule
evaluation over the cursor must be pure and replayable; the agent invocation is
the activity. That is what makes a committed cursor *auditable* rather than merely
stored.

## Failure modes, with the ones that bite grove's design first

**Two concurrency hazards for a git-committed cursor**, both from engines with
decades of the problem:

- **Optimistic-lock collision at the join.** Camunda hits this when both branches
  reach the join simultaneously. **Two reviewers finishing at once both write the
  join postcondition** — a git-committed cursor has the same race, without the
  database's lock.
- **Silent skip propagation.** Airflow #12102 and #14319: a join with the naive
  rule *skips* when an upstream is skipped, and Argo #13498 reports *"unexpected
  Workflow success status"* when `continueOn` meets `dependencies`. **If a review
  can ever be waived or marked N/A, grove must decide now whether `skipped`
  satisfies the merge gate** — this is the "gate passed because nothing ran"
  family, which is also grove's vacuity-detection concern.

**Empirical base rate.** MAST (1,642 traces, 7 frameworks) gives 14 failure modes
in 3 categories — system design 43.8%, inter-agent misalignment 32.15%, task
verification 23.5%. The ones that map onto dispatch: *unaware of termination
conditions* 12.4%, *step repetition* 15.7%, *no or incomplete verification* 8.2%,
*incorrect verification* 9.1%, *premature termination* 6.2%. **Source conflict
flagged:** secondary write-ups quote 41.8/36.9/21.3; the paper says the above.

## The dissent, and why it reads in grove's favour

Cognition's *"Don't Build Multi-Agents"* argues fan-out is the defect source:
subagents *"won't have each other's ongoing intermediate decisions or
assumptions"*, so *"the writes, the actions that change state, should stay
single-threaded"* while read-only analysis can fan out.

**Grove's fork is two read-only reviewers over a frozen artifact — the case
Cognition explicitly permits.** That is the strongest external support found for
the design, and it arrives from its loudest critic.

## Open questions

1. **Does `skipped` satisfy the merge gate?** Airflow's and Argo's scar tissue
   says this must be decided explicitly, not defaulted.
2. **What happens when two reviewers finish simultaneously** and both write the
   join postcondition to a git-committed cursor?
3. **What is loki-mode's reviewer aggregation rule?** The only comparable
   fork/join in the space, and it is undocumented. Would need the source.
4. **Is the ready-set rule sufficient**, or does grove need conjunctive
   preconditions that MetaGPT's `_watch` lacks? The merge gate suggests the latter.

## Sources

Primary, cited in full in the pass. Load-bearing ones: github/spec-kit,
Kiro docs + issue #8859, claude-task-master, beads, agent-traffic-control,
loki-mode, MetaGPT `multi_agent_101`, Conductor Fork/Join, Argo enhanced-depends
+ #13498, Airflow trigger rules + #12102/#14319, Camunda inclusive gateway +
#13070 + 8.8 release notes, Temporal for AI, Cognition's *Don't Build
Multi-Agents* and *Devin can now Manage Devins*, Copilot coding agent + branch
protection + merge queue docs, VoltAgent `andAll`, MS Agent Framework handoff,
Agentproof (arXiv 2603.20356), MAST (arXiv 2503.13657), scheduler-theoretic
framework (arXiv 2604.11378), TB-CSPN + `Aribertus/tb-cspn-poc`, HASH.

**Verification caveats, recorded rather than smoothed:** several fetches returned
tool summaries rather than raw pages (Kiro docs, loki-mode README, Devin blog,
MetaGPT docs); TB-CSPN's primary paper 403'd on two hosts; loki-mode's gate count
is stated as 8, 9 and 11 in three places; Continue.dev's status is from a review
site, not a primary announcement; AgenticFlict's numbers could not be extracted
from the PDF and are therefore not quoted.

**Not searched:** the maintainer's private reference framework — they are
bringing the comparison themselves.
