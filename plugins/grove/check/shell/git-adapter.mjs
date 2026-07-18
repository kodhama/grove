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

import { extractFencedBlocks } from '../lib/blocks.mjs';

const LEDGER_FILENAME = 'test-deps.md';

// Policy auto-discovery candidates (spec-0002 INV1 / §C.0). PRECEDENCE, not
// union: the reviewer-declaration dir is the FIRST of these that exists AND
// carries ≥1 grove-review-declaration block. grove-self → charters/ (canonical;
// its vendored .claude/agents/ copies are ignored, so a stale copy can't
// diverge policy). A consumer has no charters/ → .claude/agents/ (where the
// composed reviewer agents live). The review-policy.md is the FIRST of its own
// candidates that exists — charters/review-policy.md (grove-self's Q7 carrier)
// or .grove/review-policy.md (the consumer install location).
const DECLARATION_DIR_CANDIDATES = ['charters', '.claude/agents'];
const REVIEW_POLICY_CANDIDATES = ['charters/review-policy.md', '.grove/review-policy.md'];

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

// Read a directory's `.md` files at the ref as [{ path, text }]. A genuinely
// empty/absent dir makes `git ls-tree <ref> -- <dir>` exit 0 with no output —
// listTree returns [] and this returns []. An actual git command FAILURE
// (nonzero exit / rejection — e.g. `origin/<default>` not fetched in a shallow
// Actions checkout) is NOT "empty": listTree rejects and the rejection
// propagates to readProtectedPolicy's fail-closed-vs-error boundary. The
// review-policy path (read separately) is excluded so it never lands among the
// declaration carriers.
async function readDirMd({ gitRunner, ref, dir, excludePath }) {
  const mdPaths = (await listTree({ gitRunner, ref, path: dir })).filter((p) => p.endsWith('.md'));
  const out = [];
  for (const p of mdPaths) {
    if (p === excludePath) continue;
    out.push({ path: p, text: (await readAt({ gitRunner, ref, path: p })) || '' });
  }
  return out;
}

// readProtectedPolicy({ gitRunner, defaultBranch, remote?, env? })
//   -> { reviewPolicyText, charterTexts, ref }
// Every read targets `origin/<default>` — the protected branch, never PR HEAD
// (§C.0 / INV1). Policy source is AUTO-DISCOVERED by precedence (zero consumer
// config): see the candidate-list comments above. An override env pair
// (GROVE_POLICY_DIR / GROVE_REVIEW_POLICY_PATH) is an escape hatch for
// non-standard layouts; a normal install sets neither.
export async function readProtectedPolicy({
  gitRunner,
  defaultBranch,
  remote = 'origin',
  env = process.env,
} = {}) {
  const ref = `${remote}/${defaultBranch}`;

  // --- review-policy.md: the FIRST candidate that exists (or the override). A
  // missing file makes `git show` exit non-zero -> readAt returns null; a git
  // FAILURE for the same ref is surfaced by the declaration-dir listing below
  // (which distinguishes absence from failure), so swallowing null here is safe.
  const policyCandidates = env.GROVE_REVIEW_POLICY_PATH
    ? [env.GROVE_REVIEW_POLICY_PATH]
    : REVIEW_POLICY_CANDIDATES;
  let reviewPolicyText = '';
  let reviewPolicyPath = null;
  for (const p of policyCandidates) {
    const text = await readAt({ gitRunner, ref, path: p });
    if (text != null) {
      reviewPolicyText = text;
      reviewPolicyPath = p;
      break;
    }
  }

  // --- reviewer-declaration dir: the FIRST candidate that exists AND carries
  // ≥1 grove-review-declaration block (precedence, not union). A candidate that
  // exists but has no declaration block (e.g. a consumer's charters/ with only
  // a README, or none at all) falls THROUGH to the next candidate. If none
  // yields a declaration, degrade fail-closed to an empty charter set (empty
  // policy -> every type owes the full review set). A genuine git FAILURE
  // (ref not fetched) is re-thrown as a hard error, never degraded — the exact
  // fail-closed-vs-error distinction the hardened code drew (§C.0 / INV1).
  const dirCandidates = env.GROVE_POLICY_DIR ? [env.GROVE_POLICY_DIR] : DECLARATION_DIR_CANDIDATES;
  let charterTexts = [];
  let charterEntries = [];
  try {
    for (const dir of dirCandidates) {
      const entries = await readDirMd({ gitRunner, ref, dir, excludePath: reviewPolicyPath });
      const hasDeclaration = entries.some(
        (e) => extractFencedBlocks(e.text, 'grove-review-declaration').length > 0,
      );
      if (hasDeclaration) {
        charterEntries = entries;
        charterTexts = entries.map((e) => e.text);
        break;
      }
    }
  } catch (e) {
    throw new Error(
      `grove check: cannot read policy from the protected branch — ` +
        `listing the reviewer-declaration dir(s) [${dirCandidates.join(', ')}] at ` +
        `${ref} failed: ${e && e.message ? e.message : e}. ` +
        `The protected branch must be fetched (a shallow checkout in Actions ` +
        `needs its default branch available as ${ref}). ` +
        `Refusing to treat an unreadable protected branch as an empty policy.`,
      { cause: e },
    );
  }

  // `charterEntries` carries the reviewer-declaration file PATHS the scoped-mode
  // gate-carrier basis needs (INV21); `charterTexts` stays for back-compat.
  return { reviewPolicyText, reviewPolicyPath, charterTexts, charterEntries, ref };
}

