/**
 * MQ-353 — read what a session's transcripts show it used: which skills,
 * tools, agents and commands it called. The receipt check
 * (`receipt-check.mjs`) compares these uses with a bindings file.
 *
 * In plain words: a Claude Code transcript or a Codex rollout is one JSON
 * record per line. This file finds the calls in them, and the subagent
 * transcripts beside them, and returns each call as a use:
 *
 *   { kind: "skill", name: "compound-engineering:ce-work", outcome: "ran",
 *     at: "2026-10-08T10:03:00.000Z", where: "<session id>",
 *     context: "main session", fresh: false, session: "<session id>" }
 *
 * `at` is the call's record's top-level `timestamp`, or null where it has
 * none; `session` is the listed session the transcript belongs to, a
 * subagent's included.
 *
 * On Claude Code:
 * - a skill: a `Skill` call;
 * - a cli or a skill-script: what a `Bash` call's command runs
 *   (`shell-uses.mjs`);
 * - an agent: an `Agent` call's type, `general-purpose` when the call names
 *   none (the tool's default);
 * - a tool: any tool call, by name.
 * A Codex rollout's uses, and whether each of its calls ran, are read in
 * `codex-uses.mjs`.
 *
 * Whether a Claude Code call ran: it is paired with the `tool_result` that
 * carries its id. It `ran` unless that result has `is_error: true`, when it
 * `failed` (refused, blocked or broken before it did anything). A `Bash`
 * result that starts `Exit code N` still `ran`, since the command ran and
 * only exited non-zero, unless N is 126 or 127, when the shell could not run
 * it. A call with no result yet, such as the last one in a live transcript,
 * is `pending`. Every use of one call shares that call's outcome, which
 * gives two known limits. In `cd x && herdr …` a failed `cd` still credits
 * herdr, since the line is split but the result cannot say which part
 * failed. And a CLI call, such as a herdr hand-back, reads `ran` when its
 * command exits 0 even if the tool it ran reported a false success.
 *
 * Subagents: Claude Code keeps them in `<session id>/subagents/*.jsonl`
 * beside the transcript. A session that entered another worktree writes
 * under that worktree's project folder, so a listed path can be stale. For a
 * path listed as `<projects root>/<folder>/<session id>.jsonl`, the root
 * being the one the context gauge reads, a transcript missing there is read
 * from the one other folder holding it (two or more: none is read), and
 * subagents are read from every folder's `<session id>/subagents/`. Only the
 * exact session id is matched, never a guessed one; a path outside that root
 * is read as listed. A Codex rollout names each child thread it started,
 * and `codex-uses.mjs` finds the child's rollout; a started child whose
 * rollout is not found is listed as a missing transcript.
 *
 * Context: each use carries its transcript's `context`, and `fresh` when that
 * is a fresh-context subagent, so a review can count only from someone who
 * did not write the change (`receipt-check.mjs`). The main session is never
 * fresh. A Claude Code subagent is fresh when its sidecar,
 * `agent-<id>.meta.json`, says neither `isFork: true` nor `agentType: "fork"`
 * (a real fork says both); a fork inherits its parent's context (the
 * subagent its `parentAgentId` names, else the main session). A Codex child
 * is fresh when its first `session_meta` names no `forked_from_id`; a fork
 * inherits the context of the thread that started it. So a fork of a fresh
 * reviewer is fresh and a fork of the author is not.
 * It fails closed: a subagent with no sidecar, or whose parent has none, a
 * Codex child with no `session_meta`, and forks naming each other are not
 * fresh. No Claude Code fork of a fork exists on this machine, so that test
 * fixture is synthetic and its shape unverified. A Claude Code fork's
 * transcript replays its parent's `Agent` call on its second line, under the
 * id its sidecar's `toolUseId` names; that call is the parent's and is
 * skipped.
 *
 * Plan: docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md,
 * U8 and KTD12; outcomes and context, MQ-377:
 * docs/plans/2026-10-04-0734-feat-receipt-check-credits-calls-that-ran-plan.md,
 * KTD1, KTD3 and KTD5.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { codexChildren, codexUses, ROLLOUT_NAME, timeOf } from "./codex-uses.mjs";
import { SHELL_COULD_NOT_RUN, shellUses } from "./shell-uses.mjs";

/** The type the Agent tool starts when a call names none. */
const DEFAULT_AGENT = "general-purpose";
/**
 * Text every record that matters here contains: a call, its result or
 * output, a command, an MCP call, a patch or a subagent's activity.
 */
