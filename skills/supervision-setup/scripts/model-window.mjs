/**
 * Look up the context window Claude Code runs a model id with, for setup to
 * record in the bindings file's `model` header. The gauge measures against
 * that window, so a wrong one makes a session restart too early or too late,
 * and a guessed one is never recorded.
 *
 *   node model-window.mjs <model id>
 *   {"id":"claude-opus-5-5","context_window":1000000,"evidence":"<page>: \"<quote>\" (checked <date>)"}
 *
 * Exit 0 is a known window, 1 is unknown (`context_window` null, evidence
 * `unverified`, and a `reason`), 2 is bad arguments or a table it cannot
 * read, said in one line on stderr.
 *
 * The windows come from `../references/claude-code-windows.json`, quoted
 * from Claude Code's docs, or Anthropic's model docs where those do not name
 * the model, with the page and the date each was checked:
 *
 * - an id with the `[1m]` suffix, in any casing, runs with 1,000,000 tokens,
 *   as before;
 * - an id with a row there runs with that row's window;
 * - `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` holds the 1M rows to 200,000, and sizes
 *   a `[1m]` id like its model's row, so it reads 200,000 too, or unknown with
 *   no row. Any value but `1` makes every id unknown: the docs name only `1`;
 * - `CLAUDE_CODE_MAX_CONTEXT_TOKENS` set leaves an id with a row its window
 *   while `DISABLE_COMPACT` is unset, since the docs make it inert for a
 *   model Claude Code recognizes until then; it makes every other id unknown,
 *   and so does `DISABLE_COMPACT` set: its value is never read as the window;
 * - any other id is unknown. Never match an id by its family: a new model
 *   gets a row once the docs give its window.
 */
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const TABLE_NAME = "claude-code-windows.json";
const TABLE = join(dirname(fileURLToPath(import.meta.url)), "..", "references", TABLE_NAME);
const ONE_MILLION = 1_000_000;
const HELD = 200_000;
/** The 1M suffix, which Claude Code reads in any casing. */
const SUFFIX_1M = /\[1m\]$/iu;

/** A quoted source as one evidence string: its page, the quote, and when it was checked. */
function cite({ source, quote, checked }) {
  return `${source}: "${quote}" (checked ${checked})`;
}

function unknown(id, reason) {
  return { id, context_window: null, evidence: "unverified", reason };
}

/** The table, or a throw naming what is wrong with it. */
function readTable() {
  const table = JSON.parse(readFileSync(TABLE, "utf8"));
  if (!Array.isArray(table?.models) || typeof table.rules !== "object" || table.rules === null)
    throw new Error("it has no models list or no rules");
  return table;
}

/** The window for `id` under the environment `env`. */
export function windowFor(id, env, table = readTable()) {
  const { models, rules } = table;
  if (!env.CLAUDE_CODE_MAX_CONTEXT_TOKENS) return lookup(id, env, table);
  if (env.DISABLE_COMPACT)
    return unknown(
      id,
      `CLAUDE_CODE_MAX_CONTEXT_TOKENS and DISABLE_COMPACT are both set, so the override can apply: ${cite(rules.max_context_inert)}`,
    );
  if (!models.some((row) => row.id === id))
    return unknown(
      id,
      `CLAUDE_CODE_MAX_CONTEXT_TOKENS is set, and how it applies depends on how Claude Code resolves the id: ${cite(rules.max_context_tokens)}`,
    );
  const found = lookup(id, env, table);
  if (found.context_window === null) return found;
  return {
    ...found,
    evidence: `CLAUDE_CODE_MAX_CONTEXT_TOKENS is set without DISABLE_COMPACT: ${cite(rules.max_context_inert)}; ${found.evidence}`,
  };
}

/** The window for `id` from the table alone, with the 1M turn-off applied. */
function lookup(id, env, { models, rules }) {
  const turnOff = env.CLAUDE_CODE_DISABLE_1M_CONTEXT ?? "";
  if (turnOff !== "" && turnOff !== "1")
    return unknown(id, `CLAUDE_CODE_DISABLE_1M_CONTEXT is "${turnOff}", and the docs name only 1: ${cite(rules.disable_1m)}`);
  const disabled = turnOff === "1";
  const suffixed = SUFFIX_1M.test(id);
  if (suffixed && !disabled)
    return { id, context_window: ONE_MILLION, evidence: `the id carries the [1m] suffix: ${cite(rules.suffix_1m)}` };
  // With 1M context turned off, Claude Code sizes a [1m] id like its model.
  const model = id.replace(SUFFIX_1M, "");
  const row = models.find((candidate) => candidate.id === model);
  if (!row)
    return unknown(
      id,
      `no row for "${model}" in ${TABLE_NAME}; add one only with the window, page and quote from ${rules.suffix_1m.source} or the model's own overview on platform.claude.com`,
    );
  const resolved = suffixed ? `${cite(rules.suffix_resolves)}; ` : "";
  if (disabled && row.context_window === ONE_MILLION)
    return { id, context_window: HELD, evidence: `CLAUDE_CODE_DISABLE_1M_CONTEXT=1: ${resolved}${cite(rules.disable_1m)}` };
  if (suffixed)
    return { id, context_window: row.context_window, evidence: `CLAUDE_CODE_DISABLE_1M_CONTEXT=1: ${resolved}${cite(row)}` };
  return { id, context_window: row.context_window, evidence: cite(row) };
}

function main(args) {
  if (args.length !== 1) {
    process.stderr.write("usage: model-window.mjs <model id>\n");
    return 2;
  }
  let table;
  try {
    table = readTable();
  } catch (error) {
    process.stderr.write(`model-window.mjs: cannot read ${TABLE}: ${String(error?.message ?? error).split("\n")[0]}\n`);
    return 2;
  }
  const found = windowFor(args[0], process.env, table);
  process.stdout.write(`${JSON.stringify(found)}\n`);
  return found.context_window === null ? 1 : 0;
}

// Compare real paths: run through a symlink, argv names the link and the URL the file.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
