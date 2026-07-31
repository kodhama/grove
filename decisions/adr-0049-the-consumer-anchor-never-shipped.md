---
id: adr-0049-the-consumer-anchor-never-shipped
type: adr
status: gated  # agent-authored; the gated -> approved flip is a human intent act and is NOT performed here
depends_on: [adr-0044-review-significant-spec-amendments, adr-0045-portable-amendment-review-cutoff]
owner: agent
updated: 2026-07-31
---

# ADR-0049: the consumer amendment-review anchor never shipped

## Decision in one line

`adr-0045`'s consumer-repository anchor is withdrawn as never-shipped; Grove's
own anchor is untouched.

## The finding

`adr-0045:210-212` defines the thing its consumer case depends on:

> "Rule-bearing release" means the immutable Grove version whose shipped
> projection contains this rule; its repository stamp supplies the exact
> version at use time.

**No such version exists, and none ever has.** The load-bearing fact is the
second one:

- Every released tag predates the rule's approval. `grove-v0.1.0`
  (2026-07-22), `grove-v0.2.0` (2026-07-23) and `grove-v0.3.0` (2026-07-24)
  are the only tags in the repository, and all three precede `adr-0045`'s
  ratification on 2026-07-26. `git merge-base --is-ancestor` confirms the
  rule's landing commit is unreachable from every one of them.
- **The rule is in no projection, released or current.**
  `git grep -l -iE "adr-0044|adr-0045|amendment-review|amendment conformance" -- plugins/`
  returns nothing — not the shipped charters, not either host's adapters, not
  the reference tree. Releasing the current payload would ship nothing either,
  so this is not a not-yet-released condition.

So a consumer's step 2 — *"every stamped immutable release must ship this
rule"* (`:108-111`) — has never been satisfiable by any stamp any consumer
could carry. **No consumer has ever activated, and none could have.**

## A larger finding, disclosed rather than absorbed

The reason the rule never shipped is not that a release was pending. **It is
that `adr-0044`'s implementation never landed anywhere.**

`adr-0044:317-332` requires `charters/conformance-reviewer.md` to learn the
amendment selector, `charters/contract-author.md` and `specs/README.md` to
point at the paired-record requirement, and scoped forward notes on ADR-0010,
ADR-0012, ADR-0016 and `charters/versioning.md`. A grep across all of them for
`adr-0044` returns **zero hits**. No charter carries the selector, in source
or in projection.

The amendment-review discipline is therefore enforced today only because
agents read `decisions/` directly — it exists as decision text and nowhere
else. That is a working arrangement for Grove-self, and `spec-0006:1242`
records a real review passing under it. But it means the actionable half of an
approved decision's consequence list is outstanding, and nothing in the corpus
says so. Precisely: across `adr-0044:317-340`, the charter and forward-note
duties never landed; the preservation statements at `:333-335` and the closing
bullets had nothing to land.

**This record does not fix that**, because the fix is a separate decision
about `adr-0044`, not about the consumer anchor. It is disclosed here under
`inv-self-improvement` so the fact is not lost: `adr-0044`'s propagation is
owed, and whether to ship the rule at all is the live question behind this
record's *Open questions*.

## What this record does and does not change

**It changes the corpus, not the behavior.** Consumer amendment-review
activation is unavailable today and will be unavailable tomorrow. What changes
is that the corpus stops describing a mechanism as live when it is not — which
matters because `adr-0044`'s annotation and seven regions of `adr-0045` itself
reason from its existence, and because
a later reader would otherwise inherit a rule they cannot execute and cannot
tell is dead.

**Grove-self is untouched.** `adr-0045:92-93` fixes Grove's own `A` as the
commit `947d9bdc702798b960a67a9a465e61beebe44fa7`, derived from its own
history and needing no stamp. Every Grove-self amendment review continues
exactly as approved. `adr-0044`'s selector, active-contract model, historical
exception and target-tip evidence are all preserved — this record touches only
how a *consumer* obtains `A`.

**Nothing about the managed block or the stamp is decided here.** The stamp
still exists and setup still writes it. Whether it should is a separate
question, deliberately not answered in this record.

## Decision

