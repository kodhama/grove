---
id: spec-0006-voluntary-dispatch
type: spec
status: gated  # spec gate ratified 2026-07-28 under the `spec = agent` profile row: spec-adversary APPROVE-READY at round eight of an eight-round convergence (rounds 1-3, 5-8 spec-adversary; round 4 fresh-eyes decision-adversary, concurring). The verdict record with the convergence table, mechanical-vs-behavioral ledger and residual risks is on PR #177. `approved` remains a human act; ship = human stands.
implements: adr-0046-how-dispatch-rules-reach-a-session
depends_on: [adr-0046-how-dispatch-rules-reach-a-session, spec-0004-dual-host-distribution@v8, adr-0035-plugin-and-consumer-boundary, adr-0048-parsers-are-dependencies]  # @v7 -> @v8 advanced in the landing commit per §Propagation and landing pairing; adr-0048 is v3's amendment contract (adr-0044: it declares `changes: [spec-0006-voluntary-dispatch@v3]`)
owner: agent
updated: 2026-07-29
version: 3
---

# spec-0006 — voluntary dispatch

> **AMENDED 2026-07-28 — v1 → v2 (convergence fold: spec-adversary
> `NEEDS-REVISION` + conformance `PASS` with pre-gate defects, one round)**
> **WHAT:** Defined `changed()` and the record-lookup scope; reconciled the
> close/confirm contradiction and gave abort its own operation (`abort-run`);
> made self-disabling and non-empty preconditions mechanical validation;
> specified defect handling (exit `2`, channels, hold semantics) and the hook
> wrapper's exit mapping; added the `missing` subject class with the
> empty-digest sentinel and made `subjects` immutable after open; labeled
> acceptance criteria mechanical vs behavioral; corrected the
> amendment-discipline citation to adr-0044; defined "lands" and bound this
> spec's own spec-0004 pin advance to the landing commit; added the
> dispatcher-charter annotation to clause-8 verification and the mid-run
> subject-growth open question.
> **WHY:** One convergence round returned nine adversary findings plus nits
> and three conformance pre-gate defects plus two additions; all are folded
> in one revision so re-review judges a single target.
> **SCOPE:** Behavioral version `v2`; the entry verbs, cursor home, rule
> shape, guard modes, floor extract, pointer block, and host scope all stand
> — this fold sharpens semantics and closes contradictions without changing
> the decision's realized architecture.
> **POINTER:** Current requirements live in §Transition rules (predicate
> semantics), §The confirm-gate extension, §The guard (defect handling,
> wrapper mapping), §Run cursor contract, §Verdict-record contract, and
> §Propagation and landing pairing.
> **VALUE:** An implementer can build the guard and run operations without
> inventing semantics at the ambiguity points a hostile review found first.
> **CONFIDENCE:** `verified` — every folded item traces to a named finding
> from the retained convergence verdicts; the v2 re-review is downstream and
> not claimed here.

> **AMENDMENT 2026-07-28, RATIFIED 2026-07-29 — folded into `v3` (see the
> `v2 → v3` note below).**
> **WHAT:** Two clauses, both marked in place: a new §Subject binding by entry
> kind (symbolic link, directory, fifo/socket/device, and the hard-link case),
> and INV20's scope clause reconciled with `unclaimed`; INV11 gains a pointer
> to the first.
> **WHY:** The implementation binds a symlink subject to its own link target
> and classifies every non-regular entry fail-closed `unclaimed` (the
> alternative — dereferencing — let a retarget between identical-content files
> keep a stale verdict alive, and a dangling link read as `absent`). This spec
> contains no occurrence of "symlink" or "symbolic", so conformance review
> ruled the behavior a **widening that needs an amendment** rather than a
> reading of existing text. Two facts cut in opposite directions and both are
> recorded: §Verdict-record contract's "`present` iff the path exists"
> textually licenses the presence half (a dangling link's path *does* exist),
> while the class table's `unclaimed` requires frontmatter to be present — and
> a symlink has no frontmatter read at all, so the code's `unclaimed` was not
> the table's. Measured against `92f68e0`, a symlink subject went from owing 2
> records to owing 4 in supervisor mode: a close-blocking change, which is why
> it is stated rather than absorbed.
> **STATUS — resolved.** When drafted, these clauses carried no `version:`
> bump and no `changes:` pairing, because `adr-0044` makes a behavioral
> version bump depend on an approved amendment decision declaring
> `changes: [spec-0006-...@vN]` and no such decision existed; three options
> were left standing for the maintainer. **The maintainer took the second on
> 2026-07-29: shape the paired amendment decision and bump to `v3`** ("V3
> yes, repin dependants and conformance review"). The paired decision is
> `adr-0048-parsers-are-dependencies` (`status: approved`,
> `changes: [spec-0006-voluntary-dispatch@v3]`), which carries **both**
> queued amendments in one version and one intent act; the `@v2` pins in the
> test-dependency ledgers advance to `@v3` in this same change. The clauses
> below are no longer a draft — they are `v3` requirements, and the in-place
> *(v3 amendment)* markers are locators for delta-scoped review (`adr-0044`),
> not disclaimers.
> **SCOPE:** No entry verb, cursor field, rule shape, guard mode, exit code,
> or host behavior changes. Nothing outside the three marked clauses is
> touched.

> **AMENDED 2026-07-29 — v2 → v3 (paired amendment decision:
> `adr-0048-parsers-are-dependencies`, `status: approved`, declaring
> `changes: [spec-0006-voluntary-dispatch@v3]`)**
> **WHAT:** Two amendments, folded in one version. **(1)** The entry-kind
> amendment drafted 2026-07-28 and ratified with this bump — §Subject binding
> by entry kind, INV20's scope clause, INV11's pointer — is now operative
> text (see its own note above). **(2)** A new §Frontmatter reading fixes how
> the class table's `type` is obtained: grove's `---` delimiter convention
> stays grove's own and hand-written, the document between the delimiters is
> read as **YAML 1.2, core schema**, a parse failure classifies `unclaimed`
> and never `code`, and a post-parse schema clause (mapping; `type` a string;
> `implements` a string or a sequence of strings; no coercion) sends anything
> else to `unclaimed`. INV16 gains the YAML-version clause; INV28, S17 and
> AC14 are new. **(3)** INV8 is clarified in place: it constrains which
> **fields** change, not which bytes, and a conforming close or abort may
> re-serialize the whole document.
> **WHY:** `adr-0048` replaces grove's hand-rolled frontmatter reader with a
> conforming parser, and two things in this spec had to move for that. First,
> **the class table and the implementation currently disagree**: the
> hand-rolled reader classifies legal-but-exotic YAML — quoted scalars, block
> scalars, nested maps, anchors, flow collections — as `unclaimed` *regardless
> of its `type`* (`guard-core.mjs`, "THE COST, accepted deliberately"), which
> is a divergence from the table rather than a reading of it. Ending it moves
> at least 19 measured inputs from four owed records to zero and takes at
> least 15 out of observer scope (`adr-0048` D7, which accepts the reduction
> and records it as a lower bound). This spec's own precedent — a subject
> going from **2 owed to 4** was ruled "a widening that needs an amendment
> rather than a reading of existing text" — makes the opposite and larger
> move amendment-shaped by the same standard. Second, **INV16 was not
> satisfiable as written**: it requires classification "deterministic per the
> tables in this spec", yet four measured inputs classify differently under
> YAML 1.1 than 1.2, so the class was fixed by a build flag no spec text
> mentioned. `adr-0048` D6 chose 1.2 core schema; naming it here is what
> closes INV16.
> **SCOPE:** Behavioral version `v3`. No entry verb, cursor field or schema,
> rule shape, predicate form, guard mode, exit code, hook channel, host
> behavior, or record contract changes. The subject-class *table* is
> unchanged — what changes is that a conforming reader now delivers the
> `type` the table has always keyed on, and the fail-closed direction is
> stated rather than left to the reader. `adr-0048` attributes the **whole**
> `v3` delta — both folded amendments — to itself, so every behavior-changing
> clause in this version has a named amendment contract (`adr-0044`).
> **POINTER:** The `v3` requirements live in §Transition rules
> (**Frontmatter reading**, and **Subject binding by entry kind**), INV8,
> INV11, INV16, INV20, INV28, S17 and AC14. Everything else is `v2` text
> unchanged.
> **VALUE:** An implementer can replace the reader without deciding, on its
> own authority, which YAML grove implements or which way an unparseable
> artifact falls — the two questions eight rounds of review kept re-opening.
> **CONFIDENCE:** `verified` for provenance, with one inference named rather
> than buried. Stated by `adr-0048`: the delimiter boundary and its measured
> eight-input basis (D1, D3), YAML 1.2 core schema and the schema clause with
> its `unclaimed` fail-closed routing (D6), the accepted coverage reduction
> (D7), and the whole entry-kind amendment above. **Inferred:** "a parse
> failure classifies `unclaimed`, never `code`" is not a verbatim clause of
> `adr-0048` — it applies D3's own stated ground (a frontmatter-bearing file
> falling to `code` under-owes and is observer-invisible, which is *why* the
> delimiter stays grove's) to the parse step, in the same direction D6's
> schema clause takes. Flagged so delta-scoped review judges the inference
> rather than inheriting it. The conformance review of `v3` is downstream and
> is **not** claimed here; neither is any measurement of the replacement,
> which is execution.

This contract realizes approved `adr-0046-how-dispatch-rules-reach-a-session`:
voluntary session entry through two verbs, a committed per-run cursor,
transition rules shipped as data, a deterministic zero-model guard with a
Claude Stop-hook backstop, a generated dispatcher floor extract, and a managed
block reduced to a non-load-bearing pointer. It also resolves the decision's
Open 9 (the cursor lifecycle), which the decision delegates here.

It does not authorize a Petri-net engine, an FSA library, or a marking object
in code; a routing itinerary in any form; parallel dispatch or activation of
the reserved claims field; a Codex guard ahead of the hook-vocabulary
measurement; or any advance on the decision's Open 7 (the fully cold
dispatcher).

## Terms

| Term | Meaning |
|---|---|
| **entry skills** | The generated `enter` and `start` skills, shipped per host under `plugins/grove/adapters/<host>/skills/`. |
| **entry behavior contract** | The authored verb-shared body text both entry skills carry, stating the session's entry duties — the ask boundary, the per-handover guard duty, stale-cursor disclosure, and (Codex) the guard-absence disclosure. One declared source, projected per §Floor extract and skill generation; distinct from the floor extract. |
| **run** | One governed unit of work opened by `start` and bounded by its cursor. |
| **cursor** | The committed per-run TOML file at `.grove/runs/<run-id>/cursor.toml`. |
| **open cursor** | A cursor whose `status` is `open`. |
| **stale cursor** | An open cursor encountered by a session that did not open it. With parallel dispatch unauthorized, foreign implies stale. |
| **verdict record** | A guard-observable TOML file under `.grove/runs/<run-id>/records/` carrying one reported review verdict for one subject. It supplements, never replaces, the verdict reported on the change request (adr-0027 D2). |
| **transition rule** | One `precondition-set → fire → postconditions` entry in the shipped rules data. |
| **enabled-and-unfired** | A (transition, subject) binding whose preconditions all hold. Owed work is exactly this set, computed by the guard and stored nowhere. |
| **governed artifact** | A repository file whose YAML frontmatter carries the shared artifact contract (`id`/`type`/`status`/...). |
| **subject class** | The deterministic classification of a subject path (table in §Transition rules). |
| **supervisor mode** | Guard behavior when an open cursor exists. |
| **observer mode** | Guard behavior when no open cursor exists. |
| **floor extract** | The generated projection of the marked dispatcher-floor span of `charters/dispatcher.md`. |
| **pointer block** | The revised managed instruction block: markers, one entry-pointer line, one stamp line. |

## Entry contract — two verbs, the ask as the boundary

Two entry skills ship on both hosts, generated by the existing projection
machinery and checked by the same `check` mode:

| Skill | Raw id | User intention | Writes |
|---|---|---|---|
| `enter` | `grove:enter` | "Be available to govern." | **Nothing, ever.** |
| `start` | `grove:start` | "Govern this from the get-go." | Opens a run: creates the cursor through the confirm gate. |

- Both skills are **model-invocable and user-invocable** (default skill
  frontmatter; neither sets `disable-model-invocation`). The invocation
  policy lives in the ask plus the confirm gate, not in frontmatter
  (adr-0046 clause 2, ratified draft choice).
- **`enter`** loads the floor extract and the entry behavior contract and
  performs no repository mutation of any kind. After entry the model may use
  grove's agents or not. When it detects conditions where swarm governance
  could apply, it **asks the user** — it never opens a run on its own
  inference. A yes **is** a start: the affirmative in-session answer is the
  human intent act (the D5-compliant channel), and the flow continues as
  `start`, confirm gate included. A no leaves the session ungoverned and
  writes nothing.
- **`start`** implicitly enters (its body carries the same floor extract and
  behavior contract — no prior `enter` is ever required), then opens a run:
  it discloses any existing open cursors, plans the cursor-create write,
  obtains confirmation, applies, re-resolves the gate profile, and performs
  the run-start floor check (D2) per the dispatcher charter.
- Skill descriptions state their verb's user intention; `start`'s
  description states that it opens a committed run. Exact wording is declared
  once in the build configuration (generation determinism pins the bytes).

### The confirm-gate extension

Cursor creation goes through the `confirm-exact-action-ids` gate — an
**extension of grove's existing lifecycle gate to a new write** (today it
guards setup/refresh/set-profile/remove). The extension contract:

