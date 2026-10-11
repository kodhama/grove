/**
 * GRO-21 — read the lines a story's pull request must carry in its body, for
 * the receipt check (`receipt-check.mjs`).
 *
 * In plain words: a story's pull request says, each on a line of its body,
 * whether a lesson was captured and whether its docs changed. The worker
 * saves the body to a file, and the check reads each required line from that
 * text:
 *
 *   Capture: skipped: the tests already show the lesson
 *
 * gives { label: "Capture", state: "found", line: "Capture: skipped: the
 * tests already show the lesson" }. A line counts only when it starts with
 * its label and a colon, with nothing before them: no bullet, bold, quote
 * mark or leading space, and the label in its own case. One space follows the
 * colon, then a value in one of the label's forms; a line that starts with
 * its label and fits no form is `malformed`, and comes back with the forms it
 * could have taken. Each label appears exactly once: no such line is
 * `missing`, and two or more are `repeated`, with their count, since two can
 * disagree and a reader takes one. A line's trailing spaces and carriage
 * return are dropped first, since a host can return a body with CRLF endings.
 *
 * Its limits. It reads the text it is given, so it proves the saved file, not
 * the pull request: saving the body unchanged, after its last edit, is the
 * caller's to get right. It reads lines, not Markdown, so a line inside a
 * fenced block or a template's example counts as the line. And it checks a
 * value's form only, never that a captured path exists or that a reason is a
 * good one.
 *
 * Plan: docs/plans/2026-10-11-gro-21-required-capture-line-plan.md, KTD2,
 * KTD5, KTD6 and U2.
 */

/**
 * The lines a body must carry, in the order they are reported: each a label
 * and the forms its value takes. A form is the words a value starts with and
 * a name for what follows them, which is never empty. A later required line
 * is one more entry.
 */
export const REQUIRED_LINES = [
  {
    label: "Capture",
    forms: [
      { starts: "captured ", then: "<path>" },
      { starts: "skipped: ", then: "<reason>" },
    ],
  },
  {
    label: "Docs",
    forms: [
      { starts: "updated ", then: "<paths>" },
      { starts: "none needed, because ", then: "<why>" },
    ],
  },
];

/** Whether a line is its label, a colon, one space, a form's words and something after them. */
function wellFormed(line, { label, forms }) {
  return forms.some(({ starts }) => {
    const opening = `${label}: ${starts}`;
    return line.startsWith(opening) && line.slice(opening.length).trim() !== "";
  });
}

/**
 * What a body's text holds for each required line, in the list's order:
 * `{ label, state: "found", line }`, `{ label, state: "missing" }`,
 * `{ label, state: "malformed", line, accepts }` with each form the line could
 * have taken written out, or `{ label, state: "repeated", count }`.
 */
export function readBodyLines(text) {
  const lines = text.split("\n").map((line) => line.trimEnd());
  return REQUIRED_LINES.map((required) => {
    const { label, forms } = required;
    const labelled = lines.filter((line) => line.startsWith(`${label}:`));
    if (labelled.length === 0) return { label, state: "missing" };
    if (labelled.length > 1) return { label, state: "repeated", count: labelled.length };
    const [line] = labelled;
    if (wellFormed(line, required)) return { label, state: "found", line };
    const accepts = forms.map(({ starts, then }) => `${label}: ${starts}${then}`);
    return { label, state: "malformed", line, accepts };
  });
}
