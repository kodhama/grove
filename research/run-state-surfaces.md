---
id: research-run-state-surfaces
type: research
status: recorded  # research is a reviewless type (charter-dispatcher: research "owes nothing" — it informs, never decides), so it sits OUTSIDE the draft→gated→approved ratchet. charters/lifecycle.md's enum does not formally cover `research` — the standing gap tracked as grove#188; not resolved here. "recorded" = captured as-is; supersede with a newer research doc.
depends_on: []
informed_by: [spec-0006-voluntary-dispatch, adr-0037-pre-execution-planning, adr-0046-how-dispatch-rules-reach-a-session, adr-0058-run-durable-record]
owner: agent
updated: 2026-08-04
---

# Divergent research — durable machinery state for grove's emergent dispatch

Stage-1 divergent material for a human shaping session. **No recommendation, no
ranking.** Five architectures, the H1 residue enumeration, and the
option-independent facts. Every load-bearing claim carries a confidence tag:
`verified` (checked against a primary source, quoted or cited by line),
`inferred` (reasoned from verified facts), `speculated` (plausible, unchecked).

Research preflight: passed. Web search and fetch both returned live results
(jujutsu docs, GitHub PR/issue/API reads on `kodhama/grove`). Repo read-only;
nothing written into `/Users/gundi/Projects/grove`.

---

## Part 0 — what the two named problems actually are, mechanically

### LEAK, verified twice over

**(a) Cursors and records ride content diffs.** PR #198's changed-file list is
five files: three `.grove/runs/<id>/cursor.toml` (two `aborted`, one **`open`**,
intent "Withdraw adr-0049 consumer amendment-review anchor as never-shipped"),
one verdict record, and `decisions/adr-0049-*.md` — the actual content change.
`verified` (github.com/kodhama/grove/pull/198/files).

**(b) The scratch operation files have no defined home.** The shipped entry
text says, verbatim: `` `node <grove-plugin-root>/runtime/dispatch/bin/grove-run.mjs
plan open-run <request.json>` `` — `<request.json>` is never bound to a location
(`tooling/grove/build/sources/entry-behavior.md:28`, projected identically into
`plugins/grove/adapters/{claude,codex}/skills/start/SKILL.md`). The CLI resolves
whatever path it is handed: `grove-run.mjs:32` (`readFile(resolve(requestPath))`),
`:41` (plan), `:43` (confirmation). Nothing anywhere in the repo names a scratch
directory. `verified`.

The model therefore invents a path per invocation, and the repo root is the
default working directory. `inferred` — I did not observe an invented path in a
diff; #198's leak is the cursor half.

### DANGLING, verified with the exact mechanism

`guard.mjs:187-213` iterates **every** directory under `.grove/runs/`, reads
`cursor.toml`, and on `parsed.ok === false` pushes a defect — **without ever
consulting `status`**. `evaluate()` returns those defects; `main()` sets
`process.exitCode = 2` on any defect (`:85`); `applyRunPlan` refuses close unless
the guard exits `0` (`run.mjs:345-351`). So: **one closed cursor that a future
parser or a future schema rejects denies close for every later run, forever.**
`verified`.

Three amplifications the ask did not name, all `verified`:

1. **The same holds for verdict records, and worse.** `collectRecords`
   (`guard-core.mjs:485-527`) validates every file in every `records/` directory
   before any freshness question is asked. A record that has *stopped counting*
   (digest shed) is still parsed and still defect-capable. Stale ≠ inert.
2. **The reserved-`claims` defect is status-blind too.** `guard.mjs:198-200`
   checks `parsed.claimsPresent` before checking `status`, so a *closed* cursor
   carrying `claims` is a permanent defect.
3. **Any stray file in a records directory denies close.** `RECORD_FILENAME =
   /^[a-z0-9][a-z0-9.-]*\.toml$/` (`guard-core.mjs:25`) and every `isFile()`
   entry failing it becomes a defect (`:499-501`). `.DS_Store`, `.gitkeep`,
   `README.md`, `notes.md` — each is a permanent close-denial. Subdirectories are
   skipped silently.

**The load-bearing structural reading** (`inferred`, from the above): grove's
durable machinery store is *append-only and permanently machine-read*. Every
object ever written stays in the guard's parse path for the life of the
repository. That is what makes DANGLING an unbounded liability rather than a
tidiness issue, and it is independent of how fat the cursor is.

---

## Part 1 — H1 attacked: the non-derivable residue

**H1 as stated contains a citation error worth correcting before the shaping
session leans on it.** The ask says "adr-0046 forbids a stored marking".
adr-0046 says the opposite in its Decided list: *"**The marking lives in a
committed per-run cursor; the places stay artifact-derived.**"*
(`decisions/adr-0046-...:90-91`). What adr-0046 forbids is a *marking object in
the code* — "No net engine, no FSA library, no marking object in the code"
(`:73`). What is genuinely stored nowhere is the **enabled-and-unfired set**
(spec-0006 §Terms: "computed by the guard and stored nowhere"). `verified`.