1. The runtime gains three run operations — `open-run`, `close-run`, and
   `abort-run` — each following the identical
   `plan → disclose → confirm-exact-action-ids → apply` flow. Their
   module location is an implementation choice, but **apply shall go through
   the same shared `applyPlan` enforcement** the lifecycle core uses, so the
   unconfirmed-action rejection (`applyPlan` throws on any unconfirmed action
   id) and the post-plan drift preflight hold identically for all three —
   never a parallel re-implementation of the gate. Which actions require
   user confirmation is stated per operation in point 4.
2. `open-run`'s plan enumerates the cursor-create action with
   `confirmationRequired`; the entry skills route every cursor write through
   the run operations and never write a cursor directly.
3. `open-run` requires an existing `.grove/` consumer floor and fails
   pre-write otherwise, naming the host's setup command. No run operation
   takes a **surface invocation record**: the cursor is host-neutral run
   state inside the consumer-run-owned `.grove/runs/`, not a host-adapter
   surface. (The surface-classification machinery guards host-adapter
   writes; extending it here would add ceremony to a write the confirm gate
   already covers.)
4. Confirmation per operation: `open-run`'s cursor-create action and
   `abort-run`'s status-write action carry `confirmationRequired` — only the
   user's confirm act through the gate confirms them. `close-run`'s single
   ordinary-close action does **not**: its plan marks the action
   pre-confirmed, and the sole confirmation authority is the guard's
   exit-`0` verdict (§The guard), which `close-run` obtains immediately
   before apply — the run it records was sanctioned at open, and gating the
   completion record would deter the record. `applyPlan`'s
   throw-on-unconfirmed rule therefore holds identically across all three
   operations with no bypass; the operations differ only in **who may
   confirm**.
5. These operations are runtime operations invoked by the entry skills
   (`abort-run` also by stale-cursor resolution at any moment); they are
   **not** lifecycle skills and add no row to the lifecycle inventory.

## Run cursor contract

**Home: `.grove/runs/<run-id>/cursor.toml`.** Justification: `.grove/` is the
consumer-owned class adr-0035 already defines (adr-0046 clause 4 orders the
exact path resolved here); a directory per run gives verdict records a
run-scoped home — which is what makes the join's "both" well-defined — and
keeps sequential runs collision-free; TOML matches the floor's existing dial
files. adr-0035's declared tree gains the scoped note when this spec lands
(§Propagation).

Run id grammar: `^[0-9]{8}-[0-9]{6}-[a-z0-9][a-z0-9-]*$` (UTC
`YYYYMMDD-HHMMSS` open moment plus a slug); the directory name equals the run
id. Cursor schema (`schema = 1`, minimal per the ratified draft choice —
extended only on demonstrated need):

```toml
schema = 1
run = "20260728-140322-voluntary-dispatch"   # equals the directory name
opened = "2026-07-28T14:03:22Z"   # deliberate duplicate of the run-id instant: the RFC 3339 twin of `closed`, so both run bounds parse alike without run-id grammar knowledge
intent = "one line: what this run exists to land"
subjects = ["specs/0006-voluntary-dispatch.md"]  # repo-relative file paths
status = "open"                               # open | closed | aborted
# closed = "..."   RFC 3339 UTC; present only when status != open
# reason = "..."   one line; present only when status = aborted
# claims — RESERVED top-level key; written by no current path
#
# Required fields: `schema`, `run`, and `status` always; `opened`, `intent`,
# `subjects` required when status = "open". The minimal aborted replacement
# (§Defect handling) — schema/run/status/closed/reason — is therefore
# schema-valid, never a standing defect.
```

- `subjects` lists the run's governed subject **files**; it defines run scope
  and the domain the supervisor-mode guard quantifies over. Listing a subject
  does not by itself owe reviews — see `changed()` in §Transition rules.
- `subjects` is **immutable after open** (v1 minimalism): close and abort
  write only `status`, `closed`, and `reason`. A run that outgrows its list
  closes or aborts and reopens with the fuller list; the uncovered-change
  gap this leaves is recorded as Open question 5, decided nowhere here.
