// Upstream: adr-0048-parsers-are-dependencies (D2 delivery through the
// generate-and-commit pipeline, D4 one hoisted node_modules via workspaces),
// spec-0004-dual-host-distribution@v8 (the exact package-root shape that fixes
// where a bundle may land).
//
// This file covers the delivery machinery adr-0048 needs BEFORE any parser is
// swapped: the workspace root, the ignore rule that keeps the change set
// bounded, and the CI install step. Nothing here imports a third-party parser
// — the runtime still reads its own formats at this point.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { builtinModules } from 'node:module';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import {
  BUNDLED_DEPENDENCIES,
  GENERATED_FILES,
  NOTICES_PATH,
  PARSER_BUNDLE_PATH,
  PARSER_BUNDLE_SOURCE,
} from '../config.mjs';
import {
  buildProjectionSet,
  checkProjectionSet,
  writeProjectionSet,
} from '../lib/generate.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');

// The six packages that carry a suite or a maintainer command today. Declared
// literally: the point of the test is to catch a SEVENTH arriving unregistered,
// which a derived list could never notice.
const KNOWN_WORKSPACE_PACKAGES = Object.freeze([
  'tooling/grove/build',
  'tooling/grove/probes',
  'tooling/grove/release',
  'tooling/grove/tests/dispatch',
  'tooling/grove/tests/gates',
  'tooling/grove/tests/lifecycle',
]);

async function packageManifestDirectories(root, relative = '') {
  const entries = await readdir(join(root, relative), { withFileTypes: true });
  const found = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const child = relative === '' ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) found.push(...(await packageManifestDirectories(root, child)));
    else if (entry.name === 'package.json' && relative !== '') found.push(relative);
  }
  return found;
}

test('adr-0048 D4 — the root manifest declares exactly the six workspace packages, and no package escapes it', async () => {
  const manifest = JSON.parse(
    await readFile(join(REPOSITORY_ROOT, 'package.json'), 'utf8'),
  );
  assert.equal(manifest.private, true, 'the workspace root is never published');
  assert.deepEqual(
    manifest.workspaces,
    [...KNOWN_WORKSPACE_PACKAGES],
    'the declared workspaces are exactly the six known packages, in sorted order',
  );

  // The half a literal list cannot do on its own: a seventh package landing
  // anywhere in the tree without a workspace row installs nothing, so its
  // dependencies resolve by accident or not at all.
  const discovered = (await packageManifestDirectories(REPOSITORY_ROOT)).sort();
  assert.deepEqual(
    discovered,
    [...KNOWN_WORKSPACE_PACKAGES],
    'every package.json in the tree is a declared workspace member',
  );
});

test('adr-0048 D4 — node_modules is ignored BY THE COMMITTED .gitignore, so the derived change set stays bounded', () => {
  // Behavioral, not textual: `git check-ignore -v` reports which ignore SOURCE
  // matched. A rule living in a developer's global excludes or in
  // .git/info/exclude would satisfy a plain check-ignore and ship nothing, so
  // the source is asserted to be the committed file at the repository root.
  // deriveChangeSet builds the change set from `git status --porcelain -uall`
  // (guard-core.mjs); an unignored hoisted install would enter it wholesale.
  for (const candidate of [
    'node_modules',
    'node_modules/yaml/package.json',
    'tooling/grove/build/node_modules/esbuild/lib/main.js',
  ]) {
    const result = spawnSync('git', ['check-ignore', '-v', '--no-index', candidate], {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
    });
    assert.equal(
      result.status,
      0,
      `git check-ignore does not ignore ${candidate}: ${result.stderr ?? result.error?.message ?? ''}`,
    );
    const [source] = String(result.stdout).split(':');
    assert.equal(
      source,
      '.gitignore',
      `${candidate} is ignored by ${source}, not by the committed root .gitignore`,
    );
  }
});

