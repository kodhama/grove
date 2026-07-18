---
id: adr-0015-reviewer-machine-boundary
type: adr
status: gated  # self-checked against the rubric 2026-07-18 (shaper); awaiting decision-adversary + the maintainer intent act
depends_on: [adr-0012-methodology-delivery-machinery, adr-0006-operational-conformance-mechanism]
informed_by: [adr-0005-tdd-and-artifact-gated-dispatch]
owner: agent
updated: 2026-07-18
---

# ADR-0015: the reviewer/machine boundary — agents judge, the machine stamps the record

## Context

The review-bookkeeping check (`spec-0002`) is **ungreenable in practice**
(grove#67, discovered dogfooding on `kodhama/math-quest#305` — the first
strict-mode PR after a real check install). The check computes the
owed-map and enforces freshness correctly, but **nothing emits a record it
can accept.**

**Root cause — a category error in the reviewer charters.** The four
reviewer charters (`conformance-reviewer`, `code-reviewer`,
`spec-adversary`, `decision-adversary`) currently instruct the agent to
*"post the verdict as a verdict record per `spec-0002` §A… verdict token,
subject manifest, **fingerprint**, producer/reviewer, findings… on the
change request."* That asks an LLM agent to do three **CI/machine** jobs:

1. format the exact `§A.2` record envelope (`schema: 1`, `subject` as an
   **array**, `manifest_hashes` object, …);
2. compute a `fingerprint` that **equals** `grove-fp-1` — a
   `sha256` over path+blob bytes at HEAD (`lib/fingerprint.mjs`), which the
   freshness check recomputes and compares byte-for-byte
   (`lib/match.mjs`: `fresh = groveFp1(basis, tree) === record.fingerprint`);
3. post to a pull request.

Job 2 is **impossible** for an LLM — no model computes `sha256(raw bytes)`
by hand. So every emitted record carries a scalar `subject` and a freeform
`fingerprint` string, and parses **inert** (or stale) at the parser
(`lib/records.mjs`). Jobs 1 and 3 are machinery the agent should never
have been handed.

**Maintainer principle (2026-07-18):** *reviewer agents must not know
anything about CI.* CI must not be something a reviewer charter has to
think about. The current charters violate this — and that violation is
**why** the records are malformed. So the principle is not a constraint on
the fix; it **is** the fix.

## Decision — the reviewer/machine boundary

**A reviewer supplies judgment; the machine supplies the record. Neither
does the other's job.**

1. **Reviewer agents output only judgment.** The four reviewer charters'
   output is: the **verdict token**, the **subject** (the files/artifacts
   it reviewed), the **findings**, and the **producer/reviewer**
   attribution (the separation authority, `adr-0012` AC7 — who built vs who
   reviewed). That is natural review output — a reviewer always states its
   conclusion, what it examined, and why. The reviewer knows **nothing** of
   `grove-fp-1`, `manifest_hashes`, the `§A.2` record envelope, the check,
   or the pull request. **All record/fingerprint/change-request/`§A.2`
   language is removed from the four reviewer charters.**

2. **The machine stamps the record.** A mechanical **record-emitter** in
   the check package takes a reviewer's judgment output, reads HEAD, and
   produces the conformant `§A.2` record: it resolves the review-class
   **basis** (the subject alone for a quality review; `S ∪ U(S, HEAD)` for
   a fidelity review, via the `implements`/ledger upstream resolver),
   computes `grove-fp-1` over that basis and the `manifest_hashes`, and
   emits the full `§A.2` envelope. **The emitter shares the check's exact
   basis + fingerprint code** (`lib/fingerprint.mjs`, `lib/upstream.mjs`,
   and the basis selection of `lib/match.mjs`) — it is *the check's
   freshness computation run forward*, stamping the value the check will
   later verify. A reimplementation would drift and mint **permanently
   stale** records; sharing the code is the load-bearing correctness
   constraint.

3. **The harness posts.** Running the emitter and posting the record to the
   change request is an **orchestration/CI** responsibility — a CI step or
   the dispatcher's relay — never the reviewer's. The reviewer never
   touches CI at either end: it does not compute the record, and it does
   not post it.

The division in one line: **the reviewer supplies the *judgment*; the
machine supplies the *cryptography and the envelope*; the harness supplies
the *delivery*.**

## Considered and rejected

