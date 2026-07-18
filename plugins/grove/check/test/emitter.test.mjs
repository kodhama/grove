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
