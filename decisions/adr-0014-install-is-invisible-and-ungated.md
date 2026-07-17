---
id: adr-0014-install-is-invisible-and-ungated
type: adr
status: draft
depends_on: [adr-0012-methodology-delivery-machinery, adr-0013-check-scope-mode]
informed_by: [adr-0005-tdd-and-artifact-gated-dispatch, trellis/decision-0048]
owner: agent
updated: 2026-07-17
---

# ADR-0014 (DRAFT): installing grove is invisible to the consumer's tooling, and grove does not gate its own arrival

> **STATUS: DRAFT — not shaped to convergence, not adversary-checked, not
> at any human gate.** Opened as a shaping change-request so a parallel
> session reviewing `/trellis:setup` can cross-read it: several findings
> below are **shared-pattern** (they apply to `trellis`'s setup skill the
> same way, since grove's setup was modeled on trellis's
> augment-never-clobber composition idiom), not grove-only. This draft
> records the grove side of that conversation; it will be shaped +
> adversary-broken before any approval.
>
> **Revision 2026-07-17 — folded trellis PR #159 (`trellis/decision-0048`).**
> That review caught a real flaw in this draft's first cut: its move 1
> *recommended* a landing workflow ("install lands as a direct commit to
> the default branch"). Because setup runs **inline in the consumer's own
> conversation**, that recommendation is an **injected git-workflow
> opinion** that leaks into the host session (trellis observed this live) —
> and "commit to the default branch" is the exact freelance that started
> trellis's incident. Corrected below: setup performs **no git and injects
> no landing opinion**; the "don't red on arrival" job moves entirely to
> the workflow's bootstrap self-detect, which is landing-agnostic. Move 3
> deepened and an M2 gap parked, both from the same review.

## Context

The `math-quest` pilot (adr-0013 Consequence 4 — the first real
consumer install) surfaced install-time friction that no grove-self test
could, because grove-self *is* the tooling owner:

1. **The consumer's linter reds on grove's vendored runtime.** math-quest's
   ESLint linted `.grove/check/**` and flagged `process`/`Buffer` as
   `no-undef` — Node globals in files the linter didn't treat as Node.
   But the deeper point: a consumer should not lint `.grove/` at all — it
   is grove's vendored namespace (runtime + companions + policy carrier),
   a dependency, not the consumer's source.
2. **The install PR reds on grove's own just-vendored machinery.** Because
   the check governs its own machinery (`adr-0013` F3 — a machinery edit is
   never silent), an install that lands as a PR runs the check on that PR,
   where `.grove/check/**` + the workflow are *added* code owing reviews
   they cannot yet have → red. The tripwire that is *correct* for ongoing
   edits is *noise* on the initial vendoring.

Both are one theme: **grove's arrival collides with, or is judged by, the
consumer's existing setup.** The first thing a first-run consumer sees is
red CI on grove's own files — the opposite of "just works."

## Decision (draft — the three moves)

1. **grove does not gate its own installation — and setup injects no
   landing opinion to achieve it.** This splits into two independent
   halves that must not be conflated (the first-cut error):

   - **1a — Setup is git-neutral (port of `trellis/decision-0048`).** Setup
     performs **no** git of its own (no `add`/`commit`, no branch, no push,
     no PR) and **recommends no landing approach** — not a direct commit,
     not a PR, not committing anywhere. It writes the overlay, verifies it,
     **surfaces the uncommitted state plainly** (which files changed), and
     **defers landing to the consumer project's own conventions**. It never
     commits onto the current branch (least of all `main`/`master`), and on
     an autonomous run with no human to answer it leaves the change in the
     working tree and stops — never lands unasked (`floor-intent-gate` /
     grove's intent gate). *Why the restraint, not just "hand off to a PR":*
     setup runs **inline in the consumer's own conversation**, so any
     git-workflow instruction here biases how *that* session handles git for
     its own unrelated work — importing grove's preference into a project
     with its own conventions (trellis observed this leak live, 2026-07-18).
     A neutral procedural hand-back ("I did no git; here is what is
     uncommitted; landing is yours, your way") points at the consumer's own
     defaults; a *recommendation* ("commit it to main", "open a PR") is the
     injected opinion setup must not carry.

   - **1b — The check does not red on its own arrival — landing-agnostic,
     in the workflow, not the skill.** Because 1a forbids setup from steering
     *how* the install lands, the "no red on arrival" job lives entirely in
     the **workflow** (which is machinery, not leaked skill prose):
     - The workflow triggers on `pull_request` / `issue_comment`, never
       `push` — so *if* the consumer lands the install as a direct commit,
       no run fires at all. (A **fact about the workflow**, not a
       recommendation to land that way — the choice stays the consumer's,
       per 1a.)
     - *If* the consumer lands the install as a PR, the workflow's
       **bootstrap self-detect** first step checks whether its own file
       (`check_workflow_path`, `adr-0013`) exists on the base branch. If
       **absent** (this PR is introducing grove), it exits green —
       *"grove install detected — the check activates on your next PR"* —
       and never invokes the check. Once merged, the workflow lives on the
       base; every subsequent PR runs it for real.
     - **The F3 tripwire is unweakened.** The skip fires *only* when the
       workflow file is absent-on-base — exactly once, at install. A later
       PR that *edits* `.grove/check/**` (a grove version bump) runs and
       gates normally, because by then the workflow is established on base.
       Install ≠ edit; the check tells them apart by its own presence, not
       by a `paths-ignore` on the machinery (which *would* reopen F3's
       silent-machinery-edit hole — rejected). The one theoretical bypass —
       delete the gate in one PR, re-add it in another for a skip — requires
       **loudly merging a PR that removes your own CI**, which no silent
       actor can do (same class as "a repo can always delete its own
       workflow").

2. **The install is invisible to the consumer's existing tooling.** Setup
   (interactively — see move 3) **detects** the consumer's linters/
   formatters (ESLint `.eslintrc*`/`eslint.config.*`/`eslintConfig`,
   Prettier, Biome, …) and **offers** to add the **whole `.grove/`
   namespace** — not just `.grove/check/` — to their ignore, augment-never-
   clobber, honoring the answer. `.grove/` is the namespace boundary: all
   of it (runtime, companions, policy carrier) is grove's vendored
   territory, none of it consumer source. The whole-namespace rule is
   future-proof — it covers runtime that later grows beyond `check/`, and
   non-JS tooling (a markdown/YAML formatter over the companions/policy) —
   where a `.grove/check/**` glob would not. (Note: the consumer's lint-
   ignore is a *separate tool* from grove's check — ignoring `.grove/` in
   ESLint does not affect grove's own F3 gating of `.grove/check/` edits,
   which reads those files at runtime regardless.)

3. **Interactive install questions live in the setup skill's live-session
   lane — never a fire-and-forget cold agent.** grove has two agent kinds
   on one axis: *fire-and-forget* (executor, reviewers — cold-started, read
   only artifacts, no human in the loop) and *live/interactive* (the
   `shaper` — "cold-started **as interactive**," a live session with the
   human answering each turn). Setup is executed by the **live session**
   reading `SKILL.md` and asking the user directly — not dispatched to a
   subagent. So every interactive install question (the `scope` question of
   `adr-0013`; the linter-ignore offer of move 2; any future ones) belongs
   there, because a fire-and-forget agent has *no human to ask*. This is
   placement, not limitation — and it means setup can be **as interactive
   as the UX wants**. The authoring/running split: *authoring* the
   `SKILL.md` prose is fire-and-forget-able (a cold executor wrote the last
   skills wave); *running* setup at install time is inherently live.

   **The deeper reason (from `trellis/decision-0048`): inline prose leaks.**
   Beyond "needs a human to ask," setup runs *inline in the consumer's
   session*, so whatever opinion its prose carries **contaminates the host
   session's own defaults** — the git-landing leak of move 1a is the
   worked example, but the principle is general: setup's body must carry no
   workflow opinion it would not want imported into an arbitrary consumer
   project. This *validates* the live-session placement rather than pushing
   toward isolation: trellis considered running setup **cold** (a
   `context: fork` sub-agent) to keep its prose out of the host session and
   **rejected it for the interactive (M1) flow** — interactive/stateful
   work stays with the driving session, and once the *opinion itself* is
   removed (move 1a) there is nothing left to isolate (`inv-minimal-first`:
   remove the bias, don't build a mechanism to contain it). A forked agent
   also cannot prompt the user, which setup's questions require. (The
   residual isolation question is M2 — see Open questions.)

## Considered and rejected (draft)

- **Setup recommends a landing workflow (direct-commit, or "open a PR,
  here's the command").** This was the draft's *own first cut*. Rejected
  (`trellis/decision-0048`): setup is inline, so the recommendation is an
  injected git-workflow opinion that contaminates the consumer session —
  and steering toward `main` or toward PR is precisely the opinion being
  removed. The neutral hand-back (1a) + the workflow self-detect (1b)
  achieve the goal without setup opining on git at all.
- **`paths-ignore` the machinery so install PRs skip the check.** Reopens
  `adr-0013` F3's silent-machinery-edit hole (a PR editing *only*
  `.grove/check/**` would skip its own gate). Rejected — the fix is *how
  the install lands*, not *weakening the trigger*.
- **Ignore only `.grove/check/` in the linter.** Scoped to "what ESLint
  flags today," not the namespace boundary; not future-proof. Rejected in
  favor of the whole `.grove/`.
- **Ship the runtime with a Node-env lint marker instead of ignoring.**
  Belt-and-suspenders at best, and version/flat-config-fragile; does not
  address the "you shouldn't lint a dependency" principle. May ride
  *alongside* the ignore, not instead of it — open for shaping.

## Consequences (draft — to be built after approval)

1. The consumer **workflow template** gains the bootstrap self-detect step
   (`plugins/grove/reference/ci/grove-review-bookkeeping.yml`).
2. The **setup + check-install skills** gain: a **git-neutral hand-back
   step** (no git, no landing recommendation — surface the uncommitted
   overlay and defer to the consumer's conventions; the grove analogue of
   trellis's step 8, `trellis/decision-0048`); the interactive
   linter-detect-and-offer step (whole `.grove/`); and an in-context note
   that grove does not gate its own arrival. The earlier "direct-commit is
   the default" guidance is **removed**, not reworded.
3. The **consumer README** (`reference/ci/README.md`) states both plainly
   (self-guiding principle).
4. The **math-quest pilot** re-runs against all three.

## Open questions / for cross-review

- **M2 isolation — the generative morph (parked, ported from
  `trellis/decision-0048`).** Move 1a deletes an *opinion* from setup's
  prose; but setup's **model-driven rewriting** — grove's placeholder
  resolution, the managed `CLAUDE.md` block, the README/`.claude/agents/`
  adaptations — is a *generative* step carrying ambient context, and its
  bias **cannot be deleted the way an opinion can**. Isolating that in a
  cold / `context: fork` follow-up stays a live question (trellis parks the
  identical gap; "probably not needed for the immediate concern," maintainer
  2026-07-18). Recorded so it is not silently dropped, not resolved here.
- **Shared-pattern with `/trellis:setup`?** Moves 2 (tooling-invisible
  install) and 3 (interactive-questions placement) are not check-specific —
  they are composition-skill hygiene. Move 1a (git-neutral hand-back) is now
  *directly ported* from trellis. Does trellis's setup want the same
  linter-detect-and-ignore for `.trellis/` that move 2 adds here? (Feeds
  back across the two sessions.)
- **`.trellis/` + `.grove/` folder consolidation** — the maintainer raised
  whether the two vendored namespaces should live under one hidden root.
  **Parked, explicitly later** (2026-07-17); noted so the ignore rule
  (move 2) can be revisited if the namespace changes.
- **Node-env marker alongside the ignore?** (see rejected #3).
- Whether "grove does not gate its own install" wants to be its own tiny
  charter/companion line or stays a consequence of this decision.

## Self-check

DRAFT — deliberately not self-checked to `gated`. Recorded as the shaping
canvas so a parallel trellis-setup review can cross-read the shared-pattern
findings before this converges. **Revised 2026-07-17** to fold
`trellis/decision-0048` (PR #159): move 1 split into git-neutral hand-back
(1a) + landing-agnostic self-detect (1b), the injected-landing-opinion
added to Considered-and-rejected, move 3 deepened with the inline-prose-leak
mechanism, M2 generative-morph isolation parked. `trellis/decision-0048` is
carried as `informed_by` (cross-repo provenance — it informed the correction
without grove's correctness being contingent on another repo's artifact;
edge form per `adr-0011` / `decision-0044`). Next: shape to `gated` →
decision-adversary → human gate.
