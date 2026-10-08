---
name: supervision-setup
description: Bind a level skill's routing table to the performers this session can actually invoke, and write the session's bindings file. Run it once at the start of every session that runs a level skill, such as project-lead or story-worker, before any task work; again after a restart, seeded with the handoff's table; and in a session that runs no level skill, to bind session-restart's own table before its first restart. Use when a level skill or a handoff says to run setup.
---

# supervision-setup

A routing table lists what a level needs done, one operation per row, and
suggests performers for each by logical name, such as `ce-work`. Setup finds
out which of them this session can invoke, binds every operation once, and
writes `.context/supervision/<session-name>/bindings.json`. After that the
session works from the file: at each step it looks up the operation's binding
and invokes that performer. It re-decides a binding only when the binding
stops fitting mid-task, as "Using the bindings" says.

Read `references/harness-notes.md` for your harness before step 3. It says
where your catalog is and how each kind of performer is invoked.

## Never

- Install anything: no plugin, package or skill. Bind only what this session
  already has.
- Scan the filesystem for skills. What this session can invoke is its own
  catalog, and a skill on disk may not be enabled.
- Record a fallback under a suggested performer's name. A fallback runs the
  operation's own instructions, and the hand-back names the suggested
  performer as unavailable and the step as run by fallback.
- Write the completion marker while an operation is unbound, a required
  operation is unavailable, or a report line stands.
- Start task work before setup has finished, or after it has stopped.
- Write evidence you did not see. Quote what the catalog or a probe printed,
  or write `unverified`.

## Inputs

The level skill passes, or the handoff holds:

- the task definition: the story or epic, with its work item's id and link,
  or the task alone where the level skill files its work item only once setup
  completes, as a defect run's lead does;
- the session's name, read from the live system as the harness notes say,
  never typed from memory;
- a routing table: the path of the level skill's `routing.toml`, or a handoff
  whose filled table is the seed. On a seeded run the table file itself is
  still the one beside the skill, as step 1 says.

## 1. Merge the repo's override

Read the table's top-level `skill` field. If the repo has
`.agents/routing-overrides/<skill>.toml`, merge it over the table by operation
id: its `performers` replace the operation's suggested performers, and its
`fallback` replaces the fallback text. An operation whose performers came from
the override records `suggested_by: override`; every other one records
`suggested_by: skill`.

If the override names an operation id the table lacks, **stop**: record the
header as step 2 says, with `check_prompt` `null`, and write the file with no
operations, the report line `the override for <skill> names <id>, which its
table lacks`, and no completion marker. Then tell the maintainer. A typo
in an override must never silently do nothing.

On a seeded run, the table is the `routing.toml` in the folder this session
loaded the level skill from, or session-restart's own for a session that runs
no level skill. The handoff names that skill, and its `skill` field picks the
same override the first run merged. The table path the handoff records is a
record only: a plugin update or a move can take that folder away, or leave an
older copy there, so never read the table from it. Comparing the sha256 the
earlier bindings file recorded, or the handoff where that file does not
resolve, with the table you read says whether the table changed. When it
changed, the bindings you write follow the table you read now: bind every
operation as on a first run, since the seed's performers were chosen from
the old table's suggestions, and an operation the table dropped gets no
binding. The header records the new sha256, and step 9's report names the
change. The receipt check fails bindings whose table changed after setup read
it. The handoff's bound performers are candidates to recheck, never bindings.

## 2. Record the header

- `harness`: its name (`claude-code`, `codex`), its version, and the
  quoted output that showed the version.
- `model`: the model id, and its context window in tokens, with the evidence.
  The context gauge reads the window from here. When the harness notes give no
  way to know the window, record `null` with the evidence `unverified`; step 6
  then binds the measuring operation as unavailable. Never guess a window.
- `table`: the table's path and `sha256`, and the override's path and
  `sha256`, or `null` for both when the repo has none (`shasum -a 256`).
- `seeded_from`: the handoff's path on a seeded run, otherwise `null`.
- `check_prompt`: the path of the `check-prompt.txt` the check read (step 4),
  or `null` where the check runs in the session itself.
- `transcripts`: the current session id and transcript path. On a seeded run,
  keep every entry of the earlier bindings file and append the new one; never
  list a session id twice. Where the earlier file does not resolve on this
  machine, as for a successor on another one, keep the entries the handoff's
  routing table lists instead. The receipt check reads every transcript listed.

## 3. Snapshot the catalog

From your own context, write down exactly as listed: every skill name in your
skill listing, every tool name including deferred ones, and every agent type.
This snapshot is what the check matches against.

## 4. The check

The check is exact, and it makes no judgment:

- **One word.** A logical name is one word. It matches a catalog entry whose
  unqualified name equals it exactly, case included.
- **Unqualified names.** For a skill or agent, the unqualified name is the part
  after the last `:`, so `ce-work` matches `compound-engineering:ce-work`. For an
  MCP tool, whose id starts `mcp__`, it is the part after the last `__`, so
  `save_comment` matches `mcp__claude_ai_Linear__save_comment`. For any other
  tool it is the name itself.
