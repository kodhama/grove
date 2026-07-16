// Match-records + freshness + separation: spec-0002 §C.3, §C.4 (INV3, INV5,
// INV6, INV8; S1, S2, S3, S5, S7, S13, S14, S17, S19).
//
// For each owed pair (f, R): select the latest admissible schema-valid record
// whose subject manifest contains f; satisfied iff covering ∧ fresh ∧ passing
// ∧ separated ∧ non-vacuous. UPSTREAM-INDICTED is never passing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePolicy } from '../lib/policy.mjs';
import { buildArtifactIndex } from '../lib/artifact-index.mjs';
import { groveFp1, pathHashAt } from '../lib/fingerprint.mjs';
import { prepareRecords, evaluatePair } from '../lib/match.mjs';

const adr = (id, status = 'approved') => `---\nid: ${id}\ntype: adr\nstatus: ${status}\n---\n`;
const spec = (id, impl) => `---\nid: ${id}\ntype: spec\nstatus: gated\nimplements: ${impl}\ndepends_on: [adr-noise]\n---\n`;
const ledger = (ids) => '```grove-test-deps\nschema: 1\nspecs: [' + ids.join(', ') + ']\n```';

function baseTree() {
  return new Map([
    ['decisions/adr-x.md', adr('adr-x')],
    ['decisions/adr-noise.md', adr('adr-noise')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
    ['specs/bar.md', spec('spec-bar', 'adr-x')],
    ['pkg/test-deps.md', ledger(['spec-foo'])],
    ['pkg/code.mjs', 'const x = 1;\n'],
  ]);
}

const reviewPolicyText = [
  '```grove-review-policy',
  'schema: 1',
  'reviewless_types: [research]',
  '```',
].join('\n');
const decl = (review, types, pass) =>
  `\`\`\`grove-review-declaration\nschema: 1\nreview: ${review}\ntypes: [${types.join(', ')}]\npass_class: [${pass.join(', ')}]\n\`\`\``;
const charters = [
  decl('conformance', ['spec', 'charter', 'code'], ['PASS']),
  decl('spec-adversary', ['spec'], ['APPROVE-READY']),
  decl('code-reviewer', ['code'], ['CLEAN', 'PASS-WITH-ADVISORIES']),
  decl('decision-adversary', ['adr', 'decision'], ['SOUND']),
];
const policy = assemblePolicy({ reviewPolicyText, charterTexts: charters });

// Build a verdict-record comment. `basis` sets the recorded fingerprint +
// manifest_hashes (computed over `tree`); `subject` is the manifest S.
function rec(tree, { review, verdict, subject, basis, findings = 'sound derivation', producer = 'prod', reviewer = 'rev', id, author = 'alice', authorAssociation = 'MEMBER', edited = false }) {
  const fingerprint = groveFp1(basis, tree);
  const lines = [
    '```grove-verdict',
    'schema: 1',
    `review: ${review}`,
    `verdict: ${verdict}`,
    'subject:',
    ...subject.map((s) => `  - ${s}`),
    'manifest_hashes:',
    ...basis.map((p) => `  ${p}: ${pathHashAt(tree, p)}`),
    `fingerprint: ${fingerprint}`,
    `producer: ${producer}`,
    `reviewer: ${reviewer}`,
    findings === '' ? 'findings:' : `findings: ${findings}`,
    '```',
  ];
  return { body: lines.join('\n'), author, authorAssociation, edited, id };
}

function ev(tree, file, review, comments, posterPolicy) {
  const index = buildArtifactIndex(tree, policy.artifactDirs);
  const prepared = prepareRecords(comments, posterPolicy ?? { record_poster_allowlist: policy.recordPosterAllowlist });
  return evaluatePair({ file, review, prepared, tree, index, policy });
}

const codes = (row) => row.reasons.map((r) => r.code);

test('a fresh, passing, covering, separated, non-vacuous record satisfies the pair', () => {
  const tree = baseTree();
  const c = rec(tree, { review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], basis: ['specs/foo.md'], id: 1 });
  const row = ev(tree, 'specs/foo.md', 'spec-adversary', [c]);
  assert.equal(row.reasons.length, 0);
  assert.equal(row.covers, true);
  assert.equal(row.fresh, true);
  assert.equal(row.separated, true);
});

