# .grove/ — grove-self's own dials

grove is its own first consumer (`adr-0021` grove-to-grove; `adr-0026`
thin-vendor): this directory holds the same consumer-authoritative dials a
consuming repo gets from `/grove:setup`, with the collapsed-case differences
of running inside the repo that authors the payload. Effect of each dial:

- **`gates.toml`** — who must approve at each of the four gates
  (`intent` / `spec` / `build` / `ship`): `human` or `agent`. The floor
  (`adr-0018`): `intent` or `ship` must be `human`, validated on every
  run-sequencing read. Collapsed case: the machinery resolves from the
  native payload (`runtime_dir = "plugins/grove/gates/"`, `adr-0021`
  D1/D2), so no installed `.grove/internal/` exists here. Switch presets
  with `/grove:set-profile`.
- **`config.toml`** — the shared role tokens (`adr-0026` D3) grove agents
  resolve at use time: test/typecheck commands, corpus paths, rubric
  paths. Values are **verified priors** — agents verify before relying,
  disclose mismatches loudly, and route fixes back to that file rather
  than silently working around a stale value. "None exists yet" is an
  honest value.
- **`agents/<role>.md`** — optional per-role addenda (local rules, worked
  examples) a generic `grove:<role>` agent reads when present. None
  authored here yet.

**How the fleet loads.** The thirteen roles ship in
`plugins/grove/agents/` as `grove:<role>` subagents (`adr-0026` D1) — but
they are **not** auto-loaded just by living in this tree. To run them
against your own working copy — the dogfood path, including charter edits
on an unmerged branch — launch with `claude --plugin-dir ./plugins/grove`,
which loads the payload **live from the working tree** for that session
(and `/reload-plugins` re-reads it within a session). Without the flag, a
session gets `grove:<role>` only from an *installed* grove plugin, which
reflects the last **published** version — not your edits. Do **not**
reintroduce a `.claude/agents/` copy of the fleet to shortcut this: a
project-tier agent shadows the `--plugin-dir` payload (precedence:
Project > Plugin), silently overriding your live edits — the very
copy-drift `adr-0026` P1 retired.

**No version stamp here.** Consuming repos record `grove plugin@<version>`
in their `AGENTS.md` managed block (`adr-0026` D4, with the location
superseded by `adr-0033`); Claude loads it through `@AGENTS.md`. Grove-self
loads its fleet from this same tree via `--plugin-dir` (above), so there is no
published version to pin. The operating model itself (lifecycle enum, versioning
grammar, edge taxonomy) is not restated here either (`adr-0008`): it is
canonical in `charters/{lifecycle,versioning,relations}.md` and
plugin-carried for consumers (`adr-0026` D7).
