---
id: adr-0017-dispatcher-posts-records-self-adoption
type: adr
status: approved  # maintainer intent act 2026-07-18 ("adr-0017 approved. Start the build!") after decision-adversary rounds 1-2 SOUND; in-conversation flip, adr-0015/adr-0016 precedent
depends_on: [adr-0012-methodology-delivery-machinery, adr-0015-reviewer-machine-boundary, adr-0013-check-scope-mode, adr-0014-install-is-invisible-and-ungated]
owner: agent
updated: 2026-07-18
---

# ADR-0017: the dispatcher posts the records — grove adopts its own review-bookkeeping check

## Context

The review-bookkeeping check (`spec-0002`, `adr-0012` Layer A) reads a PR's
**verdict records** and gates on completeness/freshness/etc. `adr-0015`
closed the emitter gap — reviewers emit a CI-agnostic
`grove-review-judgment`; a machine emitter (`plugins/grove/check/bin/emit-record.mjs`)
stamps each into a conformant `§A.2` record. But `adr-0015` **explicitly
parked** one question: *"which harness component runs the emitter + posts."*
The emitter writes the record to **stdout** — **nothing posts it as a PR
comment.** So the end-to-end path is unbuilt at the last mile: a PR can own
reviews, judgments can be produced, records can be stamped — and still no
record ever lands on the PR, so the check reds every owed pair.

This blocks **grove eating its own dogfood** (the D2b agreement). grove-self
has never adopted the check — there is no `.github/workflows/` in the repo,
and the reference workflow's own header parks it: *"Do NOT add this workflow
to grove's OWN `.github/workflows/` — grove-self adopting the check on its
own PRs is a separate, later decision."* The check code, however, is
**already grove-self-aware**: it resolves the policy carrier from
`charters/review-policy.md` first (`REVIEW_POLICY_CANDIDATES`) and reviewer
declarations from `charters/` first (`DECLARATION_DIR_CANDIDATES`) — grove's
native layout, no code change needed. What is missing is (1) the posting
mechanism and (2) the workflow + carrier config to turn it on.

This decision closes both: it **resolves `adr-0015`'s parked posting
question** (a mechanism every consumer needs, not just grove) and **adopts
the check on grove's own PRs** as its first application.

## Decision

### Part 1 — one skill carries the whole CI bridge (resolves `adr-0015`'s open question)

**A single `record-verdict` skill encapsulates self-detect + emit + post;
the dispatcher invokes it and knows nothing else.** The reviewer agents
emit only their `grove-review-judgment` (`adr-0015` Decision 1, unchanged
and CI-oblivious). At the review seam — a reviewer's judgment lands — the
dispatcher hands that judgment to the skill. Everything CI-aware lives
inside the skill:

- **Self-detect first (the `adr-0014` discriminator).** The skill's first
  act: is a `grove-review-policy` block present on `origin/<default>`? If
  absent — the check is not installed — the skill **no-ops** (nothing
  gates, so nothing owes a record). Keyed on **policy-block presence,
  never workflow-file presence** (workflow-file absence is `adr-0013`'s
  carrier-red condition — the `adr-0014` F1 trap, avoided the same way).
- **Emit.** The skill runs the record-emitter (`bin/emit-record.mjs`) on
  the judgment, in the PR checkout — the exact command is the skill's
  internal detail, visible to no agent outside it.
- **Post.** Each stamped `§A.2` record posts as a **new** PR comment via
  the platform API — one record per comment, append-only (a re-review is a
  new comment, never an edit — `spec-0002` §A.1/§A.4). The machine block
  rides inside a collapsed `<details>` wrapper with a one-line human
  summary — §A.1 explicitly allows surrounding prose (only the block is
  the record) — so the PR thread stays readable.
- **Poster identity.** The skill posts under the session's authenticated
  identity — the maintainer's `OWNER`/`MEMBER` — admissible under §A.4
  with **no `record_poster_allowlist` entry** (`adr-0015` N2 honored).

