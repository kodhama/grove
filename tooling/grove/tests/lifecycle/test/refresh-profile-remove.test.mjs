// Upstream: spec-0004-dual-host-distribution@v6 INV9, INV10, INV16, INV18,
// INV22, INV31, INV34–INV36; S7–S9, S16, S20, S27–S29, S32–S34.
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
} from '../../../../../plugins/grove/runtime/lifecycle/lib/lifecycle.mjs';
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
  await mkdir(join(repoRoot, '.grove', 'internal', 'gates'), { recursive: true });
  await writeFile(join(repoRoot, '.grove', 'internal', 'gates', 'retired.mjs'), 'stale managed file\n');

  const plan = await planRefresh({ packageRoot, repoRoot, ...codexInvocation });
  assert.equal(plan.ok, true, plan.summary);
  assert.match(plan.summary, /0\.3\.0.*0\.4\.0.*ahead/is);
  assert.ok(plan.legacy.some((item) => item.path.includes('grove-status')));
  assert.ok(plan.legacy.some((item) => item.path.endsWith('retired.mjs') && !item.owned));
  await applyAll(plan);

  assert.equal(await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8'), claudeBefore);
  assert.equal(await readFile(join(repoRoot, '.grove', 'config.toml'), 'utf8'), 'TEST_CMD = "consumer"\n');
  assert.match(await readFile(join(repoRoot, '.grove', 'gates.toml'), 'utf8'), /seeded_from = "custom"/);
  assert.equal(await readFile(join(repoRoot, '.grove', 'agents', 'executor.md'), 'utf8'), 'consumer addendum\n');
  assert.equal(await exists(join(repoRoot, '.claude', 'skills', 'grove-status', 'SKILL.md')), true);
  assert.match(await readFile(join(repoRoot, 'AGENTS.md'), 'utf8'), /grove plugin@0\.4\.0/);
  assert.equal(
    await readFile(join(repoRoot, '.grove', 'internal', 'gates', 'retired.mjs'), 'utf8'),
    'stale managed file\n',
  );
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

test('valid unsupported surfaces disclose role unavailability and permit only cleanup plans', async () => {
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
  assert.equal(profile.ok, false);
  assert.deepEqual(profile.actions, []);
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

// `choices.overwritePaths` is a published input on `describe setup` and had no
// test at all. That is how setup's approved-overwrite path came to reseed from
// the shipped template rather than the consumer's own file, silently discarding
// every consumer-owned row on a write the user had explicitly approved.
test('an approved gates.toml overwrite applies the preset and keeps consumer rows', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);

  const gates = join(repoRoot, '.grove', 'gates.toml');
  const before = await readFile(gates, 'utf8');
  assert.match(before, /^spec = "agent"/mu, 'fixture assumption: seeded steward');
  await writeFile(gates, `${before}\nruntime_dir = "vendor/grove-gates/"\n`);

  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    choices: {
      preset: 'guardian',
      config: {},
      overwritePaths: ['.grove/gates.toml'],
    },
  });
  assert.equal(plan.ok, true, plan.summary);

  const write = plan.actions.find((a) => a.path === '.grove/gates.toml');
  assert.ok(write, 'an approved overwrite must plan the write');
  assert.equal(write.confirmationRequired, true, 'a destructive write must stay confirmation-bound');

  // The preset is applied…
  assert.match(write.content, /^spec = "human"/mu, 'guardian preset was not applied');
  // …and the consumer's own row survives it.
  assert.match(
    write.content,
    /^runtime_dir = "vendor\/grove-gates\/"/mu,
    'the approved overwrite discarded a consumer-owned row',
  );
});

test('setup without an approved overwrite says the preset was not applied', async () => {
  // The skip reason named the ownership rule and never answered the request the
  // user actually made, which is what made the two skills look interchangeable.
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);

  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    choices: { preset: 'guardian', config: {} },
  });
  const skipped = plan.skipped.find((s) => s.path === '.grove/gates.toml');
  assert.ok(skipped, 'setup must report the skip, not perform it silently');
  assert.match(skipped.reason, /preset was NOT applied/u, 'the reason must name the dropped request');
  assert.match(skipped.reason, /set-profile/u, 'the reason must point at the command that does apply it');
});

