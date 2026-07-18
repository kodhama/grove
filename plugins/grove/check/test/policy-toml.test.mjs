// Upstream: adr-0018 D10 — the review-policy split. The consumer scope choice +
// corpus policy move to `.grove/review.toml` (TOML, D9); the grove-wiring
// carrier keys (`check_runtime_dir`, `check_workflow_path`) move to an internal
// TOML file. The check reads the split by synthesizing the equivalent
// `grove-review-policy` block, so parseReviewPolicy / resolveCarriers stay
// unchanged. Load-bearing: adr-0013 AC4 carrier fail-close must survive the move
// — an absent wiring key must NOT be forged into a passing carrier; it falls to
// the install default (which then reds if it does not exist on the protected
// branch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseToml } from '../lib/toml.mjs';
import { synthesizePolicyBlock, parseReviewPolicy } from '../lib/policy.mjs';

// --- parseToml: the flat review.toml / wiring shape ---

test('parseToml reads flat string keys, inline arrays, comments', () => {
  const t = parseToml([
    '# consumer review config',
    'scope = "scoped"   # inline comment',
    'artifact_dirs = ["decisions", "specs", "charters"]',
    'reviewless_types = ["research", "feedback"]',
    'prose_extensions = [".md", ".txt", ".rst"]',
  ].join('\n'));
  assert.equal(t.scope, 'scoped');
  assert.deepEqual(t.artifact_dirs, ['decisions', 'specs', 'charters']);
  assert.deepEqual(t.reviewless_types, ['research', 'feedback']);
  assert.deepEqual(t.prose_extensions, ['.md', '.txt', '.rst']);
});

test('parseToml handles paths with dots and slashes as array items', () => {
  const t = parseToml('non_behavioral_allowlist = ["README.md", ".claude/agents/README.md"]');
  assert.deepEqual(t.non_behavioral_allowlist, ['README.md', '.claude/agents/README.md']);
});

test('parseToml on an empty/whitespace body returns an empty object', () => {
  assert.deepEqual(parseToml('   \n # only a comment\n'), {});
});

// --- synthesizePolicyBlock: review.toml + wiring -> a grove-review-policy block
//     that the existing parser round-trips ---

const REVIEW_TOML = [
  'scope = "scoped"',
  'artifact_dirs = ["decisions", "specs"]',
  'reviewless_types = ["research"]',
  'non_behavioral_allowlist = ["README.md"]',
  'prose_extensions = [".md", ".txt"]',
].join('\n');

const WIRING_TOML = [
  'check_runtime_dir = ".grove/internal/check/"',
  'check_workflow_path = ".github/workflows/grove-review-bookkeeping.yml"',
].join('\n');

test('D10 — synthesized block carries a grove-review-policy fence (bootstrap self-detect still sees "installed")', () => {
  const text = synthesizePolicyBlock({ reviewToml: REVIEW_TOML, wiringToml: WIRING_TOML });
  assert.match(text, /```grove-review-policy/);
});

test('D10 — a round-trip through parseReviewPolicy recovers scope, corpus keys, and carrier keys', () => {
  const text = synthesizePolicyBlock({ reviewToml: REVIEW_TOML, wiringToml: WIRING_TOML });
  const rp = parseReviewPolicy(text);
  assert.equal(rp.scope, 'scoped');
  assert.deepEqual(rp.artifactDirs, ['decisions', 'specs']);
  assert.deepEqual(rp.reviewlessTypes, ['research']);
  assert.deepEqual(rp.allowlist, ['README.md']);
  assert.deepEqual(rp.proseExtensions, ['.md', '.txt']);
  assert.deepEqual(rp.checkRuntimeDir, { path: '.grove/internal/check/', provenance: 'written' });
  assert.deepEqual(rp.checkWorkflowPath, {
    path: '.github/workflows/grove-review-bookkeeping.yml',
    provenance: 'written',
  });
});

test('adr-0013 AC4 fail-close — an ABSENT wiring file omits carrier keys, so they fall to install defaults (defaulted, never forged)', () => {
  const text = synthesizePolicyBlock({ reviewToml: REVIEW_TOML, wiringToml: null });
  const rp = parseReviewPolicy(text);
  // absent => the parser's defaulted provenance (resolveCarriers then reds if the
  // default path does not exist on the protected branch — the fail-close)
  assert.equal(rp.checkRuntimeDir.provenance, 'defaulted');
  assert.equal(rp.checkWorkflowPath.provenance, 'defaulted');
  assert.equal(rp.checkRuntimeDir.path, '.grove/internal/check/');
});

test('adr-0013 AC4 fail-close — a wiring file present but MISSING one key defaults only that key', () => {
  const text = synthesizePolicyBlock({
    reviewToml: REVIEW_TOML,
    wiringToml: 'check_runtime_dir = "tools/check/"',
  });
  const rp = parseReviewPolicy(text);
  assert.deepEqual(rp.checkRuntimeDir, { path: 'tools/check/', provenance: 'written' });
  assert.equal(rp.checkWorkflowPath.provenance, 'defaulted'); // absent => default
});

test('D11 fail-close — an unrecognized scope in review.toml still resolves to strict', () => {
  const text = synthesizePolicyBlock({ reviewToml: 'scope = "loose"', wiringToml: WIRING_TOML });
  const rp = parseReviewPolicy(text);
  assert.equal(rp.scope, 'strict');
});

test('HIGH fail-OPEN fix — a NON-STRING (array) scope through synthesis resolves to strict/unrecognized, byte-equivalent to the single-file YAML path (adr-0013 dec 2 / INV19)', () => {
  // Regression: yamlScalar(["scoped"]) once coerced to the string "scoped" and
  // softened jurisdiction to scoped. The synthesized block must instead emit a
  // non-string shape so parseReviewPolicy's typeof-string guard fires -> strict.
  const text = synthesizePolicyBlock({ reviewToml: 'scope = ["scoped"]', wiringToml: WIRING_TOML });
  const rp = parseReviewPolicy(text);
  assert.equal(rp.scope, 'strict', 'a malformed non-string scope must NOT soften to scoped');
  assert.equal(rp.scopeUnrecognized, true);
  // parity check: the single-file YAML path resolves the identical shape the same way
  const yamlRp = parseReviewPolicy('```grove-review-policy\nschema: 1\nscope: [scoped]\n```');
  assert.equal(yamlRp.scope, rp.scope);
  assert.equal(yamlRp.scopeUnrecognized, rp.scopeUnrecognized);
});

test('a malformed WIRING file tags the thrown error source as "wiring" (so git-adapter names the right path)', () => {
  assert.throws(
    () => synthesizePolicyBlock({ reviewToml: 'scope = "scoped"', wiringToml: 'not valid toml [[[' }),
    (e) => e.source === 'wiring',
  );
});

test('a malformed REVIEW file tags the thrown error source as "review"', () => {
  assert.throws(
    () => synthesizePolicyBlock({ reviewToml: 'not valid toml [[[', wiringToml: WIRING_TOML }),
    (e) => e.source === 'review',
  );
});
