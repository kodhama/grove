// Upstream: spec-0002 INV12 (existing platform primitives only) + the shell's
// obligation to assemble runCheck's four inputs from the GitHub Actions
// environment. resolveActionsContext is the pure env/event-payload reader the
// thin CLI shell wraps; the exact env var names it resolves are a shell choice
// the spec leaves open (reported as a resolved-ambiguity finding).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveActionsContext } from '../shell/context.mjs';

const baseEnv = {
  GITHUB_REPOSITORY: 'acme/grove',
  GITHUB_TOKEN: 'tok',
  GITHUB_API_URL: 'https://api.github.com',
};
const prEvent = {
  pull_request: {
    number: 17,
    base: { sha: 'baseSHA', ref: 'main' },
    head: { sha: 'headSHA' },
  },
  repository: { default_branch: 'main' },
};

test('resolves owner/repo/pr/base/head/default-branch/token/apiBase from env + event', () => {
  const ctx = resolveActionsContext({ env: baseEnv, event: prEvent });
  assert.equal(ctx.owner, 'acme');
  assert.equal(ctx.repo, 'grove');
  assert.equal(ctx.prNumber, 17);
  assert.equal(ctx.base, 'baseSHA');
  assert.equal(ctx.head, 'headSHA');
  assert.equal(ctx.defaultBranch, 'main');
  assert.equal(ctx.token, 'tok');
  assert.equal(ctx.apiBase, 'https://api.github.com');
});

test('GROVE_* overrides win over the event payload (operator escape hatch)', () => {
  const env = {
    ...baseEnv,
    GROVE_PR_NUMBER: '99',
    GROVE_BASE_SHA: 'B2',
    GROVE_HEAD_SHA: 'H2',
    GROVE_DEFAULT_BRANCH: 'trunk',
  };
  const ctx = resolveActionsContext({ env, event: prEvent });
  assert.equal(ctx.prNumber, 99);
  assert.equal(ctx.base, 'B2');
  assert.equal(ctx.head, 'H2');
  assert.equal(ctx.defaultBranch, 'trunk');
});

test('falls back to GH_TOKEN and the default public API base', () => {
  const env = { GITHUB_REPOSITORY: 'a/b', GH_TOKEN: 'gh' };
  const ctx = resolveActionsContext({ env, event: prEvent });
  assert.equal(ctx.token, 'gh');
  assert.equal(ctx.apiBase, 'https://api.github.com');
});

test('defaultBranch falls back to GITHUB_BASE_REF then main when no payload/override', () => {
  // supply the other required inputs so resolution reaches defaultBranch
  // (base included: it became a validated required input — Finding 5)
  const stub = { GROVE_PR_NUMBER: '1', GROVE_BASE_SHA: 'b', GROVE_HEAD_SHA: 'h' };
  const ctx = resolveActionsContext({ env: { ...baseEnv, ...stub, GITHUB_BASE_REF: 'release' }, event: {} });
  assert.equal(ctx.defaultBranch, 'release');
  const ctx2 = resolveActionsContext({ env: { ...baseEnv, ...stub }, event: {} });
  assert.equal(ctx2.defaultBranch, 'main');
});

test('throws a clear error naming every missing required input', () => {
  assert.throws(
    () => resolveActionsContext({ env: {}, event: {} }),
    (err) => {
      assert.match(err.message, /repo/i);
      return true;
    },
  );
});

test('throws when the PR number cannot be resolved (not a pull_request event)', () => {
  assert.throws(
    () => resolveActionsContext({ env: baseEnv, event: {} }),
    /pr|pull|number/i,
  );
});

// --- Finding 4: the three previously-untested resolution branches ---

test('resolves PR number from refs/pull/<n>/merge (GITHUB_REF) when no override/payload', () => {
  // The Actions checkout ref for a PR; the last fallback in the prNumber ladder.
  const env = { ...baseEnv, GITHUB_REF: 'refs/pull/42/merge', GROVE_BASE_SHA: 'b', GROVE_HEAD_SHA: 'h' };
  const ctx = resolveActionsContext({ env, event: {} });
  assert.equal(ctx.prNumber, 42);
});

test('head falls back to GITHUB_SHA when no GROVE_HEAD_SHA and no pull_request.head.sha', () => {
  const env = { ...baseEnv, GROVE_PR_NUMBER: '3', GROVE_BASE_SHA: 'b', GITHUB_SHA: 'sha123' };
  const ctx = resolveActionsContext({ env, event: {} });
  assert.equal(ctx.head, 'sha123');
});

test('resolves PR number from event.number (issues-style payload) when no pull_request block', () => {
  const env = { ...baseEnv, GROVE_BASE_SHA: 'b', GROVE_HEAD_SHA: 'h' };
  const ctx = resolveActionsContext({ env, event: { number: 5 } });
  assert.equal(ctx.prNumber, 5);
});

// --- Finding 5: a missing `base` is a clean missing-input error, not a
//     cryptic `null...head` git failure downstream (parity with `head`) ---

test('missing base produces a clean "missing required input" error naming base', () => {
  const env = { GITHUB_REPOSITORY: 'a/b', GROVE_PR_NUMBER: '1', GROVE_HEAD_SHA: 'h' };
  assert.throws(
    () => resolveActionsContext({ env, event: {} }),
    (err) => {
      assert.match(err.message, /base/i);
      return true;
    },
  );
});
