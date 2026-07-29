// Upstream: spec-0004-dual-host-distribution@v6 INV1, INV2, INV5-INV7,
// INV17, INV20, INV23-INV28, INV33, INV37-INV41;
// S1, S2, S15, S18, S21-S24, S31, S35-S39.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildProjectionSet,
  checkProjectionSet,
  writeProjectionSet,
} from "../lib/generate.mjs";
import {
  CODEX_ENTRY_DISCLOSURE,
  COMPANION_PROJECTIONS,
  ENTRY_BEHAVIOR_SOURCE,
  ENTRY_SKILLS,
  FLOOR_SLUGS,
  GENERATED_FILES,
  GENERATED_ROOTS,
  INVENTORY_PATH,
  LIFECYCLE_SOURCE,
} from "../config.mjs";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..", "..");
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "..", "..");

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "grove-role-build-"));
  await mkdir(path.join(root, "plugins", "grove"), { recursive: true });
  await cp(path.join(REPO_ROOT, "charters"), path.join(root, "charters"), {
    recursive: true,
  });
  await cp(
    path.join(REPO_ROOT, INVENTORY_PATH),
    path.join(root, INVENTORY_PATH),
  );
  await mkdir(path.dirname(path.join(root, LIFECYCLE_SOURCE)), {
    recursive: true,
  });
  await cp(
    path.join(REPO_ROOT, LIFECYCLE_SOURCE),
    path.join(root, LIFECYCLE_SOURCE),
  );
  await mkdir(path.dirname(path.join(root, ENTRY_BEHAVIOR_SOURCE)), {
    recursive: true,
  });
  await cp(
    path.join(REPO_ROOT, ENTRY_BEHAVIOR_SOURCE),
    path.join(root, ENTRY_BEHAVIOR_SOURCE),
  );
  return root;
}

async function withFixture(fn) {
  const root = await fixture();
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function withoutArtifactFrontmatter(text) {
  const match = text.match(/^---\n[\s\S]*?\n---\n/);
  assert.ok(match, "fixture canonical source must have leading artifact front matter");
  return text.slice(match[0].length);
}

function withoutGeneratedHeader(text) {
  return text.slice(text.indexOf("\n") + 1);
}

test("inventory is metadata-only, complete, and models the driving/scoped boundary", async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPO_ROOT });
  const inventory = JSON.parse(
    await readFile(path.join(REPO_ROOT, INVENTORY_PATH), "utf8"),
  );

  assert.equal(inventory.roles.length, 14);
  assert.equal(new Set(inventory.roles.map((role) => role.id)).size, 14);
  assert.equal(
    Object.keys(inventory).some((key) =>
      ["instructions", "method", "workflow", "boundaries"].includes(key),
    ),
    false,
  );
  for (const role of inventory.roles) {
    assert.equal(
      Object.keys(role).some((key) =>
        ["instructions", "method", "workflow", "boundaries"].includes(key),
      ),
      false,
    );
  }

  const shaper = inventory.roles.find((role) => role.id === "shaper");
  assert.deepEqual(shaper.exposures, [{ class: "driving-session" }]);
  assert.equal(outputs.has("plugins/grove/adapters/claude/agents/shaper.md"), false);

  const dispatcher = inventory.roles.find((role) => role.id === "dispatcher");
  assert.deepEqual(dispatcher.exposures, [
    { class: "driving-session" },
    {
      class: "scoped-advisor",
      native_id: "grove_dispatcher",
      source_fragment: "scoped-agent-boundary",
    },
  ]);
  const dispatcherEnvelope = outputs.get(
    "plugins/grove/adapters/claude/agents/dispatcher.md",
  );
  assert.match(dispatcherEnvelope, /scoped-agent-boundary/);
  assert.doesNotMatch(dispatcherEnvelope, /sequence every other agent/);

  const planner = inventory.roles.find(
    (role) => role.id === "implementation-planner",
  );
  assert.deepEqual(planner.exposures, [
    {
      class: "cold-native",
      native_id: "grove_implementation_planner",
    },
  ]);
});

