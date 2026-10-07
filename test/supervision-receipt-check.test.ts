/**
 * MQ-353 — the receipt check proves from transcripts, not from a worker's
 * say-so, that each bound performer whose step ran was used.
 *
 * In plain words: a bindings file says which skill, tool, agent or command
 * should do each step of a story. `scripts/supervision/receipt-check.mjs`
 * reads every transcript the file lists (and the subagent transcripts beside
 * them) and reports, for each operation, whether its bound performer was
 * actually called.
 *
 * The fixtures under `test/fixtures/supervision/receipt-check/` are synthetic,
 * trimmed to the record shapes the script reads: Claude Code transcripts
 * (one with a subagent file, two across a restart, one negative control where
 * the build was done by hand) and a Codex rollout. Each Claude Code call has
 * its `tool_result`, and each Codex call its output or item record, as real
 * transcripts do; `claude-outcomes/` holds calls that were refused, ran with a
 * non-zero exit, or have no result yet, and `codex-outcomes/` holds a Codex
 * home (`sessions/`, `archived_sessions/`) with refused, failed and aborted
 * calls and lost or archived children, trimmed from real records. Each Claude
 * Code subagent has its `agent-<id>.meta.json` sidecar, which says whether it
 * is a fork; `claude-fresh-context/` holds a subagent in each context, and
 * `codex-fresh/` a Codex child forked from its parent and a fork of a fresh
 * child. The bindings are U4's `bindings.example.json`, with its transcript
 * list pointed at the fixtures; its routing table is the repo's own, which
 * marks the review operations `fresh_context`.
 *
 * Plan: docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md,
 * U8 and KTD12; outcomes and fresh-context review, MQ-377:
 * docs/plans/2026-10-04-0734-feat-receipt-check-credits-calls-that-ran-plan.md, U1-U4.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error -- no type declarations for this .mjs script
import * as receiptCheck from "../skills/supervision-setup/scripts/receipt-check.mjs";
// @ts-expect-error -- no type declarations for this .mjs script
import * as transcriptUses from "../skills/supervision-setup/scripts/transcript-uses.mjs";
// @ts-expect-error -- no type declarations for this .mjs script
import { shellUses } from "../skills/supervision-setup/scripts/shell-uses.mjs";
// @ts-expect-error -- no type declarations for this .mjs script
import { readRoutingTable } from "../skills/supervision-setup/scripts/routing-table.mjs";

const SCRIPT = "skills/supervision-setup/scripts/receipt-check.mjs";

const EXAMPLE = "test/fixtures/supervision/bindings.example.json";
const FIXTURES = "test/fixtures/supervision/receipt-check";
const BEFORE = "aaaa1111-0000-4000-8000-000000000001";
const AFTER = "bbbb2222-0000-4000-8000-000000000002";
const BY_HAND = "cccc3333-0000-4000-8000-000000000003";
const CODEX = "019a0000-0000-7000-8000-00000000c0de";
/** The Codex rollout fixture, as a bindings file lists it. */
const ROLLOUT = {
  session_id: CODEX,
  path: `${FIXTURES}/codex-sessions/2026/09/29/rollout-2026-09-29T13-26-58-${CODEX}.jsonl`,
};
const HANDOFF = `${FIXTURES}/handoff-with-receipt.md`;
/** The routing table the example bindings name, which marks the review operations. */
const TABLE = "skills/story-worker/routing.toml";

type Row = {
  table: string;
  id: string;
  performer: string | null;
  state: string;
  where?: string;
  note?: string;
};
type Result = {
  transcripts: {
    session_id: string;
    path: string;
    status: string;
    subagents: number;
    listed?: string;
  }[];
  operations: Row[];
  unbound: { name: string; where: string }[];
  handoff: { path: string; merged: number } | null;
};
interface ReceiptCheckModule {
  checkReceipts(options: { bindings: unknown; notRun?: string[]; handoff?: string | null }): Result;
}
const { checkReceipts } = receiptCheck as unknown as ReceiptCheckModule;

type Use = { kind: string; name: string; where: string; outcome: string };
interface TranscriptUsesModule {
  readTranscripts(listed: { session_id: string; path: string }[]): { uses: Use[] };
}
const { readTranscripts } = transcriptUses as unknown as TranscriptUsesModule;

type Bindings = {
  transcripts: { session_id: string; path: string }[];
  operations: Record<string, unknown>[];
  [key: string]: unknown;
};

function bindingsReading(...transcripts: [string, string][]): Bindings {
  const file = JSON.parse(readFileSync(EXAMPLE, "utf8")) as Bindings;
  file.transcripts = transcripts.map(([sessionId, dir]) => ({
    session_id: sessionId,
    path: `${FIXTURES}/${dir}/${sessionId}.jsonl`,
  }));
  return file;
}

/** The example bindings, reading one transcript or rollout. */
function reading(transcript: { session_id: string; path: string }): Bindings {
  const file = bindingsReading();
  file.transcripts = [transcript];
  return file;
}

/** The outcome of each use of one kind and name in these transcripts, in order. */
function outcomesOf(listed: { session_id: string; path: string }[], kind: string, name: string) {
  const { uses } = readTranscripts(listed);
  return uses.filter((u) => u.kind === kind && u.name === name).map((u) => u.outcome);
}

/**
 * A Claude Code transcript holding one call and, unless `result` is null, the
 * `tool_result` record that answers it, in the shape real transcripts carry.
 */
function transcriptOf(
  session: string,
  call: Record<string, unknown>,
  result: Record<string, unknown> | null = { content: "ok", is_error: false },
) {
  const id = `toolu_${Math.random().toString(36).slice(2)}`;
  const lines: unknown[] = [
    { type: "assistant", sessionId: session, message: { content: [{ ...call, id }] } },
  ];
  if (result) {
    const answer = { type: "tool_result", tool_use_id: id, ...result };
    lines.push({ type: "user", sessionId: session, message: { content: [answer] } });
  }
  return lines.map((line) => `${JSON.stringify(line)}\n`).join("");
}

type Call = [Record<string, unknown>, Record<string, unknown> | null];
/** A result refusing a call, in the shape a real Claude Code refusal carries (T1:155). */
const REFUSED = {
  content: "<tool_use_error>Permission for this action was denied</tool_use_error>",
  is_error: true,
};
/** The hand-back's bound performer, called. */
const SEND = { type: "tool_use", name: "SendMessage", input: { to: "lead", message: "done" } };

/**
 * The example bindings reading one transcript, written under `dir`, holding
 * these calls in order, each with its result, or none yet when null.
 */
function bindingsOfCalls(dir: string, ...calls: Call[]): Bindings {
  const session = "12120012-0000-4000-8000-000000000012";
  const path = join(dir, `${session}.jsonl`);
  writeFileSync(path, calls.map(([call, result]) => transcriptOf(session, call, result)).join(""));
  const file = bindingsReading();
  file.transcripts = [{ session_id: session, path }];
  return file;
}

/**
 * Give the session a bindings file reads a subagent transcript holding these
 * calls, with this sidecar, or none when null. Use a fresh `dir` for it.
 */
function withSubagent(
  file: Bindings,
  id: string,
  sidecar: Record<string, unknown> | null,
  ...calls: Call[]
): Bindings {
  const [main] = file.transcripts;
  if (!main) throw new Error("no transcript");
  const dir = join(main.path.replace(/\.jsonl$/, ""), "subagents");
  mkdirSync(dir, { recursive: true });
  const lines = calls.map(([call, result]) => transcriptOf(main.session_id, call, result));
  writeFileSync(join(dir, `agent-${id}.jsonl`), lines.join(""));
  if (sidecar) writeFileSync(join(dir, `agent-${id}.meta.json`), JSON.stringify(sidecar));
  return file;
}

/** The Codex threads `codexBindingsOf` writes: the one listed, and the child it starts. */
const CODEX_PARENT = "01a30000-0000-7000-8000-0000000000e0";
const CODEX_CHILD = "01a30000-0000-7000-8000-0000000000e1";

/**
 * A Codex `CommandExecution` record running this shell line, with no
 * `exit_code` when it is null; with `skill`, its `parsed_cmd` reads that
 * skill's SKILL.md.
 */