So H1's premise "records and gates are already durable, the enabled set is
recomputed" is **already true and already implemented** (`computeEnabled`,
`guard-core.mjs:705-740`, pure over `{transitions, subjects, records}`). The
open question is only what the *residue* is.

### The residue, enumerated

Derivable at any moment from `git` + files on disk + shipped rules (no stored
state needed) — `verified` against the code that computes each:

| Fact | Computed by |
|---|---|
| the derived change set | `deriveChangeSet` (`guard-core.mjs:317-349`) |
| every subject's class | `bindSubject` + `classifyContent` (`:625-667`, `:70-101`) |
| every subject's state + digest | `bindSubject` |
| whether a record still counts | `recordSatisfies` (`:461-467`) |
| the enabled-and-unfired set | `computeEnabled` (`:705-740`) |
| the resolved gate profile | `resolve-profile` from `.grove/gates.toml`, re-run per handover (floor-profile-per-handover **forbids** caching it) |

**Not derivable — the residue.** Ten items. Column 3 is the honest one.

| # | Non-derivable fact | Home today |
|---|---|---|
| R1 | **Stance/consent** — whether this session's stop may be *held* rather than warned | the mere existence of an `open` cursor (`guard.mjs:144`: `mode = openForMode.length > 0 ? 'supervisor' : 'observer'`) |
| R2 | **Intent** — one line of human-authored prose | `cursor.intent` |
| R3 | **Scope narrowing** — which changed files this run declines responsibility for, and which unchanged files it pre-declares | `cursor.subjects` |
| R4 | **Abort reason** | `cursor.reason` |
| R5 | **The human D5 act** (in-session approval) | *nothing machine-readable.* `human-approval` is a reserved `record_type` "written by no current path" (spec-0006 §Verdict-record contract); prose frontmatter comment only (adr-0052 D2) |
| R6 | **Skips** (`floor-recorded-skips`) | **nothing at all.** `RECORD_TYPES` is exactly four — conformance, decision-adversary, spec-adversary, code-review (`transitions.mjs:7-12`); no cursor field; no other carrier anywhere in the repo |
| R7 | **Per-run gate escalation** — "for a floor-legal but decision-less run, has its `ship` gate escalated to human **for that run**" (`charters/dispatcher.md:481`) | **nothing.** `gates.toml` holds the declared profile, not a run-scoped override |
| R8 | **Session identity / liveness** | **nothing, deliberately** — "the schema records no session identity" (spec-0006 §Staleness). This is the entire cause of grove#191 |
| R9 | **Confirmation evidence** — which action ids a human confirmed, when | scratch `confirmation.json`, discarded |
| R10 | **Findings prose / the plan** | the forge (adr-0027 D2 report) and session transcript; adr-0037 §3 makes plans deliberately transient ("Interrupted plans are recomputed rather than persisted") |

One conditional item: **R11, failed and superseded review attempts.** Today
these *are* derivable — a shed record's file stays on disk (nothing deletes it),
so the history of "this was reviewed, then edited" is readable. That is an
*accidental* property of never deleting, not a designed one. Any prune (adr-0058
D5) converts R11 into non-derivable state. `verified` (nothing in the runtime
deletes a record; `inferred` for the consequence).

### The verdict on H1

**The skeletal-cursor idea does not fail because the residue is large — it fails
because shrinking the cursor does not touch either named problem.** The cursor
already stores only R1-R4 (four items), of which R2 and R4 are one line each.
Six residue items (R5-R10) have *no home at all today*. So:

- The cursor is **thin, not fat**. There is no fat to cut. `verified` against
  the schema (spec-0006 §Run cursor contract: `schema, run, opened, intent,
  subjects, status, closed, reason`).
- **LEAK is caused by the cursor's *home* (a tracked path), not its size.** A
  three-field cursor at `.grove/runs/…` leaks exactly as much as an eight-field
  one. `inferred`, and the inference is short.
- **DANGLING is caused by the guard's *parse-everything-forever* model, not the
  cursor's size either.** `verified` above.
- Therefore the live design axes are **home** and **lifetime**, not **schema
  width**. A "fatter state file" only wins if it is taking in the homeless
  residue (R5-R10) — which is a *different* argument from H1's, and one the
  shaping session should be handed separately: adopting R6 (skips) and R7
  (escalation) makes the state file fatter *and* discharges two floors that
  currently have no carrier.

---

## Part 2 — H2: the two poles, and the space between

### Pole A — the anonymized enterprise pattern (#197 addendum), read precisely

The addendum's (b) and (d), `verified` (github.com/kodhama/grove issue 197,
comment 2 via the API):