**1. The consumer-repository anchor is withdrawn, not replaced.** A consumer
repository has no local `A` and no route to one. This record invents no
substitute mechanism.

**2. Grove-self's anchor stands unchanged**, along with every rule in
`adr-0044` and everything `adr-0045` §2 (`:131-149`) explicitly preserved.

**3. Reinstating a consumer anchor is a future decision with a real
repository to design against.** It is not parked as pending work, because
nothing is blocked: no consumer is waiting on it, and none has ever used it.

**4. An anchorless consumer repository is not thereby exempt.**
`adr-0045:162-163` — *"The reviewer never treats 'no usable local anchor' as
proof that all current content is historical"* — **survives this record and
is restated here as operative.**

This clause is the one part of §3 whose subject is not the carrier set, and
review caught that withdrawing it would be a real behavior change rather than
a corpus correction. Before this record, a consumer occasionally lacked a
usable anchor and that clause governed the case. After it, **every** consumer
lacks one permanently — so the clause stops being an edge case and becomes the
governing rule for the whole class. Withdrawing a prohibition at the moment it
becomes universal would convert "no mechanism" into "silently always exempt,"
because `adr-0044`'s fail-closed list (`:172-174`) is scoped to
*selector-governed* versions, and with no `A` no consumer version is
selector-governed.

Concretely: a reviewer in a consumer repository shall conclude that consumer
amendment-review activation is **unavailable**, not that consumer content is
historical. Absence of an anchor is absence of a verdict, never a passing one.

**And it must still route, which the withdrawn text did and this clause has to
replace.** `adr-0045:156-157` sent the untrustworthy-anchor state *"to the
existing Grove setup/refresh or shaping path"*; that route is carrier-scoped
and goes with the carrier policy. In its place: the amendment axis alone is
non-terminal. The containing conformance review proceeds normally on every
other axis and returns one of `adr-0044` AC5's three verdicts (`:363-365`) on
those, recording the amendment axis as unavailable-by-decision with a pointer
to this record. A consumer review is not blocked; one of its axes is
unavailable, and says so.

## Supersession — scoped, per `decisions/README.md`

`adr-0045` stays `approved`, takes `superseded_in_part_by:
[adr-0049-the-consumer-anchor-never-shipped]`, and carries a forward pointer at
each withdrawn site — per-site rather than at the top, because
`charters/lifecycle.md:69-72` requires the outgrown part to carry the pointer
for partial supersession.

**All `adr-0045` line citations below are pinned to commit
`2412e2071444b6e8152322964555f189362a30a2`**, the ratification landing that
last modified that file. Pinning is not decoration: inserting per-site forward
pointers shifts every line below each insertion, so an unpinned table stops
resolving the moment this record lands. `adr-0045:38-40` shows the same instinct in a different
register — it names the exact reviewed commit rather than trusting a
description of it.

The table below was re-derived from a full read of `adr-0045` at that commit,
with bullet counts taken mechanically rather than by eye. Three earlier
attempts miscounted the rejected-option bullets — five, then six — because
they were written from range boundaries instead.

**Withdrawn — the consumer half:**

| `adr-0045` site | What it is |
|---|---|
| `:25-27` | Decided — the consumer derives its anchor from the stamp |
| `:31-33` | Decided (maintainer) — two-step consumer activation |
| `:34-37` | Decided (maintainer) — repository-wide activation across carriers |
| `:51-53` | Parked — an adoption receipt is unnecessary because *"The existing managed stamp and review evidence are sufficient for the portability correction"* |
| `:89-90` | §1 umbrella, **consumer case only**; the Grove-self case it also covers stands |
| `:94-97` | §1 — the consumer anchor derivation |
| `:99-101` | §1 — the prohibition on inferring adoption from cache, session, wall-clock or conversation |
| `:103-120` | §1 — the five-step repository-wide carrier policy |
| `:122-124` | §1 — consumer-only rationale for repository-wide activation |
| `:151-161` | §3 — carrier-state fail-closed routing. **`:162-163` is excluded; see clause 4** |
| `:165-176` | §4 — activation ordering |
| `:180-198` | Rejected options — **all seven bullets** (`:180`, `:182`, `:184`, `:186`, `:189`, `:193`, `:196`), each with a consumer subject. Correctly reasoned; retired for absence of subject, not for error |
| `:202-204` | Consequences — the `adr-0044` pointer supplying *"the consumer-local case"* |
| `:210-212` | Consequences — *"Rule-bearing release"* and the stamp supplying the version at use time |
| AC2 `:218-221` | Consumer derivation criterion |
| AC8 `:232-234` | Two-step consumer activation criterion |
| AC9 `:235-237` | Carrier-state policy criterion |

