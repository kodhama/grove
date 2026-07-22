---
id: research-orchestrator-patterns
type: research
status: recorded  # research is a reviewless type (charter-dispatcher: research "owes nothing" — it informs, never decides), so it sits OUTSIDE the draft→gated→approved ratchet. charters/lifecycle.md's enum does not formally cover `research` — a minor gap flagged for follow-up (extend the enum, or declare research enum-exempt). "recorded" = captured as-is; supersede with a newer research doc.
depends_on: []
informed_by: [charter-dispatcher, adr-0026-thin-vendor-boundary]
owner: agent
updated: 2026-07-22
---

# research: how multi-agent frameworks implement the "orchestrator" pattern

> Reviewless research artifact (informs, never decides). Produced by a
> deep-research pass, 2026-07-22, to inform grove#130 (the `grove:dispatcher`
> agent's v0 fate) and grove's orchestration design generally. Also posted at
> grove#130. **Method:** 6 search angles → 25 sources fetched → 122 claims →
> 25 verified by 3-vote adversarial check (24 confirmed, 1 refuted).

**Coverage caveat, up front:** only **Anthropic's patterns** and
**LangGraph/LangChain** produced claims that survived verification. The
question also named CrewAI, AutoGen/Magentic-One, OpenAI Agents SDK/Swarm,
Google ADK, LlamaIndex, and Temporal — the searches *found* their docs, but
their specific mechanism claims did not survive the verifier or were
budget-dropped. Treat the two verified ecosystems as high-confidence; the rest
as "named, not verified here" (a follow-up pass would close this).

## The black-box model, mechanically

"Fire one task → orchestrator builds + reviews → returns, asking only
occasionally" is the **agents-as-tools / orchestrator-workers pattern run
autonomously.** The seven mechanisms:

1. **Decomposition is orchestrator-driven and *dynamic*** (Anthropic). A lead
   LLM breaks the task into subtasks *at runtime* — *"subtasks aren't
   pre-defined, but determined by the orchestrator based on the specific
   input."* Each worker gets an **explicit spec** ("an objective, an output
   format, guidance on the tools and sources to use, and clear task
   boundaries"), and worker count **scales to complexity** (1 for a lookup,
   2-4 for a comparison, 10+ for complex work). The calling code does not
   pre-code the sub-tasks.

2. **Routing = tool selection or LLM classification**, splitting into **three
   architectures**:
   - **Agents-as-tools (supervisor):** sub-agents are exposed to the supervisor
     *as callable tools*; a tool-calling model picks which to invoke —
     *"the supervisor can also be thought of an agent whose tools are other
     agents"* (LangGraph).
   - **Graph / state-machine (LangGraph):** agents are **nodes**, edges carry
     control flow, communication is through a **shared state object**; routing
     is *conditional edges* on the LLM's output.
   - **Handoffs:** control *transfers* between peer agents (`create_handoff_tool()`)
     rather than returning to a boss.

3. **Parallel execution is fan-out/fan-in with a *blocking join*** (Anthropic +
   LangGraph). The lead spawns 3-5 subagents in parallel but *"execute[s]
   subagents synchronously, waiting for each set… to complete before
   proceeding"* — a hard barrier. LangGraph: `Command(goto=...)` for one, a
   **list of `Send` objects** for parallel fan-out. (Anthropic flags async as
   roadmap-but-unsolved — may change.)

4. **Aggregation = summary-passing, not shared context** (Anthropic). Each
   worker "might explore extensively, using tens of thousands of tokens… but
   returns only a condensed, distilled summary (often 1,000-2,000 tokens)";
   the lead synthesizes those. Detailed context stays **isolated in the
   worker** — keeps the orchestrator's context small and scales parallelism.

5. **Review-before-return = the evaluator-optimizer loop** (Anthropic,
   canonical). "One LLM call generates a response while another provides
   evaluation and feedback in a loop" — a *generator* and a *distinct
   evaluator* iterate against fixed criteria, **typically 2-4 cycles**.
   **Refuted (0-3):** a claim that Anthropic's research system runs a dedicated
   *CitationAgent + LLM-as-judge* verification stage did **not** survive — the
   confirmed review mechanism is the generator/evaluator loop, not a separate
   proven verification stage.

6. **Shared state — two opposing models.** LangGraph = a **shared blackboard**
   (one graph-state TypedDict all nodes read/write). Anthropic = **context
   isolation** (private worker context windows; only distilled summaries flow
   up). Centralize-to-coordinate vs partition-to-scale.

7. **Human-in-the-loop "only occasionally" is by construction** (LangGraph).
   `interrupt()` — or middleware that fires **only when a proposed tool call
   matches an approval policy** (non-matched calls run un-gated) — halts the run
   mid-execution, **persists state to a checkpointer, waits indefinitely**, and
   resumes when re-invoked with `Command(resume=...)`. A true mid-run halt, not
   per-step gating.

   **Durability substrate = the checkpointer/persistence layer.** It stores
   state across the interrupt so a paused run resumes; HIL is impossible without
   it (LangGraph errors without a checkpointer); production uses
   `AsyncPostgresSaver`/`MongoDBSaver`. (Temporal-style external durable
   execution was searched but produced no verified claims here.)

## Named frameworks (verified vs. found-but-unverified)
- **Anthropic orchestrator-workers + evaluator-optimizer** — verified (source of most of the above).
- **LangGraph** — verified (supervisor graph, `Send` fan-out, `interrupt()`+checkpointer, shared TypedDict state).
- **Found in sources, not verified here:** Magentic-One (an Orchestrator with a two-loop **Task Ledger** + **Progress Ledger**), OpenAI Agents SDK (LLM-orchestration-via-handoffs vs orchestration-via-code), CrewAI hierarchical manager-agent, Temporal (durable-execution replay), Google ADK, LlamaIndex AgentWorkflow.

## How this maps to grove
- grove is the **graph/state-machine family made human-interactive**: the "graph"
  is the dispatcher's sequencing, the "shared state" is the artifacts + findings
  ledger, the "checkpointer/interrupt" is the **gate profile + PRs** (grove's
  human `ship`/`intent` gates *are* LangGraph-style interrupts, human-authored),
  and "review-before-return" is grove's adversary/conformance convergence —
  structurally the **evaluator-optimizer loop** with independent reviewers.
- A fully-autonomous **black-box framework** is the **agents-as-tools family run
  autonomously** — orchestrator LLM decomposes, fires workers, evaluator-optimizer
  gates, returns; human only on policy-matched interrupts.
- **Bearing on grove#130:** neither verified framework makes the orchestrator a
  *cold one-shot sub-agent* — the orchestrator is either live graph-runtime state
  (LangGraph) or a lead-LLM-in-the-loop (Anthropic). That is exactly why grove's
  `grove:dispatcher` agent sits idle. The **evaluator-optimizer + policy-matched
  interrupt** mechanisms are the concrete things worth borrowing for option (c)
  (a dispatch-time self-check firing only at real forks).

## Sources (primary)
- Anthropic — Building Effective Agents; Multi-Agent Research System; Effective
  Context Engineering for AI Agents; the Architecture Patterns & Implementation
  Frameworks PDF.
- LangChain/LangGraph — Interrupts; Router (multi-agent); langgraph-supervisor
  reference; Human-in-the-Loop; the multi-agent-workflows blog.
