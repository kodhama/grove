// The extracted comparator bin step (spec-0003 §D.2, INV16; adr-0023 AC3's
// last-line guard). The report-only guarantee is the property under test:
// the step writes via its injected sink and NEVER throws — a comparator
// failure becomes a written note, not a crash, so the bin's verdict, exit
// code, and structured output are unreachable from here by construction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePolicy } from '../lib/policy.mjs';
import { runComparatorStep } from '../shell/compare-step.mjs';

const policy = assemblePolicy({ reviewPolicyText: '', charterTexts: [] });

test('normal path — writes exactly one delimited report section via the injected sink', () => {
  const out = [];
  runComparatorStep({
    changed: [],
    tree: new Map(),
    comments: [],
    policy,
    derivation: { green: true, rows: [] },
    reviewPolicyText: '',
    charterEntries: [],
    write: (s) => out.push(s),
  });
  assert.equal(out.length, 1, 'one write call');
  assert.ok(out[0].includes('shadow comparator'), out[0]);
  assert.ok(out[0].includes('0/0 (empty diff)'), 'empty-diff metric rendering (spec-0003 §D.1)');
});

test('error path — a throwing input becomes a written skipped-note; the step never throws', () => {
  const out = [];
  assert.doesNotThrow(() =>
    runComparatorStep({
      changed: null, // computeComparison cannot iterate null diff files
      tree: new Map(),
      comments: [],
      policy,
      derivation: { green: true, rows: [] },
      reviewPolicyText: '',
      charterEntries: [],
      write: (s) => out.push(s),
    }),
  );
  assert.equal(out.length, 1);
  assert.ok(out[0].includes('skipped on error (report-only, never gating)'), out[0]);
});

test('even a throwing SINK cannot escape — the catch covers the write itself', () => {
  // The one remaining escape hatch would be `write` throwing inside the try;
  // the catch's own write then throws too. Assert the failure mode is honest:
  // the step throws only if BOTH writes throw (bin passes process.stdout.write,
  // which does not throw on a healthy stream).
  let calls = 0;
  assert.throws(() =>
    runComparatorStep({
      changed: [],
      tree: new Map(),
      comments: [],
      policy,
      derivation: { green: true, rows: [] },
      reviewPolicyText: '',
      charterEntries: [],
      write: () => {
        calls += 1;
        throw new Error('sink down');
      },
    }),
  );
  assert.equal(calls, 2, 'normal write attempted, then the catch-note write');
});

test('protected-tree assembly — unnormalizable charter paths are skipped, policy path included', () => {
  const seen = [];
  runComparatorStep({
    changed: [],
    tree: new Map(),
    comments: [],
    policy: { ...policy, reviewPolicyPath: 'charters/review-policy.md' },
    derivation: { green: true, rows: [] },
    reviewPolicyText: 'POLICY',
    charterEntries: [
      { path: '../escape.md', text: 'x' }, // .. segment => normalizePath null => skipped
      { path: 'charters/code-reviewer.md', text: 'y' },
    ],
    write: (s) => seen.push(s),
  });
  assert.equal(seen.length, 1);
  assert.ok(!seen[0].includes('skipped on error'), seen[0]);
});
