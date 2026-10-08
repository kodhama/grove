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
 *   with no such call keeps every call, and its report line says so;
 * - `since`: calls before that time are not counted, in any session.
 *
 * A call's time is its record's `timestamp`. A call with none that parses is
 * never dropped, and a load with none that parses cuts nothing: the check
 * keeps what it cannot place rather than guess.
 */
import { unqualified } from "./operation-state.mjs";

/** An ISO 8601 time with its zone: a `--since` value must name one, never the machine's local time. */
const ZONED_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** A `since` value as milliseconds, or null when there is none; throws when it does not read as a zoned time. */
export function sinceTime(since) {
  if (since == null) return null;
  const time = ZONED_TIME.test(since) ? Date.parse(since) : Number.NaN;
  if (Number.isNaN(time)) {
    throw new Error(`--since ${since} is not a UTC time such as 2026-10-08T21:16:31Z`);
  }
  return time;
}

/** Whether a call ran and loaded the level skill `skill`, in its session's main transcript. */
function isLoad(use, skill) {
  return (
    use.kind === "skill" &&
    use.outcome === "ran" &&
    use.where === use.session &&
    unqualified(use.name) === unqualified(skill)
  );
}

/**
 * The calls that count, and each read session's scope: `{ loaded }`, the
 * time its first load of the level skill was recorded at, or null when it
 * never loaded, with `untimed: true` when it loaded at no time that parses.
 * `since` is milliseconds or null, as `sinceTime` gives it.
 */
export function scopeCalls(uses, sessions, { skill, since = null }) {
  const scopes = new Map();
  const cut = new Map();
  for (const session of sessions) {
    const load = uses.find((use) => use.session === session && isLoad(use, skill));
    const time = load ? Date.parse(load.at ?? "") : Number.NaN;
    scopes.set(session, { loaded: load?.at ?? null, ...(load && Number.isNaN(time) && { untimed: true }) });
    if (!Number.isNaN(time)) cut.set(session, time);
  }
  const counts = (use) => {
    const at = Date.parse(use.at ?? "");
    if (Number.isNaN(at)) return true;
    if (since !== null && at < since) return false;
    return !cut.has(use.session) || at >= cut.get(use.session);
  };
  return { uses: uses.filter(counts), scopes };
}
