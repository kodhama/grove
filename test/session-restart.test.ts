/**
 * MQ-352 (plan U6a) — the session-restart skill's in-place helper,
 * `.agents/skills/session-restart/scripts/restart-in-place.sh`, and its
 * report relay, `report-to-session.sh`, driven against a stub `herdr`.
 *
 * The helper is the one piece of the restart that types into a pane, so the
 * scenarios pin what it sends and in what order: never into a focused pane,
 * never `/clear` over a stale handoff or a working agent, never the resume
 * prompt before the clear is confirmed, and every wait bounded (KTD7 and its
 * U1 amendment in docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md).
 *
 * The stub answers `agent get` from a queue of states, one line per call
 * (`<status> <focused> <session> [<hook>]`, last line sticky; a named hook
 * runs `hook-<name>` as that state is served), swaps the queue when a
 * prompt of a given kind arrives, and logs every call along with each state
 * it served, so a test can see what the helper had just read before a send.
 * `agent read` serves the pane's screen as Claude Code draws it, with the
 * text of `draft-<pane>` sitting unsent in the input line, or else the dim
 * suggested prompt of `suggest-<pane>` (MQ-359).
 * The report command is a stub too, so a report is a line in a file, never a
 * real notification.
 * Nothing here calls a model, the network or a real herdr.
 */
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPTS = join(__dirname, "..", "skills/session-restart/scripts");
const HELPER = join(SCRIPTS, "restart-in-place.sh");
const RELAY = join(SCRIPTS, "report-to-session.sh");
const PANE = "w1:p1";

const STUB_HERDR = `#!/usr/bin/env bash
# Stub herdr for test/session-restart.test.ts. State lives in $STUB_DIR.
d="$STUB_DIR"
{ printf '%s' "$1"; shift_args=("$@"); for a in "\${shift_args[@]:1}"; do printf '\\t%s' "$a"; done; printf '\\n'; } >> "$d/calls.log"
case "$1 $2" in
  "agent get")
    [ -f "$d/get-sleep" ] && exec sleep "$(cat "$d/get-sleep")"
    line=$(head -n 1 "$d/states")
    if [ "$(wc -l < "$d/states")" -gt 1 ]; then tail -n +2 "$d/states" > "$d/states.tmp" && mv "$d/states.tmp" "$d/states"; fi
    read -r status focused session hook <<< "$line"
    printf 'served\\t%s %s %s\\n' "$status" "$focused" "$session" >> "$d/calls.log"
    [ -n "$hook" ] && bash "$d/hook-$hook"
    printf '{"id":"cli:agent:get","result":{"agent":{"agent_session":{"value":"%s"},"agent_status":"%s","focused":%s,"pane_id":"%s"}}}\\n' "$session" "$status" "$focused" "$3"
    ;;
  "agent read")
    [ -f "$d/read-fails" ] && exit 1
    [ -f "$d/screen-raw" ] && { cat "$d/screen-raw"; exit 0; }
    [ -f "$d/screen-other" ] && { printf 'a screen with no input box\\n'; exit 0; }
    # A draft holding a pasted rule line, then a blank line.
    [ -f "$d/screen-pasted-rule" ] && { printf '\u2500\u2500\u2500\u2500\u2500 probe \u2500\n\u276f\u00a0see below\n\u2500\u2500\u2500\u2500\u2500\u2500\n\n\u2500\u2500\u2500\u2500\u2500\u2500\n  Model\n'; exit 0; }
    draft=""
    [ -f "$d/draft-$3" ] && draft=$(cat "$d/draft-$3")
    # Claude Code draws a suggested prompt dim (SGR 2) in an empty box.
    [ -z "$draft" ] && [ -f "$d/suggest-$3" ] && draft=$(printf '\\033[0m\\033[2m%s\\033[0m' "$(cat "$d/suggest-$3")")
    printf '\u23fa done\n\u2500\u2500\u2500\u2500\u2500\u2500 probe \u2500\n\u276f\u00a0%s\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  Model \u00b7 status\n' "$draft"
    ;;
  "agent list")
    cat "$d/list.json"
    if [ -f "$d/list-next.json" ]; then mv "$d/list-next.json" "$d/list.json"; fi
    ;;
  "agent prompt")
    text="$4"
    case "$text" in
      /clear) kind=clear ;;
      *refresh*) kind=refresh ;;
      *Resume*) kind=resume ;;
      *) kind=relay ;;
    esac
    [ -f "$d/hook-$kind" ] && bash "$d/hook-$kind"
    [ -f "$d/after-$kind" ] && cp "$d/after-$kind" "$d/states"
    if [ -f "$d/prompt-out-$kind" ]; then cat "$d/prompt-out-$kind"; exit "$(cat "$d/prompt-code-$kind" 2>/dev/null || echo 0)"; fi
    printf '{"id":"cli:agent:prompt","result":{"type":"agent_prompt"}}\\n'
    ;;
  *)
    echo "stub herdr: unexpected call $*" >&2
    exit 64
    ;;
esac
`;

const STUB_REPORT = `#!/usr/bin/env bash
# Stub report command: appends the line; fails while $STUB_DIR/report-fails holds a positive count.
# With $STUB_DIR/report-reads-stdin present it also drains its stdin, as a careless command might.
d="$STUB_DIR"
[ -f "$d/report-reads-stdin" ] && cat > /dev/null
if [ -f "$d/report-fails" ]; then
  n=$(cat "$d/report-fails")
  if [ "$n" -gt 0 ]; then echo $((n - 1)) > "$d/report-fails"; echo "held: $1" >> "$d/report-attempts.log"; exit 3; fi
fi
printf '%s\\n' "$1" >> "$d/reports.log"
`;

let dir: string;
let handoff: string;
let transcript: string;

/** Seconds since the epoch, as the ISO timestamp a transcript line carries. */
const iso = (epochSeconds: number) => new Date(epochSeconds * 1000).toISOString();

function stubFile(name: string, body: string) {
  writeFileSync(join(dir, name), body);
}

/** States `agent get` returns, one call per line; the last line is sticky. */
function states(lines: readonly string[], file = "states") {
  stubFile(file, `${lines.join("\n")}\n`);
}

function transcriptLine(entry: Record<string, unknown>) {
  appendFileSync(transcript, `${JSON.stringify(entry)}\n`);
}

const humanPrompt = (at: number, text = "carry on") => ({
  type: "user",
  origin: { kind: "human" },
  message: { role: "user", content: text },
  timestamp: iso(at),
});
const toolResult = (at: number) => ({
  type: "user",
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "ok" }] },
  timestamp: iso(at),
});
const assistantReply = (at: number) => ({
  type: "assistant",
  message: { role: "assistant", content: [{ type: "text", text: "done" }] },
  timestamp: iso(at),
});

