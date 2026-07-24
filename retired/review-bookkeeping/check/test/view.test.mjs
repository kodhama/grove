// The rendered status view + reason grammar (spec-0002 §D; INV11, INV15; S8,
// S14). One derivation, four consumers: the rendered text and the structured
// output are the SAME single derivation. Green is non-authorizing — the view
// never carries "approved" / "reviewed" / "safe to merge".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderView, render } from '../lib/view.mjs';

const GREEN_BANNER = 'Bookkeeping complete — a human still judges genuineness and merges. This is NOT approval.';
const FORBIDDEN = ['approved', 'reviewed', 'safe to merge'];

test('S8 — green renders the verbatim non-authorizing banner', () => {
  const text = renderView({ green: true, rows: [], rejectedRecords: [] });
  assert.ok(text.includes(GREEN_BANNER));
});

test('S8 — a green view never says approved / reviewed / safe to merge (AC6)', () => {
  const derivation = {
    green: true,
    rows: [
      { kind: 'pair', review: 'conformance', subject: 'specs/foo.md', latestVerdict: 'PASS', fresh: true, covers: true, separated: true, recordSequence: [{ verdict: 'PASS' }], reasons: [] },
      { kind: 'pair', review: 'spec-adversary', subject: 'specs/foo.md', latestVerdict: 'APPROVE-READY', fresh: true, covers: true, separated: true, recordSequence: [{ verdict: 'APPROVE-READY' }], reasons: [] },
    ],
    rejectedRecords: [],
  };
  const lower = renderView(derivation).toLowerCase();
  for (const w of FORBIDDEN) assert.ok(!lower.includes(w), `must not contain "${w}"`);
});

test('S14 — the append-only FAIL → PASS sequence stays readable (even on green)', () => {
  const derivation = {
    green: true,
    rows: [
      { kind: 'pair', review: 'conformance', subject: 'specs/foo.md', latestVerdict: 'PASS', fresh: true, covers: true, separated: true, recordSequence: [{ verdict: 'FAIL' }, { verdict: 'PASS' }], reasons: [] },
    ],
    rejectedRecords: [],
  };
  const text = renderView(derivation);
  assert.ok(text.includes('FAIL → PASS'));
  // still non-authorizing
  const lower = text.toLowerCase();
  for (const w of FORBIDDEN) assert.ok(!lower.includes(w));
});

test('red — each un-green row states its reason token(s) from the §D enum', () => {
  const derivation = {
    green: false,
    rows: [
      { kind: 'pair', review: 'spec-adversary', subject: 'specs/bar.md', latestVerdict: null, fresh: null, covers: false, separated: null, recordSequence: [], reasons: [{ code: 'never-reviewed', token: 'never-reviewed' }] },
      { kind: 'pair', review: 'conformance', subject: 'specs/foo.md', latestVerdict: 'PASS', fresh: false, covers: true, separated: true, recordSequence: [], reasons: [{ code: 'upstream-changed', token: 'upstream-decisions/adr-x.md-changed' }] },
    ],
    rejectedRecords: [],
  };
  const text = renderView(derivation);
  assert.ok(text.includes('never-reviewed'));
  assert.ok(text.includes('upstream-decisions/adr-x.md-changed'));
  assert.ok(text.includes('specs/bar.md'));
});

test('rejected records are surfaced in the rendered view with their cause (§A.4)', () => {
  const derivation = {
    green: false,
    rows: [{ kind: 'pair', review: 'conformance', subject: 'specs/foo.md', latestVerdict: null, fresh: null, covers: false, separated: null, recordSequence: [], reasons: [{ code: 'record-rejected', token: 'record-rejected' }] }],
    rejectedRecords: [{ cause: 'edited', review: 'conformance', author: 'mallory', id: 7 }],
  };
  const text = renderView(derivation);
  assert.ok(text.toLowerCase().includes('edited'));
});

// ---------------------------------------------------------------------------
// §D scope-mode rendering (adr-0013 dec 5/AC7; INV22, S21) + the carrier row +
// the round-3 remedy hint + the unrecognized-scope note.
// ---------------------------------------------------------------------------

const GREEN_LOWER_FORBIDDEN = FORBIDDEN;

test('INV22 / S21 — scoped green banner names the mode and the aggregate jurisdiction count on one line', () => {
  const text = renderView({
    green: true, rows: [], rejectedRecords: [],
    scope: { mode: 'scoped', jurisdiction: { inScope: 3, total: 14 } },
  });
  assert.ok(text.includes('scoped mode: 3 of 14 changed files in jurisdiction'), text);
  // INV11 non-authorizing language unchanged, no per-file exemption rows
  assert.ok(text.includes('A human still judges genuineness and merges. This is NOT approval.'));
  const lower = text.toLowerCase();
  for (const w of GREEN_LOWER_FORBIDDEN) assert.ok(!lower.includes(w), `must not contain "${w}"`);
});

test('INV22 — scoped RED header also states the mode and the jurisdiction count (green and red alike)', () => {
  const text = renderView({
    green: false,
    rows: [{ kind: 'pair', review: 'spec-adversary', subject: 'specs/bar.md', latestVerdict: null, fresh: null, covers: false, separated: null, recordSequence: [], reasons: [{ code: 'never-reviewed', token: 'never-reviewed' }] }],
    rejectedRecords: [],
    scope: { mode: 'scoped', jurisdiction: { inScope: 1, total: 2 } },
  });
  assert.ok(text.includes('scoped mode: 1 of 2 changed files in jurisdiction'), text);
  assert.ok(text.includes('never-reviewed'));
});

