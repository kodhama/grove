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
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { planRemove, planSetup } from '../../../../../plugins/grove/runtime/lifecycle/lib/lifecycle.mjs';

const packageRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', '..', '..', 'plugins', 'grove',
);

async function shippedRows() {
  const raw = await readFile(join(packageRoot, 'metadata', 'surfaces.json'), 'utf8');
  return JSON.parse(raw).rows;
}

const repo = () => mkdtemp(join(tmpdir(), 'grove-shipped-'));

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
