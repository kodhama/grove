// Upstream: spec-0004-dual-host-distribution@v4 INV8, INV9, INV13, INV17,
// INV19, INV30, INV33, INV35, INV36; S5, S6, S13, S17, S26, S31, S33, S34.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  applyPlan,
  planSetup,
} from '../../../../../plugins/grove/runtime/lifecycle/lib/lifecycle.mjs';
import { fixture, claudeInvocation, codexInvocation } from './helpers.mjs';

const exists = async (path) => stat(path).then(() => true, () => false);

test('invalid and unsupported invocation records fail before every write', async () => {
  for (const surface of [
    null,
    { surface_id: 'missing', provenance: 'user-explicit' },
    { surface_id: 'claude-interactive', provenance: 'user-explicit' },
    { surface_id: 'codex-exec-non-ephemeral', provenance: 'host-runtime' },
    { surface_id: 'codex-exec-ephemeral', provenance: 'user-explicit' },
  ]) {
    const { packageRoot, repoRoot } = await fixture();
    const before = await readdir(repoRoot);
    const plan = await planSetup({
      packageRoot,
      repoRoot,
      host: 'codex',
      surface,
      choices: { preset: 'steward', config: {} },
    });
    assert.equal(plan.ok, false);
    assert.match(plan.summary, /valid codex surface ids/i);
    assert.deepEqual(plan.actions, []);
    assert.deepEqual(await readdir(repoRoot), before);
  }
});

test('setup rejects unknown config tokens and wrong list-token shapes before writes', async () => {
  for (const config of [
    { UNKNOWN_TOKEN: 'value' },
    { ARTIFACT_DIRS: 'decisions/' },
    { TEST_CMD: ['npm test'] },
  ]) {
    const { packageRoot, repoRoot } = await fixture();
    const plan = await planSetup({
      packageRoot,
      repoRoot,
      ...claudeInvocation,
      choices: { preset: 'steward', config },
    });
    assert.equal(plan.ok, false);
    assert.match(plan.summary, /config token|list token|scalar token/i);
    assert.deepEqual(plan.actions, []);
    assert.deepEqual(await readdir(repoRoot), []);
  }
});

