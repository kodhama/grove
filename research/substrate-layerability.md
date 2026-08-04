---
id: research-substrate-layerability
type: research
status: recorded  # research is a reviewless type — it informs, never decides; sits outside the draft→gated→approved ratchet. charters/lifecycle.md's enum does not formally cover `research` (the standing gap tracked as grove#188; not resolved here). "recorded" = captured as-is; supersede with a newer research doc.
depends_on: []
informed_by: [research-run-state-surfaces]
owner: agent
updated: 2026-08-04
---

# Substrate layerability assessment
## Which SDD substrate is best to build a supervisory control layer on top of?

**Scope.** This is not a "which SDD tool is best" review. It is a bounded
layerability assessment: which of these projects is the best *substrate* for a
control plane that supervises someone else's methodology — deciding which
reviews are owed, holding configurable gates, dispatching the next agent from
condition rules, recording verdicts as durable file-observable tokens, and
guaranteeing at least one human intent gate, while never editing the
substrate's vendored prompts and never asking an LLM to interpret flow state.

**Date of evidence.** 2026-08-04. All version and activity numbers were read
from the GitHub REST API and npm registry on that date.

**Method.** Primary sources only — repository source code, shipped schema
files, official docs, and issue/discussion threads. Where a claim rests on
docs rather than executed code, it is marked. Nothing here is from model
memory.

---

## The sixth criterion

The brief fixed five criteria. During the work the maintainer added a sixth,
which turned out to be the most discriminating of all:

> the gateable joints are probably enough but it would be interesting to
> inject reviewers at any joint seams.

This is a materially different question from criterion 4. Criterion 4 asks
whether the substrate's *existing* checkpoints can carry a gate. Criterion 6
asks whether the layer can **mint a checkpoint where the substrate ships
none** — and have that new seam be as file-observable as a native one. A
substrate can score well on 4 and fail 6 completely, which is exactly what
happens below.

---

## Scored comparison

Scores are 0–5 for layerability, not for quality as a tool. A high score means
"a supervisory layer can bind to this cleanly"; a low score means the layer
would have to fight it, fork it, or reimplement it.

| Criterion | OpenSpec | spec-kit | BMAD | Kiro |
|---|---|---|---|---|
| 1. Ephemeral change unit, archive-on-merge | **5** | **1** | **1** | **1** |
| 2. File-observable state | **5** | **3** | **4** | **4** |
| 3. Thin agent surface (no rival orchestrator) | **5** | **1** | **3** | **2** |
| 4. Gateable joints | **2** | **3** | **4** | **3** |
| 5. Non-competing governance | **5** | **1** | **2** | **3** |
| 6. Seam extensibility (arbitrary joints) | **5** | **3** | **2** | **5** |
| **Total (of 30)** | **27** | **12** | **16** | **18** |

The fourth column is Kiro. **Agent OS was assessed and rejected** — it scored
14/30 and is effectively dormant (details in its section below).

Totals are a summary, not the argument. Two things matter more than the sum:

**OpenSpec loses exactly one criterion, and it loses it to the thing the layer
sells.** Its only low score is gateable joints — because it refuses to gate.
That is a vacancy, not a defect, and it is precisely the vacancy the layer
fills.

**The three rivals each fail criterion 1, the stated hard requirement.** None of
spec-kit, BMAD, or Kiro has a change unit that leaves the active tree. OpenSpec
is alone in satisfying it, and it satisfies it cleanly.

---

## Candidate 1 — OpenSpec (Fission-AI/OpenSpec)

### Verdict in one line
**The best file substrate and the worst gate substrate.** It gives the layer a
perfect skeleton and contributes exactly zero enforcement, by explicit design.

### 1. Ephemeral change unit — 5/5

The hard requirement is met literally. A change lives at
`openspec/changes/<id>/` holding `proposal.md`, `design.md`, `tasks.md`,
`.openspec.yaml`, and `specs/` deltas. `openspec archive` validates, merges the
delta specs into the canonical `openspec/specs/`, then **moves the change
folder to `openspec/changes/archive/YYYY-MM-DD-<name>/`**. The move is a real
filesystem `rename` (with copy+remove fallback on Windows), not a status flag.

The active tree therefore contains only in-flight work. This is the single
most important structural property for a supervisor, because it makes "what is
open right now" a directory listing rather than a query.

The delta model is the reason it works: `## ADDED / MODIFIED / REMOVED /
RENAMED Requirements` sections merge into the canonical spec at archive time,
so the canonical specs stay current without the change folders needing to
persist as history.

### 2. File-observable state — 5/5

Flow position is derived by `fs.existsSync`. From
`src/core/artifact-graph/state.ts`:

> Detects which artifacts are completed by checking file existence in the
> change directory.

There is no LLM anywhere in the state derivation. `artifactOutputExists`
resolves plain paths via `statSync().isFile()` and patterns via `fast-glob`.
Task progress is a regex over checkboxes:
`/^\s*[-*]\s*\[([\sxX])\]\s*(.*)/`.

`openspec status --change <id> --json` is the flow-position oracle, and its
shape is a documented, audited contract:

```ts
export interface ArtifactStatus {
  id: string;
  outputPath: string;
  status: 'done' | 'skipped' | 'ready' | 'blocked';
  requires: string[];
  missingDeps?: string[];
}
```

The `artifacts` array is guaranteed to be in dependency order, so "the first
`ready` entry is the artifact to write next" is a contractual statement, not an
inference. `--json` is available on `list`, `show`, `validate`, `status`,
`instructions`, `templates`, `schemas`, `new change`, `doctor`, and `context`.

`docs/agent-contract.md` is a dedicated stability contract for exactly this
use case — external tools reading machine surfaces. It specifies that in
`--json` mode stdout carries exactly one JSON document, diagnostics go to
stderr, and optional keys are omitted rather than nulled. **No other candidate
publishes a contract aimed at tool builders.**

### 3. Thin agent surface — 5/5

`openspec init` writes `openspec/` plus namespaced host files —
`.claude/skills/openspec-*/SKILL.md` and `.claude/commands/opsx/<id>.md`, with
35 host adapters supported.

Two properties matter enormously:

**It does not touch `AGENTS.md` or `CLAUDE.md`.** The docs are explicit: "No
`AGENTS.md` is created or edited," and the migration guide confirms "Your
content in CLAUDE.md, AGENTS.md, etc. — Preserved." The older marker-block
model was *removed*; `openspec update` now strips leftover markers.

**No orchestrator ships.** The vendored skills are prose that tells the agent
to call the CLI and parse its JSON — sequencing lives in the agent's loop over
`status --json`, not in a runtime. There is nothing that schedules, dispatches,
or arbitrates.

### 4. Gateable joints — 2/5

This is where OpenSpec fails, and it fails on purpose. `docs/editing-changes.md`
opens with:

> Every artifact in a change is just a Markdown file you can edit at any time.
> There is no locked "planning phase," **no approval gate**, no special edit
> mode to enter.

and `docs/concepts.md`:

> **Dependencies are enablers, not gates.** They show what's possible to
> create, not what you must create next.

The joints exist as files but nothing holds them:

| Joint | Opens | Closes | Enforced |
|---|---|---|---|
| proposal | `openspec new change` creates dir | `proposal.md` exists | no |
| spec deltas | proposal done | `specs/**/*.md` matches | structure only |
| implement | `applyRequires` satisfied | `- [x]` count | no |
| archive | change dir present | dir moved to `archive/` | partially |

Archive is the only place with teeth (`archive_tasks_incomplete`), and `--yes`
walks straight past it — the docs instruct agents to pass it. Proposal
validation is explicitly declawed in source: "Proposal validation is
informative only (do not block archive)." `/opsx:verify` "does not block
archiving."

**On gate fusion.** OpenSpec is worse than fused: the default `/opsx:propose`
generates `proposal.md`, `specs/`, `design.md`, and `tasks.md` *in one shot*,
so intent and contract are both produced before any human sees anything, and
`docs/reviewing-changes.md` treats the review as one human moment with a single
seven-item checklist covering both "is this the right problem?" and "is 'done'
defined correctly?"

**But the files are separate, so the layer can re-split them.** `proposal.md`
and `specs/**/*.md` are distinct artifacts with distinct `generates` paths and
distinct `requires` edges. The fusion is in the *default command*, not in the
data model. A layer can gate them independently — and, via a custom schema,
can force them apart (see criterion 6).

