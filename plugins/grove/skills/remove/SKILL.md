---
name: remove
description: Remove grove from this project — delete the composed .grove/ overlay and optional skill, strip the managed block from AGENTS.md or a legacy CLAUDE.md, and ask before deleting anything, touching nothing else. Also reverses what older grove installs vendored. Use when the user asks to remove, uninstall, undo, or take out grove from their repo.
---

# Remove grove from this project

Cleanly reverse what `/grove:setup` composed. This is augment-never-clobber **in reverse**: remove
only what grove added, asking before any deletion, and preserve everything else byte-for-byte.

**The agent roles themselves are not files in this repo** (`adr-0026`: the fleet is
plugin-carried, loaded as `grove:<role>` from the plugin). Removing repo files does not unload
them — tell the user that disabling or uninstalling the plugin itself is
`/plugin` (uninstall `grove@kodhama`), outside this skill's file work.

## 1. Find what was composed

A current (thin-vendor, post-`adr-0026`) install comprises:

- **`.grove/gates.toml`** — the gate-profile (consumer-authoritative).
- **`.grove/config.toml`** — the shared role config (consumer-authoritative, `adr-0026` D3).
- **`.grove/agents/<role>.md`** — optional per-role addenda the consumer may have authored.
- **`.grove/README.md`** — the dial-explainer.
- **`.grove/internal/gates/`** + **`.grove/internal/enforcement.toml`** — the grove-managed
  floor-guard machinery and C1 defaults.
- The managed **`AGENTS.md` block** (`grove:begin`…`grove:end`, with the
  version stamp), or its legacy location in `CLAUDE.md`.

**Older installs left more** — check for each of these too:

- **Pre-`adr-0026` (vendored-fleet) installs:** grove role files vendored into
  `.claude/agents/` (up to fourteen roles — the pre-`adr-0026` roster included `auditor`, since
  retired by `adr-0027` — plus their `README.md`) and installed companions —
  `.grove/internal/{lifecycle,versioning,relations}.md` (or, older still, at the `.grove/` root).
- **Pre-`adr-0027` (CI check) installs:** the `.grove/internal/check/` runtime, the workflow file
  `.github/workflows/grove-review-bookkeeping.yml`, and the split policy carrier —
  `.grove/review.toml` plus `.grove/internal/review-wiring.toml` (`adr-0018` D10). Both the
  setup-era check step and the then-standalone `/grove:check-install` wrote the same pieces.
- **Pre-`adr-0032` status-adapter installs:** `.claude/skills/grove-status/`.
  Grove no longer ships or maintains this Wisp adapter; identify it explicitly
  as a legacy Grove-managed path before offering removal.

Also look for the **tooling-ignore entry** setup may have added (with consent): a `.grove/` line
(or a `.grove/**` glob) in `.eslintignore`, `.prettierignore`, `.markdownlintignore`, the
`ignores` field of `eslint.config.*`, or the `files.ignore` array in `biome.json`. It may not be
present; find it if it is (step 6 reverses it).

## 2. Ask before deleting

Show the user the exact list of files you found and ask for confirmation before deleting any of
them. Delete only what they confirm. Files carrying the **consumer's own choices** deserve an
explicit call-out before removal: `.grove/gates.toml` (a tuned profile), `.grove/config.toml`
(their resolved tokens), and any `.grove/agents/` addenda (entirely their authorship). Do not
assume every file in `.claude/agents/` was put there by grove — a repo's **own** roles live there
legitimately (`adr-0026` D5); if a file's origin is unclear (no way to tell it apart from
something the user wrote themselves), ask rather than delete it.

## 3. Strip the managed block from the project entrypoints

