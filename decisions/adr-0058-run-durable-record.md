---
id: adr-0058-run-durable-record
type: adr
status: gated  # authored 2026-08-03 against the adr-0051 body contract; author self-check and evidence on the authoring PR (adr-0052 D4); `approved` remains the maintainer's separate act, which this author does not perform
depends_on: [spec-0006-voluntary-dispatch, adr-0052-coordination-state-out-of-ratified-prose]
owner: agent
updated: 2026-08-03
---

# ADR-0058: a run's durable record is a written-once run report, and `.grove/runs/` holds only what a guard moment can read

## Context

Two issues describe one store from opposite ends. grove#209: every run leaves a
cursor and verdict records under `.grove/runs/<run-id>/`, and nothing prunes
them — in grove and in every consuming repo. grove#213: a run that ends leaves
no trace of what it *found* — a retro-review run in `kodhama/stewards` returned
two `NEEDS-REVISION` verdicts across roughly twenty findings, and its cursor
recorded `subjects`, `intent`, `opened`, `closed` and nothing else. Too much
persistence and too little, in one tree.

What that tree actually holds, verified here:

- **Verdict records bind to subjects, not runs.** `record(rtype, $s)` matches on
  the record's own `subject`, `subject_state` and `subject_sha256`; lookup
  "shall span every run's records directory in both modes" (INV11), which
  `collectRecords` implements across every run directory, closed and aborted
  included (`guard-core.mjs:469-529`). A record already has an expiry — the
  freshness triple — and it is not its run's.
- **A closed cursor is read but never evaluated.** `inspectCursors` parses every
  `cursor.toml` in the tree and admits one to `evaluable`/`openForMode` only
  when `status === 'open'` (`guard.mjs:196-213`). Nothing consults a closed
  cursor for any decision.
- **Residue is not free to read.** A parse failure anywhere in the tree is a
  defect (`guard.mjs:207`), and "Exit `2` always denies close" (§Defect
  handling): one old cursor invalidated by a future schema change would deny
  close for every later run.
- **Grove deletes nothing today.** Close and abort are field edits
  (`run.mjs:203-238`); INV8 and INV10 say the file is never deleted. The
  deletion grove#213 reports is a human act at merge, outside grove's contract —
  grove states no rule about the tree after merge. This repository has no
  `.grove/runs/` at all: grove-self has never opened a committed run, as
  `guard-core.mjs:563-564` already records.

So the spec's claim that "closed and aborted cursors are the run's committed
audit trail" (§Staleness) is the sentence to correct: nothing reads them, and
they record no outcome.

## Decision

1. **The durable record of a run is a written-once run report, not its cursor.**
   `close-run` and `abort-run` write one `.grove/history/<run-id>.toml` carrying
   its identity and scope (id, `opened`, `closed`, `intent`, `subjects`), its
   outcome (`closed`, or `aborted` with its one-line reason), a roll-up of
   every verdict record standing at close (type, subject, verdict, author), and
   every skip taken under `floor-recorded-skips`. Written once, never revised:
   not a ledger, not a work list, not a receipt — and distinct from a reviewer's
   *closing report* (one pass's verdict) and from a *verdict record* (a
   guard-observable token).
2. **Nothing machine-reads a run report.** No transition, predicate, guard path
   or entry verb reads `.grove/history/`. A report a machine reads becomes
   coordination state with drift and a fail-open surface — the shape adr-0036 D1
   retired and adr-0052 D1 forbids. It carries no artifact frontmatter, for a
   mechanical reason: frontmatter whose `type` is outside the enum classifies
   `unclaimed`, which owes the full review set and sits in observer scope, so
   the run's own record would owe reviews forever.
3. **The narrative half is triggered, not ceremonial.** The roll-up is
   unconditional and machine-written, so no judgment can skip it. A prose
   findings section is owed only when the run's evidence was not clean: any
   non-`PASS` verdict, any defect standing at close, an abort, or any recorded
   skip. A clean run gets the roll-up alone.
4. **Verdict records outlive their run and are pruned by neither age nor
   count.** Their expiry is the freshness triple, which is exact where age and
   count are proxies. No record leaves `.grove/runs/*/records/` while it still
   satisfies that triple.
5. **The bound on `.grove/runs/` is semantic, not numeric.** It holds exactly
   what a guard moment can read for a decision: at most one open cursor, plus
   records still satisfying their triple. At close or abort, once the report has
   carried its content forward, the operation's plan also removes the terminated
   run's cursor and every record that no longer satisfies its triple — whichever
   run wrote it — deleting emptied run directories. The store then tracks
   currently reviewable subjects, not runs ever opened. **No archive threshold,
   no archive status, no archive directory**: grove's lifecycle has no archive
   vocabulary and gains none here.
6. **A cursor may be removed only by the act that has already made it
   redundant.** The report write rides the guard-licensed close — gating the
   completion record would deter it (§The confirm-gate extension, point 4); the
   prune is a disclosed, confirm-gated action in the same plan, and declining it
   leaves residue while losing nothing. The guard still writes nothing. INV10 is
   untouched: a **stale open** cursor is never deleted, and adopt or confirmed
   abort remain its only resolutions.

Direction of error, stated: shedding a record that has already stopped counting
re-owes its review if a subject reverts to previously reviewed bytes — more
review, never less, and no token vanishes silently.

## Consequences

Landing obligations, none discharged here:

- **spec-0006 owes the amendment** — §Run cursor contract (close/abort's "Never
  deleted", the audit-trail sentence), §Verdict-record contract, INV8, INV10,
  plus the report contract, the sweep, and acceptance criteria. This decision
  declares no `changes:` pin and names no spec version: other decisions are
  landing in spec-0006 in parallel, so adr-0044's reciprocal
  `changes: [spec-0006-voluntary-dispatch@vN]` / `depends_on` pair is assigned
  when the maintainer serializes them.
- Runtime work in `run.mjs` (report write, sweep, a delete action), adr-0035's
  `.grove/` tree gaining `.grove/history/`, and the dispatcher charter's floor
  extract. Consumers gain one committed path; an existing tree is swept by its
  next close.

Blast radius is enumerated on the change request per adr-0052; grove#209 and
grove#213 close when the amendment lands, not here.

## Considered and rejected

- **A numeric archive threshold** — grove#209's candidate, and the one
  corpus-bounding rule the grove#197 field scan observed. Mechanical, but the
  wrong instrument: "newest K runs" deletes live tokens from an old run and
  keeps dead ones from a recent one, where the triple answers exactly what it
  approximates. Time-based fails the same way, worse in a repo that runs
  rarely.
- **Pruning records at close** — they are freshest then; the subject was just
  reviewed. Deleting them re-owes every review on the next push.
- **Keeping closed cursors as the audit trail** (the spec's current claim) —
  nothing reads them, they carry no outcome, and each is a standing
  parse-defect surface.
- **A prose report for every run** — ceremony for a run that found nothing,
  which is how a report becomes unwritten.
- **Grove-side or forge-side storage** — not greppable by the people who care,
  and grove writes nothing outside the repository.
- **A machine-read run index** — adr-0036 D1: a bookkeeping mechanism is a new
  implementation decision, never a re-wiring.

## Open questions

- Whether `.grove/history/` ever needs a bound of its own. Deliberately none
  now: one small, never-swept file per run is a library, not residue.
- A run abandoned without close or abort writes no report; its open cursor
  persists and stale resolution covers it. Whether abandonment earns a record is
  open.
- Whether reports should later derive from forge state rather than session
  writing (spec-0006 Open 3's lineage): a session-written report is only as
  honest as its writer.
