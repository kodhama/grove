/**
 * MQ-377 — read which operations a level skill's routing table marks
 * `fresh_context = true`, for the receipt check (`receipt-check.mjs`).
 *
 * In plain words: a review operation counts only when its performer ran in a
 * fresh-context subagent, and the routing table, not the bindings file, says
 * which operations those are. Setup copies only some of a table's fields into
 * the bindings file, so a dropped field would silently let a review count from
 * any context; reading the table here cannot drop it. This file finds the
 * table the bindings file names and returns:
 *
 *   { path: "<checkout>/.agents/skills/story-worker/routing.toml",
 *     skill: "story-worker", marked: ["review", "review-escalation"],
 *     sha256: "<hex>", recorded: "<hex setup recorded>", changed: false }
 *
 * The table's path in a bindings file is relative to the checkout setup ran
 * in. A bindings file can be checked from another worktree, or from a checkout
 * whose table predates the marks, and either would read a table with none. So
 * the path resolves against the nearest folder above the bindings file that
 * holds it, and only then against the working directory. `changed` is true
 * when the table's sha256 differs from the one setup recorded.
 *
 * A recorded path can name a file that is gone: a plugin update or a move
 * takes away the versioned folder setup read the table from. The table is
 * then read by skill name, from `<skill>/routing.toml` in the skills folder
 * this script ships in, and `moved` holds the recorded path. The sha256 check
 * still says whether that table differs from the one setup read.
 *
 * Only the level skill's own table is read; no table a bound skill brings
 * marks an operation. A table whose `skill` is not the bindings file's is an
 * error, since it would mark none of that skill's operations.
 *
 * Plan: docs/plans/2026-10-04-0734-feat-receipt-check-credits-calls-that-ran-plan.md,
 * KTD4, KTD9 and U3.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "./vendor/smol-toml/index.js";

/** The skills folder this script ships in: scripts/, then supervision-setup/, then the skills. */
const SKILLS = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Where a relative table path resolves: the nearest folder above the bindings file holding it, else the working directory. */
function tablePath(relative, bindingsPath) {
  if (isAbsolute(relative)) return relative;
  let folder = bindingsPath ? dirname(resolve(bindingsPath)) : null;
  while (folder) {
    const candidate = join(folder, relative);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(folder);
    folder = parent === folder ? null : parent;
  }
  return resolve(process.cwd(), relative);
}

/**
 * The routing table a bindings file names, read for its marked operations,
 * or `{ error }` saying why it cannot be read. `bindingsPath` is the bindings
 * file's own path, or null for bindings that were never read from a file.
 */
export function readRoutingTable(bindings, bindingsPath = null) {
  const relative = bindings?.table?.path;
  if (typeof relative !== "string" || relative === "") {
    return { error: "the bindings file names no routing table (table.path)" };
  }
  let path = tablePath(relative, bindingsPath);
  let moved;
  const skill = bindings.skill;
  if (!existsSync(path) && typeof skill === "string" && skill !== "" && basename(skill) === skill) {
    const beside = join(SKILLS, skill, "routing.toml");
    if (!existsSync(beside)) {
      return { error: `cannot read the routing table ${path}, nor ${beside} beside this checker` };
    }
    moved = relative;
    path = beside;
  }
  let bytes;
  let table;
  try {
    bytes = readFileSync(path);
    table = parse(bytes.toString("utf8"));
  } catch (error) {
    const reason = String(error?.message ?? error).split("\n")[0];
    return { error: `cannot read the routing table ${path}: ${reason}` };
  }
  // Another skill's table would mark none of this skill's operations, so a
  // review would count from any context.
  const named = typeof table.skill === "string" && typeof bindings.skill === "string";
  if (named && table.skill !== bindings.skill) {
    return { error: `the routing table ${path} is for ${table.skill}, not ${bindings.skill}` };
  }
  const operations = Array.isArray(table.operation) ? table.operation : [];
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const recorded = bindings.table.sha256 ?? null;
  return {
    path,
    ...(moved === undefined ? {} : { moved }),
    skill: typeof table.skill === "string" ? table.skill : bindings.skill,
    marked: operations.filter((o) => o?.fresh_context === true).map((o) => String(o.id)),
    sha256,
    recorded,
    changed: sha256 !== recorded,
  };
}
