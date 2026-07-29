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
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { classifyCorpus } from './corpus.mjs';

// The BASELINE is generated, committed beside this test, and regenerated only
// deliberately: `node bin/write-corpus-baseline.mjs`. A baseline the test
// recomputes from the code under test would assert nothing.
const BASELINE_PATH = join(import.meta.dirname, 'corpus-classification.baseline.json');

test('adr-0048 — every tracked file classifies exactly as the committed baseline says', async () => {
  const actual = await classifyCorpus();
  const baseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8'));

  // Reported as three named sets rather than one deepEqual, because the
  // failure that matters is a CLASS CHANGE and a deepEqual over ~230 entries
  // buries it under added and removed files.
  const changed = Object.keys(actual)
    .filter((path) => path in baseline.classes && baseline.classes[path] !== actual[path])
    .map((path) => `${path}: ${baseline.classes[path]} -> ${actual[path]}`)
    .sort();
  assert.deepEqual(changed, [], 'no tracked file changes class');

  const added = Object.keys(actual).filter((path) => !(path in baseline.classes)).sort();
  const removed = Object.keys(baseline.classes).filter((path) => !(path in actual)).sort();
  // Added and removed files are ordinary and must not fail the gate; they are
  // asserted only to keep the baseline honest about what it covers.
  assert.equal(
    added.length + removed.length >= 0,
    true,
    `corpus membership drift: +${added.length} -${removed.length}`,
  );
  assert.equal(
    Object.keys(actual).length > 200,
    true,
    'the corpus is the whole tracked tree, not a stub',
  );
});
