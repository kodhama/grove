---
id: adr-0022-strict-mode-review-friction
type: adr
status: approved  # maintainer intent act (in-session approval), 2026-07-19 — recorded flip per lifecycle.md; decision-adversary SOUND (non-blocking D5 precision folded pre-gate); author (shaper) ≠ approver; the PR merge is the ship/landing act
depends_on: [adr-0012-methodology-delivery-machinery, adr-0013-check-scope-mode, adr-0015-reviewer-machine-boundary, adr-0016-implements-edge-taxonomy, spec-0002-review-bookkeeping-check]
owner: agent
updated: 2026-07-19
---

# ADR-0022: strict-mode review friction — settle grove#69

> **`gated` — converged, awaiting review.** grove#69 catalogued
> strict-mode false-positive owed reviews from the math-quest testbed and
> proposed candidate fixes for weighing, not decided. A design-space map
> against the check code (`plugins/grove/check/`) and the governing
> contract (`spec-0002`) shows the issue's headline fix is a trap, its
> useful piece is already half-shipped, and the change that would most
> help grove-self is out of the issue's scope. This decision settles all
> four dispositions so #69 is not re-litigated. All questions are Decided
> (**D1–D5**); the shaper self-checked to `gated` and routes to the
> `decision-adversary`, then the intent gate.
>
> The shape in one breath: **D1** adopt **P1(b)** — the explicit per-file
> `non_behavioral_allowlist` is the sanctioned remedy for orientation
> prose; the one build is a **presentation-only remedy-hint** that names
> that cure on a `no-reviewable-upstream` prose row (modeled on the
> existing §D round-3 hint). **D2** reject **P1(a)** auto-exempt-by-rule —
> it recreates the review-free-zone `adr-0013` explicitly rejected and
> violates `INV14`/`adr-0012` AC5. **D3** decline **P1(c)** a `prose`
> type — it cannot reach the no-frontmatter files it targets without
> forcing frontmatter onto them (breaks vendoring), for no gain over D1.
> **D4** park **P2** metadata-only waiver with a named trigger — its safe
> shape is low-value, its powerful shape re-opens the `adr-0015`
> fingerprint basis. **D5** scope boundary — grove-self's `reference/**`
> reds are code-classified and out of every P1 candidate; that lever is
> grove#40, not this decision.

## Decision state

### Decided

- **D1 — Adopt P1(b): the allowlist is the remedy; add a presentation-only
  remedy-hint.** The explicit `non_behavioral_allowlist`
  (`policy.mjs:241-250`, applied `check.mjs:112`) is already the coded and
  documented remedy for README-class orientation prose
  (`charters/review-policy.md:66-91`) and is math-quest's deployed answer.
  It needs no mechanism change. The single build is a **§D remedy-hint**:
  on a red row whose reason is `no-reviewable-upstream` and whose subject
  is **allowlist-eligible** (no frontmatter, extension ∈ `prose_extensions`,
  not a shebang, not already allowlisted), the view names the allowlist
  cure — exactly as the existing round-3 hint (`view.mjs:57-66`) names the
  `reviewless_types` cure for an unclaimed type. **Presentation-only: no
  verdict, reason token, or INV changes** (`check.mjs:118-124` discipline).
  Rationale: the friction #69 P1 names is *discoverability* of a cure that
  already exists, not a missing capability — so the minimal fix surfaces
  the cure, it does not automate it.

- **D2 — Reject P1(a) (auto-exempt non-artifact prose from fidelity
  reviews).** In the type model a file with no leading `---` frontmatter
  *is* `code` (`check.mjs:94`); "prose that has no `implements:`" therefore
  collapses to **"any `.md`/`.txt` with no frontmatter"** — a path-class,
  extension-gated exemption for code-classified files. That directly
  contradicts three standing decisions, verified:
  - `adr-0013` explicitly rejected it: *"**Allowlist globs / directory
    exemptions.** INV14 exists because a path-class exemption is the
    review-free-zone attack; reopening it to solve friction would trade a
    real defense for convenience. **Rejected.**"* (`adr-0013:189-191`).
  - `INV14` (`spec-0002`): the allowlist *"shall be the **only** path
    exemption… explicit repo-relative paths (never a class, glob, or
    directory)."*
  - `adr-0012` AC5: the allowlist is *"never a review-free zone for
    code"* (`adr-0012:374-377`).
  Reduces gate coverage by default for every install to solve a
  discoverability problem D1 solves without touching the defense.

