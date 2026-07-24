// Upstream: adr-0015 Consequence 2 (the record-emitter reads HEAD via the
// shell's injectable git-runner). The shell builds the HEAD tree + artifact
// index from git and delegates the stamping to lib/emit.mjs. Unit-tested with a
// fake git-runner; one real-git integration test proves the untested edge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assemblePolicy } from '../lib/policy.mjs';
import { runCheck } from '../lib/check.mjs';
import { parseRecord } from '../lib/records.mjs';
import { parseJudgment, extractJudgmentBlocks } from '../lib/judgment.mjs';
import { emitFromJudgment } from '../shell/emitter.mjs';
import { makeExecGitRunner } from '../shell/git-adapter.mjs';
import { groveFp1 } from '../lib/fingerprint.mjs';
import { resolveArtifactDirs } from '../bin/emit-record.mjs';

const adr = (id) => `---\nid: ${id}\ntype: adr\nstatus: approved\n---\n`;
const spec = (id, impl) => `---\nid: ${id}\ntype: spec\nstatus: gated\nimplements: ${impl}\n---\n`;

const reviewPolicyText = '```grove-review-policy\nschema: 1\n```';
const decl = (review, types, pass) =>
  `\`\`\`grove-review-declaration\nschema: 1\nreview: ${review}\ntypes: [${types.join(', ')}]\npass_class: [${pass.join(', ')}]\n\`\`\``;
const policy = assemblePolicy({
  reviewPolicyText,
  charterTexts: [
    decl('conformance', ['charter'], ['PASS']),
    decl('spec-adversary', ['spec'], ['APPROVE-READY']),
    decl('code-reviewer', ['code'], ['CLEAN']),
    decl('decision-adversary', ['adr'], ['SOUND']),
  ],
});

const judgmentBody = ({ review, verdict, subject, findings = 'the evidence.' }) =>
  [
    '```grove-review-judgment',
    'schema: 1',
    `review: ${review}`,
    `verdict: ${verdict}`,
    'subject:',
    ...subject.map((s) => `  - ${s}`),
    'producer: builder',
    'reviewer: reviewer',
    'findings: |',
    ...findings.split('\n').map((l) => `  ${l}`),
    '```',
  ].join('\n');

// A fake git-runner backed by a path->content map (the two commands buildTree
// issues: `ls-tree -r --name-only <ref>` and `show <ref>:<path>`).
function fakeGit(files) {
  return async (args) => {
    if (args[0] === 'ls-tree') return [...files.keys()].join('\n');
    if (args[0] === 'show') {
      const path = args[1].slice(args[1].indexOf(':') + 1);
      if (files.has(path)) return files.get(path);
      throw new Error(`not found: ${path}`);
    }
    throw new Error(`unexpected git ${args.join(' ')}`);
  };
}

