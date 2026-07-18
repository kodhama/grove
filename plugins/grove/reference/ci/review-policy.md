<!-- adapted for consumers from grove-self's charters/review-policy.md (its Q7 policy carrier): grove-repo-specific allowlist paths genericized; the policy-block schema + fail-closed semantics kept verbatim. The consumer edits this to their own corpus. -->
---
# Consumer policy carrier for the grove bookkeeping check. Deliberately
# carries NO `id`/`implements`/`depends_on`: this template must not collide
# with grove-self's own `policy-review-bookkeeping` id, and must not dangle
# references to grove-internal artifacts (spec-0002 / adr-0012) that don't
# exist in a consumer repo. Only the `grove-review-policy` fenced block below
# is machine-read.
type: policy
status: gated
owner: agent
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
  `review`, `types`, `pass_class`). In a grove **consumer** these live in
  the composed reviewer agents under `.claude/agents/` (the check
  auto-discovers them by precedence — see `spec-0002` §C.0); the map is
  never a stored table, and never lives in this file.
- **everything else** — the fenced `grove-review-policy` block below.

A missing key in the block falls to the spec's named fail-closed interim
(`spec-0002` Q7): an absent reviewless declaration means those types owe
the full set; an absent allowlist exempts nothing; an absent
artifact-dir list means the stated default; an absent
`record_poster_allowlist` means the platform-role default of `spec-0002`
§A.4. An absent — or unrecognized — `scope` means `strict` (`adr-0013`
dec 2, `spec-0002` §C.1: fail-closed, never a silent softening); absent
carrier keys fall to the install defaults, never to silent exclusion.
No absence is ever a silent pass.

## Policy block (machine-readable)

```grove-review-policy
schema: 1

# §A.3 step 1 — the directories globbed to build the artifact index
# (frontmatter `id` → path). Adjust to this project's corpus layout.
artifact_dirs: [decisions, specs, charters]

# §B — positive reviewless declarations. Only a type listed here owes
# nothing; an absent or unclaimed type owes the FULL review set
# (fail-closed, INV7/AC4).
reviewless_types: [research, feedback]

# §C.2 — the non-behavioral allowlist: EXPLICIT repo-relative paths
# only (never a class, glob, or directory), each honored only if it
# also passes the prose predicate below (INV14/AC5). README-class
# orientation prose only — never a review-free zone for code. Replace
# these with THIS project's orientation-prose paths (an entry that
# matches no file is simply inert).
non_behavioral_allowlist:
  - README.md
  - .claude/agents/README.md

# §C.2 — the prose predicate's extension set: an allowlisted path is
# honored only if its extension is in this set AND its first line is
# not a shebang.
prose_extensions: [.md, .txt, .rst]

# §A.4 — record-poster allowlist. Deliberately absent: the check uses
# the spec's default (platform author_association ∈ {OWNER, MEMBER,
# COLLABORATOR}). Add a `record_poster_allowlist:` list of identities
# here to override it.

# adr-0013 / spec-0002 §B, §C.1 — the check's scope mode, chosen at
# install time (the one setup question) and recorded here.
#   strict — every changed file in a PR is the check's business:
#            anything not positively declared reviewless owes the full
#            review set, fail-closed over the whole repo.
#   scoped — the check governs only what is declared into the
#            methodology (files under artifact_dirs, files whose
#            frontmatter declares a type, code opted in via a test-deps
#            ledger, and the gate's own carriers below); everything
#            else is outside its jurisdiction — not red, not exempted.
# ABSENT OR UNRECOGNIZED ⇒ strict (fail-closed): deleting or
# misspelling this key can only widen jurisdiction, never soften the
# gate. The <SCOPE> slot is resolved to `scoped` or `strict` by
# /grove:setup or /grove:check-install at install time — no install
# leaves it absent.
scope: <SCOPE>

# adr-0013 dec 1 — carriers-of-record for the gate's own machinery:
# where the installed check runtime and workflow actually live. In
# scoped mode these paths (with this policy file, the reviewer
# declarations, and every test-deps ledger) stay in the check's
# jurisdiction in both modes, so an edit to the check's own machinery
# is never silent. The slots are resolved to the real install paths by
# /grove:setup or /grove:check-install. If a key is absent it falls to
# the install default (`.grove/internal/check/`;
# `.github/workflows/grove-review-bookkeeping.yml`) — never to silent
# exclusion — and in scoped mode a carrier path that does not exist on
# the protected branch is a red (`carrier-unresolved`), so a relocated
# install must update these keys to match.
check_runtime_dir: <CHECK_RUNTIME_DIR>
check_workflow_path: <CHECK_WORKFLOW_PATH>
```

## Boundaries

- This file carries **bookkeeping policy only** — which paths are
  exempt, which types are reviewless, where the index looks. What each
  review *is* stays in the reviewer charters/agents; what the check
  *does* stays in `spec-0002`. Nothing here grants approval, and changing
  this file is itself a change the check gates fail-closed (an undeclared
  `type: policy` owes the full review set — deliberate, not an
  oversight).
- Changes to policy are **human-owned** (`adr-0012` AC8): agents
  propose, the human approves.
