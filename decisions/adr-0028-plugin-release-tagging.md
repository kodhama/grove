---
id: adr-0028-plugin-release-tagging
type: adr
status: draft  # drafted 2026-07-22 from the settled in-session shaping with the maintainer; NOT ratified — awaits decision-adversary, then the human intent gate (profile: intent = human). The flip to approved records the maintainer's act; this draft does not perform it.
depends_on: [adr-0026-thin-vendor-boundary, charter-versioning]
informed_by: [adr-0027-retire-ci-for-now, adr-0010-versioning-is-operational]
owner: agent
updated: 2026-07-22
---

# ADR-0028: grove's plugin release-tagging — manifest-authoritative version, human-cut by merge, deterministic tag

Operationalizes `adr-0026` D4 (versioned releases + the stamp as record).
D4 named the valve — "explicit plugin versioning (the `plugin.json`
`version` field / release tags)" — without settling *how* the tag is cut,
who cuts it, and what stays authoritative. This decision settles that as
grove's own **release practice** (which `charters/versioning.md` explicitly
delegates to each artifact: "practices are the artifacts' own … this file
defines the *forms*, it does not operate anyone's release process").

## Decision state

### Decided

- **D1 — `plugin.json`'s `version` is the single source of truth; the tag
  derives from it, never the reverse** *(maintainer, 2026-07-22)*. The
  marketplace resolves grove by tracking `main` and reading
  `plugins/grove/.claude-plugin/plugin.json` (version-resolution order:
  the manifest `version` first). So the manifest **is already** what
  consumers install from — the git tag, the consumer's `grove plugin@<v>`
  CLAUDE.md stamp, and the changelog all **derive** from it. The reverse
  direction (a git tag drives a build that stamps the manifest) is
  **rejected as circular** for an in-repo manifest: the tag must point at a
  commit, but stamping the version *creates* a new commit, so the tag is
  always one commit behind the state it names. Authority lives where the
  value is read.

