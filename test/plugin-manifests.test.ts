/**
 * GRO-6 (plan U5) — grove installs as one plugin, `grove`, on Claude Code and
 * on Codex, from a marketplace this repo serves itself.
 *
 * - Both hosts' `plugin.json` name the plugin `grove` and carry the same
 *   `version`. An install keeps its cached copy until `version` changes, so
 *   every merge to `main` bumps both together.
 * - Each host's marketplace file lists exactly one plugin, `grove`, whose
 *   source is this repo's root.
 * - Every folder under `skills/` is a skill whose `name` is the folder's, so
 *   a host lists it as `grove:<folder>` and setup binds it by that name.
 *
 * If this goes red: fix the manifest it names. Bump a version in both
 * `plugin.json` files at once, never in one.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type Manifest = { name?: string; version?: string; skills?: string };
type Listing = { name?: string; plugins?: { name?: string; source?: unknown }[] };

const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

describe("GRO-6 · grove's plugin manifests (U5)", () => {
  const claude = read<Manifest>(".claude-plugin/plugin.json");
  const codex = read<Manifest>(".codex-plugin/plugin.json");

  it("both hosts' manifests name the plugin grove, at one version", () => {
    expect(claude.name).toBe("grove");
    expect(codex.name).toBe("grove");
    expect(claude.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(codex.version).toBe(claude.version);
  });

  it("the Codex manifest points at the skills folder", () => {
    expect(codex.skills).toBe("./skills/");
  });

  it("Claude Code's marketplace lists only grove, sourced from this repo's root", () => {
    const listing = read<Listing>(".claude-plugin/marketplace.json");
    expect(listing.name).toBe("grove");
    expect(listing.plugins?.map((p) => [p.name, p.source])).toEqual([["grove", "./"]]);
  });

  it("Codex's marketplace lists only grove, sourced from this repo's root", () => {
    const listing = read<Listing>(".agents/plugins/marketplace.json");
    expect(listing.name).toBe("grove");
    expect(listing.plugins?.map((p) => [p.name, p.source])).toEqual([
      ["grove", { source: "local", path: "./" }],
    ]);
  });

  it.each(readdirSync("skills", { withFileTypes: true }).filter((e) => e.isDirectory()))(
    "skills/$name is a skill named after its folder",
    ({ name }) => {
      const path = join("skills", name, "SKILL.md");
      expect(existsSync(path), path).toBe(true);
      const frontmatter = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path, "utf8"))?.[1] ?? "";
      expect(/^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim()).toBe(name);
    },
  );
});
