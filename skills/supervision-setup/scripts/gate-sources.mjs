/**
 * KOD-44 — the merge gate's live sources, behind one injected process runner.
 *
 *   createGateSources({ checkout, owner, repo, number, run? })
 *
 * In plain words: this module asks gh about the pull request and git about
 * the history, and hands back what they said. It judges nothing; the gate
 * decides what passes. A call that fails, or an answer that is malformed or
 * missing a field, throws TransportFailure naming the call, never a value
 * that could be mistaken for evidence (KTD9).
 *
 * From gh: head, checks, firstSuiteAt, threads, botReviews, botComments and
 * botReactions. Each is a single `gh api` request per page, and the module
 * paginates itself, up to 50 pages.
 * From git: hasCommit, isAncestor, mergeBase, firstParentChain, numstat,
 * remergeNumstat, nonTestLines and patchId. A defined negative answer, such
 * as a missing commit or no merge-base, is a value, not a failure.
 *
 * run(cmd, args, { cwd, input, env }) returns spawnSync's result shape. The
 * default runner bounds each argv-only call, never a shell, to 30 seconds and
 * 64 MiB. Git runs by `-C <checkout>`, with the environment variables that
 * would point it at another checkout cleared.
 *
 * Plan: docs/plans/2026-11-08-kod-44-merge-gate-plan.md, U3;
 * KTD1 (one runner), KTD5 (line counts), KTD7 (verbatim patch IDs),
 * KTD8 (check-suite time), KTD9 (transport failures).
 */
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import process from "node:process";

/** A gh or git call that failed or answered malformed: the gate maps it to exit 2. */
export class TransportFailure extends Error {
  constructor(call, reason) {
    const line = String(reason).trim().split(/\r?\n/)[0] || "unknown transport failure";
    super(`${call}: ${line}`);
    this.name = "TransportFailure";
    this.call = call;
    this.reason = line;
  }
}

/** The runner used when none is injected: a bounded synchronous spawn. */
export function defaultRunner(cmd, args, options) {
  return spawnSync(cmd, args, { ...options, encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024 * 1024 });
}

const PAGE_CAP = 50;
const GIT_FLOOR = "git 2.39 or newer is required (patch-id --verbatim, git RelNotes 2.39.0)";
const SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
// `git cat-file -e` exits 128 for an unknown object, so any non-zero exit
// means the commit is absent; a failure to run still throws.
const ANY_EXIT_STATUS = Array.from({ length: 255 }, (_, i) => i + 1);

// Copied from Compound Engineering 3.27.0,
// skills/ce-code-review/scripts/review-scope.py: TEST_PATTERN.
// Its (?-i:...) class-file alternative needs a separate, case-sensitive JS regex.
const TEST_PATTERN = /(^|\/)(tests?|spec|__tests__)\/|(^|\/)[^/]+[._-](test|spec)\.[^/]+$|(^|\/)(test_[^/]+|conftest)\.[^/]+$/i;
const TEST_CLASS_PATTERN = /(^|\/)[^/]+(Test|Tests|Spec)\.(java|kt|scala|swift|cs)$/;

