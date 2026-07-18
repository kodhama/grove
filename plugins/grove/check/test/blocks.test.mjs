// Upstream: spec-0002 §A.1 "Block delimitation and index" bullet (v4,
// adr-0019 Decision 2/4); S7 (fence-level isolation). The rich
// extractTaggedBlocks conveys per-block {index, inner, wellFormed} so the
// record layer can read each grove-verdict block as its own record and a
// stray/unclosed fence costs at most its own block, never a sibling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTaggedBlocks, extractFencedBlocks } from '../lib/blocks.mjs';

const T = 'grove-verdict';

test('a body with no tagged block yields no blocks', () => {
  assert.deepEqual(extractTaggedBlocks('just prose', T), []);
  assert.deepEqual(extractTaggedBlocks(null, T), []);
});

test('a single bare-closed block is well-formed, index 0', () => {
  const body = '```grove-verdict\nschema: 1\n```';
  const blocks = extractTaggedBlocks(body, T);
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0], { index: 0, inner: 'schema: 1', wellFormed: true });
});

test('two bare-closed blocks get 0-based document-order indices, both well-formed', () => {
  const body = '```grove-verdict\na: 1\n```\n\n```grove-verdict\nb: 2\n```';
  const blocks = extractTaggedBlocks(body, T);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks.map((b) => [b.index, b.wellFormed]), [[0, true], [1, true]]);
  assert.deepEqual(blocks.map((b) => b.inner), ['a: 1', 'b: 2']);
});

test('an unclosed block is terminated by the next opening fence => malformed, and does NOT swallow the sibling (S7)', () => {
  // First block never bare-closes; the next opening grove-verdict fence ends it.
  const body = '```grove-verdict\na: 1\n\n```grove-verdict\nb: 2\n```';
  const blocks = extractTaggedBlocks(body, T);
  assert.equal(blocks.length, 2);
  // block 0: unclosed (no bare fence before the next opening fence) => malformed
  assert.deepEqual(blocks[0], { index: 0, inner: 'a: 1\n', wellFormed: false });
  // block 1: the sibling still counts, well-formed
  assert.deepEqual(blocks[1], { index: 1, inner: 'b: 2', wellFormed: true });
});

test('an unclosed block at end-of-input is malformed', () => {
  const body = '```grove-verdict\na: 1\nb: 2';
  const blocks = extractTaggedBlocks(body, T);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].wellFormed, false);
  assert.equal(blocks[0].index, 0);
});

test('a foreign info-string fence (```python) is inner content, NOT a terminator', () => {
  const body = '```grove-verdict\nline1\n```python\nline2\n```';
  const blocks = extractTaggedBlocks(body, T);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].wellFormed, true);
  assert.equal(blocks[0].inner, 'line1\n```python\nline2');
});

test('extractFencedBlocks keeps the single-surface contract: only well-formed inner strings', () => {
  const body = '```grove-verdict\na: 1\n\n```grove-verdict\nb: 2\n```';
  // block 0 unclosed (malformed) -> dropped; block 1 well-formed -> kept.
  assert.deepEqual(extractFencedBlocks(body, T), ['b: 2']);
});
