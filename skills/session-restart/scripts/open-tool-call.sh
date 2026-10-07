#!/usr/bin/env bash
# open-tool-call.sh — say whether a Claude Code session is held at a dialog.
#
# herdr shows a pane held at a Claude Code question or permission dialog as
# `done`, not `blocked`, so a pane read alone cannot tell. The session's
# transcript can: a tool call in the latest assistant message (its entries
# share one message id) with no tool_result yet means a dialog is open. Lines
# that are not JSON are skipped; a file that cannot be read is not clear.
#
# Prints closed or open. Exit status: 0 closed; 1 open or unreadable;
# 2 bad arguments.

set -u
if [ $# -ne 1 ]; then
  echo "Usage: open-tool-call.sh <transcript>" >&2
  exit 2
fi

verdict=$(jq -Rrn '
  [inputs | fromjson? | objects] as $e
  | [$e[] | select(.type == "user") | .message.content | arrays | .[] | objects
      | select(.type == "tool_result") | .tool_use_id] as $answered
  | [$e[] | select(.type == "assistant")] as $a
  | ($a | last | .message.id?) as $mid
  | (if $mid == null then [$a | last] else [$a[] | select(.message.id? == $mid)] end) as $latest
  | [$latest[] | .message.content? | arrays | .[] | objects | select(.type == "tool_use") | .id]
  | [.[] | . as $id | select(any($answered[]; . == $id) | not)]
  | if length == 0 then "closed" else "open" end' "$1" 2>/dev/null)
echo "${verdict:-open}"
[ "$verdict" = closed ]
