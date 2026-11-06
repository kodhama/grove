/**
 * The lease: one live session per agent (spec §5.4 steps 2 and 3, errata b
 * and c, and the adoption that follows step 5).
 *
 * A manager resuming a report acquires that agent's lease before it reuses a
 * pane or starts a session, and the session it resumes adopts the lease
 * before any work. The claim is one JSON file at
 * `<home>/.kodhama/grove/local/<name>/claim` (spec §1), never committed:
 *
 *   {"state": "pending|live", "nonce", "resumer", "boot", "expires",
 *    "pane", "session"}
 *
 * - **Acquire** creates the claim exclusively, as `pending`, with a fresh
 *   nonce, the resumer, this boot's id and an expiry 10 minutes out. Where a
 *   claim exists it is read and judged: one from an earlier boot, an expired
 *   `pending` one, or a `live` one whose session the adapter says is gone is
 *   taken over by compare-and-swap on its nonce; a `live` one whose session
 *   runs, a `pending` one not yet expired, and anything that cannot be
 *   judged are left alone and reported.
 * - **Adopt** turns `pending` into `live` by compare-and-swap on the nonce,
 *   recording the session's pane and harness session id, which is what the
 *   liveness check reads later. A nonce that does not match stops the session.
 * - **Release**, on a clean exit, deletes the claim, by the same
 *   compare-and-swap.
 * - **checkPaneReuse** is step 3: right before a send, it confirms through
 *   the pane-tool adapter that a restored pane still holds the session the
 *   restart record names and is safe to type into.
 *
 * Creating the claim is a hard link from a finished temporary file, so no
 * reader ever sees a half-written claim and exactly one of several racing
 * creators wins. Every rewrite or delete runs under a lock directory beside
 * the claim. A lock left by an earlier boot is removed; one held in this boot
 * past the wait is reported, never broken.
 *
 * Pane operations go only through the adapter (`adapter/interface.md`): this
 * module reads a pane with `get`, and its input line and dialog checks are
 * session-restart's own scripts, which read the screen through the adapter
 * and the session's transcript. It never types into a pane. mycelium is never
 * called: no command that reads another agent's binding is agreed yet, so the
 * mycelium half of step 3 reads `unverified` in every case.
 */
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** A `pending` claim expires this long after it was made (spec §9c). */
export const PENDING_TTL_MS = 10 * 60 * 1000;

/** How long a caller waits for the claim's lock before it reports it held. */
export const LOCK_WAIT_MS = 2000;

/** The statuses a pane may show and still be typed into (step 3). */
const READY_STATUSES = new Set(["idle", "done"]);

/** `<home>/.kodhama/grove/local/<name>/claim` (spec §1). */
export function claimPath(home, name) {
  return join(home, ".kodhama", "grove", "local", name, "claim");
}

/**
 * This machine's boot id, or null when it cannot be read. macOS gives a
 * per-boot UUID in `kern.bootsessionuuid`; Linux gives one in
 * `/proc/sys/kernel/random/boot_id`. A caller that gets null acquires nothing:
 * without it no claim can be told apart from an earlier boot's.
 */
