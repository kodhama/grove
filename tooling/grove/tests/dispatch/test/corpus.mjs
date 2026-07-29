// Upstream: spec-0006-voluntary-dispatch@v3 §Transition rules (the subject-class
// table and §Frontmatter reading), INV16. Decision:
// adr-0048-parsers-are-dependencies.
//
// THE CORPUS TEST, and it is new rather than transferred. adr-0048's
// Consequences say "the corpus classification test transfers directly"; that is
// WRONG, and it was verified wrong before this file was written: no such test
// existed anywhere in the tree. What existed was a one-time manual measurement
// recorded in a code comment at guard-core.mjs. A comment is not a gate — it
// cannot go red — so replacing the frontmatter reader with the measurement
// still only a comment would have been an unguarded change to the single
// function every classification in grove flows through.
//
// What this pins: EVERY tracked file in this repository classifies the same
// before and after the reader is replaced. It asserts "no file differs", never
// a count — the count in the old comment was already stale by one when this was
// written (the comment predates adr-0048's own commit), and a count assertion
// would go red on any commit that adds a file, teaching everyone to update the
// number without looking at what changed.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { classifyContent } from '../../../../../plugins/grove/runtime/dispatch/lib/guard-core.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..');

function trackedFiles() {
  return execFileSync('git', ['-C', REPOSITORY_ROOT, 'ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter((path) => path !== '')
    .sort();
}

// Only text files can bear frontmatter, and the generated parser bundle is
// 300 KB of third-party bytes whose classification says nothing about grove.
const SKIP = new Set(['plugins/grove/runtime/dispatch/lib/parsers.mjs']);

export async function classifyCorpus() {
  const classes = {};
  for (const path of trackedFiles()) {
    if (SKIP.has(path)) continue;
    let content;
    try {
      content = await readFile(join(REPOSITORY_ROOT, path), 'utf8');
    } catch {
      continue;
    }
    // The full classification, not just the base: the implements-bearing
    // overlay is exactly what F2 moves, so a baseline that dropped it would be
    // blind to the change most likely to under-owe.
    classes[path] = [...classifyContent(content).classes].sort().join('+');
  }
  return classes;
}

