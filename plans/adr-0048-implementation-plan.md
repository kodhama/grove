---
id: plan-adr-0048-parsers
type: plan
status: recorded  # advisory; a plan orders work and never adds, removes, or reinterprets requirements (spec-0004:530)
implements: adr-0048-parsers-are-dependencies
depends_on: [adr-0048-parsers-are-dependencies, spec-0006-voluntary-dispatch, spec-0004-dual-host-distribution]
owner: agent
updated: 2026-07-29
---

> **REVISION 2.** Rev 1 went to independent conformance review and returned
> **FAIL**; this is the revision. Rev 1's §1 conclusion was **reversed** (spec-0006
> does need an amendment), its orphan-detector reasoning was **wrong**, its
> coverage count was **wrong** (19/15, not 13), and its attribution item was not
> merely unverified — measurement showed the bundle **shipped `yaml` without its
> ISC notice**. Findings folded; nine maintainer decisions since resolved and
> recorded in `adr-0048`.

# Implementation plan — adr-0048 (parsers are dependencies)

Advisory. Written against `adr-0048` which is **`gated`, not approved** — planned
and built on the footing the maintainer authorized for adr-0046. Nothing merges
without their intent act. A reader must not infer approval from this plan's
existence.

Baseline green: build 32 · release 45 · gates 40 · lifecycle 82 · dispatch 200 ·
probes 2 = **401 passing**, and `npm run check` reports 60 generated files clean.

## 1. Spec impact — no spec-0006 amendment, but a location constraint

**Confirmed by grep.** spec-0006 names YAML once (line 104, Terms) and specifies
**no grammar and no parser**. The class table (383–390) is purely semantic.
INV16 requires classification be "deterministic per the tables in this spec" — a
conforming parser satisfies that.

**Caveat that binds the design.** `specs/0004-dual-host-distribution.md:230`
enumerates the shared runtime as exactly `runtime/lifecycle/`, `runtime/gates/`,
`runtime/dispatch/` — "the only installed executable … behavior." That list
reads exhaustive. **A bundle at a new root (`runtime/vendor/`) amends spec-0004**,
which under adr-0044 drags a paired amendment decision and a `@vN` bump touching
every `@v8` pin. **Landing inside `runtime/dispatch/lib/` avoids all of it.**
Constraint, not preference.

## 2. The whitelist divergence — confirmed, undeclared

`guard-core.mjs:202-207` states the cost openly: exotic-but-legal YAML classifies
`unclaimed` rather than by `type`. Measured against the class table, a file with
`type: charter` plus a nested map has frontmatter present and a `type` in the
enum, so the table says `charter`. **Divergence.**

Removing it needs **no spec amendment** (it restores conformance) but **must be
declared twice**: in the change request / conformance record, because it is
close-blocking; and in `guard-core.test.mjs:1194-1202`, where seven pinned
`outsideTheGrammar` assertions invert. Inverting a deliberately pinned decision
must not happen quietly.

## 3. The no-install constraint — verified, and bundling does NOT satisfy it by default

- No `node_modules` anywhere under `~/.claude/plugins`.
- **Correction to adr-0048:** the cache is not a git clone — there is no `.git`
  under it. It is a materialized tree. This strengthens the argument.
- **Proven trap:** the obvious esbuild invocation yields a bundle that FAILS from
  a bare directory — `Error: Dynamic require of "process" is not supported`,
  because `yaml`'s export map points at a CommonJS build. `--main-fields` does
  not fix it. The working config needs a banner:
  `import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);`
- Verified fixed: parses YAML and TOML from a directory containing only the
  bundle; the only bare requires are node builtins.

**Therefore "the bundle runs with no node_modules" is a REQUIRED TEST, written
before the bundler is configured.** Without it this defect ships green.

## 4. Libraries — measured

**The round-eight residual does NOT close by default.**

| input | `yaml` 2.9.0 (1.2 default) | `yaml` `{version:'1.1'}` | `js-yaml` 5.2.2 |
|---|---|---|---|
| `y: 1` / `yes: 2` | **accepts** (two string keys) | **throws** "Map keys must be unique" | accepts |
| `1: a` / `0x1: b` | throws | throws | throws |

**Recommend `yaml`** — ISC, **zero dependencies**, 264 KB bundled, the only
candidate with a 1.1 mode, and the only one that **throws on an alias bomb** by
default (`maxAliasCount: 100`). js-yaml pulls transitive `argparse`, enlarging
the audit surface adr-0048 names as the real cost.

