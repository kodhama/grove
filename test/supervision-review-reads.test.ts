/**
 * KOD-44 U1 — read records from reviewer transcripts.
 *
 * In plain words: a reviewer runs one fixed read command,
 * `review-read.mjs --checkout <dir> --from <commit>`, before it invokes the
 * review performer. The command prints `head <sha>`, `status <n>` and
 * `base <sha>`. `review-reads.mjs` finds, for each review call a listed
 * session's transcripts (and the subagents and Codex rollouts beside them)
 * hold, the last such output before it: its read record.
 *
 * These transcripts are synthetic, built inline in the record shapes the
 * receipt check's tests use: an assistant record holding `tool_use` blocks,
 * a user record holding each `tool_result`, a subagent under
 * `<session id>/subagents/` with its `agent-<id>.meta.json` sidecar, and a
 * Codex rollout of `item_completed` command records. Paths inside them are
 * placeholders.
 *
 * Plan: docs/plans/2026-11-08-kod-44-merge-gate-plan.md, U1 and KTD3.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error -- no type declarations for this .mjs script
import * as reviewReads from "../skills/supervision-setup/scripts/review-reads.mjs";

const READ_SCRIPT = "skills/supervision-setup/scripts/review-read.mjs";
const SESSION = "4e440000-0000-4000-8000-000000000001";
const MODEL = "claude-opus-5-5";
const HEAD = "1111111111111111111111111111111111111111";
const BASE = "2a2b2c2d2e2f202122232425262728292a2b2c2d";
const OTHER = "3333333333333333333333333333333333333333";
/** The read command as a reviewer runs it from an installed plugin. */
const INSTALLED =
  "/Users/maintainer/.claude/plugins/cache/grove/grove/0.3.6/skills/supervision-setup/scripts/review-read.mjs";
const READ = `node ${INSTALLED} --checkout /Users/maintainer/work/repo --from origin/main`;
const REVIEW = "compound-engineering:ce-code-review";

type Review = {
  place: string;
  session: string;
  context: string;
  fresh: boolean;
  model: string | null;
  at: string | null;
  skill: string;
  args: string | null;
  outcome: string;
  head: string | null;
  clean: boolean | null;
  base: string | null;
  baseNamed: boolean | null;
};
type Listed = { session_id: string; path: string };
interface ReviewReadsModule {
  readReviewReads(
    listed: Listed[],
    options?: { skills?: string[] | null; rollouts?: string[] },
  ): { reviews: Review[]; missing: { session_id: string; path: string }[] };
  isReadCommand(line: string): boolean;
  readTriple(text: string): { head: string; status: number; base: string } | null;
  namesBase(args: string | null, base: string | null): boolean | null;
}
const { readReviewReads, isReadCommand, readTriple, namesBase } =
  reviewReads as unknown as ReviewReadsModule;

type Result = { content: unknown; is_error?: boolean } | null;
type Call = [Record<string, unknown>, Result];

const ok = (content: string): Result => ({ content, is_error: false });
const bash = (command: string) => ({ type: "tool_use", name: "Bash", input: { command } });
const skill = (name: string, args?: string) => ({
  type: "tool_use",
  name: "Skill",
  input: args === undefined ? { skill: name } : { skill: name, args },
});
/** The read command's three labelled lines. */
const labelled = (head = HEAD, status = 0, base = BASE) => `head ${head}\nstatus ${status}\nbase ${base}\n`;
/** The read command, run, printing its labelled lines. */
const read = (head = HEAD, status = 0, base = BASE): Call => [bash(READ), ok(labelled(head, status, base))];
/** The review performer, told to diff from a base. */
const review = (base = BASE, name = REVIEW): Call => [
  skill(name, `mode:agent base:${base}`),
  ok("Launching skill"),
];

const jsonl = (lines: unknown[]) => lines.map((line) => `${JSON.stringify(line)}\n`).join("");

/**
 * Claude Code transcript lines holding these calls in order, each in its own
 * assistant record with this model (none when null) and a timestamp, and each
 * answered by its result unless that is null.
 */