- per-run artifacts (research, plan, logs, verdicts) live in **timestamped run
  folders, committed as audit trail but never re-read as working context**;
- a fresh orchestrator **rehydrates entirely from a fixed-schema state file**
  without re-reading prior artifacts;
- completed tracker entries **auto-archive past a numeric threshold** — "the
  bundle's only explicit corpus-bounding rule";
- coordination state is typed machine fields owned by one bookkeeping agent;
  prose is the human-facing evidence layer only.

**The structural point grove's current design misses:** in pole A the *audit
trail* and the *rehydration state* are **two different objects with two
different read-policies**. Grove's cursor is all three at once — audit trail
("closed and aborted cursors are the run's committed audit trail", spec-0006
§Staleness), rehydration state ("the cursor is the resumption mechanism",
ibid.), and the guard's mode selector (`guard.mjs:144`). **That conflation *is*
DANGLING**: the audit copy stays machine-read forever, so it can deny close
forever. `inferred`, and it is the strongest single finding of this scan.

Note also that pole A's shedding rule is numeric-threshold archiving, and the
addendum itself flags the limit: "the standing spec store has **no shedding
mechanism** — the same open wound as spec-kit and grove". So pole A bounds its
*run* store and not its *truth* store; grove's question here is the run store,
which is the half pole A does answer.

### Pole B — full ephemerality

Nothing durable but verdict records. The stance (R1) then has to come from
somewhere non-durable: a per-session marker outside the tree, a branch-name
convention, or a re-ask. Records already survive across runs by contract (the
per-run directory is "a **write-home** … never a read-boundary", spec-0006
§Transition rules), so **pole B is closer than it looks**: deleting every cursor
and every run directory tomorrow would leave the record semantics intact.
`verified`.

### The map between them

Four axes, which is what makes five genuinely distinct architectures possible:

1. **Home** — tracked working tree / ignored working tree / git plumbing (refs,
   notes) / `.git/` per-worktree / none.
2. **Read policy** — machine-read forever / machine-read while live, then
   write-only / never machine-read.
3. **Death** — never / at close (rides the act) / at the next open (rides the
   successor) / at merge / by threshold (a chore — fails the custody rule).
4. **Human surface** — content diff / one clean file / rendered prose report /
   guard one-liner / `git log` view.

Today's grove: tracked, forever-read, never dies, meets the human in the content
diff. That is the corner of the space that produces both named problems.

---

## Part 3 — five architectures

Object list used consistently: **cursor / records / run trace / skips / scratch
op files / plans.**

Design-rule shorthand: **SEAM** (never rides a content diff; humans meet it
through rendered views or one deliberately clean file), **CUSTODY** (death rides
an act already performed), **CLEAN-FILE** ("at most the user sees an additional
file and there's no doubt what it is doing"), **LAYERING** (no grove function may
require a tool above it), **FS-ONLY** (no services/daemons; zero-model guard
stays file-observable), **FLOORS** (records are the review tokens; approval = in-
session act or merge; every skip recorded).

---

### Option 1 — "Two-tier committed" (adr-0058 as drafted; pole A minus the threshold)

*Included as one option in the space, not as the incumbent.*

| Object | Surface |
|---|---|
| cursor | `.grove/runs/<id>/cursor.toml`, tracked, **deleted at close/abort** by a confirm-gated prune action inside the close plan (D5, D6) |
| records | `.grove/runs/*/records/*.toml`, tracked, **never pruned by age or count** (D4); pruned only when they stop satisfying the freshness triple (D5) |
| run trace | `.grove/history/<run-id>.toml`, written once at close/abort, **machine-read by nothing** (D2); roll-up unconditional, prose findings triggered only by non-PASS/defect/abort/skip (D3) |
| skips | inside the run report (D1 names "every skip taken under `floor-recorded-skips`") |
| scratch op files | **unaddressed** |
| plans | **unaddressed**; D2's no-frontmatter rule would let a plan live in `.grove/history/` without enrolling as a subject |

**Rules.** SEAM: partial — the report is a genuine rendered artifact and the
cursor stops accumulating, but cursor + records still ride the change diff while
live, which is precisely #198's leak. CUSTODY: strong — every death rides close
or abort, no GC command, explicitly "No archive threshold, no archive status, no
archive directory". CLEAN-FILE: fails on count — a run in flight shows a cursor
*and* records *and* (at close) a history file; three object kinds, two
directories. LAYERING/FS-ONLY: pass. FLOORS: records stay the tokens; skips gain
a carrier **only at close**.

**Derivable vs stored.** Identical to today while a run is live. After close,
R1-R4 + R6 move into the write-only tier and stop being machine-derivable —
which is the intent (D2).

