# espalier — landing page content

This is espalier's own copy for its generated landing page
(`docs/index.html`), per `kodhama/design-system`'s LP generator contract
(`lp-generator.md`). The design system supplies no copy — everything
below is espalier's, sourced from this repo's own `README.md` and
`charters/README.md`.

## Eyebrow

Agent-swarm operating model

## Hero

**Title:** Training growth along a frame

**Subtitle:** Espalier is a portable agent-swarm operating model —
chartered roles ("gardeners"), workflows, and a dispatch contract,
distributed as markdown charters + Claude Code agent definitions + a
skill. No binary, no service — just files you copy into your project.

**CTAs:**
- Primary → `charters/` — "Read the charters →" (internal anchor
  `#charters`, since this is a single self-contained page and the repo
  has no separate hosted charter browser)
- Ghost → `https://github.com/kodhama/espalier` — "View on GitHub →"

## The trained-tree motif

Espalier is the horticultural term for training a plant's growth flat
along a frame — a wall, a fence, a wire lattice — so it grows in a
deliberate, legible shape instead of wherever gravity and light happen
to pull it. That's the name's whole argument: espalier (this repo) is
the growth, [Trellis](https://github.com/kodhama/trellis) (the
governance layer this repo overlays) is the frame it's trained against.
The gardeners aren't the trellis and they aren't the tree — they're
what does the training: chartered roles that keep a swarm's work
growing along the frame instead of sprawling. The lattice pattern in
this page's hero and the climbing mark in the header are that idea
rendered, not decoration bolted on after the fact.

## What espalier is (the team)

Espalier charters eight gardener roles, one per stage of the pipeline,
plus two remediation roles that keep runs from silently dying. Every
role is a stateless cold start: all context travels through artifacts
and their `depends_on` graph, never through conversation history. A
floundering cold role is evidence about the artifacts it was given, not
just the agent.

Cards (numbered, one per gardener — condensed from the repo's own
README table):

1. **divergent-researcher** — stage 1. Research discipline; loud abort
   on missing tools.
2. **shaper** — stage 2. Decision canvases; never decides. The one
   interactive (not cold-started) role besides head-gardener.
3. **contract-author** — stage 3. Specs from approved intent; never
   implements.
4. **spec-adversary** — stage 3½. Breaks `gated` specs before human
   approval. Verdict grammar: `APPROVE-READY / NEEDS-REVISION /
   UNSOUND`.
5. **executor** — stage 4. Test-first implementation from artifacts
   only; under-specification is a surfaced finding, never a silent
   choice.
6. **conformance-reviewer** — stage 4½. Build gate vs. approved
   upstream, multi-round; drift taxonomy.
7. **validator** — stage 5. Per-PR critique + triggered drift audits;
   report-only.
8. **head-gardener** — dispatch, sequencing, findings ledger,
   checkpoint-resume. Cold-started as "the interactive session (v0)."
9. **run-resumer** — remediation. Resumes a run that died at its turn
   cap from its checkpoint.
10. **propagation-remediator** — remediation. Writes an honest missing
    propagation section when a PR's contract check fails.

## Dispatch and workflows

The head-gardener classifies every ask into one of six workflows and
sequences gardeners through it — inference-first: classify, announce
the classification in the first status line, proceed. Explicit workflow
commands remain an override, not the operating model.

## How espalier is consumed (install)

There's no binary and nothing to `curl` or `brew install` — adopting
espalier means copying files into your own project, per
`.claude/agents/README.md`:

1. Vendor the charters and/or `.claude/agents/` definitions you need —
   copy them into your own project's `.claude/agents/`.
2. Fill in each charter's placeholders (angle-bracketed tokens like
   `<TEST_CMD>`, `<TYPECHECK_CMD>`) — your test/typecheck commands, your
   parked-item store, your spec-quality rubric path, your VCS/issue
   tracker conventions.
3. If you want live telemetry, vendor
   [espial](https://github.com/kodhama/espial) and set the vendor path
   the `espalier-status` skill expects — telemetry is optional by
   construction; espalier never requires espial to function.
4. Run `trellis setup` in your project if you also want the governance
   overlay espalier itself runs on (recommended, not required).

This reads like an install command even though it isn't a package
manager invocation — the terminal pattern's tab metaphor doesn't fit
three prose steps, so this section renders as a numbered list styled
against the terminal's dark surface instead of literal shell commands.
Noted here per `lp-generator.md`'s deviation rule.

## Repo layout

- `decisions/` — this repo's own ADRs (append-only).
- `specs/` — this repo's own specs, if any.
- `charters/` — the portable role charters: what each gardener is, what
  it does, its boundaries, and its placeholders. This is the artifact
  espalier ships.
- `.claude/agents/` — Claude Code subagent definitions generated from
  the charters, ready to drop into a consuming project's
  `.claude/agents/`.
- `.claude/skills/espalier-status/` — the runtime-status skill a
  gardener uses to report itself onto an
  [espial](https://github.com/kodhama/espial) event bus, if one is
  vendored.
- `.trellis/` — the Trellis governance overlay this repo runs on itself.

## Footer / secondary CTA

Espalier is the reference implementation and distribution home — a
consuming project adopts it by vendoring the charters and agents it
needs and wiring the placeholders to its own paths and commands, the
same door pattern Trellis uses for its own overlay.

- Ghost → `https://github.com/kodhama/trellis` — "Pairs with Trellis →"
- Ghost → `https://github.com/kodhama/espalier` — "View source →"
