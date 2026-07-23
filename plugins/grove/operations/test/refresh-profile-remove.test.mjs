// Upstream: spec-0004@v3 INV9, INV10, INV16, INV18, INV22; S7, S8, S9, S16, S20.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  applyPlan,
  planRefresh,
  planRemove,
  planSetProfile,
  planSetup,
} from '../lib/lifecycle.mjs';
import { fixture, claudeInvocation, codexInvocation, gatesTemplate } from './helpers.mjs';

const exists = async (path) => stat(path).then(() => true, () => false);
const applyAll = (plan) => applyPlan(plan, { confirmedActionIds: plan.actions.map((a) => a.id) });

async function setupBoth(packageRoot, repoRoot) {
  for (const invocation of [claudeInvocation, codexInvocation]) {
    const plan = await planSetup({
      packageRoot,
      repoRoot,
      ...invocation,
      choices: { preset: 'steward', config: { TEST_CMD: 'npm test' } },
    });
    await applyAll(plan);
  }
}

test('refresh preserves consumer-owned and other-host state while disclosing skew and legacy status', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  const claudeBefore = await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8');
  await writeFile(join(repoRoot, '.grove', 'config.toml'), 'TEST_CMD = "consumer"\n');
  await writeFile(join(repoRoot, '.grove', 'gates.toml'), gatesTemplate().replace('seeded_from = "steward"', 'seeded_from = "custom"'));
  await mkdir(join(repoRoot, '.grove', 'agents'), { recursive: true });
  await writeFile(join(repoRoot, '.grove', 'agents', 'executor.md'), 'consumer addendum\n');
  await mkdir(join(repoRoot, '.claude', 'skills', 'grove-status'), { recursive: true });
  await writeFile(join(repoRoot, '.claude', 'skills', 'grove-status', 'SKILL.md'), '---\nname: grove-status\n---\nlegacy\n');
  await writeFile(join(packageRoot, 'VERSION'), '0.4.0\n');
  await writeFile(join(repoRoot, '.grove', 'internal', 'gates', 'retired.mjs'), 'stale managed file\n');

  const plan = await planRefresh({ packageRoot, repoRoot, ...codexInvocation });
  assert.equal(plan.ok, true, plan.summary);
  assert.match(plan.summary, /0\.3\.0.*0\.4\.0.*ahead/is);
  assert.ok(plan.legacy.some((item) => item.path.includes('grove-status')));
  await applyAll(plan);

  assert.equal(await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8'), claudeBefore);
  assert.equal(await readFile(join(repoRoot, '.grove', 'config.toml'), 'utf8'), 'TEST_CMD = "consumer"\n');
  assert.match(await readFile(join(repoRoot, '.grove', 'gates.toml'), 'utf8'), /seeded_from = "custom"/);
  assert.equal(await readFile(join(repoRoot, '.grove', 'agents', 'executor.md'), 'utf8'), 'consumer addendum\n');
  assert.equal(await exists(join(repoRoot, '.claude', 'skills', 'grove-status', 'SKILL.md')), true);
  assert.match(await readFile(join(repoRoot, 'AGENTS.md'), 'utf8'), /grove plugin@0\.4\.0/);
  assert.equal(await exists(join(repoRoot, '.grove', 'internal', 'gates', 'retired.mjs')), false);
});

test('set-profile plans exact row changes, requires confirmation, and writes only gates.toml', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  const claudeBefore = await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8');
  const codexBefore = await readFile(join(repoRoot, 'AGENTS.md'), 'utf8');
  const configBefore = await readFile(join(repoRoot, '.grove', 'config.toml'), 'utf8');

  const plan = await planSetProfile({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    preset: 'guardian',
  });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.changes, [
    { gate: 'spec', from: 'agent', to: 'human' },
  ]);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].path, '.grove/gates.toml');

  await assert.rejects(() => applyPlan(plan, { confirmedActionIds: [] }), /confirmation/i);
  assert.match(await readFile(join(repoRoot, '.grove', 'gates.toml'), 'utf8'), /seeded_from = "steward"/);
  await applyAll(plan);
  const profile = await readFile(join(repoRoot, '.grove', 'gates.toml'), 'utf8');
  assert.match(profile, /seeded_from = "guardian"/);
  assert.match(profile, /spec = "human"/);
  assert.match(profile, /runtime_dir = "\.custom\/gates\/"/);
  assert.match(profile, /sources = \["human-ask", "cron"\]/);
  assert.match(profile, /\[intent_external\]\nenabled = false/);
  assert.equal(await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8'), claudeBefore);
  assert.equal(await readFile(join(repoRoot, 'AGENTS.md'), 'utf8'), codexBefore);
  assert.equal(await readFile(join(repoRoot, '.grove', 'config.toml'), 'utf8'), configBefore);
});

