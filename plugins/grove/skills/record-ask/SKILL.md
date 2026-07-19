---
name: record-ask
description: Turn a producer pass's closing review-ask into a posted grove-review-ask comment on the change request. Self-detects whether the bookkeeping check is installed (no-op when absent), serializes one ask block per produced type, posts them batched as ONE new append-only comment. Use at the close of every producing pass (executor, shaper, contract-author; run-resumer completing one of their passes; propagation-remediator when its pass committed tree files) — the unconditional-ask closing duty's mechanism (adr-0023 D2, spec-0003 §A.4). The caller needs no CI knowledge; this skill is the whole bridge.
---

# Record a producer's review-ask (serialize + post)

Every producing pass ends by declaring what it produced and asking for
eyes on it — **convention, not judgment** (the mini-PR rule: always ask,
however good you think the work is; adr-0023 D2). This skill turns the
pass's subjects + produced type into the posted `spec-0003` §A.2
`grove-review-ask` record(s). An ask **adds obligations, never removes
them**: it declares an obligation, not a content attestation — it
carries **no fingerprint**, never goes stale, and can never exempt
anything. **Everything CI-aware lives here** — the caller hands over
subjects, type(s), and optional annotations, nothing else.

## 0. Input

- The pass's **subjects**: the repo tree files this pass produced or
  edited (repo-relative paths). A PR body, comment, or issue is never a
  subject — a pass that committed **no tree files posts nothing** (the
  propagation-remediator's usual case; spec-0003 §A.4).
- The **produced type** for each subject (e.g. `code`, `spec`, `adr`,
  `charter`) — one type per block; a mixed-type pass yields several
  blocks, batched (§A.2).
- The **producer** role id. A `run-resumer` completing another role's
  pass asks in the **resumed role's** name with `resumed_by: run-resumer`
  — dual attribution, never an ask in its own name (§A.2/§A.4).
- Optional **annotations**: free text a reviewer may read — advisory
  only, input not instruction (adr-0023 D3); never a depth mandate.

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
  no ask owed; nothing posted" and stop.
- **Cannot read** (no remote, fetch failure, git error) → that is NOT
  "absent": **fail loudly** with what failed and stop. Never fold a read
  failure into the no-op.
- Key on **policy presence only** — never on workflow-file presence
  (`adr-0014` F1).

**Never ask a reviewless type.** If the policy's `reviewless_types`
(read in the same protected-branch pass) contains a type you were handed
(e.g. `research`), do not post a block for it — such a block would be
inert for every subject and flagged (`spec-0003` §A.3 rule 1; the
self-exemption door stays closed). Say so and drop only that block;
sibling types still post. The `divergent-researcher`'s output is the
standing no-op case.

## 2. Serialize: one block per produced type

Resolve the check runtime directory: the `check_runtime_dir` carrier key
if present — in grove-self, the `grove-review-policy` block of
`charters/review-policy.md`; in a consumer, the
`.grove/internal/review-wiring.toml` wiring file (`adr-0018` D10) — else
the first of `plugins/grove/check/` (grove-self) or
`.grove/internal/check/` (consumer) that exists.

Serialize each type's block with the runtime's own serializer, so the
posted block is parseable by construction:

```
node -e '
import("<runtime>/lib/asks.mjs").then(({ serializeAsk }) => {
  console.log(serializeAsk({
    producer: "<producer>",
    type: "<type>",
    subject: ["<path>", …],
    // annotations: "<advisory text>",   // optional
    // resumed_by: "run-resumer",        // only on a resumed pass
  }));
});'
```

On a serializer throw (empty subjects, fence-breaking annotations):
**surface the error verbatim and stop** — never hand-patch a block into
postable shape. There is no fingerprint to stamp and no emitter to run —
an ask attests nothing about content (§A.2's design fact).

## 3. Post: one comment per producer pass, append-only

Post **ONE new PR comment** carrying **all** the pass's ask blocks — one
block per produced type, batched (`adr-0019` applied to asks; spec-0003
§A.4). Use the platform comment API available in your environment
(`gh pr comment`, an MCP comment tool, …); prose around the blocks is
allowed — only the blocks are the records:

```
<details>
<summary>grove: review-ask — <producer> — N block(s) (<types…>)</summary>

[grove-review-ask block for type 1, verbatim]

[grove-review-ask block for type 2, verbatim]

</details>
```

- **Never edit a posted comment.** Admissibility is spec-0002 §A.4
  inherited whole: an edit rejects **every** block on the comment. A
  correction is always a **new** comment — and it can only **add**:
  effective ask types for a subject UNION across the stream, so a
  correction never shrinks obligations (§A.3).
- **Keep each block cleanly fenced** (its own opening
  ```` ```grove-review-ask ```` and closing ```` ``` ````) so an
  unterminated fence cannot end the next block early (spec-0002 §A.1).
- **Poster identity.** Post under the session's own authenticated
  identity — `OWNER`/`MEMBER`/`COLLABORATOR` is admissible by default;
  a bot/app identity needs the policy's `record_poster_allowlist`.
  Check before posting into rejection, and surface a mismatch rather
  than posting anyway.

## 4. Report

State what happened: "posted 1 ask comment, N block(s) for `<subjects>`",
or the no-op reason, or the error. During shadow the ask gates nothing —
the shipped check is byte-identical with or without it (spec-0003 INV1);
an unasked file falls to the residue, never to silence, so skipping the
ask is never a shortcut, only a convention break the comparator counts.

## Boundaries

- The caller stays CI-free: resolve every CI detail (install state,
  runtime path, serializer, comment API) inside this skill.
- Asks are **untargeted**: never name a reviewer — matching is emergent
  via the reviewers' `grove-review-declaration` types (spec-0003 INV6).
- Asks **add obligations, never remove them**; annotations are advisory
  input a reviewer may read, never instruction it follows (adr-0023 D3).
- Never type a subject against its frontmatter: a divergent ask type is
  inert for that file and flagged (§A.3 rule 2) — frontmatter wins,
  don't post around it.
- This skill posts ask records. It never reviews, never edits artifacts
  or records, never merges.
