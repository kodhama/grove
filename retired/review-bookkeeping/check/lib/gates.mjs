// The two human/approval gates (spec-0002 §C.5, §C.6; INV10, INV17; S9, S16).
//
// §C.5 decision-layer human gate: a changed file owing decision-adversary
// requires its `status` at HEAD to be exactly `approved` (the recorded human
// intent act, lifecycle.md), else awaiting-human-approval.
//
// §C.6 approved-upstream gate: for every owed fidelity pair (f, conformance),
// f's implements upstream (every ledger-named spec for code) must be exactly
// `approved` at HEAD — WHETHER OR NOT it changed in the PR. draft/gated/
// superseded all fail; `superseded` is terminal (re-target the successor).

import { artifactMeta } from './frontmatter.mjs';
import { resolveUpstream } from './upstream.mjs';

function treeGet(tree, path) {
  if (tree == null) return undefined;
  if (typeof tree.get === 'function') return tree.get(path);
  return tree[path];
}

function reason(payload) {
  return {
    code: 'awaiting-human-approval',
    token: 'awaiting-human-approval',
    payload,
    routing: { to: 'human' },
  };
}

// decisionGate({ file, meta }) -> { ok, reason? }
//   meta: artifactMeta of the changed file's HEAD content.
export function decisionGate({ file, meta }) {
  const status = meta.status ?? null;
  if (status === 'approved') return { ok: true };
  return { ok: false, reason: reason({ artifact: file, status, gate: 'decision' }) };
}

// approvedUpstreamGate({ file, tree, index }) ->
//   { ok, violations: [{ upstream, status, terminal }], reasons, upstreamErrors }
export function approvedUpstreamGate({ file, tree, index }) {
  const ru = resolveUpstream([file], tree, index);
  const violations = [];
  for (const upstream of ru.U) {
    const status = artifactMeta(treeGet(tree, upstream)).status ?? null;
    if (status !== 'approved') {
      violations.push({ upstream, status, terminal: status === 'superseded' });
    }
  }
  const reasons = violations.map((v) =>
    reason({ artifact: v.upstream, status: v.status, terminal: v.terminal, gate: 'upstream' }));
  return { ok: violations.length === 0, violations, reasons, upstreamErrors: ru.errors };
}
