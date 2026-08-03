---
id: adr-0056-decision-type-vocabulary
type: adr
status: gated  # authored by an agent 2026-08-03 against grove#200; body written to the adr-0051 contract, self-check and evidence carried on the change request (adr-0052); approval is the maintainer's separate act on the D5 channel and is not performed here
depends_on: [adr-0048-parsers-are-dependencies, adr-0026-thin-vendor-boundary]
owner: agent
updated: 2026-08-03
---

# ADR-0056: grove's classes stay closed; the vocabulary that maps onto them is open and declared

## Context

`spec-0006`'s subject-class table is the normative enum — `decision` ←
`type: adr`, `spec`, `charter`, `reviewless` ← {`research`, `feedback`},
everything else `unclaimed`, fail-closed, owing all four records.
`guard-core.mjs:83` implements that table exactly. The code is faithful; the
table is the defect.

`grove#200` measured the effect on `kodhama/stewards`: every one of its
decisions classifies `unclaimed`, so a markdown decision is asked for a
code-review record and a spec-adversary record. Fail-closed is the **normal**
path there, and a guard whose output is routinely skipped has stopped
guarding.

Two facts, measured across the org on 2026-08-03, shape the fix.

**The gap is far wider than two words.** Nineteen distinct `type:` values are
live across the eleven kodhama repos; grove's enum recognises five. `stewards`
declares `decision` ×25, `plan` ×5, `discovery` ×2, `test-deps` ×1; `trellis`
declares `decision` ×56, `research-note` ×13, plus `signature-catalog`,
`rubric`, `lexicon`, `invariant-set`, `expression-profile`. **grove's own tree
already fails grove's own enum** — `type: discovery` in
`research/surface-support-and-setup-eligibility.md`, `type: note` in
`decisions/adr-0012-shaping-log.md` — and `decisions/README.md` has always
advertised `plan | rubric`, which nothing has ever accepted. No plausible
built-in list closes a nineteen-word gap.

**A sibling has already ratified a contrary position.** `trellis/specs/0001`
§Types: *"Types are open (`decision-0003`, `research-0003`). Trellis does not
impose a fixed type set — a methodology brings its own."* Its
`research/0003-artifact-type-taxonomy.md` is the study behind it: the
*function* recurs across methodologies, the *name* does not. Grove's closed
enum does not merely inconvenience a consumer; it contradicts that consumer's
standing decision.

One correction to the issue's framing: `adr` is no grove-only legacy spelling.
Org-wide, `adr` has 119 files in four repos against `decision`'s 83 in four.
The family is genuinely split, and no repo has decided against either word.

## Decision

1. **Grove's *classes* stay closed; the *vocabulary* mapping onto them is
   open.** The five classes and their owed sets remain normative in
   `spec-0006` and are never repo-configurable. What becomes extensible is
   only which words name them. This is the reconciliation with
   `trellis/spec-0001`: types are open, obligations are not.

2. **Built-in acceptance widens by exactly two words: `decision` → class
   `decision`, `discovery` → class `reviewless`.** The membership test is
   narrow on purpose — a word goes built-in only when it is an unambiguous
   spelling of a class grove itself defines *and* grove's own corpus or
   dominant family usage attests it. `decision` is grove's own class name,
   attested in four repos; `discovery` is attested in grove's tree, in
   `stewards`, and declared in math-quest's enum. `plan`, `rubric`,
   `research-note`, `lexicon`, `invariant-set`, `signature-catalog`,
   `expression-profile`, `test-deps`, `protocol` and `note` all fail it —
   several because grove has no view on what review they owe, and grove is
   not entitled to invent one for another repo's record kind.

3. **Everything else is declared per repo in `.grove/config.toml`, as a pure
   synonym map and nothing more.** An entry may only say *word W in this repo
   means grove class C*, where C is a class the spec already defines. It may
   not define a class, alter a class's owed set, exempt a path, or carry a
   condition. All policy stays in `spec-0006`; only vocabulary is local. A map
   that is absent, unreadable, or schema-invalid is ignored **whole** — never
   partially applied — and every unrecognised type stays `unclaimed`.