// readProtectedCarrierPaths({ gitRunner, defaultBranch, remote?, carrierPaths })
//   -> Promise<string[]>  (the protected-branch blob paths under the carriers)
// Supplies the protected-branch existence facts runCheck's `resolveCarriers`
// needs (§C.2 carrier fail-close, adr-0013 AC4) — the core stays pure. Lists
// blobs under each carrier path at `origin/<default>` (NEVER PR HEAD, §C.0 /
// INV1): a runtime-dir prefix yields its files (≥1 ⇒ the dir exists), a
// workflow file yields itself when present. An absent carrier path makes
// `git ls-tree -- <path>` exit 0 with no output (listTree returns []), so the
// carrier resolves to nothing and the core reds it (fail-close, never silent
// exclusion). A genuine git FAILURE propagates (bin exits red), consistent with
// readProtectedPolicy — but by then origin/<default> is already known fetched.
export async function readProtectedCarrierPaths({
  gitRunner,
  defaultBranch,
  remote = 'origin',
  carrierPaths = [],
} = {}) {
  const ref = `${remote}/${defaultBranch}`;
  const seen = new Set();
  const out = [];
  for (const p of carrierPaths) {
    if (!p) continue;
    const listed = await listTree({ gitRunner, ref, path: p });
    for (const x of listed) {
      if (!seen.has(x)) {
        seen.add(x);
        out.push(x);
      }
    }
  }
  return out;
}

// --- adr-0014 move 1b: bootstrap self-detect ("grove does not gate its own
//     arrival"). The discriminator asks ONE question — is grove installed on the
//     protected default branch at all yet? — and keys on the presence of a
//     `grove-review-policy` BLOCK on origin/<default>, NOT on workflow-file
//     presence. Policy-presence is the F1-safe discriminator: workflow-file
//     absence-on-base is the exact condition adr-0013's carrier fail-close reds
//     on (a relocated established install), so discriminating on it would
//     override that red. `reviewPolicyText` is supplied by readProtectedPolicy,
//     which reads the review-policy carrier from origin/<default> ONLY — so the
//     discriminator is HEAD-independent and a PR cannot forge "installed" by
//     editing its own HEAD (adr-0013 INV1/S6, the F2 finding).

// The exact non-gating summary line adr-0014 mandates on a fresh-install skip.
export const BOOTSTRAP_SKIP_SUMMARY = 'grove install detected — the check activates on your next PR';

// groveInstalledOnBase({ reviewPolicyText }) -> boolean
// True iff the protected branch's review-policy text bears a grove-review-policy
// block. Block-presence (not file-presence): a carrier file with no block reads
// as "not installed". Absent/empty text (no carrier on base) ⇒ false.
export function groveInstalledOnBase({ reviewPolicyText = '' } = {}) {
  return extractFencedBlocks(reviewPolicyText, 'grove-review-policy').length > 0;
}

// bootstrapSelfDetect({ reviewPolicyText }) -> { skip, summary? }
// The guard decision the shell consults BEFORE running the gating logic. If grove
// is not yet installed on the protected branch (this PR is introducing grove),
// skip GREEN (non-gating, exit 0) with BOOTSTRAP_SKIP_SUMMARY and never invoke the
// check. If grove is established on base, do NOT skip — the normal check runs, so
// adr-0013's carrier fail-close and everything else fire exactly as before.
export function bootstrapSelfDetect({ reviewPolicyText = '' } = {}) {
  if (groveInstalledOnBase({ reviewPolicyText })) return { skip: false };
  return { skip: true, summary: BOOTSTRAP_SKIP_SUMMARY };
}

// The thin, untested real edge: a git-runner backed by execFile('git', ...).
// Never exercised by the unit tests (they inject fakes); disclosed as the
// untested boundary. Large blobs need a generous buffer.
export function makeExecGitRunner({ cwd } = {}) {
  return (args) =>
    new Promise((resolve, reject) => {
      // `-c core.quotepath=false` makes git emit non-ASCII path bytes LITERAL
      // (UTF-8) rather than double-quoted + octal-escaped (`"specs/f\303\266.md"`).
      // Without it, parseChangedPaths yields a mangled, quoted path and readAt
      // can't resolve `<ref>:<path>` — non-ASCII/space artifact paths misparse.
      execFile('git', ['-c', 'core.quotepath=false', ...args], { cwd, maxBuffer: 256 * 1024 * 1024 }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
}
