// Upstream: spec-0002 §B (scope-mode table), §C.1 (scope + carrier keys),
// §C.2 step 0 (jurisdiction filter), §C.8 (carrier condition);
// INV19–INV21; S21–S23; adr-0013 (approved 2026-07-17).
//
// Slice 1 here: INV19 — the `grove-review-policy` block's `scope` key
// (absent ⇒ strict; unrecognized ⇒ strict, raw value preserved) and the
// `check_runtime_dir` / `check_workflow_path` carrier-of-record keys
// (absent ⇒ install defaults, provenance `defaulted`; written ⇒ `written`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePolicy, parseReviewPolicy } from '../lib/policy.mjs';

const policyText = (lines = []) =>
  ['```grove-review-policy', 'schema: 1', ...lines, '```'].join('\n');

const decl = (review, types, pass) =>
  `\`\`\`grove-review-declaration\nschema: 1\nreview: ${review}\ntypes: [${types.join(', ')}]\npass_class: [${pass.join(', ')}]\n\`\`\``;

// --- INV19: scope key resolution (silence = strict; misparse never softens) ---

test('INV19 — an absent scope key resolves to strict (fail-closed silence default)', () => {
  const rp = parseReviewPolicy(policyText());
  assert.equal(rp.scope, 'strict');
  assert.equal(rp.scopeRaw, null);
  assert.equal(rp.scopeUnrecognized, false);
});

test('INV19 — scope: strict and scope: scoped resolve verbatim', () => {
  assert.equal(parseReviewPolicy(policyText(['scope: strict'])).scope, 'strict');
  const scoped = parseReviewPolicy(policyText(['scope: scoped']));
  assert.equal(scoped.scope, 'scoped');
  assert.equal(scoped.scopeUnrecognized, false);
});

test('INV19 — an unrecognized scope value resolves to strict, raw value preserved (§C.1, W2)', () => {
  const rp = parseReviewPolicy(policyText(['scope: scopped']));
  assert.equal(rp.scope, 'strict');
  assert.equal(rp.scopeRaw, 'scopped');
  assert.equal(rp.scopeUnrecognized, true);
});

// INV19 (spec-0002): "any scope value other than exactly `strict` or `scoped`"
// resolves to strict — a misparse never softens jurisdiction (adr-0013 dec 2:
// softness is never inferred). A non-string scope (a YAML list / mapping) must
// NOT coerce via String() into a soft mode: `scope: [scoped]` would become
// String(['scoped']) === 'scoped' and silently enable scoped with
// scopeUnrecognized:false — a silent-softening path. It must fail-close to
// strict + unrecognized + raw preserved, exactly like any malformed value.
test('INV19 — a list-valued scope ([scoped]) fail-closes to strict, unrecognized, raw preserved (no silent-soften)', () => {
  const rp = parseReviewPolicy(policyText(['scope: [scoped]']));
  assert.equal(rp.scope, 'strict');
  assert.equal(rp.scopeUnrecognized, true);
  assert.equal(rp.scopeRaw, String(['scoped']));
});

test('INV19 — a mapping-valued scope fail-closes to strict, unrecognized, raw preserved', () => {
  const rp = parseReviewPolicy(policyText(['scope:', '  scoped: true']));
  assert.equal(rp.scope, 'strict');
  assert.equal(rp.scopeUnrecognized, true);
  assert.equal(typeof rp.scopeRaw, 'string');
});

// --- §C.1: carrier-of-record keys (absent ⇒ install defaults, never silent exclusion) ---

test('§C.1 — absent carrier keys fall to the install defaults with `defaulted` provenance', () => {
  const rp = parseReviewPolicy(policyText(['scope: scoped']));
  assert.deepEqual(rp.checkRuntimeDir, { path: '.grove/internal/check/', provenance: 'defaulted' });
  assert.deepEqual(rp.checkWorkflowPath, {
    path: '.github/workflows/grove-review-bookkeeping.yml',
    provenance: 'defaulted',
  });
});

test('§C.1 — written carrier keys are honored with `written` provenance', () => {
  const rp = parseReviewPolicy(
    policyText(['scope: scoped', 'check_runtime_dir: tools/check/', 'check_workflow_path: .github/workflows/custom.yml']),
  );
  assert.deepEqual(rp.checkRuntimeDir, { path: 'tools/check/', provenance: 'written' });
  assert.deepEqual(rp.checkWorkflowPath, { path: '.github/workflows/custom.yml', provenance: 'written' });
});

