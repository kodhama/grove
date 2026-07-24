// Upstream: spec-0002 §B (type from HEAD frontmatter; no frontmatter => code),
// §A.3 step 2 (implements), §C.7 (depends_on/implements ids).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, artifactMeta } from '../lib/frontmatter.mjs';

const fm = (obj) => '---\n' + Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n---\n\n# body\n';

test('extracts frontmatter object', () => {
  const c = fm({ id: 'spec-x', type: 'spec', status: 'approved', implements: 'adr-x' });
  const f = parseFrontmatter(c);
  assert.equal(f.id, 'spec-x');
  assert.equal(f.type, 'spec');
});

test('a file with no frontmatter returns null (=> code, decided by caller)', () => {
  assert.equal(parseFrontmatter('export const x = 1;\n'), null);
  assert.equal(parseFrontmatter('#!/usr/bin/env node\n'), null);
});

test('artifactMeta reports hasFrontmatter=false for code', () => {
  const m = artifactMeta('const x = 1;');
  assert.equal(m.hasFrontmatter, false);
  assert.equal(m.type, null);
});

test('artifactMeta reads type, status, implements, depends_on', () => {
  const c = fm({
    id: 'spec-x',
    type: 'spec',
    status: 'gated',
    implements: 'adr-x',
    depends_on: '[adr-x, adr-y]',
  });
  const m = artifactMeta(c);
  assert.equal(m.hasFrontmatter, true);
  assert.equal(m.type, 'spec');
  assert.equal(m.status, 'gated');
  assert.equal(m.implements, 'adr-x');
  assert.deepEqual(m.depends_on, ['adr-x', 'adr-y']);
});

test('implements/status tolerate trailing # comments (real frontmatter shape)', () => {
  const c = '---\n'
    + 'id: spec-0002-review-bookkeeping-check\n'
    + 'type: spec\n'
    + 'status: approved  # gated -> approved: the human act\n'
    + 'implements: adr-0012-methodology-delivery-machinery  # realized contract\n'
    + '---\n';
  const m = artifactMeta(c);
  assert.equal(m.status, 'approved');
  assert.equal(m.implements, 'adr-0012-methodology-delivery-machinery');
});

test('a single-string depends_on is normalized to a one-element list', () => {
  const c = fm({ id: 'a', type: 'charter', implements: 'adr-x', depends_on: 'adr-x' });
  assert.deepEqual(artifactMeta(c).depends_on, ['adr-x']);
});
