---
id: spec-0003-review-asks-and-audit
type: spec
status: approved  # agent-owned spec gate (steward profile, .grove/gates.toml spec=agent; adr-0020) — flipped 2026-07-19 on spec-adversary round-2 APPROVE-READY (round 1 NEEDS-REVISION, 3 blocking + 6 non-blocking folded at c330b5c); producer (contract-author) ≠ reviewer (spec-adversary) ≠ gate-recorder (dispatcher); residual one-line wording notes recorded in the verdict, owed at next touch
implements: adr-0023-review-triage-blackboard  # the shadow contract adr-0023 Consequences item 1 defines
depends_on: [adr-0023-review-triage-blackboard, spec-0002-review-bookkeeping-check, adr-0019-batched-verdict-records, adr-0015-reviewer-machine-boundary]  # builds-on: adr-0023 (the authorizing decision, approved 2026-07-19); spec-0002@v4 (the registry substrate — §A record grammar, grove-fp-1, §A.4 admissibility — consumed WHOLESALE, never amended here); adr-0019 (batched records: one comment per pass, per-block isolation); adr-0015 (the judgment/stamp split, applied here to the audit record itself)
owner: agent
updated: 2026-07-19
version: 1
status_note: authored from the approved adr-0023 (D1–D7); self-checked to gated per the rubric check below. Shadow contract only — nothing here changes the shipped gate; the flip is adr-0023 D6's future decision.
---

# spec-0003 — review-asks and the audit record (shadow contract)

The contract for `adr-0023`'s shadow adoption (phases 0–2, grove-self
only, report-only): two new **append-only record classes** on the PR
comment stream — the producer's `grove-review-ask` (D2) and the
in-session auditor's `grove-audit` (D4) — two **deterministic residue
sets** derived from them (D4), and a **report-only shadow comparator**
(D5). Everything here is **additive to and inert under**
`spec-0002-review-bookkeeping-check` (@v4): the shipped check keeps
gating exactly as today, and no clause of spec-0002 is amended by this
spec (adr-0023 D1, Consequence 1).

> This spec constrains machinery, not judgment. The record grammars,
> residue set-math, freshness bindings, and admissibility rules below
> are deterministic and recomputable; the auditor's per-file
> dispositions are judgment, carried as disclosed self-reported content
> on the same trust tier as spec-0002 §A.2's `producer`/`reviewer`
> fields. During shadow, every property defined here is **evaluated and
> reported, never gated on** — the gate stays spec-0002's, byte-for-byte
> (§F, INV1).

## Terms

| Term | Meaning |
|---|---|
| **shipped check** | The spec-0002 check as deployed (`plugins/grove/check`, the `grove review-bookkeeping` workflow). The only gate during shadow. |
| **stream** | The PR's comment stream, read via the platform API, paginated to exhaustion (spec-0002 §A.4). The only carrier for all record classes. |
| **comment order** | Platform comment creation order (monotone comment id), tie-broken by 0-based block index within a comment — comment-id-major, block-index-minor (spec-0002 §A.1, `adr-0019`). |
| **`diff_files`** | The HEAD-present paths of the PR's merge-base…HEAD diff, exactly the spec-0002 §C.2 derivation walk: a deleted path — including a rename's old path — contributes no entry. |
| **in-jurisdiction** | In `strict` mode (grove-self today): every member of `diff_files`. In `scoped` mode: the spec-0002 §C.2 step-0 in-scope subset. Cited from spec-0002, not respelled. |
| **effective coverage** | An ask record covers a subject path `s` **effectively** iff the record is admissible (§A.4-inherited) and schema-valid, `s` normalizes (spec-0002 §Terms path normalization), and neither §A.3 hard rule inerts `s` for that record. |
| **`ask_covered_files`** | The union of effectively covered subject paths over every ask record in the stream. A subject outside `diff_files` is harmless surplus — it enters no set below (all sets intersect the diff by construction). |
| **coverage residue (`R_cov`)** | `diff_files ∖ ask_covered_files` — pure set difference, deterministic (adr-0023 D4, decision-adversary F1). |
| **judgment residue (`R_judg`)** | `{ f ∈ R_cov : f is in-jurisdiction ∧ f's HEAD frontmatter carries no `type:` declaration }` — the stack's tail: resolved by **neither** asks **nor** frontmatter typing. The **only** set the auditor's judgment touches. |
| **typed record stream** | The comments carrying at least one `grove-review-ask` or `grove-verdict` opening fence — any **exact-tag** fence per spec-0002 §A.1's tokenizer, its block well-formed or not; a misspelled tag never registers (§C.3, N4). `grove-audit` blocks and prose comments are **not** members (adr-0023 D4, fail-open F6). |
| **HWM** | High-water mark: the highest comment id whose typed-record-stream blocks the auditor read. |
| **policy carriers** | The protected-branch policy sources the audit's policy fingerprint binds: `charters/review-policy.md` (the `grove-review-policy` block source) **plus every reviewer-declaration file the spec-0002 §C.1 assembly discovers at the protected-branch commit** — today `charters/conformance-reviewer.md`, `charters/decision-adversary.md`, `charters/spec-adversary.md`, `charters/code-reviewer.md`. Membership is discovered, not hardcoded: a fifth declaration file changes the set, hence the fingerprint. |
| **comparator** | The report-only phase-2 evaluator (§D). It writes a log report; it never writes a verdict. |

Path normalization, `grove-fp-1`, block delimitation/indexing, and §A.4
admissibility are **inherited from spec-0002 (@v4) by reference** —
this spec adds no variant of any of them.

---

## §A — The `grove-review-ask` record class (adr-0023 D2)

### A.1 Carrier and block grammar

- An ask record is a **fenced code block tagged `grove-review-ask`**
  containing YAML per §A.2, on a PR comment — the structural sibling of
  spec-0002 §A.1's `grove-verdict` block. Surrounding prose is
  permitted; only the block is the record.
