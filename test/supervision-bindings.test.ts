/**
 * MQ-350 — the supervision bindings file is the contract between setup and
 * every step that reads it (plan `docs/plans/2026-09-25-0105-feat-supervision-operating-model-plan.md`,
 * U4, KTD2, KTD3, KTD5).
 *
 * The supervision-setup skill turns a level skill's routing table, with the
 * repo's override merged over it, into
 * `.context/supervision/<session-name>/bindings.json`: one binding per
 * operation, each saying what performs it, how it was bound, and the evidence
 * quoted from the probe. A model writes that file by following the skill, so
 * this test cannot run setup. It holds the file's shape instead, on the example
 * in `test/fixtures/supervision/bindings.example.json` and on changed copies of
 * it, one per scenario U4 names. The level skills (R16), the restart (R22) and
 * the receipt check (KTD12) all read this shape.
 *
 * If this goes red: make the example and the skill's description of the file
 * agree with KTD2 again. Loosen a rule here only when KTD2 itself changed.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../skills/supervision-setup/scripts/vendor/smol-toml/index.js";

const EXAMPLE = "test/fixtures/supervision/bindings.example.json";
const SKILLS_TREE = "skills";
const OVERRIDES_TREE = "test/fixtures/supervision/routing-overrides";

/** The measuring operation, which needs a known context window (KTD6). */
const MEASURE = "measure-context";
const HOW_BOUND = ["check", "discovery", "fallback", "unavailable", "seed-rechecked"];
const PERFORMER_KINDS = ["skill", "cli", "tool", "agent"];
/** What `kind` a binding with no performer carries, by how it was bound. */
const NO_PERFORMER_KIND: Record<string, string> = { fallback: "instructions", unavailable: "none" };
const FILE_FIELDS = [
  "skill",
  "session",
  "harness",
  "model",
  "table",
  "seeded_from",
  "check_prompt",
  "transcripts",
  "operations",
  "report",
  "complete",
];
const BINDING_FIELDS = [
  "table",
  "id",
  "required",
  "suggested",
  "suggested_by",
  "how_bound",
  "kind",
  "native_id",
  "source",
  "invoke",
  "evidence",
  "rationale",
];

interface Binding {
  table: string;
  id: string;
  required: boolean;
  suggested: string[];
  suggested_by: string;
  how_bound: string;
  kind: string;
  native_id: string | null;
  source: string | null;
  invoke: string;
  evidence: string;
  rationale?: string;
}

interface Bindings {
  skill: string;
  session: string;
  harness: { name: string; version: string; evidence: string };
  model: { id: string; context_window: number | null; evidence: string };
  table: {
    path: string;
    sha256: string;
    override: string | null;
    override_sha256: string | null;
  };
  seeded_from: string | null;
  check_prompt: string | null;
  transcripts: { session_id: string; path: string }[];
  operations: Binding[];
  report: string[];
  complete?: { at: string };
}

type Operation = Record<string, unknown>;

/** Where the routing tables and overrides come from: disk, or a test's own. */
interface Tables {
  table(skill: string): Operation[] | undefined;
  override(skill: string): Record<string, Operation> | undefined;
}

const DISK: Tables = {
  table(skill) {
    const path = join(SKILLS_TREE, skill, "routing.toml");
    if (!existsSync(path)) return undefined;
    return ((parse(readFileSync(path, "utf8")) as Record<string, unknown>).operation ??
      []) as Operation[];
  },
  override(skill) {
    const path = join(OVERRIDES_TREE, `${skill}.toml`);
    if (!existsSync(path)) return undefined;
    return ((parse(readFileSync(path, "utf8")) as Record<string, unknown>).operation ??
      {}) as Record<string, Operation>;
  },
};

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Evidence is output quoted from a probe, or the word `unverified` (KTD2). */
function isEvidence(value: unknown): boolean {
  return value === "unverified" || (isText(value) && /"[^"]+"/.test(value));
}

/**
 * The name in a harness-native id that a logical name must equal (KTD3): the
 * last segment of a CLI's `command -v` path, the part after the last `__` of an
 * MCP tool id, the part after the last `:` of a skill or agent id, and the id
 * itself for any other tool.
 */
function unqualified(nativeId: string, kind = ""): string {
  if (kind === "cli") return nativeId.slice(nativeId.lastIndexOf("/") + 1);
  if (nativeId.startsWith("mcp__")) return nativeId.slice(nativeId.lastIndexOf("__") + 2);
  return nativeId.slice(nativeId.lastIndexOf(":") + 1);
}