test("INV38-INV41/S36-S39: canonical charters bound planning, routing, authority, and relay", async () => {
  const [planner, dispatcher, executor] = (
    await Promise.all(
      ["implementation-planner", "dispatcher", "executor"].map((role) =>
        readFile(path.join(REPO_ROOT, "charters", `${role}.md`), "utf8"),
      ),
    )
  ).map((text) => text.replace(/\s+/g, " "));

  for (const required of [
    /concise/i,
    /human-readable/i,
    /one governing artifact/i,
    /every acceptance criterion/i,
    /verified facts?.*inferences?|inferences?.*verified facts?/is,
    /red → green → refactor/i,
    /exact verification commands/i,
    /risks, ambiguities, and blockers/i,
  ]) {
    assert.match(planner, required);
  }
  assert.match(planner, /read-only/i);
  assert.match(planner, /shall not edit|never edit/i);
  assert.match(planner, /no (?:prescribed|required) heading|headings?[^.]*not prescribed/i);
  assert.doesNotMatch(planner, /packet_schema|canonical JSON|locator grammar|checkpoint schema/i);

  const precedence = [
    /wrong or conflicting approved decision/i,
    /missing, inadequate, or ambiguous specification/i,
    /decision-only non-code/i,
    /reproduced, root-caused, localized implementation slip/i,
    /all other ratified code-bearing specification work/i,
  ].map((pattern) => dispatcher.search(pattern));
  assert.ok(precedence.every((index) => index >= 0), "dispatcher names every route");
  assert.deepEqual([...precedence].sort((left, right) => left - right), precedence);
  assert.match(
    dispatcher,
    /public interface,\s+schema,\s+dispatch behavior,\s+cross-component\s+behavior,\s+or governing artifact/i,
  );
  assert.match(dispatcher, /complete planner final-response\s+message unchanged/i);
  assert.match(dispatcher, /artifact\s+pointer separately/i);
  assert.match(dispatcher, /separately cold executor/i);
  assert.match(dispatcher, /missing or truncated[^.]*relay loss/is);
  assert.match(dispatcher, /intact,\s+unchanged[^.]*without replanning/is);

  assert.match(executor, /independently reopen/i);
  assert.match(executor, /artifact and its declared\s+dependency graph/i);
  assert.match(executor, /stale,\s+substantively incomplete,\s+ambiguous,\s+or conflicting/i);
  assert.match(executor, /artifact wins/i);
  assert.match(executor, /never implement a requirement\s+added or reinterpreted by the plan/i);
  assert.match(executor, /may ignore the defective plan and\s+proceed/i);
  assert.match(executor, /decision or specification is itself[^.]*upstream route/is);
});

test("all projections are marked, source-addressed, and native ids are unique underscore forms", async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPO_ROOT });
  const inventory = JSON.parse(
    await readFile(path.join(REPO_ROOT, INVENTORY_PATH), "utf8"),
  );
  const native = inventory.roles.flatMap((role) =>
    role.exposures
      .filter((exposure) => exposure.native_id)
      .map((exposure) => exposure.native_id),
  );

  assert.equal(native.length, 13);
  assert.equal(new Set(native).size, native.length);
  for (const id of native) {
    assert.match(id, /^[a-z0-9_]+$/);
    assert.doesNotMatch(id, /-/);
  }
  const launcherBundle = JSON.parse(
    outputs.get("plugins/grove/metadata/codex-launchers.json"),
  );
  for (const launcher of launcherBundle.launchers) {
    assert.match(
      launcher.content,
      new RegExp(`Canonical Grove role id: ${launcher.canonical_id}\\.`),
    );
    assert.match(
      launcher.content,
      new RegExp(`Codex native agent id: ${launcher.native_id}\\.`),
    );
  }

  assert.equal(
    [...outputs].filter(([name]) =>
      name.startsWith("plugins/grove/reference/charters/"),
    ).length,
    14,
  );
  assert.deepEqual(
    COMPANION_PROJECTIONS.map(({ output }) => output),
    [
      "plugins/grove/reference/lifecycle.md",
      "plugins/grove/reference/relations.md",
      "plugins/grove/reference/versioning.md",
    ],
  );
  assert.equal(
    [...outputs].filter(([name]) =>
      name.startsWith("plugins/grove/adapters/codex/skills/role-"),
    ).length,
    14,
  );
  assert.equal(
    [...outputs].filter(([name]) =>
      name.startsWith("plugins/grove/adapters/claude/agents/"),
    ).length,
    13,
  );

  for (const [name, content] of outputs) {
    assert.match(content, /GENERATED/);
    assert.match(
      content,
      /charters\/|plugins\/grove\/runtime\/lifecycle\/lib\/lifecycle\.mjs|tooling\/grove\/build\/config\.mjs/,
    );
    if (name.endsWith(".toml")) {
      assert.fail(`plugin projection unexpectedly contains custom-agent TOML: ${name}`);
    }
  }
});