test('adr-0048 D4 — CI installs the workspace before any suite runs, and no longer claims no install is needed', async () => {
  const workflow = await readFile(
    join(REPOSITORY_ROOT, '.github/workflows/grove-tests.yml'),
    'utf8',
  );
  assert.match(
    workflow,
    /^\s+run: npm ci$/m,
    'the test workflow installs the workspace from the committed lockfile',
  );
  // The comment changes with the code: leaving it would document a posture the
  // repository no longer holds.
  assert.doesNotMatch(workflow, /no install step is needed/);
  assert.doesNotMatch(workflow, /All packages are zero-dependency/);

  // The release job runs `npm run check --prefix tooling/grove/build`, which
  // since adr-0048 regenerates the parser bundle to compare its bytes. Without
  // an install it cannot resolve the bundler and fails before validating
  // anything, so the tag job needs the same step.
  const release = await readFile(
    join(REPOSITORY_ROOT, '.github/workflows/release-tag.yml'),
    'utf8',
  );
  const installAt = release.indexOf('run: npm ci');
  const checkAt = release.indexOf('npm run check --prefix tooling/grove/build');
  assert.notEqual(installAt, -1, 'the release job installs the workspace');
  assert.equal(installAt < checkAt, true, 'the install precedes the generation check');
});

test('adr-0048 D4 — the committed lockfile is the install authority npm ci requires', async () => {
  const lock = JSON.parse(
    await readFile(join(REPOSITORY_ROOT, 'package-lock.json'), 'utf8'),
  );
  assert.equal(lock.lockfileVersion >= 3, true, 'npm ci needs a v3+ lockfile');
  for (const workspace of KNOWN_WORKSPACE_PACKAGES) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(lock.packages ?? {}, workspace),
      true,
      `the lockfile resolves the ${workspace} workspace`,
    );
  }
});

// --- adr-0048 D2/D9: the generated third-party parser bundle ---
//
// These four run BEFORE the bundler is configured, deliberately. The obvious
// esbuild invocation produces a bundle that dies at import time from a
// directory with no node_modules, and nothing in the ordinary suite would
// notice: the bundler exits 0 and the bytes look fine.

async function withTemporaryTree(prefix, fn) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function pathExists(candidate) {
  return access(candidate).then(() => true, () => false);
}

test('adr-0048 D2 — two consecutive builds of the parser bundle are byte-identical', async () => {
  const [first, second] = await Promise.all([
    buildProjectionSet({ repoRoot: REPOSITORY_ROOT }),
    buildProjectionSet({ repoRoot: REPOSITORY_ROOT }),
  ]);
  const left = first.get(PARSER_BUNDLE_PATH);
  const right = second.get(PARSER_BUNDLE_PATH);
  assert.equal(typeof left, 'string', `${PARSER_BUNDLE_PATH} is a generated output`);
  assert.notEqual(left.length, 0, 'the bundle is not empty');
  assert.equal(left, right, 'two builds of the same inputs produce the same bytes');
  // The digest gate adr-0048 D2 leans on is only as good as this: if the same
  // inputs could produce different bytes, `--check` would report false drift
  // on every run rather than catching real drift.
  assert.equal(
    first.get(NOTICES_PATH),
    second.get(NOTICES_PATH),
    'the generated notices are equally deterministic',
  );
});

test('adr-0048 D2 — a hand edit to the committed parser bundle fails check mode', async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPOSITORY_ROOT });
  // Ties the fixture to the COMMITTED bytes: if the repository's bundle were
  // already stale, the edit below would be testing something else.
  assert.equal(
    await readFile(join(REPOSITORY_ROOT, PARSER_BUNDLE_PATH), 'utf8'),
    outputs.get(PARSER_BUNDLE_PATH),
    'the committed bundle is current before the edit is made',
  );

  await withTemporaryTree('grove-bundle-check-', async (root) => {
    await writeProjectionSet({ repoRoot: root, outputs });
    const clean = await checkProjectionSet({ repoRoot: root, outputs });
    assert.equal(clean.ok, true, 'a freshly written tree is clean');

    // One byte of hand editing inside third-party code — the exact thing the
    // GENERATED header forbids and a reviewer would never spot in 300 KB.
    const edited = outputs.get(PARSER_BUNDLE_PATH).replace('const require =', 'const require  =');
    assert.notEqual(edited, outputs.get(PARSER_BUNDLE_PATH), 'the edit changed something');
    await writeFile(join(root, PARSER_BUNDLE_PATH), edited);

    const result = await checkProjectionSet({ repoRoot: root, outputs });
    assert.equal(result.ok, false, 'check mode fails on the edit');
    assert.deepEqual(result.stale, [PARSER_BUNDLE_PATH]);
  });
});

