---
id: adr-0053-record-layer-shedding
type: adr
status: gated  # gated 2026-08-03 by author self-check against the adr-0051 body contract (evidence on PR #207); trunk proposal ratified in-session by the maintainer 2026-08-03 ("ratify the trunk" — D5 channel)
depends_on: [adr-0008-lifecycle-enum-companion, adr-0036-remove-retired-review-bookkeeping, adr-0044-review-significant-spec-amendments]
owner: agent
updated: 2026-08-03
---

# ADR-0053: shedding for the record layer — retirement completes with supersession, and oversized specs owe a disposition

## Context

No living spec in this corpus has ever shrunk; two of six grew more than 2× in
23 days. Supersession is lifecycle-legal and has never been used on a spec. The
sharpest exhibit: spec-0002 (21,622 words) had its entire runtime deleted by
adr-0036, whose Consequences state specs 0002 and 0003 "remain approved
historical contracts" — leaving a dead contract at `status: approved` on live
`depends_on` edges, reachable from three charters through adr-0026. "Approved
and operationally retired" is a state the four-value lifecycle cannot express.
This decision deliberately reverses that adr-0036 consequence, and says so.

Freeze-at-fulfillment (draft adr-0038) is deliberately not decided here: it is
the sdd-gauntlet treatment, and the shedding-strategy fork is recorded as
deferred in adr-0054.

## Decision

1. **Operational retirement completes with supersession.** A contract whose
   obligations are wholly retired takes `status: superseded`. Because
   `charters/lifecycle.md` is the enum's single home and its supersession
   semantics assume a replacement artifact, this decision lands a one-line
   amendment there: where retirement has no successor artifact, the forward
   pointer names the retiring decision.
2. **Apply-case, atomic.** spec-0002 and spec-0003 are superseded together,
   forward pointers naming **this decision** — the decision that retires their
   status — with adr-0036 cited as the retirement rationale. Pointing at
   adr-0036 alone would land readers on its "remain approved" consequence, the
   exact conclusion this decision reverses; instead, adr-0036's Consequences
   receive the sanctioned append-only partial-supersession forward pointer to
   this decision. Atomicity is load-bearing: spec-0003 declares spec-0002 its
   substrate, consumed wholesale — retiring one alone would strand an approved
   spec's substrate off the read path.
3. **Superseded is off the read path** — already implied by adr-0050's
   status filter; stated here so the two decisions compose explicitly.
4. **Historical edges are never rewritten.** A decision's `depends_on` records
   what its correctness "is or was contingent on" (relations.md) and is never
   retargeted. Living artifacts (specs, charters) retarget or drop edges to
   superseded targets at their next edit, riding the change — no sweep.
5. **Size canary.** A living spec whose body exceeds **10,000 words** owes, at
   its next significant amendment (adr-0044's selector), an explicit
   disposition in the amendment decision: split, compact-by-supersession, or a
   recorded why-not. Never blocks; always recorded.
6. **Compact-by-supersession is the named remedy**: author a successor spec
   restating current truth compactly; the predecessor goes `superseded`. The
   successor is a living, revise-in-place spec — adr-0004 model 4 stands; no
   fulfillment or freeze semantics, no delta-spec lifecycle. Under the fork's
   Path B (adr-0054), clauses 5–6 become the pre-fulfillment regime; clauses
   1–4 are path-independent.

## Consequences

grove#197 curve 3 gains its first mechanism (split/compact pressure at
amendment time). Curve 2 shrinks wherever a dead contract sat on a depth-1
edge of a live subject: the status flip removes it from every such read, since
adr-0050's filter excludes `superseded` targets. The incumbent's measured
reconciliation subscription shrinks — disclosed to the sdd-gauntlet program
under adr-0054, not silently absorbed.

Blast radius, enumerated on the change request and tracked per adr-0052:
`charters/lifecycle.md` (the one-line supersession amendment — its single-home
Boundaries are why the amendment lands there and nowhere else), spec-0002 and
spec-0003 status lines and banners, the append-only partial-supersession
pointer on adr-0036's reversed consequence, an interaction note for adr-0044
at its next amendment, and the corpus-reviewer's existing
supersession-integrity axis now has these flips to check.

**Maintainer confirmation owed at the gate:** that spec-0003 holds no live
obligations. The evidence says it does not — its closing-ask principle survives
re-homed as prose in adr-0027 D2, per spec-0003's own banner — but the flip is
consequential and the ratifier should look before approving.

## Considered and rejected

- **Freeze-at-fulfillment now**: not rejected on the merits — deferred to the
  recorded fork in adr-0054, decided after this trunk is landed and lived with.
- **A fifth lifecycle status** (`retired`) to express approved-but-dead:
  grove#188's territory and a bigger change than needed; supersession with the
  clause-1 amendment expresses it inside the existing four values.
- **An immediate edge-retargeting sweep** across dependents of spec-0002/0003:
  clause 4's ride-the-change rule does the same work without a dedicated
  corpus-repair pass — the class of toil grove#197 exists to shrink.
- **A hard size cap on specs**: same ground as adr-0051's canary choice — caps
  invite splitting-by-formatting; the disposition duty keeps judgment at the
  gate where adr-0044 already stands.

## Open questions

- Whether adr-0026's own `depends_on` entry for spec-0002 (a decision edge,
  historical under clause 4) should carry an inline annotation when spec-0002
  flips, or nothing at all (decisions are append-only; the forward pointer on
  spec-0002 itself may be sufficient signage).
