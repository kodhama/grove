---
id: adr-0043-structured-test-dependency-canary
type: adr
status: gated  # round-2 findings revised 2026-07-26; awaiting fresh independent decision-adversary review and the steward-profile human intent gate
depends_on: [adr-0005-tdd-and-artifact-gated-dispatch, adr-0006-operational-conformance-mechanism, adr-0010-versioning-is-operational, adr-0012-methodology-delivery-machinery, adr-0016-implements-edge-taxonomy, adr-0026-thin-vendor-boundary, adr-0036-remove-retired-review-bookkeeping]
owner: agent
updated: 2026-07-26
---

# ADR-0043: make test dependencies a structured advisory canary

## Decision state

### Decided

- **D1 — canonical YAML carrier** *(maintainer, 2026-07-26).* The canonical
  per-package carrier is `test-deps.yaml`, schema 2. The old fenced
  `test-deps.md` form remains readable as legacy input but is never written
  again.
- **D2 — named groups with explicit precision and hybrid selectors**
  *(maintainer, 2026-07-26).* One package ledger contains `exact` groups and
  transitional `coarse` groups. Exact members use package-relative files,
  optionally narrowed by collision-safe arrays of nested static test-title
  segments. A file-only exact selector is shorthand for every static test
  declaration in a uniform-provenance file; mixed-provenance files use title
  selectors. Coarse groups preserve only migrated legacy aggregates and say
  so explicitly. Globs are not permitted. A test declaration may belong to
  several groups.
- **D3 — one provenance home** *(maintainer, 2026-07-26).* Exact group
  membership—whole-file where uniform, title segments where mixed—satisfies
  the standing requirement that every test name the upstream it guards.
  Migrated coarse groups are a disclosed transitional exception, not false
  per-test provenance. Inline header/`describe` provenance becomes optional
  human navigation once the declaration has exact external coverage.
- **D4 — executor writes and migrates** *(maintainer, 2026-07-26).* The
  executor is the sole ordinary writer. It reads canonical, legacy, or absent
  state, but every write produces canonical YAML. Touching tests organically
  migrates a legacy package by preserving the old aggregate as explicitly
  coarse while making each new or touched declaration exact.
- **D5 — conformance reads without depending on presence** *(maintainer,
  2026-07-26).* The conformance reviewer prefers canonical YAML, accepts
  legacy Markdown and canonical coarse groups as coarse orientation, and
  continues without either. Canonical absence, legacy use, and valid coarse
  data permit `PASS` with advisories. A malformed canonical file is a
  blocking ledger-integrity failure even when the reviewer can complete the
  substantive fidelity assessment through other evidence.
- **D6 — pins are canaries, never verdicts** *(maintainer, 2026-07-26).* A
  lagging spec pin fires re-derivation; equality is quiet but proves no
  conformance. The executor writes the candidate target pin in the same
  change as the tests, and the independent conformance reviewer validates
  that candidate before merge.
- **D7 — strict schema** *(maintainer, 2026-07-26).* Schema 2 rejects unknown
  fields, unsupported schema values, unresolved required references,
  nonexistent test members, ambiguous exact title selectors, and uncovered
  discovered tests. Every new or touched declaration requires exact coverage;
  only untouched legacy declarations may remain coarse. Wrong-but-present
  canonical data never degrades silently into absence.
- **D8 — independent of retired bookkeeping** *(maintainer, 2026-07-26).*
  This is an agent-readable manifest and report-only staleness canary. It does
  not revive the deleted review-bookkeeping runtime, owed-map, verdict-record
  protocol, CI gate, or installer.

### Open

*(none)*

### Parked

- An empirical keep/change/remove experiment measuring whether the ledger
  actually improves conformance-review precision or catches useful drift.
- Cross-repository pin fetching. The no-fetch boundary remains.
- Any deterministic parser, audit command, CI integration, or enforcement
  runtime. ADR-0036 requires new authority, specification, and implementation
  for such machinery.

## Context

ADR-0006 introduced test dependencies for the right reason: a version
comparison is a cheap signal that an upstream moved, never a conformance
verdict. It also chose one ledger per package so tests did not need structured
YAML embedded in source. The landed form, however, accumulated two different
jobs:

1. a coarse package-wide selector for code's fidelity upstream; and
2. a proposed staleness canary for tests against versioned specs.

At the same time, the executor and dispatcher continued to require upstream
annotations inside every test. Grove therefore maintains the same provenance
twice: precise but scattered source comments and one aggregate machine block.
The aggregate cannot tell the reviewer which tests a stale spec pin affects.

