---
id: adr-0048-parsers-are-dependencies
type: adr
status: gated  # drafted by the agent; awaits the maintainer's intent act
depends_on: [adr-0026-thin-vendor-boundary, adr-0031-multi-host-distribution, adr-0043-structured-test-dependency-canary]
owner: agent
updated: 2026-07-29
---

# ADR-0048: formats grove does not define are read by dependencies, delivered through the build it already has

## The convention this reverses was never decided

Grove has no runtime dependencies and no dev dependencies, in any of its six
packages. **No decision established that.** The corpus contains exactly one
mention, and it is descriptive rather than normative — `adr-0043:362` refers in
passing to *"Grove's present zero-dependency TOML readers"*. The posture is a
habit that has been treated as a constraint, including by the agent drafting
this record, who declined to add a dependency on its authority and was right to
decline but wrong about why.

## The evidence — a natural experiment nobody designed

Between 2026-07-28 and 2026-07-29, grove#181 went through eight rounds of
independent review. **Rounds five through eight found defects exclusively in
hand-rolled parsing** — `guard-core.mjs`'s frontmatter reader and `cursor.mjs`'s
status probe. Not in dispatch logic, not in the guard, not in lifecycle.

The reported count understates it, because every report generalised once the
mechanism behind it was traced:

| round | reported | found once generalised |
|---|---|---|
| 5 | 1 fail-open in frontmatter classification | **11** |
| 6 | 2 P1s | **9** — 8 routes to the absorbing `reviewless` class, plus a file-wide status probe |
| 7 | 2 P1s | the reader was replaced; blacklist → whitelist grammar |
| 8 | 3 P1s | **13** characters `trim()` strips that YAML treats as scalar content |

Every one was a divergence between hand-rolled semantics and the published
format. Each fix was individually correct and each round found more.

**The failure mode is not sloppiness, and this is the load-bearing point.** The
tests were written from the *same incomplete model of the format* as the code
they test. Self-consistency was preserved throughout — all suites green, every
round — while correctness leaked. **No amount of test discipline reaches that,
because the discipline is inside the blind spot.** Mutation testing does not help
either: mutating a rule you never knew you needed cannot turn a test red.

That is the argument for a dependency, and it is narrower than "dependencies are
good": it applies exactly where a second party defines correctness.

## Decision

1. **Formats grove does not define are read by a dependency.** Where correctness
   is fixed by an external specification — YAML, TOML, and the same class if it
   arises — grove takes a proven implementation rather than writing one. Where
   the specification is grove's own — the transition grammar, the cursor schema,
   dispatch rules, the record contract — hand-written code remains correct and
   preferred; a dependency there would be overhead against a spec we control and
   can change.

2. **Delivery is the generate-and-commit pipeline grove already has, not
   vendoring and not install-at-consumer.** The plugin lands on a consumer
   machine as a git clone under the host's plugin cache with **no install step**
   — verified: no `node_modules` exists in any installed plugin cache, and the
   runtime is invoked directly as
   `node ${CLAUDE_PLUGIN_ROOT}/runtime/dispatch/bin/…`. So a bare `import` of an
   installed package cannot resolve there.

   `tooling/grove/build` already generates host projections deterministically,
   commits them, marks each `<!-- GENERATED — DO NOT EDIT; canonical-source: …;
   sha256: … -->`, and enforces cleanliness with `npm run check` across 60 files.
   A bundling step reuses that discipline exactly: the dependency is declared in
   `package.json`, the bundler emits one generated module into the plugin tree
   with the same header and digest, and `--check` catches drift. **No new
   machinery, and no third-party source committed by hand.**

3. **Both hand-rolled parsers are replaced** — `guard-core.mjs`'s frontmatter
   reader and `toml.mjs`.

   An earlier draft of this reasoning kept `toml.mjs` on the argument that grove
   writes the TOML it reads, making it closed input. **That argument is withdrawn
   as unsound.** It rested on absence of defects rather than on a property, and
   the premise is false: `.grove/runs/<run-id>/cursor.toml` and the verdict
   records live in the *consumer's* repository, committed and editable by
   anything — and a caller-supplied plan file is precisely the threat that opened
   this review sequence. TOML is open input on the same terms as YAML.

4. **One hoisted `node_modules` via workspaces.** A root `package.json` declaring
   the six tooling packages as workspaces, rather than six independent installs.

5. **This does not license dependencies generally.** Decision 1's boundary is the
   whole of it. A dependency proposed for anything grove specifies itself does
   not follow from this record and needs its own.

## Consequences

