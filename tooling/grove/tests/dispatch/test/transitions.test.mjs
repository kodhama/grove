// Upstream: spec-0006-voluntary-dispatch@v2 INV13–INV15; AC8 (mechanical
// half); S15. Decision: adr-0046-how-dispatch-rules-reach-a-session.
//
// AC8's behavioral half is NOT tested here and is not fakeable into a test:
// the meaning of the free-text `fire` and `id` values (no itinerary written
// into English or kebab-case) is review-caught, never machine-checked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { parseTomlDocument as parseToml } from '../../../../../plugins/grove/runtime/dispatch/lib/parsers.mjs';
import {
  RECORD_TYPES,
  SUBJECT_CLASSES,
  loadTransitions,
} from '../../../../../plugins/grove/runtime/dispatch/lib/transitions.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..');
const SHIPPED_PATH = join(
  REPOSITORY_ROOT,
  'plugins/grove/reference/dispatch/transitions.toml',
);

const shipped = () => readFile(SHIPPED_PATH, 'utf8');

test('INV13 — the shipped transitions.toml parses, validates, and is in the package allowlist', async () => {
  const transitions = loadTransitions(await shipped());
  assert.equal(transitions.length, 4);

  const allowlist = JSON.parse(await readFile(
    join(REPOSITORY_ROOT, 'plugins/grove/metadata/package-allowlist.json'),
    'utf8',
  ));
  assert.ok(
    allowlist.leaves.some(
      (leaf) => leaf.path === 'plugins/grove/reference/dispatch/transitions.toml',
    ),
    'transitions.toml is a declared static package file',
  );
});

test('the shipped file carries exactly the four initial rules with the spec content', async () => {
  const transitions = loadTransitions(await shipped());
  const byId = new Map(transitions.map((item) => [item.id, item]));
  assert.deepEqual(
    [...byId.keys()].sort(),
    ['t-code-quality', 't-conformance', 't-decision-quality', 't-spec-quality'],
  );

  const expected = {
    't-conformance': {
      classes: ['implements-bearing', 'code', 'unclaimed', 'missing'],
      record: 'conformance',
      role: 'conformance-reviewer',
    },
    't-decision-quality': {
      classes: ['decision', 'unclaimed', 'missing'],
      record: 'decision-adversary',
      role: 'decision-adversary',
    },
    't-spec-quality': {
      classes: ['spec', 'unclaimed', 'missing'],
      record: 'spec-adversary',
      role: 'spec-adversary',
    },
    't-code-quality': {
      classes: ['code', 'unclaimed', 'missing'],
      record: 'code-review',
      role: 'code-reviewer',
    },
  };
  for (const [id, want] of Object.entries(expected)) {
    const transition = byId.get(id);
    assert.ok(transition, id);
    assert.deepEqual(
      transition.preconditions.map((predicate) => predicate.text),
      [
        `changed(${want.classes.join(' ∪ ')}, $s)`,
        `no-record(${want.record}, $s)`,
      ],
      id,
    );
    assert.deepEqual(
      transition.postconditions.map((predicate) => predicate.text),
      [`record(${want.record}, $s)`],
      id,
    );
    assert.match(transition.fire, new RegExp(want.role), id);
    // `fire` names one action; it never names a sequence (INV15's shape is
    // structural — the closed key set — but the shipped values also stay
    // single-action).
    assert.doesNotMatch(transition.fire, /\bthen\b|\bnext\b|→|;/, id);
  }
});

test('the closed vocabulary is exactly the spec enumerations', () => {
  assert.deepEqual(
    [...RECORD_TYPES],
    ['conformance', 'decision-adversary', 'spec-adversary', 'code-review'],
  );
  assert.deepEqual(
    [...SUBJECT_CLASSES].sort(),
    [
      'charter',
      'code',
      'decision',
      'implements-bearing',
      'missing',
      'reviewless',
      'spec',
      'unclaimed',
    ],
  );
});

// --- S15: every itinerary shape is rejected NAMING the offending transition ---

const MINIMAL = `schema = 1

[[transition]]
id = "t-alpha"
fire = "dispatch conformance-reviewer on $s"
preconditions = [
  "changed(code, $s)",
  "no-record(conformance, $s)",
]
postconditions = ["record(conformance, $s)"]
`;

