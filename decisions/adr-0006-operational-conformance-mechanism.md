---
id: adr-0006-operational-conformance-mechanism
type: adr
status: draft
depends_on: [adr-0004-spec-lifecycle-and-organization, adr-0005-tdd-and-artifact-gated-dispatch, trellis/decision-0045, trellis/decision-0044]
owner: agent
updated: 2026-07-11
---

> **Draft — shaping canvas for kodhama/grove#34.** The *operational* piece
> of the artifact-conformance program (kodhama#31): how implementations
> stay in sync with the specs/decisions that govern them, applying
> trellis/decision-0045's versioning primitive. Being shaped
> interactively; the `## Decision state` below is the live record.
> Front-loaded heavily in the kodhama#31 conversation (see grove#34's
> comment thread) — most of the model is already Decided.

# ADR-0006: the operational conformance/sync mechanism — self-describing graph + per-role duties + a staleness sweep

## Decision state

**Decided** (maintainer, 2026-07-11 — front-loaded):
- **Versioning is a proxy/signal for conformance, not conformance
  itself.** The pin-vs-current comparison (`trellis/decision-0045`) is a
  *cheap staleness trigger* — "the upstream moved past your pin → go
  check" — never the verdict. It guarantees only "*if* nothing lied and
  nothing was tampered, things conform." The real conformance check (does
  the implementation match its upstream) is a separate, judgment step the
  signal fires. This is the correction that de-risks versioning: a version
  that occasionally mis-signals just triggers an unnecessary check, or is
  caught by the real one — it was never load-bearing for correctness.
- **The model is EMERGENT, not declared.** The `depends_on` graph is
  *self-describing* — the topology is READ from the artifacts, never
  declared. Each role's charter carries only its LOCAL duty; the global
  model emerges from those + the graph. No declared global topology — it
  would be brittle (the graph is not a strict/guaranteed shape) *and*
  redundant (the graph already records it). Same discipline as the
  propagation constraint: duties live in charters, ride the plugin, not
  per-repo CLAUDE.md.
- **`depends_on` is heterogeneous by kind** (`trellis/decision-0044` +
  `trellis/decision-0045` combined): a spec → `repo/id@vN`; a decision →
  `repo/adr-id` (append-only; the id *is* the version, no `@`); a design
  artifact → `repo/id@version`; other kinds → their own form.
- **Tests are first-class artifacts with a deps ledger** — frontmatter
  `depends_on` listing the specs (`@vN`) AND decisions they rest on. Tests
  are a *superset* of ACs: behavioral tests derive from a spec's GWT/EARS,
  but technical/e2e tests are governed by a test-strategy *decision*, not a
  spec AC. (Fits `trellis/decision-0045`'s "generalize artifact.")
- **The real graph is a DAG, not a linear chain** — *illustrative, not
  strict* (the maintainer explicitly does not guarantee this topology):
  `(decisions, specs) → tests`; `(decisions, mockups) → specs`;
  `(tests, design-system) → code` (via TDD).
- **Per-role LOCAL duties** (the emergence substrate):
  - `contract-author` (spec writer) — declares the spec's `depends_on` and
    bumps its behavioral version counter (`decision-0045`).
  - `shaper` — declares a decision's `depends_on` and supersedes old
    decisions (append-only; no version).
  - the **test creator** — declares the test deps ledger and maintains it.
    (No explicit role today — executor holds it; see Open questions.)
  - a **reviewer sweep** — notices a stale pin (pin < current) and fires
    the real conformance check. Also a charter duty, not a declared schema.
- **Guardrail (grove#22, carried):** absence of a spec/test is *never*
  evidence code is wrong or should be deleted; a coverage gap is a
  *visible governance gap* (needs a spec/test), not a delete trigger.
- **Two shapes the mechanism handles:**
  - *Separated* (product repos, e.g. math-quest) — spec and code are
    distinct artifacts; the DAG + version pins + conformance check apply as
    above.
  - *Collapsed* (grove itself) — the **charter IS spec + code**; a
    cold-started agent *is* its charter, consumers install charters not
    ADRs. "Conformance" = a *review* that the charter faithfully implements
    its ADR (charters are prose, not test-runnable). adr-0004/0005's own
    executions into charters were the first worked instances.
- **`trellis#25` folds in** — the "conformance-to-upstream sub-agent" it
  asks for already exists as `conformance-reviewer`; this decision wires
  its verdict to the staleness signal, rather than building a new agent.

**Open** (the forks to shape):
1. **The test-creator role** — its own role, or does `executor` absorb
   "declare + maintain the test deps ledger" (it already writes the tests
   under strict TDD, adr-0005)? Interacts with grove#21's parked
   derive-skeletons-from-GWT/EARS idea.
2. **The staleness sweep** — which role runs pin-vs-current and fires the
   conformance check (`conformance-reviewer` / `corpus-reviewer` / new)?
   And *when* — on-change (an upstream bump flags stale downstream) vs.
   standing/periodic?
3. **Emergence's forgotten-dependency soft spot** — is "surfaces as a
   coverage gap when the check runs" (+ role-conformance) enough, or does
   something enforce declaration more actively?
4. **The test deps ledger form** — where it lives (per-file frontmatter? a
   per-package ledger file?) and its exact shape.
5. **The collapsed (charter) case detail** — how "charter conforms to its
   ADR" is checked concretely (a review verdict), and whether a charter,
   being *dual-consumed* (vendored byte-copy AND behavioral), needs both a
   byte-marker and a behavioral one (`decision-0045`'s dual-consumed open
   question, which named charters).

**Parked / downstream (not this decision):**
- The `spec-0001` amendment (`decision-0045`'s follow-on: the version
  field, the `repo/id@version` pin form, the `changes:` forward-pointer
  relation) — a trellis `contract-author` pass.
- Execution-layer `approved` (status vs. gate-outcome) — `trellis#142` +
  `trellis#25`.

## Context

The operational counterpart to `trellis/decision-0045` (the versioning
*primitive*): this decision is the *machinery* that uses it. Full
derivation of the front-loaded points is in kodhama#31's conversation and
grove#34's comment thread. Read `adr-0004` (spec lifecycle), `adr-0005`
(strict TDD + artifact-gated dispatch), and `trellis/decision-0045`
(versioning kinds) as the settled ground this builds on.

## Decision

*(filled as the Open questions converge — not asserted ahead of the
maintainer's calls.)*

## Consequences

*(drafted on convergence.)*
