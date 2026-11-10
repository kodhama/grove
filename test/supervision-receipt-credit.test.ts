/**
 * The receipt check credits an operation only for calls that could be its
 * own, and says plainly where it cannot tell.
 *
 * - Shared performers: where one call matches the bindings of several
 *   operations, as session-restart's four herdr operations, each reads
 *   `used (shared)`, names the others, and still passes.
 * - Scope: a session's calls count from the first call that loaded the level
 *   skill, so a session that led a run before it worked a story credits
 *   none of the leading. A session where the level skill never loads keeps
 *   every call and says so.
 * - `--since <UTC>`: calls before a story's start do not count, so a session
 *   that ran an earlier story credits none of its reviews.
 *
 * Transcripts here are synthetic, in the record shapes the check reads, with
 * the top-level `timestamp` real Claude Code records carry.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error -- no type declarations for this .mjs script
import * as receiptCheck from "../skills/supervision-setup/scripts/receipt-check.mjs";
// @ts-expect-error -- no type declarations for this .mjs script
import { readHandoff } from "../skills/supervision-setup/scripts/handoff-receipt.mjs";

const SCRIPT = "skills/supervision-setup/scripts/receipt-check.mjs";
const EXAMPLE = "test/fixtures/supervision/bindings.example.json";
const SESSION = "5e550000-0000-4000-8000-000000000001";
const HERDR_OPS = ["read-pane", "type-into-pane", "relay-report", "launch-session"];

type Row = { table: string; id: string; state: string; where?: string; shared?: string[] };
type Result = {
  operations: Row[];
  unbound: { name: string; where: string }[];
  transcripts: { session_id: string; scope?: string }[];
};
interface ReceiptCheckModule {
  checkReceipts(options: { bindings: unknown; since?: string | null; handoff?: string }): Result;
}
const { checkReceipts } = receiptCheck as unknown as ReceiptCheckModule;

/** One call at a time, or none (untimed) when null, and its result's text, "ok" when not given. */
type Timed = [string | null, Record<string, unknown>, string?];

const skill = (name: string, args?: string) => ({
  type: "tool_use",
  name: "Skill",
  input: args === undefined ? { skill: name } : { skill: name, args },
});
const bash = (command: string) => ({ type: "tool_use", name: "Bash", input: { command } });
const tool = (name: string) => ({ type: "tool_use", name, input: {} });

/** A transcript holding these calls in order, each answered, each record at its call's time. */
function transcript(calls: Timed[]) {
  return calls
    .flatMap(([at, call, content = "ok"], i) => {
      const id = `toolu_${i}_${Math.random().toString(36).slice(2)}`;
      const time = at ? { timestamp: at } : {};
      const answer = { type: "tool_result", tool_use_id: id, content, is_error: false };
      return [
        { type: "assistant", sessionId: SESSION, ...time, message: { content: [{ ...call, id }] } },
        { type: "user", sessionId: SESSION, ...time, message: { content: [answer] } },
      ];
    })
    .map((line) => `${JSON.stringify(line)}\n`)
    .join("");
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "receipt-credit-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** The example bindings reading one session whose main transcript holds these calls. */
function bindingsOf(...calls: Timed[]) {
  const path = join(dir, `${SESSION}.jsonl`);
  writeFileSync(path, transcript(calls));
  const file = JSON.parse(readFileSync(EXAMPLE, "utf8"));
  file.transcripts = [{ session_id: SESSION, path }];
  return file;
}

/** Give the session a fresh-context subagent holding these calls. */
function subagent(id: string, ...calls: Timed[]) {
  const sub = join(dir, SESSION, "subagents");
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(sub, `agent-${id}.jsonl`), transcript(calls));
  writeFileSync(join(sub, `agent-${id}.meta.json`), JSON.stringify({ agentType: "general-purpose" }));
}

function rowOf(result: Result, key: string) {
  const row = result.operations.find((o) => `${o.table}/${o.id}` === key);
  if (!row) throw new Error(`no row for ${key}`);
  return row;
}

/** The check run from the command line on this bindings file, with these extra arguments. */
function run(file: unknown, ...args: string[]) {
  const path = join(dir, "bindings.json");
  writeFileSync(path, JSON.stringify(file));
  return spawnSync("node", [SCRIPT, "--bindings", path, ...args], { encoding: "utf8" });
}

