#!/usr/bin/env bash
# adapter/herdr.sh — the herdr implementation of the pane-tool adapter.
#
# This is the only file in grove that runs herdr. Every script that reads,
# types into or starts a pane calls this one instead, by path, and reads the
# neutral output interface.md beside it defines, never herdr's own. Another
# pane tool gets another file here, named after its binary, and the binding
# picks it; no caller changes.
#
#   herdr.sh [--bin <herdr-binary>] [--timeout <seconds>] <operation> [args...]
#
# --bin is the herdr the binding names (default: herdr on PATH). --timeout
# bounds each herdr call (default 30 s); an operation that waits adds its own
# wait to the bound. It needs bash, jq and perl, reads nothing of its
# caller's, and runs the same from any folder.
#
# Exit status: 0 done; 2 usage; 3 not found; 4 herdr failed, timed out or
# answered what cannot be read; 5 unsupported; 6 refused, nothing done.

set -u

operations=(self list find get read-screen prompt wait launch resume rename close remote-check remote-on schedule-list schedule-create worktree-create)

usage() {
  echo "Usage: herdr.sh [--bin <herdr-binary>] [--timeout <seconds>] <operation> [args...]" >&2
  echo "Operations: ${operations[*]} (interface.md)" >&2
  exit 2
}

positive() { awk -v x="$1" 'BEGIN { exit !(x ~ /^[0-9]*\.?[0-9]+$/ && x + 0 > 0) }'; }
whole() { [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -gt 0 ]; }

bin=herdr timeout=30
while [ $# -gt 0 ]; do
  case "$1" in
    --bin) [ $# -ge 2 ] || usage; bin="$2"; shift 2 ;;
    --timeout) [ $# -ge 2 ] && positive "$2" || usage; timeout="$2"; shift 2 ;;
    *) break ;;
  esac