**Resumability.** Full and host-neutral: read the cursor, run the guard. Works
on Claude and Codex identically (the guard is `node` + `git` only, `verified`
`guard-core.mjs` imports).

**Multi-session.** Unchanged from today: per-working-tree only (see Fact F5).
Two worktrees of the same repo never see each other's open cursor.

**Invalidates in spec-0006** (adr-0058's own Consequences enumerate this and
discharge none of it): §Run cursor contract's "Never deleted" in both the Close
and Abort rows; §Staleness's "closed and aborted cursors are the run's committed
audit trail"; INV8 ("neither shall delete the file"); INV10's never-deleted
clause as it applies to terminated cursors; §Verdict-record contract gains a
prune; new acceptance criteria. It declares **no `changes:` pin** and names no
spec version, deliberately.

**Sharpest failure mode.** **The prune is declinable (D6) and the confirmation
machinery cannot express that.** The Codex review on PR #217 flags it as P2:
`applyPlan`'s contract is all-or-nothing on confirmed action ids, so "decline the
prune, proceed with the close" is not currently a representable plan. `verified`
(PR #217 review comments). Second sharpest, and unflagged in the PR: **D4 keeps
every still-fresh record forever, and Fact F1 says every retained record is a
permanent close-denial surface** — so the option bounds the *cursor* half of
DANGLING and leaves the *record* half growing monotonically. Third: the P1
finding — an abort on a cursor whose metadata is unreadable cannot produce a
report that carries `opened`/`intent`/`subjects`, so the recovery path and the
report contract collide.

---

### Option 2 — "Ignored machinery, subject-keyed evidence" (split the seam by object, not by time)

The insight it exploits: the guard reads the filesystem directly, and **ignored
files are excluded from `git status --porcelain -uall`** (Fact F3). So machinery
can be fully functional and fully invisible to git at the same time.

| Object | Surface |
|---|---|
| cursor | `.grove/runs/<id>/cursor.toml`, **gitignored**. Guard reads it from disk exactly as today; it never appears in a diff, never in the change set, never in a clone |
| records | **moved out of `runs/`** to a flat tracked store keyed by subject and type — one file per `(subject, record_type)`, e.g. `.grove/reviews/<slug-of-subject>.<type>.toml`. Committed; rides the PR; is the review token |
| run trace | the adr-0027 D2 prose report on the change request stays the human-facing trace; optionally one tracked `.grove/reviews/<...>` write per verdict is already the machine trace |
| skips | a **fifth record type** `skip` in the same tracked store — reportable but **non-consumable** (satisfies no precondition) |
| scratch op files | inside the ignored `.grove/runs/<id>/` — a defined home, invisible by construction |
| plans | same ignored home; adr-0037's "not committed" survives untouched |

**The custody story is the distinctive part.** A record dies when its successor
is written: the next review of the same subject and type **overwrites the same
path**. Death rides the review act itself. The store's size is O(subjects ×
types), never O(runs × reviews) — no prune, no threshold, no sweep, no chore.
`inferred`; the mechanism is a filename convention, and the spec today says the
opposite ("filenames carry no semantics", "unique within the run" — `verified`).

**Rules.** SEAM: strongest of the five for machinery — zero machinery bytes ever
enter a diff; what does enter is *evidence*, which belongs there. CUSTODY:
strong and chore-free. CLEAN-FILE: the user sees one tracked directory of review
tokens whose purpose is self-evident, and no machinery at all. LAYERING/FS-ONLY:
pass. FLOORS: `floor-owed-reviews` unchanged; **`floor-recorded-skips` gains its
first real carrier**, mechanically.

**Derivable vs stored.** R1-R4 stored but *untracked* (machine-local); R5-R7
optionally stored as non-consumable record types; R11 lost by design (successor
overwrite) unless git history of the tracked store is treated as the chain —
which it is, for free, on merged branches.

**Resumability.** Same-machine, same-worktree: full. **Across a clone or a CI
runner: none** — an ignored cursor does not travel. That is a deliberate
statement that a run is a machine-local activity; whether the shaping session
accepts it is the question this option asks.

**Multi-session.** Unchanged (per-worktree). But an ignored cursor may carry a
pid/heartbeat without any diff cost, which is the only way grove#191's diagnosis
half becomes mechanical (see Fact F9).

**Invalidates.** spec-0006: §Verdict-record contract's home and filename grammar
("unique within the run; filenames carry no semantics"), INV11's "record lookup
shall span every run's records directory", §Run cursor contract's home
justification ("a directory per run gives verdict records a run-scoped home"),
and the whole audit-trail framing. Records-ride-the-branch (§Verdict-record
contract) is *preserved*. Against PR #217: invalidates D4 and D5 (nothing
accumulates, so nothing needs pruning) and makes D1's report optional rather than
load-bearing.

