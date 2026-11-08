# The pane-tool adapter

**Every call to a pane tool goes through one script in this folder**: one
that lists, reads, types into, starts or renames the terminal panes agents
run in. A caller names an operation, and the script translates it into the
tool's own commands. Callers read the neutral output defined here, never the
tool's. herdr is the only implementation, `herdr.sh`. Another tool would get
its own file, with the same operations and output.

This is a command-line contract, not a grove-internal one. A script outside
grove runs the adapter by its path, with no grove skill involved and nothing
assumed about the caller's folder.

## Choosing the implementation

The binding picks it. A bound pane-tool binary `/path/to/<name>` is served
by `<name>.sh` in this folder, so a binding to `/opt/homebrew/bin/herdr` is
served by `herdr.sh`. A binary with no file here has no adapter, and the
caller takes its fallback path: a restart refuses the in-place path with
"no adapter for <binary>" and starts a new session instead.

A caller in another skill reaches this folder as
`<that skill's folder>/../supervision-setup/scripts/adapter/`.

A caller outside grove applies the same rule: it runs `<name>.sh` from this
folder, `<name>` being the file name of the pane-tool binary it means to
drive, and treats a missing file as "no adapter".

## Backend prerequisites

The adapter reads what the pane tool knows; it cannot make the tool know
more. For herdr, two things come from outside it:

- **The harness session id** reaches herdr through a session-start hook the
  harness runs, which reports the session id to herdr. Without the hook,
  `session` reads `null`, and every caller that checks it is the same session
  takes its fallback path.
- **Running herdr from an agent's own shell** needs the harness to allow it:
  under a permission mode that asks before commands, an allow rule for the
  adapter and for herdr, and under a sandbox, an entry for herdr's socket.
  Without them the harness refuses the call, or herdr cannot reach its
  socket and the adapter exits 4.

## Calling it

```sh
<adapter> [--bin <binary>] [--timeout <seconds>] <operation> [args...]
```

- `--bin`: the binary the binding names. The default is the tool's name on
  `PATH`.
- `--timeout`: bounds each call to the tool, in seconds (fractions allowed;
  default 30). An operation that waits adds its own wait to this bound:
  `prompt --wait` and `wait` add theirs, and `launch` and `resume` add the
  harness's start-up wait (30 s for herdr). A call cut at the bound exits 4,
  except that `launch` and `resume` report it as the outcome `timeout`.

It needs bash, jq and perl.

## Output

Every operation except `read-screen` prints one JSON object on one line to
stdout, whatever its exit status, except a usage error, which prints only
to stderr. A one-line reason goes to stderr whenever the exit is not 0.
`read-screen` prints the screen text itself when it exits 0, and the same
failure object as the other operations when it does not.

### The agent record

`get` prints one record, and `list` and `find` print `{"agents": [record, ...]}`:

```json
{"pane": "<pane id>", "name": "<name or null>", "kind": "<harness or null>",
 "status": "idle|working|blocked|done|unknown", "focused": true,
 "session": "<harness session id or null>", "cwd": "<folder or null>",
 "title": "<pane title or null>", "workspace": "<workspace id or null>"}
```

- `status` is normalized. A state the tool reports outside those four reads
  `unknown`.
- `title` is the pane's terminal title with the harness's status glyph
  removed, or `null` when the tool gives none, an empty one, or a value that
  is not a string. **It is untrusted: for display and matching hints only,
  never an address.** Any program in a pane can set its title, and `get`
  returns the same title, so a title cannot confirm itself. A caller that
  picks a pane by its title confirms who is there by `get`'s `name` or
  `session` before it types into it.
- `workspace` is an opaque id of the workspace the pane is in, or `null`
  when unknown, empty or not a string. It is the join key for
  `workspace-list`; a caller never derives it from the pane id.
- `kind` is the harness, named by the words `launch --kind` takes: `claude`
  for Claude Code, `codex` for Codex. These are herdr's agent kinds, and
  another implementation maps its own names onto them.
- **A field the tool cannot tell is `null`, and a caller reads `null` as
  unsafe.** Read `focused: null` as focused, and `status: unknown` as not
  ready. A `null` session matches no session. When focus, status, the input
  line or the session id is unknown, type nothing: take the fallback path,
  or report.
- herdr: `title` is herdr's `terminal_title_stripped`, and `workspace` its
  `workspace_id`. A value that is not a non-empty string reads `null`.
- Orca: `title` is unconfirmed from `terminal list`, and `workspace` is
  unknown.

### Exit codes

