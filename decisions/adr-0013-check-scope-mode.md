---
id: adr-0013-check-scope-mode
type: adr
status: gated  # self-checked against the rubric; awaiting decision-adversary + the maintainer intent act
depends_on: [adr-0005-tdd-and-artifact-gated-dispatch, adr-0012-methodology-delivery-machinery]
owner: agent
updated: 2026-07-17
---

# ADR-0013: the check's scope mode — `strict` | `scoped`, chosen at setup, never assumed

## Context

Wave 2 of `adr-0012` shipped the review-bookkeeping check (`spec-0002`)
with one governance default, everywhere: **fail-closed over the whole
repo** — any changed file not positively declared reviewless owes the
full review set (INV7/AC4), and any owed fidelity pair without an
`implements` upstream is red (`no-reviewable-upstream`, `adr-0005`
dec 3).

That default is right for grove-self and wrong for the first-run
consumer. A consumer who installs grove and opens an ordinary PR
touching their own application code — no grove frontmatter, no
test-deps ledger, no spec — reds on every file: the check demands a
contract for code the methodology never touched. The friction lands at
the exact moment adoption is decided ("just works" or uninstall).

Two maintainer calls shape the fix (2026-07-17, the wave-2 close-out
conversation):

1. **People do not read docs.** An opt-in documented anywhere but the
   install interaction itself does not exist for a first-run user. The
   choice must be surfaced where attention already is: **the setup
   conversation** — which is already interactive (it resolves
   placeholders by asking).
2. **Don't pick the default — make the choice itself obvious and
   frictionless.** Neither mode is imposed; the install asks one
   plain-language question and records the answer.

## Decision

1. **The `grove-review-policy` block gains a `scope` key** with two
   values, read (like every policy input) from the protected default
   branch, never PR HEAD (`spec-0002` §C.1/INV1 — S6 stays closed):

   - **`strict`** — today's behavior, unchanged: every changed file is
     the check's business; anything not positively declared reviewless
     owes the full set (INV7), fail-closed.
   - **`scoped`** — the check governs **only what is declared into the
     methodology**; everything else generates **no owed pairs** — not
     red, not exempted: *outside the check's jurisdiction*. In scope,
     the **union** of:
     - **path** — files under the policy's `artifact_dirs` (the
       governed corpus);
     - **type** — any changed file whose HEAD frontmatter declares a
       grove artifact type, **wherever it lives**: jurisdiction follows
       the artifact's own self-declaration, so mislocating a typed
       artifact outside `artifact_dirs` is not an exit door (and §C.7
       graph resolution runs for every changed artifact by this
       definition — resolving the membership basis unambiguously for
       the spec amendment);
     - **opted-in code** — code belonging to a package that opted in
       via a test-deps ledger (the `adr-0006` dec 4 convention; its
       concrete spelling is the ledger artifact's to pin, per
       `spec-0002` Q8 — cited here by reference, not respelled);
     - **the gate's own carriers, machinery included** — the discovered
       reviewer-declaration directory's files, the review-policy file
       itself, every test-deps ledger, **the installed check runtime
       path** (default `.grove/check/`, as recorded at install), and
       **the installed workflow file**. The gate's inputs *and its
       implementation* are never ungoverned, in either mode: an edit to
       the check's own machinery is never silent in `scoped` — the same
       tripwire `strict` provides. (The run-from-PR-HEAD limit is
       inherent in both modes for a *malicious* PR — the wave-2
       code-review finding, conceded in `spec-0002` §E; this carrier
       scoping preserves the *non-malicious* tripwire. Disclosed
       friction: a legitimate runtime re-install will show red rows and
       the human merges over them knowingly; a smoother update path is
       a follow-up, not silently traded for the tripwire.)

2. **Absent key ⇒ `strict`.** The spec's fail-closed principle is the
   silence default; softness is never inferred. The friendly path comes
   not from weakening the default but from **setup always writing the
   key** (Decision 4) — no normal install ever runs on the silence
   default.