test("runtime references strip artifact front matter and preserve canonical prose", async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPO_ROOT });
  const inventory = JSON.parse(
    await readFile(path.join(REPO_ROOT, INVENTORY_PATH), "utf8"),
  );
  const projections = [
    ...inventory.roles.map((role) => ({
      source: role.source,
      output: role.outputs.reference,
      fragment: role.exposures.find((item) => item.source_fragment)
        ?.source_fragment,
    })),
    ...COMPANION_PROJECTIONS,
  ];
  for (const projection of projections) {
    const canonical = await readFile(
      path.join(REPO_ROOT, projection.source),
      "utf8",
    );
    let expected = withoutArtifactFrontmatter(canonical);
    if (projection.fragment === "scoped-agent-boundary") {
      const needle =
        "> **The `grove:dispatcher` plugin agent (`plugins/grove/adapters/claude/agents/dispatcher.md`)";
      expected = expected.replace(
        needle,
        `<a id="${projection.fragment}"></a>\n\n${needle}`,
      );
    }
    const generated = outputs.get(projection.output);
    assert.equal(withoutGeneratedHeader(generated), expected, projection.output);
    assert.doesNotMatch(
      withoutGeneratedHeader(generated).slice(0, 300),
      /\n?(?:id|type|status|depends_on|implements|owner|updated):/,
      projection.output,
    );
  }
});

test("spec-0005 AC7/S24 — structured canary contracts propagate from all six authored sources", async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPO_ROOT });
  const result = await checkProjectionSet({ repoRoot: REPO_ROOT, outputs });
  assert.deepEqual(result, {
    ok: true,
    stale: [],
    missing: [],
    unexpected: [],
  });

  const expectedContracts = new Map([
    ["plugins/grove/reference/charters/executor.md", /sole ordinary writer/],
    ["plugins/grove/reference/charters/conformance-reviewer.md", /canonical\/exact/],
    ["plugins/grove/reference/charters/dispatcher.md", /Ledger\s+presence never decides/],
    ["plugins/grove/reference/charters/validator.md", /canary as unobservable/],
    ["plugins/grove/reference/relations.md", /advisory provenance, not artifact edges/],
    ["plugins/grove/reference/versioning.md", /manifest-only candidate\s+pin/],
  ]);
  for (const [output, pattern] of expectedContracts) {
    assert.match(outputs.get(output), pattern, output);
  }
});

test("artifact-only metadata changes the source digest but not runtime prose", async () =>
  withFixture(async (root) => {
    const before = await buildProjectionSet({ repoRoot: root });
    const source = path.join(root, "charters", "executor.md");
    const canonical = await readFile(source, "utf8");
    await writeFile(
      source,
      canonical.replace(/^updated: .+$/m, "updated: 2099-01-01"),
    );
    const after = await buildProjectionSet({ repoRoot: root });
    const reference = "plugins/grove/reference/charters/executor.md";

    assert.notEqual(before.get(reference), after.get(reference));
    assert.equal(
      withoutGeneratedHeader(before.get(reference)),
      withoutGeneratedHeader(after.get(reference)),
    );
    assert.notEqual(
      before.get("plugins/grove/adapters/claude/agents/executor.md"),
      after.get("plugins/grove/adapters/claude/agents/executor.md"),
    );
    assert.notEqual(
      before.get("plugins/grove/adapters/codex/skills/role-executor/SKILL.md"),
      after.get("plugins/grove/adapters/codex/skills/role-executor/SKILL.md"),
    );
  }));

