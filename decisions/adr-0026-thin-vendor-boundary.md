---
id: adr-0026-thin-vendor-boundary
type: adr
status: approved  # maintainer's intent act ("Approved", in-session, 2026-07-21) — recorded in-PR by the shaper per lifecycle.md; the flip records the human act, it does not perform it; decision-adversary SOUND on scoped re-review at b3c24e5 (NEEDS-REVISION at 61e68f6 first, F1 blocking on the adr-0012 pointer, folded); author (shaper) ≠ approver (maintainer); the PR merge is the ship act (this repo's gate profile: ship = human) and is not performed by this flip
depends_on: [adr-0012-methodology-delivery-machinery, adr-0018-gate-profile-and-trigger-split, adr-0021-gate-profile-self-adoption, spec-0002-review-bookkeeping-check]
informed_by: [adr-0008-lifecycle-enum-companion, adr-0014-install-is-invisible-and-ungated, adr-0023-review-triage-blackboard, adr-0010-versioning-is-operational, adr-0001-corpus-reviewer-lift]
owner: agent
updated: 2026-07-23
---

# ADR-0026: the thin-vendor boundary — plugin-carried fleet, repo-owned floor (grove#112)

> **The repo-installed gate-runtime exception is superseded by
> `adr-0035-plugin-and-consumer-boundary`.** The fleet, companions, gate
> runtime, and fixed enforcement data are plugin-carried; consumers keep their
> configuration, addenda, corpus, and dial explainer.
>
> **`gated` — converged, awaiting the adversary verdict + the intent gate.**
> grove#112 asked where grove's
> vendoring boundary should sit, after the 2026-07-21 fleet rollout priced the
> current model honestly: a 4-repo campaign, three-way charter merges, drift,
> one repo unstamped. The answer drafted here: **move the agent fleet into the
> plugin; the consumer repo keeps only what it owns and what CI reads.** The
> rollout evidence supports the move — charters proved ~95% generic prose
> (`auditor.md` carries zero placeholder tokens; `executor.md` three;
> `conformance-reviewer.md` five plus its declaration block), and the
> genuinely-composed residue was thin. One hard constraint shapes the design
> (D2: the review declarations never leave the protected branch), one honest
> cost is priced rather than hidden (D4: ratification becomes a **record with
> loud divergence disclosure, not a lock** — per-project plugin pinning does
> not exist in the harness, verified against Claude Code docs 2026-07-21).
> Seven items Decided, none Open — **converged 2026-07-21** — three Parked.
> Adversary history: **NEEDS-REVISION** at `61e68f6` (F1 blocking: the
> adr-0012 pointer was missing from Propagation; its carrier-siting letter
> is genuinely amended by D2) → F1–F6 folded → **SOUND on scoped re-review**
> at `b3c24e5`, all six verified resolved against sources. Awaiting the
> maintainer's intent act.

## Decision state

### Decided

