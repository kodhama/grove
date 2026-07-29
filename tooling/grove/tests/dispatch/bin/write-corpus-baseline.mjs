#!/usr/bin/env node
// Regenerates the committed corpus-classification baseline. Run DELIBERATELY,
// never as part of the suite: a baseline the gate regenerates for itself is a
// gate that cannot fail (adr-0048).
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { classifyCorpus } from '../test/corpus.mjs';

const classes = await classifyCorpus();
await writeFile(
  join(import.meta.dirname, '..', 'test', 'corpus-classification.baseline.json'),
  `${JSON.stringify({
    generated: 'baseline of classifyContent over every tracked file; regenerate deliberately with bin/write-corpus-baseline.mjs',
    classes,
  }, null, 2)}\n`,
);
console.log(`wrote ${Object.keys(classes).length} classifications`);
