---
id: adr-0007-code-reviewer-agent
type: adr
status: gated  # self-checked 2026-07-12; approval = human PR merge, never set by hand
depends_on: [adr-0002-agent-vocabulary, adr-0005-tdd-and-artifact-gated-dispatch]
owner: agent
updated: 2026-07-12
---

> Shaped interactively with the maintainer (2026-07-12), in three
> turns of dispatch-session Q&A on the same canvas: (1) the ask — a
> code-quality reviewer independent of the `conformance-reviewer`, no
> hardcoded tech stack, the "agent builder" skill explicitly out of
> scope; (2) the maintainer resolved the drafted open calls — gate mode
> as a **severity-gated hard gate** (their own model, not one of the
> drafted options: "that's how most human code reviews work anyway"),
> stage 4½ shared with the conformance gate, the built-in code-review
> skill as one instrument not a mandate, and the
> name/cold-start/read-only bundle resolved by non-objection; (3) the
> maintainer confirmed the full gate package as drafted — the
> objective-harm anchor, the loud-not-absolute override, and the
> severity grammar, including the shaper-added overall verdict grammar
> and the "read-only" (not "report-only") framing, both surfaced
> explicitly before confirmation. Gated: self-checked below, awaiting
> human ratification — the PR merge is the approval act
> (`decisions/README.md`); nobody sets `approved` by hand.
>
> **Research-skip record (stage 1):** Stage-1 research skipped: stable,
> well-documented domain; open questions are grove-internal design, not
> landscape; bounded prior-art check (built-in code-review skill,
> community reviewer agents) folded into shaping.

# ADR-0007: `code-reviewer` — an independent, severity-gated code-quality review, stack-agnostic by placeholder, alongside the conformance gate

## Decision

1. **Charter a new role, `code-reviewer` — the independent code-quality
   review.** It answers a question no current role owns: **"is this good
   code, regardless of the contract?"** — where the
   `conformance-reviewer` asks "does it match the contract?". Keeping
   the two separate keeps both charters sharp: conformance judges
   against the approved upstream and explicitly not against taste;
   quality judges the code itself and explicitly not the contract.

2. **Stack-agnostic via the existing placeholder door** (charters
   never hardcode a project-specific value — `charters/README.md`).
   The role judges against the consuming project's own declared sources
   of truth, in priority order: the project's conventions doc /
   CLAUDE.md (placeholder: `<CONVENTIONS_PATH>`), its lint/formatter
   configuration and command (`<LINT_CMD>`), an optional project
   quality rubric (`<QUALITY_RUBRIC_PATH>`), and the idioms of the
   surrounding code. Where a project declares nothing, the role falls
   back to language-agnostic fundamentals — duplication, dead code,
   misleading names, error-handling gaps, complexity without cause,
   test quality — and **flags the absence of declared conventions as a
   finding** rather than inventing taste.

3. **A severity-gated hard gate, pre-merge** (the maintainer's own
   model, 2026-07-12; guardrails and grammar proposed in the dispatch
   session and **maintainer-confirmed the same day**): every finding is
   graded by severity; findings at the top tiers **block** the gate,
   everything below is advisory — blocking vs. non-blocking comments,
   the shape of most human code review.

   - **Objective-harm anchor for the blocking tiers.** Only findings
     with demonstrable harm can be graded into a blocking tier —
     correctness defects, security exposure, data-loss/resource-leak
     risk, broken error handling, misleading behavior. Taste-class
     findings (naming, style, structure, idiom) are capped at the
     advisory tiers **by construction**, regardless of how strongly the
     reviewer feels. This preserves the shaping draft's original
     principle — taste never blocks a merge — while giving the gate
     real teeth on defects.
   - **Loud, not absolute.** A block is overridable by the human with
     an explicitly recorded rationale (grove's human-decides model
     holds): the gate forces the conversation, it does not remove the
     human's authority.
   - **Severity grammar** (tier names, blocking threshold, and anchor
     fixed here; tier *definitions* belong in the charter, at
     execution): finding tiers **`severe / high / medium / low`**,
     **blocking ≥ `high`**, with `severe` and `high` reachable only
     through the objective-harm anchor above. Overall verdict grammar,
     matching grove's constrained-verdict style (cf. `spec-adversary`'s
     `APPROVE-READY / NEEDS-REVISION / UNSOUND`):
     **`BLOCK / PASS-WITH-ADVISORIES / CLEAN`** — `BLOCK` iff any
     finding is ≥ `high`; the grammar leaves no room for a vague middle
     verdict.

