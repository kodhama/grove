// Match-records, freshness, and separation (spec-0002 §C.3, §C.4; INV3, INV5,
// INV6, INV8). Pure over passed-in inputs.
//
// For each owed pair (f, R): from the record stream take the LATEST admissible
// schema-valid record for R whose subject manifest contains f. The pair is
// satisfied iff that record is covering ∧ fresh ∧ passing ∧ separated ∧
// non-vacuous. UPSTREAM-INDICTED is never passing (routes upstream, §D).
//
// This module also owns the canonical §D reason ordering (REASON_ORDER /
// sortReasons), reused by the orchestrator for the gate/graph reasons it folds
// into a pair's row.

import { parseComment, checkAdmissibility } from './records.mjs';
import { groveFp1, pathHashAt } from './fingerprint.mjs';
import { reviewBasis } from './basis.mjs';
import { artifactMeta } from './frontmatter.mjs';

const DECISION_LAYER_TYPES = new Set(['adr', 'decision']);

// §D reason enum order: all applicable reasons are emitted in this order.
export const REASON_ORDER = [
  'never-reviewed',
  'changed-since-review',
  'upstream-changed', // token: upstream-<path>-changed
  'review-failed',
  'upstream-indicted',
  'self-reviewed',
  'vacuous-evidence',
  'awaiting-human-approval',
  'no-reviewable-upstream',
  'unresolvable-reference',
  'record-rejected',
  'carrier-unresolved', // scoped mode only (§C.2 step 0, adr-0013 dec 1/AC4)
];

export function sortReasons(reasons) {
  reasons.sort((a, b) => REASON_ORDER.indexOf(a.code) - REASON_ORDER.indexOf(b.code));
  return reasons;
}

function treeGet(tree, path) {
  if (tree == null) return undefined;
  if (typeof tree.get === 'function') return tree.get(path);
  return tree[path];
}

// Prepare the PR comment stream into ordered admissible records + rejected +
// inert. Ordering is the platform's comment creation order (monotone comment
// id): sort by numeric `id` when every comment carries one, else preserve the
// caller-supplied order (assumed creation order). A comment MAY carry several
// grove-verdict blocks (spec-0002 §A.1 v4 / adr-0019): each well-formed block is
// its own record, ordered comment-id-MAJOR, block-index-MINOR — so the monotone
// `order` counter (incremented per record-block in that sequence) totally and
// deterministically encodes the latest-covering tiebreak (INV9). Admissibility
// (§A.4) is whole-comment: an edited/unauthorized comment rejects ALL its
// records; a malformed block is inert on its own and never inerts a sibling.
export function prepareRecords(comments, posterPolicy = {}) {
  const indexed = comments.map((comment, i) => ({ comment, i }));
  const allHaveId = indexed.every(({ comment }) => comment.id != null);
  if (allHaveId) {
    indexed.sort((a, b) => {
      const d = Number(a.comment.id) - Number(b.comment.id);
      return d !== 0 ? d : a.i - b.i;
    });
  }
  const records = [];
  const rejected = [];
  const inert = [];
  let order = 0;
  for (const { comment } of indexed) {
    const parsed = parseComment(comment);
    if (parsed.status === 'none') continue;
    // Admissibility is per-comment, applied uniformly to every block in it.
    const adm = checkAdmissibility(comment, posterPolicy);
    for (const block of parsed.blocks) {
      if (block.status === 'inert') { inert.push({ comment, cause: block.cause, blockIndex: block.blockIndex }); continue; }
      const entry = { record: block.record, comment, blockIndex: block.blockIndex, order: order++ };
      if (adm.admissible) records.push(entry);
      else rejected.push({ ...entry, cause: adm.cause });
    }
  }
  return { records, rejected, inert };
}

function reason(code, token, payload, routing) {
  return { code, token: token ?? code, payload: payload ?? null, routing: routing ?? null };
}

function upstreamErrorReason(err, review) {
  if (err.kind === 'no-reviewable-upstream') {
    return reason('no-reviewable-upstream', 'no-reviewable-upstream',
      { subject: err.subject, detail: err.detail }, { to: review });
  }
  return reason('unresolvable-reference', 'unresolvable-reference',
    { subject: err.subject, detail: err.detail }, { to: review });
}

function summarize(entry) {
  return {
    verdict: entry.record.verdict,
    reviewer: entry.record.reviewer,
    producer: entry.record.producer,
    order: entry.order,
  };
}

function normalizeHashes(mh) {
  // manifest_hashes keys are recorded paths; compare after the same path
  // normalization the record's subjects went through would be ideal, but the
  // recorded keys are used verbatim for attribution only (never the verdict).
  const map = new Map();
  if (mh && typeof mh === 'object') {
    for (const [k, v] of Object.entries(mh)) map.set(k, String(v));
  }
  return map;
}

