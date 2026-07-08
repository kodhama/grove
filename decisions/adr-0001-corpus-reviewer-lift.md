---
id: adr-0001-corpus-reviewer-lift
type: adr
status: gated
depends_on: []
owner: agent
updated: 2026-07-08
---

# ADR-0001: lift trellis's corpus linter into grove as the corpus-reviewer role

## Context

Installing grove into the trellis repo (kodhama grove-install wave,
2026-07-08) collided by name with a pre-existing, trellis-native
`.claude/agents/conformance-reviewer.md` — an **artifact-corpus linter**
(frontmatter, lifecycle membership, id uniqueness, `depends_on`
resolution, directional flow, supersession integrity, plus
trellis-typed catalog/profile checks; read-only, no Bash). Grove's
`conformance-reviewer` is a different thing: the stage-4½ **build gate**
(one change against its approved upstream; runs tests itself). Same
name, different object of review, different tool grant.

The maintainer's call, verbatim intent: rather than rename around the
collision, *"wouldn't it make sense to generalize it to all?"* — every
family repo now keeps a `decisions/`+`specs/` corpus under the same
artifact contract and the same lifecycle
(`kodhama-0004-uniform-lifecycle`), so a corpus audit is not
trellis-specific.

## Decision

1. Grove gains an eleventh role, **`corpus-reviewer`** — standing,
   read-only, report-only: the record audits itself honestly
   (`charters/corpus-reviewer.md` + `.claude/agents/corpus-reviewer.md`).
   Checks 1–7 are the trellis tool's checks with trellis nouns removed;
   corpus dirs, contract paths, and repo-typed extra checks are
   placeholders.
2. Grove's `conformance-reviewer` (build gate) keeps its canonical name
   everywhere.
3. Trellis's native file becomes the **reference instance** of the new
   role: at trellis's grove install it renames to `corpus-reviewer.md`,
   keeps its content (including its catalog/profile checks as the
   repo-typed extras), and the collision dissolves.

## Consequences

- Future grove installs compose eleven roles, not ten.
- The plugin's vendored `reference/agents/` payload gains
  `corpus-reviewer.md` **after** the plugin PR merges (kept-in-sync
  rule; tracked as a follow-up, deliberately not entangled with the
  in-flight plugin PR).
- Already-completed installs (wisp, kodhama, design-system) owe a
  one-file catch-up composing the new role — a small follow-up wave.
- README's team table gains the row; the role is standing (no pipeline
  stage), like the remediation roles it sits outside the stage flow.
