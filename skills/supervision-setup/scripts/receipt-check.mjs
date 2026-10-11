/**
 * MQ-353 — check from a session's transcripts that each bound performer was
 * actually used, rather than taking the worker's word for it.
 *
 * In plain words: setup writes a bindings file saying which skill, tool,
 * agent or command performs each step of a story. This script reads every
 * transcript that file lists, and each one's subagent transcripts, and
 * prints one line per operation:
 *
 *   story-worker/build: used compound-engineering:ce-work in <session id>
 *   story-worker/review: bound-but-unused code-review
 *
 * What counts as a use of each kind of performer (skill, CLI, agent, tool),
 * and where subagent transcripts are found, is in `transcript-uses.mjs`, and
 * for a Codex rollout in `codex-uses.mjs`.
 *
 * Review: an operation the level skill's routing table marks
 * `fresh_context = true` (story-worker's `review` and `review-escalation`,
 * project-lead's `review-before-merge`) counts only a call that ran inside a
 * fresh-context subagent: never one in the author's own session, and never
 * one in a fork of the author's context (`transcript-uses.mjs` says which
 * transcripts are fresh). When its performer was called only outside one,
 * its line says where: the main session, a fork, or a subagent with no
 * sidecar; when a call of it in one is still pending, the line says how many
 * instead. A use carried from a handoff counts for it only when the carried
 * line's place names a subagent, since the check writes a marked use only
 * from a fresh one. The marks come from the table itself
 * (`routing-table.mjs`), not the bindings file; the report's header lists
 * them, and says when the table's sha256, or the repo override's, differs
 * from the one setup recorded.
 *
 * Each call is a use that `ran`, `failed` (refused, or the shell could not
 * run it) or is `pending` (no result yet). An allowed call is one in any
 * transcript, or for a marked operation, one in a fresh-context subagent.
 * The first state that applies decides an operation:
 * - `by fallback` / `unavailable`: no performer to find;
 * - `used`: an allowed call of its performer ran, in a transcript or one of
 *   its subagent transcripts;
 * - `used` carried: a handoff's receipt-check section, from before a restart
 *   onto another machine, reports it used (`handoff-receipt.mjs`), in a check
 *   run with this run's `--since`, or with none when this run has none;
 * - `not reached`: declared with `--not-run`, noting how many allowed calls
 *   of its performer failed, since a performer several operations share may
 *   have failed at another one's step;
 * - `attempted-failed`: its allowed calls all failed, noting any still
 *   pending, and no listed transcript is missing;
 * - `no evidence`: a listed transcript, or the rollout of a Codex child
 *   thread one started, is missing, so unused cannot be told from unread;
 * - `bound-but-unused`: otherwise.
 * The last two carry the marked operation's note above. `operation-state.mjs`
 * applies these rules.
 * It also lists skills whose call ran, among the calls counted (below), that
 * no binding names (used-but-unbound), except the level skill and
 * `supervision-setup`, which produced the bindings.
 *
 * Which calls count (`call-scope.mjs`): a session's calls count from the
 * first call in its main transcript that loaded the level skill, its
 * subagents' included, and its transcript line names that time; a session
 * where no such call is found keeps every call, and its line says so. A
 * level skill a person started with a slash command leaves no such call. A
 * session that resumed from a handoff, any listed after the first, counts
 * from its last load of the restart skill before that, so its resume steps
 * count.
 * With `--since <zoned time>`, calls before that time do not count either, in
 * any session, and the report's header says so: a worker passes its story's
 * start, so a session that worked an earlier story credits none of its
 * calls. A call or a load with no recorded time is never cut.
 *
 * Shared performers: where the call that credits an operation also matches
 * another operation's binding, as one herdr call matches session-restart's
 * four herdr operations, or one fresh review run matches both `review` and
 * `review-escalation` where they bind one skill, as on Codex, the line reads
 * `used (shared)` and names the others, since the check cannot tell which
 * operation the call was for. It passes, and the summary counts it apart.
 *
 * Its limits. It proves a performer was used at least once in the counted
 * calls, not at the step that should have used it: setup's own probes can
 * count too (it runs the context gauge once, and starts its check as a
 * general-purpose agent), where setup runs after the level skill loads or,
 * in a resumed session, among the resume steps, unless a `--since` set at a
 * story's start, after setup, cuts them. A use carried
 * from a handoff has no time, so neither cut applies to it; a handoff whose
 * check ran with another `--since`, as for an earlier story, or with one
 * where this run has none, or none where it has one, carries none. It reads only the
 * sessions the bindings file lists, with their subagent transcripts, so work
 * done in a sibling session is not seen; that is why story-worker runs its
 * review in a subagent. A handoff carries only `used` lines, so after a restart onto
 * another machine an `attempted-failed` operation reads `bound-but-unused`,
 * which fails the same way. And a handoff written by the check before MQ-377
 * may carry a `used` line for a call that never ran, and a review line
 * placed in any subagent, a fork included, still carries as fresh; one placed
 * in the main session, or carried before and so placed by its session alone,
 * no longer carries. Only a session spanning that change is affected. So
 * too for GRO-15: a check from before it, run with one story's `--since`,
 * re-prints an earlier story's carried uses under that story's `since` line,
 * and a handoff holding them still credits them.
 *
 * The pull request's body (GRO-21): with `--pr-body <file>`, the check also
 * reads the lines a story's pull request must carry in its body, a `Capture:`
 * line and a `Docs:` line, from the file the caller saved the body to
 * (`pr-body-lines.mjs` has the lines and the forms each takes). It prints one
 * line for each, after the operations and before the summary:
 *
 *   pr-body <file>: found "Capture: skipped: the tests already show the lesson"
 *   pr-body <file>: missing "Docs:": no line starts with it; it takes "Docs: updated <paths>" or "Docs: none needed, because <why>"
 *
 * or `malformed`, quoting the line and naming the forms it accepts, or
 * `repeated`, with how many lines start with the label. Anything but `found`
 * fails the check. Every such line starts with the word `pr-body`, so a
 * handoff that carries the report never reads one as a use, whatever text of
 * the body it quotes. The line prints the file's path as it was given, so a
 * path that holds a line break is refused: what follows the break would start
 * a line of its own. Without the flag nothing about the body is checked and
 * the verdict is what it would be: a story-worker report then says
 * `pr-body: not checked (no --pr-body given)`, and another level skill's,
 * which has no pull request, says nothing. A blocked hand-back and a
 * restart's handoff leave the flag out. The check proves the file it was
 * given, not the pull request, and a line inside a fenced block counts as a
 * line.
 *
 * Usage: receipt-check.mjs --bindings <bindings.json> [--not-run <table/op>,...]
 * [--handoff <handoff.md>] [--since <zoned time>] [--pr-body <body.md>]. Exits
 * 1 when any operation is bound-but-unused, attempted-failed or has no
 * evidence, when the routing table or the repo's override changed since setup
 * read it (the bindings then follow other suggestions), or when the body
 * given as `--pr-body` holds a required line missing, malformed or repeated,
 * 2 on bad arguments (a `--since` that is not a time with its zone, such as
 * `2026-10-08T21:16:31Z`, and a `--pr-body` path that holds a line break,
 * included) or unusable input (a bindings file setup
 * did not complete, one listing no transcripts, one recording no sha256 for
 * its table or its override, or a malformed entry, a transcript or a handoff
 * that is not a file, a `--pr-body` path, the empty one included, that is not
 * a file it can read, a routing table that cannot be read or belongs to
 * another skill), else 0. Unusable input is refused before any transcript is
 * read, so a body file that is missing exits 2 even where an operation is
 * unused. It reads files only.
 *
 * Plan: docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md,
 * U8 and KTD12; outcomes and fresh-context review, MQ-377:
 * docs/plans/2026-10-04-0734-feat-receipt-check-credits-calls-that-ran-plan.md,
 * KTD4, KTD6, KTD9, KTD10, U3 and U4; the pull request's body, GRO-21:
 * docs/plans/2026-10-11-gro-21-required-capture-line-plan.md, KTD3, KTD4,
 * KTD8 and U2.
 */
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { scopeCalls, sinceTime } from "./call-scope.mjs";
import { CARRIED, readHandoff } from "./handoff-receipt.mjs";
import { creditable, hasPerformer, judge, matches, unqualified } from "./operation-state.mjs";
import { readBodyLines } from "./pr-body-lines.mjs";
import { readRoutingTable } from "./routing-table.mjs";
import { readTranscripts } from "./transcript-uses.mjs";

