// Upstream: spec-0006-voluntary-dispatch@v2 INV7, INV9, INV16–INV20, INV27;
// AC1, AC2, AC5 (defect half), AC6 (mechanical); S8–S10.
// Decision: adr-0046-how-dispatch-rules-reach-a-session.
//
// INV17's every-handover moment is BEHAVIORAL — a duty the entry-skill
// bodies place on the driving session. It has no test here and none is
// faked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after } from 'node:test';

import { subjectDigest } from '../../../../../plugins/grove/runtime/dispatch/lib/guard-core.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..');
const GUARD = join(
  REPOSITORY_ROOT,
  'plugins/grove/runtime/dispatch/bin/guard.mjs',
);

// The digest the guard computes for a regular file holding these bytes. Built
// through the shipped constructor, never re-spelled here: the kind tag is part
// of the digest, and a test that hardcoded the untagged hash would silently
// stop testing what the guard does.
const fileDigest = (body) => subjectDigest('file', Buffer.from(body));

const scratch = [];
after(async () => {
  await Promise.all(scratch.map((dir) => rm(dir, { recursive: true, force: true })));
});

const git = (dir, ...args) =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });

async function repoFixture({ defaultBranch = 'main' } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'grove-guard-cli-'));
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

async function writeCursor(dir, runId, body) {
  await mkdir(join(dir, '.grove', 'runs', runId), { recursive: true });
  await writeFile(join(dir, '.grove', 'runs', runId, 'cursor.toml'), body);
}

function openCursor(runId, subjects) {
  return `schema = 1\nrun = "${runId}"\nopened = "2026-07-28T14:00:00Z"\n`
    + `intent = "fixture run"\nsubjects = [${subjects.map((s) => JSON.stringify(s)).join(', ')}]\n`
    + 'status = "open"\n';
}

async function writeRecord(dir, runId, name, fields) {
  await mkdir(join(dir, '.grove', 'runs', runId, 'records'), { recursive: true });
  const text = Object.entries(fields)
    .map(([key, value]) =>
      `${key} = ${typeof value === 'number' ? value : JSON.stringify(value)}`)
    .join('\n') + '\n';
  await writeFile(join(dir, '.grove', 'runs', runId, 'records', name), text);
}

const SPEC_BODY = '---\nid: fixture-spec\ntype: spec\nimplements: adr-0001-x\nstatus: gated\n---\n\nbody\n';

async function snapshotTree(root, prefix = '') {
  const entries = new Map();
  let names;
  try {
    names = await readdir(join(root, prefix), { withFileTypes: true });
  } catch {
    return entries;
  }
  for (const entry of names) {
    if (entry.name === '.git') continue; // git refreshes its own stat cache on read
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      for (const [key, value] of await snapshotTree(root, relative)) entries.set(key, value);
    } else if (entry.isFile()) {
      entries.set(relative, await readFile(join(root, relative), 'utf8'));
    }
  }
  return entries;
}

// INV16: read-only proof — every invocation in this file runs through here,
// with a recursive byte comparison of the working tree before and after.
async function runGuard(dir, { hook = false, stdin } = {}) {
  const before = await snapshotTree(dir);
  const args = [GUARD, '--repo', dir];
  if (hook) args.push('--hook');
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    input: stdin,
  });
  const afterTree = await snapshotTree(dir);
  assert.deepEqual([...afterTree], [...before], 'the guard wrote to the repository');
  return result;
}

// --- direct CLI exit codes ---

test('exit 0 — no enabled instance and no defect: an untouched subject never blocks close', async () => {
  const dir = await repoFixture();
  await writeFile(join(dir, 'specs'), '', { flag: 'w' }).catch(() => {});
  await rm(join(dir, 'specs'), { force: true });
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'settled.md'), SPEC_BODY);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'settled');
  git(dir, 'checkout', '-q', 'main');
  git(dir, 'merge', '-q', '--ff-only', 'work');
  git(dir, 'checkout', '-q', 'work');
  await writeCursor(dir, '20260728-140000-clean', openCursor('20260728-140000-clean', ['specs/settled.md']));

  const result = await runGuard(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '');
  assert.equal(result.stderr.trim(), '');
});

