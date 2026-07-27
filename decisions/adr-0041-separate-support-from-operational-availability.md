---
id: adr-0041-separate-support-from-operational-availability
type: adr
status: approved  # maintainer's explicit intent act in conversation, 2026-07-26: "Ratified"
depends_on: [adr-0031-multi-host-distribution, adr-0035-plugin-and-consumer-boundary, adr-0039-dogfood-implementation-planner, adr-0042-receive-stewards-surface-state-strategy, stewards/kodhama-0023-separate-operational-availability-from-support]
informed_by: [discovery-surface-support-and-setup-eligibility]
owner: agent
updated: 2026-07-26
---

# ADR-0041: separate support from operational availability

> **Implementation pointer.** AC2 and AC5-AC9 are implemented by PR #158. AC1
> (retire `release_state`) and AC3 (`candidate` never blocks a release) are
> deferred to the ceremony sweep and tracked at
> https://github.com/kodhama/grove/issues/159 — recorded here so the deferral
> is a pointer rather than prose.

## Decision state

### Decided

- **Maintainer, 2026-07-26:** shape a minimal Grove-owned path that can install
  the implementation planner for Grove dogfood on Claude and Codex without
  making a support claim.
- **Maintainer, 2026-07-26:** audit the current `candidate` / `unsupported`
  model for simplification rather than merely adding a one-off bypass.
- **Maintainer, 2026-07-26:** select the independent-state architecture:
  retire `release_state` and `candidate` as durable surface values and record
  operational availability independently from a support claim.
- **Stewards decision 0023:** every exact surface row uses
  `availability_state: available | unavailable` and
  `support_claim: claimed | none`; the shared authority owns those names,
  values, and combination invariants.
- Grove initially assigns `available + none` only to `claude-interactive` and
  `codex-exec-non-ephemeral`. Every other declared row receives
  `unavailable + none`.
- A release may carry any valid shared combination. A support record is
  required only for `support_claim: claimed`; neither `available` nor package
  release implies support.
- Adoption posture remains outside the surface matrix.
- **Maintainer, 2026-07-26:** `available + none` authorizes setup, refresh, and
  set-profile. Remove retains its existing cleanup behavior for every known
  surface.
- The existing plan → disclose → confirm-exact-action-ids → apply flow is the
  acknowledgement. The plan must lead with the missing-support disclosure;
  Grove adds no second acknowledgement or request-level posture flag.

### Open

*(none)*

### Parked

- Promoting any host surface to supported.
- Qualifying Claude support before the maintainer can test Claude again.
- The planner token experiment in issue #143.
- Product metadata migrations in Trellis, Wisp, and the Kodhama plugin.

## Context

Grove has approved dogfood use of its implementation planner, but the official
setup workflow cannot compose the required project surfaces. The lifecycle
runtime rejects setup, refresh, and set-profile whenever `release_state` is
not `supported`; the current matrix contains no supported rows.

That behavior preserved honest support claims, but Stewards decisions 0021
and 0023 now make the missing distinctions explicit. Distribution and
adoption posture do not imply support, and every exact surface records
operational availability separately from its support claim.

Grove has received the shared strategy through ADR-0042. This decision owns
only Grove's row assignments, lifecycle behavior, release-validator migration,
disclosures, and tests. Technical state alone is not enough to assign
availability: all five Claude rows are host-native and name a load path, while
this first dogfood step targets only Claude interactive.

The accompanying discovery records the verified source evidence and compares
the pre-Stewards alternatives. Decision 0023 has since settled the shared
field grammar; its facts and local model analysis remain informative.

## Selected architecture

The selected architecture is:

1. Use the two shared fields on every row and remove `release_state`.
2. Keep support an exact-host, exact-surface, evidence-backed public claim.
3. Do not persist adoption posture in the surface matrix.
4. Assign `available + none` only to Claude interactive and non-ephemeral
   Codex exec in this first dogfood step.
5. Require an `available` row to retain its complete host-native or
   bridge-viable load mechanism and load path; contradictory metadata fails
   validation.
6. On an `available` row, permit setup, refresh, and set-profile through the
   existing disclosed-plan and exact-action confirmation flow.
