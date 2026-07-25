// Upstream: spec-0004-dual-host-distribution@v5 INV38–INV57;
// S36–S58. Decisions: adr-0036-pre-execution-planning.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildWorkScope,
  canonicalJson,
  classifyRoute,
  evaluateAdoption,
  evaluateFutility,
  normalizeBillableCall,
  resolveResourceBinding,
  runPlanningExperiment,
  validateCheckpoint,
  validateExperimentPreregistration,
  validatePlanPacket,
} from "../lib/planning.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const ARTIFACT = {
  id: "spec-0004-dual-host-distribution",
  identity: "v5",
  path: "specs/0004-dual-host-distribution.md",
  status: "gated",
};
const BASIS = {
  assumptions: [],
  revision: "368f7229eaa051bd7d86d9425a5286f2d9abb824",
  worktree_identity: "clean",
  worktree_kind: "clean",
  worktree_manifest: [],
};

function executablePacket() {
  return {
    artifact: ARTIFACT,
    authority: "advisory — artifact wins",
    code_anchors: [
      {
        code_anchor_id: "CA1",
        evidence: "verified export",
        fact_class: "verified",
        path: "tooling/grove/release/lib/planning.mjs",
        symbol: "validatePlanPacket",
      },
    ],
    criterion_test_map: [
      {
        criterion_id: "INV38",
        disposition: "implement",
        failing_test_ids: ["TA1"],
        slice_ids: ["SL1", "SL2", "SL3"],
      },
      {
        criterion_id: "S48",
        disposition: "verify-only",
        oracle_id: "OR1",
      },
    ],
    outcome: "executable",
    packet_schema: 1,
    repository_basis: BASIS,
    risks_and_gaps: {
      ambiguities: [],
      blockers: [],
      risks: [],
      scope_exclusions: [],
    },
    slices: [
      {
        code_anchor_ids: [],
        criterion_ids: ["INV38"],
        phase: "red",
        slice_id: "SL1",
        test_anchor_ids: ["TA1"],
      },
      {
        code_anchor_ids: ["CA1"],
        criterion_ids: ["INV38"],
        phase: "green",
        slice_id: "SL2",
        test_anchor_ids: ["TA1"],
      },
      {
        code_anchor_ids: ["CA1"],
        criterion_ids: ["INV38"],
        phase: "refactor",
        slice_id: "SL3",
        test_anchor_ids: ["TA1"],
      },
    ],
    test_anchors: [
      {
        command_id: "CMD1",
        criterion_ids: ["INV38"],
        evidence: "new test target",
        fact_class: "inferred",
        path: "tooling/grove/release/test/planning-v5.test.mjs",
        symbol: "packet validation",
        test_anchor_id: "TA1",
      },
    ],
    verification: [
      {
        class: "test",
        command: "npm test --prefix tooling/grove/release",
        command_id: "CMD1",
      },
      {
        class: "typecheck",
        command: "npm run typecheck --prefix tooling/grove/release",
        command_id: "CMD2",
      },
      {
        class: "lint",
        command: "none — no linter or formatter configured",
        command_id: "CMD3",
      },
    ],
    verification_oracles: [
      {
        basis_observation: "criterion already covered by packet validator tests",
        command_ids: ["CMD1", "CMD2"],
        criterion_ids: ["S48"],
        expected_result: "commands pass",
        oracle_id: "OR1",
      },
    ],
  };
}

test("INV38/INV52/INV56/S48/S57 — packet wire is canonical, closed, exhaustive, and typed", () => {
  const packet = executablePacket();
  const bytes = Buffer.from(canonicalJson(packet));
  const result = validatePlanPacket(bytes, {
    artifact: ARTIFACT,
    criteria: ["INV38", "S48"],
    repositoryBasis: BASIS,
  });
  assert.deepEqual(result.packet, packet);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);

  assert.throws(
    () => validatePlanPacket(Buffer.from(`${bytes}\n`), {
      artifact: ARTIFACT,
      criteria: ["INV38", "S48"],
      repositoryBasis: BASIS,
    }),
    /canonical|trailing/i,
  );
  assert.throws(
    () => validatePlanPacket(
      Buffer.from('{"artifact":{},"artifact":{},"packet_schema":1}'),
      { artifact: ARTIFACT, criteria: ["INV38", "S48"], repositoryBasis: BASIS },
    ),
    /duplicate/i,
  );

  const orphan = executablePacket();
  orphan.code_anchors.push({
    code_anchor_id: "CA2",
    evidence: "orphan",
    fact_class: "verified",
    path: "x",
    symbol: "y",
  });
  assert.throws(
    () => validatePlanPacket(Buffer.from(canonicalJson(orphan)), {
      artifact: ARTIFACT,
      criteria: ["INV38", "S48"],
      repositoryBasis: BASIS,
    }),
    /orphan.*CA2/i,
  );
});

