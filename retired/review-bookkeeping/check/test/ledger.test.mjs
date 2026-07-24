// Upstream: spec-0002 §A.3 step 3 (code upstream via the per-package
// test-deps ledger; adr-0006 dec 4). Pins Open Q8's convention:
// nearest-ancestor test-deps.md + fenced grove-test-deps block.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLedger } from '../lib/ledger.mjs';

const ledgerBody = '```grove-test-deps\nschema: 1\nspecs:\n  - spec-0002-review-bookkeeping-check@v1\ndecisions:\n  - adr-0012-methodology-delivery-machinery\n```\n';

const tree = new Map([
  ['plugins/grove/check/test-deps.md', ledgerBody],
  ['plugins/grove/check/lib/check.mjs', 'const x=1;'],
  ['plugins/grove/check/lib/nested/deep.mjs', 'const y=1;'],
  ['src/other.mjs', 'const z=1;'],
]);

test('finds the nearest-ancestor test-deps.md for a code path', () => {
  const r = findLedger(tree, 'plugins/grove/check/lib/check.mjs');
  assert.equal(r.found, true);
  assert.equal(r.path, 'plugins/grove/check/test-deps.md');
});

test('walks up multiple levels to the nearest ancestor ledger', () => {
  const r = findLedger(tree, 'plugins/grove/check/lib/nested/deep.mjs');
  assert.equal(r.found, true);
  assert.equal(r.path, 'plugins/grove/check/test-deps.md');
});

test('parses declared spec + decision ids from the grove-test-deps block', () => {
  const r = findLedger(tree, 'plugins/grove/check/lib/check.mjs');
  assert.deepEqual(r.specs, ['spec-0002-review-bookkeeping-check@v1']);
  assert.deepEqual(r.decisions, ['adr-0012-methodology-delivery-machinery']);
  assert.deepEqual(r.ids, ['spec-0002-review-bookkeeping-check@v1', 'adr-0012-methodology-delivery-machinery']);
});

test('a code path with no ancestor ledger is not found (=> no-reviewable-upstream)', () => {
  const r = findLedger(tree, 'src/other.mjs');
  assert.equal(r.found, false);
});

test('the deepest ledger wins when several ancestors carry one', () => {
  const t2 = new Map([
    ['a/test-deps.md', '```grove-test-deps\nschema: 1\nspecs: [spec-outer]\n```'],
    ['a/b/test-deps.md', '```grove-test-deps\nschema: 1\nspecs: [spec-inner]\n```'],
    ['a/b/c.mjs', 'x'],
  ]);
  const r = findLedger(t2, 'a/b/c.mjs');
  assert.equal(r.path, 'a/b/test-deps.md');
  assert.deepEqual(r.specs, ['spec-inner']);
});
