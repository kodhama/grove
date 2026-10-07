/**
 * MQ-349 (plan U3) — the context-gauge skill's measuring script,
 * `.agents/skills/context-gauge/scripts/measure-context.sh`, run against a
 * Claude Code transcript excerpt and a Codex rollout excerpt in
 * `test/fixtures/supervision/`.
 *
 * The gauge reads a session's context as a share of its model's window
 * (KTD6 in docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md):
 * on Claude Code, the transcript's latest `usage` (input plus cache read plus
 * cache creation) against the window recorded at setup; on Codex, the latest
 * `token_count` event's `last_token_usage.input_tokens` against its
 * `model_context_window`. The scenarios pin the one line it prints, and that
 * anything it cannot measure reads "unavailable", never zero and never a
 * guessed window: a session that misreads itself as empty never restarts.
 *
 * Each run gets a scratch HOME and none of the harness session variables, so
 * a test run inside a live Claude Code or Codex session never reads that
 * session's own transcript. Nothing here calls a model or the network.
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const GAUGE = join(__dirname, "..", "skills/context-gauge/scripts/measure-context.sh");
const FIXTURES = join(__dirname, "fixtures/supervision");
const CLAUDE_FIXTURE = join(FIXTURES, "context-gauge-claude-transcript.jsonl");
const CODEX_FIXTURE = join(FIXTURES, "context-gauge-codex-rollout.jsonl");

const CLAUDE_READING = "context=36.2% tokens=362351 window=1000000 source=claude-transcript";
const CODEX_READING = "context=24.9% tokens=64372 window=258400 source=codex-rollout";

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "context-gauge-"));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

/** Runs the gauge with a scratch HOME and only the session variables given. */
function gauge(args: readonly string[], env: Record<string, string> = {}) {
  const base = { ...process.env };
  for (const name of [
    "CLAUDE_CODE_SESSION_ID",
    "CODEX_THREAD_ID",
    "CLAUDE_CONFIG_DIR",
    "CODEX_HOME",
  ]) {
    delete base[name];
  }
  const run = spawnSync("bash", [GAUGE, ...args], {
    encoding: "utf8",
    env: { ...base, HOME: home, ...env },
  });
  return { code: run.status, out: run.stdout, err: run.stderr };
}

/** A copy of `fixture` in the scratch HOME with `lines` appended, one JSON object each. */
function extended(fixture: string, lines: readonly Record<string, unknown>[]) {
  const file = join(home, "extended.jsonl");
  copyFileSync(fixture, file);
  writeFileSync(
    file,
    `${readFileSync(file, "utf8")}${lines.map((l) => JSON.stringify(l)).join("\n")}\n`,
  );
  return file;
}

function expectUnavailable(run: ReturnType<typeof gauge>, reason: RegExp) {
  expect(run.code).toBe(1);
  expect(run.out).toMatch(/^context=unavailable reason=.+\n$/u);
  expect(run.out).toMatch(reason);
  expect(run.out).not.toMatch(/%/u);
}

