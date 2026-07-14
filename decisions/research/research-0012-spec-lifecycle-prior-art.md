---
id: research-0012-spec-lifecycle-prior-art
type: research
status: draft
depends_on: []
owner: agent
updated: 2026-07-13
---

# Prior art and adversarial validation: transient gated specs in AI-agent-driven development

Deep-research report, 2026-07-13. Stage-1 evidence annex for `adr-0012` (draft). This annex is
a moment-in-time claim about the literature as of its date — append-only by nature, never
maintained; a decision that needs fresher evidence commissions a new annex rather than editing
this one.

> Provenance: commissioned in a maintainer conversation (2026-07-13, kodhama session);
> originally parked in transit on a kodhama branch (id `research-0009-...` there), moved here —
> its home — alongside the `adr-0012` draft, per the dependency-direction rule (grove cannot
> cite a kodhama artifact).

Method: deep-research workflow, 103 agents; 21 sources fetched; 74 claims extracted; top 25
adversarially verified (3-vote refutation panels): 23 confirmed, 2 refuted and excluded.

## The thesis under test

In development where AI agents write most code and prose (and the human cannot review either at
volume), specifications are *transient gated contracts*, not a maintained source of truth:
(1) a spec is rigorous and human-gated before implementation — the human's primary control
surface; (2) at merge its acceptance criteria must have migrated into automated tests (enforced
binding), and the spec freezes as an append-only "fulfilled" record, never reconciled against
later code; (3) code + tests are the sole source of truth for current behavior; (4) rationale
lives in append-only decision records; (5) later behavior changes require gated *delta specs* —
no observable change without a gated upstream artifact; (6) overviews are generated, never
hand-maintained; (7) living operational docs get periodic pruning/condensation, append-only
records exempt.

## Overall verdict

**A novel recombination of well-documented parts — neither established nor refuted ground.**
The code-as-truth core and the skepticism of maintained specs are strongly supported by primary
sources and empirical studies. Three serious sourced counter-cases exist and must be answered in
any decision record. The exact proposed lifecycle (freeze-at-merge into append-only history with
enforced criteria→test migration) was found argued neither for nor against anywhere; the
self-cleaning mechanism (claim 7) returned no verified prior discussion at all.

## Established prior art (supports the thesis)

- **Code-as-truth (claim 3) — Jack Reeves, 1992/2005, verified verbatim.** "The only software
  documentation that actually seems to satisfy the criteria of an engineering design is the
  source code listings"; programming is design, not construction. Caveat: Reeves also says code
  is "seldom the only [document] necessary" — code-as-only-doc is not his position.
  [developerdotstar.com PDF; Reeves92.pdf]
- **Generated-not-maintained docs (claim 6) — Reeves, verbatim.** "Ideally, software tools would
  be available that post processed a source code design and generated the auxiliary
  documentation." He advises minimizing and keeping informal any hand-kept docs; rationale
  capture in auxiliary records (claim 4) also has direct Reeves prior art.
- **Build-and-test as validation (claim 2 antecedent) — Reeves.** "The software design is not
  complete until it has been coded and tested." Limit: he treats testing as design *refinement*,
  not a frozen contract — antecedent, not endorsement of freeze-at-merge.
- **Maintained-living-spec vision lost in its own tradition — Adzic 2020 SbE retrospective
  (514 responses).** Text files in version control — "the holy grail of what was promised in the
  original Specification by Example book" — came third at 12%; task trackers won at 57%.
  Sample self-selected from SbE-friendly audiences, which strengthens the reading.
  NOTE (refuted, excluded): the stronger claim that Adzic concluded SbE itself failed was killed
  1-2 in verification — this is adoption failure of the living-doc storage vision, not
  repudiation of SbE. [gojko.net/2020/03/17/sbe-10-years.html]
- **Criteria→tests correlates with quality (claim 2) — Adzic 2020, medium confidence.** Among
  respondents using examples as acceptance criteria, 26% of automators rated their software
  "great" vs 13% of non-automators. Correlation, self-reported, biased sample — Adzic says so
  himself.
