/**
 * KOD-42 (U12a) — the lease, `skills/supervision-setup/scripts/lease.mjs`:
 * spec §5.4 steps 2 and 3, errata b and c, and adoption.
 *
 * Every pane read goes through a stub adapter: a JS object for most cases,
 * and once a stub adapter script run by path, as a real caller runs one.
 * Nothing here types into, prompts or closes a pane, and nothing calls a
 * model, the network or a real pane tool. mycelium is a stub on PATH that
 * logs any call, so a test can show it is never run.
 */
import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// @ts-expect-error -- no type declarations for this .mjs script
import * as lease from "../skills/supervision-setup/scripts/lease.mjs";

const LEASE = join(__dirname, "..", "skills/supervision-setup/scripts/lease.mjs");
const FIXTURES = join(__dirname, "fixtures", "lease");
const NAME = "worker-a";
const BOOT = "boot-now";
const NOW = Date.parse("2026-11-06T12:00:00Z");

type Rec = { pane: string; name: string | null; kind: string | null; status: string; focused: boolean | null; session: string | null; cwd: string | null };
type Get = { exit: number; record: Rec | null };

/** A stub adapter: `get` answers from a map of pane → result, and logs each call. */
function stubAdapter(panes: Record<string, Get>) {
  const calls: string[] = [];
  return {
    bin: "/stub/pane-tool",
    calls,
    get(pane: string): Get {
      calls.push(`get ${pane}`);
      return panes[pane] ?? { exit: 3, record: null };
    },
  };
}

function rec(over: Partial<Rec> = {}): Rec {
  return { pane: "p1", name: NAME, kind: "claude", status: "idle", focused: false, session: "sess-1", cwd: "/Users/maintainer/hub", ...over };
}

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "lease-"));
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

function writeClaim(claim: Record<string, unknown>) {
  const file = lease.claimPath(home, NAME);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, JSON.stringify(claim));
}
function readClaimFile() {
  return JSON.parse(readFileSync(lease.claimPath(home, NAME), "utf8"));
}

describe("where the claim lives (spec §1)", () => {
  it("is <home>/.kodhama/grove/local/<name>/claim", () => {
    expect(lease.claimPath("/Users/maintainer/hub", NAME)).toBe("/Users/maintainer/hub/.kodhama/grove/local/worker-a/claim");
  });
});

