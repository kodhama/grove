---
id: adr-0012-methodology-delivery-machinery
type: adr
status: draft
depends_on: [adr-0005-tdd-and-artifact-gated-dispatch, adr-0006-operational-conformance-mechanism]
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

# ADR-0012 (draft): methodology that reaches the point of action — role separation, gate completeness, and gate freshness as machinery, not prose

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

### Open (the live questions)

- **O2 — the `type` → owed-gate mapping table** (mostly closed from the
  charters this turn; one open call). Each verdict must be *fresh on HEAD*:
  - changed file is **code** (untyped / outside artifact dirs) →
    **conformance (→ spec) + code-review**
  - changed file `type: spec` → **spec-adversary** (checks spec → its
    decision *and* soundness; `spec-adversary.md` §Method 2–3)
  - changed file `type: charter` → **conformance-reviewer** (charter → ADR,
    `conformance-reviewer.md` §Method 8); **+ code-review** in grove's
    collapsed case where a charter also carries code
  - changed file `type: adr` (decision) → **human intent gate** (interactive
    shaping is the in-loop check). **The one open call → see O5.**
- **O5 — the standalone decision-only PR (the one wrinkle in the phase-1
  stand-in).** Direction settled in Decided (gate now via `spec-adversary`
  stand-in, dedicated agent spun out). Remaining: a decision that ships with
  no spec (adr-0012 itself) has no spec-adversary to stand in. Proposed:
  the phase-1 gate is **coverage-where-a-spec-exists**, not a blocker — a
  standalone decision PR owes no bot adversary and rests on human shaping
  (as today); closing that standalone gap is exactly the phase-2 dedicated
  agent's job. Confirm, or handle the standalone case in phase 1 too.
- **O6 — how reviewers/adversaries are wired into the topology** (the
  maintainer's open question, 2026-07-15: "not sure how the validation from
  the adversaries would be added"). Proposed **demand/supply** model, for
  confirmation:
  - **Producers declare demand** — an agent's output owes named **slots**
    (`shaper`: an `adr` owes the decision-adversary slot; `contract-author`:
    a `spec` owes the spec-adversary slot; `executor`: code owes conformance
    + code-review). This is the owed-set (rides the artifact `type`, D7).
  - **Reviewers/adversaries declare supply** — each registers **which slot
    it fills** and its verdict grammar (`spec-adversary` fills the
    spec-adversary slot, and phase-1 the decision-adversary stand-in slot,
    O5; emits APPROVE-READY / NEEDS-REVISION / UNSOUND). Its output *is* a
    verdict, recorded via the gate-verdict skill (D4).
  - **The setup skill compiles both sides** → the check (every demanded slot
    must carry a fresh matching verdict on HEAD) + a thin `slot → supplier`
    dispatch registry.
  - **The one real sub-fork — how the adversary is *dispatched*:**
    **slot-driven auto-dispatch** (an unfilled owed-slot on HEAD → the
    dispatcher runs whatever agent registered for that slot; the producer
    never names its reviewer — fully decoupled, matches gate≠agent D9;
    shaper's lean) vs **producer-named handoff** (the producer declares
    "hand to `spec-adversary` next"). Slot-driven makes adding/swapping a
    reviewer a one-line registration with zero producer edits.
- **O7 — freshness granularity (surfaced by the "is it the diff?" question).**
  D4 said "SHA-bound." But binding a verdict to the **whole-commit SHA**
  means *any* commit — even a typo in an unrelated file — invalidates *every*
  verdict and forces spurious re-reviews. The alternative binds each verdict
  to a **content-hash of its subject-set** (the artifact + upstream it
  certifies; for conformance, code + the spec). Fork:
  - **whole-commit SHA** — cheapest, literally free from GitHub's per-SHA
    commit statuses; over-invalidates (friction on every unrelated edit).
  - **subject-content-hash** *(shaper's lean)* — precise, no spurious
    re-reviews; a refinement of D4 (the skill computes a subject hash rather
    than using the bare SHA — a modest cost, still machine-checkable, but no
    longer literally free from the commit status).

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
  shaper's, 2026-07-15) — rejected: it mis-scoped conformance as a
  code-only check. Conformance is layer-to-upstream, so a spec change owes
  conformance to its ADR with or without code present. Recorded so the
  narrowing is not silently reintroduced.

## Consequences

- *(drafted once the mechanisms in O1–O4 converge — which charter/workflow
  files change, whether `pr-contract.yml` / adr-0006 machinery is touched,
  what supersession pointers if any.)*

## Acceptance criteria

- *(drafted at convergence, against the settled mechanisms.)*

## Open questions (parked, ≤3)

- *(distinct from the live Open list above; filled at convergence with
  anything explicitly deferred out of this decision's scope.)*
