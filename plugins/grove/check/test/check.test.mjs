// The orchestrator (spec-0002 §C.8; INV5, INV7, INV13, INV18; S4, S9, S11,
// S12, S16, S18). Green iff every owed pair is satisfied ∧ separation ∧ the
// C.5 decision gate ∧ the C.6 approved-upstream gate ∧ C.7 graph resolution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePolicy } from '../lib/policy.mjs';
import { groveFp1, pathHashAt } from '../lib/fingerprint.mjs';
import { runCheck } from '../lib/check.mjs';

const adr = (id, status = 'approved') => `---\nid: ${id}\ntype: adr\nstatus: ${status}\n---\n`;
const decision = (id, status) => `---\nid: ${id}\ntype: decision\nstatus: ${status}\n---\n`;
const spec = (id, impl, deps = []) =>
  `---\nid: ${id}\ntype: spec\nstatus: gated\nimplements: ${impl}\ndepends_on: [${deps.join(', ')}]\n---\n`;
const research = (id) => `---\nid: ${id}\ntype: research\nstatus: draft\n---\n`;
const widget = (id) => `---\nid: ${id}\ntype: widget\nstatus: draft\n---\n`;
const ledger = (ids) => '```grove-test-deps\nschema: 1\nspecs: [' + ids.join(', ') + ']\n```';

const reviewPolicyText = ['```grove-review-policy', 'schema: 1', 'reviewless_types: [research, feedback]', '```'].join('\n');
const decl = (review, types, pass) =>
  `\`\`\`grove-review-declaration\nschema: 1\nreview: ${review}\ntypes: [${types.join(', ')}]\npass_class: [${pass.join(', ')}]\n\`\`\``;
const policy = assemblePolicy({
  reviewPolicyText,
  charterTexts: [
    decl('conformance', ['spec', 'charter', 'code'], ['PASS']),
    decl('spec-adversary', ['spec'], ['APPROVE-READY']),
    decl('code-reviewer', ['code'], ['CLEAN', 'PASS-WITH-ADVISORIES']),
    decl('decision-adversary', ['adr', 'decision'], ['SOUND']),
  ],
});

function rec(tree, { review, verdict, subject, basis, findings = 'evidence', producer = 'prod', reviewer = 'rev', id }) {
  const lines = [
    '```grove-verdict', 'schema: 1', `review: ${review}`, `verdict: ${verdict}`, 'subject:',
    ...subject.map((s) => `  - ${s}`), 'manifest_hashes:',
    ...basis.map((p) => `  ${p}: ${pathHashAt(tree, p)}`),
    `fingerprint: ${groveFp1(basis, tree)}`, `producer: ${producer}`, `reviewer: ${reviewer}`,
    `findings: ${findings}`, '```',
  ];
  return { body: lines.join('\n'), author: 'alice', authorAssociation: 'MEMBER', id };
}

const pairKey = (r) => `${r.subject}::${r.review}`;
const reasonCodes = (rows) => rows.flatMap((r) => r.reasons.map((x) => x.code));

test('a fully satisfied spec change is green (all owed pairs, gates, graph pass)', () => {
  const tree = new Map([
    ['decisions/adr-x.md', adr('adr-x', 'approved')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
  ]);
  const comments = [
    rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1 }),
    rec(tree, { review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], basis: ['specs/foo.md'], id: 2 }),
  ];
  const d = runCheck({ changed: ['specs/foo.md'], tree, comments, policy });
  assert.equal(d.green, true, JSON.stringify(reasonCodes(d.rows)));
});

test('S16 — a satisfied record over a spec whose upstream is only `gated` is red (C.6)', () => {
  const tree = new Map([
    ['decisions/adr-x.md', adr('adr-x', 'gated')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
  ]);
  const comments = [
    rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1 }),
    rec(tree, { review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], basis: ['specs/foo.md'], id: 2 }),
  ];
  const d = runCheck({ changed: ['specs/foo.md'], tree, comments, policy });
  assert.equal(d.green, false);
  const conf = d.rows.find((r) => pairKey(r) === 'specs/foo.md::conformance');
  const ahca = conf.reasons.find((x) => x.code === 'awaiting-human-approval');
  assert.ok(ahca);
  assert.equal(ahca.payload.artifact, 'decisions/adr-x.md');
});

