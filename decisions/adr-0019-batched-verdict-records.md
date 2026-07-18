---
id: adr-0019-batched-verdict-records
type: adr
status: gated  # self-checked (shaper Method); `approved` is the maintainer's intent act, never the shaper's
depends_on: [adr-0012-methodology-delivery-machinery, adr-0015-reviewer-machine-boundary, adr-0017-dispatcher-posts-records-self-adoption]
owner: agent
updated: 2026-07-18
---

# ADR-0019: batched verdict records — a comment may carry several

## Context

Dogfooding grove's own review-bookkeeping on a real multi-file PR (grove#76,
surfaced completing PR #75 — the adr-0018 implementation) measured a friction
the earlier verbosity concern predicted: the check owes one `grove-verdict`
record **per reviewed file**, and `spec-0002` §A.1 makes **a comment with
more than one block wholly inert** (`lib/records.mjs:71`), so the
`record-verdict` skill must post **one comment per record**. PR #75 touched
~15–20 files across two review rounds → **~15–20 record-comments**. Every
consumer on a normal multi-file PR then faces either a **wall of red
`never-reviewed` checks** (no records) or a **wall of ~20 bookkeeping
comments** (records posted) — a real adoption tax and a poor first
impression, for a check whose green is explicitly *"bookkeeping, not
approval."* This is an `inv-self-improvement` finding: the friction is named
so it does not recur.

**Root cause is a packaging cap, not the record model.** The cost is
`O(files × review-types)` comments, and it comes from the **"one comment = one
record"** rule — which `spec-0002` §A.1 itself flags as a *"concretization,
flagged"* (a simplification tied to `adr-0012`'s "one act" prose), not a
load-bearing invariant. The **per-file records** are load-bearing and must
stay: they are exactly what gives **surgical freshness** — a code-only
follow-up commit reds only the code pairs and never a fresh decision verdict
(`spec-0002` §A.3 per-owed-pair-path basis, INV3; the property the Wave-C
amendment established).

