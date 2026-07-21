---
id: adr-0027-retire-ci-for-now
type: adr
status: gated  # self-checked (shaper) 2026-07-21 after the maintainer's in-session direction ("Yes, let's retire CI"); answers grove#119; supersedes-in-part adr-0026 (CI-floor parts) and operationally suspends spec-0002/spec-0003/adr-0023; decision-adversary SOUND at 7494a8f (3 non-blocking folded, with the maintainer's ask-function refinement — the hand-off survives as prose, D2) → SOUND on scoped re-review at 11252a9 (D2 hand-off verified clause-by-clause vs adr-0023; F4/F5 folded pre-gate); awaiting the maintainer's intent act
depends_on: [adr-0026-thin-vendor-boundary, adr-0012-methodology-delivery-machinery]
informed_by: [adr-0013-check-scope-mode, adr-0022-strict-mode-review-friction, adr-0024-enforced-gate-under-ship-agent, adr-0025-decline-review-waiver, adr-0023-review-triage-blackboard, spec-0002-review-bookkeeping-check, spec-0003-review-asks-and-audit]
owner: agent
updated: 2026-07-21
---

# ADR-0027: retire the deterministic CI/bookkeeping machinery for now — Claude-plugin path only, revive via a provider-agnostic installer later (grove#119)

> **`gated` — converged on arrival, awaiting the adversary + the intent gate.**
> grove#119 asked whether the deterministic per-pair review-record model
> (spec-0002 + the reviewer-record protocol + spec-0003 asks/audit + the
> auditor) is worth its keep. The maintainer's answer, in-session 2026-07-21:
> **retire it — suspend, not delete — and run the Claude-plugin path only, with
> a documented revival route.** The evidence is on the record and one-sided for
> *today*: the check **blocks nothing** (advisory under `ship = human`, on an
> unprotected `main`), it is **not catching the failure it exists for** (the
> roles are narrated-not-dispatched — grove#118, math-quest#279 — so its reds
> are `never-reviewed`/`no-reviewable-upstream` noise, not `review-failed`
> findings), and its friction is a **five-decision lineage that never closed**
> (adr-0013/0022/0024/0025/0023). A backstop that blocks nothing backstops
> nothing. So we stop paying for it now and bring it back when there is a real
> enforcement need to justify it. The **ask function survives the medium**
> (D2): producers still close every pass with a prose hand-off — the nudge,
> the dispatcher-routing signal, the reviewer orientation — only the record
> machinery goes. Five Decided, none Open, one Parked. Adversary: **SOUND**
> round 1 at `7494a8f` (3 non-blocking, folded with the ask-function
> refinement) → **SOUND on scoped re-review at `11252a9`** — the D2
> hand-off verified clause-by-clause against adr-0023; F4/F5 precision
> notes folded pre-gate (adr-0021 pattern). Awaiting the intent act.

## Decision state

### Decided

- **D1 — retire (suspend) the CI/bookkeeping machinery; preserve the code**
  *(maintainer, 2026-07-21, answering grove#119's keep/lighten/replace fork with
  "retire — for now")*. Operationally suspended: the **spec-0002 check** (the
  `plugins/grove/check/` runtime + the `grove-review-bookkeeping` workflow), the
  **PR-comment record protocol** (`grove-verdict` / `grove-review-ask` /
  `grove-audit`), the **spec-0003 asks/audit** layer, and the **auditor** role
  (a shadow instrument for the check's owed-set — no check, no owed-set to
  audit). **What retires is the record *medium*, never the ask *function*** —
  the producer's closing hand-off survives as prose (D2).
  **Preserve, don't delete:** the `check/` runtime and its specs stay
  in-repo, unwired and dormant, so revival (D4) is a re-wiring, not a rebuild.
  The retirement is the *machinery*, never the *principle* — independent review
  still matters (D2).