4. **Runs alongside the `conformance-reviewer` at stage 4½**
   (maintainer-resolved, 2026-07-12): same input (the finished build),
   independent questions, can run in parallel; findings feed the same
   dispatcher findings ledger.

5. **Cold-started, stateless, read-only** (resolved by maintainer
   non-objection in the Q&A, covered by the 2026-07-12 confirmation):
   all context travels through the change under review plus the
   project's declared quality sources; it judges and reports, it does
   not fix — like the `conformance-reviewer`, a gate can be read-only.

6. **The charter charters the *frame*, not the technique.** Claude Code
   ships a built-in `/code-review` skill (diff review for correctness
   bugs and reuse/simplification/efficiency cleanups, severity-graded
   findings). Grove's charter therefore does not re-describe how to
   review code; it charters what the runtime does not provide — the
   **independence** (never the builder), the **sequencing** (pre-merge,
   alongside conformance), the **standards source** (the project's
   declared rules, per item 2), and the **gate-and-reporting contract**
   (the severity grammar of item 3: which tiers block, the
   objective-harm anchor, the recorded-override path, findings into the
   ledger). The built-in skill is **one available instrument**
   (maintainer-resolved, 2026-07-12), not a mandate — the role's
   contract stands without it, keeping the charter portable to
   runtimes/versions that lack it.

## Context

**The gap: code quality currently has no home.** Verified against the
charters this sitting, not assumed:

- `conformance-reviewer` explicitly excludes quality: *"Judge against
  the approved upstream, not your taste"*
  (`charters/conformance-reviewer.md` §Boundaries); its agent
  definition is blunter still — *"You are not here to improve the code
  or to relitigate the spec"* (`.claude/agents/conformance-reviewer.md`).
  A change can be sloppy yet fully conform, and today that passes the
  only pre-merge gate.
- `validator`'s per-PR critique is **post-merge** and lightweight by
  charter: *"A lightweight pass on every merged change … advisory, not
  a gate (mostly automatic)"* (`charters/validator.md` §Method 1). A
  glance after the fact, not a review before it.
- `executor`'s refactor step (red → green → **refactor**,
  `charters/executor.md` §Method 2) is the builder grading its own
  work — exactly the pattern the conformance gate exists to break
  (*"Hand off to the conformance-reviewer — you do not grade your own
  work"*, §Method 5), except nobody independent receives the *quality*
  half of that handoff.

**The boundary that keeps both charters sharp.** Conformance-reviewer:
"does it match the contract?" Code-reviewer: "is it good code,
regardless of the contract?" Two independent questions about the same
build — which is also why they can run in parallel (Decision 4).

**Prior art (bounded check, folded into shaping — see the research-skip
record above).** The built-in `/code-review` and `/security-review`
skills mean part of "how to review code" is a runtime capability, not
something a charter needs to author. This reframes the role: grove
charters the independence, sequencing, standards-source, and
gate-and-reporting contract *around* a capability the runtime partially
provides (Decision 6).

**Naming.** `code-reviewer` follows adr-0002's principle — every role
named for what it does — and collides with nothing: the existing
reviewer roles are `conformance-reviewer` (contract gate) and
`corpus-reviewer` (artifact-record audit). Proximity to the built-in
`/code-review` skill name is a feature, not a collision: the role wraps
that territory deliberately.

**Stage label (Decision 4, for the record).** The stage number encodes
pipeline *position* (after the build, before merge), not uniqueness;
two independent questions about the same build share 4½ honestly, where
a new 4¾ label would falsely imply sequencing. Precedent for a
half-stage exists (`spec-adversary` at 3½); two roles at one number is
new but says exactly what happens — they run in parallel. Cost
accepted: README's "one per stage" sentence is reworded (it changes
anyway — the count moves to twelve).

## Considered and rejected

- **Extend `validator`'s per-PR critique instead of adding a role** —
  rejected: `validator` is post-merge and reactive by charter — its
  critique runs on *merged* changes and its audits fire on named
  triggers, never as a standing pre-merge review. Stretching it
  pre-merge muddies a clean role to avoid adding an honest one.
- **Fold quality into the `conformance-reviewer`** — rejected: its
  sharpest boundary is *"judge against the approved upstream, not your
  taste"*; adding taste to its remit blunts the gate that boundary
  keeps trustworthy, and entangles a gating verdict with an advisory
  one.
- **A stack-specific quality rubric shipped in the charter** — rejected
  by the maintainer's constraint (no hardcoded stack) and by the
  charter contract itself (`charters/README.md`: written to be
  cold-started in *any* consuming project). The stack-specific path is
  the parked agent-builder direction, not this charter.
