#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyPlan,
  planSetup,
} from '../../operations/lib/lifecycle.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repositoryRoot = resolve(packageRoot, '..', '..');
const consumerRoot = await mkdtemp(join(tmpdir(), 'grove-package-smoke-'));
try {
const inventory = JSON.parse(await readFile(join(packageRoot, 'roles.json'), 'utf8'));

const plan = await planSetup({
  packageRoot,
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
  const canonical = await readFile(join(repositoryRoot, role.source));
  const digest = createHash('sha256').update(canonical).digest('hex');
  const packageSkill = role.outputs.codex_skill.replace(/^plugins\/grove\//, '');
  const skill = await readFile(join(packageRoot, packageSkill), 'utf8');
  const reference = await readFile(join(packageRoot, 'reference', role.source), 'utf8');
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
  `${expectedDriving.length} driving identities, no charter bodies in the consumer\n`,
);
} finally {
  await rm(consumerRoot, { recursive: true, force: true });
}
