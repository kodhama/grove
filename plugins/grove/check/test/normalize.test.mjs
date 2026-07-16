// Upstream: spec-0002 Terms "Path normalization" (fail-closed by non-match).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath } from '../lib/normalize.mjs';

test('strips a leading ./', () => {
  assert.equal(normalizePath('./specs/foo.md'), 'specs/foo.md');
  assert.equal(normalizePath('././specs/foo.md'), 'specs/foo.md');
});

test('collapses duplicate separators', () => {
  assert.equal(normalizePath('specs//foo.md'), 'specs/foo.md');
  assert.equal(normalizePath('a///b////c.md'), 'a/b/c.md');
});

test('a path with a .. segment matches nothing (null)', () => {
  assert.equal(normalizePath('specs/../secrets.md'), null);
  assert.equal(normalizePath('../outside.md'), null);
});

test('an absolute (leading /) path is not repo-relative (null)', () => {
  assert.equal(normalizePath('/etc/passwd'), null);
});

test('an empty or nullish path is null', () => {
  assert.equal(normalizePath(''), null);
  assert.equal(normalizePath(null), null);
  assert.equal(normalizePath(undefined), null);
});

test('already-normal paths pass through unchanged (exact equality basis)', () => {
  assert.equal(normalizePath('specs/foo.md'), 'specs/foo.md');
  assert.equal(normalizePath('plugins/grove/check/lib/a.mjs'), 'plugins/grove/check/lib/a.mjs');
});
