// Upstream: spec-0002 §A.2 (record YAML), §A.3 step 1 (frontmatter id),
// Q7 policy carriers (grove-review-policy / grove-review-declaration),
// Q8 ledger (grove-test-deps). The mini-parser is the shared substrate;
// its own tests are technical (no npm YAML dep — see report).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml, YamlError } from '../lib/yaml.mjs';

test('scalars: int vs string, and integer schema field', () => {
  const v = parseYaml('schema: 1\nreview: conformance\nverdict: PASS');
  assert.equal(v.schema, 1);
  assert.equal(typeof v.schema, 'number');
  assert.equal(v.review, 'conformance');
  assert.equal(v.verdict, 'PASS');
});

test('inline # comment is stripped from a scalar value', () => {
  const v = parseYaml('status: approved  # gated -> approved: the human act');
  assert.equal(v.status, 'approved');
});

test('a # inside a quoted string is not a comment', () => {
  const v = parseYaml('note: "a # b"');
  assert.equal(v.note, 'a # b');
});

test('flow sequence', () => {
  const v = parseYaml('types: [spec, charter, code]');
  assert.deepEqual(v.types, ['spec', 'charter', 'code']);
});

test('empty flow sequence', () => {
  const v = parseYaml('types: []');
  assert.deepEqual(v.types, []);
});

test('block sequence', () => {
  const v = parseYaml('subject:\n  - specs/foo.md\n  - specs/bar.md');
  assert.deepEqual(v.subject, ['specs/foo.md', 'specs/bar.md']);
});

test('nested block map (manifest_hashes)', () => {
  const v = parseYaml('manifest_hashes:\n  specs/foo.md: abc\n  specs/bar.md: def');
  assert.deepEqual(v.manifest_hashes, { 'specs/foo.md': 'abc', 'specs/bar.md': 'def' });
});

test('block scalar with | preserves body', () => {
  const v = parseYaml('findings: |\n  line one\n  line two\nreviewer: bob');
  assert.equal(v.findings, 'line one\nline two');
  assert.equal(v.reviewer, 'bob');
});

// code-review BLOCK: stripComment must not run inside a block scalar.
// A findings body is markdown; a line whose first non-space char is `#`
// (a `## heading`, a `# note`) was wrongly blanked, corrupting the payload.
test('block scalar preserves interior # lines and blank lines verbatim (spec-0002 §A.2)', () => {
  const v = parseYaml('findings: |\n  ## Findings\n  - high: real bug\n\n  # note\nreviewer: bob');
  assert.equal(v.findings, '## Findings\n- high: real bug\n\n# note');
  assert.equal(v.reviewer, 'bob');
});

// A heading-only body must NOT collapse to "" (that false-positives
// match.mjs `vacuous-evidence` on a genuinely-reviewed record).
test('block scalar of only #-prefixed lines does not collapse to empty (spec-0002 §A.2)', () => {
  const v = parseYaml('findings: |\n  ## Findings\n  ## more\nreviewer: bob');
  assert.equal(v.findings, '## Findings\n## more');
  assert.notEqual(v.findings.trim(), '');
});

// code-review medium: duplicate mapping keys are a parse-vs-display
// divergence (a human reads the first `verdict:`, last-wins parsed the
// second). Reject fail-closed.
test('duplicate mapping keys are rejected (YamlError) (spec-0002 §A.2)', () => {
  assert.throws(() => parseYaml('verdict: PASS\nverdict: FAIL'), YamlError);
});

test('frontmatter-shaped input with trailing comments on several keys', () => {
  const src = [
    'id: spec-0002-review-bookkeeping-check',
    'type: spec',
    'status: approved  # gated -> approved',
    'implements: adr-0012-methodology-delivery-machinery  # the realized contract',
    'depends_on: [adr-0012-methodology-delivery-machinery, adr-0005-tdd-and-artifact-gated-dispatch]',
    'version: 1',
  ].join('\n');
  const v = parseYaml(src);
  assert.equal(v.id, 'spec-0002-review-bookkeeping-check');
  assert.equal(v.implements, 'adr-0012-methodology-delivery-machinery');
  assert.equal(v.version, 1);
  assert.deepEqual(v.depends_on, [
    'adr-0012-methodology-delivery-machinery',
    'adr-0005-tdd-and-artifact-gated-dispatch',
  ]);
});

test('quoted scalar keeps colons', () => {
  const v = parseYaml('fingerprint: "grove-fp-1:abc123"');
  assert.equal(v.fingerprint, 'grove-fp-1:abc123');
});

test('unquoted value containing a colon-space is still captured', () => {
  const v = parseYaml('fingerprint: grove-fp-1:deadbeef');
  assert.equal(v.fingerprint, 'grove-fp-1:deadbeef');
});

test('block sequence of scalars under a deeper indent', () => {
  const v = parseYaml('specs:\n  - spec-0002-review-bookkeeping-check@v1\ndecisions:\n  - adr-0012-methodology-delivery-machinery');
  assert.deepEqual(v.specs, ['spec-0002-review-bookkeeping-check@v1']);
  assert.deepEqual(v.decisions, ['adr-0012-methodology-delivery-machinery']);
});
