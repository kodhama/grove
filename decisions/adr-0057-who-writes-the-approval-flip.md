---
id: adr-0057-who-writes-the-approval-flip
type: adr
status: gated  # gated 2026-08-03 (author self-check against the adr-0051 body contract; evidence on the change request). The gated → approved flip is the maintainer's act and is deliberately not written here — on this subject, an agent flipping it would refute the record.
depends_on: [adr-0008-lifecycle-enum-companion, adr-0018-gate-profile-and-trigger-split, adr-0046-how-dispatch-rules-reach-a-session, adr-0052-coordination-state-out-of-ratified-prose]
owner: agent
updated: 2026-08-03
---

# ADR-0057: the approval flip is a transcription — written once, by the session that witnessed the act

## Context

`charters/lifecycle.md:46-49` reads: *"`approved` — ratified by a **human
intent act** (in review, in conversation, or by merging); the status flip
records that act. **An agent never flips `approved` without a recorded human
act**."* The qualifier is load-bearing, and grove already reads it that way:
adr-0041, 0043, 0046–0048 and 0050–0054 each carry an agent-authored `status:`
line quoting the maintainer verbatim, naming approver ≠ author and the channel.
**A writer exists, and where it fires it works.**

`specs/0006:688` compresses the rule into `floor-approved-flip-human` — *"an
agent never flips it"* — dropping the qualifier. That table declares itself
*"canonical meaning; the charter span carries the authoritative text"*, so this
is compression, not a second rule. Read literally it forbids grove's entire
recorded practice. The contradiction is textual, and it is internal to grove.

grove#202's magnitude survives re-measurement here at `12e71e5`: 80 real
status-bearing artifacts, 20 non-approved. Two supporting claims do not
survive. *"Twenty of grove's twenty-two agent charters"* is **13 of 14** — four
files in `charters/` declare themselves not agent roles, and `corpus-reviewer`
is approved; the 2026-07-07 age holds (`charters/executor.md`, `627165d`). And
the claimed live conflict with `kodhama-0004` is not live: that mechanic clause
carries `superseded_in_part_by: [kodhama-0008]`, whose clause 2 states *"No
kodhama-meta artifact defines how the approval act is performed or recorded."*
The family layer vacated the field deliberately. Grove's rule is the only one.

What the sweep actually found is that **`gated` names four states at once**:

- **Act occurred, never transcribed** — the real backlog (`kodhama-0013`).
- **Agent-gate satisfied, terminal.** Under grove's `steward` profile
  (`spec = agent`), `charters/dispatcher.md:198-201` rules: *"Agent
  ratification ratifies for downstream consumption; it does not promote the
  artifact to `approved`."* `spec-0005` records exactly this and is correct
  as-is. No human act is owed, and `approved` will never come.
- **No act ever solicited** — grove's 13 charters.
- **Outside the ratchet** — the four `recorded` research docs (grove#188).

Only the first is backlog. And where two writers touch one act, they diverge
rather than reinforce: `kodhama-0008` carries `status: approved` quoting the
maintainer's 2026-07-12 act while its own `provenance:` line and H1 still read
*"DRAFT — the maintainer's approval… is pending."*

## Decision

1. **The flip is a transcription; the floor governs the act, not the
   transcription.** `floor-approved-flip-human` forbids an agent *approving*.
   An agent recording an approval it witnessed is a scribe, and that is
   lifecycle.md's existing text, not a relaxation of it. The floor's canonical
   text is corrected to carry the qualifier it dropped.
2. **One writer, one home, and the writer must have witnessed the act.** The
   authorized writer is the session in which the human act occurred; the home
   is the append-once `status:` provenance line (adr-0052 clause 2). The line
   quotes the act verbatim, names approver ≠ author, and names the channel.
   No second narration of the same act anywhere in the body.
3. **A later session may transcribe only from durable evidence of the act** —
   a quoted review, a quoted in-session line, a merge event with the artifact
   named as a ratification subject on the change request. **Never from
   inference.** Absent such evidence the artifact stays `gated` and the human
   is asked. This keeps `floor-d5-channel` intact and refuses to launder a
   guess into a record.
4. **No merge-triggered writer.** A bot cannot distinguish *"merged because
   approved"* from *"merged a PR that happened to touch it"*, and the
   distinction is the whole content of the act. Measured on this tree: PR #208
   merged `charters/executor.md`, `decision-adversary.md` and
   `implementation-planner.md` — a corpus landing wave, not a charter
   ratification. A merge-trigger would have stamped all three `approved` on
   2026-08-03 with a real SHA and a real username, and all three would be
   false. Today's `gated` is a **visible unrecorded act**; a bot's `approved`
   is an **invisible fabricated one**. The trade is strictly worse.
5. **Charters ride `ship`, and the act has been occurring.** `ship` attaches
   to whatever artifact ends the run (adr-0018 D4, per
   `charters/dispatcher.md`), and grove's profile sets `ship = human`. A
   charter-terminal run's landing merge *is* a human ship act on that charter,
   exactly as *"merging just an ADR is the `ship` gate firing"*. Grove's 13
   were never un-ratified for want of a decider — they were un-transcribed
   for want of a witness under clause 2. They are drained by asking, per
   clause 3, never by backfilling.
6. **`gated` is never reported as one number.** Any count sorts by the act
   owed: transcribe, solicit, terminal-and-correct, or out-of-ratchet. The
   21% headline is not a backlog figure until split — and a large part of it
   is the correct steady state, which is a finding, not a default.

## Consequences

**Landing obligations — named, not performed here.** (a)
`charters/lifecycle.md`'s `gated → approved` row gains clauses 2–3 (single
witnessing writer; durable-evidence rule). (b) `specs/0006`'s
`floor-approved-flip-human` canonical text gains the transcription qualifier.
**No version is claimed and no amendment is made**: three decisions are being
authored against spec-0006 in parallel, and version claims serialize behind
human approval. (c) A split re-count posted to grove#202. Tracked per adr-0052
on the change request, not here.

**Boundaries.** grove#74 Facet B asks the adjacent question — whether the
authored recording should also emit a machine-visible `human-approval` record,
and Facet A whether weaker channels are honored at all. This decision rules
only on *who writes, and from what evidence*, within the self-authenticating
channels v0 already honors; the reserved record type stays unwritten
(adr-0052 clause 4 draws the same line). grove#188 owns whether `recorded` and
per-type lifecycles are right; nothing here extends or defends the enum.

**Cost, stated plainly.** Clause 4 leaves a human act that no one witnessed
producing no record. That residue is accepted: it is loud, it is visible as
`gated`, and it is the price of never fabricating provenance.

## Considered and rejected

- **A CI merge gate** blocking a PR that lands a `gated` artifact. adr-0036
  retired the last deterministic bookkeeping runtime and adr-0052 ruled any
  revival *"a new implementation decision"*; adr-0027 retired CI for now. This
  is a live option, but it needs its own decision and its own runtime, and it
  is not smuggled in behind a lifecycle clarification.
- **Reinstating the post-merge bump** (`kodhama-0004`'s retired mechanic): it
  is the mechanic that was already failing when it was superseded, and
  `kodhama-0008` declined to replace it on purpose.
- **`approved_by` / `approved_on` frontmatter fields**: adr-0052 already
  rejected displacing the provenance line, which carries the quoted act that
  structured fields cannot hold. Structuring it is grove#74's to weigh.

## Open questions

- Whether a charter-terminal run should solicit the ship act explicitly at
  landing, or whether the merge alone suffices once clause 5 is written down.
  Practice under this decision should answer it before machinery does.
