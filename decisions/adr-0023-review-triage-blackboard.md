---
id: adr-0023-review-triage-blackboard
type: adr
status: approved  # maintainer intent act (in-session approval), 2026-07-19 — recorded flip per lifecycle.md; decision-adversary SOUND (5 non-blocking precision findings folded pre-gate, incl. the residue disambiguation and the adr-0021-D4 trigger ruling, which this approval ratifies); author (shaper) ≠ approver; the PR merge is the ship/landing act
depends_on: [adr-0012-methodology-delivery-machinery, adr-0013-check-scope-mode, adr-0015-reviewer-machine-boundary, adr-0017-dispatcher-posts-records-self-adoption, adr-0019-batched-verdict-records, adr-0021-gate-profile-self-adoption, adr-0022-strict-mode-review-friction, spec-0002-review-bookkeeping-check]
owner: agent
updated: 2026-07-19
---

# ADR-0023: review-triage blackboard — front the table (shadow adoption)

> **Suspended by `adr-0027-retire-ci-for-now` (2026-07-21).** The
> blackboard/auditor lineage — the `grove-review-ask`/`grove-audit`
> record classes, the spec-0003 shadow contract, the `auditor` role, and
> the record skills — is suspended with the check (adr-0027 D1: no
> check, no owed-set to audit). **D2's closing-ask principle survives,
> re-homed as prose** (adr-0027 D2): every producing pass still ends by
> declaring, in plain prose on its change-request, its subjects, their
> type, and an advisory read on what deserves review — advisory,
> untargeted, non-self-exempting, exactly the D2/D3 lineage; only the
> record mechanism suspends. Code preserved; revival via adr-0027 D4.

