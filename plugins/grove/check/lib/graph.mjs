// Graph resolution — the MECHANICAL half of graph integrity (spec-0002 §C.7,
// INV18, S18). Pure f(HEAD): for every changed artifact, each intra-repo id in
// its depends_on / implements frontmatter must resolve at HEAD to exactly one
// path via the artifact index (version suffixes stripped first).
//
//   - dangling id (resolves to nothing) => red, `unresolvable-reference`.
//   - collided id (two files claim it)   => red, naming both paths; every
//     resolution through it fails rather than silently picking one.
//   - cross-repo qualified ids (`repo/id`) => shape-checked only (v0 no-fetch,
//     adr-0006 dec 3): never red for unresolvability, never silently resolved.
//
// The JUDGMENT half (propagation claims true) stays the conformance-reviewer's.

import { resolveId, stripVersion } from './artifact-index.mjs';

// resolveGraph(meta, index) -> { ok, violations: [{ id, kind, paths? }] }
//   meta: the artifact's artifactMeta() (implements: string|null, depends_on: []).
//   kind: 'dangling' | 'collision' | 'malformed'.
export function resolveGraph(meta, index) {
  const ids = [];
  if (meta.implements != null) ids.push(meta.implements);
  for (const d of meta.depends_on) ids.push(d);

  const violations = [];
  const seen = new Set();
  for (const rawId of ids) {
    const bare = stripVersion(String(rawId).trim());
    if (seen.has(bare)) continue;
    seen.add(bare);
    const r = resolveId(index, rawId);
    if (r.status === 'ok' || r.status === 'crossrepo') continue;
    if (r.status === 'collided') {
      violations.push({ id: bare, kind: 'collision', paths: [...r.paths] });
    } else {
      // 'dangling' (resolves to nothing) or 'malformed' (broken qualified shape)
      violations.push({ id: bare, kind: r.status === 'malformed' ? 'malformed' : 'dangling' });
    }
  }
  return { ok: violations.length === 0, violations };
}
