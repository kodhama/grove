// Upstream: adr-0015 Decision 2 + Consequence 2 (the record-emitter) and its
// success criterion — the ROUND-TRIP: judgment -> emitter -> record -> the
// ACTUAL check (runCheck) -> the owed pair goes GREEN. If the emitted record
// isn't accepted by the real check, the emitter is wrong. This proves
// emitter/check agreement by construction (they share reviewBasis + grove-fp-1).
//
// The N3 basis-granularity pin (adr-0015 Consequence 2): the check recomputes
// freshness PER owed-pair file, so the emitter fans a multi-file subject out to
// ONE record per reviewed file, each single-subject with its own basis +
// fingerprint. These tests exercise that fan-out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePolicy } from '../lib/policy.mjs';
import { buildArtifactIndex } from '../lib/artifact-index.mjs';
import { parseRecord } from '../lib/records.mjs';
import { runCheck } from '../lib/check.mjs';
import { parseJudgment, extractJudgmentBlocks } from '../lib/judgment.mjs';
import { emitRecords, serializeRecord } from '../lib/emit.mjs';

const adr = (id, status = 'approved') => `---\nid: ${id}\ntype: adr\nstatus: ${status}\n---\n`;
const spec = (id, impl) => `---\nid: ${id}\ntype: spec\nstatus: gated\nimplements: ${impl}\n---\n`;
const charter = (id, impl) => `---\nid: ${id}\ntype: charter\nstatus: gated\nimplements: ${impl}\n---\n`;

