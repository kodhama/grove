// Upstream: spec-0004-dual-host-distribution@v5 INV38–INV57;
// S36–S58. Decisions: adr-0036-pre-execution-planning.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
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

  const unresolvedGap = executablePacket();
  unresolvedGap.outcome = "blocked";
  unresolvedGap.code_anchors = [];
  unresolvedGap.criterion_test_map = [
    { criterion_id: "INV38", disposition: "blocked", gap_id: "GHOST" },
    { criterion_id: "S48", disposition: "blocked", gap_id: "GHOST" },
  ];
  unresolvedGap.slices = [];
  unresolvedGap.test_anchors = [];
  unresolvedGap.verification = [];
  unresolvedGap.verification_oracles = [];
  assert.throws(
    () => validatePlanPacket(Buffer.from(canonicalJson(unresolvedGap)), {
      artifact: ARTIFACT,
      criteria: ["INV38", "S48"],
      repositoryBasis: BASIS,
    }),
    /gap.*GHOST.*unresolved|unresolved.*GHOST/i,
  );

  const dirtyPacket = executablePacket();
  const invalidManifest = [{
    content_identity: "not-a-digest",
    kind: "bogus",
    mode: null,
    path: "",
    state: "bogus",
  }];
  dirtyPacket.repository_basis = {
    assumptions: ["z-last", "a-first"],
    revision: BASIS.revision,
    worktree_identity: createHash("sha256")
      .update(canonicalJson(invalidManifest))
      .digest("hex"),
    worktree_kind: "disclosed-dirty",
    worktree_manifest: invalidManifest,
  };
  assert.throws(
    () => validatePlanPacket(Buffer.from(canonicalJson(dirtyPacket)), {
      artifact: ARTIFACT,
      criteria: ["INV38", "S48"],
      repositoryBasis: dirtyPacket.repository_basis,
    }),
    /assumptions.*sort|manifest|kind|state|mode|content_identity|path/i,
  );

  const crossCriterion = executablePacket();
  crossCriterion.criterion_test_map[1] = {
    criterion_id: "S48",
    disposition: "implement",
    failing_test_ids: ["TA2"],
    slice_ids: ["SL4", "SL5"],
  };
  crossCriterion.test_anchors.push({
    command_id: "CMD1",
    criterion_ids: ["S48"],
    evidence: "second criterion target",
    fact_class: "inferred",
    path: "tooling/grove/release/test/planning-v5.test.mjs",
    symbol: "second criterion",
    test_anchor_id: "TA2",
  });
  crossCriterion.slices[0].test_anchor_ids.push("TA2");
  crossCriterion.slices.push(
    {
      code_anchor_ids: [],
      criterion_ids: ["S48"],
      phase: "red",
      slice_id: "SL4",
      test_anchor_ids: ["TA2"],
    },
    {
      code_anchor_ids: ["CA1"],
      criterion_ids: ["S48"],
      phase: "green",
      slice_id: "SL5",
      test_anchor_ids: ["TA2"],
    },
  );
  crossCriterion.verification_oracles = [];
  assert.throws(
    () => validatePlanPacket(Buffer.from(canonicalJson(crossCriterion)), {
      artifact: ARTIFACT,
      criteria: ["INV38", "S48"],
      repositoryBasis: BASIS,
    }),
    /SL1.*TA2.*criterion|cross-criterion/i,
  );
});

