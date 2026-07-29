---
id: adr-0047-host-native-review-instruments
type: adr
status: gated  # drafted by the agent; awaits the maintainer's intent act
depends_on: [adr-0007-code-reviewer-agent, adr-0009-security-specialist-parked, adr-0015-reviewer-machine-boundary, adr-0023-review-triage-blackboard, adr-0027-retire-ci-for-now, adr-0041-separate-support-from-operational-availability, adr-0046-how-dispatch-rules-reach-a-session]
owner: agent
updated: 2026-07-28
---

# ADR-0047: the code-quality role disaggregated — host instruments become the primary finding-generators, the charter keeps the frame, keeps the fallback, and gains test discrimination

## What this record does, stated against the thing it is not

An earlier draft of this record claimed `adr-0007` Decision 6 had already
established host-native review as primary with the charter as fallback, and that
this record merely widened it. **That reading was wrong and is withdrawn.** D6
says the built-in is *"one available instrument … **not a mandate** — the role's
contract stands without it"*, which makes the **charter primary** and the
instrument **optional**. Inverting that ordering is new content, and `adr-0007`
§Considered and rejected explicitly refused the neighbouring option:

> **Mandating/wrapping the built-in `/code-review` skill** — rejected: couples a
> portable charter to one runtime's feature set, and the skill does not know the
> project's declared conventions — the standards-source contract is needed on
> top either way.

So this record does **not** reverse primacy. It **disaggregates the role**, which
D6's own words license and which removes the primacy question rather than
answering it.

The maintainer's observation, 2026-07-28, is the hinge: **D6 treats the charter
and the instrument as comparable members of one set.** They are not the same kind
of thing. D6 itself says the charter charters *"the **frame**, not the technique"*
and enumerates the frame: independence, sequencing, standards source, and the
gate-and-reporting contract. Generic finding-generation is **shared**: the
charter has always owned it (`adr-0007` D2's fundamentals), and this record makes
host instruments its **primary** producer without taking it away. *An earlier
draft asserted "finding-generation was never the charter's to own" — false
against D2, and it was the sentence that licensed the withdrawn narrowing.*

Separating the two halves:

| half | owner after this record | changed by this record? |
|---|---|---|
| the frame — independence, sequencing, standards source, gate grammar | `charter-code-reviewer` | **no** — D6 stands |
| finding-generation, generic | host instruments **primary**, charter **fallback** | **yes** — an instrument is required where one reports; the charter still does it when none does |
| finding-generation, test discrimination | `charter-code-reviewer`, **sole owner** | **yes** — a duty it gains, on every host |

**Scope of the supersession: `adr-0007` Decision 6's "not a mandate" clause,
and nothing else.** *(Two qualifiers, so "nothing else" is literally true. This
record separately **corrects a factual statement** in D6's context — that the
built-in ships "severity-graded findings", which the measured version does not —
and a correction supersedes nothing. And per Decision 4, an unmapped finding is
**provisionally graded ≥ `high` pending mapping**, which preserves D3's
"`BLOCK` iff any finding is ≥ `high`" biconditional rather than adding a new
blocking condition beside it.)* Where a host instrument reports, invoking one becomes
required rather than optional. Everything else in D6 stands and is reaffirmed —
the charter still charters the frame, not the technique.

This was recorded as UNSETTLED in an earlier version, because the then-current
Decision 1 also narrowed `adr-0007` **D2** (whose fundamentals list includes
*"test quality"*) and **AC1**, while the record declared only D6 in scope —
the same defect an adversary had already found once here. **Decision 1 no longer
narrows anything**, so the discrepancy is gone rather than papered over, and the
scope is now genuinely what it says.

`adr-0007` gains `superseded_in_part_by: [adr-0047-…]` scoped to the D6 clause;
it does not carry the key yet, and it lands in the merge that carries the intent
act.

## Context — measured 2026-07-28

Three finding-generators ran against changes on grove#181 and stewards#59. The
two change-sets are named separately below because disjointness across *different*
subjects proves nothing.

| generator | invocation | moment | latency | exit | severity output |
|---|---|---|---|---|---|
| Claude built-in | `claude -p "/code-review"`, cold subprocess | local, pre-PR | 8m00s | 0 | JSON findings, **no severity field** |
| Claude plugin | `code-review@claude-code-plugins` | **CI, `pull_request` only** | 9m24s / 16m43s | 0 | prose; internal confidence filter |
| Codex | `codex review --base main` | local, needs network | 4m21s | **0, with findings** | `P1` / `P2` |
| grove charter | `grove:code-reviewer` subagent | any | ~12m | n/a | `severe/high/medium/low` per D3 |

**On stewards#59, one change-set:** the CI plugin returned 2 findings; the local
built-in returned 9; Codex returned 1 (a P1) plus, in a separate local run, 2
more. No finding appeared in more than one set.

**On grove#181, across rounds:** Codex returned 2 P1s, then 1 P1 + 2 P2s after
the first fix round; the CI plugin returned 2; the grove charter reviewer
returned findings neither produced (below). Again disjoint.

**What that supports and what it does not.** It supports *one generator is not
enough* — three rounds, and every round after a fix found defects the fix had
introduced or left. It does **not** establish complementarity: with n small and a
defect pool demonstrably unexhausted, disjointness is equally consistent with
shallow sampling. The stronger evidence is qualitative and held across every run:
**Codex's findings were adversarial** (a forged-identity path, a digest
collision), **Claude's were contract-and-consistency** ("this comment claims X,
the code does Y"). Decision 2 rests on the weaker ground and says so.

