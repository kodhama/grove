// Upstream set U(S, C) for fidelity records (spec-0002 §A.3, INV4).
// Derived by the check itself from HEAD — the implements edge for artifacts,
// the test-deps ledger for code — NEVER read from the record, NEVER the rest
// of depends_on. Any resolution gap is surfaced as an error (the caller goes
// red with that reason), never a silently smaller basis.

import { artifactMeta } from './frontmatter.mjs';
import { resolveId } from './artifact-index.mjs';
import { findLedger } from './ledger.mjs';

function treeGet(tree, path) {
  if (tree == null) return undefined;
  if (typeof tree.get === 'function') return tree.get(path);
  return tree[path];
}

// resolveUpstream(subjects, tree, index) ->
//   { U: Set<path>, errors: [{ subject, kind, detail }] }
export function resolveUpstream(subjects, tree, index) {
  const U = new Set();
  const errors = [];

  for (const subject of subjects) {
    const content = treeGet(tree, subject);
    const meta = artifactMeta(content);

    if (meta.hasFrontmatter) {
      // artifact: upstream is the single implements edge
      if (meta.implements == null) {
        errors.push({ subject, kind: 'no-reviewable-upstream', detail: 'no implements: declaration' });
        continue;
      }
      addResolved(subject, meta.implements, index, U, errors);
    } else {
      // code: upstream is the ledger-named specs/decisions
      const led = findLedger(tree, subject);
      if (!led.found) {
        errors.push({ subject, kind: 'no-reviewable-upstream', detail: 'no test-deps ledger entry' });
        continue;
      }
      if (led.ids.length === 0) {
        errors.push({ subject, kind: 'no-reviewable-upstream', detail: `empty ledger ${led.path}` });
        continue;
      }
      for (const id of led.ids) addResolved(subject, id, index, U, errors);
    }
  }

  return { U, errors };
}

function addResolved(subject, id, index, U, errors) {
  const r = resolveId(index, id);
  if (r.status === 'ok') {
    U.add(r.path);
  } else if (r.status === 'crossrepo') {
    // v0 no-fetch (adr-0006 dec 3): shape-checked only, not fingerprintable
    // here, and NOT an error (disclosed limit). Contributes nothing to U.
  } else if (r.status === 'collided') {
    errors.push({ subject, kind: 'unresolvable-reference', detail: `id ${id} collides: ${r.paths.join(', ')}` });
  } else {
    errors.push({ subject, kind: 'unresolvable-reference', detail: `id ${id} resolves to nothing` });
  }
}