test("runtime reference generation fails closed on malformed artifact front matter", async () =>
  withFixture(async (root) => {
    const source = path.join(root, "charters", "executor.md");
    const canonical = await readFile(source, "utf8");
    await writeFile(source, canonical.replace(/^---\n/, ""));
    await assert.rejects(
      buildProjectionSet({ repoRoot: root }),
      /must begin with artifact front matter/i,
    );
  }));

test("lifecycle skill entrypoints are thin generated read-through projections", async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPO_ROOT });
  for (const operation of ["setup", "refresh", "set-profile", "remove"]) {
    const output = `plugins/grove/adapters/codex/skills/${operation}/SKILL.md`;
    const content = outputs.get(output);
    assert.equal(typeof content, "string", `missing ${output}`);
    assert.match(content, /GENERATED — DO NOT EDIT/);
    assert.match(content, /plugins\/grove\/runtime\/lifecycle\/lib\/lifecycle\.mjs/);
    assert.match(
      content,
      new RegExp(`grove-operation\\.mjs describe ${operation}`),
    );
    assert.doesNotMatch(content, /planSetup|planRefresh|PRESETS|surface matrix/);
  }
});

test("dispatcher Codex skill selects full driving or scoped native exposure from launcher instruction", async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPO_ROOT });
  const skill = outputs.get(
    "plugins/grove/adapters/codex/skills/role-dispatcher/SKILL.md",
  );
  assert.match(skill, /driving-session/);
  assert.match(skill, /scoped-advisor/);
  assert.match(
    skill,
    /\.\.\/\.\.\/\.\.\/\.\.\/reference\/charters\/dispatcher\.md\)/,
  );
  assert.match(
    skill,
    /\.\.\/\.\.\/\.\.\/\.\.\/reference\/charters\/dispatcher\.md#scoped-agent-boundary/,
  );
  assert.match(skill, /Grove exposure selector: scoped-advisor/);

  const bundle = JSON.parse(
    outputs.get("plugins/grove/metadata/codex-launchers.json"),
  );
  const dispatcher = bundle.launchers.find(
    (launcher) => launcher.native_id === "grove_dispatcher",
  );
  assert.equal(dispatcher.exposure, "scoped-advisor");
  assert.match(
    dispatcher.content,
    /Grove exposure selector: scoped-advisor/,
  );
  assert.match(
    dispatcher.content,
    /Canonical Grove role id: dispatcher\./,
  );
  assert.match(
    dispatcher.content,
    /Codex native agent id: grove_dispatcher\./,
  );
});

test("operation-core changes update all lifecycle wrappers and no role adapter", async () =>
  withFixture(async (root) => {
    const before = await buildProjectionSet({ repoRoot: root });
    const source = path.join(root, LIFECYCLE_SOURCE);
    await writeFile(
      source,
      `${await readFile(source, "utf8")}\n// fixture-only operation change\n`,
    );
    const after = await buildProjectionSet({ repoRoot: root });

    for (const operation of ["setup", "refresh", "set-profile", "remove"]) {
      const output = `plugins/grove/adapters/codex/skills/${operation}/SKILL.md`;
      assert.notEqual(before.get(output), after.get(output));
    }
    assert.equal(
      before.get("plugins/grove/adapters/claude/agents/executor.md"),
      after.get("plugins/grove/adapters/claude/agents/executor.md"),
    );
    assert.equal(
      before.get("plugins/grove/adapters/codex/skills/role-executor/SKILL.md"),
      after.get("plugins/grove/adapters/codex/skills/role-executor/SKILL.md"),
    );
  }));