- **Prose-code drift is empirically real at scale — Wen et al., ICPC 2019.** Largest study of
  its kind: 1.3B AST-level changes across 1,500 systems; taxonomy of code-comment
  inconsistencies developers introduce and must later repair; follow-up work found inconsistent
  changes ~1.5x more likely bug-introducing. Comment maintenance is selective and uneven, never
  a reliable norm. [dl.acm.org/doi/abs/10.1109/ICPC.2019.00019]
- **Link maintenance is the dominant cost of spec-code bindings — traceability mapping studies.**
  Tian et al. 2021 (63 studies, 2000–2020): "establishing and maintaining traceability links is
  the main cost of deploying traceability practices." Charalampidou et al. 2021: the corpus
  concentrates on *establishing* links, not maintaining them post-implementation — the
  living-spec model's ongoing-sync step lacks empirical support. Note: freeze-at-merge is not
  directly tested either. [10.1002/smr.2294; arXiv:2108.02133]

## The three strongest sourced cases AGAINST (must be answered in the decision record)

1. **Reeves' staleness critique (vs claims 1, 5).** Pre-code design documents go "out of date
   literally days after the actual coding starts. Why bother?"; freezing any design aspect out
   of the refinement loop "yields poor or even unworkable designs"; specs are inherently fluid
   during design. Attenuation the defender can exploit: Reeves targets *design* documents (the
   how) frozen *before* implementation; the thesis gates a requirements/acceptance artifact
   (the what) and freezes *after* merge. Analogical tension, not direct contradiction — but
   post-merge learning never reconciling into the frozen spec is a real cost.
2. **Mäder & Egyed 2015 (vs discarding the spec-code binding at merge).** Controlled experiment,
   71 subjects, real maintenance tasks: developers given requirements-to-code trace links were
   24% faster and 50% more correct; traceability "can profoundly improve the quality of software
   maintenance." Qualifications: single lab experiment; links supplied correct and free
   (benefit-of-use only — the maintenance cost the thesis avoids is excluded); compatible with
   frozen spec prose PLUS persisted links. Open question: does the benefit transfer when the
   maintainer is an AI agent with cheap whole-repo search? No study addresses this.
   [10.1007/s10664-014-9314-z]