const CALL_MARKER =
  /"tool_use"|"tool_result"|_call"|_output"|"CommandExecution"|"McpToolCall"|"FileChange"|"SubAgentActivity"/;
/** How a `Bash` result starts when its command exited non-zero; group 1 is the code. */
const EXIT_CODE = /^Exit code (\d+)/;

/** Where a use was found, as the receipt check names it (KTD3). */
const FRESH = "fresh subagent";
export const MAIN = "main session";
const FORK = "fork";
const NO_SIDECAR = "subagent with no sidecar";
const NO_META = "subagent with no session_meta";

/** One JSON line parsed, or nothing when it does not parse. */
function parsed(line) {
  try {
    return [JSON.parse(line)];
  } catch {
    return [];
  }
}

/**
 * Every JSON record in a transcript that can matter here, skipping a line
 * that does not parse, and its first record. Most lines (text, thinking,
 * token counts) cannot matter, so they are dropped before parsing: a long
 * transcript runs to tens of MB. The first record is kept apart: a Codex
 * rollout's own `session_meta` is its first line.
 */
function records(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  const recorded = lines.filter((line) => CALL_MARKER.test(line)).flatMap(parsed);
  return { recorded, first: parsed(lines[0])[0] ?? null };
}

/** A Claude Code subagent's sidecar, `agent-<id>.meta.json` beside its transcript, or null. */
function claudeSidecar(file) {
  const path = file.replace(/\.jsonl$/, ".meta.json");
  if (!existsSync(path)) return null;
  const [sidecar] = parsed(readFileSync(path, "utf8"));
  return sidecar && typeof sidecar === "object" ? sidecar : null;
}

/** Whether a sidecar marks a fork: `isFork: true` or `agentType: "fork"`, either one. */
function isFork(sidecar) {
  return sidecar.isFork === true || sidecar.agentType === "fork";
}

/**
 * A Claude Code subagent's context. Fresh unless its sidecar marks a fork,
 * as `isFork` reads it. A fork inherits its parent's: the subagent its `parentAgentId`
 * names, in the same flat folder, else the main session.
 * No sidecar, a parent with none, or forks naming each other: not fresh.
 * `sidecar` is the subagent's own, read by the caller; a parent's is read here.
 */
function claudeContext(file, sidecar, visited = new Set()) {
  if (!sidecar) return NO_SIDECAR;
  if (!isFork(sidecar)) return FRESH;
  visited.add(file);
  const parentId = sidecar.parentAgentId;
  if (typeof parentId !== "string") return FORK;
  const parent = join(dirname(file), `agent-${parentId}.jsonl`);
  if (visited.has(parent)) return FORK;
  return claudeContext(parent, claudeSidecar(parent), visited) === FRESH ? FRESH : FORK;
}

/**
 * A Codex child thread's context, from its first record, its own
 * `session_meta` (a fork's later ones are copies of its parent's). Fresh
 * unless it names `forked_from_id`; a fork inherits the context of the
 * thread that started it.
 */
function codexContext(first, starter) {
  if (first?.type !== "session_meta") return NO_META;
  if (!first.payload?.forked_from_id) return FRESH;
  return starter === FRESH ? FRESH : FORK;
}

/** What one Claude Code tool call shows was used. */
function claudeUses(call) {
  const input = call.input ?? {};
  const uses = [{ kind: "tool", name: call.name }];
  if (call.name === "Skill" && typeof input.skill === "string") {
    uses.push({ kind: "skill", name: input.skill });
  }
  if (call.name === "Agent" || call.name === "Task") {
    uses.push({ kind: "agent", name: input.subagent_type ?? DEFAULT_AGENT });
  }
  if (call.name === "Bash" && typeof input.command === "string") {
    uses.push(...shellUses(input.command));
  }
  return uses;
}

