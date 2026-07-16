// Upstream: spec-0002 §A.1 (carrier, one-block-per-comment, inertness),
// §A.2 (schema/schema:1 validation), §A.4 (admissibility: unedited,
// authorized poster). INV9, INV16; S7, S17.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractVerdictBlocks, parseRecord, checkAdmissibility } from '../lib/records.mjs';

const validBody = (over = {}) => {
  const rec = {
    schema: 1,
    review: 'conformance',
    verdict: 'PASS',
    subject: '[specs/foo.md]',
    manifest_hashes: '\n  specs/foo.md: abc',
    fingerprint: 'grove-fp-1:' + 'a'.repeat(64),
    producer: 'agent-a',
    reviewer: 'agent-b',
    findings: 'all invariants hold',
    ...over,
  };
  const lines = Object.entries(rec)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`);
  return '```grove-verdict\n' + lines.join('\n') + '\n```';
};

const comment = (over = {}) => ({
  id: 1,
  body: validBody(),
  author: 'agent-b',
  authorAssociation: 'MEMBER',
  createdAt: '2026-07-16T00:00:00Z',
  updatedAt: '2026-07-16T00:00:00Z',
  ...over,
});

// --- block extraction (§A.1) ---

test('a comment with no grove-verdict block yields no blocks', () => {
  assert.deepEqual(extractVerdictBlocks('just prose, conformance passed trust me'), []);
});

test('extracts a single grove-verdict block, ignoring surrounding prose', () => {
  const body = 'Here is my review.\n\n' + validBody() + '\n\nthanks';
  assert.equal(extractVerdictBlocks(body).length, 1);
});

test('a comment with two grove-verdict blocks is recognized as multi-block', () => {
  const body = validBody() + '\n\n' + validBody();
  assert.equal(extractVerdictBlocks(body).length, 2);
});

// --- parseRecord: recognition / inertness (§A.1, §A.2) ---

test('parses a schema-valid record', () => {
  const r = parseRecord(comment());
  assert.equal(r.status, 'record');
  assert.equal(r.record.review, 'conformance');
  assert.deepEqual(r.record.subject, ['specs/foo.md']);
  assert.equal(r.record.producer, 'agent-a');
});

test('prose-only comment is not a record (none) — S7 never-reviewed', () => {
  assert.equal(parseRecord(comment({ body: 'conformance passed, promise' })).status, 'none');
});

test('a multi-block comment is wholly inert (S7)', () => {
  const body = validBody() + '\n\n' + validBody();
  assert.equal(parseRecord(comment({ body })).status, 'inert');
});

test('schema absent => inert (fail-closed by non-recognition)', () => {
  const body = validBody({ schema: undefined });
  assert.equal(parseRecord(comment({ body })).status, 'inert');
});

test('schema !== 1 => inert', () => {
  assert.equal(parseRecord(comment({ body: validBody({ schema: 2 }) })).status, 'inert');
});

test('unknown review enum => inert', () => {
  assert.equal(parseRecord(comment({ body: validBody({ review: 'vibes' }) })).status, 'inert');
});

test('empty subject list => inert', () => {
  assert.equal(parseRecord(comment({ body: validBody({ subject: '[]' }) })).status, 'inert');
});

test('missing producer => inert', () => {
  assert.equal(parseRecord(comment({ body: validBody({ producer: undefined }) })).status, 'inert');
});

test('malformed yaml inside the block => inert (S7)', () => {
  const body = '```grove-verdict\n\tschema: 1\n  review: conformance\n```';
  assert.equal(parseRecord(comment({ body })).status, 'inert');
});

// code-review fix #1: the fail-closed contract wants ANY parser throw
// converted to inert. A non-YamlError (e.g. RangeError from deep nesting)
// must NOT escape parseRecord and crash runCheck.
test('a non-YamlError parser throw yields an inert record, never escapes (fail-closed)', () => {
  // Deeply nested mapping overflows the recursive parser with a RangeError
  // (not a YamlError). The fail-closed contract must catch it too.
  let inner = '';
  for (let d = 0; d < 30000; d++) inner += ' '.repeat(d) + 'a:\n';
  inner += ' '.repeat(30000) + 'b: 1';
  const body = '```grove-verdict\n' + inner + '\n```';
  assert.doesNotThrow(() => parseRecord(comment({ body })));
  assert.equal(parseRecord(comment({ body })).status, 'inert');
});

// code-review fix #2 composition: a duplicate-key record becomes an inert
// record (surfaced as record-rejected), not a silent last-wins mis-parse.
test('a record with a duplicate mapping key is inert, not a silent mis-parse', () => {
  const body = '```grove-verdict\n' + validBody().slice('```grove-verdict\n'.length, -('\n```'.length)) + '\nverdict: FAIL\n```';
  assert.equal(parseRecord(comment({ body })).status, 'inert');
});

test('empty findings parses as a record (vacuity is decided downstream, §D)', () => {
  const r = parseRecord(comment({ body: validBody({ findings: '' }) }));
  assert.equal(r.status, 'record');
  assert.equal((r.record.findings ?? '').trim(), '');
});

// --- admissibility (§A.4) ---

test('unedited comment from a MEMBER is admissible (default poster policy)', () => {
  const a = checkAdmissibility(comment(), {});
  assert.equal(a.admissible, true);
});

test('an edited comment (updatedAt != createdAt) is rejected: edited (S17)', () => {
  const a = checkAdmissibility(comment({ updatedAt: '2026-07-16T01:00:00Z' }), {});
  assert.equal(a.admissible, false);
  assert.equal(a.cause, 'edited');
});

test('poster not in author_association default is rejected: unauthorized', () => {
  const a = checkAdmissibility(comment({ authorAssociation: 'NONE' }), {});
  assert.equal(a.admissible, false);
  assert.equal(a.cause, 'unauthorized');
});

test('a configured record_poster_allowlist overrides the default', () => {
  const policy = { record_poster_allowlist: ['ci-bot'] };
  assert.equal(checkAdmissibility(comment({ author: 'ci-bot', authorAssociation: 'NONE' }), policy).admissible, true);
  assert.equal(checkAdmissibility(comment({ author: 'agent-b', authorAssociation: 'OWNER' }), policy).admissible, false);
});