> **`gated` — converged, awaiting review.** grove#97 seeded a successor
> to the deterministic owed-review table: producers post review-asks,
> reviewers triage depth, an in-session auditor posts an audit record,
> CI verifies records. Five maintainer iterations converged the seed;
> a **four-lens adversarial panel** (fail-open hunter, human-heavy
> consumer, null hypothesis, blast-radius — verdicts and findings on
> grove#97) then repaired it: the two critical fail-open findings and
> the two fatal-for-humans findings trace to one substitution
> ambiguity, resolved here as **D1**; the panel's honest 10–20× cost
> estimate prices the full replacement architecture, which **D6**
> defers rather than decides. The maintainer's
> steer (2026-07-19, recorded on grove#97): adopt the repaired
> architecture in **shadow mode now** — phases 0–2, grove-self only,
> report-only — with the flip parked behind named criteria. All
> questions are Decided (**D1–D7**); the shaper self-checked to `gated`
> and routes to the `decision-adversary`, then the intent gate.
>
> The shape in one breath: **D1** the deterministic core survives as a
> **conjunct** — the blackboard *fronts* the table, never replaces it;
> an audit record attests owed-set completeness only, never pair
> satisfaction. **D2** producers post typed, untargeted asks
> unconditionally by convention — asks **add obligations, never
> remove**. **D3** reviewers own review depth; subscription is
> obligation; the vacuous-evidence rule is the floor. **D4** a
> cold-started in-session auditor posts an audit record carrying a
> machine-stamped residue manifest and content/policy/stream bindings;
> an empty-residue PR needs no audit at all. **D5** phases 0–2 build
> now on grove-self, report-only; math-quest untouched until a declared
> #309 boundary; lockstep skew accepted-and-disclosed. **D6** the flip
> is a **future decision** parked behind named criteria and
> prerequisites — this ADR supersedes nothing. **D7** maintainer
> overrules accrue in a single precedent log from day one.

## Decision state

### Decided

- **D1 — Conjunction, never substitution: the blackboard fronts the
  table** *(panel convergence — all four lenses; maintainer,
  2026-07-19)*. The deterministic verification core — per-pair
  matching, freshness, separation, vacuous-evidence, the §C.5/§C.6
  human gates, §C.7 graph resolution — **keeps running in CI,
  mechanically, over the derived owed-set**, exactly as
  `plugins/grove/check` does today. The audit record answers ONE
  question: *was the owed set complete?* It never attests that a pair
  is satisfied. CI green ⇔ (deterministic checks pass) ∧ (a fresh,
  admissible audit record covers the judgment residue). The
  *substitute* reading — CI checks only that an audit record exists —
  is **rejected as broken** (fail-open F1: one wrong LLM-authored
  record would green an entire PR; today nothing an agent posts can
  green a pair the recomputation reds). Corollary: the current table +
  scoped jurisdiction (`adr-0013`) survive as the **permanent no-ask
  floor** — in a repo where humans produce most changes the majority
  lane stays deterministic and zero-LLM (human-heavy F2). The accurate
  framing of this whole decision is *"front the table with an ask lane
  and an audit"* — the phrase "replace the table" is retired.

- **D2 — Producer review-asks: typed, untargeted, unconditional,
  additive-only** *(seed iterations 1/3/4; fail-open F3;
  maintainer, 2026-07-19)*. Every producing role ends its pass by
  posting a `grove-review-ask` record — **convention, not judgment**
  (the mini-PR rule: always ask, however good you think you are), so
  the producer never decides *whether* its work gets eyes. The ask
  carries the subject list, the produced type, and optional advisory
  annotations; it names **no reviewer** (targets are emergent —
  reviewers subscribe by type via their existing
  `grove-review-declaration` blocks; adding a specialized reviewer
  costs one declaration and zero producer edits, grove#43's
  requirement). Hard rules, all deterministic:
  - **An ask may never name a reviewless type.** Reviewless routing
    remains available only through the file's own frontmatter +
    policy, exactly as today — the ask channel can only ADD
    obligations, never remove them (closes the type self-exemption
    door fail-open F3 named: today code files physically cannot carry
    frontmatter; an ask that could type them `research` would be a
    self-service exemption for code).
  - **For a frontmatter-bearing subject, frontmatter type wins**; a
    divergent ask-type is inert for that file and surfaces as an audit
    finding — never a precedence roll (human-heavy amendment A5).
  - Ask absence is signal, not permission: an **in-jurisdiction** diff
    file no ask covers falls to the residue (D4), never to silence.
    (Out-of-jurisdiction silence under `scoped` mode remains
    `adr-0013`'s standing design, preserved by D1's corollary.)

- **D3 — Reviewer depth-triage; subscription is obligation** *(seed
  iterations 2/4; null §3; fail-open F8; adopted immediately —
  zero-architecture)*. How deep a review goes is the REVIEWER's
  judgment — the human-team split: convention decides *whether*, the
  reviewer decides *how deep*. Nothing in `spec-0002` mandates depth;
  the floor is the existing `vacuous-evidence` rule (shallow is
  allowed; empty is not) plus one new charter line: **the reviewer's
  findings state its own depth decision and evidence basis — never the
  ask's framing** (annotations are input, not instruction; fail-open
  F8's steering guard). A reviewer that declares a type in its
  `grove-review-declaration` **owes** pickup for matching asks —
  "wants to" is fail-open and rejected; an ask whose type matches no
  declaration goes red (INV7's unclaimed-type fail-closed, blackboard
  form). Depth-triage lands NOW as reviewer-charter prose — it is the
  measured cost driver (PR #96: 15 rows at undifferentiated full
  depth) and it decouples completely from the rest of this decision.

- **D4 — The in-session auditor and the audit record** *(seed
  iteration 5, repaired by fail-open F2/F5/F6/F7 and human-heavy
  F1/F3)*. A **cold-started** auditor agent — reads the blackboard
  (records + diff) and NEVER the session conversation ("a review the
  dispatcher remembers ran does not count") — derives the owed-set by
  the graceful-degradation stack (asks → frontmatter typing → judgment
  only for the residue), delta-audits it against the verdict records,
  and posts a `grove-audit` record. The record's bindings, all
  machine-stamped by the emitter (the `adr-0015` judgment/stamp split
  applied to the audit itself):
  - a **residue manifest**: `diff_files ∖ ask_covered_files`, computed
    by the shared deterministic evaluator — CI recomputes the same
    set-difference and reds on mismatch, so "auditor missed a file" is
    mechanically impossible (fail-open F2);
  - **content fingerprints** of the diff files (`grove-fp-1` blob
    bytes — no-op rebases stay fresh; fail-open F7);
  - a **policy fingerprint** over the protected-branch policy carriers
    — a post-audit policy change on main stales the audit (fail-open
    F5);
  - a **typed record-stream high-water mark**: only
    `grove-review-ask`/`grove-verdict` blocks past the HWM stale the
    audit; prose comments never do; audit records are excluded from
    the invalidating class (fail-open F6);
  - the audit record itself obeys the **vacuous-evidence rule one
    level up**: a per-residue-file disposition is required; an empty
    body satisfies nothing;
  - **auditor ∈ producers ⇒ inadmissible** — the separation rule
    extended to the audit (same trusted-self-reported tier as §C.4
    today; no new concession class).
  **Two residues, both deterministic — named to prevent conflation
  (decision-adversary F1):** the **coverage residue**
  (`diff_files ∖ ask_covered_files` — the manifest CI recomputes) and
  the **judgment residue** (the stack's tail: in-jurisdiction files
  resolved by neither asks nor frontmatter typing — the only set the
  auditor's judgment layer touches). **Residue-conditional**: a PR
  whose **judgment residue** is empty needs NO audit record — it
  greens under the deterministic lane exactly as today (human pushes
  and fork PRs keep the zero-LLM UX; fork-PR posters never hit the
  §A.4 admissibility wall on an audit they cannot post; human-heavy
  F1). `spec-0003` defines both sets explicitly. Judgment thereby runs
  only where someone is present, and only where there is something to
  judge.

- **D5 — Shadow adoption now: phases 0–2, grove-self only,
  report-only** *(maintainer steer, 2026-07-19, recorded on
  grove#97)*. Build now: **phase 0** — the `grove-review-ask` schema,
  a `record-ask` skill (structural sibling of `record-verdict`), the
  unconditional-ask closing duty in the three clean producing charters
  (`executor`, `shaper`, `contract-author`; `divergent-researcher` is
  reviewless-typed output — no-op; the two remediation roles get an
  explicit in/out call at spec time). (D3's prose and D7's log land
  earlier, with this decision's own PR — propagation item 0.)
  **Phase 1** — the auditor role (three lockstep
  homes), the `grove-audit` schema with D4's bindings, a
  `record-audit` skill, the dispatcher's cold-start-the-auditor duty.
  **Phase 2** — a report-only CI comparator logging, per PR:
  table-owed rows the audit omits (candidate false positives),
  audit-owed rows the table missed (candidate false negatives), no-ask
  diff files (convention-break rate), audit-fresh-at-HEAD rate (the
  flip-day red rate), and HWM races. **The gate does not change**: the
  shipped table check keeps gating throughout; ask/audit blocks are
  inert to it by fail-closed non-recognition. Constraints honored:
  **grove-self only** — math-quest is not migrated until a **declared
  #309 dataset boundary** (mid-experiment migration would change what
  the organic strict-noise dataset measures); **lockstep skew
  accepted-and-disclosed** — mid-shadow installers snapshot ask-duty
  charters while their shipped check gates table-mode; this is
  disclosed skew, not breakage (nothing consumes asks; nothing
  softens), and it is the known cost of adr-0021 D4's lockstep with no
  release valve — the valve becomes a hard prerequisite at D6, not
  here.

- **D6 — The flip is a future decision; parked with named criteria and
  prerequisites; this ADR supersedes nothing** *(null §4; blast-radius
  §5/§6; fail-open F7)*. Retiring the table as the gate (and with it
  §B/§C.2's owed-map, scope mode, and parts of
  `adr-0012`/`adr-0013`/`adr-0022`) is the largest spec+decision
  surgery in the repo's history (~10 INVs, ~9 scenarios die or
  transform) and is **not** decided here. It reopens as its own shaped
  decision only when ALL of:
  - **shadow evidence**: judge-missed-real-obligation ≈ 0 across the
    shadow window; adjudicated false-positive reduction material
    against the PR #96 baseline; audit-fresh rate high enough that the
    staleness red is rare, not routine; precedent-log overrules
    decaying, not accruing;
  - **prerequisites built**: branch protection ON for `main` requiring
    the check (deterministic-only CI removes the flakiness excuse —
    without it the fail-closed claim is a light nobody must obey); the
    adr-0021 D4 release/tag valve EXISTS (a fresh installer must never
    receive charters describing a gate their CI does not run);
    math-quest's #309 has reported and its dataset boundary passed;
  - **tier-2, if ever built** (headless judge): its output is itself
    only a record under the same conjunction — it can never un-red the
    mechanical layer (fail-open F11), and prompt-injection via PR
    content can therefore at worst fail to red the residue, never
    green a red.

- **D7 — The precedent log starts now** *(null §5 steelman —
  irreversible corpus loss; its cheap mitigation adopted)*. One
  append-only file, `reference/review-precedents.md` (home confirmed
  at spec time), records each maintainer overrule of an owed-review
  outcome — the case-law corpus the auditor's judgment layer will
  consume, single-homed so dispatch-time and CI-time judgment learn
  from the same precedents (grove#97 shared-evaluator addendum). Cost:
  one file, zero roles, zero schemas.

## Given (inherited — cited, not reopened)

- **`adr-0012`**: reviews are currency as posted records; the check
  verifies bookkeeping, never approves; policy human-owned (AC8).
- **`adr-0013`**: scope modes; the fail-closed silence default; the
  rejected review-free-zone class — D2's additive-only rule upholds
  it.
- **`adr-0015`**: the judgment/record split and the shared-basis
  discipline — D4 applies both to the audit record.
- **`adr-0017`**: the session posts records, CI reads them — D4/D5
  apply the same shape to the audit; `record-verdict` is the
  structural template for `record-ask`/`record-audit`.
- **`adr-0019`**: batching — asks and audits post batched, one comment
  per pass.
- **`adr-0021`**: lockstep canonical→vendored sync and the parked D4
  release-valve trigger — D5 discloses the skew; D6 makes the valve a
  flip prerequisite.
- **`adr-0022`**: the carve-out lineage this line of work eventually
  retires — but NOT here; adr-0022 stands unamended through shadow.
- **`spec-0002` (approved, @v4)**: the registry (§A records,
  fingerprints, admissibility, separation) survives wholesale — it is
  the substrate D2/D4 build on; §B/§C.2 are untouched during shadow.

## Rejected options

- **Substitution reading** (CI checks only audit-record existence):
  broken — collapses INV1–INV17 into one LLM-authored record's say-so
  (fail-open F1). Rejected for D1's conjunction.
- **"Replace the table"** as the framing and end-state: rejected for
  "front the table" (human-heavy F2) — the deterministic table +
  scoped jurisdiction are the permanent no-ask floor, load-bearing for
  human-heavy consumers, not a transitional artifact.
- **Hardcoded ask-targets in producer charters**: reversed during
  seeding (grove#97 iteration 3) — couples the stable side to the
  growth side; a specialized reviewer must cost one declaration, zero
  producer edits.
- **Ask-typing with precedence over frontmatter, or reviewless-typed
  asks**: rejected — the self-service exemption channel (fail-open
  F3).
- **Unconditional audit-record requirement** (every PR needs one):
  rejected — fatal for human-heavy consumers and fork PRs (human-heavy
  F1). D4's residue-conditional rule instead.
- **Park everything (the null verdict as-is)**: considered seriously —
  its evidence critique is folded (D6's criteria ARE its trigger
  discipline; D7 is its steelman mitigation) — but the maintainer
  weighs starting the calibration corpus and exercising the
  architecture over waiting: shadow is report-only, the gate does not
  change, and the panel's guards close the critical findings. The
  residual risk accepted: build-before-first-data-point on ~3–5
  sessions of additive machinery, plus disclosed lockstep skew.
- **Build the flip now**: rejected outright — no shadow evidence, no
  flip prerequisites, heaviest ceremony in repo history (blast-radius
  §6).

## Consequences / propagation (POST-approval work)

This set is firm; discoveries append here, never silently expand scope.
Contract-first: **item 1 precedes all build** (build only on approved
contracts).

0. **With this decision's own landing PR** (spec-independent, per
   decision-adversary F5 — one timing, stated once): D3's depth-triage
   prose in the four reviewer charters (+ lockstep homes) and D7's
   precedent log seeded. Nothing else lands before the contract.
   *(Discovery at execution, appended per this section's rule: D7's
   `reference/review-precedents.md` does not resolve — no root
   `reference/` exists, and the payload `reference/` dir holds only
   vendored copies, which an original would violate. Interim home is
   the companion convention: `charters/review-precedents.md`;
   `spec-0003` confirms or moves it, per D7's own "home confirmed at
   spec time".)*
1. **`contract-author` authors the shadow contract** — a NEW spec
   (`spec-0003`, working title *review-asks-and-audit*) covering: the
   `grove-review-ask` and `grove-audit` schemas (D2/D4 bindings,
   admissibility, batching), the residue derivation
   (`diff ∖ ask_covered`), the residue-conditional rule, the typed-HWM
   staleness rule, the comparator's report format, and the
   auditor-separation rule. `spec-0002` is NOT amended (shadow is
   additive; its records are inert to the shipped check). Then
   `spec-adversary`, then the spec gate per the profile.
2. **Phase 0 build** (post spec-approval): `record-ask` skill; ask
   closing-duty in `executor`/`shaper`/`contract-author` charters ×
   lockstep homes.
3. **Phase 1 build**: `charters/auditor.md` (+ two vendored homes);
   `record-audit` skill; the HEAD-basis/watermark emitter code in the
   check package (reusing `groveFp1`/`blocks.mjs`/admissibility);
   dispatcher gains the cold-start-auditor duty.
4. **Phase 2 build**: the report-only CI comparator (log-only job or
   step; the existing `issue_comment` re-trigger already re-fires the
   check when records post).
5. **grove#97 closes with this decision's landing**; the shadow
   metrics and flip criteria (D6) get a tracking note there; the flip
   reopens as its own `[shaping]` when D6's conditions fire.
6. **grove#91** (dogfooding tracker) gains the shadow-mode line.

## Design constraints (honored while shaping — not open questions)

- **The floor invariant holds throughout**: ≥1 human intent-locus gate;
  decisions always owe the `decision-adversary`; separation and
  admissibility never soften. The constitutional core never goes
  probabilistic.
- **The gate never changes during shadow** — the shipped table check
  keeps gating every PR; everything new is report-only.
- **Correlated-judgment caveat stands**: in an all-Claude shop the
  author-model also audits; the auditor seat is the highest-leverage
  place to spend model diversity if a second provider is added. Not a
  blocker for report-only shadow.
- **`inv-minimal-first`, applied honestly**: the panel's null lens
  priced the alternative and its two zero-cost wins are adopted (D3
  now, D7 now); what is built beyond them is the maintainer's explicit
  scope call, recorded with its residual risk in Rejected options.

## Acceptance criteria (for the post-approval passes)

- **AC1** (phase 0): a producer pass on grove-self ends with a posted,
  admissible `grove-review-ask` batch; asks naming a reviewless type
  or contradicting frontmatter are inert-per-file and flagged.
- **AC2** (phase 1): the auditor cold-starts from records + diff only;
  its `grove-audit` record carries residue manifest, content
  fingerprints, policy fingerprint, and typed HWM; an
  `auditor ∈ producers` record is inadmissible.
- **AC3** (phase 2): the comparator logs the five shadow metrics per
  PR; the shipped check's verdict is byte-identical with and without
  ask/audit records present (gate unchanged — the load-bearing
  regression guard).
- **AC4**: an empty-residue PR produces no audit obligation and greens
  exactly as today (human/fork-PR UX preserved).
- **AC5**: depth-triage prose present in all four reviewer charters;
  precedent log exists and is append-only.
- **AC6**: both suites + typecheck green; review-bookkeeping green on
  every landing PR (records posted per the proven #93/#96 recipe).

## Self-check (gate → `gated`)

- **Internal coherence**: D1's conjunction is the load-bearing repair —
  D4's bindings all serve it (each converts an audit *claim* into a
  CI-recomputable *fact*); D2's additive-only rule composes with D1
  (the ask lane can only grow the owed-set the deterministic core
  verifies). D5 builds nothing the D6 flip would have to un-build.
- **Contradiction sweep vs standing decisions**: none amended, none
  contradicted — adr-0013's review-free-zone rejection is *upheld* by
  D2; adr-0021 D4's lockstep is honored with disclosed skew and its
  release-valve trigger deliberately NOT fired here (the flip fires
  it); adr-0022 stands whole through shadow.
- **Build-on-settled-ground**: all eight `depends_on` upstreams are
  `approved`; the seed (grove#97) is input, not ground — everything
  load-bearing from it is re-decided here post-panel.
- **Honest scope**: D6 states plainly that this ADR does not decide
  the flip, does not amend spec-0002, and does not touch math-quest;
  the residual risks of the maintainer's shadow-now call are recorded
  in Rejected options, not buried.