function commandRecord(line: string, status: string, exitCode: number | null, skill?: string) {
  const part = skill
    ? { type: "read", cmd: line, name: "SKILL.md", path: `/codex/skills/${skill}/SKILL.md` }
    : { type: "unknown", cmd: line };
  const item = {
    type: "CommandExecution",
    id: `cmd-${Math.random().toString(36).slice(2)}`,
    command: ["/bin/zsh", "-lc", line],
    parsed_cmd: [part],
    status,
    ...(exitCode === null ? {} : { exit_code: exitCode }),
  };
  return { type: "event_msg", payload: { type: "item_completed", item } };
}

/**
 * The example bindings reading one Codex rollout holding `records`, written in
 * a Codex home under `dir`. With `child`, it also starts a fresh child thread
 * whose rollout holds those records, or whose rollout is gone ("missing").
 */
function codexBindingsOf(
  dir: string,
  records: unknown[],
  child: unknown[] | "missing" | null = null,
): Bindings {
  const day = join(dir, "sessions", "2026", "10", "04");
  mkdirSync(day, { recursive: true });
  const jsonl = (lines: unknown[]) => lines.map((line) => `${JSON.stringify(line)}\n`).join("");
  const meta = (id: string) => ({ type: "session_meta", payload: { id } });
  const started = { type: "SubAgentActivity", id: "call_s1", kind: "started" };
  const start = {
    type: "event_msg",
    payload: { type: "item_completed", item: { ...started, agent_thread_id: CODEX_CHILD } },
  };
  const path = join(day, `rollout-2026-10-04T10-00-00-${CODEX_PARENT}.jsonl`);
  writeFileSync(path, jsonl([meta(CODEX_PARENT), ...records, ...(child ? [start] : [])]));
  if (Array.isArray(child)) {
    const childPath = join(day, `rollout-2026-10-04T10-00-01-${CODEX_CHILD}.jsonl`);
    writeFileSync(childPath, jsonl([meta(CODEX_CHILD), ...child]));
  }
  return reading({ session_id: CODEX_PARENT, path });
}

function stateOf(result: Result, id: string) {
  const [table, operation] = id.split("/");
  const row = result.operations.find((o) => o.table === table && o.id === operation);
  if (!row) throw new Error(`no row for ${id}`);
  return row.state;
}

describe("MQ-353 · the negative control", () => {
  it("reports build as bound-but-unused when the build was done by hand", () => {
    const result = checkReceipts({ bindings: bindingsReading([BY_HAND, "claude-built-by-hand"]) });
    expect(stateOf(result, "story-worker/build")).toBe("bound-but-unused");
  });
});

describe("MQ-353 · a skill bound on Claude Code (AE1)", () => {
  it("marks build used by a Skill call to compound-engineering:ce-work", () => {
    const result = checkReceipts({ bindings: bindingsReading([AFTER, "claude-after-restart"]) });
    expect(stateOf(result, "story-worker/build")).toBe("used");
  });
});

/** The example bindings with one operation rebound to another performer. */
function rebound(file: Bindings, id: string, kind: string, nativeId: string): Bindings {
  const [table, operation] = id.split("/");
  const binding = file.operations.find((o) => o.table === table && o.id === operation);
  if (!binding) throw new Error(`no binding ${id}`);
  Object.assign(binding, { kind, native_id: nativeId });
  return file;
}

describe("MQ-353 · where a use is found", () => {
  it("counts a Skill call found only in a subagent transcript", () => {
    const result = checkReceipts({ bindings: bindingsReading([BEFORE, "claude-before-restart"]) });
    expect(stateOf(result, "story-worker/review")).toBe("used");
    const review = result.operations.find((o) => o.id === "review");
    expect(review?.where).toContain("subagent");
    expect(result.transcripts[0]).toMatchObject({ status: "read", subagents: 1 });
  });

  it("marks build used on Codex when parsed_cmd reads the bound skill's SKILL.md", () => {
    const file = reading(ROLLOUT);
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/build")).toBe("used");
  });

  it("reads every transcript the bindings file lists, across a restart", () => {
    const result = checkReceipts({
      bindings: bindingsReading([BEFORE, "claude-before-restart"], [AFTER, "claude-after-restart"]),
    });
    expect(stateOf(result, "story-worker/plan")).toBe("used");
    expect(stateOf(result, "story-worker/build")).toBe("used");
    expect(result.transcripts.map((t) => t.status)).toEqual(["read", "read"]);
  });

  it("does not count a half-written last line", () => {
    const result = checkReceipts({ bindings: bindingsReading([BY_HAND, "claude-built-by-hand"]) });
    expect(stateOf(result, "story-worker/build")).toBe("bound-but-unused");
    expect(result.unbound).toEqual([]);
  });
});

describe("MQ-353 · text that only mentions a command", () => {
  it("does not read quoted text or a heredoc body as commands", () => {
    const quoted: [string, string] = ["ffff6666-0000-4000-8000-000000000006", "claude-quoted-text"];
    const file = rebound(
      bindingsReading(quoted),
      "story-worker/browser-test",
      "cli",
      "/usr/bin/gh",
    );
    const result = checkReceipts({ bindings: file });
    expect(stateOf(result, "session-restart/read-pane")).toBe("bound-but-unused");
    expect(stateOf(result, "story-worker/browser-test")).toBe("bound-but-unused");
  });
});

describe("MQ-353 · a Codex subagent", () => {
  it("reads the child rollout a SubAgentActivity names, in another date folder", () => {
    const result = checkReceipts({ bindings: reading(ROLLOUT) });
    const escalation = result.operations.find((o) => o.id === "review-escalation");
    expect(escalation).toMatchObject({ state: "used" });
    expect(escalation?.where).toContain("subagent 019a0000-0000-7000-8000-0000000c41d0");
    expect(result.transcripts[0]).toMatchObject({ status: "read", subagents: 1 });
  });
});

describe("MQ-353 · each kind of performer", () => {
  it("marks a CLI binding used by a Bash call whose command starts with it, after a cd", () => {
    const file = rebound(
      bindingsReading([BEFORE, "claude-before-restart"]),
      "story-worker/browser-test",
      "cli",
      "/opt/homebrew/bin/gh",
    );
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/browser-test")).toBe("used");
  });

  it("marks herdr used by a Bash call that sets a variable first", () => {
    const result = checkReceipts({ bindings: bindingsReading([BEFORE, "claude-before-restart"]) });
    expect(stateOf(result, "session-restart/read-pane")).toBe("used");
  });

  it("marks a CLI used when a command starts inside $( or a subshell's (", () => {
    for (const command of [
      "PR=$(gh pr view 1 --json url)",
      "(gh pr view 1)",
      "PR=$( gh pr view )",
    ]) {
      const dir = mkdtempSync(join(tmpdir(), "receipt-check-subshell-"));
      const session = "ffff6666-0000-4000-8000-000000000006";
      const call = { type: "tool_use", name: "Bash", input: { command } };
      writeFileSync(join(dir, `${session}.jsonl`), transcriptOf(session, call));
      const file = rebound(
        bindingsReading(),
        "story-worker/browser-test",
        "cli",
        "/opt/homebrew/bin/gh",
      );
      file.transcripts = [{ session_id: session, path: join(dir, `${session}.jsonl`) }];
      const state = stateOf(checkReceipts({ bindings: file }), "story-worker/browser-test");
      rmSync(dir, { recursive: true });
      expect(state, command).toBe("used");
    }
  });

  it("does not mark a CLI used by a command that only mentions it", () => {
    const file = rebound(
      bindingsReading([AFTER, "claude-after-restart"]),
      "story-worker/browser-test",
      "cli",
      "/usr/local/bin/test",
    );
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/browser-test")).toBe(
      "bound-but-unused",
    );
  });

  it("marks a CLI binding used by a Codex exec command", () => {
    const file = rebound(
      reading(ROLLOUT),
      "story-worker/browser-test",
      "cli",
      "/opt/homebrew/bin/gh",
    );
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/browser-test")).toBe("used");
  });

  it("marks a Codex MCP tool binding used by the McpToolCall item that ran it", () => {
    const file = rebound(
      reading(ROLLOUT),
      "story-worker/hand-back",
      "tool",
      "mcp__codex_apps__linear_save_comment",
    );
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/hand-back")).toBe("used");
  });

  it("marks a namespaced Codex tool binding used by the function call that ran it", () => {
    // A non-review operation: a review never counts from the author's own spawn (MQ-377).
    const file = rebound(
      reading(ROLLOUT),
      "story-worker/simplify",
      "tool",
      "collaboration.spawn_agent",
    );
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/simplify")).toBe("used");
  });

  it("marks apply_patch used by the FileChange a code-mode exec call's patch records", () => {
    const file = rebound(reading(ROLLOUT), "story-worker/hand-back", "tool", "apply_patch");
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/hand-back")).toBe("used");
  });

  it("marks an agent binding used by an Agent call with the bound type", () => {
    const file = rebound(
      bindingsReading([BEFORE, "claude-before-restart"]),
      "story-worker/simplify",
      "agent",
      "Explore",
    );
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/simplify")).toBe("used");
  });

  it("reads an Agent call with no type as general-purpose, the tool's default", () => {
    const file = rebound(
      bindingsReading([BEFORE, "claude-before-restart"]),
      "story-worker/simplify",
      "agent",
      "general-purpose",
    );
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/simplify")).toBe("used");
  });

  it("marks a tool binding used by a call to that tool", () => {
    const result = checkReceipts({ bindings: bindingsReading([BEFORE, "claude-before-restart"]) });
    expect(stateOf(result, "story-worker/hand-back")).toBe("used");
  });

  it("reports a fallback or unavailable binding as such, with nothing to detect", () => {
    const file = bindingsReading([BEFORE, "claude-before-restart"]);
    const [plan, build] = file.operations;
    Object.assign(plan ?? {}, { how_bound: "fallback", kind: "instructions", native_id: null });
    Object.assign(build ?? {}, { how_bound: "unavailable", kind: "none", native_id: null });
    const result = checkReceipts({ bindings: file });
    expect(stateOf(result, "story-worker/plan")).toBe("by fallback");
    expect(stateOf(result, "story-worker/build")).toBe("unavailable");
  });
});