**The grove charter reviewer earned a specific new duty.** It reported that
deleting each of four equality conjuncts left the suite at **119/119 green** —
it mutation-tested the change's *tests* and found they did not discriminate.
No host instrument did this, in any of seven passes. That is grove's own test
discipline, not generic code quality.

**Correction to an approved record.** `adr-0007` D6's context states the built-in
ships *"severity-graded findings"*. Measured, `claude -p "/code-review"` emitted
JSON with no severity field. D6's decision is unaffected; its stated fact is not
accurate for the measured version and is corrected here rather than folded away.

**Source note.** The plugin's internals — five parallel review lenses, Haiku
eligibility/summary/scoring passes, and a filter discarding findings scoring
**below 80** — are read from
`~/.claude/plugins/marketplaces/claude-plugins-official/plugins/code-review/commands/code-review.md`,
an out-of-repo artifact installed at CI runtime. Not verifiable from this
repository, and cited so a future reader knows where to look and that it may
drift.

## Decision

1. **The charter gains a duty and loses nothing.** `charter-code-reviewer`
   keeps the frame in full, **keeps generic code-quality review**, and **gains
   test discrimination** — do the change's tests fail when the behaviour they
   claim to pin is reverted? — as a duty no host instrument performs.

   *An earlier version of this clause narrowed the charter to test discrimination
   and dropped generic review as "subtractive". The maintainer refuted it in one
   line (2026-07-29): **the charter is the fallback for hosts with no instrument,
   and a fallback that does not do basic code review is not a fallback.** Two
   adversary rounds had flagged the consequence — a run where no candidate
   reports would have no generic finding-generator at all — and this record
   filed it as an open question instead of seeing that it refuted the clause.*

   So the instruments are **primary** for generic finding-generation and the
   charter is the **fallback** for it; the charter is **sole** owner of test
   discrimination, always, on every host. `adr-0007` **D2's** language-agnostic
   fundamentals — including *"test quality"* — and **AC1's** no-declared-
   conventions fallback are therefore **untouched**, which they would not have
   been under the narrowing.

2. **At least one host instrument is required where one reports; running every
   reporting instrument is the default.** D6's *"not a mandate"* is superseded to
   *required*. The default of running all is set on the qualitative character
   split, which is the weaker ground — it is a **dial the maintainer holds**, not
   a property the evidence establishes, and Open 3 names what would settle it.

3. **An instrument counts only if it returned a verdict.** The word *available*
   is deliberately avoided: `adr-0041` already binds it in this corpus to a
   surface's `availability_state`. Here, a **candidate** is an instrument the
   environment may support; a **reporting** instrument is one that was attempted
   and returned a verdict. The enforceable rule is about attempts: **every
   candidate is attempted; only reporting instruments count.** A candidate that
   fails to return is **unavailable and said so out loud** — never a clean review.
   `command -v` proves installation, not authentication, network, or function.

