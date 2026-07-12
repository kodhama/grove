---
id: adr-0009-security-specialist-parked
type: adr
status: approved  # self-checked (gated), then approved by the maintainer in-session 2026-07-12 ("Ratify ADR-0009"), recorded in-PR per the adr-0007 precedent; ratified via #46
depends_on: [adr-0007-code-reviewer-agent]
owner: agent
updated: 2026-07-12
---

> Provenance: a research + shaping session against the consuming
> project's (math-quest's) real code surface, 2026-07-12 — dispatched by
> the maintainer with the explicit question "does grove need a
> security-specialist role — now, or parked?" and the ground rule that
> the answer be grounded in code, not generic. The investigation ran as
> three parallel read-only audits (architecture/auth/data,
> dependencies/network/secrets, existing coverage); the maintainer
> reviewed the resulting recommendation and directed it be recorded
> here ("Go for it, record it on grove", same sitting). Ratification is
> the PR approval/merge, never set by hand.

# ADR-0009: `security-specialist` — parked with named triggers; no charter until a consuming surface owns the question

## Decision

1. **Do not charter a `security-specialist` role now.** grove's bar for
   a new role — it must own a question no current role owns
   (`adr-0007-code-reviewer-agent`, decision 1, applied the same way
   here) — fails on the evidence: every candidate security question
   either has no surface in the consuming project or is already owned
   (see Context).

2. **Park it here, with the triggers below as this decision's revisit
   conditions.** Decision triggers live in the decision that parked
   them; encountering a matching event *is* the reminder. When one
   fires, the path is a shaping conversation citing this ADR — not a
   silent charter.

   - **T1 — a backend that stores or transmits learner data lands** in
     a consuming project (for math-quest, concretely: Surface B —
     `adr-0019`'s MCP backend — moving from docs to code; it is on the
     active roadmap, late-July 2026 reference frame, so this park may
     be short-lived). The moment learner data leaves the device, "is
     this design safe for a minor's data?" becomes a standing question
     no per-diff review owns.
   - **T2 — identity/accounts land**: any login/auth, or math-quest's
     `adr-0006` display-name field getting implemented. Authn/authz
     model review becomes a real question.
   - **T3 — a consuming repo goes public while running agentic CI**:
     free text flowing into an agent with shell and write permissions
     becomes an attack surface with genuinely untrusted input
     (math-quest's `claude.yml` author-association gate is explicitly
     the in-file fail-safe for this event).
   - **T4 — a real runtime dependency tree appears** (math-quest
     currently has zero runtime dependencies): the supply-chain
     question gains a surface. Weakest trigger — the consuming
     project's dependency-requires-an-ADR rule is already the
     checkpoint; this trigger upgrades it to a standing question only
     if the tree grows past what a per-dependency decision reads.

3. **Record the seed for the future shaping now**, so it starts from a
   boundary and not from scratch:

   - **Boundary one-liner**: the `conformance-reviewer` asks "does it
     match the contract?"; the `code-reviewer` asks "is this good code,
     regardless of the contract?"; a `security-specialist` would ask
     **"is this design safe to expose — for the threat model and the
     data subjects it actually has?"**
   - **Expected shape** (a lean, not a decision): *not* a second
     stage-4½ per-diff gate — the code-level half of security
     (injection, broken error handling, resource leaks, misleading
     behavior) is already the `code-reviewer`'s blocking tier. The
     unowned question is **design-time**: threat modeling /
     data-handling review of a *decision or spec*, per-decision or
     per-surface, triggered — positionally closer to the
     `spec-adversary`'s 3½ than to the 4½ gates. The future shaping
     confirms or overturns this lean; it is recorded so it isn't
     re-derived.

## Context

**What already covers security, verified this sitting.** The
`code-reviewer` charter names **security exposure** inside its
objective-harm anchor — reachable as blocking `severe`/`high`, per-diff,
pre-merge (`charters/code-reviewer.md` §Severity grammar; quoted
directly from the charter, not from the session brief). The hosting
runtime ships a built-in security-review capability, which under
`adr-0007` decision 6 ("charter the frame, not the technique") any agent
can already invoke as one instrument. So *code-level* security defects
have an owner; a new role is only justified by a question that is not a
per-diff code judgment.

