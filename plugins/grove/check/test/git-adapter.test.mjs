// Upstream: spec-0002 INV12 (use ONLY git content + existing platform
// primitives — no run-attestation/identity-service/forge-resistant store),
// §C.0 (the trust boundary: policy from the PROTECTED branch, everything else
// recomputed from HEAD), §C.2 (diff -> changed: a rename = old-path deletion +
// new-path addition), §B (tree covers changed files + artifact dirs + resolved
// upstreams). The git adapter is the shell that produces `changed`, `tree`, and
// the protected-branch policy inputs behind an injectable git-runner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseChangedPaths,
  computeChanged,
  buildTree,
  readProtectedPolicy,
  readProtectedCarrierPaths,
  makeExecGitRunner,
  groveInstalledOnBase,
  bootstrapSelfDetect,
  BOOTSTRAP_SKIP_SUMMARY,
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
    // charters/ wins the declaration-dir precedence by carrying a declaration.
    'charters/conformance-reviewer.md':
      'PROTECTED conformance charter\n```grove-review-declaration\nschema: 1\nreview: conformance\ntypes: [spec]\npass_class: [PASS]\n```',
    'charters/spec-adversary.md':
      'PROTECTED spec-adversary charter\n```grove-review-declaration\nschema: 1\nreview: spec-adversary\ntypes: [spec]\npass_class: [APPROVE-READY]\n```',
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

// --- Finding 1: a FAILED protected-branch read must NOT be swallowed to an
//     empty charter set (indistinguishable from a genuinely empty dir, which
//     downstream misreads as "reviews missing"). A git command FAILURE (the
//     ref not fetched in a shallow Actions checkout) must propagate as a hard
//     error so bin/check.mjs exits 2 with a clear message. §C.0 / INV1. ---

test('readProtectedPolicy: a git ls-tree FAILURE on the protected branch propagates, never degrades to empty', async () => {
  // Simulate origin/main not fetched (shallow checkout): ls-tree rejects.
  const gitRunner = fakeRunner((args) => {
    if (args[0] === 'ls-tree') return undefined; // fakeRunner turns this into a rejection
    return undefined;
  });
  await assert.rejects(
    () => readProtectedPolicy({ gitRunner, defaultBranch: 'main' }),
    (err) => {
      // A clear, protected-branch-read message — not a silent empty policy.
      assert.match(err.message, /protected branch|origin\/main|charters/i);
      return true;
    },
  );
});

test('readProtectedPolicy: a genuinely EMPTY charters listing (ls-tree exits 0, no output) degrades to empty, no throw', async () => {
  // The legitimate degrade path: the read SUCCEEDED and the dir is empty/absent.
  const gitRunner = fakeRunner((args) => {
    if (args[0] === 'ls-tree') return ''; // success, empty output
    return undefined;
  });
  const { reviewPolicyText, charterTexts } = await readProtectedPolicy({
    gitRunner,
    defaultBranch: 'main',
  });
  assert.equal(reviewPolicyText, '');
  assert.deepEqual(charterTexts, []);
});

// --- Finding 3: makeExecGitRunner must pass `-c core.quotepath=false` so a
//     non-ASCII artifact path comes back LITERAL (not octal-escaped + quoted),
//     otherwise parseChangedPaths yields a mangled path and readAt can't
//     resolve it. Exercised against real git (the otherwise-untested edge). ---

test('makeExecGitRunner returns non-ASCII paths literal (core.quotepath=false), so computeChanged/readAt resolve them', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'grove-quotepath-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 'tester');
  git('commit', '-q', '--allow-empty', '-m', 'base');
  const base = git('rev-parse', 'HEAD').trim();

  const fname = 'specs/föö.md'; // non-ASCII: git quotes+octal-escapes it by default
  mkdirSync(join(dir, 'specs'));
  writeFileSync(join(dir, fname), 'body');
  git('add', '-A');
  git('commit', '-q', '-m', 'add unicode-named artifact');
  const head = git('rev-parse', 'HEAD').trim();

  const gitRunner = makeExecGitRunner({ cwd: dir });
  const changed = await computeChanged({ gitRunner, base, head });
  // Literal UTF-8 path, NOT `"specs/f\303\266\303\266.md"`.
  assert.deepEqual(changed, [fname]);
  // And readAt resolves that literal path at HEAD (it would 404 on the mangled form).
  const { readAt } = await import('../shell/git-adapter.mjs');
  const content = await readAt({ gitRunner, ref: head, path: changed[0] });
  assert.equal(content, 'body');
});