4. **Severity mapping belongs to the role, and unmapped findings block.**
   `adr-0007` D3 fixes `severe/high/medium/low`, blocking ≥ `high`, verdict
   `BLOCK / PASS-WITH-ADVISORIES / CLEAN`, with blocking tiers reachable only
   through the objective-harm anchor. **No host instrument emits that grammar**
   (the charter reviewer does; that is why this sentence is qualified). An
   instrument's own grade is provenance, never the gate verdict.

   A finding that cannot be mapped **blocks, and the block is overridable by the
   human with a recorded rationale** — `adr-0007` D3's own "loud, not absolute"
   idiom. Fail-open was considered and rejected: the gate is *"`BLOCK` iff any
   finding is ≥ `high`"*, an unmapped finding has unknown severity, and resolving
   unknown toward passage fails in the direction of the hardest-to-map findings,
   which the measurements show are the adversarial ones. This matches the
   corpus's standing posture — `charters/dispatcher.md:432-435` rejects
   *"fail-open on verifier timeout"*; `spec-0006` treats an unreadable cursor
   status as open, fail-closed; `adr-0018` D8 falls back to the most conservative
   preset plus a loud warning.

   Consequence to accept: the plugin's below-80 filter discards findings before
   the role sees them, so they can neither be mapped nor blocked on. That is a
   real gap, named in Open 4.

5. **Instrument provenance rides the change-request report, not the record
   file.** The *rule* stays host-neutral — a code change owes a `code-review`
   record — because naming instruments in a transition rule would couple a
   host-neutral rule to a per-machine environment.

   *An earlier draft argued this from `adr-0046` clause 1's "never generates the
   sequence". That argument is withdrawn: `spec-0006:286` states `fire` "names
   one action (**it may name a role**)", and the shipped table at `:366` already
   names `code-reviewer`. The coupling argument stands on its own.*

   Which instruments reported, and which were attempted and did not, are recorded
   in the change-request report (`adr-0027` D2, `spec-0006` INV12). **This record
   therefore declares no `changes:` and requires no `spec-0006` amendment** —
   `spec-0006` §Verdict-record contract is a closed `schema = 1` shape and stays
   untouched. The trade is explicit: a reader of the record file alone sees
   `by`, not the instrument set. If that proves insufficient, extending the
   record is a paired amendment under `adr-0044`, and Open 5 holds it.

6. **Invocation moments are not interchangeable.** The CI plugin runs on
   `pull_request` only and **cannot run at a handover**; the local built-in and
   `codex review` can. A gate that must be satisfied at a handover may only count
   instruments that can be invoked there. Treating all three as members of one
   interchangeable set is a modelling error this record avoids.

7. **Out of scope, deliberately and by name.** `conformance-reviewer`,
   `spec-adversary` and `decision-adversary` are untouched — they judge against
   grove's approved artifacts, which no host instrument knows exist. Evidence: the
   `spec-0006` conformance verdict turned on INV20's scope clause and the class
   table's `unclaimed` definition.

   **`/security-review` is explicitly excluded.** `adr-0009` (approved) already
   extended D6's reasoning to the built-in security capability, so Decision 2's
   mandate would otherwise reach it by implication — and security exposure sits
   inside D3's objective-harm anchor. Excluded on the maintainer's scope call,
   2026-07-28, because it was not measured here. A separate record owes it.

## Considered and rejected

- **Reversing primacy of the ROLE — making the charter subordinate to the
  instruments.** Rejected. *(Distinction, since Decision 1 does make instruments
  primary for generic finding-generation: what is rejected is inverting the
  role's ordering — treating the charter as a degraded instrument rather than as
  the owner of the frame. The charter remains the role; the instruments are
  producers it is defined around.)* It
  requires reading D6 as something it does not say, and it leaves the D2
  standards-source contract undischarged. Disaggregation gets the same practical
  result while keeping D6 intact.
- **Fail-open on unmapped findings.** Rejected — Decision 4.
- ~~**Keeping the charter as a general-purpose fallback reviewer.**~~
  **Not rejected — adopted, by Decision 1.** This bullet previously rejected it,
  citing "seven passes produced no evidence it competes on generic quality" —
  absence of evidence from a measurement never designed to compare them, and the
  same claim Open 8 disowns. It is struck rather than deleted because the record
  argued it.
