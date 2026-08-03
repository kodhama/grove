---
id: adr-0052-coordination-state-out-of-ratified-prose
type: adr
status: approved  # gated 2026-08-03 (author self-check against the adr-0051 body contract; evidence on PR #207); approved by the maintainer in-session 2026-08-03: "approved. merge it after" (D5 channel; author agent ≠ approver maintainer; merge is the separate ship act)
depends_on: [adr-0012-methodology-delivery-machinery, spec-0006-voluntary-dispatch]
owner: agent
updated: 2026-08-03
---

# ADR-0052: coordination state lives in machine homes, not ratified prose

## Context

Ratified artifacts in this corpus carry living coordination state: five
decisions hold checkbox propagation sets tracking which charter copies were
updated (adr-0004/0005/0006/0018/0020); frontmatter status comments accrete
audit narration; `## Self-check` sections restate gate evidence as permanent
body content; and the grove#192–#196 cluster documents prose review-history
going stale against its own subject. adr-0012's intended effect E6 — "the human
backstops judgment, not bookkeeping" — is inverted every time a human reconciles
a checklist against reality by hand.

The machine homes already exist: verdict-record files under
`.grove/runs/<run>/records/` (spec-0006), the run cursor, `.grove/gates.toml`,
tracker issues with structured metadata, and the parked-item store named in
`.grove/config.toml`. What has been missing is the rule that coordination state
belongs in them.

## Decision

1. **A ratified body is a record, not a ledger.** No mutable coordination state
   in a `gated`/`approved` artifact body: no propagation checklists, no
   review-history narration, no living status commentary. **Forward-only** —
   existing approved bodies are append-only history and are not edited; the
   rule binds at the gate for new and amended-forward artifacts.
2. **Append-once provenance is history and stays.** One line per ratification
   act — who approved, when, at what commit — appended and never revised, is
   the same sanctioned class as the README's mandated forward pointer. Living
   annotations are not.
3. **Propagation obligations are tracker state.** At ratification, the blast
   radius is enumerated once on the change request; completion is tracked as
   tracker issues or parked-item entries — never as body checkboxes. A
   decision's Consequences may name what depends on it; completion tracking is
   external.
4. **Self-check is gate evidence, not body content.** The self-check justifying
   a `draft → gated` flip lives on the change request and in the verdict-record
   channel, not as a permanent body section. This does not pre-empt grove#74's
   reserved `human-approval` record mechanism, which stays unwritten until its
   own decision.

## Consequences

Newly authored decisions shed checkbox and self-check bulk (grove#197 curve 4,
additive to adr-0051). The repair class of pure-corpus PRs shrinks as
propagation completion rides tracker state (curve 1 — a modest claim, stated
honestly: most of the recent corpus-PR rise was authored output, and its
secular taper is recorded with the metrics in adr-0054).

Floors are untouched. Verdict records remain the review tokens
(floor-owed-reviews); approval remains an in-session act or a merge, never a
tracker comment (floor-d5) — the tracker holds tracking, not approval. The
change-request prose report of adr-0027 D2 remains required; this decision
moves *state*, not the human-facing evidence layer.

Blast radius, enumerated on the change request and tracked per clause 3:
`CONTRIBUTING.md` (gate-walkthrough wording), `decisions/README.md` (one line:
bodies carry no tracking state — landing together with adr-0051's contract
text), and the shaper charter is already conformant (its `## Decision state`
canvas is a working-draft device that does not survive into the ratified body).

## Considered and rejected

- **Mechanizing the five existing checkbox sets** into machine state: touching
  approved bodies violates append-only; the sets are historical records now,
  and their tracked propagations are long landed.
- **A new deterministic bookkeeping runtime** to hold this state: adr-0036
  retired the last one and ruled any revival "a new implementation decision";
  the existing homes (records, tracker, parked-item store) suffice for the
  state this decision relocates.
- **Forbidding frontmatter status comments entirely**: the append-once
  provenance line is load-bearing history (it records the D5 act); banning it
  would push approval provenance into commit archaeology.

## Open questions

- Whether the parked-item store or tracker issues should be the default home
  for propagation obligations (both are sanctioned here; convergence can be
  recorded later from practice).