/** Skills that run the supervision itself, never a step of it. */
const SETUP_SKILL = "supervision-setup";
/** The level skill whose hand-back has a pull request: only its report says when the body was not checked. */
const STORY_SKILL = "story-worker";
/** The states that fail the check: exit 1. */
const FAILING = new Set(["bound-but-unused", "attempted-failed", "no evidence"]);
/** Any break a reader could show as the start of a new line. */
const LINE_BREAK = /[\n\r\u2028\u2029]/;

/** Skills called that no binding names, leaving out the ones that ran setup. */
function unboundSkills(bindings, uses) {
  const exempt = new Set([unqualified(bindings.skill ?? ""), SETUP_SKILL]);
  const skills = bindings.operations.filter(
    (binding) => binding.kind === "skill" && binding.native_id,
  );
  const bound = (use) => exempt.has(unqualified(use.name)) || skills.some((b) => matches(b, use));
  const unbound = new Map();
  for (const use of uses) {
    if (use.kind === "skill" && !bound(use) && !unbound.has(use.name)) {
      unbound.set(use.name, { name: use.name, where: use.where });
    }
  }
  return [...unbound.values()];
}

/** The routing table a bindings file names, resolved from the working directory; throws when unreadable. */
function tableOf(bindings) {
  const table = readRoutingTable(bindings);
  if (table.error) throw new Error(table.error);
  return table;
}

