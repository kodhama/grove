#!/bin/sh
# grove Stop-hook wrapper (spec-0006 §Claude Stop-hook mechanics; INV21).
# Thin by contract: the guard emits the channel-ready payload in hook mode;
# this wrapper only resolves the plugin root, passes the hook's stdin JSON
# through, and maps failure classes. It shall NEVER exit 2 — the host's
# blocking-error code — so the measured stdout block decision stays the only
# hold channel.
#
# Exit mapping (one mapping, mechanically distinguishable):
#   guard 0 -> 0   (clean silence, or the single-line block-decision JSON)
#   guard 1 -> 1   (non-blocking stderr report: observer, or bounded hold)
#   guard 4 -> 4   (guard-internal error, "grove-guard error:" already emitted)
#   anything else -> "grove-guard error:" on stderr, exit 4 (wrapper failure)

PLUGIN_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd) || {
  printf 'grove-guard error: cannot resolve the grove plugin root\n' >&2
  exit 4
}

GUARD="$PLUGIN_ROOT/runtime/dispatch/bin/guard.mjs"
if [ ! -f "$GUARD" ]; then
  printf 'grove-guard error: missing guard runtime at %s\n' "$GUARD" >&2
  exit 4
fi

node "$GUARD" --hook --repo "${CLAUDE_PROJECT_DIR:-$PWD}"
rc=$?
case "$rc" in
  0|1|4) exit "$rc" ;;
  *)
    printf 'grove-guard error: guard exited %s\n' "$rc" >&2
    exit 4
    ;;
esac