test("S1: changing one canonical charter changes both host adapters and no unrelated role", async () =>
  withFixture(async (root) => {
    const before = await buildProjectionSet({ repoRoot: root });
    const source = path.join(root, "charters", "executor.md");
    await writeFile(
      source,
      `${await readFile(source, "utf8")}\nFixture-only canonical change.\n`,
    );
    const after = await buildProjectionSet({ repoRoot: root });

    assert.notEqual(
      before.get("plugins/grove/adapters/claude/agents/executor.md"),
      after.get("plugins/grove/adapters/claude/agents/executor.md"),
    );
    assert.notEqual(
      before.get("plugins/grove/adapters/codex/skills/role-executor/SKILL.md"),
      after.get("plugins/grove/adapters/codex/skills/role-executor/SKILL.md"),
    );
    assert.notEqual(
      before.get("plugins/grove/reference/charters/executor.md"),
      after.get("plugins/grove/reference/charters/executor.md"),
    );
    assert.equal(
      before.get("plugins/grove/adapters/claude/agents/validator.md"),
      after.get("plugins/grove/adapters/claude/agents/validator.md"),
    );
    assert.equal(
      before.get("plugins/grove/adapters/codex/skills/role-validator/SKILL.md"),
      after.get("plugins/grove/adapters/codex/skills/role-validator/SKILL.md"),
    );
  }));

test("S2: check mode lists stale, missing, and unexpected files without writing", async () =>
  withFixture(async (root) => {
    const expected = await buildProjectionSet({ repoRoot: root });
    await writeProjectionSet({ repoRoot: root, outputs: expected });

    const stale = "plugins/grove/adapters/claude/agents/executor.md";
    const missing = "plugins/grove/adapters/codex/skills/role-validator/SKILL.md";
    const unexpected = "plugins/grove/adapters/claude/agents/unexpected.md";
    await writeFile(path.join(root, stale), "hand edit\n");
    await rm(path.join(root, missing));
    await writeFile(path.join(root, unexpected), "surprise\n");

    const staleBefore = await readFile(path.join(root, stale), "utf8");
    const result = await checkProjectionSet({ repoRoot: root, outputs: expected });

    assert.deepEqual(result, {
      ok: false,
      stale: [stale],
      missing: [missing],
      unexpected: [unexpected],
    });
    assert.equal(await readFile(path.join(root, stale), "utf8"), staleBefore);
  }));

test("S2: either host edit and orphaned generated role skill are rejected", async () =>
  withFixture(async (root) => {
    const expected = await buildProjectionSet({ repoRoot: root });
    await writeProjectionSet({ repoRoot: root, outputs: expected });

    const stale = "plugins/grove/adapters/codex/skills/role-executor/SKILL.md";
    const unexpected = "plugins/grove/adapters/codex/skills/role-retired/SKILL.md";
    await writeFile(path.join(root, stale), "hand edit\n");
    await mkdir(path.dirname(path.join(root, unexpected)), { recursive: true });
    await writeFile(
      path.join(root, unexpected),
      "<!-- GENERATED — DO NOT EDIT; canonical-source: charters/retired.md -->\n",
    );

    const result = await checkProjectionSet({ repoRoot: root, outputs: expected });
    assert.deepEqual(result.stale, [stale]);
    assert.deepEqual(result.unexpected, [unexpected]);
  }));