The old deterministic runtime did not close that gap. It stripped `@version`
before id resolution and did not compare ledger pins to upstream versions.
ADR-0036 later deleted that retired runtime altogether. Five live Grove
packages still carry `test-deps.md`, and their human prose is often more
precise than their aggregate fenced blocks.

The desired job is narrower: converge on a map precise enough to resolve each
static test declaration and make a stale spec pin a canary that asks for
re-derivation, without pretending the legacy aggregate was already exact.
The ledger is orientation and trigger evidence. It is not itself proof, not
the only way to establish an upstream, and not a reason to skip conformance
when missing.

## Decision

### 1. Canonical schema

The canonical carrier is a file named `test-deps.yaml` at a test package's
root. Package lookup walks ancestors from the subject, deepest first. At each
directory it checks canonical `test-deps.yaml` before legacy `test-deps.md`;
a nearer legacy package therefore still wins over a more distant canonical
parent package.

Schema 2 has this shape:

```yaml
schema: 2
groups:
  record-freshness:
    precision: exact
    tests:
      - file: test/fingerprint.test.mjs
      - file: test/match.test.mjs
        cases:
          - title:
              - record freshness
              - rejects a record from an older basis
          - title:
              - record freshness
              - accepts a matching basis
    specs:
      - spec-0002-review-bookkeeping-check@v4
    decisions:
      - adr-0015-reviewer-machine-boundary
    defects:
      - grove#108
    covers:
      - INV3
    notes: |
      Optional reviewer orientation preserved from the legacy prose.
```

Top-level keys are exactly `schema` and `groups`. Each group name is unique.
Group keys are exactly:

- `precision` — required enum `exact` or `coarse`;
- `tests` — required, non-empty test selectors. Each selector has required
  `file`, an exact package-relative (never absolute filesystem) test-source
  path, and optional non-empty `cases`, a list of exact static test-title
  selectors within that file;
- `specs` — versioned fidelity contracts the tests exercise;
- `decisions` — append-only governing decisions that supply technical or
  end-to-end obligations but carry no version canary;
- `defects` — tracker references for regression provenance;
- `covers` — optional human-navigation anchors such as ACs, invariants, or
  scenarios; and
- `notes` — optional human explanation that is orientation, never an edge.

At least one of `specs`, `decisions`, or `defects` is required per group.
`specs`, `decisions`, and `defects` are distinct on purpose: only a versioned
spec entry is a pin-comparison canary. The other fields help a reviewer find
the governing evidence but do not masquerade as versioned fidelity edges.
Selector keys are exactly `file` and optional `cases`; unknown selector fields
are invalid. Each `cases` entry has exactly one key, `title`, whose value is a
non-empty array of non-empty strings.

For `precision: exact`, selector semantics are:

- Omitting `cases` selects every static test declaration in that file and is
  valid only when they share the group's upstreams.
- A mixed-provenance file uses `cases`. Its `title` array records the nested
  suite titles from outermost to innermost followed by the test title. Arrays
  preserve segment boundaries without inventing a separator or escaping rule.
- A parameterized or generated family is named once at its static declaration
  or generator call site. Its final title segment is the literal static title
  from source, including placeholders, rather than each runtime expansion.
- The complete title-segment array must identify exactly one static
  declaration in its file. If two declarations have the same complete array,
  the test source must rename one before either can use a case selector. This
  explicit uniqueness cost is preferable to a reorder-sensitive occurrence
  number or line-number identity.
- Renaming or moving a selected declaration requires updating its selector in
  the same change. Globs and partial title matching are invalid.

`precision: coarse` is valid only for a group produced by lossless legacy
migration. Its `tests` entries are file-only scope markers: they say the
legacy aggregate may concern declarations in those files, not that every
declaration has every listed upstream. `cases` is forbidden. A coarse group
therefore remains valid orientation/canary data but never satisfies exact
per-test provenance and must be reported as coarse.

Where canonical YAML exists, every discovered static test declaration in the
package must fall within at least one exact selector or coarse file scope.
Every new or touched declaration must be selected by at least one exact group;
only untouched declarations inherited from legacy may rely on coarse scope.
Multiple exact membership is valid because one declaration may cover several
contracts. File-only exact shorthand does not silently absorb a differently
governed new test: the executor must split that file into title selectors in
the same change. Inline comments may duplicate exact provenance as
non-authoritative navigation; mandatory inline provenance is removed only
after its declaration has exact external coverage.

