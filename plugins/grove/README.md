# grove (Claude Code plugin)

A portable agent-swarm operating model for Claude Code — thirteen chartered agent
roles, a dispatch contract, and workflows. No binary, no service. The fleet is
**plugin-carried** (`adr-0026`): the roles load automatically as namespaced
`grove:<role>` subagents wherever this plugin is enabled — no charter prose is
ever vendored into your repo.

## Install

```
/plugin marketplace add kodhama/kodhama
/plugin install grove@kodhama
```

Then compose the per-repo floor onto any project:

```
/grove:setup
```

Setup copies no agent definitions (`adr-0026` D1 — the roles are already
loaded). It composes only what your repo owns: the gate-profile
(`.grove/gates.toml` + the floor-guard machinery in `.grove/internal/gates/`),
the **shared role config** `.grove/config.toml` (your test/typecheck commands,
corpus paths, rubric paths — resolved interactively, with an honest "none
exists yet" where a convention genuinely doesn't), a short dial-explainer at
`.grove/README.md`, and the managed CLAUDE.md block carrying the
`grove plugin@<version>` stamp. The stamp is a **ratified record with loud
divergence disclosure, never a lock** (`adr-0026` D4) — plugin installs are
per-user, so two collaborators can run different fleet versions against one
repo; grove discloses that skew, it cannot prevent it.

## What it bundles

- **`agents/`** — the thirteen role definitions, auto-loaded as `grove:<role>`
  (see the roster below). Generated in lockstep from the canonical charters in
  the source repo's [`charters/`](../../charters/) (`adr-0026` P1): same body,
  plus the subagent frontmatter, second-person voice, and the D3 config-token
  door (tokens resolve from a consumer's `.grove/config.toml` at use time,
  verified-prior posture).
- **`skills/setup`** — `/grove:setup`: compose the repo-owned floor + config
  (above) onto a project.
- **`skills/refresh`** — `/grove:refresh`: bring an installed overlay to the
  current plugin version — floor re-copy + stamp bump, nothing else.
- **`skills/remove`** — `/grove:remove`: cleanly un-compose (asks before
  deleting anything).
- **`skills/set-profile`** — `/grove:set-profile <preset>`: switch the
  gate-profile (`.grove/gates.toml`) to a named preset (`steward` / `guardian`
  / `initiator`), with a diff + confirm and a re-run of the intent-locus floor
  validator (`adr-0018`).
- **`gates/`** — the zero-dependency gate-profile machinery (`adr-0018`):
  preset expansion, the intent-locus floor validator, and the load-time
  floor-guard with its `guardian` fallback. Setup copies it to a consumer's
  `.grove/internal/gates/`.
- **`reference/`** — the rest of the payload: the three companions
  (`lifecycle.md`, `versioning.md`, `relations.md` — plugin-carried under the
  single version pin, `adr-0026` D7; consuming repos cite them standard-form,
  *"per the grove lifecycle companion, `plugin@<stamp>`"*, and install no
  copy), the gates templates setup seeds from, the optional `grove-status`
  telemetry skill template, and the dormant CI templates (`reference/ci/`,
  retired-for-now by `adr-0027`).
- **`check/`** — the review-bookkeeping check runtime, **preserved dormant**
  (`adr-0027` D1: operationally retired, code kept so the D4 revival — a
  provider-agnostic installer — is a re-wiring, not a rebuild). Not installed
  by setup.

## The roster

Thirteen roles. Each plugin agent cites its canonical charter; the charters
carry the full method and boundaries.

| Agent | Stage | Role |
|---|---|---|
| `grove:divergent-researcher` | 1 | research discipline; loud abort |
| `grove:shaper` | 2 | decision canvases; never decides (interactive) |
| `grove:decision-adversary` | 2½ | breaks `gated` decisions on soundness before ratification — never on intent |
| `grove:contract-author` | 3 | specs from approved intent; never implements |
| `grove:spec-adversary` | 3½ | breaks `gated` specs on intrinsic quality before ratification (the spec alone) |
| `grove:executor` | 4 | test-first implementation from artifacts only |
| `grove:conformance-reviewer` | 3½ / 4½ | fidelity gate at every layer vs. the approved `implements:` upstream |
| `grove:code-reviewer` | 4½ | code-quality gate vs. the project's declared standards; blocking ≥ high (objective harm only), rest advisory |
| `grove:validator` | 5 | per-PR critique + triggered drift audits |
| `grove:run-resumer` | remediation | resumes a run that died at its turn cap |
| `grove:propagation-remediator` | remediation | writes an honest missing propagation section |
| `grove:dispatcher` | dispatch | one-shot classify/next-dispatch advisor only — not a sequencer |
| `grove:corpus-reviewer` | standing | artifact-corpus conformance vs the repo's own contract; report-only |

**`grove:dispatcher` is scoped, not a full peer of the rest.** Sequencing a
whole run requires state that survives across dozens of dispatches, which a
one-shot subagent invocation cannot hold — the driving session remains the
actual dispatcher across a run, following
[`charters/dispatcher.md`](../../charters/dispatcher.md) directly. The plugin
agent is a narrow one-shot advisor for two bounded sub-judgments (workflow
classification, next-dispatch recommendation).

**A repo's own roles coexist, never collide** (`adr-0026` D5): a role a repo
genuinely owns stays in that repo's `.claude/agents/` under its bare name
(`corpus-reviewer` vs `grove:corpus-reviewer`); the flip side is that a repo
cannot shadow a plugin agent under its namespaced name — repo-specific
behavior flows through the `.grove/config.toml` + `.grove/agents/<role>.md`
door only (D3).

## Sync note (the two-copy lockstep)

The canonical prose lives in the source repo — `charters/<role>.md` for the
fleet, `charters/{lifecycle,versioning,relations}.md` for the companions. The
payload copies here (`agents/`, `reference/*.md`) are kept in **lockstep in
the same PR** as any canonical edit (`adr-0026` P1, ex `adr-0021` D4); the
two must never drift apart. Release tags are the experimentation valve.

## Versioning (adr-0026 D4)

`plugin.json` carries the explicit plugin version. A consumer's CLAUDE.md
`grove plugin@<version>` stamp is the in-repo ratified record, bumped only by
PR (`/grove:refresh`). Setup, refresh, and any grove agent reading the stamp
at role-start disclose an installed↔stamp divergence loudly — and never
enforce it: the harness has no per-project plugin pin.