/** What the table, with its override merged, suggests for one operation. */
function expectedSuggestion(b: Binding, tables: Tables): { by: string; names: unknown } {
  const overridden = tables.override(b.table)?.[b.id]?.performers;
  if (overridden !== undefined) return { by: "override", names: overridden };
  const op = tables.table(b.table)?.find((o) => o.id === b.id);
  return { by: "skill", names: op?.performers };
}

/** Everything wrong with how one binding names its performer (KTD2, KTD5). */
function performerProblems(b: Binding, name: string): string[] {
  const problems: string[] = [];
  const performs = !(b.how_bound in NO_PERFORMER_KIND);
  if (performs) {
    if (!PERFORMER_KINDS.includes(b.kind)) problems.push(`${name}: kind ${b.kind} is no performer`);
    if (!isText(b.native_id) || !isText(b.source))
      problems.push(`${name}: bound to a performer, but names no native id or source`);
  } else {
    if (b.kind !== NO_PERFORMER_KIND[b.how_bound])
      problems.push(
        `${name}: bound by ${b.how_bound}, so kind must be ${NO_PERFORMER_KIND[b.how_bound]}`,
      );
    if (b.native_id !== null || b.source !== null)
      problems.push(`${name}: bound by ${b.how_bound}, so it names no performer`);
  }
  // A seed-rechecked binding may have come from discovery, so only a first
  // check has to match a suggested name (KTD3).
  if (
    b.how_bound === "check" &&
    isText(b.native_id) &&
    !b.suggested.includes(unqualified(b.native_id, b.kind))
  )
    problems.push(`${name}: bound by check to ${b.native_id}, which no suggested name matches`);
  if (b.how_bound === "discovery" && !isText(b.rationale))
    problems.push(`${name}: bound by discovery with no rationale`);
  if (b.how_bound !== "discovery" && "rationale" in b)
    problems.push(`${name}: only a discovered binding carries a rationale`);
  return problems;
}

/** Everything wrong with one binding, given the tables it was bound from. */
function bindingProblems(b: Binding, tables: Tables): string[] {
  const name = `${b.table}/${b.id}`;
  const problems: string[] = [];
  for (const key of Object.keys(b)) {
    if (!BINDING_FIELDS.includes(key)) problems.push(`${name}: unknown field ${key}`);
  }
  if (!HOW_BOUND.includes(b.how_bound))
    problems.push(`${name}: how_bound ${b.how_bound} is not one of ${HOW_BOUND.join(", ")}`);
  if (!isEvidence(b.evidence))
    problems.push(`${name}: evidence is not quoted output or unverified`);
  if (!isText(b.invoke)) problems.push(`${name}: says nothing about how to invoke it`);
  const op = tables.table(b.table)?.find((o) => o.id === b.id);
  if (op === undefined) problems.push(`${name}: no such operation in the ${b.table} table`);
  else if ((op.required === true) !== b.required)
    problems.push(`${name}: required is ${b.required}, the table says ${op.required === true}`);
  const expected = expectedSuggestion(b, tables);
  if (b.suggested_by !== expected.by)
    problems.push(
      `${name}: suggested_by ${b.suggested_by}, but the suggestion came from the ${expected.by}`,
    );
  if (JSON.stringify(b.suggested) !== JSON.stringify(expected.names ?? []))
    problems.push(
      `${name}: suggested ${JSON.stringify(b.suggested)} is not what the ${expected.by} says`,
    );
  if (b.required && b.how_bound === "fallback")
    problems.push(`${name}: required, so it cannot fall back`);
  if (b.native_id?.startsWith("mcp__") && b.kind !== "tool")
    problems.push(`${name}: an MCP id is a tool, not a ${b.kind}`);
  return [...problems, ...performerProblems(b, name), ...checkProblems(b, name)];
}

/** What a binding by check proves (KTD3): a quoted line, and a CLI's absolute path. */
function checkProblems(b: Binding, name: string): string[] {
  if (b.how_bound !== "check") return [];
  const problems: string[] = [];
  if (b.evidence === "unverified")
    problems.push(`${name}: bound by check, so its evidence is the quoted snapshot or probe line`);
  if (b.kind === "cli" && !String(b.native_id).startsWith("/"))
    problems.push(`${name}: bound by check to CLI ${b.native_id}, which is not an absolute path`);
  return problems;
}

