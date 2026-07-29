---
id: adr-0048-parsers-are-dependencies
type: adr
status: approved  # maintainer's intent act in-session (D5 channel), 2026-07-29: "I approved the spec in both decisions", clarified as adr-0047 and adr-0048. Author (agent) != approver (maintainer). Reviewed by an independent conformance pass at plan stage (FAIL, folded) before any code. The nine maintainer decisions are recorded in-record with their reasoning. The PR merge is the separate ship act and is NOT performed by this flip; spec-0006@v3 is caused by this record per adr-0044 and is not yet minted.
depends_on: [adr-0026-thin-vendor-boundary, adr-0028-plugin-release-tagging, adr-0031-multi-host-distribution, adr-0043-structured-test-dependency-canary]
changes: [spec-0006-voluntary-dispatch@v3]  # adr-0044 pairing; v3 carries both queued amendments
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

3. **Every hand-rolled reader and writer of an external format is replaced.**
   *(Maintainer, 2026-07-29: "replace every parser or writer." An earlier version
   of this clause named two, while Decision 1's rule reaches four — ratifying that
   would have shipped code violating this record's own D1 on day one.)*

   The complete audit, classified by Decision 1's boundary:

   | site | format | disposition |
   |---|---|---|
   | `dispatch/lib/toml.mjs` (4 functions) | TOML | **replace** |
   | `gates/lib/profile.mjs` — `parseGatesToml`, `parseValue` | TOML | **replace** |
   | `lifecycle/lib/lifecycle.mjs` — `parseProfile` | TOML | **replace** |
   | `dispatch/lib/guard-core.mjs` — `readFrontmatter` | YAML | **replace** (delimiter excepted, below) |
   | `dispatch/lib/cursor.mjs` — `serializeCursor` | TOML | **replace** |
   | `lifecycle/lib/lifecycle.mjs` — `serializeConfig` | TOML | **replace** |
   | `dispatch/lib/run.mjs` — `editCursorText` | TOML | **replace** — see below |
   | `dispatch/lib/transitions.mjs` — `parsePredicate`, `parsePredicateList` | grove's predicate grammar | **keep** — D1 |
   | `cursor.mjs` / `transitions.mjs` schema validation | grove's schema | **keep** — D1 |
   | `guard-core.mjs` — `parseStatusZ` | git `status -z` | **keep, flagged** — Open 5 |

   **`editCursorText` is replaced rather than widened.** It is a surgical line
   edit whose tolerance is documented as derived from `toml.mjs` "mechanism by
   mechanism" — a derivation that cannot survive its basis, because **a line
   regex is not derivable from full TOML at all**: a legal value spans lines and
   a legal key may be quoted. Review demonstrated five spellings that become
   schema-valid, open, and un-editable, leaving a run **unclosable and
   unabortable**. Read-modify-write through the library removes the regex, and
   with it the class.

   **The frontmatter delimiter stays hand-written**, and this is a boundary, not
   an exception: the `---` block convention is grove's, only the inner document
   is YAML. Delegating the delimiter measurably fails eight inputs open into
   `code`, which owes 2 and is invisible to observer mode.

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

## Maintainer decisions, 2026-07-29

6. **YAML 1.2 core schema**, recorded here and written into `spec-0006` so INV16
   is satisfiable. *(Maintainer: "let's target yaml 1.2 and go from there.")*

   This resolves the round-eight residual rather than leaving it open, and by a
   cleaner route than 1.1 would have. That residual was never a defect in the
   reader — it was **ambiguity about which YAML grove implements.** Under 1.2,
   `y` and `yes` are two distinct strings, so there is no collision to detect and
   grove's reader agrees with a conforming 1.2 reader exactly. The numeric case
   still closes: at its 1.2 default the chosen library **throws** on `1:` / `0x1:`,
   because both resolve to the integer 1. Declaring the version *is* the fix.

   It also removes two hazards 1.1 would have introduced: the `implements`
   under-owing on `no`/`y`/`on`/`off`, and the merge-key (`<<:`) class. What
   remains — `implements: null` / `true` — is caught fail-closed by the schema
   clause (a non-string, non-sequence value is schema-invalid → `unclaimed`).

7. **The coverage reduction is accepted.** *(Maintainer.)* At least 19 measured
   inputs fall from four owed records to zero, and at least 15 leave observer
   scope. Recorded as **a lower bound, not a bound** — the battery was authored
   from the same model of the format as the code it pinned, which is this
   record's own thesis applied to its own evidence.

8. **Bundler authority: `esbuild` is authorized by this record**, and Decision 5
   is read accordingly. D5 exists to stop this record being taken as blanket
   permission for dependencies inside grove's *own* domain. A bundler is in no
   domain — it is the delivery mechanism D2 already mandates, so authorizing the
   tool that performs it is implied rather than extended.

   **The cost is named rather than smuggled:** `esbuild` installs a
   **platform-specific prebuilt native binary** through optional dependencies,
   executed in CI on every run. Two platforms resolved from one lockfile are two
   different programs — which is both a supply-chain surface and the mechanism
   behind the cross-platform reproducibility question. It is pinned exact, and a
   linux-vs-darwin byte comparison gates the design.

9. **Licence policy for bundled code: permissive only.** *(Maintainer asked for a
   recommendation; this is it.)* MIT, ISC, BSD-2-Clause or BSD-3-Clause may be
   bundled. Anything else — copyleft especially — needs its own decision, because
   copyleft reaches grove's own code where permissive licences never do. That is
   the ground `@ltd/j-toml` (LGPL-3.0) was excluded on.

   The whole obligation these licences impose is reproducing the copyright notice
   and licence text wherever the bytes travel. **Discharged mechanically:**
   `plugins/grove/reference/licenses/NOTICES.md` is **generated from the
   lockfile** at build time and allowlisted — `reference/` is a permitted
   package-root entry, so this needs no `spec-0004` amendment, unlike the
   package-root file the obvious approach would have put there. The same text is
   emitted as a bundle banner so it survives separation from the file, and **a
   test fails if any lockfile dependency has no notice.** Generated, never
   hand-written: a hand-written notice file drifts on the first version bump.

   Measured, and the reason this is a decision rather than a detail: the bundle
   as first configured shipped `yaml` with **zero** occurrences of its ISC
   notice. `smol-toml`'s BSD-3 notice survived only because upstream happens to
   place it in a source banner. That is luck, not compliance.

10. **This is a release event; `plugins/grove/VERSION` moves `0.3.0` → `0.4.0`.**
    *(Maintainer: "new version yeah.")*

    **`0.4.0` is a derivation, not a choice — and an earlier version of this
    clause said the opposite, which was wrong.** It asserted that nothing in
    grove derives a version from the shape of a change. `adr-0028` **D3**
    (approved 2026-07-22) does exactly that, and the maintainer caught the
    error:

    > **minor** — a new capability or a meaningfully changed role behavior
    > (and, while pre-`1.0` at `0.x`, **a breaking change rides the minor slot
    > by semver convention**); **major** — reserved for post-`1.0` breaking
    > changes.

    This change is breaking — seven runtime modules replaced and a
    classification behaviour change — so pre-`1.0` it takes the **minor** slot:
    `0.3.0` → `0.4.0`. The level is *judged by the maintainer at merge* per D3;
    the slot is not.

    **Authority, since D1 and the tree appear to disagree and do not.**
    `adr-0028` D1 named `plugin.json` the single source of truth. `adr-0031`
    moved the locus to the host-neutral `plugins/grove/VERSION` when grove went
    dual-host and there were two manifests, **preserving D2 (the human-cut
    release form) and D3 (the semver levels)** — stated at
    `.github/workflows/release-tag.yml:26`, *"VERSION is the sole release
    authority (adr-0031/spec-0004)."* So `VERSION` is authoritative and both
    manifests derive from it. All three read `0.3.0` today and move together.

    It is warranted on substance: seven runtime modules replaced, roughly
    **+282 KB** of new package bytes, and a classification behaviour change. A
    stale `VERSION` would leave the tag no longer describing the tree.

    **It also discharges a standing debt.** `grove#169` records that the plugin
    cache is **version-keyed** and `VERSION` never moved past `0.3.0`, so two
    different builds answer to one cache directory — verified by sha, with one
    project loading another's bytes — and it asks for a bump *before any refresh
    wave*. This bump satisfies that precondition. The cache defect itself is not
    fixed here and `grove#169` stays open.

## Errata (append-only; the ratified text below is unedited)

**D10's file count is wrong. Four files carry the version, not three.**
Recorded 2026-07-29, after the bump was executed. D10 names `plugins/grove/VERSION`
and the two host manifests. The tree also has **`plugins/grove/metadata/surfaces.json`**,
whose `version` `validate-release.mjs` (`release.mjs:1260`) checks against `VERSION`
on the same rule as the manifests.

Found the way it should have been: by bumping `VERSION` alone and reading what
broke, not by re-reading the record. The bump to `0.4.0` moved all four.

This corrects a fact, not a decision — D10's ruling (this is a release event; the
level is derived, and pre-`1.0` a breaking change takes the minor slot per
`adr-0028` D3) stands unchanged. Appended rather than edited, per the
append-only rule this corpus runs on.