function claudeLines(calls: Call[], model: string | null = MODEL) {
  return calls.flatMap(([call, result], i) => {
    const id = `toolu_${i}_${Math.random().toString(36).slice(2)}`;
    const timestamp = `2026-11-08T10:${String(i).padStart(2, "0")}:00.000Z`;
    const message = { ...(model === null ? {} : { model }), content: [{ ...call, id }] };
    const lines: unknown[] = [{ type: "assistant", sessionId: SESSION, timestamp, message }];
    if (result) {
      const answer = { type: "tool_result", tool_use_id: id, ...result };
      lines.push({ type: "user", sessionId: SESSION, timestamp, message: { content: [answer] } });
    }
    return lines;
  });
}

type Subagent = { id: string; sidecar: Record<string, unknown> | null; calls: Call[]; model?: string | null };

const dirs: string[] = [];
function tempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A listed session whose main transcript holds `main`, with these subagents beside it. */
function session(main: Call[], ...subagents: Subagent[]): Listed[] {
  const dir = tempDir("review-reads-");
  const path = join(dir, `${SESSION}.jsonl`);
  writeFileSync(path, jsonl(claudeLines(main)));
  const subDir = join(dir, SESSION, "subagents");
  mkdirSync(subDir, { recursive: true });
  for (const sub of subagents) {
    writeFileSync(join(subDir, `agent-${sub.id}.jsonl`), jsonl(claudeLines(sub.calls, sub.model)));
    if (sub.sidecar) writeFileSync(join(subDir, `agent-${sub.id}.meta.json`), JSON.stringify(sub.sidecar));
  }
  return [{ session_id: SESSION, path }];
}

const FRESH_SIDECAR = { agentType: "general-purpose", description: "review" };
const FORK_SIDECAR = { agentType: "fork", isFork: true, toolUseId: "toolu_parent" };
/** A fresh reviewer subagent holding these calls. */
const reviewer = (...calls: Call[]): Subagent => ({ id: "a1", sidecar: FRESH_SIDECAR, calls });

/** The reviews these listed transcripts hold, failing on a missing one. */
function reviewsOf(listed: Listed[], options = {}) {
  const { reviews, missing } = readReviewReads(listed, options);
  expect(missing).toEqual([]);
  return reviews;
}