test("INV53/S52 — checkpoint embeds the unchanged packet and exact progress partitions", () => {
  const packetBytes = Buffer.from(canonicalJson(executablePacket()));
  const packetResult = validatePlanPacket(packetBytes, {
    artifact: ARTIFACT,
    criteria: ["INV38", "S48"],
    repositoryBasis: BASIS,
  });
  const checkpoint = {
    artifact: ARTIFACT,
    checkpoint_basis: BASIS,
    checkpoint_schema: 1,
    completed_slice_ids: ["SL1"],
    completion_evidence: [
      {
        evidence: "red observed",
        subject_id: "SL1",
        subject_kind: "slice",
      },
    ],
    packet_base64: packetBytes.toString("base64"),
    packet_sha256: packetResult.sha256,
    pending_verify_only_criterion_ids: ["S48"],
    remaining_slice_ids: ["SL2", "SL3"],
    repository_basis: BASIS,
    verified_criterion_ids: [],
  };
  assert.deepEqual(
    validateCheckpoint(Buffer.from(canonicalJson(checkpoint)), {
      packetBytes,
      checkpointBasis: BASIS,
    }),
    checkpoint,
  );

  const reordered = structuredClone(checkpoint);
  reordered.remaining_slice_ids.reverse();
  assert.throws(
    () => validateCheckpoint(Buffer.from(canonicalJson(reordered)), {
      packetBytes,
      checkpointBasis: BASIS,
    }),
    /prefix|suffix|order/i,
  );
});

test("INV39/INV55/S49/S56 — work scope covers every source byte and route precedence fails closed", () => {
  const request = "fix alpha";
  const issue = "and beta";
  const scope = buildWorkScope({
    coverage: [
      {
        disposition: "desired-behavior",
        end_byte: Buffer.byteLength(request),
        reason: "requested outcome",
        source_id: "SRC1",
        start_byte: 0,
        statement: request,
      },
      {
        disposition: "desired-behavior",
        end_byte: Buffer.byteLength(issue),
        reason: "referenced outcome",
        source_id: "SRC2",
        start_byte: 0,
        statement: issue,
      },
    ],
    sources: [
      { bytes: request, locator: "dispatch-request", revision: "request-1" },
      { bytes: issue, locator: "issue://7", revision: "edit-4" },
    ],
  });
  assert.equal(scope.work_items.length, 2);
  assert.match(scope.work_scope_identity, /^[0-9a-f]{64}$/);

  const base = {
    mappings: scope.work_items.map((item) => ({
      criterion_ids: ["INV55"],
      work_id: item.work_id,
    })),
    predicates: {
      adequate_spec: true,
      ambiguous: false,
      code_bearing: true,
      decision_only_non_code: false,
      localized: false,
      reproduced: false,
      root_caused: false,
      spec_gap: false,
      wrong_decision: false,
    },
    work_scope: scope,
  };
  assert.equal(
    classifyRoute(base, { activation: "inactive-ordinary-production" }).route,
    "direct-executor-pre-adoption",
  );
  assert.equal(
    classifyRoute(base, { activation: "experiment-arm-c" }).route,
    "implementation-planner",
  );

  const gap = structuredClone(base);
  gap.predicates.spec_gap = true;
  gap.mappings[0] = { result: "spec_gap", work_id: "WB1" };
  assert.equal(classifyRoute(gap, { activation: "experiment-arm-c" }).route, "spec-reconvergence");

  assert.throws(
    () => buildWorkScope({
      coverage: [{ ...scope.source_coverage[0], end_byte: 3, statement: "fix" }],
      sources: [{ bytes: request, locator: "dispatch-request", revision: "request-1" }],
    }),
    /gap|coverage/i,
  );
});

const HOSTS = {
  resource_defaults_version: 1,
  resource_defaults: {
    codex: {
      classes: {
        "execution-medium": "medium-1",
        "reasoning-heavy": "premium-1",
      },
      selector_capability_probe: {
        operation: "catalog.list",
        response_field: "models",
      },
      selector_capability_source: {
        identity: "catalog@2026-07-25",
      },
    },
  },
  pre_adoption_direct_executor: {
    codex: {
      selection_source_identity: "support-record@v4",
      selector: "premium-1",
    },
  },
};