describe("acquire (spec §5.4 step 2)", () => {
  it("creates the claim as pending, with a nonce, the resumer, the boot id and a 10-minute expiry", () => {
    const r = lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "n1" });
    expect(r.outcome).toBe("acquired");
    expect(readClaimFile()).toEqual({
      state: "pending",
      nonce: "n1",
      resumer: "lead",
      boot: BOOT,
      expires: "2026-11-06T12:10:00.000Z",
      pane: null,
      session: null,
    });
  });

  it("acquires nothing when the boot id cannot be read", () => {
    const r = lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: null, now: NOW });
    expect(r.outcome).toBe("error");
    expect(existsSync(lease.claimPath(home, NAME))).toBe(false);
  });

  it("of racing claimants, exactly one wins", async () => {
    const racer = `
      import * as lease from ${JSON.stringify(LEASE)};
      const start = Number(process.argv[1]);
      while (Date.now() < start) {}
      const r = lease.acquire({ home: ${JSON.stringify(home)}, name: ${JSON.stringify(NAME)}, resumer: "r" + process.pid,
        adapter: { get: () => ({ exit: 4, record: null }) }, bootId: ${JSON.stringify(BOOT)} });
      console.log(r.outcome);`;
    const start = Date.now() + 400;
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () =>
        new Promise<string>((resolve, reject) => {
          const p = spawn(process.execPath, ["--input-type=module", "-e", racer, String(start)]);
          let out = "";
          p.stdout.on("data", (d) => (out += d));
          p.on("error", reject);
          p.on("close", () => resolve(out.trim()));
        }),
      ),
    );
    expect(outcomes.filter((o) => o === "acquired")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "left")).toHaveLength(5);
  });

  it("takes over a claim from an earlier boot, and keeps its pane and session for reuse (spec §9b)", () => {
    writeClaim({ state: "live", nonce: "old", resumer: "lead", boot: "boot-before", expires: null, pane: "p1", session: "sess-1" });
    const adapter = stubAdapter({});
    const r = lease.acquire({ home, name: NAME, resumer: "lead", adapter, bootId: BOOT, now: NOW, nonce: "new" });
    expect(r.outcome).toBe("taken-over");
    expect(r.previous).toMatchObject({ pane: "p1", session: "sess-1", nonce: "old" });
    expect(readClaimFile()).toMatchObject({ state: "pending", nonce: "new", boot: BOOT });
    expect(adapter.calls).toEqual([]);
  });

  it("takes over a pending claim of this boot once its 10 minutes have run out (spec §9c)", () => {
    writeClaim({ state: "pending", nonce: "old", resumer: "other", boot: BOOT, expires: "2026-11-06T11:59:59.000Z", pane: null, session: null });
    const r = lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "new" });
    expect(r.outcome).toBe("taken-over");
    expect(readClaimFile().nonce).toBe("new");
  });

  it("leaves a pending claim of this boot that has not expired", () => {
    writeClaim({ state: "pending", nonce: "old", resumer: "other", boot: BOOT, expires: "2026-11-06T12:05:00.000Z", pane: null, session: null });
    const r = lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "new" });
    expect(r.outcome).toBe("left");
    expect(readClaimFile().nonce).toBe("old");
  });

  it("leaves a live claim of this boot whose session the adapter says runs", () => {
    writeClaim({ state: "live", nonce: "old", resumer: "lead", boot: BOOT, expires: null, pane: "p1", session: "sess-1" });
    const adapter = stubAdapter({ p1: { exit: 0, record: rec() } });
    const r = lease.acquire({ home, name: NAME, resumer: "lead", adapter, bootId: BOOT, now: NOW, nonce: "new" });
    expect(r).toMatchObject({ outcome: "left", running: true });
    expect(readClaimFile().nonce).toBe("old");
    expect(adapter.calls).toEqual(["get p1"]);
  });

  it("takes over a live claim whose pane is gone, or holds another session", () => {
    writeClaim({ state: "live", nonce: "old", resumer: "lead", boot: BOOT, expires: null, pane: "p1", session: "sess-1" });
    const gone = lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "n2" });
    expect(gone.outcome).toBe("taken-over");

    writeClaim({ state: "live", nonce: "old", resumer: "lead", boot: BOOT, expires: null, pane: "p1", session: "sess-1" });
    const other = lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({ p1: { exit: 0, record: rec({ session: "sess-9" }) } }), bootId: BOOT, now: NOW, nonce: "n3" });
    expect(other.outcome).toBe("taken-over");
    expect(readClaimFile().nonce).toBe("n3");
  });

  it("leaves a live claim whose liveness cannot be told, and reports it", () => {
    for (const adapter of [
      stubAdapter({ p1: { exit: 4, record: null } }),
      stubAdapter({ p1: { exit: 0, record: rec({ session: null }) } }),
    ]) {
      writeClaim({ state: "live", nonce: "old", resumer: "lead", boot: BOOT, expires: null, pane: "p1", session: "sess-1" });
      const r = lease.acquire({ home, name: NAME, resumer: "lead", adapter, bootId: BOOT, now: NOW, nonce: "new" });
      expect(r.outcome).toBe("left");
      expect(r.reason).toMatch(/cannot tell/);
      expect(readClaimFile().nonce).toBe("old");
    }
  });

  it("leaves a claim it cannot read, and reports it", () => {
    const file = lease.claimPath(home, NAME);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, "not json");
    const r = lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "new" });
    expect(r.outcome).toBe("left");
    expect(readFileSync(file, "utf8")).toBe("not json");
  });

  it("of racing takeovers of one expired claim, exactly one wins", async () => {
    writeClaim({ state: "pending", nonce: "old", resumer: "other", boot: BOOT, expires: "2026-11-06T11:00:00.000Z", pane: null, session: null });
    const racer = `
      import * as lease from ${JSON.stringify(LEASE)};
      const start = Number(process.argv[1]);
      while (Date.now() < start) {}
      const r = lease.acquire({ home: ${JSON.stringify(home)}, name: ${JSON.stringify(NAME)}, resumer: "r" + process.pid,
        adapter: { get: () => ({ exit: 4, record: null }) }, bootId: ${JSON.stringify(BOOT)}, now: ${NOW} });
      console.log(r.outcome);`;
    const start = Date.now() + 400;
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () =>
        new Promise<string>((resolve, reject) => {
          const p = spawn(process.execPath, ["--input-type=module", "-e", racer, String(start)]);
          let out = "";
          p.stdout.on("data", (d) => (out += d));
          p.on("error", reject);
          p.on("close", () => resolve(out.trim()));
        }),
      ),
    );
    expect(outcomes.filter((o) => o === "taken-over")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "left")).toHaveLength(5);
  });

  it("removes a lock left by an earlier boot, but reports one held in this boot", () => {
    writeClaim({ state: "pending", nonce: "old", resumer: "other", boot: "boot-before", expires: null, pane: null, session: null });
    const lock = `${lease.claimPath(home, NAME)}.lock`;
    mkdirSync(lock);
    writeFileSync(join(lock, "owner"), JSON.stringify({ boot: "boot-before", pid: 1 }));
    expect(lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "n1" }).outcome).toBe("taken-over");

    writeClaim({ state: "pending", nonce: "old", resumer: "other", boot: "boot-before", expires: null, pane: null, session: null });
    mkdirSync(lock);
    writeFileSync(join(lock, "owner"), JSON.stringify({ boot: BOOT, pid: 1 }));
    const held = lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "n2" });
    expect(held).toMatchObject({ outcome: "left", reason: "the claim's lock is held by another caller" });
    expect(existsSync(lock)).toBe(true);
    expect(readClaimFile().nonce).toBe("old");
  });
});