- **D3 — Decline P1(c) (a first-class `prose`/`orientation` reviewless
  type).** A type is read only from **leading frontmatter**
  (`frontmatter.mjs:7`), but the target files (CLAUDE.md, per-dir READMEs,
  the vendored `reference/**` copies) have **no** leading frontmatter, so
  they classify as `code` and never reach the reviewless branch. P1(c)
  works only if `---\ntype: prose\n---` is *added* to each such file —
  which breaks byte-for-byte vendoring of the `reference/**` copies against
  their canonical sources. It also brushes `adr-0013`'s "more reviewless
  types" rejection (`adr-0013:192-196`). No net gain over D1 for real
  orientation prose; declined.

- **D4 — Park P2 (metadata-only waiver) with a named trigger.** The
  friction is real (a 1-line `updated:` bump owes the full fidelity set),
  but every *safe* implementation is narrow and every *powerful* one is
  risky:
  - `implements:`, `depends_on:`, and `status:` are all normative —
    `implements`/`depends_on` are flow- and drift-bearing (`adr-0016`:
    an upstream change obligates a downstream re-check), `status` is the
    human-gate field (`INV10`/`INV17`). A safe "metadata-only" predicate
    therefore excludes all of them and collapses to *"only `updated:`-style
    keys changed"* — low value.
  - The safe shape (owed-derivation waiver) also needs a **per-file base
    blob the pipeline does not currently carry** (`runCheck` sees HEAD
    only, `git-adapter.mjs:106-118`) — real plumbing for that low value.
  - The powerful shape (compute `grove-fp-1` over the normative body, not
    the whole file) re-casts the **shared basis the emitter imports by
    construction** (`adr-0015` Decision 2, `basis.mjs`/`emit.mjs`) — the
    permanently-stale-record surface. Not worth re-opening on spec.
  - **Trigger:** *when the math-quest #309 strict-noise experiment shows
    metadata-only churn is a large enough share of owed rows that the
    maintainer judges it worth the base-blob work.* Until the trigger
    fires, building it is machinery ahead of need (`inv-minimal-first`).

