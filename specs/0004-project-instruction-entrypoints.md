---
id: spec-0004-project-instruction-entrypoints
type: spec
status: gated
depends_on: [adr-0033-agents-canonical-project-instructions]
owner: agent
updated: 2026-07-23
---

# Project instruction entrypoints

> **Amendment class:** new current-truth contract implementing
> `adr-0033-agents-canonical-project-instructions`.
> **VALUE:** a Grove consumer edits shared rules once and both Claude Code and
> Codex load them without drift.
> **CONFIDENCE:** verified against the two hosts' documented instruction
> entrypoints; migration behavior is fixture-tested.

## Scope

This contract governs Grove's managed project-instruction block, the Claude
adapter, and the setup/refresh/remove operations that maintain them. It does
not make Grove the owner of consumer prose or another overlay's marked block.

## Canonical state

After setup or refresh:

1. `AGENTS.md` exists.
2. It contains exactly one matched `grove:begin` / `grove:end` block with the
   installed plugin version.
3. `CLAUDE.md` contains exactly one standalone `@AGENTS.md` import.
4. `CLAUDE.md` contains no Grove block.
5. Neither entrypoint imports the other in a cycle.
6. All content outside Grove's legacy/current block and the adapter import is
   byte-preserved.
7. The Grove block tells maintainers and agents that shared project
   instructions are added to unmarked `AGENTS.md` prose, Claude-only rules go
   in `.claude/rules/`, Grove dials go in `.grove/`, and neither the block nor
   the `CLAUDE.md` adapter is hand-edited.

## Recognized syntax

The helper reads and writes UTF-8 text. It preserves each existing file's
newline convention and final-newline state outside the exact spans it owns.

An active marker or import is a standalone line outside a Markdown fenced code
block. Fences use CommonMark backtick or tilde fence openers of at least three
characters and close with the same character and at least the opener's length.

- A Grove begin marker is a line whose horizontally trimmed form starts with
  `<!-- grove:begin` and ends with `-->`.
- A Grove end marker is a line whose horizontally trimmed form starts with
  `<!-- grove:end` and ends with `-->`.
- The only accepted Claude imports for this relative target are standalone
  `@AGENTS.md` and `@./AGENTS.md` lines after horizontal trimming. Composition
  canonicalizes them to one `@AGENTS.md` line.
- A cycle is an active standalone `@CLAUDE.md` or `@./CLAUDE.md` line in
  `AGENTS.md`.

Markers must form one ordered pair per file. More than one begin/end, an
unmatched marker, or an end before its begin is malformed. Text resembling a
marker/import inside a fenced example is ordinary prose.

## Migration

Composition implements this complete two-file matrix:

| `AGENTS.md` input | `CLAUDE.md` input | Result |
|---|---|---|
| absent | absent | create canonical block; create exact adapter |
| present, no block | absent or no block | append canonical block; create/ensure adapter while preserving unrelated prose in its original file |
| one valid block | absent or no block | replace only that block; create/ensure adapter |
| absent or no block | one valid legacy block | remove that block from Claude, append the canonical block to Agents, ensure the adapter, and preserve other prose in its original file |
| one valid block | byte-identical file with the same block | retain the whole shared copy in Agents, update its block, and collapse Claude to the exact adapter |
| one valid block | non-byte-identical file with one valid block | refuse as ambiguous |
| malformed markers in either file, or an import cycle | any | refuse |

The byte-identical collapse is the only intentional per-file preservation
exception: duplicated non-Grove prose is removed from `CLAUDE.md` but remains
unchanged in `AGENTS.md`. Every other matrix row preserves unrelated bytes in
the same file.

Running composition twice with the same plugin version produces no second-run
diff.

## Removal

After the user confirms removal, the helper removes every valid Grove block:
zero or one from `AGENTS.md` and zero or one from legacy `CLAUDE.md`. Two valid
blocks are both removed even if their surrounding files differ, because marker
ownership is unambiguous during explicit removal. It preserves the Claude
adapter and all unrelated content. Malformed marker states fail without
writing.

Removal never deletes either entrypoint. If a file becomes empty, the skill
may offer that exact deletion separately under its existing confirmation gate.

## Command interface

The bundled zero-dependency helper exposes:

```text
instruction-entrypoints.mjs compose --project-root <absolute-or-relative-path>
instruction-entrypoints.mjs strip   --project-root <absolute-or-relative-path>
instruction-entrypoints.mjs check   --project-root <absolute-or-relative-path>
```

`compose` and `check` derive the plugin version from the adjacent
`.claude-plugin/plugin.json`; `check` compares the stamped block to it.
`strip` needs no version.

- Exit `0`: success. Emit one JSON object on stdout containing `command`,
  `changed`, `agentsPath`, `claudePath`, and command-specific facts.
- Exit `1`: environmental/I/O/argument failure. Emit a concise error on
  stderr.
- Exit `2`: contract refusal or, for `check`, non-canonical state. Emit a
  concise diagnostic on stderr.
- `check` never mutates. It succeeds only for the canonical state.
- A refused `compose` or `strip` performs no writes. Successful multi-file
  writes use sibling temporary files and rename only after the full
  transformation has been computed.

## Skill contract

- Setup composes the canonical state and reports the resulting entrypoint
  paths.
- Refresh performs the same composition, including legacy migration.
- Remove previews the affected entrypoint and invokes removal only after the
  existing confirmation gate.
- All three skills use the bundled helper; none asks an agent to hand-edit the
  marker block.
- `CONVENTIONS_PATH` examples and Grove-generated prose default to
  `AGENTS.md`.

## Acceptance criteria

- A zero-dependency Node helper implements compose, strip, and check commands.
- Fixture tests cover every accepted and refused state above.
- Refused states leave both files byte-identical to their pre-command state.
- Fixture tests assert the exact ownership/edit-routing prose in the generated
  Grove block.
- Setup, refresh, and remove reference the helper and no longer declare
  `CLAUDE.md` as the Grove block owner.
- Grove's own `AGENTS.md` is canonical and its `CLAUDE.md` is the adapter.
- The bounded current-truth corpus—root `README.md`, `plugins/grove/README.md`,
  `.grove/{README.md,config.toml}`,
  `plugins/grove/skills/{setup,refresh,remove}/SKILL.md`, `charters/*.md`, and
  `plugins/grove/agents/*.md`—names `AGENTS.md` for shared project conventions
  and the Grove stamp. Historical decisions may retain old wording only where
  a forward pointer to ADR-0033 accompanies the outgrown location claim.
- Existing gate and review-check suites remain green.

## Open questions

None.
