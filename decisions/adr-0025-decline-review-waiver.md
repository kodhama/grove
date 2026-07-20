---
id: adr-0025-decline-review-waiver
type: adr
status: gated  # converged, routed for the decision-adversary + the maintainer's intent gate (human-owned under steward). Maintainer chose the DIRECTION in-session 2026-07-20 ("decline; fix the over-owing") from a 3-way shaping fork; this text is the shaper's draft of that direction, not yet ratified. author (shaper) ≠ approver.
depends_on: [spec-0002-review-bookkeeping-check, adr-0024-enforced-gate-under-ship-agent, adr-0023-review-triage-blackboard]
informed_by: [adr-0022-strict-mode-review-friction, spec-0003-review-asks-and-audit]
owner: agent
updated: 2026-07-20
---

# ADR-0025: decline the human-approval-waives-review primitive; route the over-owing friction to materiality-triage (grove#95)

> **`gated` — converged, awaiting the intent gate.** grove#95 asked whether a
> **recorded human approval** should *satisfy (waive)* an owed review, so a
> human-approved change isn't blocked by a redundant agent-review record. The
> answer here is **no — we decline the waiver primitive** and route the real
> friction to its root. Two facts are load-bearing. **(1)** The motivating case
> (math-quest #324, a maintainer-approved wording fix to an *approved* ADR)
> reds on the **missing independent `decision-adversary` verdict**, not the
> human-gate — the issue says so directly (*"As an `adr` change it owes a
> `decision-adversary` record, so `review-bookkeeping` shows red"*), and the
> §C.5 `status: approved` gate is already satisfied there. So a waiver here does
> **not** waive paperwork; it **waives independent review itself**, on the
> `inv-independent-verification` axis grove exists to protect — and on exactly
> the changes a human is *most* confident about, which is where a blind spot
> hides (the issue's own guardrail names this). **(2)** Under grove-self
> (`steward`, `ship = human`) the check is **advisory today** — adr-0024 keeps
> it read-only (*"posts nothing"*), and its CI-enforcement mechanism is
> unbuilt — so #324's red is **advisory noise, not a blocked merge**; and where
> a waiver *would* flip a real gate (`ship = agent`), adr-0024 D5 already scoped
> #95 **out**. The honest read: the waiver's only near-term effect is turning
> advisory-red green on high-confidence changes, at the cost of grove's **first
> self-exemption on the review axis** — a door grove has repeatedly, deliberately
> closed (adr-0022 D4 parked a *narrower* metadata-only waiver; spec-0003 INV4,
> spec-0002 INV14, and adr-0013 each shut a self-exemption channel). The root
> cause is **over-owing** (a wording fix stales a whole adversary pass), which
> is a *materiality-triage* question, not a *who-can-zero-a-review* one — its
> home is the adr-0023 blackboard lineage, in shadow today.
>
> **The honest cost of declining (surfaced, not buried):** #324-style
> **advisory red persists** until the triage lineage lands. We accept that
> noise now rather than punch a hole in independent review. All questions are
> Decided (**D1–D5**); the intent gate is the maintainer's.

## Decision state

### Decided

- **D1 — decline the waiver primitive** *(maintainer direction, 2026-07-20 —
  "decline; fix the over-owing", chosen from a 3-way fork over "settle model,
  defer build" and "build the waiver now")*. grove adds **no**
  `grove-review-waiver` record and **no** mechanism by which a recorded human
  approval satisfies an owed **reviewer verdict**. The owed-review requirement
  stands as `spec-0002` defines it. A recorded human approval (`status:
  approved`) continues to satisfy **only** the §C.5 decision human-gate it
  already satisfies — it does **not** bleed into satisfying the independent
  `decision-adversary` (or any reviewer) verdict. The two are deliberately
  distinct reasons on the row (§C.5 is `routing.to: human`; the verdict is
  reviewer-routed), and they stay distinct.

- **D2 — why decline: advisory-only friction, bought with grove's first
  review-axis self-exemption** *(shaper, from the maintainer's direction)*.
  The friction #95 targets is, under grove-self today, **advisory** — adr-0024
  D1 keeps the check read-only under `ship = human` (grove-self's `steward`
  profile), so a red owed-row **blocks nothing**; the human merges and reads the
  check as advice. Where a waiver *would* flip a mechanical gate is `ship =
  agent`, which adr-0024 D5 already declared **orthogonal** ("no human at merge
  to waive"). So the waiver's near-term payload is cosmetic — advisory-red →
  advisory-green on human-approved changes — while its cost is structural: it is
  the **first time** a human approval would zero an *independent* review, on the
  axis (`inv-independent-verification`, "the builder does not grade itself")
  that is grove's reason to exist. grove's recorded posture is consistently
  **against** this: adr-0022 D4 *parked* even a narrower, metadata-only waiver;
  spec-0003 INV4 closed "the type self-exemption door"; spec-0002 INV14 forbids
  exempting a code-bearing path; adr-0013 rejected broad exemptions as "the
  review-free-zone attack." Declining #95's waiver is the same posture, held.

- **D3 — the root cause is over-owing; route it to materiality-triage, not an
  override** *(shaper)*. #324's red is generated by the **freshness model**:
  any content change to an artifact stales its prior reviewer verdict and
  re-owes a *full* re-review, with **no materiality distinction** — a one-line
  wording fix re-owes the same adversary pass as a substantive rewrite. That is
  an **over-owing** problem: the honest fix narrows *what is owed* on immaterial
  changes, it does not hand a human a lever to *zero* a legitimately-owed
  independent review. The correct home for "what is *genuinely* owed" is the
  **adr-0023 blackboard lineage** — the in-session auditor's depth-triage and
  the two residues (`spec-0003`), which already model owed-set materiality as a
  first-class, report-only question in shadow. The #95 friction is **tracked
  there** (D5) as the place a materiality answer is designed, if and when the
  advisory noise justifies the work.

- **D4 — the guard-set for any future waiver is fixed here as a BOUNDARY (not
  an adoption); this also answers the issue's four design questions**
  *(shaper)*. So a future reopening starts from settled ground rather than
  re-deriving the constraints, record what any waiver — if ever reconsidered —
  **must** carry. This is a fence, not a green light (see Rejected options):
  - **(a) explicit + auditable, never silent** — a first-class recorded event
    ("`<review>` on `<change>` **waived by `<human>`**"); green would mean
    "reviewed OR explicitly human-waived," never silently skipped. *(The issue's
    own guardrail; answers "silent vs. recorded".)*
  - **(b) non-self-issued** — the approver may **not** waive review of their own
    authored work (`lifecycle.md`:49 "no artifact's author approves their own
    work"; §C.4 producer≠reviewer separation). *(Answers "attributable to whom".)*
  - **(c) bound to a self-authenticating human channel** — in-session approval
    or the merge act (adr-0018 D11), which authenticate *by construction*. A
    bare tracker/PR comment is **forgeable** and the agent-flippable `status:`
    string is a disclosed Layer-B concession (spec-0002 §C.5/§E); grove has **no
    identity/signature primitive** (no CODEOWNERS; trust is only
    `author_association` + the unedited check), so a waiver can be **no stronger
    than those channels**. *(Answers Q1 "what counts as the recorded approval".)*
  - **(d) inert on the enforcing (`ship = agent`) path** — a waiver must **never**
    alter the green/red that adr-0024 D1's head-SHA status mirrors, or it
    reopens the fail-open self-certification loop adr-0024 D4 closed (an
    agent-forged waiver zeroing an owed review at a human-absent merge).
    *(Answers Q3's `ship`-side interaction.)*
  - **(e) a bounded non-waivable set** — mirroring adr-0022 D4: never the
    normative frontmatter fields (`status`, `implements`, `depends_on`), and
    never a conformance- or security-class review (`adr-0009`'s security
    reviewer, when it exists, is non-waivable by construction). *(Answers Q4
    "scope guard".)* And **per-owed-row, never per-change** — a waiver removes
    one specific reviewer's row, never blanket-zeros a change's whole owed-map
    *(answers Q2 "per-review or per-change")*.

- **D5 — grove#95 disposition + the reconsider-trigger** *(maintainer direction
  + shaper)*. grove#95 **closes as declined-as-a-waiver**, with its friction
  **tracked to the materiality-triage lineage** (D3, adr-0023 / spec-0003) — the
  friction is *routed and de-prioritized*, not *solved*, because it is advisory
  (D2). It is **not** re-opened by a `ship = agent` adoption alone — adr-0024 D5
  already ruled #95 orthogonal there (no human at merge to waive).

  > **Reconsider-trigger (both conditions):** (a) the materiality-triage
  > direction (adr-0023 lineage) has **landed and been found insufficient** to
  > retire the over-owing friction, **and** (b) that residual friction is a
  > **measured recurring cost** on a profile where the check actually *blocks*
  > (not advisory). Only then does a future decision revisit a waiver — and it
  > starts from D4's boundary, not a blank page.

## Given (inherited — cited, not reopened)

- **spec-0002**: the satisfaction mechanics this rests on — green = every row
  has zero reasons; the §C.5 decision human-gate (`status: approved`, `routing.to:
  human`) and the reviewer-routed verdict are **distinct reasons** on a
  `decision-adversary` row; freshness re-owes on any content change. **Unchanged
  by this decision** — declining a waiver amends nothing in the check.
- **adr-0024**: `ship = human` → the check is advisory (posts nothing); `ship =
  agent` → enforcing, and #95 declared **orthogonal** there (D5). This decision
  resolves the `ship = human`-side friction adr-0024 D5 named — by declining the
  waiver and routing to triage, **not** by contradicting adr-0024 (which never
  committed to *building* #95, only noted it exists).
- **adr-0023 / spec-0003**: the shadow blackboard + its contract — the
  auditor's depth-triage and the two residues, the first-class home for owed-set
  **materiality**, where the over-owing friction is routed (D3).
- **adr-0022 D4**: the *parked* metadata-only waiver — grove's nearest prior
  art, and the source of D4(e)'s non-waivable set (`status`/`implements`/
  `depends_on`). Corroborating precedent for declining here (`informed_by`).
- **adr-0018 D11**: the only self-authenticating human channels (in-session
  approval, merge) — the ceiling D4(c) binds a future waiver to.
- **lifecycle.md**:49 / **spec-0002** §C.4: author never approves own work;
  producer ≠ reviewer — the basis for D4(b).
- **spec-0003 INV4 / spec-0002 INV14 / adr-0013**: the self-exemption doors
  grove has already closed — the posture D2 holds.

## Rejected options

- **Build the explicit waiver record now** (grove#95's literal proposal — a
  `grove-review-waiver` class wired into the check, guarded, plus a spec-0002
  amendment): **rejected (D1/D2)**. It waives *independent review* (not
  paperwork) to relieve friction that is *advisory-only* today, punching grove's
  first review-axis self-exemption; and there is **no identity primitive** to
  make the waiver trustworthy (D4c) — under `ship = agent` it could be
  agent-forged (D4d).
- **Settle the model now, defer the build** (the adr-0024 shape: record a
  *bounded, guarded* "yes-in-principle" and park the mechanism at a trigger):
  **considered and set aside**. The distinction from adr-0024 is load-bearing:
  adr-0024 deferred a *mechanism for an already-decided **yes*** (Option 1 was
  chosen; only its CI delivery was parked). Here the answer is **no** — so there
  is no yes to defer-build. Recording a "yes-in-principle" would invite the
  build later on the *same* advisory-only justification we reject now, and
  would read as grove blessing a review-axis self-exemption it has consistently
  declined. We instead record D4 as a **boundary on any future waiver**, not a
  parked adoption — the honest form of "not now, and here's the fence if ever."
- **The silent collapse** (human-approved ⇒ green, no trace): **rejected** — as
  grove#95 itself rejects it; it would hide that a review did not happen, on the
  changes where a blind spot is most likely.

## Consequences / propagation

**NOW (this decision's landing):**

1. **grove#95 closes** — disposition: *declined as a waiver primitive; the
   over-owing friction is tracked to the materiality-triage lineage (adr-0023 /
   spec-0003, D3); reconsider only per D5's two-condition trigger.* Link this ADR.
2. **The dogfooding tracker (grove#91)** gains a line: the #95 waiver path is
   **declined** (adr-0025) and *why*; the residual advisory friction is a known,
   accepted cost until triage lands (honest-scope).
3. **The materiality-triage follow-up set (adr-0023 lineage)** records the #95
   over-owing case as a **motivating input** for the triage design — the
   concrete "wording-fix-to-approved-ADR over-owes a full re-review" example.

**No build, no spec change.** Declining a primitive writes no code; `spec-0002`
and `spec-0003` are **unchanged** (this decision explicitly does not add a
waiver to the check). There is nothing to defer to a trigger — the answer is
*no*, not *later* (distinct from adr-0024's settle-now-build-at-trigger).

**Nothing downstream diverges.** No approved artifact points at grove#95 as a
committed build; adr-0024 D5's "#95 is a `ship = human` ergonomic, orthogonal to
`ship = agent`" stays true and is now *resolved* (via triage, not waiver) rather
than left open — no edit to adr-0024 is owed.

## Acceptance criteria (for this decision's NOW landing)

- **AC1**: grove#95 is closed with the D5 disposition recorded and this ADR
  linked (not merely closed).
- **AC2**: the tracker (grove#91) and the adr-0023 triage follow-up set each
  carry the routed-friction note (propagation items 2–3), so the friction has a
  tracked home and is not silently dropped.
- **AC3**: no diff to `plugins/grove/check/**`, `spec-0002`, or `spec-0003` —
  the decline is a decision, not a code/contract change (a reviewer can verify
  the PR touches only `decisions/` + tracker/lineage notes).

## Design constraints (honored — not open questions)

- **`inv-independent-verification` upheld, not dodged.** The whole decision is a
  refusal to let a human approval zero an independent review; D4's guard-set is
  a *boundary*, explicitly not an adoption (Rejected options makes the
  distinction from adr-0024 load-bearing).
- **`inv-minimal-first`.** The smallest honest resolution: no new record class,
  no check surgery, no parked mechanism. The friction is routed to a lineage
  that *already exists* (adr-0023), not a new one stood up for it.
- **Honest scope — the cost is stated.** Declining leaves #324-style
  **advisory red in place** until triage lands; the friction is *routed and
  de-prioritized*, not *solved*. This is surfaced in the banner and here, not
  buried — the maintainer chose the decline knowing the noise stays.
- **Record-why preserved.** D4 fixes the guard-set and the Rejected options
  record *why not the other two forks*, so a future reopening (D5) starts from
  settled ground rather than re-litigating from scratch.

## Self-check (gate → `gated`)

- **Internal coherence**: D1 (decline the override) + D3 (route the root cause
  to triage) compose into a *complete* resolution — refuse the wrong tool AND
  name the right home — not a punt. D4's guard-set is scoped as a boundary, so
  it does not contradict D1's decline. D5's trigger reads the same advisory /
  blocking distinction D2 rests on.
- **Contradiction sweep**: aligns with adr-0022 D4, spec-0003 INV4, spec-0002
  INV14, adr-0013 (the closed self-exemption doors) and `lifecycle.md`:49
  (author ≠ approver). Does **not** contradict adr-0024 D5 — #95 stays a
  `ship = human` friction; adr-0024 never committed to building it, so resolving
  it via triage is a completion, not a reversal. Amends no spec (spec-0002 /
  spec-0003 untouched).
- **Build-on-settled-ground**: rests on approved `spec-0002`, `adr-0023`,
  `adr-0024` (`depends_on`, all approved) and is informed by approved `adr-0022`
  / `spec-0003`; the maintainer chose the direction in-session; the intent gate
  is theirs.
- **Honest scope**: states plainly that the decline **does not solve** the
  advisory friction (it routes it) and that the noise persists until triage
  lands — the load-bearing caveat, surfaced not buried.
