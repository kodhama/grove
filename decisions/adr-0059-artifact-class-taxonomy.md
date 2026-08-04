---
id: adr-0059-artifact-class-taxonomy
type: adr
status: gated  # gated 2026-08-04 by author self-check against the adr-0051 body contract (evidence on the change request); shaped in-session with the maintainer 2026-08-04 (class list, charter inclusion, rubric-as-companion each confirmed by explicit maintainer reply)
depends_on: [adr-0002-agent-vocabulary, adr-0037-pre-execution-planning, adr-0051-decision-body-contract]
owner: agent
updated: 2026-08-04
---

# ADR-0059: classes are artifact kinds; obligations, storage, and rubrics are their properties

## Context

grove#200's defect stands: sibling repos' `type: decision` and `type: discovery`
artifacts classify `unclaimed` and owe four reviews each, because the guard's
enum recognizes five words. The first answer (adr-0056, PR #215) kept spec-0006's
class table fixed and opened the vocabulary over it. At the intent gate the
maintainer reshaped the question: the class table itself is wrong.

The evidence supports the reshaping. `reviewless` appears in **zero** transitions
in `transitions.toml` — its entire behavior is absence from every trigger set,
i.e. an owed set that happens to be empty, encoded as a kind. Per-type properties
are scattered across five homes: owed reviews in the class table, mutability
split between `decisions/README.md` (append-only) and adr-0004 (revise-in-place),
lifecycle fit escaping by prose exemption (grove#188's four `status: recorded`
files), body sections in adr-0051, and three rubric config paths reading "none
exists yet". And the #186 plan incident passed review precisely because a
committed `type: plan` classifies as *generic* `unclaimed` noise rather than as
the specific defect adr-0037 defines. Meanwhile the family carries nineteen
distinct live `type:` words across eleven repos (adr-0056's census, retained).

## Decision

1. **Classes are artifact kinds — the closed set is `research`, `decision`,
   `spec`, `plan`, `charter`, `code`, `feedback`, plus the fail-closed backstop
   `unclaimed`.** A class names what an agent produces, whether or not it is
   ever stored. `charter` covers the agentic-instruction family: role charters,
   companions, skills, agent definitions. The overlays stay orthogonal and
   unchanged: `implements-bearing` (a property of a subject) and `missing` (a
   state of a path) are not kinds. `reviewless` is retired as a class.
2. **`decision` is the canonical word; `adr` is a permanent accepted synonym.**
   The guard's internal class was already named `decision`; the canon follows
   it. Built-in word→class map: `decision`→`decision`, `adr`→`decision`,
   `discovery`→`research`. No file is renamed and no id changes — ids are
   identity-bearing and history is append-only; the canon binds forward.
3. **Each class carries a declared property row**, stated once in spec-0006's
   amended table: its **owed review set** (encoded as transitions, as today — a
   class absent from every transition owes nothing *by declaration*, never by
   accident), its **mutability** (append-only: `decision`, `feedback`,
   `research`; revise-in-place: `spec`, `charter`), its **storage** (see 4),
   its **body contract** (adr-0051 for `decision`; specs/README for `spec`),
   and its **rubric pointer** (see 5). Current owed sets are transcribed, not
   redesigned: this decision changes the model, and the one pending owed-set
   change (companions gaining conformance review via `implements:`) belongs to
   adr-0055 at its own gate.
4. **`plan` is a class whose storage property is `never`** (adr-0037: the plan
   is not committed, enters no graph, creates no gate). A committed `type: plan`
   file in an artifact directory is therefore a **named deterministic defect**
   — forbidden storage — not generic `unclaimed` noise. This strengthens
   adr-0037's enforcement; whether a durable plan form should ever exist stays
   grove#187's question, and a yes there amends this property.
5. **Rubrics are companions, not a class.** Grove carries one rubric file per
   class that owes review, authored as a companion charter (`type: charter`,
   the lifecycle.md/context.md pattern), each `implements:` its authorizing
   decision, homed `charters/rubric-<class>.md`, wired through the existing
   config rubric tokens. `rubric` never enters the type enum, and the READMEs'
   advertised `| rubric` is removed — a rubric governs artifacts of a kind and
   is itself charter-kind. Rubric authoring is follow-up gated work, seeded by
   adr-0051's body contract for `decision`; this decision fixes only the
   encoding.
6. **The vocabulary beyond the built-ins is an open synonym map** (retained
   from adr-0056): `.grove/config.toml` may declare *word W means class C* for
   the consuming repo — never define a class, alter an owed set, or exempt a
   path; a malformed map is ignored whole; an unmapped unknown word stays
   `unclaimed`, fail-closed. The map's confirmation belongs to setup, never
   guard-time inference. This is the guard's first deterministic read of
   `.grove/config.toml`, a deliberate narrowing of adr-0026 D3's
   "agent-read-only" boundary, accepted for a pure word→class table and
   nothing else.

## Consequences

spec-0006 owes the amendment: the subject-class table rewritten as the
class/property table, INV16's classifier clauses updated, and the synonym-map
carrier clause added. **This amendment takes the first slot in spec-0006's
version chain; adr-0057's and adr-0058's named obligations rebase after it** —
recorded here so the three in-flight decisions serialize at the gate rather
than colliding. `guard-core.mjs` follows the amended spec (decision → spec →
code; no code moves on this decision alone). `decisions/README.md` and
`specs/README.md` type-enum comments update; stewards needs a setup pass before
the map reaches it (no `.grove/config.toml` exists there). Resolves grove#200;
names but does not resolve grove#187 (plan durability) and grove#188 (per-class
lifecycle — the property table gives #188 its natural home when it is decided).
Landing obligations are enumerated on the change request per adr-0052.

## Considered and rejected

- **adr-0056 as authored** (synonym map over the unchanged table): closed
  unmerged at the maintainer's gate — the map was right, the table it mapped
  onto conflated kind with obligation. Its census and map mechanics are
  retained here.
- **Keeping `reviewless`**: a class that exists only as an empty owed set is
  the property model with worse names.
- **`rubric` as a class**: every rubric file would classify `unclaimed` and
  owe four reviews, or need its own owed-set row for a kind with a population
  of four; companion encoding gets conformance review through adr-0055's edge
  for free.
- **Renaming `adr-*` files/ids to `decision-*`**: identity-bearing ids,
  append-only history; the canon binds forward only.
- **Config-only vocabulary with no built-ins**: grove would alias against
  itself (`discovery`, `note` live in its own tree) and every sibling would
  restate the family's two commonest words.

## Open questions

- No role authors charters: grove chartered a contract-author for specs but
  nothing for the agentic-instruction class, a gap the maintainer attributes
  to grove's code-production focus. Parked for a future chartering decision.
- Whether `feedback` and `research` need distinct mutability rows or share one
  append-only "record" row (grove#188's territory).
