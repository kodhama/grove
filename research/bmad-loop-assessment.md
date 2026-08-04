---
id: research-bmad-loop-assessment
type: research
status: recorded  # research is a reviewless type — it informs, never decides; sits outside the gate ratchet (grove#188 gap unresolved here). Supersede with a newer assessment.
depends_on: []
informed_by: [research-substrate-layerability, research-layer-design-sketch]
owner: agent
updated: 2026-08-05
---

# bmad-loop against the engine rubric — the field exam's final candidate

Install-and-read assessment of bmad-loop (v0.9.0) against the six-point
revision-native-engine rubric (R1 content-derived cascading state · R2
runner×skill steps · R3 instructions outside the graph · R4 reviews as
ordinary nodes · R5 method-agnostic · R6 change-unit custody). Verdict:
**the engine does not exist in the field** — bmad-loop is a world-class
unattended *session supervisor* (runner half: per-stage CLI/model policy,
stall/nudge/budgets, worktree isolation, and a process-exit human
checkpoint a model cannot talk past) with **no revision-native graph**: no
artifact hashing, no cascade, retries explicitly forbidden from touching
the spec ("frozen intent contract"), review = the dev skill re-run with
findings in frontmatter and the board marked done before review runs.
Decoupling is fork-not-config (745-line subclass precedent for one layout
variant). Worth stealing: the plugin dispatch surface and SpecSnapshot's
byte-comparison gate. SpecRegistry noted as R1/R3 prior art without an
engine. Full notes below.


Date: 2026-08-05. Method: installed and executed the real package; all citations are
file:line in the cloned source. Docs/README quotes marked SECONDARY.

## 0. What bmad-loop actually is (identity / version / stability)

- **Not an npm package.** `npm view bmad-loop` → 404. It is a **separate Python repo**,
  registered as an *external module* of BMAD-METHOD.
- Registration: `npmpkg/package/bmad-modules.yaml:37-60`
  - `url: https://github.com/bmad-code-org/bmad-loop`
  - `description: "Deterministic, Python-based unattended dev loop with adversarial review"`
  - `defaultSelected: false`, `type: bmad-org`, `default_channel: stable`
  - `aliases: [bauto]` + comment at :41-43: *"bauto is the pre-rename code (module was
    bmad-auto before both the repo and its contents were renamed to bmad-loop)"*
- It **replaced** a deprecated predecessor: `bmad-modules.yaml:95` —
  `deprecation-message: "BMad Automator has been deprecated and is replaced by BMad Loop"`
- **Not on PyPI** (pypi.org/pypi/bmad-loop/json returns no `info`). Installed by the
  setup skill via `uv tool install` from Git (module.yaml greeting).
- Version: `pyproject.toml:7` → `version = "0.9.0"`. Latest tag `v0.9.1`.
- Size: 46,212 lines of Python across `src/bmad_loop/`. `engine.py` alone is 4,535 lines.
- **Age and churn**: first commit `2026-06-10`, 905 commits by `2026-08-04` — under 8 weeks.
  22 tagged releases between 2026-06-20 (v0.6.0) and 2026-08-02 (v0.9.1).
  Commits/week: W24 103, W25 85, W26 78, W27 62, W28 88, W29 117, W30 173, W31 165.
  Velocity is *increasing*, not settling. CHANGELOG.md is 246 KB with 105 release
  headings and 8 BREAKING mentions.
- Roadmap (`docs/ROADMAP.md`, SECONDARY) is entirely about multiplexer backends,
  parallel unit execution, and OS ports. Nothing about method-agnosticism, artifact
  revision, or cascade.

Verdict on stability: **pre-1.0, high-velocity, one-vendor-shaped.** It is not
experimental in the sense of unfinished-and-abandoned — it is heavily engineered and
tested — but the surface is moving weekly.

## 1. The pipeline is a fixed, hardcoded state machine

`src/bmad_loop/model.py:24-49`:

```python
class Phase(StrEnum):
    PENDING = "pending"
    DEV_RUNNING = "dev-running"
    DEV_VERIFY = "dev-verify"
    REVIEW_RUNNING = "review-running"
    REVIEW_VERIFY = "review-verify"
    COMMITTING = "committing"
    TRIAGE_RUNNING = "triage-running"   # sweep-only
    TRIAGE_VERIFY = "triage-verify"
    DONE / DEFERRED / ESCALATED / AWAITING_OPERATOR
```

There is no workflow-definition file anywhere. The pipeline is Python control flow:
`engine.py:1284` `_drive_story` → `_dev_phase(task)` → `_review_and_commit(task)`.

