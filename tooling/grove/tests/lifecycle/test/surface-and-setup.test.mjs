// Upstream: spec-0004-dual-host-distribution@v6 INV8, INV9, INV13, INV17,
// INV19, INV30, INV33, INV35-INV37; S5, S6, S13, S17, S26, S31, S33-S35.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  applyPlan,
  planSetup,
} from '../../../../../plugins/grove/runtime/lifecycle/lib/lifecycle.mjs';
import { parseTomlDocument } from '../../../../../plugins/grove/runtime/dispatch/lib/parsers.mjs';
import { fixture, claudeInvocation, codexInvocation } from './helpers.mjs';

const exists = async (path) => stat(path).then(() => true, () => false);

test('invalid and unsupported invocation records fail before every write', async () => {
  for (const surface of [
    null,
    { surface_id: 'missing', provenance: 'user-explicit' },
    { surface_id: 'claude-interactive', provenance: 'user-explicit' },
    { surface_id: 'codex-exec-non-ephemeral', provenance: 'host-runtime' },
    { surface_id: 'codex-exec-ephemeral', provenance: 'user-explicit' },
  ]) {
    const { packageRoot, repoRoot } = await fixture();
    const before = await readdir(repoRoot);
    const plan = await planSetup({
      packageRoot,
      repoRoot,
      host: 'codex',
      surface,
      choices: { preset: 'steward', config: {} },
    });
    assert.equal(plan.ok, false);
    assert.match(plan.summary, /valid codex surface ids/i);
    assert.deepEqual(plan.actions, []);
    assert.deepEqual(await readdir(repoRoot), before);
  }
});

test('setup rejects unknown config tokens and wrong list-token shapes before writes', async () => {
  for (const config of [
    { UNKNOWN_TOKEN: 'value' },
    { ARTIFACT_DIRS: 'decisions/' },
    { TEST_CMD: ['npm test'] },
  ]) {
    const { packageRoot, repoRoot } = await fixture();
    const plan = await planSetup({
      packageRoot,
      repoRoot,
      ...claudeInvocation,
      choices: { preset: 'steward', config },
    });
    assert.equal(plan.ok, false);
    assert.match(plan.summary, /config token|list token|scalar token/i);
    assert.deepEqual(plan.actions, []);
    assert.deepEqual(await readdir(repoRoot), []);
  }
});

