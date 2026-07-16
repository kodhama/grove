// The check orchestrator (spec-0002 §C.8). Produces ONE derivation — the
// single machine-readable structure §D's four consumers share (check red/green,
// human view, dispatch routing, the reviewer's scoped work order). Pure over
// passed-in inputs; no network, no git, no platform (wave 2b wires the shell).
//
// Green iff every owed pair is satisfied (C.3) ∧ every separation check holds
// (C.4) ∧ the decision-layer human gate (C.5) ∧ the approved-upstream gate
// (C.6) ∧ graph resolution (C.7) hold for every changed artifact. A rejected
// record never blocks an otherwise-satisfied pair, but every rejection is
// surfaced. Green is NON-AUTHORIZING (§D).

import { buildArtifactIndex } from './artifact-index.mjs';
import { artifactMeta } from './frontmatter.mjs';
import { allowlistExempts } from './policy.mjs';
import { prepareRecords, evaluatePair, sortReasons } from './match.mjs';
import { resolveGraph } from './graph.mjs';
import { decisionGate, approvedUpstreamGate } from './gates.mjs';

function treeGet(tree, path) {
  if (tree == null) return undefined;
  if (typeof tree.get === 'function') return tree.get(path);
  return tree[path];
}

function fileRow(subject, reasons) {
  return {
    kind: 'file',
    review: null,
    subject,
    latestVerdict: null,
    fresh: null,
    covers: null,
    separated: null,
    findings: null,
    recordSequence: [],
    rejectedCovering: [],
    reasons: sortReasons(reasons),
    satisfied: reasons.length === 0,
  };
}

// runCheck({ changed, tree, comments, policy }) -> the derivation.
//   changed  — added/modified paths present at HEAD that owe review.
//   tree     — Map<path, content> (or object) at HEAD.
//   comments — the PR record stream (platform comment objects).
//   policy   — an assemblePolicy() result (from the PROTECTED branch).
export function runCheck({ changed = [], tree, comments = [], policy }) {
  const index = buildArtifactIndex(tree, policy.artifactDirs);
  const prepared = prepareRecords(comments, { record_poster_allowlist: policy.recordPosterAllowlist });
  const rows = [];

  for (const f of changed) {
    const content = treeGet(tree, f);
    const meta = artifactMeta(content);
    const type = meta.hasFrontmatter ? (meta.type != null ? meta.type : '__untyped__') : 'code';

    // §C.7 graph resolution — every changed artifact of any type. Code carries
    // no ids; only frontmatter-bearing artifacts have depends_on/implements.
    if (meta.hasFrontmatter) {
      const g = resolveGraph(meta, index);
      if (!g.ok) {
        const reasons = g.violations.map((v) => ({
          code: 'unresolvable-reference',
          token: 'unresolvable-reference',
          payload: { id: v.id, kind: v.kind, paths: v.paths },
          routing: { to: 'human' },
        }));
        rows.push(fileRow(f, reasons));
      }
    }

    // §C.2 allowlist: an explicit prose path passing the predicate owes nothing.
    if (allowlistExempts(policy, f, content)) continue;

    const owed = policy.owed(type);

    const pairRowsForFile = [];
    for (const R of owed) {
      const row = evaluatePair({ file: f, review: R, prepared, tree, index, policy });
      // §C.6 approved-upstream gate binds every owed fidelity pair.
      if (R === 'conformance') {
        const gate = approvedUpstreamGate({ file: f, tree, index });
        for (const rr of gate.reasons) row.reasons.push(rr);
        sortReasons(row.reasons);
        row.satisfied = row.reasons.length === 0;
      }
      pairRowsForFile.push(row);
      rows.push(row);
    }

    // §C.5 decision-layer human gate — attach to the decision-adversary pair
    // row if present, else a file-level row.
    if (owed.includes('decision-adversary')) {
      const dg = decisionGate({ file: f, meta });
      if (!dg.ok) {
        const daRow = pairRowsForFile.find((r) => r.review === 'decision-adversary');
        if (daRow) {
          daRow.reasons.push(dg.reason);
          sortReasons(daRow.reasons);
          daRow.satisfied = daRow.reasons.length === 0;
        } else {
          rows.push(fileRow(f, [dg.reason]));
        }
      }
    }
  }

  const green = rows.every((r) => r.reasons.length === 0);

  return {
    green,
    rows,
    rejectedRecords: prepared.rejected.map((e) => ({
      cause: e.cause,
      review: e.record.review,
      verdict: e.record.verdict,
      subject: e.record.subjectNormalized,
      author: e.comment.author,
      id: e.comment.id,
    })),
    inertComments: prepared.inert.map((e) => ({ cause: e.cause, id: e.comment.id })),
  };
}