- **Bake the `§A.2` format + fingerprint into the reviewer charters**
  (grove#67 option B). Impossible for the fingerprint (an LLM cannot
  `sha256`), and it *deepens* the exact CI-coupling the maintainer
  principle forbids. Rejected — this is the current broken state, named as
  the root cause.
- **Have the reviewer agent run the emitter itself.** It fixes the
  fingerprint (a tool computes it) but still couples the reviewer to CI —
  the charter would name the emitter, the record, the posting step.
  Rejected on the boundary principle: the reviewer must not *know* the
  emitter exists.
- **Reimplement the basis/fingerprint math inside the emitter.** Drift
  risk — the emitter and the check would diverge and mint stale records.
  Rejected: the emitter imports the check's own functions.

## Consequences (to be built after approval)

1. **The four reviewer charters** (`conformance-reviewer`, `code-reviewer`,
   `spec-adversary`, `decision-adversary`) lose all record/fingerprint/
   `§A.2`/change-request/"commit point" language; their output section
   specifies the CI-agnostic **judgment** (verdict + subject + findings +
   producer/reviewer). The `.claude/agents/` + `plugins/grove/reference/
   agents/` copies follow.
2. **A record-emitter in the check package** (executor, test-first):
   consumes a judgment (verdict/subject/findings/producer/reviewer),
   produces a `lib/records.mjs`-valid `§A.2` record with a machine-computed
   `grove-fp-1` over the correct review-class basis at HEAD, by importing
   the check's own `fingerprint`/`upstream`/basis code. The judgment→record
   handoff shape is the emitter's input contract (Consequence 4).
3. **`spec-0002` §A note**: the record's `fingerprint` (and
   `manifest_hashes`/envelope) is **machine-stamped by the emitter**, not
   hand-authored; the reviewer's judgment is the input. No core algorithm
   change — a documentation/interface amendment.
4. **The judgment handoff shape** — how a reviewer emits its verdict so the
   emitter can consume it deterministically (a lightweight structured
   judgment the reviewer produces, oblivious to its downstream use vs. the
   harness parsing review prose). A real sub-design; settled during the
   spec/charter work, held here as an open question.
5. **The math-quest pilot re-runs** — the first place a real green record
   can actually be produced and satisfy the check.

## Open questions

- **Which harness component runs the emitter + posts** — a dedicated CI
  step vs. the dispatcher relaying (what has been done by hand all along).
  The reviewer decoupling holds either way; parked as an orchestration
  detail, not blocking the boundary.
- **The judgment handoff shape** (Consequence 4) — must be CI-agnostic
  from the reviewer's side (verdict + files + findings is natural output;
  a structured mini-block the reviewer emits oblivious to its use is still
  agnostic, since it carries no fingerprint/record/PR knowledge).
- **Forgery** stays the conceded Layer-B limit (`spec-0002` §E): the
  emitter transcribes the `producer`/`reviewer` a caller supplies; it does
  not attest identity. No new hole — the same conceded class.

## Self-check (rubric)

Self-checked to `gated` 2026-07-18. Problem stated from an **observed**
failure (grove#67, math-quest#305 — the first real strict-mode install),
with the root cause diagnosed against the actual code (`records.mjs`
validity contract, `fingerprint.mjs` grove-fp-1, `match.mjs` freshness
equality). The decision is largely **forced**: grove#67 option B is
impossible (no LLM computes `sha256`), and the maintainer principle
("reviewer agents must not know CI," 2026-07-18) *selects* the boundary
rather than merely constraining it. Each alternative is rejected with a
reason. The one genuine design detail — the judgment→record handoff shape
— is named as an **open question / Consequence 4**, not pretended settled.
Separation authority (`adr-0012` AC7) is explicitly **preserved** (the
emitter transcribes producer/reviewer, does not invent them), and forgery
stays the conceded `§E` Layer-B limit — no new hole. Consequences name
their executing surfaces (charters, the check package, `spec-0002` §A).
`depends_on` is genuine coupling — `adr-0012` (the check whose records this
makes producible, and the AC7 authority it preserves), `adr-0006` (the
ledger/`implements` upstream the fidelity basis resolves through);
`adr-0005` is `informed_by`. Both `approved`.

Not claiming adversary validation — the decision-adversary pass precedes
the human gate; the `approved` intent act is the maintainer's
(`gated → approved` flip), never the shaper's.
