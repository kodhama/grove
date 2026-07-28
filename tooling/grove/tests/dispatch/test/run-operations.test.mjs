// Upstream: spec-0006-voluntary-dispatch@v2 INV5–INV10; AC4, AC5, AC6
// (mechanical); S2, S4–S7. Decision: adr-0046.
//
// Behavioral, untested here per the spec's labels: stale-resolution
// loudness in session conduct, and the ask boundary (INV3 — an entered
// session opening a run only on an explicit user yes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after } from 'node:test';

import {
  applyRunPlan,
  describeRunOperation,
  planAbortRun,
  planCloseRun,
  planOpenRun,
} from '../../../../../plugins/grove/runtime/dispatch/lib/run.mjs';
import { parseCursor } from '../../../../../plugins/grove/runtime/dispatch/lib/cursor.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..');
const PACKAGE_ROOT = join(REPOSITORY_ROOT, 'plugins', 'grove');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const scratch = [];
after(async () => {
  await Promise.all(scratch.map((dir) => rm(dir, { recursive: true, force: true })));
});

const git = (dir, ...args) =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });

async function repoFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'grove-run-ops-'));
  scratch.push(dir);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'fixture@example.invalid');
  git(dir, 'config', 'user.name', 'Fixture');
  await writeFile(join(dir, 'README.md'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'work');
  await mkdir(join(dir, '.grove'), { recursive: true });
  return dir;
}

const SPEC_BODY = '---\nid: fixture-spec\ntype: spec\nimplements: adr-0001-x\nstatus: gated\n---\n\nbody\n';
const RUN_ID = '20260728-140000-fixture';

function openRequest(dir, overrides = {}) {
  return {
    repoRoot: dir,
    packageRoot: PACKAGE_ROOT,
    host: 'claude',
    runId: RUN_ID,
    opened: '2026-07-28T14:00:00Z',
    intent: 'land the fixture',
    subjects: ['specs/changed.md'],
    ...overrides,
  };
}

async function openedRun(dir) {
  const plan = await planOpenRun(openRequest(dir));
  assert.equal(plan.ok, true, plan.summary);
  await applyRunPlan(plan, {
    confirmedActionIds: plan.actions.map((action) => action.id),
  });
  return join(dir, '.grove', 'runs', RUN_ID, 'cursor.toml');
}

async function writeRecord(dir, runId, name, type, by, digest) {
  await mkdir(join(dir, '.grove', 'runs', runId, 'records'), { recursive: true });
  await writeFile(
    join(dir, '.grove', 'runs', runId, 'records', name),
    `schema = 1\nrecord_type = ${JSON.stringify(type)}\nsubject = "specs/changed.md"\n`
      + `subject_state = "present"\nsubject_sha256 = ${JSON.stringify(digest)}\n`
      + `verdict = "PASS"\nby = ${JSON.stringify(by)}\ndate = "2026-07-28T15:00:00Z"\n`,
  );
}

// --- S4 / INV5: the shared applyPlan gate, never a parallel one ---

test('S4 — apply with an unconfirmed cursor-create id throws naming the id; no file is written', async () => {
  const dir = await repoFixture();
  const plan = await planOpenRun(openRequest(dir));
  assert.equal(plan.ok, true, plan.summary);
  const createAction = plan.actions.find((action) => action.path.endsWith('cursor.toml'));
  assert.ok(createAction);
  assert.equal(createAction.confirmationRequired, true);

  await assert.rejects(
    applyRunPlan(plan, { confirmedActionIds: [] }),
    (error) => error.message.includes(createAction.id),
  );
  await assert.rejects(
    readFile(join(dir, '.grove', 'runs', RUN_ID, 'cursor.toml')),
    /ENOENT/,
    'no file was written',
  );
});

// --- INV6: pre-write refusals ---

test('open-run fails pre-write without .grove/, naming the host setup command', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-run-nofloor-'));
  scratch.push(dir);
  git(dir, 'init', '-q', '-b', 'main');
  const plan = await planOpenRun(openRequest(dir));
  assert.equal(plan.ok, false);
  assert.deepEqual(plan.actions, []);
  assert.match(plan.summary, /\/grove:setup/);
});

