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
  bindSubject,
  classifyContent,
  collectRecords,
  computeEnabled,
  deriveChangeSet,
  digestTagList,
  parseStatusZ,
  subjectDigest,
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

// Declared before its uses (it sat below them, TDZ-safe only because
// node:test defers every callback — one eager top-level use away from a
// crash).
const SPEC_LIKE_BODY = '---\nid: s\ntype: spec\nstatus: gated\n---\nbody\n';

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

// --- P1-B: the digest binds the subject's ACTUAL bytes (INV11/AC7) ---
// Entry-type case list DERIVED FROM node:fs lstat's documented types:
// regular file, symbolic link, directory, and everything else as one
// fail-closed "other" bucket. The previous readFile(path, "utf8") followed
// symlinks, lossily replaced invalid UTF-8, and read a dangling symlink as
// ENOENT — three fail-opens.

test('P1-B — a symlink subject hashes its link target, so retargeting sheds the record', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-bind-symlink-'));
  scratch.push(dir);
  const identical = 'byte-identical content\n';
  await writeFile(join(dir, 'first.md'), identical);
  await writeFile(join(dir, 'second.md'), identical);
  const { symlink, rm: rmf } = await import('node:fs/promises');
  await symlink('first.md', join(dir, 'link.md'));
  const before = await bindSubject({ repoRoot: dir, path: 'link.md', changeSet: new Set(['link.md']) });
  assert.equal(before.state, 'present', 'a symlink is present');
  await rmf(join(dir, 'link.md'));
  await symlink('second.md', join(dir, 'link.md'));
  const after = await bindSubject({ repoRoot: dir, path: 'link.md', changeSet: new Set(['link.md']) });
  assert.notEqual(
    before.sha256, after.sha256,
    'retargeting between identical-content files MUST change the digest — the subject IS the link',
  );
  assert.equal(
    recordSatisfies({
      record: record({ subject: 'link.md', subject_sha256: before.sha256 }),
      subject: 'link.md',
      state: after.state,
      sha256: after.sha256,
    }),
    false,
    'the stale verdict sheds',
  );
});

test('P1-B — invalid UTF-8 bytes bind exactly: different invalid bytes, different digests', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-bind-bytes-'));
  scratch.push(dir);
  // 0xFF and 0xFE each lossily decode to one U+FFFD — identical under the
  // old utf8 read, distinct as raw bytes.
  await writeFile(join(dir, 'bin.md'), Buffer.from([0xff]));
  const first = await bindSubject({ repoRoot: dir, path: 'bin.md', changeSet: new Set(['bin.md']) });
  await writeFile(join(dir, 'bin.md'), Buffer.from([0xfe]));
  const second = await bindSubject({ repoRoot: dir, path: 'bin.md', changeSet: new Set(['bin.md']) });
  assert.notEqual(first.sha256, second.sha256, 'raw bytes, not lossy replacement chars');
});

test('P1-B — a dangling symlink is present, never absent; an absence record cannot satisfy it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-bind-dangling-'));
  scratch.push(dir);
  const { symlink } = await import('node:fs/promises');
  await symlink('never-existed.md', join(dir, 'ghost.md'));
  const bound = await bindSubject({ repoRoot: dir, path: 'ghost.md', changeSet: new Set(['ghost.md']) });
  assert.equal(bound.state, 'present', 'a dangling symlink is an existing entry');
  assert.equal(
    recordSatisfies({
      record: record({
        subject: 'ghost.md',
        subject_state: 'absent',
        subject_sha256: EMPTY_SHA256,
      }),
      subject: 'ghost.md',
      state: bound.state,
      sha256: bound.sha256,
    }),
    false,
  );
});

// R4 supersedes P1-B's no-churn claim, deliberately. P1-B pinned "for valid
// UTF-8 the raw-byte digest equals the string digest every existing record
// used" — true then, FALSE now: tagging the regular-file side (the other half
// of M1's domain separation) changes every regular-file digest. The churn is
// the price of closing the collision, and it is fail-closed in the only
// direction that matters: an old untagged record is SHED and re-owes its
// review; it can never newly satisfy something it did not review.
test('R4 — a regular-file digest is tagged, so an untagged pre-tag record is shed, never honoured', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-bind-stable-'));
  scratch.push(dir);
  await writeFile(join(dir, 'plain.md'), SPEC_LIKE_BODY);
  const bound = await bindSubject({ repoRoot: dir, path: 'plain.md', changeSet: new Set() });
  assert.equal(bound.state, 'present');
  assert.equal(
    bound.sha256, subjectDigest('file', Buffer.from(SPEC_LIKE_BODY)),
    'the bound digest is the tagged one the shipped constructor produces',
  );
  assert.notEqual(
    bound.sha256, sha256(SPEC_LIKE_BODY),
    'the untagged byte hash is no longer what a regular file binds to',
  );
  const preTagRecord = record({
    subject: 'plain.md', subject_sha256: sha256(SPEC_LIKE_BODY),
  });
  assert.equal(
    recordSatisfies({
      record: preTagRecord, subject: 'plain.md', state: 'present', sha256: bound.sha256,
    }),
    false,
    'churn is a SHED: the pre-tag record stops satisfying and re-owes its review',
  );
  assert.deepEqual(bound.classes, ['spec']);
});

