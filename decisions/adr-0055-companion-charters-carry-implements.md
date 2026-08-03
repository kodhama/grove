---
id: adr-0055-companion-charters-carry-implements
type: adr
status: gated  # gated 2026-08-03 by author self-check against the adr-0051 body contract, evidence on the PR
depends_on: [adr-0016-implements-edge-taxonomy, charter-relations, charter-conformance-reviewer, charter-dispatcher, adr-0008-lifecycle-enum-companion, adr-0010-versioning-is-operational, adr-0011-relations-companion, adr-0050-read-model-and-context-budget]
owner: agent
updated: 2026-08-03
---

# ADR-0055: companion charters carry `implements:` to their founding decision

## Context

grove#211 asks whether the four companion charters — `charters/lifecycle.md`,
`relations.md`, `versioning.md`, `context.md` — should carry an `implements:`
edge to the decision that created them. Each states one methodology grammar
the rest of the corpus sources; each names its founding decision only in
`depends_on` (lifecycle→adr-0008, relations→adr-0011, versioning→adr-0010,
context→adr-0050); none carries `implements:`.

`relations.md` defines `implements:` generally — "the one contract a
*lifecycle artifact* realizes — a spec its decision, a **charter its ADR**" —
with no carve-out for a charter that is a companion rather than a dispatched
role. `conformance-reviewer.md`'s remit is stated the same way: "code→spec,
spec→decision, **charter→ADR**." Neither text singles out role charters.

The corpus's actual practice does not split cleanly on "role vs. companion"
either. Of the thirteen role charters, only five carry `implements:`:
`code-reviewer` and `decision-adversary` (each "chartered by" one ADR, "a new
role, not a lift"), `conformance-reviewer` and `spec-adversary` (each
"restated"/"narrowed" wholesale by `adr-0012`), and `implementation-planner`
(chartered by `adr-0037`). The other eight — `corpus-reviewer`, `dispatcher`,
`executor`, `contract-author`, `propagation-remediator`, `run-resumer`,
`shaper`, `divergent-researcher` — are each "generalized from" a pre-grove
legacy artifact and carry no `implements:`, including `corpus-reviewer`,
whose founding `adr-0001-corpus-reviewer-lift` sits in `depends_on` exactly
like the four companions' founding ADRs sit in theirs. The edge tracks "a
charter whose current, definitive text is the direct, wholesale product of
one named grove decision," not "is a role."

By that test the four companions are a clean match, not an edge case: each
was created, verbatim, by exactly one decision, with **no prior legacy
file** — the "chartered by X, not a lift" shape of `code-reviewer` and
`decision-adversary`, not the "generalized from a legacy artifact" shape of
the eight role charters that also lack the edge.

The gap is already live, not hypothetical. `lifecycle.md`, `relations.md`,
and `versioning.md`'s status lines each record "conformance-reviewed against
[its founding ADR] before approval" — a manual practice, performed with no
machine trigger. `context.md`, the newest companion (landed in the grove#197
trunk, PR #208), carries no such record; its status line names only its
authoring act. The Codex review that raised grove#211 caught exactly this on
`context.md`, and the maintainer declined a one-file fix in favor of the
class question this decision resolves.

## Decision

All four companions gain `implements:` naming the one decision that created
them — unchanged from what each already documents in its own provenance
note:

- `lifecycle.md` → `implements: adr-0008-lifecycle-enum-companion`
- `relations.md` → `implements: adr-0011-relations-companion`
- `versioning.md` → `implements: adr-0010-versioning-is-operational`
- `context.md` → `implements: adr-0050-read-model-and-context-budget`

Existing `depends_on` entries are unchanged: each companion's later amending
decisions (`adr-0026` D7, `adr-0043`, `adr-0053`, and so on) stay exactly
where they are — coupling, not the fidelity upstream — the same
one-founding-`implements:`-plus-growing-`depends_on` split every
`implements:`-bearing role charter already uses.

This makes a future prose change to any of the four an `implements`-bearing
subject: `dispatcher.md`'s ONE owed-rule and `transitions.toml`'s
`t-conformance` fire on it exactly as they do for any other declared
fidelity edge, no new predicate or mechanism required.

Execution — the four frontmatter edits themselves, each a charter amendment
under the corpus's existing revise-in-place-plus-amendment-note practice —
is scoped downstream, not performed in this decision.

## Consequences

- The four companions become owed-conformance subjects on their next
  change, closing the gap grove#211 named and the one `context.md` already
  fell into.
- No directional-flow break: `adr-0008`, `adr-0010`, `adr-0011`, and
  `adr-0050` are all `approved` today, so no `gated`/`approved` companion
  ends up `implements:`-pointing at a `draft`.
- No new validator drift-audit surface: each founding decision already sits
  in its companion's `depends_on`, already drift-bearing (`relations.md`);
  `implements:` adds the machine-readable fidelity-upstream declaration and
  the dispatch trigger, not a new upstream the drift walk didn't already
  reach.
- Landing obligation: the four frontmatter edits named above, each its own
  charter amendment; no `relations.md` or `dispatcher.md` wording change is
  needed, since both already state the edge and the remit generally enough
  to cover a companion without amendment.
- Recommended, not mandated here: the PR that lands the four edits should
  itself draw a `conformance-reviewer` pass against this decision, closing
  the loop `context.md` missed.

## Considered and rejected

- **Status quo — rely on the informal "conformance-reviewed against X"
  status-line practice.** This is what three of four companions already
  did, by hand, with no structural trigger — and it already lapsed on the
  fourth. Rejected for the same reason `adr-0016` rejected "document the
  edge without making it drift-bearing": naming a gap without closing it
  leaves exactly the fail-open bridge that produced the observed lapse.
- **Exempt companions on the "not an agent role, never dispatched"
  clause.** True and load-bearing for *pipeline dispatch* — no role reads a
  companion as its own charter — but silent on whether the companion, as a
  build subject, may be reviewed for fidelity to the decision that wrote
  it. Being un-dispatched and being un-reviewable are different properties;
  `relations.md` and `conformance-reviewer.md` both state the fidelity
  question generally enough to cover any charter.
- **Widen `t-conformance` to fire on `changed(charter ∪ …)` instead of
  adding the edge.** Rejected: the reviewer's Method 1 builds its checklist
  from the named `implements:` upstream; a bare predicate widening with no
  upstream declared would dispatch the reviewer with nothing to check
  against, reproducing today's gap one layer downstream.
- **Point `implements:` at the most recent amending decision** (mirroring
  `spec-adversary`'s move to `adr-0012` after a wholesale narrowing).
  Considered: no companion's amendments to date (`adr-0026` D7's delivery
  mechanics, `adr-0053`'s shedding) rewrite the grammar itself the way
  `adr-0012` rewrote `spec-adversary`'s remit, so the founding decision
  remains "the one contract" each realizes. Flagged below if that changes.

## Open questions

- Whether a companion's `implements:` target should migrate to a later
  decision that substantially rewrites its grammar, the way
  `spec-adversary`'s did — unopened territory today; no companion has had a
  rewrite of that scale.
- Whether charters' revise-in-place practice (evidenced by every
  companion's accreting status-line amendment notes) belongs stated
  explicitly in `charters/lifecycle.md`'s per-type mutability section, which
  today names only decisions and specs — an adjacent gap, out of scope
  here.
