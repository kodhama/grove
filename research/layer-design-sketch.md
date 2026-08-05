---
id: research-layer-design-sketch
type: research
status: recorded  # research is a reviewless type — it informs, never decides. This is a design SKETCH synthesized from a maintainer-driven session (2026-08-04): input to the founding boundary decision, ratifying nothing. Supersede with a newer sketch or with the founding decision itself.
depends_on: []
informed_by: [research-substrate-layerability, research-run-state-surfaces]
owner: agent
updated: 2026-08-04
---

# The layer — design sketch for grove as a supervisory control plane

One paragraph of thesis: **grove's product is the control plane, and everything
else is bought.** A substrate (OpenSpec first) owns artifacts, conventions,
prompts, and flow; grove supervises it — deciding which reviews are owed, who
owns each gate, what fires next, and whether what exists is still valid. The
differentiator against the substrate's own fast path: **ff mode removes the
gate; grove re-staffs it** — same speed, opposite safety, because a delegated
gate still verifies and records. Bar, in the maintainer's words: *complex made
apparently simple — it doesn't leak complexity, communicates cleanly, and at
most the user sees an additional file with no doubt what it is doing.*

## 1. The stack

Three layers, each small because the others exist:

| Layer | Owns | Delivery |
|---|---|---|
| trellis | conduct — how any agent behaves in any method | session rules; already paired with any substrate at zero cost |
| **grove** | supervision — owed reviews, gates, dispatch, validity | plugin: 2 TOML files, ~2 skills, 1 agent envelope, records |
| substrate | method — artifacts, flow, prompts, terminal UX | vendored by the substrate itself (e.g. `openspec init`) |

"Trellis is trust; grove is verify." Low-stakes work runs on trellis +
substrate alone; grove adds proof where stakes demand it.

Two orthogonal per-repo axes, both declared at setup, never inferred:

- **Presence**: dormant → git-native kernel (what grove-self runs today:
  changed-file classes, records, PR gates) → substrate-bound (adapter maps
  richer events onto the same machinery).
- **Agency**: observe (report) → gate (delegated reviews; human advances) →
  drive (dispatcher advances through agent-owned gates, stopping at human
  ones).

Declared-but-broken fails loud; declared-absent degrades clean. Grove never
depends on anything above it (viz/management layers read grove's state, never
the reverse).

## 2. The division of labor — forced by verified facts

Empirical results (2026-08-04, @fission-ai/openspec 1.7.0, throwaway project;
details in `research/substrate-layerability.md` and the session record):

- Artifact completion is `fs.existsSync` — **no content awareness**. Gutting a
  done file changes nothing; **no hash/mtime/fingerprint exists anywhere**.
- **Dependencies gate entry into existence and never revoke it** — deleting an
  upstream spec left the downstream review `done`.
- `validate --strict` is structural only — two directly contradicting
  requirements pass.
- `status --json` and `instructions apply --json` disagree on task-checkbox
  regression; `archive --yes` silently archives incomplete tasks.
- The only native "reopen" is file deletion; `/opsx:update` is advisory prose.

Therefore: **the substrate answers *where are we* (position); grove answers
*is it still valid* (validity).** Grove's existing record mechanism — verdict
bound to subject path + state + sha256 of the reviewed bytes, shedding
automatically on edit — is exactly the missing half, already built and the one
lifecycle in grove that dies automatically. The gate is **grove's PR check and
driver, never the substrate's `done` flag or `archive`** — both unreliable by
design.

## 3. Seam mechanics (verified)

- A custom artifact in a forked `openspec/schemas/<name>/schema.yaml` is
  **first-class**: blocked → ready → done in `status --json`, appears in
  `artifactPaths`, `instructions <id> --json` returns a full payload. The fork
  shadows the package schema; `openspec update` provably never touches
  `openspec/schemas/` — it won't clobber the fork, and won't refresh it.
  **The manual re-diff of the fork against upstream is the one recurring
  maintenance leak; keep the fork diff minimal.** (`schema` commands are
  flagged experimental — a recorded risk.)
- The custom artifact's `instruction` is a **pointer to a skill**, never
  charter prose — that keeps the fork diff one line and the charter
  single-homed in the plugin.
