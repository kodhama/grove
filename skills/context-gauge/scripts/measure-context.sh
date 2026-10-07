#!/usr/bin/env bash
# measure-context.sh — print how much of this session's context window is used.
#
# The context-gauge skill runs this at each step boundary or event. It prints
# exactly one line on stdout:
#
#   context=36.2% tokens=362351 window=1000000 source=claude-transcript file=<path>   (exit 0)
#   context=unavailable reason=<plain words>                                           (exit 1)
#
# and exits 2 on bad arguments, with the usage on stderr. Anything it cannot
# measure reads unavailable, never zero and never a guessed window: a session
# that misreads itself as empty would never restart.
#
# Recipes (KTD6 in docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md):
#   claude-code  the transcript's latest usage, input plus cache read plus
#                cache creation, against --window, the window recorded at
#                setup. The transcript carries no window size. Sidechain lines
#                and lines whose usage sums to zero (Claude Code writes
#                `<synthetic>` assistant lines with all-zero usage) are skipped.
#   codex        the rollout's latest token_count event: last_token_usage's
#                input_tokens (which already includes cached input) against
#                model_context_window, both in the rollout. --window is unused.
# A harness-reported percentage (KTD6 recipe 1) is not read: on Claude Code it
# reaches only the status-line command (U1 findings, item 7).
#
# The harness comes from --harness, else from the session variable that is
# set: CLAUDE_CODE_SESSION_ID means claude-code, CODEX_THREAD_ID means codex.
# The transcript comes from --transcript, else it is found by session id
# (--session-id, else that variable): <claude config>/projects/*/<id>.jsonl, or
# <codex home>/sessions/*/*/*/rollout-*-<id>.jsonl. The project dir is named
# after the session's cwd, so a worktree session's transcript is under the
# worktree's own dir; searching every project dir finds it either way.

set -u

usage() {
  cat >&2 <<'EOF'
Usage: measure-context.sh [--harness claude-code|codex] [--window <tokens>]
    [--transcript <path>] [--session-id <id>]
EOF
  exit 2
}

unavailable() {
  printf 'context=unavailable reason=%s\n' "$1"
  exit 1
}

harness="" window="" transcript="" session_id=""
while [ $# -gt 0 ]; do
  case "$1" in
    --harness | --window | --transcript | --session-id)
      [ $# -ge 2 ] || usage
      case "$1" in
        --harness) harness="$2" ;;
        --window) window="$2" && [ -n "$window" ] || usage ;;
        --transcript) transcript="$2" ;;
        --session-id) session_id="$2" ;;
      esac
      shift 2
      ;;
    *) usage ;;
  esac
done

if [ -n "$window" ]; then
  case "$window" in *[!0-9]*) usage ;; esac
  [ "$window" -gt 0 ] 2>/dev/null || usage
fi

if [ -z "$harness" ]; then
  if [ -n "${CLAUDE_CODE_SESSION_ID:-}" ] && [ -n "${CODEX_THREAD_ID:-}" ]; then
    unavailable "both CLAUDE_CODE_SESSION_ID and CODEX_THREAD_ID are set; pass --harness"
  elif [ -n "${CLAUDE_CODE_SESSION_ID:-}" ]; then
    harness=claude-code
  elif [ -n "${CODEX_THREAD_ID:-}" ]; then
    harness=codex
  else
    unavailable "no measuring recipe for this harness: none given and none detected"
  fi
fi

case "$harness" in
  claude-code)
    [ -n "$window" ] || unavailable "no context window given; pass the window recorded at setup with --window"
    id="${session_id:-${CLAUDE_CODE_SESSION_ID:-}}"
    root="${CLAUDE_CONFIG_DIR:-${HOME:-}/.claude}/projects"
    pattern="*/$id.jsonl"
    source=claude-transcript
    ;;
  codex)
    id="${session_id:-${CODEX_THREAD_ID:-}}"
    root="${CODEX_HOME:-${HOME:-}/.codex}/sessions"
    pattern="*/*/*/rollout-*-$id.jsonl"
    source=codex-rollout
    ;;
  *) unavailable "no measuring recipe for harness $harness" ;;
esac

command -v jq > /dev/null 2>&1 || unavailable "jq is not installed; the gauge needs it to read the transcript"

if [ -n "$transcript" ]; then
  [ -f "$transcript" ] || unavailable "no transcript at $transcript"
else
  [ -n "$id" ] || unavailable "no transcript: no session id; pass --session-id or --transcript"
  found=0
  shopt -s nullglob
  for candidate in "$root"/$pattern; do
    found=$((found + 1))
    transcript="$candidate"
  done
  shopt -u nullglob
  [ "$found" -gt 0 ] || unavailable "no transcript for session $id under $root"
  [ "$found" -eq 1 ] || unavailable "more than one transcript for session $id under $root; pass --transcript"
fi

# A write in progress leaves a partial last line, which may be the latest
# reading cut short; reading past it would pass the one before off as current.
# Both the check and the recipe read the same snapshot, the file's first
# $size bytes, so a line appended between the two reads is never half-seen.
size=$(wc -c < "$transcript" | tr -d ' ')
snapshot() { head -c "$size" "$transcript"; }
last=$(snapshot | tail -n 1)
if [ -n "$last" ] && ! printf '%s' "$last" | jq -e type > /dev/null 2>&1; then
  unavailable "the last line of $transcript is not complete JSON, as while it is being written; measure again"
fi

# Each recipe prints one line for every line that measures, oldest first, and
# the last one is the reading: "<tokens> <window>", or "none" for a line that
# says the size is not known yet. After a compaction the latest usage is still
# the size from before it, which would fire a needless restart, so a
# compaction reads "none" until a request after it is written. grep narrows a
# long transcript to the lines that can matter before jq parses them.
# pipefail keeps a jq failure from passing an older line off as the reading;
# grep's own 1 means only that nothing matched.
set -o pipefail
if [ "$harness" = claude-code ]; then
  reading=$(snapshot | grep -F -e '"usage"' -e '"compact_boundary"' 2>/dev/null |
    jq -rR --arg window "$window" '
      fromjson? | objects | select(.isSidechain != true)
      | if .type == "system" and .subtype == "compact_boundary" then "none"
        else .message.usage? | objects
          | ((.input_tokens // 0) + (.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0))
          | select(. > 0) | "\(.) \($window)"
        end' 2>/dev/null | tail -n 1)
else
  # Codex writes a zero-usage token_count right after a compaction; that, or
  # an event with no info or no window, reads "none" rather than an older size.
  reading=$(snapshot | grep -F '"token_count"' 2>/dev/null |
    jq -rR '
      fromjson? | objects | select(.type == "event_msg" and .payload.type? == "token_count")
      | .payload.info
      | [.last_token_usage.input_tokens?, .model_context_window?]
      | if map(type == "number" and . > 0) == [true, true] then "\(.[0]) \(.[1])" else "none" end' \
      2>/dev/null | tail -n 1)
fi
status=$?
[ "$status" -le 1 ] || unavailable "could not read $transcript (exit $status from grep or jq)"

[ "$reading" != none ] ||
  unavailable "the latest reading in $transcript carries no usage, as right after a compaction; measure again after the next request"
[ -n "$reading" ] || unavailable "no usage in $transcript yet"

tokens="${reading% *}" window="${reading#* }"
percent=$(LC_ALL=C awk -v t="$tokens" -v w="$window" 'BEGIN { printf "%.1f", t * 100 / w }')
printf 'context=%s%% tokens=%s window=%s source=%s file=%s\n' "$percent" "$tokens" "$window" "$source" "$transcript"