// --- assemblePolicy: {path, text} charter entries (INV21's reviewer-declaration
//     files need path tracking) — backward-compatible with bare strings ---

test('assemblePolicy accepts {path, text} charter entries and records reviewer-declaration paths (INV21 term)', () => {
  const p = assemblePolicy({
    reviewPolicyText: policyText(['scope: scoped']),
    reviewPolicyPath: 'charters/review-policy.md',
    charterTexts: [
      { path: 'charters/conformance-reviewer.md', text: decl('conformance', ['spec'], ['PASS']) },
      { path: 'charters/README.md', text: 'no declaration here' },
    ],
  });
  assert.deepEqual(p.declarationPaths, ['charters/conformance-reviewer.md']);
  assert.equal(p.reviewPolicyPath, 'charters/review-policy.md');
  assert.deepEqual(p.owed('spec'), ['conformance']);
});

test('assemblePolicy still tolerates bare-string charter entries (no paths tracked)', () => {
  const p = assemblePolicy({
    reviewPolicyText: policyText(),
    charterTexts: [decl('conformance', ['spec'], ['PASS'])],
  });
  assert.deepEqual(p.declarationPaths, []);
  assert.equal(p.reviewPolicyPath, null);
  assert.deepEqual(p.owed('spec'), ['conformance']);
  assert.equal(p.scope, 'strict');
});

test('assemblePolicy surfaces scope + carrier keys on the assembled policy', () => {
  const p = assemblePolicy({ reviewPolicyText: policyText(['scope: scoped']), charterTexts: [] });
  assert.equal(p.scope, 'scoped');
  assert.equal(p.checkRuntimeDir.path, '.grove/internal/check/');
  assert.equal(p.checkWorkflowPath.path, '.github/workflows/grove-review-bookkeeping.yml');
});

// ---------------------------------------------------------------------------
// Slice 2: §C.2 step 0 — the scoped-mode jurisdiction filter (INV20; S21, S22).
// runCheck gains `protectedPaths` (protected-branch blob listing for the two
// machinery carriers) — supplied here so the carrier fail-close (slice 3)
// stays satisfied, per S21's carrier-resolving Given.
// ---------------------------------------------------------------------------

import { runCheck } from '../lib/check.mjs';

const adr = (id, status = 'approved') => `---\nid: ${id}\ntype: adr\nstatus: ${status}\n---\n`;
const spec = (id, impl) => `---\nid: ${id}\ntype: spec\nstatus: gated\nimplements: ${impl}\n---\n`;
const fullCharterEntries = [
  { path: 'charters/conformance-reviewer.md', text: decl('conformance', ['spec', 'charter', 'code'], ['PASS']) },
  { path: 'charters/spec-adversary.md', text: decl('spec-adversary', ['spec'], ['APPROVE-READY']) },
  { path: 'charters/code-reviewer.md', text: decl('code-reviewer', ['code'], ['CLEAN', 'PASS-WITH-ADVISORIES']) },
  { path: 'charters/decision-adversary.md', text: decl('decision-adversary', ['adr', 'decision'], ['SOUND']) },
];

const scopedPolicy = assemblePolicy({
  reviewPolicyText: policyText(['scope: scoped', 'reviewless_types: [research, feedback]']),
  reviewPolicyPath: 'charters/review-policy.md',
  charterTexts: fullCharterEntries,
});
const strictPolicy = assemblePolicy({
  reviewPolicyText: policyText(['scope: strict', 'reviewless_types: [research, feedback]']),
  reviewPolicyPath: 'charters/review-policy.md',
  charterTexts: fullCharterEntries,
});

// Install-default carriers resolving at the protected branch (S21's Given):
// >=1 blob under .grove/internal/check/ and the workflow blob present.
const CARRIERS_OK = [
  '.grove/internal/check/lib/check.mjs',
  '.github/workflows/grove-review-bookkeeping.yml',
];

const pairKey = (r) => `${r.subject}::${r.review}`;

