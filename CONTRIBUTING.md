# Contributing to grove

grove ships a collection of artifacts — **charters** (`charters/`),
**specs** (`specs/`), **decisions** (`decisions/`), and their executable
counterparts (`.claude/agents/`, `.claude/skills/`) — not a binary or a
service. Contributing here means proposing, gating, and (for a human)
approving changes to those artifacts. This guide is sourced from the
charters already in this repo (see `specs/0001-contributing-guide.md`
for the spec this guide implements, and its Provenance section for
which charters it draws from).

## Artifact contract

Every artifact in `charters/`, `specs/`, and `decisions/` begins with
YAML frontmatter:

```yaml
---
id: type-short-slug      # kebab-case, prefixed by type
type: charter             # adr | spec | charter | plan | rubric | ...
status: draft | gated | approved | superseded
depends_on: [...]         # ids of upstream artifacts this one builds on
owner: agent | human
updated: YYYY-MM-DD
---
```

| Field | Meaning |
|---|---|
| `id` | kebab-case, prefixed by type (`charter-executor`, `spec-0001-...`, `adr-0001-...`) |
| `type` | `adr` \| `spec` \| `charter` \| `plan` \| `rubric` \| ... |
| `status` | see the four values below |
| `depends_on` | ids of the upstream artifacts this one was built from — the bounded-context graph a cold-started gardener reads, never the whole archive |
| `owner` | `agent` (author) or `human` — who wrote it, not who's accountable for it |
| `updated` | last-touched date |

**The four `status` values, and who moves an artifact between them:**

- **`draft`** — not yet self-checked; not a valid downstream input. A
  `contract-author` never derives a spec from a draft decision; an
  `executor` never implements against a draft spec.
- **`gated`** — self-checked by its own author against the relevant
  rubric/acceptance-grep. Agent-consumable, but not yet independently
  reviewed. For specs, the `spec-adversary` role runs against `gated`
  specs, before a human ever sees them.
- **`approved`** — ratified by **human merge of the PR**. **Never set by
  hand** — no author, agent or human, edits a `status:` field to
  `approved` directly. The merge itself is the approval
  (`floor-intent-gate`: the intent gate never opens to agents).
- **`superseded`** — retired. A forward pointer at the top of the
  superseded text names the replacement's `id` (see the append-only
  rule below).

**Charters are the one exception worth naming explicitly.** As of this
writing every charter in `charters/` sits at `status: gated` — its
author self-checked it against its source material and the zero-nouns
grep (below), but **no charter has yet been independently reviewed by a
human or run through an adversarial pass** the way `specs/` artifacts
are (`charters/README.md`, "Charters in this wave are `status: gated`
— self-checked... but not yet independently reviewed by a human or a
`spec-adversary` pass"). Do not assume a charter went through the same
gate a spec or decision does — it hasn't yet. If you're proposing or
reviewing a charter change, treat `gated` as "believe the self-check,
verify it yourself before leaning on it," not as a human-reviewed
state.

## The draft → gated → approved → superseded lifecycle

### `draft` → `gated`

Who: the artifact's own author (agent or human), immediately after
writing it. What must be true first: every required section for the
artifact's type is present (a spec needs `## Acceptance criteria` and
`## Open questions`, literally, even if the latter is empty; a charter
needs `What this role is` / `Method` / `Boundaries` / `Placeholders`),
and the author has run their own self-check against the artifact's
rubric or acceptance criteria and recorded the result honestly — a
failing self-check is *listed*, never silently passed
(`charters/contract-author.md` step 4).

### `gated` → `approved`

Who: a human, and only via merging the PR. What must be true first: for
a `specs/` artifact, a `spec-adversary` pass has run against the
`gated` draft and converged on `APPROVE-READY` (see below); for a
`decisions/` artifact, the shaping conversation with the maintainer has
converged. The merge itself IS the approval — there is no separate
"flip the status field" step, and no PR is merged by its own author
when the artifact's contract requires human approval.

### `approved` → `superseded`

Who: whoever proposes the change that makes the old artifact obsolete.
**Never edit a ratified (`approved`) decision in place.** Write a new
artifact, mark the old one `status: superseded` (or `superseded in
part`), and add a one-line forward pointer at the top of the superseded
artifact's text naming the new artifact's `id`. No reader should ever
land on stale text with no link forward — this is how "why is it this
way?" stays answerable later (`decisions/README.md`).

## How to propose a new charter

1. Branch off `main`.
2. Write `charters/<role-slug>.md` with the frontmatter above
   (`status: draft`, `type: charter`, `owner: agent` or `human`) and
   the shape every existing charter uses: `## What this role is`,
   `## Method`, `## Boundaries`, `## Placeholders` (angle-bracketed
   tokens for anything project-specific — see "The placeholder door"
   in `charters/README.md`).
3. Self-check: does it cite provenance (which ADR or prior role it
   generalizes from, or "no dedicated legacy definition existed")? Does
   it pass the zero-nouns grep (below)? Flip `status: draft` →
   `status: gated` only once both are true.
4. **If the role is cold-started** (most are — check the team table in
   the root `README.md`), also add a matching
   `.claude/agents/<role-slug>.md` in the **same PR**: the `name` /
   `description` / `tools` frontmatter Claude Code expects, plus the
   charter's body. If the role is interactive or otherwise shouldn't
   get a subagent file (see the shaper/head-gardener exceptions
   below), say so explicitly in the PR body instead of leaving the
   pairing silently unaddressed.
5. Open the PR. It stays open at `gated` until a human reviews and
   merges it — that is the correct resting state, not an unfinished
   task (see "PR mechanics" below).

## How to amend an existing charter

