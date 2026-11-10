/**
 * KOD-44 — read what each review read: for every review performer call a
 * set of transcripts holds, the read record before it (KTD3).
 *
 * In plain words: a reviewer runs the fixed read command,
 * `review-read.mjs --checkout <dir> --from <commit>`, which prints
 * `head <sha>`, `status <n>` and `base <sha>`, and then calls the review
 * performer, naming that base. This file walks the listed sessions'
 * transcripts, the subagent transcripts beside them and the Codex child
 * rollouts they started, as `transcript-uses.mjs` does, plus any Codex
 * rollout the caller names by path. For each review call it returns one
 * record:
 *
 *   { place: "<session id> subagent agent-a1", session: "<session id>",
 *     context: "fresh subagent", fresh: true, model: "claude-opus-5-5",
 *     at: "2026-11-08T10:01:00.000Z", skill: "compound-engineering:ce-code-review",
 *     args: "base:<sha>", outcome: "ran",
 *     head: "<sha>", clean: true, base: "<sha>", baseNamed: true }
 *
 * The read record is the last triple before the review call in the same
 * transcript file, by the order the calls appear in it; another file's
 * triple never counts, so a reviewer's record is its own. With none before
 * it, `head`, `clean`, `base` and `baseNamed` are null.
 *
 * What counts as the read command, and as its output:
 * - the call's whole command line, trimmed, is one invocation: `node`, or an
 *   absolute path ending in `/node`, or neither; then a path, quoted or not,
 *   whose file name is `review-read.mjs` (by name, since the install folder
 *   varies); then exactly `--checkout <dir>` and `--from <commit>`, once
 *   each, in either order, each value quoted or not. A line holding any of
 *   `;`, `&`, `|`, `<`, `>`, `(`, `)`, a backtick, `$`, a backslash or a line
 *   break is not it: chaining, a pipe, a redirection, a subshell or any
 *   substitution or expansion could change or fake what it prints. So a
 *   value must be literal. A hand-typed `printf` of the same three lines is
 *   another command, and is not it either;
 * - on Claude Code, a `Bash` call whose result is not an error
 *   (`is_error: true`, which a non-zero exit sets) and whose outcome is `ran`
 *   (`claudeOutcome`); on Codex, a `CommandExecution` whose shell line is
 *   the command and whose status is `completed`, its text `stdout` then
 *   `stderr` (`commandOutput`);
 * - its values come only from the result's labelled lines,
 *   `head <40 hex>`, `status <digits>` and `base <40 hex>`, each exactly
 *   once. A result that lacks one, or repeats one, gives no triple. A failed
 *   read gives none and leaves the last good one standing.
 *
 * A review call:
 * - on Claude Code, a `Skill` call: its `skill` name and its `args` string
 *   (null when it has none); `model` is the `message.model` of the assistant
 *   record holding it, or null; `outcome` is the call's own (`claudeOutcome`);
 * - on Codex, a skill use as `codex-uses.mjs` reads one: a command that
 *   reads `<skill>/SKILL.md`, with that read's outcome. A Codex skill takes
 *   no arguments, so `args` is null and `baseNamed` false; `model` is null,
 *   since its rollout's turn records are not read here;
 * - with `skills` given, only calls whose name after its last `:` matches
 *   one of theirs after its last `:`; with none, every skill call.
 *
 * `clean` is `status` 0. `baseNamed` says whether the call's `args` name the
 * recorded base: as the full 40-character sha, or as a token of 7 or more
 * hex characters, bounded by non-word characters, that the base starts with,
 * in any case. A token naming another commit does not stop a match: the
 * gate checks the base, not every commit the arguments name.
 *
 * Context is `transcript-uses.mjs`'s: the main session is never fresh, a
 * Claude Code subagent is fresh only from its sidecar, and a Codex rollout
 * only when its first `session_meta` names no `forked_from_id`. A rollout
 * the caller names directly has no known starter, so one with a
 * `forked_from_id` is a fork; its place and session are its thread id.
 *
 * A listed transcript that is not found, a caller-named rollout that does
 * not exist, and a Codex child that was started but whose rollout is not
 * found are returned in `missing`, never skipped. The caller turns any
 * entry there into exit 2: a review it cannot read is not a review it can
 * judge.
 *
 * Plan: docs/plans/2026-11-08-kod-44-merge-gate-plan.md, U1 and KTD3.
 */