test('INV19 — a plain-strict derivation (no scope descriptor) renders BYTE-IDENTICAL to before (green banner unchanged)', () => {
  const text = renderView({ green: true, rows: [], rejectedRecords: [] });
  assert.equal(text, GREEN_BANNER);
});

test('INV22 / W2 — an unrecognized scope value is named on EVERY run, green and red alike', () => {
  const green = renderView({
    green: true, rows: [], rejectedRecords: [],
    scope: { mode: 'strict', rawValue: 'scopped', unrecognized: true },
  });
  assert.ok(green.includes("scope: 'scopped' unrecognized — resolved to strict (fail-closed)"), green);
  // the strict green banner itself is unchanged
  assert.ok(green.includes(GREEN_BANNER));

  const red = renderView({
    green: false,
    rows: [{ kind: 'pair', review: 'conformance', subject: 'specs/foo.md', latestVerdict: null, fresh: null, covers: false, separated: null, recordSequence: [], reasons: [{ code: 'never-reviewed', token: 'never-reviewed' }] }],
    rejectedRecords: [],
    scope: { mode: 'strict', rawValue: 'scopped', unrecognized: true },
  });
  assert.ok(red.includes("scope: 'scopped' unrecognized — resolved to strict (fail-closed)"), red);
});

test('§D — a carrier-unresolved file-level row renders its key, resolved path, and written/defaulted provenance', () => {
  const text = renderView({
    green: false,
    rows: [{
      kind: 'file', review: null, subject: '.grove/internal/check/', latestVerdict: null, fresh: null, covers: null, separated: null,
      recordSequence: [], reasons: [{ code: 'carrier-unresolved', token: 'carrier-unresolved', payload: { key: 'check_runtime_dir', path: '.grove/internal/check/', provenance: 'defaulted' } }],
    }],
    rejectedRecords: [],
    scope: { mode: 'scoped', jurisdiction: { inScope: 0, total: 0 } },
  });
  assert.ok(text.includes('carrier-unresolved'));
  assert.ok(text.includes('check_runtime_dir'));
  assert.ok(text.includes('.grove/internal/check/'));
  assert.ok(text.includes('defaulted'));
});

test('§D round-3 remedy hint — an unclaimed-type red row names both cures (reviewless_types or a reviewer declaration)', () => {
  const text = renderView({
    green: false,
    rows: [{
      kind: 'pair', review: 'conformance', subject: 'specs/widget.md', latestVerdict: null, fresh: null, covers: false, separated: null,
      recordSequence: [], reasons: [{ code: 'no-reviewable-upstream', token: 'no-reviewable-upstream' }], remedy: { type: 'widget' },
    }],
    rejectedRecords: [],
    scope: { mode: 'scoped', jurisdiction: { inScope: 1, total: 1 } },
  });
  assert.ok(text.includes('unclaimed type `widget`'), text);
  assert.ok(text.includes('reviewless_types'));
  assert.ok(text.includes('charters/review-policy.md'));
  assert.ok(text.toLowerCase().includes('reviewer declaration'));
});

test('§D remedy hint — the hint appears once per subject, not once per owed row', () => {
  const row = (review) => ({
    kind: 'pair', review, subject: 'specs/widget.md', latestVerdict: null, fresh: null, covers: false, separated: null,
    recordSequence: [], reasons: [{ code: 'never-reviewed', token: 'never-reviewed' }], remedy: { type: 'widget' },
  });
  const text = renderView({
    green: false,
    rows: [row('conformance'), row('spec-adversary'), row('code-reviewer'), row('decision-adversary')],
    rejectedRecords: [],
    scope: { mode: 'scoped', jurisdiction: { inScope: 1, total: 1 } },
  });
  const hits = text.split('unclaimed type `widget`').length - 1;
  assert.equal(hits, 1, `expected one hint for the subject, got ${hits}`);
});

test('render() emits the SAME single derivation as structured output alongside the text', () => {
  const derivation = { green: true, rows: [], rejectedRecords: [] };
  const out = render(derivation);
  assert.equal(out.structured, derivation);
  assert.equal(typeof out.text, 'string');
});

test('§D allowlist remedy hint — an allowlist-eligible prose no-reviewable-upstream row names the allowlist cure (adr-0022 D1)', () => {
  const text = renderView({
    green: false,
    rows: [{
      kind: 'pair', review: 'conformance', subject: 'docs/GUIDE.md', latestVerdict: null, fresh: null, covers: false, separated: null,
      recordSequence: [], reasons: [{ code: 'no-reviewable-upstream', token: 'no-reviewable-upstream' }], allowlistRemedy: { path: 'docs/GUIDE.md' },
    }],
    rejectedRecords: [],
    scope: null,
  });
  assert.ok(text.includes('docs/GUIDE.md'), text);
  assert.ok(text.includes('non_behavioral_allowlist'), text);
  assert.ok(text.includes('charters/review-policy.md'));
  assert.ok(text.includes('INV14'));
});

test('§D allowlist remedy hint — appears once per subject, not once per owed row', () => {
  const row = (review) => ({
    kind: 'pair', review, subject: 'docs/GUIDE.md', latestVerdict: null, fresh: null, covers: false, separated: null,
    recordSequence: [], reasons: [{ code: 'no-reviewable-upstream', token: 'no-reviewable-upstream' }], allowlistRemedy: { path: 'docs/GUIDE.md' },
  });
  const text = renderView({ green: false, rows: [row('conformance'), row('code-reviewer')], rejectedRecords: [], scope: null });
  const hits = text.split('non_behavioral_allowlist').length - 1;
  assert.equal(hits, 1, `expected one hint per subject, got ${hits}`);
});
