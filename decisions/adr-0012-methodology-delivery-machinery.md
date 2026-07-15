---
id: adr-0012-methodology-delivery-machinery
type: adr
status: draft
depends_on: [adr-0005-tdd-and-artifact-gated-dispatch, adr-0006-operational-conformance-mechanism]
owner: agent
updated: 2026-07-15
---

> **Provenance.** Shaping canvas opened from grove#59, which captured a
> finding authored in a `gundisalwa/math-quest` session (2026-07-14/15):
> an agent with the **full grove roster + trellis overlay loaded** still,
> unprompted, (1) combined spec-author and builder in one pass, (2) ran
> only the conformance gate when the work owed conformance + code-review +
> spec-adversary, and (3) let a conformance PASS stand after the spec it
> validated was revised underneath it. Each was caught only by the
> maintainer in real time; no mechanism fired. Worked trace: math-quest
> PR #278 (C1-S2); prior role-separation data: math-quest #261. This is a
> **delivery** finding — the principles were loaded and did not fire — so
> the fix must be machinery or a structural default, **not more prose**
> (that is the failure mode being reported). This canvas is `draft`; the
> intent gate never opens to an agent — the maintainer shapes and
> approves.

# ADR-0012 (draft): methodology that reaches the point of action — role separation, gate completeness, and gate freshness as machinery, not prose

## Decision state

Three lists, kept current every turn. The maintainer reads the live state
of the decision here.

### Decided (with who / when)

