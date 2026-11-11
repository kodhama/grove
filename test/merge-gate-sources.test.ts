/** Gate sources use stubbed gh responses and disposable, offline git repositories. */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error -- no type declarations for this .mjs script
import { createGateSources, TransportFailure } from "../skills/supervision-setup/scripts/gate-sources.mjs";

type Result = { status: number | null; stdout: string; stderr: string; error?: Error };
type Options = { cwd?: string; input?: string | Buffer; env?: NodeJS.ProcessEnv; encoding?: "utf8" | "buffer" };
const ok = (value: unknown): Result => ({ status: 0, stdout: JSON.stringify(value), stderr: "" });

/** A gh runner that answers from a queue of pages and logs each call. */
function stub(pages: Result[]) {
  const calls: { cmd: string; args: string[]; options: Options }[] = [];
  return {
    calls,
    run(cmd: string, args: string[], options: Options) {
      calls.push({ cmd, args, options });
      if (cmd !== "gh") throw new Error("unexpected process: " + cmd);
      const page = pages.shift();
      if (!page) throw new Error("unexpected extra gh request");
      return page;
    },
  };
}

const config = { checkout: "/checkout", owner: "owner", repo: "repo", number: 44 };
const thread = (id: string) => ({ id, isResolved: false, isOutdated: true, path: "src/a", comments: { nodes: [{ author: { login: "reviewer" } }] } });
const threadPage = (nodes: unknown[], more: boolean, cursor: string | null) =>
  ok({ data: { repository: { pullRequest: { reviewThreads: { nodes, pageInfo: { hasNextPage: more, endCursor: cursor } } } } } });
const user = { login: "review-bot", type: "Bot" };
const review = { user, commit_id: "abc", body: "done", state: "COMMENTED", submitted_at: "2026-11-08T12:00:00Z" };