**Sharpest failure mode.** **A subject rename orphans its record file.** The
filename is derived from the subject path, so renaming `a.md → b.md` leaves a
dead `a.md` record that nothing will ever overwrite, and the new path re-owes its
reviews. Fail-closed in the right direction (more review, never less) but it
reintroduces an accumulating, never-dying object — the exact class the option
claims to eliminate. Second: an ignored cursor is invisible to the human at merge,
so a run that was *open* while the PR was reviewed leaves no evidence it existed
— which is #213's complaint, made structural.

---

### Option 3 — "Plumbing-borne" (machinery in git refs; nothing machinery-shaped in the working tree)

| Object | Surface |
|---|---|
| cursor | a blob under `refs/grove/run` (one ref, or `refs/grove/runs/<id>`), written by `git update-ref` / `git hash-object -w`; read by `git cat-file` |
| records | **cannot live here** — spec requires they ride the branch and be visible on the change request; they stay tracked files |
| run trace | an annotated object under `refs/grove/history/<id>`, or a note on the merge commit (`refs/notes/grove`) |
| skips | notes or ref-borne, beside the trace |
| scratch op files | stdin/stdout only (no files at all) |
| plans | a blob under `refs/grove/plans/<id>` — durable, invisible, and structurally incapable of enrolling as a dispatch subject |

**Rules.** SEAM: absolute — a ref is not a working-tree file, so it cannot
appear in any content diff, ever. CUSTODY: strong — `git update-ref -d` at close
rides the act; no chore. CLEAN-FILE: **fails by construction and deliberately —
there is no file for the user to see.** The human meets machinery only through
the guard's one line and the D2 report. LAYERING: pass (git is below grove, not
above). FS-ONLY: pass — refs are files under `.git/`, read by plumbing, no
service. FLOORS: unchanged; skips get a home.

**Derivable vs stored.** Same split as today; only the home moves.

**Resumability.** Host-neutral and machine-local-plus: refs are shared across
**all worktrees of a repo**, so this is the only option where a second worktree
mechanically sees the first's open run. Across clones: **notes and custom refs
are not fetched or pushed by default refspecs** (`verified`, git docs/community
sources) — so cross-clone resumability requires a consumer to configure a
refspec, which LAYERING arguably permits (git is below) but which is a setup
burden and a silent-degradation risk if absent.

**Invalidates.** spec-0006 §Non-goals: **"No git action by any operation this
spec introduces"** — this option's entire premise. Also §Run cursor contract's
home and the §Lifecycle "Commit" row ("Grove performs no git action"), and
adr-0046's clause-4 lineage that put the cursor in `.grove/`. Against PR #217:
D1's `.grove/history/` home and D5's directory semantics; D2 (nothing
machine-reads the report) survives.

**Sharpest failure mode.** **The maintainer's clean-file bar is not merely
unmet — it is inverted.** The state becomes invisible to the person the seam rule
exists to protect, and every diagnosis becomes "run this plumbing command".
Secondary: `git gc` reaps unreferenced objects and a mistyped ref name silently
loses a run's state with no file to notice missing; and grove acquires a git-write
dependency it has never had, which is a real widening of the blast radius of a
bug (a bad `update-ref` can clobber a ref the user cares about if the namespace
is wrong).

---

### Option 4 — "Session-local, `.git/`-resident" (git's own in-progress-operation model)

The steal: git keeps mid-operation state (`MERGE_HEAD`, `CHERRY_PICK_HEAD`,
`REBASE_HEAD`, the sequencer) in `$GIT_DIR`, **per-worktree** under
`.git/worktrees/<name>/` (`verified` via git-worktree docs and community
sources), never in the working tree; `git status` renders it as prose; and the
state dies with the act that ends the operation (`--continue`, `--abort`, the
commit). Nix's GC-roots model is the same shape one level up: liveness is
reachability from a root symlink, and removing the symlink is what makes the
thing garbage — no bookkeeping pass decides it (`verified`, Nix manual).

| Object | Surface |
|---|---|
| cursor | `.git/grove/run.toml` (or `.git/worktrees/<n>/grove/run.toml`) — untracked by construction, per-worktree, dies at close/abort or with the worktree |
| records | tracked, unchanged (they are evidence, not machinery) |
| run trace | written **at close** into the tracked tree as one file, or handed to the D2 report only |
| skips | must be committed to survive → they ride the trace file at close, or stay prose-only (status quo) |
| scratch op files | `.git/grove/` — a defined ephemeral home |
| plans | `.git/grove/plan.md`, transient, adr-0037 fully preserved |

**Rules.** SEAM: absolute for machinery. CUSTODY: strongest of the five —
death is *structural*: the file is in the per-worktree state directory, so
removing the worktree removes it, and `git worktree` already owns that act.
CLEAN-FILE: fails (no visible file) unless the close-time trace is the "one
additional file", in which case it passes for the object the user actually cares
about. LAYERING/FS-ONLY: pass. FLOORS: records unchanged; **skips are the weak
point** — anything not committed at close is lost.