describe("MQ-353 · a skill used through its own script", () => {
  it("counts a run of a file under the bound skill's own scripts folder as using the skill", () => {
    const result = checkReceipts({
      bindings: bindingsReading(["dddd4444-0000-4000-8000-000000000004", "claude-skill-script"]),
    });
    expect(stateOf(result, "story-worker/measure-context")).toBe("used");
    expect(stateOf(result, "session-restart/measure-context")).toBe("used");
  });

  it("does not count a script from another skill's folder, or a read of the bound one", () => {
    const result = checkReceipts({
      bindings: bindingsReading([
        "eeee5555-0000-4000-8000-000000000005",
        "claude-other-skill-script",
      ]),
    });
    expect(stateOf(result, "story-worker/measure-context")).toBe("bound-but-unused");
    expect(result.unbound).toEqual([]);
  });
});

describe("the checker runs from a plugin install, with no npm install", () => {
  it("reads a routing table's marked operations from a copy of supervision-setup with no node_modules", () => {
    const dir = mkdtempSync(join(tmpdir(), "receipt-check-no-modules-"));
    try {
      cpSync("skills/supervision-setup", join(dir, "supervision-setup"), { recursive: true });
      const table = resolve(TABLE);
      const script = `import { readRoutingTable } from "./supervision-setup/scripts/routing-table.mjs";
        const read = readRoutingTable({ skill: "story-worker", table: { path: ${JSON.stringify(table)} } });
        process.stdout.write(JSON.stringify(read.marked ?? read));`;
      const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
        cwd: dir,
        encoding: "utf8",
      });
      expect(run.stderr).toBe("");
      const here = readRoutingTable({ skill: "story-worker", table: { path: table } });
      expect(JSON.parse(run.stdout)).toEqual(here.marked);
      expect(here.marked.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("package.json lists no runtime dependency", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    expect(manifest.dependencies ?? {}).toEqual({});
  });
});

describe("a skill's script run from wherever the skill is installed", () => {
  const scriptOf = (line: string) =>
    (shellUses(line) as { kind: string; name: string }[])
      .filter((use) => use.kind === "skill-script")
      .map((use) => use.name);

  it.each([
    ["a repo's .agents/skills folder", ".agents/skills/context-gauge/scripts/measure-context.sh"],
    ["a repo's .claude/skills folder", ".claude/skills/context-gauge/scripts/measure-context.sh"],
    [
      "Claude Code's plugin cache",
      "/Users/maintainer/.claude/plugins/cache/grove/grove/0.1.0/skills/context-gauge/scripts/measure-context.sh",
    ],
    [
      "Codex's plugin cache",
      "/Users/maintainer/.codex/plugins/cache/grove/grove/0.1.0/skills/context-gauge/scripts/measure-context.sh",
    ],
  ])("credits a script in %s to its skill", (_where, path) => {
    expect(scriptOf(`${path} --harness claude-code`)).toEqual(["context-gauge"]);
    expect(scriptOf(`bash ${path}`)).toEqual(["context-gauge"]);
  });

  it("credits nothing for a plugin skill's file outside its scripts folder", () => {
    expect(
      scriptOf("cat /Users/maintainer/.claude/plugins/cache/grove/grove/0.1.0/skills/context-gauge/SKILL.md"),
    ).toEqual([]);
    expect(
      scriptOf("/Users/maintainer/.claude/plugins/cache/grove/grove/0.1.0/skills/context-gauge/run.sh"),
    ).toEqual([]);
  });
});

describe("MQ-377 · a Claude Code call counts only when it ran", () => {
  const REFUSED: [string, string] = ["77770007-0000-4000-8000-000000000007", "claude-outcomes"];
  const RAN: [string, string] = ["88880008-0000-4000-8000-000000000008", "claude-outcomes"];

  /** One fixture transcript, as `readTranscripts` takes the list of them. */
  const listed = ([sessionId, dir]: [string, string]) => [
    { session_id: sessionId, path: `${FIXTURES}/${dir}/${sessionId}.jsonl` },
  ];

  it("does not count a Skill call whose result refused it (is_error, a tool_use_error)", () => {
    const result = checkReceipts({ bindings: bindingsReading(REFUSED) });
    expect(stateOf(result, "story-worker/plan")).not.toBe("used");
    expect(outcomesOf(listed(REFUSED), "skill", "compound-engineering:ce-plan")).toEqual([
      "failed",
    ]);
    expect(outcomesOf(listed(REFUSED), "cli", "gh")).toEqual(["failed"]);
  });

  it("counts a Bash call that ran and exited non-zero as a use of its CLI", () => {
    const result = checkReceipts({ bindings: bindingsReading(RAN) });
    expect(stateOf(result, "session-restart/read-pane")).toBe("used");
    expect(outcomesOf(listed(RAN), "cli", "herdr")).toEqual(["ran"]);
  });

  it("does not count a Bash call whose shell could not run the command (exit 127)", () => {
    const result = checkReceipts({ bindings: bindingsReading(REFUSED) });
    expect(stateOf(result, "session-restart/read-pane")).not.toBe("used");
    expect(outcomesOf(listed(REFUSED), "cli", "herdr")).toEqual(["failed"]);
  });

  it("counts an MCP call whose result text reads as an error but carries no is_error", () => {
    const result = checkReceipts({ bindings: bindingsReading(RAN) });
    expect(stateOf(result, "session-restart/read-work-notes")).toBe("used");
  });

  it("counts a performer used when a refused call of it is followed by one that ran", () => {
    const result = checkReceipts({ bindings: bindingsReading(RAN) });
    expect(stateOf(result, "story-worker/build")).toBe("used");
    expect(outcomesOf(listed(RAN), "skill", "compound-engineering:ce-work")).toEqual([
      "failed",
      "ran",
    ]);
  });

  it("reads a call with no result yet as pending, neither used nor failed", () => {
    const result = checkReceipts({ bindings: bindingsReading(REFUSED) });
    expect(stateOf(result, "story-worker/capture-learning")).not.toBe("used");
    expect(outcomesOf(listed(REFUSED), "skill", "compound-engineering:ce-compound")).toEqual([
      "pending",
    ]);
  });

  it("reads a result whose content is an array of text blocks as it reads a string", () => {
    const session = "99990009-0000-4000-8000-000000000009";
    const call = { type: "tool_use", name: "Bash", input: { command: "herdr agent list" } };
    const states = ["Exit code 1\nno such pane", "Exit code 127\ncommand not found"].map((text) => {
      const dir = mkdtempSync(join(tmpdir(), "receipt-check-blocks-"));
      const result = { content: [{ type: "text", text }], is_error: true };
      writeFileSync(join(dir, `${session}.jsonl`), transcriptOf(session, call, result));
      const file = bindingsReading();
      file.transcripts = [{ session_id: session, path: join(dir, `${session}.jsonl`) }];
      const state = stateOf(checkReceipts({ bindings: file }), "session-restart/read-pane");
      rmSync(dir, { recursive: true });
      return state;
    });
    // Exit code 1: the command ran. Exit code 127: the shell could not run it.
    expect(states.map((state) => state === "used")).toEqual([true, false]);
  });

  it("does not count a Bash call whose command was not executable (exit 126)", () => {
    const dir = mkdtempSync(join(tmpdir(), "receipt-check-126-"));
    const call = { type: "tool_use", name: "Bash", input: { command: "herdr agent list" } };
    const file = bindingsOfCalls(dir, [
      call,
      { content: "Exit code 126\npermission denied: herdr", is_error: true },
    ]);
    const state = stateOf(checkReceipts({ bindings: file }), "session-restart/read-pane");
    const outcomes = outcomesOf(file.transcripts, "cli", "herdr");
    rmSync(dir, { recursive: true });
    expect(state).toBe("attempted-failed");
    expect(outcomes).toEqual(["failed"]);
  });
});

describe("MQ-377 · a Codex call counts only when it ran", () => {
  const OUT = `${FIXTURES}/codex-outcomes`;
  const thread = (n: string) => `01a10000-0000-7000-8000-0000000000${n}`;
  const rolloutOf = (n: string, time: string) => ({
    session_id: thread(n),
    path: `${OUT}/sessions/2026/10/03/rollout-2026-10-03T${time}-${thread(n)}.jsonl`,
  });
  // MIXED: a refused post, commands, a patch, a started spawn, an interacted
  // thread, a script naming web_fetch, an aborted wait. LATER: the refused
  // post, then one that completed. FAILED: a spawn that failed. CHILDREN: one
  // started child archived, one whose rollout is gone.
  const MIXED = rolloutOf("a1", "09-00-00");
  const LATER = rolloutOf("a2", "09-10-00");
  const FAILED = rolloutOf("a3", "11-17-00");
  const CHILDREN = rolloutOf("a4", "12-00-00");

  const POST = "mcp__codex_apps__linear_save_comment";

  it("does not count a refused McpToolCall, and counts one that completed later", () => {
    const refused = rebound(reading(MIXED), "story-worker/post-work-note", "tool", POST);
    expect(stateOf(checkReceipts({ bindings: refused }), "story-worker/post-work-note")).not.toBe(
      "used",
    );
    expect(outcomesOf([MIXED], "tool", POST)).toEqual(["failed"]);
    const later = rebound(reading(LATER), "story-worker/post-work-note", "tool", POST);
    expect(stateOf(checkReceipts({ bindings: later }), "story-worker/post-work-note")).toBe("used");
    expect(outcomesOf([LATER], "tool", POST)).toEqual(["failed", "ran"]);
  });

  it("counts a CommandExecution that failed with exit code 1 as a use of its CLI", () => {
    const file = rebound(reading(MIXED), "story-worker/browser-test", "cli", "/usr/local/bin/npm");
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/browser-test")).toBe("used");
    expect(outcomesOf([MIXED], "cli", "npm")).toEqual(["ran"]);
  });

  it("does not count a CommandExecution with exit code 127 or a status it does not know", () => {
    const result = checkReceipts({ bindings: reading(MIXED) });
    expect(stateOf(result, "session-restart/read-pane")).not.toBe("used");
    expect(outcomesOf([MIXED], "cli", "herdr")).toEqual(["failed"]);
    const file = rebound(
      reading(MIXED),
      "story-worker/browser-test",
      "cli",
      "/opt/homebrew/bin/gh",
    );
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/browser-test")).not.toBe(
      "used",
    );
    expect(outcomesOf([MIXED], "cli", "gh")).toEqual(["failed"]);
  });

  it("does not count a CommandExecution with exit code 126, or failed with no exit code", () => {
    for (const exitCode of [126, null]) {
      const dir = mkdtempSync(join(tmpdir(), "receipt-check-codex-exit-"));
      const file = codexBindingsOf(dir, [commandRecord("herdr agent list", "failed", exitCode)]);
      const state = stateOf(checkReceipts({ bindings: file }), "session-restart/read-pane");
      const outcomes = outcomesOf(file.transcripts, "cli", "herdr");
      rmSync(dir, { recursive: true });
      expect(state, String(exitCode)).toBe("attempted-failed");
      expect(outcomes, String(exitCode)).toEqual(["failed"]);
    }
  });

  it("marks apply_patch used by a completed FileChange", () => {
    const file = rebound(reading(MIXED), "story-worker/hand-back", "tool", "apply_patch");
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/hand-back")).toBe("used");
    expect(outcomesOf([MIXED], "tool", "apply_patch")).toEqual(["ran"]);
  });

  it("counts a spawn only when a started activity answers its call_id", () => {
    const spawn = "collaboration.spawn_agent";
    const started = rebound(reading(MIXED), "story-worker/simplify", "tool", spawn);
    expect(stateOf(checkReceipts({ bindings: started }), "story-worker/simplify")).toBe("used");
    const failed = rebound(reading(FAILED), "story-worker/simplify", "tool", spawn);
    expect(stateOf(checkReceipts({ bindings: failed }), "story-worker/simplify")).not.toBe("used");
    expect(outcomesOf([FAILED], "tool", spawn)).toEqual(["failed"]);
  });

  it("gives no credit to a tool an exec script names, in live code or a dead branch", () => {
    const file = rebound(reading(MIXED), "story-worker/hand-back", "tool", "web_fetch");
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/hand-back")).toBe(
      "bound-but-unused",
    );
    expect(outcomesOf([MIXED], "tool", "web_fetch")).toEqual([]);
    // The exec calls themselves ran: one script's post was refused, but the script completed.
    expect(outcomesOf([MIXED], "tool", "exec")).toEqual(["ran", "ran"]);
  });

  it("does not read a thread an interacted activity names as a child", () => {
    const result = checkReceipts({ bindings: reading(MIXED) });
    expect(result.transcripts[0]).toMatchObject({ status: "read", subagents: 1 });
    const { uses } = readTranscripts([MIXED]);
    expect(uses.some((u) => u.where.includes(thread("e1")))).toBe(false);
    expect(uses.some((u) => u.where.includes(thread("c1")))).toBe(true);
  });

  it("reads a function call whose output starts 'aborted' as failed", () => {
    expect(outcomesOf([MIXED], "tool", "collaboration.wait_agent")).toEqual(["failed"]);
  });

  it("reports a started child it cannot find as missing, and reads one only archived", () => {
    const result = checkReceipts({ bindings: reading(CHILDREN) });
    expect(result.transcripts[0]).toMatchObject({ status: "read", subagents: 1 });
    expect(result.transcripts).toContainEqual(
      expect.objectContaining({ session_id: thread("d4"), status: "missing" }),
    );
    expect(stateOf(result, "story-worker/plan")).toBe("no evidence");
    const escalation = result.operations.find((o) => o.id === "review-escalation");
    expect(escalation).toMatchObject({ state: "used" });
    expect(escalation?.where).toContain(`subagent ${thread("c4")}`);
  });
});

