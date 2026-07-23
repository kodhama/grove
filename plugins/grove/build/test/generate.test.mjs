// Upstream: spec-0004-dual-host-distribution@v3 INV1, INV2, INV5-INV7,
// INV17, INV20; S1, S2, S15, S18.
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
import { GENERATED_ROOTS, INVENTORY_PATH } from "../config.mjs";

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
  await mkdir(path.join(root, "plugins", "grove", "operations", "lib"), {
    recursive: true,
  });
  await cp(
    path.join(
      REPO_ROOT,
      "plugins",
      "grove",
      "operations",
      "lib",
      "lifecycle.mjs",
    ),
    path.join(
      root,
      "plugins",
      "grove",
      "operations",
      "lib",
      "lifecycle.mjs",
    ),
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

test("inventory is metadata-only, complete, and models the driving/scoped boundary", async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPO_ROOT });
  const inventory = JSON.parse(
    await readFile(path.join(REPO_ROOT, INVENTORY_PATH), "utf8"),
  );

  assert.equal(inventory.roles.length, 13);
  assert.equal(new Set(inventory.roles.map((role) => role.id)).size, 13);
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
  assert.equal(outputs.has("plugins/grove/agents/shaper.md"), false);

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
    "plugins/grove/agents/dispatcher.md",
  );
  assert.match(dispatcherEnvelope, /scoped-agent-boundary/);
  assert.doesNotMatch(dispatcherEnvelope, /sequence every other agent/);
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

  assert.equal(native.length, 12);
  assert.equal(new Set(native).size, native.length);
  for (const id of native) {
    assert.match(id, /^[a-z0-9_]+$/);
    assert.doesNotMatch(id, /-/);
  }

  assert.equal(
    [...outputs].filter(([name]) =>
      name.startsWith("plugins/grove/reference/charters/"),
    ).length,
    16,
  );
  assert.equal(
    [...outputs].filter(([name]) =>
      name.startsWith("plugins/grove/skills/role-"),
    ).length,
    13,
  );
  assert.equal(
    [...outputs].filter(([name]) =>
      name.startsWith("plugins/grove/agents/"),
    ).length,
    12,
  );

  for (const [name, content] of outputs) {
    assert.match(content, /GENERATED/);
    assert.match(
      content,
      /charters\/|plugins\/grove\/operations\/lib\/lifecycle\.mjs/,
    );
    if (name.endsWith(".toml")) {
      assert.fail(`plugin projection unexpectedly contains custom-agent TOML: ${name}`);
    }
  }
});

test("lifecycle skill entrypoints are thin generated read-through projections", async () => {
  const outputs = await buildProjectionSet({ repoRoot: REPO_ROOT });
  for (const operation of ["setup", "refresh", "set-profile", "remove"]) {
    const output = `plugins/grove/skills/${operation}/SKILL.md`;
    const content = outputs.get(output);
    assert.equal(typeof content, "string", `missing ${output}`);
    assert.match(content, /GENERATED — DO NOT EDIT/);
    assert.match(content, /plugins\/grove\/operations\/lib\/lifecycle\.mjs/);
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
    "plugins/grove/skills/role-dispatcher/SKILL.md",
  );
  assert.match(skill, /driving-session/);
  assert.match(skill, /scoped-advisor/);
  assert.match(
    skill,
    /\.\.\/\.\.\/reference\/charters\/dispatcher\.md\)/,
  );
  assert.match(
    skill,
    /\.\.\/\.\.\/reference\/charters\/dispatcher\.md#scoped-agent-boundary/,
  );
  assert.match(skill, /Grove exposure selector: scoped-advisor/);

  const bundle = JSON.parse(
    outputs.get("plugins/grove/build/generated/codex-launchers.json"),
  );
  const dispatcher = bundle.launchers.find(
    (launcher) => launcher.native_id === "grove_dispatcher",
  );
  assert.equal(dispatcher.exposure, "scoped-advisor");
  assert.match(
    dispatcher.content,
    /Grove exposure selector: scoped-advisor/,
  );
});

test("operation-core changes update all lifecycle wrappers and no role adapter", async () =>
  withFixture(async (root) => {
    const before = await buildProjectionSet({ repoRoot: root });
    const source = path.join(
      root,
      "plugins",
      "grove",
      "operations",
      "lib",
      "lifecycle.mjs",
    );
    await writeFile(
      source,
      `${await readFile(source, "utf8")}\n// fixture-only operation change\n`,
    );
    const after = await buildProjectionSet({ repoRoot: root });

    for (const operation of ["setup", "refresh", "set-profile", "remove"]) {
      const output = `plugins/grove/skills/${operation}/SKILL.md`;
      assert.notEqual(before.get(output), after.get(output));
    }
    assert.equal(
      before.get("plugins/grove/agents/executor.md"),
      after.get("plugins/grove/agents/executor.md"),
    );
    assert.equal(
      before.get("plugins/grove/skills/role-executor/SKILL.md"),
      after.get("plugins/grove/skills/role-executor/SKILL.md"),
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
      before.get("plugins/grove/agents/executor.md"),
      after.get("plugins/grove/agents/executor.md"),
    );
    assert.notEqual(
      before.get("plugins/grove/skills/role-executor/SKILL.md"),
      after.get("plugins/grove/skills/role-executor/SKILL.md"),
    );
    assert.notEqual(
      before.get("plugins/grove/reference/charters/executor.md"),
      after.get("plugins/grove/reference/charters/executor.md"),
    );
    assert.equal(
      before.get("plugins/grove/agents/validator.md"),
      after.get("plugins/grove/agents/validator.md"),
    );
    assert.equal(
      before.get("plugins/grove/skills/role-validator/SKILL.md"),
      after.get("plugins/grove/skills/role-validator/SKILL.md"),
    );
  }));

test("S2: check mode lists stale, missing, and unexpected files without writing", async () =>
  withFixture(async (root) => {
    const expected = await buildProjectionSet({ repoRoot: root });
    await writeProjectionSet({ repoRoot: root, outputs: expected });

    const stale = "plugins/grove/agents/executor.md";
    const missing = "plugins/grove/skills/role-validator/SKILL.md";
    const unexpected = "plugins/grove/agents/unexpected.md";
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

    const stale = "plugins/grove/skills/role-executor/SKILL.md";
    const unexpected = "plugins/grove/skills/role-retired/SKILL.md";
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
  assert.deepEqual(GENERATED_ROOTS.slice(0, 3), [
    "plugins/grove/agents",
    "plugins/grove/reference/charters",
    "plugins/grove/build/generated",
  ]);
  assert.equal(
    GENERATED_ROOTS.filter((root) =>
      root.startsWith("plugins/grove/skills/role-"),
    ).length,
    13,
  );
  for (const operation of ["setup", "refresh", "set-profile", "remove"]) {
    assert.equal(
      GENERATED_ROOTS.includes(`plugins/grove/skills/${operation}`),
      true,
    );
  }
  assert.equal(GENERATED_ROOTS.some((root) => root === ".codex/agents"), false);
});