- **Block delimitation, indexing, and per-block isolation are
  spec-0002 §A.1's, verbatim by reference** (`adr-0019`): a comment may
  carry several `grove-review-ask` blocks; each well-formed block is
  its own record; a malformed or unclosed block is inert **on its own**
  and never inerts a well-formed sibling; blocks are ordered by
  document-order index.
- A block that does not parse against §A.2 — including absent or
  unknown `schema` — is **inert**: never a record, covers nothing
  (fail-closed by non-recognition).
- Ask blocks are **invisible to the shipped check**: its extractor
  reads `grove-verdict` fences only, so an ask block can neither
  satisfy, red, nor perturb any spec-0002 rule (verified against
  `plugins/grove/check/lib/blocks.mjs` / `lib/records.mjs`; INV1).

### A.2 Schema (YAML, inside the `grove-review-ask` block)

Every field required unless marked optional.

| Field | Type | Meaning |
|---|---|---|
| `schema` | int | Exactly `1`. Absent or ≠ 1 ⇒ the block is inert (fail-closed by non-recognition; a future value requires a revision of this spec). |
| `producer` | string | Self-reported role id that produced the subjects (same trusted-self-reported tier as spec-0002 §A.2 `producer`; spec-0002 §E's forgery concession applies unchanged). |
| `type` | string | **One declared type for every subject in this block** — the batch-per-type shape, pinned (concretization, flagged): adr-0023 D2 says "the produced type", singular per ask; a pass producing **mixed types posts several blocks in one comment** (§A.4 batching), never one block with per-subject types. Compared to frontmatter by exact string equality after trimming. |
| `subject` | list\<path\> | Non-empty; normalized repo-relative paths per spec-0002 §Terms. A path that cannot be normalized matches nothing (fail-closed by non-match). Subjects are **repo tree files only** — a PR body, comment, or issue is never a subject. |
| `annotations` | string (optional) | Free text, **advisory-only**: input a reviewer may read, never instruction it follows — the reviewer's findings state its own depth decision and evidence basis, never the ask's framing (adr-0023 D3, fail-open F8's steering guard). No machinery reads this field. |
| `resumed_by` | string (optional) | Set by a **resumed pass** (§A.4): the resuming role's id (`run-resumer`), alongside `producer` naming the resumed role — **dual attribution**, consumed only by §C.4's separation set `P` (concretization, flagged; spec-adversary round 2, N5). Same trusted-self-reported tier as `producer`. |

**Deliberately absent fields** (each a design fact, not an omission):

| Absent | Why |
|---|---|
| `reviewer` / any target | Asks are **untargeted** (D2): matching is emergent, via the reviewers' existing `grove-review-declaration` `types` read from the protected branch. A specialized reviewer costs one declaration and zero producer edits (grove#43). |
| `fingerprint` / `manifest_hashes` | An ask declares an **obligation**, not a content attestation. Content freshness stays entirely the `grove-verdict` records' business (spec-0002 §A.3); an ask never goes stale and never claims freshness. |

### A.3 Effectiveness — the hard rules (adr-0023 D2, all deterministic)

An ask can only **add** obligations, never remove them. Two rules make
a schema-valid record ineffective per-subject:

1. **An ask may never name a reviewless type** (fail-open F3 — the
   self-service exemption door, closed). A block whose `type` is
   positively declared reviewless in policy (`reviewless_types`, read
   from the protected branch) is **ineffective for every subject** —
   since the block carries one type, all its subjects are inert rows.
   Each such subject is surfaced as a **flagged row** (§C.1 `flagged`,
   §D report) and is **not** ask-covered — it falls to `R_cov`, never
   to silence.
2. **For a frontmatter-bearing subject, the frontmatter type wins.**
   Where subject `s`'s HEAD frontmatter carries any `type:` declaration
   (recognized or not — the spec-0002 §C.2 type basis) and it differs
   from the block's `type`, the ask is **ineffective for `s`** (inert
   for that file only; siblings in the same block unaffected), surfaced
   as a flagged row **and an audit finding** — never a precedence roll
   (human-heavy A5). `s` is not ask-covered by that record; it remains
   frontmatter-resolved, so it never reaches `R_judg`.

**Both rules may fire for one (record, subject) pair** — a
reviewless-typed block naming a frontmatter-bearing subject whose type
differs trips rule 1 (block-wide) *and* rule 2 (that subject). The pair
then emits **both** causes as **separate flagged rows**
(`reviewless-type` and `frontmatter-divergence`, §C.1 `flagged`) —
deterministic and fail-closed-visible; neither cause suppresses the
other, so no two implementations can differ on the flagged surface
(pinned per spec-adversary round 2, F1).

Everything else is additive and fail-closed:

- An effective ask whose `type` matches no reviewer declaration (and is
  not reviewless) derives the **full review set** for its subjects —
  spec-0002 INV7's unclaimed-type rule in blackboard form (adr-0023
  D3). Never an empty set.
- **Several effective asks, one subject: fail-closed UNION.** Two
  effective asks may declare different types for one frontmatterless
  subject (guaranteed possible: a correction is a new comment, §A.4;
  rule 2 arbitrates only ask-vs-frontmatter). The subject's ask-derived
  owed set is then the **union of every effective ask type's owed
  sets** — never latest-wins, which would let a correction **shrink**
  obligations and violate D2's asks-add-never-remove; the union can
  only add. This is the derivation §D.1's metrics 1–2 compute over
  (pinned per spec-adversary round 2, F3).
- **Ask absence is signal, not permission**: an in-jurisdiction diff
  file no ask effectively covers falls to the residue (§B), never to
  silence. Out-of-jurisdiction silence under `scoped` mode remains
  spec-0002/adr-0013's standing design, untouched.

### A.4 Posting rules and who owes asks

- **Batched, one comment per producer pass** (`adr-0019` applied to
  asks): a pass posts **one** comment carrying all its ask blocks
  (one block per produced type). Posting is the `record-ask` skill's
  job (structural sibling of `record-verdict`; adr-0023 Consequence 2 —
  the skill is a downstream deliverable, these are the rules it must
  satisfy).