test('S4 — an unknown type owes the FULL set and is red until every review lands', () => {
  const tree = new Map([['x/thing.md', widget('thing')]]);
  const d = runCheck({ changed: ['x/thing.md'], tree, comments: [], policy });
  assert.equal(d.green, false);
  const reviews = d.rows.filter((r) => r.kind === 'pair' && r.subject === 'x/thing.md').map((r) => r.review).sort();
  assert.deepEqual(reviews, ['code-reviewer', 'conformance', 'decision-adversary', 'spec-adversary']);
});

test('S12 — the owed-set is the union over changed files; a reviewless type owes nothing', () => {
  const tree = new Map([
    ['decisions/adr-x.md', adr('adr-x', 'approved')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
    ['pkg/test-deps.md', ledger(['spec-foo'])],
    ['pkg/code.mjs', 'const x = 1;\n'],
    ['research/note.md', research('note')],
  ]);
  const d = runCheck({ changed: ['specs/foo.md', 'pkg/code.mjs', 'research/note.md'], tree, comments: [], policy });
  const pairs = new Set(d.rows.filter((r) => r.kind === 'pair').map(pairKey));
  assert.ok(pairs.has('specs/foo.md::conformance'));
  assert.ok(pairs.has('specs/foo.md::spec-adversary'));
  assert.ok(pairs.has('pkg/code.mjs::conformance'));
  assert.ok(pairs.has('pkg/code.mjs::code-reviewer'));
  // research is positively reviewless => no pair
  assert.ok(![...pairs].some((k) => k.startsWith('research/note.md')));
});

test('S9 — a bundled draft decision keeps the gate red (awaiting-human-approval)', () => {
  const tree = new Map([['decisions/adr-new.md', decision('adr-new', 'draft')]]);
  const d = runCheck({ changed: ['decisions/adr-new.md'], tree, comments: [], policy });
  assert.equal(d.green, false);
  assert.ok(reasonCodes(d.rows).includes('awaiting-human-approval'));
});

test('S18 — a dangling depends_on id goes red regardless of any records present', () => {
  const tree = new Map([
    ['decisions/adr-x.md', adr('adr-x', 'approved')],
    ['specs/foo.md', spec('spec-foo', 'adr-x', ['adr-missing'])],
  ]);
  const comments = [
    rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1 }),
    rec(tree, { review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], basis: ['specs/foo.md'], id: 2 }),
  ];
  const d = runCheck({ changed: ['specs/foo.md'], tree, comments, policy });
  assert.equal(d.green, false);
  const gr = d.rows.find((r) => r.kind === 'file' && r.reasons.some((x) => x.code === 'unresolvable-reference'));
  assert.ok(gr);
  assert.ok(gr.reasons.some((x) => JSON.stringify(x.payload).includes('adr-missing')));
});

test('S11 — an allowlisted code-bearing path is not exempt; it still owes its reviews', () => {
  const allowPolicy = assemblePolicy({
    reviewPolicyText: ['```grove-review-policy', 'schema: 1', 'reviewless_types: [research]',
      'non_behavioral_allowlist:', '  - scripts/run.sh', '```'].join('\n'),
    charterTexts: [
      decl('conformance', ['spec', 'code'], ['PASS']),
      decl('code-reviewer', ['code'], ['CLEAN']),
      decl('spec-adversary', ['spec'], ['APPROVE-READY']),
      decl('decision-adversary', ['adr'], ['SOUND']),
    ],
  });
  const tree = new Map([['scripts/run.sh', '#!/bin/sh\necho hi\n']]);
  const d = runCheck({ changed: ['scripts/run.sh'], tree, comments: [], policy: allowPolicy });
  const reviews = d.rows.filter((r) => r.kind === 'pair').map((r) => r.review).sort();
  assert.deepEqual(reviews, ['code-reviewer', 'conformance']);
});

