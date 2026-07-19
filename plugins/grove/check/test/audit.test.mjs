// Upstream: spec-0003 §B (the two residues: coverage residue `diff_files ∖
// ask_covered_files`, judgment residue = in-jurisdiction ∖ ask-resolved ∖
// frontmatter-typed; §B.2 residue-conditional rule), §C.1 (grove-audit
// schema: auditor, coverage-residue manifest with per-path hashes, content/
// policy fingerprints, record_hwm with the empty-stream sentinel 0, flagged,
// {owed, why} dispositions), §C.2 (adr-0015 judgment/stamp split — the
// emitter stamps every binding), §C.3 (freshness: content fp, policy fp,
// typed-HWM with exact-tag semantics), §C.4 (auditor separation incl.
// resumed_by dual attribution), §C.5 (vacuity one level up).
// INV1, INV9–INV15; S4, S6–S10, S12. adr-0023 D4 (phase 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAuditBlocks,
  parseAuditComment,
  coverageResidue,
  judgmentResidue,
  auditOwed,
  policyCarriers,
  typedRecordHwm,
  auditFreshness,
  separationSet,
  checkAuditAdmissibility,
  dispositionCoverage,
  serializeAudit,
  emitAudit,
} from '../lib/audit.mjs';
import { parseComment, extractVerdictBlocks } from '../lib/records.mjs';
import { parseAskComment } from '../lib/asks.mjs';
import { groveFp1, pathHashAt } from '../lib/fingerprint.mjs';

// --- fixtures ---

const FP_A = '"grove-fp-1:' + 'a'.repeat(64) + '"';
const FP_B = '"grove-fp-1:' + 'b'.repeat(64) + '"';

// Build a grove-audit block body. Values are raw YAML fragments: a scalar is
// emitted inline; a value starting with '\n' is a nested block; '' emits a
// bare key (the empty-map form the serializer uses).
const auditBody = (over = {}) => {
  const rec = {
    schema: 1,
    auditor: 'auditor',
    coverage_residue: '\n  assets/social-preview.png: ' + 'c'.repeat(64),
    content_fingerprint: FP_A,
    policy_fingerprint: FP_B,
    record_hwm: 0,
    flagged: '[]',
    dispositions:
      '\n  assets/social-preview.png:\n    owed: []\n    why: |\n      binary asset; no declaration claims it; stating none owed',
    ...over,
  };
  const lines = Object.entries(rec)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const s = String(v);
      if (s === '') return `${k}:`;
      return s.startsWith('\n') ? `${k}:${s}` : `${k}: ${s}`;
    });
  return '```grove-audit\n' + lines.join('\n') + '\n```';
};

const comment = (over = {}) => ({
  id: 1,
  body: auditBody(),
  author: 'agent-a',
  authorAssociation: 'MEMBER',
  createdAt: '2026-07-19T00:00:00Z',
  updatedAt: '2026-07-19T00:00:00Z',
  ...over,
});

const askBlock = ({ producer = 'executor', type = 'code', subject = '[lib/a.mjs]', resumed_by } = {}) =>
  '```grove-review-ask\nschema: 1\nproducer: ' + producer + '\ntype: ' + type +
  '\nsubject: ' + subject + (resumed_by ? '\nresumed_by: ' + resumed_by : '') + '\n```';

const verdictBlock = ({ producer = 'executor', reviewer = 'agent-b' } = {}) =>
  '```grove-verdict\nschema: 1\nreview: conformance\nverdict: PASS\nsubject: [specs/foo.md]\n' +
  'manifest_hashes:\n  specs/foo.md: abc\nfingerprint: grove-fp-1:' + 'a'.repeat(64) + '\n' +
  `producer: ${producer}\nreviewer: ${reviewer}\nfindings: ok\n` + '```';

const parsedAsks = (body, commentId = 1) =>
  parseAskComment({ body })
    .blocks.filter((b) => b.status === 'record')
    .map((b) => ({ record: b.record, commentId }));

const firstAudit = (body) => parseAuditComment({ body }).blocks[0];

// --- parse / validate (§C.1; carrier identical to §A.1) ---

test('a prose-only comment carries no audit blocks (none)', () => {
  assert.deepEqual(extractAuditBlocks('nothing to see'), []);
  assert.equal(parseAuditComment(comment({ body: 'just prose' })).status, 'none');
});