- Interleaving loop: schema declares position (`requires:`) → agent asks the
  substrate what's next → substrate hands back the pointer → agent runs the
  skill → writes the verdict file → status flips → PR check / driver advances.
  **The custom artifact is for visibility and instruction delivery, never
  enforcement** — its own `done` will not regress if the reviewed content
  changes.
- **The directory layout is the substrate's, hardcoded, and that is fine.**
  Verified in 1.7.0 source (`planning-home.js`): `changesDir` is always
  `openspec/changes/` under the nearest `openspec/`-bearing ancestor — no
  config key, and the schema fork cannot reach it (schema `generates:` paths
  are change-relative). The layer meets the substrate where it lives: the
  review queue is `openspec/changes/<name>/reviews/`, the archive is theirs,
  and grove names nothing at the top level — which serves the clean-seams bar:
  one directory, unambiguously the substrate's, no layer-named litter. The
  `openspec` name itself is a compile-time constant (`OPENSPEC_ROOT_DIR` in
  `openspec-root.js:6`, joined everywhere including config discovery) — no
  feature removes it. The beta **stores** relocate the *root*, not the name
  (a registered standalone planning repo, selectable via `--store`): planning
  can live entirely outside the code repo, which would be the ultimate seam
  except it breaks PR-check enforcement and decouples the review trail from
  the code's history — noted, not our shape. **Worksets** are purely local
  editor/agent view composition; no repo or naming effect.
- Grove's agents READ what the substrate wrote; grove's machinery never
  invokes substrate commands by name. Dispatched agents use the vendored
  skills for the *how* (that is what vendoring is for), so command churn never
  reaches grove.

## 4. Review records — an append-only queue per change

Home: `changes/<name>/reviews/`, one file per entry (`NNN-<reviewer>.*`),
because parallel reviewers must never collide on one file. Each entry carries:
machine-readable verdict (PASS/FAIL — gates key on *passing*, not *present*),
the sha256 of what was reviewed, findings, and the (envelope, skill) that
produced it. Rules:

- **Append-only; resolution is expressed by a later entry, never by editing an
  earlier one.** The open-findings queue is *derived*: the latest entry's
  findings where its verdict is FAIL.
- Stale ≠ rejected: stale is mechanical (digest mismatch → verdict sheds,
  review re-owed); rejected is a FAIL verdict routing a rework dispatch.
- Worked example of the shape, mid-flight:

  ```
  openspec/changes/add-dark-mode/
  ├── proposal.md
  ├── specs/…
  ├── tasks.md
  └── reviews/
      ├── 001-proposal-adversary.md   <- verdict entry: FAIL, findings, digest
      ├── 002-proposal-adversary.md   <- verdict entry: PASS, digest
      └── proposal-pass.md            <- the token (schema tracks ONLY this)
  ```

  The numbered files are the queue — full history, FAILs included. The token
  is near-empty (a stub naming the granting entry and digest); its truth is
  its presence, and any real content would invite a second source of truth.
  A FAIL writes only a queue entry — never the token — which is why the
  verdict entry cannot itself be the tracked artifact: a failing review is
  also a file, and existence would then mean "reviewed" instead of "passed."
- **The token pattern (verified constraint, designed consequence).** The
  schema's completion model is existence-only with no injection point
  (`state.js`: `detectCompleted` = `artifactOutputExists`; fields are
  id/generates/description/template/instruction/requires; no
  predicate/hook/exec concept exists). So the tracked artifact is a **grant
  token written only on PASS**; the queue (FAILs included) lives at untracked
  paths. Existence then *means* "review passed" — downstream `requires:`
  genuinely gates, and when grove's digest check finds the reviewed bytes
  changed, the layer **deletes the token** (the substrate's one native
  reopen), so `status --json` honestly shows the gate closed. The token is
  derived, re-mintable state — deleting it destroys nothing; history is the
  queue's. Caveat: already-done dependents never regress, so deletion
  prevents further advancement only; the PR check reading the queue remains
  terminal enforcement. Side-find: `.openspec.yaml` in a change folder
  natively declares `skip_specs: true` and the substrate renders the skip —
  a natural carrier shape for recorded-skips to piggyback.