import { codexChildren, codexItem, codexShellLine, commandOutput, commandUses, timeOf } from "./codex-uses.mjs";
import {
  childName,
  claudeContext,
  claudeOutcome,
  claudeResults,
  claudeSidecar,
  claudeSubagents,
  claudeToolCalls,
  codexContext,
  FRESH,
  locate,
  MAIN,
  records,
  resultText,
  subagentPlace,
} from "./transcript-uses.mjs";

/** The read command's file name, matched whatever folder it is installed in. */
const READ_SCRIPT = "review-read.mjs";
/** Anything that chains, pipes, redirects, groups or substitutes in a shell line. */
const NOT_ONE_COMMAND = /[;&|<>()`$\\\n\r]/;
/** The flags the read command takes, each once. */
const READ_FLAGS = ["--checkout", "--from"];
/** A full commit id, as the read command prints it. */
const SHA = "[0-9a-f]{40}";
const LABELS = {
  head: new RegExp(`^head (${SHA})$`),
  status: /^status (\d+)$/,
  base: new RegExp(`^base (${SHA})$`),
};
/** A hex token in a review's arguments that may name a commit. */
const HEX_TOKEN = /\b[0-9a-f]{7,40}\b/gi;

/**
 * A shell line's words, unquoted: blanks separate them, and single or double
 * quotes hold blanks. Null when a quote is not closed. Only called on a line
 * with no `$`, backtick or backslash, so double quotes are literal too.
 */
function words(line) {
  const found = [];
  let word = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === " " || char === "\t") {
      if (word !== null) found.push(word);
      word = null;
    } else if (char === "'" || char === '"') {
      const end = line.indexOf(char, i + 1);
      if (end === -1) return null;
      word = (word ?? "") + line.slice(i + 1, end);
      i = end;
    } else {
      word = (word ?? "") + char;
    }
  }
  if (word !== null) found.push(word);
  return found;
}

/** Whether a word names the node binary: `node`, or an absolute path ending in `/node`. */
function isNode(word) {
  return word === "node" || (word.startsWith("/") && word.endsWith("/node"));
}

/** Whether a whole shell line is the read command, alone and in its fixed form. */
export function isReadCommand(line) {
  if (typeof line !== "string") return false;
  const trimmed = line.trim();
  if (trimmed === "" || NOT_ONE_COMMAND.test(trimmed)) return false;
  const all = words(trimmed);
  if (!all) return false;
  const start = isNode(all[0]) ? 1 : 0;
  const script = all[start];
  if (typeof script !== "string" || script.split("/").pop() !== READ_SCRIPT) return false;
  const flags = all.slice(start + 1);
  if (flags.length !== READ_FLAGS.length * 2) return false;
  const seen = new Set();
  for (let i = 0; i < flags.length; i += 2) {
    const [flag, value] = [flags[i], flags[i + 1]];
    if (!READ_FLAGS.includes(flag) || seen.has(flag) || !value) return false;
    seen.add(flag);
  }
  return true;
}

/** The triple a read command's output gives, from its labelled lines, each exactly once; else null. */
export function readTriple(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const values = {};
  for (const [label, pattern] of Object.entries(LABELS)) {
    const hits = lines.flatMap((line) => pattern.exec(line)?.slice(1, 2) ?? []);
    if (hits.length !== 1) return null;
    values[label] = hits[0];
  }
  return { head: values.head, status: Number(values.status), base: values.base };
}

/**
 * Whether a review's arguments name a base: its full sha, or a word-bounded
 * hex token of 7 or more characters that it starts with. Null with no base.
 */
export function namesBase(args, base) {
  if (typeof base !== "string") return null;
  if (typeof args !== "string") return false;
  return (args.match(HEX_TOKEN) ?? []).some((token) => base.startsWith(token.toLowerCase()));
}

/** A skill's name after its plugin prefix: `compound-engineering:ce-code-review` gives `ce-code-review`. */
function unqualified(name) {
  return name.slice(name.lastIndexOf(":") + 1);
}

/** One review call's record, carrying the triple before it, or none. */
function reviewRecord(call, triple) {
  return {
    ...call,
    head: triple?.head ?? null,
    clean: triple ? triple.status === 0 : null,
    base: triple?.base ?? null,
    baseNamed: namesBase(call.args, triple?.base ?? null),
  };
}

/**
 * The review calls in one transcript file, in order, each with the last
 * triple before it. A Claude Code call is paired with its result in the same
 * file; a fork's replay of its parent's `Agent` call (`replayed`) is skipped.
 */
function reviewsIn(recorded, replayed) {
  const results = claudeResults(recorded);
  const reviews = [];
  let triple = null;
  for (const record of recorded) {
    const at = timeOf(record);
    for (const call of claudeToolCalls(record)) {
      if (call.id === replayed) continue;
      const input = call.input ?? {};
      const result = results.get(call.id);
      if (call.name === "Bash" && isReadCommand(input.command) && result && result.is_error !== true) {
        const read = claudeOutcome(call, result) === "ran" ? readTriple(resultText(result.content)) : null;
        if (read) triple = read;
      }
      if (call.name === "Skill" && typeof input.skill === "string") {
        const model = record.message?.model;
        const review = {
          skill: input.skill,
          args: typeof input.args === "string" ? input.args : null,
          model: typeof model === "string" ? model : null,
          at,
          outcome: claudeOutcome(call, result),
        };
        reviews.push(reviewRecord(review, triple));
      }
    }
    const item = codexItem(record);
    if (item?.type !== "CommandExecution") continue;
    if (item.status === "completed" && isReadCommand(codexShellLine(item.command))) {
      const read = readTriple(commandOutput(item));
      if (read) triple = read;
    }
    for (const use of commandUses(item).filter((found) => found.kind === "skill")) {
      const review = { skill: use.name, args: null, model: null, at, outcome: use.outcome };
      reviews.push(reviewRecord(review, triple));
    }
  }
  return reviews;
}

/**
 * The review records in one root transcript and every transcript under it:
 * its Claude Code subagents and the Codex child rollouts any of them
 * started, each child with the context of the thread that started it.
 * Returns the records and each started child whose rollout was not found,
 * once per thread id, as `sessionUses` keeps them. `read` is the root's
 * records when the caller has already read them.
 */
function walk({ path, subagentDirs }, sessionId, place, context, read = records(path)) {
  const { recorded, first } = read;
  const rootContext = context ?? codexContext(first, null);
  const tag = (where, ctx) => ({ place: where, session: sessionId, context: ctx, fresh: ctx === FRESH });
  const parts = [reviewsIn(recorded, null).map((review) => ({ ...tag(place, rootContext), ...review }))];
  const codex = codexChildren(path, recorded);
  const children = [
    ...claudeSubagents(subagentDirs).map((file) => ({ path: file, claude: true })),
    ...codex.found.map((file) => ({ path: file, starter: rootContext })),
  ];
  const missing = new Map(codex.missing.map((child) => [child.id, { session_id: child.id, path: child.path }]));
  const seen = new Set([path]);
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (seen.has(child.path)) continue;
    seen.add(child.path);
    const { recorded: childRecords, first: childFirst } = records(child.path);
    const sidecar = child.claude ? claudeSidecar(child.path) : null;
    const childContext = child.claude
      ? claudeContext(child.path, sidecar)
      : codexContext(childFirst, child.starter);
    const where = subagentPlace(sessionId, childName(child.path));
    const found = reviewsIn(childRecords, sidecar?.toolUseId ?? null);
    parts.push(found.map((review) => ({ ...tag(where, childContext), ...review })));
    const grandchildren = codexChildren(child.path, childRecords);
    children.push(...grandchildren.found.map((file) => ({ path: file, starter: childContext })));
    for (const lost of grandchildren.missing) missing.set(lost.id, { session_id: lost.id, path: lost.path });
  }
  return { reviews: parts.flat(), missing: [...missing.values()] };
}

/**
 * The review records every listed transcript `{ session_id, path }` reaches,
 * and those of each Codex rollout path in `rollouts`, read as its own
 * reviewer. `skills`, when given, keeps only the review calls it names.
 * Returns `{ reviews, missing }`; the caller exits 2 when `missing` is not
 * empty. A missing caller-named rollout has `session_id` null.
 */
export function readReviewReads(listed, { skills = null, rollouts = [] } = {}) {
  const reviews = [];
  const missing = [];
  for (const { session_id: sessionId, path } of listed) {
    const at = locate(path, sessionId);
    if (!at) {
      missing.push({ session_id: sessionId, path });
      continue;
    }
    const found = walk(at, sessionId, sessionId, MAIN);
    reviews.push(...found.reviews);
    missing.push(...found.missing);
  }
  for (const path of rollouts) {
    let read;
    try {
      read = records(path);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      missing.push({ session_id: null, path });
      continue;
    }
    const id = typeof read.first?.payload?.id === "string" ? read.first.payload.id : childName(path);
    const found = walk({ path, subagentDirs: [] }, id, id, null, read);
    reviews.push(...found.reviews);
    missing.push(...found.missing);
  }
  if (!skills) return { reviews, missing };
  const wanted = new Set(skills.map(unqualified));
  return { reviews: reviews.filter((review) => wanted.has(unqualified(review.skill))), missing };
}
