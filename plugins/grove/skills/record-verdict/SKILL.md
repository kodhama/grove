---
name: record-verdict
description: Turn a reviewer's grove-review-judgment into posted verdict-record comment(s) on the change request. Self-detects whether the bookkeeping check is installed (no-op when absent), runs the record-emitter, posts each stamped record as a new append-only comment. Use at the review seam — whenever a reviewer agent's judgment lands. The caller needs no CI knowledge; this skill is the whole bridge.
---

# Record a reviewer's verdict (emit + post)

The reviewer emits only its judgment (`adr-0015`); this skill turns that
judgment into the posted `spec-0002` §A.2 verdict record the bookkeeping
check reads (`adr-0017`). **Everything CI-aware lives here** — the caller
hands over judgment block(s) and nothing else: never ask the caller for
the emitter command, the runtime path, or whether the check is installed.

## 0. Input

- One or more fenced `grove-review-judgment` blocks (a reviewer's
  output), exactly as the reviewer emitted them.
- The change request (PR) the run is working on, and a checkout of its
  HEAD (the commit the reviewer reviewed).

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
  no record owed; nothing posted" and stop. Nothing gates, so nothing owes
  a record.
- **Cannot read** (no remote, fetch failure, git error) → that is NOT
  "absent": **fail loudly** with what failed and stop. Never fold a read
  failure into the no-op. (Backstop, for honesty: a wrong no-op cannot
  go silent-green — the check reads the protected branch itself and reds
  `never-reviewed` on any pair you failed to post.)
- Key on **policy presence only** (the charter block, or the consumer
  `.grove/review.toml`) — never on workflow-file presence. A
  missing/relocated workflow is `adr-0013`'s carrier-red condition; keying
  on it would starve exactly that PR of the records it still owes
  (`adr-0014` F1).

## 2. Emit: stamp the record(s)

Resolve the check runtime directory: the `check_runtime_dir` carrier key if
present — in grove-self, the `grove-review-policy` block of
`charters/review-policy.md`; in a consumer, the
`.grove/internal/review-wiring.toml` wiring file (`adr-0018` D10) — else the
first of `plugins/grove/check/` (grove-self) or `.grove/internal/check/`
(consumer) that exists.

In the PR checkout, with HEAD at the reviewed commit, pipe each judgment
block (the full fenced block) to the emitter:

```
node <runtime>/bin/emit-record.mjs --file <judgment-file>
```

(or on stdin). It prints one fenced `grove-verdict` block per reviewed
path on stdout. On a non-zero exit or stderr errors (e.g. a fidelity
subject with no reviewable upstream): **surface the error verbatim and
stop** — never post a partial set silently. The emitter stamps the
fingerprint mechanically; you never compute, edit, or "fix" a record's
fields.

## 3. Post: one comment per review, append-only

The emitter fans out **one `grove-verdict` block per reviewed path** — a
single review often stamps many. Post them as **ONE new PR comment per
review** carrying **all** that review's blocks (`spec-0002` §A.1: a comment
may carry several records; the check reads each block independently — one
comment per file would be a wall on a wide PR, `adr-0019`). Use the
platform comment API available in your environment (`gh pr comment`, an
MCP comment tool, …), wrapped for thread readability — §A.1 allows prose
around the blocks; only the blocks are the records:

```
<details>
<summary>grove: <review> — <verdict> — N records (<subjects…>)</summary>

[grove-verdict block for path 1, verbatim]

[grove-verdict block for path 2, verbatim]

…one fenced block per reviewed path…

</details>
```

- **One comment per review, several records inside.** Each `grove-verdict`
  block is its own record, read independently (`spec-0002` §A.1, `adr-0019`);
  block order in the comment is the tiebreak index, so keep the emitter's
  order. A **malformed** block is inert on its own and never inerts a
  well-formed sibling — but keep each block cleanly fenced (its own opening
  ```` ```grove-verdict ```` and closing ```` ``` ````) so an unterminated
  fence cannot end the next block early.
- **Never edit an existing comment.** An edited record comment is
  rejected outright (§A.4), and the rejection granularity is the whole
  comment — the summary prose **and every record batched in it** are
  frozen together, so an edit rejects **all** the review's records at
  once. A correction or re-review is always a **new** comment (carrying
  the re-reviewed paths' fresh records); the check's latest-covering
  selection supersedes per `(path, review)`, so an earlier batch's
  still-valid records keep counting.
- **Poster identity.** Post under the session's own authenticated
  identity — an `OWNER`/`MEMBER`/`COLLABORATOR` is admissible by
  default. If your environment posts through a bot or app identity, the
  record will be rejected `unauthorized` unless that identity is in the
  policy's `record_poster_allowlist` — check before posting into
  rejection, and surface the mismatch rather than posting anyway.

## 4. Report

State what happened: "posted N record(s) for `<subjects>`", or the no-op
reason, or the error. The check's green is bookkeeping — **never
approval**; the human still judges genuineness and merges.

## Boundaries

- The caller stays CI-free: resolve every CI detail (install state,
  runtime path, emitter command, comment API) inside this skill.
- Reviewers never invoke this skill and never see records (`adr-0015`
  Decision 1). The judgment's `producer`/`reviewer` fields pass through
  the emitter untouched — the separation authority is those fields,
  never the poster.
- This skill posts records. It never reviews, never edits artifacts or
  records, never merges.
