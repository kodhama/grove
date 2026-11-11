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
 * run(cmd, args, { cwd, input, env, encoding }) returns spawnSync's result shape. The
 * default runner bounds each argv-only call, never a shell, to 30 seconds and
 * 64 MiB. Git runs by `-C <checkout>`, with checkout redirects and diff
 * environment overrides cleared.
 * encoding defaults to utf8; "buffer" requests raw stdout and stderr bytes.
 *
 * Plan: docs/plans/2026-11-08-kod-44-merge-gate-plan.md, U3;
 * KTD1 (one runner), KTD5 (line counts), KTD7 (verbatim patch IDs),
 * KTD8 (check-suite time), KTD9 (transport failures).
 */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { resolve } from "node:path";

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
  return spawnSync(cmd, args, { encoding: "utf8", ...options, timeout: 30_000, maxBuffer: 64 * 1024 * 1024 });
}

const PAGE_CAP = 50;
const GIT_CONFIG = [
  "diff.algorithm=myers",
  "diff.renames=true",
  "diff.noprefix=false",
  "diff.mnemonicPrefix=false",
  "diff.relative=false",
  "color.ui=never",
  "log.showSignature=false",
  "merge.conflictStyle=merge",
  "core.quotePath=true",
  "core.attributesFile=/dev/null",
  "diff.context=3",
  "diff.interHunkContext=0",
  "diff.indentHeuristic=true",
  "diff.suppressBlankEmpty=false",
  "diff.renameLimit=1000",
  "merge.renameLimit=7000",
  "diff.ignoreSubmodules=none",
  "diff.submodule=short",
].flatMap((value) => ["-c", value]);
const DIFF_FLAGS = ["--no-ext-diff", "--no-textconv", "--no-color", "--ignore-submodules=none", "-M"];
const GIT_FLOOR = "git 2.39 or newer is required (git patch-id --verbatim)";
const SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
// Copied from Compound Engineering 3.27.0,
// skills/ce-code-review/scripts/review-scope.py: TEST_PATTERN.
// Its (?-i:...) class-file alternative needs a separate, case-sensitive JS regex.
const TEST_PATTERN = /(^|\/)(tests?|spec|__tests__)\/|(^|\/)[^/]+[._-](test|spec)\.[^/]+$|(^|\/)(test_[^/]+|conftest)\.[^/]+$/i;
const TEST_CLASS_PATTERN = /(^|\/)[^/]+(Test|Tests|Spec)\.(java|kt|scala|swift|cs)$/;

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

/** Reject missing revisions and option-like inputs before any process runs. */
function revisions(call, ...values) {
  for (const value of values) {
    if (typeof value !== "string" || value === "" || value.startsWith("-")) fail(call, `invalid revision ${value}`);
  }
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
  if (row?.user === null) return {
    login: null,
    type: null,
  };
  const user = object(row?.user, "user", call);
  return {
    login: field(user, "login", "string", call),
    type: field(user, "type", "string", call),
  };
}

/** The process environment without checkout redirects or diff overrides. */
// Like review-read.mjs, clear checkout redirects; also clear diff options and drivers.
function gitEnv() {
  const env = { ...process.env };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_DIFF_OPTS", "GIT_EXTERNAL_DIFF"]) delete env[key];
  return env;
}

/** One numstat count: a number, or null for a binary file's `-`. */
function numstatCount(text, call) {
  if (text === "-") return null;
  const count = Number(text);
  if (!Number.isSafeInteger(count)) fail(call, "invalid numstat count");
  return count;
}

/** One NUL-delimited numstat row, consuming the two paths of a rename. */
function statRow(text, parts, call) {
  const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(text);
  if (!match || (match[1] === "-") !== (match[2] === "-")) fail(call, "invalid numstat row");
  let path = match[3];
  let oldPath = null;
  if (path === "") {
    oldPath = parts.next().value;
    path = parts.next().value;
    if (!oldPath || !path) fail(call, "invalid numstat rename");
  }
  return {
    path,
    oldPath,
    added: numstatCount(match[1], call),
    deleted: numstatCount(match[2], call),
  };
}

