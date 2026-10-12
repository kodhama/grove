/**
 * MQ-348 — the supervision routing tables are data, and this test holds their
 * shape (plan `docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md`,
 * U2, KTD1).
 *
 * A level skill ships its default table as `routing.toml` beside its
 * `SKILL.md`. Each `[[operation]]` names one thing the level needs done: an
 * id, its intent, the step or event it runs at, an ordered list of suggested
 * performers by logical name, whether the level cannot run without it, and
 * fallback instructions for when nothing suggested is available. A repo can
 * override a table in `.agents/routing-overrides/<skill>.toml`, replacing only
 * an operation's performers and fallback (R37).
 *
 * The default tables travel with their skills into other repos and harnesses,
 * so they hold no absolute path, no version and no harness-specific way of
 * invoking anything, and they name no work tracker (KTD16). A performer, in a
 * table or an override, is one word: a logical name, never a command line
 * (KTD3, amended by MQ-350). The operations only the repo can bind, a work
 * tracker's and `document-change`, whose performer is the repo's own
 * knowledge-base skill (GRO-20), are the only ones a default table may leave
 * without a performer: the repo's override, or setup's discovery, supplies it,
 * and a not-required one that neither supplies is bound as its fallback says.
 *
 * Only this test parses the tables; setup hands them to the model as text.
 *
 * If this goes red: fix the table or override it names. Loosen a pattern
 * below only when the table's wording is right and the pattern misreads it.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../skills/supervision-setup/scripts/vendor/smol-toml/index.js";
// @ts-expect-error -- no type declarations for this .mjs script
import { readBodyLines } from "../skills/supervision-setup/scripts/pr-body-lines.mjs";

const SKILLS_TREE = "skills";

const OPERATION_FIELDS = [
  "id",
  "intent",
  "step",
  "event",
  "performers",
  "required",
  "fallback",
  "fresh_context",
];
const OVERRIDE_FIELDS = ["performers", "fallback"];

/**
 * The operations only the repo can bind, so a default table may suggest no
 * performer for them: a work tracker's (KTD16), and `document-change`, whose
 * performer is the repo's own knowledge-base skill (GRO-20).
 */
const REPO_BOUND_OPERATIONS = [
  "post-work-note",
  "read-work-notes",
  "file-stories",
  "find-work-items",
  "update-work-item",
  "document-change",
];

/**
 * What a portable default table must not hold, each with the reason it fails.
 * An absolute path has two or more segments (`/usr/local/bin`), or starts at
 * home, an environment variable or a drive letter; a slash command has one
 * segment (`/ce-work`), so the two rules never read the same text.
 */