done
[ $# -gt 0 ] || usage
op="$1"
shift
[[ " ${operations[*]} " == *" $op "* ]] || usage

# --- results ------------------------------------------------------------------

# Prints one JSON object built from name/value pairs (values as JSON) and exits.
result() {
  local code="$1"
  shift
  jq -cn "$@"
  exit "$code"
}

say() { echo "herdr.sh: $op: $*" >&2; }

# A field of herdr's JSON error in its last answer, or empty. herdr prints its
# error as JSON with exit 1, on stderr; it is read from stdout too, and line by
# line where a stream holds other text.
error_field() {
  local field="$1" stream value
  for stream in "$err" "$out"; do
    value=$(printf '%s' "$stream" 2>/dev/null | jq -rs --arg f "$field" '[.[] | objects | .error[$f]? // empty][0] // empty' 2>/dev/null) ||
      value=$(printf '%s\n' "$stream" 2>/dev/null | jq -rR --arg f "$field" 'fromjson? | objects | .error[$f]? // empty' 2>/dev/null | head -n 1)
    [ -z "$value" ] || { printf '%s' "$value"; return; }
  done
}

error_code() { error_field code; }

# herdr's reason for its last failure, for the human-readable line only: its
# JSON error's message if it gave one, else its stderr when it gave no JSON
# error at all. Only the first non-empty line is kept, so the reason stays one
# line; awk reads to the end, so a long stderr cannot break the pipe.
reason() {
  local msg
  msg=$(error_field message)
  [ -n "$msg" ] || [ -n "$(error_field code)" ] || msg="$err"
  printf '%s\n' "$msg" | awk 'NF && !seen { print; seen = 1 }'
}

# The line a failure says: the exit, herdr's error code if any, and its reason.
failed_line() {
  local why
  why=$(reason)
  printf 'herdr failed (exit %s%s)%s' "$rc" "${code:+, $code}" "${why:+: $why}"
}

# Runs herdr, killing it after the given seconds. macOS has no timeout(1);
# perl is on both macOS and Linux.
within() {
  local secs="$1"
  shift
  perl -MTime::HiRes=alarm -e 'alarm shift; exec @ARGV or exit 127' "$secs" "$bin" "$@"
}

# As within, setting out (stdout), err (stderr) and rc. herdr's answer is
# read from stdout only, so a warning on stderr cannot spoil it.
errfile=$(mktemp "${TMPDIR:-/tmp}/herdr-sh.XXXXXX") ||
  { say "cannot make a temporary file"; result 4 '{outcome: "failed", code: null}'; }
trap 'rm -f "$errfile"' EXIT
out="" err="" rc=0
call_within() {
  local secs="$1"
  shift
  out=$(within "$secs" "$@" 2>"$errfile")
  rc=$?
  err=$(cat "$errfile")
}
call() { call_within "$timeout" "$@"; }

# herdr's wait in milliseconds, plus the ordinary bound, in seconds.
bound_with() { awk -v ms="$1" -v t="$timeout" 'BEGIN { print ms / 1000 + t }'; }

# The neutral agent record (interface.md, "The agent record"). Whatever herdr
# cannot tell is null, and a status outside the four it reports is unknown.
RECORD='def record: {
  pane: (.pane_id // null),
  name: (.name // null),
  kind: (.agent // null),
  status: (.agent_status as $s | if ($s == "idle" or $s == "working" or $s == "blocked" or $s == "done") then $s else "unknown" end),
  focused: (if .focused == true then true elif .focused == false then false else null end),
  session: (.agent_session.value? // null | if . == "" then null else . end),
  cwd: (.cwd // null)
};'

# Exits 3 for an answer that says the pane or agent is gone, else 4.
gone_or_failed() {
  local code
  code=$(error_code)
  case "$code" in
    agent_not_found) say "not found ($code)"; result 3 --arg c "$code" '{outcome: "not-found", code: $c}' ;;
  esac
  say "$(failed_line)"
  result 4 --arg c "$code" '{outcome: "failed", code: (if $c == "" then null else $c end)}'
}

# The agent records in herdr's agent list, as a JSON array. It runs in a
# subshell, so on failure it reports and returns, and the caller exits. An
# answer with no list in it is a failure, never an empty list.
agents() {
  call agent list
  [ "$rc" -eq 0 ] || { code=$(error_code); say "$(failed_line)"; return 1; }
  printf '%s' "$out" | jq -ce "$RECORD"' .result.agents | arrays | [.[] | record]' 2>/dev/null
}

# --- operations ---------------------------------------------------------------

case "$op" in
  self)
    [ $# -eq 0 ] || usage
    [ -n "${HERDR_PANE_ID:-}" ] || { say "not in a herdr pane"; result 3 '{outcome: "not-found"}'; }
    result 0 --arg p "$HERDR_PANE_ID" '{pane: $p}'
    ;;

  list)
    [ $# -eq 0 ] || usage
    all=$(agents) && [ -n "$all" ] || { say "agent list could not be read"; result 4 '{outcome: "failed", code: null}'; }
    result 0 --argjson a "$all" '{agents: $a}'
    ;;

  find)
    [ $# -eq 1 ] || usage
    all=$(agents) && [ -n "$all" ] || { say "agent list could not be read"; result 4 '{outcome: "failed", code: null}'; }
    matches=$(printf '%s' "$all" | jq -c --arg n "$1" '[.[] | select(.name == $n)]')
    [ "$matches" != "[]" ] || { say "no live agent is named $1"; result 3 '{agents: []}'; }
    result 0 --argjson a "$matches" '{agents: $a}'
    ;;

  get)
    [ $# -eq 1 ] || usage
    call agent get "$1"
    [ "$rc" -eq 0 ] || gone_or_failed
    record=$(printf '%s' "$out" | jq -ce "$RECORD"' .result.agent | objects | record' 2>/dev/null) ||
      { say "herdr's answer could not be read"; result 4 '{outcome: "failed", code: null}'; }
    printf '%s\n' "$record"
    exit 0
    ;;

  read-screen)
    [ $# -ge 1 ] || usage
    pane="$1" source=visible format=ansi lines=()
    shift
    while [ $# -gt 0 ]; do
      case "$1" in
        --recent) source=recent-unwrapped; shift ;;
        --plain) format=text; shift ;;
        --lines) [ $# -ge 2 ] && whole "$2" || usage; lines=(--lines "$2"); shift 2 ;;
        *) usage ;;
      esac
    done
    call agent read "$pane" --source "$source" --format "$format" ${lines[@]+"${lines[@]}"}
    [ "$rc" -eq 0 ] || gone_or_failed
    printf '%s\n' "$out"
    exit 0
    ;;

  prompt)
    [ $# -eq 2 ] || [ $# -eq 4 ] || usage
    pane="$1" text="$2"
    if [ $# -eq 4 ]; then
      [ "$3" = --wait ] && whole "$4" || usage
      call_within "$(bound_with "$4")" agent prompt "$pane" "$text" --wait --timeout "$4"
      done=settled
    else
      call agent prompt "$pane" "$text"
      done=sent
    fi
    [ "$rc" -ne 0 ] || result 0 --arg o "$done" '{outcome: $o, code: null}'
    code=$(error_code)
    case "$code" in
      # Only a prompt that waited can run out of time; without --wait a
      # timeout is a failure like any other.
      timeout) [ "$done" = sent ] || result 0 '{outcome: "timeout", code: "timeout"}' ;;
      agent_blocked) say "the agent is blocked; nothing was sent"; result 6 --arg c "$code" '{outcome: "blocked", code: $c}' ;;
    esac
    gone_or_failed
    ;;

  wait)
    [ $# -eq 3 ] && [ "$2" = --wait ] && whole "$3" || usage
    call_within "$(bound_with "$3")" agent wait "$1" --timeout "$3"
    [ "$rc" -ne 0 ] || result 0 '{outcome: "settled"}'
    [ "$(error_code)" != timeout ] || result 0 '{outcome: "timeout"}'
    gone_or_failed
    ;;

  launch | resume)
    [ $# -ge 1 ] || usage
    name="$1" kind="" cwd="" session=""
    shift
    while [ $# -gt 0 ]; do
      [ "$1" != -- ] || { shift; break; }
      [ $# -ge 2 ] || usage
      case "$1" in
        --kind) kind="$2" ;;
        --cwd) cwd="$2" ;;
        --session) session="$2" ;;
        *) usage ;;
      esac
      shift 2
    done
    [ -n "$kind" ] && [ -n "$cwd" ] || usage
    args=("$@")
    if [ "$op" = resume ]; then
      [ -n "$session" ] || usage
      # Each harness's own resume arguments; a harness not listed has none here.
      # Only Claude Code's are recorded so far.
      case "$kind" in
        claude) args=(--resume "$session" ${args[@]+"${args[@]}"}) ;;
        *) say "no resume arguments are recorded for $kind"; result 5 --arg o "$op" '{outcome: "unsupported", operation: $o}' ;;
      esac
    else
      [ -z "$session" ] || usage
    fi
    # A taken name is refused before anything is made. herdr names are
    # unique among live agents.
    all=$(agents) && [ -n "$all" ] || { say "agent list could not be read"; result 4 '{outcome: "failed", code: null}'; }
    [ "$(printf '%s' "$all" | jq --arg n "$name" '[.[] | select(.name == $n)] | length')" = 0 ] ||
      { say "the name $name is taken; nothing was started"; result 6 '{outcome: "refused", code: "agent_name_taken"}'; }
    # agent start needs a pane at a shell prompt: split the caller's own,
    # which leaves focus where it is. herdr refuses a split that names no
    # direction; the new pane always opens to the right.
    call pane split --current --direction right --no-focus --cwd "$cwd"
    [ "$rc" -eq 0 ] || gone_or_failed
    pane=$(printf '%s' "$out" | jq -r '.result.pane.pane_id // empty' 2>/dev/null)
    [ -n "$pane" ] || { say "the split gave no pane"; result 4 '{outcome: "failed", code: null}'; }
    # From here a pane exists, so every result names it. agent start waits up
    # to 30 s for the agent to be ready, and a timeout does not mean it failed.
    call_within "$(bound_with 30000)" agent start "$name" --kind "$kind" --pane "$pane" -- ${args[@]+"${args[@]}"}
    [ "$rc" -ne 0 ] || result 0 --arg p "$pane" --arg n "$name" '{outcome: "started", pane: $p, name: $n}'
    code=$(error_code)
    if [ "$code" = timeout ] || [ "$rc" -ge 128 ]; then
      say "the start did not answer in time; the agent may still come up in pane $pane"
      result 0 --arg p "$pane" --arg n "$name" '{outcome: "timeout", pane: $p, name: $n}'
    fi
    say "$(failed_line); pane $pane is left at its shell"
    result 4 --arg c "$code" --arg p "$pane" '{outcome: "failed", code: (if $c == "" then null else $c end), pane: $p}'
    ;;

  rename)
    [ $# -eq 2 ] || usage
    call agent rename "$1" "$2"
    [ "$rc" -ne 0 ] || result 0 --arg p "$1" --arg n "$2" '{pane: $p, name: $n}'
    code=$(error_code)
    case "$code" in
      agent_name_taken) say "refused ($code)"; result 6 --arg c "$code" '{outcome: "refused", code: $c}' ;;
    esac
    gone_or_failed
    ;;

  close)
    [ $# -eq 1 ] || usage
    # The session ends on /exit, so a send herdr accepted is not proof that it
    # closed: the caller reads the pane afterwards.
    call agent prompt "$1" /exit
    [ "$rc" -ne 0 ] || result 0 '{outcome: "sent"}'
    [ "$(error_code)" != agent_blocked ] || { say "the agent is blocked; nothing was sent"; result 6 '{outcome: "blocked", code: "agent_blocked"}'; }
    gone_or_failed
    ;;

  remote-check | remote-on | schedule-list | schedule-create | worktree-create)
    say "unsupported by this backend"
    result 5 --arg o "$op" '{outcome: "unsupported", operation: $o}'
    ;;
esac