**Derivable vs stored.** Same as today for the live half; the durable half
shrinks to records + (optionally) one trace file per run.

**Resumability.** Same worktree, either host: full. Fresh clone / CI runner:
**none** — and that matters concretely here, because this repo runs a
Claude-based PR-review workflow in CI (`.github/workflows/claude-code-review.yml`
exists, `verified` by path), which would always see observer mode.

**Multi-session.** The only option where liveness is *mechanically* answerable:
per-worktree state plus `git worktree list` plus a pid file gives a deterministic
"is the owning process alive" check with no daemon and no model — which is
exactly the intent/diagnosis split grove#191 asks for (`inferred`; the pid check
is a syscall, not a service).

**Invalidates.** spec-0006 §Run cursor contract's home outright (INV7), the
"committed per-run cursor" of adr-0046's Decided list (a decision-level
invalidation, not just a spec one), §Staleness's committed-audit-trail framing,
and INV6's `.grove/` precondition rationale. Against PR #217: D1, D5, D6 all
lose their subject; D4 survives.

**Sharpest failure mode.** **Writing into `.git/` is outside every contract
grove has**, and hosts, tooling, and `git clean`-adjacent workflows make no
promises about foreign files there. Second: it hard-splits governance by machine
— a run cannot be handed to a colleague, a CI job, or a second clone, which is a
real regression against grove's "records are the review tokens" posture where the
tokens travel but the run does not.

---

### Option 5 — "One file, one run, git *is* the history" (invert the index: no run objects at all)

| Object | Surface |
|---|---|
| cursor | exactly one tracked path, forever: `.grove/run.toml`. Opening a run **overwrites** it. There is no run directory, no run id in a path, no second cursor |
| records | tracked, flat under `.grove/records/` (run-independent, which they already are semantically) |
| run trace | `git log --follow .grove/run.toml` — every run this branch ever opened, rendered by a tool below grove, with author and date already attached. Optionally a written report at close for the prose half |
| skips | appended to `.grove/run.toml` during the run (a `[[skip]]` array) — they die with the next open, and their history is in the file's git history |
| scratch op files | stdin/stdout (no files) |
| plans | `.grove/plan.md`, one path, overwritten per run, history in git log — a clean-file answer to grove#187 that keeps adr-0037's "no artifact frontmatter, no gate, no `implements`" intact |

**Rules.** SEAM: partial and honest — one file rides the diff, always the same
path, and it is *supposed* to be seen; there is no accumulation and no
surprise-file class. CUSTODY: the sharpest formulation of the rule in the five —
**a run's state dies at the open of the next run**, an act that has already
happened, and nothing is lost because git already holds every prior version.
CLEAN-FILE: the strongest pass — exactly one machinery file, one path, zero
ambiguity. LAYERING/FS-ONLY: pass. FLOORS: records unchanged; skips get a
carrier for the first time.

**Structural elimination of DANGLING.** With exactly one cursor path, the
"parse every cursor ever written" loop (`guard.mjs:187-213`) collapses to one
read. The multi-open-cursor defect row becomes unreachable (one path cannot hold
two files), and "one future-unparseable closed cursor denies close forever" has
no subject — there are no closed cursors on disk. `verified` as a consequence of
the code; the loop is over directory entries.

**Derivable vs stored.** R1-R4, R6, R7 stored in one file; R11 rides git; R8
(liveness) still absent unless the file carries a heartbeat, which it cannot
without diff churn (Fact F9).

**Resumability.** Full, host-neutral, and cheapest of the five: one read plus
the guard. Survives clone and CI, because it is tracked.

**Multi-session.** Per-worktree, as today — but the failure mode changes shape:
two worktrees both write `.grove/run.toml` on their own branches, and the
conflict surfaces at *merge*, as a content conflict in a file whose meaning is
obvious. That is arguably disclosure through a channel the human already reads.
`inferred`.

**Invalidates.** spec-0006: the run-id-directory home and grammar (INV7), the
`.grove/runs/<id>/records/` write-home, INV11's per-run lookup span, INV8's
two-write rule (skips are a third write moment), §Defect handling's multi-open
row, and the committed-audit-trail framing. adr-0046's "committed per-run cursor"
survives *in kind* (still committed, still per-run) but not in path. Against PR
#217: D1's per-run history file becomes redundant with `git log`; D5's semantic
bound is trivially satisfied; D4 unaffected.

