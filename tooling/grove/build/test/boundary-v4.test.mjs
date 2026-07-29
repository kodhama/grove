// Upstream: spec-0004-dual-host-distribution@v6 INV23–INV27, INV33, INV37; S21–S23, S31, S35.
// Decisions: adr-0031-multi-host-distribution; adr-0035-plugin-and-consumer-boundary;
// adr-0037-pre-execution-planning; adr-0036-remove-retired-review-bookkeeping.
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
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
    'hooks',
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

  assert.equal(claudeAgents.length, 13, 'Claude gets twelve cold-native agents and the scoped dispatcher');
  assert.equal(claudeSkills.length, 6, 'Claude gets the four lifecycle skills plus enter/start (spec-0006)');
  assert.equal(codexSkills.length, 20, 'Codex gets fourteen role skills, four lifecycle skills, and enter/start');
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
  assert.equal(claudeInventory.components.length, 19);
  assert.equal(codexInventory.components.length, 20);
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

test('repository checks retain the five live suites and exclude retired bookkeeping', async () => {
  const [workflow, config, gatesLedger, probesLedger] =
    await Promise.all([
      readFile(join(REPOSITORY_ROOT, '.github/workflows/grove-tests.yml'), 'utf8'),
      readFile(join(REPOSITORY_ROOT, '.grove/config.toml'), 'utf8'),
      readFile(join(REPOSITORY_ROOT, 'tooling/grove/tests/gates/test-deps.yaml'), 'utf8'),
      readFile(join(REPOSITORY_ROOT, 'tooling/grove/probes/test-deps.yaml'), 'utf8'),
    ]);
  for (const text of [workflow, config]) {
    assert.match(text, /tooling\/grove\/probes/);
    assert.doesNotMatch(text, /retired\/review-bookkeeping/);
  }
  // spec-0006 added the dispatch suite as the sixth; the test title keeps its
  // historical name (retitling would churn the exact-pinned canary ledger).
  assert.match(workflow, /six live suites/i);
  assert.match(gatesLedger, /tooling\/grove\/tests\/gates/);
  assert.doesNotMatch(gatesLedger, /plugins\/grove\/gates/);
  assert.match(probesLedger, /spec-0004-dual-host-distribution@v6/);
  assert.match(probesLedger, /adr-0037-pre-execution-planning/);
  await assert.rejects(access(join(REPOSITORY_ROOT, 'retired', 'review-bookkeeping')));
});

