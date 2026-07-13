# .claude/agents/

Ready-to-drop-in Claude Code subagent definitions, one per cold-started
agent role. Each is generated from its charter in
[`charters/`](https://github.com/kodhama/grove/tree/main/charters) — that file is the source of truth
and carries the provenance note; these carry the `name`/`description`/
`tools` frontmatter Claude Code expects.

Copy the ones you need into your own project's `.claude/agents/`, then
fill in each file's placeholders (angle-bracketed tokens like
`<TEST_CMD>`).

**The lifecycle companion is not an agent role and does not live
here.** The artifact-lifecycle state enum — stated once, sourced by
every role and the `corpus-reviewer`'s lifecycle check — is installed
by setup to **`.grove/lifecycle.md`** (grove's own namespace, not this
loader directory; `adr-0008` as amended) on every install.

**`dispatcher.md` is scoped, not a full peer of the rest.** ADR-0030
charters head-gardener as "cold-started: the interactive session (v0)"
— sequencing a whole run requires state that survives across dozens of
dispatches, which a one-shot subagent invocation cannot hold. The
driving session remains the actual dispatcher across a run. This
file is a narrow one-shot advisor for two bounded sub-judgments
(workflow classification, next-dispatch recommendation) — see the
file's own "Why this file is narrower" section and
[`charters/dispatcher.md`](https://github.com/kodhama/grove/blob/main/charters/dispatcher.md) for the full role it does not replace.

| File | Stage | Role |
|---|---|---|
| `divergent-researcher.md` | 1 | research discipline; loud abort |
| `shaper.md` | 2 | decision canvases; never decides (interactive) |
| `contract-author.md` | 3 | specs from approved intent; never implements |
| `spec-adversary.md` | 3½ | breaks `gated` specs before human approval |
| `executor.md` | 4 | test-first implementation from artifacts only |
| `conformance-reviewer.md` | 4½ | build gate vs. approved upstream |
| `code-reviewer.md` | 4½ | code-quality gate vs. the project's declared standards; blocking ≥ high (objective harm only), rest advisory |
| `validator.md` | 5 | per-PR critique + triggered drift audits |
| `run-resumer.md` | remediation | resumes a run that died at its turn cap |
| `propagation-remediator.md` | remediation | writes an honest missing propagation section |
| `dispatcher.md` | dispatch | one-shot classify/next-dispatch advisor only — not a sequencer |
| `corpus-reviewer.md` | standing | artifact-corpus conformance vs the repo's own contract; report-only |