/** An assistant message holding one tool call, as when a question or permission dialog is open. */
const toolCall = (at: number, id = "call-1") => ({
  type: "assistant",
  message: {
    id: `msg-${id}`,
    role: "assistant",
    content: [{ type: "tool_use", id, name: "AskUserQuestion", input: {} }],
  },
  timestamp: iso(at),
});

/** Sets the handoff's modification time, the helper's measure of when it was written. */
function writeHandoff(at: number) {
  writeFileSync(handoff, "# Handoff\n");
  utimesSync(handoff, at, at);
}

/** A transcript whose last turn wrote the handoff: prompt, handoff write, tool result, reply. */
function freshTurn(now: number) {
  transcriptLine(humanPrompt(now - 20, "restart now"));
  writeHandoff(now - 15);
  transcriptLine(toolResult(now - 14));
  transcriptLine(assistantReply(now - 13));
}

interface Run {
  status: number | null;
  calls: string[][];
  prompts: string[][];
  reports: string[];
  stderr: string;
}

function runHelper(
  opts: { maxWait?: string; focusBound?: string; reportBound?: string; herdrTimeout?: string } = {},
): Run {
  const bounded = opts.herdrTimeout ? ["--herdr-timeout", opts.herdrTimeout] : [];
  const result = spawnSync(
    "bash",
    [
      HELPER,
      "--pane",
      PANE,
      "--handoff",
      handoff,
      "--transcript",
      transcript,
      "--herdr",
      join(dir, "herdr"),
      "--poll",
      "0.05",
      "--focus-bound",
      opts.focusBound ?? "0.2",
      "--max-wait",
      opts.maxWait ?? "1",
      "--clear-timeout",
      "0.25",
      "--resume-timeout",
      "1",
      "--report-bound",
      opts.reportBound ?? "0.25",
      ...bounded,
      "--",
      join(dir, "report"),
    ],
    { encoding: "utf8", env: { ...process.env, STUB_DIR: dir }, timeout: 4000 },
  );
  return collect(result.status, result.stderr);
}

function collect(status: number | null, stderr: string): Run {
  const calls = existsSync(join(dir, "calls.log"))
    ? readFileSync(join(dir, "calls.log"), "utf8")
        .trimEnd()
        .split("\n")
        .map((l) => l.split("\t"))
    : [];
  const reports = existsSync(join(dir, "reports.log"))
    ? readFileSync(join(dir, "reports.log"), "utf8").trimEnd().split("\n")
    : [];
  return {
    status,
    calls,
    prompts: calls.filter((c) => c[0] === "agent" && c[1] === "prompt"),
    reports,
    stderr,
  };
}

/**
 * KTD7 step 6: every send is gated on a fresh focus check. The state the stub
 * served last before each prompt must say unfocused.
 */
function expectEverySendGated(run: Run) {
  run.calls.forEach((call, i) => {
    if (call[1] !== "prompt") return;
    const lastServed = run.calls
      .slice(0, i)
      .filter((c) => c[0] === "served")
      .at(-1);
    expect(lastServed?.[1], `state read before sending ${call[3]}`).toMatch(/^\w+ false /);
  });
}

/** The text of each prompt sent to the pane, in order. */
const promptTexts = (run: Run) => run.prompts.map((p) => p[3]);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mq352-restart-"));
  mkdirSync(join(dir, "session"));
  handoff = join(dir, "session", "handoff.md");
  // Named after the launching session, as Claude Code names it; the helper binds to that id.
  transcript = join(dir, "session", "s1.jsonl");
  writeFileSync(transcript, "");
  stubFile("herdr", STUB_HERDR);
  stubFile("report", STUB_REPORT);
  chmodSync(join(dir, "herdr"), 0o755);
  chmodSync(join(dir, "report"), 0o755);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const now = () => Math.floor(Date.now() / 1000);

