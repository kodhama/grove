// Upstream: spec-0004-dual-host-distribution@v4 INV28–INV31, INV33–INV36; S24–S29, S31–S34.
// Decisions: adr-0031-multi-host-distribution; adr-0035-plugin-and-consumer-boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import {
  applyPlan,
  planRefresh,
  planRemove,
  planSetProfile,
  planSetup,
  resolveGateRuntime,
} from '../../../../../plugins/grove/runtime/lifecycle/lib/lifecycle.mjs';
import {
  claudeInvocation,
  codexInvocation,
  fixture,
  gatesTemplate,
} from './helpers.mjs';

const applyAll = (plan) =>
  applyPlan(plan, { confirmedActionIds: plan.actions.map((action) => action.id) });
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('INV28/S24 — absent runtime_dir resolves the active installed package at a deep path with spaces', async () => {
  const { root, repoRoot } = await fixture();
  const packageRoot = join(
    root,
    'level one',
    'level two',
    'level three',
    'level four',
    'level five',
    'level six',
    'level seven',
    'level eight',
    'grove package',
  );
  const executable = join(packageRoot, 'runtime', 'gates', 'bin', 'resolve-profile.mjs');
  await mkdir(join(packageRoot, 'runtime', 'gates', 'bin'), { recursive: true });
  await writeFile(executable, '#!/usr/bin/env node\n');

  const resolved = await resolveGateRuntime({
    packageRoot,
    repoRoot,
    gatesText: '[gates]\nintent = "human"\n',
  });

  assert.equal(resolved.runtimeRoot, join(packageRoot, 'runtime', 'gates'));
  assert.equal(resolved.executable, executable);
  assert.equal(resolved.source, 'installed-package-default');
  assert.equal(resolved.legacy, false);
});

test('INV29/S25 — explicit non-legacy runtime_dir is exact authority', async () => {
  const { packageRoot, repoRoot } = await fixture();
  const runtimeRoot = join(repoRoot, 'vendor runtimes', 'grove gates');
  const executable = join(runtimeRoot, 'bin', 'resolve-profile.mjs');
  await mkdir(join(runtimeRoot, 'bin'), { recursive: true });
  await writeFile(executable, '#!/usr/bin/env node\n');

  const resolved = await resolveGateRuntime({
    packageRoot,
    repoRoot,
    gatesText: 'runtime_dir = "vendor runtimes/grove gates"\n[gates]\nintent = "human"\n',
  });

  assert.equal(resolved.runtimeRoot, runtimeRoot);
  assert.equal(resolved.executable, executable);
  assert.equal(resolved.source, 'declared-runtime-dir');
  assert.equal(resolved.legacy, false);
});

test('INV29/S25 — missing or invalid explicit runtime fails loudly without package fallback', async (t) => {
  for (const invalid of ['missing', 'directory']) {
    await t.test(invalid, async () => {
      const { packageRoot, repoRoot } = await fixture();
      const runtimeRoot = join(repoRoot, 'explicit gates');
      if (invalid === 'directory') {
        await mkdir(join(runtimeRoot, 'bin', 'resolve-profile.mjs'), { recursive: true });
      }

      await assert.rejects(
        resolveGateRuntime({
          packageRoot,
          repoRoot,
          gatesText: 'runtime_dir = "explicit gates"\n[gates]\nintent = "human"\n',
        }),
        /declared-runtime-dir gate runtime (?:is unavailable|is not a regular executable file)/,
      );
    });
  }
});

test('INV30/S26 — setup creates only the thin consumer floor and the invoking host loader', async (t) => {
  for (const invocation of [claudeInvocation, codexInvocation]) {
    await t.test(invocation.host, async () => {
      const { packageRoot, repoRoot } = await fixture();
      const plan = await planSetup({
        packageRoot,
        repoRoot,
        ...invocation,
        choices: { preset: 'steward', config: {} },
      });
      assert.equal(plan.ok, true, plan.summary);
      await applyAll(plan);

      assert.deepEqual(
        (await readdir(join(repoRoot, '.grove'))).sort(),
        ['README.md', 'config.toml', 'gates.toml'],
      );
      assert.equal(
        await readFile(join(repoRoot, invocation.host === 'claude' ? 'AGENTS.md' : 'CLAUDE.md'), 'utf8')
          .then(() => true, (error) => error.code !== 'ENOENT'),
        false,
        'setup does not create the other host carrier',
      );

      const carrier = await readFile(
        join(repoRoot, invocation.host === 'claude' ? 'CLAUDE.md' : 'AGENTS.md'),
        'utf8',
      );
      if (invocation.host === 'claude') {
        assert.match(carrier, /\$\{CLAUDE_PLUGIN_ROOT\}\/reference\/charters\/dispatcher\.md/);
        assert.match(carrier, /\$\{CLAUDE_PLUGIN_ROOT\}\/reference\/charters\/shaper\.md/);
      } else {
        assert.match(carrier, /grove:role-dispatcher/);
        assert.match(carrier, /grove:role-shaper/);
        assert.match(carrier, /current task/i);
        assert.match(carrier, /do not (?:delegate|spawn)/i);
      }
    });
  }
});

