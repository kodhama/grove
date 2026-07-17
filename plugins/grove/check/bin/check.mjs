#!/usr/bin/env node
// The check CLI entry (spec-0002 — the GitHub/CI shell for the check core).
//
// A thin shell over unit-tested functions: it reads the GitHub Actions context
// (env + event payload), assembles runCheck's four inputs from git + the PR
// record stream, runs the pure core, renders the §D status view, prints the
// summary, and sets the check-run conclusion via the exit code — non-zero on
// red (or any hard error, e.g. INV9's truncated read), zero on green.
//
// The ONLY untested lines live here: reading the event JSON off disk, the real
// global `fetch` (passed as fetchImpl), the real `execFile('git', ...)` runner,
// the GITHUB_STEP_SUMMARY write, and process wiring. Everything they call is
// unit-tested against fakes (shell/*.mjs + lib/*.mjs). Disclosed edge.

import { readFileSync, appendFileSync } from 'node:fs';

import { resolveActionsContext } from '../shell/context.mjs';
import {
  computeChanged,
  buildTree,
  readProtectedPolicy,
  readProtectedCarrierPaths,
  makeExecGitRunner,
} from '../shell/git-adapter.mjs';
import { readRecordStream } from '../shell/record-stream.mjs';
import { assemblePolicy } from '../lib/policy.mjs';
import { runCheck } from '../lib/check.mjs';
import { render } from '../lib/view.mjs';

function readEvent(env) {
  if (!env.GITHUB_EVENT_PATH) return {};
  try {
    return JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  const env = process.env;
  const event = readEvent(env);
  const ctx = resolveActionsContext({ env, event });

  const gitRunner = makeExecGitRunner();

  // Policy from the PROTECTED default branch (§C.0 / INV1), never PR HEAD.
  // charterEntries + reviewPolicyPath feed the scoped-mode gate-carrier basis
  // (INV21 — the reviewer-declaration files and the review-policy file).
  const { reviewPolicyText, reviewPolicyPath, charterEntries } = await readProtectedPolicy({
    gitRunner,
    defaultBranch: ctx.defaultBranch,
  });
  const policy = assemblePolicy({ reviewPolicyText, reviewPolicyPath, charterTexts: charterEntries });

  // changed + tree from HEAD content.
  const changed = await computeChanged({ gitRunner, base: ctx.base, head: ctx.head });
  const tree = await buildTree({
    gitRunner,
    head: ctx.head,
    artifactDirs: policy.artifactDirs,
    changed,
  });

  // Records from the PR comment stream, read in full (INV9). A truncated read
  // throws here and is caught below -> non-zero exit (red), never a partial.
  const comments = await readRecordStream({
    fetchImpl: globalThis.fetch,
    owner: ctx.owner,
    repo: ctx.repo,
    prNumber: ctx.prNumber,
    token: ctx.token,
    apiBase: ctx.apiBase,
  });

  // §C.2 carrier fail-close (scoped mode only, adr-0013 AC4): probe the
  // protected branch for the two machinery carriers' existence. In strict/
  // absent scope the probe is skipped and `protectedPaths` stays undefined —
  // byte-identical to pre-amendment (INV19).
  let protectedPaths;
  if (policy.scope === 'scoped') {
    protectedPaths = await readProtectedCarrierPaths({
      gitRunner,
      defaultBranch: ctx.defaultBranch,
      carrierPaths: [policy.checkRuntimeDir.path, policy.checkWorkflowPath.path],
    });
  }

  const derivation = runCheck({ changed, tree, comments, policy, protectedPaths });
  const { text, structured } = render(derivation);

  process.stdout.write(text + '\n');
  if (env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(env.GITHUB_STEP_SUMMARY, text + '\n');
    } catch {
      /* summary is best-effort; the exit code is the authoritative signal */
    }
  }
  if (env.GROVE_STRUCTURED_OUTPUT) {
    process.stdout.write('\n' + JSON.stringify(structured) + '\n');
  }

  // The check-run conclusion: green -> 0, red -> 1.
  process.exit(derivation.green ? 0 : 1);
}

main().catch((err) => {
  // A hard error (INV9 truncated read, a git failure, an unresolvable context)
  // is red — never a green computed over a partial/absent stream.
  process.stderr.write(`grove check: ${err && err.stack ? err.stack : err}\n`);
  process.exit(2);
});