test('exit 3 — owed work: one stdout line per enabled instance naming id, subject, missing type', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'changed.md'), SPEC_BODY);
  await writeCursor(dir, '20260728-140000-owed', openCursor('20260728-140000-owed', ['specs/changed.md']));

  const result = await runGuard(dir);
  assert.equal(result.status, 3, result.stderr);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 2, result.stdout);
  const conformance = lines.find((line) => line.includes('t-conformance'));
  const specQuality = lines.find((line) => line.includes('t-spec-quality'));
  assert.ok(conformance && specQuality, result.stdout);
  for (const line of lines) assert.match(line, /specs\/changed\.md/);
  assert.match(conformance, /conformance/);
  assert.match(specQuality, /spec-adversary/);
  // §Staleness listing (deliberate update): supervisor hold/defect output
  // carries exactly one line listing every open cursor path; no defect
  // lines on a clean-defect repo.
  const stderrLines = result.stderr.trim().split('\n');
  assert.equal(stderrLines.length, 1, result.stderr);
  assert.match(stderrLines[0], /open cursors?:/i);
  assert.match(stderrLines[0], /\.grove\/runs\/20260728-140000-owed\/cursor\.toml/);
  assert.doesNotMatch(result.stderr, /defect/i);
});

test('a current record fires the token: only the unfired instance remains', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'changed.md'), SPEC_BODY);
  const runId = '20260728-140000-owed';
  await writeCursor(dir, runId, openCursor(runId, ['specs/changed.md']));
  await writeRecord(dir, runId, 'conformance.toml', {
    schema: 1,
    record_type: 'conformance',
    subject: 'specs/changed.md',
    subject_state: 'present',
    subject_sha256: fileDigest(SPEC_BODY),
    verdict: 'PASS',
    by: 'conformance-reviewer',
    date: '2026-07-28T15:00:00Z',
  });

  const result = await runGuard(dir);
  assert.equal(result.status, 3, result.stderr);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /t-spec-quality/);
});

test('exit 1 — internal: unresolvable base names the failure and reports no verdict', async () => {
  const dir = await repoFixture({ defaultBranch: 'trunk' });
  const result = await runGuard(dir);
  assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /grove-guard error/);
  assert.match(result.stderr, /origin\/HEAD|main/);
});

// --- defect classes (exit 2; INV27, AC5's defect half, AC6) ---

test('exit 2 — a cursor carrying the reserved claims key is a defect; evaluation continues (AC6)', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'changed.md'), SPEC_BODY);
  const runId = '20260728-140000-claims';
  await writeCursor(dir, runId,
    openCursor(runId, ['specs/changed.md']) + 'claims = ["specs/changed.md"]\n');

  const result = await runGuard(dir);
  assert.equal(result.status, 2, `${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /claims/);
  assert.match(result.stderr, /cursor\.toml/);
  // The run's owed work still holds and rides beside the defect line.
  assert.match(result.stdout, /t-conformance/);
  assert.match(result.stdout, /specs\/changed\.md/);
});

test('exit 2 — more than one open cursor: union of subjects, every cursor named', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'first.md'), SPEC_BODY);
  await writeFile(join(dir, 'specs', 'second.md'), SPEC_BODY.replace('fixture-spec', 'other-spec'));
  await writeCursor(dir, '20260728-140000-one', openCursor('20260728-140000-one', ['specs/first.md']));
  await writeCursor(dir, '20260728-150000-two', openCursor('20260728-150000-two', ['specs/second.md']));

  const result = await runGuard(dir);
  assert.equal(result.status, 2, `${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /more than one open cursor|second open cursor/i);
  assert.match(result.stderr, /20260728-140000-one/);
  assert.match(result.stderr, /20260728-150000-two/);
  // Union: owed lines cover subjects from BOTH cursors.
  assert.match(result.stdout, /specs\/first\.md/);
  assert.match(result.stdout, /specs\/second\.md/);
});