describe("read records from a Claude Code reviewer subagent", () => {
  it("a fresh subagent runs the read command, then the review with that base: one record", () => {
    const reviews = reviewsOf(session([], reviewer(read(), review())));
    expect(reviews).toEqual([
      {
        place: `${SESSION} subagent agent-a1`,
        session: SESSION,
        context: "fresh subagent",
        fresh: true,
        model: MODEL,
        at: "2026-11-08T10:01:00.000Z",
        skill: REVIEW,
        args: `mode:agent base:${BASE}`,
        outcome: "ran",
        head: HEAD,
        clean: true,
        base: BASE,
        baseNamed: true,
      },
    ]);
  });

  it("two read outputs before one review call: the record takes the later one", () => {
    const [record] = reviewsOf(session([], reviewer(read(OTHER, 0, OTHER), read(), review())));
    expect(record).toMatchObject({ head: HEAD, base: BASE, clean: true, baseNamed: true });
  });

  it("the same reads chained with other commands in one call, unlabelled: no read record", () => {
    const chained = `git rev-parse HEAD; git status --porcelain | wc -l; git merge-base HEAD origin/main`;
    const [record] = reviewsOf(session([], reviewer([bash(chained), ok(`${HEAD}\n0\n${BASE}\n`)], review())));
    expect(record).toMatchObject({ head: null, clean: null, base: null, baseNamed: null });
  });

  it.each([
    ["a `;`", `cd /Users/maintainer/work/repo; ${READ}`],
    ["a `&&`", `cd /Users/maintainer/work/repo && ${READ}`],
    ["a `||`", `${READ} || true`],
    ["a pipe", `${READ} | cat`],
    ["a background `&`", `${READ} &`],
    ["a newline", `true\n${READ}`],
    ["a `$(...)`", `node ${INSTALLED} --checkout $(pwd) --from origin/main`],
    ["backticks", `node ${INSTALLED} --checkout \`pwd\` --from origin/main`],
    ["a subshell", `(${READ})`],
    ["a redirection", `${READ} > /Users/maintainer/out.txt`],
    ["an input redirection", `${READ} < /dev/null`],
  ])("the read command chained with %s, even labelled: no read record", (_what, line) => {
    const [record] = reviewsOf(session([], reviewer([bash(line), ok(labelled())], review())));
    expect(record).toMatchObject({ head: null, base: null });
  });

  it("a review call whose arguments name a base other than the recorded one: not matching", () => {
    const [record] = reviewsOf(session([], reviewer(read(), review(OTHER))));
    expect(record).toMatchObject({ head: HEAD, base: BASE, baseNamed: false });
  });

  it("a non-empty status: the record says dirty", () => {
    const [record] = reviewsOf(session([], reviewer(read(HEAD, 3), review())));
    expect(record).toMatchObject({ head: HEAD, clean: false });
  });

  it("a fork subagent with a valid triple: the record is not fresh", () => {
    const fork = { id: "f1", sidecar: FORK_SIDECAR, calls: [read(), review()] };
    const [record] = reviewsOf(session([], fork));
    expect(record).toMatchObject({ context: "fork", fresh: false, head: HEAD, base: BASE });
  });

  it("a subagent with no sidecar: not fresh", () => {
    const bare = { id: "n1", sidecar: null, calls: [read(), review()] };
    const [record] = reviewsOf(session([], bare));
    expect(record).toMatchObject({ context: "subagent with no sidecar", fresh: false, head: HEAD });
  });

  it("the review call comes before any triple: a record with no head", () => {
    const [record] = reviewsOf(session([], reviewer(review(), read())));
    expect(record).toMatchObject({ head: null, clean: null, base: null, baseNamed: null });
  });

  it("a command line that names a SHA whose result is an error: no head taken", () => {
    const line = `node ${INSTALLED} --checkout /Users/maintainer/work/repo --from ${BASE}`;
    const failed = { content: "Exit code 1\nreview-read: not a git checkout", is_error: true };
    const [record] = reviewsOf(session([], reviewer([bash(line), failed], review())));
    expect(record).toMatchObject({ head: null, base: null });
  });

  it("an error result that still carries the labels: no head taken", () => {
    const failed = { content: `Exit code 1\n${labelled()}`, is_error: true };
    const [record] = reviewsOf(session([], reviewer([bash(READ), failed], review())));
    expect(record).toMatchObject({ head: null });
  });

  it("a read command with no result yet: no head taken", () => {
    const [record] = reviewsOf(session([], reviewer([bash(READ), null], review())));
    expect(record).toMatchObject({ head: null });
  });

  it("a later failed read keeps the earlier triple", () => {
    const failed = { content: "Exit code 1\nreview-read: no commit", is_error: true };
    const [record] = reviewsOf(session([], reviewer(read(), [bash(READ), failed], review())));
    expect(record).toMatchObject({ head: HEAD, base: BASE });
  });

  it("a hand-typed printf with the same three labelled lines: not credited", () => {
    const printf = `printf 'head ${HEAD}\\nstatus 0\\nbase ${BASE}\\n'`;
    const [record] = reviewsOf(session([], reviewer([bash(printf), ok(labelled())], review())));
    expect(record).toMatchObject({ head: null, base: null });
  });

  it("a result missing a label: no triple", () => {
    const partial = ok(`head ${HEAD}\nbase ${BASE}\n`);
    const [record] = reviewsOf(session([], reviewer([bash(READ), partial], review())));
    expect(record).toMatchObject({ head: null });
  });

  it("the main session's own review calls carry the main session's context, never fresh", () => {
    const [record] = reviewsOf(session([read(), review()]));
    expect(record).toMatchObject({ place: SESSION, context: "main session", fresh: false, head: HEAD });
  });

  it("reads each transcript apart: a triple in the main session does not reach a subagent's review", () => {
    const reviews = reviewsOf(session([read()], reviewer(review())));
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ fresh: true, head: null });
  });

  it("a model the transcript does not record is null", () => {
    const sub = { id: "m1", sidecar: FRESH_SIDECAR, calls: [read(), review()], model: null };
    const [record] = reviewsOf(session([], sub));
    expect(record?.model).toBeNull();
  });

  it("a Skill call with no args: args null, and the base is not named", () => {
    const [record] = reviewsOf(session([], reviewer(read(), [skill(REVIEW), ok("Launching skill")])));
    expect(record).toMatchObject({ args: null, head: HEAD, baseNamed: false });
  });

  it("a filter keeps only the review calls it names, by unqualified name", () => {
    const listed = session([], reviewer(read(), [skill("ce-work"), ok("ok")], review()));
    expect(reviewsOf(listed).map((r) => r.skill)).toEqual(["ce-work", REVIEW]);
    expect(reviewsOf(listed, { skills: ["ce-code-review"] }).map((r) => r.skill)).toEqual([REVIEW]);
    expect(reviewsOf(listed, { skills: ["other:ce-code-review"] }).map((r) => r.skill)).toEqual([REVIEW]);
    expect(reviewsOf(listed, { skills: ["doc-review"] })).toEqual([]);
  });

  it("a refused review call keeps its outcome", () => {
    const refused = { content: "<tool_use_error>denied</tool_use_error>", is_error: true };
    const [record] = reviewsOf(session([], reviewer(read(), [skill(REVIEW, BASE), refused])));
    expect(record).toMatchObject({ outcome: "failed", head: HEAD });
  });
});

