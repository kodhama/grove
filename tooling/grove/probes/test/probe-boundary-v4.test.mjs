// Upstream: spec-0004-dual-host-distribution@v4 INV20, INV23, INV26–INV27, INV32; S18, S22–S23, S30.
// Decisions: adr-0031-multi-host-distribution; adr-0035-plugin-and-consumer-boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { prepareCodexSupportProbe } from '../lib/codex-probe.mjs';

const execFileAsync = promisify(execFile);
const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('prepared probe keeps the exact candidate snapshot immutable and executes a hash-bound non-TTY preflight', async (t) => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'grove-probe-preflight-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const prepared = await prepareCodexSupportProbe({
    repositoryRoot: REPOSITORY_ROOT,
    outputRoot,
    repositoryCommit: '0123456789abcdef0123456789abcdef01234567',
    requireCleanGit: false,
    verifyCandidate: false,
  });

  const exactSurfaces = JSON.parse(await readFile(
    join(outputRoot, prepared.manifest.paths.package_snapshot, 'metadata', 'surfaces.json'),
    'utf8',
  ));
  assert.equal(
    exactSurfaces.rows.find((row) => row.surface_id === 'codex-exec-non-ephemeral').release_state,
    'candidate',
  );
  assert.equal(prepared.manifest.composition_fixture.release_state_override, 'supported');
  assert.equal(prepared.manifest.composition_fixture.surface_id, 'codex-exec-non-ephemeral');
  assert.match(prepared.manifest.composition_fixture.disclosure, /composition-only|plan generation/i);

  assert.ok(prepared.manifest.harness.files.length >= 2);
  for (const file of prepared.manifest.harness.files) {
    const bytes = await readFile(join(outputRoot, file.path));
    assert.equal(sha256(bytes), file.sha256, file.path);
    assert.equal(file.path.startsWith(prepared.manifest.paths.package_snapshot), false);
  }

  const { stdout } = await execFileAsync(
    process.execPath,
    [join(outputRoot, 'run-probe.mjs'), '--preflight'],
    { cwd: outputRoot },
  );
  assert.match(stdout, /probe preflight passed/i);

  const probeHarness = prepared.manifest.harness.probe_module;
  await writeFile(join(outputRoot, probeHarness), 'export const tampered = true;\n');
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [join(outputRoot, 'run-probe.mjs'), '--preflight'],
      { cwd: outputRoot },
    ),
    /harness digest differs/i,
  );
});

test('probe package declares the external shallow/deep live-host discovery gate', async () => {
  const contract = JSON.parse(await readFile(
    join(REPOSITORY_ROOT, 'tooling/grove/probes/host-discovery-contract.json'),
    'utf8',
  ));
  assert.equal(contract.release_blocking, true);
  assert.equal(contract.claimed_pass, false);
  assert.deepEqual(
    contract.cases.map((item) => `${item.host}:${item.layout}`).sort(),
    ['claude:deep-with-spaces', 'claude:shallow', 'codex:deep-with-spaces', 'codex:shallow'],
  );
});
