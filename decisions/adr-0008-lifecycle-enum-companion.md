---
id: adr-0008-lifecycle-enum-companion
type: adr
status: draft
depends_on: [adr-0004-spec-lifecycle-and-organization, trellis/decision-0037]
owner: agent
updated: 2026-07-12
---

# ADR-0008 (DRAFT): the swarm carries the lifecycle enum — in the agents README that already ships

## Context

Under the family's "restate nothing" direction (kodhama#29 / draft kodhama-0008), a repo no longer hand-authors the operating model — it inherits it via the plugins. That forces a question grove must answer for its own methodology: **where does the lifecycle enum (`draft → gated → approved → superseded`) live** once each repo stops declaring it in `.trellis/profile.md`?

Two homes are wrong, and one is already right:
- **trellis** — the enum is *methodology*, not principle (`trellis/decision-0037`: "statuses are methodology-defined"; the relied-on clause is 0037's surviving part). Not the principles layer.
- **a grove-*repo* declaration** (`profile.md` / a seeded `decisions/README.md`) — grove is grove-managed (self-applied), so the swarm would source the methodology it *is*. Circular, and it *is* the per-repo restatement "restate nothing" removes.
- **the agents README** — `charters/README.md` already declares the enum (`:26`), is vendored to `reference/agents/README.md`, and is **already copied into every consumer's `.claude/agents/README.md` by setup step 2** (`plugins/grove/skills/setup/SKILL.md:32`). It already ships and already propagates.

This surfaced as finding **F2** of the spec-adversary pass on kodhama-0008 (`corpus-reviewer` sources its lifecycle check from the per-repo section, `charters/corpus-reviewer.md:44-46`), and this ADR's own adversary round (below) established the delivery facts.

## Decision

1. **The swarm carries the enum in the agents README.** The single authoritative statement of the lifecycle enum is the artifact-contract in `charters/README.md` (→ `reference/agents/README.md` → each consumer's `.claude/agents/README.md`). It already propagates via setup step 2; no new payload machinery is added. *(A dedicated `reference/lifecycle.md` was considered and rejected — it would need a new setup copy-step; see Open questions.)*
2. **`corpus-reviewer` sources the enum from the agents README**, not from a per-repo `.trellis/profile.md` mapping or `decisions/README.md`. This charter edit rides the **three-copy vendored sync** (`charters/` + `.claude/agents/` + `plugins/grove/reference/agents/` — the payload copy `reference/agents/corpus-reviewer.md` is currently the only enum-as-set restatement that *ships*).
3. **No repo restates the enum — grove-self included.** The enum-as-set is consolidated to the agents README and removed from the other declarations: `specs/README.md:17`, `decisions/README.md:16`, and `charters/corpus-reviewer.md:45` (+ its vendored copy). **Setup step 5 is amended to stop seeding the enum** into a fresh `decisions/README.md` (SKILL.md:89-96) — the agents README carries it. *(`specs/0001-contributing-guide.md` describes the lifecycle as spec content; touching it is a revise-in-place spec amendment, out of this ADR's scope — flagged, not sweept.)*
4. **A single shared state enum.** The state labels are already shared across artifact types (verified: every grove artifact status ∈ `{draft, gated, approved, superseded}`; no type diverges in labels). The per-type **mutability** difference is a *separate* property and stays where it lives: **revise-in-place** in `adr-0004:25`; **append-only** in `decisions/README.md:28` + trellis `spec-0001` §3 (*not* adr-0004 — corrected from the prior draft). Re-homing the mutability rules under "restate nothing" is a **separate concern, out of scope here**; this ADR moves only the enum. Per-artifact enums rejected (over-granular).

## Considered and rejected

- **Enum in the trellis overlay** — rejected: methodology, not principle (`decision-0037`).
- **Enum in a grove-repo declaration** (`profile.md` / seeded `decisions/README.md`) — rejected: circular for grove-self, and it *is* the per-repo restatement to remove.
- **A dedicated `reference/lifecycle.md` companion** — rejected for now: it would not propagate without a new setup copy-step, where the agents README already does. (Revisitable — Open questions.)
- **One enum per artifact type / per artifact** — rejected: labels are shared; the only real per-type difference (mutability) is a separate property, already homed. Per-artifact is restatement at a finer grain.

## Consequences

1. `charters/README.md`'s enum declaration is designated the authoritative source (documented as such); it already ships via setup step 2.
2. `corpus-reviewer`'s charter is **repointed** to source the enum from the agents README — across the **three-copy sync**.
3. Enum-as-set removed from `specs/README.md`, `decisions/README.md` (enum line only — **the append-only rule at `decisions/README.md:28` is preserved**), and `corpus-reviewer` (+ vendored copy).
4. **`setup` SKILL.md step 5 amended** to stop seeding the enum into a fresh `decisions/README.md` (it still seeds the append-only rule / structure; the enum comes from the agents README it also copies).
5. **Prerequisite for kodhama-0008's rollout delete step** — the per-repo lifecycle-section deletion cannot run until this consolidation + the `corpus-reviewer` repoint land, or `corpus-reviewer`'s check dangles.

## Acceptance criteria

- **AC1** `charters/README.md` (→ vendored → installed `.claude/agents/README.md`) is the single authoritative enum statement; it ships to consumers via setup step 2.
- **AC2** `corpus-reviewer` (all three copies) sources the enum from the agents README, not a per-repo section.
- **AC3** The enum-as-set is gone from `specs/README.md`, `decisions/README.md`, and `corpus-reviewer`'s vendored copy — while `decisions/README.md`'s append-only rule remains intact.
- **AC4** Setup no longer seeds the enum into a fresh consumer's `decisions/README.md`; a fresh install carries the enum only via the agents README, and `corpus-reviewer`'s lifecycle check runs with no per-repo lifecycle section present.

## Open questions (parked, ≤3)

- **Agents README vs a dedicated `reference/lifecycle.md`** — the README already ships and is the low-friction choice; a dedicated doc is cleaner conceptually but needs a new setup copy-step. Leaning README; confirm at shaping.
- **Do the mutability rules (append-only / revise-in-place) also need re-homing** under "restate nothing"? They're currently per-repo (`decisions/README.md`) + trellis `spec-0001`. Out of scope here — flag as a follow-up so it isn't lost.
- **The contributing-guide spec's lifecycle mentions** (`specs/0001-contributing-guide.md`) — leave as spec content, or amend separately (revise-in-place)?

## Self-check (gate)

Draft opening grove#44, revised after an independent spec-adversary pass (NEEDS-REVISION → F1 propagation/setup-seeding, F2 incomplete inventory + three-copy sync, F3 append-only-not-in-adr-0004, F4 scope/13-count — all folded in, grounded in a direct read of SKILL.md + the restatement grep). Frontmatter well-typed; `depends_on` (`adr-0004` approved, `trellis/decision-0037` — relied-on clause is its surviving part) resolves, none draft; `kodhama-0008` is a Context *reference*, not a `depends_on`. **Not ratified** — needs the maintainer's shaping + intent act; a re-adversary on this revision is recommended before approval. The builder does not grade its own decision.