test('S15 — undeclared keys (next/then/phase and any other) are rejected naming the transition', () => {
  for (const key of ['next', 'then', 'phase', 'sequence', 'after']) {
    const text = MINIMAL.replace(
      'fire = "dispatch conformance-reviewer on $s"',
      `fire = "dispatch conformance-reviewer on $s"\n${key} = "t-beta"`,
    );
    assert.throws(
      () => loadTransitions(text),
      (error) =>
        error.message.includes('t-alpha') && error.message.includes(key),
      key,
    );
  }
});

test('S15 — an undeclared predicate form is rejected naming the transition', () => {
  const cases = [
    'event(merge, $s)', // no such form
    'changed(bogus-class, $s)', // class outside the table
    'record(human-approval, $s)', // reserved type is not rule-consumable
    'no-record(review, $s)', // rtype outside the enum
    'changed(code)', // no subject binding
    'changed(code, $t)', // wrong variable
  ];
  for (const predicate of cases) {
    const text = MINIMAL.replace('"changed(code, $s)"', JSON.stringify(predicate));
    assert.throws(
      () => loadTransitions(text),
      (error) =>
        error.message.includes('t-alpha')
        && error.message.includes(predicate),
      predicate,
    );
  }
});

test('S15 — an empty preconditions list (a bare event → agent pair) is rejected', () => {
  const text = MINIMAL.replace(
    /preconditions = \[[^\]]*\]/,
    'preconditions = []',
  );
  assert.throws(
    () => loadTransitions(text),
    (error) =>
      error.message.includes('t-alpha')
      && /preconditions/.test(error.message),
  );
});

test('S15 — a record postcondition without its no-record precondition is rejected (self-disabling)', () => {
  const text = MINIMAL.replace(
    '  "no-record(conformance, $s)",\n',
    '',
  );
  assert.throws(
    () => loadTransitions(text),
    (error) =>
      error.message.includes('t-alpha')
      && error.message.includes('no-record(conformance, $s)'),
  );
});

test('S15 — postconditions naming no record at all are rejected', () => {
  for (const replacement of [
    'postconditions = []',
    'postconditions = ["changed(code, $s)"]',
  ]) {
    const text = MINIMAL.replace(/postconditions = \[[^\]]*\]/, replacement);
    assert.throws(
      () => loadTransitions(text),
      (error) =>
        error.message.includes('t-alpha')
        && /record/.test(error.message),
      replacement,
    );
  }
});

test('S15 — a malformed id is rejected', () => {
  for (const bad of ['conformance', 'T-conformance', 't-', 't-Conformance', 't--']) {
    const text = MINIMAL.replace('id = "t-alpha"', `id = ${JSON.stringify(bad)}`);
    assert.throws(
      () => loadTransitions(text),
      (error) => error.message.includes(bad),
      bad,
    );
  }
});

test('S15 — a duplicate id is rejected naming it', () => {
  const text = `${MINIMAL}
[[transition]]
id = "t-alpha"
fire = "dispatch code-reviewer on $s"
preconditions = [
  "changed(code, $s)",
  "no-record(code-review, $s)",
]
postconditions = ["record(code-review, $s)"]
`;
  assert.throws(
    () => loadTransitions(text),
    (error) => /duplicate/i.test(error.message) && error.message.includes('t-alpha'),
  );
});

test('INV13 — the parser is strict: unquoted values, unknown roots, and junk lines fail closed', () => {
  // Leniency here is the dangerous fail-open: a rule that silently parses to
  // something else is a rule nobody validated.
  // RE-DERIVED for adr-0048, message by message: the assertions survive, the
  // wordings are the library's. `duplicate` became `redefine`; an unquoted
  // value and a junk line are both "unexpected character". What is pinned is
  // that each STILL throws — leniency here is the dangerous fail-open.
  assert.throws(
    () => parseToml('id = t-alpha\n'),
    /Invalid TOML/,
    'unquoted string value',
  );
  assert.throws(() => parseToml('just some prose\n'), /Invalid TOML/);
  assert.throws(
    () => parseToml('schema = 1\nschema = 2\n'),
    /redefine|duplicate/i,
    'duplicate key',
  );
  assert.throws(
    () => loadTransitions('schema = 1\nrules = "x"\n'),
    /rules/,
    'undeclared root key',
  );
  assert.throws(
    () => loadTransitions('schema = 2\n[[transition]]\nid = "t-a"\n'),
    /schema/,
    'wrong schema',
  );
});
