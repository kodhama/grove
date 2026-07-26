---
id: adr-0043-review-significant-spec-amendments
type: adr
status: approved  # maintainer explicitly ratified exact commit 2d89c860d9ea8d82455631bf6356a65532f4869c in conversation, 2026-07-26
depends_on: [adr-0004-spec-lifecycle-and-organization, adr-0010-versioning-is-operational, adr-0012-methodology-delivery-machinery, adr-0016-implements-edge-taxonomy]
informed_by: [adr-0037-pre-execution-planning, adr-0041-separate-support-from-operational-availability]
owner: agent
updated: 2026-07-26
---

> **Proposed cutoff portability refinement
> (`adr-0044-portable-amendment-review-cutoff`, draft):** if approved, that
> decision keeps this approval landing as Grove-self's local `A` and defines a
> consumer-local managed-stamp anchor. Until its intent gate completes, the
> cutoff below remains operative and no partial supersession is claimed.

# ADR-0043: review significant revise-in-place spec amendments

## Decision state

### Decided

- **Maintainer, 2026-07-26:** take the focused methodology detour surfaced by
  Spec 0004 v7's conformance review rather than hide it with inaccurate
  metadata.
- Retain scalar `implements:` as the spec's original realized-contract
  fidelity upstream.
- Reuse the existing paired records for a significant amendment: the revised
  spec `depends_on` the approved amendment decision, and that decision carries
  `changes: [<spec-id>@vN]` for the version it causes.
- Add no new edge, frontmatter field, registry, schema, or deterministic
  review machinery.
- Keep every existing edge class unchanged: `depends_on` remains flow and
  drift-bearing; `changes:` remains a non-flow, non-drift history pointer.
- **Maintainer, 2026-07-26:** use delta-scoped review. The reviewer checks
  preservation of the original `implements:` contract in the current spec,
  then checks the clauses changed for `vN` against the matching amendment
  decision rather than requiring either decision to explain the other's
  scope.
- Define one exact prospective cutoff from Git ancestry and durable review
  evidence. `A` is the first commit on the canonical target-branch history
  whose tree records this decision as approved—the durable landing OID after
  any squash or rebase. `B` is the target branch's tip commit OID captured
  when conformance review starts. The selector applies when `A` is an ancestor
  of `B`, except that an unchanged `X@vN` already present with the same
  behavioral content in `A`'s tree remains historical. The first terminal
  review is the first durably posted conformance closing report for the exact
  subject fingerprint after its last behavioral edit; that report records
  `B`.
- **Maintainer, 2026-07-26:** allow multiple exact matching amendment
  decisions for one spec version. Review every match; do not force artificial
  version bumps merely to serialize independent approved decisions.
- **Maintainer, 2026-07-26:** preserve fidelity through an accumulated active
  contract set. A current spec is checked against its original `implements:`
  decision and every still-active, reciprocally linked amendment through its
  current version; a prior whole-spec verdict is not reused after the spec
  changes.
- A live spec identity may partially supersede obligations from its original
  `implements:` decision, but may not fully supersede that decision. If no
  original obligation remains, route to shaping for a replacement spec and
  new original contract identity.
- Do not backfill operative `changes:` pointers into approved historical
  decisions. If a touched spec's active historical amendment lineage is
  incomplete before the first terminal review of a selector-governed version,
  shape a prospective consolidation/amendment decision for that version
  instead.
- Add scoped forward reconciliation to ADR-0010 and the versioning companion:
  the historical missing-`changes:` cross-check remains soft, while this
  decision adds a distinct prospective conformance-selection obligation.
- Make the accumulated active set lineage-closed. A historical exact
  reciprocal amendment remains the seed; explicit scoped supersession
  pointers carry its obligations to the approved terminal successor that the
  current spec depends on, even when that successor caused no spec version.