Schema 2 is a strict operational manifest, not a lifecycle artifact.
Legacy `id`, `type`, `status`, `implements`, `depends_on`, `owner`, and
`updated` frontmatter is not copied as manifest metadata. Its semantic
upstreams and useful prose are translated into groups, `covers`, and `notes`.
This intentionally retires lifecycle decoration added to some legacy ledgers;
the optional canary is not independently ratified.

### 2. Pin semantics

A spec pin means: **this test group is proposed or recorded as having been
re-derived against that upstream version**.

- On the landed branch, `spec-x@vN` records the last target that passed
  independent conformance review.
- In a change under review, the executor may advance the entry to the current
  target version in the same change as any required tests or implementation.
  The new value is a candidate until the conformance reviewer passes the
  finished change.
- `pin < current` is a staleness signal that requests re-derivation.
- `pin == current` is quiet, never proof that the tests or implementation
  conform.
- `pin > current`, a malformed pin, or an unresolved local spec is invalid
  canonical data.
- Append-only decisions carry no `@version`; supersession is handled through
  their identity and history rather than a counter comparison.

A successful review may find that no test change is owed; the executor's
candidate pin still records that re-derivation. A failed or
`UPSTREAM-INDICTED` review does not earn the candidate pin.

A migrated coarse group's pin is preserved as legacy aggregate evidence. It
may advance only after independent conformance review of the whole coarse
scope; reviewing one touched declaration advances its exact group, not the
overlapping coarse group.

### 3. Writer contract: executor

The executor owns test creation and ledger maintenance.

- If canonical YAML exists, read and update it.
- If only legacy Markdown exists, read its first well-formed
  `grove-test-deps` block and its surrounding prose. Convert the aggregate
  dependencies losslessly into a `legacy-package` group with
  `precision: coarse` and file-only scope over the package's existing tests.
  Independently derive `precision: exact` groups for every new or touched
  declaration; do not infer that each declaration has every aggregate
  upstream.
- Preserve unique human guidance by translating it into group boundaries,
  `covers`, or `notes`. Translate a legacy `technical` entry into the
  appropriate decision, defect, or note; never silently discard it.
- Write deterministic schema-2 YAML only. Validate the written file and
  semantic parity before deleting `test-deps.md` in the same change. Reject
  unmatched, ambiguous, or nonexistent exact selectors and declarations
  outside both exact selectors and coarse scope.
- Never create or expand a coarse group except during lossless legacy
  conversion. Later writes may shrink or remove it as declarations acquire
  exact coverage.
- If neither form exists and the executor creates or changes tests, create
  canonical YAML with exact coverage for the package; absence supplies no
  legacy evidence from which a coarse group could truthfully be derived.

The executor never treats a pin bump as self-issued conformance. It hands the
finished code, tests, and candidate ledger to a separate conformance reviewer.

### 4. Reader contract: conformance reviewer

The conformance reviewer is read-only and independently establishes the
reviewable upstream. It reports which evidence mode it used:

- **canonical/exact** — all relevant schema-2 groups are exact;
- **canonical/coarse** — at least one relevant schema-2 group is coarse, with
  an advisory that it supplies package/file scope rather than per-test
  provenance;
- **legacy/coarse** — the nearest legacy aggregate; or
- **inferred** — no ledger, using independently verified evidence such as the
  approved artifact supplied at dispatch, changed tests, optional source
  anchors, and the producer hand-off.

Canonical absence is not a conformance failure. A substantive review may
return `PASS` with an advisory that the canary is unavailable. Legacy input or
valid canonical coarse input may likewise return `PASS` with a
migration/coarseness advisory.

This does **not** weaken ADR-0005's no-conversation rule. If the reviewer
cannot independently establish an approved upstream, the change still
`FAIL`s for having no reviewable contract. "No ledger" and "no upstream" are
different facts.

A malformed canonical file is different from absence: an explicit declaration
exists but cannot be trusted. The reviewer continues the semantic assessment
through legacy or inferred evidence and reports both dimensions, for example:

```text
Fidelity: PASS
Ledger integrity: FAIL — malformed canonical YAML
Overall: FAIL
```

The executor repairs the canonical file before the package is ready. A valid
legacy file may orient that repair but never makes malformed canonical data
valid.

If canonical and legacy files coexist at one package root, canonical is the
read basis and dual presence is a migration defect. They are never silently
unioned. The executor reconciles their semantic content and removes the legacy
file only after parity validation.

### 5. Routing and triggering

Ledger presence no longer determines whether changed code or tests owe
conformance. The dispatcher routes changed code/test work to the conformance
reviewer even when canonical and legacy ledgers are both absent. This removes
absence as a review bypass and lets the reviewer distinguish a missing
optional canary from ADR-0005's genuine no-contract failure.

