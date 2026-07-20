#!/usr/bin/env node
// The shadow-metrics sweep CLI (adr-0023 D5 follow-up ①). Read-only: GETs
// the PR streams, reads git at fixed refs, prints a window report — posts
// nothing, mutates nothing, gates nothing. A thin shell over the tested
// shell/sweep.mjs + lib/metrics.mjs; the only untested lines are arg
// parsing, the real fetch/git wiring, and printing.
//
// Usage:
//   node bin/shadow-metrics.mjs --repo owner/name --prs 93,96,98,99
//   GITHUB_TOKEN taken from env (or gh auth token) for API reads.

import { execFileSync } from 'node:child_process';
import { sweepPr } from '../shell/sweep.mjs';
import { aggregateWindow } from '../lib/metrics.mjs';
import { makeExecGitRunner } from '../shell/git-adapter.mjs';

function parseArgs(argv) {
  const opts = { repo: null, prs: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') opts.repo = argv[++i];
    else if (argv[i] === '--prs') opts.prs = String(argv[++i]).split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite);
  }
  return opts;
}

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

const pct = (x) => `${(x * 100).toFixed(0)}%`;

async function main() {
  const { repo, prs } = parseArgs(process.argv.slice(2));
  if (!repo || !repo.includes('/') || prs.length === 0) {
    process.stderr.write('usage: shadow-metrics --repo owner/name --prs 1,2,3\n');
    process.exit(2);
  }
  const [owner, name] = repo.split('/');
  const gitRunner = makeExecGitRunner();
  const tok = token();

  const results = [];
  for (const prNumber of prs) {
    try {
      const r = await sweepPr({ fetchImpl: fetch, gitRunner, owner, repo: name, prNumber, token: tok });
      results.push(r);
      const c = r.closure;
      process.stdout.write(
        `PR #${prNumber}: files=${r.changedCount} pairs=${c.pairsClosed}/${c.pairsTotal} ` +
          `(closure ${pct(c.closureRate)}, ordered ${pct(c.orderedFraction)}) ` +
          `annotations=${r.annotations.consultingCount}/${r.annotations.verdictsTotal}\n`,
      );
    } catch (err) {
      // Loud per-PR failure, never a silently thinner window (INV9's spirit).
      process.stdout.write(`PR #${prNumber}: SWEEP FAILED — ${err && err.message ? err.message : err}\n`);
    }
  }

  const w = aggregateWindow(results);
  process.stdout.write(
    `\nwindow (${w.prCount}/${prs.length} PRs swept): ` +
      `closure ${w.pairsClosed}/${w.pairsTotal} (${pct(w.closureRate)}), ` +
      `ordered ${pct(w.orderedFraction)}, ` +
      `annotations consulted ${w.consultingCount}/${w.verdictsTotal} (${pct(w.consultingFraction)})\n`,
  );
  if (results.length < prs.length) {
    process.stdout.write(`note: ${prs.length - results.length} PR(s) failed to sweep — window is PARTIAL, not representative\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`shadow-metrics: ${err && err.stack ? err.stack : err}\n`);
  process.exit(2);
});