- **CLIs.** A CLI matches when `command -v <name>` prints an absolute path.
  That path is its native id.
- **Clashes.** Matching runs across every kind at once. If two entries share
  the unqualified name, whether of one kind or of two, the operation goes to
  discovery.
- **Order.** Try an operation's suggested performers in order. The first name
  that matches any entry decides the operation: one entry binds it, with
  `how_bound: check`; two or more send it to discovery. A name that matches
  nothing passes to the next.
- **Presence, not function.** A match proves the performer is present, not
  that it works here. The harness notes list the known cases where a present
  performer fails.

**On Claude Code**, run the check in a cheap subagent: the Agent tool with
`model: "haiku"` and the `general-purpose` type. Write this prompt, with the
snapshot and the candidates filled in, to `check-prompt.txt` in the session's
folder, fresh on every run and overwriting the last, so a rerun never matches
a stale snapshot. Tell the subagent to read that file and follow it, matching
the snapshot and never its own tools. The snapshot runs to hundreds of lines,
and the file keeps the check's input beside its result. Run the `command -v`
probes yourself first, one per candidate name, and write their output into
the file under `CLI probes` by redirection, never by copying it by hand, one
line each as `command -v <name>: <output, or nothing>`, for example
`printf 'command -v %s: %s\n' herdr "$(command -v herdr)" >> <file>`, so every
row the subagent returns can be confirmed from the file:

```text
Match names exactly; judge nothing. The rules:
<the rules above, from "A logical name is one word" to "binds">

Catalog snapshot (skills, tools, agent types):
<the snapshot>

CLI probes:
command -v <name>: <output, or nothing>

Candidates, one operation per line, suggested names in order:
<operation id>: <name>, <name>, ...

A CLI matches only through its line under CLI probes. Answer with one JSON object per line and nothing else:
{"id": "<operation id>", "match": "<native id, or null>",
 "kind": "skill|tool|agent|cli|null", "source_hint": "<the probed path, or null>",
 "evidence": "<the snapshot or probe line you matched, quoted>",
 "clashes": ["<every native id that shared a name>"]}
```

On any other harness, apply the same rules yourself.

