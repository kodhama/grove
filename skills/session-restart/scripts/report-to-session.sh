#!/usr/bin/env bash
# report-to-session.sh — relay one line to the maintainer through a live session.
#
# Types the line into the named reporter session's pane, asking it to tell
# the maintainer with AskUserQuestion. It never types into a pane that is
# focused (the maintainer may be typing there), blocked, or held at a dialog:
# herdr shows a Claude Code question or permission dialog as `done`, so the
# reporter's transcript is read too, and a tool call there with no result yet
# holds the line. So does unsent text in its input line, which herdr would
# submit with the relayed line, or an input line it cannot read
# (read-input-line.sh beside it). Two sessions sharing the reporter's name
# hold it as well.
#
# The reporter's transcript is <projects>/*/<session-id>.jsonl, where
# <projects> is $SESSION_RESTART_PROJECTS_DIR (default ~/.claude/projects).
# Each herdr call is bounded by $SESSION_RESTART_HERDR_TIMEOUT seconds
# (default 30).
#
# Exit status: 0 delivered; 3 held (reporter focused, blocked, at a dialog,
# holding unsent text, not found or not unique), so the caller keeps the line and retries it;
# 2 bad arguments.

set -u
if [ $# -ne 3 ]; then
  cat >&2 <<'EOF'
Usage: report-to-session.sh <herdr-binary> <reporter-name> <line>
EOF
  exit 2
fi
herdr="$1" reporter="$2" line="$3"
projects="${SESSION_RESTART_PROJECTS_DIR:-$HOME/.claude/projects}"
herdr_timeout="${SESSION_RESTART_HERDR_TIMEOUT:-30}"

run_bounded() { perl -MTime::HiRes=alarm -e 'alarm shift; exec @ARGV or exit 127' "$herdr_timeout" "$@"; }

hold() {
  echo "report-to-session: $reporter $*; line held" >&2
  exit 3
}

# Finds the reporter's single pane and gates on its focus and status.
read_reporter() {
  local list rows
  list=$(run_bounded "$herdr" agent list 2>/dev/null) || hold "could not be listed"
  rows=$(printf '%s' "$list" | jq -r --arg n "$reporter" \
    '.result.agents[] | select(.name == $n) | "\(.pane_id) \(.focused) \(.agent_status) \(.agent_session.value // "")"' 2>/dev/null)
  [ -n "$rows" ] || hold "is absent"
  [ "$(printf '%s\n' "$rows" | wc -l)" -eq 1 ] || hold "names more than one session"
  read -r pane focused status session <<< "$rows"
  [ "$focused" = false ] || hold "is focused"
  [ "$status" != blocked ] || hold "is blocked"
}
read_reporter

# The reporter's transcript: exactly one file, and no open tool call in it
# (open-tool-call.sh).
[ -n "$session" ] || hold "has no session id"
files=("$projects"/*/"$session".jsonl)
[ ${#files[@]} -eq 1 ] && [ -f "${files[0]}" ] || hold "has no single transcript for session $session"
"$(dirname "$0")/open-tool-call.sh" "${files[0]}" >/dev/null || hold "is at a dialog"

input=$("$(dirname "$0")/read-input-line.sh" "$herdr" "$pane" "$herdr_timeout" 2>/dev/null) ||
  hold "has an input line that is $input (unsent text, or unreadable)"

# Read the pane again: the transcript parse takes time on a long transcript,
# and the focus read should be the newest thing the send rests on.
first="$pane $session"
read_reporter
[ "$pane $session" = "$first" ] || hold "changed pane or session while being checked"

run_bounded "$herdr" agent prompt "$pane" "Relay to the maintainer, from a session-restart helper (tell them with AskUserQuestion, then carry on): $line" >&2 || exit 3
