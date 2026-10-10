/**
 * MQ-353 — read the receipt-check result a handoff carries from before a
 * restart, for the receipt check (`receipt-check.mjs`).
 *
 * In plain words: before a session restarts, it pastes the check's report
 * into its handoff under `## Receipt check`. After a restart onto another
 * machine, the transcripts it read are gone, so the next check takes the
 * operations that report shows used from that section:
 *
 *   story-worker/review: used code-review in <session id> subagent agent-a1
 *
 * gives `story-worker/review` → { performer: "code-review", session:
 * "<session id>", place: "<session id> subagent agent-a1" }. The place is
 * everything after `in`, so a review can show the subagent it ran in; a
 * place the check itself marked carried keeps no second mark. Only `used`
 * lines carry, so a line reading `attempted-failed` or any other state never
 * does. The section's `transcript <id>: read` and `covered` lines name the
 * sessions it read or itself carried, and a used line placed in a subagent
 * names that subagent as read too. Its `since <time>: calls before it are
 * not counted` line, which the check prints when run with `--since`, gives
 * the story start the section was scoped to, so a check for another story
 * can tell its carried uses are not its own. Lines outside that section
 * never count.
 *
 * Plan: docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md,
 * U8 and KTD12; the whole place, MQ-377:
 * docs/plans/2026-10-04-0734-feat-receipt-check-credits-calls-that-ran-plan.md,
 * KTD6 and U4.
 */
import { readFileSync } from "node:fs";

/** The heading of the handoff section that carries an earlier result. */
const HANDOFF_SECTION = "## Receipt check";
/** How a use carried from a handoff is marked where it was found. */
export const CARRIED = "(carried from handoff)";
/** The carried mark as regex text, its special characters escaped. */
const CARRIED_TEXT = CARRIED.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * A used line, plain or shared: its `table/op` key, its performer, and its
 * place, less any carried mark and a shared line's `; also bound to …` tail.
 * The place's first word stops at a `;`, which a shared line can put right
 * after the session id.
 */
const USED_LINE = new RegExp(
  String.raw`^(\S+\/\S+): used (?:\(shared\): )?(\S+) in ([^\s;]+.*?)(?: ${CARRIED_TEXT})?(?:; also bound to .*)?$`,
);

/** The line the check prints for its `--since`; group 1 is the time as given. */
const SINCE_LINE = /^since (\S+): calls before it are not counted$/;

/** The keys a section's lines match: each line's first group, for lines that match. */
function keysMatching(lines, pattern) {
  return new Set(lines.flatMap((line) => pattern.exec(line)?.slice(1, 2) ?? []));
}

/**
 * What a handoff's receipt-check section carries: each operation it reports
 * used, by `table/op` key, with the performer, the session it was used in and
 * the whole place; the session ids of the transcripts it read or itself
 * carried; and its `--since` as written, or null when it ran without one,
 * or, where the section holds more than one, all of them joined, which reads
 * as no time.
 */
export function readHandoff(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  const start = lines.findIndex((line) => line.trim() === HANDOFF_SECTION);
  const end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  const section = start < 0 ? [] : lines.slice(start + 1, end < 0 ? undefined : end);
  const used = new Map(
    section.flatMap((line) => {
      const match = USED_LINE.exec(line.trimEnd());
      if (!match) return [];
      const [, key, performer, place] = match;
      // The session leads the place, and a subagent's name ends it, in the
      // shape `subagentPlace` (`transcript-uses.mjs`) writes.
      const child = place.split(" subagent ")[1] ?? null;
      return [[key, { performer, session: place.split(" ")[0], child, place }]];
    }),
  );
  const covered = keysMatching(section, /^transcript (\S+): (?:read|covered) /);
  // The report gives no transcript line for a child thread it read, so a
  // used line placed in one is what shows it was read.
  for (const { child } of used.values()) if (child) covered.add(child);
  // Two since lines name no one story: joined, they read as no time, so they
  // match no `--since` and carry nothing.
  const sinces = section.flatMap((line) => SINCE_LINE.exec(line.trimEnd())?.slice(1, 2) ?? []);
  const since = sinces.length > 0 ? sinces.join(" and ") : null;
  return { used, covered, since };
}
