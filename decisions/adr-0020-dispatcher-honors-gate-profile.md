---
id: adr-0020-dispatcher-honors-gate-profile
type: adr
status: approved  # maintainer's intent act (in-session approval), 2026-07-19 — recorded flip per lifecycle.md; decision-adversary SOUND on scoped re-review (13a6e63); author (shaper) ≠ approver (maintainer); the PR merge is the ship/landing act
depends_on: [adr-0018-gate-profile-and-trigger-split]
informed_by: [adr-0012-methodology-delivery-machinery, adr-0005-tdd-and-artifact-gated-dispatch]
owner: agent
updated: 2026-07-19
---

# ADR-0020: the run-sequencer honors the gate-profile at run time

> **The concrete resolver location is superseded by
> `adr-0035-plugin-and-consumer-boundary`.** Per-handover deterministic
> resolution, guardian fallback, and the dispatcher-as-single-reader contract
> stand; the active host adapter now invokes the plugin-resident resolver.
>
> **`gated` — converged, awaiting review.** This decision activates
> `adr-0018` at run time: `adr-0018` built the gate-profile machinery
> (`gates.toml`, the floor validator, the `guardian` fallback,
> `resolveProfile` + the `resolve-profile` CLI) but **nothing read it when
> sequencing a run** — a repo-wide grep found no consumer of
> `resolve-profile` outside `gates/`, `setup`, and `set-profile`; the
> gate-profile was **configuration without enforcement**. This decision
> makes the **dispatcher** the single run-time reader and enforcer. All
> questions are Decided (**D1–D6**); the shaper self-checked this to
> `gated` (see `## Self-check`) and does **not** promote further — it
> routes to the `decision-adversary` and then the **human intent gate**;
> the maintainer's recorded approval/merge is the ratification act
> (`floor-intent-gate`), never the shaper's flip. Read `## Decision state`
> first — it is the live state of the decision in one place.
>
> The shape in one breath: **D1** dispatcher-central, gate fires
> post-convergence (the independent check always runs; the profile only
> decides whether a human ratification is *additionally* required); **D2**
> per-handover resolution, snapshotted at run start; **D3** backprop
> cascades serialize on any ratification edge, batch only human gates;
> **D4** `intent`/`spec`/`build` are per-artifact stage gates, `ship` is
> the run-level landing gate, one act may perform coincident gates with a
> record per gate; **D5** channel authentication defers to grove#74 with
> `adr-0018` D11 as the named interim; **D6** the guardian fallback
> surfaces per-handover on the run's status surface and the next gate
> prompt, repeating until restored. **D6 was drafted by the shaper under
> the maintainer's explicit delegation** — flagged, reversible at review.