/** NUL-framed commit headers and rows; only Git's row separator is a newline. */
function* numstatRecords(out, call) {
  if (out !== "" && !out.endsWith("\0")) fail(call, "unterminated numstat output");
  const parts = out.split("\0").values();
  for (const part of parts) {
    if (part === "") continue;
    const text = part.replace(/^\n/, "");
    if (text.startsWith("commit:")) {
      const sha = text.slice(7);
      if (!SHA.test(sha)) fail(call, "invalid numstat commit header");
      yield { sha };
    } else {
      yield statRow(text, parts, call);
    }
  }
}

/** A path as Git quotes it in a patch header with core.quotePath enabled. */
function patchPath(path) {
  const bytes = Buffer.from(path);
  if (![...bytes].some((byte) => byte < 32 || byte >= 127 || byte === 34 || byte === 92)) return path;
  const escapes = {
    7: "a",
    8: "b",
    9: "t",
    10: "n",
    11: "v",
    12: "f",
    13: "r",
    34: '"',
    92: "\\",
  };
  return '"' + [...bytes].map((byte) => {
    if (escapes[byte]) return "\\" + escapes[byte];
    if (byte < 32 || byte >= 127) return "\\" + byte.toString(8).padStart(3, "0");
    return String.fromCharCode(byte);
  }).join("") + '"';
}

/** Whether any conflict notice lacks a numstat row in its per-file patch section. */
function hiddenRemergeConflict(patch, files) {
  const headers = new Set(files.map((row) => `diff --git ${patchPath(`a/${row.oldPath ?? row.path}`)} ${patchPath(`b/${row.path}`)}`));
  let header = null;
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) header = line;
    if (line.startsWith("remerge CONFLICT") && !headers.has(header)) return true;
  }
  return false;
}

/** Whether a path matches the reviewer's test patterns. */
function isTestPath(path) {
  return TEST_PATTERN.test(path) || TEST_CLASS_PATTERN.test(path);
}

/** Whether a non-binary row touches a non-test path on either side. */
function countsTowardTotal(row) {
  if (row.added === null || row.deleted === null) return false;
  return !isTestPath(row.path) || (row.oldPath !== null && !isTestPath(row.oldPath));
}

