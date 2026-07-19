// Upstream: spec-0003 §A.1 (carrier: spec-0002 §A.1 delimitation inherited,
// per-block isolation — adr-0019), §A.2 (ask schema: schema 1, producer, type,
// subject list, optional annotations/resumed_by; deliberately NO fingerprint),
// §A.3 (effectiveness hard rules: reviewless-type rule 1, frontmatter-wins
// rule 2, both-fire flagged multiplicity, fail-closed union of effective ask
// types), §A.4/§D.1 (ask coverage; §A.4 admissibility inherited whole from
// spec-0002). INV1–INV5, INV8; S1–S3, S13 (phase-0 surface). adr-0023 D2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAskBlocks,
  parseAskComment,
  evaluateAskEffectiveness,
  askCoveredFiles,
  flaggedRows,
  effectiveAskTypes,
  serializeAsk,
} from '../lib/asks.mjs';
import { parseComment, extractVerdictBlocks, checkAdmissibility } from '../lib/records.mjs';

const askBody = (over = {}) => {
  const rec = {
    schema: 1,
    producer: 'executor',
    type: 'code',
    subject: '[plugins/grove/check/lib/asks.mjs, plugins/grove/check/test/asks.test.mjs]',
    ...over,
  };
  const lines = Object.entries(rec)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`);
  return '```grove-review-ask\n' + lines.join('\n') + '\n```';
};

const comment = (over = {}) => ({
  id: 1,
  body: askBody(),
  author: 'agent-a',
  authorAssociation: 'MEMBER',
  createdAt: '2026-07-19T00:00:00Z',
  updatedAt: '2026-07-19T00:00:00Z',
  ...over,
});

// Evaluation context: `typeOf` is the spec-0002 §C.2 HEAD-frontmatter type
// basis (null = frontmatterless / no `type:` declaration); `reviewlessTypes`
// is the protected-branch policy's positive reviewless declaration.
const mkCtx = ({ types = {}, reviewless = ['research', 'feedback'] } = {}) => ({
  typeOf: (p) => (Object.prototype.hasOwnProperty.call(types, p) ? types[p] : null),
  reviewlessTypes: reviewless,
});

// Parse a body's well-formed schema-valid asks into the wrapped shape the
// set-level functions consume: [{ record, commentId }].
const parsedAsks = (body, commentId = 1) =>
  parseAskComment({ body })
    .blocks.filter((b) => b.status === 'record')
    .map((b) => ({ record: b.record, commentId }));

// --- block extraction and parse (§A.1, §A.2; INV2) ---

test('a prose-only comment carries no ask blocks (none)', () => {
  assert.deepEqual(extractAskBlocks('please review this, thanks'), []);
  assert.equal(parseAskComment(comment({ body: 'please review this' })).status, 'none');
});

test('parses a schema-valid ask record (producer, type, subject list)', () => {
  const parsed = parseAskComment(comment());
  assert.equal(parsed.status, 'multi');
  assert.equal(parsed.blocks.length, 1);
  assert.equal(parsed.blocks[0].status, 'record');
  const rec = parsed.blocks[0].record;
  assert.equal(rec.producer, 'executor');
  assert.equal(rec.type, 'code');
  assert.deepEqual(rec.subject, [
    'plugins/grove/check/lib/asks.mjs',
    'plugins/grove/check/test/asks.test.mjs',
  ]);
  assert.equal(rec.annotations, undefined);
  assert.equal(rec.resumed_by, undefined);
});

test('optional annotations and resumed_by are carried (§A.2 dual attribution)', () => {
  const body = askBody({
    producer: 'executor',
    resumed_by: 'run-resumer',
    annotations: '|\n  touched the fingerprint path; worth a close look',
  });
  const rec = parseAskComment(comment({ body })).blocks[0].record;
  assert.equal(rec.resumed_by, 'run-resumer');
  assert.match(rec.annotations, /fingerprint path/);
});

test('a comment may batch several ask blocks — each its own record (S1, adr-0019)', () => {
  const body =
    askBody({ type: 'code', subject: '[plugins/grove/check/lib/asks.mjs]' }) +
    '\n\n' +
    askBody({ type: 'charter', subject: '[charters/executor.md]' });
  const parsed = parseAskComment(comment({ body }));
  assert.equal(parsed.status, 'multi');
  assert.equal(parsed.blocks.length, 2);
  assert.deepEqual(parsed.blocks.map((b) => b.status), ['record', 'record']);
  assert.deepEqual(parsed.blocks.map((b) => b.record.type), ['code', 'charter']);
  assert.deepEqual(parsed.blocks.map((b) => b.blockIndex), [0, 1]);
});

test('a malformed ask block is inert on its own; a well-formed sibling survives (S13, INV2)', () => {
  const malformed = '```grove-review-ask\n\tschema: 1\n  producer: executor\n```';
  const parsed = parseAskComment(comment({ body: malformed + '\n\n' + askBody() }));
  assert.equal(parsed.blocks.length, 2);
  assert.equal(parsed.blocks[0].status, 'inert');
  assert.equal(parsed.blocks[1].status, 'record');
});

test('an unclosed ask fence is inert alone and never swallows the next sibling (S13)', () => {
  const unclosed = '```grove-review-ask\nschema: 1\nproducer: executor';
  const parsed = parseAskComment(comment({ body: unclosed + '\n\n' + askBody() }));
  assert.equal(parsed.blocks.length, 2);
  assert.equal(parsed.blocks[0].status, 'inert'); // unclosed => malformed => inert
  assert.equal(parsed.blocks[1].status, 'record');
});