- **Narrowing the charter to test discrimination alone.** Rejected by the
  maintainer, 2026-07-29, on a ground the drafting agent had missed while
  arguing both sides of it: the charter's other role is the **fallback** for
  hosts with no instrument, and a fallback that does not do basic code review is
  not a fallback. The subtraction and the fallback were mutually exclusive, and
  the record proposed both.
- **Naming instruments in the transition table.** Rejected on coupling, not on
  `adr-0046` clause 1 — see Decision 5.

## Consequences (on approval; execution is a follow-up, not this record)

- `charters/code-reviewer.md:143-145` currently states the instrument is *"one
  available instrument, never a mandate"*. Decision 2 makes that false; the line
  changes. **Three surfaces regenerate**:
  `plugins/grove/reference/charters/code-reviewer.md` (same text) and the two
  adapter files carrying its digest — `plugins/grove/adapters/claude/agents/code-reviewer.md`
  and `plugins/grove/adapters/codex/skills/role-code-reviewer/SKILL.md`.
- `adr-0007` gains `superseded_in_part_by: [adr-0047-…]`, scoped to D6's
  non-mandate clause, matching the corpus norm (`adr-0003`, `adr-0031`, others).
  Note `adr-0007` currently lacks this key for `adr-0026` despite a body pointer
  claiming partial supersession; that pre-existing gap is **not** repaired here.
- The charter **gains a test-discrimination section and loses nothing.** Its
  generic-quality scope and `adr-0007` D2's fundamentals stay, now as the
  fallback for hosts where no instrument reports.
- **Execution constraint the record owes the executor:** `adr-0007` AC3 forbids
  "any tech-stack-specific noun … outside placeholder examples — checkable by
  grep", so the new section must describe mutation-testing without naming a test
  runner.

## Open questions

1. **Cost and latency at every handover.** ~8 min and ~$0.30 per Claude review
   from the subscription pool; ~4 min for Codex on a separate meter whose tier is
   funded to September. Decision 2's default is the dial.
2. **Neither invocation is a contract.** `codex review` exits **0 with findings**,
   so the gate must parse prose. `claude -p "/code-review"` is a slash command
   with no documented stability guarantee. Both are load-bearing with no
   versioning story.
3. **Is the instrument set complementary, or shallow samples of one pool?**
   Settled only by running all against a corpus of known defects.
4. **Findings discarded below the plugin's threshold never reach the gate.**
   Decision 4 cannot map what it never sees.
5. **Should instrument provenance move into the verdict record?** Decision 5 puts
   it in the report; moving it is a paired `adr-0044` amendment.