describe("a call several operations' bindings match", () => {
  it("marks each herdr operation used (shared), naming the others", () => {
    const result = checkReceipts({ bindings: bindingsOf([null, bash("herdr agent list")]) });
    for (const op of HERDR_OPS) {
      const row = rowOf(result, `session-restart/${op}`);
      expect(row.state).toBe("used");
      expect(row.shared).toEqual(
        HERDR_OPS.filter((other) => other !== op).map((other) => `session-restart/${other}`),
      );
    }
  });

  it("credits a call of the pane-tool adapter named after the bound binary, and no other adapter", () => {
    const adapter = "/Users/maintainer/grove/skills/supervision-setup/scripts/adapter";
    const used = checkReceipts({
      bindings: bindingsOf([null, bash(`"${adapter}/herdr.sh" --bin /opt/homebrew/bin/herdr get w1:p2`)]),
    });
    for (const op of HERDR_OPS) expect(rowOf(used, `session-restart/${op}`).state).toBe("used");
    for (const other of [`"${adapter}/orca.sh" get w1:p2`, `/Users/maintainer/bin/herdr.sh get w1:p2`]) {
      const result = checkReceipts({ bindings: bindingsOf([null, bash(other)]) });
      for (const op of HERDR_OPS) expect(rowOf(result, `session-restart/${op}`).state, other).not.toBe("used");
    }
  });

  it("leaves a call only one operation binds unshared", () => {
    const result = checkReceipts({ bindings: bindingsOf([null, tool("SendMessage")]) });
    const row = rowOf(result, "story-worker/hand-back");
    expect(row.state).toBe("used");
    expect(row.shared).toBeUndefined();
  });

  it("leaves out of shared a fresh_context operation the call could not credit", () => {
    const file = bindingsOf([null, tool("SendMessage")]);
    const review = file.operations.find((o: Row) => `${o.table}/${o.id}` === "story-worker/review");
    Object.assign(review, { kind: "tool", native_id: "SendMessage" });
    const result = checkReceipts({ bindings: file });
    const row = rowOf(result, "story-worker/hand-back");
    expect(row.state).toBe("used");
    expect(row.shared).toBeUndefined();
    expect(rowOf(result, "story-worker/review").state).not.toBe("used");
  });

  it("keeps in shared a fresh_context operation a call in a fresh-context subagent could credit", () => {
    const file = bindingsOf();
    subagent("a1", [null, tool("SendMessage")]);
    const review = file.operations.find((o: Row) => `${o.table}/${o.id}` === "story-worker/review");
    Object.assign(review, { kind: "tool", native_id: "SendMessage" });
    const result = checkReceipts({ bindings: file });
    expect(rowOf(result, "story-worker/hand-back").shared).toEqual(["story-worker/review"]);
    expect(rowOf(result, "story-worker/review").shared).toEqual(["story-worker/hand-back"]);
  });

  it("says so on the line, passes, and counts it apart in the summary", () => {
    const out = run(bindingsOf([null, bash("herdr agent list")]), "--not-run", "story-worker/plan").stdout;
    expect(out).toMatch(
      new RegExp(
        String.raw`^session-restart/read-pane: used \(shared\): /opt/homebrew/bin/herdr in ${SESSION}; ` +
          String.raw`also bound to session-restart/type-into-pane, session-restart/relay-report, ` +
          String.raw`session-restart/launch-session; the check cannot tell which ran$`,
        "m",
      ),
    );
    expect(out).toMatch(/^summary: 0 used, 4 used \(shared\), \d+ bound-but-unused, /m);
  });

  it("exits 0 when the only rows are shared ones", () => {
    const file = bindingsOf([null, bash("herdr agent list")]);
    file.operations = file.operations.filter((o: Row) => o.table === "session-restart" && HERDR_OPS.includes(o.id));
    // Record the table's and the override's sha256 as setup would now, so only the rows decide the exit.
    const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
    Object.assign(file.table, { sha256: sha256(file.table.path), override_sha256: sha256(file.table.override) });
    const result = run(file);
    expect(result.stdout).toMatch(/^summary: 0 used, 4 used \(shared\), 0 bound-but-unused, /m);
    expect(result.status).toBe(0);
  });

  it("carries a used (shared) line across a handoff", () => {
    const handoff = join(dir, "handoff.md");
    writeFileSync(
      handoff,
      [
        "## Receipt check",
        "",
        `session-restart/read-pane: used (shared): /opt/homebrew/bin/herdr in ${SESSION} (carried from handoff); ` +
          "also bound to session-restart/relay-report; the check cannot tell which ran",
        "",
      ].join("\n"),
    );
    const { used } = readHandoff(handoff);
    expect(used.get("session-restart/read-pane")).toEqual({
      performer: "/opt/homebrew/bin/herdr",
      session: SESSION,
      child: null,
      place: SESSION,
    });
  });
});

