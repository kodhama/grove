#!/usr/bin/env node
// The record-emitter CLI (adr-0015 Decision 2 + Consequence 2). Turns a
// reviewer's CI-agnostic judgment into the stamped §A.2 verdict record(s) the
// check accepts. The HARNESS runs this and posts the record(s) to the PR
// (adr-0015 Decision 3) — the reviewer never touches it.
//
// Input: a fenced `grove-review-judgment` block on stdin (default) or in a file
// (`--file <path>`). Output: one fenced `grove-verdict` block per reviewed file
// on stdout, separated by a blank line (one comment, one record — §A.1); or,
// with GROVE_STRUCTURED_OUTPUT set, a JSON { records, errors } object. Any
// emit-time error (e.g. a fidelity subject with no reviewable upstream) prints
// to stderr and exits non-zero — never a silently omitted or stale record.
//
// A thin shell over unit-tested functions: the ONLY untested lines are reading
// stdin/the file, the real execFile('git', ...) runner, and process wiring —
// everything they call (lib/judgment.mjs, shell/emitter.mjs) is unit-tested.

import { readFileSync } from 'node:fs';

import { parseJudgment, extractJudgmentBlocks } from '../lib/judgment.mjs';
import { emitFromJudgment } from '../shell/emitter.mjs';
import { makeExecGitRunner } from '../shell/git-adapter.mjs';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const opts = { file: null, head: 'HEAD' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') opts.file = argv[++i];
    else if (argv[i] === '--head') opts.head = argv[++i];
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const raw = opts.file ? readFileSync(opts.file, 'utf8') : readStdin();

  const blocks = extractJudgmentBlocks(raw);
  if (blocks.length === 0) {
    throw new Error('no grove-review-judgment block found on input');
  }
  if (blocks.length > 1) {
    throw new Error(`expected exactly one grove-review-judgment block, found ${blocks.length}`);
  }
  const judgment = parseJudgment(blocks[0]);

  const gitRunner = makeExecGitRunner();
  const { records, errors } = await emitFromJudgment({ gitRunner, head: opts.head, judgment });

  if (process.env.GROVE_STRUCTURED_OUTPUT) {
    process.stdout.write(JSON.stringify({
      records: records.map((r) => ({ subject: r.subject, review: r.review, fingerprint: r.fingerprint, block: r.block })),
      errors,
    }) + '\n');
  } else {
    process.stdout.write(records.map((r) => r.block).join('\n\n') + '\n');
  }

  for (const e of errors) {
    process.stderr.write(`grove emit-record: ${e.subject}: ${e.kind} — ${e.detail}\n`);
  }

  // Non-zero if anything was surfaced as an error, or nothing could be emitted.
  process.exit(errors.length > 0 || records.length === 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`grove emit-record: ${err && err.stack ? err.stack : err}\n`);
  process.exit(2);
});