test('INV31/INV34/S27/S32 — absent legacy inventory proves nothing and plans no internal mutation', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await mkdir(join(repoRoot, '.grove', 'internal', 'gates', 'lib'), { recursive: true });
  await writeFile(
    join(repoRoot, '.grove', 'internal', 'gates', 'lib', 'profile.mjs'),
    'consumer-modified legacy bytes\n',
  );
  await writeFile(
    join(repoRoot, '.grove', 'internal', 'enforcement.toml'),
    'consumer-modified legacy enforcement\n',
  );

  const plan = await planRefresh({ packageRoot, repoRoot, ...claudeInvocation });
  assert.equal(plan.ok, true, plan.summary);
  assert.equal(
    plan.actions.some((action) => action.path.startsWith('.grove/internal/')),
    false,
    JSON.stringify(plan.actions, null, 2),
  );
});

test('INV31/INV34/S29/S32 — unexpected legacy symlinks are reported without following or deleting them', async () => {
  const { root, packageRoot, repoRoot } = await fixture();
  const legacyRoot = join(repoRoot, '.grove', 'internal', 'gates');
  const outside = join(root, 'outside-legacy-target');
  await mkdir(legacyRoot, { recursive: true });
  await writeFile(outside, 'outside bytes\n');
  await symlink(outside, join(legacyRoot, 'unexpected-link'));

  const plan = await planRefresh({ packageRoot, repoRoot, ...codexInvocation });
  assert.equal(plan.ok, true, plan.summary);
  assert.ok(
    plan.legacy.some((item) =>
      item.path === '.grove/internal/gates/unexpected-link' && item.owned === false),
    JSON.stringify(plan.legacy, null, 2),
  );
  assert.equal(
    plan.actions.some((action) =>
      action.type === 'delete-tree' && action.path.startsWith('.grove/internal')),
    false,
  );
});

test('INV35/S33 — every malformed candidate carrier blocks setup, refresh, and set-profile before writes', async (t) => {
  const malformedBodies = {
    'missing stamp': 'loader\n',
    'duplicate stamp': 'grove plugin@0.2.0\ngrove plugin@0.2.0\n',
    'invalid stamp': 'grove plugin@v0.2.0\n',
  };
  const planners = {
    setup: ({ packageRoot, repoRoot }) => planSetup({
      packageRoot,
      repoRoot,
      ...codexInvocation,
      choices: { preset: 'steward', config: {} },
    }),
    refresh: ({ packageRoot, repoRoot }) => planRefresh({
      packageRoot,
      repoRoot,
      ...codexInvocation,
    }),
    'set-profile': ({ packageRoot, repoRoot }) => planSetProfile({
      packageRoot,
      repoRoot,
      ...codexInvocation,
      preset: 'guardian',
    }),
  };

  for (const [malformation, body] of Object.entries(malformedBodies)) {
    for (const [operation, planOperation] of Object.entries(planners)) {
      await t.test(`${operation}: ${malformation}`, async () => {
        const { packageRoot, repoRoot } = await fixture();
        await mkdir(join(repoRoot, '.grove'), { recursive: true });
        await writeFile(join(repoRoot, '.grove', 'gates.toml'), gatesTemplate());
        await writeFile(
          join(repoRoot, 'CLAUDE.md'),
          '<!-- grove:begin (managed by grove — dials live in .grove/, not this block) -->\n' +
            body +
            '<!-- grove:end -->\n',
        );

        const plan = await planOperation({ packageRoot, repoRoot });
        assert.equal(plan.ok, false, plan.summary);
        assert.deepEqual(plan.actions, []);
        assert.match(plan.summary, /stamp|carrier|managed block/i);
      });
    }
  }
});