- **D1 — the boundary moves: the fleet is plugin-carried** *(maintainer,
  2026-07-21, in-session fork choice "thin-vendor, full move" over
  "addenda-first" and "decline")*. The fourteen charters ship in the plugin's
  `agents/` payload as namespaced plugin agents (`grove:<role>`), auto-loaded
  wherever the plugin is enabled — **never vendored into consumer repos
  again**. The consumer repo keeps exactly two classes: **(a) what the
  consumer owns** — `.grove/gates.toml`, `.grove/review.toml`, the D3
  config/addenda, its own chartered roles (D5), its corpus; **(b) what CI
  reads from the protected branch** — the check runtime, the workflow, the
  wiring file, and the D2 declarations carrier.
  <!-- "CI-read floor" REVERSED by adr-0027 (grove#119, 2026-07-21): the
  review-bookkeeping check is retired-for-now (suspended, code preserved),
  so class (b) empties — the consumer repo keeps no check runtime,
  workflow, wiring file, or declarations carrier; it keeps only class (a),
  what it owns. D1's plugin-carried-fleet core stands unchanged. See
  adr-0027. --> Verified harness facts this
  rests on (Claude Code docs, 2026-07-21): plugins ship agents from an
  `agents/` payload dir, auto-loaded and namespaced; plugin agents' ordinary
  tool use is unrestricted (so the D3 read-if-present door works); there is
  **no per-project plugin version pin** (priced in D4).
  <!-- adr-0029 (2026-07-22): D1's plugin-carried fleet is exactly what breaks
  agent loading on NON-INTERACTIVE surfaces (cloud/CI/headless/SDK) — a run
  degrades silently to the generic agents (grove#125). adr-0029 solves this
  PER-SURFACE (explicit load: cloud env Setup-script, CI action inputs, headless
  --plugin-dir, SDK local path), **preserving this boundary** — the fleet is
  never re-vendored into a consumer repo. Append-only pointer; Recipe A (re-vendor)
  was rejected as an undoing of this D1. See adr-0029. -->

- **D2 — the declarations split: the owed-map's inputs stay on the protected
  branch, as authored source** *(shaper, from the spec-0002/adr-0012
  analysis; part of the accepted package)*.
  <!-- MOOTED by adr-0027 (grove#119, 2026-07-21): this split exists only
  to let the check read declarations from the protected branch; with the
  check retired-for-now (adr-0027 D1), the carrier feeds nothing — the
  declarations carrier is NOT built, and the `grove-review-declaration`
  blocks are removed from the reviewer charters rather than split into a
  carrier (adr-0027 D3). The non-CI thin-vendor core (D1/D3/D4/D5
  namespacing/D6/D7) stands. A revival of the check (adr-0027 D4) would
  re-open this split from this decided text, not a blank page. See
  adr-0027. --> The reviewer
  `grove-review-declaration` blocks move **out of charter prose** into a
  repo-committed declarations carrier the §C.1 assembly discovers — the same
  split-by-reader adr-0018 D10 performed on `review-policy.md`. Two clauses
  are load-bearing:
  - **The floor is untouched.** spec-0002 INV12 (*"only git content and
    existing platform primitives"*) and INV1 (policy from the protected
    branch, never PR HEAD) already forbid any plugin fetch; every CI input —
    declarations, policy, wiring, runtime, workflow — remains protected-branch
    git content. The check and gates runtimes read **no companion prose**
    (verified: their semantics are implemented in code; companions are cited
    only in comments). The check runtime *does* read charter files today —
    precisely to extract the `grove-review-declaration` blocks, i.e. the
    carrier this decision relocates; post-D2 it reads the declarations
    carrier instead (adversary F4 scoped this claim).
  - **The arrow of authority is fixed.** The repo's declarations carrier **is
    the source**; plugin charters read it; setup/refresh **never generate it
    from charters**. adr-0012 requires the owed-map *"assembled from the
    charters' declarations (**not a generated file**)"* — the prohibition is
    source-vs-generated, not repo-vs-plugin. An authored, hand-edited,
    PR-reviewed carrier preserves the substance of adr-0012's *"changing
    what a type owes is a charter edit, nothing to regenerate"* — it stays a
    hand edit to the authored source, nothing to regenerate, with the
    carrier relocated by this decision (an adaptation, not a quotation —
    adversary F3; the carrier-siting letter is amended by name,
    Propagation 3). A setup-compiled cache would
    reintroduce the compiled-table drift class adr-0012 exists to kill —
    rejected by construction (see Rejected options). Concrete filename/format:
    settled at spec time (the spec-0002 amendment, Propagation).

- **D3 — consumer customization = one shared config + per-role addenda,
  consumer-authoritative** *(maintainer-accepted package; the addendum idea
  is the maintainer's, evaluated on merits per #112)*. The ~14 config-shaped
  setup tokens (`TEST_CMD`, `TYPECHECK_CMD`, `LINT_CMD`,
  `PR_CONTRACT_SECTIONS`, `PARKED_ITEM_STORE`, rubric paths, `ARTIFACT_DIRS`,
  …, plus `TEST_DEPS_LEDGER`, today missing from setup's token table) move to
  **one shared config file** — shared because tokens cross roles (`TEST_CMD`
  feeds executor *and* conformance-reviewer; per-role duplication would
  reintroduce drift). The thin composed residue (a repo's local rules, worked
  examples — the design-system pinned-tag class) lives in **optional per-role
  addenda `.grove/agents/<role>.md`**, which generic plugin charters read
  when present and replace with judgment when absent. Both surfaces are
  **consumer-authoritative root class** (adr-0018 D5): setup seeds defaults,
  grove **never clobbers**. This supersedes adr-0007's placeholder door as
  the customization mechanism (pointer at approval). Honest-absent stays a
  value: "none exists yet" is config, not a gap.

  **Tokens are a verified prior, not ground truth** *(maintainer refinement,
  2026-07-21)*. The file buys the cheap path — verifying a stated value costs
  far less than deriving it cold ("checking a delta is less costly") — but
  plugin agents must stay correct without it. **Present** → verify on use
  (does the command still run, the path still resolve?); on mismatch,
  **disclose loudly and route a fix to the config file** — the stale token is
  the root cause (`inv-self-improvement`), ideally proposed in the same
  pass — and **never silently substitute** a "better" value over the
  consumer's declared intent, never silently work around a broken one.
  **Absent** (deleted, or never seeded) → self-detect and use judgment,
  disclosed. Consequence: **repo evolution never requires re-running
  setup** — drift is caught at use, not at install time. Boundary, so the
  postures never blur: this resilience discipline is **agent-read config
  only**; the D2 declarations carrier and the machinery configs
  (`gates.toml`, `review.toml`, wiring) are **literal deterministic reads** —
  CI and the runtimes apply them as written, no verification judgment, ever.

- **D4 — ratification: versioned releases + the stamp as record + loud
  mismatch, disclosed as skew, not sold as a lock** *(maintainer, 2026-07-21,
  fork choice)*. grove adopts explicit plugin versioning (the `plugin.json`
  `version` field / release tags — adr-0021 D4's named valve). The consumer's
  CLAUDE.md `grove plugin@<version>` stamp is the **in-repo ratified record**,
  bumped only by PR — that PR is where a fleet update gets its in-repo
  review seam, and it **links the release changelog** (the content diff lives
  in grove's repo, not the consumer's — named cost). `check-install` and
  role-start compare installed-plugin version against the stamp and
  **disclose divergence loudly**. This is the adr-0023 D5 idiom (*"disclosed
  skew, not breakage"*): per-machine skew is real (plugin installs are
  per-user; two collaborators can run different fleet versions against one
  repo), the harness offers no per-project pin, and grove's marketplace being
  third-party means auto-update is off by default — updates are deliberate
  acts. The stamp records; the check discloses; nothing pretends to enforce.
  <!-- adr-0028 (2026-07-22): the SOURCE-side release practice this valve
  implies — plugin.json as authoritative, the git tag cut by a deterministic
  CI job, the human-cut = the merge of the manifest-bump PR — is
  operationalized by adr-0028-plugin-release-tagging. Note: D4's own "bumped
  only by PR / review seam / links changelog" above describes the CONSUMER's
  CLAUDE.md stamp; grove's own manifest bump is the parallel act on the source
  side, whose practice adr-0028 sets. Append-only pointer, no in-place edit. -->

- **D5 — own roles stay repo-level** *(uncontested; #112 constraint 5)*.
  A role a repo genuinely owns (the trellis corpus-linter lineage,
  adr-0001) remains in that repo's `.claude/agents/`. Namespacing makes
  coexistence collision-free by construction (`corpus-reviewer` vs
  `grove:corpus-reviewer`). Own-role reviewers keep their declaration blocks
  feeding the §C.1 assembly — discovery covers both carriers (spec detail,
  Propagation).
  <!-- Sub-clause MOOTED by adr-0027 (2026-07-21, its D3 / adversary F2):
  no §C.1 assembly runs while the check is retired, so own-role
  declaration blocks feed nothing; D5's namespacing/own-role core stands.
  See adr-0027. --> Flip side, named: a repo **cannot shadow** a plugin agent
  under its name — repo-specific behavior flows through D3's door only.

- **D6 — migration: one final campaign; the stock rides the change**
  *(shaper; inv-self-improvement)*. Each of the four consumers gets one last
  leg: harvest local charter adaptations into D3 config/addenda, delete the
  vendored charters, land the D2 declarations carrier, stamp per D4. The
  existing vendored-charter stock is migrated by the adopting change itself —
  no prose exemption. After it, refresh shrinks to: floor re-copy + stamp
  bump; the three-way charter-merge class is **deleted, not mitigated**.

- **D7 — companions move with the fleet; visibility rides the dials, the
  model rides the pin** *(maintainer confirm, 2026-07-21, after the
  constraint-6 dissolution below)*. The companions ship in the plugin
  payload under the **single D4 pin** (one payload — charter↔companion
  lockstep by construction, which *removes* the skew surface a split home
  would create); repo citations switch from path-form to standard-form
  (*"per the grove lifecycle companion, `plugin@<stamp>`"*); the D4 mismatch
  check covers divergence. **Visibility mitigation** *(the maintainer's ask,
  evaluated and adopted)*: what a repo reader needs locally is the **effect
  of the consumer-facing dials**, and that documentation rides the consumer
  surfaces themselves — the config files stay self-documenting (the existing
  pattern: `.grove/gates.toml` explains every row inline) and setup seeds /
  refresh regenerates a short dial-explainer citing the companions
  standard-form (home settled at spec time). The line held: adr-0008's *"no
  repo restates the enum"* stands — dials documented at **effect level**,
  the normative model **never restated per-repo**, so the restatement-drift
  class stays closed. Residual, accepted with eyes open: the model prose
  itself is not inline-readable without the plugin; the pin + linked
  changelog is the consumer's record.

### Open

*(none — converged 2026-07-21; next: rubric self-check → `gated`, the
`decision-adversary` pass, then the maintainer's intent act.)*

### Parked

- **P1 — collapsing the two-copy lockstep** (`charters/` canonical ↔ plugin
  `agents/` payload, synced same-PR per adr-0021 D4) into one home.
  Trigger: the first release where the copies diverge or the sync is missed.
- **P2 — stamp upgraded from record to lock.** Trigger: the harness ships
  per-project plugin version pinning; D4 then re-opens for enforcement.
- **P3 — `grove-status` skill home** (today the one per-repo-vendored skill,
  for `<WISP_VENDOR_PATH>` resolution). Candidate to ride D6 into the plugin
  with a config lookup; small, decided at migration time.
  **Superseded by `adr-0032-status-emission-belongs-to-wisp`:**
  `grove-status` was removed from Grove; status emission belongs to Wisp.

## D7's substance: what constraint 6 is, and the dissolution

The companions (`lifecycle.md`, `versioning.md`, `relations.md`) carry the
semantics that give the ratified corpus its meaning — what `status: approved`
*means*, the `@version` pin grammar, the edge taxonomy. Constraint 6
(grove#112) is two distinct worries:

1. **Citability.** `decisions/README.md` and `specs/README.md` say the status
   semantics live in the companion, *"not restated here."* Plugin-only
   companions make that citation unresolvable for a reader without the plugin.
2. **Trust-pinning.** The corpus was validated against companion semantics at
   some version; a plugin update could change the semantics **under** the
   already-validated corpus with no in-repo diff — rules moving under a
   ratified record (the `inv-auditable-archive` axis).

**Why the floor is not in play:** neither the check nor the gates runtime
reads companion prose (verified — semantics are implemented in runtime code,
which stays repo-installed). Constraint 6 is a semantics-governance question,
not a CI one.

**The dissolution:** treat the companions as **versioned standards** — the
semver model: repos cite semver without vendoring its spec text, *because the
citation carries a version pin*. Here the pin already exists: the D4
`plugin@<version>` stamp. Fleet and companions travel in **one payload under
one pin**, so charter prose and the semantics it cites are version-consistent
by construction — whereas keeping companions repo-side while charters go
plugin-side would create a *new* charter↔companion skew surface. Citations
switch to standard-form (*"per the grove lifecycle companion,
`plugin@<stamp>`"*); the mismatch check discloses any installed↔stamp
divergence; a semantics change reaches a consumer only through a stamp-bump
PR whose changelog link shows what changed.

**Residual costs (accepted — D7, not denied):** a plugin-less
reader can't resolve the semantics inline from the repo; semantic content
diffs land in grove's history, not the consumer's — the stamp-bump PR +
changelog link is the consumer's record.

## Given (inherited — cited, not reopened)

- **spec-0002 INV1/INV12 + §C.1**: the floor — protected-branch git content
  only, owed-map *assembled* from discovered declarations (*"discovered, not
  hardcoded"*). D2 relocates a carrier; the invariants' **substance** binds
  unchanged, and their **letter** (INV1's *"reviewer charters'
  declarations"*, §B's *"charter edit"*) rides the Propagation-1 amendment —
  INV21's term *"reviewer-declaration file"* is already carrier-generic
  (adversary F5).
- **adr-0012**: *"assembled from the charters' declarations (not a generated
  file)"*; *"changing what a type owes is a charter edit, nothing to
  regenerate."* D2 preserves the **prohibition** (assemble-never-compile,
  source-vs-generated) in substance; the **carrier-siting letter** ("the
  charters'", "charter edit", AC5) is genuinely amended — annotated by name
  at approval (Propagation 3, adversary F1), never silently.
- **adr-0018 D5/D10**: placement by authority; the split-by-reader precedent
  D2 repeats. D3's surfaces take the consumer-authoritative class.
- **adr-0021 D1/D4**: the collapsed case (grove-self runs native payload
  paths, no installed self-copies) — D1 generalizes its shape to all
  consumers; D4's lockstep + release-tag valve become the fleet's versioning.
- **adr-0008**: *"a repo no longer hand-authors the operating model — it
  inherits it via the plugins"* — the direction, now applied to the fleet.
- **adr-0014**: the bootstrap discriminator keys on protected-branch policy
  presence — unchanged; every policy carrier stays repo-committed.
- **adr-0010 / versioning.md**: the vendored-bundle → content-hash /
  `@version` grammar that prices the payload's identity.

## Honest costs (surfaced, not buried)

1. **Per-machine skew is new.** Today's vendored model runs whatever is
   committed — identical for every collaborator. Plugin-carried charters run
   at each machine's installed version. D4 discloses; it cannot prevent.
2. **The in-repo reviewable diff shrinks.** Fleet/companion prose changes
   arrive as a stamp bump + changelog link, not as reviewable in-repo
   content. This is the ratification-discipline cost the maintainer accepted
   with eyes open (D4 fork).
3. **Consumers lose unilateral charter surgery.** Method-prose changes must
   go upstream; only D3's config/addenda are local. (Also the point: silent
   per-repo drift — the three-way-merge generator — ends. Cost and benefit
   are the same fact.)
4. **Role invocation names change** (`grove:<role>`); every machine-read
   reference (ROLES_LIST, dispatcher/gates prose) updates in D6.

## Rejected options

- **Addenda-first, keep charters vendored** *(the incremental fork —
  maintainer rejected 2026-07-21)*: builds the same D3 mechanism while
  keeping the merge-campaign class alive for a second decision to kill; the
  rollout evidence (thin residue) is precisely what says the intermediate
  step buys little.
- **Decline — keep vendored + refresh** *(rejected same fork)*: the refresh
  skill (#110) mechanizes the current model but the 2026-07-21 rollout still
  priced it at a 4-repo campaign with lossy-by-construction merge risk;
  the evidence gathered for #112 does not support keeping it.
- **A generated declarations cache** (setup compiles plugin charters into
  the repo carrier): violates adr-0012's *"not a generated file"* clause
  verbatim — the compiled-table drift class returns. Rejected by
  construction in D2, recorded so no future "convenience" reopens it.

## Consequences / propagation (land at approval, tracked not silent)

1. **spec-0002 amendment**: §C.0/§C.1 carrier set gains the D2 declarations
   carrier; assembly discovery covers it plus `.claude/agents/` (D5 own
   roles); the letter of INV1 and §B (*"reviewer charters'"* / *"charter
   edit"*) re-worded carrier-generically, as INV21's *"reviewer-declaration
   file"* already is (adversary F5); check-runtime discovery code follows
   the spec.
2. **Skills rewritten to the thin model**: setup (shrinks to floor + config
   seeding), refresh (floor re-copy + stamp bump; the charter three-way-merge
   engine retires), remove, check-install (gains the D4 mismatch
   disclosure); setup seeds and refresh regenerates the D7 dial-explainer;
   the generic charters carry the D3 verified-prior posture. The plugin
   grows the `agents/` payload; `plugin.json` gains an explicit `version`.
3. **Supersession pointers** (append-only rule, same change): **adr-0012
   annotated at its three carrier-siting loci** (*"the charters'
   declarations"*, *"charter edit"*, AC5) — carrier relocated by adr-0026,
   the source-vs-generated prohibition unchanged; house precedent is
   adr-0012's own inline annotations from adr-0015/adr-0019 (adversary F1);
   adr-0007 superseded in part (placeholder door → D3); adr-0008's
   companion-location note amended again — unconditionally, D7 decided the
   move (adversary F2) — (`.grove/internal/` → plugin payload); adr-0018
   D5's layout table amended (`internal/` shrinks); adr-0001's three-copy
   kept-in-sync rule collapses to the two-copy lockstep (P1).
4. **D6 campaign** across math-quest, wisp, design-system, trellis — the
   final vendored-charter harvest; trellis's own corpus-reviewer stays
   in-repo per D5.
5. **Riders**: fix stale "thirteen" roster counts (`plugin.json`, root
   README, `plugins/grove/README.md` — adversary F6); fold the orphan
   `<TEST_DEPS_LEDGER>` token into the D3 config
   schema (it is absent from setup's token table today — found during #112
   evidence-gathering).
6. **grove#112 closes** linked here; **grove#91** (dogfooding tracker) gains
   the boundary-decision line.

## Acceptance criteria (for this decision's landing)

- **AC1**: this ADR `approved` by the maintainer's intent act (profile:
  `intent = human`), decision-adversary verdict on record first.
- **AC2**: grove#112 closed with the ADR linked; #91 tracker line added.
- **AC3**: every propagation item above exists as a tracked follow-up (spec
  amendment, skills rewrite, D6 campaign) — none lands silently with the ADR
  itself (**no build rides this decision**; #112 asked for a decision only).

## Self-check (gate → `gated`)

*(No decision rubric exists in grove-self — honest-absent; checked against
the house axes, the same four the `decision-adversary` judges.)*

- **Internal coherence**: D1 (the fleet leaves the repo) and D2 (the
  declarations stay) compose because the split fixes the authority arrow
  *before* the move; D3's verified-prior posture cannot bleed into the
  deterministic reads — the two-disciplines boundary is stated inside D3
  itself; D4's record-not-lock is the premise D7's single-pin rides; D6
  makes the existing stock ride the adopting change. No decision here
  contradicts another.
- **Contradiction sweep**: every standing decision this touches is either
  untouched by construction (adr-0014 — the bootstrap discriminator's
  carriers stay repo-committed) or amended **by name with a pointer owed at
  approval** (adr-0012's carrier-siting loci — its prohibition is preserved
  in substance, its letter amended; adr-0007 in part; adr-0008's companion
  location; adr-0018 D5's layout table; adr-0001's copy count) — none
  silently. adr-0021 is generalized (collapsed case, lockstep valve), not
  reversed; adr-0008's non-restatement rule is explicitly held (D7).
  *Corrected after adversary F1: the first self-check wrongly claimed
  adr-0012 "preserved by construction" whole — the prohibition is; the
  carrier-siting letter is not, and is now amended by name.*
- **Build-on-settled-ground**: the four `depends_on` are all `approved`
  (verified against their frontmatter 2026-07-21); the harness facts D1/D4
  rest on were verified against Claude Code docs 2026-07-21, not assumed;
  all three forks and both refinements were the maintainer's in-session
  direction (2026-07-21), recorded per-decision with who/when.
- **Honest scope**: the load-bearing costs are surfaced, not buried —
  per-machine skew is preventable by no mechanism and only *disclosed*
  (D4 is never sold as enforcement); the in-repo reviewable diff shrinks;
  consumers lose unilateral charter surgery; the rename sweep is named.
  No build rides the decision (AC3).

## Forward annotation — ADR-0031 (2026-07-23)

ADR-0031 partially supersedes the single-host projection boundary. The
canonical charters remain the sole authored method corpus, while deterministic
Claude and Codex projections now derive from that corpus and metadata. Codex's
documented project-launcher bridge is a narrow consumer-side exception: setup
may generate thin `.codex/agents/*.toml` loading pointers, but neither the
plugin nor those launchers carry an independently authored charter body. The
consumer-authoritative `.grove/` config and verified-prior token boundary
remain unchanged.
