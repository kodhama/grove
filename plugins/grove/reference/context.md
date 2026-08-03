<!-- GENERATED — DO NOT EDIT; canonical-source: charters/context.md; sha256: c5247f4110cb6cfbdf905704dfcfde6da7179b40a4b1986f6a169acc4dad8cf9 -->

# context — the read model, stated once

> Provenance: created per `adr-0050-read-model-and-context-budget`
> (2026-08-03), which resolved what a cold-started role loads once no
> charter implies its own answer. Canonical here, shipped in the plugin
> payload at `plugins/grove/reference/context.md` under the single
> version stamp (`adr-0026` D7). Every other statement of the read
> model, in grove itself or in a consuming project, is a pointer to
> this file, never a copy.

> **This file is not an agent role.** It has no pipeline stage and is
> never dispatched. It is the methodology statement every reading role
> sources instead of a per-charter restatement.

## The read model

A cold-started role's working context is exactly four things:

1. **Its charter projection** — the role definition it was dispatched
   with.
2. **The subject artifact** — read whole; the artifact-gated dispatch
   floor (`adr-0005` D2) is untouched by this model.
3. **The subject's `depends_on` targets, at depth exactly 1** — no
   transitive closure, filtered to **current-truth types** (`spec`,
   `charter`, config/companion carriers) in `gated` or `approved`
   status. `draft` targets are never consumable; `superseded` targets
   are archive and never load.
4. **The named config carriers** the role's charter specifies —
   `.grove/config.toml` and its tokens, the test-deps ledger where the
   charter names it.

Nothing else is preloaded. A hop past depth 1 is a choice the role
makes on demand for a specific question, never a default.

## Decisions are consulted, never preloaded

A `type: adr` target in `depends_on` is rationale, not current truth.
A role reads a decision on demand to recover *why* something is the
way it is — never to reconstruct *what* the current behavior is.
Current truth lives in the current-truth surfaces: specs, charters,
companions, config. A role that finds the surfaces insufficient — an
operative rule reachable only by reading a decision — surfaces that
gap as a finding; the cure is the self-containment duty below, never a
bigger read.

## `depends_on` is a maintenance edge, not a reading list

The edge's meaning is unchanged from `relations.md`: genuine coupling,
directional flow, drift-bearing — the `validator` walks it outward
from a changed artifact exactly as before. What this file settles is
that the edge is **not** a preload manifest. The maintenance graph
(what must be reconciled when something changes) and the read path
(what a role loads to act) are different projections of the same
frontmatter, and only the read path is bounded by this model.

## The self-containment duty

A charter or spec states every rule its reader must apply — inline, or
via a named companion for shared grammar. Citing a decision is
provenance, never delegation of operative content. An artifact that
delegates an operative rule to a decision body is defective under this
model and owes an inline statement or a companion pointer.

## The budget

**Context multiplier** := words loaded under this model ÷ subject
words. Target: **p50 ≤ 1.5×** across dispatched tasks. Any single
dispatch above **3×** is a loud anomaly: the role reports it as a
finding naming what forced the load. The budget is a canary, never a
block — no dispatch is refused for exceeding it, and no artifact is
truncated to meet it. Baselines and the probe set live with the epic
record (`grove#197`), re-measured per `adr-0054`.