test('INV36/S34 — valid-unsupported surfaces permit only confirmed Remove deletion planning', async (t) => {
  const operations = {
    setup: ({ packageRoot, repoRoot, invocation }) => planSetup({
      packageRoot,
      repoRoot,
      ...invocation,
      choices: { preset: 'steward', config: {} },
    }),
    refresh: ({ packageRoot, repoRoot, invocation }) => planRefresh({
      packageRoot,
      repoRoot,
      ...invocation,
    }),
    'set-profile': ({ packageRoot, repoRoot, invocation }) => planSetProfile({
      packageRoot,
      repoRoot,
      ...invocation,
      preset: 'guardian',
    }),
    remove: ({ packageRoot, repoRoot, invocation }) => planRemove({
      packageRoot,
      repoRoot,
      ...invocation,
      selection: { hosts: [], sharedFloor: false, legacyStatus: false, consumerPaths: [] },
    }),
  };

  for (const host of ['claude', 'codex']) {
    for (const [operation, planOperation] of Object.entries(operations)) {
      await t.test(`${host}/${operation}`, async () => {
        const { packageRoot, repoRoot } = await fixture();
        const matrixPath = join(packageRoot, 'metadata', 'surfaces.json');
        const matrix = JSON.parse(await readFile(matrixPath, 'utf8'));
        if (host === 'claude') {
          matrix.rows.push({
            surface_id: 'claude-unsupported-fixture',
            host: 'claude',
            bridge_state: 'host-native',
            release_state: 'unsupported',
            missing_capability: 'fixture missing capability',
            disclosure: 'fixture unsupported surface',
          });
        }
        await writeFile(matrixPath, JSON.stringify(matrix, null, 2) + '\n');
        await mkdir(join(repoRoot, '.grove'), { recursive: true });
        await writeFile(join(repoRoot, '.grove', 'gates.toml'), gatesTemplate());
        const invocation = {
          host,
          surface: {
            surface_id: host === 'claude'
              ? 'claude-unsupported-fixture'
              : 'codex-exec-ephemeral',
            provenance: 'user-explicit',
          },
        };

        const plan = await planOperation({ packageRoot, repoRoot, invocation });
        if (operation === 'remove') {
          assert.equal(plan.ok, true, `${host}/${operation}: ${plan.summary}`);
          assert.ok(plan.actions.every((action) => action.type.startsWith('delete')));
        } else {
          assert.equal(plan.ok, false, `${host}/${operation}: ${plan.summary}`);
          assert.deepEqual(plan.actions, []);
        }
      });
    }
  }
});

test('INV31/INV34/S27–S28 — legacy migration separates config, restart, and exact deletion confirmations', async () => {
  const { packageRoot, repoRoot } = await fixture();
  const legacyProfile = 'legacy profile bytes\n';
  const legacyEnforcement = 'legacy enforcement bytes\n';
  await writeFile(
    join(packageRoot, 'metadata', 'legacy-ownership.json'),
    JSON.stringify({
      schema_version: 1,
      records: [
        {
          grove_version: '0.3.0',
          candidate_path: '.grove/internal/enforcement.toml',
          candidate_kind: 'regular-file',
          sha256: sha256(legacyEnforcement),
        },
        {
          grove_version: '0.3.0',
          candidate_path: '.grove/internal/gates',
          candidate_kind: 'tree',
          leaves: [{
            relative_path: 'lib/profile.mjs',
            kind: 'regular-file',
            sha256: sha256(legacyProfile),
          }],
        },
      ],
    }, null, 2) + '\n',
  );
  await mkdir(join(repoRoot, '.grove', 'internal', 'gates', 'lib'), { recursive: true });
  await writeFile(join(repoRoot, '.grove', 'internal', 'gates', 'lib', 'profile.mjs'), legacyProfile);
  await writeFile(join(repoRoot, '.grove', 'internal', 'enforcement.toml'), legacyEnforcement);
  await writeFile(
    join(repoRoot, '.grove', 'gates.toml'),
    gatesTemplate().replace(
      'runtime_dir = ".custom/gates/"',
      'runtime_dir = ".grove/internal/gates"',
    ),
  );

  const inventoryOnly = await planRefresh({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    legacyMigration: {
      migrateRuntimeDir: false,
      restartAcknowledged: false,
      deletePaths: [],
    },
  });
  assert.equal(
    inventoryOnly.actions.some((action) =>
      action.path === '.grove/gates.toml' || action.path.startsWith('.grove/internal/')),
    false,
  );

  const configOnly = await planRefresh({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    legacyMigration: {
      migrateRuntimeDir: true,
      restartAcknowledged: false,
      deletePaths: ['.grove/internal/gates'],
    },
  });
  const configAction = configOnly.actions.find((action) => action.path === '.grove/gates.toml');
  assert.ok(configAction, JSON.stringify(configOnly, null, 2));
  assert.equal(configAction.confirmationRequired, true);
  assert.doesNotMatch(configAction.content, /^runtime_dir\s*=/m);
  assert.equal(
    configOnly.actions.some((action) => action.path.startsWith('.grove/internal/')),
    false,
  );
  assert.ok(configOnly.refusals.some((item) => /restart/i.test(item.reason)));

  const complete = await planRefresh({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    legacyMigration: {
      migrateRuntimeDir: true,
      restartAcknowledged: true,
      deletePaths: [
        '.grove/internal/gates',
        '.grove/internal/enforcement.toml',
      ],
    },
  });
  assert.ok(complete.actions.some((action) =>
    action.type === 'delete-tree' && action.path === '.grove/internal/gates'));
  assert.ok(complete.actions.some((action) =>
    action.type === 'delete' && action.path === '.grove/internal/enforcement.toml'));
  assert.ok(
    complete.actions
      .filter((action) =>
        action.path === '.grove/gates.toml' || action.path.startsWith('.grove/internal/'))
      .every((action) => action.confirmationRequired),
  );
});