test("INV38/S38 — packet phases and blocking gaps preserve executable/blocked truth", () => {
  const phaseInversion = executablePacket();
  [phaseInversion.slices[1], phaseInversion.slices[2]] =
    [phaseInversion.slices[2], phaseInversion.slices[1]];
  phaseInversion.criterion_test_map[0].slice_ids = ["SL1", "SL3", "SL2"];
  assert.throws(
    () => validatePlanPacket(Buffer.from(canonicalJson(phaseInversion)), {
      artifact: ARTIFACT,
      criteria: ["INV38", "S48"],
      repositoryBasis: BASIS,
    }),
    /phase|red.*green|refactor.*green|order/i,
  );

  for (const collection of ["risks", "scope_exclusions"]) {
    const executableBlocker = executablePacket();
    executableBlocker.risks_and_gaps[collection] = [{
      blocking: true,
      id: "GAP1",
      text: "load-bearing unresolved evidence",
    }];
    assert.throws(
      () => validatePlanPacket(Buffer.from(canonicalJson(executableBlocker)), {
        artifact: ARTIFACT,
        criteria: ["INV38", "S48"],
        repositoryBasis: BASIS,
      }),
      /blocking.*gap|executable.*blocking/i,
      collection,
    );
  }

  const resolvedBlocked = executablePacket();
  resolvedBlocked.outcome = "blocked";
  resolvedBlocked.code_anchors = [];
  resolvedBlocked.criterion_test_map = [
    { criterion_id: "INV38", disposition: "blocked", gap_id: "GAP1" },
    { criterion_id: "S48", disposition: "blocked", gap_id: "GAP1" },
  ];
  resolvedBlocked.risks_and_gaps.ambiguities = [{
    blocking: true,
    id: "GAP1",
    text: "repository basis is stale and cannot be reproduced",
  }];
  resolvedBlocked.slices = [];
  resolvedBlocked.test_anchors = [];
  resolvedBlocked.verification = [];
  resolvedBlocked.verification_oracles = [];
  assert.equal(
    validatePlanPacket(Buffer.from(canonicalJson(resolvedBlocked)), {
      artifact: ARTIFACT,
      criteria: ["INV38", "S48"],
      repositoryBasis: BASIS,
    }).packet.outcome,
    "blocked",
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
    dispatchRequest: {
      bytes: request,
      locator: "dispatch-request",
      references: [{ locator: "issue://7", revision: "edit-4" }],
      revision: "request-1",
    },
    referencedSources: [
      { bytes: issue, locator: "issue://7", revision: "edit-4" },
    ],
  });
  assert.equal(scope.work_items.length, 2);
  assert.match(scope.work_scope_identity, /^[0-9a-f]{64}$/);

  const predicate = (field, value, detail, subjectIds = ["WB1"]) => ({
    evidence: value ? [{
      evidence_type: {
        adequate_spec: "criterion-mapping",
        ambiguous: "evidence-defect",
        code_bearing: "requested-path-class",
        decision_only_non_code: "requested-path-class",
        localized: "component-boundary",
        reproduced: "reproduction",
        root_caused: "causal-trace",
        spec_gap: "exhaustive-criterion-search",
        wrong_decision: "decision-contradiction",
      }[field],
      subject_ids: subjectIds,
      summary: detail,
    }] : [],
    missing_evidence_reason: value ? null : detail,
    value,
  });
  const base = {
    artifact: ARTIFACT,
    classification_schema: 1,
    mappings: scope.work_items.map((item) => ({
      criterion_ids: ["INV55"],
      result: "criteria",
      work_id: item.work_id,
    })),
    predicates: {
      adequate_spec: predicate("adequate_spec", true, "all work ids map to INV55", ["WB1", "WB2"]),
      ambiguous: predicate("ambiguous", false, "all required evidence is present"),
      code_bearing: predicate("code_bearing", true, "source and test changes requested", ["WB1", "WB2"]),
      decision_only_non_code: predicate("decision_only_non_code", false, "request changes executable behavior"),
      localized: predicate("localized", false, "forward construction is not a localized slip"),
      reproduced: predicate("reproduced", false, "forward construction has no prior failure"),
      root_caused: predicate("root_caused", false, "forward construction has no prior failure"),
      spec_gap: predicate("spec_gap", false, "exhaustive criterion search maps all work"),
      wrong_decision: predicate("wrong_decision", false, "no approved decision contradicts the work"),
    },
    repository_basis: BASIS,
    requested_path_classes: ["source", "test"],
    work_items: scope.work_items,
    work_scope_identity: scope.work_scope_identity,
  };
  assert.equal(
    classifyRoute(base, {
      activation: "inactive-ordinary-production",
      artifact: ARTIFACT,
      criteria: ["INV55", "S56"],
      repositoryBasis: BASIS,
      workScope: scope,
    }).route,
    "direct-executor-pre-adoption",
  );
  assert.equal(
    classifyRoute(base, {
      activation: "experiment-arm-c",
      artifact: ARTIFACT,
      criteria: ["INV55", "S56"],
      repositoryBasis: BASIS,
      workScope: scope,
    }).route,
    "implementation-planner",
  );

  const gap = structuredClone(base);
  gap.predicates.spec_gap = predicate("spec_gap", true, "WB1 is absent from the ratified criteria");
  gap.predicates.adequate_spec = predicate("adequate_spec", false, "WB1 is uncovered");
  gap.mappings[0] = {
    exhaustive_criterion_search: ["INV55", "S56"],
    result: "spec_gap",
    work_id: "WB1",
  };
  assert.equal(classifyRoute(gap, {
    activation: "experiment-arm-c",
    artifact: ARTIFACT,
    criteria: ["INV55", "S56"],
    repositoryBasis: BASIS,
    workScope: scope,
  }).route, "spec-reconvergence");

  const mixedUpstreamDefects = structuredClone(gap);
  mixedUpstreamDefects.predicates.wrong_decision =
    predicate("wrong_decision", true, "WB1 contradicts adr-0036 D5");
  mixedUpstreamDefects.predicates.spec_gap =
    predicate("spec_gap", true, "WB2 is absent from all artifact criteria", ["WB2"]);
  mixedUpstreamDefects.mappings[0] = {
    clause: "D5",
    decision_id: "adr-0036-pre-execution-planning",
    result: "wrong_decision",
    work_id: "WB1",
  };
  mixedUpstreamDefects.mappings[1] = {
    exhaustive_criterion_search: ["INV55", "S56"],
    result: "spec_gap",
    work_id: "WB2",
  };
  assert.equal(classifyRoute(mixedUpstreamDefects, {
    activation: "experiment-arm-c",
    artifact: ARTIFACT,
    criteria: ["INV55", "S56"],
    repositoryBasis: BASIS,
    workScope: scope,
  }).route, "shaping");

  const contradictory = structuredClone(base);
  contradictory.predicates.decision_only_non_code =
    predicate("decision_only_non_code", true, "incorrectly claims prose-only work");
  assert.throws(
    () => classifyRoute(contradictory, {
      activation: "experiment-arm-c",
      artifact: ARTIFACT,
      criteria: ["INV55", "S56"],
      repositoryBasis: BASIS,
      workScope: scope,
    }),
    /contradict|mutually exclusive|code_bearing.*decision_only/i,
  );

  const nonCodeLocalized = structuredClone(base);
  nonCodeLocalized.predicates.code_bearing =
    predicate("code_bearing", false, "incorrectly claims no executable behavior");
  nonCodeLocalized.predicates.localized =
    predicate("localized", true, "incorrectly claims an implementation slip");
  nonCodeLocalized.predicates.reproduced =
    predicate("reproduced", true, "reproduction");
  nonCodeLocalized.predicates.root_caused =
    predicate("root_caused", true, "root cause");
  assert.throws(
    () => classifyRoute(nonCodeLocalized, {
      activation: "experiment-arm-c",
      artifact: ARTIFACT,
      criteria: ["INV55", "S56"],
      repositoryBasis: BASIS,
      workScope: scope,
    }),
    /contradict|localized.*code|implementation slip/i,
  );

  const incomplete = structuredClone(base);
  delete incomplete.predicates.ambiguous;
  assert.throws(
    () => classifyRoute(incomplete, {
      activation: "experiment-arm-c",
      artifact: ARTIFACT,
      criteria: ["INV55", "S56"],
      repositoryBasis: BASIS,
      workScope: scope,
    }),
    /predicate.*exact|missing.*ambiguous/i,
  );
  assert.throws(
    () => classifyRoute(base, {
      activation: "surprise-activation",
      artifact: ARTIFACT,
      criteria: ["INV55", "S56"],
      repositoryBasis: BASIS,
      workScope: scope,
    }),
    /activation/i,
  );

  assert.throws(
    () => buildWorkScope({
      coverage: [{ ...scope.source_coverage[0], end_byte: 3, statement: "fix" }],
      dispatchRequest: {
        bytes: request,
        locator: "dispatch-request",
        references: [],
        revision: "request-1",
      },
      referencedSources: [],
    }),
    /gap|coverage/i,
  );

  assert.throws(
    () => buildWorkScope({
      coverage: [
        {
          disposition: "desired-behavior",
          end_byte: 1,
          reason: "first byte",
          source_id: "SRC1",
          start_byte: 0,
          statement: "fragment",
        },
        {
          disposition: "context",
          end_byte: 2,
          reason: "second byte",
          source_id: "SRC1",
          start_byte: 1,
        },
      ],
      dispatchRequest: {
        bytes: "é",
        locator: "dispatch-request",
        references: [],
        revision: "request-utf8",
      },
      referencedSources: [],
    }),
    /UTF-8 scalar boundary/i,
  );

  assert.throws(
    () => buildWorkScope({
      coverage: [
        {
          disposition: "desired-behavior",
          end_byte: Buffer.byteLength(request),
          reason: "requested outcome",
          source_id: "SRC1",
          start_byte: 0,
          statement: request,
        },
      ],
      dispatchRequest: {
        bytes: request,
        locator: "dispatch-request",
        references: [{ locator: "issue://7", revision: "edit-4" }],
        revision: "request-1",
      },
      referencedSources: [],
    }),
    /referenced.*source|request.*locator|issue:\/\/7|closed.*source/i,
  );

  const foreignCriterion = structuredClone(base);
  foreignCriterion.mappings[0].criterion_ids = ["INV-NOT-IN-ARTIFACT"];
  assert.throws(
    () => classifyRoute(foreignCriterion, {
      activation: "experiment-arm-c",
      artifact: ARTIFACT,
      criteria: ["INV55", "S56"],
      repositoryBasis: BASIS,
      workScope: scope,
    }),
    /artifact.*criterion|criterion.*set|INV-NOT-IN-ARTIFACT/i,
  );

  const untypedEvidence = structuredClone(base);
  untypedEvidence.predicates.code_bearing.evidence = ["arbitrary string"];
  assert.throws(
    () => classifyRoute(untypedEvidence, {
      activation: "experiment-arm-c",
      artifact: ARTIFACT,
      criteria: ["INV55", "S56"],
      repositoryBasis: BASIS,
      workScope: scope,
    }),
    /predicate.*evidence.*typed|structured.*evidence|evidence.*object/i,
  );
});

