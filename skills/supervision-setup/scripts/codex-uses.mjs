/**
 * MQ-377 — read what a Codex rollout shows was used, whether each call ran,
 * and which child threads it started.
 *
 * In plain words: a Codex rollout is one JSON record per line. A call is a
 * `function_call` or `custom_tool_call` record, answered later by an output
 * record with the same `call_id`. Some calls also leave a record of their own:
 * a command (`CommandExecution`), an MCP call (`McpToolCall`), a patch
 * (`FileChange`) or a child thread's activity (`SubAgentActivity`). This file
 * turns those records into uses, each tagged with whether its call ran:
 *
 *   { kind: "tool", name: "mcp__codex_apps__linear_save_comment", outcome: "failed" }
 *
 * - a skill: a command whose `parsed_cmd` reads `<skill>/SKILL.md`;
 * - a cli or a skill-script: what a command's shell line runs (`shell-uses.mjs`);
 * - a tool: a call by name, a namespaced one as `<namespace>.<name>`
 *   (`collaboration.spawn_agent`); an MCP call as `mcp__<server>__<tool>`;
 *   and a patch as `apply_patch`.
 *
 * Whether it ran:
 * - a command `ran` when its status is `completed`, or `failed` with an exit
 *   code other than 126 or 127 (it ran and exited non-zero) and no line of
 *   its output starting with zsh's own parse error (`zsh:1: parse error`,
 *   `zsh:1: unmatched "`, when it ran none of the line; Codex writes it to `stdout`, leaving
 *   `stderr` empty); else `failed`.
 *   A SKILL.md read in it `ran` only when its status is `completed`: the read
 *   shows the skill was loaded, not that a command ran, so it fails closed;
 * - an MCP call or a patch `ran` when its status is `completed`; any other
 *   status, such as a refused post's `failed`, is `failed`;
 * - a `collaboration.spawn_agent` call `ran` when a `started` activity carries
 *   its `call_id`, and `failed` when its output came back without one;
 * - any other call `ran` once its output came back, unless that output starts
 *   "aborted" (`aborted by user after 60.5s`), when it `failed`. An output is
 *   a string or a list of `input_text` blocks;
 * - a call with no output yet is `pending`.
 *
 * Its limits. A code-mode script's text gives no credit: in code mode every
 * call record is named `exec`, which reads as a use of `exec`, and a tool the
 * script calls counts only from that tool's own record (a command, an MCP
 * call or a patch). So a tool with no record of its own, such as
 * `write_stdin`, cannot be credited from a script. A call refused at an
 * approval prompt still writes its output, so the last kind of call above
 * reads `ran`. And every command a shell line runs shares that line's outcome:
 * in `cd x && herdr …` a failed `cd` still credits herdr, and a line whose
 * last command could not run (exit 127) reads `failed` for every command in it.
 *
 * Child threads: only a `started` activity names one; an `interacted` one
 * can name the parent. Its rollout sits in `sessions/`, in whatever date
 * folder it started in, or in the flat `archived_sessions/` beside it once
 * archived. A started child found in neither is reported missing.
 *
 * Plan: docs/plans/2026-10-04-0734-feat-receipt-check-credits-calls-that-ran-plan.md,
 * KTD1, KTD2, KTD7 and U2.
 */
import { globSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { SHELL_COULD_NOT_PARSE, SHELL_COULD_NOT_RUN, shellUses } from "./shell-uses.mjs";

/** The tool that starts a child thread; a `started` activity, not its output, shows it ran. */
const SPAWN = "collaboration.spawn_agent";
/** A call record's type, as against its output record (`function_call_output`). */
const CALL = /function_call$|custom_tool_call$/;
/** An output record's type. */
const OUTPUT = /_call_output$/;
/** A rollout's file name less `.jsonl`; group 1 is its thread id, a uuid. */
export const ROLLOUT_NAME = /^rollout-.*-(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})$/;

/** The item a Codex `item_completed` record carries, or null. */
function codexItem(record) {
  return record?.payload?.type === "item_completed" ? record.payload.item : null;
}

/** The shell line a Codex command ran: `["/bin/zsh", "-lc", "<line>"]` gives the line. */
function codexShellLine(command) {
  if (!Array.isArray(command)) return typeof command === "string" ? command : "";
  return ["-c", "-lc"].includes(command[1]) ? String(command[2] ?? "") : command.join(" ");
}

/**
 * What one Codex command execution shows was used. A SKILL.md read carries
 * its own outcome: it shows the skill was loaded only when the command
 * completed, so any other status reads `failed`.
 */
function commandUses(item) {
  const outcome = item.status === "completed" ? "ran" : "failed";
  const reads = (Array.isArray(item.parsed_cmd) ? item.parsed_cmd : [])
    .filter((part) => part?.type === "read" && /\/SKILL\.md$/.test(part.path ?? ""))
    .map((part) => ({ kind: "skill", name: basename(dirname(part.path)), outcome }));
  return [...reads, ...shellUses(codexShellLine(item.command))];
}

/**
 * What one Codex MCP call shows was used, under the id setup records for an
 * MCP tool: server `codex_apps` and tool `linear.save_comment` give
 * `mcp__codex_apps__linear_save_comment`.
 */
function mcpUses(item) {
  if (typeof item.server !== "string" || typeof item.tool !== "string") return [];
  return [{ kind: "tool", name: `mcp__${item.server}__${item.tool.replaceAll(".", "_")}` }];
}

