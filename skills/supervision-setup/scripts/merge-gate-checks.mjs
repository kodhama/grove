/** Check one pinned pull-request head; the doc-review condition is not built yet. */
import { realpathSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createGateSources, defaultRunner, isTestPath, SHA, TransportFailure } from "./gate-sources.mjs";
import { readHandoff } from "./handoff-receipt.mjs";
import { matches, unqualified } from "./operation-state.mjs";
import { LINE_BREAK } from "./pr-body-lines.mjs";
import { LINE_LIMIT, reviewCoverage } from "./review-coverage.mjs";
import { namesBase, readReviewReads, reviewKey, survivor } from "./review-reads.mjs";
import { foundAbove } from "./routing-table.mjs";

const USAGE = "Usage: merge-gate.mjs --pr <owner/repo#n> --head <sha> --bindings <path> [--bindings <path>...] [--receipt <path>] [--carried <path>] [--codex-rollout <path>...] [--bot <login>...] [--bot-unavailable <name>:<reason>...] [--checkout <dir>] [--help]";
const SCOPE = "not checked: whether each finding was fixed or rejected on evidence, or whether a fix went beyond the findings";
const SUMMARY_LINE_BREAK = new RegExp(`${LINE_BREAK.source}|\\u0085`);
/** The operations whose performers review, by the level skill whose bindings bind them. */
const REVIEW_OPERATIONS = { "story-worker": ["review", "doc-review"], "project-lead": ["review-before-merge"] };
/** The operations a carried handoff line may stand for: a worker's reviews. */
const CARRIED_OPERATIONS = REVIEW_OPERATIONS["story-worker"];
/** A carried review line's detail: what it read, then its arguments as one JSON string, none or unknown. */
const CARRIED_DETAIL = /^read ([0-9a-f]{40}) from ([0-9a-f]{40})( \(dirty tree\))?; args (none|unknown|"(?:[^"\\]|\\.)*")$/;

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

/** `read` of a path, or null when it throws. */
const orNull = (read) => (path) => { try { return read(path); } catch { return null; } };
/** A path through symbolic links, or null when it cannot be resolved. */
const realOrNull = orNull(realpathSync);
/** A file's bytes, or null when it cannot be read. */
const bytesOrNull = orNull(readFileSync);

/**
 * Read each bindings file before any process runs: a worker's or a lead's,
 * with its transcripts, its review operations and its table path: a relative
 * one is found by walking up from the bindings file, as setup does, and is
 * null when no folder above holds it (KTD7).
 */
function readBindingsFiles(paths) {
  return paths.map((path) => {
    let bindings;
    try {
      bindings = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      bindings = null;
    }
    const ops = REVIEW_OPERATIONS[bindings?.skill];
    if (!ops || !Array.isArray(bindings.transcripts) || !Array.isArray(bindings.operations)) {
      throw new Error(`--bindings ${path} is not a worker's or a lead's bindings file`);
    }
    const named = bindings.table?.path;
    const table = typeof named !== "string" || named === "" ? null : isAbsolute(named) ? named : foundAbove(named, path);
    const operations = ops.flatMap((id) => bindings.operations.filter((op) => op?.table === bindings.skill && op.id === id));
    return { role: bindings.skill === "project-lead" ? "lead" : "worker", transcripts: bindings.transcripts, operations, table };
  });
}

/** Read the carried handoff before any process runs; null without one. */
function readCarried(path) {
  if (path === null) return null;
  try {
    if (!statSync(path).isFile()) throw new Error("not a file");
    return readHandoff(path);
  } catch {
    throw new Error("--carried must name a readable file");
  }
}

/** Whether an operation is bound to a named performer: neither by fallback nor unavailable. */
function isBound(op) {
  return op.how_bound !== "fallback" && op.how_bound !== "unavailable" && typeof op.native_id === "string";
}

/**
 * The review operation a performer name matches in one file: a bound one by
 * its native id, as `matches` reads a skill call (a namespaced name must be
 * the binding's own; only a bare one matches unqualified), else a
 * by-fallback one by a suggested name; null for none.
 */