Exactly three adapter stages exist, as *named dataclass fields*, not a list —
`policy.py:371-373`:
```python
dev: StageAdapterPolicy = field(default_factory=StageAdapterPolicy)
review: StageAdapterPolicy = field(default_factory=StageAdapterPolicy)
triage: StageAdapterPolicy = field(default_factory=StageAdapterPolicy)
```
and `policy.py:376` resolves by literal dict:
```python
stage = {"dev": self.dev, "review": self.review, "triage": self.triage}.get(role)
```

## 2. Review is not a distinct step — it is the dev skill re-invoked

`engine.py:1561-1566` (comment in `_review_and_commit`):
> "review.enabled = true (default): run a follow-up review session by **re-invoking
> bmad-dev-auto on the done spec** (BMAD-METHOD #2508 routes a `done` spec to a fresh
> step-04 review pass)."

`engine.py:1676-1679`:
> "A review pass is itself a bmad-dev-auto run: it produces a spec (status done/blocked
> + a refreshed followup_review_recommended), not a result.json with `clean`.
> devcontract synthesizes that for us."

So "review" is a *policy flag plus a re-invocation*, not a node with its own instruction
source. The actual adversarial review layers are BMAD skills the *inner* skill calls —
`validate` requires `.claude/skills/bmad-review-adversarial-general` and
`.claude/skills/bmad-review-edge-case-hunter` on disk.

## 3. Prompts are hardcoded Python f-strings

`engine.py:3870-3904` `_generic_dev_prompt`:
```python
return f"/{self._dev_skill()} {task.story_key}" + self._operator_park_instruction()
...
self._reset_spec_for_repair(task)
return (
    f"/{self._dev_skill()} Resume the autonomous dev session on the in-progress "
    f"spec at `{spec_ref}`. The previous session's work failed deterministic "
    f"verification; repair the working tree so verification passes without "
    f"changing the spec's frozen intent contract. Verification evidence is "
    f"in `{feedback}`."
) + self._operator_park_instruction()
```

`_operator_park_instruction` (`engine.py:3906-3960`) is ~15 lines of English policy prose
compiled into the binary, with an explicit note at :3910-3913:
> "Engine-injected rather than skill-owned because the durable home for it is upstream —
> bmad-dev-auto's spec template and step-03/04 finalize rules — and that PR is not
> landed. This is the shipped interim... **When upstream lands, this method is what goes
> away.**"

That is the engine's own admission that prose in the engine is a temporary wart, not a
designed seam.

The skill name is a single policy key with one supported value — `policy.py:248-263`:
```python
class DevPolicy:
    # Which inner dev skill the orchestrator drives. The sole supported value is
    # "bmad-dev-auto", the generic upstream dev primitive (BMAD-METHOD PR #2500)
    ...
    # This value is the ADAPTER DISCRIMINATOR — it selects the decoupled
    # generic-dev behaviour seams (engine._generic_dev, runsetup.py's
    # result-synthesis switch)
    skill: str = "bmad-dev-auto"
```
It is a *behaviour discriminator*, not a pointer to an instruction file. The actually
dispatched name is resolved from what is on disk (`install.dev_primitive_or_default`)
to survive BMAD's own `bmad-dev-auto` → `bmad-build-auto` rename (BMAD-METHOD#2651).

## 4. The one genuine extension seam: plugin workflows

`plugins/model.py:45`:
```python
WORKFLOW_STAGES = frozenset({"post_dev_phase", "post_review_result", "pre_commit_gate"})
```
Three injection points. `plugins/manifest.py:118-120` rejects anything else.

`plugins/model.py:103-114` `WorkflowSpec` docstring:
> "A workflow is the **conservative form of custom orchestration** the plan settled on —
> **no new pipeline stage**, just an extra session run through the engine's generic
> `_run_session` path at an allowlisted `stage`... `role` selects which adapter runs it
> (WORKFLOW_ROLES); `prompt` is the agent prompt template, expanding `{story_key}`,
> `{run_id}` and `{scripts}`."

`engine.py:1199-1234` `_run_workflows` — the prompt IS operator-supplied via the plugin
manifest, templated and dispatched. Blocking workflows can defer the unit
(`engine.py:1246`), i.e. they can *stop* the story but cannot *route* it backward.

Call sites — exactly three, matching the frozenset: `engine.py:1469` (`post_dev_phase`),
`engine.py:1752` (`post_review_result`), `engine.py:2092` (`pre_commit_gate`).

Plugin API version constant: `api_version = 1` in every plugin.toml.

## 5. R1 — revision-native state: NO

### 5a. No content hashing of artifacts
Complete inventory of `hashlib` use in `src/`:
- `platform_util.py:342-348` `_digest_suffix` — sha1 of a *filename* to make a
  filesystem-safe path segment. Cosmetic.
