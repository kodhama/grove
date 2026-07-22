---
id: adr-0029-non-interactive-loading
type: adr
status: draft  # drafted 2026-07-22 from the grove#125 investigation (two sessions: docs research + a live cloud_default verification); Recipe B agreed by the maintainer in-session. NOT ratified — awaits grove:decision-adversary, then the human intent gate (profile: intent = human). This flip records the act, it does not perform it.
depends_on: [adr-0026-thin-vendor-boundary, charter-versioning]
informed_by: [adr-0027-retire-ci-for-now, adr-0028-plugin-release-tagging]
owner: agent
updated: 2026-07-22
---

# ADR-0029: grove's non-interactive agent-loading contract — per-surface explicit load, thin-vendor preserved (grove#125)

The thin-vendor migration (`adr-0026`) moved the chartered fleet from
repo-committed `.claude/agents/*` into the plugin. That traded a
zero-config guarantee — agents rode in the repo, so **any** checkout had
them — for a runtime dependency: agents now exist in a session only if
that session **loads the grove plugin**. Interactive sessions satisfy this
(the user installs once). **Non-interactive surfaces** (Claude cloud, CI,
headless `claude -p`, the Agent SDK) do not, and **silently degrade to the
generic agents** — a run proceeds, just wrong. grove#125 is the regression;
this decides how grove closes it **without re-vendoring**.

## Decision state

### Decided

- **D1 — thin-vendor stands; non-interactive loading is solved per-surface,
  never by re-vendoring** *(maintainer, 2026-07-22)*. `adr-0026`'s
  plugin-carried fleet is preserved. The fix for each non-interactive
  surface is an **explicit install/load path** appropriate to that surface —
  it is **never** committing the fleet back into a consumer repo. Recipe A
  (below) is rejected precisely because it would undo `adr-0026`.

