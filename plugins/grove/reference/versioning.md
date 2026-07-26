<!-- GENERATED — DO NOT EDIT; canonical-source: charters/versioning.md; sha256: 73676aeeffab01972120b75ff64021b3de3b6bf22768a82212bf0644c3354bd0 -->

# versioning — conformance-detection semantics, stated once

> Provenance: created per `adr-0010-versioning-is-operational`
> (2026-07-12), which ruled versioning **operational content** — detection
> machinery for the sync principle (trellis's, mechanism-free), homed in
> grove. Origin decision: `trellis/decision-0045` (stays as the historical
> record; semantics evolve here). Canonical at `charters/versioning.md`,
> shipped in the plugin payload at `plugins/grove/reference/versioning.md`
> under the single version stamp (`adr-0026` D7 — no longer installed
> per-repo; a consuming repo cites it standard-form: *"per the grove
> versioning companion, `plugin@<stamp>`"*).

> **This file is not an agent role.** Like `lifecycle.md`, it has no
> pipeline stage and is never dispatched. It is the semantics statement
> the versioning-touching roles source — `contract-author` (stamping),
> `corpus-reviewer` (pin currency + the `changes:` cross-check),
> `validator` (version-bump drift triggers), `conformance-reviewer`
> (stale-pin re-checks) — instead of any per-repo restatement. Every
> other statement of these semantics, in grove or a consuming project,
> is a pointer to this file, never a copy.

> **Amended 2026-07-13** (`adr-0011-relations-companion`): the artifact
> **edge taxonomy** — which relations exist, and for each, whether it is
> *flow* (walked by directional-flow) and whether it *bears drift* —
> moved to a new sibling companion, `relations.md`. This file no longer
> defines any edge class (the `changes:` edge definition and the
> `depends_on`-class language formerly here are gone); it keeps version
> forms, the `@version` pin grammar, and the `changes:` cross-check, and
> points to `relations.md` wherever it names an edge.

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

`depends_on`'s edge class — coupling, flow, drift-bearing — is defined
in `relations.md` (`adr-0011`), not here; this section states only the
version qualifier a `depends_on` entry may carry.

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

## Test-dependency canary pins

A schema-2 test-dependency group's local spec entry is a last-reviewed target:
the landed `spec-id@vN` records the target version against which that group
last passed independent conformance review. It is a canary, never a verdict.
A lagging pin triggers re-derivation; an equal-current pin is quiet but proves
no conformance; an ahead-of-current, malformed, or unresolved local spec pin
is invalid. An append-only decision is named without a version.

The executor advances a candidate pin in the same change as the tests and any
implementation needed for the target. If executor re-derivation finds no
behavioral change is needed, it may instead propose a manifest-only candidate
pin. Neither kind self-validates: a separate independent conformance review
must derive obligations from the current approved spec, inspect and exercise
the implementation and tests, and return `PASS` before the candidate is
eligible to land. `FAIL` or `UPSTREAM-INDICTED` earns no pin.

A migrated coarse group's pin advances only after independent review of the
whole coarse scope — every discovered static declaration within all of its
file-only selectors. Reviewing and advancing an overlapping exact group does
not advance the coarse pin.

## The `changes:` relation and its cross-check

On a **significant-change decision** only: `changes:` lists the
versioned artifact(s) the decision changes, each pinned to the version
it set (`id@version` / `<repo>/<id>@version`).

- `changes:` is a relation defined in `relations.md` (`adr-0011`); its
  *version cross-check* is below.
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

- **Single home — for version mechanics, not edge classes.** No
  grove-managed repo — grove itself included — restates version
  forms/pins/cross-check semantics; every former restatement is a
  one-line pointer here (`adr-0010`). This file states **no** edge
  class (`depends_on`, `informed_by`, `superseded_by`, `changes:`) —
  that taxonomy's single home is `relations.md` (`adr-0011`); where this
  file names an edge, it points there. Trellis's spine contract keeps
  shape-only, methodology-defined clauses (the maintainer's Q1 ruling);
  the binding to this file happens through the plugin-carried copy at
  the consuming repo's pinned stamp (`adr-0026` D7).
- **Practices are the artifacts' own.** design-system cuts its git
  tags; the trellis payload stamps its content-hash — this file defines
  the *forms*, it does not operate anyone's release process.
- **Duties live in the role charters** (who does what, when); this file
  carries only what the duties mean.