test('S1 — no covering record for an owed review => never-reviewed', () => {
  const tree = baseTree();
  const c = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1 });
  const row = ev(tree, 'specs/foo.md', 'spec-adversary', [c]);
  assert.deepEqual(codes(row), ['never-reviewed']);
});

test('S3 — a record not listing the file in its manifest does not cover it', () => {
  const tree = baseTree();
  const c = rec(tree, { review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], basis: ['specs/foo.md'], id: 1 });
  const row = ev(tree, 'specs/bar.md', 'spec-adversary', [c]);
  assert.equal(row.covers, false);
  assert.deepEqual(codes(row), ['never-reviewed']);
});

test('S5 — reviewer == producer => self-reviewed, regardless of verdict', () => {
  const tree = baseTree();
  const c = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], producer: 'same', reviewer: 'same', id: 1 });
  const row = ev(tree, 'specs/foo.md', 'conformance', [c]);
  assert.ok(codes(row).includes('self-reviewed'));
  assert.equal(row.reasons.find((r) => r.code === 'self-reviewed').payload.agent, 'same');
});

test('S7 — a fresh PASS record with empty findings is vacuous-evidence', () => {
  const tree = baseTree();
  const c = rec(tree, { review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], basis: ['specs/foo.md'], findings: '', id: 1 });
  const row = ev(tree, 'specs/foo.md', 'spec-adversary', [c]);
  assert.deepEqual(codes(row), ['vacuous-evidence']);
});

test('review-failed — a fresh non-PASS-class verdict covers but does not pass', () => {
  const tree = baseTree();
  const c = rec(tree, { review: 'conformance', verdict: 'FAIL', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1 });
  const row = ev(tree, 'specs/foo.md', 'conformance', [c]);
  assert.ok(codes(row).includes('review-failed'));
  assert.equal(row.covers, true);
  assert.equal(row.fresh, true);
});

test('S13 — an upstream edit stales the fidelity record but not the quality one', () => {
  const tree = baseTree();
  const sa = rec(tree, { review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], basis: ['specs/foo.md'], id: 1 });
  const cf = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 2 });
  // edit adr-x (foo's implements upstream) in the same PR
  const tree2 = baseTree();
  tree2.set('decisions/adr-x.md', adr('adr-x') + '\nedited body\n');

  const qRow = ev(tree2, 'specs/foo.md', 'spec-adversary', [sa]);
  assert.equal(qRow.reasons.length, 0, 'quality verdict survives the upstream edit');

  const fRow = ev(tree2, 'specs/foo.md', 'conformance', [cf]);
  assert.equal(fRow.fresh, false);
  const uc = fRow.reasons.find((r) => r.code === 'upstream-changed');
  assert.ok(uc, 'fidelity verdict goes stale on the upstream edit');
  assert.equal(uc.token, 'upstream-decisions/adr-x.md-changed');
});

test('S2 — a code fidelity record stales when its ledger-derived upstream changes', () => {
  const tree = baseTree();
  const cf = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['pkg/code.mjs'], basis: ['pkg/code.mjs', 'specs/foo.md'], id: 1 });
  const tree2 = baseTree();
  tree2.set('specs/foo.md', spec('spec-foo', 'adr-x') + '\nrevised under the code\n');
  const row = ev(tree2, 'pkg/code.mjs', 'conformance', [cf]);
  assert.equal(row.fresh, false);
  assert.ok(row.reasons.some((r) => r.token === 'upstream-specs/foo.md-changed'));
});

test('changed-since-review — a subject edit stales the record and names the subject', () => {
  const tree = baseTree();
  const sa = rec(tree, { review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], basis: ['specs/foo.md'], id: 1 });
  const tree2 = baseTree();
  tree2.set('specs/foo.md', spec('spec-foo', 'adr-x') + '\nnew line\n');
  const row = ev(tree2, 'specs/foo.md', 'spec-adversary', [sa]);
  assert.equal(row.fresh, false);
  const cs = row.reasons.find((r) => r.code === 'changed-since-review');
  assert.ok(cs);
  assert.equal(cs.payload.path, 'specs/foo.md');
});