// --- Policy auto-discovery by PRECEDENCE (spec-0002 INV1 / §C.0) ---
//   The reviewer-declaration dir is the FIRST of [charters/, .claude/agents/]
//   that exists AND carries ≥1 grove-review-declaration block (precedence, NOT
//   union — grove-self's canonical charters/ wins over its own vendored
//   .claude/agents/ copies; a consumer with no charters/ falls to
//   .claude/agents/). The review-policy.md is the FIRST of
//   [charters/review-policy.md, .grove/review.toml] that exists. Env pair
//   GROVE_POLICY_DIR / GROVE_REVIEW_POLICY_PATH is an escape hatch. Every read
//   still targets the PROTECTED default branch, never PR HEAD.

const DECL_BLOCK =
  '```grove-review-declaration\nschema: 1\nreview: conformance\ntypes: [spec]\npass_class: [PASS]\n```';

// A fake git-runner over an in-memory {path -> content} tree at a single ref.
// ls-tree with a `-- <dir>` pathspec returns only files under that dir (an
// absent dir yields '' — ls-tree exits 0 with no output, the genuine-absence
// signal); `show <ref>:<path>` returns the content or undefined (a 404 that the
// fakeRunner turns into a rejection, i.e. readAt -> null). Records every call.
function treeRunner(files, { ref = 'origin/main' } = {}) {
  return fakeRunner((args) => {
    if (args[0] === 'ls-tree') {
      assert.equal(args[3], ref, `ls-tree must target the protected ref, got ${args[3]}`);
      const ddIdx = args.indexOf('--');
      const dir = ddIdx >= 0 ? args[ddIdx + 1] : null;
      const all = Object.keys(files);
      const dd = dir ? dir.replace(/\/$/, '') : null;
      const sel = dd ? all.filter((p) => p === dd || p.startsWith(dd + '/')) : all;
      return sel.join('\n');
    }
    if (args[0] === 'show') {
      const spec = args[1]; // <ref>:<path>
      assert.ok(spec.startsWith(ref + ':'), `show must target the protected ref, got ${spec}`);
      const path = spec.slice(spec.indexOf(':') + 1);
      return files[path];
    }
    return undefined;
  });
}

test('policy auto-discovery: grove-self — charters/ with a declaration wins; .claude/agents copies are ignored (precedence, not union)', async () => {
  const files = {
    'charters/review-policy.md': '```grove-review-policy\nschema: 1\n```',
    'charters/conformance-reviewer.md': 'CANONICAL CHARTER\n' + DECL_BLOCK,
    // A stale vendored copy under .claude/agents/ that must NOT be read.
    '.claude/agents/conformance-reviewer.md': 'STALE COPY\n' + DECL_BLOCK,
  };
  const gitRunner = treeRunner(files);
  const { reviewPolicyText, charterTexts } = await readProtectedPolicy({
    gitRunner,
    defaultBranch: 'main',
    env: {},
  });
  assert.ok(reviewPolicyText.includes('grove-review-policy'));
  assert.ok(charterTexts.some((t) => t.includes('CANONICAL CHARTER')));
  assert.ok(!charterTexts.some((t) => t.includes('STALE COPY')), 'the .claude/agents copy is ignored when charters/ wins');
  // Precedence, not union: .claude/agents was never even listed.
  const listedAgents = gitRunner.calls.some((a) => a[0] === 'ls-tree' && a.includes('.claude/agents'));
  assert.equal(listedAgents, false, 'a winning charters/ short-circuits the .claude/agents candidate');
});