test('an allowlisted prose doc IS exempt (owes nothing)', () => {
  const allowPolicy = assemblePolicy({
    reviewPolicyText: ['```grove-review-policy', 'schema: 1',
      'non_behavioral_allowlist:', '  - README.md', '```'].join('\n'),
    charterTexts: [decl('conformance', ['code'], ['PASS']), decl('code-reviewer', ['code'], ['CLEAN'])],
  });
  const tree = new Map([['README.md', '# hello\n']]);
  const d = runCheck({ changed: ['README.md'], tree, comments: [], policy: allowPolicy });
  assert.equal(d.rows.filter((r) => r.kind === 'pair').length, 0);
  assert.equal(d.green, true);
});

test('rejected records are surfaced in the derivation even when non-blocking', () => {
  const tree = new Map([
    ['decisions/adr-x.md', adr('adr-x', 'approved')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
  ]);
  const good = rec(tree, { review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], basis: ['specs/foo.md'], id: 2 });
  const conf = rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1 });
  const editedExtra = { ...rec(tree, { review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], basis: ['specs/foo.md'], id: 3 }), authorAssociation: 'NONE' };
  const d = runCheck({ changed: ['specs/foo.md'], tree, comments: [good, conf, editedExtra], policy });
  assert.equal(d.green, true, JSON.stringify(reasonCodes(d.rows)));
  assert.equal(d.rejectedRecords.length, 1);
  assert.equal(d.rejectedRecords[0].cause, 'unauthorized');
});

test('adr-0022 D1 (AC1) — a no-frontmatter prose file with no reviewable upstream carries the allowlist remedy marker', () => {
  const tree = new Map([['docs/GUIDE.md', '# Guide\n\norientation prose, no frontmatter\n']]);
  const d = runCheck({ changed: ['docs/GUIDE.md'], tree, comments: [], policy });
  const conf = d.rows.find((r) => r.kind === 'pair' && r.review === 'conformance');
  assert.ok(conf, 'expected a conformance pair row');
  assert.ok(conf.reasons.some((x) => x.token === 'no-reviewable-upstream'), JSON.stringify(reasonCodes(d.rows)));
  assert.deepEqual(conf.allowlistRemedy, { path: 'docs/GUIDE.md' });
});

test('adr-0022 D1 (AC2) — a non-prose code file with no reviewable upstream carries NO allowlist marker (its cure is a ledger)', () => {
  const tree = new Map([['config/thing.toml', '# config\nkey = 1\n']]);
  const d = runCheck({ changed: ['config/thing.toml'], tree, comments: [], policy });
  const conf = d.rows.find((r) => r.kind === 'pair' && r.review === 'conformance');
  assert.ok(conf, 'expected a conformance pair row');
  assert.ok(conf.reasons.some((x) => x.token === 'no-reviewable-upstream'), JSON.stringify(reasonCodes(d.rows)));
  assert.equal(conf.allowlistRemedy, undefined);
});

test('adr-0022 D1 (reason-gate) — an allowlist-eligible prose file that reds for a reason OTHER than no-reviewable-upstream (it has an ancestor ledger) draws NO allowlist marker', () => {
  const tree = new Map([
    ['docs/GUIDE.md', '# Guide\n\nprose, but ledgered so its upstream resolves\n'],
    ['docs/test-deps.md', ledger(['spec-foo'])],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
    ['decisions/adr-x.md', adr('adr-x', 'approved')],
  ]);
  const d = runCheck({ changed: ['docs/GUIDE.md'], tree, comments: [], policy });
  const conf = d.rows.find((r) => r.kind === 'pair' && r.review === 'conformance');
  assert.ok(conf, 'expected a conformance pair row');
  // the ancestor ledger resolves the upstream, so the row reds never-reviewed —
  // NOT no-reviewable-upstream — even though the file is allowlist-eligible prose
  assert.ok(!conf.reasons.some((x) => x.token === 'no-reviewable-upstream'), JSON.stringify(reasonCodes(d.rows)));
  // ...so the reason-gate withholds the allowlist marker (its cure is a record, not the allowlist)
  assert.equal(conf.allowlistRemedy, undefined);
});
