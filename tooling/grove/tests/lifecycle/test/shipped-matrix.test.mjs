// The shipped surface matrix, not a fixture.
//
// Every other lifecycle test builds its own `surfaces.json`. That is what let
// `/grove:setup` ship dead: the fixtures hardcoded a writable row while the
// real matrix had none, so the suite stayed green through a product that
// refused every operation on every surface, on both hosts, for its whole life.
//
// These tests read `plugins/grove/metadata/surfaces.json` as published. They
// are deliberately few and deliberately blunt — their only job is to fail when
// the thing users install stops working.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { after } from 'node:test';

import { planRefresh, planRemove, planSetProfile, planSetup } from '../../../../../plugins/grove/runtime/lifecycle/lib/lifecycle.mjs';

const packageRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', '..', '..', 'plugins', 'grove',
);

async function shippedRows() {
  const raw = await readFile(join(packageRoot, 'metadata', 'surfaces.json'), 'utf8');
  return JSON.parse(raw).rows;
}

const scratch = [];
const repo = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-shipped-'));
  scratch.push(dir);
  return dir;
};
after(async () => {
  await Promise.all(scratch.map((d) => rm(d, { recursive: true, force: true })));
});

test('the shipped matrix enables at least one surface per host', async () => {
  const rows = await shippedRows();
  for (const host of ['claude', 'codex']) {
    const available = rows.filter(
      (r) => r.host === host && r.availability_state === 'available',
    );
    assert.ok(
      available.length >= 1,
      `no ${host} surface is available in the shipped matrix — every ${host} setup would refuse`,
    );
  }
});

test('setup plans real actions on every available shipped surface', async () => {
  const rows = await shippedRows();
  const available = rows.filter((r) => r.availability_state === 'available');
  assert.ok(available.length > 0, 'the shipped matrix enables nothing at all');

  for (const row of available) {
    const plan = await planSetup({
      packageRoot,
      repoRoot: await repo(),
      host: row.host,
      surface: { surface_id: row.surface_id, provenance: 'user-explicit' },
      choices: { preset: 'steward', config: {} },
    });
    assert.equal(plan.ok, true, `${row.surface_id}: setup refused — ${plan.summary}`);
    assert.ok(
      plan.actions.length > 0,
      `${row.surface_id}: setup succeeded but planned no writes`,
    );
  }
});

test('remove stays available on every shipped surface, enabled or not', async () => {
  // A project may have been set up before a row's availability changed;
  // cleanup must still reach it.
  for (const row of await shippedRows()) {
    const plan = await planRemove({
      packageRoot,
      repoRoot: await repo(),
      host: row.host,
      surface: { surface_id: row.surface_id, provenance: 'user-explicit' },
    });
    assert.equal(plan.ok, true, `${row.surface_id}: remove refused — ${plan.summary}`);
  }
});

test('every shipped row carries an availability decision', async () => {
  for (const row of await shippedRows()) {
    assert.ok(
      ['available', 'unavailable'].includes(row.availability_state),
      `${row.surface_id}: availability_state is ${JSON.stringify(row.availability_state)}`,
    );
  }
});

test('every plan on a no-support row leads with the non-support disclosure', async () => {
  // adr-0041 clause 7 and AC7. This is independent of availability: an enabled
  // surface still carries no support promise, and a plan that writes files
  // without saying so is the exact conflation adr-0041 exists to undo. An
  // earlier revision of this change built the disclosure inside the
  // unavailable branch, so the two enabled rows wrote files while mentioning
  // support nowhere — caught in review, guarded here.
  const rows = await shippedRows();
  const available = rows.filter((r) => r.availability_state === 'available');
  assert.ok(available.length > 0);

  for (const row of available) {
    assert.equal(row.support_claim, 'none', `${row.surface_id}: fixture assumption`);
    const plan = await planSetup({
      packageRoot,
      repoRoot: await repo(),
      host: row.host,
      surface: { surface_id: row.surface_id, provenance: 'user-explicit' },
      choices: { preset: 'steward', config: {} },
    });
    assert.equal(plan.ok, true, `${row.surface_id}: ${plan.summary}`);
    assert.match(
      plan.summary,
      /^Grove claims no support/,
      `${row.surface_id}: the plan must LEAD with the disclosure, got: ${plan.summary.slice(0, 90)}`,
    );
  }
});

