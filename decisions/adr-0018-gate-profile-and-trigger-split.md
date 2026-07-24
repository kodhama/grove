---
id: adr-0018-gate-profile-and-trigger-split
type: adr
status: approved  # maintainer's intent act (in-session approval), 2026-07-18 — recorded flip per lifecycle.md; decision-adversary SOUND on scoped re-review (c3cbcc8); author (shaper) ≠ approver (maintainer)
depends_on: [adr-0012-methodology-delivery-machinery, trellis/signature-catalog-v1]
informed_by: [adr-0005-tdd-and-artifact-gated-dispatch, adr-0006-operational-conformance-mechanism, adr-0014-install-is-invisible-and-ungated]
owner: agent
updated: 2026-07-18
---

# ADR-0018: the gate-profile mechanism + the trigger-vs-intent-gate split (in-domain)

> **D5's consumer-installed runtime location is partially superseded by
> `adr-0035-plugin-and-consumer-boundary`.** Placement by authority still
> governs consumer-owned files, but Grove runtime now stays in the plugin and
> standard installs no longer create `.grove/internal/`.
>
> **D5's layout table amended by `adr-0026-thin-vendor-boundary`
> (2026-07-21; append-only pointer, adr-0026 Propagation 3).** D5 placed
> the grove-authoritative subtree — the companions
> (`lifecycle.md`/`versioning.md`/`relations.md`), the `check/` tool, and
> `enforcement.toml` — under `.grove/internal/`. Under adr-0026 the **fleet
> and its companions are plugin-carried** (D1/D7), so the companions
> **leave `.grove/internal/` for the plugin payload** and that subtree
> shrinks; a consumer keeps only what it owns. adr-0026 D5 **reaffirms D5's
> own-roles rule** — a role a repo genuinely owns stays repo-level in
> `.claude/agents/`, collision-free by namespacing (`corpus-reviewer` vs
> `grove:corpus-reviewer`). (The `check/` runtime and `enforcement.toml`
> were since retired-for-now by `adr-0027`, emptying the subtree further.)
> The gate-profile decisions D1–D11 and the authority-split principle
> stand. Ratified text below unedited (append-only).

> **`gated` — converged, awaiting review.** All in-domain questions are
> Decided; the one substantive Open (approval-channel authenticity) is
> resolved by **D11**. The shaper self-checked this to `gated` (see
> `## Self-check`) and does **not** promote further — it routes to the
> `decision-adversary` and then the **human intent gate**; the maintainer's
> **merge is the ratification act** (`floor-intent-gate`), never the
> shaper's flip. Read `## Decision state` first — it is the live state of
> the decision in one place.
>
> Spun out of grove#36's parked dependents (K1/K2). The preset that
> genuinely needs the cross-domain interop "seal" (**P2** —
> cross-domain external-intent) stays parked on grove#36; the related
> in-domain autonomous case (**P1**) is parked separately — see
> `## Parked`.