const HOSTS = {
  resource_defaults_version: 1,
  resource_defaults: {
    codex: {
      surfaces: ["codex-exec-non-ephemeral"],
      classes: {
        "execution-medium": "medium-1",
        "reasoning-heavy": "premium-1",
      },
      selector_capability_probe: {
        identity: "catalog-list-probe",
        operation: "catalog.list",
        response_field: "models",
        version: "1",
      },
      selector_capability_source: {
        identity: "catalog@2026-07-25",
        version: "2026-07-25",
      },
    },
  },
  pre_adoption_direct_executor: {
    codex: {
      selection_source_identity: "support-record@v4",
      selector: "premium-1",
      surface_id: "codex-exec-non-ephemeral",
    },
  },
};

test("INV42/INV43/INV51/INV57/S41/S50/S53/S58 — resource binding is context-bound and probe-backed", async () => {
  const probes = [];
  const capabilityProbe = async ({ host, selectors, surface }) => {
    probes.push(selectors);
    return {
      host,
      observed_at: "2026-07-25T12:00:00Z",
      permitted: selectors,
      probe_identity: "catalog-list-probe",
      probe_version: "1",
      requested_selectors: selectors,
      response_field: "models",
      response_field_payload: ["premium-1", "medium-1", "medium-override"],
      source_identity: "catalog@2026-07-25",
      source_version: "2026-07-25",
      surface,
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

  await assert.rejects(
    resolveResourceBinding({
      capabilityProbe,
      context: "inactive-ordinary-production",
      host: "codex",
      hostsMetadata: HOSTS,
      overrides: {},
      surface: "codex-sdk",
    }),
    /surface|pre-adoption/i,
  );

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
      capabilityProbe,
      context: "experiment-arm-c",
      host: "codex",
      hostsMetadata: HOSTS,
      overrides: {},
      surface: "codex-sdk",
    }),
    /surface|undeclared/i,
  );

  await assert.rejects(
    resolveResourceBinding({
      capabilityProbe: async ({ host, selectors }) => ({
        host,
        observed_at: "2026-07-25T12:00:00Z",
        permitted: selectors,
        probe_identity: "catalog-list-probe",
        probe_version: "1",
        requested_selectors: selectors,
        response_field: "models",
        response_field_payload: selectors,
        source_identity: "catalog@2026-07-25",
        source_version: "2026-07-25",
        surface: "codex-sdk",
      }),
      context: "experiment-arm-b",
      host: "codex",
      hostsMetadata: HOSTS,
      overrides: {},
      surface: "codex-exec-non-ephemeral",
    }),
    /surface|capability/i,
  );

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

  await assert.rejects(
    resolveResourceBinding({
      capabilityProbe: async ({ host, selectors, surface }) => ({
        host,
        permitted: selectors,
        requested_selectors: selectors,
        source_identity: "catalog@2026-07-25",
        surface,
      }),
      context: "experiment-arm-b",
      host: "codex",
      hostsMetadata: HOSTS,
      overrides: {},
      surface: "codex-exec-non-ephemeral",
    }),
    /response.field|payload|probe.*identity|source.*version|observed.*time/i,
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

  assert.throws(
    () => normalizeBillableCall(
      { input: 100 },
      {
        buckets: [
          { bucket: "input_primary", field: "input", subtract: [] },
          { bucket: "input_again", field: "input", subtract: [] },
        ],
        informational_fields: [],
      },
      { input_again: 1, input_primary: 1 },
    ),
    /source partition|field.*input.*duplicate|double/i,
  );

  assert.throws(
    () => normalizeBillableCall(
      {
        cached_input: 0,
        input: 10,
        other_billed: 5,
        output: 0,
        reasoning: 0,
        total: 15,
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
        input_uncached: 1,
        output_nonreasoning: 1,
        output_reasoning: 1,
      },
    ),
    /other_billed|unclassified provider field/i,
  );

  assert.throws(
    () => normalizeBillableCall(
      { input: 100 },
      { buckets: [], informational_fields: ["input"] },
      {},
    ),
    /bucket.*non-empty|empty.*bucket|partition/i,
  );

  assert.throws(
    () => normalizeBillableCall(
      { input: 100 },
      {
        buckets: [{ bucket: "input", field: "input", subtract: ["input"] }],
        informational_fields: [],
      },
      { input: 1 },
    ),
    /self|subtract.*source|partition/i,
  );

  assert.throws(
    () => normalizeBillableCall(
      { cached_input: 20, input: 100 },
      {
        buckets: [
          { bucket: "input_uncached", field: "input", subtract: ["cached_input"] },
        ],
        informational_fields: [],
      },
      { input_uncached: 1 },
    ),
    /cached_input|leaf|partition|unclassified/i,
  );

  assert.throws(
    () => normalizeBillableCall(
      { input: 100, output: 100 },
      {
        buckets: [
          { bucket: "input", field: "input", subtract: ["output"] },
          { bucket: "output", field: "output", subtract: ["input"] },
        ],
        informational_fields: [],
      },
      { input: 1, output: 1 },
    ),
    /cycle|acyclic|forest|partition/i,
  );

  assert.throws(
    () => normalizeBillableCall(
      { cached_input: 10, input: 100, other_input: 50 },
      {
        buckets: [
          { bucket: "cached_input", field: "cached_input", subtract: [] },
          { bucket: "input", field: "input", subtract: ["cached_input"] },
          { bucket: "other_input", field: "other_input", subtract: ["cached_input"] },
        ],
        informational_fields: [],
      },
      { cached_input: 1, input: 1, other_input: 1 },
    ),
    /shared|parent|forest|partition/i,
  );
});