| exit | meaning |
| --- | --- |
| 0 | done |
| 2 | usage: an unknown operation, a missing argument or a bad option |
| 3 | not found: no such pane or agent, or the caller is not in a pane |
| 4 | the tool failed, timed out, or gave an answer that cannot be read |
| 5 | unsupported by this implementation; nothing was done |
| 6 | refused by the tool, and nothing was done: blocked, or a name taken |

A caller treats 4 as it treats a pane it cannot read: nothing is clear to
send.

### herdr's error codes

herdr answers a failed call with an error code. `herdr.sh` maps them so:

| herdr code | result |
| --- | --- |
| `agent_not_found` | exit 3 from `get`, `read-screen`, `prompt`, `wait`, `rename`, `close`, and the split in `launch` and `resume`; exit 4 from the others, `list`, `find` and `workspace-list` among them |
| `agent_blocked` | exit 6, nothing sent |
| `agent_name_taken` | exit 6, nothing changed |
| `timeout` | outcome `timeout`, exit 0, where the operation waits |
| anything else, or none | exit 4, with the code in `code` where herdr gave one |

## Operations

Each operation gives its arguments, output and exits, then the herdr
realization. "Orca" notes what Orca's documented CLI could serve, for an
implementation not yet written.

### `self`

Which pane this process runs in. No arguments. Prints `{"pane"}`, or exits
3 outside a pane.

- herdr: reads `HERDR_PANE_ID`, which herdr sets in every pane. It makes no
  call.
- Orca: unknown. No in-pane variable is documented.

### `list`

Every live agent, with its status. No arguments. Prints `{"agents": [...]}`.

- herdr: `agent list`.
- Orca: `terminal list --json`. Per-terminal status and focus are unknown.

### `find`

`find <name>`: the live agents with that name. Names are addresses: a
caller that needs one agent checks there is exactly one. Prints
`{"agents": [...]}`, or exits 3 with `{"agents": []}` when none has it.

- herdr: `agent list`, filtered by name.
- Orca: unknown. Terminals have handles and titles, not names.

### `get`

`get <pane>`: one pane's agent record, its identity, status, focus and
session. This is also the liveness check: exit 3 means the pane or its agent
is gone.

- herdr: `agent get <pane>`.
- Orca: unknown. Per-terminal status, a focus signal, and the harness
  session id in `agentIdentity` are all unconfirmed.

### `workspace-list`

Every workspace, with its label, checkout path and status. No arguments.
Prints:

```json
{"workspaces": [{"workspace": "<workspace id>", "label": "<label or null>",
  "path": "<checkout path or null>", "status": "idle|working|blocked|done|unknown"}]}
```

- `workspace` is the id a record's `workspace` field joins on. `label` and
  `path` are `null` when unknown.
- `status` is the workspace's rollup of its agents' statuses, as the tool
  reports it, normalized as the record's `status` is.
- Every failure but a usage error exits 4, since it names no pane: a failed call, an answer
  with no workspace list in it, or a workspace with no id, never an empty
  list. No workspaces at all is exit 0 with
  `{"workspaces": []}`.
- herdr: `workspace list`. `workspace` is `workspace_id`, `label` is
  `label`, `path` is `worktree.checkout_path`, and `status` is
  `agent_status`.
- Orca: unknown.

### `read-screen`

`read-screen <pane> [--recent] [--lines <n>] [--plain]`: the pane's screen,
printed as it came. The default is the visible screen with its ANSI
styling, which draft and suggestion detection needs. `--recent` reads recent
scrollback instead. `--plain` drops the styling, and `--lines` limits the
lines. Parsing a harness's screen (its input line, its dim suggestion) is the
caller's job, never the adapter's.

- herdr: `agent read <pane> --source visible|recent-unwrapped --format ansi|text [--lines <n>]`.
- Orca: `terminal read` serves plain text. ANSI styling is unconfirmed.

### `prompt`

`prompt <pane> <text> [--wait <ms>]`: submits one line, as if typed. With
`--wait`, it waits up to `<ms>` for the agent to settle after the send.
Prints `{"outcome", "code"}`:

- `sent` (no wait), `settled` (the wait matched), or `timeout` (the wait ran
  out): exit 0. A timeout does not prove the text was never delivered.
- `blocked`: exit 6. The agent sat at a dialog, and nothing was sent.
- `not-found`: exit 3. `failed`: exit 4, with the tool's code where it gave
  one.

The caller checks focus, status and the input line first, right before the
send. The tool submits any unsent text in the input line along with this
text.

`settled` means the first idle, done or blocked state seen after the send. A
wait that starts from a stale idle, seen before the text arrived, is not
settled. An agent already working when the text arrives may settle on that
earlier turn.