describe("the Claude Code recipe: the transcript's latest usage against the window recorded at setup", () => {
  it("sums input, cache read and cache creation of the latest usage and prints one line", () => {
    const run = gauge([
      "--harness",
      "claude-code",
      "--window",
      "1000000",
      "--transcript",
      CLAUDE_FIXTURE,
    ]);
    expect(run.code).toBe(0);
    expect(run.out).toBe(`${CLAUDE_READING} file=${CLAUDE_FIXTURE}\n`);
  });

  it("falls back to the latest line that has a usage when the last lines have none", () => {
    const file = extended(CLAUDE_FIXTURE, [
      { type: "user", isSidechain: false, message: { role: "user", content: "carry on" } },
      { type: "system", subtype: "turn_duration", durationMs: 1200 },
    ]);
    const run = gauge(["--harness", "claude-code", "--window", "1000000", "--transcript", file]);
    expect(run.code).toBe(0);
    expect(run.out).toBe(`${CLAUDE_READING} file=${file}\n`);
  });

  it("skips a synthetic assistant line's all-zero usage and a sidechain line's usage", () => {
    const zero = {
      input_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 0,
    };
    const file = extended(CLAUDE_FIXTURE, [
      {
        type: "assistant",
        isSidechain: true,
        message: {
          model: "claude-haiku-4-5",
          role: "assistant",
          usage: { ...zero, input_tokens: 9000 },
        },
      },
      {
        type: "assistant",
        isSidechain: false,
        message: { model: "<synthetic>", role: "assistant", usage: zero },
      },
    ]);
    const run = gauge(["--harness", "claude-code", "--window", "1000000", "--transcript", file]);
    expect(run.code).toBe(0);
    expect(run.out).toBe(`${CLAUDE_READING} file=${file}\n`);
  });

  const compactBoundary = {
    type: "system",
    subtype: "compact_boundary",
    isSidechain: false,
    compactMetadata: { trigger: "auto", preTokens: 970490, postTokens: 35266 },
  };

  it("reads unavailable after a compaction until a request after it is written", () => {
    const file = extended(CLAUDE_FIXTURE, [
      compactBoundary,
      { type: "user", isSidechain: false, message: { role: "user", content: "the summary" } },
    ]);
    expectUnavailable(
      gauge(["--harness", "claude-code", "--window", "1000000", "--transcript", file]),
      /compaction/u,
    );
  });

  it("reads the first request after a compaction", () => {
    const file = extended(CLAUDE_FIXTURE, [
      compactBoundary,
      {
        type: "assistant",
        isSidechain: false,
        message: {
          model: "claude-opus-5-5",
          role: "assistant",
          usage: {
            input_tokens: 3,
            cache_creation_input_tokens: 35000,
            cache_read_input_tokens: 0,
          },
        },
      },
    ]);
    const run = gauge(["--harness", "claude-code", "--window", "1000000", "--transcript", file]);
    expect(run.code).toBe(0);
    expect(run.out).toMatch(/^context=3\.5% tokens=35003 window=1000000 /u);
  });

  it("finds the transcript by CLAUDE_CODE_SESSION_ID under any project dir, and detects the harness from it", () => {
    const id = "c0ffee00-0000-4000-8000-000000000349";
    const project = join(home, ".claude/projects/-work-repo--claude-worktrees-mq-349");
    mkdirSync(project, { recursive: true });
    const file = join(project, `${id}.jsonl`);
    copyFileSync(CLAUDE_FIXTURE, file);
    const run = gauge(["--window", "1000000"], { CLAUDE_CODE_SESSION_ID: id });
    expect(run.code).toBe(0);
    expect(run.out).toBe(`${CLAUDE_READING} file=${file}\n`);
  });

  it("looks under CLAUDE_CONFIG_DIR when it is set", () => {
    const id = "c0ffee00-0000-4000-8000-000000000350";
    const config = join(home, "alt-claude");
    mkdirSync(join(config, "projects/-work"), { recursive: true });
    const file = join(config, "projects/-work", `${id}.jsonl`);
    copyFileSync(CLAUDE_FIXTURE, file);
    const run = gauge(["--window", "1000000", "--session-id", id], {
      CLAUDE_CODE_SESSION_ID: "someone-else",
      CLAUDE_CONFIG_DIR: config,
    });
    expect(run.code).toBe(0);
    expect(run.out).toBe(`${CLAUDE_READING} file=${file}\n`);
  });

  it("reads unavailable, never a guessed percentage, when no window was given", () => {
    const run = gauge(["--harness", "claude-code", "--transcript", CLAUDE_FIXTURE]);
    expectUnavailable(run, /no context window/u);
  });

  it("reads unavailable when two project dirs hold a transcript with the session's id", () => {
    const id = "c0ffee00-0000-4000-8000-000000000351";
    for (const dir of ["-work-a", "-work-b"]) {
      mkdirSync(join(home, ".claude/projects", dir), { recursive: true });
      copyFileSync(CLAUDE_FIXTURE, join(home, ".claude/projects", dir, `${id}.jsonl`));
    }
    const run = gauge(["--harness", "claude-code", "--window", "1000000"], {
      CLAUDE_CODE_SESSION_ID: id,
    });
    expectUnavailable(run, /more than one transcript/u);
  });
});

