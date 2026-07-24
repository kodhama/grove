// Shadow coordination metrics (adr-0023 D5 follow-up ①, #91 milestone list):
// ask→review closure + ordering, annotation consumption, window aggregation.
// Pure derivation over already-admissible comment streams — the blackboard is
// self-describing, so coordination health is computed from records alone.
// Upstream context: spec-0003 §A (asks), spec-0002 §A (verdicts); this module
// is a READ-ONLY consumer of both record classes — it derives no obligations
// and gates nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePolicy } from '../lib/policy.mjs';
import { serializeAsk } from '../lib/asks.mjs';
import { askClosure, annotationConsumption, aggregateWindow } from '../lib/metrics.mjs';

const decl = (review, types, pass) =>
  `\`\`\`grove-review-declaration\nschema: 1\nreview: ${review}\ntypes: [${types.join(', ')}]\npass_class: [${pass.join(', ')}]\n\`\`\``;
const policy = assemblePolicy({
  reviewPolicyText: ['```grove-review-policy', 'schema: 1', 'reviewless_types: [research, feedback]', '```'].join('\n'),
  charterTexts: [
    decl('conformance', ['spec', 'charter', 'code'], ['PASS']),
    decl('spec-adversary', ['spec'], ['APPROVE-READY']),
    decl('code-reviewer', ['code'], ['CLEAN', 'PASS-WITH-ADVISORIES']),
    decl('decision-adversary', ['adr', 'decision'], ['SOUND']),
  ],
});

// Minimal valid grove-verdict block (metrics never verifies freshness, so a
// placeholder fingerprint is fine — records.mjs only requires non-empty).
const verdict = ({ review, subject, findings = 'evidence line' }) =>
  ['```grove-verdict', 'schema: 1', `review: ${review}`, 'verdict: PASS', 'subject:',
    ...subject.map((s) => `  - ${s}`), 'manifest_hashes:',
    ...subject.map((s) => `  ${s}: x`),
    'fingerprint: grove-fp-1:x', 'producer: executor', 'reviewer: someone-else',
    `findings: ${findings}`, '```'].join('\n');

const ask = (o) => serializeAsk({ schema: 1, producer: 'executor', ...o });
const comment = (id, body) => ({ id, body });
// ctx: frontmatterless tree — typeOf always null; reviewless set from policy.
const ctx = { typeOf: () => null, reviewlessTypes: new Set(['research', 'feedback']) };

test('closure — an effective code ask followed by both owed verdicts closes both pairs, ordered', () => {
  const comments = [
    comment(10, ask({ type: 'code', subject: ['pkg/a.mjs'] })),
    comment(20, verdict({ review: 'conformance', subject: ['pkg/a.mjs'] })),
    comment(30, verdict({ review: 'code-reviewer', subject: ['pkg/a.mjs'] })),
  ];
  const r = askClosure({ comments, ctx, policy });
  assert.equal(r.pairsTotal, 2); // owed(code) = conformance + code-reviewer
  assert.equal(r.pairsClosed, 2);
  assert.equal(r.closureRate, 1);
  assert.equal(r.orderedFraction, 1); // ask id 10 precedes verdict ids 20/30
});

test('ordering — a verdict posted BEFORE the ask closes the pair but flags inverted ordering', () => {
  const comments = [
    comment(10, verdict({ review: 'code-reviewer', subject: ['pkg/a.mjs'] })),
    comment(20, ask({ type: 'code', subject: ['pkg/a.mjs'] })),
    comment(30, verdict({ review: 'conformance', subject: ['pkg/a.mjs'] })),
  ];
  const r = askClosure({ comments, ctx, policy });
  assert.equal(r.pairsClosed, 2);
  assert.equal(r.orderedFraction, 0.5); // conformance ordered, code-reviewer inverted
});

test('closure — an unanswered pair lowers the rate', () => {
  const comments = [
    comment(10, ask({ type: 'code', subject: ['pkg/a.mjs'] })),
    comment(20, verdict({ review: 'code-reviewer', subject: ['pkg/a.mjs'] })),
  ];
  const r = askClosure({ comments, ctx, policy });
  assert.equal(r.pairsTotal, 2);
  assert.equal(r.pairsClosed, 1);
  assert.equal(r.closureRate, 0.5);
});

test('a reviewless-typed ask is ineffective and contributes no pairs (§A.3 rule 1)', () => {
  const comments = [comment(10, ask({ type: 'research', subject: ['notes/x.md'] }))];
  const r = askClosure({ comments, ctx, policy });
  assert.equal(r.pairsTotal, 0);
});

test('a frontmatter-divergent subject is inert per-file and contributes no pairs (§A.3 rule 2)', () => {
  const typed = { typeOf: (p) => (p === 'specs/foo.md' ? 'spec' : null), reviewlessTypes: ctx.reviewlessTypes };
  const comments = [comment(10, ask({ type: 'charter', subject: ['specs/foo.md'] }))];
  const r = askClosure({ comments, ctx: typed, policy });
  assert.equal(r.pairsTotal, 0);
});

test('union — two effective ask types on one frontmatterless subject owe the union of both sets (INV3)', () => {
  const comments = [
    comment(10, ask({ type: 'code', subject: ['pkg/a.mjs'] })),
    comment(20, ask({ type: 'charter', subject: ['pkg/a.mjs'] })),
  ];
  const r = askClosure({ comments, ctx, policy });
  // owed(code) ∪ owed(charter) = {conformance, code-reviewer} ∪ {conformance} = 2 pairs
  assert.equal(r.pairsTotal, 2);
});

test('annotation consumption — a verdict findings body naming the ask annotations counts as consulting', () => {
  const comments = [
    comment(10, ask({ type: 'code', subject: ['pkg/a.mjs'], annotations: 'focus on the seam' })),
    comment(20, verdict({ review: 'code-reviewer', subject: ['pkg/a.mjs'], findings: 'ask annotations consulted; seam verified' })),
    comment(30, verdict({ review: 'conformance', subject: ['pkg/a.mjs'], findings: 'plain evidence line' })),
  ];
  const r = annotationConsumption({ comments });
  assert.equal(r.verdictsTotal, 2);
  assert.equal(r.consultingCount, 1);
});

test('aggregateWindow — sums pairs, averages rates, guards 0/0', () => {
  const w = aggregateWindow([
    { closure: { pairsTotal: 2, pairsClosed: 2, pairsOrdered: 2, closureRate: 1, orderedFraction: 1 }, annotations: { verdictsTotal: 2, consultingCount: 1 } },
    { closure: { pairsTotal: 2, pairsClosed: 1, pairsOrdered: 0, closureRate: 0.5, orderedFraction: 0 }, annotations: { verdictsTotal: 1, consultingCount: 0 } },
  ]);
  assert.equal(w.pairsTotal, 4);
  assert.equal(w.pairsClosed, 3);
  assert.equal(w.closureRate, 0.75);
  assert.equal(w.orderedFraction, 2 / 3); // window-level pin on the exact-count branch
  assert.equal(w.consultingFraction, 1 / 3);
  const empty = aggregateWindow([]);
  assert.equal(empty.pairsTotal, 0);
  assert.ok(!Number.isNaN(empty.closureRate));
});

test('empty stream — zeros, no NaN', () => {
  const r = askClosure({ comments: [], ctx, policy });
  assert.equal(r.pairsTotal, 0);
  assert.ok(!Number.isNaN(r.closureRate));
  assert.ok(!Number.isNaN(r.orderedFraction));
});
