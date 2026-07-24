// Graph resolution: spec-0002 §C.7 (INV18, S18).
// For every changed artifact, each intra-repo depends_on/implements id must
// resolve at HEAD to exactly one path. Dangling => red; collided => red naming
// both paths; cross-repo qualified ids are shape-checked only, never red for
// unresolvability.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArtifactIndex } from '../lib/artifact-index.mjs';
import { artifactMeta } from '../lib/frontmatter.mjs';
import { resolveGraph } from '../lib/graph.mjs';

const adr = (id) => `---\nid: ${id}\ntype: adr\nstatus: approved\n---\n`;
const spec = (id, impl, deps) =>
  `---\nid: ${id}\ntype: spec\nstatus: gated\nimplements: ${impl}\ndepends_on: [${deps.join(', ')}]\n---\n`;

const tree = new Map([
  ['decisions/adr-x.md', adr('adr-x')],
  ['decisions/adr-y.md', adr('adr-y')],
  ['specs/foo.md', spec('spec-foo', 'adr-x', ['adr-x', 'adr-y'])],
  // two files claiming spec-dup => collision
  ['specs/dup-a.md', `---\nid: spec-dup\ntype: spec\nstatus: gated\n---\n`],
  ['specs/dup-b.md', `---\nid: spec-dup\ntype: spec\nstatus: gated\n---\n`],
]);
const index = buildArtifactIndex(tree, ['decisions', 'specs', 'charters']);

test('an artifact whose ids all resolve has no graph violation (S18 clean)', () => {
  const g = resolveGraph(artifactMeta(tree.get('specs/foo.md')), index);
  assert.equal(g.ok, true);
  assert.equal(g.violations.length, 0);
});

test('a dangling depends_on id => unresolvable-reference naming the id (S18)', () => {
  const meta = artifactMeta(spec('spec-bar', 'adr-x', ['adr-missing']));
  const g = resolveGraph(meta, index);
  assert.equal(g.ok, false);
  assert.equal(g.violations.length, 1);
  assert.equal(g.violations[0].kind, 'dangling');
  assert.equal(g.violations[0].id, 'adr-missing');
});

test('a dangling implements id => unresolvable-reference (S18)', () => {
  const meta = artifactMeta(spec('spec-bar', 'adr-gone', ['adr-x']));
  const g = resolveGraph(meta, index);
  assert.equal(g.ok, false);
  assert.ok(g.violations.some((v) => v.id === 'adr-gone' && v.kind === 'dangling'));
});

test('a collided id => red naming BOTH paths, never a silent pick (S18)', () => {
  const meta = artifactMeta(spec('spec-bar', 'adr-x', ['spec-dup']));
  const g = resolveGraph(meta, index);
  assert.equal(g.ok, false);
  const v = g.violations.find((x) => x.id === 'spec-dup');
  assert.equal(v.kind, 'collision');
  assert.deepEqual(v.paths.sort(), ['specs/dup-a.md', 'specs/dup-b.md']);
});

test('a cross-repo qualified id is shape-checked only, never red (adr-0006 dec 3)', () => {
  const meta = artifactMeta(spec('spec-bar', 'adr-x', ['otherrepo/adr-42']));
  const g = resolveGraph(meta, index);
  assert.equal(g.ok, true);
  assert.equal(g.violations.length, 0);
});

test('version suffixes are stripped before resolution (versioning.md)', () => {
  const meta = artifactMeta(spec('spec-bar', 'adr-x@v3', ['adr-y@v2']));
  const g = resolveGraph(meta, index);
  assert.equal(g.ok, true);
});
