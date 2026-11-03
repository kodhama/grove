/**
 * KOD-19 (hub plan plans/grove/2026-11-01-kod-19-herdr-adapter-plan.md) — the
 * pane-tool adapter, `skills/supervision-setup/scripts/adapter/`.
 *
 * Three things are pinned here. No script or module under `skills/` names
 * herdr outside `adapter/herdr.sh` (R19, success test 5), and the scan that
 * says so catches a call added anywhere else. `herdr.sh` keeps the contract
 * `interface.md` documents, run by path from a folder outside `skills/`, as a
 * script outside grove would run it. And each operation sends herdr the argv
 * its row in `interface.md` names.
 *
 * herdr is a stub: it logs each call's argv and answers from files in
 * $STUB_DIR, `<group>-<command>-out`, `-err`, `-code` and `-sleep`, so
 * `agent-get-out` is what `herdr agent get` prints. Nothing here calls a
 * real herdr, a model or the network.
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SKILLS = join(ROOT, "skills");
const ADAPTER_DIR = join(SKILLS, "supervision-setup/scripts/adapter");
const ADAPTER = join(ADAPTER_DIR, "herdr.sh");
const INTERFACE = join(ADAPTER_DIR, "interface.md");
const ONLY_CALLER = "supervision-setup/scripts/adapter/herdr.sh";

/** Every file under `root` with a script or module extension. */
function scriptsUnder(root: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) found.push(...scriptsUnder(path));
    else if (/\.(sh|mjs|js|ts|py)$/.test(name)) found.push(path);
  }
  return found;
}

/**
 * The files under a skills tree that name herdr as a word, the way
 * `grep -rnw herdr` reads it, other than the one file allowed to.
 */
function boundaryViolations(skillsRoot: string): string[] {
  return scriptsUnder(skillsRoot)
    .map((path) => relative(skillsRoot, path))
    .filter((rel) => rel !== ONLY_CALLER)
    .filter((rel) => /\bherdr\b/.test(readFileSync(join(skillsRoot, rel), "utf8")));
}

