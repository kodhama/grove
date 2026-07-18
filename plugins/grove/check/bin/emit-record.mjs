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

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseJudgment, extractJudgmentBlocks } from '../lib/judgment.mjs';
import { parseReviewPolicy, synthesizePolicyBlock } from '../lib/policy.mjs';
import { emitFromJudgment } from '../shell/emitter.mjs';
import { makeExecGitRunner } from '../shell/git-adapter.mjs';

// The local review-policy.md candidates (the same precedence list the git
// adapter reads from the PROTECTED branch — charters/ is grove-self's carrier,
// .grove/ the consumer install location). Read from the working tree here: the
// check reads artifact_dirs from the policy, so the emitter reading the local
// policy is the consistent source. (Judgment call: the check reads the
// PROTECTED-branch policy; the emitter runs on the PR checkout and reads HEAD's
// policy. artifact_dirs is stable install config, so HEAD and base agree in
// practice; a PR that edits its own artifact_dirs is out of scope for this fix.)
// grove-self carries a markdown YAML-block carrier; a consumer carries the
// adr-0018 D10 split TOML (`.grove/review.toml`). The emitter only needs
// `artifact_dirs`, which lives in review.toml, so the consumer candidate reads
// that file (synthesized into a policy block in readLocalPolicyText).
const REVIEW_POLICY_CANDIDATES = ['charters/review-policy.md', '.grove/review.toml'];
const DEFAULT_ARTIFACT_DIRS = ['decisions', 'specs', 'charters'];

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const opts = { file: null, head: 'HEAD', artifactDirs: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') opts.file = argv[++i];
    else if (argv[i] === '--head') opts.head = argv[++i];
    else if (argv[i] === '--artifact-dirs') opts.artifactDirs = argv[++i];
  }
  return opts;
}

// resolveArtifactDirs({ flag, policyText }) -> string[]
// Precedence: an explicit `--artifact-dirs` flag (comma list) wins; else the
// local review-policy.md's grove-review-policy block; else the default three.
// parseReviewPolicy already falls a missing block/key to the default three, so
// an empty policyText yields the default — the exact set emitFromJudgment uses.
export function resolveArtifactDirs({ flag, policyText } = {}) {
  if (flag) {
    const dirs = String(flag)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (dirs.length) return dirs;
  }
  if (policyText) return parseReviewPolicy(policyText).artifactDirs;
  return [...DEFAULT_ARTIFACT_DIRS];
}

// The untested fs edge: read the first local policy candidate that exists.
function readLocalPolicyText({ cwd = process.cwd() } = {}) {
  for (const rel of REVIEW_POLICY_CANDIDATES) {
    const p = join(cwd, rel);
    if (existsSync(p)) {
      try {
        const text = readFileSync(p, 'utf8');
        // adr-0018 D10: the consumer carrier is TOML — synthesize the
        // grove-review-policy block parseReviewPolicy expects (wiring omitted;
        // artifact_dirs comes from review.toml). grove-self's .md is used as-is.
        return rel.endsWith('.toml') ? synthesizePolicyBlock({ reviewToml: text, wiringToml: null }) : text;
      } catch {
        /* fall through to the next candidate / default */
      }
    }
  }
  return '';
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
  const artifactDirs = resolveArtifactDirs({ flag: opts.artifactDirs, policyText: readLocalPolicyText() });
  const { records, errors } = await emitFromJudgment({ gitRunner, head: opts.head, judgment, artifactDirs });

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

// Run only when invoked directly (node bin/emit-record.mjs), never when imported
// by a test — so the pure helpers above (resolveArtifactDirs) are unit-testable
// without kicking off stdin reads / process.exit.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(`grove emit-record: ${err && err.stack ? err.stack : err}\n`);
    process.exit(2);
  });
}