7. ~~**What happens when no candidate reports?**~~ **Resolved by Decision 1.**
   The charter keeps generic finding-generation, so a run where every candidate
   fails to report — offline, unauthenticated, rate-limited, or only a CI-surface
   instrument at a handover — still gets a generic review from the fallback, plus
   test discrimination. This was the hole an earlier Decision 1 opened; not
   opening it is the answer. **Still open and narrower:** how findings from
   multiple reporting instruments aggregate; whether overlapping findings are
   deduplicated; and — a distinction this record has not drawn — whether a host
   with **no candidates** (Decision 1's fallback case) yields a different verdict
   from a host where a candidate was **attempted and failed** (Decision 3's
   "never a clean review"). Both can be true at once (the review happens, the
   verdict discloses the failure), but the record does not say so.
8. ~~**Is the subtractive half of Decision 1 carried by evidence?**~~
   **Dissolved — there is no subtractive half.** The question existed only while
   Decision 1 dropped generic review, and it was the right question: the
   mutation-gap observation supported *keeping* test discrimination and was no
   evidence at all for *removing* generic review. Two different claims, and the
   record had leaned the absence of one onto the other.
9. **Can a test-discrimination finding reach a blocking tier?** **Proposed
   answer: yes, and it should be decided here rather than parked.** Review's
   closing point is taken — an Open question is the wrong container when the
   answer determines whether a decided duty can function.

   `charters/code-reviewer.md` §Boundaries caps a finding at `medium` where harm
   is not demonstrable, and §Method 4 currently files *test quality* as advisory
   debt. But a non-discriminating test is **demonstrable by construction**:
   revert the behaviour the test claims to pin, observe the suite stay green.
   That is a demonstration, not taste. The harm is specific — **a suite that
   reports safety it does not provide** — and it is the mechanism by which
   defects reach production behind a passing gate. On grove#181 four equality
   comparisons could each be deleted with the suite at 119/119 green.

   So a mutation-demonstrated non-discriminating test meets the objective-harm
   anchor and may be graded into a blocking tier; an *unproven* suspicion about
   test quality stays advisory, exactly as §Method 4 has it. **The charter's new
   sole duty can gate.** The stake stated in an earlier version of this
   question — that the charter would "lose all teeth" — was false regardless,
   since Decision 1 leaves generic review and its objective-harm findings in
   place.
10. **Does `adr-0023` D3 conflict?** It holds that *"the reviewer decides how
   deep"*. Decision 2 makes instrument count a maintainer dial. Two readings
   exist — count as a *whether* question (maintainer) or a *depth* question
   (reviewer). This record takes the first, and flags that it did.

## Self-check (gate)

Run before moving `draft → gated`, per `charters/lifecycle.md`. Failures listed,
not silently passed.

| # | check | result |
|---|---|---|
| 1 | D6 quoted verbatim, reading fair | **PASS** — quotation diffed word for word; the earlier over-reading is withdrawn in the opening section rather than quietly dropped |
| 2 | The rejected-alternative in `adr-0007` is engaged, not ignored | **PASS** — quoted and answered in §Considered and rejected |
| 3 | D3 quoted accurately | **PASS** |
| 4 | Every severity claim qualified to *host* instruments | **PASS** — the charter's own grammar is stated in the table and in Decision 4 |
| 5 | Supersession mechanism matches corpus norm | **DEFERRED, not passed** — `adr-0007` does **not** yet carry `superseded_in_part_by`; it lands in the merge that carries the intent act, per `adr-0003`/`adr-0046` precedent. An earlier version of this row read PASS, which was false of the tree |
| 6 | `depends_on` resolution | **PASS, after a failure** — every id re-derived from `decisions/` rather than from memory. Round two of review found `adr-0015-review-record-separation` in this list; **no such artifact exists** (the id is `adr-0015-reviewer-machine-boundary`) and this row certified it as resolving. `adr-0027` added, since Decision 5 rests on its D2 |
| 7 | No spec amendment asserted without an `adr-0044` pairing | **PASS** — Decision 5 avoids the amendment and states the trade |
| 8 | Evidence claims sourced | **PARTIAL FAIL** — the plugin's internals are cited to an out-of-repo path that a future reader cannot verify from this repository, and latency/cost figures are single measurements with no repeat. Recorded rather than removed, because the decision depends on them |
| 9 | Decision 2 does not exceed its evidence | **PARTIAL FAIL, disclosed** — the evidence supports "one is not enough"; "run all" rests on the qualitative split and is declared a dial, not a finding |
| 10 | Fail-direction matches corpus posture | **PASS** — Decision 4 is fail-closed with the D3 override |
| 11 | Circularity | **PASS** — an earlier draft defined "available" in terms of running and then required all available to run; Decision 3 now binds *attempts* |
| 12 | Acceptance criteria | **ABSENT, deliberately** — per grove#172 and the `adr-0046` precedent, a decision of this shape carries none; the charter's new test-discrimination section and the report field are testable at execution |
| 13 | Propagation traced | **PASS** — three regenerating surfaces named in §Consequences |
| 14 | Scope leaks named | **PARTIAL FAIL** — `/security-review` is genuinely excluded by name (grove#184). But an earlier version of this row certified that aggregation, dedup and the fallback trigger were "flagged here" when **row 14 was the only place in the record those words appeared** — a row certifying itself. They are now Open 7 |

## How this record was produced

Drafted, reviewed by an independent adversary (verdict `NEEDS-REVISION`,
2026-07-28), and rewritten. The adversary's finding that changed the record most
was that its central historical claim — "D6 already decided this" — was an
over-reading of an approved decision, made twice: once to the maintainer in
conversation, and once in the draft. The disaggregation framing came from the
maintainer's observation that D6 assumes the charter and the instrument are
comparable. Both are recorded because the record's shape is otherwise
unexplainable.