describe("which command lines are the read command", () => {
  it.each([
    ["an absolute path in a plugin cache", READ],
    ["node with a double-quoted path", `node "${INSTALLED}" --checkout /Users/maintainer/work/repo --from main`],
    ["node with a single-quoted path", `node '${INSTALLED}' --from main --checkout '/Users/maintainer/a b'`],
    ["an absolute node", `/opt/homebrew/bin/node ${INSTALLED} --checkout . --from ${BASE}`],
    ["a relative path", "node scripts/review-read.mjs --checkout . --from origin/main"],
    ["the script with no node", `${INSTALLED} --checkout . --from main`],
    ["surrounding whitespace", `  ${READ}  `],
    ["quoted values", `node ${INSTALLED} --checkout "/Users/maintainer/work/repo" --from "origin/main"`],
  ])("recognises %s", (_what, line) => {
    expect(isReadCommand(line)).toBe(true);
  });

  it.each([
    ["another script", "node /Users/maintainer/review-reads.mjs --checkout . --from main"],
    ["a name that only ends like it", "node /Users/maintainer/my-review-read.mjs --checkout . --from main"],
    ["a missing --from", `node ${INSTALLED} --checkout .`],
    ["a missing value", `node ${INSTALLED} --checkout . --from`],
    ["an extra flag", `node ${INSTALLED} --checkout . --from main --json`],
    ["a repeated flag", `node ${INSTALLED} --checkout . --checkout . --from main`],
    ["an `=` form", `node ${INSTALLED} --checkout=. --from=main`],
    ["a node flag", `node --inspect ${INSTALLED} --checkout . --from main`],
    ["an env prefix", `GIT_DIR=/x node ${INSTALLED} --checkout . --from main`],
    ["a variable", `node ${INSTALLED} --checkout . --from $BASE`],
    ["an unterminated quote", `node "${INSTALLED} --checkout . --from main`],
    ["a different interpreter", `bun ${INSTALLED} --checkout . --from main`],
    ["an empty line", ""],
  ])("does not recognise %s", (_what, line) => {
    expect(isReadCommand(line)).toBe(false);
  });
});