test('adr-0048 D2 — the bundle imports and executes from a directory containing NO node_modules', async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPOSITORY_ROOT });
  await withTemporaryTree('grove-bundle-bare-', async (root) => {
    // The whole point is the ABSENCE of a resolvable install. Assert it rather
    // than assume it: a temporary directory nested under a checkout would make
    // this test pass while proving nothing.
    for (let cursor = root; ; cursor = dirname(cursor)) {
      assert.equal(
        await pathExists(join(cursor, 'node_modules')),
        false,
        `${cursor} must not carry a node_modules the bundle could resolve through`,
      );
      if (dirname(cursor) === cursor) break;
    }

    await writeFile(join(root, 'parsers.mjs'), outputs.get(PARSER_BUNDLE_PATH));
    // A REAL .mjs entry file, never `node -e`. Measured: `node -e` installs
    // `require` as a GLOBAL, which satisfies esbuild's
    // `typeof require !== "undefined"` guard and takes the working branch — so
    // the identical check written with `-e` passes on a BROKEN bundle. The
    // shipped invocation is `node <plugin-root>/runtime/dispatch/bin/guard.mjs`,
    // a file, which is what this reproduces.
    await writeFile(join(root, 'probe.mjs'), [
      "import { parseTomlDocument, parseYamlDocument, stringifyTomlDocument } from './parsers.mjs';",
      "process.stdout.write(JSON.stringify({",
      "  toml: parseTomlDocument('a = \"x\"\\nb = [1, 2]\\n'),",
      "  yaml: parseYamlDocument('type: adr\\nimplements:\\n  - a\\n'),",
      "  round: stringifyTomlDocument({ a: 'x' }),",
      "}));",
      '',
    ].join('\n'));

    const result = spawnSync(process.execPath, ['probe.mjs'], {
      cwd: root,
      encoding: 'utf8',
      env: { PATH: process.env.PATH ?? '' },
    });
    assert.equal(
      result.status,
      0,
      `the bundle failed to load with no node_modules: ${result.stderr}`,
    );
    assert.doesNotMatch(String(result.stderr), /Dynamic require/);
    assert.deepEqual(JSON.parse(result.stdout), {
      toml: { a: 'x', b: [1, 2] },
      yaml: { type: 'adr', implements: ['a'] },
      // Measured, and pinned here because step 2 rewrites serializeCursor over
      // it: smol-toml's stringify terminates with a newline of its own.
      round: 'a = "x"\n',
    });
  });
});

test('adr-0048 D2 — the bundle\'s only bare specifiers are node builtins', async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPOSITORY_ROOT });
  const bundle = outputs.get(PARSER_BUNDLE_PATH);
  const specifiers = new Set();
  let callSites = 0;
  for (const pattern of [
    // Any callee whose name ENDS in `require` — esbuild renames the CommonJS
    // shim to `__require` / `__require2`, and a pattern anchored on a plain
    // `\brequire\(` sees none of them. Written that way first, this test saw
    // exactly ONE specifier (`node:module`, from the banner) and was blind to
    // all four of the bundle's real runtime resolutions.
    /[\w$]*[Rr]equire[\w$]*\(\s*["']([^"']+)["']\s*\)/g,
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const match of bundle.matchAll(pattern)) {
      specifiers.add(match[1]);
      callSites += 1;
    }
  }
  const bare = [...specifiers]
    .filter((name) => !name.startsWith('.') && !name.startsWith('/'))
    .sort();
  assert.notEqual(bare.length, 0, 'the scan found specifiers at all');
  // The scan's own coverage, asserted rather than assumed: every CommonJS shim
  // call in the file must be among the call sites the patterns above matched.
  // Without this the test can silently go vacuous the moment the emitted shape
  // changes — which is how it started.
  const shimCalls = [...bundle.matchAll(/__require\d*\(\s*["']/g)].length;
  assert.equal(
    callSites >= shimCalls,
    true,
    `the scan matched ${callSites} call sites but the bundle has ${shimCalls} CommonJS shim calls`,
  );
  const builtins = new Set(builtinModules);
  for (const name of bare) {
    const stripped = name.startsWith('node:') ? name.slice('node:'.length) : name;
    assert.equal(
      builtins.has(stripped),
      true,
      `bundle reaches outside itself for "${name}" — nothing resolves it on a consumer machine`,
    );
  }
});

test('adr-0048 D9 — every bundled dependency carries its licence notice, in NOTICES.md AND in the bundle bytes', async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPOSITORY_ROOT });
  const notices = outputs.get(NOTICES_PATH);
  const bundle = outputs.get(PARSER_BUNDLE_PATH);
  assert.equal(typeof notices, 'string', `${NOTICES_PATH} is a generated output`);

  const lock = JSON.parse(
    await readFile(join(REPOSITORY_ROOT, 'package-lock.json'), 'utf8'),
  );
  // Derived from the lockfile, never from a hand-kept list: the redistributed
  // set is exactly what the build package declares as `dependencies`, and the
  // lockfile is what pins each one's version.
  const declared = lock.packages['tooling/grove/build']?.dependencies ?? {};
  assert.deepEqual(
    Object.keys(declared).sort(),
    [...BUNDLED_DEPENDENCIES].sort(),
    'the declared bundled dependencies match the lockfile',
  );

  for (const name of Object.keys(declared).sort()) {
    const installed = JSON.parse(
      await readFile(join(REPOSITORY_ROOT, 'node_modules', name, 'package.json'), 'utf8'),
    );
    const licenceText = await readFile(
      join(REPOSITORY_ROOT, 'node_modules', name, 'LICENSE'),
      'utf8',
    );
    const copyright = licenceText
      .split('\n')
      .find((line) => /copyright/i.test(line));
    assert.ok(copyright, `${name} ships a copyright line to reproduce`);

    assert.match(notices, new RegExp(`## ${name} ${installed.version.replace(/\./g, '\\.')} — `));
    assert.equal(
      notices.includes(licenceText.trimEnd()),
      true,
      `${NOTICES_PATH} reproduces ${name}'s full licence text`,
    );
    // MEASURED, and the reason this is a test rather than a follow-up: the
    // bundle as first configured carried ZERO occurrences of yaml's ISC
    // notice. smol-toml's BSD-3 notice survived only because upstream happens
    // to put it in a source banner — luck, not compliance. The notices travel
    // with the BYTES, so separating the file from the bundle cannot strip them.
    assert.equal(
      bundle.includes(copyright.trim()),
      true,
      `the bundle bytes carry ${name}'s copyright notice`,
    );
    assert.equal(
      bundle.includes(licenceText.trimEnd()),
      true,
      `the bundle bytes carry ${name}'s full licence text`,
    );
  }
});

