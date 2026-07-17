// The git adapter (spec-0002 §C.0, §C.2, §B, INV1, INV12).
//
// Produces two of runCheck's inputs from git content only (INV12 — no
// attestation/identity/forge-resistant store):
//   - `changed` — the added/modified paths present at HEAD that owe review,
//     from the PR's base...HEAD merge-base diff (§C.2: a rename = old-path
//     deletion + new-path addition).
//   - `tree`    — an eager Map<path, content> at HEAD covering the paths the
//     core reads: the artifact dirs (for the id index + `.entries()`), the
//     changed files (subjects), and every `test-deps.md` ledger (code-upstream
//     resolution walks ancestors for it). A plain Map gives the sync
//     `.get()` / `.has()` / `.entries()` the pure core needs.
// And it reads the policy inputs from the PROTECTED default branch, NEVER PR
// HEAD (§C.0 trust boundary / INV1): `git show origin/<default>:<path>`.
//
// `gitRunner` — async (args:string[]) => stdout — is injected so the diff
// parsing, tree assembly, and protected-branch reads are unit-tested against
// fakes; the real `execFile('git', ...)` (makeExecGitRunner) is the thin
// untested edge.

import { execFile } from 'node:child_process';

const LEDGER_FILENAME = 'test-deps.md';

function underDirs(path, dirs) {
  return dirs.some((d) => {
    const dd = d.replace(/\/$/, '');
    return path === dd || path.startsWith(dd + '/');
  });
}

// Parse `git diff --name-status -M` output into the paths that owe review at
// HEAD (§C.2). A: added, M: modified, T: type-change -> the path. R/C: the NEW
// path (the old path is a deletion). D: dropped (a deletion owes no review).
export function parseChangedPaths(nameStatusOutput) {
  const out = [];
  for (const line of String(nameStatusOutput).split('\n')) {
    if (line.trim() === '') continue;
    const fields = line.split('\t');
    const letter = fields[0][0];
    if (letter === 'A' || letter === 'M' || letter === 'T') {
      out.push(fields[1]);
    } else if (letter === 'R' || letter === 'C') {
      out.push(fields[2]);
    }
    // 'D' (and anything else) contributes nothing.
  }
  return out;
}

// computeChanged({ gitRunner, base, head }) -> Promise<string[]>
// Three-dot `base...head` diffs HEAD against the merge-base on the protected
// branch (§C.2 / Terms: "changed between the PR's merge-base ... and HEAD").
export async function computeChanged({ gitRunner, base, head }) {
  const out = await gitRunner(['diff', '--name-status', '-M', `${base}...${head}`]);
  return parseChangedPaths(out);
}

// List paths at a ref: `git ls-tree -r --name-only <ref> [-- <path>]`.
export async function listTree({ gitRunner, ref, path }) {
  const args = ['ls-tree', '-r', '--name-only', ref];
  if (path) args.push('--', path);
  const out = await gitRunner(args);
  return String(out)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Read a file's content at a ref: `git show <ref>:<path>`. A missing path
// (git exits non-zero -> runner rejects) yields null rather than throwing, so a
// listed-then-vanished race degrades to ABSENT in the fingerprint basis.
export async function readAt({ gitRunner, ref, path }) {
  try {
    return await gitRunner(['show', `${ref}:${path}`]);
  } catch {
    return null;
  }
}

// buildTree({ gitRunner, head, artifactDirs, changed }) -> Promise<Map>
// Eager over exactly the paths the core reads (§B): artifact-dir files, changed
// files, and every ledger. One whole-tree listing + a read per selected path.
export async function buildTree({ gitRunner, head, artifactDirs, changed = [] }) {
  const dirs = artifactDirs && artifactDirs.length ? artifactDirs : ['decisions', 'specs', 'charters'];
  const changedSet = new Set(changed);
  const allPaths = await listTree({ gitRunner, ref: head });
  const tree = new Map();
  for (const p of allPaths) {
    const baseName = p.slice(p.lastIndexOf('/') + 1);
    if (underDirs(p, dirs) || baseName === LEDGER_FILENAME || changedSet.has(p)) {
      tree.set(p, await readAt({ gitRunner, ref: head, path: p }));
    }
  }
  return tree;
}

// readProtectedPolicy({ gitRunner, defaultBranch, remote? })
//   -> { reviewPolicyText, charterTexts, ref }
// Every read targets `origin/<default>` — the protected branch, never PR HEAD
// (§C.0 / INV1). `charters/review-policy.md` carries the grove-review-policy
// block; every other `charters/*.md` is a candidate grove-review-declaration
// carrier (assemblePolicy ignores files with no declaration block).
export async function readProtectedPolicy({ gitRunner, defaultBranch, remote = 'origin' }) {
  const ref = `${remote}/${defaultBranch}`;
  let charterPaths = [];
  try {
    charterPaths = await listTree({ gitRunner, ref, path: 'charters' });
  } catch {
    charterPaths = [];
  }
  const mdPaths = charterPaths.filter((p) => p.endsWith('.md'));
  let reviewPolicyText = '';
  const charterTexts = [];
  for (const p of mdPaths) {
    const text = (await readAt({ gitRunner, ref, path: p })) || '';
    if (p === 'charters/review-policy.md') reviewPolicyText = text;
    else charterTexts.push(text);
  }
  return { reviewPolicyText, charterTexts, ref };
}

// The thin, untested real edge: a git-runner backed by execFile('git', ...).
// Never exercised by the unit tests (they inject fakes); disclosed as the
// untested boundary. Large blobs need a generous buffer.
export function makeExecGitRunner({ cwd } = {}) {
  return (args) =>
    new Promise((resolve, reject) => {
      execFile('git', args, { cwd, maxBuffer: 256 * 1024 * 1024 }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
}
