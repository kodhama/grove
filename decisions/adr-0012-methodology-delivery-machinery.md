---
id: adr-0012-methodology-delivery-machinery
type: adr
status: gated
depends_on: [adr-0005-tdd-and-artifact-gated-dispatch, adr-0006-operational-conformance-mechanism]
informed_by: [adr-0007-code-reviewer-agent]
owner: agent
updated: 2026-07-16
---

> **Provenance.** Opened from grove#59: an agent with the full grove roster +
> trellis overlay loaded still, unprompted, (1) combined spec-author and
> builder in one pass, (2) ran only the conformance gate when the work owed
> conformance + code-review + spec-adversary, and (3) let a conformance PASS
> stand after the spec it validated was revised underneath it. Each was caught
> only by the maintainer in real time; no mechanism fired (math-quest PR #278).
> A **delivery** finding — the principles were loaded and did not fire — so the
> fix must be machinery, **not more prose**.
>
> The full shaping conversation and every adversarial review are
> preserved in [`adr-0012-shaping-log.md`](adr-0012-shaping-log.md)
> (provenance, deliberately *not* in the dependency graph — agents consuming
> this decision do not load it). This file is the decision; that file is the
> *why*.

# ADR-0012: reviews become checkable records — mechanize the review bookkeeping, leave judgment to humans

## Decision in brief (plain language)

**The problem.** grove's methodology says "review your work independently, run
every review it owes, don't trust a review a later edit invalidated" — but it
says so in *prose*, and prose didn't fire. A fully-equipped agent still
combined author + builder, ran 1 of 3 owed reviews, and trusted a review a
later edit had made stale. Every miss was caught by a **human doing
bookkeeping**, not judgment.

**What we're deciding.** Make the *bookkeeping* mechanical so the human is left
with *judgment*. Ship this now (the buildable part, "Layer A"):

1. **Reviews become records on the pull request — the session is only working
   memory.** Each reviewer (conformance, code-review, spec-adversary, or the
   new **decision-adversary**) posts its verdict as a **structured comment on
   the PR**: the verdict, a fingerprint of exactly what it reviewed, who
   produced vs. who reviewed, and its findings — one act, one channel, in the
   place humans already read. The comment is the **commit point**: a review
   that lives only in a session's context does not count (a session
   "remembering" its reviews is precisely what failed in #278). Records are
   **append-only by convention, enforced where the platform allows** (fifth
   pass, F2): a re-review posts a new record; the check **rejects any record
   whose comment was edited** (platform edit-history) and restricts who may
   post records — so a FAIL quietly *edited into* a PASS is caught; a
   *deleted* record is undetectable and stays conceded to the human's
   judgment, disclosed not denied. The "which steps ran, and did they pass?"
   summary is a **status view the check renders** from the records —
   computed, never stored.
2. **An automated check does the bookkeeping.** On every PR a check — reading
   its rules from the protected main branch, so a PR can't weaken its own gate
   — asks and goes red on any "no": *completeness* (does everything that owes a
   review have one? — fixes "only 1 of 3 ran"), *freshness* (was each review
   done against the current content? — fixes "stale review trusted"),
   *coverage* (do the reviews cover everything that changed?), and
   *separation* (was the reviewer a different agent than the producer?). It
   recomputes the fingerprints itself and trusts no agent's word.
3. **What the machine does NOT do — and says so out loud.** It cannot tell
   whether a review was *genuine* (an agent could post a fake verdict record),
   and the separation check reads *self-reported* author/reviewer tags — so it
   catches the **accidental** fusion that actually happened, but not a
   **deliberate** forgery. And it does not run unattended. **A green check
   means "the bookkeeping is done — now a human judges genuineness and merges."
   Green is explicitly not "approved."** Forgery-proof separation, genuineness,
   and full autonomy need identity/attestation infrastructure grove doesn't
   have yet; they are a later increment ("Layer B"), named honestly, not
   pretended.

**Why this shape.** The pipeline is framed as **TDD applied layer by layer**:
each artifact is built to satisfy the acceptance criteria of the one above it
(code satisfies the spec; the spec satisfies the decision), and a failed review
routes the fix to whichever layer is actually wrong. Nobody hand-writes "the
workflow" — it *emerges* from each artifact declaring what review it owes.

Reviews split into **two orthogonal questions**. **Fidelity** — "does it
faithfully derive from its upstream?" — is asked by ONE instrument, the
`conformance-reviewer`, at every layer with an artifact upstream
(spec→decision, code→spec, charter→ADR), together with graph integrity (pins
resolve, propagation claims true). **Quality** — "is it good, judged as the
thing it is?" — is asked by a specialist per layer (`decision-adversary`,
`spec-adversary`, `code-reviewer`). The code layer already worked exactly this
way (`adr-0007`); this decision extends the same split up the stack, narrowing
the `spec-adversary` to pure intrinsic quality — its old fused fidelity duty
was compensation for the missing decision-adversary, which this decision
charters. **The quality reviewer's input is the artifact alone** (fifth pass,
F6): scope-completeness against the upstream is fidelity's question, never
quality's — so a quality verdict is honestly bound to exactly what it read.
Efficiency falls out: an upstream edit invalidates only the fidelity verdict,
never the quality one. One route the split must not orphan (F3): "the
artifact is *faithful*, but its **upstream** is wrong" — the old fused
`UNSOUND` — now lives in the fidelity instrument: the `conformance-reviewer`'s
grammar gains an **`UPSTREAM-INDICTED`** verdict, routing to the upstream's
layer (a decision-layer indictment always to the human).