test('set-profile fails closed on an unknown gate row instead of preserving an invalid profile', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  const path = join(repoRoot, '.grove', 'gates.toml');
  await writeFile(path, (await readFile(path, 'utf8')).replace('ship = "human"', 'ship = "human"\nreview = "human"'));

  const plan = await planSetProfile({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    preset: 'guardian',
  });
  assert.equal(plan.ok, false);
  assert.match(plan.summary, /unknown gate row/i);
  assert.deepEqual(plan.actions, []);
});

test('remove inventories both adapters and preserves a retained host and the shared floor', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  await mkdir(join(repoRoot, '.claude', 'skills', 'grove-status'), { recursive: true });
  await writeFile(join(repoRoot, '.claude', 'skills', 'grove-status', 'SKILL.md'), '---\nname: grove-status\n---\nlegacy\n');

  const partial = await planRemove({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    selection: { hosts: ['claude'], sharedFloor: true, legacyStatus: false, consumerPaths: [] },
  });
  assert.equal(partial.ok, true);
  assert.ok(partial.refusals.some((item) => /shared floor/i.test(item.reason)));
  await applyAll(partial);
  assert.equal(await exists(join(repoRoot, '.grove', 'README.md')), true);
  assert.equal(await exists(join(repoRoot, 'AGENTS.md')), true);
  assert.equal(await exists(join(repoRoot, '.codex', 'agents', 'grove_executor.toml')), true);
  assert.equal(await exists(join(repoRoot, 'CLAUDE.md')), false);
  assert.equal(await exists(join(repoRoot, '.claude', 'skills', 'grove-status', 'SKILL.md')), true);
});

test('full removal deletes only confirmed owned surfaces and preserves consumer content', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  await writeFile(join(repoRoot, 'CLAUDE.md'), '# keep\n' + await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8'));
  await mkdir(join(repoRoot, '.codex', 'agents'), { recursive: true });
  await writeFile(join(repoRoot, '.codex', 'agents', 'consumer.toml'), 'name = "consumer"\n');
  await mkdir(join(repoRoot, '.claude', 'skills', 'grove-status'), { recursive: true });
  await writeFile(join(repoRoot, '.claude', 'skills', 'grove-status', 'SKILL.md'), '---\nname: grove-status\n---\nlegacy\n');

  const plan = await planRemove({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    selection: {
      hosts: ['claude', 'codex'],
      sharedFloor: true,
      legacyStatus: true,
      consumerPaths: [],
    },
  });
  await applyAll(plan);

  assert.equal(await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8'), '# keep\n');
  assert.equal(await exists(join(repoRoot, 'AGENTS.md')), false);
  assert.equal(await exists(join(repoRoot, '.codex', 'agents', 'consumer.toml')), true);
  assert.equal(await exists(join(repoRoot, '.codex', 'agents', 'grove_executor.toml')), false);
  assert.equal(await exists(join(repoRoot, '.grove', 'README.md')), false);
  assert.equal(await exists(join(repoRoot, '.grove', 'config.toml')), true);
  assert.equal(await exists(join(repoRoot, '.grove', 'gates.toml')), true);
  assert.equal(await exists(join(repoRoot, '.claude', 'skills', 'grove-status', 'SKILL.md')), false);
});

test('remove refuses traversal-shaped consumer paths outside the declared Grove floor', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  await writeFile(join(repoRoot, 'README.md'), '# consumer\n');

  const plan = await planRemove({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    selection: {
      hosts: [],
      sharedFloor: false,
      legacyStatus: false,
      consumerPaths: ['.grove/agents/../../README.md'],
    },
  });
  assert.ok(
    plan.refusals.some((item) => /not a declared consumer-authoritative/i.test(item.reason)),
    JSON.stringify(plan.refusals),
  );
  assert.equal(plan.actions.some((item) => item.path.includes('README.md')), false);
  await applyAll(plan);
  assert.equal(await readFile(join(repoRoot, 'README.md'), 'utf8'), '# consumer\n');
});