function rawModelCall({ modelId, role, tokens = 0, attempt = 1 }) {
  return {
    attempt,
    elapsed_ms: 1,
    model_id: modelId,
    raw_provider_fields: {
      cached_input: 0,
      input: tokens,
      output: 0,
      reasoning: 0,
      total: tokens,
    },
    role,
  };
}

function rawResult({
  arm,
  task,
  repetition = 1,
  accepted = 1,
  blocking = 0,
  premium = 10,
  cost = 10,
  remediation = 0,
  reviewerLoops = 0,
  upstreamStatus = "valid",
  independentUpstreamFinding = null,
}) {
  const preregistration = experimentPreregistration();
  const taskRecord = [
    ...Object.values(preregistration.tasks),
    ...Object.values(preregistration.replacement_tasks),
  ].find((item) => item.task_id === task);
  assert.ok(taskRecord, `test fixture task ${task} must be preregistered`);
  const resourceBinding = preregistration.bindings[`arm_${arm.toLowerCase()}`];
  const calls = [];
  if (arm === "C") {
    calls.push(rawModelCall({
      modelId: "premium-1",
      role: "planner",
      tokens: premium,
    }));
    calls.push(rawModelCall({
      attempt: 2,
      modelId: "medium-1",
      role: "executor",
      tokens: cost - premium,
    }));
  } else {
    calls.push(rawModelCall({
      modelId: arm === "A" ? "premium-1" : "medium-1",
      role: "executor",
      tokens: cost,
    }));
  }
  for (let index = 0; index < remediation; index += 1) {
    calls.push(rawModelCall({
      attempt: calls.length + 1,
      modelId: arm === "A" ? "premium-1" : "medium-1",
      role: "executor-remediation",
    }));
  }
  calls.push(
    rawModelCall({
      attempt: calls.length + 1,
      modelId: "premium-1",
      role: "conformance-reviewer",
    }),
    rawModelCall({
      attempt: calls.length + 2,
      modelId: "premium-1",
      role: "code-reviewer",
    }),
  );
  for (let index = 0; index < reviewerLoops; index += 1) {
    calls.push(
      rawModelCall({
        attempt: calls.length + 1,
        modelId: arm === "A" ? "premium-1" : "medium-1",
        role: "reviewer-return-executor",
      }),
      rawModelCall({
        attempt: calls.length + 2,
        modelId: "premium-1",
        role: "conformance-reviewer",
      }),
      rawModelCall({
        attempt: calls.length + 3,
        modelId: "premium-1",
        role: "code-reviewer",
      }),
    );
  }
  const reviewHistory = [];
  for (let round = 1; round <= reviewerLoops + 1; round += 1) {
    const terminal = round === reviewerLoops + 1;
    reviewHistory.push(
      {
        blocking: !terminal || accepted !== 1,
        reviewer: "conformance-reviewer",
        round,
        verdict: !terminal || accepted !== 1 ? "FAIL" : "PASS",
      },
      {
        blocking: !terminal || blocking === 1 || accepted !== 1,
        reviewer: "code-reviewer",
        round,
        verdict: !terminal || blocking === 1 || accepted !== 1 ? "FAIL" : "PASS",
      },
    );
  }
  return {
    ambiguities_caught_before_implementation: [],
    arm,
    code_review_blocking_observed: blocking === 1 || reviewerLoops > 0,
    code_review_findings:
      blocking === 1 || reviewerLoops > 0 ? ["blocking code-review finding"] : [],
    command_outcomes: {
      tests: preregistration.commands.tests.map((command) => ({
        command,
        passed: accepted === 1,
      })),
      typechecks: preregistration.commands.typechecks.map((command) => ({
        command,
        passed: accepted === 1,
      })),
    },
    conformance_findings: accepted === 1 ? [] : ["conformance did not pass"],
    conformance_verdict: accepted === 1 ? "PASS" : "FAIL",
    executor_deviations: [],
    fixture_proof: {
      fixture_id: `${task}-${arm}-${repetition}`,
      fresh: true,
      isolated: true,
      repository_basis: taskRecord.repository_basis,
      spec_id: taskRecord.spec_id,
      task_id: task,
    },
    independent_upstream_finding: independentUpstreamFinding,
    invalid_packet_anchors: [],
    model_calls: calls,
    repetition,
    remediation_dispatches_by_type: {
      "executor retry": remediation,
      "planner retry": 0,
      "reviewer-return loop": reviewerLoops,
    },
    required_tests_pass: accepted === 1,
    required_typechecks_pass: accepted === 1,
    repository_basis: taskRecord.repository_basis,
    resource_binding_proof: resourceBinding,
    review_history: reviewHistory,
    task,
    terminal_code_review_blocking: accepted !== 1,
    unused_plan_steps: [],
    upstream_status: upstreamStatus,
  };
}