**Not withdrawn — and four of these corrected against earlier drafts of this
record:**

| `adr-0045` site | Why it stands |
|---|---|
| `:16-18`, `:19-21`, `:22-24`, `:28-30`, `:38-40` | Decided bullets; none concerns the consumer case. `:22-24` is Grove-self's anchor |
| `:48-50` | Parked — decision renumbering, unrelated |
| `:57-76` | Context — `adr-0044`'s selector, the `A`/`B` definitions, the non-portability diagnosis. Still accurate: the literal rule remains non-portable, now simply unremedied |
| `:77-83` | Context — what setup and refresh write. An accurate description of current behavior, not a requirement |
| `:92-93` | §1 — Grove-self's `A`, the anchor this record preserves |
| `:126-129` | §1 — `B` as captured tip OID and the closing-report duty. Operative for Grove-self |
| `:131-149` | §2 — the preserved selector, expressly unchanged |
| `:162-163` | §3 — *"The reviewer never treats 'no usable local anchor' as proof that all current content is historical."* **Restated as operative in clause 4** |
| `:205-206` | Consequences — the reviewer uses the repo-local anchor; true for Grove-self |
| `:207-208` | Consequences — projections stay portable without a Grove ancestor commit. **Corrected: an earlier draft withdrew this while preserving AC7, its exact twin.** Both are standing prohibitions on projection generation, both still satisfiable and true |
| `:209` | Consequences — managed-block syntax and lifecycle unchanged. True; this record touches neither |
| AC1 `:216-217` | Grove-self's anchor |
| AC3 `:222-223` | `B` and the closing report — the paired criterion of `:126-129` |
| AC4 `:224-225` | *"Missing, invalid, ambiguous, or unverifiable anchor evidence cannot produce a terminal amendment-conformance verdict or a historical exemption."* **Corrected: an earlier draft withdrew this for the consumer case while clause 4 re-enacted its substance.** It is `:162-163`'s paired criterion and stands whole |
| AC5 `:226-227`, AC6 `:228-229` | Cross-cutting; unaffected |
| AC7 `:230-231` | The twin of `:207-208`; a standing projection-generation prohibition, not an anchor mechanism |

Non-operative regions carry no classification and need none: Decision state
`Open` `:42-44`, `Open questions` `:239-241`, `Self-check` `:243-260`.

**`adr-0044`, `:23-28`** takes its own scoped pointer — its annotation states
that *"consumer repositories derive local `A` from the canonical target-branch
landing of valid, rule-bearing `grove plugin@<version>` managed-block stamp
evidence."* `adr-0044`'s `superseded_in_part_by` currently names only
`adr-0045`. That is the only site in its 415 lines carrying the consumer
derivation; its `A` definition at `:51-60`, `:248-251`, `:260-262` and AC1
`:343-351` are written without a Grove-self qualifier and are preserved —
which means the permanently-false consumer selector `adr-0045` was written to
correct is reinstated. Clause 4 is what keeps that from becoming a silent
exemption.

## Amendment obligation

**None.** `adr-0045` declares no `changes:` pairing and implements no spec;
outside `decisions/`, the only file naming it is
`tooling/grove/tests/dispatch/test/corpus-classification.baseline.json:85`,
which classifies the artifact as a `decision` and stays correct because the
record remains present and `approved`.

This is the whole reason the scope was cut here. An earlier attempt bundled
this withdrawal with retiring the managed block and retiring `refresh`; that
record's surface reached eleven decisions, sixty-four spec clauses and eleven
test files, and six independent adversary passes each found sites the previous
pass had missed. Splitting on the dependency edge — withdraw the thing nothing
ships, before touching the thing everything references — produces a surface
that can be enumerated completely and checked.

## Consequences

