/**
 * MQ-353 — read what a shell line runs: the command-line tools it calls, and
 * any repo skill whose own script it runs. Both harnesses use it: a Claude
 * Code `Bash` call and a Codex command each carry one shell line.
 *
 * In plain words: `cd /repo && FOO=1 gh pr view 12` runs two commands, `cd`
 * and `gh`, so it reads as two uses:
 *
 *   { kind: "cli", name: "cd" }, { kind: "cli", name: "gh" }
 *
 * - a cli: the first word of each command. The line is split at `&&`, `||`,
 *   `;`, `|` and newlines, leading `NAME=value` settings are skipped, a
 *   leading `$(` or `(` starts the command (`PR=$(gh pr view)`), and text is
 *   never a command: heredoc bodies are dropped, and quoted text holding a
 *   separator is blanked;
 * - a skill-script: a command that runs a file in a repo skill's own
 *   `.agents/skills/<skill>/scripts/` or `.claude/skills/<skill>/scripts/`
 *   folder, as its first word or after `bash`, `sh`, `node` or `python`.
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
/** A file in a repo skill's own scripts folder; the group is the skill's name. */
const SKILL_SCRIPT = /(?:^|\/)\.(?:agents|claude)\/skills\/([^/]+)\/scripts\//;
/** A leading `NAME=value` setting, and one whose value opens a `$(` command. */
const SETTING = /^[A-Za-z_]\w*=/;
const SUBSHELL_SETTING = /^[A-Za-z_]\w*=\$\(/;
/** A heredoc: its opening line, kept as group 3, then its body up to its terminator. */
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n\s*\2(?=\s*(?:\n|$))/g;

/** A shell line with its heredoc bodies dropped and quoted text holding a separator blanked. */
function withoutText(line) {
  return line
    .replace(HEREDOC, "$3")
    .replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, (quoted) => (/[|;&\n]/.test(quoted) ? "''" : quoted));
}

/**
 * The commands a shell line runs, as words with leading `NAME=value` settings
 * skipped: `cd /repo && FOO=1 gh pr view` gives `cd /repo` and `gh pr view`.
 * A leading `$(` or `(`, after any settings, starts the command:
 * `PR=$(gh pr view)` and `(gh pr view)` both give `gh pr view)`.
 */
function commands(line) {
  return withoutText(line)
    .split(/&&|\|\||[;|\n]/)
    .map((part) =>
      part
        .trim()
        .split(/\s+/)
        .map((word) => word.replace(/^["']|["']$/g, ""))
        .filter(Boolean),
    )
    .map((words) => {
      const start = words.findIndex((word) => !SETTING.test(word) || SUBSHELL_SETTING.test(word));
      if (start < 0) return [];
      const [first, ...rest] = words.slice(start);
      const command = first.replace(SETTING, "").replace(/^\$?\(+/, "");
      return command ? [command, ...rest] : rest;
    })
    .filter((words) => words.length > 0);
}

/**
 * What a shell line shows was used: each command's first word as a CLI, and
 * a repo skill whose own script a command runs.
 */
export function shellUses(line) {
  return commands(line).flatMap(([first, second]) => {
    const script = INTERPRETERS.has(basename(first)) ? second : first;
    const skill = SKILL_SCRIPT.exec(script ?? "");
    const uses = [{ kind: "cli", name: first }];
    return skill ? [...uses, { kind: "skill-script", name: skill[1] }] : uses;
  });
}
