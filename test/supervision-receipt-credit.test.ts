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

/** One call at a time, or none (untimed) when null. */
type Timed = [string | null, Record<string, unknown>];

const skill = (name: string) => ({ type: "tool_use", name: "Skill", input: { skill: name } });
const bash = (command: string) => ({ type: "tool_use", name: "Bash", input: { command } });
const tool = (name: string) => ({ type: "tool_use", name, input: {} });

/** A transcript holding these calls in order, each answered, each record at its call's time. */
function transcript(calls: Timed[]) {
  return calls
    .flatMap(([at, call], i) => {
      const id = `toolu_${i}_${Math.random().toString(36).slice(2)}`;
      const time = at ? { timestamp: at } : {};
      const answer = { type: "tool_result", tool_use_id: id, content: "ok", is_error: false };
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

  it("leaves a call only one operation binds unshared", () => {
    const result = checkReceipts({ bindings: bindingsOf([null, tool("SendMessage")]) });
    const row = rowOf(result, "story-worker/hand-back");
    expect(row.state).toBe("used");
    expect(row.shared).toBeUndefined();
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

  it("keeps every call of a session where the level skill never loaded, and says so", () => {
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
