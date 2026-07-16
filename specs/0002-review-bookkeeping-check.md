---
id: spec-0002-review-bookkeeping-check
type: spec
status: gated
depends_on: [adr-0012-methodology-delivery-machinery, adr-0005-tdd-and-artifact-gated-dispatch, adr-0006-operational-conformance-mechanism]
owner: agent
updated: 2026-07-16
version: 1  # counter initialized at materialization (versioning.md); forward-only from here
status_note: promoted draft → gated on the passing self-check (contract-author Method 6); approved remains the human intent act (lifecycle.md), and adr-0012 (this spec's authorizing decision) is itself only gated — see Open Q5
---

# spec-0002 — the review-bookkeeping check (Layer A)

The mechanism that makes review bookkeeping mechanical: per-review
**verdict files**, a `type → owed-review` **owed-map**, and a
deterministic **check** that renders a read-only status view and goes red
on any completeness / freshness / coverage / separation gap. Implements
`adr-0012` **Layer A** only. Green is **not** authorization; a human still
judges genuineness and merges.

> This spec constrains machinery, not judgment. It **recomputes** the
> values it can (fingerprints, owed-set, type, coverage) and **trusts,
> disclosed**, the values it cannot (verdict genuineness, self-reported
> author/reviewer tags). The values it trusts are the Layer B surface
> (§E), named here, not pretended away.

## Terms

| Term | Meaning |
|---|---|
| **check** | The single automated job added by this spec (GitHub Actions on existing primitives, `adr-0012` AC10). Runs on every PR against the protected default branch. |
| **protected branch** | The protected default branch (`main`) — the source of *policy*. Never PR HEAD. |
| **HEAD** | The PR's head commit — the source of reviewed *content*. |
| **diff** | The set of files changed between the PR's merge-base on the protected branch and HEAD (added or modified; deletions per S12). |
| **review** | One of the four reviews: `decision-adversary`, `spec-adversary`, `conformance`, `code-reviewer`. |
| **verdict file** | A structured record one reviewer emits per subject under `.grove/verdicts/` (§A). |
| **subject manifest (S)** | The reviewer-declared set of repo-relative paths a verdict certifies (§A). |
| **upstream set (U)** | The check-derived direct-`depends_on` file set of the subjects (§A.3) — derived, never trusted from the verdict. |
| **fingerprint** | A deterministic hash over `S ∪ U` content (§A.3). |
| **owed-map** | The pinned `type → {reviews}` table (§B). |
| **PASS-class** | The pass tokens of a review's own charter verdict grammar (§A.2). |

---

## §A — Verdict-file format

### A.1 Path convention

- Verdict files live **only** under `.grove/verdicts/`.
- One file per **(review, subject)**:
  `.grove/verdicts/<review>/<subject-key>.yml`
  - `<review>` ∈ `{decision-adversary, spec-adversary, conformance, code-reviewer}`.
  - `<subject-key>` is the subject's frontmatter `id` if it has one,
    else `path-<first-12-hex of sha256 of the sorted subject paths>`.
- **Rationale for the per-subject key** (extends `adr-0012`'s
  `.grove/verdicts/<review>` shorthand): a PR may carry several subjects
  that each owe the same review; a per-subject path keeps every
  reviewer-run's file **disjoint**, preserving the decision's "parallel
  reviewers never contend, git is the store, no serializer" property. It
  serves the decision's stated rationale; it does not extend scope.

### A.2 Schema (structured data only — YAML)

Every field is **required** unless marked optional. A file under
`.grove/verdicts/` that does not parse against this schema is rejected
(S7).

| Field | Type | Meaning |
|---|---|---|
| `review` | enum | The review this verdict is for (one of the four). |
| `verdict` | string | The reviewer's overall verdict token, verbatim from its charter grammar. |
| `subject` | list\<path\> | The subject manifest `S` — repo-relative paths this verdict certifies. Non-empty. |
| `subject_id` | string (optional) | The subject artifact's frontmatter `id`, when it has one. |
| `fingerprint` | string | `grove-fp-1:<64-hex>` recorded by the reviewer over `S ∪ U` (§A.3). Recomputed by the check, never trusted. |
| `author` | string | Self-reported agent id that **produced** the subject. |
| `reviewer` | string | Self-reported agent id that **produced this verdict**. |
| `findings` | string (URL) | Pointer to the detailed findings (PR comment/thread). Detail lives there, not here. |
| `reviewed_at_commit` | string (optional) | The commit SHA reviewed. Informational only; the check ignores it for freshness. |

**PASS-class per review** (the check reads this table from policy on the
protected branch; `adr-0012` AC1/AC6):

| `review` | PASS-class tokens | Source charter |
|---|---|---|
| `conformance` | `PASS` | `conformance-reviewer.md` (Output) |
| `code-reviewer` | `CLEAN`, `PASS-WITH-ADVISORIES` | `code-reviewer.md` (Verdict) |
| `spec-adversary` | `APPROVE-READY` | `spec-adversary.md` (Method 4) |
| `decision-adversary` | **per its charter, to be authored** — see Open Q1 | (new role, `adr-0012` AC9) |

A `verdict` token outside its review's PASS-class is **not** a pass; the
owed pair stays uncovered (S1).

### A.3 Fingerprint algorithm (`grove-fp-1`) and upstream resolution

The fingerprint binds a verdict to exactly the content the review rested
on, so that a later edit to that content — including the **upstream**
(the spec-revised-underneath incident) — invalidates it.

**Upstream set `U(S, C)`** at commit `C`, derived by the check (not read
from the verdict):

1. Build an **artifact index** at `C`: glob the policy-declared artifact
   directories (default `decisions/`, `specs/`, `charters/`), read each
   file's frontmatter `id`, map `id → path`.
2. For each subject path `s ∈ S` that carries YAML frontmatter with a
   `depends_on` list: resolve each **direct** dependency id (strip any
   `@version` per `versioning.md`) to its path via the index; add it to
   `U`. Transitive closure is **not** taken (Open Q3).
3. A subject with no frontmatter (**code**) resolves its upstream from the
   **per-package test-deps ledger** (`adr-0006` dec 4, placeholder
   `<TEST_DEPS_LEDGER>`): locate the ledger for the subject's package, read
   its declared `depends_on` (the specs `@vN` and decisions the package's
   tests rest on) at `C`, resolve each id to a path via the index, and add it
   to `U`. The ledger is an artifact the `executor` maintains — so code's
   upstream is **check-derived from a durable, reviewable artifact**, not from
   the reviewer's per-verdict manifest. A code package with no ledger entry
   has no derivable upstream → `conformance`'s "no reviewable upstream ⇒ FAIL"
   backstop (`adr-0005` dec 3) applies (fail-closed). A change to the ledger
   itself changes `U`'s membership → stale, like any upstream change.
   *(Resolves former Open Q2, folding in `adr-0006` dec 4 — dispatcher edit,
   2026-07-16; to be confirmed by the `spec-adversary`.)*

**Fingerprint input `I = sorted(dedup(S ∪ U(S, C)))`.**

**`grove-fp-1(I, C)`:**

1. Sort `I` by raw byte order of the path string.
2. For each `p ∈ I`: `b =` the blob bytes of `p` at `C` if it exists,
   else the sentinel `"\x00ABSENT\x00"`; emit
   `L_p = hex(sha256(utf8(p))) + ":" + hex(sha256(b))`.
3. Fingerprint `= "grove-fp-1:" + hex(sha256( join(L_p, "\n") ))`.

The **reviewer** records `grove-fp-1(S ∪ U(S, reviewed-commit),
reviewed-commit)`. The **check** recomputes
`grove-fp-1(S ∪ U(S, HEAD), HEAD)` and compares. Any difference — changed
subject content, changed upstream content, or a changed upstream
*membership* — is a **stale** verdict (S2). Because the check derives `U`
itself and recomputes over `HEAD`, a reviewer cannot make a verdict look
fresh by recording a manifest that omits a frontmatter-declared upstream.

---

## §B — The owed-map (pinned, `adr-0012` Consequences + AC4)

`type` is read from the changed file's **frontmatter `type` at HEAD**;
**no frontmatter ⇒ `code`** (`adr-0012`, considered-and-rejected: reuse
the frontmatter contract, no classifier invented).

| `type` (at HEAD) | Owed reviews |
|---|---|
| `research`, `feedback` | *(none)* |
| `adr` / decision | `decision-adversary` **+ human intent gate** (§C.6, AC9) |
| `spec` | `spec-adversary`, `conformance` |
| *no frontmatter* ⇒ `code` | `code-reviewer`, `conformance` |
| **any other / undefined `type`** | **full set**: `decision-adversary`, `spec-adversary`, `conformance`, `code-reviewer` (fail-closed, AC4) |

- The owed-map **table itself** is resolved from the protected branch,
  never PR HEAD (§C, AC5).
- `charter` is **not** a pinned row; it therefore falls to the
  fail-closed **full set** (Open Q4 — flagged against `adr-0006`, not
  silently given a bespoke row).
- A PR's owed-set is the **union** over all changed files of each file's
  owed reviews (S12); green requires every element satisfied at HEAD.

---

## §C — The check

### C.0 Trust boundary (the check trusts no agent-emitted value it can recompute)

| Value | Source | Trusted? |
|---|---|---|
| owed-map, PASS-class table, allowlist, artifact dirs | policy files on **protected branch** | policy, not agent |
| diff, `type` of each changed file | **HEAD** content | recomputed |
| fingerprint | recomputed via `grove-fp-1` over `S ∪ U(S,HEAD)` | **never trusted** (AC2) |
| upstream set `U` | derived from HEAD frontmatter | derived, not read from verdict |
| coverage (does `S` contain the changed file) | recomputed from diff ∩ `S` | recomputed (AC3) |
| `verdict` token | verdict file | **trusted** (genuineness = Layer B, §E) |
| `author` / `reviewer` tags | verdict file (+ frontmatter cross-check) | **trusted, disclosed** (accidental-case only, AC7/§E) |
| human approval of a decision | artifact `status` at HEAD | recomputed from frontmatter |

### C.1 Resolve policy (AC5)

Load the owed-map, PASS-class table, artifact-dir list, and the
non-behavioral **allowlist** from the **protected branch** commit, not
from PR HEAD. A PR that edits these policy files on its own branch does
**not** change the rules its own gate runs under (S6).

### C.2 Derive the owed-coverage set (AC1, AC3, AC4)

For each file `f` in the diff:

1. Classify `type(f)` from HEAD frontmatter (§B); no frontmatter ⇒ `code`;
   unrecognized ⇒ full set.
2. `.grove/verdicts/` files and allowlisted non-behavioral paths owe
   nothing **except** that a code-bearing path can never be exempted —
   the allowlist is an allowlist, never a review-free zone for code (S11,
   AC5).
3. Emit an owed pair `(f, R)` for each `R ∈ owed(type(f))`.

The **owed-coverage set** is the union of all such pairs.

### C.3 Match verdicts (AC1, AC2, AC3)

For each owed pair `(f, R)`, the check requires **at least one** verdict
file for `R` that is **all** of:

- **present & valid** — parses against the §A.2 schema;
- **covering** — `f ∈ S` (the recorded subject manifest contains `f`) (AC3);
- **fresh** — recomputed `grove-fp-1(S ∪ U(S,HEAD), HEAD)` equals the
  recorded `fingerprint` (AC2);
- **passing** — `verdict ∈ PASS-class(R)` (AC1);
- **separated** — passes §C.4.

Any owed pair with no such verdict ⇒ **red** (AC1).

### C.4 Separation (AC7 — accidental case only)

- **Primary (deterministic):** for each matched verdict, `reviewer ≠
  author` ⇒ else **red** (S5).
- **Cross-check:** where the subject carries a frontmatter `author`
  field, require `verdict.author == subject.frontmatter.author` ⇒ else
  **red**. Code (no frontmatter) has no cross-check source; the verdict's
  self-report stands alone — a **disclosed** Layer B gap (§E).
- Deliberate forgery of either tag is **out of scope** (Layer B, §E,
  AC8).

### C.5 `.grove/verdicts/` carve-out (AC5)

Files under `.grove/verdicts/` owe no review, **but** the directory is
**structured-data-only**: every file there must parse against §A.2 and
sit at a schema-valid path (§A.1). A non-verdict or non-parsing file
under `.grove/verdicts/` ⇒ **red** (S7). The carve-out is an allowlist,
never a review-free zone.

### C.6 Decision-layer human gate (AC9)

For any changed file whose owed set includes `decision-adversary`, the
check additionally requires the artifact's `status` **at HEAD** to be in
the approved class (the recorded **human intent gate**, `lifecycle.md`).
A bundled *draft* upstream keeps the gate **red** until the human
approves it in-PR (`adr-0012` Consequences; this enforces staged approval
through the existing gate, adds no new rule) (S9). If the
`decision-adversary` PASS-class is not yet available in policy (Open Q1),
a decision-layer change **cannot go green** — fail-closed (S10).

### C.7 Verdict of the check

Green **iff** every owed pair is satisfied (C.3), every separation check
holds (C.4), every `.grove/verdicts/` file is valid (C.5), and every
decision-layer human gate is satisfied (C.6). Otherwise red, naming each
failing pair/reason. **Green is non-authorizing** (§D, AC6).

---

## §D — The rendered status view (AC6)

The check renders one **read-only** status view each run, computed
entirely from the verdict files + the check's own recomputation. **No
agent writes or mutates it.**

- **Per-row** (one per owed pair): `review | subject | verdict | fresh? |
  covers? | separated? | findings-link`.
- **Header banner, verbatim intent:** *"Bookkeeping complete — a human
  still judges genuineness and merges. This is NOT approval."* on green;
  the failing pairs/reasons on red.
- The view is surfaced in the PR check summary; it never carries the
  words "approved," "reviewed," or "safe to merge" for a green result
  (AC6, S8).

---

## §E — Non-goals (Layer B — explicitly out of scope)

This spec does **not** specify, and its check does **not** provide
(`adr-0012` §3, AC8, Consequences "deferred to Layer B"):

| Non-goal | Why out of scope (Layer A limit disclosed) |
|---|---|
| **Run-attestation / genuineness** | The check trusts the `verdict` token; it cannot prove a genuine non-producer review actually ran. An agent could write a fake passing verdict file. |
| **Forgery-proof separation** | `author`/`reviewer` are self-reported; the check catches **accidental** fusion, never a deliberately forged tag. |
| **Forge-resistant verdict store** | The store is git; a producer can edit its own verdict files. No tamper-resistance. |
| **Autonomous loop-bounding** | A non-converging revise ↔ re-review cycle is bounded by the **human** (v1); a force-push-stable mechanical bound is Layer B (E7). |

These are named, not pretended. Authenticity and policy changes remain
**human-owned** (AC8).

---

## Acceptance criteria

### Invariants (EARS)

- **INV1 (policy integrity, AC5).** The check **shall** resolve the
  owed-map, PASS-class table, allowlist, and artifact-dir list from the
  protected default branch, and **shall not** read them from PR HEAD.
- **INV2 (content basis).** The check **shall** classify each changed
  file's `type`, compute the diff, and recompute fingerprints from PR
  HEAD content.
- **INV3 (freshness, AC2).** The check **shall** recompute each matched
  verdict's fingerprint via `grove-fp-1` over `S ∪ U(S,HEAD)` and
  **shall** treat any mismatch as stale, never trusting the recorded
  fingerprint value.
- **INV4 (derived upstream).** The check **shall** derive the upstream
  set `U` itself from HEAD frontmatter `depends_on`, and **shall not**
  read the upstream membership from the verdict file.
- **INV5 (completeness, AC1).** The check **shall** go red if any owed
  `(file, review)` pair lacks a present, valid, covering, fresh,
  PASS-class, separated verdict.
- **INV6 (coverage, AC3).** For a verdict to cover an owed pair `(f, R)`,
  the check **shall** require `f` to be a member of that verdict's
  recorded subject manifest `S` — existence alone **shall not** suffice.
- **INV7 (fail-closed type, AC4).** Where a changed file's `type` is new
  or undefined, the check **shall** assign the full review set; where a
  file has no frontmatter, the check **shall** classify it as `code`.
- **INV8 (separation, AC7).** The check **shall** go red if a matched
  verdict's `reviewer` equals its `author`, and, where the subject
  carries a frontmatter `author`, if `verdict.author` differs from it.
- **INV9 (carve-out, AC5).** The check **shall** reject any file under
  `.grove/verdicts/` that does not parse against the §A.2 verdict schema,
  and **shall not** exempt any code-bearing path from `code-reviewer` via
  the allowlist.
- **INV10 (decision human gate, AC9).** For a changed decision-layer
  artifact, the check **shall** require a PASS-class `decision-adversary`
  verdict **and** the artifact's `status` at HEAD to be in the approved
  class.
- **INV11 (non-authorizing, AC6).** On green, the check **shall** present
  the result as "bookkeeping complete," and **shall not** label it
  "approved," "reviewed," or "safe to merge."
- **INV12 (no unbuilt infra, AC10).** The check **shall** use only git
  files and existing GitHub primitives (protected branches + Actions),
  and **shall not** depend on run-attestation, an identity service, or a
  forge-resistant store.
- **INV13 (union owed-set).** For a PR touching multiple files, the check
  **shall** require the union of every changed file's owed reviews, all
  satisfied at HEAD.

### Scenarios (GWT)

- **S1 (completeness miss, AC1).** *Given* a PR changing `specs/foo.md`
  (type `spec`, owes `spec-adversary` + `conformance`) *and* only a
  passing `conformance` verdict exists, *When* the check runs, *Then* it
  goes **red**, naming the missing `spec-adversary` pair.
- **S2 (freshness / spec-revised-underneath, AC2).** *Given* a passing
  `conformance` verdict over code whose subject manifest's derived
  upstream includes `specs/foo.md`, *When* `specs/foo.md` is edited later
  in the same PR, *Then* the recomputed `grove-fp-1` differs from the
  recorded fingerprint and the check goes **red** (stale), without anyone
  re-flagging it by hand.
- **S3 (coverage gap, AC3).** *Given* a PR changing `specs/foo.md` and
  `specs/bar.md` *and* a fresh passing `spec-adversary` verdict whose
  subject manifest lists only `specs/foo.md`, *When* the check runs,
  *Then* it goes **red** on the uncovered `(specs/bar.md, spec-adversary)`
  pair.
- **S4 (fail-closed undefined type, AC4).** *Given* a PR adding
  `x/thing.md` with frontmatter `type: widget` (unrecognized), *When* the
  check runs, *Then* it requires the **full** review set for it and goes
  red until all are present, fresh, and passing.
- **S5 (accidental fusion, AC7).** *Given* a matched `conformance`
  verdict whose `author` equals its `reviewer`, *When* the check runs,
  *Then* it goes **red** on separation, regardless of the verdict token.
- **S6 (policy from main, AC5).** *Given* a PR that edits the owed-map
  policy file on its own branch to drop `conformance` from `spec`, *When*
  the check runs, *Then* it still applies the protected-branch owed-map
  and the dropped review is still owed.
- **S7 (verdicts carve-out, AC5).** *Given* a PR adding
  `.grove/verdicts/conformance/notes.txt` containing free-form prose,
  *When* the check runs, *Then* it goes **red** (non-verdict content
  under `.grove/verdicts/`), and the file is **not** treated as owing its
  own review.
- **S8 (green non-authorizing, AC6).** *Given* every owed pair satisfied
  at HEAD, *When* the check renders the status view, *Then* the banner
  reads "bookkeeping complete — a human still judges genuineness and
  merges" and nowhere says "approved / reviewed / safe to merge."
- **S9 (bundled draft decision, AC9).** *Given* a PR bundling a new
  decision at `status: draft` with a spec that depends on it, *When* the
  check runs, *Then* the decision-layer human-gate condition is unmet and
  the check is **red** until the human approves the decision in-PR — no
  new bundling rule, the existing gate enforces the ordering.
- **S10 (decision-adversary pass-class unavailable, AC9).** *Given* the
  `decision-adversary` PASS-class is not yet defined in policy, *When* a
  PR changes a decision, *Then* the check **cannot** go green for it
  (fail-closed), never defaulting the decision review to satisfied.
- **S11 (allowlist can't exempt code, AC5).** *Given* a code-bearing path
  listed in the non-behavioral allowlist, *When* the check runs, *Then*
  it still owes `code-reviewer` (+ `conformance`) — the allowlist does
  not exempt code.
- **S12 (union owed-set, INV13).** *Given* a PR carrying one spec, one
  code file, and one research note, *When* the check runs, *Then* the
  owed-set is `{spec: spec-adversary+conformance} ∪ {code:
  code-reviewer+conformance} ∪ {research: none}` and green requires all
  of it at HEAD. *And* a pure deletion whose path appears in a fresh
  verdict's `S ∪ U` recomputes to `ABSENT`, changing the fingerprint and
  marking that verdict stale.

### Traceability

| adr-0012 AC | Covered by |
|---|---|
| AC1 completeness | INV5, S1 |
| AC2 freshness | INV3, INV4, §A.3, S2 |
| AC3 coverage | INV6, §C.3, S3 |
| AC4 fail-closed | INV7, §B, S4 |
| AC5 policy integrity | INV1, INV9, §C.1/§C.5, S6, S7, S11 |
| AC6 non-authorizing | INV11, §D, S8 |
| AC7 separation | INV8, §C.4, S5 |
| AC8 honest disclosure | §E |
| AC9 decision-adversary | INV10, §B, §C.6, S9, S10 |
| AC10 no infra pretence | INV12, §A (git store), §D |
| AC11 adr-0006 pointer | Open Q4 records the per-layer conformance consistency; no supersession |

---

## Open questions

1. **`decision-adversary` verdict grammar (blocks S10 resolution).**
   `adr-0012` AC9 charters the `decision-adversary` role but does not pin
   its verdict grammar; the PASS-class table (§A.2) therefore leaves it
   **to be authored** with that charter. This spec pins the **fail-closed
   behavior** (S10) but not the token set. The charter authoring (a
   separate `adr-0012` deliverable) must declare it before the
   decision-layer gate can ever go green. Not invented here.
2. **Code → upstream resolution — RESOLVED (2026-07-16).** Code files carry
   no frontmatter `depends_on`, so the check cannot derive their upstream
   from the code itself. Resolved by folding in the **per-package test-deps
   ledger** (`adr-0006` dec 4, already approved): code's upstream is read from
   the ledger the `executor` maintains (§A.3 step 3), so `U` for code is
   check-derived from a durable, reviewable artifact — not the reviewer's
   per-verdict manifest — and the spec-revised-underneath case (S2) fires for
   code too. A package with no ledger entry falls to the fail-closed FAIL
   backstop (`adr-0005` dec 3). No new machinery: the `executor`'s existing
   ledger duty is the stamping mechanism. (Note: fundamentally *some*
   declaration is required — code cannot self-describe which spec it
   implements — so this moves the declaration to the best available home, a
   maintained artifact, rather than eliminating it.)
3. **Direct vs. transitive upstream closure (§A.3 step 2).** `U` is pinned
   to **direct** `depends_on` only, to keep freshness bounded and match
   "the review judged against its direct upstream." A change two hops up
   (a spec's decision) does not stale a code verdict via this check — it
   is caught by `adr-0006`'s pin/version machinery when the intermediate
   artifact is itself re-touched. If experience shows distant-upstream
   drift must stale verdicts directly, this is the dial to revisit.
   `adr-0012` does not pin the depth; direct is this spec's fail-bounded
   choice, surfaced not hidden.
4. **`charter` owes the fail-closed full set (§B) — tension with
   `adr-0006`.** `adr-0012`'s owed-map pins no `charter` row, so a charter
   change falls to the full review set (AC4). `adr-0006` dec 8, by
   contrast, frames "charter conforms to its ADR" as specifically a
   `conformance-reviewer` review (charters are prose, not test-runnable),
   which suggests a narrower owed set. This spec follows `adr-0012`'s
   pinned fail-closed rule rather than inventing a `charter` row; whether
   `adr-0012`'s map should gain an explicit `charter → {conformance}` (or
   `{decision-adversary, conformance}`) row consistent with `adr-0006` is
   a decision-layer question, routed back to `shaper`, not resolved in a
   spec. (This is also the AC11 forward-pointer touchpoint.)
5. **Provisional upstream — `adr-0012` is `gated`, not `approved`.** The
   contract-author charter derives specs from **approved** decisions; the
   maintainer explicitly authorized proceeding **provisionally** on the
   `gated` `adr-0012` (a disclosed deviation, recorded here). This spec
   must be **re-checked** — and its `depends_on` pin re-confirmed — once
   `adr-0012` is approved, and re-derived if `adr-0012` is amended before
   approval. It must **not** promote past `gated` into any executor build
   while its authorizing decision is still `gated`.
6. **`author` frontmatter field is a new convention (§C.4 cross-check).**
   The separation cross-check reads a frontmatter `author` field on the
   subject; `adr-0012` authorizes "each produced artifact carries a
   self-reported author tag" but does not pin the field name or the
   producers'-charters change that stamps it. The name `author` is this
   spec's concretization; the producer-charter stamping duty is a
   separate `adr-0012` deliverable and is out of this spec's scope.

---

## Rubric check

No project spec-quality rubric is materialized at `<SPEC_RUBRIC_PATH>`
(the repo has no `rubrics/`); this self-check is against the
`contract-author` charter's intrinsic quality bar (testable ACs, both
grammars, non-empty Open questions, no invented scope, deliberate
`depends_on`).

| Criterion | Result | Note |
|---|---|---|
| Frontmatter complete & well-typed | PASS | `id/type/status/depends_on/owner/updated/version`; `version: 1` initialized at materialization per `versioning.md`. |
| Both grammars present (`adr-0004`) | PASS | 13 EARS invariants + 12 GWT scenarios; neither stands in for the other. |
| ACs testable | PASS | Every INV/S is a deterministic, observable check outcome; the fingerprint algorithm is fully specified. |
| Traceability to authorizing decision | PASS | AC1–AC11 mapped; every pinned mechanism traces to `adr-0012`. |
| Open questions non-empty & honest | PASS | 6 recorded; each is a genuine gap the decision leaves open, parked not guessed. |
| No invented scope beyond decision | PARTIAL-DISCLOSED | Two concretizations extend the decision's shorthand in service of its stated rationale, flagged: the per-subject verdict path (§A.1) and the `author` field name (Open Q6). The `decision-adversary` grammar, code→upstream resolution, closure depth, and `charter` row are **parked** (Open Q1–Q4), not invented. |
| Constrains via tables/enumerations, not prose | PASS | Owed-map, schema, trust boundary, PASS-class, traceability all tabular. |
| Layer B named as non-goal, not specified | PASS | §E enumerates all four Layer B non-goals as out of scope. |
| Provisional-upstream deviation disclosed | PASS | Open Q5 records the `gated`-not-`approved` deviation and the re-check obligation. |

**Self-check verdict: PASS with disclosures.** The one non-clean line
(invented scope) is disclosed, not silently passed: everything the
decision pins is pinned; everything it leaves genuinely open is an Open
question, not a guess. Promoting `draft → gated`. `approved` is the
human's to give (`lifecycle.md`, `floor-intent-gate`) — and, per Open Q5,
this spec's own authorizing decision is still `gated`, so it must not be
built against until both it and `adr-0012` clear the human gate.
