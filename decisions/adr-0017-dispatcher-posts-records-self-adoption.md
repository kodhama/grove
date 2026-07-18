---
id: adr-0017-dispatcher-posts-records-self-adoption
type: adr
status: gated  # self-checked (shaper Method); `approved` is the maintainer's intent act, never the shaper's
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

### Part 1 — the dispatcher posts the records (resolves `adr-0015`'s open question)

**The dispatcher — the live/interactive session that orchestrates a
run — runs the emitter and posts each record.** The reviewer agents emit
only their `grove-review-judgment` (`adr-0015` Decision 1, unchanged and
CI-oblivious). The dispatcher, which already holds those judgments (it
dispatched the reviewers and received their outputs), runs the emitter to
stamp each judgment into a `§A.2` record and **posts it as a PR comment**.

- **A `post-record` skill** carries the mechanism: judgment(s) in → run
  `bin/emit-record.mjs` → post each stamped record as a PR comment via the
  platform API. Thin glue over the existing emitter plus the comment API;
  the dispatcher invokes it as each reviewer's judgment lands (or at the
  gate seam).
- **Why the dispatcher, not CI.** The judgments originate from the
  dispatched reviewer agents, whose outputs only the dispatcher holds; a CI
  job has no access to them. A CI/bot poster would also fail `§A.4`
  admissibility by default (`github-actions[bot]` is not
  `OWNER`/`MEMBER`/`COLLABORATOR`) and would need an explicit
  `record_poster_allowlist` entry. The dispatcher posts under the
  **human's authenticated session identity** — `OWNER`/`MEMBER` — so records
  are admissible with **no allowlist entry required** (`spec-0002` §A.4;
  `adr-0015` N2 honored). This is exactly *"what has been done by hand all
  along"* that `adr-0015` named, now given a repeatable skill.
- **The reviewer stays CI-oblivious** (`adr-0015` Decision 1 preserved):
  it emits only judgment; the **dispatcher, not the reviewer**, runs the
  emitter and posts. The separation authority is unaffected — it remains
  the record's `producer`/`reviewer` **fields** (`adr-0012` AC7), which the
  emitter transcribes from the judgment; the *poster* is orthogonal.
- **Append-only** (`spec-0002` §A.1): a re-review posts a **new** record;
  the skill never edits a prior record comment (an edited record is rejected,
  §A.4). One record per comment (§A.1) — the skill posts per record, never
  batched into one comment.

This mechanism is **general** — every consumer's dispatcher posts records the
same way; the check (CI) stays read-only and only *reads* them. grove-self is
its first application, not a special case.

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
by hand all along)"* — is **answered here: the dispatcher, via the
`post-record` skill.** `adr-0015`'s bounding constraint (N2: the poster must
satisfy `§A.4` admissibility) is honored — the dispatcher's session identity
is `OWNER`/`MEMBER`, admissible by default, so no `record_poster_allowlist`
entry is needed. `adr-0015` Decision 1 (the reviewer emits only judgment,
knows nothing of CI) is **preserved**, not weakened: the dispatcher — a
distinct actor — does the emitting and posting. A forward pointer is added on
`adr-0015`'s open question pointing here (append-only, same change).

## Considered and rejected

- **A CI step runs the emitter and posts.** Rejected: CI has no access to the
  reviewer judgments (they live in the dispatcher that ran the reviewers), and
  a bot poster fails `§A.4` by default (needs allowlisting). It would also
  re-couple posting to CI when the judgments are a dispatch-side artifact.
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

1. **The `post-record` skill** (`plugins/grove/skills/` + reference bundle):
   input = one or more reviewer `grove-review-judgment` blocks; runs
   `bin/emit-record.mjs`; posts each stamped `§A.2` record as a **new** PR
   comment via the platform API; never edits a prior record. Built and
   tested (its record output round-trips through the real `runCheck` to
   green, mirroring the `adr-0015` emitter tests).
2. **grove's workflow** — `.github/workflows/grove-review-bookkeeping.yml`,
   pointed at `plugins/grove/check/bin/check.mjs`, Node pinned; **landed by
   direct-commit to `main`** (not via a PR).
3. **grove's policy carrier** (`charters/review-policy.md`) — add
   `check_runtime_dir: plugins/grove/check` and `check_workflow_path:
   .github/workflows/grove-review-bookkeeping.yml`; `scope: strict` unchanged.
4. **The dispatcher's run flow** — the post-gate step now runs `post-record`
   for each completed reviewer's judgment, so records land on the PR. Where
   this is documented (dispatcher charter vs. a run-workflow note) is settled
   during the build.
5. **Forward pointer on `adr-0015`** at its open question → this decision
   (append-only annotation).
6. **First gated grove PR** — the next grove PR after the workflow commit is
   dogfooded end-to-end (reviewers → judgments → dispatcher posts records →
   green check), and is the empirical test of the whole loop.

## Acceptance criteria

- **AC1** A `post-record` mechanism exists that turns reviewer judgment(s)
  into **posted** `§A.2` record comments via the emitter, from an admissible
  poster, append-only (never editing a prior record), one record per comment.
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

## Open questions (parked, ≤3)

- **Where the dispatcher's post-record step is documented** — a dispatcher
  charter duty vs. a run-workflow note vs. the `post-record` skill's own
  usage. Execution detail; recommend the skill is the home and the dispatcher
  charter points at it.
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

**Not claiming adversary validation** — the decision-adversary pass precedes
the human gate; the `approved` intent act is the maintainer's
(`gated → approved` flip), never the shaper's.
