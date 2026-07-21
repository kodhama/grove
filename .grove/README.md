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

**No version stamp here.** Consuming repos record `grove plugin@<version>`
in their CLAUDE.md managed block (`adr-0026` D4); grove-self runs the
canonical `charters/` and the payload in this same tree, so there is
nothing to pin. The operating model itself (lifecycle enum, versioning
grammar, edge taxonomy) is not restated here either (`adr-0008`): it is
canonical in `charters/{lifecycle,versioning,relations}.md` and
plugin-carried for consumers (`adr-0026` D7).