describe("adoption and clean exit", () => {
  it("adopts pending → live by compare-and-swap on the nonce, recording pane and session", () => {
    lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "n1" });
    const r = lease.adopt({ home, name: NAME, nonce: "n1", pane: "p7", session: "sess-7", bootId: BOOT });
    expect(r.outcome).toBe("adopted");
    expect(readClaimFile()).toMatchObject({ state: "live", nonce: "n1", pane: "p7", session: "sess-7", expires: null });
  });

  it("a mismatched nonce stops the session, and the claim is untouched", () => {
    lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "n1" });
    const before = readFileSync(lease.claimPath(home, NAME), "utf8");
    const r = lease.adopt({ home, name: NAME, nonce: "stale", pane: "p7", session: "sess-7", bootId: BOOT });
    expect(r).toMatchObject({ outcome: "stop", reason: "the claim's nonce does not match" });
    expect(readFileSync(lease.claimPath(home, NAME), "utf8")).toBe(before);
  });

  it("a session resumed after a takeover adopts with the new nonce, never the old one (spec §9b)", () => {
    writeClaim({ state: "live", nonce: "old", resumer: "lead", boot: "boot-before", expires: null, pane: "p1", session: "sess-1" });
    lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "new" });
    expect(lease.adopt({ home, name: NAME, nonce: "old", pane: "p1", session: "sess-1", bootId: BOOT }).outcome).toBe("stop");
    expect(lease.adopt({ home, name: NAME, nonce: "new", pane: "p1", session: "sess-1", bootId: BOOT }).outcome).toBe("adopted");
  });

  it("stops when there is no claim to adopt", () => {
    expect(lease.adopt({ home, name: NAME, nonce: "n1", pane: "p1", session: "s", bootId: BOOT }).outcome).toBe("stop");
  });

  it("a clean exit deletes the live claim, and only its own (spec §9c)", () => {
    lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "n1" });
    lease.adopt({ home, name: NAME, nonce: "n1", pane: "p1", session: "s1", bootId: BOOT });
    expect(lease.release({ home, name: NAME, nonce: "other", bootId: BOOT }).outcome).toBe("left");
    expect(existsSync(lease.claimPath(home, NAME))).toBe(true);
    expect(lease.release({ home, name: NAME, nonce: "n1", bootId: BOOT }).outcome).toBe("released");
    expect(existsSync(lease.claimPath(home, NAME))).toBe(false);
    expect(lease.release({ home, name: NAME, nonce: "n1", bootId: BOOT }).outcome).toBe("absent");
  });

  it("after a clean exit, the next resumer acquires afresh", () => {
    lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "n1" });
    lease.release({ home, name: NAME, nonce: "n1", bootId: BOOT });
    expect(lease.acquire({ home, name: NAME, resumer: "lead", adapter: stubAdapter({}), bootId: BOOT, now: NOW, nonce: "n2" }).outcome).toBe("acquired");
  });
});

