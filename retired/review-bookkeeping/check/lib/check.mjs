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
import { allowlistExempts, allowlistEligible } from './policy.mjs';
import { prepareRecords, evaluatePair, sortReasons } from './match.mjs';
import { resolveGraph } from './graph.mjs';
import { decisionGate, approvedUpstreamGate } from './gates.mjs';
import { inJurisdiction, resolveCarriers } from './scope.mjs';

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

// runCheck({ changed, tree, comments, policy, protectedPaths }) -> the derivation.
//   changed        — added/modified paths present at HEAD that owe review
//                    (the §C.2 step-0 iteration set: HEAD-present entries after
//                    rename expansion; deletions contribute none).
//   tree           — Map<path, content> (or object) at HEAD.
//   comments       — the PR record stream (platform comment objects).
//   policy         — an assemblePolicy() result (from the PROTECTED branch).
//   protectedPaths — protected-branch blob listing covering the two machinery
//                    carrier paths (§C.2 carrier fail-close; `scoped` only —
//                    absent in scoped mode fail-closes to carrier-unresolved).
export function runCheck({ changed = [], tree, comments = [], policy, protectedPaths }) {
  const index = buildArtifactIndex(tree, policy.artifactDirs);
  const prepared = prepareRecords(comments, { record_poster_allowlist: policy.recordPosterAllowlist });
  const rows = [];

  // §C.2 step 0 — jurisdiction filter (`scoped` mode only; adr-0013 dec 1).
  // strict/absent: no filter exists, this is a no-op and behavior is
  // byte-identical to pre-amendment (INV19). An out-of-scope file generates
  // zero owed pairs and zero reasons; its only trace is the §D header's
  // aggregate jurisdiction count (INV20, S21).
  const scoped = policy.scope === 'scoped';
  let files = changed;
  let scopeInfo = null;
  if (scoped) {
    files = changed.filter((f) => inJurisdiction(f, tree, policy));
    scopeInfo = {
      mode: 'scoped',
      jurisdiction: { inScope: files.length, total: changed.length },
    };

    // §C.2 carrier fail-close (INV21, S23; §C.8): both machinery carriers must
    // EXIST at the protected-branch commit — a runtime dir with ≥1 blob under
    // its prefix, the workflow file's blob present. `protectedPaths` is that
    // protected-branch blob listing (absent/empty fail-closes to unresolved,
    // never silent exclusion). Each unresolved carrier is a file-level red.
    for (const c of resolveCarriers(policy, protectedPaths)) {
      rows.push(fileRow(c.path, [{
        code: 'carrier-unresolved',
        token: 'carrier-unresolved',
        payload: { key: c.key, path: c.path, provenance: c.provenance },
        routing: { to: 'human' },
      }]));
    }
  } else if (policy.scopeUnrecognized) {
    // an unrecognized value resolved to strict — named on every run (INV22, W2)
    scopeInfo = { mode: 'strict', rawValue: policy.scopeRaw, unrecognized: true };
  }

  for (const f of files) {
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

    // §D remedy hint (presentation-only, round 3): a frontmatter-typed file
    // whose type owes the full set via INV7's fail-closed override carries a
    // marker keyed off this §C.2 step-1 classification. The view names the two
    // cures; no verdict or reason token changes. Restricted to a real
    // frontmatter `type:` so `code`/untyped classifications never draw a
    // "declare it in reviewless_types" hint that does not fit them.
    const remedy =
      meta.hasFrontmatter && meta.type != null && policy.unclaimedType(type)
        ? { type }
        : null;

    const pairRowsForFile = [];
    for (const R of owed) {
      const row = evaluatePair({ file: f, review: R, prepared, tree, index, policy });
      if (remedy) row.remedy = remedy;
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

    // §D allowlist remedy hint (presentation-only, adr-0022 D1): a
    // no-frontmatter, allowlist-eligible orientation-prose file whose fidelity
    // pair reds `no-reviewable-upstream` names the explicit
    // `non_behavioral_allowlist` cure. Gated on the actual reason so a prose
    // file WITH a ledger (satisfiable by a record) is never told to allowlist
    // itself, and on `!hasFrontmatter` so a typed artifact missing an
    // `implements:` edge (a different cure) never draws it. No verdict or
    // reason token changes; INV14 is upheld (the cure is a human-owned per-file
    // add, not an automatic exemption).
    if (
      !meta.hasFrontmatter &&
      allowlistEligible(policy, f, content) &&
      pairRowsForFile.some((r) => r.reasons.some((x) => x.token === 'no-reviewable-upstream'))
    ) {
      for (const r of pairRowsForFile) r.allowlistRemedy = { path: f };
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
    // The scope descriptor is present ONLY when it carries information beyond
    // plain strict (scoped mode, or an unrecognized value resolved to strict)
    // so absent/`strict` output stays byte-identical to pre-amendment (INV19).
    ...(scopeInfo ? { scope: scopeInfo } : {}),
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