**The consuming surface, audited 2026-07-12** (math-quest paths, as of
that date; condensed — the full cited audit lives with the session):

| Candidate question a security role could own | What the code showed | Verdict |
|---|---|---|
| Threat modeling | The whole model fits in a paragraph and is already recorded where decided: math-quest's `adr-0024` §6 accepts a publicly-callable generation endpoint at household scale behind a hard-capped key, and states its threat model in one line | The decision channel suffices at this scale |
| Authn/authz model review | Zero auth code — no login, session, token, or account model anywhere in `src/`, `api/`, `test/` | No question to own |
| Dependency / supply-chain audit | `package.json` has **no `dependencies` key at all**; the entire lockfile is build/test tooling; nothing ships to production via a package registry | Tooling (a dependency-alert bot, an audit CI step), not a role — and project-local tooling at that |
| Secrets management | One secret (`ANTHROPIC_API_KEY`), server-side only, never committed (verified against full git history); the one real incident is already codified as a process rule in the consuming project's instructions | No standing question |
| Data-privacy / minors compliance | The users **are** minors — but no PII is collected, stored, or transmitted: learner state is device-local, the kid-id is an opaque key, and the no-PII posture is declared product intent | **The one real future question — parked as T1/T2** |

Supporting facts, also verified in that audit: the deployed product is
a static client plus exactly one ~45-line serverless function whose
four query parameters are all allowlist- or regex-validated before use;
no free-form user text reaches an LLM prompt, a file path, a shell
command, or a query (there is no database); rendering is
text-node-based with no untrusted-markup injection path.

**Honest caveats carried with the evidence:**

- **Coverage is charter-level, not yet composed.** `adr-0007` is
  approved and its charter shipped, but the audited consuming project
  had not yet composed the `code-reviewer` role into its agent roster
  at audit time — until composition, its per-diff security gating rests
  on a generic PR-review action. The claim "code-level security has an
  owner" is true of grove's roster, pending in the consumer.
- **Inferred, not verified**: the production deployment's env-var state
  (maintainer-attested in a consuming-project spec, not independently
  checkable from the repo); the deployed bundle's key-absence (from
  source, not bundle inspection); the regulatory framing of
  minors-data obligations (reasoning, not checked against statute).

## Considered and rejected

- **Charter now** — rejected on the evidence: every row of the table
  above either has no surface or an existing owner. A role chartered
  today would re-derive "static client + one validated endpoint +
  capped key" on every dispatch and block nothing the `code-reviewer`
  doesn't already block. Chartering ahead of a real surface also cuts
  against the smallest-thing-that-works rule and would author tier
  definitions and boundaries against a hypothetical.
- **Not needed, ever** — rejected: the minors-data question is real and
  named in the consuming project's own product intent; it is inactive
  only because no learner data currently leaves the device. T1 sits on
  the active roadmap. Dropping the question instead of parking it would
  discard the boundary and the audit, and the next session would start
  from scratch.
- **Fold the future question into an existing role when it fires**
  (`code-reviewer` or `spec-adversary`) — rejected as a *pre-decision*:
  it is exactly what the triggered shaping should weigh (a
  security-lensed `spec-adversary` pass may genuinely beat a thirteenth
  role at that scale). Recorded as open question 1 rather than decided
  here — but the *default* of silently stretching an existing charter
  is what this ADR exists to prevent.
