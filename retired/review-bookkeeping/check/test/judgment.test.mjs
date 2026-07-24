// Upstream: adr-0015 Decision 1 + Consequence 4 (the judgment handoff shape).
// A reviewer emits ONLY judgment — verdict + subject + findings + attribution —
// and knows NOTHING of grove-fp-1, manifest_hashes, the §A.2 envelope, the
// check, or the PR. The judgment is a fenced `grove-review-judgment` block
// (mirroring grove's fenced-block precedent), parsed here fail-closed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJudgmentBlocks, parseJudgment, JudgmentError } from '../lib/judgment.mjs';

const block = (lines) => ['```grove-review-judgment', ...lines, '```'].join('\n');

const valid = block([
  'schema: 1',
  'review: conformance',
  'verdict: PASS',
  'subject:',
  '  - specs/foo.md',
  'producer: builder-agent',
  'reviewer: conformance-reviewer',
  'findings: faithful derivation; every AC traced to a scenario.',
]);

test('parses a well-formed judgment block into its fields (Consequence 4)', () => {
  const [inner] = extractJudgmentBlocks(valid);
  const j = parseJudgment(inner);
  assert.equal(j.review, 'conformance');
  assert.equal(j.verdict, 'PASS');
  assert.deepEqual(j.subject, ['specs/foo.md']);
  assert.equal(j.producer, 'builder-agent');
  assert.equal(j.reviewer, 'conformance-reviewer');
  assert.match(j.findings, /faithful derivation/);
});

test('a multi-file subject is preserved as a list (the emitter fans it out)', () => {
  const inner = block([
    'schema: 1',
    'review: spec-adversary',
    'verdict: APPROVE-READY',
    'subject:',
    '  - specs/a.md',
    '  - specs/b.md',
    'producer: p',
    'reviewer: r',
    'findings: ok',
  ]);
  const j = parseJudgment(extractJudgmentBlocks(inner)[0]);
  assert.deepEqual(j.subject, ['specs/a.md', 'specs/b.md']);
});

test('an empty findings body is preserved (the emitter transcribes, never invents)', () => {
  const inner = block([
    'schema: 1', 'review: code-reviewer', 'verdict: CLEAN',
    'subject:', '  - pkg/x.mjs', 'producer: p', 'reviewer: r', 'findings:',
  ]);
  const j = parseJudgment(extractJudgmentBlocks(inner)[0]);
  assert.equal(j.findings, '');
});

test('rejects an unknown review token (fail-closed)', () => {
  const inner = block([
    'schema: 1', 'review: vibe-check', 'verdict: PASS',
    'subject:', '  - a.md', 'producer: p', 'reviewer: r', 'findings: x',
  ]);
  assert.throws(() => parseJudgment(extractJudgmentBlocks(inner)[0]), JudgmentError);
});

test('rejects a missing subject (fail-closed)', () => {
  const inner = block([
    'schema: 1', 'review: conformance', 'verdict: PASS',
    'producer: p', 'reviewer: r', 'findings: x',
  ]);
  assert.throws(() => parseJudgment(extractJudgmentBlocks(inner)[0]), JudgmentError);
});

test('rejects missing producer/reviewer attribution (separation authority, adr-0012 AC7)', () => {
  const inner = block([
    'schema: 1', 'review: conformance', 'verdict: PASS',
    'subject:', '  - a.md', 'reviewer: r', 'findings: x',
  ]);
  assert.throws(() => parseJudgment(extractJudgmentBlocks(inner)[0]), JudgmentError);
});

test('rejects a missing findings key (findings is a required field)', () => {
  const inner = block([
    'schema: 1', 'review: conformance', 'verdict: PASS',
    'subject:', '  - a.md', 'producer: p', 'reviewer: r',
  ]);
  assert.throws(() => parseJudgment(extractJudgmentBlocks(inner)[0]), JudgmentError);
});

test('multiline findings via a block scalar are preserved verbatim (# stays literal)', () => {
  const inner = block([
    'schema: 1', 'review: conformance', 'verdict: PASS',
    'subject:', '  - a.md', 'producer: p', 'reviewer: r',
    'findings: |', '  first line', '  # not a comment', '  third line',
  ]);
  const j = parseJudgment(extractJudgmentBlocks(inner)[0]);
  assert.equal(j.findings, 'first line\n# not a comment\nthird line');
});

test('extractJudgmentBlocks finds the block inside surrounding prose', () => {
  const body = `Here is my review.\n\n${valid}\n\nThanks.`;
  assert.equal(extractJudgmentBlocks(body).length, 1);
});
