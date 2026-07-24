import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  CANONICAL_ROLE_IDS,
  CLAUDE_INVENTORY_PATH,
  CODEX_INVENTORY_PATH,
  COMPANION_PROJECTIONS,
  GENERATED_FILES,
  GENERATED_ROOTS,
  INVENTORY_PATH,
  LAUNCHER_BUNDLE_PATH,
  LIFECYCLE_SKILLS,
  LIFECYCLE_SOURCE,
  PACKAGE_ALLOWLIST_PATH,
  STATIC_PACKAGE_FILES,
} from "../config.mjs";

const INSTRUCTION_FIELDS = new Set([
  "instruction",
  "instructions",
  "method",
  "workflow",
  "boundaries",
  "developer_instructions",
  "prompt",
]);
const ROLE_FIELDS = new Set([
  "id",
  "source",
  "description",
  "tool_policy",
  "exposures",
  "outputs",
]);
const EXPOSURE_FIELDS = new Set([
  "class",
  "native_id",
  "source_fragment",
]);
const OUTPUT_FIELDS = new Set(["reference", "claude_agent", "codex_skill"]);
const EXPOSURE_CLASSES = new Set([
  "driving-session",
  "cold-native",
  "scoped-advisor",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function generatedHeader(source, digest, prefix = "<!--") {
  if (prefix === "#") {
    return `# GENERATED — DO NOT EDIT; canonical-source: ${source}; sha256: ${digest}`;
  }
  return `<!-- GENERATED — DO NOT EDIT; canonical-source: ${source}; sha256: ${digest} -->`;
}

function yamlScalar(value) {
  return JSON.stringify(value);
}

function tomlScalar(value) {
  return JSON.stringify(value);
}

function assertNoInstructionFields(value, location = "inventory") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (INSTRUCTION_FIELDS.has(key)) {
      throw new Error(`unexpected authored instruction field '${key}' at ${location}`);
    }
    assertNoInstructionFields(child, `${location}.${key}`);
  }
}

function isWithinGeneratedRoot(output) {
  const normalized = path.posix.normalize(output);
  return (
    normalized === output &&
    !path.posix.isAbsolute(output) &&
    !normalized.startsWith("../") &&
    (
      GENERATED_FILES.includes(normalized)
      || GENERATED_ROOTS.some(
        (root) => normalized === root || normalized.startsWith(`${root}/`),
      )
    )
  );
}

function validateOutput(output, label) {
  if (typeof output !== "string" || !isWithinGeneratedRoot(output)) {
    throw new Error(
      `${label} output path is outside declared generated roots: ${String(output)}`,
    );
  }
}