function bindingFor(name, file) {
  const wanted = unqualified(name);
  const bound = file.operations.find((op) => isBound(op) && matches({ kind: "skill", native_id: op.native_id }, { kind: "skill", name }));
  if (bound) return { op: bound.id, binding: "bound" };
  const fallback = file.operations.find((op) => op.how_bound === "fallback"
    && (op.suggested ?? []).some((suggested) => typeof suggested === "string" && unqualified(suggested) === wanted));
  return fallback ? { op: fallback.id, binding: "fallback" } : null;
}

/** The skill names whose calls one file's transcripts are read for: bound performers and fallbacks' suggestions. */
function reviewSkills(file) {
  return file.operations.flatMap((op) => {
    if (op.how_bound === "fallback") return (op.suggested ?? []).filter((name) => typeof name === "string");
    return isBound(op) ? [op.native_id] : [];
  });
}

/** The gate's own read script, whose bytes a trusted copy must equal. */
const OWN_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "review-read.mjs");

/**
 * The trusted read scripts, by realpath: the gate's own sibling and the copy
 * in the supervision-setup folder beside each bindings file's table.
 */
function trustedScripts(files) {
  const beside = files.filter((file) => file.table !== null)
    .map((file) => join(dirname(dirname(file.table)), "supervision-setup", "scripts", "review-read.mjs"));
  return new Set([OWN_SCRIPT, ...beside].map(realOrNull).filter(Boolean));
}

/**
 * Whether a record's read script is trusted: its realpath is a trusted one
 * and its bytes, read now, equal the gate's own copy's, else `differs`
 * (KTD7). A relative path never is: Node resolves it against the process's
 * working directory, which the read record does not hold, not `--checkout`.
 */
function isTrusted(read, trusted, own) {
  if (typeof read?.script !== "string" || !isAbsolute(read.script)) return false;
  const real = realOrNull(read.script);
  if (!trusted.has(real)) return false;
  return own !== null && bytesOrNull(real)?.equals(own) ? true : "differs";
}

/** The order matches are preferred in: bound before by fallback, then by operation. */
function rank(match) {
  return `${match.binding === "bound" ? 0 : 1} ${match.op}`;
}

/**
 * The records carried for missing transcripts the handoff covers: a worker's
 * review lines that carry what they read, with their arguments, each matched
 * only against the bindings of the workers whose transcripts list its session:
 * one record per distinct binding among them, in rank order, the rest marked
 * `copy` so a call counts once (KTD8). `covered` maps each covered thread id
 * to whether it is under a named rollout: a line standing for such a thread
 * is a re-check, and so is a line in a child of a missing transcript once any
 * rollout is named, since what that child is under cannot be read.
 */
function carriedRecords(carried, covered, files, named) {
  if (carried === null) return [];
  const workers = files.filter((file) => file.role === "worker");
  const owners = (session) => workers.filter((file) => file.transcripts.some((listed) => listed?.session_id === session));
  return [...carried.all].flatMap(([key, uses]) => {
    if (!CARRIED_OPERATIONS.includes(key.slice(key.indexOf("/") + 1))) return [];
    return uses.flatMap((use) => {
      const detail = CARRIED_DETAIL.exec(use.detail ?? "");
      const standsFor = covered.has(use.session) || (use.child !== null && covered.has(use.child));
      const found = owners(use.session).map((file) => bindingFor(use.performer, file)).filter(Boolean);
      const ranked = [...new Map(found.map((match) => [rank(match), match]))].sort(([a], [b]) => (a < b ? -1 : 1));
      if (!detail || !standsFor || !ranked.length) return [];
      const rollout = covered.get(use.session) === true || covered.get(use.child) === true || (named && use.child !== null && covered.has(use.session));
      const args = detail[4].startsWith('"') ? JSON.parse(detail[4]) : null;
      return ranked.map(([, match], index) => ({ carried: true, thread: null, at: null, skill: use.performer, args, head: detail[1],
        base: detail[2], clean: !detail[3], baseNamed: namesBase(args, detail[2]), role: "worker", rollout, trusted: false,
        ...match, ...(index ? { copy: true } : {}) }));
    });
  });
}

