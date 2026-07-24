// Upstream: spec-0004-dual-host-distribution@v4 INV23, INV24, INV32; S21, S30.
// Decision: adr-0035-plugin-and-consumer-boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  assemblePackageSnapshot,
  packageTreeDigest,
  validatePackageTree,
  validateReleaseTree,
} from '../lib/release.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const PACKAGE_ROOT = join(REPOSITORY_ROOT, 'plugins', 'grove');

async function createClaimedDiscoveryFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'grove-discovery-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = JSON.parse(await readFile(
    join(REPOSITORY_ROOT, 'tooling', 'grove', 'probes', 'host-discovery-contract.json'),
    'utf8',
  ));
  const snapshotRoot = join(root, 'exact-package-snapshot');
  const packageValidation = await validatePackageTree(PACKAGE_ROOT);
  assert.equal(packageValidation.ok, true, packageValidation.errors.join('\n'));
  await assemblePackageSnapshot(PACKAGE_ROOT, snapshotRoot, packageValidation);
  const packageDigest = await packageTreeDigest(snapshotRoot);
  const cases = [];
  for (const item of source.cases) {
    const artifacts = {};
    for (const name of item.required_artifacts) {
      const path = join('evidence', `${item.host}-${item.layout}`, name);
      const absolute = join(root, path);
      await mkdir(resolve(absolute, '..'), { recursive: true });
      const content = name === 'package-tree-sha256.txt'
        ? `${packageDigest}\n`
        : name === 'host-version.txt'
          ? `${item.host}-test\n`
          : `${item.host}/${item.layout}/${name}\n`;
      await writeFile(absolute, content);
      artifacts[name] = {
        path,
        sha256: createHash('sha256').update(content).digest('hex'),
      };
    }
    const reviewPath = join('evidence', `${item.host}-${item.layout}`, 'independent-review.json');
    const review = {
      host: item.host,
      layout: item.layout,
      reviewer: 'independent-reviewer',
      reviewed_at: '2026-07-24',
      verdict: 'pass',
      package_tree_sha256: packageDigest,
      artifacts: structuredClone(artifacts),
    };
    const reviewText = `${JSON.stringify(review, null, 2)}\n`;
    await writeFile(join(root, reviewPath), reviewText);
    cases.push({
      ...item,
      evidence: {
        host_version: `${item.host}-test`,
        package_tree_sha256: packageDigest,
        review: {
          reviewer: 'independent-reviewer',
          reviewed_at: '2026-07-24',
          verdict: 'pass',
          artifact: {
            path: reviewPath,
            sha256: createHash('sha256').update(reviewText).digest('hex'),
          },
        },
        artifacts,
      },
    });
  }
  return {
    root,
    packageDigest,
    cases,
    contract: {
      ...source,
      release_blocking: false,
      claimed_pass: true,
      cases,
    },
  };
}

async function refreshReviewBinding(root, item) {
  const review = {
    host: item.host,
    layout: item.layout,
    reviewer: item.evidence.review.reviewer,
    reviewed_at: item.evidence.review.reviewed_at,
    verdict: item.evidence.review.verdict,
    package_tree_sha256: item.evidence.package_tree_sha256,
    artifacts: structuredClone(item.evidence.artifacts),
  };
  const reviewText = `${JSON.stringify(review, null, 2)}\n`;
  await writeFile(join(root, item.evidence.review.artifact.path), reviewText);
  item.evidence.review.artifact.sha256 = createHash('sha256').update(reviewText).digest('hex');
}

test('INV23/INV32/S21 — release validation names an undeclared leaf before snapshot or release work', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'grove-boundary-v4-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidate = join(root, 'grove');
  await cp(PACKAGE_ROOT, candidate, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  });
  const unexpected = 'unexpected-build-fixture.txt';
  await writeFile(join(candidate, unexpected), 'source-side fixture must not ship\n');

  const result = await validateReleaseTree(candidate, { allowIncomplete: true });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes(unexpected)),
    `package error must name ${unexpected}:\n${result.errors.join('\n')}`,
  );
});