**The knowledge budget** (the point of this shape — the maintainer's
decoupling call, 2026-07-18):

- the **reviewer** knows nothing of CI (`adr-0015`, unchanged);
- the **dispatcher** knows exactly one thing: *hand each reviewer's
  judgment to `record-verdict`*. No emitter command, no workflow path, no
  installed-or-not conditional — it need not know a check exists;
- the **skill** alone is CI-aware: self-detect, emitter, comment API.

The separation authority is unaffected throughout — it remains the
record's `producer`/`reviewer` **fields** (`adr-0012` AC7), which the
emitter transcribes from the judgment; the *poster* is orthogonal.

This mechanism is **general** — every consumer's dispatch flow invokes the
same skill; the check (CI) stays read-only and only *reads* the comments.
grove-self is its first application, not a special case. Why the
dispatcher invokes it (rather than CI): the judgments originate in the
dispatched reviewers, whose outputs only the dispatcher holds — a CI job
has neither the judgments nor an admissible default identity
(`github-actions[bot]` fails §A.4 absent an allowlist entry).

### Part 2 — grove adopts the check on its own PRs

- **Workflow.** Add `.github/workflows/grove-review-bookkeeping.yml` to grove,
  adapted from the reference template but pointed at grove-self's **native
  runtime** — `node plugins/grove/check/bin/check.mjs` — not the consumer
  `.grove/check` default; Node version pinned.
- **Mode: `strict`.** grove's policy carrier (`charters/review-policy.md`)
  already declares `scope: strict`; grove is almost entirely methodology
  artifacts, so `scoped` would exempt little and understate the dogfood.
  Kept strict.
- **Carrier keys.** grove's policy carrier currently omits
  `check_runtime_dir` / `check_workflow_path`, so the `adr-0013` F3 carrier
  fail-close would watch the consumer defaults (`.grove/check/`) — wrong for
  grove-self. The build adds `check_runtime_dir: plugins/grove/check` and
  `check_workflow_path: .github/workflows/grove-review-bookkeeping.yml` so
  the fail-close watches grove's **actual** machinery paths.
  <!-- Precision note (surfaced by the build's conformance gate,
  2026-07-18; annotation only): per adr-0013's own wording the F3
  carrier fail-close runs in `scoped` mode — under grove-self's `strict`
  scope every changed file already owes the full set, so the dedicated
  carrier branch is dormant here. The keys are still owed and consumed:
  adr-0013 AC5 requires every install to declare them, the
  record-verdict skill resolves the runtime from check_runtime_dir, and
  the fail-close goes live if scope ever flips. Only the causal clause
  above ("so the fail-close watches...") overstated. -->
- **Landing: direct-commit the workflow to `main`.** grove's policy block is
  already on `main`, so `adr-0014`'s "doesn't gate its own arrival"
  self-detect (keyed on policy-block presence) sees grove as *installed* and
  would gate the adoption PR itself → red (no records on it). The workflow
  triggers on `pull_request` / `issue_comment` **only**, so a **push fires
  no run** (`adr-0014`'s own noted escape). Direct-committing the workflow to
  `main` therefore self-gates nothing; the **next PR** after the commit is
  the first genuinely gated one, dogfooded end-to-end via Part 1.

## Relationship to `adr-0015` (resolves its open question — no supersession)

`adr-0015`'s open question — *"Which harness component runs the emitter +
posts — a dedicated CI step vs. the dispatcher relaying (what has been done
by hand all along)"* — is **answered here: the dispatcher's relay, packaged
as the `record-verdict` skill.** `adr-0015`'s bounding constraint (N2: the poster must
satisfy `§A.4` admissibility) is honored — the dispatcher's session identity
is `OWNER`/`MEMBER`, admissible by default, so no `record_poster_allowlist`
entry is needed. `adr-0015` Decision 1 (the reviewer emits only judgment,
knows nothing of CI) is **preserved and extended one level up**: the
emitting and posting live inside the skill, so even the dispatcher carries
no CI knowledge beyond the single invocation. A forward pointer is added on
`adr-0015`'s open question pointing here (append-only, same change).