/** The file's skill, plus every skill it binds that ships its own table (KTD3). */
function boundTables(file: Bindings, tables: Tables): string[] {
  const skills = new Set([file.skill]);
  for (const b of file.operations) {
    if (b.kind === "skill" && isText(b.native_id) && tables.table(unqualified(b.native_id)))
      skills.add(unqualified(b.native_id));
  }
  return [...skills];
}

/** The operations a complete file must bind, as `table/id`, across every bound table. */
function expectedOperations(file: Bindings, tables: Tables): string[] {
  return boundTables(file, tables).flatMap((skill) =>
    (tables.table(skill) ?? []).map((op) => `${skill}/${String(op.id)}`),
  );
}

/** Every KTD2 field is present, and no other. */
function fieldProblems(file: Bindings): string[] {
  return [
    ...Object.keys(file)
      .filter((key) => !FILE_FIELDS.includes(key))
      .map((key) => `unknown field ${key}`),
    ...FILE_FIELDS.filter((key) => key !== "complete" && !(key in file)).map(
      (key) => `missing field ${key}`,
    ),
  ];
}

/** The model's context window, known or `null`, which the gauge measures against (KTD6). */
function windowProblems(file: Bindings): string[] {
  const problems: string[] = [];
  const window = file.model?.context_window;
  const known = window === null || (Number.isInteger(window) && window > 0);
  if (!known || !isEvidence(file.model?.evidence))
    problems.push("model needs a context window in tokens, or null, and quoted evidence");
  // A window is recorded only when a source gives it, never guessed.
  if (window !== null && file.model?.evidence === "unverified")
    problems.push("a context window needs its source quoted as evidence, never unverified");
  // With no known window the gauge cannot measure, so measuring is unavailable.
  const measuring = file.operations.find((b) => b.table === file.skill && b.id === MEASURE);
  if (window === null && measuring !== undefined && measuring.how_bound !== "unavailable")
    problems.push(`no context window is known, so ${MEASURE} binds as unavailable`);
  return problems;
}

/** The harness, model and table facts setup records before it binds anything. */
function factProblems(file: Bindings, tables: Tables): string[] {
  const problems: string[] = [];
  const { harness, table } = file;
  if (!isText(harness?.name) || !isText(harness.version) || !isEvidence(harness.evidence))
    problems.push("harness needs a name, a version and quoted evidence");
  problems.push(...windowProblems(file));
  if (!tables.table(file.skill)) problems.push(`no routing table for ${file.skill}`);
  if (!/^[0-9a-f]{64}$/.test(table?.sha256 ?? "")) problems.push("table needs a sha256");
  // The bindings file records a repo path, which uses "/" on every platform.
  const override = tables.override(file.skill) ? `${OVERRIDES_TREE}/${file.skill}.toml` : null;
  if (table?.override !== override)
    problems.push(
      `table.override is ${String(table?.override)}, but setup must merge ${String(override)}`,
    );
  return problems;
}

/** Where the check's snapshot was, and every transcript the session has had (KTD2, KTD3). */
function traceProblems(file: Bindings): string[] {
  const problems: string[] = [];
  // Every binding comes after the check, so only a file stopped at step 1,
  // with no operations, ran no check.
  const checked = file.operations.length > 0;
  const promptFile = `.context/supervision/${file.session}/check-prompt.txt`;
  if (file.harness?.name === "claude-code" && checked && file.check_prompt !== promptFile)
    problems.push("a check on claude-code records its check-prompt.txt in the session's folder");
  const transcripts = file.transcripts ?? [];
  const ids = transcripts.map((t) => t.session_id);
  if (ids.length === 0 || !transcripts.every((t) => isText(t.session_id) && isText(t.path)))
    problems.push("transcripts needs one id and path for every session id the session has had");
  if (new Set(ids).size !== ids.length) problems.push("transcripts lists a session id twice");
  if (file.seeded_from !== null && ids.length < 2)
    problems.push("a seeded run keeps the earlier transcripts and appends its own");
  return problems;
}

