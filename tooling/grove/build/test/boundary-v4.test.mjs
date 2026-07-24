// Upstream: spec-0004-dual-host-distribution@v4 INV23–INV27, INV33; S21–S23, S31.
// Decisions: adr-0031-multi-host-distribution; adr-0035-plugin-and-consumer-boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { buildProjectionSet } from '../lib/generate.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const PACKAGE_ROOT = join(REPOSITORY_ROOT, 'plugins', 'grove');

test('INV23–INV25/S21 — the installable package has the exact permitted root shape', async () => {
  const actual = (await readdir(PACKAGE_ROOT, { withFileTypes: true }))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(actual, [
    '.claude-plugin',
    '.codex-plugin',
    'README.md',
    'VERSION',
    'adapters',
    'metadata',
    'reference',
    'runtime',
  ]);
});

test('INV26–INV27 — generated host isolation is a precondition, not S22/S23 live discovery evidence', async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPOSITORY_ROOT });
  const paths = [...outputs.keys()];
  const claudeAgents = paths.filter((path) =>
    /^plugins\/grove\/adapters\/claude\/agents\/[^/]+\.md$/.test(path));
  const claudeSkills = paths.filter((path) =>
    /^plugins\/grove\/adapters\/claude\/skills\/[^/]+\/SKILL\.md$/.test(path));
  const codexSkills = paths.filter((path) =>
    /^plugins\/grove\/adapters\/codex\/skills\/[^/]+\/SKILL\.md$/.test(path));

  assert.equal(claudeAgents.length, 12, 'Claude gets eleven cold-native agents and the scoped dispatcher');
  assert.equal(claudeSkills.length, 4, 'Claude gets only the four lifecycle skills');
  assert.equal(codexSkills.length, 17, 'Codex gets thirteen role skills and four lifecycle skills');
  assert.equal(paths.some((path) => path.startsWith('plugins/grove/agents/')), false);
  assert.equal(paths.some((path) => path.startsWith('plugins/grove/skills/')), false);

  const claudeManifest = JSON.parse(
    await readFile(join(PACKAGE_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
  );
  const codexManifest = JSON.parse(
    await readFile(join(PACKAGE_ROOT, '.codex-plugin', 'plugin.json'), 'utf8'),
  );
  assert.deepEqual(
    [...claudeManifest.agents].sort(),
    claudeAgents
      .map((path) => `./${path.slice('plugins/grove/'.length)}`)
      .sort(),
  );
  assert.match(String(claudeManifest.skills), /^\.\/adapters\/claude\/skills\/?$/);
  assert.match(String(codexManifest.skills), /^\.\/adapters\/codex\/skills\/?$/);
  assert.equal('agents' in codexManifest, false, 'Codex plugin discovery has no custom-agent root');

  const claudeInventory = JSON.parse(
    outputs.get('plugins/grove/metadata/claude-inventory.json'),
  );
  const codexInventory = JSON.parse(
    outputs.get('plugins/grove/metadata/codex-inventory.json'),
  );
  assert.equal(claudeInventory.components.length, 16);
  assert.equal(codexInventory.components.length, 17);
  for (const inventory of [claudeInventory, codexInventory]) {
    for (const component of inventory.components) {
      assert.match(component.raw_id, /^grove:/);
      assert.equal(typeof component.canonical_source, 'string');
      assert.match(component.canonical_digest, /^[0-9a-f]{64}$/);
    }
  }
});

test('INV23/S21 — generated allowlist stores exact repository-relative leaf paths', async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPOSITORY_ROOT });
  const allowlist = JSON.parse(
    outputs.get('plugins/grove/metadata/package-allowlist.json'),
  );
  assert.ok(allowlist.leaves.length > 0);
  assert.ok(
    allowlist.leaves.every((leaf) =>
      leaf.path.startsWith('plugins/grove/') && !leaf.path.includes('*')),
  );
  assert.ok(
    allowlist.leaves.some((leaf) =>
      leaf.path === 'plugins/grove/metadata/package-allowlist.json'),
  );
});

