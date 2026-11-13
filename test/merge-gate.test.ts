/** The gate judges real temporary git histories and path-keyed, offline gh answers. */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error -- no type declarations for this .mjs script
import { defaultRunner } from "../skills/supervision-setup/scripts/gate-sources.mjs";
// @ts-expect-error -- no type declarations for this .mjs script
import { main } from "../skills/supervision-setup/scripts/merge-gate.mjs";

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

/** The required arguments for a head in a checkout, with bindings that are never opened. */
function required(sha = head, cwd = checkout.cwd) {
  return ["--pr", "owner/repo#44", "--head", sha, "--bindings", "not-opened.json", "--checkout", cwd];
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
      if (failure && (failPath === null || (failPath.startsWith("repos/") ? args[1] === failPath : args[1]?.includes(failPath)))) return { status: 1, stdout: "", stderr: failure };
      const path = args[1]!;
      let value: unknown;
      if (path === "graphql") {
        const second = args.includes("cursor=next");
        const split = data.threads.some((row) => row.page === 2);
        const nodes = data.threads.filter((row) => (row.page === 2) === second);
        value = { data: { repository: { pullRequest: { reviewThreads: {
          nodes, pageInfo: { hasNextPage: split && !second, endCursor: split && !second ? "next" : null },
        } } } } };
      } else if (path === "repos/owner/repo/pulls/44") value = data.head;
      else if (path.startsWith(`repos/owner/repo/commits/${sha}/check-runs?`)) value = { check_runs: data.checks };
      else if (path.startsWith(`repos/owner/repo/commits/${sha}/status?`)) value = { statuses: data.statuses };
      else if (path.startsWith(`repos/owner/repo/commits/${sha}/check-suites?`)) value = { check_suites: data.suites };
      else if (/\/reviews\?/.test(path)) value = data.reviews;
      else if (/\/comments\?/.test(path)) value = data.comments;
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
  it("G7.1 U4a can never exit 0", async () => {
    const r = await gate();
    expect(r.code).toBe(2);
    expect(r.stderr).toBe("");
    expect(r.stdout.split("\n")).toContain("review coverage: not checked (not built yet)");
    expect(r.stdout).toContain(`blocked ${head}: 0 failed, 1 not checked\n`);
    expect(r.stdout).not.toMatch(/^ok /m);
    expect(r.stdout).toContain(`head: pass ${head} is the live head`);
    expect(r.stdout).toContain(`ci: pass 2 checks passed on ${head}`);
    expect(r.stdout).toContain('bot "review-bot": pass');
    expect(r.calls.filter((c) => c[1] === "repos/owner/repo/pulls/44")).toHaveLength(1);
    expect(r.calls.some((c) => /reactions|comments|check-suites/.test(c[1]!))).toBe(false);
  });

  it("G7.1 a failing condition plus coverage not checked exits 1", async () => {
    const data = fixture(); data.checks[0]!.conclusion = "failure";
    const r = await gate(data);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("review coverage: not checked (not built yet)");
    expect(r.stdout).toContain(`blocked ${head}: 1 failed, 1 not checked`);
  });

  it("G7.1 help alongside a pull request is an argument error", async () => {
    const r = await gate(fixture(), [], { argv: ["--help", "--pr", "owner/repo#44"] });
    expect(r.code).toBe(2); expect(r.stdout).toBe(""); expect(r.calls).toHaveLength(0);
  });

  it("G7.2 moved live head names both commits and pins other reads", async () => {
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

  it("G7.5 closed pull request fails", async () => {
    const data = fixture(); data.head.state = "closed";
    const r = await gate(data); expect(r.code).toBe(1); expect(r.stdout).toContain("head: fail the pull request is closed");
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
    const r = await gate(data); expect(r.code).toBe(1); expect(r.stdout).toContain(`bot "review-bot": fail not finished on ${head}`);
  });

  it("G7.8 unavailable bot prints reason without reading its signals", async () => {
    const data = fixture(); data.reviews = [];
    const r = await gate(data, [], { argv: [...required(), "--bot-unavailable", "review-bot:service down"] });
    expect(r.code).toBe(2); expect(r.stdout).toContain('bot "review-bot": unavailable service down');
    expect(r.calls.some((c) => /reactions|comments|check-suites/.test(c[1]!))).toBe(false);
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
    data.comments = [{ user: { login: "dependency", type: "Bot" }, body: "hello", created_at: "now", updated_at: "now" }];
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
      { login: "review-bot", type: null },
      null,
      { login: "review-bot[bot]", type: "Bot" },
    ]) {
      const data = fixture();
      const review = { ...data.reviews[0], user }; data.reviews = [];
      if (signal === "review") data.reviews = [review];
      if (signal === "reaction") data.reactions = [{ user, content: "+1", created_at: "2026-11-12T11:00:01Z" }];
      if (signal === "summary") data.comments = [{ user, body: `Completed ${head.slice(0, 7)}`, created_at: "now", updated_at: "now" }];
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
    if (passes) expect(r.calls.some((c) => /\/comments\?/.test(c[1]!))).toBe(false);
  });

  it.each([
    ["completed", () => head.slice(0, 7), "Completed", true],
    ["other head", () => OTHER.slice(0, 7), "Completed", false],
    ["running", () => head.slice(0, 7), "Running", false],
    ["too short", () => head.slice(0, 6), "Completed", false],
    ["not whole word", () => `${head.slice(0, 7)}z`, "Completed", false],
  ] as const)("G7.11 summary row %s", async (_kind, sha, word, passes) => {
    const data = fixture(); data.reviews = [];
    data.comments = [{ user: { login: "review-bot", type: "Bot" }, body: `Summary\n| ${sha()} | ${word} |`, created_at: "now", updated_at: "now" }];
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
    data.comments = [{ user: { login: "review-bot", type: "Bot" }, body, created_at: "now", updated_at: "now" }];
    const r = await gate(data, [], { sha: OTHER });
    expect(r.stdout).toContain(passes ? '(summary row)' : `bot "review-bot": fail not finished on ${OTHER}`);
    expect(r.code).toBe(passes ? 2 : 1);
  });

  it("G7.12 authentication failure names every gh condition and never passes", async () => {
    const r = await gate(fixture(), [], { failure: "authentication required\nsecond line" });
    expect(r.code).toBe(2);
    for (const call of ["head", "checks", "threads", "botReviews"]) expect(r.stdout).toContain(`could not check (${call}: authentication required)`);
    expect(r.stdout).toContain("attributes: could not check (needs the live base)"); expect(r.stdout).not.toContain(": pass");
  });

  it.each([
    ["botReactions", "/reactions?"],
    ["firstSuiteAt", "/check-suites?"],
    ["botComments", "/comments?"],
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

  it("firstSuiteAt failure cannot hide a summary pass without a bot +1", async () => {
    const data = fixture(); data.reviews = [];
    data.comments = [{ user: { login: "review-bot", type: "Bot" }, body: `Completed ${head.slice(0, 7)}`, created_at: "now", updated_at: "now" }];
    const r = await gate(data, [], { failure: "suites failed", failPath: "/check-suites?" });
    expect(r.stdout).toContain('bot "review-bot": pass');
    expect(r.stdout).toContain('(summary row)');
    expect(r.calls.some((call) => call[1]?.includes('/check-suites?'))).toBe(false);
    expect(r.code).toBe(2);
  });

  it("firstSuiteAt failure cannot hide a summary pass with a bot +1", async () => {
    const data = fixture(); data.reviews = [];
    data.reactions = [{ user: { login: "review-bot", type: "Bot" }, content: "+1", created_at: "2026-11-12T11:00:01Z" }];
    data.comments = [{ user: { login: "review-bot", type: "Bot" }, body: `Completed ${head.slice(0, 7)}`, created_at: "now", updated_at: "now" }];
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
    for (const line of lines) expect(line).toMatch(/^(?:head:|ci:|review coverage:|threads:|bot "|bots:|attributes:|not checked:|blocked )/);
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
