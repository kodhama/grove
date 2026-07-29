// Upstream: adr-0048-parsers-are-dependencies (D2 delivery through the
// generate-and-commit pipeline, D4 one hoisted node_modules via workspaces),
// spec-0004-dual-host-distribution@v8 (the exact package-root shape that fixes
// where a bundle may land).
//
// This file covers the delivery machinery adr-0048 needs BEFORE any parser is
// swapped: the workspace root, the ignore rule that keeps the change set
// bounded, and the CI install step. Nothing here imports a third-party parser
// — the runtime still reads its own formats at this point.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');

// The six packages that carry a suite or a maintainer command today. Declared
// literally: the point of the test is to catch a SEVENTH arriving unregistered,
// which a derived list could never notice.
const KNOWN_WORKSPACE_PACKAGES = Object.freeze([
  'tooling/grove/build',
  'tooling/grove/probes',
  'tooling/grove/release',
  'tooling/grove/tests/dispatch',
  'tooling/grove/tests/gates',
  'tooling/grove/tests/lifecycle',
]);

async function packageManifestDirectories(root, relative = '') {
  const entries = await readdir(join(root, relative), { withFileTypes: true });
  const found = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const child = relative === '' ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) found.push(...(await packageManifestDirectories(root, child)));
    else if (entry.name === 'package.json' && relative !== '') found.push(relative);
  }
  return found;
}

test('adr-0048 D4 — the root manifest declares exactly the six workspace packages, and no package escapes it', async () => {
  const manifest = JSON.parse(
    await readFile(join(REPOSITORY_ROOT, 'package.json'), 'utf8'),
  );
  assert.equal(manifest.private, true, 'the workspace root is never published');
  assert.deepEqual(
    manifest.workspaces,
    [...KNOWN_WORKSPACE_PACKAGES],
    'the declared workspaces are exactly the six known packages, in sorted order',
  );

  // The half a literal list cannot do on its own: a seventh package landing
  // anywhere in the tree without a workspace row installs nothing, so its
  // dependencies resolve by accident or not at all.
  const discovered = (await packageManifestDirectories(REPOSITORY_ROOT)).sort();
  assert.deepEqual(
    discovered,
    [...KNOWN_WORKSPACE_PACKAGES],
    'every package.json in the tree is a declared workspace member',
  );
});

test('adr-0048 D4 — node_modules is ignored BY THE COMMITTED .gitignore, so the derived change set stays bounded', () => {
  // Behavioral, not textual: `git check-ignore -v` reports which ignore SOURCE
  // matched. A rule living in a developer's global excludes or in
  // .git/info/exclude would satisfy a plain check-ignore and ship nothing, so
  // the source is asserted to be the committed file at the repository root.
  // deriveChangeSet builds the change set from `git status --porcelain -uall`
  // (guard-core.mjs); an unignored hoisted install would enter it wholesale.
  for (const candidate of [
    'node_modules',
    'node_modules/yaml/package.json',
    'tooling/grove/build/node_modules/esbuild/lib/main.js',
  ]) {
    const result = spawnSync('git', ['check-ignore', '-v', '--no-index', candidate], {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
    });
    assert.equal(
      result.status,
      0,
      `git check-ignore does not ignore ${candidate}: ${result.stderr ?? result.error?.message ?? ''}`,
    );
    const [source] = String(result.stdout).split(':');
    assert.equal(
      source,
      '.gitignore',
      `${candidate} is ignored by ${source}, not by the committed root .gitignore`,
    );
  }
});

test('adr-0048 D4 — CI installs the workspace before any suite runs, and no longer claims no install is needed', async () => {
  const workflow = await readFile(
    join(REPOSITORY_ROOT, '.github/workflows/grove-tests.yml'),
    'utf8',
  );
  assert.match(
    workflow,
    /^\s+run: npm ci$/m,
    'the test workflow installs the workspace from the committed lockfile',
  );
  // The comment changes with the code: leaving it would document a posture the
  // repository no longer holds.
  assert.doesNotMatch(workflow, /no install step is needed/);
  assert.doesNotMatch(workflow, /All packages are zero-dependency/);
});

test('adr-0048 D4 — the committed lockfile is the install authority npm ci requires', async () => {
  const lock = JSON.parse(
    await readFile(join(REPOSITORY_ROOT, 'package-lock.json'), 'utf8'),
  );
  assert.equal(lock.lockfileVersion >= 3, true, 'npm ci needs a v3+ lockfile');
  for (const workspace of KNOWN_WORKSPACE_PACKAGES) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(lock.packages ?? {}, workspace),
      true,
      `the lockfile resolves the ${workspace} workspace`,
    );
  }
});