- Run touched-spec reconciliation before the first terminal review of every
  selector-governed version. The reconciliation trigger uses the same `A`
  ancestor-of-`B` test, never the version's authoring or creation time.
- **Maintainer, 2026-07-26:** explicitly ratified exact reviewed commit
  `2d89c860d9ea8d82455631bf6356a65532f4869c`; `approved` records that human
  intent act.

### Open

*(none)*

### Parked

- Changing `implements:` from a scalar to a list. The paired-record solution
  should be tested before broadening the core edge grammar.
- Retrospectively annotating or re-reviewing every historical spec amendment.
  Existing records remain history; apply this rule prospectively when a
  significant spec revision is reviewed.
- Reintroducing deterministic review-bookkeeping machinery. This decision
  changes reviewer judgment and routing only.

## Context

Grove requires specs to remain revise-in-place current truth. A significant
revision receives a durable approved decision, a behavioral version bump, and
a `changes:` pointer from that decision to the resulting spec version.

Grove also defines `implements:` as one scalar fidelity upstream. That works
for a newly authored spec: the spec realizes its original decision. It does
not fully describe a later significant amendment. Retargeting `implements:`
to the amendment decision would erase the original realized-contract
relationship, while leaving the amendment decision only in `depends_on`
cannot trigger a formal fidelity review because the conformance-reviewer
currently says a dependency is never a fidelity upstream.

This became concrete on Spec 0004 v7. Its artifact content passed intrinsic
review and, after one local correction, every ADR-0041 fidelity item passed.
The conformance-reviewer nevertheless returned `UPSTREAM-INDICTED`: the
artifact was faithful, but the methodology could not honestly select
ADR-0041 as the amendment contract while retaining ADR-0031 as the original
scalar `implements:` target.

The existing graph already carries enough unambiguous information:

```text
spec X@vN
  implements: original-decision
  depends_on: [..., amendment-decision]

amendment-decision
  changes: [X@vN]
```

The conjunction is narrower than either edge alone. A bare `depends_on` entry
remains general coupling and never becomes a fidelity selector. A bare
`changes:` pointer remains history and never becomes flow or drift-bearing.
Only their exact, reciprocal, version-matched pairing identifies the approved
contract for the significant amendment that produced `X@vN`.

## Selected architecture

For a significant revise-in-place change to versioned spec `X` resulting in
`X@vN`, an approved decision `D` is an **amendment contract** for that review
only when all of these hold:

1. `X` retains its scalar `implements:` edge to its original realized
   contract.
2. `X` declares `D` in `depends_on`.
3. `D` is `status: approved`.
4. `D` declares `changes: [X@vN]`.
5. The reviewed subject is exactly `X@vN`, not a later or earlier version.

The amendment-contract set contains every `D` satisfying all five conditions,
ordered by decision id for deterministic reporting. The set must be nonempty.
Multiple matches are valid.

The reviewer constructs a judgment evidence table mapping each matching
decision to the behavior-changing normative clauses in the `vN` diff that
derive from it. Each decision is reviewed only against its attributed
subdelta; overlap is allowed when one clause implements more than one
decision. The union of attributed clauses shall cover the complete behavioral
delta, so an unowned changed clause fails conformance. This table is review
evidence, not a new artifact field or persisted schema.

A failure against any match fails conformance; if two approved amendment
decisions prescribe incompatible behavior, the reviewer returns
`UPSTREAM-INDICTED` and names the conflict rather than choosing one. For a
selector-governed version, an absent match, duplicate id, unresolved decision,
unapproved decision, missing reciprocal dependency, version mismatch, or
uncovered behavioral clause fails closed.

For current `X@vN`, the **active contract set** is:

1. the approved original decision named by scalar `implements:`; plus
2. every still-current obligation seeded by a historical decision `D` for
   which the then-current `X depends_on D` and `D changes X@vK`, where
   `vK ≤ vN`.