test('spec-0005 AC7/AC13/AC15 — stock ledgers and config use canonical schema-2 bytes', async () => {
  const expected = new Map([
    ['tooling/grove/build/test-deps.yaml', `schema: 2
groups:
  "adr-0048-dependency-delivery":
    precision: exact
    tests:
      - file: "test/dependency-delivery.test.mjs"
        cases:
          - title:
              - "adr-0048 D2 — a hand edit to the committed parser bundle fails check mode"
          - title:
              - "adr-0048 D2 — the bundle imports and executes from a directory containing NO node_modules"
          - title:
              - "adr-0048 D2 — the bundle's only bare specifiers are node builtins"
          - title:
              - "adr-0048 D2 — two consecutive builds of the parser bundle are byte-identical"
          - title:
              - "adr-0048 D2/spec-0004 — the bundle and its notices are declared generated files inside the permitted package shape"
          - title:
              - "adr-0048 D4 — CI installs the workspace before any suite runs, and no longer claims no install is needed"
          - title:
              - "adr-0048 D4 — node_modules is ignored BY THE COMMITTED .gitignore, so the derived change set stays bounded"
          - title:
              - "adr-0048 D4 — the committed lockfile is the install authority npm ci requires"
          - title:
              - "adr-0048 D4 — the root manifest declares exactly the six workspace packages, and no package escapes it"
          - title:
              - "adr-0048 D9 — every bundled dependency carries its licence notice, in NOTICES.md AND in the bundle bytes"
      - file: "test/generate.test.mjs"
        cases:
          - title:
              - "all projections are marked, source-addressed, and native ids are unique underscore forms"
          - title:
              - "configured roots are explicit and do not include plugin custom-agent TOML"
    specs:
      - "spec-0004-dual-host-distribution@v8"
    decisions:
      - "adr-0048-parsers-are-dependencies"
    notes: "The delivery machinery, and the two legacy declarations adr-0048 TOUCHED — the fourth canonical source and the GENERATED_FILES registration — which adr-0043 requires be selected exactly rather than left to coarse scope. The spec-0004 pin is the package-root shape that fixes where the bundle may land, not a claim that the spec governs the workspace root."
  "legacy-package":
    precision: coarse
    tests:
      - file: "test/boundary-v4.test.mjs"
      - file: "test/generate.test.mjs"
    specs:
      - "spec-0004-dual-host-distribution@v6"
    decisions:
      - "adr-0031-multi-host-distribution"
      - "adr-0032-status-emission-belongs-to-wisp"
      - "adr-0035-plugin-and-consumer-boundary"
      - "adr-0036-remove-retired-review-bookkeeping"
      - "adr-0037-pre-execution-planning"
    covers:
      - "INV1"
      - "INV17"
      - "INV2"
      - "INV20"
      - "INV23–INV28"
      - "INV33"
      - "INV37–INV41"
      - "INV5–INV7"
      - "S1"
      - "S15"
      - "S18"
      - "S2"
      - "S21–S24"
      - "S31"
      - "S35–S39"
    notes: "This package owns the metadata-only role inventory and deterministic Claude/Codex projections generated from canonical charters."
  "spec-0005-canary":
    precision: exact
    tests:
      - file: "test/boundary-v4.test.mjs"
        cases:
          - title:
              - "lifecycle ledger carries the required schema row and release CLI consumes the discovery contract"
          - title:
              - "repository checks retain the five live suites and exclude retired bookkeeping"
          - title:
              - "spec-0005 AC1–AC4/AC9/AC12–AC16 — writer, selectors, pins, and serialization stay explicit"
          - title:
              - "spec-0005 AC5/AC6/AC10/AC11 — reader modes, routing, and drift precision stay explicit"
          - title:
              - "spec-0005 AC7/AC13/AC15 — stock ledgers and config use canonical schema-2 bytes"
      - file: "test/generate.test.mjs"
        cases:
          - title:
              - "spec-0005 AC7/S24 — structured canary contracts propagate from all six authored sources"
    specs:
      - "spec-0005-structured-test-dependency-canary@v1"
      - "spec-0006-voluntary-dispatch@v3"
    decisions:
      - "adr-0043-structured-test-dependency-canary"
    covers:
      - "AC13"
      - "AC15"
      - "AC7"
      - "S23"
      - "S25"
      - "S26"
  "spec-0006-entry-generation":
    precision: exact
    tests:
      - file: "test/boundary-v4.test.mjs"
        cases:
          - title:
              - "INV23–INV25/S21 — the installable package has the exact permitted root shape"
          - title:
              - "INV26–INV27 — generated host isolation is a precondition, not S22/S23 live discovery evidence"
      - file: "test/generate.test.mjs"
        cases:
          - title:
              - "INV1 — both hosts ship enter and start, model-invocable, config-declared descriptions"
          - title:
              - "INV22/INV23 — the floor extract is the marker span verbatim and the FIRST body content, both hosts both verbs"
          - title:
              - "INV26 — Codex entry skills carry the EXACT disclosure line; Claude do not; both carry the pointers and the per-handover guard duty"
          - title:
              - "S12 — editing the floor span changes all four entry skills; unrelated projections stay byte-identical"
          - title:
              - "S12/INV23 — a direct edit to a generated entry skill fails check mode; two builds are byte-identical"
          - title:
              - "S13/INV22 — marker, slug, and budget violations fail generation naming the violation"
          - title:
              - "entry skills join the host inventories as entry-class components"
    specs:
      - "spec-0004-dual-host-distribution@v8"
      - "spec-0006-voluntary-dispatch@v3"
    decisions:
      - "adr-0046-how-dispatch-rules-reach-a-session"
`],
    ['tooling/grove/probes/test-deps.yaml', `schema: 2
groups:
  "legacy-package":
    precision: coarse
    tests:
      - file: "test/probe-boundary-v4.test.mjs"
    specs:
      - "spec-0004-dual-host-distribution@v6"
    decisions:
      - "adr-0031-multi-host-distribution"
      - "adr-0035-plugin-and-consumer-boundary"
      - "adr-0036-remove-retired-review-bookkeeping"
      - "adr-0037-pre-execution-planning"
    covers:
      - "INV20"
      - "INV23"
      - "INV26–INV27"
      - "INV32"
      - "INV37"
      - "S18"
      - "S22–S23"
      - "S30"
      - "S35"
    notes: "This package owns isolated support-probe preparation, hash-bound non-interactive preflight, static package-composition smoke, and the release-blocking external clean-install discovery contract."
`],
    ['tooling/grove/release/test-deps.yaml', `schema: 2
groups:
  "legacy-package":
    precision: coarse
    tests:
      - file: "test/boundary-v4.test.mjs"
      - file: "test/release.test.mjs"
    specs:
      - "spec-0004-dual-host-distribution@v6"
    decisions:
      - "adr-0031-multi-host-distribution"
      - "adr-0032-status-emission-belongs-to-wisp"
      - "adr-0035-plugin-and-consumer-boundary"
      - "adr-0036-remove-retired-review-bookkeeping"
      - "adr-0037-pre-execution-planning"
    notes: "This package validates Grove's shared release identity, dual-host manifests, surface-support claims, generated support documentation, and immutable-tag behavior."
`],
    ['tooling/grove/tests/gates/test-deps.yaml', `schema: 2
groups:
  "adr-0048-parsers-are-dependencies":
    precision: exact
    tests:
      - file: "test/profile.test.mjs"
        cases:
          - title:
              - "adr-0048 — a byte-order mark now makes gates.toml UNREADABLE, disclosed rather than stripped"
          - title:
              - "adr-0048 D1 — a TOML-legal document outside the declared gates.toml shape THROWS at parse"
          - title:
              - "adr-0048 D3 — a legal TOML spelling the line reader could not read is now read correctly"
          - title:
              - "adr-0048 D3/F1 — the floor is the floor however the profile is spelled"
          - title:
              - "adr-0048 D8 — a TOML-legal but schema-invalid profile still routes through the LOUD guardian fallback"
          - title:
              - "parseGatesToml rejects a DUPLICATE key within a section (fail-closed, now by the PARSER)"
    decisions:
      - "adr-0048-parsers-are-dependencies"
    notes: "The declarations touched or added when the hand-rolled gates.toml line reader was replaced by the bundled TOML parser plus a grove-owned shape check (adr-0043: a touched declaration may not rely on coarse scope). The rest of this package stays coarse as untouched legacy."
  "legacy-package":
    precision: coarse
    tests:
      - file: "test/profile.test.mjs"
      - file: "test/resolve-profile.test.mjs"
    decisions:
      - "adr-0018-gate-profile-and-trigger-split"
      - "adr-0021-gate-profile-self-adoption"
    covers:
      - "adr-0018 D3"
      - "adr-0018 D4"
      - "adr-0018 D7"
      - "adr-0018 D8"
      - "adr-0018 Floor F1"
      - "adr-0021 D2"
    notes: "This package under tooling/grove/tests/gates/ verifies the gate-profile machinery shipped at plugins/grove/runtime/gates/: preset expansion, the intent-locus floor validator, the gates.toml reader, the load-time guardian fallback, and runtime_dir behavior. Every lib/*.mjs and bin/*.mjs under this root belongs to this package."
`],
    ['tooling/grove/tests/lifecycle/test-deps.yaml', `schema: 2
groups:
  "adr-0048-toml-is-a-dependency":
    precision: exact
    tests:
      - file: "test/surface-and-setup.test.mjs"
        cases:
          - title:
              - "adr-0048 — the config writer round-trips every declared token shape, scalar and list"
          - title:
              - "adr-0048 D3 — a config value TOML cannot express is a REFUSAL, never a broken file"
          - title:
              - "adr-0048 D3 — serializeConfig emits TOML, so a DEL byte is escaped instead of written raw"
      - file: "test/refresh-profile-remove.test.mjs"
        cases:
          - title:
              - "adr-0048 — a quoted gate KEY reads fine and still fails at seedPreset: the writer is a NAMED remaining gap"
          - title:
              - "adr-0048 — an unparseable gates.toml is a reported REFUSAL, never a throw out of the planner"
          - title:
              - "adr-0048 — set-profile READS a gates.toml the old line reader called an invalid gate row"
    decisions:
      - "adr-0048-parsers-are-dependencies"
    notes: "parseProfile reads the gate profile through the bundled TOML parser and serializeConfig writes .grove/config.toml through it; the closed gate-row enum, the value enum, the floor rule, the config-token contract and the pre-write round-trip probe stay hand-written (adr-0048 D1). One case records a gap rather than a pass: seedPreset is still a hand-rolled TOML writer, kept deliberately because re-serializing would delete the consumer-authoritative comments in .grove/gates.toml."
  "adr-0041-shipped-matrix":
    precision: exact
    tests:
      - file: "test/shipped-matrix.test.mjs"
    specs:
      - "spec-0004-dual-host-distribution@v8"
    decisions:
      - "adr-0041-separate-support-from-operational-availability"
  "legacy-package":
    precision: coarse
    tests:
      - file: "test/boundary-v4.test.mjs"
      - file: "test/entrypoint.test.mjs"
      - file: "test/refresh-profile-remove.test.mjs"
      - file: "test/surface-and-setup.test.mjs"
    specs:
      - "spec-0004-dual-host-distribution@v6"
    decisions:
      - "adr-0031-multi-host-distribution"
      - "adr-0032-status-emission-belongs-to-wisp"
      - "adr-0035-plugin-and-consumer-boundary"
      - "adr-0036-remove-retired-review-bookkeeping"
      - "adr-0037-pre-execution-planning"
    notes: "Technical orientation: these tests use the Node.js built-in test runner and filesystem APIs."
  "spec-0006-confirm-gate":
    precision: exact
    tests:
      - file: "test/surface-and-setup.test.mjs"
        cases:
          - title:
              - "BLOCK-1 — a duplicated action id is refused: one confirmation never licenses two writes"
          - title:
              - "BLOCK-1 — an action id that does not recompute from its own type and path is refused"
    specs:
      - "spec-0006-voluntary-dispatch@v3"
    decisions:
      - "adr-0046-how-dispatch-rules-reach-a-session"
    covers:
      - "INV5"
  "spec-0006-pointer-block":
    precision: exact
    tests:
      - file: "test/boundary-v4.test.mjs"
        cases:
          - title:
              - "INV30/S26 — setup creates only the thin consumer floor and the invoking host loader"
          - title:
              - "spec-0006 INV24 — the pointer block is exactly four lines with host-correct invocations from adapter metadata"
          - title:
              - "spec-0006 INV24 — the pointer invocations come from adapter metadata, never a hardcoded literal"
      - file: "test/surface-and-setup.test.mjs"
        cases:
          - title:
              - "Claude and Codex setup in either order share one floor and are idempotent"
    specs:
      - "spec-0004-dual-host-distribution@v8"
      - "spec-0006-voluntary-dispatch@v3"
    decisions:
      - "adr-0046-how-dispatch-rules-reach-a-session"
`],
  ]);

  for (const [relativePath, bytes] of expected) {
    assert.equal(
      await readFile(join(REPOSITORY_ROOT, relativePath), 'utf8'),
      bytes,
      relativePath,
    );
    await assert.rejects(
      access(join(REPOSITORY_ROOT, relativePath.replace(/\.yaml$/, '.md'))),
      undefined,
      `${relativePath} has no legacy peer`,
    );
  }

  const config = await readFile(join(REPOSITORY_ROOT, '.grove/config.toml'), 'utf8');
  assert.match(
    config,
    /TEST_DEPS_LEDGER = "walk deepest ancestor first; at each directory select test-deps\.yaml before test-deps\.md; stop at the first directory containing either, so nearer legacy beats farther canonical; treat test-deps\.md as read-only legacy fallback; verify the selected carrier on use"/,
  );
});