- **D2 — cloud: the environment Setup-script install (Recipe B)**
  *(maintainer, 2026-07-22; verified in-session on `cloud_default`, CLI
  2.1.217)*. The `cloud_default` surface sets `SKIP_PLUGIN_MARKETPLACE=true`,
  which suppresses the **automatic** marketplace sync at session start — so
  committed `enabledPlugins` + `extraKnownMarketplaces` alone do **not**
  auto-install (why #127 was necessary-but-not-sufficient). But the flag is
  **not a blocker**: an *explicit* install works under it. So, in the cloud
  **environment's Setup-script** (runs *before* Claude Code launches; its
  filesystem writes are snapshot-cached across sessions):
  ```bash
  claude plugin marketplace add kodhama/stewards || true
  claude plugin install grove@kodhama --scope user || true
  ```
  The install lands in the plugin cache before launch → `grove:<role>`
  present on turn 1, skipping the first-session auto-sync race (anthropics/
  claude-code#63028). **Nothing is added to the consumer repo → `adr-0026`
  intact.** **Org-shared environments** carry the Setup-script for every
  member, which is the *uniform rollout* grove#125 asked for.

- **D3 — the full per-surface contract** *(the matrix this ADR codifies)*:
  | Surface | Load path |
  |---|---|
  | **Cloud** (`cloud_default`) | env Setup-script install (D2) |
  | **GitHub Action CI** | the action's `plugin_marketplaces` + `plugins` inputs (installs before the run) |
  | **Headless `claude -p`** | `--plugin-dir` / `--plugin-url` (do not rely on default auto-sync) |
  | **Agent SDK** | `plugins: [{ type: "local", path }]` (marketplace install is not available to the SDK) |
  The consumer's committed `.claude/settings.json` (`enabledPlugins` +
  `extraKnownMarketplaces`, per #127) remains the **resolution** floor every
  surface builds on; it is necessary everywhere and sufficient only where the
  surface auto-installs.

- **D4 — grove owns the uniform rollout** *(maintainer-accepted; grove#125's
  ask)*. Consumers do not each patch independently (drift). grove provides
  the per-surface wiring — the exact carrier (a `setup`/`refresh` step, a
  dedicated skill, or documented recipes) is settled at implementation, not
  here. The point of thin-vendor is that grove centralizes this.

### Open

- **The precise rollout carrier** (setup-skill vs refresh-step vs docs) —
  deferred to implementation (D4). Not blocking this decision.

### Parked

- **Image-baking (`CLAUDE_CODE_PLUGIN_SEED_DIR`)** — a custom base image
  could seed the plugin cache directly, but custom base images are officially
  **not yet supported** on hosted cloud, and the env var is undocumented.
  Revisit if/when supported.

## Given (inherited — cited, not reopened)

- **adr-0026**: the thin-vendor boundary this decision **preserves** — the
  fleet stays plugin-carried, never re-vendored. D1 is a direct consequence.
- **adr-0027**: CI retirement — the CI load path (D3, action inputs) is
  consistent with it (deterministic install-before-run, no bookkeeping check).
- **grove#127** (merged, `b9f0c83`): committed `extraKnownMarketplaces` — the
  resolution floor D3 builds on. Necessary; this ADR settles what makes it
  *sufficient* per surface.

## Honest costs (surfaced, not buried)

1. **B is env-scoped, not repo-committed-universal.** Each cloud environment
   needs the Setup-script; a lone user must configure their own. Org-shared
   environments mitigate this for orgs, but it is not "commit once, works
   everywhere" — that property is exactly what Recipe A would buy at the cost
   of re-vendoring. Named, and chosen.
2. **Four mechanisms, not one.** The contract is per-surface (D3) rather than
   a single universal fix — more surface area to maintain than A's one path.
3. **B pins the version at snapshot time** (bump = edit the Setup-script, or
   the ~7-day cache expiry). Interacts with `adr-0028`'s versioning.
4. **Rests on undocumented behavior.** `SKIP_PLUGIN_MARKETPLACE` and the
   cloud auto-sync race (#63028) are observed, not officially documented; the
   mechanism could shift under us. The **in-session hot-load was verified
   first-hand**, but a *fresh* session created from a Setup-script
   environment was **not** run end-to-end (AC2 closes this before rollout).

## Rejected options

- **Recipe A — the skills-directory plugin (commit the fleet at
  `.claude/skills/grove/`).** Loads `grove:<role>` on **every** surface, no
  marketplace, no install, no env config — genuinely universal. **Rejected**:
  it re-vendors the fleet into each consumer repo (a *third* in-repo copy
  alongside `charters/` + `plugins/grove/agents/`, and the merge-on-update
  drift `adr-0026` deleted). Adopting it is a **conscious supersession of
  `adr-0026`**, not a convenience — and grove#112→#116 spent real effort
  removing exactly this. If a future maintainer decides universal robustness
  outweighs the boundary, A is the path — and it should be its own decision
  superseding adr-0026, not a quiet workaround.
- **Set `SKIP_PLUGIN_MARKETPLACE=false` via the environment editor.** Wrong
  lever: it only re-enables the *automatic* sync, which is the **broken** path
  (#63028 — "Found 0 plugins", no re-attachment, `/reload-plugins` disabled in
  cloud); and editor-var precedence over the platform startup context is
  **unverified** (#63541 shows editor vars don't reach the setup script).
  Explicit install (D2) sidesteps auto-sync entirely.
- **Do nothing — accept generic-agent degradation in non-interactive
  contexts.** Rejected: silent degradation *is* the bug (grove#125); a run
  that looks fine but used the wrong agents is worse than a loud failure.

## Consequences / propagation (land at approval, tracked not silent)

1. **The implementation (follow-up, executor):** the D4 rollout carrier — a
   `setup`/`refresh` step or skill that emits the cloud Setup-script + the CI
   action inputs + the headless/SDK guidance, uniformly for consumers. Its own
   reviewed step (AC3).
2. **grove#127** stands (the resolution floor); the READMEs' install route is
   corrected to `kodhama/stewards` (grove#128, merged).
3. **grove#125 closes** when D2 is verified end-to-end (AC2) and the rollout
   carrier lands.
4. **adr-0026** gains an append-only pointer: *non-interactive loading solved
   per-surface by adr-0029, boundary preserved.* No in-place edit.

## Acceptance criteria (for this decision's landing)

- **AC1**: adr-0029 `approved` by the maintainer's intent act (profile:
  `intent = human`), with a `grove:decision-adversary` verdict on record first.
- **AC2**: Recipe B verified **end-to-end** — a *fresh* cloud session created
  from a Setup-script environment loads `grove:<role>` on turn 1 — before the
  consumer rollout (closes honest-cost 4).
- **AC3**: the rollout carrier (Consequence 1) is its **own** reviewed step,
  not ridden on this decision; the adr-0026 pointer is append-only.

## Self-check (gate → `gated`)

- **Builds on settled ground** — adr-0026 (approved), grove#127 (merged),
  and first-hand cloud verification of the install path. ✓
- **No contradiction with standing decisions** — D1 *preserves* adr-0026;
  A (which would contradict it) is explicitly rejected, not adopted. ✓
- **Internally coherent** — D1 (principle) → D2 (cloud) → D3 (all surfaces)
  → D4 (rollout ownership) compose without gap. ✓
- **Minimal** — no re-vendoring, no new machinery; per-surface explicit load
  using existing platform primitives. ✓
- **Honest costs surfaced** — env-scoped, four-mechanism, version-pin,
  undocumented-behavior, fresh-session-unverified. ✓