- **`claims` is schema-reserved and written by no current path.** A
  conforming writer never emits it; the guard reports any cursor carrying it
  as a schema defect. It activates only with a future decision on parallel
  dispatch (grove#101/#102 lineage). Until then the
  writes-only-at-open-and-close property holds without exception.

### Lifecycle (resolves adr-0046 Open 9)

| Event | Actor and mechanism | Cursor write |
|---|---|---|
| **Create** | `start` (or an accepted `enter` ask) via confirm-gated `open-run`. Refused while any open cursor exists (see stale handling). | File created, `status = "open"`. |
| **Close** | `close-run` at run completion, permitted only when the guard exits `0` — **no enabled-and-unfired transition and no defect**. That verdict pre-confirms the status-write action (§The confirm-gate extension, point 4). | `status = "closed"`, `closed` timestamp. Never deleted. |
| **Abort** | A user decision via confirm-gated `abort-run`. | `status = "aborted"`, `closed` timestamp, one-line `reason`. Never deleted. |
| **Commit** | The cursor enters git only through the normal commit flow — a human landing act. Grove performs no git action. | — |

**Staleness.** A stale cursor is an open cursor in a session that did not
open it — a dead run's leaving. What is deterministic is the **listing**,
not the diagnosis: the guard and the `start` plan list every open cursor at
every guard moment and both entry verbs, and `start` refuses to create a
second one; whether a listed open cursor is genuinely dead is the human's
call — the schema records no session identity. Resolution is a human choice,
never silent: **adopt** (this session resumes the run — the cursor is the
resumption mechanism; no write; the run's records ride along) or **abort**
(confirm-gated `abort-run`). A stale cursor is never deleted; closed and
aborted cursors are the run's committed audit trail. **At most one open
cursor** is the v1 invariant; the guard reports more than one as a defect in
both modes (§Defect handling). Two sessions racing `start` can each pass the
open-cursor preflight before either cursor exists; that race's outcome — two
open cursors — resolves through the same defect path, never silently.

Exactly two moments write the cursor — open and close/abort. Verdict records
are separate files and are not cursor writes; nothing else mutates the file.

## Verdict-record contract

Tokens are completions: a record that exists. For the guard to be zero-model,
records must be file-observable, so each reported verdict lands as one file:

`.grove/runs/<run-id>/records/<file>.toml` — filename matches
`^[a-z0-9][a-z0-9.-]*\.toml$`, unique within the run; filenames carry no
semantics.

```toml
schema = 1
record_type = "conformance"   # conformance | decision-adversary | spec-adversary | code-review
subject = "specs/0006-voluntary-dispatch.md"
subject_state = "present"     # present | absent — what the reviewer reviewed: the file's bytes, or its absence
subject_sha256 = "<hex digest of the subject bytes reviewed>"
verdict = "PASS"              # the reviewer's own grammar, verbatim
by = "conformance-reviewer"
date = "2026-07-28T15:10:00Z"
```

- The record is written when the verdict is reported, carrying the reviewer's
  verdict verbatim. It rides the same branch as the change, so it is visible
  on the change request the human at merge reads — it **supplements** the
  adr-0027 D2 change-request report, which remains required.
- **A record counts for a subject only while all three bind**: the record's
  `subject` names the subject's repo-relative path, its `subject_state`
  matches the subject's current state (`present` iff the path exists), and —
  for `present` — its `subject_sha256` matches the subject's current bytes.
  A subject edited after its review sheds the record deterministically, so
  the owed-review transition re-enables — review is a per-push gate, not a
  one-time entry gate. (The path + state + digest triple is this spec's
  concretization of "a record exists *for a changed subject*.")
- **Absence is a declared state, not a digest convention.** An absence review
  writes `subject_state = "absent"` with the empty-input SHA-256 sentinel
  (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) as its
  `subject_sha256`, and counts only while the path stays absent — the state
  match, not the digest, is what expires it. The sentinel equals a zero-byte
  file's digest **by construction of SHA-256, and that coincidence now decides
  nothing**: a zero-byte file landing at the path flips the subject's state to
  `present`, the absence record's `subject_state` no longer matches, and
  review is re-owed. The re-owed review of a present empty file writes
  `subject_state = "present"` with the same digest, and the two records are
  distinct by state — neither ever satisfies the other's condition, no run
  becomes unclosable, and the fail-open both prior drafts circled cannot be
  built from either reading.
- The guard reads records; it grades nothing. A `FAIL` record is a completion
  — the review ran; routing the failure is the dispatcher's judgment, and the
  record is loud on the change request.
- `human-approval` is a **reserved** record type, written by no current path
  (grove#74 owns the human-approval-record mechanism; see Open questions).
  Until a decision activates it, it — like any `record_type` outside the
  four enumerated types — is reported as a schema defect (§Defect handling)
  and satisfies no precondition.

## Transition rules as data

**Location: `plugins/grove/reference/dispatch/transitions.toml`** — an
authored, host-neutral static package file (added to the package allowlist),
following the `reference/gates/` precedent for fixed package data. Both hosts
read the same file. The dispatcher charter remains authoritative for the
rules' meaning; this file is their evaluable encoding.

Schema (`schema = 1`): a list of `[[transition]]` tables with **exactly** the
keys `id`, `fire`, `preconditions`, `postconditions`. Validation rejects any
other key — no *key* exists for naming a successor transition, a next step,
a phase, or an ordering; what the two free-text values may *say* is AC8's
behavioral half. `fire` names one action (it may name a role);
it never names a sequence. Every transition's postconditions name at least
one record whose absence is entailed by its preconditions, so a fired
transition disables itself — token-as-completion, structurally. Validation
enforces this mechanically, never trusts it, with two further checks:
`preconditions` shall be **non-empty** (a bare `event → agent` pair is
exactly the itinerary shape S15 rejects), and every transition whose
postconditions name `record(r, $s)` shall carry `no-record(r, $s)` among its
preconditions — the self-disabling check, and the `postconditions` key's
first mechanical consumer.

**Predicate grammar (closed):**

```
predicate  := changed(<class>, $s) | record(<rtype>, $s) | no-record(<rtype>, $s)
<class>    := one row of the subject-class table below
<rtype>    := conformance | decision-adversary | spec-adversary | code-review
```

`$s` binds over the cursor's `subjects` list (supervisor mode) or the derived
change set (observer mode, report-only). A transition instance is enabled
when all its preconditions hold under one binding.

**Predicate semantics (one definition, both modes):**

- **Derived change set** — uncommitted changes plus commits not on the
  merge-base with the default branch, resolved as `origin/HEAD` when set and
  the local `main` otherwise; if neither resolves, the guard exits `1`
  (internal error) rather than guessing. Both modes use this one derivation.
- **`changed(class, $s)`** — `$s` classifies into `class` per the table
  below **and** `$s` is in the derived change set. Listing a subject in the
  cursor therefore does **not** by itself owe reviews: an untouched subject
  enables no transition and never blocks close — the cursor names what the
  guard watches; the change set establishes the fact of change.
- **`record(rtype, $s)`** — a schema-valid record with
  `record_type = rtype`, **`subject` equal to `$s`'s repo-relative path**,
  **`subject_state` matching `$s`'s current state** (`present` iff the path
  exists), and — for `present` — a `subject_sha256` matching `$s`'s current
  bytes, exists under **any** run's records directory
  (`.grove/runs/*/records/`). The subject binding is
  load-bearing, not bookkeeping: without it, the absence sentinel gives every
  `missing` subject the same digest, and one reviewed deletion would satisfy
  the predicate for **every** deletion of that review type in every future
  run — a silent fail-open in exactly the class this spec exists to prevent. The per-run directory is a **write-home**
  (writers write into the open run's), never a read-boundary: the token
  means "these exact bytes — or this declared absence — carry this
  verdict", so a still-current record
  from a prior run — closed or aborted included — satisfies the predicate
  in supervisor mode and silences the observer, and aborting then
  restarting a run over unchanged bytes re-owes nothing. Freshness is the
  path + state + digest triple defined in §Verdict-record contract; this
  bullet and INV11 restate it and must move with it.
- **`no-record(rtype, $s)`** — no record satisfies `record(rtype, $s)`; an
  absent record and a stale record — by digest mismatch or by
  `subject_state` mismatch — both leave it true.
- A record whose `record_type` is outside the four rule-consumable types
  satisfies no predicate and is reported as a defect (§Verdict-record
  contract, §Defect handling).

**Subject classes** (deterministic, frontmatter-derived):

| Class | Determination |
|---|---|
| `missing` | path absent from the working tree (a deletion, or a rename's old half) — checked before every byte-derived row; fail-closed like `unclaimed`, owes the full set (the intended class of an absent file is unknowable from bytes) |
| `decision` | frontmatter `type: adr` |
| `spec` | frontmatter `type: spec` |
| `charter` | frontmatter `type: charter` |
| `reviewless` | frontmatter `type` ∈ {`research`, `feedback`} — owes nothing |
| `unclaimed` | artifact frontmatter present but `type` absent or outside the known enum — fail-closed, owes the full set |
| `code` | no artifact frontmatter (code and tests collapse: their owed sets are identical) |
| `implements-bearing` | any artifact whose frontmatter carries a non-empty `implements` (overlays the classes above) |

**Frontmatter reading** *(v3 amendment — `adr-0048` D1/D3/D6/D7; see the head
notes)*. The table above keys on exactly one frontmatter field, `type`, and the
`implements-bearing` overlay on one more. **How that document is obtained is
fixed here**, because INV16 requires classification to be deterministic *per
these tables* — and a hand-rolled reader made the class depend on the reader
instead:

- **The delimiter is grove's; the document is YAML.** Whether a file bears
  artifact frontmatter is decided by grove's own `---` block convention, which
  **stays hand-written**. This is a boundary, not an exception: the block
  convention is a format grove defines, and only the document *between* the
  delimiters is a format it borrows. Only that inner document is handed to the
  parser. (Measured basis for the boundary: handing the delimiter to the parser
  too regressed eight inputs into `code` — `adr-0048` D3.)
- **The inner document is read as YAML 1.2, core schema** (`adr-0048` D6).
  Naming the version is what makes INV16 satisfiable: four measured inputs
  classify differently under 1.1 than under 1.2, so without this clause the
  class of a subject is fixed by a build flag no spec text states.
- **Failure is fail-closed to `unclaimed`, never to `code`.** A file that bears
  frontmatter whose inner document does not parse classifies `unclaimed`.
  `code` is the class of a file with **no** frontmatter; it owes two records and
  sits outside observer scope, so reaching it by parse failure would under-owe
  review in exactly the class fail-closed typing exists to protect.
- **Schema, checked after the parse and never coerced.** The parsed document
  shall be a **mapping**; `type`, when present, shall be a **string**;
  `implements`, when present, shall be a **string or a sequence of strings**.
  Anything else — **including a successful parse to a non-mapping** — is
  schema-invalid and classifies `unclaimed`. No value is coerced to a string,
  and no non-string is read as a `type`.
- **Under those clauses the class table means what it says.** A schema-valid
  document classifies by its `type` **string**, whatever legal YAML spelling
  produced it: quoted scalars, block scalars, nested maps, anchors and flow
  collections are ordinary YAML and classify by `type` like any other document.
  The hand-rolled reader classified that whole family `unclaimed` *regardless of
  `type`* — a divergence from this table, not a reading of it — and this
  amendment ends it. The measured consequence is a **coverage reduction the
  decision accepts** (`adr-0048` D7): at least 19 inputs fall from four owed
  records to zero and at least 15 leave observer scope, recorded there as a
  lower bound rather than a bound.
- This amendment does **not** change the `implements-bearing` row. Its
  non-empty test stands as written, applied now only to the values the schema
  clause admits.

**Subject binding by entry kind** *(v3 amendment — ratified 2026-07-29; see the
head notes)*. The subject-class table reads a subject's **bytes**, and every
row of it assumes the path names a regular file. A subject path can name an
entry that has no readable bytes, and
presence is established **without dereferencing** (`lstat`, never `stat`), so
the entry's kind — never its target's — decides:

| Entry at the subject path | `subject_state` | The digest binds | Class |
|---|---|---|---|
| regular file (a **hard link** is one: link count is not consulted) | `present` | the file's raw bytes | the byte-derived row of the table above |
| symbolic link, target present, absent, or a directory | `present` — the link itself exists, whatever it points at | the link's own target **bytes**, domain-tagged | `unclaimed` |
| directory | `absent` | the absence sentinel | `missing` — the FILE subject is not there |
| fifo, socket, block or character device | `present` | a domain-tagged constant naming the exact kind | `unclaimed` |

Three consequences, stated rather than left to the implementation:

- The non-regular rows classify `unclaimed` **fail-closed**: no frontmatter
  can be read at all, so the class table's `unclaimed` ("frontmatter present
  but `type` absent or outside the enum") is widened by exactly this row set
  — a subject whose bytes cannot be read owes the full set, and `code` by
  accident would owe less.
- The digests are **domain-tagged per kind** so a subject that changes kind
  sheds its records: an untagged symlink digest equalled the digest of a
  regular file whose bytes were exactly the target path, which let a verdict
  on the file survive its replacement by a link. Separation is by digest only
  — a record carries no entry kind — so it is a strong convention, not a
  proof.
- A dangling symlink is `present`, never `absent`: `present` iff the **path**
  exists is unchanged, and an absence record (which requires the empty-input
  sentinel) can never satisfy it.

**Initial rule set** (encodes the dispatcher charter's owed-rules; the
charter wins on any divergence):

| id | preconditions | fire | postconditions |
|---|---|---|---|
| `t-conformance` | `changed(implements-bearing ∪ code ∪ unclaimed ∪ missing, $s)` ∧ `no-record(conformance, $s)` | dispatch `conformance-reviewer` on `$s` | `record(conformance, $s)` |
| `t-decision-quality` | `changed(decision ∪ unclaimed ∪ missing, $s)` ∧ `no-record(decision-adversary, $s)` | dispatch `decision-adversary` on `$s` | `record(decision-adversary, $s)` |
| `t-spec-quality` | `changed(spec ∪ unclaimed ∪ missing, $s)` ∧ `no-record(spec-adversary, $s)` | dispatch `spec-adversary` on `$s` | `record(spec-adversary, $s)` |
| `t-code-quality` | `changed(code ∪ unclaimed ∪ missing, $s)` ∧ `no-record(code-review, $s)` | dispatch `code-reviewer` on `$s` | `record(code-review, $s)` |

There is no close/merge transition: run close is licensed by the guard's
clean verdict (exit `0`: no enabled-and-unfired instance and no defect),
which **is** the
`conformance ∥ code-review → merge` join at two resolutions — nobody writes
the join; it is a derived fact. Human ratification acts stay institutional
(the D5 channel and the forge), outside the rule data in v1. Classes with no
charter-named layer gate (e.g. `charter`) owe only what the charter names;
fail-closed applies to `unclaimed` and `missing` only.

## The guard

**Home: `plugins/grove/runtime/dispatch/bin/guard.mjs`** (package runtime,
beside `runtime/gates/`). Deterministic and zero-model: Node, filesystem and
git only — no model call, no network, and **no writes** (the guard reports
and holds; it never mutates a cursor, record, or any other file — which also
makes "no dedup state" structural). Profile-floor validation remains
`resolve-profile`'s (adr-0020 D1: the floor logic lives once); the guard
evaluates transitions, cursors, and records.

**Moments:** run start (invoked by `start` after cursor creation), **every
handover** (a duty the entry-skill bodies and the dispatcher charter place on
the driving session), and **Stop** (the deterministic backstop, via hook —
the one moment not dependent on the model choosing to run the check).

Direct CLI exit codes: `0` no enabled-and-unfired instance and no defect
(close permitted); `3` owed work exists (report on stdout: one line per
enabled instance, naming transition id, subject, and missing record type);
`2` defect (§Defect handling: one line per defect on stderr; close denied);
`1` internal error. When owed work and defects coexist, both reports are
emitted and the exit code is `2`.

### Supervisor mode (an open cursor exists)

- May hold **stop only** — the one controllable event its mechanism can hold.
  Merge stays institutionally gated; the guard never holds or attempts a
  forge action.
- Every hold names the **exact transition id, subject, and missing record
  type**, plus the legal resolutions: produce the record, or (if this run is
  dead) adopt/abort the cursor. Loud, specific, never silent.
- **Single-hold bound:** when the Stop-hook input carries
  `stop_hook_active: true` (the host's continuation flag), the guard reports
  but does not hold again — no infinite hold loop, and a dead run's cursor
  costs at most one held stop before its stale-resolution paths are on
  screen. The non-hold report rides the observer channel: one line on
  stderr, wrapper exit `1` (§Claude Stop-hook mechanics).

### Observer mode (no open cursor)

- When the derived change set touches governed artifacts (excluding
  `reviewless`) with no current verdict records, the guard reports **one
  line per stop event** and **never holds**. The line names the guard and
  mode (`grove-guard (observer):`) and **every affected subject with its
  missing record types**. No deduplication exists or is wanted: `enter`
  writes nothing, so there is no state home for "already warned", and
  repetition at each stop is the correct loudness for a standing condition.
- The derived change set and record lookup are the shared definitions of
  §Transition rules — a still-current record from any run, a closed one
  included, silences the observer for its subject. Observer scope is
  frontmatter-governed artifacts only — deterministic classification beats
  coverage outside a run; code subjects, and absent (`missing`) paths whose
  bytes cannot be classified, are covered in supervisor mode by the subject
  list.

### Defect handling

The guard reports these as **defects** — direct-CLI exit `2`, one stderr
line per defect naming the file and the failure. Exit `2` always denies
close: `close-run` requires exit `0`.

| Defect | Does supervisor evaluation continue? |
|---|---|
| a cursor carrying the reserved `claims` key | Yes — over that cursor's `subjects`; the run's owed work still holds and the defect line rides beside it. |
| more than one open cursor | Yes — over the **union** of the open cursors' subjects; the report names every open cursor; resolution is adopt/abort down to one. |
| an unparseable or schema-invalid cursor | Not over that cursor — its `subjects` are unreadable; the report names the file and the parse/validation failure. Any other parseable open cursor is still evaluated. A cursor whose `status` cannot be read is treated as open for mode selection (fail closed). Its only exit is a confirmed `abort-run`, which **replaces the file whole** with a minimal well-formed aborted cursor (`schema = 1`, `run` from the directory name, `status = "aborted"`, `closed` timestamp, `reason`). This is INV8's one named exception, and its category is exactly this row's: **unparseable or schema-invalid, including status-unreadable** — "well-formed" throughout this spec means parseable AND schema-valid. |
| a record with a `record_type` outside the enumerated types, or otherwise unparseable | Yes — the record satisfies no predicate; the defect line names it. |

Through the hook, defects use the same channels as owed work: in supervisor
context (any open — or unreadably-statused — cursor exists) the guard
**holds once**, carrying the defect and its resolutions in the block reason,
bounded by the same `stop_hook_active` rule; under `stop_hook_active`, and
in observer context, defect lines ride the non-blocking stderr channel
(wrapper exit `1`).

### Claude Stop-hook mechanics

- The Claude plugin ships a hook registration for the **`Stop` event** (the
  trellis `plugins/trellis/hooks/hooks.json` shape is the precedent):

  ```json
  { "hooks": { "Stop": [ { "hooks": [
      { "type": "command", "command": "\"$CLAUDE_PLUGIN_ROOT\"/hooks/stop-guard.sh" }
  ] } ] } }
  ```

  The wrapper invokes the guard with the project root and passes the hook's
  stdin JSON through (the guard consumes `stop_hook_active`).
- **Hold channel:** single-line JSON on stdout using the documented Stop
  blocking form — `{"decision": "block", "reason": "<the named transition,
  subject, missing record, and resolutions>"}` — exit 0.
- **Observer channel:** one line on stderr with wrapper exit `1` — a
  documented non-blocking, non-`2` exit code — so the line surfaces without
  holding.
- **Wrapper exit mapping** (one mapping, so an observer warning and an
  internal guard error are mechanically distinguishable):

  | Guard result | Wrapper output | Wrapper exit |
  |---|---|---|
  | `0` clean | none | `0` |
  | `3` owed or `2` defect — supervisor context, continuation flag absent | block-decision JSON on stdout | `0` |
  | `3` owed or `2` defect — otherwise (observer, or `stop_hook_active: true`) | one line on stderr | `1` |
  | `1` internal error, or the wrapper itself fails | one line on stderr prefixed `grove-guard error:` | `4` |

  The wrapper shall never exit `2` — the host's blocking-error code — so
  the measured stdout block decision is the only hold channel.
- **Envelope discipline (the measured trellis precedent, 2026-07-27):** a
  flat `additionalContext` envelope was measured silently discarded where the
  nested `hookSpecificOutput` envelope worked — an unverified envelope is a
  guard that never reaches anyone. Therefore: any context-injecting output
  this hook ever emits shall use the nested `hookSpecificOutput` envelope;
  and **both channels above shall be measured on the target host before
  release** (the trellis method: variant forms side by side, alternative
  channels disabled), with the measurement retained as an evidence record
  under `plugins/grove/reference/surfaces/`. A channel that fails measurement
  blocks release of the guard, not of the artifact half.

## Floor extract and skill generation

**Marker convention (source-side, in `charters/dispatcher.md`):** one span
bounded by the exact lines

```
<!-- grove:floors:begin -->
<!-- grove:floors:end -->
```

Inside the span, each floor is one markdown list item ending with its slug in
backticks (the trellis `rules.md` slug convention). The declared slug set —
the dispatcher-only floors, per adr-0046 clause 3 and the canvas's
cold-checkable list:

| Slug | Floor (canonical meaning; the charter span carries the authoritative text) |
|---|---|
| `floor-owed-reviews` | Every changed governed subject owes its verdict records; a review counts only as a posted record, never session memory. |
| `floor-fail-closed-typing` | An unclaimed artifact type owes the full review set. |
| `floor-executor-needs-artifact` | Never dispatch `executor` without a `gated`/`approved` artifact. |
| `floor-approved-flip-human` | `gated → approved` is a human act; an agent never flips it. |
| `floor-recorded-skips` | Every skip is a recorded skip, never silent. |
| `floor-human-intent-locus` | Every run keeps ≥1 human-owned intent-locus gate, checked at run start (D2). |
| `floor-d5-channel` | Human approval counts only as an in-session act or a merge, never a bare tracker comment. |
| `floor-profile-per-handover` | Re-resolve the gate profile at every handover, never cached. |
| `floor-sequences-not-grades` | The dispatcher sequences; it does not grade. |

**Generation contract:**

- Validation fails on: zero or multiple marker pairs; a slug set differing
  from the declared nine (missing, extra, duplicate); a floor item not ending
  in a backticked slug; an extract exceeding **2,500 characters** (measured
  basis: ~1,330 today — growth becomes a deliberate, check-failing act).
- The extract is the span **verbatim**, markers excluded — a deterministic
  selection, never a hand-cut judgment (the #164/#169/#170 drift class, kept
  out one level up).
- **Placement: the floor extract is the first body content of both entry
  skills on both hosts** (immediately after frontmatter and the generated
  header), because truncation keeps the start of the file. Verb-specific
  behavior text follows, then the pointers (full dispatcher projection path,
  `transitions.toml`, the guard CLI, the cursor contract).
- Each assembled entry-skill body shall not exceed **12,000 characters**
  (inside the 5,000-token per-skill cap with margin); the check fails on
  breach.
- The verb-specific body text has exactly one authored source, declared in
  the build configuration, projected byte-deterministically into both hosts'
  skills; generated output is never a source. Editing a generated entry
  skill directly fails check mode, exactly as for existing projections.

## Managed pointer block

`managedBlock()` — the existing emission path — shrinks to exactly four
lines:

```
<begin marker>
Grove is installed. Run <start invocation> to open a governed run, or <enter invocation> to make Grove's dispatch rules available without opening one.
grove plugin@<version>
<end marker>
```

- The `<start/enter invocation>` values come from adapter metadata: Claude
  `/grove:start` and `/grove:enter`; Codex the exact installed skill ids.
- **Removed:** the dispatcher/shaper loader lines and the per-handover
  `runtime_dir` sentence. The block carries no rules; per-handover duties
  live in the floor extract and the charter.
- The pointer line carries **no version**: the stamp line remains the block's
  only version carrier (two carriers is the #169 skew class).
- `inspectBlock` validity (one marker pair, one schema-valid stamp line) is
  unchanged; adr-0026 D4's review seam survives on the stamp.
- **Non-load-bearing by construction:** deleting or mangling the block
  changes nothing but the pointer — entry skills, rules, cursor, and guard
  are all discovered through the plugin, and the system degrades to
  "nothing written".

## Host scope

- The artifact half — entry skills, `transitions.toml`, cursor, records — is
  **host-neutral**: both hosts ship both verbs with the same floor extract
  and read the same rule and cursor files with the same semantics.
- Enforcement is **Claude-first**. Codex gets **no guard wiring** (no hook
  registration, no Stop backstop) until its hook vocabulary is measured.
- **Blocking prerequisite of implementation:** before the implementation of
  this spec may complete its build gate, an evidence record under
  `plugins/grove/reference/surfaces/` shall record whether Codex exposes a
  Stop-equivalent hook event — result either way. A positive result makes
  the asymmetry temporary and the disclosure conditional; activating a Codex
  guard is follow-up work under this spec's amendment path, never silent.
- **Entry-time disclosure:** the Codex projections of both entry skills shall
  direct the session to state, at entry, the exact line:

  > This session runs Grove's dispatch rules without the deterministic stop
  > guard; rule conformance here is prose-enforced only.

  The line is conditional on guard absence, not on the measurement: it stays
  until a Codex guard actually ships.

## Propagation and landing pairing

**"Lands" means the implementation landing** — the change request that
makes this spec operative, not the authoring PR that first commits (or
revises) this draft. That landing change-request carries, **in the same
commit** as the spec's landing:

1. `spec-0004-dual-host-distribution` revised per adr-0046 clause 8:
   §Driving-session loaders replaced by the entry verbs and pointer block,
   with the further clauses this contract touches reconciled in the same
   amendment (the Claude adapter's skill inventory gains `enter`/`start`; the
   exact package tree and allowlist gain `runtime/dispatch/`,
   `reference/dispatch/`, and the hook files; the lifecycle inventory stays
   exactly four), under adr-0044's paired-record amendment discipline (the
   reciprocal `changes: [<spec-id>@vN]` pairing) with its version bump to
   `vN`. This spec's own `depends_on` pin advanced from
   `spec-0004-dual-host-distribution@v7` to `@v8` in that commit. **Discharged:**
   `spec-0004` is at `version: 8` and this spec's frontmatter pins `@v8`.
2. adr-0046's `changes:` entry appended with that exact `@vN` pin — the
   frontmatter pointer-completion the decision itself sanctions. **Discharged:**
   `adr-0046:6` reads `changes: [spec-0004-dual-host-distribution@v8]`.
3. adr-0035's declared `.grove/` tree annotated with the scoped
   `.grove/runs/` note (adr-0046 clause 4: "when the spec lands").
   **Discharged:** the scoped annotation is at `adr-0035:102-108`.

**All three obligations above are discharged in the tree.** They are kept in
place rather than deleted because AC13 binds them to the landing commit and a
reader checking that criterion needs to see what was owed, not only that nothing
is outstanding. An earlier version of this section left item 1 in future tense
after the advance had happened, so a reader landed on `@v7` while the frontmatter
pinned `@v8`; corrected 2026-07-29.

The adr-0003 forward pointer, the adr-0031 scoped `superseded_in_part_by`
pointer, and the dispatcher charter's scoped-narrowing annotation (the
ratified `adr-0046` note inside its evidence-mined rejection list,
distinguishing the declined silent router from the loud-failing Stop guard)
are adr-0046 clause 8's own orders, ratified with that decision; this
spec's landing review verifies all three are present but does not re-order
them. The five `0.1.0` consumers migrate deliberately per adr-0046's
consequences; the refresh wave stays blocked behind grove#169 and is outside
this contract.

## Non-goals

- No net engine, FSA library, or marking object in code (adr-0046 clause 1).
- No itinerary: nothing anywhere names a next step, phase, or successor.
- No parallel dispatch; `claims` stays reserved and unwritten.
- No mechanical hold on merge or any forge action.
- No Codex guard in this version; no conditional-guard activation without
  the measurement evidence.
- No observer-mode deduplication or any guard-writable state.
- No git action by any operation this spec introduces.
- No advance on the cold dispatcher (adr-0046 Open 7) or the offline DES
  analysis (parked).

## Invariants (EARS)

- **INV1** — The build shall generate `enter` and `start` skills for both
  hosts from declared sources, and neither skill's frontmatter shall carry
  `disable-model-invocation`.
- **INV2** — `enter` shall perform no repository mutation: after any `enter`
  invocation the repository tree shall be byte-identical to its pre-entry
  state.
- **INV3** — An entered session shall open a run only on an explicit
  affirmative user answer to an ask; the affirmative shall route through the
  same confirm-gated `open-run` path as `start`, and a negative shall write
  nothing.
- **INV4** — `start` shall not require a prior `enter`; its body shall carry
  the same floor extract and entry behavior contract.
- **INV5** — Every cursor write — create, close, and abort — shall be
  applied only through the shared `applyPlan` path, which shall reject
  apply while any planned action id is unconfirmed and shall preflight all
  file preconditions before the first mutation. Create and abort action ids
  shall be confirmable only through the user-facing confirm gate; the
  ordinary-close action id shall be pre-confirmed at plan time solely by
  the guard's exit-`0` verdict, obtained by `close-run` immediately before
  apply.
- **INV6** — `open-run` shall fail pre-write when `.grove/` is absent or
  when any open cursor exists, and no run operation shall take a surface
  invocation record.
- **INV7** — The cursor shall live at `.grove/runs/<run-id>/cursor.toml`
  with the schema and run-id grammar of §Run cursor contract, and at most
  one open cursor shall exist; the guard shall report a second open cursor
  as a defect in both modes.
- **INV8** — Exactly two moments shall write the cursor: open, and
  close/abort. Close shall set `status = "closed"` only when the guard
  exits `0` (no enabled-and-unfired instance and no defect); abort shall
  set `status = "aborted"` with a one-line reason; neither shall delete the
  file, and both shall write only `status`, `closed`, and `reason` —
  `subjects` and every other field shall be immutable after open. One named
  exception: a confirmed `abort-run` on an **unparseable or schema-invalid**
  cursor (including status-unreadable) replaces the file whole with the
  minimal aborted shape (§Defect handling) — a trustworthy field edit inside
  a file that fails parse or schema is undefined, and the exception is
  reachable only through that defect row, never on a well-formed (parseable
  and schema-valid) cursor.
  *(v3, clarified in place)* **This invariant constrains FIELDS, not bytes.**
  "Write only `status`, `closed`, and `reason`" means the written document
  shall parse to the same value for every other declared key it carried
  before — including a `claims` key already present, which close and abort
  shall preserve rather than drop. It does **not** require the write be a
  textual edit of the pre-image's bytes, and a conforming implementation may
  re-serialize the whole document. AC5 already states the test in field
  terms; this sentence removes the reading that a byte-level diff was
  additionally owed. The clarification is stated because an implementation
  achieved the guarantee by a surgical line edit and its prose described
  *that mechanism* as the invariant — which made a legal cursor spelling the
  edit's regex did not admit (a literal-string `status`) unclosable **and**
  unabortable, since the whole-file exception above is deliberately
  unreachable on a well-formed cursor. Nothing about which fields may change
  is relaxed here.
- **INV9** — No shipped path shall write the `claims` key; the guard shall
  report a cursor carrying it as a schema defect.
- **INV10** — A stale cursor shall be surfaced at both entry verbs and every
  guard moment, resolved only by adopt or confirmed abort, and never
  silently deleted.
- **INV11** — Verdict records shall follow §Verdict-record contract, and a
  record shall count **only for the subject named in its own `subject`
  field**, only while its `subject_state` matches that subject's current
  state, and — for `present` — only while its `subject_sha256` matches the
  subject's current bytes. Record lookup shall span every run's records
  directory in both modes. *(v3)* For a subject whose entry is not a regular
  file, "current bytes" shall be the domain-tagged binding of §Subject binding
  by entry kind, and the entry's kind shall be read without dereferencing.
- **INV12** — The record file shall not substitute for the change-request
  verdict report (adr-0027 D2), which remains owed.
- **INV13** — `transitions.toml` shall ship at
  `plugins/grove/reference/dispatch/transitions.toml`, admit exactly the
  keys `id`/`fire`/`preconditions`/`postconditions` per transition, use only
  the closed predicate grammar, and fail validation on any other key or
  predicate form, on an empty `preconditions` set, on a transition whose
  postconditions name `record(r, $s)` without `no-record(r, $s)` among its
  preconditions, on a transition whose postconditions name no record at
  all (INV14's property, enumerated here so the check rejects rather than
  trusts), on an `id` not matching `^t-[a-z0-9][a-z0-9-]*$`, or on a
  duplicate `id` — INV18 surfaces ids verbatim and assumes they
  discriminate, so uniqueness is load-bearing, while the id's *meaning*
  stays review-caught (AC8's disclaim): a format rule cannot stop English
  riding kebab-case.
- **INV14** — Every transition's postconditions shall name at least one
  record whose absence is entailed by its preconditions — a property
  INV13's validation checks mechanically, never trusts.
- **INV15** — No shipped rule, skill, hook, or block shall name a successor
  transition, next phase, or fixed sequence; `fire` shall name one action
  only.
- **INV16** — The guard shall be zero-model and read-only: no model call, no
  network, no file writes; its subject classification and record matching
  shall be deterministic per the tables in this spec. *(v3)* Frontmatter
  shall be read per §Frontmatter reading — grove's own `---` delimiter
  convention decides whether a file bears frontmatter, and the document
  between the delimiters shall be parsed as **YAML 1.2, core schema**. The
  version is named because without it the class of a subject is not
  determined by these tables at all: four measured inputs classify
  differently under 1.1, so the class would be fixed by a build flag no spec
  text states.
- **INV17** — The guard shall run at run start, at every handover (a duty
  stated in both entry-skill bodies), and at Stop via the registered hook,
  and shall exit `0` only when no enabled-and-unfired instance exists.
- **INV18** — In supervisor mode the guard shall hold stop only, naming the
  exact transition id, subject, missing record type, and resolutions; when
  the hook input carries `stop_hook_active: true` it shall report without
  holding, on the non-blocking stderr channel of §Claude Stop-hook
  mechanics.
- **INV19** — The guard shall never hold, perform, or attempt a merge or any
  forge action.
- **INV20** — In observer mode the guard shall emit exactly one line per
  stop event — naming the guard, the mode, and each affected subject with
  its missing record types — shall never hold, and shall keep no
  deduplication state; its scope shall be frontmatter-governed artifacts
  excluding `reviewless` types, **together with every fail-closed
  `unclaimed` subject** — which includes the non-regular entries of §Subject
  binding by entry kind, whose bytes cannot be read and which therefore carry
  no frontmatter to govern them — over the derived change set defined in
  §Transition rules. *(The `unclaimed` half of that scope clause is the v3
  amendment: `OBSERVER_CLASSES` has always carried `unclaimed`, and the class
  table's `unclaimed` was frontmatter-governed by definition until the
  non-regular rows widened it. `code` and `missing` remain out of observer
  scope; supervisor mode covers them through the cursor's subject list.)*
- **INV21** — The Claude plugin shall register the guard on the `Stop` hook
  event; any hold shall use the documented block decision as single-line
  JSON; any context-injecting output shall use the nested
  `hookSpecificOutput` envelope; the wrapper shall implement the exit
  mapping of §Claude Stop-hook mechanics and shall never exit `2`; and both
  output channels shall be verified by a retained pre-release measurement
  on the target host.
- **INV22** — The floor extract shall be generated solely from the single
  `grove:floors` marker span of `charters/dispatcher.md`; generation shall
  fail on marker-pair or slug-set violations, on an extract over 2,500
  characters, or on an assembled entry-skill body over 12,000 characters.
- **INV23** — The floor extract shall be the first body content of both
  entry skills on both hosts; two generation runs shall produce identical
  bytes; a direct edit to a generated entry skill shall fail check mode.
- **INV24** — The managed block shall consist of exactly the four lines of
  §Managed pointer block, with host-correct invocations from adapter
  metadata, no rules, no loader lines, and the stamp as its only version
  carrier; `inspectBlock` validity semantics shall be unchanged.
- **INV25** — No behavior specified here other than the pointer's visibility
  shall depend on the managed block's presence or content.
- **INV26** — Codex projections shall ship both entry skills and read the
  same rules and cursor files, shall register no guard hook, and shall carry
  the exact entry-time disclosure line of §Host scope; the Codex
  hook-vocabulary evidence record shall exist before the implementation's
  build gate closes.
- **INV27** — The guard shall report the defect classes of §Defect handling
  with direct-CLI exit `2`, shall deny close while any defect stands, shall
  continue supervisor evaluation per that section's table, and shall route
  defect reports through the same hold and non-hold channels as owed work.
- **INV28** *(v3)* — A subject that bears frontmatter shall classify
  `unclaimed`, never `code`, when its inner document fails to parse, when it
  parses to anything other than a mapping, when a present `type` is not a
  string, or when a present `implements` is neither a string nor a sequence
  of strings; no value shall be coerced to reach a class. A schema-valid
  document shall classify by its `type` string per the §Transition rules
  class table, whatever legal YAML spelling produced that string.

## Scenarios (GWT)

### S1 — enter writes nothing
**Given** a consumer repository in any state
**When** `/grove:enter` is invoked and the session completes entry
**Then** a recursive byte comparison of the repository tree before and after
shows zero differences.

### S2 — the ask converts to a start
**Given** an entered, run-less session detects governable conditions
**When** it asks and the user answers yes
**Then** the session proceeds through `open-run`'s plan, disclosure, and
confirmation, and only after every action id is confirmed does the cursor
exist with `status = "open"`.

### S3 — a no stays ungoverned
**Given** the same ask
**When** the user answers no
**Then** no cursor or any other file is created and the session continues
ungoverned.

### S4 — unconfirmed open is rejected
**Given** an `open-run` plan whose cursor-create action id was not confirmed
**When** apply is attempted
**Then** apply throws naming the unconfirmed action id and no file is
written.

### S5 — start refuses a second open cursor
**Given** an open cursor exists in `.grove/runs/`
**When** `start` plans a run
**Then** the plan fails pre-write, lists the open cursor, and offers adopt or
confirmed abort as the only resolutions.

### S6 — close is guard-licensed
**Given** an open run whose changed subject (present in the derived change
set) owes a conformance record
**When** close is attempted, then the record is added with a matching digest
and close is attempted again
**Then** the first attempt is refused with the guard's owed-work report and
the second sets `status = "closed"` with a `closed` timestamp.

### S7 — abort marks, never deletes
**Given** an open run
**When** the user aborts through confirm-gated `abort-run`
**Then** the cursor file remains with `status = "aborted"` and a one-line
reason.

### S8 — supervisor hold names the gap
**Given** an open cursor whose changed subject has no current conformance
record
**When** the session attempts to stop
**Then** the Stop hook holds with a reason naming `t-conformance`, the exact
subject path, the missing record type, and the resolution paths.

### S9 — the hold is bounded
**Given** the same state with the hook input carrying
`stop_hook_active: true`
**When** the session attempts to stop again
**Then** the guard reports the same gap without holding.

### S10 — observer warns once per stop, every stop
**Given** no cursor exists and the change set includes a `spec`-class
artifact with no current verdict records
**When** the session stops twice
**Then** each stop event surfaces exactly one warning line and neither stop
is held.

### S11 — the block is not load-bearing
**Given** a consumer whose managed block is deleted or its markers mangled
**When** `enter`, `start`, and the guard are exercised
**Then** every behavior in this spec functions identically; only the pointer
is missing.

### S12 — floor edits propagate, hand edits fail
**Given** the marked floor span in `charters/dispatcher.md` is edited
**When** generation runs
**Then** both hosts' `enter` and `start` skills change while unrelated
projections stay byte-identical; and a subsequent direct edit to either
generated skill makes check mode fail.

### S13 — budget breach fails generation
**Given** the floor span grows past 2,500 characters, or an assembled entry
skill past 12,000 characters
**When** generation or check runs
**Then** it fails naming the breached budget.

### S14 — Codex entry disclosure
**Given** a Codex session invoking either entry skill
**When** entry completes
**Then** the exact disclosure line of §Host scope has been stated and no
Stop hook is registered.

### S15 — itinerary shapes are rejected
**Given** a `transitions.toml` containing a `next`, `then`, `phase`, or any
undeclared key; a transition with an empty `preconditions` list (a bare
`event → agent` pair); a transition whose postconditions name
`record(r, $s)` without `no-record(r, $s)` among its preconditions; a
transition whose postconditions name no record at all; or a malformed or
duplicate `id`
**When** validation runs
**Then** it rejects the file naming the offending transition.

### S16 — a re-edited subject owes review again
**Given** a subject with a `PASS` conformance record
**When** the subject's bytes change
**Then** the guard reports `t-conformance` enabled for it again, because the
record's `subject_sha256` no longer matches.

### S17 — a conforming parse, fail-closed *(v3)*
**Given** three subjects in the derived change set: one whose frontmatter
spells `type` as the quoted scalar `"research"`, one whose frontmatter block
opens but whose inner document does not parse, and one whose inner document
parses successfully to a sequence rather than a mapping
**When** the guard classifies them
**Then** the first is `reviewless` — its `type` string is `research` however
it was spelled — and the second and third are both `unclaimed`; neither
reaches `code`, and no value was coerced to produce either class.

## Acceptance criteria

Each criterion names the mutation that turns it red, and carries an honesty
label: **[mechanical]** — red is a failing check, test, or validation;
**[behavioral]** — red is observable in session conduct but not
machine-checked (the same honesty split §Host scope already draws for the
Codex prose-enforced half). A parenthetical names any clause that crosses
its criterion's label.

1. **AC1 — guard, supervisor mode and defects** [mechanical] (INV16, INV18,
   INV19, INV27; INV17's run-start and Stop moments; S6, S8, S9): red if
   the hold branch is removed, the hold stops naming
   transition/subject/record, the `stop_hook_active` bound is dropped (S9
   loops), a defect exits `0` or fails to deny close, or the guard gains a
   write or network call. INV17's every-handover moment is [behavioral] — a
   duty the entry-skill bodies place on the driving session; this criterion
   claims no mechanical coverage for it.
2. **AC2 — guard, observer mode** [mechanical] (INV20; S10): red if the
   observer line is suppressed, deduplicated across stop events, made to
   hold, stripped of its subject-and-missing-types content, or extended
   past deterministic frontmatter classification.
3. **AC3 — enter writes nothing** [behavioral; INV1's frontmatter and
   generation clauses mechanical] (INV1–INV4; S1–S3): red if any `enter`
   path acquires a write, if a run opens on model inference without a user
   yes, or if either skill gains `disable-model-invocation`.
4. **AC4 — the confirm-gate extension** [mechanical] (INV5, INV6; S4): red
   if a cursor can be created outside the shared `applyPlan` path, or
   applied with an unconfirmed action id, or without an existing `.grove/`
   floor, or if an ordinary close applies without the guard's exit-`0`
   verdict as its confirmation authority.
5. **AC5 — cursor writes only at open and close** [mechanical;
   stale-resolution loudness behavioral] (INV7–INV10; S5, S7, S16 context):
   red if any third write moment appears, a close lands while owed work or
   a defect exists, a close or abort touches any field beyond
   `status`/`closed`/`reason` (save INV8's sole named exception — the
   whole-file replacement of an *unparseable or schema-invalid* cursor,
   itself red if reachable on a well-formed — parseable and schema-valid —
   one), an abort deletes the file, a second open
   cursor is created, or a stale cursor is resolved silently.
6. **AC6 — claims stays reserved** [mechanical] (INV9): red if any shipped
   path writes `claims` or the guard stops flagging its presence.
7. **AC7 — records are path + state + digest tokens** [mechanical; the
   change-request report duty behavioral] (INV11, INV12; S16): red if a
   record with a mismatched `subject_sha256` still satisfies a
   precondition, **if a record whose `subject_state` mismatches the
   subject's current state still satisfies a precondition** (the
   round-three resurrect scenario: an absence record surviving a zero-byte
   file landing at its path), **if a digest-matched record satisfies a
   precondition for a subject other than the one its `subject` field names**
   (the sentinel makes this collision certain across deletions, not merely
   possible), if a record lacking `subject_state` satisfies any
   precondition, if record lookup stops spanning every run's records
   directory, or the change-request verdict report is dropped as owed.
8. **AC8 — rules are data, not an itinerary** [mechanical; the
   no-next-step property of authored skill/hook/extract text — **and of the
   `fire` and `id` strings, the rules file's two free-text fields** —
   behavioral: no named check reads meaning from authored prose, so a
   sequence written into a skill body, the charter's floor span, a `fire`
   value, or an `id` validates green and is caught by review, not
   machinery. `transitions.toml`'s *structure* is itinerary-proof by its
   closed schema and the pointer block by its template; its `fire` and
   `id` text is not — `id`'s format and uniqueness are mechanical
   (INV13), its meaning is not]
   (INV13–INV15; S15): red if an undeclared key or predicate form
   validates, an empty precondition set validates, or a transition that is
   not self-disabling validates.
9. **AC9 — floor-extract generation determinism** [mechanical] (INV22,
   INV23; S12, S13): red if the extract can be produced from anything but
   the marker span, if marker/slug/budget violations pass, if the floors
   are not the first body content, if two generation runs differ, or if a
   hand edit passes check.
10. **AC10 — pointer block, non-load-bearing** [mechanical] (INV24, INV25;
    S11): red if the block regains rules or loader lines, gains a second
    version carrier, stops validating under `inspectBlock`, or if any
    specified behavior fails when the block is absent.
11. **AC11 — host scope and the Codex precondition** [behavioral for the
    disclosure line; the shipping and evidence-record clauses mechanical]
    (INV26; S14): red if Codex projections omit either entry skill or the
    exact disclosure line, ship guard wiring before a Codex guard is
    decided, or if the implementation's build gate closes without the Codex
    hook-vocabulary evidence record.
12. **AC12 — hook-channel measurement and wrapper mapping** [mechanical]
    (INV21): red if the Stop hook is unregistered, a hold uses an
    unmeasured envelope or the flat `additionalContext` form, the wrapper
    exits `2` or departs from the exit mapping, or no retained measurement
    evidence exists for both channels at release.
13. **AC13 — the landing pairing** [mechanical at landing review]
    (§Propagation): red if the implementation-landing commit — "lands" as
    §Propagation defines it, never this draft's authoring PR — does not
    also carry spec-0004's §Driving-session loaders revision (with its
    version bump and the enumerated reconciliations), the advance of this
    spec's own `depends_on` pin to that resulting `@vN`, the `@vN` append
    to adr-0046's `changes:` entry, and adr-0035's scoped `.grove/runs/`
    note — all in that same commit.
14. **AC14 — frontmatter is a conforming YAML 1.2 parse, fail-closed**
    [mechanical] *(v3)* (INV16's parse clause, INV28; S17): red if a legal
    YAML spelling of a known `type` classifies as anything but that `type`'s
    row; if a parse failure or a schema-invalid document reaches `code`; if a
    non-mapping document, a non-string `type`, or an `implements` outside
    string-or-sequence-of-strings is accepted or coerced instead of
    classifying `unclaimed`; if the reader's YAML version is left to the
    build rather than fixed at 1.2 core schema; or if the `---` delimiter
    convention is handed to the YAML parser (adr-0048 D3's measured
    regression: eight inputs fall from `unclaimed` into `code`).

## Open questions

1. **SubagentStop wiring.** Handover guard runs are a prose duty on the
   driving session; a `SubagentStop` hook could make them deterministic.
   Needs measurement of noise and of whether handovers map 1:1 to subagent
   stops before wiring.
2. **Human-ratification records.** `human-approval` is schema-reserved;
   whether ratification acts become guard-visible records is grove#74's
   call, not this spec's.
3. **Record honesty.** A session-written record file is only as honest as
   its writer (adr-0046 accepts this openly). Whether records should later
   be derived from forge state instead is open, and would supersede parts of
   §Verdict-record contract.
4. **Codex guard activation.** If the measurement finds a Stop-equivalent
   event, activating a Codex guard and conditioning the disclosure line is
   follow-up amendment work under this spec.
5. **Mid-run subject growth.** A governed artifact changed mid-run
   **outside** the cursor's `subjects` list is neither held on (supervisor
   mode binds over `subjects`) nor warned about (observer mode runs only
   when no cursor is open). Both upstream clauses are honored; the gap is
   real. A supervisor-mode observer overlay — the warn-only sweep running
   beside the hold — would be decision-compatible. With `subjects`
   immutable after open (v1 minimalism), the current recourse is
   close-or-abort and reopen with the fuller list. Recorded open; nothing
   is decided here.

## Rubric check

`<SPEC_RUBRIC_PATH>` resolves from `.grove/config.toml` to the explicit value
`none exists yet`. No project spec rubric exists, so this self-check uses the
contract-author charter and approved adr-0046 without inventing substitute
criteria.

| Check | Result | Evidence |
|---|---|---|
| Approved upstream | PASS | `adr-0046-how-dispatch-rules-reach-a-session` is `status: approved` (in-session intent act, 2026-07-28); declared as `implements` and deliberate `depends_on`, beside pinned `spec-0004@v8` and `adr-0035`. |
| Artifact contract | PASS | Frontmatter carries id/type/status/depends_on/implements/owner/updated/version; Acceptance criteria and Open questions sections exist. |
| Decision fidelity | PASS | Clauses 1–8 map to §Non-goals (1), §Entry (2), §Floor extract + §Transition rules (3), §Run cursor (4), §The guard (5), §Managed pointer block (6), §Host scope (7), §Propagation (8). The three ratified draft choices are honored: model-invocable skills with the confirm gate, generated floor extract with a source-side marker convention, minimal cursor schema. |
| Open-question ownership | PASS | Open 9 is resolved here as the decision orders; Open 7 is explicitly not advanced; genuinely open items are listed, none load-bearing for implementation. |
| Amendment pairing (adr-0044) | PASS | Scalar `implements:` still names `adr-0046` (never retargeted). `depends_on` gains `adr-0048-parsers-are-dependencies`, which is `status: approved` and declares `changes: [spec-0006-voluntary-dispatch@v3]` — the exact reciprocal, version-matched pair for the reviewed subject. `adr-0048` attributes the whole `v3` delta to itself, both folded amendments included, so no behavior-changing clause in this version is unowned. |
| Testable grammars | PASS | INV1–INV28 are shall-form; S1–S17 are Given/When/Then; AC1–AC14 map both, each names its red-turning mutation, and each carries a mechanical/behavioral honesty label. |
| Boundaries | PASS | No net engine, itinerary, claims activation, forge hold, or Codex guard; nothing beyond the decision's scope — additions the decision does not name (`subject_sha256` and its absence sentinel, run-id grammar, budgets, guard exit codes and defect classes) are concretizations flagged in place. |
| Ambiguity | HONEST NOTE | Two mechanics rest on host-documented but locally unmeasured behavior: the Stop block-decision JSON and the observer stderr channel. The spec does not guess them silently — INV21/AC12 make pre-release measurement a hard requirement, following the trellis flat-envelope incident. *(v3 adds a third, named rather than hidden:* INV16's determinism is now **delegated** to a published format version — YAML 1.2 core schema — so the spec is determinate while whether a chosen implementation actually conforms is an execution measurement. `adr-0048` **does** choose the implementations and **has** measured the strictness — its erratum 7 records that Opens 1 and 2 are answered by Decisions 9 and 6, and D6 asserts the chosen library throws on `1:`/`0x1:` at its 1.2 default. This spec still fixes the target rather than the library: the delegation is to the **format version**, so a conforming substitute satisfies INV16 and no clause here names a package. What remains an execution measurement is whether the chosen implementation conforms in the general case, not whether one was chosen.*)* |
| Propagation | PASS | The spec-0004 pairing, adr-0046 `@vN` append, and adr-0035 note are bound to the landing commit by AC13. |

Self-check passes with the honest notes above. **Status stays `gated`** — the
spec gate ratified at v2 (frontmatter) is not re-earned or re-claimed by this
pass, and `approved` remains the maintainer's separate act, which this author
does not perform. v3 folds two amendments in one version under one approved
amendment decision: the entry-kind clauses drafted at v2 and ratified
2026-07-29, and `adr-0048`'s frontmatter-reading change. The conformance
review of v3 — the delta-scoped review `adr-0044` requires, against
`adr-0048` as amendment contract and `adr-0046` as original contract — is
downstream of this pass and is **not** claimed here.

*(Superseded self-check note, retained for history: the v2 pass recorded
"Status stays `draft`" while v2 folded the first convergence round. The
frontmatter's spec-gate ratification, also dated 2026-07-28, moved the status
to `gated`; the sentence was stale from that moment and is corrected rather
than silently dropped.)*
