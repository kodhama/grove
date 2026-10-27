/**
 * KOD-15 (plan unit U5) — grove installs through the kodhama CLI as well as
 * the plugin. The CLI shallow-clones a `vX.Y.Z` tag and reads `kodhama.json`
 * at the tool's root.
 *
 * - `kodhama.json` holds exactly `name` and `skills`: the CLI refuses any
 *   other key, so a version or a skills list would make the install fail.
 * - Read the way the CLI reads it, the skills folder holds exactly grove's
 *   five skills: every direct child folder with a `SKILL.md`, named in
 *   lowercase letters, digits and "-", none of them a symlink.
 * - No skill folder holds a symlink or the CLI's own marker, which the CLI
 *   refuses to install.
 * - The version lives in both `plugin.json` files, which
 *   `plugin-manifests.test.ts` holds in step, and in the tag cut after merge.
 *
 * If this goes red: fix `kodhama.json` or the skills folder it names. Add a
 * key only once the CLI accepts it.
 */
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import { describe, expect, it } from "vitest";

/** The CLI's own rules, from kodhama/stewards `src/manifest.mjs`. */
const NAME = /^[a-z][a-z0-9-]*$/;
const MARKER = ".kodhama-skill.json";
const SKILLS = ["context-gauge", "project-lead", "session-restart", "story-worker", "supervision-setup"];

type Manifest = Record<string, unknown>;

const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

/** Every path under a folder, without following a symlink. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? [path, ...walk(path)] : [path];
  });
}

describe("KOD-15 · grove's kodhama.json (U5)", () => {
  const manifest = read<Manifest>("kodhama.json");
  const skills = manifest.skills as string;

  it("holds exactly name and skills, naming grove", () => {
    expect(Object.keys(manifest).sort()).toEqual(["name", "skills"]);
    expect(manifest.name).toBe("grove");
  });

  it("names a relative skills folder with no '..'", () => {
    expect(typeof manifest.skills).toBe("string");
    expect(isAbsolute(skills)).toBe(false);
    expect(skills.split("/")).not.toContain("..");
  });

  it("names a folder the CLI reads as exactly grove's five skills", () => {
    const found = readdirSync(skills, { withFileTypes: true })
      .filter((entry) => !entry.isSymbolicLink() && entry.isDirectory())
      .filter((entry) => existsSync(join(skills, entry.name, "SKILL.md")))
      .map((entry) => entry.name)
      .sort();
    expect(found).toEqual(SKILLS);
    for (const name of found) expect(name).toMatch(NAME);
  });

  it("ships no symlink and no installer marker in any skill folder", () => {
    const paths = walk(skills);
    expect(paths.filter((path) => lstatSync(path).isSymbolicLink())).toEqual([]);
    expect(paths.filter((path) => path.endsWith(`/${MARKER}`))).toEqual([]);
  });
});