**Recommend `smol-toml`** — BSD-3-Clause, zero deps, 26 KB bundled.
**Exclude `@ltd/j-toml` on licence:** LGPL-3.0 statically bundled into an
MIT-licensed tree distributed to every consumer creates relinking obligations MIT
does not carry.

Both TOML candidates match `toml.mjs` on what the tests pin: BOM rejected,
duplicate keys rejected, unsafe integers rejected, `__proto__` inert.

**Clone-size cost** (adr-0048 deferred this): bundled yaml 263,589 B + smol-toml
25,711 B = **289,219 B**, minus deleted `toml.mjs` (7,541 B) ⇒ **≈ +282 KB on a
~720 KB tree, ~39% growth.** Recommend **unminified** — minification halves size
but makes shipped third-party code unreviewable, cutting against the audit
consequence, and makes the digest far more sensitive to bundler churn.

## 5. Bundler reproducibility — version-coupled, must be pinned

- Same version, same machine, two runs: **byte-identical** (confirmed twice).
- **Across esbuild versions: different** (0.21.5 vs 0.28.1 diverge at byte 693).
- No absolute paths leak; module comments are repo-relative.
- **Cross-platform (linux CI vs darwin dev): NOT verified.** Not claimed.

Manageable only with all three: **committed `package-lock.json` + `npm ci`**;
**esbuild pinned exact** (no caret); and **a cross-platform byte check before
landing**. If that check fails, fall back to a recorded-digest `bundle.lock.json`
verified rather than re-derived — strictly weaker, adopt only on measured failure.

`generate.mjs:66-72` emits only `<!-- -->` and `#` header forms; a `.mjs` output
needs a `//` variant. The orphan detector greps the literal `GENERATED — DO NOT
EDIT`, so it keeps working. **What `canonical-source` names for a bundle is an
open design point** — the entry module's digest alone does not determine the
bytes, so record exact dependency and bundler versions in a second line.

## 6. Behaviour delta — measured over corpus and battery