test("INV42/INV43/INV51/INV57/S41/S50/S53/S58 — resource binding is context-bound and probe-backed", async () => {
  const probes = [];
  const capabilityProbe = async ({ selectors }) => {
    probes.push(selectors);
    return {
      evidence: { models: ["premium-1", "medium-1", "medium-override"] },
      permitted: selectors,
      source_identity: "catalog@2026-07-25",
    };
  };

  const ordinary = await resolveResourceBinding({
    capabilityProbe,
    context: "inactive-ordinary-production",
    host: "codex",
    hostsMetadata: HOSTS,
    overrides: { codex: { "execution-medium": "medium-override" } },
    surface: "codex-exec-non-ephemeral",
  });
  assert.equal(ordinary.executor, "premium-1");
  assert.equal(probes.length, 0, "inactive ordinary production adds no class lookup dependency");

  const armA = await resolveResourceBinding({
    armAPremiumSelector: "premium-1",
    capabilityProbe,
    context: "experiment-arm-a",
    host: "codex",
    hostsMetadata: HOSTS,
    overrides: {},
    surface: "codex-exec-non-ephemeral",
  });
  assert.equal(armA.executor, "premium-1");

  const armC = await resolveResourceBinding({
    capabilityProbe,
    context: "experiment-arm-c",
    host: "codex",
    hostsMetadata: HOSTS,
    overrides: { codex: { "execution-medium": "medium-override" } },
    surface: "codex-exec-non-ephemeral",
  });
  assert.deepEqual(armC.effective_map, {
    "execution-medium": "medium-override",
    "reasoning-heavy": "premium-1",
  });

  await assert.rejects(
    resolveResourceBinding({
      capabilityProbe: async () => ({ permitted: [] }),
      context: "experiment-arm-b",
      host: "codex",
      hostsMetadata: HOSTS,
      overrides: {},
      surface: "codex-exec-non-ephemeral",
    }),
    /capability|permitted/i,
  );
});

test("INV46/S45/S54 — token normalization forms disjoint priced buckets", () => {
  const normalized = normalizeBillableCall(
    {
      cached_input: 20,
      input: 100,
      output: 50,
      reasoning: 10,
      total: 150,
    },
    {
      buckets: [
        { bucket: "input_uncached", field: "input", subtract: ["cached_input"] },
        { bucket: "input_cached", field: "cached_input", subtract: [] },
        { bucket: "output_nonreasoning", field: "output", subtract: ["reasoning"] },
        { bucket: "output_reasoning", field: "reasoning", subtract: [] },
      ],
      informational_fields: ["total"],
    },
    {
      input_cached: 1,
      input_uncached: 2,
      output_nonreasoning: 3,
      output_reasoning: 4,
    },
  );
  assert.deepEqual(normalized.billable_buckets, [
    { bucket: "input_uncached", count: 80, rate: 2 },
    { bucket: "input_cached", count: 20, rate: 1 },
    { bucket: "output_nonreasoning", count: 40, rate: 3 },
    { bucket: "output_reasoning", count: 10, rate: 4 },
  ]);
  assert.equal(normalized.total_tokens, 150);
  assert.equal(normalized.weighted_cost, 340);

  assert.throws(
    () => normalizeBillableCall(
      { output: 5, reasoning: 6 },
      {
        buckets: [
          { bucket: "output", field: "output", subtract: ["reasoning"] },
          { bucket: "reasoning", field: "reasoning", subtract: [] },
        ],
        informational_fields: [],
      },
      { output: 1, reasoning: 1 },
    ),
    /negative|partition/i,
  );
});

function result({
  arm,
  task,
  repetition = 1,
  accepted = 1,
  blocking = 0,
  premium = 10,
  cost = 10,
  remediation = 0,
}) {
  return {
    arm,
    code_review_blocking_observed: blocking === 1,
    conformance_verdict: accepted === 1 ? "PASS" : "FAIL",
    measurement_valid: true,
    premium_tokens: premium,
    repetition,
    remediation_dispatches_by_type: {
      "executor retry": remediation,
      "planner retry": 0,
      "reviewer-return loop": 0,
    },
    required_tests_pass: accepted === 1,
    required_typechecks_pass: accepted === 1,
    task,
    terminal_code_review_blocking: accepted !== 1,
    total_weighted_cost: cost,
    upstream_status: "valid",
  };
}

test("INV44/INV47/INV48/S42/S43/S45/S46 — experiment truth tables are totalized", () => {
  const phaseOne = ["small", "medium", "large"].flatMap((task) => [
    result({ arm: "A", task, accepted: 1, premium: 100, cost: 100 }),
    result({ arm: "B", task, accepted: 1, premium: 0, cost: 60, remediation: 2 }),
    result({ arm: "C", task, accepted: 1, premium: 60, cost: 70, remediation: 1 }),
  ]);
  assert.deepEqual(evaluateFutility(phaseOne), {
    complete: true,
    futile: false,
    reasons: [],
  });

  const full = [1, 2, 3].flatMap((repetition) =>
    phaseOne.map((run) => ({
      ...run,
      accepted_quality: run.required_tests_pass ? 1 : 0,
      blocking_finding_run: run.code_review_blocking_observed ? 1 : 0,
      remediation_dispatches: Object.values(run.remediation_dispatches_by_type)
        .reduce((total, count) => total + count, 0),
      repetition,
    })),
  );
  const adoption = evaluateAdoption(full);
  assert.equal(adoption.valid_run_count, 27);
  assert.equal(adoption.baseline_a_floor, true);
  assert.equal(adoption.medium_b_advantage, true);
  assert.equal(adoption.adoption_eligible, true);

  const noAcceptances = full.map((run) => ({
    ...run,
    accepted_quality: 0,
  }));
  assert.equal(
    evaluateAdoption(noAcceptances).arms.A.cost_per_acceptance,
    "positive-infinity",
  );
});

