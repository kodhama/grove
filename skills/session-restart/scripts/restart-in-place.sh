#!/usr/bin/env bash
# restart-in-place.sh — clear a session in its own pane and resume it from its handoff.
#
# The session-restart skill starts this detached (nohup), then ends its turn.
# It waits until the pane is ready, not focused and not held at a dialog,
# checks the handoff is newer than anything the session has received since,
# types a bare /clear, confirms the clear took, then types one prompt pointing
# at the handoff and confirms the session is not held at a dialog. Anything that
# goes wrong is sent to the maintainer through the report command, never
# retried by typing.
#
# Every wait is bounded, and so is every herdr call (--herdr-timeout): an
# unbounded detached loop is refused by the auto-mode classifier, and a helper
# that never ends is not wanted anyway. A bound is counted in polls, so the
# real wait runs somewhat longer than its seconds by the time each poll's
# herdr call takes.
#
# herdr submits unsent text in the pane's input line together with the next
# prompt, so a /clear typed over a draft is plain text. Before every send the
# helper reads the input line through read-input-line.sh beside it, and holds
# while it is not empty, or cannot be read, as it holds for a focused pane.
#
# herdr reports a pane held at a Claude Code question or permission dialog as
# `done`, not `blocked`, so the helper also reads the session's transcript: a
# tool call in the latest assistant message with no result yet means a dialog
# is open, and nothing is typed.
#
# --transcript must be the launching session's own transcript,
# <session-id>.jsonl: its name is the session id the helper binds to, and it
# types into no other session.
#
# One helper per handoff: it holds restart-helper.lock beside the handoff
# while it runs, and a second one started meanwhile exits without typing and
# reports that it did.
#
# The report command is called with one more argument, the line to report.
# A non-zero exit means the line was not delivered: it is held in
# restart-unreported.txt beside the handoff and retried until --report-bound.
#
# Exit status: 0 resumed and confirmed; 1 stopped and reported; 2 bad
# arguments, or another helper holds the lock.

set -u

poll=5 focus_bound=600 max_wait=7200 clear_timeout=60 resume_timeout=600 report_bound=1800
herdr_timeout=30
pane="" handoff="" transcript="" herdr=""

usage() {
  cat >&2 <<'EOF'
Usage: restart-in-place.sh --pane <pane-id> --handoff <path> --transcript <path>
    --herdr <herdr-binary> [--poll <s>] [--focus-bound <s>] [--max-wait <s>]
    [--clear-timeout <s>] [--resume-timeout <s>] [--report-bound <s>]
    [--herdr-timeout <s>] -- <report-command> [args...]
EOF
  exit 2
}

positive() { awk -v x="$1" 'BEGIN { exit !(x ~ /^[0-9]*\.?[0-9]+$/ && x + 0 > 0) }'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --) shift; break ;;
    --pane | --handoff | --transcript | --herdr | --poll | --focus-bound | --max-wait | \
      --clear-timeout | --resume-timeout | --report-bound | --herdr-timeout)
      [ $# -ge 2 ] || usage ;;
    *) usage ;;
  esac
  case "$1" in
    --pane) pane="$2" ;;
    --handoff) handoff="$2" ;;
    --transcript) transcript="$2" ;;
    --herdr) herdr="$2" ;;
    --poll) poll="$2" ;;
    --focus-bound) focus_bound="$2" ;;
    --max-wait) max_wait="$2" ;;
    --clear-timeout) clear_timeout="$2" ;;
    --resume-timeout) resume_timeout="$2" ;;
    --report-bound) report_bound="$2" ;;
    --herdr-timeout) herdr_timeout="$2" ;;
  esac
  shift 2
