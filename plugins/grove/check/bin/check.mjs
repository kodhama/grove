#!/usr/bin/env node
// The check CLI entry (spec-0002 — the GitHub/CI shell for the check core).
//
// A thin shell over unit-tested functions: it reads the GitHub Actions context
// (env + event payload), assembles runCheck's four inputs from git + the PR
// record stream, runs the pure core, renders the §D status view, prints the
// summary, and sets the check-run conclusion via the exit code — non-zero on
// red (or any hard error, e.g. INV9's truncated read), zero on green. After
// the verdict it also prints the spec-0003 §D shadow-comparator report to
// stdout — log-only and report-only, never a gate input (spec-0003 INV16).
//
// Before any gating work it applies the adr-0014 move-1b bootstrap self-detect:
// if grove is not yet installed on the protected default branch (no
// grove-review-policy block on origin/<default>), this PR is introducing grove,
// so the check exits GREEN (non-gating) without running the gating logic. The
// discriminator decision is the unit-tested `bootstrapSelfDetect`; only its
// summary write + exit wiring here is the untested edge.
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
  bootstrapSelfDetect,
} from '../shell/git-adapter.mjs';
import { readRecordStream } from '../shell/record-stream.mjs';
import { assemblePolicy } from '../lib/policy.mjs';
import { runCheck } from '../lib/check.mjs';
import { render } from '../lib/view.mjs';
import { runComparatorStep } from '../shell/compare-step.mjs';

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

  // adr-0014 move 1b — grove does not gate its own arrival. Before any gating
  // work, ask the ONE bootstrap question: is grove installed on the protected
  // default branch at all yet (does a grove-review-policy block exist on
  // origin/<default>)? `reviewPolicyText` above was read from the protected
  // branch ONLY, so this is HEAD-independent — a PR cannot forge "installed" by
  // editing its own HEAD (adr-0013 INV1/S6). ABSENT ⇒ this PR is introducing
  // grove: exit GREEN (non-gating) and never run the gating logic. PRESENT ⇒ no
  // skip; the normal check runs and adr-0013's carrier fail-close fires as before.
  // Note this runs AFTER readProtectedPolicy, so a genuine protected-branch READ
  // FAILURE (ref not fetched) still throws → red, never a silent skip.
  const bootstrap = bootstrapSelfDetect({ reviewPolicyText });
  if (bootstrap.skip) {
    process.stdout.write(bootstrap.summary + '\n');
    if (env.GITHUB_STEP_SUMMARY) {
      try {
        appendFileSync(env.GITHUB_STEP_SUMMARY, bootstrap.summary + '\n');
      } catch {
        /* summary is best-effort; the exit code is the authoritative signal */
      }
    }
    process.exit(0);
  }

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

  // spec-0003 §D — the report-only shadow comparator (adr-0023 D5 phase 2),
  // extracted to the unit-tested shell/compare-step.mjs (code-review medium on
  // the phase-2 pass): runs AFTER the verdict + view above, writes ONE
  // delimited section to STDOUT only, swallows its own errors — it can never
  // touch the verdict, exit code, summary, or the structured output below
  // (spec-0003 INV1/INV16, adr-0023 AC3). One-line wiring; the report-only
  // guarantee lives with its tests.
  runComparatorStep({
    changed,
    tree,
    comments,
    policy,
    derivation,
    reviewPolicyText,
    charterEntries,
    write: (s) => process.stdout.write(s),
  });

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
