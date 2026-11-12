/** Check one pinned pull-request head; review coverage is reserved for the next unit. */
import { readFileSync, realpathSync, statSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createGateSources, defaultRunner, TransportFailure } from "./gate-sources.mjs";
import { LINE_BREAK } from "./pr-body-lines.mjs";

const SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const USAGE = "Usage: merge-gate.mjs --pr <owner/repo#n> --head <sha> --bindings <path> [--bindings <path>...] [--receipt <path>] [--carried <path>] [--codex-rollout <path>...] [--bot <name>...] [--bot-unavailable <name>:<reason>...] [--checkout <dir>] [--help]";
const SCOPE = "not checked: whether each finding was fixed or rejected on evidence, or whether a fix went beyond the findings";

/** The account key, ignoring case and an optional trailing bot suffix. */
function botKey(name) {
  return name.toLowerCase().replace(/\[bot\]$/, "");
}

/** A value escaped onto one line, without its surrounding quotes. */
function escaped(value) {
  return JSON.stringify(value).replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`).slice(1, -1);
}

/** The condition label of one bot's row. */
function botLabel(name) {
  return `bot "${escaped(name)}"`;
}

/** Named and unavailable bots in argument order, rejecting a name given both ways. */
function readBots(tokens) {
  const bots = tokens.filter((token) => token.kind === "option" && ["bot", "bot-unavailable"].includes(token.name)).map((token) => {
    if (token.name === "bot") {
      if (!token.value.trim()) throw new Error("--bot needs a name");
      return { name: token.value, reason: null };
    }
    const colon = token.value.indexOf(":");
    const name = token.value.slice(0, colon);
    const reason = token.value.slice(colon + 1);
    if (colon < 1 || !name.trim() || !reason.trim() || LINE_BREAK.test(reason)) {
      throw new Error("--bot-unavailable needs <name>:<reason> with a non-empty reason on one line");
    }
    return { name, reason };
  });
  const named = new Set(bots.filter((bot) => bot.reason === null).map((bot) => botKey(bot.name)));
  if (bots.some((bot) => bot.reason !== null && named.has(botKey(bot.name)))) {
    throw new Error("one name cannot be both --bot and --bot-unavailable");
  }
  return bots;
}

/** Parse the final command line, retaining paths whose readers arrive later. */
function readOptions(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  if (argv.includes("--help")) throw new Error("--help must be the sole argument");
  const text = { type: "string" };
  const multiple = { ...text, multiple: true };
  const { values, tokens } = parseArgs({ args: argv, tokens: true, options: {
    pr: text, head: text, bindings: multiple, receipt: text, carried: text,
    "codex-rollout": multiple, bot: multiple, "bot-unavailable": multiple, checkout: text,
  } });
  const pr = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#([1-9][0-9]*)$/.exec(values.pr ?? "");
  if (!pr) throw new Error("--pr <owner/repo#n> is required, with a positive pull-request number");
  if (!SHA.test(values.head ?? "")) throw new Error("--head must be a full lowercase sha");
  if (!values.bindings?.length || values.bindings.some((path) => !path)) throw new Error("--bindings <path> is required at least once");
  const bots = readBots(tokens);
  return {
    owner: pr[1], repo: pr[2], number: pr[3], head: values.head,
    bindings: values.bindings, receipt: values.receipt ?? null, carried: values.carried ?? null,
    codexRollouts: values["codex-rollout"] ?? [], checkout: values.checkout ?? process.cwd(), bots,
  };
}

/** Read a receipt before any process runs; malformed contents remain readable evidence. */
function readReceipt(path) {
  if (path === null) return null;
  let body;
  try {
    if (!statSync(path).isFile()) throw new Error("not a file");
    body = readFileSync(path, "utf8");
  } catch {
    throw new Error("--receipt must name a readable file");
  }
  const lines = [...body.matchAll(/^[ \t]*Shipped revision:([^\r\n]*)/gm)];
  const revision = lines.length === 1 ? lines[0][1].trim().split(/\s+/)[0] : null;
  return { revision: /^[a-f0-9]{7,40}$/i.test(revision ?? "") ? revision.toLowerCase() : null };
}

/** One condition's verdict and printable explanation. */
function verdict(condition, state, reason) {
  return { condition, state, reason };
}

/** A transport failure as a could-not-check verdict naming the failed call. */
function unchecked(name, error) {
  return verdict(name, "could not check", `(${escaped(error.call)}: ${escaped(error.reason)})`);
}

/** Run a condition independently, keeping transport failures separate from bugs. */
function condition(name, check) {
  try {
    return check();
  } catch (error) {
    if (!(error instanceof TransportFailure)) throw error;
    return unchecked(name, error);
  }
}

/** The receipt's mismatch with the pinned head, independent of the live read. */
function receiptMismatch(head, receipt) {
  if (receipt === null) return null;
  if (receipt.revision === null) return "the receipt has no single Shipped revision line with a 7 to 40 character hex sha";
  return head.startsWith(receipt.revision) ? null : `--head ${head} is not the receipt's shipped revision ${escaped(receipt.revision)}`;
}