- **D2 — the version form is `versioning.md`'s "human-cut release → git
  tag"; the human-cut IS the merge of the version-bump PR** *(maintainer,
  2026-07-22)*. The plugin versions as a **human-cut release** (a git tag
  `grove-vX.Y.Z`), not a significance counter or a content hash. The
  "human-cut" act is the maintainer **approving and merging the PR that
  bumps `plugin.json`** — that merge is where judgment (the level) and the
  human gate both happen (adr-0026 D4: "bumped only by PR … the PR is where
  a fleet update gets its in-repo review seam … links the release
  changelog"). This **resolves the doctrine question** the practice raised:
  "human-cut" names the *release boundary a human owns*, not a requirement
  that a human type `git tag`. The tag is the deterministic materialization
  of a release the human has **already** cut.

- **D3 — the bump *level* is agent-proposed in the bump PR, human-approved
  at merge; `validator` backstops** *(maintainer, 2026-07-22)*. The semver
  level for a prose-charter fleet has no compiler to derive it — it is
  judgment. The authoring agent **proposes** the level in the bump PR by
  the consumer-observable magnitude of change:
  - **patch** — wording / clarity / provenance; no role's behavior changes;
  - **minor** — a new capability or a meaningfully changed role behavior
    (and, while pre-`1.0` at `0.x`, a breaking change rides the minor slot
    by semver convention);
  - **major** — reserved for post-`1.0` breaking changes.

  `validator`'s existing **"version-bump drift trigger"** (versioning.md)
  covers the manifest: a fleet-changing PR that ships a behavior change with
  **no** `plugin.json` bump is flagged. The human's bookkeeping stays at
  **zero** — the agent proposes, the human ratifies the level by merging.

- **D4 — the tag is materialized by a deterministic, idempotent CI job in
  grove's own `.github/`, in its OWN workflow** *(maintainer, 2026-07-22)*.
  On push to `main` (path-filtered to the manifest), a job creates
  `grove-v<version>` **iff that tag does not already exist**. Properties:
  **idempotent** (`tag = f(manifest)`; re-runs no-op; if CI ever misses a
  bump, the next push re-checks and tags — self-healing); **tag-only** (no
  PR, no Release object, no gate — it **blocks nothing**); **zero-judgment**
  (the judgment already happened upstream, D3). It lives in a dedicated
  `release-tag.yml`, **not** folded into `grove-tests.yml`, because it has a
  **different trigger** (push-to-`main`-only vs PR+push), a **different
  permission** (`contents: write` vs `read` — isolated and auditable), and a
  **different concern** (release vs test). "Minimal surface" was the only
  argument for folding in, and it is outweighed once CI-for-this is settled.

### Why this is consistent with adr-0027, not a reversal of it

`adr-0027` retired the review-bookkeeping **check** because it was a
*judgment-coupled, adoption-dependent gate that blocked nothing and
generated noise*, and it objected to *coupling that CI to the plugin/setup
skill*. It did **not** retire CI-as-a-mechanism: D4's own revival path is CI
(GitHub Actions + a provider-agnostic `install.sh`), and PR #121 **kept**
`grove-tests.yml` through the very retirement. The tag job shares **none**
of the check's failure modes — it is deterministic, judgment-free,
adoption-independent, blocks nothing *by design*, lives in grove's own repo
(never the plugin payload), and its always-fires property is a *feature*
(the manual alternative is the forgettable one). grove's live posture is
**"no judgment-coupled CI that blocks nothing; deterministic mechanical CI
stays"** — the tag job is on the "stays" side.

### Parked

- **A GitHub Release object (with notes) and a marketplace release-channel
  that pins a tag** — both are plausible futures the tag anchor *enables*,
  neither is built here. The marketplace tracks `main`; **nothing consumes
  the tag yet** (`inv-minimal-first`). The tag has standalone value now
  (navigable releases; `git checkout grove-v0.1.0`), and the anchor exists
  from `0.1.0` forward instead of being retrofitted.

## Given (inherited — cited, not reopened)

- **adr-0026 D4**: versioned releases + the stamp as record + loud mismatch,
  disclosed as skew. This decision operationalizes that valve; it does not
  reopen it.
- **charters/versioning.md**: the **"human-cut release → git tag"** form,
  and the boundary — "practices are the artifacts' own … this file defines
  the forms, it does not operate anyone's release process." So this ADR
  defines grove's plugin release **practice** and **does not amend**
  versioning.md's forms.
- **adr-0027 D4**: the check "never needed Claude — it runs in GitHub
  Actions"; deterministic mechanical work belongs in Actions. `grove-tests.yml`
  kept through the retirement.

## Honest costs (surfaced, not buried)

1. **First write-capable workflow.** `grove-tests.yml` is `contents: read`;
   the tag job needs `contents: write` (the default `GITHUB_TOKEN` suffices —
   no PAT). A new privilege surface in a repo that kept CI strictly
   read-only — isolated in its own file to keep the boundary auditable.
2. **Timing against "a break from the CI adventure" (adr-0027).** Adding a
   workflow days after a deliberate CI retirement cuts against the
   maintainer's stated mood. Named, not hidden; resolved by the distinction
   (judgment-gate retired vs deterministic materializer added) and ratified
   at the intent gate, not slipped in.
3. **Mechanism ahead of its consumer.** Nothing pins the tag yet. Counter:
   standalone navigability value now, ~20 lines of YAML, and the anchor
   exists from `0.1.0`.
4. **The bump level is judgment, so it can be misjudged.** But it is off the
   human (agent proposes, human ratifies at merge), `validator` backstops,
   and a wrong level is **disclosed skew** (the adr-0026 D4 idiom), not
   breakage.

## Rejected options

- **Tag-authoritative** (a git tag drives a build that stamps `plugin.json`):
  **rejected** — circular for an in-repo manifest (D1).
- **Fold the tag job into `grove-tests.yml`**: **rejected** — different
  trigger, permission, and concern; folding forces per-job `if:` /
  `permissions:` gymnastics that are *more* complexity than a dedicated
  ~20-line file (D4).
- **A manual `/grove:release` skill, or a git hook**, as the primary
  mechanism: **rejected** — a must-not-be-forgotten side-effect is exactly
  what a human-triggered step fails at (re-imports adr-0012's "the
  principles were loaded and did not fire"); a local git hook does not fire
  at all for a merge performed in the GitHub UI. Retained only as a
  **fallback** if CI is ever barred.
- **SHA-only versioning** (drop the `version` field): **rejected** — it
  reverses adr-0026 D4 (explicit versioning, PR-bumped, changelog-linked),
  kills the review seam, and makes the role-start mismatch disclosure noise.

## Consequences / propagation (land at approval, tracked not silent)

1. **New file `release-tag.yml`** (implementation — executor, post-approval;
   this decision does not ride a build). Its shape:

   ```yaml
   name: release-tag
   on:
     push:
       branches: [main]
       paths: ['plugins/grove/.claude-plugin/plugin.json']
   permissions:
     contents: write
   jobs:
     tag:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@<pinned>
         - run: |
             v=$(node -p "require('./plugins/grove/.claude-plugin/plugin.json').version")
             tag="grove-v$v"
             if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
               echo "$tag exists — no-op"; exit 0
             fi
             git tag "$tag" && git push origin "$tag"
   ```

2. **One-time seed.** `plugin.json` is at `0.1.0` on `main` now with **no
   tag** (that bump landed in #121, before this workflow exists). Hand-cut
   `grove-v0.1.0` once; the workflow takes over from `0.2.0`.
3. **`validator`'s "version-bump drift trigger" remit** now explicitly
   covers the plugin manifest version (executor to confirm the remit already
   generalizes; a one-line pointer if not).
4. **adr-0026 D4** gains an **append-only** pointer: "release practice
   operationalized by adr-0028." No in-place edit.
5. **charters/versioning.md** is **not** amended; it *may* gain a one-line
   pointer noting grove's plugin cuts its tag via adr-0028's CI job, parallel
   to its existing "design-system cuts its git tags" example (optional,
   executor's call).

## Acceptance criteria (for this decision's landing)

- **AC1**: adr-0028 `approved` by the maintainer's intent act (profile:
  `intent = human`), with a decision-adversary verdict on record first.
- **AC2**: no ratified artifact edited in place — the adr-0026 D4 pointer is
  append-only.
- **AC3**: the implementation (`release-tag.yml` + the `grove-v0.1.0` seed +
  any `validator` pointer) is **its own reviewed step**, not ridden on this
  decision.

## Self-check (gate → `gated`)

- **Builds on settled ground** — adr-0026 D4 (approved), charters/versioning.md
  (approved). ✓
- **No contradiction with standing decisions** — reconciled with adr-0027
  (deterministic-CI-stays posture, cited above). ✓
- **Internally coherent** — authority (D1), the human act (D2), the judgment
  locus (D3), and the mechanism (D4) compose without gap. ✓
- **Minimal** — one dedicated ~20-line workflow; no Release object, no
  channel, no versioning.md amendment (all parked/deferred). ✓
- **Honest costs surfaced** — the write permission, the timing, the
  ahead-of-consumer build, the judgment risk. ✓
