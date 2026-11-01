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

## Calling it

```sh
<adapter> [--bin <binary>] [--timeout <seconds>] <operation> [args...]
```

- `--bin`: the binary the binding names. The default is the tool's name on
  `PATH`.
- `--timeout`: bounds each call to the tool, in seconds (fractions allowed;
  default 30). An operation that waits, as `prompt --wait` does, adds its
  own wait to this bound. A call cut at the bound exits 4.

It needs bash, jq and perl.

## Output

Every operation except `read-screen` prints one JSON object on one line to
stdout, whatever its exit status, except a usage error, which prints only
to stderr. A one-line reason goes to stderr whenever the exit is not 0.
`read-screen` prints the screen text itself.

### The agent record

`get` prints one record, and `list` and `find` print `{"agents": [record, ...]}`:

```json
{"pane": "<pane id>", "name": "<name or null>", "kind": "<harness or null>",
 "status": "idle|working|blocked|done|unknown", "focused": true,
 "session": "<harness session id or null>", "cwd": "<folder or null>"}
```

- `status` is normalized. A state the tool reports outside those four reads
  `unknown`.
- **A field the tool cannot tell is `null`, and a caller reads `null` as
  unsafe.** Read `focused: null` as focused, and `status: unknown` as not
  ready. A `null` session matches no session. When focus, status, the input
  line or the session id is unknown, type nothing: take the fallback path,
  or report.

### Exit codes

| exit | meaning |
| --- | --- |
| 0 | done |
| 2 | usage: an unknown operation, a missing argument or a bad option |
| 3 | not found: no such pane or agent, or the caller is not in a pane |
| 4 | the tool failed, timed out, or gave an answer that cannot be read |
| 5 | unsupported by this implementation; nothing was done |
| 6 | refused by the tool, and nothing was done: blocked, a name taken, not ready |

A caller treats 4 as it treats a pane it cannot read: nothing is clear to
send.

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

- herdr: `agent prompt <pane> <text> [--wait --timeout <ms>]`. herdr rejects
  a blocked agent before it sends any input, which is why the wait rides on
  the same call.
- Orca: `terminal send`, then `terminal wait --for tui-idle` for `--wait`.

### `wait`

`wait <pane> --timeout <ms>`: waits until the agent settles, meaning idle,
done or blocked. Prints `{"outcome": "settled"}` or `{"outcome": "timeout"}`,
exit 0. A pane that is gone exits 3, and a failure exits 4.

- herdr: `agent wait <pane> --timeout <ms>`.
- Orca: `terminal wait --for tui-idle`.

### `launch`

`launch <name> --kind <harness> --cwd <folder> [-- <harness args>...]`:
starts a harness session in a new pane at `<folder>`, under `<name>`, without
taking focus. The harness arguments carry everything else, the permission
mode included (`-n <name> --permission-mode auto`, for example). Prints
`{"pane", "name"}`. A name already taken, or an agent that came up blocked,
exits 6 with `{"outcome": "refused", "code", "pane"}`. `pane` is the new
pane, left at its shell prompt.

- herdr: `pane split --current --cwd <folder>`, whose answer names the new
  pane (`.result.pane.pane_id`), then
  `agent start <name> --kind <harness> --pane <new pane> -- <harness args>`.
  herdr names are unique among live agents and match `[a-z][a-z0-9_-]{0,31}`.
  The split needs a caller in a herdr pane.
- Orca: `terminal create --command "<harness> <args>"`. A hand-typed command
  may lose Orca's status indicators.

### `resume`

`resume <name> --kind <harness> --cwd <folder> --session <id> [-- <harness args>...]`:
as `launch`, but it resumes the harness session `<id>`. It needs no restored
pane. A harness with no known resume arguments exits 5.

- herdr: `launch`, with `--resume <id>` for Claude Code, or `resume <id>` for
  Codex, put before the harness arguments.
- Orca: `terminal create --command "claude --resume <id>"`, the path Orca's
  own session history takes.

### `rename`

`rename <pane> <name>`: gives the pane's agent a new name. Prints
`{"pane", "name"}`. A name already taken exits 6.

- herdr: `agent rename <pane> <name>`.
- Orca: no rename command is documented.

### `close`

`close <pane>`: ends the agent session in the pane. Prints
`{"outcome": "sent"}`. The session ends on it, so the tool's answer is not
the verdict, and the caller reads the pane afterwards. A blocked agent exits
6, with nothing sent. The caller checks focus, status and the input line
first, as for `prompt`.

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
