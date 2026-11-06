#!/usr/bin/env bash
# Stub pane-tool adapter for test/resume-lease.test.ts: the neutral contract
# of skills/supervision-setup/scripts/adapter/interface.md, no pane tool behind it.
# `get p1` answers one idle, unfocused agent; any other pane is gone (exit 3).
while [ $# -gt 0 ]; do
  case "$1" in
    --bin|--timeout) shift 2 ;;
    *) break ;;
  esac
done
case "$1 ${2:-}" in
  "get p1")
    printf '{"pane":"p1","name":"worker-a","kind":"claude","status":"idle","focused":false,"session":"sess-1","cwd":"/Users/maintainer/hub"}\n'
    ;;
  get\ *)
    printf '{"pane":"%s","name":null,"kind":null,"status":"unknown","focused":null,"session":null,"cwd":null}\n' "$2"
    exit 3
    ;;
  *)
    echo "stub adapter: unexpected call $*" >&2
    exit 2
    ;;
esac