describe("the Codex recipe: the rollout's latest last_token_usage against its model_context_window", () => {
  it("reads input_tokens against model_context_window from the latest token_count event", () => {
    const run = gauge(["--harness", "codex", "--transcript", CODEX_FIXTURE]);
    expect(run.code).toBe(0);
    expect(run.out).toBe(`${CODEX_READING} file=${CODEX_FIXTURE}\n`);
  });

  it("finds the rollout by CODEX_THREAD_ID under CODEX_HOME's sessions, and detects the harness from it", () => {
    const id = "01a0e9f5-0c14-7052-ba1e-b8a6c2150d7c";
    const day = join(home, "codex-home/sessions/2026/09/28");
    mkdirSync(day, { recursive: true });
    const file = join(day, `rollout-2026-09-28T22-39-05-${id}.jsonl`);
    copyFileSync(CODEX_FIXTURE, file);
    const run = gauge([], { CODEX_THREAD_ID: id, CODEX_HOME: join(home, "codex-home") });
    expect(run.code).toBe(0);
    expect(run.out).toBe(`${CODEX_READING} file=${file}\n`);
  });

  it("reads unavailable when no token_count event carries usage yet", () => {
    const file = join(home, "fresh-rollout.jsonl");
    writeFileSync(file, readFileSync(CODEX_FIXTURE, "utf8").split("\n").slice(0, 2).join("\n"));
    expectUnavailable(gauge(["--harness", "codex", "--transcript", file]), /no usage/u);
  });

  const tokenCount = (inputTokens: number, window: number | null) => ({
    type: "event_msg",
    payload: {
      type: "token_count",
      info: { last_token_usage: { input_tokens: inputTokens }, model_context_window: window },
    },
  });

  it("reads unavailable right after a compaction, never the size from before it", () => {
    // The shape of a real rollout: a compacted record, then a zero-usage token_count.
    const file = extended(CODEX_FIXTURE, [
      tokenCount(235773, 258400),
      { type: "compacted", payload: { message: "" } },
      tokenCount(0, 258400),
    ]);
    expectUnavailable(gauge(["--harness", "codex", "--transcript", file]), /compaction/u);
  });

  it("reads unavailable when the latest token_count has no window, never an older reading", () => {
    const file = extended(CODEX_FIXTURE, [tokenCount(120000, null)]);
    expectUnavailable(gauge(["--harness", "codex", "--transcript", file]), /no usage/u);
  });

  it("reads unavailable when the latest token_count has no info, never an older reading", () => {
    const file = extended(CODEX_FIXTURE, [
      { type: "event_msg", payload: { type: "token_count", info: null } },
    ]);
    expectUnavailable(gauge(["--harness", "codex", "--transcript", file]), /no usage/u);
  });

  it("prints a decimal point whatever the locale", () => {
    const run = gauge(["--harness", "codex", "--transcript", CODEX_FIXTURE], {
      LC_ALL: "pt_PT.UTF-8",
    });
    expect(run.out).toBe(`${CODEX_READING} file=${CODEX_FIXTURE}\n`);
  });
});