/**
 * The other operations the use a row was credited for could have credited
 * too, as `table/op` keys: their bindings match it, and it is creditable to
 * them under `marked`, the operations the routing table marks.
 */
function sharedWith(binding, credited, bindings, marked) {
  return bindings.operations
    .filter((other) => other !== binding && hasPerformer(other) && matches(other, credited))
    .map((other) => `${other.table}/${other.id}`)
    .filter((key) => creditable(credited, marked.has(key)));
}

/**
 * Check one bindings file against its transcripts, and a handoff's earlier
 * result when one is given. `table` is its routing table as
 * `routing-table.mjs` reads it, read here when not given; `since` a zoned time
 * before which calls are not counted (`call-scope.mjs`). Returns the
 * transcripts read, each read one with its `scope`, the table, one row per
 * operation `{ table, id, performer, state, where, note, shared }`, and the
 * unbound skills, and for a handoff how many uses it carried and how many it
 * dropped for a `--since` other than this run's. `shared` names the other
 * operations the call a used row was credited for could have credited too;
 * it is absent when there are none.
 */
export function checkReceipts({ bindings, notRun = [], handoff = null, table = null, since = null }) {
  const routing = table ?? tableOf(bindings);
  const found = readTranscripts(bindings.transcripts ?? []);
  const { transcripts } = found;
  const sessions = transcripts.filter((t) => t.status === "read").map((t) => t.session_id);
  const skill = bindings.skill ?? "";
  // A skill with its own table in the bindings, as the restart skill, may load before the level skill to resume,
  // in any session setup listed after the first, since each restart appends one.
  const resumeSkills = [...new Set((bindings.operations ?? []).map((op) => op.table).filter((t) => t && t !== skill))];
  const resumed = new Set((bindings.transcripts ?? []).slice(1).map((t) => t.session_id));
  const scoped = scopeCalls(found.uses, sessions, { skill, resumeSkills, resumed, since: sinceTime(since) });
  for (const t of transcripts) if (scoped.scopes.has(t.session_id)) t.scope = scoped.scopes.get(t.session_id);
  // Only a call that ran is a use; a refused or still-pending one is not.
  const uses = scoped.uses.filter((use) => use.outcome === "ran");
  const carried = handoff ? readHandoff(handoff) : { used: new Map(), covered: new Set() };
  for (const t of transcripts) {
    if (t.status === "missing" && carried.covered.has(t.session_id)) t.status = "covered";
  }
  // A carried use stands only for a transcript this run could not read itself:
  // its session's, or for a use in a Codex child thread, that child's, which
  // is listed when its rollout is not found. A Claude Code subagent is never
  // listed, so a carried use in one stands only while its session is unread.
  const read = new Set(transcripts.filter((t) => t.status === "read").map((t) => t.session_id));
  const unread = new Set(transcripts.filter((t) => t.status !== "read").map((t) => t.session_id));
  for (const [key, use] of carried.used) {
    if (read.has(use.session) && !unread.has(use.child)) carried.used.delete(key);
  }
  // A carried use has no time to cut, so it counts only for the story its
  // handoff's check was scoped to: one run with another `--since`, or with
  // none where this run has one, carries nothing.
  const dropped = handoff && !sameInstant(carried.since, since) ? carried.used.size : 0;
  if (dropped > 0) carried.used.clear();
  // Every call, whatever its outcome: `judge` credits only one that ran (`uses`).
  const context = {
    calls: scoped.uses,
    marked: new Set(routing.marked.map((id) => `${routing.skill}/${id}`)),
    carried: carried.used,
    notRun: new Set(notRun),
    missing: transcripts.some((transcript) => transcript.status === "missing"),
  };
  const operations = bindings.operations.map((binding) => {
    const { credited, ...row } = judge(binding, context);
    const shared = credited ? sharedWith(binding, credited, bindings, context.marked) : [];
    return {
      table: binding.table,
      id: binding.id,
      performer: binding.native_id,
      ...row,
      ...(shared.length > 0 && { shared }),
    };
  });
  return {
    transcripts,
    since,
    table: routing,
    operations,
    unbound: unboundSkills(bindings, uses),
    handoff: handoff
      ? {
          path: handoff,
          merged: operations.filter((row) => row.where?.endsWith(CARRIED)).length,
          dropped,
          since: carried.since,
        }
      : null,
  };
}

