---
id: adr-0045-portable-amendment-review-cutoff
type: adr
status: approved  # maintainer explicitly ratified exact reviewed commit 98588bc1eddacef2110e7149e351bef39beed0d6 in conversation, 2026-07-26
depends_on: [adr-0026-thin-vendor-boundary, adr-0044-review-significant-spec-amendments]
owner: agent
updated: 2026-07-26
---

# ADR-0045: make the amendment-review cutoff portable

## Decision state

### Decided

- **Maintainer, 2026-07-26:** open a focused follow-up decision rather than
  encode a Grove-only Git ancestor into Grove's consumer-facing role
  projections.
- Preserve the approved amendment selector, accumulated active-contract
  model, historical exception, and captured target-tip review evidence from
  `adr-0044-review-significant-spec-amendments`.
- Grove itself retains its durable local anchor:
  `947d9bdc702798b960a67a9a465e61beebe44fa7`, the canonical-main landing that
  first records the amendment-review decision as approved.
- A consumer repository derives its local anchor from the existing managed
  instruction-block stamp, `grove plugin@<version>`; introduce no new field,
  receipt, registry, or runtime mutation.
- Follow the merged corpus identity correction: the amendment-review decision
  is `adr-0044-review-significant-spec-amendments`, and this portability
  decision is ADR-0045.
- **Maintainer, 2026-07-26:** require two-step consumer activation. The
  rule-bearing Grove stamp lands on the canonical target branch before a
  separate behavioral-spec amendment change request begins terminal review.
- **Maintainer, 2026-07-26:** make activation repository-wide across the
  complete set of present Claude and Codex carriers. Versions may differ, but
  every present carrier must be valid and its immutable release must ship the
  rule.
- **Maintainer, 2026-07-26:** explicitly ratified exact reviewed commit
  `98588bc1eddacef2110e7149e351bef39beed0d6`; `approved` records that human
  intent act.

### Open

*(none)*

### Parked

- Further renumbering of approved decisions. The merged corpus identity
  correction already resolved the collision without changing decision
  content.
- Adding an adoption receipt, cutoff registry, or deterministic corpus check.
  The existing managed stamp and review evidence are sufficient for the
  portability correction.

## Context

`adr-0044-review-significant-spec-amendments` defines a prospective
conformance selector. Its cutoff uses:

- `A`: the first canonical target-branch commit whose tree records that
  decision as approved; and
- `B`: the target-branch tip commit OID captured when conformance review
  starts.

The selector applies when `A` is an ancestor of `B`, while unchanged
behavioral content already present in `A` remains historical.

That definition is exact inside Grove. Its durable `A` is merge commit
`947d9bdc702798b960a67a9a465e61beebe44fa7`.

It is not portable as written. Grove ships generated reviewer and author
roles into consumer repositories, but Grove's decision commit can never be an
ancestor of a consumer's history. Applying the literal rule there makes the
selector permanently false; substituting an unrecorded installation time
makes it irreproducible.

Grove already has consumer-local, versioned, durable carriers. Setup and
refresh write exactly one `grove plugin@<version>` line inside each managed
host instruction block. A repository may legitimately carry a Claude block, a
Codex block, or both; when both exist their independently valid versions may
differ. Each version identifies the immutable Grove package whose role
projection that host adopted. Grove-self intentionally has no such stamp
because it loads the package from its own tree.

## Proposed decision

### 1. Keep the cutoff repo-local

Each repository derives `A` from evidence committed to its own canonical
target-branch history:

- **Grove-self:** `A` is
  `947d9bdc702798b960a67a9a465e61beebe44fa7`.
- **Consumer repository:** `A` is the first commit on the canonical target
  branch where the selected carrier policy first establishes repository
  activation from valid `grove plugin@V` stamp evidence and every selected
  immutable release `V` ships the portable amendment-review rule.

The consumer rule uses existing authoritative repository stamps; it does not
infer adoption from a developer's global plugin cache, current session,
wall-clock installation time, or conversation.

Activation is repository-wide, not per invoking host:

1. At candidate activation commit `A`, inventory every managed Grove
   instruction block present in the canonical target tree. At least one
   carrier must be present.
2. Every present carrier must contain exactly one schema-valid stamp and every
   stamped immutable release must ship this rule. The releases may have
   different versions; content capability, not version equality, is the
   requirement.
3. `A` is the first target-branch commit where the complete then-present
   carrier set satisfies those conditions. Once established, `A` is stable.
4. At each later review base `B`, inventory the complete carrier set again.
   Adding, removing, upgrading, or downgrading a carrier does not itself
   suspend review. The resulting state suspends terminal amendment review
   only when a present carrier is malformed, duplicated, unresolved, or
   non-rule-bearing, or when no carrier remains. Correction does not move `A`.
5. A host carrier that is wholly absent is not an invalid sibling. Zero
   present carriers means no consumer anchor and fails closed.

This prevents one spec from receiving different amendment-fidelity treatment
merely because Claude or Codex performed the review, while preserving Grove's
existing permission for independently versioned valid host carriers.

`B` remains the exact target-branch tip OID captured at conformance-review
start. The reviewer records both the selected local `A` and captured `B` in
the durable closing report as judgment evidence, not as new artifact
frontmatter or a persisted schema.

### 2. Preserve the original selector

When local `A` is an ancestor of `B`, the amendment selector and touched-spec
reconciliation apply exactly as approved in
`adr-0044-review-significant-spec-amendments`.