- **Append-only.** An ask comment is never edited; a correction is a
  **new** comment. Spec-0002 **§A.4 admissibility is inherited whole**:
  whole-comment edit rejection (an edit rejects every block on the
  comment), the record-poster allowlist / `author_association` default,
  full-stream pagination with fail-closed read errors, and the conceded
  deletion limit — nothing re-spelled, nothing softened.
- **Who owes asks** (adr-0023 D5 phase 0; the two remediation calls are
  this spec's to make, per D5):

| Role | Duty |
|---|---|
| `executor`, `shaper`, `contract-author` | **Unconditional closing ask** — every pass ends by posting its ask batch. Convention, not judgment (the mini-PR rule: always ask). |
| `divergent-researcher` | **No-op** — its output is reviewless-typed (`research`); §A.3 rule 1 forbids an ask naming it, and its files stay frontmatter-resolved. It posts nothing. |
| `run-resumer` | **In, by inheritance** (ruled here): it completes another role's pass, so it owes **the resumed role's** closing ask for the pass's tree edits — never an ask in its own name. Its ask carries `producer: <resumed-role>` **and** `resumed_by: run-resumer` (§A.2 dual attribution, feeding §C.4's `P` — so, provided the duty-mandated field is posted, it cannot pass auditor separation on work it produced; N5). Rationale: otherwise a max-turns death becomes an ask-exemption door — a self-exemption channel by crash, the class D2 closes. |
| `propagation-remediator` | **In, when tree-touching** (ruled here): it owes an ask for any repo tree file its pass commits (e.g. a parked-item retirement). A pass editing only the PR body or comments commits no subject and posts none. Rationale: the condition is mechanical (did the pass commit tree files?), not a quality judgment — D2's convention-not-judgment holds; a role class whose tree output never asks would reopen the door D2 closed. |

Both remediation rulings add their charter lines to the phase-0 build
set (adr-0023 Consequence 2, extended by the delegated call). Ask
absence remains fail-closed regardless: an unasked file falls to the
residue.

---

## §B — The two residues (adr-0023 D4; decision-adversary F1)

### B.1 Definitions (both deterministic; see Terms for the set-math)

| Set | Definition | Who touches it |
|---|---|---|
| **`R_cov`** — coverage residue | `diff_files ∖ ask_covered_files`. | Purely mechanical: the audit record's manifest (§C.2) **is** this set; the shared evaluator recomputes the same set difference from the stream + git content, so "auditor missed a file" is mechanically impossible (fail-open F2). |
| **`R_judg`** — judgment residue | `{ f ∈ R_cov : f in-jurisdiction ∧ no HEAD frontmatter `type:` }`. | The **only** set the auditor's judgment layer touches (per-file dispositions, §C.2). A frontmatter-typed file — matching ask or none, divergent ask included — is deterministically resolved and never reaches it. |

`R_judg ⊆ R_cov ⊆ diff_files`, always. In grove-self's `strict` mode,
in-jurisdiction = `diff_files`, so `R_judg` is exactly the unasked,
untyped diff files. **In the ask lane**, judgment thereby runs only
where a producer session was present to post records, and only where
there is something to judge (D4). The residue exception, stated
honestly: a record-free push touching an untyped in-jurisdiction file
still yields `R_judg ≠ ∅` with no session present — the owed audit is
then the maintainer side's to run (§B.2), and during shadow its absence
is only a reported fact.

### B.2 The residue-conditional rule (adr-0023 D4; human-heavy F1)

**A PR whose `R_judg` is empty owes NO audit record** and greens under
the deterministic lane exactly as today. Spelled out:

- **Human push**: a maintainer pushes a PR touching only
  frontmatter-typed artifacts (or, in a `scoped`-mode consumer repo,
  only out-of-jurisdiction application code). No asks exist; every
  in-jurisdiction file is frontmatter-resolved (or the jurisdiction is
  empty) ⇒ `R_judg = ∅` ⇒ no audit owed. The PR's UX is zero-LLM and
  byte-identical to today (D1's corollary: the table + scoped
  jurisdiction are the permanent no-ask floor).
- **Fork PR**: an outside contributor — who could not post an
  admissible record anyway (spec-0002 §A.4 `author_association`
  default) — never hits the admissibility wall on an audit they cannot
  post: with `R_judg = ∅` none is owed; with `R_judg ≠ ∅`, the owed
  audit is the maintainer side's to run, never the poster's burden.
- Non-empty `R_judg` ⇒ an audit record is **owed** (during shadow: its
  absence is a comparator-reported fact, never a red — §D, §F).

---

## §C — The `grove-audit` record class (adr-0023 D4)

### C.1 Carrier and schema

Carrier, delimitation, per-block isolation, and inertness-by-
non-recognition: identical to §A.1, tag **`grove-audit`**. Fields (YAML;
required unless marked optional):

