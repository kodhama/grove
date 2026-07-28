// Upstream: spec-0006-voluntary-dispatch@v2 INV21; AC12 (mechanical).
// Decision: adr-0046-how-dispatch-rules-reach-a-session.
//
// The wrapper's exit mapping (§Claude Stop-hook mechanics): clean → silent 0;
// supervisor hold → block-decision JSON on stdout, exit 0; observer or
// stop_hook_active → one stderr line, exit 1; internal/wrapper failure →
// "grove-guard error:" on stderr, exit 4. The wrapper shall NEVER exit 2 —
// the host's blocking-error code — on any path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after } from 'node:test';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..');
const PACKAGE_ROOT = join(REPOSITORY_ROOT, 'plugins', 'grove');
const WRAPPER = join(PACKAGE_ROOT, 'hooks', 'stop-guard.sh');

const scratch = [];
after(async () => {
  await Promise.all(scratch.map((dir) => rm(dir, { recursive: true, force: true })));
});

const git = (dir, ...args) =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });

async function repoFixture({ defaultBranch = 'main' } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'grove-stop-wrapper-'));
  scratch.push(dir);
  git(dir, 'init', '-q', '-b', defaultBranch);
  git(dir, 'config', 'user.email', 'fixture@example.invalid');
  git(dir, 'config', 'user.name', 'Fixture');
  await writeFile(join(dir, 'README.md'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  if (defaultBranch === 'main') git(dir, 'checkout', '-q', '-b', 'work');
  return dir;
}

const SPEC_BODY = '---\nid: fixture-spec\ntype: spec\nimplements: adr-0001-x\nstatus: gated\n---\n\nbody\n';

async function seedSupervisorOwed(dir) {
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'changed.md'), SPEC_BODY);
  const runId = '20260728-140000-run';
  await mkdir(join(dir, '.grove', 'runs', runId), { recursive: true });
  await writeFile(
    join(dir, '.grove', 'runs', runId, 'cursor.toml'),
    `schema = 1\nrun = "${runId}"\nopened = "2026-07-28T14:00:00Z"\n`
      + 'intent = "fixture"\nsubjects = ["specs/changed.md"]\nstatus = "open"\n',
  );
}

function runWrapper(dir, { stdin = '{"stop_hook_active": false}', wrapper = WRAPPER } = {}) {
  return spawnSync('sh', [wrapper], {
    encoding: 'utf8',
    input: stdin,
    cwd: dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
  });
}

test('clean repository: silent exit 0', async () => {
  const dir = await repoFixture();
  const result = runWrapper(dir);
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.equal(result.stdout.trim(), '');
  assert.equal(result.stderr.trim(), '');
});

test('supervisor owed, continuation flag absent: single-line block decision, exit 0', async () => {
  const dir = await repoFixture();
  await seedSupervisorOwed(dir);
  const result = runWrapper(dir);
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 1, 'single-line JSON on stdout');
  const decision = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(decision).sort(), ['decision', 'reason']);
  assert.equal(decision.decision, 'block');
  assert.match(decision.reason, /t-conformance/);
  assert.match(decision.reason, /specs\/changed\.md/);
  assert.match(decision.reason, /conformance/);
  assert.match(decision.reason, /adopt|abort/i);
});

test('supervisor defect without continuation flag: block decision too, never exit 2', async () => {
  const dir = await repoFixture();
  const runId = '20260728-140000-mute';
  await mkdir(join(dir, '.grove', 'runs', runId), { recursive: true });
  await writeFile(
    join(dir, '.grove', 'runs', runId, 'cursor.toml'),
    'schema = 1\nrun = "20260728-140000-mute"\n',
  );
  const result = runWrapper(dir);
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  const decision = JSON.parse(result.stdout.trim());
  assert.equal(decision.decision, 'block');
  assert.match(decision.reason, /20260728-140000-mute/);
});

