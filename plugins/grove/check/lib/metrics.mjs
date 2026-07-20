// Shadow coordination metrics (adr-0023 D5 follow-up; #91 milestone list) —
// ask→review closure + ordering, annotation consumption, window aggregation.
//
// A READ-ONLY consumer of the two record classes (spec-0003 §A asks,
// spec-0002 §A verdicts): it derives no obligations, gates nothing, and
// changes no verdict — the measurement side of the blackboard, computed from
// the records alone (owed-ness lives in the world, so its health metrics do
// too). Callers pass only ADMISSIBLE comments (§A.4 gated upstream, same
// contract as askCoveredFiles).
//
// Closure model: for every effectively-covered (subject, ask-type) the owed
// review set is policy.owed(type) (fail-closed union across effective types,
// spec-0003 §A.3/INV3 — computed here per (subject, review) pair with the
// EARLIEST qualifying ask id). A pair is CLOSED when a verdict record with
// that review covers the subject; ORDERED when the earliest such ask precedes
// the earliest such verdict in comment order (asks-before-reviews — the
// coordination property the ask model exists to enable).

import { parseAskComment, evaluateAskEffectiveness } from './asks.mjs';
import { parseComment } from './records.mjs';

// Pair-key separator: U+0000 as an ESCAPE, never a raw byte (the
// compare.mjs binary-to-git lesson, caught in review yesterday); no
// normalized path or review name can contain it.
const SEP = '\u0000';

function effectiveAsks(comments, ctx) {
  const out = []; // { subject, type, id }
  for (const c of comments) {
    const parsed = parseAskComment(c);
    for (const b of parsed.blocks) {
      if (b.status !== 'record') continue;
      const type = String(b.record.type).trim();
      for (const subject of evaluateAskEffectiveness(b.record, ctx, c.id).covered) {
        out.push({ subject, type, id: c.id });
      }
    }
  }
  return out;
}

function verdictRecords(comments) {
  const out = []; // { review, subjects: Set, findings, id }
  for (const c of comments) {
    const parsed = parseComment(c);
    if (parsed.status === 'none') continue;
    for (const b of parsed.blocks) {
      if (b.status !== 'record') continue;
      out.push({
        review: b.record.review,
        subjects: new Set(b.record.subjectNormalized || []),
        findings: b.record.findings == null ? '' : String(b.record.findings),
        id: c.id,
      });
    }
  }
  return out;
}

// askClosure({ comments, ctx, policy }) ->
//   { pairs, pairsTotal, pairsClosed, closureRate, orderedFraction }
// Rates are vacuously 1 over an empty denominator (never NaN).
export function askClosure({ comments, ctx, policy }) {
  const asks = effectiveAsks(comments, ctx);
  const verdicts = verdictRecords(comments);

  // Earliest qualifying ask id per (subject, review) pair, unioned across
  // every effective ask type on the subject (§A.3 fail-closed union).
  // Keys are for dedup ONLY — subject/review live as map VALUES, never
  // reconstructed by splitting the key back (the conformance NUL-sibling
  // finding: normalizePath admits U+0000, so a split could truncate).
  const askIdByPair = new Map();
  for (const a of asks) {
    for (const review of policy.owed(a.type)) {
      const key = a.subject + SEP + review;
      const prev = askIdByPair.get(key);
      if (prev == null || a.id < prev.askId) askIdByPair.set(key, { subject: a.subject, review, askId: a.id });
    }
  }

  const pairs = [];
  for (const { subject, review, askId } of askIdByPair.values()) {
    let verdictId = null;
    for (const v of verdicts) {
      if (v.review !== review || !v.subjects.has(subject)) continue;
      if (verdictId == null || v.id < verdictId) verdictId = v.id;
    }
    pairs.push({
      subject,
      review,
      askId,
      verdictId,
      closed: verdictId != null,
      ordered: verdictId != null ? askId < verdictId : null,
    });
  }

  const pairsTotal = pairs.length;
  const closed = pairs.filter((p) => p.closed);
  const ordered = closed.filter((p) => p.ordered);
  return {
    pairs,
    pairsTotal,
    pairsClosed: closed.length,
    pairsOrdered: ordered.length, // exact count — the window aggregates this, never a rounded reconstruction
    closureRate: pairsTotal === 0 ? 1 : closed.length / pairsTotal,
    orderedFraction: closed.length === 0 ? 1 : ordered.length / closed.length,
  };
}

// annotationConsumption({ comments }) -> { verdictsTotal, consultingCount }
// Heuristic, stated plainly: a verdict findings body that names the ask
// annotations (or the ask record class) is counted as having consulted them.
// This measures the stated convention (reviewers state their depth basis),
// not reviewer cognition.
const CONSULT_RE = /ask annotation|annotations? consulted|grove-review-ask/i;
export function annotationConsumption({ comments }) {
  const verdicts = verdictRecords(comments);
  return {
    verdictsTotal: verdicts.length,
    consultingCount: verdicts.filter((v) => CONSULT_RE.test(v.findings)).length,
  };
}

// aggregateWindow([{ closure, annotations }]) — ratios of sums (never NaN).
export function aggregateWindow(perPr) {
  let pairsTotal = 0;
  let pairsClosed = 0;
  let orderedClosed = 0;
  let verdictsTotal = 0;
  let consultingCount = 0;
  for (const pr of perPr) {
    pairsTotal += pr.closure.pairsTotal;
    pairsClosed += pr.closure.pairsClosed;
    orderedClosed += pr.closure.pairsOrdered != null ? pr.closure.pairsOrdered : Math.round(pr.closure.orderedFraction * pr.closure.pairsClosed);
    verdictsTotal += pr.annotations.verdictsTotal;
    consultingCount += pr.annotations.consultingCount;
  }
  return {
    prCount: perPr.length,
    pairsTotal,
    pairsClosed,
    closureRate: pairsTotal === 0 ? 1 : pairsClosed / pairsTotal,
    orderedFraction: pairsClosed === 0 ? 1 : orderedClosed / pairsClosed,
    verdictsTotal,
    consultingCount,
    consultingFraction: verdictsTotal === 0 ? 0 : consultingCount / verdictsTotal,
  };
}
