# grove (Claude Code plugin)

A portable agent-swarm operating model for Claude Code — thirteen chartered agent roles, a dispatch
contract, and workflows, composed onto your project. No binary, no service.

## Install

```
/plugin marketplace add kodhama/kodhama
/plugin install grove@kodhama
```

Then compose it onto any project:

```
/grove:setup
```

It asks which agent roles to install (default: all thirteen), copies their definitions into your
project's `.claude/agents/`, and resolves every placeholder (test/typecheck commands, VCS/issue-
tracker conventions, parked-item store, spec/research rubric paths) to your project's real values —
interactively, with an honest "none exists yet" where a convention genuinely doesn't. Telemetry
(the `grove-status` skill, reporting onto a [wisp](https://github.com/kodhama/wisp) event bus) is
composed only if you have wisp available; grove never requires it. Augment-never-clobber
throughout, and idempotent on re-run.

## What it bundles

- **`skills/setup`** — `/grove:setup`: compose the thirteen agent roles onto your project.
- **`skills/remove`** — `/grove:remove`: cleanly un-compose (delete the composed files, strip the
  `CLAUDE.md` block — asks before deleting anything).
- **`skills/set-profile`** — `/grove:set-profile <preset>`: switch the gate-profile
  (`.grove/gates.toml`) to a named preset (`steward` / `guardian` / `initiator`), wholesale, with a
  diff + confirm and a re-run of the intent-locus floor validator (`adr-0018`).
- **`gates/`** — the zero-dependency gate-profile machinery (`adr-0018`): preset expansion, the
  intent-locus floor validator, and the load-time floor-guard with its `guardian` fallback. Setup
  copies it to a consumer's `.grove/internal/gates/`.
- **`reference/agents/`** — the thirteen agent definitions plus their `README.md`, vendored from this
  repo's own `.claude/agents/` — the payload `/grove:setup` copies from and resolves.
- **`reference/skills/grove-status/`** — the runtime-telemetry skill, vendored from this repo's own
  `.claude/skills/grove-status/`. Its governing charter (commands, addressing, invariants) is
  [`../../charters/grove-status.md`](../../charters/grove-status.md) in the source repo — not
  itself vendored into the plugin payload, same as every other charter.

## Sync note

The `reference/` payload is **vendored** from this repo's canonical `.claude/agents/` and
`.claude/skills/grove-status/` — each file gains exactly one header line
(`<!-- vendored from ... -->`) and is otherwise byte-identical to its source. When the canonical
copies change, re-vendor `reference/` in the same change; the two must never drift apart.

## Plugin vs. hand-vendoring

This plugin is the **canonical route** for adopting grove. The repo's own `README.md` still keeps a
manual, hand-vendoring path as a fallback (§Adopting grove in your project) for projects that can't
or don't want to install a Claude Code plugin.
