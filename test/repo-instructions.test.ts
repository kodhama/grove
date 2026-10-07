/**
 * Grove's contributor layer: an agent working on this repo, on Claude Code or
 * Codex, starts with grove's own rules and the plugins those rules assume
 * (GRO-6, U8).
 *
 * - `AGENTS.md` holds the tool-neutral rules, and `CLAUDE.md` imports it, so
 *   Claude Code loads the same text every other agent reads.
 * - `.claude/settings.json` enables plugins only from marketplaces it
 *   declares, so a fresh clone can install them.
 * - `.codex/config.toml` enables plugins only from the repo marketplace in
 *   `.agents/plugins/marketplace.json`, which Codex reads for this project.
 * - trellis is enabled on both hosts, and `.trellis/rules.toml` selects its
 *   rules.
 * - git ignores the session state the skills and CE write under `.context/`:
 *   bindings name transcript paths under a real home directory.
 *
 * If this goes red: fix the file it names. A plugin enabled from a
 * marketplace nobody declared is a plugin no fresh session can install.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "../skills/supervision-setup/scripts/vendor/smol-toml/index.js";

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

/** `name@marketplace` split at its last `@`. */
function identity(id: string): { name: string; marketplace: string } {
  const at = id.lastIndexOf("@");
  if (at < 0) return { name: id, marketplace: "" };
  return { name: id.slice(0, at), marketplace: id.slice(at + 1) };
}

describe("GRO-6 · grove's contributor layer (U8)", () => {
  it("has an AGENTS.md", () => {
    expect(read("AGENTS.md").trim()).not.toBe("");
  });

  it("CLAUDE.md's first non-blank line imports AGENTS.md", () => {
    const first = read("CLAUDE.md")
      .split("\n")
      .find((line) => line.trim() !== "");
    expect(first?.trim()).toBe("@AGENTS.md");
  });

  it("every plugin .claude/settings.json enables comes from a marketplace it declares", () => {
    const settings = JSON.parse(read(".claude/settings.json") || "{}") as {
      extraKnownMarketplaces?: Record<string, unknown>;
      enabledPlugins?: Record<string, boolean>;
    };
    const enabled = Object.entries(settings.enabledPlugins ?? {})
      .filter(([, on]) => on)
      .map(([id]) => id);
    expect(enabled).not.toEqual([]);
    const declared = Object.keys(settings.extraKnownMarketplaces ?? {});
    const undeclared = enabled.filter((id) => !declared.includes(identity(id).marketplace));
    expect(undeclared).toEqual([]);
  });

  it("every plugin .codex/config.toml enables is listed in the repo marketplace", () => {
    const config = parse(read(".codex/config.toml")) as {
      plugins?: Record<string, { enabled?: boolean }>;
    };
    const enabled = Object.entries(config.plugins ?? {})
      .filter(([, plugin]) => plugin.enabled === true)
      .map(([id]) => identity(id));
    expect(enabled).not.toEqual([]);
    const marketplace = JSON.parse(read(".agents/plugins/marketplace.json") || "{}") as {
      name?: string;
      plugins?: { name: string }[];
    };
    const listed = (marketplace.plugins ?? []).map((plugin) => plugin.name);
    const missing = enabled
      .filter((plugin) => plugin.marketplace !== marketplace.name || !listed.includes(plugin.name))
      .map((plugin) => `${plugin.name}@${plugin.marketplace}`);
    expect(missing).toEqual([]);
  });

  it("enables trellis on both hosts, with a rules file selecting its rules", () => {
    const settings = JSON.parse(read(".claude/settings.json") || "{}") as {
      enabledPlugins?: Record<string, boolean>;
    };
    const codex = parse(read(".codex/config.toml")) as {
      plugins?: Record<string, { enabled?: boolean }>;
    };
    expect(settings.enabledPlugins?.["trellis@kodhama"]).toBe(true);
    expect(codex.plugins?.["trellis@grove"]?.enabled).toBe(true);
    expect(read(".trellis/rules.toml")).toMatch(/^\[rules\]/m);
  });

  it.each([".context/supervision/some-lead/bindings.json", ".context/compound-engineering/run/state.json"])(
    "git ignores %s",
    (path) => {
      expect(spawnSync("git", ["check-ignore", "-q", path]).status).toBe(0);
    },
  );
});
