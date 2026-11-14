/**
 * KOD-44 — decide whether a full review read the pull request (R3) and
 * whether re-checks cover every commit since it (R4), from read records.
 *
 *   reviewCoverage(records, sources, { head, baseSha, merge })
 *
 * In plain words: each record is one review call with what its reviewer read
 * (`review-reads.mjs`), tagged by the gate with where it came from. This file
 * decides which records count and how far they reach along the head's
 * first-parent chain. It reads git only through `sources` (`gate-sources.mjs`)
 * and prints nothing; the gate formats the lines.
 *
 * A record's tags, beside review-reads' fields: `role` (`worker` or `lead`),
 * `op` (the operation its performer is bound to), `binding` (`bound`, or
 * `fallback` when it matched only a by-fallback operation's suggested name),
 * `trusted` (its read script is a trusted copy), `rollout` (it came from a
 * `--codex-rollout` path) and `carried` (it came from a handoff, so it has no
 * time, freshness or read script to judge, and counts only beside the lead's
 * own review of the head).
 *
 * Returns `{ calls, reasons, start, links, carriedNeedsLead, carriedUsed,
 * leadReviewed, uncovered, lines }`: `start` is the full review the chain
 * starts from, `{ sha, patchOf, carried }`, or null; `reasons` lists why
 * records were not credited, each once, in time order; `uncovered` and
 * `lines` are null without a start.
 *
 * Plan: docs/plans/2026-11-13-kod-44-u4b-gaps.md, G7 and G8;
 * docs/plans/2026-11-08-kod-44-merge-gate-plan.md, KTD4 to KTD8 and KTD11.
 */

/** At this many non-test lines since the full review, a full review must come again. */
export const LINE_LIMIT = 150;
const NOT_ON_HISTORY = "not on the head's history";
const RECHECK_ONLY = "a re-check, not a full review";
const CARRIED_ALONE = "carried without the lead's own review";

/** Why a record cannot be credited, judged without git; null when nothing stops it. */
function recordFailure(record) {
  if (!record.carried && record.fresh !== true) return "not fresh";
  if (!record.carried && record.outcome !== "ran") return "did not run";
  if (!record.head || !record.base) return "no read recorded";
  if (record.clean !== true) return "dirty tree";
  if (record.baseNamed !== true) return "base not named";
  if (!record.carried && !Number.isFinite(Date.parse(record.at))) return "no time recorded";
  if (record.binding !== "bound") return "bound by fallback";
  if (!record.carried && record.trusted !== true) return "read by another script";
  if (record.op === "doc-review") return "doc review not judged yet";
  return null;
}

/** Records in time order, carried ones first since they carry no time; ties keep their order. */
function byTime(records) {
  const time = (record) => record.carried ? -Infinity : (Number.isFinite(Date.parse(record.at)) ? Date.parse(record.at) : Infinity);
  return records.map((record, index) => ({ record, index }))
    .sort((a, b) => time(a.record) - time(b.record) || a.index - b.index)
    .map(({ record }) => record);
}

/** Git questions over the pull request's first-parent chain, each answered once. */
function chainReader(sources, { head, baseSha, merge }) {
  const chain = sources.firstParentChain(merge, head);
  const patchIds = new Map();
  const ancestry = new Map();
  /** Whether `a` is an ancestor of `b`, cached. */
  const ancestor = (a, b) => {
    const key = `${a} ${b}`;
    if (!ancestry.has(key)) ancestry.set(key, sources.isAncestor(a, b));
    return ancestry.get(key);
  };
  /** The commit at a chain place; -1 is the merge-base itself. */
  const shaAt = (place) => place < 0 ? merge : chain[place].sha;
  /** The first chain place whose commit contains `sha`, which must be an ancestor of the head. */
  const placeOf = (sha) => {
    if (ancestor(sha, merge)) return -1;
    let low = 0;
    let high = chain.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (ancestor(sha, chain[middle].sha)) high = middle;
      else low = middle + 1;
    }
    return low;
  };
  /** The first chain place whose cumulative diff from the merge-base has this patch-id, or null. */
  const patchPlace = (patchId) => {
    for (let place = 0; place < chain.length; place += 1) {
      if (!patchIds.has(place)) patchIds.set(place, sources.patchId(merge, chain[place].sha));
      if (patchIds.get(place) === patchId) return place;
    }
    return null;
  };
  return { chain, ancestor, shaAt, placeOf, patchPlace, head, baseSha };
}

