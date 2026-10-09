/**
 * Decide which calls the receipt check (`receipt-check.mjs`) counts, by when
 * they were made.
 *
 * In plain words: a session can do other work before it runs the level
 * skill whose bindings are checked, such as leading a run before it works a
 * story, or work an earlier story before this one. Those calls are not this
 * level's, so two cuts drop them:
 *
 * - the load: a session's calls count from the first call in its main
 *   transcript that ran and loaded the level skill (a Claude Code `Skill`
 *   call, or a Codex SKILL.md read, whose name after its last `:` is the
 *   level skill's). Its subagents' calls are cut at the same time. A session
 *   with no such call keeps every call, and its report line says so; a level
 *   skill a person started with a slash command leaves no such call. A
 *   session that resumed from a handoff, any the bindings list after the
 *   first, loaded the restart skill first and ran its resume steps before it
 *   loaded the level skill, so where a skill with its own table in the
 *   bindings, as the restart skill, loaded there before the level skill, its
 *   calls count from the last such load instead. The first session listed
 *   never resumed, so its cut never moves;
 * - `since`: calls before that time are not counted, in any session.
 *
 * A call's time is its record's `timestamp`. A call with none that parses is
 * never dropped, and a level skill's load with none that parses cuts nothing:
 * the check keeps what it cannot place rather than guess. A resume load with
 * no time is passed over, so the level skill's load cuts.
 */
import { unqualified } from "./operation-state.mjs";

/**
 * An ISO 8601 time with its zone: a `--since` value must name one, never the
 * machine's local time. Groups 1 to 5 are the year, month, day, hour and minute.
 */
const ZONED_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Whether a zoned time's date and clock exist: `Date.parse` rolls February 30th or 24:00 into the next day. */
function onTheCalendar(match) {
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day && hour < 24 && minute < 60;
}

/** A `since` value as milliseconds, or null when there is none; throws when it does not read as a zoned time. */
export function sinceTime(since) {
  if (since == null) return null;
  const match = ZONED_TIME.exec(since);
  const time = match && onTheCalendar(match) ? Date.parse(since) : Number.NaN;
  if (Number.isNaN(time)) {
    throw new Error(`--since ${since} is not a time with its zone: write it as YYYY-MM-DDTHH:MM:SSZ, such as 2026-10-08T21:16:31Z`);
  }
  return time;
}

/** A use's time as milliseconds, or null when it has none that parses. */
function timeMs(use) {
  const time = Date.parse(use.at ?? "");
  return Number.isNaN(time) ? null : time;
}

/** Whether a call ran in its session's main transcript and loaded a skill named in `names`, unqualified. */
function loads(use, names) {
  return use.kind === "skill" && use.outcome === "ran" && use.where === use.session && names.has(unqualified(use.name));
}

/** The first call in each session's main transcript that ran and loaded the level skill `skill`. */
function firstLoads(uses, skill) {
  const names = new Set([unqualified(skill)]);
  const found = new Map();
  for (const use of uses) {
    if (loads(use, names) && !found.has(use.session)) found.set(use.session, use);
  }
  return found;
}

/**
 * Each resumed session's last timed load of a resume skill (`resumeSkills`)
 * made no later than its first load of the level skill, as `levels` holds them.
 */
function resumeLoads(uses, resumeSkills, resumed, levels) {
  const names = new Set(resumeSkills.map(unqualified));
  const found = new Map();
  for (const use of uses) {
    if (!resumed.has(use.session)) continue;
    const level = timeMs(levels.get(use.session) ?? {});
    const at = timeMs(use);
    const latest = timeMs(found.get(use.session) ?? {}) ?? -Infinity;
    if (level !== null && at !== null && at <= level && at >= latest && loads(use, names)) {
      found.set(use.session, use);
    }
  }
  return found;
}

/** A session's scope from its first load and any resume load before it: `loaded` at its time, `untimed`, or `never`. */
function scopeOf(load, resume) {
  if (!load) return { state: "never" };
  if (timeMs(load) === null) return { state: "untimed" };
  return resume ? { state: "loaded", at: resume.at, resumedBy: unqualified(resume.name) } : { state: "loaded", at: load.at };
}

/**
 * The calls that count, and each read session's scope: `{ state: "loaded",
 * at }` when its first load of the level skill was recorded at a time that
 * parses, with `resumedBy` naming the resume skill when the cut starts at its
 * load instead, `{ state: "untimed" }` when the level skill's load was not,
 * and `{ state: "never" }` when no load of the skill is found there.
 * `resumeSkills` names the skills with their own table in the bindings, and
 * `resumed` the sessions that resumed from a handoff. `since` is milliseconds
 * or null, as `sinceTime` gives it.
 */
export function scopeCalls(uses, sessions, { skill, resumeSkills = [], resumed = new Set(), since = null }) {
  const levels = firstLoads(uses, skill);
  const resumes = resumeLoads(uses, resumeSkills, resumed, levels);
  const scopes = new Map(sessions.map((session) => [session, scopeOf(levels.get(session), resumes.get(session))]));
  const cuts = new Map(
    sessions.flatMap((session) => {
      const scope = scopes.get(session);
      return scope.state === "loaded" ? [[session, Date.parse(scope.at)]] : [];
    }),
  );
  const counts = (use) => {
    const at = timeMs(use);
    if (at === null) return true;
    if (since !== null && at < since) return false;
    return !cuts.has(use.session) || at >= cuts.get(use.session);
  };
  return { uses: uses.filter(counts), scopes };
}
