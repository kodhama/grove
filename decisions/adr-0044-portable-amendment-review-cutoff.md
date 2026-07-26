---
id: adr-0044-portable-amendment-review-cutoff
type: adr
status: draft
depends_on: [adr-0026-thin-vendor-boundary, adr-0043-review-significant-spec-amendments]
owner: agent
updated: 2026-07-26
---

# ADR-0044: make the amendment-review cutoff portable

## Decision state

### Decided

- **Maintainer, 2026-07-26:** open a focused follow-up decision rather than
  encode a Grove-only Git ancestor into Grove's consumer-facing role
  projections.
- Preserve the approved amendment selector, accumulated active-contract
  model, historical exception, and captured target-tip review evidence from
  `adr-0043-review-significant-spec-amendments`.
- Grove itself retains its durable local anchor:
  `947d9bdc702798b960a67a9a465e61beebe44fa7`, the canonical-main landing that
  first records the amendment-review decision as approved.
- A consumer repository derives its local anchor from the existing managed
  instruction-block stamp, `grove plugin@<version>`; introduce no new field,
  receipt, registry, or runtime mutation.
- Use full artifact ids in prose and relations. The two approved
  `adr-0043-*` ids are structurally unique even though their shared numeric
  shorthand is ambiguous.

### Open

- May a consumer activate the selector and amend a behavioral spec in the
  same change request, or must the rule-bearing Grove stamp already be present
  on the target branch before that spec amendment is reviewed?

### Parked

- Renumbering either approved `adr-0043-*` decision. Full ids are unique and
  operative; rewriting approved identity to repair human shorthand needs a
  separate corpus-history decision, if it is worth doing at all.
- Adding an adoption receipt, cutoff registry, or deterministic corpus check.
  The existing managed stamp and review evidence are sufficient for the
  portability correction.

## Context

`adr-0043-review-significant-spec-amendments` defines a prospective
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

Grove already has a consumer-local, versioned, durable carrier. Setup and
refresh write exactly one `grove plugin@<version>` line inside the managed
instruction block. The version is schema-validated and identifies the
immutable Grove package whose role projections the repository adopted.
Grove-self intentionally has no such stamp because it loads the package from
its own tree.

## Proposed decision

### 1. Keep the cutoff repo-local

Each repository derives `A` from evidence committed to its own canonical
target-branch history:

- **Grove-self:** `A` is
  `947d9bdc702798b960a67a9a465e61beebe44fa7`.
- **Consumer repository:** `A` is the first commit on the canonical target
  branch whose managed Grove instruction block carries a valid
  `grove plugin@V` stamp and immutable release `V` ships the portable
  amendment-review rule.

The consumer rule uses the existing authoritative repository stamp; it does
not infer adoption from a developer's global plugin cache, current session,
wall-clock installation time, or conversation.

`B` remains the exact target-branch tip OID captured at conformance-review
start. The reviewer records both the selected local `A` and captured `B` in
the durable closing report as judgment evidence, not as new artifact
frontmatter or a persisted schema.

### 2. Preserve the original selector

When local `A` is an ancestor of `B`, the amendment selector and touched-spec
reconciliation apply exactly as approved in
`adr-0043-review-significant-spec-amendments`.

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

A consumer review cannot silently manufacture or guess `A`. An absent,
malformed, duplicated, or non-rule-bearing managed stamp, an unresolved Grove
release, or an ambiguous canonical target branch prevents terminal amendment
conformance review and routes to the existing Grove setup/refresh or shaping
path as appropriate.

The reviewer never treats “no usable local anchor” as proof that all current
content is historical.

### 4. Activation ordering

The remaining shaping choice is whether the target base must already contain
the rule-bearing stamp before a behavioral amendment change request begins
terminal review.

**Recommendation:** require the stamp to have landed first. A change request
that introduces or refreshes Grove may carry lifecycle changes, but a
behavioral spec amendment in that same request waits until the stamp is on the
canonical target branch and then receives review against a descended `B`.
This keeps `A` a real ancestor, avoids self-activation from unmerged source
content, and makes concurrent reviews deterministic.

## Rejected options

- **Use Grove's approval commit in every repository.** Impossible across
  unrelated Git histories; the ancestry test never becomes true.
- **Use the active global plugin installation.** Rejected because it is
  session-local and mutable, not repository evidence.
- **Use wall-clock setup time.** Rejected because it is not reproducible from
  the artifact or change-request record.
- **Add a new cutoff field or receipt file.** Rejected because the managed
  instruction block already commits the exact Grove version and ADR-0043
  forbids unnecessary new schema.
- **Make all existing consumer content governed immediately.** Rejected
  because it silently removes the approved historical exception and creates a
  family-wide retroactive migration.

## Consequences

- `adr-0043-review-significant-spec-amendments` receives a scoped append-only
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
   commit carrying a valid `grove plugin@V` stamp whose immutable release
   ships this rule.
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

## Open questions

1. Must the rule-bearing stamp land on the canonical target branch before a
   separate behavioral-amendment change request can be governed, or may one
   change request both introduce the stamp and self-activate the selector?

## Self-check

The draft depends only on approved decisions, corrects one concrete
cross-repository contradiction, preserves the approved selector, and reuses
an existing consumer-authoritative carrier. It does not broaden relation
grammar, runtime state, or historical migration. One activation-order choice
remains explicitly open. The decision stays `draft` until that question is
resolved and the self-check is rerun.
