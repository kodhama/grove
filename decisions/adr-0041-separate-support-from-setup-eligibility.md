---
id: adr-0041-separate-support-from-setup-eligibility
type: adr
status: draft
depends_on: [adr-0031-multi-host-distribution, adr-0035-plugin-and-consumer-boundary, adr-0039-dogfood-implementation-planner, adr-0040-receive-stewards-adoption-posture-strategy, stewards/kodhama-0021-separate-adoption-posture-from-support]
informed_by: [discovery-surface-support-and-setup-eligibility]
owner: agent
updated: 2026-07-26
---

# ADR-0041: separate support from setup eligibility

## Decision state

### Decided

- **Maintainer, 2026-07-26:** shape a minimal Grove-owned path that can install
  the implementation planner for Grove dogfood on Claude and Codex without
  making a support claim.
- **Maintainer, 2026-07-26:** audit the current `candidate` / `unsupported`
  model for simplification rather than merely adding a one-off bypass.
- **Maintainer, 2026-07-26:** select the independent-state architecture:
  replace `release_state` with a support-only state, retire `candidate` as a
  durable surface value, and add an exact-surface setup-eligibility state.
- The initial Grove behavior will make only `claude-interactive` and
  `codex-exec-non-ephemeral` setup-eligible; every other declared surface
  remains setup-ineligible.
- Stewards decision 0021 remains authoritative for adoption-posture language;
  this decision will not turn dogfood, preview, or supported into a Grove
  posture registry.

### Open

- Whether the state names and invariants are collective plugin grammar owned
  by Stewards, leaving this ADR to receive them and decide Grove's row values
  and lifecycle behavior.
- Whether the no-promise support value should remain `unsupported` or use a
  less ambiguous name.
- Whether normal plan disclosure plus exact-action confirmation is sufficient,
  or non-supported setup needs a separate acknowledgement.
- Which lifecycle operations should be available on a technically loadable but
  non-supported surface.

### Parked

- Promoting any host surface to supported.
- Qualifying Claude support before the maintainer can test Claude again.
- The planner token experiment in issue #143.
- Family rollout beyond Grove's already-approved planner dogfood.

## Context

Grove has approved dogfood use of its implementation planner, but the official
setup workflow cannot compose the required project surfaces. The lifecycle
runtime rejects setup, refresh, and set-profile whenever `release_state` is
not `supported`; the current matrix contains no supported rows.

That behavior preserved honest support claims, but Stewards decision 0021 now
makes the missing distinction explicit: a host-valid package may be used for
disclosed dogfood or preview before it carries a support promise. The current
matrix already distinguishes technical loading facts (`host-native`,
`bridge-viable`, partial, unknown) from support evidence, so making
`release_state` the write-authorization gate couples two different concerns.
Technical state alone is not enough to authorize setup: all five Claude rows
are host-native and name a load path, while this first dogfood step targets
only Claude interactive.

The accompanying discovery records the verified source evidence and compares
three models. Its advisory recommendation is to make support and setup
eligibility independent authored facts and retire `candidate` as a durable
surface state.

## Selected architecture

The selected architecture is:

1. Keep support an exact-host, exact-surface, evidence-backed public claim.
2. Replace `release_state` with a support-only state and add one independent
   exact-surface setup-eligibility state.
3. Do not persist adoption posture in the surface matrix.
4. Permit bounded lifecycle writes only where the exact row is setup-eligible
   and declares a complete host-native or bridge-viable load mechanism and a
   load path.
5. Disclose the missing support claim before the user confirms exact actions.
6. Continue to fail closed for unknown, documentation-only, and partial load
   mechanisms.

The ownership, naming, confirmation, and operation-scope questions remain open
before this decision can converge.

## Rejected options

- **Special-case `candidate` for dogfood.** Rejected by the maintainer on
  2026-07-26: it would retain the support/setup coupling and would not cover
  host-native-but-not-supported Claude interactive.
- **Derive setup eligibility only from bridge state and load path.** Rejected:
  all five Claude rows are host-native and name load paths, so derivation would
  over-authorize surfaces beyond the bounded first dogfood step.

## Consequences

To be completed during shaping.

## Acceptance criteria

To be completed during shaping.

## Open questions

The live questions are maintained in `## Decision state`.

## Lifecycle record

This canvas opened after the official setup workflow demonstrated that neither
the candidate Codex row nor the host-native-but-unsupported Claude row could
plan any write. It is intentionally decision-only; no runtime, metadata,
generated output, or support claim changes in this shaping PR.