- **Record the park as a consuming-project note instead of a grove
  decision** — rejected: the question asked ("does *grove* need the
  role?") is a grove role-boundary question; grove's decisions are
  where its role-set history lives (`decisions/README.md`). The
  consuming-project evidence is cited, dated, and marked as a snapshot.

## Consequences

- **No charter is authored; no roster change.** `README.md`'s team
  table and count are untouched; the `dispatcher` charter is untouched.
- **The triggers live here.** A dispatch, shaping session, or audit
  that encounters a T1–T4 event in a consuming project cites this ADR
  and opens a shaping conversation — the intent gate (human decides)
  applies as always.
- **The future shaping starts from Decision 3's seed** — the boundary
  one-liner and the design-time lean — instead of from a blank page.
- No existing decision is superseded; this parks a role that was never
  chartered, it overturns nothing.

## Acceptance criteria

- **AC1** This ADR names concrete, observable trigger conditions
  (T1–T4), each tied to an event a dispatcher or shaping session can
  recognize — not vague "revisit periodically" language.
- **AC2** No charter file, README team-table row, or dispatcher change
  ships with this decision — checkable by the PR diff containing only
  this file.
- **AC3** The boundary one-liner distinguishing the parked role from
  both the `conformance-reviewer` and the `code-reviewer` is recorded
  (Decision 3).
- **AC4** Every consuming-project evidence claim in Context is dated
  (2026-07-12) and framed as a snapshot of that project, not a
  standing property of grove.

## Open questions (parked, ≤3)

1. **One role or a lens?** When T1/T2 fires, does the design-time
   security question become a thirteenth role, or a chartered *lens*
   on an existing stage-3½ adversary pass? The shaping that the trigger
   opens decides; Decision 3's lean is an input, not an answer.
2. **Does grove owe consuming projects a tooling recommendation?**
   Dependency-alert bots and audit CI steps are project-local tooling,
   not charters — but a recurring "the consumer has no scanning at all"
   finding could argue for a setup-interview question in the plugin.
   Unowned for now.

## Self-check (gate)

- **Frontmatter**: `id`/`type`/`status`/`depends_on`/`owner`/`updated`
  present, well-typed; `id` kebab-case and type-prefixed; numbering —
  `adr-0008` is claimed by an in-flight draft on its own branch, so
  this decision takes 0009 (verified against `decisions/` on main and
  the live branch this sitting). PASS.
- **`depends_on` resolution**: `adr-0007-code-reviewer-agent` resolves
  in this repo and is `status: approved` (in-PR approval recorded in
  its frontmatter, merged to main via #42) — a `gated` artifact
  consuming an `approved` one is legal; it is load-bearing for the
  coverage claim (security exposure in the objective-harm anchor) and
  the new-role bar this decision applies. PASS.
- **Charter quote verified against source this sitting**: "security
  exposure" as blocking-tier objective harm read directly from
  `charters/code-reviewer.md` §Severity grammar (`severe`: "a security
  exposure"; anchor: "Only a finding with demonstrable harm — a
  correctness defect, security exposure, …") — not taken from the
  session brief. PASS.
- **Consuming-project evidence provenance stated honestly**: the
  math-quest audit ran this sitting as three read-only investigations
  with file:line citations retained in the session record; this ADR
  carries the condensed, dated snapshot and marks the three
  inferred-not-verified items explicitly (Context §caveats). PASS.
- **New-role bar citation**: "a question no current role owns" is
  `adr-0007` decision 1's stated principle, applied — not quoted from
  a standalone rule file (a repo-wide grep found no such codified rule
  outside `adr-0007`; cited to where it actually lives). PASS.
- **Append-only discipline**: new artifact; no ratified decision
  edited or superseded. PASS.
- **Naming register** (`adr-0002` / `CLAUDE.md`): defining text uses
  role names and `agent` throughout; the conversational register term
  appears nowhere in this ADR. PASS.
- **Open questions count**: 2, within the ≤3 convention. PASS.
- **Required body sections**: Decision, Context, Considered and
  rejected, Consequences, Acceptance criteria, Open questions,
  Self-check — present, matching sibling ADRs. PASS.
- **Human-approval boundary**: the maintainer set the question, ground
  rules, and disposition ("park with triggers" reviewed and "record it
  on grove" directed, 2026-07-12, interactively). Promote
  `draft → gated`. `approved` = human ratification via the PR, never
  set by hand. PASS.

**Overall: internally sound, consumable, `gated` — awaiting human
ratification.**
