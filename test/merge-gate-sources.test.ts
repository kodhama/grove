/** Gate sources use stubbed gh responses and disposable, offline git repositories. */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error -- no type declarations for this .mjs script
import { createGateSources, TransportFailure } from "../skills/supervision-setup/scripts/gate-sources.mjs";

type Result = { status: number | null; stdout: string; stderr: string; error?: Error };
type Options = { cwd?: string; input?: string; env?: NodeJS.ProcessEnv };
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
    const s = stub([ok({ head: { sha: "abc" }, base: { ref: "main" }, state: "open" })]);
    expect(createGateSources({ ...config, run: s.run }).head()).toEqual({ sha: "abc", baseRef: "main", state: "open" });
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
      ok({ check_suites: Array.from({ length: 100 }, () => ({ created_at: "2026-11-09T12:00:00Z" })) }),
      ok({ check_suites: [{ created_at: "2026-11-08T12:00:00Z" }] }),
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

  it("excludes base-branch lines in a clean merge", () => {
    const r = repo();
    r.git("checkout", "-b", "feature");
    r.write("src/a", "a\nb\n");
    const feature = r.commit("feature");
    r.git("checkout", "main");
    r.write("base-file", "base\n".repeat(200));
    const main = r.commit("base update");
    r.git("checkout", "feature");
    r.git("merge", "--no-ff", "main", "-m", "merge base");
    const merge = r.git("rev-parse", "HEAD");
    expect(r.sources.firstParentChain(feature, merge)).toEqual([{ sha: merge, parents: [feature, main] }]);
    expect(r.sources.remergeNumstat(merge)).toEqual([]);
    expect(r.sources.nonTestLines(r.base, merge)).toEqual({ total: 2, commits: [{ sha: feature, lines: 2 }, { sha: merge, lines: 0 }], merges: [] });
  });

  it.each(["conflict", "test/conflict"])("counts a resolution and records a merge touching %s", (path) => {
    const r = repo();
    r.write(path, "start\n");
    const start = r.commit("start");
    r.git("checkout", "-b", "feature");
    r.write(path, "feature\n");
    r.commit("feature");
    r.git("checkout", "main");
    r.write(path, "main\n");
    r.commit("main");
    r.git("checkout", "feature");
    expect(r.gitStatus("merge", "main")).toBe(1);
    r.write(path, "resolved\n");
    const merge = r.commit("resolve");
    expect(r.sources.remergeNumstat(merge)).toEqual([{ path, added: 1, deleted: 5 }]);
    const isTest = path.startsWith("test/");
    expect(r.sources.nonTestLines(start, merge)).toMatchObject({ total: isTest ? 0 : 8, merges: [{ sha: merge, lines: isTest ? 0 : 6 }] });
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
    expect(r.sources.nonTestLines(r.base, head)).toEqual({ total: 3, commits: [{ sha: head, lines: 3 }], merges: [] });
    expect(r.sources.numstat(r.base, head)[0].files).toContainEqual({ path: "binary", added: null, deleted: null });
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
    expect(r.sources.numstat(base, head)[0].files).toEqual([{ path: newPath, added: 1, deleted: 0 }]);
    expect(r.sources.nonTestLines(base, head).total).toBe(0);
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
  it("clears redirecting git variables, supplies -C and pipes the diff as input", () => {
    const calls: { args: string[]; options: Options }[] = [];
    const run = (cmd: string, args: string[], options: Options) => {
      expect(cmd).toBe("git");
      calls.push({ args, options });
      return { status: 0, stdout: args.includes("diff") ? "the diff" : "a".repeat(40) + " 0000\n", stderr: "" };
    };
    createGateSources({ ...config, run }).patchId("base", "head");
    expect(calls.map((c) => c.args)).toEqual([["-C", "/checkout", "diff", "base", "head"], ["-C", "/checkout", "patch-id", "--verbatim"]]);
    expect(calls[1]?.options.input).toBe("the diff");
    for (const call of calls) {
      for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) expect(call.options.env).not.toHaveProperty(key);
    }
  });

  it("names the git floor when any git call reports an unknown option", () => {
    const run = (_cmd: string, args: string[]) =>
      args.includes("diff") ? { status: 0, stdout: "a diff", stderr: "" } : { status: 129, stdout: "", stderr: "error: unknown option `verbatim'" };
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
