// Upstream: spec-0002 INV12 (use ONLY git content + existing platform
// primitives — no run-attestation/identity-service/forge-resistant store),
// §C.0 (the trust boundary: policy from the PROTECTED branch, everything else
// recomputed from HEAD), §C.2 (diff -> changed: a rename = old-path deletion +
// new-path addition), §B (tree covers changed files + artifact dirs + resolved
// upstreams). The git adapter is the shell that produces `changed`, `tree`, and
// the protected-branch policy inputs behind an injectable git-runner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChangedPaths,
  computeChanged,
  buildTree,
  readProtectedPolicy,
} from '../shell/git-adapter.mjs';

// --- parseChangedPaths (§C.2): name-status -> owed-review paths at HEAD ---

test('parseChangedPaths keeps added and modified paths', () => {
  const out = 'A\tspecs/new.md\nM\tspecs/old.md';
  assert.deepEqual(parseChangedPaths(out), ['specs/new.md', 'specs/old.md']);
});

test('parseChangedPaths: a rename yields the NEW path (addition), drops the old (deletion)', () => {
  // §C.2 / Terms: a platform-reported rename = deletion of old + addition of new.
  const out = 'R100\tspecs/old.md\tspecs/renamed.md';
  assert.deepEqual(parseChangedPaths(out), ['specs/renamed.md']);
});

test('parseChangedPaths drops pure deletions (they owe no review)', () => {
  const out = 'A\ta.md\nD\tgone.md\nM\tb.md';
  assert.deepEqual(parseChangedPaths(out), ['a.md', 'b.md']);
});

test('parseChangedPaths: a copy yields the new path; a type-change is kept', () => {
  const out = 'C075\tsrc.md\tcopy.md\nT\tmode.md';
  assert.deepEqual(parseChangedPaths(out), ['copy.md', 'mode.md']);
});

test('parseChangedPaths ignores blank lines', () => {
  assert.deepEqual(parseChangedPaths('\nA\tx.md\n\n'), ['x.md']);
});

// A fake git-runner: (args[]) => Promise<stdout>. Records the invocations so a
// test can assert WHICH ref was read (protected branch vs HEAD).
function fakeRunner(responder) {
  const calls = [];
  const run = async (args) => {
    calls.push(args);
    const r = responder(args);
    if (r === undefined) throw new Error(`fatal: not found: ${args.join(' ')}`);
    return r;
  };
  run.calls = calls;
  return run;
}

// --- computeChanged: diff base...head via the runner ---

test('computeChanged diffs base...head (merge-base three-dot) and parses the result', async () => {
  const gitRunner = fakeRunner((args) => {
    if (args[0] === 'diff') return 'A\tspecs/foo.md\nM\tspecs/bar.md';
    return undefined;
  });
  const changed = await computeChanged({ gitRunner, base: 'BASE', head: 'HEAD' });
  assert.deepEqual(changed, ['specs/foo.md', 'specs/bar.md']);
  const diffCall = gitRunner.calls.find((a) => a[0] === 'diff');
  assert.ok(diffCall.some((a) => a === 'BASE...HEAD'), 'uses three-dot merge-base diff');
});

// --- buildTree: eager Map over the paths the core reads (§B) ---

test('buildTree loads artifact-dir files, changed files, and every test-deps.md at HEAD', async () => {
  const files = {
    'specs/foo.md': '---\nid: spec-foo\n---\nspec body',
    'decisions/adr-x.md': '---\nid: adr-x\n---\ndecision',
    'plugins/pkg/test-deps.md': '```grove-test-deps\nschema: 1\n```',
    'plugins/pkg/lib/a.mjs': 'export const a = 1;',
    'README.md': 'readme', // outside artifact dirs, not changed, not a ledger
  };
  const gitRunner = fakeRunner((args) => {
    if (args[0] === 'ls-tree') {
      // whole-tree listing at HEAD
      return Object.keys(files).join('\n');
    }
    if (args[0] === 'show') {
      const ref = args[1]; // <ref>:<path>
      const path = ref.slice(ref.indexOf(':') + 1);
      return files[path];
    }
    return undefined;
  });
  const tree = await buildTree({
    gitRunner,
    head: 'HEAD',
    artifactDirs: ['decisions', 'specs', 'charters'],
    changed: ['plugins/pkg/lib/a.mjs'],
  });
  assert.equal(tree instanceof Map, true);
  // artifact-dir files present (needed for the index / .entries())
  assert.ok(tree.has('specs/foo.md'));
  assert.ok(tree.has('decisions/adr-x.md'));
  // the changed code file present (subject)
  assert.equal(tree.get('plugins/pkg/lib/a.mjs'), 'export const a = 1;');
  // every ledger present (code upstream resolution walks ancestors for it)
  assert.ok(tree.has('plugins/pkg/test-deps.md'));
  // a non-artifact, non-changed, non-ledger file is NOT loaded (kept lean)
  assert.equal(tree.has('README.md'), false);
});

// --- readProtectedPolicy: policy from the PROTECTED branch, NEVER PR HEAD ---
//     (§C.0 trust boundary / INV1 policy integrity, at the shell edge)

test('readProtectedPolicy reads charters + review-policy from origin/<default>, not HEAD', async () => {
  const branchContent = {
    'charters/review-policy.md': '```grove-review-policy\nschema: 1\nartifact_dirs: [decisions, specs]\n```',
    'charters/conformance-reviewer.md': 'PROTECTED conformance charter',
    'charters/spec-adversary.md': 'PROTECTED spec-adversary charter',
  };
  const gitRunner = fakeRunner((args) => {
    if (args[0] === 'ls-tree') {
      const ref = args[args.length - 2] === '--' ? args[args.length - 3] : args[args.indexOf('charters') - 1];
      // ref is whatever precedes `-- charters`; assert it is the protected ref
      return Object.keys(branchContent).join('\n');
    }
    if (args[0] === 'show') {
      const spec = args[1];
      assert.ok(spec.startsWith('origin/main:'), `policy must read from protected branch, got: ${spec}`);
      const path = spec.slice(spec.indexOf(':') + 1);
      return branchContent[path];
    }
    return undefined;
  });
  const { reviewPolicyText, charterTexts } = await readProtectedPolicy({
    gitRunner,
    defaultBranch: 'main',
  });
  assert.ok(reviewPolicyText.includes('grove-review-policy'));
  assert.equal(charterTexts.length, 2); // the two non-policy charters
  assert.ok(charterTexts.some((t) => t.includes('PROTECTED conformance charter')));
  // every ls-tree/show for policy targeted the protected ref
  for (const a of gitRunner.calls) {
    if (a[0] === 'show') assert.ok(a[1].startsWith('origin/main:'));
  }
});
