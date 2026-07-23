// Build configuration is the single declaration point for generated paths.
export const INVENTORY_PATH = "plugins/grove/roles.json";

export const COMPANION_PROJECTIONS = Object.freeze([
  {
    source: "charters/lifecycle.md",
    output: "plugins/grove/reference/charters/lifecycle.md",
  },
  {
    source: "charters/relations.md",
    output: "plugins/grove/reference/charters/relations.md",
  },
  {
    source: "charters/versioning.md",
    output: "plugins/grove/reference/charters/versioning.md",
  },
]);

export const LAUNCHER_BUNDLE_PATH =
  "plugins/grove/build/generated/codex-launchers.json";

export const LIFECYCLE_SOURCE =
  "plugins/grove/operations/lib/lifecycle.mjs";

export const LIFECYCLE_SKILLS = Object.freeze([
  Object.freeze({
    operation: "refresh",
    description:
      "Refresh Grove-managed consumer files and only the invoking host's adapter through the shared lifecycle core. Use when the user asks to refresh, update, upgrade, or roll out Grove in an existing repository.",
    output: "plugins/grove/skills/refresh/SKILL.md",
  }),
  Object.freeze({
    operation: "remove",
    description:
      "Inventory and explicitly remove only selected Grove-owned consumer surfaces through the shared lifecycle core. Use when the user asks to remove, uninstall, undo, or take Grove out of a repository.",
    output: "plugins/grove/skills/remove/SKILL.md",
  }),
  Object.freeze({
    operation: "set-profile",
    description:
      "Plan and explicitly apply a named Grove gate preset through the shared lifecycle core. Use when the user asks to switch, set, or reset their Grove gate profile.",
    output: "plugins/grove/skills/set-profile/SKILL.md",
  }),
  Object.freeze({
    operation: "setup",
    description:
      "Compose Grove's shared consumer floor and the invoking host's bounded adapter through the shared lifecycle core. Use when the user asks to set up, add, install, or compose Grove in a repository.",
    output: "plugins/grove/skills/setup/SKILL.md",
  }),
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
  "plugins/grove/agents",
  "plugins/grove/reference/charters",
  "plugins/grove/build/generated",
  ...CANONICAL_ROLE_IDS.map((id) => `plugins/grove/skills/role-${id}`),
  ...LIFECYCLE_SKILLS.map(({ operation }) => `plugins/grove/skills/${operation}`),
]);