describe("MQ-377 · a review counts only from a fresh-context subagent", () => {
  // One session whose subagents sit in every context: a fork of the session, a
  // fresh subagent that fork started, a forked-skill subagent, one with no
  // sidecar, a fork of a fresh subagent, a fork whose parent has no sidecar, and
  // two forks naming each other. Each runs a skill named for its context. No
  // Claude fork of a fork exists on this machine, so those shapes are synthetic.
  const SESSION: [string, string] = [
    "abab0010-0000-4000-8000-000000000010",
    "claude-fresh-context",
  ];

  function reviewRow(file: Bindings, id = "story-worker/review") {
    const [table, operation] = id.split("/");
    const row = checkReceipts({ bindings: file }).operations.find(
      (o) => o.table === table && o.id === operation,
    );
    if (!row) throw new Error(`no row for ${id}`);
    return row;
  }
  const reviewBy = (skill: string) =>
    rebound(bindingsReading(SESSION), "story-worker/review", "skill", skill);

  it("does not count a review run in a fork of the author's context, and says so", () => {
    const row = reviewRow(reviewBy("forked-review"));
    expect(row.state).toBe("bound-but-unused");
    expect(row.note).toBe("called only outside a fresh-context subagent: in a fork");
  });

  it("reads a sidecar whose agentType is fork as a fork, even with no isFork", () => {
    const dir = mkdtempSync(join(tmpdir(), "receipt-check-agent-type-"));
    const call = { type: "tool_use", name: "Skill", input: { skill: "code-review" } };
    const review: Call = [call, { content: "Launching skill: code-review", is_error: false }];
    const fork = { agentType: "fork", toolUseId: "toolu_none" };
    const file = withSubagent(bindingsOfCalls(dir), "aforktype09", fork, review);
    const row = reviewRow(file);
    rmSync(dir, { recursive: true });
    expect(row).toMatchObject({
      state: "bound-but-unused",
      note: "called only outside a fresh-context subagent: in a fork",
    });
  });

  it("does not claim only outside when a fresh subagent's call is still pending", () => {
    const dir = mkdtempSync(join(tmpdir(), "receipt-check-pending-fresh-"));
    const call = { type: "tool_use", name: "Skill", input: { skill: "code-review" } };
    const fresh = { agentType: "general-purpose", toolUseId: "toolu_none" };
    const file = withSubagent(bindingsOfCalls(dir, [call, REFUSED]), "afresh10", fresh, [
      call,
      null,
    ]);
    const row = reviewRow(file);
    rmSync(dir, { recursive: true });
    expect(row).toMatchObject({
      state: "bound-but-unused",
      note: "1 call still pending in a fresh-context subagent",
    });
  });

  it("credits a Codex skill read only when its command completed", () => {
    const read = "cat /codex/skills/ce-code-review/SKILL.md";
    const states = ["failed", "completed"].map((status) => {
      const dir = mkdtempSync(join(tmpdir(), "receipt-check-codex-read-"));
      const child = [commandRecord(read, status, 1, "ce-code-review")];
      const file = codexBindingsOf(dir, [], child);
      const row = reviewRow(file, "story-worker/review-escalation");
      const skill = outcomesOf(file.transcripts, "skill", "ce-code-review");
      const cli = outcomesOf(file.transcripts, "cli", "cat");
      rmSync(dir, { recursive: true });
      return { status, state: row.state, skill, cli };
    });
    // The CLI ran either way (R3); only a completed read shows the skill was loaded.
    expect(states).toEqual([
      { status: "failed", state: "attempted-failed", skill: ["failed"], cli: ["ran"] },
      { status: "completed", state: "used", skill: ["ran"], cli: ["ran"] },
    ]);
  });

  it("notes where a marked performer was called on a no evidence line", () => {
    const dir = mkdtempSync(join(tmpdir(), "receipt-check-no-evidence-"));
    const read = "cat /codex/skills/ce-code-review/SKILL.md";
    const main = [commandRecord(read, "completed", 0, "ce-code-review")];
    const row = reviewRow(codexBindingsOf(dir, main, "missing"), "story-worker/review-escalation");
    rmSync(dir, { recursive: true });
    expect(row).toMatchObject({
      state: "no evidence",
      note: "called outside a fresh-context subagent in the transcripts read: in the main session",
    });
  });

  it("does not count a review the author ran in the main session, and says so", () => {
    const row = reviewRow(reviewBy("main-only-review"));
    expect(row.state).toBe("bound-but-unused");
    expect(row.note).toContain("main session");
  });

  it("counts a forked-skill subagent: general-purpose, no isFork, a parentAgentId", () => {
    expect(reviewRow(reviewBy("forked-skill-review")).state).toBe("used");
  });

  it("does not count a subagent with no sidecar, and says so", () => {
    const row = reviewRow(reviewBy("no-sidecar-review"));
    expect(row.state).toBe("bound-but-unused");
    expect(row.note).toContain("no sidecar");
  });

  it("counts a fresh subagent a fork started, and not a fork whose parent has no sidecar", () => {
    expect(reviewRow(reviewBy("fresh-under-fork-review")).state).toBe("used");
    const orphan = reviewRow(reviewBy("orphan-fork-review"));
    expect(orphan.state).toBe("bound-but-unused");
    expect(orphan.note).toContain("fork");
  });

  it("counts a fork of a fresh subagent, and stops at forks that name each other", () => {
    expect(reviewRow(reviewBy("fork-of-fresh-review")).state).toBe("used");
    expect(reviewRow(reviewBy("cycle-review")).state).toBe("bound-but-unused");
  });

  it("still counts an operation the table does not mark from any context", () => {
    for (const skill of ["main-only-review", "forked-review", "no-sidecar-review"]) {
      const file = rebound(bindingsReading(SESSION), "story-worker/simplify", "skill", skill);
      expect(reviewRow(file, "story-worker/simplify").state, skill).toBe("used");
    }
  });

  it("does not count a fork's replay of its parent's Agent call as an agent use", () => {
    const [sessionId, dir] = SESSION;
    const { uses } = readTranscripts([
      { session_id: sessionId, path: `${FIXTURES}/${dir}/${sessionId}.jsonl` },
    ]);
    expect(uses.filter((u) => u.kind === "agent").map((u) => u.where)).toEqual([sessionId]);
  });

  const CODEX_HOME = `${FIXTURES}/codex-fresh/sessions/2026/10/04`;
  const codexThread = (n: string) => `01a20000-0000-7000-8000-0000000000${n}`;
  const codexReading = (n: string, time: string): Bindings => {
    const file = bindingsReading();
    const id = codexThread(n);
    file.transcripts = [
      { session_id: id, path: `${CODEX_HOME}/rollout-2026-10-04T${time}-${id}.jsonl` },
    ];
    return file;
  };

  it("does not credit review-escalation from a Codex child forked from the author", () => {
    // The fork's second session_meta, a copy of its parent's, names no fork: only the first counts.
    const row = reviewRow(codexReading("b1", "09-00-00"), "story-worker/review-escalation");
    expect(row.state).toBe("bound-but-unused");
    expect(row.note).toContain("fork");
  });

  it("credits review-escalation from a fork of a fresh Codex child", () => {
    const row = reviewRow(codexReading("b2", "10-00-00"), "story-worker/review-escalation");
    expect(row).toMatchObject({ state: "used" });
    expect(row.where).toContain(`subagent ${codexThread("a8")}`);
  });

  it("does not count review bound to collaboration.spawn_agent: the spawn is the author's", () => {
    const file = rebound(
      reading(ROLLOUT),
      "story-worker/review",
      "tool",
      "collaboration.spawn_agent",
    );
    const row = reviewRow(file);
    expect(row.state).toBe("bound-but-unused");
    expect(row.note).toContain("main session");
  });
});