test('P1-B — entry-type rules are stated: directory stays absent/missing; symlink classifies unclaimed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-bind-types-'));
  scratch.push(dir);
  await mkdir(join(dir, 'a-directory.md'));
  const asDir = await bindSubject({ repoRoot: dir, path: 'a-directory.md', changeSet: new Set() });
  assert.equal(asDir.state, 'absent', 'a directory at a FILE subject path: the file is absent (rule as before, now stated)');
  assert.deepEqual(asDir.classes, ['missing']);

  const { symlink } = await import('node:fs/promises');
  await writeFile(join(dir, 'target.md'), SPEC_LIKE_BODY);
  await symlink('target.md', join(dir, 'link.md'));
  const asLink = await bindSubject({ repoRoot: dir, path: 'link.md', changeSet: new Set() });
  assert.deepEqual(
    asLink.classes, ['unclaimed'],
    'a symlink classifies fail-closed unclaimed (owes the full set) — never code by accident, never by dereferencing',
  );

  // L5: the two entry shapes the case list left unstated. A symlink to a
  // DIRECTORY is a symlink (lstat never follows), not the directory row; a
  // hard link IS a regular file and binds exactly like one.
  await mkdir(join(dir, 'real-directory'));
  await symlink('real-directory', join(dir, 'link-to-directory.md'));
  const toDirectory = await bindSubject({
    repoRoot: dir, path: 'link-to-directory.md', changeSet: new Set(),
  });
  assert.equal(toDirectory.state, 'present', 'a symlink to a directory is the LINK, present');
  assert.deepEqual(toDirectory.classes, ['unclaimed']);
  assert.notEqual(
    toDirectory.sha256,
    (await bindSubject({ repoRoot: dir, path: 'link.md', changeSet: new Set() })).sha256,
    'its digest is its own target, not a shared directory constant',
  );

  const { link } = await import('node:fs/promises');
  await link(join(dir, 'target.md'), join(dir, 'hard-link.md'));
  const hard = await bindSubject({ repoRoot: dir, path: 'hard-link.md', changeSet: new Set() });
  assert.equal(hard.state, 'present');
  assert.equal(
    hard.sha256, subjectDigest('file', Buffer.from(SPEC_LIKE_BODY)),
    'a hard link binds as the regular file it is',
  );
  assert.deepEqual(hard.classes, ['spec']);
});

// --- BLOCK-2 / M1 / L4 / L1: the digest of every entry kind ---

test('BLOCK-2 — a symlink target binds its RAW bytes: distinct invalid UTF-8 targets never collide', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-bind-linkbytes-'));
  scratch.push(dir);
  const { symlink } = await import('node:fs/promises');
  // 0xFF and 0xFE each lossily decode to one U+FFFD, so a utf8 readlink gave
  // these two links ONE digest (measured on APFS:
  // 0b37743370331e33808c0dd0167563798a3c324504cf0055d2b0ac81578d2c58 for both)
  // — verbatim the fault the raw-buffer file read was introduced to remove.
  await symlink(Buffer.from([0x78, 0xff, 0x79]), join(dir, 'first.md'));
  await symlink(Buffer.from([0x78, 0xfe, 0x79]), join(dir, 'second.md'));
  const first = await bindSubject({ repoRoot: dir, path: 'first.md', changeSet: new Set() });
  const second = await bindSubject({ repoRoot: dir, path: 'second.md', changeSet: new Set() });
  assert.equal(first.state, 'present');
  assert.notEqual(
    first.sha256, second.sha256,
    'retargeting between byte-distinct targets MUST change the digest, invalid UTF-8 included',
  );
});

test('M1 — a symlink digest is domain-separated from a regular file holding the same bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-bind-domain-'));
  scratch.push(dir);
  const { symlink } = await import('node:fs/promises');
  await writeFile(join(dir, 'target.txt'), 'target.txt'); // no trailing newline
  await writeFile(join(dir, 'twin.md'), 'target.txt');
  await symlink('target.txt', join(dir, 'link.md'));

  const asFile = await bindSubject({ repoRoot: dir, path: 'twin.md', changeSet: new Set() });
  const asLink = await bindSubject({ repoRoot: dir, path: 'link.md', changeSet: new Set() });
  assert.notEqual(
    asLink.sha256, asFile.sha256,
    'an untagged link digest equalled the file digest (199b3bad…), so a record survived the swap',
  );
  assert.equal(
    recordSatisfies({
      record: record({
        subject: 'x.md', record_type: 'code-review', subject_sha256: asFile.sha256,
      }),
      subject: 'x.md',
      state: asLink.state,
      sha256: asLink.sha256,
    }),
    false,
    'a record taken on the regular file cannot satisfy the symlink that replaced it',
  );
});

test('L4 — a non-regular entry digests a constant naming its exact kind', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-bind-kind-'));
  scratch.push(dir);
  execFileSync('mkfifo', [join(dir, 'pipe.md')]);
  const fifo = await bindSubject({ repoRoot: dir, path: 'pipe.md', changeSet: new Set() });
  assert.equal(fifo.state, 'present');
  assert.deepEqual(fifo.classes, ['unclaimed'], 'fail-closed: it owes the full set');
  assert.equal(
    fifo.sha256, sha256('grove:non-regular-entry:fifo'),
    'the digest names the kind, so two kinds at one path are never the same subject',
  );

  const { createServer } = await import('node:net');
  const server = createServer();
  await new Promise((done) => server.listen(join(dir, 'socket.md'), done));
  try {
    const socket = await bindSubject({ repoRoot: dir, path: 'socket.md', changeSet: new Set() });
    assert.equal(socket.sha256, sha256('grove:non-regular-entry:socket'));
    assert.notEqual(socket.sha256, fifo.sha256, 'entryKind discriminates; it is not one constant');
  } finally {
    await new Promise((done) => server.close(done));
  }
});

// L1 (lstat-then-read TOCTOU): a racing swap of a regular file for a symlink
// is the one direction that fails OPEN — a path-based read follows the new
// link and digests bytes that are not the subject's. The measured race landed
// 429 fail-CLOSED throws in 38,959 iterations and the fail-open direction 0
// times, so no behavioral test can distinguish the fix; the mechanism is
// pinned here instead, at the source, and the residual is stated in the
// commit rather than left implicit.
test('L1 — the regular-file read goes through one O_NOFOLLOW handle, not a second path lookup', async () => {
  const source = await readFile(
    join(REPOSITORY_ROOT, 'plugins/grove/runtime/dispatch/lib/guard-core.mjs'),
    'utf8',
  );
  assert.match(source, /O_NOFOLLOW/, 'the file read refuses to follow a link swapped in mid-race');
  assert.match(source, /handle\.stat\(\)/, "the handle's own stat decides the kind, not the earlier lstat");
  assert.doesNotMatch(
    source,
    /await readFile\(target\)/,
    'no second path-based read of the subject may exist beside the lstat',
  );
});