describe("calls count from the load of the level skill", () => {
  const led = (load: boolean): Timed[] => [
    ["2026-10-08T10:00:00.000Z", skill("grove:project-lead")],
    ["2026-10-08T10:01:00.000Z", tool("mcp__claude_ai_Linear__save_comment")],
    ...(load ? ([["2026-10-08T10:02:00.000Z", skill("grove:story-worker")]] as Timed[]) : []),
    ["2026-10-08T10:03:00.000Z", skill("compound-engineering:ce-work")],
  ];

  it("credits no call made before the level skill loaded, and leaves skills used then out of unbound", () => {
    const result = checkReceipts({ bindings: bindingsOf(...led(true)) });
    expect(rowOf(result, "story-worker/post-work-note").state).toBe("bound-but-unused");
    expect(rowOf(result, "story-worker/build").state).toBe("used");
    expect(result.unbound).toEqual([]);
  });

  it("drops a subagent's calls made before the level skill loaded", () => {
    const bindings = bindingsOf(["2026-10-08T10:05:00.000Z", skill("grove:story-worker")]);
    subagent("early", ["2026-10-08T10:04:00.000Z", skill("code-review")]);
    expect(rowOf(checkReceipts({ bindings }), "story-worker/review").state).toBe("bound-but-unused");
  });

  it("keeps every call of a session where no load of the level skill is found, and says so", () => {
    const bindings = bindingsOf(...led(false));
    const result = checkReceipts({ bindings });
    expect(rowOf(result, "story-worker/post-work-note").state).toBe("used");
    expect(result.unbound.map((u) => u.name)).toEqual(["grove:project-lead"]);
    expect(run(bindings).stdout).toMatch(
      new RegExp(`^transcript ${SESSION}: read .*no load of story-worker found here, so every call counts`, "m"),
    );
  });

  it("names when the level skill loaded on the transcript's line", () => {
    expect(run(bindingsOf(...led(true))).stdout).toMatch(
      new RegExp(`^transcript ${SESSION}: read .*counted from 2026-10-08T10:02:00.000Z, when story-worker loaded`, "m"),
    );
  });

  it("counts a successor's resume steps, made after it loaded the restart skill and before the level skill", () => {
    const file = bindingsOf(
      ["2026-10-08T10:00:00.000Z", skill("grove:session-restart")],
      ["2026-10-08T10:01:00.000Z", tool("mcp__claude_ai_Linear__list_comments")],
      ["2026-10-08T10:02:00.000Z", skill("grove:story-worker")],
    );
    // A successor on another machine: the session before it is listed, but its transcript is not here.
    file.transcripts.unshift({ session_id: "0dd00000-0000-4000-8000-000000000002", path: join(dir, "elsewhere.jsonl") });
    expect(rowOf(checkReceipts({ bindings: file }), "session-restart/read-work-notes").state).toBe("used");
    expect(run(file).stdout).toMatch(
      new RegExp(`^transcript ${SESSION}: read .*counted from 2026-10-08T10:00:00.000Z, when session-restart loaded to resume`, "m"),
    );
  });

  it("reaches back no further than the last load of the restart skill before the level skill", () => {
    const file = bindingsOf(
      ["2026-10-08T09:00:00.000Z", skill("grove:session-restart")],
      ["2026-10-08T09:30:00.000Z", tool("mcp__claude_ai_Linear__list_comments")],
      ["2026-10-08T09:59:00.000Z", skill("grove:session-restart")],
      ["2026-10-08T10:02:00.000Z", skill("grove:story-worker")],
    );
    file.transcripts.unshift({ session_id: "0dd00000-0000-4000-8000-000000000002", path: join(dir, "elsewhere.jsonl") });
    expect(rowOf(checkReceipts({ bindings: file }), "session-restart/read-work-notes").state).not.toBe("used");
  });

  it("never moves the cut in the first session the bindings list, which did not resume", () => {
    const result = checkReceipts({
      bindings: bindingsOf(
        ["2026-10-08T09:00:00.000Z", skill("grove:project-lead")],
        ["2026-10-08T09:10:00.000Z", skill("grove:session-restart")],
        ["2026-10-08T09:30:00.000Z", tool("mcp__claude_ai_Linear__save_comment")],
        ["2026-10-08T09:40:00.000Z", tool("mcp__claude_ai_Linear__list_comments")],
        ["2026-10-08T10:00:00.000Z", skill("grove:story-worker")],
      ),
    });
    expect(rowOf(result, "story-worker/post-work-note").state).toBe("bound-but-unused");
    expect(rowOf(result, "session-restart/read-work-notes").state).toBe("bound-but-unused");
  });

  it("keeps the level skill's load as the cut when the restart skill loads only after it", () => {
    const bindings = bindingsOf(...led(true), ["2026-10-08T10:04:00.000Z", skill("grove:session-restart")]);
    expect(rowOf(checkReceipts({ bindings }), "story-worker/post-work-note").state).toBe("bound-but-unused");
  });

  it("does not scope a session whose calls carry no time", () => {
    const untimed = led(true).map(([, call]) => [null, call] as Timed);
    const result = checkReceipts({ bindings: bindingsOf(...untimed) });
    expect(rowOf(result, "story-worker/post-work-note").state).toBe("used");
  });
});

