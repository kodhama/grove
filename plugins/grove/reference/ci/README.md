# The grove review-bookkeeping check

Consumer orientation for the optional GitHub CI check grove installs
(`spec-0002`, `adr-0012` Layer A). Install it via `/grove:setup`
(offered during install) or standalone, any time later, with
`/grove:check-install`. Remove it with `/grove:remove`. GitHub Actions
only; zero runtime dependencies; read-only permissions.

## What it is — bookkeeping, not review

A CI job that runs on every PR and renders a read-only status view of
the PR's **verdict records** — the structured review-verdict comments
grove's reviewer agents post on the PR. It does no reviewing itself and
posts nothing. It checks the *bookkeeping* of review: that every review
a changed file owes has a recorded verdict that is covering, fresh
(content unchanged since the review), passing, separated (reviewer ≠
producer), and non-vacuous — and that upstream contracts are approved
and every declared artifact reference resolves.

## What green means, what red means

- **Green = bookkeeping complete — NOT approval.** Every owed review
  has a fresh, covering, passing record. A human still judges
  genuineness and merges; the check's green authorizes nothing, and its
  own banner says so on every run.
- **Red = a named gap, and who fixes it.** Every red row carries its
  reason: `never-reviewed` (dispatch the missing reviewer), a stale
  fingerprint (re-review after the edit), `review-failed` (the producer
  addresses the recorded findings), `awaiting-human-approval` (a human
  approves the upstream artifact), `no-reviewable-upstream` (the
  producer declares the `implements:` edge or the test-deps ledger),
  `unresolvable-reference` (fix the dangling or duplicated artifact
  id), and so on. Red is a to-do list with owners, not a verdict on the
  work's worth.

## `scoped` vs `strict`, in plain terms

The check runs in one of two modes, chosen at install time by one
question and recorded as `scope:` in `.grove/review-policy.md`
(`adr-0013`):

- **`scoped`** (recommended to start) — the check watches only what is
  declared into the methodology: files under your declared artifact
  directories, files whose frontmatter declares a `type:`, code that
  opted in via a test-deps ledger, and the gate's own machinery. Your
  ordinary application code is *outside its jurisdiction* — not red,
  not exempted — and the status header names the mode and the
  jurisdiction count (e.g. "scoped mode: 3 of 14 changed files in
  jurisdiction") so a green is never mistaken for a whole-repo verdict.
- **`strict`** — every changed file in a PR is the check's business;
  anything not positively declared reviewless owes the full review set.
  The right mode once most of what changes in the repo is grove-run
  work.

**Absent or unrecognized `scope` ⇒ `strict`** — fail-closed; softness
is never inferred from silence, so a hand-edit can't quietly soften the
gate. And inside jurisdiction, `scoped` softens nothing: the same rules
apply, to fewer files.

## Where the rules come from — assembled live, never compiled

The owed-review map (which reviews each kind of file owes) is assembled
**at run-time, on every run**, from the reviewer-agent declarations
installed in `.claude/agents/` (their `grove-review-declaration`
blocks) plus the `grove-review-policy` block in
`.grove/review-policy.md` — all read from the protected default branch,
never from the PR's own branch. There is no compiled map to regenerate:
changing what a type owes is an agent-declaration edit.

## Incidental frontmatter (`type: post` and friends)

Scoped-mode jurisdiction follows **any** frontmatter `type:`
declaration, recognized or not — so a static-site repo whose Hugo or
Jekyll content carries `type: post` will find those files in scope and,
`post` being claimed by no reviewer, red with the full owed set. The
cure is a positive policy declaration: add the type to
`reviewless_types` in `.grove/review-policy.md` (e.g.
`reviewless_types: [research, feedback, post]`) — one deliberate,
reviewable line. Honest status of this edge: the any-`type:`-counts
rule was maintainer-ratified **provisionally** (2026-07-17,
ratified-to-move), with the math-quest consumer pilot named as its
empirical test — it may still move on pilot evidence (`spec-0002` §C.2
records the ratification verbatim).

## Install and remove

Install lands three pieces plus one recorded choice:

1. the check runtime at `.grove/check/` (zero-dependency — no
   `npm install`);
2. the workflow at `.github/workflows/grove-review-bookkeeping.yml`;
3. the policy carrier at `.grove/review-policy.md` — where the one
   setup question's answer is recorded as `scope:`, alongside the
   `check_runtime_dir` / `check_workflow_path` carrier keys naming the
   actual install paths. Every install writes all three keys
   explicitly; the fail-closed defaults exist only as the backstop.

`/grove:check-install` runs exactly this install standalone — invoking
it *is* the opt-in. `/grove:remove` reverses all of it (and only it).