// --- R4: domain separation is SYMMETRIC or it is nothing ---
// Round two tagged only the NON-REGULAR representations and left regular-file
// bytes hashed raw — which made the tag merely a string an attacker writes
// into a file. Measured: a regular file holding `grove:symlink-target:
// target.txt` reproduced the reviewed symlink's digest exactly (bf1b65c9…), so
// every record made for that unclaimed symlink still satisfied the replacement
// CODE file and the guard exited 0 over never-reviewed code. The SAME
// mechanism, never demonstrated by any reviewer, also collided a fifo with a
// regular file holding `grove:non-regular-entry:fifo` (d6b36a5b…). The first
// test below states the mechanism's property over every pair of tags, so a
// fourth kind added later cannot reopen the class one case at a time.

test('R4 — the digest tags are mutually prefix-free, so no byte string reads as two kinds', () => {
  const tags = digestTagList();
  assert.ok(tags.length >= 3, 'every entry kind contributes a tag');
  assert.equal(new Set(tags).size, tags.length, 'no two kinds share a tag');
  for (const first of tags) {
    for (const second of tags) {
      if (first === second) continue;
      assert.ok(
        !first.startsWith(second) && !second.startsWith(first),
        `"${first}" and "${second}" must be prefix-free, or one kind's representation `
          + "can be read as another's",
      );
    }
  }
  assert.throws(
    () => subjectDigest('invented-kind', 'x'),
    /unknown subject digest kind/,
    'an untagged kind is a throw, never a raw digest',
  );
});

test('R4 — a regular file whose BYTES are the symlink tag cannot inherit the symlink verdict', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-bind-forge-link-'));
  scratch.push(dir);
  const { symlink, rm } = await import('node:fs/promises');
  await writeFile(join(dir, 'target.txt'), 'the real target\n');
  await symlink('target.txt', join(dir, 'subject.md'));
  const asLink = await bindSubject({ repoRoot: dir, path: 'subject.md', changeSet: new Set() });

  // The forgery: same path, still present, bytes chosen to BE the tagged
  // representation the symlink digests.
  await rm(join(dir, 'subject.md'));
  await writeFile(join(dir, 'subject.md'), 'grove:symlink-target:target.txt');
  const asFile = await bindSubject({ repoRoot: dir, path: 'subject.md', changeSet: new Set() });

  assert.equal(asFile.state, 'present');
  assert.deepEqual(asFile.classes, ['code'], 'the replacement is unreviewed CODE');
  assert.notEqual(asLink.sha256, asFile.sha256, 'the forged bytes must not reproduce the link digest');
  assert.equal(
    recordSatisfies({
      record: record({
        subject: 'subject.md', record_type: 'code-review', subject_sha256: asLink.sha256,
      }),
      subject: 'subject.md',
      state: asFile.state,
      sha256: asFile.sha256,
    }),
    false,
    "the symlink's review cannot satisfy the regular file that replaced it",
  );
});

test('R4 — the same forgery through the non-regular tag fails too (never demonstrated, same mechanism)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'grove-bind-forge-fifo-'));
  scratch.push(dir);
  execFileSync('mkfifo', [join(dir, 'pipe.md')]);
  const asFifo = await bindSubject({ repoRoot: dir, path: 'pipe.md', changeSet: new Set() });
  await writeFile(join(dir, 'plain.md'), 'grove:non-regular-entry:fifo');
  const asPlain = await bindSubject({ repoRoot: dir, path: 'plain.md', changeSet: new Set() });

  assert.equal(asFifo.state, 'present');
  assert.equal(asPlain.state, 'present');
  assert.notEqual(
    asFifo.sha256, asPlain.sha256,
    'a regular file holding the non-regular tag once digested identically to the fifo',
  );
});

// --- R4: the same field contracts on the READ side ---
// A planner gate only covers cursors this code wrote. parseCursor is what the
// guard runs over whatever is on disk — a hand-written cursor, one from an
// older writer, one edited in place — so the contract has to hold there too or
// the guard reports no defect for a cursor the spec does not allow. One
// definition (cursor.mjs), both sides.

const OPEN_CURSOR_RUN = '20260728-140000-fixture';
function openCursorText(fields = {}) {
  const merged = {
    opened: '2026-07-28T14:00:00Z',
    intent: 'land the fixture',
    ...fields,
  };
  return `schema = 1\nrun = "${OPEN_CURSOR_RUN}"\n`
    + `opened = ${JSON.stringify(merged.opened)}\n`
    + `intent = ${JSON.stringify(merged.intent)}\n`
    + 'subjects = ["specs/a.md"]\nstatus = "open"\n';
}

test('R4 — parseCursor enforces the declared field contracts, not just non-emptiness', () => {
  assert.equal(
    parseCursor(openCursorText(), { runId: OPEN_CURSOR_RUN }).ok, true,
    'the canonical cursor still validates',
  );

  for (const stamp of ['not-a-time', '2026-13-45T99:99:99Z', '2026-02-30T00:00:00Z', '   ', '2026-07-28T14:00:00+01:00']) {
    const parsed = parseCursor(openCursorText({ opened: stamp }), { runId: OPEN_CURSOR_RUN });
    assert.equal(parsed.ok, false, `opened ${JSON.stringify(stamp)} must be a defect`);
    assert.match(parsed.reason, /opened/, parsed.reason);
  }
  for (const breaker of ['\n', '\r']) {
    const parsed = parseCursor(
      openCursorText({ intent: `line one${breaker}line two` }), { runId: OPEN_CURSOR_RUN },
    );
    assert.equal(parsed.ok, false, 'a multi-line intent must be a defect');
    assert.match(parsed.reason, /intent/, parsed.reason);
  }

  // The closed/aborted half: `closed` on both, `reason` on aborted.
  const aborted = (fields) => `schema = 1\nrun = "${OPEN_CURSOR_RUN}"\nstatus = "aborted"\n`
    + `closed = ${JSON.stringify(fields.closed ?? '2026-07-28T19:00:00Z')}\n`
    + `reason = ${JSON.stringify(fields.reason ?? 'dead run')}\n`;
  assert.equal(parseCursor(aborted({}), { runId: OPEN_CURSOR_RUN }).ok, true);
  const badClosed = parseCursor(aborted({ closed: 'whenever' }), { runId: OPEN_CURSOR_RUN });
  assert.equal(badClosed.ok, false);
  assert.match(badClosed.reason, /closed/, badClosed.reason);
  const badReason = parseCursor(aborted({ reason: 'dead\nrun' }), { runId: OPEN_CURSOR_RUN });
  assert.equal(badReason.ok, false);
  assert.match(badReason.reason, /reason/, badReason.reason);
});

