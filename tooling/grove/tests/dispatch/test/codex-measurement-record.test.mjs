// Upstream: spec-0006-voluntary-dispatch@v2 INV26; AC11 (mechanical
// evidence-record clause); §Host scope. Decision: adr-0046.
//
// Blocking prerequisite of implementation: before the implementation's build
// gate closes, an evidence record under plugins/grove/reference/surfaces/
// shall record whether Codex exposes a Stop-equivalent hook event — result
// either way. The record is produced by a separate measurement session (S0);
// this test is the existence gate and stays RED until that record lands.
// It is never faked green.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const SURFACES_ROOT = resolve(
  import.meta.dirname,
  '..', '..', '..', '..', '..',
  'plugins', 'grove', 'reference', 'surfaces',
);

test('AC11 — a Codex Stop-hook-vocabulary evidence record exists, result either way', async () => {
  const names = (await readdir(SURFACES_ROOT)).filter((name) => name.endsWith('.json'));
  const candidates = [];
  for (const name of names) {
    let record;
    try {
      record = JSON.parse(await readFile(join(SURFACES_ROOT, name), 'utf8'));
    } catch {
      continue;
    }
    const text = JSON.stringify(record);
    if (record.host === 'codex' && /stop/i.test(text) && /hook/i.test(text)) {
      candidates.push({ name, record });
    }
  }
  assert.ok(
    candidates.length >= 1,
    'no evidence record under plugins/grove/reference/surfaces/ measures whether '
      + 'Codex exposes a Stop-equivalent hook event (spec-0006 §Host scope: the '
      + 'record is owed before the build gate closes, result either way)',
  );
  for (const { name, record } of candidates) {
    assert.ok(record.results || record.conclusion, `${name}: carries no measured result`);
  }
});
