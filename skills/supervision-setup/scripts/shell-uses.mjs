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
 *   `;`, `|`, newlines and `$(`, which starts a command even inside double
 *   quotes (`PR="$(gh pr view)"`); leading `NAME=value` settings are skipped,
 *   a leading `(` starts the command, and text is never a command: heredoc
 *   bodies are dropped, and quoted text holding a separator is blanked. A
 *   quoted or escaped space stays inside its word, so
 *   `node "/Users/Jane Doe/x.mjs"` runs one script, not two words;
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
/** A leading `NAME=value` setting. */
const SETTING = /^[A-Za-z_]\w*=/;
/** What a backslash escapes inside double quotes; before anything else it stays. */
const DOUBLE_QUOTED_ESCAPES = new Set(["$", "`", '"', "\\", "\n"]);
/** A heredoc: its opening line, kept as group 3, then its body up to its terminator. */
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n\s*\2(?=\s*(?:\n|$))/g;

/**
 * A shell line with its heredoc bodies dropped and quoted text holding a
 * separator blanked. In single quotes `$(` is text too; in double quotes it
 * runs a command, so it stays.
 */
function withoutText(line) {
  return line
    .replace(HEREDOC, "$3")
    .replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, (quoted) =>
      /[|;&\n]/.test(quoted) || (quoted.startsWith("'") && quoted.includes("$(")) ? "''" : quoted,
    );
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
 * `$(` starts a command and a leading `(` opens one, and a command's own `)`
 * is dropped: `PR=$(gh pr view)` and `(gh pr view)` both give `gh pr view)`,
 * and `echo $(date)` gives `echo` and `date`.
 */
function commands(line) {
  return withoutText(line)
    .split(/&&|\|\||\$\(|[;|\n]/)
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