test('parses a schema-valid audit record with every §C.1 field', () => {
  const parsed = parseAuditComment(comment());
  assert.equal(parsed.status, 'multi');
  assert.equal(parsed.blocks[0].status, 'record');
  const rec = parsed.blocks[0].record;
  assert.equal(rec.auditor, 'auditor');
  assert.deepEqual(rec.coverage_residue, { 'assets/social-preview.png': 'c'.repeat(64) });
  assert.equal(rec.content_fingerprint, 'grove-fp-1:' + 'a'.repeat(64));
  assert.equal(rec.policy_fingerprint, 'grove-fp-1:' + 'b'.repeat(64));
  assert.equal(rec.record_hwm, 0); // the empty-stream sentinel is schema-valid (§C.1, F2)
  assert.deepEqual(rec.flagged, []);
  assert.deepEqual(rec.dispositions['assets/social-preview.png'].owed, []);
  assert.match(rec.dispositions['assets/social-preview.png'].why, /stating none owed/);
});

test('schema absent or !== 1 => inert (fail-closed by non-recognition, §C.1)', () => {
  assert.equal(firstAudit(auditBody({ schema: undefined })).status, 'inert');
  assert.equal(firstAudit(auditBody({ schema: 2 })).status, 'inert');
});

test('missing auditor / fingerprints / record_hwm => inert (§C.1 required fields)', () => {
  assert.equal(firstAudit(auditBody({ auditor: undefined })).status, 'inert');
  assert.equal(firstAudit(auditBody({ content_fingerprint: undefined })).status, 'inert');
  assert.equal(firstAudit(auditBody({ policy_fingerprint: undefined })).status, 'inert');
  assert.equal(firstAudit(auditBody({ record_hwm: undefined })).status, 'inert');
});

test('record_hwm must be a non-negative integer (typed HWM, §C.1)', () => {
  assert.equal(firstAudit(auditBody({ record_hwm: '"seven"' })).status, 'inert');
  assert.equal(firstAudit(auditBody({ record_hwm: -1 })).status, 'inert');
  assert.equal(firstAudit(auditBody({ record_hwm: 7 })).status, 'record');
});

test('a structurally broken disposition entry (owed not a list / why absent) => inert', () => {
  assert.equal(
    firstAudit(auditBody({ dispositions: '\n  a.png:\n    owed: nope\n    why: |\n      x' })).status,
    'inert'
  );
  assert.equal(firstAudit(auditBody({ dispositions: '\n  a.png:\n    owed: []' })).status, 'inert');
});

test('empty coverage_residue and dispositions parse as empty maps (bare key form)', () => {
  const rec = firstAudit(auditBody({ coverage_residue: '', dispositions: '' })).record;
  assert.deepEqual(rec.coverage_residue, {});
  assert.deepEqual(rec.dispositions, {});
});

test('a malformed audit block is inert on its own; a well-formed sibling survives (§C.1 per-block isolation)', () => {
  const malformed = '```grove-audit\n\tschema: 1\n```';
  const parsed = parseAuditComment(comment({ body: malformed + '\n\n' + auditBody() }));
  assert.equal(parsed.blocks.length, 2);
  assert.equal(parsed.blocks[0].status, 'inert');
  assert.equal(parsed.blocks[1].status, 'record');
});

// --- the two residues (§B.1; INV9, INV10) ---

test('coverageResidue is the pure set difference diff_files ∖ ask_covered_files (INV9)', () => {
  const r = coverageResidue(['a.png', 'lib/a.mjs', 'specs/foo.md'], new Set(['lib/a.mjs']));
  assert.deepEqual(r, ['a.png', 'specs/foo.md']);
});

test('an ask-covered subject outside diff_files is harmless surplus (Terms: sets intersect the diff)', () => {
  const r = coverageResidue(['a.png'], new Set(['not/in/diff.md', 'a.png']));
  assert.deepEqual(r, []);
});

test('judgmentResidue (strict): unasked, untyped diff files only — S6 shape (INV10)', () => {
  const tree = new Map([
    ['assets/social-preview.png', 'PNG'],
    ['specs/foo.md', '---\ntype: spec\n---\nbody'],
    ['lib/a.mjs', 'export const x = 1;'],
  ]);
  const r = judgmentResidue({
    diffFiles: ['assets/social-preview.png', 'specs/foo.md', 'lib/a.mjs'],
    askCovered: new Set(['lib/a.mjs']),
    tree,
    policy: { scope: 'strict' },
  });
  // foo.md is frontmatter-resolved (never reaches R_judg); a.mjs is ask-covered
  assert.deepEqual(r, ['assets/social-preview.png']);
});

