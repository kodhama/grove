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
 * starts from, `{ sha, patchOf, carried }`, or null: the furthest from which
 * the head is reached, else the furthest; `reasons` lists why records were
 * not credited, each once, in time order; `uncovered` and `lines` are null
 * without a start.
 *
 * Plan: docs/plans/2026-11-13-kod-44-u4b-gaps.md, G7 and G8;
 * docs/plans/2026-11-08-kod-44-merge-gate-plan.md, KTD4 to KTD8 and KTD11;
 * docs/plans/2026-11-19-kod-44-u4b-s4-plan.md, KTD1 (reachability over exact bases)
 * and KTD3 (clean merges by merge-tree).
 */

/** At this many non-test lines since the full review, a full review must come again. */
export const LINE_LIMIT = 150;
const NOT_ON_HISTORY = "not on the head's history";
const SIDE_BRANCH = "only on a merged side branch";
const RECHECK_ONLY = "a re-check, not a full review";
const READS_NOTHING = "reads nothing";
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
  const trees = new Map();
  /** A commit's tree, cached. */
  const treeOf = (sha) => {
    if (!trees.has(sha)) trees.set(sha, sources.treeOf(sha));
    return trees.get(sha);
  };
  const cleans = new Map();
  /**
   * Whether a chain commit is a clean merge from the base branch, which needs
   * no re-check (KTD3), cached: two parents, the second an ancestor of the
   * base, one merge base, and re-merging the parents writes its own tree.
   */
  const clean = ({ sha, parents: [first, second, ...more] }) => {
    if (!cleans.has(sha)) {
      cleans.set(sha, second !== undefined && more.length === 0 && ancestor(second, baseSha)
        && sources.mergeBases(first, second).length === 1 && sources.mergeTree(first, second) === treeOf(sha));
    }
    return cleans.get(sha);
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
  return { chain, ancestor, treeOf, clean, shaAt, placeOf, patchPlace, head, baseSha, merge };
}

/**
 * Where a record sits on the chain and whether it is a full review, or why it
 * cannot sit anywhere (G7). A full review or a re-check sits only at its own
 * head on the chain, or, for a worker's record whose head is only on a merged
 * side branch, at the chain commit with the same cumulative patch-id (D6). A
 * worker's full review off the head's history sits where its patch-id
 * matches (KTD7); a re-check there sits nowhere. A lead's record never gets
 * patch-id credit.
 */
function placed(record, reader, sources) {
  for (const sha of [record.head, record.base]) {
    if (!sources.hasCommit(sha)) return { reason: `reviewed commit ${sha} is not in the clone` };
  }
  const own = sources.mergeBase(record.head, reader.baseSha);
  const full = own !== null && record.base === own && !record.rollout;
  if (reader.ancestor(record.head, reader.head)) {
    const place = reader.placeOf(record.head);
    // A full review at the merge-base read the empty range M..M (lead ruling 1).
    if (place < 0) return full ? { reason: READS_NOTHING } : { full, place };
    if (reader.shaAt(place) === record.head) return { full, place };
    if (record.role === "lead") return { reason: SIDE_BRANCH };
    const patchId = sources.patchId(reader.merge, record.head);
    const equal = patchId === null ? null : reader.patchPlace(patchId);
    return equal === null ? { reason: SIDE_BRANCH } : { full, place: equal, patchOf: record.head };
  }
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

/** The full reviews on the chain, furthest first, ties going to the later call. */
function startsOf(usable) {
  return usable.map((judged, index) => ({ judged, index })).filter(({ judged }) => judged.full)
    .sort((a, b) => b.judged.place - a.judged.place || b.index - a.index)
    .map(({ judged }) => judged);
}

/**
 * The places reached from one full review (KTD1): its own place; a clean base
 * merge right after a reached place; and a re-check's place when some reached
 * place before it has the same tree as the re-check's base, since a diff
 * depends only on its two trees. Each reached place keeps its best path:
 * fewest carried links, then fewest re-checks.
 */
function reachFrom(start, rechecks, reader) {
  const { chain } = reader;
  const best = new Map([[start.place, { carried: 0, links: 0 }]]);
  const offer = (place, path) => {
    const held = best.get(place);
    if (!held || path.carried < held.carried || (path.carried === held.carried && path.links < held.links)) best.set(place, path);
  };
  for (let place = start.place; place < chain.length; place += 1) {
    const path = best.get(place);
    if (!path) continue;
    if (place + 1 < chain.length && reader.clean(chain[place + 1])) offer(place + 1, path);
    for (const judged of rechecks) {
      if (judged.place <= place || reader.treeOf(judged.record.base) !== reader.treeOf(reader.shaAt(place))) continue;
      offer(judged.place, { carried: path.carried + (judged.record.carried ? 1 : 0), links: path.links + 1 });
    }
  }
  const furthest = Math.max(...best.keys());
  const uncovered = chain.slice(furthest + 1).filter((commit) => !reader.clean(commit)).map((commit) => commit.sha);
  return { start, path: best.get(furthest), uncovered };
}

/**
 * The furthest full review from which the head is reached, with its best
 * path; with none, the furthest full review and its uncovered tail.
 */
function cover(starts, rechecks, reader) {
  let first = null;
  for (const start of starts) {
    const reach = reachFrom(start, rechecks, reader);
    if (reach.uncovered.length === 0) return reach;
    first ??= reach;
  }
  return first;
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
  // The lead's own record must have read a non-empty range at the head (lead ruling 2).
  const leadReviewed = credited.some((entry) => entry.record.role === "lead" && !entry.record.carried
    && !entry.record.rollout && entry.record.head === head && entry.record.base !== head);
  const usable = credited.filter((entry) => !entry.record.carried || leadReviewed);
  const starts = startsOf(usable);
  const decision = {
    calls: records.length,
    reasons: reasonsOf(judged, leadReviewed),
    start: null,
    links: 0,
    carriedNeedsLead: starts.length === 0 && !leadReviewed && credited.some((entry) => entry.record.carried && entry.full),
    carriedUsed: false,
    leadReviewed,
    uncovered: null,
    lines: null,
  };
  if (starts.length === 0) return decision;
  const count = sources.nonTestLines(merge, head, baseSha);
  const { start, path, uncovered } = cover(starts, usable.filter((entry) => !entry.full), reader);
  const carried = start.record.carried === true;
  // The line count runs from the printed start; `count.commits` holds the chain's commits, in order.
  return {
    ...decision,
    start: { sha: reader.shaAt(start.place), patchOf: start.patchOf ?? null, carried },
    links: path.links,
    carriedUsed: carried || path.carried > 0,
    uncovered,
    lines: count.commits.slice(start.place + 1).reduce((sum, commit) => sum + commit.lines, 0),
  };
}