test('INV31/INV34 — malformed or duplicate runtime_dir blocks every legacy migration and deletion action', async (t) => {
  for (const [name, runtimeLines] of Object.entries({
    malformed: 'runtime_dir = true\n',
    duplicate: 'runtime_dir = ".grove/internal/gates"\nruntime_dir = ".grove/internal/gates"\n',
  })) {
    await t.test(name, async () => {
      const { packageRoot, repoRoot } = await fixture();
      const bytes = 'schema = 1\n';
      await mkdir(join(repoRoot, '.grove', 'internal'), { recursive: true });
      await writeFile(join(repoRoot, '.grove', 'internal', 'enforcement.toml'), bytes);
      await writeFile(
        join(repoRoot, '.grove', 'gates.toml'),
        `${runtimeLines}[gates]\nintent = "human"\nspec = "agent"\nbuild = "agent"\nship = "human"\n`,
      );
      await writeFile(
        join(packageRoot, 'metadata', 'legacy-ownership.json'),
        `${JSON.stringify({
          schema_version: 1,
          records: [
            {
              grove_version: '0.2.0',
              candidate_path: '.grove/internal/enforcement.toml',
              candidate_kind: 'regular-file',
              sha256: sha256(bytes),
            },
            {
              grove_version: '0.2.0',
              candidate_path: '.grove/internal/gates',
              candidate_kind: 'tree',
              leaves: [{
                relative_path: 'bin/resolve-profile.mjs',
                kind: 'regular-file',
                sha256: sha256('missing\n'),
              }],
            },
          ],
        }, null, 2)}\n`,
      );

      const plan = await planRefresh({
        packageRoot,
        repoRoot,
        ...claudeInvocation,
        legacyMigration: {
          migrateRuntimeDir: true,
          restartAcknowledged: true,
          deletePaths: ['.grove/internal/enforcement.toml'],
        },
      });

      assert.equal(
        plan.actions.some((action) =>
          action.path === '.grove/internal/enforcement.toml'
          || action.path === '.grove/gates.toml'),
        false,
        JSON.stringify(plan.actions, null, 2),
      );
      assert.ok(plan.refusals.some((item) => /runtime_dir/.test(item.reason)));
    });
  }
});