test('stop_hook_active true: one stderr line, exit 1, no block', async () => {
  const dir = await repoFixture();
  await seedSupervisorOwed(dir);
  const result = runWrapper(dir, { stdin: '{"stop_hook_active": true}' });
  assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
  assert.equal(result.stdout.trim(), '');
  assert.equal(result.stderr.trim().split('\n').length, 1);
  assert.match(result.stderr, /t-conformance/);
});

test('observer context: one stderr line, exit 1', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'watched.md'), SPEC_BODY);
  const result = runWrapper(dir);
  assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
  assert.equal(result.stdout.trim(), '');
  const lines = result.stderr.trim().split('\n');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^grove-guard \(observer\): /);
  assert.match(lines[0], /specs\/watched\.md/);
});

test('guard internal error: "grove-guard error:" on stderr, exit 4', async () => {
  const dir = await repoFixture({ defaultBranch: 'trunk' });
  const result = runWrapper(dir);
  assert.equal(result.status, 4, `${result.stdout}${result.stderr}`);
  assert.equal(result.stdout.trim(), '');
  assert.match(result.stderr, /^grove-guard error:/m);
});

test('wrapper failure (guard unreachable): "grove-guard error:", exit 4, never 2', async () => {
  const dir = await repoFixture();
  const broken = await mkdtemp(join(tmpdir(), 'grove-broken-plugin-'));
  scratch.push(broken);
  await cp(join(PACKAGE_ROOT, 'hooks'), join(broken, 'hooks'), { recursive: true });
  // No runtime/ beside hooks/: the wrapper must classify this as its own
  // failure, not as a non-hold report.
  const result = runWrapper(dir, { wrapper: join(broken, 'hooks', 'stop-guard.sh') });
  assert.equal(result.status, 4, `${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /^grove-guard error:/m);
});

test('the whole matrix never exits 2', async () => {
  const states = [];
  {
    const clean = await repoFixture();
    states.push([clean, '{"stop_hook_active": false}']);
    states.push([clean, '{"stop_hook_active": true}']);
  }
  {
    const owed = await repoFixture();
    await seedSupervisorOwed(owed);
    states.push([owed, '{"stop_hook_active": false}']);
    states.push([owed, '{"stop_hook_active": true}']);
    states.push([owed, '']);
    states.push([owed, 'not json at all']);
  }
  {
    const observer = await repoFixture();
    await mkdir(join(observer, 'specs'), { recursive: true });
    await writeFile(join(observer, 'specs', 'watched.md'), SPEC_BODY);
    states.push([observer, '{"stop_hook_active": false}']);
  }
  {
    const internal = await repoFixture({ defaultBranch: 'trunk' });
    states.push([internal, '{"stop_hook_active": false}']);
  }
  for (const [dir, stdin] of states) {
    const result = runWrapper(dir, { stdin });
    assert.notEqual(
      result.status, 2,
      `exit 2 is the host's blocking-error code and is forbidden (stdin=${stdin})`,
    );
  }
});

test('hooks.json registers the guard on the Stop event through $CLAUDE_PLUGIN_ROOT', async () => {
  const hooks = JSON.parse(await readFile(join(PACKAGE_ROOT, 'hooks', 'hooks.json'), 'utf8'));
  assert.deepEqual(Object.keys(hooks), ['hooks']);
  assert.deepEqual(Object.keys(hooks.hooks), ['Stop']);
  const matchers = hooks.hooks.Stop;
  assert.equal(matchers.length, 1);
  assert.equal(matchers[0].hooks.length, 1);
  const entry = matchers[0].hooks[0];
  assert.equal(entry.type, 'command');
  assert.match(entry.command, /\$CLAUDE_PLUGIN_ROOT/);
  assert.match(entry.command, /hooks\/stop-guard\.sh/);
});

