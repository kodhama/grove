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
  // A claim this module did not write in full cannot be judged, so it is left
  // alone: a missing boot id is not proof of an earlier boot.
  if (typeof claim.boot !== "string" || !claim.boot) return { unreadable: "the claim has no boot id" };
  if (claim.state === "pending" && !isLeaseTime(claim.expires)) {
    return { unreadable: "the pending claim's expiry is not a timestamp the lease writes" };
  }
  return { claim };
}

/** True for a timestamp as `toISOString` writes it, and nothing else. */
function isLeaseTime(value) {
  if (typeof value !== "string") return false;
  const ms = Date.parse(value);
  return !Number.isNaN(ms) && new Date(ms).toISOString() === value;
}

const CLAIM_FIELDS = ["state", "nonce", "resumer", "boot", "expires", "pane", "session"];

/** Whether two claims are the same in every field the lease writes. */
function sameClaim(a, b) {
  return CLAIM_FIELDS.every((k) => a[k] === b[k]);
}

function writeTemp(file, claim) {
  const tmp = `${file}.tmp-${randomUUID()}`;
  writeFileSync(tmp, `${JSON.stringify(claim)}\n`, { flag: "wx", mode: 0o600 });
  return tmp;
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** The lock's owner record, or null when there is none or it cannot be read. */
function lockOwner(lock) {
  try {
    return JSON.parse(readFileSync(join(lock, "owner"), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Takes the lock as one atomic step: a temporary directory holding the owner
 * record is renamed into place, so the lock never exists without its owner.
 * Returns "held", "busy", or a reason it cannot be taken.
 */
function tryLock(lock, bootId, token) {
  const tmp = `${lock}.tmp-${token}`;
  try {
    mkdirSync(tmp);
    writeFileSync(join(tmp, "owner"), JSON.stringify({ boot: bootId, pid: process.pid, token }));
    renameSync(tmp, lock);
    return "held";
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    if (e && (e.code === "EEXIST" || e.code === "ENOTEMPTY")) return "busy";
    return `cannot take the claim's lock: ${e && e.code}`;
  }
}

/**
 * Removes a lock an earlier boot left, under a breaker directory named for
 * this boot, re-reading the owner inside it: of several callers that saw the
 * same stale lock, only one removes it, and none removes the lock a
 * successor took meanwhile. A breaker from an earlier boot has another name,
 * so it never blocks this one.
 */
function breakStaleLock(lock, bootId) {
  const owner = lockOwner(lock);
  if (!owner || typeof owner.boot !== "string" || owner.boot === bootId) return;
  const breaker = `${lock}.break-${bootId}`;
  try {
    mkdirSync(breaker);
  } catch {
    return;
  }
  try {
    const again = lockOwner(lock);
    if (again && typeof again.boot === "string" && again.boot !== bootId) rmSync(lock, { recursive: true, force: true });
  } finally {
    rmSync(breaker, { recursive: true, force: true });
  }
}

/**
 * Runs `fn` while holding the lock directory `<claim>.lock`. Returns
 * `{held: false, reason}` when the lock stays taken past the wait. A lock
 * whose owner names an earlier boot is stale and is removed; one held in
 * this boot is never broken. Only the holder removes its own lock.
 */
function withLock(file, bootId, fn, { wait = LOCK_WAIT_MS } = {}) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const lock = `${file}.lock`;
  const token = randomUUID();
  const deadline = Date.now() + wait;
  for (;;) {
    const got = tryLock(lock, bootId, token);
    if (got === "held") break;
    if (got !== "busy") return { held: false, reason: got };
    breakStaleLock(lock, bootId);
    if (Date.now() >= deadline) return { held: false, reason: "the claim's lock is held by another caller" };
    sleepMs(25);
  }
  try {
    return { held: true, value: fn() };
  } finally {
    if (lockOwner(lock)?.token === token) rmSync(lock, { recursive: true, force: true });
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
    if (Date.parse(claim.expires) <= now) return { why: "the pending claim expired" };
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

  let tmp;
  try {
    tmp = writeTemp(file, fresh);
  } catch (e) {
    return { outcome: "error", reason: `cannot write the claim: ${e && e.code}` };
  }
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
      // The swap holds only if the claim is still the one judged: the same
      // nonce is not enough, since adoption keeps the nonce.
      if (!again.claim || !sameClaim(again.claim, seen.claim)) {
        return { outcome: "left", reason: "the claim changed after it was judged; try again", claim: again.claim ?? null };
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
 * the session's pane and harness session id. The holder re-adopting its
 * live claim from the same pane and session is a no-op success.
 *
 * Returns `{outcome: "adopted", claim}`, or `{outcome: "stop", reason}`:
 * the session must stop, as when the nonce does not match, the claim is from
 * an earlier boot (the resumed session gets the new nonce, spec §9b), the
 * pending claim has expired, or another session already holds it live.
 */
export function adopt({ home, name, nonce, pane, session, bootId = readBootId(), now = Date.now() }) {
  if (!bootId) return { outcome: "stop", reason: "the boot id cannot be read" };
  const file = claimPath(home, name);
  const locked = withLock(file, bootId, () => {
    const seen = readClaim(file);
    if (seen.missing) return { outcome: "stop", reason: "there is no claim to adopt" };
    if (seen.unreadable) return { outcome: "stop", reason: seen.unreadable };
    const claim = seen.claim;
    if (claim.nonce !== nonce) return { outcome: "stop", reason: "the claim's nonce does not match" };
    if (claim.boot !== bootId) return { outcome: "stop", reason: "the claim is from an earlier boot" };
    if (claim.state === "live") {
      if (claim.pane === pane && claim.session === session) return { outcome: "adopted", claim };
      return { outcome: "stop", reason: "another session holds the live lease" };
    }
    if (Date.parse(claim.expires) <= now) return { outcome: "stop", reason: "the pending claim expired" };
    const live = { ...claim, state: "live", expires: null, pane, session };
    const tmp = writeTemp(file, live);
    try {
      renameSync(tmp, file);
    } finally {
      rmSync(tmp, { force: true });
    }
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
 * One adapter read of the pane, judged against the restart record: its
 * identity, focus and status, filled into `checks`. Returns `{absent}` for a
 * gone pane, `{problem}` for one that fails, or `{}` when it passes.
 */
function readPane(adapter, expected, checks) {
  const r = adapter.get(expected.pane);
  if (r.exit === 3) {
    checks.pane = "gone";
    return { absent: true };
  }
  if (r.exit !== 0 || !r.record) {
    checks.pane = "unreadable";
    return { problem: `the adapter could not read the pane (exit ${r.exit})` };
  }
  const rec = r.record;

  const nameOk = typeof rec.name === "string" && rec.name === expected.name;
  const sessionOk = typeof rec.session === "string" && !!rec.session && rec.session === expected.session;
  checks.identity = nameOk && sessionOk ? "match" : "mismatch";
  if (!nameOk || !sessionOk) {
    const what = [!nameOk && "name", !sessionOk && "session"].filter(Boolean).join(" and ");
    return { problem: `the pane's ${what} does not match the restart record` };
  }

  checks.focused = rec.focused === false ? "no" : "yes-or-unknown";
  if (rec.focused !== false) return { problem: "the pane is focused, or its focus is unknown" };

  checks.status = rec.status;
  if (!READY_STATUSES.has(rec.status)) return { problem: `the pane is ${rec.status}, not idle or done` };
  return {};
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

  const first = readPane(adapter, expected, checks);
  if (first.absent) return { outcome: "absent", checks };
  if (first.problem) return quarantine(first.problem);

  checks.dialog = expected.transcript ? dialog(expected.transcript) : "open";
  if (checks.dialog !== "closed") return quarantine("a dialog is open, or the transcript cannot be read");

  checks.input = inputLine(expected.pane);
  if (checks.input !== "empty") return quarantine(`the input line is ${checks.input}`);

  // The pane is read again last, so the answer describes the pane as it is
  // right before the send, not as it was before the slower checks ran.
  const last = readPane(adapter, expected, {});
  if (last.absent || last.problem) return quarantine(`the pane changed during the checks: ${last.problem ?? "it is gone"}`);

  const m = mycelium();
  checks.mycelium = m.state;
  checks.myceliumReason = m.reason;

  return { outcome: "reuse", checks };
}