/**
 * Every review record the bindings files' transcripts and the named rollouts
 * hold, tagged for the coverage decision, plus carried records; `missing`
 * lists transcripts not found that no carried section covers. A record is
 * kept once per role whose file binds its skill, de-duplicated by thread,
 * time, skill, arguments and role, with the best-ranked binding and the
 * other fields of review-reads' survivor, so the `--bindings` order changes
 * nothing (KTD8). A call any file reads as not fresh is not fresh in every
 * role (KTD8's 11-24 amendment). A worker's copy of a lead's record is marked
 * `alsoLead`, which gets no patch-id credit, and `copy`.
 */
function reviewEvidence(files, rollouts, carried) {
  const trusted = trustedScripts(files);
  const own = bytesOrNull(OWN_SCRIPT);
  const kept = new Map();
  const missing = [];
  const stale = new Set();
  for (const file of files) {
    const found = readReviewReads(file.transcripts, { skills: reviewSkills(file), rollouts });
    missing.push(...found.missing);
    for (const review of found.reviews) {
      if (review.fresh !== true) stale.add(reviewKey(review));
      const key = JSON.stringify([reviewKey(review), file.role]);
      const match = bindingFor(review.skill, file);
      if (!match) continue;
      const old = kept.get(key);
      kept.set(key, { role: file.role, review: old ? survivor(old.review, review) : review,
        match: old && rank(old.match) <= rank(match) ? old.match : match });
    }
  }
  const all = [...kept.values()].map(({ role, review, match }) =>
    ({ ...review, ...match, role, carried: false, trusted: isTrusted(review.read, trusted, own),
      ...(stale.has(reviewKey(review)) ? { fresh: false } : {}) }));
  const leads = new Set(all.filter((record) => record.role === "lead").map(reviewKey));
  const records = all.sort((a, b) => (a.role === "lead" ? 0 : 1) - (b.role === "lead" ? 0 : 1))
    .map((record) => record.role === "worker" && leads.has(reviewKey(record)) ? { ...record, alsoLead: true, copy: true } : record);
  const covered = new Map();
  for (const { session_id: id, rollout } of missing) {
    if (id !== null && carried?.covered.has(id)) covered.set(id, covered.get(id) === true || rollout);
  }
  const uncovered = missing.filter((entry) => !covered.has(entry.session_id));
  return { records: [...records, ...carriedRecords(carried, covered, files, rollouts.length > 0)], missing: uncovered };
}

/** One condition's verdict and printable explanation. */
function verdict(condition, state, reason) {
  return { condition, state, reason };
}

/** Why a transport failure stopped a check, naming the failed call. */
function transportReason(error) {
  return `(${escaped(error.call)}: ${escaped(error.reason)})`;
}