test('frontmatter with NO type: declaration still lands in R_judg (the type basis is the declaration)', () => {
  const tree = new Map([['notes/x.md', '---\nid: x\n---\nbody']]);
  const r = judgmentResidue({
    diffFiles: ['notes/x.md'],
    askCovered: new Set(),
    tree,
    policy: { scope: 'strict' },
  });
  assert.deepEqual(r, ['notes/x.md']);
});

test('judgmentResidue (scoped): an out-of-jurisdiction file stays in R_cov but never R_judg', () => {
  const tree = new Map([['src/app.js', 'code'], ['unasked.bin', 'x']]);
  const policy = {
    scope: 'scoped',
    artifactDirs: ['specs'],
    declarationPaths: [],
    reviewPolicyPath: null,
    checkRuntimeDir: { path: '.grove/internal/check/' },
    checkWorkflowPath: { path: '.github/workflows/x.yml' },
  };
  const diffFiles = ['src/app.js', 'specs/new.md'];
  const rCov = coverageResidue(diffFiles, new Set());
  assert.deepEqual(rCov, ['src/app.js', 'specs/new.md']);
  const rJudg = judgmentResidue({ diffFiles, askCovered: new Set(), tree, policy });
  assert.deepEqual(rJudg, ['specs/new.md']); // src/app.js: outside jurisdiction, not exempted
});

test('R_judg ⊆ R_cov ⊆ diff_files, always (§B.1 nesting)', () => {
  const tree = new Map([['specs/foo.md', '---\ntype: spec\n---\n']]);
  const diffFiles = ['a.png', 'specs/foo.md', 'lib/a.mjs'];
  const askCovered = new Set(['lib/a.mjs']);
  const rCov = coverageResidue(diffFiles, askCovered);
  const rJudg = judgmentResidue({ diffFiles, askCovered, tree, policy: { scope: 'strict' } });
  for (const f of rJudg) assert.ok(rCov.includes(f));
  for (const f of rCov) assert.ok(diffFiles.includes(f));
});

test('residue-conditional rule: empty R_judg owes NO audit; non-empty owes one (§B.2, INV11; S4)', () => {
  // S4: a maintainer PR touching only frontmatter-typed artifacts, no asks
  const tree = new Map([
    ['specs/foo.md', '---\ntype: spec\n---\n'],
    ['decisions/adr-1.md', '---\ntype: adr\n---\n'],
  ]);
  const rJudg = judgmentResidue({
    diffFiles: ['specs/foo.md', 'decisions/adr-1.md'],
    askCovered: new Set(),
    tree,
    policy: { scope: 'strict' },
  });
  assert.deepEqual(rJudg, []);
  assert.equal(auditOwed(rJudg), false);
  assert.equal(auditOwed(['assets/social-preview.png']), true);
});

// --- policy carriers (Terms: discovered, not hardcoded) ---

test('policyCarriers = the review-policy file plus every discovered declaration file', () => {
  const carriers = policyCarriers({
    reviewPolicyPath: 'charters/review-policy.md',
    declarationPaths: ['charters/conformance-reviewer.md', 'charters/code-reviewer.md'],
  });
  assert.deepEqual(carriers, [
    'charters/review-policy.md',
    'charters/conformance-reviewer.md',
    'charters/code-reviewer.md',
  ]);
});

// --- the emitter stamps every binding (§C.2; INV12; S6) ---

const S6 = () => {
  const tree = new Map([
    ['assets/social-preview.png', 'PNGBYTES'],
    ['specs/foo.md', '---\ntype: spec\n---\nbody'],
  ]);
  const protectedTree = new Map([
    ['charters/review-policy.md', 'policy'],
    ['charters/conformance-reviewer.md', 'decl'],
  ]);
  return {
    judgment: {
      auditor: 'auditor',
      dispositions: {
        'assets/social-preview.png': { owed: [], why: 'binary asset; no declaration claims it; none owed' },
      },
      findings: 'one residue file, disposed',
    },
    diffFiles: ['assets/social-preview.png', 'specs/foo.md'],
    asks: [],
    reviewlessTypes: ['research'],
    tree,
    carrierPaths: ['charters/review-policy.md', 'charters/conformance-reviewer.md'],
    protectedTree,
    comments: [{ id: 4, body: 'prose only — not a typed record' }],
  };
};

