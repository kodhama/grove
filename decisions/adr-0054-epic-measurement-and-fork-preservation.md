---
id: adr-0054-epic-measurement-and-fork-preservation
type: adr
status: approved  # gated 2026-08-03 (author self-check against the adr-0051 body contract; evidence on PR #207); approved by the maintainer in-session 2026-08-03: "approved. merge it after" (D5 channel; author agent ≠ approver maintainer; merge is the separate ship act)
depends_on: [adr-0050-read-model-and-context-budget]
owner: agent
updated: 2026-08-03
---

# ADR-0054: the epic's curves get fixed definitions, and the shedding fork is a recorded deferral

## Context

Every headline metric in grove#197's reconnaissance proved definition-sensitive
under adversarial re-measurement — twice: the 3.5× multiplier depended on an
undefined loading model, and the re-check's own decisions-per-week series
failed reproduction under a different bucketing. An epic whose definition of
done is "four curves bend" cannot be adjudicated on definition-sensitive
numbers.

Separately, the spec-shedding strategy (freeze-on-fulfillment now, versus after
the pre-registered sdd-gauntlet validation) is deliberately deferred. The
corrected ground that reopened it: the gauntlet's gating hypotheses run on
external-repo legs whose control arms are those repos' own practices;
grove-current is the control only on math-quest — Stage 0, calibration,
counting toward no bar. Adoption would narrow the experiment, not end it — but
today nothing records the control: the program's manifest pins the treatment's
grove version and has no field for the control arm's methodology version.
Draft adr-0038 (branch `codex/adr-0038-transient-specs-draft`, anchored at
grove#142) also assumes decisions remain on the context path, which adr-0050
changes; the treatment definition needs re-anchoring under either path.

## Decision

1. **Fixed curve definitions.**
   - Curve 1: share of merged PRs, per calendar month, whose changed files all
     fall in `decisions/ | specs/ | research/ | charters/ |
     plugins/grove/reference/` (generated projections ride charter edits and
     count as corpus), reported with an authored-vs-repair split: **repair** =
     every change only adds or updates supersession/forward pointers,
     renumberings, cross-reference or status/frontmatter corrections on
     pre-existing artifacts; **authored output** = anything introducing a new
     artifact id or new body content.
   - Curve 2: adr-0050's multiplier, p50 across dispatched tasks; until
     dispatch volume exists, a fixed probe set recorded on grove#197 at
     landing, re-measured per report.
   - Curve 3: body word-count trajectories of the three largest living specs,
     tracked across supersession lineage — a compaction successor (or, under
     the fork's Path B, a freeze-plus-delta family) continues its
     predecessor's trajectory, so shedding shows as a real downward step,
     never trajectory deletion.
   - Curve 4: median body words of decisions authored in the window.
   Baselines are re-measured at this set's landing commit and recorded on
   grove#197.
2. **Honesty clauses, ratified with the metrics.** Curve 1 carries a secular
   component — the decision wave crested and fell sharply in the final
   measured week; the shape is confirmed, and no numeric weekly series is
   ratified. Causal credit on curve 1 is claimed only for the repair
   component. Curve 2's headline fall is partly definitional; the enforced
   content is adr-0050's budget and exclusion rules. Curve 4 binds newly
   authored decisions only.
3. **Fork preservation — path-independent acts.** (a) The landing commit is
   recorded on grove#197 as the named incumbent-methodology version: the
   preserved control for any future comparison under either path. Grove asks
   the sdd-gauntlet manifest schema to carry a control-arm methodology version
   field — a defect fix regardless of path. (b) Curve 2's definition is
   offered to the program for its H4 review-cost proxy, which is today the
   same measurement with two owners and no shared definition. (c) The
   shedding-strategy fork is a **recorded deferral**: a named decision owed
   after adr-0050–0053 are landed and lived with, shaped into grove#197 —
   Path A, validate-then-adopt via the gauntlet as pre-registered; Path B, a
   recorded supersession of the parked validation-gate intent followed by
   pilot-scope adoption with pre-declared observables and the pinned control.
   Neither is decided here.
4. **Nothing in this trunk builds on adr-0038** — no `depends_on`, no consumed
   content, no fulfillment semantics. It stays `draft` until the fork's gate,
   under either path.

## Consequences

grove#197's definition of done becomes decidable: the curves have fixed
operational definitions, recorded baselines, and named limits on causal
claims. The fork stays a live human choice with its control preserved at zero
cost to either path. Recommended alongside, not normative here: merge
sdd-gauntlet#10 (the written pointer-rot repair) and correct the sdd-gauntlet
repository description's stale adr-0011 pointer, which is GitHub metadata no
PR can carry.

Blast radius, enumerated on the change request and tracked per adr-0052: a
baseline-measurement comment on grove#197 at landing (probe set, incumbent
version, four baselines) and the two asks conveyed to the sdd-gauntlet
program. H1's baseline movement — the incumbent's reconciliation subscription
shrinking as adr-0051–0053 land — is disclosed to the program rather than
silently absorbed.

## Considered and rejected

- **Deciding the fork in this set**: the trunk is decidable on settled ground
  today; the fork's honest inputs include lived experience with this trunk,
  which does not exist yet. Deferral is recorded, not silent.
- **Building metrics machinery** (dashboards, CI probes, a graph preflight):
  the mechanization exit belongs to grove#91; this epic is shrink-the-base.
  The probes are hand-runnable by design — and the known risk that
  hand-runnable decays into never-run is accepted and visible here rather
  than hidden behind unbuilt tooling.
- **Ratifying the recon's numeric series as baselines**: twice shown
  definition-sensitive; only landing-commit re-measurements under clause 1's
  definitions count.

## Open questions

- Who re-measures, and on what cadence — deliberately unfixed until grove#91's
  mechanization posture answers it; until then each report re-runs the
  recorded probes by hand.
