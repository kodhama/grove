---
id: spec-0005-structured-test-dependency-canary
type: spec
status: gated  # contract-author self-check passed 2026-07-26; awaiting independent spec convergence
implements: adr-0043-structured-test-dependency-canary
depends_on: [adr-0043-structured-test-dependency-canary]
owner: agent
updated: 2026-07-26
version: 1
---

# spec-0005 — structured test-dependency canary

## Scope

This specification defines the current contract for Grove's optional,
agent-readable test-dependency canary:

- canonical and legacy carrier discovery;
- strict schema-2 YAML and exact/coarse selector semantics;
- executor writing, migration, and candidate-pin behavior;
- conformance-reviewer, validator, and dispatcher behavior;
- the transition from mandatory inline provenance to one exact external home;
- Grove's companion, config, projection, stock-ledger, and test propagation;
  and
- the boundary that keeps deterministic review-bookkeeping machinery retired.

The canary supplies provenance, orientation, and a staleness signal. It is not
a lifecycle artifact, a conformance verdict, a required `implements:` edge, or
a general `depends_on` edge.

This specification does not authorize a deterministic parser, audit command,
CI integration, enforcement runtime, or revival of the removed
review-bookkeeping system.

## Terms

| Term | Meaning |
|---|---|
| **package root** | When a carrier exists, the directory containing the selected `test-deps.yaml` or legacy `test-deps.md`; selectors in that carrier are relative to this directory. When neither carrier exists and a writer needs to create one, the root established by the consuming repository's existing package or test-suite convention. |
| **subject** | The changed code or test file from which package lookup begins. |
| **static test declaration** | A source declaration or generator call site recognized as a test by the consuming repository's existing test conventions. Runtime expansions of one parameterized declaration are one static declaration. |
| **landed basis** | The repository state against which the unmerged change is compared. |
| **new declaration** | A static test declaration present in the change but absent from the landed basis. |
| **touched declaration** | A static test declaration whose declaration, test body, static title, enclosing static suite titles, generator call site/input/body, or source-file location differs from the landed basis. A helper-only change outside the declaration does not by itself mark the declaration touched. |
| **affected test declaration** | A declaration the reviewer independently establishes as exercising obligations affected by changed code, using the approved upstream, repository structure, test execution, and change impact rather than ledger membership alone. |
| **relevant group** | For a changed test, a selected canonical group whose exact selector or coarse file scope contains that new or touched declaration. For changed code, a selected canonical group whose selector or scope contains an independently established affected test declaration. |
| **complete title** | The ordered array of enclosing static suite titles, outermost first, followed by the static test title. |
| **canonical** | A `test-deps.yaml` manifest satisfying schema 2. |
| **legacy** | A `test-deps.md` whose first well-formed fenced `grove-test-deps` block supplies the old aggregate. |
| **group upstreams** | The entries in one group's `specs`, `decisions`, and `defects` lists. `covers` and `notes` are navigation/orientation and are not upstreams. |
| **exact group** | A schema-2 group whose selectors identify declarations that each have all of that group's upstreams. Membership does not assert that the group contains each declaration's complete upstream set. |
| **coarse group** | A schema-2 group created only by legacy migration; its file scope says which declarations may relate to the preserved aggregate without claiming that every declaration has every upstream. |
| **whole coarse scope** | All discovered static test declarations within every file-only selector of one coarse group. |
| **candidate pin** | A spec pin advanced in an unmerged change by the executor, pending independent conformance review. |
| **landed pin** | A spec pin on the landed branch, recording the last target version against which the group passed independent conformance review. |

## Carrier discovery

For a subject, lookup walks from the subject's directory toward the repository
root, deepest directory first. At each directory:

1. if `test-deps.yaml` exists, it is the selected carrier;
2. otherwise, if `test-deps.md` exists, it is the selected carrier; and
3. otherwise, lookup continues to the parent.

Selection stops at the first directory containing either carrier. Therefore, a
nearer legacy carrier wins over a more distant canonical carrier. If both
carriers exist at the same package root, canonical is the read basis and dual
presence is a migration defect; their contents are never unioned.

When neither carrier exists and the executor must create canonical data, it
uses the consuming repository's existing package or test-suite convention to
locate the root. Examples of evidence include an existing package manifest,
test command boundary, or sibling suite layout already used by that
repository. This contract does not define a universal package detector. If the
repository supplies no unambiguous existing convention, the executor surfaces
the missing boundary instead of inventing one.

## Canonical schema

A canonical manifest has exactly these top-level fields:

```yaml
schema: 2
groups:
  "group-name":
    precision: exact
    tests:
      - file: "test/example.test.mjs"
        cases:
          - title:
              - "outer suite"
              - "guarded behavior"
    specs:
      - "spec-example@v2"
    decisions:
      - "adr-example"
    defects:
      - "project#123"
    covers:
      - "INV4"
    notes: "Optional reviewer orientation."
```

`schema` is the integer `2`. `groups` is a non-empty mapping whose keys are
unique, non-empty strings within the manifest.

Each group has only these fields:

| Field | Requirement |
|---|---|
| `precision` | Required; exactly `exact` or `coarse`. |
| `tests` | Required; a non-empty list of test selectors. |
| `specs` | Optional list of versioned fidelity-contract references. |
| `decisions` | Optional list of append-only governing-decision references. |
| `defects` | Optional list of tracker references for regression provenance. |
| `covers` | Optional human-navigation anchors such as acceptance criteria, invariants, or scenarios. |
| `notes` | Optional human explanation; orientation only, never an artifact edge. |

At least one of `specs`, `decisions`, or `defects` contains an entry in every
group.

Group value shapes are:

- `precision` is a string with one of the two enumerated values;
- `tests`, `specs`, `decisions`, `defects`, and `covers`, when present, are
  lists;
- every `specs`, `decisions`, `defects`, and `covers` element is a non-empty
  string; and
- `notes`, when present, is a string.

This shape contract does not add identifier grammar beyond the reference
semantics stated below.

A group's upstreams are exactly its `specs`, `decisions`, and `defects`
entries. `covers` and `notes` provide navigation or orientation only and do
not participate in selector provenance.

A test selector has exactly:

- required `file`: an existing test-source file expressed as an exact,
  package-relative path; and
- optional `cases`: a non-empty list of case selectors.

A case selector has exactly one field, `title`. `title` is a non-empty array
of non-empty strings.

Unknown fields, duplicate mapping keys, unsupported schema values, empty
required collections, malformed references, unresolved required local
references, absolute paths, globs, partial-title matches, nonexistent test
files, nonexistent selected declarations, ambiguous exact case selectors,
non-scalar Unicode input, and U+FFFE/U+FFFF in a schema string make canonical
data malformed.