test('schema absent or !== 1 => inert (fail-closed by non-recognition, §A.2)', () => {
  assert.equal(parseAskComment(comment({ body: askBody({ schema: undefined }) })).blocks[0].status, 'inert');
  assert.equal(parseAskComment(comment({ body: askBody({ schema: 2 }) })).blocks[0].status, 'inert');
});

test('missing producer / missing type / empty subject list => inert (§A.2)', () => {
  assert.equal(parseAskComment(comment({ body: askBody({ producer: undefined }) })).blocks[0].status, 'inert');
  assert.equal(parseAskComment(comment({ body: askBody({ type: undefined }) })).blocks[0].status, 'inert');
  assert.equal(parseAskComment(comment({ body: askBody({ subject: '[]' }) })).blocks[0].status, 'inert');
});

// --- effectiveness rule 1: reviewless type (§A.3, INV4; S2) ---

test('a reviewless-typed ask is ineffective for EVERY subject and covers nothing (S2)', () => {
  const asks = parsedAsks(askBody({ type: 'research', subject: '[plugins/grove/check/lib/x.mjs]' }), 7);
  const ctx = mkCtx();
  assert.deepEqual([...askCoveredFiles(asks, ctx)], []);
  assert.deepEqual(flaggedRows(asks, ctx), [
    { path: 'plugins/grove/check/lib/x.mjs', cause: 'reviewless-type', comment: 7 },
  ]);
});

test('rule 1 flags one row per subject of the reviewless block', () => {
  const asks = parsedAsks(askBody({ type: 'feedback', subject: '[a.mjs, b.mjs]' }), 3);
  const rows = flaggedRows(asks, mkCtx());
  assert.deepEqual(rows, [
    { path: 'a.mjs', cause: 'reviewless-type', comment: 3 },
    { path: 'b.mjs', cause: 'reviewless-type', comment: 3 },
  ]);
});

// --- effectiveness rule 2: frontmatter wins (§A.3, INV5; S3) ---

test('a divergent frontmatter type inerts the ask for that subject ONLY — siblings stay covered (S3)', () => {
  const asks = parsedAsks(askBody({ type: 'charter', subject: '[specs/foo.md, charters/bar.md]' }), 9);
  const ctx = mkCtx({ types: { 'specs/foo.md': 'spec', 'charters/bar.md': 'charter' } });
  assert.deepEqual([...askCoveredFiles(asks, ctx)], ['charters/bar.md']);
  assert.deepEqual(flaggedRows(asks, ctx), [
    { path: 'specs/foo.md', cause: 'frontmatter-divergence', comment: 9 },
  ]);
});

