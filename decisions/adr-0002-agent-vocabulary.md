---
id: adr-0002-agent-vocabulary
type: adr
status: approved  # ratified by PR #10 merge (2026-07-09)
depends_on: [kodhama-0003-family-naming]
owner: agent
updated: 2026-07-09
---

# ADR-0002: agent, dispatcher, run — official vocabulary; druid/archdruid as sanctioned register, never defining

## Context

`kodhama-0003-family-naming` explicitly kept grove's internal vocabulary
unchanged when the family renamed espalier→grove: *"Unchanged: the
swarm's internal vocabulary (gardeners, furrows, head-gardener)."* This
decision revisits that specific clause, from a maintainer sitting
2026-07-09.

Three separate complaints turned out to be tangled together, and
pulling them apart shaped the decision:

1. **"Gardener" surfaced more than intended.** It was meant as a
   lower-key internal term but became the primary public one — grove's
   own README leads with *"the agents are gardeners — the grove is what
   they tend, and what they are,"* and the LP regenerated at DS v0.2.0
   carries the same framing. Checked first: does `identity/spec.md`'s
   T2 lock (*"spirits are solid, structure is faint: kodhama and wisp
   carry the living spark; grove and trellis are the structure"*)
   already resolve this by making grove's horticultural register
   deliberate rather than drifted? Confirmed with the maintainer: it
   clarifies *why* grove leans horticultural, but doesn't resolve the
   actual complaint — the term still surfaced more prominently than
   intended.
2. **"head-gardener" is the one purely-metaphor-coded name** in a team
   where every other role is named for what it does (`executor`,
   `shaper`, `contract-author`, `validator`, …). In an agentic-team
   context where roles are otherwise self-describing, this reads as
   unclear rather than charming — a separate complaint from (1), about
   role clarity, not lore.
3. **A druid-lore direction exists, tried once already, and left no
   trace.** The maintainer had already brainstormed (`gardener`→informal
   `druid`, `head-gardener`→official `warden`/informal `archdruid`) in
   an untracked Claude Design thread. Exhaustively searched before this
   sitting — every branch, every commit message, and the local
   filesystem, across kodhama/grove/wisp/trellis/design-system and
   math-quest — and confirmed **zero trace survived anywhere**. This
   ADR is that idea's first durable record.

## Decision

1. **`gardener` → `agent`** (or **`grove agent`** where disambiguating
   from another product's agents) is the official collective noun for
   an instance of one of grove's chartered roles. Chosen over a new
   invented word or a full `druid` rename: flattest option, requires no
   lexicon, and grove's own prose already interchanges "gardener" with
   "role"/"agent" throughout — this promotes what was already half
   there rather than inventing something new.
2. **`head-gardener` → `dispatcher`** is the official name for the
   classify/sequence/findings-ledger coordinator role. Chosen because
   grove's own charter already titles this behavior "Dispatch contract"
   and "Dispatch and workflows" — again a promotion, not an invented
   term. **`conductor` was considered and rejected**: it is already
   load-bearing at the kodhama org level (the cross-repo orchestrator
   role, `conductor/` seat) — reusing it one layer down for grove's
   per-run coordinator would collide two genuinely different scopes.
   `warden` (the maintainer's original placeholder) is superseded once
   the actual complaint was identified as role-clarity, not lore —
   `dispatcher` answers that complaint directly.
3. **`furrow` → `run`.** Verified before deciding: `run` is already the
   dominant *technical* term — wisp's own `GroveEvent` schema field is
   `run: string; // run/furrow instance id`, the CLI flag is
   `--run <run-id>`, and grove's own head-gardener charter uses "run"
   throughout (*"sequence a run," "the run's record," "a run from
   silently dying"*) — `run-resumer` is built on "run," not "furrow" —
   without using "furrow" even once. "Furrow" was already the
   decorative gloss on top of "run" as the real, load-bearing word;
   this retirement costs nothing structurally, only prose.
4. **`druid` / `archdruid` — sanctioned, real, encouraged vocabulary,
   never the defining or operative term.** Welcome in conversation and
   marketing copy (a passing LP aside, casual explanation); never in a
   charter's or decision's own definitions, and never anywhere
   machine-read (file names, frontmatter, CLI flags — those always use
   the real role name or `agent`/`dispatcher`). `archdruid` pairs with
   `dispatcher` the same way `druid` pairs with `agent`. The concrete,
   worked rule (with positive/negative examples) lands in `CLAUDE.md`,
   not restated here — one home per kind of information; this ADR
   records *why*, `CLAUDE.md` carries the actionable *how*.
5. **Individual role names are unchanged**: `executor`, `shaper`,
   `contract-author`, `spec-adversary`, `conformance-reviewer`,
   `validator`, `run-resumer`, `propagation-remediator`,
   `corpus-reviewer`, `divergent-researcher` all stand. Only the
   collective noun, the one metaphor-coded role, and the work-unit noun
   change.

## Considered and rejected

- **Keep "gardener" as-is**, resting on `identity/spec.md`'s
  structure/spirit split — checked directly, doesn't resolve the actual
  complaint (over-surfacing), only explains why grove leans
  horticultural in the first place.
- **Full "druid" rename everywhere** — rejected; maintainer explicitly
  unsure it reads well to an external audience universally. The
  agent/dispatcher-official + druid-conversational split gets the lore
  payoff without that risk, and costs nothing if it's wrong (druid was
  never load-bearing to begin with).
- **`conductor`** for the dispatcher role — rejected, kodhama-level
  collision (above).
- **`warden`** — superseded once the real complaint (role clarity, not
  lore) was named; `dispatcher` fits it more directly and was already
  present in the charter's own language.

## Consequences

- **Partially supersedes `kodhama-0003-family-naming` §Rename scope
  point 4** ("Unchanged: the swarm's internal vocabulary"). A
  forward-pointer annotation lands on that decision in the kodhama repo
  alongside this ADR, per the append-only rule — its ratified text is
  not rewritten.
- **`CLAUDE.md` gains a "Naming register" section** (drafted and
  maintainer-approved in this sitting) — the actionable rule + worked
  examples for any agent working in this repo.
- **Execution is a separate, larger wave — not part of this decision's
  own merge.** This sweep is bigger than the grove/wisp org rename: it
  touches prose throughout all eleven charters and `.claude/agents/`
  files, `README.md`, the plugin's `setup`/`remove` skills and vendored
  `reference/` payload, the just-regenerated LP
  (`docs/index.html` + `docs/lp-content.md`), and every consuming
  repo's installed copy (wisp, kodhama, trellis, design-system,
  math-quest — their `CLAUDE.md` managed blocks and composed
  `.claude/agents/*.md` files). None of that is touched by this PR;
  it's the follow-up conductor wave this decision authorizes.
- **Historical records keep old vocabulary**, append-only: already-
  ratified decisions, past conductor briefs, and ADR-0030-lineage
  quotes are not rewritten. This decision governs forward vocabulary
  only.

## Acceptance criteria

- **AC1** `CLAUDE.md` carries the Naming register section, matching
  what the maintainer approved in this sitting.
- **AC2** A forward-pointer annotation lands on
  `kodhama-0003-family-naming`'s point-4 clause in the kodhama repo.
- **AC3** This PR itself does not sweep any charter, README, LP, or
  installed-consumer file — confirmed by diff scope at merge.
- **AC4** The ten individually-named roles (`executor` through
  `divergent-researcher`) are unchanged — explicit scope boundary, not
  silently expanded later.
- **AC5** The execution wave (when dispatched) sweeps: grove's own
  charters/agents/README/plugin/LP, then every consuming repo's
  installed copy — checkable against this list.

## Open questions (parked, ≤3)

- Exactly which public surfaces get a "fun annotation" mention of
  druid/archdruid, and how many — left to whoever executes the LP/README
  copy, not mandated here.
- Does grove's own A4 precedent term "self-furrow" (its first completed
  self-hosted conformance run) become "self-run" going forward, and does
  that already-landed historical PR/artifact get touched? Leaning:
  historical stays per append-only, forward mentions use "self-run" —
  not yet confirmed explicitly, flagged rather than assumed.

## Self-check (gate)

Load-bearing claims verified directly this sitting, not from memory:
`identity/spec.md` read in full before concluding it doesn't resolve
the complaint; `kodhama-0003`'s exact clause quoted verbatim; wisp's
`protocol.ts` schema and the head-gardener charter both grepped to
confirm `run` already dominant and `furrow` absent from the charter
entirely; the druid/archdruid brainstorm's absence from every repo
confirmed by an exhaustive branch+commit-message+filesystem sweep, not
assumed; the `conductor` collision checked against kodhama's own
CLAUDE.md/`conductor/` usage before rejecting it. Alternatives recorded
so they aren't re-litigated. Scope boundary (AC3, AC4) stated explicitly
so this decision can't be read as silently authorizing the sweep it
defers. Promote `draft → gated`. `approved` = human merge of the
ratification PR.