test('INV31/INV34 — one malformed legacy inventory record invalidates every sibling proof', async () => {
  const { packageRoot, repoRoot } = await fixture();
  const bytes = 'schema = 1\n';
  await mkdir(join(repoRoot, '.grove', 'internal'), { recursive: true });
  await writeFile(join(repoRoot, '.grove', 'internal', 'enforcement.toml'), bytes);
  await writeFile(
    join(packageRoot, 'metadata', 'legacy-ownership.json'),
    `${JSON.stringify({
      schema_version: 1,
      records: [
        {
          grove_version: '0.2.0',
          candidate_path: '.grove/internal/enforcement.toml',
          candidate_kind: 'regular-file',
          sha256: sha256(bytes),
        },
        {
          grove_version: '0.2.0',
          candidate_path: '.grove/internal/gates',
          candidate_kind: 'tree',
          leaves: [{ relative_path: '../escape', kind: 'regular-file', sha256: 'bad' }],
        },
      ],
    }, null, 2)}\n`,
  );

  const plan = await planRefresh({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    legacyMigration: {
      migrateRuntimeDir: false,
      restartAcknowledged: true,
      deletePaths: ['.grove/internal/enforcement.toml'],
    },
  });

  assert.equal(
    plan.actions.some((action) => action.path === '.grove/internal/enforcement.toml'),
    false,
  );
  assert.ok(plan.refusals.some((item) => /inventory/i.test(item.reason)));
  assert.ok(plan.legacy.every((item) => item.owned === false));
});

test('INV31/INV34 — duplicate or incomplete legacy inventories cannot authorize a valid sibling', async (t) => {
  const bytes = 'schema = 1\n';
  const enforcement = {
    grove_version: '0.2.0',
    candidate_path: '.grove/internal/enforcement.toml',
    candidate_kind: 'regular-file',
    sha256: sha256(bytes),
  };
  const gates = {
    grove_version: '0.2.0',
    candidate_path: '.grove/internal/gates',
    candidate_kind: 'tree',
    leaves: [{
      relative_path: 'bin/resolve-profile.mjs',
      kind: 'regular-file',
      sha256: sha256('missing\n'),
    }],
  };
  for (const [name, records] of [
    ['duplicate', [enforcement, { ...enforcement }, gates]],
    ['incomplete', [enforcement]],
  ]) {
    await t.test(name, async () => {
      const { packageRoot, repoRoot } = await fixture();
      await mkdir(join(repoRoot, '.grove', 'internal'), { recursive: true });
      await writeFile(join(repoRoot, '.grove', 'internal', 'enforcement.toml'), bytes);
      await writeFile(
        join(packageRoot, 'metadata', 'legacy-ownership.json'),
        `${JSON.stringify({ schema_version: 1, records }, null, 2)}\n`,
      );
      const plan = await planRefresh({
        packageRoot,
        repoRoot,
        ...claudeInvocation,
        legacyMigration: {
          migrateRuntimeDir: false,
          restartAcknowledged: true,
          deletePaths: ['.grove/internal/enforcement.toml'],
        },
      });
      assert.equal(
        plan.actions.some((action) => action.path === '.grove/internal/enforcement.toml'),
        false,
      );
      assert.ok(plan.refusals.some((item) => /inventory/i.test(item.reason)));
    });
  }
});

test('INV30/INV31 — Remove refuses a selection that would delete and rewrite gates.toml', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await mkdir(join(repoRoot, '.grove'), { recursive: true });
  await writeFile(
    join(repoRoot, '.grove', 'gates.toml'),
    'runtime_dir = ".grove/internal/gates"\n[gates]\nintent = "human"\nspec = "agent"\nbuild = "agent"\nship = "human"\n',
  );

  const plan = await planRemove({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    selection: {
      hosts: [],
      sharedFloor: false,
      legacyStatus: false,
      consumerPaths: ['.grove/gates.toml'],
      legacyMigration: {
        migrateRuntimeDir: true,
        restartAcknowledged: false,
        deletePaths: [],
      },
    },
  });

  assert.equal(
    plan.actions.filter((action) => action.path === '.grove/gates.toml').length,
    0,
    JSON.stringify(plan.actions, null, 2),
  );
  assert.ok(plan.refusals.some((item) => /conflict|rewrite.*delete|delete.*rewrite/i.test(item.reason)));
});

test('INV36/S34 — candidate surfaces plan no setup, refresh, or set-profile writes', async (t) => {
  for (const operation of ['setup', 'refresh', 'set-profile']) {
    await t.test(operation, async () => {
      const { packageRoot, repoRoot } = await fixture();
      const surfacePath = join(packageRoot, 'metadata', 'surfaces.json');
      const surfaces = JSON.parse(await readFile(surfacePath, 'utf8'));
      const row = surfaces.rows.find((item) => item.surface_id === 'codex-exec-non-ephemeral');
      row.release_state = 'candidate';
      row.disclosure = 'Candidate fixture is not write-authorized.';
      await writeFile(surfacePath, `${JSON.stringify(surfaces, null, 2)}\n`);
      const common = { packageRoot, repoRoot, ...codexInvocation };
      const plan = operation === 'setup'
        ? await planSetup({ ...common, choices: { preset: 'steward', config: {} } })
        : operation === 'refresh'
          ? await planRefresh(common)
          : await planSetProfile({ ...common, preset: 'guardian' });

      assert.equal(plan.ok, false);
      assert.deepEqual(plan.actions, []);
      assert.match(plan.summary, /candidate|not write-authorized/i);
    });
  }
});