/** Everything that ties the file's operations to its marker and report (KTD2, KTD5, R36, R37). */
function completenessProblems(file: Bindings, tables: Tables): string[] {
  const problems: string[] = [];
  const named = (id: string) => file.report.some((line) => line.split(/[^\w-]+/).includes(id));
  const bound = file.operations.map((b) => `${b.table}/${b.id}`);
  bound
    .filter((key, i) => bound.indexOf(key) !== i)
    .forEach((key) => problems.push(`${key} is bound twice`));
  const missing = expectedOperations(file, tables).filter((key) => !bound.includes(key));
  const stopped = file.operations.filter((b) => b.required && b.how_bound === "unavailable");
  stopped
    .filter((b) => !named(b.id))
    .forEach((b) =>
      problems.push(`${b.id} is required and unavailable, and no report line names it`),
    );
  const unknown = boundTables(file, tables).flatMap((skill) => {
    const table = tables.table(skill) ?? [];
    return Object.keys(tables.override(skill) ?? {}).filter(
      (id) => !table.some((op) => op.id === id),
    );
  });
  unknown
    .filter((id) => !named(id))
    .forEach((id) =>
      problems.push(`the override names ${id}, which the table lacks, and no report line names it`),
    );
  // An unknown id in the level table's own override stops setup at step 1,
  // before the check, so nothing is bound; a bound skill's is found later.
  const ownTable = tables.table(file.skill) ?? [];
  const ownUnknown = Object.keys(tables.override(file.skill) ?? {}).filter(
    (id) => !ownTable.some((op) => op.id === id),
  );
  if (file.operations.length === 0 && ownUnknown.length === 0)
    problems.push(
      "binds no operation, but only an unknown override id stops setup before the check",
    );
  ownUnknown
    .filter(() => file.operations.length > 0)
    .forEach((id) =>
      problems.push(`the override names ${id}, so setup stopped at step 1 and binds no operation`),
    );
  if (file.complete !== undefined) {
    if (!isText(file.complete.at)) problems.push("the completion marker has no time");
    missing.forEach((key) => problems.push(`complete, but ${key} has no binding`));
    stopped.forEach((b) => problems.push(`complete, but required ${b.id} is unavailable`));
    unknown.forEach((id) => problems.push(`complete, but the override names unknown ${id}`));
    if (file.report.length > 0) problems.push("complete, but setup reported a stop");
  }
  if (file.seeded_from === null) {
    file.operations
      .filter((b) => b.how_bound === "seed-rechecked")
      .forEach((b) => problems.push(`${b.id}: seed-rechecked, but the run was not seeded`));
  }
  return problems;
}

/** Everything wrong with a bindings file; empty when it is well formed. */
function bindingsProblems(file: Bindings, tables: Tables = DISK): string[] {
  return [
    ...fieldProblems(file),
    ...factProblems(file, tables),
    ...traceProblems(file),
    ...file.operations.flatMap((b) => bindingProblems(b, tables)),
    ...completenessProblems(file, tables),
  ];
}

/** R16: a session loads its bindings only when the completion marker is there. */
function isComplete(file: Bindings): boolean {
  return file.complete !== undefined;
}

function example(): Bindings {
  return JSON.parse(readFileSync(EXAMPLE, "utf8")) as Bindings;
}

function binding(file: Bindings, id: string): Binding {
  const found = file.operations.find((b) => b.id === id && b.table === file.skill);
  if (!found) throw new Error(`the example has no ${id} binding`);
  return found;
}

/** The disk's tables with some replaced, for the scenarios that need other tables. */
function tablesWith(replace: {
  table?: Record<string, Operation[]>;
  override?: Record<string, Record<string, Operation> | undefined>;
}): Tables {
  return {
    table: (skill) => (skill in (replace.table ?? {}) ? replace.table?.[skill] : DISK.table(skill)),
    override: (skill) =>
      skill in (replace.override ?? {}) ? replace.override?.[skill] : DISK.override(skill),
  };
}

/** A copy of `file` as a seeded rerun after a restart writes it (KTD2, R22). */
function seededRerun(file: Bindings): Bindings {
  const next = structuredClone(file);
  next.seeded_from = `.context/supervision/${file.session}/handoff.md`;
  next.transcripts.push({
    session_id: "after-the-clear",
    path: "/transcripts/after-the-clear.jsonl",
  });
  next.operations = next.operations.map((b) =>
    b.how_bound === "check" ? { ...b, how_bound: "seed-rechecked" } : b,
  );
  return next;
}

function stop(file: Bindings, line: string): Bindings {
  delete file.complete;
  file.report = [line];
  return file;
}