### 5. Non-competing governance — 5/5

No roles, no personas, no sub-agent model, no workflow engine. The runtime is
CLI reads files → emits JSON → host LLM follows prose. An external supervisor
has nothing to fight.

The one honest caveat: `openspec/config.yaml` carries `context`, per-artifact
`rules`, and `operations.{apply,archive}.guidance`, all injected into every
`openspec instructions` payload. That is a **prompt-injection seam the layer
can use without touching vendored skills** — a genuine asset. But the docs are
clear it is advisory: "Neither field is an enforceable check."

### 6. Seam extensibility — 5/5, and this is the decisive finding

A layer can mint arbitrary new checkpoints and `openspec status --json` reports
them **exactly like built-ins**, because the status computation is
schema-generic: `formatChangeStatus` loops `graph.getAllArtifacts()` with no
special-casing of `proposal`/`specs`/`design`/`tasks`.

The schema format (`src/core/artifact-graph/types.ts`, Zod-validated):

```ts
export const ArtifactSchema = z.object({
  id: z.string().min(1),
  generates: z.string().min(1),
  description: z.string(),
  template: z.string().min(1),      // REQUIRED — a template file must exist
  instruction: z.string().optional(),
  requires: z.array(z.string()).default([]),
});
```

So a layer can declare:

```yaml
  - id: conformance-review
    generates: reviews/conformance.md
    description: Conformance verdict token
    template: conformance.md
    requires: [specs]
```

and `status --json` will report it `blocked → ready → done` deterministically.
`requires` is an array, so the dependency graph is a real DAG, validated for
duplicate ids, dangling references, and cycles (DFS reporting the full cycle
path).

OpenSpec's own docs ship a worked **"Adding a Review Artifact"** example:
`openspec schema fork spec-driven with-review`, then `- id: review / generates:
review.md / requires: [design]` with `tasks.requires: [specs, design, review]`.

Custom schemas live in `openspec/schemas/`, are version-controlled with the
project, and **survive `openspec update`** — the update path only writes and
prunes `openspec-*` skill dirs and host command files; it never touches
`openspec/schemas/`, `openspec/config.yaml`, `changes/`, or `specs/`.

**The decisive precedent — and the decisive limit.** A community schema in
OpenSpec's own catalog, `anvil`, implements exactly this design, and its own
description states the boundary:

> `review` is written by a fresh-context, read-only reviewer … and emits a
> `VERDICT:` line telling the agent to gate `test-plan`, `tasks`, and `apply`;
> **OpenSpec only checks that artifacts exist, so enforce the gate with your
> own CI or hook.**

Read that twice. Someone already built the layer's core idea on this substrate,
and hit precisely the wall the layer exists to solve. That is simultaneously
the strongest evidence that OpenSpec is the right substrate *and* the clearest
statement that the substrate contributes none of the enforcement.

**No optional/conditional artifacts.** There is no `optional:` field. The only
conditionality is the hardcoded `skip_specs` escape hatch, which applies only
to artifacts whose `generates` path sits under `specs/` — a path prefix, not an
artifact id, is the contract custom schemas inherit. A layer wanting
conditional gates (e.g. "security review only if auth files touched") must
compute that itself and cannot express it in the schema.

**Template override requires forking.** `openspec schema fork` copies the
schema *and all its templates*, so the layer inherits a maintenance burden:
upstream improvements to the built-in `spec-driven` schema will not flow into a
fork. This is a real, recurring cost, not a one-time setup.

### Adapter gate manifest

| Gate | Opens on | Closes on | Intent-locus eligible |
|---|---|---|---|
| intent | `changes/<id>/` exists (+ `.openspec.yaml`) | `reviews/intent.md` verdict token | **yes — primary** |
| contract | `proposal.md` exists | `reviews/contract.md` token | yes |
| design | `design.md` exists | `reviews/design.md` token | no |
| plan | `tasks.md` exists | `reviews/plan.md` token | no |
| implementation | first `- [x]` in `tasks.md` | all checkboxes ticked | no |
| conformance | tasks complete | `reviews/conformance.md` token | no |
| release | conformance passed | change dir under `changes/archive/` | yes |

The adapter's real work: (a) fork `spec-driven` into a project schema that
inserts review artifacts with the right `requires` edges; (b) split the fused
`propose` step by making `specs` require an intent verdict token; (c) poll
`openspec status --change <id> --json` for position; (d) enforce — because
OpenSpec will not. Enforcement must live in the layer's own dispatch loop plus
a pre-commit/CI hook, since `--yes` disarms the only native block.

### Update / vendoring model

Clean and unusually well-specified. Generated files are OpenSpec's to own —
the docs say "edits to those files count as drift and are overwritten … keep
your own instructions elsewhere." But ownership is **namespaced**: it writes,
refreshes, and removes only `openspec-*` skill directories and `opsx/` command
files. "Anything else in that directory is left alone."

The layer's files survive cleanly provided it never names anything `openspec-*`
and never writes into `.claude/commands/opsx/`.

### Maturity

| Signal | Value |
|---|---|
| Version | 1.7.0 (2026-07-29) — post-1.0, stable semver |
| Stars / forks | 63,773 / 4,407 |
| Releases | 42 npm versions since 2025-09-06; v1.0.0 2026-01-26; roughly monthly minors |
| Contributors | 87 total but heavily solo-weighted: 516 commits / 65 / then bots and a 1–6 long tail |
| Issues (90d) | 147 opened, 179 closed — closing faster than opening |
| Backing | `Fission-AI` org, 2 core maintainers + 1 advisor. MIT. |

Healthy velocity, real adoption, but a single-vendor project with a bus factor
of roughly one and a half.

### Sharpest reason NOT to pick it

**OpenSpec cannot distinguish "this file exists" from "this file was
approved," and it never will, because refusing that distinction is its stated
product philosophy.**

An artifact an agent wrote thirty seconds ago and an artifact a human signed
off on are byte-identical to the substrate. Every verdict token the layer mints
is, to OpenSpec, just another file flipping `blocked → done`. The gates
decorate the graph but never hold it. Worse, the default path actively cuts
against the layer: `/opsx:propose` collapses intent and contract before any
supervisor is invoked, `--yes` disarms the only real block, and every release
regenerates vendored skills telling the agent it may edit any artifact at any
time.

The honest framing: you would use OpenSpec as **a directory convention plus a
JSON status reader**, paying for a 35-adapter, stores/worksets/telemetry-carrying
dependency to get a layout you could specify in a page.

---

## Candidate 2 — spec-kit (github/spec-kit)

### Verdict in one line
**It has become the layer.** spec-kit now ships a workflow engine with gate
steps, lifecycle hooks, and durable run state — which makes it a rival control
plane, not a substrate.

This is the finding that most changes the shape of the decision, and it is
recent enough that a landscape sweep from six months ago would have missed it.

### 1. Ephemeral change unit — 1/5. The hard requirement fails.

Specs live at `specs/NNN-feature-name/` holding `spec.md`, `plan.md`,
`tasks.md`, `research.md`, `data-model.md`, `contracts/`. **There is no archive
command and no archive concept.** Folders accumulate in the active tree
forever.

The community names this as an open wound, and the maintainers have not closed
it:

- **Issue #803**, "Clarify context isolation and cleanup strategy in Spec-Kit"
  (2025-10-09), asks directly: "After a spec is completed, can I safely delete
  its spec.md, plan.md, and tasks.md files — or should I move them to
  `_archive/` or mark them as DEPRECATED?" — **closed as not planned**, with no
  answer to the cleanup question.
- **Issue #620**, "How to keep specs consistent and up-to-date with spec-kit?"
  (2025-09-27), describes specs going stale as later features supersede them,
  and proposes a `/close` command. **Still open**, no maintainer reply, no
  labels, no milestone.
- **Discussion #2808**, "Should the `specs` folder be excluded from code repo?"
  (2026-06-02), asks whether to gitignore specs to stop "increasing the context
  for AI tooling." Maintainer answer, in full: **"It depends on whether or not
  you want traceability or not."**