## Considered and rejected

- **A CI step runs the emitter and posts.** Rejected: CI has no access to the
  reviewer judgments (they live in the dispatcher that ran the reviewers), and
  a bot poster fails `§A.4` by default (needs allowlisting). It would also
  re-couple posting to CI when the judgments are a dispatch-side artifact.
- **The dispatcher runs the emitter directly** (the first-cut shape of this
  very decision). Rejected on the maintainer's decoupling call (2026-07-18):
  it puts the emitter command, the installed-or-not conditional, and the
  posting mechanics into the dispatcher — the same knows-about-CI category
  error `adr-0015` removed from the reviewers, one level up. The skill
  absorbs all of it; the dispatcher keeps a single methodology-level
  invocation.
- **A completion hook auto-invokes the skill** (zero dispatcher
  involvement). Rejected with the maintainer: a hook must itself be declared
  in harness configuration, so the coupling is not removed — only relocated
  into less-legible config — and the judgment would have to be captured
  out-of-band. The dispatcher's one explicit invocation at the review seam
  is the smaller, more legible thing.
- **A dedicated posting agent/role.** Rejected as heavier than needed — the
  dispatcher already holds the judgments and has an admissible identity; a new
  cold role would have to be *handed* the judgments it doesn't originate.
- **`scoped` mode for grove-self.** Rejected — grove is nearly all
  methodology artifacts, so scoped would exempt little and understate the
  dogfood; strict is the honest self-test. (The README recommends
  scoped-to-start for *consumers*; grove-self is the strict case by design.)
- **Land the workflow via a PR.** Rejected — grove's policy is already on
  `main`, so the self-detect sees grove installed and would red the adoption
  PR (no records). Direct-commit sidesteps the self-gate cleanly (a push fires
  no run). This is deliberate infra-landing of grove's own machinery, not a
  reviewable methodology artifact whose gate we are dodging.
- **Keep hand-checking; don't adopt.** Rejected — the check exists (`adr-0012`)
  precisely to mechanize this bookkeeping; grove not running it on itself is
  the un-dogfooded gap D2b named, and the reason grove#67/#68 were found by a
  *consumer* pilot rather than by grove eating its own dogfood.

## Consequences (execution — after approval)

1. **The `record-verdict` skill** (`plugins/grove/skills/` + reference
   bundle): input = one or more reviewer `grove-review-judgment` blocks;
   first self-detects on `grove-review-policy`-block presence on
   `origin/<default>` (no-op when absent); runs `bin/emit-record.mjs`;
   posts each stamped `§A.2` record as a **new** PR comment (one record per
   comment, `<details>`-wrapped with a one-line summary); never edits a
   prior record. Built and tested (its record output round-trips through
   the real `runCheck` to green, mirroring the `adr-0015` emitter tests).
2. **grove's workflow** — `.github/workflows/grove-review-bookkeeping.yml`,
   pointed at `plugins/grove/check/bin/check.mjs`, Node pinned; **landed by
   direct-commit to `main`** (not via a PR).
3. **grove's policy carrier** (`charters/review-policy.md`) — add
   `check_runtime_dir: plugins/grove/check` and `check_workflow_path:
   .github/workflows/grove-review-bookkeeping.yml`; `scope: strict` unchanged.
4. **The dispatcher's run flow** — at the review seam, the dispatcher
   invokes `record-verdict` with each completed reviewer's judgment, so
   records land on the PR. The **skill is the documentation home** for the
   mechanism; the dispatcher charter carries only a one-line pointer to it
   (the decoupling call resolves the former where-documented question).
5. **Forward pointer on `adr-0015`** at its open question → this decision
   (append-only annotation).