test('a frontmatter-bearing subject whose type MATCHES the ask is covered, unflagged', () => {
  const asks = parsedAsks(askBody({ type: 'spec', subject: '[specs/foo.md]' }));
  const ctx = mkCtx({ types: { 'specs/foo.md': 'spec' } });
  assert.deepEqual([...askCoveredFiles(asks, ctx)], ['specs/foo.md']);
  assert.deepEqual(flaggedRows(asks, ctx), []);
});

// --- both-fire multiplicity (§A.3, INV4; S3 second half) ---

test('rule 1 + rule 2 both fire => BOTH causes emit as separate rows, neither suppressed (S3)', () => {
  const asks = parsedAsks(askBody({ type: 'research', subject: '[specs/foo.md]' }), 5);
  const ctx = mkCtx({ types: { 'specs/foo.md': 'spec' } });
  assert.deepEqual([...askCoveredFiles(asks, ctx)], []);
  assert.deepEqual(flaggedRows(asks, ctx), [
    { path: 'specs/foo.md', cause: 'reviewless-type', comment: 5 },
    { path: 'specs/foo.md', cause: 'frontmatter-divergence', comment: 5 },
  ]);
});

test('one flagged row per (record, subject, cause) triple — a duplicated subject dedupes within its record', () => {
  const asks = parsedAsks(askBody({ type: 'research', subject: '[a.mjs, a.mjs]' }), 2);
  assert.deepEqual(flaggedRows(asks, mkCtx()), [
    { path: 'a.mjs', cause: 'reviewless-type', comment: 2 },
  ]);
});

// --- fail-closed union of effective ask types (§A.3, INV3) ---

test('several effective asks on one frontmatterless subject => UNION of types, never latest-wins (INV3)', () => {
  const asks = [
    ...parsedAsks(askBody({ type: 'code', subject: '[tools/build.mjs]' }), 1),
    ...parsedAsks(askBody({ type: 'notes', subject: '[tools/build.mjs]' }), 2),
  ];
  const types = effectiveAskTypes(asks, mkCtx());
  assert.deepEqual([...types.get('tools/build.mjs')].sort(), ['code', 'notes']);
});

test('effectiveAskTypes carries frontmatterless subjects only; rule-inerted subjects never enter it', () => {
  const asks = [
    // frontmatter-resolved (matching type): covered, but the table derives it
    ...parsedAsks(askBody({ type: 'spec', subject: '[specs/foo.md]' }), 1),
    // rule 2 inerts this record for specs/foo.md; sibling code file is effective
    ...parsedAsks(askBody({ type: 'code', subject: '[specs/foo.md, lib/a.mjs]' }), 2),
    // rule 1 inerts the whole block
    ...parsedAsks(askBody({ type: 'research', subject: '[lib/a.mjs]' }), 3),
  ];
  const ctx = mkCtx({ types: { 'specs/foo.md': 'spec' } });
  const types = effectiveAskTypes(asks, ctx);
  assert.equal(types.has('specs/foo.md'), false);
  assert.deepEqual([...types.get('lib/a.mjs')], ['code']);
});

// --- coverage (§D.1 / Terms `ask_covered_files`) ---

test('askCoveredFiles is the union of effectively covered subjects across records', () => {
  const asks = [
    ...parsedAsks(askBody({ type: 'code', subject: '[lib/a.mjs]' }), 1),
    ...parsedAsks(askBody({ type: 'charter', subject: '[charters/bar.md]' }), 2),
  ];
  const ctx = mkCtx({ types: { 'charters/bar.md': 'charter' } });
  assert.deepEqual([...askCoveredFiles(asks, ctx)].sort(), ['charters/bar.md', 'lib/a.mjs']);
});

test('a non-normalizable subject path matches nothing — covers nothing, flags nothing (fail-closed by non-match)', () => {
  const asks = parsedAsks(askBody({ type: 'code', subject: '[../escape.mjs, lib/a.mjs]' }), 1);
  const ctx = mkCtx();
  assert.deepEqual([...askCoveredFiles(asks, ctx)], ['lib/a.mjs']);
  assert.deepEqual(flaggedRows(asks, ctx), []);
});