describe("MQ-350 · the example bindings file", () => {
  it("is well formed: every KTD2 field, for every operation", () => {
    expect(bindingsProblems(example())).toEqual([]);
  });

  it("is complete", () => {
    expect(isComplete(example())).toBe(true);
  });

  it("binds the story table with this repo's override merged", () => {
    expect(example().skill).toBe("story-worker");
    expect(example().table.override).toBe("test/fixtures/supervision/routing-overrides/story-worker.toml");
  });

  it("binds the logical name ce-work to compound-engineering:ce-work by check (AE1)", () => {
    const build = binding(example(), "build");
    expect(build).toMatchObject({
      suggested: ["ce-work"],
      how_bound: "check",
      kind: "skill",
      native_id: "compound-engineering:ce-work",
    });
  });

  it("records the check's prompt file, where the snapshot the evidence quotes lives", () => {
    const file = example();
    file.check_prompt = null;
    expect(bindingsProblems(file)).toContain(
      "a check on claude-code records its check-prompt.txt in the session's folder",
    );
  });

  it("has no discovery rows (AE1)", () => {
    expect(example().operations.filter((b) => b.how_bound === "discovery")).toEqual([]);
  });
});

describe("MQ-350 · what a bindings file may not hold", () => {
  it("fails a how_bound outside the five", () => {
    const file = example();
    binding(file, "build").how_bound = "guessed";
    expect(bindingsProblems(file)).toContain(
      `story-worker/build: how_bound guessed is not one of ${HOW_BOUND.join(", ")}`,
    );
  });

  it("fails a fallback binding that names a skill as its performer (KTD5)", () => {
    const file = example();
    Object.assign(binding(file, "build"), { how_bound: "fallback", kind: "skill" });
    expect(bindingsProblems(file)).toEqual(
      expect.arrayContaining([
        "story-worker/build: bound by fallback, so kind must be instructions",
        "story-worker/build: bound by fallback, so it names no performer",
      ]),
    );
  });

  it("accepts a fallback binding that runs the operation's own instructions", () => {
    const file = example();
    Object.assign(binding(file, "build"), {
      how_bound: "fallback",
      kind: "instructions",
      native_id: null,
      source: null,
      invoke: "Run the build operation's fallback instructions from the table.",
      evidence: 'the catalog snapshot has no entry named "ce-work"',
    });
    expect(bindingsProblems(file)).toEqual([]);
  });

  it.each(["", "   ", "the skill is listed"])(
    "fails evidence that is not quoted: %j",
    (evidence) => {
      const file = example();
      binding(file, "build").evidence = evidence;
      expect(bindingsProblems(file)).toContain(
        "story-worker/build: evidence is not quoted output or unverified",
      );
    },
  );

  it("accepts unverified as evidence where no check matched", () => {
    const file = example();
    Object.assign(binding(file, "build"), {
      how_bound: "discovery",
      rationale: "builds from a plan, which is the operation's intent",
      evidence: "unverified",
    });
    expect(bindingsProblems(file)).toEqual([]);
  });

  it("fails a check binding whose evidence is unverified (KTD3)", () => {
    const file = example();
    binding(file, "build").evidence = "unverified";
    expect(bindingsProblems(file)).toContain(
      "story-worker/build: bound by check, so its evidence is the quoted snapshot or probe line",
    );
  });

  it("fails a CLI bound by check whose native id is not an absolute path (KTD3)", () => {
    const file = example();
    Object.assign(binding(file, "build"), { kind: "cli", native_id: "ce-work" });
    expect(bindingsProblems(file)).toContain(
      "story-worker/build: bound by check to CLI ce-work, which is not an absolute path",
    );
    binding(file, "build").native_id = "/usr/local/bin/ce-work";
    expect(bindingsProblems(file)).toEqual([]);
  });

  it("binds measuring as unavailable when no context window is known", () => {
    const file = example();
    file.model = { ...file.model, context_window: null, evidence: "unverified" };
    expect(bindingsProblems(file)).toContain(
      "no context window is known, so measure-context binds as unavailable",
    );
    Object.assign(binding(file, "measure-context"), {
      how_bound: "unavailable",
      kind: "none",
      native_id: null,
      source: null,
    });
    expect(bindingsProblems(file)).toEqual([]);
  });

  it("keeps measuring for a model id with no [1m] suffix when a source gives its window", () => {
    const file = example();
    file.model = {
      id: "claude-opus-5-5",
      context_window: 1000000,
      evidence:
        'https://code.claude.com/docs/en/model-config.md: "Fable 5.1, Fable 5, Sonnet 5 and later, Haiku 5.5, and Opus 4.7 and later run with the 1M window by default, with no `[1m]` suffix needed." (checked 2026-10-08)',
    };
    expect(bindingsProblems(file)).toEqual([]);
  });

  it("fails a window recorded without a source, since a window is never guessed", () => {
    const file = example();
    file.model = { id: "claude-opus-5-5", context_window: 1000000, evidence: "unverified" };
    expect(bindingsProblems(file)).toContain(
      "a context window needs its source quoted as evidence, never unverified",
    );
  });

  it("fails a stop file with no operations that no override typo explains", () => {
    const file = stop(example(), "setup stopped");
    file.operations = [];
    expect(bindingsProblems(file)).toContain(
      "binds no operation, but only an unknown override id stops setup before the check",
    );
  });

  it("fails a check binding whose native id matches no suggested name (KTD3)", () => {
    const file = example();
    binding(file, "build").native_id = "compound-engineering:ce-plan";
    expect(bindingsProblems(file)).toContain(
      "story-worker/build: bound by check to compound-engineering:ce-plan, which no suggested name matches",
    );
  });

  it("fails a discovered binding with no rationale", () => {
    const file = example();
    binding(file, "build").how_bound = "discovery";
    expect(bindingsProblems(file)).toContain(
      "story-worker/build: bound by discovery with no rationale",
    );
  });

  it("fails a suggestion recorded as the skill's when the override made it (R37)", () => {
    const file = example();
    binding(file, "post-work-note").suggested_by = "skill";
    expect(bindingsProblems(file)).toContain(
      "story-worker/post-work-note: suggested_by skill, but the suggestion came from the override",
    );
  });
});