test('policy auto-discovery: consumer — no charters/, .claude/agents/ carries the declarations; policy from .grove/review.toml split (adr-0018 D10)', async () => {
  const files = {
    '.grove/review.toml': 'scope = "scoped"\nartifact_dirs = ["decisions", "specs"]',
    '.grove/internal/review-wiring.toml': 'check_runtime_dir = ".grove/internal/check/"\ncheck_workflow_path = ".github/workflows/grove-review-bookkeeping.yml"',
    '.claude/agents/conformance-reviewer.md': 'CONSUMER CHARTER\n' + DECL_BLOCK,
    '.claude/agents/README.md': 'orientation, no declaration',
  };
  const gitRunner = treeRunner(files);
  const { reviewPolicyText, reviewPolicyPath, charterTexts } = await readProtectedPolicy({
    gitRunner,
    defaultBranch: 'main',
    env: {},
  });
  // the split TOML carrier is synthesized into a grove-review-policy block
  assert.ok(reviewPolicyText.includes('grove-review-policy'), 'policy discovered + synthesized at .grove/review.toml');
  assert.ok(reviewPolicyText.includes('scope: "scoped"'));
  assert.ok(reviewPolicyText.includes('check_runtime_dir: ".grove/internal/check/"'), 'wiring carrier key folded in');
  assert.equal(reviewPolicyPath, '.grove/review.toml');
  assert.ok(charterTexts.some((t) => t.includes('CONSUMER CHARTER')));
});

test('policy auto-discovery: consumer split with an ABSENT wiring file — carrier keys omitted, fail-close preserved (adr-0013 AC4)', async () => {
  const files = {
    '.grove/review.toml': 'scope = "scoped"',
    // NO .grove/internal/review-wiring.toml
    '.claude/agents/conformance-reviewer.md': 'CONSUMER CHARTER\n' + DECL_BLOCK,
  };
  const gitRunner = treeRunner(files);
  const { reviewPolicyText } = await readProtectedPolicy({ gitRunner, defaultBranch: 'main', env: {} });
  assert.ok(reviewPolicyText.includes('grove-review-policy'));
  // the carrier keys are NOT forged into the synthesized block — they fall to
  // the parser's install defaults downstream (defaulted provenance -> reds if
  // the default path is absent on the protected branch)
  assert.ok(!reviewPolicyText.includes('check_runtime_dir'), 'absent wiring never forges a carrier key');
  assert.ok(!reviewPolicyText.includes('check_workflow_path'));
});

test('policy auto-discovery: charters/ exists but is declaration-less — precedence falls THROUGH to .claude/agents (existence alone does not win)', async () => {
  const files = {
    // charters/ exists but carries no grove-review-declaration block.
    'charters/README.md': 'orientation, no declaration',
    '.grove/review.toml': 'scope = "scoped"',
    '.claude/agents/conformance-reviewer.md': 'CONSUMER CHARTER\n' + DECL_BLOCK,
  };
  const gitRunner = treeRunner(files);
  const { charterTexts } = await readProtectedPolicy({
    gitRunner,
    defaultBranch: 'main',
    env: {},
  });
  assert.ok(charterTexts.some((t) => t.includes('CONSUMER CHARTER')), 'a declaration-less charters/ does not win by mere existence');
  assert.ok(!charterTexts.some((t) => t.includes('orientation')), 'the declaration-less charters/ text is not returned');
});

test('policy auto-discovery: neither dir yields a declaration — fail-closed to an empty policy (no throw)', async () => {
  // charters/ absent; .claude/agents/ exists but carries no declaration block.
  const files = {
    '.claude/agents/README.md': 'just orientation prose, no grove-review-declaration',
  };
  const gitRunner = treeRunner(files);
  const { reviewPolicyText, charterTexts } = await readProtectedPolicy({
    gitRunner,
    defaultBranch: 'main',
    env: {},
  });
  assert.equal(reviewPolicyText, '');
  assert.deepEqual(charterTexts, []);
});

