---
id: adr-0006-operational-conformance-mechanism
type: adr
status: gated  # self-checked 2026-07-11; revised after an adversarial pass (Findings 1–4) — see Self-check
depends_on: [adr-0004-spec-lifecycle-and-organization, adr-0005-tdd-and-artifact-gated-dispatch, trellis/decision-0045, trellis/decision-0044]
owner: agent
updated: 2026-07-11
---

> Shaped interactively with the maintainer (2026-07-11), resolving
> kodhama/grove#34 — the *operational* piece of the artifact-conformance
> program (kodhama#31). Applies `trellis/decision-0045`'s versioning
> *primitive* as running machinery. Heavily front-loaded in the kodhama#31
> conversation; see grove#34's comment thread for the full derivation.
>
> Two independent `spec-adversary` rounds (2026-07-11), each verified
> against source before acting:
> - **Round 1** → NEEDS-REVISION, two load-bearing findings: **(F1)** the
>   "standing sweep" had no firing mechanism and contradicted grove's own
>   "never calendar sweeps" doctrine → re-cast as a **triggered** check
>   (an upstream version bump joins `validator`'s trigger set) + an ad-hoc
>   corpus audit, v0 latency floor named; **(F2)** a whole-file content-
>   hash false-positives on the *transformed* (not byte-copied) charter
>   copies → re-cast as a **generation stamp**. Plus two secondary scope
>   limits (cross-repo v0 no-fetch; per-change gate vs. pin-check).
> - **Round 2** (focused re-check) → F1/F3/F4 confirmed closed; caught
>   that the F2 stamp, hashing the *canonical* only, still missed the
>   **copy-divergence** direction — the very `SKILL.md` failure it cited —
>   and had deferred it to an ADR-conformance review the copies (no
>   `depends_on`) can't reach. Closed here with a **two-hash** stamp
>   (`canonical@gen` catches lag, `copy-body@gen` catches divergence).
> The adversary's clean passes (no grove#20/#21 circularity; spec-0001
> dependency honestly gated; trellis#25 scope; no `changes:`/`depends_on`
> cycle) stood across both rounds.

# ADR-0006: the operational conformance/sync mechanism — a self-describing graph, per-role duties, and a triggered staleness check

## Decision

1. **Versioning is a proxy for conformance, not conformance.** The
   pin-vs-current comparison (`trellis/decision-0045`) is a *cheap
   staleness trigger* — "the upstream moved past your pin → go check" —
   never the verdict. It guarantees only "*if* nothing lied and nothing
   was tampered, things conform." The real conformance check (does the
   implementation match its upstream) is a separate, judgment step the
   signal fires. A version that occasionally mis-signals just triggers an
   unnecessary check, or is caught by the real one — it is never
   load-bearing for correctness.

2. **The model is emergent, not declared.** The `depends_on` graph is
   *self-describing* — the topology is read from the artifacts, never
   declared. Each role's charter carries only its *local* duty; the global
   model emerges from those duties + the graph. **No declared global
   topology** — it would be brittle (the graph is not a strict shape) and
   redundant (the graph already records it). Same discipline as the
   family's propagation rule: duties live in charters and ride the plugin,
   never per-repo CLAUDE.md.

