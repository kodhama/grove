/**
 * KOD-44 — the merge gate's live sources, behind one injected process runner.
 * These readers return evidence as it stands; the gate decides what passes.
 * A failed process or malformed response throws TransportFailure, never a
 * value that could be mistaken for evidence (KTD9).
 *
 * createGateSources({ checkout, owner, repo, number, run? }) supplies the gh
 * and git readers. run(cmd, args, { cwd, input, env }) has spawnSync's result
 * shape. The default runner bounds each argv-only call to 30 seconds and
 * 64 MiB. Git uses -C and clears environment variables that redirect it.
 *
 * Plan: docs/plans/2026-11-08-kod-44-merge-gate-plan.md, U3;
 * KTD1 (one runner), KTD5 (line counts), KTD7 (verbatim patch IDs),
 * KTD8 (check-suite time), KTD9 (transport failures).
 */
import { spawnSync } from "node:child_process";

export class TransportFailure extends Error {
  constructor(call, reason) {
    const line = String(reason).trim().split(/\r?\n/)[0] || "unknown transport failure";
    super(`${call}: ${line}`);
    this.name = "TransportFailure";
    this.call = call;
    this.reason = line;
  }
}

export function defaultRunner(cmd, args, options) {
  return spawnSync(cmd, args, { ...options, encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024 * 1024 });
}

const PAGE_CAP = 50;
const GIT_FLOOR = "git 2.39 or newer is required (patch-id --verbatim, git RelNotes 2.39.0)";
const SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;

// Copied from Compound Engineering 3.27.0,
// skills/ce-code-review/scripts/review-scope.py: TEST_PATTERN.
// Its (?-i:...) class-file alternative needs a separate, case-sensitive JS regex.
const TEST_PATTERN = /(^|\/)(tests?|spec|__tests__)\/|(^|\/)[^/]+[._-](test|spec)\.[^/]+$|(^|\/)(test_[^/]+|conftest)\.[^/]+$/i;
const TEST_CLASS_PATTERN = /(^|\/)[^/]+(Test|Tests|Spec)\.(java|kt|scala|swift|cs)$/;

function fail(call, reason) { throw new TransportFailure(call, reason); }
function object(value, call, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(call, `missing or invalid ${field}`);
  return value;
}
function field(value, key, type, call) {
  object(value, call, key);
  if (typeof value[key] !== type) fail(call, `missing or invalid ${key}`);
  return value[key];
}
function array(value, call, name) {
  if (!Array.isArray(value)) fail(call, `missing or invalid ${name}`);
  return value;
}
function nullableString(value, call, name) {
  if (value !== null && typeof value !== "string") fail(call, `missing or invalid ${name}`);
  return value;
}
function account(row, call) {
  const user = object(row?.user, call, "user");
  return { login: field(user, "login", "string", call), type: field(user, "type", "string", call) };
}
function gitEnv() {
  const env = { ...process.env };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[key];
  return env;
}

// Git quotes unusual names with C escapes, including octal UTF-8 bytes.
function unquotePath(path, call) {
  if (!path.startsWith('"')) return path;
  if (!path.endsWith('"')) fail(call, "invalid quoted numstat path");
  const parts = [];
  const escapes = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, "\\": 92 };
  const inner = path.slice(1, -1);
  const pattern = /\\([0-7]{3}|[abtnvfr"\\])|([^\\]+)|(\\)/g;
  for (const match of inner.matchAll(pattern)) {
    if (match[3]) fail(call, "invalid escape in numstat path");
    if (match[2]) parts.push(Buffer.from(match[2]));
    else parts.push(Buffer.from([match[1].length === 3 ? parseInt(match[1], 8) : escapes[match[1]]]));
  }
  return Buffer.concat(parts).toString("utf8");
}
function destination(path) {
  // Match review-scope.py's numstat_path: renamed paths use their new name.
  if (path.includes(" => ")) {
    if (path.includes("{") && path.includes("}")) return path.replace(/\{[^{}]* => ([^{}]*)\}/, "$1");
    return path.slice(path.lastIndexOf(" => ") + 4);
  }
  return path;
}
function statRow(line, call) {
  const match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
  if (!match || (match[1] === "-") !== (match[2] === "-")) fail(call, "invalid numstat row");
  // With unusual names git may quote the two sides of a rename separately.
  const quotedRename = /^("(?:[^"\\]|\\.)*"|[^"]*) => ("(?:[^"\\]|\\.)*"|[^"]*)$/.exec(match[3]);
  const path = quotedRename && (quotedRename[1].startsWith('"') || quotedRename[2].startsWith('"'))
    ? unquotePath(quotedRename[2], call) : destination(unquotePath(match[3], call));
  const added = match[1] === "-" ? null : Number(match[1]);
  const deleted = match[2] === "-" ? null : Number(match[2]);
  if ((added !== null && !Number.isSafeInteger(added)) || (deleted !== null && !Number.isSafeInteger(deleted))) fail(call, "invalid numstat count");
  return { path, added, deleted };
}
function lines(files) {
  return files.reduce((sum, row) => sum + (row.added === null || row.deleted === null || TEST_PATTERN.test(row.path) || TEST_CLASS_PATTERN.test(row.path) ? 0 : row.added + row.deleted), 0);
}