// Git's C-style path quoting, including octal UTF-8 bytes.
const PATH_ESCAPES = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, "\\": 92 };
const QUOTED_PATH_PART = /\\([0-7]{3}|[abtnvfr"\\])|([^\\]+)|(\\)/g;

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

/** Throw the transport failure for one call. */
function fail(call, reason) {
  throw new TransportFailure(call, reason);
}

/** The value, when it is a plain object; otherwise a failure naming it. */
function object(value, name, call) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(call, `missing or invalid ${name}`);
  return value;
}

/** The value's `key` field, when it has the given type; otherwise a failure naming it. */
function field(value, key, type, call) {
  object(value, key, call);
  if (typeof value[key] !== type) fail(call, `missing or invalid ${key}`);
  return value[key];
}

/** The value, when it is an array; otherwise a failure naming it. */
function array(value, name, call) {
  if (!Array.isArray(value)) fail(call, `missing or invalid ${name}`);
  return value;
}

/** The value, when it is a string or null; otherwise a failure naming it. */
function nullableString(value, name, call) {
  if (value !== null && typeof value !== "string") fail(call, `missing or invalid ${name}`);
  return value;
}

/** The login and account type of the user a REST row names. */
function account(row, call) {
  const user = object(row?.user, "user", call);
  return {
    login: field(user, "login", "string", call),
    type: field(user, "type", "string", call),
  };
}

/** The environment git runs with: this one, less what would point it at another checkout. */
// Keep in step with review-read.mjs's gitEnv: each script ships standalone.
function gitEnv() {
  const env = { ...process.env };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[key];
  return env;
}

/** A path as git printed it, with C-style quoting undone. */
function unquotePath(path, call) {
  if (!path.startsWith('"')) return path;
  if (!path.endsWith('"')) fail(call, "invalid quoted numstat path");
  const parts = [];
  for (const match of path.slice(1, -1).matchAll(QUOTED_PATH_PART)) {
    const [, escape, text, loneBackslash] = match;
    if (loneBackslash) fail(call, "invalid escape in numstat path");
    if (text) parts.push(Buffer.from(text));
    else parts.push(Buffer.from([escape.length === 3 ? parseInt(escape, 8) : PATH_ESCAPES[escape]]));
  }
  return Buffer.concat(parts).toString("utf8");
}

/** A renamed path's new name, as review-scope.py's numstat_path reads it. */
function destination(path) {
  if (!path.includes(" => ")) return path;
  if (path.includes("{") && path.includes("}")) return path.replace(/\{[^{}]* => ([^{}]*)\}/, "$1");
  return path.slice(path.lastIndexOf(" => ") + 4);
}

/** The path a numstat row counts under. */
function rowPath(raw, call) {
  // With unusual names git may quote the two sides of a rename separately.
  const quotedRename = /^("(?:[^"\\]|\\.)*"|[^"]*) => ("(?:[^"\\]|\\.)*"|[^"]*)$/.exec(raw);
  if (quotedRename && (quotedRename[1].startsWith('"') || quotedRename[2].startsWith('"'))) {
    return unquotePath(quotedRename[2], call);
  }
  return destination(unquotePath(raw, call));
}

/** One numstat count: a number, or null for a binary file's `-`. */
function numstatCount(text, call) {
  if (text === "-") return null;
  const count = Number(text);
  if (!Number.isSafeInteger(count)) fail(call, "invalid numstat count");
  return count;
}

/** One `added<TAB>deleted<TAB>path` row. */
function statRow(line, call) {
  const match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
  if (!match || (match[1] === "-") !== (match[2] === "-")) fail(call, "invalid numstat row");
  const path = rowPath(match[3], call);
  const added = numstatCount(match[1], call);
  const deleted = numstatCount(match[2], call);
  return { path, added, deleted };
}

/** Whether a row counts toward the non-test total: not binary, and not a test path. */
function countsTowardTotal(row) {
  if (row.added === null || row.deleted === null) return false;
  return !TEST_PATTERN.test(row.path) && !TEST_CLASS_PATTERN.test(row.path);
}

/** Added plus deleted lines over the rows that count. */
function nonTestLineCount(files) {
  let total = 0;
  for (const row of files) {
    if (countsTowardTotal(row)) total += row.added + row.deleted;
  }
  return total;
}

/** One check run, reported as it stands: a running check's conclusion is never read. */
function checkRun(row, call) {
  const name = field(row, "name", "string", call);
  const status = field(row, "status", "string", call);
  const conclusion = nullableString(row.conclusion, "conclusion", call);
  const completed = status === "completed";
  return { name, status, completed, conclusion: completed ? conclusion : null };
}

/** One legacy commit status: completed unless pending. */
function commitStatus(row, call) {
  const name = field(row, "context", "string", call);
  const status = field(row, "state", "string", call);
  const completed = status !== "pending";
  return { name, status, completed, conclusion: completed ? status : null };
}

/** One review thread, with its first comment's author (null for a deleted account). */
function threadRow(row, call) {
  const comments = array(object(row?.comments, "comments", call).nodes, "comments.nodes", call);
  if (comments.length !== 1) fail(call, "missing first thread comment");
  const author = object(comments[0], "first comment", call).author;
  const authorLogin = author === null ? null : field(author, "login", "string", call);
  return {
    id: field(row, "id", "string", call),
    isResolved: field(row, "isResolved", "boolean", call),
    isOutdated: field(row, "isOutdated", "boolean", call),
    path: field(row, "path", "string", call),
    authorLogin,
  };
}