test('exit 2 — an unparseable cursor is skipped-with-defect while a parseable one evaluates', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'live.md'), SPEC_BODY);
  await writeCursor(dir, '20260728-140000-broken', 'status = open ???\nnot toml\n');
  await writeCursor(dir, '20260728-150000-live', openCursor('20260728-150000-live', ['specs/live.md']));

  const result = await runGuard(dir);
  assert.equal(result.status, 2, `${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /20260728-140000-broken/);
  assert.match(result.stdout, /specs\/live\.md/, 'the parseable cursor is still evaluated');
});

test('a status-unreadable cursor is open for mode selection (fail closed): supervisor, defect', async () => {
  const dir = await repoFixture();
  await writeCursor(dir, '20260728-140000-mute', 'schema = 1\nrun = "20260728-140000-mute"\n');

  const direct = await runGuard(dir);
  assert.equal(direct.status, 2, `${direct.stdout}${direct.stderr}`);
  assert.match(direct.stderr, /20260728-140000-mute/);

  // Through the hook it HOLDS (supervisor context), carrying the defect.
  const hook = await runGuard(dir, { hook: true, stdin: '{"stop_hook_active": false}' });
  assert.equal(hook.status, 0, `${hook.stdout}${hook.stderr}`);
  const decision = JSON.parse(hook.stdout.trim());
  assert.equal(decision.decision, 'block');
  assert.match(decision.reason, /20260728-140000-mute/);
  assert.match(decision.reason, /abort/i);
});

test('exit 2 — an unknown record_type is a defect and satisfies nothing', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'changed.md'), SPEC_BODY);
  const runId = '20260728-140000-badrec';
  await writeCursor(dir, runId, openCursor(runId, ['specs/changed.md']));
  await writeRecord(dir, runId, 'weird.toml', {
    schema: 1,
    record_type: 'human-approval',
    subject: 'specs/changed.md',
    subject_state: 'present',
    subject_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    verdict: 'APPROVED',
    by: 'someone',
    date: '2026-07-28T15:00:00Z',
  });

  const result = await runGuard(dir);
  assert.equal(result.status, 2, `${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /weird\.toml/);
  assert.match(result.stdout, /t-conformance/, 'the reserved-type record fired no token');
});

// --- hook channels (S8, S9) ---

test('S8 — the hook holds naming the exact transition, subject, record, and resolutions', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'changed.md'), SPEC_BODY);
  await writeCursor(dir, '20260728-140000-hold', openCursor('20260728-140000-hold', ['specs/changed.md']));

  const result = await runGuard(dir, { hook: true, stdin: '{"stop_hook_active": false}' });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 1, 'single-line JSON');
  const decision = JSON.parse(lines[0]);
  assert.equal(decision.decision, 'block');
  assert.match(decision.reason, /t-conformance/);
  assert.match(decision.reason, /specs\/changed\.md/);
  assert.match(decision.reason, /conformance/);
  assert.match(decision.reason, /adopt|abort/i);
  // §Staleness listing: the hold names every open cursor path.
  assert.match(decision.reason, /open cursors?:/i);
  assert.match(decision.reason, /\.grove\/runs\/20260728-140000-hold\/cursor\.toml/);
});

test('S9 — stop_hook_active bounds the hold: same gap reported on stderr, exit 1, no block', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'changed.md'), SPEC_BODY);
  await writeCursor(dir, '20260728-140000-bound', openCursor('20260728-140000-bound', ['specs/changed.md']));

  const result = await runGuard(dir, { hook: true, stdin: '{"stop_hook_active": true}' });
  assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
  assert.equal(result.stdout.trim(), '', 'no block decision under the continuation flag');
  const lines = result.stderr.trim().split('\n');
  assert.equal(lines.length, 1, 'one non-hold line');
  assert.match(lines[0], /t-conformance/);
  assert.match(lines[0], /specs\/changed\.md/);
});

// --- observer mode (S10, INV20, AC2) ---