- **Issue #2681** (2026-05-23) asks to separate framework assets from
  repo-specific project memory because "It is not obvious which files are
  framework-managed versus repo-authored." Open, unassigned, no maintainer
  response.
- A third-party extension, `stn1slv/spec-kit-archive`, exists specifically to
  "Archive merged features into main project memory" — the ecosystem built the
  missing feature out-of-tree.

Additional threads found: **Discussion #1336** (2025-12-14), "does maintaining a
large number of spec files negatively affect context?" — **unanswered by any
maintainer**; **#1100**, "Support Module-Level Persistent Specifications"
(open, 12 👍, "After merging, these specs become historical artifacts");
**Discussion #1818**, "Strategy for managing superseded/obsolete specs?" —
unanswered, maintainer suggests building an extension; **#744**, "/cleanup or
/finalize command" — closed `not_planned` by stale-bot. Tellingly, **#2093**,
"Scripts and tests assume spec numbers are always 3 digits — breaks with 1000+
specs," was closed **completed** by *widening the number format* — accommodating
accumulation rather than curing it.

**Verdict on the brief's claim: confirmed, but with a reframing that matters
more than the claim itself.** It is not an acknowledged wound the maintainers
intend to close. It is deliberate policy. Maintainer `mnriem`, Discussion
#1804 (2026-03-13), verbatim:

> "Spec Kit avoids both problems by treating specifications as immutable once
> implementation begins." … "If requirements change later, you create the next
> numbered spec — you never re-open the previous one." … "Think of it like
> closing a Sprint… each numbered spec is a closed unit of work, and change
> flows forward into the next one."

`docs/concepts/spec-persistence.md` names three retention models (Flow-Back /
Flow-Forward / Living Spec) and then declines to pick: "The model is a team
convention, not a CLI setting… None is the default, and none is required by
Spec Kit." And `docs/upgrade.md` states "The `specs/` directory is completely
excluded from template packages and will never be modified during upgrades."

So the accumulation is architectural, not an oversight, and it will not be
fixed. The market answered instead: `stn1slv/spec-kit-archive` exists
out-of-tree, and its catalog issue names the failure mode precisely —
"**Consolidation instead of accumulation.** The main spec.md previously grew as
a pile of per-feature extractions…"

For a supervisory layer this is close to disqualifying on its own. "What is
open right now" cannot be answered by listing a directory; every closed change
stays in the tree and is indistinguishable from an open one by structure alone.

### 2. File-observable state — 3/5

Mixed, and the load-bearing pointer is the problem.

**Flow position is not derived from the tree. It is read from a single mutable
cursor.** `get_feature_paths()` resolves in the order: `SPECIFY_FEATURE_DIRECTORY`
env → `.specify/feature.json`'s `feature_directory` key → hard error. The file
contents are literally `{"feature_directory":"specs/003-foo"}`.

Two consequences matter enormously for a supervisor. **Git branch no longer
determines the active feature** (that moved to an optional `git` extension).
And one global cursor means **one active feature per repo** — concurrent
changes are not representable in core state at all.

Run state *is* durable and well-engineered, written atomically to
`.specify/workflows/runs/<run_id>/{state.json,inputs.json,log.jsonl}` so
"racing writers only contend to be last; they never corrupt." Gate verdicts
live in `step_results`. But this describes *the engine's run*, not *the
change's position*, and it exists only if someone launched via
`specify workflow run`.

Stage is otherwise a coarse three-rung ladder from file existence, surfaced as
prerequisite errors in `check-prerequisites.sh`: missing feature dir → "Run
specify first"; missing `plan.md` → "Run plan first"; `--require-tasks` and
missing `tasks.md` → "Run tasks first".

The `--json` surface is real but internal: `create-new-feature.sh`,
`setup-plan.sh`, `setup-tasks.sh`, `check-prerequisites.sh` each emit flat path
objects (e.g. `{REPO_ROOT, BRANCH, FEATURE_DIR, FEATURE_SPEC, IMPL_PLAN,
TASKS}`). These are `.specify/scripts/` helpers invoked by prompt templates,
not documented CLI surface, and they are refreshed on upgrade. **There is no
`specify status` reporting SDD phase** — `workflow status` reports run state,
`integration status` reports install state. The community filled the gap with
third-party `status` and `status-report` extensions.

**Checkboxes are not trustworthy verdict tokens here.** An LLM writes the `[X]`
and nothing verifies it — a community extension `verify-tasks` exists purely to
"Detect phantom completions: tasks marked [X] in tasks.md with no real
implementation."

### 3. Thin agent surface — 1/5

spec-kit fails this criterion by shipping precisely the thing the criterion
excludes. `workflows/ARCHITECTURE.md` describes a genuine runtime:

> `WorkflowEngine.load_workflow()`

with a step registry mapping type keys to executable classes, expression
evaluation, type coercion, state persistence across pause/resume, and **11
built-in step types** including `command`, `shell`, `gate`, `if/then`,
`switch`, `while`, `do-while`, `fan-out`, and `fan-in`.

That is a control plane with conditional branching and parallelism. It is not
a substrate the layer sits on; it is a competitor occupying the same slot.

The current command set is larger than the brief assumed, and namespaced:
`/speckit.constitution`, `/speckit.specify`, `/speckit.plan`, `/speckit.tasks`,
`/speckit.taskstoissues`, `/speckit.implement`, `/speckit.converge`, plus
optional `/speckit.clarify`, `/speckit.analyze`, `/speckit.checklist`.
Canonical order: `constitution → specify → clarify → plan → checklist → tasks
→ analyze → implement → converge`.

The vendored surface is large: `.specify/` with `templates/`,
`scripts/{bash,powershell,python}/`, `extensions/`, `workflows/`, `presets/`,
`integrations/`, `bundles/`, plus per-host files across **40+ integrations**
(only one active per project). Claude now defaults to skills (`.claude/skills/`)
rather than commands.

One property deserves flagging on its own: spec-kit **writes into the host
agent's own configuration** — `events_config_file = ".claude/settings.json"`
(Copilot: `.github/hooks/speckit.json`) — to dispatch native agent events
(`session_start`, `pre_tool_use`, `post_tool_use`, `session_end`,
`user_prompt_submit`, `stop`). For a layer that also wants to own agent
dispatch, that is contested territory at the deepest level of the stack.

### 4. Gateable joints — 4/5, the highest score here

Ironically spec-kit has the best *native* gates, because it built them. From
the shipped `workflows/speckit/workflow.yml`:

```yaml
  - id: review-spec
    type: gate
    message: "Review the generated spec before planning."
    options: [approve, reject]
    on_reject: abort
```

The implementation (`src/specify_cli/workflows/steps/gate/__init__.py`) is a
real, well-engineered human-review primitive — docstring: "Gate step — human
review gate." It prompts on a TTY, **falls back to `PAUSED` when stdin is not a
TTY** so CI runs can be resumed with `specify workflow resume`, stores the
choice in `output.choice`, and supports `on_reject: abort | skip | retry` plus
`verdict_input` for non-interactive resume. The guard code is defensive to the
point of paranoia about a mis-typed `on_reject` silently letting a rejected
gate report `COMPLETED`.

So spec-kit satisfies parts (b), (d), and (e) of the layer's own charter —
configurable gates, durable verdicts, a guaranteed human gate — natively.

Gate verdicts are durable: `specify workflow resume <run_id> --input
spec_verdict=approve` binds a verdict non-interactively via `verdict_input`.

**But the `GATE` language in the templates is hollow.** `plan-template.md`
carries:

```markdown
## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]
```

`docs/upgrade.md` confirms that bracket is a runtime pointer, not a gate: "The
governed templates carry a pointer, not a copy… and `/plan` fills that section
from the live constitution each run." An LLM reads prose principles, invents
the gate criteria, then judges itself against them.

**On fusion — `/plan` genuinely fuses two gates.** One invocation produces
Phase 0 (`research.md`) *and* Phase 1 (`data-model.md`, `contracts/`,
`quickstart.md`), and "Command ends after Phase 1 design." So a single human
approval covers both the technical approach and the interface contracts, with
the Constitution Check re-evaluated post-design **by the same agent in the same
turn, no human interposed**.