test('R4 — the minimal aborted shape validates all three fields it writes, not just the run id', () => {
  // "Schema-valid by construction" has to hold for the constructor itself:
  // it is exported, so a planner's gate is not its gate, and it exists to
  // replace a cursor that is ALREADY a defect. A second defect here would
  // leave the run with no exit.
  const good = {
    runId: '20260728-140322-dead-run',
    closed: '2026-07-28T18:00:00Z',
    reason: 'unparseable cursor aborted by user',
  };
  assert.equal(parseCursor(minimalAbortedCursor(good), { runId: good.runId }).ok, true);

  assert.throws(
    () => minimalAbortedCursor({ ...good, closed: 'whenever' }),
    /RFC 3339/,
    'a malformed closed timestamp is a throw, not a written defect',
  );
  assert.throws(
    () => minimalAbortedCursor({ ...good, closed: '2026-02-30T00:00:00Z' }),
    /calendar date/,
    'a day that does not exist is a throw too',
  );
  assert.throws(
    () => minimalAbortedCursor({ ...good, reason: 'line one\nline two' }),
    /one line/,
    'a multi-line reason is a throw, not a written defect',
  );
  assert.throws(
    () => minimalAbortedCursor({ ...good, reason: '   ' }),
    /non-empty one-line/,
    'a whitespace-only reason is a throw too',
  );
});

// --- R5: OPENING a frontmatter block is what makes a file bearing ---
// Found by review against aca3f93. Every malformed-block shape fell through to
// `code`, contradicting this module's own header rule ("a frontmatter-bearing
// file whose type is absent or outside the known enum classifies unclaimed …
// deterministic classification beats charitable coverage"). The cost is not
// only that `code` owes 2 records where `unclaimed` owes 4: `code` is not in
// the guard's observer-mode class set at all, so a truncated artifact was
// never even looked at in observer mode. The table below is the mechanism —
// every way a block can be opened and then be wrong — not the one shape the
// reviewer demonstrated.

const R5_BODY = 'id: fixture\ntype: spec\nimplements: adr-0001-x\nstatus: gated';

test('R5 — a block that opens and is then malformed classifies unclaimed, never code', () => {
  const malformed = {
    'no closing delimiter': `---\n${R5_BODY}\n\nbody\n`,
    'no closing delimiter, CRLF': `---\r\n${R5_BODY.split('\n').join('\r\n')}\r\n\r\nbody\r\n`,
    'closing delimiter is ----': `---\n${R5_BODY}\n----\n\nbody\n`,
    'closing delimiter is --': `---\n${R5_BODY}\n--\n\nbody\n`,
    'closing delimiter carries trailing text': `---\n${R5_BODY}\n--- x\n\nbody\n`,
    'exactly --- and nothing else': '---',
    '--- then EOF': '---\n',
    '--- then EOF, CRLF': '---\r\n',
    '--- then whitespace only': '---\n   \n\t\n',
    'byte-order mark before a COMPLETE block': `﻿---\n${R5_BODY}\n---\n\nbody\n`,
    'byte-order mark before an unterminated block': `﻿---\n${R5_BODY}\n`,
  };
  for (const [name, text] of Object.entries(malformed)) {
    const classified = classifyContent(text);
    assert.deepEqual(
      classified.classes, ['unclaimed'],
      `${name}: a malformed block owes the FULL set — got ${JSON.stringify(classified.classes)}`,
    );
    assert.equal(classified.implementsBearing, false, `${name}: a broken block bears nothing`);
  }
});

test('R5 — a file that opens NO block is still genuinely code, not swept into unclaimed', () => {
  // The other direction of the same rule: fail-closed must not become
  // classify-everything-unclaimed, which would owe reviews on ordinary source.
  const notBearing = {
    'no delimiter anywhere': 'just prose\n',
    'empty file': '',
    'delimiter after a blank first line': `\n---\n${R5_BODY}\n---\n`,
    'delimiter after text': `intro\n---\n${R5_BODY}\n---\n`,
    'a horizontal rule mid-document': 'intro\n\n---\n\nmore\n',
    'opening ---- is not the delimiter': `----\n${R5_BODY}\n---\n`,
    'byte-order mark on an ordinary source file': '﻿just prose\n',
  };
  for (const [name, text] of Object.entries(notBearing)) {
    assert.deepEqual(
      classifyContent(text).classes, ['code'],
      `${name}: no block was opened, so this is genuinely code`,
    );
  }
});

// R6 supersedes R5's tolerant-delimiter half. R5 made `--- ` a delimiter at
// BOTH ends to remove an open/close asymmetry; that was still a charitable
// read, and it opened a route into `reviewless` — `--- ` above `type:
// research` moved a file from code (owes 2) to reviewless (owes 0 AND
// observer-excluded). A padded delimiter is now neither a delimiter nor
// not-a-delimiter: it is MALFORMED. That closes the route in both directions
// at once, which neither strict-reject nor tolerant-accept could do alone.
test('R6 — a padded delimiter is malformed at both ends, never a delimiter and never ignored', () => {
  for (const [name, text] of Object.entries({
    'padded open and close': `--- \n${R5_BODY}\n--- \n\nbody\n`,
    'padded open only': `--- \n${R5_BODY}\n---\n`,
    'padded close only': `---\n${R5_BODY}\n--- \n`,
    'indented open': `  ---\n${R5_BODY}\n---\n`,
    'indented close': `---\n${R5_BODY}\n  ---\n`,
  })) {
    assert.deepEqual(
      classifyContent(text).classes, ['unclaimed'],
      `${name}: a padded delimiter is malformed, so the file owes the full set`,
    );
  }
  // `----` is still outside the grammar in either position — it opens no block
  // and closes none. That half of R5 stands.
  assert.deepEqual(
    classifyContent(`----\n${R5_BODY}\n---\n`).classes, ['code'],
    '---- opens no block',
  );
  assert.deepEqual(
    classifyContent(`---\n${R5_BODY}\n----\n`).classes, ['unclaimed'],
    '---- closes no block, so the opened one is unterminated',
  );
});

