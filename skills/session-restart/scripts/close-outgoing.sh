#!/usr/bin/env bash
# close-outgoing.sh — the new-session successor's close of the outgoing session.
#
# The outgoing session cannot exit itself (R35), so its successor types /exit
# into its pane, and only when the checks the in-place helper makes before a
# send all pass, read right before the send: no open tool call in the outgoing
# transcript (open-tool-call.sh; herdr shows a dialog as `done`), an empty
# input line (read-input-line.sh), and then a fresh pane read showing it idle
# or done, unfocused, and still holding the outgoing session, named by its
# transcript (<session-id>.jsonl). One attempt, each herdr call bounded by
# $SESSION_RESTART_HERDR_TIMEOUT seconds (default 30); it never waits.
#
# Prints `sent /exit` or `not sent: <why>`. Exit status: 0 sent; 1 not sent;
# 2 bad arguments.

set -u
if [ $# -ne 3 ]; then
  echo "Usage: close-outgoing.sh <herdr-binary> <pane-id> <outgoing-transcript>" >&2
  exit 2
fi
herdr="$1" pane="$2" transcript="$3"
herdr_timeout="${SESSION_RESTART_HERDR_TIMEOUT:-30}"
scripts="$(cd "$(dirname "$0")" && pwd)"
expected="$(basename "$transcript" .jsonl)"

run_bounded() { perl -MTime::HiRes=alarm -e 'alarm shift; exec @ARGV or exit 127' "$herdr_timeout" "$@"; }
refuse() {
  echo "not sent: $*"
  exit 1
}

[ -f "$transcript" ] || refuse "the outgoing transcript $transcript does not exist"
"$scripts/open-tool-call.sh" "$transcript" >/dev/null ||
  refuse "the outgoing session is at a dialog, or its transcript cannot be read"
input=$("$scripts/read-input-line.sh" "$herdr" "$pane" "$herdr_timeout" 2>/dev/null) ||
  refuse "its input line is $input"

# The pane read comes last, so the focus read is the newest thing the send rests on.
out=$(run_bounded "$herdr" agent get "$pane" 2>/dev/null) || refuse "herdr cannot read pane $pane"
read -r status focused session < <(printf '%s' "$out" |
  jq -r '.result.agent | "\(.agent_status // "unknown") \(.focused == false | not) \(.agent_session.value // "")"' 2>/dev/null)
[ "${session:-}" = "$expected" ] || refuse "pane $pane holds session ${session:-none}, not $expected"
[ "$focused" = false ] || refuse "pane $pane is focused"
case "$status" in
  idle | done) ;;
  *) refuse "pane $pane is $status" ;;
esac

# The session ends on /exit, so herdr's answer to the send is not the verdict:
# the successor reads the pane afterwards for that.
run_bounded "$herdr" agent prompt "$pane" /exit >/dev/null 2>&1
echo "sent /exit"
