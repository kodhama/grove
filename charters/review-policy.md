---
id: policy-review-bookkeeping
type: policy
status: gated
implements: spec-0002-review-bookkeeping-check  # the realized contract: this file is the Q7 non-charter policy carrier that spec defines
depends_on: [spec-0002-review-bookkeeping-check, adr-0012-methodology-delivery-machinery]
owner: agent
updated: 2026-07-16
---

# review-policy — the non-charter policy inputs for the bookkeeping check

> Provenance: created per `spec-0002-review-bookkeeping-check` Open Q7's
> named default — *"declarations live in each reviewer charter as a
> fenced machine-readable block; the non-charter inputs live in one
> policy file on the protected branch."* This is that one policy file.
> Like `lifecycle.md`, it is not an agent role: no pipeline stage, never
> dispatched.

The bookkeeping check (`adr-0012` Layer A; `spec-0002`) resolves every
policy input from the **protected default branch**, never PR HEAD
(`spec-0002` §C.1, AC5):

- **the owed-review map** — assembled at run-time from each reviewer
  charter's fenced `grove-review-declaration` block (fields: `schema`,
  `review`, `types`, `pass_class`) in `charters/conformance-reviewer.md`,
  `charters/decision-adversary.md`, `charters/spec-adversary.md`, and
  `charters/code-reviewer.md` — never from a stored table, and never
  from this file;
- **everything else** — the fenced `grove-review-policy` block below.

A missing key in the block falls to the spec's named fail-closed interim
(`spec-0002` Q7): an absent reviewless declaration means those types owe
the full set; an absent allowlist exempts nothing; an absent
artifact-dir list means the stated default; an absent
`record_poster_allowlist` means the platform-role default of `spec-0002`
§A.4. No absence is ever a silent pass.

## Policy block (machine-readable)

```grove-review-policy
schema: 1

# §A.3 step 1 — the directories globbed to build the artifact index
# (frontmatter `id` → path).
artifact_dirs: [decisions, specs, charters]

# §B — positive reviewless declarations. Only a type listed here owes
# nothing; an absent or unclaimed type owes the FULL review set
# (fail-closed, INV7/AC4).
reviewless_types: [research, feedback]

# §C.2 — the non-behavioral allowlist: EXPLICIT repo-relative paths
# only (never a class, glob, or directory), each honored only if it
# also passes the prose predicate below (INV14/AC5). README-class
# orientation prose only — never a review-free zone for code.
non_behavioral_allowlist:
  - README.md
  - CONTRIBUTING.md
  - charters/README.md
  - decisions/README.md
  - specs/README.md
  - .claude/agents/README.md
  - plugins/grove/README.md
  - plugins/grove/reference/agents/README.md

# §C.2 — the prose predicate's extension set: an allowlisted path is
# honored only if its extension is in this set AND its first line is
# not a shebang.
prose_extensions: [.md, .txt, .rst]

# §A.4 — record-poster allowlist. Deliberately absent: the check uses
# the spec's default (platform author_association ∈ {OWNER, MEMBER,
# COLLABORATOR}). Add a `record_poster_allowlist:` list of identities
# here to override it.
```

## Boundaries

- This file carries **bookkeeping policy only** — which paths are
  exempt, which types are reviewless, where the index looks. What each
  review *is* stays in the reviewer charters; what the check *does*
  stays in `spec-0002`. Nothing here grants approval, and changing this
  file is itself a change the check gates fail-closed (an undeclared
  `type: policy` owes the full review set — deliberate, not an
  oversight).
- Changes to policy are **human-owned** (`adr-0012` AC8): agents
  propose, the human approves.