test('policy auto-discovery: review-policy precedence — charters/review-policy.md wins over .grove/review.toml', async () => {
  const files = {
    'charters/review-policy.md': '```grove-review-policy\nschema: 1\n# CHARTERS POLICY\n```',
    '.grove/review.toml': 'scope = "scoped"   # GROVE POLICY',
    'charters/conformance-reviewer.md': 'CANONICAL\n' + DECL_BLOCK,
  };
  const gitRunner = treeRunner(files);
  const { reviewPolicyText, reviewPolicyPath } = await readProtectedPolicy({
    gitRunner,
    defaultBranch: 'main',
    env: {},
  });
  assert.ok(reviewPolicyText.includes('CHARTERS POLICY'));
  assert.equal(reviewPolicyPath, 'charters/review-policy.md');
  assert.ok(!reviewPolicyText.includes('GROVE POLICY'), 'the .grove/ carrier is not read when charters/ exists');
});

test('policy auto-discovery: env override (GROVE_POLICY_DIR / GROVE_REVIEW_POLICY_PATH) redirects both reads to a non-standard layout', async () => {
  const files = {
    'custom/policy.md': '```grove-review-policy\nschema: 1\n# CUSTOM\n```',
    'custom/agents/conformance-reviewer.md': 'CUSTOM CHARTER\n' + DECL_BLOCK,
    // Standard locations exist too — the override must win and these stay unread.
    'charters/review-policy.md': '```grove-review-policy\nschema: 1\n# STANDARD\n```',
    'charters/conformance-reviewer.md': 'STANDARD CHARTER\n' + DECL_BLOCK,
  };
  const gitRunner = treeRunner(files);
  const { reviewPolicyText, charterTexts } = await readProtectedPolicy({
    gitRunner,
    defaultBranch: 'main',
    env: { GROVE_POLICY_DIR: 'custom/agents', GROVE_REVIEW_POLICY_PATH: 'custom/policy.md' },
  });
  assert.ok(reviewPolicyText.includes('CUSTOM'));
  assert.ok(!reviewPolicyText.includes('STANDARD'));
  assert.ok(charterTexts.some((t) => t.includes('CUSTOM CHARTER')));
  assert.ok(!charterTexts.some((t) => t.includes('STANDARD CHARTER')));
  const listedCharters = gitRunner.calls.some((a) => a[0] === 'ls-tree' && a.includes('charters'));
  assert.equal(listedCharters, false, 'the override skips the standard charters/ candidate');
});

test('policy auto-discovery: a git ls-tree FAILURE (protected ref not fetched) still propagates as a hard error, never a silent empty policy', async () => {
  // Every git call rejects — the shallow-checkout case. Must throw, not degrade.
  const gitRunner = fakeRunner(() => undefined);
  await assert.rejects(
    () => readProtectedPolicy({ gitRunner, defaultBranch: 'main', env: {} }),
    (err) => {
      assert.match(err.message, /protected branch|origin\/main/i);
      return true;
    },
  );
});

// --- readProtectedCarrierPaths (§C.2 carrier fail-close, adr-0013 AC4): supply
//     the protected-branch existence facts runCheck's resolveCarriers needs.
//     The core stays pure — this shell probe lists blobs under each carrier
//     path at origin/<default>, never PR HEAD. ---

test('readProtectedCarrierPaths lists blobs under each carrier path at the protected branch (runtime dir + workflow file)', async () => {
  const files = {
    '.grove/internal/check/lib/check.mjs': 'core',
    '.grove/internal/check/bin/check.mjs': 'cli',
    '.github/workflows/grove-review-bookkeeping.yml': 'wf',
    'src/app/main.py': 'app', // NOT a carrier — never listed
  };
  const gitRunner = treeRunner(files);
  const paths = await readProtectedCarrierPaths({
    gitRunner,
    defaultBranch: 'main',
    carrierPaths: ['.grove/internal/check/', '.github/workflows/grove-review-bookkeeping.yml'],
  });
  assert.ok(paths.includes('.grove/internal/check/lib/check.mjs'));
  assert.ok(paths.includes('.grove/internal/check/bin/check.mjs'));
  assert.ok(paths.includes('.github/workflows/grove-review-bookkeeping.yml'));
  assert.ok(!paths.includes('src/app/main.py'));
  // every read targeted the protected ref (treeRunner asserts it internally)
  for (const a of gitRunner.calls) {
    if (a[0] === 'ls-tree') assert.equal(a[3], 'origin/main');
  }
});

