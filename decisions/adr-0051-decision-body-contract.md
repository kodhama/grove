---
id: adr-0051-decision-body-contract
type: adr
status: gated  # self-checked against the body contract it defines; trunk proposal ratified in-session by the maintainer 2026-08-03 (D5 channel); approved flip awaits maintainer review of this text
depends_on: [adr-0005-tdd-and-artifact-gated-dispatch]
owner: agent
updated: 2026-08-03
---

# ADR-0051: the decision body contract — decisions record intent; contracts carry criteria

## Context

corpus-reviewer check 6 ("required body sections per type, as the project's
contract declares them") dereferences `ARTIFACT_CONTRACT_PATHS`; of its three
targets only `specs/README.md` declares body sections. For `adr` and `charter`
the check has no referent — it can neither pass nor fail. In that vacuum,
**39 of 47 decisions grew `## Acceptance criteria` sections** the decisions
contract never asked for (grove#172), and three rubric paths in
`.grove/config.toml` still read "none exists yet".

The pipeline harm is concrete: a decision carrying testable acceptance criteria
pre-empts the contract-author stage, so the spec gate reviews content that was
ratified at the intent gate and the two stages collapse. Grove saw this live on
adr-0046, which deliberately omitted ACs citing grove#172. The family precedent
is `trellis/core/rubrics/artifact-contract.md` (id `rubric-artifact-contract`,
`status: ratified` 2026-07-03, scope trellis-product): decisions carry
Context/Decision/Consequences; acceptance criteria belong to specs. That rubric
is ratified **in trellis** — adopting its split here is the recorded grove
choice grove#172 asked for, not an inheritance.

The adversarial re-verification of grove#197 adds the counterweight this
decision honors: only 5 of the 39 AC sections are checkbox bookkeeping; most
are substantive, testable criteria at the wrong altitude. The remedy is
relocating the practice, never deleting the history.

## Decision

1. A decision body **requires** `## Context`, `## Decision`, `## Consequences`;
   it **permits** `## Considered and rejected` and `## Open questions`. Any
   other section is a check-6 finding. The contract is written into
   `decisions/README.md`, giving check 6 its referent for `type: adr`.
2. **Acceptance criteria live downstream.** For code-bearing work they belong
   to the spec — adr-0005 D1 already requires code-bearing work to derive its
   tests from a spec. For non-code landings (adr-0005's decision-only
   carve-out), checkable done-criteria go to the tracking issue's structured
   metadata. Subordination: tracker done-criteria derive from and are
   subordinate to the decision's ratified prose; on conflict the decision wins;
   ticking them is never the approval act (the D5 channel is untouched).
3. **Forward-only.** The 39 existing AC-bearing decisions are append-only
   history (`decisions/README.md`) and are not edited. The contract binds at
   the gate for newly authored decisions.
4. **Length canary.** A decision draft whose body exceeds ~1,200 words owes an
   explicit justification at its gate; the decision-adversary treats
   unjustified excess as an altitude finding. A canary, never an auto-fail.
   (Grove's decision-body median today is 1,954 words, maximum 12,304; the
   target register is Nygard's one-to-two pages.)
5. The decision-adversary charter's axis-1 elaboration is reworded from
   "stated effects vs. acceptance criteria vs. consequences" to "stated effects
   vs. consequences" — safe, because adr-0012 names the four axes abstractly
   and the AC phrasing is charter elaboration only.

## Consequences

Blast radius, enumerated on the change request and tracked per adr-0052:
`decisions/README.md` (the contract text), `CONTRIBUTING.md` (a "proposing a
decision" section — none exists today), `charters/decision-adversary.md`
(axis-1 rewording), a `.grove/config.toml` comment. The rubric paths stay
parked as "none exists yet": this is a section contract, not a rubric.

Curve 4 of grove#197 (decision median length) bends at the median for newly
authored decisions. Criteria relocated to specs move words downstream at the
correct altitude; the epic's curve 3 tracks largest-spec trajectories, which
new right-sized specs do not feed. Where a decision's landing is non-code, its
done-criteria live in tracker metadata under clause 2 — the decision body
stays an intent record.

This decision resolves grove#172's asks 1 and 2, and adopts trellis's split as
grove's recorded choice. It does not resolve where the decision-vs-spec
dispatch line falls — that remains parked in adr-0005.

## Considered and rejected

- **Editing history to strip the 39 AC sections**: forbidden by append-only,
  and the re-verification showed the content is substantive — stripping would
  delete the corpus's most testable text.
- **A hard length cap**: caps invite splitting-by-formatting and add gate
  machinery no invariant demands; the canary keeps enforcement at judgment
  altitude.
- **Writing full per-type rubrics now**: a heavier artifact than the vacuum
  requires; the section contract is the minimal referent check 6 needs.

## Open questions

- Whether `charter` deserves the same README-declared section contract in the
  same pass (its de-facto sections are already stated in CONTRIBUTING.md).
