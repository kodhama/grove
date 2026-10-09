/**
 * MQ-353 — read what a shell line runs: the command-line tools it calls, and
 * any skill whose own script it runs, from a repo or a plugin's install. Both
 * harnesses use it: a Claude Code `Bash` call and a Codex command each carry
 * one shell line.
 *
 * In plain words: `cd /repo && FOO=1 gh pr view 12` runs two commands, `cd`
 * and `gh`, so it reads as two uses:
 *
 *   { kind: "cli", name: "cd" }, { kind: "cli", name: "gh" }
 *
 * - a cli: the first word of each command. The line is split at `&&`, `||`,
 *   `;`, `|` and newlines outside quotes, and a `$(` outside single quotes
 *   opens a command that runs to its matching `)`, even inside double quotes
 *   (`PR="$(gh pr view)"`), unless a backslash escapes it. Leading
 *   `NAME=value` settings are skipped, a leading `(` starts the command, and
 *   text is never a command: heredoc bodies, comments and `case` patterns
 *   are dropped, and quoted text stays inside its word, separators and
 *   all. A quoted or escaped space stays inside its word too, so
 *   `node "/Users/Jane Doe/x.mjs"` runs one script, not two words, and
 *   `git commit -m "fix: a; b"` runs only `git`;
 * - a skill-script: a command that runs a file in a skill's own `scripts/`
 *   folder, as its first word or after `bash`, `sh`, `node` or `python`. The
 *   skill sits in a repo's `.agents/skills/<skill>/` or `.claude/skills/<skill>/`,
 *   or in a plugin's install, which Claude Code and Codex both cache at
 *   `plugins/cache/<marketplace>/<plugin>/<version>/skills/<skill>/`. A
 *   plugin's script is named `<plugin>:<skill>`, so another plugin's skill of
 *   the same name never passes for a binding qualified by its plugin.
 *
 * It reads the line only, never whether it ran: the caller pairs each use
 * with its call's outcome (`transcript-uses.mjs`, `codex-uses.mjs`).
 *
 * Plan: docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md,
 * U8 and KTD12; split out of `transcript-uses.mjs` for MQ-377:
 * docs/plans/2026-10-04-0734-feat-receipt-check-credits-calls-that-ran-plan.md, U2.
 */
import { basename } from "node:path";

/** Exit codes from a shell that could not run the command: not executable, not found. */
export const SHELL_COULD_NOT_RUN = new Set([126, 127]);
/** Commands that run the script named after them. */
const INTERPRETERS = new Set(["bash", "sh", "zsh", "node", "python", "python3"]);
/**
 * A file in a skill's own scripts folder, in a repo or a plugin cache. The
 * groups are the plugin's name, for a plugin cache only, and the skill's.
 */
const SKILL_SCRIPT =
  /(?:^|\/)(?:\.(?:agents|claude)\/skills|plugins\/cache\/[^/]+\/([^/]+)\/[^/]+\/skills)\/([^/]+)\/scripts\//;
/** What ends a word outside quotes. */
const WORD_END = /[\s;&|()<>]/;
/** Words after which a command still starts, as a `case` can. */
const COMMAND_PREFIXES = new Set(["then", "do", "else", "elif", "if", "while", "until", "!", "time", "{"]);
/** A leading `NAME=value` setting. */
const SETTING = /^[A-Za-z_]\w*=/;
/** What a backslash escapes inside double quotes; before anything else it stays. */
const DOUBLE_QUOTED_ESCAPES = new Set(["$", "`", '"', "\\", "\n"]);
/**
 * A heredoc: its opening line, kept as group 3, then its body up to its
 * terminator. The delimiter is a word, bare, quoted or backslash-escaped.
 */
