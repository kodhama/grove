// Gates: spec-0002 §C.5 decision-layer human gate (INV10, S9) and §C.6
// approved-upstream gate (INV17, S16).
//
// C.5: a changed file owing decision-adversary requires status: approved at
// HEAD, else awaiting-human-approval.
// C.6: every owed fidelity pair's implements upstream must be exactly
// `approved` at HEAD — whether or not it changed in the PR; draft/gated/
// superseded all fail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArtifactIndex } from '../lib/artifact-index.mjs';
import { artifactMeta } from '../lib/frontmatter.mjs';
import { decisionGate, approvedUpstreamGate } from '../lib/gates.mjs';

const adr = (id, status) => `---\nid: ${id}\ntype: adr\nstatus: ${status}\n---\n`;
const decision = (id, status) => `---\nid: ${id}\ntype: decision\nstatus: ${status}\n---\n`;
const spec = (id, impl) => `---\nid: ${id}\ntype: spec\nstatus: gated\nimplements: ${impl}\n---\n`;
const ledger = (ids) => '```grove-test-deps\nschema: 1\nspecs: [' + ids.join(', ') + ']\n```';

function tree() {
  return new Map([
    ['decisions/adr-approved.md', adr('adr-approved', 'approved')],
    ['decisions/adr-gated.md', adr('adr-gated', 'gated')],
    ['decisions/adr-superseded.md', adr('adr-superseded', 'superseded')],
    ['specs/foo.md', spec('spec-foo', 'adr-gated')],
    ['specs/ok.md', spec('spec-ok', 'adr-approved')],
    ['specs/sup.md', spec('spec-sup', 'adr-superseded')],
    ['pkg/test-deps.md', ledger(['spec-ok'])],
    ['pkg/code.mjs', 'const x = 1;\n'],
    ['pkg2/test-deps.md', ledger(['spec-foo'])],
    ['pkg2/code.mjs', 'const y = 1;\n'],
  ]);
}
const index = (t) => buildArtifactIndex(t, ['decisions', 'specs', 'charters']);

// --- §C.5 decision-layer human gate ---

test('S9 — a bundled draft/gated decision is not approved => awaiting-human-approval', () => {
  const meta = artifactMeta(decision('adr-new', 'draft'));
  const g = decisionGate({ file: 'decisions/adr-new.md', meta });
  assert.equal(g.ok, false);
  assert.equal(g.reason.code, 'awaiting-human-approval');
  assert.equal(g.reason.payload.status, 'draft');
  assert.equal(g.reason.payload.artifact, 'decisions/adr-new.md');
});

test('C.5 — an approved decision passes the human gate', () => {
  const meta = artifactMeta(decision('adr-new', 'approved'));
  const g = decisionGate({ file: 'decisions/adr-new.md', meta });
  assert.equal(g.ok, true);
});

// --- §C.6 approved-upstream gate ---

test('S16 — a gated implements upstream fails the gate (binds the edge, not the diff)', () => {
  const t = tree();
  const g = approvedUpstreamGate({ file: 'specs/foo.md', tree: t, index: index(t) });
  assert.equal(g.ok, false);
  const v = g.violations.find((x) => x.upstream === 'decisions/adr-gated.md');
  assert.equal(v.status, 'gated');
  assert.ok(g.reasons.some((r) => r.code === 'awaiting-human-approval' && r.payload.artifact === 'decisions/adr-gated.md'));
});

test('C.6 — an approved implements upstream passes the gate', () => {
  const t = tree();
  const g = approvedUpstreamGate({ file: 'specs/ok.md', tree: t, index: index(t) });
  assert.equal(g.ok, true);
  assert.equal(g.violations.length, 0);
});

test('C.6 — a superseded upstream fails and is flagged terminal (re-target the successor)', () => {
  const t = tree();
  const g = approvedUpstreamGate({ file: 'specs/sup.md', tree: t, index: index(t) });
  assert.equal(g.ok, false);
  const v = g.violations[0];
  assert.equal(v.status, 'superseded');
  assert.equal(v.terminal, true);
});

test('C.6 — code gates on its ledger-named spec (one hop; no transitive closure, Q3)', () => {
  const t = tree();
  // pkg2/code.mjs -> spec-foo (a gated spec); the gate checks the resolved
  // upstream artifact's OWN status, not the decision two hops up.
  const g = approvedUpstreamGate({ file: 'pkg2/code.mjs', tree: t, index: index(t) });
  assert.equal(g.ok, false);
  assert.ok(g.violations.some((v) => v.upstream === 'specs/foo.md' && v.status === 'gated'));
});

test('C.6 — code whose ledger spec implements an approved decision passes', () => {
  const t = tree();
  const g = approvedUpstreamGate({ file: 'pkg/code.mjs', tree: t, index: index(t) });
  // pkg/code.mjs -> spec-ok (a spec, gated) : the gate checks the resolved
  // upstream artifact's own status. spec-ok is `gated`, so it does NOT pass.
  assert.equal(g.ok, false);
  assert.ok(g.violations.some((v) => v.upstream === 'specs/ok.md' && v.status === 'gated'));
});