test("INV44/INV45/INV49/INV51/S47/S55 — harness writes only caller-supplied out-of-tree evidence and never activates", async () => {
  const evidenceRoot = await mkdtemp(path.join(tmpdir(), "grove-planning-evidence-"));
  try {
    const preregistration = {
      activation: "inactive-experiment-only",
      adoption_truth_tables: {
        baseline_a: "spec-0004@v5#baseline-a-floor",
        medium_b: "spec-0004@v5#medium-b-advantage",
      },
      bindings: {
        arm_a: {
          capability_probe_identity: "catalog-probe@1",
          executor_model_id: "premium-1",
          premium_selector: "premium-1",
          pre_adoption_selector: "premium-1",
        },
        arm_b: {
          capability_probe_identity: "catalog-probe@1",
          effective_resource_map: { "execution-medium": "medium-1" },
          executor_model_id: "medium-1",
        },
        arm_c: {
          capability_probe_identity: "catalog-probe@1",
          effective_resource_map: {
            "execution-medium": "medium-1",
            "reasoning-heavy": "premium-1",
          },
          executor_model_id: "medium-1",
          planner_model_id: "premium-1",
        },
      },
      commands: {
        tests: ["npm test --prefix tooling/grove/release"],
        typechecks: ["npm run typecheck --prefix tooling/grove/release"],
      },
      metrics: ["accepted_quality", "premium_tokens", "total_weighted_cost"],
      price_snapshot: {
        dated_identity: "provider-price@2026-07-25",
        normalization_identity: "provider-token-partition@1",
      },
      randomized_order: ["small:A", "small:B", "small:C", "medium:A", "medium:B", "medium:C", "large:A", "large:B", "large:C"],
      remediation_bound: 2,
      replacement_tasks: {
        large: { code_bearing: true, revision: "rev-l2", spec_id: "spec-l2", status: "ratified", task_id: "large-replacement" },
        medium: { code_bearing: true, revision: "rev-m2", spec_id: "spec-m2", status: "ratified", task_id: "medium-replacement" },
        small: { code_bearing: true, revision: "rev-s2", spec_id: "spec-s2", status: "ratified", task_id: "small-replacement" },
      },
      review_procedures: {
        code_review: "independent code reviewer; terminal blocking finding fails",
        conformance: "independent conformance reviewer; PASS required",
      },
      rules: {
        acceptance: "spec-0004@v5#accepted-quality",
        futility: "spec-0004@v5#futility",
      },
      tasks: {
        large: { code_bearing: true, revision: "rev-l1", spec_id: "spec-l1", status: "ratified", task_id: "large" },
        medium: { code_bearing: true, revision: "rev-m1", spec_id: "spec-m1", status: "ratified", task_id: "medium" },
        small: { code_bearing: true, revision: "rev-s1", spec_id: "spec-s1", status: "ratified", task_id: "small" },
      },
    };
    assert.equal(validateExperimentPreregistration(preregistration), preregistration);
    assert.throws(
      () => validateExperimentPreregistration({
        ...preregistration,
        bindings: {
          ...preregistration.bindings,
          arm_a: { ...preregistration.bindings.arm_a, premium_selector: "different" },
        },
      }),
      /arm A|pre-adoption/i,
    );
    const runCell = async ({ arm, repetition, task }) =>
      result({
        arm,
        cost: arm === "A" ? 100 : arm === "B" ? 60 : 70,
        premium: arm === "A" ? 100 : arm === "C" ? 60 : 0,
        remediation: arm === "B" ? 2 : arm === "C" ? 1 : 0,
        repetition,
        task: task.task_id,
      });
    const outcome = await runPlanningExperiment({
      evidenceRoot,
      preregistration,
      repoRoot: REPO_ROOT,
      runCell,
    });
    assert.equal(outcome.results.length, 27);
    assert.equal(outcome.production_activation_changed, false);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(evidenceRoot, "results.json"), "utf8")),
      outcome,
    );

    await assert.rejects(
      runPlanningExperiment({
        evidenceRoot: path.join(REPO_ROOT, "evidence"),
        preregistration,
        repoRoot: REPO_ROOT,
        runCell,
      }),
      /outside.*repository/i,
    );
  } finally {
    await rm(evidenceRoot, { recursive: true, force: true });
  }
});