test('S10 — observer: exactly one prefixed line per stop, every stop, never a hold, no state', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await mkdir(join(dir, 'research'), { recursive: true });
  await writeFile(join(dir, 'specs', 'watched.md'), SPEC_BODY);
  await writeFile(
    join(dir, 'research', 'note.md'),
    '---\nid: n\ntype: research\nstatus: draft\n---\nnotes\n',
  );
  await writeFile(join(dir, 'tool.mjs'), 'export const x = 1;\n');

  const first = await runGuard(dir, { hook: true, stdin: '{"stop_hook_active": false}' });
  assert.equal(first.status, 1, `${first.stdout}${first.stderr}`);
  assert.equal(first.stdout.trim(), '', 'observer never holds');
  const lines = first.stderr.trim().split('\n');
  assert.equal(lines.length, 1, `exactly one line: ${first.stderr}`);
  assert.match(lines[0], /^grove-guard \(observer\): /);
  assert.match(lines[0], /specs\/watched\.md/);
  assert.match(lines[0], /conformance/);
  assert.match(lines[0], /spec-adversary/);
  assert.doesNotMatch(lines[0], /research\/note\.md/, 'reviewless is out of observer scope');
  assert.doesNotMatch(lines[0], /tool\.mjs/, 'code is out of observer scope');

  // No dedup state exists or is wanted: the second stop repeats the line.
  const second = await runGuard(dir, { hook: true, stdin: '{"stop_hook_active": false}' });
  assert.equal(second.status, 1);
  assert.equal(second.stderr, first.stderr, 'repetition is the correct loudness');
});

test('observer direct CLI: owed work reports with exit 3; a current record silences its subject', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'watched.md'), SPEC_BODY);

  const owed = await runGuard(dir);
  assert.equal(owed.status, 3, `${owed.stdout}${owed.stderr}`);
  assert.match(owed.stdout, /specs\/watched\.md/);

  // A still-current record from a CLOSED run silences the observer.
  const runId = '20260101-000000-old-run';
  await writeCursor(dir, runId,
    `schema = 1\nrun = "${runId}"\nstatus = "closed"\nclosed = "2026-01-01T01:00:00Z"\n`);
  const digest = fileDigest(SPEC_BODY);
  for (const [name, type, by] of [
    ['conformance.toml', 'conformance', 'conformance-reviewer'],
    ['spec.toml', 'spec-adversary', 'spec-adversary'],
  ]) {
    await writeRecord(dir, runId, name, {
      schema: 1,
      record_type: type,
      subject: 'specs/watched.md',
      subject_state: 'present',
      subject_sha256: digest,
      verdict: 'PASS',
      by,
      date: '2026-01-01T00:30:00Z',
    });
  }
  const silenced = await runGuard(dir);
  assert.equal(silenced.status, 0, `${silenced.stdout}${silenced.stderr}`);
  assert.equal(silenced.stdout.trim(), '');
});

test('hook clean path is silent exit 0', async () => {
  const dir = await repoFixture();
  const result = await runGuard(dir, { hook: true, stdin: '{"stop_hook_active": false}' });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.equal(result.stdout.trim(), '');
  assert.equal(result.stderr.trim(), '');
});

// --- BLOCK-2 regression: non-ASCII subjects reach both guard modes ---

test('observer reports a changed non-ASCII governed artifact by its real path', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'café-spec.md'), SPEC_BODY);
  const result = await runGuard(dir, { hook: true, stdin: '{"stop_hook_active": false}' });
  assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /specs\/café-spec\.md/);
  assert.doesNotMatch(result.stderr, /\\303|\\251/, 'no octal-escaped mangling');
});

test('supervisor holds on a changed non-ASCII subject instead of passing over it', async () => {
  const dir = await repoFixture();
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'café-spec.md'), SPEC_BODY);
  await writeCursor(dir, '20260728-140000-cafe',
    openCursor('20260728-140000-cafe', ['specs/café-spec.md']));
  const direct = await runGuard(dir);
  assert.equal(direct.status, 3, `an unreviewed non-ASCII change must not exit 0: ${direct.stdout}${direct.stderr}`);
  assert.match(direct.stdout, /specs\/café-spec\.md/);
  const hook = await runGuard(dir, { hook: true, stdin: '{"stop_hook_active": false}' });
  assert.equal(hook.status, 0);
  const decision = JSON.parse(hook.stdout.trim());
  assert.equal(decision.decision, 'block');
  assert.match(decision.reason, /specs\/café-spec\.md/);
});


// --- LOW e: report-line hygiene — no report element may break its line ---

test('a newline in a run-directory name cannot break the stderr report lines', async () => {
  const dir = await repoFixture();
  const evil = 'bad\nname';
  await mkdir(join(dir, '.grove', 'runs', evil), { recursive: true });
  await writeFile(
    join(dir, '.grove', 'runs', evil, 'cursor.toml'),
    'schema = 1\nstatus = "open"\n',
  );
  const result = await runGuard(dir);
  assert.equal(result.status, 2, `${result.stdout}${result.stderr}`);
  for (const line of result.stderr.trim().split('\n')) {
    assert.match(line, /^grove-guard/, `orphan continuation line: ${JSON.stringify(line)}`);
  }
});