describe("gh sources", () => {
  it("reads the live head and base", () => {
    const s = stub([ok({ head: { sha: "abc" }, base: { ref: "main", sha: "base-sha" }, state: "open" })]);
    expect(createGateSources({ ...config, run: s.run }).head()).toEqual({ sha: "abc", baseRef: "main", baseSha: "base-sha", state: "open" });
    expect(s.calls[0]?.args).toEqual(["api", "repos/owner/repo/pulls/44"]);
  });

  it("reads both thread pages without gh --paginate", () => {
    const s = stub([threadPage([thread("one")], true, "cursor1"), threadPage([thread("two")], false, null)]);
    expect(createGateSources({ ...config, run: s.run }).threads()).toEqual(
      ["one", "two"].map((id) => ({ id, isResolved: false, isOutdated: true, path: "src/a", authorLogin: "reviewer" })),
    );
    expect(s.calls).toHaveLength(2);
    expect(s.calls[1]?.args).toContain("cursor=cursor1");
    expect(s.calls.every((c) => c.cmd === "gh" && c.args[0] === "api" && !c.args.includes("--paginate"))).toBe(true);
  });

  it("rejects a GraphQL body containing errors", () => {
    const response = JSON.parse(threadPage([], false, null).stdout);
    response.errors = [{ message: "partial response" }];
    expect(() => createGateSources({ ...config, run: stub([ok(response)]).run }).threads()).toThrow(/^threads: GraphQL response contains errors/);
  });

  it("rejects a repeated thread cursor", () => {
    const s = stub([threadPage([thread("one")], true, "same"), threadPage([thread("two")], true, "same")]);
    expect(() => createGateSources({ ...config, run: s.run }).threads()).toThrow(/^threads: invalid next thread cursor/);
    expect(s.calls).toHaveLength(2);
  });

  it("rejects a thread with no first comment", () => {
    const row = { ...thread("empty"), comments: { nodes: [] } };
    expect(() => createGateSources({ ...config, run: stub([threadPage([row], false, null)]).run }).threads()).toThrow(/^threads: missing first thread comment/);
  });

  it("reports a null first thread author", () => {
    const row = { ...thread("deleted"), comments: { nodes: [{ author: null }] } };
    expect(createGateSources({ ...config, run: stub([threadPage([row], false, null)]).run }).threads()).toEqual([{
      id: "deleted",
      isResolved: false,
      isOutdated: true,
      path: "src/a",
      authorLogin: null,
    }]);
  });

  it("reports running checks without interpreting their empty conclusion", () => {
    const s = stub([
      ok({ check_runs: [{ name: "test", status: "in_progress", conclusion: "" }, { name: "lint", status: "completed", conclusion: "success" }] }),
      ok({ statuses: [{ context: "legacy", state: "pending" }, { context: "build", state: "failure" }] }),
    ]);
    expect(createGateSources({ ...config, run: s.run }).checks("abc")).toEqual([
      { name: "test", status: "in_progress", completed: false, conclusion: null },
      { name: "lint", status: "completed", completed: true, conclusion: "success" },
      { name: "legacy", status: "pending", completed: false, conclusion: null },
      { name: "build", status: "failure", completed: true, conclusion: "failure" },
    ]);
  });

  it("finds the earliest suite across REST pages, or null with none", () => {
    const s = stub([
      ok({ check_suites: Array.from({ length: 100 }, (_, i) => ({ created_at: i === 0 ? "2026-11-08T12:00:00Z" : "2026-11-09T12:00:00Z" })) }),
      ok({ check_suites: [{ created_at: "2026-11-10T12:00:00Z" }] }),
    ]);
    expect(createGateSources({ ...config, run: s.run }).firstSuiteAt("abc")).toBe("2026-11-08T12:00:00Z");
    expect(s.calls[1]?.args[1]).toContain("page=2");
    expect(createGateSources({ ...config, run: stub([ok({ check_suites: [] })]).run }).firstSuiteAt("abc")).toBeNull();
  });

  it.each([
    {
      method: "botReviews",
      raw: review,
      expected: { login: user.login, type: user.type, commitId: "abc", body: "done", state: "COMMENTED", submittedAt: review.submitted_at },
    },
    {
      method: "botComments",
      raw: { user, body: "summary", created_at: "then", updated_at: "now" },
      expected: { login: user.login, type: user.type, body: "summary", createdAt: "then", updatedAt: "now" },
    },
    {
      method: "botReactions",
      raw: { user, content: "+1", created_at: "then" },
      expected: { login: user.login, type: user.type, content: "+1", createdAt: "then" },
    },
  ])("paginates and normalises $method without judging accounts", ({ method, raw, expected }) => {
    const s = stub([ok(Array.from({ length: 100 }, () => raw)), ok([{ ...raw, user: { login: "human", type: "User" } }])]);
    const result = createGateSources({ ...config, run: s.run })[method]();
    expect(result).toHaveLength(101);
    expect(result[0]).toEqual(expected);
    expect(result[100]).toMatchObject({ login: "human", type: "User" });
    expect(s.calls[1]?.args[1]).toContain("page=2");
  });

  it("normalises nullable and omitted review fields", () => {
    const raw = { user: null, commit_id: null, body: "pending", state: "PENDING" };
    const sources = createGateSources({ ...config, run: stub([ok([raw])]).run });
    expect(sources.botReviews()).toEqual([{
      login: null,
      type: null,
      commitId: null,
      body: "pending",
      state: "PENDING",
      submittedAt: null,
    }]);
  });

  it.each([
    ["botComments", { user: null, body: "summary", created_at: "then", updated_at: "now" }],
    ["botReactions", { user: null, content: "+1", created_at: "then" }],
  ])("normalises a deleted account on %s", (method, raw) => {
    const sources = createGateSources({ ...config, run: stub([ok([raw])]).run });
    expect(sources[method]()[0]).toMatchObject({ login: null, type: null });
  });

  it("paginates both check endpoints", () => {
    const s = stub([
      ok({ check_runs: Array.from({ length: 100 }, () => ({ name: "ci", status: "completed", conclusion: "success" })) }),
      ok({ check_runs: [] }),
      ok({ statuses: Array.from({ length: 100 }, () => ({ context: "old", state: "success" })) }),
      ok({ statuses: [] }),
    ]);
    expect(createGateSources({ ...config, run: s.run }).checks("abc")).toHaveLength(200);
    expect(s.calls).toHaveLength(4);
  });

  it.each([
    { status: 1, stdout: "", stderr: "authentication required\nmore detail" },
    { status: null, stdout: "", stderr: "", error: new Error("timed out") },
    { status: 0, stdout: "not json", stderr: "" },
    ok({ head: { sha: "abc" }, base: {} }),
    ok({ head: { sha: "abc" }, base: { ref: "main" }, state: "open" }),
  ])("throws a named transport failure for failed or malformed head reads", (result) => {
    const source = createGateSources({ ...config, run: stub([result]).run });
    let error: unknown;
    try {
      source.head();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(TransportFailure);
    expect(error).toMatchObject({ call: "head" });
    expect((error as Error).message).toMatch(/^head: [^\n]+$/);
  });

  it("preserves gh's first stderr line", () => {
    const run = stub([{ status: 1, stdout: "", stderr: "unauthenticated\nsecond" }]).run;
    expect(() => createGateSources({ ...config, run }).checks("abc")).toThrow("checks: unauthenticated");
  });

  it("rejects missing or wrongly typed fields instead of passing", () => {
    for (const [method, value] of [
      ["botReviews", [{ ...review, commit_id: undefined }]],
      ["botReviews", [{ ...review, state: undefined }]],
      ["botReviews", [{ ...review, user: undefined }]],
      ["botComments", [{ user, body: 3, created_at: "a", updated_at: "b" }]],
      ["botReactions", [{ user, content: "+1" }]],
      ["checks", { check_runs: [{ name: "ci", status: "completed" }] }],
      ["firstSuiteAt", { check_suites: [{}] }],
      ["threads", { data: { repository: { pullRequest: null } } }],
    ] as const) {
      expect(() => createGateSources({ ...config, run: stub([ok(value)]).run })[method]("abc")).toThrow(new RegExp(`^${method}:`));
    }
  });

  it("fails at the 50-page cap for REST and GraphQL", () => {
    const s = stub(Array.from({ length: 50 }, () => ok(Array.from({ length: 100 }, () => review))));
    expect(() => createGateSources({ ...config, run: s.run }).botReviews()).toThrow(/botReviews:.*50/);
    expect(s.calls).toHaveLength(50);
    const t = stub(Array.from({ length: 50 }, (_, i) => threadPage([thread(String(i))], true, String(i))));
    expect(() => createGateSources({ ...config, run: t.run }).threads()).toThrow(/threads:.*50/);
    expect(t.calls).toHaveLength(50);
  });
});

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A temporary repository on `main` with one seed commit, and the sources over it. */
function repo() {
  const cwd = mkdtempSync(join(tmpdir(), "gate-sources-"));
  dirs.push(cwd);
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[key as keyof typeof env];
  const run = (args: string[]) => spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", env });
  const git = (...args: string[]) => {
    const r = run(args);
    if (r.status !== 0) throw new Error(`${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  /** A git command expected to exit non-zero, as a conflicting merge does: its exit status. */
  const gitStatus = (...args: string[]) => run(args).status;
  const write = (path: string, body: string | Buffer) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), body);
  };
  const commit = (message: string) => {
    git("add", ".");
    git("commit", "-m", message);
    return git("rev-parse", "HEAD");
  };
  git("init", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.autocrlf", "false");
  write("seed", "base\n");
  const base = commit("base");
  return { cwd, git, gitStatus, write, commit, base, sources: createGateSources({ ...config, checkout: cwd }) };
}

describe("git sources in temporary repositories", () => {
  it("reads ancestry, missing commits, merge-base and first-parent order", () => {
    const r = repo();
    r.write("src/a", "a\n");
    const one = r.commit("one");
    r.write("src/a", "a\nb\n");
    const two = r.commit("two");
    expect(r.sources.hasCommit(one)).toBe(true);
    expect(r.sources.hasCommit("f".repeat(40))).toBe(false);
    expect(r.sources.isAncestor(one, two)).toBe(true);
    expect(r.sources.isAncestor(two, one)).toBe(false);
    expect(r.sources.mergeBase(one, two)).toBe(one);
    expect(r.sources.firstParentChain(r.base, two)).toEqual([{ sha: one, parents: [r.base] }, { sha: two, parents: [one] }]);
    r.git("checkout", "--orphan", "unrelated");
    r.git("rm", "-rf", ".");
    r.write("other", "other\n");
    const other = r.commit("unrelated");
    expect(r.sources.mergeBase(one, other)).toBeNull();
  });

  it("pins git config and attributes across a rename and resolved merge", () => {
    const r = repo();
    r.write(".gitattributes", "*.txt diff=lossy\n");
    r.write("src/original.txt", "one\ntwo\nthree\n");
    r.write("src/second.txt", "alpha\nbeta\ngamma\n");
    const start = r.commit("original");
    r.git("checkout", "-b", "feature");
    r.git("mv", "src/original.txt", "src/renamed.txt");
    r.write("src/renamed.txt", "one\ntwo\nthree\nfour\n");
    r.git("mv", "src/second.txt", "src/moved.txt");
    r.write("src/moved.txt", "alpha\nbeta\ngamma\ndelta\n");
    const rename = r.commit("rename");
    r.write("seed", "feature\n");
    r.commit("feature");
    r.git("checkout", "main");
    r.write("seed", "main\n");
    const main = r.commit("main");
    r.git("checkout", "feature");
    expect(r.gitStatus("merge", "main")).toBe(1);
    r.write("seed", "resolved\n");
    const merge = r.commit("resolve");
    const answers = () => ({
      numstat: r.sources.numstat(start, merge),
      remergeNumstat: r.sources.remergeNumstat(merge),
      nonTestLines: r.sources.nonTestLines(start, merge, main),
      patchId: r.sources.patchId(start, merge),
    });
    const clean = answers();
    expect(clean.numstat.find((c: { sha: string }) => c.sha === rename).files).toEqual([
      { path: "src/moved.txt", oldPath: "src/second.txt", added: 1, deleted: 0 },
      { path: "src/renamed.txt", oldPath: "src/original.txt", added: 1, deleted: 0 },
    ]);
    expect(clean.remergeNumstat).toEqual([{ path: "seed", oldPath: null, added: 1, deleted: 5 }]);
    const attributesDir = mkdtempSync(join(tmpdir(), "gate-global-attributes-"));
    dirs.push(attributesDir);
    const attributes = join(attributesDir, "attributes");
    writeFileSync(attributes, "* -diff\n");
    for (const [key, value] of Object.entries({
      "core.attributesFile": attributes,
      "diff.context": "0",
      "diff.interHunkContext": "5",
      "diff.indentHeuristic": "false",
      "diff.suppressBlankEmpty": "true",
      "diff.renameLimit": "1",
      "merge.renameLimit": "1",
      "diff.ignoreSubmodules": "all",
      "diff.submodule": "log",
      "diff.renames": "false",
      "diff.algorithm": "histogram",
      "merge.conflictStyle": "diff3",
      "log.showSignature": "true",
      "color.ui": "always",
      "diff.noprefix": "true",
      "diff.mnemonicPrefix": "true",
      "diff.relative": "true",
      "core.quotePath": "false",
      "diff.external": "/usr/bin/true",
      "diff.lossy.textconv": "sed s/./x/g",
    })) r.git("config", key, value);
    const saved = process.env.GIT_DIFF_OPTS;
    try {
      process.env.GIT_DIFF_OPTS = "-u0";
      expect(answers()).toEqual(clean);
    } finally {
      if (saved === undefined) delete process.env.GIT_DIFF_OPTS;
      else process.env.GIT_DIFF_OPTS = saved;
    }
  });

  it.each(["add nested", "delete root", "none"])("reports attributesTouched for %s", (kind) => {
    const r = repo();
    r.write(".gitattributes", "*.txt text\n");
    const start = r.commit("attributes");
    if (kind === "add nested") r.write("src/.gitattributes", "*.js text\n");
    else if (kind === "delete root") r.git("rm", ".gitattributes");
    else r.write("src/a", "code\n");
    const head = r.commit(kind);
    expect(r.sources.nonTestLines(start, head, r.base).attributesTouched).toBe(kind !== "none");
  });

  it("includes gitlink changes despite a committed submodule ignore=all", () => {
    const r = repo();
    r.write(".gitmodules", '[submodule "sub"]\n\tpath = sub\n\turl = ./offline\n\tignore = all\n');
    const start = r.commit("submodule config");
    r.git("update-index", "--add", "--cacheinfo", `160000,${r.base},sub`);
    r.git("commit", "-m", "first pointer");
    const first = r.git("rev-parse", "HEAD");
    r.git("update-index", "--add", "--cacheinfo", `160000,${start},sub`);
    r.git("commit", "-m", "second pointer");
    const second = r.git("rev-parse", "HEAD");
    expect(r.sources.patchId(start, first)).not.toBe(r.sources.patchId(start, second));
    expect(r.sources.numstat(first, second)[0].files).toContainEqual({
      path: "sub",
      oldPath: null,
      added: 1,
      deleted: 1,
    });
  });

  it("preserves non-UTF-8 text bytes in patch IDs", () => {
    const r = repo();
    r.write("text", Buffer.from([0xff, 10]));
    const first = r.commit("first byte");
    r.write("text", Buffer.from([0xfe, 10]));
    const second = r.commit("second byte");
    expect(r.sources.patchId(r.base, first)).not.toBe(r.sources.patchId(r.base, second));
  });

  it("distinguishes patches differing only in binary content", () => {
    const r = repo();
    r.write("binary", Buffer.from([0, 1, 2]));
    const first = r.commit("first binary");
    r.write("binary", Buffer.from([0, 3, 4]));
    const second = r.commit("second binary");
    expect(r.sources.patchId(r.base, first)).not.toBe(r.sources.patchId(r.base, second));
  });

  it("excludes base-branch lines in a clean merge", () => {
    const r = repo();
    r.git("checkout", "-b", "feature");
    r.write("src/a", "a\nb\n");
    const feature = r.commit("feature");
    r.git("checkout", "main");
    r.write("base-file", "base\n".repeat(200));
    r.write(".gitattributes", "*.js text\n");
    const main = r.commit("base update");
    r.git("checkout", "feature");
    r.git("merge", "--no-ff", "main", "-m", "merge base");
    const merge = r.git("rev-parse", "HEAD");
    expect(r.sources.firstParentChain(feature, merge)).toEqual([{ sha: merge, parents: [feature, main] }]);
    expect(r.sources.remergeNumstat(merge)).toEqual([]);
    expect(r.sources.nonTestLines(r.base, merge, main).attributesTouched).toBe(false);
    expect(r.sources.nonTestLines(r.base, merge, main)).toEqual({ total: 2, commits: [{ sha: feature, lines: 2 }, { sha: merge, lines: 0 }], merges: [], binaryPaths: [], attributesTouched: false });
  });

  it("counts an octopus of base ancestors without asking for remerge-diff", () => {
    const r = repo();
    r.git("checkout", "-b", "one");
    r.write("one", "one\n");
    r.commit("one");
    r.git("checkout", "-b", "two", r.base);
    r.write("two", "two\n");
    r.commit("two");
    r.git("checkout", "main");
    r.git("merge", "--no-ff", "one", "two", "-m", "base ancestors");
    const base = r.git("rev-parse", "HEAD");
    r.git("checkout", "-b", "feature", r.base);
    r.write("feature", "feature\n");
    const feature = r.commit("feature");
    r.git("merge", "one", "two", "-m", "octopus");
    const merge = r.git("rev-parse", "HEAD");
    const calls: string[][] = [];
    const run = (cmd: string, args: string[], options: Options) => {
      calls.push(args);
      return spawnSync(cmd, args, { ...options, encoding: "utf8" });
    };
    const sources = createGateSources({ ...config, checkout: r.cwd, run });
    expect(sources.nonTestLines(feature, merge, base)).toMatchObject({
      total: 2,
      merges: [{ sha: merge, lines: 2 }],
    });
    expect(calls.some((args) => args.includes("--remerge-diff"))).toBe(false);
  });

  it("counts a clean side-branch merge that is not from the base", () => {
    const r = repo();
    r.git("checkout", "-b", "side");
    r.write("src/side", "side\n".repeat(100));
    r.commit("side work");
    r.git("checkout", "main");
    r.git("merge", "--no-ff", "side", "-m", "merge side");
    const merge = r.git("rev-parse", "HEAD");
    expect(r.sources.remergeNumstat(merge)).toEqual([]);
    expect(r.sources.nonTestLines(r.base, merge, r.base)).toEqual({
      total: 100,
      commits: [{ sha: merge, lines: 100 }],
      merges: [{ sha: merge, lines: 100 }],
      binaryPaths: [],
      attributesTouched: false,
    });
  });

  it.each(["conflict", "test/conflict", "src/é\tname", "src/a b/name"])("counts a resolution and records a merge touching %s", (path) => {
    const r = repo();
    r.write(path, "start\n");
    const start = r.commit("start");
    r.git("checkout", "-b", "feature");
    r.write(path, "feature\n");
    r.commit("feature");
    r.git("checkout", "main");
    r.write(path, "main\n");
    const main = r.commit("main");
    r.git("checkout", "feature");
    expect(r.gitStatus("merge", "main")).toBe(1);
    r.write(path, "resolved\n");
    const merge = r.commit("resolve");
    expect(r.sources.remergeNumstat(merge)).toEqual([{ path, oldPath: null, added: 1, deleted: 5 }]);
    const isTest = path.startsWith("test/");
    expect(r.sources.nonTestLines(start, merge, main)).toMatchObject({ total: isTest ? 0 : 8, merges: [{ sha: merge, lines: isTest ? 0 : 6 }] });
  });

  it("counts a base merge whose binary-driver conflict has no remerge row", () => {
    const r = repo();
    r.write(".gitattributes", "* merge=binary\n");
    r.write("conflict", "start\n");
    const start = r.commit("start");
    r.git("checkout", "-b", "feature");
    r.write("conflict", "feature\n");
    const feature = r.commit("feature");
    r.git("checkout", "main");
    r.write("conflict", "main\n");
    r.write("base-file", "base\n".repeat(20));
    const main = r.commit("main");
    r.git("checkout", "feature");
    expect(r.gitStatus("merge", "main")).toBe(1);
    const merge = r.commit("keep feature side");
    const patch = r.git("show", "--remerge-diff", "--format=", merge);
    expect(patch).toContain("remerge CONFLICT");
    expect(r.sources.remergeNumstat(merge)).toEqual([]);
    expect(r.sources.nonTestLines(feature, merge, main)).toMatchObject({
      total: 20,
      merges: [{ sha: merge, lines: 20 }],
    });
    expect(r.sources.nonTestLines(start, merge, main).total).toBe(22);
  });

  it("skips binary files and all test patterns, with a case-sensitive class suffix", () => {
    const r = repo();
    for (const path of ["test/a", "Tests/a", "spec/a", "__tests__/a", "a.test.ts", "a-SPEC.js", "test_a.py", "conftest.py", "FooTest.java", "FooTests.kt", "FooSpec.cs"]) {
      r.write(path, "ignored\n");
    }
    r.write("binary", Buffer.from([0, 1, 2]));
    r.write("src/footest.java", "count\n");
    r.write("src/a", "one\ntwo\n");
    const head = r.commit("mixed");
    expect(r.sources.nonTestLines(r.base, head, r.base)).toEqual({ total: 3, commits: [{ sha: head, lines: 3 }], merges: [], binaryPaths: ["binary"], attributesTouched: false });
    expect(r.sources.numstat(r.base, head)[0].files).toContainEqual({ path: "binary", oldPath: null, added: null, deleted: null });
  });

  it("reports attribute-marked binary text without adding its 300 lines", () => {
    const r = repo();
    r.write(".gitattributes", "*.mjs -diff\n");
    const start = r.commit("attributes");
    r.write("src/a.mjs", "code\n".repeat(300));
    const head = r.commit("binary text");
    expect(r.sources.nonTestLines(start, head, r.base)).toEqual({
      total: 0,
      commits: [{ sha: head, lines: 0 }],
      merges: [],
      binaryPaths: ["src/a.mjs"],
      attributesTouched: false,
    });
  });

  it("reports a binary row from a merge in binaryPaths", () => {
    const r = repo();
    r.git("checkout", "-b", "side");
    r.write("binary", Buffer.from([0, 1]));
    r.commit("binary");
    r.git("checkout", "main");
    r.git("merge", "--no-ff", "side", "-m", "side merge");
    const merge = r.git("rev-parse", "HEAD");
    expect(r.sources.nonTestLines(r.base, merge, r.base)).toMatchObject({
      total: 0,
      merges: [{ sha: merge, lines: 0 }],
      binaryPaths: ["binary"],
    });
  });

  it.each(["isAncestor", "mergeBase"])("throws a named %s failure for a real unknown commit", (method) => {
    const r = repo();
    const unknown = "f".repeat(40);
    expect(r.gitStatus("merge-base", ...(method === "isAncestor" ? ["--is-ancestor"] : []), r.base, unknown)).toBe(128);
    expect(() => r.sources[method](r.base, unknown)).toThrow(TransportFailure);
    expect(() => r.sources[method](r.base, unknown)).toThrow(new RegExp(`^${method}:`));
  });

  it("reports binary paths in commit order, de-duplicated", () => {
    const r = repo();
    r.write("z", Buffer.from([0, 1]));
    r.commit("z first");
    r.write("a", Buffer.from([0, 2]));
    r.commit("a second");
    r.write("z", Buffer.from([0, 3]));
    const head = r.commit("z again");
    expect(r.sources.nonTestLines(r.base, head, r.base).binaryPaths).toEqual(["z", "a"]);
  });

  it.each([
    ["src/é.txt", "src/é.test.txt"],
    ["src/plain.txt", "src/é.test.txt"],
    ["src/é.txt", "src/plain.test.txt"],
    ["src/plain.txt", "src/plain.test.txt"],
  ])("reads a rename from %s to %s", (oldPath, newPath) => {
    const r = repo();
    r.write(oldPath, "one\ntwo\nthree\n");
    const base = r.commit("original");
    r.git("mv", oldPath, newPath);
    r.write(newPath, "one\ntwo\nthree\nfour\n");
    const head = r.commit("rename");
    expect(r.sources.numstat(base, head)[0].files).toEqual([{ path: newPath, oldPath, added: 1, deleted: 0 }]);
    expect(r.sources.nonTestLines(base, head, r.base).total).toBe(3);
  });

  it.each([
    ["test/a.test.js", "src/a.js", 200],
    ["src/x.js", "src/y.js", 0],
    ["test/a.test.js", "test/b.test.js", 0],
    ["test/a.test.js", "src/a*.js", 200],
    ["test/a.test.js", "src/:a.js", 200],
  ])("counts a move from %s to %s as %i lines", (oldPath, newPath, lines) => {
    const r = repo();
    r.write(oldPath, "code\n".repeat(200));
    r.write("src/another.js", "other\n".repeat(7));
    const start = r.commit("original");
    r.git("mv", oldPath, newPath);
    r.write("src/another.js", "changed\n".repeat(7));
    const head = r.commit("move");
    expect(r.sources.numstat(start, head)[0].files).toContainEqual({
      path: newPath,
      oldPath,
      added: 0,
      deleted: 0,
    });
    expect(r.sources.nonTestLines(start, head, r.base).total).toBe(lines + 14);
  });

  it("recounts a test-to-source rename in a non-base merge's first-parent diff", () => {
    const r = repo();
    r.write("test/a.test.js", "code\n".repeat(200));
    const start = r.commit("test file");
    r.git("checkout", "-b", "side");
    mkdirSync(join(r.cwd, "src"));
    r.git("mv", "test/a.test.js", "src/a.js");
    r.commit("move");
    r.git("checkout", "main");
    r.git("merge", "--no-ff", "side", "-m", "side merge");
    const merge = r.git("rev-parse", "HEAD");
    expect(r.sources.nonTestLines(start, merge, start)).toMatchObject({
      total: 200,
      merges: [{ sha: merge, lines: 200 }],
    });
  });

  it.each(["src/auth.mjs", "src/auth*.mjs", "src/:auth.mjs"])("counts all 300 old lines moved from %s into tests", (oldPath) => {
    const r = repo();
    r.write(oldPath, "code\n".repeat(300));
    const start = r.commit("source file");
    mkdirSync(join(r.cwd, "test"));
    r.git("mv", oldPath, "test/auth.mjs");
    const head = r.commit("move into tests");
    expect(r.sources.numstat(start, head)[0].files).toEqual([{
      path: "test/auth.mjs",
      oldPath,
      added: 0,
      deleted: 0,
    }]);
    expect(r.sources.nonTestLines(start, head, start)).toMatchObject({
      total: 300,
      commits: [{ sha: head, lines: 300 }],
    });
  });

  it("recounts a source-to-test rename in a non-base merge's first-parent diff", () => {
    const r = repo();
    r.write("src/auth.mjs", "code\n".repeat(300));
    const start = r.commit("source file");
    r.git("checkout", "-b", "side");
    mkdirSync(join(r.cwd, "test"));
    r.git("mv", "src/auth.mjs", "test/auth.mjs");
    r.commit("move into tests");
    r.git("checkout", "main");
    r.git("merge", "--no-ff", "side", "-m", "side merge");
    const merge = r.git("rev-parse", "HEAD");
    expect(r.sources.nonTestLines(start, merge, start)).toMatchObject({
      total: 300,
      merges: [{ sha: merge, lines: 300 }],
    });
  });

  it("recounts a source-to-test rename in a base merge's remerge rows", () => {
    const r = repo();
    const body = Array.from({ length: 299 }, (_, i) => `line ${i}\n`).join("");
    r.write("src/auth.mjs", "start\n" + body);
    r.commit("source file");
    r.git("checkout", "-b", "feature");
    r.write("src/auth.mjs", "feature\n" + body);
    const feature = r.commit("feature");
    r.git("checkout", "main");
    r.write("src/auth.mjs", "main\n" + body);
    const main = r.commit("main");
    r.git("checkout", "feature");
    expect(r.gitStatus("merge", "main")).toBe(1);
    r.git("rm", "src/auth.mjs");
    r.write("test/auth.mjs", "resolved\n" + body);
    const merge = r.commit("resolve and move into tests");
    expect(r.sources.remergeNumstat(merge)).toEqual([{
      path: "test/auth.mjs",
      oldPath: "src/auth.mjs",
      added: 1,
      deleted: 5,
    }]);
    expect(r.sources.nonTestLines(feature, merge, main)).toMatchObject({
      total: 304,
      merges: [{ sha: merge, lines: 304 }],
    });
  });

  it("reports a binary old-path recount when source text moves into tests", () => {
    const r = repo();
    r.write("src/auth.mjs", "code\n".repeat(300));
    const start = r.commit("source file");
    mkdirSync(join(r.cwd, "test"));
    r.git("mv", "src/auth.mjs", "test/auth.mjs");
    const head = r.commit("move into tests");
    expect(r.sources.numstat(start, head)[0].files).toEqual([{
      path: "test/auth.mjs",
      oldPath: "src/auth.mjs",
      added: 0,
      deleted: 0,
    }]);
    /** Run real git except for the old path's binary recount row. */
    const run = (cmd: string, args: string[], options: Options) => {
      if (args.includes("--no-renames")) {
        expect(args.slice(-2)).toEqual(["--", ":(literal)src/auth.mjs"]);
        return {
          status: 0,
          stdout: "-\t-\tsrc/auth.mjs\0",
          stderr: "",
        };
      }
      return spawnSync(cmd, args, { ...options, encoding: "utf8" });
    };
    const sources = createGateSources({ ...config, checkout: r.cwd, run });
    expect(sources.nonTestLines(start, head, start)).toMatchObject({
      total: 0,
      binaryPaths: ["src/auth.mjs"],
    });
  });

  it("recounts a test-to-source rename in a base merge's remerge rows", () => {
    const r = repo();
    const body = Array.from({ length: 199 }, (_, i) => `line ${i}\n`).join("");
    r.write("test/a.test.js", "start\n" + body);
    r.commit("test file");
    r.git("checkout", "-b", "feature");
    r.write("test/a.test.js", "feature\n" + body);
    const feature = r.commit("feature");
    r.git("checkout", "main");
    r.write("test/a.test.js", "main\n" + body);
    const main = r.commit("main");
    r.git("checkout", "feature");
    expect(r.gitStatus("merge", "main")).toBe(1);
    r.git("rm", "test/a.test.js");
    r.write("src/a.js", "resolved\n" + body);
    const merge = r.commit("resolve and move");
    expect(r.sources.remergeNumstat(merge)).toEqual([{
      path: "src/a.js",
      oldPath: "test/a.test.js",
      added: 1,
      deleted: 5,
    }]);
    expect(r.sources.nonTestLines(feature, merge, main)).toMatchObject({
      total: 200,
      merges: [{ sha: merge, lines: 200 }],
    });
  });

  it("reports attributesTouched when a rename removes the attributes filename", () => {
    const r = repo();
    r.write("src/.gitattributes", "*.js text\n");
    const start = r.commit("attributes");
    r.git("mv", "src/.gitattributes", "src/attributes");
    const head = r.commit("rename attributes");
    expect(r.sources.nonTestLines(start, head, start).attributesTouched).toBe(true);
  });

  it("frames empty commits between numstat records", () => {
    const r = repo();
    r.write("a", "one\n");
    const first = r.commit("first");
    r.git("commit", "--allow-empty", "-m", "empty");
    const empty = r.git("rev-parse", "HEAD");
    r.write("b", "two\n");
    const last = r.commit("last");
    expect(r.sources.numstat(r.base, last)).toEqual([
      { sha: last, files: [{ path: "b", oldPath: null, added: 1, deleted: 0 }] },
      { sha: empty, files: [] },
      { sha: first, files: [{ path: "a", oldPath: null, added: 1, deleted: 0 }] },
    ]);
  });

  it.each(["src => test/x.js", "src/line\nbreak.js", "src/tab\tname.js"])("reads a literal numstat path %j", (path) => {
    const r = repo();
    r.write(path, "one\ntwo\n");
    const first = r.commit("first");
    r.write(path, "one\ntwo\nthree\n");
    const second = r.commit("second");
    expect(r.sources.numstat(r.base, second)).toEqual([
      { sha: second, files: [{ path, oldPath: null, added: 1, deleted: 0 }] },
      { sha: first, files: [{ path, oldPath: null, added: 2, deleted: 0 }] },
    ]);
    expect(r.sources.nonTestLines(r.base, second, r.base).total).toBe(3);
  });

  it("rejects a work-tree filename used as patchId's head revision", () => {
    const r = repo();
    r.write("a.txt", "text\n");
    const start = r.commit("file");
    expect(() => r.sources.patchId(start, "a.txt")).toThrow(TransportFailure);
    expect(() => r.sources.patchId(start, "a.txt")).toThrow(/^patchId:/);
  });

  it("credits a rebased multi-commit patch but preserves indentation differences", () => {
    const r = repo();
    r.write("code.py", "if ready:\n    call()\n");
    const base = r.commit("code");
    r.git("checkout", "-b", "feature");
    r.write("code.py", "if ready:\n    changed()\n");
    r.commit("change");
    r.write("extra", "more\n");
    const old = r.commit("extra");
    r.git("checkout", "main");
    r.write("base-only", "base update\n");
    const updatedBase = r.commit("base update");
    r.git("checkout", "feature");
    r.git("rebase", "main");
    const rebased = r.git("rev-parse", "HEAD");
    expect(r.sources.isAncestor(old, rebased)).toBe(false);
    expect(r.sources.patchId(base, old)).toBe(r.sources.patchId(updatedBase, rebased));
    r.write("code.py", "if ready:\nchanged()\n");
    const indentation = r.commit("indentation");
    expect(r.sources.patchId(updatedBase, indentation)).not.toBe(r.sources.patchId(base, old));
    expect(r.sources.patchId(base, base)).toBeNull();
  });
});

describe("git runner contract", () => {
  it.each([
    ["hasCommit", ["sha"]],
    ["isAncestor", ["a", "b"]],
    ["mergeBase", ["a", "b"]],
    ["firstParentChain", ["from", "to"]],
    ["numstat", ["from", "to"]],
    ["remergeNumstat", ["merge"]],
    ["nonTestLines", ["from", "to", "base"]],
    ["patchId", ["base", "head"]],
    ["checks", ["sha"]],
    ["firstSuiteAt", ["sha"]],
  ])("refuses invalid revisions before running %s", (method, names) => {
    let calls = 0;
    const run = () => {
      calls++;
      return { status: 0, stdout: "", stderr: "" };
    };
    const sources = createGateSources({ ...config, run });
    for (const invalid of ["", "--octopus", undefined]) {
      for (let i = 0; i < names.length; i++) {
        const args: (string | undefined)[] = names.map(() => "a".repeat(40));
        args[i] = invalid;
        expect(() => sources[method](...args)).toThrow(new TransportFailure(method, `invalid revision ${invalid}`));
      }
    }
    expect(calls).toBe(0);
  });

  it("resolves a relative checkout once and uses only absolute -C for git", () => {
    const r = repo();
    r.write("src/a", "one\n");
    const head = r.commit("one");
    const calls: { args: string[]; options: Options }[] = [];
    const run = (cmd: string, args: string[], options: Options) => {
      calls.push({ args, options });
      return spawnSync(cmd, args, { ...options, encoding: "utf8" });
    };
    const sources = createGateSources({ ...config, checkout: relative(process.cwd(), r.cwd), run });
    expect(sources.hasCommit(head)).toBe(true);
    expect(sources.numstat(r.base, head)).toEqual(r.sources.numstat(r.base, head));
    for (const call of calls) {
      expect(call.args.slice(0, 2)).toEqual(["-C", r.cwd]);
      expect(call.options).not.toHaveProperty("cwd");
    }
  });

  it("throws hasCommit outside a git repository", () => {
    const checkout = mkdtempSync(join(tmpdir(), "gate-not-repo-"));
    dirs.push(checkout);
    expect(() => createGateSources({ ...config, checkout }).hasCommit("f".repeat(40))).toThrow(/^hasCommit:/);
    try {
      createGateSources({ ...config, checkout }).hasCommit("f".repeat(40));
    } catch (error) {
      expect(error).toBeInstanceOf(TransportFailure);
    }
  });

  it("clears redirecting git variables, supplies -C and pipes the diff as input", () => {
    const calls: { args: string[]; options: Options }[] = [];
    const run = (cmd: string, args: string[], options: Options) => {
      expect(cmd).toBe("git");
      calls.push({ args, options });
      return { status: 0, stdout: args.includes("diff") ? Buffer.from("the diff") : "a".repeat(40) + " 0000\n", stderr: "" };
    };
    const keys = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_DIFF_OPTS", "GIT_EXTERNAL_DIFF"];
    const saved = keys.map((key) => process.env[key]);
    try {
      for (const key of keys) process.env[key] = "hostile";
      createGateSources({ ...config, run }).patchId("base", "head");
    } finally {
      keys.forEach((key, i) => {
        if (saved[i] === undefined) delete process.env[key];
        else process.env[key] = saved[i];
      });
    }
    const prefix = ["-C", "/checkout", ...[
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
    ].flatMap((value) => ["-c", value])];
    expect(calls.map((c) => c.args)).toEqual([
      [...prefix, "diff", "--no-ext-diff", "--no-textconv", "--no-color", "--ignore-submodules=none", "-M", "--binary", "--src-prefix=a/", "--dst-prefix=b/", "base", "head", "--"],
      [...prefix, "patch-id", "--verbatim"],
    ]);
    expect(calls[1]?.options.input).toEqual(Buffer.from("the diff"));
    expect(calls[0]?.options.encoding).toBe("buffer");
    expect(calls[1]?.options.encoding).toBe("utf8");
    for (const call of calls) {
      for (const key of keys) expect(call.options.env).not.toHaveProperty(key);
    }
  });

  it("rejects a string stdout when patchId requested bytes", () => {
    const run = (_cmd: string, args: string[]) => ({
      status: 0,
      stdout: args.includes("diff") ? "a diff" : "a".repeat(40) + " 0000\n",
      stderr: "",
    });
    expect(() => createGateSources({ ...config, run }).patchId("a", "b")).toThrow(new TransportFailure("patchId", "missing or invalid stdout"));
  });

  it.each([
    ["one-sided binary", "-\t1\tx\0", "invalid numstat row"],
    ["unsafe count", "9007199254740992\t0\tx\0", "invalid numstat count"],
    ["bad commit header", "commit:bad\0", "invalid numstat commit header"],
    ["missing rename path", "0\t0\t\0old\0", "invalid numstat rename"],
    ["missing final NUL", "1\t0\tx", "unterminated numstat output"],
  ])("rejects malformed numstat: %s", (name, text, reason) => {
    const stdout = name === "bad commit header" ? text : `commit:${"a".repeat(40)}\0\n${text}`;
    const run = () => ({ status: 0, stdout, stderr: "" });
    expect(() => createGateSources({ ...config, run }).numstat("a", "b")).toThrow(TransportFailure);
    expect(() => createGateSources({ ...config, run }).numstat("a", "b")).toThrow(new TransportFailure("numstat", reason));
  });

  it("rejects an invalid patch-id answer", () => {
    const run = (_cmd: string, args: string[]) => ({
      status: 0,
      stdout: args.includes("diff") ? Buffer.from("a diff") : "not a patch ID",
      stderr: Buffer.from(""),
    });
    expect(() => createGateSources({ ...config, run }).patchId("a", "b")).toThrow(new TransportFailure("patchId", "invalid patch-id answer"));
  });

  it("rejects mergeBase exit 1 with stdout", () => {
    const run = () => ({ status: 1, stdout: "a".repeat(40), stderr: "" });
    expect(() => createGateSources({ ...config, run }).mergeBase("a", "b")).toThrow(new TransportFailure("mergeBase", "invalid merge-base answer"));
  });

  it.each([
    ["remerge CONFLICT (content): Merge conflict in unknown\n"],
    ["diff --git a/known b/known\nremerge CONFLICT (content): Merge conflict in known\ndiff --git a/hidden b/hidden\nremerge CONFLICT (content): Merge conflict in hidden\n"],
  ])("falls back when a conflict notice has no matching row: %j", (patch) => {
    const sha = "a".repeat(40);
    const parent = "b".repeat(40);
    const base = "c".repeat(40);
    const run = (_cmd: string, args: string[]) => {
      let stdout = "";
      if (args.includes("rev-list")) stdout = `${sha} ${parent} ${base}\n`;
      else if (args.includes("show")) stdout = args.includes("--patch") ? patch : "1\t0\tknown\0";
      else if (args.includes("diff")) stdout = "7\t0\timported\0";
      return { status: 0, stdout, stderr: "" };
    };
    expect(createGateSources({ ...config, run }).nonTestLines(parent, sha, base)).toMatchObject({
      total: 7,
      merges: [{ sha, lines: 7 }],
    });
  });

  it.each([
    [128, "fatal: unreadable", "patchId: fatal: unreadable"],
    [129, "error: unknown option", "patchId: git 2.39 or newer is required (git patch-id --verbatim)"],
  ])("checks buffered stderr and stdout on exit %i", (status, stderr, reason) => {
    const run = () => ({ status, stdout: Buffer.alloc(0), stderr: Buffer.from(stderr) });
    expect(() => createGateSources({ ...config, run }).patchId("a", "b")).toThrow(reason);
  });

  it("recognises old patch-id's usage-only exit 129", () => {
    const run = (_cmd: string, args: string[]) => args.includes("diff")
      ? { status: 0, stdout: Buffer.from("a diff"), stderr: "" }
      : { status: 129, stdout: "", stderr: "usage: git patch-id [--stable | --unstable]\n" };
    expect(() => createGateSources({ ...config, run }).patchId("a", "b")).toThrow(
      "patchId: git 2.39 or newer is required (git patch-id --verbatim)",
    );
  });

  it("recognises unrecognized arguments on remergeNumstat", () => {
    const run = () => ({ status: 128, stdout: "", stderr: "fatal: unrecognized argument: --remerge-diff\n" });
    expect(() => createGateSources({ ...config, run }).remergeNumstat("a")).toThrow(
      "remergeNumstat: git 2.39 or newer is required (git patch-id --verbatim)",
    );
  });

  it("names the git floor when any git call reports an unknown option", () => {
    const run = (_cmd: string, args: string[]) =>
      args.includes("diff") ? { status: 0, stdout: Buffer.from("a diff"), stderr: "" } : { status: 129, stdout: "", stderr: "error: unknown option `verbatim'" };
    expect(() => createGateSources({ ...config, run }).patchId("a", "b")).toThrow(/patchId: git 2.39 or newer is required/);
    expect(() => createGateSources({ ...config, run }).hasCommit("a")).toThrow(TransportFailure);
  });

  it("distinguishes transport failures from defined negative git answers", () => {
    const run = () => ({ status: 2, stdout: "", stderr: "fatal: cannot read" });
    expect(() => createGateSources({ ...config, run }).isAncestor("a", "b")).toThrow(/isAncestor: fatal: cannot read/);
    const timeout = () => ({ status: null, stdout: "", stderr: "", error: new Error("timed out") });
    expect(() => createGateSources({ ...config, run: timeout }).hasCommit("a")).toThrow(/hasCommit: timed out/);
    const malformed = () => ({ status: 0, stdout: "not numstat", stderr: "" });
    expect(() => createGateSources({ ...config, run: malformed }).remergeNumstat("a")).toThrow(/remergeNumstat:/);
  });
});

it("imports from a standalone install with no node_modules", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-install-"));
  dirs.push(dir);
  const file = join(dir, "gate-sources.mjs");
  copyFileSync(join(__dirname, "../skills/supervision-setup/scripts/gate-sources.mjs"), file);
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(pathToFileURL(file).href)})`], { cwd: dir, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
});
