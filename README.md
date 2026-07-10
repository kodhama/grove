# grove

**Grove** is a portable agent-swarm operating model: chartered roles
("grove agents"), workflows, and a dispatch contract, distributed as
markdown charters + Claude Code agent definitions + a skill — **no
binary, no service**. The name is the druids' own: a grove is a
community of trees — and, in the druidic orders, the name of the
community itself. It grows along a
[Trellis](https://github.com/kodhama/trellis) (the governance layer
this repo overlays), keeping the family's founding image: *a grove
trained along a trellis*. The agents are **grove agents** — the grove
is what they tend, and what they are; informally, and with real
affection, its druids.

This repo is the **reference implementation and distribution home**. A
consuming project adopts grove by vendoring the charters + agents it
needs and wiring the placeholders (below) to its own paths and commands —
the same door pattern Trellis uses for its own overlay.

## The team

Grove charters seven agent roles, one per stage of the pipeline, plus
the dispatcher that sequences them (it holds live run state across
every stage rather than occupying one, so it carries no stage number of
its own), plus two remediation roles that keep runs from silently
dying, plus one standing audit role over the artifact record itself —
eleven roles in all. Every role is a
**stateless cold start**: all context travels through artifacts and their
`depends_on` graph, never through conversation history. A floundering cold
role is evidence about the artifacts it was given, not just the agent.

| Agent | Stage | Charter | Cold-started |
|---|---|---|---|
| divergent-researcher | 1 | research discipline; loud abort on missing tools | yes |
| shaper | 2 | decision canvases; never decides | interactive |
| contract-author | 3 | specs from approved intent; never implements | yes |
| spec-adversary | 3½ | breaks `gated` specs before human approval; verdict grammar `APPROVE-READY / NEEDS-REVISION / UNSOUND` | yes |
| executor | 4 | test-first implementation from artifacts only; under-specification is a surfaced finding, never a silent choice | yes |
| conformance-reviewer | 4½ | build gate vs. approved upstream, multi-round; drift taxonomy | yes |
| validator | 5 | per-PR critique + triggered drift audits; report-only | yes |
| dispatcher | — | dispatch, sequencing, findings ledger, checkpoint-resume | the interactive session (v0) |
| run-resumer | remediation | resumes a run that died at its turn cap from its checkpoint | yes |
| propagation-remediator | remediation | writes an honest missing propagation section when a PR's contract check fails | yes |
| corpus-reviewer | standing | artifact-corpus conformance vs the repo's own contract (frontmatter, lifecycle, `depends_on`, supersession); report-only | yes |

Full charters, each with a `## Placeholders` section naming exactly what a
consuming project must fill in, live in [`charters/`](charters/).

## Dispatch and workflows

The dispatcher classifies every ask into one of six workflows and
sequences agents through it (**inference-first**: classify, announce the
classification in the first status line, proceed — explicit workflow
commands remain an override, not the operating model). See
[`charters/dispatcher.md`](charters/dispatcher.md) for the full
dispatch contract, workflows W1–W6, the backpropagation interrupt (W4), and
the checkpoint-resume bounds shared with `run-resumer`.

## Repo layout

- **`decisions/`** — this repo's own ADRs (append-only; see its README).
- **`specs/`** — this repo's own specs, if any (see its README).
- **`charters/`** — the portable role charters: what each agent is,
  what it does, its boundaries, and its placeholders. This is the artifact
  grove ships.
- **`.claude/agents/`** — Claude Code subagent definitions generated from
  the charters, ready to drop into a consuming project's `.claude/agents/`.
- **`.claude/skills/grove-status/`** — the runtime-status skill an
  agent uses to report itself onto a [wisp](https://github.com/kodhama/wisp)
  event bus, if one is vendored (telemetry is optional by construction —
  grove never requires wisp to function). Its governing charter is
  [`charters/grove-status.md`](charters/grove-status.md) — commands,
  addressing, and the invariants it guarantees (currently `draft`: a
  first pass, not yet reviewed).
- **`.trellis/`** — the Trellis governance overlay this repo runs on
  itself (bootstrapped via `trellis setup`, not hand-copied).

## Adopting grove in your project

The canonical route is the Claude Code plugin (kodhama-0002 §3):

```
/plugin marketplace add kodhama/kodhama
/plugin install grove@kodhama
/grove:setup
```

`/grove:setup` is a composing interview: it asks which agent roles to
install (default: all eleven), copies their definitions into your project's
`.claude/agents/`, and resolves every placeholder (test/typecheck
commands, your VCS/issue-tracker conventions, your parked-item store,
your spec/research rubric paths) to your project's real values —
honestly, with "none exists yet" where a convention genuinely doesn't.
Telemetry is composed only if you have [wisp](https://github.com/kodhama/wisp)
available; grove never requires it. See
[`plugins/grove/README.md`](plugins/grove/README.md) for the full plugin
contents.

### Manual path

If you can't or don't want to install a Claude Code plugin, hand-vendor
instead:

1. Vendor the charters and/or `.claude/agents/` definitions you need.
2. Fill in each charter's placeholders (test/typecheck commands, your
   parked-item store, your spec-quality rubric path, your VCS/issue
   tracker conventions).
3. If you want live telemetry, vendor [wisp](https://github.com/kodhama/wisp)
   and set the vendor path the `grove-status` skill expects
   (`<WISP_VENDOR_PATH>` — see the skill's own doc and
   [`charters/grove-status.md`](charters/grove-status.md)).
4. Run `trellis setup` in your project if you also want the governance
   overlay grove itself runs on (recommended, not required).

## Status

This repo was lifted out of its source project per ADR-0030 §Lift path
("Espalier graduates to its own repo as trellis's reference swarm
implementation after ≥2 surviving furrows"). Wave 1 bootstrap covers the
skeleton and the generalized charters/agents/skill (steps A1–A2 of
`plan-suite-lift.md` Lane A); this repo's first self-hosted run (A4, the
lift's own conformance test) is wave 2. A3 (a per-repo generated landing
page) is retired as a grove work item — `kodhama-0006` makes LP
generation a design-system feature, triggered externally, never a
product repo's own task.
