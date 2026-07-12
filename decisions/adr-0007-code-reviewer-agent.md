---
id: adr-0007-code-reviewer-agent
type: adr
status: draft
depends_on: [adr-0002-agent-vocabulary, adr-0005-tdd-and-artifact-gated-dispatch]
owner: agent
updated: 2026-07-12
---

> **DRAFT — shaping canvas, not a made decision.** Shaped from the
> maintainer's ask (2026-07-12): add a code-quality reviewer role,
> independent of the `conformance-reviewer`, with no hardcoded tech
> stack. The maintainer decides; this draft structures the calls.
> The `## Decision state` section below is the canvas's live index and
> is removed at gating, when resolved calls fold into `## Decision`.
>
> **Research-skip record (stage 1):** Stage-1 research skipped: stable,
> well-documented domain; open questions are grove-internal design, not
> landscape; bounded prior-art check (built-in code-review skill,
> community reviewer agents) folded into shaping.

# ADR-0007: `code-reviewer` — an independent code-quality reviewer, stack-agnostic by placeholder, alongside the conformance gate

## Decision state

**Decided** (maintainer, in the ask, 2026-07-12):

- A new grove role exists: a code-*quality* reviewer, independent of the
  `conformance-reviewer`.
- It hardcodes **no tech stack**; quality standards come from the
  consuming project's own declared rules.
- The "agent builder" skill (stack detection + interview + wiring a
  stack-specific reviewer into the consumer project) is **out of scope**
  of this decision — recorded as future direction only (parked below).

**Open** (structured in *Open design calls*, each with a recommendation;
all are the maintainer's):

1. Gate or advisory? (recommendation: pre-merge, report-only advisory)
2. Pipeline position / stage label (recommendation: stage 4½, shared
   with `conformance-reviewer`)
3. Relationship to the built-in `/code-review` skill (recommendation:
   one available instrument, not mandated)
4. Role name `code-reviewer` + cold-start + read-only boundary
   (recommendation: yes to all three — lowest-stakes bundle)

**Parked** (deferred with reasons — see *Open questions*): the agent
builder skill; validator per-PR-critique overlap.

## Decision (proposed)

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

3. **Pre-merge, report-only, advisory** (open call 1, recommended):
   severity-graded findings, human decides at merge. Not a hard gate —
   see the trade-off below.

4. **Runs alongside the `conformance-reviewer` at stage 4½** (open
   call 2, recommended): same input (the finished build), independent
   questions, can run in parallel; findings feed the same dispatcher
   findings ledger.

5. **Cold-started, stateless, read-only/report-only** (open call 4,
   recommended): all context travels through the change under review
   plus the project's declared quality sources; it judges and reports,
   it does not fix — matching `conformance-reviewer` and `validator`.

6. **The charter charters the *frame*, not the technique.** Claude Code
   ships a built-in `/code-review` skill (diff review for correctness
   bugs and reuse/simplification/efficiency cleanups, severity-graded
   findings). Grove's charter therefore does not re-describe how to
   review code; it charters what the runtime does not provide — the
   **independence** (never the builder), the **sequencing** (pre-merge,
   alongside conformance), the **standards source** (the project's
   declared rules, per item 2), and the **reporting contract**
   (severity-graded findings into the ledger). The built-in skill is
   one available instrument (open call 3, recommended), not a mandate.

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
build — which is also why they can run in parallel (open call 2).

**Prior art (bounded check, folded into shaping — see the research-skip
record above).** The built-in `/code-review` and `/security-review`
skills mean part of "how to review code" is a runtime capability, not
something a charter needs to author. This reframes the role: grove
charters the independence, sequencing, standards-source, and reporting
contract *around* a capability the runtime partially provides
(Decision 6).

**Naming.** `code-reviewer` follows adr-0002's principle — every role
named for what it does — and collides with nothing: the existing
reviewer roles are `conformance-reviewer` (contract gate) and
`corpus-reviewer` (artifact-record audit). Proximity to the built-in
`/code-review` skill name is a feature, not a collision: the role wraps
that territory deliberately.

## Open design calls (live — the maintainer's; removed at gating)

### 1. Gate or advisory?

- **Option A — advisory (recommended):** pre-merge, report-only,
  severity-graded findings; the human weighs them at merge. Rationale:
  taste should not block merges; quality findings are rarely binary the
  way conformance findings are, and a hard gate on judgment calls
  invites either rubber-stamping or gridlock. This also matches the
  smallest-thing-that-works dial: a gate can be ratcheted in later by a
  one-line decision if advisory proves toothless; un-gating is harder.
- **Option B — hard gate, like conformance:** overall PASS required to
  merge. Symmetric with the conformance gate; but it makes an
  inherently judgment-based verdict merge-blocking, and the severity
  grammar would need a "blocking" tier definition per project.
- **Middle dial (name it if wanted):** advisory by default, with
  findings at the top severity tier requiring an explicit human
  acknowledgment (not a fix) before merge — loud, not blocking.

### 2. Stage label — two roles at one stage

- **Option A — share stage 4½ (recommended):** the stage number encodes
  pipeline *position* (after the build, before merge), not uniqueness.
  Two independent questions about the same build at the same position.
  Precedent for a half-stage exists (`spec-adversary` at 3½); two roles
  at one number is new but honest — it says "these run in parallel."
  Cost: README's "seven agent roles, one per stage" sentence needs
  rewording (it changes anyway — the count moves to twelve).
- **Option B — a new label (4¾ or similar):** preserves one-role-per-
  stage but falsely implies sequencing (that code review runs *after*
  conformance), which the design does not require.

### 3. Relationship to the built-in `/code-review` skill

- **Option A — one available instrument (recommended):** the charter
  names the skill as available where the runtime provides it, but the
  role's contract (independence, standards source, severity-graded
  report into the ledger) stands without it. Keeps the charter portable
  to runtimes/versions without the skill — the same portability
  discipline as the placeholder door.
