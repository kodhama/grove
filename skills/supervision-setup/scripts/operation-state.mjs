/**
 * MQ-377 — decide one operation's state from the calls of its bound
 * performer: whether it was used, failed, not reached, or has no evidence.
 *
 * In plain words: `receipt-check.mjs` reads every call in a session's
 * transcripts. For each operation in the bindings file, this file picks out
 * the calls of the performer bound to it and returns one row:
 *
 *   { state: "bound-but-unused",
 *     note: "called only outside a fresh-context subagent: in the main session" }
 *
 * The first rule that applies decides, in the order `receipt-check.mjs`
 * lists. A marked operation (`fresh_context = true`) counts only a call made
 * in a fresh-context subagent. When it has no use, its note says where its
 * performer was called instead, or how many of its calls in a fresh-context
 * subagent are still pending.
 *
 * Plan: docs/plans/2026-10-04-0734-feat-receipt-check-credits-calls-that-ran-plan.md,
 * R7 and KTD6; split out of `receipt-check.mjs`.
 */
import { basename } from "node:path";
import { CARRIED } from "./handoff-receipt.mjs";
import { isSubagentPlace, MAIN } from "./transcript-uses.mjs";

/** A skill or agent name after its last `:`: `compound-engineering:ce-work` gives `ce-work`. */
export function unqualified(name) {
  return name.slice(name.lastIndexOf(":") + 1);
}

/** Whether a use is a call of the performer a binding names. */
export function matches(binding, use) {
  if (binding.kind === "skill" && use.kind === "skill-script") {
    // A plugin's script names its plugin; against a plugin-qualified binding it must be that plugin's.
    return use.name.includes(":") && binding.native_id.includes(":")
      ? use.name === binding.native_id
      : unqualified(use.name) === unqualified(binding.native_id);
  }
  if (binding.kind !== use.kind) return false;
  switch (binding.kind) {
    case "skill":
    case "agent":
      // A namespaced name is the catalog's own id; only a bare one (a Codex SKILL.md read) is unqualified.
      return use.name.includes(":")
        ? use.name === binding.native_id
        : use.name === unqualified(binding.native_id);
    case "cli":
      return use.name === binding.native_id || basename(use.name) === basename(binding.native_id);
    default:
      return use.name === binding.native_id;
  }
}

/** `1 call`, `2 calls`. */
function counted(n, noun) {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/**
 * Why a marked operation's performer did not count (R7), from all its calls,
 * pending ones included. With a call in a fresh-context subagent, how many of
 * those are still pending, or null when none is; else where it was called.
 * Null when it was not called at all. With a transcript missing (`partial`),
 * the fresh call may sit in it, so the note claims only what was read.
 */
function contextNote(calls, partial) {
  const fresh = calls.filter((call) => call.fresh);
  if (fresh.length > 0) {
    const pending = fresh.filter((call) => call.outcome === "pending").length;
    return pending ? `${counted(pending, "call")} still pending in a fresh-context subagent` : null;
  }
  const places = new Set(calls.map((call) => call.context));
  if (places.size === 0) return null;
  const named = [...places].map((place) => (place === MAIN ? `the ${place}` : `a ${place}`));
  const outside = partial
    ? "called outside a fresh-context subagent in the transcripts read"
    : "called only outside a fresh-context subagent";
  return `${outside}: in ${named.join(", in ")}`;
}

/** A row with its note, when there is one. */
function noted(row, note) {
  return note ? { ...row, note } : row;
}

/**
 * The use a handoff carries for an operation, when it stands: its performer
 * is the one bound, and for a marked operation its place names a subagent:
 * the check writes a marked operation's `used` line only from a fresh-context
 * subagent.
 */
function carriedUse(binding, carried, marked) {
  if (!carried || !matches(binding, { kind: binding.kind, name: carried.performer })) return null;
  return !marked || isSubagentPlace(carried.place) ? carried : null;
}

/**
 * One operation's state, where its use was found, and a note; the first rule
 * that applies decides (plan KTD6). An allowed call is one in any transcript,
 * or for an operation the routing table marks `fresh_context`, one inside a
 * fresh-context subagent. `context` holds every call, the marked operations,
 * the handoff's carried uses, the operations declared not run, and whether a
 * listed transcript is missing. A `used` row also carries `credited`: the
 * call it was found in, or for a carried use the performer the handoff
 * names, as a use, so the caller can tell whether another operation's
 * binding matches it too.
 */
export function judge(binding, context) {
  const key = `${binding.table}/${binding.id}`;
  if (binding.how_bound === "fallback") return { state: "by fallback" };
  if (binding.how_bound === "unavailable" || !binding.native_id) return { state: "unavailable" };
  const marked = context.marked.has(key);
  const calls = context.calls.filter((call) => matches(binding, call));
  const allowed = calls.filter((call) => call.fresh || !marked);
  const ran = allowed.find((call) => call.outcome === "ran");
  if (ran) return { state: "used", where: ran.where, credited: ran };
  const carried = carriedUse(binding, context.carried.get(key), marked);
  if (carried) {
    const credited = { kind: binding.kind, name: carried.performer };
    return { state: "used", where: `${carried.place} ${CARRIED}`, credited };
  }
  const count = (outcome) => allowed.filter((call) => call.outcome === outcome).length;
  const failed = count("failed");
  if (context.notRun.has(key)) {
    return noted({ state: "not reached" }, failed && `${counted(failed, "failed call")} seen`);
  }
  if (failed && !context.missing) {
    const pending = count("pending");
    return noted(
      { state: "attempted-failed" },
      pending && `${counted(pending, "call")} still pending`,
    );
  }
  const state = context.missing ? "no evidence" : "bound-but-unused";
  return noted({ state }, marked && contextNote(calls, context.missing));
}
