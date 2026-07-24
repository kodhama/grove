import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  applyTransformedWrites,
  checkTexts,
  composeTexts,
  stripTexts,
} from "../instruction-entrypoints.mjs";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(TEST_DIR, "..", "instruction-entrypoints.mjs");
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..", "..");
const VERSION = "0.3.0";

function block(version = VERSION) {
  return composeTexts({
    agentsText: "",
    claudeText: "",
    version,
  }).agentsText;
}

async function fixture(files = {}) {
  const root = await mkdtemp(join(tmpdir(), "grove-entrypoints-"));
  await Promise.all(
    Object.entries(files).map(([name, content]) =>
      writeFile(join(root, name), content, "utf8"),
    ),
  );
  return root;
}

async function optional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function run(command, root) {
  return spawnSync(
    process.execPath,
    [SCRIPT, command, "--project-root", root],
    { encoding: "utf8" },
  );
}

test("compose creates canonical entrypoints and is idempotent", async () => {
  const root = await fixture();
  const first = run("compose", root);
  assert.equal(first.status, 0, first.stderr);
  const agents = await optional(join(root, "AGENTS.md"));
  const claude = await optional(join(root, "CLAUDE.md"));
  assert.match(agents, /Shared project instructions live in unmarked prose/);
  assert.equal(claude, "@AGENTS.md\n");
  assert.doesNotThrow(() =>
    checkTexts({ agentsText: agents, claudeText: claude, version: VERSION }),
  );

  const second = run("compose", root);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(JSON.parse(second.stdout).changed, false);
  assert.equal(await optional(join(root, "AGENTS.md")), agents);
  assert.equal(await optional(join(root, "CLAUDE.md")), claude);
});