const HEREDOC = /<<-?\s*\\?(['"]?)([^\s'"\\;&|<>()]+)\1([^\n]*)\n[\s\S]*?\n\s*\2(?=\s*(?:\n|$))/g;

/**
 * A shell line's commands as text, read left to right once its heredoc
 * bodies are dropped. Outside quotes `&&`, `||`, `;`, `|` and a newline end a
 * command; inside quotes they are text, and quoted text stays inside its
 * word; in a `$'…'` quote a backslash escapes the next character, a quote
 * included. A `$(` outside single quotes and not escaped opens a command that
 * ends at its matching `)`, a subshell's own `(` and `)` counting as depth,
 * and inside double quotes the quotes resume after it. A `$((` opens
 * arithmetic, which is no command, though a `$(` inside it is. A `${` runs to
 * its matching `}`, a `)` or a separator inside it being text. A `case`
 * pattern, from its `in` or `;;` to its `)`, belongs to no command: its `)`
 * and `|` neither close a `$(` nor split a command, and a command starts
 * after its `)`. A `case` opens and an `esac` closes only where a command or,
 * for `esac`, a pattern can start, and a separator in a case's word or
 * pattern shows the `case` was only a word. A backslash-newline outside
 * single quotes is dropped, joining the lines, a `#` that starts a word
 * outside quotes runs a comment to the newline, and an unclosed quote runs to
 * the end. A command comes before the ones it opens: `echo "a; $(date)"`
 * gives `echo "a; "` and `date`.
 */
function commandTexts(line) {
  const text = line.replace(HEREDOC, "$3");
  const found = [""];
  // Each frame's `cases` holds one entry per open `case`: its state, "word"
  // until its `in`, then "pattern" up to a pattern's `)`, then "body" up to
  // its `;;`; and the subshell depth it opened at, where its `)`s count.
  const frames = [{ at: 0, depth: 0, braces: 0, cases: [], quoted: false }];
  let quote = "";
  let wordStart = true;
  // Whether a frame's open case is in a pattern: a pattern's own `(` and `)`
  // sit at the depth its case opened at.
  const inPattern = ({ cases, depth }) =>
    cases.at(-1)?.state === "pattern" && depth === cases.at(-1).depth;
  // An arithmetic frame's `at` is null: its text belongs to no command, and
  // nor does a case pattern's.
  const add = (chars) => {
    const { at } = frames.at(-1);
    if (at !== null && !inPattern(frames.at(-1))) found[at] += chars;
  };
  const next = () => {
    const frame = frames.at(-1);
    if (frame.at !== null) frame.at = found.push("") - 1;
    wordStart = true;
  };
  const wordAt = (i, word) =>
    text.startsWith(word, i) && (i + word.length === text.length || WORD_END.test(text[i + word.length]));
  // Whether the next word stands where a command starts: the command read so
  // far holds only words a command can follow, such as `then` or a `(`.
  const commandCanStart = () => {
    const { at } = frames.at(-1);
    if (at === null) return false;
    const words = found[at].split(/[\s(]+/).filter(Boolean);
    return words.every((word) => COMMAND_PREFIXES.has(word));
  };
  // Whether a case pattern starts at i: after the case's `in`, or after a
  // `;;`, `;&` or newline that ends a body. An `esac` there closes the case.
  const patternCanStart = (i) => {
    let end = i - 1;
    while (end >= 0 && (text[end] === " " || text[end] === "\t")) end--;
    if (/[;&\n]/.test(text[end])) return true;
    return text.slice(end - 1, end + 1) === "in" && (end < 2 || WORD_END.test(text[end - 2]));
  };
  // Whether an `esac` at i closes the open case: never as the word it tests,
  // in a pattern only where one starts, in a body only where a command can.
  const closesCase = (i, { state }) =>
    state === "pattern" ? patternCanStart(i) : state === "body" && commandCanStart();
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const after = text[i + 1];
    const frame = frames.at(-1);
    const nested = frames.length > 1;
    const openCase = frame.cases.at(-1);
    const pattern = inPattern(frame);
    // A case's word or pattern never holds a `;`, `&&`, `||` or `|`, so one
    // there shows the `case` was only a word: drop it, or it would hide what
    // follows as pattern text.
    const dropFalseCase = () => {
      if (openCase && openCase.state !== "body" && openCase.depth === frame.depth) frame.cases.pop();
    };
    if (quote === "'") {
      if (char === "'") quote = "";
      add(char);
    } else if (quote === "$'") {
      if (char === "\\" && after !== undefined) add(char + text[++i]);
      else {
        if (char === "'") quote = "";
        add(char);
      }
    } else if (char === "\\") {
      if (after === "\n") i++;
      else {
        add(after === undefined ? char : char + text[++i]);
        if (!quote) wordStart = false;
      }
    } else if (char === "$" && after === "(") {
      i++;
      const arithmetic = text[i + 1] === "(";
      frames.push({ at: arithmetic ? null : 0, depth: 0, braces: 0, cases: [], quoted: quote === '"' });
      quote = "";
      if (!arithmetic) next();
    } else if (quote === '"') {
      if (char === '"') quote = "";
      add(char);
    } else if (char === "$" && after === "'") {
      i++;
      quote = "$'";
      add("$'");
      wordStart = false;
    } else if (char === "'" || char === '"') {
      quote = char;
      add(char);
      wordStart = false;
    } else if (char === "$" && after === "{") {
      i++;
      frame.braces++;
      add("${");
      wordStart = false;
    } else if (frame.braces > 0) {
      if (char === "}") frame.braces--;
      add(char);
    } else if (char === "#" && wordStart) {
      while (i + 1 < text.length && text[i + 1] !== "\n") i++;
    } else if (pattern && (char === ")" || char === "|")) {
      if (char === ")") {
        openCase.state = "body";
        next();
      }
    } else if (char === ")" && nested && frame.depth === 0) {
      frames.pop();
      if (frame.quoted) quote = '"';
      wordStart = false;
    } else if ((char === "&" && after === "&") || (char === "|" && after === "|")) {
      i++;
      dropFalseCase();
      next();
    } else if (char === ";" || char === "|" || char === "\n") {
      const endsBody = char === ";" && (after === ";" || after === "&");
      if (endsBody && openCase?.state === "body" && openCase.depth === frame.depth) {
        // The whole `;;`, `;&` or `;;&` ends the body.
        i += after === ";" && text[i + 2] === "&" ? 2 : 1;
        openCase.state = "pattern";
      } else if (char !== "\n") dropFalseCase();
      next();
    } else {
      if (wordStart && !pattern && wordAt(i, "case") && commandCanStart()) frame.cases.push({ state: "word", depth: frame.depth });
      else if (wordStart && openCase?.state === "word" && wordAt(i, "in")) openCase.state = "pattern";
      else if (wordStart && openCase && wordAt(i, "esac") && closesCase(i, openCase)) frame.cases.pop();
      // A pattern's own leading `(` pairs with its `)`, which ends the pattern.
      if (nested && char === "(" && !pattern) frame.depth++;
      if (nested && char === ")") frame.depth--;
      add(char);
      wordStart = /[\s()]/.test(char);
    }
  }
  return found;
}

/**
 * A command's words as the shell splits them: a quoted or backslash-escaped
 * space stays inside its word, and the quotes and backslashes are dropped, so
 * `node "/Users/Jane Doe/x.mjs"` gives `node` and `/Users/Jane Doe/x.mjs`.
 */
function shellWords(part) {
  const found = [];
  let word = "";
  let open = false;
  for (let i = 0; i < part.length; i++) {
    const char = part[i];
    if (/\s/.test(char)) {
      if (open) found.push(word);
      word = "";
      open = false;
    } else if (char === "'") {
      const end = part.indexOf("'", i + 1);
      const close = end < 0 ? part.length : end;
      word += part.slice(i + 1, close);
      open = true;
      i = close;
    } else if (char === '"') {
      open = true;
      for (i++; i < part.length && part[i] !== '"'; i++) {
        word += part[i] === "\\" && DOUBLE_QUOTED_ESCAPES.has(part[i + 1]) ? part[++i] : part[i];
      }
    } else {
      word += char === "\\" && i + 1 < part.length ? part[++i] : char;
      open = true;
    }
  }
  if (open) found.push(word);
  return found;
}

/**
 * The commands a shell line runs, as words with leading `NAME=value` settings
 * skipped: `cd /repo && FOO=1 gh pr view` gives `cd /repo` and `gh pr view`.
 * `$(` starts a command and a leading `(` opens one, and a `(` or `)` around
 * its first word is dropped: `PR=$(gh pr view)` gives `gh pr view`,
 * `(gh pr view)` gives `gh pr view)`, and `echo $(date)` gives `echo` and
 * `date`.
 */
function commands(line) {
  return commandTexts(line)
    .map((part) => shellWords(part).filter(Boolean))
    .map((words) => {
      const start = words.findIndex((word) => !SETTING.test(word));
      if (start < 0) return [];
      const [first, ...rest] = words.slice(start);
      const command = first.replace(/^\(+|\)+$/g, "");
      return command ? [command, ...rest] : rest;
    })
    .filter((words) => words.length > 0);
}

/**
 * What a shell line shows was used: each command's first word as a CLI, and
 * a skill whose own script a command runs.
 */
export function shellUses(line) {
  return commands(line).flatMap(([first, second]) => {
    const script = INTERPRETERS.has(basename(first)) ? second : first;
    const skill = SKILL_SCRIPT.exec(script ?? "");
    const uses = [{ kind: "cli", name: first }];
    if (!skill) return uses;
    const [, plugin, name] = skill;
    return [...uses, { kind: "skill-script", name: plugin ? `${plugin}:${name}` : name }];
  });
}