3. **`depends_on` is heterogeneous by kind** (`trellis/decision-0044` +
   `trellis/decision-0045`): a spec → `repo/id@vN`; a decision →
   `repo/adr-id` (append-only, the id *is* the version, no `@`); a design
   artifact → `repo/id@version`; other kinds → their own form. The
   pin-vs-current comparison over these is mechanically live **intra-repo**
   at v0: `trellis/decision-0044` fixes v0 as no-fetch ("v0 checks shape
   and registry membership only" — it does not resolve a cross-repo
   referent's live corpus), so a cross-repo `repo/id@vN` pin's *staleness*
   is computable only where the upstream corpus is on hand (a checkout, a
   monorepo view) — otherwise it waits on the event-driven refinement.
   grove's own collapsed charter→ADR edges are intra-repo, so the primary
   use survives; the separated cross-repo case inherits `decision-0044`'s
   v0 limit.

4. **Tests are first-class artifacts with a per-package deps ledger.** A
   dedicated ledger file per package/suite declares the tests'
   `depends_on` — the specs (`@vN`) *and* decisions they rest on. (Tests
   are a *superset* of ACs: behavioral tests derive from a spec's
   GWT/EARS; technical/e2e tests are governed by a test-strategy
   *decision*, not a spec AC.) A per-package file, not per-test-file: no
   YAML-in-code, and one-file/one-spec rarely align 1:1. `executor` owns
   authoring the tests and maintaining the ledger — no new role (it
   already writes the tests under strict TDD, `adr-0005`).

5. **Per-role local duties — the emergence substrate.** The pin-vs-current
   check is **triggered or ad-hoc, never a calendar sweep** — reconciling
   with grove's existing drift-audit stance (`validator`: "**TRIGGERED**
   spec-drift audits — never calendar sweeps"). No new firing machinery is
   added; it rides mechanisms grove already has:
   - `contract-author` — declares the spec's `depends_on`; bumps its
     behavioral version counter (`trellis/decision-0045`).
   - `shaper` — declares a decision's `depends_on`; supersedes old
     decisions (append-only, no version).
   - `executor` — authors tests; declares + maintains the per-package test
     deps ledger.
   - `validator` — an **upstream version bump landing** joins its trigger
     set as a new named drift-audit trigger, of the same shape as its
     existing ones ("an upstream repair lands", "a dependency refresh
     happens"); on it, `validator` walks the `depends_on` graph outward
     (its existing Method) and flags consumers whose pin now lags
     upstream-current. Grove's already-built triggered-audit shape, one
     more trigger the charter change (Consequences 3) adds — not a
     schedule.
   - `corpus-reviewer` — the corpus-wide pin-vs-current audit it already
     owns (`decision-0045`'s version/graph audit, extended to pins), run
     **ad-hoc** when a human sweeps the corpus — not a scheduled job.
   - `conformance-reviewer` — invoked on a flagged consumer, **re-derives
     against the current upstream and verdicts** (this is the
     `trellis#25` conformance-to-upstream check, which it already *is* —
     no new agent).

   **v0 latency floor (stated, not papered over):** a consumer whose
   upstream never re-bumps *and* which itself never changes is re-checked
   only at the next ad-hoc corpus audit — the `validator` trigger needs an
   upstream *event* to fire, and the per-change gate needs the consumer to
   *change*. Bounded/event-driven immediacy is the parked refinement (Open
   questions), not a v0 guarantee.

6. **Guardrail (carried from grove#22):** absence of a spec/test is
   *never* evidence code is wrong or should be deleted; a coverage gap is
   a *visible governance gap* (needs a spec/test), never a delete trigger.
   The forgotten-dependency soft spot degrades gracefully — but honestly,
   two different gates catch two different things: a **newly changed**
   artifact with no declared upstream surfaces at the **per-change
   conformance gate** (`conformance-reviewer` flags a no-upstream change as
   a visible gap, `adr-0005`), plus role-conformance catches gross misses.
   The **pin-check cannot** surface never-declared code — with no pin there
   is nothing to compare — so an undeclared dep on an artifact that never
   changes again is a genuine v0 blind spot, not caught until it is touched
   or a human audits the corpus. No active declaration-enforcement
   mechanism is added for v0; this blind spot is named, not closed.

7. **Two shapes the mechanism handles:**
   - *Separated* (product repos, e.g. math-quest): spec and code are
     distinct artifacts; the DAG + version pins + triggered staleness
     check + the conformance check apply directly. The real dependency graph is a
     **DAG, not a linear chain** (illustrative, not strict): e.g.
     `(decisions, specs) → tests`; `(decisions, mockups) → specs`;
     `(tests, design-system) → code` (via TDD).
   - *Collapsed* (grove itself): the **charter IS spec + code** — a
     cold-started agent *is* its charter; consumers install charters, not
     ADRs.

8. **Charter (collapsed-case) specifics.** A charter is *dual-consumed* —
   vendored (the canonical ↔ `.claude/agents/` ↔ `plugins/reference/`
   copies) and behavioral (it implements an ADR). Therefore:
   - It carries a **generation stamp** — a marker each copy records at
     generation time, holding *two* hashes: `hash(canonical@gen)` (the
     canonical body it was generated from) and `hash(copy-body@gen)` (this
     copy's own generated body). `corpus-reviewer` re-hashes both and flags
     **either** drift direction — the two-hash form is load-bearing,
     because a single canonical-hash catches only one:
     - **regeneration-lag** — `hash(canonical-now) ≠ hash(canonical@gen)`:
       the canonical moved, this copy was never re-generated.
     - **copy-divergence** — `hash(copy-body-now) ≠ hash(copy-body@gen)`:
       this copy was edited directly, bypassing the canonical. *This is the
       grove-status `SKILL.md` failure this session — a copy diverged
       silently; the copy-body hash makes it a finding.* A canonical-only
       stamp would miss exactly this case (the copies carry no `depends_on`,
       so the ADR-conformance review below runs on the canonical alone and
       cannot reach a diverged copy — the stamp must catch it).
     Why two generation-snapshot hashes and not one whole-file
     canonical-vs-copy compare: charters are **transformed**, not
     byte-copied — the copies differ by design (whole-frontmatter swap
     `id/type/status`↔`name/description/tools`, a third→second-person
     rewrite, resolved placeholders; `hash(canonical) ≠ hash(copy)` is the
     *normal* state, ~44 lines apart for `executor`), so a direct compare
     would false-positive forever. Hashing each side against *its own*
     generation snapshot sidesteps the transform. This is **drift**
     detection, not the byte-identity "can't-lie" property a true vendored
     `payload@hash` gets (`decision-0045` item 5): a deliberate edit that
     *also* recomputes both stamp hashes evades it — the same "if nothing
     lied" caveat item 1 and `decision-0045` already carry. It catches the
     *accidental* drift that is the observed failure mode, both directions.
   - Its `depends_on` **lists the ADR(s) it implements** (bare,
     append-only) — making the charter→ADR edge graph-visible and giving
     the review a declared upstream.
   - "Charter conforms to its ADR" is a **`conformance-reviewer` review**
     against those `depends_on` ADRs (charters are prose, not
     test-runnable).
   - **No behavioral counter** — nothing pins a charter's behavioral
     version (agents run the current charter); the generation stamp
     (copy-sync) + review (ADR-conformance) suffice.

## Context

The operational counterpart to `trellis/decision-0045` (the versioning
*primitive*): this decision is the machinery that uses it. The full
derivation of the front-loaded points (versioning-as-proxy, emergent-not-
declared, the heterogeneous graph, tests-as-artifacts, the DAG, the
guardrail) is in kodhama#31's conversation and grove#34's comment thread.
Settled ground it builds on: `adr-0004` (spec lifecycle, GWT/EARS,
revise-in-place), `adr-0005` (strict TDD + artifact-gated dispatch),
`trellis/decision-0045` (the two versioning kinds + pin-vs-current),
`trellis/decision-0044` (the qualified `repo/id` reference form).

## Considered and rejected

- **A declared global topology** (each repo's CLAUDE.md declares the
  decision→spec→tests→code shape) — rejected: brittle (the maintainer does
  not guarantee the graph is strict) *and* redundant (the `depends_on`
  graph is self-describing). Emergence from per-role duties + a
  self-describing graph is the smaller, more honest mechanism.
- **A new test-creator role** — rejected: `executor` already writes tests
  under strict TDD, so it absorbs the ledger duty. (Deriving test
  skeletons from GWT/EARS, grove#21's parked idea, is a possible later
  refinement, not now.)
- **`conformance-reviewer` owning the whole staleness detection + check**
  — rejected for the split: firing is `validator`'s remit (an upstream
  version bump is a qualifying triggered-audit event) or a `corpus-reviewer`
  ad-hoc corpus audit (it already audits versions + the graph);
  `conformance-reviewer` does the semantic re-check on a flagged consumer.
  Each does what it already does — no new firing machinery.
- **A calendar/standing sweep** (a job that re-scans the corpus on a
  schedule) — rejected: it contradicts grove's own drift-audit doctrine
  (`validator`: "never calendar sweeps — every audit traces to a named
  trigger event"), and grove has no scheduler to run it. The check is
  triggered (upstream bump) or ad-hoc (human sweep) instead.
- **Reactive / event-driven flagging** (a version bump emits a wisp /
  `$GROVE_EVENTS` event that flags downstream at once) — deferred, not
  rejected: ideal immediacy over the triggered check, but needs event
  machinery grove lacks; the `validator`-trigger + ad-hoc audit is the v0
  shape.
- **A behavioral significance-counter on charters** — rejected: nothing
  pins a charter's behavioral version; the generation stamp (copy-sync) +
  review (ADR-conformance) cover its real consumption.
- **Active declaration-enforcement** (a mechanism that forces every
  `depends_on` to be declared) — rejected for v0: the graceful degradation
  (missing dep → visible coverage gap) is judged sufficient.

## Consequences

Not executed by this decision — a follow-on pass amends the charters (per
the propagation constraint: this rides the charters + plugin, never a
per-repo README) once approved. It also **depends on
`trellis/decision-0045`'s `spec-0001` amendment** for the `repo/id@vN` pin
grammar and the version field:

1. **`executor` charter** — + author tests; + declare and maintain the
   per-package test deps ledger.
2. **`contract-author` charter** — + declare the spec's `depends_on`; +
   bump the spec's version counter on a significant (GWT/EARS-clause)
   change.
3. **`validator` charter** — + treat an upstream version bump as a
   qualifying drift-audit trigger (its existing triggered-audit model, one
   more trigger): walk the `depends_on` graph outward and flag consumers
   whose pin now lags. No calendar sweep added.
4. **`corpus-reviewer` charter** — + the ad-hoc corpus-wide pin-vs-current
   audit (its existing version/graph audit, extended to pins); + the
   charter canonical↔copy generation-stamp drift check (both directions:
   regeneration-lag *and* copy-divergence).
5. **`conformance-reviewer` charter** — + re-derive and verdict on a
   flagged stale pin; + the "charter implements its `depends_on` ADR"
   review.
6. **Charters gain** a generation stamp (two generation-snapshot hashes:
   the canonical body and this copy's own body) and a `depends_on` listing
   their governing ADR(s).
7. **The per-package test deps ledger** convention is introduced.
8. Each charter change propagates to its `.claude/agents/` and
   `plugins/grove/reference/` copies (the three-copy sync) — the
   generation stamp (item 6) flags a copy left un-regenerated.

## Acceptance criteria

- [ ] `executor`'s charter states it authors tests and maintains the
      per-package test deps ledger.
- [ ] `validator`'s charter names an upstream version bump as a qualifying
      drift-audit trigger (graph-walk to flag lagging pins).
- [ ] `corpus-reviewer`'s charter states the ad-hoc pin-vs-current audit
      and the charter generation-stamp drift check.
- [ ] `conformance-reviewer`'s charter states the stale-pin re-check and
      the charter-implements-its-ADR review.
- [ ] Charters carry a generation stamp (canonical-body + copy-body hashes,
      catching both drift directions) and a `depends_on` listing their
      governing ADR(s) (at least the roles touched above).
- [ ] A worked example of a per-package test deps ledger exists (proof the
      form is usable).

## Open questions (parked, ≤3)

- **Reactive / event-driven staleness flagging** (a version bump emits a
  wisp / `$GROVE_EVENTS` event that flags stale downstream at once) — a
  future refinement over the `validator`-trigger + ad-hoc audit, closing
  the v0 latency floor, once event machinery exists.
- **The exact `spec-0001` amendment grammar** this consumes (the
  `repo/id@vN` pin, the version field, the `changes:` relation) is
  `trellis/decision-0045`'s follow-on `contract-author` pass — this
  decision's execution waits on it.

## Self-check (gate)

- **Frontmatter**: `id`/`type`/`status`/`depends_on`/`owner`/`updated`
  present, well-typed. PASS.
- **`depends_on` resolution**: `adr-0004` (`approved`), `adr-0005`
  (`approved`), `trellis/decision-0045` (`approved`, qualified per
  `decision-0044`), `trellis/decision-0044` (`approved`) — all resolve,
  none draft. PASS.
- **Directional flow**: this artifact is `gated`; every dependency is
  approved, not draft. PASS.
- **Required body sections** (matching sibling ADRs): Decision, Context,
  Considered and rejected, Consequences, Acceptance criteria, Open
  questions, Self-check — present. PASS.
- **Open questions count**: 2, within the ≤3 convention. PASS.
- **Append-only discipline**: new artifact, still `gated` — revised in
  place after the adversarial pass, which is legitimate pre-ratification
  work (append-only binds *ratified* decisions, not a gated draft still
  converging). No ratified decision superseded (it *applies* decision-0045,
  extends the charters). PASS.
- **Adversarial passes**: two rounds run (spec-adversary, 2026-07-11) —
  round 1 (4 findings) then a focused re-check (round 2, caught the F2
  copy-divergence gap). All findings folded in and verified against source
  before fixing (see top provenance note). Round 2's sole remaining gap
  (F2 copy-divergence) is closed here with the two-hash stamp; that fix
  applies round 2's own stated fix-direction and is self-consistent with
  the "if nothing lied" caveat, so it is presented to the maintainer for
  the approval act rather than triggering an open-ended third round. PASS
  (two independent rounds ran; the human owns whether to approve now).
- **Approval mechanic**: left `gated`, not flipped. Ratification (the
  maintainer's act) is owed; this record does not pre-empt it. PASS.

**Overall: internally sound, consumable, and `gated`** — self-checked,
awaiting the maintainer's approval, which closes kodhama/grove#34 and
authorizes the charter execution (Consequences).
