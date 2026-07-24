// Upstream: spec-0003 §D — the report-only shadow comparator (adr-0023 D5
// phase 2, AC3): §D.1's five per-PR metrics — the audit-side owed set (the
// §A.3 fail-closed UNION over effective ask types; frontmatter-typed files
// mirror the table by construction; R_judg files via non-vacuous dispositions)
// against the table-side owed set READ from the shipped check's own derivation,
// never re-derived; the pinned `0/0 (empty diff)` metric-3 rendering (N1);
// metric 4's four-way verdict naming the failed §C.3 binding; metric 5's HWM
// races. §C.5 selection semantics applied as the read side (latest admissible
// audit by comment order wins; exclusions reported — S7); the §D.1 flagged
// listing and stamped-field-vs-recomputation findings (INV9); and §D.2's
// LOAD-BEARING byte-identity regression (INV1, S11): the shipped check's
// derivation, rendered view, and structured output are byte-identical with and
// without ask/audit records in the stream.
// INV1, INV9, INV16; S4, S7, S8, S11, S12. adr-0023 D5 (phase 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePolicy } from '../lib/policy.mjs';
import { runCheck } from '../lib/check.mjs';
import { render } from '../lib/view.mjs';
import { groveFp1, pathHashAt } from '../lib/fingerprint.mjs';
import { serializeAsk, parseAskComment } from '../lib/asks.mjs';
import { emitAudit, serializeAudit, policyCarriers } from '../lib/audit.mjs';
import { computeComparison, renderComparison } from '../lib/compare.mjs';

// --- fixtures ---

const T = '2026-07-19T00:00:00Z';

const adr = (id, status = 'approved') => `---\nid: ${id}\ntype: adr\nstatus: ${status}\n---\n`;
const spec = (id, impl) =>
  `---\nid: ${id}\ntype: spec\nstatus: gated\nimplements: ${impl}\ndepends_on: [${impl}]\n---\n`;
const ledgerBlock = (ids) => '```grove-test-deps\nschema: 1\nspecs: [' + ids.join(', ') + ']\n```';

const reviewPolicyPath = 'charters/review-policy.md';
const reviewPolicyText = ['```grove-review-policy', 'schema: 1', 'reviewless_types: [research, feedback]', '```'].join('\n');
const declText = (review, types, pass) =>
  `\`\`\`grove-review-declaration\nschema: 1\nreview: ${review}\ntypes: [${types.join(', ')}]\npass_class: [${pass.join(', ')}]\n\`\`\``;
// `notes` is claimed by the spec-adversary ONLY — a second claimed type whose
// owed set differs from `code`'s, for the §A.3/INV3 union metric case.
const charterEntries = [
  { path: 'charters/conformance-reviewer.md', text: declText('conformance', ['spec', 'charter', 'code'], ['PASS']) },
  { path: 'charters/spec-adversary.md', text: declText('spec-adversary', ['spec', 'notes'], ['APPROVE-READY']) },
  { path: 'charters/code-reviewer.md', text: declText('code-reviewer', ['code'], ['CLEAN', 'PASS-WITH-ADVISORIES']) },
  { path: 'charters/decision-adversary.md', text: declText('decision-adversary', ['adr', 'decision'], ['SOUND']) },
];
const policy = assemblePolicy({ reviewPolicyText, reviewPolicyPath, charterTexts: charterEntries });
// The protected-branch content the policy fingerprint recomputes over — the
// same texts the policy was assembled from (Terms: policy carriers).
const protectedTree = new Map([
  [reviewPolicyPath, reviewPolicyText],
  ...charterEntries.map((e) => [e.path, e.text]),
]);

const cmt = (id, body, over = {}) => ({
  id,
  body,
  author: 'alice',
  authorAssociation: 'MEMBER',
  createdAt: T,
  updatedAt: T,
  ...over,
});