function validateInventoryShape(inventory) {
  assertNoInstructionFields(inventory);
  if (
    !inventory ||
    inventory.schema !== 1 ||
    !Array.isArray(inventory.roles)
  ) {
    throw new Error("role inventory must have schema 1 and a roles array");
  }

  const ids = inventory.roles.map((role) => role.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) throw new Error(`duplicate role id: ${duplicate}`);

  const actualIds = [...ids].sort();
  const expectedIds = [...CANONICAL_ROLE_IDS].sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(
      `role inventory must contain exactly: ${expectedIds.join(", ")}`,
    );
  }

  const nativeIds = new Set();
  const outputPaths = new Set();
  for (const role of inventory.roles) {
    for (const key of Object.keys(role)) {
      if (!ROLE_FIELDS.has(key)) {
        throw new Error(`unexpected role metadata field '${key}' for ${role.id}`);
      }
    }
    if (role.source !== `charters/${role.id}.md`) {
      throw new Error(
        `role ${role.id} source must be charters/${role.id}.md`,
      );
    }
    if (typeof role.description !== "string" || !role.description.trim()) {
      throw new Error(`role ${role.id} requires a description`);
    }
    if (
      !role.tool_policy ||
      !Array.isArray(role.tool_policy.claude) ||
      role.tool_policy.claude.some((tool) => typeof tool !== "string")
    ) {
      throw new Error(`role ${role.id} requires a Claude tool policy`);
    }
    if (!Array.isArray(role.exposures) || role.exposures.length === 0) {
      throw new Error(`role ${role.id} requires at least one exposure`);
    }

    for (const exposure of role.exposures) {
      for (const key of Object.keys(exposure)) {
        if (!EXPOSURE_FIELDS.has(key)) {
          throw new Error(
            `unexpected exposure metadata field '${key}' for ${role.id}`,
          );
        }
      }
      if (!EXPOSURE_CLASSES.has(exposure.class)) {
        throw new Error(`invalid exposure class for ${role.id}: ${exposure.class}`);
      }
      if (exposure.class === "driving-session") {
        if (exposure.native_id !== undefined) {
          throw new Error(`driving-session exposure has native id for ${role.id}`);
        }
      } else {
        if (
          typeof exposure.native_id !== "string" ||
          !/^[a-z0-9_]+$/.test(exposure.native_id) ||
          exposure.native_id.includes("-")
        ) {
          throw new Error(`invalid native id for ${role.id}`);
        }
        if (nativeIds.has(exposure.native_id)) {
          throw new Error(`duplicate native id: ${exposure.native_id}`);
        }
        nativeIds.add(exposure.native_id);
      }
    }

    const classes = role.exposures.map((item) => item.class);
    if (
      role.id === "shaper" &&
      JSON.stringify(classes) !== JSON.stringify(["driving-session"])
    ) {
      throw new Error("shaper must be driving-session only");
    }
    if (
      role.id === "dispatcher" &&
      JSON.stringify(classes) !==
        JSON.stringify(["driving-session", "scoped-advisor"])
    ) {
      throw new Error(
        "dispatcher must expose driving-session and scoped-advisor in that order",
      );
    }
    if (
      role.id === "dispatcher" &&
      role.exposures[1].source_fragment !== "scoped-agent-boundary"
    ) {
      throw new Error("dispatcher scoped advisor must name scoped-agent-boundary");
    }
    if (
      role.id !== "dispatcher" &&
      role.id !== "shaper" &&
      JSON.stringify(classes) !== JSON.stringify(["cold-native"])
    ) {
      throw new Error(`${role.id} must expose exactly one cold-native role`);
    }

    if (!role.outputs || typeof role.outputs !== "object") {
      throw new Error(`role ${role.id} requires declared outputs`);
    }
    for (const key of Object.keys(role.outputs)) {
      if (!OUTPUT_FIELDS.has(key)) {
        throw new Error(`unexpected output metadata field '${key}' for ${role.id}`);
      }
    }
    const required = ["reference", "codex_skill"];
    if (role.id !== "shaper") required.push("claude_agent");
    for (const key of required) {
      validateOutput(role.outputs[key], `${role.id}.${key}`);
    }
    if (role.id === "shaper" && role.outputs.claude_agent !== undefined) {
      throw new Error("shaper must not declare a cold Claude agent output");
    }
    for (const output of Object.values(role.outputs)) {
      if (outputPaths.has(output)) throw new Error(`duplicate output path: ${output}`);
      outputPaths.add(output);
    }
  }

  if (nativeIds.size !== 12) {
    throw new Error(`expected 12 native exposures, found ${nativeIds.size}`);
  }
}

async function readCanonical(repoRoot, source) {
  const absolute = path.join(repoRoot, source);
  try {
    const details = await stat(absolute);
    if (!details.isFile()) throw new Error();
    return await readFile(absolute, "utf8");
  } catch {
    throw new Error(`missing charter source: ${source}`);
  }
}

function runtimeReferenceBody(source, body) {
  if (!body.startsWith("---\n")) {
    throw new Error(`${source} must begin with artifact front matter`);
  }
  const frontmatterEnd = body.indexOf("\n---\n", 4);
  if (frontmatterEnd === -1) {
    throw new Error(`${source} has unterminated artifact front matter`);
  }
  return body.slice(frontmatterEnd + 5);
}

function referenceProjection(source, body, digest, sourceFragment) {
  let projectedBody = runtimeReferenceBody(source, body);
  if (sourceFragment === "scoped-agent-boundary") {
    const needle =
      "> **The `grove:dispatcher` plugin agent (`plugins/grove/adapters/claude/agents/dispatcher.md`)";
    if (!projectedBody.includes(needle)) {
      throw new Error(
        `dispatcher source is missing fragment target: ${sourceFragment}`,
      );
    }
    projectedBody = projectedBody.replace(
      needle,
      `<a id="${sourceFragment}"></a>\n\n${needle}`,
    );
  }
  return `${generatedHeader(source, digest)}\n${projectedBody}`;
}

