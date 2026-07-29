// Upstream: spec-0006-voluntary-dispatch@v3 INV13 (strict evaluable encoding).
// Decisions: adr-0046-how-dispatch-rules-reach-a-session,
// adr-0048-parsers-are-dependencies.
//
// RENAMED from toml.test.mjs with adr-0048, because its subject changed. It
// used to be an adversarial suite for grove's hand-rolled strict TOML SUBSET,
// on the premise that leniency there was a fail-open. That premise is
// withdrawn: grove does not define TOML, so grove does not get to be stricter
// than TOML. What this file pins now is the BOUNDARY — what the dependency
// guarantees, and where grove's own schema takes over.
//
// The division of labour, and it is the whole point of adr-0048 D1:
//   the PARSER decides what is a legal TOML document;
//   grove's SCHEMA decides which legal documents are a cursor, a rule set, or
//   a verdict record.
// Two assertions below were INVERTED rather than deleted, and each says so at
// its own site.
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTomlDocument } from '../../../../../plugins/grove/runtime/dispatch/lib/parsers.mjs';
import { parseCursor } from '../../../../../plugins/grove/runtime/dispatch/lib/cursor.mjs';
import { loadTransitions } from '../../../../../plugins/grove/runtime/dispatch/lib/transitions.mjs';

const TAB = String.fromCharCode(9);
const NUL = String.fromCharCode(0);
const DEL = String.fromCharCode(127);
const BEL = String.fromCharCode(7);

test('adr-0048 — a __proto__ key is own data and reaches no prototype, in every shape that could carry one', () => {
  // INVERTED, deliberately, and this is the replacement of a DELIBERATELY
  // PINNED assertion rather than a quiet drop. The hand-rolled reader built
  // every table with Object.create(null), and this test asserted that:
  //     assert.equal(Object.getPrototypeOf(scalar), null)
  //     assert.equal(typeof scalar.toString, 'undefined')
  // NEITHER HOLDS ANY MORE. smol-toml returns ordinary objects, so a parsed
  // table inherits from Object.prototype and `toString` is a function.
  //
  // What is asserted instead is the property that actually mattered and still
  // holds: NO PROTOTYPE WRITE. `__proto__` lands as an own data property (the
  // library defines rather than assigns), so no document can reach or mutate
  // Object.prototype. All four shapes that could carry a prototype write are
  // kept as cases, so the property is pinned at least as tightly as before.
  const shapes = {
    'scalar value': '__proto__ = "x"\n',
    'inline table value': '__proto__ = { polluted = 1 }\n',
    'table header': '[__proto__]\npolluted = 1\n',
    'dotted key path': 'a.__proto__.polluted = 1\n',
  };
  for (const [label, source] of Object.entries(shapes)) {
    const parsed = parseTomlDocument(source);
    assert.equal(
      Object.prototype.hasOwnProperty.call(parsed, 'polluted'),
      false,
      `${label}: nothing named polluted became a root key`,
    );
    assert.equal(parsed.polluted, undefined, `${label}: nothing is reachable as polluted`);
    assert.equal({}.polluted, undefined, `${label}: Object.prototype is untouched`);
    assert.equal(
      Object.getPrototypeOf(parsed),
      Object.prototype,
      `${label}: the prototype is the ordinary one, never a document-supplied object`,
    );
  }
  // The own-data half, stated separately: the key survives as data.
  const scalar = parseTomlDocument('__proto__ = "x"\n');
  assert.equal(Object.getOwnPropertyDescriptor(scalar, '__proto__').value, 'x');
  const table = parseTomlDocument('[[transition]]\n__proto__ = "x"\n');
  assert.equal(
    Object.getOwnPropertyDescriptor(table.transition[0], '__proto__').value,
    'x',
  );
});

test('adr-0048 — a raw TAB is legal inside a string and every other control character is not', () => {
  // INVERTED, deliberately. The hand-rolled reader rejected EVERY raw
  // character below 0x20 plus DEL, and this test asserted a raw tab throws.
  // TOML permits tab in both string forms, so that strictness was grove being
  // stricter than a format it does not define — exactly the divergence
  // adr-0048 D1 exists to end.
  //
  // The class is NARROWER, not closed: tab is the one raw control character
  // that now gets through. Measured, one character at a time.
  assert.equal(parseTomlDocument(`a = "x${TAB}y"\n`).a, `x${TAB}y`, 'raw tab is legal TOML');
  assert.equal(parseTomlDocument(`a = 'x${TAB}y'\n`).a, `x${TAB}y`, 'in literal strings too');
  for (const [name, character] of [['NUL', NUL], ['BEL', BEL], ['DEL', DEL]]) {
    assert.throws(
      () => parseTomlDocument(`a = "x${character}y"\n`),
      /control character/i,
      `raw ${name} is still rejected`,
    );
  }
  assert.equal(parseTomlDocument('a = "x\\ty"\n').a, `x${TAB}y`, 'the escaped form still works');
  assert.equal(parseTomlDocument('a = "x\\ny"\n').a, 'x\ny');
});