test('S6: the emitter stamps manifest, both fingerprints, and the HWM sentinel 0; the auditor supplies only judgment', () => {
  const input = S6();
  const { record, block } = emitAudit(input);
  // manifest = R_cov (no asks => every diff file) with per-path content hashes
  assert.deepEqual(record.coverage_residue, {
    'assets/social-preview.png': pathHashAt(input.tree, 'assets/social-preview.png'),
    'specs/foo.md': pathHashAt(input.tree, 'specs/foo.md'),
  });
  assert.equal(record.content_fingerprint, groveFp1(input.diffFiles, input.tree));
  assert.equal(record.policy_fingerprint, groveFp1(input.carrierPaths, input.protectedTree));
  assert.equal(record.record_hwm, 0); // typed-record-free stream => the pinned sentinel
  assert.deepEqual(record.flagged, []);
  // the judgment fields pass through transcribed, never invented
  assert.equal(record.auditor, 'auditor');
  assert.match(record.dispositions['assets/social-preview.png'].why, /none owed/);
  assert.equal(record.findings, 'one residue file, disposed');
  // the block round-trips through the parser
  const parsed = parseAuditComment({ body: block });
  assert.equal(parsed.blocks[0].status, 'record');
  assert.deepEqual(parsed.blocks[0].record, record);
});

test('the emitter stamps record_hwm as the highest TYPED comment id; prose and grove-audit comments never raise it (§C.2)', () => {
  const input = S6();
  input.comments = [
    { id: 3, body: askBlock({}) },
    { id: 5, body: verdictBlock({}) },
    { id: 9, body: 'prose' },
    { id: 11, body: auditBody() }, // audits are not typed-record-stream members
  ];
  const { record } = emitAudit(input);
  assert.equal(record.record_hwm, 5);
  assert.equal(typedRecordHwm(input.comments), 5);
});

test('the emitter stamps flagged rows machine-derived from the asks — never the auditor claim (§C.2)', () => {
  const input = S6();
  input.diffFiles = ['lib/x.mjs'];
  input.asks = parsedAsks(askBlock({ type: 'research', subject: '[lib/x.mjs]' }), 7);
  input.judgment.dispositions = { 'lib/x.mjs': { owed: ['code-reviewer'], why: 'unasked code file' } };
  const { record } = emitAudit(input);
  assert.deepEqual(record.flagged, [{ path: 'lib/x.mjs', cause: 'reviewless-type', comment: 7 }]);
  // the reviewless ask covers nothing: the subject falls to the manifest
  assert.deepEqual(Object.keys(record.coverage_residue), ['lib/x.mjs']);
});

test('the emitter fails loudly on unserializable judgment — never a silently broken record', () => {
  const base = S6();
  assert.throws(() => emitAudit({ ...base, judgment: { ...base.judgment, auditor: '' } }));
  assert.throws(() =>
    emitAudit({
      ...base,
      judgment: { ...base.judgment, dispositions: { 'a.png': { owed: 'not-a-list', why: 'x' } } },
    })
  );
  assert.throws(() =>
    emitAudit({
      ...base,
      judgment: { ...base.judgment, dispositions: { 'a.png': { owed: [], why: 'x\n```\ny' } } },
    })
  );
});

test('the emitter transcribes an empty why (vacuous at evaluation, not blocked at emit — adr-0015 transcription)', () => {
  const input = S6();
  input.judgment.dispositions = { 'assets/social-preview.png': { owed: [], why: '' } };
  const { record, block } = emitAudit(input);
  assert.equal(record.dispositions['assets/social-preview.png'].why, '');
  const parsed = parseAuditComment({ body: block });
  assert.equal(parsed.blocks[0].status, 'record');
  assert.equal(parsed.blocks[0].record.dispositions['assets/social-preview.png'].why, '');
});

test('serializeAudit output carries one fenced grove-audit block that reparses to the same record', () => {
  const input = S6();
  const { record } = emitAudit(input);
  const block = serializeAudit(record);
  assert.match(block, /^```grove-audit\n/);
  assert.match(block, /\n```$/);
  assert.deepEqual(parseAuditComment({ body: block }).blocks[0].record, record);
});

