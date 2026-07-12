---
id: adr-0010-versioning-is-operational
type: adr
status: gated  # self-checked by author 2026-07-12, revised after adversary round 1; the maintainer's intent act is the gate to approved
depends_on: [adr-0006-operational-conformance-mechanism, adr-0008-lifecycle-enum-companion, trellis/decision-0045, kodhama/kodhama-0008-family-inheritance-restate-nothing]
owner: agent
updated: 2026-07-12
provenance: shaped from the maintainer's call on trellis#149 (2026-07-12) — "versioning is not a principle … the principle is just making sure [artifacts] are in sync; whatever mechanism is used is not relevant," plus the follow-up constraint "trellis only has the ADR [decision-0045] and no reflection of that ADR in trellis actual content." Adversary round 1 (independent, same day) — NEEDS-REVISION, eight drafting-level findings (both inventories incomplete; "form-follows-kind" slogan 0045 had retracted; pointer/forward-pointer mechanics unspecified; AC3 unverifiable; two citation slips), all folded; premise held on attack. DRAFT-gated — the maintainer's approval (a human intent act, per charters/lifecycle.md) is pending.
---

# ADR-0010: versioning is operational content — grove homes its semantics, in a shipped companion

## Context

The family layering is now ratified (kodhama-0008 §3): trellis carries principles, grove carries the operating model — mechanics included. The **principle** behind versioning is one trellis already states, mechanism-free: dependents stay in sync with the upstreams that govern them ("when you change something, update everything that depends on it"; "build only on settled ground"). **Versioning is detection machinery for that principle** — counters, `@version` pins, the `changes:` relation, cross-checks — the same relation "merge" bears to the approval principle, and the enum bore to the lifecycle. It is mechanics, so it is grove's.

History put it elsewhere: `trellis/decision-0045` defined the primitive (two kinds; the form fits what "conform" means for the artifact; the significance counter; pin shape), and its execution wrote the full grammar into trellis's **spine contract** (`spec-0001` §1 `version`/`changes` rows + the pin-grammar block, §2's stamping-is-kind-not-lifecycle note, §3 checks 4/5/8) and rubric (checks 4/5 clauses + check 12). That home was an artifact of where the work happened, pre-layering — grove's `adr-0006` ("versioning-as-proxy") already operationalized the living half here. The maintainer has now ruled the layer call.

## Decision