- `deferredwork.py:305-309` `_operation_digest` — sha256 of an *operation id* for undo
  ownership.
- `engine.py:81-83`:
  ```python
  def _digest_of(text: str | None) -> str:
      """Hash ledger text for attribution; absent and empty are equivalent."""
      return hashlib.sha256((text or "").encode("utf-8")).hexdigest()
  ```
  Used only via `engine.py:3231 _ledger_digest` and `model.py:190
  baseline_ledger_digest` — the *deferred-work ledger*, to attribute whether the last
  agent session appended entries (`engine.py:1392`: `self._ledger_digest() !=
  task.baseline_ledger_digest`).

**Nothing hashes a spec, story, epic, or PRD.** Grep for
`spec_digest|spec_hash|spec_changed` returns zero hits.

### 5b. State is status-string based
The nearest thing to content-derived state is `operatoractions.py:316-339
committed_drift()` — and it compares *status strings across sources*, not content:
```python
if self.spec_status != AWAITING_OPERATOR:
    return f"its spec now says status: {self.spec_status or '(blank)'}"
if self.board_status != AWAITING_OPERATOR:
    return f"the board now says {self.board_status}"
```
Genuinely good property (`operatoractions.py:359-361`): the actions are **re-read from
the spec at confirm time**, not trusted from the stored record — *"the spec is the
committed truth, so a spec edited after the park shows the human what they actually owe
now."* But this is scoped to the awaiting-operator park record only, and it is a
status/list comparison, not a digest or a cascade.

### 5c. Retries re-run the same step and are FORBIDDEN from changing upstream
The repair prompt (`engine.py:3899-3901`) literally instructs:
> "repair the working tree so verification passes **without changing the spec's frozen
> intent contract**."

Budgets: `policy.py:71-83` `max_review_cycles = 3`, `max_dev_attempts = 2`,
`max_followup_reviews = 1`. All are *forward* retry counters on the same node.
`engine.py:1782` — the verify-repair round is explicitly a dev re-run:
> "failing verify commands are dev work, not review work: a re-review of the same tree
> cannot make them pass. Repair with the failing output as feedback, then re-review."

### 5d. There IS a backward transition — but it is human-blocking, story-scoped, unverified
The one real backward route is **escalation → human → spec amendment → re-arm**:
1. `engine.py:4475` / `engine.py:1149` raise `RunPaused(reason, PAUSE_ESCALATION, key)`.
2. Process saves state and **exits** (`engine.py:418-427`).
3. Human runs `bmad-loop resolve <run>`, which launches an interactive session on the
   `bmad-loop-resolve` skill (`cli.py:1723-1730`).
4. That SKILL (`data/skills/bmad-loop-resolve/SKILL.md:96-108`) tells the agent to
   *"Update the frozen spec to encode the decision... You MAY use the `bmad-spec` or
   `bmad-correct-course` skills if a larger spec change is warranted."*
5. `runs.rearm_escalation` (`runs.py:725-800`) flips the task PENDING and the spec
   frontmatter back to `ready-for-dev`, resets the tree, advances the baseline.

**So "course-correct" survives in v6 only as a sentence of prose in a markdown skill
addressed to a human-supervised agent.** It is not an engine transition.

Two hard limits, both verified in code:
- `rearm_escalation` (`runs.py:770-793`) validates *only* pause stage, story key, task
  phase, and the restore-patch preconditions. **It never compares the spec before and
  after.** A human can re-arm having changed nothing.
- Even the agent's self-report is advisory: `cli.py:1735-1741` — when the resolve session
  fails to write `resolution.json`, the code merely `print(..., file=sys.stderr)` and
  **falls through** to the re-arm prompt. No `return`.
- The scope is the **story spec only**. Nothing touches the epic, PRD, or sibling stories,
  and no downstream artifact is flagged when an upstream one changes.

**R1 = NO** (with a narrow PARTIAL for the awaiting-operator drift re-read).

## 6. R2 — step = runner × skill: PARTIAL (runner yes, skill no, step set fixed)

- **Runner axis: YES, and well done.** `policy.py:334-343 StageAdapterPolicy` gives
  per-stage `name` (which CLI), `model`, `extra_args`, `usage_grace_s`,
  `stop_without_result_nudges`. `policy.py:374-400 resolved(role)` implements careful
  inheritance, including refusing to inherit a model across a client switch
  (`same_client = name == self.name`). Six CLI profiles ship:
  `data/profiles/{claude,codex,gemini,copilot,antigravity,opencode}.toml`, plus custom
  profiles from `.bmad-loop/profiles/*.toml`. `validate` confirmed live:
  `adapter dev=claude, review=claude, triage=claude`.
