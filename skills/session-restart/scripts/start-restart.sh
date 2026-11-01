#!/usr/bin/env bash
# start-restart.sh — choose the restart path from the bindings, and start the
# in-place helper when that path is open.
#
# The session-restart skill runs this in place of starting the helper by hand.
# It reads the session's bindings file (supervision-setup's), so the helper's
# pane-tool binary and report command come from bound operations, never from
# the session's say-so (KTD15). It starts the helper, detached, and writes the
# restart-pending marker only when every in-place condition holds:
#
# - the bindings are complete and bind session-restart's own table;
# - the harness is Claude Code (Codex does not restart in place yet);
# - read-pane, type-into-pane and relay-report bind one executable as a CLI,
#   and the pane-tool adapter has an implementation for it
#   (supervision-setup's scripts/adapter/<binary name>.sh): the helper speaks
#   only through the adapter, and a detached script can call nothing else;
# - this session sits in a pane the adapter can see and that answers, and the
#   reporter is live;
# - the bindings' latest transcript is this session's own;
# - the handoff's inline routing table has a row for every binding (KTD10).
#
# Prints one line, and exits:
#   0 "in-place: ..."     the helper is started and the marker written
#   3 "new-session: ..."  the in-place path is closed; take the new-session path
#   4 "fix: ..."          something the session can fix first, such as setup
#   2                     bad arguments
#
# $SESSION_RESTART_HELPER replaces the helper, for tests.

set -u

usage() {
  echo "Usage: start-restart.sh --bindings <bindings.json> --handoff <handoff.md> --reporter <session-name>" >&2
  exit 2
}

bindings="" handoff="" reporter=""
while [ $# -gt 0 ]; do
  case "$1" in
    --bindings | --handoff | --reporter) [ $# -ge 2 ] || usage ;;
    *) usage ;;
  esac
  case "$1" in
    --bindings) bindings="$2" ;;
    --handoff) handoff="$2" ;;
    --reporter) reporter="$2" ;;
  esac
  shift 2
done
[ -n "$bindings" ] && [ -n "$handoff" ] && [ -n "$reporter" ] || usage

scripts="$(cd "$(dirname "$0")" && pwd)"
helper="${SESSION_RESTART_HELPER:-$scripts/restart-in-place.sh}"

fix() { echo "fix: $*"; exit 4; }
new_session() { echo "new-session: $*"; exit 3; }

# --- the bindings -----------------------------------------------------------

[ -f "$bindings" ] || fix "no bindings file at $bindings; run supervision-setup on session-restart's own table first"
jq -e . "$bindings" >/dev/null 2>&1 || fix "$bindings is not JSON; run supervision-setup again"
jq -e '.complete' "$bindings" >/dev/null 2>&1 ||
  fix "$bindings has no completion marker; finish supervision-setup first"
jq -e '[.operations[] | select(.table == "session-restart")] | length > 0' "$bindings" >/dev/null ||
  fix "$bindings binds nothing from session-restart's own table; rerun supervision-setup so it binds that table too (its step 7)"

# Prints "<kind> <native id>" for one of session-restart's operations.
bound() {
  jq -r --arg id "$1" \
    '[.operations[] | select(.table == "session-restart" and .id == $id)][0] // {} | "\(.kind // "none") \(.native_id // "")"' \
    "$bindings"
}

harness=$(jq -r '.harness.name // ""' "$bindings")
[ "$harness" = claude-code ] ||
  new_session "the harness is ${harness:-unknown}; the in-place path runs on Claude Code only, and Codex does not restart in place yet"

backend=""
for op in read-pane type-into-pane relay-report; do
  read -r kind native <<< "$(bound "$op")"
  if [ "$kind" != cli ] || [ -z "$native" ]; then
    new_session "$op is bound as ${kind}, not as a command a shell can call"
  fi
  [ -z "$backend" ] || [ "$backend" = "$native" ] ||
    new_session "$op binds $native, a different pane tool from $backend"
  backend="$native"
done