/** The tool calls in one Claude Code transcript record. */
function claudeToolCalls(record) {
  const content = record?.type === "assistant" ? record.message?.content : null;
  return Array.isArray(content) ? content.filter((block) => block?.type === "tool_use") : [];
}

/** Each Claude Code call's `tool_result` in one transcript file, by the call's id. */
function claudeResults(recorded) {
  const results = new Map();
  for (const record of recorded) {
    const content = record?.type === "user" ? record.message?.content : null;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type === "tool_result") results.set(block.tool_use_id, block);
    }
  }
  return results;
}

/** A `tool_result`'s text: its content is a string, or an array of text blocks. */
function resultText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block?.type === "text")
    .map((block) => String(block.text ?? ""))
    .join("\n");
}

/**
 * Whether one Claude Code call ran, from its `tool_result`: `pending` with no
 * result yet, `ran` without `is_error: true`, and `failed` with it, except a
 * `Bash` call whose result starts `Exit code N`: its command ran and exited
 * non-zero, so it `ran`, unless N is 126 or 127 (the shell could not run it).
 */
function claudeOutcome(call, result) {
  if (!result) return "pending";
  if (result.is_error !== true) return "ran";
  const exit = call.name === "Bash" ? EXIT_CODE.exec(resultText(result.content)) : null;
  return exit && !SHELL_COULD_NOT_RUN.has(Number(exit[1])) ? "ran" : "failed";
}

/** The folder Claude Code keeps a session's subagent transcripts in, beside its transcript. */
function subagentDir(path) {
  return join(path.replace(/\.jsonl$/, ""), "subagents");
}

/** The subagent transcripts in these folders, each folder's sorted by name. */
function claudeSubagents(dirs) {
  return dirs
    .filter((dir) => existsSync(dir))
    .flatMap((dir) =>
      readdirSync(dir)
        .filter((name) => name.endsWith(".jsonl"))
        .sort()
        .map((name) => join(dir, name)),
    );
}

/** Claude Code's projects root, resolved as the context gauge resolves it. */
function claudeProjects() {
  return join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "projects");
}

/**
 * Every project folder beside the one a session is listed in, when the
 * listed path is `<projects root>/<folder>/<session id>.jsonl`; else null.
 * Each folder keeps the listed path's own form, relative or absolute.
 */
function projectFolders(path, sessionId) {
  if (basename(path) !== `${sessionId}.jsonl`) return null;
  const root = dirname(dirname(path));
  if (resolve(root) !== resolve(claudeProjects()) || !existsSync(root)) return null;
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name))
    .sort();
}

/**
 * Where one listed session's files are: its transcript, the path it was
 * listed at when that differs, and the folders its subagents may be in; null
 * when no transcript is found. A transcript missing where listed is taken
 * from the one other project folder holding it; two or more such folders give
 * null, since the files cannot be told apart. Its subagents are read from
 * every project folder's `<session id>/subagents/`, its own first.
 */
function locate(path, sessionId) {
  const folders = projectFolders(path, sessionId);
  if (!folders) return existsSync(path) ? { path, subagentDirs: [subagentDir(path)] } : null;
  let found = path;
  if (!existsSync(path)) {
    const hits = folders.map((folder) => join(folder, `${sessionId}.jsonl`)).filter(existsSync);
    if (hits.length !== 1) return null;
    found = hits[0];
  }
  const own = subagentDir(found);
  const others = folders.map((folder) => join(folder, sessionId, "subagents"));
  return {
    path: found,
    ...(found !== path && { listed: path }),
    subagentDirs: [own, ...others.filter((dir) => dir !== own)],
  };
}

