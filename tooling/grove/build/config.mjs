// Build configuration is the single declaration point for generated paths.
export const INVENTORY_PATH = "plugins/grove/metadata/roles.json";

export const COMPANION_PROJECTIONS = Object.freeze([
  {
    source: "charters/lifecycle.md",
    output: "plugins/grove/reference/lifecycle.md",
  },
  {
    source: "charters/relations.md",
    output: "plugins/grove/reference/relations.md",
  },
  {
    source: "charters/versioning.md",
    output: "plugins/grove/reference/versioning.md",
  },
]);

export const GENERATED_FILES = Object.freeze(
  COMPANION_PROJECTIONS.map(({ output }) => output),
);

export const LAUNCHER_BUNDLE_PATH =
  "plugins/grove/metadata/codex-launchers.json";
export const PACKAGE_ALLOWLIST_PATH =
  "plugins/grove/metadata/package-allowlist.json";
export const CLAUDE_INVENTORY_PATH =
  "plugins/grove/metadata/claude-inventory.json";
export const CODEX_INVENTORY_PATH =
  "plugins/grove/metadata/codex-inventory.json";

export const LIFECYCLE_SOURCE =
  "plugins/grove/runtime/lifecycle/lib/lifecycle.mjs";

export const LIFECYCLE_SKILLS = Object.freeze([
  ...[
    ["refresh", "Refresh Grove-managed consumer files and only the invoking host's adapter through the shared lifecycle core. Use when the user asks to refresh, update, upgrade, or roll out Grove in an existing repository."],
    ["remove", "Inventory and explicitly remove only selected Grove-owned consumer surfaces through the shared lifecycle core. Use when the user asks to remove, uninstall, undo, or take Grove out of a repository."],
    ["set-profile", "Plan and explicitly apply a named Grove gate preset through the shared lifecycle core. Use when the user asks to switch, set, or reset their Grove gate profile."],
    ["setup", "Compose Grove's shared consumer floor and the invoking host's bounded adapter through the shared lifecycle core. Use when the user asks to set up, add, install, or compose Grove in a repository."],
  ].flatMap(([operation, description]) =>
    ["claude", "codex"].map((host) => Object.freeze({
      host,
      operation,
      description,
      output: `plugins/grove/adapters/${host}/skills/${operation}/SKILL.md`,
    }))),
]);

export const CANONICAL_ROLE_IDS = Object.freeze([
  "code-reviewer",
  "conformance-reviewer",
  "contract-author",
  "corpus-reviewer",
  "decision-adversary",
  "dispatcher",
  "divergent-researcher",
  "executor",
  "propagation-remediator",
  "run-resumer",
  "shaper",
  "spec-adversary",
  "validator",
]);

export const GENERATED_ROOTS = Object.freeze([
  "plugins/grove/adapters/claude/agents",
  "plugins/grove/adapters/claude/skills",
  "plugins/grove/adapters/codex/skills",
  "plugins/grove/reference/charters",
]);

export const STATIC_PACKAGE_FILES = Object.freeze([
  "plugins/grove/.claude-plugin/plugin.json",
  "plugins/grove/.codex-plugin/plugin.json",
  "plugins/grove/README.md",
  "plugins/grove/VERSION",
  "plugins/grove/metadata/config-tokens.json",
  "plugins/grove/metadata/hosts.json",
  "plugins/grove/metadata/legacy-ownership.json",
  "plugins/grove/metadata/lifecycle-inventory.json",
  "plugins/grove/metadata/roles.json",
  "plugins/grove/metadata/stamp-schema.json",
  "plugins/grove/metadata/surfaces.json",
  "plugins/grove/reference/gates/enforcement.toml",
  "plugins/grove/reference/gates/gates.toml",
  "plugins/grove/reference/surfaces/claude-headless-attempt-2026-07-23.json",
  "plugins/grove/reference/surfaces/codex-bridge-spike-2026-07-23.json",
  "plugins/grove/reference/surfaces/codex-exec-non-ephemeral-0.3.0-2026-07-24.json",
  "plugins/grove/reference/surfaces/codex-exec-non-ephemeral-0.3.0-attempt-2026-07-23.json",
  "plugins/grove/runtime/gates/bin/resolve-profile.mjs",
  "plugins/grove/runtime/gates/lib/profile.mjs",
  "plugins/grove/runtime/lifecycle/bin/grove-operation.mjs",
  "plugins/grove/runtime/lifecycle/lib/lifecycle.mjs",
]);
