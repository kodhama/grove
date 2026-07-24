// Upstream: spec-0002 §A.3 step 1 (artifact index, ambiguous id),
// §C.7 (id resolution: dangling, collided, version strip, cross-repo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArtifactIndex, resolveId, stripVersion } from '../lib/artifact-index.mjs';

const fmFile = (id, extra = '') => `---\nid: ${id}\ntype: spec\n${extra}---\n`;

const tree = new Map([
  ['decisions/adr-0012-x.md', fmFile('adr-0012-methodology-delivery-machinery')],
  ['specs/0002-x.md', fmFile('spec-0002-review-bookkeeping-check')],
  ['charters/foo.md', fmFile('charter-foo')],
  ['README.md', '# not under an artifact dir\n'],
  ['src/code.mjs', 'const x = 1;'],
]);

const index = buildArtifactIndex(tree, ['decisions', 'specs', 'charters']);

test('stripVersion drops an @vN suffix but keeps a cross-repo prefix', () => {
  assert.equal(stripVersion('spec-x@v3'), 'spec-x');
  assert.equal(stripVersion('math-quest/spec-y@v3'), 'math-quest/spec-y');
  assert.equal(stripVersion('adr-0012-methodology-delivery-machinery'), 'adr-0012-methodology-delivery-machinery');
});

test('index maps id -> path only for files under the artifact dirs', () => {
  assert.equal(resolveId(index, 'spec-0002-review-bookkeeping-check').status, 'ok');
  assert.equal(resolveId(index, 'spec-0002-review-bookkeeping-check').path, 'specs/0002-x.md');
});

test('a version-pinned id resolves by its bare id (§versioning strip)', () => {
  const r = resolveId(index, 'adr-0012-methodology-delivery-machinery@v1');
  assert.equal(r.status, 'ok');
  assert.equal(r.path, 'decisions/adr-0012-x.md');
});

test('a dangling id resolves to nothing (S18)', () => {
  assert.equal(resolveId(index, 'adr-9999-nope').status, 'dangling');
});

test('two files claiming the same id collide (S18, §A.3 step 1)', () => {
  const t2 = new Map([
    ['specs/a.md', fmFile('spec-dup')],
    ['specs/b.md', fmFile('spec-dup')],
  ]);
  const idx2 = buildArtifactIndex(t2, ['specs']);
  const r = resolveId(idx2, 'spec-dup');
  assert.equal(r.status, 'collided');
  assert.deepEqual(r.paths.sort(), ['specs/a.md', 'specs/b.md']);
});

test('a cross-repo qualified id is shape-checked only, never resolved (§C.7)', () => {
  const r = resolveId(index, 'math-quest/spec-slice-01@v3');
  assert.equal(r.status, 'crossrepo');
});
