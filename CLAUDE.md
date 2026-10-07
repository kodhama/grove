@AGENTS.md

# CLAUDE.md — Claude Code specifics

Everything above arrives from `AGENTS.md`, the tool-neutral instruction set,
which applies here unchanged; this file adds only what depends on Claude Code.

**Declaring a plugin in `.claude/settings.json` does not install it.** Run
`claude plugin install compound-engineering@compound-engineering-plugin` once
per machine (user scope covers every checkout), then start a fresh session:
an install does not reach a session already running.

Do not put `permissions.defaultMode` in `.claude/settings.json`: a project
value shadows the maintainer's user-level one.