**Corpus: zero churn.** All **234** tracked files classify identically under the
whitelist, under 1.2, and under 1.1. *(234, not 233 — the comment at
`guard-core.mjs:206` predates adr-0048's own commit. The test must assert "no
file differs", never a count.)*

**Battery: 220 distinct inputs; 44–48 change class — every one toward FEWER owed
records.**

| delta | 1.2 | 1.1 | owed | direction |
|---|---|---|---|---|
| `unclaimed` → `spec+implements-bearing` | 21 | 21 | 4→2 | over-owing removed, correct |
| `unclaimed` → `reviewless` | 13 | 13 | **4→0** | **under-owing, observer-invisible** |
| `unclaimed` → `charter` | 6 | 6 | 4→0 | under-owing |
| `unclaimed` → `reviewless+implements-bearing` | 2 | 2 | 4→1 | under-owing |
| `spec+implements-bearing` → `spec` | 2 | **6** | 2→1 | **new hole under 1.1** |
| identical | 176 | 172 | | |

**F1 — the `reviewless` bucket, 13 inputs.** `unclaimed` owes four *and* is in
`OBSERVER_CLASSES`; `reviewless` owes nothing *and* INV20 excludes it. So
`type: "research"` (quoted) goes from 4-owed-and-visible to 0-owed-and-invisible.
Spec-conformant, and a real coverage loss. **Maintainer must see it before it
lands.**

**F2 — the `implements` hole is CREATED by the fix, and is worse under 1.1.**
`implements: null` / `true` stop bearing under 1.2; `no`/`y`/`on`/`off` also stop
under 1.1. The comment at `guard-core.mjs:176-180` claiming 1.1 resolution "can
only make the value MORE present" is true of today's raw-string reader and
**becomes false with a library reader**. Mitigation, with its own test: **treat
any present `implements` as bearing unless null/absent, empty string, or empty
array** — so `false` and `0` bear. Restores fail-closed.

**F3 — the free fail-open, and the single most important line in this plan.**
A first replay handed the whole file to the parser after a naive delimiter split:
**eight inputs regressed `unclaimed` → `code`** (owes 2, and `code` is NOT in
`OBSERVER_CLASSES`) — BOM-prefixed, padded `--- `, unterminated. Re-running with
grove's own delimiter rules preserved verbatim eliminated the bucket entirely.

> **Design rule: the frontmatter *delimiter* convention is grove's own and stays
> hand-written. Only the inner document goes to the parser. A parse failure maps
> to `unclaimed`, never to `code`.**

**F4 — a literal-string cursor status wedges close AND abort.** `status = 'open'`
is a parse error today; under smol-toml it parses, so the cursor is well-formed
and open — but `OPEN_STATUS_LINE` requires double quotes, so `editCursorText`
returns null and both `close-run` and `abort-run` fail. INV8's whole-file
exception is deliberately unreachable on a well-formed cursor. **The run becomes
unclosable and unabortable.** Reader and editor must widen in the same commit,
with the wedge as its red test.

**F5 — the round-trip probe weakens.** `run.mjs:149` probes via
`parseToml('probe = ' + JSON.stringify(value))`; real TOML accepts ``
escapes that `toml.mjs` rejected. `oneLineFailure` still blocks CR/LF so the
one-line contract holds, but the rejection test needs re-derivation, not deletion.

## 7. Blast radius

`toml.mjs` importers: `cursor.mjs:5`, `guard-core.mjs:13`, `run.mjs:28`,
`transitions.mjs:5`, `toml.test.mjs:11`, `transitions.test.mjs:12`,
`build/config.mjs:155`, `metadata/package-allowlist.json:359`.

Three **derivation comments go stale** and must be re-derived: `cursor.mjs:17-31`
(status-line grammar), `cursor.mjs:33-44` (table-header grammar), `run.mjs:452-458`;
plus `guard-core.mjs:293`.

Frontmatter reader reaches everything via `classifyContent` → `bindSubject` →
`computeEnabled` → `guard.mjs` → `stop-guard.sh`.

**Two more hand-rolled TOML readers exist** — answering adr-0048 Open 4, which the
ADR posed and did not perform: `runtime/gates/lib/profile.mjs:94`
(`parseGatesToml`, reading **consumer-editable** `.grove/gates.toml` — the exact
open-input argument Decision 3 used) and `runtime/lifecycle/lib/lifecycle.mjs:1270`.
**Recommend out of scope, recorded loudly.**

**There is no `.gitignore` in this repository at all.** Adding root
`node_modules` leaves thousands of untracked files visible to
`git status --porcelain -uall`, which is exactly how `deriveChangeSet`
(`guard-core.mjs:392-394`) builds the change set. Reports stay bounded but the
change set balloons. **A `.gitignore` is step zero.**

## 8. Sequencing — four commits, each ending green

**Step 0 — workspaces only.** No third-party code, no licence question.
*Red first:* `node_modules` is git-ignored; root `package.json` declares exactly
the six known packages. *Then:* `.gitignore`, root `package.json` with
`workspaces`, committed `package-lock.json`, `npm ci` in `grove-tests.yml` and
`release-tag.yml` — **both currently comment "All packages are zero-dependency …
so no install step is needed"; those comments change with the code.**

**Step 1 — bundling machinery, consumed by nothing.** *Red first:* two builds
byte-identical; `--check` fails on a hand edit; **the bundle runs from a
directory with no `node_modules`**; the bundle's only bare requires are builtins.
*Then:* pin esbuild/yaml/smol-toml exactly, entry module, bundle step, `//`
header, `GENERATED_FILES` + `STATIC_PACKAGE_FILES` entries, regenerated
allowlist. **Use the real dependencies as the subject** — a trivial entry would
not exercise the CJS trap. Run the cross-platform check here; if it fails, stop.

**Step 2 — TOML.** *Red first:* the F4 wedge; re-derived status-line and
table-header grammars; F5's new boundary; `serializeCursor` via library
`stringify` (**smol-toml emits `subjects = [ "a.md" ]` with inner spaces — every
byte-exact cursor fixture changes**). *Then:* delete `toml.mjs`, re-point four
importers, drop allowlist entries.

**Step 3 — frontmatter (highest risk).** *Red first, in order:* the corpus test;
the four delimiter-hardening tests (F3); parse-failure→`unclaimed`; the
`implements` bearing rule (F2); the residual test per Q1; the inverted delta
assertions. *Then:* delete the ~270-line grammar block (`guard-core.mjs:87-358`)
and route through the bundle. *Correction to adr-0048 line 108:* it loses ~270
lines, **not "most of its 774"** — ~35%.

**Step 4 — ledgers and propagation.**

## 9. Test strategy — two of my premises were wrong

- **The "186-case battery" is not derivable from the tree.** Instrumented:
  **231 invocations over 220 distinct inputs** across 55 tests. 186 came from
  review reports, which adr-0048's self-check row 6 already marks PARTIAL for
  exactly this reason.
- **The "233-file corpus test" DOES NOT EXIST.** It is a one-time manual
  measurement recorded in a comment, not a test. **It must be written as the
  first red test of Step 3**, not transferred.

**Survives unchanged:** change-set derivation, `parseStatusZ`, rename halves,
digest tagging and prefix-freeness, `O_NOFOLLOW`, record freshness, sentinel
collision, `computeEnabled`; all guard exit-code/channel/wrapper tests; nine of
`toml.test.mjs`'s twelve (re-pointed import only).

**Must change:** the seven pinned `outsideTheGrammar` cases invert; `R7 — every
YAML construct outside the accepted subset…` inverts; `R8 — tag-resolution
spellings cannot under-owe` is measurably false after (F2) and must be rewritten
around the new bearing rule; every byte-exact cursor fixture; three
`toml.test.mjs` subset-strictness tests become "parser accepts, schema rejects".

**Dies deliberately:** assertions whose *subject is the hand-rolled grammar* —
`R8 — trimming is YAML s-white`, `R8 — mapping-value indicator`, `R8 — flow-context
scalars`, `R8 — an accepted value is never empty`, `R7 — the comment rule is
YAML's`. These test that grove reimplemented YAML correctly; a conforming parser
moots them. **Delete deliberately, named in the change request — each records a
real defect.** Exception: `R7 — line splitting follows YAML 1.2` **survives**,
because splitting is delimiter logic and stays grove's.

**Mutation discipline is not codified anywhere** — only a comment at
`release.test.mjs:1267` and spec-0006's AC convention (line 944). Apply it anyway,
naming the mutation in the change request. Four that most need it: revert
delimiter hardening → F3 tests red; revert `editCursorText` widening → F4 wedge
red; revert parse-failure→`unclaimed` → fail-closed test red; hand-edit the
bundle → `--check` red.

## 10. Ledgers (adr-0043 schema 2 — exact coverage for new or touched declarations)

`tests/dispatch/test-deps.yaml`: append adr-0048 to the spec-0006 group's
`decisions:`; **remove the whole `toml.test.mjs` selector block (12 titles)**;
**retitle every renamed R5–R8 case** (≥11 change or disappear — adr-0043 requires
the selector update in the same change); add exact selectors for all new tests;
prefer **a new exact group keyed to adr-0048** rather than growing the spec-0006
group. **The `spec-0006@v2` pin does NOT advance** — adr-0048 changes no spec.

`build/test-deps.yaml`: new exact group for the bundling tests, `decisions:
[adr-0048]`. `spec-0004@v8` pin does **not** advance provided §1's location holds.

`release/test-deps.yaml`: probably untouched — **verify, don't assume**.

adr-0048 gains **no `changes:`** — no spec version bump exists.

**Fold into adr-0048 at ratification:** Open 1 answered by §4; Open 2 answered —
*the residual does not close by default*, stronger than "it depends"; Open 3
resolves in the ADR's favour (adr-0026 D1 puts the fleet in the plugin; a bundle
inside the plugin is the same side of that line); Open 4 answered by §7.