test('readProtectedCarrierPaths returns an empty listing when a carrier path exists nowhere (fail-close substrate)', async () => {
  const files = { 'src/app/main.py': 'app' };
  const gitRunner = treeRunner(files);
  const paths = await readProtectedCarrierPaths({
    gitRunner,
    defaultBranch: 'main',
    carrierPaths: ['.grove/internal/check/', '.github/workflows/grove-review-bookkeeping.yml'],
  });
  assert.deepEqual(paths, []);
});

// --- readProtectedPolicy now also surfaces the reviewer-declaration file PATHS
//     and the review-policy path (INV21 gate-carrier scope needs them). Bare
//     charterTexts stays for back-compat. ---

test('readProtectedPolicy surfaces charterEntries {path,text} and reviewPolicyPath for the gate-carrier scope basis (INV21)', async () => {
  const files = {
    'charters/review-policy.md': '```grove-review-policy\nschema: 1\nscope: scoped\n```',
    'charters/conformance-reviewer.md': 'CANONICAL\n' + DECL_BLOCK,
  };
  const gitRunner = treeRunner(files);
  const res = await readProtectedPolicy({ gitRunner, defaultBranch: 'main', env: {} });
  assert.equal(res.reviewPolicyPath, 'charters/review-policy.md');
  assert.ok(Array.isArray(res.charterEntries));
  assert.ok(res.charterEntries.some((e) => e.path === 'charters/conformance-reviewer.md' && e.text.includes('CANONICAL')));
  // back-compat: bare charterTexts still present
  assert.ok(res.charterTexts.some((t) => t.includes('CANONICAL')));
});

// --- adr-0014 move 1b: the bootstrap self-detect ("grove does not gate its own
//     arrival"). The discriminator asks ONE question — is grove installed on the
//     protected default branch at all yet, i.e. does a `grove-review-policy`
//     block exist on origin/<default>? ABSENT (this PR introduces grove) ⇒ the
//     check exits GREEN (non-gating) and never runs the gating logic. PRESENT
//     (established install) ⇒ no skip; the normal check runs (adr-0013's carrier
//     fail-close etc. fire exactly as before). The discriminator is read from the
//     protected branch ONLY (HEAD-independent, adr-0013 INV1/S6 / the F2 finding)
//     and keys on POLICY-presence, NOT workflow-file-presence (adr-0014 F1). ---

test('groveInstalledOnBase: PRESENT — a review-policy text bearing a grove-review-policy block ⇒ installed (adr-0014 1b)', () => {
  const reviewPolicyText = '```grove-review-policy\nschema: 1\nscope: scoped\n```';
  assert.equal(groveInstalledOnBase({ reviewPolicyText }), true);
});

test('groveInstalledOnBase: ABSENT — empty policy text (no carrier on base) ⇒ not installed (adr-0014 1b)', () => {
  // readProtectedPolicy returns '' when no review-policy carrier exists on base
  // (a genuinely absent/empty discovery — the fresh-install signal).
  assert.equal(groveInstalledOnBase({ reviewPolicyText: '' }), false);
  assert.equal(groveInstalledOnBase({}), false);
});

test('groveInstalledOnBase: ABSENT — a carrier exists on base but bears no grove-review-policy BLOCK ⇒ not installed (block-presence, not file-presence)', () => {
  // The discriminator is the BLOCK's presence, not merely the file's — a
  // review-policy file with unrelated prose but no grove-review-policy block is
  // read as "not installed" (adr-0014: "does the grove-review-policy BLOCK exist").
  const reviewPolicyText = '# some file that is not a grove policy carrier\n```yaml\nfoo: bar\n```';
  assert.equal(groveInstalledOnBase({ reviewPolicyText }), false);
});

test('bootstrapSelfDetect: ABSENT ⇒ skip GREEN with the exact activation summary (adr-0014 1b)', () => {
  const d = bootstrapSelfDetect({ reviewPolicyText: '' });
  assert.equal(d.skip, true);
  assert.equal(d.summary, 'grove install detected — the check activates on your next PR');
  assert.equal(d.summary, BOOTSTRAP_SKIP_SUMMARY);
});