| Field | Type | Supplied by | Meaning |
|---|---|---|---|
| `schema` | int | — | Exactly `1`; absent/≠ 1 ⇒ inert. |
| `auditor` | string | auditor | Self-reported role id (trusted-self-reported tier, spec-0002 §C.4 — no new concession class). |
| `coverage_residue` | map path → sha256 | **emitter** | The machine-stamped manifest: every member of `R_cov` at the audited HEAD, with its per-path blob content hash. May be empty (`R_cov = ∅` with a still-owed audit cannot occur — `R_judg ⊆ R_cov` — but an all-typed asked-partially PR can have `R_judg = ∅ ⊂ R_cov`; an audit posted anyway is legal surplus). |
| `content_fingerprint` | string | **emitter** | `grove-fp-1` over **`diff_files`** at the audited HEAD (blob-byte basis — a no-op rebase stays fresh; fail-open F7). |
| `policy_fingerprint` | string | **emitter** | `grove-fp-1` over the **policy carriers** (Terms) at the protected-branch commit the audit read — a post-audit policy change on `main` stales the audit (fail-open F5). |
| `record_hwm` | int | **emitter** | The HWM: highest comment id whose typed-record-stream blocks were read. **Empty-stream sentinel, pinned**: over a typed-record-free stream (S6's own case), `record_hwm: 0` — under which any future typed comment stales, fail-closed (spec-adversary round 2, F2). |
| `flagged` | list (may be empty) | **emitter** | The §A.3 inert-per-subject rows, machine-derived: `{path, cause: reviewless-type \| frontmatter-divergence, comment: <id>}` — **one row per inert (record, subject, cause) triple**: where both §A.3 rules fire for one pair, **both causes emit as separate rows**, neither suppressing the other (§A.3; F1). Recomputable from the stream — never the auditor's claim. |
| `dispositions` | map path → `{owed, why}` | **auditor** (judgment), transcribed by the emitter | One entry per member of `R_judg`: `owed` — a list of review ids this file should owe (may be empty, meaning "owes nothing", stated); `why` — non-empty free text, the evidence basis. |
| `findings` | string (optional) | auditor | Overall findings prose (e.g. naming the frontmatter-divergence findings in words). |
| `audited_at_commit` | string (optional) | emitter | Informational only; the fingerprints are the freshness authority, never this field. |

### C.2 The judgment/stamp split (adr-0015, applied to the audit itself)

The **auditor** supplies only judgment: `auditor`, `dispositions`
(`owed` + `why`), `findings`. The **emitter** — importing the check
package's own `groveFp1`, block, and admissibility code (adr-0023
Consequence 3) — stamps every machine-computable field:
`coverage_residue`, `content_fingerprint`, `policy_fingerprint`,
`record_hwm`, `flagged`. The **harness** posts. Each stamped field is a
CI-recomputable **fact**, not a claim (D1's repair pattern): the shared
evaluator recomputes the set difference, both fingerprints, and the
flagged rows from the stream + git content and reports any mismatch
(§D; post-flip gating semantics are D6's, not this spec's). The
emitter stamps `record_hwm` over the **same comment-stream snapshot the
auditor derived from** — one read, one watermark; a typed comment
landing between that read and the post is past the HWM and stales
(§C.3), never silently absorbed (N3).

The auditor is **cold-started**: its record must be derivable from the
blackboard alone — the record stream, the diff, and protected-branch
policy — never from session conversation ("a review the dispatcher
remembers ran does not count"; spec-0002's session-context-never-counts
rule, one level up).

### C.3 Freshness (evaluated, and during shadow only reported)

An audit record is **fresh** iff all three hold:

1. **Content**: `grove-fp-1(diff_files, HEAD)` recomputed at the
   current HEAD over the current `diff_files` equals
   `content_fingerprint` (membership or content change ⇒ stale; a
   no-op rebase preserving every blob ⇒ fresh). Deleting a
   `diff_files` member changes membership and stales; a
   **deletions-only push** removing previously-unchanged files leaves
   `diff_files` unchanged and the audit fresh — a deleted path
   contributes no HEAD-present entry (Terms), and deletion governance
   stays the deterministic lane's (spec-0002 S12's ABSENT-sentinel
   rule), disclosed, not conceded silently (N6).
2. **Policy**: `grove-fp-1(policy carriers, protected-branch commit)`
   recomputed at the current protected-branch commit equals
   `policy_fingerprint` (carrier content **or membership** change ⇒
   stale — a fifth reviewer-declaration file changes the set).
3. **Stream**: no comment with id > `record_hwm` carries a
   `grove-review-ask` or `grove-verdict` opening fence — a
   **recognized (exact-tag) fence whose block is malformed or
   unclosed still stales**, fail-closed in the invalidating direction,
   though it satisfies nothing; a **typo'd tag never registers** as a
   typed fence under the inherited exact-tag tokenizer (spec-0002
   §A.1), and therefore neither covers nor stales (N4). **Prose
   comments and `grove-audit` blocks never invalidate** (fail-open F6
   — audits are excluded from the invalidating class; a later audit
   supersedes by selection, §C.5, not by staling).

### C.4 Admissibility

Spec-0002 **§A.4 inherited whole** (unedited whole-comment, authorized
poster, full pagination, deletion conceded), **plus one rule**:

- **Auditor separation** (adr-0023 D4): let `P` = the set of `producer`
  values **plus every ask record's `resumed_by` value** (§A.2 dual
  attribution — a run-resumer that produced tree edits on the PR enters
  `P` under both ids, so — provided the duty's field is posted — it
  cannot pass auditor separation on work
  it produced; N5) of every **schema-valid** `grove-review-ask` and
  `grove-verdict` block in the full stream (admissible or not —
  rejection never un-produces). If `auditor ∈ P`, the audit record is
  **inadmissible**. Same trusted-self-reported tier as spec-0002 §C.4;
  forgery — and passive omission of a self-reported field, its weaker
  form — stays the disclosed Layer-B limit; no new concession class.

### C.5 Selection and the vacuity rule, one level up

- **Selection**: the latest admissible schema-valid `grove-audit`
  record by comment order (comment-id-major, block-index-minor) is
  **the** audit for the PR; earlier ones are superseded, visible,
  never deleted.
- **Vacuous evidence, one level up** (adr-0023 D4): a per-`R_judg`-file
  disposition is required. A file in the recomputed `R_judg` with no
  `dispositions` entry, or one whose `why` is empty/whitespace, is
  **unsatisfied by this audit** — the audit covers it not at all. An
  audit whose every disposition is vacuous satisfies nothing. An empty
  body never satisfies.

---

## §D — The shadow comparator (adr-0023 D5, phase 2)

### D.1 The five per-PR metrics (report-only)