/** What one item a call left shows was used: a command, an MCP call or a patch. */
function itemUses(item) {
  switch (item?.type) {
    case "CommandExecution":
      return commandUses(item);
    case "McpToolCall":
      return mcpUses(item);
    case "FileChange":
      return [{ kind: "tool", name: "apply_patch" }];
    default:
      return [];
  }
}

/**
 * Whether an item's call ran, from its own status and, for a command, its exit
 * code and whether its output shows the shell could not parse the line.
 */
function itemOutcome(item) {
  if (item.status === "completed") return "ran";
  const exit = item.type === "CommandExecution" && item.status === "failed" ? item.exit_code : null;
  const output = [item.stdout, item.stderr].filter((text) => typeof text === "string").join("\n");
  const ran =
    Number.isInteger(exit) && !SHELL_COULD_NOT_RUN.has(exit) && !SHELL_COULD_NOT_PARSE.codex.test(output);
  return ran ? "ran" : "failed";
}

/** An output's text: a string, or a list of `input_text` blocks. */
function outputText(output) {
  if (typeof output === "string") return output;
  if (!Array.isArray(output)) return "";
  return output.map((block) => (typeof block?.text === "string" ? block.text : "")).join("");
}

/**
 * What answered each call in a rollout, by `call_id`: the text of its output
 * record, and whether a `started` activity answered it (a spawn).
 */
function answers(recorded) {
  const outputs = new Map();
  const started = new Set();
  for (const record of recorded) {
    const payload = record?.type === "response_item" ? record.payload : null;
    if (OUTPUT.test(payload?.type ?? "")) outputs.set(payload.call_id, outputText(payload.output));
    const item = codexItem(record);
    if (item?.type === "SubAgentActivity" && item.kind === "started") started.add(item.id);
  }
  return { outputs, started };
}

/** Whether a function or custom tool call ran, from what answered it. */
function callOutcome(name, callId, answered) {
  if (name === SPAWN && answered.started.has(callId)) return "ran";
  const output = answered.outputs.get(callId);
  if (output === undefined) return "pending";
  if (name === SPAWN) return "failed";
  return output.startsWith("aborted") ? "failed" : "ran";
}

/** A record's top-level `timestamp`, which Claude Code and Codex both write, or null. */
export function timeOf(record) {
  return typeof record?.timestamp === "string" ? record.timestamp : null;
}

/**
 * What one Codex rollout record shows was used, each use tagged with whether
 * it ran (its item's outcome, unless the use carries its own: a SKILL.md
 * read) and when (`at`, the record's time).
 */
function recordUses(record, answered) {
  const at = timeOf(record);
  const payload = record?.type === "response_item" ? record.payload : null;
  if (CALL.test(payload?.type ?? "")) {
    const name = payload.namespace ? `${payload.namespace}.${payload.name}` : payload.name;
    return [{ kind: "tool", name, outcome: callOutcome(name, payload.call_id, answered), at }];
  }
  const item = codexItem(record);
  const uses = itemUses(item);
  if (uses.length === 0) return uses;
  const outcome = itemOutcome(item);
  return uses.map((use) => ({ outcome, ...use, at }));
}

/** Every use one Codex rollout's records show, in order, each tagged with whether it ran and when (`at`). */
export function codexUses(recorded) {
  const answered = answers(recorded);
  return recorded.flatMap((record) => recordUses(record, answered));
}

/** Where a rollout's Codex home keeps rollouts: `sessions/` by date, and `archived_sessions/` flat. */
function rolloutFolders(path) {
  const folder = dirname(path);
  if (basename(folder) === "archived_sessions") {
    return { sessions: join(dirname(folder), "sessions"), archived: folder };
  }
  const sessions = dirname(dirname(dirname(folder)));
  return { sessions, archived: join(dirname(sessions), "archived_sessions") };
}

/** The thread id a started child's activity names, or none. */
function startedThread(record) {
  const item = codexItem(record);
  if (item?.type !== "SubAgentActivity" || item.kind !== "started") return [];
  return item.agent_thread_id ? [item.agent_thread_id] : [];
}

/** Each rollout `pattern` finds under `folder`, by its thread id; the first one found wins. */
function rolloutsById(folder, pattern) {
  const byId = new Map();
  for (const file of globSync(pattern, { cwd: folder })) {
    const id = ROLLOUT_NAME.exec(basename(file, ".jsonl"))?.[1];
    if (id && !byId.has(id)) byId.set(id, join(folder, file));
  }
  return byId;
}

/**
 * The child threads a rollout's `started` activities name: the rollout of
 * each one found, and the thread id and the place looked of each one not.
 * `sessions/` is searched first, and `archived_sessions/` only for the rest.
 */
export function codexChildren(path, recorded) {
  const ids = [...new Set(recorded.flatMap(startedThread))];
  if (ids.length === 0) return { found: [], missing: [] };
  const { sessions, archived } = rolloutFolders(path);
  const active = rolloutsById(sessions, "*/*/*/rollout-*.jsonl");
  const rest = ids.filter((id) => !active.has(id));
  const archivedById = rest.length > 0 ? rolloutsById(archived, "rollout-*.jsonl") : new Map();
  const found = [];
  const missing = [];
  for (const id of ids) {
    const rollout = active.get(id) ?? archivedById.get(id);
    if (rollout) found.push(rollout);
    else missing.push({ id, path: join(sessions, "*", "*", "*", `rollout-*-${id}.jsonl`) });
  }
  return { found, missing };
}
