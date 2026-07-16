// Upstream: spec-0002 §A.3 (grove-fp-1 algorithm), INV3.
// Expected digests are computed independently (scripted once, embedded as
// fixed constants) so these tests are not a mirror of the implementation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groveFp1 } from '../lib/fingerprint.mjs';

// tree helper: Map path -> utf8 content string
const tree = (obj) => new Map(Object.entries(obj));

test('S single present file matches independently-computed digest', () => {
  const fp = groveFp1(['a.md'], tree({ 'a.md': 'hello' }));
  assert.equal(fp, 'grove-fp-1:f6d58087a584fcfbcbba71111b56690a0dcbb7e8e132f02f46dd5210d222153e');
});

test('absent path uses the ABSENT sentinel (\\x00ABSENT\\x00)', () => {
  const fp = groveFp1(['gone.md'], tree({}));
  assert.equal(fp, 'grove-fp-1:abb3c9e6c5bcb704dcfccca6f24e22a0d6fd156bd441b66d2e4a7d8b44f361f3');
});

test('input is byte-sorted and de-duplicated before hashing (S12 basis discipline)', () => {
  // pass out of order + a duplicate; must equal the sorted/deduped digest
  const fp = groveFp1(['b.md', 'a.md', 'a.md'], tree({ 'a.md': 'A', 'b.md': 'B' }));
  assert.equal(fp, 'grove-fp-1:0b5dbbb5fc4ff4390c935c6582ed6b88011c8b67aeb143fe7213bcb9424bfcb8');
});

test('order of the input list does not change the fingerprint', () => {
  const t = tree({ 'a.md': 'A', 'b.md': 'B' });
  assert.equal(groveFp1(['a.md', 'b.md'], t), groveFp1(['b.md', 'a.md'], t));
});

test('a content edit changes the fingerprint (freshness basis)', () => {
  const before = groveFp1(['a.md'], tree({ 'a.md': 'A' }));
  const after = groveFp1(['a.md'], tree({ 'a.md': 'A2' }));
  assert.notEqual(before, after);
});

test('deleting a basis path (ABSENT) changes the fingerprint (S12)', () => {
  const present = groveFp1(['a.md'], tree({ 'a.md': 'A' }));
  const deleted = groveFp1(['a.md'], tree({}));
  assert.notEqual(present, deleted);
});

test('membership change (adding an upstream path) changes the fingerprint (S2)', () => {
  const t = tree({ 'a.md': 'A', 'up.md': 'U' });
  const withoutUpstream = groveFp1(['a.md'], t);
  const withUpstream = groveFp1(['a.md', 'up.md'], t);
  assert.notEqual(withoutUpstream, withUpstream);
});

test('output shape is grove-fp-1:<64-hex>', () => {
  const fp = groveFp1(['a.md'], tree({ 'a.md': 'x' }));
  assert.match(fp, /^grove-fp-1:[0-9a-f]{64}$/);
});