/** Added plus deleted non-test lines, recounting moves across the test boundary. */
function nonTestLineCount(files, recount) {
  let total = 0;
  for (const row of files) {
    const crossesBoundary = row.oldPath && isTestPath(row.oldPath) !== isTestPath(row.path);
    if (crossesBoundary) total += recount(isTestPath(row.path) ? row.oldPath : row.path);
    else if (countsTowardTotal(row)) total += row.added + row.deleted;
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
  const checkoutPath = resolve(checkout);
  const root = `repos/${owner}/${repo}`;

  /** Run one process; `allowed` lists the non-zero exits the call answers with. */
  function execute(call, cmd, args, { allowed = [], input, encoding = "utf8" } = {}) {
    let result;
    try {
      result = run(cmd, args, {
        ...(cmd === "git" ? {} : { cwd: checkoutPath }),
        input,
        encoding,
        env: cmd === "git" ? gitEnv() : { ...process.env },
      });
    } catch (error) {
      fail(call, error.message);
    }
    if (!result || typeof result !== "object") fail(call, "runner returned no result");
    if (result.error) fail(call, result.error.message || result.error);
    if (cmd === "git" && (
      /unknown option|unrecognized argument/i.test(result.stderr ?? "") ||
      (args.includes("patch-id") && result.status === 129)
    )) fail(call, GIT_FLOOR);
    if (result.status !== 0 && !allowed.includes(result.status)) {
      fail(call, String(result.stderr ?? "").trim() || `exit ${result.status}`);
    }
    if (encoding === "buffer" ? !Buffer.isBuffer(result.stdout) : typeof result.stdout !== "string") fail(call, "missing or invalid stdout");
    return result;
  }

  /** One git command in the checkout. */
  function git(call, args, options) {
    return execute(call, "git", ["-C", checkoutPath, ...GIT_CONFIG, ...args], options);
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
    revisions(call, from, to);
    const out = git(call, ["rev-list", "--first-parent", "--reverse", "--parents", `${from}..${to}`, "--"]).stdout.trim();
    if (!out) return [];
    return out.split("\n").map((line) => {
      const [sha, ...parents] = line.split(" ");
      if (![sha, ...parents].every((id) => SHA.test(id))) fail(call, "invalid first-parent commit row");
      return { sha, parents };
    });
  }

  /** Whether one commit is an ancestor of another, including equality. */
  function isAncestor(a, b, call = "isAncestor") {
    revisions(call, a, b);
    return git(call, ["merge-base", "--is-ancestor", a, b], { allowed: [1] }).status === 0;
  }

  /** The numstat rows between two commits, with the same pinning as the log. */
  function diffNumstat(from, to, call) {
    revisions(call, from, to);
    const out = git(call, ["diff", ...DIFF_FLAGS, "--numstat", "-z", from, to, "--"]).stdout;
    return [...numstatRecords(out, call)];
  }

  /** Each non-merge first-parent commit's numstat rows. */
  function numstat(from, to, call = "numstat") {
    revisions(call, from, to);
    const out = git(call, ["log", ...DIFF_FLAGS, "--first-parent", "--no-merges", "--numstat", "-z", "--format=commit:%H", `${from}..${to}`, "--"]).stdout;
    const commits = [];
    let current;
    for (const record of numstatRecords(out, call)) {
      if (record.sha) {
        current = { sha: record.sha, files: [] };
        commits.push(current);
      } else {
        if (!current) fail(call, "numstat row without a commit");
        current.files.push(record);
      }
    }
    return commits;
  }

  /** A merge's remerge-diff numstat rows; none for a clean merge. */
  function remergeNumstat(merge, call = "remergeNumstat") {
    revisions(call, merge);
    const out = git(call, ["show", ...DIFF_FLAGS, "--remerge-diff", "--format=", "--numstat", "-z", merge, "--"]).stdout;
    return [...numstatRecords(out, call)].map((row) => {
      if (row.sha) fail(call, "unexpected numstat commit header");
      return row;
    });
  }

  /** A rename's non-test file count from the same diff without renames, noting binaries. */
  function renamedLineCount(path, args, call, binaryPaths) {
    const [command, ...rest] = args;
    const out = git(call, [command, ...DIFF_FLAGS, "--numstat", "-z", "--no-renames", ...rest, "--", `:(literal)${path}`]).stdout;
    const files = [...numstatRecords(out, call)];
    if (files.length !== 1 || files[0].path !== path || files[0].oldPath !== null) fail(call, "invalid renamed file numstat");
    if (files[0].added === null) binaryPaths.add(path);
    return nonTestLineCount(files);
  }

  /** Whether a base merge has conflict notices absent from its remerge numstat rows. */
  function hasHiddenConflict(merge, files, call) {
    const patch = git(call, ["show", ...DIFF_FLAGS, "--src-prefix=a/", "--dst-prefix=b/", "--remerge-diff", "--format=", "--patch", merge, "--"]).stdout;
    return hiddenRemergeConflict(patch, files);
  }

  return {
    head() {
      const call = "head";
      const row = object(ghApi(call, [`${root}/pulls/${number}`]), "pull request", call);
      return {
        sha: field(row.head, "sha", "string", call),
        baseRef: field(row.base, "ref", "string", call),
        baseSha: field(row.base, "sha", "string", call),
        state: field(row, "state", "string", call),
      };
    },

    checks(sha) {
      const call = "checks";
      revisions(call, sha);
      const runs = pages(call, `commits/${sha}/check-runs`, "check_runs", checkRun);
      const statuses = pages(call, `commits/${sha}/status`, "statuses", commitStatus);
      return [...runs, ...statuses];
    },

    firstSuiteAt(sha) {
      const call = "firstSuiteAt";
      revisions(call, sha);
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
        commitId: nullableString(row.commit_id, "commit_id", call),
        body: field(row, "body", "string", call),
        state: field(row, "state", "string", call),
        submittedAt: nullableString(row.submitted_at ?? null, "submitted_at", call),
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
      revisions("hasCommit", sha);
      return git("hasCommit", ["rev-parse", "--verify", "--quiet", `${sha}^{commit}`], { allowed: [1] }).status === 0;
    },

    isAncestor,

    mergeBase(a, b) {
      const call = "mergeBase";
      revisions(call, a, b);
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
     * merges:[{sha, lines}], binaryPaths, attributesTouched}, oldest first.
     * attributesTouched reports a .gitattributes path (old or new) in the rows
     * read for the count, including test and binary rows. A two-parent merge
     * from base counts its remerge rows, unless a conflict notice lacks a row;
     * then it counts its first-parent diff, as all other merges do. `merges`
     * lists those merges and base merges with remerge rows, even tests or binary.
     * A rename from a test path to a non-test path counts the new file in full.
     * A rename into a test path counts the old non-test file in full.
     */
    nonTestLines(from, to, base) {
      const call = "nonTestLines";
      revisions(call, from, to, base);
      const stats = new Map(numstat(from, to, call).map((commit) => [commit.sha, commit.files]));
      const commits = [];
      const merges = [];
      const binaryPaths = new Set();
      let attributesTouched = false;
      for (const commit of firstParentChain(from, to, call)) {
        let files;
        let diffArgs;
        let listMerge = false;
        if (commit.parents.length >= 2) {
          let fromBase = commit.parents.length === 2 && isAncestor(commit.parents[1], base, call);
          files = fromBase ? remergeNumstat(commit.sha, call) : diffNumstat(commit.parents[0], commit.sha, call);
          if (fromBase && hasHiddenConflict(commit.sha, files, call)) {
            fromBase = false;
            files = diffNumstat(commit.parents[0], commit.sha, call);
          }
          diffArgs = fromBase ? ["show", "--remerge-diff", "--format=", commit.sha] : ["diff", commit.parents[0], commit.sha];
          listMerge = !fromBase || files.length > 0;
        } else {
          if (!stats.has(commit.sha)) fail(call, `missing numstat for ${commit.sha}`);
          files = stats.get(commit.sha);
          diffArgs = ["show", "--format=", commit.sha];
        }
        for (const row of files) {
          if (row.added === null) binaryPaths.add(row.path);
          if ([row.path, row.oldPath].some((path) => path?.split("/").at(-1) === ".gitattributes")) attributesTouched = true;
        }
        const lines = nonTestLineCount(files, (path) => renamedLineCount(path, diffArgs, call, binaryPaths));
        if (listMerge) merges.push({ sha: commit.sha, lines });
        commits.push({ sha: commit.sha, lines });
      }
      return {
        total: commits.reduce((sum, commit) => sum + commit.lines, 0),
        commits,
        merges,
        binaryPaths: [...binaryPaths],
        attributesTouched,
      };
    },

    /** The verbatim patch-id of the diff from `base` to `head`; null for an empty diff (KTD7). */
    patchId(base, head) {
      const call = "patchId";
      revisions(call, base, head);
      const diff = git(call, ["diff", ...DIFF_FLAGS, "--binary", "--src-prefix=a/", "--dst-prefix=b/", base, head, "--"], { encoding: "buffer" }).stdout;
      if (diff.length === 0) return null;
      const out = git(call, ["patch-id", "--verbatim"], { input: diff }).stdout.trim();
      const match = /^([a-f0-9]{40}(?:[a-f0-9]{24})?)\s+[a-f0-9]+$/.exec(out);
      if (!match) fail(call, "invalid patch-id answer");
      return match[1];
    },
  };
}
