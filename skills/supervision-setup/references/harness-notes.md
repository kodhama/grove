# Harness notes

What setup needs to know about each harness: where its catalog is, how each
kind of performer is invoked, where the session's transcript and context
window come from, and the known traps. Read the section for your harness
before the check.

Every claim here is **observed**, with the version and date it was seen on
(or the date alone where the version was not recorded), or marked
**unknown**. Check an unknown before relying on it, and when you
observe something new, add it here with its version and date.

## Claude Code

**The catalog** (observed on 2.1.284, 2026-09-28):

- **Skills** are in the session's skill listing, one per line as
  `- <name>: <description>`. A plugin skill's name is `<plugin>:<skill>`, as in
  `compound-engineering:ce-work`; a repo or user skill's name is bare. Built-in
  skills such as `code-review` are listed the same way.
- **Tools** are the session's tool list, plus the **deferred tools**, which are
  listed by name only. A deferred tool is available: load its schema with
  `ToolSearch` and the query `select:<name>` before its first call.
- **MCP tools** are named `mcp__<server>__<tool>`, as in
  `mcp__claude_ai_Linear__save_comment`. A claude.ai connector's server is
  `claude_ai_<Name>`, and a plugin's is `plugin_<plugin>_<server>`. They are
  usually deferred.
- **Agent types** are listed in the Agent tool's description, as
  `- <type>: <description>`. A plugin agent's type is `<plugin>:<agent>`.
- **CLIs** are whatever `command -v <name>` resolves to an absolute path from
  the Bash tool. A builtin or a shell function prints no path, and does not
  count.

**Invoking each kind:** a skill through the Skill tool with its native id; a
tool by calling it, after `ToolSearch` when it is deferred; an agent through
the Agent tool with its type as `subagent_type`; a CLI from the Bash tool.