test("invalid inventory fails closed on instruction fields, ids, sources, and output roots", async () =>
  withFixture(async (root) => {
    const inventoryPath = path.join(root, INVENTORY_PATH);
    const original = JSON.parse(await readFile(inventoryPath, "utf8"));
    const cases = [
      {
        name: "authored instruction field",
        mutate: (value) => {
          value.roles[0].instructions = "copied prose";
        },
        pattern: /instruction field/i,
      },
      {
        name: "duplicate role",
        mutate: (value) => {
          value.roles[1].id = value.roles[0].id;
        },
        pattern: /duplicate role id/i,
      },
      {
        name: "hyphenated native id",
        mutate: (value) => {
          value.roles.find((role) => role.id === "executor").exposures[0].native_id =
            "grove-executor";
        },
        pattern: /native id/i,
      },
      {
        name: "wrong canonical source",
        mutate: (value) => {
          value.roles[0].source = "charters/absent.md";
        },
        pattern: /source must be/i,
      },
      {
        name: "outside generated root",
        mutate: (value) => {
          value.roles[0].outputs.claude_agent = "README.md";
        },
        pattern: /outside declared generated roots/i,
      },
    ];

    for (const item of cases) {
      const value = structuredClone(original);
      item.mutate(value);
      await writeFile(inventoryPath, `${JSON.stringify(value, null, 2)}\n`);
      await assert.rejects(
        buildProjectionSet({ repoRoot: root }),
        item.pattern,
        item.name,
      );
    }

    await writeFile(inventoryPath, `${JSON.stringify(original, null, 2)}\n`);
    await rm(path.join(root, original.roles[0].source));
    await assert.rejects(
      buildProjectionSet({ repoRoot: root }),
      /missing charter source/i,
      "missing source",
    );
  }));

test("configured roots are explicit and do not include plugin custom-agent TOML", () => {
  assert.deepEqual(GENERATED_ROOTS.slice(0, 4), [
    "plugins/grove/adapters/claude/agents",
    "plugins/grove/adapters/claude/skills",
    "plugins/grove/adapters/codex/skills",
    "plugins/grove/reference/charters",
  ]);
  assert.equal(GENERATED_ROOTS.some((root) => root === ".codex/agents"), false);
  assert.deepEqual(GENERATED_FILES, [
    "plugins/grove/reference/lifecycle.md",
    "plugins/grove/reference/relations.md",
    "plugins/grove/reference/versioning.md",
  ]);
});

// --- spec-0006 (voluntary dispatch): floor extract + entry skills ---
// Upstream: spec-0006-voluntary-dispatch@v2 INV1, INV22, INV23, INV26
// (shipping clauses); AC3 mechanical half, AC9, AC11 mechanical half;
// S12–S14 mechanical halves. Decision: adr-0046.
// Behavioral, untested here per the spec's labels: AC3's core (enter writes
// nothing in session conduct) and the Codex session actually STATING the
// disclosure line (S14's conduct half).

const FLOOR_BEGIN = "<!-- grove:floors:begin -->";
const FLOOR_END = "<!-- grove:floors:end -->";

function floorSpanOf(charter) {
  const start = charter.indexOf(FLOOR_BEGIN);
  const end = charter.indexOf(FLOOR_END);
  assert.ok(start !== -1 && end !== -1, "fixture charter carries the floor span");
  return charter.slice(start + FLOOR_BEGIN.length, end).replace(/^\n/, "").replace(/\n$/, "\n");
}

function skillParts(content) {
  const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
  assert.ok(frontmatterMatch, "entry skill has frontmatter");
  const rest = content.slice(frontmatterMatch[0].length);
  const headerEnd = rest.indexOf("\n");
  return {
    frontmatter: frontmatterMatch[0],
    header: rest.slice(0, headerEnd),
    body: rest.slice(headerEnd + 1),
  };
}

test("INV1 — both hosts ship enter and start, model-invocable, config-declared descriptions", async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPO_ROOT });
  assert.equal(ENTRY_SKILLS.length, 4);
  for (const metadata of ENTRY_SKILLS) {
    const content = outputs.get(metadata.output);
    assert.equal(typeof content, "string", `missing ${metadata.output}`);
    const { frontmatter } = skillParts(content);
    assert.match(frontmatter, new RegExp(`^name: ${metadata.verb}$`, "m"));
    assert.ok(
      frontmatter.includes(`description: ${JSON.stringify(metadata.description)}`),
      `${metadata.output} carries the config-declared description`,
    );
    assert.doesNotMatch(frontmatter, /disable-model-invocation/);
    assert.match(content, /GENERATED — DO NOT EDIT/);
  }
  const start = ENTRY_SKILLS.find((item) => item.verb === "start");
  assert.match(start.description, /committed run/);
});

