---
id: adr-0003-managed-block-routing-rule
type: adr
status: gated
depends_on: [kodhama-0007-one-render-many-copiers]
owner: agent
updated: 2026-07-10
---

# ADR-0003: managed block is a conditional W1–W6 routing rule, not an identity claim; the block write is verified; upsert-script trigger armed

## Context

`/grove:setup` step 6 composed this block into the consuming project's
`CLAUDE.md`:

> This project is **grove-managed**: work items run as grove runs,
> sequenced through the chartered agent roles in `.claude/agents/`
> (\<ROLES_LIST\>).

That is a whole-session **identity claim**: it asserts what the project
*is*, for every interaction — claude-flow's ambient-takeover pole, in
miniature. Grove's actual desired behavior (issue
[#16](https://github.com/kodhama/grove/issues/16), from the 2026-07-09
routing survey) is narrower on both sides:

- **Inferred workflow dispatch must be reliable.** The ecosystem is
  bimodal: wshobson/agents and VoltAgent ride description-only routing
  for *specialists* but make *workflow* dispatch explicit commands;
  BMAD is explicit-only; claude-flow is full ambient takeover. Nobody
  achieves inferred workflow dispatch from agent descriptions alone —
  and description-only routing is documented flaky:
  [anthropics/claude-code#5688](https://github.com/anthropics/claude-code/issues/5688)
  ("Subagent Selection Failure: Primary Agent Ignores Proactive
  Directive" — a description carrying "use this agent proactively, you
  must use it" was ignored; "the primary agent never picks it up").
  Anthropic's own guidance ("include phrases like 'use proactively'")
  is a nudge, not a guarantee. So the always-on CLAUDE.md rule is
  load-bearing — silent agents are the unreliable pole.
- **Grove must never hijack unrelated conversation.** A trivial ask, a
  question, ordinary conversation — none of these are work items, and
  an identity claim gives the model no licence to leave them alone.

Separately, [kodhama-0007-one-render-many-copiers](https://github.com/kodhama/kodhama/blob/main/decisions/0007-one-render-many-copiers.md)
established the family's writer discipline after the trellis#112
clobber incident: writers copy, paste between markers, and **verify** —
and grove's application section names exactly this follow-up: "Its
managed-block write gains a verification step and an armed trigger (own
issue + its own grove decision; linked, not blocked)." This decision is
that record. Grove already conforms on content (vendored canonical
agents, mechanically copied); the block write was its one remaining
unverified file edit.

## Decision

1. **The block becomes a conditional routing rule with a quiet
   default.** New template (markers and `grove plugin@<SHA>` stamp
   unchanged):

   > Work items matching a grove workflow (W1–W6 — e.g. a bug report →
   > the bug pipeline, a research ask → divergent research) run as
   > grove runs, sequenced through the chartered agent roles in
   > `.claude/agents/` (\<ROLES_LIST\>). Anything else — conversation,
   > trivial asks, out-of-scope questions — proceeds normally.

   Both halves are load-bearing: the first makes workflow dispatch an
   always-on inference rule (not a hope pinned on agent descriptions),
   the second makes non-work interaction explicitly out of grove's
   reach.
2. **The block write is verified.** Setup step 6 gains a post-write
   check: (a) exactly one `grove:begin` and one `grove:end` marker
   exist; (b) a diff against a pre-write copy shows no change outside
   the markers. Failure handling is honest: restore and re-attempt
   once, then stop and show the user the pre-write copy, the diff, and
   the intended block — never leave a mangled `CLAUDE.md` silently in
   place. This applies kodhama-0007's copy/paste/**verify** writer
   discipline to grove's one remaining file edit.
3. **Trigger armed (condition → action):** *first observed block-write
   misfire* → *replace the prose edit in setup step 6 with a bundled
   deterministic upsert script* (`${CLAUDE_PLUGIN_ROOT}/…` — a real
   script the skill invokes, not prose an LLM re-executes; the caveman
   `${CLAUDE_PLUGIN_ROOT}` pattern kodhama-0007 verified). The skill's
   failure-handling text points here, so whoever hits the misfire trips
   over the trigger where it fires. Deliberately **not built now**: the
   block write has one writer and no observed failure —
   smallest-thing-first.

## Considered and rejected

- **Keep the identity claim.** Over-claims scope (every session,
  every interaction) — the claude-flow pole grove explicitly rejects.
- **Drop the block and rely on agent descriptions alone.** The
  unreliable pole — #5688 documents proactive-directive descriptions
  being ignored outright.
- **Build the upsert script now.** No observed failure, one writer;
  kodhama-0007's own grove application asks for "a verification step
  and an armed trigger," not the script. Building it unfired would be
  process ahead of evidence.

## Consequences

- `plugins/grove/skills/setup/SKILL.md` step 6 carries the new
  template + the verification step + the trigger pointer;
  `plugins/grove/skills/remove/SKILL.md`'s paraphrase of the block
  ("the grove-managed declaration") updates to match. Grepped the repo
  for other homes of the identity-claim wording: none remain
  (adr-0002's "managed blocks" mention is structural, not the claim).
- **Existing consumer installs keep the old wording until their next
  `/grove:setup` re-run** — the marker-replace path is idempotent and
  picks up the new template then. No proactive refresh wave is mandated
  by this decision.
- When the trigger fires, the upsert-script work supersedes point 2's
  prose verification (the script subsumes it); it does not reopen
  point 1.

## Acceptance criteria

- **AC1** Setup step 6's template is the conditional routing rule above
  — matches on both halves (W1–W6 condition, quiet default), with
  `grove:begin`/`grove:end` markers and the `grove plugin@<SHA>` stamp
  byte-identical to before.
- **AC2** Step 6 carries the post-write verification: exactly-one-marker
  check + nothing-outside-markers diff, with the restore/re-attempt/stop
  failure handling stated.
- **AC3** The trigger is recorded here as condition → action, and the
  skill's failure handling points at this decision by id.
- **AC4** `grep -rn "grove-managed\|work items run as grove runs" --include="*.md" .`
  returns no live template or paraphrase — only this decision's own
  historical quotes.
- **AC5** No upsert script ships in this change (the trigger is armed,
  not fired).

## Open questions

- Which existing consumer installs (wisp, kodhama, design-system, …)
  get a proactive block refresh vs. waiting for a natural
  `/grove:setup` re-run — left to the maintainer; nothing here forces
  a wave.
- The upsert script's exact shape (language, arg contract, how it
  reports) — deferred to the work the trigger dispatches, on first
  misfire.

## Self-check (gate)

Verified directly this sitting: anthropics/claude-code#5688 fetched and
quoted (title and "never picks it up" body text match the survey's
claim); kodhama-0007 read in full — its grove-application sentence
quoted verbatim above; the repo grepped for every home of the old
wording (two found, both updated in the ratifying PR; adr-0002's
mention checked and found structural). Taken from issue #16's
2026-07-09 routing survey **without independent re-verification here**:
the ecosystem-bimodality characterization (wshobson/VoltAgent/BMAD/
claude-flow) — cited to the issue, which carries the survey links.
Alternatives recorded with reasons; ACs are pass/fail; the trigger is
condition → action with its firing surface named. Promote
`draft → gated`. `approved` = human merge of the ratifying PR.
