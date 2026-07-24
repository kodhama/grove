// Upstream: spec-0002 §B (owed-map, ONE rule, fail-closed override),
// §C.1 (policy from protected branch), §C.2 (allowlist prose predicate).
// INV1, INV7, INV14; S4, S6, S11, S12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePolicy, allowlistExempts, allowlistEligible } from '../lib/policy.mjs';

const reviewPolicyText = [
  '```grove-review-policy',
  'schema: 1',
  'artifact_dirs: [decisions, specs, charters]',
  'reviewless_types: [research, feedback]',
  'non_behavioral_allowlist:',
  '  - README.md',
  '  - scripts/run.sh',
  'prose_extensions: [.md, .txt, .rst]',
  '```',
].join('\n');

const decl = (review, types, pass) =>
  `\`\`\`grove-review-declaration\nschema: 1\nreview: ${review}\ntypes: [${types.join(', ')}]\npass_class: [${pass.join(', ')}]\n\`\`\``;

const fullCharters = [
  decl('conformance', ['spec', 'charter', 'code'], ['PASS']),
  decl('spec-adversary', ['spec'], ['APPROVE-READY']),
  decl('code-reviewer', ['code'], ['CLEAN', 'PASS-WITH-ADVISORIES']),
  decl('decision-adversary', ['adr', 'decision'], ['SOUND']),
];

test('assembles owed reviews for a spec: conformance + spec-adversary', () => {
  const p = assemblePolicy({ reviewPolicyText, charterTexts: fullCharters });
  assert.deepEqual(p.owed('spec').sort(), ['conformance', 'spec-adversary']);
});

test('assembles owed reviews for code: conformance + code-reviewer', () => {
  const p = assemblePolicy({ reviewPolicyText, charterTexts: fullCharters });
  assert.deepEqual(p.owed('code').sort(), ['code-reviewer', 'conformance']);
});

test('a positively-declared reviewless type owes nothing (S12)', () => {
  const p = assemblePolicy({ reviewPolicyText, charterTexts: fullCharters });
  assert.deepEqual(p.owed('research'), []);
});

test('an unclaimed/unknown type owes the FULL set, never nothing (S4/INV7)', () => {
  const p = assemblePolicy({ reviewPolicyText, charterTexts: fullCharters });
  assert.deepEqual(
    p.owed('widget').sort(),
    ['code-reviewer', 'conformance', 'decision-adversary', 'spec-adversary'],
  );
});

test('unclaimedType distinguishes the fail-closed full-set case from a declared/reviewless type (§D remedy-hint substrate, round 3)', () => {
  const p = assemblePolicy({ reviewPolicyText, charterTexts: fullCharters });
  // an unknown frontmatter type falls to the full set via INV7's override
  assert.equal(p.unclaimedType('widget'), true);
  // a declared type is claimed, never "unclaimed"
  assert.equal(p.unclaimedType('spec'), false);
  assert.equal(p.unclaimedType('code'), false);
  // a positively-declared reviewless type is not "unclaimed" (it owes nothing on purpose)
  assert.equal(p.unclaimedType('research'), false);
});

test('reviewless is a positive declaration, never inferred from absence', () => {
  // policy with NO reviewless_types => research now owes the full set
  const noReviewless = reviewPolicyText.replace('reviewless_types: [research, feedback]', 'reviewless_types: []');
  const p = assemblePolicy({ reviewPolicyText: noReviewless, charterTexts: fullCharters });
  assert.equal(p.owed('research').length, 4);
});

test('a missing decision-adversary declaration makes a decision fall to the full set (S10 substrate)', () => {
  const noDecl = fullCharters.slice(0, 3); // drop decision-adversary
  const p = assemblePolicy({ reviewPolicyText, charterTexts: noDecl });
  assert.deepEqual(p.owed('decision').length, 4);
  // and its pass_class is unknown => never passing (fail-closed)
  assert.equal(p.passClass('decision-adversary'), null);
});

test('passClass reflects the declared tokens', () => {
  const p = assemblePolicy({ reviewPolicyText, charterTexts: fullCharters });
  assert.deepEqual(p.passClass('conformance'), ['PASS']);
  assert.deepEqual(p.passClass('code-reviewer').sort(), ['CLEAN', 'PASS-WITH-ADVISORIES']);
});

test('artifactDirs and posterPolicy default correctly', () => {
  const p = assemblePolicy({ reviewPolicyText, charterTexts: fullCharters });
  assert.deepEqual(p.artifactDirs, ['decisions', 'specs', 'charters']);
  assert.equal(p.recordPosterAllowlist, null); // absent => author_association default
});

// --- allowlist prose predicate (§C.2, INV14) ---

test('an allowlisted markdown path is exempt', () => {
  const p = assemblePolicy({ reviewPolicyText, charterTexts: fullCharters });
  assert.equal(allowlistExempts(p, 'README.md', '# readme\n'), true);
});

test('an allowlisted non-prose extension is NOT exempt (allowlist cannot exempt code, S11)', () => {
  const p = assemblePolicy({ reviewPolicyText, charterTexts: fullCharters });
  // scripts/run.sh is listed but .sh is not a prose extension
  assert.equal(allowlistExempts(p, 'scripts/run.sh', 'echo hi\n'), false);
});

test('an allowlisted prose path with a shebang first line is NOT exempt (S11)', () => {
  const p = assemblePolicy({ reviewPolicyText, charterTexts: fullCharters });
  // even a .md first-lined with a shebang fails the predicate
  assert.equal(allowlistExempts(p, 'README.md', '#!/usr/bin/env node\n# tricked\n'), false);
});

test('a path not on the allowlist is never exempt', () => {
  const p = assemblePolicy({ reviewPolicyText, charterTexts: fullCharters });
  assert.equal(allowlistExempts(p, 'specs/foo.md', '# spec\n'), false);
});

// --- allowlistEligible: the remedy-hint discoverability predicate (adr-0022 D1) ---
const eligPolicy = (allow = []) => assemblePolicy({
  reviewPolicyText: ['```grove-review-policy', 'schema: 1',
    ...(allow.length ? ['non_behavioral_allowlist:', ...allow.map((a) => `  - ${a}`)] : []), '```'].join('\n'),
  charterTexts: [],
});

test('allowlistEligible — an unlisted prose path is eligible (adr-0022 D1)', () => {
  assert.equal(allowlistEligible(eligPolicy(), 'docs/GUIDE.md', '# guide\n'), true);
});

test('allowlistEligible — a path already on the allowlist is not "eligible" (already exempt)', () => {
  assert.equal(allowlistEligible(eligPolicy(['README.md']), 'README.md', '# hello\n'), false);
});

test('allowlistEligible — a non-prose extension is not eligible (never a review-free zone for code, INV14)', () => {
  assert.equal(allowlistEligible(eligPolicy(), 'config/thing.toml', 'key = 1\n'), false);
});

test('allowlistEligible — a prose path whose first line is a shebang is not eligible', () => {
  assert.equal(allowlistEligible(eligPolicy(), 'docs/x.md', '#!/usr/bin/env node\n# tricked\n'), false);
});