- **Pure advisory mode (the shaping draft's original recommendation
  for gate mode)** — rejected by the maintainer (2026-07-12) in favor
  of stronger teeth: report-only findings the human weighs at merge.
  The original anti-gate rationale — taste should never block a merge,
  and judgment-based verdicts invite rubber-stamping or gridlock when
  made blocking — is honestly recorded, and is addressed rather than
  overridden by the chosen model: the objective-harm anchor keeps
  taste-class findings structurally incapable of blocking, so what
  blocks is demonstrable harm, not judgment calls.
- **The middle dial (advisory + acknowledge-to-merge on top-tier
  findings)** — rejected with the above: the maintainer chose a real
  gate over an acknowledgment ritual; the loud-not-absolute override
  (recorded rationale) provides the human-authority escape hatch the
  middle dial was reaching for, with more teeth.
- **A new stage label (4¾ or similar) instead of sharing 4½** —
  rejected: preserves one-role-per-stage but falsely implies the
  quality review runs *after* conformance, which the design does not
  require.
- **Mandating/wrapping the built-in `/code-review` skill** — rejected:
  couples a portable charter to one runtime's feature set, and the
  skill does not know the project's declared conventions — the
  standards-source contract is needed on top either way.
  **Ignoring it** — also rejected: forgoes a real capability and
  invites the charter to re-describe generic code review.

## Consequences (on approval; execution is a follow-up, not this PR)

- **`charters/code-reviewer.md`** is authored (plus its
  `.claude/agents/` and `plugins/grove/reference/agents/` copies), with
  the placeholders from Decision 2 and the tier definitions from
  Decision 3 — a separate execution step after this decision is
  approved, not part of this decision's own merge.
- **`README.md` team table** gains a row —
  `code-reviewer | 4½ | code-quality gate vs. the project's own declared standards; severity-graded, blocking ≥ high (objective harm only), rest advisory; read-only | yes`
  — and the team prose updates: **eleven roles becomes twelve**, and
  "one per stage" is reworded per Decision 4.