test('S5 — open-run fails pre-write while any open cursor exists, listing it, adopt/abort only', async () => {
  const dir = await repoFixture();
  await openedRun(dir);
  const second = await planOpenRun(openRequest(dir, { runId: '20260728-150000-second' }));
  assert.equal(second.ok, false);
  assert.deepEqual(second.actions, []);
  assert.match(second.summary, new RegExp(RUN_ID));
  assert.match(second.summary, /adopt/i);
  assert.match(second.summary, /abort/i);
});

// --- S2: the created cursor ---

test('S2 — the confirmed open creates a schema-valid cursor with the run-id grammar', async () => {
  const dir = await repoFixture();
  const cursorPath = await openedRun(dir);
  const text = await readFile(cursorPath, 'utf8');
  const parsed = parseCursor(text, { runId: RUN_ID });
  assert.equal(parsed.ok, true, parsed.reason);
  assert.equal(parsed.cursor.status, 'open');
  assert.deepEqual(parsed.cursor.subjects, ['specs/changed.md']);
  assert.equal(parsed.claimsPresent, false);
  assert.doesNotMatch(text, /claims/, 'no path writes the reserved claims key');

  const badId = await planOpenRun(openRequest(dir, { runId: 'Bad_Run_Id' }));
  assert.equal(badId.ok, false);
  assert.match(badId.summary, /run.?id|grammar/i);
});

// --- S6 / INV8: guard-licensed close ---

test('S6 — close is refused while the guard is non-zero; after records land it writes only status/closed', async () => {
  const dir = await repoFixture();
  const cursorPath = await openedRun(dir);
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'changed.md'), SPEC_BODY);
  const before = await readFile(cursorPath, 'utf8');

  const firstAttempt = await planCloseRun({
    repoRoot: dir, runId: RUN_ID, closed: '2026-07-28T18:00:00Z',
  });
  assert.equal(firstAttempt.ok, true, firstAttempt.summary);
  await assert.rejects(
    applyRunPlan(firstAttempt, {}),
    (error) => /guard/.test(error.message) && /t-conformance|t-spec-quality/.test(error.message),
    'the first attempt is refused with the guard report',
  );
  assert.equal(await readFile(cursorPath, 'utf8'), before, 'refused close wrote nothing');

  const digest = sha256(SPEC_BODY);
  await writeRecord(dir, RUN_ID, 'conformance.toml', 'conformance', 'conformance-reviewer', digest);
  await writeRecord(dir, RUN_ID, 'spec.toml', 'spec-adversary', 'spec-adversary', digest);

  const second = await planCloseRun({
    repoRoot: dir, runId: RUN_ID, closed: '2026-07-28T18:00:00Z',
  });
  await applyRunPlan(second, {});
  const afterText = await readFile(cursorPath, 'utf8');
  const parsed = parseCursor(afterText, { runId: RUN_ID });
  assert.equal(parsed.ok, true, parsed.reason);
  assert.equal(parsed.cursor.status, 'closed');
  assert.equal(parsed.cursor.closed, '2026-07-28T18:00:00Z');
  // Byte-diff: only the status line changed and the closed line arrived.
  const beforeLines = before.split('\n');
  const afterLines = afterText.split('\n');
  assert.deepEqual(
    afterLines.filter((line) => !beforeLines.includes(line)),
    ['status = "closed"', 'closed = "2026-07-28T18:00:00Z"'],
  );
  assert.deepEqual(
    beforeLines.filter((line) => !afterLines.includes(line)),
    ['status = "open"'],
  );
  assert.doesNotMatch(afterText, /claims/);
});

// --- S7 / INV8: abort marks, never deletes ---

