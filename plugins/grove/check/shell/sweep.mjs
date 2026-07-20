// The shadow-metrics sweep (adr-0023 D5 follow-up ①; #91 milestone list) —
// per-PR recomputation of BOTH metric families from durable sources only:
// the PR's comment stream (coordination: closure/ordering/annotations) and
// local git objects (divergence: the §D comparison, recomputed rather than
// scraped from expiring CI logs). READ-ONLY everywhere: GET requests, git
// reads at fixed refs, no working-tree mutation, nothing posted.
//
// Composition over the tested pieces — no rule is re-spelled here:
// record-stream (INV9 paginate-to-exhaustion), git-adapter (changed/tree/
// policy at refs), runCheck (the table side), computeComparison (§D),
// metrics.mjs (coordination). Injected fetch/git runners keep this module
// unit-testable against fakes; bin wires the real ones.

import { readRecordStream } from './record-stream.mjs';
import { computeChanged, buildTree, readProtectedPolicy } from './git-adapter.mjs';
import { assemblePolicy } from '../lib/policy.mjs';
import { runCheck } from '../lib/check.mjs';
import { computeComparison } from '../lib/compare.mjs';
import { checkAdmissibility } from '../lib/records.mjs';
import { artifactMeta } from '../lib/frontmatter.mjs';
import { askClosure, annotationConsumption } from '../lib/metrics.mjs';
import { normalizePath } from '../lib/normalize.mjs';

async function fetchPrMeta({ fetchImpl, owner, repo, prNumber, token, apiBase }) {
  const url = `${apiBase}/repos/${owner}/${repo}/pulls/${prNumber}`;
  const res = await fetchImpl(url, {
    headers: {
      accept: 'application/vnd.github+json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`PR meta fetch failed (${res.status}) for ${url}`);
  return res.json();
}

// The §C.3.2 policy-carrier basis, single-homed with the comparator step's
// assembly (same first-wins map shape).
function buildProtectedTree({ policy, reviewPolicyText, charterEntries }) {
  const protectedTree = new Map();
  if (policy.reviewPolicyPath != null) protectedTree.set(policy.reviewPolicyPath, reviewPolicyText);
  for (const e of charterEntries) {
    const p = normalizePath(e.path);
    if (p != null && !protectedTree.has(p)) protectedTree.set(p, e.text);
  }
  return protectedTree;
}

// sweepPr({ fetchImpl, gitRunner, owner, repo, prNumber, token }) ->
//   { prNumber, base, head, changedCount, closure, annotations, comparison }
export async function sweepPr({ fetchImpl, gitRunner, owner, repo, prNumber, token, apiBase = 'https://api.github.com' }) {
  const meta = await fetchPrMeta({ fetchImpl, owner, repo, prNumber, token, apiBase });
  const base = meta.base.sha;
  const head = meta.head.sha;
  // The protected-branch ref for policy reads — from the PR's own base repo
  // (caught by the first real run: omitting it resolves origin/undefined and
  // the policy read correctly refuses, INV1 fail-closed).
  const defaultBranch = meta.base.repo && meta.base.repo.default_branch ? meta.base.repo.default_branch : 'main';

  const comments = await readRecordStream({ fetchImpl, owner, repo, prNumber, token, apiBase });
  const changed = await computeChanged({ gitRunner, base, head });
  const { reviewPolicyText, reviewPolicyPath, charterEntries } = await readProtectedPolicy({ gitRunner, defaultBranch });
  const policy = assemblePolicy({ reviewPolicyText, reviewPolicyPath, charterTexts: charterEntries });
  const tree = await buildTree({ gitRunner, head, artifactDirs: policy.artifactDirs, changed });

  // Divergence family — the table side and the §D comparison, recomputed.
  const derivation = runCheck({ changed, tree, comments, policy });
  const comparison = computeComparison({
    diffFiles: changed,
    tree,
    comments,
    policy,
    derivation,
    protectedTree: buildProtectedTree({ policy, reviewPolicyText, charterEntries }),
  });

  // Coordination family — over ADMISSIBLE comments only (§A.4).
  const posterPolicy = { record_poster_allowlist: policy.recordPosterAllowlist };
  const admissible = comments.filter((c) => checkAdmissibility(c, posterPolicy).admissible);
  const ctx = {
    typeOf: (p) => {
      const meta2 = artifactMeta(tree instanceof Map ? tree.get(p) : tree(p));
      return meta2.hasFrontmatter ? (meta2.type ?? null) : null;
    },
    reviewlessTypes: policy.reviewlessTypesSet,
  };
  const closure = askClosure({ comments: admissible, ctx, policy });
  const annotations = annotationConsumption({ comments: admissible });

  return { prNumber, base, head, changedCount: changed.length, closure, annotations, comparison };
}