test('the skip reason names each host its own set-profile command', async () => {
  // The first version of that reason hardcoded `/grove:set-profile`, which is
  // the Claude invocation. Codex users were told to run a command that does not
  // exist on their host — the Claude-only-literal failure spec-0004 forbids for
  // set-profile, reproduced in setup's skip path where that clause does not
  // literally reach.
  const expected = { claude: '/grove:set-profile', codex: 'grove set-profile' };
  for (const invocation of [claudeInvocation, codexInvocation]) {
    const { packageRoot, repoRoot } = await fixture();
    await setupBoth(packageRoot, repoRoot);
    const plan = await planSetup({
      packageRoot,
      repoRoot,
      ...invocation,
      choices: { preset: 'guardian', config: {} },
    });
    const skipped = plan.skipped.find((s) => s.path === '.grove/gates.toml');
    assert.ok(skipped, `${invocation.host}: setup must report the skip`);
    assert.ok(
      skipped.reason.includes(`run ${expected[invocation.host]} <preset>`),
      `${invocation.host}: expected the host's own command, got: ${skipped.reason}`,
    );
    if (invocation.host === 'codex') {
      assert.ok(
        !skipped.reason.includes('/grove:set-profile'),
        'codex was handed the Claude slash-command form',
      );
    }
  }
});

// --- adr-0048 D1/D3: the gate profile is read by the dependency ---

test('adr-0048 — set-profile READS a gates.toml the old line reader called an invalid gate row', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  const path = join(repoRoot, '.grove', 'gates.toml');
  // Literal-quoted values and an escape-spelled value are legal TOML, and none
  // of them matched the old /^([A-Za-z0-9_]+)\s*=\s*"([^"]*)"$/ row regex,
  // which reported each as "invalid gate row" and refused the switch.
  await writeFile(path, [
    '# consumer-authoritative',
    'seeded_from = "steward"',
    '',
    '[gates]',
    "intent = 'human'",
    'spec = "agent"',
    "build = 'agent'",
    'ship = "hum\\u0061n"',
    '',
  ].join('\n'));

  const plan = await planSetProfile({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    preset: 'guardian',
  });
  assert.equal(plan.ok, true, plan.summary);
  // Read correctly means the DELTA is computed against the real prior values:
  // guardian differs from this profile only in `spec`.
  assert.deepEqual(
    plan.changes,
    [{ gate: 'spec', from: 'agent', to: 'human' }],
    'the prior profile was read, not guessed',
  );
});

test('adr-0048 — a quoted gate KEY reads fine and still fails at seedPreset: the writer is a NAMED remaining gap', async () => {
  // NOT a passing grade dressed as one. adr-0048 D3 requires every hand-rolled
  // reader AND writer of an external format be replaced. `seedPreset` is a
  // hand-rolled TOML WRITER that D3's audit table does not name, and it is
  // still here: it rewrites the four gate rows by line regex, so a quoted key
  // is invisible to it and its own precondition ("seeded_from and exactly four
  // gate rows") fails.
  //
  // It is kept DELIBERATELY and the tradeoff is different from the cursor's:
  // .grove/gates.toml is consumer-authoritative and carries comments the
  // consumer reads, and a re-serializing writer would silently delete every
  // one of them on each set-profile. The cursor has no comments to lose.
  // Recorded here as a test rather than as prose so the gap cannot be
  // mistaken for closed.
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  const path = join(repoRoot, '.grove', 'gates.toml');
  await writeFile(path, [
    'seeded_from = "steward"',
    '',
    '[gates]',
    '"intent" = "human"',
    'spec = "agent"',
    'build = "agent"',
    'ship = "human"',
    '',
  ].join('\n'));

  const plan = await planSetProfile({
    packageRoot, repoRoot, ...codexInvocation, preset: 'guardian',
  });
  assert.equal(plan.ok, false);
  // The refusal comes from the WRITER, not the reader — that is the whole
  // point of the assertion.
  assert.match(plan.summary, /cannot apply preset/, plan.summary);
  assert.doesNotMatch(plan.summary, /unreadable gates\.toml/, 'the reader was fine');
  assert.deepEqual(plan.actions, []);
});

test('adr-0048 — an unparseable gates.toml is a reported REFUSAL, never a throw out of the planner', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await setupBoth(packageRoot, repoRoot);
  const path = join(repoRoot, '.grove', 'gates.toml');
  // A library reader can throw where the old line reader silently skipped:
  // it ignored any line it did not recognize, so junk simply vanished. Both
  // parseProfile call sites are wrapped, so this reports rather than escapes.
  await writeFile(path, 'seeded_from = "steward"\n[gates\nintent = "human"\n');
  const plan = await planSetProfile({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    preset: 'guardian',
  });
  assert.equal(plan.ok, false);
  assert.match(plan.summary, /unreadable gates\.toml|does not parse/i, plan.summary);
  assert.deepEqual(plan.actions, []);
});
