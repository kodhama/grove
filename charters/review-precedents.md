---
id: charter-review-precedents
type: charter
status: gated
implements: adr-0023-review-triage-blackboard  # D7 — the precedent log; the case-law corpus the auditor's judgment layer consumes
depends_on: [adr-0023-review-triage-blackboard]
owner: human
updated: 2026-07-19
---

# review-precedents — the owed-review case-law log (adr-0023 D7)

> **Dormant — the adr-0023 lineage is suspended by
> `adr-0027-retire-ci-for-now` (2026-07-21).** With the check and the
> auditor retired-for-now, no machinery consumes this log; it is kept
> (append-only case law survives suspension) and resumes with adr-0027
> D4's revival.

> Provenance: `adr-0023` D7 — one append-only file recording each
> maintainer overrule of an owed-review outcome. This is the precedent
> corpus the review-triage judgment layer (the in-session auditor, and
> any future shared evaluator) consumes, single-homed so dispatch-time
> and CI-time judgment learn from the same case law (grove#97
> shared-evaluator addendum). Like `review-policy.md`, it is not an
> agent role: no pipeline stage, never dispatched.
>
> D7 named `reference/review-precedents.md` with the home to be
> confirmed at spec time; no root `reference/` exists and the vendored
> payload dir holds only vendored copies, so the companion convention
> (`charters/`) is the interim home — `spec-0003` confirms or moves it
> (discovery recorded on `adr-0023` Consequences item 0).

## Rules

- **Append-only.** Entries are never edited or deleted; a correction is
  a new entry citing the old one.
- **One entry per overrule**: whenever the maintainer overrides what the
  owed-review machinery (table, hint, or — later — audit) concluded, or
  makes a glance-judgment call the machinery could not make, the call
  and its *why* land here.
- **Entries are precedent, not policy.** Policy stays in
  `review-policy.md` (human-owned, adr-0012 AC8); this file records the
  judgments that may later crystallize into policy.
- Entry format: date — subject — what the machinery said — what the
  maintainer ruled — why (the transferable rule).

## Entries

- **2026-07-16 — `CONTRIBUTING.md` — allowlist eligibility.** Machinery:
  README-class prose, allowlist-eligible on shape. Ruling: deliberately
  NOT allowlisted — it declares (in prose) that it implements
  `spec-0001`, so it is a spec-implementing artifact, not orientation;
  its honest state is the fail-closed red until it carries a frontmatter
  `implements:`. Transferable rule: *a prose file that claims an
  upstream is never "orientation," whatever its shape* (recorded in
  `review-policy.md:71-75`; conformance finding, 2026-07-16).

- **2026-07-19 — vendored `reference/**` copies — allowlist vs
  copy-sync.** Machinery (adr-0022 D1 hint): the prose-extension
  vendored copies are allowlist-eligible and draw the hint. Ruling:
  whether a *vendored copy* should be allowlisted at all — versus fixed
  by copy-sync conformance — is a per-file human call routed to
  grove#40, not a hint-following act. Transferable rule: *derivation
  provenance beats surface shape — a copy's review posture follows its
  canonical source, not its own file class* (adr-0022 D5, as amended
  post-adversary).