test('INV21 envelope discipline: no context-injecting output exists; block JSON is the only hold form', async () => {
  // The measured trellis precedent: a flat additionalContext envelope was
  // silently discarded. This design emits NO context-injecting output at
  // all — pinned here so any future addition must go through the nested
  // hookSpecificOutput envelope and a new measurement.
  const guardSource = await readFile(
    join(PACKAGE_ROOT, 'runtime', 'dispatch', 'bin', 'guard.mjs'),
    'utf8',
  );
  const wrapperSource = await readFile(WRAPPER, 'utf8');
  for (const source of [guardSource, wrapperSource]) {
    assert.doesNotMatch(source, /additionalContext/);
  }
});

test('AC12 — the retained Claude channel measurement exists and verifies both channels', async () => {
  const record = JSON.parse(await readFile(
    join(PACKAGE_ROOT, 'reference', 'surfaces', 'claude-stop-hook-channels-2026-07-28.json'),
    'utf8',
  ));
  assert.equal(record.host, 'claude');
  assert.match(record.results.block_decision_reaches_model, /^VERIFIED/);
  assert.match(record.results.exit_1_stderr_nonblocking, /^VERIFIED/);
  assert.match(record.results.stop_hook_active_flag, /^VERIFIED/);

  const allowlist = JSON.parse(await readFile(
    join(PACKAGE_ROOT, 'metadata', 'package-allowlist.json'),
    'utf8',
  ));
  for (const path of [
    'plugins/grove/reference/surfaces/claude-stop-hook-channels-2026-07-28.json',
    'plugins/grove/hooks/hooks.json',
    'plugins/grove/hooks/stop-guard.sh',
  ]) {
    assert.ok(allowlist.leaves.some((leaf) => leaf.path === path), path);
  }
});

// --- R4: the internal-error channel holds for a BROKEN INSTALL too ---
// Found by review against 4106b4c. The guard's lib imports used to be static,
// so they resolved before the process-level crash handlers were registered: a
// missing lib module escaped as Node's own multi-line ERR_MODULE_NOT_FOUND
// stack on exit 1 — the wrapper's `guard 1 -> 1` non-blocking-report slot,
// i.e. a broken install masquerading as an observer report. Claude treats
// Stop-hook 1 and 4 alike (both non-blocking), so the cost is report hygiene
// and diagnosability, not a missed hold; it is still the difference between
// the two exit slots the wrapper documents as mechanically distinguishable.

test('R4 — a missing lib module reaches the internal-error channel: exit 4, one line, no stack', async () => {
  const dir = await repoFixture();
  const broken = await mkdtemp(join(tmpdir(), 'grove-broken-lib-'));
  scratch.push(broken);
  await cp(PACKAGE_ROOT, broken, { recursive: true });
  await rm(join(broken, 'runtime', 'dispatch', 'lib', 'guard-core.mjs'));

  const result = runWrapper(dir, { wrapper: join(broken, 'hooks', 'stop-guard.sh') });
  assert.equal(result.status, 4, `${result.stdout}${result.stderr}`);
  assert.equal(result.stdout.trim(), '');
  const lines = result.stderr.trim().split('\n');
  assert.equal(lines.length, 1, `one-line report, got:\n${result.stderr}`);
  assert.match(lines[0], /^grove-guard error: /);
  assert.doesNotMatch(result.stderr, /^\s+at /m, 'a raw stack frame is never a report line');
});

test('R4 — an internal-error report stays one line when the error message embeds newlines', async () => {
  const dir = await repoFixture();
  // Node quotes the offending input back inside the JSON parse message, raw
  // newlines and all — the same smuggling class oneLine() already guards on
  // the defect/owed lines, which the two crash writes did not use.
  const result = runWrapper(dir, { stdin: '[1,\n2,\nx\n]' });
  assert.equal(result.status, 4, `${result.stdout}${result.stderr}`);
  assert.equal(result.stdout.trim(), '');
  const lines = result.stderr.trim().split('\n');
  assert.equal(lines.length, 1, `one-line report, got:\n${result.stderr}`);
  assert.match(lines[0], /^grove-guard error: unreadable hook input: /);
  assert.match(lines[0], /\\n/, 'the embedded newlines are escaped, not emitted raw');
});
