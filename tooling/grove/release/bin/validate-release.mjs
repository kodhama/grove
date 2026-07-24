#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { validateReleaseTree } from '../lib/release.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const packageRoot = join(repoRoot, 'plugins', 'grove');
const hostDiscoveryContract = join(
  repoRoot,
  'tooling',
  'grove',
  'probes',
  'host-discovery-contract.json',
);
const args = new Set(process.argv.slice(2));
const release = args.has('--release');
const docs = [
  join(repoRoot, 'README.md'),
  join(packageRoot, 'README.md'),
];

const result = await validateReleaseTree(packageRoot, {
  release,
  docs,
  hostDiscoveryContract,
});
if (!result.ok) {
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`grove ${result.version}: package validation passed${release ? ' for release' : ''}`);
}