// --- freshness (§C.3; INV13; S8–S10) ---

const freshBasis = () => {
  const input = S6();
  const { record } = emitAudit(input);
  return { record, basis: {
    diffFiles: input.diffFiles,
    tree: input.tree,
    carrierPaths: input.carrierPaths,
    protectedTree: input.protectedTree,
    comments: input.comments,
  } };
};

test('an audit whose three bindings all recompute equal is fresh (S10: blob-byte basis — a no-op rebase stays fresh)', () => {
  const { record, basis } = freshBasis();
  const f = auditFreshness(record, basis);
  assert.equal(f.fresh, true);
  assert.deepEqual(f.stale, []);
});

test('a diff-file blob change or membership change stales by content (§C.3.1)', () => {
  const { record, basis } = freshBasis();
  const changed = new Map(basis.tree);
  changed.set('specs/foo.md', '---\ntype: spec\n---\nEDITED');
  assert.deepEqual(auditFreshness(record, { ...basis, tree: changed }).stale, ['content']);
  const grown = auditFreshness(record, { ...basis, diffFiles: [...basis.diffFiles, 'new.mjs'] });
  assert.deepEqual(grown.stale, ['content']);
});

test('a policy-carrier content or membership change stales by policy (§C.3.2; S9)', () => {
  const { record, basis } = freshBasis();
  const edited = new Map(basis.protectedTree);
  edited.set('charters/review-policy.md', 'CHANGED');
  assert.deepEqual(auditFreshness(record, { ...basis, protectedTree: edited }).stale, ['policy']);
  // a fifth reviewer-declaration file changes the carrier SET, hence the fingerprint
  const withFifth = auditFreshness(record, {
    ...basis,
    carrierPaths: [...basis.carrierPaths, 'charters/new-reviewer.md'],
  });
  assert.deepEqual(withFifth.stale, ['policy']);
});

test('S8 three-way: a typed fence past the HWM stales — well-formed OR malformed; typo/prose/audit never do (§C.3.3, N4)', () => {
  const { record, basis } = freshBasis(); // record_hwm = 0, the sentinel
  const withComment = (body, id = 12) =>
    auditFreshness(record, { ...basis, comments: [...basis.comments, { id, body }] });
  // well-formed ask fence past the HWM => stale
  assert.deepEqual(withComment(askBlock({})).stale, ['stream']);
  // a recognized exact-tag fence whose block is UNCLOSED still stales, fail-closed
  assert.deepEqual(withComment('```grove-review-ask\nschema: 1').stale, ['stream']);
  // a verdict fence past the HWM => stale
  assert.deepEqual(withComment(verdictBlock({})).stale, ['stream']);
  // a typo'd tag never registers: neither covers nor stales
  assert.equal(withComment('```grove-review-askk\nschema: 1\n```').fresh, true);
  // prose never invalidates
  assert.equal(withComment('LGTM, nice work').fresh, true);
  // a later grove-audit record supersedes by selection, never stales by HWM (F6)
  assert.equal(withComment(auditBody()).fresh, true);
});

test('under the sentinel 0 ANY typed comment stales, fail-closed (§C.1/F2)', () => {
  const { record, basis } = freshBasis();
  assert.equal(record.record_hwm, 0);
  const f = auditFreshness(record, { ...basis, comments: [{ id: 1, body: askBlock({}) }] });
  assert.deepEqual(f.stale, ['stream']);
});

// --- auditor separation (§C.4; INV14; S7) ---

test('separationSet P = producers of every schema-valid ask AND verdict, plus ask resumed_by (INV14)', () => {
  const comments = [
    { id: 1, body: askBlock({ producer: 'executor', resumed_by: 'run-resumer' }) },
    { id: 2, body: verdictBlock({ producer: 'contract-author', reviewer: 'spec-adversary' }) },
    { id: 3, body: 'prose' },
  ];
  const p = separationSet(comments);
  assert.deepEqual([...p].sort(), ['contract-author', 'executor', 'run-resumer']);
  assert.equal(p.has('spec-adversary'), false); // reviewers are not producers
});

