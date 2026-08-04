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

`apply` is an operation, not an artifact: its output lands in `src/`, which
the artifact graph never sees. Verified consequences: implementation progress
exists only as tasks.md checkboxes, invisible to `status` and to dependency
resolution (`requires: [tasks]` is satisfied by the file existing, ticked or
not; checkbox state surfaces only in `instructions apply --json`). So the two
surviving reviews split by phase:

- **Planning-phase review (proposal-adversary) is schema-native** — its
  inputs are planning artifacts, `requires:` is truthful, its PASS token
  gates the driver's `(write-capable, apply)` dispatch, and `status --json`
  renders the gate honestly.
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
- One real change. One forked-schema `conformance-review` artifact. One review
  skill invoked via a cold read-only dispatch. Verdict file by hand-convention
  (§4 shape). One autonomous hop: on PASS, dispatch the next specific step;
  stop at the human gate. Optionally one PR check reading the review files.
- **Kill criteria**: > ~2 evenings of effort, > a few hundred lines of
  anything, or the felt ease meaningfully worse than the control period. Any
  of these falsifies the thin-layer thesis; the recorded honest outcome is
  then "OpenSpec + trellis is the end state."
- Open questions the spike should answer en passant: does `template:` give
  useful verdict skeletons; can one PR check cover all open change folders
  cheaply; is `proposal-adversary` worth a skill or does trellis + a stock
  reviewer cover it; which model tier the conformance gate actually needs.

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
