# grove

**Grove** is a portable agent-swarm operating model: chartered roles
("gardeners"), workflows, and a dispatch contract, distributed as markdown
charters + Claude Code agent definitions + a skill — **no binary, no
service**. The name is the druids' own: a grove is a community of trees —
and, in the druidic orders, the name of the community itself. It grows
along a [Trellis](https://github.com/kodhama/trellis) (the governance
layer this repo overlays), keeping the family's founding image: *a grove
trained along a trellis*. The agents are **gardeners** — the grove is
what they tend, and what they are.

This repo is the **reference implementation and distribution home**. A
consuming project adopts grove by vendoring the charters + agents it
needs and wiring the placeholders (below) to its own paths and commands —
the same door pattern Trellis uses for its own overlay.

## The team

Grove charters eight gardener roles, one per stage of the pipeline, plus
two remediation roles that keep runs from silently dying. Every role is a
**stateless cold start**: all context travels through artifacts and their
`depends_on` graph, never through conversation history. A floundering cold
role is evidence about the artifacts it was given, not just the agent.

| Gardener | Stage | Charter | Cold-started |
|---|---|---|---|
| divergent-researcher | 1 | research discipline; loud abort on missing tools | yes |
| shaper | 2 | decision canvases; never decides | interactive |
| contract-author | 3 | specs from approved intent; never implements | yes |
| spec-adversary | 3½ | breaks `gated` specs before human approval; verdict grammar `APPROVE-READY / NEEDS-REVISION / UNSOUND` | yes |
| executor | 4 | test-first implementation from artifacts only; under-specification is a surfaced finding, never a silent choice | yes |
| conformance-reviewer | 4½ | build gate vs. approved upstream, multi-round; drift taxonomy | yes |
| validator | 5 | per-PR critique + triggered drift audits; report-only | yes |
| head-gardener | — | dispatch, sequencing, findings ledger, checkpoint-resume | the interactive session (v0) |
| run-resumer | remediation | resumes a run that died at its turn cap from its checkpoint | yes |
| propagation-remediator | remediation | writes an honest missing propagation section when a PR's contract check fails | yes |

Full charters, each with a `## Placeholders` section naming exactly what a
consuming project must fill in, live in [`charters/`](charters/).

## Dispatch and workflows

The head-gardener classifies every ask into one of six workflows and
sequences gardeners through it (**inference-first**: classify, announce the
classification in the first status line, proceed — explicit workflow
commands remain an override, not the operating model). See
[`charters/head-gardener.md`](charters/head-gardener.md) for the full
dispatch contract, workflows W1–W6, the backpropagation interrupt (W4), and
the checkpoint-resume bounds shared with `run-resumer`.

## Repo layout

- **`decisions/`** — this repo's own ADRs (append-only; see its README).
- **`specs/`** — this repo's own specs, if any (see its README).
- **`charters/`** — the portable role charters: what each gardener is,
  what it does, its boundaries, and its placeholders. This is the artifact
  grove ships.
- **`.claude/agents/`** — Claude Code subagent definitions generated from
  the charters, ready to drop into a consuming project's `.claude/agents/`.
- **`.claude/skills/grove-status/`** — the runtime-status skill a
  gardener uses to report itself onto a [wisp](https://github.com/kodhama/wisp)
  event bus, if one is vendored (telemetry is optional by construction —
  grove never requires wisp to function).
- **`.trellis/`** — the Trellis governance overlay this repo runs on
  itself (bootstrapped via `trellis setup`, not hand-copied).

## Adopting grove in your project

1. Vendor the charters and/or `.claude/agents/` definitions you need.
2. Fill in each charter's placeholders (test/typecheck commands, your
   parked-item store, your spec-quality rubric path, your VCS/issue
   tracker conventions).
3. If you want live telemetry, vendor [wisp](https://github.com/kodhama/wisp)
   and set the vendor path the `grove-status` skill expects
   (`<WISP_VENDOR_PATH>` — see the skill's own doc).
4. Run `trellis setup` in your project if you also want the governance
   overlay grove itself runs on (recommended, not required).

## Status

This repo was lifted out of its source project per ADR-0030 §Lift path
("Espalier graduates to its own repo as trellis's reference swarm
implementation after ≥2 surviving furrows"). Wave 1 bootstrap covers the
skeleton and the generalized charters/agents/skill (steps A1–A2 of
`plan-suite-lift.md` Lane A); the generated landing page (A3) and this
repo's first self-hosted furrow (A4, the lift's own conformance test) are
wave 2.
