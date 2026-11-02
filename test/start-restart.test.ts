/**
 * KOD-19 (hub plan plans/grove/2026-11-01-kod-19-herdr-adapter-plan.md, U3)
 * — `start-restart.sh` choosing its pane tool through the adapter.
 *
 * The binding picks the adapter, named after the bound binary. A binary with
 * no adapter closes the in-place path with "no adapter for <binary>", and
 * the restart takes the new-session path (U9.3). The handoff reaches the
 * helper by its absolute path, so the resume prompt names a file the resumed
 * session can open from any folder (GRO-61).
 *
 * The pane tool is a stub named `herdr`, or `orca` for the binary with no
 * adapter, and the helper is a stub that records its arguments. Nothing here
 * types into a pane or calls a model or the network.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const LAUNCHER = join(__dirname, "..", "skills/session-restart/scripts/start-restart.sh");
const EXAMPLE = join(__dirname, "fixtures/supervision/bindings.example.json");
const PANE_OPS = ["read-pane", "type-into-pane", "relay-report", "launch-session"];
const PANE = "w1:p1";

/** Answers `agent get` and `agent list` as herdr would, for this one pane. */
const STUB = `#!/usr/bin/env bash
case "$1 $2" in
  "agent get") printf '{"result":{"agent":{"pane_id":"%s","agent_status":"idle","focused":false,"agent_session":{"value":"s1"}}}}\\n' "$3" ;;
  "agent list") printf '{"result":{"agents":[{"name":"the-lead","agent":"claude","pane_id":"w1:p7","agent_status":"idle","focused":false}]}}\\n' ;;
  *) exit 64 ;;
esac
`;

interface Binding {
  table: string;
  id: string;
  how_bound: string;
  native_id: string | null;
}

let dir: string;
let session: string;
let transcript: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "start-restart-"));
  session = join(dir, "session");
  mkdirSync(session);
  transcript = join(dir, "s1.jsonl");
  writeFileSync(transcript, "");
  for (const name of ["herdr", "orca"]) {
    writeFileSync(join(dir, name), STUB);
    chmodSync(join(dir, name), 0o755);
  }
  writeFileSync(
    join(dir, "helper"),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$@" > "${dir}/helper-args"\nsleep 2\n`,
  );
  chmodSync(join(dir, "helper"), 0o755);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** The example bindings, with the pane operations bound to `binary`, and their handoff. */
function prepare(binary: string) {
  const file = JSON.parse(readFileSync(EXAMPLE, "utf8")) as {
    operations: Binding[];
    transcripts: unknown[];
  };
  for (const b of file.operations) {
    if (b.table === "session-restart" && PANE_OPS.includes(b.id)) b.native_id = binary;
  }
  file.transcripts = [{ session_id: "s1", path: transcript }];
  writeFileSync(join(session, "bindings.json"), JSON.stringify(file));
  const rows = file.operations.map((b) => `| ${b.table} | ${b.id} | ${b.native_id ?? "none"} | ${b.how_bound} |`);
  writeFileSync(join(session, "handoff.md"), `# Handoff\n\n## Routing table\n\n${rows.join("\n")}\n`);
}

function launch(handoff: string, cwd = dir) {
  const result = spawnSync(
    "bash",
    [LAUNCHER, "--bindings", join(session, "bindings.json"), "--handoff", handoff, "--reporter", "the-lead"],
    {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        HERDR_PANE_ID: PANE,
        CLAUDE_CODE_SESSION_ID: "s1",
        SESSION_RESTART_HELPER: join(dir, "helper"),
      },
      timeout: 6000,
    },
  );
  return { ...result, marker: existsSync(join(session, "restart-pending")) };
}

/** The detached stub helper's arguments, once it has written them. */
function helperArgs(): string[] {
  for (let i = 0; i < 40 && !existsSync(join(dir, "helper-args")); i++) spawnSync("sleep", ["0.05"]);
  return readFileSync(join(dir, "helper-args"), "utf8").trimEnd().split("\n");
}

describe("start-restart.sh — the pane tool comes from the adapter the binding picks", () => {
  it("refuses a bound binary with no adapter as 'no adapter for <binary>', and takes the new-session path (U9.3)", () => {
    prepare(join(dir, "orca"));
    const run = launch(join(session, "handoff.md"));
    expect(run.status).toBe(3);
    expect(run.stdout).toMatch(/^new-session: /);
    expect(run.stdout).toContain(`no adapter for ${join(dir, "orca")}`);
    expect(run.marker).toBe(false);
    expect(existsSync(join(dir, "helper-args"))).toBe(false);
  });

  it("starts the helper on the bound binary when its adapter exists", () => {
    prepare(join(dir, "herdr"));
    const run = launch(join(session, "handoff.md"));
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.marker).toBe(true);
    expect(helperArgs()).toContain("--backend");
  });

  it("passes a relative --handoff on to the helper by its absolute path (GRO-61)", () => {
    prepare(join(dir, "herdr"));
    const run = launch("session/handoff.md", dir);
    expect(run.status, run.stdout + run.stderr).toBe(0);
    const args = helperArgs();
    const handoff = args[args.indexOf("--handoff") + 1] ?? "";
    expect(handoff.startsWith("/")).toBe(true);
    expect(readFileSync(handoff, "utf8")).toMatch(/^# Handoff/);
  });
});