test('evaluateAskEffectiveness returns the per-record covered/flagged split', () => {
  const [ask] = parsedAsks(askBody({ type: 'charter', subject: '[specs/foo.md, charters/bar.md]' }), 4);
  const ctx = mkCtx({ types: { 'specs/foo.md': 'spec' } });
  const r = evaluateAskEffectiveness(ask.record, ctx, ask.commentId);
  assert.deepEqual(r.covered, ['charters/bar.md']);
  assert.deepEqual(r.flagged, [{ path: 'specs/foo.md', cause: 'frontmatter-divergence', comment: 4 }]);
});

// --- serializer (§A.2 — an ask is an obligation declaration, NOT an attestation) ---

test('serializeAsk emits a fenced block that round-trips through the parser', () => {
  const block = serializeAsk({
    producer: 'executor',
    type: 'code',
    subject: ['plugins/grove/check/lib/asks.mjs', 'plugins/grove/check/test/asks.test.mjs'],
  });
  assert.match(block, /^```grove-review-ask\n/);
  assert.match(block, /\n```$/);
  const parsed = parseAskComment({ body: block });
  assert.equal(parsed.blocks[0].status, 'record');
  const rec = parsed.blocks[0].record;
  assert.equal(rec.producer, 'executor');
  assert.equal(rec.type, 'code');
  assert.deepEqual(rec.subject, [
    'plugins/grove/check/lib/asks.mjs',
    'plugins/grove/check/test/asks.test.mjs',
  ]);
});

test('a serialized ask carries NO fingerprint and NO manifest_hashes (§A.2 design fact)', () => {
  const block = serializeAsk({ producer: 'shaper', type: 'adr', subject: ['decisions/adr-x.md'] });
  assert.doesNotMatch(block, /fingerprint/);
  assert.doesNotMatch(block, /manifest_hashes/);
});

test('serializeAsk carries optional annotations and resumed_by, round-tripped', () => {
  const block = serializeAsk({
    producer: 'executor',
    type: 'code',
    subject: ['lib/a.mjs'],
    annotations: 'touched the fingerprint path\nworth a close look',
    resumed_by: 'run-resumer',
  });
  const rec = parseAskComment({ body: block }).blocks[0].record;
  assert.equal(rec.resumed_by, 'run-resumer');
  assert.equal(rec.annotations, 'touched the fingerprint path\nworth a close look');
});

test('serializeAsk fails loudly on an empty subject list or fence-breaking annotations', () => {
  assert.throws(() => serializeAsk({ producer: 'executor', type: 'code', subject: [] }));
  assert.throws(() =>
    serializeAsk({
      producer: 'executor',
      type: 'code',
      subject: ['lib/a.mjs'],
      annotations: 'text\n```\nmore',
    })
  );
});

// --- admissibility inherited whole (§A.4, INV8) ---

test('spec-0002 §A.4 admissibility applies unchanged to ask comments (edited => rejected)', () => {
  const edited = comment({ updatedAt: '2026-07-19T01:00:00Z' });
  const a = checkAdmissibility(edited, {});
  assert.equal(a.admissible, false);
  assert.equal(a.cause, 'edited');
});

// --- INV1 regression: asks are invisible to the shipped check ---

test('a grove-review-ask fence is invisible to the grove-verdict extractor (INV1)', () => {
  const c = comment(); // body is a grove-review-ask block
  assert.deepEqual(extractVerdictBlocks(c.body), []);
  assert.equal(parseComment(c).status, 'none');
});

test('a comment carrying both an ask and a verdict: the shipped check reads ONLY the verdict (INV1)', () => {
  const verdict =
    '```grove-verdict\nschema: 1\nreview: conformance\nverdict: PASS\nsubject: [specs/foo.md]\n' +
    'manifest_hashes:\n  specs/foo.md: abc\nfingerprint: grove-fp-1:' + 'a'.repeat(64) + '\n' +
    'producer: agent-a\nreviewer: agent-b\nfindings: ok\n```';
  const body = askBody() + '\n\n' + verdict;
  const parsed = parseComment(comment({ body }));
  assert.equal(parsed.status, 'multi');
  assert.equal(parsed.blocks.length, 1); // the ask block never registers
  assert.equal(parsed.blocks[0].status, 'record');
  assert.equal(parsed.blocks[0].record.review, 'conformance');
});