The validator remains read-only. On an upstream version-bump trigger it may
use exact canonical groups to identify stale consumers precisely, canonical
coarse groups or legacy ledgers to flag their declared scope coarsely, or
absence to report that the canary is unobservable. It never advances pins and
never converts a pin comparison into a verdict.

Exact selector membership is the test-to-upstream naming act required by
`inv-graph-maintenance`. The Grove-specific rule that this name must also
appear in every test header is superseded; optional inline anchors remain
useful navigation but are not a second source of truth. A migrated coarse
group is explicitly transitional and does not claim to perform that naming
act for each declaration.

This decision also supersedes ADR-0006's self-describing-graph rule **only for
code/test provenance**. An optional `test-deps.yaml` group is intentionally
neither a durable artifact `implements:` edge nor a general `depends_on`
edge. A current code/test change remains discoverable from the change itself,
its dispatch artifact, tests, and producer hand-off; missing canary data is
therefore observable as a per-change advisory. The trade-off is explicit:
without a ledger, a later upstream-only change cannot discover that absent
consumer through graph traversal. That future-drift blind spot is accepted
for this advisory model and is part of the parked empirical/tooling question;
it must not be disguised as a self-describing edge.

### 6. No bookkeeping revival

This decision adds no deterministic runtime. Agent readers apply the declared
schema and semantics directly. Any future parser or audit command is new
machinery under ADR-0036: it requires its own approved specification and
implementation, and it remains report-only unless a still-later decision
authorizes enforcement.

In particular, this decision does not restore the deleted review-bookkeeping
check, PR verdict records, fingerprints, owed-map, policy carriers, CI
workflow, or installer.

## Considered and rejected

- **Keep Markdown as the canonical carrier.** Rejected: the authoritative
  payload is mechanical and hierarchical; wrapping YAML in prose obscures
  which part agents must preserve. Human guidance has explicit `covers` and
  `notes` homes in schema 2.
- **Use TOML.** Rejected: the group model is nested, the legacy payload is
  already YAML, and Grove's present zero-dependency TOML readers are scoped to
  flatter configuration shapes. TOML would add parser work without improving
  the model.
- **One file per test.** Rejected: it recreates the file proliferation
  ADR-0006 avoided. One package manifest can still carry exact declaration
  membership.
- **Glob membership.** Rejected: a new test would silently inherit a group,
  defeating the provenance canary.
- **Require complete exact derivation before replacing legacy Markdown.**
  Rejected: it defeats organic migration and makes any touched test contingent
  on reconstructing provenance the aggregate never recorded. Explicit
  `precision: coarse` preserves that uncertainty while new and touched
  declarations become exact.
- **Disambiguate duplicate title paths with line or occurrence numbers.**
  Rejected: both identities change under unrelated source movement or test
  reordering. Unique nested title arrays are also unambiguous in test output;
  migration must rename a duplicate when exact case selection needs it.
- **Keep mandatory inline annotations as well.** Rejected: duplicate required
  homes drift. Hybrid external selectors preserve per-declaration provenance
  while making one declaration serve the writer, reviewer, and staleness
  trigger.
- **Treat absence as failure.** Rejected: the ledger is advisory evidence, not
  the contract itself. ADR-0005 already supplies the correct failure:
  inability to establish a reviewable upstream.
- **Treat malformed canonical data as absence.** Rejected: wrong-but-present
  data signals explicit intent and must fail loudly.
- **Revive or adapt the retired deterministic check.** Rejected: ADR-0036
  deleted it and requires future machinery to start with new authority and a
  new specification.

## Consequences and propagation

This decision is authority only; it does not perform the implementation wave.
After approval, a specification and execution pass must:

1. amend the canonical `executor`, `conformance-reviewer`, `dispatcher`, and
   `validator` charters, plus generated Claude/Codex projections;
2. reconcile the `relations` and `versioning` companions: schema-2 ledger
   entries are advisory provenance/canary data, not the scalar
   `implements:` edge or general `depends_on`;
3. update the `<TEST_DEPS_LEDGER>` config-token description and any setup
   seed/default that names the legacy carrier;
4. migrate Grove's five stock ledgers without losing frontmatter relations,
   coverage prose, technical notes, or the distinction between coarse
   inherited evidence and exact new evidence;
5. update boundary and projection tests that name `test-deps.md`; and
6. specify and test canonical/legacy/absent/both/malformed behavior before
   removing mandatory inline test provenance from exactly covered
   declarations.