/** Compare the pinned head with the live pull request and optional shipped revision. */
function headCondition(live, head, receipt) {
  const reasons = [];
  if (live.state !== "open") reasons.push(`the pull request is ${escaped(live.state)}`);
  if (live.sha !== head) reasons.push(`--head ${head} is not the live head ${escaped(live.sha)}`);
  const mismatch = receiptMismatch(head, receipt);
  if (mismatch) reasons.push(mismatch);
  return reasons.length
    ? verdict("head", "fail", reasons.join("; "))
    : verdict("head", "pass", `${head} is the live head${receipt ? " and the receipt's shipped revision" : ""}`);
}

/** Judge every CI row, requiring at least one actual success. */
function ciCondition(checks, head) {
  if (!checks.length) return verdict("ci", "fail", `no checks reported on ${head}`);
  const failures = checks.flatMap((check) => {
    const name = `"${escaped(check.name)}"`;
    if (!check.completed) return [`${name} still running`];
    if (check.conclusion === null) return [`${name} completed with no conclusion`];
    return ["success", "neutral", "skipped"].includes(check.conclusion) ? [] : [`${name} ${escaped(check.conclusion)}`];
  });
  if (failures.length) return verdict("ci", "fail", failures.join(", "));
  if (!checks.some((check) => check.conclusion === "success")) {
    return verdict("ci", "fail", `no check concluded success on ${head}`);
  }
  return verdict("ci", "pass", `${checks.length} checks passed on ${head}`);
}

/** Unresolved threads block even when their diff is outdated. */
function threadCondition(threads) {
  const unresolved = threads.filter((thread) => !thread.isResolved);
  return unresolved.length
    ? verdict("threads", "fail", `${unresolved.length} unresolved: ${unresolved.map((thread) => `"${escaped(thread.path)}"`).join(", ")}`)
    : verdict("threads", "pass", "none unresolved");
}

/** Cache a lazy source answer or its failure, so multiple bots share one read. */
function once(read) {
  let result;
  let error;
  let loaded = false;
  return () => {
    if (!loaded) {
      loaded = true;
      try { result = read(); } catch (caught) { error = caught; }
    }
    if (error) throw error;
    return result;
  };
}

/** Whether one row says Completed, never Running or not, with only head-prefix hex tokens. */
function completedSummary(body, head) {
  return body.split(new RegExp(`${LINE_BREAK.source}|\\u0085`)).some((line) => {
    if (!/\bCompleted\b/.test(line) || /Running|\bnot\b/i.test(line)) return false;
    const tokens = [...line.matchAll(/\b[a-fA-F0-9]{7,40}\b/g)];
    return tokens.length > 0 && tokens.every(([sha]) => head.startsWith(sha.toLowerCase()));
  });
}

/** The latest nonempty review on a different, non-null commit. */
function earlierReview(reviews, head) {
  return reviews.filter((review) => review.body.trim() && review.commitId && review.commitId !== head)
    .sort((a, b) => (Date.parse(b.submittedAt) || 0) - (Date.parse(a.submittedAt) || 0))[0];
}

/** Whether a signal belongs to the named bot's Bot account. */
function isNamedBotAccount(row, name) {
  return row.type === "Bot" && row.login !== null && botKey(row.login) === botKey(name);
}

/** Judge a named bot in signal precedence order, reading later signals only as needed. */
function namedBot(bot, reviews, head, signals) {
  const name = botLabel(bot.name);
  if (bot.reason !== null) return verdict(name, "unavailable", escaped(bot.reason));
  const matches = (row) => isNamedBotAccount(row, bot.name);
  const ownReviews = reviews.filter(matches);
  if (ownReviews.some((review) => review.commitId === head && review.body.trim())) {
    return verdict(name, "pass", `finished on ${head} (review)`);
  }
  const reactions = signals.reactions().filter((row) => matches(row) && row.content === "+1");
  let firstSuite = null;
  const suiteRead = condition(name, () => { firstSuite = reactions.length ? signals.suite() : null; return null; });
  if (firstSuite !== null && reactions.some((reaction) => Date.parse(reaction.createdAt) > Date.parse(firstSuite))) {
    return verdict(name, "pass", `finished on ${head} (+1 reaction after the head's first check suite)`);
  }
  if (signals.comments().some((comment) => matches(comment) && completedSummary(comment.body, head))) {
    return verdict(name, "pass", `finished on ${head} (summary row)`);
  }
  if (suiteRead) return suiteRead;
  const older = earlierReview(ownReviews, head);
  if (older) return verdict(name, "fail", `finished only on ${escaped(older.commitId)}, not on ${head}`);
  if (firstSuite !== null && reactions.length && reactions.every((reaction) => Date.parse(reaction.createdAt) <= Date.parse(firstSuite))) {
    return verdict(name, "fail", "its +1 reaction is not dated after the head's first check suite");
  }
  return verdict(name, "fail", `not finished on ${head}`);
}