describe("--since: calls before the story's start do not count", () => {
  const twoReviews = () => {
    const bindings = bindingsOf(["2026-10-08T09:00:00.000Z", skill("grove:story-worker")]);
    subagent("earlierstory", ["2026-10-08T09:30:00.000Z", skill("code-review")]);
    subagent("thisstory", ["2026-10-08T11:30:00.000Z", skill("code-review")]);
    return bindings;
  };

  it("credits the review from this story, not an earlier one in the same session", () => {
    const row = rowOf(checkReceipts({ bindings: twoReviews(), since: "2026-10-08T11:00:00Z" }), "story-worker/review");
    expect(row.state).toBe("used");
    expect(row.where).toBe(`${SESSION} subagent agent-thisstory`);
  });

  it("reads a review made only before it as unused", () => {
    const result = checkReceipts({ bindings: twoReviews(), since: "2026-10-08T12:00:00Z" });
    expect(rowOf(result, "story-worker/review").state).toBe("bound-but-unused");
  });

  it("says on the report that it applied", () => {
    expect(run(twoReviews(), "--since", "2026-10-08T11:00:00Z").stdout).toMatch(
      /^since 2026-10-08T11:00:00Z: calls before it are not counted$/m,
    );
  });

  it("exits 2 on a time it cannot read", () => {
    const result = run(twoReviews(), "--since", "yesterday");
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/--since/);
  });

  it("exits 2 on a Started value written as a plain date and time, naming the format in one line", () => {
    const result = run(twoReviews(), "--since", "2026-10-08 11:00");
    expect(result.status).toBe(2);
    expect(result.stderr.split("\n")[0]).toMatch(/--since 2026-10-08 11:00 .*YYYY-MM-DDTHH:MM:SSZ/);
  });

  it("exits 2 on a time with no zone, rather than read it as the machine's local time", () => {
    expect(run(twoReviews(), "--since", "2026-10-08T11:00:00").status).toBe(2);
  });
});

