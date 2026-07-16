---
id: spec-0002-review-bookkeeping-check
type: spec
status: approved  # gated → approved: the maintainer's explicit intent act ("approved. merge", 2026-07-16), bundled with adr-0012's approval on the same PR per Open Q5's sequencing; recorded in-PR by the shaper per lifecycle.md
implements: adr-0012-methodology-delivery-machinery  # the realized contract (adr-0012 implements-edge); machine-readable fidelity selector
depends_on: [adr-0012-methodology-delivery-machinery, adr-0005-tdd-and-artifact-gated-dispatch, adr-0006-operational-conformance-mechanism]  # builds-on; adr-0012 retained here too so depends_on-walking machinery keeps the edge until it learns `implements`
owner: agent
updated: 2026-07-16
version: 1  # counter initialized at materialization (versioning.md); forward-only from here — held at 1 through this second pre-approval revision, see Rubric check
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
| **verdict record** | One structured, **append-only** comment a reviewer posts on the PR per review act (§A). The commit point: a review not recorded here does not count. |
| **record stream** | The PR's comment stream, read via the platform API — the only channel the check reads records from. Read **in full** (paginated to exhaustion, §A.4). |
| **admissible record** | A schema-valid record that also passes §A.4 — unedited carrying comment, authorized poster. Only admissible records enter selection (§C.3). |
| **subject manifest (S)** | The reviewer-declared set of repo-relative paths a record certifies (§A). |
| **upstream set (U)** | The check-derived **implements target(s)** of the subjects (§A.3) — the `implements:` id for artifacts, the ledger-named specs for code; **never** the rest of `depends_on`, never trusted from the record. Fidelity reviews only. |
| **fingerprint** | A deterministic hash over the review-class basis (`S` or `S ∪ U`) content (§A.3). |
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

- A verdict record is a **structured comment on the PR** — one comment
  per review act, posted by the reviewer in **one act** (verdict +
  manifest + fingerprint + attribution + findings together; no second
  channel). Nothing lands in the repo tree: **no verdict path exists**
  (`adr-0012` AC5, AC10).
- **Carrier (concretization, flagged):** the machine-parseable part is a
  fenced code block tagged `grove-verdict` containing YAML per §A.2. A
  comment may carry surrounding prose; only the block is the record. Any
  comment (or block) that does not parse against §A.2 is **inert** — it
  is never a record and never satisfies anything (S7; fail-closed by
  non-recognition). A comment containing **more than one**
  `grove-verdict` block is **wholly inert** — one comment is one record,
  matching the decision's one-act rule (fail-closed by non-recognition;
  concretization, flagged).
- **Append-only.** A re-review posts a **new** record; nothing is
  overwritten or deleted. Editing a record's comment **rejects** the
  record (§A.4, AC14) — a reviewer never edits a record comment, it
  posts a new one. For each owed pair, the **latest covering admissible
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
  (monotone comment id). A later record supersedes earlier ones **for
  the paths it covers**; it never uncovers paths it does not mention.

### A.2 Schema (structured data only — YAML, inside the `grove-verdict` block)

Every field is **required** unless marked optional.

| Field | Type | Meaning |
|---|---|---|
| `schema` | int | Record-schema version. This spec defines exactly `1`. A block whose `schema` is absent or ≠ `1` is **inert** (fail-closed by non-recognition; a future value requires a revision of this spec). |
| `review` | enum | The review this record is for (one of the four). |
| `verdict` | string | The reviewer's overall verdict token, verbatim from its charter grammar. |
| `subject` | list\<path\> | The subject manifest `S` — normalized repo-relative paths this record certifies. Non-empty. |
| `subject_id` | string (optional) | The subject artifact's frontmatter `id`, when it has one. |
| `manifest_hashes` | map path → sha256 | Per-path content hashes at review time, over `S` (quality) or `S` plus the reviewer-resolved upstream (fidelity). **Used only to name stale reasons (§D); never for the verdict** — the check recomputes everything. |
| `fingerprint` | string | `grove-fp-1:<64-hex>` recorded by the reviewer over the review-class basis (§A.3). Recomputed by the check, never trusted. |
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

| Review class | Fingerprint input basis | Consequence |
|---|---|---|
| **quality** (`decision-adversary`, `spec-adversary`, `code-reviewer`) | `I = sorted(dedup(S))` — the subject **alone** | An upstream edit does **not** invalidate a quality verdict (S13). |
| **fidelity** (`conformance`) | `I = sorted(dedup(S ∪ U(S, C)))` — subject **+ derived implements upstream** | Any subject *or* upstream edit — content or membership — invalidates it (S2, S13). |

**Upstream set `U(S, C)`** at commit `C`, derived by the check for
fidelity records (never read from the record). **`U` is the implements
edge, not `depends_on`** (`adr-0012` F5): a `depends_on` entry is
builds-on and never enters the fidelity basis.

1. Build an **artifact index** at `C`: glob the policy-declared artifact
   directories (default `decisions/`, `specs/`, `charters/`), read each
   file's frontmatter `id`, map `id → path`. **Two files claiming the
   same `id` make that id ambiguous**: any resolution through it fails —
   red with `unresolvable-reference` naming both paths (§C.7); the check
   never silently picks one.
2. For each subject path `s ∈ S` that carries YAML frontmatter: read its
   **`implements:` field** (one id; strip any `@version` suffix per
   `versioning.md`), resolve it to a path via the index, and add that
   path to `U`. A fidelity-owing subject with **no `implements`
   declaration** has no reviewable upstream → the owed conformance pair
   is **red** with reason `no-reviewable-upstream` (`adr-0005` dec 3,
   fail-closed; S20). An `implements` id that **does not resolve** at
   `C` leaves `U` undefined for that subject → **red** with
   `unresolvable-reference` — the basis is never computed over a
   silently smaller set. Transitive closure is **not** taken (Open Q3).