describe("the adapter boundary (R19, success test 5)", () => {
  it("no script or module under skills/ names herdr outside adapter/herdr.sh", () => {
    expect(boundaryViolations(SKILLS)).toEqual([]);
  });

  it("the scan catches one herdr call added to a copy of start-restart.sh (U9.1's mutation check)", () => {
    const scratch = mkdtempSync(join(tmpdir(), "adapter-mutation-"));
    try {
      cpSync(SKILLS, join(scratch, "skills"), { recursive: true });
      const target = join(scratch, "skills/session-restart/scripts/start-restart.sh");
      appendFileSync(target, '\nherdr agent list >/dev/null\n');
      expect(boundaryViolations(join(scratch, "skills"))).toEqual([
        "session-restart/scripts/start-restart.sh",
      ]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("herdr.sh is the file that runs herdr", () => {
    expect(readFileSync(ADAPTER, "utf8")).toMatch(/\bherdr\b/);
  });
});

const STUB = `#!/usr/bin/env bash
# Stub herdr for test/adapter-boundary.test.ts. State lives in $STUB_DIR.
d="$STUB_DIR"
{ printf '%s' "$1"; for a in "\${@:2}"; do printf '\\t%s' "$a"; done; printf '\\n'; } >> "$d/calls.log"
key="$1-$2"
# herdr 0.9.3 refuses a split that names no direction, with exit 2.
if [ "$key" = pane-split ]; then
  dir=""; prev=""
  for a in "\${@:3}"; do [ "$prev" = --direction ] && dir="$a"; prev="$a"; done
  case "$dir" in right | down) ;; *) echo "usage: herdr pane split [<pane_id>|--pane ID|--current] --direction right|down ..." >&2; exit 2 ;; esac
fi
[ -f "$d/$key-sleep" ] && exec sleep "$(cat "$d/$key-sleep")"
[ -f "$d/$key-err" ] && cat "$d/$key-err" >&2
[ -f "$d/$key-out" ] && cat "$d/$key-out"
exit "$(cat "$d/$key-code" 2>/dev/null || echo 0)"
`;

let stubDir: string;
let outside: string;

beforeEach(() => {
  stubDir = mkdtempSync(join(tmpdir(), "adapter-stub-"));
  outside = mkdtempSync(join(tmpdir(), "adapter-caller-"));
  writeFileSync(join(stubDir, "herdr"), STUB);
  chmodSync(join(stubDir, "herdr"), 0o755);
});

afterEach(() => {
  rmSync(stubDir, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

function answer(key: string, out: string, code = 0, err = "") {
  writeFileSync(join(stubDir, `${key}-out`), out);
  writeFileSync(join(stubDir, `${key}-code`), String(code));
  if (err) writeFileSync(join(stubDir, `${key}-err`), err);
}

/** herdr's shape for one agent, as `agent get` and `agent list` print it. */
const herdrAgent = (over: Record<string, unknown> = {}) => ({
  agent: "claude",
  agent_session: { agent: "claude", kind: "id", source: "herdr:claude", value: "s1" },
  agent_status: "idle",
  cwd: "/Users/maintainer/repo",
  focused: false,
  name: "worker-1",
  pane_id: "w1:p2",
  ...over,
});

const herdrError = (code: string) => JSON.stringify({ error: { code, message: code } });

/** Runs herdr.sh by its absolute path from a folder outside skills/, as an outside script would. */
function adapter(args: string[], env: Record<string, string | undefined> = {}) {
  const result = spawnSync("bash", [ADAPTER, "--bin", join(stubDir, "herdr"), ...args], {
    cwd: outside,
    encoding: "utf8",
    env: { PATH: process.env.PATH, STUB_DIR: stubDir, ...env },
    timeout: 10_000,
  });
  const calls = (() => {
    try {
      return readFileSync(join(stubDir, "calls.log"), "utf8").trimEnd().split("\n").map((l) => l.split("\t"));
    } catch {
      return [];
    }
  })();
  return { ...result, calls };
}

const json = (stdout: string) => JSON.parse(stdout.trim()) as Record<string, unknown>;

describe("herdr.sh run by path from outside skills/ (ruling 8, U9.5)", () => {
  it("get prints the neutral record and exits 0", () => {
    answer("agent-get", JSON.stringify({ id: "cli:agent:get", result: { agent: herdrAgent() } }));
    const run = adapter(["get", "w1:p2"]);
    expect(run.status, run.stderr).toBe(0);
    expect(json(run.stdout)).toEqual({
      pane: "w1:p2",
      name: "worker-1",
      kind: "claude",
      status: "idle",
      focused: false,
      session: "s1",
      cwd: "/Users/maintainer/repo",
    });
    expect(run.calls).toEqual([["agent", "get", "w1:p2"]]);
  });

  it("get reads what herdr cannot tell as null, and an unknown status as unknown, so callers fail closed", () => {
    answer(
      "agent-get",
      JSON.stringify({
        result: { agent: herdrAgent({ focused: undefined, agent_status: "starting", agent_session: { value: "" } }) },
      }),
    );
    const record = json(adapter(["get", "w1:p2"]).stdout);
    expect(record.focused).toBeNull();
    expect(record.status).toBe("unknown");
    expect(record.session).toBeNull();
  });

  it("get exits 3 for a pane that is gone, and 4 when herdr fails or answers what cannot be read", () => {
    answer("agent-get", "", 1, herdrError("agent_not_found"));
    expect(adapter(["get", "w1:p9"]).status).toBe(3);
    answer("agent-get", "", 1, herdrError("server_unavailable"));
    expect(adapter(["get", "w1:p2"]).status).toBe(4);
    answer("agent-get", "not json", 0);
    expect(adapter(["get", "w1:p2"]).status).toBe(4);
  });

  it("a herdr call that hangs is cut at --timeout and exits 4", () => {
    writeFileSync(join(stubDir, "agent-get-sleep"), "5");
    const started = Date.now();
    const run = adapter(["--timeout", "0.3", "get", "w1:p2"]);
    expect(run.status).toBe(4);
    expect(Date.now() - started).toBeLessThan(4000);
  });

  it.each(["remote-check w1:p2", "remote-on w1:p2", "schedule-list", "schedule-create", "worktree-create"])(
    "%s is unsupported: exit 5, and herdr is never called",
    (op) => {
      const run = adapter(op.split(" "));
      expect(run.status).toBe(5);
      expect(json(run.stdout)).toMatchObject({ outcome: "unsupported" });
      expect(run.calls).toEqual([]);
    },
  );

  it("exits 2 on an unknown operation, a missing argument or a bad option", () => {
    expect(adapter(["teleport"]).status).toBe(2);
    expect(adapter(["get"]).status).toBe(2);
    expect(adapter(["--timeout", "soon", "list"]).status).toBe(2);
    expect(adapter(["prompt", "w1:p2", "hi", "--wait", "later"]).status).toBe(2);
  });
});

describe("herdr.sh — each operation's herdr realization (interface.md)", () => {
  it("self reads the pane id herdr gives the process, and exits 3 outside a pane", () => {
    const inside = adapter(["self"], { HERDR_PANE_ID: "w1:p2" });
    expect(inside.status).toBe(0);
    expect(json(inside.stdout)).toEqual({ pane: "w1:p2" });
    expect(adapter(["self"], { HERDR_PANE_ID: undefined }).status).toBe(3);
    expect(inside.calls).toEqual([]);
  });

  it("list and find read agent list; find exits 3 when no live agent has the name", () => {
    answer(
      "agent-list",
      JSON.stringify({ result: { agents: [herdrAgent(), herdrAgent({ name: "lead", pane_id: "w1:p7" })] } }),
    );
    const list = adapter(["list"]);
    expect(list.status).toBe(0);
    expect((json(list.stdout).agents as unknown[]).length).toBe(2);
    const found = adapter(["find", "lead"]);
    expect(found.status).toBe(0);
    expect(json(found.stdout)).toMatchObject({ agents: [{ pane: "w1:p7", name: "lead" }] });
    expect(adapter(["find", "nobody"]).status).toBe(3);
    expect(found.calls.every((c) => c[0] === "agent" && c[1] === "list")).toBe(true);
  });

  it("read-screen prints herdr's visible screen with ANSI as it came, or the recent plain lines", () => {
    answer("agent-read", "\u001b[2msuggestion\u001b[0m\n");
    const run = adapter(["read-screen", "w1:p2"]);
    expect(run.status).toBe(0);
    expect(run.stdout).toBe("\u001b[2msuggestion\u001b[0m\n");
    adapter(["read-screen", "w1:p2", "--recent", "--lines", "20", "--plain"]);
    expect(run.calls.length).toBe(1);
    const calls = readFileSync(join(stubDir, "calls.log"), "utf8").trimEnd().split("\n").map((l) => l.split("\t"));
    expect(calls).toEqual([
      ["agent", "read", "w1:p2", "--source", "visible", "--format", "ansi"],
      ["agent", "read", "w1:p2", "--source", "recent-unwrapped", "--format", "text", "--lines", "20"],
    ]);
  });

  it("prompt sends without --wait unless asked, and with --wait bounds herdr by the wait", () => {
    answer("agent-prompt", JSON.stringify({ result: { type: "agent_prompt" } }));
    const sent = adapter(["prompt", "w1:p2", "/clear"]);
    expect(sent.status).toBe(0);
    expect(json(sent.stdout)).toMatchObject({ outcome: "sent" });
    const settled = adapter(["prompt", "w1:p2", "Resume.", "--wait", "600"]);
    expect(json(settled.stdout)).toMatchObject({ outcome: "settled" });
    expect(settled.calls).toEqual([
      ["agent", "prompt", "w1:p2", "/clear"],
      ["agent", "prompt", "w1:p2", "Resume.", "--wait", "--timeout", "600"],
    ]);
  });

  it("prompt reads herdr's errors: blocked exits 6 with nothing sent, a timeout is an outcome, anything else exits 4", () => {
    answer("agent-prompt", "", 1, herdrError("agent_blocked"));
    const blocked = adapter(["prompt", "w1:p2", "hi"]);
    expect(blocked.status).toBe(6);
    expect(json(blocked.stdout)).toMatchObject({ outcome: "blocked", code: "agent_blocked" });
    answer("agent-prompt", "", 1, herdrError("timeout"));
    const late = adapter(["prompt", "w1:p2", "hi", "--wait", "100"]);
    expect(late.status).toBe(0);
    expect(json(late.stdout)).toMatchObject({ outcome: "timeout" });
    answer("agent-prompt", "", 1, herdrError("agent_prompt_stalled"));
    const stalled = adapter(["prompt", "w1:p2", "hi", "--wait", "100"]);
    expect(stalled.status).toBe(4);
    expect(json(stalled.stdout)).toMatchObject({ outcome: "failed", code: "agent_prompt_stalled" });
  });

  it("wait waits on agent wait, and reports a timeout as an outcome", () => {
    answer("agent-wait", JSON.stringify({ result: {} }));
    const run = adapter(["wait", "w1:p2", "--wait", "500"]);
    expect(run.status).toBe(0);
    expect(json(run.stdout)).toEqual({ outcome: "settled" });
    expect(run.calls).toEqual([["agent", "wait", "w1:p2", "--timeout", "500"]]);
    answer("agent-wait", "", 1, herdrError("timeout"));
    expect(json(adapter(["wait", "w1:p2", "--wait", "500"]).stdout)).toEqual({ outcome: "timeout" });
  });

  it("launch splits the caller's pane at the cwd, then starts the agent on the new pane with the harness arguments", () => {
    answer("agent-list", JSON.stringify({ result: { agents: [herdrAgent()] } }));
    answer("pane-split", JSON.stringify({ result: { pane: { pane_id: "w1:p9" } } }));
    answer("agent-start", JSON.stringify({ result: {} }));
    const run = adapter([
      "launch", "worker-2", "--kind", "claude", "--cwd", "/Users/maintainer/repo",
      "--", "-n", "worker-2", "--permission-mode", "auto",
    ]);
    expect(run.status, run.stderr).toBe(0);
    expect(json(run.stdout)).toEqual({ outcome: "started", pane: "w1:p9", name: "worker-2" });
    expect(run.calls).toEqual([
      ["agent", "list"],
      ["pane", "split", "--current", "--direction", "right", "--no-focus", "--cwd", "/Users/maintainer/repo"],
      ["agent", "start", "worker-2", "--kind", "claude", "--pane", "w1:p9", "--", "-n", "worker-2", "--permission-mode", "auto"],
    ]);
  });

  it("launch refuses a taken name before it splits anything: exit 6, nothing made", () => {
    answer("agent-list", JSON.stringify({ result: { agents: [herdrAgent({ name: "lead" })] } }));
    const taken = adapter(["launch", "lead", "--kind", "claude", "--cwd", "/tmp"]);
    expect(taken.status).toBe(6);
    expect(json(taken.stdout)).toMatchObject({ outcome: "refused", code: "agent_name_taken" });
    expect(taken.calls).toEqual([["agent", "list"]]);
  });

  it("launch names the pane it split in every result after the split: a failed start exits 4, a slow one is an outcome", () => {
    answer("agent-list", JSON.stringify({ result: { agents: [] } }));
    answer("pane-split", JSON.stringify({ result: { pane: { pane_id: "w1:p9" } } }));
    answer("agent-start", "", 1, herdrError("agent_not_ready"));
    const failed = adapter(["launch", "lead", "--kind", "claude", "--cwd", "/tmp"]);
    expect(failed.status).toBe(4);
    expect(json(failed.stdout)).toMatchObject({ outcome: "failed", code: "agent_not_ready", pane: "w1:p9" });
    answer("agent-start", "", 1, herdrError("timeout"));
    const slow = adapter(["launch", "lead", "--kind", "claude", "--cwd", "/tmp"]);
    expect(slow.status).toBe(0);
    expect(json(slow.stdout)).toMatchObject({ outcome: "timeout", pane: "w1:p9" });
    answer("pane-split", "{}");
    expect(adapter(["launch", "lead", "--kind", "claude", "--cwd", "/tmp"]).status).toBe(4);
  });

  it("resume builds the harness's own resume arguments from the session id, and is unsupported for a harness it does not know", () => {
    answer("agent-list", JSON.stringify({ result: { agents: [] } }));
    answer("pane-split", JSON.stringify({ result: { pane: { pane_id: "w1:p9" } } }));
    answer("agent-start", JSON.stringify({ result: {} }));
    const run = adapter([
      "resume", "lead", "--kind", "claude", "--cwd", "/tmp", "--session", "s1", "--", "--permission-mode", "auto",
    ]);
    expect(run.status, run.stderr).toBe(0);
    expect(run.calls.at(-2)).toEqual(["pane", "split", "--current", "--direction", "right", "--no-focus", "--cwd", "/tmp"]);
    expect(run.calls.at(-1)).toEqual([
      "agent", "start", "lead", "--kind", "claude", "--pane", "w1:p9", "--", "--resume", "s1", "--permission-mode", "auto",
    ]);
    for (const kind of ["codex", "gemini"])
      expect(adapter(["resume", "lead", "--kind", kind, "--cwd", "/tmp", "--session", "s1"]).status).toBe(5);
  });

  it("rename renames the agent, and exits 6 when the name is taken", () => {
    answer("agent-rename", JSON.stringify({ result: {} }));
    const run = adapter(["rename", "w1:p2", "lead"]);
    expect(run.status).toBe(0);
    expect(json(run.stdout)).toEqual({ pane: "w1:p2", name: "lead" });
    expect(run.calls).toEqual([["agent", "rename", "w1:p2", "lead"]]);
    answer("agent-rename", "", 1, herdrError("agent_name_taken"));
    expect(adapter(["rename", "w1:p2", "lead"]).status).toBe(6);
  });

  it("get reads herdr's answer from stdout only, so a warning on stderr does not spoil it", () => {
    answer("agent-get", JSON.stringify({ result: { agent: herdrAgent() } }), 0, "warning: a newer herdr is available\n");
    const run = adapter(["get", "w1:p2"]);
    expect(run.status, run.stderr).toBe(0);
    expect(json(run.stdout)).toMatchObject({ pane: "w1:p2", status: "idle" });
  });

  it("list, find and launch exit 4 when herdr's answer holds no agent list, and launch then makes nothing", () => {
    answer("agent-list", "{}");
    expect(adapter(["list"]).status).toBe(4);
    expect(adapter(["find", "lead"]).status).toBe(4);
    const launch = adapter(["launch", "lead", "--kind", "claude", "--cwd", "/tmp"]);
    expect(launch.status).toBe(4);
    expect(launch.calls.filter((c) => c[0] === "pane")).toEqual([]);
  });

  it("read-screen exits 3 for a pane that is gone, from herdr's error on stderr", () => {
    answer("agent-read", "", 1, herdrError("agent_not_found"));
    const run = adapter(["read-screen", "w1:p2"]);
    expect(run.status).toBe(3);
    expect(json(run.stdout)).toMatchObject({ outcome: "not-found" });
  });

  it("read-screen exits 3 for a pane that is gone, from herdr's error on stdout", () => {
    answer("agent-read", herdrError("agent_not_found"), 1);
    const run = adapter(["read-screen", "w1:p2"]);
    expect(run.status).toBe(3);
    expect(json(run.stdout)).toMatchObject({ outcome: "not-found", code: "agent_not_found" });
  });

  // herdr 0.9.3 answers a usage error with one plain line on stderr and exit 2,
  // and a refusal with one JSON line on stderr and exit 1. Its reason goes in
  // the human-readable line only; the record keeps its shape.
  const usage = "usage: herdr agent read <target> [--source visible|recent|recent-unwrapped] [--lines N]";

  it("a failure shows herdr's plain-text reason on stderr, its first line only, and the record keeps its shape", () => {
    answer("agent-read", "", 2, `${usage}\n\nmore help below\n`);
    const run = adapter(["read-screen", "w1:p2"]);
    expect(run.status).toBe(4);
    expect(json(run.stdout)).toEqual({ outcome: "failed", code: null });
    expect(run.stderr).toContain(`herdr failed (exit 2): ${usage}\n`);
    expect(run.stderr).not.toContain("more help below");
  });

  it("a failure shows the message of herdr's JSON error, not the raw JSON", () => {
    const refusal = JSON.stringify({ error: { code: "agent_not_ready", message: "agent w1:p2 is not ready" } });
    answer("agent-rename", "", 1, refusal);
    const run = adapter(["rename", "w1:p2", "lead"]);
    expect(run.status).toBe(4);
    expect(json(run.stdout)).toEqual({ outcome: "failed", code: "agent_not_ready" });
    expect(run.stderr).toContain("herdr failed (exit 1, agent_not_ready): agent w1:p2 is not ready\n");
    expect(run.stderr).not.toContain('{"error"');
  });

  it("a JSON error's message that spans lines keeps the reason to one line (interface.md)", () => {
    answer("agent-read", "", 1, JSON.stringify({ error: { code: "x", message: "first part\nsecond part" } }));
    const run = adapter(["read-screen", "w1:p2"]);
    expect(run.stderr).toContain("herdr failed (exit 1, x): first part\n");
    expect(run.stderr).not.toContain("second part");
  });

  it("a failure with nothing on stderr says only the exit", () => {
    answer("agent-read", "", 1);
    const run = adapter(["read-screen", "w1:p2"]);
    expect(run.status).toBe(4);
    expect(run.stderr).toMatch(/herdr failed \(exit 1\)\n/);
  });

  it("a failed agent list shows herdr's reason on stderr", () => {
    answer("agent-list", "", 2, "usage: herdr agent list [--json]\n");
    const run = adapter(["list"]);
    expect(run.status).toBe(4);
    expect(json(run.stdout)).toEqual({ outcome: "failed", code: null });
    expect(run.stderr).toContain("herdr failed (exit 2): usage: herdr agent list [--json]\n");
  });

  it("a failed agent start shows herdr's reason on stderr and still names the pane left at its shell", () => {
    answer("agent-list", JSON.stringify({ result: { agents: [] } }));
    answer("pane-split", JSON.stringify({ result: { pane: { pane_id: "w1:p9" } } }));
    answer("agent-start", "", 2, "usage: herdr agent start <name> --kind KIND --pane ID\n");
    const run = adapter(["launch", "lead", "--kind", "claude", "--cwd", "/tmp"]);
    expect(run.status).toBe(4);
    expect(json(run.stdout)).toEqual({ outcome: "failed", code: null, pane: "w1:p9" });
    expect(run.stderr).toContain(
      "herdr failed (exit 2): usage: herdr agent start <name> --kind KIND --pane ID; pane w1:p9 is left at its shell\n",
    );
  });

  it("exits 4 with a failure object when it cannot make its temporary file", () => {
    answer("agent-get", JSON.stringify({ result: { agent: herdrAgent() } }));
    const run = adapter(["get", "w1:p2"], { TMPDIR: "/dev/null" });
    expect(run.status).toBe(4);
    expect(json(run.stdout)).toEqual({ outcome: "failed", code: null });
  });

  it("prompt without --wait reads a timeout as a failure, since nothing waited", () => {
    answer("agent-prompt", "", 1, herdrError("timeout"));
    const run = adapter(["prompt", "w1:p2", "hi"]);
    expect(run.status).toBe(4);
    expect(json(run.stdout)).toMatchObject({ outcome: "failed", code: "timeout" });
  });

  it("close exits 3 when the pane is gone and 4 when herdr fails, never claiming a send", () => {
    answer("agent-prompt", "", 1, herdrError("agent_not_found"));
    expect(adapter(["close", "w1:p2"]).status).toBe(3);
    answer("agent-prompt", "", 1, herdrError("server_unavailable"));
    const failed = adapter(["close", "w1:p2"]);
    expect(failed.status).toBe(4);
    expect(json(failed.stdout)).toMatchObject({ outcome: "failed" });
  });

  it("close types /exit, and a blocked session is refused", () => {
    answer("agent-prompt", JSON.stringify({ result: {} }));
    const run = adapter(["close", "w1:p2"]);
    expect(run.status).toBe(0);
    expect(json(run.stdout)).toEqual({ outcome: "sent" });
    expect(run.calls).toEqual([["agent", "prompt", "w1:p2", "/exit"]]);
    answer("agent-prompt", "", 1, herdrError("agent_blocked"));
    expect(adapter(["close", "w1:p2"]).status).toBe(6);
  });
});

describe("callers read what the pane tool cannot tell as unsafe (ruling 9)", () => {
  const CLOSE = join(SKILLS, "session-restart/scripts/close-outgoing.sh");
  const RELAY = join(SKILLS, "session-restart/scripts/report-to-session.sh");
  /** Claude Code's screen with an empty input box, as read-input-line.sh parses it. */
  const EMPTY_BOX = "\u23fa done\n\u2500\u2500\u2500\u2500\u2500\u2500 probe \u2500\n\u276f\u00a0\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  Model\n";

  function close(agent: Record<string, unknown>) {
    answer("agent-get", JSON.stringify({ result: { agent: herdrAgent(agent) } }));
    answer("agent-read", EMPTY_BOX);
    const transcript = join(outside, "s1.jsonl");
    writeFileSync(transcript, "");
    const run = spawnSync("bash", [CLOSE, join(stubDir, "herdr"), "w1:p2", transcript], {
      cwd: outside,
      encoding: "utf8",
      env: { PATH: process.env.PATH, STUB_DIR: stubDir },
      timeout: 10_000,
    });
    const calls = readFileSync(join(stubDir, "calls.log"), "utf8");
    return { ...run, prompted: /^agent\tprompt/m.test(calls) };
  }

  it("close-outgoing.sh types /exit into an idle, unfocused pane holding the outgoing session", () => {
    const run = close({});
    expect(run.stdout).toMatch(/^sent \/exit/);
    expect(run.prompted).toBe(true);
  });

  it("close-outgoing.sh reports not sent when the pane tool refuses the close", () => {
    answer("agent-prompt", "", 1, herdrError("agent_blocked"));
    const run = close({});
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/^not sent: .*blocked/);
  });

  it("close-outgoing.sh types nothing through a binary with no adapter", () => {
    const orca = join(stubDir, "orca");
    writeFileSync(orca, STUB);
    chmodSync(orca, 0o755);
    const transcript = join(outside, "s1.jsonl");
    writeFileSync(transcript, "");
    const run = spawnSync("bash", [CLOSE, orca, "w1:p2", transcript], {
      cwd: outside,
      encoding: "utf8",
      env: { PATH: process.env.PATH, STUB_DIR: stubDir },
      timeout: 10_000,
    });
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/^not sent: no adapter for /);
    expect(existsSync(join(stubDir, "calls.log"))).toBe(false);
  });

  function relay(agent: Record<string, unknown>) {
    answer("agent-list", JSON.stringify({ result: { agents: [herdrAgent({ name: "lead", ...agent })] } }));
    answer("agent-read", EMPTY_BOX);
    const projects = join(outside, "projects");
    mkdirSync(join(projects, "p"), { recursive: true });
    writeFileSync(join(projects, "p", "s1.jsonl"), "");
    const run = spawnSync("bash", [RELAY, join(stubDir, "herdr"), "lead", "the helper stopped"], {
      cwd: outside,
      encoding: "utf8",
      env: { PATH: process.env.PATH, STUB_DIR: stubDir, SESSION_RESTART_PROJECTS_DIR: projects },
      timeout: 10_000,
    });
    const calls = readFileSync(join(stubDir, "calls.log"), "utf8");
    return { ...run, prompted: /^agent\tprompt/m.test(calls) };
  }

  it("report-to-session.sh relays to an idle, unfocused reporter", () => {
    const run = relay({});
    expect(run.status, run.stderr).toBe(0);
    expect(run.prompted).toBe(true);
  });

  it("report-to-session.sh holds the line for a reporter whose status it cannot tell", () => {
    const run = relay({ agent_status: "starting" });
    expect(run.status).toBe(3);
    expect(run.stderr).toMatch(/unknown/);
    expect(run.prompted).toBe(false);
  });

  it.each([
    ["focus it cannot tell", { focused: undefined }, /focused/],
    ["a session id it cannot tell", { agent_session: undefined }, /holds session none/],
    ["a status it cannot tell", { agent_status: "starting" }, /unknown/],
  ])("close-outgoing.sh types nothing given %s", (_label, agent, reason) => {
    const run = close(agent);
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/^not sent: /);
    expect(run.stdout).toMatch(reason);
    expect(run.prompted).toBe(false);
  });
});

describe("interface.md and herdr.sh stay in step", () => {
  /** The operations interface.md documents, one `### \`name\`` heading each. */
  const documented = () =>
    [...readFileSync(INTERFACE, "utf8").matchAll(/^### `([a-z-]+)`/gm)].map((m) => m[1]).sort();

  /** The operations herdr.sh accepts, from its `operations=(...)` list. */
  const accepted = () => {
    const list = /^operations=\(([^)]*)\)/m.exec(readFileSync(ADAPTER, "utf8"));
    return (list?.[1] ?? "").trim().split(/\s+/).sort();
  };

  it("documents exactly the operations herdr.sh accepts", () => {
    expect(documented().length).toBeGreaterThan(0);
    expect(accepted()).toEqual(documented());
  });

  it("documents the exit codes the adapter uses", () => {
    const text = readFileSync(INTERFACE, "utf8");
    for (const code of ["0", "2", "3", "4", "5", "6"]) expect(text).toMatch(new RegExp(`\\| ${code} \\|`));
  });
});