test('S21 — scoped: an out-of-scope file generates zero owed pairs and zero reasons (jurisdiction 0 of 1)', () => {
  const tree = new Map([['src/app/main.py', 'print("hi")\n']]);
  const d = runCheck({
    changed: ['src/app/main.py'], tree, comments: [], policy: scopedPolicy,
    protectedPaths: CARRIERS_OK,
  });
  assert.equal(d.rows.length, 0, JSON.stringify(d.rows));
  assert.equal(d.green, true);
  assert.equal(d.scope.mode, 'scoped');
  assert.deepEqual(d.scope.jurisdiction, { inScope: 0, total: 1 });
});

test('S21 (contrast) — strict on the identical PR owes conformance + code-reviewer and is red', () => {
  const tree = new Map([['src/app/main.py', 'print("hi")\n']]);
  const d = runCheck({ changed: ['src/app/main.py'], tree, comments: [], policy: strictPolicy });
  assert.equal(d.green, false);
  const pairs = d.rows.filter((r) => r.kind === 'pair').map(pairKey).sort();
  assert.deepEqual(pairs, ['src/app/main.py::code-reviewer', 'src/app/main.py::conformance']);
  assert.ok(d.rows.some((r) => r.reasons.some((x) => x.code === 'no-reviewable-upstream')));
});

test('INV19 — absent-scope policy carries NO scope descriptor in the derivation (byte-identical strict)', () => {
  const noScopePolicy = assemblePolicy({
    reviewPolicyText: policyText(['reviewless_types: [research]']),
    charterTexts: fullCharterEntries,
  });
  const tree = new Map([['src/app/main.py', 'print("hi")\n']]);
  const d = runCheck({ changed: ['src/app/main.py'], tree, comments: [], policy: noScopePolicy });
  assert.equal('scope' in d, false);
});

test('S22 — scoped: an in-scope unclaimed type (specs/widget.md, type: widget) owes the FULL set — INV7 intact in jurisdiction', () => {
  const tree = new Map([['specs/widget.md', '---\nid: widget-1\ntype: widget\nstatus: draft\n---\n']]);
  const d = runCheck({
    changed: ['specs/widget.md'], tree, comments: [], policy: scopedPolicy,
    protectedPaths: CARRIERS_OK,
  });
  assert.equal(d.green, false);
  const reviews = d.rows.filter((r) => r.kind === 'pair').map((r) => r.review).sort();
  assert.deepEqual(reviews, ['code-reviewer', 'conformance', 'decision-adversary', 'spec-adversary']);
  assert.deepEqual(d.scope.jurisdiction, { inScope: 1, total: 1 });
});

test('S22 — scoped: a typed artifact OUTSIDE artifact_dirs is in scope by type (mislocation is not an exit door) yet absent from the index', () => {
  const tree = new Map([
    ['notes/thing.md', '---\nid: spec-thing\ntype: spec\nstatus: gated\nimplements: adr-x\n---\n'],
    ['decisions/adr-x.md', adr('adr-x', 'approved')],
    // another changed artifact referencing the mislocated one:
    ['specs/other.md', '---\nid: spec-other\ntype: spec\nstatus: gated\nimplements: adr-x\ndepends_on: [spec-thing]\n---\n'],
  ]);
  const d = runCheck({
    changed: ['notes/thing.md', 'specs/other.md'], tree, comments: [], policy: scopedPolicy,
    protectedPaths: CARRIERS_OK,
  });
  // in scope by type: owes conformance + spec-adversary
  const thingPairs = d.rows.filter((r) => r.kind === 'pair' && r.subject === 'notes/thing.md').map((r) => r.review).sort();
  assert.deepEqual(thingPairs, ['conformance', 'spec-adversary']);
  // the index still globs artifact_dirs only: the inbound depends_on reference is red
  const unres = d.rows.find((r) => r.subject === 'specs/other.md' && r.reasons.some((x) => x.code === 'unresolvable-reference'));
  assert.ok(unres, 'inbound reference to a mislocated artifact must red as unresolvable-reference');
  assert.deepEqual(d.scope.jurisdiction, { inScope: 2, total: 2 });
});

