---
id: adr-0012-shaping-log
type: note
owner: agent
updated: 2026-07-15
informed_by: [adr-0012-methodology-delivery-machinery]
---

> **This file is the full shaping + adversarial-review trail for
> [adr-0012](adr-0012-methodology-delivery-machinery.md) — provenance, not a
> lifecycle artifact.** It is deliberately kept OUT of the dependency graph
> (nothing `depends_on` it) so agents that consume the decision do not load
> it. It preserves *why* adr-0012 is shaped as it is: every Decided item, the
> completeness check, both worked traces, and all three independent
> adversarial passes (F1–F13, the reworks, the closes). The decision itself —
> *what* to build, in plain language — lives in the lean ADR. Read this only
> when you need the reasoning, not the conclusion.
>
> *(The frontmatter below this line is the original ADR's, preserved verbatim
> as part of the snapshot; the live decision's frontmatter is in the ADR
> file.)*

---
id: adr-0012-methodology-delivery-machinery
type: adr
status: gated
depends_on: [adr-0005-tdd-and-artifact-gated-dispatch, adr-0006-operational-conformance-mechanism]
informed_by: [adr-0007-code-reviewer-agent]
owner: agent
updated: 2026-07-15
---

> **Provenance.** Shaping canvas opened from grove#59, which captured a
> finding authored in a `gundisalwa/math-quest` session (2026-07-14/15):
> an agent with the **full grove roster + trellis overlay loaded** still,
> unprompted, (1) combined spec-author and builder in one pass, (2) ran
> only the conformance gate when the work owed conformance + code-review +
> spec-adversary, and (3) let a conformance PASS stand after the spec it
> validated was revised underneath it. Each was caught only by the
> maintainer in real time; no mechanism fired. Worked trace: math-quest
> PR #278 (C1-S2); prior role-separation data: math-quest #261. This is a
> **delivery** finding — the principles were loaded and did not fire — so
> the fix must be machinery or a structural default, **not more prose**
> (that is the failure mode being reported). This canvas is `draft`; the
> intent gate never opens to an agent — the maintainer shapes and
> approves.

# ADR-0012: reviews become checkable artifacts — mechanize the review bookkeeping, leave judgment to humans

## Decision in brief (plain language)

*Read this to understand the decision. Everything below `## Decision state`
is the shaping history and three adversarial reviews — the audit trail of
**why** it is this way, not something you need to read to know **what** it is.*

**The problem.** grove's methodology says "review your work independently,
run every review it owes, don't trust a review a later edit invalidated" — but
it says so in *prose*, and prose didn't fire. A fully-equipped agent still
combined author + builder, ran 1 of 3 owed reviews, and trusted a review that
a later edit had made stale. Every miss was caught by a **human doing
bookkeeping**, not judgment.

**What we're deciding.** Make the *bookkeeping* mechanical so the human is
left with *judgment*. Ship this now (the buildable part, "Layer A"):

1. **Reviews become files.** When a reviewer (conformance, code-review,
   spec-adversary, and a new **decision-adversary**) reviews something, it
   writes a small **verdict file** into the pull request: the verdict, its
   evidence, and a fingerprint of exactly what it reviewed. Reviews are
   artifacts in git, not trust-me signals.
2. **An automated check does the bookkeeping.** On every PR a check — reading
   its rules from the protected main branch, so a PR can't weaken its own gate
   — asks three deterministic questions and goes red on any "no":
   *completeness* (does everything that owes a review have one? — fixes "only
   1 of 3 ran"), *freshness* (was each review done against the current
   content? — fixes "stale review trusted"), and *coverage* (do the reviews
   actually cover everything that changed?). It recomputes the fingerprints
   itself and trusts no agent's word.
3. **What the machine does NOT do — and says so out loud.** It cannot tell
   whether a review was *genuine* (an agent could write a fake verdict file),
   it cannot *prove* author and reviewer were different agents, and it does not
   run unattended. **A green check means "the bookkeeping is done — now a human
   judges genuineness and merges." Green is explicitly not "approved."** Those
   stronger guarantees need identity/attestation infrastructure grove does not
   have yet; they are a later increment ("Layer B"), named honestly, not
   pretended.

**Why this shape.** The pipeline is framed as **TDD applied layer by layer**:
each artifact is built to satisfy the acceptance criteria of the one above it
(code satisfies the spec; the spec satisfies the decision), and a failed
review routes the fix to whichever layer is actually wrong. Nobody hand-writes
"the workflow" — it *emerges* from each artifact declaring what review it owes,
and the automated check is generated from those same declarations.

**How we know it isn't hand-waving.** This decision was run through **three
independent adversarial reviews** — the very discipline it prescribes. The
first two broke earlier, more ambitious versions and forced the honest split
above; the third confirmed this version is sound in shape and "blocked on
finishing the spec, not on infrastructure." It received a more thorough
adversarial pass than any grove decision to date, which is itself the point.

## Decision state

Three lists, kept current every turn. The maintainer reads the live state
of the decision here.

### Decided (with who / when)

- **The finding is a real grove-methodology gap, and belongs on grove**
  — maintainer, by moving it here directly from math-quest rather than
  the dual-home capture-then-transfer workaround (grove#59, 2026-07-15).
- **The discriminator is machinery, not content.** What *held* in the
  originating session was machinery-backed (the `pr-contract.yml` red
  check, the human merge gate, the pre-push hook); what *failed* was
  prose-only (role separation, gate completeness, gate freshness). A fix
  made of more paragraphs is disqualified by construction — this is
  grove's own "triggers not vigilance" turned on the methodology itself
  (grove#59; endorsed as the framing the canvas is built on).
- **Enforcement architecture: C — both layers** (maintainer, 2026-07-15).
  A **structural default** in dispatch (the lazy path is the correct one)
  **backstopped by a mechanical red check** (for when the default is
  violated). Rejected: A-alone (CI only, no default) and B-alone
  (structural default only) — B-alone leans on the dispatching agent
  following its default, the exact thing that failed in the reported
  session, so it does not clear the "machinery, not vigilance" bar on its
  own. Both proposals 1–3 now resolve into a default layer *and* a check
  layer.
- **O0 keystone: the verdict artifact is a SHA-bound status, emitted
  through a skill** (maintainer, 2026-07-15). Semantics of option 3 — the
  verdict is bound to the commit it ran on, so the platform carries
  freshness — but the emission is abstracted behind a **gate-verdict
  skill** (sibling to `grove-status`), which contains the GitHub coupling
  and keeps the scheme portable (a non-GitHub runtime swaps the skill's
  implementation). This captures option 2's portability and option 3's
  freshness-for-free at once.
- **The invariant is terminal-state consistency, NOT a fixed flow**
  (maintainer, 2026-07-15). The check does not enforce an order of
  operations; in-flow iteration (spec revised, code churned, gates run and
  invalidated) is unconstrained. It evaluates only HEAD, and requires:
  *the terminal commit carries a fresh (HEAD-bound) verdict from every gate
  its diff owes.* This **unifies former gate-completeness (O2) and
  gate-freshness (O3)** into one condition — a verdict bound to an earlier
  commit is *absent at HEAD*, so "stale" and "missing" are the same red.
  **Conformance is always owed** (the decision→spec→code consistency gate;
  a HEAD-bound conformance status is the proof it "ran last");
  **code-review is owed iff the diff touches code**; spec-adversary iff the
  diff touches spec. The owed set is **derived from what changed**, not
  from pipeline position.
- **Role separation (Proposal 1) survives — justified by specialization,
  not independence** (maintainer, 2026-07-15). A cold `contract-author`
  and a cold `executor` each run a sharp, role-specific prompt;
  *combining* them runs one agent on blended instructions — a worse author
  *and* a worse builder. The terminal gates check output *consistency*;
  they do **not** recover the *depth/quality* lost by not letting each
  specialist run cold. So the reframe does not subsume Proposal 1 (1a,
  "drop it," rejected); the open part is only its *enforcement shape*.
- **Owed-set derivation keys off frontmatter `type`; code is the default**
  (maintainer, 2026-07-15). The check does not need a content-classifier:
  for each changed file it reads the artifact-contract frontmatter `type`
  (`spec` / `adr` / `charter` / …); a file with no artifact frontmatter (or
  outside the artifact dirs) **is code**. Type → owed gates. This reuses the
  existing artifact contract rather than inventing a parser.
- **Each layer's output is independently checked against its upstream —
  but the *instrument* is layer-specific** (grounded in the charters this
  turn, correcting two memory-based errors of mine). The principle is "the
  builder does not grade itself" (`conformance-reviewer.md`,
  `inv-independent-judgment`); the gate that enforces it differs by layer:
  - **spec → decision:** the **`spec-adversary`**, *not* a conformance run.
    It "derive[s] your OWN checklist from the upstream decision" and hunts
    for "silent scope beyond the decision" (`spec-adversary.md` §Method 2–3),
    pre-approval — so a spec's fidelity-to-decision *and* soundness are one
    gate.
  - **code → spec:** **`conformance-reviewer`** (fidelity, stage 4½) +
    **`code-reviewer`** (quality).
  - **charter → ADR:** **`conformance-reviewer`** already owns it — "a
    charter is prose implementing the ADR(s) in its `depends_on`… the
    collapsed-case analogue of the code-vs-spec gate" (`conformance-reviewer.md`
    §Method 8).
  - **decision → human intent:** no approved *artifact* upstream; the
    independent check is the **maintainer, in the loop throughout
    interactive shaping** (`shaper.md`, "runs as a live session"),
    backstopped *late* by `spec-adversary`'s `UNSOUND` verdict, which routes
    decision-level flaws back to the `shaper` (`spec-adversary.md` §Method 4).
  - **Corrects two earlier claims of mine:** (a) that the ADR and spec share
    an author — they do **not**; `shaper` authors decisions, `contract-author`
    authors specs, so independence is structural, not author-self-check; and
    (b) a double-count of a separate conformance run for specs — the spec's
    upstream check is the `spec-adversary`'s job.