describe("MQ-350 · the completion marker and stops (KTD2, KTD5, R16, R36)", () => {
  it("flags a file without the completion marker as incomplete", () => {
    const file = example();
    delete file.complete;
    expect(isComplete(file)).toBe(false);
  });

  it("stays complete when an operation that is not required binds as unavailable", () => {
    const file = example();
    Object.assign(binding(file, "measure-context"), {
      how_bound: "unavailable",
      kind: "none",
      native_id: null,
      source: null,
      invoke: "Do not measure; this session will not restart itself.",
      evidence:
        'context-gauge answered "context=unavailable reason=no measuring recipe for harness droid"',
    });
    expect(bindingsProblems(file)).toEqual([]);
    expect(isComplete(file)).toBe(true);
  });

  const noPerformer = {
    how_bound: "unavailable",
    kind: "none",
    native_id: null,
    source: null,
    invoke: "Nothing can post a work note in this session.",
    evidence: 'the catalog snapshot has no entry named "save_comment"',
  };

  it("fails a complete file whose required operation is unavailable", () => {
    const file = example();
    Object.assign(binding(file, "post-work-note"), noPerformer);
    file.report = ["post-work-note is required and nothing available performs it"];
    expect(bindingsProblems(file)).toContain(
      "complete, but required post-work-note is unavailable",
    );
  });

  it("stops without the marker, with a report line naming the required operation", () => {
    const file = stop(example(), "post-work-note is required and nothing available performs it");
    Object.assign(binding(file, "post-work-note"), noPerformer);
    expect(bindingsProblems(file)).toEqual([]);
    expect(isComplete(file)).toBe(false);
  });

  it("fails a stop whose report does not name the required operation", () => {
    const file = stop(example(), "setup stopped");
    Object.assign(binding(file, "post-work-note"), noPerformer);
    expect(bindingsProblems(file)).toContain(
      "post-work-note is required and unavailable, and no report line names it",
    );
  });

  it("stops a repo with no tracker by override or discovery, naming the work-note operation (KTD16)", () => {
    const tables = tablesWith({ override: { "story-worker": undefined } });
    const file = stop(example(), "post-work-note is required: no tracker by override or discovery");
    file.table.override = null;
    file.table.override_sha256 = null;
    Object.assign(binding(file, "post-work-note"), {
      ...noPerformer,
      suggested: [],
      suggested_by: "skill",
    });
    expect(bindingsProblems(file, tables)).toEqual([]);
    expect(isComplete(file)).toBe(false);
  });
});