## Amendment obligation this record now carries

Independent review found that **`spec-0006` needs an amendment after all**, and
the agent's earlier reading that it did not was wrong. The spec's own precedent
at `:54-63` ruled a class change moving a subject from **2 owed to 4** to be *"a
widening that needs an amendment rather than a reading of existing text."* This
record moves 19 measured inputs from **4 owed to 0** — the opposite direction,
and it is close-blocking. Additionally, **INV16** requires classification be
"deterministic per the tables in this spec", and four inputs classify differently
under YAML 1.1 than 1.2 — so the class would be fixed by a build flag no spec
text mentions.

**Resolved by the maintainer, 2026-07-29: `spec-0006` goes to `v3`, dependants
are re-pinned, and the result goes to conformance review.**

`v3` carries **both** queued amendments — the non-regular-entry rows already
drafted at `spec-0006:44-76` and awaiting an act, and this record's
classification change — in a single version and a single intent act rather than
two bumps. This record declares the `adr-0044` pairing in its frontmatter
(`changes: [spec-0006-voluntary-dispatch@v3]`).

Consequences that follow mechanically and are owed in the same change: every
`@v2` pin in the test-dependency ledgers advances to `@v3`; the YAML version
chosen above is written into the spec so INV16 is satisfiable; and no
classification code lands before the amendment resolves, because the pins depend
on it.

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
4. ~~**Is anything else parsing an externally specified format?**~~ **Answered**
   — the audit is performed in Decision 3. Four readers and three writers.
5. **Does `parseStatusZ` come along?** It reads git's `status -z` format, which
   is externally specified, so Decision 1's rule reaches it — but no dependency
   is proposed and the format is NUL-delimited and stable. Flagged rather than
   resolved; keeping it is an exemption, and this record names it as one.
6. **Is `esbuild` authorized?** Decision 5 says a dependency for anything grove
   specifies itself needs its own record. A bundler reads no external format, so
   Decision 1 does not reach it — and it installs a **platform-specific prebuilt
   binary** through optional dependencies, executed in CI. That is a larger
   supply-chain surface than the transitive dependency this record's planning
   used to exclude a YAML candidate. It needs deciding, not assuming.
7. **Where do third-party licence notices live?** ISC and BSD-3-Clause both
   require the notice be reproduced in redistribution, and grove redistributes
   these bytes to every consumer. `spec-0004:238` — "these are the only permitted
   package-root entries" — **forbids a package-root `THIRD-PARTY-NOTICES.md`**,
   so the obvious home is unavailable and the conforming one must be chosen.

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
