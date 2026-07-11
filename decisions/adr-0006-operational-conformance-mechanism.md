---
id: adr-0006-operational-conformance-mechanism
type: adr
status: gated  # self-checked 2026-07-11, shaping converged — see Self-check
depends_on: [adr-0004-spec-lifecycle-and-organization, adr-0005-tdd-and-artifact-gated-dispatch, trellis/decision-0045, trellis/decision-0044]
owner: agent
updated: 2026-07-11
---

> Shaped interactively with the maintainer (2026-07-11), resolving
> kodhama/grove#34 — the *operational* piece of the artifact-conformance
> program (kodhama#31). Applies `trellis/decision-0045`'s versioning
> *primitive* as running machinery. Heavily front-loaded in the kodhama#31
> conversation; see grove#34's comment thread for the full derivation.

# ADR-0006: the operational conformance/sync mechanism — a self-describing graph, per-role duties, and a staleness sweep

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
   artifact → `repo/id@version`; other kinds → their own form.

4. **Tests are first-class artifacts with a per-package deps ledger.** A
   dedicated ledger file per package/suite declares the tests'
   `depends_on` — the specs (`@vN`) *and* decisions they rest on. (Tests
   are a *superset* of ACs: behavioral tests derive from a spec's
   GWT/EARS; technical/e2e tests are governed by a test-strategy
   *decision*, not a spec AC.) A per-package file, not per-test-file: no
   YAML-in-code, and one-file/one-spec rarely align 1:1. `executor` owns
   authoring the tests and maintaining the ledger — no new role (it
   already writes the tests under strict TDD, `adr-0005`).

5. **Per-role local duties — the emergence substrate:**
   - `contract-author` — declares the spec's `depends_on`; bumps its
     behavioral version counter (`trellis/decision-0045`).
   - `shaper` — declares a decision's `depends_on`; supersedes old
     decisions (append-only, no version).
   - `executor` — authors tests; declares + maintains the per-package test
     deps ledger.
   - `corpus-reviewer` — runs the **standing** pin-vs-current staleness
     sweep (it already owns `decision-0045`'s version audit and resolves
     the `depends_on` graph); flags a stale pin (consumer < upstream
     current).
   - `conformance-reviewer` — invoked on a flagged consumer, **re-derives
     against the current upstream and verdicts** (this is the
     `trellis#25` conformance-to-upstream check, which it already *is* —
     no new agent).

6. **Guardrail (carried from grove#22):** absence of a spec/test is
   *never* evidence code is wrong or should be deleted; a coverage gap is
   a *visible governance gap* (needs a spec/test), never a delete trigger.
   The forgotten-dependency soft spot degrades gracefully: a missing
   `depends_on` reads like "no dep needed," but surfaces as a coverage gap
   when the conformance check runs (an implementation matching no declared
   upstream is a visible gap), plus role-conformance catches gross misses.
   No active declaration-enforcement mechanism is added for v0.

7. **Two shapes the mechanism handles:**
   - *Separated* (product repos, e.g. math-quest): spec and code are
     distinct artifacts; the DAG + version pins + staleness sweep + the
     conformance check apply directly. The real dependency graph is a
     **DAG, not a linear chain** (illustrative, not strict): e.g.
     `(decisions, specs) → tests`; `(decisions, mockups) → specs`;
     `(tests, design-system) → code` (via TDD).
   - *Collapsed* (grove itself): the **charter IS spec + code** — a
     cold-started agent *is* its charter; consumers install charters, not
     ADRs.

8. **Charter (collapsed-case) specifics.** A charter is *dual-consumed* —
   vendored (the canonical ↔ `.claude/agents/` ↔ `plugins/reference/`
   copies) and behavioral (it implements an ADR). Therefore:
   - It carries a **byte-marker (content-hash)** so `corpus-reviewer`
     detects canonical↔copy **drift** (the exact failure that hit
     grove-status `SKILL.md` this session — a copy diverged silently; a
     hash makes it a finding).
   - Its `depends_on` **lists the ADR(s) it implements** (bare,
     append-only) — making the charter→ADR edge graph-visible and giving
     the review a declared upstream.
   - "Charter conforms to its ADR" is a **`conformance-reviewer` review**
     against those `depends_on` ADRs (charters are prose, not
     test-runnable).
   - **No behavioral counter** — nothing pins a charter's behavioral
     version (agents run the current charter); the byte-marker + review
     suffice.

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
- **`conformance-reviewer` owning the whole sweep + check** — rejected for
  the split: the corpus-wide staleness sweep is `corpus-reviewer`'s remit
  (it already audits versions + the graph); `conformance-reviewer` does
  the semantic re-check. Each does what it already does.
- **Reactive / event-driven flagging** (a version bump emits a wisp event
  that flags downstream at once) — deferred, not rejected: ideal
  immediacy, but needs event machinery grove lacks; the standing sweep is
  the v0 shape.
- **A behavioral significance-counter on charters** — rejected: nothing
  pins a charter's behavioral version; the byte-marker (copy-sync) +
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
3. **`corpus-reviewer` charter** — + the standing pin-vs-current staleness
   sweep; + the charter canonical↔copy byte-hash drift check.
4. **`conformance-reviewer` charter** — + re-derive and verdict on a
   flagged stale pin; + the "charter implements its `depends_on` ADR"
   review.
5. **Charters gain** a byte-marker (content-hash) and a `depends_on`
   listing their governing ADR(s).
6. **The per-package test deps ledger** convention is introduced.
7. Each charter change propagates to its `.claude/agents/` and
   `plugins/grove/reference/` copies (the three-copy sync) — now itself
   guarded by the charter byte-marker (item 5).

## Acceptance criteria

- [ ] `executor`'s charter states it authors tests and maintains the
      per-package test deps ledger.
- [ ] `corpus-reviewer`'s charter states the standing pin-vs-current sweep
      and the charter copy-drift byte-check.
- [ ] `conformance-reviewer`'s charter states the stale-pin re-check and
      the charter-implements-its-ADR review.
- [ ] Charters carry a byte-marker and a `depends_on` listing their
      governing ADR(s) (at least the roles touched above).
- [ ] A worked example of a per-package test deps ledger exists (proof the
      form is usable).

## Open questions (parked, ≤3)

- **Reactive / event-driven staleness flagging** (a version bump emits a
  wisp / `$GROVE_EVENTS` event that flags stale downstream at once) — a
  future refinement over the standing sweep, once event machinery exists.
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
- **Append-only discipline**: new artifact; nothing edited in place; no
  ratified decision superseded (it *applies* decision-0045, extends the
  charters). N/A.
- **Approval mechanic**: left `gated`, not flipped. Ratification (the
  maintainer's act) is owed; this record does not pre-empt it. PASS.

**Overall: internally sound, consumable, and `gated`** — self-checked,
awaiting the maintainer's approval, which closes kodhama/grove#34 and
authorizes the charter execution (Consequences).