test('Claude and Codex setup in either order share one floor and are idempotent', async () => {
  for (const invocations of [
    [claudeInvocation, codexInvocation],
    [codexInvocation, claudeInvocation],
  ]) {
    const { packageRoot, repoRoot } = await fixture();
    for (const invocation of invocations) {
      const plan = await planSetup({
        packageRoot,
        repoRoot,
        ...invocation,
        choices: { preset: 'steward', config: { TEST_CMD: 'npm test' } },
      });
      assert.equal(plan.ok, true, plan.summary);
      assert.match(plan.summary, new RegExp(invocation.surface.surface_id));
      assert.match(plan.summary, /user-explicit/);
      await applyPlan(plan, { confirmedActionIds: plan.actions.map((a) => a.id) });
    }

    const snapshot = {
      gates: await readFile(join(repoRoot, '.grove', 'gates.toml'), 'utf8'),
      config: await readFile(join(repoRoot, '.grove', 'config.toml'), 'utf8'),
      claude: await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8'),
      codex: await readFile(join(repoRoot, 'AGENTS.md'), 'utf8'),
      launcher: await readFile(join(repoRoot, '.codex', 'agents', 'grove_executor.toml'), 'utf8'),
      planner: await readFile(
        join(repoRoot, '.codex', 'agents', 'grove_implementation_planner.toml'),
        'utf8',
      ),
    };
    // spec-0006 INV24: the carrier holds only the pointer block.
    assert.match(snapshot.claude, /\/grove:start/);
    assert.match(snapshot.claude, /\/grove:enter/);
    assert.match(snapshot.codex, /grove:start/);
    assert.match(snapshot.codex, /grove:enter/);
    assert.doesNotMatch(snapshot.claude, /reference\/charters/);
    assert.doesNotMatch(snapshot.codex, /role-dispatcher|role-shaper/);
    assert.match(snapshot.planner, /name = "grove_implementation_planner"/);
    assert.doesNotMatch(JSON.stringify(snapshot), /grove-status|status emission/i);
    assert.equal((snapshot.claude.match(/grove:begin/g) ?? []).length, 1);
    assert.equal((snapshot.codex.match(/grove:begin/g) ?? []).length, 1);

    for (const invocation of invocations) {
      const rerun = await planSetup({
        packageRoot,
        repoRoot,
        ...invocation,
        choices: { preset: 'guardian', config: { TEST_CMD: 'wrong' } },
      });
      assert.equal(rerun.ok, true);
      await applyPlan(rerun, { confirmedActionIds: rerun.actions.map((a) => a.id) });
    }
    assert.equal(await readFile(join(repoRoot, '.grove', 'gates.toml'), 'utf8'), snapshot.gates);
    assert.equal(await readFile(join(repoRoot, '.grove', 'config.toml'), 'utf8'), snapshot.config);
    assert.equal(await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8'), snapshot.claude);
    assert.equal(await readFile(join(repoRoot, 'AGENTS.md'), 'utf8'), snapshot.codex);
    assert.equal(await readFile(join(repoRoot, '.codex', 'agents', 'grove_executor.toml'), 'utf8'), snapshot.launcher);
    assert.equal(
      await readFile(
        join(repoRoot, '.codex', 'agents', 'grove_implementation_planner.toml'),
        'utf8',
      ),
      snapshot.planner,
    );
  }
});

test('setup preserves unrelated instruction text, the other host, and launcher collisions', async () => {
  const { packageRoot, repoRoot } = await fixture();
  await mkdir(join(repoRoot, '.codex', 'agents'), { recursive: true });
  await writeFile(join(repoRoot, 'AGENTS.md'), '# Consumer rules\n');
  await writeFile(join(repoRoot, 'CLAUDE.md'), '# Claude consumer rules\n');
  await writeFile(join(repoRoot, '.codex', 'agents', 'grove_executor.toml'), '# consumer-owned\n');

  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    choices: { preset: 'steward', config: {} },
  });
  assert.equal(plan.ok, true);
  assert.ok(plan.refusals.some((item) => item.path.endsWith('grove_executor.toml')));
  await applyPlan(plan, { confirmedActionIds: plan.actions.map((a) => a.id) });

  assert.equal(await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8'), '# Claude consumer rules\n');
  assert.match(await readFile(join(repoRoot, 'AGENTS.md'), 'utf8'), /^# Consumer rules\n/);
  assert.equal(
    await readFile(join(repoRoot, '.codex', 'agents', 'grove_executor.toml'), 'utf8'),
    '# consumer-owned\n',
  );
  assert.equal(await exists(join(repoRoot, '.codex', 'agents', 'grove_dispatcher_advisor.toml')), true);
});

test('apply revalidates the whole plan before writes and refuses a post-plan launcher collision', async () => {
  const { packageRoot, repoRoot } = await fixture();
  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    choices: { preset: 'steward', config: {} },
  });
  await mkdir(join(repoRoot, '.codex', 'agents'), { recursive: true });
  const collision = join(repoRoot, '.codex', 'agents', 'grove_executor.toml');
  await writeFile(collision, '# consumer arrived after planning\n');

  await assert.rejects(
    () => applyPlan(plan, { confirmedActionIds: plan.actions.map((action) => action.id) }),
    /changed after planning/i,
  );
  assert.equal(await readFile(collision, 'utf8'), '# consumer arrived after planning\n');
  assert.equal(await exists(join(repoRoot, '.grove', 'README.md')), false);
  assert.equal(await exists(join(repoRoot, 'AGENTS.md')), false);
});