The second member is lineage-closed. For each reciprocal historical seed, the
reviewer follows explicit clause-scoped `superseded_by` or
`superseded_in_part_by` forward pointers. An obligation is selected from its
approved current holder: the seed itself when still active, or the approved
terminal successor reached through that lineage. The current spec must depend
on every selected holder. A terminal superseded holder, missing or ambiguous
pointer, unresolved successor, unapproved terminal successor, or absent
current dependency fails closed. A successor need not falsely declare that it
changed an older spec version merely to carry forward an obligation it now
owns.

The spec shall retain every approved current obligation holder in
`depends_on`. It may remove a fully superseded amendment seed only when the
ordinary forward-pointer lineage resolves unambiguously to the approved
terminal successor the spec now depends on. Partial supersession retains the
earlier approved decision for its still-active clauses and adds the approved
successor for the clauses it now owns.

The original decision named by scalar `implements:` is different: while the
spec identity remains live, that decision must remain approved and at least
one of its obligations must remain active. Partial supersession is allowed and
narrows the original-contract review to the still-active clauses. Full
retirement of the original contract makes the existing spec identity
inaccurate, so the work routes to shaping for a replacement spec with a new
original contract identity; the reviewer never follows a terminally
superseded `implements:` target as though it were approved.

The conformance-reviewer resolves the original fidelity upstream through
`implements:` exactly as today. Against the current spec, it derives the
accumulated active contract set and confirms that every still-active
obligation remains satisfied. Matched later additions are not scope creep
against the original decision, and an earlier obligation stops applying only
through explicit supersession lineage. A previous whole-spec conformance
verdict is stale once the spec changes and is never reused as the baseline.

It additionally resolves the amendment contract through the five-part
conjunction above. Using the change-request diff and the spec's required
amendment note as locators—not as a second durable artifact—it checks the
attributed current clauses changed for `vN` against each matching decision's
bounded scope. It shall not require one amendment decision to explain another
decision's attributed clauses or untouched historical behavior, and shall not
treat any unmatched dependency or unmatched `changes:` pointer as a fidelity
contract.

This is a review-selection rule over existing relations, not a sixth edge.
Directional flow and drift remain carried by `depends_on`; version accounting
remains carried by the `changes:` cross-check; original-contract identity
remains carried by scalar `implements:`.

This is a scoped extension of ADR-0012 and ADR-0016's “single fidelity
upstream” rule, not a contradiction or replacement. `implements:` remains the
single original fidelity edge. The reciprocal pair selects a bounded
amendment contract for one version review; it does not turn either component
relation into another fidelity edge.

When a new amendment changes or retires an obligation from the original
decision or an earlier amendment decision, ordinary append-only lineage
remains mandatory. An earlier amendment decision stays approved for partial
supersession or becomes superseded for full retirement and carries the
appropriate forward pointer to the new decision. The original decision may
only be superseded in part while the current spec identity remains live; its
full retirement uses the replacement-spec route above. Conformance applies
the still-active clauses after following explicit pointers and never infers
supersession merely because newer text differs.

The prospective cutoff controls obligation, not evidence usability. Let `A`
be the first commit on the canonical target-branch history whose tree records
this decision as approved—the durable landing OID, not a source-branch commit
that a squash or rebase may rewrite. At conformance-review start, capture `B`
as the exact commit OID at the tip of the change request's target branch—not
the source branch's merge-base or a moving branch name. The first durably
posted conformance closing report for the exact subject fingerprint after its
last behavioral edit is that subject's first terminal review, whether its
verdict is `PASS`, `FAIL`, or `UPSTREAM-INDICTED`; advisory prose and
session-only output do not count. The closing report records `B` as judgment
evidence, not a new artifact field or deterministic schema.

