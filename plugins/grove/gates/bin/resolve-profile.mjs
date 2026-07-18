#!/usr/bin/env node
// Load-time floor-guard CLI (adr-0018 D8). The mechanical entry point for
// "whatever reads gates.toml to sequence a run" — a skill or agent invokes this
// to resolve the effective profile and get the guardian fallback + loud warning
// on any unusable/floor-violating file, without re-implementing the rule.
//
// Usage:   node resolve-profile.mjs [path-to-gates.toml]
//   default path: .grove/gates.toml
//
// Behavior:
//   - Reads the file (a missing file is the D8 "missing" state, NOT an error).
//   - Prints the resolved profile as JSON on stdout.
//   - On a fallback (missing/unreadable/floor-violating), prints the loud
//     warning to stderr AND exits non-zero (2) so a caller that ignores stdout
//     still cannot silently run on an unresolved profile.
//   - A clean, floor-satisfying file exits 0 with no stderr.

import { readFileSync } from 'node:fs';
import { resolveProfile } from '../lib/profile.mjs';

const path = process.argv[2] || '.grove/gates.toml';

let text = null; // null => the D8 "missing" state
try {
  text = readFileSync(path, 'utf8');
} catch (e) {
  if (!(e && e.code === 'ENOENT')) {
    // A real read error (permissions, I/O) is the D8 "unreadable" state — feed
    // an empty non-null string so resolveProfile fails the parse/floor and
    // falls back loudly, rather than treating it as a clean missing file.
    text = '';
  }
}

const resolved = resolveProfile({ text });
process.stdout.write(JSON.stringify(resolved, null, 2) + '\n');

if (resolved.source === 'fallback') {
  process.stderr.write(`grove gate-profile: ${resolved.warning}\n`);
  process.exit(2);
}
process.exit(0);
