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
} from '../lib/profile.mjs';

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

test('parseGatesToml rejects a DUPLICATE key within a section (fail-closed, matching check/lib/toml.mjs)', () => {
  const dup = ['[gates]', 'intent = "human"', 'intent = "agent"'].join('\n');
  assert.throws(() => parseGatesToml(dup), /duplicate/i);
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