test('INV28/INV33/S24/S31 — driving loaders stay thin, canonical, and package-runtime aware', async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPOSITORY_ROOT });
  const bySuffix = (suffix) => [...outputs]
    .find(([path]) => path.endsWith(suffix))?.[1] ?? '';
  const dispatcher = bySuffix('/role-dispatcher/SKILL.md');
  const shaper = bySuffix('/role-shaper/SKILL.md');
  const dispatcherReference = bySuffix('/reference/charters/dispatcher.md');

  assert.notEqual(dispatcher, '', 'dispatcher driving loader is generated');
  assert.notEqual(shaper, '', 'shaper driving loader is generated');
  assert.match(dispatcher, /reference\/charters\/dispatcher\.md/);
  assert.match(shaper, /reference\/charters\/shaper\.md/);
  assert.match(`${dispatcher}\n${dispatcherReference}`, /runtime\/gates\//);
  assert.match(`${dispatcher}\n${dispatcherReference}`, /runtime_dir/);
});

test('repository checks retain all six suites and moved ledgers name their actual roots', async () => {
  const [workflow, config, gatesLedger, retiredLedger, retiredReadme, probesLedger] =
    await Promise.all([
      readFile(join(REPOSITORY_ROOT, '.github/workflows/grove-tests.yml'), 'utf8'),
      readFile(join(REPOSITORY_ROOT, '.grove/config.toml'), 'utf8'),
      readFile(join(REPOSITORY_ROOT, 'tooling/grove/tests/gates/test-deps.md'), 'utf8'),
      readFile(join(REPOSITORY_ROOT, 'retired/review-bookkeeping/check/test-deps.md'), 'utf8'),
      readFile(join(REPOSITORY_ROOT, 'retired/review-bookkeeping/reference/ci/README.md'), 'utf8'),
      readFile(join(REPOSITORY_ROOT, 'tooling/grove/probes/test-deps.md'), 'utf8'),
    ]);
  for (const text of [workflow, config]) {
    assert.match(text, /retired\/review-bookkeeping\/check/);
    assert.match(text, /tooling\/grove\/probes/);
  }
  assert.match(workflow, /six suites/i);
  assert.match(gatesLedger, /tooling\/grove\/tests\/gates/);
  assert.doesNotMatch(gatesLedger, /plugins\/grove\/gates/);
  assert.match(retiredLedger, /retired\/review-bookkeeping\/check/);
  assert.doesNotMatch(retiredLedger, /root is\s+`plugins\/grove\/check/);
  assert.match(retiredReadme, /retired\/review-bookkeeping\/check/);
  assert.match(probesLedger, /spec-0004-dual-host-distribution@v4/);
});

test('S22/S23 remain an explicit external live-host release gate, not a manifest-only pass claim', async () => {
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
  assert.ok(contract.cases.every((item) =>
    Array.isArray(item.required_artifacts) && item.required_artifacts.length > 0));
});

test('lifecycle ledger carries the required schema row and release CLI consumes the discovery contract', async () => {
  const [ledger, releaseCli, workflow] = await Promise.all([
    readFile(join(REPOSITORY_ROOT, 'tooling/grove/tests/lifecycle/test-deps.md'), 'utf8'),
    readFile(join(REPOSITORY_ROOT, 'tooling/grove/release/bin/validate-release.mjs'), 'utf8'),
    readFile(join(REPOSITORY_ROOT, '.github/workflows/release-tag.yml'), 'utf8'),
  ]);
  const block = ledger.match(/```grove-test-deps\n([\s\S]*?)```/)?.[1] ?? '';
  assert.match(block, /^schema:\s*1$/m);
  assert.match(releaseCli, /host-discovery-contract\.json/);
  assert.match(workflow, /check:release/);
});
