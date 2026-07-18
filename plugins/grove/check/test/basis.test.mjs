// Upstream: spec-0002 §A.3 (review-class basis) + adr-0015 Decision 2
// (the emitter and match.mjs MUST share one basis-selection function so
// they agree by construction — a reimplementation would mint stale records).
// This locks the extracted `reviewBasis` contract that both call sites import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArtifactIndex } from '../lib/artifact-index.mjs';
import { reviewBasis } from '../lib/basis.mjs';

const adr = (id) => `---\nid: ${id}\ntype: adr\nstatus: approved\n---\n`;
const spec = (id, impl) => `---\nid: ${id}\ntype: spec\nstatus: gated\nimplements: ${impl}\ndepends_on: [adr-noise]\n---\n`;
const specNoImpl = (id) => `---\nid: ${id}\ntype: spec\nstatus: gated\n---\n`;

function baseTree() {
  return new Map([
    ['decisions/adr-x.md', adr('adr-x')],
    ['decisions/adr-noise.md', adr('adr-noise')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
    ['specs/orphan.md', specNoImpl('spec-orphan')],
  ]);
}

const idx = (tree) => buildArtifactIndex(tree, ['decisions', 'specs', 'charters']);

test('quality review basis is the subject alone (§A.3)', () => {
  const tree = baseTree();
  const b = reviewBasis({ file: 'specs/foo.md', review: 'spec-adversary', tree, index: idx(tree) });
  assert.equal(b.isFidelity, false);
  assert.deepEqual(b.basis, ['specs/foo.md']);
  assert.equal(b.U.size, 0);
  assert.deepEqual(b.errors, []);
  assert.equal(b.basisComputable, true);
});

test('fidelity review basis is subject + implements upstream (§A.3)', () => {
  const tree = baseTree();
  const b = reviewBasis({ file: 'specs/foo.md', review: 'conformance', tree, index: idx(tree) });
  assert.equal(b.isFidelity, true);
  assert.deepEqual(b.basis, ['specs/foo.md', 'decisions/adr-x.md']);
  assert.equal(b.basisComputable, true);
});

test('fidelity subject with no reviewable upstream is not basis-computable (§A.3, fail-closed)', () => {
  const tree = baseTree();
  const b = reviewBasis({ file: 'specs/orphan.md', review: 'conformance', tree, index: idx(tree) });
  assert.equal(b.isFidelity, true);
  assert.equal(b.basisComputable, false);
  assert.equal(b.errors.length, 1);
  assert.equal(b.errors[0].kind, 'no-reviewable-upstream');
});