/** Judge named bots in argument order, then unnamed reviewing bot accounts by login. */
function botConditions(sources, bots, head) {
  const reviews = sources.botReviews();
  const signals = {
    reactions: once(() => sources.botReactions()),
    suite: once(() => sources.firstSuiteAt(head)),
    comments: once(() => sources.botComments()),
  };
  const rows = bots.map((bot) => {
    try {
      return namedBot(bot, reviews, head, signals);
    } catch (error) {
      if (!(error instanceof TransportFailure)) throw error;
      return unchecked(botLabel(bot.name), error);
    }
  });
  const named = new Set(bots.map((bot) => botKey(bot.name)));
  const unnamed = [...new Set(reviews.filter((review) => review.type === "Bot" && review.login !== null && !named.has(botKey(review.login))).map((review) => review.login))].sort();
  rows.push(...unnamed.map((login) => verdict(botLabel(login), "fail", "left a review but was not named with --bot")));
  return rows.length ? rows : [verdict("bots", "pass", "none named and no other bot reviewed")];
}

/** Warn about attributes over the whole pull-request range, requesting missing history. */
function attributesCondition(sources, head, live) {
  if (live === null) return verdict("attributes", "could not check", "(needs the live base)");
  for (const sha of [head, live.baseSha]) {
    if (!sources.hasCommit(sha)) return verdict("attributes", "could not check", `(the clone lacks ${escaped(sha)}; fetch it)`);
  }
  const base = sources.mergeBase(head, live.baseSha);
  if (base === null) return verdict("attributes", "could not check", `(no merge-base of ${head} and ${escaped(live.baseSha)})`);
  const count = sources.nonTestLines(base, head, live.baseSha);
  return count.attributesTouched
    ? verdict("attributes", "warn", "the pull request changes a .gitattributes file, which can change how git reads its lines")
    : null;
}

/** Evaluate each condition independently, using the same pinned head for every reader. */
function check(sources, options, receipt) {
  const { head, bots } = options;
  let live = null;
  const rows = [condition("head", () => {
    const answer = sources.head();
    if (!SHA.test(answer.sha) || !SHA.test(answer.baseSha)) throw new TransportFailure("head", "invalid sha from gh");
    live = answer;
    return headCondition(live, head, receipt);
  })];
  const mismatch = receiptMismatch(head, receipt);
  if (live === null && mismatch) {
    rows[0] = verdict("head", "fail", `${mismatch}; ${rows[0].state} ${rows[0].reason}`);
  }
  rows.push(condition("ci", () => ciCondition(sources.checks(head), head)));
  rows.push(verdict("review coverage", "not checked", "(not built yet)"));
  rows.push(condition("threads", () => threadCondition(sources.threads())));
  const botRows = condition("bots", () => botConditions(sources, bots, head));
  rows.push(...(Array.isArray(botRows) ? botRows : [botRows]));
  const attributes = condition("attributes", () => attributesCondition(sources, head, live));
  if (attributes) rows.push(attributes);
  return rows;
}

/** Print all condition lines and the summary, letting definite failures take precedence. */
function report(rows, head, stdout) {
  const failed = rows.filter((row) => row.state === "fail").length;
  const unchecked = rows.filter((row) => ["could not check", "not checked"].includes(row.state)).length;
  const code = failed ? 1 : unchecked ? 2 : 0;
  const lines = rows.map((row) => `${row.condition}: ${row.state} ${row.reason}`);
  lines.push(SCOPE, code === 0 ? `ok ${head}` : `blocked ${head}: ${failed} failed, ${unchecked} not checked`);
  stdout.write(lines.join("\n") + "\n");
  return code;
}

/** Run the command with injectable process and output boundaries; importing it runs nothing. */
export function main(argv, { run = defaultRunner, stdout = process.stdout, stderr = process.stderr } = {}) {
  let options;
  let receipt;
  try {
    options = readOptions(argv);
    if (options.help) {
      stdout.write(USAGE + "\n");
      return 0;
    }
    receipt = readReceipt(options.receipt);
  } catch (error) {
    stderr.write(`merge-gate: ${escaped(error.message)}\n${USAGE}\n`);
    return 2;
  }
  try {
    const sources = createGateSources({ ...options, run });
    return report(check(sources, options, receipt), options.head, stdout);
  } catch (error) {
    stderr.write(`merge-gate: internal error: ${escaped(error.message)}\n`);
    return 2;
  }
}

// Compare real paths: run through a symlink, argv names the link and the URL the file.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