The selector is mandatory when `A` is an ancestor of `B`. This monotonic rule
governs concurrent branches: a version authored before approval but first
terminally reviewed against a target tip descended from `A` uses the selector.
An `X@vN` already present with the same behavioral content in `A`'s tree is
historical and remains exempt when re-reviewed unchanged; any later behavioral
edit produces a new subject fingerprint and version and is classified again
against its captured `B`. Complete reciprocal historical records may still be
used as amendment contracts. This permits Spec 0004 v7's existing complete
ADR-0041 pairing without requiring reconstruction of unrelated historical
gaps.

Before the first terminal review of every selector-governed version, the
contract-author shall inspect that spec's own still-active historical
amendment lineage. This uses the same `A` ancestor-of-`B` classification, not
authoring or creation time. Complete existing reciprocal records remain usable
and their dependencies are retained. If any active historical amendment lacks
an exact reciprocal record, do not edit its approved decision or pretend a
new decision caused an old version. Route the new change to shaping for a
prospective consolidation/amendment decision that explicitly carries forward
the established active obligations, uses normal supersession lineage where
needed, and declares `changes: [X@vN]` only for the new version it causes.
This is touched-spec reconciliation, not historical backfill, family-wide
migration, or retroactive re-review.

ADR-0010 and the versioning companion receive a scoped forward note. Their
low-level cross-check remains unchanged: a historical bump without an
accounting `changes:` decision is soft. Separately, when `A` is an ancestor of
the captured target-base OID `B` and the unchanged-in-`A` historical exception
does not apply, this decision's selector requires at least one approved exact
reciprocal amendment contract and fails its absence closed. The prospective
review obligation does not retroactively turn historical missing pointers
into versioning failures.

## Rejected options

- **Retarget `implements:` to the latest amendment decision.** Rejected:
  it would falsely erase the spec's original realized contract and make
  fidelity identity depend on which amendment happened most recently.
- **Change `implements:` to a list.** Parked rather than selected: it broadens
  the core grammar, creates ordering and supersession questions, and is not
  needed when the existing reciprocal records already identify the delta.
- **Treat every `depends_on` decision as a fidelity upstream.** Rejected:
  dependencies include general coupling and may have no contract relationship
  to the changed behavior.
- **Make `changes:` flow or drift-bearing.** Rejected: its direction is from
  the historical decision to the artifact it changed. The spec's reciprocal
  `depends_on` already carries flow and drift in the operational direction.
- **Accept an informal PR comment as the amendment link.** Rejected: the
  relation must be recoverable from durable artifacts rather than session or
  review prose.
- **Reuse the prior whole-spec verdict for unchanged content.** Rejected:
  Grove's freshness rule invalidates a verdict when its reviewed artifact
  changes; safe partial-verdict reuse would require new clause-level
  fingerprint machinery outside this decision's scope.

## Consequences

- `charters/conformance-reviewer.md` learns how to select and review a
  significant spec amendment while preserving the original `implements:`
  fidelity check, including lineage closure from a historical reciprocal seed
  to its approved current obligation holder.
- `charters/contract-author.md` and `specs/README.md` point significant
  revisions to the paired-record requirement they already partially follow
  and require retention of the still-active amendment lineage, including the
  bounded touched-spec reconciliation before a selector-governed version's
  first terminal review.
- ADR-0010 and the versioning companion receive a scoped forward note that
  preserves the soft historical cross-check while pointing versions governed
  by the `A` ancestor-of-`B` cutoff to this decision's distinct
  conformance-selection obligation.
- ADR-0012 and ADR-0016 receive scoped append-only forward annotations to this
  decision where they state that only scalar `implements:` selects fidelity;
  their original-fidelity edge and all other clauses stand.
- `charters/relations.md` and `charters/versioning.md` retain their existing
  edge classes and version mechanics unchanged; reviewer selection remains a
  role duty rather than a new relation definition.
- Generated Grove projections are refreshed through the existing generator;
  no new runtime, parser, validator, registry, or consumer configuration is
  introduced.