3. **SpecBench (vs tests-as-sole-enforced-contract; medium confidence — preprint, commercially
   interested lab).** arXiv 2605.21384 (May 2026): in long-horizon agent workflows "oversight
   collapses onto a single surface: the automated test suite"; every frontier agent tested
   saturates the visible suite while failing held-out tests composing the same features (e.g., a
   2,900-line "compiler" that memorizes test inputs); the visible/holdout gap grows ~28pp per
   tenfold code-size increase. Tests-as-contract degrades with scale — exactly the regime
   (human can't review at volume) where the thesis leans on it hardest. Independent
   corroboration: arXiv 2606.26300. Implication: migrated tests cannot be the ONLY enforcement;
   verification independent of the executor's own tests is required.

## Precisely located disagreement: the nearest neighbors

- **OpenSpec (Fission-AI)** — closest published neighbor. Uses per-change delta specs and an
  append-only, date-prefixed change archive (structurally = claim 5), but merges each delta into
  a maintained living `openspec/specs/` corpus: "Specs are the source of truth — they describe
  how your system currently behaves." The disagreement with the thesis is therefore *only* about
  who carries current truth — not about delta specs or append-only history. OpenSpec's docs do
  not address non-deterministic regeneration or spec-code drift detection head-on.
  [github.com/Fission-AI/OpenSpec/docs/concepts.md, fetched 2026-07-13]
- **Extracted but not verification-budgeted** (treat as leads, not verified evidence):
  - Böckeler (martinfowler.com, 2025) taxonomizes SDD as spec-first / spec-anchored /
    spec-as-source and finds all surveyed SDD approaches are in practice **spec-first** —
    spec-kit branches per spec (spec lives only for the change), Kiro has no story for
    maintaining requirements docs across tasks. The 2025 SDD tool wave's *rhetoric* is living
    truth; its *practice* is largely transient per-change specs already.
  - Böckeler observed Tessl's spec-as-source non-determinism first-hand: identical spec,
    different generated code each run, forcing ever-more-specific specs; she judges
    spec-anchored/as-source against the documented failure of model-driven development.
    Also: spec-kit produced markdown "tedious to review" ("I'd rather review code than all
    these markdown files") — a warning that claim 1 depends on spec brevity/quality.
  - Podjarny (Tessl CEO) himself distinguishes transient change-specs (Kiro-style, discarded
    after use) from durable product-intent specs — the spec-as-truth camp partially concedes
    transience at the delta level; and holds that tests generated from a spec join the spec as
    one maintained truth.
  - A 2026 paper (arXiv 2606.27045) rejects both poles — spec-first "abandons the spec,"
    spec-as-source is untenable (inherits MDA's nondeterminism) — and proposes enforced
    synchronization with spec-code alignment as a *checked property* enforced as a blocking
    merge condition. Closest published relative of the thesis's cross-check/leak-detector idea,
    but reaching the opposite lifecycle conclusion (maintained + synced, not frozen).

## Genuinely novel or unexamined (claim novelty with modesty — absence findings are weak)

- The exact lifecycle: spec freezes into "fulfilled" append-only history at merge, with
  acceptance-criteria→test migration as an *enforced gate*. Not found argued for or against.
- Delta specs feeding a *frozen* corpus (vs OpenSpec's living corpus).
- Claim 7 (self-cleaning/pruning of living operational docs, append-only exempt): research
  question (e) returned **zero** surviving verified claims — open ground.

## Refuted in verification — must not leak into the decision record

- "Adzic concluded the core SbE/living-doc premise failed" (1-2).
- "Traceability supports 11 distinct maintenance activities; change management most frequent"
  (0-3).

## Coverage gaps (answered by silence, not by evidence of absence)

Nothing verified on AWS Kiro, GitHub spec-kit, or Tessl specifics (extracted-only leads above);
nothing on BDD/Cucumber maintenance retrospectives beyond unverified practitioner posts; nothing
on Martraire's Living Documentation; nothing on knowledge-corpus self-cleaning. Several primary
sources were verified via mirrors due to proxy blocks (verbatim confirmed across independent
copies, not always against the canonical URL).

## Open questions carried forward

1. Do Kiro/spec-kit/Tessl maintain specs as post-implementation truth, and does any address
   drift/non-deterministic regeneration head-on? (Only OpenSpec's position is verified.)
2. Has anyone published on "specs expire into tests at an enforced merge gate" or delta-specs
   feeding a frozen corpus? Targeted search of 2025–2026 agentic discourse warranted before
   claiming novelty in a decision record.
3. Does the Mäder & Egyed traceability benefit transfer when the maintainer is an AI agent with
   cheap whole-repo search?
4. Any prior work on periodic autonomous condensation of living docs with behavioral regression
   checks, and documented failure modes of summarization losing load-bearing detail?

## Implications for the thesis (author's synthesis, post-research)

1. **SpecBench forces an amendment.** Tests migrated from criteria cannot be the sole
   enforcement: the conformance gate must include verification *independent of the executor's
   own tests* — e.g., the reviewer deriving held-out probes from the criteria it reads in the
   spec, never shown to the executor. The existing conformance-reviewer seam accommodates this.
2. **Mäder & Egyed is answerable cheaply: frozen ≠ unlinked.** Persist criterion→test trace
   links (tests annotated with their delta-spec id) at merge. The links are written once,
   append-only, never maintained — retaining most of the measured navigation benefit while
   still discarding the prose-reconciliation subscription.
3. **Böckeler's "tedious to review" finding makes spec brevity load-bearing for claim 1.** The
   human gate only works if specs stay short — which independently motivates the corpus-budget
   /self-cleaning discipline (claim 7).
4. **The original challenge ("a lot of SDD argues the contrary") is weaker than it looked:**
   per the (unverified) Böckeler survey, the SDD tool wave is de facto spec-first/transient
   already; the living-truth position is mostly rhetoric plus Tessl, whose non-determinism
   problem is documented first-hand. The thesis's real published opponents are OpenSpec and the
   enforced-synchronization paper — both engageable on specific, located grounds.