test('R5 — a complete block still classifies by its type; malformed never outranks it', () => {
  // Guard against over-correcting: the fix must not make every artifact
  // unclaimed. The happy paths and the already-correct fail-closed rows stand.
  assert.deepEqual(classifyContent(`---\n${R5_BODY}\n---\n`).classes, ['spec', 'implements-bearing']);
  assert.deepEqual(classifyContent('---\nid: x\ntype: adr\n---\n').classes, ['decision']);
  assert.deepEqual(classifyContent('---\n---\n').classes, ['unclaimed'], 'an empty block is bearing');
  assert.deepEqual(classifyContent('---\nid: x\n---\n').classes, ['unclaimed'], 'no type key');
  assert.deepEqual(classifyContent('---\ntype: banana\n---\n').classes, ['unclaimed'], 'type off-enum');
  // A comment or a blank line inside a complete block is legitimate YAML and
  // must not make the block malformed.
  assert.deepEqual(
    classifyContent('---\n# a comment\n\nid: x\ntype: charter\n---\n').classes, ['charter'],
    'unparseable-but-legal lines inside a CLOSED block are skipped, not fatal',
  );
});

// --- R6: `reviewless` is the one ABSORBING class, so nothing malformed reaches it ---
// Every other class under-owes when it is wrong; `reviewless` owes ZERO records
// AND is excluded from the guard's observer-mode class set, so reaching it is
// escaping review entirely. The parser used to discard any line it could not
// interpret and keep the `type` it had already read, so `- broken` beside
// `type: research` classified reviewless. The table is the mechanism — every
// route by which not-cleanly-well-formed input reached that state — not the
// one shape the review demonstrated.

test('R6 — no malformed, truncated, or ambiguous block can reach the absorbing reviewless class', () => {
  const routes = {
    'stray column-0 list item': '---\nid: x\ntype: research\n- broken\n---\n',
    'column-0 prose the parser cannot read': '---\nid: x\ntype: research\nthis is not yaml at all\n---\n',
    'a bare punctuation line': '---\nid: x\ntype: research\n!!!\n---\n',
    'a YAML directive': '---\n%YAML 1.2\nid: x\ntype: research\n---\n',
    'padded opening delimiter': '--- \nid: x\ntype: research\n---\n',
    'padded closing delimiter': '---\nid: x\ntype: research\n--- \n',
    'indented opening delimiter': '  ---\nid: x\ntype: research\n---\n',
    'duplicate type, research first': '---\ntype: research\ntype: spec\n---\n',
    'duplicate type, spec first': '---\ntype: spec\ntype: research\n---\n',
    'duplicate of any other key': '---\nid: a\nid: b\ntype: research\n---\n',
    'unterminated block': '---\nid: x\ntype: research\n',
    'byte-order mark': '\ufeff---\nid: x\ntype: research\n---\n',
  };
  for (const [name, text] of Object.entries(routes)) {
    const classified = classifyContent(text);
    assert.deepEqual(
      classified.classes, ['unclaimed'],
      `${name}: must not reach reviewless — got ${JSON.stringify(classified.classes)}`,
    );
  }
  // The legitimate route still works: a CLEAN block saying research/feedback.
  assert.deepEqual(classifyContent('---\nid: x\ntype: research\n---\n').classes, ['reviewless']);
  assert.deepEqual(classifyContent('---\nid: x\ntype: feedback\n---\n').classes, ['reviewless']);
});

test('R7 — the accepted grammar classifies grove frontmatter; exotic YAML is malformed by design', () => {
  // R7 supersedes R6's "strictness stops at syntax". R6 accepted any indented
  // line as a continuation belonging to the key above it, on the argument that
  // it could not masquerade as a top-level key. It did not have to: an
  // indented line CHANGES THE VALUE of the key above it, so `type: research`
  // over `  garbage` is the YAML scalar "research garbage" — outside the enum,
  // yet R6 preserved `research` and classified the file reviewless. The reader
  // is now a closed whitelist, so the exotic-YAML rows below classify
  // `unclaimed` rather than by their type. That is the deliberate cost: it
  // over-owes review rather than under-owing it, and the corpus measurement
  // says no real artifact is affected.
  const accepted = {
    'a comment': ['---\n# a comment\nid: x\ntype: charter\n---\n', ['charter']],
    'a blank line': ['---\n\nid: x\ntype: charter\n\n---\n', ['charter']],
    'an indented comment': ['---\n   # indented\nid: x\ntype: charter\n---\n', ['charter']],
    'trailing whitespace on a value': ['---\nid: x\ntype: research   \n---\n', ['reviewless']],
    'a trailing comment on a value': ['---\nid: x\ntype: research  # note\n---\n', ['reviewless']],
    'a column-0 sequence value': ['---\nid: x\ntype: spec\nimplements:\n- adr-0001-a\n---\n', ['spec', 'implements-bearing']],
    'an indented sequence value': ['---\nid: x\ntype: spec\nimplements:\n  - adr-0001-a\n---\n', ['spec', 'implements-bearing']],
    'a flow sequence value': ['---\nid: x\ntype: spec\ndepends_on: [a, b]\nimplements: adr-1\n---\n', ['spec', 'implements-bearing']],
    'an empty flow sequence': ['---\nid: x\ntype: spec\nimplements: []\n---\n', ['spec']],
  };
  for (const [name, [text, expected]] of Object.entries(accepted)) {
    assert.deepEqual(
      classifyContent(text).classes, expected,
      `${name}: this form is IN the accepted grammar and must classify by type`,
    );
  }

  // The accepted cost, pinned so it is a decision and not a surprise.
  const outsideTheGrammar = {
    'a nested map': '---\nid: x\ntype: charter\nmeta:\n  owner: someone\n---\n',
    'a deeply nested map': '---\nid: x\ntype: charter\na:\n  b:\n    c: 1\n---\n',
    'a literal block scalar': '---\nid: x\ntype: charter\nnotes: |\n  line one\n---\n',
    'a folded block scalar': '---\nid: x\ntype: charter\nnotes: >\n  folded\n---\n',
    'a block scalar containing an indented ---': '---\nid: x\ntype: charter\nnotes: |\n  ---\n  more\n---\n',
    'a tab-indented continuation': '---\nid: x\ntype: charter\nnotes:\n\tsomething\n---\n',
    'a quoted value containing a colon': '---\nid: x\ntype: charter\ntitle: "a: b"\n---\n',
  };
  for (const [name, text] of Object.entries(outsideTheGrammar)) {
    assert.deepEqual(
      classifyContent(text).classes, ['unclaimed'],
      `${name}: outside the grammar is malformed — over-owing, never under-owing`,
    );
  }
});