test('spec-0005 AC1–AC4/AC9/AC12–AC16 — writer, selectors, pins, and serialization stay explicit', async () => {
  const [executor, relations, versioning] = (
    await Promise.all(
      ['executor', 'relations', 'versioning'].map((name) =>
        readFile(join(REPOSITORY_ROOT, 'charters', `${name}.md`), 'utf8')),
    )
  ).map((text) => text.replace(/\s+/g, ' '));

  assert.doesNotMatch(
    executor,
    /Every test names its upstream.*header\/describe block/i,
  );
  assert.doesNotMatch(
    executor,
    /keep a per-package test-deps ledger/i,
  );
  assert.match(
    executor,
    /inline provenance.*fallback.*validated exact external membership/i,
  );
  assert.match(
    executor,
    /canary absence.*valid advisory state/i,
  );

  for (const required of [
    /deepest|nearest/i,
    /canonical.*same directory|same directory.*canonical/i,
    /schema 2/i,
    /unknown fields/i,
    /package root.*existing.*convention/i,
    /landed basis/i,
    /new or touched declaration.*exact/i,
    /legacy-package.*coarse/i,
    /technical.*decision.*defect.*note/i,
    /semantic.*frontmatter/i,
    /deletes? `?test-deps\.md`?.*after.*valid/i,
    /no well-formed.*all.*exact|all.*exact.*no well-formed/i,
    /neither carrier.*every discovered/i,
    /same package root.*reconcile/i,
    /file-only exact/i,
    /coarse groups? use (?:only )?file-only (?:test )?selectors and never contain `cases`/i,
    /complete title/i,
    /more than one exact group/i,
    /split.*whole-file.*lacks an upstream/i,
    /deterministic.*byte-stable/i,
    /UTF-8.*byte-order mark/i,
    /top-level fields.*`schema`.*`groups`.*in that order/i,
    /group names.*Unicode scalar/i,
    /group fields.*`precision`.*`tests`.*`specs`.*`decisions`.*`defects`.*`covers`.*`notes`.*in that order/i,
    /test selectors.*`file`.*canonical case-list representation.*absent `cases`.*empty sequence.*sorts before/i,
    /`file` precedes `cases`/i,
    /case selectors.*complete title arrays/i,
    /title segment order.*outermost-to-innermost.*never sorted/i,
    /`specs`, `decisions`, `defects`, and `covers`.*lexicographically/i,
    /first physical line.*`schema: 2`.*second.*`groups:`.*first group.*third/i,
    /nested collection.*`:`.*LF.*scalar.*`: `.*LF/i,
    /sequence entry.*`-`.*one ASCII space/i,
    /`file` and `title`.*same physical line.*sequence dash/i,
    /following group.*immediately after.*preceding group/i,
    /file ends immediately after.*LF/i,
    /`"` is `\\"`.*`\\` is `\\\\`.*solidus is not escaped/i,
    /U\+0008.*`\\b`.*U\+0009.*`\\t`.*U\+000A.*`\\n`.*U\+000C.*`\\f`.*U\+000D.*`\\r`/i,
    /U\+0000–U\+001F.*`\\u00XX`.*uppercase/i,
    /U\+007F–U\+009F.*`\\u00XX`.*uppercase/i,
    /U\+2028.*`\\u2028`.*U\+2029.*`\\u2029`/i,
    /Unicode scalar/i,
    /U\+FFFE.*U\+FFFF.*unpaired/i,
  ]) {
    assert.match(executor, required);
  }

  assert.match(relations, /advisory provenance and canary data/i);
  assert.match(relations, /not.*scalar `implements:`.*general `depends_on`/i);
  assert.match(relations, /`specs`, `decisions`, and `defects`/i);
  assert.match(relations, /`covers` and `notes`.*not.*upstream/i);
  assert.doesNotMatch(
    relations,
    /code.*names its spec.*test-deps ledger/i,
  );

  for (const required of [
    /last-reviewed target/i,
    /candidate pin/i,
    /lagging.*re-derivation/i,
    /equal.*proves no conformance/i,
    /ahead.*invalid/i,
    /manifest-only/i,
    /independent conformance review/i,
    /whole coarse scope/i,
    /append-only decision.*without.*version/i,
  ]) {
    assert.match(versioning, required);
  }
});