1. **Versioning semantics are grove's, going forward.** `trellis/decision-0045` stays as the origin record — its decision content (the kinds, the counter, the pin) remains true and un-superseded. What IS superseded-in-part: its **execution-home consequences** — the clauses that placed the grammar in trellis's spine contract. Mechanism (the only touch trellis's contract permits on a ratified decision): 0045 gains `superseded_in_part_by: [grove/adr-0010]` scoped to those consequence clauses, each carrying its per-clause forward pointer; no other text edited. Future versioning evolution happens in grove decisions.

2. **A dedicated companion: `charters/versioning.md`** — the second file of the `.grove/` axis pattern (adr-0008; one file per config axis, propagated verbatim). Canonical beside the charters, vendored to `plugins/grove/reference/versioning.md`, installed by setup to each consumer's `.grove/versioning.md` (one added copy line, the lifecycle precedent). It states, once, the full grammar — nothing may be orphaned by the trellis de-reflection:
   - the **two versioning kinds** (append-only/implicit via id + supersession vs versioned/explicit via a `version` marker);
   - the **form rule as 0045 actually states it**: the form **fits what "conform" means** for the artifact — a spectrum, **not a two-way function of kind** (behavioral spec → agent-judged significance counter `vN`, review-bounded, testable-clause changes bump it; vendored/byte-identical bundle → content-hash; human-cut release → git tag);
   - the **presence rule**: `version` required on a versioned artifact that downstreams pin; omitted by append-only artifacts; **not gate-enforced at v0** (pre-existing unstamped specs don't retroactively fail — presence matters once a pin needs it);
   - the **`@version` pin grammar**: `id@version` / `<repo>/<id>@version`; the **collision-safety constraints** that make it parse (repo names and ids carry no `@`; version markers no `/` or `@`) and the **first-`/`-then-`@` parse rule**; the **category error** (an `@version` pin on an append-only artifact); the **no-fetch resolution depth** (strip `@version`, resolve the bare id; pin-vs-current sync comparison is the conformance chain's, adr-0006);
   - the **`changes:` relation**: a forward-pointer of the `superseded_by` class, never a `depends_on` edge, never walked as a flow edge; its **cross-check semantics** (hard FAIL = a declared change that never landed; a bump with no accounting decision is soft, never a hard FAIL);
   - the **counter-initialization rule** (an artifact predating the counter gets `version: 1` at its first significant change, forward-only, history never back-filled or retro-judged — the *duty* form stays in `contract-author` step 4; the companion carries the *meaning*).

3. **Roles source versioning semantics from the companion** — `corpus-reviewer` (pin currency), `validator` (version-bump drift trigger), `conformance-reviewer` (stale-pin re-check), `contract-author` (stamping duty) — pointer edits riding the three-copy sync. No charter restates the grammar.

4. **trellis de-reflects — the complete inventory** (in-place amendments with delta notes, trellis-native): spec-0001 §1's `version` + `changes` rows and the pin-grammar block; §2's "stamping is a property of kind, not lifecycle state" note; §3 check 4's `@version` half, check 5's `changes:`-edge-typing clause, check 8 entire; rubric checks 4 (`@version` resolution sentence) and 5 (`changes:` clause) and check 12 entire. **Residual surface — RULED (maintainer, 2026-07-12, ex parked Q1):** the `decision-0037` "methodology-defined" pattern trellis already uses for `status`: the contract keeps *shape-only* statements ("a versioned artifact carries a `version` marker; pins may qualify a referent; forms and bump semantics are **methodology-defined**") — buyer-neutral (no kodhama-family product named inside the portable contract; the binding to grove's companion happens through the installed `.grove/versioning.md`, exactly as `status` binds through the installed lifecycle companion).

5. **No repo restates versioning semantics** — the same single-home rule as the enum (adr-0008) and the approval mechanic (kodhama-0008 rollout). Practices are unaffected: design-system keeps cutting git tags, the trellis payload keeps its content-hash stamp — those are the artifacts' own truth; the companion is where the *forms* are defined.

## Considered and rejected

- **Amend or relocate decision-0045's content** — append-only; history stays where it happened. (Supersession-in-part of its *home* consequences is the sanctioned instrument, item 1.)
- **Grove owns duties, trellis keeps the definition** (the status quo) — leaves mechanics defined on the principles layer; exactly the split kodhama-0008 removed for the approval mechanic and adr-0008 removed for the enum.
- **kodhama-meta states it** — the meta layer defines no mechanics (kodhama-0008 §§2–3).
- **Fold into `charters/lifecycle.md`** — different config axis (state machine vs conformance detection); the `.grove/` layout precedent is one file per axis.
- **Hard-wiring "grove" into the spine contract's residual rows** — rejected in favor of item 4's methodology-defined shape: the contract is portable and buyer-neutral; naming a family product inside it would re-create directional coupling the family's strictly-downward rule forbids.

## Consequences (ordered — the companion ships first)

1. `charters/versioning.md` created (canonical), vendored, + one setup copy line (`reference/versioning.md` → `.grove/versioning.md`); charter pointer edits (item 3) across the three-copy sync; **and — per the maintainer's Q2 ruling — the same PR adds the `changes:` cross-check as a named duty** (`corpus-reviewer`/`validator`), so the check has an explicit grove owner from the companion's first day. **This lands before any trellis de-reflection.**
2. trellis receives `.grove/versioning.md` via the converge-lane grove refresh (wave-0008 brief) — the same companion-ships-first ordering adr-0008 Consequence 6 named for the enum. **Only then** the trellis-side PR: the item-4 de-reflection + the 0045 supersession-in-part marks; its own conformance gate; trellis's checks stay runnable throughout (shape checks native, semantics sourced from the installed companion).
3. Until Consequence 2 lands, the `changes:` cross-check (old check 8 / rubric 12) remains defined by trellis's current text — **no interim coverage hole**; the de-reflection and the re-sourcing happen in the same PR.
4. kodhama wave ledger updated; kodhama#31 program record notes the re-homing. **This ADR also closes the wave brief's parked question** ("the decision-0045 twin of the counter-initialization rule — in the primitive too, or grove-only?"): answered **grove-only, by construction** — the rule's meaning rides the companion, its duty rides contract-author; nothing lands in 0045 beyond the item-1 supersession marks.

## Acceptance criteria

- **AC1** The companion exists, ships, and is the only place the versioning grammar is stated; every grammar element in item 2's inventory is present in it; every other statement (grove charters, trellis living content) is a pointer or a shape-only methodology-defined clause.
- **AC2** decision-0045 carries the scoped `superseded_in_part_by: [grove/adr-0010]` + per-clause pointers on its execution-home consequences only; its decision content untouched. After the trellis-side PR, no trellis living surface defines versioning semantics (the item-4 inventory is exhaustive — verified by a repo grep for `0045`/`@version`/counter language, historical self-check rows exempt).
- **AC3** The four roles source the companion. Verification: trellis's CI guards (`ratify-guard`, cli tests) stay green on the trellis PR; grove's three-copy sync verified + independent conformance review on the grove PR (grove has no CI — stated, not assumed).

## Open questions (all resolved pre-gate, 2026-07-12)

- **Q1 — residual spine-contract surface — RULED:** shape-only methodology-defined rows (item 4), not full row deletion. Maintainer's answer, recorded per-question on PR grove#50.
- **Q2 — check re-homing cadence — RULED:** the `changes:` cross-check duty lands **in the same PR as the companion** (Consequence 1), so ownership is explicit from day one.
- *(naming: `versioning.md` stands per the one-file-per-axis precedent — no objection raised at the gate.)*

## Self-check (gate)

Shaped from a recorded maintainer ruling (trellis#149 conversation, quoted in provenance); mirrors adr-0008 (the direct precedent) with the same single-home + pointer discipline + companion-ships-first ordering. Adversary round 1 (independent): NEEDS-REVISION — F1 de-reflection inventory incomplete (four missed reflections: §3 check 5 clause, §2 stamping note, rubric 4/5 clauses — now in item 4); F2 companion inventory would orphan grammar (presence rule, category error, no-fetch depth, collision constraints — now in item 2); F3 "form-follows-kind" was a retracted framing (corrected to 0045's "form fits what conform means"); F4 pointer target/ordering unspecified (now Consequences 1–3); F5 forward-pointer mechanism undefined (now item 1: scoped supersession-in-part); F6 methodology-defined alternative unconsidered (now item 4 + rejected-list entry); F7 AC3 unverifiable (grove has no CI — rescoped); F8 citation + parked-item bookkeeping (fixed; Consequence 4 closes the wave brief's 0045-twin question explicitly). All folded; premise, 0045-faithfulness, role duties, setup mechanism, and dependency hygiene held on attack. Both parked questions were then put to the maintainer explicitly and ruled (Q1 shape-only rows; Q2 same-PR duty) — folded above, so nothing reaches the gate unresolved. Depends only on approved artifacts; append-only preserved. `gated` — approval is the maintainer's intent act, recorded per `charters/lifecycle.md`, not this author's.
