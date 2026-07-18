# The grove review-bookkeeping check

Consumer orientation for the optional GitHub CI check grove installs
(`spec-0002`, `adr-0012` Layer A). Install it via `/grove:setup`
(offered during install) or standalone, any time later, with
`/grove:check-install`. Remove it with `/grove:remove`. GitHub Actions
only; zero runtime dependencies; read-only permissions.

## What it is — bookkeeping, not review

A CI job that runs on every PR and renders a read-only status view of
the PR's **verdict records** — the structured review-verdict comments
posted on the PR by the dispatcher's `record-verdict` skill (the
reviewer supplies only its judgment; a machine emitter stamps the
record — `adr-0015`/`adr-0017`). The check does no reviewing itself and
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
question and recorded as `scope` in `.grove/review.toml`
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
blocks) plus the consumer policy in `.grove/review.toml` (scope + corpus
policy) and the wiring in `.grove/internal/review-wiring.toml` (the
carrier keys) — all read from the protected default branch, never from
the PR's own branch. There is no compiled map to regenerate: changing
what a type owes is an agent-declaration edit.

## Incidental frontmatter (`type: post` and friends)

Scoped-mode jurisdiction follows **any** frontmatter `type:`
declaration, recognized or not — so a static-site repo whose Hugo or
Jekyll content carries `type: post` will find those files in scope and,
`post` being claimed by no reviewer, red with the full owed set. The
cure is a positive policy declaration: add the type to
`reviewless_types` in `.grove/review.toml` (e.g.
`reviewless_types = ["research", "feedback", "post"]`) — one deliberate,
reviewable line. Honest status of this edge: the any-`type:`-counts
rule was maintainer-ratified **provisionally** (2026-07-17,
ratified-to-move), with the math-quest consumer pilot named as its
empirical test — it may still move on pilot evidence (`spec-0002` §C.2
records the ratification verbatim).

## Install and remove

Install lands three pieces plus one recorded choice:

1. the check runtime at `.grove/internal/check/` (zero-dependency — no
   `npm install`);
2. the workflow at `.github/workflows/grove-review-bookkeeping.yml`;
3. the split policy carrier (`adr-0018` D10): `.grove/review.toml` — the
   consumer surface, where the one setup question's answer is recorded as
   `scope` — plus `.grove/internal/review-wiring.toml`, the
   grove-authoritative wiring carrying the `check_runtime_dir` /
   `check_workflow_path` keys that name the actual install paths. Every
   install writes all three keys explicitly; the fail-closed defaults
   exist only as the backstop.

`/grove:check-install` runs exactly this install standalone — invoking
it *is* the opt-in. `/grove:remove` reverses all of it (and only it).

## grove does not gate its own arrival

Installing grove will **not** red the very change that introduces it.
The check self-detects a fresh install — it sees that grove is not yet
present on your protected branch — and stays out of the way, activating
only on your **next** PR, once grove is actually in place. So there is no
"red on arrival" to work around: the first thing you see is not CI
failing on grove's own just-added files.

(This is a fact about how the check behaves — not a recommendation about
*how* to land the install. That's yours; see below.)

## grove is invisible to your linters and formatters

`.grove/` is grove's vendored namespace — the companions, the policy
carrier, and (if you installed the check) the runtime. It is a
**dependency, not your source**, so your linters and formatters should
not read it. Setup **detects** the linters/formatters you use (ESLint,
Prettier, Biome, markdownlint) and **offers** — never imposes — to add
the whole `.grove/` namespace to each one's ignore, augment-never-clobber
and only with your say-so.

Why the *whole* namespace, and why formatters too: a linter reading
`.grove/` is noise, but a **formatter rewriting** it is corruption —
`.grove/`'s companions and policy carrier are markdown, and any integrity
the runtime relies on is broken, not merely flagged, by a reformat.
`/grove:remove` strips the ignore line back out (only that line, only
with your consent).

## Installing writes no git — landing is yours

Setup and `/grove:check-install` **perform no git**: no add, no commit,
no branch, no push, no PR — and recommend no landing approach. They
compose the files, surface plainly what is now uncommitted in your
working tree, and hand the decision back to you. Landing the install is
yours to do, your project's own way. (Setup runs inline in your own
session, so it deliberately injects no git opinion that would bias how
you handle git for your own work.)
