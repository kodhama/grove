// GitHub Actions context resolution (spec-0002 INV12 — existing platform
// primitives only). Pure over the process env + the parsed event payload, so
// the thin CLI (`bin/check.mjs`) is a shell over a tested function.
//
// The spec pins the four runCheck inputs, not how the shell reads the platform
// context; the env var names below are this shell's choice (reported as a
// resolved ambiguity). GROVE_* overrides exist so the check can run outside a
// standard `pull_request` event (e.g. a manual dispatch) without the payload.

function missing(name, list) {
  list.push(name);
}

// resolveActionsContext({ env, event }) -> resolved context, or throws naming
// every missing required input.
export function resolveActionsContext({ env = {}, event = {} }) {
  const pr = event && event.pull_request ? event.pull_request : {};
  const repository = event && event.repository ? event.repository : {};

  const missingInputs = [];

  // owner / repo from GITHUB_REPOSITORY = "owner/repo"
  let owner = null;
  let repo = null;
  if (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY.includes('/')) {
    const slash = env.GITHUB_REPOSITORY.indexOf('/');
    owner = env.GITHUB_REPOSITORY.slice(0, slash);
    repo = env.GITHUB_REPOSITORY.slice(slash + 1);
  } else {
    missing('owner/repo (GITHUB_REPOSITORY)', missingInputs);
  }

  // PR number: explicit override, then event payload, then refs/pull/<n>/merge.
  let prNumber = null;
  if (env.GROVE_PR_NUMBER != null && env.GROVE_PR_NUMBER !== '') {
    prNumber = Number(env.GROVE_PR_NUMBER);
  } else if (pr.number != null) {
    prNumber = Number(pr.number);
  } else if (event && event.number != null) {
    prNumber = Number(event.number);
  } else if (env.GITHUB_REF) {
    const m = /refs\/pull\/(\d+)\//.exec(env.GITHUB_REF);
    if (m) prNumber = Number(m[1]);
  }
  if (prNumber == null || Number.isNaN(prNumber)) {
    missing('PR number (GROVE_PR_NUMBER or a pull_request event payload)', missingInputs);
  }

  // base / head commit SHAs: override, then event payload.
  const base = env.GROVE_BASE_SHA || (pr.base && pr.base.sha) || null;
  const head = env.GROVE_HEAD_SHA || (pr.head && pr.head.sha) || env.GITHUB_SHA || null;
  // `base` is as required as `head`: it is the left side of the `base...head`
  // merge-base diff (git-adapter computeChanged). A null `base` would otherwise
  // surface only as a cryptic `null...head` git failure downstream, so validate
  // it here for the same clean "missing required input" message `head` gets.
  if (!base) missing('base SHA (GROVE_BASE_SHA or pull_request.base.sha)', missingInputs);
  if (!head) missing('head SHA (GROVE_HEAD_SHA or pull_request.head.sha)', missingInputs);

  // protected default branch: override, payload, GITHUB_BASE_REF, then main.
  const defaultBranch =
    env.GROVE_DEFAULT_BRANCH ||
    repository.default_branch ||
    env.GITHUB_BASE_REF ||
    'main';

  const token = env.GITHUB_TOKEN || env.GH_TOKEN || null;
  const apiBase = env.GITHUB_API_URL || 'https://api.github.com';

  if (missingInputs.length) {
    throw new Error(`grove check: cannot resolve required context — missing: ${missingInputs.join('; ')}`);
  }

  return { owner, repo, prNumber, base, head, defaultBranch, token, apiBase };
}
