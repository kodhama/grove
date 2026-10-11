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
 * `missing`, which comes back with the forms too, and two or more are
 * `repeated`, with their count, since two can disagree and a reader takes
 * one. A value that opens with `<`, or with `&lt;` as a host may write it,
 * after any run of characters that are no letter or digit, is a placeholder
 * nobody filled in, so `Capture: captured <path>` is malformed too, in
 * backticks, brackets, a backslash escape or not; a real value may hold a `<`
 * after its first letter or digit. A line ends at any break a reader could
 * show as one (a line feed, a carriage return with or without one, a line or
 * paragraph separator), since a host can return a body with CRLF endings and
 * a quoted line must never carry a second line into the report; its trailing
 * spaces are dropped, and so is a byte-order mark before the first line.
 *
 * Its limits. It reads the text it is given, so it proves the saved file, not
 * the pull request: saving the body unchanged, after its last edit, is the
 * caller's to get right. It reads lines, not Markdown, so a line inside a
 * fenced block or a template's example counts as the line, and so does a line
 * inside an HTML comment, though the rendered pull request never shows it.
 * And it checks a value's form only, never that a captured path exists or
 * that a reason is a good one.
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
const REQUIRED_LINES = [
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

/**
 * Every break a reader could show as the start of a new line: a line feed, a
 * carriage return with or without one, a line or paragraph separator.
 */
export const LINE_BREAK = /\r\n?|\n|\u2028|\u2029/;

/**
 * What opens a value nobody filled in: a `<`, or the `&lt;` that stands for
 * one, after any run of characters that are no letter or digit, as a
 * template's placeholder has it, bare or dressed as code, a quote, emphasis,
 * brackets or an escape.
 */
const PLACEHOLDER = /^[^\p{L}\p{N}]*(?:<|&lt;)/u;

/**
 * Whether a line is its label, a colon, one space, a form's words and a value
 * after them. A line never ends in a space, so something always follows the
 * form's words; a placeholder left unfilled is not a value.
 */
function wellFormed(line, { label, forms }) {
  return forms.some(({ starts }) => {
    const opening = `${label}: ${starts}`;
    return line.startsWith(opening) && !PLACEHOLDER.test(line.slice(opening.length));
  });
}

/**
 * What a body's text holds for each required line, in the list's order:
 * `{ label, state: "found", line }`, `{ label, state: "missing", accepts }`,
 * `{ label, state: "malformed", line, accepts }` or
 * `{ label, state: "repeated", count }`. `accepts` is each form the label's
 * line takes, written out.
 */
export function readBodyLines(text) {
  // Every break a reader could show as a new line ends one, so a quoted line holds no second line.
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(LINE_BREAK)
    .map((line) => line.trimEnd());
  return REQUIRED_LINES.map((required) => {
    const { label, forms } = required;
    const accepts = forms.map(({ starts, then }) => `${label}: ${starts}${then}`);
    const labelled = lines.filter((line) => line.startsWith(`${label}:`));
    if (labelled.length === 0) return { label, state: "missing", accepts };
    if (labelled.length > 1) return { label, state: "repeated", count: labelled.length };
    const [line] = labelled;
    if (wellFormed(line, required)) return { label, state: "found", line };
    return { label, state: "malformed", line, accepts };
  });
}