const NON_PORTABLE: readonly (readonly [RegExp, string])[] = [
  [/(^|[\s"'`(=])\/[^\s/"'`]+\//, "an absolute path"],
  [/(^|[\s"'`(=])~[\w-]*\//, "an absolute path"],
  [/\$\{?[A-Za-z_]\w*\}?\//, "an absolute path"],
  [/\b[A-Za-z]:[\\/]/, "an absolute path"],
  [/\bv\d+(\.\d+)*\b|\b\d+\.\d+(\.\d+)*\b|@[\^~]?\d|(>=|<=|[<>=~^])\s*\d/, "a version string"],
  [/\bmcp__/, "a harness-specific invocation form"],
  [/\b[a-z0-9-]+:[a-z0-9-]+\b/i, "a harness-specific invocation form"],
  [/(^|[\s"'`(])[/$][a-z][a-z0-9-]*\b(?!\/)/, "a harness-specific invocation form"],
  [/\b(Skill|Agent|Task)\(/, "a harness-specific invocation form"],
];

const TRACKER_WORDS = /\b(linear|jira)\b|\b(MQ|GRO)-/i;

type Operation = Record<string, unknown>;

/** Folders under `.agents/skills/` that hold a routing table. */
function skillsWithTables(): readonly string[] {
  return readdirSync(SKILLS_TREE, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(SKILLS_TREE, e.name, "routing.toml")))
    .map((e) => e.name)
    .sort();
}

function readTable(skill: string): string {
  return readFileSync(join(SKILLS_TREE, skill, "routing.toml"), "utf8");
}

function operationsOf(text: string): Operation[] {
  const data = parse(text) as Record<string, unknown>;
  return Array.isArray(data.operation) ? (data.operation as Operation[]) : [];
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * A logical name is one word (KTD3): a CLI performer names its command, never
 * its flags or arguments, which belong to the skill or the setup skill's
 * harness notes, so the check's `command -v <name>` can match it exactly.
 */
function notOneWord(name: string, performers: readonly string[]): string[] {
  return performers
    .filter((p) => !/^[A-Za-z][\w-]*$/.test(p))
    .map((p) => `${name}: performer ${JSON.stringify(p)} is not one word`);
}

/** Everything wrong with one operation of a default table. */
function operationProblems(op: Operation): string[] {
  const problems: string[] = [];
  const name = isText(op.id) ? op.id : "(no id)";
  if (!isText(op.id)) problems.push(`${name}: no id`);
  if (!isText(op.intent)) problems.push(`${name}: no intent`);
  if (isText(op.step) === isText(op.event))
    problems.push(`${name}: needs exactly one of step or event`);
  if (typeof op.required !== "boolean") problems.push(`${name}: required is not true or false`);
  if ("fresh_context" in op && typeof op.fresh_context !== "boolean")
    problems.push(`${name}: fresh_context is not true or false`);
  const performers = op.performers;
  if (!Array.isArray(performers) || !performers.every(isText)) {
    problems.push(`${name}: performers is not a list of names`);
  } else if (performers.length === 0 && !REPO_BOUND_OPERATIONS.includes(name)) {
    problems.push(`${name}: no suggested performer`);
  } else {
    problems.push(...notOneWord(name, performers));
    // A logical name carries no number, so a digit in a performer is a version.
    performers
      .filter((p) => /\d/.test(p))
      .forEach((p) => problems.push(`holds a version string: ${p}`));
  }
  if (op.required !== true && !isText(op.fallback))
    problems.push(`${name}: not required, but has no fallback`);
  if (op.required === true && "fallback" in op)
    problems.push(`${name}: required, so may not have a fallback`);
  for (const key of Object.keys(op)) {
    if (!OPERATION_FIELDS.includes(key)) problems.push(`${name}: unknown field ${key}`);
  }
  return problems;
}

/** What makes `text` non-portable: each NON_PORTABLE hit, then a tracker word. */
function textProblems(text: string): string[] {
  const problems = NON_PORTABLE.flatMap(([pattern, reason]) => {
    const hit = text.match(pattern);
    return hit ? [`holds ${reason}: ${hit[0].trim()}`] : [];
  });
  const tracker = text.match(TRACKER_WORDS);
  if (tracker) problems.push(`names a work tracker: ${tracker[0]}`);
  return problems;
}

/** Everything wrong with a default table sitting in the folder `skill`. */
function tableProblems(skill: string, text: string): string[] {
  let data: Record<string, unknown>;
  try {
    data = parse(text) as Record<string, unknown>;
  } catch (error) {
    return [`does not parse as TOML: ${(error as Error).message}`];
  }
  const problems: string[] = [];
  if (data.skill !== skill) problems.push(`skill field is ${String(data.skill)}, not ${skill}`);
  for (const key of Object.keys(data)) {
    if (key !== "skill" && key !== "operation") problems.push(`unknown top-level field ${key}`);
  }
  const ops = operationsOf(text);
  if (ops.length === 0) problems.push("no operations");
  ops.forEach((op) => problems.push(...operationProblems(op)));
  const ids = ops.map((op) => op.id);
  ids
    .filter((id, i) => ids.indexOf(id) !== i)
    .forEach((id) => problems.push(`duplicate id ${String(id)}`));
  problems.push(...textProblems(text));
  return problems;
}

/** Everything wrong with an override, given the operations its skill's table defines. */
function overrideProblems(text: string, table: readonly Operation[]): string[] {
  let data: Record<string, unknown>;
  try {
    data = parse(text) as Record<string, unknown>;
  } catch (error) {
    return [`does not parse as TOML: ${(error as Error).message}`];
  }
  const problems: string[] = [];
  for (const key of Object.keys(data)) {
    if (key !== "operation") problems.push(`unknown top-level field ${key}`);
  }
  const ops = (data.operation ?? {}) as Record<string, Record<string, unknown>>;
  for (const [id, fields] of Object.entries(ops)) {
    const target = table.find((op) => op.id === id);
    if (!target) problems.push(`${id}: not an operation of the table`);
    if (target?.required === true && "fallback" in fields) {
      problems.push(`${id}: required, so may not set fallback`);
    }
    for (const key of Object.keys(fields)) {
      if (!OVERRIDE_FIELDS.includes(key)) problems.push(`${id}: may not set ${key}`);
    }
    if (
      "performers" in fields &&
      (!Array.isArray(fields.performers) || !fields.performers.every(isText))
    ) {
      problems.push(`${id}: performers is not a list of names`);
    } else if ("performers" in fields) {
      problems.push(...notOneWord(id, fields.performers as string[]));
    }
    if ("fallback" in fields && !isText(fields.fallback)) problems.push(`${id}: fallback is empty`);
  }
  return problems;
}

function idsOf(skill: string): string[] {
  return operationsOf(readTable(skill)).map((op) => op.id as string);
}

const SAMPLE = `skill = "sample"

[[operation]]
id = "build"
intent = "Build the story."
step = "after planning"
performers = ["ce-work"]
required = false
fallback = "Build it by hand."
`;

describe("MQ-348 · the default routing tables", () => {
  it("finds the two level tables", () => {
    expect(skillsWithTables()).toEqual(expect.arrayContaining(["project-lead", "story-worker"]));
  });

  it.each(skillsWithTables())(
    "%s: parses, and every operation is complete and portable",
    (skill) => {
      expect(tableProblems(skill, readTable(skill))).toEqual([]);
    },
  );

  it("the lead table covers what R18 names, plus measuring and restarting", () => {
    expect(idsOf("project-lead")).toEqual(
      expect.arrayContaining([
        "start-worker",
        "message-session",
        "restart-self",
        "report-to-maintainer",
        "measure-context",
      ]),
    );
  });

  it("the lead table can find and update work items, for a defect run (MQ-373, KTD5)", () => {
    const ops = operationsOf(readTable("project-lead"));
    for (const id of ["find-work-items", "update-work-item"]) {
      const op = ops.find((o) => o.id === id);
      expect(op, id).toBeDefined();
      expect(op?.performers, id).toEqual([]);
      expect(op?.required, id).toBe(false);
    }
  });

  it("the lead table marks starting, messaging and the two work-note operations required", () => {
    const required = operationsOf(readTable("project-lead"))
      .filter((op) => op.required === true)
      .map((op) => op.id);
    expect(required).toEqual(
      expect.arrayContaining([
        "start-worker",
        "message-session",
        "post-work-note",
        "read-work-notes",
      ]),
    );
  });

  it("the story table has a review operation (R5), a commit-and-PR operation and a required work note", () => {
    const ops = operationsOf(readTable("story-worker"));
    expect(ops.map((op) => op.id)).toEqual(
      expect.arrayContaining(["review", "review-escalation", "commit-and-pr"]),
    );
    expect(ops.find((op) => op.id === "post-work-note")?.required).toBe(true);
  });

  it("the story table has a diagnose operation for a defect, before plan (MQ-373, KTD2)", () => {
    const ops = operationsOf(readTable("story-worker"));
    const diagnose = ops.find((op) => op.id === "diagnose");
    expect(diagnose?.performers).toEqual(["ce-debug"]);
    expect(diagnose?.required).toBe(false);
    expect(isText(diagnose?.fallback)).toBe(true);
    expect(ops.findIndex((op) => op.id === "diagnose")).toBeLessThan(
      ops.findIndex((op) => op.id === "plan"),
    );
  });

  it("session-restart ships its own table for what a restart needs (KTD15, MQ-359)", () => {
    expect(idsOf("session-restart")).toEqual([
      "measure-context",
      "read-pane",
      "type-into-pane",
      "relay-report",
      "launch-session",
      "post-work-note",
      "read-work-notes",
    ]);
  });

  it("session-restart's table requires nothing: a missing operation closes one restart path, never setup", () => {
    const required = operationsOf(readTable("session-restart")).filter((op) => op.required);
    expect(required.map((op) => op.id)).toEqual([]);
  });

  it("only the three review operations carry fresh_context, each set to true (MQ-377, R8)", () => {
    const marked = skillsWithTables().flatMap((skill) =>
      operationsOf(readTable(skill))
        .filter((op) => "fresh_context" in op)
        .map((op) => `${skill}.${String(op.id)}=${String(op.fresh_context)}`),
    );
    expect(marked.sort()).toEqual([
      "project-lead.review-before-merge=true",
      "story-worker.review-escalation=true",
      "story-worker.review=true",
    ]);
  });
});

describe("MQ-348 · the schema rejects what a table must not hold", () => {
  it("accepts the sample it mutates", () => {
    expect(tableProblems("sample", SAMPLE)).toEqual([]);
  });

  const PATH = "an absolute path";
  const VERSION = "a version string";
  const HARNESS = "a harness-specific invocation form";
  it.each([
    [PATH, "Run /Users/me/bin/build."],
    [PATH, "Run ~/bin/build."],
    [PATH, "Run ~/x."],
    [PATH, "Run $HOME/bin/x."],
    [PATH, "Run ${HOME}/x."],
    [PATH, "Open /Applications/Tool.app first."],
    [PATH, "Read /Volumes/disk/x."],
    [PATH, "Run /usr/local/bin/herdr."],
    [PATH, "Run C:/Users/x/build."],
    [PATH, "Run C:\\\\Users\\\\x."],
  ])("fails a table holding %s in its prose: %s", (reason, fallback) => {
    const text = SAMPLE.replace('fallback = "Build it by hand."', `fallback = "${fallback}"`);
    expect(tableProblems("sample", text).some((p) => p.startsWith(`holds ${reason}`))).toBe(true);
  });

  it.each([
    [VERSION, "ce-work 3.2.0"],
    [VERSION, "ce-work@2"],
    [VERSION, "ce-work 3"],
    [VERSION, "ce-work>=2"],
    [HARNESS, "compound-engineering:ce-work"],
    [HARNESS, "Compound-Engineering:ce-work"],
    [HARNESS, "/ce-work"],
    [HARNESS, "$ce-work"],
    [HARNESS, "mcp__server__tool"],
  ])("fails a table holding %s as a performer: %s", (reason, performer) => {
    const text = SAMPLE.replace('performers = ["ce-work"]', `performers = ["${performer}"]`);
    expect(tableProblems("sample", text).some((p) => p.startsWith(`holds ${reason}`))).toBe(true);
  });

  it.each([
    "claude --cloud",
    "herdr pane run",
    "ce-work\tnow",
    "herdr;rm",
    "ce-work&&x",
    "$(herdr)",
  ])("fails a table whose performer is more than one word (KTD3): %j", (performer) => {
    const text = SAMPLE.replace('performers = ["ce-work"]', `performers = ["${performer}"]`);
    expect(tableProblems("sample", text)).toContain(
      `build: performer ${JSON.stringify(performer)} is not one word`,
    );
  });

  it.each(["Linear", "jira", "MQ-12"])(
    "fails a default table naming the tracker word %s",
    (word) => {
      const problems = tableProblems(
        "sample",
        SAMPLE.replace("Build the story.", `Build the story in ${word}.`),
      );
      expect(problems.some((p) => p.startsWith("names a work tracker"))).toBe(true);
    },
  );

  it.each([
    ["no intent", 'intent = "Build the story."\n', ""],
    ["needs exactly one of step or event", 'step = "after planning"\n', ""],
    [
      "needs exactly one of step or event",
      'step = "after planning"\n',
      'step = "a"\nevent = "b"\n',
    ],
    ["no suggested performer", 'performers = ["ce-work"]', "performers = []"],
    ["not required, but has no fallback", 'fallback = "Build it by hand."\n', ""],
    ["unknown field", "required = false", 'required = false\nowner = "me"'],
  ])("fails an operation with %s", (reason, from, to) => {
    const problems = tableProblems("sample", SAMPLE.replace(from, to));
    expect(problems.some((p) => p.includes(reason))).toBe(true);
  });

  it("reads a slash command as an invocation form, never as an absolute path", () => {
    const text = SAMPLE.replace('performers = ["ce-work"]', 'performers = ["/ce-work"]');
    expect(tableProblems("sample", text).some((p) => p.startsWith("holds an absolute path"))).toBe(
      false,
    );
  });

  it.each(['"yes"', '"true"', "[true]"])(
    "fails an operation whose fresh_context is not true or false (MQ-377): %s",
    (value) => {
      const text = SAMPLE.replace("required = false", `required = false\nfresh_context = ${value}`);
      expect(tableProblems("sample", text)).toContain("build: fresh_context is not true or false");
    },
  );

  it.each(["true", "false"])("accepts an operation whose fresh_context is %s", (value) => {
    const text = SAMPLE.replace("required = false", `required = false\nfresh_context = ${value}`);
    expect(tableProblems("sample", text)).toEqual([]);
  });

  it("fails a required operation that carries a fallback (KTD5, KTD16)", () => {
    const text = SAMPLE.replace("required = false", "required = true");
    expect(tableProblems("sample", text)).toContain("build: required, so may not have a fallback");
  });

  it("lets a required operation go without a fallback", () => {
    const text = SAMPLE.replace("required = false", "required = true").replace(
      'fallback = "Build it by hand."\n',
      "",
    );
    expect(tableProblems("sample", text)).toEqual([]);
  });

  it("lets an operation only the repo can bind go without a performer", () => {
    const text = SAMPLE.replace('id = "build"', 'id = "post-work-note"').replace(
      'performers = ["ce-work"]',
      "performers = []",
    );
    expect(tableProblems("sample", text)).toEqual([]);
  });

  it.each(["find-work-items", "update-work-item"])(
    "lets the tracker operation %s go without a performer (MQ-373)",
    (id) => {
      const text = SAMPLE.replace('id = "build"', `id = "${id}"`).replace(
        'performers = ["ce-work"]',
        "performers = []",
      );
      expect(tableProblems("sample", text)).toEqual([]);
    },
  );

  it("lets document-change go without a performer: only the repo knows its knowledge-base skill (GRO-20)", () => {
    const text = SAMPLE.replace('id = "build"', 'id = "document-change"').replace(
      'performers = ["ce-work"]',
      "performers = []",
    );
    expect(tableProblems("sample", text)).toEqual([]);
  });

  it("fails duplicate ids", () => {
    const text = SAMPLE + SAMPLE.slice(SAMPLE.indexOf("[[operation]]"));
    expect(tableProblems("sample", text)).toContain("duplicate id build");
  });

  it("fails a skill field that is not the folder's name", () => {
    expect(tableProblems("other", SAMPLE)).toContain("skill field is sample, not other");
  });

  it("fails text that is not TOML", () => {
    expect(tableProblems("sample", "skill = ")[0]).toMatch(/^does not parse as TOML/);
  });
});

describe("MQ-348 · routing overrides (R37)", () => {
  const SAMPLE_TABLE: Operation[] = [
    { id: "build", required: false },
    { id: "post-work-note", required: true },
  ];

  it("accepts a sample override that sets performers and fallback", () => {
    const text = '[operation.build]\nperformers = ["other-builder"]\nfallback = "Ask the lead."\n';
    expect(overrideProblems(text, SAMPLE_TABLE)).toEqual([]);
  });

  it.each(["intent", "required", "step", "id", "fresh_context"])(
    "fails a sample override that sets %s",
    (field) => {
      const text = `[operation.build]\n${field} = ${field === "required" ? "true" : '"x"'}\n`;
      expect(overrideProblems(text, SAMPLE_TABLE)).toContain(`build: may not set ${field}`);
    },
  );

  it("fails an override whose performer is more than one word (KTD3)", () => {
    const text = '[operation.build]\nperformers = ["claude --cloud"]\n';
    expect(overrideProblems(text, SAMPLE_TABLE)).toContain(
      'build: performer "claude --cloud" is not one word',
    );
  });

  it("fails an override that gives a required operation a fallback (KTD16)", () => {
    const text = '[operation.post-work-note]\nfallback = "Email the lead."\n';
    expect(overrideProblems(text, SAMPLE_TABLE)).toContain(
      "post-work-note: required, so may not set fallback",
    );
  });

  it("fails an override naming an operation the table lacks", () => {
    const text = '[operation.biuld]\nperformers = ["ce-work"]\n';
    expect(overrideProblems(text, SAMPLE_TABLE)).toContain("biuld: not an operation of the table");
  });
});

/**
 * GRO-30 — a performer takes its repository from the directory its shell
 * starts in, and that is the directory the session started in, not always the
 * story's checkout. The helpers these tests call are declared below, and run
 * only inside each test.
 */
describe("GRO-30 · a performer is given the story's checkout", () => {
  /** Text with every run of whitespace collapsed to one space. */
  const flat = (text: string) => text.replace(/\s+/g, " ");

  it("the bindings paragraph has the worker run its own commands in the story's checkout, and give it to every performer and subagent", () => {
    // The one paragraph that opens "The work runs through bindings.", up to the blank line after it.
    const paragraph = flat(read(WORKER).match(/^The work runs through bindings\.[^]*?(?=\n\n)/m)?.[0] ?? "");
    expect(paragraph).toContain(
      "Run your own commands in the story's checkout, where its branch is checked out, and give every performer and every subagent you start that checkout by its full path, and the story's pull request too once it has one, never the pull request alone: a shell, yours or a subagent's, can start any command, not only the first, in the directory your session started in, which is not always the story's checkout.",
    );
    expect(paragraph).not.toContain("or the story's pull request once it has one");
  });

  it("step 5 has the worker check the diff a review read against its own, and discard one that read something else", () => {
    const whole = section(read(WORKER), "5. Review");
    const review = flat(whole);
    expect(review).toContain(
      "- **Check what it read.** In the request that starts a reviewer that reads a repository, name the range to read, and ask it to quote, from its own commands and their output, the command that gave it the diff, the commit it was on and the files the diff changes. Commit your work before the review starts, so the range holds all of it. Compare the range in its command, that commit and those files with the range you named, the commit you started the review on and the files your own diff lists over that range in the story's checkout. If any differs or is missing, it read something else: discard its findings and run it again. Tell a performer that starts reviewers of its own to pass the checkout's full path and the range on to each, and to report the same for each; a reviewer it does not report for makes that run a miss. If the second run misses too, send your lead a `DECISION`: no pull request opens or becomes ready on that review, and only work that does not depend on it goes on.",
    );
    expect(review).not.toContain("print the top level and the head");
    // A second miss never lets the story run on to a pull request unreviewed.
    expect(review).not.toContain("the rest of the story goes on");
    // A report that leaves one of the three out is a miss, not a pass.
    expect(review).not.toContain("or it reports none of them");
    // The rule is a bullet of its own, at the start of a line, not nested under another.
    expect(whole).toContain("\n- **Check what it read.**");
    // It sits with the other rules for pointing a reviewer, after the one that gives it the checkout.
    const before = review.indexOf("**Give it the checkout when the diff reaches outside itself.**");
    const check = review.indexOf("**Check what it read.**");
    const after = review.indexOf("**Ask for findings with evidence, not patches.**");
    expect(before).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(check);
  });
});

/** One `## ` section of a Markdown file, from its heading to the next. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start < 0) return "";
  const next = text.indexOf("\n## ", start + 1);
  return text.slice(start, next < 0 ? undefined : next);
}

/** A file's text, or "" when it is missing, so the assertion reading it fails. */
const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

const LEAD = join(SKILLS_TREE, "project-lead", "SKILL.md");
const WORKER = join(SKILLS_TREE, "story-worker", "SKILL.md");
const RECEIPT = join(SKILLS_TREE, "story-worker", "references", "receipt.md");

describe("MQ-373 · the defect route's text", () => {
  const REFERENCE = join(SKILLS_TREE, "project-lead", "references", "defect-run.md");

  it("project-lead links its defect-run reference, and the reference exists", () => {
    expect(read(LEAD)).toContain("references/defect-run.md");
    expect(existsSync(REFERENCE)).toBe(true);
  });

  it("story-worker has a defect section", () => {
    expect(section(read(WORKER), "A defect: diagnose first")).not.toBe("");
  });

  it("story-worker's defect section names `diagnose` and comes before its plan step", () => {
    const text = read(WORKER);
    const defect = text.indexOf("\n## A defect: diagnose first\n");
    const plan = text.indexOf("\n## 3. Plan\n");
    expect(section(text, "A defect: diagnose first")).toContain("`diagnose`");
    expect(defect).toBeGreaterThan(-1);
    expect(plan).toBeGreaterThan(-1);
    expect(defect).toBeLessThan(plan);
  });

  it("the story table's plan step follows diagnosis for a defect", () => {
    const plan = operationsOf(readTable("story-worker")).find((op) => op.id === "plan");
    expect(plan?.step).toMatch(/diagnosis/);
  });

  it("the lead table's update-work-item covers a triage priority change", () => {
    const update = operationsOf(readTable("project-lead")).find(
      (op) => op.id === "update-work-item",
    );
    expect(update?.event).toMatch(/priority/);
  });

  it.each([
    ["the defect-run reference", () => read(REFERENCE)],
    ["project-lead's SKILL.md", () => read(LEAD)],
    ["story-worker's defect section", () => section(read(WORKER), "A defect: diagnose first")],
  ])("%s names no harness, path, version or tracker", (_name, text) => {
    expect(textProblems(text())).toEqual([]);
  });

  it.each([
    "find-work-items",
    "update-work-item",
    "file-stories",
    "post-work-note",
    "start-worker",
  ])("the reference uses the lead operation %s, which the lead table defines", (id) => {
    expect(idsOf("project-lead")).toContain(id);
    expect(read(REFERENCE)).toContain(`\`${id}\``);
  });
});

/**
 * GRO-22 — every story that is not a defect is planned before it is built, and
 * its receipt's `Plan:` line names the plan it was built from: a plan file, the
 * plan unit it came from, or, for a defect, the note that holds its diagnosis.
 * The lead sends back a ready hand-back whose line is missing, names no plan,
 * gives anything that does not resolve, or shows the plan was skipped. The rule
 * lives in the skills' text: `plan`'s row in the table stays not required.
 */
describe("GRO-22 · the plan step's text", () => {
  /** Text with every run of whitespace collapsed to one space. */
  const flat = (text: string) => text.replace(/\s+/g, " ");
  const receipt = () => read(join(SKILLS_TREE, "story-worker", "references", "receipt.md"));
  const planStep = () => flat(section(read(WORKER), "3. Plan"));
  const defectSection = () => flat(section(read(WORKER), "A defect: diagnose first"));
  /** The receipt's `Plan:` field: its label's line and the indented lines under it. */
  const planField = () => flat(receipt().match(/^Plan:.*(?:\n[ \t]+.*)*/m)?.[0] ?? "");
  /** The "Accept on the evidence" item of the lead's ready hand-back check, up to the next item. */
  const acceptItem = () => {
    const step = section(read(LEAD), "7. A hand-back");
    const start = step.indexOf("**Accept on the evidence.**");
    const end = step.indexOf("**Review it again, from fresh context.**");
    return start < 0 || end < start ? "" : flat(step.slice(start, end));
  };
  const expectAll = (text: string, said: readonly string[]) =>
    said.forEach((words) => expect(text).toContain(words));

  it("`plan` keeps its fallback and stays not required: a defect skips the plan, and setup must not stop without a planner", () => {
    const plan = operationsOf(readTable("story-worker")).find((op) => op.id === "plan");
    expect(plan?.required).toBe(false);
    const fallback = flat(String(plan?.fallback ?? ""));
    expectAll(fallback, [
      "No planning performer is available, so do the planning yourself.",
      "A plan unit that is enough to build from is the plan: name it and write no copy.",
      "In every other case write the plan, or the gaps you fill in a unit, to a file where the repo keeps its plans: the files to change, the failing tests to write first, and how the result is verified.",
      'Keep it within the story\'s scope, and end the receipt\'s Plan line with ", by fallback", whichever of these you did.',
    ]);
    expect(fallback).not.toContain("Write a short plan yourself");
  });

  it("the plan step says every story that is not a defect is planned, and no longer that a defect may skip it", () => {
    const step = planStep();
    expectAll(step, [
      "Every story that is not a defect is planned before it is built, however small it looks.",
      "Invoke the performer bound to `plan`, from the story's source.",
    ]);
    expect(step).not.toContain("may skip this step");
  });

  it("the plan step asks for a plan in a file that ships, and sends its path to the receipt", () => {
    expectAll(planStep(), [
      "In every other case, ask the performer for a plan written to a file: the whole plan, or, for a plan unit, only the gaps it filled.",
      // A unit that is enough leaves no file to commit, so the step never demands one.
      "Commit any plan file written for the story on your branch, so it ships in the pull request.",
      "Give the receipt's `Plan:` line as `references/receipt.md` gives it: the file's path, the plan unit the story was built from, or both where a file fills a unit's gaps.",
    ]);
    expect(planStep()).not.toContain("Commit a plan file");
  });

  it("the plan step takes a plan unit that is enough as the plan, and a file for only the gaps", () => {
    expectAll(planStep(), [
      "A unit that is enough is the story's plan: write no copy of it.",
      "only the gaps it filled.",
      "or both where a file fills a unit's gaps.",
    ]);
  });

  it("the plan step sends a plan written by fallback to a file too", () => {
    expectAll(planStep(), [
      "Where `plan` is bound by fallback, you do the planning yourself, any plan you write goes to a file all the same, and the line says so.",
    ]);
  });

  it("the plan step lets a defect's diagnosis stand as its plan, and lists `plan` as not run for no other story it reached", () => {
    expectAll(planStep(), [
      'A defect comes here only when its diagnosis says the fix needs a plan (see "A defect: diagnose first").',
      "Otherwise its diagnosis stands as its plan, and `plan` goes under Not run with that reason.",
      "A story that is not a defect lists `plan` under Not run only when it ended before this step.",
    ]);
  });

  it("the defect section posts the diagnosis as a signed work note before the worker acts on it, which the receipt links", () => {
    expectAll(defectSection(), [
      "A defect's diagnosis stands as its plan, together with the plan step's own where the fix needs one.",
      "Post its summary as a note on the work item, through the performer bound to `post-work-note`, before you act on it, so your lead can open it, and end the note with the agent footer the repo's instructions require.",
      "The receipt's `Plan:` line links that note.",
    ]);
  });

  it("the work-note operation names the diagnosis note among its uses", () => {
    const note = operationsOf(readTable("story-worker")).find((op) => op.id === "post-work-note");
    expect(flat(String(note?.intent ?? ""))).toContain("a defect's diagnosis, each hand-back");
    expect(String(note?.step ?? "")).toContain("after a defect's diagnosis");
  });

  it("the receipt's Plan field gives every form the line takes", () => {
    expectAll(planField(), [
      "the plan this story was built from, as one of: the path, on the branch, of its plan file;",
      // The two plan-unit forms have a fixed shape, and a unit with no id is named by its heading.
      'or, where its source is a plan unit that was enough to build from, "<that plan\'s path, or the link to the note that holds it>, unit <the unit\'s id, or its section\'s heading where it has no id>", with no copy written;',
      'or, where a file fills the unit\'s gaps, "<the file\'s path>, filling <that plan\'s path or link>, unit <its id or heading>"',
      'for a defect: diagnosis <the link to the note that holds its summary>, then "plan <path>" where the fix needed one, "no plan: contained fix" where it did not, or "no plan: nothing built" where there was no fix to make',
      "not reached: <why>, for a story that ended before it was planned, or, for a defect, before its diagnosis came back.",
    ]);
  });

  it("the receipt's Plan line ends the same way whenever no planner was bound, whichever form it takes", () => {
    const field = planField();
    // One marker for every form that gives a plan, and for no other line.
    expect(field).toContain(
      'Where no planning performer was bound, a line that gives a plan\'s path or a plan unit ends ", by fallback": a file you wrote, a unit you judged enough, or a defect\'s "plan <path>".',
    );
    expect(field).not.toContain("written by fallback");
    // The rule closes the one field: nothing follows it that could read as a second slot to fill.
    expect(field.endsWith("No other line takes it>")).toBe(true);
  });

  it("the receipt's Plan field sits under Story and Source, above Owner", () => {
    const lines = receipt().split("\n");
    const lineOf = (label: string) => lines.findIndex((line) => line.startsWith(label));
    expect(lineOf("Story:")).toBeGreaterThan(-1);
    expect(lineOf("Plan:")).toBeGreaterThan(lineOf("Story:"));
    expect(lineOf("Owner:")).toBeGreaterThan(lineOf("Plan:"));
  });

  it("the lead sends back a ready hand-back whose Plan line gives anything that does not resolve, or that skipped the plan", () => {
    expectAll(acceptItem(), [
      "The receipt's `Plan:` line must name the plan the story was built from: by a path that resolves at the pull request's head or on its base branch, or, where the plan is held in a note on a work item, by a link to that note.",
      "For a defect it links the diagnosis note.",
      "Every path and link the line gives must resolve, and a story that is not a defect never lists `plan` under Not run.",
      "A hand-back goes back to the worker when its line is missing, reads `not reached`, gives a path or link that does not resolve, names no plan by a path or a link for a story that is not a defect, or, for a defect, lacks its diagnosis link.",
      "So does one that lists `plan` as not run for a story that is not a defect, or whose pasted receipt check shows `plan` as `bound-but-unused` for such a story: a planner was bound and never called.",
    ]);
    expect(acceptItem()).not.toContain("A hand-back whose line is missing");
    expect(acceptItem()).not.toContain("names nothing that resolves");
  });

  it("the README tells an adopter that a story that is not a defect is always planned", () => {
    expect(flat(read("README.md"))).toContain(
      "A story that is not a defect is always planned: its receipt names the plan it was built from, which is a plan file in its pull request (the planner's, or the worker's own where no planner is bound), the plan unit the story came from, or both.",
    );
  });

  it.each([
    ["story-worker's plan step", planStep],
    ["the receipt's Plan field", planField],
  ])("%s names no harness, path, version or tracker", (_name, text) => {
    expect(text()).not.toBe("");
    expect(textProblems(text())).toEqual([]);
  });
});

/**
 * GRO-7 — a lead can start from plain intent: a prompt with no epic, no work
 * item and no plan. The intent run is a reference beside the defect run's; it
 * adds no routing operation, so a consumer's overrides keep matching.
 */
describe("GRO-7 · the intent route's text", () => {
  const REFERENCE = join(SKILLS_TREE, "project-lead", "references", "intent-run.md");
  const description = (text: string) => text.match(/^description: (.*)$/m)?.[1] ?? "";
  const workerGiven = () => section(read(WORKER), "What you are given");

  it("project-lead links its intent-run reference, and the reference exists", () => {
    expect(read(LEAD)).toContain("references/intent-run.md");
    expect(existsSync(REFERENCE)).toBe(true);
  });

  it("project-lead's description says it takes plain intent", () => {
    expect(description(read(LEAD))).toMatch(/plain intent/);
  });

  it.each([
    ["the intent-run reference", () => read(REFERENCE)],
    ["story-worker's \"What you are given\"", workerGiven],
  ])("%s names no harness, path, version or tracker", (_name, text) => {
    expect(text()).not.toBe("");
    expect(textProblems(text())).toEqual([]);
  });

  it.each([
    "produce-breakdown",
    "file-stories",
    "post-work-note",
    "start-worker",
    "report-to-maintainer",
  ])("the reference uses the lead operation %s, which the lead table defines", (id) => {
    expect(idsOf("project-lead")).toContain(id);
    expect(read(REFERENCE)).toContain(`\`${id}\``);
  });

  it("the reference hands a one-story run it carries itself to the story-worker skill", () => {
    expect(read(REFERENCE)).toContain("`story-worker`");
  });

  it.each([
    ["story-worker's \"What you are given\"", workerGiven],
    ["the receipt", () => read(RECEIPT)],
  ])("%s takes a work item filed from plain intent as its own source", (_name, text) => {
    expect(text().replace(/\s+/g, " ")).toMatch(/filed from plain intent/);
  });

  it("the lead table keeps exactly its operation ids, so every consumer's override keeps matching", () => {
    expect([...idsOf("project-lead")].sort()).toEqual(
      [
        "start-worker",
        "message-session",
        "message-pane",
        "measure-context",
        "restart-self",
        "report-to-maintainer",
        "write-handoff",
        "produce-breakdown",
        "file-stories",
        "find-work-items",
        "update-work-item",
        "post-work-note",
        "read-work-notes",
        "wake-on-timer",
        "review-before-merge",
      ].sort(),
    );
  });

  it("the reference posts a breakdown's plan where a worker can read it", () => {
    expect(read(REFERENCE).replace(/\s+/g, " ")).toMatch(/post the confirmed plan on the run item/i);
  });

  it("the reference moves a session carrying its story into the story's worktree", () => {
    expect(read(REFERENCE).replace(/\s+/g, " ")).toMatch(/move the session into the worktree/i);
  });
});

/**
 * GRO-20 — a change that adds a module, a data shape, a contract, a dependency
 * or a design change also updates the repo's reference, architecture and
 * design docs. The story table's `document-change` operation does it at the
 * completion checkpoint, before the learning capture, and the receipt and the
 * pull request's body both say what was updated, or why nothing needed to be.
 */
describe("GRO-20 · documenting a change at the completion checkpoint", () => {
  const oneLine = (text: string) => text.replace(/\s+/g, " ");
  const documentChange = () =>
    operationsOf(readTable("story-worker")).find((op) => op.id === "document-change");
  const prRound = () => oneLine(section(read(WORKER), "7. The pull-request round"));
  /** The receipt's `Docs:` field: its line, and the indented lines that continue it. */
  const docsField = () =>
    oneLine(read(RECEIPT).match(/^Docs:.*(?:\n[ \t]+\S.*)*/m)?.[0] ?? "");

  it("the story table has a document-change operation with no default performer and a fallback", () => {
    const op = documentChange();
    expect(op).toBeDefined();
    expect(op?.performers).toEqual([]);
    expect(op?.required).toBe(false);
    expect(isText(op?.fallback)).toBe(true);
    expect(op?.step).toMatch(/completion checkpoint/);
    // The capture's step names the checkpoint too: this one also says it comes first.
    expect(op?.step).toContain("before any learning is captured");
    // The table carries the run condition too, as step 7 does: a worker reads either.
    expect(op?.step).toContain(
      "when the diff adds a module, a data shape, a contract, a dependency or a design change",
    );
  });

  it("its fallback has the worker update the stale docs itself, and sends it to the receipt's Docs field for the line", () => {
    const fallback = oneLine(String(documentChange()?.fallback ?? ""));
    expect(fallback).toContain("yourself");
    // The rule that picks the line's value lives in the field, which every worker reads.
    expect(fallback).toContain("Then write the Docs line as the receipt's Docs field says.");
    expect(fallback).not.toContain("none needed");
  });

  it("the Docs field has the line list a doc the pull request updated before the checkpoint", () => {
    // Nothing is stale when the build already updated the doc: the line still says `updated`.
    expect(docsField()).toContain(
      "The line lists every such doc the pull request updates, whenever it did, and says none needed only where it updates none>",
    );
    expect(docsField()).toContain("the docs already cover what it adds");
  });

  it("the Docs field says where its paths are read from", () => {
    expect(docsField()).toContain(
      "updated <the path of each reference, architecture or design doc this pull request updates, as the diff at the head lists it,",
    );
  });

  it("step 7 says when the docs and the capture rerun after a ready-time fix pass", () => {
    expect(prRound()).toContain(
      "Neither operation reruns after the fix pass that follows a ready-time first review, unless that pass itself adds something the docs must carry, or produced a lesson that meets the capture's test; then that one runs once more and ships in that pass's push, and the `Docs:` and `Capture:` lines are brought up to date in both places.",
    );
  });

  it("the README tells an adopter to update grove everywhere before naming the operation in an override", () => {
    expect(oneLine(read("README.md"))).toContain(
      "Add the line only once every machine and host runs a grove that has the operation",
    );
  });

  it("its fallback looks at the docs the repo keeps when the project instructions name none, and only a repo with none changes nothing", () => {
    const fallback = oneLine(String(documentChange()?.fallback ?? ""));
    expect(fallback).toContain(
      "where they name none, the reference, architecture and design docs the repo keeps",
    );
    expect(fallback).toContain("or the repo keeps no such docs, change nothing");
    // Instructions that name no docs are no reason to skip: the repo may still keep some.
    expect(fallback).not.toContain("instructions name no such docs");
  });

  it("document-change comes before capture-learning: the docs are final before the capture's test", () => {
    const ids = idsOf("story-worker");
    expect(ids).toContain("document-change");
    expect(ids).toContain("capture-learning");
    expect(ids.indexOf("document-change")).toBeLessThan(ids.indexOf("capture-learning"));
  });

  it("its intent names the repo's own knowledge-base skill, so discovery binds no other", () => {
    const intent = oneLine(String(documentChange()?.intent ?? ""));
    expect(intent).toContain("the repo's own knowledge-base skill");
    expect(intent).toContain(
      "A general writing, documentation or learning-capture skill is not one.",
    );
  });

  it("the pull-request round names `document-change` before `capture-learning`", () => {
    const text = prRound();
    const document = text.indexOf("`document-change`");
    const capture = text.indexOf("`capture-learning`");
    expect(idsOf("story-worker")).toContain("document-change");
    expect(document).toBeGreaterThan(-1);
    expect(capture).toBeGreaterThan(-1);
    expect(document).toBeLessThan(capture);
  });

  it("the pull-request round says when it runs, and lists it under Not run when it does not", () => {
    const text = prRound();
    expect(text).toContain("a module, a data shape, a contract, a dependency or a design change");
    expect(text).toContain("Not run");
  });

  it("the pull-request round puts the Docs line in the receipt and the pull request's body before ready", () => {
    const text = prRound();
    const ready = text.indexOf("mark the pull request ready");
    const docsLine = text.indexOf("`Docs:` line");
    const body = text.indexOf("pull request's body");
    expect(ready).toBeGreaterThan(-1);
    expect(docsLine).toBeGreaterThan(-1);
    expect(body).toBeGreaterThan(-1);
    expect(docsLine).toBeLessThan(ready);
    expect(body).toBeLessThan(ready);
    // The capture ships in the same pull request, so it too comes before ready.
    expect(text.indexOf("`capture-learning`")).toBeLessThan(ready);
  });

  it("the skill's list of what the project instructions hold names the docs a change keeps current", () => {
    expect(oneLine(read(WORKER))).toContain("which docs a change keeps current");
  });

  it("setup says what evidence an operation with no suggested performer records", () => {
    const setup = oneLine(read(join(SKILLS_TREE, "supervision-setup", "SKILL.md")));
    expect(setup).toContain('`no performer is suggested for "<operation id>"`');
  });

  it("the receipt has a Docs field: what was updated, or none needed and why, as the pull request's body says it", () => {
    const field = docsField();
    expect(field).toMatch(/^Docs:/);
    expect(field).toContain("none needed, because");
    expect(field).toContain("pull request's body");
  });

  it("the receipt lists an operation bound by fallback that did not run under Not run", () => {
    const byFallback = oneLine(read(RECEIPT).match(/^By fallback:.*(?:\n[ \t]+\S.*)*/m)?.[0] ?? "");
    expect(byFallback).toContain("or none suggested");
    expect(byFallback).toContain("One bound by fallback that did not run goes under Not run instead");
  });

  it("the Docs field counts only reference, architecture and design docs, and has a value for a story that never reached the checkpoint", () => {
    const field = docsField();
    expect(field).toContain(
      "updated <the path of each reference, architecture or design doc this pull request updates",
    );
    expect(field).toContain("never a plan or a captured learning");
    expect(field).toContain("not reached:");
    // The fallback's own reason: a repo that keeps none, never instructions that name none.
    expect(field).toContain("or the repo keeps no such docs>");
    expect(field).not.toContain("name no such docs");
  });

  it("grove's own instructions name the doc a change keeps current, so a worker here need not guess", () => {
    const instructions = oneLine(read("AGENTS.md"));
    expect(instructions).toContain(
      "`README.md` is the doc a change keeps current, and `docs/decisions/` where the change supersedes a decision recorded there.",
    );
  });
});

/**
 * GRO-17 — a worker never retries, rephrases or hands off a command or any
 * other call its harness's permission check refused. It stops the dependent
 * work and sends its lead `STATUS: refused in <directory>: <exact command or
 * call>`, and takes a fresh clone only on the maintainer's OK, reporting
 * `STATUS: moved to <clone path>`.
 */
describe("GRO-17 · the refused-call rule's text", () => {
  const flat = (text: string) => text.replace(/\s+/g, " ");
  const workerNever = () => section(read(WORKER), "Never");
  const workerTalking = () =>
    flat(section(read(WORKER), "Talking to your lead, and to the maintainer"));
  const workerBeforeEdit = () => flat(section(read(WORKER), "2. Before the first edit"));
  const workerRestart = () => flat(section(read(WORKER), "Context and restart"));
  const leadMessages = () => flat(section(read(LEAD), "5. Messages"));
  const leadStarting = () => flat(section(read(LEAD), "4. Starting a worker"));
  const leadRestart = () => flat(section(read(LEAD), "Context and restart"));

  it("story-worker's Never names no harness, path, version or tracker", () => {
    expect(workerNever()).not.toBe("");
    expect(textProblems(workerNever())).toEqual([]);
  });

  it("the worker never retries a refused command or any other call, and reports it", () => {
    const never = flat(workerNever());
    expect(never).toContain(
      "- Retry, rephrase or hand to another session, a subagent or a performer a command or any other call your harness's permission check refused: repeated refusals hold a session at a prompt only the maintainer can answer.",
    );
    expect(never).not.toContain("hand to another session a command");
    expect(never).toContain(
      "Stop the work that depends on it, tell your lead at once with a `STATUS: refused` line, and keep working on anything independent.",
    );
  });

  it("the worker tells each subagent or performer that a call refused there comes back as it stands", () => {
    expect(flat(workerNever())).toContain(
      "Say so in each request to a subagent or a performer: a call refused there comes back to you as it stands, never retried.",
    );
  });

  it("nothing in a checkout moves while a command that rewrites it awaits its answer", () => {
    expect(flat(workerNever())).toContain(
      "While a command that rewrites the branch or the worktree, such as a reset or a rebase, awaits its answer, nothing in that checkout is independent: change nothing there, and commit nothing.",
    );
  });

  it("the worker's refused line names the directory first, then the exact command or call", () => {
    expect(flat(workerNever())).toContain(
      "The line names the directory you ran it in, which after a move says which of your two checkouts, and the exact command or call.",
    );
    expect(workerTalking()).toContain(
      "/ restarting / refused in <directory>: <exact command or call> / moved to <clone path> / blocked: <reason>",
    );
    expect(read(WORKER)).not.toContain("refused <exact command>");
  });

  it("the lead reads the directory off a worker's refused line", () => {
    expect(leadMessages()).toContain(
      "- **A worker's `STATUS: refused`:** the line reads `refused in <directory>: <exact command or call>`, the directory being where the worker ran it, so a moved worker's line says which of its two checkouts.",
    );
  });

  const WORKER_CLONE_CASE = "A command that rewrites the branch or the worktree is such a case.";
  const LEAD_CLONE_CASE =
    "A command that rewrites the branch or the worktree, such as a reset or a rebase, is such a case.";
  const NOT_FETCH_OR_PUSH =
    "A refused fetch or push is not: the clone needs the same push, and cloning is the same fetch.";
  const PASS_BACK =
    "Pass the answer back as what they did: they ran it, and the worker reads its branch's head again before it goes on; they allowed it, and the worker runs it once, as it was; they approved the clone, and the worker moves as its skill says; or they declined, and the worker hands back blocked unless you rule another way.";

  it("the worker is offered a clone only where a fresh clone removes the need for the command", () => {
    const never = flat(workerNever());
    expect(never).toContain(
      "Your lead brings the maintainer one choice: they run it, or they allow it.",
    );
    expect(never).toContain(
      "Only where a fresh clone removes the need for the command does the choice become that they run it, or you redo the work in a fresh clone of your own.",
    );
    expect(never).toContain(`${WORKER_CLONE_CASE} ${NOT_FETCH_OR_PUSH}`);
  });

  it("the worker reads the head again after the maintainer ran a command, and runs an allowed one once", () => {
    expect(flat(workerNever())).toContain(
      "Where they ran it, read the branch's head again before you go on; where they allowed it, run it once, as it was.",
    );
  });

  it("a worker whose command the maintainer declined hands back blocked, unless its lead rules another way", () => {
    expect(flat(workerNever())).toContain(
      "where they allowed it, run it once, as it was. Where they declined, hand back blocked, unless your lead rules another way.",
    );
  });

  it("a command is a new command when the worker runs it again only once the maintainer ran or allowed it", () => {
    const never = flat(workerNever());
    expect(never).toContain(
      "Once they have run or allowed a command, running it again at a later step is a new command: if it is refused again, report it again, and never retry it.",
    );
    expect(never).not.toContain(". Running it again at a later step");
  });

  it("the worker takes the clone only on the maintainer's OK, bound by every Never rule, this one included", () => {
    expect(flat(workerNever())).toContain(
      "Take the clone only on that OK: first commit on the worktree's branch whatever is uncommitted there, then bring into the clone only the unpushed commits the redo keeps, keep to every rule in this list, this one included, work on the branch in that clone from then on, and tell your lead with a `STATUS: moved` line.",
    );
  });

  it("a moved worker's session files stay in the worktree, and setup and the restart run from there", () => {
    expect(flat(workerNever())).toContain(
      "Your session's own files, its bindings, its handoff and any restart marker, stay in the worktree, where your lead looks for them: run setup and the restart with the worktree as the working directory, reached by its full path, never from the clone, since both write those files under the directory they run in.",
    );
  });

  it("the worker leaves its worktree only on a move the maintainer approves after a refused command", () => {
    expect(workerBeforeEdit()).toContain(
      "Work only there, unless the maintainer approves a move to a fresh clone after a refused command (see Never).",
    );
  });

  it("the worker's first fetch, when refused, is a refused command", () => {
    expect(workerBeforeEdit()).toContain(
      "A refused fetch is a refused command (see Never), and it leaves a stale base, which shows up as changes you did not make.",
    );
  });

  it("a moved worker restarts with the worktree as the working directory", () => {
    expect(workerRestart()).toContain(
      "After a move to a clone, run it with the worktree as the working directory, reached by its full path: the bindings and the handoff are there, and your lead looks there for the restart marker.",
    );
  });

  it("a moved worker's handoff carries the clone, the approval and the worktree", () => {
    expect(workerRestart()).toContain(
      "After a move to a clone, it also carries the clone's full path, where the branch now lives, that the maintainer approved the move, and the worktree's full path, where the session's own files stay, so the resumed session carries on in the clone.",
    );
  });

  it("the lead makes a worktree its worker leaves only on a move the maintainer approves", () => {
    expect(leadStarting()).toContain(
      "The worker works only there, unless the maintainer approves its move to a fresh clone after a refused command.",
    );
  });

  it("the lead's handoff carries any clone an in-flight worker reported moving to", () => {
    expect(leadRestart()).toContain(
      "It also carries the epic, or on a defect run what `references/defect-run.md` lists for its handoff, or on an intent run what `references/intent-run.md` lists, the approved run lines, and each in-flight story: its worker's name and ref, its pull request, its last `STATUS`, any clone it reported moving to, and any message held for it.",
    );
  });

  it("the lead offers the clone only where it removes the need for the command", () => {
    const messages = leadMessages();
    expect(messages).toContain(
      "Bring the maintainer one choice: they run it there, or they allow it.",
    );
    expect(messages).toContain(
      "Only where a fresh clone removes the need for the command does the choice become that they run it, or the worker redoes the work in a fresh clone of its own.",
    );
    expect(messages).toContain(`${LEAD_CLONE_CASE} ${NOT_FETCH_OR_PUSH} ${PASS_BACK}`);
    expect(messages).toContain(
      "A command refused again, after the maintainer ran or allowed it, is a new line: bring it to them again, and never tell the worker to retry it.",
    );
    expect(messages).not.toContain("refused again at a later step");
  });

  it("the lead passes the answer back as what the maintainer did, and the checkout stays still until then", () => {
    const messages = leadMessages();
    expect(messages).toContain(PASS_BACK);
    expect(messages).toContain(
      "Until the answer comes, a worker whose refused command rewrites the branch or the worktree changes nothing in that checkout.",
    );
    expect(messages).not.toContain("Pass the answer back. A command");
    expect(messages).not.toContain("or they allowed it, and the worker runs it once, as it was.");
  });

  it("the lead removes a moved worker's clone only once it holds no commit its remote lacks", () => {
    expect(flat(section(read(LEAD), "7. A hand-back"))).toContain(
      "Remove its worktree, and any clone it reported moving to, once the branch has merged, after checking that nothing in either is uncommitted, and that the clone holds no commit its remote lacks: removing a worktree keeps its commits in the shared repository, and removing a clone does not.",
    );
  });

  it("a defect run removes a cancelled worker's clone under the same check", () => {
    const reference = read(join(SKILLS_TREE, "project-lead", "references", "defect-run.md"));
    expect(flat(section(reference, "6. Cancelling"))).toContain(
      "remove its worktree, and any clone it reported moving to, after checking that nothing in either is uncommitted beyond the diagnosis's own reproducing test, and that the clone holds no commit its remote lacks.",
    );
  });

  it("a send to the lead that the permission check refuses goes as a work note, never sent again", () => {
    expect(idsOf("story-worker")).toContain("post-work-note");
    expect(workerTalking()).toContain(
      "A message the transport refuses or skips is retried at your next event, and the work note is the backstop for a hand-back. A send your harness's permission check refuses is a refused call like any other (see Never): never send it again. Post its line as a note on the story's work item through the performer bound to `post-work-note` instead, with the `STATUS: refused` line for the send. Where the maintainer allows the send, that covers your later sends: the line already posted as a note is not sent again.",
    );
  });

  it("the lead acts on a line a worker posted as a note because its send was refused", () => {
    expect(flat(section(read(LEAD), "6. Watching the work"))).toContain(
      "Act on any hand-back or `restart-owner: lead` handoff you find there, and on any line a worker posted there because its send to you was refused.",
    );
  });

  it("with no lead, the worker puts a refusal to the maintainer as one question with both options", () => {
    expect(workerTalking()).toContain(
      "A `STATUS: refused` line is a question too: put it to them the same way, as one question with both options of the choice a lead would have brought (see Never).",
    );
  });

  it("a lead carrying its own story names any clone it moved to in its hand-back", () => {
    const reference = read(join(SKILLS_TREE, "project-lead", "references", "intent-run.md"));
    expect(flat(section(reference, "6. Carrying it yourself"))).toContain(
      "Your hand-back names the worktree, and any clone you moved to, for the maintainer to remove once the branch has merged.",
    );
  });

  it("a refused command or call awaiting its answer is not an ending", () => {
    const handBack = flat(section(read(WORKER), "8. Hand back"));
    expect(handBack).toContain(
      "you are blocked on something only someone else can remove, such as a failed setup or a missing prerequisite. Those are the only two endings.",
    );
    expect(handBack).toContain(
      "An open `DECISION` is not one, and neither is a refused command or call awaiting its answer: neither ends the story or gets a final receipt (see \"Talking to your lead\").",
    );
    expect(handBack).not.toContain("a push you cannot make");
  });

  it("the worker keeps working on what is independent while a refusal is open, as for a decision", () => {
    expect(workerTalking()).toContain(
      "While a decision is open, or a refused command or call awaits its answer, keep working on whatever in the story does not depend on it, and end your turn only when nothing independent is left; the answer arrives as a message. Neither an open decision nor an open refusal ends the story or gets a final receipt.",
    );
  });

  it("the worker's pull-request step still sends a refused push to the rule, and stops on any other failed push", () => {
    expect(flat(section(read(WORKER), "6. The pull request"))).toContain(
      "A push your harness's permission check refuses is a refused command (see Never). If you cannot push for any other reason, say so to your lead and stop.",
    );
  });

  it("the lead keeps a moved worker's branch in its clone and its session files in the worktree", () => {
    expect(leadMessages()).toContain(
      "- **A worker's `STATUS: moved`:** its branch lives in the clone the line names from then on, while its session's own files, its restart marker among them, stay in the worktree you made.",
    );
  });
});

/** A math-quest plan tag, such as `R34`, `KTD10`, `AE6` or `U6b`. */
const PLAN_TAG = /\b(?:R|KTD|AE)\d+\b|\bU\d+[a-z]?\b/;

/**
 * What an agent or a user reads in one skill file: a Markdown file whole, a
 * script without its comments. A comment keeps the tracker id and plan tag
 * of the change that wrote it, since it points into that history.
 */
function readerLines(file: string, text: string): string {
  if (file.endsWith(".md")) return text;
  const code = file.endsWith(".mjs") ? text.replace(/\/\*[\s\S]*?\*\//g, "") : text;
  const comment = file.endsWith(".mjs") ? /^\s*\/\// : /^\s*#/;
  return code
    .split("\n")
    .filter((line) => !comment.test(line))
    .join("\n");
}

/** Every Markdown file and script under `skills/`, as `readerLines` reads it. */
const READER_TEXT: readonly (readonly [string, string])[] = readdirSync(SKILLS_TREE, {
  recursive: true,
  encoding: "utf8",
})
  .filter((file) => /\.(md|sh|mjs)$/.test(file))
  .sort()
  .map((file) => [file, readerLines(file, readFileSync(join(SKILLS_TREE, file), "utf8"))] as const);

describe("what an agent or a user reads names no work tracker or plan tag", () => {
  it("reads the skills' Markdown and scripts", () => {
    const files = READER_TEXT.map(([file]) => file);
    expect(files).toContain(join("session-restart", "SKILL.md"));
    expect(files).toContain(join("session-restart", "scripts", "start-restart.sh"));
    expect(files).toContain(join("supervision-setup", "scripts", "receipt-check.mjs"));
  });

  it.each(READER_TEXT)("%s", (_file, text) => {
    expect(text.match(TRACKER_WORDS)?.[0]).toBeUndefined();
  });

  it.each(READER_TEXT)(
    "%s says what it means in plain words, with no plan tag",
    (_file, code) => {
      expect(code.match(PLAN_TAG)?.[0]).toBeUndefined();
    },
  );

  it.each([
    ["x.sh", '# written for MQ-1 (R34)\necho "see GRO-3 (KTD10)"\n'],
    ["x.mjs", '/** written for MQ-1 (R34) */\n// and MQ-2\nconst s = "see GRO-3 (KTD10)";\n'],
  ])("keeps a tracker id or plan tag in a comment of %s, and finds one in a string", (file, text) => {
    const kept = readerLines(file, text);
    expect(kept.match(TRACKER_WORDS)?.[0]).toBe("GRO-");
    expect(kept.match(PLAN_TAG)?.[0]).toBe("KTD10");
  });
});

/**
 * GRO-21 — every story says whether a lesson was captured, and where, or why
 * not: on a `Capture:` line in its receipt and the same line in its pull
 * request's body. The worker saves the body and hands it to the receipt
 * check, which reads only the saved body; the lead reads both lines itself,
 * in the receipt and in the body as it stands.
 */
describe("GRO-21 · the Capture line's text", () => {
  const oneLine = (text: string) => text.replace(/\s+/g, " ");
  /** One field of the receipt's template: its line and the indented lines that continue it. */
  const receiptField = (label: string) => {
    return oneLine(read(RECEIPT).match(new RegExp(`^${label}:.*(?:\\n[ \\t]+\\S.*)*`, "m"))?.[0] ?? "");
  };
  const step7 = () => oneLine(section(read(WORKER), "7. The pull-request round"));
  const step8 = () => oneLine(section(read(WORKER), "8. Hand back"));

  it("the receipt has a Capture field giving both forms, and says the body carries the same line", () => {
    const field = receiptField("Capture");
    expect(field).toContain("captured <");
    expect(field).toContain("skipped: <");
    expect(field).toContain("pull request's body");
  });

  it.each(["Capture", "Docs"])("the receipt's %s field gives each form the checker accepts for the body's line", (label) => {
    const rows: { label: string; accepts?: string[] }[] = readBodyLines(`${label}: nonsense\n`);
    const accepts = rows.find((row) => row.label === label)?.accepts ?? [];
    expect(accepts.length).toBeGreaterThan(0);
    const field = receiptField(label);
    for (const form of accepts) {
      // The words a value starts with, before the placeholder that names what follows them.
      const words = form.slice(`${label}: `.length, form.indexOf("<"));
      expect(words.trim(), form).not.toBe("");
      expect(field, form).toContain(words);
    }
  });

  it("the receipt's Capture field has a `not reached` value, which a ready pull request's line never takes", () => {
    const field = receiptField("Capture");
    expect(field).toContain("| not reached: <why>, for a story that ended before its completion checkpoint");
    expect(field).toContain('a ready pull request\'s line is never "not reached"');
    expect(field).not.toContain("or that the story ended before its completion checkpoint");
  });

  it("step 7 gives the body's line its shape: one line, the label, one space, the value", () => {
    expect(step7()).toContain("the label, its colon, one space, then the value, all on one line");
    expect(step7()).toContain("with nothing before it");
    // The shape is both lines': the receipt pads its labels to a column, and the body must not.
    expect(step7()).toContain(
      "In the body, each of the two is a line of its own with nothing before it: the label, its colon, one space, then the value, all on one line.",
    );
  });

  it("step 8 has the worker fix a failing body and check again before handing back", () => {
    expect(step8()).toContain(
      "save it again and rerun the check until both of the body's lines read `found`, before you hand back",
    );
    expect(step8()).toContain("unchanged and after your last edit to it");
  });

  it("the lead reads the two lines itself, in the receipt and in the live body, and its own reading decides where the check did not run", () => {
    const lead = oneLine(section(read(LEAD), "7. A hand-back"));
    // The check proves the saved file, so only the lead's own read ties the lines to the pull request.
    expect(lead).toContain(
      "read both yourself, in the receipt and in the pull request's body as it stands now, since the receipt check reads the file it was given, never the pull request or the receipt.",
    );
    expect(lead).toContain(
      "A hand-back missing either line in either place, or with a line whose value differs between the two, goes back to the worker, and so does one whose pasted check shows a body line as anything but `found`.",
    );
    // No dead end: a check that could not run sends nothing back on its own.
    expect(lead).toContain(
      "Where the pasted check says the body was not checked, or the check could not run, your own reading of the body decides.",
    );
    // Its own reading needs the rule the check applies: the shape, the forms and the one value a ready body never has.
    expect(lead).toContain(
      "In the body a line counts only in a form the worker's skill gives it, at the start of a line of its own, and never as `not reached` on a pull request that is ready.",
    );
  });

  it("the receipt's Receipt check field names --pr-body", () => {
    expect(receiptField("Receipt check")).toContain("--pr-body");
  });

  it.each([
    "`Capture:` line",
    "`captured` with the path",
    "`skipped:` with the reason",
    "a line of its own",
    "the `Docs:` and `Capture:` lines are brought up to date in both places",
  ])("story-worker's step 7 says %j", (phrase) => {
    expect(step7()).toContain(phrase);
  });

  it("step 7 writes the Capture line after the capture and before the pull request is marked ready", () => {
    const text = step7();
    const at = (phrase: string) => {
      expect(text, phrase).toContain(phrase);
      return text.indexOf(phrase);
    };
    expect(at("`capture-learning`")).toBeLessThan(at("`Capture:` line"));
    expect(at("`Capture:` line")).toBeLessThan(at("mark the pull request ready"));
    expect(at("pull request's body")).toBeLessThan(at("mark the pull request ready"));
  });

  it("step 8 saves the body to a file and passes it as --pr-body, and a blocked hand-back leaves it out", () => {
    const text = step8();
    expect(text).toContain('`--pr-body "<that file>"`');
    expect(text).toContain("to a file");
    expect(text).toContain(
      "with the command the repo's project instructions name, or else the repo host's own tool",
    );
    expect(text).toContain("A blocked hand-back leaves `--pr-body` out");
  });

  it("step 8 names no host's tool for saving the body", () => {
    expect(step8()).not.toBe("");
    expect(step8()).not.toMatch(/\bgh\b|github|curl/i);
  });

  it("the lead's claims check reads the two lines in the receipt and in the body, and sends back a hand-back missing either", () => {
    const handBack = oneLine(section(read(LEAD), "7. A hand-back"));
    const claims = handBack.slice(
      handBack.indexOf("**Check the claims.**"),
      handBack.indexOf("**Accept on the evidence.**"),
    );
    expect(claims).toContain("**Check the claims.**");
    expect(claims).toContain("`Capture:`");
    expect(claims).toContain("`Docs:`");
    expect(claims).toContain("pull request's body");
    expect(claims).toContain("goes back to the worker");
  });

  it("the capture-learning fallback writes a skipped Capture line, not a remark in the hand-back", () => {
    const capture = operationsOf(readTable("story-worker")).find((op) => op.id === "capture-learning");
    const fallback = oneLine(String(capture?.fallback ?? ""));
    expect(fallback).toContain("`skipped:`");
    expect(fallback).toContain("Capture");
    expect(fallback).not.toContain("say in the hand-back");
  });
});