describe("MQ-350 · the override (R37, AE9)", () => {
  const reviewOverride = {
    ...DISK.override("story-worker"),
    review: { performers: ["ce-code-review"] },
  };

  it("binds the override's reviewer by check, recording suggested_by override", () => {
    const tables = tablesWith({ override: { "story-worker": reviewOverride } });
    const file = example();
    Object.assign(binding(file, "review"), {
      suggested: ["ce-code-review"],
      suggested_by: "override",
      native_id: "compound-engineering:ce-code-review",
      evidence: '"- compound-engineering:ce-code-review: Review a named diff or PR for bugs"',
    });
    expect(bindingsProblems(file, tables)).toEqual([]);
    const byOverride = file.operations
      .filter((b) => b.table === file.skill && b.suggested_by === "override")
      .map((b) => b.id);
    expect(byOverride.sort()).toEqual(Object.keys(reviewOverride).sort());
    expect(binding(file, "review").how_bound).toBe("check");
  });

  it("fails a review binding that ignores the override", () => {
    const tables = tablesWith({ override: { "story-worker": reviewOverride } });
    expect(bindingsProblems(example(), tables)).toContain(
      "story-worker/review: suggested_by skill, but the suggestion came from the override",
    );
  });

  it("stops on an override naming an operation the table lacks, with one report line naming it", () => {
    const typo = { ...DISK.override("story-worker"), reviw: { performers: ["ce-code-review"] } };
    const tables = tablesWith({ override: { "story-worker": typo } });
    expect(bindingsProblems(example(), tables)).toEqual(
      expect.arrayContaining([
        "the override names reviw, which the table lacks, and no report line names it",
        "complete, but the override names unknown reviw",
      ]),
    );
    const stopped = stop(
      example(),
      "the override for story-worker names reviw, which its table lacks",
    );
    // The stop comes at step 1, before the check, so the file binds nothing.
    expect(bindingsProblems(stopped, tables)).toContain(
      "the override names reviw, so setup stopped at step 1 and binds no operation",
    );
    const beforeCheck = { ...stopped, operations: [], check_prompt: null };
    expect(bindingsProblems(beforeCheck, tables)).toEqual([]);
    expect(isComplete(beforeCheck)).toBe(false);
  });

  it("records the check-prompt.txt on claude-code even when the check bound no row", () => {
    const file = example();
    delete file.complete;
    const optional = file.operations.find((b) => !b.required);
    if (!optional) throw new Error("the example binds no optional operation");
    const byFallback = { ...optional, how_bound: "fallback", kind: "instructions" };
    file.operations = [{ ...byFallback, native_id: null, source: null }];
    expect(bindingsProblems(file)).toEqual([]);
    file.check_prompt = null;
    expect(bindingsProblems(file)).toContain(
      "a check on claude-code records its check-prompt.txt in the session's folder",
    );
  });

  it("fails a file that skipped the repo's override", () => {
    const file = example();
    file.table.override = null;
    expect(bindingsProblems(file)).toContain(
      "table.override is null, but setup must merge test/fixtures/supervision/routing-overrides/story-worker.toml",
    );
  });
});

describe("MQ-350 · a seeded rerun after a restart (KTD2, KTD3, R22)", () => {
  it("keeps the earlier transcripts and appends the new one", () => {
    const first = example();
    const rerun = seededRerun(first);
    expect(bindingsProblems(rerun)).toEqual([]);
    expect(rerun.transcripts.slice(0, first.transcripts.length)).toEqual(first.transcripts);
    expect(rerun.transcripts).toHaveLength(first.transcripts.length + 1);
  });

  it("merges the same override the first setup merged, named by the table's skill field", () => {
    const first = example();
    expect(seededRerun(first).table.override).toBe(first.table.override);
    const skipped = seededRerun(first);
    skipped.table.override = null;
    expect(bindingsProblems(skipped)).toContain(
      "table.override is null, but setup must merge test/fixtures/supervision/routing-overrides/story-worker.toml",
    );
  });

  it("fails a seed-rechecked binding in a run that was not seeded", () => {
    const file = example();
    binding(file, "build").how_bound = "seed-rechecked";
    expect(bindingsProblems(file)).toContain("build: seed-rechecked, but the run was not seeded");
  });

  it("keeps a discovered binding that a seeded rerun rechecks, though no suggested name matches it", () => {
    const first = example();
    const build = binding(first, "build");
    Object.assign(build, {
      how_bound: "discovery",
      native_id: "other-framework:build",
      rationale: "builds from a plan, which is the operation's intent",
    });
    expect(bindingsProblems(first)).toEqual([]);
    const rerun = seededRerun(first);
    const rechecked = binding(rerun, "build");
    rechecked.how_bound = "seed-rechecked";
    delete rechecked.rationale;
    expect(bindingsProblems(rerun)).toEqual([]);
  });

  it("fails a transcript listed twice", () => {
    const file = example();
    const [first] = file.transcripts;
    if (!first) throw new Error("the example lists no transcript");
    file.transcripts.push({ ...first });
    expect(bindingsProblems(file)).toContain("transcripts lists a session id twice");
  });
});