function analysisResult(options) {
  const run = rawResult(options);
  return {
    ...run,
    accepted_quality: run.required_tests_pass ? 1 : 0,
    blocking_finding_run: run.code_review_blocking_observed ? 1 : 0,
    measurement_valid: true,
    premium_tokens: options.premium ?? 10,
    remediation_dispatches: Object.values(run.remediation_dispatches_by_type)
      .reduce((total, count) => total + count, 0),
    total_elapsed_ms: 1,
    total_tokens: options.cost ?? 10,
    total_weighted_cost: options.cost ?? 10,
  };
}

function experimentPreregistration() {
  const task = (revision, specId, taskId) => ({
    code_bearing: true,
    repository_basis: {
      assumptions: [],
      revision,
      worktree_identity: "clean",
      worktree_kind: "clean",
      worktree_manifest: [],
    },
    revision,
    spec_id: specId,
    status: "ratified",
    task_id: taskId,
  });
  const normalization = {
    buckets: [
      { bucket: "input_uncached", field: "input", subtract: ["cached_input"] },
      { bucket: "input_cached", field: "cached_input", subtract: [] },
      { bucket: "output_nonreasoning", field: "output", subtract: ["reasoning"] },
      { bucket: "output_reasoning", field: "reasoning", subtract: [] },
    ],
    informational_fields: ["total"],
  };
  const rates = {
    input_cached: 1,
    input_uncached: 1,
    output_nonreasoning: 1,
    output_reasoning: 1,
  };
  return {
    activation: "inactive-experiment-only",
    adoption_truth_tables: {
      baseline_a: "spec-0004@v5#baseline-a-floor",
      medium_b: "spec-0004@v5#medium-b-advantage",
    },
    bindings: {
      arm_a: {
        capability_observed_at: "2026-07-25T12:00:00Z",
        capability_probe_identity: "catalog-probe@1",
        capability_response_identity: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        capability_source_identity: "catalog@2026-07-25",
        executor_model_id: "premium-1",
        host: "codex",
        premium_selector: "premium-1",
        pre_adoption_selector: "premium-1",
        reviewer_model_id: "premium-1",
        surface: "codex-exec-non-ephemeral",
      },
      arm_b: {
        capability_observed_at: "2026-07-25T12:00:00Z",
        capability_probe_identity: "catalog-probe@1",
        capability_response_identity: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        capability_source_identity: "catalog@2026-07-25",
        effective_resource_map: { "execution-medium": "medium-1" },
        executor_model_id: "medium-1",
        host: "codex",
        reviewer_model_id: "premium-1",
        surface: "codex-exec-non-ephemeral",
      },
      arm_c: {
        capability_observed_at: "2026-07-25T12:00:00Z",
        capability_probe_identity: "catalog-probe@1",
        capability_response_identity: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        capability_source_identity: "catalog@2026-07-25",
        effective_resource_map: {
          "execution-medium": "medium-1",
          "reasoning-heavy": "premium-1",
        },
        executor_model_id: "medium-1",
        host: "codex",
        planner_model_id: "premium-1",
        reviewer_model_id: "premium-1",
        surface: "codex-exec-non-ephemeral",
      },
    },
    commands: {
      tests: ["npm test --prefix tooling/grove/release"],
      typechecks: ["npm run typecheck --prefix tooling/grove/release"],
    },
    metrics: [
      "accepted_quality",
      "ambiguities_caught_before_implementation",
      "blocking_finding_run",
      "code_review_findings",
      "conformance_findings",
      "cost_per_acceptance",
      "elapsed_ms",
      "executor_deviations",
      "invalid_packet_anchors",
      "premium_tokens",
      "remediation_dispatches_by_type",
      "required_tests_pass",
      "required_typechecks_pass",
      "total_tokens",
      "total_weighted_cost",
      "unused_plan_steps",
    ],
    price_snapshot: {
      dated_identity: "provider-price@2026-07-25",
      models: {
        "medium-1": {
          normalization,
          rates,
          tier: "medium",
        },
        "premium-1": {
          normalization,
          rates,
          tier: "premium",
        },
      },
      observed_at: "2026-07-25",
    },
    randomized_order: ["small:A", "small:B", "small:C", "medium:A", "medium:B", "medium:C", "large:A", "large:B", "large:C"],
    remediation_bound: 2,
    replacement_tasks: {
      large: task("rev-l2", "spec-l2", "large-replacement"),
      medium: task("rev-m2", "spec-m2", "medium-replacement"),
      small: task("rev-s2", "spec-s2", "small-replacement"),
    },
    review_procedures: {
      code_review: "spec-0004@v5#independent-code-review",
      conformance: "spec-0004@v5#independent-conformance-review",
    },
    rules: {
      acceptance: "spec-0004@v5#accepted-quality",
      futility: "spec-0004@v5#futility",
    },
    tasks: {
      large: task("rev-l1", "spec-l1", "large"),
      medium: task("rev-m1", "spec-m1", "medium"),
      small: task("rev-s1", "spec-s1", "small"),
    },
  };
}