// --- R7: the frontmatter reader is a closed WHITELIST grammar ---
// Six rounds each added a rule for a malformed shape nobody had thought of,
// because the reader enumerated what was safe to SKIP and accepted whatever
// failed to trip a rule — an unbounded accepting set that cannot converge by
// patching. The reader now accepts a closed list of line forms and treats
// everything else as malformed, which turns the fail-open argument into a
// property of the grammar: any input outside it is malformed, malformed is
// `unclaimed`, and `unclaimed` owes the full set and is observer-visible, so
// nothing outside the grammar can under-owe review.

const fmChar = (code) => String.fromCharCode(code);

test('R7 — an indented continuation changes the value above it, so it is malformed', () => {
  // The refutation of round six's safety argument. R6 skipped indented lines
  // because they "cannot masquerade as a top-level type/implements". They do
  // not need to: in YAML `type: research` over `  garbage` is the single
  // scalar "research garbage", which is outside the enum — yet the skip
  // preserved `research` and classified the file reviewless, owing nothing and
  // invisible to observer mode.
  for (const [name, text] of Object.entries({
    'after type': '---\nid: x\ntype: research\n  garbage\n---\n',
    'after a non-type key': '---\nid: x\n  more-id\ntype: research\n---\n',
    'tab-indented': '---\nid: x\ntype: research\n\tgarbage\n---\n',
    'deeply indented': '---\nid: x\ntype: research\n        garbage\n---\n',
  })) {
    assert.deepEqual(
      classifyContent(text).classes, ['unclaimed'],
      `${name}: a continuation is not a skippable line`,
    );
  }
});

test('R7 — line splitting follows YAML 1.2: LF, CR and CRLF each end a line', () => {
  // b-char is LF or CR, and CRLF is ONE break. The previous split was
  // /\r?\n/, so a bare-CR document stayed entirely in lines[0], matched no
  // delimiter, and classified `code` — which is filtered out of observer mode,
  // so a changed CR-terminated spec got no spec-adversary report at all.
  const CR = fmChar(13);
  assert.deepEqual(
    classifyContent(`---${CR}id: x${CR}type: spec${CR}implements: adr-1${CR}---${CR}`).classes,
    ['spec', 'implements-bearing'],
    'a bare-CR document parses',
  );
  assert.deepEqual(
    classifyContent('---\r\nid: x\r\ntype: spec\r\n---\r\n').classes, ['spec'],
    'CRLF is one break, not two',
  );
  assert.deepEqual(
    classifyContent(`---\r\nid: x${CR}type: spec\r\n---\n`).classes, ['spec'],
    'the three spellings mix freely',
  );
  assert.deepEqual(
    classifyContent(`---${CR}type: research${CR}`).classes, ['unclaimed'],
    'and an unterminated CR document is still malformed',
  );
  // A lone CR inside a value is a line break, so the value ends there and the
  // remainder matches no accepted form.
  assert.deepEqual(
    classifyContent(`---\nid: x\ntype: res${CR}earch\n---\n`).classes, ['unclaimed'],
  );
});

test('R7 — characters whose line-break meaning differs between YAML versions are malformed', () => {
  // NEL, LS and PS are line breaks in YAML 1.1 and ordinary characters in
  // YAML 1.2, so a document containing one is read differently by two
  // conforming parsers. Input whose meaning depends on which parser reads it
  // is ambiguous, and ambiguous is malformed rather than charitably accepted.
  for (const [name, code] of Object.entries({
    NEL: 0x85, LS: 0x2028, PS: 0x2029,
  })) {
    const inside = `---\nid: x\ntype: res${fmChar(code)}earch\n---\n`;
    const trailing = `---\nid: x\ntype: research${fmChar(code)}more\n---\n`;
    assert.deepEqual(classifyContent(inside).classes, ['unclaimed'], `${name} inside a value`);
    assert.deepEqual(classifyContent(trailing).classes, ['unclaimed'], `${name} after a valid type`);
  }
  // Control bytes are rejected on the same rule.
  for (const [name, code] of Object.entries({
    NUL: 0, VT: 11, ESC: 27, DEL: 127,
  })) {
    assert.deepEqual(
      classifyContent(`---\nid: x\ntype: rese${fmChar(code)}arch\n---\n`).classes, ['unclaimed'],
      `${name} in a value`,
    );
  }
});

