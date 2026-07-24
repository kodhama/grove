// Upstream: spec-0002 §A.3 (upstream set U for fidelity records), INV4.
// U is the implements edge (artifacts) or the ledger-named specs/decisions
// (code) — never the rest of depends_on. Missing edge => no-reviewable-upstream;
// unresolved id => unresolvable-reference; the basis is never computed over a
// silently smaller set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArtifactIndex } from '../lib/artifact-index.mjs';
import { resolveUpstream } from '../lib/upstream.mjs';

const spec = (id, impl) => `---\nid: ${id}\ntype: spec\nstatus: gated\nimplements: ${impl}\ndepends_on: [adr-noise]\n---\n`;
const adr = (id) => `---\nid: ${id}\ntype: adr\nstatus: approved\n---\n`;
const ledger = (ids) => '```grove-test-deps\nschema: 1\nspecs: [' + ids.join(', ') + ']\n```';

const tree = new Map([
  ['decisions/adr-x.md', adr('adr-x')],
  ['specs/foo.md', spec('spec-foo', 'adr-x')],
  ['specs/nodecl.md', '---\nid: spec-nodecl\ntype: spec\nstatus: gated\n---\n'],
  ['specs/dangling.md', spec('spec-dangling', 'adr-missing')],
  ['pkg/test-deps.md', ledger(['spec-foo'])],
  ['pkg/code.mjs', 'const x = 1;'],
  ['loose/code.mjs', 'const y = 1;'],
]);
const index = buildArtifactIndex(tree, ['decisions', 'specs', 'charters']);

test('an artifact subject resolves U from its implements target (not depends_on)', () => {
  const r = resolveUpstream(['specs/foo.md'], tree, index);
  assert.deepEqual([...r.U].sort(), ['decisions/adr-x.md']);
  assert.equal(r.errors.length, 0);
  // adr-noise (a depends_on builds-on edge) must NOT be in U
  assert.ok(![...r.U].some((p) => p.includes('noise')));
});

test('a fidelity-owing artifact with no implements => no-reviewable-upstream (S20)', () => {
  const r = resolveUpstream(['specs/nodecl.md'], tree, index);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].kind, 'no-reviewable-upstream');
  assert.equal(r.errors[0].subject, 'specs/nodecl.md');
});

test('an implements id that does not resolve => unresolvable-reference', () => {
  const r = resolveUpstream(['specs/dangling.md'], tree, index);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].kind, 'unresolvable-reference');
});

test('code resolves U via the nearest test-deps ledger', () => {
  const r = resolveUpstream(['pkg/code.mjs'], tree, index);
  assert.deepEqual([...r.U].sort(), ['specs/foo.md']);
  assert.equal(r.errors.length, 0);
});

test('code with no ledger entry => no-reviewable-upstream (fail-closed)', () => {
  const r = resolveUpstream(['loose/code.mjs'], tree, index);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].kind, 'no-reviewable-upstream');
});

test('U is a union over all subjects', () => {
  const r = resolveUpstream(['specs/foo.md', 'pkg/code.mjs'], tree, index);
  assert.deepEqual([...r.U].sort(), ['decisions/adr-x.md', 'specs/foo.md']);
});