An `X@vN` already present with identical behavioral content in local `A` is
historical and remains exempt when re-reviewed unchanged. A later behavioral
edit receives a new version and subject fingerprint and is governed.

This decision changes only how a repository obtains `A`. It does not change:

- exact reciprocal amendment selection;
- subdelta attribution or complete behavioral-delta coverage;
- accumulated, lineage-closed active obligations;
- original scalar `implements:` identity;
- partial/full supersession handling;
- the soft historical `changes:` cross-check; or
- any relation's flow or drift class.

### 3. Fail closed when the local anchor is not trustworthy

A consumer review cannot silently manufacture or guess `A`. Under the
repository-wide policy, zero present carriers, any malformed or duplicated
present carrier, any unresolved or non-rule-bearing stamped release, or an
ambiguous canonical target branch prevents terminal amendment conformance
review and routes to the existing Grove setup/refresh or shaping path as
appropriate. One valid rule-bearing carrier is sufficient when it is the only
present carrier. Two present carriers may use the same or different versions,
but both releases must ship the rule.

The reviewer never treats “no usable local anchor” as proof that all current
content is historical.

### 4. Activation ordering

Consumer activation is two-step. A Grove setup or refresh change lands the
rule-bearing managed stamp on the canonical target branch first. A separate
behavioral-spec amendment change request then begins terminal review against a
captured target tip `B` descended from that local `A`.

A single change request cannot introduce or refresh the rule-bearing stamp and
self-activate the selector for a behavioral spec amendment. If both scopes
arrive together, split or sequence them and review the spec amendment after
the stamp lands. This keeps `A` a real ancestor, avoids authority from
unmerged source content, and makes concurrent reviews deterministic.

## Rejected options

- **Use Grove's approval commit in every repository.** Impossible across
  unrelated Git histories; the ancestry test never becomes true.
- **Use the active global plugin installation.** Rejected because it is
  session-local and mutable, not repository evidence.
- **Use wall-clock setup time.** Rejected because it is not reproducible from
  the artifact or change-request record.
- **Activate independently per invoking host.** Rejected by the maintainer:
  one current spec must not receive different amendment-fidelity treatment
  merely because Claude or Codex performs its review.
- **Require every present carrier to use the same Grove version.** Rejected:
  Grove deliberately permits valid host carriers to advance independently;
  the needed invariant is that every present host can apply this rule, not
  byte-identical package versions.
- **Add a new cutoff field or receipt file.** Rejected because the managed
  instruction block already commits the exact Grove version and ADR-0044
  forbids unnecessary new schema.
- **Make all existing consumer content governed immediately.** Rejected
  because it silently removes the approved historical exception and creates a
  family-wide retroactive migration.

## Consequences

- `adr-0044-review-significant-spec-amendments` receives a scoped append-only
  forward pointer: its original `A` definition remains the Grove-self case;
  this decision supplies the consumer-local case.
- The conformance-reviewer and contract-author use the repo-local anchor and
  retain every other approved amendment-review rule.
- Generated Claude and Codex projections remain portable without embedding a
  Grove commit as a consumer-history ancestor.
- Existing managed-block syntax and lifecycle behavior are unchanged.
- No release number is guessed in this decision. “Rule-bearing release” means
  the immutable Grove version whose shipped projection contains this rule;
  its repository stamp supplies the exact version at use time.

## Acceptance criteria

1. Grove-self uses
   `947d9bdc702798b960a67a9a465e61beebe44fa7` as local `A`.
2. A consumer derives local `A` only from the first canonical target-branch
   commit where the selected complete carrier set has at least one present
   carrier, every present carrier is valid, and every stamped immutable
   release ships this rule.
3. `B` remains the captured target-branch tip OID, and the closing report
   records local `A` and `B`.
4. Missing, invalid, ambiguous, or unverifiable anchor evidence cannot produce
   a terminal amendment-conformance verdict or a historical exemption.
5. The original historical-content exception and every amendment-selection,
   lineage, supersession, and verdict rule remain unchanged.
6. No new artifact field, receipt, registry, runtime behavior, relation edge,
   or deterministic corpus mechanism is introduced.
7. The generated consumer projections never require a Grove repository commit
   to be an ancestor of consumer history.
8. Consumer activation is two-step: the rule-bearing stamp lands first, and a
   separate behavioral-spec amendment is reviewed only against a target tip
   descended from that landing.
9. The selected policy defines zero, one, and multiple present carriers;
   same-version and divergent-version valid carriers; and later
   added/downgraded/invalid carriers without host-dependent conformance.

## Open questions

None.

## Self-check

The draft depends only on approved decisions, corrects one concrete
cross-repository contradiction, preserves the approved selector, and reuses
an existing consumer-authoritative carrier. It does not broaden relation
grammar, runtime state, or historical migration. The maintainer selected
two-step activation, closing the activation-order question: no change request
derives authority from its own unmerged stamp. The first independent adversary
found the legitimate multi-carrier state was underspecified and the old
decision's operative pointer premature. The pointer is now provisional. The
maintainer selected the complete repository-wide carrier policy over per-host
activation, closing the remaining question. Required sections are present,
dependencies are approved, the acceptance criteria cover every carrier state,
and the append-only pointer remains non-operative until approval. A focused
re-review found one transition-wording contradiction; suspension now depends
on the resulting invalid/non-bearing state rather than addition, removal,
upgrade, or downgrade itself. The final independent review at `98588bc`
returned SOUND, and the maintainer ratified that exact reviewed commit.