test('R7 — every YAML construct outside the accepted subset is malformed, never reviewless', () => {
  // The whitelist property, exercised over constructs the grammar does not
  // admit. None of these may reach `reviewless` (owes nothing, invisible) or
  // `code` (filtered from observer mode).
  const outside = {
    'quoted scalar': '---\ntype: "research"\n---\n',
    'single-quoted scalar': "---\ntype: 'research'\n---\n",
    'unterminated quote': '---\nid: x\ntype: research\ntitle: "abc\n---\n',
    'literal block scalar': '---\nid: x\ntype: research\nnotes: |\n  text\n---\n',
    'folded block scalar': '---\nid: x\ntype: research\nnotes: >\n  text\n---\n',
    'nested map': '---\nid: x\ntype: research\nmeta:\n  owner: me\n---\n',
    anchor: '---\nid: x\ntype: &a research\n---\n',
    alias: '---\nid: x\ntype: *a\n---\n',
    tag: '---\nid: x\ntype: !!str research\n---\n',
    'flow mapping value': '---\nid: x\ntype: {a: b}\n---\n',
    'flow mapping line': '---\n{type: research}\n---\n',
    'nested flow sequence': '---\nid: x\ntype: research\nimplements: [[a]]\n---\n',
    'unterminated flow sequence': '---\nid: x\ntype: research\nimplements: [a, b\n---\n',
    'flow sequence with an empty item': '---\nid: x\ntype: spec\nimplements: [a, , b]\n---\n',
    'document-end marker': '---\nid: x\ntype: research\n...\n---\n',
    'YAML directive': '---\n%YAML 1.2\nid: x\ntype: research\n---\n',
    'explicit key indicator': '---\n? type\n: research\n---\n',
    'no space after the colon': '---\nid: x\ntype:research\n---\n',
    'value ending in a colon': '---\nid: x\ntype: research:\n---\n',
    'value containing a colon-space': '---\nid: x\ntype: a: b\n---\n',
    'type as a sequence': '---\nid: x\ntype:\n- research\n---\n',
    'sequence item with no key above it': '---\nid: x\n- research\ntype: research\n---\n',
    'sequence item after a blank line': '---\nimplements:\n\n- a\ntype: research\n---\n',
    'sequence item that is not a plain scalar': '---\nid: x\ntype: spec\nimplements:\n- "a"\n---\n',
    'key containing a space': '---\nmy key: x\ntype: research\n---\n',
    'empty key': '---\n: x\ntype: research\n---\n',
    'comment-only value': '---\nid: x\ntype: # note\n---\n',
    // These two guard the value rules through `implements` rather than `type`,
    // which is where they actually bite: a malformed implements value that is
    // merely non-empty makes the file implements-bearing, and a bearing spec
    // owes 2 records where unclaimed owes 4. Measured in both directions.
    'ambiguous character in an implements value':
      `---\nid: x\ntype: spec\nimplements: adr-1${fmChar(0x85)}junk\n---\n`,
    'colon-space in an implements value': '---\nid: x\ntype: spec\nimplements: a: b\n---\n',
  };
  for (const [name, text] of Object.entries(outside)) {
    const classified = classifyContent(text);
    assert.deepEqual(
      classified.classes, ['unclaimed'],
      `${name}: outside the grammar must be malformed — got ${JSON.stringify(classified.classes)}`,
    );
  }
});

test("R7 — the comment rule is YAML's, and a padded delimiter survives it", () => {
  // A `#` starts a comment at line start or after a space/tab; a `#` NOT
  // preceded by whitespace belongs to the scalar. Both directions matter: the
  // first keeps `type: research # note` classifying by its real value, the
  // second keeps `grove#101` whole.
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: research # note\n---\n').classes, ['reviewless'],
    'YAML says the value here IS research; classifying it reviewless is correct, not charitable',
  );
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: research\t# note\n---\n').classes, ['reviewless'],
    'a tab separates a comment too',
  );
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: research#note\n---\n').classes, ['unclaimed'],
    'no whitespace before the hash: it stays in the scalar, which is off-enum',
  );
  // Regression on a defect this rewrite introduced and the adversarial pass
  // caught: the comment stripper also trims trailing whitespace, so testing
  // the delimiter on the STRIPPED line turned `--- ` back into a clean `---`
  // and re-opened the padded-delimiter route round six closed. Both delimiters
  // are compared against the raw line.
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: research\n--- \n').classes, ['unclaimed'],
    'a padded closing delimiter must not be rescued by comment stripping',
  );
  assert.deepEqual(
    classifyContent('--- \nid: x\ntype: research\n---\n').classes, ['unclaimed'],
    'nor a padded opening delimiter',
  );
});


// --- R8: the whitelist applied one level down, to VALUES ---
// Round seven closed the LINE class and named one residual: within an accepted
// line the value was still a near-arbitrary plain scalar, so its meaning rested
// on YAML subtleties no test here could check. Round eight found three defects
// and every one of them was inside that residual — nothing was found outside
// the line grammar. The residual is now closed the same way the line class was:
// a value the classifier READS must match [A-Za-z0-9_-]+, which every
// conforming YAML reader produces byte-for-byte as a plain scalar.

// Every character JS trim() strips that YAML does NOT treat as whitespace.
// YAML s-white is space and tab, and nothing else.
const JS_TRIMMED_NOT_YAML = [
  0x0b, 0x0c, 0x00a0, 0x1680, 0x2000, 0x2003, 0x2009, 0x202f, 0x205f, 0x3000,
  0xfeff, 0x2028, 0x2029,
];