/** A transport failure as a could-not-check verdict naming the failed call. */
function unchecked(name, error) {
  return verdict(name, "could not check", transportReason(error));
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
  if (live.mergedAt !== null) reasons.push("the pull request is merged");
  else if (live.state !== "open") reasons.push(`the pull request is ${escaped(live.state)}`);
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
  return body.split(SUMMARY_LINE_BREAK).some((line) => {
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

/** Whether a signal belongs to a Bot account that still has a login. */
function isBotAccount(row) {
  return row.type === "Bot" && row.login !== null;
}

/** Whether a signal belongs to the named bot's Bot account. */
function isNamedBotAccount(row, name) {
  return isBotAccount(row) && botKey(row.login) === botKey(name);
}

/** Why a completed summary cannot be credited to its author's own Bot account. */
function summaryEditFailure(comment, name) {
  if (comment.lastEditedAt === null && comment.edits.totalCount === 0) return null;
  if (comment.edits.totalCount > 100 || comment.edits.editors.length !== comment.edits.totalCount) {
    return "its summary row's edits cannot all be read";
  }
  const other = [comment.editor, ...comment.edits.editors].find((editor) => !isNamedBotAccount(editor, name));
  return other ? `its summary row was edited by "${escaped(other.login ?? "unknown")}"` : null;
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
  const ownReactions = signals.reactions().filter(matches);
  const reactions = ownReactions.filter((row) => row.content === "+1");
  let firstSuite = null;
  const suiteRead = condition(name, () => { firstSuite = reactions.length ? signals.suite() : null; return null; });
  if (firstSuite !== null && reactions.some((reaction) => Date.parse(reaction.createdAt) > Date.parse(firstSuite))) {
    return verdict(name, "pass", `finished on ${head} (+1 reaction after the head's first check suite)`);
  }
  const ownComments = signals.comments().filter(matches);
  const summaries = ownComments.filter((comment) => completedSummary(comment.body, head));
  const editFailures = summaries.map((comment) => summaryEditFailure(comment, bot.name));
  if (editFailures.includes(null)) return verdict(name, "pass", `finished on ${head} (summary row)`);
  if (suiteRead) return suiteRead;
  if (editFailures.length) return verdict(name, "fail", editFailures[0]);
  const older = earlierReview(ownReviews, head);
  if (older) return verdict(name, "fail", `finished only on ${escaped(older.commitId)}, not on ${head}`);
  if (firstSuite !== null && reactions.length && reactions.every((reaction) => Date.parse(reaction.createdAt) <= Date.parse(firstSuite))) {
    return verdict(name, "fail", "its +1 reaction is not dated after the head's first check suite");
  }
  if (!ownReviews.length && !ownReactions.length && !ownComments.length) {
    return verdict(name, "fail", `no Bot account "${escaped(bot.name)}" reviewed, commented or reacted on this pull request`);
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
  const rows = bots.map((bot) => condition(botLabel(bot.name), () => namedBot(bot, reviews, head, signals)));
  const named = new Set(bots.map((bot) => botKey(bot.name)));
  const unnamed = [...new Set(reviews.filter((review) => isBotAccount(review) && !named.has(botKey(review.login))).map((review) => review.login))].sort();
  rows.push(...unnamed.map((login) => verdict(botLabel(login), "fail", "left a review but was not named with --bot")));
  return rows.length ? rows : [verdict("bots", "pass", "none named and no other bot reviewed")];
}

/** The pull request's merge-base, or why it cannot be read: no live base, missing history or none. */
function pullRange(sources, head, live) {
  if (live === null) return { reason: "(needs the live base)" };
  for (const sha of [head, live.baseSha]) {
    if (!sources.hasCommit(sha)) return { reason: `(the clone lacks ${escaped(sha)}; fetch it)` };
  }
  const merge = sources.mergeBase(head, live.baseSha);
  return merge === null ? { reason: `(no merge-base of ${head} and ${escaped(live.baseSha)})` } : { merge };
}

/** The suffix a verdict that rests on carried evidence ends with. */
function carriedNote(head) {
  return ` (carried; the lead reviewed ${head})`;
}

/** The full-review line from a coverage decision. */
function reviewRow(decision, head) {
  const { start } = decision;
  if (start === null) {
    if (decision.carriedNeedsLead) return verdict("review", "fail", `carried evidence needs the lead's own review of ${head}`);
    const reasons = decision.reasons.length ? `: ${decision.reasons.map(escaped).join(", ")}` : "";
    return verdict("review", "fail", `no creditable full review of ${head} (${decision.calls} review calls, none credited${reasons})`);
  }
  const patch = start.patchOf ? ` (patch-id match of ${escaped(start.patchOf)})` : "";
  return verdict("review", start.carried ? "carried" : "pass", `full review read ${escaped(start.sha)}${patch}${start.carried ? carriedNote(head) : ""}`);
}

/** The coverage line from a coverage decision. */
function coverageRow(decision, head) {
  const { start } = decision;
  if (start === null) return verdict("coverage", "fail", "no full review to start from");
  const failures = [];
  if (decision.uncovered.length) failures.push(`uncovered commits ${decision.uncovered.map(escaped).join(", ")}`);
  if (decision.lines >= LINE_LIMIT) {
    failures.push(`${decision.lines} non-test lines since the full review at ${escaped(start.sha)}, ${LINE_LIMIT} or more: a full review must come again`);
  }
  if (failures.length) return verdict("coverage", "fail", failures.join("; "));
  const reason = `${escaped(start.sha)}..${head} covered by ${decision.links} re-checks; ${decision.lines} non-test lines since the full review`;
  return verdict("coverage", decision.carriedUsed ? "carried" : "pass", `${reason}${decision.carriedUsed ? carriedNote(head) : ""}`);
}

/** The review and coverage lines, both could-not-check when evidence or history cannot be read. */
function coverageConditions(sources, options, live, evidence) {
  const both = (reason) => ["review", "coverage"].map((name) => verdict(name, "could not check", reason));
  try {
    const range = pullRange(sources, options.head, live);
    if (range.reason) return both(range.reason);
    const { records, missing } = evidence();
    if (missing.length) return both(`(${missing.map((entry) => `${escaped(entry.path)} not found`).join(", ")})`);
    const decision = reviewCoverage(records, sources, { head: options.head, baseSha: live.baseSha, merge: range.merge });
    return [reviewRow(decision, options.head), coverageRow(decision, options.head)];
  } catch (error) {
    if (!(error instanceof TransportFailure)) throw error;
    return both(transportReason(error));
  }
}

/** Warn about attributes over the whole pull-request range, requesting missing history. */
function attributesCondition(sources, head, live) {
  const range = pullRange(sources, head, live);
  if (range.reason) return verdict("attributes", "could not check", range.reason);
  const base = range.merge;
  const count = sources.nonTestLines(base, head, live.baseSha);
  const rows = [];
  if (count.attributesTouched) rows.push(verdict("attributes", "warn", "the pull request changes a .gitattributes file, which can change how git reads its lines"));
  const binary = binaryClauses(count.binaryPaths);
  if (binary) rows.push(verdict("binary paths", "warn", binary));
  return rows;
}

/** The binary warning: the re-counted non-test paths, then the test paths, which count 0. */
function binaryClauses(paths) {
  const quoted = (list) => list.map((path) => `"${escaped(path)}"`).join(", ");
  const tests = paths.filter(isTestPath);
  const counted = paths.filter((path) => !isTestPath(path));
  return [
    counted.length ? `counted as text: ${quoted(counted)}` : null,
    tests.length ? `test paths, not counted: ${quoted(tests)}` : null,
  ].filter(Boolean).join("; ");
}

/** Evaluate each condition independently, using the same pinned head for every reader. */
function check(sources, options, receipt, evidence) {
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
  rows.push(...coverageConditions(sources, options, live, evidence));
  rows.push(verdict("doc review", "not checked", "(not built yet)"));
  rows.push(condition("threads", () => threadCondition(sources.threads())));
  const botRows = condition("bots", () => botConditions(sources, bots, head));
  rows.push(...(Array.isArray(botRows) ? botRows : [botRows]));
  const attributes = condition("attributes", () => attributesCondition(sources, head, live));
  rows.push(...(Array.isArray(attributes) ? attributes : [attributes]));
  return rows;
}

/** Print all condition lines and the summary, letting definite failures take precedence. */
function report(rows, head, stdout) {
  const failed = rows.filter((row) => row.state === "fail").length;
  const notChecked = rows.filter((row) => ["could not check", "not checked"].includes(row.state)).length;
  const code = failed ? 1 : notChecked ? 2 : 0;
  const lines = rows.map((row) => `${row.condition}: ${row.state} ${row.reason}`);
  lines.push(SCOPE, code === 0 ? `ok ${head}` : `blocked ${head}: ${failed} failed, ${notChecked} not checked`);
  stdout.write(lines.join("\n") + "\n");
  return code;
}

/** Run the command with injectable process and output boundaries; importing it runs nothing. */
export function main(argv, { run = defaultRunner, stdout = process.stdout, stderr = process.stderr } = {}) {
  let options;
  let receipt;
  let files;
  let carried;
  try {
    options = readOptions(argv);
    if (options.help) {
      stdout.write(USAGE + "\n");
      return 0;
    }
    receipt = readReceipt(options.receipt);
    files = readBindingsFiles(options.bindings);
    carried = readCarried(options.carried);
  } catch (error) {
    stderr.write(`merge-gate: ${escaped(error.message)}\n${USAGE}\n`);
    return 2;
  }
  try {
    const sources = createGateSources({ ...options, run });
    const evidence = () => reviewEvidence(files, options.codexRollouts, carried);
    return report(check(sources, options, receipt, evidence), options.head, stdout);
  } catch (error) {
    stderr.write(`merge-gate: internal error: ${escaped(error.message)}\n`);
    return 2;
  }
}