- **Skill axis: NO.** Only `[dev] skill` exists and it has one supported value, and it is
  a discriminator not a pointer (see §3). No per-step tool allow/deny surface; the
  profiles carry blanket bypass flags.
- **Step set: FIXED at three roles**, welded to BMAD's dev/review/triage semantics.
  A fourth step is only reachable as a plugin workflow at one of three allowlisted
  stages.

## 7. R3 — instructions outside the graph: PARTIAL

There is no graph. Instruction sourcing splits three ways:
- Engine → **hardcoded f-strings + hardcoded English policy prose** (§3).
- The real method content → **external BMAD skill markdown** on disk
  (`bmad-build-auto`, `bmad-review-*`), which the engine invokes by slash-command name
  and never reads. This is genuine externalization, but the *set* of skills is fixed and
  the names are resolved from a hardcoded allowlist, not configured.
- Plugin workflows → **operator-authored prompt in plugin.toml**, templated with
  `{story_key} {run_id} {scripts}`. This is the only place an operator supplies
  instruction text by configuration.

Swapping instruction sources without touching Python: you can swap what
`bmad-build-auto/SKILL.md` *says* (BMAD supports `_bmad/custom/` overrides —
`install.py:104`), but not *which* skill runs, nor add one.

Output shaping / adapter-meta layer: `devcontract.py` (892 lines) is exactly that — it
**synthesizes a result JSON from the spec file the session left on disk** because the
generic dev skill writes no result.json (`policy.py:250-252`,
`engine.py:1676-1679`). Plus `## Auto Run Result` marker parsing/repair
(`engine.py:2554-2645 _repair_spec_marker`). So the outcome channel is: agent writes
markdown frontmatter + a prose marker section → engine parses it back. Sentinel-and-
frontmatter, not a structured contract the agent is held to.

## 8. R4 — reviews as ordinary steps: PARTIAL/NO

- Same *kind* of node? Structurally yes — review runs through the same `_run_session`
  path and has its own `StageAdapterPolicy`. But it is not a node in any definition; it
  is `engine.py:1560+` control flow, and it is literally the dev skill again (§2).
- Configuration surface: much narrower than dev. `[review]` has only
  `enabled`, `trigger` (`recommended`|`always`), `on_timeout`,
  `on_status_contradiction` (`policy.py:179-226`).
- **Where findings go: into the story spec's own frontmatter and body**, not a separate
  findings artifact. The engine harvests deferrals out of the spec frontmatter
  (`engine.py:1687-1700`, `_harvest_spec_deferrals`), and the review triage log lives in
  the spec (`## Review Triage Log`, referenced in `bmad-loop-resolve/SKILL.md:120`).
  The durable cross-story artifact is `deferred-work.md`
  (`bmadconfig.py:39-41`) — a ledger of *deferred* work, not review findings.
- **Routing mechanism: none.** Findings are addressed because the *same skill* re-reads
  the *same spec* in the next pass. There is no dispatch of a finding to a responsible
  step. Convergence is `status == "done" and not followup_review_recommended`
  (`engine.py:1770`), i.e. **the reviewed agent's own self-report that it no longer
  recommends another look**, damped by a counter.

## 9. R5 — method-agnostic: NO