test('rejection never un-produces: an EDITED (inadmissible) ask comment still feeds P (§C.4)', () => {
  const comments = [
    {
      id: 1,
      body: askBlock({ producer: 'executor' }),
      createdAt: '2026-07-19T00:00:00Z',
      updatedAt: '2026-07-19T01:00:00Z', // edited => the comment is inadmissible
      authorAssociation: 'MEMBER',
    },
  ];
  assert.equal(separationSet(comments).has('executor'), true);
});

test('S7: auditor ∈ P => the audit record is inadmissible (auditor-separation)', () => {
  const stream = [{ id: 1, body: askBlock({ producer: 'executor' }) }];
  const rec = firstAudit(auditBody({ auditor: 'executor' })).record;
  const a = checkAuditAdmissibility(comment({ body: auditBody({ auditor: 'executor' }) }), rec, {
    producers: separationSet(stream),
  });
  assert.equal(a.admissible, false);
  assert.equal(a.cause, 'auditor-separation');
});

test('resumed_by dual attribution: the run-resumer can never audit a pass it completed (INV14, N5)', () => {
  const stream = [{ id: 1, body: askBlock({ producer: 'executor', resumed_by: 'run-resumer' }) }];
  const rec = firstAudit(auditBody({ auditor: 'run-resumer' })).record;
  const a = checkAuditAdmissibility(comment(), rec, { producers: separationSet(stream) });
  assert.equal(a.admissible, false);
  assert.equal(a.cause, 'auditor-separation');
});

test('spec-0002 §A.4 is inherited whole: an edited audit comment is inadmissible; a clean non-producer audit is admissible', () => {
  const rec = firstAudit(auditBody()).record;
  const edited = checkAuditAdmissibility(comment({ updatedAt: '2026-07-19T01:00:00Z' }), rec, {
    producers: new Set(['executor']),
  });
  assert.equal(edited.admissible, false);
  assert.equal(edited.cause, 'edited');
  const clean = checkAuditAdmissibility(comment(), rec, { producers: new Set(['executor']) });
  assert.equal(clean.admissible, true);
});

// --- vacuity, one level up (§C.5; INV15; S12) ---

test('S12: a missing disposition or an empty/whitespace why leaves that R_judg file unsatisfied', () => {
  const rec = firstAudit(
    auditBody({
      dispositions:
        '\n  a.png:\n    owed: []\n    why: |\n      genuinely nothing owed\n' +
        '  b.png:\n    owed: []\n    why: ""',
    })
  ).record;
  const cov = dispositionCoverage(rec, ['a.png', 'b.png', 'c.png']);
  assert.deepEqual(cov.satisfied, ['a.png']);
  // b.png: empty why (vacuous); c.png: no entry at all
  assert.deepEqual(cov.unsatisfied, [
    { path: 'b.png', cause: 'vacuous-why' },
    { path: 'c.png', cause: 'missing-disposition' },
  ]);
});

test('owed: [] with a non-empty why is a SATISFYING disposition — "owes nothing", stated (§C.1)', () => {
  const rec = firstAudit(auditBody()).record;
  const cov = dispositionCoverage(rec, ['assets/social-preview.png']);
  assert.deepEqual(cov.satisfied, ['assets/social-preview.png']);
  assert.deepEqual(cov.unsatisfied, []);
});

test('an audit body empty of dispositions satisfies nothing (§C.5)', () => {
  const rec = firstAudit(auditBody({ dispositions: '' })).record;
  const cov = dispositionCoverage(rec, ['a.png', 'b.png']);
  assert.deepEqual(cov.satisfied, []);
  assert.deepEqual(cov.unsatisfied.map((u) => u.path), ['a.png', 'b.png']);
});

// --- INV1 regression: audits are invisible to the shipped check AND to the ask reader ---

test('a grove-audit fence is invisible to records.mjs AND to asks.mjs (INV1)', () => {
  const body = auditBody();
  assert.deepEqual(extractVerdictBlocks(body), []);
  assert.equal(parseComment({ body }).status, 'none');
  assert.equal(parseAskComment({ body }).status, 'none');
});

test('a comment carrying audit + verdict: the shipped check reads ONLY the verdict (INV1)', () => {
  const body = auditBody() + '\n\n' + verdictBlock({});
  const parsed = parseComment({ body });
  assert.equal(parsed.status, 'multi');
  assert.equal(parsed.blocks.length, 1); // the audit block never registers
  assert.equal(parsed.blocks[0].status, 'record');
  assert.equal(parsed.blocks[0].record.review, 'conformance');
});