export function readBootId({ platform = process.platform } = {}) {
  try {
    if (platform === "darwin") {
      const r = spawnSync("sysctl", ["-n", "kern.bootsessionuuid"], { encoding: "utf8", timeout: 5000 });
      const id = r.status === 0 ? r.stdout.trim() : "";
      return id || null;
    }
    if (platform === "linux") {
      const id = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
      return id || null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Reads the claim: `{claim}`, `{missing: true}`, or `{unreadable: reason}`. */
export function readClaim(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    if (e && e.code === "ENOENT") return { missing: true };
    return { unreadable: `cannot read the claim: ${e && e.code ? e.code : e}` };
  }
  let claim;
  try {
    claim = JSON.parse(text);
  } catch {
    return { unreadable: "the claim is not JSON" };
  }
  if (
    !claim ||
    typeof claim !== "object" ||
    (claim.state !== "pending" && claim.state !== "live") ||
    typeof claim.nonce !== "string" ||
    !claim.nonce
  ) {
    return { unreadable: "the claim has no state or nonce" };
  }
  return { claim };
}

function writeTemp(file, claim) {
  const tmp = `${file}.tmp-${randomUUID()}`;
  writeFileSync(tmp, `${JSON.stringify(claim)}\n`, { flag: "wx", mode: 0o600 });
  return tmp;
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Runs `fn` while holding the lock directory `<claim>.lock`. Returns
 * `{held: false, reason}` when the lock stays taken past the wait. A lock
 * whose owner file names an earlier boot is stale and is removed once.
 */
function withLock(file, bootId, fn, { wait = LOCK_WAIT_MS } = {}) {
  const lock = `${file}.lock`;
  const deadline = Date.now() + wait;
  let clearedStale = false;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (e) {
      if (!e || e.code !== "EEXIST") return { held: false, reason: `cannot take the claim's lock: ${e && e.code}` };
    }
    if (!clearedStale) {
      clearedStale = true;
      let owner = null;
      try {
        owner = JSON.parse(readFileSync(join(lock, "owner"), "utf8"));
      } catch {
        owner = null;
      }
      if (owner && typeof owner.boot === "string" && owner.boot !== bootId) {
        rmSync(lock, { recursive: true, force: true });
        continue;
      }
    }
    if (Date.now() >= deadline) return { held: false, reason: "the claim's lock is held by another caller" };
    sleepMs(25);
  }
  try {
    writeFileSync(join(lock, "owner"), JSON.stringify({ boot: bootId, pid: process.pid }));
    return { held: true, value: fn() };
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

/**
 * Says whether a `live` claim's session still runs, by the adapter's `get`
 * on the pane the claim recorded: `running`, `gone` (the pane is gone, or it
 * holds another session), or `unknown` (the adapter failed, or could not
 * tell the session). Only `gone` permits a takeover.
 */
export function liveness(claim, adapter) {
  if (typeof claim.pane !== "string" || !claim.pane || typeof claim.session !== "string" || !claim.session) {
    return { state: "unknown", reason: "the live claim records no pane or session" };
  }
  const r = adapter.get(claim.pane);
  if (r.exit === 3) return { state: "gone", reason: "the pane is gone" };
  if (r.exit !== 0 || !r.record) return { state: "unknown", reason: `the adapter could not read the pane (exit ${r.exit})` };
  const session = r.record.session;
  if (typeof session !== "string" || !session) return { state: "unknown", reason: "the adapter cannot tell the pane's session" };
  if (session !== claim.session) return { state: "gone", reason: "the pane holds another session" };
  return { state: "running", reason: "the claim's session runs in its pane" };
}

/** Why an existing claim may be taken over, or null when it may not. */
function takeoverReason(claim, { bootId, now, adapter }) {
  if (claim.boot !== bootId) return { why: "the claim is from an earlier boot" };
  if (claim.state === "pending") {
    const expires = Date.parse(claim.expires);
    if (Number.isNaN(expires)) return { leave: "the pending claim has no readable expiry" };
    if (expires <= now) return { why: "the pending claim expired" };
    return { leave: "another resumer holds a pending claim that has not expired" };
  }
  const live = liveness(claim, adapter);
  if (live.state === "gone") return { why: `the live claim's session is gone: ${live.reason}` };
  if (live.state === "running") return { leave: "a live session holds the lease", running: true };
  return { leave: `cannot tell whether the live claim's session runs: ${live.reason}` };
}

/**
 * Step 2: acquire the lease for `name` on behalf of `resumer`.
 *
 * Returns one of:
 * - `{outcome: "acquired", claim}`: no claim existed; this one is new.
 * - `{outcome: "taken-over", claim, previous, reason}`: an earlier claim was
 *   replaced. `previous` keeps its pane and session, so step 3 can reuse
 *   the restored pane after a reboot (spec §9b).
 * - `{outcome: "left", reason, claim}`: the existing claim stays; report it.
 *   `running: true` marks the case where a live session holds it.
 * - `{outcome: "error", reason}`: nothing was written, as when the boot id
 *   cannot be read.
 */
export function acquire({ home, name, resumer, adapter, bootId = readBootId(), now = Date.now(), nonce = randomUUID() }) {
  if (!bootId) return { outcome: "error", reason: "the boot id cannot be read" };
  const file = claimPath(home, name);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const fresh = {
    state: "pending",
    nonce,
    resumer,
    boot: bootId,
    expires: new Date(now + PENDING_TTL_MS).toISOString(),
    pane: null,
    session: null,
  };

  const tmp = writeTemp(file, fresh);
  try {
    try {
      linkSync(tmp, file);
      return { outcome: "acquired", claim: fresh };
    } catch (e) {
      if (!e || e.code !== "EEXIST") return { outcome: "error", reason: `cannot create the claim: ${e && e.code}` };
    }

    const seen = readClaim(file);
    if (seen.missing) return { outcome: "left", reason: "the claim changed while it was read; try again", claim: null };
    if (seen.unreadable) return { outcome: "left", reason: seen.unreadable, claim: null };
    const verdict = takeoverReason(seen.claim, { bootId, now, adapter });
    if (verdict.leave) {
      return { outcome: "left", reason: verdict.leave, claim: seen.claim, ...(verdict.running ? { running: true } : {}) };
    }

    const locked = withLock(file, bootId, () => {
      const again = readClaim(file);
      if (!again.claim || again.claim.nonce !== seen.claim.nonce) {
        return { outcome: "left", reason: "another resumer took the claim first", claim: again.claim ?? null };
      }
      renameSync(tmp, file);
      return { outcome: "taken-over", claim: fresh, previous: seen.claim, reason: verdict.why };
    });
    if (!locked.held) return { outcome: "left", reason: locked.reason, claim: seen.claim };
    return locked.value;
  } finally {
    rmSync(tmp, { force: true });
  }
}

/**
 * Adoption: the resumed session turns its `pending` claim `live`, by
 * compare-and-swap on the nonce it was given, before any work. It records
 * the session's pane and harness session id. Re-adopting a live claim with
 * the same nonce is a no-op success.
 *
 * Returns `{outcome: "adopted", claim}`, or `{outcome: "stop", reason}`:
 * the session must stop, as when the nonce does not match.
 */
export function adopt({ home, name, nonce, pane, session, bootId = readBootId() }) {
  if (!bootId) return { outcome: "stop", reason: "the boot id cannot be read" };
  const file = claimPath(home, name);
  const locked = withLock(file, bootId, () => {
    const seen = readClaim(file);
    if (seen.missing) return { outcome: "stop", reason: "there is no claim to adopt" };
    if (seen.unreadable) return { outcome: "stop", reason: seen.unreadable };
    if (seen.claim.nonce !== nonce) return { outcome: "stop", reason: "the claim's nonce does not match" };
    const live = { ...seen.claim, state: "live", boot: bootId, expires: null, pane, session };
    const tmp = writeTemp(file, live);
    renameSync(tmp, file);
    return { outcome: "adopted", claim: live };
  });
  if (!locked.held) return { outcome: "stop", reason: locked.reason };
  return locked.value;
}

/**
 * A clean exit deletes the claim (spec §9c), only while it still carries
 * this session's nonce. Returns `{outcome: "released"}`, `{outcome: "absent"}`
 * when there is none, or `{outcome: "left", reason}` when it is another's.
 */
export function release({ home, name, nonce, bootId = readBootId() }) {
  if (!bootId) return { outcome: "left", reason: "the boot id cannot be read" };
  const file = claimPath(home, name);
  const locked = withLock(file, bootId, () => {
    const seen = readClaim(file);
    if (seen.missing) return { outcome: "absent" };
    if (seen.unreadable) return { outcome: "left", reason: seen.unreadable };
    if (seen.claim.nonce !== nonce) return { outcome: "left", reason: "the claim carries another nonce" };
    unlinkSync(file);
    return { outcome: "released" };
  });
  if (!locked.held) return { outcome: "left", reason: locked.reason };
  return locked.value;
}

/**
 * The mycelium half of step 3. No command that reads a named agent's binding
 * is agreed with mycelium yet, so this reads `unverified` whether mycelium is
 * installed or not, and never runs it. The reason says which.
 */
export function myceliumCheck({ path = process.env.PATH ?? "" } = {}) {
  const installed = path.split(delimiter).some((dir) => {
    if (!dir) return false;
    try {
      return statSync(join(dir, "mycelium")).isFile();
    } catch {
      return false;
    }
  });
  return {
    state: "unverified",
    reason: installed
      ? "mycelium is installed, but no named-binding read is agreed with it"
      : "mycelium is not installed",
  };
}

/** Runs an adapter script: `{exit, record}` for an operation printing one JSON line. */
export function scriptAdapter({ script, bin, timeout = 10 }) {
  const run = (args) => {
    const r = spawnSync(script, ["--bin", bin, "--timeout", String(timeout), ...args], {
      encoding: "utf8",
      timeout: (timeout + 5) * 1000,
    });
    const exit = r.status ?? 4;
    let record = null;
    try {
      record = JSON.parse(r.stdout.trim().split("\n").pop() ?? "");
    } catch {
      record = null;
    }
    return { exit, record };
  };
  return { bin, get: (pane) => run(["get", pane]) };
}

/** The adapter for a bound pane-tool binary: `adapter/<name>.sh` beside this file. */
export function adapterFor(bin) {
  return scriptAdapter({ script: join(HERE, "adapter", `${basename(bin)}.sh`), bin });
}

const RESTART_SCRIPTS = join(HERE, "..", "..", "session-restart", "scripts");

/** session-restart's input-line read: `empty`, `draft` or `unreadable`. */
function readInputLine(bin, pane) {
  const r = spawnSync(join(RESTART_SCRIPTS, "read-input-line.sh"), [bin, pane, "10"], { encoding: "utf8", timeout: 20000 });
  return (r.stdout || "").trim() || "unreadable";
}

/** session-restart's dialog check on the transcript: `closed` or `open`. */
function openToolCall(transcript) {
  const r = spawnSync(join(RESTART_SCRIPTS, "open-tool-call.sh"), [transcript], { encoding: "utf8", timeout: 20000 });
  return (r.stdout || "").trim() || "open";
}

/**
 * Step 3: may the restored pane be reused? `expected` is what the restart
 * record names: `{pane, name, session, transcript}`. Checked right before
 * the send, through the adapter:
 *
 * - the pane's name and harness session id match the record;
 * - it is not focused, and its status is idle or done (a resumed Claude Code
 *   at its prompt reads done);
 * - the transcript shows no open dialog, which tells a held `done` apart;
 * - its input line is empty;
 * - the mycelium binding agrees: `unverified` for now (see myceliumCheck).
 *
 * Returns `{outcome: "reuse", checks}` when all hold; `{outcome: "absent",
 * checks}` when the pane is gone, so there is nothing to reuse; otherwise
 * `{outcome: "quarantine", reason, checks}`: nothing is sent, no second
 * session is started, and the caller reports it.
 */
export function checkPaneReuse({
  expected,
  adapter,
  inputLine = (pane) => readInputLine(adapter.bin, pane),
  dialog = openToolCall,
  mycelium = () => myceliumCheck(),
}) {
  const checks = {};
  const quarantine = (reason) => ({ outcome: "quarantine", reason, checks });

  const r = adapter.get(expected.pane);
  if (r.exit === 3) {
    checks.pane = "gone";
    return { outcome: "absent", checks };
  }
  if (r.exit !== 0 || !r.record) {
    checks.pane = "unreadable";
    return quarantine(`the adapter could not read the pane (exit ${r.exit})`);
  }
  const rec = r.record;

  const nameOk = typeof rec.name === "string" && rec.name === expected.name;
  const sessionOk = typeof rec.session === "string" && !!rec.session && rec.session === expected.session;
  checks.identity = nameOk && sessionOk ? "match" : "mismatch";
  if (!nameOk || !sessionOk) {
    const what = [!nameOk && "name", !sessionOk && "session"].filter(Boolean).join(" and ");
    return quarantine(`the pane's ${what} does not match the restart record`);
  }

  checks.focused = rec.focused === false ? "no" : "yes-or-unknown";
  if (rec.focused !== false) return quarantine("the pane is focused, or its focus is unknown");

  checks.status = rec.status;
  if (!READY_STATUSES.has(rec.status)) return quarantine(`the pane is ${rec.status}, not idle or done`);

  checks.dialog = expected.transcript ? dialog(expected.transcript) : "open";
  if (checks.dialog !== "closed") return quarantine("a dialog is open, or the transcript cannot be read");

  checks.input = inputLine(expected.pane);
  if (checks.input !== "empty") return quarantine(`the input line is ${checks.input}`);

  const m = mycelium();
  checks.mycelium = m.state;
  checks.myceliumReason = m.reason;

  return { outcome: "reuse", checks };
}
