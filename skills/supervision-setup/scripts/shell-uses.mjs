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
 *   `;`, `|&`, a `|` or lone `&` outside a redirect and newlines outside quotes, and a `$(` or a
 *   backtick outside single quotes opens a command that runs to its match,
 *   even inside double quotes (`PR="$(gh pr view)"`), unless a backslash
 *   escapes it. Leading `NAME=value` settings are skipped, and so are the
 *   shell's reserved words where a command starts (`if`, `then`, `do`, `!`,
 *   `{`, `time` and the like), a `(` there and a function's `name()`; a
 *   command `env` runs is read too. Text is never a command: comments,
 *   `case` words and patterns, `for` lists, `[[` tests, arrays, arithmetic
 *   and quoted heredoc bodies are dropped, an unquoted heredoc's body is
 *   read for the commands it expands, and quoted text stays inside its word,
 *   separators and all. A quoted or escaped space stays inside its word too, so
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
const WORD_END = /[\s;&|()<>`]/;
/** What a word never starts with: blanks, operators and a comment's `#`. */
const NOT_A_WORD = /[\s;&|()<>#]/;
/** Reserved words after which a command still starts. */
const COMMAND_PREFIXES = ["then", "do", "else", "elif", "if", "while", "until", "!", "{"];
/** Reserved words that end a compound command: what follows is a redirect or a separator. */
const COMPOUND_ENDS = ["fi", "done", "}"];
/** A leading `NAME=value` setting. */
const SETTING = /^[A-Za-z_]\w*=/;
/** A `NAME=value` setting where a word starts. */
const SETTING_AT = /[A-Za-z_]\w*=/y;
/** The long options of `env` that take the next word as their value. */
const ENV_VALUE_OPTIONS = new Set(["--unset", "--chdir", "--split-string"]);
/** Short `env` options, grouped or not, whose last takes the next word as its value. */
const ENV_VALUE_FLAGS = /^-[^-]*[uCPS]$/;
/** `time` and its option, after which a command still starts. */
const TIME = /time(?:[ \t]+-p)?(?=[\s;&|()<>]|$)/y;
/** A function's definition up to its body: `name()` or `function name`, `()` optional. */
const FUNCTION = /(?:function[ \t]+[^\s;&|()<>]+(?:[ \t]*\([ \t]*\))?|[^\s;&|()<>'"\\$`=]+[ \t]*\([ \t]*\))/y;
/** What a backslash escapes inside double quotes; before anything else it stays. */
const DOUBLE_QUOTED_ESCAPES = new Set(["$", "`", '"', "\\", "\n"]);
/**
 * A heredoc's operator, `<<` or `<<-` but never a here-string's `<<<`, and
 * its delimiter: bare, quoted or backslash-escaped.
 */
const HEREDOC = /(?<!<)<<(?!<)(-?)[ \t]*(\\?)(['"]?)([^\s'"\\;&|<>()]+)\3/g;

/** Where an unquoted heredoc's body stood: its commands are read there. */
const HEREDOC_MARK = "\uE000";

/**
 * The commands an unquoted heredoc's body runs, read as the shell expands
 * it, which is as a double-quoted word would be, except that a `"` in the
 * body itself is text; inside a `$(` or backtick in it, quotes are quotes
 * again. A body whose `$(` or backtick never closes runs nothing, and hides
 * nothing after it.
 */
const heredocCommands = (body) => {
  const { found, closed } = scan(body, true);
  return closed ? found.slice(1) : [];
};

/**
 * A shell line's commands as text, read left to right. A heredoc's body is
 * read on its own, where it stood: an unquoted one's for the commands it
 * expands, any other's dropped; a `<<<` here-string is no heredoc.
 * Outside quotes `&&`, `||`, `;`, `|&`, a `|` or `&` that is not part of a
 * redirect (`>|`, `2>&1`) and a newline end a command; inside quotes they are text, and
 * quoted text stays inside its word; in a `$'…'` quote a backslash escapes
 * the next character, a quote included. A `$(` or a backtick outside single
 * quotes and not escaped opens a command that ends at its matching `)` or
 * backtick, and inside double quotes the quotes resume after it; so does a
 * process substitution's `<(` or `>(`. A `$((` opens arithmetic, which is
 * no command, though a `$(` inside it is. A `${` runs to its matching `}`,
 * a `)` or a separator inside it being text.
 *
 * Each frame knows whether a command starts at its next word, and only
 * there is a word read as a reserved word. `if`, `then`, `do`, `!`, `{`,
 * `time` and the like are dropped and a command still starts after them; a
 * `(` opens a subshell there and a `((` arithmetic, unless its parens close
 * apart, as in `((a) )`. A function's `name()`
 * or `function name` is dropped and its body starts a command. `fi`,
 * `done`, `}`, a subshell's `)` and an arithmetic command's `))` end a
 * compound command, and the redirects after them belong to no command. So
 * does a `for` or `select` up to its `do`, and a `[[` test up to its `]]`. A `case` and its word belong to
 * no command either; its patterns run from its `in` or a `;;`, `;&` or
 * `;;&` to their `)`, where its body starts a command, and an `esac`
 * closes it where a pattern or a command can start. A pattern's `)` and `|`
 * neither close a `$(` nor split a command, and an extglob's `(` and `)`
 * inside it pair up. An array's words, as in `a=(x y)`, are no commands. A
 * backslash-newline outside single quotes is dropped,
 * joining the lines, a `#` that starts a word outside quotes runs a comment
 * to the newline, and an unclosed quote runs to the end. A command comes
 * before the ones it opens: `echo "a; $(date)"` gives `echo "a; "` and
 * `date`.
 */
function commandTexts(line) {
  return scan(line).found;
}

/**
 * A line with its heredocs taken out. Each operator's body follows the line
 * it sits on, the bodies in the operators' order, each up to the line that
 * is exactly its delimiter, or, after `<<-`, that line with its leading tabs
 * dropped. An unquoted heredoc's operator becomes a mark where its body's
 * commands are read; any other's is dropped, and every body is. Where no
 * line is exactly the delimiter but one is once its blanks are trimmed,
 * bash runs the body to the end of the input, and fails inside a compound,
 * so that body is dropped with every line after it, and nothing in it is
 * read. An operator with no such line either, as in quotes or `$((1<<n))`,
 * is left as text, and the operators after it are still read.
 */
function readHeredocs(line) {
  const lines = line.split("\n");
  const kept = [];
  const bodies = [];
  for (let n = 0; n < lines.length; n++) {
    let text = lines[n];
    let next = n + 1;
    const marks = [];
    for (const operator of text.matchAll(HEREDOC)) {
      const [taken, dash, escaped, quoted, word] = operator;
      const exact = lines.findIndex((body, k) => k >= next && (dash ? body.replace(/^\t+/, "") : body) === word);
      const end = exact < 0 ? lines.findIndex((body, k) => k >= next && body.trim() === word) : exact;
      if (end < 0) continue;
      const runs = exact >= 0 && !escaped && !quoted;
      if (runs) bodies.push(lines.slice(next, end).join("\n"));
      marks.push({ at: operator.index, length: taken.length, mark: runs ? HEREDOC_MARK : "" });
      next = exact < 0 ? lines.length : end + 1;
    }
    for (const { at, length, mark } of marks.reverse()) text = text.slice(0, at) + mark + text.slice(at + length);
    kept.push(text);
    n = next - 1;
  }
  return { text: kept.join("\n"), bodies };
}

/**
 * A line's commands as text, and whether it closed every quote, `$(`,
 * backtick and `${` it opened. A heredoc's body is scanned as a line that
 * starts inside a double quote no `"` closes.
 */
function scan(line, heredoc = false) {
  const { text, bodies } = readHeredocs(line);
  const found = [""];
  // A frame is the line itself, a `$(` or backtick (`at` its command's
  // index), or arithmetic (`at` null: its text belongs to no command).
  // `parens` holds each open `(`: a subshell's or a word's, such as an
  // array's. `cases` holds one entry per open `case`: its state, "word"
  // until its `in`, then "pattern" up to a pattern's `)`, then "body" up to
  // its `;;`; the paren depth it opened at; whether a pattern starts at the
  // next word; and its extglob depth. `command` says a command starts at
  // the next word, `skip` that the text up to the next separator belongs to
  // no command, `arithmetic` that a `((` there opens arithmetic, as after a
  // `for`.
  const frameOf = (kind, at, quoted) => ({
    kind, at, quoted, parens: [], braces: 0, cases: [], command: true, skip: false, arithmetic: false, test: false,
  });
  const frames = [frameOf(heredoc ? "heredoc" : "line", 0, false)];
  let quote = heredoc ? '"' : "";
  let wordStart = true;
  // Whether a frame's open case is in a pattern: a pattern's own `(` and `)`
  // sit at the depth its case opened at.
  const inPattern = ({ cases, parens }) =>
    cases.at(-1)?.state === "pattern" && parens.length === cases.at(-1).depth;
  const add = (chars) => {
    const frame = frames.at(-1);
    if (frame.at !== null && !frame.skip && !inPattern(frame)) found[frame.at] += chars;
  };
  // A command starts: in a frame that holds commands, at a new index.
  const next = () => {
    const frame = frames.at(-1);
    if (frame.at !== null) frame.at = found.push("") - 1;
    Object.assign(frame, { command: true, skip: false, arithmetic: false, test: false });
    wordStart = true;
  };
  // A compound command ends: what follows up to a separator is no command.
  const ended = (frame) => Object.assign(frame, { command: false, skip: true, arithmetic: false });
  // Whether the `((` at i closes as `))`, as arithmetic does: bash reads one
  // whose parens close apart, as in `((a) )`, as two subshells.
  const closesAsArithmetic = (i) => {
    let depth = 0;
    for (let k = i; k < text.length; k++) {
      if (text[k] === "(") depth++;
      else if (text[k] === ")" && --depth === 1) return text[k + 1] === ")";
    }
    return false;
  };
  const wordAt = (i, word) =>
    text.startsWith(word, i) && (i + word.length === text.length || WORD_END.test(text[i + word.length]));
  const matchAt = (pattern, i) => {
    pattern.lastIndex = i;
    return pattern.exec(text)?.[0];
  };
  // Arithmetic holds no command, so its frame has no index.
  const push = (kind) => {
    const at = kind === "arithmetic" || kind === "arithmetic-command" ? null : 0;
    frames.push(frameOf(kind, at, quote === '"'));
    quote = "";
    if (at !== null) next();
  };
  const pop = () => {
    const frame = frames.pop();
    if (frame.quoted) quote = '"';
    wordStart = false;
    if (frame.kind === "arithmetic-command") {
      ended(frames.at(-1));
      wordStart = true;
    }
  };
  // The reserved word or function definition at i, where a word starts in a
  // frame that holds commands: how many characters it takes, or 0 for none.
  // It updates the frame as the word does: a case's state, and whether a
  // command still starts after it.
  const reserved = (i, frame) => {
    if (frame.test) {
      if (wordAt(i, "]]")) frame.test = false;
      return 0;
    }
    const openCase = frame.cases.at(-1);
    const atDepth = openCase?.depth === frame.parens.length;
    if (atDepth && openCase.state === "pattern") {
      const closes = openCase.patternStart && wordAt(i, "esac");
      openCase.patternStart = false;
      if (!closes) return 0;
      frame.cases.pop();
      ended(frame);
      return 4;
    }
    if (atDepth && openCase.state === "word") {
      if (!wordAt(i, "in")) return 0;
      Object.assign(openCase, { state: "pattern", patternStart: true });
      return 2;
    }
    if (!frame.command) return 0;
    const prefix = COMMAND_PREFIXES.find((word) => wordAt(i, word)) ?? matchAt(TIME, i);
    if (prefix) return prefix.length;
    const end = COMPOUND_ENDS.find((word) => wordAt(i, word)) ?? (atDepth && openCase.state === "body" && wordAt(i, "esac") ? "esac" : "");
    if (end) {
      if (end === "esac") frame.cases.pop();
      ended(frame);
      return end.length;
    }
    if (wordAt(i, "[[")) {
      // A `[[` test runs no command up to its `]]`, though a `$(` in it does.
      ended(frame);
      frame.test = true;
      return 2;
    }
    if (wordAt(i, "case")) {
      frame.cases.push({ state: "word", depth: frame.parens.length, patternStart: false, extglob: 0 });
      ended(frame);
      return 4;
    }
    const loop = ["for", "select"].find((word) => wordAt(i, word));
    if (loop) {
      ended(frame);
      frame.arithmetic = true;
      return loop.length;
    }
    const definition = matchAt(FUNCTION, i);
    if (definition) return definition.length;
    frame.command = matchAt(SETTING_AT, i) !== undefined;
    return 0;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const after = text[i + 1];
    const frame = frames.at(-1);
    if (char === HEREDOC_MARK) {
      found.push(...heredocCommands(bodies.shift()));
      continue;
    }
    if (!quote && wordStart && frame.braces === 0 && frame.at !== null && !NOT_A_WORD.test(char)) {
      const taken = reserved(i, frame);
      if (taken) {
        i += taken - 1;
        wordStart = true;
        continue;
      }
    }
    const openCase = frame.cases.at(-1);
    const pattern = inPattern(frame);
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
    } else if (char === "`") {
      if (!quote && frame.kind === "backtick") pop();
      else push("backtick");
    } else if (char === "$" && after === "(") {
      i++;
      push(text[i + 1] === "(" ? "arithmetic" : "substitution");
    } else if (quote === '"') {
      if (char === '"' && frame.kind !== "heredoc") quote = "";
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
    } else if (frame.test && /[&|()<>\n]/.test(char)) {
      // A test's operators and grouping split no command.
      wordStart = true;
    } else if (pattern && (char === "(" || char === ")" || char === "|")) {
      // A pattern's own leading `(` is dropped; an extglob's pairs with its `)`.
      if (char === "(" && !openCase.patternStart) openCase.extglob++;
      openCase.patternStart = false;
      if (char === ")" && openCase.extglob > 0) openCase.extglob--;
      else if (char === ")") {
        openCase.state = "body";
        next();
      }
    } else if (frame.parens.at(-1) === "array" && char !== ")") {
      // An array's words, as in `a=(x y)`, are no commands, on any line.
      wordStart = /\s/.test(char);
    } else if (char === "(" && /[<>]/.test(text[i - 1]) && frame.at !== null) {
      // A process substitution, `<(…)` or `>(…)`, runs a command as `$(` does.
      push("substitution");
    } else if (char === "(" && wordStart && frame.at !== null && after === "(" && (frame.command || frame.arithmetic) && closesAsArithmetic(i)) {
      push("arithmetic-command");
    } else if (char === "(") {
      const subshell = wordStart && frame.command && frame.at !== null;
      frame.parens.push(subshell ? "subshell" : text[i - 1] === "=" ? "array" : "word");
      if (!subshell) add(char);
      frame.command = subshell;
      wordStart = true;
    } else if (char === ")" && frame.parens.length > 0) {
      if (frame.parens.pop() === "subshell") {
        next();
        ended(frame);
      } else add(char);
      wordStart = true;
    } else if (char === ")" && frames.length > 1 && frame.kind !== "backtick") {
      pop();
    } else if (char === "|" && text[i - 1] === ">" && /(?:^|[^\\])(?:\\\\)*>$/.test(text.slice(0, i))) {
      // A `>|` redirect's `|` splits no command, unless its `>` is escaped.
      add(char);
    } else if ((char === "&" && after === "&") || (char === "|" && after === "|")) {
      i++;
      next();
    } else if (char === "&" && !/[<>]/.test(text[i - 1]) && after !== ">") {
      next();
    } else if (char === ";" || char === "|" || char === "\n") {
      const endsBody = char === ";" && (after === ";" || after === "&");
      if (endsBody && openCase?.state === "body" && openCase.depth === frame.parens.length) {
        // The whole `;;`, `;&` or `;;&` ends the body.
        i += after === ";" && text[i + 2] === "&" ? 2 : 1;
        Object.assign(openCase, { state: "pattern", patternStart: true });
      } else if (char === "|" && after === "&") i++;
      next();
    } else {
      add(char);
      wordStart = /\s/.test(char);
    }
  }
  return { found, closed: frames.length === 1 && quote === (heredoc ? '"' : "") && frames[0].braces === 0 };
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
 * A `(` or `)` around a command's first word is dropped. A command `env`
 * runs comes after it, past its options and settings: `env -u HOME X=1 gh pr
 * view` gives `env -u HOME X=1 gh pr view` and `gh pr view`.
 */
function commands(line) {
  const command = (words) => {
    const start = words.findIndex((word) => !SETTING.test(word));
    if (start < 0) return [];
    const [first, ...rest] = words.slice(start);
    const name = first.replace(/^\(+|\)+$/g, "");
    if (basename(name) !== "env") return [name ? [name, ...rest] : rest];
    let run = 0;
    while (run < rest.length && rest[run].startsWith("-")) {
      run += ENV_VALUE_OPTIONS.has(rest[run]) || ENV_VALUE_FLAGS.test(rest[run]) ? 2 : 1;
    }
    return [[name, ...rest], ...(run < rest.length ? command(rest.slice(run)) : [])];
  };
  return commandTexts(line)
    .flatMap((part) => command(shellWords(part).filter(Boolean)))
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