3. **Scope narrows jurisdiction, never softens the gate.** Inside
   scope, every `spec-0002` rule holds identically in both modes:
   fail-closed unclaimed types, the prose-path-only allowlist (INV14),
   freshness, separation, the approved-upstream gate, graph resolution
   (§C.7 still runs for every changed artifact — artifacts are in scope
   by definition). `scoped` changes *which files* the check speaks for,
   never *how it speaks*.

4. **The setup skill asks, in plain language, and records.** When the
   optional GitHub check is installed (the skill already detects the
   host while resolving `<PR_CONTRACT_SECTIONS>`), setup asks ONE
   question — approximately: *"Should the check watch only
   grove-managed artifacts (recommended to start), or hold the whole
   repo to review-required (strict)?"* — and writes the chosen `scope`
   explicitly into the installed `review-policy.md`. The choice is made
   knowingly at install time, in seconds, with zero documentation
   dependency. grove-self's own `charters/review-policy.md` likewise
   states `scope: strict` explicitly — every install declares its mode;
   the silence default exists only as the fail-closed backstop.

5. **The `scoped` status view names its mode.** The §D header line
   states the mode and the aggregate jurisdiction count (e.g.
   *"Bookkeeping complete — scoped mode: 3 of 14 changed files in
   jurisdiction. A human still judges genuineness and merges. This is
   NOT approval."*) — one line, never per-file exemption rows — so a
   green is never read as a whole-repo verdict by the human at merge.

**Why this does not contradict `adr-0005` dec 3** ("a change with no
reviewable upstream is a FAIL, not a pass-by-default"): that rule
governs **work the methodology produced** — grove-run changes, where
"built against a conversation, not a contract" is a process failure.
A consumer's pre-existing application code is not grove-run work; no
grove agent produced it and no grove contract was owed. In `scoped`
mode such a file never *enters* the conformance question — jurisdiction,
not verdict. The moment that code opts in (a ledger appears above it),
dec 3 applies with full force. `strict` mode remains exactly the
whole-repo reading for projects that want it.

**Conceded class (disclosed, `adr-0012` AC8 — not silently traded).**
The jurisdiction argument above covers *pre-existing* consumer code;
the in-scope test for code (ledger presence) is a proxy **the producing
agent controls**. So in `scoped` mode, a grove-run change whose
executor omits its ledger generates no owed pairs — the mechanical
second catch `adr-0005` dec 3 provides does not fire, where `strict`
would red the identical PR. Layer A cannot mechanically attest *who
produced* a change (the same limit class as record genuineness,
`spec-0002` §E), so this is **conceded, named, and backstopped**, not
closed: (1) the executor charter's standing duty — the ledger is part
of the deliverable, and code shipped without one is non-conformant at
build review; (2) the human at merge — new code with no ledger is
visible in the diff, and the mode-naming banner (Decision 5) keeps the
green honest about what it did not examine; (3) `strict` mode as the
ratchet for a project whose grove-run share has grown past trusting
the prose duty. A project that wants the mechanical catch buys it with
`strict`; `scoped` trades it, knowingly, for adoption — that trade is
this decision's point, and it is stated here rather than discovered
later.

## Considered and rejected

- **Flip the global default to `scoped`.** Silently weakens the
  approved fail-closed stance for every hand-rolled or migrated install
  that never chose; the adversarial passes' review-free-zone defense
  argued precisely against softness-on-silence. Rejected — the default
  stays `strict`; setup makes silence rare.
- **Allowlist globs / directory exemptions.** INV14 exists because a
  path-class exemption is the review-free-zone attack; reopening it to
  solve friction would trade a real defense for convenience. Rejected.
- **More reviewless types.** The friction's center is untyped consumer
  `code` — the classification itself, not a missing type name. A
  `reviewless: [code]` declaration would be `scoped` wearing a worse
  costume (it would also exempt grove-run code in artifact-adjacent
  packages). Rejected.
- **Documentation / a help command alone.** Contradicts maintainer
  call 1 — the first-run user never sees it. (`/grove:help` is worth
  having and is parked as a follow-up, but it is not the mechanism.)

## Consequences

1. **`spec-0002` is amended** (contract-author, after this decision is
   approved): §B/INV7 gain the scope-mode semantics above; the §C.2
   owed-derivation states the jurisdiction filter; a scenario covers
   out-of-scope-silent + in-scope-fail-closed. Append-only: the spec
   amendment cites this ADR.
2. **The check implements the filter** (executor, test-first): `scoped`
   short-circuits owed-pair generation for out-of-jurisdiction files;
   absent-key and `strict` paths byte-identical to today's behavior.
3. **The vendored `review-policy.md` template and the setup/remove
   skill steps are updated**: the template carries the `scope` key with
   the plain-language comment; setup asks the question and writes the
   answer; grove-self's `charters/review-policy.md` gains explicit
   `scope: strict`.
4. **The math-quest pilot exercises the whole path** (adr-0012's
   program acceptance milestone): a real consumer install, the real
   setup question, `scoped` behavior on real app code.
5. Parked: `/grove:help` (a discoverability skill; separate concern);
   a smoother gate-machinery update path (today a legitimate runtime
   re-install shows red tripwire rows the human merges over knowingly
   — Decision 1's disclosed friction).

## Acceptance criteria

- **AC1 (silence = strict).** With no `scope` key, check behavior is
  byte-identical to pre-amendment `strict` on every existing test.
- **AC2 (jurisdiction).** In `scoped` mode, a changed file outside
  scope generates zero owed pairs and zero reasons — no listed
  exemption row; the banner's aggregate mode line (AC7) is its only
  trace.
- **AC3 (no softening).** In `scoped` mode, an in-scope file of
  unclaimed type owes the full review set — INV7 intact within
  jurisdiction.
- **AC4 (the gate governs itself).** The reviewer-declaration files,
  the review-policy file, every ledger, the installed check runtime
  path, and the installed workflow file are in scope **in both modes**.
- **AC5 (the choice is recorded).** Setup writes an explicit `scope`
  key on every CI-check install; the question is one plain-language
  prompt with a recommended default; no install path leaves the key
  absent silently.
- **AC6 (S6 intact).** The `scope` value is read from the protected
  default branch only; a PR editing its own scope does not change the
  rules its gate runs under.
- **AC7 (mode visibility).** In `scoped` mode the §D header states the
  mode and the aggregate jurisdiction count (Decision 5) on green and
  red alike; the non-authorizing banner language (INV11) is unchanged.
- **AC8 (the concession is written down).** The spec amendment carries
  the conceded class (producer-controlled ledger presence) in its
  disclosed-limits section (`spec-0002` §E class), naming the three
  backstops — never implied, never omitted.

## Self-check (rubric)

Drafted → self-checked against the decision rubric: problem stated from
a real observed failure (consumer friction, wave-2 close-out); both
maintainer calls recorded with dates; alternatives each rejected with a
reason; the adr-0005 tension addressed head-on rather than silently;
consequences name their executing roles; ACs are mechanically
checkable.

**Adversary round 1 (2026-07-17): NEEDS-REVISION** — three must-fix
findings, all applied in this revision: F1 (the producer-controlled
ledger proxy → the conceded-class disclosure + Decision 5's
mode-naming banner + AC8), F2 (path-vs-type membership ambiguity → the
union basis, type is not an exit door), F3 (gate machinery out of
scope → runtime + workflow scoped in as carriers, tripwire preserved,
update friction disclosed). Notes F4 (AC4 wording) and F5a (ledger
convention cited by reference) applied; F5b (the review-policy carrier
is itself `gated` on main — pre-existing) surfaced to the maintainer,
not fixed here. The revision is NOT claiming round 1's validation —
a scoped round 2 re-review of the deltas precedes the human gate.