4. **Inference belongs to setup; the guard never infers.** `grove:setup` and
   `grove:refresh` may propose a map from inspection, showing counts and
   example paths, and a human confirms before it is written; the guard reads
   only what is written down. The reason is an asymmetry: a map entry's sole
   effect is to move a type **out** of `unclaimed`, so a wrong entry fails
   *open*, precisely where fail-closed was protecting. Twenty files misspelling
   `descision` are indistinguishable, by count and consistency, from a real
   convention. Proposed-then-confirmed-then-written-down is grove's existing
   pattern, not a new gate.

5. **Fail-closed stays the default, and a confirmed map is re-examined.** An
   unknown, undeclared type still owes the full set. Because confirmation
   happens once while the corpus keeps moving, `refresh` re-inspects and
   **reports** drift — aliases matching no file, unrecognised types that have
   since appeared — and never silently rewrites the map.

## Consequences

Clause 2 corrects 84 files across the three repos grove governs today
(`trellis` 56, `stewards` 27, grove 1) with no consumer action at all, and
clause 3 gives the remaining 26 a declared home instead of a permanent
`unclaimed`. The fail-closed guarantee is unchanged on both paths, and no
heuristic ever runs on the enforcement path.

The real cost is a new trust edge: **this is the first time the zero-model
guard reads `.grove/config.toml`.** Until now that file was a *role* surface
(`adr-0026` D3 — shared tokens read as verified priors by cold-started
agents); a mechanical enforcement path reading a consumer-authoritative file
grove never overwrites is new, and clause 3's "vocabulary only, fail-closed
whole" is the bound that makes it acceptable. It adds no dependency — the
guard already bundles a TOML parser.

Landing obligations, strictly **after** the maintainer's approval and in this
order:

1. **`spec-0006` amendment** — the subject-class table, `INV16`'s determinism
   clause, a config-carrier clause and its ACs; versioned and paired per
   `adr-0044`/`adr-0010`. This decision deliberately declares **no `changes:`
   pin**: sibling decisions are in flight against the same spec, and version
   claims must serialize behind human approval rather than race.
2. **`guard-core.mjs`** — the two spellings plus a declared-map parameter,
   resolved by the classifier's caller so `classifyContent` stays a pure
   function of bytes and an explicit map.
3. **Lifecycle work** — inspection, proposal and confirm gate in
   `grove:setup` / `grove:refresh`, through the shared lifecycle core.
4. **Retype `decisions/adr-0012-shaping-log.md`** off `type: note`.
5. **`stewards` has no `.grove/config.toml` at all** — clause 3 reaches it
   only after a setup pass; clause 2 reaches it immediately.

Blast radius is enumerated on the change request per `adr-0052`, including
both READMEs' advertised `plan | rubric`.

## Considered and rejected

- **Adopting open types wholesale, as `trellis/spec-0001` does.** Trellis
  reads `type` for contract conformance; grove reads it to assign review
  obligations. An open field with no mapping classifies every unfamiliar word
  `unclaimed` by construction — "open" is not a classification.
- **The alias map alone** (`grove#200`'s second shape). It would push the
  family's most common words into every sibling's config, and grove would have
  to alias against itself to classify its own two offending files.
- **Renaming grove's `type: adr` to `type: decision`.** The org is split
  119/83 with neither word retreating, so synonymy is the honest end state,
  not a waypoint to one canon.
- **Charitable matching at guard time** — case folding, plurals, edit
  distance. Refused by `INV16` and by `guard-core`'s own standing comment:
  *deterministic classification beats charitable coverage*.
- **Per-repo classes or owed-set overrides.** That is policy, and policy in a
  consumer-authoritative file is a gate a consumer can lower unobserved.

## Open questions

- Whether `plan` and `rubric`, advertised by both grove READMEs and used by
  nothing here, should be dropped from the advertised enum or given classes.
- Vocabulary mapping cannot fix a *mistyped* artifact:
  `stewards/decisions/0001-family-delivery.md` declares `type: discovery`
  while being a decision, and clause 2 makes it reviewless rather than
  unclaimed. Whether grove owes a signal for that is unresolved.