7. Lead every `support_claim: none` plan with the non-support disclosure; do
   not add a second acknowledgement or adoption-posture input.
8. Except for the confirmation-bound Remove cleanup path below, continue to
   fail closed for every `unavailable` row and for unknown,
   documentation-only, or partial load mechanisms.

Remove remains available for confirmation-bound cleanup on every known
surface, preserving the existing escape path.

## Rejected options

- **Special-case `candidate` for dogfood.** Rejected by the maintainer on
  2026-07-26: it would retain the support/setup coupling and would not cover
  host-native-but-not-supported Claude interactive.
- **Derive setup eligibility only from bridge state and load path.** Rejected:
  all five Claude rows are host-native and name load paths, so derivation would
  over-authorize surfaces beyond the bounded first dogfood step.
- **Keep Grove-only field names.** Rejected after Stewards decision 0023:
  active plugins use the shared field grammar while retaining product-owned
  values and behavior.
- **Require a second non-support acknowledgement.** Rejected by the maintainer:
  the existing flow already discloses the plan and requires confirmation of
  every exact action; another flag adds ceremony without distinct authority.
- **Permit setup but block refresh and set-profile.** Rejected by the
  maintainer: an operationally available dogfood installation must remain
  maintainable without first manufacturing a support claim.

## Consequences

- The lifecycle can compose the planner for honest dogfood without manufacturing
  a support claim.
- Grove's release validator stops treating incomplete qualification as a
  durable support state.
- Existing support evidence remains exact-snapshot and product-owned.
- Before implementation, `spec-0004-dual-host-distribution` is revised in
  place, version-bumped, gated, and independently reviewed to replace its
  `release_state` grammar and supported-only operation table.
- Metadata, runtime, generated documentation, and focused tests then implement
  that revised contract after this decision is ratified.

## Acceptance criteria

1. Every Grove exact surface row uses the two shared fields and no
   `release_state`.
2. Only Claude interactive and non-ephemeral Codex exec initially use
   `available + none`; all other rows use `unavailable + none`.
3. `candidate` remains available only in transient qualification/evidence
   terminology and never authorizes lifecycle writes or blocks a release.
4. `support_claim: claimed` requires Grove's existing exact-surface support
   record; `none` makes no support claim.
5. Setup, refresh, and set-profile require
   `availability_state: available`, a host-valid load mechanism, and a load
   path; unavailable or contradictory rows fail before mutation.
6. `available` permits setup, refresh, and set-profile; `unavailable` permits
   none of those three writes. As the explicit cleanup exception, Remove
   retains its confirmation-bound behavior for any known row regardless of
   availability.
7. Every `support_claim: none` plan leads with the non-support disclosure, and
   the existing exact-action confirmation is sufficient without another
   acknowledgement or posture input.
8. Adoption posture, support promotion, and the planner experiment remain
   unchanged.
9. Before implementation, Spec 0004 replaces its `release_state` model and
   supported-only operation table with this decision's grammar and behavior,
   receives a version bump, and passes its independent spec gate.

## Open questions

None.

## Self-check

All dependencies are approved. Shared field names, values, and combination
invariants come from Stewards decision 0023; Grove supplies only product row
assignments and lifecycle behavior. The selected rows have declared complete
load paths, while every partial, unknown, or documentation-only row remains
unavailable. The operation table is closed, cleanup remains possible, and
support evidence, adoption posture, and experiment outcomes are neither
inferred nor weakened. No open question remains, so the author promotes the
decision from `draft` to `gated` for independent soundness review.

## Lifecycle record

This canvas opened after the official setup workflow demonstrated that neither
the candidate Codex row nor the host-native-but-unsupported Claude row could
plan any write. Shaping then moved upstream: Stewards decision 0023 established
the common fields, and ADR-0042 received that strategy locally. This canvas
then resumed as the separate Grove product decision. On 2026-07-26 the
maintainer accepted the recommended operation and confirmation policy,
closing the remaining questions. Independent deep review returned `SOUND` at
exact commit `7c23fbd`; the maintainer then ratified that commit explicitly in
conversation on 2026-07-26. It remains decision-only; no runtime, metadata,
generated output, or support claim changes in this PR.