- **D2 — the review roles stay; they run in Claude, review, and report — they
  just stop posting CI records** *(shaper, from the direction)*. `executor`,
  `conformance-reviewer`, `code-reviewer`, `spec-adversary`,
  `decision-adversary`, `corpus-reviewer`, and the rest keep their charters and
  keep running as dispatched Claude agents; the human at merge is the gate, as
  they already are (`ship = human`). What retires is the **mechanical
  bookkeeping** (owed-map, fingerprinted records, the check's red/green) — the
  layer adr-0012 added on top of the roles, not the roles. The `record-verdict`
  / `record-ask` / `record-audit` / `review-preview` / `check-install` skills
  retire with the protocol; `grove-status` and the non-CI skills stay.

  **The producer's closing hand-off survives the medium** *(maintainer
  refinement, 2026-07-21: keep the "nudge value … driving the dispatcher
  choice, and letting the reviewer know what the producers think should be
  reviewed — not the medium itself")*. Every producing pass still ends by
  declaring, in plain prose on its change-request (body or closing comment):
  its **subjects**, their **type**, and the producer's **advisory read on what
  deserves review and why**. Three functions kept: the **nudge** (work is
  surfaced for review, unconditionally — the mini-PR rule survives as
  discipline: you hand off however good you think the work is), **dispatcher
  routing input** (the signal drives which reviewer gets dispatched — with the
  mechanical owed-map gone this is a real input to a routing judgment, not
  paperwork feeding a machine), and **reviewer orientation**. It stays
  **advisory, untargeted, and non-self-exempting** (the adr-0023 D2/D3
  lineage): it names no reviewer — *which* reviewer is the dispatcher's
  routing call — and a hand-off can never exempt, retype, or soften
  anything. So adr-0023 D2's closing-ask
  **principle is preserved, re-homed as prose**; only its **record mechanism**
  (the fenced `grove-review-ask` block, the `record-ask` skill, the spec-0003
  §A layer) suspends with D1.

- **D3 — this supersedes adr-0026's CI-floor parts; the plugin thin-vendor build
  proceeds without the CI-coupled slice** *(shaper)*. adr-0026 kept a repo-side
  "CI-read floor" and its **D2 declarations-carrier split** exists *only* to let
  the check read declarations from the protected branch. With no check, that
  carrier feeds nothing: **adr-0026 D2 is mooted**, and adr-0026's "the repo
  keeps the CI-read floor" framing is reversed here (append-only pointer on
  adr-0026, Propagation). adr-0026's **still-live** core stands unchanged: fleet
  + skills + companions into the plugin (D1/D7), the shared config + per-role
  addenda (D3), the version stamp (D4), and the own-role exception (D5) — D5
  precisely: its namespacing/own-role core survives; its "declaration blocks
  feeding the §C.1 assembly" sub-clause moots with the check (adversary F2).
  The build is now just that clean plugin slice — the
  `grove-review-declaration` blocks are removed from charters (nothing reads
  them) rather than split into a carrier.