describe("restart-in-place.sh — the clear and the resume", () => {
  it("with the pane idle and unfocused, sends a bare /clear without --wait, then the resume prompt with --wait", () => {
    freshTurn(now());
    states(["idle false s1"]);
    states(["idle false s2"], "after-clear");
    const run = runHelper();
    expect(run.status, run.stderr).toBe(0);
    expect(promptTexts(run)).toHaveLength(2);
    const [clear, resume] = run.prompts;
    expect(clear?.slice(2)).toEqual([PANE, "/clear"]);
    expect(resume?.[2]).toBe(PANE);
    expect(resume?.[3]).toContain(handoff);
    expect(resume).toContain("--wait");
    expect(run.reports).toEqual([]);
    expectEverySendGated(run);
    expect(existsSync(join(dir, "session", "restart-helper.lock"))).toBe(false);
  });

  it("with the pane done and unfocused, also sends /clear", () => {
    freshTurn(now());
    states(["done false s1"]);
    states(["idle false s2"], "after-clear");
    const run = runHelper();
    expect(run.status, run.stderr).toBe(0);
    expect(promptTexts(run)[0]).toBe("/clear");
  });

  it("never passes a name argument with /clear", () => {
    freshTurn(now());
    states(["idle false s1"]);
    states(["idle false s2"], "after-clear");
    const run = runHelper();
    const clear = run.prompts.find((p) => p[3]?.startsWith("/clear"));
    expect(clear).toEqual(["agent", "prompt", PANE, "/clear"]);
  });

  it("when the stub still shows the old session after the clear, sends no resume prompt and reports the failure", () => {
    freshTurn(now());
    states(["idle false s1"]);
    const run = runHelper();
    expect(run.status).not.toBe(0);
    expect(promptTexts(run)).toEqual(["/clear"]);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/clear/i);
  });

  it("when the pane is focused after the clear, holds the resume prompt until it is unfocused again", () => {
    freshTurn(now());
    states(["idle false s1"]);
    states(
      ["idle true s2", "idle true s2", "idle true s2", "idle true s2", "idle false s2"],
      "after-clear",
    );
    const run = runHelper({ focusBound: "5" });
    expect(run.status, run.stderr).toBe(0);
    const clearAt = run.calls.findIndex((c) => c[3] === "/clear");
    const resumeAt = run.calls.findIndex((c) => c[1] === "prompt" && c[3] !== "/clear");
    expect(resumeAt).toBeGreaterThan(clearAt);
    // All four focused answers were read, plus the unfocused one, before the resume went out.
    const getsBetween = run.calls.slice(clearAt, resumeAt).filter((c) => c[1] === "get");
    expect(getsBetween.length).toBeGreaterThanOrEqual(5);
    expectEverySendGated(run);
  });

  it("rechecks focus immediately before the resume prompt, even when the wait just saw the pane unfocused", () => {
    freshTurn(now());
    states(["idle false s1"]);
    // Confirm the clear, finish the wait unfocused, then the maintainer focuses the pane.
    states(["idle false s2", "idle false s2", "idle true s2", "idle false s2"], "after-clear");
    const run = runHelper({ focusBound: "5" });
    expect(run.status, run.stderr).toBe(0);
    const clearAt = run.calls.findIndex((c) => c[3] === "/clear");
    const resumeAt = run.calls.findIndex((c) => c[1] === "prompt" && c[3] !== "/clear");
    const servedBetween = run.calls.slice(clearAt, resumeAt).filter((c) => c[0] === "served");
    expect(servedBetween.map((c) => c[1])).toContain("idle true s2");
    expectEverySendGated(run);
  });

  it("when the stub reports blocked after the resume prompt, reports it instead of retrying (R34)", () => {
    freshTurn(now());
    states(["idle false s1"]);
    states(["idle false s2"], "after-clear");
    states(["blocked false s2"], "after-resume");
    stubFile(
      "prompt-out-resume",
      '{"id":"cli:agent:prompt","result":{"type":"agent_prompt","agent_status":"blocked"}}\n',
    );
    const run = runHelper();
    expect(run.status).not.toBe(0);
    expect(promptTexts(run)).toHaveLength(2);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/blocked/i);
  });

  it("when the resume prompt starts no turn, reports it", () => {
    freshTurn(now());
    states(["idle false s1"]);
    states(["idle false s2"], "after-clear");
    stubFile(
      "prompt-out-resume",
      '{"error":{"code":"agent_prompt_stalled","message":"no working state"},"id":"cli:agent:prompt"}\n',
    );
    stubFile("prompt-code-resume", "1\n");
    const run = runHelper();
    expect(run.status).not.toBe(0);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/resume/i);
  });

  it("when the resume send fails without a JSON answer, reports it instead of counting it a success", () => {
    freshTurn(now());
    states(["idle false s1"]);
    states(["idle false s2"], "after-clear");
    stubFile("prompt-out-resume", "herdr: socket closed\n");
    stubFile("prompt-code-resume", "1\n");
    const run = runHelper();
    expect(run.status).toBe(1);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/resume prompt failed/);
    expect(run.reports[0]).not.toMatch(/\(R\d+\)/);
  });

  it("when the resumed session is done but held at a dialog, reports it (R34)", () => {
    const t = now();
    freshTurn(t);
    states(["idle false s1"]);
    states(["idle false s2"], "after-clear");
    states(["done false s2"], "after-resume");
    // The new session's transcript is named after its id and ends in an unanswered tool call.
    stubFile(
      "hook-resume",
      `printf '%s\\n' '${JSON.stringify(toolCall(t))}' >> "${join(dir, "session", "s2.jsonl")}"\n`,
    );
    const run = runHelper();
    expect(run.status).toBe(1);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/dialog/);
  });

  it("when the pane's session changed since the helper started, types nothing and reports it", () => {
    freshTurn(now());
    states(["idle false s1", "idle false s9"]);
    const run = runHelper();
    expect(run.status).toBe(1);
    expect(run.prompts).toEqual([]);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/session changed before the clear/);
  });

  it("when the pane's session changes while the handoff is stale, sends no refresh prompt into the new session and reports it", () => {
    const t = now();
    freshTurn(t);
    transcriptLine(humanPrompt(t - 5, "a maintainer message"));
    // The maintainer runs /clear or /resume by hand: a new session, held at a dialog
    // the helper cannot see, because it still reads the old session's transcript.
    states(["idle false s1", "done false s9"]);
    const run = runHelper();
    expect(run.status).toBe(1);
    expect(run.prompts).toEqual([]);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/session changed before the clear/);
  });

  it("when the pane's first readable session is not the one that launched the helper, types nothing and reports it", () => {
    freshTurn(now());
    states(["idle false s9"]);
    states(["idle false s2"], "after-clear");
    const run = runHelper();
    expect(run.status).toBe(1);
    expect(run.prompts).toEqual([]);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/s1/);
  });

  it("when the session changes again after the clear, sends no resume prompt into the replacement and reports it", () => {
    freshTurn(now());
    states(["idle false s1"]);
    states(["idle false s2", "idle false s3"], "after-clear");
    const run = runHelper({ focusBound: "5" });
    expect(run.status).toBe(1);
    expect(promptTexts(run)).toEqual(["/clear"]);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/s3/);
  });

  it.each([
    ["another session", "idle false s3"],
    ["no session id", "idle false "],
  ])(
    "when the pane shows %s after the resume prompt, reports the resume as unconfirmed",
    (_what, state) => {
      freshTurn(now());
      states(["idle false s1"]);
      states(["idle false s2"], "after-clear");
      states([state], "after-resume");
      const run = runHelper();
      expect(run.status).toBe(1);
      expect(promptTexts(run)).toHaveLength(2);
      expect(run.reports).toHaveLength(1);
      expect(run.reports[0]).toMatch(/unconfirmed/);
    },
  );

  it("when the session after the clear already existed before it (a /resume, not this clear), sends no resume prompt and reports it", () => {
    freshTurn(now());
    // s7 has history from an hour ago, so the clear did not create it.
    writeFileSync(
      join(dir, "session", "s7.jsonl"),
      `${JSON.stringify(humanPrompt(now() - 3600, "an old session"))}\n`,
    );
    states(["idle false s1"]);
    states(["idle false s7"], "after-clear");
    const run = runHelper();
    expect(run.status).toBe(1);
    expect(promptTexts(run)).toEqual(["/clear"]);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/s7/);
  });

  it("while herdr answers with no session id, sends nothing, not even a refresh prompt, and gives up at its bound", () => {
    const t = now();
    freshTurn(t);
    transcriptLine(humanPrompt(t - 5, "a maintainer message"));
    // A valid answer that omits the session, as while a hand-typed /clear or /resume replaces it.
    states(["idle false s1", "idle false "]);
    const run = runHelper();
    expect(run.status).not.toBe(0);
    expect(run.prompts).toEqual([]);
  });

  it("when the pane cannot be read after the resume prompt, reports the resume as unconfirmed instead of counting it a success", () => {
    freshTurn(now());
    states(["idle false s1"]);
    states(["idle false s2"], "after-clear");
    states(["unknown false s2"], "after-resume");
    const run = runHelper();
    expect(run.status).not.toBe(0);
    expect(promptTexts(run)).toHaveLength(2);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/unconfirmed/);
  });

  it("gives the wait after the clear its own budget", () => {
    freshTurn(now());
    // Six focused polls before the clear and six after: twelve, past a ten-poll bound in all.
    states([...Array<string>(7).fill("idle true s1"), "idle false s1"]);
    states([...Array<string>(7).fill("idle true s2"), "idle false s2"], "after-clear");
    const run = runHelper({ maxWait: "0.5", focusBound: "5" });
    expect(run.status, run.stderr).toBe(0);
    expect(promptTexts(run)).toHaveLength(2);
  });

  it("when the pane stays focused after the clear, says the session was cleared and how to resume it", () => {
    freshTurn(now());
    states(["idle false s1"]);
    states(["idle true s2"], "after-clear");
    const run = runHelper({ maxWait: "0.5", focusBound: "5" });
    expect(run.status).toBe(1);
    expect(promptTexts(run)).toEqual(["/clear"]);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/was cleared/);
    expect(run.reports[0]).toContain(
      `Resume with the session-restart skill from the handoff at ${handoff}`,
    );
  });
});

