---
id: adr-0012-methodology-delivery-machinery
type: adr
status: draft
depends_on: [adr-0005-tdd-and-artifact-gated-dispatch, adr-0006-operational-conformance-mechanism]
informed_by: [adr-0007-code-reviewer-agent]
owner: agent
updated: 2026-07-15
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
> The full shaping conversation and all three independent adversarial reviews
> are preserved in [`adr-0012-shaping-log.md`](adr-0012-shaping-log.md)
> (provenance, deliberately *not* in the dependency graph — agents consuming
> this decision do not load it). This file is the decision; that file is the
> *why*.

# ADR-0012: reviews become checkable artifacts — mechanize the review bookkeeping, leave judgment to humans

## Decision in brief (plain language)

**The problem.** grove's methodology says "review your work independently, run
every review it owes, don't trust a review a later edit invalidated" — but it
says so in *prose*, and prose didn't fire. A fully-equipped agent still
combined author + builder, ran 1 of 3 owed reviews, and trusted a review a
later edit had made stale. Every miss was caught by a **human doing
bookkeeping**, not judgment.

**What we're deciding.** Make the *bookkeeping* mechanical so the human is left
with *judgment*. Ship this now (the buildable part, "Layer A"):

1. **A work-item keeps a status ledger, not a pile of files.** Each PR carries
   one **status ledger** — a row per review it owes (from a reviewer:
   conformance, code-review, spec-adversary, or the new **decision-adversary**)
   recording the verdict, a fingerprint of exactly what was reviewed, and who
   produced vs. reviewed. One record per work-item, not a file per review;
   detailed findings stay in PR comments, pointed to from the row.
2. **An automated check does the bookkeeping.** On every PR a check — reading
   its rules from the protected main branch, so a PR can't weaken its own gate
   — asks and goes red on any "no": *completeness* (does everything that owes a
   review have one? — fixes "only 1 of 3 ran"), *freshness* (was each review
   done against the current content? — fixes "stale review trusted"),
   *coverage* (do the reviews cover everything that changed?), and
   *separation* (was the reviewer a different agent than the producer?). It
   recomputes the fingerprints itself and trusts no agent's word.
3. **What the machine does NOT do — and says so out loud.** It cannot tell
   whether a review was *genuine* (an agent could write a fake ledger row),
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
workflow" — it *emerges* from each artifact declaring what review it owes, and
the automated check is generated from those same declarations.

**How we know it isn't hand-waving.** This decision was run through **three
independent adversarial reviews** — the discipline it prescribes. The first two
broke earlier, more ambitious versions and forced the honest split above; the
third confirmed this version is sound in shape and "blocked on finishing the
spec, not on infrastructure." (Full trail: the shaping-log companion.)

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
  appropriate to what it is, and was built against an **approved upstream**,
  never a conversation or a draft. "Did the review run?" and "was there
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
  separation signal is the verdict-file's self-reported producer vs. reviewer,
  not git metadata.
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

- **A spec is written** defining the verdict-file format, the
  `type → owed-review` map, and the check's logic.
- **A status-ledger convention** is introduced — **one ledger per PR** (e.g.
  `.grove/ledger.*`), a row per owed review carrying verdict + subject-
  fingerprint + producer/reviewer attribution, with detailed findings pointed
  to (PR comments), not inlined. Concurrent updates are handled by append-
  structured rows or dispatcher-serialized writes (spec detail). The owed rows
  are derived from what the PR changed (the owed-map, pinned here):
  - research / feedback-only change → **nothing owed**;
  - a decision (shaping) → **decision-adversary**;
  - a spec → **spec-adversary + conformance**;
  - code → **code-reviewer + conformance**;
  - a new/undefined `type` → **the full set** (fail-closed, AC4).
- **Each produced artifact carries a self-reported author tag** (which agent
  produced it); the check verifies author ≠ reviewer for each owed review.