const THREAD_QUERY = `query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        nodes { id isResolved isOutdated path comments(first: 1) { nodes { author { login } } } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

/**
 * All readers use the same runner. gh answers are camel-cased records and
 * include human accounts too: deciding which accounts matter belongs to U4.
 */
export function createGateSources({ checkout, owner, repo, number, run = defaultRunner }) {
  const root = `repos/${owner}/${repo}`;
  function execute(call, cmd, args, input, allowed = []) {
    let result;
    try { result = run(cmd, args, { cwd: checkout, input, env: cmd === "git" ? gitEnv() : { ...process.env } }); }
    catch (error) { fail(call, error.message); }
    if (!result || typeof result !== "object") fail(call, "runner returned no result");
    if (result.error) fail(call, result.error.message || result.error);
    if (cmd === "git" && /unknown option/i.test(result.stderr ?? "")) fail(call, GIT_FLOOR);
    if (result.status !== 0 && !allowed.includes(result.status)) fail(call, String(result.stderr ?? "").trim() || `exit ${result.status}`);
    if (typeof result.stdout !== "string") fail(call, "missing or invalid stdout");
    return result;
  }
  function git(call, args, allowed = [], input) {
    return execute(call, "git", ["-C", checkout, ...args], input, allowed);
  }
  function json(call, args) {
    const result = execute(call, "gh", ["api", ...args]);
    let value;
    try { value = JSON.parse(result.stdout); } catch { fail(call, "invalid JSON from gh"); }
    if (value?.errors) fail(call, "GraphQL response contains errors");
    return value;
  }
  function pages(call, endpoint, key, normalise) {
    const out = [];
    for (let page = 1; page <= PAGE_CAP; page++) {
      const response = json(call, [`${root}/${endpoint}?per_page=100&page=${page}`]);
      const rows = array(key ? object(response, call, key)[key] : response, call, key || "page");
      out.push(...rows.map(row => normalise(row, call)));
      if (rows.length < 100) return out;
    }
    fail(call, `reached ${PAGE_CAP}-page cap`);
  }
  function firstParentChain(from, to, call = "firstParentChain") {
    const out = git(call, ["rev-list", "--first-parent", "--reverse", "--parents", `${from}..${to}`]).stdout.trim();
    if (!out) return [];
    return out.split("\n").map(line => {
      const [sha, ...parents] = line.split(" ");
      if (![sha, ...parents].every(id => SHA.test(id))) fail(call, "invalid first-parent commit row");
      return { sha, parents };
    });
  }
  function numstat(from, to, call = "numstat") {
    const out = git(call, ["log", "--first-parent", "--no-merges", "--numstat", "--format=%x00%H", `${from}..${to}`]).stdout;
    const commits = [];
    let current;
    for (const line of out.split("\n")) {
      if (line === "") continue;
      if (line.startsWith("\0")) {
        const sha = line.slice(1);
        if (!SHA.test(sha)) fail(call, "invalid numstat commit header");
        current = { sha, files: [] };
        commits.push(current);
      } else {
        if (!current) fail(call, "numstat row without a commit");
        current.files.push(statRow(line, call));
      }
    }
    return commits;
  }
  function remergeNumstat(merge, call = "remergeNumstat") {
    const out = git(call, ["show", "--remerge-diff", "--format=", "--numstat", merge]).stdout;
    return out.split("\n").filter(Boolean).map(line => statRow(line, call));
  }
  return {
    head() {
      const call = "head";
      const row = object(json(call, [`${root}/pulls/${number}`]), call, "pull request");
      return { sha: field(row.head, "sha", "string", call), baseRef: field(row.base, "ref", "string", call), state: field(row, "state", "string", call) };
    },
    checks(sha) {
      const call = "checks";
      const runs = pages(call, `commits/${sha}/check-runs`, "check_runs", row => {
        const name = field(row, "name", "string", call);
        const status = field(row, "status", "string", call);
        const conclusion = nullableString(row.conclusion, call, "conclusion");
        return { name, status, completed: status === "completed", conclusion: status === "completed" ? conclusion : null };
      });
      const statuses = pages(call, `commits/${sha}/status`, "statuses", row => {
        const name = field(row, "context", "string", call);
        const status = field(row, "state", "string", call);
        return { name, status, completed: status !== "pending", conclusion: status === "pending" ? null : status };
      });
      return [...runs, ...statuses];
    },
    firstSuiteAt(sha) {
      const dates = pages("firstSuiteAt", `commits/${sha}/check-suites`, "check_suites", row => field(row, "created_at", "string", "firstSuiteAt"));
      let earliest = null;
      for (const date of dates) {
        if (!Number.isFinite(Date.parse(date))) fail("firstSuiteAt", "invalid created_at timestamp");
        if (earliest === null || Date.parse(date) < Date.parse(earliest)) earliest = date;
      }
      return earliest;
    },
    threads() {
      const call = "threads";
      const out = [];
      let cursor = null;
      for (let page = 1; page <= PAGE_CAP; page++) {
        const args = ["graphql", "-f", `query=${THREAD_QUERY}`, "-f", `owner=${owner}`, "-f", `repo=${repo}`, "-F", `number=${number}`];
        if (cursor !== null) args.push("-f", `cursor=${cursor}`);
        const response = json(call, args);
        const data = object(response?.data, call, "data");
        const repository = object(data.repository, call, "repository");
        const pr = object(repository.pullRequest, call, "pullRequest");
        const connection = object(pr.reviewThreads, call, "reviewThreads");
        for (const row of array(connection.nodes, call, "nodes")) {
          const comments = array(object(row?.comments, call, "comments").nodes, call, "comments.nodes");
          if (comments.length !== 1) fail(call, "missing first thread comment");
          const author = object(comments[0], call, "first comment").author;
          // A deleted account has a null author in GitHub's GraphQL schema.
          const authorLogin = author === null ? null : field(author, "login", "string", call);
          out.push({ id: field(row, "id", "string", call), isResolved: field(row, "isResolved", "boolean", call), isOutdated: field(row, "isOutdated", "boolean", call), path: field(row, "path", "string", call), authorLogin });
        }
        const pageInfo = object(connection.pageInfo, call, "pageInfo");
        const hasNext = field(pageInfo, "hasNextPage", "boolean", call);
        const next = nullableString(pageInfo.endCursor, call, "endCursor");
        if (!hasNext) return out;
        if (!next || next === cursor) fail(call, "invalid next thread cursor");
        cursor = next;
      }
      fail(call, `reached ${PAGE_CAP}-page cap`);
    },
    botReviews() {
      return pages("botReviews", `pulls/${number}/reviews`, null, (row, call) => ({ ...account(row, call), commitId: field(row, "commit_id", "string", call), body: field(row, "body", "string", call), state: field(row, "state", "string", call), submittedAt: field(row, "submitted_at", "string", call) }));
    },
    botComments() {
      return pages("botComments", `issues/${number}/comments`, null, (row, call) => ({ ...account(row, call), body: field(row, "body", "string", call), createdAt: field(row, "created_at", "string", call), updatedAt: field(row, "updated_at", "string", call) }));
    },
    botReactions() {
      return pages("botReactions", `issues/${number}/reactions`, null, (row, call) => ({ ...account(row, call), content: field(row, "content", "string", call), createdAt: field(row, "created_at", "string", call) }));
    },
    hasCommit(sha) { return git("hasCommit", ["cat-file", "-e", `${sha}^{commit}`], Array.from({ length: 255 }, (_, i) => i + 1)).status === 0; },
    isAncestor(a, b) { return git("isAncestor", ["merge-base", "--is-ancestor", a, b], [1]).status === 0; },
    mergeBase(a, b) {
      const call = "mergeBase";
      const result = git(call, ["merge-base", a, b], [1]);
      if (result.status === 1 && result.stdout.trim() === "") return null;
      const sha = result.stdout.trim();
      if (result.status !== 0 || !SHA.test(sha)) fail(call, "invalid merge-base answer");
      return sha;
    },
    firstParentChain,
    numstat,
    remergeNumstat,
    /** {total, commits:[{sha,lines}], merges:[{sha,lines}]}; commits are oldest first.
     * merges lists every merge with remerge rows, even when all rows are tests/binary.
     * Binary file rows have null added/deleted counts in the lower-level readers.
     */
    nonTestLines(from, to) {
      const call = "nonTestLines";
      const stats = new Map(numstat(from, to, call).map(commit => [commit.sha, commit.files]));
      const commits = [];
      const merges = [];
      for (const commit of firstParentChain(from, to, call)) {
        let count;
        if (commit.parents.length >= 2) {
          const files = remergeNumstat(commit.sha, call);
          count = lines(files);
          if (files.length) merges.push({ sha: commit.sha, lines: count });
        } else {
          if (!stats.has(commit.sha)) fail(call, `missing numstat for ${commit.sha}`);
          count = lines(stats.get(commit.sha));
        }
        commits.push({ sha: commit.sha, lines: count });
      }
      return { total: commits.reduce((sum, commit) => sum + commit.lines, 0), commits, merges };
    },
    patchId(base, head) {
      const call = "patchId";
      const diff = git(call, ["diff", base, head]).stdout;
      if (diff === "") return null;
      const out = git(call, ["patch-id", "--verbatim"], [], diff).stdout.trim();
      const match = /^([a-f0-9]{40}(?:[a-f0-9]{24})?)\s+[a-f0-9]+$/.exec(out);
      if (!match) fail(call, "invalid patch-id answer");
      return match[1];
    },
  };
}
