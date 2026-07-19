// Upstream: adr-0018 D8 — the load-time floor-guard CLI contract.
// The lib (resolveProfile) is unit-tested in profile.test.mjs; this covers the
// CLI's fail-loud wiring: exit 2 + a stderr warning on any fallback, exit 0 and
// silent stderr on a clean floor-satisfying file, and MISSING-is-not-an-error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/resolve-profile.mjs', import.meta.url));

function run(gatesPath) {
  try {
    const stdout = execFileSync('node', [CLI, gatesPath], { encoding: 'utf8' });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return { code: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || '') };
  }
}

const STEWARD_TOML = [
  'seeded_from = "steward"',
  '[gates]',
  'intent = "human"',
  'spec = "agent"',
  'build = "agent"',
  'ship = "human"',
].join('\n');

test('CLI — a clean floor-satisfying gates.toml exits 0, prints the profile, no stderr', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gates-'));
  try {
    const p = join(dir, 'gates.toml');
    writeFileSync(p, STEWARD_TOML);
    const r = run(p);
    assert.equal(r.code, 0);
    assert.equal(r.stderr, '');
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.source, 'file');
    assert.deepEqual(parsed.gates, { intent: 'human', spec: 'agent', build: 'agent', ship: 'human' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI — a MISSING gates.toml falls back to guardian, exits 2, warns on stderr', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gates-'));
  try {
    const r = run(join(dir, 'does-not-exist.toml'));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /guardian/i);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.source, 'fallback');
    assert.equal(parsed.seededFrom, 'guardian');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI (adr-0021 D2/AC3) — a gates.toml WITH top-level runtime_dir exits 0 and surfaces the key in the JSON output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gates-'));
  try {
    const p = join(dir, 'gates.toml');
    writeFileSync(p, ['runtime_dir = "plugins/grove/gates/"', STEWARD_TOML].join('\n'));
    const r = run(p);
    assert.equal(r.code, 0);
    assert.equal(r.stderr, '');
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.source, 'file');
    assert.equal(parsed.runtimeDir, 'plugins/grove/gates/');
    assert.deepEqual(parsed.gates, { intent: 'human', spec: 'agent', build: 'agent', ship: 'human' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI (adr-0021 AC2) — output on a gates.toml WITHOUT runtime_dir stays byte-identical (no runtimeDir key)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gates-'));
  try {
    const p = join(dir, 'gates.toml');
    writeFileSync(p, STEWARD_TOML);
    const r = run(p);
    assert.equal(r.code, 0);
    const parsed = JSON.parse(r.stdout);
    assert.equal('runtimeDir' in parsed, false);
    assert.deepEqual(Object.keys(parsed).sort(), ['floor', 'gates', 'seededFrom', 'source', 'warning']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI — a FLOOR-VIOLATING gates.toml falls back to guardian, exits 2, warns', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gates-'));
  try {
    const p = join(dir, 'gates.toml');
    writeFileSync(p, STEWARD_TOML.replace('intent = "human"', 'intent = "agent"').replace('ship = "human"', 'ship = "agent"'));
    const r = run(p);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /guardian/i);
    assert.equal(JSON.parse(r.stdout).source, 'fallback');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
