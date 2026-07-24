// Artifact index + id resolution (spec-0002 §A.3 step 1, §C.7).
// Globs the policy-declared artifact dirs at HEAD, maps frontmatter id -> path.
// Two files claiming one id make it ambiguous: every resolution through it
// fails (collided), never a silent pick.

import { parseFrontmatter } from './frontmatter.mjs';

// Strip an @version pin (versioning.md: ids carry no @, versions no /).
export function stripVersion(id) {
  const at = id.indexOf('@');
  return at < 0 ? id : id.slice(0, at);
}

function treeEntries(tree) {
  if (tree == null) return [];
  if (typeof tree.entries === 'function') return [...tree.entries()];
  return Object.entries(tree);
}

function underDirs(path, dirs) {
  return dirs.some((d) => path === d || path.startsWith(d.replace(/\/$/, '') + '/'));
}

// Returns Map<id, string[]> (paths). A length-2+ array is a collision.
export function buildArtifactIndex(tree, artifactDirs) {
  const index = new Map();
  const dirs = (artifactDirs && artifactDirs.length ? artifactDirs : ['decisions', 'specs', 'charters']);
  for (const [path, content] of treeEntries(tree)) {
    if (!underDirs(path, dirs)) continue;
    const fm = parseFrontmatter(content);
    if (!fm || fm.id == null) continue;
    const id = String(fm.id);
    if (!index.has(id)) index.set(id, []);
    index.get(id).push(path);
  }
  return index;
}

// resolveId -> one of:
//   { status: 'ok', path }
//   { status: 'dangling' }
//   { status: 'collided', paths }
//   { status: 'crossrepo', repo, id }   (shape-checked only, v0 no-fetch)
export function resolveId(index, rawId) {
  const bare = stripVersion(String(rawId).trim());
  if (bare.includes('/')) {
    // cross-repo qualified id: <repo>/<id>
    const slash = bare.indexOf('/');
    const repo = bare.slice(0, slash);
    const id = bare.slice(slash + 1);
    if (repo === '' || id === '' || id.includes('/')) {
      return { status: 'malformed', id: rawId };
    }
    return { status: 'crossrepo', repo, id };
  }
  const paths = index.get(bare);
  if (!paths || paths.length === 0) return { status: 'dangling' };
  if (paths.length > 1) return { status: 'collided', paths: [...paths] };
  return { status: 'ok', path: paths[0] };
}
