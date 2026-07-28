// Upstream: spec-0006-voluntary-dispatch@v2 INV11, INV16 (deterministic
// classification and record matching); AC7 (mechanical half); S16.
// Decision: adr-0046-how-dispatch-rules-reach-a-session.
//
// AC7's behavioral half — the change-request verdict report staying owed
// (INV12) — is a duty on sessions, not machinery; it has no test here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';

import {
  EMPTY_SHA256,
  classifyContent,
  collectRecords,
  computeEnabled,
  deriveChangeSet,
  parseStatusZ,
  validateRecord,
  recordSatisfies,
} from '../../../../../plugins/grove/runtime/dispatch/lib/guard-core.mjs';
import {
  RUN_ID,
  minimalAbortedCursor,
  parseCursor,
  serializeCursor,
} from '../../../../../plugins/grove/runtime/dispatch/lib/cursor.mjs';
import { loadTransitions } from '../../../../../plugins/grove/runtime/dispatch/lib/transitions.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const scratch = [];
after(async () => {
  await Promise.all(scratch.map((dir) => rm(dir, { recursive: true, force: true })));
});

const git = (dir, ...args) =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });

async function gitFixture({ defaultBranch = 'main' } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'grove-guard-core-'));
  scratch.push(dir);
  git(dir, 'init', '-q', '-b', defaultBranch);
  git(dir, 'config', 'user.email', 'fixture@example.invalid');
  git(dir, 'config', 'user.name', 'Fixture');
  return dir;
}

async function shippedTransitions() {
  return loadTransitions(await readFile(
    join(REPOSITORY_ROOT, 'plugins/grove/reference/dispatch/transitions.toml'),
    'utf8',
  ));
}

function record(overrides = {}) {
  return {
    schema: 1,
    record_type: 'conformance',
    subject: 'specs/thing.md',
    subject_state: 'present',
    subject_sha256: sha256('bytes'),
    verdict: 'PASS',
    by: 'conformance-reviewer',
    date: '2026-07-28T15:10:00Z',
    ...overrides,
  };
}

// --- subject classification (deterministic, frontmatter-derived) ---

test('classification: every table row, missing before every byte-derived row', () => {
  assert.deepEqual(classifyContent(null).classes, ['missing']);

  const artifact = (type, extra = '') =>
    `---\nid: x\ntype: ${type}\nstatus: draft\n${extra}---\n\nbody\n`;
  assert.deepEqual(classifyContent(artifact('adr')).classes, ['decision']);
  assert.deepEqual(classifyContent(artifact('spec')).classes, ['spec']);
  assert.deepEqual(classifyContent(artifact('charter')).classes, ['charter']);
  assert.deepEqual(classifyContent(artifact('research')).classes, ['reviewless']);
  assert.deepEqual(classifyContent(artifact('feedback')).classes, ['reviewless']);
  assert.deepEqual(classifyContent(artifact('novel-type')).classes, ['unclaimed']);
  assert.deepEqual(
    classifyContent('---\nid: x\nstatus: draft\n---\nno type\n').classes,
    ['unclaimed'],
  );
  assert.deepEqual(classifyContent('plain code, no frontmatter\n').classes, ['code']);
  assert.deepEqual(classifyContent('').classes, ['code']);
});

test('classification: implements-bearing overlays the base class, only when non-empty', () => {
  const bearing = classifyContent(
    '---\nid: x\ntype: spec\nimplements: adr-0046-x\nstatus: gated\n---\nbody\n',
  );
  assert.deepEqual([...bearing.classes].sort(), ['implements-bearing', 'spec']);

  const emptyImplements = classifyContent(
    '---\nid: x\ntype: spec\nimplements:\nstatus: gated\n---\nbody\n',
  );
  assert.deepEqual(emptyImplements.classes, ['spec']);

  const bearingCode = classifyContent(
    '---\nid: x\nimplements: adr-1\n---\nbody\n',
  );
  assert.ok(bearingCode.classes.includes('implements-bearing'));
  assert.ok(bearingCode.classes.includes('unclaimed'));
});

// --- derived change set (one derivation, both modes) ---