Only `specs` entries carry version canaries. A local spec entry includes its
version, for example `spec-example@v2`, and resolves to a versioned local
specification. Decisions are append-only identifiers without `@version`.
Defects remain tracker references rather than pretending to be versioned
artifact edges. Cross-repository pin fetching is not performed.

The manifest is an operational YAML document, not a lifecycle artifact.
Legacy `id`, `type`, `status`, `implements`, `depends_on`, `owner`, and
`updated` frontmatter fields do not become top-level schema-2 fields.

## Canonical serialization

Every executor write uses one byte-observable serialization:

- UTF-8 without a byte-order mark;
- LF line endings, no tabs, two spaces per indentation level, no trailing
  whitespace, and exactly one final newline;
- no YAML directives, document-start (`---`) or document-end (`...`) markers,
  comments, blank lines, explicit tags, anchors, or aliases;
- block mappings and block lists only;
- top-level fields in order: `schema`, `groups`;
- group names ordered lexicographically by Unicode scalar value;
- group fields in order: `precision`, `tests`, `specs`, `decisions`,
  `defects`, `covers`, `notes`, with absent optional fields omitted;
- test selectors ordered first by `file`, then by their canonical case-list
  representation, with absent `cases` represented by the empty sequence and
  sorting before a non-empty case list; `file` precedes `cases` within a
  selector;
- case selectors ordered lexicographically by their complete title arrays;
  `title` segment order within each array remains outermost-to-innermost and
  is never sorted;
- `specs`, `decisions`, `defects`, and `covers` entries ordered
  lexicographically by their complete string values;
- fixed schema field names emitted as the plain spellings shown in this
  specification, `schema` emitted as plain integer `2`, and `precision`
  emitted as plain `exact` or `coarse`; and
- every other string scalar, including group names, paths, references,
  title segments, covers, and notes, emitted as a double-quoted,
  JSON-compatible string: `"` is `\"`, `\` is `\\`, solidus is not escaped,
  U+0008/U+0009/U+000A/U+000C/U+000D use `\b`/`\t`/`\n`/`\f`/`\r`,
  respectively, any other U+0000–U+001F control uses `\u00XX` with uppercase
  hex digits, U+007F–U+009F use `\u00XX` with uppercase hex digits,
  U+2028/U+2029 use `\u2028`/`\u2029`, and every other accepted Unicode
  scalar value is emitted directly as UTF-8.

Every schema string is a sequence of Unicode scalar values. U+FFFE and U+FFFF
are rejected as not representable by this YAML contract, even through an
escape. An input containing an unpaired UTF-16 surrogate is not a Unicode
scalar sequence and is likewise rejected before serialization. Other accepted
strings, including U+0000–U+001F and U+007F–U+009F, are representable through
the escapes fixed above.

Every lexicographic comparison above compares Unicode scalar values in order;
when one sequence is an exact prefix of another, the shorter sequence sorts
first.

Lists use one item per line. Empty optional lists are omitted. An explicitly
present empty `notes` string is serialized as `notes: ""`. The policy
preserves semantic title-array order while removing map, field, list, scalar,
encoding, indentation, and newline degrees of freedom. Rewriting an unchanged
semantic manifest therefore produces identical bytes.

The physical line grammar is exactly:

```text
schema: 2
groups:
  "<group-name>":
    precision: exact|coarse
    tests:
      - file: "<path>"
        cases:
          - title:
              - "<outer-title>"
              - "<test-title>"
    specs:
      - "<spec>"
    decisions:
      - "<decision>"
    defects:
      - "<defect>"
    covers:
      - "<anchor>"
    notes: "<notes>"
