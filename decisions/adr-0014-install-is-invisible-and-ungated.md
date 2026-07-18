---
id: adr-0014-install-is-invisible-and-ungated
type: adr
status: gated  # self-checked converged 2026-07-18 (shaper); awaiting decision-adversary + the maintainer intent act
depends_on: [adr-0012-methodology-delivery-machinery, adr-0013-check-scope-mode]
informed_by: [adr-0005-tdd-and-artifact-gated-dispatch]  # trellis/decision-0048/0049 carried as PROSE provenance below, not a frontmatter edge — a CHOSEN option (adr-0011 permits informed_by → draft AND cross-repo forms), made because cross-repo resolution is shape-check-only so a machine edge adds little verifiable value; not because the edge is disallowed
owner: agent
updated: 2026-07-18
---

# ADR-0014: installing grove is invisible to the consumer's tooling, and grove does not gate its own arrival

> **STATUS: `gated` — self-checked converged, awaiting the decision-adversary
> pass and the maintainer's intent act** (`draft → approved`; the shaper
> never sets `approved`). Opened as a shaping change-request cross-read by
> the parallel `/trellis:setup` session; that cross-review is settled (its
> sibling decisions `trellis/decision-0048` and `decision-0049` carry the
> shared-pattern findings back into trellis, and their refinements are
> folded here — the revision trail below is the record). Shared-pattern
> findings (moves 1a, 2, 3) apply to trellis's setup the same way; move 1b
> is grove-check-specific.
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
>
> **Revision 2026-07-18 — folded back from trellis PR #160
> (`trellis/decision-0049`),** where trellis lifted this draft's move 2 and
> returned three refinements: (a) the danger is not just lint *noise* — a
> consumer *formatter* mutating a vendored file can **corrupt an integrity
> check** (trellis's byte-for-byte verify), so the ignore must cover
> **markdown/format** tooling, not only JS linters; (b) move 2 is *the one*
> place setup touches a consumer file **outside the overlay + managed
> block** — recorded as an offered, consented exception, not silent
> scope-creep; (c) cross-repo **draft** provenance is cited **in prose, not
> as a frontmatter edge** — this draft's `informed_by` edge to
> `trellis/decision-0048` is retracted to prose to match. **Cross-repo
> provenance (prose, by choice — not obligation):** this decision was
> informed by trellis's sibling drafts `decision-0048` (setup git hand-back)
> and `decision-0049` (tooling-invisible install). `adr-0011` *permits* an
> `informed_by` edge here — a draft referent does not trip directional-flow
> (that is the whole point of the relation), and the cross-repo `<repo>/<id>`
> form is sanctioned (`decision-0044`). Prose is *chosen* over the permitted
> edge because cross-repo resolution is shape-check-only (`adr-0006` dec 3),
> so a machine edge would add little *verifiable* value — and it mirrors
> trellis's own handling. (Corrected per adversary F4: the earlier rationale
> implied the edge was *disallowed*/an overclaim; it is neither — this is a
> verifiability trade, not a rule.)

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
       **bootstrap self-detect** first step asks one question: **is grove
       installed at all yet** — i.e. **does the `grove-review-policy` block
       exist on the protected default branch** (`origin/<default>`,
       HEAD-independent per `adr-0013` INV1/S6). If **absent** (no grove
       policy on the base — this PR is introducing grove), it exits green —
       *"grove install detected — the check activates on your next PR"* —
       and never invokes the check. Once merged, the policy lives on the
       base; every subsequent PR runs the check for real.
     - **Why the discriminator is *policy-presence-on-base*, not
       *workflow-file-presence* (adversary F1).** The tempting discriminator
       — "does `check_workflow_path` exist on base" — **collides head-on with
       `adr-0013`**: adr-0013's carrier fail-close uses that *exact*
       condition (`check_workflow_path` absent on the protected branch) to
       force a **carrier-unresolved red** (adr-0013 AC4 / round-3 R3-F1 — a
       *relocated* established install whose key still names the old path is
       absent-on-base and **must red**). A workflow-file-presence skip would
       read that established-but-misconfigured install as "fresh install →
       green," silently overriding adr-0013's red and reopening the hole its
       round 3 closed. **Policy-presence-on-base does not collide:** a
       genuine first install has *no* `grove-review-policy` on base → green
       skip; an *established* install (policy present on base) never skips,
       so adr-0013's carrier-unresolved red fires exactly as adr-0013
       mandates. The two conditions are now orthogonal.
     - **The F3 tripwire is unweakened, and the discriminator is
       S6-safe.** The skip reads *only* the protected branch, so a PR cannot
       forge "install detected" by editing its own HEAD (adversary F2 — the
       quiet bypass a HEAD-read would open is closed by the base-read). A
       later PR that *edits* `.grove/check/**` (a grove version bump) on an
       established install runs and gates normally — policy is on base, so no
       skip. Install ≠ edit; the check tells them apart by *grove's presence
       on the protected branch*, not by a `paths-ignore` on the machinery
       (which *would* reopen F3's silent-machinery-edit hole — rejected).
       Bypass enumeration: (i) forge the discriminator in-PR — **closed** by
       the base-read (S6); (ii) delete grove's policy from the protected
       branch to re-trigger a skip — requires **loudly merging a PR that
       removes grove's own policy carrier**, itself a carrier edit that reds
       and must be knowingly merged (same class as "a repo can always delete
       its own gate"). No silent path remains.
     - **Scope of the "no red on arrival" guarantee (adversary F3): an
       *atomic* single-PR install.** If a consumer splits the install —
       workflow/policy in one PR, runtime `.grove/check/**` in a later PR —
       the second PR **reds** (policy is on base, the check runs, and the
       just-added runtime owes reviews it cannot yet have). This **fails
       safe** (a red, never a silent skip — F3 intact), but the "grove does
       not red on its own arrival" promise holds for the atomic install; a
       split install reds on the trailing piece. Setup composes the whole
       overlay in one pass, so the atomic case is the default; the split
       case is named, not hidden.

2. **The install is invisible to the consumer's existing tooling.** Setup
   (interactively — see move 3) **detects** the consumer's linters/
   formatters — ESLint (`.eslintrc*`/`eslint.config.*`/`eslintConfig`),
   Prettier (`.prettierrc*`/`.prettierignore`), Biome (`biome.json`), and
   **markdown formatters** (markdownlint `.markdownlint*`) — by config
   presence, and **offers** (never imposes) to add the **whole `.grove/`
   namespace** — not just `.grove/check/` — to their ignore, augment-never-
   clobber, honoring the answer; an undetected tool is reported "none
   found," never a false claim.
   - `.grove/` is the namespace boundary: all of it (runtime, companions,
     policy carrier) is grove's vendored territory, none of it consumer
     source. The whole-namespace rule is future-proof — it covers runtime
     that later grows beyond `check/`, and non-JS tooling — where a
     `.grove/check/**` glob would not.
   - **Why markdown tooling is in scope, not just JS linters
     (`trellis/decision-0049`):** grove's *immediate* pilot hit was ESLint
     `no-undef` on `.grove/check/**` — lint **noise/failure**. But the
     deeper class is a consumer *formatter* **mutating** a vendored file:
     `.grove/`'s companions and policy carrier are markdown, and any
     integrity the vendored runtime later relies on (a manifest/checksum on
     `.grove/check/**`, as trellis already has for its overlay) is
     **corrupted**, not merely flagged, by a reformat. Ignoring the whole
     `.grove/` in *format* tooling too is what prevents that.
   - **This is the one offered exception to "touch nothing outside the
     overlay + the managed `CLAUDE.md` block"** (`floor`-analogue: grove's
     intent gate + transparency). Editing the consumer's ignore file is the
     sole place setup writes outside grove's own footprint — always with
     consent, always augment-never-clobber, always naming exactly which
     ignore file and line were touched. Recorded as a consented exception,
     not silent scope-creep.
   - (The consumer's lint/format-ignore is a *separate tool* from grove's
     check — ignoring `.grove/` in ESLint does not affect grove's own F3
     gating of `.grove/check/` edits, which reads those files at runtime
     regardless.)

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
- **Discriminate the self-detect on `check_workflow_path` presence on base
  (this draft's first cut).** Rejected (adversary F1): it *collides* with
  `adr-0013`'s carrier fail-close, which forces a **red** on that exact
  condition (workflow carrier absent on the protected branch — a relocated
  established install). A workflow-presence skip would silently override
  that red. Replaced by *grove-policy-presence on base*, which is orthogonal
  to the carrier condition (move 1b).
- **`paths-ignore` the machinery so install PRs skip the check.** Reopens
  `adr-0013` F3's silent-machinery-edit hole (a PR editing *only*
  `.grove/check/**` would skip its own gate). Rejected — the fix is *how
  the install lands*, not *weakening the trigger*.
- **Ignore only `.grove/check/` in the linter.** Scoped to "what ESLint
  flags today," not the namespace boundary; not future-proof. Rejected in
  favor of the whole `.grove/`.
- **Ship the runtime with a Node-env lint marker instead of ignoring.**
  Belt-and-suspenders at best, version/flat-config-fragile, and it does not
  address the "you shouldn't lint a dependency" principle at all (it only
  quiets `no-undef`, not the format-mutation/checksum class of move 2).
  Rejected as the mechanism; **parked** as an optional future add *alongside*
  the ignore if a consumer's config resists directory-ignore — not blocking,
  not built now.

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
3. The **`/grove:remove` skill** gains the **symmetric inverse**: offer to
   strip the `.grove/` ignore entry setup added (augment-never-clobber in
   reverse — remove only the line setup wrote, with consent, touching
   nothing else). Flagged so the residue is not forgotten
   (`trellis/decision-0049` flags the identical follow-up).
4. The **consumer README** (`reference/ci/README.md`) states both plainly
   (self-guiding principle).
5. The **math-quest pilot** re-runs against all three.

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

## Self-check (rubric)

Self-checked to `gated` 2026-07-18. Problem stated from an **observed**
failure (the math-quest pilot's two install-time reds — linter on the
vendored runtime, and the install PR self-redding on grove's own
machinery), not a hypothetical. The three moves are settled and mutually
independent (1a git-neutral hand-back; 1b landing-agnostic workflow
self-detect; 2 tooling-invisible ignore; 3 live-session placement); each
alternative is rejected with a reason, including this draft's *own* first
cut (the injected landing recommendation). The `adr-0013` F3 interaction is
addressed head-on (the self-detect does not weaken the tripwire, argued
explicitly). Consequences name the artifacts and the executing surfaces;
the remaining opens (M2 generative-morph isolation; `.trellis`/`.grove`
folder consolidation; the optional Node-env marker) are **parked with
rationale**, not unresolved core.

**Cross-review settled, both directions.** Revised 2026-07-17
(`trellis/decision-0048`, PR #159 — split move 1, corrected the injected
landing opinion, deepened move 3, parked M2) and 2026-07-18
(`trellis/decision-0049`, PR #160 — the format-mutation/checksum sharpening,
the consented scope-exception, the prose-provenance correction, the
symmetric `/grove:remove`). Cross-repo draft provenance is carried in prose,
**never as frontmatter edges** (`adr-0011` / `decision-0044` — the referents
are drafts and cross-repo/shape-check-only; asserting a machine edge would
overclaim). `depends_on` is only genuine coupling (`adr-0012` the check this
governs; `adr-0013` the scope mode + F3 tripwire + carrier keys it builds
on); `adr-0005` is `informed_by`.

**Decision-adversary round 1 (2026-07-18): NEEDS-REVISION** — two must-fix
(F1: the move-1b self-detect discriminator *contradicted* `adr-0013`'s
carrier fail-close, using the same workflow-absent-on-base condition adr-0013
reds on, so a relocated established install would silently green-skip; F2:
the discriminator must be read from the protected branch, not forgeable
HEAD) and two notes (F3: the "no red on arrival" guarantee is atomic-install
only — a split install reds fail-safe on the trailing piece; F4: the
provenance-retraction rationale mischaracterized `adr-0011` as *disallowing*
the edge). All four applied in this revision: the discriminator is now
**grove-policy-presence on the protected branch** (orthogonal to adr-0013's
carrier condition, S6-read, bypass enumeration closed), the atomic-install
scope is stated, and the provenance rationale corrected to a verifiability
*choice*. The adversary found the premise sound and everything else it
attacked (moves 1a/2/3, INV14 non-collision, build-on-settled-ground)
holds. This revision is NOT claiming round-1 validation — a round-2
re-review scoped to the corrected discriminator + provenance rationale
precedes the human gate.

Not claiming the adversary has validated this — the decision-adversary pass
precedes the human gate; the `approved` intent act is the maintainer's
(`gated → approved` flip), never the shaper's.
