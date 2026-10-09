/**
 * GRO-13 — the context window setup records for a Claude Code model id, looked
 * up in a dated table quoted from Claude Code's own model docs
 * (`skills/supervision-setup/references/claude-code-windows.json`), never
 * guessed.
 *
 * A model id with no `[1m]` suffix used to record no window, so the gauge read
 * unavailable for the whole session and it never restarted itself. Claude
 * Code's docs say which models run with the 1M window with no suffix, and the
 * table copies that with the quote, its page and the date it was checked. An
 * id the table lacks still reads unknown: the window is recorded only when a
 * source gives it. The environment variables that change the window Claude
 * Code assumes are honoured, or make the window unknown. A table the script
 * cannot read exits 2, so a broken install never reads as an unknown id.
 *
 * If this goes red: make the table and the script agree with the docs again.
 * Add a row only with its quote, page and date; never widen the match to a
 * family pattern.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// @ts-expect-error -- no type declarations for this .mjs script
import { windowFor } from "../skills/supervision-setup/scripts/model-window.mjs";

const SCRIPT = join(__dirname, "..", "skills/supervision-setup/scripts/model-window.mjs");
const TABLE = join(__dirname, "..", "skills/supervision-setup/references/claude-code-windows.json");

const NATIVE_1M = [
  "claude-fable-5-1",
  "claude-fable-5",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-sonnet-5-5",
  "claude-sonnet-5",
  "claude-haiku-5-5",
];
const AT_200K = [
  "claude-haiku-4-5",
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-5",
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-5",
  "claude-opus-4-5-20251101",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
];

interface Row {
  id: string;
  context_window: number;
  source: string;
  quote: string;
  checked: string;
}

const rows = (): Row[] => JSON.parse(readFileSync(TABLE, "utf8")).models;

describe("the table: every row is sourced and dated", () => {
  it("lists exactly the ids the docs give a window for, once each", () => {
    const ids = rows().map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...NATIVE_1M, ...AT_200K].sort());
  });

  it("gives each row a window, the docs page, a verbatim quote and the date it was checked", () => {
    for (const row of rows()) {
      expect([1_000_000, 200_000], row.id).toContain(row.context_window);
      expect(row.source, row.id).toMatch(/^https:\/\/(code|platform)\.claude\.com\/docs\/en\/[a-z0-9/-]+\.md$/u);
      expect(row.quote.length, row.id).toBeGreaterThan(20);
      expect(row.quote, row.id).toMatch(row.context_window === 200_000 ? /200[Kk]/u : /1M/u);
      expect(row.checked, row.id).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    }
  });
});

describe("looking up a model id", () => {
  it.each(NATIVE_1M)("gives %s the 1M window with no suffix, quoting its source", (id) => {
    const found = windowFor(id, {});
    expect(found.context_window).toBe(1_000_000);
    expect(found.evidence).toContain("code.claude.com/docs/en/model-config.md");
    expect(found.evidence).toContain("run with the 1M window by default");
    expect(found.evidence).toMatch(/checked \d{4}-\d{2}-\d{2}/u);
  });

  it.each(AT_200K)("gives %s the 200K window", (id) => {
    expect(windowFor(id, {}).context_window).toBe(200_000);
  });

  it.each(["claude-haiku-4-5", "claude-sonnet-4-5"])("sources %s's window from a page that names it", (id) => {
    expect(windowFor(id, {}).evidence).toContain("200k tokens for Claude Sonnet 4.5 (deprecated) and Claude Haiku 4.5");
  });

  it.each(["claude-opus-4-5", "claude-opus-4-5-20251101"])("sources %s's window from Opus 4.5's own page", (id) => {
    const { evidence } = windowFor(id, {});
    expect(evidence).toContain("platform.claude.com/docs/en/models/opus-4-5/overview.md");
    expect(evidence).toContain("Context window: 200K tokens");
  });

  it("gives an id with the [1m] suffix the 1M window, as before", () => {
    for (const id of ["claude-opus-5-5[1m]", "claude-opus-4-6[1m]", "claude-someday-9[1m]", "claude-opus-5-5[1M]"]) {
      const found = windowFor(id, {});
      expect(found.context_window, id).toBe(1_000_000);
      expect(found.evidence, id).toContain("[1m]");
    }
  });

  it("reads unknown for an id the table lacks, never a guess from its family", () => {
    for (const id of ["claude-opus-5-6", "claude-sonnet-6", "claude-opus-5-5-20260101", "gpt-5.6", ""]) {
      const found = windowFor(id, {});
      expect(found.context_window, id).toBeNull();
      expect(found.evidence, id).toBe("unverified");
      expect(found.reason, id).toContain("claude-code-windows.json");
      expect(found.reason, id).toContain("code.claude.com/docs/en/model-config.md");
      expect(found.reason, id).toContain("platform.claude.com");
      expect(found.reason, id).not.toContain("\n");
    }
  });

  it("holds a native-1M model to 200K when 1M context is turned off", () => {
    const found = windowFor("claude-opus-5-5", { CLAUDE_CODE_DISABLE_1M_CONTEXT: "1" });
    expect(found.context_window).toBe(200_000);
    expect(found.evidence).toContain("CLAUDE_CODE_DISABLE_1M_CONTEXT");
    expect(windowFor("claude-haiku-4-5", { CLAUDE_CODE_DISABLE_1M_CONTEXT: "1" }).context_window).toBe(
      200_000,
    );
  });

  it("sizes a [1m] id like its model when 1M context is turned off, which holds it to 200K", () => {
    for (const id of ["claude-opus-5-5[1m]", "claude-opus-4-6[1m]"]) {
      const found = windowFor(id, { CLAUDE_CODE_DISABLE_1M_CONTEXT: "1" });
      expect(found.context_window, id).toBe(200_000);
      expect(found.evidence, id).toContain("CLAUDE_CODE_DISABLE_1M_CONTEXT");
      expect(found.evidence, id).toContain("even with `CLAUDE_CODE_DISABLE_1M_CONTEXT` set");
    }
  });

  it("reads unknown for a [1m] id with no row when 1M context is turned off", () => {
    const found = windowFor("claude-someday-9[1m]", { CLAUDE_CODE_DISABLE_1M_CONTEXT: "1" });
    expect(found.context_window).toBeNull();
    expect(found.reason).toContain("claude-code-windows.json");
  });

  it("ignores the turn-off variable when it is empty", () => {
    expect(windowFor("claude-opus-5-5", { CLAUDE_CODE_DISABLE_1M_CONTEXT: "" }).context_window).toBe(1_000_000);
  });

  it("reads unknown when the turn-off variable holds any value but 1, since the docs name only 1", () => {
    for (const value of ["0", "true", "yes"]) {
      const found = windowFor("claude-opus-5-5", { CLAUDE_CODE_DISABLE_1M_CONTEXT: value });
      expect(found.context_window, value).toBeNull();
      expect(found.reason, value).toContain("CLAUDE_CODE_DISABLE_1M_CONTEXT");
    }
  });

  it("keeps a listed id's window when the window override is set without DISABLE_COMPACT, since it is inert then", () => {
    for (const [id, window] of [
      ["claude-opus-5-5", 1_000_000],
      ["claude-haiku-4-5", 200_000],
    ] as const) {
      const found = windowFor(id, { CLAUDE_CODE_MAX_CONTEXT_TOKENS: "500000" });
      expect(found.context_window, id).toBe(window);
      expect(found.evidence, id).toContain("CLAUDE_CODE_MAX_CONTEXT_TOKENS");
      expect(found.evidence, id).toContain("the variable takes effect only when you also set [`DISABLE_COMPACT`]");
    }
  });

  it("still holds a listed 1M id to 200K under the inert override when 1M context is off", () => {
    const found = windowFor("claude-opus-5-5", {
      CLAUDE_CODE_MAX_CONTEXT_TOKENS: "500000",
      CLAUDE_CODE_DISABLE_1M_CONTEXT: "1",
    });
    expect(found.context_window).toBe(200_000);
    expect(found.evidence).toContain("DISABLE_COMPACT");
  });

  it("reads unknown when the window override is set with DISABLE_COMPACT, never taking its value as the window", () => {
    for (const compact of ["1", "true"]) {
      const found = windowFor("claude-opus-5-5", { CLAUDE_CODE_MAX_CONTEXT_TOKENS: "500000", DISABLE_COMPACT: compact });
      expect(found.context_window, compact).toBeNull();
      expect(found.reason, compact).toContain("DISABLE_COMPACT");
    }
  });

  it.each([
    ["claude-opus-4-6[1m]", {}, 1_000_000],
    ["claude-opus-4-8[1m]", {}, 1_000_000],
    ["claude-opus-4-6[1m]", { CLAUDE_CODE_DISABLE_1M_CONTEXT: "1" }, 200_000],
    ["claude-opus-4-8[1m]", { CLAUDE_CODE_DISABLE_1M_CONTEXT: "1" }, 200_000],
  ] as const)(
    "sizes %s %j as usual under the inert override, since a [1m] id resolves to its model's row",
    (id, env, window) => {
      const found = windowFor(id, { CLAUDE_CODE_MAX_CONTEXT_TOKENS: "500000", ...env });
      expect(found.context_window).toBe(window);
      expect(found.evidence).toContain("the variable takes effect only when you also set [`DISABLE_COMPACT`]");
    },
  );

  it("reads unknown when the window override is set for an id with no row, with or without [1m]", () => {
    for (const id of ["claude-someday-9[1m]", "claude-opus-9", "gateway/claude-opus-5-5"]) {
      const found = windowFor(id, { CLAUDE_CODE_MAX_CONTEXT_TOKENS: "500000" });
      expect(found.context_window, id).toBeNull();
      expect(found.reason, id).toContain("CLAUDE_CODE_MAX_CONTEXT_TOKENS");
    }
  });
});

describe("the command setup runs", () => {
  function lookup(args: readonly string[], env: Record<string, string> = {}) {
    const base = { ...process.env };
    delete base.CLAUDE_CODE_DISABLE_1M_CONTEXT;
    delete base.CLAUDE_CODE_MAX_CONTEXT_TOKENS;
    delete base.DISABLE_COMPACT;
    const run = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env: { ...base, ...env } });
    return { code: run.status, out: run.stdout, err: run.stderr };
  }

  it("prints the model's window and evidence as one JSON line, exit 0", () => {
    const run = lookup(["claude-opus-5-5"]);
    expect(run.code).toBe(0);
    const line = JSON.parse(run.out);
    expect(line).toMatchObject({ id: "claude-opus-5-5", context_window: 1_000_000 });
    expect(line.evidence).toContain("model-config.md");
    expect(run.out.trim().split("\n")).toHaveLength(1);
  });

  it("prints a null window, unverified evidence and the reason for an unknown id, exit 1", () => {
    const run = lookup(["claude-opus-9"]);
    expect(run.code).toBe(1);
    expect(JSON.parse(run.out)).toMatchObject({
      id: "claude-opus-9",
      context_window: null,
      evidence: "unverified",
    });
  });

  it("reads the environment it runs in", () => {
    const run = lookup(["claude-opus-5-5"], { CLAUDE_CODE_DISABLE_1M_CONTEXT: "1" });
    expect(run.code).toBe(0);
    expect(JSON.parse(run.out).context_window).toBe(200_000);
  });

  it("exits 2 with usage when no model id is given", () => {
    for (const args of [[], ["a", "b"]]) {
      const run = lookup(args);
      expect(run.code).toBe(2);
      expect(run.err).toMatch(/usage/iu);
    }
  });

  it("exits 2 naming the table when the table is missing or corrupt, never 1, which reads as an unknown id", () => {
    for (const table of [null, "{ not json", '{"models": "none"}', '{"models":[],"rules":{}}']) {
      const root = mkdtempSync(join(tmpdir(), "model-window-"));
      mkdirSync(join(root, "scripts"));
      mkdirSync(join(root, "references"));
      copyFileSync(SCRIPT, join(root, "scripts", "model-window.mjs"));
      if (table !== null) writeFileSync(join(root, "references", "claude-code-windows.json"), table);
      const run = spawnSync(process.execPath, [join(root, "scripts", "model-window.mjs"), "claude-opus-9"], {
        encoding: "utf8",
      });
      rmSync(root, { recursive: true, force: true });
      expect(run.status, String(table)).toBe(2);
      expect(run.stdout, String(table)).toBe("");
      expect(run.stderr, String(table)).toContain("claude-code-windows.json");
      expect(run.stderr.trim().split("\n"), String(table)).toHaveLength(1);
    }
  });
});