test('S14 — the latest covering record counts (FAIL then PASS), sequence preserved', () => {
  const tree = baseTree();
  const fail = rec(tree, { review: 'conformance', verdict: 'FAIL', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1 });
  const pass = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 2 });
  const row = ev(tree, 'specs/foo.md', 'conformance', [fail, pass]);
  assert.equal(row.reasons.length, 0, 'latest PASS satisfies');
  assert.equal(row.latestVerdict, 'PASS');
  assert.deepEqual(row.recordSequence.map((s) => s.verdict), ['FAIL', 'PASS']);
});

test('selection is by comment creation order, not array order', () => {
  const tree = baseTree();
  const pass = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 2 });
  const fail = rec(tree, { review: 'conformance', verdict: 'FAIL', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 5 });
  // fail has the higher id => it is latest even though passed in first
  const row = ev(tree, 'specs/foo.md', 'conformance', [fail, pass]);
  assert.equal(row.latestVerdict, 'FAIL');
});

test('S17 — the only covering record is edited => rejected, pair is record-rejected', () => {
  const tree = baseTree();
  const c = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1, edited: true });
  const row = ev(tree, 'specs/foo.md', 'conformance', [c]);
  assert.deepEqual(codes(row), ['record-rejected']);
  assert.equal(row.reasons[0].payload[0].cause, 'edited');
});

test('S17b — a record from an unauthorized poster is rejected (unauthorized)', () => {
  const tree = baseTree();
  const c = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1, authorAssociation: 'NONE' });
  const row = ev(tree, 'specs/foo.md', 'conformance', [c]);
  assert.deepEqual(codes(row), ['record-rejected']);
  assert.equal(row.reasons[0].payload[0].cause, 'unauthorized');
});

test('a rejected record never blocks a pair an admissible record satisfies (S17/§A.4)', () => {
  const tree = baseTree();
  const edited = rec(tree, { review: 'conformance', verdict: 'FAIL', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1, edited: true });
  const good = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 2 });
  const row = ev(tree, 'specs/foo.md', 'conformance', [edited, good]);
  assert.equal(row.reasons.length, 0);
});

test('S19 — a fresh UPSTREAM-INDICTED conformance record routes upstream (to the human)', () => {
  const tree = baseTree();
  const c = rec(tree, { review: 'conformance', verdict: 'UPSTREAM-INDICTED', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1 });
  const row = ev(tree, 'specs/foo.md', 'conformance', [c]);
  const ind = row.reasons.find((r) => r.code === 'upstream-indicted');
  assert.ok(ind, 'not passing; indicted');
  assert.equal(ind.payload.upstream, 'decisions/adr-x.md');
  assert.equal(ind.routing.target, 'human');
  assert.ok(!codes(row).includes('review-failed'), 'indicted is distinct from review-failed');
});

test('S20 — a fidelity pair over a spec with no implements => no-reviewable-upstream', () => {
  const tree = baseTree();
  tree.set('specs/noimpl.md', '---\nid: spec-noimpl\ntype: spec\nstatus: gated\n---\n');
  const c = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/noimpl.md'], basis: ['specs/noimpl.md'], id: 1 });
  const row = ev(tree, 'specs/noimpl.md', 'conformance', [c]);
  assert.ok(codes(row).includes('no-reviewable-upstream'));
});

test('prepareRecords separates admissible, rejected, and inert comments', () => {
  const tree = baseTree();
  const good = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1 });
  const editedRec = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 2, edited: true });
  const prose = { body: 'conformance passed, trust me', author: 'x', authorAssociation: 'MEMBER', id: 3 };
  const prepared = prepareRecords([good, editedRec, prose], { record_poster_allowlist: null });
  assert.equal(prepared.records.length, 1);
  assert.equal(prepared.rejected.length, 1);
  assert.equal(prepared.rejected[0].cause, 'edited');
  assert.equal(prepared.inert.length, 0); // plain prose has no block => 'none', not inert
});
