#!/usr/bin/env node
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  assemblePackageSnapshot,
  validatePackageTree,
} from '../../release/lib/release.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const sourcePackageRoot = join(repositoryRoot, 'plugins', 'grove');
const snapshotWorkspace = await mkdtemp(join(tmpdir(), 'grove-package-snapshot-'));
const packageRoot = join(snapshotWorkspace, 'grove');
const compositionPackageRoot = join(snapshotWorkspace, 'composition-only-grove');
const consumerRoot = await mkdtemp(join(tmpdir(), 'grove-package-smoke-'));
try {
const packageValidation = await validatePackageTree(sourcePackageRoot);
assert.equal(packageValidation.ok, true, packageValidation.errors.join('\n'));
await assemblePackageSnapshot(sourcePackageRoot, packageRoot, packageValidation);
await cp(packageRoot, compositionPackageRoot, {
  recursive: true,
  dereference: false,
  verbatimSymlinks: true,
});
const compositionSurfacesPath = join(compositionPackageRoot, 'metadata', 'surfaces.json');
const compositionSurfaces = JSON.parse(await readFile(compositionSurfacesPath, 'utf8'));
const compositionRow = compositionSurfaces.rows.find(
  (row) => row.surface_id === 'codex-exec-non-ephemeral',
);
assert.equal(compositionRow.release_state, 'candidate');
compositionRow.release_state = 'supported';
compositionRow.disclosure =
  'Composition-only supported override for static plan generation; not release evidence.';
await writeFile(
  compositionSurfacesPath,
  `${JSON.stringify(compositionSurfaces, null, 2)}\n`,
);
const lifecycleUrl = pathToFileURL(
  join(compositionPackageRoot, 'runtime', 'lifecycle', 'lib', 'lifecycle.mjs'),
).href;
const { applyPlan, planSetup } = await import(`${lifecycleUrl}?smoke=${Date.now()}`);
const inventory = JSON.parse(
  await readFile(join(packageRoot, 'metadata', 'roles.json'), 'utf8'),
);

const plan = await planSetup({
  packageRoot: compositionPackageRoot,
  repoRoot: consumerRoot,
  host: 'codex',
  surface: {
    surface_id: 'codex-exec-non-ephemeral',
    provenance: 'user-explicit',
  },
  choices: {
    preset: 'steward',
    config: {},
  },
});
assert.equal(plan.ok, true, plan.summary);
await applyPlan(plan, {
  confirmedActionIds: plan.actions.map((action) => action.id),
});

const expectedNative = [];
const expectedDriving = [];
for (const role of inventory.roles) {
  const packageSkill = role.outputs.codex_skill.replace(/^plugins\/grove\//, '');
  const skill = await readFile(join(packageRoot, packageSkill), 'utf8');
  const reference = await readFile(join(packageRoot, 'reference', role.source), 'utf8');
  const digest = reference.match(/sha256:\s*([0-9a-f]{64})/i)?.[1];
  assert.ok(digest, `missing packaged canonical digest for ${role.id}`);
  assert.match(skill, new RegExp(`canonical-source: ${role.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(skill, new RegExp(digest));
  assert.match(reference, new RegExp(digest));

  for (const exposure of role.exposures) {
    if (exposure.class === 'driving-session') {
      expectedDriving.push(`${role.id}:${exposure.class}`);
      assert.match(skill, /Exposure: `[^`]*driving-session/);
      continue;
    }
    expectedNative.push(exposure.native_id);
    const launcher = await readFile(
      join(consumerRoot, '.codex', 'agents', `${exposure.native_id}.toml`),
      'utf8',
    );
    assert.match(launcher, new RegExp(`name = "${exposure.native_id}"`));
    assert.match(launcher, new RegExp(digest));
    assert.match(launcher, new RegExp(`Grove exposure selector: ${exposure.class}`));
  }
}

const actualNative = (await readdir(join(consumerRoot, '.codex', 'agents')))
  .filter((name) => name.endsWith('.toml'))
  .map((name) => name.slice(0, -'.toml'.length))
  .sort();
assert.deepEqual(actualNative, expectedNative.sort());
assert.deepEqual(expectedDriving.sort(), [
  'dispatcher:driving-session',
  'shaper:driving-session',
]);
assert.equal(actualNative.includes('grove_shaper'), false);

process.stdout.write(
  `package smoke passed: ${actualNative.length} native identities, ` +
  `${expectedDriving.length} driving identities, no charter bodies in the consumer; ` +
  'composition used a disclosed source-side support override while the exact snapshot remained candidate\n',
);
} finally {
  await Promise.all([
    rm(consumerRoot, { recursive: true, force: true }),
    rm(snapshotWorkspace, { recursive: true, force: true }),
  ]);
}