- The change folder archives on merge, **so the review trail archives with the
  change it reviewed** — audit, custody, and shedding in one move, no new
  mechanism. Resumability falls out: rehydrate = read the change folder.

### 4b. The apply boundary — where the substrate's graph ends

The two phases are different *kinds* of thing. **Planning is
output-defined**: every step's done-ness is a tracked file the substrate
checks itself — existence-verification works because the artifact IS the
deliverable. **Apply is input-defined and self-reported**: the schema's
`apply:` block has `requires` (entry), `tracks` (the tasks.md checkbox
diary), and `instruction` (briefing) — and **no `generates:`. Apply produces
nothing the substrate can see.** Its real deliverable (the diff) lands
outside the change folder, and its only progress signal is checkboxes
written by the same agent doing the work — attestation, not observation.
OpenSpec governs planning and merely *narrates* implementation; grove's job
is precisely the half it narrates. **The layer's whole move, restated: we
cannot give apply an output, so we define artifacts after it whose tracked
files are minted only when a verifier checked the untracked reality.**

`apply` is an operation, not an artifact: its output lands in `src/`, which
the artifact graph never sees. Verified consequences: implementation progress
exists only as tasks.md checkboxes, invisible to `status` and to dependency
resolution (`requires: [tasks]` is satisfied by the file existing, ticked or
not; checkbox state surfaces only in `instructions apply --json`). So the two
surviving reviews split by phase:

- **Planning-phase review (proposal-adversary) is schema-native — and the
  schema speaks the gate itself.** VERIFIED: the schema's top-level `apply:`
  block declares apply-readiness (`apply.requires`, defaulting to ALL
  artifacts when undeclared), and with it unmet, `instructions apply --json`
  returns `state: "blocked"` with instruction text telling the agent
  verbatim "Cannot apply this change yet. Missing artifacts: …". Adding the
  token to the fork — `apply: requires: [tasks, proposal-pass]` — makes the
  substrate announce the gate in its own voice to its own vendored skills,
  no prompt edited. Happy-path enforcement only (rogue agents, ff mode, and
  humans can bypass; the PR check stays terminal), and existence-based like
  everything else — which is exactly why what it requires is the token.
  Also verified in the same pass: **the substrate is pull-only** — no event
  system, no post-apply trigger; the cycle advances only when someone asks
  `status`/`instructions` and acts. The driver IS the trigger in drive mode;
  the only push-shaped events anywhere are grove's (harness hooks, PR
  events).
- **Implementation-phase review (conformance) is PR-native** — its subject
  (the diff vs the spec delta) is outside the substrate's universe, its
  readiness is layer-derived (checkboxes complete + diff exists), and its
  enforcement is the PR check: exactly grove's kernel territory, where
  records-on-the-branch already work. The substrate's graph ends where the
  code begins; grove's begins there.

**The boundary is observation, not sequencing.** The substrate never sees
`src/`, but it can sequence anything tokenized into the change folder:
**evidence tokens** — files minted when a verified condition holds
(`evidence/tests-green.md`), with post-apply artifacts depending on them
(`conformance-pass requires: [implementation-evidence]`). Dependency
semantics then stay truthful across the whole lifecycle, `status --json`
renders implementation gates honestly, and `instructions` delivers the
review skill at the right flow position post-apply too. Three limits keep it
honest: a token is an **attestation, not a measurement** — grove verifies,
mints, and only then does the substrate sequence; the **minter is never the
worker** (envelope-separated, the author≠verifier floor restated for
tokens); and every phase artifact grows the schema fork, so ~2
implementation-phase artifacts is the ceiling worth paying. Rule: tokens
never `generates:` outside the change folder — archive custody is the point.
(Custom-requires-custom rides the verified uniform graph loop; a five-minute
spike check confirms the resolver.) Both queues live in
`changes/<name>/reviews/` for custody either way.

### 4c. The postulated schema — grove's verification in substrate grammar

