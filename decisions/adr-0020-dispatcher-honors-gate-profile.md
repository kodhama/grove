---
id: adr-0020-dispatcher-honors-gate-profile
type: adr
status: draft
depends_on: [adr-0018-gate-profile-and-trigger-split]
informed_by: [adr-0012-methodology-delivery-machinery, adr-0005-tdd-and-artifact-gated-dispatch]
owner: agent
updated: 2026-07-18
---

# ADR-0020: the run-sequencer honors the gate-profile at run time

> **`draft` — shaping in progress.** This canvas activates `adr-0018` at
> run time: `adr-0018` built the gate-profile machinery (`gates.toml`, the
> floor validator, the `guardian` fallback, `resolveProfile` + the
> `resolve-profile` CLI) but **nothing reads it when sequencing a run** — a
> repo-wide grep finds no consumer of `resolve-profile` outside `gates/`,
> `setup`, and `set-profile`. So the gate-profile is today **configuration
> without enforcement**: a consumer can pick `initiator`, but the swarm
> still runs as if gate ownership were hardcoded, because the dispatcher
> never consults the profile. This decision frames **how the run stops
> assuming hardcoded ownership and starts reading it**. Read
> `## Decision state` first — it is the live state of the decision in one
> place.
>
> **The crux (Q1) is Decided — D1: dispatcher-central**, refined so the
> gate fires **post-convergence** (the independent check always runs; the
> profile only decides whether a human ratification is *additionally*
> required), and refined by **D2** (the dispatcher re-resolves the profile
> per-handover, snapshotted at run start). The remaining Open items are the
> *how* (gate→stage mapping, guardian-fallback surfacing, D11 channels, and
> backprop-cascade gate ordering). Every other entry is either an inherited
> **Given** (from `adr-0018`, cited, not reopened) or an **Open** question.

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
  - *(Rejected: once-per-run — see `## Rejected options`.)*

### Open
- **Q3 — gate→stage mapping.** grove's four gates
  (`intent`/`spec`/`build`/`ship`) map to which concrete dispatch decision
  points? The working reading: **intent** = the shaping-decision
  ratification (`shaper` → human intent gate on the decision); **spec** =
  spec approval (`contract-author` → spec gate); **build** = conformance
  (`executor` → conformance gate); **ship** = PR merge. Confirm/correct
  the mapping and name which stage consults which gate's owner.
- **Q6 — guardian fallback at run time.** When/how does the dispatcher
  detect a **missing/unreadable/floor-violating** profile mid-sequencing
  and surface the loud D8 warning + run under `guardian`? The CLI already
  emits the warning to stderr and exits `2` on any fallback
  (`resolve-profile.mjs`) — the open part is *when the dispatcher checks
  the exit code* and *how the warning reaches the maintainer* in the
  interactive session.
- **Q7 — D11 at run time.** `adr-0018` D11 (honor only self-authenticating
  approval channels — in-session/merge, **not** a bare tracker comment)
  was left as prose. Is #77 where the dispatcher **operationalizes** D11
  at human gates (checks the channel is self-authenticating before
  counting the gate satisfied), or does that stay **separate** (candidate
  grove#74)?
- **Q9 — gate enforcement during a backprop cascade (W4).** Convergence
  can cascade **upstream**: a build change forces a spec revision, so one
  convergence touches **multiple** gated artifacts across dependency edges.
  How does the dispatcher sequence the (possibly several) human gates a
  cascade raises? **Maintainer's candidate model — sequence across edges,
  batch within independent sets:**
  - **Serial across a dependency edge is *forced*, not just cautious.** A
    dependent artifact must NOT re-sync against an **unratified** upstream
    (`inv-ratifiable-artifacts` / build-on-settled-ground). So in a
    build→spec cascade: the **spec gate clears first → the build re-syncs
    against the *ratified* spec → then the build gate.**
  - **Batch within an antichain.** Where a cascade touches artifacts with
    **no dependency edge** between them and both are human-gated, their
    ratifications **batch into one prompt** (minimize human interruptions).
  - **Net:** topologically order the human gates by the dependency graph —
    **sequential across edges, batched within antichains.** Interacts with
    the dispatcher's existing **W4 backprop-interrupt** handling
    (`charters/dispatcher.md`: surface upstream, repair, one scoped audit,
    cascade bound at generation 2).
  - **Rejected alternative — speculative re-sync:** build against the
    *proposed* (unratified) spec and batch **all** gates at the end.
    Rejected — it builds on **unsettled ground** and wastes the downstream
    work if the human revises the upstream at its gate. *(Candidate, not
    yet Decided — awaiting maintainer confirmation.)*

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
each gate; a `C2=agent` gate routes to that gate's agent gate-keeper (not
a skip); stage charters shed their ownership assertions. The chosen
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

## Consequences / propagation (draft — POST-approval executor work, NOT part of this canvas)

Flagged now so no dependent is silently missed (`inv-graph-maintenance`);
the actual edits are a post-approval `executor` pass. Under **D1
(dispatcher-central)** the set is now firm:

- **`charters/dispatcher.md`** — the **primary edit**: gains the run-time
  profile-read (`resolve-profile`) + per-gate pause/proceed sequencing (the
  D1 routing table), and its Boundaries line "the intent gate (decisions,
  specs) never fully opens to agents" is rewritten to *read* ownership from
  the profile rather than assert it. It is `gated` and ships to consumers
  who vendor it — so the enforcement, once expressed there, is what makes
  `adr-0018` pay off for adopters.
- **Stage charters shed their ownership assertions** — `charters/shaper.md`
  ("the merge is the approval; the intent gate never opens to agents"), and
  any equivalent assertion in `contract-author`/`executor`. They shift from
  *asserting* ownership to deferring to the dispatcher's profile-read. **This
  discharges `adr-0018`'s D2 "merge is the approval" wording flag** (D1 /
  former Q8) — the source of the merge-only phrasing is removed, not
  patched around.
- **Any run-sequencing skill/entry** that should now call
  `resolve-profile` (the setup skill already documents the intended path
  `node .grove/internal/gates/bin/resolve-profile.mjs`, lines 68-70 — but
  nothing at run time calls it).
- **Append-only discipline.** Where the executor pass touches ratified
  text of `adr-0018` or a `gated` charter (e.g. the D2 wording discharge),
  it follows `decisions/README.md` (forward pointer on the superseded
  text, same change) — not an in-place rewrite of ratified rationale.

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