test('emitFromJudgment reads HEAD via the git-runner and stamps a valid record', async () => {
  const files = new Map([
    ['decisions/adr-x.md', adr('adr-x')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
  ]);
  const judgment = parseJudgment(extractJudgmentBlocks(judgmentBody({ review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'] }))[0]);
  const { records, errors } = await emitFromJudgment({ gitRunner: fakeGit(files), head: 'HEAD', judgment });
  assert.equal(errors.length, 0);
  assert.equal(records.length, 1);
  assert.equal(parseRecord({ body: records[0].block }).status, 'record');
});

test('ROUND-TRIP through the shell: emitted record makes the real check GREEN', async () => {
  const files = new Map([
    ['decisions/adr-x.md', adr('adr-x')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
  ]);
  const gitRunner = fakeGit(files);
  const judgment = parseJudgment(extractJudgmentBlocks(judgmentBody({ review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'] }))[0]);
  const { records } = await emitFromJudgment({ gitRunner, head: 'HEAD', judgment });
  // The check reads the SAME HEAD tree the emitter did.
  const tree = new Map(files);
  const comments = records.map((r, i) => ({ body: r.block, author: 'alice', authorAssociation: 'MEMBER', id: i + 1 }));
  const result = runCheck({ changed: ['specs/foo.md'], tree, comments, policy });
  assert.equal(result.green, true, JSON.stringify(result.rows, null, 2));
});

// adr-0019 AC1/AC2 — a BATCHED comment (one review's per-file blocks folded into
// one comment) makes the real check GREEN across all owed pairs, exactly as the
// per-comment round-trip above does — the packaging cap is lifted, not the model.
test('ROUND-TRIP batched: N per-file blocks in ONE comment green all N owed pairs', async () => {
  const files = new Map([
    ['decisions/adr-x.md', adr('adr-x')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
    ['specs/bar.md', spec('spec-bar', 'adr-x')],
  ]);
  const gitRunner = fakeGit(files);
  const judgment = parseJudgment(
    extractJudgmentBlocks(judgmentBody({ review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md', 'specs/bar.md'] }))[0],
  );
  const { records } = await emitFromJudgment({ gitRunner, head: 'HEAD', judgment });
  assert.equal(records.length, 2);
  const tree = new Map(files);
  // Fold BOTH per-file blocks into ONE comment (the record-verdict batching).
  const comments = [{ body: records.map((r) => r.block).join('\n\n'), author: 'alice', authorAssociation: 'MEMBER', id: 1 }];
  const result = runCheck({ changed: ['specs/foo.md', 'specs/bar.md'], tree, comments, policy });
  assert.equal(result.green, true, JSON.stringify(result.rows, null, 2));
});

// adr-0015 Consequence 2 — code-review HIGH: the emitter must normalize the
// subject paths BEFORE handing them to buildTree, so the tree source and the
// fingerprint basis share one canonical path set. A NON-CANONICAL, non-artifact
// (code) subject (`./lib/foo.mjs`) previously missed buildTree's changed-set
// (git lists `lib/foo.mjs`, the set held `./lib/foo.mjs`), the blob was never
// loaded, and the emitter fingerprinted over the ABSENT sentinel — a record the
// real check is guaranteed to red as stale, silently emitted with exit 0. The
// canonical/artifact-pathed fixtures never exercised this class.
test('NON-CANONICAL code subject: emitter fingerprints real content, round-trips GREEN', async () => {
  const files = new Map([['lib/foo.mjs', 'export const x = 1;\n']]);
  const gitRunner = fakeGit(files);
  const judgment = parseJudgment(
    extractJudgmentBlocks(
      judgmentBody({ review: 'code-reviewer', verdict: 'CLEAN', subject: ['./lib/foo.mjs'] }),
    )[0],
  );
  const { records, errors } = await emitFromJudgment({ gitRunner, head: 'HEAD', judgment });
  assert.equal(errors.length, 0);
  assert.equal(records.length, 1);

  // The stamp is over the REAL blob at the canonical path — not the ABSENT tree.
  assert.equal(records[0].fingerprint, groveFp1(['lib/foo.mjs'], files));
  assert.notEqual(records[0].fingerprint, groveFp1(['lib/foo.mjs'], new Map()));

  // And the real check accepts it: the emitted record makes runCheck GREEN.
  const tree = new Map(files);
  const comments = records.map((r, i) => ({ body: r.block, author: 'alice', authorAssociation: 'MEMBER', id: i + 1 }));
  const result = runCheck({ changed: ['lib/foo.mjs'], tree, comments, policy });
  assert.equal(result.green, true, JSON.stringify(result.rows, null, 2));
});

// adr-0015 Consequence 2 — code-review MEDIUM: a consumer whose policy declares
// non-default artifact_dirs must have those dirs conveyed to the emitter, or the
// fidelity upstream U mis-resolves (the upstream sits under a dir the default
// index never globs) and the fingerprint the check accepts is never minted.
// This proves the emitFromJudgment plumbing: with the custom dir the upstream
// resolves and the record round-trips GREEN; without it, no record at all.
test('CUSTOM artifact_dirs: fidelity upstream under a custom dir resolves U, round-trips GREEN', async () => {
  const files = new Map([
    ['extra/gate.md', `---\nid: gate-x\ntype: charter\nstatus: approved\nimplements: adr-x\n---\n`],
    ['extra/adr-x.md', adr('adr-x')],
  ]);
  const artifactDirs = ['decisions', 'specs', 'charters', 'extra'];
  const judgment = parseJudgment(
    extractJudgmentBlocks(
      judgmentBody({ review: 'conformance', verdict: 'PASS', subject: ['extra/gate.md'] }),
    )[0],
  );

  // Without the custom dir: the upstream is unindexed, U is non-computable.
  const bare = await emitFromJudgment({ gitRunner: fakeGit(files), head: 'HEAD', judgment });
  assert.equal(bare.records.length, 0);
  assert.equal(bare.errors.length, 1);

  // With the custom dir conveyed: U resolves, one record, round-trip GREEN.
  const { records, errors } = await emitFromJudgment({ gitRunner: fakeGit(files), head: 'HEAD', judgment, artifactDirs });
  assert.equal(errors.length, 0);
  assert.equal(records.length, 1);

  const customPolicy = assemblePolicy({
    reviewPolicyText: '```grove-review-policy\nschema: 1\nartifact_dirs: [decisions, specs, charters, extra]\n```',
    charterTexts: [
      decl('conformance', ['charter'], ['PASS']),
      decl('spec-adversary', ['spec'], ['APPROVE-READY']),
      decl('code-reviewer', ['code'], ['CLEAN']),
      decl('decision-adversary', ['adr'], ['SOUND']),
    ],
  });
  const tree = new Map(files);
  const comments = records.map((r, i) => ({ body: r.block, author: 'alice', authorAssociation: 'MEMBER', id: i + 1 }));
  const result = runCheck({ changed: ['extra/gate.md'], tree, comments, policy: customPolicy });
  assert.equal(result.green, true, JSON.stringify(result.rows, null, 2));
});

// adr-0015 Consequence 2 — code-review MEDIUM (CLI conveyance): the record-emitter
// CLI resolves artifact_dirs so a consumer's non-default policy is honored. The
// explicit `--artifact-dirs` flag wins; else the local review-policy.md's
// grove-review-policy block supplies them (the same source the check reads);
// else the default three.
test('resolveArtifactDirs: flag > local policy block > default', () => {
  // flag (comma list, trimmed) wins over policy
  assert.deepEqual(
    resolveArtifactDirs({
      flag: 'decisions, specs , charters, extra',
      policyText: '```grove-review-policy\nschema: 1\nartifact_dirs: [only]\n```',
    }),
    ['decisions', 'specs', 'charters', 'extra'],
  );
  // no flag: the local policy block supplies the dirs
  assert.deepEqual(
    resolveArtifactDirs({ policyText: '```grove-review-policy\nschema: 1\nartifact_dirs: [decisions, adr]\n```' }),
    ['decisions', 'adr'],
  );
  // no flag, no policy block: the default three
  assert.deepEqual(resolveArtifactDirs({ policyText: '' }), ['decisions', 'specs', 'charters']);
  assert.deepEqual(resolveArtifactDirs({}), ['decisions', 'specs', 'charters']);
});

test('real-git integration: stamp over a true HEAD tree, round-trip GREEN', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'grove-emit-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir });
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  mkdirSync(join(dir, 'decisions'), { recursive: true });
  mkdirSync(join(dir, 'specs'), { recursive: true });
  writeFileSync(join(dir, 'decisions/adr-x.md'), adr('adr-x'));
  writeFileSync(join(dir, 'specs/foo.md'), spec('spec-foo', 'adr-x'));
  git('add', '-A');
  git('commit', '-qm', 'seed');

  const gitRunner = makeExecGitRunner({ cwd: dir });
  const judgment = parseJudgment(extractJudgmentBlocks(judgmentBody({ review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'] }))[0]);
  const { records } = await emitFromJudgment({ gitRunner, head: 'HEAD', judgment });
  assert.equal(records.length, 1);

  // Rebuild the same HEAD tree for the check from git and verify GREEN.
  const tree = new Map([
    ['decisions/adr-x.md', adr('adr-x')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
  ]);
  const comments = [{ body: records[0].block, author: 'alice', authorAssociation: 'MEMBER', id: 1 }];
  const result = runCheck({ changed: ['specs/foo.md'], tree, comments, policy });
  assert.equal(result.green, true, JSON.stringify(result.rows, null, 2));
});
