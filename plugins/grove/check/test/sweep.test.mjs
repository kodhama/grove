// The shadow-metrics sweep shell — composition over fakes (the house
// shell-testing pattern). Verifies sweepPr wires the tested pieces into a
// per-PR result carrying BOTH metric families, read-only, from injected
// runners alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sweepPr } from '../shell/sweep.mjs';
import { serializeAsk } from '../lib/asks.mjs';

const POLICY_MD = [
  '```grove-review-policy', 'schema: 1', 'scope: strict',
  'reviewless_types: [research, feedback]', '```',
].join('\n');
const DECL = (review, types, pass) =>
  `\`\`\`grove-review-declaration\nschema: 1\nreview: ${review}\ntypes: [${types.join(', ')}]\npass_class: [${pass.join(', ')}]\n\`\`\``;

const verdictBody = ({ review, subject, findings }) =>
  ['```grove-verdict', 'schema: 1', `review: ${review}`, 'verdict: PASS', 'subject:',
    ...subject.map((s) => `  - ${s}`), 'manifest_hashes:',
    ...subject.map((s) => `  ${s}: x`),
    'fingerprint: grove-fp-1:x', 'producer: executor', 'reviewer: reviewer-x',
    `findings: ${findings}`, '```'].join('\n');

const ghComment = (id, body, { edited = false } = {}) => ({
  id,
  body,
  user: { login: 'alice' },
  author_association: 'MEMBER',
  created_at: '2026-07-20T00:00:00Z',
  updated_at: edited ? '2026-07-20T01:00:00Z' : '2026-07-20T00:00:00Z',
});

function fakeGit(files) {
  return async (args) => {
    if (args[0] === 'diff') return Object.keys(files).map((f) => `M\t${f}`).join('\n');
    if (args[0] === 'show') {
      const spec = args[args.length - 1]; // ref:path
      // Regression pin (first real run): policy reads MUST name a concrete
      // protected ref, never origin/undefined.
      if (spec.startsWith('origin/undefined')) return undefined;
      const path = spec.slice(spec.indexOf(':') + 1);
      if (path === 'charters/review-policy.md') return POLICY_MD;
      if (files[path] !== undefined) return files[path];
      return undefined;
    }
    if (args[0] === 'ls-tree') {
      // charters dir listing for declaration discovery + artifact dirs
      const ref = args[args.length - 2];
      if (String(ref).startsWith('origin/undefined')) return undefined;
      const dir = args[args.length - 1].replace(/\/$/, '');
      return Object.keys(files)
        .filter((f) => f.startsWith(dir + '/'))
        .join('\n');
    }
    return '';
  };
}

test('sweepPr — composes both metric families from injected runners, read-only', async () => {
  const files = {
    'pkg/code.mjs': '// frontmatterless code\n',
    'charters/code-reviewer.md': DECL('code-reviewer', ['code'], ['CLEAN', 'PASS-WITH-ADVISORIES']),
    'charters/conformance-reviewer.md': DECL('conformance', ['spec', 'charter', 'code'], ['PASS']),
  };
  const comments = [
    ghComment(10, serializeAsk({ schema: 1, producer: 'executor', type: 'code', subject: ['pkg/code.mjs'], annotations: 'focus here' })),
    ghComment(20, verdictBody({ review: 'code-reviewer', subject: ['pkg/code.mjs'], findings: 'ask annotations consulted; fine' })),
    ghComment(30, verdictBody({ review: 'conformance', subject: ['pkg/code.mjs'], findings: 'evidence' }), { edited: true }),
  ];
  const fetchImpl = async (url) => {
    if (url.includes('/pulls/')) return { ok: true, json: async () => ({ base: { sha: 'B', repo: { default_branch: 'main' } }, head: { sha: 'H' } }), headers: { get: () => null } };
    return { ok: true, json: async () => comments, headers: { get: () => null }, status: 200 };
  };
  const r = await sweepPr({ fetchImpl, gitRunner: fakeGit(files), owner: 'o', repo: 'r', prNumber: 5 });

  assert.equal(r.changedCount, 3);
  // coordination: ask at 10; code-reviewer verdict at 20 closes ordered; the
  // conformance verdict at 30 is EDITED => inadmissible => pair open.
  assert.equal(r.closure.pairsTotal, 2);
  assert.equal(r.closure.pairsClosed, 1);
  assert.equal(r.closure.orderedFraction, 1);
  assert.equal(r.annotations.consultingCount, 1);
  // divergence: the five §D.1 metrics, recomputed — sharp assertions (the
  // prior any-object check was tautological; code-review high).
  const m = r.comparison.metrics;
  assert.ok(m, JSON.stringify(Object.keys(r.comparison)));
  for (const k of ['tableOnly', 'auditOnly', 'noAsk', 'freshness', 'hwmRaces']) {
    assert.ok(k in m, `metric ${k} missing: ${JSON.stringify(Object.keys(m))}`);
  }
  // the recomputed no-ask set: 2 of the 3 changed files carry no effective ask
  assert.equal(m.noAsk.total, 3);
  assert.equal(m.noAsk.count, 2);
});

test('sweepPr — zero declaration carriers rejects loudly, never a degraded owed-map (the cwd-relative pathspec bug)', async () => {
  const files = { 'pkg/code.mjs': '// code\n' }; // no charters/* declarations visible
  const comments = [];
  const fetchImpl = async (url) => {
    if (url.includes('/pulls/')) return { ok: true, json: async () => ({ base: { sha: 'B', repo: { default_branch: 'main' } }, head: { sha: 'H' } }), headers: { get: () => null } };
    return { ok: true, json: async () => comments, headers: { get: () => null }, status: 200 };
  };
  await assert.rejects(
    () => sweepPr({ fetchImpl, gitRunner: fakeGit(files), owner: 'o', repo: 'r', prNumber: 5 }),
    /no reviewer-declaration carriers found/,
  );
});

test('sweepPr — PR-meta fetch failure is loud, never a partial result', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}), headers: { get: () => null } });
  await assert.rejects(
    () => sweepPr({ fetchImpl, gitRunner: fakeGit({}), owner: 'o', repo: 'r', prNumber: 5 }),
    /PR meta fetch failed \(404\)/,
  );
});