6. **First gated grove PR** — the next grove PR after the workflow commit is
   dogfooded end-to-end (reviewers → judgments → dispatcher posts records →
   green check), and is the empirical test of the whole loop.

## Acceptance criteria

- **AC1** A `record-verdict` skill exists that turns reviewer judgment(s)
  into **posted** `§A.2` record comments via the emitter, from an admissible
  poster, append-only (never editing a prior record), one record per
  comment — and **no-ops** when no `grove-review-policy` block exists on the
  protected default branch (the `adr-0014` discriminator; never
  workflow-file presence).
- **AC2** grove's `.github/workflows/grove-review-bookkeeping.yml` runs
  `plugins/grove/check/bin/check.mjs` on grove's PRs and reads policy +
  declarations from grove's native layout (`charters/`).
- **AC3** grove's policy carrier declares `check_runtime_dir` /
  `check_workflow_path` naming grove's actual paths; `scope: strict` retained;
  the `adr-0013` carrier fail-close therefore watches the real machinery.
- **AC4** The reviewer charters are **unchanged** — the reviewer still emits
  only judgment (`adr-0015` Decision 1); only the dispatcher/skill posts.
- **AC5** `adr-0015`'s open question carries a forward pointer here; the
  posting mechanism honors `§A.4` admissibility with no allowlist entry for
  the dispatcher's default `OWNER`/`MEMBER` identity.
- **AC6** The adoption lands without self-gating: the workflow is committed
  such that no run fires on its own landing, and the first PR afterward runs
  the check for real.
- **AC7** The dispatcher-facing surface is a **single skill invocation** at
  the review seam: no emitter command, workflow path, or installed-or-not
  conditional appears in any dispatcher-facing duty — the skill alone is
  CI-aware.

## Open questions (parked, ≤3)

- **Comment volume under strict** — one record per reviewed path
  (`spec-0002` §A.1/§A.3 basis granularity) means a wide PR posts many
  record comments; the `<details>` wrapper keeps the thread readable but
  not shorter. The first gated grove PRs are the empirical read; any
  batching relief would be a `spec-0002` evolution, not this decision's.
- **Headless/cron posting identity** — the dispatcher posts under the
  session's authenticated identity; in a headless/cron run that identity may
  differ (or be absent). For grove-self the maintainer's session posts, so
  this is not blocking; a non-interactive poster would need a
  `record_poster_allowlist` entry (the standing `§A.4` accommodation).
- **CI Node version + clone depth** — the reference workflow's `<NODE_VERSION>`
  and `fetch-depth: 0`; grove pins its own values at build. Execution detail.

## Self-check (rubric)