test('INV35 — lookalike marker pairs remain consumer text and provide no stamp authority', async () => {
  const { packageRoot, repoRoot } = await fixture();
  const lookalike =
    '<!-- grove:begin (managed by grove — dials live in .grove/, not this block) --> trailing\n' +
    'grove plugin@9.9.9\n' +
    '<!-- grove:end --> trailing\n';
  await writeFile(join(repoRoot, 'CLAUDE.md'), lookalike);

  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    choices: { preset: 'steward', config: {} },
  });

  assert.equal(plan.ok, true, plan.summary);
  assert.equal(plan.skew.some((item) => item.repositoryVersion === '9.9.9'), false);
  const carrier = plan.actions.find((action) => action.path === 'CLAUDE.md');
  assert.ok(carrier);
  assert.match(carrier.content, /<!-- grove:begin .* --> trailing/);
  assert.match(carrier.content, /<!-- grove:begin \(managed by grove/);
});

test('INV35 — stamp inventory reports every valid carrier path/value and explicit match direction', async () => {
  const { packageRoot, repoRoot } = await fixture();
  for (const [path, loader] of [
    ['CLAUDE.md', 'claude loader'],
    ['AGENTS.md', 'codex loader'],
  ]) {
    await writeFile(
      join(repoRoot, path),
      `${loader}\n<!-- grove:begin (managed by grove — dials live in .grove/, not this block) -->\n` +
        'grove plugin@0.3.0\n<!-- grove:end -->\n',
    );
  }

  const plan = await planRefresh({ packageRoot, repoRoot, ...claudeInvocation });
  assert.deepEqual(
    plan.skew.map((item) => ({
      carrierPath: item.carrierPath,
      repositoryVersion: item.repositoryVersion,
      installedVersion: item.installedVersion,
      direction: item.direction,
    })),
    [
      {
        carrierPath: 'CLAUDE.md',
        repositoryVersion: '0.3.0',
        installedVersion: '0.3.0',
        direction: 'match',
      },
      {
        carrierPath: 'AGENTS.md',
        repositoryVersion: '0.3.0',
        installedVersion: '0.3.0',
        direction: 'match',
      },
    ],
  );
});

test('INV28/INV33/S31 — managed driving loaders derive from host inventory declarations', async (t) => {
  for (const [invocation, inventoryName, loaderFields, expected] of [
    [
      claudeInvocation,
      'claude-inventory.json',
      {
        dispatcher: { raw_reference: '${CLAUDE_PLUGIN_ROOT}/reference/custom/dispatcher.md' },
        shaper: { raw_reference: '${CLAUDE_PLUGIN_ROOT}/reference/custom/shaper.md' },
      },
      ['reference/custom/dispatcher.md', 'reference/custom/shaper.md'],
    ],
    [
      codexInvocation,
      'codex-inventory.json',
      {
        dispatcher: { raw_skill_id: 'grove:custom-dispatcher' },
        shaper: { raw_skill_id: 'grove:custom-shaper' },
      },
      ['grove:custom-dispatcher', 'grove:custom-shaper'],
    ],
  ]) {
    await t.test(invocation.host, async () => {
      const { packageRoot, repoRoot } = await fixture();
      await writeFile(
        join(packageRoot, 'metadata', inventoryName),
        `${JSON.stringify({ schema_version: 1, host: invocation.host, driving_loaders: loaderFields }, null, 2)}\n`,
      );
      const plan = await planSetup({
        packageRoot,
        repoRoot,
        ...invocation,
        choices: { preset: 'steward', config: {} },
      });
      assert.equal(plan.ok, true, plan.summary);
      const carrierPath = invocation.host === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
      const carrier = plan.actions.find((action) => action.path === carrierPath);
      assert.ok(carrier);
      for (const value of expected) {
        assert.match(carrier.content, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
    });
  }
});