describe("edges of the scope and the time", () => {
  it("says when the level skill loaded at no recorded time", () => {
    const bindings = bindingsOf([null, skill("grove:story-worker")], ["2026-10-08T10:03:00.000Z", tool("SendMessage")]);
    expect(run(bindings).stdout).toMatch(
      new RegExp(`^transcript ${SESSION}: read .*story-worker loaded at no recorded time, so every call counts`, "m"),
    );
  });

  it("reads a --since with an offset zone at the same instant as its UTC form", () => {
    const bindings = bindingsOf(["2026-10-08T09:00:00.000Z", skill("grove:story-worker")]);
    subagent("earlierstory", ["2026-10-08T09:30:00.000Z", skill("code-review")]);
    subagent("thisstory", ["2026-10-08T11:30:00.000Z", skill("code-review")]);
    const row = rowOf(checkReceipts({ bindings, since: "2026-10-08T12:00:00+01:00" }), "story-worker/review");
    expect(row.where).toBe(`${SESSION} subagent agent-thisstory`);
  });

  it("exits 2 on a date the calendar does not have", () => {
    const bindings = bindingsOf(["2026-10-08T09:00:00.000Z", skill("grove:story-worker")]);
    expect(run(bindings, "--since", "2026-02-30T00:00:00Z").status).toBe(2);
    expect(run(bindings, "--since", "2026-10-08T24:00:00Z").status).toBe(2);
  });

  it("credits a carried used (shared) line for an unread session, and reports it shared", () => {
    const file = JSON.parse(readFileSync(EXAMPLE, "utf8"));
    file.transcripts = [{ session_id: SESSION, path: join(dir, `${SESSION}.jsonl`) }];
    const handoff = join(dir, "handoff.md");
    const used = (op: string) =>
      `session-restart/${op}: used (shared): /opt/homebrew/bin/herdr in ${SESSION}; ` +
      "also bound to the others; the check cannot tell which ran";
    writeFileSync(handoff, ["## Receipt check", "", `transcript ${SESSION}: read x (0 subagent files)`, ...HERDR_OPS.map(used), ""].join("\n"));
    const row = rowOf(checkReceipts({ bindings: file, handoff }), "session-restart/read-pane");
    expect(row.state).toBe("used");
    expect(row.where).toBe(`${SESSION} (carried from handoff)`);
    expect(row.shared).toHaveLength(3);
  });
});

describe("a Codex rollout's calls count from the level skill's SKILL.md read", () => {
  const THREAD = "01a30000-0000-7000-8000-0000000000f0";
  const read = (at: string, skillName: string) => ({
    timestamp: at,
    type: "event_msg",
    payload: {
      type: "item_completed",
      item: {
        type: "CommandExecution",
        id: `cmd-${skillName}`,
        command: ["/bin/zsh", "-lc", `cat /codex/skills/${skillName}/SKILL.md`],
        parsed_cmd: [{ type: "read", cmd: "cat", name: "SKILL.md", path: `/codex/skills/${skillName}/SKILL.md` }],
        status: "completed",
        exit_code: 0,
      },
    },
  });
  const call = (at: string, name: string) => [
    { timestamp: at, type: "response_item", payload: { type: "function_call", name, call_id: `c-${name}`, arguments: "{}" } },
    { timestamp: at, type: "response_item", payload: { type: "function_call_output", call_id: `c-${name}`, output: "ok" } },
  ];
  const codexBindings = () => {
    const day = join(dir, "sessions", "2026", "10", "08");
    mkdirSync(day, { recursive: true });
    const path = join(day, `rollout-2026-10-08T10-00-00-${THREAD}.jsonl`);
    const records = [
      { timestamp: "2026-10-08T10:00:00.000Z", type: "session_meta", payload: { id: THREAD } },
      ...call("2026-10-08T10:01:00.000Z", "SendMessage"),
      read("2026-10-08T10:02:00.000Z", "story-worker"),
      read("2026-10-08T10:03:00.000Z", "ce-work"),
    ];
    writeFileSync(path, records.map((r) => `${JSON.stringify(r)}\n`).join(""));
    const file = JSON.parse(readFileSync(EXAMPLE, "utf8"));
    file.transcripts = [{ session_id: THREAD, path }];
    return file;
  };

  it("credits no call made before the load, and names when it loaded", () => {
    const bindings = codexBindings();
    const result = checkReceipts({ bindings });
    expect(rowOf(result, "story-worker/hand-back").state).toBe("bound-but-unused");
    expect(rowOf(result, "story-worker/build").state).toBe("used");
    expect(run(bindings).stdout).toMatch(
      new RegExp(`^transcript ${THREAD}: read .*counted from 2026-10-08T10:02:00.000Z, when story-worker loaded`, "m"),
    );
  });

  it("drops a call before --since", () => {
    const result = checkReceipts({ bindings: codexBindings(), since: "2026-10-08T10:04:00Z" });
    expect(rowOf(result, "story-worker/build").state).toBe("bound-but-unused");
  });
});