describe("anything the gauge cannot measure reads unavailable, not zero", () => {
  it("an empty transcript", () => {
    const file = join(home, "empty.jsonl");
    writeFileSync(file, "");
    expectUnavailable(
      gauge(["--harness", "claude-code", "--window", "1000000", "--transcript", file]),
      /no usage/u,
    );
  });

  it("a missing transcript", () => {
    const file = join(home, "missing.jsonl");
    expectUnavailable(
      gauge(["--harness", "claude-code", "--window", "1000000", "--transcript", file]),
      /no transcript/u,
    );
  });

  it("a session id with no transcript on this machine", () => {
    expectUnavailable(
      gauge(["--harness", "claude-code", "--window", "1000000"], {
        CLAUDE_CODE_SESSION_ID: "no-such-session",
      }),
      /no transcript/u,
    );
  });

  /** A PATH holding the tools the gauge uses, except jq. */
  function pathWithoutJq() {
    const bin = join(home, "bin");
    mkdirSync(bin);
    for (const tool of ["bash", "grep", "awk", "tail", "cat"]) {
      const found = spawnSync("bash", ["-c", `command -v ${tool}`], { encoding: "utf8" });
      symlinkSync(found.stdout.trim(), join(bin, tool));
    }
    return bin;
  }

  it("a machine without jq, named as the reason rather than read as no usage yet", () => {
    expectUnavailable(
      gauge(["--harness", "claude-code", "--window", "1000000", "--transcript", CLAUDE_FIXTURE], {
        PATH: pathWithoutJq(),
      }),
      /jq is not installed/u,
    );
  });

  it("an unknown harness on a machine without jq, named as the harness", () => {
    expectUnavailable(
      gauge(["--harness", "droid", "--window", "1000000"], { PATH: pathWithoutJq() }),
      /no measuring recipe for harness droid/u,
    );
  });

  /** A copy of `fixture` whose last line is `line` cut in half, as while the harness writes it. */
  function halfWritten(fixture: string, line: Record<string, unknown>) {
    const file = join(home, "half-written.jsonl");
    const whole = JSON.stringify(line);
    writeFileSync(file, `${readFileSync(fixture, "utf8")}${whole.slice(0, whole.length / 2)}`);
    return file;
  }

  it("a Claude transcript whose latest usage line is half-written, never the reading before it", () => {
    const file = halfWritten(CLAUDE_FIXTURE, {
      type: "assistant",
      isSidechain: false,
      message: { role: "assistant", usage: { input_tokens: 4, cache_read_input_tokens: 400000 } },
    });
    expectUnavailable(
      gauge(["--harness", "claude-code", "--window", "1000000", "--transcript", file]),
      /not complete/u,
    );
  });

  it("a Codex rollout whose latest token_count is half-written, never the reading before it", () => {
    const file = halfWritten(CODEX_FIXTURE, {
      type: "event_msg",
      payload: {
        type: "token_count",
        info: { last_token_usage: { input_tokens: 99000 }, model_context_window: 258400 },
      },
    });
    expectUnavailable(gauge(["--harness", "codex", "--transcript", file]), /not complete/u);
  });

  it("HOME unset, still one line", () => {
    const run = spawnSync(
      "env",
      [
        "-i",
        `PATH=${process.env.PATH ?? ""}`,
        "bash",
        GAUGE,
        "--harness",
        "codex",
        "--session-id",
        "x",
      ],
      {
        encoding: "utf8",
      },
    );
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(
      /^context=unavailable reason=no transcript for session x under \/\.codex\/sessions\n$/u,
    );
  });

  it("a transcript line jq cannot read, never the reading before it", () => {
    const file = extended(CLAUDE_FIXTURE, [
      {
        type: "assistant",
        isSidechain: false,
        message: { role: "assistant", usage: { input_tokens: "bad", cache_read_input_tokens: 5 } },
      },
    ]);
    expectUnavailable(
      gauge(["--harness", "claude-code", "--window", "1000000", "--transcript", file]),
      /could not read/u,
    );
  });

  it("an unknown harness", () => {
    expectUnavailable(
      gauge(["--harness", "droid", "--window", "1000000"]),
      /no measuring recipe for harness droid/u,
    );
  });

  it("no harness given and none detectable", () => {
    expectUnavailable(gauge(["--window", "1000000"]), /no measuring recipe/u);
  });

  it("both harnesses' session variables set, so the harness is ambiguous", () => {
    expectUnavailable(
      gauge(["--window", "1000000"], { CLAUDE_CODE_SESSION_ID: "a", CODEX_THREAD_ID: "b" }),
      /--harness/u,
    );
  });
});

describe("arguments", () => {
  it.each([
    [["--window", "a million"]],
    [["--window", "0"]],
    [["--window", ""]],
    [["--harness"]],
    [["--frobnicate"]],
  ])("refuses %j with exit 2 and a usage line on stderr", (args) => {
    const run = gauge(args);
    expect(run.code).toBe(2);
    expect(run.out).toBe("");
    expect(run.err).toMatch(/^Usage: measure-context\.sh/mu);
  });
});

describe("the skill's instructions", () => {
  it("quote the gauge's path, since the folder it is installed in may hold a space", () => {
    const skill = readFileSync(join(__dirname, "..", "skills/context-gauge/SKILL.md"), "utf8");
    expect(skill).toMatch(/^"<this skill's folder>\/scripts\/measure-context\.sh" --harness/mu);
  });
});