test('every shipped row carries a support decision', async () => {
  for (const row of await shippedRows()) {
    assert.ok(
      ['claimed', 'none'].includes(row.support_claim),
      `${row.surface_id}: support_claim is ${JSON.stringify(row.support_claim)}`,
    );
  }
});

test('an unavailable shipped surface is refused — the gate itself, not just the data', async () => {
  // Every other test here asserts something SUCCEEDS, which is a liveness
  // guard: it fails when the product stops working. None of them fail if the
  // gate is deleted outright, because deleting a gate only makes more things
  // succeed. Measured: replacing the availability check with `if (false)` left
  // all of them green. This is the safety half.
  const rows = await shippedRows();
  const blocked = rows.filter((r) => r.availability_state !== 'available');
  assert.ok(blocked.length > 0, 'the shipped matrix enables everything — nothing to guard');

  for (const row of blocked) {
    for (const operation of ['setup', 'refresh', 'set-profile']) {
      const common = {
        packageRoot,
        repoRoot: await repo(),
        host: row.host,
        surface: { surface_id: row.surface_id, provenance: 'user-explicit' },
      };
      const plan = operation === 'setup'
        ? await planSetup({ ...common, choices: { preset: 'steward', config: {} } })
        : operation === 'refresh'
          ? await planRefresh(common)
          : await planSetProfile({ ...common, preset: 'guardian' });
      assert.equal(
        plan.ok, false,
        `${row.surface_id}/${operation}: an unavailable surface planned writes`,
      );
      assert.deepEqual(plan.actions, [], `${row.surface_id}/${operation}: planned actions anyway`);
    }
  }
});

test('unavailable rows disclose no-support too, not just availability', async () => {
  // adr-0041 clause 7 says EVERY support_claim:none plan leads with the
  // disclosure. A revision of this branch fixed that for available rows and
  // reintroduced it on the unavailable branch, which returned only the
  // availability text and discarded the support one built immediately above.
  const rows = await shippedRows();
  for (const row of rows.filter((r) => r.availability_state !== 'available')) {
    const plan = await planSetup({
      packageRoot,
      repoRoot: await repo(),
      host: row.host,
      surface: { surface_id: row.surface_id, provenance: 'user-explicit' },
      choices: { preset: 'steward', config: {} },
    });
    assert.equal(plan.ok, false);
    assert.match(
      plan.summary,
      /^Grove claims no support/,
      `${row.surface_id}: refusal dropped the no-support disclosure — ${plan.summary.slice(0, 80)}`,
    );
  }
});

test('a failure after classification still leads with the disclosure', async () => {
  // adr-0041 clause 7 admits no exception for failed plans. The disclosure was
  // attached to the successful context and prepended by summary(), so any
  // reachable failure after classification — an invalid preset here — replaced
  // the summary with its own text and dropped it.
  const rows = await shippedRows();
  const row = rows.find((r) => r.availability_state === 'available');
  const plan = await planSetup({
    packageRoot,
    repoRoot: await repo(),
    host: row.host,
    surface: { surface_id: row.surface_id, provenance: 'user-explicit' },
    choices: { config: {} },          // no preset: fails after classification
  });
  assert.equal(plan.ok, false);
  assert.match(
    plan.summary,
    /^Grove claims no support/,
    `a post-classification failure dropped the disclosure: ${plan.summary.slice(0, 90)}`,
  );
});