## 11. Decisions required of the maintainer

**Q1 — YAML 1.1 or 1.2?** The one genuine fork. **1.1 closes the round-eight key
residual** (the only configuration that does) **and opens F2 on four more
spellings.** 1.2 leaves the residual open, keeps `implements` narrower. Planner's
inclination: **1.1 plus the explicit bearing rule**, noting mild tension with
Decision 1's spirit (a hand-written rule atop a conforming parser).

**Q2 — is F1's 13-input coverage reduction acceptable?** Spec-conformant, a real
loss, and not mitigable inside this change without re-diverging from the table.

**Q3 — does `parseGatesToml` come along, or wait?** Decision 1's principle covers
it; Decision 3 does not name it. Recommend defer, recorded loudly.

## 12. Not verified, not claimed

Cross-platform bundle reproducibility · the 186 figure · `@iarna/toml`
maintenance recency · js-yaml bundled size · whether the `createRequire` banner
is stable across esbuild majors (tested on 0.28.1 only).

**Firm judgment rather than measurement:** the highest-risk step is **Step 3**,
and its risk is concentrated in **F3**. Delegate the delimiter along with the
document and eight measured inputs fail open into `code` — under-owing *and*
invisible — and **the existing suite will not catch it**, because its delimiter
tests assert `unclaimed` and a naive implementation still returns `unclaimed` for
most of them. Write the corpus test and the four delimiter tests **before**
touching `readFrontmatter`.
