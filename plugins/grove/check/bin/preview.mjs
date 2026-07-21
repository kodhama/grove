#!/usr/bin/env node
// The local owed-map preview CLI (grove#108) — run from a repo checkout:
//
//   node <check>/bin/preview.mjs [--default-branch <name>] [--head <ref>] [--json]
//
// Prints the SAME §D view CI would print for this branch's diff, computed
// offline over an EMPTY record stream (the owed-map, before any verdicts).
// INFORMATIONAL, not a gate: exit 0 on any successful preview — red rows are
// the useful output, not a failure (a pre-push hook must not confuse "owes
// reviews" with "broken"); non-zero only on a hard error (unresolvable
// default branch, git failure, malformed protected policy). Posts nothing,
// writes nothing.
//
// The ONLY untested lines are here: the real execFile git runner + process
// wiring. The composition (shell/preview.mjs) is unit-tested against fakes.

import { makeExecGitRunner } from '../shell/git-adapter.mjs';
import { resolveLocalDefaultBranch, runPreview } from '../shell/preview.mjs';

function parseArgs(argv) {
  const out = { defaultBranch: null, head: 'HEAD', json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--default-branch' || a === '--head') {
      const v = argv[++i];
      // loud-fail parity with the module's own resolution ethos: a flag with
      // no value must not silently fall through to auto-resolution/defaults.
      if (v == null || v.startsWith('--')) {
        throw new Error(`grove preview: ${a} requires a value`);
      }
      if (a === '--default-branch') out.defaultBranch = v;
      else out.head = v;
    } else if (a === '--json') out.json = true;
    else throw new Error(`grove preview: unknown argument ${a}`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const gitRunner = makeExecGitRunner();
  const defaultBranch = await resolveLocalDefaultBranch({
    gitRunner,
    override: args.defaultBranch,
  });

  const out = await runPreview({ gitRunner, defaultBranch, head: args.head });

  if (!out.installed) {
    process.stdout.write(out.summary + '\n');
    return;
  }

  process.stdout.write(out.text + '\n');
  if (args.json) {
    process.stdout.write('\n' + JSON.stringify(out.structured) + '\n');
  }
}

main().catch((err) => {
  process.stderr.write(`grove preview: ${err && err.stack ? err.stack : err}\n`);
  process.exit(2);
});