// A verdict-record comment (the check.test.mjs fixture shape).
function rec(tree, { review, verdict, subject, basis, findings = 'evidence', producer = 'prod', reviewer = 'rev', id }) {
  const lines = [
    '```grove-verdict', 'schema: 1', `review: ${review}`, `verdict: ${verdict}`, 'subject:',
    ...subject.map((s) => `  - ${s}`), 'manifest_hashes:',
    ...basis.map((p) => `  ${p}: ${pathHashAt(tree, p)}`),
    `fingerprint: ${groveFp1(basis, tree)}`, `producer: ${producer}`, `reviewer: ${reviewer}`,
    `findings: ${findings}`, '```',
  ];
  return cmt(id, lines.join('\n'));
}

const parsedAsks = (body, commentId) =>
  parseAskComment({ body })
    .blocks.filter((b) => b.status === 'record')
    .map((b) => ({ record: b.record, commentId }));

// Emit a stamped audit comment over ONE snapshot (§C.2, N3) using the
// package's own emitter — never a hand-rolled record.
const auditCmt = (id, judgment, { diffFiles, asks = [], tree, comments = [] }) => {
  const { block } = emitAudit({
    judgment,
    diffFiles,
    asks,
    reviewlessTypes: policy.reviewlessTypes,
    tree,
    carrierPaths: policyCarriers(policy),
    protectedTree,
    comments,
  });
  return cmt(id, block);
};

// The comparator over the REAL shipped derivation (§D.1: the table side is
// read from runCheck's own output, never re-derived by a second implementation).
const compare = ({ changed, tree, comments }) =>
  computeComparison({
    diffFiles: changed,
    tree,
    comments,
    policy,
    derivation: runCheck({ changed, tree, comments, policy }),
    protectedTree,
  });

const pair = (subject, review) => ({ subject, review });
const key = (p) => `${p.review}|${p.subject}`;

// --- metric 3: no-ask diff files (§D.1) ---

test('metric 3 — |R_cov| over |diff_files|; an effective ask leaves the residue (§D.1)', () => {
  const tree = new Map([
    ['pkg/a.mjs', 'const a = 1;\n'],
    ['pkg/b.mjs', 'const b = 2;\n'],
    ['pkg/c.mjs', 'const c = 3;\n'],
  ]);
  const changed = ['pkg/a.mjs', 'pkg/b.mjs', 'pkg/c.mjs'];
  const comments = [cmt(1, serializeAsk({ producer: 'executor', type: 'code', subject: ['pkg/a.mjs'] }))];
  const c = compare({ changed, tree, comments });
  assert.deepEqual(c.metrics.noAsk, { count: 2, total: 3 });
  assert.match(renderComparison(c), /3\. no-ask diff files: 2\/3 \(0\.67\)/);
});

test('metric 3 — empty diff renders 0/0 (empty diff), never a division (N1)', () => {
  const c = compare({ changed: [], tree: new Map(), comments: [] });
  assert.deepEqual(c.metrics.noAsk, { count: 0, total: 0 });
  const text = renderComparison(c);
  assert.match(text, /3\. no-ask diff files: 0\/0 \(empty diff\)/);
  assert.ok(!/NaN/.test(text));
});

test('an edited ask comment is inadmissible (§A.4 inherited): its subjects stay unasked and unflagged', () => {
  const tree = new Map([['pkg/a.mjs', 'const a = 1;\n']]);
  const changed = ['pkg/a.mjs'];
  const edited = cmt(1, serializeAsk({ producer: 'executor', type: 'code', subject: ['pkg/a.mjs'] }), {
    updatedAt: '2026-07-19T01:00:00Z',
  });
  const c = compare({ changed, tree, comments: [edited] });
  assert.deepEqual(c.metrics.noAsk, { count: 1, total: 1 });
  assert.deepEqual(c.flagged, []);
});

// --- metric 4: audit-fresh-at-HEAD (§D.1, §C.3) ---

