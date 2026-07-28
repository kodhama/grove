---
id: research-rule-delivery-and-activation
type: research
status: recorded  # reviewless type; informs, never decides. Supersede with a newer research doc.
depends_on: []
informed_by: [research-orchestrator-patterns, adr-0003-managed-block-routing-rule, adr-0026-thin-vendor-boundary, adr-0031-multi-host-distribution]
owner: agent
updated: 2026-07-28
---

# research: how orchestration rules reach a session — activation, delivery, and compaction

**Complements, does not supersede, `research/orchestrator-patterns.md`.** That note asks
how frameworks *structure* an orchestrator. This one asks a narrower and more
mechanical question: **how do the orchestrator's rules get into a session at all,
and do they stay there?**

Commissioned 2026-07-28 after two grove delivery attempts failed — the managed
`CLAUDE.md` block and a `SessionStart` hook — and the maintainer proposed
voluntary entry instead (*"a `/grove:start` skill that loads the dispatch rules,
and from then on the running agent knows what to do"*). The brief was to test that
hypothesis, not to support it.

## The finding that decides most of it

**A plugin structurally cannot ship always-on context.** Claude Code's plugin
reference:

> A `CLAUDE.md` file at the plugin root is not loaded as project context. Plugins
> contribute context through skills, agents, and hooks rather than CLAUDE.md.
> **To ship instructions that load into Claude's context, put them in a skill.**

There is no `rules` component in the plugin manifest schema. The documented set is
skills, agents, hooks, MCP servers, LSP servers, monitors, themes.

So grove's two attempts were not unlucky implementations of a viable idea. The
managed block worked only because it wrote into the *consumer's* repository, and
that ownership is what made it fragile (see `adr-0026` D4, and issues #164, #169,
#170). Anything a plugin distributes must be invoked.

## What survives compaction — primary source, quoted

| Mechanism | After compaction |
|---|---|
| System prompt and output style | Unchanged; not part of message history |
| Project-root `CLAUDE.md` and **unscoped** rules | **Re-injected from disk** |
| Auto memory | Re-injected from disk |
| Rules with `paths:` frontmatter | **Lost** until a matching file is read again |
| Nested `CLAUDE.md` in subdirectories | Lost until a file in that subdirectory is read again |
| **Invoked skill bodies** | **Re-injected, capped at 5,000 tokens per skill and 25,000 tokens total; oldest dropped first** |
| Hooks | Not applicable; hooks run as code, not context |

Two follow-on statements from the same page:

> Truncation keeps the start of the file, so put the most important instructions
> near the top of `SKILL.md`.

> If a rule must persist across compaction, drop the `paths:` frontmatter or move
> it to the project-root `CLAUDE.md`.

**This corrects the premise the maintainer proceeded on.** "If it doesn't survive
compaction, that's ok" understates the mechanism: an invoked skill body *does*
survive, with hard and designable limits. A refresh skill becomes a backstop
rather than the primary path.

**Design constraints that follow directly**, if grove adopts `/grove:start`:

1. Dispatch rules must fit the **first 5,000 tokens** of `SKILL.md`.
2. The most load-bearing rules go at the **very top**, because truncation keeps
   the start.
3. The **number of grove skills invoked per session is a budget** — 25,000 total,
   oldest dropped first. A session that invokes a dozen role skills evicts
   `/grove:start` precisely in the long sessions where it matters most.

## The activation survey

The split that explains the whole landscape: **systems that own their system
prompt can do always-on trivially; systems layered on a host they do not own are
uniformly command-initiated.**

| System | Entry | Always-on injection? | What drives the next step |
|---|---|---|---|
| **SpecSwarm** | `/ss:go` | No — `SessionStart` emits one line of *state* | **Stop hook** blocks stop, names the next slash command |
| **BMAD-METHOD** | slash command loads persona | Migrating *away* from `.clinerules` → workflows | persona menu triggers |
| **rpikit** (RPI as a plugin) | `/rpikit:research-plan-implement` | No | approval gates between phases |
| **HumanLayer RPI / ACE-FCA** | human runs each phase | No | compacted artifact handed to a **fresh context window** |
| **Claude Code skills** | `/name` or model-invoked | description only; body on invoke | model decides |
| **Claude Code `.claude/rules/`** | automatic | **Yes** if unscoped | standing constraints |
| **Cline** | rules automatic; workflows `/name.md` | both, explicitly separated | workflow injected into one message |
| **Roo Code / Aider** | mode selection | yes *within* a mode — they own the prompt | mode chaining |
| **OpenHands** | microagent trigger `always`/`keyword`/`manual` | **Yes for `always`** — but repo-resident, not distributed | model-driven |
| **OpenAI Swarm / LangGraph / CrewAI / AutoGen** | program invocation | n/a — no ambient session | handoff tool call / graph / manager |

**No plugin-class system was found doing always-on orchestration injection.**
OpenHands is the one genuine always-on case and it is repo-resident — the
equivalent of grove's managed block, with the same ownership properties.

Corroborating: Anthropic's own `/deep-research` **lost** auto-activation in
v2.1.218 (*"runs only when you invoke it"*), and BMAD is moving its Cline
integration off always-on rules onto invoked workflows.

## SpecSwarm, read properly — the borrowable architecture

`plugins/ss/hooks/hooks.json` registers four events: `Setup`, `SessionStart`,
`PostToolUse`, `Stop`. The orchestration lives in the **Stop** hook.

`go-loop-hook.sh` reads `.specswarm/go-loop.state`, checks whether the current
phase's artifacts exist, and if the loop is active but the phase is not done,
**blocks the stop and returns the next slash command to run**. Its own header:

> Drives the /ss:go full ladder: specify → clarify → decisions → plan → tasks →
> implement (preflight + slice gates + verify drain) → retrospective → done.

**Per-phase rules are never resident.** Each phase's rules arrive when its command
is invoked, so compaction is a non-issue by construction.

Its `SessionStart` hook (`orientation-hook.sh`) emits **one line of state** —
*"🔄 SpecSwarm: <feature> (phase: implement) [active]"* — and is silent when no run
is active. **SpecSwarm never attempted what grove attempted.**

Transferable: the Stop-hook continuation loop; a state file as cursor; gate
predicates as **artifact-existence checks** rather than model self-report; the
conditional one-line orientation primer.

Not transferable: SpecSwarm's ladder is a fixed linear phase list in a bash
`case`. Grove routes ~14 roles on a graph; that logic wants a script or a
workflow, not bash.

## The `.claude/rules/` option, and what it costs

Raised by the maintainer as a possible successor to `.trellis/`. Mechanically it
is the strongest persistence available: **unscoped rules are re-injected from disk
after compaction**, exactly like `CLAUDE.md`, without editing the consumer's own
instruction file.

Three costs, stated so the trade is visible:

- **Claude-only.** Trellis and grove are both dual-host. Codex needs a separate
  mechanism, so this cannot be a single delivery path.
- **It is a consumer-side file.** That is the same ownership class `trellis/decision-0065`
  removed on purpose (*"the consumer holds no copy, so no copy can drift"*), and
  the class that produced grove #164/#169/#170. The mechanism is better; the
  ownership problem is unchanged.
- **Unscoped means always in context**, on every message. `paths:`-scoped rules are
  cheaper but are **lost at compaction until a matching file is read** — which
  defeats the purpose for standing rules.

## An inference about trellis, flagged as inference

Trellis's hook declares `"matcher": "startup|resume"` (`plugins/trellis/hooks/hooks.json`).
`SessionStart` also supports `compact`, `clear` and `fork`. Hook-injected
`additionalContext` enters message history, and compaction summarizes message
history away.

**So trellis's injected rules are plausibly lost at compaction and never restored**,
because nothing re-fires. This is a three-step inference from verified facts, not a
measurement. If it holds, the fix is one line — add the missing matchers. It is
worth measuring before relying on it either way.

## What grove already decided about the adjacent option

`adr-0003` §Considered and rejected does not merely prefer the block — it rejects
the nearest neighbour of the new direction, with evidence:

> **Drop the block and rely on agent descriptions alone.** The unreliable pole —
> #5688 documents proactive-directive descriptions being ignored outright.

Its Context cites `anthropics/claude-code#5688` (*"Subagent Selection Failure:
Primary Agent Ignores Proactive Directive"*) and concludes *"Nobody achieves
inferred workflow dispatch from agent descriptions alone."*

**This bears directly on how `/grove:start` is exposed, and it is a fork, not a
detail.** A Claude Code skill is model-invocable by its `description` unless
`disable-model-invocation: true` is set:

- **Model-invocable `/grove:start`** — grove is entered when the model infers it
  should be. That is inferred dispatch from a description, which is exactly what
  `adr-0003` rejected on evidence. The rejection would need answering, not
  ignoring.
- **User-invocable only** — grove is entered when a human types it. `adr-0003`'s
  rejection does not apply, because nothing is inferred. The cost is that a
  session which never ran it is indistinguishable from one that did (BMAD#1618 is
  the canonical version of that confusion, still open).

Anthropic's own guidance leans the same way: disable model invocation *"for
workflows with side effects or that you want to control timing"*. A dispatcher
that sequences gates has side effects.

## Open questions

1. **After compaction re-injects a truncated skill body, does re-invoking that
   skill re-append the full content, or does it hit the "already loaded" dedup?**
   This decides whether a `/grove:refresh` skill is real or a placebo. The
   documented lever is dynamic context injection (`` !`command` ``) so the render
   differs. **Measurable in an afternoon; measure before designing on it.**
2. **Do trellis's hook-injected rules survive compaction?** See the inference
   above. Same probe answers both.
3. **Is SpecSwarm's `plugins/ss/rules/` loaded at all?** No `rules` component
   exists in the plugin schema, and its frontmatter key is `globs:` where Claude
   Code documents `paths:`. If it is dead surface, the pattern is not borrowable.
4. **Was grove's objection to the managed block about the mechanism, or about
   editing `CLAUDE.md` specifically?** `.claude/rules/` answers the second and not
   the first. Only the maintainer can settle this, and it changes what is on the
   table.
5. **Should the gate sequence be in context at all?** SpecSwarm's answer is no —
   the Stop hook holds it and each phase's rules arrive with its command. If grove
   adopted that, the compaction question largely dissolves and `/grove:start`
   becomes much smaller.

## A claim recorded with its contradiction

`claude-code#16538` — *"Plugin SessionStart hooks don't surface
`hookSpecificOutput.additionalContext` to Claude"*, with the same hook working from
`~/.claude/settings.json`. **Closed as not planned.** Verified by reading the issue.

**But it is contradicted by direct observation in this family**: `kodhama/stewards`
registers no `SessionStart` hook in project or user settings — only the trellis
plugin's — and trellis's staleness nudge was observed reaching the model on CLI
2.1.220 on 2026-07-28. Either the bug is version-specific and since fixed, or the
observation is wrong.

Recorded rather than resolved. **The case for command-initiated delivery does not
rest on this issue** — it rests on the plugin-schema fact and the convergence
above. Grove's hook never failed; grove never shipped one.

## Sources (primary)

- Claude Code plugins reference — https://code.claude.com/docs/en/plugins-reference
- Claude Code skills — https://code.claude.com/docs/en/skills
- Claude Code context window / compaction — https://code.claude.com/docs/en/context-window
- Claude Code memory — https://code.claude.com/docs/en/memory
- Claude Code workflows — https://code.claude.com/docs/en/workflows
- SpecSwarm — https://github.com/MartyBonacci/specswarm (`plugins/ss/hooks/hooks.json`,
  `go-loop-hook.sh`, `orientation-hook.sh`, `skills/ss-build/SKILL.md`)
- claude-code#16538 — https://github.com/anthropics/claude-code/issues/16538
  (also #13650, #11509, #11906, #9455 on the same channel)
- BMAD#643 (Cline rules → workflows), BMAD#1618 (agent-load ambiguity)
- Cline — *Stop Adding Rules When You Need Workflows* — https://cline.bot/blog/stop-adding-rules-when-you-need-workflows
- HumanLayer ACE-FCA — https://github.com/humanlayer/advanced-context-engineering-for-coding-agents
- OpenHands microagents, Roo Code Boomerang, Aider chat modes, OpenAI Swarm,
  LangGraph persistence, CrewAI crews — see the survey table

**Not found:** "RPI-Team" / "CGM". The maintainer has confirmed it is internal to
CGM and will bring the brief back themselves. Recorded so nobody searches again.