test('S7 — abort writes status/closed/reason, deletes nothing, touches nothing else', async () => {
  const dir = await repoFixture();
  const cursorPath = await openedRun(dir);
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'changed.md'), SPEC_BODY); // owed work stands
  const before = await readFile(cursorPath, 'utf8');

  const plan = await planAbortRun({
    repoRoot: dir,
    runId: RUN_ID,
    closed: '2026-07-28T19:00:00Z',
    reason: 'user aborted the fixture run',
  });
  assert.equal(plan.ok, true, plan.summary);
  const action = plan.actions[0];
  assert.equal(action.confirmationRequired, true, 'abort is user-confirmed');
  await applyRunPlan(plan, { confirmedActionIds: [action.id] });

  const afterText = await readFile(cursorPath, 'utf8');
  const parsed = parseCursor(afterText, { runId: RUN_ID });
  assert.equal(parsed.ok, true, parsed.reason);
  assert.equal(parsed.cursor.status, 'aborted');
  assert.equal(parsed.cursor.reason, 'user aborted the fixture run');
  assert.match(afterText, /subjects = \["specs\/changed\.md"\]/, 'subjects immutable');
  assert.match(afterText, /intent = "land the fixture"/, 'intent immutable');
  const beforeLines = before.split('\n');
  const afterLines = afterText.split('\n');
  assert.deepEqual(
    afterLines.filter((line) => !beforeLines.includes(line)),
    ['status = "aborted"', 'closed = "2026-07-28T19:00:00Z"', 'reason = "user aborted the fixture run"'],
  );
  assert.doesNotMatch(afterText, /claims/);
});

test('INV8 exception — abort on an unparseable cursor replaces the file whole with the minimal aborted shape', async () => {
  const dir = await repoFixture();
  const runId = '20260728-160000-broken';
  await mkdir(join(dir, '.grove', 'runs', runId), { recursive: true });
  await writeFile(
    join(dir, '.grove', 'runs', runId, 'cursor.toml'),
    'schema = 1\nrun = broken not toml ???\n',
  );

  const plan = await planAbortRun({
    repoRoot: dir,
    runId,
    closed: '2026-07-28T19:30:00Z',
    reason: 'dead unparseable run',
  });
  assert.equal(plan.ok, true, plan.summary);
  assert.equal(plan.wholeFileReplacement, true);
  await applyRunPlan(plan, { confirmedActionIds: plan.actions.map((a) => a.id) });

  const text = await readFile(join(dir, '.grove', 'runs', runId, 'cursor.toml'), 'utf8');
  const parsed = parseCursor(text, { runId });
  assert.equal(parsed.ok, true, parsed.reason);
  assert.deepEqual(
    Object.keys(parsed.cursor).sort(),
    ['closed', 'reason', 'run', 'schema', 'status'],
    'exactly the minimal aborted shape',
  );
  assert.equal(parsed.cursor.status, 'aborted');
});

test('INV8 — on a well-formed cursor the whole-file replacement path is unreachable', async () => {
  const dir = await repoFixture();
  await openedRun(dir);
  const plan = await planAbortRun({
    repoRoot: dir,
    runId: RUN_ID,
    closed: '2026-07-28T19:00:00Z',
    reason: 'abort a well-formed run',
  });
  assert.equal(plan.ok, true, plan.summary);
  assert.equal(plan.wholeFileReplacement, false);
  // The planned content preserves every open-time field.
  const content = plan.actions[0].content;
  assert.match(content, /intent = "land the fixture"/);
  assert.match(content, /subjects = \["specs\/changed\.md"\]/);
  assert.match(content, /opened = "2026-07-28T14:00:00Z"/);
});

test('close of a non-open or missing run fails pre-write; abort of a closed run fails too', async () => {
  const dir = await repoFixture();
  const missing = await planCloseRun({
    repoRoot: dir, runId: '20260728-170000-none', closed: '2026-07-28T20:00:00Z',
  });
  assert.equal(missing.ok, false);

  const cursorPath = await openedRun(dir);
  const abortPlan = await planAbortRun({
    repoRoot: dir, runId: RUN_ID, closed: '2026-07-28T19:00:00Z', reason: 'first abort',
  });
  await applyRunPlan(abortPlan, { confirmedActionIds: abortPlan.actions.map((a) => a.id) });
  const again = await planAbortRun({
    repoRoot: dir, runId: RUN_ID, closed: '2026-07-28T19:10:00Z', reason: 'second abort',
  });
  assert.equal(again.ok, false, 'an aborted run cannot be re-aborted');
  const closeAborted = await planCloseRun({
    repoRoot: dir, runId: RUN_ID, closed: '2026-07-28T20:00:00Z',
  });
  assert.equal(closeAborted.ok, false, 'an aborted run cannot be closed');
  assert.ok(await readFile(cursorPath, 'utf8'), 'cursor file still exists');
});