test('Claude and Codex setup in either order share one floor and are idempotent', async () => {
  for (const invocations of [
    [claudeInvocation, codexInvocation],
    [codexInvocation, claudeInvocation],
  ]) {
    const { packageRoot, repoRoot } = await fixture();
    for (const invocation of invocations) {
      const plan = await planSetup({
        packageRoot,
        repoRoot,
        ...invocation,
        choices: { preset: 'steward', config: { TEST_CMD: 'npm test' } },
      });
      assert.equal(plan.ok, true, plan.summary);
      assert.match(plan.summary, new RegExp(invocation.surface.surface_id));
      assert.match(plan.summary, /user-explicit/);
      await applyPlan(plan, { confirmedActionIds: plan.actions.map((a) => a.id) });
    }

    const snapshot = {
      gates: await readFile(join(repoRoot, '.grove', 'gates.toml'), 'utf8'),
      config: await readFile(join(repoRoot, '.grove', 'config.toml'), 'utf8'),
      claude: await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8'),
      codex: await readFile(join(repoRoot, 'AGENTS.md'), 'utf8'),
      launcher: await readFile(join(repoRoot, '.codex', 'agents', 'grove_executor.toml'), 'utf8'),
    };
    assert.match(snapshot.claude, /\$\{CLAUDE_PLUGIN_ROOT\}\/reference\/charters\/dispatcher\.md/);
    assert.match(snapshot.claude, /\$\{CLAUDE_PLUGIN_ROOT\}\/reference\/charters\/shaper\.md/);
    assert.match(snapshot.codex, /grove:role-dispatcher/);
    assert.match(snapshot.codex, /grove:role-shaper/);
    assert.doesNotMatch(JSON.stringify(snapshot), /grove-status|status emission/i);
    assert.equal((snapshot.claude.match(/grove:begin/g) ?? []).length, 1);
    assert.equal((snapshot.codex.match(/grove:begin/g) ?? []).length, 1);

    for (const invocation of invocations) {
      const rerun = await planSetup({
        packageRoot,
        repoRoot,
        ...invocation,
        choices: { preset: 'guardian', config: { TEST_CMD: 'wrong' } },
      });
      assert.equal(rerun.ok, true);
      await applyPlan(rerun, { confirmedActionIds: rerun.actions.map((a) => a.id) });
    }
    assert.equal(await readFile(join(repoRoot, '.grove', 'gates.toml'), 'utf8'), snapshot.gates);
    assert.equal(await readFile(join(repoRoot, '.grove', 'config.toml'), 'utf8'), snapshot.config);
    assert.equal(await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8'), snapshot.claude);
    assert.equal(await readFile(join(repoRoot, 'AGENTS.md'), 'utf8'), snapshot.codex);
    assert.equal(await readFile(join(repoRoot, '.codex', 'agents', 'grove_executor.toml'), 'utf8'), snapshot.launcher);
  }
});

test('setup preserves unrelated instruction text, the other host, and launcher collisions', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await mkdir(join(repoRoot, '.codex', 'agents'), { recursive: true });
  await writeFile(join(repoRoot, 'AGENTS.md'), '# Consumer rules\n');
  await writeFile(join(repoRoot, 'CLAUDE.md'), '# Claude consumer rules\n');
  await writeFile(join(repoRoot, '.codex', 'agents', 'grove_executor.toml'), '# consumer-owned\n');

  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    choices: { preset: 'steward', config: {} },
  });
  assert.equal(plan.ok, true);
  assert.ok(plan.refusals.some((item) => item.path.endsWith('grove_executor.toml')));
  await applyPlan(plan, { confirmedActionIds: plan.actions.map((a) => a.id) });

  assert.equal(await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8'), '# Claude consumer rules\n');
  assert.match(await readFile(join(repoRoot, 'AGENTS.md'), 'utf8'), /^# Consumer rules\n/);
  assert.equal(
    await readFile(join(repoRoot, '.codex', 'agents', 'grove_executor.toml'), 'utf8'),
    '# consumer-owned\n',
  );
  assert.equal(await exists(join(repoRoot, '.codex', 'agents', 'grove_dispatcher_advisor.toml')), true);
});

test('apply revalidates the whole plan before writes and refuses a post-plan launcher collision', async () => {
  const { packageRoot, repoRoot } = await fixture();
  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    choices: { preset: 'steward', config: {} },
  });
  await mkdir(join(repoRoot, '.codex', 'agents'), { recursive: true });
  const collision = join(repoRoot, '.codex', 'agents', 'grove_executor.toml');
  await writeFile(collision, '# consumer arrived after planning\n');

  await assert.rejects(
    () => applyPlan(plan, { confirmedActionIds: plan.actions.map((action) => action.id) }),
    /changed after planning/i,
  );
  assert.equal(await readFile(collision, 'utf8'), '# consumer arrived after planning\n');
  assert.equal(await exists(join(repoRoot, '.grove', 'README.md')), false);
  assert.equal(await exists(join(repoRoot, 'AGENTS.md')), false);
});

test('apply refuses a symlinked managed parent before any write can escape the repository', async () => {
  const { root, packageRoot, repoRoot } = await fixture();
  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    choices: { preset: 'steward', config: {} },
  });
  const outside = join(root, 'outside');
  await mkdir(join(repoRoot, '.codex'), { recursive: true });
  await mkdir(outside);
  await symlink(outside, join(repoRoot, '.codex', 'agents'));

  await assert.rejects(
    () => applyPlan(plan, { confirmedActionIds: plan.actions.map((action) => action.id) }),
    /symbolic link/i,
  );
  assert.equal(await exists(join(outside, 'grove_executor.toml')), false);
  assert.equal(await exists(join(repoRoot, '.grove', 'README.md')), false);
});