/**
 * KOD-15 (plan unit U5): until the plugin packaging goes, a machine can hold
 * a skill both as the plugin's `grove:<s>` and as the bare `<s>` the kodhama
 * CLI copies into a skills folder. A session bound under one keeps its credit
 * when it runs the other, so a session that started under the plugin keeps
 * working after the cut-over.
 */
describe("a plugin skill and its bare copy credit each other (KOD-15)", () => {
  const RESTART = "story-worker/restart-self";
  const LOAD: Timed = ["2026-10-08T10:00:00.000Z", skill("story-worker")];

  /** The example bindings with restart-self bound to this native id, reading these calls. */
  const boundTo = (nativeId: string, ...calls: Timed[]) => {
    const file = bindingsOf(LOAD, ...calls);
    file.operations.find((o: Row) => `${o.table}/${o.id}` === RESTART).native_id = nativeId;
    return file;
  };

  it.each([".claude/skills", ".agents/skills"])(
    "credits grove:<s> for a script run from the bare copy in ~/%s",
    (folder) => {
      const line = `/Users/maintainer/${folder}/session-restart/scripts/start-restart.sh --dry-run`;
      const bindings = boundTo("grove:session-restart", ["2026-10-08T10:01:00.000Z", bash(line)]);
      expect(rowOf(checkReceipts({ bindings }), RESTART).state).toBe("used");
    },
  );

  it("credits grove:<s> for a Skill call of the bare name", () => {
    const bindings = boundTo("grove:session-restart", ["2026-10-08T10:01:00.000Z", skill("session-restart")]);
    expect(rowOf(checkReceipts({ bindings }), RESTART).state).toBe("used");
  });

  it("credits the bare <s> setup binds for a script the plugin's copy still runs", () => {
    const line = "node /Users/maintainer/.claude/plugins/cache/grove/grove/0.2.13/skills/session-restart/scripts/start-restart.sh";
    const bindings = boundTo("session-restart", ["2026-10-08T10:01:00.000Z", bash(line)]);
    expect(rowOf(checkReceipts({ bindings }), RESTART).state).toBe("used");
  });

  it("counts a Skill call of the bare level skill as its load", () => {
    const bindings = bindingsOf(
      ["2026-10-08T09:59:00.000Z", skill("compound-engineering:ce-work")],
      LOAD,
      ["2026-10-08T10:01:00.000Z", tool("mcp__claude_ai_Linear__save_comment")],
    );
    const result = checkReceipts({ bindings });
    expect(rowOf(result, "story-worker/build").state).toBe("bound-but-unused");
    expect(rowOf(result, "story-worker/post-work-note").state).toBe("used");
  });
});

/**
 * KOD-44 (plan unit U2, KTD10): for an operation the routing table marks
 * `fresh_context`, the report prints one `used` line per creditable call, in
 * time order, each with the read record before it (`review-reads.mjs`) and
 * the call's arguments. A handoff carries every such line, so a restart keeps
 * every review. The verdict, and so the exit code, still comes from `judge`.
 */