// --- boundaries: not lifecycle skills ---

test('run operations are runtime operations, not lifecycle skills; the lifecycle inventory stays four', async () => {
  const inventory = JSON.parse(await readFile(
    join(PACKAGE_ROOT, 'metadata', 'lifecycle-inventory.json'),
    'utf8',
  ));
  assert.deepEqual(inventory.operations, ['setup', 'refresh', 'set-profile', 'remove']);
  for (const host of ['claude', 'codex']) {
    const skills = await readdir(join(PACKAGE_ROOT, 'adapters', host, 'skills'));
    for (const op of ['open-run', 'close-run', 'abort-run']) {
      assert.equal(skills.includes(op), false, `${host}/${op} must not be a skill`);
    }
  }
  for (const op of ['open-run', 'close-run', 'abort-run']) {
    const contract = describeRunOperation(op);
    assert.deepEqual(contract.flow, ['plan', 'disclose', 'confirm-exact-action-ids', 'apply']);
  }
});

test('the grove-run CLI mirrors grove-operation.mjs (describe/plan/apply)', async () => {
  const cli = join(PACKAGE_ROOT, 'runtime', 'dispatch', 'bin', 'grove-run.mjs');
  const described = spawnSync(process.execPath, [cli, 'describe', 'open-run'], { encoding: 'utf8' });
  assert.equal(described.status, 0, described.stderr);
  const contract = JSON.parse(described.stdout);
  assert.equal(contract.operation, 'open-run');
  assert.deepEqual(contract.flow, ['plan', 'disclose', 'confirm-exact-action-ids', 'apply']);
});

// --- S11 / INV25: the managed block is not load-bearing ---

test('S11 — guard and run operations behave identically with a deleted or mangled managed block', async () => {
  const plain = await repoFixture();
  const mangled = await repoFixture();
  await writeFile(
    join(mangled, 'CLAUDE.md'),
    '<!-- grove:begin (managed by grove — dials live in .grove/, not this block) -->\n'
      + 'mangled, no stamp, no end marker\n',
  );
  for (const dir of [plain, mangled]) {
    await mkdir(join(dir, 'specs'), { recursive: true });
    await writeFile(join(dir, 'specs', 'changed.md'), SPEC_BODY);
    const plan = await planOpenRun(openRequest(dir));
    assert.equal(plan.ok, true, plan.summary);
    await applyRunPlan(plan, {
      confirmedActionIds: plan.actions.map((action) => action.id),
    });
  }
  const guard = join(PACKAGE_ROOT, 'runtime', 'dispatch', 'bin', 'guard.mjs');
  const results = [plain, mangled].map((dir) =>
    spawnSync(process.execPath, [guard, '--repo', dir], { encoding: 'utf8' }));
  assert.equal(results[0].status, results[1].status);
  assert.equal(results[0].stdout, results[1].stdout);
  assert.equal(results[0].stderr, results[1].stderr);
  assert.equal(results[0].status, 3, 'owed work reported in both');

  // Pin: the new dispatch machinery never reads the instruction-file block.
  const { readdir: rd } = await import('node:fs/promises');
  for (const sub of ['lib', 'bin']) {
    const dirPath = join(PACKAGE_ROOT, 'runtime', 'dispatch', sub);
    for (const name of await rd(dirPath)) {
      const source = await readFile(join(dirPath, name), 'utf8');
      assert.doesNotMatch(
        source,
        /CLAUDE\.md|AGENTS\.md|grove:begin|instruction_file/,
        `${sub}/${name} must not read the managed block`,
      );
    }
  }
});

// --- BLOCK-1 regression: well-formed non-canonical cursors must close AND
// abort. parseCursor tolerates CRLF, trailing comments, and extra spacing;
// the close/abort field edit must carry the same tolerance (INV8 unwidened:
// still a field edit on a well-formed cursor, never the whole-file path).