/** Whether two `--since` values, either absent, name one instant; one that does not read as a time matches nothing. */
function sameInstant(a, b) {
  try {
    return sinceTime(a) === sinceTime(b);
  } catch {
    return false;
  }
}

/** One report line for an operation. */
function operationLine(row) {
  const name = `${row.table}/${row.id}`;
  const note = row.note ? ` (${row.note})` : "";
  switch (row.state) {
    case "used":
      return row.shared
        ? `${name}: used (shared): ${row.performer} in ${row.where}; ` +
            `also bound to ${row.shared.join(", ")}; the check cannot tell which ran`
        : `${name}: used ${row.performer} in ${row.where}`;
    case "by fallback":
    case "unavailable":
      return `${name}: ${row.state} (no performer to find)`;
    case "not reached":
      return `${name}: not reached (declared by caller) ${row.performer}${note}`;
    case "no evidence":
      return `${name}: no evidence ${row.performer} (a transcript is missing${row.note ? `; ${row.note}` : ""})`;
    default:
      return `${name}: ${row.state} ${row.performer}${note}`;
  }
}

/** What rerunning setup fixes, said on each changed line. */
const RERUN = "rerun setup (seeded with the handoff when this session restarted), then this check";

/** The routing table's lines: whether it moved, which operations it marks, and whether it or its override changed since setup. */
function tableLines(table) {
  const marked = table.marked.length
    ? table.marked.join(", ")
    : "no operation, so a review counts from any context";
  const lines = [];
  if (table.moved !== undefined) lines.push(`table ${table.moved}: gone; read ${table.path} instead`);
  lines.push(`table ${table.path}: fresh_context on ${marked}`);
  if (table.changed) {
    lines.push(
      `table ${table.path}: changed since setup read it ` +
        `(sha256 ${table.sha256}, setup recorded ${table.recorded ?? "none"}); ${RERUN}`,
    );
  }
  const { override } = table;
  if (override?.changed) {
    const now = override.sha256 ? `sha256 ${override.sha256}` : "gone";
    lines.push(
      `override ${override.path}: changed since setup read it ` +
        `(${now}, setup recorded ${override.recorded ?? "none"}); ${RERUN}`,
    );
  }
  return lines;
}

/** Where a read session's calls were counted from, as its transcript line's ending. */
function scopeText(scope, skill) {
  switch (scope?.state) {
    case "loaded":
      return scope.resumedBy
        ? `; counted from ${scope.at}, when ${scope.resumedBy} loaded to resume`
        : `; counted from ${scope.at}, when ${skill} loaded`;
    case "untimed":
      return `; ${skill} loaded at no recorded time, so every call counts`;
    case "never":
      return `; no load of ${skill} found here, so every call counts`;
    default:
      return "";
  }
}

