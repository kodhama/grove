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
 *   { thread: "<resolved transcript path>",
 *     place: "<session id> subagent agent-a1", session: "<session id>",
 *     context: "fresh subagent", fresh: true, model: "claude-opus-5-5",
 *     at: "2026-11-08T10:01:00.000Z", skill: "compound-engineering:ce-code-review",
 *     args: "base:<sha>", outcome: "ran",
 *     head: "<sha>", clean: true, base: "<sha>", baseNamed: true,
 *     read: { script: "<path>/review-read.mjs", checkout: "<dir>", from: "<commit>" },
 *     rollout: false }
 *
 * The read record is the last triple before the review call in the same
 * transcript file, by the order their results land in it; another file's
 * triple never counts, so a reviewer's record is its own. With none before
 * it, `head`, `clean`, `base`, `baseNamed` and `read` are null.
 * A fork starts with no triple and returns no copied review calls. Claude's
 * own records follow the replayed `Agent` call named by its sidecar's
 * `toolUseId`; a fork sidecar with no `toolUseId`, or one no replayed `Agent`
 * call matches, gives no records. A Codex fork keeps only records at or
 * above its first `session_meta.payload.subagent_history_start_ordinal`. A missing or invalid
 * start ordinal, or a record with no valid ordinal, gives no fork records.
 *
 * What counts as the read command, and as its output:
 * - the call's whole command line, trimmed, is one invocation: `node`, or an
 *   absolute path ending in `/node`, or neither; then a path, quoted or not,
 *   whose file name is `review-read.mjs`; then exactly `--checkout <dir>`
 *   and `--from <commit>`, once each, in either order, each value quoted or
 *   not. A line holding any of
 *   `;`, `&`, `|`, `<`, `>`, `(`, `)`, a backtick, `$`, a backslash or a line
 *   break is not it: chaining, a pipe, a redirection, a subshell or any
 *   substitution or expansion could change or fake what it prints. A `~`
 *   or a glob character (`*`, `?`, `[`, `{`) is let through, so a value is
 *   kept as typed, not as the shell expanded it. A hand-typed `printf` of
 *   the same three lines is another command, and is not it either;
 * - the script is recognised by its file name alone, since the install folder
 *   varies: any script so named is accepted here, wherever it sits and
 *   whatever it does. So the record carries the path as typed, with the
 *   `--checkout` and `--from` values, as `read: { script, checkout, from }`
 *   (unquoted; null with no triple), and the gate can require the installed
 *   one;
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
 * recorded base and no other commit id. A hex token is 7
 * or more hex characters, in any case, bounded by non-word characters. The
 * args must hold at least one, and the base must start with every one: the
 * full sha or a prefix of it, once or more. Any other hex token, a decoy or
 * a second commit, makes it false, since the reviewer may have diffed from
 * that one. A ref such as `origin/main` or `HEAD~2` is not a hex token, so
 * it is not seen: args that name the base and a ref still read true.
 *
 * Context is `transcript-uses.mjs`'s: the main session is never fresh, a
 * Claude Code subagent is fresh only from its sidecar, and a Codex child
 * rollout only when its first `session_meta` names no `forked_from_id`, or
 * when it does and the thread that started it is fresh.
 *
 * A rollout the caller names directly has no known starter, and no
 * `forked_from_id` alone does not make it fresh: an interactive session
 * names none either. It is fresh only as one `codex exec` run: its first
 * record is a `session_meta` whose `source` is the string `exec` (an
 * interactive one shows `vscode` or `cli`, a Codex subagent an object),
 * naming no `forked_from_id`, and the rollout holds exactly one `event_msg`
 * of type `task_started`. `codex exec resume` appends to the same file,
 * keeping its one `session_meta` and adding a `task_started`, so a second
 * one means the run went on with old context. Otherwise it is not fresh: no
 * `session_meta` reads `subagent with no session_meta` and a
 * `forked_from_id` reads `fork`, as for a child, and anything else reads
 * `named rollout not a single exec run`. Its place and session are its
 * thread id. A caller-named rollout reached through a listed transcript,
 * as its root or as a child, is skipped, keeping its listed context; one
 * that another caller-named rollout reaches as a child is read only in that
 * one's walk, keeping the context it has there, in whatever order the caller
 * names them; and one named twice is read once. So which records come back
 * does not depend on the order of `rollouts`. Records are de-duplicated by
 * resolved thread path, time, skill and args, then ordered by `Date.parse(at)`.
 * When duplicates disagree, the not-fresh one survives (fail closed), so two
 * named rollouts that reach each other give the same record in either order.
 * Equal times keep traversal order. Missing or unparseable times remain
 * visible after timed records, for the coverage check to reject as
 * `no time recorded`. A `tool_result` counts only in a `user` record.
 * Paths are compared resolved, through symbolic links.
 *
 * A listed transcript that is not found, a caller-named rollout that does
 * not exist, and a Codex child that was started but whose rollout is not
 * found are returned in `missing`, never skipped. The caller turns any
 * entry there into exit 2: a review it cannot read is not a review it can
 * judge.
 *
 * Plan: docs/plans/2026-11-08-kod-44-merge-gate-plan.md, U1 and KTD3;
 * docs/plans/2026-11-19-kod-44-u4b-s4-plan.md, KTD6 (the rollout tag).
 */
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
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
/** The context of a caller-named rollout that is not one `codex exec` run with a `session_meta`. */
const NOT_ONE_EXEC = "named rollout not a single exec run";
/** A rollout line that may record a turn's start; `records` drops such lines, so they are read apart. */
const TASK_STARTED = /"task_started"/;
/** A hex token in a review's arguments that may name a commit. */
const HEX_TOKEN = /\b[0-9a-f]{7,}\b/gi;

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