describe("the labelled lines and the base a review names", () => {
  it("takes the three labelled lines, each once", () => {
    expect(readTriple(labelled(HEAD, 2, BASE))).toEqual({ head: HEAD, status: 2, base: BASE });
    expect(readTriple(`head ${HEAD}\nstatus 0\n`)).toBeNull();
    expect(readTriple(`${labelled()}head ${OTHER}\n`)).toBeNull();
    expect(readTriple(`head ${HEAD.slice(0, 39)}\nstatus 0\nbase ${BASE}\n`)).toBeNull();
  });

  it("names the base by its full sha or a word-bounded prefix of at least seven hex chars", () => {
    expect(namesBase(`base:${BASE}`, BASE)).toBe(true);
    expect(namesBase(`diff from ${BASE.slice(0, 7)} please`, BASE)).toBe(true);
    expect(namesBase(`diff from ${BASE.slice(0, 7).toUpperCase()}`, BASE)).toBe(true);
    expect(namesBase(`diff from ${BASE.slice(0, 6)}`, BASE)).toBe(false);
    expect(namesBase(`diff from ${OTHER}`, BASE)).toBe(false);
    expect(namesBase(`diff from x${BASE.slice(0, 12)}`, BASE)).toBe(false);
    expect(namesBase(null, BASE)).toBe(false);
    expect(namesBase(`base:${BASE}`, null)).toBeNull();
  });

  it("a review naming a 7-char prefix of the recorded base matches", () => {
    const short: Call = [skill(REVIEW, `base:${BASE.slice(0, 7)}`), ok("ok")];
    const [record] = reviewsOf(session([], reviewer(read(), short)));
    expect(record?.baseNamed).toBe(true);
  });
});

const ROLLOUT_ID = "01a40000-0000-7000-8000-0000000000f1";

/** A Codex `CommandExecution` record running this line, completed unless said, printing `stdout`. */
function command(line: string, stdout: string, status = "completed", skillName?: string) {
  const part = skillName
    ? { type: "read", cmd: line, name: "SKILL.md", path: `/Users/maintainer/.codex/skills/${skillName}/SKILL.md` }
    : { type: "unknown", cmd: line };
  const item = {
    type: "CommandExecution",
    id: `cmd-${Math.random().toString(36).slice(2)}`,
    command: ["/bin/zsh", "-lc", line],
    parsed_cmd: [part],
    status,
    ...(status === "completed" ? { exit_code: 0 } : { exit_code: 1 }),
    stdout,
    stderr: "",
  };
  return { type: "event_msg", timestamp: "2026-11-08T11:00:00.000Z", payload: { type: "item_completed", item } };
}

/** A Codex rollout holding these records, forked from a thread when `forkedFrom` names one. */
function rollout(records: unknown[], forkedFrom: string | null = null) {
  const day = join(tempDir("review-reads-codex-"), "sessions", "2026", "11", "08");
  mkdirSync(day, { recursive: true });
  const path = join(day, `rollout-2026-11-08T11-00-00-${ROLLOUT_ID}.jsonl`);
  const meta = { type: "session_meta", payload: { id: ROLLOUT_ID, ...(forkedFrom && { forked_from_id: forkedFrom }) } };
  writeFileSync(path, jsonl([meta, ...records]));
  return path;
}

const CODEX_REVIEW = command(
  "sed -n '1,200p' /Users/maintainer/.codex/skills/ce-code-review/SKILL.md",
  "---\nname: ce-code-review\n---\n",
  "completed",
  "ce-code-review",
);

describe("read records from a Codex rollout", () => {
  it("a rollout given by the caller with the read command and no forked_from_id: one fresh record", () => {
    const path = rollout([command(READ, labelled()), CODEX_REVIEW]);
    const { reviews, missing } = readReviewReads([], { rollouts: [path] });
    expect(missing).toEqual([]);
    expect(reviews).toEqual([
      {
        place: ROLLOUT_ID,
        session: ROLLOUT_ID,
        context: "fresh subagent",
        fresh: true,
        model: null,
        at: "2026-11-08T11:00:00.000Z",
        skill: "ce-code-review",
        args: null,
        outcome: "ran",
        head: HEAD,
        clean: true,
        base: BASE,
        baseNamed: false,
      },
    ]);
  });

  it("a rollout with forked_from_id: not fresh", () => {
    const path = rollout([command(READ, labelled()), CODEX_REVIEW], "01a40000-0000-7000-8000-0000000000aa");
    const [record] = readReviewReads([], { rollouts: [path] }).reviews;
    expect(record).toMatchObject({ context: "fork", fresh: false, head: HEAD });
  });

  it("a failed or chained read command in a rollout: no head taken", () => {
    const failed = command(READ, labelled(), "failed");
    const chained = command(`cd /Users/maintainer/work/repo && ${READ}`, labelled());
    const path = rollout([failed, chained, CODEX_REVIEW]);
    const [record] = readReviewReads([], { rollouts: [path] }).reviews;
    expect(record).toMatchObject({ head: null, base: null });
  });

  it("a listed Codex rollout is the main session", () => {
    const path = rollout([command(READ, labelled()), CODEX_REVIEW]);
    const [record] = reviewsOf([{ session_id: ROLLOUT_ID, path }]);
    expect(record).toMatchObject({ place: ROLLOUT_ID, context: "main session", fresh: false, head: HEAD });
  });
});