> **Revision 2026-07-19 (scoped — for adversary re-review).** Folds the
> `decision-adversary` **NEEDS-REVISION** (one load-bearing break + one
> coherence/completeness break + one observation). **Scoped delta — only
> these touched:** **(Break 1, maintainer-confirmed fix)** the per-profile
> floor validator is not sufficient per **run** — a floor-legal custom
> override (`intent=human, ship=agent`) can yield a **zero-human**
> decision-less run (only build+ship in play). Fixed as a **refinement to
> D2 + D4, not a new axis**: a **per-RUN floor check at run start** (the
> same moment as D2's snapshot) that **escalates the run-terminal `ship`
> gate to human for that run, loudly**, when the run's in-play gates hold
> no human intent-locus gate; governs **until `adr-0018` P1 lands**
> (pointer). The affected sanity-note and self-check claims are qualified
> (the shipped presets are unconditionally safe — all `ship=human`; the
> hole opened only via the supported per-gate override). **(Break 2a)**
> the Q1-crux recap still carried the pre-correction "routes to the agent
> gate-keeper (not a skip)" phrasing D1's post-convergence correction
> superseded — recap fixed to the corrected model. **(Break 2b)** the
> propagation list now names **all four** dispatcher-charter
> human-at-decision-layer assertion lines (63-64, 79, 115-116, 191), and
> the matching acceptance criterion is **broadened** to bind "no remaining
> hardcoded gate-ownership assertion," not only the enumerated inventory.
> **(Observation)** one propagation note added on `charters/lifecycle.md`
> consistency (agent-ratified artifacts stay `gated`; no lifecycle
> rewrite). **No new Decided item; no D-number added** — the fix corrects
> D2/D4's *coverage*, not the set of decisions. Self-check re-run.

## Decision state

### Decided
- **D1 — dispatcher-central: the run-sequencer is the single reader and
  enforcer of the gate-profile** *(maintainer, 2026-07-18)*. Resolves the
  Q1 crux (Option A over B/C — see `## Rejected options`).
  - **The dispatcher is the single component that reads
    `.grove/gates.toml`** (via `resolve-profile`) **and enforces
    pause-vs-proceed at each handover.**
  - **The gate fires POST-convergence, never on raw producer output**
    *(correction, maintainer 2026-07-18 — supersedes the earlier
    "`C2=agent` → route to the agent gate-keeper" phrasing, which wrongly
    read the adversary as an **alternative** to the human).* The human
    must never see an unconverged draft. The ordering holds for **every**
    stage:
    1. **producer** produces a draft (`shaper`/`contract-author`/
       `executor`);
    2. **convergence — ALWAYS runs.** The stage's independent check
       (`decision-adversary` for a decision, `spec-adversary` for a spec,
       conformance + code-review for a build) runs and emits its verdict
       record — the builder never grades its own work
       (`inv-independent-verification`). **The human sees nothing yet.**
    3. **the gate (ratification), on the CONVERGED artifact.** The profile
       decides only whether a human ratification is *additionally* required
       on top of convergence:
       - **`C2 = agent`** → the **convergence verdict IS the ratification**
         (the independent adversary's `SOUND`; adversary ≠ producer, so
         independence holds). No human required.
       - **`C2 = human`** → the converged artifact goes to the **human**;
         their **recorded approval** ratifies it (merge / in-session, per
         D11's self-authenticating channels).
    - **So the adversary/reviewer is NOT an alternative to the human** — it
      **always** runs as convergence; the profile only decides whether a
      human ratification is *additionally* required. *(This is exactly how
      adr-0018/0020 themselves ran: shaper converged → `decision-adversary`
      `SOUND` → then the human intent gate.)*
  - **Stage charters shed their ownership assertions.** The
    `shaper`/`contract-author`/`executor` charters stop *asserting* who
    owns their gate (e.g. `shaper.md`'s "the merge is the approval; the
    intent gate never opens to agents"); the dispatcher becomes the single
    authority, **reading** ownership from the profile rather than each
    stage hardcoding it. *(Post-approval executor edit — see
    `## Consequences / propagation`.)*
  - **This discharges `adr-0018`'s D2 "merge is the approval" wording
    flag** *(resolves Q8)*. The stage charters shift from *asserting*
    ownership to the dispatcher *reading* it, so the merge-only phrasing
    the D2 flag worried about is removed at its source — not left as a
    later clarifying touch.
  - **Rationale for A over B (single reader, not N):** the safety-critical
    floor logic (floor validation + `guardian` fallback, `adr-0018` D8)
    **lives once, in the dispatcher's read path**, so it cannot **drift**
    across N stage charters each re-implementing it. The `adr-0012` "gates
    emerge from agent boundaries" counter-argument does not apply: it is
    about where gates *emerge*, not where they are *enforced* —
    **enforcement stays central** even though the gate structure is still
    emergent (the profile configures that structure, it does not replace
    it).
  - **What D1 settles about agent-owned gate semantics (folds former Q5).**
    Convergence always runs; under `C2 = agent` its verdict record IS the
    ratification. For the `initiator` front `intent` gate specifically,
    that convergence check is the `decision-adversary` (soundness-ratify)
    with the human intent-ratification relocated to `ship` (`adr-0018` D3,
    Given).
  - **Deterministic realization — resolves former Q4.** The gate advances
    **only on a posted record**, never on the dispatcher's memory of the
    profile: convergence **always** produces its verdict record; under
    `C2 = agent` **that convergence record IS the gate record**; under
    `C2 = human` an **additional post-convergence human-approval record**
    is required (the human-approval-record shape leans on grove#74). This
    mirrors grove's standing "a review the dispatcher *remembers* ran does
    not count — only a posted verdict record does" boundary, so a
    charter-following v0 dispatcher cannot skip a human gate from recall.
- **D2 — per-handover resolution, snapshotted at run start** *(maintainer,
  2026-07-18)*. Resolves the Q2 read-granularity fork.
  - **The dispatcher re-runs `resolve-profile` at every gate/handover**,
    **not** once per run. Rationale: (a) it is **entailed by D1/Q4's
    record-not-memory + re-invoke discipline** — a once-per-run cached
    reading would resurrect exactly the cached-state the determinism rule
    rejects; (b) it lets the **D8 `guardian` fallback fire at the next
    gate** if the profile goes missing/unreadable/floor-violating mid-run
    (the floor is checked at each gate, never cached); (c) it **re-resolves
    cleanly for the W4 cascade (Q9)** after each upstream gate clears.
  - **The resolved profile is snapshotted (logged) at run start** so any
    mid-run shift of `.grove/gates.toml` between two gates is **visible and
    auditable** (`floor-transparency`), never silent — the one real
    downside of per-handover (the profile *can* change mid-run) becomes a
    **surfaced event**, not an invisible one.
  - **The floor check is per-RUN, not only per-profile** *(revision
    2026-07-19 — adversary Break 1, fix confirmed by the maintainer; a
    refinement of D2 + D4's coverage, not a new axis)*. The per-profile
    validator (`intent = human` OR `ship = human`) is necessary but **not
    sufficient**: a floor-legal custom override
    `{intent=human, spec=agent, build=agent, ship=agent}` passes it, yet a
    **decision-less run** (a W3 bug fix, a triggered remediation, a
    backprop repair) traverses only `build` + `ship` (D4: a run traverses
    only its workflow's stages) — **zero human in-play gates**. So:
    - **At run start — the same moment the D2 snapshot fires — the
      dispatcher checks whether the run's *in-play* gates contain ≥1
      human intent-locus gate.** If they do not, it **escalates the
      run-terminal (`ship`) gate to `human` for that run**, loudly — the
      escalation is surfaced in the snapshot log **and** on the gate
      prompt itself (`floor-transparency`; the same never-silent register
      as D6).
    - **Park pointer:** a genuinely zero-human run is exactly `adr-0018`'s
      parked **P1** (in-domain autonomous via standing pre-ratification).
      **The escalation rule governs until P1 lands**; when P1 lands, a
      standing-decision-authorized run may satisfy the floor that way
      instead. A pointer, not a new definition.
    - **Scope of the hole:** the three **shipped presets are
      unconditionally safe** — all have `ship = human`, so every run's
      terminal gate is human anyway. The hole opens only via the
      *supported* per-gate override (`adr-0018` K1: "the preset is a
      starting point, not a cage"), which is why the per-run check is
      needed at all.
  - *(Rejected: once-per-run — see `## Rejected options`.)*
- **D3 — backprop cascade (W4): serialize on *any* ratification edge,
  batch only human gates** *(maintainer, 2026-07-18)*. Resolves Q9. When
  one convergence cascades **upstream** — a build change forces a spec
  revision, so it touches **multiple** gated artifacts across dependency
  edges — the dispatcher sequences the gates by the dependency graph:
  - **Serialize across every dependency edge on *any* ratification —
    human or agent.** A downstream artifact re-syncs **only after the
    upstream's ratification *record* exists**, regardless of who owns that
    gate. Rationale: build-on-settled-ground (`inv-ratifiable-artifacts`)
    is **owner-agnostic** — it requires the upstream be *ratified*, not
    *human*-ratified. A `C2 = agent` spec is genuinely ratified by its
    convergence verdict (`spec-adversary` `SOUND`), and an agent gate can
    return `NEEDS-REVISION` that invalidates downstream work exactly as a
    human rejection would. So in a `build → spec` cascade the **spec gate
    clears first (human OR agent) → the build re-syncs against the
    *ratified* spec → then the build gate** — forced serial for agent
    edges too, not only human ones.
  - **Batching is a human-interruption optimization only.** Where a
    cascade touches artifacts with **no dependency edge** between them
    (an antichain) and they are **human**-gated, their ratifications
    **batch into one prompt** (minimize human interruptions). An **agent**
    ratification is not an interruption to batch — batching never applies
    to it. Net: **serialize across every dependency edge on any
    ratification; batch only the human gates within an antichain.**
  - Interacts with the dispatcher's existing **W4 backprop-interrupt**
    handling (`charters/dispatcher.md`: surface upstream, repair, one
    scoped audit at the next generation, cascade bound at generation 2).
  - *(Rejected: Option B — serialize on human gates only; and speculative
    re-sync — see `## Rejected options`.)*
- **D4 — the gate→stage mapping, ship as the run-terminal landing gate,
  and the coincidence rule** *(maintainer, 2026-07-18)*. Resolves Q3, in
  three parts:
  1. **The stage-gate mapping (confirmed):**
     - **`intent`** = the shaping-decision ratification (`shaper` →
       `decision-adversary` → gate, on the **decision**);
     - **`spec`** = spec approval (`contract-author` → `spec-adversary` →
       gate, on the **spec**);
     - **`build`** = the per-artifact conformance ratification of the code
       (`executor` → conformance + code-review → gate, on the **code**).

     These are **per-artifact stage gates**, and a run traverses only the
     stages its workflow includes — a shaping-only run has no spec/build
     gate to fire.
  2. **`ship` is NOT a stage gate — it is the single run-level gate:
     "does this run's terminal artifact land?"** It attaches to whatever
     artifact **ends the run**: the code in a full build run, the ADR
     itself in a decision-only run, the spec in a spec-only run. This
     reconciles the observed case where merging just an ADR *was*
     effectively shipping — that merge is the **ship gate firing on a
     decision-terminal run**.
  3. **The coincidence rule.** Gates are **distinct logical checkpoints**;
     **acts are channels** (`adr-0018` D2 — the merge is one way to
     *perform* the act). **One act may perform several gates'
     ratifications when they coincide, emitting a record PER GATE**
     (record-not-memory intact — one merge event yields e.g. a
     build-ratification record AND a ship record). Build+ship on a code
     change and intent+ship on a lone ADR are both instances of the same
     rule: **the terminal stage's gate and ship coincide on the terminal
     artifact's landing, because no production intervenes between them.**
     Consistent with D3's batching: coincident human gates are a batchable
     antichain — one prompt, one act, N records. The residual case where a
     human separates them in time ("correct, but hold the landing")
     remains expressible — the ship owner can simply **defer the landing
     act**.
  - **build and ship stay distinct gates on a code change** (the collapse
    question, answered). They answer different questions — *"is it
    correct/conformant?"* vs *"do we land it now?"* — and the profile sets
    each owner **independently**. `steward`'s `build=agent, ship=human` is
    exactly how the `adr-0018` implementation PR ran: agents ratified
    conformance, the human authorized the merge. The common-case single
    merge click under both-human is handled by the **coincidence rule**,
    not by collapsing the gates. *(Rejected: collapse build into ship —
    see `## Rejected options`.)*
  - **Sanity notes** *(qualified by the 2026-07-19 revision — adversary
    Break 1)*: the per-profile floor validator (`intent = human` OR
    `ship = human`) keeps a human on ≥1 in-play gate **only for runs that
    include the human-owned locus** — a floor-legal
    `intent=human, ship=agent` override plus a decision-less run has zero
    human in-play gates, which is why **D2's per-RUN floor check
    escalates `ship` to human for exactly that run** (the shipped presets
    are unconditionally safe: all `ship=human`). And under a custom
    `intent=human, ship=agent` profile on a run that *does* include
    intent, the **human approval record lands first, then an agent
    performs the merge** — approval-first, then landing.
- **D5 — channel authentication defers to grove#74, with a cited
  interim** *(maintainer, 2026-07-18)*. Resolves Q7.
  - **This decision stays purely "the dispatcher reads the profile and
    routes."** The **human-approval-record mechanism — its shape AND its
    channel-authentication rule — is specified together in grove#74** (one
    home per kind, `decision-0040`; splitting "what the record is" from
    "which channels produce it" across two decisions is the rejected
    alternative — see `## Rejected options`).
  - **Named interim (a citation, not a new definition):** until grove#74
    lands, the dispatcher at a `C2 = human` gate applies **`adr-0018` D11
    as already approved there** — only an **in-session approval or a
    merge** counts as the gate's human approval; a **bare tracker comment
    never counts**. One pointer sentence; when #74 lands it retargets,
    nothing here needs unwriting.
  - *(Rejected: Option A — operationalize the channel rule here; and
    pure-B — defer with no interim — see `## Rejected options`.)*
- **D6 — how the guardian fallback surfaces at run time** *(drafted by
  the shaper under the maintainer's explicit delegation, 2026-07-18 —
  "resolve Q6 yourself"; flagged as such, reversible at review)*. Resolves
  Q6, minimally, consistent with `adr-0018` D8 and D2 here. No new
  machinery — the CLI already emits the loud warning on stderr and exits
  `2` on any fallback (`resolve-profile.mjs`); D6 only states *when the
  dispatcher checks and where the warning goes*:
  - **Detection is D2's per-handover re-resolution.** The dispatcher
    checks the `resolve-profile` exit code **at every gate/handover**; a
    mid-run breakage (file goes missing/unreadable/floor-violating) is
    therefore caught **at the next gate**, never later than that.
  - **On exit `2`:** the run **continues under `guardian`** (`adr-0018`
    D8 — never a silent stop, never a proceed-on-broken-profile), and the
    dispatcher surfaces the CLI's warning **verbatim** in the two places
    attention already is: (a) the **run's status/log surface** — the same
    surface that carries D2's run-start profile snapshot, so
    snapshot-vs-now divergence is visible side by side; and (b) **the next
    gate prompt itself** — and since `guardian` puts a human at
    intent/spec/ship, a human sees the warning **no later than the next
    human gate** of the fallback run.
  - **The warning repeats at every subsequent handover** while the profile
    remains unusable — each per-handover re-resolution re-fires it
    (`floor-transparency`: a degraded state is re-surfaced, not
    acknowledged once and then silent). It stops when `resolve-profile`
    exits `0` again (file restored / `set-profile` re-run).

### Open
- **None.** All questions are Decided (D1–D6). Q1→D1, Q2→D2, Q9→D3,
  Q3→D4, Q7→D5, Q6→D6; former Q4/Q5 folded into D1; former Q8 discharged
  by D1. The canvas is converged.

### Parked
- **Implementation.** This is a decision; the `executor` pass (charter
  edits + any wiring) comes **after** approval. This canvas records the
  decision, not the code.
- **`adr-0018` P1 — in-domain `autonomous` (standing pre-ratification):**
  all gates agent-owned including `ship`, floor satisfied by a same-domain
  recorded standing intent. Keeps its own home (`adr-0018` Parked); #77
  enforces the **shipped** presets only.
- **`adr-0018` P2 — cross-domain external-intent (the grove#36 seal).**
  The reserved `[intent_external]` slot; parked to grove#36. Not enforced
  here.

## Given (inherited from adr-0018 — cited, not reopened)

Carried from `adr-0018` (`approved`, 2026-07-18) and the trellis floor.
If the maintainer's inclination contradicts one of these, the shaper flags
it once with the citation, then defers.

- **The machinery exists and is validated *when set*.** `gates.toml` (four
  explicit C2 rows, D7), the floor validator (`intent = human` OR
  `ship = human`, F1), the `guardian` fallback + loud warning (D8), and
  `resolveProfile` + the `resolve-profile` CLI are **built and tested**
  (`plugins/grove/gates/`). What is missing is a **run-sequencing
  consumer** — this decision supplies the wiring intent, not new
  machinery.
- **The floor** (`floor-intent-gate`): ≥1 human-owned intent-locus gate
  (`intent` front **or** `ship`). Non-configurable to off. The dispatcher's
  enforcement must never let a run proceed past a human-owned intent-locus
  gate without a human act.
- **The three shipped presets** (D3): `guardian`
  `{human, human, agent, human}`, `steward` (default)
  `{human, agent, agent, human}`, `initiator` `{agent, agent, agent, human}`.
  #77 enforces exactly these; the parked P1/P2 cases are out of scope.
- **`intent = agent` semantics** (D3 F1 clarification): autonomous draft +
  agent soundness-ratification + human ratification relocated to `ship`;
  a genuinely **blocking ambiguity may still escalate** to the human
  (`inv-clarify-before-commit`) — an exception, not routine Q&A.
- **`human` sets who is *required*, not who is *allowed*** (D2). A human
  may always weigh in at an agent-owned gate; the profile sets the
  *required* owner. The dispatcher must not *forbid* a human at an
  agent-owned gate — only stop *requiring* one.
- **v0 honors only self-authenticating channels** (D11): in-session
  approval and merge; a bare tracker comment is not honored. (Whether #77
  operationalizes this is Q7.)
- **The profile configures, does not replace, the emergent gate
  structure** (`adr-0012` E5): owed-review rules and the quality gates
  still run; the profile tunes *who owns* a gate, never deletes the seam.

## The crux (Q1) — who reads the profile — DECIDED (D1: Option A)

grove's stage charters currently **hardcode** gate ownership. `adr-0018`
made ownership **configurable per profile**. The core design fork was
*which component reads it*; the maintainer chose **Option A —
dispatcher-central** (see D1). Only the dispatcher (the run-sequencer)
reads `gates.toml` via `resolve-profile` and enforces pause-vs-proceed at
each gate — under D1's post-convergence correction: **the stage's
independent convergence check always runs**, and the profile decides only
whether a **human ratification is additionally required** on the converged
artifact (`C2=agent` ⇒ the convergence verdict record IS the ratification;
`C2=human` ⇒ an additional human-approval record) *(recap re-aligned
2026-07-19 — adversary Break 2a; the earlier "routes to the agent
gate-keeper (not a skip)" phrasing here predated the correction)*; stage
charters shed their ownership assertions. The chosen
rationale: the safety-critical floor logic (validation + `guardian`
fallback) lives **once** in the dispatcher's read path, so it cannot drift
across N readers. Options B and C are retired in `## Rejected options`.

## Rejected options

- **Option B — stage-distributed (each charter profile-aware).** Each
  stage charter consults `resolve-profile` for its own gate and
  self-gates. **Rejected (D1, maintainer 2026-07-18):** it puts the
  safety-critical floor + `guardian`-fallback logic in **N stage charters**
  where it can **drift**, and splits the one sequencing responsibility the
  dispatcher already holds across many roles. The `adr-0012` "gates emerge
  from agent boundaries" argument for B does not apply — that is about
  where gates *emerge*, not where they are *enforced*; enforcement stays
  central.
- **Option C — hybrid (dispatcher resolves, passes owner down).** Single
  reader, but the dispatcher hands each stage its gate's resolved owner.
  **Rejected (D1, maintainer 2026-07-18):** it still spreads the *act* of
  gating into every stage and adds a hand-off contract (what exactly the
  dispatcher passes, how a stage proves it acted on it) that A avoids by
  keeping both the read **and** the pause/proceed act in one place.
- **Once-per-run profile resolution (resolve at run start, reuse for the
  whole run).** Cheaper (one `resolve-profile` call) and gives the run a
  stable profile. **Rejected (D2, maintainer 2026-07-18):** stable but
  **stale** — a mid-run breakage or floor-violation (or a hand-edit)
  wouldn't be seen until the *next* run, and reusing a cached reading
  contradicts D1/Q4's record-not-memory + re-invoke determinism rule.
  Superseded by per-handover resolution (D2).
- **Backprop cascade — serialize on human gates only (Q9 Option B).**
  Impose the serial-across-edge wait only where a *human* gate sits on the
  edge; let an agent-ratified upstream not force the downstream to wait.
  **Rejected (D3, maintainer 2026-07-18):** it would let a downstream
  re-sync against an agent-ratified-but-not-yet-cleared upstream, allowing
  exactly the build-against-unratified-then-`NEEDS-REVISION` waste
  build-on-settled-ground prevents. Build-on-settled-ground is
  owner-agnostic, so the edge serializes on *any* ratification (D3).
- **Backprop cascade — speculative re-sync (Q9).** Build against the
  *proposed* (unratified) upstream and batch **all** gates at the end.
  **Rejected (D3, maintainer 2026-07-18):** it builds on **unsettled
  ground** and wastes the downstream work if the human (or the agent gate)
  revises the upstream at its gate.
- **Collapse build into ship (the merge IS the conformance ratification).**
  One gate on a code change instead of two. **Rejected (D4, maintainer
  2026-07-18):** it conflates the **conformance check** ("is it
  correct/conformant?") with the **landing decision** ("do we land it
  now?") and **deletes the configuration axis `steward` uses**
  (`build=agent, ship=human`). The common-case single merge click under
  both-human is handled by the coincidence rule (one act, N per-gate
  records), not by collapsing the gates.
- **Operationalize D11's channel rule in this decision (Q7 Option A).**
  Add a dispatcher rule here defining which channels count at a human
  gate. **Rejected (D5, maintainer 2026-07-18):** it would split one
  mechanism across two homes — D1 already delegates the
  human-approval-record *shape* to grove#74, and separating "what the
  record is" from "which channels produce it" violates one-home-per-kind
  (`decision-0040`).
- **Defer to grove#74 with NO interim (pure Q7 Option B).** Cite D11 as a
  Given and say nothing about human-gate channels until #74 lands.
  **Rejected (D5, maintainer 2026-07-18):** it would leave the dispatcher
  with **no stated rule at a human gate** until #74 — exactly the
  "someone typed 'approved' in a comment" hole `adr-0018` D11 exists to
  close. The accepted variant cites D11 as the named interim.

## Consequences / propagation (POST-approval executor work, NOT part of this canvas)

Flagged now so no dependent is silently missed (`inv-graph-maintenance`);
the actual edits are a post-approval `executor` pass. Under **D1
(dispatcher-central)** the set is firm:

> **Post-approval propagation extension (grove#82, 2026-07-19, append-only).**
> The "firm" set below proved **not exhaustive.** Three **convergence
> charters** — `charters/decision-adversary.md`, `charters/spec-adversary.md`,
> `charters/conformance-reviewer.md` — carried the same latent
> "decision-layer always to the human" hardcode that D1 removes, but sat
> outside this original set. The `conformance-reviewer` surfaced them on the
> PR #81 build; **grove#82** propagates D1's profile-owned-gate rule to them
> (and their vendored mirrors), preserving the independence /
> soundness-never-intent / never-substitute-for-the-human invariants. Recorded
> here so a reader of this "firm" list learns the blast radius grew
> (`inv-graph-maintenance`); **no Decided item (D1–D6) changed.**
>
> **Extended again (same grove#82 pass, 2026-07-19): `charters/code-reviewer.md`.**
> A fourth charter carried the same hardcode in a subtler place — its
> `PASS-WITH-ADVISORIES` verdict rode advisories to "the **human**
> merge." The floor (`intent = human` OR `ship = human`) guarantees only
> ≥1 human **intent-locus** gate — **never** that any *specific* gate,
> `ship` included, is human: a floor-legal `{intent=human, spec=agent,
> build=agent, ship=agent}` override satisfies the floor at `intent` yet
> leaves `ship` agent-owned, so a hardcoded "human merge" is wrong.
> `code-reviewer` is reconciled too (advisories ride to the `ship`
> gate, owner read from the profile per D1) with its vendored mirrors.
> Append-only; **no Decided item (D1–D6) changed.**

- **`charters/dispatcher.md`** — the **primary edit**: gains the run-time
  enforcement section — per-handover `resolve-profile` invocation + the
  run-start snapshot (D2), the post-convergence routing table (D1), the
  cascade ordering rule (D3), the gate→stage mapping + ship-as-run-terminal
  + coincidence rule (D4), the D11-interim pointer (D5), and the fallback
  surfacing rule (D6), and the per-RUN floor check + `ship` escalation
  (D2 revision). **Four hardcoded human-at-decision-layer assertions**
  (inventory expanded 2026-07-19 — adversary Break 2b) are rewritten to
  *read* ownership from the profile rather than assert it:
  - **lines 63-64** — "owes the `decision-adversary` verdict **plus the
    human intent gate**" (under `initiator`, the human intent-ratification
    relocates to `ship`);
  - **line 79** — "a decision-layer indictment **always to the human**";
  - **lines 115-116** — W4: "a decision-layer problem **always goes to a
    human**" (D3 explicitly allows downstream re-sync on an
    adversary-only decision ratification);
  - **line 191** — Boundaries: "The intent gate (decisions, specs) never
    fully opens to agents" (the **floor** — `intent = human` OR
    `ship = human`, per-run per the D2 revision — is what never opens,
    not every intent-layer gate).

  The charter is `gated` and ships to consumers who vendor it — the
  enforcement, once expressed there, is what makes `adr-0018` pay off for
  adopters.
- **`charters/lifecycle.md` consistency (adversary observation,
  2026-07-19 — no lifecycle rewrite required).** `lifecycle.md`
  (`approved`, vendored) hardcodes "`gated` → `approved`: **a human**"
  (line 61) and "an agent never flips `approved` without a recorded human
  act" (lines 46-48). The interaction, stated explicitly: **under an
  agent-owned gate the artifact's ratification is the convergence verdict
  record and the artifact stays `gated`** — consumed downstream via the
  executor's recorded ratchet, which `lifecycle.md` already supports; the
  `approved` flip remains human-only. The executor pass must verify the
  dispatcher-charter text it writes stays consistent with
  `lifecycle.md`'s flip rule.
- **Stage charters shed their ownership assertions** (shift from
  *asserting* who owns their gate to deferring to the dispatcher's
  profile-read). Named lines found by grep:
  - `charters/shaper.md` line 26: "(`floor-intent-gate` — the intent gate
    never opens to agents)" and the Boundaries phrasing of approval as the
    in-PR flip/merge;
  - `charters/contract-author.md` line 21: "Gate: rubric self-check, then
    **human approval**" — hardcodes a human at the spec gate, which
    contradicts `steward`/`initiator` (`spec = agent`);
  - `charters/executor.md` — audit for equivalents (none found by grep;
    verify in the pass).
- **The vendored reference copies** under
  `plugins/grove/reference/agents/` (what `setup` installs into consumer
  repos) mirror every charter edit above — e.g.
  `reference/agents/shaper.md` line 10: "(the intent gate NEVER opens to
  agents)"; `reference/agents/dispatcher.md`. The reference payload must
  not diverge from `charters/`.
- **`adr-0018`'s D2 "merge is the approval" wording flag is discharged**
  by these edits (D1 / former Q8) — the source of the merge-only phrasing
  is removed, not patched around. The executor pass adds the forward
  pointer on `adr-0018`'s propagation-flag text (append-only).
- **`grove#74` retarget seam (D5):** the dispatcher charter's human-gate
  channel rule is written as a **pointer** — interim: `adr-0018` D11
  (in-session approval or merge only); when grove#74 lands it retargets
  with no unwriting here.
- **Run-sequencing entry points:** whatever launches/sequences a run must
  invoke `node .grove/internal/gates/bin/resolve-profile.mjs` per
  handover — the setup skill already documents exactly this path
  (`skills/setup/SKILL.md` lines 68-70) as the intended read; this pass
  makes the dispatcher charter actually mandate it.
- **Append-only discipline.** Where the pass touches ratified text of
  `adr-0018` or a `gated` charter, it follows `decisions/README.md`
  (forward pointer on the superseded text, same change) — never an
  in-place rewrite of ratified rationale.

## Design constraints (honor while shaping — not open questions)

- **Enforce the floor, never weaken it.** Whatever reads the profile
  validates the floor on every read (D8's load-time guard A is already
  built); the dispatcher must treat a fallback (`resolve-profile` exit
  `2`) as "run under `guardian`, loudly," never as "proceed."
- **Determinism over memory.** A dispatcher that *remembers* the profile
  said "proceed" must not skip a human gate — mirror the existing "a
  review the dispatcher remembers ran does not count" boundary
  (`charters/dispatcher.md`). State is derived from artifacts/records, not
  session recall.
- **Do not re-open `adr-0018`'s Decided set.** #77 activates the shipped
  presets at run time; it does not re-litigate which presets ship, the
  floor shape, or the `intent=agent` semantics — those are Given above.

## Acceptance criteria (for the post-approval executor pass)

The decision is the Decided list (D1–D6); these are the checkable outcomes
the executor pass must satisfy **after** approval. The canvas itself edits
no charter.

- [ ] `charters/dispatcher.md` mandates: per-handover
      `resolve-profile` invocation, run-start profile snapshot logged
      (D2); the post-convergence ordering (producer → convergence always →
      gate on the converged artifact; `C2=agent` ⇒ the convergence verdict
      record IS the gate record, `C2=human` ⇒ an additional
      post-convergence human-approval record) (D1); exit-`2` handling =
      continue under `guardian` + surface the warning verbatim on the run
      status surface and the next gate prompt, repeating per handover
      until restored (D6).
- [ ] The charter carries the gate→stage mapping (D4): `intent`/`spec`/
      `build` per-artifact stage gates; `ship` the run-level landing gate
      on the run's terminal artifact; the coincidence rule (one act, a
      record PER gate); build and ship distinct on a code change.
- [ ] Cascade rule present (D3): a downstream re-syncs only after the
      upstream's ratification record exists (any owner); human gates in an
      antichain batch into one prompt; consistent with the W4
      backprop-interrupt handling and its generation-2 bound.
- [ ] Human-gate channel rule is a **pointer**: interim = `adr-0018` D11
      (in-session approval or merge only; bare tracker comment never);
      retargets to grove#74 when it lands (D5).
- [ ] The per-RUN floor check (D2 revision) is mandated: at run start,
      alongside the snapshot, the dispatcher verifies the run's in-play
      gates hold ≥1 human intent-locus gate and otherwise escalates the
      run-terminal `ship` gate to human for that run, loudly (snapshot log
      + gate prompt), with the until-P1 park pointer carried.
- [ ] **No hardcoded gate-ownership assertion remains in the dispatcher
      charter** — the executor re-greps AND re-reads for *semantic*
      assertions, not just the grep pattern (broadened 2026-07-19,
      adversary Break 2b). The enumerated inventory is the floor of the
      check, not its ceiling: dispatcher lines 63-64, 79, 115-116, 191;
      shaper line 26; contract-author line 21; reference shaper line 10;
      executor audited — all shed in `charters/` AND the vendored
      `plugins/grove/reference/agents/` copies. No gate advances on
      dispatcher memory — only on a posted record.
- [ ] `adr-0018`'s D2 wording flag is discharged with an append-only
      forward pointer; no ratified text rewritten in place.
- [ ] The dispatcher-charter text stays consistent with
      `charters/lifecycle.md`'s flip rule: under an agent-owned gate the
      artifact stays `gated` (ratified by the convergence verdict record);
      the `approved` flip remains human-only.

## Self-check (gate → `gated`)

Self-checked to **`gated`** by the shaper, 2026-07-18, and **re-checked
after the 2026-07-19 revision** (scoped to the revision banner's delta),
modeled on `adr-0018`'s self-check (no standalone rubric exists). Not an
approval — the `decision-adversary` **re-review** and the human intent
gate follow; the maintainer's recorded approval/merge is the ratification
act (`floor-intent-gate`); the shaper does **not** promote past `gated`.

- **Break 1 closed (the load-bearing fix)**: the zero-human-run hole is
  plugged — the floor check is now **per-RUN** (D2 revision): a
  floor-legal `ship=agent` override on a decision-less run triggers a
  loud run-scoped escalation of `ship` to human, governed until
  `adr-0018` P1 lands; the shipped presets were and remain
  unconditionally safe (`ship=human`). The formerly-overclaiming
  sanity-note and self-check sentences are qualified, not deleted. PASS.
- **Break 2 closed**: the Q1-crux recap now states the post-convergence
  model (no surviving "routes to the gate-keeper (not a skip)" text);
  the propagation list names all four dispatcher assertion lines and the
  acceptance criterion binds "no remaining hardcoded assertion," not the
  inventory alone; the `lifecycle.md` consistency note is recorded. PASS.

- **Frontmatter**: `id`/`type`/`status`/`depends_on`/`informed_by`/
  `owner`/`updated` present, well-typed; `status: gated`. PASS.
- **`depends_on` resolution / directional flow**: the single dependency
  `adr-0018-gate-profile-and-trigger-split` resolves and is **`approved`**
  — settled ground; this decision's correctness genuinely rests on its
  machinery (presets, floor, D8 fallback, D11). PASS.
- **`informed_by`** (provenance, not correctness-bearing): `adr-0012` (the
  emergent gate structure the profile configures), `adr-0005`
  (artifact-gated dispatch — never dispatch on conversation alone).
  Correctly `informed_by`, not `depends_on` (`adr-0011` edge discipline).
  PASS.
- **Decision recorded + why-nots kept**: the operative decision is D1–D6;
  every rejected alternative (stage-distributed, hybrid, once-per-run,
  human-only cascade serialization, speculative re-sync, build/ship
  collapse, in-decision channel rule, no-interim deferral) is in
  `## Rejected options` with its one-line reason. PASS.
- **Floor honored (the load-bearing check)**: enforcement never weakens
  the floor — the floor is validated on **every** per-handover read (D2 +
  `adr-0018` D8) **and per-RUN at run start** (D2 revision: a run whose
  in-play gates hold no human intent-locus gate escalates `ship` to human
  for that run, loudly); an unusable profile falls back to `guardian`
  loudly (D6), never silently and never proceed-on-broken; a human gate
  advances only on a posted human-approval record through a
  self-authenticating channel (D1 + D5 interim = `adr-0018` D11);
  convergence always runs (`inv-independent-verification`), so `C2=agent`
  ratification is always an *independent* agent's verdict, adversary ≠
  producer. PASS.
- **Consistency with upstream**: D4's ship-as-run-terminal keeps the F1
  floor sound for every run **when combined with the D2 per-run check**
  (every run has a terminal artifact, and if no in-play gate is
  human-owned, the run-terminal gate is escalated to human — the
  unqualified "shortest run" claim was Break 1, now fixed); the
  coincidence rule preserves record-per-gate (record-not-memory); D3 is
  owner-agnostic exactly where `inv-ratifiable-artifacts` is. PASS.
- **Scope guard**: implementation parked; `adr-0018` P1/P2 stay in their
  homes; the human-approval-record mechanism routed to grove#74 (D5), not
  absorbed. No new idea landed silently in a Decided. PASS.
- **Append-only**: new artifact; supersedes nothing in place; the
  `adr-0018` wording-flag discharge and any charter-text sheds are flagged
  as append-only executor work. PASS.
- **Minimal-first**: no new machinery — the decision wires the *existing*
  CLI into the *existing* dispatcher charter; D6 adds surfacing rules
  only, no new tool; the channel-authentication mechanism deferred to its
  own home rather than grown here. PASS.
- **Residual caveats (flagged, not blockers)**:
  1. **D6 was drafted by the shaper under the maintainer's explicit
     delegation** ("resolve Q6 yourself"), not decided interactively —
     flagged in D6 and the banner; reversible at review.
  2. The stage-charter assertion inventory (dispatcher 63-64, 79,
     115-116, 191; shaper 26; contract-author 21; reference shaper 10) is
     a **grep/read-day snapshot**; the matching acceptance criterion
     therefore binds "no remaining hardcoded assertion" — the executor
     re-greps AND re-reads for semantic assertions before editing
     (`executor.md` showed no hit but is named for audit).
  3. grove#74 does not exist yet as a landed decision — D5's interim
     (adr-0018 D11) carries until it does; if #74 never lands, the
     interim simply persists (safe: it is the stricter rule).
  4. The D2 run-start snapshot's concrete form (log line vs ledger entry)
     is executor-level detail — the decision fixes *that* it is logged
     and visible, not its format.
  5. The per-run `ship`-to-human escalation (D2 revision) is an
     **until-P1 rule** by construction — when `adr-0018` P1 lands, a
     standing-decision-authorized run may satisfy the floor instead; the
     pointer is in the D2 revision text so P1's landing retargets it
     without unwriting.

**Overall: internally sound, consumable, and `gated`** — **6 Decided / 0
Open / 3 Parked** (implementation; adr-0018 P1; adr-0018 P2); no new
D-number added by the 2026-07-19 revision (it corrects D2/D4's coverage,
not the set of decisions). Routes to the `decision-adversary` (scoped
re-review, per the revision banner), then the **human intent gate**; the
shaper does **not** promote past `gated`.