test("compose preserves project and Claude-only prose", () => {
  const result = composeTexts({
    agentsText: "# Shared\n\nKeep this.\n",
    claudeText: "# Claude only\n\nKeep this too.\n",
    version: VERSION,
  });
  assert.match(result.agentsText, /^# Shared\n\nKeep this\./);
  assert.match(result.agentsText, /grove plugin@0\.3\.0/);
  assert.equal(
    result.claudeText,
    "@AGENTS.md\n\n# Claude only\n\nKeep this too.\n",
  );
});

test("compose migrates a legacy Claude block without moving custom prose", () => {
  const legacy = `# Claude only\n\n${block()}`;
  const result = composeTexts({
    agentsText: "# Shared\n",
    claudeText: legacy,
    version: VERSION,
  });
  assert.match(result.agentsText, /^# Shared\n/);
  assert.match(result.agentsText, /grove plugin@0\.3\.0/);
  assert.match(result.claudeText, /^@AGENTS\.md\n\n# Claude only\n\n$/);
  assert.doesNotMatch(result.claudeText, /grove:begin/);
  assert.equal(result.migratedFrom, "CLAUDE.md");
});

test("compose collapses byte-identical files", () => {
  const duplicated = `# Shared\n\n${block()}`;
  const result = composeTexts({
    agentsText: duplicated,
    claudeText: duplicated,
    version: VERSION,
  });
  assert.equal(result.agentsText, duplicated);
  assert.equal(result.claudeText, "@AGENTS.md\n");
  assert.equal(result.migratedFrom, "byte-identical-copy");
});

test("compose refuses two non-identical Grove-bearing files without writes", async () => {
  const agents = `# Shared\n\n${block()}`;
  const claude = `# Different\n\n${block()}`;
  const root = await fixture({ "AGENTS.md": agents, "CLAUDE.md": claude });
  const result = run("compose", root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /non-identical/);
  assert.equal(await optional(join(root, "AGENTS.md")), agents);
  assert.equal(await optional(join(root, "CLAUDE.md")), claude);
});

test("compose refuses malformed markers without writes", async () => {
  const agents = "<!-- grove:begin -->\n";
  const root = await fixture({ "AGENTS.md": agents });
  const result = run("compose", root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unmatched or repeated/);
  assert.equal(await optional(join(root, "AGENTS.md")), agents);
  assert.equal(await optional(join(root, "CLAUDE.md")), "");
});

test("compose refuses an AGENTS to CLAUDE cycle", () => {
  assert.throws(
    () =>
      composeTexts({
        agentsText: "@CLAUDE.md\n",
        claudeText: "",
        version: VERSION,
      }),
    /instruction cycle/,
  );
});

test("fenced examples are not active markers or imports", () => {
  const agents = "```md\n<!-- grove:begin -->\n<!-- grove:end -->\n```\n";
  const claude = "~~~md\n@AGENTS.md\n~~~\n";
  const result = composeTexts({
    agentsText: agents,
    claudeText: claude,
    version: VERSION,
  });
  assert.match(result.agentsText, /^```md/);
  assert.match(result.agentsText, /grove plugin@0\.3\.0/);
  assert.match(result.claudeText, /^@AGENTS\.md\n\n~~~md/);
});

test("list-nested and blockquoted fenced examples are not active", () => {
  const agents = [
    "- ```md",
    "  <!-- grove:begin -->",
    "  <!-- grove:end -->",
    "  ```",
    "",
    "> ~~~md",
    "> @CLAUDE.md",
    "> ~~~",
    "",
  ].join("\n");
  const claude = [
    "> ```md",
    "> @AGENTS.md",
    "> ```",
    "",
  ].join("\n");
  const result = composeTexts({
    agentsText: agents,
    claudeText: claude,
    version: VERSION,
  });
  assert.match(result.agentsText, /^- ```md/);
  assert.match(result.agentsText, /> @CLAUDE\.md/);
  assert.match(result.agentsText, /grove plugin@0\.3\.0/);
  assert.match(result.claudeText, /^@AGENTS\.md\n\n> ```md/);
});

test("a list-looking fence line inside a root fence is ordinary content", () => {
  const sentinel = "keep this fenced sentinel";
  const agents = [
    "```md",
    "- ```",
    "<!-- grove:begin -->",
    sentinel,
    "<!-- grove:end -->",
    "```",
    "",
  ].join("\n");
  const result = composeTexts({
    agentsText: agents,
    claudeText: "",
    version: VERSION,
  });
  assert.match(result.agentsText, new RegExp(sentinel));
  assert.match(result.agentsText, /^```md\n- ```/);
  assert.match(result.agentsText, /grove plugin@0\.3\.0/);
});

test("a list fence does not close at four relative spaces", () => {
  const sentinel = "keep this list-fenced sentinel";
  const agents = [
    "- ```md",
    "      ```",
    "  <!-- grove:begin sample -->",
    `  ${sentinel}`,
    "  <!-- grove:end -->",
    "  ```",
    "",
  ].join("\n");
  const result = composeTexts({
    agentsText: agents,
    claudeText: "",
    version: VERSION,
  });
  assert.match(result.agentsText, new RegExp(sentinel));
  assert.match(result.agentsText, /grove plugin@0\.3\.0/);
});

test("leaving a fence container makes following imports active", () => {
  for (const agentsText of [
    "> ```md\n@CLAUDE.md\n> ```\n",
    "- ```md\n@CLAUDE.md\n  ```\n",
  ]) {
    assert.throws(
      () =>
        composeTexts({
          agentsText,
          claudeText: "",
          version: VERSION,
        }),
      /instruction cycle/,
    );
  }
});

test("a backtick in a backtick fence info string does not open a fence", () => {
  assert.throws(
    () =>
      composeTexts({
        agentsText: "```bad`info\n@CLAUDE.md\n```\n",
        claudeText: "",
        version: VERSION,
      }),
    /instruction cycle/,
  );
});

test("tab-expanded list indentation recognizes a valid closer", () => {
  const sentinel = "keep one canonical block";
  const agentsText = [
    "-\t```md",
    "      ```",
    `    ${sentinel}`,
    "      ```",
    block(),
  ].join("\n");
  const result = composeTexts({
    agentsText,
    claudeText: "",
    version: VERSION,
  });
  assert.match(result.agentsText, new RegExp(sentinel));
  assert.equal(
    result.agentsText.match(/<!-- grove:begin/g)?.length,
    1,
  );
});

test("an unindented blank line does not end a list fence", () => {
  for (const blank of ["", "   "]) {
    const agentsText = [
      "- ```md",
      "  example",
      blank,
      "  @CLAUDE.md",
      "  ```",
      "",
    ].join("\n");
    assert.doesNotThrow(() =>
      composeTexts({
        agentsText,
        claudeText: "",
        version: VERSION,
      }),
    );
  }
});

test("a tab can cross a list container boundary", () => {
  const sentinel = "keep tab-crossed fenced sentinel";
  const agentsText = [
    "- ```md",
    "\tordinary fenced line",
    "  <!-- grove:begin sample -->",
    `  ${sentinel}`,
    "  <!-- grove:end -->",
    "  ```",
    "",
  ].join("\n");
  const result = composeTexts({
    agentsText,
    claudeText: "",
    version: VERSION,
  });
  assert.match(result.agentsText, new RegExp(sentinel));
  assert.match(result.agentsText, /grove plugin@0\.3\.0/);
});

test("nested list tab stops use the actual container column", () => {
  const sentinel = "keep nested-tab fenced sentinel";
  const agentsText = [
    "- -\t```md",
    "        ```",
    "    <!-- grove:begin sample -->",
    `    ${sentinel}`,
    "    <!-- grove:end -->",
    "    ```",
    "",
  ].join("\n");
  const result = composeTexts({
    agentsText,
    claudeText: "",
    version: VERSION,
  });
  assert.match(result.agentsText, new RegExp(sentinel));
  assert.match(result.agentsText, /grove plugin@0\.3\.0/);
});

test("a tab may indent a closing fence by up to three relative columns", () => {
  const agentsText = [
    "- ```md",
    "  \t```",
    "  prose after the fence",
    block(),
  ].join("\n");
  const result = composeTexts({
    agentsText,
    claudeText: "",
    version: VERSION,
  });
  assert.match(result.agentsText, /prose after the fence/);
  assert.equal(
    result.agentsText.match(/<!-- grove:begin/g)?.length,
    1,
  );
  assert.doesNotThrow(() =>
    checkTexts({
      agentsText: result.agentsText,
      claudeText: result.claudeText,
      version: VERSION,
    }),
  );
});

test("compose canonicalizes import aliases and removes active duplicates", () => {
  const result = composeTexts({
    agentsText: block(),
    claudeText: "@./AGENTS.md\ntext\n@AGENTS.md\n",
    version: VERSION,
  });
  assert.equal(result.claudeText, "@AGENTS.md\ntext\n");
});

test("strip removes valid blocks from both files but keeps the adapter", () => {
  const result = stripTexts({
    agentsText: `shared\n${block()}`,
    claudeText: `@AGENTS.md\nlegacy\n${block()}`,
  });
  assert.equal(result.removed, 2);
  assert.equal(result.agentsText, "shared\n");
  assert.equal(result.claudeText, "@AGENTS.md\nlegacy\n");
});

test("check rejects a stale version", () => {
  assert.throws(
    () =>
      checkTexts({
        agentsText: block("0.1.0"),
        claudeText: "@AGENTS.md\n",
        version: VERSION,
      }),
    /does not match plugin version/,
  );
});

test("check rejects adapter aliases and surrounding whitespace", () => {
  for (const claudeText of ["@./AGENTS.md\n", " @AGENTS.md\n", "@AGENTS.md \n"]) {
    assert.throws(
      () =>
        checkTexts({
          agentsText: block(),
          claudeText,
          version: VERSION,
        }),
      /exact standalone line/,
    );
  }
});

test("multi-file writes make AGENTS durable before touching CLAUDE", async () => {
  const attempted = [];
  await assert.rejects(
    applyTransformedWrites({
      agentsPath: "/project/AGENTS.md",
      agentsText: "old agents",
      claudePath: "/project/CLAUDE.md",
      claudeText: "old claude",
      transformed: {
        agentsText: "new agents",
        claudeText: "@AGENTS.md\n",
      },
      write: async (path) => {
        attempted.push(path);
        throw new Error("simulated AGENTS write failure");
      },
    }),
    /simulated AGENTS write failure/,
  );
  assert.deepEqual(attempted, ["/project/AGENTS.md"]);
});

test("check command is read-only and reports canonical state", async () => {
  const root = await fixture();
  assert.equal(run("compose", root).status, 0);
  const before = {
    agents: await optional(join(root, "AGENTS.md")),
    claude: await optional(join(root, "CLAUDE.md")),
  };
  const result = run("check", root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).changed, false);
  assert.equal(await optional(join(root, "AGENTS.md")), before.agents);
  assert.equal(await optional(join(root, "CLAUDE.md")), before.claude);
});

test("source wiring keeps AGENTS canonical and current-truth prose aligned", async () => {
  assert.equal(await readFile(join(REPO_ROOT, "CLAUDE.md"), "utf8"), "@AGENTS.md\n");
  assert.match(
    await readFile(join(REPO_ROOT, "AGENTS.md"), "utf8"),
    /AGENTS\.md` is the canonical home for shared project instructions/,
  );
  assert.match(
    await readFile(join(REPO_ROOT, ".grove", "config.toml"), "utf8"),
    /CONVENTIONS_PATH = "AGENTS\.md"/,
  );

  const currentTruth = [
    "README.md",
    "plugins/grove/README.md",
    ".grove/README.md",
    "plugins/grove/skills/setup/SKILL.md",
    "plugins/grove/skills/refresh/SKILL.md",
    "plugins/grove/skills/remove/SKILL.md",
    "charters/code-reviewer.md",
    "plugins/grove/agents/code-reviewer.md",
    "plugins/grove/agents/conformance-reviewer.md",
    "plugins/grove/agents/contract-author.md",
    "plugins/grove/agents/corpus-reviewer.md",
    "plugins/grove/agents/shaper.md",
    "plugins/grove/agents/validator.md",
  ];
  const staleClaims = [
    /managed `CLAUDE\.md` block/,
    /managed CLAUDE\.md block/,
    /consumer's CLAUDE\.md/,
    /in their CLAUDE\.md managed block/,
    /CLAUDE\.md `grove plugin@<version>` stamp/,
    /conventions doc \/ CLAUDE\.md/,
  ];

  for (const relative of currentTruth) {
    const text = await readFile(join(REPO_ROOT, relative), "utf8");
    for (const stale of staleClaims) {
      assert.doesNotMatch(text, stale, `${relative} contains ${stale}`);
    }
  }
});
