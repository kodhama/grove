// The record-emitter (adr-0015 Decision 2 + Consequence 2). The machine half of
// the reviewer/machine boundary: it takes a reviewer's CI-agnostic judgment,
// reads HEAD, and STAMPS the conformant §A.2 verdict record with a
// machine-computed grove-fp-1 — the value the check will later verify.
//
// It IMPORTS the check's own code (grove-fp-1 via fingerprint.mjs, the review-
// class basis via the SHARED basis.mjs — which resolves the fidelity upstream U
// through upstream.mjs), so the stamp and the freshness check agree BY
// CONSTRUCTION. A reimplementation would drift and mint permanently-stale
// records (adr-0015's load-bearing constraint).
//
// Basis granularity (adr-0015 Consequence 2 / adversary N3): the check
// recomputes freshness PER owed-pair file (match.mjs: basis = [file] or
// [file, ...U]). So the emitter fans a multi-file subject out to ONE record per
// reviewed file — each single-subject, its own basis + fingerprint — which is
// exactly what the per-file check verifies. (See the report: §A.3's whole-`S`
// basis prose and match.mjs's per-file basis are a pre-existing discrepancy;
// this build follows match.mjs — the referent the check actually enforces — and
// flags §A.3 for a follow-up reconciliation wave, editing no spec text here.)

import { groveFp1, pathHashAt } from './fingerprint.mjs';
import { reviewBasis } from './basis.mjs';
import { normalizePath } from './normalize.mjs';
import { artifactMeta } from './frontmatter.mjs';

// Serialize a built record object into a fenced `grove-verdict` block (§A.2).
// The output is exactly what lib/records.mjs parseRecord accepts.
export function serializeRecord(record) {
  const lines = ['```grove-verdict', 'schema: 1', `review: ${record.review}`, `verdict: ${record.verdict}`];
  lines.push('subject:');
  for (const s of record.subject) lines.push(`  - ${s}`);
  if (record.subject_id != null) lines.push(`subject_id: ${record.subject_id}`);
  lines.push('manifest_hashes:');
  for (const [p, h] of Object.entries(record.manifest_hashes)) lines.push(`  ${p}: ${h}`);
  lines.push(`fingerprint: ${record.fingerprint}`);
  lines.push(`producer: ${record.producer}`);
  lines.push(`reviewer: ${record.reviewer}`);
  // findings: a block scalar (`|`) preserves multiline prose verbatim — a `#` or
  // `:` inside is literal text, not a comment/key (yaml.mjs parseBlockScalar).
  // An empty findings is emitted as a bare key (parses to '' => vacuous): the
  // emitter TRANSCRIBES the reviewer's findings, it never invents evidence.
  if (record.findings === '') {
    lines.push('findings:');
  } else {
    lines.push('findings: |');
    for (const l of record.findings.split('\n')) lines.push(`  ${l}`);
  }
  lines.push('```');
  return lines.join('\n');
}

// Build the §A.2 record object for a SINGLE reviewed file over its review-class
// basis at HEAD. Returns { ok:true, record } or { ok:false, error } when the
// fidelity basis is non-computable (no reviewable upstream) — surfaced, never
// papered over with a stale/garbage fingerprint.
function stampOne({ file, judgment, tree, index }) {
  const { basis, basisComputable, errors } = reviewBasis({ file, review: judgment.review, tree, index });
  if (!basisComputable) {
    const e = errors[0] || { subject: file, kind: 'no-reviewable-upstream', detail: 'basis not computable' };
    return { ok: false, error: { subject: file, kind: e.kind, detail: e.detail } };
  }
  const fingerprint = groveFp1(basis, tree);
  const manifest_hashes = {};
  for (const p of basis) manifest_hashes[p] = pathHashAt(tree, p);
  const meta = artifactMeta(treeGet(tree, file));
  const record = {
    schema: 1,
    review: judgment.review,
    verdict: judgment.verdict,
    subject: [file],
    ...(meta.id != null ? { subject_id: meta.id } : {}),
    manifest_hashes,
    fingerprint,
    producer: judgment.producer,
    reviewer: judgment.reviewer,
    findings: judgment.findings,
  };
  return { ok: true, record, basis };
}

function treeGet(tree, path) {
  if (tree == null) return undefined;
  if (typeof tree.get === 'function') return tree.get(path);
  return tree[path];
}

// emitRecords({ judgment, tree, index }) ->
//   { records: [{ subject, review, fingerprint, record, block }], errors: [...] }
// Fans the judgment's subject list out to one record per reviewed file (the N3
// per-file basis pin). Each `block` is a self-contained fenced grove-verdict
// record — a comment may carry several (§A.1 v4 / adr-0019). A subject whose
// fidelity basis is non-computable yields an error entry and NO record.
export function emitRecords({ judgment, tree, index }) {
  const records = [];
  const errors = [];
  for (const raw of judgment.subject) {
    const file = normalizePath(raw);
    if (file == null) {
      errors.push({ subject: raw, kind: 'unnormalizable-subject', detail: `subject path does not normalize: ${raw}` });
      continue;
    }
    const stamped = stampOne({ file, judgment, tree, index });
    if (!stamped.ok) {
      errors.push(stamped.error);
      continue;
    }
    records.push({
      subject: file,
      review: stamped.record.review,
      fingerprint: stamped.record.fingerprint,
      record: stamped.record,
      block: serializeRecord(stamped.record),
    });
  }
  return { records, errors };
}