- **D4 — the revival route is a provider-agnostic installer, not the plugin**
  *(maintainer's insight, 2026-07-21)*. The check is **zero-dep Node that runs in
  GitHub Actions — it never needed Claude**; installing it through the Claude
  `setup` skill was a coupling smell (even a Claude user's CI runs it via
  Actions, not the plugin). When a real enforcement need returns — a
  `ship = agent` consumer (adr-0024), a protected branch requiring the check, or
  a non-Claude/CI-only audience — the check comes back via a **trellis-style
  `install.sh`**, decoupled from the plugin. This is a **suspension with a named
  revival mechanism**, not a teardown; the code preserved in D1 is what the
  installer would ship.

- **D5 — grove#119 disposition + the revival trigger** *(maintainer + shaper)*.
  grove#119 **closes as answered: retire-for-now.** The over-owing friction
  routed to the triage lineage by adr-0025 is **subsumed** — there is no check
  to over-own against. Revival is **not** automatic on any single event; it is a
  future decision, triggered when enforcement is actually needed and worth the
  friction (the D4 conditions), starting from this decision's scope, not a blank
  page.

### Open

*(none — the direction was the maintainer's explicit call; next: decision-adversary, then the intent act.)*

### Parked

- **P1 — the review-*roles*' own future** (do the reviewer agents earn their keep
  as report-only Claude passes without a gate?) is a *separate* question from the
  CI machinery and is **not** decided here. This ADR retires the mechanical
  layer only; whether/how the human ensures reviews happen without it is the
  standing human-in-the-loop model (D2), revisited if it proves insufficient.

## Given (inherited — cited, not reopened)

- **adr-0012**: the check exists because "the principles were loaded and did not
  fire … the fix must be machinery, not more prose." **This decision accepts the
  counterargument's weight and overrides it for now on evidence**: the machinery
  is not firing *either* (narrated-not-dispatched roles), and it blocks nothing —
  so today it adds noise, not enforcement. The adr-0012 risk (author≡reviewer
  fusion, skipped reviews, stale-upstream PASS) returns to the human at merge;
  D4's revival is the answer if that risk becomes real cost.
- **adr-0024**: the check is advisory under `ship = human` (grove-self and
  math-quest today) — "posts nothing," blocks nothing. This is *why* retiring it
  loses no live enforcement.
- **adr-0013/0022/0025**: the friction lineage — scoped mode, allowlist hints,
  the parked over-owing fix, the declined waiver — all mitigations that never
  closed the friction. Retirement resolves the lineage by removing its subject.
- **adr-0026**: the thin-vendor decision this amends; its non-CI core survives.
- **spec-0002 / spec-0003**: the specs of the suspended machinery — kept
  `approved` and in-repo (dormant), not marked `superseded`, because the code
  exists and D4 revives it; a suspension pointer is added, not a teardown.

## Honest costs (surfaced, not buried)

1. **No mechanical backstop.** With the check gone, nothing *automatic* catches a
   skipped owed review or an author reviewing their own work — it is the human at
   merge plus the roles' own discipline. This is a real loss against the
   *aspiration*; against *today* it is near-zero, because the check caught none of
   this in practice (it only reddened advisory-ly). Named, accepted, and the D4
   trigger is the reversal if the loss becomes real.
2. **The auditable record/verdict trail goes.** No `grove-verdict` history of what
   was reviewed. Mitigation: it was barely being produced (grove#118); the human
   review + PR history remains.
3. **spec-0002/spec-0003/adr-0023 go dormant.** Substantial approved artifacts
   become suspended-not-active. Kept in-repo with a suspension pointer so the
   record and the revival path survive.

## Rejected options

- **Lighten, don't retire** (build the adr-0025-routed materiality/freshness fix
  so the check over-owns less): **set aside for now.** It is real work to make a
  gate that blocks nothing less noisy — polishing a thing whose keep is exactly
  what is in doubt. If enforcement returns (D4), lightening is on the table then;
  today, removing the noise entirely is the smaller move (`inv-minimal-first`).
- **Keep it, fix dispatch** (make the roles actually run so the check greens):
  **not now.** That is the heavy discipline nobody is practicing; forcing it to
  satisfy an advisory check is effort for a gate that blocks nothing. The
  dispatch question (grove#118) stands on its own, independent of the check.
- **Delete outright** (remove the code): **rejected** — the maintainer's call is
  "for now / get it back later"; deletion would make revival a rebuild. Suspend +
  preserve (D1) keeps D4 cheap.

## Consequences / propagation (land at approval, tracked not silent)

1. **adr-0026** — append-only pointer at its D2 and its "CI-read floor" framing:
   *mooted/reversed by adr-0027; the non-CI thin-vendor core stands.* No in-place
   edit of its decided text.
2. **spec-0002 / spec-0003** — a suspension banner (kept `approved`, dormant):
   *operationally retired by adr-0027; code preserved, unwired; revival via D4.*
3. **adr-0023** — the blackboard/auditor lineage suspended with the check; pointer
   to adr-0027 noting D2's closing-ask principle survives re-homed as prose.
   **adr-0024** — courtesy suspension pointer (adversary F3): its head-SHA
   delivery presupposes the check; its `ship = agent` trigger *is* D4's revival
   trigger — same event, no divergence.
4. **The build (follow-up, executor):** dormant/unwire the `plugins/grove/check/`
   runtime + the `grove-review-bookkeeping` workflow; retire the record skills
   (`record-verdict`/`record-ask`/`record-audit`/`review-preview`/`check-install`)
   and the `auditor` charter; strip the `grove-review-declaration` blocks from
   the reviewer charters; **update the kept charters' protocol prose** (adversary
   F1 + the D2 hand-off): the four reviewer charters' output sections
   (`decision-adversary`, `spec-adversary`, `code-reviewer`,
   `conformance-reviewer`) rewritten from "emit a judgment block a machine
   stamps" to plain verdict + findings reporting; the three producer charters'
   "Closing ask" sections (`executor`, `contract-author`, `shaper`) rewritten —
   not deleted — to the D2 prose hand-off; `dispatcher`/`run-resumer`/
   `propagation-remediator` ask references updated to match; simplify
   `setup`/`refresh` to stop vendoring CI carriers (`review.toml`, wiring, check
   runtime, workflow). Folds into the adr-0026 plugin thin-vendor build (its
   CI-coupled follow-ups #114 and the CI parts of #115 are **cancelled**, not
   built).
5. **grove#119 closes** answered (D5); **grove#118** (dispatch gap) note: the
   check is no longer the reporter of that gap — it stands as its own open
   question. **grove#91** tracker gains the retire-CI line.

## Acceptance criteria (for this decision's landing)

- **AC1**: adr-0027 `approved` by the maintainer's intent act (profile:
  `intent = human`), decision-adversary verdict on record first.
