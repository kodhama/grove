// The LOCAL owed-map preview (grove#108) — "what would the bookkeeping check
// owe on this branch?", answered before CI, offline, from local git alone.
//
// Composes the SAME unit-tested pipeline as bin/check.mjs — readProtectedPolicy
// → bootstrapSelfDetect → assemblePolicy → computeChanged → buildTree →
// runCheck → render — with exactly one substitution: `comments: []`. The check
// core computes the owed-map BEFORE any record matching, so an empty record
// stream yields every owed pair with its reasons — the full CI red-list,
// with no PR, no network, no token. Nothing here posts, writes, or gates:
// the preview is INFORMATIONAL — it renders spec-0002's §B/§C computation,
// it is not a gate surface (the check's verdict remains CI's, computed over
// the real record stream; INV14's human-owned remedies are untouched).
//
// Base/head semantics match CI: three-dot `origin/<default>...<head>`
// (merge-base), reading COMMITTED content at <head> — a dirty working tree is
// not previewed (disclosed; commit first). The protected-branch policy read is
// the same §C.0 trust boundary as CI: policy comes from `origin/<default>`,
// never the local branch, so a preview cannot be softened by editing policy
// in-branch.

import {
  computeChanged,
  buildTree,
  readProtectedPolicy,
  readProtectedCarrierPaths,
  bootstrapSelfDetect,
} from './git-adapter.mjs';
import { assemblePolicy } from '../lib/policy.mjs';
import { runCheck } from '../lib/check.mjs';
import { render } from '../lib/view.mjs';

// resolveLocalDefaultBranch({ gitRunner, override }) -> string
// The ONE input CI got from the event payload that a local run must discover:
// the protected default branch. `override` (a --default-branch flag) wins;
// else `git symbolic-ref refs/remotes/origin/HEAD` (set by clone; restorable
// via `git remote set-head origin -a`). Unresolvable is a LOUD error naming
// both fixes — never a silent guess (a wrong base would silently shrink the
// preview's diff, the fail-open this tool exists to prevent).
export async function resolveLocalDefaultBranch({ gitRunner, override } = {}) {
  if (override) return override;
  try {
    const out = await gitRunner(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    const ref = String(out).trim();
    const prefix = 'refs/remotes/origin/';
    if (ref.startsWith(prefix) && ref.length > prefix.length) {
      return ref.slice(prefix.length);
    }
    throw new Error(`unexpected symbolic-ref output: ${ref}`);
  } catch (e) {
    throw new Error(
      'grove preview: cannot resolve the default branch (origin/HEAD is unset). ' +
        'Fix: `git remote set-head origin -a`, or pass --default-branch <name>.',
      { cause: e },
    );
  }
}

// runPreview({ gitRunner, defaultBranch, head = 'HEAD' })
//   -> { installed: false, summary }                        (adr-0014 bootstrap)
//    | { installed: true, derivation, text, structured }
// The composition, behind an injectable git runner (unit-tested with fakes;
// the real execFile runner is bin/preview.mjs's disclosed edge).
export async function runPreview({ gitRunner, defaultBranch, head = 'HEAD' }) {
  const { reviewPolicyText, reviewPolicyPath, charterEntries } = await readProtectedPolicy({
    gitRunner,
    defaultBranch,
  });

  // adr-0014 move 1b — same bootstrap question as CI: not installed on the
  // protected branch ⇒ nothing owes; report that plainly instead of a forged
  // empty owed-map.
  const bootstrap = bootstrapSelfDetect({ reviewPolicyText });
  if (bootstrap.skip) {
    return { installed: false, summary: bootstrap.summary };
  }

  const policy = assemblePolicy({ reviewPolicyText, reviewPolicyPath, charterTexts: charterEntries });

  const base = `origin/${defaultBranch}`;
  const changed = await computeChanged({ gitRunner, base, head });
  const tree = await buildTree({ gitRunner, head, artifactDirs: policy.artifactDirs, changed });

  // §C.2 carrier fail-close parity with CI (scoped mode only, adr-0013 AC4).
  let protectedPaths;
  if (policy.scope === 'scoped') {
    protectedPaths = await readProtectedCarrierPaths({
      gitRunner,
      defaultBranch,
      carrierPaths: [policy.checkRuntimeDir.path, policy.checkWorkflowPath.path],
    });
  }

  // The one deliberate substitution: an empty record stream. Every owed pair
  // surfaces unsatisfied — the preview IS the owed-map.
  const derivation = runCheck({ changed, tree, comments: [], policy, protectedPaths });
  const { text, structured } = render(derivation);
  return { installed: true, derivation, text, structured };
}
