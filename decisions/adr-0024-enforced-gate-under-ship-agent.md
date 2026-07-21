---
id: adr-0024-enforced-gate-under-ship-agent
type: adr
status: approved  # maintainer intent act (in-session, 2026-07-20 — "build option 1 + encode the trigger", scope: SETTLE-NOW-BUILD-AT-TRIGGER per D6); decision-adversary round-1 NEEDS-REVISION (1 blocking D2 spec-0002 §E-disclosure + 3 non-blocking) folded, round-2 caught an incomplete D6-scope propagation (two summary spots) — folded; routed for the final re-confirm record; author (shaper) ≠ approver; the PR merge is the ship/landing act.
depends_on: [adr-0018-gate-profile-and-trigger-split, adr-0020-dispatcher-honors-gate-profile, adr-0023-review-triage-blackboard, spec-0002-review-bookkeeping-check]
owner: agent
updated: 2026-07-20
---

# ADR-0024: the review-bookkeeping check as an enforceable gate under `ship = agent` (grove#94, Option 1, profile-conditional)

> **Suspended (courtesy pointer) by `adr-0027-retire-ci-for-now`
> (2026-07-21; its adversary F3).** D1's head-SHA status delivery
> presupposes the check, which is retired-for-now (suspended, code
> preserved). No divergence results: this decision's D5 `ship = agent`
> trigger **is** adr-0027 D4's revival trigger — the same event that
> would activate this gate revives the check it rides on, so both
> decisions fire together or not at all.

> **`gated` — converged, awaiting the intent gate.** grove#94 (verified on
> math-quest): the check cannot be a hard merge gate that *records* satisfy.
> Record-posting greens an `issue_comment`-triggered run whose status
> attaches to the **default branch** context, never the **PR head SHA** that
> branch protection keys on — and the workflow is read-only, so it cannot
> post a status onto the head SHA itself. Under `ship = human` this is fine:
> the human **is** the merge gate and reads the check as advisory. Under
> `ship = agent` there is **no human at the merge**, so an advisory check +
> an agent shipper is **fail-open self-certification at the ship gate** — the
> builder-grades-itself failure grove exists to prevent, moved one level up.
> This decision builds **Option 1** — a profile-conditional head-SHA status —
> so a `ship = agent` profile has a *mechanical* gate, and **encodes the
> trigger** for activating it. The maintainer gave the intent direction
> in-session; all questions are Decided (**D1–D6**).
>
> The shape in one breath: **D1** the check's result is delivered as a
> **commit status keyed to the PR head SHA**, gated on the resolved profile's
> `ship` owner — posted (enforcing) under `ship = agent`, not posted
> (advisory, read-only preserved) under `ship = human`. **D2** the verdict
> *computation* and `spec-0002` **version** are unchanged — a `spec-0002`
> **§E disclosure** (per the adr-0014 precedent, *not* version-significant)
> records the enforcing posture; Option 1 adds a *delivery*, not a core
> contract change. **D3** least privilege — `statuses:
> write` is exercised only on the enforcing path. **D4** the floor holds —
> `ship = agent` forces `intent = human` for the shipped/in-domain case
> (adr-0018), so a human still ratifies **direction**; the mechanical gate
> is what lets them safely delegate the **merge**. **D5** the trigger, named
> and parked. **D6** build scope — the maintainer chose **settle-now,
> build-at-trigger**: this decision + the trigger land now; the CI mechanism
> and the §E disclosure are built when the first `ship = agent` run needs
> them (inert + e2e-untestable until then).

## Decision state

### Decided