To compare, the comparator derives the **audit-side owed set**: for
effectively ask-covered files, the **union over every effective ask
type** of the reviews that type owes (§A.3's union rule;
protected-branch declarations; unclaimed ⇒ full set per §A.3); for
frontmatter-typed files, the table's own derivation (identical by
construction); for `R_judg` files, each non-vacuous disposition's
`owed` list. The **table-side owed set** is spec-0002 §C.2's, read from
the shipped check's own derivation — never re-derived by a second
implementation.

| # | Metric | Definition |
|---|---|---|
| 1 | **table-owed rows the audit omits** (candidate false positives) | Owed pairs `(f, R)` in the table-side set absent from the audit-side set — including pairs on `R_judg` files with vacuous/missing dispositions. |
| 2 | **audit-owed rows the table missed** (candidate false negatives) | Owed pairs in the audit-side set absent from the table-side set. |
| 3 | **no-ask diff files** (convention-break rate) | `|R_cov|` and `|R_cov| / |diff_files|`. When `diff_files = ∅` (a deletions-only PR), rendered as `0/0 (empty diff)` with the ratio omitted — never a division (N1). |
| 4 | **audit-fresh-at-HEAD** (the flip-day red rate) | One of `no-audit-owed` (`R_judg = ∅`), `owed-and-absent`, `stale` (naming which §C.3 binding failed), `fresh`. |
| 5 | **HWM races** | Count of comments past the selected audit's `record_hwm` carrying typed-record-stream blocks. |

The report also lists the `flagged` rows (§A.3) and any mismatch
between a stamped audit field and its recomputation — as findings,
never verdicts.

### D.2 Report location and byte-identity (adr-0023 AC3 — the load-bearing regression guard)

- **Where the report lands, pinned**: the **log output (stdout) of the
  existing `grove review-bookkeeping` workflow run** — a log-only step
  or pass inside the same run (the existing `issue_comment` re-trigger
  already re-fires it when records post; adr-0023 Consequence 4). The
  comparator **never** writes to the job summary
  (`GITHUB_STEP_SUMMARY` — the rendered status view), the exit code,
  a commit status, a label, or any PR comment.
- **Byte-identity**: for any given PR state, the shipped check's
  verdict, exit code, and rendered §D status view are **byte-identical
  with and without** `grove-review-ask` / `grove-audit` records present
  in the stream, and with and without the comparator running — the
  spec-0002 INV19 byte-identity discipline, applied here as this spec's
  own explicit invariant (INV1). Ask/audit blocks are inert to the
  shipped check by fail-closed non-recognition (§A.1).

---

## §E — The precedent-log home, ruled (adr-0023 D7)