/**
 * The read command's arguments when a whole shell line is that command, alone
 * and in its fixed form: `{ script, checkout, from }`, each unquoted; else null.
 */
export function readCommandArgs(line) {
  if (typeof line !== "string") return null;
  const trimmed = line.trim();
  if (trimmed === "" || NOT_ONE_COMMAND.test(trimmed)) return null;
  const all = words(trimmed);
  if (!all) return null;
  const start = isNode(all[0]) ? 1 : 0;
  const script = all[start];
  if (typeof script !== "string" || script.split("/").pop() !== READ_SCRIPT) return null;
  const flags = all.slice(start + 1);
  if (flags.length !== READ_FLAGS.length * 2) return null;
  const values = new Map();
  for (let i = 0; i < flags.length; i += 2) {
    const [flag, value] = [flags[i], flags[i + 1]];
    if (!READ_FLAGS.includes(flag) || values.has(flag) || !value) return null;
    values.set(flag, value);
  }
  return { script, checkout: values.get("--checkout"), from: values.get("--from") };
}

/** Whether a whole shell line is the read command, alone and in its fixed form. */
export function isReadCommand(line) {
  return readCommandArgs(line) !== null;
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
 * Whether a review's arguments name a base and no other commit: they hold at
 * least one word-bounded hex token of at least seven characters, and the base starts
 * with every such token. Null with no base.
 */
export function namesBase(args, base) {
  if (typeof base !== "string") return null;
  if (typeof args !== "string") return false;
  const tokens = args.match(HEX_TOKEN) ?? [];
  return tokens.length > 0 && tokens.every((token) => base.startsWith(token.toLowerCase()));
}

/** A skill's name after its plugin prefix: `compound-engineering:ce-code-review` gives `ce-code-review`. */
function unqualified(name) {
  return name.slice(name.lastIndexOf(":") + 1);
}

/** One review call's record, carrying the triple before it and the read command that gave it, or none. */
function reviewRecord(call, triple) {
  return {
    ...call,
    head: triple?.head ?? null,
    clean: triple ? triple.status === 0 : null,
    base: triple?.base ?? null,
    baseNamed: namesBase(call.args, triple?.base ?? null),
    read: triple?.read ?? null,
  };
}

/** Only a thread's own records: copied fork history supplies neither calls nor reads. */
function ownRecords({ recorded, first }, sidecar = null) {
  if (sidecar?.isFork === true || sidecar?.agentType === "fork") {
    if (typeof sidecar.toolUseId !== "string") return [];
    const point = recorded.findIndex((record) => claudeToolCalls(record)
      .some((call) => call.name === "Agent" && call.id === sidecar.toolUseId));
    return point < 0 ? [] : recorded.slice(point + 1);
  }
  if (first?.type !== "session_meta" || first.payload?.forked_from_id == null) return recorded;
  const start = first.payload.subagent_history_start_ordinal;
  if (!Number.isInteger(start) || start < 0 || recorded.some((record) => !Number.isInteger(record.ordinal) || record.ordinal < 0)) return [];
  return recorded.filter((record) => record.ordinal >= start);
}

/**
 * The review calls in one transcript file, in order, each with the last
 * triple before it. A Claude Code call is paired with its result in the same
 * file. The caller has already removed any copied fork history.
 */
function reviewsIn(recorded) {
  const results = claudeResults(recorded);
  const reviews = [];
  let triple = null;
  const pending = new Map();
  for (const record of recorded) {
    const at = timeOf(record);
    for (const call of claudeToolCalls(record)) {
      const input = call.input ?? {};
      const args = call.name === "Bash" ? readCommandArgs(input.command) : null;
      if (args) pending.set(call.id, { call, args });
      if (call.name === "Skill" && typeof input.skill === "string") {
        const model = record.message?.model;
        const review = {
          skill: input.skill,
          args: typeof input.args === "string" ? input.args : null,
          model: typeof model === "string" ? model : null,
          at,
          outcome: claudeOutcome(call, results.get(call.id)),
        };
        reviews.push(reviewRecord(review, triple));
      }
    }
    for (const result of record.type === "user" && Array.isArray(record.message?.content) ? record.message.content : []) {
      if (result?.type !== "tool_result") continue;
      const found = pending.get(result.tool_use_id);
      if (!found) continue;
      pending.delete(result.tool_use_id);
      const read = result.is_error !== true && claudeOutcome(found.call, result) === "ran"
        ? readTriple(resultText(result.content)) : null;
      if (read) triple = { ...read, read: found.args };
    }
    const item = codexItem(record);
    if (item?.type !== "CommandExecution") continue;
    const args = item.status === "completed" ? readCommandArgs(codexShellLine(item.command)) : null;
    if (args) {
      const read = readTriple(commandOutput(item));
      if (read) triple = { ...read, read: args };
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
 * once per thread id, as `sessionUses` keeps them, and every transcript
 * path it read (`reached`). `rootContext` is the root's context; `read` is
 * the root's records when the caller has already read them; a child whose
 * resolved path is in `skip`, already reached by an earlier walk, is not
 * read again.
 */
function walk({ path, subagentDirs }, sessionId, place, rootContext, read = records(path), skip = new Set()) {
  const recorded = ownRecords(read);
  /** One transcript's resolved identity and review context. */
  const tag = (file, where, ctx) => ({ thread: realPath(file), place: where, session: sessionId, context: ctx, fresh: ctx === FRESH });
  const rootTag = tag(path, place, rootContext);
  const parts = [reviewsIn(recorded).map((review) => ({ ...rootTag, ...review }))];
  const codex = codexChildren(path, recorded);
  const children = [
    ...claudeSubagents(subagentDirs).map((file) => ({ path: file, claude: true })),
    ...codex.found.map((file) => ({ path: file, starter: rootContext })),
  ];
  const missing = new Map(codex.missing.map((child) => [child.id, { session_id: child.id, path: child.path }]));
  const seen = new Set([path]);
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (seen.has(child.path) || skip.has(realPath(child.path))) continue;
    seen.add(child.path);
    const childRead = records(child.path);
    const sidecar = child.claude ? claudeSidecar(child.path) : null;
    const childRecords = ownRecords(childRead, sidecar);
    const childContext = child.claude
      ? claudeContext(child.path, sidecar)
      : codexContext(childRead.first, child.starter);
    const where = subagentPlace(sessionId, childName(child.path));
    const found = reviewsIn(childRecords);
    const childTag = tag(child.path, where, childContext);
    parts.push(found.map((review) => ({ ...childTag, ...review })));
    const grandchildren = codexChildren(child.path, childRecords);
    children.push(...grandchildren.found.map((file) => ({ path: file, starter: childContext })));
    for (const lost of grandchildren.missing) missing.set(lost.id, { session_id: lost.id, path: lost.path });
  }
  return { reviews: parts.flat(), missing: [...missing.values()], reached: [...seen] };
}

/** A path resolved through symbolic links when it exists, else only made absolute. */
function realPath(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

/** How many `event_msg` records of type `task_started` a rollout holds, read from its raw lines. */
function taskStarts(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => TASK_STARTED.test(line))
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    })
    .filter((record) => record?.type === "event_msg" && record.payload?.type === "task_started").length;
}

/**
 * A caller-named rollout's context: fresh only as one `codex exec` run, its
 * `session_meta` from `exec` with no `forked_from_id` and one `task_started`.
 */
function namedContext(path, first) {
  const context = codexContext(first, null);
  if (context !== FRESH) return context;
  return first.payload?.source === "exec" && taskStarts(path) === 1 ? FRESH : NOT_ONE_EXEC;
}

/** Parsed review time for ordering; unknown times remain visible, after timed calls. */
function reviewTime(review) {
  const time = Date.parse(review.at);
  return Number.isFinite(time) ? time : Infinity;
}

/**
 * Which of two duplicate records survives, whatever order they came in: a
 * not-fresh one beats a fresh one (fail closed), and otherwise the one whose
 * JSON sorts first.
 */
export function survivor(kept, other) {
  if (kept.fresh !== other.fresh) return kept.fresh ? other : kept;
  return JSON.stringify(other) < JSON.stringify(kept) ? other : kept;
}

/** The identity two review records share when they are the same call: thread, time, skill and args. */
export function reviewKey(review) {
  return JSON.stringify([review.thread, review.at, review.skill, review.args]);
}

/** One record per thread, time, skill and args, ordered by parsed time with stable ties. */
function uniqueReviews(reviews) {
  const byKey = new Map();
  for (const review of reviews) {
    const key = reviewKey(review);
    byKey.set(key, byKey.has(key) ? survivor(byKey.get(key), review) : review);
  }
  return [...byKey.values()].sort((a, b) => reviewTime(a) - reviewTime(b));
}

/**
 * A caller-named rollout's own thread and every Codex thread under it, by
 * resolved path, from each thread's own child records, whatever walk reads
 * them (KTD6), and the thread ids of the children under it not found
 * (`lost`); none when it does not exist. `aliases` maps a resolved path to
 * the paths a walk reached it by.
 */
function threadsUnder(path, aliases) {
  const threads = [];
  const lost = [];
  for (const queue = [path]; queue.length > 0;) {
    const file = queue.shift();
    const real = realPath(file);
    if (threads.includes(real)) continue;
    let read;
    try {
      read = records(file);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      continue;
    }
    threads.push(real);
    const own = ownRecords(read);
    // Children sit beside the given path, the real path, or any link a walk came by.
    for (const beside of new Set([file, real, ...(aliases.get(real) ?? [])])) {
      const children = codexChildren(beside, own);
      queue.push(...children.found);
      lost.push(...children.missing.map((child) => child.id));
    }
  }
  return { threads, lost };
}

/**
 * The review records every listed transcript `{ session_id, path }` reaches,
 * and those of each Codex rollout path in `rollouts`, read as its own
 * reviewer unless a listed transcript or another named rollout reaches it.
 * `skills`, when given, keeps only the review calls it names.
 * Returns `{ reviews, missing }`; the caller exits 2 when `missing` is not
 * empty. A missing caller-named rollout has `session_id` null. Each record
 * carries `rollout`: whether its thread is a caller-named rollout or any
 * thread under one, however it was reached; each missing entry carries it
 * too, true for a missing caller-named rollout, and for a listed transcript
 * not found while a named rollout lost a thread, since what it is under
 * cannot be read (fail closed).
 */
export function readReviewReads(listed, { skills = null, rollouts = [] } = {}) {
  const reviews = [];
  const missing = [];
  const aliases = new Map();
  const unread = new Set();
  const alias = (file) => aliases.set(realPath(file), [...(aliases.get(realPath(file)) ?? []), file]);
  for (const { session_id: sessionId, path } of listed) {
    const at = locate(path, sessionId);
    if (!at) {
      missing.push({ session_id: sessionId, path });
      unread.add(sessionId);
      continue;
    }
    const found = walk(at, sessionId, sessionId, MAIN);
    reviews.push(...found.reviews);
    missing.push(...found.missing);
    for (const file of found.reached) alias(file);
  }
  const reached = new Set(aliases.keys());
  const named = [];
  for (const path of rollouts) {
    const real = realPath(path);
    if (reached.has(real) || named.some((walked) => walked.real === real)) continue;
    let read;
    try {
      read = records(path);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      missing.push({ session_id: null, path });
      continue;
    }
    const id = typeof read.first?.payload?.id === "string" ? read.first.payload.id : childName(path);
    const found = walk({ path, subagentDirs: [] }, id, id, namedContext(path, read.first), read, reached);
    named.push({ real, found, within: new Set(found.reached.map(realPath)) });
    for (const file of found.reached) alias(file);
  }
  // A named rollout another named one reaches is read in that one's walk, whatever the order.
  const under = (inner, outer) => outer !== inner && outer.within.has(inner.real) && !inner.within.has(outer.real);
  for (const walked of named) {
    if (named.some((other) => under(walked, other))) continue;
    reviews.push(...walked.found.reviews);
    missing.push(...walked.found.missing);
  }
  const unique = uniqueReviews(reviews);
  const wanted = skills && new Set(skills.map(unqualified));
  const kept = wanted ? unique.filter((review) => wanted.has(unqualified(review.skill))) : unique;
  const descent = rollouts.map((path) => threadsUnder(path, aliases));
  const tagged = new Set(descent.flatMap((found) => found.threads));
  const lost = new Set(descent.flatMap((found) => found.lost));
  return { reviews: kept.map((review) => ({ ...review, rollout: tagged.has(review.thread) })),
    missing: missing.map((entry) => ({ ...entry,
      rollout: entry.session_id === null || lost.has(entry.session_id) || (unread.has(entry.session_id) && lost.size > 0) })) };
}