- Spec 0004 v7 can be re-reviewed against ADR-0041 without retargeting its
  original `implements: adr-0031-multi-host-distribution` edge.

## Acceptance criteria

1. The methodology defines one prospective amendment-contract-set selector
   using only `X depends_on D` plus approved `D changes X@vN`, with exact
   subject-version matching, deterministic decision-id order, and an exact
   cutoff where durable target-branch landing commit `A` first records this
   decision as approved and is an ancestor of captured target-branch tip OID
   `B`; the first durable closing report for the exact post-edit subject
   records `B`, and unchanged content already present in `A` remains
   historical.
2. Scalar `implements:` remains the original realized-contract fidelity
   upstream and is never silently retargeted by a later amendment.
3. A bare dependency, bare `changes:` pointer, draft/gated decision, or
   version mismatch cannot qualify as an amendment contract.
4. `depends_on` and `changes:` retain their current flow and drift classes;
   the selector is explicitly not a new edge.
5. Conformance review reports original-contract fidelity separately from
   delta-scoped amendment fidelity, does not make either decision explain the
   other's attributed scope, covers every behavior-changing clause in the
   version diff, verifies every obligation in the accumulated active contract
   set after resolving explicit supersession lineage, reviews every exact
   current-version match, fails when any required match, lineage link, current
   dependency, or active obligation fails, and returns one ordinary `PASS`,
   `FAIL`, or `UPSTREAM-INDICTED` verdict for the reviewed spec version.
6. No new schema, field, registry, deterministic check, or retroactive corpus
   migration is introduced.
7. Spec 0004 v7 can name ADR-0041 as its amendment contract while retaining
   ADR-0031 as its original scalar `implements:` contract.
8. ADR-0012 and ADR-0016 carry scoped forward annotations to this extension,
   ADR-0010/versioning distinguishes its soft historical cross-check from this
   prospective conformance obligation, and any decision obligation actually
   retired by a later amendment follows the existing partial/full
   supersession pointer discipline.
9. A selector-governed spec version retains every still-active reciprocally
   linked amendment through its current version; a previous whole-spec verdict
   is never reused after content changes, and historical missing records remain
   a soft condition. Before its first terminal review, incomplete active
   historical lineage routes to shaping for a prospective
   consolidation/amendment decision rather than mutating an approved
   historical decision.
10. A live spec's original scalar `implements:` decision remains approved with
    at least one active obligation; fully retiring that original contract
    requires a replacement spec and new original contract identity.
11. A fully superseded amendment seed may leave the current spec's
    `depends_on` only after explicit scoped lineage reaches an approved
    terminal successor that the spec depends on; the successor carries the
    inherited obligation without falsely claiming it changed the seed's
    historical spec version.

## Open questions

None.

## Self-check

The decision consumes only approved dependencies. It preserves the canonical
meaning and edge class of all existing relations, resolves the concrete
revise-in-place/scalar-fidelity contradiction without inventing another
carrier, and fails closed on absent approval, reciprocity, or exact version
matching. Multiple matches now receive attributed subdeltas whose union covers
the full behavioral change; conflicting approved inputs route upstream
instead of being silently ordered. The prospective cutoff and required
append-only reconciliation with ADR-0010/0012/0016 and superseded obligations
are explicit. A live spec cannot retain a terminally superseded original
fidelity upstream, and incomplete historical pairs cause prospective
consolidation rather than illegal backfill. The maintainer selected
accumulated active contracts over stale whole-spec verdict reuse, closing the
final question. The active set follows explicit amendment supersession lineage
to approved current holders, and the prospective cutoff uses the durable
approval landing commit's ancestry to an exact target-branch tip OID recorded
by terminal review. The final independent verdict was `SOUND` at exact commit
`2d89c860d9ea8d82455631bf6356a65532f4869c`, and the maintainer explicitly
ratified that revision on 2026-07-26. No implementation is authorized by this
decision-only PR.