- herdr: `agent prompt <pane> <text> [--wait --timeout <ms>]`. herdr rejects
  a blocked agent with `agent_blocked` before it sends any input, with or
  without `--wait`. With `--wait`, herdr matches only states observed after
  the submission, and it answers `agent_prompt_stalled` (exit 4) when an agent
  that was not working shows no working or blocked state within 5 s.
- Orca: `terminal send`, then for `--wait` a wait that first sees the agent
  working and only then idle. A backend with no combined send-and-wait call
  must do it in those two steps, so a pre-send idle is never read as settled.

### `wait`

`wait <pane> --wait <ms>`: waits up to `<ms>` until the agent settles,
meaning idle, done or blocked. Unlike `prompt --wait`, it matches the state
the agent is in now, so an idle agent settles at once. Prints
`{"outcome": "settled"}` or `{"outcome": "timeout"}`, exit 0. A pane that is
gone exits 3, and a failure exits 4.

- herdr: `agent wait <pane> --timeout <ms>`.
- Orca: `terminal wait --for tui-idle`.

### `launch`

`launch <name> --kind <harness> --cwd <folder> [-- <harness args>...]`:
starts a harness session in a new pane at `<folder>`, under `<name>`, without
taking focus. The harness arguments carry everything else, the permission
mode included (`-n <name> --permission-mode auto`, for example).

- **A name already taken** is refused before any pane is made: exit 6 with
  `{"outcome": "refused", "code": "agent_name_taken"}`.
- Once the pane exists, **every result names it**:
  - `{"outcome": "started", "pane", "name"}`, exit 0: the agent is up and
    ready for input.
  - `{"outcome": "timeout", "pane", "name"}`, exit 0: the start did not
    answer in time. The agent may still come up; read the pane with `get`.
  - `{"outcome": "failed", "code", "pane"}`, exit 4: the start failed, and
    the pane is left at its shell prompt.

- herdr: checks the name against `agent list` first. Then
  `pane split --current --direction right --no-focus --cwd <folder>`, whose
  answer names the new pane (`.result.pane.pane_id`), then
  `agent start <name> --kind <harness> --pane <new pane> -- <harness args>`,
  which waits up to 30 s for the agent to be ready. herdr names are unique
  among live agents and match `[a-z][a-z0-9_-]{0,31}`. The split needs a
  caller in a herdr pane.
- Orca: `terminal create --command "<harness> <args>"`. A hand-typed command
  may lose Orca's status indicators.

### `resume`

`resume <name> --kind <harness> --cwd <folder> --session <id> [-- <harness args>...]`:
as `launch`, with the same results, but it resumes the harness session
`<id>`. It needs no restored pane. A harness with no recorded resume
arguments exits 5 with `{"outcome": "unsupported"}`, before anything is
made.

- herdr: `launch`, with `--resume <id>` put before the harness arguments.
  Only Claude Code's resume arguments are recorded; every other harness,
  Codex included, exits 5.
- Orca: `terminal create --command "claude --resume <id>"`, the path Orca's
  own session history takes.

### `rename`

`rename <pane> <name>`: gives the pane's agent a new name. Prints
`{"pane", "name"}`. A name already taken exits 6.

- herdr: `agent rename <pane> <name>`.
- Orca: no rename command is documented.

### `close`

`close <pane>`: ends the agent session in the pane. Prints
`{"outcome": "sent"}`, exit 0, when the tool accepted it. The session ends on
it, so an accepted close is not proof that it closed, and the caller reads
the pane afterwards. A blocked agent exits 6, with nothing sent. A pane that
is gone exits 3, and a failure exits 4. The caller checks focus, status and
the input line first, as for `prompt`.

- herdr: `agent prompt <pane> /exit`.
- Orca: `terminal close`.

### `remote-check`

`remote-check <pane>`: whether the session in the pane is reachable
remotely.

- herdr: unsupported, exit 5. A later version fills it in.

### `remote-on`

`remote-on <pane>`: turns remote access on for the session in the pane,
under the same pane checks as `prompt`.

- herdr: unsupported, exit 5. A later version fills it in.

### `schedule-list`

The scheduled jobs the tool holds.

- herdr: unsupported, exit 5. herdr has no schedules.

### `schedule-create`

Creates a scheduled job.

- herdr: unsupported, exit 5. herdr has no schedules.

### `worktree-create`

`worktree-create --cwd <repo> --branch <name>`: a new git worktree with a
pane in it.

- herdr: unsupported, exit 5.
- Orca: `orca worktree create`.
