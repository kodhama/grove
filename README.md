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
consuming project adopts grove by installing the Claude Code plugin —
the agent fleet is **plugin-carried** (`adr-0026`): the roles load as
namespaced `grove:<role>` subagents wherever the plugin is enabled,
and the repo keeps only what it owns — its gate-profile, the shared
role config the charters' tokens resolve from (`.grove/config.toml`),
optional per-role addenda, and its own corpus. Nothing of grove's
prose is vendored into a consumer again.

## The team

Grove charters nine agent roles across the stages of the pipeline —
one per stage, except the review gates, where two independent questions
are asked of the same finished artifact: **fidelity** ("does it derive
faithfully from what it implements?" — the conformance-reviewer, at
every layer with an artifact upstream) and **quality** ("is it good,
judged as the thing it is?" — a specialist per layer:
decision-adversary, spec-adversary, code-reviewer; `adr-0012`) — plus
the dispatcher that sequences them (it holds live
run state across every stage rather than occupying one, so it carries
no stage number of its own), plus two remediation roles that keep runs
from silently dying, plus one standing corpus-conformance role over the
artifact record itself — thirteen roles in all. Every role except the dispatcher
and the shaper is a **stateless cold start**: all context travels
through artifacts and their
`depends_on` graph, never through conversation history. A floundering cold
role is evidence about the artifacts it was given, not just the agent.

| Agent | Stage | Charter | Cold-started |
|---|---|---|---|
| divergent-researcher | 1 | research discipline; loud abort on missing tools | yes |
| shaper | 2 | decision canvases; never decides | interactive |
| decision-adversary | 2½ | breaks `gated` decisions on soundness before ratification — never on intent; verdict grammar `SOUND / NEEDS-REVISION / UNSOUND` | yes |
| contract-author | 3 | specs from approved intent; never implements | yes |
| spec-adversary | 3½ | breaks `gated` specs on intrinsic quality before ratification (the spec alone — fidelity is conformance's); verdict grammar `APPROVE-READY / NEEDS-REVISION` | yes |
| executor | 4 | test-first implementation from artifacts only; under-specification is a surfaced finding, never a silent choice | yes |
| conformance-reviewer | 3½ / 4½ | the fidelity gate at every layer — spec→decision, code→spec, charter→ADR — vs. the approved `implements:` upstream; verdict grammar `PASS / FAIL / UPSTREAM-INDICTED` | yes |
| code-reviewer | 4½ | code-quality gate vs. the project's own declared standards; severity-graded, blocking ≥ high (objective harm only), rest advisory; read-only | yes |
| validator | 5 | per-PR critique + triggered drift audits; report-only | yes |
| dispatcher | — | dispatch, sequencing, findings ledger, checkpoint-resume | the interactive session (v0) |
| run-resumer | remediation | resumes a run that died at its turn cap from its checkpoint | yes |
| propagation-remediator | remediation | writes an honest missing propagation section when a PR's contract check fails | yes |
| corpus-reviewer | standing | artifact-corpus conformance vs the repo's own contract (frontmatter, lifecycle, `depends_on`, supersession); report-only | yes |

Full charters live in [`charters/`](charters/); each token-bearing one
carries a `## Config tokens` section naming exactly what a consuming
repo resolves in its `.grove/config.toml` (`adr-0026` D3 — values are
verified priors the roles check at use time, never ground truth).

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
  what it does, its boundaries, and its config tokens. This is the artifact
  grove ships.
- **`plugins/grove/`** — the Claude Code plugin: the `agents/` payload
  (subagent definitions generated from the charters in two-copy
  lockstep, auto-loaded as `grove:<role>`), the setup/refresh/remove/
  set-profile skills, the gate-profile machinery, and the plugin-carried
  companions (`adr-0026`).
- **`.trellis/`** — the Trellis governance overlay this repo runs on
  itself (bootstrapped via `trellis setup`, not hand-copied).

## Adopting grove in your project

The canonical route is the Claude Code plugin (kodhama-0002 §3):

```
/plugin marketplace add kodhama/stewards
/plugin install grove@kodhama
/grove:setup
```

Installing the plugin loads all thirteen roles as `grove:<role>`
subagents — nothing is copied into your repo. `/grove:setup` then
composes only what your repo owns: the gate-profile floor
(`.grove/gates.toml` + machinery), the shared role config
(`.grove/config.toml` — your test/typecheck commands, VCS/issue-tracker
conventions, parked-item store, rubric paths, resolved interactively
and honestly, with "none exists yet" where a convention genuinely
doesn't), a short dial-explainer, the managed `AGENTS.md` block with the
`grove plugin@<version>` stamp, and Claude's `@AGENTS.md` adapter
(`adr-0033`; `adr-0026` D4 — a ratified record with loud skew disclosure,
never a lock). See
[`plugins/grove/README.md`](plugins/grove/README.md) for the full plugin
contents.

### Manual path

If you can't or don't want to install a Claude Code plugin, the
charters are plain markdown — you can hand-copy what you need
(everything here is open source). Know what you're taking on: grove's
own tooling no longer composes or maintains vendored copies
(`adr-0026` — the merge-on-update class is exactly what the plugin
route deleted), so keeping hand-vendored charters current is entirely
yours. If you go this way: copy from [`charters/`](charters/), resolve
each `## Config tokens` entry to your project's real values, and run
`trellis setup` if you also want the
governance overlay grove itself runs on (recommended, not required).

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
