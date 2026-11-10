/**
 * KOD-44 — the fixed read command a reviewer runs before it invokes the
 * review performer, so the merge gate can tell from its transcript what the
 * review read (KTD3).
 *
 *   node review-read.mjs --checkout <dir> --from <commit>
 *   head <full sha of HEAD in <dir>>
 *   status <number of `git status --porcelain` lines; 0 is clean>
 *   base <full sha of the merge-base of HEAD and <from>>
 *
 * In plain words: it prints three labelled lines, always in that order, and
 * nothing else on stdout. `<from>` is the commit the reviewer will diff from:
 * the base branch for a full review, the last reviewed head for a re-check.
 * It must resolve to a commit (`git rev-parse --verify <from>^{commit}`). The
 * reviewer then names the printed base, by its commit id, to the performer.
 *
 * It prints all three lines or none. A missing or unknown flag exits 2; a
 * folder that is not a git checkout, a `<from>` that names no commit, or no
 * merge-base exits 1. Either way the reason goes to stderr in one line and
 * stdout stays empty, so no labelled line can come from a failed read.
 *
 * Git runs with an argv array, never through a shell, in `<dir>` by `-C`.
 * `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` are cleared for it, so the
 * checkout read is the one `--checkout` names and not one the environment
 * points at.
 *
 * `review-reads.mjs` recognises this command in a transcript only in this
 * exact form, by the script's file name, and takes its values only from
 * these labelled lines.
 *
 * Plan: docs/plans/2026-11-08-kod-44-merge-gate-plan.md, U1 and KTD3.
 */
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

const USAGE = "Usage: review-read.mjs --checkout <dir> --from <commit>";

/** The three labelled lines for one read, each ending in a newline. */
export function formatRead({ head, status, base }) {
  return `head ${head}\nstatus ${status}\nbase ${base}\n`;
}

/** The flags given, or an error: exactly `--checkout <dir>` and `--from <commit>`, once each. */
export function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag !== "--checkout" && flag !== "--from") return { error: `unknown argument ${flag}` };
    const key = flag.slice(2);
    if (key in options) return { error: `${flag} given twice` };
    if (value === undefined || value === "") return { error: `${flag} needs a value` };
    options[key] = value;
  }
  if (!options.checkout) return { error: "--checkout is required" };
  if (!options.from) return { error: "--from is required" };
  return options;
}

/** The environment git runs with: this one, less what would point it at another checkout. */
function gitEnv() {
  const env = { ...process.env };
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[name];
  return env;
}

/** One git command's stdout in `dir`, or an error naming what failed. */
function git(dir, args) {
  // A very dirty checkout's porcelain output can pass spawnSync's 1 MiB default.
  const run = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", env: gitEnv(), maxBuffer: 64 * 1024 * 1024 });
  if (run.error) return { error: `git did not run: ${run.error.message}` };
  if (run.status !== 0) {
    const reason = String(run.stderr ?? "").trim().split("\n")[0] || `exit ${run.status}`;
    return { error: `git ${args[0]} failed: ${reason}` };
  }
  return { out: String(run.stdout ?? "") };
}

/** What one checkout reads: its head, its porcelain line count and its base; or an error. */
export function readCheckout(dir, from) {
  const head = git(dir, ["rev-parse", "--verify", "HEAD"]);
  if (head.error) return { error: `${dir} is not a git checkout with a HEAD (${head.error})` };
  const commit = git(dir, ["rev-parse", "--verify", "--quiet", `${from}^{commit}`]);
  if (commit.error) return { error: `--from ${from} does not name a commit in ${dir}` };
  const status = git(dir, ["status", "--porcelain"]);
  if (status.error) return { error: status.error };
  const base = git(dir, ["merge-base", "HEAD", commit.out.trim()]);
  if (base.error) return { error: `no merge-base of HEAD and ${from} (${base.error})` };
  const lines = status.out.split("\n").filter((line) => line !== "");
  return { head: head.out.trim(), status: lines.length, base: base.out.trim() };
}

/** Run the command: the exit code, after writing the labelled lines or one reason. */
export function main(argv) {
  const options = parseArgs(argv);
  if (options.error) {
    process.stderr.write(`review-read: ${options.error}\n${USAGE}\n`);
    return 2;
  }
  const read = readCheckout(options.checkout, options.from);
  if (read.error) {
    process.stderr.write(`review-read: ${read.error}\n`);
    return 1;
  }
  process.stdout.write(formatRead(read));
  return 0;
}

// Compare real paths: run through a symlink, argv names the link and the URL the file.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
