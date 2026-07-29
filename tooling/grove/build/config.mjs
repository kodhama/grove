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

// --- spec-0006 (voluntary dispatch): floor extract + entry skills ---

// The single authored source of the entry skills' verb and shared body text.
export const ENTRY_BEHAVIOR_SOURCE =
  "tooling/grove/build/sources/entry-behavior.md";
// The floor extract's only source: the marked span of the dispatcher charter.
export const FLOOR_SOURCE = "charters/dispatcher.md";
export const FLOOR_BEGIN_MARKER = "<!-- grove:floors:begin -->";
export const FLOOR_END_MARKER = "<!-- grove:floors:end -->";
// The declared slug set — the dispatcher-only floors (spec-0006 §Floor
// extract and skill generation; adr-0046 clause 3).
export const FLOOR_SLUGS = Object.freeze([
  "floor-owed-reviews",
  "floor-fail-closed-typing",
  "floor-executor-needs-artifact",
  "floor-approved-flip-human",
  "floor-recorded-skips",
  "floor-human-intent-locus",
  "floor-d5-channel",
  "floor-profile-per-handover",
  "floor-sequences-not-grades",
]);
export const FLOOR_EXTRACT_BUDGET = 2500;
export const ENTRY_SKILL_BODY_BUDGET = 12000;
// The exact entry-time disclosure line of spec-0006 §Host scope, carried
// byte-for-byte by the Codex projections only. It stays until a Codex guard
// actually ships — conditional on guard absence, not on the measurement.
export const CODEX_ENTRY_DISCLOSURE =
  "This session runs Grove's dispatch rules without the deterministic stop "
  + "guard; rule conformance here is prose-enforced only.";

const ENTRY_VERBS = Object.freeze([
  Object.freeze({
    verb: "enter",
    description: "Make Grove's dispatch rules available to govern this session without opening a run; writes nothing, ever. Use when the user asks Grove to be available to govern.",
  }),
  Object.freeze({
    verb: "start",
    description: "Govern this from the get-go: opens a committed run — the confirm-gated run cursor — then runs the run-start floor check. Use when the user asks Grove to govern this work from the start.",
  }),
]);

export const ENTRY_SKILLS = Object.freeze(
  ENTRY_VERBS.flatMap(({ verb, description }) =>
    ["claude", "codex"].map((host) => Object.freeze({
      host,
      verb,
      description,
      output: `plugins/grove/adapters/${host}/skills/${verb}/SKILL.md`,
    }))),
);

export const CANONICAL_ROLE_IDS = Object.freeze([
  "code-reviewer",
  "conformance-reviewer",
  "contract-author",
  "corpus-reviewer",
  "decision-adversary",
  "dispatcher",
  "divergent-researcher",
  "executor",
  "implementation-planner",
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
  "plugins/grove/hooks/hooks.json",
  "plugins/grove/hooks/stop-guard.sh",
  "plugins/grove/metadata/config-tokens.json",
  "plugins/grove/metadata/entry-inventory.json",
  "plugins/grove/metadata/hosts.json",
  "plugins/grove/metadata/legacy-ownership.json",
  "plugins/grove/metadata/lifecycle-inventory.json",
  "plugins/grove/metadata/roles.json",
  "plugins/grove/metadata/stamp-schema.json",
  "plugins/grove/metadata/surfaces.json",
  "plugins/grove/reference/dispatch/transitions.toml",
  "plugins/grove/reference/gates/enforcement.toml",
  "plugins/grove/reference/gates/gates.toml",
  "plugins/grove/reference/surfaces/claude-headless-attempt-2026-07-23.json",
  "plugins/grove/reference/surfaces/claude-stop-hook-channels-2026-07-28.json",
  "plugins/grove/reference/surfaces/codex-bridge-spike-2026-07-23.json",
  "plugins/grove/reference/surfaces/codex-exec-non-ephemeral-0.3.0-2026-07-24.json",
  "plugins/grove/reference/surfaces/codex-exec-non-ephemeral-0.3.0-attempt-2026-07-23.json",
  "plugins/grove/reference/surfaces/codex-hook-vocabulary-2026-07-28.json",
  "plugins/grove/runtime/dispatch/bin/grove-run.mjs",
  "plugins/grove/runtime/dispatch/bin/guard.mjs",
  "plugins/grove/runtime/dispatch/lib/cursor.mjs",
  "plugins/grove/runtime/dispatch/lib/guard-core.mjs",
  "plugins/grove/runtime/dispatch/lib/run.mjs",
  "plugins/grove/runtime/dispatch/lib/toml.mjs",
  "plugins/grove/runtime/dispatch/lib/transitions.mjs",
  "plugins/grove/runtime/gates/bin/resolve-profile.mjs",
  "plugins/grove/runtime/gates/lib/profile.mjs",
  "plugins/grove/runtime/lifecycle/bin/grove-operation.mjs",
  "plugins/grove/runtime/lifecycle/lib/lifecycle.mjs",
]);