// --- BLOCK-1: apply authorizes by action id, but writes to action.path ---
// Both CLIs read the plan from a caller-supplied JSON file and the ids are
// computed once, at plan time. So the id must be rechecked against the action
// it rides on, and no two actions may share one — otherwise one confirmed id
// licenses a second, undisclosed write anywhere in the repository. Case list
// DERIVED FROM the authorization mechanism itself (`confirmed.has(action.id)`
// against `safeTarget(plan.repoRoot, action.path)`), not from the branch a
// reviewer happened to demonstrate it on: the two ways an id can stop naming
// its own action are that it lies about type/path, or that it repeats.

test('BLOCK-1 — a duplicated action id is refused: one confirmation never licenses two writes', async () => {
  const { packageRoot, repoRoot } = await fixture();
  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    choices: { preset: 'steward', config: {} },
  });
  assert.equal(plan.ok, true, plan.summary);
  const licensed = plan.actions[0];
  // A second action, same id, DIFFERENT content: identical type and path, so
  // recomputing the id alone would not catch it.
  plan.actions.push({
    type: licensed.type,
    path: licensed.path,
    content: 'smuggled second write\n',
    expected: licensed.expected,
    id: licensed.id,
  });

  await assert.rejects(
    () => applyPlan(plan, { confirmedActionIds: plan.actions.map((action) => action.id) }),
    (error) => /duplicate lifecycle action id/i.test(error.message)
      && error.message.includes(licensed.id),
  );
  assert.equal(await exists(join(repoRoot, '.grove', 'README.md')), false, 'nothing was applied');
  assert.equal(await exists(join(repoRoot, 'CLAUDE.md')), false);
});

test('BLOCK-1 — an action id that does not recompute from its own type and path is refused', async () => {
  const { packageRoot, repoRoot } = await fixture();
  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    choices: { preset: 'steward', config: {} },
  });
  assert.equal(plan.ok, true, plan.summary);
  const licensed = plan.actions[0];
  plan.actions.push({
    type: 'write',
    path: '.github/workflows/pwn.yml',
    content: 'on: push\n',
    expected: { kind: 'file', content: null },
    id: licensed.id, // the id names the licensed cursor path, the write does not
  });

  await assert.rejects(
    // Confirming ONLY the disclosed id — exactly what a human at the confirm
    // gate sees and approves.
    () => applyPlan(plan, { confirmedActionIds: [licensed.id] }),
    (error) => /does not match its own type and path/i.test(error.message)
      && error.message.includes('.github/workflows/pwn.yml'),
  );
  assert.equal(await exists(join(repoRoot, '.github', 'workflows', 'pwn.yml')), false);
  assert.equal(await exists(join(repoRoot, '.grove', 'README.md')), false, 'nothing was applied');

  // A non-canonical path cannot smuggle the same lie past normalization.
  const nonCanonical = { ...plan.actions[1], path: './evil.txt', id: 'write:./evil.txt' };
  plan.actions[1] = nonCanonical;
  await assert.rejects(
    () => applyPlan(plan, { confirmedActionIds: [licensed.id] }),
    /path is not canonical/i,
  );
  assert.equal(await exists(join(repoRoot, 'evil.txt')), false);
});

test('apply refuses a symlinked managed parent before any write can escape the repository', async () => {
  const { root, packageRoot, repoRoot } = await fixture();
  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...codexInvocation,
    choices: { preset: 'steward', config: {} },
  });
  const outside = join(root, 'outside');
  await mkdir(join(repoRoot, '.codex'), { recursive: true });
  await mkdir(outside);
  await symlink(outside, join(repoRoot, '.codex', 'agents'));

  await assert.rejects(
    () => applyPlan(plan, { confirmedActionIds: plan.actions.map((action) => action.id) }),
    /symbolic link/i,
  );
  assert.equal(await exists(join(outside, 'grove_executor.toml')), false);
  assert.equal(await exists(join(repoRoot, '.grove', 'README.md')), false);
});