Self-checked to `gated` 2026-07-18. **Problem stated from the actual gap**:
`adr-0015` parked "who posts," the emitter writes to stdout, and grove has no
`.github/workflows/` — each verified against the code/tree
(`bin/emit-record.mjs` stdout write; `REVIEW_POLICY_CANDIDATES` /
`DECLARATION_DIR_CANDIDATES` already grove-self-first; the reference
workflow's own "separate, later decision" header). The decision is **largely
forced** on Part 1: the judgments live in the dispatcher, and `§A.4`
admissibility makes the dispatcher's `OWNER`/`MEMBER` identity the
no-friction poster while a CI bot needs allowlisting — so "the dispatcher
posts" falls out of where the judgments are plus who may post. Each
alternative is rejected on a reason that holds (CI lacks the judgments;
scoped understates the dogfood; a PR-landed workflow self-gates on grove's
already-present policy). **Relationship to `adr-0015` is reconciled
explicitly** — this *answers* its open question rather than contradicting it,
with Decision 1 (reviewer CI-obliviousness) preserved and a forward pointer
added (the `adr-0015`↔`adr-0012` precedent). Separation authority (`adr-0012`
AC7) is untouched — it is the record's fields, not the poster. `depends_on`
is genuine coupling — `adr-0012` (the check being adopted), `adr-0015` (the
emitter/boundary whose open question this resolves), `adr-0013` (scope mode +
the carrier keys the config sets), `adr-0014` (the self-detect / push-fires-no-run
landing this relies on); all `approved`, no draft consumed. Execution (the
skill, the workflow, the carrier keys, the forward pointer, the first gated
PR) is scoped downstream, not performed here.

**Shaping round 2 (2026-07-18, the maintainer's decoupling call).** The
first-cut Part 1 had the dispatcher itself run the emitter and post. The
maintainer pushed the decoupling one level further: the dispatcher should
not know the emitter command, nor condition on whether the CI machinery is
installed. Revised: a single `record-verdict` skill encapsulates
self-detect (policy-block presence on the protected branch, the `adr-0014`
discriminator — never workflow-file presence) + emit + post; the
dispatcher's whole knowledge is one skill invocation at the review seam.
The hook alternative (zero dispatcher involvement) was weighed with the
maintainer and rejected — a hook must itself be declared in harness
config, so the coupling is relocated, not removed. The former
where-documented open question resolves into the decision (the skill is
the home; the dispatcher charter carries a pointer); a comment-volume
observation is parked in its place, with the `<details>`-wrapped
presentation (§A.1's prose-around-block allowance) adopted for thread
readability. A round-2 decision-adversary pass scoped to this revision
precedes the human gate.

**Decision-adversary round 1 (2026-07-18): SOUND.** No load-bearing break
on any of the four axes. It confirmed the load-bearing points against the
sources: "the dispatcher posts" is a **selection within `adr-0015` Decision
3's own enumerated space** (*"a CI step or the dispatcher's relay"*) and its
parked open question — so resolving it is the right instrument, no
Decision-text amendment owed; `spec-0002` §A.4 admits the maintainer's
default `OWNER`/`MEMBER` association because no `record_poster_allowlist` is
configured; the dispatcher-is-the-interactive-session premise is grounded in
`charters/dispatcher.md`; the direct-commit landing is sound against
`adr-0014` (policy already on `main` → a PR would gate/red; the workflow
fires on `pull_request`/`issue_comment` only, so a push fires no run — the
grove-self analogue of the consumer green-skip); all four `depends_on`
targets `approved`; every code fact true on the branch. One disclosed
contingency (the `OWNER`/`MEMBER` claim assumes the session authenticates as
the human's own GitHub identity, not an app/bot token) is already parked in
the "Headless/cron posting identity" open question — honest handling of the
edge, not a gap.

**Decision-adversary round 2 (2026-07-18, scoped to the skill-encapsulation
revision): SOUND.** The revision's new surface holds: the self-detect no-op
is **fail-safe by construction** — its condition (policy-block absent on
`origin/<default>`) is exactly the condition under which the check's own
`adr-0014` bootstrap green-skips, so nothing is owed precisely when nothing
is posted, and a *wrong* no-op surfaces as the check's `never-reviewed` red
(loud), never a silent green (the check reads the protected branch itself
and never trusts the skill). Policy-presence is the correct posting-side
discriminator (a workflow-presence key would starve the PR of records on the
`adr-0013` carrier-red case). `<details>` wrapping cannot break record
recognition (`blocks.mjs` extraction is line-based; §A.1 allows surrounding
prose). The hook rejection rests on true premises, not taste. The knowledge
budget is coherent (unconditional invocation + in-skill no-op ≠ a
dispatcher-side conditional; the invocation is idempotent on a check-less
consumer). No round-1 regression. Two non-blocking build notes carried
forward: pin the skill's "cannot read `origin/<default>`" vs. "absent"
semantics, and note that §A.4's whole-comment edit-rejection freezes the
summary prose together with the record (consistent with the never-edit
rule).

**Not claiming adversary validation** — the decision-adversary pass precedes
the human gate; the `approved` intent act is the maintainer's
(`gated → approved` flip), never the shaper's.