Charters are **edited in place** — unlike decisions, they are not
append-only, because they are not decision records, they are the
policy artifact itself (their history lives in git, not in a forward-
pointer chain).

1. Branch off `main`, edit the charter file directly.
2. Re-run the self-check: the edited charter still names every required
   section, still cites provenance, still passes the zero-nouns grep.
3. **Check whether the charter has a paired `.claude/agents/` file** —
   most do (see the team table in `README.md` and
   `.claude/agents/README.md`). If it does, **update that file in the
   same PR.** There is no generator that derives one from the other:
   as of this writing `.claude/agents/*.md` files are hand-authored
   parallel copies of their charters (same body, plus
   `name`/`description`/`tools` frontmatter, minus the provenance
   note). An edit to one and not the other silently drifts the two out
   of sync — the next reader of either file gets a stale picture with
   no signal that it's stale.
4. Open the PR describing what changed and why (a charter edit is
   still a real change to a self-checked artifact — treat the PR body
   as the record of that self-check, not just a diff).

## Proposing a spec (and the spec-adversary step)

Specs (`specs/`) follow the `contract-author` → `spec-adversary` →
human spec-gate pipeline:

1. Write the spec (`status: draft`) from the approved decision(s) or
   equivalent authorizing intent it derives from — never from another
   draft. Include the shared frontmatter, and literally these two
   sections: `## Acceptance criteria` (testable, checkable) and
   `## Open questions` (may be empty, but the heading must exist — a
   spec that cannot say what "done" means is not yet a spec).
2. Self-check against the project's spec rubric if one exists; flip
   `draft` → `gated` once it passes.
3. **Run an adversarial pass before opening this to a human.** Genuinely
   try to break the `gated` draft: untestable acceptance criteria,
   internal contradictions, silent scope beyond the source decision,
   ambiguity a downstream executor would have to guess at, missing
   edge cases. If you are both author and reviewer (e.g. a solo
   contribution), do this pass deliberately and separately from
   writing the spec — don't let self-checking and adversarial review
   collapse into the same pass.
4. **Record the adversarial round in the spec file itself** — a short
   note (what you tried to break, what you found, what you changed, or
   that nothing load-bearing was found) — not only in PR comments. PR
   comments don't travel with the artifact if it's read later outside
   the PR; the spec file is the artifact of record.
5. Open the PR. A human reviews and merges to promote `gated` →
   `approved` — never set by hand.

## The zero-nouns discipline

A charter, spec, or decision in this repo is written to be **cold-
started in any consuming project** — it never hardcodes a noun specific
to the project grove itself was lifted out of, or to any other
specific consuming project. Where a role genuinely needs a
project-specific value (a test command, a spec path, an issue-tracker
convention), it declares an explicit angle-bracketed placeholder (e.g.
`<TEST_CMD>`) instead of quietly assuming a default. Concretely, this
means no source-project product name, codename, persona name, or
internal taxonomy/numbering scheme belongs in a charter, spec, or
decision — anything that specific is either generalized into a
placeholder or left out.

Before opening a PR that touches `charters/`, `specs/`, or
`decisions/`, run this repo's acceptance check for those tokens against
your changed files. **This guide deliberately does not reproduce the
literal pattern inline**: the check is a short regex of banned nouns,
and quoting a regex made of banned substrings inside a document is
self-defeating — the document then fails its own check by describing
it. As of this writing, no such check is actually committed anywhere
in this repo — `charters/README.md` refers to "the repo root's
acceptance grep," but no script or CI config with that content exists
in the checked-out tree. Until that's fixed, ask a maintainer for the
current pattern before opening a PR, and don't assume that not finding
one committed here means the discipline doesn't apply — treat it as a
tooling gap, not a null requirement (see `specs/0001-contributing-guide.md`'s
Open Questions for the follow-up: committing the actual check as a
script outside prose docs, where it can be both runnable and
non-self-referential). A clean grep, once you have the real pattern, is
necessary but not sufficient — also read your diff for any other
project-specific noun a fixed token list won't happen to catch (a
person's name, a Slack channel, an internal URL).

## PR mechanics

- **Branching**: this repo has no enforced branch-naming convention as
  of this writing beyond "branch off `main`" — don't invent or assume
  one that isn't written down anywhere else in this repo.
- **Commit messages**: follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat(...)`, `docs(...)`, `chore(...)`, `fix(...)`) — this repo's
  own `git log` is the evidence for the convention, not a separate
  enforced rule.
- **No self-merge past a human gate.** If the artifact's contract
  requires human approval to reach `approved` (specs, decisions), the
  author does not merge their own PR. Charters, at their current
  self-gated `status: gated` convention, are the narrower case — see
  the caveat above; even so, treat maintainer review as expected, not
  optional, until this repo records a decision saying otherwise.
- **An open, unmerged PR at the artifact's current gate is a correct
  resting state, not a gap.** A `gated` spec's PR sits open until a
  human merges it or requests changes — don't manufacture urgency to
  merge something a human hasn't reviewed just to close the PR out.

## Where this doesn't apply uniformly

- **`shaper`** is explicitly interactive and PR-based (a draft decision
  on a change-request is the shared canvas), but the agent itself
  **never promotes the decision past `gated`** — the maintainer's merge
  is always the approval, even more tightly than the general rule above
  (`charters/shaper.md`).
- **`head-gardener`**'s `.claude/agents/head-gardener.md` is a scoped
  one-shot advisor (workflow classification, next-dispatch
  recommendation only) — it is **not** a full port of
  `charters/head-gardener.md`, because that role requires live,
  multi-turn dispatch state a cold-started subagent call cannot hold.
  Don't expect every charter to have a 1:1, fully-equivalent
  `.claude/agents/` file — check the charter's own notes first.