test('INV23/INV24/S21 — exact snapshot preserves allowlisted file bytes and literal symlink targets', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'grove-boundary-v4-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidate = join(root, 'grove');
  const snapshot = join(root, 'snapshot');
  await cp(PACKAGE_ROOT, candidate, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  });
  const allowlistPath = join(candidate, 'metadata', 'package-allowlist.json');
  const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'));
  allowlist.leaves.push({
    path: 'plugins/grove/version-link',
    kind: 'symlink',
    target: 'VERSION',
  });
  allowlist.leaves.sort((left, right) => left.path.localeCompare(right.path));
  await writeFile(allowlistPath, `${JSON.stringify(allowlist, null, 2)}\n`);
  await symlink('VERSION', join(candidate, 'version-link'));

  const validation = await validatePackageTree(candidate);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  await assemblePackageSnapshot(candidate, snapshot, validation);

  assert.equal(await readlink(join(snapshot, 'version-link')), 'VERSION');
  assert.deepEqual(
    await readFile(join(snapshot, 'metadata', 'package-allowlist.json')),
    await readFile(allowlistPath),
  );
  const releaseValidation = await validateReleaseTree(candidate, { release: false });
  assert.equal(releaseValidation.ok, true, releaseValidation.errors.join('\n'));
});

test('INV24/S21 — package digest distinguishes regular files from symlinks and binds literal targets', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'grove-package-digest-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const regularRoot = join(root, 'regular');
  const firstLinkRoot = join(root, 'first-link');
  const secondLinkRoot = join(root, 'second-link');
  const firstRawLinkRoot = join(root, 'first-raw-link');
  const secondRawLinkRoot = join(root, 'second-raw-link');
  await Promise.all([
    mkdir(regularRoot),
    mkdir(firstLinkRoot),
    mkdir(secondLinkRoot),
    mkdir(firstRawLinkRoot),
    mkdir(secondRawLinkRoot),
  ]);
  await Promise.all([
    writeFile(join(regularRoot, 'entry'), 'VERSION'),
    symlink('VERSION', join(firstLinkRoot, 'entry')),
    symlink('OTHER', join(secondLinkRoot, 'entry')),
    symlink(Buffer.from([0xff]), join(firstRawLinkRoot, 'entry')),
    symlink(Buffer.from([0xfe]), join(secondRawLinkRoot, 'entry')),
  ]);

  const [
    regularDigest,
    firstLinkDigest,
    secondLinkDigest,
    firstRawLinkDigest,
    secondRawLinkDigest,
  ] = await Promise.all([
    packageTreeDigest(regularRoot),
    packageTreeDigest(firstLinkRoot),
    packageTreeDigest(secondLinkRoot),
    packageTreeDigest(firstRawLinkRoot),
    packageTreeDigest(secondRawLinkRoot),
  ]);
  assert.notEqual(regularDigest, firstLinkDigest);
  assert.notEqual(firstLinkDigest, secondLinkDigest);
  assert.notEqual(firstRawLinkDigest, secondRawLinkDigest);
});

test('INV24/S21 — package digest framing resists raw payload and record-boundary collisions', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'grove-package-digest-framing-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const firstRoot = join(root, 'one-file');
  const secondRoot = join(root, 'two-files');
  await Promise.all([mkdir(firstRoot), mkdir(secondRoot)]);
  await Promise.all([
    writeFile(join(firstRoot, 'a'), Buffer.from('X\0file\0b\0Y')),
    writeFile(join(secondRoot, 'a'), 'X'),
    writeFile(join(secondRoot, 'b'), 'Y'),
  ]);

  assert.notEqual(
    await packageTreeDigest(firstRoot),
    await packageTreeDigest(secondRoot),
  );
});