// Attribute a stale record to the changed path(s), for §D reason naming only.
function attributeStaleness({ rec, U, isFidelity, tree, review }) {
  const out = [];
  const mh = normalizeHashes(rec.manifest_hashes);
  let attributed = false;

  for (const s of rec.subjectNormalized) {
    if (!mh.has(s)) continue; // absent from manifest_hashes => cannot attribute here
    if (mh.get(s) !== pathHashAt(tree, s)) {
      out.push(reason('changed-since-review', 'changed-since-review', { path: s }, { to: review }));
      attributed = true;
    }
  }

  if (isFidelity) {
    for (const u of U) {
      // a recorded entry that differs, OR a membership change (u not recorded)
      if (!mh.has(u) || mh.get(u) !== pathHashAt(tree, u)) {
        out.push(reason('upstream-changed', `upstream-${u}-changed`, { path: u }, { to: review }));
        attributed = true;
      }
    }
  }

  if (!attributed) {
    // fingerprint differs but nothing could be named => never suppress the reason
    out.push(reason('changed-since-review', 'changed-since-review',
      { unattributed: true, manifest: [...rec.subjectNormalized] }, { to: review }));
  }
  return out;
}

function upstreamIndictedReason({ file, U, tree, review }) {
  // route to the upstream's layer; a decision-layer indictment routes to the
  // human (adr-0012 F3), never the subject's producer.
  const upstreams = [...U];
  const named = upstreams.length ? upstreams[0] : null;
  let target = review; // default: the upstream's fidelity layer
  let layer = null;
  if (named != null) {
    layer = artifactMeta(treeGet(tree, named)).type;
    if (DECISION_LAYER_TYPES.has(layer)) target = 'human';
  }
  return reason('upstream-indicted', 'upstream-indicted',
    { subject: file, upstream: named, upstreams, layer }, { to: target, target, layer, upstream: named });
}

// evaluatePair({ file, review, prepared, tree, index, policy }) -> row
export function evaluatePair({ file, review, prepared, tree, index, policy }) {
  // The review-class basis (subject alone / subject + U) is selected by the
  // SHARED reviewBasis — the same function the emitter stamps with (adr-0015
  // Decision 2), so freshness verify and record stamp agree by construction.
  const { isFidelity, U, errors: upstreamErrors, basis, basisComputable } =
    reviewBasis({ file, review, tree, index });

  const matchesPair = (e) => e.record.review === review && e.record.subjectNormalized.includes(file);
  const covering = prepared.records.filter(matchesPair);
  const coveringRejected = prepared.rejected.filter(matchesPair);
  const latest = covering.length ? covering[covering.length - 1] : null;

  const reasons = [];
  const row = {
    kind: 'pair',
    review,
    subject: file,
    latestVerdict: latest ? latest.record.verdict : null,
    fresh: null,
    covers: !!latest,
    separated: null,
    findings: latest ? latest.record.findings : null,
    recordSequence: covering.map(summarize),
    rejectedCovering: coveringRejected.map((e) => ({ cause: e.cause, verdict: e.record.verdict, order: e.order })),
    reasons,
  };

  if (!latest) {
    if (coveringRejected.length) {
      reasons.push(reason('record-rejected', 'record-rejected',
        coveringRejected.map((e) => ({ cause: e.cause, verdict: e.record.verdict })), { to: review }));
    } else {
      reasons.push(reason('never-reviewed', 'never-reviewed', null, { to: review }));
    }
    for (const err of upstreamErrors) reasons.push(upstreamErrorReason(err, review));
    return finalize(row);
  }

  const r = latest.record;

  // Separation (§C.4) — the record is the single authority, checked regardless
  // of freshness or verdict.
  const separated = r.reviewer !== r.producer;
  row.separated = separated;
  if (!separated) {
    reasons.push(reason('self-reviewed', 'self-reviewed', { agent: r.producer }, { to: review }));
  }

  // Freshness (§A.3): recompute grove-fp-1 over the review-class basis at HEAD.
  let fresh = false;
  if (basisComputable) {
    fresh = groveFp1(basis, tree) === r.fingerprint;
  }
  row.fresh = fresh;

  if (!basisComputable) {
    // the fidelity basis cannot be computed — surface the upstream errors
    for (const err of upstreamErrors) reasons.push(upstreamErrorReason(err, review));
  } else if (!fresh) {
    for (const rr of attributeStaleness({ rec: r, U, isFidelity, tree, review })) reasons.push(rr);
  } else {
    // fresh — evaluate passing + non-vacuous
    const passClass = policy.passClass(review);
    const isIndicted = r.verdict === 'UPSTREAM-INDICTED';
    const isPass = Array.isArray(passClass) && passClass.includes(r.verdict);
    if (isIndicted) {
      reasons.push(upstreamIndictedReason({ file, U, tree, review }));
    } else if (!isPass) {
      reasons.push(reason('review-failed', 'review-failed',
        { verdict: r.verdict, findings: r.findings }, { to: review }));
    }
    if (r.findings.trim() === '') {
      reasons.push(reason('vacuous-evidence', 'vacuous-evidence', null, { to: review }));
    }
  }

  return finalize(row);
}

function finalize(row) {
  sortReasons(row.reasons);
  row.satisfied = row.reasons.length === 0;
  return row;
}