- **AC2**: grove#119 closed answered + linked; #114 and the CI slice of #115
  closed as cancelled-by-adr-0027; #91 tracker line added.
- **AC3**: the append-only pointers (adr-0026, spec-0002, spec-0003, adr-0023)
  exist as tracked follow-ups — **no approved artifact edited in place**, and
  **no build rides this decision** (the teardown is its own reviewed step).

## Self-check (gate → `gated`)

*(No decision rubric in grove-self — honest-absent; checked against the house
axes, the same four the decision-adversary judges.)*

- **Internal coherence**: D1 (retire the machinery) + D2 (keep the roles) are the
  load-bearing split — the principle survives, the mechanism goes; D3 threads it
  into adr-0026 (moot D2, keep the rest) without contradiction; D4 makes it a
  suspension not a teardown, which D1's "preserve the code" enables; D5's
  no-auto-revival matches D4's "when enforcement is actually needed."
- **Contradiction sweep**: adr-0012 is the one real tension — its "machinery not
  prose" thesis. Not dodged: the Given states plainly that this **overrides**
  adr-0012 for now on evidence (the machinery isn't firing and blocks nothing),
  with D4 as the reversal if the adr-0012 risk becomes real. adr-0024 (advisory
  today) and the adr-0013/0022/0025 friction lineage all *support* the retire
  call. adr-0026's non-CI core is preserved; only its CI-floor parts are
  superseded, by pointer, append-only.
- **Build-on-settled-ground**: `depends_on` are approved (adr-0026, adr-0012);
  the direction is the maintainer's explicit in-session act; the evidence
  (advisory-not-blocking, narrated-not-dispatched, the friction lineage) was
  verified against source this session.
- **Honest scope**: the load-bearing loss — no mechanical backstop, no verdict
  trail — is surfaced, not buried, and priced as near-zero-today / real-vs-
  aspiration, with the D4 reversal named. Suspension (not deletion), specs kept
  (not superseded), and "no build rides this decision" keep the move reversible
  and the record intact.
