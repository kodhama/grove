---
id: adr-0050-receive-stewards-issue-taxonomy
type: adr
status: gated
depends_on: [kodhama/kodhama-0026-issue-taxonomy, stewards/kodhama-0022-propagate-collective-strategy]
owner: agent
updated: 2026-08-03
---

# adr-0050 — receive the Stewards issue taxonomy

## Context

Grove owns a current Kodhama plugin, so the approved
[`kodhama-0026`](https://github.com/kodhama/kodhama/blob/main/decisions/0026-issue-taxonomy.md)
issue taxonomy applies here. This receipt follows the approved
[`kodhama-0022`](https://github.com/kodhama/stewards/blob/main/decisions/0022-propagate-collective-strategy.md)
propagation decision. Both remain authoritative at their homes; this record
copies neither.

**The two upstreams sit in different repositories.** `kodhama-0026` is an
org-layer record in `kodhama/kodhama`; `kodhama-0022` is a Stewards record
whose text names *"the approved Stewards decision"* as the authority a receipt
cites. `kodhama-0026` records that gap itself and rules it non-blocking —
*"the propagation section above names its targets either way."* This receipt
takes the same position.

## Decision

Grove records receipt of the shared convention. This cross-link communicates the
upstream constraint without restating it: no dimension tables, no vocabularies,
no rationale, no README index. The vocabularies live in the plugin-carried
skill, and the org's issue types and seeded labels are what make them real.

**One clause names Grove directly.** `kodhama-0026` Decision 10: *"Grove owns the mapping from `(type, stage)` to its workflow steps. No issue is named after a grove step."* That mapping is **required local follow-up** and does not exist yet — nothing in Grove relates an issue's native type or `stage:` label to a dispatch decision.

## Consequences

The shared convention is discoverable in Grove's local decision graph without
being copied or redefined.

**The `(type, stage)` mapping is owed and unwritten.** It is a Grove product decision, not this receipt: which types are dispatchable, and at which stage, is Grove's to define. #201 is the live symptom — every open issue landed at the same, least-committed stage during migration, so the dispatch queue reads empty and no mapping exists to say whether that is right.

This receipt authorizes no schema, behavior, setup, package, release,
distribution, validation, or support change, and makes no adoption-posture
choice — `kodhama-0022` holds that *"receipt is distinct from product
adoption."*

Written under `kodhama-0026` §Propagation, which names Grove, Trellis, Wisp
and Stewards as its cross-link targets. Status is `gated`: no maintainer
rollout direction has been given for these receipts, so approval is the
maintainer's act, not this record's.