/**
 * Every use one transcript file records, each tagged with whether its call
 * ran, when (`at`, its record's `timestamp`, or null), where it was found,
 * and its transcript's context (`fresh` when that is a fresh-context subagent). A Claude Code call is paired with its result
 * in the same file, a Codex call with its outcome records (`codex-uses.mjs`).
 * A fork's replay of its parent's `Agent` call, the call its sidecar names,
 * is skipped: it is the parent's call, not the fork's (KTD5).
 */
function usesIn(recorded, where, context, replayed = null) {
  const tag = { where, context, fresh: context === FRESH };
  const results = claudeResults(recorded);
  const claude = recorded.flatMap((record) =>
    claudeToolCalls(record).flatMap((call) => {
      if (call.id === replayed) return [];
      const outcome = claudeOutcome(call, results.get(call.id));
      const at = timeOf(record);
      return claudeUses(call).map((use) => ({ ...use, outcome, at, ...tag }));
    }),
  );
  return claude.concat(codexUses(recorded).map((use) => ({ ...use, ...tag })));
}

/** A child transcript's name in a use's place: a Codex rollout by its thread id. */
function childName(path) {
  return basename(path, ".jsonl").replace(ROLLOUT_NAME, "$1");
}

/** Where a use in a subagent transcript was found: `<session id> subagent <name>`. */
function subagentPlace(sessionId, name) {
  return `${sessionId} subagent ${name}`;
}

/** Whether a place names a subagent, in the shape `subagentPlace` writes. */
export function isSubagentPlace(place) {
  return /^\S+ subagent \S/.test(place);
}

/**
 * The uses in one session's transcript and every subagent transcript under
 * it, and each Codex child thread started there whose rollout was not found.
 * Each child carries the context of the thread that started it, which a
 * Codex fork inherits; a Claude Code subagent's comes from its sidecar.
 */
function sessionUses({ path, subagentDirs }, sessionId) {
  const { recorded } = records(path);
  const parts = [usesIn(recorded, sessionId, MAIN)];
  const codex = codexChildren(path, recorded);
  const children = [
    ...claudeSubagents(subagentDirs).map((file) => ({ path: file, claude: true })),
    ...codex.found.map((file) => ({ path: file, starter: MAIN })),
  ];
  const missing = new Map(codex.missing.map((child) => [child.id, child]));
  const seen = new Set([path]);
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (seen.has(child.path)) continue;
    seen.add(child.path);
    const { recorded: childRecords, first } = records(child.path);
    const sidecar = child.claude ? claudeSidecar(child.path) : null;
    const context = child.claude
      ? claudeContext(child.path, sidecar)
      : codexContext(first, child.starter);
    const where = subagentPlace(sessionId, childName(child.path));
    parts.push(usesIn(childRecords, where, context, sidecar?.toolUseId ?? null));
    const grandchildren = codexChildren(child.path, childRecords);
    children.push(...grandchildren.found.map((file) => ({ path: file, starter: context })));
    for (const lost of grandchildren.missing) missing.set(lost.id, lost);
  }
  const uses = parts.flat().map((use) => ({ ...use, session: sessionId }));
  return { uses, subagents: seen.size - 1, missing: [...missing.values()] };
}

/**
 * Read every listed transcript `{ session_id, path }`: whether each was read
 * or is missing, how many subagent transcripts it had, and the uses found. A
 * Codex child thread a read rollout started, whose rollout is not found, is
 * listed after it as missing, under the child's thread id.
 */
export function readTranscripts(listed) {
  const transcripts = [];
  const parts = [];
  for (const { session_id: sessionId, path } of listed) {
    const at = locate(path, sessionId);
    if (!at) {
      transcripts.push({ session_id: sessionId, path, status: "missing", subagents: 0 });
      continue;
    }
    const session = sessionUses(at, sessionId);
    const moved = at.listed && { listed: at.listed };
    transcripts.push({
      session_id: sessionId,
      path: at.path,
      ...moved,
      status: "read",
      subagents: session.subagents,
    });
    for (const lost of session.missing) {
      transcripts.push({ session_id: lost.id, path: lost.path, status: "missing", subagents: 0 });
    }
    parts.push(session.uses);
  }
  return { transcripts, uses: parts.flat() };
}