test('S22 — scoped: an UNRECOGNIZED type outside artifact_dirs is in scope by type all the same and owes the full set', () => {
  const tree = new Map([['notes/gadget.md', '---\nid: gadget-1\ntype: widget\nstatus: draft\n---\n']]);
  const d = runCheck({
    changed: ['notes/gadget.md'], tree, comments: [], policy: scopedPolicy,
    protectedPaths: CARRIERS_OK,
  });
  assert.equal(d.green, false);
  const reviews = d.rows.filter((r) => r.kind === 'pair').map((r) => r.review).sort();
  assert.deepEqual(reviews, ['code-reviewer', 'conformance', 'decision-adversary', 'spec-adversary']);
});

test('INV20 — scoped: opted-in code (an ancestor test-deps ledger) is in jurisdiction', () => {
  const tree = new Map([
    ['decisions/adr-x.md', adr('adr-x', 'approved')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
    ['pkg/test-deps.md', '```grove-test-deps\nschema: 1\nspecs: [spec-foo]\n```'],
    ['pkg/code.mjs', 'export const x = 1;\n'],
  ]);
  const d = runCheck({
    changed: ['pkg/code.mjs'], tree, comments: [], policy: scopedPolicy,
    protectedPaths: CARRIERS_OK,
  });
  const pairs = d.rows.filter((r) => r.kind === 'pair').map(pairKey).sort();
  assert.deepEqual(pairs, ['pkg/code.mjs::code-reviewer', 'pkg/code.mjs::conformance']);
  assert.deepEqual(d.scope.jurisdiction, { inScope: 1, total: 1 });
});

test('INV20 — a file with frontmatter but NO type:, outside every basis, is out of scope (no type: declaration, no entry)', () => {
  const tree = new Map([['docs/note.md', '---\ntitle: hello\n---\nbody\n']]);
  const d = runCheck({
    changed: ['docs/note.md'], tree, comments: [], policy: scopedPolicy,
    protectedPaths: CARRIERS_OK,
  });
  assert.equal(d.rows.length, 0);
  assert.deepEqual(d.scope.jurisdiction, { inScope: 0, total: 1 });
});

// ---------------------------------------------------------------------------
// Slice 3: §C.2 carrier fail-close (§C.8, INV21, S23; adr-0013 dec 1/AC4).
// In scoped mode the two machinery carriers — check_runtime_dir (default
// .grove/internal/check/) and check_workflow_path (default the workflow file) — must
// EXIST at the protected-branch commit; else a file-level red with
// carrier-unresolved. runCheck consumes `protectedPaths` (the protected-branch
// blob listing) and calls resolveCarriers.
// ---------------------------------------------------------------------------

test('S23 — scoped: absent carrier keys + defaults that exist nowhere ⇒ two carrier-unresolved reds naming key/path/defaulted', () => {
  // no changed files at all — the carrier check is independent of the diff.
  const d = runCheck({
    changed: [], tree: new Map(), comments: [], policy: scopedPolicy,
    protectedPaths: [], // the install defaults exist nowhere on the protected branch
  });
  assert.equal(d.green, false);
  const carrierRows = d.rows.filter((r) => r.reasons.some((x) => x.code === 'carrier-unresolved'));
  assert.equal(carrierRows.length, 2, JSON.stringify(d.rows));
  const byKey = new Map();
  for (const r of carrierRows) {
    const cu = r.reasons.find((x) => x.code === 'carrier-unresolved');
    byKey.set(cu.payload.key, cu.payload);
  }
  assert.deepEqual(byKey.get('check_runtime_dir'), {
    key: 'check_runtime_dir', path: '.grove/internal/check/', provenance: 'defaulted',
  });
  assert.deepEqual(byKey.get('check_workflow_path'), {
    key: 'check_workflow_path', path: '.github/workflows/grove-review-bookkeeping.yml', provenance: 'defaulted',
  });
  // file-level rows carry the resolved path as their subject
  assert.ok(carrierRows.some((r) => r.subject === '.grove/internal/check/'));
  assert.ok(carrierRows.some((r) => r.subject === '.github/workflows/grove-review-bookkeeping.yml'));
});

test('S23 — scoped: written carrier keys naming real protected-branch paths resolve (no carrier row)', () => {
  const writtenPolicy = assemblePolicy({
    reviewPolicyText: policyText([
      'scope: scoped',
      'check_runtime_dir: tools/check/',
      'check_workflow_path: .github/workflows/custom.yml',
    ]),
    reviewPolicyPath: 'charters/review-policy.md',
    charterTexts: fullCharterEntries,
  });
  const d = runCheck({
    changed: [], tree: new Map(), comments: [], policy: writtenPolicy,
    protectedPaths: ['tools/check/lib/x.mjs', '.github/workflows/custom.yml'],
  });
  assert.equal(d.green, true);
  assert.equal(d.rows.length, 0);
});

test('S23 — scoped: one carrier present, one missing ⇒ exactly one carrier-unresolved red', () => {
  const d = runCheck({
    changed: [], tree: new Map(), comments: [], policy: scopedPolicy,
    // runtime dir present (a blob under the prefix), workflow file absent
    protectedPaths: ['.grove/internal/check/lib/check.mjs'],
  });
  assert.equal(d.green, false);
  const carrierRows = d.rows.filter((r) => r.reasons.some((x) => x.code === 'carrier-unresolved'));
  assert.equal(carrierRows.length, 1);
  const cu = carrierRows[0].reasons.find((x) => x.code === 'carrier-unresolved');
  assert.equal(cu.payload.key, 'check_workflow_path');
});

test('INV19 — strict mode never runs the carrier fail-close (no protectedPaths needed, byte-identical)', () => {
  const d = runCheck({ changed: [], tree: new Map(), comments: [], policy: strictPolicy });
  assert.equal(d.green, true);
  assert.equal(d.rows.length, 0);
  assert.ok(!d.rows.some((r) => r.reasons?.some((x) => x.code === 'carrier-unresolved')));
});

test('§D remedy-hint marker — an unclaimed frontmatter type marks its owed rows with the classified type (round-3 remedy hint)', () => {
  const tree = new Map([['specs/widget.md', '---\nid: widget-1\ntype: widget\nstatus: draft\n---\n']]);
  const d = runCheck({
    changed: ['specs/widget.md'], tree, comments: [], policy: scopedPolicy,
    protectedPaths: CARRIERS_OK,
  });
  const pairRows = d.rows.filter((r) => r.kind === 'pair' && r.subject === 'specs/widget.md');
  assert.ok(pairRows.length > 0);
  for (const r of pairRows) assert.deepEqual(r.remedy, { type: 'widget' });
});

test('§D remedy-hint marker — a declared type (spec) carries NO remedy marker', () => {
  const tree = new Map([
    ['decisions/adr-x.md', adr('adr-x', 'approved')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
  ]);
  const d = runCheck({
    changed: ['specs/foo.md'], tree, comments: [], policy: scopedPolicy,
    protectedPaths: CARRIERS_OK,
  });
  const pairRows = d.rows.filter((r) => r.kind === 'pair');
  assert.ok(pairRows.length > 0);
  for (const r of pairRows) assert.equal(r.remedy, undefined);
});

test('INV21 — gate carriers are in scope in scoped mode: declaration file, policy file, ledger, runtime-dir file, workflow file', () => {
  const declPolicy = assemblePolicy({
    reviewPolicyText: policyText(['scope: scoped']),
    reviewPolicyPath: '.grove/review.toml',
    charterTexts: [{ path: '.claude/agents/conformance-reviewer.md', text: decl('conformance', ['spec', 'code'], ['PASS']) }],
  });
  const changed = [
    '.claude/agents/conformance-reviewer.md', // reviewer-declaration file
    '.grove/review.toml',                     // the review-policy file itself
    '.grove/internal/review-wiring.toml',     // the carrier-key wiring (adr-0018 D10) — machinery
    'pkg/test-deps.md',                       // a test-deps ledger
    '.grove/internal/check/lib/match.mjs',             // under check_runtime_dir (default)
    '.github/workflows/grove-review-bookkeeping.yml', // check_workflow_path (default)
    'src/app/main.py',                        // NOT a carrier — out of scope
  ];
  const tree = new Map(changed.map((p) => [p, p.endsWith('.md') ? '# doc\n' : 'code\n']));
  const d = runCheck({ changed, tree, comments: [], policy: declPolicy, protectedPaths: CARRIERS_OK });
  assert.deepEqual(d.scope.jurisdiction, { inScope: 6, total: 7 });
  // the out-of-scope file has no rows at all
  assert.ok(!d.rows.some((r) => r.subject === 'src/app/main.py'));
  // the in-scope carriers generate owed pairs per their classification
  assert.ok(d.rows.some((r) => r.subject === '.grove/internal/check/lib/match.mjs'));
});
