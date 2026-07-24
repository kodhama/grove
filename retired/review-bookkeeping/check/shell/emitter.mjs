// The record-emitter shell (adr-0015 Consequence 2). Reads the HEAD tree from
// git behind an injectable `gitRunner` (the same pattern as the check's git
// adapter — unit-tested against fakes; the real execFile edge is
// makeExecGitRunner), builds the artifact index, and delegates the actual
// stamping to the pure lib/emit.mjs. This is the check's freshness computation
// run FORWARD: it reads the same HEAD blob bytes the check will later verify.
//
// Reading records / posting them to the PR is the HARNESS's job (adr-0015
// Decision 3), not this module's — the emitter only produces the record blocks.

import { buildTree } from './git-adapter.mjs';
import { buildArtifactIndex } from '../lib/artifact-index.mjs';
import { emitRecords } from '../lib/emit.mjs';
import { normalizePath } from '../lib/normalize.mjs';

const DEFAULT_ARTIFACT_DIRS = ['decisions', 'specs', 'charters'];

// emitFromJudgment({ gitRunner, head, judgment, artifactDirs? })
//   -> Promise<{ records: [...], errors: [...] }>
// The HEAD tree is built over the artifact dirs (for the id index + fidelity
// upstream content), the judgment's subject paths (the reviewed files), and
// every test-deps ledger (code-upstream resolution) — exactly the paths
// emit.mjs reads. `artifactDirs` defaults to the standard three; a consumer
// with custom `artifact_dirs` in policy passes them through.
export async function emitFromJudgment({ gitRunner, head = 'HEAD', judgment, artifactDirs } = {}) {
  const dirs = artifactDirs && artifactDirs.length ? artifactDirs : DEFAULT_ARTIFACT_DIRS;
  // Normalize the subject paths to the SAME canonical form emit.mjs applies
  // (`normalizePath`) before they seed buildTree's changed-set (code-review
  // high). A non-canonical subject (`./lib/foo.mjs`, a trailing-slash or
  // `a/./b` form) would otherwise miss the changed-set — git lists the
  // canonical `lib/foo.mjs` while the set holds the raw form — so the blob is
  // never loaded and emit.mjs (which normalizes first) fingerprints over the
  // ABSENT sentinel, minting a permanently-stale record. One normalization,
  // both consumers: the tree source and the fingerprint basis use one path set.
  const changed = judgment.subject.map(normalizePath).filter(Boolean);
  const tree = await buildTree({ gitRunner, head, artifactDirs: dirs, changed });
  const index = buildArtifactIndex(tree, dirs);
  return emitRecords({ judgment, tree, index });
}