test('S4 — frontmatter-typed-only diff: R_judg = ∅, no-audit-owed, metrics 1–2 empty, metric 5 n/a', () => {
  const tree = new Map([
    ['decisions/adr-x.md', adr('adr-x')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
  ]);
  const c = compare({ changed: ['specs/foo.md'], tree, comments: [] });
  assert.equal(c.metrics.freshness.verdict, 'no-audit-owed');
  // frontmatter-typed files mirror the table by construction — neither metric fires
  assert.deepEqual(c.metrics.tableOnly, []);
  assert.deepEqual(c.metrics.auditOnly, []);
  assert.equal(c.metrics.hwmRaces, null);
  assert.match(renderComparison(c), /4\. audit-fresh-at-HEAD: no-audit-owed/);
  assert.match(renderComparison(c), /5\. HWM races: n\/a \(no audit selected\)/);
});

test('metric 4 — owed-and-absent when R_judg ≠ ∅ and no audit is in the stream', () => {
  const tree = new Map([['pkg/a.mjs', 'const a = 1;\n']]);
  const c = compare({ changed: ['pkg/a.mjs'], tree, comments: [] });
  assert.equal(c.metrics.freshness.verdict, 'owed-and-absent');
  assert.equal(c.metrics.hwmRaces, null);
});

test('metric 4 — a fresh audit reads fresh; metric 5 counts zero races', () => {
  const tree = new Map([['pkg/a.mjs', 'const a = 1;\n']]);
  const changed = ['pkg/a.mjs'];
  const audit = auditCmt(1, {
    auditor: 'auditor',
    dispositions: { 'pkg/a.mjs': { owed: [], why: 'scratch script; states none owed' } },
  }, { diffFiles: changed, tree, comments: [] });
  const c = compare({ changed, tree, comments: [audit] });
  assert.equal(c.metrics.freshness.verdict, 'fresh');
  assert.equal(c.metrics.hwmRaces, 0);
  assert.deepEqual(c.audit, { commentId: 1, blockIndex: 0 });
});

test('metric 4 — staleness names the failed binding: content (§C.3.1)', () => {
  const tree = new Map([['pkg/a.mjs', 'const a = 1;\n']]);
  const changed = ['pkg/a.mjs'];
  const audit = auditCmt(1, {
    auditor: 'auditor',
    dispositions: { 'pkg/a.mjs': { owed: [], why: 'none owed, stated' } },
  }, { diffFiles: changed, tree, comments: [] });
  const treeAfterPush = new Map(tree);
  treeAfterPush.set('pkg/a.mjs', 'const a = 2;\n');
  const c = compare({ changed, tree: treeAfterPush, comments: [audit] });
  assert.equal(c.metrics.freshness.verdict, 'stale');
  assert.deepEqual(c.metrics.freshness.stale, ['content']);
  assert.match(renderComparison(c), /4\. audit-fresh-at-HEAD: stale \(content\)/);
});

// --- S8 three-way: typed HWM staleness and metric 5 ---

test('S8 — typed fence past the HWM (even malformed/unclosed) ⇒ stale (stream) + a metric-5 race', () => {
  const tree = new Map([['pkg/a.mjs', 'const a = 1;\n'], ['pkg/b.mjs', 'const b = 2;\n']]);
  const changed = ['pkg/a.mjs', 'pkg/b.mjs'];
  const ask1 = cmt(1, serializeAsk({ producer: 'executor', type: 'code', subject: ['pkg/a.mjs'] }));
  const audit = auditCmt(2, {
    auditor: 'auditor',
    dispositions: { 'pkg/b.mjs': { owed: [], why: 'scratch file; none owed' } },
  }, { diffFiles: changed, asks: parsedAsks(ask1.body, 1), tree, comments: [ask1] });
  // an UNCLOSED exact-tag ask fence: inert as a record (covers nothing), yet a
  // typed-record-stream member — it stales, fail-closed (§C.3, N4)
  const racedComment = cmt(3, '```grove-review-ask\nschema: 1');
  const c = compare({ changed, tree, comments: [ask1, audit, racedComment] });
  assert.equal(c.metrics.freshness.verdict, 'stale');
  assert.deepEqual(c.metrics.freshness.stale, ['stream']);
  assert.equal(c.metrics.hwmRaces, 1);
});

test('S8 — prose never stales; a later audit supersedes by §C.5 selection, never by HWM', () => {
  const tree = new Map([['pkg/a.mjs', 'const a = 1;\n'], ['pkg/b.mjs', 'const b = 2;\n']]);
  const changed = ['pkg/a.mjs', 'pkg/b.mjs'];
  const ask1 = cmt(1, serializeAsk({ producer: 'executor', type: 'code', subject: ['pkg/a.mjs'] }));
  const asks = parsedAsks(ask1.body, 1);
  const judgment = {
    auditor: 'auditor',
    dispositions: { 'pkg/b.mjs': { owed: [], why: 'scratch file; none owed' } },
  };
  const audit1 = auditCmt(2, judgment, { diffFiles: changed, asks, tree, comments: [ask1] });

  // prose past the HWM: still fresh, zero races (F6)
  const cProse = compare({ changed, tree, comments: [ask1, audit1, cmt(3, 'a human aside, prose only')] });
  assert.equal(cProse.metrics.freshness.verdict, 'fresh');
  assert.equal(cProse.metrics.hwmRaces, 0);

  // a later audit: the earlier one is superseded by selection, not staled
  const audit2 = auditCmt(4, judgment, { diffFiles: changed, asks, tree, comments: [ask1, audit1] });
  const cSuperseded = compare({ changed, tree, comments: [ask1, audit1, audit2] });
  assert.deepEqual(cSuperseded.audit, { commentId: 4, blockIndex: 0 });
  assert.equal(cSuperseded.metrics.freshness.verdict, 'fresh');
  assert.equal(cSuperseded.metrics.hwmRaces, 0);
});

// --- §C.5 selection + S7 separation exclusion ---

test('S7 — auditor ∈ P: the audit is excluded from selection and the exclusion reported', () => {
  const tree = new Map([['pkg/a.mjs', 'const a = 1;\n'], ['pkg/b.mjs', 'const b = 2;\n']]);
  const changed = ['pkg/a.mjs', 'pkg/b.mjs'];
  const ask1 = cmt(1, serializeAsk({ producer: 'executor', type: 'code', subject: ['pkg/a.mjs'] }));
  const asks = parsedAsks(ask1.body, 1);
  const judgment = (auditor) => ({
    auditor,
    dispositions: { 'pkg/b.mjs': { owed: [], why: 'scratch file; none owed' } },
  });
  const goodAudit = auditCmt(2, judgment('auditor'), { diffFiles: changed, asks, tree, comments: [ask1] });
  // the LATER audit is by the producer — inadmissible, never selected (INV14)
  const selfAudit = auditCmt(3, judgment('executor'), { diffFiles: changed, asks, tree, comments: [ask1, goodAudit] });
  const c = compare({ changed, tree, comments: [ask1, goodAudit, selfAudit] });
  assert.deepEqual(c.audit, { commentId: 2, blockIndex: 0 });
  const excl = c.findings.find((f) => f.kind === 'inadmissible-audit');
  assert.ok(excl, JSON.stringify(c.findings));
  assert.equal(excl.commentId, 3);
  assert.equal(excl.cause, 'auditor-separation');
  assert.match(renderComparison(c), /inadmissible audit excluded from selection \(comment 3, block 0\): auditor-separation/);
});

// --- metrics 1–2: the owed-set comparison (§D.1) ---

test('metrics 1–2 — the fail-closed UNION over effective ask types is the audit-side owed set (INV3)', () => {
  const tree = new Map([['pkg/code.mjs', 'const x = 1;\n']]);
  const changed = ['pkg/code.mjs'];
  const comments = [
    cmt(1, serializeAsk({ producer: 'executor', type: 'code', subject: ['pkg/code.mjs'] })),
    // a second effective ask with a DIFFERENT claimed type: the owed set is the
    // union (code → conformance + code-reviewer; notes → spec-adversary) —
    // never latest-wins (§A.3, INV3)
    cmt(2, serializeAsk({ producer: 'shaper', type: 'notes', subject: ['pkg/code.mjs'] })),
  ];
  const c = compare({ changed, tree, comments });
  // table side types it `code` (no frontmatter ⇒ code): conformance + code-reviewer,
  // both inside the union ⇒ nothing audit-omitted
  assert.deepEqual(c.metrics.tableOnly, []);
  // the union adds the notes-claimed reviewer the table never owed
  assert.deepEqual(c.metrics.auditOnly, [pair('pkg/code.mjs', 'spec-adversary')]);
});

test('S12 — a vacuous disposition leaves the table pairs audit-omitted (metric 1); a stated match zeroes both', () => {
  const tree = new Map([['pkg/code.mjs', 'const x = 1;\n']]);
  const changed = ['pkg/code.mjs'];

  // vacuous why ⇒ the file is unsatisfied by the audit; its table-owed pairs
  // are candidate false positives (metric 1)
  const vacuous = auditCmt(1, {
    auditor: 'auditor',
    dispositions: { 'pkg/code.mjs': { owed: ['conformance'], why: '' } },
  }, { diffFiles: changed, tree, comments: [] });
  const cVac = compare({ changed, tree, comments: [vacuous] });
  assert.deepEqual(
    new Set(cVac.metrics.tableOnly.map(key)),
    new Set([key(pair('pkg/code.mjs', 'conformance')), key(pair('pkg/code.mjs', 'code-reviewer'))]),
  );
  assert.deepEqual(cVac.metrics.auditOnly, []);

  // a non-vacuous disposition matching the table zeroes both metrics
  const stated = auditCmt(2, {
    auditor: 'auditor',
    dispositions: { 'pkg/code.mjs': { owed: ['conformance', 'code-reviewer'], why: 'plain code; the table set is right' } },
  }, { diffFiles: changed, tree, comments: [] });
  const cStated = compare({ changed, tree, comments: [stated] });
  assert.deepEqual(cStated.metrics.tableOnly, []);
  assert.deepEqual(cStated.metrics.auditOnly, []);
});

// --- flagged listing + stamped-field mismatch findings (INV9) ---

test('INV9 — flagged rows listed; a tampered coverage_residue manifest is a mismatch finding', () => {
  const tree = new Map([['pkg/a.mjs', 'const a = 1;\n'], ['pkg/b.mjs', 'const b = 2;\n']]);
  const changed = ['pkg/a.mjs', 'pkg/b.mjs'];
  // a reviewless-typed ask: ineffective for every subject, flagged (§A.3 rule 1)
  const ask1 = cmt(1, serializeAsk({ producer: 'executor', type: 'research', subject: ['pkg/a.mjs'] }));
  const asks = parsedAsks(ask1.body, 1);
  const { record } = emitAudit({
    judgment: {
      auditor: 'auditor',
      dispositions: {
        'pkg/a.mjs': { owed: [], why: 'none owed, stated' },
        'pkg/b.mjs': { owed: [], why: 'none owed, stated' },
      },
    },
    diffFiles: changed,
    asks,
    reviewlessTypes: policy.reviewlessTypes,
    tree,
    carrierPaths: policyCarriers(policy),
    protectedTree,
    comments: [ask1],
  });
  // tamper the stamped manifest: the recomputation must report the mismatch
  record.coverage_residue['pkg/a.mjs'] = 'f'.repeat(64);
  const tampered = cmt(2, serializeAudit(record));
  const c = compare({ changed, tree, comments: [ask1, tampered] });

  assert.deepEqual(c.flagged, [{ path: 'pkg/a.mjs', cause: 'reviewless-type', comment: 1 }]);
  const mismatch = c.findings.find((f) => f.kind === 'stamped-field-mismatch' && f.field === 'coverage_residue');
  assert.ok(mismatch, JSON.stringify(c.findings));
  assert.match(mismatch.detail, /pkg\/a\.mjs/);
  const text = renderComparison(c);
  assert.match(text, /flagged rows \(§A\.3\):/);
  assert.match(text, /reviewless-type \| pkg\/a\.mjs \(comment 1\)/);
  assert.match(text, /coverage_residue/);
});

// --- report shape (§D.2, INV16) ---

test('the report renders the five §D.1 metric lines, report-only framed (INV16)', () => {
  const tree = new Map([['pkg/a.mjs', 'const a = 1;\n']]);
  const changed = ['pkg/a.mjs'];
  const audit = auditCmt(1, {
    auditor: 'auditor',
    dispositions: { 'pkg/a.mjs': { owed: [], why: 'none owed, stated' } },
  }, { diffFiles: changed, tree, comments: [] });
  const text = renderComparison(compare({ changed, tree, comments: [audit] }));
  assert.match(text, /grove shadow comparator \(spec-0003 §D\) — report-only, never a verdict/);
  assert.match(text, /1\. table-owed rows the audit omits: /);
  assert.match(text, /2\. audit-owed rows the table missed: /);
  assert.match(text, /3\. no-ask diff files: /);
  assert.match(text, /4\. audit-fresh-at-HEAD: /);
  assert.match(text, /5\. HWM races: /);
  assert.match(text, /=== end grove shadow comparator ===/);
  // empty flagged/findings sections are omitted, not rendered empty
  assert.ok(!/flagged rows/.test(text));
  assert.ok(!/findings/.test(text));
});

// --- the load-bearing byte-identity regression (INV1, S11; adr-0023 AC3) ---

test('S11/INV1 — derivation, view, and structured output byte-identical with and without ask/audit records (adr-0023 AC3)', () => {
  const tree = new Map([
    ['decisions/adr-x.md', adr('adr-x')],
    ['specs/foo.md', spec('spec-foo', 'adr-x')],
    ['pkg/test-deps.md', ledgerBlock(['spec-foo'])],
    ['pkg/code.mjs', 'const x = 1;\n'],
  ]);
  const changed = ['specs/foo.md', 'pkg/code.mjs'];
  const base = [
    rec(tree, { review: 'conformance', verdict: 'PASS', subject: ['specs/foo.md'], basis: ['specs/foo.md', 'decisions/adr-x.md'], id: 1 }),
    rec(tree, { review: 'spec-adversary', verdict: 'APPROVE-READY', subject: ['specs/foo.md'], basis: ['specs/foo.md'], id: 2 }),
    cmt(3, 'prose only — a human aside'),
  ];
  const askC = cmt(4, serializeAsk({ producer: 'executor', type: 'code', subject: ['pkg/code.mjs'] }));
  const auditC = auditCmt(5, { auditor: 'auditor', dispositions: {} }, {
    diffFiles: changed,
    asks: parsedAsks(askC.body, 4),
    tree,
    comments: [...base, askC],
  });
  const withRecords = [...base, askC, auditC];

  const dWithout = runCheck({ changed, tree, comments: base, policy });
  const dWith = runCheck({ changed, tree, comments: withRecords, policy });

  // the verdict object (green flag, rows, rejected, inert) — deep-equal; the
  // exit code is derived from `.green` alone (bin/check.mjs), so this pins it
  assert.deepEqual(dWith, dWithout);
  assert.equal(dWith.green, dWithout.green);

  // the rendered §D status view and the structured output — byte-identical
  const rWithout = render(dWithout);
  const rWith = render(dWith);
  assert.equal(rWith.text, rWithout.text);
  assert.equal(JSON.stringify(rWith.structured), JSON.stringify(rWithout.structured));

  // …and the identity is NOT vacuous: the comparator DOES see the records
  const cWithout = computeComparison({ diffFiles: changed, tree, comments: base, policy, derivation: dWithout, protectedTree });
  const cWith = computeComparison({ diffFiles: changed, tree, comments: withRecords, policy, derivation: dWith, protectedTree });
  assert.equal(cWithout.metrics.noAsk.count, 2);
  assert.equal(cWithout.metrics.freshness.verdict, 'owed-and-absent');
  assert.equal(cWith.metrics.noAsk.count, 1); // pkg/code.mjs ask-covered
  assert.equal(cWith.metrics.freshness.verdict, 'no-audit-owed'); // the ask emptied R_judg
  assert.deepEqual(cWith.audit, { commentId: 5, blockIndex: 0 }); // the surplus audit still selects
});
