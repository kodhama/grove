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
 * A review's line (KOD-44, KTD10): for an operation the routing table marks
 * `fresh_context`, the check prints one used line per review, each ending in
 * what the reviewer read and the arguments it called the performer with,
 * as `readDetail` writes them:
 *
 *   story-worker/review: used code-review in <session id> subagent agent-a1; read <head> from <base>; args "base:<sha>"
 *
 * or `read <head> from <base> (dirty tree)`, or `read: none recorded`, and
 * `args none` for a call with none. The arguments are one JSON string, so no
 * text in them can end the line or start another. Several used lines for one
 * operation all carry, in order (`all`); `used` keeps the first, the one the
 * operation's verdict is judged from. A carried line's read and arguments
 * stay with it (`detail`), so a second restart carries them unchanged.
 *
 * Plan: docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md,
 * U8 and KTD12; the whole place, MQ-377:
 * docs/plans/2026-10-04-0734-feat-receipt-check-credits-calls-that-ran-plan.md,
 * KTD6 and U4; every review and what it read, KOD-44:
 * docs/plans/2026-11-08-kod-44-merge-gate-plan.md, U2 and KTD10.
 */
import { readFileSync } from "node:fs";

/** The heading of the handoff section that carries an earlier result. */
const HANDOFF_SECTION = "## Receipt check";
/** How a use carried from a handoff is marked where it was found. */
export const CARRIED = "(carried from handoff)";
/** The carried mark as regex text, its special characters escaped. */
const CARRIED_TEXT = CARRIED.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * A review line's detail as regex text: what the reviewer read, then the
 * call's arguments, none or one JSON string, which ends at its first
 * unescaped quote, so no text in it reads as the line's tail.
 */
const DETAIL_TEXT = String.raw`read(?: [0-9a-f]{40} from [0-9a-f]{40}(?: \(dirty tree\))?|: none recorded); args (?:none|unknown|"(?:[^"\\]|\\.)*")`;
/**
 * A used line, plain or shared: its `table/op` key, its performer, its
 * place, less any carried mark, a review's detail and a shared line's
 * `; also bound to …` tail, and that detail. The place's first word stops
 * at a `;`, which a shared line can put right after the session id.
 */
const USED_LINE = new RegExp(
  String.raw`^(\S+\/\S+): used (?:\(shared\): )?(\S+) in ([^\s;]+.*?)(?: ${CARRIED_TEXT})?(?:; (${DETAIL_TEXT}))?(?:; also bound to .*)?$`,
);

/**
 * What a review read and its arguments, as its used line ends:
 * `read <head> from <base>`, marked `(dirty tree)` when the tree was not
 * clean, or `read: none recorded`; then `args` and the arguments as one JSON
 * string, or `none`. `record` is the review's record from `review-reads.mjs`;
 * with none, the arguments are `unknown`.
 */
export function readDetail(record) {
  if (!record) return "read: none recorded; args unknown";
  const dirty = record.clean === false ? " (dirty tree)" : "";
  const read = record.head ? `read ${record.head} from ${record.base}${dirty}` : "read: none recorded";
  return `${read}; args ${record.args === null ? "none" : JSON.stringify(record.args)}`;
}

/** The line the check prints for its `--since`; group 1 is the time as given. */
const SINCE_LINE = /^since (\S+): calls before it are not counted$/;

/** The keys a section's lines match: each line's first group, for lines that match. */
function keysMatching(lines, pattern) {
  return new Set(lines.flatMap((line) => pattern.exec(line)?.slice(1, 2) ?? []));
}

/**
 * What a handoff's receipt-check section carries: each operation it reports
 * used, by `table/op` key, with the performer, the session it was used in,
 * the whole place and a review's detail: the first such use in `used`, and
 * every one, in order, in `all`; the session ids of the transcripts it read or itself
 * carried; and its `--since` as written, or null when it ran without one,
 * or, where the section holds more than one, all of them joined, which reads
 * as no time.
 */
export function readHandoff(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  const start = lines.findIndex((line) => line.trim() === HANDOFF_SECTION);
  const end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  const section = start < 0 ? [] : lines.slice(start + 1, end < 0 ? undefined : end);
  const all = new Map();
  for (const line of section) {
    const match = USED_LINE.exec(line.trimEnd());
    if (!match) continue;
    const [, key, performer, place, detail] = match;
    // The session leads the place, and a subagent's name ends it, in the
    // shape `subagentPlace` (`transcript-uses.mjs`) writes.
    const child = place.split(" subagent ")[1] ?? null;
    const use = { performer, session: place.split(" ")[0], child, place, ...(detail && { detail }) };
    all.set(key, [...(all.get(key) ?? []), use]);
  }
  const used = new Map([...all].map(([key, uses]) => [key, uses[0]]));
  const covered = keysMatching(section, /^transcript (\S+): (?:read|covered) /);
  // The report gives no transcript line for a child thread it read, so a
  // used line placed in one is what shows it was read.
  for (const uses of all.values()) for (const { child } of uses) if (child) covered.add(child);
  // Two since lines name no one story: joined, they read as no time, so they
  // match no `--since` and carry nothing.
  const sinces = section.flatMap((line) => SINCE_LINE.exec(line.trimEnd())?.slice(1, 2) ?? []);
  const since = sinces.length > 0 ? sinces.join(" and ") : null;
  return { used, all, covered, since };
}