> **Revision 2026-07-18 (scoped — for adversary re-review).** Folds the
> `decision-adversary` **NEEDS-REVISION** (one load-bearing break + two
> approved clarifications). **Scoped delta — only these touched:**
> **(F1)** `initiator`'s encoding was a **C1 category error** that
> collapsed it into `steward` under the C2-only profile (D4); relocated
> its distinctness to **C2 at the front `intent` gate** —
> `initiator = {intent=agent, spec=agent, build=agent, ship=human}` — and
> **restated the floor validator** as *≥1 human intent-locus gate
> (`intent = human` OR `ship = human`)*. **(F1 clarification)** spelled
> out what an agent-owned intent gate entails operationally
> (autonomous-draft + agent-ratify-on-soundness + human ratification
> relocated to `ship`; blocking-ambiguity escape hatch). **(Parked
> split)** separated **P1** in-domain-autonomous (same-domain standing
> intent; no seal) from **P2** cross-domain (grove#36's seal). Plus two
> adversary observations folded as record: the D10 pass must preserve
> `adr-0013` AC4's carrier fail-close; `.grove/` bundling confirmed
> as-is. Touched: D3, D4, the K1 preset table + bullets + floor-validator
> restatement, K2, the Parked split, the propagation list, this
> self-check. **No new Decided item; no D-number added** — F1 corrects the
> *encoding* of D3, not the set of decisions.

## Decision state

### Decided
- **D1 — `steward` is the shipped default preset** *(maintainer,
  2026-07-18)*. A fresh install gets `steward` (human owns **intent** +
  **ship**; agents own **spec** + **build**). Rationale: (a) `steward`
  already keeps **two** human gates, so the default is conservative on
  its own — the "force an explicit pick for safety" alternative buys
  little; (b) forcing an explicit profile choice at install would make
  grove **gate its own arrival**, contradicting `adr-0014` (install is
  invisible and ungated). `guardian` and `initiator` remain **opt-in**
  presets on top. *(Resolves former Open item 1.)*
- **D2 — a human-owned gate (C2 = `human`) is channel-agnostic**
  *(maintainer, 2026-07-18: "I'm not restricting to a specific
  channel")*. The floor requires the intent gate be human-**owned**; it
  does **not** dictate *by what act* the human satisfies it. Any
  authentic channel counts equally — an **explicit in-session
  approval**, a **direct merge**, **or** a **tracker/GitHub comment**.
  grove must **not** hardcode "the merge is the approval"; the merge is
  **one channel among several**.
  - **In-session approval is first-class, not a fallback.** A human may
    always weigh in at a gate the profile assigns to an *agent* — e.g.
    the maintainer approves specs in-session today even though `steward`
    makes the spec gate agent-owned. **The profile sets who is
    *required* at a gate, not who is *allowed*.**
  - **Reconciling existing language:** where the shaper charter and
    `floor-intent-gate` say "the merge is the approval/ratification,"
    that is the **reference convention for a GitHub-based repo**, not a
    channel restriction. This decision states channel-agnosticism
    explicitly so that phrasing is not misread as merge-only. *(See the
    propagation flag in `## Consequences / propagation`.)*
- **D3 — grove ships all three presets** *(maintainer, 2026-07-18;
  initiator encoding revised by the F1 fix, 2026-07-18)*:
  **`steward`** (default, D1), **`guardian`** (opt-in), and
  **`initiator`** (opt-in). Their **C2 rows** (D4 — pure C2, no C1):
  - **guardian** `{intent=human, spec=human, build=agent, ship=human}`
  - **steward** `{intent=human, spec=agent, build=agent, ship=human}`
  - **initiator** `{intent=agent, spec=agent, build=agent, ship=human}`
    — **F1 fix:** initiator's distinctness is a **C2 difference at the
    front `intent` gate** (`agent`), *not* a C1 "expressed" difference; an
    all-C1 encoding collapsed it into steward (identical C2 rows). The
    "intent expressed at kickoff" is a **trigger** property (K2), not a
    gate.
  - Rationale for shipping it: K2 already requires the "agent-owned front
    gate, human ratifies at ship" configuration to exist, so `initiator`
    merely *names* it — nearly free; cutting it would hollow out K2.
  - **What `intent = agent` entails operationally (F1 clarification).**
    Not "skip the merge": the decision is **drafted autonomously** (no
    interactive human shaping Q&A) + **agent-ratified on soundness**
    (`decision-adversary`) + the **human intent-ratification relocated to
    `ship`**. Exception: a **blocking ambiguity may still escalate** to
    the human (`inv-clarify-before-commit`) — an exception, not routine
    Q&A. The human is out of the *middle*, not merely off the merge.
  - **`initiator` is in-domain and does NOT depend on grove#36.** Its
    sole human intent-locus is **`ship`** (`ship = human`) — a human
    intent gate *in this domain*; floor satisfied **locally**, no
    cross-domain seal. Crisply distinct from the parked case:
    - **`initiator` (shipped, in-domain):** front `intent` agent-owned;
      **`ship` ratifies intent locally**. Floor holds here.
    - **`autonomous/standing` (parked → grove#36, cross-domain):** **no
      human intent-locus in this domain at all** (`ship` also agent);
      floor satisfied by a human in *another* domain. Needs the seal.
    The distinguishing fact: `initiator` has a local human `ship` gate;
    `autonomous/standing` has **no** local human intent-locus.
- **D4 — C1 is grove-fixed; the profile is a single (C2) axis
  (Model A)** *(maintainer, 2026-07-18)*. Enforcement strength (**C1**:
  `enforced` / `default-on-but-skippable` / `expressed`) is **grove's
  design call per gate**, not a consumer-tunable dial. **The gate-profile
  configures only C2** (who owns each gate). C1 defaults live in a
  **grove-managed internal file grove does NOT surface to users** (a
  power-user can technically set them, but it is not a supported
  surface). Rationale: one axis to configure and validate
  (`inv-minimal-first`); avoids the under-gating footgun of quietly
  setting a gate advisory; and it matches how grove already keeps
  enforcement knobs **gate-locally** (`adr-0007` severity threshold,
  `adr-0013` scope mode) rather than as a global dial. Floor untouched:
  the **human intent-ratification locus** is C1 = `enforced`, C2 =
  `human` — that locus is the **front `intent` gate** for steward/guardian
  and is **relocated to `ship`** for initiator (F1). "The intent gate" =
  *the intent-locus gate*, not specifically the front `intent` row.
  *(Resolves former Open item 1.)*
- **D5 — the consumer `.grove/` layout, split by AUTHORITY**
  *(maintainer, 2026-07-18; recorded here in adr-0018 by the maintainer's
  call)*. Organizing principle: **placement by who is authoritative on a
  file's contents** — *not* machinery-vs-config. *(This supersedes an
  earlier "machinery vs user-editable" framing the maintainer flagged as
  wrong: `review-policy.md`'s strict/scoped mode is a **consumer choice**,
  so that axis mis-split it.)*
  - **`.grove/` root — consumer-authoritative** (setup writes defaults;
    grove **NEVER clobbers**): **`gates.toml`** — the gate-profile (C2 +
    per-gate overrides), **NEW**; and **`review-policy.md`** — the
    strict|scoped scope choice (`adr-0013`), stays on the user surface.
  - **`.grove/internal/` — grove-authoritative** (copied/regenerated
    verbatim on update; hand-edits overwritten): the companions
    `lifecycle.md` (`adr-0008`), `versioning.md` (`adr-0010`),
    `relations.md` (`adr-0011`); the `check/` tool; and the C1
    **`enforcement.toml`** (D4's grove-managed C1 file).
  - Subfolder name: **`internal/`**.
- **D6 — the setup UX for presets** *(maintainer, 2026-07-18)*. The
  preset choice is an **optional `/grove:setup` question with `steward`
  as default** — **NOT a forced pick** (honors `adr-0014`
  invisible/ungated install and D1). Setup shows brief one-liners:
  - **steward** — "you approve direction + final result; agents handle
    spec and build";
  - **guardian** — "you also approve the spec before build";
  - **initiator** — "you kick off intent and approve only the final
    result";

    and points to **`.grove/gates.toml`** for finer per-gate overrides.
- **D7 — `gates.toml` is shape (B): explicit full table, preset-as-seed**
  *(maintainer, 2026-07-18)*.
  - **The four gate rows are always listed explicitly** (`intent` /
    `spec` / `build` / `ship`, each C2 = `human` | `agent`). **The rows
    are the source of truth** — no runtime inheritance to resolve; the
    floor validator and every reader read rows directly.
  - **A preset is a seed-time operation, not a file abstraction.** At
    install, setup **expands** the chosen preset into the explicit rows.
    Provenance is a **non-authoritative** `seeded_from = "<preset>"`
    marker — **the rows win if they diverge** from the named preset.
  - **Presets are re-applicable post-install via a dedicated skill**
    (candidate `/grove:set-profile <preset>` — *name not load-bearing,
    flagged*). Behavior: re-expands that preset's four rows, updates
    `seeded_from`, and **re-runs the floor validator**. **Semantics: a
    wholesale switch** — it **replaces** current rows (including
    hand-edits) with the preset's; per grove's non-clobber discipline it
    **shows the effective diff and confirms before writing, never
    silent**. *(Rejected alt: "preserve hand-overrides on top of the new
    preset" — the simpler mental model won; see Options.)* The skill's
    **implementation is post-approval executor work** (like the file
    moves) — this canvas records the decision, not the skill code.
  - **The trigger row (K2) and the reserved "intent satisfied
    externally" slot are explicit sibling sections/keys** in
    `gates.toml` — **visible, not hidden defaults**. The external slot's
    whole purpose is that a future reader *sees* it is reserved (design
    constraint; grove#36). Illustrative shape in `## Framing → K1`.
- **D8 — floor-guard is a load-time reader (A), with a unified
  `guardian` fallback** *(maintainer, 2026-07-18; resolves the former
  floor-validator hand-edit Open)*.
  - **Floor-guard = A (load-time reader).** Whatever reads `gates.toml`
    to sequence a run **validates the floor on every read** — so a manual
    hand-edit that violates the floor (e.g. `intent = "agent"`) is caught
    at run time regardless of setup / `set-profile`. The **CI/pre-commit
    check (B) is parked** as a deferred nicety (`inv-minimal-first`; A is
    required anyway, and B is only earlier-and-louder — see Options →
    parked).
  - **Unified fallback rule.** When grove **cannot honor the profile on
    disk** — file **missing/unreadable** *or* **present-but-floor-violating**
    — it falls back to the **`guardian` preset** (the most conservative
    shipped preset: human at intent + spec + ship) **plus a loud
    warning** (e.g. *"gates.toml missing/invalid — running at guardian
    until restored; run /grove:set-profile to rebuild"*). One rule for
    both bad states. Rationale: a real **named floor-safe preset** is
    more legible than an ad-hoc all-human config, and it keeps the
    mechanical **build** gate agent-owned (all-human is noted as an
    available absolute-max, but **not** the default fallback — "human owns
    the build/conformance gate" is awkward and heavier). Floor stays
    **enforced** (guardian has a human intent gate) and **non-silent**
    (the warning) — `floor-intent-gate` + `floor-transparency` both hold.
- **D9 — config lives in multiple files, not one unified file** *("at
  least for now," maintainer, 2026-07-18)*.
  - **One home per kind** (`decision-0040`): each config axis is its own
    file governed by its own decision, and **each skill owns its file
    wholesale** (e.g. `set-profile` owns `gates.toml`). *(Rejected for
    now: a single unified config file — see Options; revisitable if the
    multiple-file surface becomes friction.)*
  - **Format consistency:** user-facing **config** files are uniform
    **TOML** (`gates.toml`, `review.toml`). The **companions**
    (`lifecycle.md` / `versioning.md` / `relations.md`) stay **markdown**
    — reference prose in `.grove/internal/`, a different *kind*, so the
    uniform-TOML rule applies to the **editable config surface**, not to
    them.
- **D10 — split `review-policy.md` by concern** *(maintainer,
  2026-07-18; resolves the former review-policy mixed-concern Open)*.
  - The **consumer choice** (`scope: strict|scoped`, `adr-0013`) → moves
    to **`.grove/review.toml`** on the user surface (TOML, per D9).
  - The **grove-wiring** keys (`check_runtime_dir`, `check_workflow_path`)
    → an **internal file under `.grove/internal/`** (grove-authoritative,
    D5).
  - This **splitting amends `adr-0013`'s artifact**, so `adr-0013` joins
    the propagation list as an artifact the **post-approval executor pass
    must update** — append-only per `decisions/README.md` (a forward
    pointer, not an in-place rewrite of ratified text).
- **D11 — v0 honors only self-authenticating approval channels; refines
  D2** *(maintainer, 2026-07-18; resolves the former approval-authenticity
  Open)*.
  - For v0, grove **honors only the self-authenticating intent-gate
    channels — in-session approval and merge** — both of which
    authenticate **by construction** (the human is present in the driving
    session / holds repo write access).
  - A **bare tracker/GitHub comment is NOT honored** as an intent-gate
    approval in v0 — it is forgeable (anyone who can comment can type
    "approved").
  - **This does not contradict D2's principle** ("not merge-only" still
    holds — in-session approval is honored, and it is not a merge). D11
    scopes *which* channels v0 **honors**, not the principle that the
    channel is unrestricted-in-kind.
  - **Deferred (follow-up issue, pointer only):** the stronger
    per-channel identity mechanism — honoring a tracker comment **tied to
    a verified CODEOWNER/identity** — is the **in-domain sibling of
    grove#36's O3** (cross-domain seal verification). The maintainer will
    open the issue; recorded here so it is not lost.

### Open
- **None.** All in-domain questions are Decided (D1–D11). The former
  approval-authenticity Open is resolved by **D11** (v0 honors
  self-authenticating channels only; the verified-identity extension is
  a deferred follow-up issue, pointer above). The canvas is converged for
  the in-domain case.

### Parked
The formerly-single "autonomous/standing" park bundles **two distinct
cases** (adversary observation, 2026-07-18) — split here so they don't
get conflated later. Neither is shaped or implemented now.

- **(P1) in-domain `autonomous` (standing pre-ratification).** All gates
  agent-owned **including `ship`** (auto-merge), the floor satisfied by a
  **same-domain recorded standing intent** — e.g. an auto-bug-fixer
  authorized by a recorded *"fix all reported bugs, if you can"*
  decision. This is a **future in-domain preset in this decision's own
  family**; it does **not** need grove#36's cross-domain seal. Parked,
  gated only on **"how grove verifies that a standing decision authorizes
  a given run"** (a same-domain question). *(Note: this reuses the
  intent-locus floor — the human locus is the standing decision, not a
  per-run gate.)*
- **(P2) cross-domain external-intent.** The floor satisfied by a human
  gate in *another* governance domain — the **seal** (what a gate-owner
  guarantees across a boundary). This is what the reserved
  `[intent_external]` slot fills; stays parked to **grove#36**. The
  schema leaves the slot (`## Design constraints`) so it drops in without
  a rewrite.

### Related, out of scope (seen, tracked elsewhere)
- **`status`-field vs merge-event divergence at ratification.** When a
  human merges a decision directly, the artifact's `status` may still
  read `gated` while the merge has actually ratified it — the file and
  the merge event diverge. This is about the **general
  ratification-recording mechanism**, not the gate-profile; **not folded
  into adr-0018** (maintainer, 2026-07-18). Noted so the record shows we
  saw it; tracked separately.

## Given (inherited upstream — not re-litigated here)

Carried from the maintainer/dispatcher evidence base and the trellis
invariants; cited, not reopened. If the maintainer's inclination
contradicts one of these, the shaper flags it once with the citation,
then defers.

- **Gates are implementation, not principle.** Trellis defines the
  invariants + **two dials** — **C1** (enforcement strength:
  `enforced` / `default-on-but-skippable` / `expressed`) and **C2**
  (owner/ratifier: `human` / `independent-agent` / `none`) — and
  `inv-handover-points` (a seam where a gate *can* attach). Trellis does
  **not** enumerate gates (`trellis/signature-catalog-v1`). grove
  instantiates the concrete gates — its pipeline's **intent / spec /
  build / ship** — and sets each gate's C1/C2.
- **grove's gate structure is emergent, not declared** (`adr-0012` E5):
  no one holds "the workflow"; a run's gates emerge from per-artifact
  owed-review rules + each agent's triggers, composed with the standing
  invariants. A gate-profile is a *configuration layer over that*, not a
  replacement for it.
- **A gate-profile is a named per-gate assignment of trellis's dials**
  onto grove's four gates — the physical realization of those dials onto
  grove's pipeline. In principle it could set both C1 and C2; **grove's
  realization configures only C2, with C1 grove-fixed** (D4). It mirrors
  how a trellis *profile* sets invariant expression: pick a preset, then
  tune individual (C2) rows.
- **The floor that bounds every profile:** `floor-intent-gate` — the
  intent locus's **C2 can never be `none`**; at least one human-owned
  **intent-locus** gate must exist (`trellis/signature-catalog-v1`; grove
  echoes it in `charters/dispatcher.md`, `adr-0005`, `adr-0014`). The
  eligible loci are the front `intent` gate **or** `ship` (F1) — a
  profile with **neither** human is **illegal** and must be rejected by
  the validator. This is a floor, not a dial — non-configurable to off.
- **grove already runs agentic triggers.** Remediation roles
  (`run-resumer`, `propagation-remediator`), the `validator`'s
  triggered drift audits (`adr-0006` dec 5), and inference-first
  dispatch (`charters/dispatcher.md`) already fire runs with no human at
  the ignition point — so the trigger-vs-intent-gate split (K2) names an
  existing reality, it does not invent one.

## Framing — the mechanism being converged

### K1 — gate-profile mechanism + presets

A **gate-profile** assigns **C2** (who owns each gate) to grove's four
gates — **C1 is grove-fixed, not in the profile** (**D4**). It lives at
**`.grove/gates.toml`** (consumer-authoritative, **D5**), is written by
setup with the **`steward`** default (**D1**, **D6**), and is
**hand-editable after**. The three shipped presets (**D3**):

| Preset | intent | spec | build | ship | one-line character |
|---|---|---|---|---|---|
| **guardian** | human | human | agent | human | max oversight — human at intent + spec + ship |
| **steward** *(default, D1)* | human | agent | agent | human | human at intent + ship; agents own the middle *(grove's current de-facto behavior)* |
| **initiator** | **agent** | agent | agent | human | human ratifies **only at ship**; the entire pipeline including the **front intent gate** is agent-owned |

> **Encoding note (revised — F1 fix, 2026-07-18).** The presets differ
> **purely in C2** (who owns each gate), because the profile is C2-only
> (**D4**). `initiator`'s distinctness is a **C2 difference at the front
> `intent` gate** (`agent` vs steward's `human`) — **not** a C1
> "expressed vs enforced" difference. An earlier cut located the
> steward↔initiator difference in C1 ("intent expressed at kickoff"),
> which was a **category error**: with C1 grove-fixed, both presets would
> have had identical C2 rows `{human, agent, agent, human}` and
> `initiator` would collapse into `steward`. Corrected: `initiator` =
> `{intent=agent, spec=agent, build=agent, ship=human}`. The "intent
> expressed at kickoff" idea is a property of the **trigger (K2)**, not a
> gate — anchored there, not on the `intent` row.

- **`human` sets who is *required*, not who is *allowed* (D2).** A cell
  reading `agent` means no human is *required* at that gate — a human
  may still weigh in there (in-session spec approval under `steward` is
  the live example). And a `human` cell is satisfied by **any authentic
  channel**, not by a merge specifically — but **v0 honors only the
  self-authenticating channels: in-session approval and merge** (**D11**).
  A bare tracker comment is not honored in v0 (forgeable); a
  verified-identity comment is a deferred follow-up.
- **What an `agent`-owned intent gate entails operationally (F1
  clarification, 2026-07-18).** `intent = agent` at the front is **not**
  merely "skip the human merge." It means: the decision is **drafted
  autonomously** (no interactive human shaping Q&A), **agent-ratified on
  soundness** (the `decision-adversary` pass), and the **human
  intent-ratification is relocated to `ship`**. The human is out of the
  *middle*, not merely off the merge. **One exception:** a genuinely
  **blocking ambiguity may still escalate to the human** — grove never
  silently guesses on a real fork (`inv-clarify-before-commit`) — an
  exception, not routine Q&A.
- **Per-gate override.** On top of a chosen preset, the human may flip
  any single gate's **C2** in `gates.toml` — the preset is a starting
  point, not a cage. (C1 is not exposed here — D4.)
- **The floor validator (restated — F1 fix, 2026-07-18).** It rejects
  any profile with **0 human-owned intent-locus gates**, where the
  eligible intent-locus gates are **`intent` (front) OR `ship`
  (ratify-at-end)** — concretely **`intent = human` OR `ship = human`**.
  guardian and steward pass at the **front** (`intent = human`);
  initiator passes at **ship** (`ship = human`, the relocated
  ratification locus); an **all-agent** profile (`intent`, `ship` both
  `agent`) **fails**. This replaces the too-narrow "the `intent` row must
  be human," which would wrongly reject a valid `initiator`. *(The
  reserved `[intent_external]` slot is a third way to satisfy the floor —
  parked, cross-domain; grove#36.)*

**Illustrative `gates.toml` shape (B — explicit full table, D7).** Field
names are illustrative; the executor finalizes the exact keys. The
load-bearing shape is: four explicit rows (source of truth), a
non-authoritative `seeded_from` marker, and the trigger + external-intent
sections written out visibly.

```toml
# .grove/gates.toml — consumer-authoritative gate-profile (C2 only; D4/D5/D7)
seeded_from = "steward"      # provenance only — non-authoritative; the rows below win

[gates]                      # the four rows ARE the source of truth (no inheritance)
intent = "human"             # floor: validator requires intent=human OR ship=human
spec   = "agent"             #   (>=1 human intent-locus gate; F1 fix). steward shown.
build  = "agent"             #   initiator would read intent="agent" (passes via ship).
ship   = "human"

[trigger]                    # K2 — what IGNITES a run, held SEPARATELY from who ratifies
                             # intent. Not floor-bound; may be agentic (grove already runs
                             # agentic triggers). Names the ignition source(s).
sources = ["human-ask", "cron", "ci-event", "backprop-interrupt"]

[intent_external]            # reserved slot (design constraint; grove#36) — EMPTY in-domain
enabled = false              # in-domain profiles leave this off; the parked P2 cross-domain
# satisfied_by = "..."       # case fills it once the cross-domain SEAL exists
```

- **Trigger row (closes Open — K2 representation).** The trigger is its
  own `[trigger]` section, **not** an owner-typed gate row: it records
  *what ignites a run*, a different question from *who ratifies intent*.
  It is **not floor-bound** (the floor pins the intent *locus*, never the
  trigger) and its sources may be agentic — matching grove's existing
  agentic triggers (remediation roles, validator drift audits,
  inference-first dispatch). An agentic first *gate* stays legal (K2)
  because intent is ratified at ship (initiator) or by a standing
  in-domain decision — the trigger row does not change that. **The
  "intent expressed at kickoff" idea lives here** (a trigger property),
  **not** on the `intent` gate row (F1 fix).
- **External-intent slot (design constraint held).** Written out
  explicitly as `[intent_external]`, `enabled = false` in every in-domain
  profile — visible-but-reserved, so a future reader sees the seam. The
  parked **P2** cross-domain case (grove#36) is the only thing that flips
  it on; nothing in this canvas fills it. *(The in-domain **P1**
  autonomous case satisfies the floor via a same-domain standing
  decision, not this slot.)*
- **Floor validator + load-time floor-guard (D7 + D8).** Reads the four
  `[gates]` rows **directly** and rejects any profile with **0
  human-owned intent-locus gates** (`intent = human` OR `ship = human`;
  F1 fix); fires at **setup**, on **every `set-profile`**, and — per
  **D8** — **on every read that sequences a run** (the load-time guard
  **A**), so a manual hand-edit that violates the floor is caught at run
  time too. When the profile **cannot be honored** (missing / unreadable
  / floor-violating), grove falls back to the **`guardian`** preset with
  a **loud warning** (D8) — floor stays enforced and non-silent. The
  CI/pre-commit variant (**B**) is parked (Options).

> **guardian vs steward vs initiator — the load-bearing difference
> (revised, F1 fix).** All three are pure **C2** rows (D4). **steward**
> `{human, agent, agent, human}` and **initiator** `{agent, agent, agent,
> human}` differ at the **front `intent` gate**: steward keeps a
> human-owned intent gate **up front**; initiator makes the front
> **agent-owned** and relocates the sole human intent-locus to **`ship`**
> (ratify-at-end). **guardian** `{human, human, agent, human}` adds a
> third human gate at `spec`. Fewer human gates = more agent autonomy =
> the human catches a wrong *direction* later (at ship, for initiator)
> rather than at kickoff.

### K2 — the trigger-vs-intent-gate split

- **The trigger** (what *ignites* a run — a human ask, a cron, a CI
  event, a backprop interrupt; and *"intent expressed at kickoff"* is a
  trigger property, F1) is a **separate row** from the **intent-locus
  gate** (who *ratifies direction*). They are different questions and
  must not be conflated.
- The floor pins **an intent-locus gate** (front `intent` **or** `ship`)
  to human; it says **nothing about the trigger**, and it does **not**
  require the human intent-locus to be *first* (initiator ratifies at
  ship).
- An **agentic first gate is legal** when intent is ratified at ship
  (initiator), or pre-ratified by a **standing decision within this same
  domain** (a locked decision the agent runs under — `charters/dispatcher.md`'s
  "locked decisions as the autonomy precondition"). The *across-domains*
  version of "intent satisfied elsewhere" is the parked case (grove#36).

## Design constraints (honor while shaping — not open questions)

- **Leave the external-intent slot in the schema** (`inv-graph-maintenance`
  — don't build something the parked decision forces a rewrite of). The
  gate-profile schema must carry an explicit, initially-empty slot for
  **"intent satisfied externally"** — a per-profile marker naming that a
  local intent gate's floor obligation is discharged by a human intent
  gate in another domain. In-domain profiles leave it empty; the parked
  **P2** cross-domain case (grove#36) fills it once the cross-domain
  **seal** contract exists. Shape the in-domain case now; leave the
  slot; do **not** resolve the external case here.
- **The profile configures, it does not replace, the emergent gate
  structure** (`adr-0012`). The floor validator and the owed-review
  rules both still run; a profile can tighten or (within the floor)
  loosen *who owns / how strongly* a gate fires, never delete the seam.
- **Append-only if this ever supersedes.** Nothing here supersedes an
  existing decision; if a later turn does, it follows `decisions/README.md`
  (forward pointer on the superseded text, same change).

## Options / rejected

- **Force an explicit profile choice at install (no default).** Rejected
  (**D1**, maintainer 2026-07-18): `steward` already keeps two human
  gates, so the safety argument is weak; and a required setup choice
  would make grove **gate its own arrival**, contradicting `adr-0014`.
- **Hardcode "the merge is the approval" as the intent-gate act.**
  Rejected (**D2**, maintainer 2026-07-18): the merge is one authentic
  channel among several (in-session approval, merge, tracker comment);
  hardcoding it would forbid the in-session approvals the maintainer
  already performs.
- **Make C1 (enforcement strength) a consumer-tunable per-gate dial
  (Model B).** Rejected (**D4**, maintainer 2026-07-18): a second axis to
  configure and validate (`inv-minimal-first`), and it opens the
  under-gating footgun of quietly setting a gate advisory. C1 is grove's
  gate-local design call (matching `adr-0007`/`adr-0013`), not a profile
  dial.
- **Split `.grove/` by machinery-vs-user-editable.** Rejected (**D5**,
  maintainer 2026-07-18): `review-policy.md`'s strict/scoped mode is a
  **consumer choice**, so that axis mis-classifies it as machinery. The
  correct axis is **authority** (who is authoritative on the contents).
- **`gates.toml` shape (A): terse `preset =` + sparse overrides, with
  runtime inheritance.** Rejected (**D7**, maintainer 2026-07-18) in
  favor of the explicit full table (shape B): the rows should be the
  self-describing source of truth a reader and the floor validator read
  directly, with no preset-expansion to resolve at read time. *(Not to be
  confused with the rejected C1 "Model B" above — different axis: this is
  file layout, that was the dial count.)*
- **`set-profile` preserves hand-overrides on top of the newly applied
  preset.** Rejected (**D7**, maintainer 2026-07-18): the simpler mental
  model won — `set-profile` is a **wholesale switch** that replaces the
  rows (showing the diff and confirming first, never silent). Preserving
  overrides would make "what profile am I on?" ambiguous.
- **Fall back to an ad-hoc all-human config on an unusable profile.**
  Rejected as the *default* fallback (**D8**, maintainer 2026-07-18): a
  named floor-safe preset (`guardian`) is more legible, and all-human
  puts a human on the mechanical build/conformance gate, which is awkward
  and heavier. All-human is noted as an available absolute-max, not the
  fallback.
- **A single unified config file** (one `.grove/config.toml` holding
  every axis). Rejected **for now** (**D9**, maintainer 2026-07-18): it
  mixes concerns owned by *different* decisions and forces skills to
  surgically edit a shared file rather than own theirs wholesale
  (`decision-0040`, one home per kind). Revisitable if the multiple-file
  surface becomes friction.

### Parked (deferred niceties, not rejected on merit)
- **CI/pre-commit floor check (variant B).** Would red an illegal
  `gates.toml` early and loudly at commit/PR time. Deferred (**D8**): the
  load-time guard (A) is required regardless and already catches every
  execution path; B is only earlier-and-louder, and adds CI machinery —
  `inv-minimal-first`. A future add, not a v0 need.

## Consequences / propagation (draft — POST-approval executor work, NOT part of this canvas)

The canvas records the decision and this propagation list; **it does not
move files or edit dependents.** The moves below are a **stage-4
`executor` pass after adr-0018 is approved** — flagged now so no
dependent is silently missed (`inv-graph-maintenance`).

- **D5 layout move — required dependent updates when the layout lands:**
  - Relocating the companions into `.grove/internal/` changes documented
    install paths in **`adr-0008`** (lifecycle), **`adr-0010`**
    (versioning), **`adr-0011`** (relations).
  - The `review-policy.md` / `check/` placement touches **`adr-0007`**
    and **`adr-0013`**.
  - The paths are referenced by the **setup, check-install, remove,
    record-verdict skills** and **`reference/ci/`** — all must be updated
    when the layout lands.
- **D7 + D8 new machinery to build (executor, post-approval):** the
  `gates.toml` writer + preset-expansion in **setup**; the floor
  validator; the **load-time floor-guard** (validate on every
  run-sequencing read) + the **`guardian` fallback + loud warning** on an
  unusable/floor-violating profile (**D8**); and the **`set-profile`**
  skill (candidate name, not load-bearing) that re-expands a preset,
  updates `seeded_from`, shows the diff, confirms, and re-runs the floor
  validator. Skill/guard *code* is out of this canvas; the *decision* is
  recorded here.
- **D10 review-policy split — amends `adr-0013`'s artifact (append-only):**
  split `review-policy.md` into `.grove/review.toml` (the consumer
  `scope: strict|scoped` choice, TOML per D9) + a grove-wiring file under
  `.grove/internal/` (`check_runtime_dir`, `check_workflow_path`). The
  executor pass **updates `adr-0013`** (forward pointer on the superseded
  text, never an in-place rewrite — `decisions/README.md`) and the
  **setup / check-install / remove skills** and **`reference/ci/`** that
  reference the old single-file paths. `review.toml` is owned wholesale
  by its own skill (D9).
  - **Load-bearing (adversary obs. a, 2026-07-18):** relocating
    `check_workflow_path` / `check_runtime_dir` into `.grove/internal/`
    is a **mechanism move, not a rename** — the executor pass **must
    preserve `adr-0013` AC4's protected-branch carrier fail-close** (a
    carrier key absent/unresolved on the protected branch must still force
    the red it mandates; cf. `adr-0014` move 1b, which keys off exactly
    this). The split changes *where the key lives*, never *that its
    absence fails closed*.
- **D2 wording flag (record, do not chase in this canvas).** The shaper
  charter and `floor-intent-gate` phrase ratification as "the merge is
  the approval." Under **D2** that is the **GitHub-repo reference
  convention**, not a channel restriction — the wording may want a later
  clarifying touch so it is not misread as merge-only. Noted for a future
  propagation pass; **not** edited here.

  > **Discharged 2026-07-19 (forward pointer, append-only —
  > `decisions/README.md`).** This flag is resolved by
  > **`adr-0020` D1**. `adr-0020` (the run-sequencer honors the
  > gate-profile at run time) removes the merge-only phrasing **at its
  > source**: the stage charters (`shaper`, `contract-author`) stop
  > *asserting* who owns their gate, and the dispatcher *reads* ownership
  > from the profile — so "the merge is the approval" no longer stands
  > anywhere as a channel restriction (D2's channel-agnosticism plus D11's
  > self-authenticating-channels interim govern instead). No text above is
  > rewritten; this pointer records the discharge.

## Open questions

**None.** All in-domain questions are Decided (D1–D11). The last
substantive Open (approval-channel authenticity) is resolved by **D11**;
the verified-identity extension and the cross-domain preset are the only
deferred items — a follow-up issue (D11) and grove#36 (Parked)
respectively.

## Acceptance criteria (for the post-approval executor pass)

The decision is the Decided list (D1–D11); these are the checkable
outcomes a stage-4 `executor` pass must satisfy **after** approval. The
canvas itself moves no files.

- [ ] `.grove/gates.toml` exists as the consumer-authoritative
      gate-profile: four explicit C2 rows (`intent`/`spec`/`build`/`ship`),
      a non-authoritative `seeded_from`, an explicit `[trigger]` section,
      and a reserved `[intent_external]` slot (`enabled = false`
      in-domain) — shape (B), D5/D7.
- [ ] Setup writes `gates.toml` seeded from **`steward`** by an
      **optional** question (never a forced pick), with per-preset
      one-liners (D1/D6); all three presets (`steward`/`guardian`/
      `initiator`) expand correctly (D3).
- [ ] C1 is **not** in `gates.toml`; enforcement defaults live in a
      grove-managed `.grove/internal/enforcement.toml` (D4).
- [ ] The floor validator rejects any profile with **0 human intent-locus
      gates** (`intent = human` OR `ship = human`; F1), reading rows
      directly; it runs at setup, on every `set-profile`, and **on every
      run-sequencing read** (load-time guard A, D8). It **passes** a valid
      `initiator` (`ship = human`) and **fails** an all-agent profile.
- [ ] A missing/unreadable/floor-violating `gates.toml` falls back to
      **`guardian` + a loud warning**, floor enforced and non-silent
      (D8).
- [ ] `.grove/internal/` holds the companions (`lifecycle.md`,
      `versioning.md`, `relations.md`), `check/`, `enforcement.toml`, and
      the review-policy wiring keys; the `.grove/` root holds
      `gates.toml` + `review.toml` (D5/D9/D10).
- [ ] `review-policy.md` is split into `review.toml` (consumer
      `scope: strict|scoped`) + internal wiring; `adr-0013` is amended
      append-only for the split (D10).
- [ ] User-facing config is uniform TOML (`gates.toml`, `review.toml`);
      companions remain markdown (D9).
- [ ] A `set-profile` skill exists that wholesale-switches the preset,
      updates `seeded_from`, shows the diff, confirms before writing, and
      re-runs the floor validator (D7); v0 honors only self-authenticating
      approval channels (D11).
- [ ] All dependents in `## Consequences / propagation` are updated (the
      companion path ADRs, the skills, `reference/ci/`), none silently
      missed (`inv-graph-maintenance`).

## Self-check (gate → `gated`)

Self-checked to **`gated`** by the shaper, 2026-07-18, and **re-checked
after the F1 revision** (same day). Not an approval — the
`decision-adversary` **re-review** (scoped to the revision banner's delta)
and the human intent gate follow; the merge is the maintainer's
ratification act (`floor-intent-gate`).

- **F1 break closed (the load-bearing fix)**: `initiator` is now a
  **distinct C2 row** (`{agent, agent, agent, human}`) — it no longer
  collapses into `steward` under the C2-only profile (D4). The floor
  validator is restated to **`intent = human` OR `ship = human`**, so it
  passes `initiator` (via `ship`) and fails an all-agent profile; the
  earlier "the `intent` row must be human" (which would wrongly reject
  `initiator`) is gone. The C1 "expressed at kickoff" framing is removed
  and re-anchored to the **trigger (K2)**. PASS.

- **Frontmatter**: `id`/`type`/`status`/`depends_on`/`informed_by`/
  `owner`/`updated` present, well-typed; `status: gated`. PASS.
- **`depends_on` resolution / directional flow**: both resolve and carry
  a consumable status, neither draft — `adr-0012-methodology-delivery-machinery`
  (`approved` — the emergent gate structure this profiles) and
  `trellis/signature-catalog-v1` (`ratified` — defines the C1/C2 dials +
  `floor-intent-gate` the profile realizes). A `gated` artifact consuming
  `approved`/`ratified` upstreams is legal. PASS.
- **`informed_by`** (provenance, not correctness-bearing): `adr-0005`
  (artifact-gated dispatch — the intent gate at the dispatch point),
  `adr-0006` (the triggered-check machinery a floor validator rides),
  `adr-0014` (grove does not gate its own arrival — the install-case
  intent-gate floor). Correctly `informed_by`, not `depends_on` (shaper
  edge discipline, `adr-0011`). PASS.
- **Decision recorded + why-nots kept**: the operative decision is the
  Decided list D1–D11; every rejected alternative is in `## Options /
  rejected` with its one-line reason (append-only why-not discipline).
  PASS.
- **Floor honored (the load-bearing check)**: every shipped preset and
  the fallback keeps a human-owned **intent-locus** gate (front `intent`
  for steward/guardian, `ship` for initiator — `floor-intent-gate`); the
  restated validator (`intent = human` OR `ship = human`) + load-time
  guard (D8) enforce it, and D11 scopes approval to self-authenticating
  channels so the floor is not satisfied by a forgeable act. An
  all-agent (no local intent-locus) profile is rejected; C2-`none` at the
  intent locus is impossible by construction. PASS.
- **Forward-compat constraint held**: the `[intent_external]` slot is
  reserved and visible (design constraint) so the parked **P2**
  cross-domain case (grove#36) drops in without a rewrite
  (`inv-graph-maintenance`). PASS.
- **Scope guard**: the two autonomous cases are Parked and now
  **distinguished** — **P1** in-domain-standing (no seal) vs **P2**
  cross-domain (grove#36); the `status`/merge divergence is noted
  Related-out-of-scope; the verified-identity approval mechanism is a
  deferred D11 follow-up. No new idea landed silently in a Decided
  (P1/P2 are Parked, not Decided). PASS.
- **Append-only**: new artifact; supersedes nothing in place. The
  `review-policy.md` split (D10) is flagged as an **append-only
  amendment to `adr-0013`** for the post-approval pass, not done here.
  PASS.
- **Minimal-first**: single configurable axis (C2, D4); multiple small
  files over one shared config (D9); CI floor-check parked (D8) — the
  smaller mechanism chosen at each fork. PASS.
- **Residual caveats (flagged, not blockers)**: (1) exact `gates.toml`
  key names are illustrative — the executor finalizes them; (2) the
  canvas uses the shaper's Decision-state format (Decided/Open/Parked)
  rather than a flat `## Decision` section — the Decided list **is** the
  decision, with Acceptance criteria added for checkability; (3) v0
  intent-approval is scoped to two channels (D11) — the verified-identity
  extension is a named follow-up, not a gap left silent.

**Overall: internally sound, consumable, and `gated`** — 11 Decided / 0
Open (in-domain) / 2 Parked (P1 in-domain-autonomous, P2 cross-domain).
Routes to `decision-adversary` (scoped re-review, per the revision
banner) then the **human intent gate**; the shaper does **not** promote
past `gated`.