# The binding picks the implementation: the adapter named after the binary.
adapter="$(cd "$scripts/../../supervision-setup/scripts/adapter" 2>/dev/null && pwd)/$(basename "$backend").sh"
[ -x "$adapter" ] ||
  new_session "no adapter for $backend: the pane-tool adapter has no $(basename "$backend").sh, so the helper cannot drive it"
[ -x "$backend" ] || new_session "the pane operations bind $backend, which is not an executable here"
pane_tool() { "$adapter" --bin "$backend" --timeout 30 "$@"; }

# --- the pane and the reporter ----------------------------------------------

pane=$(pane_tool self 2>/dev/null | jq -r '.pane // empty' 2>/dev/null)
[ -n "$pane" ] || new_session "this session is not in a pane the pane tool can see"
session=$(pane_tool get "$pane" 2>/dev/null | jq -r '.session // empty' 2>/dev/null)
[ -n "$session" ] || new_session "the pane tool does not answer for pane $pane with a session"
[ "$session" = "${CLAUDE_CODE_SESSION_ID:-}" ] ||
  new_session "pane $pane holds session $session, not this session (${CLAUDE_CODE_SESSION_ID:-unknown})"
rows=$(pane_tool find "$reporter" 2>/dev/null |
  jq -r '.agents[]? | "\(.pane) \(.kind // "unknown")"' 2>/dev/null)
[ -n "$rows" ] && [ "$(printf '%s\n' "$rows" | wc -l | tr -d ' ')" = 1 ] ||
  new_session "the reporter $reporter is not one live session the pane tool lists (a session it did not start may have no name there; the adapter's rename gives it one)"
read -r panes kind <<< "$rows"
[ "$panes" != "$pane" ] || fix "the reporter $reporter is this session's own pane; name another live session"
# The relay asks the reporter to tell the maintainer with AskUserQuestion.
[ "$kind" = claude ] || fix "the reporter $reporter is a $kind session, not a Claude Code one; name a Claude Code session"

# --- the transcript and the handoff -----------------------------------------

transcript=$(jq -r '.transcripts[-1].path // ""' "$bindings")
id="${CLAUDE_CODE_SESSION_ID:-}"
[ -n "$id" ] && [ "$(basename "$transcript")" = "$id.jsonl" ] && [ -f "$transcript" ] ||
  fix "the bindings' latest transcript ($transcript) is not this session's ($id); rerun supervision-setup, which appends it"

[ -f "$handoff" ] || fix "no handoff at $handoff; write it first"
# GRO-61: the resume prompt names the handoff, and the resumed session may
# start in another folder, so pass it on by its absolute path.
handoff="$(cd "$(dirname "$handoff")" && pwd)/$(basename "$handoff")"
table=$(awk '/^## /{on = ($0 ~ /^## Routing table/)} on' "$handoff")
# One row per binding, matched on its table and operation cells exactly: an id
# bound in two tables needs two rows, and one id prefixing another is no match.
missing=$(jq -r '.operations[] | "\(.table) \(.id)"' "$bindings" | while read -r t op; do
  printf '%s\n' "$table" | grep -qE "^\|[[:space:]]*${t}[[:space:]]*\|[[:space:]]*${op}[[:space:]]*\|" ||
    printf '%s ' "$t/$op"
done)
[ -z "$missing" ] ||
  fix "the handoff's \"## Routing table\" section leaves out ${missing% }; carry the filled table inline, since a successor on another machine cannot read the bindings file"

# --- start ------------------------------------------------------------------

dir="$(dirname "$handoff")"
: > "$dir/restart-pending"
nohup "$helper" --pane "$pane" --handoff "$handoff" --transcript "$transcript" --backend "$backend" \
  -- "$scripts/report-to-session.sh" "$backend" "$reporter" \
  >> "$dir/restart-helper.log" 2>&1 < /dev/null &
pid=$!
# The helper waits on the pane for minutes; one that is gone at once, as when
# another helper holds the lock, never started the restart.
sleep 0.5
if ! kill -0 "$pid" 2>/dev/null; then
  rm -f "$dir/restart-pending"
  fix "the helper exited at once; read $dir/restart-helper.log, fix what it says, and run this again"
fi
echo "in-place: the helper is running (pid $pid) on pane $pane, logging to $dir/restart-helper.log"