test('INV23/INV24/S21 — package validation rejects symlink targets that cannot round-trip through JSON UTF-8', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'grove-package-link-encoding-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidate = join(root, 'grove');
  await cp(PACKAGE_ROOT, candidate, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  });
  const replacementName = '\ufffd';
  await writeFile(join(candidate, replacementName), 'declared replacement target\n');
  await symlink(Buffer.from([0xff]), join(candidate, 'raw-target-link'));
  const allowlistPath = join(candidate, 'metadata', 'package-allowlist.json');
  const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'));
  allowlist.leaves.push(
    { path: `plugins/grove/${replacementName}`, kind: 'file' },
    {
      path: 'plugins/grove/raw-target-link',
      kind: 'symlink',
      target: replacementName,
    },
  );
  await writeFile(allowlistPath, `${JSON.stringify(allowlist, null, 2)}\n`);

  const validation = await validatePackageTree(candidate);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join('\n'), /symlink target.*valid UTF-8/i);
});

test('INV23/INV32/S30 — an allowlisted kind mismatch is rejected before assembly', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'grove-boundary-v4-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidate = join(root, 'grove');
  await cp(PACKAGE_ROOT, candidate, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  });
  await rm(join(candidate, 'README.md'));
  await symlink('VERSION', join(candidate, 'README.md'));

  const validation = await validatePackageTree(candidate);
  assert.equal(validation.ok, false);
  assert.ok(
    validation.errors.some((error) => error.includes('package kind mismatch at README.md')),
    validation.errors.join('\n'),
  );
});

test('INV23/INV32/S30 — absolute symlink targets are rejected as package escapes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'grove-boundary-v4-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidate = join(root, 'grove');
  await cp(PACKAGE_ROOT, candidate, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  });
  const allowlistPath = join(candidate, 'metadata', 'package-allowlist.json');
  const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'));
  allowlist.leaves.push({
    path: 'plugins/grove/absolute-link',
    kind: 'symlink',
    target: '/VERSION',
  });
  await writeFile(allowlistPath, `${JSON.stringify(allowlist, null, 2)}\n`);
  await symlink('/VERSION', join(candidate, 'absolute-link'));

  const validation = await validatePackageTree(candidate);
  assert.equal(validation.ok, false);
  assert.ok(
    validation.errors.some((error) => error.includes('absolute-link') && error.includes('escapes')),
    validation.errors.join('\n'),
  );
});

test('INV25/INV27 — release rejects crossed, empty, extra, or non-inventory manifest roots', async (t) => {
  const scenarios = [
    {
      name: 'Claude empty agents',
      path: '.claude-plugin/plugin.json',
      mutate: (manifest) => { manifest.agents = []; },
    },
    {
      name: 'Claude crossed agents',
      path: '.claude-plugin/plugin.json',
      mutate: (manifest) => { manifest.agents = ['./adapters/codex/skills/']; },
    },
    {
      name: 'Claude crossed skills',
      path: '.claude-plugin/plugin.json',
      mutate: (manifest) => { manifest.skills = './adapters/codex/skills/'; },
    },
    {
      name: 'Codex empty skills',
      path: '.codex-plugin/plugin.json',
      mutate: (manifest) => { manifest.skills = ''; },
    },
    {
      name: 'Codex crossed skills',
      path: '.codex-plugin/plugin.json',
      mutate: (manifest) => { manifest.skills = './adapters/claude/skills/'; },
    },
    {
      name: 'Codex agents are forbidden',
      path: '.codex-plugin/plugin.json',
      mutate: (manifest) => { manifest.agents = ['./adapters/claude/agents/executor.md']; },
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const root = await mkdtemp(join(tmpdir(), 'grove-manifest-v4-'));
      t.after(() => rm(root, { recursive: true, force: true }));
      const candidate = join(root, 'grove');
      await cp(PACKAGE_ROOT, candidate, {
        recursive: true,
        dereference: false,
        verbatimSymlinks: true,
      });
      const manifestPath = join(candidate, scenario.path);
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      scenario.mutate(manifest);
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      const validation = await validateReleaseTree(candidate);
      assert.equal(validation.ok, false, scenario.name);
      assert.ok(
        validation.errors.some((error) => error.includes(scenario.path)),
        validation.errors.join('\n'),
      );
    });
  }
});