// --- adr-0048 D1/D3: the config writer is the library's, not a JSON escaper ---

test('adr-0048 D3 — serializeConfig emits TOML, so a DEL byte is escaped instead of written raw', async () => {
  // THE MEASURED DEFECT. `serializeConfig` built its strings with
  // `JSON.stringify`, which is a JSON escaper, not a TOML one. The sets differ
  // in exactly one direction that matters here: TOML forbids raw U+007F (DEL)
  // inside a basic string and JSON.stringify does NOT escape it, so a config
  // value carrying a DEL produced a `.grove/config.toml` that grove's own
  // reader cannot parse — written to the consumer's repository through the
  // confirm gate, and only discovered on the next read.
  const { packageRoot, repoRoot } = await fixture();
  const value = `npm test${String.fromCharCode(0x7f)}--silent`;
  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    choices: { preset: 'steward', config: { TEST_CMD: value } },
  });
  assert.equal(plan.ok, true, plan.summary);
  const write = plan.actions.find((action) => action.path === '.grove/config.toml');
  assert.ok(write, 'setup plans a config.toml write');
  const parsed = parseTomlDocument(write.content);
  assert.equal(parsed.TEST_CMD, value, 'the DEL survives the round trip verbatim');
});

test('adr-0048 D3 — a config value TOML cannot express is a REFUSAL, never a broken file', async () => {
  // A CORRECTION TO THIS COMMIT'S OWN FIRST CLAIM, kept rather than quietly
  // rewritten. The swap was expected to close this class by itself: a lone
  // surrogate is not a Unicode scalar value, so no TOML string can hold one.
  // MEASURED: smol-toml emits `"\ud800"` anyway, exactly as JSON.stringify
  // did, so the library alone leaves the same broken file on disk. What closes
  // it is the hand-written round-trip probe — serialize, parse the result
  // back, compare — which is grove's own contract, not the format's, and the
  // same shape run.mjs already uses before writing a cursor field. The plan
  // refuses BEFORE any write.
  const { packageRoot, repoRoot } = await fixture();
  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    choices: { preset: 'steward', config: { TEST_CMD: `a${String.fromCharCode(0xd800)}b` } },
  });
  assert.equal(plan.ok, false);
  assert.match(plan.summary, /config/i);
  assert.deepEqual(plan.actions, []);
  assert.deepEqual(await readdir(repoRoot), []);
});

test('adr-0048 — the config writer round-trips every declared token shape, scalar and list', async () => {
  const { packageRoot, repoRoot } = await fixture();
  const config = {
    // Deliberately unsorted at the call site: the writer sorts, and the round
    // trip must not depend on the caller's key order.
    TEST_CMD: 'npm test && echo "done" \\ path\tafter\nline',
    ARTIFACT_DIRS: ['decisions/', 'specs/', 'a "quoted" dir/'],
  };
  const plan = await planSetup({
    packageRoot,
    repoRoot,
    ...claudeInvocation,
    choices: { preset: 'steward', config },
  });
  assert.equal(plan.ok, true, plan.summary);
  const write = plan.actions.find((action) => action.path === '.grove/config.toml');
  const parsed = parseTomlDocument(write.content);
  assert.equal(parsed.TEST_CMD, config.TEST_CMD);
  assert.deepEqual(parsed.ARTIFACT_DIRS, config.ARTIFACT_DIRS);
  // The two header comments are grove's own text and survive the swap: the
  // library serializes values, and the file's provenance note is not a value.
  assert.match(write.content, /^# \.grove\/config\.toml/m);
  assert.match(write.content, /consumer-authoritative/);
  // Keys stay sorted, so two setups with the same config produce one byte
  // sequence whatever order the caller built the object in.
  const keyOrder = [...write.content.matchAll(/^([A-Z_]+) = /gm)].map((m) => m[1]);
  assert.deepEqual(keyOrder, [...keyOrder].sort());
});