describe("the receipt check lists every review and what it read (KOD-44 U2)", () => {
  const ESCALATION = "story-worker/review-escalation";
  const H1 = "1".repeat(40);
  const H2 = "2".repeat(40);
  const B1 = "b".repeat(40);
  const READ = "node /Users/maintainer/grove/skills/supervision-setup/scripts/review-read.mjs --checkout /c --from x";
  /** A read command and its triple, at this time. */
  const readAt = (at: string, head: string, base: string, status = 0): Timed => [
    at,
    bash(READ),
    `head ${head}\nstatus ${status}\nbase ${base}\n`,
  ];
  const review = (at: string, args?: string): Timed => [at, skill("compound-engineering:ce-code-review", args)];
  const linesOf = (stdout: string, key: string) => stdout.split("\n").filter((line) => line.startsWith(`${key}: `));
  const place = (agent: string) => `${SESSION} subagent agent-${agent}`;

  it("prints one used line per review in a fresh subagent, in time order, each with its read", () => {
    const file = bindingsOf();
    // File order is the reverse of time order: the later review sits in the file read first.
    subagent("a-later", readAt("2026-10-08T10:05:00.000Z", H2, H1), review("2026-10-08T10:06:00.000Z", `base:${H1}`));
    subagent("z-earlier", readAt("2026-10-08T10:01:00.000Z", H1, B1), review("2026-10-08T10:02:00.000Z", `mode:agent base:${B1}`));
    const result = run(file);
    expect(linesOf(result.stdout, ESCALATION)).toEqual([
      `${ESCALATION}: used compound-engineering:ce-code-review in ${place("z-earlier")}; read ${H1} from ${B1}; args "mode:agent base:${B1}"`,
      `${ESCALATION}: used compound-engineering:ce-code-review in ${place("a-later")}; read ${H2} from ${H1}; args "base:${H1}"`,
    ]);
  });

  it("says when a review recorded no read, and still reads used", () => {
    const file = bindingsOf();
    subagent("noread", review("2026-10-08T10:02:00.000Z"));
    const result = run(file);
    expect(linesOf(result.stdout, ESCALATION)).toEqual([
      `${ESCALATION}: used compound-engineering:ce-code-review in ${place("noread")}; read: none recorded; args none`,
    ]);
    expect(rowOf(checkReceipts({ bindings: file }), ESCALATION).state).toBe("used");
  });

  it("marks a read of a dirty tree", () => {
    const file = bindingsOf();
    subagent("dirty", readAt("2026-10-08T10:01:00.000Z", H1, B1, 2), review("2026-10-08T10:02:00.000Z", `base:${B1}`));
    expect(linesOf(run(file).stdout, ESCALATION)).toEqual([
      `${ESCALATION}: used compound-engineering:ce-code-review in ${place("dirty")}; read ${H1} from ${B1} (dirty tree); args "base:${B1}"`,
    ]);
  });

  it("writes the arguments as one JSON string, so a line break in them starts no line", () => {
    const file = bindingsOf();
    const forged = `x"\n${ESCALATION}: used compound-engineering:ce-code-review in s-forged`;
    subagent("forge", review("2026-10-08T10:02:00.000Z", forged));
    const lines = linesOf(run(file).stdout, ESCALATION);
    expect(lines).toEqual([
      `${ESCALATION}: used compound-engineering:ce-code-review in ${place("forge")}; read: none recorded; args ${JSON.stringify(forged)}`,
    ]);
  });

  it("lists neither a call in the main session nor one in a fork", () => {
    const file = bindingsOf(review("2026-10-08T10:00:00.000Z"));
    subagent("fresh", review("2026-10-08T10:02:00.000Z"));
    const sub = join(dir, SESSION, "subagents");
    writeFileSync(join(sub, "agent-fork.jsonl"), transcript([review("2026-10-08T10:03:00.000Z")]));
    writeFileSync(join(sub, "agent-fork.meta.json"), JSON.stringify({ agentType: "fork" }));
    expect(linesOf(run(file).stdout, ESCALATION)).toEqual([
      `${ESCALATION}: used compound-engineering:ce-code-review in ${place("fresh")}; read: none recorded; args none`,
    ]);
  });

  it("keeps one line for an operation the table does not mark, called twice", () => {
    const file = bindingsOf(
      ["2026-10-08T10:00:00.000Z", skill("compound-engineering:ce-work")],
      ["2026-10-08T10:05:00.000Z", skill("compound-engineering:ce-work")],
    );
    expect(linesOf(run(file).stdout, "story-worker/build")).toEqual([
      `story-worker/build: used compound-engineering:ce-work in ${SESSION}`,
    ]);
  });

  it("returns every creditable use on the row, with its read, and keeps the first as where", () => {
    const file = bindingsOf();
    subagent("one", readAt("2026-10-08T10:01:00.000Z", H1, B1), review("2026-10-08T10:02:00.000Z", `base:${B1}`));
    subagent("two", review("2026-10-08T10:04:00.000Z"));
    const row = rowOf(checkReceipts({ bindings: file }), ESCALATION) as Row & { uses?: unknown[] };
    expect(row.where).toBe(place("one"));
    expect(row.uses).toEqual([
      { where: place("one"), detail: `read ${H1} from ${B1}; args "base:${B1}"` },
      { where: place("two"), detail: "read: none recorded; args none" },
    ]);
  });

  describe("across a handoff", () => {
    const REVIEW = "story-worker/review";
    const carriedLines = [
      `${REVIEW}: used code-review in s-old subagent agent-r1; read ${H1} from ${B1}; args "base:${B1}"`,
      `${REVIEW}: used code-review in s-old subagent agent-r2 (carried from handoff); read: none recorded; args none`,
    ];
    const handoffOf = (...lines: string[]) => {
      const path = join(dir, "handoff.md");
      writeFileSync(path, ["## Receipt check", "", ...lines, ""].join("\n"));
      return path;
    };

    it("reads every used line for one operation, each place without its read or args", () => {
      const { used, all } = readHandoff(handoffOf(...carriedLines)) as {
        used: Map<string, unknown>;
        all: Map<string, unknown[]>;
      };
      const r1 = { performer: "code-review", session: "s-old", child: "agent-r1", place: "s-old subagent agent-r1" };
      const r2 = { performer: "code-review", session: "s-old", child: "agent-r2", place: "s-old subagent agent-r2" };
      expect(all.get(REVIEW)).toEqual([
        { ...r1, detail: `read ${H1} from ${B1}; args "base:${B1}"` },
        { ...r2, detail: "read: none recorded; args none" },
      ]);
      expect(used.get(REVIEW)).toEqual(all.get(REVIEW)?.[0]);
    });

    it("carries both, each labelled carried with its read and args kept, and counts both", () => {
      const result = run(bindingsOf(), "--handoff", handoffOf(...carriedLines));
      expect(linesOf(result.stdout, REVIEW)).toEqual([
        `${REVIEW}: used code-review in s-old subagent agent-r1 (carried from handoff); read ${H1} from ${B1}; args "base:${B1}"`,
        `${REVIEW}: used code-review in s-old subagent agent-r2 (carried from handoff); read: none recorded; args none`,
      ]);
      expect(result.stdout).toContain("(2 earlier uses carried)");
    });

    it("lists the carried reviews before this session's own", () => {
      const file = bindingsOf();
      subagent("now", review("2026-10-08T10:02:00.000Z"));
      const lines = linesOf(run(file, "--handoff", handoffOf(...carriedLines.map((l) => l.replace(REVIEW, ESCALATION).replace(" code-review ", " compound-engineering:ce-code-review ")))).stdout, ESCALATION);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain("agent-r1 (carried from handoff)");
      expect(lines[1]).toContain("agent-r2 (carried from handoff)");
      expect(lines[2]).toBe(
        `${ESCALATION}: used compound-engineering:ce-code-review in ${place("now")}; read: none recorded; args none`,
      );
    });

    it("round-trips: a report pasted into a handoff carries the same lines again", () => {
      const file = bindingsOf();
      subagent("one", readAt("2026-10-08T10:01:00.000Z", H1, B1), review("2026-10-08T10:02:00.000Z", `base:${B1}`));
      subagent("two", review("2026-10-08T10:04:00.000Z", "a; also bound to x"));
      const first = run(file);
      // A successor on another machine: the transcript is gone, the pasted report carries it.
      const gone = { ...file, transcripts: [{ session_id: SESSION, path: join(dir, "gone.jsonl") }] };
      const second = run(gone, "--handoff", handoffOf(...first.stdout.split("\n")));
      const strip = (line: string) => line.replace(" (carried from handoff)", "");
      expect(linesOf(second.stdout, ESCALATION).map(strip)).toEqual(linesOf(first.stdout, ESCALATION));
      expect(linesOf(second.stdout, ESCALATION).every((line) => line.includes("(carried from handoff)"))).toBe(true);
    });
  });
});