- **Gate ≠ agent: the owed-set names gate *slots*; the agent filling a slot
  is swappable, including by a stand-in** (maintainer, 2026-07-15 — extends
  D4). A gate is "an independent adversary examined this layer"; which agent
  satisfies it is an implementation detail, exactly as D4's gate-verdict
  skill emits a verdict for a slot agnostic to its producer. This lets a
  slot ship before its dedicated agent exists, filled by a stand-in.
- **O5 direction — scope the decision-adversary *agent* out (phase 2); keep
  its *gate* in adr-0012, stand-in-filled (phase 1)** (maintainer's
  (a)+twist, 2026-07-15). Phase 1: the decision layer gets an
  adversary *gate slot* in the owed-set, satisfied by the **`spec-adversary`
  as a stand-in** — it already reads the upstream decision and can return
  `UNSOUND` on it, so a spec-adversary run *transitively* covers the
  decision. Phase 2: a dedicated **decision-adversary agent**, spun out to
  its own `[consider]` issue, swaps into the same slot. (Open sub-point: how
  the standalone decision-only PR is treated — see O5.)
- **Workflows are EMERGENT from local rules — never authored as full flows**
  (maintainer, 2026-07-15; a load-bearing constraint on the whole design).
  Nothing may encode a complete workflow, and no role — the dispatcher
  included — "knows the flow." The pipeline is composed from **simple local
  rules** of two kinds: a **trigger** rule (an artifact-state dispatches the
  next agent — `decision → shaper`, `approved decision → contract-author`,
  `approved spec → executor`) and an **owed** rule (an agent's output owes
  its gates before it is done — a spec owes `spec-adversary`, a build owes
  conformance + code-review). grove's W1 is then whatever *emerges* from
  following the rules — descriptive, not prescriptive. **This is
  architecture C (D3) applied to the entire pipeline:** the local rules are
  the *default layer* (agents self-dispatch and self-gate), and the terminal
  check is the *machinery layer* that re-derives the owed-set from the
  **artifacts** (never trusting "which agent ran") and goes red if a rule
  was not followed. The check needs no knowledge of the workflow — only of
  each artifact's owed set — which is *why* the workflow can be emergent
  without a skipped rule hiding.
- **The exact rule-set is spec-altitude, deliberately left open here**
  (maintainer: "not sure these are the exact rules"). adr-0012 settles the
  *architecture* (emergent local trigger + owed rules, machinery-checked on
  artifacts); the precise per-agent triggers and owed-sets — and whether
  each rides the artifact or the agent — are pinned by the spec this
  decision authorizes, not by the decision itself.
- **W1–W6 demote to descriptive, not superseded** (maintainer's (i),
  2026-07-15). The dispatcher charter keeps W1–W6 as *worked examples of
  what the local rules emit*; the per-agent trigger/owed rules become the
  source of truth. A relabel + consolidation, not an append-only
  supersession.
- **The O4 landing decomposition is accepted** (maintainer, 2026-07-15):
  owed-set rides the artifacts (the check re-derives from `type`, D7);
  trigger/routing rides the agent charters; the dispatcher is a thin
  stateless matcher; the gate-verdict skill emits, `pr-contract.yml` checks.
- **The CI check is EMITTED from the agent topology by a setup skill — not
  hand-authored** (maintainer, 2026-07-15). A `/grove:setup`-class skill for
  GitHub (riding grove setup or a sibling) reads the agents' declared rules
  (the topology) and *generates* the `pr-contract` check — so even the
  machinery is a product of the local rules, not a separately authored
  workflow; the single source of truth is the agent declarations.
  *Reconciles with D7:* the agents author the rules (author-time); the setup
  skill compiles them into the `type → owed-slots` mapping; the check reads
  each changed artifact's `type` at PR time (run-time, never trusting an
  agent's word).
- **A non-pass verdict leaves the slot unfilled; the verdict *grammar*
  routes the fix** (2026-07-15). The gate-verdict skill records *every*
  verdict (pass and non-pass) for the audit trail; the check counts a slot
  filled only on a **fresh PASS-class** verdict. A non-pass neither fills the
  slot (check stays red) nor lingers (any revision moves HEAD and D5
  staleness drops it). Its grammar carries the routing, already chartered:
  `spec-adversary` `NEEDS-REVISION` → the immediate producer
  (`contract-author`) revises; `UNSOUND` → back to the *upstream* producer
  (`shaper`), the flaw being in the decision (`spec-adversary.md` §Method 4).
  So dispatch derives from the slot's **verdict state** — no verdict → run
  the supplier; non-pass → run the producer the grammar names; fresh pass →
  advance — never from a memorized flow. grove's constrained verdict
  grammars double as routing labels.
- **The subject of a verdict is the artifact-at-HEAD + its declared
  upstream — not the diff** (2026-07-15). A reviewer certifies the whole
  artifact's current state against the upstream it builds its checklist from
  (`conformance-reviewer` / `spec-adversary` derive ground-truth from the
  upstream, not the delta); the **diff is a focusing/scoping aid**, chiefly
  to scope a re-review round to "what changed since my last verdict"
  (`spec-adversary.md` §Method 5). Two channels: the **SHA-bound verdict
  status** is the machine channel to the check; the **findings** (the *why*
  of a non-pass) travel as PR records/comments back to the producer.
- **Division of labor: the maintainer owns the effects; the shaper owns the
  mechanics** (maintainer, 2026-07-15). "I don't actually know how the
  handoffs work… I should focus on the effect I want and let you figure out
  mechanics." This is grove's own principle applied to this conversation —
  the human backstops *judgment*, not plumbing. So the decision is anchored
  on `## Intended effects` (maintainer-owned); the mechanical forms serve
  them and are the shaper's to finalize at spec-altitude.
- **O5/O6/O7 resolved as reversible shaper defaults** (2026-07-15, per the
  division of labor above — each veto-able):
  - **O5 → a standalone decision-only PR rests on human shaping.** The
    phase-1 decision-adversary stand-in is coverage-where-a-spec-exists, not
    a blocker; a spec-less decision (adr-0012 itself) owes no bot adversary,
    exactly as today. The phase-2 dedicated agent is what closes the
    standalone gap.
  - **O6 → slot-driven auto-dispatch** (not producer-named handoff). A
    producer declares only that its output owes a *slot*; the dispatcher runs
    whichever agent registered to fill it. Producers stay ignorant of their
    reviewers — gate≠agent (D9) end to end; adding/swapping a reviewer is a
    one-line registration.
  - **O7 → subject-content-hash freshness** (not whole-commit SHA). A verdict
    binds to a hash of exactly what it certifies (artifact + upstream; code +
    spec for conformance), so only a real change to that subject invalidates
    it — no spurious re-reviews. Refines D4 (the skill computes a subject
    hash; freshness is no longer literally free from the bare commit status).

### Open (the live questions)

- **O8 — CLOSED (dissolved by E0, not decided).** The W3 triage "procedure"
  was the last thing that didn't emerge; the maintainer's recursive-TDD
  insight (E0) shows it *is* TDD red-first + the upstream-vs-local diagnosis
  every conformance check performs, so it emerges after all. No scope-out
  needed; E5's emergence claim stays universal. (Kept as a closed entry for
  the reasoning trail — the completeness check found a real gap and E0 filled
  it.)