/**
 * The report's lines about the pull request's body: one per required line of
 * a body that was given, as `pr-body-lines.mjs` read it, or for a story with
 * none given, one saying so. Each starts with the word `pr-body`, which the
 * handoff reader takes for no line of its own, whatever a quoted line holds.
 */
function bodyLines(body, skill) {
  if (!body) return skill === STORY_SKILL ? ["pr-body: not checked (no --pr-body given)"] : [];
  const start = `pr-body ${body.path}:`;
  /** The forms a label's line takes, each quoted. */
  const forms = (row) => row.accepts.map((form) => `"${form}"`).join(" or ");
  return body.lines.map((row) => {
    switch (row.state) {
      case "found":
        return `${start} found "${row.line}"`;
      case "malformed":
        return `${start} malformed "${row.line}": write ${forms(row)}, with one space after the colon and the value filled in`;
      case "repeated":
        return `${start} repeated "${row.label}:": ${row.count} lines start with it, keep one`;
      default:
        return `${start} missing "${row.label}:": no line starts with it; it takes ${forms(row)}`;
    }
  });
}

/**
 * The whole report, one line per transcript, operation and unbound skill, then
 * the lines about `body`: the pull request's body as `readBody` returns it, or
 * null when none was given.
 */
function formatReport(result, bindings, bindingsPath, body) {
  const lines = [`receipt-check: ${bindingsPath} (${bindings.skill}, session ${bindings.session})`];
  lines.push(...tableLines(result.table));
  if (result.since) lines.push(`since ${result.since}: calls before it are not counted`);
  for (const t of result.transcripts) {
    const listed = t.listed ? `; listed at ${t.listed}` : "";
    const scope = scopeText(t.scope, bindings.skill);
    const read = `read ${t.path} (${t.subagents} subagent files${listed})${scope}`;
    const other = t.status === "covered" ? "covered by handoff" : "missing";
    lines.push(`transcript ${t.session_id}: ${t.status === "read" ? read : `${other} ${t.path}`}`);
  }
  if (result.handoff) {
    const { path, merged, dropped, since } = result.handoff;
    const why = dropped > 0 ? `, ${dropped} dropped: carried since ${since ?? "none"}, this run's ${result.since ?? "none"}` : "";
    lines.push(`handoff: ${path} (${merged} earlier uses carried${why})`);
  }
  lines.push(...result.operations.map(operationLine));
  lines.push(...result.unbound.map((u) => `used-but-unbound: ${u.name} in ${u.where}`));
  lines.push(...bodyLines(body, result.table.skill));
  const count = (state) => result.operations.filter((row) => row.state === state).length;
  const shared = result.operations.filter((row) => row.shared).length;
  lines.push(
    `summary: ${count("used") - shared} used, ${shared} used (shared), ${count("bound-but-unused")} bound-but-unused, ` +
      `${count("attempted-failed")} attempted-failed, ${count("not reached")} not reached, ${count("no evidence")} no evidence, ` +
      `${result.unbound.length} used-but-unbound` +
      (result.table.changed ? "; the table changed since setup" : "") +
      (result.table.override?.changed ? "; the override changed since setup" : ""),
  );
  return lines;
}

/** Read the command line, or return the reason it is wrong. */
function readOptions(argv) {
  const text = { type: "string" };
  let values;
  try {
    const options = { bindings: text, handoff: text, since: text, "pr-body": text, "not-run": { ...text, multiple: true } };
    ({ values } = parseArgs({ args: argv, options }));
  } catch (error) {
    return { error: error.message };
  }
  if (!values.bindings) return { error: "--bindings <path> is required" };
  const notRun = (values["not-run"] ?? []).flatMap((list) => list.split(",")).filter(Boolean);
  const since = values.since ?? null;
  try {
    sinceTime(since);
  } catch (error) {
    return { error: error.message };
  }
  // An empty `--pr-body` is a path that names no file, never an absent flag.
  const prBody = values["pr-body"] ?? null;
  // The report prints this path as given: a break in it would start a line a handoff's reader could take for a use.
  if (prBody !== null && LINE_BREAK.test(prBody)) {
    return { error: "--pr-body <path> holds a line break; save the body to a path on one line" };
  }
  return { bindings: values.bindings, handoff: values.handoff ?? null, notRun, since, prBody };
}