/** The reviewThreads connection inside one GraphQL page. */
function threadConnection(response, call) {
  const data = object(response?.data, "data", call);
  const repository = object(data.repository, "repository", call);
  const pullRequest = object(repository.pullRequest, "pullRequest", call);
  return object(pullRequest.reviewThreads, "reviewThreads", call);
}

/**
 * The gate's sources for one pull request and one checkout. Every reader goes
 * through the same runner. gh answers are camel-cased records and include
 * human accounts too: deciding which accounts matter belongs to the gate.
 */
export function createGateSources({ checkout, owner, repo, number, run = defaultRunner }) {
  const root = `repos/${owner}/${repo}`;

  /** Run one process; `allowed` lists the non-zero exits the call answers with. */
  function execute(call, cmd, args, { allowed = [], input } = {}) {
    let result;
    try {
      result = run(cmd, args, { cwd: checkout, input, env: cmd === "git" ? gitEnv() : { ...process.env } });
    } catch (error) {
      fail(call, error.message);
    }
    if (!result || typeof result !== "object") fail(call, "runner returned no result");
    if (result.error) fail(call, result.error.message || result.error);
    if (cmd === "git" && /unknown option/i.test(result.stderr ?? "")) fail(call, GIT_FLOOR);
    if (result.status !== 0 && !allowed.includes(result.status)) {
      fail(call, String(result.stderr ?? "").trim() || `exit ${result.status}`);
    }
    if (typeof result.stdout !== "string") fail(call, "missing or invalid stdout");
    return result;
  }

  /** One git command in the checkout. */
  function git(call, args, options) {
    return execute(call, "git", ["-C", checkout, ...args], options);
  }

  /** One `gh api` request, parsed as JSON. */
  function ghApi(call, args) {
    const result = execute(call, "gh", ["api", ...args]);
    let value;
    try {
      value = JSON.parse(result.stdout);
    } catch {
      fail(call, "invalid JSON from gh");
    }
    if (value?.errors) fail(call, "GraphQL response contains errors");
    return value;
  }

  /** Every row of a REST list, page by page; `key` names the array in a wrapped response. */
  function pages(call, endpoint, key, normalise) {
    const out = [];
    for (let page = 1; page <= PAGE_CAP; page++) {
      const response = ghApi(call, [`${root}/${endpoint}?per_page=100&page=${page}`]);
      let rows;
      if (key) rows = array(object(response, key, call)[key], key, call);
      else rows = array(response, "page", call);
      out.push(...rows.map((row) => normalise(row, call)));
      if (rows.length < 100) return out;
    }
    fail(call, `reached ${PAGE_CAP}-page cap`);
  }

  /** The commits from `from` (excluded) to `to`, first parents only, oldest first. */
  function firstParentChain(from, to, call = "firstParentChain") {
    const out = git(call, ["rev-list", "--first-parent", "--reverse", "--parents", `${from}..${to}`]).stdout.trim();
    if (!out) return [];
    return out.split("\n").map((line) => {
      const [sha, ...parents] = line.split(" ");
      if (![sha, ...parents].every((id) => SHA.test(id))) fail(call, "invalid first-parent commit row");
      return { sha, parents };
    });
  }

  /** Each non-merge first-parent commit's numstat rows. */
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

  /** A merge's remerge-diff numstat rows; none for a clean merge. */
  function remergeNumstat(merge, call = "remergeNumstat") {
    const out = git(call, ["show", "--remerge-diff", "--format=", "--numstat", merge]).stdout;
    return out.split("\n").filter(Boolean).map((line) => statRow(line, call));
  }

  return {
    head() {
      const call = "head";
      const row = object(ghApi(call, [`${root}/pulls/${number}`]), "pull request", call);
      return {
        sha: field(row.head, "sha", "string", call),
        baseRef: field(row.base, "ref", "string", call),
        state: field(row, "state", "string", call),
      };
    },

    checks(sha) {
      const call = "checks";
      const runs = pages(call, `commits/${sha}/check-runs`, "check_runs", checkRun);
      const statuses = pages(call, `commits/${sha}/status`, "statuses", commitStatus);
      return [...runs, ...statuses];
    },

    firstSuiteAt(sha) {
      const call = "firstSuiteAt";
      const dates = pages(call, `commits/${sha}/check-suites`, "check_suites", (row) => field(row, "created_at", "string", call));
      let earliest = null;
      let earliestTime = Infinity;
      for (const date of dates) {
        const time = Date.parse(date);
        if (!Number.isFinite(time)) fail(call, "invalid created_at timestamp");
        if (time < earliestTime) {
          earliest = date;
          earliestTime = time;
        }
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
        const connection = threadConnection(ghApi(call, args), call);
        for (const row of array(connection.nodes, "nodes", call)) out.push(threadRow(row, call));
        const pageInfo = object(connection.pageInfo, "pageInfo", call);
        const hasNext = field(pageInfo, "hasNextPage", "boolean", call);
        const next = nullableString(pageInfo.endCursor, "endCursor", call);
        if (!hasNext) return out;
        if (!next || next === cursor) fail(call, "invalid next thread cursor");
        cursor = next;
      }
      fail(call, `reached ${PAGE_CAP}-page cap`);
    },

    botReviews() {
      const call = "botReviews";
      return pages(call, `pulls/${number}/reviews`, null, (row) => ({
        ...account(row, call),
        commitId: field(row, "commit_id", "string", call),
        body: field(row, "body", "string", call),
        state: field(row, "state", "string", call),
        submittedAt: field(row, "submitted_at", "string", call),
      }));
    },

    botComments() {
      const call = "botComments";
      return pages(call, `issues/${number}/comments`, null, (row) => ({
        ...account(row, call),
        body: field(row, "body", "string", call),
        createdAt: field(row, "created_at", "string", call),
        updatedAt: field(row, "updated_at", "string", call),
      }));
    },

    botReactions() {
      const call = "botReactions";
      return pages(call, `issues/${number}/reactions`, null, (row) => ({
        ...account(row, call),
        content: field(row, "content", "string", call),
        createdAt: field(row, "created_at", "string", call),
      }));
    },

    hasCommit(sha) {
      return git("hasCommit", ["cat-file", "-e", `${sha}^{commit}`], { allowed: ANY_EXIT_STATUS }).status === 0;
    },

    isAncestor(a, b) {
      return git("isAncestor", ["merge-base", "--is-ancestor", a, b], { allowed: [1] }).status === 0;
    },

    mergeBase(a, b) {
      const call = "mergeBase";
      const result = git(call, ["merge-base", a, b], { allowed: [1] });
      if (result.status === 1 && result.stdout.trim() === "") return null;
      const sha = result.stdout.trim();
      if (result.status !== 0 || !SHA.test(sha)) fail(call, "invalid merge-base answer");
      return sha;
    },

    firstParentChain,
    numstat,
    remergeNumstat,

    /**
     * Non-test lines from `from` to `to` (KTD5): {total, commits:[{sha, lines}],
     * merges:[{sha, lines}]}, commits oldest first. A merge counts its
     * remerge-diff lines; `merges` lists every merge with remerge rows, even
     * when all its rows are tests or binary.
     */
    nonTestLines(from, to) {
      const call = "nonTestLines";
      const stats = new Map(numstat(from, to, call).map((commit) => [commit.sha, commit.files]));
      const commits = [];
      const merges = [];
      for (const commit of firstParentChain(from, to, call)) {
        let count;
        if (commit.parents.length >= 2) {
          const files = remergeNumstat(commit.sha, call);
          count = nonTestLineCount(files);
          if (files.length) merges.push({ sha: commit.sha, lines: count });
        } else {
          if (!stats.has(commit.sha)) fail(call, `missing numstat for ${commit.sha}`);
          count = nonTestLineCount(stats.get(commit.sha));
        }
        commits.push({ sha: commit.sha, lines: count });
      }
      return { total: commits.reduce((sum, commit) => sum + commit.lines, 0), commits, merges };
    },

    /** The verbatim patch-id of the diff from `base` to `head`; null for an empty diff (KTD7). */
    patchId(base, head) {
      const call = "patchId";
      const diff = git(call, ["diff", base, head]).stdout;
      if (diff === "") return null;
      const out = git(call, ["patch-id", "--verbatim"], { input: diff }).stdout.trim();
      const match = /^([a-f0-9]{40}(?:[a-f0-9]{24})?)\s+[a-f0-9]+$/.exec(out);
      if (!match) fail(call, "invalid patch-id answer");
      return match[1];
    },
  };
}