describe("restart-in-place.sh — waiting for a ready, unfocused pane", () => {
  it("while the pane is focused, sends nothing to it; past the focus bound it reports exactly once, then gives up at its overall bound", () => {
    freshTurn(now());
    states(["idle true s1"]);
    const run = runHelper({ focusBound: "0.2", maxWait: "1" });
    expect(run.status).not.toBe(0);
    expect(run.prompts).toEqual([]);
    const focusReports = run.reports.filter((r) => /focused/i.test(r) && !/gave up/i.test(r));
    expect(focusReports).toHaveLength(1);
    expect(run.reports.filter((r) => /gave up/i.test(r))).toHaveLength(1);
  });

  it("while a dialog is open (herdr says done, a tool call has no result), never sends /clear", () => {
    const t = now();
    freshTurn(t);
    transcriptLine(toolCall(t - 12));
    states(["done false s1"]);
    const run = runHelper({ maxWait: "0.6" });
    expect(run.status).toBe(1);
    expect(run.prompts).toEqual([]);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/gave up/i);
  });

  it("counts a bound's polls by rounding, not truncating (0.6s at 0.05s is twelve)", () => {
    freshTurn(now());
    states(["working false s1"]);
    const run = runHelper({ maxWait: "0.6" });
    // One read at startup, then one per poll.
    expect(run.calls.filter((c) => c[1] === "get")).toHaveLength(13);
  });

  it("bounds a herdr call that hangs, and still gives up within its bounds", () => {
    freshTurn(now());
    states(["idle false s1"]);
    stubFile("get-sleep", "10\n");
    const started = Date.now();
    const run = runHelper({ maxWait: "0.3", herdrTimeout: "0.2" });
    expect(Date.now() - started).toBeLessThan(3000);
    expect(run.status).toBe(1);
    expect(run.prompts).toEqual([]);
    expect(run.reports[0]).toMatch(/gave up/i);
  });

  it("while the agent is working, never sends /clear, and exits at its overall bound", () => {
    freshTurn(now());
    states(["working false s1"]);
    const run = runHelper({ maxWait: "0.6" });
    expect(run.status).not.toBe(0);
    expect(run.prompts).toEqual([]);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/gave up/i);
  });
});

describe("restart-in-place.sh — unsent text in the pane's input line (MQ-359)", () => {
  // herdr submits a draft together with the next prompt, so "/clear" over a
  // draft arrives as plain text (MQ-359's probe, 2026-09-29).
  const draftFile = `draft-${PANE}`;

  it("while unsent text sits in the input line, types nothing; past the focus bound it reports the draft once", () => {
    freshTurn(now());
    states(["idle false s1"]);
    stubFile(draftFile, "half a thought");
    const run = runHelper({ focusBound: "0.2", maxWait: "1" });
    expect(run.status).toBe(1);
    expect(run.prompts).toEqual([]);
    expect(run.reports.filter((r) => /unsent text/i.test(r))).toHaveLength(1);
    expect(run.reports.filter((r) => /gave up/i.test(r))).toHaveLength(1);
  });

  it("sends /clear once the input line is empty again, with nothing reported", () => {
    freshTurn(now());
    stubFile(draftFile, "half a thought");
    stubFile("hook-undraft", `rm -f "$STUB_DIR/${draftFile}"\n`);
    states(["idle false s1", "idle false s1", "idle false s1 undraft", "idle false s1"]);
    states(["idle false s2"], "after-clear");
    const run = runHelper();
    expect(run.status, run.stderr).toBe(0);
    expect(promptTexts(run)[0]).toBe("/clear");
    expect(run.reports).toEqual([]);
  });

  it("reads a dim suggested prompt in an empty box as empty, as Claude Code draws one after a clear", () => {
    freshTurn(now());
    stubFile(`suggest-${PANE}`, "check the restart helper log");
    states(["idle false s1"]);
    states(["idle false s2"], "after-clear");
    const run = runHelper();
    expect(run.status, run.stderr).toBe(0);
    expect(promptTexts(run)).toHaveLength(2);
    expect(run.reports).toEqual([]);
  });

  it("counts the hold afresh after the pane stops being held, so a short draft after a long focus is not reported", () => {
    freshTurn(now());
    stubFile("hook-draft", `echo x > "$STUB_DIR/${draftFile}"\n`);
    stubFile("hook-undraft", `rm -f "$STUB_DIR/${draftFile}"\n`);
    states([
      "idle false s1",
      "idle true s1",
      "idle true s1",
      "idle true s1",
      "working false s1 draft",
      "idle false s1",
      "idle false s1 undraft",
      "idle false s1",
    ]);
    states(["idle false s2"], "after-clear");
    const run = runHelper({ focusBound: "0.2", maxWait: "2" });
    expect(run.status, run.stderr).toBe(0);
    expect(run.reports).toEqual([]);
  });

  it("reads the input line before every send", () => {
    freshTurn(now());
    states(["idle false s1"]);
    states(["idle false s2"], "after-clear");
    const run = runHelper();
    expect(run.status, run.stderr).toBe(0);
    let sinceSend: string[][] = [];
    for (const call of run.calls) {
      if (call[1] === "prompt") {
        expect(
          sinceSend.some((c) => c[1] === "read"),
          `read before sending ${call[3]}`,
        ).toBe(true);
        sinceSend = [];
      } else sinceSend.push(call);
    }
  });

  // Fails closed: an input line the helper cannot find counts as a draft, so a
  // layout change shows as a report, never as a typed /clear.
  it.each([
    ["herdr cannot read the pane", "read-fails"],
    ["the screen has no input box the helper recognises", "screen-other"],
    ["a draft holds a pasted rule line, so the box's borders are ambiguous", "screen-pasted-rule"],
  ])(
    "types nothing when %s, and reports once that it could not read the input line",
    (_label, file) => {
      freshTurn(now());
      states(["idle false s1"]);
      stubFile(file, "");
      const run = runHelper({ focusBound: "0.2", maxWait: "1" });
      expect(run.status).toBe(1);
      expect(run.prompts).toEqual([]);
      expect(run.reports.filter((r) => /could not read the input line/i.test(r))).toHaveLength(1);
    },
  );

  it("holds the resume prompt while unsent text sits in the cleared session's input line", () => {
    freshTurn(now());
    states(["idle false s1"]);
    stubFile("hook-clear", `echo typed meanwhile > "$STUB_DIR/${draftFile}"\n`);
    states(["idle false s2"], "after-clear");
    const run = runHelper({ focusBound: "0.2", maxWait: "1" });
    expect(run.status).toBe(1);
    expect(promptTexts(run)).toEqual(["/clear"]);
    expect(run.reports.filter((r) => /unsent text/i.test(r))).toHaveLength(1);
    expect(run.reports.some((r) => /was cleared/i.test(r))).toBe(true);
  });
});