**Sharpest failure mode.** **Squash-merge erases the trace.** If the branch's
run history is collapsed into one commit at merge, `git log .grove/run.toml` on
main shows one entry per merged branch, not one per run — and rebases rewrite it
further. The history channel is only as durable as the repo's merge strategy,
which grove does not control and which varies per consumer. Second: a
long-running branch's `.grove/run.toml` becomes a recurring merge-conflict site,
i.e. the machinery starts costing the human exactly the attention the seam rule
was meant to save.

---

## Part 4 — option-independent facts a shaping session needs

**F1 — every durable machinery file is a permanent close-denial surface.**
Verified above (`guard.mjs:187-213`, `:85`, `guard-core.mjs:485-527`,
`run.mjs:345-351`). Any option that keeps N objects machine-read keeps N
close-denial surfaces. This is the single strongest argument for a *read policy*
split (live vs write-only) independent of which home wins. `verified`.

**F2 — records are already run-independent.** "The per-run directory is a
**write-home** … never a read-boundary" (spec-0006 §Transition rules), and
`collectRecords` globs `.grove/runs/*/records/`. Moving records out of run
directories changes no semantics, only paths and lookup. `verified`.

**F3 — gitignoring a path removes it from the change set *and* from diffs, while
the guard still reads it.** `deriveChangeSet` runs `git status --porcelain
--untracked-files=all -z` **without** `--ignored` (`guard-core.mjs:343-345`);
every other read is a direct `fs` read. `verified`. This is the cheapest
available lever on LEAK and it requires no schema change at all.

**F4 — Codex has a measured `Stop` hook.** The retained evidence record
(`plugins/grove/reference/surfaces/codex-hook-vocabulary-2026-07-28.json`)
records: event vocabulary including `Stop`, a live capture of the hook firing
with `stop_hook_active` in its payload, and a documented
`{"decision":"block","reason":...}` output contract. So **"hooks may not run on
Codex" is a grove shipping choice (spec-0006 §Host scope forbids Codex guard
wiring in v1), not a host limitation.** `verified` — with the record's own
caveat that the block behavior was read from the manual, not exercised. For H3
this means: *no option is differentiated by host on the hook question*; they are
differentiated only by whether their state travels.

**F5 — the one-open-cursor invariant is per-working-tree, not per-repo.**
`inspectCursors` reads `join(repoRoot, '.grove','runs')`, and `deriveChangeSet`
forces `repoRoot` to equal `git rev-parse --show-toplevel` (`guard-core.mjs:322-330`),
which for a linked worktree is that worktree. Git worktrees share objects and
refs but not working-tree files (`verified`, git docs). This repo currently has a
second worktree at `.claude/worktrees/grove-fresh` (`verified` by path). So two
grove sessions in two worktrees are mutually invisible today, and only a
plumbing-borne option (3) changes that. `verified` + `inferred` for the
consequence.

**F6 — no shipped text defines where scratch operation files live.** Verified in
Part 0. Note that this is fixable *orthogonally to every option*: spec-0006
§confirm-gate extension point 1 says the operations' "module location is an
implementation choice", so switching the CLI to stdin/stdout (`plan … --stdin`,
`apply --plan - --confirm <ids>`) is an implementation + build-source change, not
a spec amendment. The only spec-visible text is the invocation line in
`entry-behavior.md`, which is a generated-projection source. `verified` for the
quote; `inferred` for "not a spec amendment".

**F7 — `floor-recorded-skips` has no carrier, and the charter already assumes one
exists.** Four record types, no skip field anywhere (`transitions.mjs:7-12`,
`cursor.mjs:12-15`), while `charters/dispatcher.md:46` says a chosen workflow
"still lands in **the run's record** — never silent". Every option must answer
this; three of the five above can. `verified`.

**F8 — a skip carrier must be non-consumable.** If a `skip` record type
satisfied `record(rtype, $s)`, a skip would discharge the review it skipped — a
fail-open in exactly the class spec-0006 exists to prevent. Today any
`record_type` outside the enum is a *defect* (`guard-core.mjs:431-436`), so
"reportable but satisfying nothing" is a **third** category the guard does not
have. `verified` for the mechanism; `inferred` for the requirement.