- **The finding is a real grove-methodology gap, and belongs on grove**
  — maintainer, by moving it here directly from math-quest rather than
  the dual-home capture-then-transfer workaround (grove#59, 2026-07-15).
- **The discriminator is machinery, not content.** What *held* in the
  originating session was machinery-backed (the `pr-contract.yml` red
  check, the human merge gate, the pre-push hook); what *failed* was
  prose-only (role separation, gate completeness, gate freshness). A fix
  made of more paragraphs is disqualified by construction — this is
  grove's own "triggers not vigilance" turned on the methodology itself
  (grove#59; endorsed as the framing the canvas is built on).
- **Enforcement architecture: C — both layers** (maintainer, 2026-07-15).
  A **structural default** in dispatch (the lazy path is the correct one)
  **backstopped by a mechanical red check** (for when the default is
  violated). Rejected: A-alone (CI only, no default) and B-alone
  (structural default only) — B-alone leans on the dispatching agent
  following its default, the exact thing that failed in the reported
  session, so it does not clear the "machinery, not vigilance" bar on its
  own. Both proposals 1–3 now resolve into a default layer *and* a check
  layer.

### Open (the live questions)

- **O0 — the keystone primitive: the gate-verdict artifact.** Under C,
  all three proposals resolve into a default layer + a check layer, and
  the check layer rests on one primitive: *the thing a gate emits, that
  the red check reads, that the freshness rule binds to a commit.* Define
  it once and O2 (missing → red), O3 (subject moved → stale → red), and
  O1's disclosed-deviation marker all become instances of it. **Note:**
  grove's `dispatcher.md` W1 already encodes the gate *sequence*
  (conformance ∥ code-review at 4½; spec-adversary before the human spec
  gate) — so the B-layer is a *tightening of an existing default*, not new
  prose; the genuinely new machinery is this artifact + the check on it.
- **O1 — Proposal 1: role separation as the default execution path.**
  Make separate cold-started author → builder → reviewer the structural
  default; *combining* them becomes the explicit, disclosed deviation.
  Open: what is the concrete **mechanism** that makes the lazy path the
  correct one (charter-default dispatch shape? a red-check backstop when
  commits show author == builder without a disclosed-deviation marker?
  both?) — since "structural default" must resolve to something checkable,
  not a restated rule.
- **O2 — Proposal 2: a per-workflow gate set, mechanically checked.**
  Define which gates each work-type owes (execution build → conformance +
  code-review; spec authoring → spec-adversary before the human gate) and
  make it checkable, not remembered: gate verdicts posted as PR artifacts,
  and the contract check goes **red** when a required verdict is absent.
  Open: the gate-set-per-work-type table, and the verdict-artifact format
  the check keys off.
- **O3 — Proposal 3: gate freshness (genuinely new).** A verdict is bound
  to the commit it ran on; any change to its subject voids it — and for a
  conformance review the subject is **code *and* spec** (a spec-only edit
  still voids a prior conformance PASS). Gates run last, on the final
  state, in dependency order. Open: confirm this lands as a
  **dispatcher-charter corollary** of "don't skip review," **not** a new
  trellis invariant (keep the invariant set lean; promote to trellis only
  on the maintainer's explicit cross-project call).
- **O4 — landing surface.** The brief proposes all three land in
  `charters/dispatcher.md` as operational content. Open: confirm the
  dispatcher charter is the home (vs. splitting the mechanical check into
  `pr-contract.yml` / adr-0006 machinery and keeping the charter as the
  operational statement), and confirm that any text **consolidates or
  replaces, never accretes.**

### Parked (deferred, with why)

- *(none yet — items land here as the maintainer defers them, with the
  one-line why.)*

## The problem this decision frames

Prose + agent vigilance does not hold for load-bearing sequencing. Three
sequencing guarantees the methodology *states* but does not *enforce* —
role separation, gate completeness, gate freshness — each failed in a
single session despite being loaded, and each was caught only by a human
acting as the backstop for *"did the process run,"* not for *judgment*.
The methodology's own goal is that the human is the backstop for judgment.
This decision asks what machinery or structural default moves those three
guarantees off the human's shoulders.

## Worked trace (the anti-pattern the proposals prevent)

math-quest PR #278 (C1-S2), read as what should not happen:

| Step | Commit | What happened | Anti-pattern |
|---|---|---|---|
| 1 | `21cbb09` | One agent authors the spec amendment | — |
| 2 | `340efd2` | **The same agent** builds impl + tests | **A1: author == builder** |
| 3 | — | PR opened; **only** conformance-reviewer dispatched → PASS | **A2: 1 of 3 owed gates ran** |
| 4 | `d53fae0` | Conformance's record findings applied | — |
| 5 | — | *Maintainer* names the two missing gates — a human, not a mechanism | A2 surfaced |
| 6 | `1762e0f` | code-reviewer (PASS-w/-advisory) → finding fixed | — |
| 7 | `6ed2755` | spec-adversary → **NEEDS-REVISION**; **spec revised** | — |
| 8 | — | *Maintainer:* the step-3 conformance PASS is now **stale** (spec changed at 7, a test at 6) and would have been silently trusted | **A3: stale verdict on a superseded subject** |
| 9 | `6ed2755` | conformance + code-review **re-run on the final commit** → clean | resolution |

- **A1** → Proposal 1 (O1): separate author/builder by default; combining is a disclosed, up-front deviation.
- **A2** → Proposal 2 (O2): the owed gate set is defined and its absence turns the contract check red.
- **A3** → Proposal 3 (O3): a spec edit voids the conformance verdict automatically; "re-run on final state" is the rule, not a human catch.

## Constraints (carried from the brief — bounds on any resolution)

- The fix must be **machinery or a structural default**, not more
  paragraphs. The originating session is the evidence that documentation
  does not change agent behavior.
- If any text lands, it **consolidates/replaces, does not accrete.**
- **No new trellis invariant** for Proposals 1 or 2 (both operational /
  dispatcher-charter). Proposal 3 stays a dispatcher corollary unless the
  maintainer promotes it.
- **Do not re-document role separation as prose** — it is already
  documented; that is the failure being reported.

## Considered and rejected

- *(populated as the shaping conversation retires options — each with its
  one-line why-not.)*

## Consequences

- *(drafted once the mechanisms in O1–O4 converge — which charter/workflow
  files change, whether `pr-contract.yml` / adr-0006 machinery is touched,
  what supersession pointers if any.)*

## Acceptance criteria

- *(drafted at convergence, against the settled mechanisms.)*

## Open questions (parked, ≤3)

- *(distinct from the live Open list above; filled at convergence with
  anything explicitly deferred out of this decision's scope.)*
