---
name: record-audit
description: Turn the auditor's grove-audit-judgment into ONE posted grove-audit comment on the change request. Self-detects whether the bookkeeping check is installed (no-op when absent), runs the audit emitter — which stamps the coverage-residue manifest, content and policy fingerprints, and the typed record-stream high-water mark — and posts the stamped record as a new append-only comment. Use at pass close, when the auditor's judgment lands (adr-0023 D4, spec-0003 §C). The caller needs no CI knowledge; this skill is the whole bridge.
---

# Record the auditor's audit (emit + post)

The auditor supplies only judgment — `auditor`, per-residue-file
`dispositions` (`{owed, why}`), optional `findings` (`adr-0015`'s
judgment/stamp split, applied to the audit itself; spec-0003 §C.2).
This skill turns that judgment into the posted `spec-0003` §C.1
`grove-audit` record: the **emitter stamps every machine-computable
binding** — the coverage-residue manifest with per-path content hashes,
the `grove-fp-1` content fingerprint over the diff files at HEAD, the
policy fingerprint over the protected-branch policy carriers, the typed
record-stream high-water mark (`record_hwm`, sentinel `0` over a
typed-record-free stream), and the flagged rows — and the harness
posts. **Everything CI-aware lives here**; the auditor never computes,
edits, or "fixes" a stamped field.

## 0. Input

- One fenced `grove-audit-judgment` block (the auditor's output),
  exactly as emitted: `schema: 1`, `auditor`, `dispositions` (one
  `{owed, why}` entry per judgment-residue file), optional `findings`.
- The change request (PR) and a checkout of its HEAD (the commit the
  auditor audited).
- **Residue-conditional** (spec-0003 §B.2): if the judgment residue is
  empty, no audit is owed and the auditor should have reported a no-op
  — nothing reaches this skill. An empty-`dispositions` judgment
  arriving anyway is legal surplus; say so and proceed only if asked.

## 1. Self-detect: is the check installed?

Read the review policy **from the protected default branch** (the
`adr-0014` discriminator — never PR HEAD, never the working tree):

- **grove-self:** `git show origin/<default>:charters/review-policy.md` —
  found and it contains a fenced `grove-review-policy` block →
  **installed** → continue.
- **consumer (`adr-0018` D10 split):** else
  `git show origin/<default>:.grove/review.toml` — found (a TOML file with
  a `scope` key; there is **no** fenced block in the split TOML carrier) →
  **installed** → continue.
- Neither exists (nor a block in the charter form) → **not installed** →
  **no-op**: say plainly "bookkeeping check not installed on `<default>` —
  no audit owed; nothing posted" and stop.
- **Cannot read** (no remote, fetch failure, git error) → that is NOT
  "absent": **fail loudly** with what failed and stop. Never fold a read
  failure into the no-op.
- Key on **policy presence only** — never on workflow-file presence
  (`adr-0014` F1).

## 2. Emit: stamp the record

Resolve the check runtime directory: the `check_runtime_dir` carrier key
if present — in grove-self, the `grove-review-policy` block of
`charters/review-policy.md`; in a consumer, the
`.grove/internal/review-wiring.toml` wiring file (`adr-0018` D10) — else
the first of `plugins/grove/check/` (grove-self) or
`.grove/internal/check/` (consumer) that exists.

Assemble the emitter's inputs — **one comment-stream read, one
watermark** (spec-0003 §C.2/N3: the HWM is stamped over the same
snapshot the residues derive from; never re-read between derivation and
post):

- `diffFiles` — the spec-0002 §C.2 diff walk: merge-base…HEAD changed
  paths, HEAD-present only (a deleted path contributes no entry);
- `comments` — the PR's full comment stream via the platform API,
  paginated to exhaustion; a truncated read fails loudly;
- `asks` — the schema-valid `grove-review-ask` records from
  **admissible** comments only (spec-0002 §A.4 via the runtime's
  `checkAdmissibility`);
- `reviewlessTypes`, `carrierPaths`, `protectedTree` — from the
  protected-branch policy assembly (`policyCarriers` gives the carrier
  set: the review-policy file + every discovered declaration file);
- `tree` — HEAD blob contents for the diff files and carrier reads.

Then run the runtime's own emitter, so the stamp and any later
recomputation agree by construction:

```
node --input-type=module -e '
import { emitAudit } from "<runtime>/lib/audit.mjs";
/* … assemble the inputs above … */
const { block } = emitAudit({ judgment, diffFiles, asks, reviewlessTypes,
  tree, carrierPaths, protectedTree, comments });
console.log(block);'
```

On an emitter throw (empty `auditor`, a disposition whose `owed` is not
a list, fence-breaking text): **surface the error verbatim and stop** —
never hand-patch a block into postable shape.

**Separation pre-check** (spec-0003 §C.4): before posting, compare the
judgment's `auditor` against the stream's separation set `P` — every
schema-valid ask/verdict `producer` **plus** every ask `resumed_by`
(the runtime's `separationSet`). `auditor ∈ P` ⇒ the record would be
inadmissible: **surface the conflict and stop** rather than post into
rejection.

## 3. Post: ONE audit comment, append-only

Post **ONE new PR comment** carrying the single stamped `grove-audit`
block. Use the platform comment API available in your environment
(`gh pr comment`, an MCP comment tool, …); prose around the block is
allowed — only the block is the record:

```
<details>
<summary>grove: audit — <auditor> — N disposition(s)</summary>

[grove-audit block, verbatim]

</details>
```

- **Never edit a posted comment.** Admissibility is spec-0002 §A.4
  inherited whole (spec-0003 §C.4): an edit rejects every block on the
  comment. A correction or re-audit is always a **new** comment — the
  latest admissible audit supersedes by selection (§C.5), earlier ones
  stay visible, never deleted.
- **Keep the block cleanly fenced** (its own opening
  ```` ```grove-audit ```` and closing ```` ``` ````), so an
  unterminated fence cannot swallow what follows (spec-0002 §A.1).
- **Poster identity.** Post under the session's own authenticated
  identity — `OWNER`/`MEMBER`/`COLLABORATOR` is admissible by default;
  a bot/app identity needs the policy's `record_poster_allowlist`.
  Check before posting into rejection, and surface a mismatch rather
  than posting anyway.

## 4. Report

State what happened: "posted 1 audit comment, N disposition(s) over
`<residue files>`", or the no-op reason, or the error. During shadow
the audit gates nothing — the shipped check is byte-identical with or
without it (spec-0003 INV1); an owed-but-absent audit is a
comparator-reported fact, never a red.

## Boundaries

- The caller stays CI-free: resolve every CI detail (install state,
  runtime path, emitter invocation, comment API) inside this skill.
- The auditor never invokes this skill's machinery half directly and
  never sees the stamped record (`adr-0015`): its judgment passes
  through the emitter untouched — you never add, drop, or reword a
  disposition.
- One audit comment per auditor pass; a later audit supersedes by
  **selection**, never by editing or staling an earlier one
  (spec-0003 §C.3/F6: `grove-audit` blocks are not in the invalidating
  class).
- This skill posts audit records. It never reviews, never judges the
  residue itself, never edits artifacts or records, never merges.