describe("pane reuse (spec §5.4 step 3)", () => {
  const expected = { pane: "p1", name: NAME, session: "sess-1", transcript: "/Users/maintainer/t.jsonl" };
  const ok = { inputLine: () => "empty", dialog: () => "closed", mycelium: () => ({ state: "unverified", reason: "mycelium is not installed" }) };

  it("reuses a pane whose name and session match and which is safe to type into, idle or done", () => {
    for (const status of ["idle", "done"]) {
      const r = lease.checkPaneReuse({ expected, adapter: stubAdapter({ p1: { exit: 0, record: rec({ status }) } }), ...ok });
      expect(r.outcome).toBe("reuse");
      expect(r.checks).toMatchObject({ identity: "match", status, dialog: "closed", input: "empty", mycelium: "unverified" });
    }
  });

  it("quarantines a pane whose identity does not match, and starts no second session", () => {
    for (const over of [{ name: "someone-else" }, { session: "sess-9" }, { session: null }]) {
      const adapter = stubAdapter({ p1: { exit: 0, record: rec(over) } });
      const r = lease.checkPaneReuse({ expected, adapter, ...ok });
      expect(r.outcome).toBe("quarantine");
      expect(r.checks.identity).toBe("mismatch");
      expect(adapter.calls).toEqual(["get p1"]);
    }
  });

  it("quarantines a pane that is focused, working, blocked, unknown, held at a dialog, or holds a draft", () => {
    const cases: Array<[Partial<Rec>, Partial<typeof ok>]> = [
      [{ focused: true }, {}],
      [{ focused: null }, {}],
      [{ status: "working" }, {}],
      [{ status: "blocked" }, {}],
      [{ status: "unknown" }, {}],
      [{ status: "done" }, { dialog: () => "open" }],
      [{}, { inputLine: () => "draft" }],
      [{}, { inputLine: () => "unreadable" }],
    ];
    for (const [over, deps] of cases) {
      const r = lease.checkPaneReuse({ expected, adapter: stubAdapter({ p1: { exit: 0, record: rec(over) } }), ...ok, ...deps });
      expect(r.outcome, JSON.stringify(over)).toBe("quarantine");
    }
  });

  it("quarantines a pane the adapter cannot read, and reads a gone pane as nothing to reuse", () => {
    expect(lease.checkPaneReuse({ expected, adapter: stubAdapter({ p1: { exit: 4, record: null } }), ...ok }).outcome).toBe("quarantine");
    expect(lease.checkPaneReuse({ expected, adapter: stubAdapter({}), ...ok }).outcome).toBe("absent");
  });

  it("treats a restart record with no transcript as a possible dialog", () => {
    const r = lease.checkPaneReuse({ expected: { ...expected, transcript: "" }, adapter: stubAdapter({ p1: { exit: 0, record: rec() } }), inputLine: ok.inputLine, mycelium: ok.mycelium });
    expect(r.outcome).toBe("quarantine");
  });

  it("reads a pane through an adapter script run by path, as a real caller does", () => {
    const r = lease.checkPaneReuse({
      expected,
      adapter: lease.scriptAdapter({ script: join(FIXTURES, "stub-adapter.sh"), bin: "/stub/pane-tool" }),
      ...ok,
    });
    expect(r.outcome).toBe("reuse");
  });
});

describe("the mycelium half of step 3", () => {
  let bin: string;
  beforeEach(() => {
    bin = mkdtempSync(join(tmpdir(), "mycelium-"));
  });
  afterEach(() => {
    rmSync(bin, { recursive: true, force: true });
  });

  it("reads unverified when mycelium is not installed", () => {
    expect(lease.myceliumCheck({ path: bin })).toEqual({ state: "unverified", reason: "mycelium is not installed" });
  });

  it("reads unverified when mycelium is installed with only whoami and paths, and never runs it", () => {
    const log = join(bin, "calls.log");
    writeFileSync(
      join(bin, "mycelium"),
      `#!/usr/bin/env bash\necho "$*" >> ${JSON.stringify(log)}\ncase "$1" in whoami) echo worker-a ;; paths) echo '{}' ;; *) exit 2 ;; esac\n`,
    );
    chmodSync(join(bin, "mycelium"), 0o755);
    expect(lease.myceliumCheck({ path: bin })).toEqual({
      state: "unverified",
      reason: "mycelium is installed, but no named-binding read is agreed with it",
    });
    expect(existsSync(log)).toBe(false);
  });
});
