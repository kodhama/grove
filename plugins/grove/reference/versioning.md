<!-- vendored from ../../charters/versioning.md — the repo's canonical copy; keep in sync -->
---
id: charter-versioning
type: charter
status: gated  # self-checked by author 2026-07-12; the maintainer's intent act on the shipping PR is the gate to approved
depends_on: [adr-0010-versioning-is-operational]
owner: agent
updated: 2026-07-12
---

# versioning — conformance-detection semantics, stated once

> Provenance: created per `adr-0010-versioning-is-operational`
> (2026-07-12), which ruled versioning **operational content** — detection
> machinery for the sync principle (trellis's, mechanism-free), homed in
> grove. Origin decision: `trellis/decision-0045` (stays as the historical
> record; semantics evolve here). Canonical at `charters/versioning.md`,
> vendored to `plugins/grove/reference/versioning.md`, installed by
> `/grove:setup` to each consuming project's `.grove/versioning.md`
> (grove's inert namespace — the `adr-0008` axis pattern, one file per
> config axis).

> **This file is not an agent role.** Like `lifecycle.md`, it has no
> pipeline stage and is never dispatched. It is the semantics statement
> the versioning-touching roles source — `contract-author` (stamping),
> `corpus-reviewer` (pin currency + the `changes:` cross-check),
> `validator` (version-bump drift triggers), `conformance-reviewer`
> (stale-pin re-checks) — instead of any per-repo restatement. Every
> other statement of these semantics, in grove or a consuming project,
> is a pointer to this file, never a copy.

## The two versioning kinds

Every artifact versions in exactly one of two ways:

- **Append-only / implicit** (decisions and kin): the `id` alone pins a
  unique, never-edited text; versioning happens through supersession
  (`superseded_by` / `superseded_in_part_by` forward pointers). No
  `version` marker — pinning one with `@version` is a **category
  error**.
- **Versioned / revise-in-place** (specs and kin): the artifact is
  edited in place as current truth, so its `id` alone does not identify
  a state — it carries an explicit **`version` marker**.

## The form rule — the form fits what "conform" means

The version form is **not a two-way function of kind** — it is a
spectrum: the form fits **what "conform to this artifact" means** for
its consumers:

- **behavioral spec** → an agent-judged **significance counter**
  (`v1`, `v2`, …): a testable-clause (scenario/invariant) change bumps
  it; a prose-only edit does not. It is a review-bounded **claim**, not
  a "can't-lie" derivation — significance is judgment, checked at
  review, not computed.
- **vendored / byte-identical bundle** → a **content-hash** (e.g.
  `payload@<12-hex>`): conformance is byte identity.
- **human-cut release** → a **git tag** (`vX.Y.Z`): conformance is
  "built against that release."

**Presence rule:** `version` is **required** on a versioned artifact
that downstreams pin; **omitted** by append-only artifacts. Presence is
**not gate-enforced at v0** — a versioned artifact predating its stamp
does not retroactively fail; presence starts mattering when a
`@version` pin needs it.

**Counter initialization (the maintainer's rule, 2026-07-12):** an
artifact that needs a counter and carries none gets it **initialized in
the same edit** that first significantly changes it — `version: 1`,
naming the artifact's post-change state. The counter is **forward-only
from materialization**: uncounted history stays unpinnable; old edits
are never back-filled or retro-judged for significance. (The writer
duty lives in `contract-author`; this is the meaning.)

## The `@version` pin grammar

A `depends_on` entry pinning a **versioned** upstream may qualify the
referent with the version it was built against:

- **`id@version`** locally (e.g. `spec-mastery-engine@v3`);
- **`<repo>/<id>@version`** cross-repo (e.g.
  `math-quest/spec-slice-01-first-loop@v3`) — extending the qualified
  `<repo>/<id>` form (`trellis/decision-0044`).

The `<version>` is whatever form fits the upstream (a counter `vN`, a
tag `vX.Y.Z`, a hex hash). **Collision safety:** repo names and ids
carry no `@`; version markers carry no `/` and no `@` — so **split on
the first `/`, then on `@`** recovers `<repo>`, `<id>`, `<version>`
unambiguously. A `@version` pin on an **append-only** artifact is a
category error (it has no marker to pin).

**Resolution depth (no-fetch):** a pin is checked on **shape +
referent existence** — strip `@version`, resolve the bare id. The
pinned-version-vs-current **sync comparison** is the conformance
chain's (`adr-0006`: `validator` flags pin lag on a version-bump
trigger; `conformance-reviewer` re-derives against current).

## The `changes:` relation and its cross-check

On a **significant-change decision** only: `changes:` lists the
versioned artifact(s) the decision changes, each pinned to the version
it set (`id@version` / `<repo>/<id>@version`).

- It is a **forward-pointer relation of the `superseded_by` class —
  never a `depends_on`-class edge**, and never walked as a flow edge (a
  decision depending on X while its `changes:` names X is a benign
  two-relation pair, not a cycle).
- **Cross-check semantics** (scope: counter-versioned artifacts only —
  the ordered `vN` form; hashes have no ordering, tags are the sync
  check's): reconcile `changes: [X@vN]` against `X`'s version
  **record**, not `declared == current` — an append-only decision's
  `@vN` legitimately sits behind a later bump. **Hard FAIL = a declared
  change that never landed** (`X`'s current counter is behind `vN`).
  The reverse — a bump in `X` with no accounting `changes:` decision —
  is **soft, never a hard FAIL** (whether every significant change must
  flow from a decision is an unsettled question, recorded in
  `trellis/decision-0045`).

## Boundaries

- **Single home.** No grove-managed repo — grove itself included —
  restates these semantics; every former restatement is a one-line
  pointer here (`adr-0010`). Trellis's spine contract keeps shape-only,
  methodology-defined clauses (the maintainer's Q1 ruling); the binding
  to this file happens through the installed `.grove/versioning.md`.
- **Practices are the artifacts' own.** design-system cuts its git
  tags; the trellis payload stamps its content-hash — this file defines
  the *forms*, it does not operate anyone's release process.
- **Duties live in the role charters** (who does what, when); this file
  carries only what the duties mean.