- **CONVERGED on Layer A — `gated` 2026-07-15** (see `## Decision in brief`
  at the top, and Consequences / Acceptance criteria / Self-check at the
  bottom). The path here: the first two adversarial passes broke the ambitious
  fully-autonomous version (the F1–F13 findings); the maintainer's step-back
  reframed it into **Layer A** (mechanize the review *bookkeeping* — the part
  that actually failed in #278 — and leave *judgment*, including authenticity,
  to the human); a third pass validated that reframe and returned "blocked on
  spec-completion, not infrastructure." The must-fixes it left were adjudicated
  as C1–C7 and folded into the Consequences/AC. The intent-level questions that
  had reopened are resolved: **F3/O1** (what a verdict proves) is scoped —
  bookkeeping is mechanical, *genuineness is human-owned at merge*, forgery-
  proof separation is Layer B; **F2** (loop bound) is human-bounded in v1,
  Layer B for autonomy; **F6** (decision-adversary) → a **real** decision-
  adversary is chartered (maintainer's call). What remains is spec-completion,
  which grove's own spec stage (with its `spec-adversary`) will itself gate.

### Parked (deferred, with why)

- **O1 — role separation's enforcement shape (default-only vs. a check).**
  Parked for more thought (maintainer, 2026-07-15); **not** dropped —
  separation stays owed (D6). Constraints and options captured so it
  resumes cold:
  - **Constraint:** do *not* force separation *per commit* — squash /
    rebase / co-authorship make git commit-authorship a bad signal
    (maintainer). So a "author ≠ committer" git check is out.
  - **Option floated (maintainer):** an **author tag in doc frontmatter**
    (which agent authored the artifact) + a **comment header in code
    files**. Assessment: the **doc frontmatter tag is cheap and doubles as
    provenance** (sits by the existing `owner:` field) — viable; the **code
    comment header is the brittle half** (refactored away, noisy, and
    file-granular for a property that is really about *runs*, not files).
  - **Deeper reliability caveat:** any *hand-written* tag is self-reported
    by the agent — the same vigilance the whole decision exists to escape (a
    fused author+builder could stamp two tags or just forget). A
    **harness-stamped run signal is more trustworthy and the right
    granularity**: the gate-verdict skill (D4) already knows the *acting
    run* at emission, and the findings ledger has run-ids — so "was the
    builder a different run than the author" can be checked at run-level
    without touching code files at all.
  - **Where it leans (not decided):** if a check lands, prefer the
    run-level signal (skill/ledger run-ids) over embedded tags; the doc
    frontmatter author-tag is worth keeping regardless for its provenance
    value. Resume here.

## The problem this decision frames

Prose + agent vigilance does not hold for load-bearing sequencing. Three
sequencing guarantees the methodology *states* but does not *enforce* —
role separation, gate completeness, gate freshness — each failed in a
single session despite being loaded, and each was caught only by a human
acting as the backstop for *"did the process run,"* not for *judgment*.
The methodology's own goal is that the human is the backstop for judgment.
This decision asks what machinery or structural default moves those three
guarantees off the human's shoulders.

## Intended effects (maintainer-owned — the layer of intent)

These are the observable effects the design must produce. The maintainer
owns this list; every mechanism in `## Decision state` exists to serve it,
and is the shaper's to finalize. If a mechanism does not serve one of these,
it does not belong.

- **E0 — Recursive TDD is the generative core** (maintainer's insight,
  2026-07-15). **⚠ Partly holed by the adversarial pass (F9): it has no base
  case at the decision layer (a decision is not built test-first against
  human intent), and "fix the test" is lossy where the decision-layer
  operation is *supersede*, not edit-in-place. Treat E0 as a strong framing
  for the spec/code layers, not a verified universal.** The root the
  spec/code effects grow from — listed first. Development is
  TDD applied recursively down the layers: each artifact is built
  **test-first against its upstream**, where the **upstream's acceptance
  criteria ARE the test** (the decision is the spec's test; the spec is the
  code's test). From this single principle:
  - **Forward construction (W1)** = build each layer to pass its
    upstream-test.
  - **Backprop, amendment, bug (W4/W2/W3) are ONE branch** — "a test failed;
    fix it at the layer it indicts": *locally* if this layer is wrong
    (`NEEDS-REVISION` → immediate producer), **upstream if the test itself is
    wrong** (backprop — `UNSOUND` → `shaper`; conformance's
    "faithful-but-wrong"). Already latent in the non-pass verdict routing and
    the conformance charter; the insight is that it *subsumes* three
    chartered workflows instead of reproducing them.
  - **Dissolves O8:** W3's `reproduce → root-cause → classify` is TDD
    red-first (`executor` is test-first, `adr-0005`) + the upstream-vs-local
    diagnosis every conformance check already performs + route-to-indicted-
    layer. It emerges.
  - **Caveat (verified, not glossed):** this explains the *shape* of the
    interrupts; it does not remove the E7 bound — a fix-the-test cascade can
    still ping-pong across layers and needs the generation-2 stop. Shape from
    TDD, safety from E7.
- **E1 — No unreviewed work merges, and none builds on thin air.** Every
  artifact reaching the final state (a) carries a fresh, independent review
  appropriate to what it is (spec → adversary; code → conformance +
  code-review; charter → conformance; decision → human), and (b) was built
  against an **approved upstream**, never a conversation or a draft — a
  change with no reviewable contract fails by construction (`adr-0005`
  dec 3). "Did the review run?" and "was there anything to review against?"
  are never a human's job to check. *(Facet (b) added by the W1–W6
  completeness check, 2026-07-15 — W2/W4 both lean on it.)*
- **E2 — Iteration is free; only the endpoint is gated.** Authors, builders,
  and reviewers churn mid-flow without ceremony; the gate judges only the
  final state. No fixed pipeline is imposed on how the work gets there.
- **E3 — Specialists stay separate.** Author, builder, and reviewer run as
  distinct cold specialists by default; fusing them is a visible, disclosed
  deviation — protected for the *quality* of specialized runs, not only for
  independence.
- **E4 — A stale verdict is never trusted.** A review is bound to what it
  reviewed; change the reviewed thing and the review stops counting —
  automatically, never by someone remembering.
- **E5 — No one holds "the workflow."** The pipeline emerges from simple
  local rules on agents/artifacts, and the enforcing machinery is generated
  from those same rules. Adding or swapping an agent recomposes the system
  with no central flow to edit. **"Local rules" spans three kinds:** trigger
  rules (routing), owed rules (gates), and **agent method/boundary rules**
  (test-first, surface-upstream-don't-patch, build-on-approved-upstream) —
  the new adr-0012 rules **compose with grove's existing local invariants**;
  the emergence is of the two together, not the new rules alone. *(The
  three-kinds clarification added by the W1–W6 completeness check,
  2026-07-15 — W3/W4 emerge only with it.)*
- **E6 — The human backstops judgment, not bookkeeping.** Everything above
  is mechanically enforced, so the maintainer spends attention only on
  intent — approving a decision, or overriding a block with recorded
  rationale — never on "did the process run."
- **E7 — The whole process is bounded: it converges or escalates, never
  loops** (maintainer, 2026-07-15). Free iteration (E2) and emergent
  dispatch (E5) are the engine; this is the governor. A revise ↔ re-review
  cycle that does not converge within a small fixed number of rounds — and
  the emergent dispatch more broadly — **stops loudly and hands to the
  human** (E6), never spinning or spending without limit. This is grove's
  own discipline applied here: repair cascades and auto-resumes already
  **bound at generation 2, then demand a loud maintainer stop**
  (`dispatcher.md` W4; `run-resumer`). The bound's *number and form* are
  shaper-owned (spec-altitude); the *effect* — bounded, escalating, never
  infinite — is the maintainer's.

## Completeness check — do W1–W6 emerge from the effects? (2026-07-15)

Run at the maintainer's request, as a falsification test of E5: if a
chartered workflow cannot emerge from the local rules, an effect is missing.
Each traced against the rules the effects imply (trigger, owed,
verdict-grammar routing, the E7 bound) composed with grove's existing local
invariants.

- **W1 new requirement — emerges cleanly.** The stage *ordering* falls out
  of trigger *preconditions* (the `executor` is triggered by an *approved*
  spec — the precondition IS the order); conformance ∥ code-review are
  parallel because they are two owed slots on one artifact with no ordering
  (E2), not by decree.
- **W5 feedback / W6 research — emerge trivially** as single trigger rules.
- **W2 spec amendment — emerges** via owed + boundary rules: an in-scope
  amendment owes a delta-scoped `spec-adversary` pass (E1/E4); scope beyond
  the decision is caught and routes to shaping; contradiction of a standing
  decision → human (E6). Leans on E1(b) (build-on-approved-upstream).
- **W4 backpropagation — emerges**, but *not from E1–E7 alone*: it rests on
  grove's existing *surface-upstream-don't-patch* invariant + E6
  (decision-layer → human) + E7 (cascade bound) + a trigger (repair merged →
  `validator` audit scoped by `depends_on`). Motivates the E5 composition
  clarification.
- **W3 bug — initially the hard case, then dissolved by E0.** *Classify-and-
  route* (code → `executor`; spec gap → `contract-author`; decision gap →
  `shaper`) emerges from routing rules. The `reproduce → root-cause →
  classify` *ordering* first looked like a rogue procedure (→ the old O8) —
  but under **E0 (recursive TDD)** it is TDD red-first + the upstream-vs-local
  diagnosis every conformance check already performs + route-to-indicted-
  layer. It emerges; O8 is closed.

**Verdict:** E0–E7 are sufficient — **every** chartered workflow emerges,
composed with grove's existing local invariants. The check forced three
improvements (E1(b) build-on-approved-upstream; E5 three-kinds/composition;
and, prompted by the W3 hold-out, **E0 recursive-TDD**, which unified
W2/W3/W4 into one "fix-the-test" branch and closed the last open call). No
workflow fails to emerge.

## Worked trace (the anti-pattern the proposals prevent)

math-quest PR #278 (C1-S2), read as what should not happen:

| Step | Commit | What happened | Anti-pattern |
|---|---|---|---|
| 1 | `21cbb09` | One agent authors the spec amendment | — |
| 2 | `340efd2` | **The same agent** builds impl + tests | **A1: author == builder** |
| 3 | — | PR opened; **only** conformance-reviewer dispatched → PASS | **A2: 1 of 3 owed gates ran** |
| 4 | `d53fae0` | Conformance's record findings applied | — |
| 5 | — | *Maintainer* names the two missing gates — a human, not a mechanism | A2 surfaced |
| 6 | `1762e0f` | code-reviewer (PASS-w/-advisory) → finding fixed | — |
| 7 | `6ed2755` | spec-adversary → **NEEDS-REVISION**; **spec revised** | — |
| 8 | — | *Maintainer:* the step-3 conformance PASS is now **stale** (spec changed at 7, a test at 6) and would have been silently trusted | **A3: stale verdict on a superseded subject** |
| 9 | `6ed2755` | conformance + code-review **re-run on the final commit** → clean | resolution |

- **A1** → Proposal 1 (O1): separate author/builder by default; combining is a disclosed, up-front deviation.
- **A2** → Proposal 2 (O2): the owed gate set is defined and its absence turns the contract check red.
- **A3** → Proposal 3 (O3): a spec edit voids the conformance verdict automatically; "re-run on final state" is the rule, not a human catch.

## Worked replay — #278 under the new machine (2026-07-15)

The same change (amend spec S + implement it), run through the emergent
rules. `c1…c4` are commits; each row shows the terminal check's state.

| # | Action | Owed slots on HEAD | Check | What killed the anti-pattern |
|---|---|---|---|---|
| 0 | Approved decision needs the amendment → **trigger** dispatches `contract-author` (a cold specialist, *not* whoever will build) | — | — | **A1**: the build trigger later dispatches a *separate* `executor`; fusing them is a disclosed deviation, structurally |
| 1 | `contract-author` amends spec S (`c1`) | spec → `spec-adversary` | **RED** (slot empty) | **A2**: the owed slot's absence is red — no human needed to notice |
| 2 | Approved spec → **trigger** dispatches `executor`; test-first build (E0 red-first) impl+tests (`c2`) | spec → `spec-adversary`; code → `conformance` + `code-review` | **RED** (3 empty) | **A2**: all three owed slots enumerated by the check, not remembered |
| 3 | Slot-driven dispatch runs the suppliers on `c2`. `spec-adversary` → **NEEDS-REVISION** (the false oracle claim); conformance + code-review → pass@c2 | spec-adversary filled=NO; others pass@c2 | **RED** | verdict *grammar* routes: NEEDS-REVISION → the `contract-author` (E0 "fix the test"), no human names it |
| 4 | `contract-author` revises spec (`c3`) | subject-hash of *spec* changed → `spec-adversary` **stale**; **conformance subject = code+spec → also stale**; `code-review` subject = code only → **still fresh** | **RED** | **A3**: the conformance pass auto-voids because the spec is in its subject — mechanical, not a human catch. O7 precision: code-review is *not* spuriously re-run |
| 5 | Re-dispatch on `c3`: `spec-adversary` → APPROVE-READY; `conformance` → **NEEDS-REVISION** (code must follow revised spec) | spec-adversary pass@c3; conformance filled=NO | **RED** | fix-the-test again, now one layer down (spec ok, code indicted) |
| 6 | `executor` updates code test-first (`c4`) | code changed → `conformance` + `code-review` re-owed; spec unchanged → `spec-adversary` **still fresh** | re-dispatch → all pass@c4 → **GREEN** | E0: only the indicted layer re-runs; the fresh spec-adversary verdict is *not* redone |
| 7 | **Human merge** (E6) | all slots fresh-pass on HEAD | **GREEN** | the human's one act is intent (merge), never "did the gates run" |

Convergence took two fix-the-test rounds; had it ping-ponged, the **E7**
generation-2 bound fires a loud stop. Every catch that was a *human* in the
real #278 (steps 5, 8 of the anti-pattern trace) is here a *mechanism*.
*(Caveat, post-adversary: this trace assumes verdicts prove a review ran and
that freshness/bounds work as described — findings F2/F3/F12 below show those
assumptions are not yet delivered by the mechanics.)*

## Independent adversarial pass — findings (2026-07-15)

Run at the maintainer's request (a fresh agent, not the shaper who drafted
this — "the builder does not grade itself"). It broke the design. **Verdict:
NOT gateable as drafted — send back for mechanics, not to the approval gate.**
The intent (E1–E6) is sound; the *mechanics do not yet produce the effects
they claim*, and the shaper's "converged / E0-verified / all-workflows-emerge"
framing overstated readiness. Findings, with the shaper's own honest triage:

**Load-bearing (fatal as drafted — must fix before any gate):**

- **F3 — the terminal check is forgeable.** It counts a slot filled on "a
  fresh PASS status bound to HEAD"; it cannot verify a review actually ran,
  and gate≠agent (D9) lets *any* emitter satisfy a slot. A producer can
  emit its own three PASS statuses → GREEN, no reviewer ran — the reported
  A2 reproduced, with the human given *less* signal than before. `dispatcher.md`
  already requires "vacuity detection at every gate"; this has none.
  **Delivering E1 requires the run-level identity signal that O1 parked — so
  O1 is not parkable; it is load-bearing.** *(Shaper: agree, fatal.)*
- **F2 — E7's governor has no home.** The gen-2 loop bound is stateful and
  cross-run; the architecture is HEAD-only + "thin stateless matcher." A
  stateless matcher cannot count cascade generations. The one thing that makes
  free iteration (E2) safe has no component to live in — and this is the real
  W4 counterexample the completeness check hand-waved. *(Shaper: agree,
  fatal — I removed the substrate my own safety property needs.)*
- **F1 — the compiled `pr-contract` check drifts.** E5's "recompose with no
  central flow to edit" is false: the setup skill commits a *derived* check
  that lags the topology with no generation stamp and no recompile trigger —
  reintroducing exactly the drift adr-0006 §8 already solved (and which
  `/grove:setup` does not do today — it's a new, unspecified capability).
  *(Shaper: agree — either the check re-derives live at PR time, or the
  compiled artifact needs a stamp + gated recompile.)*

**Real must-answers (holes, not necessarily fatal):**

- **F5 — internal contradiction.** "Conformance is **always** owed" (D5 +
  rejected-list) vs "spec → spec-adversary, *not* a conformance run" (the
  layer-instrument decision). The commonest PR (a spec edit) has an undefined
  owed-set. *(Shaper: agree — I conflated "conformance the concept" with
  "conformance-reviewer the code gate." Restate: an *upstream check* is always
  owed, instrumented per layer.)* Plus: the conformance-scope change touches
  **approved adr-0006** and was written inline as a "correction" with no
  supersession edge — an append-only violation to fix.
- **F6 — the decision-adversary stand-in doesn't cover its own class.** The
  spec-adversary only catches a decision flaw that makes the *spec*
  incoherent (`UNSOUND`); a *plausible-but-wrong* decision yields a coherent
  spec → APPROVE-READY → the flaw is invisible (the grove#20 "faithful
  implementation of the wrong design"). And a spec-less decision — **adr-0012
  itself** — gets zero independent adversary, only its author-partner
  maintainer. *(Shaper: agree, and this is why "hard to be sure" was right.)*
- **F4 — the human intent gate is unmechanized.** Dispatch trusts
  `status: approved`, which adr-0005 says must never be hand-set; nothing in
  the owed-set/check verifies the approval was a genuine human act. *(Agree.)*
- **F7/F8 — freshness holes.** E4 inherits adr-0006 §6's undeclared-dependency
  blind spot (undeclared upstream changes → subject-hash unchanged → stale
  reads fresh); and if the emitter computes the subject-hash and the checker
  trusts it, freshness is forgeable — the check must independently recompute,
  which needs a deterministic upstream-set resolution the ADR never specifies.
  *(Agree — must specify.)*
- **F9 — E0 is holed.** (a) No base case: the decision layer is *not* built
  test-first (human intent is not a written test), so "recursive TDD all the
  way down" fails at the root E0 calls the root. (b) "Fix the test" is lossy
  at the decision layer, where the operation is *supersede* (append-only), not
  edit-in-place. *(Shaper: agree on (a) — I oversold E0 as fully general; (b)
  is a framing imprecision more than a mechanism, but E0 must distinguish
  revise-spec-in-place from supersede-decision.)*
- **F10 — A1 has no mechanism.** Separation (E3), the *lead* anti-pattern, is
  enforced only by parked O1; presenting the design as "converged" while A1
  is unsolved overstates readiness. *(Shaper: agree — a fair hit on my
  framing.)*

**Fair epistemic notes:**

- **F11 — the completeness check was self-confirming.** When W3/W4 didn't
  emerge, the effect-set was *widened* (E0 added, E5 broadened) until they
  fit, then credited as passing. Read the verdict as "we adjusted the effects
  until the workflows fit," not "the effects independently predicted them."
  *(Shaper: agree — honest and important.)*
- **F12/F13 — bounding gaps.** Intra-PR oscillation between two gates with
  overlapping subjects is "free iteration" (E2, unbounded) and never trips
  E7's cross-merge counter → a PR can fail to reach all-fresh HEAD; and
  failed/max-turns runs re-dispatch with no bound. Same homeless-bound pattern
  as F2. *(Agree on the livelock; "iteration is free" also needs softening —
  it is free of *ceremony*, not of *cost*.)*

**Consequence for this canvas:** the design is **NOT converged** — the prior
"confirm E0–E7 → converged" checkpoint was premature. The real open list is
the must-fixes above. E0's "holds under an adversarial pass" claim is
**retracted** (F9). The completeness verdict is qualified by F11.

## Rework v2 — resolving the findings, ambitious version retained (2026-07-15)

Maintainer chose to push the emergent design through, not retrench. Proposed
resolution directions — **marked proposed, NOT verified; to be re-run through
an adversarial pass before any gate** (learning from F11: no self-declared
"verified" this time). Several fatal findings unify:

- **R1 (F3 + un-parks O1) — a verdict is harness-attested, run-identified,
  and non-vacuous.** The gate-verdict skill is the *sole* emitter and stamps
  the **harness-attested run-id** of the reviewing run (not self-reported) +
  requires attached evidence (the reviewer's derived checklist / `file:line`,
  which the conformance & spec-adversary charters already produce). The
  terminal check requires, per owed slot: a fresh verdict whose emitting
  run-id **≠ the artifact's producer run-id**, evidence non-empty. Forgery
  needs the skill's credential (a GitHub App token agents don't hold); a
  producer cannot green-paint its own review. **F3 (anti-forgery) and O1
  (separation) are the *same* signal — run identity — so one mechanism closes
  both**, and it supplies the "vacuity detection" `dispatcher.md` demands.
- **R2 (F2 + F12 + F13) — bounds are computed from the durable verdict
  history, not held in a stateless matcher.** The append-only verdict record
  already exists (the skill records every verdict). Cascade-generation,
  intra-PR oscillation, and failed-run re-dispatch counts are all *functions
  over that history*; exceeding a bound → loud human stop. The dispatcher
  stays stateless; **the record carries the state.** The bound lives in data,
  not memory — which is where the homeless bound the adversary found belongs.
- **R3 (F1) — the check derives owed-set + `slot→supplier` LIVE from the
  declarations at PR time.** Nothing durable is compiled-and-trusted; setup
  installs a check that *reads the declarations live*, so there is no derived
  artifact to drift. (Any cache carries a declarations-hash stamp and
  re-derives on mismatch — the adr-0006 §8 stamp, applied to the compiler
  output, not skipped.)
- **R4 (F5) — restate D5: an *upstream-conformance check* is always owed,
  instrumented per layer** (`spec-adversary` for specs; `conformance-reviewer`
  for code/charter) — removing the "conformance-reviewer always" conflation
  that made the spec-only owed-set contradictory. Reconcile with **approved
  adr-0006** explicitly: verify clarification vs. change, and add a
  supersession/amends edge if it is a change (append-only).
- **R5 (F9) — bound E0 honestly:** recursive TDD for the **spec↔code** layers,
  bottoming out at a **human-intent base case** at the decision layer; a
  decision-layer repair is **supersede** (append-only), not edit-in-place. E0
  is the generative core *below intent*, not a universal.
- **R6 (F4) — mechanize the intent gate:** dispatch-on-`approved` requires the
  approval be backed by a **human PR-review** (the signal grove#38 already
  proposes as the verifiable approval guard); an agent-set `approved` with no
  human review is rejected. Ties this decision to grove#38.
- **R7 (F7/F8) — freshness:** the check **independently recomputes** the
  subject-hash from HEAD (the emitter does not get to assert it), and **E4
  explicitly inherits adr-0006 §6's undeclared-dependency blind spot** —
  disclosed, degrading exactly where adr-0006 already degrades.

- **R8 (F6/O5, maintainer's call 2026-07-15) — the decision layer gets a
  REAL independent adversary.** E0's base case becomes honest: **a decision
  owes an independent soundness-adversary *plus* the human intent gate.** The
  decision-adversary cannot validate "is this what the human wants" (the
  human's act) but breaks internal coherence, contradiction with standing
  decisions, argument soundness, and build-on-settled-ground — exactly what
  the 2026-07-15 pass did to adr-0012. This retires the phase-1 spec-adversary
  *stand-in* (it demonstrably missed plausible-but-wrong decisions) and
  promotes the decision-adversary from the spun-out `[consider]` into this
  decision. New role to charter; slots into the same demand/supply model
  (`adr` owes the `decision-adversary` slot).

**Status: reworked (R1–R8), NOT verified.** Next step is a SECOND adversarial
pass on the reworked design — do R1–R8 actually close F1–F13, and what new
holes did the rework introduce? No gate until that pass runs.

## Second adversarial pass — findings (2026-07-15)

A fresh agent, grounded in grove's actual code. **Verdict: still NOT
gateable, and the rework made two things worse.** Tally of R1–R8 against
F1–F13: **CLOSED 2** (F7, F9 — both disclosure/framing only, no new
mechanism); **PARTIAL 3** (F5, F6, F8); **NOT-CLOSED 7** (F1, F2, F3, F4,
F10, F12, F13).

**The load-bearing, structural finding — this is not "tighten the mechanics":
the ambitious design presupposes platform infrastructure grove does not
have.** Each fatal fix leaned on a primitive that does not exist in this repo,
verified against source:

- **R1/F3 (still open, CRITICAL).** "Harness-attested run-id" is fiction. The
  only emitter primitive that exists, `grove-status`, takes the **run-id and
  role as self-reported CLI arguments** (`grove-status/SKILL.md:42-45`: "the
  run identifier the dispatcher gave you", `--agent <your-role>`). One agent
  can present as four run-ids and emit its own four PASS verdicts → GREEN, no
  reviewer ran. The check's "reviewer-run ≠ producer-run" is **uncomputable**
  — nothing records "artifact X was produced by run-A" in a store agents can't
  write. F3 and F10/O1 both rest on this fiction.
- **NEW, CRITICAL — confused deputy.** Worse: if the gate-verdict skill *does*
  hold a real credential, it is invoked *by the very agents it gates* and is
  *told* the run-id, so it emits any verdict for any slot under a **trusted**
  identity — forgery that now looks authoritative. The rework's keystone makes
  F3 worse than the openly-forgeable draft.
- **R3/F1 (regressed, CRITICAL) — self-amending gate.** "Derive live from the
  declarations at PR time" reads the policy from **the PR branch the PR
  controls**. A PR can weaken its own owed-set (edit the rule, flip a
  `type:`, drop frontmatter) in the same commit the check reads. Trades a
  staleness bug for an authorization bug.
- **R2/F2 (still open, HIGH) — the "durable append-only verdict record" does
  not exist.** The only candidate is the wisp bus, which its own skill
  disclaims as "**telemetry, NOT truth**" (`grove-status/SKILL.md:12-13`);
  any SHA-keyed history **resets on rebase/squash**, zeroing the E7 cascade
  counter — the governor defeated by `git rebase`.
- **R6/F4 (still open, HIGH).** Mechanizes the intent gate on **grove#38, an
  unbuilt parked idea** — building on unsettled ground, which `lifecycle.md`
  and `profile.md` forbid.
- **R8/F6 (PARTIAL).** The decision-adversary closes the *incoherent*-decision
  sub-case but **not** the plausible-but-wrong class F6 actually named (a
  plausible-but-wrong decision is coherent by definition — the axis R8 says it
  *cannot* judge). And it is an **unanchored gate** — no approved artifact
  upstream to derive ground truth from; nobody adversaries its criteria.

**What the passes together establish:** the minimum bar for the ambitious
version to be gateable requires machinery grove does not have and this
decision cannot conjure — (1) real out-of-process run **attestation** an agent
can't forge + a trusted producer→run record; (2) policy resolved from a
**protected location** (default branch), not PR HEAD; (3) a **forge-resistant,
force-push-stable** verdict store with a defined lineage rule; (4) an intent
guard that **exists** (not grove#38-as-idea). These are a platform program
(runner-hosted dispatcher/emitter, a real store, auth/identity separation) —
`dispatcher.md:26` already notes v0 has no runner-hosted dispatcher. **The
ambitious design is blocked on infrastructure, not on another paper rework.**

**Honest meta-note (F11 territory, now doubled):** the shaper has twice
produced mechanisms that felt sound and did not survive independent grounded
review. A third solo rework would repeat the loop the profile warns against
("re-run the failing step and move on"). The decision now needs a *strategic*
call by the maintainer — retrench to what is buildable today, commit to the
infrastructure program, or park — not another shaper patch.

## Reframe v3 — what the findings ACTUALLY block (maintainer step-back, 2026-07-15)

The maintainer pushed back on the "park it" over-rotation: *what are the
findings actually blocking?* Precisely: they block **authenticity + full
autonomy**, not **completeness + freshness**. Split the machinery in two:

- **Layer A — completeness + freshness (the bookkeeping #278 actually
  failed).** "Are all owed reviews present, and each fresh against what it
  certified?" **Deterministic — CI computes it with zero trust in any
  agent**, and two moves make it buildable today:
  - **Consumer/resource model (maintainer's framing) dissolves the confused
    deputy (F1-finding-2) and the non-existent store (F2/R2).** A verdict is
    an **artifact** — `.grove/verdicts/<slot>` carrying checklist + evidence +
    the subject-hash it certified. No credentialed emitter to abuse; CI
    *reads* the resource and *recomputes* the subject-hash from HEAD itself;
    **git is the store**. Producer produces resources, the check consumes
    them.
  - **Auto-generated config is fine; the bug was *where it is read from*
    (F1/R3).** Generate the check from declarations, but resolve that policy
    from the **default branch (protected)** while verdict-artifacts live in
    the PR. Self-amending gate gone.
- **Layer B — authenticity + full autonomy: "did a *genuine, independent*
  review actually happen, with no human in the loop?"** *This* is what needs
  the attestation infra grove lacks (F3, F4, F10, the cross-run bound
  F2/F12/F13). **And it was always the human's to own** — the human merge gate
  reads the verdict artifacts and judges genuineness. #278 did not fail on the
  human's *judgment*; it failed on *bookkeeping* — the layer CI now takes.

**Consequence — this is buildable today, honestly scoped:**
- **A2 (only 1 of 3 gates ran) and A3 (stale PASS) become deterministically
  mechanizable now** — the two failures that started #59. Layer A delivers
  them with no attestation.
- **A1 (author ≠ builder) stays partial**: separation by *dispatch* + a
  disclosed, human-visible attribution in the verdict-artifact; a *forgery-
  proof* separation check waits on identity infra (Layer B).
- **Not overclaimed (third time's the discipline):** Layer A guarantees
  *present + fresh*, NOT *genuine*. An agent can still write a fake verdict
  file; CI cannot tell. Genuineness is the human's judgment at merge (E6),
  and full autonomy — trusting verdicts with no human — is a later,
  infra-gated increment, disclosed not pretended.

This reframes the strategic fork: not "ambitious vs modest vs park," but
**"ship Layer A now (buildable, fixes A2/A3, honest about A1/authenticity),
Layer B is a later infra increment."** Effects E0–E7 stand as the target;
Layer A is the mechanized subset that needs no infra. Proposed — to be
re-adversaried on the *narrow* Layer-A claim before any gate.

### The Layer-A claim, stated for adversarial test

1. **Verdict artifact.** A reviewing agent writes `.grove/verdicts/<slot>`
   into the PR branch containing: slot, verdict (PASS-class or not),
   checklist + evidence (`file:line`), the **subject-manifest** (the file
   set it certified) and the **subject-hash** (content hash of those files at
   the reviewed commit), and disclosed self-reported attribution (producing /
   reviewing run). Verdicts are **resources in git**, not credentialed
   statuses — no emitter secret, no external store.
2. **Policy from the protected default branch.** The `type → owed-slots`
   mapping + slot declarations are compiled by the setup skill and the CI
   check **resolves them from the default branch**, never PR HEAD.
3. **The check is deterministic, zero agent-trust.** For each changed file
   at HEAD: derive owed slots from its `type`; for each, find the verdict
   artifact; **recompute the subject-hash from HEAD** and compare (mismatch =
   stale = RED); require PASS-class + non-empty evidence. RED if any owed slot
   is missing, stale, non-pass, or vacuous. CI computes all of this; it trusts
   no agent-emitted signal.
4. **Explicitly OUT of Layer A (honest limits, disclosed):**
   - *Authenticity* — CI checks present+fresh, **not genuine**; a verdict
     file can be fabricated. Human owns genuineness at merge (reads the
     artifacts). (F3 conceded to Layer B.)
   - *A1 forgery-proof separation* — attribution is disclosed + human-visible,
     not a forgery-proof check. (F10 → Layer B.)
   - *Autonomous loop-bound* — a human bounds non-convergence (a stuck PR is
     visible); autonomous bounding is Layer B. (F2/F12/F13 → Layer B.)
   - *Undeclared-dependency* — subject-manifest = declared upstream; inherits
     adr-0006 §6 blind spot, disclosed. (F7.)
5. **Known sharp edge to probe (not claimed solved):** a PR that mutates an
   artifact's own `type` (or deletes its frontmatter) to dodge an owed slot —
   since owed-set derives from the file's type at HEAD. Candidate mitigation:
   cross-check the type against the file's identity on the default branch and
   treat a type-change/frontmatter-deletion as itself owing review. Adversary
   should judge whether this holds.
6. **Still owed regardless (F5):** reconcile the owed-set restatement with
   **approved adr-0006** as an explicit supersede/amend edge, in this change.

**Claim under test:** Layer A is buildable on grove today with no new infra,
is internally coherent, honestly bounded, and **deterministically delivers
A2 (completeness) and A3 (freshness)** — the two failures that started #59.

### Layer-A adversarial pass — result + closes (2026-07-15)

Third grounded pass, aimed only at the narrow claim (Layer B conceded).
**Result — the turn the design earned a path forward:** the reframe is
**validated**. The consumer/resource model + recompute-from-HEAD +
policy-from-default-branch **dissolve all three prior killers** (confused
deputy, non-existent store, self-amending gate). **A3 (freshness) is
deterministically delivered against the declared manifest** — closing F8's
"deterministic upstream-set" concern, Layer A's strongest real gain. **A2
(completeness) is NOT delivered as worded** — a fixable coverage gap, no
fabricated verdict needed. Crucially, the verdict: *"blocked on finishing the
spec, not on infrastructure grove can't conjure."* Seven closes, adjudicated:

- **C1 (F-A1, CRITICAL, decision-level correction) — add the coverage
  check.** As worded, item 3 recomputes the hash over the *manifest* but never
  asserts the manifest *covers* the owed set — so a genuinely-run review with
  an under-covering manifest, or a new changed file of an owing type, passes
  GREEN unreviewed (the #278 "1 of N ran" failure, no fake verdict). **Fix:
  the check derives the owed-coverage set from HEAD's diff (every changed file
  of an owing type) and asserts, per owed slot, that the union of fresh
  verdict manifests ⊇ the owed-coverage set**; any changed owing-file not
  covered by a fresh verdict = RED. Manifest serves both jobs — freshness
  hashes it, completeness checks it covers the diff.
- **C2 (F-A2, spec-altitude AC) — pin the `type → owed-slots` map,
  fail-closed.** The map is spec-altitude, but the spec MUST pin it and set
  the default for a new/undefined `type` to **owes the full review set
  (fail-closed)**, never "owes nothing" — so a `type: rubric`/`plan` code file
  cannot escape review.
- **C3 (F-A3, decision-level) — specified carve-out, not a silent one.**
  Verdict artifacts (`.grove/verdicts/`) and declared non-behavioral paths are
  exempt from *owing* reviews via an **explicit allowlist**; anything
  code-bearing outside the artifact dirs still owes code-review (the C2
  fail-closed default). The check rejects non-verdict content under
  `.grove/verdicts/` so it can't become a review-free zone.
- **C4 (F-A6, decision-level principle) — green is non-authorizing.** A green
  check means **"bookkeeping OK — present + fresh; now the human judges
  genuineness,"** explicitly NOT "reviewed / safe to merge." The merge
  affordance surfaces the verdict artifacts for the human to read; green must
  not substitute for that reading, or #278's false-confidence re-enters
  through the A/B seam. **Folded into E6.**
- **C5 (F-A4, disclose) — policy changes are human-owned.** A charter/
  declaration edit *is* a policy edit; CI cannot gate a policy-weakening as
  such — only the human merge gate can. Disclosed, not folded into
  "deterministic." Bootstrap (new type / first install, no default-branch
  entry) is **fail-closed** (owes the full set) until the policy adds it.
- **C6 (F-A7, adjudicated — clarification, NOT a change).** Verified against
  source (adr-0006 assigns `conformance-reviewer` code→spec and charter→ADR,
  never spec→decision). R4's per-layer instrumentation is **consistent with
  approved adr-0006** → a forward pointer / `informed_by` note suffices, **no
  supersession**. The legacy "conformance always owed" (D5) wording is
  corrected to **"an upstream-conformance *check* is always owed, instrumented
  per layer"** to kill the conformance-reviewer-always implication.
- **C7 (F-A5, correct wording) — "no new *platform* infra."** grove has zero
  CI today and the setup skill currently says "check by hand," so Layer A is
  **net-new grove code** (a CI workflow, a setup compile-step, the
  verdict-artifact convention, branch protection) on **existing GitHub
  primitives** (protected branches + Actions reading the base ref). Not
  infra-*blocked*; a real build.

**Status: reframe validated; decision architecturally sound; remaining work is
spec-completion, not infrastructure.** C1/C3/C4/C6/C7 resolved at
decision-altitude above; C2/C5 are acceptance criteria the authorized spec
must meet. **This is the first state from which the decision can honestly
converge.**

## Constraints (carried from the brief — bounds on any resolution)

- The fix must be **machinery or a structural default**, not more
  paragraphs. The originating session is the evidence that documentation
  does not change agent behavior.
- If any text lands, it **consolidates/replaces, does not accrete.**
- **No new trellis invariant** for Proposals 1 or 2 (both operational /
  dispatcher-charter). Proposal 3 stays a dispatcher corollary unless the
  maintainer promotes it.
- **Do not re-document role separation as prose** — it is already
  documented; that is the failure being reported.

## Considered and rejected

- **A-alone / B-alone enforcement** (only CI, or only a structural
  default) — rejected for C: B-alone leans on the agent following its
  default, the exact thing that failed in the reported session.
- **1a — drop role separation, let terminal-consistency subsume it** —
  rejected (maintainer, 2026-07-15): the gates check output consistency,
  not the specialization depth a cold `contract-author` + cold `executor`
  each deliver; a fused pass runs blended instructions and is a worse
  author *and* builder. Separation earns its keep independently of the
  gates.
- **Per-commit separation enforcement (author ≠ git committer)** — rejected
  (maintainer, 2026-07-15): squash/rebase/co-authorship make commit
  authorship an unreliable signal; forcing separation at commit granularity
  is the wrong instrument. Any separation check must key off a run-level
  signal, not git commit metadata (see the O1 park note).
- **A content-classifier for owed-set derivation** — rejected in favour of
  reading the artifact-contract frontmatter `type` (a file with no such
  frontmatter is code): reuses the existing contract, no parser invented.
- **Conformance owed "only when the PR carries code"** (a proposal of the
  shaper's, 2026-07-15) — rejected: it mis-scoped review as code-only. Every
  layer owes an **independent upstream check**, *instrumented per layer* (a
  spec is checked against its decision by the **spec-adversary**; code against
  its spec by the **conformance-reviewer**; a charter against its ADR by the
  conformance-reviewer). *(Corrected per the C6 close — the earlier wording
  "conformance always owed" wrongly implied the conformance-reviewer gates
  specs; it does not. This is consistent with approved adr-0006, which never
  assigns spec→decision to the conformance-reviewer.)*
- **The ambitious fully-autonomous version** (credentialed verdict-emitter
  skill, live-derived check, self-generating dispatcher) — rejected after two
  adversarial passes: it presupposed run-attestation, a forge-resistant
  verdict store, and protected-policy resolution that grove does not have, and
  the credentialed emitter was a confused deputy (any agent could emit a
  trusted verdict). Retained as the **Layer B** target, gated on that
  infrastructure; not this decision.

## Consequences (on approval; execution is a follow-up, not this PR)

This decision **authorizes a spec**; it does not implement the machinery. On
approval:

- **A spec is written** defining the mechanism in detail: the verdict-file
  format, the `type → owed-review` map, and the automated check's logic.
- **A verdict-artifact convention** is introduced (`.grove/verdicts/…`) — a
  reviewer's output is a file carrying verdict + evidence + the fingerprint of
  what it certified.
- **A new automated check** is added (grove has none today) that reads its
  owed-review policy from the protected default branch and enforces
  completeness, freshness, and coverage — on existing GitHub primitives
  (protected branches + Actions), no new platform infrastructure.
- **The setup skill** gains a step that generates that check from the agent
  declarations (replacing its current "check this by hand" fallback).
- **Reviewer charters** (`conformance-reviewer`, `code-reviewer`,
  `spec-adversary`) gain: emit your verdict as a verdict file. **Producers /
  artifact types** declare the reviews they owe.
- **A `decision-adversary` role is chartered** — the real independent
  soundness-adversary for decisions (retiring the spec-adversary stand-in); a
  decision owes its verdict *plus* the human intent gate.
- **The dispatcher charter's W1–W6 are demoted** from prescriptive workflow
  definitions to descriptive examples; the per-artifact owed/trigger rules
  become the source of truth (a consolidation, not new prose).
- **No existing decision is superseded.** adr-0006's conformance scope is
  *clarified* (per-layer instrumentation), consistent with it — recorded as a
  forward pointer, not a supersession (verified against adr-0006 this sitting).
- **Explicitly deferred to Layer B** (a separate future program, gated on
  infrastructure grove lacks): run-attestation so a verdict proves a genuine
  non-producer review ran; forgery-proof author≠builder separation; a
  forge-resistant verdict store; autonomous loop-bounding. Until then, those
  are the human's at merge, disclosed not pretended.

## Acceptance criteria (for the execution wave this decision authorizes)

- **AC1 — completeness.** The check goes red if any changed file that owes a
  review lacks a fresh, passing verdict file for it.
- **AC2 — freshness.** The check **recomputes** each verdict's subject
  fingerprint from HEAD and goes red on mismatch — it never trusts the
  fingerprint the emitter recorded.
- **AC3 — coverage.** The check derives the owed set from the PR diff and
  requires the verdicts' manifests to **cover** it, not merely to exist (closes
  the under-covering-manifest leak).
- **AC4 — fail-closed.** A changed file of a new or undefined `type` owes the
  **full** review set, never nothing.
- **AC5 — policy integrity.** The owed-review policy resolves from the
  protected default branch, never PR HEAD; the exemption for verdict files and
  declared non-behavioral paths is an explicit allowlist, and `.grove/verdicts/`
  rejects non-verdict content so it cannot become a review-free zone.
- **AC6 — green is non-authorizing.** A green check surfaces the verdict files
  for human reading and is presented as "bookkeeping done," never "reviewed /
  safe to merge."
- **AC7 — honest disclosure.** The shipped artifacts state plainly what is
  **not** guaranteed (genuineness, forgery-proof separation, autonomy) and that
  authenticity and policy changes are human-owned.
- **AC8 — decision-adversary.** The `decision-adversary` role exists and a
  decision's owed set includes its verdict plus the human intent gate.
- **AC9 — no infra pretence.** Nothing depends on unbuilt infrastructure:
  verdicts are git files, the store is git, the check uses existing GitHub
  primitives.
- **AC10 — adr-0006 pointer.** A forward pointer records the per-layer
  conformance clarification as consistent with adr-0006 (no supersession).

## Open questions (parked, ≤3)

- **Layer B — the autonomy/attestation increment.** Run-attestation,
  forgery-proof separation, a forge-resistant verdict store, and autonomous
  loop-bounding — the guarantees that let verdicts be trusted with no human in
  the loop. A separate program gated on infrastructure grove lacks; relates to
  grove#38 (the verifiable approval guard). Not this decision.
- **Full autonomy's loop bound.** Under human-in-the-loop v1 a person bounds a
  non-converging PR (a stuck PR is visible); a mechanical bound that survives
  rebase/squash is a Layer-B question, not needed for v1.

## Self-check (gate)

- **Frontmatter:** `id`/`type`/`status`/`depends_on`/`owner`/`updated` present
  and well-typed; `informed_by: [adr-0007]` records provenance (the
  code-reviewer gate model this generalizes) per `relations.md`. PASS.
- **`depends_on` resolution:** `adr-0005` and `adr-0006` both resolve and are
  `approved`; a `gated` artifact consuming `approved` ones is legal. PASS.
- **Required sections:** Decision-in-brief, Context (The problem), Intended
  effects, Consequences, Acceptance criteria, Open questions (2, ≤3),
  Self-check — present. PASS.
- **Append-only:** new artifact; no ratified decision superseded. adr-0006's
  conformance scope is *clarified*, verified against its text this sitting
  (adr-0006 assigns `conformance-reviewer` code→spec and charter→ADR, never
  spec→decision) — a forward pointer, not an in-place edit. PASS.
- **Naming register (`adr-0002`):** defining text uses `agent`/role names; no
  `druid`/`archdruid`. PASS.
- **Independent review — unusually strong, honestly reported:** THREE
  independent adversarial passes ran. The first two returned NOT-gateable and
  broke earlier versions; that history and every finding are preserved above,
  including the shaper's own retracted overclaims (F9, F11). The third
  validated the Layer-A reframe and returned "blocked on spec-completion, not
  infrastructure." The builder did **not** grade its own work. PASS.
- **Honest limits disclosed, not buried:** Layer B (genuineness, forgery-proof
  separation, autonomy) is explicitly out of scope; "green is non-authorizing"
  is a stated principle (AC6); A1 separation is disclosed as partial. PASS.
- **Scope discipline:** delivers A2 (completeness) and A3 (freshness) — the two
  reported failures that are mechanizable without infrastructure; A1 is
  honestly partial. No infrastructure pretended. PASS.
- **Human-approval boundary:** promoted `draft → gated` on this self-check.
  `approved` is the maintainer's intent act — an in-PR flip or merge — **never
  set by the agent** (`lifecycle.md`, `floor-intent-gate`). The design being
  gated is itself subject to the human intent gate it prescribes.

**Overall: internally sound, honestly bounded, and independently
stress-tested three times — `gated`, awaiting the maintainer's intent gate.
Not approved by the author.**

## Fourth adversarial pass — the ledger regression (2026-07-15)

After the third pass validated the **per-verdict-file** Layer A, the shaper
repackaged verdicts as **one shared status ledger per PR** (at the maintainer's
"do we need a file per review?" prompt). A fourth grounded pass reviewed the
ledger version — its *first* independent review — and **broke it**. Verdict:
**NOT gateable; the ledger is unambiguously worse than the per-file model.**

- **F-L1 (CRITICAL, provenance).** The ledger swap happened *after* the third
  pass, yet the ADR kept certifying "three passes validated this version." A
  later repackaging inherited an earlier version's credential — a
  "don't-grade-your-own-work" violation. Corrected: the ADR now says four
  passes and is honest that the ledger was an unreviewed repackaging that
  failed its first pass.
- **F-L2 (CRITICAL, concurrency — the maintainer's own doubt).** The per-file
  model is race-free by construction (disjoint `.grove/verdicts/<review>`
  paths). One shared ledger forces N cold stateless agents to serialize writes
  to one file; the two named fixes both fail against this repo — git does not
  auto-merge two appends to the same file tail, and there is no runner-hosted
  dispatcher in v0 to serialize (`dispatcher.md:18–31`, the same primitive the
  second pass ruled fatal). Under the ADR's own parallel dispatch the PR cannot
  reliably reach green.
- **F-L3 (HIGH).** CI derives the owed-set from the diff and recomputes
  fingerprints itself (AC2/AC3), so completeness+freshness come from CI, not
  the ledger — which works identically over a pile of files. The ledger bought
  **zero** guarantee and cost the race: a presentation preference dressed as a
  mechanism.
- **F-L4 (HIGH).** The `.grove/ledger.*` wildcard carve-out is wider than the
  file model's fixed `.grove/verdicts/` data directory — `.grove/ledger.sh`
  would be exempt executable code. Reverted to the fixed verdict directory.
- **F-L5 (HIGH, unresolved intent).** "A PR may touch anything" + "all at HEAD"
  does not preserve E1's build-on-*approved*-upstream: a bundled draft decision
  + spec built on it means the spec is reviewed against an un-approved
  decision, the human approving the whole stack at merge. Surfaced as an open
  question for the maintainer (accept vs. restrict).
- **F-L6/F-L7 (MEDIUM/LOW).** Aggregating rows into the one human-read surface
  widens the stale-row false-confidence seam; single-file writes give a
  row-writer reach over other rows' attribution. Both dissolve under the
  per-file model + CI-rendered view.

**Resolution (applied to the ADR, draft):** revert storage to per-verdict
files (the validated, race-free version); make the status "ledger" a
**read-only view the check renders** from those files, never a file agents
mutate — which gives the maintainer the single status surface they wanted
without the write race. F-L5 (free-form PRs vs approved-upstream) is the one
open intent call remaining.

## Maintainer's agent-model walk-through + reconciliation (2026-07-16)

The maintainer independently re-derived the agent model (trigger → action →
output per agent, format-only validation per producer) as a comprehension
check. Reconciliation outcome:

- **Confirmed equivalences:** "unreviewed code in diff" = unfilled owed slot;
  "reviewer signals issues" = fresh non-PASS verdict (grammar routes);
  "unfulfilled contract" = approved spec@vN unreflected in a package manifest;
  "manifest stands in for code" = the adr-0006 test-deps ledger as code's
  declared upstream (already folded into spec-0002 §A.3).
- **Uniformity correction:** no agent owns a validation — agents only produce
  artifacts (outputs / verdict files); the CHECK derives all validations
  (format tier = corpus-reviewer's contract computed in CI; content tier =
  owed verdicts); the dispatcher's routing is likewise a projection of
  declarations, not a private switch. `feedback` is an artifact type, not an
  agent.
- **Discarded (by the maintainer's own compute-f(A) rule):** a STORED
  dirty-flag on artifacts — dirty state is derivable (owed minus
  fresh-covering-PASS), a stored flag can drift/lie, and writing it into the
  artifact would change the artifact's own fingerprint (self-invalidating
  bookkeeping). Also discarded: "conformance runs first as tagger" — no
  ordering exists; the check is the tagger, every run.
- **Added (shaper): the memoization frame.** A verdict = a cached review
  result keyed by content-hash of subject ∪ upstream; freshness = cache
  invalidation; the gate = "no cache misses at HEAD"; re-review scoping =
  cache-key diff. Dirty-with-reason grammar (never-reviewed / self-changed /
  upstream-changed(X) / review-failed→findings / self-reviewed / vacuous) is
  computable per file × slot and serves check, status view, dispatch, and
  reviewer work-order from ONE derivation. Failed reviews are also memoized —
  same-content re-rolls are visible in the verdict file's git history (human
  judges at v1).
- **Open (maintainer's call pending):** the `spec → … + conformance` owed-map
  row vs. per-layer instrumentation. Reconciliation proposed: the
  conformance-reviewer has two functions — (i) upstream fidelity (code→spec,
  charter→ADR; NOT specs) and (ii) graph integrity (pins resolve, propagation
  section true; applies to any artifact change). Keep the spec row's
  `conformance` as function (ii) only, or drop it. To fold into spec-0002 +
  reason-grammar edits after the call; then the spec-adversary pass runs on
  everything, including all dispatcher edits.

## Reopened by the maintainer: two "settled" things re-reasoned (2026-07-16)

Maintainer: "my rules, even previously established ones, are not gospel" —
don't take the charter text or the just-written decision wording as fixed.
Two re-derivations, recommendations pending the maintainer's call:

1. **Fidelity/quality split (recommended).** The spec-adversary's fused
   design (fidelity-to-decision + intrinsic quality) was COMPENSATION for the
   missing decision-adversary (its UNSOUND verdict was the only decision
   backstop); adr-0012 charters a real decision-adversary, removing the
   fusion's reason. Recommend: conformance-reviewer = the fidelity instrument
   at ALL layers (spec→decision, code→spec, charter→ADR) + graph integrity
   (edge fidelity); per-layer quality gates = decision-adversary,
   spec-adversary (narrowed to intrinsic quality), code-reviewer. Wins: the
   owed-map collapses to ONE rule (fidelity-conformance iff artifact upstream
   exists + the layer's quality gate — no per-type table); fewer spurious
   re-reviews (quality verdict's subject = artifact alone, survives upstream
   edits; fidelity verdict's subject = artifact+upstream); code layer already
   proves the pattern (adr-0007's own boundary). Cost: two dispatches per spec
   change, each cheaper. Consequence: spec-adversary charter narrows
   (consolidate/replace).
2. **Verdict record home reopened (files were not gospel either).** The check
   needs only {verdict token, subject manifest+fingerprint, producer/reviewer,
   findings pointer} per (artifact × owed review). Real contest: (a)
   per-review files in the branch (platform-agnostic, tree-native; but a new
   artifact kind, merge-residue into main, a standing exempt-path attack
   surface, two write channels, push contention) vs (b) **structured verdict
   comments on the PR** (the verdict IS a message — the maintainer's original
   instinct; no tree residue, the entire carve-out attack surface vanishes,
   zero write contention, one channel, append-only = overwrite-gaming visible
   by construction; cost: platform-coupled read path — symmetric with grove's
   existing "any tracker with threaded comments" portability baseline).
   Shaper leans (b). Either way the mechanics (memoization, fingerprint
   recompute from HEAD, reason grammar, owed-assembly from charters) are
   storage-agnostic. Amending the decision's "verdict files / .grove/verdicts"
   wording is why it was left gated.

## Amendments applied + decision-adversary confirmed shipped (2026-07-16)

Maintainer confirmed both re-derivations: (1) the fidelity/quality split —
conformance-reviewer = fidelity instrument at every layer + graph integrity;
spec-adversary narrows to intrinsic quality; (2) verdict records =
structured, append-only PR comments (the commit point; session context is
working memory and does not count). Both amended into the lean ADR in place
(legal while gated); the superseded interim choices (per-verdict files;
fused spec-adversary) moved to Considered-and-rejected with why-nots.

On the maintainer's "should we ship the decision-adversary with this?": it
already ships — the phase-2 spin-out (O5) was superseded by the maintainer's
own R8 call, and the split makes it structurally required (a narrowed
spec-adversary loses the UNSOUND backstop, so without the decision-adversary
the decision layer would have NO adversary). Recorded in Consequences as
load-bearing: the split and the role ship together.

Next: contract-author revises spec-0002 to the amended decision (verdict
records, one-rule owed-map + fail-closed override, reason-grammar view,
narrowed spec-adversary semantics); in parallel, a fifth adversarial pass on
the amended ADR (a would-be decision-adversary run — fitting); then the
chartered spec-adversary agent on the revised spec. Fifth-pass status is
disclosed in the ADR's self-check — the amendments claim no pass-validation.

## Fifth pass (decision-adversary prototype) + spec revision (2026-07-16)

**Fifth pass verdict: NEEDS-REVISION — not UNSOUND** (premise held; the
Layer-A core mechanics survived; every must-fix was amendment-induced or
amendment-exposed, which is what a fifth pass on two unreviewed amendments
was for). Findings F1–F12, full text in the pass output; must-fixes:
- **F1 (HIGH):** the bundling "needs no new rule" argument rested on the
  *fused* spec-adversary (retired by the split) and MISQUOTED adr-0005 dec 3
  (which accepts a gated upstream). Fixed: the approved-upstream gate is now
  an explicit check rule (AC12); adr-0005 citation corrected; E1 wording
  covers gated.
- **F2 (HIGH):** "append-only… visible by construction" was a convention
  dressed as a platform property (comments are editable/deletable; v0 shares
  one identity). Fixed: claim retracted; check rejects edited records +
  restricts record authors (AC14); deletion conceded, disclosed.
- **F3 (HIGH):** the split orphaned the upstream-indictment route (old
  UNSOUND). Fixed: conformance-reviewer grammar gains **UPSTREAM-INDICTED**,
  routing to the upstream's layer (decision-layer → human).
- **F4 (HIGH):** "human-approved" uncomputable/undisclosed. Fixed: reads
  frontmatter status, disclosed as conceded-class; binding to a verifiable
  human act = Layer B (grove#38).
- **F5–F8 (MEDIUM):** implements-edge definition (the one-rule misfired on
  adr-0012's own depends_on — fixed + pins-resolve moved into the check,
  AC13); quality-input horn chosen explicitly (artifact alone); separation
  authority unified on record fields (AC7 rewritten; frontmatter author-tag
  demoted to optional provenance); decision-adversary remit + grammar
  (SOUND/NEEDS-REVISION/UNSOUND) stated in-body.
- **F9–F12 (LOW, noted):** "extension with precedent" softened to
  "unassigned territory"; fused-design over-invalidation cost thinner than
  presented (bites only pre-approval); README-class allowlist must be
  by-explicit-path (spec altitude); comment-model platform edges (pagination,
  schema versioning) to the spec.
All revisions applied in-place (legal while gated), shaper-authored,
disclosed in the self-check as not-yet-re-passed.

**Spec revision (contract-author, cold, parallel):** spec-0002 rebased to
the amended decision — records-as-comments (§A), one-rule owed-map (§B),
class-split fingerprints (quality=artifact alone; fidelity=+upstream, §A.3),
reason-grammar view (§D), carve-out deleted; 15 EARS + 15 GWT; PASS with
disclosures (four flagged concretizations: carrier block, latest-covering
selection, manifest_hashes, vacuous). Independently flagged the same
editable-comments hole as F2 (convergent detection). Known lag: the spec
predates the fifth-pass fixes (UPSTREAM-INDICTED, AC12–AC14, separation
authority) — deliberately left for the split-pair review to enumerate.

**Next (the decision's own split, applied to itself):** spec-0002 gets BOTH
reviews in parallel — `spec-adversary` (intrinsic quality) + 
`conformance-reviewer` (fidelity to the amended adr-0012 + graph integrity,
including enumerating the fifth-pass deltas the spec doesn't carry yet).

## Split-pair verdicts on spec-0002 + the live UPSTREAM-INDICTED (2026-07-16)

The decision's own split, applied to its spec, both cold:

- **spec-adversary (intrinsic quality): NEEDS-REVISION.** Five load-bearing
  gaps an executor would guess through: (1) the projection table's
  "research/feedback → none because no reviewer declares them" contradicts
  the fail-closed override (unclaimed → full set) — needs a positive
  reviewless declaration distinct from unclaimed; (2) the policy/declaration
  carrier (charter declarations, PASS-class table, allowlist) has no pinned
  schema/location; (3) the §C.5 human-gate red has no reason in the §D enum;
  (4) "code-bearing" undefined and collides with no-frontmatter⇒code
  (a README could never be allowlisted); (5) the test-deps-ledger step has no
  path/format/package-mapping convention. Plus 5 moderates (dangling
  depends_on ids fail OPEN; id collisions undefined; "approved class"
  undefined; two verdict blocks in one comment; renames) and 5 minors.
  No untestable criteria beyond those — fingerprint/selection/reason ordering
  judged genuinely mechanical.
- **conformance-reviewer (fidelity to the decision at HEAD): FAIL, as
  expected and disclosed** — the spec conforms cleanly to the 13:23 amendment
  but predates the fifth-pass fixes. Ten enumerated deltas (AC12
  approved-upstream gate incl. unchanged-upstream case; AC13 graph-resolution
  by the check; AC14 record-integrity + §E row rewrite; UPSTREAM-INDICTED in
  grammar+routing; AC7 producer-field authority — delete the mandatory
  frontmatter cross-check, rename author→producer; implements-edge
  definition; vacuous unflag (now decision-backed); decision-adversary
  PASS-class = SOUND; traceability to AC14; F11/F12 minors). Verified
  conforming as-is: carrier block, latest-covering selection,
  manifest_hashes-for-reasons-only, class-split fingerprints, one-rule
  owed-map, ledger-based code upstream.
- **The live UPSTREAM-INDICTED:** conformance item 6 found the spec faithful
  but the DECISION broken — no mechanical selector for the implements edge
  when depends_on lists several same-type ids. Routed upstream and fixed in
  the decision: an explicit **`implements:` frontmatter field** (adr-0011
  relations-taxonomy pattern; code via the test-deps ledger; fidelity-owing
  artifact with no declaration → red per adr-0005 dec 3, fail-closed). The
  review machinery performed the exact routing the decision defines, before
  the token ships.

**Routing:** all findings → ONE consolidated contract-author revision of
spec-0002 (conformance deltas 1–10 + adversary findings 1–15 + the
implements-field concretization), then a scoped adversary re-round on the
delta.