A general principle runs through all of it: **anything derivable from the
artifacts is computed at check-time, never stored** — so it cannot drift from
its source. The owed-map is *assembled* from the charters' declarations (not a
generated file); the status view is *rendered* from the verdict records (not a
stored ledger); freshness is *recomputed* from HEAD (not trusted from the
record). Only irreducible inputs are stored: the artifacts, the verdict
records, and the human's intent acts.

**How we know it isn't hand-waving.** This decision was run through **four
independent adversarial reviews** — the discipline it prescribes. The first two
broke earlier, more ambitious versions; the third validated the
per-verdict-file Layer A ("blocked on finishing the spec, not on
infrastructure"); a fourth caught a later repackaging (one shared ledger) that
regressed it on write-concurrency and drove a revert. **Two structural
amendments postdate the fourth pass** — the fidelity/quality split, and
verdict-records-as-PR-comments replacing per-verdict *files* — made on the
maintainer's calls (2026-07-16). A **fifth pass** (2026-07-16, run as the
decision-adversary this decision charters) returned **NEEDS-REVISION** on
those amendments; its must-fixes are revised into this text (the explicit
approved-upstream gate, record-integrity enforcement over editable comments,
the `UPSTREAM-INDICTED` route, the implements-edge definition, disclosure of
the approval-field trust), findings preserved in the shaping log. (Full
trail: the shaping-log companion.)

## The problem this decision frames

Prose + agent vigilance does not hold for load-bearing sequencing. Three
guarantees the methodology *states* but does not *enforce* — role separation,
gate completeness, gate freshness — each failed in a single session despite
being loaded, and each was caught only by a human acting as the backstop for
*"did the process run,"* not for *judgment*. The methodology's own goal is that
the human is the backstop for judgment. This decision moves the bookkeeping off
the human's shoulders onto machinery.

## Intended effects (the guarantees this decision must produce)

- **E0 — Recursive TDD is the generative core (for the spec ↔ code layers).**
  Each artifact is built **test-first against its upstream**, where the
  upstream's acceptance criteria *are* the test (the decision is the spec's
  test; the spec is the code's test). Forward construction builds each layer to
  pass its upstream-test; a failed review is "fix it at the layer it indicts" —
  locally if this layer is wrong, upstream if the test itself is wrong. The
  recursion bottoms out at the **decision layer**, whose "test" is human intent
  (checked by the human gate, not built test-first), and where a repair is
  **supersede** (append-only), not edit-in-place.