function baseTree() {
  return new Map([
    ['decisions/adr-x.md', adr('adr-x')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
    ['specs/bar.md', spec('spec-bar', 'adr-x')],
    ['charters/c.md', charter('charter-c', 'adr-x')],
  ]);
}

const reviewPolicyText = '```grove-review-policy\nschema: 1\n```';
const decl = (review, types, pass) =>
  `\`\`\`grove-review-declaration\nschema: 1\nreview: ${review}\ntypes: [${types.join(', ')}]\npass_class: [${pass.join(', ')}]\n\`\`\``;
// A policy where each of the two exercised types owes EXACTLY one review, so a
// single judgment -> single record makes the whole check green:
//   spec    -> spec-adversary (quality)   charter -> conformance (fidelity)
const charters = [
  decl('conformance', ['charter'], ['PASS']),
  decl('spec-adversary', ['spec'], ['APPROVE-READY']),
  decl('code-reviewer', ['code'], ['CLEAN']),
  decl('decision-adversary', ['adr'], ['SOUND']),
];
const policy = assemblePolicy({ reviewPolicyText, charterTexts: charters });
const index = (tree) => buildArtifactIndex(tree, policy.artifactDirs);

const judgmentBlock = ({ review, verdict, subject, producer = 'builder', reviewer = 'reviewer', findings = 'evidence for the verdict.' }) => {
  // findings is emitted as a block scalar (`|`) — the shape a reviewer uses for
  // multiline prose; an empty findings is a bare key (vacuous).
  const findingsLines = findings === '' ? ['findings:'] : ['findings: |', ...findings.split('\n').map((l) => `  ${l}`)];
  return [
    '```grove-review-judgment',
    'schema: 1',
    `review: ${review}`,
    `verdict: ${verdict}`,
    'subject:',
    ...subject.map((s) => `  - ${s}`),
    `producer: ${producer}`,
    `reviewer: ${reviewer}`,
    ...findingsLines,
    '```',
  ].join('\n');
};

const parse = (body) => parseJudgment(extractJudgmentBlocks(body)[0]);
const asComment = (block, i) => ({ body: block, author: 'alice', authorAssociation: 'MEMBER', id: i + 1 });

// --- the emitted record is a valid §A.2 record (records.mjs contract) ---

test('emitted record parses as a schema-valid §A.2 record (subject ARRAY, machine fingerprint)', () => {
  const tree = baseTree();
  const judgment = parse(judgmentBlock({ review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'] }));
  const { records } = emitRecords({ judgment, tree, index: index(tree) });
  assert.equal(records.length, 1);
  const pr = parseRecord({ body: records[0].block });
  assert.equal(pr.status, 'record');
  assert.equal(pr.record.schema, 1);
  assert.ok(Array.isArray(pr.record.subject));
  assert.deepEqual(pr.record.subject, ['specs/foo.md']);
  assert.match(pr.record.fingerprint, /^grove-fp-1:[0-9a-f]{64}$/);
  assert.equal(pr.record.producer, 'builder');
  assert.equal(pr.record.reviewer, 'reviewer');
  assert.equal(typeof pr.record.manifest_hashes, 'object');
});

// --- THE ROUND-TRIP: quality review (basis = subject alone) ---

test('ROUND-TRIP quality: judgment -> emit -> record -> runCheck GREEN', () => {
  const tree = baseTree();
  const judgment = parse(judgmentBlock({ review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'] }));
  const { records } = emitRecords({ judgment, tree, index: index(tree) });
  const comments = records.map((r, i) => asComment(r.block, i));
  const result = runCheck({ changed: ['specs/foo.md'], tree, comments, policy });
  assert.equal(result.green, true, JSON.stringify(result.rows, null, 2));
});

// --- THE ROUND-TRIP: fidelity review (basis = subject + derived upstream U) ---
// The load-bearing case: the emitter's fingerprint must equal the check's,
// which requires resolving the SAME upstream U — proven only by sharing code.

test('ROUND-TRIP fidelity: conformance judgment -> emit -> record -> runCheck GREEN', () => {
  const tree = baseTree();
  const judgment = parse(judgmentBlock({ review: 'conformance', verdict: 'PASS', subject: ['charters/c.md'] }));
  const { records } = emitRecords({ judgment, tree, index: index(tree) });
  const comments = records.map((r, i) => asComment(r.block, i));
  const result = runCheck({ changed: ['charters/c.md'], tree, comments, policy });
  assert.equal(result.green, true, JSON.stringify(result.rows, null, 2));
});

// --- N3 fan-out: a multi-file subject becomes one record per file, each green ---

test('ROUND-TRIP fan-out: a 2-file quality judgment emits 2 records, both pairs GREEN', () => {
  const tree = baseTree();
  const judgment = parse(judgmentBlock({ review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md', 'specs/bar.md'] }));
  const { records } = emitRecords({ judgment, tree, index: index(tree) });
  assert.equal(records.length, 2, 'one record per reviewed file (per-file basis)');
  // each record is single-subject
  for (const r of records) {
    const pr = parseRecord({ body: r.block });
    assert.equal(pr.record.subject.length, 1);
  }
  const comments = records.map((r, i) => asComment(r.block, i));
  const result = runCheck({ changed: ['specs/foo.md', 'specs/bar.md'], tree, comments, policy });
  assert.equal(result.green, true, JSON.stringify(result.rows, null, 2));
});

// --- the emitter surfaces, never papers over, a non-computable fidelity basis ---

test('a fidelity subject with no reviewable upstream is surfaced as an error, no record minted', () => {
  const tree = new Map([['charters/orphan.md', `---\nid: charter-orphan\ntype: charter\nstatus: gated\n---\n`]]);
  const judgment = parse(judgmentBlock({ review: 'conformance', verdict: 'PASS', subject: ['charters/orphan.md'] }));
  const { records, errors } = emitRecords({ judgment, tree, index: index(tree) });
  assert.equal(records.length, 0);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].kind, 'no-reviewable-upstream');
});

// --- findings fidelity: multiline + a '#' survive serialization round-trip ---

test('serializeRecord preserves multiline findings with a # (block scalar)', () => {
  const tree = baseTree();
  const findings = 'line one\n# a heading, not a comment\nline three';
  const judgment = parse(judgmentBlock({ review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], findings }));
  const { records } = emitRecords({ judgment, tree, index: index(tree) });
  const pr = parseRecord({ body: records[0].block });
  assert.equal(pr.status, 'record');
  assert.equal(pr.record.findings, findings);
});

// --- an empty-findings judgment emits a vacuous (schema-valid) record ---

test('empty findings emits a schema-valid record that the check reds as vacuous (emitter transcribes, never invents)', () => {
  const tree = baseTree();
  const judgment = parse(judgmentBlock({ review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], findings: '' }));
  const { records } = emitRecords({ judgment, tree, index: index(tree) });
  const pr = parseRecord({ body: records[0].block });
  assert.equal(pr.status, 'record'); // still schema-valid
  const result = runCheck({ changed: ['specs/foo.md'], tree, comments: [asComment(records[0].block, 0)], policy });
  assert.equal(result.green, false);
  const codes = result.rows.flatMap((r) => r.reasons.map((x) => x.code));
  assert.ok(codes.includes('vacuous-evidence'), codes.join(','));
});