test('EVERY plan on a no-support row leads with the disclosure, across every repo state', async () => {
  // The sweep, not another single case. Four review rounds each found one more
  // path that dropped the disclosure — available rows, unavailable rows, failed
  // plans, then the malformed-carrier check in prepare() that intercepts before
  // the branch round four actually patched. Testing one path at a time is what
  // let each fix miss its siblings, so this asserts the invariant over the
  // cross product instead: every shipped row, every operation, every repo state
  // that changes which branch returns.
  //
  // Round five was a `.grove/gates.toml` the consumer had hand-edited: seeding
  // it threw out of planSetup before any branch returned, so the plan never
  // existed to carry a summary. The state and the overwrite arm below are that
  // round — the sweep only bites if new branch-selecting inputs get added to it.
  const rows = await shippedRows();
  const states = {
    empty: async () => {},
    'gates.toml missing seeded_from': async (dir) => {
      // The SHIPPED template with only the `seeded_from` line removed. An
      // earlier version of this state used a bogus gate row instead, which
      // `parseProfile` rejects first — so set-profile returned a clean failure
      // and the sweep never reached the unguarded `seedPreset` one line below
      // it. The fixture must be a file that PARSES and still fails to seed,
      // or it tests the guard instead of the gap.
      const template = await readFile(join(packageRoot, 'reference/gates/gates.toml'), 'utf8');
      const withoutProvenance = template
        .split(/\r?\n/)
        .filter((line) => !line.trimStart().startsWith('seeded_from'))
        .join('\n');
      await mkdir(join(dir, '.grove'), { recursive: true });
      await writeFile(join(dir, '.grove', 'gates.toml'), withoutProvenance);
    },
    'duplicate markers': async (dir) => {
      await writeFile(join(dir, 'CLAUDE.md'),
        '<!-- grove:begin (managed by grove) -->\na\n<!-- grove:end -->\n' +
        '<!-- grove:begin (managed by grove) -->\nb\n<!-- grove:end -->\n');
    },
    'malformed block': async (dir) => {
      await writeFile(join(dir, 'CLAUDE.md'), '<!-- grove:begin (managed by grove) -->\nno end marker\n');
    },
    'other host malformed': async (dir) => {
      await writeFile(join(dir, 'AGENTS.md'), '<!-- grove:begin (managed by grove) -->\ndangling\n');
    },
  };

  const misses = [];
  for (const row of rows) {
    if (row.support_claim === 'claimed') continue;
    for (const [stateName, seed] of Object.entries(states)) {
      for (const operation of ['setup', 'setup+gates-overwrite', 'refresh', 'set-profile', 'remove']) {
        const dir = await repo();
        await seed(dir);
        const common = {
          packageRoot,
          repoRoot: dir,
          host: row.host,
          surface: { surface_id: row.surface_id, provenance: 'user-explicit' },
        };
        const plan = operation === 'setup'
          ? await planSetup({ ...common, choices: { preset: 'steward', config: {} } })
          : operation === 'setup+gates-overwrite'
          // The arm that actually reseeds. Without it the sweep only ever
          // exercises the skip path, where a broken gates.toml is never read.
            ? await planSetup({
              ...common,
              choices: { preset: 'steward', config: {}, overwritePaths: ['.grove/gates.toml'] },
            })
          : operation === 'refresh'
            ? await planRefresh(common)
            : operation === 'set-profile'
              ? await planSetProfile({ ...common, preset: 'guardian' })
              : await planRemove(common);
        // LEADS with it, matching the sibling tests. This asserted `.includes`
        // over summary plus `plan.notices` — and `newPlan` has no `notices`
        // field, so that half was always the empty string. A disclosure buried
        // mid-summary would have passed the sweep while failing every test
        // around it.
        if (!/^Grove claims no support/.test(String(plan.summary ?? ''))) {
          misses.push(`${row.surface_id}/${operation}/${stateName}: ${String(plan.summary).slice(0, 70)}`);
        }
      }
    }
  }
  assert.deepEqual(misses, [], `plans reached the user with no support disclosure:\n  ${misses.join('\n  ')}`);
});