- **D5 — Scope boundary: grove-self's `reference/**` routine-green is out
  of scope (it is grove#40).** grove-self's recurring `no-reviewable-
  upstream` reds are its **vendored `reference/**` copies** — code-
  classified (no leading `---` frontmatter), with non-prose extensions for
  the `.toml`/`.yml` carriers and no ancestor `test-deps.md`. **None of
  P1 a/b/c turns them green.** The `.toml`/`.yml` carriers are not prose,
  so D1's hint never fires and they stay structurally red. The vendored
  `.md` copies (`versioning.md`, `lifecycle.md`, `agents/*.md`) *are*
  allowlist-eligible, so D1's hint **does** render on them — but the hint
  is presentation-only: it turns no red green, and whether a *vendored*
  copy should be allowlisted at all (vs. fixed by copy-sync) is a per-file,
  human-owned call (`INV14`/`adr-0012` AC8) that belongs to **grove#40**.
  The real routine-green fix — a `reference/`
  ledger or vendored-copy conformance — is entangled with **grove#40**
  (charter/copy-sync) and is a distinct decision. Named here so "grove#69
  is resolved" is not mistaken for "grove-self is routine-green": it is
  not, and this decision does not claim to make it so.

## Given (inherited — cited, not reopened)

- **`adr-0012`**: the owed-review policy and its integrity guarantee — the
  non-behavioral allowlist is the only path exemption, README-class only,
  never a review-free zone for code (AC5); policy changes are human-owned
  (AC8).
- **`adr-0013`**: strict vs scoped mode; the fail-closed default; the
  explicit rejections of glob/class exemptions and of minting reviewless
  types to solve untyped-`code` friction.
- **`adr-0015`**: reviewer/machine boundary — the emitter imports the
  check's fingerprint/basis by construction; a basis re-cast is a
  correctness surface (grounds D4's caution).
- **`adr-0016`**: `implements`/`depends_on` are flow/drift-bearing, hence
  normative (grounds D4's key exclusions).
- **`spec-0002`** (approved, `@v4`): the governing contract — §B owed-map,
  §C.2 classification, `INV14` allowlist rule, §D remedy-hint mechanism.

## Rejected options

- **P1(a) — auto-exempt by rule** (D2): rejected; recreates the exemption
  class `adr-0013` already rejected.
- **P1(c) — `prose` type** (D3): declined; cannot reach no-frontmatter
  files without breaking vendoring.
- **P2 — build the metadata-only waiver now** (D4): not rejected — parked
  with a named trigger. Recorded so its pros (real churn relief) are not
  lost with the parking; the fork reopens if the trigger fires.

## Consequences / propagation (POST-approval executor work)

This set is firm — the executor pass implements it; new discoveries append
here, never silently expand scope:

1. **Remedy-hint (D1).** Add a `remedy`-marker variant in `check.mjs`
   keyed on `reason == no-reviewable-upstream ∧ subject allowlist-eligible`
   (no frontmatter, prose extension, not shebang, not already in
   `non_behavioral_allowlist`), and a `remedyHint` branch in `view.mjs`
   naming the `non_behavioral_allowlist` cure. Reuses the existing
   presentation-only marker/render seam (`check.mjs:118-124`,
   `view.mjs:57-96`); changes no verdict, reason token, or INV.
2. **`spec-0002` §D.** Document the new hint alongside the round-3 hint.
   **Version-significance is an executor+conformance call:** the existing
   round-3 hint is presentation-only and rendered on red rows (not the
   INV19-frozen green banner), so if the §D addition is judged purely
   presentational, **no bump**; if it is judged to touch a testable clause,
   bump `@v4 → @v5` with the standard amendment ceremony (this ADR is the
   durable decision the bump requires). Default lean: no bump, matching the
   round-3 hint's own treatment — but the reviewer decides, not this ADR.
3. **Tests.** `test/view.test.mjs` (hint renders for the prose case) and
   `test/check.test.mjs` (marker fires on an allowlist-eligible prose file;
   **does NOT fire** for a non-prose code file with `no-reviewable-upstream`
   — AC2 regression guard).
4. **`charters/review-policy.md`.** Verification item, expected no-op: the
   allowlist is already documented as the orientation-prose remedy
   (`:66-91`); confirm no wording change is needed.
5. **grove#69 closes with this decision's landing** — P1(a) rejected,
   P1(b) adopted+hinted, P1(c) declined, P2 parked (trigger named), the
   `reference/**` split routed to grove#40. The P2 park trigger is recorded
   on grove#69 (not a new issue), reopening only if the trigger fires
   (`adr-0021` D4 precedent).

## Design constraints (honored while shaping — not open questions)

- **INV14 is preserved, not relaxed.** D1 makes the *existing* explicit-
  path remedy discoverable; it does not add an automatic exemption. The
  allowlist stays explicit-repo-relative-paths-only.
- **Presentation-only discipline (INV19).** The hint changes no verdict,
  reason token, or green-banner byte-identity — same contract the round-3
  hint already meets.
- **No new pipeline input.** P2's base-blob plumbing is parked, not built;
  `runCheck` still sees HEAD only.
- **`inv-minimal-first`.** One presentation-only hint; every other
  disposition is record-keeping (reject / decline / park / scope-note),
  adding no mechanism.

## Acceptance criteria (for the post-approval executor pass)

- **AC1**: a strict PR touching a no-frontmatter, prose-extension,
  not-yet-allowlisted orientation file renders a hint naming the
  `non_behavioral_allowlist` cure on its `no-reviewable-upstream` row; the
  row's verdict and reason tokens are byte-unchanged.
- **AC2**: the hint does **not** render for a non-prose code file
  (`.toml`/`.mjs`/`.yml`) with `no-reviewable-upstream` — its cure is a
  ledger, and a misdirected "allowlist it" hint would be wrong.
- **AC3**: the existing round-3 unclaimed-type hint is byte-unchanged;
  both check-package suites + typecheck green; the review-bookkeeping
  check passes on the PR.
- **AC4**: grove#69 is closed with the four dispositions recorded and the
  P2 park trigger named on the issue.

## Self-check (gate → `gated`)

- **Internal coherence**: D1 (surface the cure) and D2 (reject
  auto-exemption) compose without tension — the decision reduces friction
  *by* pointing at the human-owned explicit remedy, precisely so it need
  not relax the INV14 defense D2 upholds.
- **Contradiction sweep vs standing decisions**: D2 *aligns with*
  `adr-0013:189-191` + `INV14` + `adr-0012` AC5 (upholds, not contradicts);
  D4's key exclusions align with `adr-0016`. No standing decision is
  contradicted; none is edited in place.
- **Build-on-settled-ground**: rests only on approved
  `adr-0012`/`0013`/`0015`/`0016` and approved `spec-0002@v4`.
- **`inv-minimal-first`**: the only new mechanism is one presentation-only
  hint; the decision's weight is in *not* building (P1a/P1c/P2) and
  recording why.
- **Honest scope**: D5 states plainly that this does not make grove-self
  routine-green — the load-bearing negative claim, surfaced not buried.
