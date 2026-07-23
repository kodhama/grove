#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { renderSurfaceDocumentation, replaceSurfaceDocumentation } from '../lib/release.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = resolve(packageRoot, '..', '..');
const matrix = JSON.parse(await readFile(join(packageRoot, 'surfaces.json'), 'utf8'));
const rendered = renderSurfaceDocumentation(matrix);

for (const path of [join(repoRoot, 'README.md'), join(packageRoot, 'README.md')]) {
  const before = await readFile(path, 'utf8');
  const after = replaceSurfaceDocumentation(before, rendered);
  if (after !== before) {
    await writeFile(path, after);
    console.log(`updated ${path}`);
  } else {
    console.log(`clean ${path}`);
  }
}