**Confirmed**: `charters/review-precedents.md` is the **durable** home
of the D7 precedent log — the interim home (adr-0023 Consequences
item 0's discovery) is ratified as final, not moved. Grounds:

1. D7's named `reference/review-precedents.md` does not resolve: no
   root `reference/` exists, and the payload `reference/` dir holds
   only vendored copies — an original there would violate that
   convention.
2. The **companion convention** already holds every non-role normative
   companion in `charters/` (`lifecycle.md`, `versioning.md`,
   `relations.md`, `review-policy.md`); the precedent log is exactly
   that class (not a role, never dispatched).
3. `charters/` is under `artifact_dirs`, so the log sits inside the
   artifact index and the check's jurisdiction in both modes — the
   case-law corpus the auditor's judgment layer consumes is itself
   governed, and single-homed for dispatch-time and CI-time judgment
   alike (grove#97 shared-evaluator addendum).

The file's own rules (append-only; one entry per overrule; precedent,
not policy) stand as written there; this spec adds none.

---

## §F — Non-goals and scope boundaries (explicit)

| Non-goal | Standing truth |
|---|---|
| **Changing the gate** | adr-0023 D1's conjunction is a **design constraint honored**, not re-specified here: CI green ⇔ (deterministic checks pass) ∧ (fresh, admissible audit covers the judgment residue) is the **post-flip** shape; during shadow the gate is the deterministic conjunct **alone**, exactly today's shipped check. Nothing in this spec is a gate input. |
| **Amending spec-0002** | No §A/§B/§C clause, INV, or scenario of spec-0002 (@v4) is amended, re-spelled with variation, or softened. This spec **cites** its grammar (§A.1 delimitation, §A.4 admissibility, `grove-fp-1`, path normalization, §C.2 jurisdiction) by reference. |
| **Flip semantics** | When/whether audits gate, what reds on a stale audit, the release-valve prerequisite — all adr-0023 D6's parked future decision. This spec defines the records and sets that decision will consume; it decides none of it. |
| **Consumer installs / math-quest** | grove-self only (D5). No consumer `.grove/` machinery, no math-quest migration before its declared #309 boundary. Lockstep skew stays accepted-and-disclosed per D5. |
| **Tier-2 headless judge** | Out of scope (D6 prerequisite territory). |
| **Reviewer depth-triage prose; precedent-log seeding** | adr-0023 Consequences item 0 — landed with the decision's own PR, not owed here (§E only *rules the home*). |

---

## Acceptance criteria

### Invariants (EARS)

- **INV1 (inert to the shipped check; byte-identity — adr-0023 AC3).**
  The shipped check **shall not** recognize `grove-review-ask` or
  `grove-audit` blocks, and its verdict, exit code, and rendered status
  view **shall** be byte-identical for a given PR state with and
  without such blocks present and with and without the comparator
  running.
- **INV2 (ask carrier).** Ask records **shall** be read only from the
  PR's comment stream under spec-0002 §A.1's block delimitation: each
  well-formed `grove-review-ask` block **shall** be its own record; a
  malformed, unclosed, or schema-invalid block **shall** be inert on
  its own and **shall not** inert a well-formed sibling.
- **INV3 (additive-only).** Evaluation of ask records **shall** only
  ever add candidate obligations or leave the derived sets unchanged;
  no ask **shall** remove, reduce, or soften any obligation the
  spec-0002 derivation yields; and where several effective asks declare
  different types for one subject, the subject's ask-derived owed set
  **shall** be the union of every effective ask type's owed sets —
  never latest-wins (a correction **shall not** shrink obligations;
  §A.3's union rule).
- **INV4 (reviewless hard rule).** An ask block whose `type` is
  policy-declared reviewless **shall** be ineffective for every
  subject; each such subject **shall** be surfaced as a flagged row and
  **shall not** be ask-covered; and where such a block's subject also
  bears a divergent frontmatter type, **both** causes **shall** emit as
  separate flagged rows (§A.3's both-fire rule), neither suppressed.
- **INV5 (frontmatter wins).** For a subject whose HEAD frontmatter
  carries any `type:` declaration differing from the ask block's
  `type`, the ask **shall** be ineffective for that subject only,
  surfaced as a flagged row and an audit finding; the check-side
  derivation **shall** use the frontmatter type — never the ask's.
- **INV6 (untargeted).** The ask schema **shall** carry no reviewer or
  target field; review matching **shall** be via the
  `grove-review-declaration` types read from the protected branch.
- **INV7 (unclaimed ask type, fail-closed).** An effective ask whose
  `type` is claimed by no reviewer declaration and not declared
  reviewless **shall** derive the full review set for its subjects,
  never an empty set.
- **INV8 (ask posting).** A producer pass **shall** post its asks
  batched in one comment (one block per produced type); ask comments
  **shall** be append-only (a correction is a new comment); spec-0002
  §A.4 admissibility **shall** apply unchanged to ask comments.
- **INV9 (coverage residue, recomputed).** `R_cov` **shall** equal
  `diff_files ∖ ask_covered_files`, recomputed by the shared evaluator
  from the stream and git content; the audit's `coverage_residue`
  manifest **shall never** be trusted for the sets, and any
  manifest-vs-recomputation mismatch **shall** be reported by the
  comparator.
- **INV10 (judgment residue).** `R_judg` **shall** equal the
  in-jurisdiction members of `R_cov` whose HEAD frontmatter carries no
  `type:` declaration; no other file **shall** ever require a
  disposition.
- **INV11 (residue-conditional — adr-0023 AC4).** Where `R_judg` is
  empty, no audit record **shall** be owed and the PR **shall** green
  under the deterministic lane exactly as today; where `R_judg` is
  non-empty, an audit record **shall** be owed (during shadow, its
  absence **shall** be a reported fact, never a red).
- **INV12 (stamped bindings).** The emitter **shall** stamp
  `coverage_residue`, `content_fingerprint`, `policy_fingerprint`,
  `record_hwm`, and `flagged` by importing the check package's own
  fingerprint/block/admissibility code; the auditor **shall** supply
  only `auditor`, `dispositions`, and `findings`; the audit record
  **shall** be derivable from the record stream, the diff, and
  protected-branch policy alone — session context **shall never**
  count.
- **INV13 (audit freshness).** An audit record **shall** be fresh iff
  its `content_fingerprint` matches the recomputation over the current
  `diff_files` at the current HEAD, its `policy_fingerprint` matches
  the recomputation over the policy carriers at the current
  protected-branch commit, and no comment past its `record_hwm`
  (empty-stream sentinel `0`, §C.1) carries a `grove-review-ask` or
  `grove-verdict` exact-tag opening fence (§C.3; a misspelled tag
  never registers); prose comments and `grove-audit` blocks **shall
  never** invalidate.
- **INV14 (audit admissibility).** An audit record **shall** be
  admissible only if its carrying comment passes spec-0002 §A.4 **and**
  its `auditor` is not in the separation set `P` (§C.4 — the `producer`
  values **plus** ask `resumed_by` values drawn from every schema-valid
  ask and verdict block in the full stream); otherwise it **shall** be
  inadmissible and excluded from selection.
- **INV15 (vacuity, one level up).** For each recomputed `R_judg`
  member, the selected audit **shall** carry a disposition with a
  non-empty `why`; a missing or empty disposition **shall** satisfy
  nothing for that path, and an audit body empty of dispositions
  **shall** satisfy nothing.
- **INV16 (comparator).** The comparator **shall** log the five §D.1
  metrics per PR to the log output of the existing workflow run, and
  **shall not** write to the job summary, the exit code, a commit
  status, a label, or any PR comment.
- **INV17 (precedent-log home).** `charters/review-precedents.md`
  **shall** be the precedent log's durable home, append-only; no
  machinery **shall** resolve the log from any other path.

### Scenarios (GWT)

- **S1 (batched ask — adr-0023 AC1).** *Given* an `executor` pass that
  produced two code files and one charter edit, *When* it closes,
  *Then* one comment is posted carrying two `grove-review-ask` blocks
  (one `type: code` listing both code paths, one `type: charter`), each
  admissible and schema-valid, and all three paths are ask-covered.
- **S2 (reviewless self-exemption door stays closed — AC1).** *Given*
  an ask block `type: research` naming `plugins/grove/check/lib/x.mjs`,
  *When* the sets are derived, *Then* the block is ineffective for that
  subject, the subject appears as a flagged row (`reviewless-type`),
  and the file falls to `R_cov` — the table still types it `code` and
  nothing is exempted.
- **S3 (frontmatter wins — AC1)** *(re-cast per spec-adversary round 2,
  F1; was: the divergent ask type was `research`, a reviewless type —
  which §A.3 rule 1 inerts block-wide, contradicting the
  siblings-unaffected Then).* *Given* `specs/foo.md` with HEAD
  frontmatter `type: spec` and an ask block `type: charter` — **not**
  reviewless — naming it alongside `charters/bar.md`, *When* the sets
  are derived, *Then* the ask is inert for `specs/foo.md` **only**
  (rule 2; the sibling subject `charters/bar.md` stays effectively
  covered), a flagged row (`frontmatter-divergence`) and an audit
  finding surface, and the derivation uses `spec` — never a precedence
  roll. *And given* instead a **reviewless-typed** block naming a
  frontmatter-bearing divergent subject, *Then* both rules fire and
  **both** flagged rows emit for that subject (§A.3 both-fire).
- **S4 (human push, empty residue — AC4).** *Given* a maintainer PR
  touching only frontmatter-typed artifacts with no ask and no audit in
  the stream, *When* the shadow machinery evaluates, *Then*
  `R_judg = ∅`, no audit is owed, metric 4 reads `no-audit-owed`, and
  the shipped check's outcome is byte-identical to today.
- **S5 (fork PR — AC4).** *Given* a fork PR whose author association
  admits no records, touching only files that are frontmatter-typed or
  out-of-jurisdiction, *When* the shadow machinery evaluates, *Then*
  `R_judg = ∅` and no audit is owed — the poster never meets the §A.4
  admissibility wall on an audit they cannot post.
- **S6 (audit posted with full bindings — AC2).** *Given* a PR whose
  `R_judg` contains `assets/social-preview.png` (no frontmatter, no
  ask), *When* the auditor's record posts, *Then* it carries the
  stamped `coverage_residue` manifest with per-path hashes, a
  `content_fingerprint` over `diff_files` at HEAD, a
  `policy_fingerprint` over the policy carriers, a `record_hwm` —
  `0`, the empty-stream sentinel, since this stream carries no typed
  records (§C.1, F2), under which any future typed comment stales —
  and a non-vacuous disposition for that path; and the comparator's
  recomputation of manifest and fingerprints matches.
- **S7 (auditor ∈ producers — AC2).** *Given* a stream whose asks name
  `producer: executor` and an audit record with `auditor: executor`,
  *When* admissibility is evaluated, *Then* the audit is inadmissible
  and excluded from selection, and the comparator reports the exclusion.
- **S8 (typed-HWM staleness, three-way — AC2).** *Given* a fresh audit
  with `record_hwm = N`, *When* a comment with id > N posts carrying an
  exact-tag `grove-review-ask` fence (its block well-formed **or**
  malformed/unclosed — a misspelled tag never registers, §C.3/N4),
  *Then* the audit is stale (metric 5 counts a race); *When* instead a
  prose-only comment posts, *Then* the audit stays fresh; *When*
  instead a new `grove-audit` record posts, *Then* the earlier audit is
  superseded by selection but never staled by HWM.
- **S9 (policy staleness — AC2).** *Given* a fresh audit, *When* a
  reviewer-declaration charter or `charters/review-policy.md` changes
  on the protected branch — or a fifth reviewer-declaration file
  appears — *Then* the recomputed `policy_fingerprint` differs and the
  audit is stale.
- **S10 (no-op rebase stays fresh — AC2).** *Given* a fresh audit,
  *When* the PR is rebased such that every `diff_files` member's blob
  bytes and the membership are unchanged, *Then* the recomputed
  `content_fingerprint` matches and the audit stays fresh (blob-byte
  basis, fail-open F7's repair).
- **S11 (byte-identity — AC3).** *Given* one PR state evaluated twice —
  once with ask + audit records present, once with them absent — *When*
  the shipped check runs, *Then* its exit code and rendered status view
  are byte-identical, and the comparator's report appears only in the
  run log.
- **S12 (vacuous disposition — AC2).** *Given* an audit whose
  disposition for an `R_judg` file has an empty `why`, *When*
  evaluated, *Then* that file is unsatisfied by the audit (the vacuous-
  evidence rule one level up) and metric 1 counts its table-owed pairs
  as audit-omitted.
- **S13 (per-block isolation for asks).** *Given* a comment carrying an
  unclosed `grove-review-ask` fence immediately followed by a
  well-formed ask block, *When* parsed, *Then* the unclosed block is
  inert on its own and the well-formed sibling still covers its
  subjects — spec-0002 §A.1 delimitation, inherited.

### Traceability (adr-0023 AC1–AC4, the phase 0–2 criteria)

| adr-0023 AC | This spec |
|---|---|
| **AC1** — posted, admissible ask batch; reviewless/divergent asks inert-per-file and flagged | §A.2–§A.4; INV2–INV8; S1–S3, S13 |
| **AC2** — cold-started auditor; audit carries manifest + content fp + policy fp + typed HWM; `auditor ∈ producers` inadmissible | §C.1–§C.5; INV12–INV15; S6–S10, S12 |
| **AC3** — comparator logs the five metrics; shipped verdict byte-identical with/without records | §D; INV1, INV16; S11 |
| **AC4** — empty-residue PR: no audit obligation, greens exactly as today | §B.2; INV11; S4–S5 |

---

## Open questions

- **Q1 — allowlisted untyped paths in `R_judg`.** A spec-0002
  allowlisted README-class file has no frontmatter, so an unasked edit
  to it lands in `R_judg` and post-flip would need a disposition, even
  though the table deterministically owes it nothing. Interim
  (fail-closed, zero shadow cost): **included** — a disposition of
  `owed: []` with a one-line `why` is cheap, and excluding it would be
  a second exemption channel. Shadow data (metric 1 noise on
  allowlisted paths) decides whether to carve it out; carving out is a
  spec revision, not a silent drift.
- **Q2 — the dispatcher's own incidental tree edits.** adr-0023 D5
  names the producing roles; the dispatcher (harness) occasionally
  commits tree files itself. No ask duty is assigned to it here — its
  files fall to the residue, fail-closed. If shadow data shows
  dispatcher edits recurring in `R_judg`, route to the shaper for a
  duty ruling rather than widening this spec's delegated call.
- **Q3 — very large residues.** A pathological PR could make the
  `dispositions` map (and its comment) huge; whether to page an audit
  across comments (the adr-0019 per-review-cap analog — several
  comments compose under selection) is a later refinement, parked.
- **Q4 — the `flagged` surface post-flip.** Whether flagged rows become
  a rendered status-view surface when the gate flips is D6's decision
  to consume; during shadow they live only in the comparator report and
  the audit record.

---

## Rubric check

No project spec-quality rubric is materialized at `<SPEC_RUBRIC_PATH>`
(the repo has no `rubrics/` — re-verified this sitting); per the
spec-0002 precedent, this self-check is against the `contract-author`
charter's intrinsic bar (testable ACs, both grammars, non-empty Open
questions, no invented scope, deliberate `depends_on`).

| Criterion | Result | Note |
|---|---|---|
| Frontmatter complete & well-typed | PASS | `id/type/status/implements/depends_on/owner/updated/version/status_note`; `implements` names adr-0023; `version: 1` initialized at authoring per `versioning.md`. |
| Internal coherence | PASS | The sets nest (`R_judg ⊆ R_cov ⊆ diff_files`); §A.3's two inertness rules feed exactly the §C.1 `flagged` field and the §D report; a frontmatter-divergent subject is not-ask-covered yet frontmatter-resolved, so it reaches `R_cov` but never `R_judg` — no rule requires a disposition for a deterministically resolved file; every stamped field has exactly one recomputation rule; no INV permits what another forbids (checked pairwise across INV1–INV17). |
| Both grammars present (`adr-0004`) | PASS | 17 EARS invariants + 13 GWT scenarios; neither stands in for the other. |
| ACs testable | PASS | Every INV/S is a deterministic, observable outcome: set-math pinned (Terms/§B), both fingerprint bases pinned (basis + commit), HWM class pinned fail-closed, admissibility pinned, report location pinned. Judgment content (`why`, `findings`) is constrained only by testable shape rules (non-empty; one per `R_judg` member) — honest about what is judgment. |
| Traceability to authorizing decision | PASS | adr-0023 AC1–AC4 fully mapped; every D-item covered or explicitly out of scope: D1 (§F design constraint), D2 (§A), D3 (cited: annotations-advisory §A.2, unclaimed-type INV7; depth-triage prose itself is Consequences item 0, landed, §F), D4 (§B–§C), D5 (§A.4 roles, §D, §F scope), D6 (§F non-goal), D7 (§E ruled). |
| spec-0002 untouched | PASS | No spec-0002 clause amended or re-spelled with variation; inherited machinery (§A.1 delimitation, §A.4, `grove-fp-1`, normalization, §C.2 jurisdiction) cited by reference; INV1 makes the inertness itself testable. Verified against `blocks.mjs`/`records.mjs`: the `grove-verdict` extractor cannot match a `grove-review-ask`/`grove-audit` fence. |
| No invented scope beyond decision | PARTIAL-DISCLOSED | Concretizations, each flagged in place and each in service of a decision-stated rationale: the batch-per-type ask shape (§A.2 — D2's singular "the produced type", pinned); the disposition's `{owed, why}` structure (§C.1 — makes metrics 1–2 computable, D5's comparator needs it); the recognized-fence-malformed-block HWM rule (§C.3); the producer-set-from-schema-valid-records admissibility spelling (§C.4); the two remediation-role rulings (§A.4 — explicitly delegated to this spec by D5); the Q1 interim; and, from round 2: the effective-ask **union rule** (§A.3/INV3 — D2's additive-only, made total), the **both-fire flagged multiplicity** (§A.3/INV4), the `record_hwm: 0` **empty-stream sentinel** (§C.1/F2), and the `resumed_by` **dual-attribution field** (§A.2/§C.4 — the minimal record-derivable mechanism for N5's separation extension). Nothing else added. |
| Constrains via tables/enumerations | PASS | Schemas, residues, metrics, non-goals, duties, traceability all tabular. |
| Open questions non-empty & honest | PASS | 4 recorded, each with a named interim or routing — no silent gap. |
| Build-on-settled-ground | PASS | adr-0023 `approved` (2026-07-19 intent act recorded in its frontmatter); spec-0002 `approved` @v4; adr-0019/adr-0015 `approved`. No draft consumed. |

**Self-check verdict: PASS with one disclosed line** (concretizations,
enumerated above — flagged, never silent). Promoted `draft → gated`
per charter Method 6. The next flip is not this author's: the pipeline
routes to the `spec-adversary`, and any `approved` state is a recorded
human intent act per `lifecycle.md`.

**Revision round 2 (2026-07-19, appended — spec-adversary
NEEDS-REVISION against this spec; the check above stands unedited):**
all three blocking findings folded — **F1** S3 re-cast on a
non-reviewless divergent type (`charter` vs frontmatter `spec`; the old
Given's `research` tripped rule 1 block-wide, contradicting its own
siblings-unaffected Then) and the rule-1+rule-2 both-fire multiplicity
pinned normatively (§A.3, §C.1 `flagged`, INV4, S3); **F2** the
`record_hwm: 0` empty-stream sentinel pinned (§C.1, INV13, S6 — S6's
own Given was the undefined case); **F3** the fail-closed union rule
for several effective asks on one subject pinned (§A.3, INV3, §D.1 —
latest-wins would let a correction shrink obligations, violating D2's
additive-only). Non-blocking folds: **N1** metric 3's empty-diff
rendering (§D.1); **N2** §B.1's presence sentence scoped to the ask
lane with the residue exception stated; **N3** the one-snapshot HWM
stamp (§C.2); **N4** the exact-tag tokenizer wording aligned (Terms,
§C.3, INV13, S8 — a typo'd tag never registers, so it neither covers
nor stales); **N5** `resumed_by` dual attribution extending §C.4's `P`
(§A.2, §A.4, §C.4, INV14); **N6** the deletions-only disclosure beside
the content-freshness rule (§C.3). This is pre-approval revision while
`gated` — `version` stays `1`, no delta note owed (`adr-0004`
revise-in-place applies to *current-truth* amendments; the counter
moves once the artifact has consumers to pin it, the spec-0002
precedent). *(Trail note, corrected at next-touch per the conformance
finding: written pre-re-check — the adversary subsequently DID re-judge
this revision, round-2 APPROVE-READY, recorded on the status line.)*
