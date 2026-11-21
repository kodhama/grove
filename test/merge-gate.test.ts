/** The gate judges real temporary git histories and path-keyed, offline gh answers. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error -- no type declarations for this .mjs script
import { createGateSources, defaultRunner } from "../skills/supervision-setup/scripts/gate-sources.mjs";
// @ts-expect-error -- no type declarations for this .mjs script
import { main } from "../skills/supervision-setup/scripts/merge-gate-checks.mjs";
// @ts-expect-error -- no type declarations for this .mjs script
import { reviewCoverage } from "../skills/supervision-setup/scripts/review-coverage.mjs";

type Row = Record<string, any>;
type Fixture = { head: Row; checks: Row[]; statuses: Row[]; threads: Row[]; reviews: Row[]; comments: Row[]; reactions: Row[]; suites: Row[] };
type Options = { cwd?: string; input?: string | Buffer; env?: NodeJS.ProcessEnv; encoding?: "utf8" | "buffer" };
const FIXTURES = "test/fixtures/supervision/merge-gate";
const ALL_HOLD = readFileSync(`${FIXTURES}/all-hold.json`, "utf8");
const OTHER = "a".repeat(40);
const dirs: string[] = [];
let checkout: ReturnType<typeof repository>;
let head: string;

/** Make a disposable repository; all index writes in these tests stay here. */
function repository() {
  const cwd = mkdtempSync(join(tmpdir(), "merge-gate-"));
  dirs.push(cwd);
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[key as keyof typeof env];
  const git = (...args: string[]) => {
    const result = spawnSync("/usr/bin/git", ["-C", cwd, ...args], { encoding: "utf8", env });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  const commit = (name: string) => {
    git("add", ".");
    git("commit", "-m", name);
    return git("rev-parse", "HEAD");
  };
  git("init", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "commit.gpgsign", "false");
  writeFileSync(join(cwd, "seed"), "base\n");
  const base = commit("base");
  return { cwd, git, commit, base };
}

beforeAll(() => {
  checkout = repository();
  writeFileSync(join(checkout.cwd, "seed"), "base\nhead\n");
  head = checkout.commit("head");
});
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** Fresh gh answers whose commit identities come from the temporary repository. */
function fixture(sha = head, base = checkout.base): Fixture {
  return JSON.parse(ALL_HOLD.replaceAll("@HEAD@", sha).replaceAll("@BASE@", base));
}

/** An unedited GraphQL comment, including deleted and malformed account cases. */
function comment(body: string, user: Row | null = { login: "review-bot", type: "Bot" }): Row {
  return { author: user === null ? null : { login: user.login, __typename: user.type }, body, createdAt: "then",
    lastEditedAt: null, editor: null, userContentEdits: { totalCount: 0, nodes: [] } };
}

const REVIEW_SKILL = "compound-engineering:ce-code-review";
const READ_SCRIPT = resolve("skills/supervision-setup/scripts/review-read.mjs");
const WORKER_TABLE = resolve("skills/story-worker/routing.toml");
const LEAD_TABLE = resolve("skills/project-lead/routing.toml");
const GIT_ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
type Listed = { session_id: string; path: string };
/** One fresh reviewer: its read command's three values, then its review call at minute `minute`. */
type Reviewer = {
  head: string; base: string; minute: number; status?: number; args?: string | null; skill?: string;
  fork?: boolean; script?: string; checkout?: string; timed?: boolean;
  /** For a fork: the index of the reviewer in the same session it forked from, else it forked from the main session. */
  parent?: number;
  /** For a fork: the sidecar to write in place of the default fork sidecar. */
  sidecar?: Row;
};
let sessionCount = 0;

/** A disposable folder removed after the suite. */
function scratch(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

/** A synthetic session id, unique within the run. */
function nextSession() {
  sessionCount += 1;
  return `4e440000-0000-4000-8000-${String(sessionCount).padStart(12, "0")}`;
}

/**
 * A listed session whose subagents each run the read command, then the review,
 * as Claude Code records them. A fork replays its parent's Agent call first.
 */
function reviewSession(reviewers: Reviewer[], id = nextSession()): Listed {
  const dir = scratch("merge-gate-session-");
  const path = join(dir, `${id}.jsonl`);
  writeFileSync(path, "");
  const folder = join(dir, id, "subagents");
  mkdirSync(folder, { recursive: true });
  reviewers.forEach((r, i) => {
    const time = (second: number) => r.timed === false ? {} : { timestamp: `2026-11-14T10:${String(r.minute).padStart(2, "0")}:0${second}.000Z` };
    const record = (type: string, second: number, content: unknown[]) =>
      ({ type, sessionId: id, ...time(second), message: { ...(type === "assistant" ? { model: "claude-opus-5-5" } : {}), content } });
    const line = `node ${r.script ?? READ_SCRIPT} --checkout ${r.checkout ?? "/Users/maintainer/work/repo"} --from ${r.base}`;
    const input = r.args === null ? { skill: r.skill ?? REVIEW_SKILL } : { skill: r.skill ?? REVIEW_SKILL, args: r.args ?? `base:${r.base}` };
    const lines = [
      ...(r.fork ? [{ type: "assistant", message: { content: [{ type: "tool_use", name: "Agent", id: "toolu_parent", input: {} }] } }] : []),
      record("assistant", 0, [{ type: "tool_use", id: `toolu_${i}_read`, name: "Bash", input: { command: line } }]),
      record("user", 1, [{ type: "tool_result", tool_use_id: `toolu_${i}_read`, content: `head ${r.head}\nstatus ${r.status ?? 0}\nbase ${r.base}\n`, is_error: false }]),
      record("assistant", 2, [{ type: "tool_use", id: `toolu_${i}_review`, name: "Skill", input }]),
      record("user", 3, [{ type: "tool_result", tool_use_id: `toolu_${i}_review`, content: "Launching skill", is_error: false }]),
    ];
    writeFileSync(join(folder, `agent-r${i}.jsonl`), lines.map((value) => JSON.stringify(value)).join("\n") + "\n");
    const forked = { agentType: "fork", isFork: true, toolUseId: "toolu_parent", ...(r.parent === undefined ? {} : { parentAgentId: `r${r.parent}` }) };
    writeFileSync(join(folder, `agent-r${i}.meta.json`), JSON.stringify(r.fork
      ? r.sidecar ?? forked
      : { agentType: "general-purpose", description: "review" }));
  });
  return { session_id: id, path };
}

/** A worker's or a lead's bindings file listing these transcripts, its review bound to the review skill unless by fallback. */
function bindingsFile(role: "worker" | "lead", transcripts: Listed[], { fallback = false, table }: { fallback?: boolean; table?: string } = {}) {
  const skill = role === "lead" ? "project-lead" : "story-worker";
  const op = (id: string, native: string | null, suggested: string[]) => ({
    table: skill, id, required: false, suggested, suggested_by: "skill", how_bound: native ? "check" : "fallback",
    kind: native ? "skill" : "instructions", native_id: native, source: native ? "plugin fixture" : null, invoke: "fixture", evidence: "fixture",
  });
  const operations = role === "lead"
    ? [op("review-before-merge", REVIEW_SKILL, ["ce-code-review"])]
    : [op("review", fallback ? null : REVIEW_SKILL, ["ce-code-review", "code-review"]), op("doc-review", "compound-engineering:ce-doc-review", ["ce-doc-review"])];
  const path = join(scratch("merge-gate-bindings-"), "bindings.json");
  writeFileSync(path, JSON.stringify({ skill, session: "fixture", table: { path: table ?? (role === "lead" ? LEAD_TABLE : WORKER_TABLE) }, transcripts, operations }));
  return path;
}

const passing = new Map<string, string>();
/** A worker's bindings whose one fresh full review read this head from its root commit. */
function passingBindings(sha: string, cwd: string) {
  const key = `${cwd}\0${sha}`;
  if (!passing.has(key)) {
    const root = spawnSync("/usr/bin/git", ["-C", cwd, "rev-list", "--max-parents=0", sha], { encoding: "utf8", env: GIT_ENV }).stdout.trim();
    passing.set(key, bindingsFile("worker", [reviewSession([{ head: sha, base: root, minute: 0 }])]));
  }
  return passing.get(key)!;
}

/** The required arguments for a head in a checkout, with a full review of that head. */
function required(sha = head, cwd = checkout.cwd) {
  return ["--pr", "owner/repo#44", "--head", sha, "--bindings", passingBindings(sha, cwd), "--checkout", cwd];
}

/** Whether a run read bot comments, which go through the GraphQL comments query. */
function readsComments(calls: string[][]) {
  return calls.some((args) => args.some((arg) => arg.includes("comments(first: 100, after:")));
}

/** Answer by request path, never by call order; git delegates to the real source runner. */
function runner(data: Fixture, failure: string | null = null, failPath: string | null = null, sha = head) {
  const calls: string[][] = [];
  return {
    calls,
    run(cmd: string, args: string[], options: Options) {
      calls.push(args);
      if (cmd === "git") return failPath === "git" ? { status: 2, stdout: "", stderr: failure } : defaultRunner(cmd, args, options);
      if (cmd !== "gh") throw new Error(`unexpected command ${cmd}`);
      const commentQuery = args.some((arg) => arg.includes("comments(first: 100, after:"));
      if (failure && (failPath === null || (failPath.startsWith("repos/") ? args[1] === failPath : (failPath === "botComments" ? commentQuery : args[1]?.includes(failPath))))) return { status: 1, stdout: "", stderr: failure };
      const path = args[1]!;
      let value: unknown;
      if (path === "graphql") {
        const second = args.includes("cursor=next");
        const key = commentQuery ? "comments" : "reviewThreads";
        const rows = key === "comments" ? data.comments : data.threads;
        const split = rows.some((row) => row.page === 2);
        const nodes = rows.filter((row) => (row.page === 2) === second);
        value = { data: { repository: { pullRequest: { [key]: {
          nodes, pageInfo: { hasNextPage: split && !second, endCursor: split && !second ? "next" : null },
        } } } } };
      } else if (path === "repos/owner/repo/pulls/44") value = data.head;
      else if (path.startsWith(`repos/owner/repo/commits/${sha}/check-runs?`)) value = { check_runs: data.checks };
      else if (path.startsWith(`repos/owner/repo/commits/${sha}/status?`)) value = { statuses: data.statuses };
      else if (path.startsWith(`repos/owner/repo/commits/${sha}/check-suites?`)) value = { check_suites: data.suites };
      else if (/\/reviews\?/.test(path)) value = data.reviews;
      else if (/\/reactions\?/.test(path)) value = data.reactions;
      else throw new Error(`unexpected gh path ${path}`);
      return { status: 0, stdout: JSON.stringify(value), stderr: "" };
    },
  };
}

/** Invoke the public entry point with captured streams and no real gh process. */
async function gate(data = fixture(), extra: string[] = [], config: { argv?: string[]; failure?: string; failPath?: string; cwd?: string; sha?: string } = {}) {
  const source = runner(data, config.failure ?? null, config.failPath ?? null, config.sha);
  let stdout = "";
  let stderr = "";
  const args = config.argv ?? [...required(config.sha, config.cwd), "--bot", "review-bot", ...extra];
  const code = main(args, { run: source.run, stdout: { write: (s: string) => { stdout += s; } }, stderr: { write: (s: string) => { stderr += s; } } });
  return { code, stdout, stderr, calls: source.calls };
}

/** Save receipt evidence in a disposable directory. */
function receipt(body: string) {
  const path = join(checkout.cwd, "receipt.md");
  writeFileSync(path, body);
  return path;
}

describe("merge gate shell", () => {
  it("incomplete coverage never exits 0", async () => {
    const r = await gate();
    expect(r.code).toBe(2);
    expect(r.stderr).toBe("");
    expect(r.stdout.split("\n")).toContain(`review: pass full review read ${head}`);
    expect(r.stdout.split("\n")).toContain(`coverage: pass ${head}..${head} covered by 0 re-checks; 0 non-test lines since the full review`);
    expect(r.stdout.split("\n")).toContain("doc review: not checked (not built yet)");
    expect(r.stdout).not.toContain("review coverage:");
    expect(r.stdout).toContain(`blocked ${head}: 0 failed, 1 not checked\n`);
    expect(r.stdout).not.toMatch(/^ok /m);
    expect(r.stdout).toContain(`head: pass ${head} is the live head`);
    expect(r.stdout).toContain(`ci: pass 2 checks passed on ${head}`);
    expect(r.stdout).toContain('bot "review-bot": pass');
    expect(r.calls.filter((c) => c[1] === "repos/owner/repo/pulls/44")).toHaveLength(1);
    expect(r.calls.some((c) => /reactions|check-suites/.test(c[1]!))).toBe(false);
    expect(readsComments(r.calls)).toBe(false);
  });

  it("G7.1 a failing condition plus coverage not checked exits 1", async () => {
    const data = fixture(); data.checks[0]!.conclusion = "failure";
    const r = await gate(data);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("doc review: not checked (not built yet)");
    expect(r.stdout).toContain(`blocked ${head}: 1 failed, 1 not checked`);
  });

  it("G7.1 help alongside a pull request is an argument error", async () => {
    const r = await gate(fixture(), [], { argv: ["--help", "--pr", "owner/repo#44"] });
    expect(r.code).toBe(2); expect(r.stdout).toBe(""); expect(r.calls).toHaveLength(0);
  });

  it("AE4: a moved live head fails the head line", async () => {
    const data = fixture(); data.head.head.sha = OTHER;
    const r = await gate(data);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`head: fail --head ${head} is not the live head ${OTHER}`);
    expect(r.calls.some((c) => c[1]?.includes(`/commits/${head}/`))).toBe(true);
    expect(r.calls.some((c) => c[1]?.includes(`/commits/${OTHER}/`))).toBe(false);
  });

  it("G7.3 mismatching receipt shipped revision fails", async () => {
    const path = receipt(readFileSync(`${FIXTURES}/receipt.md`, "utf8").replace("@BASE@", checkout.base));
    const r = await gate(fixture(), ["--receipt", path]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`is not the receipt's shipped revision ${checkout.base}`);
  });

  it.each(["no revision", "Shipped revision:", "Shipped revision: not-hex", "Shipped revision: abc123", `Shipped revision: ${"a".repeat(41)}`, "Shipped revision: @HEAD@\nShipped revision: @HEAD@"])("G7.3 malformed receipt fails: %s", async (body) => {
    const r = await gate(fixture(), ["--receipt", receipt(body.replaceAll("@HEAD@", head))]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("head: fail the receipt has no single Shipped revision line with a 7 to 40 character hex sha");
  });

  it.each([7, 10, 39, 40])("receipt accepts a case-insensitive %i-character head prefix", async (length) => {
    const revision = head.slice(0, length).toUpperCase();
    const r = await gate(fixture(), ["--receipt", receipt(`Shipped revision: ${revision}\n`)]);
    expect(r.stdout).toContain(`head: pass ${head} is the live head and the receipt's shipped revision`);
    expect(r.code).toBe(2);
  });

  it("receipt rejects a short revision that is not a head prefix", async () => {
    const revision = `${head[0] === "a" ? "b" : "a"}${head.slice(1, 7)}`;
    const r = await gate(fixture(), ["--receipt", receipt(`Shipped revision: ${revision}\n`)]);
    expect(r.stdout).toContain(`head: fail --head ${head} is not the receipt's shipped revision ${revision}`);
    expect(r.code).toBe(1);
  });

  it.each(["folder", "missing"])("G7.3 unreadable receipt %s fails before any process", async (kind) => {
    const r = await gate(fixture(), ["--receipt", kind === "folder" ? checkout.cwd : join(checkout.cwd, "missing")]);
    expect(r.code).toBe(2); expect(r.stdout).toBe(""); expect(r.calls).toHaveLength(0);
  });

  it("matching receipt accepts leading spaces and trailing text", async () => {
    const r = await gate(fixture(), ["--receipt", receipt(`  Shipped revision: ${head} shipped\n`)]);
    expect(r.code).toBe(2); expect(r.stdout).toContain(`head: pass ${head} is the live head and the receipt's shipped revision`);
  });

  it("receipt mismatch still fails when the live head cannot be read", async () => {
    const r = await gate(fixture(), ["--receipt", receipt(`Shipped revision: ${OTHER}\n`)], { failure: "head failed", failPath: "repos/owner/repo/pulls/44" });
    expect(r.stdout).toContain(`head: fail --head ${head} is not the receipt's shipped revision ${OTHER}`);
    expect(r.stdout).toContain('could not check (head: head failed)');
    expect(r.stdout).toContain('attributes: could not check (needs the live base)');
    expect(r.code).toBe(1);
  });

  it.each(["head", "base"])("G7.4 malformed live %s sha cannot be checked", async (key) => {
    const data = fixture(); data.head[key].sha = "f".repeat(39);
    const r = await gate(data);
    expect(r.code).toBe(2); expect(r.stdout).toContain("head: could not check (head: invalid sha from gh)");
    expect(r.stdout).toContain("attributes: could not check (needs the live base)");
  });

  it.each(["closed", "merged"])("pull request state: %s", async (state) => {
    const data = fixture(); data.head.state = "closed";
    data.head.merged_at = state === "merged" ? "2026-11-13T10:00:00Z" : null;
    const r = await gate(data); expect(r.code).toBe(1); expect(r.stdout).toContain(`head: fail the pull request is ${state}`);
    if (state === "merged") expect(r.stdout).not.toContain("the pull request is closed");
  });

  it.each([
    ["no checks", [], "no checks reported"],
    ["null conclusion", [{ name: "test", status: "completed", conclusion: null }], '"test" completed with no conclusion'],
    ["running", [{ name: "test", status: "in_progress", conclusion: null }], '"test" still running'],
    ["all skipped", [{ name: "test", status: "completed", conclusion: "skipped" }], "no check concluded success"],
    ["all neutral", [{ name: "test", status: "completed", conclusion: "neutral" }], "no check concluded success"],
  ] as const)("G7.6 CI fails %s", async (_name, checks, reason) => {
    const data = fixture(); data.checks = checks.map((check) => ({ ...check }));
    const r = await gate(data); expect(r.code).toBe(1); expect(r.stdout).toContain(`ci: fail ${reason}`);
  });

  it.each(["cancelled", "timed_out", "action_required", "stale", "startup_failure"])("CI terminal failure: %s", async (conclusion) => {
    const data = fixture(); data.checks[0]!.conclusion = conclusion;
    const r = await gate(data);
    expect(r.stdout).toContain(`ci: fail "tests" ${conclusion}`);
    expect(r.code).toBe(1);
  });

  it.each(["error", "failure"])("CI legacy failure: %s", async (state) => {
    const data = fixture(); data.statuses = [{ context: "old", state }];
    const r = await gate(data);
    expect(r.stdout).toContain(`ci: fail "old" ${state}`);
    expect(r.code).toBe(1);
  });

  it.each(["check-runs", "status", "check-suites"])("stub rejects an unpinned commit endpoint: %s", (endpoint) => {
    const source = runner(fixture());
    expect(() => source.run("gh", ["api", `repos/owner/repo/commits/${OTHER}/${endpoint}?per_page=100&page=1`], {})).toThrow("unexpected gh path");
  });

  it("G7.6 neutral and skipped pass beside at least one success", async () => {
    const data = fixture(); data.checks = ["success", "neutral", "skipped"].map((conclusion) => ({ name: "same", status: "completed", conclusion }));
    const r = await gate(data); expect(r.code).toBe(2); expect(r.stdout).toContain(`ci: pass 3 checks passed on ${head}`);
  });

  it("G7.6 pending legacy status fails even beside success", async () => {
    const data = fixture(); data.statuses = [{ context: "old", state: "pending" }];
    const r = await gate(data); expect(r.code).toBe(1); expect(r.stdout).toContain('ci: fail "old" still running');
  });

  it("G7.7 unresolved outdated thread on second page blocks", async () => {
    const data = fixture(); data.threads.push({ ...data.threads[0], id: "second", page: 2, isResolved: false, isOutdated: true, path: "src/other\nfile" });
    const r = await gate(data);
    expect(r.code).toBe(1); expect(r.stdout).toContain('threads: fail 1 unresolved: "src/other\\nfile"');
    expect(r.calls.filter((c) => c[1] === "graphql")).toHaveLength(2);
    expect(r.calls.some((c) => c.includes("cursor=next"))).toBe(true);
  });

  it("G7.8 named bot with no signal fails", async () => {
    const data = fixture(); data.reviews = [];
    const r = await gate(data); expect(r.code).toBe(1); expect(r.stdout).toContain('bot "review-bot": fail no Bot account "review-bot" reviewed, commented or reacted on this pull request');
  });

  it("bot logins have no connector alias", async () => {
    const data = fixture(); data.reviews[0]!.user = { login: "chatgpt-codex-connector[bot]", type: "Bot" };
    const r = await gate(data, [], { argv: [...required(), "--bot", "codex"] });
    expect(r.stdout).toContain('bot "codex": fail no Bot account "codex" reviewed, commented or reacted on this pull request');
    expect(r.stdout).toContain('bot "chatgpt-codex-connector[bot]": fail left a review but was not named with --bot');
    expect(r.code).toBe(1);
    const named = await gate(data, [], { argv: [...required(), "--bot", "CHATGPT-CODEX-CONNECTOR"] });
    expect(named.stdout).toContain('bot "CHATGPT-CODEX-CONNECTOR": pass'); expect(named.code).toBe(2);
  });

  it("usage requests a bot login", async () => {
    const r = await gate(fixture(), [], { argv: ["--help"] });
    expect(r.stdout).toContain("[--bot <login>...]");
  });

  it("G7.8 unavailable bot prints reason without reading its signals", async () => {
    const data = fixture(); data.reviews = [];
    const r = await gate(data, [], { argv: [...required(), "--bot-unavailable", "review-bot:service down"] });
    expect(r.code).toBe(2); expect(r.stdout).toContain('bot "review-bot": unavailable service down');
    expect(r.calls.some((c) => /reactions|check-suites/.test(c[1]!))).toBe(false);
    expect(readsComments(r.calls)).toBe(false);
  });

  it("G7.9 latest nonempty earlier review names its commit", async () => {
    const data = fixture(); data.reviews[0]!.commit_id = OTHER;
    data.reviews.unshift({ ...data.reviews[0], commit_id: checkout.base, submitted_at: "2026-11-11T12:00:00Z" });
    const r = await gate(data); expect(r.code).toBe(1); expect(r.stdout).toContain(`fail finished only on ${OTHER}, not on ${head}`);
  });

  it.each(["", " \n\t"])("G7.9 empty head review is a start marker: %j", async (body) => {
    const data = fixture(); data.reviews[0]!.body = body;
    const r = await gate(data); expect(r.code).toBe(1); expect(r.stdout).toContain(`fail not finished on ${head}`);
  });

  it("G7.10 unnamed bot review fails regardless of state or body", async () => {
    const data = fixture(); data.reviews.push({ ...data.reviews[0], user: { login: "extra\nbot", type: "Bot" }, commit_id: null, body: "", state: "PENDING" });
    const r = await gate(data); expect(r.code).toBe(1); expect(r.stdout).toContain('bot "extra\\nbot": fail left a review but was not named with --bot');
  });

  it("G7.10 unnamed comments and human reviews produce no bot line", async () => {
    const data = fixture(); data.reviews.push({ ...data.reviews[0], user: { login: "human", type: "User" } });
    data.comments = [comment("hello", { login: "dependency", type: "Bot" })];
    const r = await gate(data); expect(r.code).toBe(2); expect(r.stdout).not.toContain('bot "human"'); expect(r.stdout).not.toContain('bot "dependency"');
  });

  it("no named or reviewing bots prints the empty bot verdict", async () => {
    const data = fixture(); data.reviews = [];
    const r = await gate(data, [], { argv: required() });
    expect(r.stdout).toContain("bots: pass none named and no other bot reviewed"); expect(r.code).toBe(2);
  });

  it.each(["reaction", "summary", "review"])("named bot account ownership: %s", async (signal) => {
    for (const user of [
      { login: "human", type: "User" },
      { login: "review-bot", type: "User" },
      null,
      { login: "review-bot[bot]", type: "Bot" },
    ]) {
      const data = fixture();
      const review = { ...data.reviews[0], user }; data.reviews = [];
      if (signal === "review") data.reviews = [review];
      if (signal === "reaction") data.reactions = [{ user, content: "+1", created_at: "2026-11-12T11:00:01Z" }];
      if (signal === "summary") data.comments = [comment(`Completed ${head.slice(0, 7)}`, user)];
      const r = await gate(data);
      if (user?.type === "Bot") {
        expect(r.stdout).toContain('bot "review-bot": pass');
        expect(r.code).toBe(2);
      } else {
        expect(r.stdout).not.toContain('bot "review-bot": pass');
        expect(r.code).not.toBe(0);
      }
    }
  });

  it.each(["reaction", "summary", "review"])("null account type is a transport failure: %s", async (signal) => {
    const data = fixture();
    const user = { login: "review-bot", type: null };
    const review = { ...data.reviews[0], user }; data.reviews = [];
    if (signal === "review") data.reviews = [review];
    if (signal === "reaction") data.reactions = [{ user, content: "+1", created_at: "2026-11-12T11:00:01Z" }];
    if (signal === "summary") data.comments = [comment(`Completed ${head.slice(0, 7)}`, user)];
    const r = await gate(data);
    const call = { reaction: "botReactions", summary: "botComments", review: "botReviews" }[signal];
    const label = signal === "review" ? "bots" : 'bot "review-bot"';
    expect(r.stdout).toContain(`${label}: could not check (${call}: missing or invalid type)`);
    expect(r.stdout).not.toContain('bot "review-bot": pass');
    expect(r.code).toBe(2);
  });

  it("a bot heart reaction does not finish the named bot", async () => {
    const data = fixture(); data.reviews = [];
    data.reactions = [{ user: { login: "review-bot[bot]", type: "Bot" }, content: "heart", created_at: "2026-11-12T11:00:01Z" }];
    const r = await gate(data);
    expect(r.stdout).toContain(`bot "review-bot": fail not finished on ${head}`);
    expect(r.code).toBe(1);
  });

  it("a check cannot forge an exact ok line with the full head SHA", async () => {
    const data = fixture(); data.checks[0]!.name = `x\u2028ok ${head}`;
    const r = await gate(data);
    expect(r.stdout).not.toMatch(new RegExp(`^ok ${head}$`, "m"));
    expect(r.code).not.toBe(0);
  });

  it.each([
    ["after", "2026-11-12T11:00:01Z", true],
    ["before", "2026-11-12T10:59:59Z", false],
    ["equal", "2026-11-12T11:00:00Z", false],
    ["no suites", "2026-11-12T11:00:01Z", false],
  ] as const)("G7.11 reaction %s earliest suite", async (kind, created_at, passes) => {
    const data = fixture(); data.reviews = [];
    data.reactions = [{ user: { login: "REVIEW-BOT[bot]", type: "Bot" }, content: "+1", created_at }];
    if (kind === "no suites") data.suites = [];
    else data.suites.unshift({ created_at: "2026-11-12T12:00:00Z" });
    const r = await gate(data); expect(r.code).toBe(passes ? 2 : 1);
    expect(r.stdout).toContain(passes ? "(+1 reaction after the head's first check suite)" : 'bot "review-bot": fail');
    if (kind === "before" || kind === "equal") expect(r.stdout).toContain("its +1 reaction is not dated after the head's first check suite");
    if (passes) expect(readsComments(r.calls)).toBe(false);
  });

  it.each([
    ["completed", () => head.slice(0, 7), "Completed", true],
    ["other head", () => OTHER.slice(0, 7), "Completed", false],
    ["running", () => head.slice(0, 7), "Running", false],
    ["too short", () => head.slice(0, 6), "Completed", false],
    ["not whole word", () => `${head.slice(0, 7)}z`, "Completed", false],
  ] as const)("G7.11 summary row %s", async (_kind, sha, word, passes) => {
    const data = fixture(); data.reviews = [];
    data.comments = [comment(`Summary\n| ${sha()} | ${word} |`)];
    const r = await gate(data); expect(r.code).toBe(passes ? 2 : 1);
    expect(r.stdout).toContain(passes ? "(summary row)" : `fail not finished on ${head}`);
  });

  it.each([
    ["| bbbbbbb | Completed |\r| aaaaaaa | Running |", false],
    ["Completed bbbbbbb\u2028Running aaaaaaa", false],
    ["Completed bbbbbbb\u2029Running aaaaaaa", false],
    ["Completed bbbbbbb\u0085Running aaaaaaa", false],
    ["Completed on bbbbbbb; now running on aaaaaaa", false],
    ["Not Completed on aaaaaaa", false],
    ["| aaaaaaa | Completed |", true],
    ["| aaaaaaaaaa | Completed |", true],
    ["Completed aaaaaaa bbbbbbb", false],
    ["Completed aaaaaaa RUNNING", false],
    ["Completed aaaaaaa stillRunning", false],
    ["Completed aaaaaaa nothing", true],
    ["Completed aaaaaaa\rRunning bbbbbbb", true],
    ["Completed aaaaaaa\u0085Running bbbbbbb", true],
  ] as const)("exact summary row: %j", async (body, passes) => {
    const data = fixture(OTHER); data.reviews = [];
    data.comments = [comment(body)];
    const r = await gate(data, [], { sha: OTHER });
    expect(r.stdout).toContain(passes ? '(summary row)' : `bot "review-bot": fail not finished on ${OTHER}`);
    expect(r.code).toBe(passes ? 2 : 1);
  });

  it("AE5: unauthenticated gh names every call and exits 2", async () => {
    const r = await gate(fixture(), [], { failure: "authentication required\nsecond line" });
    expect(r.code).toBe(2);
    for (const call of ["head", "checks", "threads", "botReviews"]) expect(r.stdout).toContain(`could not check (${call}: authentication required)`);
    expect(r.stdout).toContain("attributes: could not check (needs the live base)"); expect(r.stdout).not.toContain(": pass");
  });

  it.each([
    ["botReactions", "/reactions?"],
    ["firstSuiteAt", "/check-suites?"],
    ["botComments", "botComments"],
  ])("partial bot read failure stays on that bot: %s", async (call, failPath) => {
    const data = fixture();
    const review = data.reviews[0]!;
    data.reviews = [
      { ...review, user: { login: "unnamed[bot]", type: "Bot" } },
      { ...review, user: { login: "finished-bot", type: "Bot" } },
    ];
    data.checks[0]!.conclusion = "failure";
    if (call === "firstSuiteAt") data.reactions = [{ user: { login: "review-bot", type: "Bot" }, content: "+1", created_at: "2026-11-12T11:00:01Z" }];
    const r = await gate(data, ["--bot", "finished-bot", "--bot-unavailable", "absent:caller reason"], { failure: "read failed", failPath });
    expect(r.stdout).toContain(`bot "review-bot": could not check (${call}: read failed)`);
    expect(r.stdout).toContain('bot "unnamed[bot]": fail left a review but was not named with --bot');
    expect(r.stdout).toContain('bot "finished-bot": pass');
    expect(r.stdout).toContain('bot "absent": unavailable caller reason');
    expect(r.stdout).toContain('ci: fail "tests" failure');
    expect(r.stdout).toContain('threads: pass');
    expect(r.stdout).not.toContain('bots: could not check');
    expect(r.code).toBe(1);
  });

  it("botReviews failure stays global while other conditions still fail", async () => {
    const data = fixture(); data.checks[0]!.conclusion = "failure";
    const r = await gate(data, [], { failure: "reviews failed", failPath: "/reviews?" });
    expect(r.stdout).toContain('bots: could not check (botReviews: reviews failed)');
    expect(r.stdout).not.toContain('bot "');
    expect(r.stdout).toContain('ci: fail "tests" failure');
    expect(r.stdout).toContain('threads: pass');
    expect(r.code).toBe(1);
  });

  it("firstSuiteAt failure outranks an edited summary row", async () => {
    const data = fixture(); data.reviews = [];
    data.reactions = [{ user: { login: "review-bot[bot]", type: "Bot" }, content: "+1", created_at: "2026-11-12T11:00:01Z" }];
    const row: Row = { ...comment(`Completed ${head.slice(0, 7)}`), lastEditedAt: "now", editor: { __typename: "User", login: "maintainer" },
      userContentEdits: { totalCount: 1, nodes: [{ editor: { __typename: "User", login: "maintainer" } }] } };
    data.comments = [row];
    const r = await gate(data, [], { failure: "suites failed", failPath: "/check-suites?" });
    expect(r.stdout).toContain('bot "review-bot": could not check (firstSuiteAt: suites failed)');
    expect(r.stdout).not.toContain('bot "review-bot": fail');
    expect(r.code).toBe(2);
  });

  it("firstSuiteAt failure cannot hide a summary pass without a bot +1", async () => {
    const data = fixture(); data.reviews = [];
    data.comments = [comment(`Completed ${head.slice(0, 7)}`)];
    const r = await gate(data, [], { failure: "suites failed", failPath: "/check-suites?" });
    expect(r.stdout).toContain('bot "review-bot": pass');
    expect(r.stdout).toContain('(summary row)');
    expect(r.calls.some((call) => call[1]?.includes('/check-suites?'))).toBe(false);
    expect(r.code).toBe(2);
  });

  it("firstSuiteAt failure cannot hide a summary pass with a bot +1", async () => {
    const data = fixture(); data.reviews = [];
    data.reactions = [{ user: { login: "review-bot", type: "Bot" }, content: "+1", created_at: "2026-11-12T11:00:01Z" }];
    data.comments = [comment(`Completed ${head.slice(0, 7)}`)];
    const r = await gate(data, [], { failure: "suites failed", failPath: "/check-suites?" });
    expect(r.stdout).toContain('bot "review-bot": pass');
    expect(r.stdout).toContain('(summary row)');
    expect(r.calls.some((call) => call[1]?.includes('/check-suites?'))).toBe(true);
    expect(r.code).toBe(2);
  });

  it("G7.13 every condition runs after head and CI fail", async () => {
    const data = fixture(); data.head.head.sha = OTHER; data.checks[0]!.conclusion = "failure";
    const r = await gate(data); expect(r.code).toBe(1);
    for (const text of ["head: fail", "ci: fail", "threads: pass", 'bot "review-bot": pass']) expect(r.stdout).toContain(text);
  });

  it("G7.14 attributes warn for the whole PR range without failing", async () => {
    const repo = repository(); writeFileSync(join(repo.cwd, ".gitattributes"), "*.dat binary\n"); const sha = repo.commit("attributes");
    const r = await gate(fixture(sha, repo.base), [], { cwd: repo.cwd, sha });
    expect(r.code).toBe(2); expect(r.stdout).toContain("attributes: warn the pull request changes a .gitattributes file, which can change how git reads its lines");
  });

  it("G6: warns with escaped binary paths without failing", async () => {
    const repo = repository();
    const paths = ["first\nforged", "last\"\u2028forged"];
    for (const path of paths) writeFileSync(join(repo.cwd, path), "\0code\n".repeat(300));
    const sha = repo.commit("binary paths");
    const r = await gate(fixture(sha, repo.base), [], { cwd: repo.cwd, sha });
    expect(r.stdout).toContain('binary paths: warn counted as text: "first\\nforged", "last\\"\\u2028forged"\n');
    expect(r.code).toBe(2);
    expect(r.stdout).toContain(`blocked ${sha}: 0 failed, 1 not checked`);
    expect(r.stdout).not.toMatch(/[\u2028\u2029]/);
  });

  it.each([
    [["src/a.bin", "test/a.bin"], 'binary paths: warn counted as text: "src/a.bin"; test paths, not counted: "test/a.bin"\n'],
    [["test/a.bin"], 'binary paths: warn test paths, not counted: "test/a.bin"\n'],
    [["src/a.bin"], 'binary paths: warn counted as text: "src/a.bin"\n'],
  ])("G6: the binary warning lists %j with test paths in their own clause", async (paths, line) => {
    const repo = repository();
    for (const path of paths) {
      mkdirSync(join(repo.cwd, dirname(path)), { recursive: true });
      writeFileSync(join(repo.cwd, path), "\0code\n".repeat(3));
    }
    const sha = repo.commit("binary paths");
    const r = await gate(fixture(sha, repo.base), [], { cwd: repo.cwd, sha });
    expect(r.stdout).toContain(line);
    expect(r.stdout.match(/^binary paths:/gm)).toHaveLength(1);
    expect(r.code).toBe(2);
  });

  it("G7.14 missing base commit asks to fetch it", async () => {
    const data = fixture(); data.head.base.sha = OTHER;
    const r = await gate(data); expect(r.code).toBe(2); expect(r.stdout).toContain(`attributes: could not check (the clone lacks ${OTHER}; fetch it)`);
  });

  it.each([
    ["--head", "@HEAD@", "--bindings", "unused"],
    ["--pr", "owner/repo", "--head", "@HEAD@", "--bindings", "unused"],
    ["--pr", "owner/repo#0", "--head", "@HEAD@", "--bindings", "unused"],
    ["--pr", "owner/repo#44", "--head", "abc", "--bindings", "unused"],
    ["--pr", "owner/repo#44", "--head", "@HEAD@"],
    ["--pr", "owner/repo#44", "--head", "@HEAD@", "--bindings", "unused", "--bot-unavailable", "x"],
    ["--pr", "owner/repo#44", "--head", "@HEAD@", "--bindings", "unused", "--bot-unavailable", "x:"],
    ["--pr", "owner/repo#44", "--head", "@HEAD@", "--bindings", "unused", "--bot-unavailable", "x:two\nlines"],
    ["--pr", "owner/repo#44", "--head", "@HEAD@", "--bindings", "unused", "--bot", "X[bot]", "--bot-unavailable", "x:down"],
    ["--unknown"],
  ])("G7.15 bad arguments are rejected before processes: %j", async (...argv) => {
    const r = await gate(fixture(), [], { argv: argv.map((arg) => arg.replace("@HEAD@", head)) });
    expect(r.code).toBe(2); expect(r.stdout).toBe(""); expect(r.stderr).toMatch(/^merge-gate: .+\nUsage: merge-gate\.mjs /); expect(r.calls).toHaveLength(0);
  });

  it("G7.16 a check name with a line break stays on one report line", async () => {
    const data = fixture(); data.checks[0]!.name = "test\nok forged"; data.checks[0]!.conclusion = "failure";
    const r = await gate(data); expect(r.code).toBe(1); expect(r.stdout).toContain('ci: fail "test\\nok forged" failure'); expect(r.stdout).not.toMatch(/^ok /m);
  });

  it.each(["check", "thread", "bot", "earlier review", "gh error", "git error", "state", "conclusion", "controls"])("single-line escaping: %s", async (kind) => {
    const data = fixture();
    const forged = `ok ${head}`;
    const config: { failure?: string; failPath?: string } = {};
    if (kind === "check") { data.checks[0]!.name = `x\u2028${forged}`; data.checks[0]!.conclusion = "failure"; }
    if (kind === "thread") { data.threads[0]!.path = `x\u2029${forged}`; data.threads[0]!.isResolved = false; }
    if (kind === "bot") data.reviews.push({ ...data.reviews[0], user: { login: `x\u0085${forged}`, type: "Bot" } });
    if (kind === "earlier review") data.reviews[0]!.commit_id = `x\u2028${forged}`;
    if (kind === "gh error" || kind === "git error") {
      config.failure = `reason\r${forged}\u2028${forged}`;
      config.failPath = kind === "git error" ? "git" : "pulls/44";
    }
    if (kind === "state") data.head.state = `x\u2028${forged}`;
    if (kind === "conclusion") data.checks[0]!.conclusion = `x\u2029${forged}`;
    if (kind === "controls") { data.checks[0]!.name = `x\u0000\t\n\r\u001f\u007f\u0080\u009f`; data.checks[0]!.conclusion = "failure"; }
    const r = await gate(data, [], config);
    expect(r.code).not.toBe(0);
    expect(r.stdout).not.toMatch(/^ok /m);
    const lines = r.stdout.trimEnd().split(/\r\n?|\n|\u2028|\u2029|\u0085/);
    expect(lines).toEqual(r.stdout.trimEnd().split("\n"));
    for (const line of lines) expect(line).toMatch(/^(?:head:|ci:|review:|coverage:|doc review:|threads:|bot "|bots:|attributes:|not checked:|blocked )/);
    expect(r.stdout).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/);
    if (kind.endsWith("error")) expect(r.stdout).toContain(`reason\\r${forged}\\u2028${forged}`);
    if (kind === "controls") expect(r.stdout).toContain('x\\u0000\\t\\n\\r\\u001f\\u007f\\u0080\\u009f');
  });

  it.each(["bogus", "symlink bogus", "help"])("spawned entry point: %s", (kind) => {
    let script = resolve("skills/supervision-setup/scripts/merge-gate.mjs");
    const flags: string[] = [];
    if (kind === "symlink bogus") {
      const cwd = mkdtempSync(join(tmpdir(), "merge-gate-link-")); dirs.push(cwd);
      cpSync(resolve("skills/supervision-setup/scripts"), join(cwd, "scripts"), { recursive: true });
      symlinkSync(join(cwd, "scripts"), join(cwd, "linked-scripts"), "dir");
      script = join(cwd, "linked-scripts", "merge-gate.mjs");
      flags.push("--preserve-symlinks", "--preserve-symlinks-main");
    }
    const r = spawnSync(process.execPath, [...flags, script, kind === "help" ? "--help" : "--bogus"], { encoding: "utf8" });
    expect(r.status).toBe(kind === "help" ? 0 : 2);
    expect(kind === "help" ? r.stdout : r.stderr).toContain("Usage: merge-gate.mjs ");
    expect(kind === "help" ? r.stderr : r.stdout).toBe("");
  });

  it("G7.17 help alone exits 0 and names every argument", async () => {
    const r = await gate(fixture(), [], { argv: ["--help"] });
    expect(r.code).toBe(0); expect(r.stderr).toBe(""); expect(r.calls).toHaveLength(0);
    for (const name of ["pr", "head", "bindings", "receipt", "carried", "codex-rollout", "bot", "bot-unavailable", "checkout", "help"]) expect(r.stdout).toContain(`--${name}`);
  });
});

/** Spawn import and symlink forms without ever reaching a network-capable gate run. */
describe("entry guards", () => {
  it.each(["fallback link", "fallback argv link", "missing module", "runtime true", "runtime false"])("entry helper: %s", (kind) => {
    const cwd = mkdtempSync(join(tmpdir(), "entry-helper-")); dirs.push(cwd);
    const module = join(cwd, "module.mjs"); writeFileSync(module, "");
    const link = join(cwd, "link.mjs"); symlinkSync(module, link);
    const url = pathToFileURL(resolve("skills/supervision-setup/scripts/entry.mjs")).href;
    const meta = { url: pathToFileURL(kind === "missing module" ? join(cwd, "missing") : link).href,
      ...(kind.startsWith("runtime") ? { main: kind === "runtime true" } : {}) };
    const code = `const { isEntry } = await import(${JSON.stringify(url)}); process.argv[1] = ${JSON.stringify(kind === "fallback argv link" ? link : module)}; process.stdout.write(String(isEntry(${JSON.stringify(meta)})));`;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0); expect(r.stderr).toBe("");
    expect(r.stdout).toBe(String(["fallback link", "fallback argv link", "runtime true"].includes(kind)));
  });

  it.each(["eval", "wrapper", "wrapper bogus", "missing argv"])("gate import runs on load: %s", (kind) => {
    const url = pathToFileURL(resolve("skills/supervision-setup/scripts/merge-gate.mjs")).href;
    const cwd = mkdtempSync(join(tmpdir(), "gate-import-")); dirs.push(cwd);
    const load = `await import(${JSON.stringify(url)});`;
    let args = ["--input-type=module", "-e", kind === "missing argv" ? `process.argv[1] = ${JSON.stringify(join(cwd, "missing"))}; ${load}` : load];
    if (kind.startsWith("wrapper")) {
      const wrapper = join(cwd, "wrapper.mjs");
      writeFileSync(wrapper, load);
      args = [wrapper, ...(kind === "wrapper bogus" ? ["--bogus"] : [])];
    }
    const r = spawnSync(process.execPath, args, { encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/^merge-gate: .+\nUsage: merge-gate\.mjs /);
    expect(r.stderr).not.toContain("ENOENT");
  });

  it("checks module imports silently without running", () => {
    const url = pathToFileURL(resolve("skills/supervision-setup/scripts/merge-gate-checks.mjs")).href;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(url)});`], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toBe(""); expect(r.stderr).toBe("");
  });

  it.each(["receipt-check", "review-read", "model-window"])("older entry runs through preserved symlinks: %s", (name) => {
    const cwd = mkdtempSync(join(tmpdir(), "older-entry-")); dirs.push(cwd);
    cpSync(resolve("skills/supervision-setup"), join(cwd, "setup"), { recursive: true });
    symlinkSync(join(cwd, "setup"), join(cwd, "linked"), "dir");
    const r = spawnSync(process.execPath, ["--preserve-symlinks", "--preserve-symlinks-main", join(cwd, "linked", "scripts", `${name}.mjs`)], { encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
    expect(r.stderr.toLowerCase()).toContain(`usage: ${name}.mjs `);
  });

  it.each(["receipt-check", "review-read", "model-window"])("older module tolerates missing argv path: %s", (name) => {
    const cwd = mkdtempSync(join(tmpdir(), "older-import-")); dirs.push(cwd);
    const url = pathToFileURL(resolve(`skills/supervision-setup/scripts/${name}.mjs`)).href;
    const code = `process.argv[1] = ${JSON.stringify(join(cwd, "missing"))}; await import(${JSON.stringify(url)});`;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toBe(""); expect(r.stderr).toBe("");
  });
});

/** Comment provenance cases use the same completed row, changing only edit evidence. */
describe("summary editor", () => {
  it.each(["human", "unedited", "bot only", "100 edits", "null editor", "null history editor", "human history", "101 edits", "short history", "missing lastEditedAt", "other bot", "same-login user", "other bot history"])("summary editor: %s", async (kind) => {
    const data = fixture(); data.reviews = [];
    const bot = { __typename: "Bot", login: "review-bot[bot]" };
    const human = { __typename: "User", login: "maintainer\nnext" };
    const otherBot = { __typename: "Bot", login: "other-bot[bot]" };
    const sameLoginUser = { __typename: "User", login: "review-bot" };
    const row: Row = { ...comment(`Completed ${head.slice(0, 7)}`), lastEditedAt: "now", editor: bot,
      userContentEdits: { totalCount: 1, nodes: [{ editor: bot }] } };
    if (kind === "human") row.editor = human;
    if (kind === "unedited") { row.lastEditedAt = null; row.editor = null; row.userContentEdits = { totalCount: 0, nodes: [] }; }
    if (kind === "null editor") row.editor = null;
    if (kind === "null history editor") row.userContentEdits.nodes[0].editor = null;
    if (kind === "100 edits") row.userContentEdits = { totalCount: 100, nodes: Array.from({ length: 100 }, () => ({ editor: bot })) };
    if (kind === "human history") { row.userContentEdits.nodes.push({ editor: human }); row.userContentEdits.totalCount = 2; }
    if (kind === "101 edits") row.userContentEdits = { totalCount: 101, nodes: Array.from({ length: 100 }, () => ({ editor: bot })) };
    if (kind === "short history") row.userContentEdits.totalCount = 2;
    if (kind === "missing lastEditedAt") delete row.lastEditedAt;
    if (kind === "other bot") row.editor = otherBot;
    if (kind === "same-login user") row.editor = sameLoginUser;
    if (kind === "other bot history") { row.userContentEdits.nodes.push({ editor: otherBot }); row.userContentEdits.totalCount = 2; }
    data.comments = [row];
    const r = await gate(data);
    expect(readsComments(r.calls)).toBe(true);
    if (["unedited", "bot only", "100 edits"].includes(kind)) {
      expect(r.stdout).toContain(`bot "review-bot": pass finished on ${head} (summary row)`); expect(r.code).toBe(2);
    } else if (kind === "missing lastEditedAt") {
      expect(r.stdout).toContain('bot "review-bot": could not check (botComments: missing or invalid lastEditedAt)'); expect(r.code).toBe(2);
    } else {
      const reason = ["101 edits", "short history"].includes(kind) ? "its summary row's edits cannot all be read"
        : `its summary row was edited by "${kind.startsWith("null") ? "unknown" : kind.startsWith("other bot") ? "other-bot[bot]" : kind === "same-login user" ? "review-bot" : "maintainer\\nnext"}"`;
      expect(r.stdout).toContain(`bot "review-bot": fail ${reason}`); expect(r.code).toBe(1);
    }
  });
});

/** Append `n` distinct non-test lines to one file and commit them. */
function grow(repo: ReturnType<typeof repository>, n: number, file = "src/code.mjs") {
  const path = join(repo.cwd, file);
  mkdirSync(dirname(path), { recursive: true });
  const old = existsSync(path) ? readFileSync(path, "utf8") : "";
  const start = old.split("\n").length;
  writeFileSync(path, old + Array.from({ length: n }, (_, i) => `export const line${start + i} = ${start + i};\n`).join(""));
  return repo.commit(`grow ${file} by ${n}`);
}

/** Run the gate on a head of its own repository, with these bindings and the base branch at `base`. */
async function coverageGate(repo: ReturnType<typeof repository>, sha: string, base: string, bindings: string[], extra: string[] = []) {
  const argv = ["--pr", "owner/repo#44", "--head", sha, ...bindings.flatMap((path) => ["--bindings", path]), "--checkout", repo.cwd, "--bot", "review-bot", ...extra];
  return gate(fixture(sha, base), [], { argv, sha });
}

/** One worker's bindings over one session holding these reviewers. */
function worker(...reviewers: Reviewer[]) {
  return bindingsFile("worker", [reviewSession(reviewers)]);
}

/** A handoff whose receipt-check section holds these lines. */
function handoff(lines: string[]) {
  const path = join(scratch("merge-gate-handoff-"), "handoff.md");
  writeFileSync(path, ["# Handoff", "", "## Receipt check", ...lines, "", "## Next", "nothing", ""].join("\n"));
  return path;
}

/** A carried review line, as the receipt check prints one for a session it read. */
function carriedLine(session: string, reviewed: string, base: string, dirty = false) {
  return `story-worker/review: used ${REVIEW_SKILL} in ${session} subagent agent-r0; read ${reviewed} from ${base}${dirty ? " (dirty tree)" : ""}; args ${JSON.stringify(`base:${base}`)}`;
}

/**
 * A rebase before the first push: `reviewed` adds a feature on the old base,
 * the base branch then moves on another file, and `head` holds the same
 * feature on the new base, or with one line indented when `indent` is set.
 */
function rebased(indent = false) {
  const repo = repository();
  repo.git("checkout", "-q", "-b", "topic");
  writeFileSync(join(repo.cwd, "feature.mjs"), "export const a = 1;\nexport const b = 2;\n");
  const reviewed = repo.commit("feature");
  repo.git("checkout", "-q", "main");
  writeFileSync(join(repo.cwd, "other.txt"), "the base branch moves\n");
  const moved = repo.commit("base moves");
  repo.git("checkout", "-q", "-b", "rebased");
  writeFileSync(join(repo.cwd, "feature.mjs"), `export const a = 1;\n${indent ? " " : ""}export const b = 2;\n`);
  const sha = repo.commit("feature again");
  return { repo, reviewed, moved, sha };
}

/**
 * A criss-cross base merge: base lines L1 and L2 from the fork point, joined
 * on the base, then base commit L3 edits `g`. The topic's commit `a` edits
 * `f`; the topic then merges L1, then L2, each with one merge base, and `m`
 * merges L3, whose parents have two merge bases, L1 and L2.
 */
function crissCross() {
  const repo = repository();
  repo.git("checkout", "-q", "-b", "topic");
  writeFileSync(join(repo.cwd, "f"), "topic\n");
  const a = repo.commit("topic edits f");
  repo.git("checkout", "-q", "-b", "l1", repo.base);
  writeFileSync(join(repo.cwd, "l1"), "l1\n");
  const l1 = repo.commit("L1");
  repo.git("checkout", "-q", "-b", "l2", repo.base);
  writeFileSync(join(repo.cwd, "l2"), "l2\n");
  const l2 = repo.commit("L2");
  repo.git("checkout", "-q", "-B", "main", l1);
  repo.git("merge", "-q", "--no-ff", "-m", "join L1 and L2", "l2");
  writeFileSync(join(repo.cwd, "g"), "L3\n");
  const l3 = repo.commit("L3");
  repo.git("checkout", "-q", "topic");
  repo.git("merge", "-q", "--no-ff", "-m", "merge L1", "l1");
  repo.git("merge", "-q", "--no-ff", "-m", "merge L2", "l2");
  repo.git("merge", "-q", "--no-ff", "-m", "merge L3", "main");
  const m = repo.git("rev-parse", "HEAD");
  expect(repo.git("merge-base", "--all", `${m}^1`, `${m}^2`).split("\n").sort()).toEqual([l1, l2].sort());
  return { repo, a, l3, m };
}

describe("review coverage", () => {
  it("AE1: a full review of an older head with 135 uncovered non-test lines fails", async () => {
    const repo = repository();
    const a = grow(repo, 10); const b = grow(repo, 100); const c = grow(repo, 35);
    const r = await coverageGate(repo, c, repo.base, [worker({ head: a, base: repo.base, minute: 1 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: pass full review read ${a}\n`);
    expect(r.stdout).toContain(`coverage: fail uncovered commits ${b}, ${c}\n`);
    expect(r.stdout).toContain("doc review: not checked (not built yet)\n");
    expect(r.stdout).not.toMatch(/^ok /m);
  });

  it("AE2: a full review at A and a re-check A..B cover head B", async () => {
    const repo = repository();
    const a = grow(repo, 10); const b = grow(repo, 20);
    const r = await coverageGate(repo, b, repo.base, [worker({ head: a, base: repo.base, minute: 1 }, { head: b, base: a, minute: 2 })]);
    expect(r.stdout).toContain(`review: pass full review read ${a}\n`);
    expect(r.stdout).toContain(`coverage: pass ${a}..${b} covered by 1 re-checks; 20 non-test lines since the full review\n`);
    expect(r.stdout).toContain("doc review: not checked (not built yet)\n");
    expect(r.stdout).toContain(`blocked ${b}: 0 failed, 1 not checked\n`);
    expect(r.code).toBe(2);
  });

  it("AE3: 160 non-test lines after the full review need a full review again", async () => {
    const repo = repository();
    const a = grow(repo, 10); const b = grow(repo, 160);
    const r = await coverageGate(repo, b, repo.base, [worker({ head: a, base: repo.base, minute: 1 }, { head: b, base: a, minute: 2 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`coverage: fail 160 non-test lines since the full review at ${a}, 150 or more: a full review must come again\n`);
  });

  it("exactly 150 non-test lines after the full review need a full review again; 149 do not", async () => {
    const at = async (n: number) => {
      const repo = repository();
      const a = grow(repo, 10); const b = grow(repo, n);
      return { a, b, r: await coverageGate(repo, b, repo.base, [worker({ head: a, base: repo.base, minute: 1 }, { head: b, base: a, minute: 2 })]) };
    };
    const limit = await at(150);
    expect(limit.r.code).toBe(1);
    expect(limit.r.stdout).toContain(`coverage: fail 150 non-test lines since the full review at ${limit.a}, 150 or more: a full review must come again\n`);
    const below = await at(149);
    expect(below.r.stdout).toContain(`coverage: pass ${below.a}..${below.b} covered by 1 re-checks; 149 non-test lines since the full review\n`);
  });

  it("uncovered commits and too many lines share one coverage line", async () => {
    const repo = repository();
    const a = grow(repo, 10); const b = grow(repo, 160);
    const r = await coverageGate(repo, b, repo.base, [worker({ head: a, base: repo.base, minute: 1 })]);
    expect(r.stdout).toContain(`coverage: fail uncovered commits ${b}; 160 non-test lines since the full review at ${a}, 150 or more: a full review must come again\n`);
  });

  it.each([
    ["only in a fork of the main session", { fork: true }, "not fresh"],
    ["only in a fork whose sidecar says isFork alone", { fork: true, sidecar: { isFork: true, toolUseId: "toolu_parent" } }, "not fresh"],
    ["only in a fork whose sidecar says agentType fork alone", { fork: true, sidecar: { agentType: "fork", toolUseId: "toolu_parent" } }, "not fresh"],
    ["over a dirty tree", { status: 2 }, "dirty tree"],
  ])("a review that ran %s fails R3", async (_what, change, reason) => {
    const repo = repository();
    const a = grow(repo, 10);
    const r = await coverageGate(repo, a, repo.base, [worker({ head: a, base: repo.base, minute: 1, ...change })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${a} (1 review calls, none credited: ${reason})\n`);
    expect(r.stdout).toContain("coverage: fail no full review to start from\n");
  });

  it("a review that ran only in a fork of a non-fresh thread fails R3", async () => {
    const repo = repository();
    const a = grow(repo, 10);
    const r = await coverageGate(repo, a, repo.base, [worker(
      { head: a, base: repo.base, minute: 1, fork: true }, { head: a, base: repo.base, minute: 2, fork: true, parent: 0 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${a} (2 review calls, none credited: not fresh)\n`);
  });

  it("a fork of a fresh reviewer satisfies R3 as that reviewer would", async () => {
    const repo = repository();
    const a = grow(repo, 10);
    const reviewer = { head: a, base: repo.base, minute: 2 };
    // The fresh parent's own read was dirty, so only its fork's clean read can pass R3.
    const parent = { head: a, base: repo.base, minute: 1, status: 2 };
    const asFork = await coverageGate(repo, a, repo.base, [worker(parent, { ...reviewer, fork: true, parent: 0 })]);
    const asReviewer = await coverageGate(repo, a, repo.base, [worker(parent, reviewer)]);
    expect(asFork.stdout).toContain(`review: pass full review read ${a}\n`);
    expect(asFork.stdout).toBe(asReviewer.stdout);
    expect(asFork.code).toBe(asReviewer.code);
  });

  it("re-checks A..B and C..D leave B..C uncovered, naming its commits", async () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5); const c = grow(repo, 5); const d = grow(repo, 5);
    const r = await coverageGate(repo, d, repo.base, [worker(
      { head: a, base: repo.base, minute: 1 }, { head: b, base: a, minute: 2 }, { head: d, base: c, minute: 3 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`coverage: fail uncovered commits ${c}, ${d}\n`);
  });

  it("overlapping re-checks A..C and B..D leave the head uncovered: B was never a covered point", async () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5); const c = grow(repo, 5); const d = grow(repo, 5);
    const r = await coverageGate(repo, d, repo.base, [worker(
      { head: a, base: repo.base, minute: 1 }, { head: c, base: a, minute: 2 }, { head: d, base: b, minute: 3 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`coverage: fail uncovered commits ${d}\n`);
  });

  it("Z/W: a re-check based before the full review does not cover content no reviewed diff showed", async () => {
    // c1 adds Z, c2 deletes Z and adds W, the full review reads c2, c3 adds Z again: c1..c3 shows only W.
    const repo = repository();
    writeFileSync(join(repo.cwd, "Z.txt"), "zed\n");
    const c1 = repo.commit("add Z");
    repo.git("rm", "-q", "Z.txt");
    writeFileSync(join(repo.cwd, "W.txt"), "double-u\n");
    const c2 = repo.commit("delete Z, add W");
    writeFileSync(join(repo.cwd, "Z.txt"), "zed\n");
    const c3 = repo.commit("add Z again");
    const r = await coverageGate(repo, c3, repo.base, [worker({ head: c2, base: repo.base, minute: 1 }, { head: c3, base: c1, minute: 2 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: pass full review read ${c2}\n`);
    expect(r.stdout).toContain(`coverage: fail uncovered commits ${c3}\n`);
  });

  it("a full review at B and a re-check A..C, A an ancestor of B, leave C uncovered", async () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5); const c = grow(repo, 5);
    const r = await coverageGate(repo, c, repo.base, [worker({ head: b, base: repo.base, minute: 1 }, { head: c, base: a, minute: 2 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: pass full review read ${b}\n`);
    expect(r.stdout).toContain(`coverage: fail uncovered commits ${c}\n`);
  });

  it("pin: re-checks A..B, A..C and B..D reach D from a full review at A with 2 re-checks", async () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5); const c = grow(repo, 5); const d = grow(repo, 5);
    const r = await coverageGate(repo, d, repo.base, [worker({ head: a, base: repo.base, minute: 1 },
      { head: b, base: a, minute: 2 }, { head: c, base: a, minute: 3 }, { head: d, base: b, minute: 4 })]);
    expect(r.stdout).toContain(`coverage: pass ${a}..${d} covered by 2 re-checks; 15 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  it("full reviews at A and C with re-checks A..B and B..D start from A, the furthest that reaches the head", async () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5); const c = grow(repo, 5); const d = grow(repo, 5);
    const r = await coverageGate(repo, d, repo.base, [worker({ head: a, base: repo.base, minute: 1 },
      { head: c, base: repo.base, minute: 2 }, { head: b, base: a, minute: 3 }, { head: d, base: b, minute: 4 })]);
    expect(r.stdout).toContain(`review: pass full review read ${a}\n`);
    expect(r.stdout).toContain(`coverage: pass ${a}..${d} covered by 2 re-checks; 15 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  it("pin: after a clean base merge m, a re-check from A to B and one from m to B both pass", async () => {
    const repo = repository();
    repo.git("checkout", "-q", "-b", "topic");
    const a = grow(repo, 5);
    repo.git("checkout", "-q", "main");
    writeFileSync(join(repo.cwd, "other.txt"), "base moves\n");
    const moved = repo.commit("base moves");
    repo.git("checkout", "-q", "topic");
    repo.git("merge", "-q", "--no-ff", "-m", "merge base", "main");
    const m = repo.git("rev-parse", "HEAD");
    const b = grow(repo, 5);
    for (const from of [a, m]) {
      const r = await coverageGate(repo, b, moved, [worker({ head: a, base: repo.base, minute: 1 }, { head: b, base: from, minute: 2 })]);
      expect(r.stdout).toContain(`coverage: pass ${a}..${b} covered by 1 re-checks; 5 non-test lines since the full review\n`);
      expect(r.code).toBe(2);
    }
  });

  it("pin, item 7k: a re-check from a side head whose tree is its no-ff merge's links from that merge", async () => {
    const repo = repository();
    repo.git("checkout", "-q", "-b", "topic");
    repo.git("checkout", "-q", "-b", "side");
    const s = grow(repo, 5, "src/side.mjs");
    repo.git("checkout", "-q", "topic");
    repo.git("merge", "-q", "--no-ff", "-m", "merge side", "side");
    const c = repo.git("rev-parse", "HEAD");
    const d = grow(repo, 5);
    expect(repo.git("rev-parse", `${s}^{tree}`)).toBe(repo.git("rev-parse", `${c}^{tree}`));
    const r = await coverageGate(repo, d, repo.base, [worker({ head: s, base: repo.base, minute: 1 }, { head: d, base: s, minute: 2 })]);
    expect(r.stdout).toContain(`review: pass full review read ${c} (patch-id match of ${s})\n`);
    expect(r.stdout).toContain(`coverage: pass ${c}..${d} covered by 1 re-checks; 5 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  /** Item 7k's rebase onto a moved base: the full review at `reviewed` forked at the root, places at `c` by patch-id; `d` follows. */
  function movedBase() {
    const { repo, reviewed, moved, sha: c } = rebased();
    return { repo, reviewed, moved, c, d: grow(repo, 5) };
  }

  it("item 7k: after a rebase onto a moved base, a re-check from the old fork point links nothing", async () => {
    const { repo, reviewed, moved, c, d } = movedBase();
    // The read from the pre-rebase head records the merge-base of the rebased head and that head.
    expect(repo.git("merge-base", d, reviewed)).toBe(repo.base);
    const r = await coverageGate(repo, d, moved, [worker({ head: reviewed, base: repo.base, minute: 1 }, { head: d, base: repo.base, minute: 2 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: pass full review read ${c} (patch-id match of ${reviewed})\n`);
    expect(r.stdout).toContain(`coverage: fail uncovered commits ${d}\n`);
  });

  it("pin, item 7k: after a rebase onto a moved base, a re-check from the placed commit links", async () => {
    const { repo, reviewed, moved, c, d } = movedBase();
    const r = await coverageGate(repo, d, moved, [worker({ head: reviewed, base: repo.base, minute: 1 }, { head: d, base: c, minute: 2 })]);
    expect(r.stdout).toContain(`coverage: pass ${c}..${d} covered by 1 re-checks; 5 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  it("pin: a record whose head is in the clone and whose base is not says the base is missing", async () => {
    const repo = repository();
    const a = grow(repo, 5);
    const absent = "c".repeat(40);
    const r = await coverageGate(repo, a, repo.base, [worker({ head: a, base: absent, minute: 1 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${a} (1 review calls, none credited: reviewed commit ${absent} is not in the clone)\n`);
  });

  it("every start judges merges by merge-tree: a conflict-resolved base merge before a later full review is not stepped over", async () => {
    // Chain A, x, B, C, D: x resolves a conflict, so re-merging its parents conflicts and it is no clean merge from any start.
    const repo = repository();
    repo.git("checkout", "-q", "-b", "topic");
    writeFileSync(join(repo.cwd, "seed"), "base\ntopic\n");
    const a = repo.commit("topic edits seed");
    repo.git("checkout", "-q", "main");
    writeFileSync(join(repo.cwd, "seed"), "base\nmain\n");
    const moved = repo.commit("base edits seed");
    repo.git("checkout", "-q", "topic");
    expect(() => repo.git("merge", "-q", "--no-ff", "-m", "merge base", "main")).toThrow();
    writeFileSync(join(repo.cwd, "seed"), "base\ntopic\nmain\n");
    const x = repo.commit("merge base, resolved");
    const b = grow(repo, 5); const c = grow(repo, 5); const d = grow(repo, 5);
    const r = await coverageGate(repo, d, moved, [worker({ head: a, base: repo.base, minute: 1 }, { head: c, base: moved, minute: 2 },
      { head: b, base: x, minute: 3 }, { head: d, base: b, minute: 4 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: pass full review read ${c}\n`);
    expect(r.stdout).toContain(`coverage: fail uncovered commits ${d}\n`);
  });

  it("a re-check whose args name A, while its read recorded the merge-base, credits nothing", async () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5);
    const r = await coverageGate(repo, b, repo.base, [worker(
      { head: a, base: repo.base, minute: 1 }, { head: b, base: repo.base, args: `base:${a}`, minute: 2 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: pass full review read ${a}\n`);
    expect(r.stdout).toContain(`coverage: fail uncovered commits ${b}\n`);
  });

  it("a clean base merge after the full review passes, counting 0 lines", async () => {
    const repo = repository();
    repo.git("checkout", "-q", "-b", "topic");
    const a = grow(repo, 5);
    repo.git("checkout", "-q", "main");
    writeFileSync(join(repo.cwd, "other.txt"), "base moves\n");
    const moved = repo.commit("base moves");
    repo.git("checkout", "-q", "topic");
    repo.git("merge", "-q", "--no-ff", "-m", "merge base", "main");
    const merge = repo.git("rev-parse", "HEAD");
    const r = await coverageGate(repo, merge, moved, [worker({ head: a, base: repo.base, minute: 1 })]);
    expect(r.stdout).toContain(`review: pass full review read ${a}\n`);
    expect(r.stdout).toContain(`coverage: pass ${a}..${merge} covered by 0 re-checks; 0 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  /** A full review's commit `a` on a topic branch, `then` more topic commits ending at `last`, the base moving, and a clean `--no-ff` base merge `m`. */
  function topicThenBaseMerge(then: number) {
    const repo = repository();
    repo.git("checkout", "-q", "-b", "topic");
    const a = grow(repo, 5);
    let last = a;
    for (let i = 0; i < then; i += 1) last = grow(repo, 5);
    repo.git("checkout", "-q", "main");
    writeFileSync(join(repo.cwd, "other.txt"), "base moves\n");
    const moved = repo.commit("base moves");
    repo.git("checkout", "-q", "topic");
    repo.git("merge", "-q", "--no-ff", "-m", "merge base", "main");
    return { repo, a, last, moved, m: repo.git("rev-parse", "HEAD") };
  }

  it("pin: a clean base merge after an unreached commit is not stepped over", async () => {
    const { repo, a, last: b, moved, m } = topicThenBaseMerge(1);
    const r = await coverageGate(repo, m, moved, [worker({ head: a, base: repo.base, minute: 1 })]);
    expect(r.stdout).toMatch(new RegExp(`^coverage: fail uncovered commits ${b}$`, "m"));
    expect(r.code).toBe(1);
  });

  it("pin: a clean base merge right after a re-check's place is reached, and a re-check from it links", async () => {
    const { repo, a, last: c, moved, m } = topicThenBaseMerge(2);
    const d = grow(repo, 5);
    const r = await coverageGate(repo, d, moved, [worker({ head: a, base: repo.base, minute: 1 },
      { head: c, base: a, minute: 2 }, { head: d, base: m, minute: 3 })]);
    expect(r.stdout).toContain(`coverage: pass ${a}..${d} covered by 2 re-checks; 15 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  it("pin: the path with the fewest re-checks wins: A..C over A..B and B..C", async () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5); const c = grow(repo, 5);
    const r = await coverageGate(repo, c, repo.base, [worker({ head: a, base: repo.base, minute: 1 },
      { head: b, base: a, minute: 2 }, { head: c, base: b, minute: 3 }, { head: c, base: a, minute: 4 })]);
    expect(r.stdout).toContain(`coverage: pass ${a}..${c} covered by 1 re-checks; 10 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  it("pin: the path with the fewest re-checks wins when a longer one reaches the head first: A..D, D..E over A..B, B..C, C..E", async () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5); const c = grow(repo, 5); const d = grow(repo, 5); const e = grow(repo, 5);
    const r = await coverageGate(repo, e, repo.base, [worker({ head: a, base: repo.base, minute: 1 },
      { head: b, base: a, minute: 2 }, { head: c, base: b, minute: 3 }, { head: e, base: c, minute: 4 },
      { head: d, base: a, minute: 5 }, { head: e, base: d, minute: 6 })]);
    expect(r.stdout).toContain(`coverage: pass ${a}..${e} covered by 2 re-checks; 20 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  it("a base merge whose conflict was resolved is not a clean merge and needs a re-check", async () => {
    const repo = repository();
    repo.git("checkout", "-q", "-b", "topic");
    writeFileSync(join(repo.cwd, "seed"), "base\ntopic\n");
    const a = repo.commit("topic edits seed");
    repo.git("checkout", "-q", "main");
    writeFileSync(join(repo.cwd, "seed"), "base\nmain\n");
    const moved = repo.commit("base edits seed");
    repo.git("checkout", "-q", "topic");
    expect(() => repo.git("merge", "-q", "--no-ff", "-m", "merge base", "main")).toThrow();
    writeFileSync(join(repo.cwd, "seed"), "base\ntopic\nmain\n");
    const merge = repo.commit("merge base, resolved");
    expect(repo.git("rev-list", "--parents", "-n", "1", merge).split(" ")).toHaveLength(3);
    const r = await coverageGate(repo, merge, moved, [worker({ head: a, base: repo.base, minute: 1 })]);
    expect(r.stdout).toContain(`review: pass full review read ${a}\n`);
    expect(r.stdout).toMatch(new RegExp(`^coverage: fail uncovered commits ${merge}$`, "m"));
    expect(r.code).toBe(1);
  });

  it("a criss-cross base merge that re-merges clean is not stepped over: its parents have two merge bases", async () => {
    const { repo, a, l3, m } = crissCross();
    const r = await coverageGate(repo, m, l3, [worker({ head: a, base: repo.base, minute: 1 })]);
    expect(r.stdout).toContain(`review: pass full review read ${a}\n`);
    expect(r.stdout).toMatch(new RegExp(`^coverage: fail uncovered commits ${m}$`, "m"));
    expect(r.code).toBe(1);
  });

  it("pin: a base merge whose re-merge differs from its tree, with no conflict, is not stepped over", async () => {
    const { repo, a, moved, m } = topicThenBaseMerge(0);
    writeFileSync(join(repo.cwd, "k"), "only in the merge\n");
    repo.git("add", "k");
    repo.git("commit", "-q", "--amend", "--no-edit");
    const evil = repo.git("rev-parse", "HEAD");
    expect(evil).not.toBe(m);
    const r = await coverageGate(repo, evil, moved, [worker({ head: a, base: repo.base, minute: 1 })]);
    expect(r.stdout).toMatch(new RegExp(`^coverage: fail uncovered commits ${evil}$`, "m"));
    expect(r.code).toBe(1);
  });

  it("pin: an octopus merge of base commits is never stepped over", async () => {
    const repo = repository();
    repo.git("checkout", "-q", "-b", "topic");
    const a = grow(repo, 5);
    repo.git("checkout", "-q", "-b", "one", repo.base);
    writeFileSync(join(repo.cwd, "one"), "one\n");
    const one = repo.commit("one");
    repo.git("checkout", "-q", "-b", "two", repo.base);
    writeFileSync(join(repo.cwd, "two"), "two\n");
    const two = repo.commit("two");
    repo.git("checkout", "-q", "-B", "main", one);
    repo.git("merge", "-q", "--no-ff", "-m", "join", "two");
    const joined = repo.git("rev-parse", "HEAD");
    repo.git("checkout", "-q", "topic");
    repo.git("merge", "-q", "-m", "octopus", one, two);
    const octopus = repo.git("rev-parse", "HEAD");
    expect(repo.git("rev-list", "--parents", "-n", "1", octopus).split(" ")).toHaveLength(4);
    const r = await coverageGate(repo, octopus, joined, [worker({ head: a, base: repo.base, minute: 1 })]);
    expect(r.stdout).toMatch(new RegExp(`^coverage: fail uncovered commits ${octopus}$`, "m"));
    expect(r.code).toBe(1);
  });

  it("the lead's review-before-merge of the final head passes R3 on its own", async () => {
    const repo = repository();
    const a = grow(repo, 5);
    const lead = bindingsFile("lead", [reviewSession([{ head: a, base: repo.base, minute: 1 }])]);
    const r = await coverageGate(repo, a, repo.base, [worker(), lead]);
    expect(r.stdout).toContain(`review: pass full review read ${a}\n`);
    expect(r.stdout).toContain(`coverage: pass ${a}..${a} covered by 0 re-checks; 0 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  it("a lead record whose head is not an ancestor of the head does not count, even with an equal patch-id", async () => {
    const { repo, reviewed, moved, sha } = rebased();
    const lead = bindingsFile("lead", [reviewSession([{ head: reviewed, base: repo.base, minute: 1 }])]);
    const r = await coverageGate(repo, sha, moved, [worker(), lead]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${sha} (1 review calls, none credited: not on the head's history)\n`);
  });

  it("a rebase before the push with an equal patch-id is credited", async () => {
    const { repo, reviewed, moved, sha } = rebased();
    const r = await coverageGate(repo, sha, moved, [worker({ head: reviewed, base: repo.base, minute: 1 })]);
    expect(r.stdout).toContain(`review: pass full review read ${sha} (patch-id match of ${reviewed})\n`);
    expect(r.stdout).toContain(`coverage: pass ${sha}..${sha} covered by 0 re-checks; 0 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  it("a rebase that differs only in indentation is not credited", async () => {
    const { repo, reviewed, moved, sha } = rebased(true);
    const r = await coverageGate(repo, sha, moved, [worker({ head: reviewed, base: repo.base, minute: 1 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${sha} (1 review calls, none credited: not on the head's history)\n`);
  });

  it("a reviewed commit absent from the clone fails, saying so", async () => {
    const repo = repository();
    const a = grow(repo, 5);
    const absent = "b".repeat(40);
    const r = await coverageGate(repo, a, repo.base, [worker({ head: absent, base: repo.base, minute: 1 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${a} (1 review calls, none credited: reviewed commit ${absent} is not in the clone)\n`);
  });

  it("review bound by fallback fails R3, saying so", async () => {
    const repo = repository();
    const a = grow(repo, 5);
    const bindings = bindingsFile("worker", [reviewSession([{ head: a, base: repo.base, minute: 1 }])], { fallback: true });
    const r = await coverageGate(repo, a, repo.base, [bindings]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${a} (1 review calls, none credited: bound by fallback)\n`);
  });

  it("a review under another plugin's same-named skill is not credited; a bare name still matches", async () => {
    const repo = repository();
    const a = grow(repo, 5);
    const other = await coverageGate(repo, a, repo.base, [worker({ head: a, base: repo.base, minute: 1, skill: "other-plugin:ce-code-review" })]);
    expect(other.code).toBe(1);
    expect(other.stdout).toContain(`review: fail no creditable full review of ${a} (0 review calls, none credited)\n`);
    const bare = await coverageGate(repo, a, repo.base, [worker({ head: a, base: repo.base, minute: 1, skill: "ce-code-review" })]);
    expect(bare.stdout).toContain(`review: pass full review read ${a}\n`);
  });

  it("a doc-review record is not credited as R3's full review, saying so", async () => {
    const repo = repository();
    const a = grow(repo, 5);
    const r = await coverageGate(repo, a, repo.base, [worker({ head: a, base: repo.base, minute: 1, skill: "compound-engineering:ce-doc-review" })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${a} (1 review calls, none credited: doc review not judged yet)\n`);
  });

  it("ruling 1: a full review placed at the merge-base reads nothing and credits nothing", async () => {
    // M is a second base commit, so a re-check can read from an ancestor of M and reach the head.
    const repo = repository();
    const merge = grow(repo, 5, "src/base.mjs");
    const a = grow(repo, 5);
    const r = await coverageGate(repo, a, merge, [worker(
      { head: merge, base: merge, minute: 1 }, { head: a, base: repo.base, minute: 2 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${a} (2 review calls, none credited: reads nothing, a re-check, not a full review)\n`);
    expect(r.stdout).toContain("coverage: fail no full review to start from\n");
  });

  it("a --codex-rollout run from the merge-base, with no other review, fails R3", async () => {
    const repo = repository();
    const a = grow(repo, 5);
    const day = join(scratch("merge-gate-codex-"), "sessions", "2026", "11", "14");
    mkdirSync(day, { recursive: true });
    const id = "01a40000-0000-7000-8000-0000000000f1";
    const item = (line: string, stdout: string, skill?: string) => ({ type: "event_msg", timestamp: "2026-11-14T11:00:00.000Z", payload: { type: "item_completed", item: {
      type: "CommandExecution", id: `cmd-${skill ?? "read"}`, command: ["/bin/zsh", "-lc", line],
      parsed_cmd: [skill ? { type: "read", cmd: line, name: "SKILL.md", path: `/Users/maintainer/.codex/skills/${skill}/SKILL.md` } : { type: "unknown", cmd: line }],
      status: "completed", exit_code: 0, stdout, stderr: "" } } });
    const records = [
      { type: "session_meta", payload: { id, source: "exec" } },
      { type: "event_msg", timestamp: "2026-11-14T11:00:00.000Z", payload: { type: "task_started" } },
      item(`node ${READ_SCRIPT} --checkout /Users/maintainer/work/repo --from ${repo.base}`, `head ${a}\nstatus 0\nbase ${repo.base}\n`),
      item("sed -n '1,200p' /Users/maintainer/.codex/skills/ce-code-review/SKILL.md", "---\nname: ce-code-review\n---\n", "ce-code-review"),
    ].map((record, ordinal) => ({ ...record, ordinal }));
    const rollout = join(day, `rollout-2026-11-14T11-00-00-${id}.jsonl`);
    writeFileSync(rollout, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
    const r = await coverageGate(repo, a, repo.base, [worker()], ["--codex-rollout", rollout]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${a} (1 review calls, none credited: base not named)\n`);
  });

  it("a read by a review-read.mjs copied elsewhere fails", async () => {
    const repo = repository();
    const a = grow(repo, 5);
    const copy = join(scratch("merge-gate-copy-"), "review-read.mjs");
    cpSync(READ_SCRIPT, copy);
    const r = await coverageGate(repo, a, repo.base, [worker({ head: a, base: repo.base, minute: 1, script: copy })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${a} (1 review calls, none credited: read by another script)\n`);
  });

  it("the read script beside a bindings file's table is trusted, and a relative script path is never trusted", async () => {
    const repo = repository();
    const a = grow(repo, 5);
    const install = scratch("merge-gate-install-");
    cpSync(resolve("skills/supervision-setup"), join(install, "skills", "supervision-setup"), { recursive: true });
    const table = join(install, "skills", "story-worker", "routing.toml");
    const besideTable = join(install, "skills", "supervision-setup", "scripts", "review-read.mjs");
    const listed = reviewSession([{ head: a, base: repo.base, minute: 1, script: besideTable }]);
    const first = await coverageGate(repo, a, repo.base, [bindingsFile("worker", [listed], { table })]);
    expect(first.stdout).toContain(`review: pass full review read ${a}\n`);
    // Node runs a relative script from the process's working directory, which the record does not
    // hold; resolving it against --checkout would judge a script that may not be the one that ran.
    // This relative path does resolve, from the test's working directory, to the gate's own trusted
    // copy, so only the relative-path guard can fail it.
    const script = "skills/supervision-setup/scripts/review-read.mjs";
    expect(realpathSync(script)).toBe(realpathSync(READ_SCRIPT));
    const relative = worker({ head: a, base: repo.base, minute: 1, script, checkout: resolve("skills/supervision-setup") });
    const second = await coverageGate(repo, a, repo.base, [relative]);
    expect(second.code).toBe(1);
    expect(second.stdout).toContain(`review: fail no creditable full review of ${a} (1 review calls, none credited: read by another script)\n`);
  });

  it("a listed transcript that is not found cannot be checked", async () => {
    const repo = repository();
    const a = grow(repo, 5);
    const path = join(scratch("merge-gate-gone-"), "gone.jsonl");
    const r = await coverageGate(repo, a, repo.base, [bindingsFile("worker", [{ session_id: nextSession(), path }])]);
    expect(r.code).toBe(2);
    expect(r.stdout).toContain(`review: could not check (${path} not found)\n`);
    expect(r.stdout).toContain(`coverage: could not check (${path} not found)\n`);
  });

  it.each([
    ["a missing file", null],
    ["a file that is not JSON", "not json"],
    ["another skill's bindings", JSON.stringify({ skill: "supervision-setup", transcripts: [], operations: [] })],
  ])("--bindings naming %s exits 2 before any process", async (_what, body) => {
    const path = join(scratch("merge-gate-bad-"), "bindings.json");
    if (body !== null) writeFileSync(path, body);
    const r = await gate(fixture(), [], { argv: ["--pr", "owner/repo#44", "--head", head, "--bindings", path, "--checkout", checkout.cwd] });
    expect(r.code).toBe(2);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain(`merge-gate: --bindings ${path} is not a worker's or a lead's bindings file\n`);
    expect(r.calls).toHaveLength(0);
  });

  /** A full review's head, a side branch off it, a mainline commit, and the side branch merged back (D6). */
  function sideBranch() {
    const repo = repository();
    repo.git("checkout", "-q", "-b", "topic");
    const full = grow(repo, 5);
    repo.git("checkout", "-q", "-b", "side");
    const side = grow(repo, 5, "src/side.mjs");
    repo.git("checkout", "-q", "topic");
    const mainline = grow(repo, 5, "src/mainline.mjs");
    repo.git("merge", "-q", "--no-ff", "-m", "merge side", "side");
    return { repo, full, side, mainline, merge: repo.git("rev-parse", "HEAD") };
  }

  it("D6: a re-check whose head is only on a merged side branch does not cover the unreviewed mainline commit", async () => {
    const { repo, full, side, mainline, merge } = sideBranch();
    const r = await coverageGate(repo, merge, repo.base, [worker(
      { head: full, base: repo.base, minute: 1 }, { head: side, base: full, minute: 2 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: pass full review read ${full}\n`);
    expect(r.stdout).toContain(`coverage: fail uncovered commits ${mainline}, ${merge}\n`);
  });

  it("D6: a re-check of the merge itself covers it, beside the side branch's own re-check", async () => {
    const { repo, full, side, merge } = sideBranch();
    const r = await coverageGate(repo, merge, repo.base, [worker(
      { head: full, base: repo.base, minute: 1 }, { head: side, base: full, minute: 2 }, { head: merge, base: full, minute: 3 })]);
    expect(r.stdout).toContain(`coverage: pass ${full}..${merge} covered by 1 re-checks; 10 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  /**
   * A side branch whose head has the same tree as a mainline commit: the
   * side branch and the topic each add one identical file, then merge.
   */
  function patchEqualSide() {
    const repo = repository();
    repo.git("checkout", "-q", "-b", "topic");
    const full = grow(repo, 5);
    repo.git("checkout", "-q", "-b", "side");
    writeFileSync(join(repo.cwd, "src", "same.mjs"), "export const same = 1;\n");
    const side = repo.commit("same change on the side");
    repo.git("checkout", "-q", "topic");
    writeFileSync(join(repo.cwd, "src", "same.mjs"), "export const same = 1;\n");
    const equal = repo.commit("same change on the topic");
    repo.git("merge", "-q", "--no-ff", "-m", "merge side", "side");
    return { repo, full, side, equal, merge: repo.git("rev-parse", "HEAD") };
  }

  it("D6: a worker's side-branch re-check patch-equal to a chain commit sits at that commit", async () => {
    const { repo, full, side, equal, merge } = patchEqualSide();
    const r = await coverageGate(repo, merge, repo.base, [worker(
      { head: full, base: repo.base, minute: 1 }, { head: side, base: full, minute: 2 }, { head: merge, base: equal, minute: 3 })]);
    expect(r.stdout).toContain(`coverage: pass ${full}..${merge} covered by 2 re-checks; 1 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  it("G7: a lead's side-branch re-check gets no patch-id credit", async () => {
    const { repo, full, side, equal, merge } = patchEqualSide();
    const lead = bindingsFile("lead", [reviewSession([{ head: side, base: full, minute: 2 }, { head: merge, base: equal, minute: 3 }])]);
    const r = await coverageGate(repo, merge, repo.base, [worker({ head: full, base: repo.base, minute: 1 }), lead]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`coverage: fail uncovered commits ${equal}, ${merge}\n`);
  });

  it("D6: a worker's full review whose head is only on a merged side branch credits nothing", async () => {
    const { repo, side, merge } = sideBranch();
    const r = await coverageGate(repo, merge, repo.base, [worker({ head: side, base: repo.base, minute: 1 })]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${merge} (1 review calls, none credited: only on a merged side branch)\n`);
    expect(r.stdout).toContain("coverage: fail no full review to start from\n");
  });

  it("D6: a side-branch full review, then a mainline re-check of the merge, passes from the mainline full review", async () => {
    const { repo, full, side, merge } = sideBranch();
    const r = await coverageGate(repo, merge, repo.base, [worker(
      { head: full, base: repo.base, minute: 1 }, { head: side, base: repo.base, minute: 2 }, { head: merge, base: full, minute: 3 })]);
    expect(r.stdout).toContain(`review: pass full review read ${full}\n`);
    expect(r.stdout).toContain(`coverage: pass ${full}..${merge} covered by 1 re-checks; 10 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  it("D6: a worker's side-branch full review patch-equal to a chain commit sits at that commit", async () => {
    const { repo, side, equal, merge } = patchEqualSide();
    const r = await coverageGate(repo, merge, repo.base, [worker(
      { head: side, base: repo.base, minute: 1 }, { head: merge, base: equal, minute: 2 })]);
    expect(r.stdout).toContain(`review: pass full review read ${equal} (patch-id match of ${side})\n`);
    expect(r.stdout).toContain(`coverage: pass ${equal}..${merge} covered by 1 re-checks; 0 non-test lines since the full review\n`);
    expect(r.code).toBe(2);
  });

  it("G7: a lead's side-branch full review gets no patch-id credit", async () => {
    const { repo, side, merge } = patchEqualSide();
    const lead = bindingsFile("lead", [reviewSession([{ head: side, base: repo.base, minute: 1 }])]);
    const r = await coverageGate(repo, merge, repo.base, [worker(), lead]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${merge} (1 review calls, none credited: only on a merged side branch)\n`);
  });

  it("two full reviews at one chain place: the later call is the start", async () => {
    const { repo, side, equal, merge } = patchEqualSide();
    const sideLater = await coverageGate(repo, merge, repo.base, [worker(
      { head: equal, base: repo.base, minute: 1 }, { head: side, base: repo.base, minute: 2 })]);
    expect(sideLater.stdout).toContain(`review: pass full review read ${equal} (patch-id match of ${side})\n`);
    const equalLater = await coverageGate(repo, merge, repo.base, [worker(
      { head: side, base: repo.base, minute: 1 }, { head: equal, base: repo.base, minute: 2 })]);
    expect(equalLater.stdout).toContain(`review: pass full review read ${equal}\n`);
  });
});

describe("carried evidence", () => {
  /** A worker whose transcript is gone, a handoff carrying its full review of A, and B on top. */
  function carriedCase({ dirty = false, local = false, fallback = false } = {}) {
    const repo = repository();
    const a = grow(repo, 10); const b = grow(repo, 20);
    const session = nextSession();
    const listed = local ? reviewSession([], session) : { session_id: session, path: join(scratch("merge-gate-away-"), `${session}.jsonl`) };
    const carried = handoff([`transcript ${session}: read 4 calls`, carriedLine(session, a, repo.base, dirty)]);
    return { repo, a, b, workerBindings: bindingsFile("worker", [listed], { fallback }), carried };
  }

  it("a carried line is not credited by another worker's binding", async () => {
    const unbound = carriedCase({ fallback: true });
    const other = worker();
    const lead = bindingsFile("lead", [reviewSession([{ head: unbound.b, base: unbound.a, minute: 5 }])]);
    const r = await coverageGate(unbound.repo, unbound.b, unbound.repo.base, [other, unbound.workerBindings, lead], ["--carried", unbound.carried]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${unbound.b} (2 review calls, none credited: bound by fallback, a re-check, not a full review)\n`);
  });

  it("a carried line is credited by its own worker's binding, whatever another worker binds", async () => {
    const own = carriedCase();
    const fallbackOther = bindingsFile("worker", [reviewSession([])], { fallback: true });
    const ownLead = bindingsFile("lead", [reviewSession([{ head: own.b, base: own.a, minute: 5 }])]);
    const credited = await coverageGate(own.repo, own.b, own.repo.base, [fallbackOther, own.workerBindings, ownLead], ["--carried", own.carried]);
    expect(credited.stdout).toContain(`review: carried full review read ${own.a} (carried; the lead reviewed ${own.b})\n`);
  });

  it("ruling 2: an empty lead re-check of the head does not unlock carried evidence", async () => {
    const { repo, b, workerBindings, carried } = carriedCase();
    const lead = bindingsFile("lead", [reviewSession([{ head: b, base: b, minute: 5 }])]);
    const r = await coverageGate(repo, b, repo.base, [workerBindings, lead], ["--carried", carried]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail carried evidence needs the lead's own review of ${b}\n`);
  });

  it("a carried line placed in a missing Codex child stands for that child's transcript", async () => {
    const repo = repository();
    const a = grow(repo, 10); const b = grow(repo, 20);
    const id = "01a40000-0000-7000-8000-0000000000e1";
    const child = "01a40000-0000-7000-8000-0000000000e2";
    const day = join(scratch("merge-gate-codex-"), "sessions", "2026", "11", "14");
    mkdirSync(day, { recursive: true });
    const rollout = join(day, `rollout-2026-11-14T11-00-00-${id}.jsonl`);
    const started = { type: "event_msg", timestamp: "2026-11-14T11:00:00.000Z", payload: { type: "item_completed",
      item: { type: "SubAgentActivity", id: "call_e2", kind: "started", agent_thread_id: child } } };
    writeFileSync(rollout, [{ type: "session_meta", payload: { id, source: "exec" } }, started]
      .map((record, ordinal) => JSON.stringify({ ...record, ordinal })).join("\n") + "\n");
    const line = `story-worker/review: used ${REVIEW_SKILL} in ${id} subagent ${child}; read ${a} from ${repo.base}; args ${JSON.stringify(`base:${repo.base}`)}`;
    const lead = bindingsFile("lead", [reviewSession([{ head: b, base: a, minute: 5 }])]);
    const r = await coverageGate(repo, b, repo.base, [bindingsFile("worker", [{ session_id: id, path: rollout }]), lead], ["--carried", handoff([line])]);
    expect(r.stdout).toContain(`review: carried full review read ${a} (carried; the lead reviewed ${b})\n`);
  });

  it("AE6: carried worker evidence passes only beside the lead's own review of the head", async () => {
    const { repo, a, b, workerBindings, carried } = carriedCase();
    const lead = bindingsFile("lead", [reviewSession([{ head: b, base: a, minute: 5 }])]);
    const r = await coverageGate(repo, b, repo.base, [workerBindings, lead], ["--carried", carried]);
    expect(r.stdout).toContain(`review: carried full review read ${a} (carried; the lead reviewed ${b})\n`);
    expect(r.stdout).toContain(`coverage: carried ${a}..${b} covered by 1 re-checks; 20 non-test lines since the full review (carried; the lead reviewed ${b})\n`);
    expect(r.stdout).toContain(`blocked ${b}: 0 failed, 1 not checked\n`);
    expect(r.code).toBe(2);
  });

  it("AE6: carried worker evidence without the lead's own review of the head fails R3", async () => {
    const { repo, b, workerBindings, carried } = carriedCase();
    const lead = bindingsFile("lead", [reviewSession([])]);
    const r = await coverageGate(repo, b, repo.base, [workerBindings, lead], ["--carried", carried]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail carried evidence needs the lead's own review of ${b}\n`);
  });

  it("carried lines are ignored when the local transcript can be read", async () => {
    const { repo, a, b, workerBindings, carried } = carriedCase({ local: true });
    const lead = bindingsFile("lead", [reviewSession([{ head: b, base: a, minute: 5 }])]);
    const r = await coverageGate(repo, b, repo.base, [workerBindings, lead], ["--carried", carried]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${b} (1 review calls, none credited: a re-check, not a full review)\n`);
  });

  it("a carried dirty read credits nothing", async () => {
    const { repo, a, b, workerBindings, carried } = carriedCase({ dirty: true });
    const lead = bindingsFile("lead", [reviewSession([{ head: b, base: a, minute: 5 }])]);
    const r = await coverageGate(repo, b, repo.base, [workerBindings, lead], ["--carried", carried]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${b} (2 review calls, none credited: dirty tree, a re-check, not a full review)\n`);
  });

  it("a carried line whose args do not name its base credits nothing", async () => {
    const { repo, a, b, workerBindings } = carriedCase();
    const session = JSON.parse(readFileSync(workerBindings, "utf8")).transcripts[0].session_id;
    const line = carriedLine(session, a, repo.base).replace(JSON.stringify(`base:${repo.base}`), JSON.stringify(`base:${a}`));
    const carried = handoff([`transcript ${session}: read 4 calls`, line]);
    const lead = bindingsFile("lead", [reviewSession([{ head: b, base: a, minute: 5 }])]);
    const r = await coverageGate(repo, b, repo.base, [workerBindings, lead], ["--carried", carried]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${b} (2 review calls, none credited: base not named, a re-check, not a full review)\n`);
  });

  it("a carried re-check can be a coverage link beside the lead's own review of the head", async () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5); const c = grow(repo, 5);
    const session = nextSession();
    const away = { session_id: session, path: join(scratch("merge-gate-away-"), `${session}.jsonl`) };
    const workerBindings = bindingsFile("worker", [reviewSession([{ head: a, base: repo.base, minute: 1 }]), away]);
    const carried = handoff([`transcript ${session}: read 4 calls`, carriedLine(session, b, a)]);
    const lead = bindingsFile("lead", [reviewSession([{ head: c, base: b, minute: 5 }])]);
    const r = await coverageGate(repo, c, repo.base, [workerBindings, lead], ["--carried", carried]);
    expect(r.stdout).toContain(`review: pass full review read ${a}\n`);
    expect(r.stdout).toContain(`coverage: carried ${a}..${c} covered by 2 re-checks; 10 non-test lines since the full review (carried; the lead reviewed ${c})\n`);
    expect(r.code).toBe(2);
  });

  it("pin: a path with no carried link beats a shorter carried one", async () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5); const c = grow(repo, 5);
    const session = nextSession();
    const away = { session_id: session, path: join(scratch("merge-gate-away-"), `${session}.jsonl`) };
    const workerBindings = bindingsFile("worker", [reviewSession([
      { head: a, base: repo.base, minute: 1 }, { head: b, base: a, minute: 2 }, { head: c, base: b, minute: 3 }]), away]);
    const carried = handoff([`transcript ${session}: read 4 calls`, carriedLine(session, c, a)]);
    const lead = bindingsFile("lead", [reviewSession([{ head: c, base: b, minute: 5 }])]);
    const r = await coverageGate(repo, c, repo.base, [workerBindings, lead], ["--carried", carried]);
    expect(r.stdout).toContain(`review: pass full review read ${a}\n`);
    expect(r.stdout).toMatch(new RegExp(`^coverage: pass ${a}\\.\\.${c} covered by 2 re-checks; 10 non-test lines since the full review$`, "m"));
    expect(r.code).toBe(2);
  });

  it("a carried re-check is not a coverage link without the lead's own review of the head", async () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5);
    const session = nextSession();
    const away = { session_id: session, path: join(scratch("merge-gate-away-"), `${session}.jsonl`) };
    const workerBindings = bindingsFile("worker", [reviewSession([{ head: a, base: repo.base, minute: 1 }]), away]);
    const carried = handoff([`transcript ${session}: read 4 calls`, carriedLine(session, b, a)]);
    const lead = bindingsFile("lead", [reviewSession([])]);
    const r = await coverageGate(repo, b, repo.base, [workerBindings, lead], ["--carried", carried]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`review: pass full review read ${a}\n`);
    expect(r.stdout).not.toMatch(/^coverage: .* covered by 1 re-checks/m);
    expect(r.stdout).toContain(`coverage: fail uncovered commits ${b}\n`);
  });

  it("a missing transcript that no carried line covers cannot be checked", async () => {
    const { repo, b, workerBindings } = carriedCase();
    const r = await coverageGate(repo, b, repo.base, [workerBindings], ["--carried", handoff(["transcript someone-else: read 1 calls"])]);
    expect(r.code).toBe(2);
    expect(r.stdout).toMatch(/^review: could not check \(.+ not found\)$/m);
  });

  it("pin: a carried re-check with no full review and no lead gives the carried-alone reason", async () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5);
    const session = nextSession();
    const away = { session_id: session, path: join(scratch("merge-gate-away-"), `${session}.jsonl`) };
    const carried = handoff([`transcript ${session}: read 4 calls`, carriedLine(session, b, a)]);
    const r = await coverageGate(repo, b, repo.base, [bindingsFile("worker", [away]), bindingsFile("lead", [reviewSession([])])], ["--carried", carried]);
    expect(r.stdout).toContain(`review: fail no creditable full review of ${b} (1 review calls, none credited: carried without the lead's own review)\n`);
    expect(r.code).toBe(1);
  });

  it("pin: --carried naming a missing path exits 2 with usage", async () => {
    const { repo, b, workerBindings } = carriedCase();
    const r = await coverageGate(repo, b, repo.base, [workerBindings], ["--carried", join(scratch("merge-gate-none-"), "gone.md")]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/^merge-gate: --carried must name a readable file\nUsage: merge-gate\.mjs /);
    expect(r.stdout).toBe("");
  });

  it("pin: a hand-edited carried line whose args break JSON.parse exits 2 as an internal error", async () => {
    const { repo, a, b, workerBindings } = carriedCase();
    const session = JSON.parse(readFileSync(workerBindings, "utf8")).transcripts[0].session_id;
    const line = carriedLine(session, a, repo.base).replace(/; args .*$/, String.raw`; args "base:\q"`);
    const r = await coverageGate(repo, b, repo.base, [workerBindings], ["--carried", handoff([`transcript ${session}: read 4 calls`, line])]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/^merge-gate: internal error: /);
  });

  it("pin: a review line the receipt check prints is carried by the gate as printed", async () => {
    const repo = repository();
    const a = grow(repo, 10); const b = grow(repo, 20);
    const session = reviewSession([{ head: a, base: repo.base, minute: 1 }]);
    const bindings = bindingsFile("worker", [session]);
    const setup = JSON.parse(readFileSync(bindings, "utf8"));
    const sha256 = createHash("sha256").update(readFileSync(WORKER_TABLE)).digest("hex");
    writeFileSync(bindings, JSON.stringify({ ...setup, complete: true, table: { ...setup.table, sha256 } }));
    const printed = spawnSync(process.execPath, [resolve("skills/supervision-setup/scripts/receipt-check.mjs"), "--bindings", bindings], { encoding: "utf8" });
    const line = printed.stdout.split("\n").find((each) => each.startsWith("story-worker/review: used "));
    expect(line).toContain(`; read ${a} from ${repo.base}; args ${JSON.stringify(`base:${repo.base}`)}`);
    const away = { session_id: session.session_id, path: join(scratch("merge-gate-away-"), `${session.session_id}.jsonl`) };
    const lead = bindingsFile("lead", [reviewSession([{ head: b, base: a, minute: 5 }])]);
    const r = await coverageGate(repo, b, repo.base, [bindingsFile("worker", [away]), lead], ["--carried", handoff([`transcript ${session.session_id}: read 4 calls`, line!])]);
    expect(r.stdout).toContain(`review: carried full review read ${a} (carried; the lead reviewed ${b})\n`);
  });
});

describe("carried evidence over the lead's range (N7)", () => {
  type Repo = ReturnType<typeof repository>;
  const failLine = (sha: string) => `review: fail carried evidence needs the lead's own review of ${sha}\n`;
  const carriedPass = (reviewed: string, sha: string) => `review: carried full review read ${reviewed} (carried; the lead reviewed ${sha})\n`;

  /** Write these files into the work tree. */
  function put(repo: Repo, files: Record<string, string>) {
    for (const [file, body] of Object.entries(files)) writeFileSync(join(repo.cwd, file), body);
  }

  /** A repository whose base branch first commits `files`, then a topic branch whose commit `x` edits `pr`. */
  function start(files: Record<string, string> = {}) {
    const repo = repository();
    if (Object.keys(files).length) {
      put(repo, files);
      repo.commit("base files");
    }
    repo.git("checkout", "-q", "-b", "topic");
    put(repo, { pr: "x\n" });
    return { repo, x: repo.commit("x") };
  }

  /** One commit on the base branch writing `files`, back on the topic after. */
  function onBase(repo: Repo, files: Record<string, string>) {
    repo.git("checkout", "-q", "main");
    put(repo, files);
    const sha = repo.commit("base moves");
    repo.git("checkout", "-q", "topic");
    return sha;
  }

  /** A `--no-ff` merge of `ref` into the checked-out branch. */
  function merge(repo: Repo, ref: string, message = `merge ${ref}`) {
    repo.git("merge", "-q", "--no-ff", "-m", message, ref);
    return repo.git("rev-parse", "HEAD");
  }

  /** A topic commit writing `files`. */
  function edit(repo: Repo, files: Record<string, string>, message = "edit") {
    put(repo, files);
    return repo.commit(message);
  }

  /** The gate at `sha`, the base branch at `baseSha`: a worker's carried full review of `reviewed`, and the lead's re-check `leadBase..sha`. */
  async function leadGate(repo: Repo, reviewed: string, leadBase: string, sha: string, baseSha = repo.git("rev-parse", "main")) {
    const session = nextSession();
    const away = { session_id: session, path: join(scratch("merge-gate-away-"), `${session}.jsonl`) };
    const line = carriedLine(session, reviewed, repo.git("merge-base", reviewed, baseSha));
    const lead = bindingsFile("lead", [reviewSession([{ head: sha, base: leadBase, minute: 5 }])]);
    return coverageGate(repo, sha, baseSha, [bindingsFile("worker", [away]), lead], ["--carried", handoff([`transcript ${session}: read 4 calls`, line])]);
  }

  it("the reproduction: a clean base merge at the head unlocks nothing over head^..head", async () => {
    const { repo, x } = start();
    onBase(repo, { g: "g\n" });
    const m = merge(repo, "main");
    const r = await leadGate(repo, x, x, m);
    expect(r.stdout).toContain(failLine(m));
    expect(r.code).toBe(1);
  });

  it("an empty commit, then a clean base merge, unlock nothing", async () => {
    const { repo, x } = start();
    repo.git("commit", "-q", "--allow-empty", "-m", "empty");
    onBase(repo, { g: "g\n" });
    const m = merge(repo, "main");
    expect((await leadGate(repo, x, x, m)).stdout).toContain(failLine(m));
  });

  it("a commit and its revert, then a clean base merge, unlock nothing", async () => {
    const { repo, x } = start();
    edit(repo, { pr: "changed\n" });
    edit(repo, { pr: "x\n" }, "revert");
    onBase(repo, { g: "g\n" });
    const m = merge(repo, "main");
    expect((await leadGate(repo, x, x, m)).stdout).toContain(failLine(m));
  });

  it("a commit, a clean base merge, then its revert, unlock nothing", async () => {
    const { repo, x } = start();
    edit(repo, { pr: "changed\n" });
    onBase(repo, { g: "g\n" });
    merge(repo, "main");
    const revert = edit(repo, { pr: "x\n" }, "revert");
    expect((await leadGate(repo, x, x, revert)).stdout).toContain(failLine(revert));
  });

  it("pin: a clean merge of a PR side branch with content unlocks", async () => {
    const { repo, x } = start();
    repo.git("checkout", "-q", "-b", "side");
    edit(repo, { h: "side\n" });
    repo.git("checkout", "-q", "topic");
    const s = merge(repo, "side");
    expect((await leadGate(repo, x, x, s)).stdout).toContain(carriedPass(x, s));
  });

  it("a clean base merge, then a clean side-branch merge whose side nets to nothing, unlock nothing", async () => {
    const { repo, x } = start();
    onBase(repo, { g: "g\n" });
    merge(repo, "main");
    repo.git("checkout", "-q", "-b", "side");
    edit(repo, { h: "side\n" });
    repo.git("rm", "-q", "h");
    repo.git("commit", "-q", "-m", "drop h");
    repo.git("checkout", "-q", "topic");
    const s = merge(repo, "side");
    expect(repo.git("rev-parse", `${s}^{tree}`)).toBe(repo.git("rev-parse", `${s}^1^{tree}`));
    expect((await leadGate(repo, x, x, s)).stdout).toContain(failLine(s));
  });

  it("pin: a content commit and a clean base merge touching another path unlock", async () => {
    const { repo, x } = start();
    edit(repo, { pr: "changed\n" });
    onBase(repo, { g: "g\n" });
    const m = merge(repo, "main");
    expect((await leadGate(repo, x, x, m)).stdout).toContain(carriedPass(x, m));
  });

  it("the 11-15 tree check: a lead re-check of an empty commit, or of a commit restoring an earlier tree, unlocks nothing", async () => {
    const empty = start();
    empty.repo.git("commit", "-q", "--allow-empty", "-m", "empty");
    const e = empty.repo.git("rev-parse", "HEAD");
    expect((await leadGate(empty.repo, empty.x, empty.x, e)).stdout).toContain(failLine(e));
    const restored = start();
    edit(restored.repo, { pr: "changed\n" });
    const back = edit(restored.repo, { pr: "x\n" }, "revert");
    expect((await leadGate(restored.repo, restored.x, restored.x, back)).stdout).toContain(failLine(back));
  });

  it("a lead base at a merged side head, then a clean base merge, unlock nothing", async () => {
    const { repo, x } = start();
    repo.git("checkout", "-q", "-b", "side");
    const s1 = edit(repo, { h: "side\n" });
    repo.git("checkout", "-q", "topic");
    const s = merge(repo, "side");
    expect(repo.git("rev-parse", `${s}^{tree}`)).toBe(repo.git("rev-parse", `${s1}^{tree}`));
    onBase(repo, { g: "g\n" });
    const m = merge(repo, "main");
    expect((await leadGate(repo, x, s1, m)).stdout).toContain(failLine(m));
  });

  it("an upstream edit equal to the PR's, then reverted, unlocks nothing", async () => {
    const { repo, x } = start({ f: "A\n" });
    edit(repo, { f: "B\n" });
    onBase(repo, { f: "B\n", g: "g\n" });
    merge(repo, "main");
    const revert = edit(repo, { f: "A\n" }, "revert");
    expect((await leadGate(repo, x, x, revert)).stdout).toContain(failLine(revert));
  });

  it("the same-file variant: upstream's A to B and x to y, the PR's A to B reverted, unlock nothing", async () => {
    const filler = Array.from({ length: 8 }, (_, i) => `keep ${i}\n`).join("");
    const { repo, x } = start({ f: `A\n${filler}x\n` });
    edit(repo, { f: `B\n${filler}x\n` });
    onBase(repo, { f: `B\n${filler}y\n` });
    merge(repo, "main");
    const revert = edit(repo, { f: `A\n${filler}y\n` }, "revert");
    expect((await leadGate(repo, x, x, revert)).stdout).toContain(failLine(revert));
  });

  it("the one-run upstream restore: a PR commit restoring what a clean base merge changed unlocks nothing", async () => {
    const { repo, x } = start({ f: "A\n" });
    onBase(repo, { f: "B\n", g: "g\n" });
    merge(repo, "main");
    const restore = edit(repo, { f: "A\n" }, "restore");
    expect((await leadGate(repo, x, x, restore)).stdout).toContain(failLine(restore));
  });

  /** An octopus at the topic's tip with these base parents, built by commit-tree so no redundant parent is dropped. */
  function octopus(repo: Repo, parents: string[]) {
    const tip = repo.git("rev-parse", "HEAD");
    const tree = repo.git("merge-tree", "--write-tree", tip, parents.at(-1)!);
    const sha = repo.git("commit-tree", tree, "-m", "octopus", ...[tip, ...parents].flatMap((parent) => ["-p", parent]));
    repo.git("reset", "-q", "--hard", sha);
    expect(repo.git("rev-list", "--parents", "-n", "1", sha).split(" ")).toHaveLength(parents.length + 2);
    return sha;
  }

  it("F6: a three-parent base-only octopus is a base merge: no PR content, nothing unlocks", async () => {
    const { repo, x } = start();
    const one = onBase(repo, { g: "g\n" });
    const two = onBase(repo, { g2: "g2\n" });
    const o = octopus(repo, [one, two]);
    expect((await leadGate(repo, x, x, o)).stdout).toContain(failLine(o));
  });

  it("pin, F6's control: a PR commit, then a three-parent base-only octopus, unlock through the commit", async () => {
    const { repo, x } = start();
    edit(repo, { f2: "pr\n" });
    const one = onBase(repo, { g: "g\n" });
    const two = onBase(repo, { g2: "g2\n" });
    const o = octopus(repo, [one, two]);
    expect((await leadGate(repo, x, x, o)).stdout).toContain(carriedPass(x, o));
  });

  /** A base whose lines L1 and L2 fork from its tip and are joined on it; the topic's PR commit, then a porcelain octopus of L1 and L2. */
  function incomparableOctopus() {
    const { repo, x } = start();
    const fork = repo.git("rev-parse", "main");
    edit(repo, { f2: "pr\n" });
    repo.git("checkout", "-q", "-b", "l1", fork);
    const l1 = edit(repo, { l1: "l1\n" }, "L1");
    repo.git("checkout", "-q", "-b", "l2", fork);
    const l2 = edit(repo, { l2: "l2\n" }, "L2");
    repo.git("checkout", "-q", "-B", "main", l1);
    const joined = merge(repo, "l2", "join");
    repo.git("checkout", "-q", "topic");
    repo.git("merge", "-q", "-m", "octopus", "l1", "l2");
    const o = repo.git("rev-parse", "HEAD");
    expect(repo.git("rev-list", "--parents", "-n", "1", o).split(" ")).toHaveLength(4);
    return { repo, x, o, joined };
  }

  it("pin, O11-B: an octopus with incomparable base parents is a refused base merge; a PR commit still unlocks once the head has one merge base with the base", async () => {
    const { repo, x, joined } = incomparableOctopus();
    const m = merge(repo, "main");
    // The fixture's base tip is J (`joined`), so this is the gate's own `merge-base --all <head> <live base>` call.
    expect(repo.git("merge-base", "--all", m, joined)).toBe(joined);
    expect((await leadGate(repo, x, x, m, joined)).stdout).toContain(carriedPass(x, m));
  });

  it("an octopus with incomparable base parents at the head gives the head two merge bases with the base: nothing unlocks", async () => {
    const { repo, x, o, joined } = incomparableOctopus();
    expect(repo.git("merge-base", "--all", o, joined).split("\n")).toHaveLength(2);
    expect((await leadGate(repo, x, x, o, joined)).stdout).toContain(failLine(o));
  });

  it("a criss-cross base merge is refused: no PR content, nothing unlocks", async () => {
    const { repo, a, l3, m } = crissCross();
    expect((await leadGate(repo, a, repo.git("rev-parse", `${m}^1`), m, l3)).stdout).toContain(failLine(m));
  });

  it("an anchor with two merge bases against the head's merge base unlocks nothing, even beside a PR commit", async () => {
    const { repo, a, l3, m } = crissCross();
    const c2 = edit(repo, { f2: "pr\n" });
    expect(repo.git("merge-base", "--all", c2, l3)).toBe(l3);
    expect(repo.git("merge-base", "--all", `${m}^1`, l3).split("\n")).toHaveLength(2);
    expect((await leadGate(repo, a, repo.git("rev-parse", `${m}^1`), c2, l3)).stdout).toContain(failLine(c2));
  });

  it("a conflict-to-ours base merge is refused: its base-side path is no witness", async () => {
    const { repo } = start({ g: "g\n", h: "h\n" });
    const c1 = edit(repo, { g: "pr\n" });
    onBase(repo, { g: "base\n", h: "base\n" });
    repo.git("merge", "-q", "--no-ff", "-X", "ours", "-m", "merge base, ours", "main");
    const m = repo.git("rev-parse", "HEAD");
    expect(readFileSync(join(repo.cwd, "g"), "utf8")).toBe("pr\n");
    expect(readFileSync(join(repo.cwd, "h"), "utf8")).toBe("base\n");
    expect((await leadGate(repo, c1, c1, m)).stdout).toContain(failLine(m));
  });

  /** A PR commit `c1` on `g`, then a base merge `m` that conflicts at `g`, resolved by hand, plus `extra` written in the resolution. */
  function handResolved(extra: Record<string, string> = {}) {
    const { repo, x } = start({ g: "g\n", h: "h\n" });
    const c1 = edit(repo, { g: "pr\n" });
    onBase(repo, { g: "base\n", h: "base\n" });
    expect(() => repo.git("merge", "-q", "--no-ff", "-m", "merge base", "main")).toThrow();
    put(repo, { g: "pr\nbase\n", ...extra });
    return { repo, x, c1, m: repo.commit("merge base, resolved") };
  }

  it("pin: a refused base merge beside a later PR commit unlocks through the commit only", async () => {
    const { repo, x } = handResolved();
    const c2 = edit(repo, { f: "pr\n" });
    expect((await leadGate(repo, x, x, c2)).stdout).toContain(carriedPass(x, c2));
  });

  it("a PR commit, then a refused base merge at the head, unlock nothing: the merge's base-side path is no witness", async () => {
    const { repo, x, m } = handResolved();
    expect((await leadGate(repo, x, x, m)).stdout).toContain(failLine(m));
  });

  it("an anchor that conflicts with the base unlocks nothing, even beside a later PR commit", async () => {
    const { repo, c1 } = handResolved();
    const c2 = edit(repo, { f: "pr\n" });
    expect(() => repo.git("merge-tree", "--write-tree", c1, "main")).toThrow();
    expect((await leadGate(repo, c1, c1, c2)).stdout).toContain(failLine(c2));
  });

  it("a lead base off the head's history unlocks nothing, even with a chain place's tree", async () => {
    const { repo, x } = start();
    const c = edit(repo, { f2: "pr\n" });
    const copy = repo.git("commit-tree", repo.git("rev-parse", `${x}^{tree}`), "-p", repo.base, "-m", "x elsewhere");
    expect(() => repo.git("merge-base", "--is-ancestor", copy, c)).toThrow();
    expect((await leadGate(repo, x, copy, c)).stdout).toContain(failLine(c));
  });

  it("a refused base merge is not PR content: a path its hand resolution alone edits is no witness", async () => {
    const { repo, x, m } = handResolved({ k: "only in the resolution\n" });
    // Anchored at x, before c1 (KTD4's walk-through 4), so Q re-merges clean and the runs are judged.
    expect(() => repo.git("merge-tree", "--write-tree", x, "main")).not.toThrow();
    expect((await leadGate(repo, x, x, m)).stdout).toContain(failLine(m));
  });

  it("ruling 3: an octopus with a parent off the base unlocks nothing, even beside a PR commit", async () => {
    const { repo, x } = start();
    edit(repo, { f: "pr\n" });
    const one = onBase(repo, { g: "g\n" });
    repo.git("checkout", "-q", "-b", "side", x);
    const off = edit(repo, { h: "side\n" });
    repo.git("checkout", "-q", "topic");
    repo.git("merge", "-q", "-m", "octopus", one, off);
    const o = repo.git("rev-parse", "HEAD");
    expect(repo.git("rev-list", "--parents", "-n", "1", o).split(" ")).toHaveLength(4);
    expect(() => repo.git("merge-base", "--is-ancestor", off, "main")).toThrow();
    expect((await leadGate(repo, x, x, o)).stdout).toContain(failLine(o));
  });

  it("pin: the anchor is the latest chain place with the lead base's tree, so Q re-merges past the base merge before it", async () => {
    const { repo, x } = start({ f: "A\n" });
    onBase(repo, { f: "B\n" });
    merge(repo, "main");
    const back = edit(repo, { f: "A\n" }, "restore");
    expect(repo.git("rev-parse", `${back}^{tree}`)).toBe(repo.git("rev-parse", `${x}^{tree}`));
    const c = edit(repo, { f: "C\n" });
    expect((await leadGate(repo, x, x, c)).stdout).toContain(carriedPass(x, c));
  });

  it("no anchor: a lead base whose tree neither M nor any chain place has unlocks nothing, even beside PR content", async () => {
    const { repo, x } = start();
    repo.git("checkout", "-q", "-b", "side");
    const s1 = edit(repo, { h: "side\n" });
    edit(repo, { h2: "side\n" });
    repo.git("checkout", "-q", "topic");
    const s = merge(repo, "side");
    const places = [repo.git("merge-base", s, "main"), ...repo.git("rev-list", "--first-parent", `main..${s}`).split("\n")];
    expect(places.map((sha) => repo.git("rev-parse", `${sha}^{tree}`))).not.toContain(repo.git("rev-parse", `${s1}^{tree}`));
    expect((await leadGate(repo, x, s1, s)).stdout).toContain(failLine(s));
  });

  /** After PR commit x, a clean base merge m1 of base commit B1 adding `g`, then the base branch writes `next`: m1 re-merges with M over B1. */
  function pastBaseMerge(next: Record<string, string>) {
    const { repo, x } = start({ f: "A\n" });
    const b1 = onBase(repo, { g: "g\n" });
    const m1 = merge(repo, "main");
    onBase(repo, next);
    expect(repo.git("merge-base", "--all", m1, "main")).toBe(b1);
    return { repo, x, m1 };
  }

  it("pin: an anchor past a clean base merge re-merges with M over a real merge base; a PR change then unlocks", async () => {
    const { repo, x, m1 } = pastBaseMerge({ h: "h\n" });
    edit(repo, { f: "B\n" });
    const m2 = merge(repo, "main");
    expect((await leadGate(repo, x, m1, m2)).stdout).toContain(carriedPass(x, m2));
  });

  it("an anchor past a clean base merge, then a base merge changing f and a PR commit restoring it, unlock nothing", async () => {
    const { repo, x, m1 } = pastBaseMerge({ f: "B\n", h: "h\n" });
    merge(repo, "main");
    const restore = edit(repo, { f: "A\n" }, "restore");
    expect((await leadGate(repo, x, m1, restore)).stdout).toContain(failLine(restore));
  });

  it("X1: a side branch that wraps a base merge, merged with no content of its own, unlocks nothing", async () => {
    const { repo, x } = start();
    repo.git("checkout", "-q", "-b", "side");
    repo.git("checkout", "-q", "main");
    put(repo, { g: "g\n" });
    repo.commit("base moves");
    repo.git("checkout", "-q", "side");
    merge(repo, "main");
    repo.git("checkout", "-q", "topic");
    const s = merge(repo, "side");
    expect((await leadGate(repo, x, x, s)).stdout).toContain(failLine(s));
  });

  it("F2(b): a side branch forked from a newer base commit, with only an empty commit, unlocks nothing", async () => {
    const { repo, x } = start();
    const newer = onBase(repo, { g: "g\n" });
    repo.git("checkout", "-q", "-b", "side", newer);
    repo.git("commit", "-q", "--allow-empty", "-m", "empty");
    repo.git("checkout", "-q", "topic");
    const s = merge(repo, "side");
    expect((await leadGate(repo, x, x, s)).stdout).toContain(failLine(s));
  });
});

describe("review coverage decisions over records", () => {
  /** A creditable record of a fresh full or re-check review, before any change. */
  function record(change: Row): Row {
    return { thread: "/Users/maintainer/t.jsonl", fresh: true, outcome: "ran", clean: true, baseNamed: true,
      skill: REVIEW_SKILL, args: null, read: null, role: "worker", op: "review", binding: "bound", trusted: true,
      rollout: false, carried: false, ...change };
  }

  it("records out of array order are judged by time", () => {
    const repo = repository();
    const a = grow(repo, 5);
    const sources = createGateSources({ checkout: repo.cwd, owner: "owner", repo: "repo", number: "44" });
    const later = record({ head: a, base: repo.base, clean: false, at: "2026-11-14T10:02:00.000Z" });
    const earlier = record({ head: a, base: repo.base, fresh: false, at: "2026-11-14T10:01:00.000Z" });
    const decision = reviewCoverage([later, earlier], sources, { head: a, baseSha: repo.base, merge: repo.base });
    expect(decision.start).toBeNull();
    expect(decision.reasons).toEqual(["not fresh", "dirty tree"]);
  });

  it("a record whose time does not parse is not credited", () => {
    const repo = repository();
    const a = grow(repo, 5);
    const sources = createGateSources({ checkout: repo.cwd, owner: "owner", repo: "repo", number: "44" });
    const decision = reviewCoverage([record({ head: a, base: repo.base, at: null })], sources, { head: a, baseSha: repo.base, merge: repo.base });
    expect(decision.reasons).toEqual(["no time recorded"]);
  });

  it("a record whose call did not run is not credited", () => {
    const repo = repository();
    const a = grow(repo, 5);
    const sources = createGateSources({ checkout: repo.cwd, owner: "owner", repo: "repo", number: "44" });
    const decision = reviewCoverage([record({ head: a, base: repo.base, outcome: "failed", at: "2026-11-14T10:01:00.000Z" })], sources, { head: a, baseSha: repo.base, merge: repo.base });
    expect(decision.start).toBeNull();
    expect(decision.reasons).toEqual(["did not run"]);
  });

  it("a doc-review record is not credited as a full review", () => {
    const repo = repository();
    const a = grow(repo, 5);
    const sources = createGateSources({ checkout: repo.cwd, owner: "owner", repo: "repo", number: "44" });
    const decision = reviewCoverage([record({ head: a, base: repo.base, op: "doc-review", at: "2026-11-14T10:01:00.000Z" })], sources, { head: a, baseSha: repo.base, merge: repo.base });
    expect(decision.start).toBeNull();
    expect(decision.reasons).toEqual(["doc review not judged yet"]);
  });

  it("a lead record of an older head does not unlock carried evidence", () => {
    const repo = repository();
    const a = grow(repo, 5); const b = grow(repo, 5); const c = grow(repo, 5);
    const sources = createGateSources({ checkout: repo.cwd, owner: "owner", repo: "repo", number: "44" });
    const carried = record({ head: a, base: repo.base, carried: true, fresh: undefined, at: null, trusted: false });
    const lead = record({ head: b, base: a, role: "lead", op: "review-before-merge", at: "2026-11-14T10:01:00.000Z" });
    const decision = reviewCoverage([carried, lead], sources, { head: c, baseSha: repo.base, merge: repo.base });
    expect(decision.leadReviewed).toBe(false);
    expect(decision.start).toBeNull();
    expect(decision.carriedNeedsLead).toBe(true);
  });

  it("G7's no-patch-id clause: a worker's re-check off the head's history gets no patch-id credit", () => {
    // Two commits reviewed on the old base, then the same two rebased onto the moved base.
    const repo = repository();
    repo.git("checkout", "-q", "-b", "topic");
    writeFileSync(join(repo.cwd, "one.mjs"), "export const one = 1;\n");
    repo.commit("one");
    writeFileSync(join(repo.cwd, "two.mjs"), "export const two = 2;\n");
    const reviewed = repo.commit("two");
    repo.git("checkout", "-q", "main");
    writeFileSync(join(repo.cwd, "other.txt"), "the base branch moves\n");
    const moved = repo.commit("base moves");
    repo.git("checkout", "-q", "-b", "rebased");
    writeFileSync(join(repo.cwd, "one.mjs"), "export const one = 1;\n");
    const first = repo.commit("one again");
    writeFileSync(join(repo.cwd, "two.mjs"), "export const two = 2;\n");
    const second = repo.commit("two again");
    const sources = createGateSources({ checkout: repo.cwd, owner: "owner", repo: "repo", number: "44" });
    const full = record({ head: first, base: moved, at: "2026-11-14T10:01:00.000Z" });
    const recheck = record({ head: reviewed, base: first, at: "2026-11-14T10:02:00.000Z" });
    const decision = reviewCoverage([full, recheck], sources, { head: second, baseSha: moved, merge: moved });
    expect(decision.start).toMatchObject({ sha: first });
    expect(decision.reasons).toEqual(["not on the head's history"]);
    expect(decision.uncovered).toEqual([second]);
  });

  it("ruling 1: the lead's record unlocks only when the head's one merge base with the base is exactly the merge passed in", () => {
    const repo = repository();
    repo.git("checkout", "-q", "-b", "topic");
    const x = grow(repo, 5);
    repo.git("checkout", "-q", "main");
    const moved = grow(repo, 5, "other.mjs");
    repo.git("checkout", "-q", "topic");
    repo.git("merge", "-q", "--no-ff", "-m", "merge base", "main");
    const c = grow(repo, 5);
    const sources = createGateSources({ checkout: repo.cwd, owner: "owner", repo: "repo", number: "44" });
    const carried = record({ head: x, base: repo.base, carried: true, fresh: undefined, at: null, trusted: false });
    const lead = record({ head: c, base: x, role: "lead", op: "review-before-merge", at: "2026-11-14T10:01:00.000Z" });
    expect(sources.mergeBases(c, moved)).toEqual([moved]);
    expect(reviewCoverage([carried, lead], sources, { head: c, baseSha: moved, merge: moved }).leadReviewed).toBe(true);
    expect(reviewCoverage([carried, lead], sources, { head: c, baseSha: moved, merge: repo.base }).leadReviewed).toBe(false);
  });

  it("a --codex-rollout run that names its base is still only a re-check", () => {
    const repo = repository();
    const a = grow(repo, 5);
    const sources = createGateSources({ checkout: repo.cwd, owner: "owner", repo: "repo", number: "44" });
    const decision = reviewCoverage([record({ head: a, base: repo.base, rollout: true, at: "2026-11-14T10:01:00.000Z" })], sources, { head: a, baseSha: repo.base, merge: repo.base });
    expect(decision.start).toBeNull();
    expect(decision.reasons).toEqual(["a re-check, not a full review"]);
  });
});