After the step 2 confirmation, run:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/instruction-entrypoints.mjs" strip --project-root "$PWD"
```

The deterministic helper removes every valid Grove marker block from
`AGENTS.md` and legacy `CLAUDE.md`, preserves every unrelated byte, and leaves
the generic `@AGENTS.md` adapter in place because shared project instructions
or another overlay may still need it. Malformed markers refuse without writes.

The helper never deletes an entrypoint. If either becomes whitespace-only,
show that exact file and ask separately before deleting it; otherwise leave it.

## 4. decisions/ and specs/ stores

If `/grove:setup` seeded `decisions/README.md` and/or `specs/README.md` and the user has since
added real decisions/specs into those directories, **do not delete the directories** — ask first,
same as step 2. An empty seeded store with nothing added since is safe to remove if the user
confirms; a store with real content is not grove's to delete.

## 5. Remove the core `.grove/` overlay

Same augment-never-clobber-in-reverse discipline, **asking before deleting anything the user may
have tuned**:

- **`.grove/gates.toml`** — if the user has switched presets or hand-edited a row, **ask first**
  rather than discarding their choice; an untouched install-written copy is safe to remove on
  confirmation.
- **`.grove/config.toml`** — their resolved tokens; same ask-first discipline.
- **`.grove/agents/`** addenda — consumer-authored; confirm explicitly per file.
- **`.grove/README.md`** — the regenerated dial-explainer; safe on confirmation.
- **`.grove/internal/gates/`** — the grove-managed floor-guard machinery. Safe to delete if it
  matches the vendored copy; if hand-edited, ask.
- **`.grove/internal/enforcement.toml`** — grove-managed C1 defaults; safe on confirmation.

## 5b. Legacy pieces, if an older install left them

- **Vendored fleet (pre-`adr-0026`):** the grove role files in `.claude/agents/` and their
  `README.md`. If the user has hand-edited or locally adapted any (the reason the D6 migration
  harvests before deleting), ask per file; never touch a role the repo owns.
- **Installed companions (pre-`adr-0026`):** `.grove/internal/{lifecycle,versioning,relations}.md`
  (or at the `.grove/` root on the oldest layouts). Reference prose; safe on confirmation unless
  hand-edited.
- **The GitHub bookkeeping check (pre-`adr-0027`):** reverse exactly these pieces —
  - **`.grove/internal/check/`** — the vendored check runtime. Safe to delete if it matches the
    vendored copy; if hand-edited, ask. (Zero deps were installed, so there is no `node_modules`
    to clean up.)
  - **`.github/workflows/grove-review-bookkeeping.yml`** — remove **only** this file; **touch no
    other workflow**. If the directory is left empty and grove created it, removing the empty
    directory is fine; if it holds other workflows, leave it.
  - **`.grove/review.toml`** — the consumer policy carrier (`adr-0018` D10). If the user has
    edited its scope/allowlist for their own corpus, **ask first**; an untouched install-written
    copy is safe on confirmation.
  - **`.grove/internal/review-wiring.toml`** — grove-managed wiring; safe on confirmation.

If `.grove/internal/` is left empty after removals and grove created it, removing the empty
directory is fine; likewise `.grove/` itself once nothing grove-owned remains.

## 6. Strip the `.grove/` tooling-ignore entry, if setup added one

The symmetric inverse of setup's ignore offer (**augment-never-clobber in reverse**): if setup
added a `.grove/` (or `.grove/**`) line to any linter/formatter ignore — the entries found in
step 1 — offer to remove it, and on a **yes** remove **only that one line**, touching **nothing
else** in the file. Discipline, per ignore file:

- Remove **only** the `.grove/` entry setup wrote; every other ignore line the user maintains
  stays exactly as it was.
- If setup **created** a dedicated ignore file solely to hold that line (e.g. a `.prettierignore`
  or `.markdownlintignore` that now contains only `.grove/`), removing the now-empty file is fine
  on confirmation; if the file holds other entries, leave the file and strip only the one line.
- If a `.grove/` line's origin is unclear (the user may have added it themselves), **ask rather
  than delete** — same discipline as step 2. If no such entry exists, skip this step.

## 7. Confirm

Tell the user exactly what you removed (which `.grove/` files, any legacy pieces — the
`grove-status` adapter if present, vendored role files, installed companions, the check runtime +
workflow + policy carriers — any `.grove/` tooling-ignore line stripped and from which file, and
the `AGENTS.md`/legacy `CLAUDE.md` block), and remind them the plugin itself (the `grove:<role>` agents and these
skills) unloads via `/plugin`, not file deletion. If nothing was present, say so plainly — **do
not invent changes**.