/**
 * read-input-line.sh against raw screens, styled as herdr's `--format ansi`
 * serves Claude Code's (#823 review). The live forms: a suggested prompt is
 * `❯ ESC[0mESC[2m<text>ESC[0m`, and grey text is truecolour `ESC[38;2;…m`,
 * whose `2` is a colour mode, not dim (read from idle panes, 2026-09-30).
 */
describe("read-input-line.sh — what counts as unsent text (MQ-359)", () => {
  const E = "\x1b";
  const rule = (label = "") => `${E}[0m${E}[38;2;136;136;136m${"\u2500".repeat(24)}${label}${E}[0m`;
  const screen = (...box: string[]) =>
    [
      "\u23fa done",
      rule(" probe \u2500"),
      ...box,
      rule(),
      `  ${E}[0m${E}[38;2;153;153;153mModel \u00b7 status${E}[0m`,
      "",
    ].join("\n");
  const read = (raw: string) => {
    stubFile("screen-raw", raw);
    const run = spawnSync(
      "bash",
      [join(SCRIPTS, "read-input-line.sh"), join(dir, "herdr"), PANE, "5"],
      { encoding: "utf8", env: { ...process.env, STUB_DIR: dir }, timeout: 4000 },
    );
    return { word: run.stdout.trim(), status: run.status };
  };

  it.each([
    ["an empty box", ["\u276f "]],
    ["a suggested prompt, dim and closed by a reset", [`\u276f ${E}[0m${E}[2mmerge it${E}[0m`]],
    ["a suggested prompt closed by a bare reset", [`\u276f ${E}[2mmerge it${E}[m`]],
    [
      "a suggested prompt that wraps onto a second dim line",
      [`\u276f ${E}[0m${E}[2ma long suggestion that${E}[0m`, `  ${E}[0m${E}[2mwraps${E}[0m`],
    ],
  ])("reads %s as empty", (_label, box) => {
    expect(read(screen(...box))).toEqual({ word: "empty", status: 0 });
  });

  it.each([
    ["plain typed text", ["\u276f half a thought"]],
    [
      "typed text in truecolour, whose 38;2 is no dim",
      [`\u276f ${E}[38;2;153;153;153mtyped${E}[0m`],
    ],
    ["text after a dim hint ended by a compound reset", [`\u276f ${E}[2mhint${E}[22;39m typed`]],
    ["a dim span its line never closes", [`\u276f ${E}[2mhint`]],
    ["a pasted-text chip, even drawn dim", [`\u276f ${E}[2m[Pasted text #1 +20 lines]${E}[22m`]],
    ["a multi-line draft", ["\u276f first line", "  second line"]],
    ["a draft of newlines only", ["\u276f ", "  "]],
    ["a dialog whose selected option opens the box", ["\u276f 1. Yes", "  2. No"]],
  ])("reads %s as a draft", (_label, box) => {
    expect(read(screen(...box))).toEqual({ word: "draft", status: 1 });
  });

  it("reads a question dialog, as drawn live on 2026-09-29, as unreadable", () => {
    const raw = screen(
      "  4. Chat about this",
      "",
      "Enter to select \u00b7 \u2191/\u2193 to navigate \u00b7 Esc to cancel",
    );
    expect(read(raw)).toEqual({ word: "unreadable", status: 1 });
  });
});

/**
 * The new-session successor closes the outgoing session through a script that
 * makes the helper's own checks right before the send (R35, #823 review):
 * herdr shows a dialog as `done`, so a model reading the pane alone could type
 * `/exit` and Enter into a permission dialog.
 */
describe("close-outgoing.sh — the successor's close of the outgoing session (R35)", () => {
  const close = () => {
    const r = spawnSync(
      "bash",
      [join(SCRIPTS, "close-outgoing.sh"), join(dir, "herdr"), PANE, transcript],
      { encoding: "utf8", env: { ...process.env, STUB_DIR: dir }, timeout: 4000 },
    );
    return { ...collect(r.status, r.stderr), stdout: r.stdout.trim() };
  };

  it("types /exit once the transcript, the input line and then a fresh pane read all allow it", () => {
    transcriptLine(assistantReply(now()));
    states(["done false s1"]);
    const run = close();
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toBe("sent /exit");
    expect(promptTexts(run)).toEqual(["/exit"]);
    expectEverySendGated(run);
    expect(run.calls.filter((c) => c[0] === "agent").map((c) => c[1])).toEqual([
      "read",
      "get",
      "prompt",
    ]);
  });

  it.each([
    [
      "the outgoing session is at a dialog",
      () => {
        transcriptLine(toolCall(now()));
        states(["done false s1"]);
      },
      /dialog/,
    ],
    [
      "its input line holds unsent text",
      () => {
        stubFile(`draft-${PANE}`, "half a thought");
        states(["idle false s1"]);
      },
      /input line is draft/,
    ],
    ["the pane is focused", () => states(["idle true s1"]), /focused/],
    ["the pane holds another session", () => states(["idle false s9"]), /holds session s9/],
    ["the session is working", () => states(["working false s1"]), /is working/],
  ])("types nothing when %s", (_label, arrange, why) => {
    arrange();
    const run = close();
    expect(run.status).toBe(1);
    expect(run.prompts).toEqual([]);
    expect(run.stdout).toMatch(why);
  });
});