- **E1 — No unreviewed work merges, and none builds on thin air.** Every
  artifact reaching the final state carries a fresh, independent review
  appropriate to what it is — **fidelity** to its upstream (the
  `conformance-reviewer`, wherever an artifact upstream exists) plus its
  layer's **quality** gate (`decision-adversary` / `spec-adversary` /
  `code-reviewer`) — and was built against an **approved upstream**:
  never a conversation, a draft, or a merely `gated` artifact. "Did the
  review run?" and "was there
  anything to review against?" are never a human's job to check.
- **E2 — Iteration is free of ceremony; only the endpoint is gated.** Authors,
  builders, and reviewers churn mid-flow; the gate judges only the final state.
  No fixed pipeline is imposed on how the work gets there.
- **E3 — Specialists stay separate.** Author, builder, and reviewer run as
  distinct cold specialists by default (protected for the *quality* of
  specialized runs, not only independence); the check enforces author ≠
  reviewer from self-reported tags, catching accidental fusion. Forgery-proof
  separation is Layer B.
- **E4 — A stale verdict is never trusted.** A review is bound to what it
  reviewed; change the reviewed thing and the review stops counting —
  automatically, never by someone remembering.
- **E5 — No one holds "the workflow."** The pipeline emerges from simple local
  rules on agents/artifacts (trigger rules, owed-review rules, and agent
  method/boundary rules), composed with grove's existing invariants; the
  enforcing check is generated from those same rules. Adding or swapping an
  agent recomposes the system with no central flow to edit.
- **E6 — The human backstops judgment, not bookkeeping.** The bookkeeping is
  mechanical, so the human spends attention only on intent — approving,
  judging genuineness, or overriding with recorded rationale — never on "did
  the process run." A green check is presented as "bookkeeping done, now you
  judge," never as authorization to merge.
- **E7 — The whole process is bounded: it converges or escalates, never
  loops.** A revise ↔ re-review cycle that does not converge stops loudly and
  hands to the human (grove already bounds repair cascades and auto-resumes at
  generation 2, then demands a maintainer stop). Under human-in-the-loop v1 the
  human bounds a stuck PR; a mechanical, force-push-stable bound for full
  autonomy is Layer B.

## Considered and rejected

- **Only CI, or only a structural default** — rejected: a default alone leans
  on the agent following it, the exact thing that failed; a check alone loses
  the specialization quality of separate cold runs. Both layers are needed.
- **Drop role separation** — rejected: the reviews check output *consistency*,
  not the specialization *depth* a cold author + cold builder each deliver.
- **Per-commit separation (author ≠ git committer)** — rejected: squash /
  rebase / co-authorship make commit authorship an unreliable signal; the
  separation signal is the verdict record's self-reported producer vs.
  reviewer, not git metadata.
- **Per-review verdict FILES committed to the branch** (the interim model,
  passes 3–4) — superseded (maintainer, 2026-07-16) by
  verdict-records-as-PR-comments: files accumulated merge residue in `main`,
  required an exempt tree path that two adversarial passes attacked as a
  review-free zone, split the reviewer's output across two channels (file +
  findings comment), and still contended on the branch push. Append-only
  records have none of these, and edited records are rejectable via platform
  edit-history (deletion stays conceded, disclosed). Cost accepted: a
  platform-coupled read path — symmetric with
  grove's existing "any tracker with threaded comments plus reviewable
  change-requests" portability baseline.
