#!/usr/bin/env bash
# close-outgoing.sh — the new-session successor's close of the outgoing session.
#
# The outgoing session cannot exit itself (R35), so its successor types /exit
# into its pane, and only when the checks the in-place helper makes before a
# send all pass, read right before the send: no open tool call in the outgoing
# transcript (open-tool-call.sh; a pane tool can show a dialog as `done`), an
# empty input line (read-input-line.sh), and then a fresh pane read showing it
# idle or done, unfocused, and still holding the outgoing session, named by
# its transcript (<session-id>.jsonl). One attempt, each pane-tool call bounded
# by $SESSION_RESTART_HERDR_TIMEOUT seconds (default 30); it never waits.
#
# Every pane-tool call goes through the adapter for the backend binary
# (supervision-setup's scripts/adapter/<binary name>.sh); a binary with none
# is never typed into.
#
# Prints `sent /exit` or `not sent: <why>`. Exit status: 0 sent; 1 not sent;
# 2 bad arguments.

set -u
if [ $# -ne 3 ]; then
  echo "Usage: close-outgoing.sh <backend-binary> <pane-id> <outgoing-transcript>" >&2
  exit 2
fi
backend="$1" pane="$2" transcript="$3"
backend_timeout="${SESSION_RESTART_HERDR_TIMEOUT:-30}"
scripts="$(cd "$(dirname "$0")" && pwd)"
adapter="$(cd "$scripts/../../supervision-setup/scripts/adapter" 2>/dev/null && pwd)/$(basename "$backend").sh"
expected="$(basename "$transcript" .jsonl)"

pane_tool() { "$adapter" --bin "$backend" --timeout "$backend_timeout" "$@"; }
refuse() {
  echo "not sent: $*"
  exit 1
}

[ -x "$adapter" ] || refuse "no adapter for $backend"
[ -f "$transcript" ] || refuse "the outgoing transcript $transcript does not exist"
"$scripts/open-tool-call.sh" "$transcript" >/dev/null ||
  refuse "the outgoing session is at a dialog, or its transcript cannot be read"
input=$("$scripts/read-input-line.sh" "$backend" "$pane" "$backend_timeout" 2>/dev/null) ||
  refuse "its input line is $input"

# The pane read comes last, so the focus read is the newest thing the send rests on.
out=$(pane_tool get "$pane" 2>/dev/null) || refuse "the pane tool cannot read pane $pane"
read -r status focused session < <(printf '%s' "$out" |
  jq -r '"\(.status // "unknown") \(.focused == false | not) \(.session // "")"' 2>/dev/null)
[ "${session:-}" = "$expected" ] || refuse "pane $pane holds session ${session:-none}, not $expected"
[ "$focused" = false ] || refuse "pane $pane is focused"
case "$status" in
  idle | done) ;;
  *) refuse "pane $pane is $status" ;;
esac

# The session ends on the close, so a close the pane tool accepted is not the
# verdict: the successor reads the pane afterwards for that. A refusal is.
pane_tool close "$pane" >/dev/null 2>&1
[ $? -ne 6 ] || refuse "pane $pane is blocked: the pane tool refused the close, and nothing was sent"
echo "sent /exit"