describe("MQ-377 · a call made but not run reads attempted-failed", () => {
  const dir = mkdtempSync(join(tmpdir(), "receipt-check-failed-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const HERDR_GONE: Call = [
    { type: "tool_use", name: "Bash", input: { command: "herdr agent list" } },
    { content: "Exit code 127\ncommand not found: herdr", is_error: true },
  ];

  function rowOf(result: Result, id: string) {
    const row = result.operations.find((o) => `${o.table}/${o.id}` === id);
    if (!row) throw new Error(`no row for ${id}`);
    return row;
  }

  it("notes the calls still pending beside a failed one", () => {
    const file = bindingsOfCalls(dir, [SEND, REFUSED], [SEND, null]);
    expect(rowOf(checkReceipts({ bindings: file }), "story-worker/hand-back")).toMatchObject({
      state: "attempted-failed",
      note: "1 call still pending",
    });
  });

  it("reads only failed calls plus a missing transcript as no evidence", () => {
    const file = bindingsOfCalls(dir, [SEND, REFUSED]);
    file.transcripts.push({ session_id: "gone", path: `${FIXTURES}/gone.jsonl` });
    expect(stateOf(checkReceipts({ bindings: file }), "story-worker/hand-back")).toBe(
      "no evidence",
    );
  });

  it("keeps a declared not run operation not reached when its shared performer failed", () => {
    const file = bindingsOfCalls(dir, HERDR_GONE, HERDR_GONE);
    const result = checkReceipts({ bindings: file, notRun: ["session-restart/type-into-pane"] });
    expect(rowOf(result, "session-restart/type-into-pane")).toMatchObject({
      state: "not reached",
      note: "2 failed calls seen",
    });
    expect(stateOf(result, "session-restart/read-pane")).toBe("attempted-failed");
  });

  it("reads a marked operation failed only in the main session as bound-but-unused", () => {
    const review = { type: "tool_use", name: "Skill", input: { skill: "code-review" } };
    const row = rowOf(
      checkReceipts({ bindings: bindingsOfCalls(dir, [review, REFUSED]) }),
      "story-worker/review",
    );
    expect(row).toMatchObject({
      state: "bound-but-unused",
      note: "called only outside a fresh-context subagent: in the main session",
    });
  });

  it("carries a review line only when its place names a subagent", () => {
    const handoff = join(dir, "handoff-review.md");
    writeFileSync(
      handoff,
      "## Receipt check\n\n" +
        "story-worker/review: used code-review in s-old\n" +
        "story-worker/review-escalation: used compound-engineering:ce-code-review in s-old subagent agent-a1\n",
    );
    const result = checkReceipts({
      bindings: bindingsReading([BY_HAND, "claude-built-by-hand"]),
      handoff,
    });
    expect(stateOf(result, "story-worker/review")).toBe("bound-but-unused");
    expect(rowOf(result, "story-worker/review-escalation")).toMatchObject({
      state: "used",
      where: "s-old subagent agent-a1 (carried from handoff)",
    });
  });

  it("keeps a carried subagent use when its parent is read but its child rollout is not", () => {
    const home = mkdtempSync(join(tmpdir(), "receipt-check-carried-child-"));
    const file = codexBindingsOf(home, [], "missing");
    const handoff = join(home, "handoff.md");
    // As the check writes it: the parent's transcript line, and no line for a
    // child thread it read.
    writeFileSync(
      handoff,
      "## Receipt check\n\n" +
        `transcript ${CODEX_PARENT}: read /elsewhere/${CODEX_PARENT}.jsonl (1 subagent files)\n` +
        "story-worker/review-escalation: used compound-engineering:ce-code-review " +
        `in ${CODEX_PARENT} subagent ${CODEX_CHILD}\n`,
    );
    const result = checkReceipts({ bindings: file, handoff });
    rmSync(home, { recursive: true });
    expect(result.transcripts).toContainEqual(
      expect.objectContaining({ session_id: CODEX_CHILD, status: "covered" }),
    );
    expect(rowOf(result, "story-worker/review-escalation")).toMatchObject({
      state: "used",
      where: `${CODEX_PARENT} subagent ${CODEX_CHILD} (carried from handoff)`,
    });
    expect(result.operations.filter((row) => row.state === "no evidence")).toEqual([]);
  });
});

describe("MQ-353 · used-but-unbound", () => {
  it("reports a Skill call to a performer no binding names", () => {
    const result = checkReceipts({ bindings: bindingsReading([BEFORE, "claude-before-restart"]) });
    expect(result.unbound.map((u) => u.name)).toEqual(["compound-engineering:ce-ideate"]);
  });

  it("reports a Codex read of an unbound skill's SKILL.md", () => {
    const file = reading(ROLLOUT);
    expect(checkReceipts({ bindings: file }).unbound.map((u) => u.name)).toEqual(["ce-ideate"]);
  });

  it("leaves out the level skill and setup, which ran the bindings themselves", () => {
    const result = checkReceipts({ bindings: bindingsReading([AFTER, "claude-after-restart"]) });
    expect(result.unbound).toEqual([]);
  });
});

describe("MQ-353 · what the check cannot see", () => {
  it("reports a missing transcript as missing evidence, not as unused", () => {
    const file = bindingsReading([AFTER, "claude-after-restart"]);
    file.transcripts.push({ session_id: "gone", path: `${FIXTURES}/gone.jsonl` });
    const result = checkReceipts({ bindings: file });
    expect(result.transcripts[1]).toMatchObject({ session_id: "gone", status: "missing" });
    expect(stateOf(result, "story-worker/build")).toBe("used");
    expect(stateOf(result, "story-worker/plan")).toBe("no evidence");
  });

  it("reports an operation the caller declares not run as not reached", () => {
    const result = checkReceipts({
      bindings: bindingsReading([BY_HAND, "claude-built-by-hand"]),
      notRun: ["story-worker/browser-test"],
    });
    expect(stateOf(result, "story-worker/browser-test")).toBe("not reached");
    expect(stateOf(result, "story-worker/build")).toBe("bound-but-unused");
  });

  it("keeps a use the caller declared not run as used", () => {
    const result = checkReceipts({
      bindings: bindingsReading([AFTER, "claude-after-restart"]),
      notRun: ["story-worker/build"],
    });
    expect(stateOf(result, "story-worker/build")).toBe("used");
  });
});

describe("MQ-353 · a handoff carrying an earlier result", () => {
  it("merges an operation used before a cross-machine restart as used", () => {
    const result = checkReceipts({
      bindings: bindingsReading([AFTER, "claude-after-restart"]),
      handoff: HANDOFF,
    });
    const escalation = result.operations.find((o) => o.id === "review-escalation");
    expect(escalation).toMatchObject({ state: "used" });
    // A marked operation carries only from a line whose place names a subagent (MQ-377).
    expect(escalation?.where).toBe(
      "dddd4444-0000-4000-8000-000000000004 subagent agent-a7c1 (carried from handoff)",
    );
    expect(result.handoff).toMatchObject({ path: HANDOFF, merged: 1 });
  });

  it("treats a missing transcript the handoff read as covered, not as missing evidence", () => {
    const file = bindingsReading([AFTER, "claude-after-restart"]);
    const earlier = "dddd4444-0000-4000-8000-000000000004";
    file.transcripts.unshift({ session_id: earlier, path: `/elsewhere/${earlier}.jsonl` });
    const result = checkReceipts({ bindings: file, handoff: HANDOFF });
    expect(result.transcripts[0]).toMatchObject({ session_id: earlier, status: "covered" });
    expect(stateOf(result, "story-worker/plan")).toBe("bound-but-unused");
  });

  it("ignores a carried line about a transcript this run read itself", () => {
    const handoff = join(tmpdir(), `receipt-check-handoff-${process.pid}.md`);
    writeFileSync(
      handoff,
      `## Receipt check\n\nstory-worker/build: used compound-engineering:ce-work in ${BY_HAND}\n`,
    );
    const result = checkReceipts({
      bindings: bindingsReading([BY_HAND, "claude-built-by-hand"]),
      handoff,
    });
    rmSync(handoff);
    expect(stateOf(result, "story-worker/build")).toBe("bound-but-unused");
  });

  it("ignores a carried line naming a performer other than the one bound", () => {
    const handoff = join(tmpdir(), `receipt-check-handoff-other-${process.pid}.md`);
    writeFileSync(
      handoff,
      "## Receipt check\n\nstory-worker/review: used something-else in s-old\n",
    );
    const result = checkReceipts({
      bindings: bindingsReading([BY_HAND, "claude-built-by-hand"]),
      handoff,
    });
    rmSync(handoff);
    expect(stateOf(result, "story-worker/review")).toBe("bound-but-unused");
    expect(result.handoff).toMatchObject({ merged: 0 });
  });

  it("merges a carried CLI use whose path setup resolved differently on this machine", () => {
    const handoff = join(tmpdir(), `receipt-check-handoff-moved-${process.pid}.md`);
    writeFileSync(
      handoff,
      "## Receipt check\n\nsession-restart/read-pane: used /usr/local/bin/herdr in s-old\n",
    );
    const result = checkReceipts({
      bindings: bindingsReading([BY_HAND, "claude-built-by-hand"]),
      handoff,
    });
    rmSync(handoff);
    expect(stateOf(result, "session-restart/read-pane")).toBe("used");
  });

  it("does not count another plugin's skill of the same name, called or carried", () => {
    const dir = mkdtempSync(join(tmpdir(), "receipt-check-namesake-"));
    const session = "eeee5555-0000-4000-8000-000000000005";
    const call = { type: "tool_use", name: "Skill", input: { skill: "other-framework:ce-work" } };
    writeFileSync(join(dir, `${session}.jsonl`), transcriptOf(session, call));
    const handoff = join(dir, "handoff.md");
    writeFileSync(
      handoff,
      "## Receipt check\n\nstory-worker/plan: used other-framework:ce-plan in s-old\n",
    );
    const file = bindingsReading();
    file.transcripts = [{ session_id: session, path: join(dir, `${session}.jsonl`) }];
    const result = checkReceipts({ bindings: file, handoff });
    rmSync(dir, { recursive: true });
    expect(stateOf(result, "story-worker/build")).toBe("bound-but-unused");
    expect(stateOf(result, "story-worker/plan")).toBe("bound-but-unused");
    expect(result.unbound.map((u) => u.name)).toContain("other-framework:ce-work");
  });

  it("merges only used lines, and only from the receipt-check section", () => {
    const result = checkReceipts({
      bindings: bindingsReading([BY_HAND, "claude-built-by-hand"]),
      handoff: HANDOFF,
    });
    expect(stateOf(result, "story-worker/build")).toBe("bound-but-unused");
    expect(stateOf(result, "story-worker/commit-and-pr")).toBe("bound-but-unused");
  });
});

describe("MQ-353 · the command line", () => {
  const dir = mkdtempSync(join(tmpdir(), "receipt-check-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  function run(file: unknown, ...args: string[]) {
    const path = join(dir, `bindings-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(path, JSON.stringify(file));
    return spawnSync("node", [SCRIPT, "--bindings", path, ...args], { encoding: "utf8" });
  }

  it("prints the negative control's build as bound-but-unused and exits 1", () => {
    const result = run(bindingsReading([BY_HAND, "claude-built-by-hand"]));
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "story-worker/build: bound-but-unused compound-engineering:ce-work",
    );
    expect(result.stdout).toContain(`transcript ${BY_HAND}: read `);
  });

  it("exits 0 when every operation is used or declared not run", () => {
    const file = bindingsReading([AFTER, "claude-after-restart"]);
    file.operations = file.operations.filter((o) => o.id === "build" || o.id === "plan");
    const result = run(file, "--not-run", "story-worker/plan");
    expect(result.stdout).toContain(
      `story-worker/build: used compound-engineering:ce-work in ${AFTER}`,
    );
    expect(result.stdout).toContain("story-worker/plan: not reached (declared by caller)");
    expect(result.status).toBe(0);
  });

  it("prints attempted-failed, counts it apart in the summary, and exits 1 on it alone", () => {
    const file = bindingsOfCalls(dir, [SEND, REFUSED]);
    file.operations = file.operations.filter((o) => o.id === "hand-back");
    const result = run(file);
    expect(result.stdout).toMatch(/^story-worker\/hand-back: attempted-failed SendMessage$/m);
    expect(result.stdout).toMatch(
      /^summary: 0 used, 0 bound-but-unused, 1 attempted-failed, 0 not reached, 0 no evidence, /m,
    );
    expect(result.status).toBe(1);
  });

  it("never carries an attempted-failed line from its own report in a handoff", () => {
    const before = run(bindingsOfCalls(dir, [SEND, REFUSED])).stdout;
    expect(before).toContain("story-worker/hand-back: attempted-failed SendMessage");
    const handoff = join(dir, "handoff-failed.md");
    writeFileSync(handoff, `# Handoff\n\n## Receipt check\n\n${before}\n## What I am doing\n`);
    const after = run(
      bindingsReading([BY_HAND, "claude-built-by-hand"]),
      "--handoff",
      handoff,
    ).stdout;
    expect(after).toContain("handoff: ");
    expect(after).toContain("(0 earlier uses carried)");
    expect(after).toMatch(/^story-worker\/hand-back: bound-but-unused SendMessage$/m);
  });

  it("reads its own report back from a handoff, so a restart carries it", () => {
    const before = run(bindingsReading([BEFORE, "claude-before-restart"])).stdout;
    const handoff = join(dir, "handoff.md");
    writeFileSync(
      handoff,
      `# Handoff\n\n## Receipt check\n\n${before}\n## What I am doing\n\nBuilding.\n`,
    );
    const after = run(
      bindingsReading([BY_HAND, "claude-built-by-hand"]),
      "--handoff",
      handoff,
    ).stdout;
    expect(after).toContain(
      `story-worker/plan: used compound-engineering:ce-plan in ${BEFORE} (carried from handoff)`,
    );
    // The whole place carries, so a marked review keeps the subagent it ran in.
    expect(after).toContain(
      `story-worker/review: used code-review in ${BEFORE} subagent agent-a1b2c3 (carried from handoff)`,
    );
    expect(after).toContain("story-worker/build: bound-but-unused");
  });

  it("carries a use from a transcript left on another machine through every later restart", () => {
    const elsewhere = { session_id: BEFORE, path: `/elsewhere/${BEFORE}.jsonl` };
    const handoffOf = (report: string, name: string) => {
      const path = join(dir, name);
      writeFileSync(path, `# Handoff\n\n## Receipt check\n\n${report}\n## What I am doing\n`);
      return path;
    };
    // A, on the first machine; B, its successor on another; C, B's same-machine restart.
    const a = run(bindingsReading([BEFORE, "claude-before-restart"])).stdout;
    const bFile = bindingsReading([BY_HAND, "claude-built-by-hand"]);
    bFile.transcripts.unshift(elsewhere);
    const b = run(bFile, "--handoff", handoffOf(a, "handoff-a.md")).stdout;
    const cFile = bindingsReading(
      [BY_HAND, "claude-built-by-hand"],
      [AFTER, "claude-after-restart"],
    );
    cFile.transcripts.unshift(elsewhere);
    const c = run(cFile, "--handoff", handoffOf(b, "handoff-b.md")).stdout;
    expect(c).toContain(`transcript ${BEFORE}: covered by handoff`);
    expect(c).toContain(
      `story-worker/plan: used compound-engineering:ce-plan in ${BEFORE} (carried from handoff)`,
    );
    expect(c).not.toContain("no evidence compound");
  });

  it("exits 2 with one line on malformed input, never 1 as if unused", () => {
    const cases: [unknown[], unknown[], string[]][] = [
      [[{ session_id: "s-dir", path: dir }], [], []],
      [[null], [], []],
      [[], [], []],
      [bindingsReading([BY_HAND, "claude-built-by-hand"]).transcripts, [null], []],
      [bindingsReading([BY_HAND, "claude-built-by-hand"]).transcripts, [], ["--handoff", dir]],
    ];
    for (const [transcripts, extraOperations, args] of cases) {
      const file = bindingsReading();
      file.transcripts = transcripts as Bindings["transcripts"];
      file.operations = [...file.operations, ...(extraOperations as Bindings["operations"])];
      const result = run(file, ...args);
      expect(result.status, JSON.stringify(transcripts) + args.join(" ")).toBe(2);
      expect(result.stderr.trim().split("\n")[0]).toMatch(/^receipt-check: /);
      expect(result.stderr).not.toMatch(/\n\s+at /);
    }
  });

  it("refuses a bindings file setup did not complete, with exit 2", () => {
    const file = bindingsReading([AFTER, "claude-after-restart"]);
    delete file.complete;
    const result = run(file);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("no completion marker");
  });

  it("exits 2 on a bindings file that is not JSON, never 1 as if unused", () => {
    const path = join(dir, "broken.json");
    writeFileSync(path, '{"skill": "story-worker",');
    const result = spawnSync("node", [SCRIPT, "--bindings", path], { encoding: "utf8" });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("is not valid JSON");
  });

  it("exits 2 on a bindings file that is JSON but not a bindings file", () => {
    for (const text of ["null", '{"complete": {"at": "x"}}']) {
      const path = join(dir, "not-bindings.json");
      writeFileSync(path, text);
      const result = spawnSync("node", [SCRIPT, "--bindings", path], { encoding: "utf8" });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("is not a bindings file");
    }
  });

  it("lists the operations the table marks fresh_context, and says when the table changed", () => {
    const file = bindingsReading([AFTER, "claude-after-restart"]);
    const changed = run(file).stdout;
    expect(changed).toContain("fresh_context on review, review-escalation");
    expect(changed).toContain("changed since setup read it");
    const sha256 = createHash("sha256").update(readFileSync(TABLE)).digest("hex");
    Object.assign(file.table as object, { sha256 });
    const same = run(file).stdout;
    expect(same).toContain("fresh_context on review, review-escalation");
    expect(same).not.toContain("changed since setup read it");
  });

  it("prints why a marked operation's use did not count on its line", () => {
    const fresh: [string, string] = [
      "abab0010-0000-4000-8000-000000000010",
      "claude-fresh-context",
    ];
    const file = rebound(
      bindingsReading(fresh),
      "story-worker/review",
      "skill",
      "main-only-review",
    );
    expect(run(file).stdout).toMatch(
      /^story-worker\/review: bound-but-unused main-only-review \(called only outside a fresh-context subagent: [^)]*main session\)$/m,
    );
  });

  it("prints the note on a no evidence line too", () => {
    const read = "cat /codex/skills/ce-code-review/SKILL.md";
    const main = [commandRecord(read, "completed", 0, "ce-code-review")];
    const file = codexBindingsOf(join(dir, "codex-home"), main, "missing");
    expect(run(file).stdout).toMatch(
      /^story-worker\/review-escalation: no evidence compound-engineering:ce-code-review \(a transcript is missing; called outside a fresh-context subagent in the transcripts read: in the main session\)$/m,
    );
  });

  it("reads the routing table in the bindings file's own checkout, run from elsewhere", () => {
    const checkout = mkdtempSync(join(tmpdir(), "receipt-check-checkout-"));
    const tableDir = join(checkout, "skills", "story-worker");
    mkdirSync(tableDir, { recursive: true });
    writeFileSync(
      join(tableDir, "routing.toml"),
      'skill = "story-worker"\n\n[[operation]]\nid = "plan"\nfresh_context = true\n',
    );
    const folder = join(checkout, ".context", "supervision", "worker");
    mkdirSync(folder, { recursive: true });
    const file = bindingsReading([AFTER, "claude-after-restart"]);
    file.transcripts = file.transcripts.map((t) => ({ ...t, path: resolve(t.path) }));
    writeFileSync(join(folder, "bindings.json"), JSON.stringify(file));
    const elsewhere = mkdtempSync(join(tmpdir(), "receipt-check-cwd-"));
    const result = spawnSync(
      "node",
      [resolve(SCRIPT), "--bindings", join(folder, "bindings.json")],
      { cwd: elsewhere, encoding: "utf8" },
    );
    rmSync(checkout, { recursive: true });
    rmSync(elsewhere, { recursive: true });
    const header = result.stdout.split("\n").find((line) => line.startsWith("table "));
    expect(header).toContain(tableDir);
    expect(header).toContain("fresh_context on plan");
  });

  it("exits 2 with one line when the routing table cannot be read", () => {
    const broken = join(dir, "broken-routing.toml");
    writeFileSync(broken, "[[operation\nid = ");
    for (const table of [{ path: "nowhere/routing.toml" }, { path: broken }, undefined]) {
      const file = bindingsReading([AFTER, "claude-after-restart"]);
      file.table = table;
      const result = run(file);
      expect(result.status, JSON.stringify(table)).toBe(2);
      expect(result.stderr.trim().split("\n"), JSON.stringify(table)).toHaveLength(1);
      expect(result.stderr).toMatch(/^receipt-check: .*routing table/);
    }
  });

  it("exits 2 when the routing table belongs to another skill", () => {
    const other = join(dir, "project-lead-routing.toml");
    writeFileSync(
      other,
      'skill = "project-lead"\n\n[[operation]]\nid = "review-before-merge"\nfresh_context = true\n',
    );
    const file = bindingsReading([AFTER, "claude-after-restart"]);
    file.table = { path: other };
    const result = run(file);
    expect(result.status).toBe(2);
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
    expect(result.stderr).toMatch(
      /^receipt-check: the routing table .* is for project-lead, not story-worker/,
    );
  });

  it("reads the table as before when the bindings file names no skill", () => {
    const file = bindingsReading([AFTER, "claude-after-restart"]);
    delete (file as { skill?: string }).skill;
    const result = run(file);
    expect(result.status).not.toBe(2);
    expect(result.stdout).toContain("fresh_context on review, review-escalation");
  });

  it("runs when invoked through a symlinked path", () => {
    const link = join(dir, "linked-receipt-check.mjs");
    symlinkSync(resolve(SCRIPT), link);
    const result = spawnSync("node", [link], { encoding: "utf8" });
    expect(result.status).toBe(2);
  });

  it("exits 2 on an unknown argument", () => {
    const result = spawnSync("node", [SCRIPT, "--bindings", "x.json", "--bogus"], {
      encoding: "utf8",
    });
    expect(result.status).toBe(2);
  });

  it("exits 2 with its usage when --bindings is missing", () => {
    const result = spawnSync("node", [SCRIPT], { encoding: "utf8" });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--bindings <path> is required");
  });
});

describe("MQ-377 U7 · a Claude Code session is read from where it was written", () => {
  // Three sessions under a fixture projects root. MOVED is listed under -launch
  // but was written under -entered, as a session that entered another worktree
  // is. LEFT is read where listed while its subagents sit under -launch, a
  // shape not yet seen in a real session, so it is synthetic. TWICE has a main
  // transcript in two folders.
  const HOME = resolve(`${FIXTURES}/claude-moved`);
  const PROJECTS = "claude-moved/projects";
  const MOVED = "dede0013-0000-4000-8000-000000000013";
  const LEFT = "dede0014-0000-4000-8000-000000000014";
  const TWICE = "dede0015-0000-4000-8000-000000000015";
  beforeEach(() => {
    vi.stubEnv("CLAUDE_CONFIG_DIR", HOME);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const reviewing = (sessionId: string, folder: string, skill: string) =>
    rebound(
      bindingsReading([sessionId, `${PROJECTS}/${folder}`]),
      "story-worker/review",
      "skill",
      skill,
    );

  it("reads a session missing where listed from the one folder that holds it", () => {
    const result = checkReceipts({ bindings: reviewing(MOVED, "-launch", "moved-review") });
    expect(result.transcripts[0]).toMatchObject({
      session_id: MOVED,
      status: "read",
      path: `${FIXTURES}/${PROJECTS}/-entered/${MOVED}.jsonl`,
      listed: `${FIXTURES}/${PROJECTS}/-launch/${MOVED}.jsonl`,
      subagents: 1,
    });
    expect(stateOf(result, "story-worker/review")).toBe("used");
  });

  it("reads subagents another project folder holds for the same session", () => {
    const result = checkReceipts({ bindings: reviewing(LEFT, "-entered", "left-review") });
    expect(result.transcripts[0]).toMatchObject({ status: "read", subagents: 1 });
    expect(result.transcripts[0]).not.toHaveProperty("listed");
    expect(stateOf(result, "story-worker/review")).toBe("used");
  });

  it("reads none and reports missing when two folders hold the main transcript", () => {
    const result = checkReceipts({ bindings: reviewing(TWICE, "-gone", "twice-review") });
    expect(result.transcripts[0]).toMatchObject({ session_id: TWICE, status: "missing" });
  });

  it("reads a transcript present where listed, even when another folder holds a copy", () => {
    const result = checkReceipts({ bindings: reviewing(TWICE, "-first", "twice-review") });
    expect(result.transcripts[0]).toMatchObject({
      status: "read",
      path: `${FIXTURES}/${PROJECTS}/-first/${TWICE}.jsonl`,
    });
    expect(result.transcripts[0]).not.toHaveProperty("listed");
  });

  it("does not search for a session listed outside Claude Code's projects root", () => {
    const result = checkReceipts({ bindings: bindingsReading([MOVED, "claude-moved"]) });
    expect(result.transcripts[0]).toMatchObject({ status: "missing", subagents: 0 });
  });

  it("does not search a projects-shaped path when the projects root is elsewhere", () => {
    vi.stubEnv("CLAUDE_CONFIG_DIR", join(HOME, "elsewhere"));
    const result = checkReceipts({ bindings: reviewing(MOVED, "-launch", "moved-review") });
    expect(result.transcripts[0]).toMatchObject({ status: "missing", subagents: 0 });
  });

  it("prints where a relocated session was read and where it was listed", () => {
    const dir = mkdtempSync(join(tmpdir(), "receipt-check-moved-"));
    const path = join(dir, "bindings.json");
    writeFileSync(path, JSON.stringify(reviewing(MOVED, "-launch", "moved-review")));
    const env = { ...process.env, CLAUDE_CONFIG_DIR: HOME };
    const result = spawnSync("node", [SCRIPT, "--bindings", path], { encoding: "utf8", env });
    rmSync(dir, { recursive: true });
    expect(result.stdout).toContain(
      `transcript ${MOVED}: read ${FIXTURES}/${PROJECTS}/-entered/${MOVED}.jsonl ` +
        `(1 subagent files; listed at ${FIXTURES}/${PROJECTS}/-launch/${MOVED}.jsonl)`,
    );
  });
});
