// Upstream: spec-0006-voluntary-dispatch@v2 INV13 (strict evaluable
// encoding; the zero-dep parser was the plan's named most-dangerous
// fail-open surface). Decision: adr-0046-how-dispatch-rules-reach-a-session.
//
// Adversarial suite for the hand-rolled strict TOML subset. Leniency here is
// a fail-open: a rule, cursor, or record that silently parses to something
// other than what its author wrote is a rule nobody validated.
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseToml } from '../../../../../plugins/grove/runtime/dispatch/lib/toml.mjs';

test('__proto__ keys are inert data, never a prototype write', () => {
  const scalar = parseToml('__proto__ = "x"\n');
  assert.equal(Object.getPrototypeOf(scalar), null, 'tables carry no prototype');
  assert.equal(scalar['__proto__'], 'x', 'own data property, provably inert');
  assert.equal(typeof scalar.toString, 'undefined', 'nothing inherited');

  const array = parseToml('__proto__ = ["x"]\n');
  assert.equal(Object.getPrototypeOf(array), null, 'array value cannot set a prototype');
  assert.deepEqual(array['__proto__'], ['x']);
  const table = parseToml('[[transition]]\n__proto__ = "x"\n');
  assert.equal(Object.getPrototypeOf(table.transition[0]), null);
  assert.equal(table.transition[0]['__proto__'], 'x');
});

test('comma-less multi-line array items are rejected', () => {
  assert.throws(
    () => parseToml('a = [\n  "x"\n  "y"\n]\n'),
    /array|comma|invalid/i,
  );
  assert.throws(() => parseToml('a = ["x" "y"]\n'), /array|comma|invalid/i);
});

test('empty array tokens are rejected; a single trailing comma is TOML-legal', () => {
  assert.throws(() => parseToml('a = ["a",,"b"]\n'), /empty|array/i);
  assert.throws(() => parseToml('a = [,"a"]\n'), /empty|array/i);
  assert.throws(() => parseToml('a = ["a",,]\n'), /empty|array/i);
  assert.deepEqual(parseToml('a = ["a", "b",]\n').a, ['a', 'b']);
  assert.deepEqual(parseToml('a = []\n').a, []);
});

test('integers outside Number.isSafeInteger are rejected', () => {
  assert.equal(parseToml('a = 9007199254740991\n').a, 9007199254740991);
  assert.throws(() => parseToml('a = 9007199254740993\n'), /integer|safe/i);
  assert.throws(() => parseToml(`a = ${'9'.repeat(40)}\n`), /integer|safe/i);
});

test('raw control characters inside strings are rejected; escaped forms are fine', () => {
  assert.throws(() => parseToml('a = "xy"\n'), /control/i);
  assert.throws(() => parseToml('a = "x\ty"\n'), /control/i, 'raw tab');
  assert.throws(() => parseToml('a = "xy"\n'), /control/i, 'DEL');
  assert.equal(parseToml('a = "x\\ty"\n').a, 'x\ty', 'escaped tab is legal');
  assert.equal(parseToml('a = "x\\ny"\n').a, 'x\ny', 'escaped newline is legal');
});

test('duplicate keys are rejected, per table', () => {
  assert.throws(() => parseToml('a = "x"\na = "y"\n'), /duplicate/i);
  assert.throws(
    () => parseToml('[[t]]\nid = "a"\nid = "b"\n'),
    /duplicate/i,
  );
  // Same key in two different table entries is legal.
  const twice = parseToml('[[t]]\nid = "a"\n[[t]]\nid = "b"\n');
  assert.deepEqual(twice.t.map((item) => item.id), ['a', 'b']);
});

test('unterminated strings and arrays fail loudly', () => {
  assert.throws(() => parseToml('a = "never closed\n'), /unterminated/i);
  assert.throws(() => parseToml('a = ["x"\n'), /unterminated|invalid/i);
});

test('escaped quotes and backslashes round the strict escape set', () => {
  assert.equal(parseToml('a = "x\\"y"\n').a, 'x"y');
  assert.equal(parseToml('a = "x\\\\y"\n').a, 'x\\y');
  assert.throws(() => parseToml('a = "x\\qy"\n'), /escape/i, 'undeclared escape');
});

test('CRLF input parses identically to LF input', () => {
  const lf = parseToml('schema = 1\na = "b"\nc = ["d"]\n');
  const crlf = parseToml('schema = 1\r\na = "b"\r\nc = ["d"]\r\n');
  assert.deepEqual(
    { schema: crlf.schema, a: crlf.a, c: crlf.c },
    { schema: lf.schema, a: lf.a, c: lf.c },
  );
});

test('a byte-order mark is rejected, never silently skipped', () => {
  assert.throws(() => parseToml('﻿schema = 1\n'), /invalid|key|BOM/i);
});

test('a table-array header inside a string stays a string', () => {
  const root = parseToml('a = "[[transition]]"\n');
  assert.equal(root.a, '[[transition]]');
  assert.equal(root.transition, undefined);
  const hash = parseToml('a = "[x] # not a comment"\n');
  assert.equal(hash.a, '[x] # not a comment');
});

test('mid-line comments strip outside strings only', () => {
  assert.equal(parseToml('schema = 1 # the schema\n').schema, 1);
  assert.equal(parseToml('a = "x # y" # real comment\n').a, 'x # y');
  assert.deepEqual(
    parseToml('a = [\n  "x", # first\n  "y", # second\n]\n').a,
    ['x', 'y'],
  );
});