test('S22/S23 — external discovery gate blocks an otherwise release-acceptable surface matrix', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'grove-discovery-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidate = join(root, 'grove');
  await cp(PACKAGE_ROOT, candidate, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  });
  const surfacesPath = join(candidate, 'metadata', 'surfaces.json');
  const surfaces = JSON.parse(await readFile(surfacesPath, 'utf8'));
  surfaces.rows.find(
    (row) => row.surface_id === 'codex-exec-non-ephemeral',
  ).release_state = 'unsupported';
  await writeFile(surfacesPath, `${JSON.stringify(surfaces, null, 2)}\n`);
  const contract = JSON.parse(await readFile(
    join(REPOSITORY_ROOT, 'tooling', 'grove', 'probes', 'host-discovery-contract.json'),
    'utf8',
  ));

  const nonRelease = await validateReleaseTree(candidate, {
    release: false,
    hostDiscoveryContract: contract,
  });
  assert.equal(nonRelease.ok, true, nonRelease.errors.join('\n'));

  const release = await validateReleaseTree(candidate, {
    release: true,
    hostDiscoveryContract: contract,
  });
  assert.equal(release.ok, false);
  assert.match(release.errors.join('\n'), /live-host|discovery.*release.block/i);
  assert.doesNotMatch(release.errors.join('\n'), /remains candidate/i);
});

test('S22/S23 — malformed cases and an unbound claimed-pass discovery contract fail validation', async (t) => {
  const contract = JSON.parse(await readFile(
    join(REPOSITORY_ROOT, 'tooling', 'grove', 'probes', 'host-discovery-contract.json'),
    'utf8',
  ));
  for (const [name, malformed] of [
    ['missing case', { ...contract, cases: contract.cases.slice(0, 3) }],
    [
      'duplicate case',
      { ...contract, cases: [contract.cases[0], contract.cases[0], ...contract.cases.slice(2)] },
    ],
    [
      'unbound claimed pass',
      {
        ...contract,
        release_blocking: false,
        claimed_pass: true,
        cases: contract.cases.map(({ evidence, ...item }) => item),
      },
    ],
  ]) {
    await t.test(name, async () => {
      const validation = await validateReleaseTree(PACKAGE_ROOT, {
        release: false,
        hostDiscoveryContract: malformed,
      });
      assert.equal(validation.ok, false);
      assert.match(validation.errors.join('\n'), /host discovery contract/i);
    });
  }
});

test('S22/S23 — claimed-pass discovery requires reviewed, digest-bound artifacts for all four cases', async (t) => {
  const { root, contract, cases } = await createClaimedDiscoveryFixture(t);
  const accepted = await validateReleaseTree(PACKAGE_ROOT, {
    release: false,
    hostDiscoveryContract: { document: contract, baseDir: root },
  });
  assert.equal(accepted.ok, true, accepted.errors.join('\n'));

  await writeFile(
    join(root, cases[0].evidence.artifacts['host-version.txt'].path),
    'tampered\n',
  );
  const tampered = await validateReleaseTree(PACKAGE_ROOT, {
    release: false,
    hostDiscoveryContract: { document: contract, baseDir: root },
  });
  assert.equal(tampered.ok, false);
  assert.match(tampered.errors.join('\n'), /host discovery contract.*digest/i);

  await writeFile(
    join(root, cases[0].evidence.artifacts['host-version.txt'].path),
    'claude-test\n',
  );
  await writeFile(
    join(root, cases[0].evidence.review.artifact.path),
    '{"verdict":"pass","reviewer":"forged"}\n',
  );
  const forgedReview = await validateReleaseTree(PACKAGE_ROOT, {
    release: false,
    hostDiscoveryContract: { document: contract, baseDir: root },
  });
  assert.equal(forgedReview.ok, false);
  assert.match(forgedReview.errors.join('\n'), /host discovery contract.*review.*digest/i);
});

