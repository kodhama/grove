// Upstream: adr-0018 (gate-profile mechanism + floor).
//   D3  — the three shipped presets and their C2 rows.
//   D4  — the profile is a single C2 axis (no C1 in gates.toml).
//   D7  — gates.toml is an explicit full table; the rows are the source of truth.
//   D8  — floor-guard is a load-time reader with a unified `guardian` fallback.
//   Floor (F1) — reject any profile with 0 human intent-locus gates
//                (intent = human OR ship = human).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS,
  GATE_ROWS,
  expandPreset,
  validateFloor,
  parseGatesToml,
  resolveProfile,
  FALLBACK_PRESET,
} from '../../../../../plugins/grove/runtime/gates/lib/profile.mjs';

// --- D3: the three presets expand to the exact C2 rows ---

test('D3 — steward expands to {human, agent, agent, human}', () => {
  const p = expandPreset('steward');
  assert.deepEqual(p.gates, { intent: 'human', spec: 'agent', build: 'agent', ship: 'human' });
  assert.equal(p.seededFrom, 'steward');
});

test('D3 — guardian expands to {human, human, agent, human}', () => {
  const p = expandPreset('guardian');
  assert.deepEqual(p.gates, { intent: 'human', spec: 'human', build: 'agent', ship: 'human' });
});

test('D3/F1 — initiator expands to {agent, agent, agent, human} (front intent agent-owned)', () => {
  const p = expandPreset('initiator');
  assert.deepEqual(p.gates, { intent: 'agent', spec: 'agent', build: 'agent', ship: 'human' });
});

test('expandPreset rejects an unknown preset name', () => {
  assert.throws(() => expandPreset('overlord'), /unknown preset/i);
});

test('every preset row is one of the four gates and a valid C2 value', () => {
  for (const name of Object.keys(PRESETS)) {
    const g = PRESETS[name];
    assert.deepEqual(Object.keys(g).sort(), [...GATE_ROWS].sort());
    for (const v of Object.values(g)) assert.ok(v === 'human' || v === 'agent');
  }
});

// --- Floor validator (F1): intent = human OR ship = human ---

test('F1 — steward passes the floor (human at front intent)', () => {
  assert.equal(validateFloor(PRESETS.steward).ok, true);
});

test('F1 — guardian passes the floor', () => {
  assert.equal(validateFloor(PRESETS.guardian).ok, true);
});

test('F1 — initiator passes the floor via ship = human (not the front gate)', () => {
  const r = validateFloor(PRESETS.initiator);
  assert.equal(r.ok, true);
});

