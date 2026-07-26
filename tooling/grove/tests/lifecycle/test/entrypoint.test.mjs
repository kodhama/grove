// Upstream: spec-0004@v6 canonical-source contract for shared lifecycle operations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { describeOperation } from '../../../../../plugins/grove/runtime/lifecycle/lib/lifecycle.mjs';

const execFileAsync = promisify(execFile);
const PACKAGE_ROOT = fileURLToPath(new URL('../../../../../plugins/grove/', import.meta.url));
const CLI = join(PACKAGE_ROOT, 'runtime/lifecycle/bin/grove-operation.mjs');

test('thin skill adapters can read every operation contract from the shared core', () => {
  for (const operation of ['setup', 'refresh', 'set-profile', 'remove']) {
    const contract = describeOperation(operation);
    assert.equal(contract.operation, operation);
    assert.deepEqual(contract.flow, ['plan', 'disclose', 'confirm-exact-action-ids', 'apply']);
    assert.ok(contract.required_inputs.includes('host'));
    assert.ok(contract.required_inputs.includes('surface'));
    assert.match(contract.cli.plan, new RegExp(`plan ${operation}`));
    assert.match(contract.cli.apply, / apply /);
  }
  assert.throws(() => describeOperation('unknown'), /unknown operation/);
});

// Regression: describeOperation's input contract states packageRoot is optional and that
// "the CLI resolves its own package when absent". Self-resolution previously landed one
// directory short (runtime/, not the package root), so every omitting caller failed to
// load metadata/surfaces.json before any surface rule could be evaluated.
test('the CLI resolves its own package root when the request omits packageRoot', async (t) => {
  const contract = describeOperation('setup');
  assert.match(contract.input_contract.packageRoot, /optional/);

  const workspace = await mkdtemp(join(tmpdir(), 'grove-packageroot-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));

  const repoRoot = join(workspace, 'repo');
  await mkdir(repoRoot);
  const requestPath = join(workspace, 'request.json');
  await writeFile(requestPath, JSON.stringify({
    repoRoot,
    host: 'claude',
    // A deliberately unknown id: validateSurface reports it only after the matrix
    // has been read, and it reports it before any support-state rule, so this stays
    // a stable probe of resolution as that grammar changes (adr-0041).
    surface: { surface_id: 'not-a-real-surface', provenance: 'user-explicit' },
    choices: { preset: 'balanced' },
  }));

  // Also run from a copy at a different depth whose path contains a space, so the
  // assertion is about self-resolution rather than this checkout's layout.
  const installed = join(workspace, 'plugin cache', 'kodhama', 'grove');
  await cp(PACKAGE_ROOT, installed, { recursive: true });

  for (const entry of [CLI, join(installed, 'runtime/lifecycle/bin/grove-operation.mjs')]) {
    // A failed plan exits 2 with its JSON on stdout; anything else is a real error.
    const result = await execFileAsync(process.execPath, [entry, 'plan', 'setup', requestPath])
      .catch((error) => error);
    assert.equal(result.code, 2, `expected a refused plan from ${entry}`);
    const plan = JSON.parse(result.stdout);

    assert.doesNotMatch(plan.summary, /cannot load declared surface matrix|ENOENT/);
    assert.match(plan.summary, /unknown surface id "not-a-real-surface"/);
  }
});