Hardcoded to BMAD's document types and layout:
- `bmadconfig.py:16-41 ProjectPaths` — `implementation_artifacts`, `planning_artifacts`,
  `output_folder` (defaults to `{root}/_bmad-output`), with:
  ```python
  @property
  def sprint_status(self) -> Path: return self.implementation_artifacts / "sprint-status.yaml"
  @property
  def deferred_work(self) -> Path: return self.implementation_artifacts / "deferred-work.md"
  ```
  The *directory* is configurable (read from BMAD's config); the *filenames* are not.
- Live `validate` output against a clean git repo (executed):
  ```
  FAIL: BMAD config not found: .../proj/_bmad/bmm/config.yaml (is BMAD installed here?)
  FAIL: .claude/skills/bmad-build-auto not found — the orchestrator drives this upstream dev primitive directly
  FAIL: .claude/skills/bmad-review-adversarial-general not found
  FAIL: .claude/skills/bmad-review-edge-case-hunter not found
  ```
  Four hard preflight failures naming BMAD's config path and three BMAD skill names.
- Status vocabulary is BMAD's: `ready-for-dev`, `in-progress`, `in-review`, `done`,
  `blocked`, `awaiting-operator` (`runs.py:743-751`, `operatoractions.py:331-338`).
- The two modes both assume BMAD: `[stories] source = "sprint-status" | "stories"`
  (`policy.py:243`) — either a `sprint-status.yaml` board or an epic spec folder with
  `stories.yaml`.

Driving an OpenSpec-style change folder would require replacing: path resolution
(`bmadconfig.py`), the board reader (`sprintstatus.py`, 346 lines), the stories reader
(`stories.py` + `stories_engine.py`, 1,339 lines), the frontmatter status vocabulary
(`frontmatter.py`, `devcontract.py`), the prompt builders (`engine.py:3870+`), the
result synthesis (`devcontract.py`, 892 lines), and the preflight (`checks.py`).
**That is a rewrite of the method layer, not a configuration change** — the engine's
value (session lifecycle, stall/nudge/timeout handling, budgets, worktree isolation,
crash-resume) lives *below* that layer but is not exposed as a reusable API.

## 10. R6 — custody: PARTIAL, and it is the *run* that is archived, not the change

- Run state root: `runs.py:29-30`
  ```python
  RUNS_DIR = Path(".bmad-loop") / "runs"
  ARCHIVE_DIR = Path(".bmad-loop") / "archive"
  ```
- **`.bmad-loop/runs/` is gitignored** — verified by executing `init`:
  ```
  gitignored: .bmad-loop/runs/
  gitignored: .bmad-loop/cache/
  gitignored: .bmad-loop/policy.toml
  gitignored: _bmad/render/
  ```
  So the entire decision trail is **local, disposable, and not committed**. The policy
  itself is gitignored — two developers on one repo do not share a configuration.
- Per-run contents (README §Run state, SECONDARY; constants verified in
  `journal.py:13-14`, `runs.py`): `state.json`, `journal.jsonl` (every decision),
  `events/`, `tasks/<id>/`, `logs/`, `deferred/`, `resolve/<story>/`, `ATTENTION`.
- Archive mechanism is real: `runs.py:515-521 archive_run` → `.bmad-loop/archive/<id>.tar.gz`,
  driven by `[cleanup] run_retention = 10`, `archive_old = true`, `trim_artifacts = true`,
  `auto_clean_on_finish = true` (`policy.py:320-331`). So state does **not** accumulate
  unboundedly — there is genuine retention.
- **What is committed** is the ordinary code commit per story, plus the story spec's own
  frontmatter/markers, the `deferred-work.md` ledger, and the operator park records.
  There is no ephemeral change-unit folder that gets sealed and archived on completion —
  the durable record of *why* is the gitignored journal.

## 11. The human checkpoint — what "enforced in Python" means

Mechanism: raise → catch → persist → **process exit**. Not a prompt, not an honour system.

- Gate config: `policy.py:62-67` `GatesPolicy.mode = "per-epic"`, one of
  `none | per-epic | per-story-spec-approval`; `on_escalation = "pause"` with the comment
  *"CRITICAL escalations always pause; field reserved"* — i.e. **not configurable off**.
- Pause stages: `model.py:52-60` — `spec-approval`, `epic-boundary`, `escalation`,
  `story-gate`, `plan-checkpoint`, `story-checkpoint`.
- Raise sites (spec approval): `engine.py:1288-1298`
  ```python
  if gates.pause_after_spec(self.policy):
      gates.notify(self.policy, self.run_dir, f"spec ready for approval: {task.story_key}",
                   f"review {task.spec_file}, then `bmad-loop resume {self.state.run_id}`")
      raise RunPaused(f"awaiting spec approval for {task.story_key}", PAUSE_SPEC_APPROVAL, task.story_key)
  ```
  Epic boundary: `engine.py:4525-4533`.
- Catch site: `engine.py:418-427` — records `paused_reason/paused_stage/paused_story_key`,
  journals `run-paused`, and the run loop unwinds. The engine process ends; the agent
  session is deliberately left alive for resume (`engine.py:412-415`).
- Only a **separate CLI invocation** restarts it: `bmad-loop resume <id>`, or for
  escalations `bmad-loop resolve <id>`. `cmd_resolve` additionally refuses to act while
  the engine is live (`cli.py:1681-1688`: `if live == "alive": ... return 1`) and refuses
  on an unverifiable pid without `--force`.

This is the strongest property in the system: the checkpoint cannot be talked past by a
model, because the model is not running when the gate is evaluated — the supervising
Python process has exited.

## 12. Frustration profile for a solo maintainer

- **Config surface**: 14 sections / ~60 keys in the generated `policy.toml` (201 lines,
  mostly explanatory comments), and none of them let you change *what steps run*. The
  knobs are stall grace seconds, nudge caps, teardown grace, cache-read weight, session
  budget mode, preserve-ref pruning, failed-diff MB caps. That is an operator console for
  a session supervisor, not a workflow definition.
- **Documentation mass**: 645-line / 12k-word README plus 4,035 lines across 12 doc files
  (adapter-authoring 611, plugin-authoring 670, tui-guide 656). Understanding the *loop*
  requires reading about tmux backends, psmux version gates, and Unity Editor quiescence.
- **Dependency stack**: BMAD-METHOD ≥ 6.10.0 + bmm module + three named BMAD skills + a
  terminal multiplexer (tmux/psmux) + `uv` + a coding CLI with hooks registered + a
  one-time interactive trust dance (`init` output: *"run `claude` once in the project to
  accept workspace trust and hooks approval"*). Four preflight FAILs on a clean repo.
- **The comments are the design doc.** `engine.py` carries paragraph-length rationale on
  nearly every branch, cross-referencing upstream BMAD PR numbers (#2500, #2505, #2508,
  #2564, #2580, #2651) and its own issue numbers (#149, #157, #158, #160, #194, #245,
  #261, #276, #356, #384, #414). Excellent engineering discipline; also a hard signal
  that behaviour is only legible if you track two issue trackers.
- **Coupling to upstream's release train**: the engine has to detect whether the project
  has `bmad-dev-auto` or the renamed `bmad-build-auto` (`policy.py:255-262`), and carries
  an interim prose injection that is meant to disappear when a BMAD PR lands
  (`engine.py:3910-3913`).

Sharpest single reason it would frustrate: **the complexity it makes apparent is session
plumbing, and the complexity it hides is the method.** A maintainer who wants to change
*how work flows* finds nothing to edit — the flow is 4,500 lines of Python control flow
with three plugin injection points — while being handed dozens of knobs for things they
never asked about (nudge budgets, teardown grace, multiplexer choice). It is a superb
unattended-session supervisor wearing the label of a workflow engine.

## 12b. Additional verified detail (from delegated deep reads, spot-checked)

### Plugin/hook surface — bigger than expected, but mostly observe-only
- **~47 hook stages** exist as *dispatch sites*, but there is **no enum of hook stage names**
  and **no validation** of them: `plugins/model.py:69-70` says *"Stage names are not
  validated here — the stage map is owned by the hook bus"*, and the bus never validates
  either. `manifest.py:39-63` checks `cmd` and `timeout_sec` only. A typo'd
  `[hooks.pre_comit]` loads cleanly and silently never fires. Contrast
  `manifest.py:118-121`, which *does* validate workflow stages.
- Veto vocabulary: `plugins/context.py:29-30`
  `VETO_ACTIONS = ("skip", "defer", "pause")`, severity-ordered, most-conservative-wins
  (`context.py:218-224`).
- **Only 5 stages honor a full veto** (`pre_worktree_setup`, `pre_ready_gate`, `pre_story`,
  `pre_dev_phase`, `pre_review_phase`, via `Engine._vetoed` at `engine.py:1115-1158`);
  `pre_run` and `pre_commit` honor `pause` only (`engine.py:2128-2131`); session stages
  synthesize a `vetoed` SessionResult (`engine.py:3536-3549`). **All remaining ~38 stages
  discard the returned context** — their vetoes are constructed, journalled, thrown away.
- Mutation whitelist: `context.py:34-42` `MUTABLE_FIELDS` has 5 entries, but
  `proposed_feedback` and `proposed_decision` have **no engine read-back** — dead fields.
  Live: `proposed_prompt`, `proposed_env` (`engine.py:1193-1196`),
  `proposed_commit_message` (`engine.py:2132-2133`).
- **`proposed_prompt` is a full replacement**, verified at `engine.py:1193-1194`:
  ```python
  if ctx.proposed_prompt is not None:
      prompt = ctx.proposed_prompt
  ```
  So a trust-gated Python plugin *can* swap the entire dev instruction. Shipped precedent:
  `data/plugins/unity/unity_plugin.py:181-185` appends its facts file.
- Project-local plugins ARE supported: `loader.py:33-35`
  `USER_PLUGINS_REL = Path(".bmad-loop") / "plugins"`; precedence builtin < entry_point <
  project (`loader.py:76-85`). Python plugins are trust-gated by `[plugins] enabled`
  (`registry.py:87-94`); **declarative `[hooks]` shell commands are not** — they run
  `shell=True` (`bus.py:50-53`) on folder-drop.
- Plugin API version: `plugins/model.py:24-28` `API_VERSION = 1`,
  `SUPPORTED_API = frozenset({1})` — set membership, not a range. No "experimental" marker
  anywhere in `src/`.

### The instruction-swap escape hatches (fork-free but abusive)
Three exist, none of them a "which instruction" config key:
1. **Custom CLI profile `prompt_template`** — `adapters/profile.py:198` reads it raw with
   no validation; `profile.py:107-117 render_prompt` splits `/skill args` and `.format`s.
   Project-local profiles overlay packaged ones (`profile.py:221-235`). Shipped precedent
   that it can name a *file path*: `data/profiles/copilot.toml:22` —
   `prompt_template = "LOAD the FULL .agents/skills/{skill}/SKILL.md, read its entire contents and follow its directions exactly, using subagents as needed: {args}"`.
   Because the profile is selected **per stage**, dev and review can be pointed at
   different arbitrary prompt files. This is the closest thing to R2's skill axis — and it
   is the CLI-transport abstraction being used as a prompt router.
2. **Custom CLI profile `skill_tree`** (`profile.py:177-179`) — any project-relative path;
   `_dev_skill` resolves the primitive inside it. End-to-end viability NOT VERIFIED
   (preflight also demands the review-layer skills).
3. **Plugin `proposed_prompt` rewrite** or a `[workflows.*]` prompt (above).

### Permission posture — every shipped profile bypasses all guardrails by default
Verified by reading all six profiles:
- `claude.toml:5` `bypass_args = ["--permission-mode", "bypassPermissions"]`
- `codex.toml:10` `["--dangerously-bypass-approvals-and-sandbox"]`
- `antigravity.toml:39` `["--dangerously-skip-permissions"]`
- `gemini.toml:10` `["--approval-mode=yolo"]`
- `copilot.toml:24` `["--allow-all-tools", "--allow-all-paths"]`
Coherent with an unattended loop; material for anyone evaluating it. There is **no
per-step tool allow/deny vocabulary** — `extra_args` replaces the bypass flags wholesale
and its tokens are unvalidated.

### How the engine learns a step's outcome (three stacked contracts)
- **Session liveness**: hook-written JSON event files, not terminal sentinel scraping
  (`signals.py:34-58`; `generic.py:371-373` `observation = "hook-signal"`).
- **triage/migrate**: a real schema the agent must emit — `sweep.py:97-157`
  `validate_triage` checks `workflow == "deferred-sweep-triage"`, `open_ids` set equality,
  per-bundle fields, cross-set disjointness.
- **dev/review**: the agent writes **no JSON**. `devcontract.py:1-18` — the outcome lives
  in the spec's YAML frontmatter `status:` plus an appended `## Auto Run Result` prose
  section; doctrine at `:12-14` is *"never trust prose for a gate."*
  `devcontract.synthesize_result` (`:353-456`) fabricates the legacy JSON shape, including
  **forging** `"workflow": DEV_WORKFLOW` (`:365-366`) so `verify.py:1383-1387`'s
  anti-wrong-skill guard passes. Anti-forgery guards do exist: the proof-of-work gate
  (`generic.py:266-284`) and `SpecSnapshot` (`adapters/base.py:25-46`), which refuses
  synthesis from a spec byte-identical to its launch state — **this is the one place a
  byte-comparison gates a transition**, and it guards against a no-op session, not against
  a stale upstream.

## 12c. The transition table — the whole graph, and its only backward edge

`statemachine.py:1` — *"Story lifecycle transition table — the single source of truth for
legal moves."* It is a module-level dict literal; nothing loads it from disk.

```python
TRANSITIONS: dict[Phase, frozenset[Phase]] = {
    Phase.PENDING:        {DEV_RUNNING, TRIAGE_RUNNING},
    Phase.DEV_RUNNING:    {DEV_VERIFY},
    Phase.DEV_VERIFY:     {DEV_RUNNING, REVIEW_RUNNING, COMMITTING, DEFERRED, ESCALATED},
    Phase.REVIEW_RUNNING: {REVIEW_VERIFY},
    Phase.REVIEW_VERIFY:  {REVIEW_RUNNING, DEV_RUNNING, COMMITTING, DEFERRED, ESCALATED},
    Phase.COMMITTING:     {DONE, ESCALATED, AWAITING_OPERATOR},
    Phase.TRIAGE_RUNNING: {TRIAGE_VERIFY},
    Phase.TRIAGE_VERIFY:  {TRIAGE_RUNNING, DONE, ESCALATED},
    DONE / DEFERRED / ESCALATED / AWAITING_OPERATOR: frozenset(),  # terminal
}
```

The only backward edge is `REVIEW_VERIFY → DEV_RUNNING`, annotated
(`statemachine.py:25`) *"fix session after a clean review whose verify commands failed"* —
i.e. re-implement, never re-specify. **There is no spec/plan/epic phase for an edge to
point at.** Backward routing to an upstream artifact is out-of-band: kill the run,
`bmad-loop resolve`, `rearm_escalation` resets the task to PENDING.

## 12d. The board says `done` *before* review runs (default path)

`engine.py:2360-2370`:
```python
def _dev_review_enabled(self) -> bool:
    """... The generic skill always self-finalizes to ``done`` (no in-review handoff), so
    its dev artifacts are verified as the review-disabled case regardless of
    whether a B3 deep review will later run..."""
    if self._generic_dev():
        return False
    return self.policy.review.enabled
```
`_generic_dev()` is true whenever `policy.dev.skill == "bmad-dev-auto"` (`engine.py:2312`)
— which is the only supported value. So on every default run, `review_enabled` is False
at `engine.py:2689-2690`:
```python
target = "review" if review_enabled else "done"
sprint_advance(self.workspace.paths.sprint_status, task.story_key, target)
```
The sprint board is advanced to **`done` at dev time**, before the review session starts.
Corroborated by `engine.py:1563-1566`: *"the orchestrator advances sprint-status at dev
time (`_post_dev_state_sync`), so this runs as an independent second-opinion pass on a
`done` spec before commit."*

Consequence: on the default configuration the board **never expresses "under review."**
State is optimistic and monotone — `sprintstatus.py:217-222` enforces a never-regress rule
— and review is a post-hoc second opinion on something already published as finished. This
is the single sharpest illustration of the R1 answer.

Board vocabulary (`sprintstatus.py:34-46`), all hardcoded:
`backlog, ready-for-dev, in-progress, review, awaiting-operator, done`, with
`ACTIONABLE_STATUSES = {"backlog", "ready-for-dev"}`.

## 12e. Cost of a second "method" — measured, not guessed

`StoriesEngine` is the in-repo proof of what adding one alternative document layout costs.
`stories_engine.py:11-18` enumerates its own seams: `_pick_next`, `_dev_prompt`,
`_post_dev_state_sync`, `_harvest_spec_path`, `_verify_dev_artifacts`,
`_extra_session_env`, and the HITL checkpoints. That is **745 lines subclassing `Engine`**
— and it still required a parallel verify family in `verify.py`
(`verify_dev_stories:1608`, `verify_review_stories:2021`), and a third family for sweep
bundles (`verify_dev_bundle:1551`, `verify_review_bundle:2037`).

And `StoriesEngine` is the *easy* case: it is still BMAD's own frontmatter, still
`status: done`, still `## Auto Run Result`, still `workflow: auto-dev`. An OpenSpec driver
would be a fourth subclass plus a fourth verify family, and would additionally have to
honour or fork `devcontract.py` (892 lines), which sits *below* the mode seam.

Grep for `proposal.md`, `design.md`, `tasks.md`, PRD or epic parsing across
`src/bmad_loop/*.py`: **zero hits**. `planning_artifacts` is configured and resolved but
never parsed — it is used only for rollback protection and spec-path containment
(`verify.py:1243`, `verify.py:1317`, `recovery_flow.py:89`).

## 12f. SpecRegistry — one paragraph

`joeldg/SpecRegistry` (GitHub, 4 stars, last commit 2026-08-04) is a **TypeScript
governance server**, not a loop engine: `packages/{server,web,cli,mcp,shared}`, a database
(`db.ts`), a dashboard, and MCP access. It *does* do the content-derived thing bmad-loop
does not — `lib/sign.ts:32-33` `sha256(content)`, `lib/embeddings.ts:108-109`
`contentHash(text)`, `db.ts:1679` hashing rendered skill markdown, and
`lib/manifestDiagnostics.ts:66` comparing a client file's `sha256` against the server
spec's content hash to detect drift — plus `lib/dependencies.ts`, `lib/compliance.ts`,
`lib/versionInfo.ts`. So it is genuinely relevant prior art for **R1's content-derived
state** and for R3-style externalized instruction (governed specs and skills distributed
to agents). **It is not an answer to R2/R4/R5**: it executes nothing, has no steps,
runners, reviews, or retries — it is the spec-custody half, and would sit *beside* an
execution engine, not replace one. It also carries meaningful adoption risk at 4 stars.
I did not verify its cascade semantics (whether a revised upstream spec marks dependents
stale) — grep for `stale|impact|downstream|cascade` in `lib/dependencies.ts` returned
nothing, so **NOT VERIFIED**, and probably absent.

## 13. NOT VERIFIED

- Did not execute a full `bmad-loop run` against a real BMAD project — no BMAD-installed
  project with a populated `sprint-status.yaml` was built, and a real run needs a live
  coding-CLI session, tmux, and trust approval. All run-loop claims come from reading
  `engine.py` plus executed `init`/`validate`/`--help`, not from observed execution.
- Token-budget enforcement behaviour, worktree-isolation merge behaviour, and TUI
  behaviour were not exercised.
- SpecRegistry: no evaluation performed (see report).