test('adr-0048 D2/spec-0004 — the bundle and its notices are declared generated files inside the permitted package shape', async () => {
  // spec-0004:270 fixes the installable package root to an exact entry list and
  // :238 calls it exhaustive, so a new root like runtime/vendor/ would amend
  // the spec and drag an adr-0044 pairing plus a version bump touching every
  // @v8 pin. Landing inside runtime/dispatch/ and reference/ avoids all of it.
  assert.match(PARSER_BUNDLE_PATH, /^plugins\/grove\/runtime\/dispatch\//);
  assert.match(NOTICES_PATH, /^plugins\/grove\/reference\//);
  assert.equal(GENERATED_FILES.includes(PARSER_BUNDLE_PATH), true);
  assert.equal(GENERATED_FILES.includes(NOTICES_PATH), true);

  const outputs = await buildProjectionSet({ repoRoot: REPOSITORY_ROOT });
  const allowlist = JSON.parse(outputs.get('plugins/grove/metadata/package-allowlist.json'));
  const leaves = new Set(allowlist.leaves.map((leaf) => leaf.path));
  assert.equal(leaves.has(PARSER_BUNDLE_PATH), true, 'the bundle is an allowlisted leaf');
  assert.equal(leaves.has(NOTICES_PATH), true, 'the notices file is an allowlisted leaf');

  // The header is the `//` variant — the generator emitted only `<!-- -->` and
  // `#` forms before this, and a .mjs output can carry neither. The second line
  // records the exact dependency and bundler versions because the entry
  // module's digest alone does not determine these bytes (measured: esbuild
  // 0.21.5, 0.25.0 and 0.28.1 produce three different digests from one entry).
  const [header, versions] = outputs.get(PARSER_BUNDLE_PATH).split('\n');
  assert.match(
    header,
    new RegExp(`^// GENERATED — DO NOT EDIT; canonical-source: ${PARSER_BUNDLE_SOURCE}; sha256: [0-9a-f]{64}$`),
  );
  assert.match(versions, /^\/\/ BUNDLED — /);
  for (const name of BUNDLED_DEPENDENCIES) {
    assert.match(versions, new RegExp(`\\b${name} \\d+\\.\\d+\\.\\d+`));
  }
  assert.match(versions, /\besbuild \d+\.\d+\.\d+/);
});