**Plugins.** `claude plugin list --json` gives each plugin's `id`, `version`,
`scope` and, for project scope, `projectPath`. One plugin can be listed many
times, once per scope and per project. The entry in force for this checkout is
the project entry whose `projectPath` is this checkout, or else the user
entry. Use it for a binding's `source` only: the skill listing, not this list,
says what the session can invoke (observed on 2.1.284, 2026-09-28).
`claude plugin install` writes to user scope by default, so one install covers
every checkout on the machine; `--scope project` narrows it to one
([plugins reference](https://code.claude.com/docs/en/plugins-reference.md)).
That a plugin installed while a session runs does not reach that session is
**unknown** here, not observed: start a new session after an install.
Related, and **reported, not re-observed**: a `/clear` did not reload plugin
skills, so a session that was running when a plugin was installed still lacked
its skills after an in-place restart (a lead session, 2026-10-07).

**Marked copies.** The kodhama CLI installs a tool's skills as bare folders
and writes `.kodhama-skill.json` into each: a JSON object whose `tool` names
the tool, beside `skill`, `tag` and `commit` (read in the CLI's source at
kodhama/stewards 8c3c4d1, 2026-10-27; not yet observed on an installed
machine). On Claude Code a bare skill can be listed from the user folder
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/<name>/` or from
`.claude/skills/<name>/` at the repo's root, as `git rev-parse --show-toplevel`
prints it; which one wins when both exist is **unknown**, so setup probes
every one of them that exists, and a clash with no line stands. One probe line per folder:
`printf 'marker %s: %s\n' "$d" "$(cat "$d/.kodhama-skill.json" 2>/dev/null | tr -d '\n')" >> <file>`,
with `$d` the folder. A folder with no marker prints nothing after the colon,
and the clash stands. The receipt check reads a script as its skill's only
under a folder named `.claude/skills` or `.agents/skills`, so a bare copy
under a `CLAUDE_CONFIG_DIR` named otherwise earns its scripts no credit.

**A plugin's folder carries its version, and an update leaves the old one for
14 days.** A plugin installs to `cache/<marketplace>/<plugin>/<version>/`, and
no path stays the same across versions. On an update, Claude Code writes
`.orphaned_at` into the old folder and "removes that directory in a
background cleanup 14 days later, so a session that already loaded the old
version keeps running" (verified in the
[plugin loading docs](https://code.claude.com/docs/en/plugins/loading.md),
2026-10-08). The cache agreed: one plugin that auto-updated 13 times since
2026-09-24 still held all 13 folders, and each running session lists its pid
under `.in_use/` in the version it loaded (observed on 2.1.293, 2026-10-08).
So a table path recorded at setup can name an older copy for 14 days, then
nothing. Setup reads a seeded run's table beside the skill it loaded, and the
receipt check reads a missing table beside itself.

**A plugin's root reaches skill text, not the shell.** `${CLAUDE_PLUGIN_ROOT}`
and `${CLAUDE_SKILL_DIR}` are substituted in a skill's Markdown and in its
`allowed-tools` Bash rules, but "the variables aren't present in the
environment of commands Claude runs through the Bash tool" (verified in the
[plugins reference](https://code.claude.com/docs/en/plugins-reference.md) and
[skills docs](https://code.claude.com/docs/en/skills.md), 2026-10-08). A loaded
skill also opens with `Base directory for this skill: <path>` (observed on
2.1.293, 2026-10-08).

**The cheap check.** Start it with the Agent tool, `model: "haiku"`, and the
`general-purpose` type, which can read the check prompt file. A subagent sees a
different tool set from its parent, so it matches
against the snapshot and probe lines in that file, never its own tools. One
Haiku run of 2026-09-28 put the logical name in `match` instead of the native
id, so take the native id from the confirmed evidence line.

**Version, model and window.** `claude --version` prints
`<version> (Claude Code)`. The session's model id is in its system prompt. A
`[1m]` suffix on the id means a 1,000,000-token window. The transcript
carries no window size, so setup records it (observed on 2.1.284, 2026-09-28).
Without the suffix, no window is known: record `null`, and measuring binds as
unavailable (maintainer, 2026-09-29).

**Superseded narrowly on 2026-10-08** (maintainer): an id without the suffix
gets a window when a real source gives one, and keeps `null` where none does.
Only the "without the suffix" rule changed: the suffix still means 1,000,000
unless 1M context is turned off, and a window is still never guessed. Run
`node "<supervision-setup's folder>/scripts/model-window.mjs" <model id>`
from the Bash tool and record the `context_window` and `evidence` it prints.
It reads `references/claude-code-windows.json`, a table of model ids quoted
from Claude Code's docs (or Anthropic's model docs, where Claude Code's do
not name the model) with the page and the date each was checked, and the
variables that change the window: `CLAUDE_CODE_DISABLE_1M_CONTEXT`, and
`CLAUDE_CODE_MAX_CONTEXT_TOKENS`, which leaves an id whose model has a row,
`[1m]` or not, its window until `DISABLE_COMPACT` is also set. An id with no row prints a `null` window
and says why; add the row from the docs, never by the model's family. Exit 2
means the table itself could not be read: a broken install, not an unknown
id, so tell the maintainer. Claude
Code reports the window itself only to a status line command, which a session
cannot read (`context_window.context_window_size` in its input; observed on
2.1.293, 2026-10-08). Plain `claude-opus-5-5` sessions on the maintainer's
machine ran past 200,000 tokens up to 962,756, which agrees with the docs
(2026-10-08).

**The session's name** is its `-n` name. Read it from `ListAgents`, or from
the transcript's `agent-name` record, `{"type":"agent-name","agentName":"<name>",...}`
(observed on 2.1.284, 2026-09-28).

**The transcript.** `CLAUDE_CODE_SESSION_ID` is the session id, and the
transcript is `<projects>/<project-dir>/<session id>.jsonl`, where
`<projects>` is `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects`. After a
`/clear`, the variable and the file name both follow the new session id
(observed on 2.1.283, 2026-09-27). `<project-dir>` follows the worktree the
session is in, not the one it was launched in: after entering another
worktree, the transcript and its subagents are written under that worktree's
project folder. Record the path where the file is, as
`ls <projects>/*/<session id>.jsonl` shows it. When a listed path is
stale anyway, the receipt check finds the session by its exact id in the
other project folders, and reads its subagents from every folder's
`<session id>/subagents/` (observed on 2.1.289, 2026-10-04). It searches
only when the listed path is under `<projects>` as the checking session
resolves it, and when two other folders hold the id it reads neither and
reports the session missing.

**Subagents and forks.** A subagent's transcript is
`<session id>/subagents/agent-<id>.jsonl`, beside the session's, with an
`agent-<id>.meta.json` sidecar. A fork's sidecar has `isFork` set to true and
`agentType` set to `fork`, and the receipt check reads either as a fork. A
fork carries its parent's context, so it is only as fresh as its parent: the
subagent its `parentAgentId` names, or else the main session, which is never
fresh. A subagent whose sidecar marks no fork is fresh, and one with no
sidecar is not. The receipt check credits an operation the table marks
`fresh_context = true` only from a fresh subagent, so start a reviewer as a
fresh subagent, never a fork (observed 2026-10-04; the version was not
recorded).

**A call that did not run.** Each call's `tool_result`, paired with it by
`tool_use_id`, says whether it ran. A result with `is_error` set to true, such
as a `<tool_use_error>` or a denied permission, means the call was refused,
and the receipt check does not count it as a use. A Bash command that exits
non-zero also gets `is_error` set to true, with text starting `Exit code N`,
but the command ran, so it counts, unless N is 126 or 127: the shell could not
run the command (observed 2026-10-04; the version was not recorded). A
command the shell could not parse is not counted, whatever N is: its result
reads `Exit code 1` then a line starting with zsh's own `(eval):1: parse
error near ...`, or `(eval):1: unmatched "` for an unclosed quote (observed
on Claude Code 2.1.296, 2026-10-10), or `(eval):2: closing brace expected`
for an unclosed `${`, or `(eval):3: condition expected: a` for the
three-word test `[[ x a y ]]` on the call's third line (both zsh 5.9,
2026-10-11). A two-word test, `[[ a b ]]`, prints `(eval):N: parse error:
condition expected: a` instead (zsh 5.9, 2026-10-12). zsh leaves the line
number out of some
parse errors, as ``(eval): parse error near `()'`` for a `name()` with
nothing after it (observed on Claude Code 2.1.296, 2026-10-11), or
``(eval): parse error near `)'`` then `(eval): unmatched "` where that sits
inside a quoted `$(...)` (zsh 5.9, 2026-10-11), or `(eval): closing brace
expected` for an unclosed `${` in a function body written without braces
(observed on Claude Code 2.1.296, 2026-10-11). `condition expected` comes
without one too: `f() [[ a b c ]]` prints `(eval): condition expected: b`
(zsh 5.9, 2026-10-12), and `f() [[ a b ]]` prints `(eval): parse error:
condition expected: a` (zsh 5.9, 2026-10-11). The check reads each of its
five wordings with the number or without: these four, and `unknown
condition`, below, which is no parse error. Usually nothing in the line ran,
but zsh parses a `$(...)` or backtick substitution only when it reaches it,
so the commands before one that will not parse have run: such a call loses
its credit, the safe direction. Bash's own `bash: eval: line N: syntax
error` is read the same way, with or without the path bash was started by
(`/bin/bash: eval: ...`), and so is `bash: eval: line N: unexpected EOF while
looking for matching`, bash's line for an unclosed quote: bash 3.2.57 follows
it with a `syntax error` line, and the bash on GitHub's `ubuntu-latest`
runner prints it alone, with exit 2. Both wordings were read from a real
`/bin/bash` (2026-10-11), not from a Claude Code session on bash, which was
not observed. Bash's `eval` runs the complete lines before its error, so a call
read that way may have run some. A nested shell's error, such as `bash: -c:
line 1: syntax error` or `/bin/bash: -c: ...`, or a tool's own, such as `rg:
regex parse error`, still counts: the line ran.

The fifth wording the check reads that way is no parse error. `unknown
condition` is a runtime error: `[[ -z ]]` parses, and zsh stops when it runs
it, with `Exit code 2` and `(eval):N: unknown condition: -z`, or `zsh:N:
unknown condition: -z` from a `zsh -c`, the form Codex shows (both zsh 5.9,
2026-10-12).
Other tests are worded the same: `[[ -n ]]`, `[[ -zz a ]]` and
`[[ a -foo b ]]` print `unknown condition: -n`, `-zz` and `-foo`. The
commands before it ran. At the top level the ones after it never do, on its
line whether a `;`, an `&&`, an `||` or an `if` joins them, or on a later
line of the call, and that is why the call reads as not run: it loses the
credit its earlier commands earned, the safe direction.
Inside a subshell, a `$(...)`, a background job or a pipeline's stage before
the last, the error stops only that part and the call carries on. Its result
still holds the line, so it loses its credit too where the result is flagged
as an error or starts with that line. The wording came without a line
number only from a shell reading its script from standard input (`zsh:
unknown condition: -z`). Two lines the check does not read. zsh's `[` names itself
in the same complaint (`(eval):[:1: unknown condition: -z`) and carries on,
so that call rightly keeps its credit. Inside a function zsh names the
function instead (`f: unknown condition: -z`, `(anon): unknown condition:
-z`) and stops the list the same way, so the commands after it keep a credit
they did not earn, the unsafe direction (all zsh 5.9, 2026-10-12).

Three more calls lose a credit they earned, since the check cannot tell
their line from the shell's own: one whose nested `eval` printed the same
`(eval):` prefix, with a line number (`(eval):N:`) or without, one whose
command printed such a line itself, and one
where zsh's `[` or `test` worded a runtime complaint that way (`(eval):1:
parse error: condition expected: =`, `(eval):1: condition expected: b`) and
the call carried on (zsh 5.9, 2026-10-11). A nested `zsh -c` names itself
`zsh:N:`, or a bare `zsh:` where zsh gives no number, so on Claude Code its
error keeps the credit; on Codex that is the top-level prefix, and there it
is the nested `zsh -c` that loses it.

Where Claude Code reads the exit as benign, as for a `grep` that exits 1, it
leaves `is_error` off and the result is the bare error, which the check reads
the same way when the result starts with it (observed on 2.1.296,
2026-10-11). It reads only the first line of an unflagged result, which
leaves a known false credit: `echo a; grep x f $(if)` prints `a`, stops at
the substitution and exits 1 with the flag off, and `grep` is counted though
it never ran (observed on 2.1.296, 2026-10-11). Reading every line was not
worth it. In the local transcripts read that day, the only real calls that
showed the error on a later line of an unflagged result, two of them, had
carried on: an unquoted here-document held a backtick span zsh could not
parse, so zsh skipped that one command and ran the ones after it. Both
would have lost the credit their other commands earned. The first-line read
takes that credit all the same where such a here-document sits in the
line's first command: the error is then the first line, the commands after
it ran, and the call reads as not run, the safe direction (a here-document
in a `$(...)` holding `` `name()` ``, then an `echo` that ran; observed on
2.1.296, 2026-10-11). Where the here-document sits inside a `$(...)`, the
command holding that substitution runs as well, with an empty value in its
place, so a call read as not run may already have had its effect with a
blank argument: check what it did before repeating it (a `printf` of such a
`$(...)`, redirected to a file, wrote `[]` there before the `echo` ran; zsh
5.9, 2026-10-11). A here-document straight on a command is different: zsh
skips that command and writes nothing.

A call run in the background keeps its credit as well, whatever the shell
made of its line: its result is the notice that it started, and a parse
error goes only to the output file the notice names (observed on 2.1.296,
2026-10-11).

**A line that only defines functions.** zsh reads every word before an
unquoted `()` as one more function name, past a command's first word too:
`gh pr view 12 name() more words` defines `gh`, `pr`, `view`, `12` and `name`
with the body `more words`, exits 0, prints nothing and runs no command (zsh
5.9, 2026-10-12). Nothing in the result says so, so the receipt check reads
it from the line: it credits none of the words before the `()`, and reads
the body as it reads any function's, called or not. A `$(...)` among those
words still runs, and is credited. A `name=()` past a command's first word
is one of two things to zsh. After `declare`, `export`, `local`, `readonly`
or `typeset` it is an array: `local arr=() gh` declares `arr` and a variable
`gh`. After anything else it is one more definition: `touch e13 a=() b`
defines `touch`, `e13` and `a=`. Neither runs the command's first word or
the word after the `()`, and the check does not always know which word
comes first, so it reads both the same: it drops the command's words and
reads nothing more up to the next separator. `float` and `integer` refuse
the array (`arr: inconsistent type for assignment`, exit 1) and define
nothing either; the refusal stops the rest of the call, its later lines
too, whose commands keep a credit they did not earn, as `gh` does in `float
arr=(); gh pr view 1`, the unsafe direction (zsh 5.9, 2026-10-12). Bash
rejects a line that defines functions so with a `syntax error`, which the
check reads as not run. Nine neighbours the check does not read as zsh
does (zsh 5.9, 2026-10-12):

- **Unsafe: a name the line defines shadows the CLI for the rest of the
  call.** After `touch x() true; touch e2` the second `touch` is the
  function, and no `touch` ran, yet it is counted. A plain `gh() {…}; gh …`
  is counted the same way.
- **Unsafe, and rare: `name( )`, with a blank inside the parens after other
  words.** zsh reads no definition there: it stops with `(eval):1: unknown
  file attribute:  ` and exit 1, having run nothing. The check does not read
  that wording, and reads the line as a definition, so the body's command
  is counted.
- **Unsafe: a body that is never called is counted,** and the body can be
  the next line's command. `gh pr view 12 name()` with `gh pr list` on the
  line after it defines five functions whose body is `gh pr list`, exits 0
  and runs nothing, yet the check counts that second `gh`: it reads a
  function's body whether or not anything calls it.
- **Safe: an anonymous function.** `() { cmd }` and `() cmd` run `cmd`, and
  the check credits nothing.
- **Safe: a declaration word is not counted.** `local arr=(); gh pr view 1`
  reads `gh` alone, though `local` ran.
- **Safe: a definition by `name=()` has no body read.** `touch e13 a=() b`
  reads nothing, where the plain `touch e13 a() b` reads `b`.
- **Safe: a body after a `name=()` is missed when another of the line's
  names calls it.** `x a=() { touch p4 }; x` defines `a=` and `x`, then runs
  `touch` through `x`, and the check reads `x` alone.
- **Safe: a second leading array setting hides its command.** `a=() b=()
  touch x` sets two arrays and runs `touch`, and the check reads nothing;
  after one array, or after a plain setting (`a=1 b=() touch x`), it reads
  `touch`.
- **Both directions: `function a b { … }`.** zsh defines both names and runs
  nothing; the check counts `b` as a command, and misses the body's commands
  when `b` is called.

**Starting a cloud session.** `claude --cloud "<prompt>"` needs an interactive
terminal. From the Bash tool it fails with `Error: --cloud requires an
interactive terminal.` It works when typed into a terminal pane, such as
`herdr pane run <pane> "claude --cloud \"<prompt>\""`, so a local lead starts a
cloud worker through herdr. Inside a cloud session it fails the same way, no
routine trigger tool is available, and no other way to start a session was
found (observed on 2.1.283, 2026-09-27).

**Messaging from a cloud session.** A cloud session's `ListAgents` showed no
peers, and SendMessage to a local session returned `success:false`. A local
session's message to a cloud session was delivered. The cloud session tried
had no claude.ai connectors (observed on 2.1.283, 2026-09-27).

**Naming.** A session other sessions must reach launches with
`-n <role-name>`, which pins its cross-session address; `--help` says only
"Set a display name for this session". This was verified in two probes, alone
and beside `--remote-control`, on 2.1.280 (2026-09-23). A Remote Control name
alone does not pin it: a session launched with only `--remote-control` got a
generated address. A successor launched with the same `-n` while its
predecessor was live got the name as its own address, and kept it once the
predecessor closed: **observed once** (2026-09-23). The
successor could not read its own launch flags, and routing while both sessions
are live is untested.

**Resuming and cost.** Headless JSON output "includes `total_cost_usd` and a
per-model cost breakdown", documented as "client-side estimates", so a
receipt's usage line says so. `--resume <id>` finds a session "in any project
on this machine" since v2.1.223 (both documented, and verified 2026-09-20; the
version read then was not recorded).

**Settings precedence** runs managed, then command line, then project local
(`.claude/settings.local.json`), then shared project (`.claude/settings.json`),
then user ([settings](https://code.claude.com/docs/en/settings#settings-precedence)).

**A present reviewer whose cross-model lens cannot start.** Compound
Engineering's `ce-code-review` binds by check, but its Codex lens cannot run
from Claude Code's sandboxed Bash. The lens runs `codex exec ... -s read-only`,
which needs a nested Seatbelt sandbox, and inside Claude Code's sandbox
`sandbox-exec` answers `Operation not permitted` (exit 71). Codex also writes
under `~/.codex`, outside the sandbox's write allowlist. The review still runs
and reports the lens as not run; it does not fail. To skip the lens on
purpose, set `cross_model_review_mode: off` in the worktree's gitignored
`.compound-engineering/config.local.yaml`. A pull request's own cross-model
reviewer still gives the change a review from another model family (observed
on Claude Code 2.1.288, compound-engineering 3.27.0 and codex-cli 0.155.1,
2026-10-03).

## Codex

- **An app connector's MCP tool** is recorded in the rollout as an
  `item_completed` item of type `McpToolCall`, with `server` (`codex_apps`)
  and `tool` (`<tracker>.save_comment`). The receipt check reads it as
  `mcp__codex_apps__<tracker>_save_comment` (observed in rollouts of
  2026-09-19 and later). By the check's last-`__` rule that name gives
  `<tracker>_save_comment`, not `save_comment`, so a work-note tool suggested
  as `save_comment` goes to discovery on Codex. The first Codex setup bound it
  by check all the same, which the rule does not allow (observed on codex-cli
  0.160.0, 2026-10-03). The item counts as a use only with
  `status: "completed"`: a refused call has `status: "failed"`, and the check
  does not credit it (refused `<tracker>.save_comment` calls, codex-cli 0.160.0,
  2026-10-03).
- **A command the shell could not parse** is most often a `CommandExecution`
  with `status: "failed"` and `exit_code` 1, whose `stdout` holds zsh's own
  `zsh:1: parse error near ...` or, for an unclosed quote, `zsh:1: unmatched
  "`; its `stderr` is empty, as it is on every
  command item (observed on codex-cli 0.154.0, 2026-09-17). zsh's `zsh:2:
  closing brace expected`, for an unclosed `${`, and `zsh:3: condition
  expected: a`, for the three-word test `[[ x a y ]]` on the command's third
  line, are read the same way; a two-word test, `[[ a b ]]`, prints `zsh:N:
  parse error: condition expected: a` instead. The receipt
  check does not credit the call. Usually nothing in it ran, but the
  commands before a `$(...)` that will not parse have, as on Claude Code
  (the last two wordings and the `$(...)` case were read from `zsh -c` on
  zsh 5.9, 2026-10-11, and the two-word test on 2026-10-12, not from a Codex
  rollout). zsh prints some parse
  errors with no line number, as ``zsh: parse error near `()'``, or `zsh:
  unmatched "` after one inside a quoted `$(...)`, or `zsh: closing brace
  expected`, and the check reads each wording with the number or without
  (zsh 5.9, 2026-10-11, not from a Codex rollout). The fifth wording read
  the same way is no parse error: `zsh:N: unknown condition: -z` is
  the runtime error `[[ -z ]]` stops with, with exit code 2. The commands
  before it ran, and the ones after it in the same list never do, so the
  call loses the credit its earlier commands earned, the safe direction. It
  came with no number only from a shell reading its script from standard
  input, as `zsh: unknown condition: -z`. Inside a function zsh names the
  function instead (`f: unknown condition: -z`), which the check does not
  read: the commands after it keep a credit they did not earn, the unsafe
  direction (read from `zsh -c` and `zsh -lc` on zsh 5.9, 2026-10-12, not
  from a Codex rollout). The item can be
  `completed` instead. Where zsh
  could not parse part of a line and the line still exited 0, as when that
  part sits in an early stage of a pipeline, an `rg ... | head` came back
  `completed` with `exit_code` 0, an empty `stderr` and a `stdout` starting
  `zsh:1: unmatched "` then `zsh:1: parse error in command substitution`,
  and `rg` never ran (observed on codex-cli 0.155.1, in a rollout of
  2026-09-27). The check reads a `completed` command whose output starts
  with zsh's error as not run, and credits nothing in it. A `SKILL.md` read
  in such a command follows it, so the skill is not read as loaded: `cat
  <skill>/SKILL.md "$(if)" | head -5` exits 0 with the error first and
  never reads the file (read from `zsh -c` on zsh 5.9, 2026-10-11; never
  observed in a Codex rollout). The check reads only the first line of a
  `completed` command, which cuts both ways. The stages that did run, such as
  that `head`, lose their credit, the safe direction, and so does a line
  that carried on after a nested `zsh -c` printed the error first, or after
  an unquoted here-document in its first command held a backtick span zsh
  could not parse, or after zsh's `[` or `test` worded a runtime complaint
  that way (`[ a = ]; echo carried` prints `zsh:1: parse error: condition
  expected: a`, then `carried`, and exits 0), or after an `unknown
  condition` inside a subshell, a `$(...)`, a background job or a pipeline's
  stage before the last (`( [[ -z ]] ); echo carried` prints `zsh:1: unknown
  condition: -z`, then `carried`, and exits 0), and one whose first command
  printed such a line itself. zsh's `[` names itself in that complaint
  (`zsh:[:1: unknown condition: -z`), which the check does not read, so a
  line that carried on past it keeps its credit. A
  `completed` command that shows the error only on a later line keeps its
  credit, as an unflagged result does on Claude Code: `echo a; cat f
  "$(if)" | wc -l` prints `a`, then the error, exits 0, and `cat` is counted
  though it never ran (the nested, here-document, `[` and later-line cases
  were read from `zsh -c` on zsh 5.9, 2026-10-11, and the `unknown
  condition` ones on 2026-10-12, not from a Codex rollout).
- **A line that only defines functions** reads as on Claude Code: zsh takes
  every word before an unquoted `()` as one more function name, so `gh pr
  view 12 name() more words` exits 0, prints nothing and runs no command,
  and the check credits none of the words before the `()`. The same nine
  neighbours apply (read from `zsh -c` on zsh 5.9, 2026-10-12, not from a
  Codex rollout).
- **A namespaced tool call** is a `function_call` with a `namespace`: setup
  records `spawn_agent` in namespace `collaboration` as
  `collaboration.spawn_agent`, and the receipt check reads the call under that
  id (observed on codex-cli 0.160.0, 2026-10-03).
- **Review binds to the skill the reviewer runs, never to `spawn_agent`.**
  A spawn sits in the author's rollout, so it can never show a fresh context:
  with `review` bound to `collaboration.spawn_agent`, a simplify reviewer's
  spawn read as the review (codex-cli 0.160.0, 2026-10-03). The
  catalog there listed no single-pass review skill, only `ce-code-review` and
  `ce-doc-review`, so both review operations bind `ce-code-review`, and one
  reviewer's run credits both, each line reading `used (shared)`. The caller
  spawns the reviewer with `fork_turns: "none"` and has it invoke that
  skill. The child reads the skill's `SKILL.md`, and the check credits that
  read from the child's own rollout.
- **A child spawned with `fork_turns: "all"` is a fork**, not fresh: it
  inherits the author's whole context (seen on codex-cli 0.160.0,
  2026-10-03). A fork's first `session_meta` carries
  `forked_from_id`; a fork is only as fresh as the thread that started it, so
  a fork of the author never counts as a review (observed in rollouts of
  codex-cli 0.155 to 0.160, 2026-10-04).
- **In code mode every tool call is a `custom_tool_call` named `exec`**, and
  the tools it runs are named in its script, as `tools.apply_patch(...)`
  (observed in rollouts of codex-cli 0.155.1, 2026-10-03). The receipt check
  does not read the script: a call named only there gives no credit, since its
  branch may never run. A nested call that writes its own record, such as a
  `FileChange` item for a patch, is credited from that record.
- **Skills are dropped between turns** unless named again. A Codex rollout
  carries the instruction "Do not carry skills across turns unless
  re-mentioned", so a step names its bound performer in the turn that uses it
  (observed in rollouts of codex-cli 0.149.0, 2026-09-03, and 0.155.1).
- **The transcript** is the rollout file, and `CODEX_THREAD_ID` follows a
  `/clear` or `/new`, each of which starts a new rollout. The session id is
  `CODEX_THREAD_ID`, and its rollout is the one file matching
  `~/.codex/sessions/*/*/*/rollout-*-$CODEX_THREAD_ID.jsonl`: the name ends in
  the thread id, and its first `session_meta` record carries the same `id`.
  The date folders are in local time, so match across them rather than
  building today's path (observed 2026-09-29, on rollouts written
  2026-09-27). A `/clear` sent mid-turn is refused and dropped, while herdr
  reports success (observed on codex-cli 0.155.1, 2026-09-27).
- **The context window** is in the rollout: `model_context_window` (258,400 on
  the model tried), with `last_token_usage` in each `token_count` event
  (observed on codex-cli 0.155.1, 2026-09-27).
- **The catalog**, from the first Codex setup (codex-cli 0.160.0, 2026-10-03):
  skills come from the session's "Available skills" list, and tools
  from `ALL_TOOLS` plus the collaboration tools. There is no agent-type
  catalog. Two installs of one plugin list each of its skills twice, which is
  a clash, so every one of them goes to discovery on every setup. The session
  read its own name from `herdr agent get $HERDR_PANE_ID`. That setup's
  evidence paraphrased the catalog rather than quoting it.
- **Marked copies** are probed as on Claude Code, from the user folder
  `$HOME/.agents/skills/<name>/` and `.agents/skills/<name>/` at the repo's root,
  where the kodhama CLI installs for Codex (read in its source at
  kodhama/stewards 8c3c4d1, 2026-10-27). Whether Codex lists skills from any
  other folder is **unknown**, and so is whether its skills list names a
  plugin's skill `<plugin>:<name>`: where both entries read bare, the rule
  does not apply and the clash stands.
- **An update deletes the old version's folder at once.** A plugin installs
  to `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/`, and the
  update path removes every other version folder with no grace period
  (verified in openai/codex `codex-rs/core-plugins/src/store.rs`,
  `remove_old_plugin_versions`, 2026-10-08; the local cache held one version
  per plugin on codex-cli 0.160.0). A table path recorded at setup is gone
  after the first update, and so, inferred from the same code, are the
  skill text and scripts a running session loaded from that folder: such a
  session restarts as a new session, which loads the new version. The
  session's skills list gives each skill's file
  path (verified in the [skills docs](https://developers.openai.com/codex/skills.md),
  2026-10-08); whether a skill's text gets a root substitution is
  **unknown**.
- **Unknown:** whether a cheaper-model child can run the check (until one is
  found, the check runs in the session itself), headless output, resume, and
  usage reporting.

## herdr

Claude Code, Codex and Droid are all integrated at
`Integration role: session` with `State authority: screen manifest`, and
session-only integrations "can miss permission approval results, escape
interrupts, or other transitions" (verified 2026-09-20; the herdr version was
not recorded).

## Choosing a reviewer

**Choosing a reviewer trades independence against identity; it is not one
quality axis.** There are two separate mechanisms in compound-engineering
3.27.0, each with its own evidence:

- *A Claude host excludes any peer of its own serving family* from an
  independent panel. `cross-model-adversarial-review.sh:450` skips a candidate
  whose `target_serving_family` equals `HOST_PROVIDER`;
  `cross-model-pov.sh:436` logs `host $HOST_PROVIDER excluded`, and `:919`
  sets `independence=true` only where the families differ.
- *Only the `claude` route yields a model receipt.* `route_receipt_supported()`
  is `claude) true ;; *) false` (`cross-model-adversarial-review.sh:113`), and
  `extract_model_receipt()` sets `MODEL_ACTUAL="unverified"` then returns early
  on any route other than `claude` (`cross-model-pov.sh:158-160`; the same
  function at `cross-model-adversarial-review.sh:187`).

Together: every peer a Claude host could pick cannot prove which model served
it, and the one that could is excluded as not independent, which is why
"unverified" is normal *there*. Driving the peer's own CLI sidesteps this; its
run log names the model.

## Runners

A **runner** is an existing end-to-end driver a level may delegate a whole run
to: a story worker might hand its story to Compound Engineering's `lfg`, a
lead an epic to another end-to-end runner. These are examples only; the binding's
rationale records which was used.