ADR-0006 is superseded in part for the ledger carrier, granularity, role
duties, absence behavior, and the self-describing-graph requirement as
applied to code/test provenance; its version-as-trigger principle remains.
ADR-0012 is superseded in part where it makes ledger presence the selector for
code conformance; its independent-review principle remains. ADR-0016 is
superseded in part where it treats the ledger as code's authoritative
`implements:` carrier; its edge taxonomy for typed artifacts remains.
ADR-0005's artifact-gated execution and no-reviewable-upstream failure remain
unchanged.

## Acceptance criteria

1. The canonical carrier is strict schema-2 `test-deps.yaml` with named
   `exact` or legacy-migrated `coarse` groups; canonical writers never emit
   the Markdown form.
2. Exact case selectors use collision-safe nested title-segment arrays and
   resolve uniquely within a package-relative file. Whole-file exact
   shorthand is valid only for uniform provenance; duplicate complete title
   arrays must be renamed before case selection. Inline provenance becomes
   optional only after exact external coverage exists.
3. Executor, conformance-reviewer, validator, and dispatcher responsibilities
   are separated as decided; no agent grades its own candidate pin.
4. Canonical, legacy, absent, both-present, and malformed-canonical states have
   explicit non-silent behavior.
5. Absence, legacy input, and valid canonical coarse groups permit substantive
   `PASS` with advisories; inability to establish an approved upstream still
   fails under ADR-0005.
6. A stale pin triggers review but never determines its verdict; a candidate
   pin advances in the same change the reviewer assesses.
7. Legacy migration preserves semantic dependencies and unique prose in an
   explicitly coarse group before deleting the old carrier. New and touched
   declarations require exact groups; coarse pins do not advance on a partial
   review.
8. No deterministic review-bookkeeping or CI machinery is revived.

## Review history

- **Decision-adversary round 1** reviewed exact commit
  `18a8ea8e576f8c83c9ad30ba6a289c265dfb8fc6` and returned
  `NEEDS-REVISION`: file-only membership could not resolve mixed-provenance
  tests; the optional ledger conflicted with ADR-0006's self-describing graph;
  unconditional coverage contradicted permitted absence; and predecessor
  frontmatter lacked partial-supersession edges. After the maintainer chose
  external-only hybrid selectors, this revision folds all four findings.
  The prior verdict remains part of the pull-request record; a fresh review
  must assess the revised exact commit.
- **Decision-adversary round 2** reviewed exact commit
  `b436103abb76257eb8f0c4c09166c958a454fa69` and returned
  `NEEDS-REVISION`. It confirmed the graph, conditional-coverage, and
  supersession findings closed, but found that delimiter-joined title paths
  could not name collisions and that migration mislabeled coarse aggregate
  evidence as exact. The maintainer accepted nested title-segment arrays with
  a uniqueness constraint and an explicit canonical `coarse` precision for
  legacy migration. This revision also removes the review's non-blocking stale
  statement about ADR-0027.

## Self-check

- **Internal coherence:** the ledger is optional evidence, so absence is
  advisory; migrated uncertainty remains explicitly coarse; malformed
  canonical data is blocking because an explicit declaration cannot be
  trusted. Conformance routing is independent of presence, preventing the
  optional carrier from becoming an escape hatch.
- **Standing decisions:** ADR-0005's no-contract failure is preserved.
  ADR-0006's canary principle is preserved while its carrier, duties, and
  code/test self-description rule are partially superseded, with the
  upstream-only drift blind spot disclosed. ADR-0012/ADR-0016's
  ledger-specific selector is superseded explicitly. ADR-0036's deleted
  machinery stays deleted.
- **Argument:** hybrid exact selectors remove duplicate inline declarations
  without weakening the per-test provenance invariant: uniform files use one
  file selector, while nested title arrays preserve segment identity for
  mixed and generated tests. Explicit coarse precision makes organic
  migration truthful. YAML follows the existing payload and supports the
  nested model; TOML would require a new shape.
- **Settled ground:** every `depends_on` target is approved. ADR-0027 remains
  approved with a valid partial-supersession edge; approved ADR-0036 supplies
  the operative no-runtime boundary.
- **Boundedness:** this ADR decides format, semantics, compatibility, and
  agent duties. It parks deterministic tooling and implementation.
- **Testability:** the acceptance criteria distinguish every input state,
  validate precision, exact file/static-title membership, and strict fields,
  and separate signal from verdict.

The self-check passes. The author moves the artifact to `gated` for
independent decision-adversary review. No approval is claimed.