Then confirm every row before you use it. Its evidence must be quoted from
the check prompt's snapshot or from the probe output, and appear there word
for word. Take the native id from that confirmed line, not from `match`: a
cheap model can put the logical name there instead. A row you cannot confirm goes
to discovery, and so does an operation with clashes. So does an operation the
table marks `fresh_context = true` whose match is an agent, or a tool that
starts a subagent: its call always sits in the caller's own transcript, so it
can never show the operation ran in a fresh context. For an operation with no
match, write its evidence yourself, from the snapshot and the probe, not in the
subagent's words: `the snapshot has no entry named "<name>", and
"command -v <name>" printed nothing`, one clause per suggested name. Then two
runs on the same catalog give the same evidence. Fill in each binding's
`source` from what you know: the plugin and its version, the skill's folder,
the built-in harness, the MCP server, or the `command -v` path.

**On a seeded run**, a seeded binding is rechecked, not trusted. If the
harness and its version equal the earlier file's, or the handoff's where that
file does not resolve on this machine, and the seeded native id is
still in the snapshot with no clash, or for a CLI its probe prints the same
path, the binding is `seed-rechecked`. Every
other seeded operation goes to discovery. So does a seeded binding of an
operation the table marks `fresh_context = true` to an agent, or to a tool
that starts a subagent, even when it passes that recheck. The handoff's rows
do not carry the mark: read it from the table step 1 read. An
operation the seed does not carry goes through the check as on a first run.

## 5. Discovery

Discovery runs only for the operations the check left unbound, and on your
own model, since it is the one judgment step. Read the operation's intent, and
look through the snapshot for a performer that fulfils it. Other frameworks'
skills count. Bind the best fit with `how_bound: discovery`, and a one-line
`rationale` tying that performer to the intent. Where the check found a clash,
choose between the entries that clashed and say why.

For an operation the table marks `fresh_context = true`, bind the review skill
the reviewer runs, never an agent or a tool that starts a subagent. The level
skill starts the fresh-context subagent itself and has it invoke that skill,
so the call sits in the subagent's own transcript.

## 6. Fallback and unavailable

For an operation that neither the check nor discovery bound:

- **Not required, with usable fallback instructions:** bind it as
  `fallback`, kind `instructions`, with no native id or source.
- **Not required, and its fallback says to bind it as unavailable,** as the
  measuring operation's does on a harness with no recipe: bind it as
  `unavailable`, kind `none`. Setup still finishes.
- **Required:** bind it as `unavailable` and **stop**, with one report line
  naming the operation, for example `post-work-note is required and nothing
  available performs it`. Tell the maintainer before any task work.

**The measuring operation** needs one more probe. If step 2 recorded no
window, bind it as `unavailable` without running the gauge, with the evidence
`no context window is known for "<model id>"`. Otherwise, once it binds the
context gauge, run the gauge once as its skill says, passing the harness name
and the window from step 2. If the gauge answers `context=unavailable`, bind
the operation as `unavailable`, and quote the gauge's answer as evidence.

## 7. A bound skill's own table

When an operation binds a skill that ships its own `routing.toml` in its
folder, as `session-restart` does, bind that table's
operations in the same run, with that skill's override merged. Give each
binding `table: <that skill>`. A gap there then fails at setup, not in the
middle of a restart.

Merge that skill's override as step 1 says. If it names an operation id that
skill's table lacks, **stop**: write the file with the bindings made so far,
the report line `the override for <that skill> names <id>, which its table
lacks`, and no completion marker, and tell the maintainer.

## 8. Write the bindings file

Write `.context/supervision/<session-name>/bindings.json` (the folder is
gitignored; create it). First write it without `complete`, then read it back
against the rules below, and add `complete` last, as its own write. Two runs
on the same table, in the same session, give the same file apart from
`complete.at`.

```json
{
  "skill": "<the table's skill field>",
  "session": "<session-name>",
  "harness": { "name": "claude-code", "version": "<version>", "evidence": "<quoted>" },
  "model": { "id": "<model id>", "context_window": 1000000, "evidence": "<quoted>" },
  "table": { "path": "<table>", "sha256": "<hex>", "override": "<path or null>", "override_sha256": "<hex or null>" },
  "seeded_from": null,
  "check_prompt": ".context/supervision/<session-name>/check-prompt.txt",
  "transcripts": [{ "session_id": "<id>", "path": "<transcript path>" }],
  "operations": [
    {
      "table": "<skill whose table holds the operation>",
      "id": "<operation id>",
      "required": false,
      "suggested": ["<logical names, after the override>"],
      "suggested_by": "skill | override",
      "how_bound": "check | discovery | fallback | unavailable | seed-rechecked",
      "kind": "skill | cli | tool | agent | instructions | none",
      "native_id": "<the catalog's id, or null>",
      "source": "<plugin and version, folder, harness, server or path, or null>",
      "invoke": "<how to invoke it on this harness>",
      "evidence": "<quoted catalog line or probe output, or unverified>",
      "rationale": "<discovery only: why this performer fits the intent>"
    }
  ],
  "report": [],
  "complete": { "at": "<UTC time>" }
}
```

The rules:

- In a complete file, every operation of the table, and of every bound
  skill's own table, has exactly one binding. A file that stopped at step 1
  has none, and no operation is ever bound twice.
- `check`, `discovery` and `seed-rechecked` name a performer: a kind of
  `skill`, `cli`, `tool` or `agent`, a native id and a source. A binding by
  check has a native id whose unqualified name is one of its suggested names,
  and quotes its snapshot or probe line as evidence, never `unverified`. A CLI
  bound by check has the absolute path `command -v` printed as its native id.
- `fallback` has kind `instructions`, and `unavailable` has kind `none`. Both
  have a `null` native id and source.
- An operation the table marks `fresh_context = true` is never bound to an
  agent, or to a tool that starts a subagent.
- Only a discovered binding has a `rationale`.
- `evidence` is quoted output or `unverified`, never empty.
- `model.context_window` is `null` only when no window is known, and then the
  measuring operation is `unavailable`.
- A file with no operations is a step-1 stop, and its report line names an
  override id the table lacks.
- Only a seeded run has `seed-rechecked` bindings.
- Every stop has a line in `report` naming the operation or override id, and a
  file with a report line has no `complete`.

## 9. Report and hand over

End with one line listing each operation's performer and how it was bound,
for example `setup: build=compound-engineering:ce-work (check), review=code-review
(check), measure-context=unavailable`. When the measuring operation is
unavailable, add once: "This session cannot measure its context, so it will
not restart itself." When a seeded run found the table changed, add once:
"the routing table changed since the earlier setup", which the level skill
carries into its hand-back. After a stop, give the report line instead, and do no
task work.

## Using the bindings

For the level skill that called setup:

- Load the bindings only when the file has `complete`.
- At each step, read the operation's binding at that point and invoke its
  performer, naming it in that turn. Some harnesses drop a skill between turns
  unless it is named again.
- When a binding stops fitting mid-task, rebind it yourself. Update that
  binding in the file with its new performer, `how_bound: discovery`, a
  rationale and quoted evidence that the new performer is present, and note
  the change in your receipt. When nothing replaces it, apply step 6 to it:
  an optional operation binds as `fallback` or `unavailable`, and a required
  one stops the work, as at setup: remove `complete` first, then record the
  binding as `unavailable` with its report line. For a fallback, the
  hand-back names the suggested performer as unavailable and the step as run
  by fallback, as "Never" says. Do not ask your lead to fix it.