/**
 * Where a record sits on the chain and whether it is a full review, or why it
 * cannot sit anywhere. A full review off the head's history sits where its
 * patch-id matches; a re-check, or any record of the lead's, never does.
 */
function placed(record, reader, sources) {
  for (const sha of [record.head, record.base]) {
    if (!sources.hasCommit(sha)) return { reason: `reviewed commit ${sha} is not in the clone` };
  }
  const own = sources.mergeBase(record.head, reader.baseSha);
  const full = own !== null && record.base === own && !record.rollout;
  if (reader.ancestor(record.head, reader.head)) return { full, place: reader.placeOf(record.head) };
  if (!full || record.role === "lead") return { reason: NOT_ON_HISTORY };
  const patchId = sources.patchId(own, record.head);
  const place = patchId === null ? null : reader.patchPlace(patchId);
  return place === null ? { reason: NOT_ON_HISTORY } : { full, place, patchOf: record.head };
}

/** Each record with its place on the chain, or the reason it has none. */
function judgeRecords(records, reader, sources) {
  return byTime(records).map((record) => {
    const reason = recordFailure(record);
    return reason ? { record, reason } : { record, ...placed(record, reader, sources) };
  });
}

/** The latest full review on the chain, ties going to the later call. */
function startOf(usable) {
  let start = null;
  for (const judged of usable) if (judged.full && (start === null || judged.place >= start.place)) start = judged;
  return start;
}

/** Whether a chain commit is a clean merge from the base branch, which needs no re-check. */
function cleanMerge(commit, reader, listed) {
  return commit.parents.length === 2 && !listed.has(commit.sha) && reader.ancestor(commit.parents[1], reader.baseSha);
}

/**
 * Move the covered frontier from the start: past clean base merges, and to a
 * re-check's place when its base is the frontier or an ancestor of it, taking
 * the furthest such re-check each time until none moves it.
 */
function coverFrom(start, rechecks, reader, listed) {
  const { chain } = reader;
  let frontier = start.place;
  const links = [];
  const skipMerges = () => {
    while (frontier + 1 < chain.length && cleanMerge(chain[frontier + 1], reader, listed)) frontier += 1;
  };
  skipMerges();
  for (;;) {
    const at = reader.shaAt(frontier);
    const next = startOf(rechecks.filter((judged) => judged.place > frontier && reader.ancestor(judged.record.base, at))
      .map((judged) => ({ ...judged, full: true })));
    if (next === null) break;
    frontier = next.place;
    links.push(next);
    skipMerges();
  }
  const uncovered = chain.slice(frontier + 1).filter((commit) => !cleanMerge(commit, reader, listed)).map((commit) => commit.sha);
  return { links, uncovered };
}

/** The distinct reasons records were not credited, in time order. */
function reasonsOf(judged, leadReviewed) {
  const reasons = judged.map((entry) => {
    if (entry.reason) return entry.reason;
    if (entry.record.carried && !leadReviewed) return CARRIED_ALONE;
    return entry.full ? null : RECHECK_ONLY;
  }).filter(Boolean);
  return [...new Set(reasons)];
}

/** Judge R3 and R4 for one pinned head over its pull request's records. */
export function reviewCoverage(records, sources, { head, baseSha, merge }) {
  const reader = chainReader(sources, { head, baseSha, merge });
  const judged = judgeRecords(records, reader, sources);
  const credited = judged.filter((entry) => entry.place !== undefined);
  const leadReviewed = credited.some((entry) => entry.record.role === "lead" && !entry.record.carried
    && !entry.record.rollout && entry.record.head === head);
  const usable = credited.filter((entry) => !entry.record.carried || leadReviewed);
  const start = startOf(usable);
  const decision = {
    calls: records.length,
    reasons: reasonsOf(judged, leadReviewed),
    start: start && { sha: reader.shaAt(start.place), patchOf: start.patchOf ?? null, carried: start.record.carried === true },
    links: 0,
    carriedNeedsLead: start === null && !leadReviewed && credited.some((entry) => entry.record.carried && entry.full),
    carriedUsed: false,
    leadReviewed,
    uncovered: null,
    lines: null,
  };
  if (start === null) return decision;
  const count = sources.nonTestLines(decision.start.sha, head, baseSha);
  const listed = new Set(count.merges.map((row) => row.sha));
  const { links, uncovered } = coverFrom(start, usable.filter((entry) => !entry.full), reader, listed);
  return {
    ...decision,
    links: links.length,
    carriedUsed: decision.start.carried || links.some((entry) => entry.record.carried),
    uncovered,
    lines: count.total,
  };
}