- **The fused spec-adversary (fidelity + quality in one gate)** — superseded
  (maintainer, 2026-07-16): the fusion was compensation for the missing
  decision-adversary (its `UNSOUND` verdict was the only decision-layer
  backstop); with the decision-adversary chartered here, the fusion's reason
  is gone — and it over-invalidated (a decision edit spuriously voided the
  spec's *quality* verdict, not just its fidelity one). Fidelity moves to the
  `conformance-reviewer`, uniformly, at every layer.
- **A content-classifier for owed reviews** — rejected for reading the
  artifact `type` from frontmatter (no-frontmatter = code): reuses the existing
  contract, no parser invented.
- **The ambitious fully-autonomous version** (credentialed verdict-emitter
  skill, live-derived check, self-generating dispatcher) — rejected after two
  adversarial passes: it presupposed run-attestation, a forge-resistant verdict
  store, and protected-policy resolution grove does not have, and the
  credentialed emitter was a confused deputy (any agent could emit a trusted
  verdict). Retained as the **Layer B** target, gated on that infrastructure.

## Consequences (on approval; execution is a follow-up, not this PR)

This decision **authorizes a spec**; it does not implement the machinery. On
approval:

- **A spec is written** defining the verdict-record format, the owed-review
  derivation, and the check's logic.
- **A verdict-record convention** is introduced — each reviewer posts one
  **structured comment on the PR** per review: verdict token +
  subject-manifest + fingerprint + producer/reviewer attribution + findings,
  in one act. Records are **append-only** (a re-review posts a new record; the
  latest per review counts; the full sequence stays visible; the check rejects
  edited records — F2). **The check renders a read-only status view** from the
  records, per (file × owed review) *with the reason* anything is un-green
  (never-reviewed / changed-since-review / upstream-X-changed /
  review-failed→findings / self-reviewed / vacuous-evidence). Nothing lands in
  the repo tree: no merge residue, no exempt verdict path to defend.
- **The owed reviews derive from what the PR changed, by ONE rule** — *every
  changed artifact owes fidelity-conformance iff it has an artifact upstream,
  plus its layer's quality gate.* **"Artifact upstream" means the
  *implements* edge** (fifth pass, F5) — the layer a type realizes: a spec
  implements a decision; code implements a spec; a charter implements its
  ADR. Mere *builds-on* citations are not it: a decision's `depends_on` names
  decisions it builds on and owes **no** fidelity review (its upstream is
  human intent) — without this distinction the rule would misfire on
  decisions, this one included. **The edge is machine-readable** (added on the
  spec-0002 conformance pass's upstream indictment, 2026-07-16 — the
  type-realization definition gave the check no selector when `depends_on`
  lists several same-type ids): an artifact that realizes a contract names it
  in an explicit **`implements:` frontmatter field** (one id — the
  `adr-0011` relations-taxonomy pattern, which split `informed_by` out of
  `depends_on` the same way); **code names its specs via the test-deps
  ledger**, as already pinned. A fidelity-owing artifact with **no**
  `implements` declaration has no reviewable upstream → **red** (`adr-0005`
  dec 3, fail-closed). The **mechanical half of graph integrity** —
  every changed artifact's `depends_on` ids resolve — is computed by the
  check itself for all types (pure f(A)); the judgment half (propagation
  claims true) rides the fidelity review where owed, else the human. The
  rule's inputs are **assembled at run-time from the charters'
  machine-readable declarations** (each reviewer declares what it reviews),
  read from the protected default branch — changing what a type owes is a
  charter edit, nothing to regenerate. Projection today:
  - research / feedback-only change → **nothing owed**;
  - a decision → **decision-adversary** + the human intent gate (no artifact
    upstream to conform to);
  - a spec → **conformance (→ its decision) + spec-adversary**;
  - a charter → **conformance (→ its ADR)**;
  - code → **conformance (→ its spec, resolved via the `adr-0006` test-deps
    ledger) + code-reviewer**;
  - a new/undefined `type` → **the full set** — an explicit fail-closed check
    rule (AC4), since pure assembly would fail *open* for an unclaimed type.
- **A PR may touch anything — no single-stage rule.** It can carry several
  research passes, shaping runs, specs, code, in any mix. The owed-set is the
  **union** of what *everything* it changed owes; the check goes green only
  when all of it is present, fresh, covering, passed — and the
  approved-upstream gate below holds — **all at HEAD**.
- **The approved-upstream gate is an explicit check rule** (revised per the
  fifth pass, F1 — the earlier "needs no new rule" derivation cited the
  *fused* spec-adversary, which the split retired, and misread `adr-0005`
  dec 3, which accepts a merely-`gated` upstream): **every owed fidelity
  review's upstream artifact must be `status: approved` at HEAD** — a draft
  or gated upstream keeps the downstream red until the human approves it,
  in-PR or prior. Bundling is allowed; skipping an upstream's approval by
  bundling is not. *Disclosed limit (F4):* the check reads approval from
  frontmatter, a field an agent *could* flip; binding it to a verifiable
  human act (platform required-review; grove#38) is Layer B — until then an
  agent-flipped `approved` is the same conceded class as record genuineness,
  judged by the human at merge.
- **Separation is checked from the verdict record** (F7 — one authority at
  every layer, code included): each record's self-reported `producer` and
  `reviewer` fields must differ for an owed review. Artifact frontmatter MAY
  carry an author tag as provenance; the record fields are what the check
  reads.
- **A new automated check** is added (grove has none today) that reads its
  policy from the protected default branch and enforces completeness,
  freshness, coverage, separation, the approved-upstream gate,
  graph-resolution, and record integrity — on existing GitHub primitives
  (protected branches + Actions), no new platform infrastructure.
- **The setup skill** installs the check *harness* (a thin CI runner) once —
  but the *policy* it applies is not baked in; the harness assembles the
  owed-map live from the charters at run-time (above). Replaces the setup
  skill's current "check by hand" fallback.
- **Reviewer charters are updated (consolidate, not accrete):** every reviewer
  posts verdict records; the **`conformance-reviewer` is stated once as the
  fidelity instrument at every layer** — spec→decision joins its existing
  code→spec and charter→ADR duties (an extension into territory `adr-0006`
  leaves unassigned — verified: nothing assigns spec→decision elsewhere, and
  its flagged-consumer route never fires for unversioned decisions — F9) —
  **plus graph integrity's judgment half** (propagation claims true; the
  mechanical pins-resolve half is the check's own, above); the
  **`spec-adversary` narrows to intrinsic quality** (testability, internal
  consistency, ambiguity an executor would guess at, edge coverage).
  **Producers / artifact types** declare the reviews they owe, and an
  artifact that realizes a contract declares it in the `implements:`
  frontmatter field (code: via the test-deps ledger).
- **A `decision-adversary` role is chartered** — the real independent
  soundness-adversary for decisions (retiring the spec-adversary stand-in); a
  decision owes its verdict *plus* the human intent gate. **Its remit,
  normative here (F8):** break a decision on **internal coherence,
  contradiction with standing decisions, argument soundness, and
  build-on-settled-ground** — never "is this what the human wants" (the human
  gate's axis). Verdict grammar: **SOUND / NEEDS-REVISION / UNSOUND**.
  **Load-bearing for the split:** with the spec-adversary narrowed, this is
  the decision layer's only adversary — the split and this role ship together.
- **The dispatcher charter's W1–W6 are demoted** from prescriptive workflows to
  descriptive examples; the per-artifact owed/trigger rules become the source
  of truth (a consolidation, not new prose).
- **No existing decision is superseded.** adr-0006's conformance scope is
  *extended into territory it leaves unassigned* (it assigns spec→decision to
  no one, and is additive-silent on the extension — verified against its text;
  "precedent" would overstate it, F9) — recorded as a forward pointer, not a
  supersession.
- **Explicitly deferred to Layer B** (a separate future program, gated on
  infrastructure grove lacks, relates to grove#38): run-attestation so a
  verdict proves a genuine non-producer review ran; forgery-proof separation; a
  forge-resistant verdict store; autonomous loop-bounding. Until then those are
  the human's at merge, disclosed not pretended.

## Acceptance criteria (for the execution wave this decision authorizes)

- **AC1 — completeness.** The check goes red if any changed file that owes a
  review lacks a fresh, passing verdict for it.
- **AC2 — freshness.** The check **recomputes** each verdict's subject
  fingerprint from HEAD and goes red on mismatch — never trusting the
  fingerprint the emitter recorded.
- **AC3 — coverage.** The check derives the owed set from the PR diff and
  requires the verdicts' manifests to **cover** it, not merely to exist.
- **AC4 — fail-closed.** A changed file of a new or undefined `type` owes the
  **full** review set, never nothing.
- **AC5 — policy integrity.** The owed-review policy (the charters' review
  declarations) resolves from the protected default branch, never PR HEAD; the
  only path exemption is the declared **non-behavioral allowlist** (README-class
  files), never a review-free zone for code — with verdicts living as PR
  records, **no verdict path exists in the tree to exempt or defend**.
- **AC6 — green is non-authorizing.** A green check surfaces the verdict
  records (with per-item reasons when un-green) for human reading and is
  presented as "bookkeeping done," never "reviewed / safe to merge."
- **AC7 — separation (accidental case).** Every verdict record carries
  self-reported `producer` and `reviewer` fields — **the record is the single
  separation authority at every layer** (fifth pass, F7; no code-file tags;
  artifact frontmatter author tags are optional provenance only) — and the
  check goes red when they match for an owed review. Deliberate forgery of the
  fields is out of scope (Layer B), disclosed.
- **AC8 — honest disclosure.** The shipped artifacts state plainly what is
  **not** guaranteed (genuineness, forgery-proof separation, autonomy) and that
  authenticity and policy changes are human-owned.
- **AC9 — decision-adversary.** The `decision-adversary` role exists; a
  decision's owed set includes its verdict plus the human intent gate.
- **AC10 — no infra pretence.** Nothing depends on unbuilt infrastructure:
  verdicts are append-only records on the change-request, artifacts and their
  history live in git, and the check uses existing platform primitives
  (protected branches + CI + the PR record stream).
- **AC11 — adr-0006 pointer.** A forward pointer records the per-layer
  conformance extension as entering territory adr-0006 leaves unassigned (no
  supersession, no contradiction).
- **AC12 — approved upstream.** The check goes red when any owed fidelity
  review's upstream artifact is not `status: approved` at HEAD — a draft or
  merely-`gated` upstream blocks its downstream. Disclosed limit: `status` is
  frontmatter an agent could flip; binding approval to a verifiable human act
  is Layer B (grove#38).
- **AC13 — resolvable graph.** Every changed artifact's `depends_on` ids
  resolve at HEAD — computed by the check itself; red otherwise.
- **AC14 — record integrity.** The check rejects records whose comment was
  edited (platform edit-history) and records from unauthorized authors;
  record *deletion* is disclosed as undetectable (Layer B), never claimed
  caught.

## Open questions (parked, ≤3)

- **Layer B — the autonomy/attestation increment.** Run-attestation,
  forgery-proof separation, a forge-resistant verdict store, and autonomous
  loop-bounding — the guarantees that let verdicts be trusted with no human in
  the loop. A separate program gated on infrastructure grove lacks; relates to
  grove#38. Not this decision.
- **A terser decision corpus** (grove#62) — an information-preserving rewrite
  verifier (possibly the `decision-adversary`) + append-only guardrails, so
  older decisions can be trimmed the way this one's trail was split out.
  Surfaced during this decision's own restructure; its own `[consider]`.

## Self-check (gate)

- **Frontmatter:** `id`/`type`/`status`/`depends_on`/`owner`/`updated` present
  and well-typed; `informed_by: [adr-0007]` records the code-reviewer gate
  model this generalizes (`relations.md`). PASS.
- **`depends_on` resolution:** `adr-0005` and `adr-0006` resolve and are
  `approved`; a `gated` artifact consuming `approved` ones is legal. PASS.
- **Required sections:** Decision-in-brief, Context, Intended effects,
  Considered-and-rejected, Consequences, Acceptance criteria, Open questions
  (2, ≤3), Self-check — present. PASS.
- **Append-only:** new artifact; no ratified decision superseded; in-place
  amendment is legal while `gated` (append-only binds ratified decisions), and
  the superseded interim choices (verdict files; fused spec-adversary) are
  recorded in Considered-and-rejected with their why-nots, not erased.
  adr-0006's conformance scope is *extended consistently* (it already has the
  `conformance-reviewer` re-derive any flagged consumer, and assigns
  spec→decision to no one else) — a forward pointer, not an in-place edit.
  PASS.
- **Naming register (`adr-0002`):** defining text uses `agent`/role names; no
  `druid`/`archdruid`. PASS.
- **Independent review — four passes, honestly reported:** FOUR independent
  adversarial passes ran (preserved in the shaping-log companion). The first
  two broke earlier ambitious versions; the third validated the
  per-verdict-file Layer A; the fourth caught a one-shared-ledger repackaging
  that regressed write-concurrency (and caught this file briefly carrying the
  third pass's validation onto that unreviewed repackaging — corrected) and
  drove the revert to the validated per-file model + rendered view. The builder
  did **not** grade its own work. PASS.
- **Honest limits disclosed, not buried:** Layer B (genuineness, forgery-proof
  separation, autonomy) is out of scope; "green is non-authorizing" is a stated
  principle (AC6); separation is disclosed as accidental-case only (AC7). PASS.
- **Scope discipline:** delivers completeness and freshness (the two reported
  failures mechanizable without infrastructure) and the accidental-fusion case
  of separation; no infrastructure pretended. PASS.
- **What is validated vs. amended (honest, not glossed):** the *mechanics
  core* — CI-computed completeness/freshness/coverage over agent-posted
  verdict records, policy from the protected branch — is the pass-3-validated
  shape. The two 2026-07-16 structural amendments (fidelity/quality split;
  records-as-comments) went through a **fifth adversarial pass** the same day:
  verdict **NEEDS-REVISION** (not UNSOUND — premise held; core mechanics
  survived). All four must-fixes and four needs-answers were revised into
  this text (F1 approved-upstream gate + corrected adr-0005 citation; F2
  append-only-as-convention + record-integrity rules; F3 UPSTREAM-INDICTED;
  F4 approval-trust disclosure; F5 implements-edge; F6 quality-input horn;
  F7 record-as-separation-authority; F8 decision-adversary remit in-body).
  The spec-side split-pair then ran (spec-adversary: NEEDS-REVISION on
  intrinsic gaps; conformance: FAIL enumerating the fifth-pass deltas + one
  **upstream indictment** — no mechanical implements-edge selector — fixed
  here as the `implements:` field). The fifth-pass revisions and the
  `implements:` addition are shaper-authored and NOT independently re-passed —
  disclosed; the consolidated spec revision and a scoped re-review close the
  loop. DISCLOSED.
- **Human-approval boundary:** promoted `draft → gated` on this self-check.
  `approved` is the maintainer's intent act — an in-PR flip or merge — **never
  set by the agent** (`lifecycle.md`, `floor-intent-gate`). The design being
  gated is itself subject to the human intent gate it prescribes.

**Overall: internally sound, honestly bounded, independently stress-tested
across five adversarial passes — the fifth's NEEDS-REVISION findings revised
in (revisions disclosed as not-yet-re-passed) — `gated`, awaiting the
spec-side passes and the maintainer's intent gate. Not approved by the
author.**