test('R8 — trimming is YAML s-white, not JS trim(): the whole 13-character class', () => {
  // `type: research<NBSP>` was trimmed by JS to `research`, matched the enum
  // and classified reviewless — owing nothing, invisible to observer mode —
  // while a conforming reader keeps the NBSP and reads a value that is not
  // `research`. NBSP was one instance; the class has thirteen members.
  for (const code of JS_TRIMMED_NOT_YAML) {
    const c = String.fromCharCode(code);
    const hex = `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
    assert.deepEqual(
      classifyContent(`---\nid: x\ntype: research${c}\n---\n`).classes, ['unclaimed'],
      `${hex} trailing a type value must not be trimmed away`,
    );
    assert.deepEqual(
      classifyContent(`---\nid: x\ntype: ${c}research\n---\n`).classes, ['unclaimed'],
      `${hex} leading a type value must not be trimmed away`,
    );
    assert.deepEqual(
      classifyContent(`---\nid: x\ntype: spec\nimplements: adr-1${c}\n---\n`).classes,
      ['unclaimed'],
      `${hex} in an implements value must not be trimmed away`,
    );
  }
  // Space and tab ARE YAML whitespace and must still be trimmed.
  assert.deepEqual(
    classifyContent('---\nid: x\ntype:   research  \n---\n').classes, ['reviewless'],
    'space and tab are s-white and are still trimmed',
  );
});

test('R8 — a mapping-value indicator is a colon before space OR tab', () => {
  // The check tested only ": ", so `implements: a:<TAB>b` was recorded as a
  // plain scalar no conforming reader would produce: on a spec that yielded
  // implements-bearing, owing 2 where unclaimed owes 4.
  const TAB = String.fromCharCode(9);
  for (const [name, gap] of Object.entries({ space: ' ', tab: TAB })) {
    assert.deepEqual(
      classifyContent(`---\nid: x\ntype: spec\nimplements: a:${gap}b\n---\n`).classes,
      ['unclaimed'],
      `colon-${name} in a read value`,
    );
    assert.deepEqual(
      classifyContent(`---\nid: x\ntype: spec\nnote: a:${gap}b\nimplements: adr-1\n---\n`).classes,
      ['unclaimed'],
      `colon-${name} in an unread value is still a structural break`,
    );
  }
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: spec\nnote: trailing:\nimplements: adr-1\n---\n').classes,
    ['unclaimed'],
    'a value ending in a colon is a mapping key',
  );
});

test('R8 — flow-context scalars forbid [ ] { } anywhere, not just first', () => {
  // The block-context check tests the FIRST character only, so `[a[b]` was
  // accepted as the item `a[b`, which YAML forbids in flow context.
  for (const [name, value] of Object.entries({
    'open bracket': '[a[b]',
    'close bracket': '[a]b]',
    'open brace': '[a{b]',
    'close brace': '[a}b]',
    'nested flow': '[[a]]',
  })) {
    assert.deepEqual(
      classifyContent(`---\nid: x\ntype: spec\nimplements: ${value}\n---\n`).classes,
      ['unclaimed'], `${name} in a read flow sequence`,
    );
    assert.deepEqual(
      classifyContent(`---\nid: x\ntype: spec\ndepends_on: ${value}\nimplements: adr-1\n---\n`).classes,
      ['unclaimed'], `${name} in an unread flow sequence`,
    );
  }
  // A bracket inside a BLOCK-context scalar is ordinary content and stays so.
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: adr\nnote: are [artifacts] in sync\n---\n').classes,
    ['decision'], 'block context is not flow context',
  );
});

test('R8 — a value the classifier READS is [A-Za-z0-9_-]+; an unread value is not narrowed', () => {
  // The split is the design choice, and it is measured rather than cautious:
  // requiring the narrow class of EVERY value would reclassify 31 tracked
  // files, because unread keys legitimately carry prose and cross-repository
  // ids. Requiring it of read keys alone reclassifies none.
  for (const value of ['resea.rch', 'resea/rch', 'resea@rch', 'resea rch', 'resea"rch', 'resea;rch']) {
    assert.deepEqual(
      classifyContent(`---\nid: x\ntype: ${value}\n---\n`).classes, ['unclaimed'],
      `type ${JSON.stringify(value)} is outside the narrow class`,
    );
  }
  for (const value of ['trellis/decision-0045', 'spec-0004@v6', 'adr.1']) {
    assert.deepEqual(
      classifyContent(`---\nid: x\ntype: spec\nimplements: ${value}\n---\n`).classes, ['unclaimed'],
      `implements ${JSON.stringify(value)} is outside the narrow class`,
    );
  }
  // A leading dash is inside [A-Za-z0-9_-]+ but is still a YAML indicator.
  assert.deepEqual(classifyContent('---\nid: x\ntype: -research\n---\n').classes, ['unclaimed']);

  // The same characters on UNREAD keys stay accepted — this is what keeps the
  // corpus at zero churn.
  const unread = {
    'a slash': '---\nid: x\ntype: adr\ndepends_on: [trellis/decision-0045]\n---\n',
    'an at sign': '---\nid: x\ntype: adr\nchanges: [spec-0004-dual-host@v6]\n---\n',
    'prose with punctuation': '---\nid: x\ntype: adr\nstatus_note: shaped from the call (2026-07-12); folded\n---\n',
    'a block sequence of ids': '---\nid: x\ntype: adr\ndepends_on:\n- trellis/decision-1\n---\n',
  };
  for (const [name, text] of Object.entries(unread)) {
    assert.deepEqual(
      classifyContent(text).classes, ['decision'],
      `${name}: an unread value is bounded, not narrowed`,
    );
  }
  // But a READ key's block sequence is narrowed.
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: spec\nimplements:\n- trellis/decision-1\n---\n').classes,
    ['unclaimed'], 'a read key narrows its sequence items too',
  );
});

test('R8 — tag-resolution spellings cannot under-owe', () => {
  // What the charset does NOT settle, pinned rather than claimed closed: YAML
  // 1.1 resolves `no`, `y`, `null` to boolean/null where 1.2 keeps a string.
  // No enum member is one of those spellings, so `type` is unaffected; for
  // `implements` a resolution difference can only make the value more present,
  // which over-owes. Both directions are fail-closed.
  for (const spelling of ['no', 'null', 'y', 'on', 'off', 'true']) {
    assert.deepEqual(
      classifyContent(`---\nid: x\ntype: ${spelling}\n---\n`).classes, ['unclaimed'],
      `type: ${spelling} is outside the enum under every reader`,
    );
    const spec = classifyContent(`---\nid: x\ntype: spec\nimplements: ${spelling}\n---\n`);
    assert.ok(
      spec.classes.includes('spec'),
      `implements: ${spelling} keeps the spec class`,
    );
    assert.equal(
      spec.implementsBearing, true,
      `implements: ${spelling} counts as present — over-owing, never under`,
    );
  }
});

test('R8 — an accepted value is never empty; only a BARE key holds the empty string', () => {
  // The grammar rejects an empty scalar, so a field holds '' if and only if
  // its line was a bare key — which is also the only thing that opens a
  // sequence. That is why the bearing test needs no trim and no '[]' case.
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: spec\nimplements:\n---\n').classes, ['spec'],
    'a bare implements key is present but not bearing',
  );
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: spec\nimplements:   \n---\n').classes, ['spec'],
    'trailing s-white does not make it a value',
  );
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: spec\nimplements: []\n---\n').classes, ['spec'],
    'an empty flow sequence is present but not bearing',
  );
  assert.deepEqual(
    classifyContent('---\nid: x\ntype:\n---\n').classes, ['unclaimed'],
    'a bare type key has no enum value',
  );
});

test('R8 — leading whitespace stays structural: comment stripping must not eat it', () => {
  // A regression this round introduced and the round-seven battery caught:
  // routing the comment stripper through yamlTrim removed LEADING whitespace
  // too, so `  owner: me` matched the key form and indented continuations were
  // silently accepted again — reopening the hole round seven closed.
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: research\nmeta:\n  owner: me\n---\n').classes,
    ['unclaimed'], 'a nested map is an indented continuation, not two keys',
  );
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: research\n  owner: me\n---\n').classes,
    ['unclaimed'], 'an indented key-shaped line is still a continuation',
  );
  assert.deepEqual(
    classifyContent('---\nid: x\ntype: research\n\towner: me\n---\n').classes,
    ['unclaimed'], 'tab indentation too',
  );
});