test("INV22/INV23 — the floor extract is the marker span verbatim and the FIRST body content, both hosts both verbs", async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPO_ROOT });
  const charter = await readFile(path.join(REPO_ROOT, "charters", "dispatcher.md"), "utf8");
  const span = floorSpanOf(charter);
  assert.ok(span.length <= 2500, "shipped span inside the 2,500 budget");
  for (const slug of FLOOR_SLUGS) assert.match(span, new RegExp(`\`${slug}\``));

  for (const metadata of ENTRY_SKILLS) {
    const { body } = skillParts(outputs.get(metadata.output));
    const trimmed = body.replace(/^\n+/, "");
    assert.ok(
      trimmed.startsWith(span.trimEnd()),
      `${metadata.output}: floor extract is the first body content`,
    );
    assert.equal(trimmed.includes(FLOOR_BEGIN), false, "markers excluded");
  }
});

test("INV26 — Codex entry skills carry the EXACT disclosure line; Claude do not; both carry the pointers and the per-handover guard duty", async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPO_ROOT });
  for (const metadata of ENTRY_SKILLS) {
    const content = outputs.get(metadata.output);
    if (metadata.host === "codex") {
      assert.ok(
        content.includes(CODEX_ENTRY_DISCLOSURE),
        `${metadata.output} carries the exact disclosure line byte-for-byte`,
      );
    } else {
      assert.equal(
        content.includes(CODEX_ENTRY_DISCLOSURE),
        false,
        `${metadata.output} must not carry the Codex disclosure`,
      );
    }
    // Pointers: full dispatcher projection, transitions.toml, guard CLI,
    // cursor contract — host-correct forms.
    assert.match(content, /reference\/charters\/dispatcher\.md/);
    assert.match(content, /reference\/dispatch\/transitions\.toml/);
    assert.match(content, /runtime\/dispatch\/bin\/guard\.mjs/);
    assert.match(content, /cursor\.toml/);
    if (metadata.host === "claude") {
      assert.match(content, /\$\{CLAUDE_PLUGIN_ROOT\}\/reference\/dispatch\/transitions\.toml/);
    } else {
      assert.match(content, /\.\.\/\.\.\/\.\.\/\.\.\/reference\/dispatch\/transitions\.toml/);
    }
    // INV17 carrier: the per-handover guard duty is stated in the body.
    assert.match(content, /every handover/i);
  }
});

test("S12 — editing the floor span changes all four entry skills; unrelated projections stay byte-identical", async () =>
  withFixture(async (root) => {
    const before = await buildProjectionSet({ repoRoot: root });
    const charterPath = path.join(root, "charters", "dispatcher.md");
    const charter = await readFile(charterPath, "utf8");
    await writeFile(
      charterPath,
      charter.replace(
        "never silent. `floor-recorded-skips`",
        "never silent, fixture-edited. `floor-recorded-skips`",
      ),
    );
    const after = await buildProjectionSet({ repoRoot: root });
    for (const metadata of ENTRY_SKILLS) {
      assert.notEqual(before.get(metadata.output), after.get(metadata.output), metadata.output);
    }
    assert.equal(
      before.get("plugins/grove/adapters/claude/agents/executor.md"),
      after.get("plugins/grove/adapters/claude/agents/executor.md"),
      "unrelated projection unchanged",
    );
    assert.equal(
      before.get("plugins/grove/adapters/codex/skills/role-executor/SKILL.md"),
      after.get("plugins/grove/adapters/codex/skills/role-executor/SKILL.md"),
    );
  }));

