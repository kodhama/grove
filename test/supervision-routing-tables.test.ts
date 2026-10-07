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
 * (KTD3, amended by MQ-350). The tracker operations
 * are the only ones a default table may leave without a performer:
 * the repo's override, or setup's discovery, supplies it. After this repo's
 * overrides are merged, every operation has one.
 *
 * Only this test parses the tables; setup hands them to the model as text.
 *
 * If this goes red: fix the table or override it names. Loosen a pattern
 * below only when the table's wording is right and the pattern misreads it.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../skills/supervision-setup/scripts/vendor/smol-toml/index.js";

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

/** The operations whose only real performers are a work tracker (KTD16). */
const TRACKER_OPERATIONS = [
  "post-work-note",
  "read-work-notes",
  "file-stories",
  "find-work-items",
  "update-work-item",
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
  } else if (performers.length === 0 && !TRACKER_OPERATIONS.includes(name)) {
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

  it("lets only a tracker operation go without a performer", () => {
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

/** One `## ` section of a Markdown file, from its heading to the next. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start < 0) return "";
  const next = text.indexOf("\n## ", start + 1);
  return text.slice(start, next < 0 ? undefined : next);
}

describe("MQ-373 · the defect route's text", () => {
  const LEAD = join(SKILLS_TREE, "project-lead", "SKILL.md");
  const REFERENCE = join(SKILLS_TREE, "project-lead", "references", "defect-run.md");
  const WORKER = join(SKILLS_TREE, "story-worker", "SKILL.md");
  const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

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
 * The text an agent or a user reads: every Markdown file under `skills/`,
 * and every script line that is not a comment. A comment keeps the tracker
 * id of the change that wrote it, since it points into that history.
 */
function readerText(): readonly (readonly [string, string])[] {
  const files = readdirSync(SKILLS_TREE, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(md|sh|mjs)$/.test(f))
    .sort();
  return files.map((file) => {
    const text = readFileSync(join(SKILLS_TREE, file), "utf8");
    if (file.endsWith(".md")) return [file, text] as const;
    const code = file.endsWith(".mjs") ? text.replace(/\/\*[\s\S]*?\*\//g, "") : text;
    const comment = file.endsWith(".mjs") ? /^\s*\/\// : /^\s*#/;
    return [file, code.split("\n").filter((line) => !comment.test(line)).join("\n")] as const;
  });
}

describe("what an agent or a user reads names no work tracker or plan tag", () => {
  it("reads the skills' Markdown and scripts", () => {
    const files = readerText().map(([file]) => file);
    expect(files).toContain(join("session-restart", "SKILL.md"));
    expect(files).toContain(join("session-restart", "scripts", "start-restart.sh"));
    expect(files).toContain(join("supervision-setup", "scripts", "receipt-check.mjs"));
  });

  it.each(readerText())("%s", (_file, text) => {
    expect(text.match(TRACKER_WORDS)?.[0]).toBeUndefined();
  });

  it.each(readerText().filter(([file]) => !file.endsWith(".md")))(
    "%s says what it means in plain words, with no plan tag",
    (_file, code) => {
      expect(code.match(/\b(?:R|KTD|AE)\d+\b|\bU\d+[a-z]?\b/)?.[0]).toBeUndefined();
    },
  );

  it("keeps a tracker id in a comment, and finds one in a script's string", () => {
    const sh = '# written for MQ-1\necho "see GRO-3"\n';
    const kept = sh.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
    expect(kept.match(TRACKER_WORDS)?.[0]).toBe("GRO-");
  });
});

describe("MQ-348 · the bindings folder (R9, KTD2)", () => {
  it("git ignores .context/supervision/", () => {
    const result = spawnSync("git", [
      "check-ignore",
      "-q",
      ".context/supervision/some-lead/bindings.json",
    ]);
    expect(result.status).toBe(0);
  });
});