test('spec-0005 AC5/AC6/AC10/AC11 — reader modes, routing, and drift precision stay explicit', async () => {
  const [reviewer, dispatcher, validator] = (
    await Promise.all(
      ['conformance-reviewer', 'dispatcher', 'validator'].map((name) =>
        readFile(join(REPOSITORY_ROOT, 'charters', `${name}.md`), 'utf8')),
    )
  ).map((text) => text.replace(/\s+/g, ' '));

  for (const mode of [
    'canonical/exact',
    'canonical/coarse',
    'legacy/coarse',
    'inferred',
  ]) {
    assert.match(reviewer, new RegExp(mode.replace('/', '\\/')));
  }
  for (const required of [
    /subject.*walk.*repository root.*deepest.*first/i,
    /same directory.*`test-deps\.yaml`.*before.*`test-deps\.md`/i,
    /nearer legacy.*farther canonical/i,
    /top-level.*exactly.*`schema`.*`groups`/i,
    /`schema`.*integer `2`/i,
    /`groups`.*non-empty mapping.*unique.*non-empty/i,
    /group.*only.*`precision`.*`tests`.*`specs`.*`decisions`.*`defects`.*`covers`.*`notes`/i,
    /at least one of `specs`, `decisions`, or `defects`.*non-empty/i,
    /test selector.*exactly.*`file`.*optional `cases`/i,
    /case selector.*exactly.*`title`.*non-empty array.*non-empty strings/i,
    /coarse.*file-only.*never.*`cases`/i,
    /every discovered.*exact.*coarse/i,
    /new or touched.*exact/i,
    /only `specs`.*version canar/i,
    /decisions.*without `@version`/i,
    /ahead-of-current.*invalid/i,
    /U\+FFFE.*U\+FFFF.*unpaired/i,
    /unknown fields.*duplicate.*malformed/i,
    /absolute paths.*globs.*partial-title.*malformed/i,
    /nonexistent test files.*ambiguous exact.*malformed/i,
    /changed tests?.*new or touched.*select/i,
    /changed code.*independently.*affected test/i,
    /ledger membership.*does not decide/i,
    /absence.*may.*PASS/i,
    /legacy.*may.*PASS/i,
    /coarse.*may.*PASS/i,
    /no well-formed.*inferred/i,
    /cannot independently establish an approved upstream.*FAIL/i,
    /malformed canonical.*ledger integrity.*FAIL/i,
    /Fidelity:.*Ledger integrity:.*Overall:/i,
    /dual presence.*canonical.*read basis/i,
    /never.*union/i,
    /manifest-only.*implementation and tests/i,
  ]) {
    assert.match(reviewer, required);
  }

  assert.match(
    dispatcher,
    /routes? changed code and tests.*canonical.*legacy.*absent.*dual.*malformed/i,
  );
  assert.match(dispatcher, /ledger presence never decides.*conformance/i);

  for (const required of [
    /read-only/i,
    /subject.*walk.*repository root.*deepest.*first/i,
    /same (?:package )?root.*`test-deps\.yaml`.*before.*`test-deps\.md`/i,
    /nearer legacy.*farther canonical/i,
    /dual presence.*canonical.*never.*union/i,
    /strict schema-2.*group.*selector.*pin/i,
    /before any precision claim.*every discovered static test declaration.*at least one exact or coarse group.*new or touched.*exact coverage/i,
    /uncovered declarations.*malformed.*unobservable.*no fallback.*precision claim/i,
    /malformed canonical.*integrity.*unobservable/i,
    /malformed canonical.*(?:never|not).*fall(?:s|ing)? back.*precision/i,
    /exact canonical.*precisely/i,
    /coarse canonical.*legacy.*coarse/i,
    /no ledger.*unobservable/i,
    /never advances? (?:a )?pin/i,
    /never.*conformance verdict/i,
    /cannot discover.*absent consumer/i,
  ]) {
    assert.match(validator, required);
  }
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
    readFile(join(REPOSITORY_ROOT, 'tooling/grove/tests/lifecycle/test-deps.yaml'), 'utf8'),
    readFile(join(REPOSITORY_ROOT, 'tooling/grove/release/bin/validate-release.mjs'), 'utf8'),
    readFile(join(REPOSITORY_ROOT, '.github/workflows/release-tag.yml'), 'utf8'),
  ]);
  assert.match(ledger, /^schema: 2$/m);
  assert.match(releaseCli, /host-discovery-contract\.json/);
  assert.match(workflow, /check:release/);
});