- Consumer amendment-review activation is unavailable. It always was; this
  record makes the corpus say so.
- Two records stop pointing at a live mechanism: `adr-0044`, at its
  annotation, and `adr-0045` itself, at seventeen sites — four Decision-state
  bullets, parts of §1, §3 and §4, all seven Rejected options, two
  Consequences bullets, and three acceptance criteria.
- The next record in this sequence — retiring the managed block and the
  version stamp — inherits a much smaller `adr-0045` surface, because its
  consumer-facing clauses are withdrawn here. **It is not zero, and an
  earlier draft of this record wrongly said it was.** Two clauses this record
  deliberately preserves are preserved *because they accurately describe
  managed-block behavior* — `:209` (*"Existing managed-block syntax and
  lifecycle behavior are unchanged"*) and Context `:77-83` (setup and refresh
  writing the stamp). A record that retires the block falsifies both and must
  supersede them. The saving is roughly eight sites down to two, not eight
  down to none.
- Nothing in Grove's own review pipeline changes.

## Considered and rejected

**Replace the consumer anchor with a new mechanism now.** Rejected: there is
no consumer to design against. `adr-0045`'s own rejected options `:180-198`
show the design space was already searched once against a hypothetical
consumer, and the result was a mechanism that never shipped. Repeating that
exercise without a real repository invites the same outcome.

**Leave `adr-0045` alone and treat the consumer case as dormant-but-live.**
Rejected: a rule that cannot be executed and is not marked reads as executable
to every later author. This record's whole value is closing that gap, and
`decisions/README.md:34-35` requires that *"No reader should ever land on stale
text without a link forward"* — which a dormant-but-unmarked mechanism defeats
by construction.

An earlier draft additionally cited `adr-0044:169-171`'s incompatible-decision
rule. **That citation is withdrawn:** the rule is scoped to approved
*amendment decisions*, which `adr-0044:148-155` defines as requiring a
`changes: [X@vN]` declaration — and this record itself establishes that
`adr-0045` declares none. The rule can never fire on this subject.

**Bundle this with retiring the block and the stamp.** Rejected on evidence —
that is what three prior drafts attempted across six adversary passes, and
see *Amendment
obligation* for what it cost.

## Open questions

- Whether a future release should ship the amendment-review rule and
  reinstate a consumer anchor at all, or whether consumer repositories should
  be governed some other way. Deliberately unanswered; it needs a consumer.
- **`adr-0044`'s outstanding propagation, tracked here rather than left in
  prose.** Its charter and forward-note duties (`:317-340`) never landed, so
  no charter carries the amendment selector. `inv-self-improvement` requires
  naming the exemption and asking rather than resolving it silently: this
  record names it and asks, and the disposition — implement the propagation,
  or record that the discipline lives in decision text by design — is a
  decision about `adr-0044` that this record deliberately does not take.
  It is the live question behind the first open question above: shipping the
  rule is not foreclosed, merely never done.

## Self-check (gate)

- **Settled ground** — both `depends_on` targets are `approved`. No spec is
  paired, so nothing is built on a moving draft.
- **Supersession, not in-place edit** — two records keep their text and take
  scoped forward pointers; every clause of `adr-0045` is classified as
  withdrawn or explicitly not withdrawn, from a full read.
- **Graph maintenance** — the amendment obligation is empty and the reason is
  stated and checkable, not asserted.
- **Independent judgment** — agent-authored, unreviewed. The author does not
  rate it. Note that this record's central finding originated in an
  independent adversary pass, not with the author, who had recorded the same
  question as unresolvable in this record when it was answerable in two
  commands.
- **Transparency** — the record states that it changes the corpus rather than
  any behavior, and states that the previous scope failed six reviews rather
  than presenting this decomposition as the original plan.

## How this record was produced

The finding came from an independent decision-adversary pass on a much larger
record that attempted this withdrawal alongside retiring the managed block and
`refresh`. That record failed six adversary reviews, each finding supersession
sites the previous pass missed; the failure was in coverage, never in premise.

The reachability question was the last open item in that record, which
declared it unresolvable and requiring settlement before ratification. It was
resolvable in two commands, both inside the sweep the record had already
claimed to run. Every fact in §The finding above was re-verified in this tree
before being written here.