function claudeAgentProjection(role, digest) {
  const exposure = role.exposures.find((item) => item.native_id);
  const tools = role.tool_policy.claude.join(", ");
  const canonicalPath = `\${CLAUDE_PLUGIN_ROOT}/reference/charters/${role.id}.md`;
  const lines = [
    "---",
    `name: ${role.id}`,
    `description: ${yamlScalar(role.description)}`,
    `tools: ${tools}`,
    "---",
    generatedHeader(role.source, digest),
    "",
    `Canonical source: \`${role.source}\``,
    `Canonical digest: \`${digest}\``,
    `Exposure: \`${exposure.class}\``,
    "",
  ];
  if (exposure.class === "scoped-advisor") {
    lines.push(
      `Load the canonical projection at \`${canonicalPath}\`, beginning at the generated \`${exposure.source_fragment}\` fragment.`,
      "Apply only that fragment's one-shot advisor scope. Consult its Dispatch contract and Owed reviews only for the bounded judgment; do not enact the driving-session dispatcher.",
    );
  } else {
    lines.push(
      `Load the canonical projection at \`${canonicalPath}\` and follow it as the complete role contract.`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function codexSkillProjection(role, digest) {
  const nativeExposure = role.exposures.find((item) => item.native_id);
  const exposure = nativeExposure?.class ?? "driving-session";
  const relativeReference = `../../../../reference/charters/${role.id}.md`;
  const exposureLabel =
    role.id === "dispatcher"
      ? "driving-session, scoped-advisor"
      : exposure;
  const lines = [
    "---",
    `name: role-${role.id}`,
    `description: ${yamlScalar(role.description)}`,
    "---",
    generatedHeader(role.source, digest),
    "",
    `Canonical source: \`${role.source}\``,
    `Canonical digest: \`${digest}\``,
    `Exposure: \`${exposureLabel}\``,
    "",
  ];
  if (role.id === "dispatcher") {
    lines.push(
      "When the full role is selected, invoke it in the current driving task; do not delegate or spawn it.",
      "At every handover, read `runtime_dir` from `.grove/gates.toml`; when absent use `runtime/gates/` relative to this active installed Grove package, and when present invoke exactly the declared directory without search or fallback.",
      "",
      "Select the exposure from the invoking context:",
      "",
      `- When the launcher developer instruction contains the exact selector \`Grove exposure selector: scoped-advisor\`, read [the scoped canonical dispatcher projection](${relativeReference}#${nativeExposure.source_fragment}) from the \`${nativeExposure.source_fragment}\` fragment. Apply only that fragment's one-shot advisor scope; do not enact the driving-session dispatcher.`,
      `- Otherwise, only when acting as the driving session, read [the full canonical dispatcher projection](${relativeReference}) and follow it as the complete dispatcher contract.`,
      "- If neither condition is true, stop and report the exposure mismatch rather than choosing a role silently.",
    );
  } else {
    if (role.exposures.some((item) => item.class === "driving-session")) {
      lines.push("Invoke this complete role in the current driving task; do not delegate or spawn it.");
    }
    lines.push(
      `Read [the canonical role projection](${relativeReference}) and follow it as the complete role contract in the ${exposure} exposure.`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function lifecycleSkillProjection(metadata, digest) {
  const title = metadata.operation;
  return [
    "---",
    `name: ${metadata.operation}`,
    `description: ${yamlScalar(metadata.description)}`,
    "---",
    generatedHeader(LIFECYCLE_SOURCE, digest),
    "",
    `# Grove ${title} adapter`,
    "",
    "This is a read-through entrypoint, not a lifecycle authority. Resolve the",
    "active installed Grove plugin root as the directory four levels above this file, then run:",
    "",
    "```text",
    `node <grove-plugin-root>/runtime/lifecycle/bin/grove-operation.mjs describe ${metadata.operation}`,
    "```",
    "",
    `Follow that emitted contract exactly. Do not infer, recreate, or extend ${title}`,
    "semantics from this adapter.",
    "",
  ].join("\n");
}

function launcherContent(role, exposure, digest) {
  const lines = [
    generatedHeader(role.source, digest, "#"),
    `name = ${tomlScalar(exposure.native_id)}`,
    `description = ${tomlScalar(role.description)}`,
    "developer_instructions = " +
      tomlScalar(
        `Load and follow the installed Grove skill grove:role-${role.id}. ` +
          `Canonical Grove role id: ${role.id}. ` +
          `Codex native agent id: ${exposure.native_id}. ` +
          `Verify canonical source ${role.source} at sha256 ${digest}. ` +
          `Grove exposure selector: ${exposure.class}. ` +
          `Use only its declared ${exposure.class} exposure.`,
      ),
  ];
  return `${lines.join("\n")}\n`;
}

function launcherBundle(launchers) {
  return `${JSON.stringify(
    {
      generated: "GENERATED — DO NOT EDIT",
      source: INVENTORY_PATH,
      launchers: launchers.sort((left, right) =>
        left.native_id.localeCompare(right.native_id),
      ),
    },
    null,
    2,
  )}\n`;
}

function packageAllowlist(outputPaths) {
  const prefix = "plugins/grove/";
  const paths = new Set([
    ...STATIC_PACKAGE_FILES,
    ...outputPaths,
    PACKAGE_ALLOWLIST_PATH,
  ]);
  return `${JSON.stringify({
    generated: "GENERATED — DO NOT EDIT",
    source: "tooling/grove/build/config.mjs",
    schema_version: 1,
    leaves: [...paths]
      .sort()
      .map((path) => {
        if (!path.startsWith(prefix)) {
          throw new Error(`package allowlist entry is outside plugins/grove: ${path}`);
        }
        return { path, kind: "file" };
      }),
  }, null, 2)}\n`;
}

function hostInventory({ host, components, drivingLoaders }) {
  return `${JSON.stringify({
    generated: "GENERATED — DO NOT EDIT",
    schema_version: 1,
    host,
    literal_prefix: "grove:",
    components: [...components].sort((left, right) =>
      left.raw_id.localeCompare(right.raw_id)),
    driving_loaders: drivingLoaders,
  }, null, 2)}\n`;
}

export async function buildProjectionSet({
  repoRoot,
  inventoryPath = INVENTORY_PATH,
}) {
  const inventoryAbsolute = path.join(repoRoot, inventoryPath);
  let inventory;
  try {
    inventory = JSON.parse(await readFile(inventoryAbsolute, "utf8"));
  } catch (error) {
    throw new Error(`cannot read role inventory ${inventoryPath}: ${error.message}`);
  }
  validateInventoryShape(inventory);

  const outputs = new Map();
  const launchers = [];
  const claudeComponents = [];
  const codexComponents = [];
  const roleDigests = new Map();
  for (const role of [...inventory.roles].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const canonical = await readCanonical(repoRoot, role.source);
    const digest = sha256(canonical);
    roleDigests.set(role.id, digest);
    const sourceFragment = role.exposures.find(
      (item) => item.source_fragment,
    )?.source_fragment;

    outputs.set(
      role.outputs.reference,
      referenceProjection(role.source, canonical, digest, sourceFragment),
    );
    outputs.set(role.outputs.codex_skill, codexSkillProjection(role, digest));
    codexComponents.push({
      raw_id: `grove:role-${role.id}`,
      path: role.outputs.codex_skill.slice("plugins/grove/".length),
      class: "role",
      exposure: role.exposures.map((item) => item.class).join(","),
      canonical_source: role.source,
      canonical_digest: digest,
    });
    if (role.outputs.claude_agent) {
      outputs.set(role.outputs.claude_agent, claudeAgentProjection(role, digest));
      const exposure = role.exposures.find((item) => item.native_id);
      claudeComponents.push({
        raw_id: `grove:${role.id}`,
        path: role.outputs.claude_agent.slice("plugins/grove/".length),
        class: "agent",
        exposure: exposure.class,
        canonical_source: role.source,
        canonical_digest: digest,
      });
    }

    for (const exposure of role.exposures.filter((item) => item.native_id)) {
      const output = `.codex/agents/${exposure.native_id}.toml`;
      launchers.push({
        canonical_id: role.id,
        native_id: exposure.native_id,
        exposure: exposure.class,
        source: role.source,
        digest,
        output,
        skill: `grove:role-${role.id}`,
        content: launcherContent(role, exposure, digest),
      });
    }
  }

  for (const companion of COMPANION_PROJECTIONS) {
    validateOutput(companion.output, companion.source);
    const canonical = await readCanonical(repoRoot, companion.source);
    const digest = sha256(canonical);
    outputs.set(
      companion.output,
      referenceProjection(companion.source, canonical, digest),
    );
  }
  const lifecycleCore = await readCanonical(repoRoot, LIFECYCLE_SOURCE);
  const lifecycleDigest = sha256(lifecycleCore);
  for (const metadata of LIFECYCLE_SKILLS) {
    validateOutput(metadata.output, `lifecycle.${metadata.operation}`);
    outputs.set(
      metadata.output,
      lifecycleSkillProjection(metadata, lifecycleDigest),
    );
    const target = metadata.host === "claude" ? claudeComponents : codexComponents;
    target.push({
      raw_id: `grove:${metadata.operation}`,
      path: metadata.output.slice("plugins/grove/".length),
      class: "lifecycle",
      exposure: "lifecycle",
      canonical_source: LIFECYCLE_SOURCE,
      canonical_digest: lifecycleDigest,
    });
  }
  outputs.set(LAUNCHER_BUNDLE_PATH, launcherBundle(launchers));
  outputs.set(CLAUDE_INVENTORY_PATH, hostInventory({
    host: "claude",
    components: claudeComponents,
    drivingLoaders: {
      dispatcher: {
        raw_reference: "${CLAUDE_PLUGIN_ROOT}/reference/charters/dispatcher.md",
        canonical_source: "charters/dispatcher.md",
        canonical_digest: roleDigests.get("dispatcher"),
      },
      shaper: {
        raw_reference: "${CLAUDE_PLUGIN_ROOT}/reference/charters/shaper.md",
        canonical_source: "charters/shaper.md",
        canonical_digest: roleDigests.get("shaper"),
      },
    },
  }));
  outputs.set(CODEX_INVENTORY_PATH, hostInventory({
    host: "codex",
    components: codexComponents,
    drivingLoaders: {
      dispatcher: {
        raw_skill_id: "grove:role-dispatcher",
        canonical_source: "charters/dispatcher.md",
        canonical_digest: roleDigests.get("dispatcher"),
      },
      shaper: {
        raw_skill_id: "grove:role-shaper",
        canonical_source: "charters/shaper.md",
        canonical_digest: roleDigests.get("shaper"),
      },
    },
  }));
  outputs.set(PACKAGE_ALLOWLIST_PATH, packageAllowlist(outputs.keys()));

  return new Map(
    [...outputs].sort(([left], [right]) => left.localeCompare(right)),
  );
}

async function listFiles(root, relative = "") {
  const absolute = path.join(root, relative);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, child)));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

export async function writeProjectionSet({ repoRoot, outputs }) {
  for (const [relative, content] of outputs) {
    const absolute = path.join(repoRoot, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  }
}

export async function checkProjectionSet({ repoRoot, outputs }) {
  const stale = [];
  const missing = [];
  for (const [relative, expected] of outputs) {
    try {
      const actual = await readFile(path.join(repoRoot, relative), "utf8");
      if (actual !== expected) stale.push(relative);
    } catch (error) {
      if (error.code === "ENOENT") missing.push(relative);
      else throw error;
    }
  }

  const actualGenerated = new Set();
  for (const root of GENERATED_ROOTS) {
    const within = await listFiles(path.join(repoRoot, root));
    for (const file of within) {
      actualGenerated.add(path.posix.join(root, file));
    }
  }
  for (const file of GENERATED_FILES) actualGenerated.add(file);
  actualGenerated.add(LAUNCHER_BUNDLE_PATH);
  actualGenerated.add(CLAUDE_INVENTORY_PATH);
  actualGenerated.add(CODEX_INVENTORY_PATH);
  actualGenerated.add(PACKAGE_ALLOWLIST_PATH);
  // Skill directories share a host-owned parent with the four authored
  // lifecycle skills. Detect orphaned generated role skills by their marker
  // without treating those authored siblings as generated output.
  for (const skillRoot of [
    "plugins/grove/adapters/claude/skills",
    "plugins/grove/adapters/codex/skills",
  ]) {
    for (const file of await listFiles(path.join(repoRoot, skillRoot))) {
      const relative = path.posix.join(skillRoot, file);
      if (actualGenerated.has(relative)) continue;
      const content = await readFile(path.join(repoRoot, relative), "utf8");
      if (content.includes("GENERATED — DO NOT EDIT")) {
        actualGenerated.add(relative);
      }
    }
  }
  const expectedNames = new Set(outputs.keys());
  const unexpected = [...actualGenerated]
    .filter((name) => !expectedNames.has(name))
    .sort();

  return {
    ok: stale.length === 0 && missing.length === 0 && unexpected.length === 0,
    stale: stale.sort(),
    missing: missing.sort(),
    unexpected,
  };
}