- **`dispatcher` charter W1** adds the role alongside the conformance
  gate with gate semantics ("`executor` → conformance gate ∥
  code-review gate → HUMAN merge"): a `BLOCK` verdict returns the
  change to the `executor` like a conformance `FAIL`; advisory findings
  ride to the human merge in the findings ledger; a human override of a
  `BLOCK` is recorded with its rationale, never silent.
- **`plugins/grove` setup skill** offers the new role in its composing
  interview and resolves its placeholders (default install count moves
  to twelve).
- **`executor`'s charter is unchanged**: refactor stays in its TDD
  loop; what changes is that the quality of the result now gets an
  independent pre-merge gate.
- No existing decision is superseded; this adds a role, it overturns
  nothing.

## Acceptance criteria (for the execution wave this decision authorizes)

- **AC1** `charters/code-reviewer.md` exists (+ both copies), stating:
  the quality-vs-contract boundary one-liner; the standards-source
  priority order with placeholders `<CONVENTIONS_PATH>`, `<LINT_CMD>`,
  `<QUALITY_RUBRIC_PATH>` (optional); the no-declared-conventions
  fallback with absence-as-finding; the read-only boundary; and cites
  `adr-0007`.
- **AC2** The charter carries the gate contract in full: the severity
  grammar (`severe / high / medium / low`, tier definitions authored
  there), the blocking threshold (≥ `high`), the objective-harm anchor
  (taste-class findings capped at advisory by construction), the
  overall verdict grammar (`BLOCK / PASS-WITH-ADVISORIES / CLEAN`), and
  the human-override path (recorded rationale, never silent).
- **AC3** The charter contains no tech-stack-specific noun (language,
  framework, linter brand) outside placeholder examples — checkable by
  grep, same discipline as the lift's acceptance grep.
- **AC4** `README.md` team table carries the twelfth row and the team
  prose count/one-per-stage wording is updated.
- **AC5** `dispatcher.md` W1 names the role at the conformance-gate
  position with the gate semantics above (BLOCK → back to `executor`;
  advisories → ledger → human merge; override recorded); the
  findings-ledger contract covers its findings.
- **AC6** The plugin setup skill offers the role and resolves its
  placeholders honestly ("none exists yet" allowed, per the standing
  interview contract).
- **AC7** The agent-builder skill appears nowhere in the executed
  charter — out-of-scope boundary held, not silently expanded.

## Open questions (parked, ≤3)

- **The "agent builder" skill** — detect a consuming project's stack,
  interview the user, and wire up a stack-*specific* reviewer in the
  consumer project. Explicitly out of scope of this decision by the
  maintainer's own framing; recorded here as the future direction the
  stack-agnostic placeholder design deliberately leaves the door open
  for. Needs its own shaping (it is a plugin/skill feature, not a
  charter).
- **`validator` per-PR-critique overlap.** Once a pre-merge quality
  gate exists, does `validator`'s post-merge "lightweight pass on
  every merged change" shrink or retire? Leaning: leave it — it is
  nearly free and post-merge remains a distinct vantage — but not
  decided here; revisit on evidence of redundant findings.

## Self-check (gate)

- **Frontmatter**: `id`/`type`/`status`/`depends_on`/`owner`/`updated`
  present, well-typed; `id` kebab-case and type-prefixed. PASS.
- **`depends_on` resolution**: `adr-0002-agent-vocabulary` and
  `adr-0005-tdd-and-artifact-gated-dispatch` both resolve in this repo
  and are `status: approved` — a `gated` artifact consuming `approved`
  ones is legal (directional flow holds). adr-0002 is load-bearing for
  the naming claims (roles named for what they do; role list); adr-0005
  for the independence pattern this extends (the builder does not grade
  itself; gate-at-review). PASS.
- **Charter quotes verified against source this sitting, not from the
  shaping brief**: "Judge against the approved upstream, not your
  taste" (`charters/conformance-reviewer.md` §Boundaries); "You are not
  here to improve the code or to relitigate the spec" — confirmed to
  live in `.claude/agents/conformance-reviewer.md`, *not* the canonical
  charter, and cited to the file it is actually in; "A lightweight pass
  on every merged change" / "advisory, not a gate (mostly automatic)"
  (`charters/validator.md` §Method 1); red → green → refactor and "Hand
  off to the conformance-reviewer — you do not grade your own work"
  (`charters/executor.md` §Method 2 and 5); `spec-adversary`'s verdict
  grammar and its 3½ half-stage precedent, and `conformance-reviewer`'s
  4½, read from their charter titles. PASS.
- **README claims**: "eleven roles in all" and "seven agent roles, one
  per stage" read directly from `README.md` §The team before claiming
  the twelve-roles reword; the eleven-row table confirmed (so the new
  row is the twelfth). PASS.
- **Placeholder-pattern claim**: `charters/README.md` §The placeholder
  door read directly — angle-bracketed placeholders, "never hardcodes a
  project-specific value" — before resting Decision 2 on it. PASS.
- **Constrained-verdict-style claim**: `charters/dispatcher.md`
  §Adopted mechanics ("Constrained verdict grammars for every
  verifier") read directly before citing it for the
  `BLOCK / PASS-WITH-ADVISORIES / CLEAN` grammar. PASS.
- **Name collision**: repo-wide grep for reviewer-role names —
  `code-reviewer` unused as a role name; existing reviewer roles are
  `conformance-reviewer` and `corpus-reviewer`. PASS.
- **No stack-specific noun**: final text grepped — no language,
  framework, or linter brand appears; "Claude Code" and the
  `/code-review` skill are runtime references (the thing Decision 6 is
  *about*), not tech-stack nouns, and the charter itself (AC3) is held
  to the stricter grep. PASS.
- **Naming register** (`adr-0002` / `CLAUDE.md`): defining text uses
  `agent`/role names throughout; the conversational register term
  ("druid") appears nowhere in this ADR except this check line naming
  it. PASS.
- **Open questions count**: 2, within the ≤3 convention. PASS.
- **Required body sections**: Decision, Context, Considered and
  rejected, Consequences, Acceptance criteria, Open questions,
  Self-check — present, matching sibling ADRs (`adr-0002`, `adr-0005`,
  `adr-0006`). PASS.
- **Append-only discipline**: new artifact; in-place revision happened
  only while `draft` (a live canvas — append-only binds ratified
  decisions); no ratified decision superseded. PASS.
- **Human-approval boundary**: intent decided by the maintainer across
  three recorded turns (2026-07-12) — the ask, the Q&A resolutions
  (gate mode/stage/skill; the name/cold-start/read-only bundle by
  non-objection), and the explicit confirmation of the full gate
  package including the two shaper-added judgment calls (overall
  verdict grammar; "read-only" framing), both surfaced before
  confirmation. Promote `draft → gated`. `approved` = human merge of
  the ratification PR, never set by hand. PASS.

**Overall: internally sound, consumable, `gated` — awaiting human
ratification by PR merge.**
