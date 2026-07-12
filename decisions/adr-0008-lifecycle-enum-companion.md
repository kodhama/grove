---
id: adr-0008-lifecycle-enum-companion
type: adr
status: draft
depends_on: [adr-0004-spec-lifecycle-and-organization, trellis/decision-0037]
owner: agent
updated: 2026-07-12
---

# ADR-0008 (DRAFT): the swarm carries the lifecycle enum — a companion to the charters, not a per-repo restatement

## Context

Under the family's "restate nothing" direction (kodhama#29 / draft kodhama-0008), a repo no longer hand-authors the operating model — it inherits it via the plugins. That forces a question grove must answer for its own methodology: **where does the lifecycle enum (`draft → gated → approved → superseded`) live** once each repo stops declaring it in `.trellis/profile.md`?

Two homes are wrong:
- **trellis** — the enum is *methodology*, not principle (`trellis/decision-0037`: "statuses are methodology-defined"; trellis's own native enum was `draft → ratified`). It doesn't belong in the principles layer.
- **a grove-*repo* declaration** — grove is grove-managed (self-applied), so the swarm operating on grove would be sourcing the very methodology it *is*. Circular, and it re-creates the per-repo restatement.

This surfaced as finding **F2** of the spec-adversary pass on kodhama-0008: deleting the per-repo lifecycle section removes the only place the enum is declared, and grove's own `corpus-reviewer` charter sources its lifecycle check from exactly there.

## Decision

1. **The swarm carries its own methodology.** The lifecycle enum lives in a **companion artifact to the agent charters**, shipped in the grove plugin payload — it travels with the charters to every consuming repo, grove included.
2. **`corpus-reviewer` (and any lifecycle-aware charter) sources the enum from the companion** — never from a per-repo `.trellis/profile.md` mapping or a decisions README.
3. **No repo restates the enum — grove-self included.** grove's current ad-hoc enum mentions (the inline naming + the per-repo source pointer in `corpus-reviewer`, and any enum text in `decisions/README.md`) are cleaned like any other consumer's.
4. **A single shared state enum.** The state labels are already shared across artifact types (decisions, specs, charters all use `draft → gated → approved → superseded`). The per-type **append-only vs. revise-in-place** difference is a *mutability* property that already lives in `adr-0004` — **not** a second enum. Per-artifact enums are rejected (over-granular; artifacts of a type share a lifecycle).

## Considered and rejected

- **Enum in the trellis overlay** — rejected: it's methodology, not principle (`decision-0037`).
- **Enum in a grove-repo declaration** (`profile.md` / decisions README) — rejected: circular for grove-self, and it *is* the per-repo restatement "restate nothing" removes.
- **One enum per artifact type** — rejected: the labels are shared; the only real per-type difference (append-only vs. revise) is a mutability rule already in `adr-0004`, not a distinct enum.
- **One enum per artifact** — rejected: over-granular restatement at a finer grain.

## Consequences

1. A **companion artifact** carrying the enum is created and shipped in the grove plugin payload (form/location — see Open questions).
2. `corpus-reviewer`'s charter is **repointed** to source the enum from the companion.
3. grove-self's ad-hoc enum mentions are removed (grove is just another consumer).
4. Scope covers all **12** charters (includes `code-reviewer`, ADR-0007).
5. **Prerequisite for kodhama-0008's rollout delete step** — the per-repo lifecycle-section deletion cannot run until this companion + the `corpus-reviewer` repoint land, or `corpus-reviewer`'s check dangles (notably kodhama, which has no decisions/README fallback).

## Acceptance criteria

- **AC1** A companion artifact in the grove plugin payload states the lifecycle enum once; it ships with the charters.
- **AC2** `corpus-reviewer`'s charter sources the enum from the companion, not a per-repo section.
- **AC3** No grove-repo file restates the enum (inline charter naming, `profile.md`, decisions README all cleaned).
- **AC4** A fresh install carries the enum via the companion; `corpus-reviewer`'s lifecycle check runs with no per-repo lifecycle section present.

## Open questions (parked, ≤3)

- **The companion's exact form/location** — a dedicated reference doc in `plugins/grove/reference/` (e.g. `lifecycle.md`), a section of `charters/README.md`, or a shipped skill? Whatever it is, it must travel in the payload and be charter-referenceable.
- **Does the companion also carry the per-type mutability pointer** (append-only vs. revise, `adr-0004`), or only the state enum? (Leaning: the enum plus a pointer to `adr-0004` for mutability, not a copy.)

## Self-check (gate)

Draft opening grove#44. Frontmatter well-typed; `depends_on` (`adr-0004`, `trellis/decision-0037`) resolves, none draft. Decision + Context + Considered-and-rejected + Consequences + Acceptance criteria + Open questions + Self-check present. Relationship to the draft kodhama-0008 is a *reference* (Context), not a `depends_on` on a draft. **Not ratified** — needs the maintainer's shaping + intent act; an independent spec-adversary pass is recommended before approval. The builder does not grade its own decision.