// Variant list DERIVED FROM toml.mjs's line handling (one pin per parser
// tolerance): split(/\r?\n/) -> optional trailing \r; stripComment() ->
// #-comment to EOL outside strings; .trim() after comment-strip -> leading
// AND trailing whitespace; key/value trimmed around '=' -> inner spacing.
const NON_CANONICAL_CURSORS = {
  'indented status line (leading trim)': (runId) =>
    `schema = 1\nrun = "${runId}"\nopened = "2026-07-28T14:00:00Z"\n`
      + `intent = "land the fixture"\nsubjects = ["specs/changed.md"]\n`
      + `  status = "open"\n`,
  'trailing whitespace (trailing trim)': (runId) =>
    `schema = 1\nrun = "${runId}"\nopened = "2026-07-28T14:00:00Z"\n`
      + `intent = "land the fixture"\nsubjects = ["specs/changed.md"]\n`
      + `status = "open"  \t\n`,
  'indented + comment + CRLF combined': (runId) =>
    `schema = 1\r\nrun = "${runId}"\r\nopened = "2026-07-28T14:00:00Z"\r\n`
      + `intent = "land the fixture"\r\nsubjects = ["specs/changed.md"]\r\n`
      + `\t status = "open" \t# opened by fixture\r\n`,
  'crlf line endings': (runId) =>
    `schema = 1\r\nrun = "${runId}"\r\nopened = "2026-07-28T14:00:00Z"\r\n`
      + `intent = "land the fixture"\r\nsubjects = ["specs/changed.md"]\r\n`
      + `status = "open"\r\n`,
  'comment on the status line': (runId) =>
    `schema = 1\nrun = "${runId}"\nopened = "2026-07-28T14:00:00Z"\n`
      + `intent = "land the fixture"\nsubjects = ["specs/changed.md"]\n`
      + `status = "open" # opened by fixture\n`,
  'extra spaces around the assignment': (runId) =>
    `schema = 1\nrun = "${runId}"\nopened = "2026-07-28T14:00:00Z"\n`
      + `intent = "land the fixture"\nsubjects = ["specs/changed.md"]\n`
      + `status   =   "open"\n`,
};

test('a well-formed non-canonical cursor closes cleanly (CRLF, comment, spacing)', async (t) => {
  for (const [name, build] of Object.entries(NON_CANONICAL_CURSORS)) {
    await t.test(name, async () => {
      const dir = await repoFixture();
      const runId = '20260728-140000-noncanon';
      const cursorPath = join(dir, '.grove', 'runs', runId, 'cursor.toml');
      await mkdir(join(dir, '.grove', 'runs', runId), { recursive: true });
      const text = build(runId);
      await writeFile(cursorPath, text);
      // Subject untouched: the guard licenses the close.
      const plan = await planCloseRun({
        repoRoot: dir, runId, closed: '2026-07-28T18:00:00Z',
      });
      assert.equal(plan.ok, true, plan.summary);
      await applyRunPlan(plan, {});
      const after = await readFile(cursorPath, 'utf8');
      const parsed = parseCursor(after, { runId });
      assert.equal(parsed.ok, true, parsed.reason);
      assert.equal(parsed.cursor.status, 'closed');
      if (text.includes('\r\n')) {
        assert.ok(after.includes('\r\n'), 'line-ending style preserved');
      }
    });
  }
});

test('a well-formed non-canonical cursor aborts cleanly through the field edit, never whole-file', async (t) => {
  for (const [name, build] of Object.entries(NON_CANONICAL_CURSORS)) {
    await t.test(name, async () => {
      const dir = await repoFixture();
      const runId = '20260728-150000-noncanon';
      const cursorPath = join(dir, '.grove', 'runs', runId, 'cursor.toml');
      await mkdir(join(dir, '.grove', 'runs', runId), { recursive: true });
      await writeFile(cursorPath, build(runId));
      const plan = await planAbortRun({
        repoRoot: dir, runId, closed: '2026-07-28T19:00:00Z', reason: 'fixture abort',
      });
      assert.equal(plan.ok, true, plan.summary);
      assert.equal(plan.wholeFileReplacement, false, 'well-formed stays a field edit');
      await applyRunPlan(plan, { confirmedActionIds: plan.actions.map((a) => a.id) });
      const parsed = parseCursor(await readFile(cursorPath, 'utf8'), { runId });
      assert.equal(parsed.ok, true, parsed.reason);
      assert.equal(parsed.cursor.status, 'aborted');
      assert.deepEqual(parsed.cursor.subjects, ['specs/changed.md'], 'subjects immutable');
    });
  }
});


