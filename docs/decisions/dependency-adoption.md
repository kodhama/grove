---
type: decision
title: "Dependency adoption"
description: Why each dependency grove carries was adopted, its scope, and what was turned down for it.
tags: [dependencies, decisions]
decided: 2026-10-07
ticket: GRO-6
---

# Dependency adoption

**Grove ships no runtime dependency a user installs.** A plugin install runs
no `npm install`, so anything the skills' scripts need at run time is vendored
into the skill that uses it. The rest are development-only: they run grove's
tests and typecheck, and never reach an install.

Add a dependency only with a dated decision here (`AGENTS.md`).

**2026-10-07 decision: vitest** (development only, `^5.0.1`). Grove's tests
came from math-quest, where they ran on vitest, and they run on it here
unchanged. Rewriting about 4,900 lines to `node:test` was turned down as risk
with no benefit (lead ruling L3, GRO-6).

**2026-10-07 decision: typescript** (development only, `^5.7.2`). The tests
are TypeScript, and `npm run typecheck` checks them with `tsc --noEmit`. It
ships nothing: the skills' scripts are plain JavaScript and shell.

**2026-10-07 decision: @types/node** (development only, `^26.5.0`). It came
with typescript: `tsconfig.json` loads the Node types the tests use
(`node:fs`, `node:child_process` and the rest). It ships nothing.

**2026-10-07 decision: smol-toml, vendored** (1.8.0, BSD-3-Clause). The
receipt check reads a routing table's `fresh_context` marks from TOML, and it
must run from a plugin install with no `npm install`. smol-toml's ES module
build sits unchanged in `skills/supervision-setup/scripts/vendor/smol-toml/`,
with its licence and a note naming the tarball and its integrity; the tests
read the same copy. Turned down (lead ruling L2, GRO-6):

- a hand-written TOML reader of about 30 lines: TOML is a large outside
  standard, and a partial reader misreads exactly the tables it was not
  written for;
- moving `fresh_context` into `bindings.json`: it changes the bindings
  contract, which the move to grove keeps as it is.

To update it, follow the vendored copy's `README.md`, then date the new
version here.