3. A subject with no frontmatter (**code**) resolves its upstream from
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

The **reviewer** records `grove-fp-1(I, reviewed-commit)` over its
class's basis. The **check** recomputes `grove-fp-1(I, HEAD)` — deriving
`U` itself for fidelity — and compares. Any difference — changed subject
content, changed upstream content, or changed upstream *membership* — is
a **stale** record (S2). Because the check derives `U` itself and
recomputes over `HEAD`, a reviewer cannot make a fidelity record look
fresh by recording a manifest that omits the implements target. The
recorded `manifest_hashes` feed only the §D reason attribution: a
mis-recorded per-path hash can at worst **misname** a reason, never flip
the check's red/green.

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
  rejects the record. Reviewers therefore never edit a record comment —
  a correction is a **new** record (§A.1).
- **Authorized poster.** A record is admissible only if the
  platform-attested comment author is authorized: by the configured
  **record-poster allowlist** in policy on the protected branch when one
  exists, else by the default `author_association ∈ {OWNER, MEMBER,
  COLLABORATOR}` (concretization, flagged — the decision pins
  "restricts who may post records"; the default is this spec's
  spelling, overridable in policy; carrier: Open Q7).
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

---

## §C — The check

### C.0 Trust boundary (the check trusts no agent-emitted value it can recompute)

| Value | Source | Trusted? |
|---|---|---|
| owed-map (**assembled** from reviewer-charter declarations), PASS-class table, reviewless-type declarations, allowlist + prose-extension set, artifact dirs, record-poster policy | charters + policy on **protected branch** | policy, not agent-at-PR-HEAD |
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

### C.2 Derive the owed-coverage set (AC1, AC3, AC4)

For each file `f` in the diff (a rename contributing both its old path —
a deletion — and its new path — an addition):

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
gate (C.6) is satisfied, and graph resolution (C.7) holds for every
changed artifact. Otherwise red, naming each failing row with its §D
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
  the failing rows + reasons on red.
- The view never carries the words "approved," "reviewed," or "safe to
  merge" for a green result (AC6, S8).

**The reason grammar.** For every un-green row the view states **why**,
from this enum (all applicable reasons, in this order):

| Reason | Fires when | Payload |
|---|---|---|
| `never-reviewed` | No admissible schema-valid record for `R` covers `f` — including a review run only in session (S15) or a malformed / multi-block comment (S7). | — |
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
  review-class basis at HEAD — the subject alone for a quality review,
  `S ∪ U(S, HEAD)` for a fidelity review — and **shall** treat any
  mismatch as stale, never trusting the recorded fingerprint or
  `manifest_hashes` for the verdict.
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
- **INV7 (fail-closed type, AC4).** The check **shall** treat a `type`
  as reviewless **only** on a positive policy declaration; where a
  changed file's `type` is new, undefined, or claimed by no reviewer
  declaration (and not declared reviewless), the check **shall** assign
  the full review set as an explicit rule on top of the assembly (which
  alone would fail open); where a file has no frontmatter, the check
  **shall** classify it as `code`.
- **INV8 (separation, AC7).** The check **shall** go red if a matched
  record's `reviewer` equals its `producer` — the verdict record being
  the single separation authority at every layer — and **shall not**
  read any artifact frontmatter author tag as a separation input or a
  red condition (such tags are optional provenance only).
- **INV9 (record channel, AC10).** The check **shall** read verdict
  records only from the PR's comment stream via the platform API, read
  **in full** (paginated to exhaustion — a truncated read **shall** be a
  red error, never a partial verdict); **shall** treat any content that
  does not parse against the §A.2 schema (including an absent/unknown
  `schema` value or a multi-block comment) as inert; **shall** itself
  select the latest covering admissible record per owed pair from the
  platform's comment order; **shall not** count any review not recorded
  on the PR (session context is never a record); and **shall not**
  mutate, or require mutation of, any existing record.
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
- **INV13 (union owed-set).** For a PR touching multiple files, the check
  **shall** require the union of every changed file's owed reviews, all
  satisfied at HEAD.
- **INV14 (sole path exemption, AC5).** The declared non-behavioral
  allowlist **shall** be the only path exemption the check honors; its
  entries **shall** be explicit repo-relative paths (never a class,
  glob, or directory); and the check **shall** honor an entry only if
  the file passes the prose predicate (declared prose extension, no
  shebang) — a code-bearing path **shall never** be exempted through it.
- **INV15 (reason grammar, AC6).** For every un-green row, the check
  **shall** emit at least one reason from the §D enum —
  `never-reviewed`, `changed-since-review`, `upstream-<path>-changed`
  (naming the file), `review-failed` (linking the record's findings),
  `upstream-indicted` (naming the upstream; routing to its layer),
  `self-reviewed`, `vacuous-evidence`, `awaiting-human-approval` (naming
  the artifact and its status), `no-reviewable-upstream`,
  `unresolvable-reference` (naming the id(s)), `record-rejected` (naming
  the record and cause) — and **shall** emit the per-row derivation
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
- **S7 (non-record content is inert, AC10/AC1).** *Given* a PR comment
  containing prose claiming "conformance passed" plus a malformed
  `grove-verdict` block that fails the §A.2 parse (or a comment carrying
  two `grove-verdict` blocks), *When* the check runs, *Then* neither
  counts as a record and the owed pair stays **red** with reason
  `never-reviewed` (fail-closed by non-recognition). *And given* a
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
