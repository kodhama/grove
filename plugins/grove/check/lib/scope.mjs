// §C.2 step 0 — the scoped-mode jurisdiction filter + carrier resolution
// (spec-0002 §B scope-mode, §C.1 carrier keys, §C.2 step 0; INV20, INV21;
// adr-0013 dec 1–3). Pure over passed-in inputs.
//
// In `scoped` mode a changed file enters the owed-derivation ONLY if in
// scope — the union of four bases: path (under artifact_dirs), type (ANY
// frontmatter `type:` declaration, recognized or not — never an exit door),
// opted-in code (an ancestor test-deps ledger), and the gate's own carriers
// (reviewer-declaration files, the review-policy file, every ledger, the
// check runtime dir, the workflow file). Out-of-scope files generate zero
// owed pairs and zero reasons — outside jurisdiction, not exempted.

import { artifactMeta } from './frontmatter.mjs';
import { findLedger } from './ledger.mjs';
import { normalizePath } from './normalize.mjs';

const LEDGER_FILENAME = 'test-deps.md';
// adr-0018 D10 — the internal wiring file carrying the check_runtime_dir /
// check_workflow_path keys. Recognized as a gate carrier by filename (the same
// by-basename precedent as the ledger), so an edit to the check's own carrier
// wiring is never silent in scoped mode (adr-0013 §C.2: machinery edits gated).
const REVIEW_WIRING_FILENAME = 'review-wiring.toml';

function treeGet(tree, path) {
  if (tree == null) return undefined;
  if (typeof tree.get === 'function') return tree.get(path);
  return tree[path];
}

function underDirs(path, dirs) {
  return (dirs || []).some((d) => {
    const dd = String(d).replace(/\/+$/, '');
    return path === dd || path.startsWith(dd + '/');
  });
}

// Trailing-slash-normalized prefix match (§C.2 carrier existence semantics,
// round-2 WI2): a path is under the runtime dir iff it lies strictly below
// the prefix.
export function underRuntimeDir(path, runtimeDir) {
  const norm = normalizePath(path);
  const dir = normalizePath(String(runtimeDir).replace(/\/+$/, ''));
  if (norm == null || dir == null) return false;
  return norm.startsWith(dir + '/');
}

// §C.2 step-0 gate-carriers basis (INV21): reviewer-declaration files, the
// review-policy file itself, any test-deps ledger, the installed check
// runtime dir, and the installed workflow file — in scope in BOTH modes.
export function isGateCarrier(path, policy) {
  const norm = normalizePath(path);
  if (norm == null) return false;
  if ((policy.declarationPaths || []).includes(norm)) return true;
  if (policy.reviewPolicyPath != null && norm === policy.reviewPolicyPath) return true;
  const base = norm.slice(norm.lastIndexOf('/') + 1);
  if (base === LEDGER_FILENAME) return true;
  if (base === REVIEW_WIRING_FILENAME) return true;
  if (policy.checkRuntimeDir && underRuntimeDir(norm, policy.checkRuntimeDir.path)) return true;
  if (policy.checkWorkflowPath && norm === normalizePath(policy.checkWorkflowPath.path)) return true;
  return false;
}

// The in-scope union (§C.2 step 0). `tree` is needed for the type basis
// (HEAD frontmatter) and the opted-in-code basis (ancestor ledger walk).
export function inJurisdiction(path, tree, policy) {
  const norm = normalizePath(path);
  if (norm == null) return false;
  // path basis: under a policy artifact_dirs directory (the governed corpus)
  if (underDirs(norm, policy.artifactDirs)) return true;
  // type basis: ANY frontmatter `type:` value, recognized or not (the pinned
  // fail-closed reading — an unknown spelling is never an exit door)
  const meta = artifactMeta(treeGet(tree, path));
  if (meta.hasFrontmatter && meta.type != null) return true;
  // opted-in code: an ancestor test-deps ledger opts the package in. A ledger
  // FILE that exists but carries no readable block still opts in (fail-closed:
  // a malformed ledger is not an exit door; upstream resolution reds it).
  const lr = findLedger(tree, norm);
  if (lr.found || lr.path != null) return true;
  // gate carriers (both modes' scope basis; the fail-close lives in
  // resolveCarriers)
  return isGateCarrier(norm, policy);
}

// §C.2 carrier fail-close (INV21, S23; §C.8): in `scoped` mode both
// machinery carrier paths must EXIST at the protected-branch commit —
// the runtime dir iff at least one blob lies under its prefix, the workflow
// file iff its blob does. `protectedPaths` is the protected-branch blob
// listing (at minimum covering the two carrier paths); an absent/empty
// listing fail-closes to unresolved, never to silent exclusion.
// Returns [{ key, path, provenance }] for each unresolved carrier.
export function resolveCarriers(policy, protectedPaths) {
  const paths = [...(protectedPaths || [])].map(normalizePath).filter((p) => p != null);
  const failures = [];

  const runtime = policy.checkRuntimeDir;
  if (!paths.some((p) => underRuntimeDir(p, runtime.path))) {
    failures.push({ key: 'check_runtime_dir', path: runtime.path, provenance: runtime.provenance });
  }

  const workflow = policy.checkWorkflowPath;
  const wf = normalizePath(workflow.path);
  if (wf == null || !paths.includes(wf)) {
    failures.push({ key: 'check_workflow_path', path: workflow.path, provenance: workflow.provenance });
  }

  return failures;
}
