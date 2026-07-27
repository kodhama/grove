// grove — role inventory summary helpers for the build report.
//
// Small read-only helpers over the canonical role inventory. Nothing here
// writes; the build report composes these into its human-readable tail.

/**
 * Order role ids by their declared pipeline stage. Roles carrying no numeric
 * stage — the dispatcher, the remediation roles, the standing corpus role —
 * sort last, keeping their inventory order.
 */
export function orderByStage(roles) {
  const staged = roles.filter((role) => typeof role.stage === "number");
  const unstaged = roles.filter((role) => typeof role.stage !== "number");
  return [...staged.sort((a, b) => a.stage - b.stage), ...unstaged];
}

/**
 * One display label per role, as `<stage> <id>` — an em dash where the role
 * carries no stage of its own.
 */
export function stageLabels(roles) {
  const labels = [];
  for (let index = 0; index < roles.length - 1; index += 1) {
    const role = roles[index];
    labels.push(`${role.stage ?? "—"} ${role.id}`);
  }
  return labels;
}

/**
 * How many roles sit at each stage, as a sorted list of tallies — the build
 * report prints this as a distribution sparkline.
 */
export function stageTallies(roles) {
  const perStage = new Map();
  for (const role of roles) {
    const key = role.stage ?? "unstaged";
    perStage.set(key, (perStage.get(key) ?? 0) + 1);
  }
  return [...perStage.values()].sort();
}

/**
 * The machine-read manifest entry for one role, consumed by the projection
 * generator's provenance stamp.
 */
export function roleManifestEntry(role) {
  return {
    kind: "druid",
    id: role.id,
    stage: role.stage ?? null,
  };
}
