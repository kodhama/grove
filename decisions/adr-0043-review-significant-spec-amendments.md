---
id: adr-0043-review-significant-spec-amendments
type: adr
status: draft
depends_on: [adr-0004-spec-lifecycle-and-organization, adr-0010-versioning-is-operational, adr-0012-methodology-delivery-machinery, adr-0016-implements-edge-taxonomy]
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

### Open

- At amendment review time, should conformance check the unchanged base against
  the original `implements:` contract and only the version delta against the
  matching amendment decision, or re-derive the entire current spec against
  both?

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

The conformance-reviewer resolves the original fidelity upstream through
`implements:` exactly as today. It additionally resolves the amendment
contract through the five-part conjunction above when reviewing the
significant version delta. It shall not treat any unmatched dependency or
unmatched `changes:` pointer as a fidelity contract.

This is a review-selection rule over existing relations, not a sixth edge.
Directional flow and drift remain carried by `depends_on`; version accounting
remains carried by the `changes:` cross-check; original-contract identity
remains carried by scalar `implements:`.

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

## Consequences

- `charters/relations.md` clarifies the reciprocal, version-matched pairing as
  a review selector without changing either edge's class.
- `charters/conformance-reviewer.md` learns how to select and review a
  significant spec amendment while preserving the original `implements:`
  fidelity check.
- `charters/contract-author.md` and `specs/README.md` point significant
  revisions to the paired-record requirement they already partially follow.
- Generated Grove projections are refreshed through the existing generator;
  no new runtime, parser, validator, registry, or consumer configuration is
  introduced.
- Spec 0004 v7 can be re-reviewed against ADR-0041 without retargeting its
  original `implements: adr-0031-multi-host-distribution` edge.

## Acceptance criteria

1. The methodology defines one prospective amendment-contract selector using
   only `X depends_on D` plus approved `D changes X@vN`, with exact subject
   version matching.
2. Scalar `implements:` remains the original realized-contract fidelity
   upstream and is never silently retargeted by a later amendment.
3. A bare dependency, bare `changes:` pointer, draft/gated decision, or
   version mismatch cannot qualify as an amendment contract.
4. `depends_on` and `changes:` retain their current flow and drift classes;
   the selector is explicitly not a new edge.
5. Conformance review reports original-contract fidelity separately from
   amendment fidelity and returns one ordinary `PASS`, `FAIL`, or
   `UPSTREAM-INDICTED` verdict for the reviewed spec version.
6. No new schema, field, registry, deterministic check, or retroactive corpus
   migration is introduced.
7. Spec 0004 v7 can name ADR-0041 as its amendment contract while retaining
   ADR-0031 as its original scalar `implements:` contract.

## Open questions

One question remains: whether the original-contract portion rechecks the
unchanged base while the amendment portion checks only the version delta, or
whether the entire current spec is judged against both contracts.

## Self-check

The decision consumes only approved dependencies. It preserves the canonical
meaning and edge class of all existing relations, resolves the concrete
revise-in-place/scalar-fidelity contradiction without inventing another
carrier, and fails closed on absent approval, reciprocity, or exact version
matching. The remaining review-scope choice is explicit and must close before
promotion to `gated`; no implementation is authorized from this draft.