test('S22/S23 — claimed-pass package digest must equal the exact assembled release snapshot', async (t) => {
  const {
    root,
    contract,
    cases,
    packageDigest,
  } = await createClaimedDiscoveryFixture(t);
  const falseDigest = packageDigest === 'a'.repeat(64) ? 'b'.repeat(64) : 'a'.repeat(64);
  for (const item of cases) {
    item.evidence.package_tree_sha256 = falseDigest;
    const binding = item.evidence.artifacts['package-tree-sha256.txt'];
    const content = `${falseDigest}\n`;
    await writeFile(join(root, binding.path), content);
    binding.sha256 = createHash('sha256').update(content).digest('hex');
    await refreshReviewBinding(root, item);
  }

  const validation = await validateReleaseTree(PACKAGE_ROOT, {
    release: false,
    hostDiscoveryContract: { document: contract, baseDir: root },
  });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join('\n'), /host discovery contract.*exact package snapshot digest/i);
});

test('S22/S23 — independent review binds the exact five evidence artifact paths and digests', async (t) => {
  const { root, contract, cases } = await createClaimedDiscoveryFixture(t);
  const binding = cases[0].evidence.artifacts['invocation-results.json'];
  const replacement = 'replacement invocation evidence\n';
  await writeFile(join(root, binding.path), replacement);
  binding.sha256 = createHash('sha256').update(replacement).digest('hex');

  const validation = await validateReleaseTree(PACKAGE_ROOT, {
    release: false,
    hostDiscoveryContract: { document: contract, baseDir: root },
  });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join('\n'), /host discovery contract.*review.*artifact bindings/i);
});

test('S22/S23 — evidence and review reads reject symlinked parent directories', async (t) => {
  await t.test('evidence artifact parent', async (t) => {
    const { root, contract, cases } = await createClaimedDiscoveryFixture(t);
    const outside = await mkdtemp(join(tmpdir(), 'grove-discovery-outside-'));
    t.after(() => rm(outside, { recursive: true, force: true }));
    const artifactName = 'invocation-results.json';
    const binding = cases[0].evidence.artifacts[artifactName];
    const content = await readFile(join(root, binding.path));
    await writeFile(join(outside, artifactName), content);
    await symlink(outside, join(root, 'evidence-link'));
    binding.path = join('evidence-link', artifactName);
    await refreshReviewBinding(root, cases[0]);

    const validation = await validateReleaseTree(PACKAGE_ROOT, {
      release: false,
      hostDiscoveryContract: { document: contract, baseDir: root },
    });
    assert.equal(validation.ok, false);
    assert.match(validation.errors.join('\n'), /host discovery contract.*symlink/i);
  });

  await t.test('review artifact parent', async (t) => {
    const { root, contract, cases } = await createClaimedDiscoveryFixture(t);
    const outside = await mkdtemp(join(tmpdir(), 'grove-review-outside-'));
    t.after(() => rm(outside, { recursive: true, force: true }));
    const reviewBinding = cases[0].evidence.review.artifact;
    await cp(join(root, reviewBinding.path), join(outside, 'independent-review.json'));
    await symlink(outside, join(root, 'review-link'));
    reviewBinding.path = join('review-link', 'independent-review.json');

    const validation = await validateReleaseTree(PACKAGE_ROOT, {
      release: false,
      hostDiscoveryContract: { document: contract, baseDir: root },
    });
    assert.equal(validation.ok, false);
    assert.match(validation.errors.join('\n'), /host discovery contract.*symlink/i);
  });
});