`/specify` similarly fuses intent capture with spec authoring — the command
text *is* the feature description ("The text the user typed… **is** the feature
description. Do not ask the user to repeat it"), so there is no separate intent
artifact to gate at all.

**Could a layer re-split them? Yes, the files are separate.** `research.md` and
`data-model.md`/`contracts/` are distinct paths already reported individually
in `AVAILABLE_DOCS`, so a layer could require a verdict on `research.md` before
Phase 1 outputs are allowed. But it would have to interrupt `/plan` mid-flight,
and core provides no such seam — the re-split must go through a workflow
overlay or a preset-overridden plan command.

### 5. Non-competing governance — 1/5

It competes directly. The workflow engine decides sequencing, holds gates,
persists verdicts, and branches conditionally. Adding an external supervisor
means two engines with opinions about what happens next.

The constitution (`.specify/memory/constitution.md`) is a second governance
mechanism. `templates/constitution-template.md` is pure prose placeholders —
`[PRINCIPLE_1_NAME]`, `## Governance`, `[GOVERNANCE_RULES]`, "Constitution
supersedes all other practices" — with **no schema, no machine-readable
assertions, and no validator**. `plan`, `tasks`, and `analyze` read it live and
self-assess. That is exactly the mode the layer's charter forbids.

There are three enforcement tiers, only two of which are real code:

1. **Workflow engine gates** — Python, durable state. Real, but only active if
   someone runs `specify workflow run`.
2. **Native agent events** — dispatched via `.specify/events.py` into the host
   agent's config. Real and code-enforced, but they are *runtime* events, not
   SDD-phase events.
3. **Extension `before_/after_` hooks** — prose. Not enforcement.

**The ecosystem is already crowded with competing supervisors.** From the
146-entry community catalog: `fleet` ("Orchestrate a full feature lifecycle
with human-in-the-loop gates across all SpecKit phases"), `plan-review-gate`
("Require spec.md and plan.md to be merged via MR/PR before allowing task
generation"), `spec-validate` ("review gating, and approval state… a hard gate
before /speckit.implement"), plus `ci-guard`, `orchestrator`, `companion`,
`loop`. The layer would be entering a contested niche, not an empty one.

### 6. Seam extensibility — 3/5

Better than I first judged, with a sharp catch.

**The sanctioned no-edit customization story is genuinely good — arguably the
best of any candidate.** Templates resolve through a four-layer stack:

| Priority | Layer | Location |
|---|---|---|
| 1 | Project-local overrides | `.specify/templates/overrides/` |
| 2 | Presets | `.specify/presets/<id>/templates/` |
| 3 | Extensions | `.specify/extensions/<id>/templates/` |
| 4 | Core | `.specify/templates/` |

Presets compose with `replace | prepend | append | wrap` (the last using a
`{CORE_TEMPLATE}` placeholder), so a layer can **wrap a core prompt without
editing it**. Workflow overlays are cleaner still — `docs/reference/workflows.md`:

> Workflow overlays let a project extend or override an installed workflow
> **without editing the installed `workflow.yml`**. This keeps local
> customizations safe across `specify bundle update` or `specify workflow add`
> upgrades.

The docs even ship an "Example: Replacing a Gate." And the project states the
layer's own principle as policy (`docs/upgrade.md`): "presets and extensions —
**not in-place file edits** — are how Spec Kit now governs shared assets."

**The catch is what the seams are made of.** Extension hooks bind to a fixed,
closed set of phase events (`before_specify`/`after_specify` … 
`before_taskstoissues`/`after_taskstoissues`), and the API reference is
explicit that "Extensions attach to completed phases via hooks, they don't
modify workflow structure." So a layer cannot mint a seam where spec-kit has
no phase.

Worse, **those hooks are honor-system prose, not code.** All ten command
templates carry identical text instructing the *model* to read
`.specify/extensions.yml` and voluntarily comply:

> After emitting the block above you MUST actually invoke the hook and wait for
> it to finish before continuing… **Emitting the block alone does not run the
> hook.**

And the docs concede the templates ignore their own metadata: "Current command
templates surface hooks in their configured YAML order and do not sort them by
`priority`" and "Current command templates do not evaluate conditions and skip
hooks with a non-empty condition."

**This directly violates the layer's hard constraint** that flow position must
never depend on an LLM interpreting prose. Gates are code-enforced *only*
inside `specify workflow run` — i.e. only when spec-kit's orchestrator, not the
layer, is driving.

The remaining escape is authoring a custom workflow with arbitrary `gate` steps
— genuinely flexible. But that means expressing the layer's logic **in
spec-kit's workflow YAML, executed by spec-kit's engine**: becoming a plugin
inside the substrate rather than a supervisor above it.

Note `workflows/step-catalog.json` is currently `"steps": {}` — third-party
step types are an announced surface with no ecosystem behind them yet.

### Adapter gate manifest

Mostly moot — the adapter would be a spec-kit *extension*, not a layer. If
built anyway: bind an extension to `after_specify` (contract gate),
`after_plan`, `after_tasks`, `after_implement`, with the intent gate having no
natural home because `/specify` fuses intent into spec generation. There is no
release/archive gate because there is no archive.

### Update / vendoring model

Better than its reputation. Two loops: `specify self check` / `specify self
upgrade` for the CLI, and `specify integration upgrade <key>` for project
files. The latter is **manifest-hash-aware** — "If a managed integration file
was modified after install, the command stops and asks you to inspect the
change or rerun with `--force`." Never touched: `specs/**`, source, git
history, and `.specify/memory/constitution.md`.

`specify init --here --force` is the escape hatch and is explicitly downgraded:
"it does not use the same per-integration manifest checks before overwriting
files."

**A layer's files survive if placed outside the managed set** — anything under
`specs/` or in the layer's own directory is untouched. Files inside
`.specify/templates/` or `.specify/scripts/` survive non-forced upgrades (hash
divergence reads as customization) but are at risk under `--force`.

Historical clobbering complaints are numerous — #916 (33 reactions,
"re-running `specify init` overwrites user-modified files (like
`constitution.md`)"), #1541, #1223 ("a known issue"), #2918, #2319, Discussion
#168 (38 upvotes), with #1210 still open and #3950 (filed 2026-08-03) showing
constitution seeding is *still* being reworked. Most are fixed; the seam is
much better than it was, but it is still moving.

Issue #2681 (open, unassigned) asks to split `.specify/` into framework vs
project zones precisely because "It is not obvious which files are
framework-managed versus repo-authored."

### Maturity

| Signal | Value |
|---|---|
| Version | v0.15.2 (2026-08-03) — **still 0.x after ~11.5 months** |
| Stars / forks | 125,289 / 11,193 — by far the largest |
| Release cadence | **27 releases in the last 30 days**; 15 in the 18 days to Aug 3 |
| Contributors | ~260 |
| Issues | 151 open, 1,303 closed (~4.5 new/day) |
| Backing | GitHub org project, MIT |

The velocity cuts both ways. It is unambiguously alive and institutionally
backed. But a 0.x substrate shipping near-daily releases, which grew an entire
workflow engine, bundle system, and extension framework inside one year, is a
**moving target**. Note also that much closure is bot-driven (stale at 150
days, auto-closed at 180 as `not_planned`) and much recent volume is community
catalog churn rather than product work — so raw issue-throughput overstates
maintainer engagement, which is thin at the top.

### Sharpest reason NOT to pick it

**spec-kit has already built the layer's skeleton — differently — and its
version is load-bearing, so the layer inherits a permanent multi-cursor
conflict it does not control.**

The layer wants flow position derived by reading files. spec-kit's answer is a
**mutable single-slot pointer** (`.specify/feature.json`, one active feature
per repo) plus **workflow-run state** that exists only when someone launched
via `specify workflow run`. Neither is derivable from the artifact tree. That
gives three sources of truth — the layer's derived state, the cursor, and the
run state — which **drift the moment a human types `/speckit.plan` directly**.
Nothing prevents that bypass, and the documented default *is* typing commands
by hand.

Meanwhile the only phase-level hook seam is explicitly LLM honor-system
("Emitting the block alone does not run the hook"), violating the hard
constraint outright. The layer's gates would be code-enforced only inside
`specify workflow run` — only when spec-kit's orchestrator, not the layer's, is
in the driver's seat.

And it fails the stated hard requirement: no archive, no ephemeral change unit,
with accumulation established as deliberate policy.

**The honest counter-argument, which is strong:** if the layer can *mandate*
that all work flows through `specify workflow run`, then overlays + gate steps
+ `verdict_input` + `state.json` deliver code-enforced gates, durable verdict
tokens, condition-driven dispatch, and a no-vendored-edits guarantee — most of
the layer's spec, already built and maintained by someone else. **The decision
hinges almost entirely on whether the bare-slash-command path can be
forbidden.** If it cannot, this substrate is disqualified.

---

## Candidate 3 — BMAD-METHOD (bmad-code-org/BMAD-METHOD)

### Verdict in one line
**The best state model of any candidate, on the least stable ground — and the
vendor already ships the layer.**

### Version correction, which reframes everything

There is no "v5 / BMAD Core" restructure. **Current is v6.10.0** (2026-07-03),
and v6 deleted most of what the brief assumed. The CHANGELOG on the v6.1.0
change:

> Everything now installs as a skill — all workflows, agents, and tasks
> converted to markdown with SKILL.md entrypoints (not yet optimized skills,
> but unified format)

Gone: `bmad-core/`, the YAML-workflow-plus-XML-step-dialect architecture,
`docs/stories/*.md` as the primary unit, `docs/qa/gates/*.yml`, and the sm/po/qa
personas — three personas ("Barry, Quinn, Bob") were consolidated into a single
Developer agent (Amelia). The roster is now five: Analyst, PM, Architect, Dev,
UX Designer, and **there is no orchestrator agent** — "The documentation does
not identify a master orchestrator or coordinator agent."

The brief's premise that BMAD is "most at risk" because it ships personas and
workflow orchestration is **half right and half stale**: the personas shrank,
the orchestrator left core — and reappeared as a separate first-party product.

### 1. Ephemeral change unit — 1/5

The change unit is now a spec folder, `_bmad-output/specs/spec-<slug>/`, with
its own `stories.yaml`. Lifecycle is frontmatter-driven:

```yaml
status: 'draft' # draft | ready-for-dev | in-progress | in-review | done
review_loop_iteration: 0
```

**Nothing relocates it on completion.** The final step updates frontmatter to
`done`, syncs sprint status, and commits. The docs say plainly: "Leave the
implementation in the working tree for local inspection." Specs and stories
accumulate. The only archival machinery found is in `bmad-loop`, and it
archives *runs* (`.bmad-loop/runs/`), not specs.

### 2. File-observable state — 4/5, the strongest of any candidate on this axis

`sprint-status.yaml` is a declared single source of truth — a flat key→status
map committed to git:

```yaml
development_status:
  epic-1: backlog
  1-1-user-authentication: done
  1-2-account-management: ready-for-dev
```

And there is **real deterministic Python**, not prose:
`sprint_plan.py` (~28KB, with tests) exposes `generate`, `status`, and
`validate`, all emitting JSON —
`{"ok": true, "stories": {...}, "epics": {...}, "open_action_items": [...],
"risks": [...], "recommendation": {...}, "all_done": bool}`.

**Status writes are monotonic**, which is exactly the discipline a verdict-token
layer wants: `sync-sprint-status.md` states "Never regress a story's status" —
it only advances if the story has not already passed that point, and auto-lifts
the parent epic from `backlog` to `in-progress`.

Flow position is read from files, not inferred by an LLM: the resume step reads
`stories.yaml`, the story files, and **the spec frontmatter `status` field
"determines which step to resume."**

The one-point deduction: two conventions coexist. The *spec* file uses YAML
frontmatter; the legacy *story* file uses a bare `Status: ready-for-dev`
markdown line. Tasks are markdown checkboxes.

### 3. Thin agent surface — 3/5

Core ships no executing orchestrator. `bmad-build/SKILL.md` is **911 bytes**
and does nothing but shell out to `render_skill.py`, then "Read and follow the
single absolute instruction from `workflow.md` that prints to stdout." Within a
skill, sequencing is prose chaining step files by literal
`[[bmad-snapshot:step-NN.md]]` references. Nothing executes the chain.

But it does ship five personas and — more interestingly — **a machine-readable
sequencing graph**. `module-help.csv` is a 13-column CSV whose
`preceded-by`/`followed-by` columns "create a dependency graph that `bmad-help`
walks to recommend next steps," with `outputs` holding "File patterns for
completion detection" and `required` as "Blocking gate status."

**This is the single most layerable artifact in the project** — a consumer-
extensible edge list of the pipeline. It is a recommendation graph consumed by
an LLM skill, not an enforcer, but a layer could read it directly.

### 4. Gateable joints — 4/5

| Joint | Observable event | Enforced by |
|---|---|---|
| Sprint-planning readiness gate | PASS/CONCERNS/FAIL → `sprint-status.yaml` | `sprint_plan.py` + LLM |
| Spec approval | frontmatter `draft → ready-for-dev` | prose |
| Implementation start | `in-progress`; epic auto-lifts | `sync-sprint-status.md` |
| Review | `review_loop_iteration` increments | prose |
| Complete | `status: done` + commit | prose |
| TEA release gate | `gate-decision-{type}-{story_id}.md` | separate module |

**Correction to the brief:** `docs/qa/gates/*.yml` and the `*gate` command are
v4 and no longer exist. The QA gate concept left core entirely for
`bmad-method-test-architecture-enterprise` (87 stars, created 2026-01-18).
Verdicts are still PASS / CONCERNS / FAIL / WAIVED, but the artifact is
**markdown** — `gate-decision-{gate_type}-{story_id}.md` — not YAML.

The review taxonomy is unusually well-shaped for layering: findings classify as
`intent_gap | bad_spec | patch | defer | reject`, severity is reassigned by the
orchestrating step with the explicit instruction "Disregard any severity
assigned by a reviewing subagent" because reviewers lack full context, and "If
it exceeds 5" iterations the process halts for human escalation.

**Fused gate, and it is the cleanest fusion found anywhere.** From
`spec-template.md`:

```
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
## Intent
## Boundaries & Constraints   (Always / Ask First / Never)
## I/O & Edge-Case Matrix
</frozen-after-approval>
```

One human approval simultaneously ratifies the problem (Intent), the policy
(Boundaries), and the contract (I/O matrix). There is no separate "is this the
right problem" gate ahead of it. **This is the seam the layer would most
cleanly split** — and because the three are distinct markdown sections under
one tag, a layer could split them without editing vendored files, by demanding
separate verdict tokens per section.

### 5. Non-competing governance — 2/5

Core is close to inert — gates are durable file tokens, sequencing is prose,
no orchestrator agent to fight. On that evidence alone it would score 4.

It scores 2 because of what the vendor ships alongside it (below).

### 6. Seam extensibility — 2/5. Boundary-only, and mid-chain injection
violates the constraint.

The sanctioned mechanism is `_bmad/custom/` TOML overrides in three layers.
Injectable keys: `activation_steps_prepend`, `activation_steps_append`,
`on_complete`, `persistent_facts`, and `[[agent.menu]]` items. Merge rules:
scalars replace, tables deep-merge, arrays-of-tables merge by `code`/`id`,
other arrays append-only. Hard limit: **"No removal mechanism. Overrides cannot
delete base items."**

**These are boundaries, not seams.** Prepend/append/on_complete hang off the
*edges* of a skill run. There is no override key that inserts between
`step-03-implement.md` and `step-04-review.md` — that chain is hard-coded in
the step files. **To create a mid-workflow checkpoint you must edit the
vendored step file, which violates the layer's stated constraint outright.**

Custom modules are additive-parallel, not insertive: a new module can declare
`preceded-by`/`followed-by` and join the graph `bmad-help` walks, but that is a
recommendation to an LLM, not an interception.

### The finding that dominates: `bmad-loop` is already this layer

`bmad-code-org/bmad-loop` (73 stars) became an installable module in v6.10.0 —
"the successor project for unattended dev-loop orchestration, adversarial
review, and deferred-work sweeps — is now selectable straight from the
installer picker." Its README states the thesis verbatim:

> Plain Python drives the loop — pick story → implement → adversarially review
> → verify → commit — while LLMs do only the creative work.

> Story selection, retry budgets, gates, and completion checks are code, not
> prompts — so they're deterministic, debuggable, and free.

Mapped against the layer's own charter:

| Layer requirement | bmad-loop already has |
|---|---|
| (a) decide which reviews are owed | `trigger = "recommended" \| "always"`, `on_status_contradiction = "escalate"`, `max_review_cycles`, `max_dev_attempts` |
| (b) configurable gates, human or agent owner | `[gates] mode = "none" \| "per-epic" \| "per-story-spec-approval"`; per-story `spec_checkpoint` / `done_checkpoint` |
| (c) fire next agent from condition rules | phase machine (`pending, in-dev, dev-failed, in-review, review-failed, dev-fix, escalated, awaiting-operator, done, deferred`) + per-stage model routing |
| (d) durable file-observable verdict tokens | `.bmad-loop/runs/<id>/state.json`, `journal.jsonl`, append-only `ATTENTION`, `tasks/<id>/result.json`; `bmad-loop status --json` |
| (e) guaranteed human intent gate | yes, enforced in Python — plan checkpoint pauses before implementation; `bmad-loop resolve <id>` re-arms |
| never edit vendored prompts | folder-drop `plugin.toml` that "extends the orchestrator **without touching its core loop**" |

Its plugin API is the best seam-injection mechanism found in this entire
assessment: **~40 lifecycle stages** (`pre_ready_gate`, `post_dev_phase`,
`pre_commit_gate`, `post_review_result`, …), hooks that **observe, veto, or
mutate** via a JSON line on stdout —
`{"veto": {"action": "defer|skip|pause", "reason": "…"}}` — and injectable
first-class agent sessions. Python plugins are **never imported unless
explicitly enabled**, a genuinely careful trust design.

The shipped TEA plugin is a worked example of precisely the layer's use case:
an external reviewer injected at `post_dev_phase` and `pre_commit_gate`,
parsing verdicts out of markdown, and on FAIL or CONCERNS vetoing the commit
with `pause` so the unit "escalates for human review instead of landing."

**The crucial distinction on requirement (e):** in BMAD-METHOD the human intent
gate is *advisory* — `<frozen-after-approval>` and the `HALT` instructions are
prose an LLM is asked to obey, and nothing enforces them. In bmad-loop it is
*guaranteed* — a Python state transition that stops the engine and writes to
`ATTENTION`. **So the layer's value proposition over raw BMAD-METHOD is real,
and it is exactly the value proposition bmad-loop already published.**

### Update / vendoring model

`npx bmad-method install` offers Quick Update ("applies patches and minor
stable upgrades, refuses major upgrades") or Modify Install, with
`_bmad/_config/manifest.yaml` recording module versions, channels, git SHAs.

`_bmad/config.toml` is "installer-owned, regenerated on install";
`_bmad/custom/config.toml` is "never regenerated." Assume anything under
`_bmad/<module>/` is replaced wholesale. **A layer's files survive if they live
in `_bmad/custom/` or `.bmad-loop/plugins/`.**

One real problem: **`.bmad-loop/policy.toml` is gitignored and per-machine** —
bad if the layer wants gate configuration to be a committed, reviewable
artifact. And the docs warn that copying a full `customize.toml` into an
override is "actively harmful" because it locks in old defaults.

### Maturity

| Signal | Value |
|---|---|
| Version | v6.10.0 (2026-07-03) |
| Stars / forks | 51,475 / 5,900 |
| Cadence | ~10 minor releases Apr–Jul 2026; 61 PRs merged since 2026-07-01 |
| Open issues | 121 |
| Backing | `bmad-code-org` org, BMad Code, LLC. MIT + trademark notice |

Not solo. But note the ratio: **51k stars on core vs 73 and 87 on the two
modules that carry the governance machinery.** The parts the layer would depend
on are early.

### Sharpest reason NOT to pick it

**BMAD's file layout — the exact thing the layer must read — has been rewritten
twice in 16 months and is mid-rewrite right now.**

1. v4→v6 was a total substrate replacement: workflow YAML deleted, personas
   merged out of existence, QA gates moved to another repo *and* another file
   format.
2. v6 is still churning its own taxonomy. The **unreleased** CHANGELOG section
   on `main` today collapses numbered phase folders (`1-analysis` …
   `4-implementation`) into alphabetical lanes, deprecates
   `bmad-check-implementation-readiness`, demotes `bmad-sprint-status` to a
   shim, retires `bmad-agent-tech-writer`.
3. The compatibility policy says this recurs: `v6-shims/README.md` —
   "Enterprise users may still depend on these IDs, so they ship by default" —
   with removal scheduled for v7. The stated remedy for churn is a shim
   directory.

Every artifact the layer would key on — `sprint-status.yaml` keys, spec
frontmatter, `stories.yaml`, `module-help.csv` edges — is younger than four
months in its current shape. `sprint_plan.py` already ships legacy remappings
(`"drafted" → "ready-for-dev"`, `"contexted" → "in-progress"`) for statuses
that were canonical *within v6*.

**The second-sharpest reason may matter more strategically: the niche is
occupied by the vendor.** Building the layer on BMAD-METHOD means competing
with a first-party module the vendor promotes as one of its three official
flows. Building it *as a bmad-loop plugin* means inheriting their runtime,
their gitignored per-machine `policy.toml`, and their release cadence.

---

## Candidate 4 — Kiro (AWS), chosen over Agent OS

### Why Kiro and not Agent OS

**Agent OS is rejected on maintenance, not architecture.** v3.0 (2026-01-20)
deliberately deleted the machinery a control plane observes
("Implementation/orchestration phases retired"), leaving **no on-disk task
state, no completion state, and no event mechanism of any kind**. Tasks in
`plan.md` are `## Task N:` headings, not checkboxes — negative-checked for
`- [ ]`, `checkbox`, `tasks.md`, `todo`, all absent. So there is no progress
signal on disk at all.

Its extension story also fails the layer's hard constraint mechanically:
`project-install.sh` reads exactly one path from a profile,
`profiles/$profile/standards`, while commands come from a hardcoded,
profile-independent path. **A custom profile cannot add or override a command**,
so inserting a gate means editing vendored files.

And it is effectively dormant: **last push 2026-05-05**, no release since
v3.0.0 (~6.5 months), 1 open issue / 59 closed with hygiene enforced by stale
bots. v3 shipped broken (fresh installs install nothing — the shipped
`tech-stack.md` sits at a path the installer never reads; plus `tac: command
not found` and WSL2 CRLF breakage), and **the fix merged 2026-05-05 is still
unreleased**. Discussion #343, "Is Agent OS being maintained?" (2026-04-14),
has **no maintainer response** — only a community reply that "both Agent OS and
Design OS are therefore suffering from a chronic lack of attention." Install
docs are email-gated. Effectively a solo project (top contributor 42 of ~57
commits).

Scored 14/30. One correction worth recording: third-party files *do* survive
its installer (no `rm`, no recursive `cp -r`, only `mkdir -p` plus per-file
`cp`) — but `.claude/commands/agent-os/` is overwritten unconditionally with no
prompt and no backup.

**A trap avoided:** the phrase "Archive when complete: Mark spec as archived"
that appears in search results against `agent-os/specs/` belongs to
`brobertsaz/claude-os`, an unaffiliated project that installs alongside. It is
**not an Agent OS feature.**

### Verdict on Kiro in one line
**Chosen not for its specs but for its hooks** — `.kiro/hooks/*.json` is a
file-defined, shell-executing, *blocking* event system with spec-task-granularity
triggers, which is nearly a purpose-built API for a supervisory control plane.

### The presumed disqualifier is out of date

The brief's hypothesis — that Kiro requires a proprietary closed IDE and is
therefore unlayerable in principle — **was true in April 2026 and is false
now.** Issue #7481 (2026-04-15): "The IDE's spec-driven development workflow…
has no CLI equivalent." CLI v3 then shipped `/spec new` and `/spec run N`
(CLI 2.15.0, 2026-07-27), and headless mode runs
`kiro-cli chat --no-interactive --trust-tools=read,grep "…"` with `KIRO_API_KEY`.
An external supervisor **can** drive it.

### Scores with evidence

**1. Ephemeral change unit — 1/5.** `.kiro/specs/<feature>/` accumulates
forever; no archive/complete/delete command exists. The docs endorse it: "over
time, you can accumulate a large collection of specification documents." The
cost is documented and dismissed — issue #4606 (2025-12-26), "New sessions
auto-ingest .kiro/specs and instantly hit context limit (400k+ tokens)," with
42+ spec dirs and ~295,095 words; the workaround was renaming to
`.kiro/specs.disabled/`; **closed as not planned**. Upside: the files are inert
markdown, so layer-owned `git mv` archiving is safe and would actually fix
#4606.

**2. File-observable state — 4/5.** Plain markdown readable by any tool, no IDE
required: "Specs are designed to be version-controlled… Store specs directly in
your project repository." `tasks.md` uses `- [ ]` / `- [x]` with requirement
traceability. Docked two points because the IDE ticks checkboxes automatically
but **the CLI never does** (issue #6826: "the `[ ]` checkboxes are never
automatically marked `[x]`" in CLI, closed as duplicate, not fixed, with
acknowledged "real risk of tasks.md drifting from actual implementation
state"), and there is **no JSON status/list command**.

*Trap avoided:* `spec.json` with `phase`/`approvals`/`ready_for_implementation`
is **not a Kiro file** — it belongs to `gotalab/claude-code-spec`, a
third-party reimplementation. Native `.kiro/specs/<feature>/` holds **only the
three `.md` files, no metadata sidecar.**

**3. Thin agent surface — 2/5.** Kiro *is* an orchestrator: the Spec agent owns
the three-phase sequence. It scores 2 rather than 1 only because it is
externally drivable. **Not open source** — `github.com/kirodotdev/Kiro` is an
issue tracker and docs hub (4.1k stars, **2.6k open issues**), with no LICENSE
and no source. The load-bearing negative signal is issue #10320 (2026-07-19),
which requested machine-readable lifecycle state for an external orchestrator,
noting these states "only appear in rendered terminal UI output, making
external integrations dependent on fragile text parsing" — **closed as
duplicate**.

**4. Gateable joints — 3/5.** Approval is **chat state, never a file**: "you
can either provide detailed feedback… or you can just type something like
**'LGTM'** in the prompt to move on." Task start is a UI affordance. The docs
are silent on persistence, and confirm gates exist only via the bypass — "Quick
Spec to auto-generate all three artifacts **without approval gates**."

Intent/contract fusion is real — approving `requirements.md` means both "I want
this" and "this is the contract" in one LGTM — but **the files can be
re-split**, because they are inert markdown and `PreToolUse` can block the
write to `design.md` until an intent token exists.

**5. Non-competing governance — 3/5.** The three-phase spec model competes,
mitigated because its approval enforces nothing durable. Steering is actively
cooperative: `.kiro/steering/*.md` with frontmatter `inclusion: always |
fileMatch | manual | auto`. CLI v3 adds `permissions.yaml` (`shell`, `fs_read`,
`fs_write`, `mcp`), a second declarative external control surface.

**6. Seam extensibility — 5/5, and this is why it was chosen.** Standalone JSON
at `.kiro/hooks/<id>.json` with a versioned schema, plus global `~/.kiro/hooks/`.
**Ten triggers**: `PostFileSave`, `PostFileCreate`, `PostFileDelete`,
`PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `SessionStart`, `Stop`, and
crucially **`PreTaskExec`** and **`PostTaskExec`**, which "occur before and
after executing a **spec task**." The decisive property:

> Command actions run a shell command in your project root. The command
> receives session context as JSON on STDIN.

**An arbitrary external shell command, not merely an in-IDE agent prompt.** And
blocking is real: **exit code 2 stops execution and returns STDERR to the
agent**, on `PreToolUse`, `PreTaskExec`, and `UserPromptSubmit`. Platform
matrix is `IDE ✓ | CLI ✓`. The changelog names the use case outright — global
hooks let "linting on save, security checks before commits, or **custom
approval gates**" avoid per-project duplication.

### Adapter gate manifest

| Gate | Opens on | Closes on | Intent-eligible |
|---|---|---|---|
| G1 Intent | `PostFileCreate`, matcher `\.kiro/specs/.*/requirements\.md$` | `…/.<layer>/intent.approved.json` | **yes — the guaranteed human gate** |
| G2 Contract | `PreToolUse` on write to `design.md`, blocked (exit 2) until G1 token | `contract.approved.json` | yes |
| G3 Plan | `PreToolUse` on write to `tasks.md`, blocked until G2 | `plan.approved.json` | agent |
| G4 Task admission | **`PreTaskExec`** — blocks with exit 2 | layer permits | configurable |
| G5 Task verdict | **`PostTaskExec`** + `- [ ]`→`- [x]` flip | verdict token | agent |
| G6 Blast-radius review | `PostFileSave` on source globs | verdict token | agent |
| G7 Sweep | `SessionStart` seed, `Stop` reconcile | — | — |

G4/G5 make the **task**, not the spec, the change unit — finer-grained than any
other candidate's native model. G2 is where Kiro's fused intent/contract
approval gets re-split.

### Update / vendoring model

Unusually clean: **Kiro vendors nothing into the repo.** No installer writes
prompt files; `.kiro/` holds only what the user or its agent creates. Upgrading
Kiro upgrades the *binary*, so **a layer's files in `.kiro/` are never
clobbered, because no upgrade touches `.kiro/` at all.**

The risk is schema churn. A community post is titled "Kiro's Hooks have changed
in IDE 1.0. The Hooks we created in #16 will no longer work," and CLI v3 moved
hooks to a "standalone file format" with a migration guide.

### Maturity

| Signal | Value |
|---|---|
| Status | GA 2025-11-17; international launch 2026-05-07 |
| Trajectory | **Replacement for Amazon Q Developer**, whose IDE plugins and paid subs end support 2027-04-30 |
| Adoption | 250,000+ developers in preview |
| Cadence | ~weekly: CLI 2.13 (Jul 17), 2.14 (Jul 22), 2.15 (Jul 27), 2.16 (Jul 31, 2026) |
| Licence | **Proprietary**, closed source, no LICENSE in the public repo |
| Pricing | Free $0/50 credits · Pro $20 · Pro+ $40 · Pro Max $100 · Power $200 |

**Every user of a headless supervisor needs a paid seat** — "API key
authentication is only available for Kiro Pro, Pro+, Pro Max, and Power
subscribers."

### Sharpest reason NOT to pick it

**The entire control surface is an unsupported-by-contract feature of a closed,
credit-metered AWS product, and AWS has three times declined to treat external
supervision as a use case:** #10320 (agent-readable status for external
orchestrators) closed as duplicate; #6826 (CLI checkbox parity) closed as
duplicate; #4606 (spec accumulation) closed as **not planned**. The hook format
has already broken once between IDE versions. No licence, no source, no
stability guarantee, weekly releases, and a per-seat paywall on the one auth
mode headless requires.

---

## Does any candidate make the layer unnecessary?

This was posed as a real possible outcome. The honest answer is **no for the
layer as specified, but the margin has narrowed sharply, and two of the four
candidates now ship most of it.**

### The case that it is unnecessary

Three independent implementations of the layer's charter now exist, and none of
them are the maintainer's:

- **spec-kit's workflow engine** — code-enforced `gate` steps, durable
  `state.json` verdicts, `verdict_input` for non-interactive resolution,
  conditional dispatch (`if`, `switch`, `while`, `fan-out`), resume from pause,
  and overlays that customize without editing vendored files.
- **bmad-loop** — a deterministic Python control loop with configurable gate
  modes, a ~40-stage veto/mutate plugin API, per-stage model routing, a
  guaranteed human checkpoint enforced in code, and `status --json`.
- **SpecRegistry** (joeldg/SpecRegistry) — explicitly markets itself as "an
  open-source control plane for Spec-Driven Development" that makes specs
  "versioned, signed, reviewable, enforceable, observable" with "deterministic
  runtime gates." *I did not evaluate this in depth — flagged as prior art
  worth a look, not as a verified equivalent.*

Plus a crowded extension tier on spec-kit alone: `fleet` ("Orchestrate a full
feature lifecycle with human-in-the-loop gates across all SpecKit phases"),
`plan-review-gate`, `spec-validate` ("a hard gate before /speckit.implement"),
`ci-guard`, `orchestrator`.

Anyone claiming this is greenfield is wrong.

### The case that it is still necessary

**Every one of those is welded to its own substrate.** spec-kit's engine only
governs spec-kit; bmad-loop only governs BMAD. The layer's distinguishing
premise — *supervising someone else's methodology*, substrate-agnostically — is
not implemented by any of them. That premise is what survives the comparison.

Two further gaps hold up:

**No candidate ships a guaranteed human intent gate at the right locus.** In
spec-kit, `/specify` fuses intent into spec authoring — the command text *is*
the feature description, so there is no intent artifact to gate before the
contract exists. In BMAD, `<frozen-after-approval>` fuses intent, policy, and
contract into one approval, and is prose-enforced. In OpenSpec, `/opsx:propose`
generates all four artifacts before a human sees anything. **All three fuse
intent with contract, and re-splitting them is precisely the layer's job.**

**The most telling evidence is `anvil`.** Someone already built the layer's
core idea — an adversarial reviewer artifact emitting a `VERDICT:` that gates
downstream stages — as an OpenSpec custom schema, in OpenSpec's own catalog.
It works structurally. And its own description states the wall it hit,
verbatim:

> `review` is written by a fresh-context, read-only reviewer (a second model
> when one is available) and emits a `VERDICT:` line telling the agent to gate
> `test-plan`, `tasks`, and `apply`; **OpenSpec only checks that artifacts
> exist, so enforce the gate with your own CI or hook.**

That is a proof of concept *and* a proof of gap in one sentence. The structure
layers cleanly; the enforcement has to come from outside. That is the layer.

### The honest qualifier

If the maintainer's real requirement is "governed SDD in one repo, today," then
**bmad-loop or spec-kit's workflow engine would deliver most of it faster**, and
building a layer would be redundant effort. The layer earns its keep only if
substrate-agnosticism is a genuine requirement rather than a stated one — i.e.
if it must govern repos using *different* methodologies, or must outlive the
substrate it starts on. **That is the question the maintainer should answer
before writing any code**, because it is the single input that flips the
build/adopt decision.

---

## What I could NOT verify

Stated plainly, because several of these bear on the recommendation.

**Nothing was executed.** Every CLI surface here was read from documentation
and source, not from running the tools. No `--help` output was captured, no
`openspec status --json` was actually invoked, no `specify workflow run` was
executed. The claim that a custom OpenSpec artifact appears in `status --json`
identically to a built-in is **inferred from source** (`detectCompleted` loops
`graph.getAllArtifacts()` with no special-casing) and from OpenSpec's own
documented "Adding a Review Artifact" example — it was **not empirically
confirmed**. This is the single highest-value thing to test before committing,
and it is a ten-minute experiment.

**OpenSpec's `openspec schema fork` maintenance burden is unquantified.** I
confirmed forking copies schema + templates and that `openspec/schemas/`
survives `update`. I did **not** determine how often the built-in `spec-driven`
schema changes upstream, so the real cost of drifting from it is unknown.

**Whether a layer can override a single OpenSpec artifact template without
forking the whole schema** is unresolved. The supported path appears to be
fork-only; `openspec templates --json` reveals resolution but no per-artifact
override mechanism was found. Absence of evidence, not evidence of absence.

**spec-kit's `.specify/feature.json` single-cursor limitation** is read from
`common.sh` resolution order. I did not test whether concurrent features are
workable via the `SPECIFY_FEATURE_DIRECTORY` env var per-process, which might
be a viable workaround.

**Kiro's `PreTaskExec` hook STDIN payload is unverified** — whether it carries
spec name and task ID could not be confirmed, because `kiro.dev/docs/hooks/reference/`
returns 404 and `/docs/cli/v3/hooks/` redirects to a migration page. Two gates
in the derived Kiro manifest depend on it.

**SpecRegistry was not evaluated.** It surfaced late as prior art for the layer
itself. Its claims ("deterministic runtime gates," "signed, enforceable specs")
are quoted from its own marketing, not verified against source.

**Maintainer engagement figures are proxies.** Contributor counts and issue
throughput come from the GitHub API. For spec-kit in particular, much closure
is bot-driven (stale at 150 days, auto-closed at 180) and much recent volume is
community-catalog churn, so raw numbers overstate human maintainer attention. I
did not audit comment authorship at scale.

**No adversarial check on OpenSpec's `agent-contract.md`.** It describes itself
as verified by a "capstone audit" against source dated 2026-06-11. I spot-checked
the `ChangeStatus` shape against the TypeScript and it matched; I did not verify
the other twelve command families.

---

## Verdict

### On substrate choice, the evidence is not close

**OpenSpec wins on the criteria as written, 27/30 against 18, 16, and 12.** The
brief asked me not to name a winner if the evidence were close. It is not
close, and saying otherwise would be false balance.

The margin comes from three findings, each independently sufficient:

**It is the only candidate that satisfies the hard requirement.** Criterion 1
was stated as non-negotiable. `openspec archive` merges deltas into canonical
specs and physically moves the change folder to
`changes/archive/YYYY-MM-DD-<name>/`. The other three accumulate forever, and
in two cases the maintainers have said so explicitly — spec-kit's "treating
specifications as immutable once implementation begins," Kiro's #4606 closed as
not planned.

**Its state model is the layer's state model.** Flow position is
`fs.existsSync` over a schema-declared artifact DAG, exposed as a documented,
audited JSON contract. No other candidate publishes a stability contract aimed
at tool builders. spec-kit's answer is a single mutable cursor that cannot
represent two concurrent changes.

**It is the only one where the layer can mint arbitrary seams as first-class
citizens.** A custom artifact with `generates` and `requires` becomes a
file-observable joint that `status --json` reports identically to a built-in —
because `detectCompleted` loops all artifacts with no special-casing. Kiro
matches this on hooks (5/5) but only as *interception*, not as *graph
membership*; BMAD's overrides are boundary-only and mid-chain injection
requires editing vendored files; spec-kit's hooks bind to a closed phase list
and are honor-system prose.

### The trade a maintainer actually decides on

The substrate question has a clear answer. **The open question is a different
one, and it is genuinely open:** whether to build the layer at all.

The trade is between two coherent positions:

**Build on OpenSpec.** You get a perfect skeleton and zero enforcement. The
layer supplies 100% of the guarantee — every gate, every verdict, every
dispatch rule — and OpenSpec contributes structure, position, and a clean
vendoring boundary. Upside: the layer is portable, the substrate never fights
you, and the philosophy gap is stable (OpenSpec will not grow gates, so you
will not be squeezed out). Downside: you carry all enforcement out-of-band,
against a substrate whose default command fuses intent with contract and whose
docs tell the agent it may edit anything at any time.

**Adopt bmad-loop or spec-kit's workflow engine.** You get enforcement today —
code-enforced gates, durable verdicts, condition-driven dispatch, guaranteed
human checkpoints — built and maintained by someone else. Downside: you are
welded to one methodology, you inherit their cadence and their state model, and
in BMAD's case the file layout has been rewritten twice in sixteen months.

**The single input that flips this is whether substrate-agnosticism is a real
requirement or a stated one.** If the layer must govern repos on *different*
methodologies, or must outlive the substrate it starts on, build on OpenSpec.
If the real need is governed SDD in one repo now, bmad-loop already ships it
and building would be redundant effort.

That is the maintainer's call, not mine — it depends on facts about intent that
no amount of repository reading can supply.

### On the stated tiebreaker

The maintainer's hands-on experience with OpenSpec and preference for its delta
model was offered as a legitimate tiebreaker. **It did not need to be used.**
OpenSpec wins on the criteria independently, and I want that recorded plainly
so the preference is not doing hidden work in the conclusion. If anything, the
delta model turns out to be load-bearing for a reason the preference did not
name: deltas are *why* archive-on-merge is possible at all, since the canonical
spec absorbs the change and the container becomes disposable. That is
criterion 1 working, not taste.

### One caveat that should be tested before committing

The central mechanism — that a custom artifact appears in `openspec status
--json` as a first-class `blocked → ready → done` seam — is **inferred from
source, not executed**. It is a ten-minute experiment: fork the schema, add a
`review` artifact, create a change, run `openspec status --json`, and confirm
the artifact appears with correct `requires` and `missingDeps`. Do that before
writing an adapter. If it fails, OpenSpec's score on criterion 6 drops from 5
to roughly 2 and the comparison genuinely narrows.
