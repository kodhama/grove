#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { validateReleaseTree } from '../lib/release.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = resolve(packageRoot, '..', '..');
const args = new Set(process.argv.slice(2));
const release = args.has('--release');
const docs = [
  join(repoRoot, 'README.md'),
  join(packageRoot, 'README.md'),
];

const result = await validateReleaseTree(packageRoot, { release, docs });
if (!result.ok) {
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`grove ${result.version}: package validation passed${release ? ' for release' : ''}`);
}