test('remove planning refuses symlinked consumer paths without reading outside content', async () => {
  const { root, packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  const outside = join(root, 'outside-secret.txt');
  await writeFile(outside, 'OUTSIDE_SECRET\n');
  await mkdir(join(repoRoot, '.grove', 'agents'), { recursive: true });
  await symlink(outside, join(repoRoot, '.grove', 'agents', 'external'));

  await assert.rejects(
    planRemove({
      packageRoot,
      repoRoot,
      ...codexInvocation,
      selection: {
        hosts: [],
        sharedFloor: false,
        legacyStatus: false,
        consumerPaths: ['.grove/agents/external'],
      },
    }),
    (error) => {
      assert.match(error.message, /symbolic link/i);
      assert.doesNotMatch(error.message, /OUTSIDE_SECRET/);
      return true;
    },
  );
});

test('legacy status cleanup deletes only the owned adapter file, never sibling consumer files', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  const legacyRoot = join(repoRoot, '.claude', 'skills', 'grove-status');
  await mkdir(legacyRoot, { recursive: true });
  await writeFile(join(legacyRoot, 'SKILL.md'), '---\nname: grove-status\n---\nlegacy\n');
  await writeFile(join(legacyRoot, 'consumer-notes.md'), '# keep\n');

  const plan = await planRemove({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    selection: {
      hosts: [],
      sharedFloor: false,
      legacyStatus: true,
      consumerPaths: [],
    },
  });
  await applyAll(plan);
  assert.equal(await exists(join(legacyRoot, 'SKILL.md')), false);
  assert.equal(await readFile(join(legacyRoot, 'consumer-notes.md'), 'utf8'), '# keep\n');
});

test('refresh and remove clean stale Grove-owned launchers but preserve consumer launchers', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  await writeFile(
    join(repoRoot, '.codex', 'agents', 'grove_retired.toml'),
    '# GENERATED — DO NOT EDIT; canonical-source: charters/retired.md; sha256: old\nname = "grove_retired"\n',
  );
  await writeFile(join(repoRoot, '.codex', 'agents', 'consumer.toml'), 'name = "consumer"\n');

  const refresh = await planRefresh({ packageRoot, repoRoot, ...codexInvocation });
  await applyAll(refresh);
  assert.equal(await exists(join(repoRoot, '.codex', 'agents', 'grove_retired.toml')), false);
  assert.equal(await exists(join(repoRoot, '.codex', 'agents', 'consumer.toml')), true);

  await writeFile(
    join(repoRoot, '.codex', 'agents', 'grove_retired_again.toml'),
    '# GENERATED — DO NOT EDIT; canonical-source: charters/retired.md; sha256: old\nname = "grove_retired_again"\n',
  );
  const remove = await planRemove({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    selection: { hosts: ['codex'], sharedFloor: false, legacyStatus: false, consumerPaths: [] },
  });
  await applyAll(remove);
  assert.equal(await exists(join(repoRoot, '.codex', 'agents', 'grove_retired_again.toml')), false);
  assert.equal(await exists(join(repoRoot, '.codex', 'agents', 'consumer.toml')), true);
});

test('valid unsupported surfaces disclose role unavailability but still permit profile and cleanup plans', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  const unsupported = {
    host: 'codex',
    surface: { surface_id: 'codex-exec-ephemeral', provenance: 'user-explicit' },
  };

  const profile = await planSetProfile({
    packageRoot,
    repoRoot,
    ...unsupported,
    preset: 'guardian',
  });
  assert.equal(profile.ok, true);
  assert.match(profile.summary, /roles are unavailable|unsupported/i);

  const remove = await planRemove({
    packageRoot,
    repoRoot,
    ...unsupported,
    selection: { hosts: ['codex'], sharedFloor: false, legacyStatus: false, consumerPaths: [] },
  });
  assert.equal(remove.ok, true);
  assert.match(remove.summary, /roles are unavailable|unsupported/i);

  const refresh = await planRefresh({ packageRoot, repoRoot, ...unsupported });
  assert.equal(refresh.ok, false);
  assert.deepEqual(refresh.actions, []);
});