- **Third-party code ships to every consumer clone.** Licence compatibility and
  attribution become obligations grove did not previously carry, and the audit
  surface grows for everyone who installs the plugin. This is the real cost and
  it is not marginal.
- **Clone size grows** by the bundled parsers. Not yet measured; measuring it is
  part of execution, not a reason to defer the decision.
- **`--check` depends on the build being reproducible.** The existing digest
  discipline assumes deterministic generation. Bundler determinism is a
  **property to verify, not to expect** — if the same input can produce different
  bytes, the digest gate becomes a source of false drift.
- `guard-core.mjs` loses most of its 774 lines; `toml.mjs` (212 lines) is deleted.
- The whitelist grammar built in rounds seven and eight is superseded by the
  dependency. **Its adversarial batteries are not** — the 186 cases and the
  corpus classification test transfer directly, and become the evidence that the
  replacement preserves behaviour.

## Considered and rejected

- **Vendoring third-party source by hand** — rejected: grove already generates
  and commits with digests, so hand-copied source would be a second, weaker
  mechanism beside a working one.
- **Installing at the consumer** — rejected: not possible. No install step exists
  in the plugin path, verified rather than assumed.
- **A differential test against a real parser, keeping the hand-rolled reader** —
  rejected: it verifies the divergence rather than removing it, and the round-eight
  residual (YAML 1.1 key resolution collapsing two spellings into one) is
  *semantic*, so a differential test would re-derive finite published spelling
  sets at the cost of the same dependency. If the dependency is acceptable, using
  it directly is strictly better than using it to grade a copy.
- **Keeping `toml.mjs`** — rejected, see Decision 3.

## Open questions

1. **Which implementations**, and under which licences. Not chosen here.
2. **Does the round-eight key-resolution residual actually close?** A conforming
   reader should reject a document whose two keys resolve to one scalar, but that
   depends on the chosen library's strictness, which is an implementation
   property to measure rather than assume.
3. **Does bundling interact with `adr-0026`'s thin-vendor boundary?** That record
   governs what grove pushes into consumer repositories. A bundled parser inside
   the plugin is not a consumer-repo artifact, so it plausibly sits outside —
   but the adjacency is close enough to name rather than wave past.
4. **Is anything else in the runtime parsing an externally specified format?**
   Decision 1 implies an audit that this record does not perform.

## Self-check (gate)

Per `charters/lifecycle.md`. Failures listed, not silently passed. **Every row
below was re-derived from the tree, not from the drafting conversation** — the
previous record drafted in this session recorded three PASSes that were false of
the repository, and that is the failure this section exists to catch.

| # | check | result |
|---|---|---|
| 1 | The reversed convention is verified as undecided, not assumed | **PASS** — grepped `decisions/`, `specs/`, `charters/`; one descriptive mention, quoted with its line |
| 2 | `depends_on` ids resolve to real files | **PASS** — all three verified present in `decisions/` by filename |
| 3 | The no-install-step claim is measured | **PASS** — no `node_modules` in any installed plugin cache; invocation path quoted from the shipped skills |
| 4 | The existing build/commit/digest pipeline is real | **PASS** — `tooling/grove/build` scripts read; a generated adapter's `GENERATED … sha256` header quoted |
| 5 | The zero-dependency claim about all six packages is measured | **PASS** — every `package.json` checked for `dependencies` and `devDependencies` |
| 6 | Round-by-round defect attribution is accurate | **PARTIAL** — the table is compiled from this session's review reports, which are on grove#181 but not in this repository. A reader cannot verify it from the tree alone |
| 7 | The withdrawn `toml.mjs` argument is retracted in the operative text, not a footnote | **PASS** — Decision 3 |
| 8 | Licence and audit cost stated as cost, not minimised | **PASS** — Consequences, first item |
| 9 | Bundler determinism named as unverified | **PASS** — Consequences |
| 10 | Acceptance criteria | **ABSENT, deliberately** — per grove#172 and the `adr-0046`/`adr-0047` precedent |
| 11 | Nothing asserted about which library, its size, or its behaviour | **PASS** — all three are Open questions |
| 12 | `status: gated` earned | **PASS** — this self-check has run and its one partial failure is recorded |

## How this record was produced

The maintainer challenged the zero-dependency posture; the agent checked and
found it was never decided. The maintainer then rejected the agent's first two
proposals in sequence — vendoring (answered by the build step grove already has)
and keeping `toml.mjs` (answered by pointing at the same argument the agent had
just been faulted for elsewhere: absence of evidence). Both rejections are
reflected in the decisions above rather than smoothed away, because the record
is otherwise unexplainable: it argues for a change the agent spent four review
rounds working around.