/** Load a bindings file setup completed, or return the reason it cannot be used. */
function loadBindings(path) {
  if (!existsSync(path)) return { error: `no bindings file at ${path}` };
  let bindings;
  try {
    bindings = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { error: `${path} is not valid JSON` };
  }
  const problem = bindingsProblem(bindings);
  return problem ? { error: `${path} ${problem}` } : { bindings };
}

/** What makes parsed JSON unusable as a bindings file, or null when nothing does. */
function bindingsProblem(bindings) {
  if (!Array.isArray(bindings?.operations) || !Array.isArray(bindings.transcripts)) {
    return "is not a bindings file: it has no operations or transcripts list";
  }
  if (!bindings.complete) return "has no completion marker; setup did not finish";
  if (bindings.transcripts.length === 0) return "lists no transcripts, so nothing could be read";
  const operation = bindings.operations.findIndex((o) => typeof o?.id !== "string");
  if (operation >= 0) return `has operation ${operation} with no id`;
  const entry = bindings.transcripts.findIndex(
    (t) => typeof t?.session_id !== "string" || typeof t?.path !== "string",
  );
  if (entry >= 0) return `has transcript ${entry} with no session_id or path`;
  const notFile = bindings.transcripts.find((t) => statOf(t.path)?.isFile() === false);
  return notFile ? `lists transcript ${notFile.path}, which is not a file` : null;
}

/**
 * What a bindings file whose table reads fine still lacks: the sha256 setup
 * recorded for its table or its override, without which a change cannot be
 * told (GRO-12); null when it lacks neither.
 */
function unrecorded(table) {
  if (typeof table.sha256 !== "string") return "records no table.sha256, so a changed table cannot be told";
  if (table.override && typeof table.override_sha256 !== "string") {
    return "records no table.override_sha256 for its override, so a changed override cannot be told";
  }
  return null;
}

/** A path's stats, or null where `existsSync` reads false: missing, unreachable or looping. */
function statOf(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

/**
 * The required lines of the pull request's body saved at `path`, as
 * `pr-body-lines.mjs` reads them, or the reason no file there can be read.
 */
function readBody(path) {
  const error = `no pull-request body file at ${path}`;
  if (!statOf(path)?.isFile()) return { error };
  try {
    return { path, lines: readBodyLines(readFileSync(path, "utf8")) };
  } catch {
    return { error };
  }
}

/** Run from the command line: print the report and exit by its result. */
function main(argv) {
  const options = readOptions(argv);
  const loaded = options.error ? options : loadBindings(options.bindings);
  if (loaded.error) {
    process.stderr.write(
      `receipt-check: ${loaded.error}\nUsage: receipt-check.mjs --bindings <path> [--not-run <table/op>,...] [--handoff <path>] [--since <zoned time>] [--pr-body <path>]\n`,
    );
    return 2;
  }
  if (options.handoff && !statOf(options.handoff)?.isFile()) {
    process.stderr.write(`receipt-check: no handoff file at ${options.handoff}\n`);
    return 2;
  }
  const body = options.prBody === null ? null : readBody(options.prBody);
  if (body?.error) {
    process.stderr.write(`receipt-check: ${body.error}\n`);
    return 2;
  }
  const table = readRoutingTable(loaded.bindings, options.bindings);
  if (table.error) {
    process.stderr.write(`receipt-check: ${table.error}\n`);
    return 2;
  }
  const missing = unrecorded(loaded.bindings.table);
  if (missing) {
    process.stderr.write(`receipt-check: ${options.bindings} ${missing}\n`);
    return 2;
  }
  const result = checkReceipts({ ...options, bindings: loaded.bindings, table });
  process.stdout.write(`${formatReport(result, loaded.bindings, options.bindings, body).join("\n")}\n`);
  // Bindings judged against a table other than the one setup bound prove nothing (GRO-12).
  const changed = table.changed || table.override?.changed;
  const unused = result.operations.some((row) => FAILING.has(row.state));
  // A body that was given fails the check unless every line it must carry was found.
  const lacking = body?.lines.some((row) => row.state !== "found");
  return changed || unused || lacking ? 1 : 0;
}

// Compare real paths: run through a symlink, argv names the link and the URL the file.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