- **D1 — Option 1: a profile-conditional head-SHA status** *(maintainer
  direction, 2026-07-20)*. A delivery step resolves the gate profile
  (`plugins/grove/gates/bin/resolve-profile.mjs`, adr-0020's resolver) and
  reads `ship`. When **`ship = agent`**, it posts the check's computed result
  as a **commit status keyed to the PR head SHA** under a stable context
  (e.g. `grove/review-bookkeeping`), so branch protection can *require* that
  context and record-posting *flips* it. When **`ship = human`** (grove-self
  today), it posts nothing — the current read-only advisory posture is
  preserved byte-for-byte. The check thereby becomes enforceable exactly
  where an advisory check would be fail-open (no human at merge), and stays
  advisory exactly where a human is the gate.

- **D2 — the verdict computation is UNCHANGED; a `spec-0002` §E disclosure,
  no version bump** *(shaper; decision-adversary-corrected)*. Green/red is
  what `spec-0002` already defines; Option 1 only *delivers* that verdict as
  a head-SHA status, so the gate *content* (owed-map, records, freshness,
  separation, §C.5/§C.6 gates) and the spec **version** are both untouched.
  **But `spec-0002` DOES govern the check's gating posture** — it opens with
  a *"read-only status view,"* §C.8 pins *"green is non-authorizing,"* and
  §D/INV11 render *"a human still … merges."* Those are premised on
  `ship = human`. Per the **adr-0014 precedent** (a workflow-shell gating
  behavior — the pre-install non-gating green-skip — was disclosed as a
  `spec-0002` **§E row + a `depends_on` edge**, explicitly judged *NOT*
  version-significant), Option 1 owes the **same**: a §E disclosure that the
  check posts an *enforcing* head-SHA status under `ship = agent`, and that
  the read-only / non-authorizing / human-merges language is the
  `ship = human` case; plus `adr-0024` on `spec-0002`'s `depends_on`. **No
  version bump** (adr-0014 precedent). So Option 1 is a workflow + delivery
  change *disclosed in §E*, not a core contract change — but it is NOT "no
  spec-0002 amendment" (the earlier framing, corrected here).

- **D3 — least privilege; the `issue_comment`+write sensitivity is disclosed**
  *(shaper)*. The workflow gains `statuses: write`, exercised **only** on the
  enforcing (`ship = agent`) path. The `issue_comment` + write-token combo is
  a known-sensitive GitHub Actions pattern — bounded here because the
  workflow **runs no PR-author-controlled code**: it reads the record stream
  and the diff and posts a status computed from them. Documented on the
  workflow so a consumer copying it understands the trade.

- **D4 — the floor holds; this is the enforcement half of a safe
  `ship = agent`** *(inherited, adr-0018)*. For the shipped presets + in-domain
  overrides, `ship = agent` forces `intent = human` (the ≥1 human intent-locus
  floor: `intent = human` **OR** `ship = human`), so a human still ratifies
  **direction**. *(adr-0018's parked P1 — `ship = agent` + `intent = agent`,
  floor satisfied by a standing decision — and P2 (external seal) are the
  counter-cases where a human is not at either locus; those are out of scope
  here and, if ever run, would need their own floor reasoning. This
  decision's argument is conservative — it assumes at-least-as-much human
  presence as the floor guarantees.)* What they delegate is the **merge** —
  and a merge
  delegated to an agent needs a guarantee that does **not** depend on the
  agent behaving (a bug, a bad model turn, prompt-injection). Platform-
  enforced branch protection on the head-SHA status is that guarantee: the
  ship-agent merges a state it **could not have faked** (independent
  reviewers post records; the deterministic check verifies them; the platform
  enforces the result). The mechanical gate is precisely what breaks the
  self-certification loop an advisory-check-plus-ship-agent would create.

- **D5 — the trigger, named and parked** *(maintainer, "encode the
  trigger")*. Option 1 is **inert while grove-self runs `ship = human`**.

  > **Trigger:** the first time a `ship = agent` profile is run (grove-self
  > or a consumer). Activating the enforced gate is then two acts: (a) set a
  > profile with `ship = agent` (which the delivery step reads), and (b) a
  > repo-admin turns on **branch protection** requiring the
  > `grove/review-bookkeeping` context on the PR head. Only (b) is a human
  > act; (a) is the profile itself.

  `grove#95` (a recorded human approval waives an owed review) is a
  **`ship = human` ergonomic** — it reduces friction on changes a *human*
  authored-and-approved. Under `ship = agent` there is no human at merge to
  waive, so #95 is **orthogonal** and NOT a dependency of this trigger. This
  also supplies the "enforced gate" prerequisite adr-0023 D6 named (the flip's
  branch-protection requirement was assuming a *requireable* check, which
  grove#94 showed needs exactly this mechanism). **Precision (decision-
  adversary):** this makes the check *requireable under `ship = agent`*; it
  does **not** make grove-self's current `ship = human` flip mechanically
  records-satisfiable — grove-self posts no enforcing status and the human
  remains its gate, so #94's underlying friction persists for `ship = human`
  by design.

- **D6 — build scope: SETTLE NOW, BUILD AT TRIGGER** *(maintainer, 2026-07-20
  — chose the minimal-first path over build-now)*. This decision + the D5
  trigger land **now** (recording Option 1's design so the path is settled and
  cheap to execute). The **CI delivery mechanism and the `spec-0002` §E
  disclosure are built when the trigger fires** (the first `ship = agent`
  run), NOT now. Rationale the maintainer accepted: the mechanism is **inert
  under `ship = human`** (grove-self today), its *end-to-end* behavior
  (`issue_comment` → head-SHA status → branch-protection block) is **not
  locally testable** (needs a real PR on GitHub with `statuses: write`), and a
  §E disclosure landed now would **document an enforcing posture that does not
  yet run** — so building inert, untestable-in-anger code and documenting
  non-existent behavior is machinery ahead of need (`inv-minimal-first`). At
  the trigger, the build is a small, already-designed piece (the delivery
  step: post-iff-`ship=agent`, unit-tested via fakes; the §E disclosure) whose
  e2e is verified on the real `ship = agent` PR that first needs it. *(The
  build-now alternative — land the inert mechanism now so the trigger is a
  pure config flip — was considered and set aside; recorded so the choice is
  explicit.)*

## Given (inherited — cited, not reopened)

- **adr-0018 / adr-0020 / adr-0021**: the gate-profile mechanism, the `ship`
  owner, the resolver the delivery step calls, and the ≥1-human-intent-locus
  floor.
- **adr-0023**: the shadow blackboard; its **D6** flip prerequisites named a
  branch-protection-required check — this decision supplies the mechanism
  that makes "required" possible (grove#94).
- **grove#94**: the mechanical problem (issue_comment run status attaches to
  the default branch, not the PR head; read-only can't post a head status).
- **grove#95**: the `ship = human` review-waiver — orthogonal (D5).
- **spec-0002**: the check's verdict *computation* + version — UNCHANGED;
  its *gating-posture* language gains a §E disclosure per the adr-0014
  precedent (D2).
- **adr-0014**: the precedent — a workflow-shell gating behavior disclosed as
  a `spec-0002` §E row + `depends_on` edge, *not* version-significant.

## Rejected options

- **Option 2 as the universal end-state** (advisory-only, forever): correct
  *under `ship = human`* and kept as that profile's behavior (D1), but
  fail-open under `ship = agent` (D-banner) — so not the universal answer.
- **Amend `spec-0002`'s CORE (§C) to define head-SHA delivery / bump the
  version**: rejected (D2) — the verdict computation is unchanged; delivery is
  CI wiring. (Distinct from the §E *disclosure* + `depends_on` edge that IS
  owed per the adr-0014 precedent — that is not a core amendment or a version
  bump.)
- **Grant blanket `statuses: write` unconditionally / post the enforcing
  status under every profile**: rejected (D3) — expands the write surface and
  reintroduces the over-fires-on-human-approved-changes friction under
  `ship = human` that #95 exists to avoid. Profile-gating confines the
  enforcing status to where it is needed.
- **Build-now** (land the inert mechanism + §E disclosure now so the trigger
  is a pure config flip): considered and **set aside** — the maintainer chose
  settle-now-build-at-trigger (D6), because inert-until-trigger code +
  documenting an enforcing posture that does not yet run is machinery ahead of
  need. Recorded so the choice is explicit; the chosen default is
  build-at-trigger.

## Consequences / propagation

**NOW (this decision's landing):** item 5 (close grove#94 as decided) and
item 6 (the adr-0023 D6 note). Nothing else — per D6, the build is deferred to
the trigger.

**AT THE TRIGGER (the first `ship = agent` run — D6):** items 1–4 below. They
are the firm build set, designed here so the trigger is a small execution, not
a fresh shaping.

1. **The delivery mechanism** — a script/bin step (in the check package or a
   small `shell/` module) that: resolves the profile via
   `plugins/grove/gates/bin/resolve-profile.mjs`, and **iff `ship = agent`**
   posts the check's computed result (green/red) as a commit status on the PR
   head SHA under the `grove/review-bookkeeping` context via the REST API.
   Under `ship = human` it is a no-op. Unit-tested: the post-iff-`ship=agent`
   decision, the payload (state ↔ green/red, context, target SHA). The real
   REST call + `issue_comment` attribution is the untested edge (D6).
2. **`.github/workflows/grove-review-bookkeeping.yml`** — add `statuses:
   write` and a delivery step invoking (1); update the header (which today
   asserts "never posts a status") to state the profile-conditional posture.
   The consumer template
   (`plugins/grove/reference/ci/grove-review-bookkeeping.yml`) mirrors it
   (lockstep).
3. **`spec-0002` §E disclosure — NO version bump** *(decision-adversary
   blocking fix; adr-0014 precedent)*. Add a §E row: the check posts an
   *enforcing* head-SHA commit status under `ship = agent`; the intro's
   *"read-only status view,"* §C.8's *"green is non-authorizing,"* and
   §D/INV11's *"a human still … merges"* describe the `ship = human` case
   (under `ship = agent` the merge is an agent act gated by the mechanical
   status). Add `adr-0024` to `spec-0002`'s `depends_on`. The `version` field
   does NOT move (adr-0014 precedent, `spec-0002` §E). Spec gate is agent-owned
   under `steward` — the contract-author/spec-adversary lane handles it.
4. **test-deps ledger** — the delivery module's entry.
5. **grove#94 closes** with this decision's landing (Option 1 chosen,
   profile-conditional, trigger named); the trigger reopens the *activation*
   (a `ship = agent` run), not the decision.
6. **adr-0023 D6** gains a note: its enforced-gate prerequisite is satisfied
   by this mechanism, activating on the same `ship = agent` trigger (for
   `ship = agent` profiles; grove-self's `ship = human` flip remains
   human-gated by design — D5 precision).

## Design constraints (honored — not open questions)

- **Floor**: for the shipped/in-domain case `ship = agent` ⇒ `intent = human`;
  a human always ratifies direction. This decision never lets both intent-loci
  go agent (adr-0018's parked P1/P2 are the only floor-satisfied exceptions and
  are out of scope — D4).
- **adr-0020 single-reader seam, named**: the delivery step is a *new*
  consumer of `resolve-profile.mjs` beyond the dispatcher / gates / setup /
  set-profile. It calls the **canonical** resolver (re-implements no floor or
  gate logic) at a **distinct layer** — CI-time merge-gate *delivery*, not
  run-*sequencing* — so it does not contradict adr-0020 D1's single-run-time-
  *reader/enforcer* framing (that decision is about who sequences a run and
  enforces gates at handover; this reads the resolved `ship` owner to decide a
  CI delivery). Named per the decision-adversary; if a future reconciliation
  wants one authoritative profile-read surface, this is a candidate to route
  through it.
- **`ship = human` posture is byte-unchanged**: grove-self today posts no
  status, keeps read-only permissions in effect on the non-enforcing path —
  no behavior change for the current profile (the load-bearing regression
  guard: the check's verdict, exit code, and view are identical under
  `ship = human` with or without this mechanism present).
- **`inv-minimal-first`**: the enforcing status is confined to the profile
  that needs it; no *core* spec surgery (only a §E disclosure, no version
  bump — adr-0014 precedent); #95 not entangled. The one concession to
  minimal-first — building inert-until-trigger code — is disclosed (D6) and
  offered back to the maintainer as an explicit choice.

## Acceptance criteria (for the AT-TRIGGER build pass — not now, D6)

- **AC1**: under a resolved `ship = human` profile, the delivery step posts
  **no** status and the check's verdict/exit/view are byte-identical to
  today (regression guard, unit-tested against a fake profile-resolver +
  fake status-poster).
- **AC2**: under a resolved `ship = agent` profile, the delivery step
  constructs a commit-status POST to the PR head SHA with context
  `grove/review-bookkeeping` and state mapped from green/red (unit-tested via
  fakes; the real REST call is the disclosed e2e edge).
- **AC3**: `statuses: write` is present only as needed; the workflow header
  documents the profile-conditional posture and the `issue_comment`+write
  disclosure.
- **AC4**: both check-package suites + typecheck green; the review-bookkeeping
  check passes on the PR (grove-self is `ship = human`, so this PR's own gate
  is unaffected by the new path).

## Self-check (gate → `gated`)

- **Internal coherence**: D1 (post iff `ship = agent`) and the D-banner
  (advisory fail-open under agent) compose — the mechanism activates exactly
  where advisory is unsafe. D2 (no computation change) makes AC1's byte-
  identity achievable. D5's trigger reads the same profile D1 gates on.
- **Contradiction sweep**: upholds adr-0018's floor (D4, with the P1/P2
  qualifier); reconciles with spec-0002 via a §E disclosure + `depends_on`
  edge rather than diverging silently (D2, decision-adversary blocking fix,
  adr-0014 precedent); names the adr-0020 single-reader seam (design
  constraints); does not entangle #95 (D5, orthogonal); supplies (does not
  contradict) adr-0023 D6's prerequisite, for `ship = agent`.
- **Build-on-settled-ground**: rests on approved adr-0018/0020/0023 and
  spec-0002 (all approved); the maintainer's intent direction is recorded and
  the gate flip is theirs.
- **Honest scope**: D6 states plainly that the mechanism is inert under the
  current profile and its e2e is not locally testable — the load-bearing
  caveat, surfaced not buried, and the minimal-first alternative is offered
  rather than foreclosed.