test('bootstrapSelfDetect: PRESENT ⇒ does NOT skip; the normal check runs (adr-0013 fail-close fires as before)', () => {
  const reviewPolicyText = '```grove-review-policy\nschema: 1\nscope: scoped\n```';
  const d = bootstrapSelfDetect({ reviewPolicyText });
  assert.equal(d.skip, false);
});

test('bootstrap discriminator reads from the PROTECTED branch only (origin/<default>), never PR HEAD (adr-0014 F2 / adr-0013 INV1,S6)', async () => {
  // Feed the discriminator via readProtectedPolicy over a fake base tree; the
  // treeRunner asserts internally that EVERY read targets origin/main. A PR
  // cannot forge "install detected" by editing its own HEAD because the text the
  // discriminator reads comes exclusively from the protected-branch read.
  const installedBase = {
    'charters/review-policy.md': '```grove-review-policy\nschema: 1\nscope: scoped\n```',
    'charters/conformance-reviewer.md': 'CANONICAL\n' + DECL_BLOCK,
  };
  const freshBase = { 'README.md': 'a repo with no grove install on base yet' };

  const rInstalled = treeRunner(installedBase);
  const { reviewPolicyText: tInstalled } = await readProtectedPolicy({
    gitRunner: rInstalled,
    defaultBranch: 'main',
    env: {},
  });
  assert.equal(bootstrapSelfDetect({ reviewPolicyText: tInstalled }).skip, false);

  const rFresh = treeRunner(freshBase);
  const { reviewPolicyText: tFresh } = await readProtectedPolicy({
    gitRunner: rFresh,
    defaultBranch: 'main',
    env: {},
  });
  assert.equal(bootstrapSelfDetect({ reviewPolicyText: tFresh }).skip, true);
});

// --- Real-git integration (the existing makeExecGitRunner style): the probe
//     resolves carriers committed on the protected branch. ---

test('bootstrap self-detect over real git: a base with no grove policy ⇒ skip; a base with the policy ⇒ run (adr-0014 1b)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'grove-bootstrap-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 'tester');

  // Protected branch BEFORE grove exists: no review-policy carrier at all.
  writeFileSync(join(dir, 'README.md'), 'a project with no grove yet');
  git('add', '-A');
  git('commit', '-q', '-m', 'pre-grove');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');

  const gitRunner = makeExecGitRunner({ cwd: dir });
  const fresh = await readProtectedPolicy({ gitRunner, defaultBranch: 'main', env: {} });
  assert.equal(bootstrapSelfDetect({ reviewPolicyText: fresh.reviewPolicyText }).skip, true, 'fresh install ⇒ skip green');

  // Now grove is installed on the protected branch (split TOML carrier present).
  mkdirSync(join(dir, '.grove'), { recursive: true });
  writeFileSync(join(dir, '.grove/review.toml'), 'scope = "scoped"\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'install grove');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');

  const established = await readProtectedPolicy({ gitRunner, defaultBranch: 'main', env: {} });
  assert.equal(bootstrapSelfDetect({ reviewPolicyText: established.reviewPolicyText }).skip, false, 'established install ⇒ run');
});

test('readProtectedCarrierPaths resolves carriers committed on the protected branch (real git)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'grove-carrier-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 'tester');
  mkdirSync(join(dir, '.grove/internal/check/lib'), { recursive: true });
  mkdirSync(join(dir, '.github/workflows'), { recursive: true });
  writeFileSync(join(dir, '.grove/internal/check/lib/check.mjs'), 'core');
  writeFileSync(join(dir, '.github/workflows/grove-review-bookkeeping.yml'), 'wf');
  git('add', '-A');
  git('commit', '-q', '-m', 'install machinery');
  // simulate the protected branch as origin/main (a local ref suffices for ls-tree)
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');

  const gitRunner = makeExecGitRunner({ cwd: dir });
  const paths = await readProtectedCarrierPaths({
    gitRunner,
    defaultBranch: 'main',
    carrierPaths: ['.grove/internal/check/', '.github/workflows/grove-review-bookkeeping.yml'],
  });
  assert.ok(paths.includes('.grove/internal/check/lib/check.mjs'));
  assert.ok(paths.includes('.github/workflows/grove-review-bookkeeping.yml'));
});