- **A new automated check** is added (grove has none today) that reads its
  policy from the protected default branch and enforces completeness,
  freshness, coverage, and separation — on existing GitHub primitives
  (protected branches + Actions), no new platform infrastructure.
- **The setup skill** gains a step that generates that check from the agent
  declarations (replacing its current "check by hand" fallback).
- **Reviewer charters** (`conformance-reviewer`, `code-reviewer`,
  `spec-adversary`) gain: emit your verdict as a verdict file. **Producers /
  artifact types** declare the reviews they owe.
- **A `decision-adversary` role is chartered** — the real independent
  soundness-adversary for decisions (retiring the spec-adversary stand-in); a
  decision owes its verdict *plus* the human intent gate.
- **The dispatcher charter's W1–W6 are demoted** from prescriptive workflows to
  descriptive examples; the per-artifact owed/trigger rules become the source
  of truth (a consolidation, not new prose).
- **No existing decision is superseded.** adr-0006's conformance scope is
  *clarified* (per-layer instrumentation), consistent with it — a forward
  pointer, not a supersession (verified against adr-0006 this sitting).
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
- **AC5 — policy integrity.** The owed-review policy resolves from the
  protected default branch, never PR HEAD; the ledger file and declared
  non-behavioral paths are an explicit exemption allowlist (so the ledger
  doesn't itself owe reviews), and that allowlist is not a review-free zone for
  code (code-bearing paths still owe code-review, fail-closed).
- **AC6 — green is non-authorizing.** A green check surfaces the verdict files
  for human reading and is presented as "bookkeeping done," never "reviewed /
  safe to merge."
- **AC7 — separation (accidental case).** Produced artifacts carry a
  self-reported author tag; the check goes red if a review's reviewer tag
  equals the produced artifact's author tag. Deliberate forgery of the tag is
  out of scope (Layer B), disclosed.
- **AC8 — honest disclosure.** The shipped artifacts state plainly what is
  **not** guaranteed (genuineness, forgery-proof separation, autonomy) and that
  authenticity and policy changes are human-owned.
- **AC9 — decision-adversary.** The `decision-adversary` role exists; a
  decision's owed set includes its verdict plus the human intent gate.
- **AC10 — no infra pretence.** Nothing depends on unbuilt infrastructure:
  verdicts are git files, the store is git, the check uses existing GitHub
  primitives.
- **AC11 — adr-0006 pointer.** A forward pointer records the per-layer
  conformance clarification as consistent with adr-0006 (no supersession).

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
- **Append-only:** new artifact; no ratified decision superseded. adr-0006's
  conformance scope is *clarified*, verified against its text (it assigns
  `conformance-reviewer` code→spec and charter→ADR, never spec→decision) — a
  forward pointer, not an in-place edit. PASS.
- **Naming register (`adr-0002`):** defining text uses `agent`/role names; no
  `druid`/`archdruid`. PASS.
- **Independent review — unusually strong, honestly reported:** THREE
  independent adversarial passes ran (preserved in the shaping-log companion).
  The first two returned NOT-gateable and broke earlier versions — including
  the shaper's own retracted overclaims; the third validated the Layer-A
  reframe. The builder did **not** grade its own work. PASS.
- **Honest limits disclosed, not buried:** Layer B (genuineness, forgery-proof
  separation, autonomy) is out of scope; "green is non-authorizing" is a stated
  principle (AC6); separation is disclosed as accidental-case only (AC7). PASS.
- **Scope discipline:** delivers completeness and freshness (the two reported
  failures mechanizable without infrastructure) and the accidental-fusion case
  of separation; no infrastructure pretended. PASS.
- **Human-approval boundary:** promoted `draft → gated` on this self-check.
  `approved` is the maintainer's intent act — an in-PR flip or merge — **never
  set by the agent** (`lifecycle.md`, `floor-intent-gate`). The design being
  gated is itself subject to the human intent gate it prescribes.

**Overall: internally sound, honestly bounded, independently stress-tested
three times — `gated`, awaiting the maintainer's intent gate. Not approved by
the author.**
