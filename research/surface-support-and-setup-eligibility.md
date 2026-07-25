---
id: discovery-surface-support-and-setup-eligibility
type: discovery
status: draft
depends_on: []
informed_by: [adr-0031-multi-host-distribution, adr-0039-dogfood-implementation-planner, adr-0040-receive-stewards-adoption-posture-strategy]
owner: agent
updated: 2026-07-26
---

# Discovery: surface support and setup eligibility

## Question

Can Grove install its planner for disclosed dogfood on Claude and Codex
without claiming support, and do the current `candidate` / `unsupported`
surface states model that distinction cleanly?

## Findings

1. **[verified] `release_state` currently determines both the support claim
   and lifecycle write authorization.** The specification defines `supported`
   and `unsupported` as role-loading claims, but its operation table permits
   setup, refresh, and set-profile writes only for `supported` rows
   ([spec](../specs/0004-dual-host-distribution.md#surface-classification-and-write-permissions)).
   The runtime implements that coupling with one check:
   `row.release_state !== 'supported'` rejects every non-remove operation
   ([runtime](../plugins/grove/runtime/lifecycle/lib/lifecycle.mjs#L516-L553)).

2. **[verified] No row in the current surface matrix is `supported`.** Claude
   rows are `unsupported`; `codex-exec-non-ephemeral` is `candidate`; all
   other Codex rows are `unsupported`
   ([matrix](../plugins/grove/metadata/surfaces.json)). Therefore the shipped
   lifecycle cannot currently plan setup, refresh, or set-profile for any
   declared surface.

3. **[verified] `candidate` is a pre-release qualification transition, not an
   independent installation or support dimension.** Repository history shows
   the Codex row moving from candidate to supported after exact evidence, then
   back to candidate when a package-boundary change invalidated the old
   snapshot
   ([0.3.0 release matrix](https://github.com/kodhama/grove/blob/grove-v0.3.0/plugins/grove/surfaces.json),
   [package-boundary change](https://github.com/kodhama/grove/commit/ef49107)).
   The release validator accepts the value only for incomplete validation and
   rejects it for a release
   ([validator](../tooling/grove/release/lib/release.mjs#L33-L96)). The
   specification likewise says every row must resolve to `supported` or
   `unsupported` before release
   ([spec](../specs/0004-dual-host-distribution.md#L951-L969)).

4. **[verified] The matrix already records technical load readiness
   separately from support.** `claude-interactive` has a `host-native` bridge
   state and an established load path while remaining unsupported.
   `codex-exec-non-ephemeral` has a `bridge-viable` state and an explicit load
   path while remaining a candidate. Unknown and partial Codex rows have no
   complete load path
   ([matrix](../plugins/grove/metadata/surfaces.json)).

5. **[verified] The collective policy permits host-valid packages to be
   distributed for disclosed dogfood or preview before support.** It defines
   adoption posture separately from support, forbids treating those postures
   as machine-enforced surface states, and parks Grove's exact lifecycle
   behavior for a Grove-owned decision
   ([Stewards decision 0021](https://github.com/kodhama/stewards/blob/main/decisions/0021-separate-adoption-posture-from-support.md)).

6. **[verified] `candidate` is missing from the specification's exhaustive
   lifecycle classification.** The contract says every invocation is exactly
   `supported`, `valid-unsupported`, or `invalid`, while
   `valid-unsupported` is specifically a row whose release state is
   `unsupported`
   ([spec](../specs/0004-dual-host-distribution.md#L143-L154),
   [write table](../specs/0004-dual-host-distribution.md#surface-classification-and-write-permissions)).
   A known candidate row fits none of those named classes even though the
   runtime treats it as a valid non-supported refusal.

7. **[inferred] `candidate` need not remain a durable surface state once
   technical readiness, setup eligibility, and support are independent.** Its
   useful evidence-progress history can remain in probe/support records; the
   bridge fact it currently adds to the matrix is already expressed by
   `bridge_state: bridge-viable`.

8. **[inferred] `unsupported` is doing two jobs in user-facing language.** It
   honestly means “no support promise,” but is easily read as “cannot be
   installed or used.” The Claude interactive row demonstrates that these are
   not equivalent: it has a host-native package and established load path but
   no complete support record.

## Options

### A. Add a dogfood exception to `candidate`

Permit setup only when `release_state: candidate` and the user explicitly
accepts the disclosure.

- Small code change.
- Does not help Claude, whose technically loadable interactive row is
  `unsupported`.
- Keeps a pre-release transition responsible for installation authorization.

### B. Separate support from technical setup eligibility

Keep one support dimension (`supported` or no support claim), use the existing
exact-surface load/bridge facts to determine whether lifecycle composition is
technically available, and show the non-support disclosure in the normal
plan-confirm-apply flow.

- Matches Stewards 0021 without creating a posture registry.
- Can cover both host-native Claude and bridge-viable Codex.
- Continues to fail closed for unknown, documentation-only, and
  partial-primitive load states.
- Risks over-authorizing Claude: every declared Claude row is `host-native`
  and has a load path, while Grove currently intends to dogfood only the
  interactive surface.
- Requires a specification and lifecycle change rather than one exception.

### C. Add an independent authored setup-eligibility state

Use `support_state: supported | not-supported`, retire `candidate`, and add a
per-row `setup_state: available | unavailable`. Technical `bridge_state`
continues to describe how loading works; `setup_state` says whether Grove is
willing to compose and maintain that exact surface.

- Makes authorization explicit and avoids deriving it from technical fields.
- Qualifies only the two intended initial rows without a hidden surface-id
  special case.
- Adds one field that must be validated against `bridge_state` and
  `load_path`, but does not add an adoption-posture registry.

## Advisory conclusion

**[inferred] Option C is the smallest coherent model.** It removes an
accidental dependency between a public support promise and a technically safe,
explicitly confirmed repository composition operation without inferring setup
permission for every host-native Claude surface. It also avoids turning
`dogfood` into machine state.

A minimal form would:

- replace `release_state` with `support_state`;
- retire `candidate`, leaving `supported | not-supported` (or another
  no-promise label chosen during shaping);
- add `setup_state: available | unavailable` and permit setup/refresh/
  set-profile only for an exact `available` row whose declared load mechanism
  and load path pass validation;
- retain the non-support disclosure in every plan summary;
- preserve exact-action confirmation, bounded writes, collision refusal, and
  remove-on-any-known-surface behavior; and
- leave every unknown, documentation-only, or partial primitive fail-closed.

## Research-quality self-check

`RESEARCH_RUBRIC_PATH` is explicitly configured as `none exists yet`, so no
repository rubric can be run. Every load-bearing finding above is tagged and
linked to a primary source. The advisory conclusion is marked as inference,
not a decision.