**Why the obvious collapse (grove#76's first-cut direction) does not work.**
"Put all a review's files in one record's `subject` + `manifest_hashes`"
fails the trust model: `manifest_hashes` is **non-authoritative** (§A.2:
*"Used only to name stale reasons (§D); never for the verdict — the check
recomputes everything"*). The authoritative freshness value is the single
**`fingerprint`**, which `match.mjs:208` verifies **per owed-pair file**
(`groveFp1(basis) === r.fingerprint`, `basis = [f]` / `[f, …U(f)]`). One
record's one fingerprint is fresh-verifiable for **exactly one file** — a
multi-file single-fingerprint record is the INV3 fail-open the Wave-C
amendment closed. So the per-file record stays; only its **comment
packaging** changes.

## Decision

**A comment may carry several verdict records; the check reads each block as
its own record. `record-verdict` batches a review's records into one
comment.**

1. **Multi-block comments are admissible.** Reverse the §A.1 concretization:
   the check reads **every well-formed `grove-verdict` block** in a comment
   as its own record, admitted / selected / freshness-verified independently
   on its own `subject` + `fingerprint`. The per-file record model,
   the single-fingerprint-per-record freshness model, and the §C.0 trust
   boundary are **unchanged** — only the "one record per comment" cap is
   lifted.
2. **Malformed blocks are isolated, not contagious.** A block that fails §A.2
   recognition is **inert on its own** (fail-closed — it satisfies nothing);
   its **well-formed siblings in the same comment remain records**. (A
   per-*comment* poison rule would let one typo **silently un-record N good
   reviews** — a false-RED that erases genuine bookkeeping; per-block
   isolation keeps each well-formed record earning its own green, and each
   still independently clears freshness and admissibility.) The
   **`>1 block ⇒ whole comment inert`** rejection is removed.
3. **`record-verdict` posts one comment per review.** The skill batches all
   of a review's per-file `grove-verdict` blocks into **one** comment —
   `O(review-types)` comments (2 for a conformance + code-review round)
   instead of `O(files × review-types)`. Presentation stays human-readable
   (a summary line naming the review, verdict, and file count; blocks
   folded); §A.1's prose-around-blocks allowance is unchanged.
4. **Selection gains a deterministic within-comment tiebreak.** The
   latest-covering rule stays *"for each owed pair `(f, R)`, the latest
   admissible record for `R` whose `S` contains `f`, by comment creation
   order"*; when two records for the same `(f, R)` share a comment, ties
   break by **block index** within the comment. (The emitter's
   one-block-per-file fan-out makes an intra-comment `(f,R)` collision rare,
   but the order is pinned, not left to chance.)
5. **Edit-rejection stays whole-comment (§A.4), disclosed coarser.** An edit
   to a batched comment rejects **all** its records at once — fail-closed and
   correct: records are never legitimately edited, and a correction or
   re-review is always a **new** comment (append-only). Poster/edit
   admissibility is per-comment and applies uniformly to every block in it;
   no admissibility weakening.

**Preserved unchanged:** per-file records and surgical invalidation (§A.3 /
INV3); the single-fingerprint-per-record freshness model (`match.mjs`
per-owed-pair-file); the §C.0 trust boundary (the check recomputes
everything, trusts no emitted value — `manifest_hashes` stays reason-naming
only); §A.4 poster admissibility; append-only and the latest-covering
selection. **`adr-0012`'s "one act" is preserved at the record level:** each
`grove-verdict` block is still whole — verdict + subject + fingerprint +
findings together — never split across channels; batching groups whole
records, it never fragments one.

## Considered and rejected

- **Whole-`S` single record** (grove#76's first-cut). Rejected: `manifest_hashes`
  is non-authoritative and the single `fingerprint` is per-file-basis, so a
  multi-file record is fresh-verifiable for only one file — the INV3
  fail-open the Wave-C amendment closed. Re-modeling the fingerprint over
  whole-`S` would additionally **coarsen invalidation** (one file's edit reds
  every file the record covered, losing surgical per-file freshness) —
  reopening a settled question for a strictly worse trade.
- **Live with the wall.** Rejected — the ~20-comments-per-PR tax and the
  bad first impression are exactly the `inv-self-improvement` friction
  grove#76 names; the do-nothing this decision replaces.
- **Edit records into one running comment.** Rejected — §A.4 rejects any
  edited record comment; in-place update is impossible, and append-only is
  load-bearing (a FAIL silently becoming a PASS must stay impossible — S14).
- **Post records off the comment stream** (check-run annotations, a gist, a
  commit status). Rejected — the comment stream is the carrier the check
  reads and where §A.4's platform-attested edit/poster integrity lives;
  leaving it is a far larger change than lifting a packaging cap, for no
  gain here.

## Relationship to `spec-0002`, `adr-0012`, `adr-0017`

- **Amends `spec-0002` §A.1 *and* INV9** — a **testable-clause** change
  (§A.1's multi-block concretization + S7 re-cast; **INV9's "or a multi-block
  comment ⇒ inert" clause removed** — an unparseable *block* stays inert, a
  multi-block *comment* is now several records; the §A.1 selection rule *and*
  INV9's "select … from the platform's comment order" clause gain the
  block-index tiebreak) → a version bump and a test-deps re-pin. This
  **supersedes the "one comment = one record" concretization**; it does not
  touch the record's §A.2 schema, the §A.3 basis, or the §C trust model.
  (INV9 lives in `### Invariants (EARS)`, a different section from §A.1 —
  named explicitly so the amendment cannot leave a standing invariant
  forbidding what §A.1 now permits; surfaced by the decision-adversary,
  round 1.)
- **`adr-0012`'s "one act"** — preserved and clarified: "one act" binds the
  **record's atomicity** (all fields in one block, one channel), never a
  one-record-per-comment cap. A forward pointer records the clarification.
- **Refines `adr-0017`'s `record-verdict`** — one-comment-per-record →
  one-comment-per-review (batched). A forward pointer on `adr-0017`.

## Consequences (execution — after approval)

1. **`spec-0002` amendment** (contract-author) — every clause that today
   declares a multi-block *comment* inert moves together, so no standing
   clause is left forbidding what another now permits:
   - **§A.1** — multi-block admissible (each block a record; malformed block
     inert on its own, not contagious); the selection rule gains the
     within-comment block-index tiebreak.
   - **INV9** (`### Invariants (EARS)`, line ~1058) — its "including … a
     multi-block comment" inert clause is **removed** (an absent/unknown-
     `schema` or otherwise unparseable **block** stays inert); its "select …
     from the platform's comment order" clause gains the block-index tiebreak.
   - **S7** re-cast (a multi-block comment is no longer the inert case; a
     malformed *block* is); the **§D `never-reviewed` note** (line ~935)
     drops "multi-block comment" as an inert cause (a malformed block stays
     one).
   Version bump; `plugins/grove/check/test-deps.md` re-pin.
2. **`lib/records.mjs`** (executor, test-first): remove the
   `blocks.length > 1 ⇒ inert` rejection (`:71`); emit one record per
   well-formed block; a malformed block is inert without poisoning siblings.
3. **`lib/match.mjs` / selection** (executor): the within-comment
   block-index tiebreak in the latest-covering ordering.
4. **`record-verdict` skill**: batch a review's records into one comment;
   §3's "one comment per record / multi-block inert" text is replaced.
5. **Forward pointers** on `adr-0017` (batched) and `adr-0012` ("one act" =
   record atomicity).
6. **The next grove PR re-measures** the comment count (≈2 vs ~20) — the
   empirical confirmation and the verbosity read.

## Acceptance criteria

- **AC1** The check admits a comment with several `grove-verdict` blocks,
  reading each as its own record (independent admissibility / selection /
  freshness on its own subject + fingerprint); a malformed block is inert on
  its own and never inerts a well-formed sibling; and **no standing clause
  (§A.1, INV9, S7, §D) still declares a multi-block comment inert**.
- **AC2** `record-verdict` posts one comment per review carrying all that
  review's per-file records; total comments are `O(review-types)`, not
  `O(files × review-types)`.
- **AC3** Selection is deterministic for batched records: latest-covering per
  `(f, R)` by comment order, tie-broken by block index within a comment.
- **AC4** Preserved and test-covered: per-file freshness (a code-only edit
  stales only code pairs, not a fresh decision record); single-fingerprint
  per-record verification; §C.0 recompute-everything; §A.4 poster/edit
  admissibility (whole-comment edit rejects all its records).
- **AC5** `spec-0002` version bumped; the ledger pin re-pinned; `adr-0017`
  and `adr-0012` carry forward pointers; the `record-verdict` skill no longer
  instructs one-comment-per-record.

## Open questions (parked, ≤3)

- **Presentation shape** — one `<details>` per block vs. one wrapper listing
  all blocks with a per-review summary. A skill/UX detail; the next PR's
  verbosity read decides it. Not blocking.
- **A future per-review cap** — if a single review legitimately covers dozens
  of files, one comment could still be large; whether to page very large
  reviews across comments is a later refinement, not this decision (it
  composes — several comments, each multi-block, already work under this
  rule).

## Self-check (rubric)

Self-checked to `gated` 2026-07-18. **Problem stated from a measured
failure** (grove#76 / PR #75: ~20 record-comments), root-caused against the
code and the spec: the cost is the `records.mjs:71` multi-block rejection +
the §A.1 "one comment = one record" concretization, **not** the per-file
record model. The decision is **minimal-first**: it lifts exactly that cap
and leaves the fingerprint model, the per-file basis (INV3 surgical
freshness), the §C.0 trust boundary, and §A.4 admissibility untouched — each
named as preserved. The tempting collapse (whole-`S` record) is rejected on
the **verified** trust fact that `manifest_hashes` is non-authoritative and
the single `fingerprint` is per-file-basis (`§A.2` line 413; `match.mjs:208`)
— so it would either fail-open (the closed INV3 trap) or coarsen invalidation.
The one safety-relevant sub-question — does a malformed block poison its
comment — is **decided in-line** (per-block isolation, fail-closed) rather
than parked, because per-comment poisoning would silently un-record good
reviews. "One act" (`adr-0012`) is preserved at the block level and the
clarification recorded, so no silent divergence from an approved decision.
`depends_on` is genuine coupling — `adr-0012` (the record/one-act model this
refines), `adr-0015` (the per-file fingerprint model whose granularity is the
load-bearing rationale), `adr-0017` (the `record-verdict` skill this refines);
all `approved`, no draft consumed. Execution (the §A.1 amendment, the
`records.mjs`/`match.mjs` changes, the skill, the forward pointers) is scoped
downstream, not performed here.

**Decision-adversary round 1 (2026-07-18): NEEDS-REVISION → applied.** All
four axes passed except one fixable coherence gap: the amendment scope named
§A.1 / S7 / §D but **omitted INV9** (in the `### Invariants (EARS)` section),
which normatively lists "a multi-block comment" among its inert causes and
carries the platform-order selection clause — so as first scoped, the
amendment would have left a standing invariant forbidding what the new §A.1
permits (the same INV-vs-prose class the Wave-C `adr-0015` amendment caught
with INV3). Fixed: Consequence 1 now moves **§A.1 + INV9 + S7 + §D
together**, the Relationship section names INV9 explicitly, and AC1 requires
that no standing clause still declares a multi-block comment inert. The
adversary confirmed the load-bearing claims sound against the code — the
`records.mjs:71` gate is pure packaging (contributes no safety property; each
block still independently clears freshness/§A.4/separation/non-vacuity, so no
false-green opens), `manifest_hashes` is genuinely non-authoritative (§A.2
line 413; `match.mjs` uses it only in `attributeStaleness`), selection is
total (comment-id-major, block-index-minor), and no contradiction with
`adr-0012`/`adr-0017`. A minor wording note (per-comment poisoning is a
false-RED, not "the opposite of fail-closed") was applied to Decision point 2.
A round-2 pass scoped to the INV9 addition precedes the human gate.

**Decision-adversary round 2 (2026-07-18, scoped to the INV9 revision):
SOUND.** The adversary swept the spec for every clause declaring a
multi-block comment inert and found **exactly four** — §A.1, INV9, S7, and
the §D `never-reviewed` note — **all four now named** in Consequence 1 and
AC1; no other normative clause forbids it (the remaining "one-record-per-
comment" mentions are provenance/meta-text pointing at §A.1). INV9's other
guarantees (full-pagination, the absent/unknown-`schema` inert case,
session-context-never-counts, no-mutation/append-only) are confirmed
untouched by the scoped amendment. The point-2 wording fix reads accurately
(false-RED, not fail-closed) and per-block isolation stays fail-closed
against false-GREEN. No round-1 regression. Ready for the human intent gate.

**Not claiming adversary validation** — the decision-adversary pass precedes
the human gate; the `approved` intent act is the maintainer's
(`gated → approved` flip), never the shaper's.
