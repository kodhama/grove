# grove — landing page content

This is grove's own copy for its generated landing page
(`docs/index.html`), per `kodhama/design-system`'s LP generator contract
(`lp-generator.md`). The design system supplies no copy — everything
below is grove's, sourced from this repo's own `README.md` and
`charters/README.md`.

## Eyebrow

Agent-swarm operating model

## Hero

**Title:** Training growth along a frame

**Subtitle:** Grove is a portable agent-swarm operating model —
chartered roles ("gardeners"), workflows, and a dispatch contract,
distributed as markdown charters + Claude Code agent definitions + a
skill. No binary, no service — just files you copy into your project.

**CTAs:**
- Primary → `charters/` — "Read the charters →" (internal anchor
  `#charters`, since this is a single self-contained page and the repo
  has no separate hosted charter browser)
- Ghost → `https://github.com/kodhama/grove` — "View on GitHub →"

## The trained-tree motif

Grove is the druids' own word: a grove is a community of trees — and,
in the druidic orders, the name of the community itself. That's the
name's whole argument: grove (this repo) is the growth,
[Trellis](https://github.com/kodhama/trellis) (the governance layer
this repo overlays) is the frame it's trained against — keeping the
family's founding image, a grove trained along a trellis. The
gardeners aren't the trellis and they aren't the trees — they're what
does the training: chartered roles that keep a swarm's work growing
along the frame instead of sprawling. The lattice pattern in this
page's hero and the climbing mark in the header are that idea
rendered, not decoration bolted on after the fact.

Note: this section previously explained the name via *espalier*, the
horticultural technique of training a plant flat along a frame. That
pun doesn't carry over to *grove* — the repo's rename source
([`README.md`](../README.md)) gives grove's own etymology (druidic
community of trees), which is what the paragraph above now uses,
adapted from the README's own wording rather than invented fresh. The
trellis/frame analogy itself survives the rename unchanged; only the
tree-motif half of the pun needed a new source.

## What grove is (the team)

Grove charters eight gardener roles, one per stage of the pipeline,
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

## How grove is consumed (install)

The canonical route is the Claude Code plugin (kodhama-0002 §3):

```
/plugin marketplace add kodhama/kodhama
/plugin install grove@kodhama
/grove:setup
```

`/grove:setup` is a composing interview: it asks which gardener roles to
install (default: all eleven), copies their definitions into your project's
`.claude/agents/`, and resolves every placeholder (test/typecheck
commands, your VCS/issue-tracker conventions, your parked-item store,
your spec/research rubric paths) to your project's real values —
honestly, with "none exists yet" where a convention genuinely doesn't.
Telemetry is composed only if you have
[wisp](https://github.com/kodhama/wisp) available; grove never requires
it. See [`plugins/grove/README.md`](../plugins/grove/README.md) for the
full plugin contents.

This is rendered on the page as the DS's Terminal (tabs/copy/prompt)
pattern verbatim — a single "Claude Code" tab, since the plugin is the
one primary command sequence. No deviation needed here, unlike the old
(v0.1.0) page, which claimed there was no curl/brew/plugin install
command to run at all — that was true before grove shipped a plugin,
not anymore.

### Manual path

If you can't or don't want to install a Claude Code plugin, hand-vendor
instead:

1. Vendor the charters and/or `.claude/agents/` definitions you need.
2. Fill in each charter's placeholders (test/typecheck commands, your
   parked-item store, your spec-quality rubric path, your VCS/issue
   tracker conventions).
3. If you want live telemetry, vendor
   [wisp](https://github.com/kodhama/wisp) and set the vendor path the
   `grove-status` skill expects (`<WISP_VENDOR_PATH>` — see the skill's
   own doc) — telemetry is optional by construction; grove never
   requires wisp to function.
4. Run `trellis setup` in your project if you also want the governance
   overlay grove itself runs on (recommended, not required).

These four steps are prose, not shell commands, so this part of the
page keeps the `.howto` ordered-list treatment (the terminal's
dark-surface visual language reused without its tabs/copy-button
markup) rather than the Terminal pattern used above it for the plugin
route. Noted here per `lp-generator.md`'s deviation rule.

## Repo layout

- `decisions/` — this repo's own ADRs (append-only).
- `specs/` — this repo's own specs, if any.
- `charters/` — the portable role charters: what each gardener is, what
  it does, its boundaries, and its placeholders. This is the artifact
  grove ships.
- `.claude/agents/` — Claude Code subagent definitions generated from
  the charters, ready to drop into a consuming project's
  `.claude/agents/`.
- `.claude/skills/grove-status/` — the runtime-status skill a
  gardener uses to report itself onto a
  [wisp](https://github.com/kodhama/wisp) event bus, if one is
  vendored.
- `.trellis/` — the Trellis governance overlay this repo runs on itself.

## Footer / secondary CTA

Grove is the reference implementation and distribution home — a
consuming project adopts it by vendoring the charters and agents it
needs and wiring the placeholders to its own paths and commands, the
same door pattern Trellis uses for its own overlay.

- Ghost → `https://github.com/kodhama/trellis` — "Pairs with Trellis →"
- Ghost → `https://github.com/kodhama/grove` — "View source →"
