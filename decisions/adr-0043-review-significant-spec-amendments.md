---
id: adr-0043-review-significant-spec-amendments
type: adr
status: gated
depends_on: [adr-0004-spec-lifecycle-and-organization, adr-0010-versioning-is-operational, adr-0012-methodology-delivery-machinery, adr-0016-implements-edge-taxonomy]
informed_by: [adr-0037-pre-execution-planning, adr-0041-separate-support-from-operational-availability]
owner: agent
updated: 2026-07-26
---

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
- Apply the selector to every behavioral spec version first created after this
  decision is approved. A historical version re-reviewed without a new
  behavioral edit remains under the versioning companion's existing soft
  `changes:` condition; any post-approval behavioral edit requires a new
  version and the complete selector.
- **Maintainer, 2026-07-26:** allow multiple exact matching amendment
  decisions for one spec version. Review every match; do not force artificial
  version bumps merely to serialize independent approved decisions.
- **Maintainer, 2026-07-26:** preserve fidelity through an accumulated active
  contract set. A current spec is checked against its original `implements:`
  decision and every still-active, reciprocally linked amendment through its
  current version; a prior whole-spec verdict is not reused after the spec
  changes.

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
`UPSTREAM-INDICTED` and names the conflict rather than choosing one. An absent
match for a newly created post-approval version, duplicate id, unresolved
decision, unapproved decision, missing reciprocal dependency, version
mismatch, or uncovered behavioral clause fails closed.

For current `X@vN`, the **active contract set** is:

1. the approved original decision named by scalar `implements:`; plus
2. every approved decision `D` for which `X depends_on D` and
   `D changes X@vK`, where `vK ≤ vN`, limited to clauses not explicitly
   retired through full or partial supersession.

The spec shall retain every still-active amendment decision in `depends_on`.
It may remove a fully superseded amendment dependency only when the ordinary
forward-pointer lineage resolves to the replacement decision the spec now
depends on. Partial supersession retains the earlier approved decision and
reviews only its still-active clauses.

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
remains mandatory: the outgrown decision stays approved for partial
supersession or becomes superseded for full retirement, and carries the
appropriate forward pointer to the new decision. Conformance applies the
still-active clauses after following those explicit pointers; a reviewer does
not infer supersession merely because newer text differs.

The prospective cutoff controls obligation, not evidence usability. Every
behavioral version first created after this decision's approval must carry the
complete reciprocal records and accumulated active lineage. A historical
version re-reviewed without a behavioral edit does not fail for missing legacy
records; when complete reciprocal records do exist, the reviewer may use them
as amendment contracts. This permits Spec 0004 v7's existing complete
ADR-0041 pairing without retroactively requiring reconstruction of unrelated
historical gaps.

Before a spec creates its first post-approval behavioral version, the
contract-author shall materialize that spec's own still-active historical
amendment lineage: use its existing amendment notes and approved decision
dependencies to identify each significant amendment, add any missing exact
`changes: [X@vK]` accounting pointer, and retain the reciprocal dependency. If
the historical version or active scope cannot be established honestly, route
that spec to shaping rather than guessing. This is a touched-spec migration,
not a family-wide retroactive rewrite or re-review.

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
  fidelity check.
- `charters/contract-author.md` and `specs/README.md` point significant
  revisions to the paired-record requirement they already partially follow
  and require retention of the still-active amendment lineage, including the
  bounded touched-spec materialization before its first post-approval bump.
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
   cutoff at behavioral versions first created after this decision's approval.
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
   set, reviews every exact current-version match, fails when any required
   match or active obligation fails, and returns one ordinary `PASS`, `FAIL`,
   or `UPSTREAM-INDICTED` verdict for the reviewed spec version.
6. No new schema, field, registry, deterministic check, or retroactive corpus
   migration is introduced.
7. Spec 0004 v7 can name ADR-0041 as its amendment contract while retaining
   ADR-0031 as its original scalar `implements:` contract.
8. ADR-0012 and ADR-0016 carry scoped forward annotations to this extension,
   and any decision obligation actually retired by a later amendment follows
   the existing partial/full supersession pointer discipline.
9. A post-approval spec version retains every still-active reciprocally linked
   amendment through its current version; a previous whole-spec verdict is
   never reused after content changes, and historical missing records remain
   a soft condition unless a new behavioral version is created, at which point
   that touched spec's active historical lineage is materialized or the work
   routes to shaping.

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
append-only reconciliation with ADR-0012/0016 and superseded obligations are
explicit. The maintainer selected accumulated active contracts over stale
whole-spec verdict reuse, closing the final question. The first adversary's
four findings are folded; the decision is ready for a fresh soundness review.
No implementation is authorized by this decision-only PR.