done
[ -n "$pane" ] && [ -n "$handoff" ] && [ -n "$transcript" ] && [ -n "$herdr" ] && [ $# -gt 0 ] || usage
for n in "$poll" "$focus_bound" "$max_wait" "$clear_timeout" "$resume_timeout" "$report_bound" "$herdr_timeout"; do
  positive "$n" || usage
done
report_cmd=("$@")
scripts="$(cd "$(dirname "$0")" && pwd)"

log() { printf '%s restart-in-place: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }

lock="$(dirname "$handoff")/restart-helper.lock"
if ! mkdir "$lock" 2>/dev/null; then
  # Reported, not only logged: a lock left by a killed helper would otherwise
  # stop every later restart with nobody told.
  msg="$lock exists or its folder is missing, so this helper typed nothing and exited. If no other helper is running, a killed one left the lock: delete it and start the helper again."
  log "$msg"
  "${report_cmd[@]}" "session-restart for pane $pane (handoff $handoff): $msg" </dev/null >&2 ||
    log "that report could not be delivered"
  exit 2
fi
trap 'rmdir "$lock" 2>/dev/null' EXIT
trap 'exit 1' HUP INT TERM

unreported="$(dirname "$handoff")/restart-unreported.txt"

# How many polls fit in a bound given in seconds (fractions allowed), rounded.
polls_in() { awk -v b="$1" -v p="$poll" 'BEGIN { n = int(b / p + 0.5); print (n < 1 ? 1 : n) }'; }
max_polls=$(polls_in "$max_wait")
focus_polls=$(polls_in "$focus_bound")
clear_polls=$(polls_in "$clear_timeout")
report_polls=$(polls_in "$report_bound")
resume_ms=$(awk -v s="$resume_timeout" 'BEGIN { print int(s * 1000) }')
# A send that waits for the agent gets its own wait plus the ordinary bound.
send_timeout=$(awk -v a="$resume_timeout" -v b="$herdr_timeout" 'BEGIN { print a + b }')

# Runs a command, killing it after the given seconds (fractions allowed).
# macOS has no timeout(1); perl is on both macOS and Linux.
run_bounded() {
  local secs="$1"
  shift
  perl -MTime::HiRes=alarm -e 'alarm shift; exec @ARGV or exit 127' "$secs" "$@"
}

# --- reporting -------------------------------------------------------------

# Sends every held line; keeps the ones the report command could not deliver.
flush_reports() {
  [ -s "$unreported" ] || return 0
  local still="" line
  while IFS= read -r line; do
    if "${report_cmd[@]}" "$line" </dev/null >&2; then log "reported: $line"; else still+="$line"$'\n'; fi
  done < "$unreported"
  printf '%s' "$still" > "$unreported"
}

report() {
  local line="session-restart for pane $pane (handoff $handoff): $*"
  log "report: $line"
  printf '%s\n' "$line" >> "$unreported"
  flush_reports
}

# Stops with status 1, after retrying held reports up to the report bound.
stop() {
  local i=0
  while [ -s "$unreported" ] && [ "$i" -lt "$report_polls" ]; do
    sleep "$poll"
    flush_reports
    i=$((i + 1))
  done
  [ -s "$unreported" ] && log "gave up reporting; the lines stay in $unreported"
  exit 1
}

# --- reading the pane ------------------------------------------------------

status="" focused="" session=""
read_pane() {
  local out
  out=$(run_bounded "$herdr_timeout" "$herdr" agent get "$pane" 2>/dev/null) ||
    { status=unknown; focused=true; session=""; return 1; }
  read -r status focused session < <(printf '%s' "$out" |
    jq -r '.result.agent | "\(.agent_status // "unknown") \(.focused == false | not) \(.agent_session.value // "")"' 2>/dev/null) ||
    { status=unknown; focused=true; session=""; return 1; }
}

idle_or_done() { [ "$status" = idle ] || [ "$status" = done ]; }

# Sets input to empty, draft or unreadable (read-input-line.sh); only empty
# is clear to send.
input=""
read_input() {
  input=$("$scripts/read-input-line.sh" "$herdr" "$pane" "$herdr_timeout" 2>/dev/null)
  [ "$input" = empty ]
}

# --- the dialog check --------------------------------------------------------

# True only when the transcript shows no open tool call (open-tool-call.sh).
no_open_tool_use() { "$scripts/open-tool-call.sh" "$1" >/dev/null; }

# Before the clear the transcript is --transcript; after it, the file named
# after the new session id. A new session with no file yet has no tool call.
cleared=0
no_dialog() {
  local file="$transcript"
  if [ "$cleared" = 1 ]; then
    file="$(dirname "$transcript")/$session.jsonl"
    [ -f "$file" ] || return 0
  fi
  no_open_tool_use "$file"
}

ready() { idle_or_done && no_dialog; }

# --- the handoff freshness check (KTD7 step 3) -----------------------------

# Epoch seconds of the latest entry the session received: a prompt, a peer
# message, a task notification, or a message queued mid-turn. Tool results
# and skill bodies injected inside a turn are not incoming. A line that is not
# JSON, or has no readable timestamp, is skipped.
latest_incoming() {
  jq -R 'fromjson? | objects | select(
      (.type == "user" and (
        (.message.content | type) == "string"
        or ((.message.content | type) == "array" and (.isMeta != true)
            and ([.message.content[] | select(.type != "tool_result")] | length > 0))))
      or (.type == "attachment" and .attachment.type? == "queued_command"))
    | (.timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601)?' "$transcript" 2>/dev/null |
    sort -n | tail -n 1
}

# Fresh only when some incoming entry was read and the handoff is newer.
handoff_is_fresh() {
  local written incoming
  written=$(date -r "$handoff" +%s 2>/dev/null) || return 1
  incoming=$(latest_incoming)
  [ -n "$incoming" ] && [ "$incoming" -lt "$written" ]
}

# --- waiting ---------------------------------------------------------------

polls=0 held_seen=0 held_last="" held_reported=""

# One poll of the overall wait; stops the helper once the bound is spent.
tick() {
  polls=$((polls + 1))
  if [ "$polls" -ge "$max_polls" ]; then
    if [ "$cleared" = 1 ]; then
      report "the session was cleared, but the pane was not ready for the resume prompt within ${max_wait}s (last seen: status $status, focused $focused), so it was not resumed. Resume with the session-restart skill from the handoff at $handoff."
    else
      report "gave up after ${max_wait}s waiting for the pane to be ready (last seen: status $status, focused $focused). Nothing was typed after that; the session keeps its restart-pending marker."
    fi
    stop
  fi
  flush_reports
  sleep "$poll"
}

# Counts a poll the pane is held by a person, and past the focus bound reports
# each reason once: focused, unsent text, or an input line it cannot read. The
# count starts again when the reason changes or the pane stops being held.
held() {
  local reason="$1" line="$2"
  [ "$reason" = "$held_last" ] || held_seen=0
  held_last="$reason"
  held_seen=$((held_seen + 1))
  if [ "$held_seen" -ge "$focus_polls" ] && [[ " $held_reported " != *" $reason "* ]]; then
    report "$line"
    held_reported="$held_reported $reason"
  fi
}

# Waits until the pane is ready, not focused and holds no unsent text.
wait_ready_unfocused() {
  while :; do
    read_pane
    if [ "$focused" = true ]; then
      held focus "a restart is pending but the pane has stayed focused past ${focus_bound}s. Waiting without typing; unfocus the pane to let it run."
    elif ready; then
      read_input && return 0
      if [ "$input" = draft ]; then
        held draft "a restart is pending but unsent text has sat in the pane's input line past ${focus_bound}s. Waiting without typing; send or clear that text to let it run."
      else
        held unreadable "a restart is pending but the helper could not read the input line of the pane for ${focus_bound}s, so it cannot tell whether unsent text sits there. Waiting without typing."
      fi
    else
      held_seen=0 held_last=""
    fi
    tick
  done
}

# The session the helper may type into. Before the clear it is the launching
# session, named by its transcript (<session-id>.jsonl), so a replacement seen
# at the very first read is caught too; after the clear it is the session the
# clear produced. Any other session in the pane (a hand-typed /clear or
# /resume) gets nothing typed into it, not even a refresh prompt. A pane that
# answers with no session id is not clear to send: the helper keeps waiting,
# within its bounds.
expected="$(basename "$transcript" .jsonl)"
same_session_or_stop() {
  [ -n "$session" ] || return 1
  [ "$session" = "$expected" ] && return 0
  if [ "$cleared" = 1 ]; then
    report "the pane's session changed after the clear (from $expected to $session), so no resume prompt was sent. If $expected should resume, resume it with the session-restart skill from the handoff at $handoff."
  else
    report "the pane's session changed before the clear (from $expected to $session), so nothing was typed. The restart is abandoned."
  fi
  stop
}

# A dialog check, the input line, then a fresh read of focus, status and
# session immediately before a send (KTD7 step 6). The pane read comes last
# because the transcript parses take time on a long transcript, and the focus
# read should be the newest thing the send rests on.
still_clear_to_send() {
  no_dialog && read_input && read_pane && same_session_or_stop && [ "$focused" = false ] && idle_or_done
}

# --- the restart -----------------------------------------------------------

[ -f "$transcript" ] || { report "the transcript $transcript does not exist, so the handoff's freshness cannot be checked. Nothing was typed."; stop; }
[ -f "$handoff" ] || { report "the handoff does not exist. Nothing was typed."; stop; }

until read_pane && [ -n "$session" ]; do tick; done
same_session_or_stop
log "waiting on pane $pane (session $expected)"

rounds=0
while :; do
  wait_ready_unfocused
  same_session_or_stop
  if ! handoff_is_fresh; then
    if [ "$rounds" -ge 3 ]; then
      report "the handoff is still stale after three refresh prompts, so the session was not cleared. The restart is abandoned; the session keeps its marker."
      stop
    fi
    still_clear_to_send || { tick; continue; }
    rounds=$((rounds + 1))
    log "handoff is stale; refresh prompt $rounds"
    run_bounded "$send_timeout" "$herdr" agent prompt "$pane" "session-restart: a restart is pending; refresh the live commitments in the handoff at $handoff, then end your turn." --wait --timeout "$resume_ms" >&2 ||
      log "the refresh prompt returned non-zero"
    continue
  fi
  # The final gate: freshness again, then the dialog check and a fresh read,
  # right before the send.
  handoff_is_fresh && still_clear_to_send && break
  tick
done

old_session="$expected"

# True when the new session's transcript has an entry older than the clear:
# the pane went to an existing session (a /resume), which this clear did not
# create. A second hand-typed /clear in the same moment cannot be told apart
# from this one, and leaves the same thing, a fresh session in this pane.
predates_clear() {
  local file first
  file="$(dirname "$transcript")/$session.jsonl"
  [ -f "$file" ] || return 1
  first=$(jq -R 'fromjson? | objects | (.timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601)?' "$file" 2>/dev/null |
    sort -n | head -n 1)
  [ -n "$first" ] && [ "$first" -lt "$((clear_at - 1))" ]
}

log "sending /clear"
clear_at=$(date -u +%s)
run_bounded "$herdr_timeout" "$herdr" agent prompt "$pane" "/clear" >&2 ||
  log "the /clear send returned non-zero; checking whether it took"

i=0
while :; do
  read_pane
  [ -n "$session" ] && [ "$session" != "$old_session" ] && break
  i=$((i + 1))
  if [ "$i" -ge "$clear_polls" ]; then
    report "the /clear was sent but the pane still shows session $old_session after ${clear_timeout}s, so no resume prompt was sent."
    stop
  fi
  sleep "$poll"
done
if predates_clear; then
  report "after the /clear the pane held session $session, which already existed before it (a /resume?), so no resume prompt was sent. If $old_session should resume, resume it with the session-restart skill from the handoff at $handoff."
  stop
fi
log "cleared: session $old_session -> $session"
cleared=1 expected="$session" polls=0 held_seen=0 held_last="" held_reported=""

while :; do
  wait_ready_unfocused
  still_clear_to_send && break
  tick
done

log "sending the resume prompt"
out=$(run_bounded "$send_timeout" "$herdr" agent prompt "$pane" "Resume with the session-restart skill from the handoff at $handoff." --wait --timeout "$resume_ms" 2>&1)
rc=$?
code=$(printf '%s' "$out" | jq -r '.error.code // empty' 2>/dev/null)
log "resume prompt returned (exit $rc): $out"
case "$code" in
  timeout) ;;
  agent_blocked) report "the cleared session was blocked at a dialog before the resume prompt could be sent (R34)."; stop ;;
  "")
    if [ "$rc" -ne 0 ]; then
      report "the resume prompt failed (exit $rc), so the session is cleared but may not be resumed (R34). Resume with the session-restart skill from the handoff at $handoff."
      stop
    fi
    ;;
  *) report "the resume prompt did not start a turn ($code), so the session is cleared but not resumed (R34)."; stop ;;
esac

read_pane
case "$status" in
  working | idle | done | blocked) ;;
  *) report "the resume prompt was sent, but the pane then read as '$status', so the resume is unconfirmed (R34). Check the session; if it did not resume, resume it with the session-restart skill from the handoff at $handoff."; stop ;;
esac
if [ "$session" != "$expected" ]; then
  report "the resume prompt was sent to session $expected, but the pane then held session '$session', so the resume is unconfirmed (R34). Check the session; if $expected did not resume, resume it with the session-restart skill from the handoff at $handoff."
  stop
fi
if [ "$status" = blocked ] || { idle_or_done && ! no_dialog; }; then
  report "the resumed session is held at a dialog (status $status) (R34). It was not retried."
  stop
fi
log "resumed: session $session is $status"
flush_reports
exit 0