test("S12/INV23 — a direct edit to a generated entry skill fails check mode; two builds are byte-identical", async () =>
  withFixture(async (root) => {
    const first = await buildProjectionSet({ repoRoot: root });
    const second = await buildProjectionSet({ repoRoot: root });
    for (const [name, content] of first) {
      assert.equal(content, second.get(name), `determinism: ${name}`);
    }
    await writeProjectionSet({ repoRoot: root, outputs: first });
    const target = "plugins/grove/adapters/claude/skills/enter/SKILL.md";
    await writeFile(
      path.join(root, target),
      `${first.get(target)}\nhand edit\n`,
    );
    const result = await checkProjectionSet({ repoRoot: root, outputs: first });
    assert.equal(result.ok, false);
    assert.ok(result.stale.includes(target));
  }));

test("S13/INV22 — marker, slug, and budget violations fail generation naming the violation", async () =>
  withFixture(async (root) => {
    const charterPath = path.join(root, "charters", "dispatcher.md");
    const original = await readFile(charterPath, "utf8");
    const span = floorSpanOf(original);
    const cases = [
      {
        name: "zero marker pairs",
        mutate: (text) => text.replace(FLOOR_BEGIN, "").replace(FLOOR_END, ""),
        pattern: /marker|floors/i,
      },
      {
        name: "two marker pairs",
        mutate: (text) =>
          `${text}\n${FLOOR_BEGIN}\n- duplicate span. \`floor-owed-reviews\`\n${FLOOR_END}\n`,
        pattern: /marker|floors/i,
      },
      {
        name: "missing slug",
        mutate: (text) => text.replace(
          /^- .*`floor-recorded-skips`$\n/m,
          "",
        ),
        pattern: /floor-recorded-skips|slug/i,
      },
      {
        name: "extra slug",
        mutate: (text) => text.replace(
          FLOOR_END,
          "- an eleventh floor. `floor-novel-extra`\n" + FLOOR_END,
        ),
        pattern: /floor-novel-extra|slug/i,
      },
      {
        name: "duplicate slug",
        mutate: (text) => text.replace(
          FLOOR_END,
          "- said twice. `floor-recorded-skips`\n" + FLOOR_END,
        ),
        pattern: /duplicate|floor-recorded-skips/i,
      },
      {
        name: "item not ending in backticked slug",
        mutate: (text) => text.replace(
          "never silent. `floor-recorded-skips`",
          "never silent. floor-recorded-skips (unticked)",
        ),
        pattern: /backtick|slug|list item/i,
      },
      {
        name: "span over 2,500 characters",
        mutate: (text) => text.replace(
          "never silent. `floor-recorded-skips`",
          `never silent${" and loud".repeat(400)}. \`floor-recorded-skips\``,
        ),
        pattern: /2,?500|budget|extract/i,
      },
    ];
    for (const item of cases) {
      await writeFile(charterPath, item.mutate(original));
      await assert.rejects(
        buildProjectionSet({ repoRoot: root }),
        item.pattern,
        item.name,
      );
    }
    await writeFile(charterPath, original);
    assert.ok(span.length > 0);

    // S13's second budget: an assembled entry-skill body over 12,000.
    const behaviorPath = path.join(root, ENTRY_BEHAVIOR_SOURCE);
    const behavior = await readFile(behaviorPath, "utf8");
    await writeFile(behaviorPath, `${behavior}\n${"filler prose line\n".repeat(800)}`);
    await assert.rejects(
      buildProjectionSet({ repoRoot: root }),
      /12,?000|body|budget/i,
      "body budget breach",
    );
  }));

test("entry skills join the host inventories as entry-class components", async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPO_ROOT });
  const claude = JSON.parse(outputs.get("plugins/grove/metadata/claude-inventory.json"));
  const codex = JSON.parse(outputs.get("plugins/grove/metadata/codex-inventory.json"));
  for (const inventory of [claude, codex]) {
    for (const verb of ["enter", "start"]) {
      const row = inventory.components.find((item) => item.raw_id === `grove:${verb}`);
      assert.ok(row, `${inventory.host} grove:${verb} row`);
      assert.equal(row.class, "entry");
      assert.match(row.canonical_digest, /^[0-9a-f]{64}$/);
    }
  }
});