describe("MQ-350 · a bound skill's own table is bound too (KTD3, KTD15)", () => {
  const restartIds = (DISK.table("session-restart") ?? []).map((op) => String(op.id));

  it("fails a complete file that binds session-restart but not its operations", () => {
    const file = example();
    file.operations = file.operations.filter((b) => b.table !== "session-restart");
    expect(bindingsProblems(file)).toEqual(
      expect.arrayContaining(
        restartIds.map((id) => `complete, but session-restart/${id} has no binding`),
      ),
    );
  });

  it("accepts it once session-restart's operations are bound, as the example binds them (MQ-359)", () => {
    const file = example();
    const bound = file.operations.filter((b) => b.table === "session-restart").map((b) => b.id);
    expect(restartIds.length).toBeGreaterThan(0);
    expect(bound).toEqual(restartIds);
    expect(bindingsProblems(file)).toEqual([]);
  });
});

describe("MQ-350 · review findings the contract now holds", () => {
  it("binds a CLI by check with its command -v path as the native id (KTD3)", () => {
    const file = example();
    Object.assign(binding(file, "hand-back"), {
      how_bound: "check",
      kind: "cli",
      native_id: "/opt/homebrew/bin/herdr",
      source: "/opt/homebrew/bin/herdr",
      evidence: 'check-prompt.txt probe line "command -v herdr: /opt/homebrew/bin/herdr"',
    });
    expect(bindingsProblems(file)).toEqual([]);
  });

  it("fails a required operation recorded as a fallback (KTD5, R36)", () => {
    const file = example();
    Object.assign(binding(file, "post-work-note"), {
      how_bound: "fallback",
      kind: "instructions",
      native_id: null,
      source: null,
    });
    expect(bindingsProblems(file)).toContain(
      "story-worker/post-work-note: required, so it cannot fall back",
    );
  });

  it("fails a file whose skill has no routing table", () => {
    const file = example();
    file.skill = "story-workr";
    expect(bindingsProblems(file)).toContain("no routing table for story-workr");
  });

  it("fails a seeded run that kept no earlier transcript", () => {
    const rerun = seededRerun(example());
    rerun.transcripts = rerun.transcripts.slice(-1);
    expect(bindingsProblems(rerun)).toContain(
      "a seeded run keeps the earlier transcripts and appends its own",
    );
  });

  it("does not count a report line that only contains the id inside a word", () => {
    const typo = { ...DISK.override("story-worker"), pla: { performers: ["ce-plan"] } };
    const tables = tablesWith({ override: { "story-worker": typo } });
    const file = stop(example(), "produce-breakdown fell back to planning by hand");
    expect(bindingsProblems(file, tables)).toContain(
      "the override names pla, which the table lacks, and no report line names it",
    );
  });

  it("checks the override of a bound skill's own table for unknown ids too", () => {
    const restart: Operation[] = [{ id: "type-into-pane", performers: ["herdr"], required: false }];
    const tables = tablesWith({
      table: { "session-restart": restart },
      override: { "session-restart": { "typ-into-pane": { performers: ["herdr"] } } },
    });
    expect(bindingsProblems(example(), tables)).toContain(
      "the override names typ-into-pane, which the table lacks, and no report line names it",
    );
  });

  it("fails an MCP tool id recorded as another kind", () => {
    const file = example();
    binding(file, "post-work-note").kind = "skill";
    expect(bindingsProblems(file)).toContain(
      "story-worker/post-work-note: an MCP id is a tool, not a skill",
    );
  });
});
