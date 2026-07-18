---
id: spec-0002-review-bookkeeping-check
type: spec
status: approved  # gated → approved: the maintainer's explicit intent act ("approved. merge", 2026-07-16), bundled with adr-0012's approval on the same PR per Open Q5's sequencing; recorded in-PR by the shaper per lifecycle.md
implements: adr-0012-methodology-delivery-machinery  # the realized contract (adr-0012 implements-edge); machine-readable fidelity selector
depends_on: [adr-0012-methodology-delivery-machinery, adr-0005-tdd-and-artifact-gated-dispatch, adr-0006-operational-conformance-mechanism, adr-0013-check-scope-mode, adr-0014-install-is-invisible-and-ungated, adr-0015-reviewer-machine-boundary, adr-0019-batched-verdict-records]  # builds-on; adr-0012 retained here too so depends_on-walking machinery keeps the edge until it learns `implements`; adr-0013 added by the 2026-07-17 scope-mode amendment; adr-0014 added by the 2026-07-18 §E pre-install non-gating disclosure (genuine coupling — the disclosed limit tracks adr-0014's move-1b behavior); adr-0015 added by the 2026-07-18 §A reviewer/machine-boundary amendment (genuine coupling — §A's record-author actor and the §A.3 per-file basis both track adr-0015); adr-0019 added by the 2026-07-18 batched-verdict-records amendment (genuine coupling — §A.1 multi-block admissibility + INV9 + S7 track adr-0019's lifting of the one-comment-per-record cap)
owner: agent
updated: 2026-07-18
version: 4  # bumped 1 → 2 by the 2026-07-17 adr-0013 scope-mode amendment (INV7/INV15 amended; INV19–INV22, S21–S23 added); bumped 2 → 3 by the 2026-07-18 adr-0015 reviewer/machine-boundary amendment — a testable-clause change (INV3's freshness basis reconciled to the per-owed-pair-path form §A.3/match.mjs enforce; the whole-`S` form was fail-open for multi-path records), versioning.md's significance bar; the durable decision the bump requires is adr-0015 itself; bumped 3 → 4 by the 2026-07-18 adr-0019 batched-verdict-records amendment — a testable-clause change (§A.1 carrier/selection re-cast + INV9 + S7: the "one comment = one record" packaging cap lifted, each well-formed grove-verdict block read as its own record, malformed blocks inert per-block not per-comment, selection gains a within-comment block-index tiebreak); the durable decision the bump requires is adr-0019 itself
status_note: promoted draft → gated on the passing self-check (contract-author Method 6); re-derived twice against adr-0012 at HEAD (fifth-pass revisions, `implements:` field, split-pair findings); round-2 spec-adversary APPROVE-READY. The Q5 provisional-upstream deviation RESOLVED 2026-07-16 — adr-0012 was approved by the maintainer's intent act, and this spec's approval was bundled with it on the same PR (Q5's anticipated sequencing). Buildable now.
---

# spec-0002 — the review-bookkeeping check (Layer A)

The mechanism that makes review bookkeeping mechanical: append-only
**verdict records posted as structured PR comments**, an **owed-map
assembled at run-time from one rule**, and a deterministic **check** that
renders a read-only status view — with the **reason** anything is
un-green — and goes red on any completeness / freshness / coverage /
separation / **approved-upstream** / **graph-resolution** /
**record-integrity** gap. Implements `adr-0012` **Layer A** only. Green
is **not** authorization; a human still judges genuineness and merges.

> This spec constrains machinery, not judgment. It **recomputes** the
> values it can (fingerprints, owed-set, type, coverage, latest-record
> selection, graph resolution, record admissibility from platform
> metadata) and **trusts, disclosed**, the values it cannot (record
> genuineness, self-reported producer/reviewer tags, the `status:
> approved` field's claim of a human act, record *deletion*). The values
> it trusts are the Layer B surface (§E), named here, not pretended away.

> **Amendment (2026-07-18, `adr-0019-batched-verdict-records` — a comment
> may carry several verdict records; the "one comment = one record"
> packaging cap is lifted. A testable-clause change — §A.1 + INV9 + S7
> re-cast — so a version bump.)**
> **WHAT:** the §A.1 "a comment with **more than one** `grove-verdict`
> block is **wholly inert**" concretization is **reversed** (`adr-0019`
> Decision 1–2): a comment **may carry several** `grove-verdict` blocks
> and the check reads **each well-formed block as its own record**,
> admitted / selected / freshness-verified **independently** on its own
> `subject` + `fingerprint`; a block that fails §A.2 recognition is
> **inert on its own** and **never inerts its well-formed siblings** in
> the same comment (per-block isolation, not per-comment poison — a
> per-comment rule would let one typo silently un-record N good reviews).
> The §A.1 **selection rule** and **INV9**'s selection clause gain a
> deterministic **within-comment block-index tiebreak** (order:
> comment-id-major, block-index-minor). **INV9** loses "or a multi-block
> comment" from its inert clause (the absent/unknown-`schema` inert case
> **stays**); **S7** is re-cast so a multi-block comment is no longer the
> inert case (a **malformed block** is, its siblings surviving); the
> **§D `never-reviewed`** note drops "multi-block comment" as an inert
> cause (a malformed block stays one). `adr-0019` added to `depends_on`;
> `updated:` unchanged (already 2026-07-18).
> **WHY:** grove#76 / PR #75 measured the friction the packaging cap
> forces — the check owes one record **per reviewed file**, so under the
> old cap `record-verdict` had to post **one comment per record**
> (~15–20 comments on a normal multi-file PR): a wall of bookkeeping
> comments or a wall of red `never-reviewed` checks, an adoption tax for
> a check whose green is explicitly "bookkeeping, not approval." The cost
> is the packaging cap, **not** the per-file record model — which is
> load-bearing (surgical per-file freshness, INV3 / §A.3) and stays.
> **SCOPE:** §A.1 (the opening record bullet's "one act" framing, the
> carrier bullet, and the selection bullet), INV9, S7, and the §D
> `never-reviewed` note only — the four clauses that declared a
> multi-block comment inert, moved **together** so no standing clause
> forbids what another now permits (`adr-0019` Consequence 1;
> decision-adversary round-1 finding). **Deliberately unchanged:** the
> per-file record model and surgical invalidation (§A.3 / INV3); the §A.2
> record schema; the §A.3 fingerprint basis (single fingerprint per
> record, per owed-pair path); the §C.0 / §C trust model (the check
> recomputes everything, trusts no emitted value — `manifest_hashes`
> stays reason-naming only); §A.4 poster/edit admissibility —
> **edit-rejection stays whole-comment** (an edit to a batched comment
> rejects **all** its records, which is correct and fail-closed: records
> are never legitimately edited, a correction is always a **new**
> comment). INV9's full-pagination, session-context-never-counts, and
> no-mutation/append-only clauses are untouched, as are every other INV\*
> and S\*. The `record-verdict` skill's batching (one comment per review)
> and the `lib/records.mjs` / `lib/match.mjs` changes are `adr-0019`
> Consequence 2–4 — downstream deliverables, not this spec.
> **POINTER:** current truth is the §A / INV9 / S7 / §D body below — this
> note is provenance only, not itself an acceptance criterion.
> **VALUE:** as a consumer, a normal multi-file PR carries ~2 batched
> bookkeeping comments instead of ~20 — the check's green stops greeting
> me with a wall; as the maintainer, nothing about the record model,
> fingerprint basis, or trust boundary got softer — a malformed block is
> still fail-closed inert, only its blast radius shrank from the whole
> comment to the block.
> **CONFIDENCE:** `verified` — every delta traces to `adr-0019` Decision
> 1–5, Consequence 1, and AC1/AC3, read at HEAD this sitting; the four
> inert-clause targets are the decision's own round-2 sweep (§A.1, INV9,
> S7, §D), confirmed the exhaustive set this sitting.
> **Versioning judgment:** **version-significant per `versioning.md`**
> (behavioral spec → agent-judged significance counter): a testable
> clause changed — §A.1's carrier rule, INV9, and S7 are re-cast (an
> admissibility/selection change, in the permit direction but pinned
> deterministic by the block-index tiebreak). `version` **bumped 3 → 4**;
> the durable decision the bump requires is **`adr-0019`** itself.
> Cascade: the ledger pin `plugins/grove/check/test-deps.md`
> (`spec-0002@v3` → `@v4`) is updated in the same wave; unlike the
> adr-0015 pin bump (which owed no code change), the `lib/records.mjs`
> multi-block rejection removal and the `match.mjs` block-index tiebreak
> are the **owed code change** (`adr-0019` Consequence 2–3).
>
> **Amendment (2026-07-18, `adr-0015-reviewer-machine-boundary` — the
> reviewer/machine boundary; §A machine-stamped clarification + §A.3
> per-file basis reconciliation. A documentation/interface amendment,
> NOT a version bump.)**
> **WHAT:** §A's actor is corrected — the verdict record is
> **machine-assembled, not hand-authored**. The **reviewer** supplies
> only its CI-agnostic judgment (verdict + subject + findings +
> producer/reviewer); the check package's **record-emitter** stamps the
> machine-computed parts (`fingerprint`, `manifest_hashes`, the §A.2
> envelope) by importing the check's own basis + fingerprint code; the
> **harness** posts. §A.1 (record/carrier), §A.2 (the `fingerprint` +
> `manifest_hashes` rows), and §A.3 (the "reviewer records" closing
> paragraph) are re-actored accordingly (`adr-0015` Decision 1–3,
> Consequence 3). §A.3's basis is **reconciled to the
> per-owed-pair-path referent the check actually recomputes over**
> (`plugins/grove/check/lib/match.mjs` `evaluatePair` +
> `lib/basis.mjs` `reviewBasis`: `basis = [f]` for quality,
> `[f, ...U(f, C)]` for fidelity, per subject path `f`) — a record's
> single `fingerprint` binds a **single-path** basis; the emitter emits
> one record per reviewed path (`lib/emit.mjs`). §A.4 gains the
> `adr-0015` N2 note that whichever harness component posts must sit in
> `record_poster_allowlist`. `adr-0015` added to `depends_on`;
> `updated:` unchanged (already 2026-07-18).
> **WHY:** grove#67 — the check was ungreenable because nothing could
> emit a record it accepts: an LLM reviewer cannot compute `grove-fp-1`
> (`sha256` over blob bytes) by hand, yet §A cast it as the record's
> author. `adr-0015` moves stamping to a mechanical emitter that
> **shares the check's own code** (so stamp and freshness check agree by
> construction) and posting to the harness; the reviewer keeps only
> judgment. Separately, §A.3's whole-`S` basis prose disagreed with the
> check's per-file recomputation for a multi-subject record (adversary
> N3) — reconciled here to the one referent the code enforces.
> **SCOPE:** §A.1/§A.2/§A.3/§A.4 (actor + basis) plus the frontmatter
> `depends_on` edit only. The check's **trust model is byte-unchanged**
> (§C.0 — recompute fingerprint/`U` at HEAD, trust no recomputable
> agent value); **separation authority stays the record's
> `producer`/`reviewer` fields, not the poster** (§C.4, `adr-0012`
> AC7) — the emitter transcribes them, forgery stays the conceded §E
> Layer-B limit; **records still land on the change request** (AC10),
> only the actor is corrected; §A.4 poster-admissibility (the
> `record_poster_allowlist` / default `author_association`) and the §E
> deletion/forgery concessions stand. **One EARS invariant is
> reconciled** to complete the §A.3 basis alignment: **INV3**'s
> freshness basis is corrected from the whole-`S` form
> (`S ∪ U(S, HEAD)`) to the per-owed-pair-path form (`[f]` /
> `[f] ∪ U(f, HEAD)`) that §A.3 and `match.mjs` enforce — the whole-`S`
> form was **fail-open** for a multi-path record (it would green what
> the per-path code reds); the §Terms `fingerprint` shorthand is aligned
> the same way. **All other INV\*/S\* are byte-unedited** — INV2/INV4/S13
> retain their "review-class basis" / single-path-example phrasing, which
> is already consistent with the per-path form. **Which harness
> component posts is left parked** (`adr-0015` open question), not
> resolved here. The notes below remain the prior amendments' provenance
> — superseded as the latest note, not edited.
> **POINTER:** current truth is the §A body below — this note is
> provenance only, not itself an acceptance criterion.
> **VALUE:** as a reviewer, I state my verdict and what I examined and
> never touch CI — the machine stamps the cryptography and the harness
> delivers it; as the maintainer, the check that was ungreenable can now
> be fed a record it accepts, with its trust model and separation
> authority untouched.
> **CONFIDENCE:** `verified` — the emitter/basis referents
> (`plugins/grove/check/lib/emit.mjs`, `lib/basis.mjs`, `lib/match.mjs`
> `evaluatePair`) were read at HEAD this sitting; the actor correction
> traces to `adr-0015` Decision 1–3 and Consequence 3, the basis
> reconciliation to Consequence 2 / adversary N3.
> **Versioning judgment:** **version-significant per `versioning.md`**
> (behavioral spec → agent-judged significance counter): a testable
> clause changed — **INV3**'s normative freshness basis is edited (and
> the §Terms `fingerprint` shorthand with it) to close the internal
> contradiction the §A.3 reconciliation would otherwise leave, in the
> fail-open direction. `version` **bumped 2 → 3**; the durable decision
> the bump requires is **`adr-0015`** itself (which mandated the full
> reconciliation). The §A actor correction alone (§A.1/§A.2/§A.3/§A.4)
> remains a documentation/interface change (`adr-0015` Consequence 3:
> "No core algorithm change"); the version bump is carried solely by the
> INV3 edit. Cascade: the ledger pin
> `plugins/grove/check/test-deps.md` (`spec-0002@v2` → `@v3`) is updated
> in the same wave; because the check code (`match.mjs`) already computes
> per-path, the corrected INV3 **already holds** — the pin bump is a
> mechanical re-verification, **not an owed code change**.
>
> **Amendment (2026-07-18, `adr-0014-install-is-invisible-and-ungated`
> — the pre-install non-gating exception, disclosed in §E; a §E-only
> disclosure, NOT a version bump).**
> **WHAT:** §E gains one disclosed-limit row, **Pre-install non-gating
> exception** — when grove is not yet installed on the protected default
> branch (no `grove-review-policy` block on `origin/<default>`), the
> check's bootstrap self-detect exits green (non-gating) instead of
> running, so a consumer's grove-install PR does not red on grove's own
> just-vendored machinery; `adr-0014` (approved 2026-07-18) move 1b
> governs it. `adr-0014` added to `depends_on` (genuine coupling — the
> disclosed limit tracks its move-1b behavior); `updated:` bumped.
> **WHY:** the check governs its own machinery (adr-0013 F3), so an
> atomic install PR that *adds* `.grove/check/**` + the workflow would
> otherwise red on files owing reviews they cannot yet have — red CI on
> grove's own arrival, the opposite of "just works." The workflow's
> bootstrap self-detect skips gating in exactly the cleanly-read,
> grove-absent case.
> **SCOPE:** §E only, plus the frontmatter `depends_on` + `updated:`
> edits. §C, every INV, every scenario, the reason grammar, and the
> pure-core algorithm are **byte-unchanged** — this behavior lives in
> `adr-0014`'s workflow/check *shell*, not this spec's core, which is
> why it is a §E disclosure and not a §C rule. Fail-closed is preserved:
> a protected-branch **read failure** still reds (INV1); an *established*
> install (policy present on base) never skips, so §C.2's carrier
> fail-close fires as specified. The notes below remain the prior
> amendments' provenance — superseded as the latest note, not edited.
> **POINTER:** current truth is the §E body below — this note is
> provenance only, not itself an acceptance criterion.
> **VALUE:** as a first-run consumer, my grove-install PR does not greet
> me with red CI on grove's own files; as the maintainer, nothing inside
> an *established* install got softer — the exception is only the
> grove-absent bootstrap case, and a read failure still reds.
> **CONFIDENCE:** `verified` — the disclosed behavior traces to
> `adr-0014` move 1b (self-detect: `grove-review-policy` absent on
> `origin/<default>` ⇒ green skip; read failure still reds), read at
> HEAD this sitting.
> **Versioning judgment:** NOT version-significant per `versioning.md`
> (behavioral spec → agent-judged significance counter): no testable
> clause (scenario/invariant) changed; §E is a disclosure section, not a
> gate rule; the gated behavior lives in `adr-0014`'s shell, not this
> spec's core. `version` stays `2`, so the ledger pin
> `plugins/grove/check/test-deps.md` (`spec-0002@v2`) stays correct and
> needs no edit — flagged for the dispatcher, not touched here. No
> durable decision is minted — `adr-0014` is itself the decision of
> record.
>
> **Amendment (2026-07-17, `adr-0013-check-scope-mode` — the check's
> scope mode, `strict` | `scoped`). Citation, stated honestly: every
> delta below derives from the approved `adr-0013` (maintainer intent
> act 2026-07-17) and this amendment rides that approval — the bundle
> goes to the maintainer's merge gate; no fresh approval of this spec
> is claimed, and `status: approved` remains the recorded 2026-07-16
> act.**
> **WHAT:** the `grove-review-policy` block gains `scope: strict |
> scoped` (absent ⇒ `strict`, fail-closed) and the
> `check_runtime_dir` / `check_workflow_path` carrier-of-record keys
> (absent ⇒ install defaults, never silent exclusion) (§B, §C.0, §C.1);
> §C.2 gains **step 0, the `scoped`-mode jurisdiction filter** (the
> four-basis in-scope union; out-of-scope files generate zero owed
> pairs and zero reasons), the **carrier fail-close**, and the
> index-membership clause; §D gains the `scoped`-mode header line
> (mode + aggregate jurisdiction count) and the twelfth reason,
> **`carrier-unresolved`**; §C.8 gains the carrier condition; §E gains
> two disclosed rows (the producer-controlled ledger-presence proxy;
> the run-from-PR-HEAD limit); INV7 and INV15 amended in place with
> markers; INV19–INV22 and S21–S23 added; the traceability section
> extended with the adr-0013 AC1–AC8 map; `version` bumped 1 → 2.
> **WHY:** `adr-0013` (approved 2026-07-17): the wave-2 whole-repo
> fail-closed default is right for grove-self and wrong for the
> first-run consumer, whose ordinary PR reds on application code the
> methodology never touched — at the exact moment adoption is decided.
> The fix is a setup-time choice, never a softened default: silence
> stays `strict`.
> **SCOPE:** §B, §C.0–§C.2, §C.8, §D, §E, both AC grammars, the
> traceability section, and the frontmatter change. Everything else
> stands: the record model, fingerprints, admissibility, selection,
> §C.3–§C.7's rules (applied identically inside jurisdiction), and
> S1–S20; `strict` and absent-key behavior is byte-identical to the
> pre-amendment spec (adr-0013 AC1). The 2026-07-16 notes below remain
> the prior amendments' provenance — superseded as the latest note,
> not edited.
> **POINTER:** current truth is the body below — this note is
> provenance only, not itself an acceptance criterion.
> **VALUE:** as a first-run consumer, an ordinary PR touching only my
> own application code no longer reds on files grove never governed —
> while, as the maintainer, nothing inside jurisdiction got softer and
> the check's own machinery stays tripwired in both modes.
> **CONFIDENCE:** `verified` — every delta traces to `adr-0013`'s
> Decisions 1–5, its conceded-class disclosure, Consequence 1, and
> AC1–AC8, read at HEAD this sitting.
> **Revision round 2 (2026-07-17, appended — spec-adversary
> NEEDS-REVISION against this amendment; the note above stands
> unedited):** MF1 — the §C.2 step-0 type basis pinned to *any*
> frontmatter `type:` declaration, recognized or not (S22 extended
> with the unrecognized-type-outside-`artifact_dirs` half-scenario);
> MF2 — an unrecognized `scope` value resolves to `strict` (§C.1 key
> table, INV19, §B cross-ref; a flagged fail-closed concretization);
> MF3 — the banner's aggregate jurisdiction count pinned to the §C.2
> step-0 iteration set (§D, INV22, S21); WI1–WI4 — the
> reviewer-declaration-file term defined, carrier existence semantics
> pinned (prefix match, blob-under-prefix), INV13 given the scoped-mode
> marker, S21's Given made carrier-resolving. The adversary has **not**
> re-judged this revision; the gates do.
> **Revision round 3 (2026-07-17, appended — trigger: the
> spec-adversary and conformance verdicts at `340c0b3` (would-improve
> W1/W2; the flagged-concretization bookkeeping asymmetry) plus the
> maintainer's same-day ratification of the amendment package; the
> notes above stand unedited):** the step-0 **type-basis pin recorded
> as maintainer-ratified 2026-07-17 — provisionally**, ratified-to-move
> with the math-quest pilot (adr-0013 Consequence 4) as its named
> empirical test (verbatim record at the §C.2 step-0 type row; the
> amendment self-check's concretization row now lists the pin); the §D
> **remedy hint** for INV7 unclaimed-type reds added
> (presentation-layer, ratified with the package); W1 — the deletion
> rule stated where the derivation lives (§C.2 step 0: a deleted path,
> a rename's old path included, generates no owed-derivation entry —
> S12's ABSENT clause governs it); W2 — an unrecognized `scope` value
> named in the §D header on every run (§D + INV22, the §C.1 row's
> self-surfacing rationale cross-referenced). No verdict-changing
> edit; no re-judgment of any verdict claimed — the gates'.

> **Amendment (2026-07-16, `adr-0012` at HEAD — the fifth adversarial
> pass's revisions (F1–F8) + the `implements:` frontmatter field; this is
> the consolidated revision absorbing the conformance FAIL (fifth-pass
> lag) and the spec-adversary NEEDS-REVISION (intrinsic gaps) that ran
> against this spec).**
> **WHAT:** the **approved-upstream gate** added as §C.6 + INV17 + S16
> (AC12); **graph resolution** added as §C.7 + INV18 + S18 (AC13) — the
> mechanical pins-resolve half moves from the fidelity reviewer's scope
> to the check itself; **record admissibility** added as §A.4 + INV16 +
> S17 (AC14) — edited-comment rejection and poster authorization;
> fidelity's upstream re-based from `depends_on` to the **implements
> edge** (§A.3, §B, Terms; S20, `no-reviewable-upstream`);
> `UPSTREAM-INDICTED` handling + upstream routing added (§A.2, §D, S19);
> record field `author` renamed **`producer`** and the frontmatter
> cross-check **deleted** (§C.4, §C.0, INV8); `decision-adversary`
> PASS-class filled (`SOUND`; grammar pinned in `adr-0012` F8 — Q1
> resolved, S10 reworded); `vacuous` renamed `vacuous-evidence` and
> **unflagged** (now the decision's sixth enumerated reason); the §D enum
> grows to eleven reasons (+ `awaiting-human-approval`,
> `no-reviewable-upstream`, `unresolvable-reference`, `record-rejected`,
> `upstream-indicted`); reviewless types now require a **positive policy
> declaration** (§B, INV7); the allowlist pinned to explicit paths + a
> prose predicate (§C.2, INV14); record-schema `schema` field,
> full-stream pagination, path normalization, one-block-per-comment,
> rename and id-collision behavior defined; S2/S4/S5/S7/S10/S12/S13
> amended, S16–S20 added; INV1/INV4/INV5/INV7/INV8/INV9/INV14/INV15
> amended, INV16–INV18 added; traceability re-mapped to AC1–AC14;
> Q1/Q6 resolved, Q7/Q8 added, Q3/Q5 updated.
> **WHY:** `adr-0012` was revised in place (legal while `gated`) after
> its fifth adversarial pass and gained the `implements:` field on this
> spec's own conformance pass's upstream indictment; the conformance
> re-review of this spec then FAILed on the lag, and a spec-adversary
> pass returned NEEDS-REVISION on intrinsic gaps (fail-open projection
> for unclaimed-vs-reviewless types, undefined collision/rename/edited-
> record behavior, an unpinned policy carrier). Both are absorbed here.
> **SCOPE:** §A–§E, both AC grammars, the traceability table, and the
> Open questions change; the record-as-PR-comment model, the one-rule
> owed-map, the fingerprint algorithm, the decision human gate, and
> S1/S3/S6/S8/S9/S11/S14/S15 stand. The 2026-07-16 note below this one
> remains the prior amendment's provenance — superseded as the latest
> note, not edited.
> **POINTER:** current truth is the body below — this note is provenance
> only, not itself an acceptance criterion.
> **VALUE:** as the maintainer, a spec can no longer go green over a
> merely-`gated` decision, a FAIL edited into a PASS is caught
> mechanically, a dangling dependency id is the check's red rather than a
> reviewer's luck, and an indicted upstream routes to *its* layer instead
> of bouncing off the innocent producer.
> **CONFIDENCE:** `verified` — every conformance delta traces to
> `adr-0012`'s Decision-in-brief, Consequences, and AC12–AC14 read at
> HEAD this sitting; every intrinsic fix traces to a named adversary
> finding against this spec.

> **Amendment (2026-07-16, `adr-0012` in-place amendment — the
> maintainer's 2026-07-16 calls; under the fifth adversarial pass).**
> **WHAT:** §A re-based from per-review verdict *files* under
> `.grove/verdicts/` to **append-only verdict records as structured PR
> comments** (record schema, latest-covering selection, vacuity rule);
> the former §C.5 verdicts-directory carve-out **deleted** (no verdict
> path exists in the tree to exempt); §B restated as the decision's
> **one owed-rule** with the fail-closed override; §A.3 splits the
> fingerprint basis by review class (**quality = artifact alone;
> fidelity = artifact + upstream**) following the fidelity/quality
> split (conformance = fidelity at every layer + graph integrity;
> spec-adversary = intrinsic quality only); §D gains the **reason
> grammar**. S2/S6/S7/S12 amended, S13–S15 added; INV1/INV3/INV4/INV9/
> INV12 amended, INV14–INV15 added; traceability re-mapped to the
> amended AC1–AC11 (AC5, AC10).
> **WHY:** `adr-0012` was amended 2026-07-16 — verdict-records-as-
> PR-comments superseding the interim file model (merge residue, an
> exempt-path attack surface, a split output channel), and fidelity
> moving wholly to the `conformance-reviewer` with the `spec-adversary`
> narrowed (the fusion over-invalidated quality verdicts on upstream
> edits). See its Considered-and-rejected entries for both.
> **SCOPE:** §A, §B, §C.0–C.6, §D, both AC grammars, the traceability
> table, and Open Q4 (resolved by the amendment) change; §E, the
> separation rule (§C.4), the decision human gate, and
> S1/S3/S4/S5/S8–S11 stand.
> **POINTER:** current truth is the body below — this note is
> provenance only, not itself an acceptance criterion.
> **VALUE:** as the maintainer, a re-review can never silently
> overwrite a FAIL, an upstream edit no longer spuriously voids a
> spec's quality verdict, and there is no verdict path in the tree left
> to defend as a review-free zone.
> **CONFIDENCE:** `verified` — each change traces to the amended
> `adr-0012` Decision-in-brief, Consequences, and AC1–AC11, read this
> sitting.

## Terms

| Term | Meaning |
|---|---|
| **check** | The single automated job added by this spec (CI on existing primitives, `adr-0012` AC10). Runs on every PR against the protected default branch. |
| **protected branch** | The protected default branch (`main`) — the source of *policy*. Never PR HEAD. |
| **HEAD** | The PR's head commit — the source of reviewed *content*. |
| **diff** | The set of files changed between the PR's merge-base on the protected branch and HEAD (added or modified; deletions per S12; a platform-reported rename = deletion of the old path + addition of the new). |
| **review** | One of the four reviews: `decision-adversary`, `spec-adversary`, `conformance`, `code-reviewer`. |
| **quality review** | `decision-adversary`, `spec-adversary`, `code-reviewer` — "is it good, judged as the thing it is?" Fingerprint basis: the subject **alone** (§A.3). |
| **fidelity review** | `conformance` — "does it faithfully derive from its **implements** upstream?", at every layer with one, plus graph integrity's **judgment half** (propagation claims true). The **mechanical half** — every changed artifact's `depends_on`/`implements` ids resolve — is the **check's own** (§C.7, AC13), not the reviewer's. Fingerprint basis: subject **+ implements target** (§A.3). |
| **implements edge** | The machine-readable realized-contract edge (`adr-0012`): an artifact declares the contract it realizes in an **`implements:` frontmatter field (one id)** — a spec its decision, a charter its ADR; **code names its specs via the test-deps ledger**. Distinct from `depends_on` (**builds-on**), which never owes fidelity — a decision's `depends_on` names decisions it builds on and has no implements edge (its upstream is human intent). |
| **verdict record** | One structured, **append-only** comment on the PR carrying a review's machine-stamped record, per reviewed path (§A.1 — the reviewer judges, the emitter stamps, the harness posts; `adr-0015`). The commit point: a review not recorded here does not count. |
| **record stream** | The PR's comment stream, read via the platform API — the only channel the check reads records from. Read **in full** (paginated to exhaustion, §A.4). |
| **admissible record** | A schema-valid record that also passes §A.4 — unedited carrying comment, authorized poster. Only admissible records enter selection (§C.3). |
| **subject manifest (S)** | The reviewer-declared set of repo-relative paths a record certifies (§A). |
| **upstream set (U)** | The check-derived **implements target(s)** of the subjects (§A.3) — the `implements:` id for artifacts, the ledger-named specs for code; **never** the rest of `depends_on`, never trusted from the record. Fidelity reviews only. |
| **fingerprint** | A deterministic hash over the review-class basis of a single subject path `f` (`[f]` quality, `[f] ∪ U(f)` fidelity) content (§A.3). |
| **owed-map** | The run-time assembly of the one owed-rule from the reviewer charters' declarations (§B). Never a stored table. |
| **PASS-class** | The pass tokens of a review's own charter verdict grammar (§A.2). |
| **approved** | Exactly `status: approved` per `lifecycle.md`'s four-state enum. `draft`, `gated`, and `superseded` are all **not** approved — a superseded artifact does not satisfy an approval gate; the consequence is stated where it bites (§C.6). |

**Path normalization.** Every path in a record or derivation is
repo-relative, `/`-separated, with no leading `./` and no `..` segments;
comparison is exact string equality after normalization (strip a leading
`./`, collapse duplicate separators). A recorded path that cannot be
normalized to this form **matches nothing** (fail-closed by non-match).

---

## §A — Verdict-record format

### A.1 The record and its carrier

- A verdict record is a **structured `grove-verdict` block on a PR
  comment** — one record per reviewed path (§A.3 basis granularity),
  carrying the full §A.2 envelope in **one act** (verdict + subject +
  `manifest_hashes` + fingerprint + producer/reviewer + findings
  together; no second channel). A single comment **may carry several
  such records** (`adr-0019`; the carrier bullet below) — `adr-0012`'s
  "one act" binds **the block's atomicity, never a one-record-per-comment
  cap** (batching groups whole records; it never fragments one). The
  record is **machine-assembled, not hand-authored**
  (`adr-0015`): the **reviewer** supplies only its CI-agnostic
  **judgment** — the verdict token, the subject it reviewed, the
  findings, and the producer/reviewer attribution (the separation
  authority, `adr-0012` AC7); the check package's **record-emitter**
  reads HEAD and **stamps** the machine-computed parts — the
  `fingerprint`, the `manifest_hashes`, and the §A.2 envelope — by
  importing the check's own basis + fingerprint code (`adr-0015`
  Decision 2); the **harness** posts the resulting comment to the change
  request. The reviewer knows nothing of `grove-fp-1`, the envelope, the
  check, or the PR (`adr-0015` Decision 1–3). Nothing lands in the repo
  tree: **no verdict path exists** (`adr-0012` AC5, AC10).
- **Carrier (concretization, flagged):** the machine-parseable part is a
  fenced code block tagged `grove-verdict` containing YAML per §A.2. A
  comment may carry surrounding prose; only the block is the record. Any
  **block** that does not parse against §A.2 is **inert** — it is never a
  record and never satisfies anything (S7; fail-closed by
  non-recognition). A comment **may carry several** `grove-verdict`
  blocks (`adr-0019`): the check reads **each well-formed block as its
  own record**, admitted, selected, and freshness-verified
  **independently** on its own `subject` + `fingerprint`. A block that
  fails §A.2 recognition is **inert on its own** — it satisfies nothing,
  and it **never inerts its well-formed siblings** in the same comment (a
  per-comment poison rule would let one typo silently un-record N good
  reviews — a **false-RED** erasing genuine bookkeeping; `adr-0019`
  Decision 2). Each block is still **one whole record** — verdict +
  subject + `manifest_hashes` + fingerprint + producer/reviewer +
  findings together — so `adr-0012`'s "one act" binds **the block, not
  the comment**: batching groups whole records, it never fragments one.
- **Block delimitation and index (concretization, flagged — makes the
  §A.1/INV9 tiebreak and the per-block isolation guarantee determinate,
  `adr-0019` Decision 2/4).** A `grove-verdict` block runs from its
  opening ```` ```grove-verdict ```` fence line to the **next fence
  line** — either its closing bare ```` ``` ````, **or the next opening
  ```` ```grove-verdict ```` fence, whichever comes first**; an opening
  fence implicitly ends any block still open. A block **not closed by a
  bare fence** before the next opening fence or end-of-comment is
  **malformed → inert on its own** — it is never a record, and it
  **never absorbs, swallows, or inerts a following block** (so a
  stray/unclosed fence costs at most its own block, never a sibling —
  the isolation guarantee above is thereby satisfiable at the *fence*
  level, not only the §A.2-parse level). Within one comment the blocks
  are ordered by **document order of their opening fences**; **block
  index is 0-based, higher index = later** — "latest within a comment"
  is the **highest** block index. This is the index the §A.1 selection
  rule and INV9 refer to: selection order is **comment-id-major,
  block-index-minor**.
- **Append-only.** A re-review yields a **new** record; nothing is
  overwritten or deleted. Editing a record's comment **rejects** the
  record (§A.4, AC14) — a record comment is never edited; a correction
  is a **new** record (re-emitted and re-posted). For each owed pair,
  the **latest covering admissible
  record counts** (§C.3), and the full sequence stays visible — a FAIL
  quietly "becoming" a PASS is visible by construction (S14) and an
  edited one is rejected outright (S17).
- **Session context never counts.** A review that lives only in a
  session's working memory — however faithfully summarized — satisfies
  nothing; the posted record is the commit point (S15, `adr-0012`
  Decision-in-brief 1).
- **Selection rule (concretization, flagged):** `adr-0012` says "the
  latest record per review counts"; with several subjects per PR this
  spec pins the deterministic form — for each owed pair `(f, R)`, the
  **latest admissible schema-valid record for `R` whose `S` contains
  `f`** counts, ordered by the platform's comment creation order
  (monotone comment id), **tie-broken by block index within a comment**
  when two such records share one comment (`adr-0019`): the order is
  **comment-id-major, block-index-minor**. (The emitter's
  one-block-per-file fan-out makes an intra-comment `(f, R)` collision
  rare, but the order is pinned, not left to chance.) A later record
  supersedes earlier ones **for the paths it covers**; it never uncovers
  paths it does not mention.

### A.2 Schema (structured data only — YAML, inside the `grove-verdict` block)

Every field is **required** unless marked optional.

| Field | Type | Meaning |
|---|---|---|
| `schema` | int | Record-schema version. This spec defines exactly `1`. A block whose `schema` is absent or ≠ `1` is **inert** (fail-closed by non-recognition; a future value requires a revision of this spec). |
| `review` | enum | The review this record is for (one of the four). |
| `verdict` | string | The reviewer's overall verdict token, verbatim from its charter grammar. |
| `subject` | list\<path\> | The subject manifest `S` — normalized repo-relative paths this record certifies. Non-empty. In practice a **single element**: the emitter fans a reviewer's multi-path subject out to **one record per reviewed path**, each binding that path's single-path basis (§A.3). |
| `subject_id` | string (optional) | The subject artifact's frontmatter `id`, when it has one. |
| `manifest_hashes` | map path → sha256 | Per-path content hashes **machine-stamped by the emitter** at the commit it reads, over the record's single-path basis (§A.3) — the subject path alone (quality) or that path plus its check-derived upstream `U(f, C)` (fidelity). **Used only to name stale reasons (§D); never for the verdict** — the check recomputes everything. |
| `fingerprint` | string | `grove-fp-1:<64-hex>` **machine-stamped by the emitter** over the record's single-path review-class basis (§A.3), not hand-authored (`adr-0015`). Recomputed by the check at HEAD, never trusted. |
| `producer` | string | Self-reported agent id that **produced** the subject (`adr-0012` AC7/F7 — the record is the single separation authority; renamed from `author`, see the delta note). |
| `reviewer` | string | Self-reported agent id that **produced this record**. |
| `findings` | string | The findings **inline, in this record** — the evidence for a PASS-class verdict, the named gaps for a failing one. An empty/whitespace body makes the record **vacuous** (§D `vacuous-evidence`): schema-valid but satisfying nothing. |
| `reviewed_at_commit` | string (optional) | The commit SHA reviewed. Informational only; the check ignores it for freshness. |

**PASS-class per review** (read from policy on the protected branch;
`adr-0012` AC1/AC5). Charter updates consolidating the fidelity/quality
split are an `adr-0012` execution deliverable in the same wave as this
spec; the scopes below state the amended decision's split, which the
charters' declarations must match:

| `review` | Class | Scope (per `adr-0012`) | PASS-class tokens | Source charter |
|---|---|---|---|---|
| `conformance` | fidelity | faithful derivation from the **implements** upstream, **at every layer** (spec→decision, code→spec, charter→ADR) + graph integrity's judgment half (propagation claims true) | `PASS` — its grammar also carries `FAIL` and **`UPSTREAM-INDICTED`** ("faithful, but the upstream is wrong"), neither of which is a pass; `UPSTREAM-INDICTED` routes **upstream** (§D) | `conformance-reviewer.md` (Output) |
| `code-reviewer` | quality | code judged as code, regardless of the contract | `CLEAN`, `PASS-WITH-ADVISORIES` | `code-reviewer.md` (Verdict) |
| `spec-adversary` | quality | **intrinsic quality only** — testability, internal consistency, ambiguity, edge coverage; it no longer reads or judges fidelity to the decision | `APPROVE-READY` | `spec-adversary.md` (Method 4) |
| `decision-adversary` | quality | decision soundness — internal coherence, contradiction with standing decisions, argument soundness, build-on-settled-ground; never "is this what the human wants" (the human gate's axis) | `SOUND` — grammar pinned normatively in `adr-0012` (F8): `SOUND / NEEDS-REVISION / UNSOUND` | charter **to be authored** (`adr-0012` AC9); until its machine-readable declaration lands in policy, the decision layer is fail-closed (S10) |

A `verdict` token outside its review's PASS-class is **not** a pass —
but the record still **covers** its subjects: the owed pair is *covered
and unsatisfied* with reason `review-failed` (§D) — or
`upstream-indicted` when the token is `UPSTREAM-INDICTED` — which is
distinct from S1's `never-reviewed` (no covering record at all).

### A.3 Fingerprint algorithm (`grove-fp-1`), review-class basis, and upstream resolution

The fingerprint binds a record to exactly the content the review rested
on, so that a later edit to that content invalidates it — and **only**
it. Per `adr-0012`'s fidelity/quality split, the basis differs by class:

**Basis granularity (`adr-0015` Consequence 2 / adversary N3 — the one
referent).** The check recomputes freshness **per owed-pair path**: for
each subject path `f`, `reviewBasis` builds a **single-path** basis and
compares `grove-fp-1(basis, HEAD)` to the record's `fingerprint`
(`plugins/grove/check/lib/match.mjs` `evaluatePair`, `lib/basis.mjs`
`reviewBasis`: `basis = [f]` for quality, `[f, ...U]` for fidelity). A
record's single `fingerprint` therefore binds a **single-path** basis,
not the whole subject manifest `S` — the two coincide only when
`|S| = 1`. The **emitter** stamps at this granularity: one record per
reviewed path (`lib/emit.mjs`), each certifying one subject path over
that path's basis. The `f`-indexed forms below are the referent both the
emitter and the check compute; a legacy multi-path record verifies fresh
only for the single path whose single-path basis its `fingerprint`
matches.

| Review class | Fingerprint input basis (per subject path `f`) | Consequence |
|---|---|---|
| **quality** (`decision-adversary`, `spec-adversary`, `code-reviewer`) | `I = [f]` — the single subject path **alone** | An upstream edit does **not** invalidate a quality verdict (S13). |
| **fidelity** (`conformance`) | `I = sorted(dedup([f] ∪ U(f, C)))` — the subject path `f` **+ its derived implements upstream** | Any subject *or* upstream edit — content or membership — invalidates it (S2, S13). |

**Upstream set `U(f, C)`** at commit `C`, derived by the check for the
subject path `f` of a fidelity record (never read from the record).
**`U` is the implements edge, not `depends_on`** (`adr-0012` F5): a
`depends_on` entry is builds-on and never enters the fidelity basis.

1. Build an **artifact index** at `C`: glob the policy-declared artifact
   directories (default `decisions/`, `specs/`, `charters/`), read each
   file's frontmatter `id`, map `id → path`. **Two files claiming the
   same `id` make that id ambiguous**: any resolution through it fails —
   red with `unresolvable-reference` naming both paths (§C.7); the check
   never silently picks one.
2. For the subject path `f`, if it carries YAML frontmatter: read its
   **`implements:` field** (one id; strip any `@version` suffix per
   `versioning.md`), resolve it to a path via the index, and add that
   path to `U`. A fidelity-owing subject with **no `implements`
   declaration** has no reviewable upstream → the owed conformance pair
   is **red** with reason `no-reviewable-upstream` (`adr-0005` dec 3,
   fail-closed; S20). An `implements` id that **does not resolve** at
   `C` leaves `U` undefined for that subject → **red** with
   `unresolvable-reference` — the basis is never computed over a
   silently smaller set. Transitive closure is **not** taken (Open Q3).
3. A subject `f` with no frontmatter (**code**) resolves its upstream from
   the **per-package test-deps ledger** (`adr-0006` dec 4): locate the
   ledger for the subject's package, read its declared spec/decision ids
   at `C`, resolve each to a path via the index, and add it to `U`. The
   ledger is an artifact the `executor` maintains — so code's upstream is
   **check-derived from a durable, reviewable artifact**, not from the
   reviewer's per-verdict manifest. A code package with **no ledger
   entry** — and, until the ledger convention is pinned (Open Q8),
   **every** code package — has no derivable upstream → red with
   `no-reviewable-upstream` (`adr-0005` dec 3, fail-closed). A change to
   the ledger itself changes `U`'s membership → stale, like any upstream
   change. *(Location/format/file→package mapping: Open Q8 — parked with
   that fail-closed interim, never a silent gap.)*

**`grove-fp-1(I, C)`:**

1. Sort `I` by raw byte order of the path string.
2. For each `p ∈ I`: `b =` the blob bytes of `p` at `C` if it exists,
   else the sentinel `"\x00ABSENT\x00"`; emit
   `L_p = hex(sha256(utf8(p))) + ":" + hex(sha256(b))`.
3. Fingerprint `= "grove-fp-1:" + hex(sha256( join(L_p, "\n") ))`.

The **emitter** stamps `grove-fp-1(I, C)` over the record's single-path
class basis at the commit `C` it reads — importing the check's own basis
+ fingerprint code (`adr-0015` Decision 2) so the stamped value equals
what the check will recompute for unchanged content. The **check**
recomputes `grove-fp-1(I, HEAD)` per owed-pair path — deriving `U`
itself for fidelity — and compares. Any difference — changed subject
content, changed upstream content, or changed upstream *membership* — is
a **stale** record (S2). Because the check derives `U` itself and
recomputes over `HEAD`, neither the reviewer nor the emitter can make a
fidelity record look fresh by omitting the implements target — `U` is
never read from the record. The recorded `manifest_hashes` feed only the
§D reason attribution: a mis-recorded per-path hash can at worst
**misname** a reason, never flip the check's red/green.

### A.4 Record admissibility (AC14 — record integrity)

- **Full stream, always.** The check reads the PR's complete comment
  stream, **paginating the platform API to exhaustion**. A truncated or
  failed read is a check **error (red)** — never a verdict computed over
  a partial stream (fail-closed).
- **Unedited.** A record is admissible only if the platform's metadata
  shows its carrying comment **unedited since creation** (empty edit
  history / `updated_at == created_at`, per the platform's contract).
  Granularity is the **whole comment** (the platform cannot attest less
  — concretization, flagged): any edit, even to surrounding prose,
  rejects the record. A record comment is therefore never edited — a
  correction is a **new** record (§A.1).
- **Authorized poster.** A record is admissible only if the
  platform-attested comment author is authorized: by the configured
  **record-poster allowlist** in policy on the protected branch when one
  exists, else by the default `author_association ∈ {OWNER, MEMBER,
  COLLABORATOR}` (concretization, flagged — the decision pins
  "restricts who may post records"; the default is this spec's
  spelling, overridable in policy; carrier: Open Q7). **The poster is
  now the harness, not the reviewer** (`adr-0015` Decision 3), so this
  admissibility gate binds the **harness component that posts**:
  whichever component posts (a CI step such as `github-actions[bot]`, or
  the dispatcher relaying) **must be in `record_poster_allowlist`** — a
  bot identity is none of `{OWNER, MEMBER, COLLABORATOR}`, so absent an
  allowlist entry its record is rejected `unauthorized` and every owed
  pair reds (`adr-0015` N2). The overridable allowlist is exactly the
  accommodating mechanism; *which* harness component posts is parked as
  an orchestration detail (`adr-0015` open question), not resolved here.
  Separation authority is unaffected — it is the record's
  `producer`/`reviewer` **fields**, not the poster (§C.4, `adr-0012`
  AC7).
- **Rejection semantics.** An inadmissible record is **rejected**:
  excluded from §C.3 selection entirely, and **always surfaced** in the
  status view as an integrity finding (which comment, which cause —
  edited / unauthorized). A rejected record never blocks a pair that an
  admissible record legitimately satisfies; where a pair's only covering
  records are rejected, its reason is `record-rejected` (§D). A FAIL
  edited into a PASS is therefore caught: the edited PASS never counts
  (S17).
- **Deletion stays conceded.** A *deleted* comment is undetectable to
  the check; that is disclosed Layer B surface (§E), never claimed
  caught (`adr-0012` AC14).

---

## §B — The owed-map (ONE rule, assembled at run-time — `adr-0012` Consequences + AC4)

**The rule** (`adr-0012`, verbatim intent): *every changed artifact owes
**fidelity-conformance iff it has an artifact upstream**, plus **its
layer's quality gate*** — where **"artifact upstream" means the
implements edge** (§Terms), never a mere builds-on `depends_on` citation.

`type` is read from the changed file's **frontmatter `type` at HEAD**;
**no frontmatter ⇒ `code`** (`adr-0012`: reuse the frontmatter contract,
no classifier invented).

**The owed-map is not a stored table.** The check **assembles** the
rule's inputs at run-time from the **reviewer charters' machine-readable
declarations** — each reviewer charter declares what it reviews — read
from the **protected branch** (§C.1, AC5), never PR HEAD (`adr-0012`:
*anything derivable is computed at check-time, never stored*). Changing
what a `type` owes is a **charter** edit; there is no map file to
regenerate. The assembly currently projects to (the *expected
projection*, not an authored artifact):

| `type` (at HEAD) | Implements edge | Owed reviews |
|---|---|---|
| **positively declared reviewless** in policy (intended: `research`, `feedback`) | — | *(none)* |
| `adr` / decision | none — its upstream is human intent; its `depends_on` is builds-on, never fidelity-owed | `decision-adversary` **+ human intent gate** (§C.5, AC9) |
| `spec` | its decision, via `implements:` | `conformance` (→ that decision) + `spec-adversary` |
| `charter` | its ADR, via `implements:` | `conformance` (→ that ADR, `adr-0006` dec 8; no charter-layer quality specialist is chartered) |
| *no frontmatter* ⇒ `code` | its spec(s), via the `adr-0006` test-deps ledger | `conformance` (→ spec) + `code-reviewer` |
| **unclaimed / unknown** `type` | n/a | **the full set** — the explicit fail-closed rule below |

- **Reviewless is a positive declaration, never an absence.** A `type`
  owes nothing **only** when policy positively declares it reviewless;
  a type merely *unclaimed* by any reviewer declaration falls to the
  fail-closed override (full set). The two are never conflated — the
  earlier projection ("none — no reviewer declares them") read
  reviewless off absence and contradicted the override; fixed here.
  **Interim honesty:** until the reviewless declaration ships in policy
  (Open Q7, same execution wave), `research`/`feedback` fall to the
  full set — a disclosed interim divergence from the decision's
  intended projection, closed by shipping the declaration, never by the
  check assuming it.
- **Fail-closed override (INV7/AC4) is an explicit check rule, not an
  assembly output.** Pure assembly would leave an *unknown or unclaimed*
  `type` with an empty owed-set (no reviewer claims it) — i.e.
  fail-**open**. So the check applies a stated rule on top: a changed
  file whose `type` is claimed by **no** reviewer declaration **and**
  not positively declared reviewless owes the **full set**, never
  nothing.
- **A fidelity-owing type with no implements declaration** (a spec or
  charter without `implements:`; a code package without a ledger entry)
  still **owes** its conformance review — the pair is simply
  unsatisfiable until the edge is declared: red,
  `no-reviewable-upstream` (§A.3, S20).
- A PR's owed-set is the **union** over all changed files of each file's
  owed reviews (S12); green requires every element satisfied at HEAD.
- *(Former Open Q4 resolved 2026-07-16: the amended `adr-0012` pins the
  `charter → conformance (→ its ADR)` projection explicitly, consistent
  with `adr-0006` dec 8 — the tension that question recorded is gone.)*

**Scope mode (`adr-0013` dec 1–3 — added by the 2026-07-17 amendment).**
The `grove-review-policy` block carries a `scope` key, read — like every
policy input — from the protected branch, never PR HEAD (§C.1, INV1;
S6 stays closed, adr-0013 AC6):

| `scope` at the protected branch | Meaning |
|---|---|
| `strict` — and **absent** (the fail-closed silence default, adr-0013 dec 2; an unrecognized value likewise resolves to `strict`, §C.1) | Every changed file is the check's business: the rule above applies to the whole diff. With no `scope` key, behavior is **byte-identical** to this spec pre-amendment (adr-0013 AC1); softness is never inferred from silence. |
| `scoped` | The check governs **only what is declared into the methodology**: the rule above applies only to in-jurisdiction files (§C.2 step 0). Everything else generates **no owed pairs and no reasons** — not red, not exempted: *outside the check's jurisdiction* (adr-0013 dec 1). |

- **Scope narrows jurisdiction, never softens the gate** (adr-0013
  dec 3): inside scope, every rule of this spec holds identically in
  both modes — INV7's fail-closed unclaimed types, INV14's allowlist,
  freshness, separation, the approved-upstream gate, §C.7 graph
  resolution. `scoped` changes *which files* the check speaks for,
  never *how it speaks*.
- **Why this does not contradict `adr-0005` dec 3** (adr-0013's own
  reconciliation, cited not re-argued): that rule governs work the
  methodology produced; a consumer's pre-existing code in `scoped` mode
  never *enters* the conformance question — jurisdiction, not verdict.
  The moment it opts in (a ledger appears above it), dec 3 applies with
  full force. The producer-controlled edge of this proxy is a disclosed
  §E concession, not a silent trade.
- The friendly path is **setup always writing the key** (adr-0013
  dec 4) — a setup-skill deliverable, not this check's contract; the
  silence default exists only as the fail-closed backstop.

---

## §C — The check

### C.0 Trust boundary (the check trusts no agent-emitted value it can recompute)

| Value | Source | Trusted? |
|---|---|---|
| owed-map (**assembled** from reviewer-charter declarations), PASS-class table, reviewless-type declarations, allowlist + prose-extension set, artifact dirs, record-poster policy, **scope mode + the `check_runtime_dir` / `check_workflow_path` carrier keys** *(amended per adr-0013; was: no scope/carrier inputs existed)* | charters + policy on **protected branch** | policy, not agent-at-PR-HEAD |
| diff, `type` of each changed file | **HEAD** content | recomputed |
| verdict records | the PR's **record stream**, read via the platform API | read as claims; every derivable property below recomputed |
| record admissibility (comment edit history, poster identity) | **platform metadata** | read from the platform, never from any agent's claim (AC14) |
| latest-covering selection per owed pair | platform comment creation order | **computed by the check** — never an agent's claim about which record is current |
| fingerprint | recomputed via `grove-fp-1` over the review-class basis at HEAD | **never trusted** (AC2) |
| upstream set `U` (fidelity) | derived from HEAD `implements:` frontmatter / the test-deps ledger | derived, not read from the record |
| graph resolution (`depends_on` / `implements` ids) | HEAD frontmatter + the artifact index | **computed by the check itself** (AC13) |
| recorded `manifest_hashes` | verdict record | used **only** to name §D stale reasons; never for the verdict |
| coverage (does `S` contain the changed file) | recomputed from diff ∩ `S` | recomputed (AC3) |
| `verdict` token | verdict record | **trusted** (genuineness = Layer B, §E) |
| `producer` / `reviewer` tags | verdict record — **the single separation authority** (`adr-0012` AC7/F7) | **trusted, disclosed** (accidental-case only, AC7/§E). Artifact frontmatter author tags are optional provenance the check **never reads** — never a red condition. |
| `status: approved` (the human intent act, §C.5/§C.6) | artifact frontmatter at HEAD | read mechanically, **trusted as the record of a human act** — a field an agent *could* flip; binding approval to a verifiable platform act is Layer B (grove#38; `adr-0012` F4/AC12), disclosed in §E |

### C.1 Resolve policy (AC5)

**Assemble** the owed-map from the reviewer charters' declarations, and
load the PASS-class table, the reviewless-type declarations, the
artifact-dir list, the non-behavioral **allowlist** (+ its
prose-extension set), and the record-poster policy — all from the
**protected branch** commit, not from PR HEAD. A PR that edits a
reviewer charter's declarations (or any policy input) on its own branch
does **not** change the rules its own gate runs under (S6). The
allowlist is the **only** path exemption that exists — with verdicts
living as PR records, **no verdict path exists in the tree to exempt or
defend** (AC5). *(The concrete schema/location of these policy inputs is
Open Q7 — RESOLVED 2026-07-16: the reviewer charters'
`grove-review-declaration` blocks and the `charters/review-policy.md`
policy file are the shipped carriers; the fail-closed branches remain
operative for any input absent at check time.)*

**Scope + carrier keys (added per `adr-0013` dec 1).** The
`grove-review-policy` block additionally carries:

| Key | Values | Absent ⇒ |
|---|---|---|
| `scope` | `strict` \| `scoped` (§B) | `strict` — the fail-closed silence default (adr-0013 dec 2); never a silent softening. An **unrecognized value** (e.g. `scope: stricd`) likewise resolves to `strict` — strict is maximal jurisdiction, so a misparse can never soften the gate, and the mistake self-surfaces — as unexpected reds and, per round 3 (W2), as a §D header note naming the unrecognized value on every run (concretization, flagged: the decision pins silence ⇒ `strict`; invalid-value handling is this spec's fail-closed spelling of the same principle) |
| `check_runtime_dir` | path of the installed check runtime dir (carrier-of-record) | the install default `.grove/check/` — never silent exclusion |
| `check_workflow_path` | path of the installed workflow file (carrier-of-record) | the install default `.github/workflows/grove-review-bookkeeping.yml` — never silent exclusion |

All three are policy inputs like every other in this section: read from
the **protected branch** commit only. A PR editing its own `scope` or
carrier keys does not change the rules its own gate runs under (S6
stays closed; adr-0013 AC6). Setup writing the keys on every CI-check
install is adr-0013 AC5's criterion — a setup-skill deliverable
(adr-0013 Consequence 3), not this check's contract; the defaults above
are the fail-closed floor when it hasn't.

### C.2 Derive the owed-coverage set (AC1, AC3, AC4)

For each file `f` in the diff (a rename contributing both its old path —
a deletion — and its new path — an addition):

**Step 0 — jurisdiction filter (`scoped` mode only; added per
`adr-0013` dec 1).** When `scope` is `strict` (or absent), every diff
file enters steps 1–3 — no filter exists and this step is a no-op.
In **both** modes the derivation walks **HEAD-present paths only**: a
deleted path — including a rename's old path — generates no
owed-derivation entry and is never classified; deletion's governance
lives in freshness (S12's ABSENT-sentinel clause), not here (pinned
round 3, W1 — the preamble's rename parenthetical enumerates the old
path as a diff member for freshness, never as a file this derivation
classifies).
When `scoped`, `f` enters steps 1–3 **only if in scope**; an
out-of-scope file generates **zero owed pairs and zero reasons** —
outside the check's jurisdiction, not exempted — and its only trace is
the §D header's aggregate jurisdiction count (adr-0013 AC2). In-scope
is the **union** of:

| Basis | `f` is in scope when |
|---|---|
| **path** | `f` is under a policy `artifact_dirs` directory (the governed corpus). |
| **type** | `f`'s HEAD frontmatter carries a `type:` declaration — pinned fail-closed as **any `type:` value, recognized or not**: an unrecognized `type: widget` outside `artifact_dirs` is in scope by type and, unclaimed, owes the full set per INV7 — an unknown spelling is never an exit door. Jurisdiction follows the artifact's own self-declaration **wherever it lives**, so mislocating a typed artifact outside `artifact_dirs` is not an exit door either; §C.7 graph resolution runs for every changed artifact by this definition. Out-of-scope therefore genuinely means: no frontmatter `type:`, not under `artifact_dirs`, unledgered, and no carrier. *(Pin **maintainer-ratified 2026-07-17 — provisionally**, in the maintainer's own words: "I'm not completely convinced, but I think we need to move ahead… some of these questions will only be actually answered when we start testing this in proper products and repositories." Ratified-to-move: the math-quest pilot (adr-0013 Consequence 4) is the named empirical test of exactly this edge — incidental non-grove frontmatter, e.g. a Hugo/Jekyll `type: post`.)* |
| **opted-in code** | `f` belongs to a package that opted in via a test-deps ledger (`adr-0006` dec 4; the ledger's concrete spelling is the ledger artifact's to pin, per Q8 — cited by reference, not respelled here). |
| **gate carriers** | `f` is one of the gate's own carriers, machinery included: a **reviewer-declaration file** (INV21's term — a file the §C.1 policy assembly reads a `grove-review-declaration` block from, discovered at the protected-branch commit), the review-policy file itself, any test-deps ledger, or the installed check runtime dir / installed workflow file per the `check_runtime_dir` / `check_workflow_path` carrier keys (§C.1) — in scope **in both modes** (adr-0013 AC4). |

- **In scope, nothing softens** (adr-0013 dec 3): steps 1–3 and every
  downstream rule — INV7's fail-closed unclaimed types, the INV14
  allowlist, freshness, separation, the approved-upstream gate, §C.7 —
  apply to an in-scope file identically in both modes.
- **Carrier fail-close (adr-0013 dec 1/AC4).** In `scoped` mode, a
  carrier-of-record path — `check_runtime_dir` or `check_workflow_path`,
  whether written in policy or fallen to its install default — that
  does **not exist at the protected-branch commit** is a **red** with
  reason `carrier-unresolved` (§D). Existence semantics, pinned: a file
  is a runtime-dir carrier iff its normalized path (§Terms) is **under**
  `check_runtime_dir` — prefix match after trailing-slash normalization
  — and the runtime dir exists at the protected-branch commit iff **at
  least one blob** lies under that prefix; `check_workflow_path` exists
  iff its blob does. So a non-default hand install with
  absent keys, and relocated machinery whose keys never followed the
  move, stay red until the keys name the real paths — the assumption
  is never silently wrong, and the gate's machinery is never silently
  excluded from its own jurisdiction. *(Disclosed friction, adr-0013
  Consequence 5: a legitimate machinery re-install shows these red rows
  and the human merges over them knowingly; a smoother update path is a
  follow-up parked in adr-0013, never silently traded for the
  tripwire.)*
- **Index membership is unchanged (adr-0013 Consequence 1).**
  Type-based scope membership does **not** imply artifact-index
  membership: the §A.3 step-1 index still globs `artifact_dirs` only,
  in both modes. An inbound `depends_on`/`implements` reference to a
  mislocated (typed-but-outside-`artifact_dirs`) artifact therefore
  stays **red** with `unresolvable-reference` — fail-closed, unchanged.

1. Classify `type(f)` from HEAD frontmatter (§B); no frontmatter ⇒
   `code`; positively declared reviewless ⇒ none; unclaimed /
   unrecognized ⇒ full set.
2. **Allowlist**: entries are **explicit repo-relative paths only —
   never a class, glob, or directory** — and an entry is honored only if
   the file passes the **prose predicate**: its extension is in the
   policy-declared prose set (default `{.md, .txt, .rst}`) **and** its
   first line is not a shebang (`#!`). A path failing the predicate is
   treated per §B as if unlisted — the allowlist is an allowlist, never
   a review-free zone for code (S11, AC5; predicate is a concretization,
   flagged).
3. Emit an owed pair `(f, R)` for each `R ∈ owed(type(f))`.

The **owed-coverage set** is the union of all such pairs.

### C.3 Match records (AC1, AC2, AC3, AC14)

For each owed pair `(f, R)`: from the record stream, take the **latest
admissible schema-valid record** for `R` whose subject manifest contains
`f` (§A.1's selection rule over §A.4's admissible records). The pair is
satisfied iff that record is **all** of:

- **covering** — `f ∈ S` (by selection) (AC3);
- **fresh** — recomputed `grove-fp-1` over the review-class basis at
  HEAD equals the recorded `fingerprint` (AC2, §A.3);
- **passing** — `verdict ∈ PASS-class(R)` (AC1; `UPSTREAM-INDICTED` is
  never passing — §D routes it upstream);
- **separated** — passes §C.4;
- **non-vacuous** — `findings` is non-empty (§A.2, §D).

No such record, or the latest covering record failing any condition ⇒
**red** for that pair (AC1), with the §D reason(s).

### C.4 Separation (AC7 — accidental case only)

- **The record is the single separation authority at every layer**
  (`adr-0012` F7/AC7): for each matched record, `reviewer ≠ producer` ⇒
  else **red** (S5).
- Artifact frontmatter MAY carry an author tag as **optional
  provenance**; the check **never reads it** and it is **never a red
  condition**. *(The former mandatory frontmatter cross-check is
  deleted — see the delta note and resolved Open Q6.)*
- Deliberate forgery of either tag is **out of scope** (Layer B, §E,
  AC8).

### C.5 Decision-layer human gate (AC9)

For any changed file whose owed set includes `decision-adversary`, the
check additionally requires the artifact's `status` **at HEAD** to be
exactly `approved` (the recorded **human intent gate**, `lifecycle.md`);
otherwise red with reason `awaiting-human-approval` (§D). A bundled
*draft* or *gated* decision keeps the gate **red** until the human
approves it in-PR (`adr-0012` Consequences; this enforces staged
approval through the existing gate, adds no new rule) (S9). The
`decision-adversary`'s verdict grammar is pinned in `adr-0012` (F8;
PASS-class `SOUND`, §A.2) — but until its charter's machine-readable
declaration exists on the protected branch, the policy input is absent
and a decision-layer change **cannot go green** — fail-closed (S10).

### C.6 Approved-upstream gate (AC12)

For **every owed fidelity pair** `(f, conformance)`: resolve `f`'s
implements upstream at HEAD (§A.3 — the `implements:` target; for code,
**every** ledger-named spec) and require that artifact's `status` at
HEAD to be **exactly `approved`** (`lifecycle.md`) — **whether or not
the upstream file changed in the PR** (the gate binds the edge, not the
diff; the earlier §C.5-only form gated changed decision files alone and
under-enforced). Red otherwise, reason `awaiting-human-approval` naming
the upstream and its status (S16).

- `draft` and `gated` fail the gate — bundling the upstream's approval
  in-PR clears it; **skipping an upstream's approval by bundling is
  not possible** (`adr-0012` F1/AC12).
- **`superseded` also fails** — it is not `approved` (§Terms). The
  honest consequence: a downstream whose upstream was superseded stays
  red until it re-targets the successor (`implements:` edit + re-review)
  — the gate never treats a retired contract as a live one.
- **Disclosed limit (F4):** the check reads approval from frontmatter, a
  field an agent *could* flip; binding it to a verifiable human act
  (platform required-review; grove#38) is Layer B — until then an
  agent-flipped `approved` is the same conceded class as record
  genuineness, judged by the human at merge (§C.0, §E).

### C.7 Graph resolution (AC13)

For **every changed artifact of any type** — whether or not it owes any
review — the check itself verifies that each id in its `depends_on` and
`implements` frontmatter **resolves at HEAD** to exactly one path via the
artifact index (version suffixes stripped per `versioning.md` first).

- A **dangling** id (resolves to nothing) ⇒ **red**,
  `unresolvable-reference` naming the id (S18) — fail-closed, never a
  silent skip.
- A **collided** id (two files at HEAD claim it) ⇒ the index is
  ambiguous ⇒ **red**, `unresolvable-reference` naming the id and both
  paths; every resolution through it fails rather than silently picking
  one (S18, §A.3 step 1).
- **Cross-repo qualified ids** (`repo/id…` where `repo` is not this
  repo, `adr-0006` dec 3) are **shape-checked only** — v0 is no-fetch
  (`trellis/decision-0044` via `adr-0006`); their live resolution is
  disclosed as out of v0 scope, never red for unresolvability and never
  silently treated as resolved (concretization consistent with
  `adr-0006` dec 3, flagged).
- This is the **mechanical half** of graph integrity — pure `f(HEAD)`,
  the check's own. The **judgment half** (propagation claims true) stays
  the `conformance-reviewer`'s where a fidelity review is owed, else the
  human's (`adr-0012` Consequences).

### C.8 Verdict of the check

Green **iff** every owed pair is satisfied (C.3), every separation check
holds (C.4), every decision-layer human gate (C.5) and approved-upstream
gate (C.6) is satisfied, graph resolution (C.7) holds for every
changed artifact, and — in `scoped` mode — every carrier-of-record path
resolves at the protected-branch commit (§C.2 step 0,
`carrier-unresolved`) *(amended per adr-0013; was: no carrier
condition — no scope mode existed)*. Otherwise red, naming each failing row with its §D
reason(s). A rejected record never blocks an otherwise-satisfied pair,
but every rejection is surfaced (§A.4). **Green is non-authorizing**
(§D, AC6).

---

## §D — The rendered status view and the reason grammar (AC6)

The check renders one **read-only** status view each run, computed
entirely from the record stream + the check's own recomputation —
**computed, never stored**; no agent writes or mutates it.

- **Per-row** (one per owed pair `(f, R)`): `review | subject | latest
  verdict | fresh? | covers? | separated? | reason(s) if un-green |
  findings`. Reds that are not a `(file × review)` pair — a §C.7
  graph-resolution failure, a §C.6 red on an upstream shared by several
  subjects — get **file-level rows** of the same shape.
- **Append-only visibility:** the view links each pair's full record
  sequence (e.g. FAIL → PASS), never only the latest — a superseded FAIL
  stays readable (S14) — and lists every **rejected** record with its
  cause (§A.4).
- **Header banner, verbatim intent:** *"Bookkeeping complete — a human
  still judges genuineness and merges. This is NOT approval."* on green;
  the failing rows + reasons on red. *(Amended per adr-0013 dec 5/AC7;
  was: no mode line — no scope mode existed.)* In `scoped` mode the
  header line additionally **names the mode and the aggregate
  jurisdiction count**, on green and red alike — e.g. *"Bookkeeping
  complete — scoped mode: 3 of 14 changed files in jurisdiction. A
  human still judges genuineness and merges. This is NOT approval."* —
  **one line, never per-file exemption rows**; the non-authorizing
  banner language (INV11) is unchanged, so a green is never read as a
  whole-repo verdict by the human at merge. The count is pinned to the
  **§C.2 step-0 iteration set**: the denominator is the diff entries
  the owed-derivation walks at HEAD — after the §C.2 preamble's rename
  expansion, the HEAD-present paths; a deletion (including a rename's
  old path) contributes no entry, jurisdiction being about owed-pair
  generation while deletion-staleness lives in freshness (S12) — and
  the numerator is that set's in-scope members (the step-0 union).
  In **either** mode, when the protected-branch `scope` value was
  unrecognized and resolved to `strict` (§C.1, INV19), the header
  additionally carries a note naming the value and the resolution on
  **every** run, green or red — e.g. *"scope: 'scopped' unrecognized —
  resolved to strict (fail-closed)"* — so the misparse is visible even
  on a diff with no out-of-jurisdiction files (added round 3, W2).
- The view never carries the words "approved," "reviewed," or "safe to
  merge" for a green result (AC6, S8).

**The reason grammar.** For every un-green row the view states **why**,
from this enum (all applicable reasons, in this order):

| Reason | Fires when | Payload |
|---|---|---|
| `never-reviewed` | No admissible schema-valid record for `R` covers `f` — including a review run only in session (S15) or a malformed `grove-verdict` block (S7). | — |
| `changed-since-review` | Latest covering record is stale and a **subject** path's HEAD hash differs from its recorded `manifest_hashes` entry. | The changed subject path(s). Where attribution is impossible — a subject path absent from `manifest_hashes`, or every recorded entry matching HEAD while the recomputed fingerprint still differs — the payload is `unattributed` **plus the record's full subject manifest**; the reason is never suppressed for want of attribution. |
| `upstream-<path>-changed` | Latest covering record (fidelity) is stale and an **upstream** path's content or membership differs at HEAD. | The upstream file, **named** (e.g. `upstream-decisions/adr-0012….md-changed`). |
| `review-failed` | Latest covering record is fresh but `verdict ∉ PASS-class(R)` (and is not `UPSTREAM-INDICTED`). | A link/anchor to that record's inline findings. Routing: the **subject's** producing layer. |
| `upstream-indicted` | Latest covering `conformance` record is fresh and its verdict is `UPSTREAM-INDICTED` — the subject is faithful, its upstream is wrong (`adr-0012` F3). | The indicted implements upstream, named, + the findings link. **Routing: the upstream's layer** — a decision-layer indictment routes **to the human** — never the subject's producer. (Routing semantics decision-backed; the reason token is this spec's spelling, flagged.) |
| `self-reviewed` | Latest covering record fails §C.4 (`reviewer == producer`). | The shared agent id. |
| `vacuous-evidence` | Latest covering record parses, covers, and is fresh, but its `findings` body is empty — a bare token with no evidence to read. | — |
| `awaiting-human-approval` | §C.5: a changed decision-layer artifact is not `approved` at HEAD; or §C.6: an owed fidelity pair's implements upstream is not `approved` at HEAD. | The artifact awaiting the human act + its `status` at HEAD (a `superseded` upstream noted as terminal: re-target the successor, don't approve). |
| `no-reviewable-upstream` | A fidelity review is owed but no implements edge is declared — a spec/charter without `implements:`, a code package without a ledger entry (or, interim, without a pinned ledger convention — Q8) (`adr-0005` dec 3). | The subject + the missing declaration, named. |
| `unresolvable-reference` | A changed artifact's `depends_on` or `implements` id is dangling or collided at HEAD (§C.7) — file-level, owed pair or not. | The id(s); for a collision, both claiming paths. |
| `record-rejected` | A pair's only covering records are inadmissible (§A.4 — edited comment or unauthorized poster). | The rejected record(s) + cause (`edited` / `unauthorized`). |
| `carrier-unresolved` | `scoped` mode only (§C.2 step 0, added per adr-0013 dec 1/AC4): a carrier-of-record path — `check_runtime_dir` or `check_workflow_path`, whether written in policy or fallen to its install default — does not exist at the protected-branch commit. File-level row, owed pair or not. (Semantics are the decision's; the token **spelling** is this spec's — flagged, the `upstream-indicted`/`vacuous-evidence` precedent.) | The key, the path it resolved to, and whether that path was `written` or `defaulted`. |

**Remedy hint for unclaimed types (presentation-layer; added round 3,
ratified with the adr-0013 package 2026-07-17).** Where a red row's
reason stems from an **unclaimed type** — the full set owed via INV7's
fail-closed override — the rendered view names the two cures in
context, approximately: *"unclaimed type `<type>` — declare it in
`reviewless_types` (`charters/review-policy.md`) if it is not
review-bearing, or add a reviewer declaration claiming it."* This
changes no verdict and no reason token — rendered text only, keyed off
the derivation's own §C.2 step-1 classification — per the maintainer's
recorded self-guiding principle (2026-07-17 call, the same sitting as
the deferred-install path): products surface the salient next step in
context.

Reason **naming** uses the record's `manifest_hashes` and the check's
own recomputation; the **verdict** never depends on the recorded hashes
(§A.3). *(`vacuous-evidence` is decision-backed: the sixth enumerated
reason in `adr-0012`'s Consequences — the former concretization flag is
retired.)*

**One derivation, four consumers.** The per-row reasons + routing are
emitted as the check's structured output (machine-readable alongside the
rendered summary). The same single derivation serves: the **check**'s
red/green, the human-facing **view**, **dispatch** (which reviewer — or,
for `upstream-indicted`, which *layer* — the fix routes to), and the
re-run reviewer's **scoped work order** (exactly which rows and why) —
never re-derived divergently, per `adr-0012`'s computed-never-stored
principle.

---

## §E — Non-goals (Layer B — explicitly out of scope)

This spec does **not** specify, and its check does **not** provide
(`adr-0012` Decision-in-brief 3, AC8, Consequences "deferred to Layer B"):

| Non-goal | Why out of scope (Layer A limit disclosed) |
|---|---|
| **Run-attestation / genuineness** | The check trusts the `verdict` token; it cannot prove a genuine non-producer review actually ran. An agent could post a fake passing verdict record. |
| **Forgery-proof separation** | `producer`/`reviewer` are self-reported; the check catches **accidental** fusion, never a deliberately forged tag. |
| **Record deletion** | The store is the PR's comment stream. **Edit-gaming is Layer A now** (AC14, §A.4): an edited record is rejected via the platform's edit metadata, so a FAIL edited into a PASS is caught. A **deleted** record, by contrast, is undetectable and stays conceded to the human's judgment — disclosed, never claimed caught. |
| **A verifiable human approval act** | §C.5/§C.6 read `status: approved` from frontmatter — a field an agent *could* flip. The check reads it as the **record** of a human act; binding approval to a verifiable platform act (required-review, grove#38) is Layer B (`adr-0012` F4/AC12). Until then an agent-flipped `approved` is the same conceded class as record genuineness. |
| **Autonomous loop-bounding** | A non-converging revise ↔ re-review cycle is bounded by the **human** (v1); a force-push-stable mechanical bound is Layer B (E7). |
| **Scoped-mode ledger-presence proxy** *(row added per adr-0013 AC8 — the conceded class, disclosed not silently traded)* | In `scoped` mode, code's in-scope test is test-deps-ledger presence — a proxy **the producing agent controls**. A grove-run change whose executor omits its ledger generates no owed pairs: `adr-0005` dec 3's mechanical second catch does not fire, where `strict` would red the identical PR. Layer A cannot mechanically attest *who produced* a change (the same limit class as record genuineness, above). Conceded, named, and **backstopped**, never closed: (1) the executor charter's standing duty — the ledger is part of the deliverable, and code shipped without one is non-conformant at build review; (2) the human at merge — new code with no ledger is visible in the diff, and the §D mode-naming banner keeps the green honest about what it did not examine; (3) `strict` mode as the ratchet for a project whose grove-run share has grown past trusting the prose duty. `scoped` trades the mechanical catch, knowingly, for adoption — the trade is adr-0013's point, stated here rather than discovered later. |
| **Run-from-PR-HEAD** *(row added per adr-0013 AC8 — both modes; the wave-2 code-review finding, previously unrecorded here)* | The check's own code runs from the PR's checkout: a **malicious** PR can alter the running check itself, and no output of that run is trustworthy. Policy-from-protected-branch (INV1) and the §C.2 carrier scoping preserve the **non-malicious** tripwire — an honest edit to the gate's machinery is never silent, in either mode — but a deliberately subverted runner is the same conceded class as forged records: Layer B, judged by the human at merge, never claimed caught. |
| **Pre-install non-gating exception** *(row added per adr-0014 — grove does not gate its own arrival; a shell behavior, not a core-algorithm change)* | When grove is **not yet installed on the protected default branch** — no `grove-review-policy` block on `origin/<default>` (INV1's HEAD-independent base read) — the check's bootstrap self-detect **exits green (non-gating)** instead of running, so a consumer's grove-install PR does not red on grove's own just-vendored machinery (`adr-0014` move 1b). This lives in the **workflow/check shell**, not the pure core: §C, every INV, every scenario, and the reason grammar are **unchanged** — a cleanly-read base with no policy block is a green skip only in the bootstrap shell, a deliberate decision-backed exception to §C.8's "green iff every gate passes" and to fail-closed-on-empty-policy. Fail-closed is preserved where it bites: a genuine protected-branch **read failure** still reds (the exception is only the cleanly-read, grove-absent case), and an *established* install (policy present on base) never skips — §C.2's carrier fail-close fires exactly as specified. Governed by `adr-0014`, judged by the human at merge. |

These are named, not pretended. Authenticity and policy changes remain
**human-owned** (AC8).

---

## Acceptance criteria

### Invariants (EARS)

- **INV1 (policy integrity, AC5).** The check **shall** assemble the
  owed-map from the reviewer charters' declarations and **shall**
  resolve the PASS-class table, reviewless-type declarations, allowlist
  (+ prose-extension set), artifact-dir list, and record-poster policy
  from the protected default branch, and **shall not** read any of them
  from PR HEAD.
- **INV2 (content basis).** The check **shall** classify each changed
  file's `type`, compute the diff, and recompute fingerprints from PR
  HEAD content.
- **INV3 (freshness by review class, AC2).** The check **shall**
  recompute each matched record's fingerprint via `grove-fp-1` over the
  review-class basis at HEAD **per owed-pair path `f`** (§A.3) — `[f]`
  for a quality review, `[f] ∪ U(f, HEAD)` for a fidelity review — and
  **shall** treat any mismatch as stale, never trusting the recorded
  fingerprint or `manifest_hashes` for the verdict. *(Amended
  2026-07-18, `adr-0015` reviewer/machine-boundary reconciliation; was:
  "the subject alone for a quality review, `S ∪ U(S, HEAD)` for a
  fidelity review" — the whole-`S` form disagreed with §A.3 and
  `match.mjs`'s per-path recomputation for a multi-path record, in the
  fail-open direction.)*
- **INV4 (derived implements upstream, fidelity).** For fidelity
  records, the check **shall** derive the upstream set `U` itself — from
  the HEAD frontmatter **`implements:`** field for artifacts, from the
  `adr-0006` per-package test-deps ledger for code, **never** from the
  remainder of `depends_on` — and **shall not** read the upstream
  membership from the record. Where a fidelity-owing subject declares no
  implements edge, the check **shall** go red with
  `no-reviewable-upstream`; where a declared id does not resolve, the
  check **shall** go red with `unresolvable-reference` — it **shall
  not** compute the basis over a silently smaller set.
- **INV5 (completeness, AC1).** The check **shall** go red if any owed
  `(file, review)` pair lacks a latest covering record that is
  **admissible**, schema-valid, fresh, PASS-class, separated, and
  non-vacuous.
- **INV6 (coverage, AC3).** For a record to cover an owed pair `(f, R)`,
  the check **shall** require `f` to be a member of that record's
  subject manifest `S` — existence alone **shall not** suffice.
- **INV7 (fail-closed type, AC4)** *(amended 2026-07-17, adr-0013; was:
  applied unconditionally to every changed file — no scope mode
  existed).* The check **shall** treat a `type`
  as reviewless **only** on a positive policy declaration; where a
  changed file's `type` is new, undefined, or claimed by no reviewer
  declaration (and not declared reviewless), the check **shall** assign
  the full review set as an explicit rule on top of the assembly (which
  alone would fail open); where a file has no frontmatter, the check
  **shall** classify it as `code`. In `scoped` mode this rule **shall**
  apply to in-jurisdiction files (§C.2 step 0): an out-of-scope file
  generates no owed pairs at all — jurisdiction, never a softened
  owed-set — and an in-scope file of unclaimed type **shall** owe the
  full set identically in both modes (adr-0013 AC3).
- **INV8 (separation, AC7).** The check **shall** go red if a matched
  record's `reviewer` equals its `producer` — the verdict record being
  the single separation authority at every layer — and **shall not**
  read any artifact frontmatter author tag as a separation input or a
  red condition (such tags are optional provenance only).
- **INV9 (record channel, AC10)** *(amended 2026-07-18, adr-0019; was:
  treated "a multi-block comment" as inert and selected by comment order
  alone).* The check **shall** read verdict
  records only from the PR's comment stream via the platform API, read
  **in full** (paginated to exhaustion — a truncated read **shall** be a
  red error, never a partial verdict); **shall** treat any **block** that
  does not parse against the §A.2 schema (including an absent/unknown
  `schema` value) as inert **on its own, without inerting its well-formed
  siblings in the same comment** (`adr-0019` — a comment may carry
  several records, each read independently); **shall** itself select the
  latest covering admissible record per owed pair from the platform's
  comment order, **tie-broken by block index within a comment**; **shall
  not** count any review not recorded on the PR (session context is never
  a record); and **shall not** mutate, or require mutation of, any
  existing record.
- **INV10 (decision human gate, AC9).** For a changed decision-layer
  artifact, the check **shall** require a PASS-class `decision-adversary`
  record **and** the artifact's `status` at HEAD to be exactly
  `approved`, emitting reason `awaiting-human-approval` otherwise.
- **INV11 (non-authorizing, AC6).** On green, the check **shall** present
  the result as "bookkeeping complete," and **shall not** label it
  "approved," "reviewed," or "safe to merge."
- **INV12 (no unbuilt infra, AC10).** The check **shall** use only git
  content and existing platform primitives — protected branches, CI, and
  the PR record stream + its metadata via the platform API — and **shall
  not** depend on run-attestation, an identity service, or a
  forge-resistant store.
- **INV13 (union owed-set)** *(amended 2026-07-17, adr-0013; was: the
  union ranged over every changed file unconditionally — no scope mode
  existed).* For a PR touching multiple files, the check
  **shall** require the union of every changed file's owed reviews, all
  satisfied at HEAD; in `scoped` mode an out-of-scope file **shall**
  contribute the empty set to that union (§C.2 step 0) — jurisdiction,
  never a softened owed-set, matching INV7's treatment.
- **INV14 (sole path exemption, AC5).** The declared non-behavioral
  allowlist **shall** be the only path exemption the check honors; its
  entries **shall** be explicit repo-relative paths (never a class,
  glob, or directory); and the check **shall** honor an entry only if
  the file passes the prose predicate (declared prose extension, no
  shebang) — a code-bearing path **shall never** be exempted through it.
- **INV15 (reason grammar, AC6)** *(amended 2026-07-17, adr-0013; was:
  the enum ended at `record-rejected` — eleven reasons).* For every
  un-green row, the check
  **shall** emit at least one reason from the §D enum —
  `never-reviewed`, `changed-since-review`, `upstream-<path>-changed`
  (naming the file), `review-failed` (linking the record's findings),
  `upstream-indicted` (naming the upstream; routing to its layer),
  `self-reviewed`, `vacuous-evidence`, `awaiting-human-approval` (naming
  the artifact and its status), `no-reviewable-upstream`,
  `unresolvable-reference` (naming the id(s)), `record-rejected` (naming
  the record and cause), `carrier-unresolved` (`scoped` mode; naming the
  key, the path, and written-vs-defaulted) — and **shall** emit the per-row derivation
  (reason + routing) as structured output so the view, dispatch, and the
  reviewer's scoped work order consume the same derivation rather than
  re-deriving it.
- **INV16 (record integrity, AC14).** The check **shall** reject —
  exclude from selection and surface in the view — any record whose
  carrying comment the platform's metadata shows edited after creation,
  and any record whose platform-attested poster is not authorized by the
  record-poster policy; and it **shall not** claim to detect record
  *deletion* (disclosed Layer B, §E).
- **INV17 (approved upstream, AC12).** For every owed fidelity pair, the
  check **shall** resolve the subject's implements upstream at HEAD and
  **shall** go red unless that artifact's `status` is exactly `approved`
  (`lifecycle.md`; `superseded` **shall not** count as approved) —
  whether or not the upstream file changed in the PR — emitting reason
  `awaiting-human-approval`.
- **INV18 (graph resolution, AC13).** For every changed artifact of any
  type, the check **shall** itself verify that each intra-repo id in its
  `depends_on` and `implements` frontmatter resolves at HEAD to exactly
  one path in the artifact index (version suffixes stripped per
  `versioning.md`), **shall** go red on a dangling or collided id with
  reason `unresolvable-reference`, and **shall** shape-check-only
  cross-repo qualified ids (v0 no-fetch, `adr-0006` dec 3) — disclosed,
  never silently treated as resolved.
- **INV19 (scope mode + silence = strict; adr-0013 AC1/AC6).** The
  check **shall** read the `scope` key and the
  `check_runtime_dir` / `check_workflow_path` carrier keys from the
  `grove-review-policy` block at the protected default branch only —
  never PR HEAD — and **shall** treat an absent `scope` key, **and any
  `scope` value other than exactly `strict` or `scoped`**, as `strict`
  (a misparse never softens jurisdiction); with no `scope` key, the
  check's behavior **shall** be byte-identical to this spec's
  pre-amendment `strict` behavior on every input.
- **INV20 (jurisdiction without softening; adr-0013 AC2/AC3).** In
  `scoped` mode the check **shall** generate owed pairs only for
  in-scope files (the §C.2 step-0 union: path / type / opted-in code /
  gate carriers); **shall** emit zero owed pairs, zero reasons, and no
  exemption rows for an out-of-scope file; and **shall** apply every
  rule of this spec identically to in-scope files in both modes —
  `scoped` **shall** change which files the check speaks for, never how
  it speaks.
- **INV21 (the gate governs itself, both modes; adr-0013 AC4).** The
  reviewer-declaration files, the review-policy file, every test-deps
  ledger, the installed check runtime dir, and the installed workflow
  file **shall** be in the check's scope in both modes; in `scoped`
  mode the check **shall** go red with `carrier-unresolved` where a
  carrier-of-record path (written or defaulted, §C.1) does not exist at
  the protected-branch commit — it **shall not** silently exclude the
  gate's own machinery from its jurisdiction.
- **INV22 (mode visibility; adr-0013 AC7).** In `scoped` mode the §D
  header **shall** state the mode and the aggregate jurisdiction count
  — whose denominator **shall** be the §C.2 step-0 iteration set (the
  HEAD-present diff entries after rename expansion; a deletion
  contributes no entry) and whose numerator **shall** be that set's
  in-scope members — on green and red alike, in one line; the check
  **shall not** render per-file exemption rows; and the
  non-authorizing banner language (INV11) **shall** be unchanged. In
  **either** mode, where the protected-branch `scope` value was
  unrecognized and resolved to `strict` (INV19), the §D header
  **shall** name that value and its `strict` resolution on every run,
  green or red (added round 3, W2).

### Scenarios (GWT)

- **S1 (completeness miss, AC1).** *Given* a PR changing `specs/foo.md`
  (type `spec`, owes `spec-adversary` + `conformance`) *and* only a
  passing `conformance` record exists in the stream, *When* the check
  runs, *Then* it goes **red**, naming the `(specs/foo.md,
  spec-adversary)` pair with reason `never-reviewed`.
- **S2 (freshness / spec-revised-underneath, AC2).** *Given* a passing
  `conformance` (fidelity) record over code whose ledger-derived
  implements upstream includes `specs/foo.md`, *When* `specs/foo.md` is
  edited later in the same PR, *Then* the recomputed `grove-fp-1`
  differs from the recorded fingerprint and the check goes **red**
  (stale) with reason `upstream-specs/foo.md-changed`, without anyone
  re-flagging it by hand.
- **S3 (coverage gap, AC3).** *Given* a PR changing `specs/foo.md` and
  `specs/bar.md` *and* a fresh passing `spec-adversary` record whose
  subject manifest lists only `specs/foo.md`, *When* the check runs,
  *Then* it goes **red** on the uncovered `(specs/bar.md, spec-adversary)`
  pair.
- **S4 (fail-closed undefined type, AC4).** *Given* a PR adding
  `x/thing.md` with frontmatter `type: widget` — claimed by no reviewer
  declaration and not declared reviewless — *When* the check runs,
  *Then* it requires the **full** review set for it and goes red until
  all are present, fresh, and passing.
- **S5 (accidental fusion, AC7)** *(amended 2026-07-16, `adr-0012` F7;
  was: keyed on the record `author` field + a frontmatter cross-check).*
  *Given* a matched `conformance` record whose `producer` equals its
  `reviewer`, *When* the check runs, *Then* it goes **red** on
  separation with reason `self-reviewed` carrying the shared agent id,
  regardless of the verdict token — and no artifact frontmatter tag is
  consulted.
- **S6 (policy from main, AC5).** *Given* a PR that edits a reviewer
  charter's machine-readable declaration on its own branch so `spec` no
  longer owes `conformance`, *When* the check runs, *Then* it still
  assembles the owed-map from the protected-branch charters and the
  dropped review is still owed.
- **S7 (non-record content is inert, AC10/AC1)** *(amended 2026-07-18,
  adr-0019; was: a comment carrying two `grove-verdict` blocks was itself
  wholly inert — "one comment is one record").* *Given* a PR comment
  containing prose claiming "conformance passed" plus a **malformed**
  `grove-verdict` block that fails the §A.2 parse, *When* the check runs,
  *Then* the malformed block does not count as a record and, absent any
  covering admissible record, the owed pair stays **red** with reason
  `never-reviewed` (fail-closed by non-recognition). *And given* a
  comment carrying a **malformed block alongside a well-formed
  `grove-verdict` block**, *Then* the malformed block is inert **on its
  own** while its well-formed sibling **still counts as a record** — a
  malformed block never inerts its siblings (per-block isolation, never
  per-comment poison; `adr-0019`). *And given* a comment carrying an
  **unclosed ```` ```grove-verdict ```` fence** (no bare closing fence)
  immediately followed by a well-formed `grove-verdict` block, *When* the
  check runs, *Then* the unclosed block is **malformed → inert on its
  own** (the following opening fence ends it, §A.1 block delimitation)
  and it **does not swallow or inert** the well-formed sibling, which
  **still counts as a record** — a fence-level typo costs at most its own
  block. *And given* a comment carrying **two well-formed `grove-verdict`
  blocks**, *Then* the check reads **each as its own record**, admitted /
  selected / freshness-verified independently on its own subject +
  fingerprint. *And given* a
  schema-valid PASS record whose `findings` body is empty, *Then* it
  satisfies nothing and the pair's reason is `vacuous-evidence`.
- **S8 (green non-authorizing, AC6).** *Given* every owed pair satisfied
  at HEAD, *When* the check renders the status view, *Then* the banner
  reads "bookkeeping complete — a human still judges genuineness and
  merges" and nowhere says "approved / reviewed / safe to merge."
- **S9 (bundled draft decision, AC9).** *Given* a PR bundling a new
  decision at `status: draft` with a spec that depends on it, *When* the
  check runs, *Then* the decision-layer human-gate condition is unmet and
  the check is **red** (`awaiting-human-approval`) until the human
  approves the decision in-PR — no new bundling rule, the existing gate
  enforces the ordering.
- **S10 (decision-adversary declaration unavailable, AC9)** *(amended
  2026-07-16, `adr-0012` F8; was: the PASS-class itself undefined —
  the grammar is now pinned: `SOUND / NEEDS-REVISION / UNSOUND`).*
  *Given* the `decision-adversary`'s grammar is pinned in `adr-0012`
  (PASS-class `SOUND`) but its charter — the policy carrier the check
  assembles from — does not yet exist on the protected branch, *When* a
  PR changes a decision, *Then* the check **cannot** go green for it
  (fail-closed), never defaulting the decision review to satisfied; the
  pinned grammar becomes operative when the charter's declaration lands
  in policy.
- **S11 (allowlist can't exempt code, AC5).** *Given* a code-bearing path
  listed in the non-behavioral allowlist (it fails the prose predicate —
  wrong extension, or a shebang first line), *When* the check runs,
  *Then* the entry is void and the path still owes `code-reviewer`
  (+ `conformance`) — the allowlist does not exempt code.
- **S12 (union owed-set, INV13).** *Given* a PR carrying one spec, one
  code file, and one research note, *and* policy positively declares
  `research` reviewless, *When* the check runs, *Then* the owed-set is
  `{spec: conformance+spec-adversary} ∪ {code:
  conformance+code-reviewer} ∪ {research: none}` and green requires all
  of it at HEAD. *And* a pure deletion (including a rename's old path)
  whose path appears in a fresh record's fingerprint basis recomputes to
  `ABSENT`, changing the fingerprint and marking that record stale.
- **S13 (quality survives an upstream edit; fidelity does not, AC2)**
  *(amended 2026-07-16; was: upstream read from `depends_on`).*
  *Given* `specs/foo.md` (`implements: adr-x`) with a fresh passing
  `spec-adversary` record (basis: the spec alone) *and* a fresh passing
  `conformance` record (basis: spec + `adr-x`), *When* `adr-x` is edited
  in the same PR, *Then* the `conformance` record goes stale with reason
  `upstream-decisions/adr-x….md-changed` **and** the `spec-adversary`
  record remains fresh — the upstream edit invalidates only the fidelity
  verdict, never the quality one.
- **S14 (append-only re-review, AC10).** *Given* the stream holds a
  `conformance` FAIL record for `specs/foo.md` and, later, a fresh
  passing record for the same subject (admissible, separated,
  non-vacuous), *When* the check runs, *Then* the latest record counts
  and the pair is satisfied, *and* the status view still shows the
  FAIL → PASS sequence — nothing overwritten, edited, or deleted.
- **S15 (session is not a record, AC1/AC10).** *Given* a `spec-adversary`
  ran in-session and its transcript shows `APPROVE-READY` but no record
  was posted to the PR, *When* the check runs, *Then* the
  `(spec, spec-adversary)` pair is **red** with reason `never-reviewed`
  — the posted record is the commit point; session context never counts.
- **S16 (approved-upstream gate, AC12).** *Given* a PR changing
  `specs/foo.md` (`implements: adr-x`) with a fresh, passing, covering,
  admissible `conformance` record, *and* `decisions/adr-x….md` is
  `status: gated` at HEAD and **not changed in the PR**, *When* the
  check runs, *Then* the check is **red** for that pair with reason
  `awaiting-human-approval` naming `adr-x` and its status — approving
  the upstream in-PR or prior clears it; bundling never skips it.
- **S17 (edited record rejected, AC14).** *Given* a `conformance` record
  whose comment originally carried `verdict: FAIL` and was later
  **edited** so its block reads `PASS` (the platform's metadata marks
  the comment edited), *When* the check runs, *Then* the record is
  **rejected** — excluded from selection — and, no other admissible
  covering record existing, the pair is **red** with reason
  `record-rejected` (`edited`), the rejection surfaced in the view.
  *And given* a schema-valid record posted by an identity outside the
  record-poster policy, *Then* it is likewise rejected (`unauthorized`).
  A *deleted* record remains undetectable — conceded to the human (§E),
  never claimed caught.
- **S18 (graph resolution, AC13).** *Given* a PR changing `specs/foo.md`
  whose `depends_on` names an id resolving to no file in the artifact
  index at HEAD, *When* the check runs, *Then* the check is **red** with
  reason `unresolvable-reference` naming the dangling id — regardless of
  any review records present. *And given* two files at HEAD claiming the
  same frontmatter `id`, *Then* the index is ambiguous for that id and
  the check is **red** naming both paths — any resolution through the
  collided id fails rather than silently picking one.
- **S19 (UPSTREAM-INDICTED routes upstream, AC1/AC9).** *Given* a fresh,
  covering, admissible `conformance` record for `specs/foo.md`
  (`implements: adr-x`) whose verdict is `UPSTREAM-INDICTED`, *When* the
  check runs, *Then* the pair is **red** (the token is not PASS-class)
  with reason `upstream-indicted`, and the structured routing output
  targets **`adr-x`'s layer** — a decision-layer indictment routes to
  the human — never `specs/foo.md`'s producer.
- **S20 (no implements declaration, AC1/AC4).** *Given* a changed
  `spec`-typed file carrying no `implements:` field, *When* the check
  runs, *Then* its owed `conformance` pair is **red** with reason
  `no-reviewable-upstream` (`adr-0005` dec 3) — the fidelity review is
  owed and unsatisfiable until the edge is declared; `depends_on`
  entries never substitute for the implements edge.
- **S21 (out-of-scope is silent, adr-0013 AC2/AC7).** *Given* policy on
  the protected branch declares `scope: scoped`, *and* the
  install-default carrier paths resolve at the protected-branch commit
  (at least one blob under the `.grove/check/` prefix; the
  `.github/workflows/grove-review-bookkeeping.yml` blob present — §C.2
  step 0), *and* a PR changes `src/app/main.py` — no frontmatter `type:`,
  not under `artifact_dirs`, its package has no test-deps ledger, and
  it is no carrier path — *and* the same PR **deletes**
  `src/app/legacy.py`, *When* the check runs, *Then* the changed file
  generates **zero owed pairs and zero reasons**: no row, no exemption
  entry, no carrier-unresolved row; its only trace is the §D header's
  aggregate jurisdiction count, which reads "0 of **1** changed files
  in jurisdiction" — the deletion contributes no entry to the step-0
  iteration set — where `strict` mode would have owed
  `conformance` + `code-reviewer` and gone red
  (`no-reviewable-upstream`) on the identical PR.
- **S22 (in-scope stays fail-closed, adr-0013 AC3 + Consequence 1).**
  *Given* `scope: scoped` *and* the same PR also adds `specs/widget.md`
  with frontmatter `type: widget` — in scope by path, claimed by no
  reviewer declaration, not declared reviewless — *When* the check
  runs, *Then* that file owes the **full** review set and is red until
  every pair is present, fresh, and passing — byte-identical to S4's
  `strict` behavior; jurisdiction narrowed nothing inside it. *And
  given* a changed `notes/thing.md` whose HEAD frontmatter declares
  `type: spec`, *Then* it is in scope **by type**, wherever it lives
  (mislocation is not an exit door), and owes
  `conformance` + `spec-adversary` — while remaining absent from the
  artifact index (which globs `artifact_dirs` only, both modes), so an
  inbound `depends_on`/`implements` reference to its id from another
  changed artifact is **red** with `unresolvable-reference` —
  fail-closed, unchanged. *And given* a changed `notes/gadget.md` whose
  HEAD frontmatter declares `type: widget` — **unrecognized, and
  outside `artifact_dirs`** — *Then* it is in scope **by type** all the
  same (any `type:` declaration counts, §C.2 step 0) and, unclaimed,
  owes the **full** review set (INV7): an unrecognized type outside the
  artifact dirs is never a silent exit door.
- **S23 (carrier fail-close, adr-0013 AC4).** *Given* `scope: scoped`,
  *and* the policy block writes no
  `check_runtime_dir` / `check_workflow_path` keys, *and* the
  install-default paths (`.grove/check/`,
  `.github/workflows/grove-review-bookkeeping.yml`) do not exist at the
  protected-branch commit (a hand install placed the machinery
  elsewhere), *When* the check runs, *Then* the check is **red** with
  reason `carrier-unresolved` naming each key, the defaulted path it
  fell to, and its `defaulted` provenance — and it stays red until the
  keys name the real paths; the gate's machinery is never silently
  excluded from its own jurisdiction.

### Traceability

| adr-0012 AC | Covered by |
|---|---|
| AC1 completeness | INV5, S1, S7, S15, S19, S20 |
| AC2 freshness | INV3, INV4, §A.3, S2, S13 |
| AC3 coverage | INV6, §C.3, S3 |
| AC4 fail-closed | INV7, §B, S4, S20 |
| AC5 policy integrity | INV1, INV14, §C.1/§C.2, S6, S11 |
| AC6 non-authorizing + reasons surfaced | INV11, INV15, §D, S8 |
| AC7 separation | INV8, §C.4, S5 |
| AC8 honest disclosure | §E |
| AC9 decision-adversary | INV10, §A.2 (grammar pinned), §B, §C.5, S9, S10, S19 |
| AC10 no infra pretence | INV9, INV12, §A.1, S7, S14, S15 |
| AC11 adr-0006 pointer | Open Q4 (resolved) records the per-layer conformance consistency; §A.3 step 3 consumes `adr-0006` dec 4 as-is (Q8 parks its unpinned convention fail-closed); §C.7 inherits `adr-0006` dec 3's v0 no-fetch limit; no supersession |
| AC12 approved upstream | INV17, §C.6, S16 |
| AC13 resolvable graph | INV18, §C.7, §A.3 steps 1–2, S18 |
| AC14 record integrity | INV16, §A.4, S17 |

**adr-0013 acceptance criteria** (added by the 2026-07-17 scope-mode
amendment):

| adr-0013 AC | Covered by |
|---|---|
| AC1 silence = strict | INV19, §B (scope-mode table), §C.1 (key table), §C.2 step 0 (no-op branch) |
| AC2 jurisdiction | INV20, §C.2 step 0, S21 |
| AC3 no softening | INV7 (amended), INV20, §B/§C.2, S22 |
| AC4 the gate governs itself | INV21, §C.2 (carriers basis + fail-close), §C.8 (amended), §D `carrier-unresolved`, S23 |
| AC5 the choice is recorded | **A setup-skill deliverable** (adr-0013 dec 4 / Consequence 3), not this check's contract — mapped honestly, not claimed covered here; this spec supplies the fail-closed floor when setup fails it: INV19 (silence ⇒ `strict`), INV21 (absent/dangling carriers red in `scoped`) |
| AC6 S6 intact | INV19, §C.1 (scope + carrier keys from the protected branch), S6 (stands unamended — the new keys are policy inputs under its existing rule) |
| AC7 mode visibility | INV22, §D header banner (amended), S21 |
| AC8 concessions written down | §E — both new rows: the scoped-mode ledger-presence proxy (three backstops named) and run-from-PR-HEAD (both modes) |

---

## Open questions

1. **`decision-adversary` verdict grammar — RESOLVED (2026-07-16) by the
   `adr-0012` revision.** The grammar is now pinned normatively in the
   decision (F8): `SOUND / NEEDS-REVISION / UNSOUND`, PASS-class `SOUND`
   (§A.2). The charter itself remains an `adr-0012` deliverable; until
   its machine-readable declaration lands in policy on the protected
   branch, the decision layer stays fail-closed (S10). Nothing invented
   here — the token set is the decision's own.
2. **Code → upstream resolution — RESOLVED (2026-07-16).** Code files carry
   no frontmatter, so the check cannot derive their upstream from the code
   itself. Resolved by folding in the **per-package test-deps ledger**
   (`adr-0006` dec 4, already approved): code's upstream is read from the
   ledger the `executor` maintains (§A.3 step 3), so `U` for code is
   check-derived from a durable, reviewable artifact — not the reviewer's
   per-verdict manifest — and the spec-revised-underneath case (S2) fires for
   code too. A package with no ledger entry falls to the fail-closed
   backstop (`adr-0005` dec 3). No new machinery: the `executor`'s existing
   ledger duty is the stamping mechanism. The amended `adr-0012` now names
   this resolution itself ("code → conformance (→ its spec, resolved via the
   `adr-0006` test-deps ledger)"). (Note: fundamentally *some* declaration is
   required — code cannot self-describe which spec it implements — so this
   moves the declaration to the best available home, a maintained artifact,
   rather than eliminating it. The ledger's concrete convention is Q8.)
3. **Direct vs. transitive upstream closure (§A.3).** `U` (fidelity
   basis only, post-split) is the **implements target** — one hop by
   construction; transitive closure is **not** taken. A change two hops
   up (a spec's decision) does not stale a code fidelity record via this
   check — it is caught by `adr-0006`'s pin/version machinery when the
   intermediate artifact is itself re-touched. If experience shows
   distant-upstream drift must stale records directly, this is the dial
   to revisit. `adr-0012` does not pin the depth; direct is this spec's
   fail-bounded choice, surfaced not hidden.
4. **`charter` owed set — RESOLVED (2026-07-16) by the `adr-0012`
   amendment.** The earlier tension (no `charter` row in the owed-map vs.
   `adr-0006` dec 8's charter→ADR conformance review) is gone: the amended
   decision's one-rule projection pins `charter → conformance (→ its
   ADR)` explicitly, exactly `adr-0006` dec 8's review. No charter-layer
   quality specialist exists, and none is invented here. This is also the
   AC11 forward-pointer touchpoint: extension recorded as consistent, no
   supersession.
5. **Provisional upstream — `adr-0012` is `gated`, not `approved`.** The
   contract-author charter derives specs from **approved** decisions; the
   maintainer explicitly authorized proceeding **provisionally** on the
   `gated` `adr-0012` (a disclosed deviation, recorded here). This spec
   must be **re-checked** — and its `implements`/`depends_on` pins
   re-confirmed — once `adr-0012` is approved, and re-derived if
   `adr-0012` is amended before approval. *(The 2026-07-16 amendments
   triggered exactly that — twice: the first re-derivation absorbed the
   records-as-comments + fidelity/quality split; this consolidated
   revision is the second, absorbing the fifth-pass revisions and the
   `implements:` field. The obligation continues until `adr-0012` is
   approved.)* It must **not** promote past `gated` into any executor
   build while its authorizing decision is still `gated`. Note also that
   this spec's own §C.6 gate, once live, would hold a build against this
   spec red for exactly this reason — the machinery being specified
   agrees with the disclosure.
6. **Separation cross-check — RESOLVED (2026-07-16) by the `adr-0012`
   revision (F7/AC7).** The earlier open point (a frontmatter `author`
   field as a new convention feeding a mandatory cross-check) is gone
   with its ground: the decision now pins the **verdict record as the
   single separation authority at every layer** — record fields
   `producer`/`reviewer`, no code-file tags, artifact frontmatter author
   tags **optional provenance only**. The cross-check is deleted (§C.4);
   no frontmatter field name needs pinning here because the check never
   reads one.
7. **The policy/declaration carrier — RESOLVED (2026-07-16) by the
   `adr-0012` execution wave 1 (the charter wave), exactly per this
   question's named default.** (a) Each reviewer charter now carries a
   fenced `grove-review-declaration` block (fields: `schema`, `review`,
   `types`, `pass_class`) — `charters/conformance-reviewer.md`,
   `charters/decision-adversary.md`, `charters/spec-adversary.md`,
   `charters/code-reviewer.md`; (b) the non-charter inputs live in one
   policy file on the protected branch, `charters/review-policy.md`
   (fenced `grove-review-policy` block): the artifact-dir list, the
   positive reviewless declarations (`research`, `feedback`), and the
   non-behavioral allowlist + prose-extension set — the record-poster
   allowlist deliberately absent, falling to the §A.4
   `author_association` default. The original park text follows as
   provenance. *The verdict-record
   carrier is pinned (§A.1); the policy side is not: the concrete
   schema and location of (a) each reviewer charter's machine-readable
   declaration (what types it reviews + its verdict grammar/PASS-class)
   and (b) the non-charter policy inputs — reviewless-type declarations,
   the non-behavioral allowlist + prose-extension set, the artifact-dir
   list, the record-poster allowlist. `adr-0012` assigns the charter
   declarations to the same-wave charter updates; pinning their format
   here would invent charter structure. **Named default:** declarations
   live in each reviewer charter as a fenced machine-readable block; the
   non-charter inputs live in one policy file on the protected branch.*
   **The fail-closed interims stay operative as check behavior for any
   input absent at check time — they were never a gap:** absent reviewer
   declaration → its types are unclaimed → full set (INV7); absent
   reviewless declaration → `research`/`feedback` owe the full set (§B);
   absent allowlist → nothing exempt; absent artifact-dir list → the
   stated default (§A.3); absent record-poster allowlist → the
   `author_association` default (§A.4, flagged).
8. **The test-deps ledger's concrete convention (NEW, parked).**
   `adr-0006` dec 4 pins the ledger's *concept* and the `executor`'s
   duty — not its location, format, or file→package mapping; its own AC
   ("a worked example... exists") is unexecuted. Pinning those here
   would invent beyond both decisions. **Fail-closed interim:** until
   the convention is pinned (an `adr-0006`/`adr-0012` execution
   deliverable), **no code path has a derivable upstream** — every
   changed code path's conformance pair is red with
   `no-reviewable-upstream` (`adr-0005` dec 3), never a silent skip
   (§A.3 step 3). The moment the convention lands, §A.3's derivation
   applies unchanged.

---

## Rubric check

No project spec-quality rubric is materialized at `<SPEC_RUBRIC_PATH>`
(the repo has no `rubrics/`); this self-check is against the
`contract-author` charter's intrinsic quality bar (testable ACs, both
grammars, non-empty Open questions, no invented scope, deliberate
`depends_on`).

| Criterion | Result | Note |
|---|---|---|
| Frontmatter complete & well-typed | PASS | `id/type/status/implements/depends_on/owner/updated/version`. `implements` names the realized contract per the amended `adr-0012`; `adr-0012` is deliberately retained in `depends_on` too so depends_on-walking machinery (`adr-0006`) keeps the edge until it learns `implements` — disclosed duplication, not drift. |
| Versioning discipline | PASS-DISCLOSED | `version` held at 1 through this second significant pre-approval revision — deliberately: the spec is `gated`, never consumed at v1 (pre-gate convergence, the same footing as `adr-0006`'s pre-ratification revisions); the durable decision the change requires **is** the revised `adr-0012` itself. Counter starts moving once the artifact has consumers to pin it. |
| Both grammars present (`adr-0004`) | PASS | 18 EARS invariants + 20 GWT scenarios; neither stands in for the other. |
| ACs testable | PASS | Every INV/S is a deterministic, observable check outcome; the fingerprint algorithm, implements-edge derivation, admissibility rules, selection rule, path normalization, and reason enum are fully specified. Q8's unpinned inputs carry a named fail-closed interim, so behavior is defined even where the carrier is not (Q7's carriers shipped 2026-07-16 — the charter declaration blocks + `charters/review-policy.md`; its fail-closed branches stay operative for absent inputs). |
| Traceability to authorizing decision | PASS | All of AC1–AC14 mapped (AC12–AC14 added this revision); every pinned mechanism traces to `adr-0012` at HEAD. |
| Delta note (`adr-0004`, revise-in-place) | PASS | A second section-level five-field blockquote + VALUE + CONFIDENCE supersedes — without editing — the first; both stand as provenance; single-scenario changes (S5, S10, S13) also carry inline amendment tags. |
| Open questions non-empty & honest | PASS | 8 recorded; Q1/Q2/Q4/Q6/Q7 marked resolved (with what resolved them), not deleted; Q8 is a named park with fail-closed interim behavior, never a silent gap. |
| No invented scope beyond decision | PARTIAL-DISCLOSED | Concretizations extend the decision's shorthand in service of its stated rationale, each flagged in place: the `grove-verdict` fenced-block carrier + one-block-per-comment rule (§A.1); the latest-covering selection rule (§A.1); the `schema` field with inert-on-unknown (§A.2); `manifest_hashes` powering reason attribution, never the verdict (§A.2/§A.3); comment-level edit granularity and the `author_association` poster default (§A.4); the allowlist prose predicate (§C.2); cross-repo ids shape-checked-only, consistent with `adr-0006` dec 3 (§C.7); path normalization (Terms); and the reason-token spellings for the decision-backed gate/integrity/routing reds (`awaiting-human-approval`, `no-reviewable-upstream`, `unresolvable-reference`, `record-rejected`, `upstream-indicted` — semantics the decision's, tokens this spec's). Formerly-flagged `vacuous` is now decision-backed (`vacuous-evidence`, sixth enumerated reason) and unflagged. Q8 remains **parked**, not invented; Q7 is resolved by shipped carriers, not invented here. |
| Constrains via tables/enumerations, not prose | PASS | Owed-map, schema, trust boundary, PASS-class, review-class basis, reason grammar, non-goals, traceability all tabular. |
| Layer B named as non-goal, not specified | PASS | §E enumerates all five Layer B non-goals — updated: edit-gaming moved to Layer A (AC14), only *deletion* conceded; the agent-flippable `approved` field (F4) added as its own disclosed row. |
| Provisional-upstream deviation disclosed | PASS | Open Q5 records the `gated`-not-`approved` deviation, both re-derivations, and the standing re-check obligation — and notes this spec's own §C.6 would flag exactly this condition once live. |

**Self-check verdict: PASS with disclosures.** The one non-clean line
(invented scope) is disclosed, not silently passed: everything the
revised decision pins is pinned; everything it leaves genuinely open is
an Open question with named fail-closed interim behavior or a flagged
concretization, never a silent guess. Remaining `gated`. `approved` is
the human's to give (`lifecycle.md`, `floor-intent-gate`) — and, per
Open Q5, this spec's own authorizing decision is still `gated`, so it
must not be built against until both it and `adr-0012` clear the human
gate.

### Amendment self-check (2026-07-17, adr-0013 scope-mode amendment)

The check above is the pre-approval revision's provenance and stands
unedited (its counts and "remaining `gated`" line describe that
sitting); this dated subsection is the amendment's own check.

| Criterion | Result | Note |
|---|---|---|
| Derives only from the approved decision | PASS | Every delta cites `adr-0013` (Decisions 1–5, the conceded-class disclosure, Consequence 1, AC1–AC8); nothing added beyond it. Illustrative example paths in S21/S23 are examples, not new requirements. |
| Append-only amendment discipline | PASS | New section-level delta note (five fields + VALUE + CONFIDENCE) prepended; prior notes unedited (the round-2 addendum is appended below the note, never rewriting it); no INV/S renumbered; meaning-changing edits to approved text (INV7, INV13, INV15, §C.0 policy row, §C.8, §D banner) carry explicit `(amended per adr-0013)` / dated inline markers with prior-state `was:` clauses. Round-2 edits to material this amendment itself introduced (step-0 table, INV19–INV22, S21–S23, §C.1 key table) carry no `was:` markers — they are not approved text; the delta-note addendum is their provenance. |
| Both grammars extended (`adr-0004`) | PASS | 22 EARS invariants (INV19–INV22 added) + 23 GWT scenarios (S21–S23 added); neither grammar stands in for the other. |
| Concretization beyond the decision | PARTIAL-DISCLOSED | One token spelling pinned here, flagged in §D per the `upstream-indicted`/`vacuous-evidence` precedent: **`carrier-unresolved`** (the decision names the semantics and uses "carrier-unresolved reason" descriptively; the enum token is this spec's spelling). The `written`/`defaulted` payload provenance values are likewise this spec's spelling of the decision's "written or defaulted" distinction. Round 2 adds two more flagged pins: **unrecognized `scope` values resolve to `strict`** (§C.1/INV19 — the decision pins silence ⇒ `strict` and softness-never-inferred; invalid-value handling is this spec's fail-closed spelling of that principle; red-error was the decision-compatible alternative, not chosen because `strict` is maximal jurisdiction and the mistake self-surfaces as unexpected reds) and the **carrier existence semantics** (prefix match after trailing-slash normalization; dir-exists = at least one blob under the prefix — §C.2, this spec's spelling of the decision's "exists at the protected-branch commit"). Round 3 lists here — closing the bookkeeping asymmetry the conformance pass at `340c0b3` named — the third round-2 pin, previously absent from this row: the **step-0 type basis** (any `type:` value, recognized or not — MF1, §C.2/S22); **maintainer-ratified 2026-07-17, provisionally** (verbatim record at the §C.2 step-0 type row), with the math-quest pilot (adr-0013 Consequence 4) as its named empirical test. |
| Traceability | PASS-DISCLOSED | adr-0013 AC1–AC8 all mapped; AC5 honestly mapped as a setup-skill deliverable outside this check's contract (with this spec's fail-closed floor named), never claimed covered. |
| Versioning discipline (`versioning.md`) | PASS | Significant testable-clause change ⇒ `version` bumped 1 → 2; the durable decision the bump requires is `adr-0013` itself. |
| Status honesty (`lifecycle.md`) | PASS-DISCLOSED | `status: approved` stands on the recorded 2026-07-16 human act; this amendment claims no fresh spec approval — it rides the maintainer's 2026-07-17 `adr-0013` approval, and the bundle goes to their merge gate (stated in the delta note's citation line). No agent flipped any state. |

**Amendment self-check verdict: PASS with disclosures** (the flagged
token spelling and the AC5 mapping, both stated in place). Conformance
is not self-declared here — the gates judge.

**Round-2 revision (2026-07-17, same sitting).** A spec-adversary pass
against this amendment returned **NEEDS-REVISION**; this revision
applies its findings — MF1 (step-0 type basis pinned: any `type:`
declaration counts, recognized or not; S22 extended with the
unrecognized-type-outside-`artifact_dirs` half-scenario), MF2
(unrecognized `scope` ⇒ `strict`, §C.1 + INV19 + §B cross-ref; a
flagged concretization, choice rationale in the row above), MF3 (the
aggregate jurisdiction count defined against the §C.2 step-0 iteration
set — §D, INV22, and S21's count now exercises the
deletion-contributes-no-entry clause), and WI1–WI4 (the
reviewer-declaration-file term, carrier existence semantics, INV13's
scoped-mode marker, S21's carrier-resolving Given). Counts stand: still
22 EARS invariants + 23 GWT scenarios, nothing renumbered; INV13 gains
a dated amendment marker; `version: 2` already names this amendment's
state and is not re-bumped for its own revision round. This revision
is **not** claiming the adversary's validation — the re-judgment is
the gates', and `status: approved` still rests solely on the recorded
2026-07-16 human act plus the adr-0013 ride-along stated in the delta
note.

**Round-3 revision (2026-07-17, same day, appended).** Trigger: the
spec-adversary and conformance verdicts at `340c0b3` and the
maintainer's same-day ratification of the amendment package —
including, **provisionally**, the step-0 type-basis pin (verbatim
maintainer wording recorded at the §C.2 step-0 type row) and the §D
remedy hint. Four edits, all recorded in the round-3 delta-note
addendum: (1) the ratification record (§C.2 step-0 type row + the
concretization row above, closing the flagged bookkeeping asymmetry);
(2) the §D remedy hint (presentation-layer — no verdict, no reason
token, keyed off the derivation's existing classification); (3) W1,
the §C.2 step-0 deletion clause (harmonizing the preamble's rename
parenthetical — the old path is a diff member for freshness, never a
classified file); (4) W2, the §D header note plus an INV22 sentence —
INV22 chosen over the §C.1 row as the normative home because the
visibility duty is a testable render obligation and belongs in EARS;
since the note fires precisely in strict-resolved runs, the sentence
is stated mode-independent, and the §C.1 row's "self-surfaces as
unexpected reds" rationale is cross-referenced to it rather than left
claiming reds alone suffice. Counts stand: 22 EARS + 23 GWT, nothing
renumbered, no reason token added; `version: 2` is not re-bumped —
this round is the same amendment package converging pre-merge, and the
one new testable clause (the INV22 sentence) pins visibility of an
already-pinned resolution, riding the package's ratification rather
than constituting a fresh behavioral contract. No re-judgment of the
adversary or conformance verdicts is claimed; `status: approved` still
rests on the recorded 2026-07-16 human act plus the adr-0013
ride-along.

### Amendment self-check (2026-07-18, adr-0015 reviewer/machine-boundary amendment)

The checks above are the prior sittings' provenance and stand unedited;
this dated subsection is the adr-0015 amendment's own check. The
amendment is **chiefly a documentation/interface correction of §A**
(`adr-0015` Consequence 3: "No core algorithm change"); it additionally
**reconciles one invariant — INV3 — and the §Terms `fingerprint`
shorthand to the per-owed-pair-path basis**, closing the internal
contradiction the §A.3 reconciliation would otherwise leave. That
invariant edit is a testable-clause change and carries the `version`
bump 2 → 3 (spec-adversary round 2, 2026-07-18, verified against
`match.mjs`).

**What changed.**

- **§A.1** — the record is re-actored as **machine-assembled**: the
  reviewer supplies only CI-agnostic judgment (verdict + subject +
  findings + producer/reviewer); the **record-emitter** stamps the
  `fingerprint`/`manifest_hashes`/§A.2 envelope by importing the check's
  own basis + fingerprint code; the **harness** posts. The append-only
  bullet's "a reviewer never edits… posts a new one" is re-actored to
  "a record comment is never edited; a correction is a new record."
- **§A.2** — the `fingerprint` row ("recorded by the reviewer over the
  review-class basis") and the `manifest_hashes` row ("over `S`… plus
  the reviewer-resolved upstream") are corrected to
  **machine-stamped by the emitter** over the record's **single-path**
  basis; the `subject` row notes the emitter's one-record-per-path
  fan-out (single element in practice).
- **§A.3** — a **Basis granularity** note pins the per-owed-pair-path
  referent the code enforces (`match.mjs` `evaluatePair` +
  `basis.mjs` `reviewBasis`: `basis = [f]` / `[f, ...U]`); the basis
  table is reconciled from `I = sorted(dedup(S))` /
  `sorted(dedup(S ∪ U(S, C)))` to the per-path `I = [f]` /
  `sorted(dedup([f] ∪ U(f, C)))`; `U(S, C)` → `U(f, C)`; steps 2–3 read
  the single subject path `f`; and the closing paragraph is re-actored
  from "the **reviewer** records `grove-fp-1(I, reviewed-commit)`" to
  "the **emitter** stamps `grove-fp-1(I, C)`… importing the check's own
  code."
- **§A.4** — the authorized-poster bullet gains the `adr-0015` N2 note:
  the poster is now the harness, so **whichever component posts must be
  in `record_poster_allowlist`** (a bot is none of `{OWNER, MEMBER,
  COLLABORATOR}`), else the record is rejected and every owed pair reds.
- **INV3 (freshness by review class)** — the normative freshness basis
  is reconciled from the whole-`S` form ("the subject alone for a
  quality review, `S ∪ U(S, HEAD)` for a fidelity review") to the
  **per-owed-pair-path** form (`[f]` / `[f] ∪ U(f, HEAD)`) that §A.3 and
  `match.mjs evaluatePair` enforce, carrying an inline
  `(Amended 2026-07-18, adr-0015…; was: …)` marker with the prior
  clause. This was **fail-open** as written — for a multi-path record it
  computes one whole-`S` fingerprint and would green a stale pair the
  per-path code reds. Its "shall treat any mismatch as stale, never
  trusting the recorded fingerprint/`manifest_hashes`" clause is kept
  verbatim. This is the sole testable-clause edit and the reason
  `version` bumps 2 → 3.
- **§Terms — two lines.** (1) The **verdict record** definition ("a
  reviewer posts on the PR per review act") was a direct definitional
  dependent of §A.1's actor; corrected to "the reviewer judges, the
  emitter stamps, the harness posts." (2) The **`fingerprint`**
  definition's "`S` or `S ∪ U`" shorthand is aligned to the per-path
  form (`[f]` / `[f] ∪ U(f)`), consistent with INV3 and §A.3. Both keep
  the glossary consistent with the corrected §A (no INV/S renumbered).
- **Frontmatter** — `adr-0015-reviewer-machine-boundary` added to
  `depends_on`; `updated:` already `2026-07-18`. A top-of-file
  five-field delta note (+ VALUE + CONFIDENCE + versioning judgment) is
  prepended; prior notes unedited.

**Why it is faithful to adr-0015.** The actor correction is `adr-0015`
Decision 1–3 (reviewer judges / machine stamps / harness posts) and
Consequence 3 verbatim ("`spec-0002` §A note: the record's `fingerprint`
… is machine-stamped by the emitter, not hand-authored"). The §A.3 basis
reconciliation is Consequence 2 / adversary N3, resolved in the direction
the code fixes: the referents (`lib/emit.mjs`, `lib/basis.mjs`,
`lib/match.mjs` `evaluatePair`), read at HEAD this sitting, all compute
**per subject path `f`**, so `I` is stated as `[f]` / `[f] ∪ U(f, C)`,
not whole-`S`.

**What was deliberately NOT changed.**

- **The check's trust model** (§C.0): recompute fingerprint/`U` at HEAD,
  trust no recomputable agent value — byte-unchanged. No core algorithm.
- **Separation authority** stays the record's `producer`/`reviewer`
  **fields**, not the poster (§C.4, `adr-0012` AC7); the emitter merely
  transcribes them, and forgery stays the conceded §E Layer-B limit.
- **AC10** — records still land on the change request; only the actor
  (emitter stamps, harness posts) is corrected. §A.4 poster-admissibility
  and the §E deletion/forgery concessions stand.
- **Every EARS invariant except INV3, and every GWT scenario, is
  byte-unedited.** INV2 (abstract "recompute fingerprints from PR HEAD
  content"), INV4 (upstream-derivation rule, no basis-set notation), and
  S13 (single-subject worked examples — "basis: the spec alone" / "basis:
  spec + `adr-x`") are already consistent with the per-path form and were
  left untouched; their semantics (S2/S13 staleness) are unchanged. Only
  INV3 carried the whole-`S` freshness notation that **contradicted** the
  reconciled §A.3 in the fail-open direction, so only INV3 (plus the
  §Terms `fingerprint` shorthand, a glossary line) is aligned — the
  minimal edit that closes the contradiction, not a sweep.
- **Which harness component posts** is left parked (`adr-0015` open
  question), per the mandate — the N2 allowlist constraint is stated as
  a wiring requirement without resolving the actor.

| Criterion | Result | Note |
|---|---|---|
| Derives only from the approved decision | PASS | Every §A delta cites `adr-0015` Decision 1–3, Consequence 2–3, or adversary N2/N3; the code referents fix the reconciliation direction. Nothing added beyond the two mandated clauses. |
| Append-only amendment discipline | PASS | New section-level delta note (five fields + VALUE + CONFIDENCE + versioning judgment) prepended; prior notes unedited; no INV/S renumbered. INV3's single-invariant edit carries an inline `(Amended 2026-07-18, adr-0015…; was: …)` marker per `adr-0004`'s scenario-level delta form; the §A prose/tables and the two §Terms glossary lines carry their provenance in the delta note and this self-check. |
| Both grammars intact (`adr-0004`) | PASS-DISCLOSED | Every GWT scenario is byte-unchanged; every EARS invariant except **INV3** is byte-unchanged. INV3's freshness basis is reconciled to the per-path form (marked inline) to close the contradiction the §A.3 edit would otherwise leave; its "shall … stale" obligation is verbatim. Neither grammar stands in for the other. |
| Concretization beyond the decision | PASS | No new requirement invented — the §A.3 basis and the INV3 reconciliation are stated **against the code the check already runs** (`match.mjs`/`basis.mjs`/`emit.mjs`), the machine-stamping is `adr-0015` Consequence 3's own words, and the N2 allowlist note is `adr-0015`'s stated wiring constraint. |
| Traceability | PASS | Consequence 3 → §A.1/§A.2/§A.3 actor; Consequence 2 / N3 → §A.3 basis + INV3; N2 → §A.4 poster note. AC10/AC7 preservation asserted and located (§A.4, §C.4). |
| Versioning discipline (`versioning.md`) | PASS | **Version-significant** — INV3's normative freshness basis is a testable-clause (invariant) edit; `version` **bumped 2 → 3**, durable decision `adr-0015` (which mandated the full §A.3 reconciliation that INV3 completes). Cascade applied in-wave: the ledger pin `plugins/grove/check/test-deps.md` `spec-0002@v2` → `@v3`, and its "whole-`S`… pre-existing discrepancy, not amended here" note reconciled. Because `match.mjs` is already per-path, the corrected INV3 already holds — the pin bump is a mechanical re-verification, **no owed code change**. |
| Status honesty (`lifecycle.md`) | PASS-DISCLOSED | `status: approved` stands on the recorded 2026-07-16 human act; this amendment claims no fresh spec approval — it rides the maintainer's 2026-07-18 `adr-0015` approval, and the bundle goes to their merge gate. No agent flipped any state. |

**Amendment self-check verdict: PASS.** A bounded §A actor correction, a
§A.3 basis reconciliation to the referent the check enforces, and the
single INV3 (+ §Terms `fingerprint`) alignment that completes it — with
the trust model, separation authority, AC10, and every other EARS/GWT
clause untouched. Conformance is not self-declared here — the gates
judge, and `approved` is the maintainer's to give.

### Amendment self-check (2026-07-18, adr-0019 batched-records amendment)

The checks above are the prior sittings' provenance and stand unedited;
this dated subsection is the adr-0019 amendment's own check. The
amendment lifts the **"one comment = one record" packaging cap**: a
comment may now carry several `grove-verdict` blocks, each read as its
own record. It is a **testable-clause change** — §A.1's carrier rule,
INV9, and S7 are re-cast — and carries the `version` bump 3 → 4, durable
decision `adr-0019`.

**What changed (clause by clause).**

- **§A.1 — opening record bullet.** The record is re-framed from "a
  **structured comment on the PR** — one comment per reviewed path" to "a
  **structured `grove-verdict` block on a PR comment** — one **record**
  per reviewed path," with the note that a single comment **may carry
  several such records** and that `adr-0012`'s "one act" binds **the
  block's atomicity, never a one-record-per-comment cap**. The per-file
  record granularity (§A.3) is unchanged — only the block/comment
  relationship is corrected.
- **§A.1 — carrier bullet.** The "a comment containing **more than one**
  `grove-verdict` block is **wholly inert** — one comment is one record"
  concretization is **reversed**: the check reads **each well-formed
  block as its own record**, admitted / selected / freshness-verified
  independently on its own `subject` + `fingerprint`; a block that fails
  §A.2 recognition is **inert on its own** and **never inerts its
  well-formed siblings** (per-block isolation, a **false-RED** avoided —
  `adr-0019` Decision 2); each block stays **one whole record**
  (`adr-0012`'s "one act" at the block, not the comment).
- **§A.1 — selection rule.** Gains a deterministic **within-comment
  block-index tiebreak** for when two records for the same `(f, R)` share
  a comment: order is **comment-id-major, block-index-minor**
  (`adr-0019` Decision 4).
- **§A.1 — block delimitation and index bullet** *(added under the
  spec-adversary finding, 2026-07-18 — see the revision note below).* A
  new bullet **defines the two terms the batching amendment made
  load-bearing but had left undefined**: (a) **block index** —
  document order of opening fences within a comment, **0-based, higher =
  later** ("latest within a comment" = highest index), the referent of
  the §A.1/INV9 tiebreak; and (b) **block delimitation** — a
  `grove-verdict` block runs from its opening fence to the next fence
  line, a bare closing ```` ``` ```` **or the next opening
  ```` ```grove-verdict ```` fence, whichever comes first; a block not
  bare-closed before the next opening fence or end-of-comment is
  **malformed → inert on its own and never absorbs/inerts a following
  block**. This makes the per-block isolation guarantee (`adr-0019`
  Decision 2) satisfiable at the **fence** level, not only the
  §A.2-parse level — an unclosed fence costs at most its own block.
- **INV9.** "or a multi-block comment" is **removed** from its inert
  clause — an unparseable **block** stays inert (including the
  absent/unknown-`schema` case, which is **kept**), but a multi-block
  comment is now several independently-read records; the selection clause
  gains the **block-index tiebreak**. Carries an inline
  `(amended 2026-07-18, adr-0019; was: …)` marker. Its full-pagination,
  session-context-never-counts, and no-mutation/append-only clauses are
  **byte-unchanged**.
- **S7.** Re-cast so a multi-block comment is **no longer** the inert
  case: the inert path is now tested via a **malformed block** (which
  reds absent any covering record), a malformed-block-alongside-a-
  well-formed-sibling case (malformed inert, sibling survives), a
  **fence-level** case (an **unclosed ```` ```grove-verdict ```` fence**
  followed by a well-formed sibling → the unclosed block inert, the
  sibling still a record — added under the spec-adversary finding, the
  corner that proves the isolation guarantee), and a two-well-formed-
  blocks case (two records). The empty-`findings` vacuity half is
  unchanged. Carries an inline amendment marker.
- **§D — `never-reviewed` note.** "multi-block comment" is dropped from
  its inert causes; a **malformed `grove-verdict` block** stays one.
- **Frontmatter.** `adr-0019-batched-verdict-records` added to
  `depends_on`; `version` **3 → 4**; `updated:` already `2026-07-18`. A
  top-of-file five-field delta note (+ VALUE + CONFIDENCE + versioning
  judgment) is prepended; prior notes unedited.

**Why it is faithful to adr-0019.** The multi-block admissibility is
`adr-0019` Decision 1 verbatim ("the check reads every well-formed
`grove-verdict` block in a comment as its own record, admitted /
selected / freshness-verified independently on its own `subject` +
`fingerprint`"); the per-block isolation and the false-RED rationale are
Decision 2; the block-index tiebreak (comment-id-major, block-index-
minor) is Decision 4; the four moved-together clauses are the decision's
Consequence 1 and round-2 sweep (§A.1, INV9, S7, §D) — moved together so
no standing clause forbids what another permits (the round-1 finding,
AC1). Each block staying "one whole record" is `adr-0012`'s "one act"
preserved at the block level per the Relationship section.

**What was deliberately NOT changed.**

- **The §A.2 record schema** — the field table, `schema: 1`
  inert-on-unknown, and the per-record single `fingerprint`/`subject`
  model are untouched (a record is still one whole block).
- **The §A.3 fingerprint basis** — the per-owed-pair-path basis (`[f]` /
  `[f] ∪ U(f, C)`, one fingerprint per record) is untouched; per-file
  surgical freshness (INV3) is exactly why the per-file record model
  stays and only the comment packaging changed.
- **The §C.0 / §C trust model** — the check still recomputes everything
  and trusts no emitted value; `manifest_hashes` stays reason-naming
  only. No trust-boundary row changed.
- **§A.4 poster/edit admissibility** — **edit-rejection stays
  whole-comment**: an edit to a batched comment rejects **all** its
  records, which is correct and fail-closed (records are never
  legitimately edited; a correction is always a **new** comment). Poster
  admissibility is per-comment and applies uniformly to every block.
- **INV9's other clauses** — full-pagination (truncated read reds),
  session-context-never-counts, and no-mutation/append-only — byte-
  unchanged.
- **Every other EARS invariant and GWT scenario** is byte-unedited; only
  the four clauses that declared a multi-block comment inert (§A.1, INV9,
  S7, §D) moved.
- **The emitter/skill batching** (`record-verdict` one-comment-per-review)
  and the `lib/records.mjs` / `lib/match.mjs` code changes are `adr-0019`
  Consequence 2–4 — downstream executor deliverables, not authored here.

| Criterion | Result | Note |
|---|---|---|
| Derives only from the approved decision | PASS | Every delta cites `adr-0019` Decision 1–2/4, Consequence 1, or AC1/AC3; nothing added beyond the four mandated clauses. |
| Append-only amendment discipline | PASS | New section-level delta note (five fields + VALUE + CONFIDENCE + versioning judgment) prepended; prior notes unedited; no INV/S renumbered. INV9 and S7 carry inline `(amended 2026-07-18, adr-0019; was: …)` markers per `adr-0004`'s scenario-level delta form; the §A.1 prose bullets and the §D note carry their provenance in the delta note and this self-check. |
| Both grammars intact (`adr-0004`) | PASS | INV9 (EARS) and S7 (GWT) each re-cast in their own grammar; neither stands in for the other. Every other INV/S byte-unchanged. |
| Cross-consistency (no standing multi-block-inert clause) | PASS | The decision's round-2 sweep found exactly four clauses (§A.1, INV9, S7, §D); all four amended together. A post-edit read finds no remaining "multi-block comment ⇒ inert" claim — the surviving "one act" mentions now bind the block, and the top-of-file notes' "one comment = one record" strings are dated provenance, not standing rules. |
| Concretization beyond the decision | PASS | No new requirement invented — multi-block admissibility, per-block isolation, and the block-index tiebreak are `adr-0019`'s own Decisions; the `false-RED` framing is Decision 2's wording. |
| Traceability | PASS | Decision 1 → §A.1 carrier + INV9 inert clause; Decision 2 → per-block isolation (§A.1, INV9, S7); Decision 4 → §A.1/INV9 tiebreak; Consequence 1 → the four-clause move; preservation (schema/basis/trust/§A.4) asserted and located. |
| Versioning discipline (`versioning.md`) | PASS | **Version-significant** — §A.1's carrier rule, INV9, and S7 are re-cast (an admissibility/selection change); `version` **bumped 3 → 4**, durable decision `adr-0019`. Cascade: the ledger pin `plugins/grove/check/test-deps.md` `spec-0002@v3` → `@v4`, its note reconciled. Unlike the adr-0015 bump, this one **owes a code change** (`records.mjs` multi-block rejection removal + `match.mjs` tiebreak — `adr-0019` Consequence 2–3). |
| Status honesty (`lifecycle.md`) | PASS-DISCLOSED | `status: approved` stands on the recorded 2026-07-16 human act; this amendment claims no fresh spec approval — it rides the maintainer's 2026-07-18 `adr-0019` approval, and the bundle goes to their merge gate. No agent flipped any state. |

**Amendment self-check verdict: PASS.** A bounded four-clause lift of the
packaging cap — §A.1, INV9, S7, and the §D `never-reviewed` note moved
together — with the §A.2 schema, the §A.3 fingerprint basis, the §C.0
trust model, §A.4 admissibility, and every other EARS/GWT clause
untouched. Conformance is not self-declared here — the gates judge, and
`approved` is the maintainer's to give.

**Revision (2026-07-18, same amendment — spec-adversary NEEDS-REVISION
applied pre-merge; `version` stays `4`).** The spec-adversary gate found
one load-bearing gap: the batching amendment made **intra-comment block
boundaries** normative in two new places (the §A.1/INV9 selection
**block-index tiebreak** and the **per-block isolation** guarantee) but
left both underlying terms undefined — "block index" had no direction or
base, and **block delimitation** was unspecified, so the isolation
guarantee had an uncovered corner: verified against
`plugins/grove/check/lib/blocks.mjs`, extraction is line-based and an
opening ```` ```grove-verdict ```` fence does **not** close a prior
block, so an **unclosed** fence would swallow the following well-formed
sibling — the exact one-typo false-RED the guarantee promises to
prevent. Two in-scope completions of `adr-0019` Decision 2/4 (not new
scope) close it: (1) a new **§A.1 "Block delimitation and index"
bullet** defines block index (document order of opening fences, 0-based,
higher = later; "latest" = highest) and block delimitation (a block runs
to the next fence line — bare close **or** next opening fence, whichever
first; an unclosed block is malformed → inert on its own and never
absorbs/inerts a following block); (2) **S7** gains the fence-level case
(unclosed fence + well-formed sibling → unclosed inert, sibling still a
record). Nothing else changed; the four inert-clause moves stand as
authored. Per the coordinator's note, this delimitation rule also obliges
a Wave-2 change to `blocks.mjs extractFencedBlocks` (an opening fence must
terminate a prior unclosed block) beyond `records.mjs:71` — scoped to the
executor, not touched here. No re-judgment of the adversary verdict is
claimed — the gate re-judges; `status: approved` still rests on the
recorded 2026-07-16 human act plus the `adr-0019` ride-along.