test('derived change set: uncommitted changes plus commits off the merge-base with local main', async () => {
  const dir = await gitFixture();
  await writeFile(join(dir, 'base.md'), 'base\n');
  await writeFile(join(dir, 'to-delete.md'), 'delete me\n');
  await writeFile(join(dir, 'to-edit.md'), 'v1\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'work');
  await writeFile(join(dir, 'committed-on-branch.md'), 'branch\n');
  git(dir, 'add', 'committed-on-branch.md');
  git(dir, 'rm', '-q', 'to-delete.md');
  git(dir, 'commit', '-q', '-m', 'branch work');
  await writeFile(join(dir, 'to-edit.md'), 'v2 uncommitted\n');
  await writeFile(join(dir, 'untracked-new.md'), 'new\n');

  const changed = await deriveChangeSet({ repoRoot: dir });
  assert.deepEqual(
    [...changed].sort(),
    ['committed-on-branch.md', 'to-delete.md', 'to-edit.md', 'untracked-new.md'],
  );
  assert.equal(changed.has('base.md'), false, 'untouched base file is not a change');
});

test('derived change set: on the default branch itself only uncommitted changes remain', async () => {
  const dir = await gitFixture();
  await writeFile(join(dir, 'settled.md'), 'settled\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  await writeFile(join(dir, 'wip.md'), 'wip\n');
  const changed = await deriveChangeSet({ repoRoot: dir });
  assert.deepEqual([...changed].sort(), ['wip.md']);
});

test('derived change set: no origin/HEAD and no local main is an internal error, never a guess', async () => {
  const dir = await gitFixture({ defaultBranch: 'trunk' });
  await writeFile(join(dir, 'a.md'), 'a\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  await assert.rejects(
    deriveChangeSet({ repoRoot: dir }),
    (error) => error.guardInternal === true && /origin\/HEAD|main/.test(error.message),
  );
});

// --- record matching: the path + state + digest triple ---

test('a record counts only while path, state, and digest all bind (S16 digest shed)', () => {
  const bytes = 'reviewed bytes\n';
  const current = record({ subject: 'specs/a.md', subject_sha256: sha256(bytes) });
  assert.equal(validateRecord(current).ok, true);
  assert.equal(
    recordSatisfies({
      record: current,
      subject: 'specs/a.md',
      state: 'present',
      sha256: sha256(bytes),
    }),
    true,
  );
  // S16: the subject's bytes change — the record sheds deterministically.
  assert.equal(
    recordSatisfies({
      record: current,
      subject: 'specs/a.md',
      state: 'present',
      sha256: sha256('edited bytes\n'),
    }),
    false,
  );
});

test('state mismatch sheds: an absence record does not survive a zero-byte file at its path', () => {
  const absence = record({
    subject: 'specs/gone.md',
    subject_state: 'absent',
    subject_sha256: EMPTY_SHA256,
  });
  assert.equal(validateRecord(absence).ok, true);
  assert.equal(
    recordSatisfies({
      record: absence, subject: 'specs/gone.md', state: 'absent', sha256: null,
    }),
    true,
  );
  // A zero-byte file lands at the path: same digest by construction, but the
  // declared state no longer matches — review is re-owed (the resurrect case).
  assert.equal(
    recordSatisfies({
      record: absence, subject: 'specs/gone.md', state: 'present', sha256: EMPTY_SHA256,
    }),
    false,
  );
  // And the re-owed present-empty record never satisfies the absence side.
  const presentEmpty = record({
    subject: 'specs/gone.md',
    subject_state: 'present',
    subject_sha256: EMPTY_SHA256,
  });
  assert.equal(
    recordSatisfies({
      record: presentEmpty, subject: 'specs/gone.md', state: 'absent', sha256: null,
    }),
    false,
  );
});

test('a digest-matched record never satisfies a different subject (sentinel collision)', () => {
  // Two deletions share the absence sentinel by construction; one reviewed
  // deletion must not silence the other.
  const reviewedDeletion = record({
    subject: 'specs/deleted-a.md',
    subject_state: 'absent',
    subject_sha256: EMPTY_SHA256,
  });
  assert.equal(
    recordSatisfies({
      record: reviewedDeletion,
      subject: 'specs/deleted-b.md',
      state: 'absent',
      sha256: null,
    }),
    false,
  );
});

test('a record lacking subject_state — or otherwise schema-invalid — satisfies nothing', () => {
  const missingState = record();
  delete missingState.subject_state;
  assert.equal(validateRecord(missingState).ok, false);

  const unknownType = record({ record_type: 'human-approval' });
  assert.equal(validateRecord(unknownType).ok, false);

  const badDigest = record({ subject_sha256: 'not-hex' });
  assert.equal(validateRecord(badDigest).ok, false);

  const extraKey = record({ grade: 'A' });
  assert.equal(validateRecord(extraKey).ok, false, 'undeclared keys fail closed');
});

test('record lookup spans every run records directory, closed and aborted runs included', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-guard-records-'));
  scratch.push(dir);
  const runs = join(dir, '.grove', 'runs');
  const bytes = 'still-current bytes\n';
  const mkRecord = (state = 'present') => serializeRecordToml(record({
    subject: 'specs/kept.md',
    subject_state: state,
    subject_sha256: sha256(bytes),
  }));
  await mkdir(join(runs, '20260101-000000-closed-run', 'records'), { recursive: true });
  await mkdir(join(runs, '20260102-000000-aborted-run', 'records'), { recursive: true });
  await mkdir(join(runs, '20260103-000000-open-run', 'records'), { recursive: true });
  await writeFile(
    join(runs, '20260101-000000-closed-run', 'records', 'conformance.toml'),
    mkRecord(),
  );
  await writeFile(
    join(runs, '20260102-000000-aborted-run', 'records', 'aborted-era.toml'),
    serializeRecordToml(record({
      record_type: 'code-review',
      by: 'code-reviewer',
      subject: 'specs/kept.md',
      subject_sha256: sha256(bytes),
    })),
  );
  await writeFile(
    join(runs, '20260103-000000-open-run', 'records', 'bad-type.toml'),
    serializeRecordToml(record({ record_type: 'vibes' })),
  );

  const { records, defects } = await collectRecords({ repoRoot: dir });
  assert.equal(records.length, 2, 'valid records from closed AND aborted runs');
  assert.deepEqual(
    records.map((item) => item.record.record_type).sort(),
    ['code-review', 'conformance'],
  );
  assert.equal(defects.length, 1, 'unknown record_type is a defect');
  assert.match(defects[0].reason, /record_type|vibes/);
  assert.match(defects[0].path, /bad-type\.toml/);
});

// --- enabled-and-unfired computation over the shipped rules ---

test('enabled-and-unfired: changed implements-bearing spec owes conformance and spec-adversary', async () => {
  const transitions = await shippedTransitions();
  const bytes = '---\nid: s\ntype: spec\nimplements: adr-1\nstatus: gated\n---\nbody\n';
  const subject = {
    path: 'specs/s.md',
    state: 'present',
    sha256: sha256(bytes),
    classes: classifyContent(bytes).classes,
    changed: true,
  };
  const none = computeEnabled({ transitions, subjects: [subject], records: [] });
  assert.deepEqual(
    none.map((item) => item.id).sort(),
    ['t-conformance', 't-spec-quality'],
  );
  assert.ok(none.every((item) => item.subject === 'specs/s.md'));
  assert.ok(none.every((item) => item.missingRecordType));

  // A current conformance record fires t-conformance's token; only the
  // spec-quality instance stays enabled.
  const satisfied = computeEnabled({
    transitions,
    subjects: [subject],
    records: [record({ subject: 'specs/s.md', subject_sha256: sha256(bytes) })],
  });
  assert.deepEqual(satisfied.map((item) => item.id), ['t-spec-quality']);

  // An untouched subject enables nothing and never blocks close.
  const untouched = computeEnabled({
    transitions,
    subjects: [{ ...subject, changed: false }],
    records: [],
  });
  assert.deepEqual(untouched, []);
});

test('enabled-and-unfired: a missing subject owes the full set, fail closed', async () => {
  const transitions = await shippedTransitions();
  const subject = {
    path: 'specs/gone.md',
    state: 'absent',
    sha256: null,
    classes: ['missing'],
    changed: true,
  };
  const enabled = computeEnabled({ transitions, subjects: [subject], records: [] });
  assert.deepEqual(
    enabled.map((item) => item.id).sort(),
    ['t-code-quality', 't-conformance', 't-decision-quality', 't-spec-quality'],
  );
});

test('a stale record (digest mismatch) leaves no-record true — S16 re-enables the transition', async () => {
  const transitions = await shippedTransitions();
  const bytes = 'code v2\n';
  const subject = {
    path: 'lib/x.mjs',
    state: 'present',
    sha256: sha256(bytes),
    classes: ['code'],
    changed: true,
  };
  const enabled = computeEnabled({
    transitions,
    subjects: [subject],
    records: [record({
      subject: 'lib/x.mjs',
      subject_sha256: sha256('code v1\n'),
      record_type: 'conformance',
    })],
  });
  assert.ok(enabled.some((item) => item.id === 't-conformance'));
});

// --- cursor contract (INV7 grammar, minimal aborted shape) ---

test('run-id grammar and cursor parse/validate/serialize round-trip', () => {
  assert.match('20260728-140322-voluntary-dispatch', RUN_ID);
  assert.doesNotMatch('2026-07-28-voluntary', RUN_ID);
  assert.doesNotMatch('20260728-140322-', RUN_ID);
  assert.doesNotMatch('20260728-140322-UPPER', RUN_ID);

  const cursor = {
    schema: 1,
    run: '20260728-140322-fixture-run',
    opened: '2026-07-28T14:03:22Z',
    intent: 'land the fixture',
    subjects: ['specs/a.md'],
    status: 'open',
  };
  const parsed = parseCursor(serializeCursor(cursor), {
    runId: '20260728-140322-fixture-run',
  });
  assert.equal(parsed.ok, true, parsed.reason);
  assert.deepEqual(parsed.cursor.subjects, ['specs/a.md']);
  assert.equal(parsed.claimsPresent, false);
});

test('cursor validation: run/directory mismatch, bad status, and undeclared keys fail; claims is flagged', () => {
  const base = 'schema = 1\nrun = "20260728-140322-r"\nopened = "2026-07-28T14:03:22Z"\n'
    + 'intent = "x"\nsubjects = ["a.md"]\nstatus = "open"\n';
  assert.equal(parseCursor(base, { runId: '20260728-140322-other' }).ok, false);
  assert.equal(
    parseCursor(base.replace('"open"', '"paused"'), { runId: '20260728-140322-r' }).ok,
    false,
  );
  assert.equal(
    parseCursor(`${base}itinerary = "next"\n`, { runId: '20260728-140322-r' }).ok,
    false,
  );
  const withClaims = parseCursor(`${base}claims = ["a.md"]\n`, {
    runId: '20260728-140322-r',
  });
  assert.equal(withClaims.ok, true, 'claims is a defect, not a parse failure');
  assert.equal(withClaims.claimsPresent, true);
});

test('the minimal aborted replacement shape is schema-valid, never a standing defect', () => {
  const text = minimalAbortedCursor({
    runId: '20260728-140322-dead-run',
    closed: '2026-07-28T18:00:00Z',
    reason: 'unparseable cursor aborted by user',
  });
  const parsed = parseCursor(text, { runId: '20260728-140322-dead-run' });
  assert.equal(parsed.ok, true, parsed.reason);
  assert.equal(parsed.cursor.status, 'aborted');
  assert.equal(typeof parsed.cursor.closed, 'string');
  assert.equal(typeof parsed.cursor.reason, 'string');
});

function serializeRecordToml(value) {
  return Object.entries(value)
    .map(([key, item]) =>
      `${key} = ${typeof item === 'number' ? item : JSON.stringify(item)}`)
    .join('\n') + '\n';
}

// --- BLOCK-2 regression: non-ASCII paths must enter the change set intact.
// git's default core.quotePath C-style-escapes them ("caf\303\251"); parsing
// that quoted form dropped the real path, and both guard modes then silently
// passed over an unreviewed change — the exact fail-open class this spec
// exists to prevent.

test('a non-ASCII subject path enters the derived change set intact', async () => {
  const dir = await gitFixture();
  await writeFile(join(dir, 'base.md'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'work');
  await mkdir(join(dir, 'specs'), { recursive: true });
  // Untracked (uncommitted) non-ASCII path…
  await writeFile(join(dir, 'specs', 'café-spec.md'), 'uncommitted\n');
  const uncommitted = await deriveChangeSet({ repoRoot: dir });
  assert.ok(
    uncommitted.has('specs/café-spec.md'),
    `expected specs/café-spec.md in ${JSON.stringify([...uncommitted])}`,
  );
  // …and a committed one.
  await writeFile(join(dir, 'specs', 'präzision.md'), 'committed\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'non-ascii');
  const committed = await deriveChangeSet({ repoRoot: dir });
  assert.ok(
    committed.has('specs/präzision.md'),
    `expected specs/präzision.md in ${JSON.stringify([...committed])}`,
  );
  assert.ok(committed.has('specs/café-spec.md'));
});

// --- MEDIUM d: a repoRoot that is not the repository toplevel is an
// internal error, never an empty change set that silently passes.

test('a subdirectory repoRoot is an internal error, not an empty-and-passing change set', async () => {
  const dir = await gitFixture();
  await writeFile(join(dir, 'base.md'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  await mkdir(join(dir, 'specs'), { recursive: true });
  await writeFile(join(dir, 'specs', 'inner.md'), 'inner\n');
  await assert.rejects(
    deriveChangeSet({ repoRoot: join(dir, 'specs') }),
    (error) => error.guardInternal === true && /toplevel|repository root/i.test(error.message),
  );
  // The toplevel itself still derives normally.
  const ok = await deriveChangeSet({ repoRoot: dir });
  assert.ok(ok.has('specs/inner.md'));
});

// --- MEDIUM f: YAML block-style implements lists classify implements-bearing
// (a block list read as an empty scalar was a fail-open in the exact
// direction the spec exists to prevent).

test('a block-style implements list classifies implements-bearing; an empty key does not', () => {
  const blockList = classifyContent(
    '---\nid: x\ntype: spec\nimplements:\n  - adr-0046-how-dispatch-rules-reach-a-session\nstatus: gated\n---\nbody\n',
  );
  assert.deepEqual([...blockList.classes].sort(), ['implements-bearing', 'spec']);

  const multiItem = classifyContent(
    '---\nid: x\ntype: spec\nimplements:\n  - adr-0001-a\n  - adr-0002-b\nstatus: gated\n---\nbody\n',
  );
  assert.ok(multiItem.classes.includes('implements-bearing'));

  const emptyKey = classifyContent(
    '---\nid: x\ntype: spec\nimplements:\nstatus: gated\n---\nbody\n',
  );
  assert.deepEqual(emptyKey.classes, ['spec'], 'a bare key with no items is not bearing');
});
// --- BLOCK-2 residual: renames/copies in EITHER porcelain column ---
// Case list DERIVED FROM git's status --porcelain v1 -z format (git-status
// documentation + probed git 2.39): every entry is "XY PATH" NUL-terminated,
// and when EITHER the index column X or the worktree column Y is R or C, ONE
// extra NUL-terminated token follows carrying the ORIGINAL path. Both paths
// are changes. Probed live: `git mv` -> "R  new\0old"; `mv old new &&
// git add -N new` -> " R new\0old"; rename+edit -> "R  new\0old".

test('parseStatusZ: every documented column case, both rename halves in the set', () => {
  const NUL = '\0';
  const cases = [
    ['staged rename (X=R)', `R  new.md${NUL}old.md${NUL}`, ['new.md', 'old.md']],
    ['worktree rename (Y=R)', ` R new.md${NUL}old.md${NUL}`, ['new.md', 'old.md']],
    ['staged copy (X=C)', `C  copy.md${NUL}orig.md${NUL}`, ['copy.md', 'orig.md']],
    ['worktree copy (Y=C)', ` C copy.md${NUL}orig.md${NUL}`, ['copy.md', 'orig.md']],
    ['rename then modified (X=R, Y=M)', `RM new.md${NUL}old.md${NUL}`, ['new.md', 'old.md']],
    ['plain modified', ` M plain.md${NUL}`, ['plain.md']],
    ['untracked', `?? fresh.md${NUL}`, ['fresh.md']],
    ['deleted', ` D gone.md${NUL}`, ['gone.md']],
    [
      'rename followed by an ordinary entry (stream stays in sync)',
      `R  new.md${NUL}old.md${NUL} M after.md${NUL}`,
      ['new.md', 'old.md', 'after.md'],
    ],
    [
      'worktree rename followed by an ordinary entry (stream stays in sync)',
      ` R new.md${NUL}old.md${NUL}?? after.md${NUL}`,
      ['new.md', 'old.md', 'after.md'],
    ],
  ];
  for (const [name, stream, expected] of cases) {
    assert.deepEqual([...parseStatusZ(stream)].sort(), [...expected].sort(), name);
  }
});

test('a staged rename puts BOTH halves in the derived change set (R100-like and R050-like)', async () => {
  const dir = await gitFixture();
  await writeFile(join(dir, 'old.md'), 'stable content for rename detection\n');
  await writeFile(join(dir, 'second.md'), 'another stable body for rename detection\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'work');
  // Exact rename (R100-like).
  git(dir, 'mv', 'old.md', 'new.md');
  // Rename with an edit on top (R050-like: still X=R with a worktree edit).
  git(dir, 'mv', 'second.md', 'renamed-second.md');
  await writeFile(join(dir, 'renamed-second.md'), 'another stable body for rename detection\nedited\n');
  const changed = await deriveChangeSet({ repoRoot: dir });
  for (const path of ['old.md', 'new.md', 'second.md', 'renamed-second.md']) {
    assert.ok(changed.has(path), `${path} in ${JSON.stringify([...changed])}`);
  }
});

test('a worktree-side rename (mv + add -N) puts BOTH halves in the derived change set', async () => {
  const dir = await gitFixture();
  await writeFile(join(dir, 'tracked.md'), 'stable content for rename detection\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'work');
  const { rename } = await import('node:fs/promises');
  await rename(join(dir, 'tracked.md'), join(dir, 'moved.md'));
  git(dir, 'add', '-N', 'moved.md');
  // Probed: this git emits " R moved.md\0tracked.md" — the Y-column rename.
  const changed = await deriveChangeSet({ repoRoot: dir });
  assert.ok(changed.has('moved.md'), JSON.stringify([...changed]));
  assert.ok(
    changed.has('tracked.md'),
    `the OLD half of a worktree rename is an unreviewed deletion and must not vanish: ${JSON.stringify([...changed])}`,
  );
});

// Case list DERIVED FROM YAML's block-sequence rules: for a top-level
// (column-0) mapping key, sequence items are valid at column 0 AND at any
// deeper indentation, and item indentation may vary entry to entry. The
// previous lookahead required indentation, so a column-0 list — valid
// YAML — classified not-bearing (fail-open).
test('block-style implements lists classify bearing at every YAML-legal indentation', () => {
  const cases = {
    'column-0 items': '---\nid: x\ntype: spec\nimplements:\n- adr-0001-a\nstatus: gated\n---\nbody\n',
    'indented items': '---\nid: x\ntype: spec\nimplements:\n  - adr-0001-a\nstatus: gated\n---\nbody\n',
    'mixed indentation': '---\nid: x\ntype: spec\nimplements:\n- adr-0001-a\n    - adr-0002-b\nstatus: gated\n---\nbody\n',
  };
  for (const [name, body] of Object.entries(cases)) {
    const classified = classifyContent(body);
    assert.ok(
      classified.classes.includes('implements-bearing'),
      `${name}: ${JSON.stringify(classified.classes)}`,
    );
    assert.ok(classified.classes.includes('spec'), name);
  }
  // The frontmatter terminator is never consumed as an item: a bare key
  // directly above --- stays non-bearing.
  const terminator = classifyContent('---\nid: x\ntype: spec\nimplements:\n---\nbody\n');
  assert.deepEqual(terminator.classes, ['spec']);
});
