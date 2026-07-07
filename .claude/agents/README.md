# .claude/agents/

Ready-to-drop-in Claude Code subagent definitions, one per cold-started
gardener role. Each is generated from its charter in
[`../../charters/`](../../charters/) — that file is the source of truth
and carries the provenance note; these carry the `name`/`description`/
`tools` frontmatter Claude Code expects.

Copy the ones you need into your own project's `.claude/agents/`, then
fill in each file's placeholders (angle-bracketed tokens like
`<TEST_CMD>`).

**No `head-gardener.md` here, deliberately.** ADR-0030 charters
head-gardener as "cold-started: the interactive session (v0)" — it IS
the session driving the swarm, not a role that session dispatches out
to. See `charters/head-gardener.md` for its charter and the note
explaining the omission.

| File | Stage | Role |
|---|---|---|
| `divergent-researcher.md` | 1 | research discipline; loud abort |
| `shaper.md` | 2 | decision canvases; never decides (interactive) |
| `contract-author.md` | 3 | specs from approved intent; never implements |
| `spec-adversary.md` | 3½ | breaks `gated` specs before human approval |
| `executor.md` | 4 | test-first implementation from artifacts only |
| `conformance-reviewer.md` | 4½ | build gate vs. approved upstream |
| `validator.md` | 5 | per-PR critique + triggered drift audits |
| `run-resumer.md` | remediation | resumes a run that died at its turn cap |
| `propagation-remediator.md` | remediation | writes an honest missing propagation section |