test('a multi-line parse-error token cannot break a defect line', async () => {
  const dir = await repoFixture();
  const runId = '20260728-140000-badrecord';
  await mkdir(join(dir, '.grove', 'runs', runId, 'records'), { recursive: true });
  // An unquoted multi-line array token: the parser error embeds the token,
  // newlines included.
  await writeFile(
    join(dir, '.grove', 'runs', runId, 'records', 'broken.toml'),
    'schema = 1\nsubject = [\n  junk token\n  spanning lines\n]\n',
  );
  const result = await runGuard(dir);
  assert.equal(result.status, 2, `${result.stdout}${result.stderr}`);
  for (const line of result.stderr.trim().split('\n')) {
    assert.match(line, /^grove-guard/, `orphan continuation line: ${JSON.stringify(line)}`);
  }
});

// --- R6: the status probe is bounded to the ROOT table ---
// Found by review against 6c0ba93, and it is the READ twin of the cursor-EDIT
// bug fixed the round before: editCursorText was scoped to the root table
// while probeStatus still scanned the whole file. A cursor whose ROOT carries
// no `status` but which holds `status = "closed"` inside a `[[claims]]` table
// answered "closed", so the fail-closed rule ("an unreadable status is open
// for mode selection") never fired and the hook left supervisor mode.

const SMUGGLED_STATUS = (runId, smuggled) =>
  `schema = 1\nrun = "${runId}"\nopened = "2026-07-28T14:00:00Z"\n`
  + 'intent = "root status is missing"\nsubjects = ["specs/changed.md"]\n'
  + `\n[[claims]]\nstatus = "${smuggled}"\n`;

test('R6 — a status smuggled into a [[claims]] table cannot take the guard out of supervisor mode', async () => {
  for (const smuggled of ['closed', 'aborted']) {
    const dir = await repoFixture();
    await mkdir(join(dir, 'specs'), { recursive: true });
    await writeFile(join(dir, 'specs', 'changed.md'), SPEC_BODY);
    const runId = `20260728-140000-${smuggled}`;
    await writeCursor(dir, runId, SMUGGLED_STATUS(runId, smuggled));

    // Direct CLI: the malformed cursor is a defect either way.
    const direct = await runGuard(dir);
    assert.equal(direct.status, 2, `${direct.stdout}${direct.stderr}`);
    assert.match(direct.stderr, new RegExp(runId));

    // The load-bearing half: through the hook it must HOLD. A non-root status
    // used to select observer mode, which reports without ever blocking.
    const hook = await runGuard(dir, { hook: true, stdin: '{"stop_hook_active": false}' });
    assert.equal(
      hook.status, 0,
      `${smuggled}: expected a supervisor hold, got ${hook.status}: ${hook.stdout}${hook.stderr}`,
    );
    const decision = JSON.parse(hook.stdout.trim());
    assert.equal(decision.decision, 'block', `${smuggled}: the hook must hold`);
    assert.match(decision.reason, new RegExp(runId));
    assert.doesNotMatch(hook.stderr, /observer/, 'observer mode is the bug, not the behaviour');
  }
});

test('R6 — a ROOT status still reads normally; the bound narrows nothing legitimate', async () => {
  // The over-correction guard: bounding the scan must not stop the probe from
  // reading a status that really is at the root.
  const dir = await repoFixture();
  const runId = '20260728-150000-rooted';
  // Root says closed but carries no `closed` timestamp, so parseCursor fails
  // and the probe is what decides the mode: closed => not open => observer.
  await writeCursor(dir, runId, `schema = 1\nrun = "${runId}"\nstatus = "closed"\n`);
  const hook = await runGuard(dir, { hook: true, stdin: '{"stop_hook_active": false}' });
  assert.equal(hook.status, 1, `${hook.stdout}${hook.stderr}`);
  assert.equal(hook.stdout.trim(), '', 'a non-open root status does not hold');
  assert.match(hook.stderr, new RegExp(runId), 'the defect is still reported');
});