```

The metavariables above stand for the canonical double-quoted scalars; the
literal `exact|coarse` means exactly one chosen enum value, not the pipe
characters. Optional group fields and a selector's optional `cases` block are
omitted completely when absent. Repeated groups, selectors, cases, title
segments, and scalar-list items repeat their corresponding shown lines
consecutively with no intervening blank line.

Each mapping key whose value is a nested collection is followed immediately
by `:` and LF. Each mapping key whose value is a scalar is followed by `:`,
one ASCII space, the scalar, and LF. Each sequence entry begins at the shown
indent with `-` followed by one ASCII space. `file` and `title` are written on
the same physical line as their sequence dash exactly as shown; every scalar
list item is written on the same physical line as its dash. No other spaces
occur except the shown indentation, the single post-colon/post-dash spaces,
and spaces encoded inside double-quoted string values.

The first physical line is `schema: 2`; the second is `groups:`. The first
group begins on the third line. Each following group begins on the physical
line immediately after the preceding group's last field or list item. The
file ends immediately after the LF terminating the last group's last field or
list item.

This serialization policy is a writer contract applied by the executor. It
does not add a general parser, audit command, or runtime.

## Exact selector semantics

An exact selector without `cases` selects every static test declaration in
the named file. This shorthand asserts that every selected declaration has
all of the group's upstreams. It does not assert that those are the
declaration's complete upstream set; a declaration may gain additional
upstreams through narrower exact groups.

An exact selector with `cases` selects only the declarations named by its
complete title arrays:

- array elements preserve title-segment boundaries;
- enclosing suite titles appear outermost to innermost;
- the final element is the test declaration's literal static title;
- a parameterized or generated family uses the static title at its declaration
  or generator call site, including literal placeholders;
- each complete title resolves to exactly one static declaration in the file;
  and
- duplicate complete titles must be renamed in the test source before either
  declaration can be selected by title.

Line numbers and occurrence numbers are not declaration identity. Renaming or
moving a selected declaration updates its selector in the same change.

A declaration may belong to more than one exact group. Where canonical YAML
exists, every discovered static test declaration is covered by at least one
exact selector or one coarse file scope. Every new or touched declaration has
exact coverage.

New and touched status is determined by comparing the change with the landed
basis. A declaration is new when no corresponding static declaration exists
in that basis. A declaration is touched when the change modifies its source
declaration, test body, static title, enclosing static suite titles, generator
call site/input/body, or source-file location. A helper-only change outside
the declaration does not by itself make the declaration touched. When a
declaration cannot be matched confidently across the basis because of an
ambiguous dynamic construction, the executor surfaces the ambiguity and
establishes exact coverage before declaring the package ready.

If a new declaration in a file-only exact selector retains every upstream
asserted by that group and has additional upstreams, the executor keeps the
whole-file shorthand and adds narrower exact group membership for the
additional upstreams. It splits the whole-file selector into title selectors
only when at least one selected declaration lacks an upstream asserted by the
whole-file group. No selector may overstate an upstream while additive group
membership remains composable.

## Coarse selector semantics

A coarse group:

- is created only during lossless migration from legacy Markdown;
- uses file-only test selectors;
- never contains `cases`;
- preserves the legacy aggregate as orientation and canary evidence;
- does not claim that every declaration in a listed file has every listed
  upstream; and
- does not satisfy exact per-declaration provenance.

The executor never creates or expands a coarse group after the migration that
introduced it. Later writes may shrink or remove the group as declarations
gain exact coverage. Only untouched declarations inherited from legacy may
continue to rely on coarse scope.

## Pin semantics

A spec pin records the version against which a group is proposed or recorded
as having been re-derived.

- A landed pin records the last target that passed independent conformance
  review.
- A pin behind the current upstream version is a staleness signal that
  requests re-derivation.
- A pin equal to the current upstream version is quiet and proves no
  conformance.
- A pin ahead of the current upstream, a malformed pin, or an unresolved local
  spec pin is invalid canonical data.
- An append-only decision carries no version pin.

The executor advances a candidate pin in the same change as the tests and any
implementation needed for the target version. When the executor's own
re-derivation finds that current implementation and tests require no change,
it may instead propose a manifest-only candidate-pin change. In either form,
the candidate does not become a landed assertion of review until a separate
conformance reviewer independently checks the current implementation and
tests against the current approved upstream and passes the finished change.

A successful conformance review may advance a candidate even when
re-derivation finds that no test or implementation change is required. A
failed or `UPSTREAM-INDICTED` review does not earn the candidate pin.

A migrated coarse pin may advance only after independent conformance review
of the whole coarse scope: all discovered static declarations within every
file-only selector of that group. Reviewing one touched declaration may
advance its exact group but does not advance an overlapping coarse group.

## Writer contract — executor

The executor is the sole ordinary writer of the canary.

When canonical YAML exists, the executor reads, validates, and updates it.
Every write emits deterministic schema-2 YAML; the same semantic manifest
written repeatedly is byte-stable.

When only legacy Markdown exists, the executor:

1. reads the first well-formed fenced `grove-test-deps` block and the
   surrounding human prose;
2. enumerates the package's existing test files;
3. converts the aggregate dependencies into a `legacy-package` group with
   `precision: coarse` and file-only scope over those existing tests;
4. independently derives exact groups for every new or touched declaration;
5. preserves unique guidance through group boundaries, `covers`, or `notes`;
6. translates each legacy `technical` entry into the applicable decision,
   defect, or note rather than discarding it;
7. translates semantic legacy frontmatter relations into group evidence
   rather than copying lifecycle decoration;
8. validates schema, selector resolution, declaration coverage, and semantic
   parity; and
9. deletes `test-deps.md` in the same change only after that validation
   passes.

Migration does not infer that each declaration has every legacy aggregate
upstream.

When neither carrier exists and the executor creates or changes tests, it
creates canonical YAML with exact coverage for every discovered static test
declaration in the package. Absence supplies no legacy evidence from which a
coarse group can be created; exact coverage is therefore required for the
whole package at canonical creation, not only for new or touched
declarations.

When a present legacy file contains no well-formed `grove-test-deps` block, it
supplies no aggregate from which a coarse group can be derived. The executor
does not pretend otherwise. Before writing canonical or removing legacy, it
independently derives exact coverage for every discovered static declaration
in the package and preserves any unique usable prose as `notes`. If complete
exact derivation or preservation cannot be established, the executor leaves
the legacy file untouched, writes no partial canonical file, and surfaces a
blocking migration defect. Legacy deletion remains contingent on complete
exact coverage and validation that no semantic guidance was lost.

When canonical and legacy carriers coexist at the same root, the executor
uses canonical as the update basis, reconciles the legacy semantic content,
validates parity, and removes legacy only after validation. It never silently
unions the carriers.

Before hand-off, the executor validates that:

- canonical syntax and fields satisfy schema 2;
- every selected file and exact declaration exists;
- each exact title is unique within its file;
- every discovered declaration is within exact or coarse scope;
- every new or touched declaration is exact;
- required local upstreams resolve;
- pin ordering is valid; and
- migration preserved the legacy aggregate and unique prose.

The executor hands the finished code, tests, and candidate manifest to a
separate conformance reviewer. It never treats its own validation or pin
write as a conformance verdict.

## Reader contract — conformance reviewer

The conformance reviewer is read-only. It independently establishes the
approved upstream and reports the evidence mode used:

| Mode | Meaning |
|---|---|
| `canonical/exact` | Every relevant canonical group is exact. |
| `canonical/coarse` | At least one relevant canonical group is coarse; it provides only package/file scope. |
| `legacy/coarse` | The selected evidence is a legacy aggregate. |
| `inferred` | No relevant usable ledger evidence exists; the reviewer uses independently verified evidence such as the approved dispatch artifact, changed tests, optional source anchors, and producer hand-off. |

For changed tests, relevant canonical groups are the groups selecting each
new or touched declaration. For changed code, the reviewer first establishes
the affected test declarations independently from the approved upstream,
repository structure, observed test execution, and change impact; only then
are groups selecting those declarations relevant. Ledger membership does not
decide which tests code affects.

The evidence mode is `canonical/exact` only when every relevant group is
exact. It is `canonical/coarse` when at least one relevant group is coarse,
even if other relevant groups are exact. If no relevant canonical group can
be established for changed code, the reviewer does not claim canonical
precision; it reports `inferred` evidence and explains how affected tests and
the upstream were established. If canonical coverage omits a discovered
affected declaration, that omission is malformed canonical data under the
coverage rule.

Canonical absence does not fail conformance. Legacy input and valid canonical
coarse data do not fail conformance. Any of those states may accompany a
substantive `PASS`, with an advisory that the canary is absent, legacy, or
coarse.

A present legacy file with no well-formed `grove-test-deps` block is unusable
legacy evidence rather than malformed canonical data. The reviewer falls to
`inferred` mode, advises that the legacy carrier was present but unusable, and
continues if it can independently establish the approved upstream.
This is read-only behavior for an untouched review. It does not authorize the
executor to write partial canonical data: a write invokes the package-wide
exact migration gate in the writer contract.

If the reviewer cannot independently establish an approved upstream, the
change fails for having no reviewable contract. Missing ledger data and
missing upstream authority are different findings.

Malformed canonical data is a blocking ledger-integrity failure. The reviewer
still performs the substantive fidelity assessment through independently
verified legacy or inferred evidence and reports both dimensions:

```text
Fidelity: PASS | FAIL | UPSTREAM-INDICTED
Ledger integrity: PASS | FAIL — reason
Overall: PASS | FAIL | UPSTREAM-INDICTED
```

Any ledger-integrity failure makes the overall result `FAIL` until the
executor repairs the canonical file, even when fidelity itself passes. A
legacy carrier may orient repair but cannot make malformed canonical data
valid.

When malformed canonical YAML and legacy Markdown coexist at one root, the
reviewer may read the legacy block independently as coarse fidelity
orientation. It does not merge legacy fields into canonical, does not use
legacy to validate canonical, and does not let usable legacy evidence cure the
canonical integrity failure.

Dual presence at one package root is a migration defect. Canonical remains the
read basis, the files are not unioned, and the defect blocks readiness until
the executor reconciles and removes legacy after parity validation.

For a candidate pin, the reviewer derives the obligations from the current
approved upstream rather than trusting pin equality or the executor's
checklist. A passing review validates the candidate for landing; any other
fidelity verdict does not.

For a manifest-only candidate, the reviewer inspects and exercises the current
landed implementation and tests against those independently derived
obligations. The absence of a code/test diff is evidence only that the
executor proposed no behavioral change; it does not reduce review scope or
turn the executor's re-derivation into a verdict.

## Trigger and routing contracts

The dispatcher routes changed code and tests to the conformance reviewer
whether the selected evidence is canonical, legacy, absent, dual-present, or
malformed. Ledger presence never decides whether conformance is owed.

The validator is read-only. On an upstream version-bump trigger it:

- identifies stale declarations precisely from exact canonical groups;
- flags the declared file scope from coarse canonical groups or legacy
  aggregates, explicitly as coarse;
- reports the canary as unobservable when no ledger exists; and
- never advances a pin or converts comparison into a conformance verdict.

Without a ledger, an upstream-only change cannot discover the absent consumer
through ledger traversal. That accepted advisory-model blind spot is not
reported as a self-describing graph edge.

## Inline provenance transition

Exact group membership is the authoritative test-to-upstream naming act.
Inline header or `describe` provenance is optional human navigation only
after the declaration has exact external coverage.

An executor may remove mandatory inline provenance from a declaration only in
the same change that establishes and validates its exact external coverage.
Declarations relying on legacy or canonical coarse evidence retain their
existing inline provenance until they gain exact coverage. Optional inline
anchors never override or conflict with the canonical manifest.

## Grove propagation

The implementation wave updates these authored methodology surfaces:

1. `charters/executor.md`;
2. `charters/conformance-reviewer.md`;
3. `charters/dispatcher.md`;
4. `charters/validator.md`;
5. `charters/relations.md`; and
6. `charters/versioning.md`.

The charter changes state the role duties in this specification. The
relations companion states that manifest entries are advisory provenance and
canary data, not a scalar `implements:` edge or general `depends_on`. The
versioning companion states last-reviewed target, candidate, lagging,
equal-current, ahead-of-current, and coarse-pin semantics once.

The repository's projection generator refreshes the changed canonical
charters' Claude and Codex projections, reference copies, digest-bearing
inventories, launchers, and allowlist outputs. Generated surfaces are not
hand-edited. Projection checks prove generated output is current with the
canonical sources.

The implementation updates the `<TEST_DEPS_LEDGER>` description in
`.grove/config.toml` to name nearest-ancestor canonical `test-deps.yaml`,
legacy read fallback, and the verified-prior behavior. Any setup seed or
default that names the old carrier is updated to the same convention. The
token name remains `TEST_DEPS_LEDGER`.

The implementation migrates all five Grove stock ledgers:

- `tooling/grove/build/test-deps.md`;
- `tooling/grove/probes/test-deps.md`;
- `tooling/grove/release/test-deps.md`;
- `tooling/grove/tests/gates/test-deps.md`; and
- `tooling/grove/tests/lifecycle/test-deps.md`.

Each becomes `test-deps.yaml`. Migration preserves semantic frontmatter
relations, aggregate dependencies, coverage prose, and technical notes in
schema-2 groups without copying lifecycle metadata. Inherited uncertainty is
represented as coarse; declarations whose provenance is independently
established during the wave may be exact.

Boundary and projection tests that name `test-deps.md`, fenced
`grove-test-deps`, or schema 1 are updated to assert the canonical carrier and
the generated role/companion contract. Verification covers canonical,
legacy, absent, dual-present, and malformed-canonical behavior before the
implementation removes mandatory inline provenance from any exactly covered
declaration.

## Retired-machinery boundary

No deliverable in this implementation wave adds or revives:

- a deterministic schema parser or audit command;
- the removed review-bookkeeping runtime;
- a machine-computed owed map;
- verdict-record or fingerprint protocols;
- a review policy carrier;
- a CI or branch-protection gate;
- a review-bookkeeping workflow; or
- an installer for any such mechanism.

Schema validation in this wave is performed by the responsible agents and by
bounded repository tests over the authored/projected files. Any future
general parser, audit command, CI integration, or enforcement runtime requires
new approved authority, a separate specification, and a separate
implementation.

## Invariants

- **INV1 — canonical name.** Where a package has canonical test-dependency
  data, it shall store it in `test-deps.yaml` at the package root with
  `schema: 2`.
- **INV2 — legacy read only.** When only `test-deps.md` is selected, an agent
  shall read its first well-formed `grove-test-deps` block as legacy input,
  and no writer shall emit or update the Markdown carrier.
- **INV3 — nearest carrier.** When resolving a subject, lookup shall select
  the deepest ancestor containing either carrier and shall prefer canonical
  over legacy only within the same directory.
- **INV4 — strict top level.** A canonical manifest shall contain exactly
  `schema` and `groups`, with schema integer `2` and a non-empty group
  mapping.
- **INV5 — strict groups.** Each canonical group shall use only
  `precision`, `tests`, `specs`, `decisions`, `defects`, `covers`, and
  `notes`; its name shall be a non-empty string; it shall have valid
  `precision`, non-empty `tests`, and at least one entry across `specs`,
  `decisions`, and `defects`; list-valued fields shall be lists, each
  reference/navigation element shall be a non-empty string, and `notes` shall
  be a string when present.
- **INV6 — strict selectors.** Each test selector shall contain exact
  package-relative `file` and optional non-empty `cases`; each case shall
  contain only a non-empty `title` array of non-empty strings.
- **INV7 — field rejection.** When canonical data contains an unknown field,
  duplicate key, unsupported schema, invalid required reference, nonexistent
  member, glob, partial title, or ambiguous exact title, the reader shall
  classify the canonical file as malformed.
- **INV8 — exact whole-file shorthand.** When an exact selector omits
  `cases`, every static test declaration in that file shall have every
  `specs`, `decisions`, and `defects` upstream asserted by the group; the
  selector shall not claim those are each declaration's complete upstream
  set.
- **INV9 — collision-safe case identity.** An exact case title shall record
  nested static suite-title segments followed by the literal static test
  title and shall resolve to exactly one declaration in its file.
- **INV10 — generated declaration identity.** When a declaration is
  parameterized or generated, exact coverage shall name its static
  declaration or generator call site once, including literal placeholders,
  rather than runtime expansions.
- **INV11 — exact change coverage.** Whenever a test declaration is new,
  moved, renamed, or otherwise touched, the executor shall give it exact
  coverage in the same change.
- **INV12 — conditional package coverage.** While canonical YAML exists,
  every discovered static test declaration shall be within exact selector or
  coarse file scope; while no ledger exists, absence shall remain advisory.
- **INV13 — multiple contracts.** When a declaration covers several
  contracts, schema 2 shall permit it to belong to several exact groups;
  `covers` and `notes` shall not count as group upstreams.
- **INV14 — truthful coarse scope.** A coarse group shall originate only
  from legacy conversion, contain file-only selectors, and shall not assert
  per-declaration provenance.
- **INV15 — coarse monotonicity.** After legacy conversion, the executor shall
  never create or expand coarse scope and may only shrink or remove it as
  exact coverage grows.
- **INV16 — one provenance home.** Exact manifest membership shall be the
  authoritative test-to-upstream naming act; inline provenance shall become
  optional only after exact external coverage exists.
- **INV17 — pin as signal.** A lagging spec pin shall trigger
  re-derivation, while an equal-current pin shall remain quiet without being
  treated as proof.
- **INV18 — candidate independence.** When the executor advances a spec pin,
  it shall write the candidate in the same change as any required code/tests
  or as a manifest-only proposal after executor re-derivation finds no such
  change; a separate conformance reviewer shall validate current
  implementation and tests against the current approved upstream before
  landing.
- **INV19 — invalid pins.** A pin ahead of current, malformed, or unresolved
  locally shall make canonical data invalid; decisions shall carry no
  `@version`.
- **INV20 — coarse pin scope.** A coarse pin shall advance only after review
  of all discovered static declarations within every file-only selector of
  that coarse group, never after review of only one overlapping exact
  declaration.
- **INV21 — sole ordinary writer.** The executor shall be the sole ordinary
  writer and shall emit schema-2 YAML on every write using the canonical
  encoding, indentation, newline, scalar, map, field, selector, and list
  ordering policy.
- **INV22 — lossless migration.** When migrating legacy Markdown, the
  executor shall preserve aggregate dependencies, semantic frontmatter
  relations, unique prose, coverage anchors, and technical notes before
  deleting the legacy carrier.
- **INV23 — migration precision.** During migration, the executor shall
  preserve inherited aggregate uncertainty as coarse and shall derive exact
  groups independently for every new or touched declaration.
- **INV24 — deletion gate.** The executor shall delete legacy Markdown only
  after canonical schema, selector resolution, declaration coverage, and
  semantic parity validation pass.
- **INV25 — absent writer state.** When neither carrier exists and the
  executor creates or changes tests, it shall create canonical exact coverage
  for every discovered static declaration in the package and shall not invent
  coarse legacy evidence.
- **INV26 — read-only reviewer.** The conformance reviewer shall not edit a
  manifest or advance a pin and shall independently establish the approved
  upstream.
- **INV27 — evidence disclosure.** The conformance reviewer shall report
  `canonical/exact`, `canonical/coarse`, `legacy/coarse`, or `inferred`
  evidence mode.
- **INV28 — advisory incomplete evidence.** When the selected evidence is
  absent, legacy, or valid canonical coarse data and an approved upstream is
  independently established, the reviewer shall permit a substantive `PASS`
  with an absence, migration, or coarseness advisory.
- **INV29 — no-contract failure.** When no approved upstream can be
  independently established, the reviewer shall fail the change regardless
  of ledger state.
- **INV30 — malformed blocks.** When canonical data is malformed, the
  reviewer shall continue the substantive fidelity assessment through
  independently verified evidence but shall report ledger integrity and
  overall readiness as `FAIL`.
- **INV31 — dual-presence handling.** When both carriers exist at one root,
  readers shall use canonical without union, report a migration defect, and
  require executor reconciliation before readiness.
- **INV32 — unconditional routing.** When code or tests change, the dispatcher
  shall route conformance regardless of ledger presence or validity.
- **INV33 — validator boundary.** On a version-bump trigger, the validator
  shall report exact stale membership precisely, coarse or legacy scope
  coarsely, and absence as unobservable; it shall not advance pins or verdict
  conformance.
- **INV34 — advisory graph boundary.** The methodology shall not represent
  schema-2 groups as durable `implements:` or general `depends_on` edges and
  shall disclose the upstream-only drift blind spot when the canary is absent.
- **INV35 — authored propagation.** The execution wave shall update the four
  role charters, two companions, config-token convention, applicable setup
  seed/default, all five stock ledgers, and boundary/projection tests named in
  this specification.
- **INV36 — projection integrity.** After authored charter or companion
  changes, the projection generator shall refresh all derived host surfaces
  and digest-bearing metadata, and projection checks shall pass.
- **INV37 — stock migration.** Each of Grove's five stock packages shall end
  with `test-deps.yaml` and without its former `test-deps.md`, with legacy
  semantics preserved truthfully.
- **INV38 — transition ordering.** Before mandatory inline provenance is
  removed from a declaration, the implementation shall establish and verify
  its exact external coverage and the state-behavior contract.
- **INV39 — no runtime revival.** The execution wave shall add no
  deterministic parser, audit command, review-bookkeeping runtime, owed-map,
  verdict-record protocol, CI enforcement, or installer.
- **INV40 — absent-root convention.** When neither carrier exists and a
  writer needs a package root, the executor shall use the consuming
  repository's existing package or test-suite convention and shall surface an
  ambiguous or missing boundary rather than invent a universal detector.
- **INV41 — landed change basis.** The executor shall classify a declaration
  as new or touched by comparison with the landed basis, including changes to
  its declaration, body, static title, enclosing static suites, generator
  call site/input/body, or source-file location as applicable.
- **INV42 — relevant-group precision.** The conformance reviewer shall derive
  relevant groups from new/touched test declarations or independently
  established affected tests for changed code, shall report
  `canonical/exact` only when every relevant group is exact, and shall report
  `canonical/coarse` when any relevant group is coarse.
- **INV43 — unusable legacy fallback.** When a present legacy file has no
  well-formed `grove-test-deps` block, the reviewer shall treat it as unusable
  legacy evidence, fall to `inferred` mode with an advisory, and shall not
  classify it as a malformed-canonical integrity failure.
- **INV44 — fallback isolation.** When canonical data is malformed, any
  same-root legacy evidence used for independent fidelity orientation shall
  not be unioned with canonical data, validate it, or cure its blocking
  integrity failure.
- **INV45 — canonical bytes.** For the same semantic manifest, executor
  writes shall produce identical UTF-8 bytes by applying the canonical
  serialization policy and shall add no parser, audit command, or runtime.
- **INV46 — unusable-legacy write gate.** When a present legacy file has no
  well-formed dependency block, the executor shall write canonical and remove
  legacy only after deriving exact coverage for every discovered declaration
  and preserving usable guidance; if it cannot, it shall leave legacy
  untouched, write no partial canonical, and surface a blocking migration
  defect.
- **INV47 — additive upstream composition.** Group upstreams shall be exactly
  `specs`, `decisions`, and `defects`; when a declaration in a whole-file
  exact group retains all group upstreams and gains additional upstreams, the
  executor shall retain shorthand and add narrower exact groups; it shall
  split shorthand only when a selected declaration lacks a group upstream.
- **INV48 — manifest-only pin review.** When executor re-derivation finds no
  code/test change is required, it may propose a manifest-only candidate pin,
  but only a separate conformance `PASS` after independent assessment of the
  current implementation and tests shall make that candidate eligible to
  land.
- **INV49 — canonical physical grammar.** Canonical output shall use exactly
  the specified mapping/sequence lines, indentation, colon/dash spacing, and
  terminal LF, and shall contain no BOM, directives, document markers,
  comments, blank lines, tags, anchors, aliases, tabs, trailing whitespace, or
  unprescribed spaces.
- **INV50 — serializable scalar domain.** Every accepted schema string shall
  be a Unicode scalar sequence excluding U+FFFE/U+FFFF; serialization shall
  escape U+0000–U+001F, U+007F–U+009F, U+2028, and U+2029 exactly as
  specified so every accepted string produces valid one-line YAML scalar
  bytes.

## Scenarios

### S1 — canonical wins at one package root

**Given** a package root contains valid `test-deps.yaml` and
`test-deps.md`
**When** an agent resolves test-dependency evidence for a subject below that
root
**Then** it uses canonical as the read basis, does not union the files, and
reports dual presence as a migration defect.

### S2 — a nearer legacy package wins

**Given** the nearest ancestor with a carrier contains only `test-deps.md` and
a more distant ancestor contains `test-deps.yaml`
**When** an agent resolves the subject's package
**Then** it selects the nearer legacy carrier, reports `legacy/coarse`
evidence, and may return substantive `PASS` with a migration advisory when
the approved upstream is independently established.

### S3 — no carrier but an approved upstream

**Given** neither carrier exists and the reviewer independently establishes an
approved upstream from the dispatch artifact and changed tests
**When** the reviewer completes fidelity assessment
**Then** it may return substantive `PASS` with `inferred` mode and an advisory
that the canary is unavailable.

### S4 — no carrier and no approved upstream

**Given** neither carrier exists and no approved upstream can be independently
established
**When** conformance is reviewed
**Then** the change fails for having no reviewable contract rather than for
ledger absence.

### S5 — malformed canonical with usable fallback evidence

**Given** selected canonical YAML is malformed and legacy or inferred evidence
still identifies an approved upstream
**When** conformance is reviewed
**Then** the reviewer completes fidelity assessment, reports ledger integrity
`FAIL`, and returns overall `FAIL` until the executor repairs canonical data.

### S6 — strict unknown-field rejection

**Given** a schema-2 manifest contains an unknown field at the top level,
group, selector, or case level
**When** an agent validates it
**Then** the manifest is malformed and the unknown field is not ignored.

### S7 — lossless legacy migration

**Given** a package has only a well-formed legacy ledger and the executor
touches one test declaration
**When** the executor writes test-dependency data
**Then** it creates canonical schema 2, preserves the aggregate in a
file-scoped `legacy-package` coarse group, gives the touched declaration exact
coverage, preserves unique prose and semantic relations, validates parity,
and removes the Markdown carrier.

### S8 — first manifest for an absent package

**Given** a package has no carrier and the executor creates a test
**When** it completes the test change
**Then** it creates `test-deps.yaml` with exact coverage for every discovered
static test declaration in the package and creates no coarse group.

### S9 — uniform whole-file exact coverage

**Given** every static declaration in one test file has every upstream
asserted by one exact group, while some declarations may also have additional
upstreams
**When** the executor describes that file in an exact group
**Then** it may use a file-only selector and that selector covers every static
declaration in the file without claiming each declaration's complete upstream
set.

### S10 — mixed-provenance file

**Given** no one proposed upstream set is held by every declaration in a test
file
**When** the executor writes exact coverage
**Then** it uses complete nested title arrays to assign each declaration to
the appropriate group rather than using whole-file shorthand.

### S11 — duplicate complete titles

**Given** two static declarations in one file have the same complete nested
title array
**When** either needs case-level exact selection
**Then** canonical validation rejects the ambiguous selector and the executor
renames a declaration before selecting it.

### S12 — parameterized declaration

**Given** one static generator call produces several runtime test cases
**When** the executor gives it exact coverage
**Then** one selector names the generator's complete static title, including
literal placeholders, and does not enumerate runtime expansions.

### S13 — additive upstream enters whole-file shorthand

**Given** a file is covered by a file-only exact selector and a new
declaration retains all upstreams asserted by that group while adding another
upstream
**When** the executor adds the declaration
**Then** it retains the whole-file selector and adds narrower exact membership
for the new declaration's additional upstream.

### S14 — selector rename or move

**Given** an exactly selected declaration is renamed or moved
**When** the executor changes the test source
**Then** it updates the file and complete-title selector in the same change
and validation resolves the updated selector exactly once.

### S15 — lagging pin

**Given** an exact group's landed spec pin is behind the current approved spec
version
**When** the validator or reviewer compares it
**Then** the lag triggers re-derivation and does not predetermine the fidelity
verdict.

### S16 — equal-current pin

**Given** an exact group's spec pin equals the current approved spec version
**When** conformance is reviewed for another reason
**Then** equality supplies no proof and the reviewer derives the obligations
from the approved spec.

### S17 — candidate pin passes

**Given** the executor advances a candidate pin in the same change as tests
**When** a separate conformance reviewer re-derives the group against the
current approved spec and passes the finished change
**Then** the candidate is eligible to land as the group's last-reviewed
target.

### S18 — candidate pin does not earn review

**Given** the executor advances a candidate pin
**When** conformance returns `FAIL` or `UPSTREAM-INDICTED`
**Then** the candidate is not eligible to land as a reviewed pin.

### S19 — partial review of overlapping coarse scope

**Given** one touched declaration receives an exact group while an overlapping
legacy coarse group remains
**When** only the touched declaration is independently reviewed
**Then** its exact pin may advance but the coarse pin remains unchanged.

### S20 — changed code with no ledger

**Given** code or tests change and neither carrier exists
**When** the dispatcher routes review
**Then** it dispatches conformance and lets the reviewer distinguish missing
canary evidence from a missing approved contract.

### S21 — validator precision modes

**Given** an upstream version bump affects packages represented respectively
by exact canonical, coarse canonical, legacy, and absent data
**When** the validator performs its triggered audit
**Then** it reports exact members precisely, coarse and legacy file scopes
coarsely, and absence as unobservable, without advancing pins or issuing
conformance verdicts.

### S22 — inline provenance removal

**Given** a test declaration still relies on inline provenance
**When** the executor establishes and validates exact external membership for
that declaration
**Then** mandatory inline provenance may be removed in the same change and any
remaining inline anchor is non-authoritative navigation.

### S23 — Grove stock migration

**Given** Grove's five packages contain legacy Markdown ledgers with
frontmatter, prose, coverage anchors, or technical notes
**When** the implementation wave migrates them
**Then** every package ends with schema-2 `test-deps.yaml`, no old carrier,
truthful coarse or exact groups, and no lost semantic evidence.

### S24 — methodology projection

**Given** the canonical role charters and companions are amended to this
contract
**When** the repository projection generator runs
**Then** Claude/Codex projections, references, launchers, inventories,
digests, and allowlist outputs match the authored sources and projection tests
pass.

### S25 — config and setup convention

**Given** `<TEST_DEPS_LEDGER>` or a setup seed/default names the legacy
carrier
**When** the implementation updates the consumer convention
**Then** it names nearest-ancestor canonical YAML with legacy read fallback,
retains the token name, and keeps the value a verified prior.

### S26 — boundary tests

**Given** boundary or projection tests assert `test-deps.md`, fenced schema 1,
or mandatory inline provenance
**When** the implementation establishes canonical behavior
**Then** the tests assert schema 2, the five input states, generated
projection integrity, and exact-coverage preconditions without introducing a
general runtime parser.

### S27 — no runtime revival

**Given** the schema and agent duties are implemented
**When** the finished change is inspected
**Then** it contains no review-bookkeeping runtime, owed-map, verdict-record
protocol, deterministic audit command, CI enforcement, or installer.

### S28 — valid canonical coarse evidence

**Given** a selected canonical manifest is valid and a relevant migrated
group is coarse
**When** the reviewer independently establishes the approved upstream and
completes fidelity assessment
**Then** it reports `canonical/coarse`, may return substantive `PASS`, and
advises that the group supplies package/file scope rather than exact
per-declaration provenance.

### S29 — package root with no carrier

**Given** neither carrier exists and the executor changes a test
**When** the repository has an existing package manifest, test-command
boundary, or sibling suite layout that unambiguously establishes the package
root
**Then** the executor creates canonical YAML at that established root without
applying a universal package detector.

### S30 — ambiguous absent package root

**Given** neither carrier exists, the executor changes a test, and the
repository has no unambiguous existing package or test-suite boundary
**When** the executor needs to create canonical data
**Then** it surfaces the missing boundary and does not guess a package root.

### S31 — observable touched declaration

**Given** a static declaration exists in the landed basis
**When** the change modifies its declaration, body, static or enclosing title,
generator call site/input/body, or source-file location
**Then** the executor classifies the declaration as touched and gives it exact
coverage in the same change.

### S32 — relevant groups for changed tests

**Given** a change adds or touches test declarations selected by exact and
coarse canonical groups
**When** the conformance reviewer determines evidence mode
**Then** those selecting groups are relevant and the mode is
`canonical/coarse` because at least one relevant group is coarse.

### S33 — relevant groups for changed code

**Given** code changes and the reviewer independently establishes its affected
test declarations from the approved upstream, repository structure, observed
test execution, and impact analysis
**When** the reviewer consults canonical evidence
**Then** only groups selecting those affected declarations are relevant, and
the ledger does not decide which tests the code affects.

### S34 — unusable legacy carrier

**Given** the selected `test-deps.md` exists but contains no well-formed
`grove-test-deps` block
**When** the reviewer can independently establish the approved upstream
**Then** it reports `inferred` mode with an unusable-legacy advisory and may
return substantive `PASS` without a malformed-canonical integrity failure.

### S35 — malformed canonical with same-root legacy

**Given** malformed canonical YAML and usable legacy Markdown coexist at one
package root
**When** the reviewer uses legacy evidence to orient the substantive fidelity
assessment
**Then** it keeps that evidence separate, does not union or validate canonical
with it, and returns overall `FAIL` for canonical integrity until repair.

### S36 — strict group value shapes

**Given** a schema-2 manifest has an empty group name, a non-list
`specs`/`decisions`/`defects`/`covers` value, an empty-string element in one
of those lists, or a non-string `notes` value
**When** an agent validates canonical data
**Then** it classifies the manifest as malformed without inventing additional
identifier grammar.

### S37 — canonical byte stability

**Given** two executor writes represent the same semantic manifest but receive
groups, selectors, cases, or reference lists in different input orders
**When** the executor serializes each write
**Then** both outputs have identical UTF-8 bytes, fixed field/list ordering,
two-space block indentation, JSON-compatible double-quoted free strings, LF
line endings, and exactly one final newline.

### S38 — unusable legacy can be replaced completely

**Given** a present legacy file has no well-formed dependency block
**When** the executor can independently derive exact coverage for every
discovered declaration and preserve all usable guidance
**Then** it writes complete canonical YAML, validates it, and removes legacy
without creating a coarse group.

### S39 — unusable legacy cannot be replaced partially

**Given** a present legacy file has no well-formed dependency block
**When** the executor cannot derive exact coverage for every discovered
declaration or cannot preserve usable guidance
**Then** it leaves legacy untouched, writes no partial canonical file, and
surfaces a blocking migration defect.

### S40 — a declaration loses a whole-file group upstream

**Given** a file-only exact group asserts upstreams A and B for every
declaration and one selected declaration no longer has B
**When** the executor updates canonical coverage
**Then** it splits the whole-file shorthand into exact title selectors so no
selector continues to assert B for that declaration.

### S41 — manifest-only candidate pin passes

**Given** executor re-derivation against a newer approved spec finds current
implementation and tests require no change
**When** the executor proposes only the candidate-pin manifest change and a
separate conformance reviewer independently checks the current implementation
and tests against that spec
**Then** a conformance `PASS` makes the candidate eligible to land as the
last-reviewed target.

### S42 — manifest-only candidate pin does not self-validate

**Given** the executor proposes a manifest-only candidate pin after its own
re-derivation
**When** independent conformance returns `FAIL` or `UPSTREAM-INDICTED`
**Then** the candidate is not eligible to land and the executor's
re-derivation supplies no substitute verdict.

### S43 — forbidden YAML presentation features

**Given** a semantic manifest is ready to write
**When** the executor emits canonical YAML
**Then** the output begins with `schema: 2` followed by `groups:`, follows the
specified physical mapping/sequence lines and spacing, ends with exactly one
LF, and contains no directive, document marker, comment, blank line, tag,
anchor, alias, tab, trailing whitespace, or unprescribed space.

### S44 — escaped YAML scalar boundaries

**Given** accepted schema strings contain U+0000, U+000A, U+007F, U+0085,
U+009F, U+2028, and U+2029
**When** the executor serializes canonical YAML
**Then** those values remain on one physical scalar line and are emitted,
respectively, with the specified control escapes including `\u007F`,
`\u0085`, `\u009F`, `\u2028`, and `\u2029`, producing valid YAML bytes.

### S45 — unrepresentable scalar input

**Given** a schema string contains U+FFFE, U+FFFF, or an unpaired UTF-16
surrogate rather than a Unicode scalar sequence
**When** an agent validates it for canonical writing
**Then** canonical data is rejected as malformed and the executor emits no
canonical file containing that value.

## Acceptance criteria

1. INV1–INV7 and S1–S6 pass: carrier lookup and every canonical grammar level
   are strict, and canonical, legacy, absent, dual-present, and malformed
   states remain distinguishable.
2. INV8–INV16 plus INV47 and S7–S14 plus S40 pass: exact selectors resolve
   static declarations collision-safely, additive upstreams compose without
   overclaiming, coarse migration remains truthful, and inline provenance
   becomes optional only after exact coverage.
3. INV17–INV20 plus INV48 and S15–S19 plus S41–S42 pass: pin lag triggers
   review, equality proves nothing, code/test and manifest-only candidates
   require independent review, and coarse pins cannot advance on partial
   evidence.
4. INV21–INV25 and S7–S8 pass: executor writes are deterministic, migration is
   lossless, legacy deletion is gated by validation, and absent packages
   receive exact coverage for every discovered declaration rather than
   invented coarse evidence.
5. INV26–INV31 and S2–S5 plus S28 pass: conformance remains read-only,
   discloses its evidence mode, permits advisory absence/legacy/coarseness,
   preserves the real no-contract failure, and blocks malformed or
   dual-present canonical state.
6. INV32–INV34 and S20–S21 pass: dispatch is independent of ledger presence,
   validator output respects evidence precision, and the advisory graph blind
   spot is disclosed.
7. INV35–INV38 and S22–S26 pass: all six authored propagation areas, generated
   surfaces, five stock ledgers, config/setup convention, and affected tests
   are updated in the required order.
8. INV39 and S27 pass: no deterministic parser, audit command,
   review-bookkeeping runtime, record protocol, CI enforcement, or installer
   is introduced.
9. INV40–INV41 and S29–S31 pass: absent package roots come only from existing
   repository conventions, and new/touched declarations are observable
   against the landed basis.
10. INV42 and S32–S33 pass: relevant groups and canonical exact/coarse modes
    are derived from changed declarations or independently established
    affected tests rather than ledger membership alone.
11. INV43–INV44 and S34–S35 pass: unusable legacy evidence falls to inferred
    review with an advisory, while same-root legacy orientation neither
    unions with nor cures malformed canonical data.
12. INV5 and S36 pass: group names and every group value have observable
    schema shapes without adding identifier grammar.
13. INV45 and S37 pass: every executor write follows one byte-observable
    canonical serialization without adding parser or audit machinery.
14. INV46 and S38–S39 pass: an unusable legacy carrier is replaced only by
    complete package-wide exact coverage and is never converted partially.
15. INV49 and S43 pass: canonical output has one fully fixed physical YAML
    grammar with no presentation or whitespace degrees of freedom.
16. INV50 and S44–S45 pass: every accepted schema string is serializable as
    valid one-line YAML, DEL/C1/line separators are escaped, and
    unrepresentable scalar input is rejected.

## Open questions

*(none)*

## Review history

- **Conformance review at `3e5bad5`.** Independent review returned `PASS`:
  the specification faithfully derived from approved ADR-0043.
- **Spec-adversary round 1 at `3e5bad5`.** Independent intrinsic review
  returned `NEEDS-REVISION` with four blocking findings: deterministic YAML
  lacked a canonical byte policy; unusable legacy input permitted partial
  canonical migration; whole-file exact semantics mishandled additive
  upstreams; and pin-only successful re-derivation lacked an observable
  independent-review path. This revision fixes each finding in canonical
  serialization, writer migration, exact selector composition, pin semantics,
  INV45–INV48, and S37–S42. A fresh independent review is required.
- **Conformance review at `99f889b`.** Independent review again returned
  `PASS`: the round-1 revisions preserved fidelity to approved ADR-0043.
- **Spec-adversary round 2 at `99f889b`.** Independent intrinsic review
  returned `NEEDS-REVISION` only on canonical serialization: YAML structural
  presentation and whitespace still had degrees of freedom, and accepted
  strings did not fully reconcile YAML's printable-scalar boundary. This
  revision fixes the exact physical line grammar, forbids every unselected
  presentation feature, defines DEL/C1/line-separator escaping and
  unrepresentable scalar rejection, and adds INV49–INV50 plus S43–S45. A
  fresh independent review is required.

## Rubric check

`<SPEC_RUBRIC_PATH>` resolves from `.grove/config.toml` to the explicit value
`none exists yet`. No project-specific spec rubric is available, so this
self-check uses the contract-author charter and ADR-0043's approved decisions
without inventing substitute criteria.

| Check | Result | Evidence |
|---|---|---|
| Approved upstream | PASS | `adr-0043-structured-test-dependency-canary` is `status: approved`; this spec declares it as both `implements` and deliberate `depends_on`. |
| Artifact contract | PASS | Frontmatter includes the required identity, lifecycle, dependency, owner, date, and initial behavioral version; Acceptance criteria and Open questions are present. |
| Decision fidelity | PASS | D1–D8 are covered by carrier/schema, selector, provenance, writer, reader, pin, strictness, and retired-machinery sections. |
| Propagation fidelity | PASS | The four role charters, two companions, config/setup convention, five stock ledgers, projections, affected tests, and inline-transition ordering are explicit in Grove propagation and INV35–INV38. |
| Testable grammars | PASS | INV1–INV50 use shall-form requirements; S1–S45 use Given/When/Then; acceptance criteria map both forms. |
| Boundaries | PASS | Deterministic tooling, CI enforcement, and review-bookkeeping revival remain forbidden and require later authority. |
| Ambiguity | PASS | Canonical serialization fixes physical lines, presentation exclusions, spacing, ordering, escaping, encoding, and scalar acceptance; unusable legacy migration is all-exact-or-no-write; additive group upstreams and split conditions are distinct; manifest-only pins have an independent success path. Repository-specific test discovery remains an implementation choice within observable declaration and coverage outcomes. No load-bearing decision is guessed. |
| Open questions | PASS | ADR-0043 has no open decisions; its empirical experiment, cross-repository fetching, and future tooling remain parked upstream and add no requirement here. |

The self-check passes. The spec is promoted from `draft` to `gated` and is
ready for independent conformance and spec-quality review.