No message-passing exists or is needed: **this is a blackboard
architecture.** Everything about a change lives in one folder; findings
never travel — consuming activities are *told where to look* by
`instruction:` text (fork-owned) or `config.yaml` per-artifact `rules:` (an
existing knob): "before starting, read `reviews/`; if the newest entry for
your phase is FAIL, address its findings first." Rework is no schema step —
it is redoing the failed artifact, instructions pointing at the queue.
**The gate is an edge, not a node**: the reviewer is an artifact minting a
token; the gate is every `requires:` naming it — and a human gate is the
same shape, a token only the human's act may mint. Division of the three
config surfaces: **the schema says where gates sit; `gates.toml` says who
owns each; the (envelope, skill) pair staffs the agent-owned ones.**

```yaml
artifacts:
  # built-ins: proposal → specs → design → tasks
  - id: proposal-review                    # agent-owned per gates.toml
    generates: reviews/proposal-pass.md    # the token
    requires: [proposal, specs]
    instruction: |
      Dispatch the proposal-adversary skill in a cold read-only envelope.
      Verdicts append to reviews/NNN-proposal-adversary.md — a FAIL writes
      only a queue entry, never this file. Mint only on PASS, citing the
      granting entry and subject digests.
  - id: intent-approval                    # the human gate
    generates: approvals/intent.md
    requires: [proposal-review]
    instruction: |
      STOP. This token records the maintainer's approval act. An agent may
      transcribe a recorded human act — never mint from its own judgment.
  - id: implementation-evidence            # the output apply never had
    generates: evidence/tests-green.md     # minted by a verifier, never the worker
    requires: [tasks]
  - id: conformance-pass
    generates: reviews/conformance-pass.md
    requires: [implementation-evidence]

apply:
  requires: [tasks, intent-approval]       # the substrate speaks the gate
  tracks: tasks.md
```

**The FAIL loop — where the substrate actively misleads, and the layer's
answer.** After a FAIL the token doesn't exist and the review's `requires:`
are still met, so `status` shows the review artifact **`ready` —
indistinguishable from never-ran**. No fail state exists in the enum, and
`requires:` is positive-only (no NOT-gates), so "blocked while a
revision-request exists" is inexpressible. Resolution, two pieces:

- **The signal is a queue entry whose digests still match the tree.** Latest
  entry FAIL + subject hashes unchanged since it = *revision owed*; hashes
  changed = *re-review owed*. One comparison, no stored flags — the queue
  plus digests is the entire rework state machine, and re-review licensed
  only by digest change also kills review-flapping.
- **Delivery rides the funnel.** Post-FAIL, the graph routes every
  "what's next?" to the review artifact — so its instruction carries the
  branch: "if a FAIL entry exists for these subjects with digests unchanged,
  do not re-review; the owed work is revising the upstream against that
  entry's findings." The misleading `ready` becomes the delivery mechanism:
  vendored skill, dispatched agent, or human all get redirected by the only
  instructions the substrate hands them. The driver skips the redirect and
  reads the queue directly, dispatching `(write-capable, revise)` with the
  FAIL entry as input.

Caveat recorded: the status *field* can never show red — the substrate lacks
the vocabulary; the instruction text, the queue, the driver, and the PR
check all carry the truth. Red-in-status is an upstream feature request, not
layer-conjurable.

Honesty notes: post-apply `requires:` renders position; **the ordering truth
is the minting rule** (verify reality, then mint), the graph its honest
display. Ship stays outside the schema — merge is the terminal human gate on
grove's PR territory. This block is also the whole fork diff the spike
needs, which keeps the re-diff maintenance leak proportional to ~4 artifact
stanzas.

### 4e. What the schema is, honestly — and the steady state