// --- MEDIUM e/g: subject-path validation and the empty subjects list ---

test('open-run rejects traversal, absolute, and backslash subject paths, naming the offender', async () => {
  const dir = await repoFixture();
  for (const bad of ['../outside.md', '/etc/passwd', 'specs\\win.md']) {
    const plan = await planOpenRun(openRequest(dir, { subjects: [bad] }));
    assert.equal(plan.ok, false, bad);
    assert.deepEqual(plan.actions, []);
    assert.ok(
      plan.summary.includes(bad) || plan.summary.includes(JSON.stringify(bad)),
      `${bad}: summary names the offending subject — got: ${plan.summary}`,
    );
  }
  const nested = await planOpenRun(openRequest(dir, { subjects: ['specs/a/../../x.md'] }));
  assert.equal(nested.ok, false, 'embedded .. segment rejected');

  // The open-run site itself validates (not merely the round-trip belt):
  // with no .grove/ floor at all, a bad subject is still what the plan
  // names — subject validation precedes the floor check.
  const bare = await mkdtemp(join(tmpdir(), 'grove-run-nofloor2-'));
  scratch.push(bare);
  git(bare, 'init', '-q', '-b', 'main');
  const early = await planOpenRun(openRequest(bare, { subjects: ['../outside.md'] }));
  assert.equal(early.ok, false);
  assert.ok(
    early.summary.includes('../outside.md') || early.summary.includes(JSON.stringify('../outside.md')),
    `subject validation fires at the open-run site, before the floor check — got: ${early.summary}`,
  );
});

test('a cursor whose subject path traverses or is absolute is schema-invalid', () => {
  const base = (subject) =>
    'schema = 1\nrun = "20260728-140322-r"\nopened = "2026-07-28T14:03:22Z"\n'
      + `intent = "x"\nsubjects = [${JSON.stringify(subject)}]\nstatus = "open"\n`;
  for (const bad of ['../outside.md', '/etc/passwd']) {
    const parsed = parseCursor(base(bad), { runId: '20260728-140322-r' });
    assert.equal(parsed.ok, false, bad);
    assert.ok(parsed.reason.includes(bad), `${bad}: reason names it — got: ${parsed.reason}`);
  }
});

test('open-run rejects an empty subjects list', async () => {
  const dir = await repoFixture();
  const plan = await planOpenRun(openRequest(dir, { subjects: [] }));
  assert.equal(plan.ok, false);
  assert.match(plan.summary, /subjects/i);
});

// --- MEDIUM a: the round-trip gate at open ---

test('open-run rejects a planned cursor that does not round-trip, naming the offending field', async () => {
  const dir = await repoFixture();
  const carriage = await planOpenRun(openRequest(dir, {
    intent: 'line one\rline two',
  }));
  assert.equal(carriage.ok, false);
  assert.deepEqual(carriage.actions, []);
  assert.match(carriage.summary, /intent/, `names the field: ${carriage.summary}`);

  const control = await planOpenRun(openRequest(dir, {
    subjects: ['specs/ctl\u0001name.md'],
  }));
  assert.equal(control.ok, false);
  assert.deepEqual(control.actions, []);
  assert.match(control.summary, /subject/i, `names the field: ${control.summary}`);
});

// Case list DERIVED FROM the counterpart mechanism: git's path output (the
// derived change set) is canonical repo-relative — no leading "./", no "."
// segments, no empty segments ("//" or a trailing "/"). A subject in any
// non-canonical form passes a looser validator but can never equal a
// change-set path, so its owed work silently never enables.
test('open-run rejects non-canonical relative subject paths (./, /./, //, trailing /)', async () => {
  const dir = await repoFixture();
  for (const bad of ['./dotslash.md', 'a/./b.md', 'x//y.md', 'x/']) {
    const plan = await planOpenRun(openRequest(dir, { subjects: [bad] }));
    assert.equal(plan.ok, false, bad);
    assert.ok(
      plan.summary.includes(bad) || plan.summary.includes(JSON.stringify(bad)),
      `${bad}: summary names the offending subject — got: ${plan.summary}`,
    );
  }
});
