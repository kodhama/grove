---
id: adr-0021-gate-profile-self-adoption
type: adr
status: gated  # shaper self-check 2026-07-19; routes to decision-adversary, then the intent gate per the resolved profile (human, in-session — the de-facto steward this decision makes declared)
depends_on: [adr-0018-gate-profile-and-trigger-split, adr-0020-dispatcher-honors-gate-profile]
informed_by: [adr-0017-dispatcher-posts-records-self-adoption, adr-0012-methodology-delivery-machinery]
owner: agent
updated: 2026-07-19
---

# ADR-0021: grove-to-grove — grove-self runs its own gate-profile

> **`gated` — converged, awaiting review.** grove ships a gate-profile
> mechanism (`adr-0018`) and a dispatcher that enforces it at run time
> (`adr-0020`) — but **grove-self does not run it**: the repo carries no
> `.grove/gates.toml` (verified: `git ls-files | grep ^.grove/` is
> empty), so the dispatcher's per-handover resolve step
> (`node .grove/internal/gates/bin/resolve-profile.mjs`,
> `charters/dispatcher.md`) never resolves here and **every grove-self
> run lands in the D8 `guardian` fallback silently** — a path built for
> *broken* installs, exercised *by design* at home. The mechanism grove
> ships has never cold-started its own happy path
> (`inv-self-improvement`: be your own first consumer). This decision
> closes the gap. All questions are Decided (**D1–D4**); the shaper
> self-checked this to `gated` and does not promote further — it routes
> to the `decision-adversary`, then the intent gate per the profile.
>
> The shape in one breath: **D1** split home — grove-self carries a
> **real `.grove/gates.toml`** (config is grove-self's own
> consumer-authoritative data, a copy of nothing) while the **machinery
> resolves from the native payload** `plugins/grove/gates/` (the
> collapsed case, `adr-0017`'s `check_runtime_dir` precedent); **D2** the
> machinery location is an **explicit `runtime_dir` key** in
> `gates.toml` — absent ⇒ the installed default
> `.grove/internal/gates/`; grove-self declares
> `plugins/grove/gates/` — so the D8 fallback stays **loud** for
> genuinely broken installs instead of being masked by an implicit
> search path; **D3** grove-self declares **`steward`** — the de-facto
> operating profile made explicit and auditable; **D4** the
> canonical→vendored sync stays **lockstep**, with **release tags** as
> the experimentation valve — the promotion-seam alternative is
> considered and **parked with a named trigger**, the true fork
> rejected outright.

## Decision state

### Decided

- **D1 — split home: real config, native machinery** *(maintainer,
  2026-07-19)*. grove-self adopts its own gate-profile as the
  **collapsed case**, exactly the shape `adr-0017` set for the check
  package (`charters/review-policy.md` → `check_runtime_dir:
  plugins/grove/check/`):
  - **`.grove/gates.toml` is created for real in grove-self.** It is
    *config* — grove-self's own consumer-authoritative C2 data, a copy
    of nothing in the payload — so the one-home-per-kind principle
    (kodhama's decision-0040) is untouched. The consumer-authoritative
    home (`adr-0018` D9) is honored literally: grove-self's profile
    lives where every consumer's profile lives.
  - **No `.grove/internal/` in grove-self.** The machinery (the floor
    validator, `resolve-profile` CLI) is invoked from its **native
    payload path** `plugins/grove/gates/` — the same files the plugin
    ships, not installed copies of them. Installed copies inside the
    repo that authors them would be same-repo duplication with
    guaranteed drift (see `## Rejected options`, A).
  - Precedent note: this makes the collapsed case a *pattern* (twice
    used: check runtime, gates runtime), not a one-off — worth naming
    if a third instance appears, not before (`inv-minimal-first`).

- **D2 — explicit `runtime_dir` key, loud fallback preserved**
  *(maintainer, 2026-07-19)*. How the dispatcher learns where the gates
  machinery lives:
  - **`gates.toml` gains an optional top-level `runtime_dir` key.**
    Semantics: the directory holding the gates machinery
    (`<runtime_dir>/bin/resolve-profile.mjs`). **Absent ⇒ the installed
    default `.grove/internal/gates/`** — every existing consumer
    install keeps working with zero edits. grove-self declares
    `runtime_dir = "plugins/grove/gates/"`.
  - **Declared, never searched.** The rejected alternative — an
    implicit fallback chain ("if `.grove/internal/gates/` is missing,
    try the plugin payload root") — would *mask broken consumer
    installs*: a half-installed consumer would silently resolve against
    plugin internals instead of hitting `adr-0018` D8's loud
    `guardian` fallback. D8's semantics are a design constraint here
    (see `## Design constraints`): a missing-machinery state must stay
    **loud**. An explicit key keeps the two states distinguishable —
    "declared elsewhere on purpose" vs "missing, broken".
  - No chicken-and-egg: the dispatcher reads `gates.toml` at its fixed
    home (`.grove/gates.toml`); the key tells it where the *validator*
    lives, not where the config lives.
  - This is **consumer-visible surface** (shipped template, dispatcher
    charter, `set-profile` skill), not a grove-self-only patch — the
    propagation list carries it (`## Consequences / propagation`).

- **D3 — grove-self declares `steward`** *(maintainer, 2026-07-19)*.
  `.grove/gates.toml` is seeded `steward` (`intent = human`,
  `spec = agent`, `build = agent`, `ship = human`) — the profile
  grove-self already de-facto operates (maintainer ratifies intent
  in-session, agents own spec/build convergence, maintainer merges at
  ship; `adr-0018`/`adr-0020`/this decision itself all ran exactly
  this shape). The value is **not the choice** — it is that the
  resolution machinery finally *runs* per handover in grove-self
  (`adr-0020` D2), runs become auditable against a **declared**
  profile instead of an implied one, and the floor validator guards a
  real file. Floor-safe by construction (`intent = human` and
  `ship = human`).

- **D4 — lockstep sync stays; release tags are the experimentation
  valve; promotion-seam parked with a named trigger** *(maintainer,
  2026-07-19)*. On whether the definitions grove *runs* should be the
  definitions it *ships* (the maintainer's coupling question,
  grove#87 Q4):
  - **Grounding: the inert set already exists.** The pipeline is
    already three-tiered — **canonical** (`charters/`) → **vendored**
    (`plugins/grove/reference/`, "grove's inert namespace" per
    `charters/versioning.md`) → **installed** (each consumer's
    `.grove/`, snapshotted at install time). The question was never
    "should an inert set exist" but **what sync discipline governs
    canonical → vendored**.
  - **Decided: lockstep (the current discipline), kept.** `reference/`
    tracks `charters/` in the same PR. grove ships what it runs; drift
    between live and shipped is impossible by construction; every
    shipped definition is battle-tested by grove's own operation.
  - **The experimentation valve is release tags, not in-repo
    forking.** Consumers already receive a *snapshot* at install; if
    grove wants to trial an ops change on itself (a charter experiment,
    a different profile) without it reaching consumers, the seam is
    "consumers install from tagged releases; `main` may run ahead" —
    promotion with **zero file duplication** and zero new sync
    machinery. (No release process is *created* by this decision; the
    point is that tags are the right seam **when** that need first
    materializes.)
  - **Parked — the promotion seam (in-repo lag between `charters/` and
    `reference/`), with a named trigger:** *the first time a live ops
    change would ride into a ship it shouldn't*. If that happens,
    revisit this D and design the promotion machinery (which must
    include a mechanical sync/staleness check — a lagged sync held
    only by review discipline is the exact silent-drift class the
    grove#82 reconciliation existed to kill). Until the trigger fires,
    building it is machinery ahead of need (`inv-minimal-first`).
  - **Rejected outright — the true fork** (independently-evolving
    shipped set): two homes for the same kind of information
    (decision-0040) and, worse, shipping definitions nobody runs.

## Given (inherited — cited, not reopened)

- **`adr-0018`**: the mechanism — `gates.toml` as the
  consumer-authoritative C2 home (D9, wholesale ownership by
  `set-profile`), the floor (`intent = human` OR `ship = human`), the
  D8 loud `guardian` fallback, the `.grove/internal/` layout for
  installed machinery.
- **`adr-0020`**: the dispatcher is the **single** run-time reader and
  enforcer; per-handover re-resolution with a run-start snapshot and
  per-run floor check (D2). This decision changes **where the resolver
  is found**, never who reads it or when.
- **`adr-0017` / `charters/review-policy.md`**: the collapsed-case
  precedent — grove-self's check machinery declared at its native path
  (`check_runtime_dir: plugins/grove/check/`) rather than the consumer
  install default.
- **decision-0040 (kodhama)**: one home per kind of information.
- **`inv-self-improvement`**: grove is its own first consumer;
  **`inv-minimal-first`**: the smallest thing that works, lean toward
  removing over adding.

## Rejected options

- **A — full literal install** (`.grove/gates.toml` *and*
  `.grove/internal/gates/` as installed copies): exercises the
  byte-exact consumer path, but duplicates `plugins/grove/gates/`
  inside the repo that authors it — decision-0040 violation, stale the
  moment the payload changes, and the drift would be *in the shipped
  repo itself*. The split (D1) keeps the config real and the machinery
  single-homed.
- **C — fully native config** (profile embedded in a charter file, à
  la the `grove-review-policy` fenced block): forks the shipped format
  — grove-self would run a config shape no consumer runs, which is
  anti-dogfooding in exactly the dimension this decision exists to
  fix.
- **Q1b-(a) — implicit machinery fallback chain** ("if
  `.grove/internal/gates/` missing, try the payload root"): zero
  config, but masks broken consumer installs and dilutes `adr-0018`
  D8's loud-fallback semantics. Rejected for the explicit key (D2).
- **F — true fork of the shipped agent set**: rejected outright (see
  D4).
- **P — promotion seam, now**: not rejected — **parked** with a named
  trigger (see D4). Recorded here so the option's pros (a real release
  gate for the product; self-experimentation decoupled from shipping)
  are not lost with the parking.

## Consequences / propagation (POST-approval executor work)

This set is **firm** — the executor pass implements it; new discoveries
append here, never silently expand scope:

1. **Create `.grove/gates.toml` in grove-self** — seeded `steward`
   (`seeded_from = "steward"`, the four C2 rows per the preset),
   `runtime_dir = "plugins/grove/gates/"`, the `[trigger]` and
   `[intent_external]` sections from the vendored template. Validated
   by the floor validator (exit 0) before commit.
2. **`plugins/grove/reference/gates/gates.toml` (shipped template)**
   — document the optional `runtime_dir` key (commented, with the
   absent-⇒-`.grove/internal/gates/` default stated), so consumers
   discover it where the profile lives.
3. **`plugins/grove/gates/` parser** — confirm `parseGatesToml`
   tolerates (and the resolver surfaces) the optional top-level
   `runtime_dir` key without tripping validation; add coverage. The
   floor validator's `[gates]`-row strictness is untouched
   (`runtime_dir` is top-level, not a gate row).
4. **`charters/dispatcher.md`** — the per-handover resolve step
   (`### Read the profile at every handover`) reads `runtime_dir` from
   `.grove/gates.toml` (absent ⇒ `.grove/internal/gates/`) and invokes
   `<runtime_dir>/bin/resolve-profile.mjs`; the loud-fallback wording
   gains the declared-vs-missing distinction from D2.
5. **`plugins/grove/skills/set-profile/SKILL.md`** — step 1's
   precondition and step 5's hardcoded validator path honor
   `runtime_dir` (a wholesale preset switch must **preserve** the key,
   like `[trigger]`/`[intent_external]`).
6. **`plugins/grove/skills/setup/SKILL.md`** — confirm setup's install
   flow needs no change (it installs the default layout; `runtime_dir`
   is opt-in) — a verification item, expected no-op.
7. **grove#87** closes with this decision's landing; the D4 parked
   promotion-seam gets a tracking note on the issue (trigger named)
   rather than a new open issue — it reopens only if the trigger
   fires.

## Design constraints (honored while shaping — not open questions)

- **The floor invariant holds regardless**: grove-self's profile keeps
  ≥1 human intent-locus gate. `steward` satisfies it at both loci.
- **`adr-0018` D8 fallback semantics are preserved, not redefined**:
  grove-self exercising the happy path must not make
  missing-machinery states quieter for consumers. D2's explicit key is
  the mechanism (declared ≠ missing).
- **`adr-0020` D1 single-reader is preserved**: the dispatcher remains
  the only run-time reader/enforcer; this decision relocates the
  binary it invokes, nothing else.
- **`inv-minimal-first`**: no release process, no promotion machinery,
  no sync checker is built by this decision — each is either parked
  with a trigger (promotion seam) or named as the future seam (tags).

## Acceptance criteria (for the post-approval executor pass)

- **AC1**: `.grove/gates.toml` exists in grove-self;
  `node plugins/grove/gates/bin/resolve-profile.mjs .grove/gates.toml`
  exits **0** and resolves `steward`'s four rows — the D8 fallback no
  longer fires on grove-self's happy path.
- **AC2**: a consumer-shaped `gates.toml` **without** `runtime_dir`
  resolves exactly as before (default `.grove/internal/gates/`
  assumed by the dispatcher; parser/CLI behavior byte-identical on
  existing fixtures) — zero migration for existing installs.
- **AC3**: a `gates.toml` with `runtime_dir` present passes the floor
  validator with the key surfaced, and the `[gates]` extra-row
  strictness still rejects unknown *gate* rows (regression-guarded).
- **AC4**: `charters/dispatcher.md` states the `runtime_dir`
  resolution rule (absent ⇒ default) and the declared-vs-missing
  loudness distinction; no other charter re-acquires a hardcoded
  machinery path.
- **AC5**: `set-profile` preserves `runtime_dir` across a wholesale
  preset switch (stated in the skill; the switch never silently drops
  the key).
- **AC6**: both suites + typechecks green; the review-bookkeeping
  check passes on the PR.

## Self-check (gate → `gated`)

- **Internal coherence**: D1's "no `.grove/internal/` in grove-self"
  and D2's "absent ⇒ `.grove/internal/gates/` default" compose:
  grove-self *declares* the key, so the default path is never assumed
  here; consumers omit it and get the installed default. No decision
  contradicts another.
- **Contradiction sweep vs standing decisions**: `adr-0018` D9
  (wholesale `set-profile` ownership of `gates.toml`) is honored via
  propagation item 5 (the key survives a switch, like
  `[trigger]`). `adr-0020` D1/D2 (single reader, per-handover) are
  untouched by construction (design constraint). `adr-0017`'s
  collapsed-case shape is followed, not forked. decision-0040 sweep:
  the only new file (`.grove/gates.toml`) is config, not a copy.
- **Build-on-settled-ground**: both `depends_on` targets are
  `approved` and merged (`adr-0018` @ fc8d715, `adr-0020` @ e7882e7's
  history); the review-policy precedent is an approved charter.
- **The floor**: unaffected in mechanism, satisfied in instance
  (steward).
- Self-checked to `gated` by the shaper (author), 2026-07-19. **Not
  promoted further by the author** — routed to the
  `decision-adversary`, then the intent gate per the (about-to-be
  declared) profile: human, in-session.