**F9 — liveness and the seam are in direct tension.** A liveness signal is by
nature a high-frequency write (heartbeat, pid, mtime); a high-frequency write
cannot ride a content diff without becoming the leak. grove#191 (mechanize
diagnosis) therefore pushes state *out* of the tracked tree, while grove#213
(a greppable durable record) pushes it *in*. **The two named issues exert
opposite pressure on the same object**, which is why the split-by-object or
split-by-read-policy options (2, 3, 4, and adr-0058's two tiers) all exist. This
is the shaping session's core trade, and no option escapes it. `inferred` from
verified premises; I could not find any system in the bounded external scan that
solves both in one object.

**F10 — today's de-facto architecture is already "ephemeral, hand-swept".**
`.grove/` in this repo contains only `README.md`, `gates.toml`, `config.toml` —
**no `runs/` directory** (`verified` by glob), and `guard-core.mjs:563-566`
states the same as of its landing. grove#213 opens with "Run state is deleted on
merge today". So the status quo is pole B *performed by hand*, and LEAK +
DANGLING are the symptoms of a human doing the sweep. `verified`.

**F11 — any persisted plan must carry no artifact frontmatter.** A file with a
`---` block whose `type` is outside the enum classifies `unclaimed`
(`guard-core.mjs:70-101`), which owes the full four-record set and sits in
observer scope (`guard.mjs:21`). That is exactly grove#187's reported failure —
`plans/adr-0048-implementation-plan.md` with `status: recorded` "enroll[ed]
itself as an upstream in the dispatch graph". adr-0058 D2 names the identical
mechanism for its report. So the constraint on plan persistence is mechanical and
option-independent: **no frontmatter, or it becomes a subject.** `verified`.

**F12 — `.gitattributes linguist-generated=true` collapses a file in GitHub PR
diffs but leaves it in the file list and the changed-file count** (`verified`,
GitHub/linguist community sources). It is a forge-specific cosmetic mitigation,
not a seam, and it does nothing for a non-GitHub consumer — relevant only as a
cheap add-on to any tracked-state option.

**F13 — external comparators, what each actually offers.**
- *git's in-progress state*: per-worktree, in `$GIT_DIR`, rendered by `git
  status`, killed by the act that ends the operation. Best available model for
  "state that must not ride a diff and must die with the act". (`verified` for
  per-worktree isolation and shared-except-per-worktree-files; `inferred` for the
  precise `.git/rebase-merge` path names, which I did not confirm from a primary
  source.)
- *jujutsu's op log*: a separate content-addressed store of *operations* and
  *views*, never in the working copy, lock-free under concurrent access, with
  divergent heads merged by a 3-way view merge (`verified`, jj docs). The steal
  is the shape — a history of operations distinct from the state they produced —
  not the implementation.
- *Nix GC roots*: liveness = reachability from root symlinks; removing the
  symlink is what makes a path garbage (`verified`, Nix manual). Custody-rule
  precedent, but collection itself is still an explicit command — which is
  exactly what grove's custody rule forbids.
- *Terraform*: the community's split is instructive — the **lock file is
  committed** (a reproducibility manifest, safe to share) and the **state file is
  never committed** (live state, secrets) (`verified`). The precedent says: it is
  normal and legible for a tool to have one committed machinery file and one
  uncommitted one, with the split drawn by *what the file is for*, not by
  tidiness.
- *GitHub Actions run artifacts*: skipped per the ask (service-dependent).
- *In-repo prior*: `research/work-transfer-and-join-mechanics.md:41-57` already
  records two cautionary cursor cases (Kiro #8859, claude-flow #1397) where a
  state store disagreed with reality, and offers "atomic claim on the work
  record" plus a "24-hour stale sweep" as the field's answer to staleness — the
  sweep being a chore grove's custody rule rejects. `verified`.

---

## Part 5 — H3 verdict, per option

"If run state is clean FS state, a fresh session rehydrates by reading it +
re-running the guard." **True for every option, on both hosts, for the machine
that owns the state** — the guard is `node` + `git` only and the Codex Stop hook
is measured (F4). What differentiates the options is not the host but the
*travel radius* of the state:

| Option | same worktree | sibling worktree | fresh clone / CI |
|---|---|---|---|
| 1 two-tier committed | yes | no (F5) | yes |
| 2 ignored machinery | yes | no | **no** |
| 3 plumbing-borne | yes | **yes** | only with a configured refspec (`verified`: not default) |
| 4 `.git/`-resident | yes | no (by design) | **no** |
| 5 one file | yes | no | yes |

`verified` for the mechanisms; `inferred` for the table's per-cell conclusions.

---

## What I could not verify

- **Whether any invented scratch path has actually landed in a diff.** #198's
  leak is cursors and a record; I found no committed `request.json`/`plan.json`.
  The scratch leak is a *demonstrated absence of a defined home* (F6), not a
  demonstrated incident.
- **grove#197's field-scan source material** beyond the addendum comment itself
  — the bundle is internal and anonymized by instruction; I cite only the
  comment.
- **The `.git/rebase-merge` / `.git/sequencer` path names** — the per-worktree
  *isolation* is verified from git docs and community sources; the exact
  directory names are model recall and should be re-checked before any option 4
  design leans on them.
- **This repo's merge strategy (squash vs merge commit)** — load-bearing for
  option 5's history channel, and I did not check the forge settings.
- **Whether grove#191 or #213 have comments** — the fetches returned bodies with
  no comments recorded; I did not independently confirm the comment count.
- **Any measurement of guard cost** as `.grove/runs/` grows (F1 is a correctness
  argument, not a performance one).