(Maintainer's critique, recorded because it is the sharpest statement of the
layer's identity.) **The schema is a one-shot construction checklist.**
Existence accumulates monotonically toward done; once everything exists the
schema is *spent* — it says "all good" unconditionally, forever. It governs
the first pass, then becomes a display.

The steady state does NOT replicate the schema's graph — it runs a smaller,
different one. The schema answers *construction ordering* ("what may be made
next"). Steady-state truth is *validity binding* ("is this judgment still
about these bytes"), and that graph is carried by the records themselves:
every queue entry names its subjects and digests, so validity derives from
one rule — do the recorded digests still match the tree — with no shadow
schema. Construction is graph-shaped; validity is record-shaped.

**Frame: OpenSpec is the checklist; grove is the staleness engine.** The
substrate deliberately is not `make` — no invalidation semantics of any
kind. The layer is the make-half over someone else's checklist, and that is
the layer's entire identity in one sentence.

**Known display lag (accepted, named).** Once all artifacts are done the
funnel vanishes — nothing in the substrate ever triggers a re-check — so a
token whose subjects have since changed sits green in the tree until
something external looks. Deletion tiers: the **PR check** (hard boundary —
recomputes digests every push; staleness never crosses a merge), the **Stop
hook** (session-granular — sweeps open change folders at session end, both
hosts have the hook), and **driver wakes** in drive mode (continuous). The
lag is bounded to within-a-session in interactive mode, and the working
tree may lie for exactly that long. Recorded as a limitation, not handled
by pretense.

### 4f. The concrete trace — one FAIL round-trip, no design words

```
Turn 1  agent: /opsx:propose add-dark-mode → proposal.md, specs/ written
Turn 2  agent: openspec status --json      → proposal-review: READY
        agent: openspec instructions proposal-review --json
               → OUR fork text: "check reviews/ first … else dispatch
                  the proposal-adversary skill, cold, read-only"
        agent spawns reviewer → it writes reviews/001-…md
               (verdict: FAIL, subjects with sha256, findings)
               — and does NOT create proposal-pass.md. Exits.
Turn 3  anyone: openspec status --json     → proposal-review: READY (!)
        anyone: openspec instructions proposal-review --json
               → same text: "latest entry FAIL + digests unchanged →
                  do NOT re-review; revise proposal.md per findings"
        agent READS reviews/001-…md — an ordinary file read. That IS
        the passing of results: no channel, no parameter. Reviewer
        wrote a file; reviser reads it because the fetched instruction
        says to. Then edits proposal.md.
Turn 4  status → READY → instructions → queue: FAIL but digests now
        DIFFER → re-review licensed → reviewer: PASS → writes 002-…md
        AND mints reviews/proposal-pass.md → intent-approval: READY →
        stops. That token is the maintainer's.
```

Drive mode differs in one detail: the driver reads the FAIL file itself
and pastes its contents into the reviser's dispatch prompt — delivery by
prompt instead of by pointer. And stated flatly for the record: files plus
instructions pointing at them is the substrate's ONLY communication
primitive — the vendored skills are the same thing all the way down; the
PR check is the one hard backstop for agents that do not follow prose.

## 5. (envelope, skill) — the dispatch unit

A gate or transition names a **pair**: the *envelope* (tool permissions,
model, effort, cold-start — the only things a skill cannot carry; structural
read-only beats promised read-only) and the *skill* (the knowledge). Axes vary
independently: same skill at different model tiers = risk-tiering per gate;
same envelope across review skills = one read-only-reviewer agent type.

What the pair buys:

- **The substrate's own skills become dispatchable with no grove charter**:
  `fire (write-capable, /opsx:apply)` — grove decides when and with what
  powers; OpenSpec supplies the how.
- Charters shrink 13 → **~2 skills + 1 envelope**: `conformance-review`
  (implementation vs the change's own spec delta — the genuinely
  differentiated review nobody ships) and `proposal-adversary` (grove's
  decision- and spec-adversary collapse, since the substrate's proposal *is*
  the decision). Code quality → stock/host reviewers (adr-0047's own ruling).
- **Records carry the pair** — the envelope is the auditable proof of
  independence.
- Floors restate against **actions, not role names**: any write-capable
  dispatch requires a gated/approved artifact; author and reviewer must not
  share context; every run keeps one human-owned gate. Aliases for recurring
  pairs are sugar only — the pair stays the unit.

## 6. The driver

Never uses the substrate's contextual commands ("continue"). It **derives flow
position from files** (change-folder contents; `status --json`; also
`instructions apply --json`, which is the only view that catches task
regression), checks gates against the derived record queue, and dispatches the
*specific* licensed next step. Rework is just another dispatch selected by a
FAIL verdict — non-linearity needs no rewind, only re-derivation. Where the
loop lives (interactive session / long-running / cron-CI) is an open founding
question; one autonomous hop is provable in any of them.

## 7. Vocabulary mapping

Substrates name artifacts differently; owed reviews fire on classes. The
adapter interface is a **word→class synonym map declared at setup, never
inferred at guard time** — may only map words to existing classes; malformed
map ignored whole; unknown words stay `unclaimed`, fail-closed; a known kind
never carries less than the full owed set (else recognition fails open).
Tracked as grove#222 with the supporting findings.

## 8. The spike — protocol

**Claim under test (the minimum viable one): a gate can be re-staffed rather
than removed, thinly, without killing the substrate's ease.** Explicitly NOT
under test: adapters, drivers, record machinery, this document. Nothing from
§3–§7 gets built; the spike hand-rolls the smallest slice.

- Setup: math-quest, post-cleanup, OpenSpec vendored (control period first:
  plain OpenSpec + trellis on real work — that baseline is the comparison).
- **Scenario one (happy path):** one real change. One forked-schema review
  artifact. One review skill invoked via a cold read-only dispatch. Verdict
  file by hand-convention (§4 shape). One autonomous hop: on PASS, dispatch
  the next specific step; stop at the human gate. Optionally one PR check
  reading the review files.
- **Scenario two (the FAIL round-trip — the harder and more valuable test):**
  a change whose proposal deliberately earns a FAIL → verify the agent asking
  "what's next" is redirected to revision by the review artifact's
  instruction (not looped into re-review) → revise → digests change →
  re-review licensed → PASS → token minted → `instructions apply` flips from
  "Cannot apply this change yet" to ready. If the vendored skills follow the
  redirect unaided, the layer's hardest mechanic is proven; if they loop or
  stall, that is the finding.
- **Kill criteria**: > ~2 evenings of effort, > a few hundred lines of
  anything, or the felt ease meaningfully worse than the control period. Any
  of these falsifies the thin-layer thesis; the recorded honest outcome is
  then "OpenSpec + trellis is the end state."
- Open questions the spike should answer en passant: does `template:` give
  useful verdict skeletons; can one PR check cover all open change folders
  cheaply; is `proposal-adversary` worth a skill or does trellis + a stock
  reviewer cover it; which model tier the conformance gate actually needs.

**The three prompt layers (verified), and where polish lives.** (1) Schema
`instruction:` fields — thin per-artifact work orders; the only layer we
fork. (2) Fourteen workflow templates (`propose`, `apply-change`,
`continue-change`, `ff-change`, `explore`, `onboard`…) generate the vendored
per-tool skills — the walkthrough UX with the terminal polish and ASCII
diagrams (grep: `onboard.js`, `explore.js`); regenerated by `openspec
update`, therefore never edited by us. (3) The CLI's own rendering
(`view.js`). The interleaving mechanism, VERIFIED at both the template and
the vendored file: the generated skills call the CLI for state and
instructions (`templates/workflows/continue-change.js:33,57` runs
`openspec status --json` then `openspec instructions <artifact-id> --json`;
vendored `.claude/commands/opsx/apply.md:38` does the same, and `:50`
handles `state: "blocked"` by relaying the message) — so our forked stanzas
surface *through their walkthrough*, and our `apply.requires` gate is
announced to the agent by **their** vendored command, not our machinery.
The diagram charm is template-carried and template-instructed
(`explore.js:51`: a box titled "Use ASCII diagrams liberally" with worked
examples; `onboard.js:190`). Fork discipline, resolved: **protocol vs craft**
— gate protocol (queue, digests, redirect, minting; ~15 lines per stanza)
belongs in the fork beside the position it governs; review *craft* stays in
grove plugin skills, our own polishable layer-2 equivalent, surviving every
substrate update.

### 4d. The fork, complete — implementable as written

The entire fork diff (appended to the copied schema.yaml; built-ins
unchanged). Instructions are the load-bearing prose: they carry the
minter-separation floor, the D5 rule, the queue convention, and the
FAIL-redirect branch — and they stay true whether a human or the driver
turns the crank, which is what lets one fork serve interactive and drive
mode unchanged. Deliberately absent: enforcement (the PR check reading the
queue is the gate; these texts govern the happy path) and dispatch mechanics
(gates.toml owns who; the driver or the human owns when).

```yaml
artifacts:
  # …built-ins unchanged: proposal → specs → design → tasks…

  - id: proposal-review
    generates: reviews/proposal-pass.md
    requires: [proposal, specs]
    instruction: |
      This gate is agent-owned (see .grove/gates.toml). You are probably not
      the reviewer: if you contributed to proposal.md or specs/, you must
      not review them — dispatch the proposal-adversary skill in a cold,
      read-only agent (no write outside reviews/).

      BEFORE reviewing, read reviews/ for NNN-proposal-adversary.md entries.
      If the latest entry's verdict is FAIL and every subject digest it
      records still matches the current files: DO NOT re-review. The owed
      work is revising proposal.md and specs/ against that entry's findings
      — report that, or perform it only in a separate write-capable
      dispatch. Re-review is licensed only once a subject digest changes.

      The reviewer appends ONE entry per round (never editing or deleting an
      earlier one): verdict (PASS|FAIL), reviewer envelope and skill, date,
      subjects as path@sha256:<hex>, findings (empty on PASS).

      Mint reviews/proposal-pass.md ONLY on PASS, as a stub citing the
      granting entry and its digests. A FAIL writes only the queue entry.

  - id: intent-approval
    generates: approvals/intent.md
    requires: [proposal-review]
    instruction: |
      STOP — the human intent gate. This file records the maintainer's
      approval of the proposal; its existence unlocks apply.

      An agent NEVER mints this from its own judgment. An agent MAY
      transcribe a recorded human act — an explicit in-session approval or
      an approval on the change request — quoting the act verbatim with
      date and channel. If no act exists, the owed work is asking the
      maintainer, and this artifact stays absent.

  - id: implementation-evidence
    generates: evidence/tests-green.md
    requires: [tasks]
    instruction: |
      Minted by a VERIFIER, never the implementing agent — if you executed
      the tasks, you do not write this file. The verifier runs the repo's
      own gates (test/typecheck as the repo defines them) at the current
      tree and mints only when they pass, recording commands, results, the
      tree state verified, and date. On failure: write nothing here; the
      output goes to the implementer via the change request or a queue
      entry.

  - id: conformance-pass
    generates: reviews/conformance-pass.md
    requires: [implementation-evidence]
    instruction: |
      Implementation conformance: does the diff do what this change's
      specs/ deltas say — nothing missing, nothing beyond scope? Same rules
      as proposal-review: cold read-only reviewer; queue first with the
      FAIL-redirect rule; one entry per round recording verdict, subjects
      (the delta files AND the commit reviewed), findings; mint only on
      PASS. Enforcement is the pull request's check — this token is the
      substrate-visible rendering, not the gate itself.

apply:
  requires: [tasks, intent-approval]   # the one edited line
  tracks: tasks.md
  instruction: |
    Read context files, work through pending tasks, mark complete as you
    go. Pause if you hit blockers or need clarification.
    You never write files under reviews/, approvals/, or evidence/ — those
    are minted by verifiers and the maintainer, not by the implementer.
```

Queue entry convention (untracked by design, so declared here, not in the
schema):

```markdown
# reviews/002-proposal-adversary.md
verdict: FAIL
by: (read-only cold agent, proposal-adversary skill)
date: 2026-08-05
subjects:
  - proposal.md@sha256:ab12…
  - specs/dark-mode/spec.md@sha256:cd34…
findings:
  - Non-goals contradicts task 3 (offline mode both excluded and implemented)
  - INV-DM-2 untestable as written: "feels instant" has no threshold
```

## 9. What this replaces, and what it owes

If founded: adr-0038 + sdd-gauntlet lose their subject (retire by recorded
decision); most of grove's 51-decision law consolidates to archaeology; the
artifact-taxonomy/companion corpus shrinks with the substrate owning
artifacts; the #197 trunk's read model and body contract become internal to
grove's own (small) corpus. Open defects that survive any remodel: grove#221
(the floor text contradicts its single home — live today), grove#209/#213
(subsumed by §4 if founded), grove#191 (dissolves if the cursor's jobs
unbundle per `research/run-state-surfaces.md`).

Sequencing: math-quest PRs #413/#417 merge → PR 5 vendors OpenSpec → control
period → spike → **one founding boundary decision** (the next decision grove
takes, and ideally one of very few). Pointers: mq#399 (campaign tracker),
grove#221, grove#222, the closed-with-rationale PRs #214/#216/#217/#218.
