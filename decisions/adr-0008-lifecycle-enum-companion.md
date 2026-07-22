---
id: adr-0008-lifecycle-enum-companion
type: adr
status: approved  # maintainer's intent act 2026-07-12 ("merge it", on the round-2 revision — recorded in PR #45's approval comment); the #45 merge landed it. This flip records that act (decision-0046); the flip was missed at merge time and corrected post-merge.
depends_on: [adr-0004-spec-lifecycle-and-organization, trellis/decision-0037]
owner: agent
updated: 2026-07-18  # append-only amendment (adr-0018 D5): install target -> .grove/internal/lifecycle.md; prior 2026-07-12 note (-> .grove/lifecycle.md) kept below title
---

# ADR-0008: the swarm carries the lifecycle enum — a dedicated shipped companion, not a README

> **Amendment (2026-07-12, append-only — the maintainer's call during the
> execution pass):** the consumer install target is **`.grove/lifecycle.md`**,
> not `.claude/agents/lifecycle.md`. Wherever this decision's ratified text
> below reads `.claude/agents/lifecycle.md` (Decision items 1–3, AC1), read
> `.grove/lifecycle.md`. Why: `.claude/agents/` is Claude Code's loader
> namespace — installing a non-agent file with corpus frontmatter there rides
> undocumented loader behavior (the execution review's flag); a `.grove/`
> directory is grove's own inert namespace, the same move as trellis's
> `.trellis/` overlay, and eliminates the risk rather than mitigating it.
> The ratified text below is unedited per the append-only rule.

> **Amendment (2026-07-18, append-only — superseded in part by
> `adr-0018` D5, the install-path split):** the lifecycle companion's
> consumer install target moves from `.grove/lifecycle.md` to
> **`.grove/internal/lifecycle.md`**. `adr-0018` D5 splits the consumer
> `.grove/` namespace by **authority**: the grove-authoritative subtree
> (companions, the `check/` runtime, the C1 `enforcement.toml`) lives
> under `.grove/internal/` (copied/regenerated verbatim on update),
> while the consumer-authoritative config (`gates.toml`, `review.toml`)
> keeps the `.grove/` root. Wherever this decision's ratified text and
> the 2026-07-12 amendment above read `.grove/lifecycle.md`, read
> `.grove/internal/lifecycle.md`. The ratified text below is unedited
> per the append-only rule; `adr-0018` is the authoritative record of
> this change.

> **Amendment (2026-07-21, append-only — amended again by
> `adr-0026-thin-vendor-boundary` D7, unconditionally; adr-0026
> Propagation 3):** the lifecycle companion no longer installs into a
> consumer repo at all. Under adr-0026 D7 the companions travel **with the
> fleet in the plugin payload** (`${CLAUDE_PLUGIN_ROOT}/reference/lifecycle.md`;
> canonical `charters/lifecycle.md`), under the single D4 version stamp —
> so wherever this decision's ratified text and the amendments above read a
> consumer install target (`.claude/agents/lifecycle.md` →
> `.grove/lifecycle.md` → `.grove/internal/lifecycle.md`), read
> **plugin-carried, no installed consumer copy**; repo citations switch to
> standard-form ("per the grove lifecycle companion, `plugin@<stamp>`").
> The move is **unconditional** — D7 decided it, not contingent on the CI
> floor (adr-0026 adversary F2). The enum-lives-in-a-companion decision
> itself stands; adr-0008's "no repo restates the enum" rule is explicitly
> held (adr-0026 D7). `adr-0026` is the authoritative record; ratified text
> below unedited per the append-only rule.

## Context

Under the family's "restate nothing" direction (kodhama#29 / draft kodhama-0008), a repo no longer hand-authors the operating model — it inherits it via the plugins. That forces a question grove must answer for its own methodology: **where does the lifecycle enum (`draft → gated → approved → superseded`) live** once each repo stops declaring it in `.trellis/profile.md`?

Homes considered and found wrong:
- **trellis** — the enum is *methodology*, not principle (`trellis/decision-0037`: "statuses are methodology-defined"; the relied-on clause is 0037's surviving part). Not the principles layer.
- **a grove-*repo* declaration** (`profile.md` / a seeded `decisions/README.md`) — grove is grove-managed (self-applied), so the swarm would source the methodology it *is*. Circular, and it *is* the per-repo restatement "restate nothing" removes.
- **"the agents README"** (this draft's prior revision) — **refuted on two independent grounds.** *Factually* (adversary round 2): the README that carries the enum (`charters/README.md:26`) **never ships** — setup copies only `reference/agents/*`; the README that *does* ship (`reference/agents/README.md`, vendored from `.claude/agents/README.md`) is the agent roster and **carries no enum**. The claimed propagation did not exist. *Semantically* (maintainer, 2026-07-12): a README reads as human orientation; the swarm's normative methodology should not live in a README footnote — names should mean what they say.

This ADR resolves the maintainer's shaping call: **a dedicated companion artifact, shipped in the payload.**

## Decision

1. **The enum lives in a dedicated companion: `lifecycle.md`.** Canonical at `charters/lifecycle.md` (beside the charters it accompanies), vendored to `plugins/grove/reference/lifecycle.md`, installed to each consumer's `.claude/agents/lifecycle.md`. It states, once: the state enum (`draft → gated → approved → superseded`), what each state means, who moves an artifact between states — and a *pointer* to the per-type mutability rules (append-only: `decisions/README.md`; revise-in-place: `adr-0004`), which it does not copy.
2. **Setup ships it — one added copy line.** `plugins/grove/skills/setup/SKILL.md` step 2 gains one instruction: copy `reference/lifecycle.md` → `.claude/agents/lifecycle.md` (same header-stripping as the agent files). This **is** new payload machinery — one line — stated honestly rather than pretending an existing channel covers it (the prior revision's error).
3. **`corpus-reviewer` sources the enum from the companion** (`.claude/agents/lifecycle.md` in a consumer; the canonical in grove-self), never from a per-repo `.trellis/profile.md` mapping or `decisions/README.md`. This charter edit rides the three-copy vendored sync.
4. **No repo restates the enum — grove-self included.** The enum-as-set and the four-state prose enumerations are consolidated into the companion and removed from: `decisions/README.md` (frontmatter line `:16` **and** the state-bullets `:23-26` — **preserving the append-only rule at `:28-36`**, a separable clause), `specs/README.md` (line `:17` and bullets `:24-33`), `charters/README.md:26` (replaced by a pointer to the companion; the README stays human orientation), `charters/corpus-reviewer.md:45` (+ both vendored copies), and **`CONTRIBUTING.md`** (its `:21` frontmatter line, `:37-52` state semantics, and `:67-99` lifecycle walkthrough — replaced by pointers to the companion). Each removal leaves a one-line pointer, not silence.
5. **Setup step 5 stops seeding the enum** into a fresh consumer's `decisions/README.md` (SKILL.md:89-96) — it still seeds the append-only rule and store structure. A fresh consumer's enum arrives via the companion (item 2), so `corpus-reviewer`'s lifecycle check works on day one with no per-repo lifecycle section anywhere.
6. **A single shared state enum.** Verified: every grove artifact status ∈ `{draft, gated, approved, superseded}`; no type diverges in labels. Per-type mutability is a separate property, homed where it lives (item 1's pointer); re-homing *it* under restate-nothing is out of scope here. Per-artifact enums rejected (over-granular).

## Considered and rejected

- **Enum in the trellis overlay** — rejected: methodology, not principle (`decision-0037`).
- **Enum in a grove-repo declaration** — rejected: circular for grove-self; it *is* the restatement to remove.
- **The agents README as home** (prior revision) — rejected: factually non-propagating (the enum-bearing README never ships; the shipping README is the roster) and semantically wrong (README = human orientation, per the maintainer). The "no new machinery" virtue it claimed was false anyway.
- **One enum per artifact type / per artifact** — rejected: labels are shared; mutability is a separate, already-homed property. Per-artifact is restatement at a finer grain.

## Consequences

1. `charters/lifecycle.md` created (canonical); vendored to `plugins/grove/reference/lifecycle.md`.
2. Setup SKILL.md step 2 + step 5 amended (copy the companion; stop seeding the enum).
3. `corpus-reviewer` repointed to the companion — across the three-copy sync.
4. The enum restatements in Decision item 4's inventory removed, each replaced by a pointer; append-only preserved.
5. `specs/0001-contributing-guide.md` (the spec governing CONTRIBUTING.md) likely needs a follow-up **revise-in-place spec amendment** — its R3 walkthrough requirement now points at companion-sourced content. Flagged as a follow-up, not silently skipped.
6. **Prerequisite for kodhama-0008's rollout delete step** — the per-repo lifecycle-section deletion cannot run until the companion ships + the `corpus-reviewer` repoint lands, or its check dangles. (grove's own `.trellis/profile.md:46` restatement is deleted in that kodhama-0008 step, not here — noted to keep "grove-self restates nothing" honest about sequencing.)

## Acceptance criteria

- **AC1** `charters/lifecycle.md` exists (canonical), is vendored into the payload, and a fresh `/grove:setup` install lands it at `.claude/agents/lifecycle.md`.
- **AC2** `corpus-reviewer` (all three copies) sources the enum from the companion; its lifecycle check passes on a repo with no per-repo lifecycle section.
- **AC3** No grove-repo file restates the enum-as-set or the four-state prose enumeration outside the companion — the item-4 inventory (including `CONTRIBUTING.md` and both READMEs' bullets) is cleaned to pointers; `decisions/README.md`'s append-only rule is intact.
- **AC4** Setup no longer seeds the enum; a fresh consumer gets the enum only via the companion and a working `corpus-reviewer` lifecycle check on day one.

## Open questions (parked, ≤3)

- **Does the companion eventually absorb the mutability rules too** (append-only / revise-in-place), or stay enum-only with pointers? Out of scope here; follow-up under restate-nothing.
- **The contributing-guide spec amendment** (Consequence 5) — fold into this ADR's execution PR or a separate pass?

## Self-check (gate)

Draft opening grove#44, revised twice: round 1 (F1 propagation/setup-seeding, F2 inventory, F3 append-only home, F4 scope — folded in) and round 2 (**the round-1 fix itself refuted**: the agents-README home conflated the enum-bearing README with the shipping roster README — retargeted to a dedicated shipped companion, one honest setup copy-line added; CONTRIBUTING.md + prose state-bullets ruled into the inventory; the fresh-consumer gap closed by the companion shipping). The companion home also records the **maintainer's shaping call** (2026-07-12): a README is human orientation; the methodology gets a named artifact. Frontmatter well-typed; `depends_on` resolves, none draft; kodhama-0008 remains a Context reference, not a `depends_on`. **Ratified** — the maintainer's intent act (2026-07-12, "merge it" on this revision, recorded in PR #45) is the approval; the merge landed it. The recommended round-3 adversary was **deliberately parked by the maintainer** (session-recorded; the execution PR's conformance review is the downstream verification net). The status flip was missed at merge time and corrected post-merge — recorded honestly rather than backdated. The builder does not grade its own decision.