describe("missing transcripts", () => {
  it("a transcript that is listed but missing is reported for the caller to turn into exit 2", () => {
    const path = "/Users/maintainer/.claude/projects/-gone/4e440000-0000-4000-8000-0000000000ff.jsonl";
    const listed = [{ session_id: "4e440000-0000-4000-8000-0000000000ff", path }];
    expect(readReviewReads(listed)).toEqual({ reviews: [], missing: listed });
  });

  it("a rollout given by the caller that is missing is reported too", () => {
    const path = "/Users/maintainer/.codex/sessions/2026/11/08/rollout-gone.jsonl";
    expect(readReviewReads([], { rollouts: [path] }).missing).toEqual([{ session_id: null, path }]);
  });
});

describe("the read command against a git checkout", () => {
  const git = (dir: string, ...args: string[]) =>
    execFileSync(
      "git",
      ["-C", dir, "-c", "user.name=Maintainer", "-c", "user.email=maintainer@example.invalid", "-c", "commit.gpgsign=false", ...args],
      { encoding: "utf8" },
    ).trim();
  const run = (...args: string[]) => spawnSync(process.execPath, [READ_SCRIPT, ...args], { encoding: "utf8" });

  /** A repo with one commit on `main` and one more on `feature`, checked out. */
  function repo() {
    const dir = tempDir("review-read-git-");
    git(dir, "init", "-q", "-b", "main");
    writeFileSync(join(dir, "a.txt"), "a\n");
    git(dir, "add", "a.txt");
    git(dir, "commit", "-q", "-m", "a");
    const base = git(dir, "rev-parse", "HEAD");
    git(dir, "checkout", "-q", "-b", "feature");
    writeFileSync(join(dir, "b.txt"), "b\n");
    git(dir, "add", "b.txt");
    git(dir, "commit", "-q", "-m", "b");
    return { dir, base, head: git(dir, "rev-parse", "HEAD") };
  }

  it("a clean checkout prints its head, status 0 and the merge-base with --from", () => {
    const { dir, base, head } = repo();
    const result = run("--checkout", dir, "--from", "main");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`head ${head}\nstatus 0\nbase ${base}\n`);
    expect(readTriple(result.stdout)).toEqual({ head, status: 0, base });
  });

  it("a dirty file makes status 1", () => {
    const { dir } = repo();
    writeFileSync(join(dir, "a.txt"), "changed\n");
    const result = run("--from", "main", "--checkout", dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^status 1$/m);
  });

  it("a folder that is not a git checkout: non-zero, a reason on stderr, no labelled line", () => {
    const dir = tempDir("review-read-plain-");
    const result = run("--checkout", dir, "--from", "main");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/review-read:/);
    expect(result.stdout).not.toMatch(/^(head|status|base) /m);
  });

  it("a --from that does not resolve to a commit: non-zero, no labelled line", () => {
    const { dir } = repo();
    const result = run("--checkout", dir, "--from", "no-such-branch");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/review-read:/);
    expect(result.stdout).not.toMatch(/^(head|status|base) /m);
  });

  it("a missing flag: non-zero, no labelled line", () => {
    const { dir } = repo();
    const result = run("--checkout", dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/review-read:/);
    expect(result.stdout).toBe("");
  });
});
