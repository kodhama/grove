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

// --- §C.1: carrier-of-record keys (absent ⇒ install defaults, never silent exclusion) ---

test('§C.1 — absent carrier keys fall to the install defaults with `defaulted` provenance', () => {
  const rp = parseReviewPolicy(policyText(['scope: scoped']));
  assert.deepEqual(rp.checkRuntimeDir, { path: '.grove/check/', provenance: 'defaulted' });
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
  assert.equal(p.checkRuntimeDir.path, '.grove/check/');
  assert.equal(p.checkWorkflowPath.path, '.github/workflows/grove-review-bookkeeping.yml');
});
