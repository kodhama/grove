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
 * `unverified`, and a `reason`), 2 is bad arguments.
 *
 * The windows come from `../references/claude-code-windows.json`, quoted
 * from Claude Code's docs, or Anthropic's model docs where those do not name
 * the model, with the page and the date each was checked:
 *
 * - an id with the `[1m]` suffix runs with 1,000,000 tokens, as before;
 * - an id with a row there runs with that row's window;
 * - `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` holds the 1M rows to 200,000, and makes
 *   a `[1m]` id unknown, since Claude Code then sizes it by rules this table
 *   does not copy. Any value but `1` makes every id unknown: the docs name
 *   only `1`;
 * - `CLAUDE_CODE_MAX_CONTEXT_TOKENS` set makes every id unknown, since how it
 *   applies depends on how Claude Code resolves the id;
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

/** A quoted source as one evidence string: its page, the quote, and when it was checked. */
function cite({ source, quote, checked }) {
  return `${source}: "${quote}" (checked ${checked})`;
}

function unknown(id, reason) {
  return { id, context_window: null, evidence: "unverified", reason };
}

/** The window for `id` under the environment `env`. */
export function windowFor(id, env) {
  const { models, rules } = JSON.parse(readFileSync(TABLE, "utf8"));
  if (env.CLAUDE_CODE_MAX_CONTEXT_TOKENS)
    return unknown(
      id,
      `CLAUDE_CODE_MAX_CONTEXT_TOKENS is set, and how it applies depends on how Claude Code resolves the id: ${cite(rules.max_context_tokens)}`,
    );
  const turnOff = env.CLAUDE_CODE_DISABLE_1M_CONTEXT ?? "";
  if (turnOff !== "" && turnOff !== "1")
    return unknown(id, `CLAUDE_CODE_DISABLE_1M_CONTEXT is "${turnOff}", and the docs name only 1: ${cite(rules.disable_1m)}`);
  const disabled = turnOff === "1";
  if (id.endsWith("[1m]")) {
    if (disabled)
      return unknown(id, `CLAUDE_CODE_DISABLE_1M_CONTEXT=1, and Claude Code then sizes a [1m] id by rules this table does not copy: ${cite(rules.disable_1m)}`);
    return { id, context_window: ONE_MILLION, evidence: `the id carries the [1m] suffix: ${cite(rules.suffix_1m)}` };
  }
  const row = models.find((model) => model.id === id);
  if (!row)
    return unknown(
      id,
      `no row for "${id}" in ${TABLE_NAME}; add one only with the window, page and quote from ${rules.suffix_1m.source}`,
    );
  if (disabled && row.context_window === ONE_MILLION)
    return { id, context_window: HELD, evidence: `CLAUDE_CODE_DISABLE_1M_CONTEXT=1: ${cite(rules.disable_1m)}` };
  return { id, context_window: row.context_window, evidence: cite(row) };
}

function main(args) {
  if (args.length !== 1) {
    process.stderr.write("usage: model-window.mjs <model id>\n");
    return 2;
  }
  const found = windowFor(args[0], process.env);
  process.stdout.write(`${JSON.stringify(found)}\n`);
  return found.context_window === null ? 1 : 0;
}

// Compare real paths: run through a symlink, argv names the link and the URL the file.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