describe("restart-in-place.sh — the handoff freshness check (KTD7 step 3)", () => {
  it("does not send /clear when the latest incoming entry is newer than the handoff", () => {
    const t = now();
    freshTurn(t);
    transcriptLine(humanPrompt(t - 5, "one more thing"));
    states(["idle false s1"]);
    const run = runHelper({ maxWait: "0.8" });
    expect(promptTexts(run)).not.toContain("/clear");
  });

  it("skips a malformed transcript line instead of failing open", () => {
    const t = now();
    freshTurn(t);
    appendFileSync(transcript, "{not json\n");
    transcriptLine(humanPrompt(t - 5, "one more thing"));
    states(["idle false s1"]);
    const run = runHelper({ maxWait: "0.8" });
    expect(promptTexts(run)).not.toContain("/clear");
  });

  it.each([
    // Lands as the wait reads the pane: the freshness check after the wait sees it.
    ["the wait", ["idle false s1", "idle false s1 late", "idle false s1"]],
    // Lands as the final gate reads the pane: herdr shows the agent working in that same read.
    [
      "the final gate",
      ["idle false s1", "idle false s1", "working false s1 late", "idle false s1"],
    ],
  ])("does not send /clear when a message lands during %s", (_when, lines) => {
    const t = now();
    freshTurn(t);
    states(lines);
    stubFile(
      "hook-late",
      `printf '%s\\n' '${JSON.stringify(humanPrompt(t - 5, "late"))}' >> "${transcript}"\n`,
    );
    const run = runHelper();
    expect(promptTexts(run)).not.toContain("/clear");
    expect(promptTexts(run)[0]).toMatch(/refresh/);
  });

  it("sends /clear when only the handoff-writing turn's own tool result and reply follow the handoff", () => {
    freshTurn(now());
    states(["idle false s1"]);
    states(["idle false s2"], "after-clear");
    const run = runHelper();
    expect(run.status, run.stderr).toBe(0);
    expect(promptTexts(run)[0]).toBe("/clear");
  });

  it("counts a queued mid-turn message as incoming, but not an injected skill body", () => {
    const t = now();
    freshTurn(t);
    transcriptLine({
      type: "user",
      isMeta: true,
      message: { role: "user", content: [{ type: "text", text: "Base directory for this skill" }] },
      timestamp: iso(t - 12),
    });
    states(["idle false s1"]);
    states(["idle false s2"], "after-clear");
    expect(promptTexts(runHelper())[0]).toBe("/clear");

    rmSync(join(dir, "calls.log"));
    states(["idle false s1"]);
    transcriptLine({
      type: "attachment",
      attachment: { type: "queued_command", prompt: "a peer message" },
      timestamp: iso(t - 10),
    });
    expect(promptTexts(runHelper({ maxWait: "0.8" }))).not.toContain("/clear");
  });

  it("after an intervening turn that did not refresh the handoff, sends a refresh prompt naming session-restart, and clears only once the handoff is newer", () => {
    const t = now();
    freshTurn(t);
    transcriptLine(humanPrompt(t - 5, "a maintainer message"));
    transcriptLine(assistantReply(t - 4));
    states(["idle false s1"]);
    // The refresh turn: its incoming prompt lands, then the session rewrites the handoff.
    stubFile(
      "hook-refresh",
      `printf '%s\\n' '${JSON.stringify(humanPrompt(t - 2, "refresh"))}' >> "${transcript}"
touch -t "$(date -r $((${t} + 30)) +%Y%m%d%H%M.%S 2>/dev/null || date -d @$((${t} + 30)) +%Y%m%d%H%M.%S)" "${handoff}"
`,
    );
    states(["idle false s2"], "after-clear");
    const run = runHelper();
    expect(run.status, run.stderr).toBe(0);
    const texts = promptTexts(run);
    expect(texts[0]).toMatch(/session-restart/);
    expect(texts[0]).toMatch(/refresh/);
    expect(texts[0]).toContain(handoff);
    expect(texts[1]).toBe("/clear");
    expectEverySendGated(run);
  });

  it("after three stale rounds, reports once and never sends /clear", () => {
    const t = now();
    freshTurn(t);
    transcriptLine(humanPrompt(t - 5, "a maintainer message"));
    states(["idle false s1"]);
    const run = runHelper();
    expect(run.status).not.toBe(0);
    const texts = promptTexts(run);
    expect(texts).toHaveLength(3);
    expect(texts.every((x) => /refresh/.test(x ?? ""))).toBe(true);
    expect(texts).not.toContain("/clear");
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/stale/i);
  });

  it("reports and clears nothing when the transcript is missing", () => {
    writeHandoff(now() - 10);
    rmSync(transcript);
    states(["idle false s1"]);
    const run = runHelper();
    expect(run.status).not.toBe(0);
    expect(run.prompts).toEqual([]);
    expect(run.reports[0]).toMatch(/transcript/i);
  });
});

describe("restart-in-place.sh — reports that cannot be delivered yet", () => {
  it("holds an undelivered report beside the handoff and retries it within the report bound", () => {
    freshTurn(now());
    states(["idle false s1"]);
    stubFile("report-fails", "2\n");
    const run = runHelper({ reportBound: "1" });
    expect(run.status).not.toBe(0);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/clear/i);
    const held = readFileSync(join(dir, "session", "restart-unreported.txt"), "utf8");
    expect(held).toBe("");
  });

  it("stops retrying at the report bound and leaves the line in the status file", () => {
    freshTurn(now());
    states(["idle false s1"]);
    stubFile("report-fails", "1000\n");
    const run = runHelper({ reportBound: "0.2" });
    expect(run.status).not.toBe(0);
    expect(run.reports).toEqual([]);
    const held = readFileSync(join(dir, "session", "restart-unreported.txt"), "utf8");
    expect(held).toMatch(/clear/i);
  });

  it("keeps the report command off the held-lines file, so it cannot swallow them", () => {
    freshTurn(now());
    states(["working false s1"]);
    writeFileSync(join(dir, "session", "restart-unreported.txt"), "held one\nheld two\n");
    stubFile("report-reads-stdin", "");
    const run = runHelper({ maxWait: "0.3" });
    expect(run.reports.slice(0, 2)).toEqual(["held one", "held two"]);
  });
});

describe("restart-in-place.sh — arguments", () => {
  it("refuses to start without a report command, and types nothing", () => {
    freshTurn(now());
    states(["idle false s1"]);
    const result = spawnSync(
      "bash",
      [
        HELPER,
        "--pane",
        PANE,
        "--handoff",
        handoff,
        "--transcript",
        transcript,
        "--herdr",
        join(dir, "herdr"),
      ],
      { encoding: "utf8", env: { ...process.env, STUB_DIR: dir }, timeout: 4000 },
    );
    expect(result.status).toBe(2);
    expect(collect(result.status, result.stderr).prompts).toEqual([]);
  });

  it.each([
    ["a value flag given last with no value", ["--pane"]],
    ["a bound that is not a positive number", ["--pane", PANE, "--poll", "0", "--", "true"]],
  ])("exits 2 promptly on %s", (_label, tail) => {
    const result = spawnSync(
      "bash",
      [HELPER, "--handoff", handoff, "--transcript", transcript, "--herdr", "herdr", ...tail],
      { encoding: "utf8", timeout: 2000 },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/^Usage: restart-in-place\.sh --pane/);
  });

  it("exits 2 and types nothing while another helper holds the lock beside the handoff, and reports it so a stale lock is not silent", () => {
    freshTurn(now());
    states(["idle false s1"]);
    states(["idle false s2"], "after-clear");
    mkdirSync(join(dir, "session", "restart-helper.lock"));
    const run = runHelper();
    expect(run.status).toBe(2);
    expect(run.prompts).toEqual([]);
    expect(existsSync(join(dir, "session", "restart-helper.lock"))).toBe(true);
    expect(run.reports).toHaveLength(1);
    expect(run.reports[0]).toMatch(/restart-helper\.lock/);
  });
});

