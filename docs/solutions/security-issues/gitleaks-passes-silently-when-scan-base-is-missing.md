---
title: gitleaks passes silently when the CI scan's base commit is missing
date: 2026-10-11
category: security-issues
module: CI secrets scan
problem_type: security_issue
component: infrastructure
symptoms:
  - "Secrets step is green, but its log shows `ERR [git] fatal: Invalid revision range` followed by `0 commits scanned` and `no leaks found`"
  - "gitleaks exits 0 after `git log` fails on a base..HEAD range whose base is not in the clone"
  - A secret added only in a merge commit's conflict resolution is never reported
root_cause: missing_validation
resolution_type: config_change
severity: high
framework_version: gitleaks 8.30.1
tags: [gitleaks, ci, secrets-scan, github-actions, force-push, remerge-diff, git-log]
---

# gitleaks passes silently when the CI scan's base commit is missing

## Problem

**The CI secrets scan went green after scanning nothing.** The Secrets step in `.github/workflows/test.yml` runs gitleaks over `<base>..HEAD`. When the base commit was missing from the clone, gitleaks still exited 0. A `github.event.before` orphaned by a force-push is one way to get a missing base. The scan had looked at zero commits, so a leak in that push would have shipped unreported.

## Symptoms

The step log reads like a clean run, apart from an `ERR` line or two that are easy to miss:

```
ERR [git] fatal: Invalid revision range <base>..HEAD
INF 0 commits scanned.
INF no leaks found
```

The step's exit code is 0.

## What Didn't Work

- **Trusting gitleaks' exit code.** gitleaks runs `git log -p -U0 <log-opts>` and scans whatever comes out. When `git log` fails on a bad range, gitleaks logs the error, scans zero commits and exits 0. The exit code reports "no leaks in what I scanned". It does not report that the scan ran.
- **Using `-m` to make merges visible.** This was the first version of the fix in kodhama/grove PR #13. An adversarial Codex review of that version flagged it as P1, and the reproduction confirmed it (session history):
  - `-m` diffs each merge against every parent, so a merge-only secret is reported twice.
  - On a `pull_request` run, HEAD is GitHub's synthetic test-merge commit. Its diff against the PR head (second parent) replays every change main has made since the branch point. A PR that adds no secret could then fail the required check on a secret already on main.
- **Adding one option to the full scan.** With `--log-opts="--remerge-diff"` alone, the full scan quietly narrowed to HEAD's history (see Solution, point 2).

## Solution

The Secrets step after kodhama/grove PR #13 (unmerged as of this writing):

```bash
if [ -z "${SECRETS_BASE}" ] || [ "${SECRETS_BASE}" = "0000000000000000000000000000000000000000" ] \
   || ! git cat-file -e "${SECRETS_BASE}^{commit}" 2>/dev/null; then
  /tmp/gitleaks git . --config .gitleaks.toml --redact --no-banner --log-opts="--remerge-diff --full-history --all --diff-filter=tuxdb"
else
  /tmp/gitleaks git . --config .gitleaks.toml --redact --no-banner --log-opts="--remerge-diff ${SECRETS_BASE}..HEAD"
fi
```

Before the fix, the condition had no `cat-file` check, the full scan passed no `--log-opts`, and the ranged scan passed only `"${SECRETS_BASE}..HEAD"`.

Each part answers one of four findings, all verified with gitleaks 8.30.1 and git 2.39.5, every case run under `bash -e`:

1. **Check the base yourself, inside the `if` condition.** `git cat-file -e "${BASE}^{commit}"` fails when the commit is missing. GitHub Actions runs `run:` steps under `bash -e`. A failing command in an `if` condition does not trigger errexit, so the step reaches your handling. A bare `git cat-file -e` line on its own would end the step instead.
2. **Any `--log-opts` value replaces gitleaks' default log options.** It does not add to them. For a full scan the defaults are `--full-history --all --diff-filter=tuxdb`. Passing only `--remerge-diff` narrows the scan to HEAD's history. If you add an option to the full scan, restate the defaults with it.
3. **Plain `git log -p` shows no diff for merge commits.** A secret that exists only in a conflict resolution is invisible to it. `--remerge-diff` (git 2.36 or later; GitHub's Ubuntu runners have it) shows only what each merge itself resolved. The merge-only secret is found once, and a PR's test merge normally shows nothing, so main is not replayed.
4. **Pick the missing-base fallback by the state of the history.**
   - **Full scan** (grove): the history is clean, so scanning everything is a usable fallback.
   - **Fail closed** (kodhama/math-quest PR #932, MQ-417): its history carries 122 heuristic hits from deleted vendored files, so a full scan would fail every time. The step prints an `::error::` naming the base and a local command to scan the range by hand, then runs `exit 1`.

## Why This Works

**The root cause is that gitleaks treats "git returned no commits" the same as "git returned commits with no leaks".** Neither its exit code nor its summary line separates the two. The `cat-file` check moves that decision into the workflow, where a missing base becomes a deliberate branch: a full scan or a hard failure, never an empty scan. Restating the defaults keeps the full scan as wide as gitleaks' own. `--remerge-diff` closes the merge-commit blind spot without the double count and main replay that `-m` brings.

## Prevention

- **Treat a scanner's exit 0 as "nothing found in what it scanned".** It does not prove the scan ran. When a tool reads a revision range, check the range resolves before handing it over, and test the case where it does not.
- **Reproduce before trusting a fix.** In a scratch repo with a placeholder secret, run gitleaks with a range whose base does not exist. It should fail or fall back, never print `0 commits scanned` and pass. Do the same for a secret introduced only in a merge's conflict resolution. Never put a real-looking token in a tracked file: this repo's own scan would flag it.
- **Restate gitleaks' defaults whenever you pass `--log-opts` to a full scan.**
- **Pin the guard with a test where the repo has one for workflows.** math-quest's PR adds a test that fails if `exit 1`, the `cat-file` check or `--remerge-diff` is dropped. Grove has no test that reads the workflow; its evidence is the table in PR #13.

## Related Issues

- kodhama/grove PR #13 (GRO-19): full-scan fallback, `--remerge-diff` on both scans.
- kodhama/math-quest PR #932 (MQ-417): fail-closed fallback, `--remerge-diff` on the ranged scan.