- **Option B — mandate/wrap it:** thinner charter, but couples a
  portable charter to one runtime's feature set, and the skill does not
  know the project's declared conventions (Decision 2) — the charter
  would still need the standards-source contract on top.
- **Option C — ignore it:** forgoes a real capability and invites the
  charter to re-describe generic code review, which Decision 6 exists
  to avoid.

### 4. Name / cold-start / boundary (bundled, low-stakes)

`code-reviewer` (collision-checked above); cold-started stateless like
every reviewer role; read-only/report-only. Recommended as a bundle —
each matches the standing pattern; flag if any should differ.

## Considered and rejected

- **Extend `validator`'s per-PR critique instead of adding a role** —
  rejected (leaned against in shaping; recorded honestly): `validator`
  is post-merge and reactive by charter — its critique runs on *merged*
  changes and its audits fire on named triggers, never as a standing
  pre-merge review. Stretching it pre-merge muddies a clean role to
  avoid adding an honest one.
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

## Consequences (on approval; execution is a follow-up, not this PR)

- **`charters/code-reviewer.md`** is authored (plus its
  `.claude/agents/` and `plugins/grove/reference/agents/` copies), with
  the placeholders from Decision 2 — a separate execution step after
  this decision is approved, not part of this decision's own merge.
- **`README.md` team table** gains a row —
  `code-reviewer | 4½ | code-quality review vs. the project's own declared standards; severity-graded findings, advisory; report-only | yes`
  — and the team prose updates: **eleven roles becomes twelve**, and
  "one per stage" is reworded per open call 2.
- **`dispatcher` charter W1** adds the role alongside the conformance
  gate ("`executor` → conformance gate ∥ code review → HUMAN merge"),
  findings into the same ledger.
- **`plugins/grove` setup skill** offers the new role in its composing
  interview and resolves its placeholders (default install count moves
  to twelve).
- **`executor`'s charter is unchanged**: refactor stays in its TDD
  loop; what changes is that the quality of the result now gets an
  independent pre-merge reader.
- No existing decision is superseded; this adds a role, it overturns
  nothing.

## Acceptance criteria (for the execution wave this decision authorizes)

- **AC1** `charters/code-reviewer.md` exists (+ both copies), stating:
  the quality-vs-contract boundary one-liner; the standards-source
  priority order with placeholders `<CONVENTIONS_PATH>`, `<LINT_CMD>`,
  `<QUALITY_RUBRIC_PATH>` (optional); the no-declared-conventions
  fallback with absence-as-finding; severity-graded report-only output;
  read-only boundary; and cites `adr-0007`.
- **AC2** The charter contains no tech-stack-specific noun (language,
  framework, linter brand) outside placeholder examples — checkable by
  grep, same discipline as the lift's acceptance grep.
- **AC3** `README.md` team table carries the twelfth row and the team
  prose count/one-per-stage wording is updated.
- **AC4** `dispatcher.md` W1 names the role at the conformance-gate
  position; the findings-ledger contract covers its findings.
- **AC5** The plugin setup skill offers the role and resolves its
  placeholders honestly ("none exists yet" allowed, per the standing
  interview contract).
- **AC6** The agent-builder skill appears nowhere in the executed
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
  review exists, does `validator`'s post-merge "lightweight pass on
  every merged change" shrink or retire? Leaning: leave it — it is
  nearly free and post-merge remains a distinct vantage — but not
  decided here; revisit on evidence of redundant findings.

## Self-check (gate)

Not yet run — `status: draft`; this section completes at gating, after
the maintainer resolves the open design calls. Verification done so
far, directly against source rather than from the shaping brief:
`conformance-reviewer`'s taste-exclusion quoted from its charter
§Boundaries and its agent definition (the "not here to improve the
code" line lives in `.claude/agents/conformance-reviewer.md`, not the
canonical charter — cited accordingly); `validator`'s post-merge
"mostly automatic" critique quoted from its charter §Method 1;
`executor`'s self-graded refactor step and its "do not grade your own
work" handoff quoted from its charter §Method; the `code-reviewer` name
collision-checked against the role list and repo-wide grep; README's
"eleven roles" / "one per stage" prose read directly before claiming it
needs the twelve-roles reword.