test('adr-0048 — the parser accepts all of TOML; grove\'s SCHEMA is what narrows it', () => {
  // The three subset-strictness cases that used to assert the PARSER rejects
  // these. It does not, and it should not — they are legal TOML. What rejects
  // them is grove's own schema, one layer up, which is where a rule grove
  // authored belongs.
  for (const source of [
    'schema = 1.5\n',
    'schema = true\n',
    'schema = 1979-05-27T07:32:00Z\n',
    'schema = 0x1\n',
    'schema = -1\n',
  ]) {
    assert.doesNotThrow(() => parseTomlDocument(source), `legal TOML: ${source.trim()}`);
  }
  // …and each is refused by the contract that owns it.
  const cursor = parseCursor('schema = 1.5\nrun = "20260728-140000-x"\nstatus = "open"\n', {
    runId: '20260728-140000-x',
  });
  assert.equal(cursor.ok, false);
  assert.match(cursor.reason, /schema must be 1/);
  assert.throws(
    () => loadTransitions('schema = true\n[[transition]]\nid = "t-x"\n'),
    /schema must be 1/,
  );
});

test('adr-0048 — a document that does not parse is a REFUSAL, never an internal error', () => {
  // Every parse call site is wrapped. readFrontmatter and the old readers could
  // not throw on inputs their callers had screened; a library reader can throw
  // on anything, and stop-guard.sh maps a guard-internal error to exit 4 while
  // "shall NEVER exit 2" — so a throwing parser at Stop would not hold the
  // session. Both shipped entry points below return a reason instead.
  const broken = 'schema = 1\nrun = = "x"\n';
  assert.throws(() => parseTomlDocument(broken), /Invalid TOML/);
  const cursor = parseCursor(broken, { runId: '20260728-140000-x' });
  assert.equal(cursor.ok, false, 'parseCursor reports rather than throws');
  assert.match(cursor.reason, /^unparseable cursor: /);
  assert.throws(() => loadTransitions(broken), /^Error: transitions\.toml: /);
});

test('comma-less multi-line array items are rejected', () => {
  assert.throws(() => parseTomlDocument('a = [\n  "x"\n  "y"\n]\n'), /invalid|unexpected/i);
  assert.throws(() => parseTomlDocument('a = ["x" "y"]\n'), /invalid|unexpected/i);
});

test('empty array tokens are rejected; a single trailing comma is TOML-legal', () => {
  assert.throws(() => parseTomlDocument('a = ["a",,"b"]\n'), /comma|value/i);
  assert.throws(() => parseTomlDocument('a = [,"a"]\n'), /comma|value/i);
  assert.deepEqual(parseTomlDocument('a = ["a", "b",]\n').a, ['a', 'b']);
  assert.deepEqual(parseTomlDocument('a = []\n').a, []);
});

test('integers outside Number.isSafeInteger are rejected', () => {
  assert.equal(parseTomlDocument('a = 9007199254740991\n').a, 9007199254740991);
  assert.throws(() => parseTomlDocument('a = 9007199254740993\n'), /losslessly|integer/i);
  assert.throws(() => parseTomlDocument(`a = ${'9'.repeat(40)}\n`), /losslessly|integer/i);
});

test('duplicate keys are rejected, per table', () => {
  assert.throws(() => parseTomlDocument('a = "x"\na = "y"\n'), /redefine|duplicate/i);
  assert.throws(() => parseTomlDocument('[[t]]\nid = "a"\nid = "b"\n'), /redefine|duplicate/i);
  const twice = parseTomlDocument('[[t]]\nid = "a"\n[[t]]\nid = "b"\n');
  assert.deepEqual(twice.t.map((item) => item.id), ['a', 'b']);
});

test('unterminated strings and arrays fail loudly', () => {
  // RE-DERIVED, not deleted: the assertion survives, its MESSAGE does not.
  // toml.mjs said "unterminated"; smol-toml reaches the line break first and
  // reports the control character. What is pinned is that it throws at all.
  assert.throws(() => parseTomlDocument('a = "never closed\n'), /Invalid TOML/);
  assert.throws(() => parseTomlDocument('a = ["x"\n'), /Invalid TOML/);
});

test('escaped quotes and backslashes round the escape set', () => {
  assert.equal(parseTomlDocument('a = "x\\"y"\n').a, 'x"y');
  assert.equal(parseTomlDocument('a = "x\\\\y"\n').a, 'x\\y');
  assert.throws(() => parseTomlDocument('a = "x\\qy"\n'), /escape/i);
});

test('CRLF input parses identically to LF input', () => {
  const lf = parseTomlDocument('schema = 1\na = "b"\nc = ["d"]\n');
  const crlf = parseTomlDocument('schema = 1\r\na = "b"\r\nc = ["d"]\r\n');
  assert.deepEqual(
    { schema: crlf.schema, a: crlf.a, c: crlf.c },
    { schema: lf.schema, a: lf.a, c: lf.c },
  );
});

test('a byte-order mark is rejected, never silently skipped', () => {
  // guard-core.mjs's frontmatter reader states this agreement in prose; it is
  // measured here so the prose has a basis in the tree.
  assert.throws(() => parseTomlDocument('﻿schema = 1\n'), /Invalid TOML/);
});

test('a table-array header inside a string stays a string', () => {
  const root = parseTomlDocument('a = "[[transition]]"\n');
  assert.equal(root.a, '[[transition]]');
  assert.equal(root.transition, undefined);
  assert.equal(parseTomlDocument('a = "[x] # not a comment"\n').a, '[x] # not a comment');
});

test('mid-line comments strip outside strings only', () => {
  assert.equal(parseTomlDocument('schema = 1 # the schema\n').schema, 1);
  assert.equal(parseTomlDocument('a = "x # y" # real comment\n').a, 'x # y');
  assert.deepEqual(
    parseTomlDocument('a = [\n  "x", # first\n  "y", # second\n]\n').a,
    ['x', 'y'],
  );
});