describe("report-to-session.sh — the relay to a live reporter session", () => {
  const lead = (focused: boolean, status: string) => ({
    name: "the-lead",
    pane_id: "w1:p7",
    agent_status: status,
    focused,
    agent_session: { value: "r1" },
  });
  const agentList = (...agents: object[]) =>
    JSON.stringify({ id: "cli:agent:list", result: { agents, type: "agent_list" } });
  const other = { name: "other", pane_id: "w1:p9", agent_status: "idle", focused: false };

  /** The reporter's own transcript, where the relay looks for an open dialog. */
  let reporterTranscript: string;
  beforeEach(() => {
    mkdirSync(join(dir, "projects", "-some-repo"), { recursive: true });
    reporterTranscript = join(dir, "projects", "-some-repo", "r1.jsonl");
    writeFileSync(reporterTranscript, `${JSON.stringify(assistantReply(now() - 5))}\n`);
  });

  function relay(line: string) {
    const result = spawnSync("bash", [RELAY, join(dir, "herdr"), "the-lead", line], {
      encoding: "utf8",
      env: { ...process.env, STUB_DIR: dir, SESSION_RESTART_PROJECTS_DIR: join(dir, "projects") },
      timeout: 4000,
    });
    return collect(result.status, result.stderr);
  }

  it("types the line into the reporter's pane when it is neither focused, blocked nor at a dialog", () => {
    stubFile("list.json", agentList(other, lead(false, "done")));
    const run = relay("the clear did not take in pane w1:p1");
    expect(run.status, run.stderr).toBe(0);
    expect(run.prompts).toHaveLength(1);
    expect(run.prompts[0]?.[2]).toBe("w1:p7");
    expect(run.prompts[0]?.[3]).toContain("the clear did not take in pane w1:p1");
    expect(run.prompts[0]?.[3]).toMatch(/maintainer/);
    expect(run.prompts[0]?.[3]).toMatch(/AskUserQuestion/);
  });

  it.each([
    ["focused", true, "idle"],
    ["blocked", false, "blocked"],
  ])("holds the line when the reporter's pane is %s", (_label, focused, status) => {
    stubFile("list.json", agentList(other, lead(focused, status)));
    const run = relay("a line");
    expect(run.status).toBe(3);
    expect(run.prompts).toEqual([]);
  });

  it("holds the line when the reporter shows done but a tool call of its has no result (a dialog)", () => {
    appendFileSync(reporterTranscript, `${JSON.stringify(toolCall(now()))}\n`);
    stubFile("list.json", agentList(lead(false, "done")));
    const run = relay("a line");
    expect(run.status).toBe(3);
    expect(run.prompts).toEqual([]);
  });

  it("reads the reporter's pane again after its transcript, and holds the line if it is focused by then", () => {
    stubFile("list.json", agentList(lead(false, "done")));
    stubFile("list-next.json", agentList(lead(true, "done")));
    const run = relay("a line");
    expect(run.status).toBe(3);
    expect(run.prompts).toEqual([]);
  });

  it("holds the line when unsent text sits in the reporter's input line (MQ-359)", () => {
    stubFile("list.json", agentList(lead(false, "done")));
    stubFile("draft-w1:p7", "the maintainer's half-typed reply");
    const run = relay("a line");
    expect(run.status).toBe(3);
    expect(run.prompts).toEqual([]);
  });

  it.each(["read-fails", "screen-other"])(
    "holds the line when the reporter's input line cannot be read (%s, MQ-359)",
    (file) => {
      stubFile("list.json", agentList(lead(false, "done")));
      stubFile(file, "");
      const run = relay("a line");
      expect(run.status).toBe(3);
      expect(run.prompts).toEqual([]);
    },
  );

  it("holds the line when no session has the reporter's name, or more than one has", () => {
    stubFile("list.json", agentList(other));
    expect(relay("a line").status).toBe(3);
    stubFile(
      "list.json",
      agentList(lead(false, "idle"), { ...lead(false, "idle"), pane_id: "w2:p1" }),
    );
    const run = relay("a line");
    expect(run.status).toBe(3);
    expect(run.prompts).toEqual([]);
  });
});