test("INV44/INV47/INV48/S42/S43/S45/S46 — experiment truth tables are totalized", () => {
  const phaseOne = ["small", "medium", "large"].flatMap((task) => [
    analysisResult({ arm: "A", task, accepted: 1, premium: 100, cost: 100 }),
    analysisResult({ arm: "B", task, accepted: 1, premium: 0, cost: 60, remediation: 2 }),
    analysisResult({ arm: "C", task, accepted: 1, premium: 60, cost: 70, remediation: 1 }),
  ]);
  assert.deepEqual(evaluateFutility(phaseOne), {
    complete: true,
    futile: false,
    reasons: [],
  });

  const full = [1, 2, 3].flatMap((repetition) =>
    phaseOne.map((run) => ({ ...run, repetition })),
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

  const duplicateGrid = full.map((run) => ({
    ...run,
    repetition: 1,
    task: "small",
  }));
  assert.equal(evaluateAdoption(duplicateGrid).adoption_eligible, false);
});

test("INV44/INV45/INV49/INV51/S47/S55 — harness writes only caller-supplied out-of-tree evidence and never activates", async () => {
  const evidenceRoot = await mkdtemp(path.join(tmpdir(), "grove-planning-evidence-"));
  try {
    const preregistration = experimentPreregistration();
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
      rawResult({
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
    assert.equal(outcome.results[0].total_tokens, 100);
    assert.equal(outcome.results[0].total_weighted_cost, 100);
    assert.equal(outcome.results[0].premium_tokens, 100);
    assert.equal(outcome.results[0].model_calls[0].price_identity, "provider-price@2026-07-25");
    assert.ok(Array.isArray(outcome.results[0].model_calls[0].billable_buckets));
    assert.ok(Array.isArray(outcome.results[0].code_review_findings));
    assert.ok(Array.isArray(outcome.results[0].conformance_findings));
    assert.ok(outcome.adoption.arms.A.total_tokens > 0);
    assert.ok(outcome.adoption.arms.A.elapsed_ms > 0);
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

test("INV44 — preregistration identities, metrics, and run provenance are exact", async () => {
  const preregistration = experimentPreregistration();
  for (const mutate of [
    (value) => {
      value.review_procedures.code_review = "";
    },
    (value) => {
      value.rules.acceptance = "";
    },
    (value) => {
      value.adoption_truth_tables.baseline_a = "";
    },
    (value) => {
      value.metrics = ["accepted_quality"];
    },
    (value) => {
      value.bindings.arm_a.capability_probe_identity = "";
    },
    (value) => {
      value.price_snapshot.dated_identity = "";
    },
  ]) {
    const malformed = structuredClone(preregistration);
    mutate(malformed);
    assert.throws(
      () => validateExperimentPreregistration(malformed),
      /identity|metrics|rules|truth|review|capability|price/i,
    );
  }

  const evidenceRoot = await mkdtemp(path.join(tmpdir(), "grove-planning-provenance-"));
  try {
    await assert.rejects(
      runPlanningExperiment({
        evidenceRoot,
        preregistration,
        repoRoot: REPO_ROOT,
        runCell: async ({ arm, repetition, task }) => {
          const run = rawResult({
            arm,
            repetition,
            task: task.task_id,
          });
          delete run.fixture_proof;
          return run;
        },
      }),
      /repository.*revision|worktree.*basis|fixture|resource.*proof|command.*outcome/i,
    );
  } finally {
    await rm(evidenceRoot, { recursive: true, force: true });
  }
});

test("INV44/INV45/S43 — harness binds every runner result to its requested task/arm/repetition cell", async () => {
  const evidenceRoot = await mkdtemp(path.join(tmpdir(), "grove-planning-identity-"));
  try {
    await assert.rejects(
      runPlanningExperiment({
        evidenceRoot,
        preregistration: experimentPreregistration(),
        repoRoot: REPO_ROOT,
        runCell: async ({ repetition, task }) => rawResult({
          arm: "B",
          repetition,
          task: task.task_id,
        }),
      }),
      /runner.*identity|requested.*cell|task.*arm.*repetition/i,
    );
  } finally {
    await rm(evidenceRoot, { recursive: true, force: true });
  }
});

test("INV44/INV45/S44 — model calls follow the exact arm sequence and remediation cardinality", async () => {
  const cases = [
    {
      name: "reordered treatment base",
      mutate: (run) => {
        if (run.arm === "C") {
          [run.model_calls[0], run.model_calls[1]] =
            [run.model_calls[1], run.model_calls[0]];
        }
      },
    },
    {
      name: "duplicate executor base call",
      mutate: (run) => {
        const executor = run.model_calls.find((call) => call.role === "executor");
        run.model_calls.splice(
          run.model_calls.indexOf(executor) + 1,
          0,
          structuredClone(executor),
        );
      },
    },
    {
      name: "over-budget remediation evidence",
      remediation: 2,
      mutate: (run) => {
        const firstReview = run.model_calls.findIndex(
          (call) => call.role === "conformance-reviewer",
        );
        run.model_calls.splice(firstReview, 0, rawModelCall({
          modelId: run.arm === "A" ? "premium-1" : "medium-1",
          role: "executor-remediation",
        }));
      },
    },
  ];
  for (const item of cases) {
    const evidenceRoot = await mkdtemp(path.join(tmpdir(), "grove-planning-sequence-"));
    try {
      await assert.rejects(
        runPlanningExperiment({
          evidenceRoot,
          preregistration: experimentPreregistration(),
          repoRoot: REPO_ROOT,
          runCell: async ({ arm, repetition, task }) => {
            const run = rawResult({
              arm,
              remediation: item.remediation ?? 0,
              repetition,
              task: task.task_id,
            });
            item.mutate(run);
            run.model_calls.forEach((call, index) => {
              call.attempt = index + 1;
            });
            return run;
          },
        }),
        /sequence|cardinality|duplicate|remediation|budget/i,
        item.name,
      );
    } finally {
      await rm(evidenceRoot, { recursive: true, force: true });
    }
  }
});

test("INV45/S44 — accepted review history clears every blocker through a classified loop", async () => {
  const evidenceRoot = await mkdtemp(path.join(tmpdir(), "grove-planning-review-history-"));
  const validEvidenceRoot = await mkdtemp(
    path.join(tmpdir(), "grove-planning-valid-review-history-"),
  );
  try {
    await assert.rejects(
      runPlanningExperiment({
        evidenceRoot,
        preregistration: experimentPreregistration(),
        repoRoot: REPO_ROOT,
        runCell: async ({ arm, repetition, task }) => rawResult({
          accepted: 1,
          arm,
          blocking: 1,
          repetition,
          task: task.task_id,
        }),
      }),
      /blocker|blocking.*review|reviewer-return|review.*history/i,
    );
    const outcome = await runPlanningExperiment({
      evidenceRoot: validEvidenceRoot,
      preregistration: experimentPreregistration(),
      repoRoot: REPO_ROOT,
      runCell: async ({ arm, repetition, task }) => rawResult({
        accepted: 1,
        arm,
        repetition,
        reviewerLoops: 1,
        task: task.task_id,
      }),
    });
    assert.equal(
      outcome.results.every(
        (run) => run.accepted_quality === 1
          && run.remediation_dispatches_by_type["reviewer-return loop"] === 1,
      ),
      true,
    );
  } finally {
    await rm(evidenceRoot, { recursive: true, force: true });
    await rm(validEvidenceRoot, { recursive: true, force: true });
  }
});

test("INV49/S55 — evidence containment follows filesystem identity before writing", async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "grove-planning-containment-"));
  const fakeRepo = path.join(fixtureRoot, "repo");
  const outsideAlias = path.join(fixtureRoot, "outside-alias");
  await mkdir(fakeRepo);
  await symlink(fakeRepo, outsideAlias);
  try {
    await assert.rejects(
      runPlanningExperiment({
        evidenceRoot: outsideAlias,
        preregistration: experimentPreregistration(),
        repoRoot: fakeRepo,
        runCell: async ({ arm, repetition, task }) => rawResult({
          arm,
          repetition,
          task: task.task_id,
        }),
      }),
      /outside.*repository|filesystem identity|symlink/i,
    );
    await assert.rejects(
      readFile(path.join(fakeRepo, "preregistration.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("INV49/S47/S55 — a repetition-two upstream finding replaces every completed matched cell symmetrically", async () => {
  const evidenceRoot = await mkdtemp(path.join(tmpdir(), "grove-planning-replacement-"));
  try {
    const outcome = await runPlanningExperiment({
      evidenceRoot,
      preregistration: experimentPreregistration(),
      repoRoot: REPO_ROOT,
      runCell: async ({ arm, repetition, task }) => rawResult({
        arm,
        cost: arm === "A" ? 100 : arm === "B" ? 60 : 70,
        independentUpstreamFinding:
          task.task_id === "medium" && repetition === 2 && arm === "B"
            ? "independent conformance review invalidated spec-m1"
            : null,
        premium: arm === "A" ? 100 : arm === "C" ? 60 : 0,
        remediation: arm === "B" ? 2 : arm === "C" ? 1 : 0,
        repetition,
        task: task.task_id,
        upstreamStatus:
          task.task_id === "medium" && repetition === 2 && arm === "B"
            ? "invalidated-upstream"
            : "valid",
      }),
    });
    assert.equal(outcome.results.length, 27);
    assert.equal(outcome.results.some((run) => run.task === "medium"), false);
    assert.equal(
      outcome.results.filter((run) => run.task === "medium-replacement").length,
      9,
    );
    assert.equal(outcome.invalidation_overhead.length, 6);
    assert.equal(outcome.invalidation_overhead_summary.run_count, 6);
    assert.ok(outcome.invalidation_overhead_summary.total_tokens > 0);
    assert.equal(
      outcome.invalidation_overhead.every(
        (run) => run.upstream_status === "invalidated-upstream",
      ),
      true,
    );
  } finally {
    await rm(evidenceRoot, { recursive: true, force: true });
  }
});