test('F1 — an all-agent profile (intent AND ship agent) FAILS the floor', () => {
  const r = validateFloor({ intent: 'agent', spec: 'agent', build: 'agent', ship: 'agent' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /intent-locus/i);
});

test('F1 — a profile human ONLY at spec/build (both intent-loci agent) FAILS', () => {
  // spec/build are not intent-locus gates; a human there does not satisfy the floor
  const r = validateFloor({ intent: 'agent', spec: 'human', build: 'human', ship: 'agent' });
  assert.equal(r.ok, false);
});

test('validateFloor rejects an invalid C2 value (never treats a typo as human)', () => {
  const r = validateFloor({ intent: 'HUMAN', spec: 'agent', build: 'agent', ship: 'agent' });
  assert.equal(r.ok, false);
});

test('validateFloor rejects a missing gate row', () => {
  const r = validateFloor({ intent: 'human', spec: 'agent', build: 'agent' }); // no ship
  assert.equal(r.ok, false);
});

test('validateFloor rejects an UNKNOWN/extra gate row (the exact row set, not a superset)', () => {
  const r = validateFloor({ intent: 'human', spec: 'agent', build: 'agent', ship: 'human', deploy: 'agent' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /unknown gate row/i);
});

// --- parseGatesToml: the explicit-full-table shape (D7) ---

const STEWARD_TOML = [
  'seeded_from = "steward"',
  '',
  '[gates]',
  'intent = "human"',
  'spec   = "agent"   # inline comment tolerated',
  'build  = "agent"',
  'ship   = "human"',
  '',
  '[trigger]',
  'sources = ["human-ask", "cron", "ci-event"]',
  '',
  '[intent_external]',
  'enabled = false',
].join('\n');

test('D7 — parseGatesToml reads the four gate rows, seeded_from, trigger, intent_external', () => {
  const t = parseGatesToml(STEWARD_TOML);
  assert.equal(t.seededFrom, 'steward');
  assert.deepEqual(t.gates, { intent: 'human', spec: 'agent', build: 'agent', ship: 'human' });
  assert.deepEqual(t.trigger.sources, ['human-ask', 'cron', 'ci-event']);
  assert.equal(t.intentExternal.enabled, false);
});

test('parseGatesToml rejects a DUPLICATE key within a section (fail-closed, now by the PARSER)', () => {
  // RE-DERIVED for adr-0048, not just re-worded. The rejection used to come
  // from a hand-written duplicate guard here, on the argument that a last-wins
  // overwrite is a parse-vs-display divergence. TOML forbids redefinition
  // outright, so the parser refuses the document and the guard is gone rather
  // than kept beside a reader that already enforces it. The regex follows the
  // parser's word — "redefine" — with the old spelling kept so the assertion
  // does not silently pass on a reader that stops checking.
  const dup = ['[gates]', 'intent = "human"', 'intent = "agent"'].join('\n');
  assert.throws(() => parseGatesToml(dup), /redefine|duplicate/i);
  // And a duplicate SECTION header is refused on the same rule.
  assert.throws(
    () => parseGatesToml(['[gates]', 'intent = "human"', '[gates]', 'spec = "agent"'].join('\n')),
    /redefine|duplicate/i,
  );
});

// --- D8: load-time floor guard + unified guardian fallback ---

test('D8 — a valid on-disk steward profile resolves from the file (source=file, no warning)', () => {
  const r = resolveProfile({ text: STEWARD_TOML });
  assert.equal(r.source, 'file');
  assert.deepEqual(r.gates, { intent: 'human', spec: 'agent', build: 'agent', ship: 'human' });
  assert.equal(r.warning, null);
  assert.equal(r.floor.ok, true);
});

test('D8 — a valid initiator profile resolves from the file (floor via ship)', () => {
  const initiatorToml = STEWARD_TOML.replace('intent = "human"', 'intent = "agent"').replace('seeded_from = "steward"', 'seeded_from = "initiator"');
  const r = resolveProfile({ text: initiatorToml });
  assert.equal(r.source, 'file');
  assert.equal(r.gates.intent, 'agent');
  assert.equal(r.floor.ok, true);
});

test('D8 — a MISSING profile (text null) falls back to guardian + a loud warning', () => {
  const r = resolveProfile({ text: null });
  assert.equal(r.source, 'fallback');
  assert.equal(r.seededFrom, FALLBACK_PRESET);
  assert.deepEqual(r.gates, PRESETS.guardian);
  assert.match(r.warning, /guardian/i);
  assert.match(r.warning, /gates\.toml/i);
});

test('D8 — an UNREADABLE/malformed profile falls back to guardian + warning', () => {
  const r = resolveProfile({ text: 'this is not { valid toml [[[' });
  assert.equal(r.source, 'fallback');
  assert.deepEqual(r.gates, PRESETS.guardian);
  assert.match(r.warning, /guardian/i);
});

test('D8 — a FLOOR-VIOLATING profile (intent+ship both agent) falls back to guardian + warning', () => {
  const badToml = STEWARD_TOML.replace('intent = "human"', 'intent = "agent"').replace('ship   = "human"', 'ship   = "agent"');
  const r = resolveProfile({ text: badToml });
  assert.equal(r.source, 'fallback');
  assert.deepEqual(r.gates, PRESETS.guardian);
  assert.match(r.warning, /floor|guardian/i);
});

test('D8 — the guardian fallback itself satisfies the floor (a safe landing, never silent)', () => {
  const r = resolveProfile({ text: null });
  assert.equal(validateFloor(r.gates).ok, true);
});

test('D8 — an I/O read error is reported as "unreadable", distinct from "missing" (not a spurious floor-violation)', () => {
  const r = resolveProfile({ ioErrorMessage: 'EACCES: permission denied' });
  assert.equal(r.source, 'fallback');
  assert.deepEqual(r.gates, PRESETS.guardian);
  assert.match(r.warning, /unreadable/i);
  assert.match(r.warning, /permission denied/i);
  // and NOT misreported as a floor violation or a missing file
  assert.doesNotMatch(r.warning, /floor-violating|missing/i);
});

// --- adr-0021 D2: optional top-level `runtime_dir` key — tolerated, surfaced ---

const RUNTIME_DIR_TOML = ['runtime_dir = "vendor/grove-gates/"', STEWARD_TOML].join('\n');

test('adr-0021 D2 — parseGatesToml surfaces a present top-level runtime_dir', () => {
  const t = parseGatesToml(RUNTIME_DIR_TOML);
  assert.equal(t.runtimeDir, 'vendor/grove-gates/');
  // the rest of the parse is unaffected by the key
  assert.equal(t.seededFrom, 'steward');
  assert.deepEqual(t.gates, { intent: 'human', spec: 'agent', build: 'agent', ship: 'human' });
});

test('adr-0021 D2 — parseGatesToml reports runtimeDir null when the key is absent', () => {
  assert.equal(parseGatesToml(STEWARD_TOML).runtimeDir, null);
});

test('adr-0021 D2 — a whitespace-PADDED valid path is accepted and surfaced VERBATIM (no trim, no rewrite)', () => {
  const padded = ['runtime_dir = " vendor/grove-gates/ "', STEWARD_TOML].join('\n');
  const r = resolveProfile({ text: padded });
  assert.equal(r.source, 'file');
  assert.equal(r.warning, null);
  // verbatim pass-through: visibly padded in the output, loud at invocation —
  // never silently normalized (documented at parseGatesToml's return).
  assert.equal(r.runtimeDir, ' vendor/grove-gates/ ');
});

test('adr-0021 AC3 — a floor-satisfying profile WITH runtime_dir resolves from the file with the key surfaced', () => {
  const r = resolveProfile({ text: RUNTIME_DIR_TOML });
  assert.equal(r.source, 'file');
  assert.equal(r.warning, null);
  assert.equal(r.floor.ok, true);
  assert.equal(r.runtimeDir, 'vendor/grove-gates/');
  assert.deepEqual(r.gates, { intent: 'human', spec: 'agent', build: 'agent', ship: 'human' });
});

test('adr-0021 AC2 — resolveProfile output on a profile WITHOUT runtime_dir is byte-identical to before (no new key)', () => {
  const r = resolveProfile({ text: STEWARD_TOML });
  assert.equal('runtimeDir' in r, false);
  assert.deepEqual(Object.keys(r).sort(), ['floor', 'gates', 'seededFrom', 'source', 'warning']);
});

test('adr-0021 AC3 — runtime_dir present does NOT weaken [gates] extra-row strictness (unknown gate row still rejected)', () => {
  const withExtraRow = RUNTIME_DIR_TOML.replace('[trigger]', 'deploy = "agent"\n\n[trigger]');
  // sanity: the extra row landed inside [gates]
  assert.equal(parseGatesToml(withExtraRow).gates.deploy, 'agent');
  const r = resolveProfile({ text: withExtraRow });
  assert.equal(r.source, 'fallback');
  assert.match(r.warning, /unknown gate row/i);
});

// --- adr-0021 D2, code-review HIGH (670759d round): a wrong-TYPED declared
// runtime_dir must FAIL CLOSED (parse throw → loud guardian fallback), never
// silently vanish into the never-declared state ---

test('adr-0021 D2 (code-review HIGH) — a BOOLEAN runtime_dir throws at parse (wrong-but-present, not silently dropped)', () => {
  const t = ['runtime_dir = true', STEWARD_TOML].join('\n');
  assert.throws(() => parseGatesToml(t), /runtime_dir/i);
});

test('adr-0021 D2 (code-review HIGH) — an ARRAY runtime_dir throws at parse', () => {
  const t = ['runtime_dir = ["vendor/grove-gates/"]', STEWARD_TOML].join('\n');
  assert.throws(() => parseGatesToml(t), /runtime_dir/i);
});

test('adr-0021 D2 (code-review medium) — an EMPTY-string runtime_dir throws at parse (degenerate declared value)', () => {
  const t = ['runtime_dir = ""', STEWARD_TOML].join('\n');
  assert.throws(() => parseGatesToml(t), /runtime_dir/i);
});

test('adr-0021 D2 (code-review medium) — a WHITESPACE-only runtime_dir throws at parse', () => {
  const t = ['runtime_dir = "   "', STEWARD_TOML].join('\n');
  assert.throws(() => parseGatesToml(t), /runtime_dir/i);
});

test('adr-0021 D2 (code-review HIGH) — a wrong-typed runtime_dir routes through the LOUD guardian fallback (source=fallback, warning names the key)', () => {
  const r = resolveProfile({ text: ['runtime_dir = true', STEWARD_TOML].join('\n') });
  assert.equal(r.source, 'fallback');
  assert.deepEqual(r.gates, PRESETS.guardian);
  assert.match(r.warning, /runtime_dir/i);
});

test('adr-0021 D2 — runtime_dir is top-level, never a gate row: a runtime_dir INSIDE [gates] is rejected by strictness', () => {
  const insideGates = STEWARD_TOML.replace('[trigger]', 'runtime_dir = "vendor/grove-gates/"\n\n[trigger]');
  const r = resolveProfile({ text: insideGates });
  assert.equal(r.source, 'fallback');
  assert.match(r.warning, /unknown gate row/i);
});


// --- adr-0048 D1/D3: TOML is read by the dependency; the SHAPE stays grove's ---
//
// `parseGatesToml` was a hand-rolled line reader, and its own comment named the
// property it carried: "Throws on a line it cannot parse (a malformed profile
// must NOT parse into a half-populated object that could sneak past the floor;
// the guard treats a throw as 'unreadable' and falls back)." That property was
// carried by NARROWNESS — the reader accepted `"string"`, bool and `["a","b"]`
// and nothing else — so replacing it with a permissive parser and stopping
// there would parse those same inputs successfully and stop the loud fallback
// from ever firing.
//
// The split this pins is D1's: the LIBRARY decides what is legal TOML, and a
// grove-owned schema decides which legal documents are a gate profile. The
// schema is the shape adr-0018 D7 declares — top-level scalars, one level of
// `[section]`, and per-key string / bool / array-of-strings values — and it
// throws the same class of error the line reader threw, so the D8 fallback
// path fires unchanged.
//
// MEASURED SCOPE, so the claim is not larger than the evidence. The floor
// itself was NEVER reachable past `validateFloor`: every all-agent profile
// spelled in a way the old reader could not read (dotted keys, an inline
// table, quoted keys, literal strings) already fell back to guardian under
// both readers, because the floor validator checks the four rows whatever
// spelled them. What the narrowness actually protected is the CONSERVATISM of
// an unrelated malformation: a `[trigger]` key holding a number used to force
// the guardian fallback, and without the schema below it would silently stop
// doing so and honour a weaker declared profile instead.

const FLOOR_SAFE_GATES = [
  '[gates]',
  'intent = "human"',
  'spec = "agent"',
  'build = "agent"',
  'ship = "human"',
].join('\n');

// Every one of these is LEGAL TOML that a permissive parser accepts and
// populates. Each is outside the shape adr-0018 D7 declares for gates.toml.
const TOML_LEGAL_SCHEMA_INVALID = {
  'an integer value': `${FLOOR_SAFE_GATES}\n[trigger]\nmax = 7\n`,
  'a float value': `${FLOOR_SAFE_GATES}\n[trigger]\nrate = 1.5\n`,
  'a local date value': `${FLOOR_SAFE_GATES}\n[trigger]\nsince = 2020-01-01\n`,
  'an offset datetime value': `${FLOOR_SAFE_GATES}\n[trigger]\nat = 1979-05-27T07:32:00Z\n`,
  // TOP-LEVEL date forms, and they are here because a mutation proved the
  // sub-table cases could not reach the check that refuses them: smol-toml
  // returns a `TomlDate`, `typeof` reports it as an object, and a section test
  // written with `typeof` would read a date as an EMPTY SECTION and admit it.
  // Only a top-level date exercises that branch.
  'a top-level date value': `since = 2020-01-01\n${FLOOR_SAFE_GATES}\n`,
  'a top-level datetime value': `at = 1979-05-27T07:32:00Z\n${FLOOR_SAFE_GATES}\n`,
  'a top-level local time value': `at = 07:32:00\n${FLOOR_SAFE_GATES}\n`,
  'a sub-table': `${FLOOR_SAFE_GATES}\n[trigger.inner]\nx = "y"\n`,
  'an array of tables': `${FLOOR_SAFE_GATES}\n[[trigger]]\nx = "y"\n`,
  'a mixed-type array': `${FLOOR_SAFE_GATES}\n[trigger]\nsources = ["a", 1]\n`,
  'an array of arrays': `${FLOOR_SAFE_GATES}\n[trigger]\nsources = [["a"]]\n`,
  'an inline table one level down': `${FLOOR_SAFE_GATES}\n[trigger]\nx = { a = "b" }\n`,
  'a non-string seeded_from': `seeded_from = 7\n${FLOOR_SAFE_GATES}\n`,
  'a numeric gates value': `[gates]\nintent = 7\nspec = "agent"\nbuild = "agent"\nship = "human"\n`,
  'gates declared as a number': 'gates = 7\n',
};

test('adr-0048 D1 — a TOML-legal document outside the declared gates.toml shape THROWS at parse', () => {
  for (const [name, text] of Object.entries(TOML_LEGAL_SCHEMA_INVALID)) {
    // Proof that the input really is legal TOML and not merely a parse error:
    // a permissive reader would populate it. That is the whole hazard.
    assert.throws(
      () => parseGatesToml(text), /gates\.toml/,
      `${name}: must throw so D8 reads it as unreadable`,
    );
  }
});

test('adr-0048 D8 — a TOML-legal but schema-invalid profile still routes through the LOUD guardian fallback', () => {
  // THE LOAD-BEARING TEST. If the schema check is dropped, each of these
  // resolves source=file and the consumer silently runs the profile their
  // malformed file happens to declare, with no warning at all.
  for (const [name, text] of Object.entries(TOML_LEGAL_SCHEMA_INVALID)) {
    const r = resolveProfile({ text });
    assert.equal(r.source, 'fallback', `${name}: must not resolve from the file`);
    assert.deepEqual(r.gates, PRESETS.guardian, `${name}: must land on the guardian preset`);
    assert.match(r.warning, /unreadable/i, `${name}: and must say so out loud`);
  }
});

test('adr-0048 D3 — a legal TOML spelling the line reader could not read is now read correctly', () => {
  // Each of these is the SAME document as the clean steward profile, spelled a
  // way the `^([A-Za-z0-9_]+)\s*=\s*(.+)$` line regex could not match. Every
  // one used to throw and drop the consumer to guardian; the format decides
  // spelling now, and grove's schema decides shape.
  const spellings = {
    'dotted keys': 'gates.intent = "human"\ngates.spec = "agent"\ngates.build = "agent"\ngates.ship = "human"\n',
    'an inline gates table': 'gates = { intent = "human", spec = "agent", build = "agent", ship = "human" }\n',
    'a quoted section header': '["gates"]\nintent = "human"\nspec = "agent"\nbuild = "agent"\nship = "human"\n',
    'quoted keys': '[gates]\n"intent" = "human"\n"spec" = "agent"\n"build" = "agent"\n"ship" = "human"\n',
    'literal strings': "[gates]\nintent = 'human'\nspec = 'agent'\nbuild = 'agent'\nship = 'human'\n",
    'a multi-line basic string': '[gates]\nintent = """human"""\nspec = "agent"\nbuild = "agent"\nship = "human"\n',
    'an escape-spelled value': '[gates]\nintent = "huma\\u006e"\nspec = "agent"\nbuild = "agent"\nship = "human"\n',
    'a multi-line array': `${FLOOR_SAFE_GATES}\n[trigger]\nsources = [\n  "a",\n  "b",\n]\n`,
    'a hash inside a literal string': `${FLOOR_SAFE_GATES}\n[trigger]\nnote = 'a # b'\n`,
    // An inline table at the TOP level is a legal TOML spelling of a
    // `[section]`, so the shape admits it — the schema constrains value types
    // and nesting depth, never key or string spelling.
    'a top-level inline table': `trigger = { sources = ["a"] }\n${FLOOR_SAFE_GATES}\n`,
  };
  for (const [name, text] of Object.entries(spellings)) {
    const r = resolveProfile({ text });
    assert.equal(r.source, 'file', `${name}: a legal spelling of a valid profile resolves from the file`);
    assert.deepEqual(
      r.gates, { intent: 'human', spec: 'agent', build: 'agent', ship: 'human' },
      `${name}: and reads the same four rows`,
    );
    assert.equal(r.warning, null, `${name}: with no warning`);
  }
});

test('adr-0048 D3/F1 — the floor is the floor however the profile is spelled', () => {
  // The other half of the previous test, and the one that matters: the same
  // exotic spellings carrying an ALL-AGENT profile must still be refused. The
  // floor validator reads the four rows, so it never depended on the reader's
  // narrowness — measured under both readers before the swap.
  const allAgent = {
    'dotted keys': 'gates.intent = "agent"\ngates.spec = "agent"\ngates.build = "agent"\ngates.ship = "agent"\n',
    'an inline gates table': 'gates = { intent = "agent", spec = "agent", build = "agent", ship = "agent" }\n',
    'quoted keys': '[gates]\n"intent" = "agent"\n"spec" = "agent"\n"build" = "agent"\n"ship" = "agent"\n',
    'literal strings': "[gates]\nintent = 'agent'\nspec = 'agent'\nbuild = 'agent'\nship = 'agent'\n",
  };
  for (const [name, text] of Object.entries(allAgent)) {
    const r = resolveProfile({ text });
    assert.equal(r.source, 'fallback', `${name}: an all-agent profile never resolves from the file`);
    assert.deepEqual(r.gates, PRESETS.guardian, name);
    assert.match(r.warning, /floor/i, `${name}: and the warning names the floor, not a parse error`);
  }
});

test('adr-0048 — a byte-order mark now makes gates.toml UNREADABLE, disclosed rather than stripped', () => {
  // A BEHAVIOUR CHANGE IN THE FAIL-CLOSED DIRECTION, pinned so it is a
  // decision and not a surprise. The line reader ignored a leading BOM and
  // honoured the profile; smol-toml rejects it ("only letter, numbers, dashes
  // and underscores are allowed"), so an editor that writes a BOM now drops
  // the consumer to guardian WITH A LOUD WARNING instead of running their
  // profile. Grove does not define TOML and does not strip bytes the parser
  // refuses (adr-0048 D1) — the same ruling recorded for raw TAB.
  const r = resolveProfile({ text: `﻿${FLOOR_SAFE_GATES}\n` });
  assert.equal(r.source, 'fallback');
  assert.deepEqual(r.gates, PRESETS.guardian);
  assert.match(r.warning, /unreadable/i);
});