describe("start-restart.sh — choosing the path from the bindings (MQ-359, U6b)", () => {
  const LAUNCHER = join(SCRIPTS, "start-restart.sh");
  const EXAMPLE = join(__dirname, "fixtures/supervision/bindings.example.json");
  const PANE_OPS = ["read-pane", "type-into-pane", "relay-report", "launch-session"];

  interface Binding {
    table: string;
    id: string;
    kind: string;
    how_bound: string;
    native_id: string | null;
  }
  interface BindingsFile {
    skill: string;
    harness: { name: string };
    transcripts: { session_id: string; path: string }[];
    operations: Binding[];
    complete?: { at: string };
  }

  let bindingsPath: string;

  /** The example bindings, pointed at the stub herdr and this test's transcript. */
  function bindings(): BindingsFile {
    const file = JSON.parse(readFileSync(EXAMPLE, "utf8")) as BindingsFile;
    for (const b of file.operations) {
      if (b.table === "session-restart" && PANE_OPS.includes(b.id))
        b.native_id = join(dir, "herdr");
    }
    file.transcripts = [{ session_id: "s1", path: transcript }];
    return file;
  }

  /** A handoff whose inline table names every bound operation. */
  function handoffFor(file: BindingsFile, skip: string[] = []) {
    const rows = file.operations
      .filter((b) => !skip.includes(b.id))
      .map((b) => `| ${b.table} | ${b.id} | ${b.native_id ?? "none"} | ${b.how_bound} |`);
    writeFileSync(
      handoff,
      `# Handoff\n\n## Routing table\n\n${rows.join("\n")}\n\n## Live commitments\n\nnone\n`,
    );
  }

  function launch(file: BindingsFile | null, env: Record<string, string | undefined> = {}) {
    if (file) writeFileSync(bindingsPath, JSON.stringify(file));
    const result = spawnSync(
      "bash",
      [LAUNCHER, "--bindings", bindingsPath, "--handoff", handoff, "--reporter", "the-lead"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          STUB_DIR: dir,
          HERDR_PANE_ID: PANE,
          CLAUDE_CODE_SESSION_ID: "s1",
          SESSION_RESTART_HELPER: join(dir, "helper"),
          ...env,
        },
        timeout: 4000,
      },
    );
    const helperArgs = existsSync(join(dir, "helper-args"))
      ? readFileSync(join(dir, "helper-args"), "utf8").trimEnd().split("\n")
      : null;
    return { ...result, helperArgs, marker: existsSync(join(dir, "session", "restart-pending")) };
  }

  beforeEach(() => {
    bindingsPath = join(dir, "session", "bindings.json");
    // The stub helper stays up a moment, as the real one waits on the pane.
    stubFile(
      "helper",
      `#!/usr/bin/env bash\nprintf '%s\\n' "$@" > "$STUB_DIR/helper-args"\nsleep 2\n`,
    );
    chmodSync(join(dir, "helper"), 0o755);
    states(["idle false s1"]);
    stubFile(
      "list.json",
      JSON.stringify({
        id: "cli:agent:list",
        result: {
          agents: [
            {
              name: "the-lead",
              agent: "claude",
              pane_id: "w1:p7",
              agent_status: "idle",
              focused: false,
            },
          ],
        },
      }),
    );
  });

  /** Waits briefly for the detached stub helper to record its arguments. */
  function settle(run: ReturnType<typeof launch>) {
    for (let i = 0; i < 40 && !existsSync(join(dir, "helper-args")); i++)
      spawnSync("sleep", ["0.05"]);
    return {
      ...run,
      helperArgs: readFileSync(join(dir, "helper-args"), "utf8").trimEnd().split("\n"),
    };
  }

  it("with herdr bound for the pane and the relay, starts the helper on the bound herdr and writes the marker", () => {
    const file = bindings();
    handoffFor(file);
    const run = settle(launch(file));
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^in-place/);
    expect(run.marker).toBe(true);
    const args = run.helperArgs;
    expect(args.slice(0, 8)).toEqual([
      "--pane",
      PANE,
      "--handoff",
      handoff,
      "--transcript",
      transcript,
      "--herdr",
      join(dir, "herdr"),
    ]);
    expect(args.slice(args.indexOf("--") + 1)).toEqual([
      join(SCRIPTS, "report-to-session.sh"),
      join(dir, "herdr"),
      "the-lead",
    ]);
  });

  it("a session with no level skill restarts once session-restart's own table is bound, and its handoff carries that table", () => {
    const file = bindings();
    file.skill = "session-restart";
    file.operations = file.operations.filter((b) => b.table === "session-restart");
    handoffFor(file);
    const run = settle(launch(file));
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^in-place/);
  });

  it.each([
    ["unavailable", { kind: "none", how_bound: "unavailable", native_id: null }],
    ["bound to a tool, which a shell cannot call", { kind: "tool", native_id: "SendMessage" }],
  ])(
    "when the report operation is %s, takes the new-session path and never starts the helper",
    (_label, change) => {
      const file = bindings();
      Object.assign(
        file.operations.find((b) => b.table === "session-restart" && b.id === "relay-report") ?? {},
        change,
      );
      handoffFor(file);
      const run = launch(file);
      expect(run.status).toBe(3);
      expect(run.stdout).toMatch(/^new-session: .*relay-report/);
      expect(run.helperArgs).toBeNull();
      expect(run.marker).toBe(false);
    },
  );

  it.each([
    [
      "the session runs on Codex",
      (f: BindingsFile) => (f.harness.name = "codex"),
      {},
      /Codex does not restart in place yet/,
    ],
    ["no herdr pane is set", () => undefined, { HERDR_PANE_ID: undefined }, /pane/],
    ["the pane does not answer", () => stubFile("states", "unknown true \n"), {}, /pane/],
    [
      "the reporter is not live",
      () => stubFile("list.json", '{"result":{"agents":[]}}'),
      {},
      /the-lead/,
    ],
    ["the pane holds another session", () => states(["idle false s9"]), {}, /s9/],
  ])(
    "when %s, takes the new-session path and never starts the helper",
    (_label, change, env, reason) => {
      const file = bindings();
      change(file);
      handoffFor(file);
      const run = launch(file, env);
      expect(run.status).toBe(3);
      expect(run.stdout).toMatch(/^new-session: /);
      expect(run.stdout).toMatch(reason);
      expect(run.helperArgs).toBeNull();
      expect(run.marker).toBe(false);
    },
  );

  it.each([
    ["there is no bindings file", null, /supervision-setup/],
    ["the bindings are not complete", (f: BindingsFile) => delete f.complete, /supervision-setup/],
    [
      "session-restart's own table is not bound",
      (f: BindingsFile) =>
        (f.operations = f.operations.filter((b) => b.table !== "session-restart")),
      /session-restart/,
    ],
    [
      "the transcript is not this session's",
      (f: BindingsFile) => (f.transcripts = [{ session_id: "s0", path: join(dir, "s0.jsonl") }]),
      /transcript/,
    ],
  ])("refuses to start while %s, and says what to fix", (_label, change, reason) => {
    const file = change === null ? null : bindings();
    if (file && change) change(file);
    handoffFor(file ?? bindings());
    const run = launch(file);
    expect(run.status).toBe(4);
    expect(run.stdout).toMatch(/^fix: /);
    expect(run.stdout).toMatch(reason);
    expect(run.helperArgs).toBeNull();
    expect(run.marker).toBe(false);
  });

  it("refuses a reporter in this session's own pane, which would relay into the pane being restarted", () => {
    stubFile(
      "list.json",
      JSON.stringify({
        result: { agents: [{ name: "the-lead", agent: "claude", pane_id: PANE, focused: false }] },
      }),
    );
    const file = bindings();
    handoffFor(file);
    const run = launch(file);
    expect(run.status).toBe(4);
    expect(run.stdout).toMatch(/^fix: .*own pane/);
    expect(run.helperArgs).toBeNull();
  });

  it("refuses a reporter that is not a Claude Code session, which the relay asks to use AskUserQuestion (#823 review)", () => {
    stubFile(
      "list.json",
      JSON.stringify({
        result: {
          agents: [{ name: "the-lead", agent: "codex", pane_id: "w1:p7", focused: false }],
        },
      }),
    );
    const file = bindings();
    handoffFor(file);
    const run = launch(file);
    expect(run.status).toBe(4);
    expect(run.stdout).toMatch(/^fix: .*Claude Code/);
    expect(run.helperArgs).toBeNull();
    expect(run.marker).toBe(false);
  });

  it("says so, and removes the marker, when the helper exits at once instead of running (#823 review)", () => {
    stubFile("helper", "#!/usr/bin/env bash\nexit 2\n");
    const file = bindings();
    handoffFor(file);
    const run = launch(file);
    expect(run.status).toBe(4);
    expect(run.stdout).toMatch(/^fix: the helper exited at once/);
    expect(run.marker).toBe(false);
  });

  it.each([
    ["an id shared by two tables, missing from one", "session-restart", "post-work-note"],
    ["an id that prefixes another", "story-worker", "review"],
  ])("refuses a handoff whose table leaves out %s (review finding)", (_label, table, id) => {
    const file = bindings();
    const rows = file.operations
      .filter((b) => !(b.table === table && b.id === id))
      .map((b) => `| ${b.table} | ${b.id} | ${b.how_bound} |`);
    writeFileSync(handoff, `# Handoff\n\n## Routing table\n\n${rows.join("\n")}\n`);
    const run = launch(file);
    expect(run.status).toBe(4);
    expect(run.stdout).toContain(`${table}/${id}`);
    expect(run.helperArgs).toBeNull();
  });

  it("refuses to start while the handoff's inline table leaves out a bound operation (KTD10, R21)", () => {
    const file = bindings();
    handoffFor(file, ["relay-report"]);
    const run = launch(file);
    expect(run.status).toBe(4);
    expect(run.stdout).toMatch(/^fix: .*relay-report/);
    expect(run.helperArgs).toBeNull();
  });
});
