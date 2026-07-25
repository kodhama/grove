import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

const UTF8 = new TextDecoder("utf-8", { fatal: true });
const PACKET_FIELDS = [
  "artifact",
  "authority",
  "code_anchors",
  "criterion_test_map",
  "outcome",
  "packet_schema",
  "repository_basis",
  "risks_and_gaps",
  "slices",
  "test_anchors",
  "verification",
  "verification_oracles",
];
const BASIS_FIELDS = [
  "assumptions",
  "revision",
  "worktree_identity",
  "worktree_kind",
  "worktree_manifest",
];
const ARTIFACT_FIELDS = ["id", "identity", "path", "status"];
const CONTEXT_CLASSES = {
  "activated-production": ["reasoning-heavy", "execution-medium"],
  "experiment-arm-b": ["execution-medium"],
  "experiment-arm-c": ["reasoning-heavy", "execution-medium"],
};
const ROUTE_ACTIVATIONS = new Set([
  "active-adoption",
  "experiment-arm-c",
  "inactive-ordinary-production",
]);
const ROUTE_PREDICATE_FIELDS = [
  "adequate_spec",
  "ambiguous",
  "code_bearing",
  "decision_only_non_code",
  "localized",
  "reproduced",
  "root_caused",
  "spec_gap",
  "wrong_decision",
];
const ROUTE_EVIDENCE_TYPES = {
  adequate_spec: "criterion-mapping",
  ambiguous: "evidence-defect",
  code_bearing: "requested-path-class",
  decision_only_non_code: "requested-path-class",
  localized: "component-boundary",
  reproduced: "reproduction",
  root_caused: "causal-trace",
  spec_gap: "exhaustive-criterion-search",
  wrong_decision: "decision-contradiction",
};
const EXPERIMENT_METRICS = [
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
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function plainObject(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function encodeString(value) {
  let output = '"';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22) output += '\\"';
    else if (code === 0x5c) output += "\\\\";
    else if (code <= 0x1f) output += `\\u00${code.toString(16).padStart(2, "0")}`;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (low < 0xdc00 || low > 0xdfff) {
        throw new Error("canonical JSON strings cannot contain an unpaired surrogate");
      }
      output += value[index] + value[index + 1];
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error("canonical JSON strings cannot contain an unpaired surrogate");
    } else output += value[index];
  }
  return `${output}"`;
}

export function canonicalJson(value) {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "string") return encodeString(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error("canonical JSON numbers must be safe base-10 integers");
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (!plainObject(value)) {
    throw new Error("canonical JSON supports only plain objects");
  }
  const keys = Object.keys(value).sort(compareUtf8);
  for (const key of keys) {
    if (!/^[\x20-\x7e]+$/.test(key)) {
      throw new Error(`canonical JSON object key must be ASCII: ${key}`);
    }
  }
  return `{${keys
    .map((key) => `${encodeString(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function parseJsonWithDuplicateDetection(text) {
  let offset = 0;
  const whitespace = /\s/;

  function skipWhitespace() {
    while (offset < text.length && whitespace.test(text[offset])) offset += 1;
  }

  function parseString() {
    const start = offset;
    if (text[offset] !== '"') throw new Error(`expected JSON string at byte ${offset}`);
    offset += 1;
    let escaped = false;
    while (offset < text.length) {
      const character = text[offset];
      offset += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') {
        try {
          return JSON.parse(text.slice(start, offset));
        } catch (error) {
          throw new Error(`invalid JSON string: ${error.message}`);
        }
      }
      if (character.charCodeAt(0) <= 0x1f) {
        throw new Error("unescaped control character in JSON string");
      }
    }
    throw new Error("unterminated JSON string");
  }

  function parseNumber() {
    const match = text.slice(offset).match(/^-?(?:0|[1-9][0-9]*)/);
    if (!match) throw new Error(`invalid JSON number at byte ${offset}`);
    offset += match[0].length;
    const number = Number(match[0]);
    if (!Number.isSafeInteger(number)) throw new Error("JSON number is not a safe integer");
    return number;
  }

  function parseArray() {
    const result = [];
    offset += 1;
    skipWhitespace();
    if (text[offset] === "]") {
      offset += 1;
      return result;
    }
    while (true) {
      result.push(parseValue());
      skipWhitespace();
      if (text[offset] === "]") {
        offset += 1;
        return result;
      }
      if (text[offset] !== ",") throw new Error(`expected array comma at byte ${offset}`);
      offset += 1;
      skipWhitespace();
    }
  }

  function parseObject() {
    const result = {};
    const seen = new Set();
    offset += 1;
    skipWhitespace();
    if (text[offset] === "}") {
      offset += 1;
      return result;
    }
    while (true) {
      const key = parseString();
      if (seen.has(key)) throw new Error(`duplicate JSON key: ${key}`);
      seen.add(key);
      skipWhitespace();
      if (text[offset] !== ":") throw new Error(`expected object colon at byte ${offset}`);
      offset += 1;
      const value = parseValue();
      result[key] = value;
      skipWhitespace();
      if (text[offset] === "}") {
        offset += 1;
        return result;
      }
      if (text[offset] !== ",") throw new Error(`expected object comma at byte ${offset}`);
      offset += 1;
      skipWhitespace();
    }
  }

  function parseValue() {
    skipWhitespace();
    if (text[offset] === '"') return parseString();
    if (text[offset] === "{") return parseObject();
    if (text[offset] === "[") return parseArray();
    if (text.startsWith("true", offset)) {
      offset += 4;
      return true;
    }
    if (text.startsWith("false", offset)) {
      offset += 5;
      return false;
    }
    if (text.startsWith("null", offset)) {
      offset += 4;
      return null;
    }
    return parseNumber();
  }

  const value = parseValue();
  skipWhitespace();
  if (offset !== text.length) throw new Error(`trailing JSON bytes at byte ${offset}`);
  return value;
}

function parseCanonicalJson(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let text;
  try {
    text = UTF8.decode(bytes);
  } catch {
    throw new Error("canonical JSON must be valid UTF-8");
  }
  if (text.startsWith("\ufeff")) throw new Error("canonical JSON must not contain a byte-order mark");
  const value = parseJsonWithDuplicateDetection(text);
  if (canonicalJson(value) !== text) {
    throw new Error("JSON byte sequence is not canonical or contains whitespace/trailing bytes");
  }
  return value;
}

function exactKeys(value, expected, label) {
  if (!plainObject(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort(compareUtf8);
  const wanted = [...expected].sort(compareUtf8);
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} fields must be exactly ${wanted.join(", ")}`);
  }
}

function equalJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function stringArray(value, label, { nonempty = false } = {}) {
  if (
    !Array.isArray(value)
    || (nonempty && value.length === 0)
    || value.some((item) => typeof item !== "string")
  ) {
    throw new Error(`${label} must be ${nonempty ? "a non-empty" : "an"} array of strings`);
  }
}

function uniqueTyped(collection, field, pattern, label) {
  const seen = new Set();
  for (const item of collection) {
    if (!pattern.test(item?.[field] ?? "")) {
      throw new Error(`${label} has an invalid ${field}: ${String(item?.[field])}`);
    }
    if (seen.has(item[field])) throw new Error(`${label} duplicates ${item[field]}`);
    seen.add(item[field]);
  }
  const sorted = [...seen].sort((left, right) => {
    const prefix = left.match(/^[A-Z]+/)[0];
    const otherPrefix = right.match(/^[A-Z]+/)[0];
    return prefix.localeCompare(otherPrefix)
      || Number(left.slice(prefix.length)) - Number(right.slice(otherPrefix.length));
  });
  if (JSON.stringify(collection.map((item) => item[field])) !== JSON.stringify(sorted)) {
    throw new Error(`${label} must sort by ${field}`);
  }
  return seen;
}

function validateArtifact(value, label = "artifact") {
  exactKeys(value, ARTIFACT_FIELDS, label);
  for (const field of ARTIFACT_FIELDS) nonEmptyString(value[field], `${label}.${field}`);
}

function validateBasis(value, label = "repository_basis") {
  exactKeys(value, BASIS_FIELDS, label);
  nonEmptyString(value.revision, `${label}.revision`);
  if (!["clean", "disclosed-dirty"].includes(value.worktree_kind)) {
    throw new Error(`${label}.worktree_kind is invalid`);
  }
  stringArray(value.assumptions, `${label}.assumptions`);
  for (const assumption of value.assumptions) {
    nonEmptyString(assumption, `${label}.assumptions entry`);
  }
  if (
    canonicalJson(value.assumptions)
    !== canonicalJson([...new Set(value.assumptions)].sort(compareUtf8))
  ) {
    throw new Error(`${label}.assumptions must be unique and sorted by UTF-8 bytes`);
  }
  if (!Array.isArray(value.worktree_manifest)) {
    throw new Error(`${label}.worktree_manifest must be an array`);
  }
  if (value.worktree_kind === "clean") {
    if (value.worktree_identity !== "clean" || value.worktree_manifest.length !== 0) {
      throw new Error(`${label} clean basis requires identity clean and an empty manifest`);
    }
  } else {
    if (!/^[0-9a-f]{64}$/.test(value.worktree_identity)) {
      throw new Error(`${label}.worktree_identity must be lowercase SHA-256`);
    }
    for (const entry of value.worktree_manifest) {
      exactKeys(
        entry,
        ["content_identity", "kind", "mode", "path", "state"],
        `${label}.worktree_manifest entry`,
      );
      nonEmptyString(entry.path, `${label}.worktree_manifest.path`);
      if (
        path.isAbsolute(entry.path)
        || path.normalize(entry.path) !== entry.path
        || entry.path.split(path.sep).includes("..")
      ) {
        throw new Error(`${label}.worktree_manifest.path must be normalized and repository-relative`);
      }
      if (!["added", "modified", "deleted"].includes(entry.state)) {
        throw new Error(`${label}.worktree_manifest.state is invalid`);
      }
      if (!["regular", "symlink", "deleted"].includes(entry.kind)) {
        throw new Error(`${label}.worktree_manifest.kind is invalid`);
      }
      if (
        entry.state === "deleted"
          ? entry.kind !== "deleted"
            || entry.mode !== "deleted"
            || entry.content_identity !== "deleted"
          : entry.kind === "deleted"
            || !["100644", "100755", "120000"].includes(entry.mode)
            || (entry.kind === "symlink") !== (entry.mode === "120000")
            || !/^[0-9a-f]{64}$/.test(entry.content_identity)
      ) {
        throw new Error(`${label}.worktree_manifest kind/state/mode/content_identity is inconsistent`);
      }
    }
    if (
      canonicalJson(value.worktree_manifest.map((entry) => entry.path))
      !== canonicalJson(
        [...new Set(value.worktree_manifest.map((entry) => entry.path))].sort(compareUtf8),
      )
    ) {
      throw new Error(`${label}.worktree_manifest entries must have unique sorted paths`);
    }
    const identity = sha256(Buffer.from(canonicalJson(value.worktree_manifest)));
    if (identity !== value.worktree_identity) {
      throw new Error(`${label}.worktree_identity does not bind its manifest`);
    }
  }
}

function validateRiskCollection(risks, criterionSet) {
  exactKeys(
    risks,
    ["ambiguities", "blockers", "risks", "scope_exclusions"],
    "risks_and_gaps",
  );
  const gaps = new Map();
  for (const [name, entries] of Object.entries(risks)) {
    if (!Array.isArray(entries)) throw new Error(`risks_and_gaps.${name} must be an array`);
    const ids = [];
    for (const entry of entries) {
      exactKeys(entry, ["blocking", "id", "text"], `risks_and_gaps.${name} entry`);
      nonEmptyString(entry.id, `${name}.id`);
      nonEmptyString(entry.text, `${name}.text`);
      if (typeof entry.blocking !== "boolean") throw new Error(`${name}.blocking must be Boolean`);
      if (
        name === "scope_exclusions"
        && [...criterionSet].some((criterion) => entry.text.includes(criterion))
      ) {
        throw new Error(`scope exclusion names artifact criterion ${entry.text}`);
      }
      if (gaps.has(entry.id)) {
        throw new Error(`risks_and_gaps duplicates gap id ${entry.id}`);
      }
      gaps.set(entry.id, { ...entry, collection: name });
      ids.push(entry.id);
    }
    if (JSON.stringify(ids) !== JSON.stringify([...ids].sort(compareUtf8))) {
      throw new Error(`risks_and_gaps.${name} must sort by id`);
    }
  }
  return gaps;
}

export function validatePlanPacket(input, {
  artifact,
  criteria,
  repositoryBasis,
}) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const packet = parseCanonicalJson(bytes);
  exactKeys(packet, PACKET_FIELDS, "packet");
  if (packet.packet_schema !== 1) throw new Error("packet_schema must equal 1");
  if (!["executable", "blocked"].includes(packet.outcome)) throw new Error("packet outcome is invalid");
  if (packet.authority !== "advisory — artifact wins") {
    throw new Error("packet authority must equal advisory — artifact wins");
  }
  validateArtifact(packet.artifact);
  validateBasis(packet.repository_basis);
  if (!equalJson(packet.artifact, artifact)) throw new Error("packet artifact identity is stale or mismatched");
  if (!equalJson(packet.repository_basis, repositoryBasis)) {
    throw new Error("packet repository basis is stale or mismatched");
  }

  const criterionSet = new Set(criteria);
  if (criterionSet.size !== criteria.length) throw new Error("artifact criteria contain duplicates");
  if (!Array.isArray(packet.criterion_test_map)) throw new Error("criterion_test_map must be an array");
  const mappedCriteria = packet.criterion_test_map.map((entry) => entry.criterion_id);
  if (
    mappedCriteria.length !== criteria.length
    || new Set(mappedCriteria).size !== criteria.length
    || [...criterionSet].some((criterion) => !mappedCriteria.includes(criterion))
  ) {
    throw new Error("criterion_test_map must cover every artifact criterion exactly once");
  }
  if (JSON.stringify(mappedCriteria) !== JSON.stringify([...mappedCriteria].sort(compareUtf8))) {
    throw new Error("criterion_test_map must sort by criterion_id");
  }

  for (const field of [
    "code_anchors",
    "slices",
    "test_anchors",
    "verification",
    "verification_oracles",
  ]) {
    if (!Array.isArray(packet[field])) throw new Error(`${field} must be an array`);
  }
  const codeIds = uniqueTyped(packet.code_anchors, "code_anchor_id", /^CA[1-9][0-9]*$/, "code_anchors");
  const testIds = uniqueTyped(packet.test_anchors, "test_anchor_id", /^TA[1-9][0-9]*$/, "test_anchors");
  const commandIds = uniqueTyped(packet.verification, "command_id", /^CMD[1-9][0-9]*$/, "verification");
  const oracleIds = uniqueTyped(packet.verification_oracles, "oracle_id", /^OR[1-9][0-9]*$/, "verification_oracles");
  const sliceIds = new Set();
  for (const slice of packet.slices) {
    exactKeys(
      slice,
      ["code_anchor_ids", "criterion_ids", "phase", "slice_id", "test_anchor_ids"],
      "slice",
    );
    if (!/^SL[1-9][0-9]*$/.test(slice.slice_id) || sliceIds.has(slice.slice_id)) {
      throw new Error(`slices contain invalid or duplicate ${slice.slice_id}`);
    }
    sliceIds.add(slice.slice_id);
    if (!["red", "green", "refactor"].includes(slice.phase)) throw new Error(`${slice.slice_id} phase is invalid`);
    stringArray(slice.criterion_ids, `${slice.slice_id}.criterion_ids`, { nonempty: true });
    stringArray(slice.code_anchor_ids, `${slice.slice_id}.code_anchor_ids`);
    stringArray(slice.test_anchor_ids, `${slice.slice_id}.test_anchor_ids`);
  }

  const commands = new Map();
  for (const command of packet.verification) {
    exactKeys(command, ["class", "command", "command_id"], "verification entry");
    if (!["test", "typecheck", "lint", "other"].includes(command.class)) {
      throw new Error(`${command.command_id} verification class is invalid`);
    }
    nonEmptyString(command.command, `${command.command_id}.command`);
    commands.set(command.command_id, command);
  }
  const tests = new Map();
  for (const anchor of packet.test_anchors) {
    exactKeys(
      anchor,
      ["command_id", "criterion_ids", "evidence", "fact_class", "path", "symbol", "test_anchor_id"],
      "test anchor",
    );
    stringArray(anchor.criterion_ids, `${anchor.test_anchor_id}.criterion_ids`, { nonempty: true });
    if (!["verified", "inferred"].includes(anchor.fact_class)) throw new Error(`${anchor.test_anchor_id} fact_class is invalid`);
    if (!commandIds.has(anchor.command_id)) throw new Error(`${anchor.test_anchor_id} command is unresolved`);
    tests.set(anchor.test_anchor_id, anchor);
  }
  for (const anchor of packet.code_anchors) {
    exactKeys(
      anchor,
      ["code_anchor_id", "evidence", "fact_class", "path", "symbol"],
      "code anchor",
    );
    if (!["verified", "inferred"].includes(anchor.fact_class)) throw new Error(`${anchor.code_anchor_id} fact_class is invalid`);
  }
  const oracles = new Map();
  for (const oracle of packet.verification_oracles) {
    exactKeys(
      oracle,
      ["basis_observation", "command_ids", "criterion_ids", "expected_result", "oracle_id"],
      "verification oracle",
    );
    stringArray(oracle.criterion_ids, `${oracle.oracle_id}.criterion_ids`, { nonempty: true });
    stringArray(oracle.command_ids, `${oracle.oracle_id}.command_ids`, { nonempty: true });
    for (const commandId of oracle.command_ids) {
      const command = commands.get(commandId);
      if (!command || command.command.startsWith("none — ")) {
        throw new Error(`${oracle.oracle_id} command ${commandId} is not real verification`);
      }
    }
    oracles.set(oracle.oracle_id, oracle);
  }

  const gaps = validateRiskCollection(packet.risks_and_gaps, criterionSet);
  const reachedCodes = new Set();
  const reachedTests = new Set();
  const reachedSlices = new Set();
  const reachedOracles = new Set();
  let implementCount = 0;
  for (const entry of packet.criterion_test_map) {
    const criterion = entry.criterion_id;
    if (entry.disposition === "implement") {
      implementCount += 1;
      exactKeys(
        entry,
        ["criterion_id", "disposition", "failing_test_ids", "slice_ids"],
        `criterion ${criterion}`,
      );
      stringArray(entry.failing_test_ids, `${criterion}.failing_test_ids`, { nonempty: true });
      stringArray(entry.slice_ids, `${criterion}.slice_ids`, { nonempty: true });
      const referencedSlices = entry.slice_ids.map((id) => {
        const slice = packet.slices.find((item) => item.slice_id === id);
        if (!slice) throw new Error(`${criterion} slice ${id} is unresolved`);
        if (!slice.criterion_ids.includes(criterion)) throw new Error(`${id} is cross-criterion`);
        reachedSlices.add(id);
        return slice;
      });
      const packetOrder = packet.slices
        .filter((slice) => slice.criterion_ids.includes(criterion))
        .map((slice) => slice.slice_id);
      if (!equalJson(entry.slice_ids, packetOrder)) {
        throw new Error(`${criterion} slices must preserve the packet's semantic phase order`);
      }
      const phases = referencedSlices.map((slice) => slice.phase);
      const firstGreen = phases.indexOf("green");
      const firstRefactor = phases.indexOf("refactor");
      if (
        phases[0] !== "red"
        || firstGreen === -1
        || phases.slice(0, firstGreen).some((phase) => phase !== "red")
        || phases.slice(firstGreen, firstRefactor === -1 ? phases.length : firstRefactor)
          .some((phase) => phase !== "green")
        || (firstRefactor !== -1
          && phases.slice(firstRefactor).some((phase) => phase !== "refactor"))
      ) {
        throw new Error(`${criterion} phases must preserve red → green → refactor order`);
      }
      for (const testId of entry.failing_test_ids) {
        const anchor = tests.get(testId);
        if (!anchor || !anchor.criterion_ids.includes(criterion)) {
          throw new Error(`${criterion} failing test ${testId} is unresolved or cross-criterion`);
        }
        const command = commands.get(anchor.command_id);
        if (command.class !== "test" || command.command.startsWith("none — ")) {
          throw new Error(`${criterion} failing test ${testId} lacks a real test command`);
        }
        if (!referencedSlices[0].test_anchor_ids.includes(testId)) {
          throw new Error(`${criterion} red slice does not reference ${testId}`);
        }
      }
    } else if (entry.disposition === "verify-only") {
      exactKeys(entry, ["criterion_id", "disposition", "oracle_id"], `criterion ${criterion}`);
      const oracle = oracles.get(entry.oracle_id);
      if (!oracle || !oracle.criterion_ids.includes(criterion)) {
        throw new Error(`${criterion} oracle ${entry.oracle_id} is unresolved or cross-criterion`);
      }
      reachedOracles.add(entry.oracle_id);
    } else if (entry.disposition === "blocked") {
      exactKeys(entry, ["criterion_id", "disposition", "gap_id"], `criterion ${criterion}`);
      if (packet.outcome !== "blocked") throw new Error(`${criterion} blocked disposition requires blocked outcome`);
      const gap = gaps.get(entry.gap_id);
      if (
        !gap
        || gap.blocking !== true
        || !["blockers", "ambiguities"].includes(gap.collection)
      ) {
        throw new Error(`${criterion} gap ${entry.gap_id} is unresolved in risks_and_gaps`);
      }
    } else {
      throw new Error(`${criterion} disposition is invalid`);
    }
  }

  for (const slice of packet.slices) {
    for (const codeId of slice.code_anchor_ids) {
      if (!codeIds.has(codeId)) throw new Error(`${slice.slice_id} code anchor ${codeId} is unresolved`);
      reachedCodes.add(codeId);
    }
    for (const testId of slice.test_anchor_ids) {
      if (!testIds.has(testId)) throw new Error(`${slice.slice_id} test anchor ${testId} is unresolved`);
      const anchor = tests.get(testId);
      if (
        anchor.criterion_ids.some((criterion) => !slice.criterion_ids.includes(criterion))
        || !slice.criterion_ids.some((criterion) => anchor.criterion_ids.includes(criterion))
      ) {
        throw new Error(`${slice.slice_id} test anchor ${testId} is cross-criterion`);
      }
      reachedTests.add(testId);
    }
  }
  for (const anchor of packet.test_anchors) {
    if (
      anchor.criterion_ids.some((criterion) => {
        const entry = packet.criterion_test_map.find((item) => item.criterion_id === criterion);
        return !entry || entry.disposition !== "implement";
      })
    ) {
      throw new Error(`${anchor.test_anchor_id} has a cross-criterion back-reference`);
    }
  }
  for (const oracle of packet.verification_oracles) {
    if (
      oracle.criterion_ids.some((criterion) => {
        const entry = packet.criterion_test_map.find((item) => item.criterion_id === criterion);
        return !entry || entry.disposition !== "verify-only";
      })
    ) {
      throw new Error(`${oracle.oracle_id} has a cross-criterion back-reference`);
    }
  }

  if (packet.outcome === "executable") {
    if (implementCount === 0) throw new Error("executable packet requires at least one implement criterion");
    if (packet.criterion_test_map.some((entry) => entry.disposition === "blocked")) {
      throw new Error("executable packet cannot contain blocked criteria");
    }
    if (
      Object.values(packet.risks_and_gaps).flat()
        .some((entry) => entry.blocking)
    ) {
      throw new Error("executable packet cannot contain a blocking gap");
    }
  } else if (
    !packet.criterion_test_map.some((entry) => entry.disposition === "blocked")
    || packet.slices.length
    || packet.code_anchors.length
    || packet.test_anchors.length
    || packet.verification_oracles.length
    || packet.verification.some((command) => command.class === "test" && !command.command.startsWith("none — "))
  ) {
    throw new Error("blocked packet must contain a blocked criterion and no executable targets");
  }

  for (const id of codeIds) if (!reachedCodes.has(id)) throw new Error(`orphan code anchor ${id}`);
  for (const id of testIds) if (!reachedTests.has(id)) throw new Error(`orphan test anchor ${id}`);
  for (const id of sliceIds) if (!reachedSlices.has(id)) throw new Error(`orphan slice ${id}`);
  for (const id of oracleIds) if (!reachedOracles.has(id)) throw new Error(`orphan oracle ${id}`);

  return { packet, sha256: sha256(bytes) };
}

export function validateCheckpoint(input, { packetBytes, checkpointBasis }) {
  const checkpoint = parseCanonicalJson(input);
  exactKeys(
    checkpoint,
    [
      "artifact",
      "checkpoint_basis",
      "checkpoint_schema",
      "completed_slice_ids",
      "completion_evidence",
      "packet_base64",
      "packet_sha256",
      "pending_verify_only_criterion_ids",
      "remaining_slice_ids",
      "repository_basis",
      "verified_criterion_ids",
    ],
    "checkpoint",
  );
  if (checkpoint.checkpoint_schema !== 1) throw new Error("checkpoint_schema must equal 1");
  validateArtifact(checkpoint.artifact, "checkpoint.artifact");
  validateBasis(checkpoint.repository_basis, "checkpoint.repository_basis");
  validateBasis(checkpoint.checkpoint_basis, "checkpoint.checkpoint_basis");
  if (!equalJson(checkpoint.checkpoint_basis, checkpointBasis)) {
    throw new Error("checkpoint basis is stale or mismatched");
  }
  if (!/^[0-9a-f]{64}$/.test(checkpoint.packet_sha256)) {
    throw new Error("checkpoint packet_sha256 is invalid");
  }
  let decoded;
  try {
    decoded = Buffer.from(checkpoint.packet_base64, "base64");
  } catch {
    throw new Error("checkpoint packet_base64 is invalid");
  }
  if (decoded.toString("base64") !== checkpoint.packet_base64) {
    throw new Error("checkpoint packet_base64 is not standard padded base64");
  }
  if (!decoded.equals(packetBytes) || sha256(decoded) !== checkpoint.packet_sha256) {
    throw new Error("checkpoint packet digest or bytes mismatch");
  }
  const packet = parseCanonicalJson(packetBytes);
  if (
    !equalJson(checkpoint.artifact, packet.artifact)
    || !equalJson(checkpoint.repository_basis, packet.repository_basis)
  ) {
    throw new Error("checkpoint artifact/original basis differs from packet");
  }
  stringArray(checkpoint.completed_slice_ids, "completed_slice_ids");
  stringArray(checkpoint.remaining_slice_ids, "remaining_slice_ids");
  const packetSliceIds = packet.slices.map((slice) => slice.slice_id);
  if (
    JSON.stringify([
      ...checkpoint.completed_slice_ids,
      ...checkpoint.remaining_slice_ids,
    ]) !== JSON.stringify(packetSliceIds)
  ) {
    throw new Error("checkpoint completed prefix and remaining suffix do not preserve packet order");
  }
  const verifyOnly = packet.criterion_test_map
    .filter((entry) => entry.disposition === "verify-only")
    .map((entry) => entry.criterion_id)
    .sort(compareUtf8);
  for (const field of ["verified_criterion_ids", "pending_verify_only_criterion_ids"]) {
    stringArray(checkpoint[field], field);
    if (JSON.stringify(checkpoint[field]) !== JSON.stringify([...checkpoint[field]].sort(compareUtf8))) {
      throw new Error(`${field} must sort by criterion id`);
    }
  }
  if (
    JSON.stringify([
      ...checkpoint.verified_criterion_ids,
      ...checkpoint.pending_verify_only_criterion_ids,
    ].sort(compareUtf8)) !== JSON.stringify(verifyOnly)
  ) {
    throw new Error("checkpoint verify-only partitions are not disjoint and exhaustive");
  }
  if (!Array.isArray(checkpoint.completion_evidence)) {
    throw new Error("completion_evidence must be an array");
  }
  const expectedEvidence = new Set([
    ...checkpoint.completed_slice_ids.map((id) => `slice\0${id}`),
    ...checkpoint.verified_criterion_ids.map((id) => `criterion\0${id}`),
  ]);
  const observedEvidence = [];
  for (const evidence of checkpoint.completion_evidence) {
    exactKeys(evidence, ["evidence", "subject_id", "subject_kind"], "completion evidence");
    if (!["slice", "criterion"].includes(evidence.subject_kind)) {
      throw new Error("completion evidence subject_kind is invalid");
    }
    const key = `${evidence.subject_kind}\0${evidence.subject_id}`;
    if (!expectedEvidence.has(key) || observedEvidence.includes(key)) {
      throw new Error(`completion evidence is unmatched or duplicate for ${evidence.subject_id}`);
    }
    observedEvidence.push(key);
  }
  if (observedEvidence.length !== expectedEvidence.size) {
    throw new Error("completion evidence does not cover every completed/verified subject");
  }
  const sortedEvidence = [...checkpoint.completion_evidence].sort((left, right) =>
    left.subject_kind.localeCompare(right.subject_kind)
      || compareUtf8(left.subject_id, right.subject_id));
  if (canonicalJson(sortedEvidence) !== canonicalJson(checkpoint.completion_evidence)) {
    throw new Error("completion evidence is not sorted");
  }
  return checkpoint;
}

export function buildWorkScope(input) {
  exactKeys(
    input,
    ["coverage", "dispatchRequest", "referencedSources"],
    "work scope input",
  );
  const { coverage, dispatchRequest, referencedSources } = input;
  exactKeys(
    dispatchRequest,
    ["bytes", "locator", "references", "revision"],
    "dispatch request",
  );
  if (!Array.isArray(referencedSources)) {
    throw new Error("work scope referencedSources must be an array");
  }
  const sources = [dispatchRequest, ...referencedSources];
  if (!Array.isArray(coverage)) throw new Error("work scope coverage must be an array");
  const requestReferences = dispatchRequest.references;
  if (!Array.isArray(requestReferences)) {
    throw new Error("dispatch request references must be an array");
  }
  for (const reference of requestReferences) {
    exactKeys(reference, ["locator", "revision"], "dispatch request reference");
    nonEmptyString(reference.locator, "dispatch request reference.locator");
    nonEmptyString(reference.revision, "dispatch request reference.revision");
  }
  const orderedReferences = [...requestReferences].sort((left, right) =>
    compareUtf8(left.locator, right.locator)
      || compareUtf8(left.revision, right.revision));
  if (
    !equalJson(requestReferences, orderedReferences)
    || new Set(requestReferences.map(
      ({ locator, revision }) => `${locator}\0${revision}`,
    )).size !== requestReferences.length
  ) {
    throw new Error("dispatch request references must be unique and sorted");
  }
  const orderedInputs = [
    dispatchRequest,
    ...[...referencedSources].sort((left, right) =>
      compareUtf8(left.locator, right.locator)
      || compareUtf8(left.revision, right.revision)),
  ];
  for (const source of orderedInputs) {
    exactKeys(
      source,
      source === dispatchRequest
        ? ["bytes", "locator", "references", "revision"]
        : ["bytes", "locator", "revision"],
      "work scope source",
    );
  }
  const suppliedReferences = orderedInputs.slice(1).map(({ locator, revision }) => ({
    locator,
    revision,
  }));
  if (!equalJson(suppliedReferences, requestReferences)) {
    throw new Error("work scope sources must exactly match every dispatch-request referenced locator/revision");
  }
  const sourceRecords = orderedInputs.map((source, index) => {
    nonEmptyString(source.locator, "source.locator");
    nonEmptyString(source.revision, "source.revision");
    const bytes = Buffer.isBuffer(source.bytes) ? source.bytes : Buffer.from(source.bytes);
    try {
      UTF8.decode(bytes);
    } catch {
      throw new Error(`source ${source.locator} is invalid UTF-8`);
    }
    return {
      byte_length: bytes.length,
      bytes_base64: bytes.toString("base64"),
      locator: source.locator,
      revision: source.revision,
      sha256: sha256(bytes),
      source_id: `SRC${index + 1}`,
    };
  });
  const sourceCoverage = [];
  const workItems = [];
  const coverageSummary = [];
  for (const source of sourceRecords) {
    const sourceBytes = Buffer.from(source.bytes_base64, "base64");
    const sourceText = UTF8.decode(sourceBytes);
    const scalarBoundaries = new Set([0]);
    let scalarOffset = 0;
    for (const scalar of sourceText) {
      scalarOffset += Buffer.byteLength(scalar);
      scalarBoundaries.add(scalarOffset);
    }
    const intervals = coverage
      .filter((item) => item.source_id === source.source_id)
      .sort((left, right) => left.start_byte - right.start_byte);
    let cursor = 0;
    for (const interval of intervals) {
      if (
        interval.start_byte !== cursor
        || !Number.isInteger(interval.end_byte)
        || interval.end_byte <= interval.start_byte
        || interval.end_byte > source.byte_length
      ) {
        throw new Error(`source ${source.source_id} coverage has a gap, overlap, or invalid range`);
      }
      if (
        !scalarBoundaries.has(interval.start_byte)
        || !scalarBoundaries.has(interval.end_byte)
      ) {
        throw new Error(`source ${source.source_id} coverage boundary is not a UTF-8 scalar boundary`);
      }
      if (!["desired-behavior", "context"].includes(interval.disposition)) {
        throw new Error(`source ${source.source_id} coverage disposition is invalid`);
      }
      nonEmptyString(interval.reason, "coverage.reason");
      const record = {
        disposition: interval.disposition,
        end_byte: interval.end_byte,
        reason: interval.reason,
        source_id: source.source_id,
        start_byte: interval.start_byte,
      };
      sourceCoverage.push(record);
      if (interval.disposition === "desired-behavior") {
        nonEmptyString(interval.statement, "desired behavior statement");
        const bytes = sourceBytes.subarray(interval.start_byte, interval.end_byte);
        const statement = UTF8.decode(bytes);
        if (statement !== interval.statement) {
          throw new Error(`source ${source.source_id} desired behavior statement does not match its bytes`);
        }
        workItems.push({
          end_byte: interval.end_byte,
          source_id: source.source_id,
          start_byte: interval.start_byte,
          statement: interval.statement,
          text_sha256: sha256(bytes),
          work_id: `WB${workItems.length + 1}`,
        });
      }
      cursor = interval.end_byte;
    }
    if (cursor !== source.byte_length) {
      throw new Error(`source ${source.source_id} coverage is not gap-free`);
    }
    const sourceIntervals = sourceCoverage.filter(
      (interval) => interval.source_id === source.source_id,
    );
    coverageSummary.push({
      classified_bytes: cursor,
      context_intervals: sourceIntervals.filter(
        (interval) => interval.disposition === "context",
      ).length,
      desired_behavior_intervals: sourceIntervals.filter(
        (interval) => interval.disposition === "desired-behavior",
      ).length,
      source_id: source.source_id,
      work_ids: workItems
        .filter((item) => item.source_id === source.source_id)
        .map((item) => item.work_id),
    });
  }
  if (coverage.length !== sourceCoverage.length) {
    throw new Error("coverage names an unknown or duplicate source interval");
  }
  const identityBytes = Buffer.from(canonicalJson({
    source_coverage: sourceCoverage,
    sources: sourceRecords,
    work_items: workItems,
  }));
  return {
    coverage_summary: coverageSummary,
    source_coverage: sourceCoverage,
    sources: sourceRecords,
    work_items: workItems,
    work_scope_identity: sha256(identityBytes),
  };
}

export function classifyRoute(
  record,
  {
    activation,
    artifact,
    criteria,
    repositoryBasis,
    workScope,
  },
) {
  if (!plainObject(record) || !plainObject(record.predicates)) {
    throw new Error("route classification record is invalid");
  }
  exactKeys(
    record,
    [
      "artifact",
      "classification_schema",
      "mappings",
      "predicates",
      "repository_basis",
      "requested_path_classes",
      "work_items",
      "work_scope_identity",
    ],
    "route classification",
  );
  if (record.classification_schema !== 1) {
    throw new Error("route classification_schema must equal 1");
  }
  validateArtifact(record.artifact, "route artifact");
  validateBasis(record.repository_basis, "route repository_basis");
  if (!equalJson(record.artifact, artifact)) {
    throw new Error("route artifact identity is stale or mismatched");
  }
  if (!equalJson(record.repository_basis, repositoryBasis)) {
    throw new Error("route repository basis is stale or mismatched");
  }
  if (
    !plainObject(workScope)
    || record.work_scope_identity !== workScope.work_scope_identity
    || !equalJson(record.work_items, workScope.work_items)
  ) {
    throw new Error("route work-scope identity or ordered work items are stale");
  }
  stringArray(criteria, "artifact criteria", { nonempty: true });
  const artifactCriteria = new Set(criteria);
  if (
    artifactCriteria.size !== criteria.length
  ) {
    throw new Error("artifact criteria must be unique");
  }
  stringArray(record.requested_path_classes, "requested_path_classes", { nonempty: true });
  if (
    canonicalJson(record.requested_path_classes)
    !== canonicalJson([...new Set(record.requested_path_classes)].sort(compareUtf8))
  ) {
    throw new Error("requested_path_classes must be unique and sorted");
  }
  const workIds = record.work_items.map((item) => item.work_id);
  if (
    !Array.isArray(record.mappings)
    || record.mappings.length !== workIds.length
    || new Set(record.mappings.map((item) => item.work_id)).size !== workIds.length
    || workIds.some((id) => !record.mappings.some((item) => item.work_id === id))
  ) {
    throw new Error("route classification must map every work id exactly once");
  }
  const p = record.predicates;
  exactKeys(p, ROUTE_PREDICATE_FIELDS, "route predicates");
  const predicateValues = {};
  const predicateEvidence = {};
  const validSubjectIds = (subjectIds, label) => {
    stringArray(subjectIds, `${label}.subject_ids`, { nonempty: true });
    if (
      new Set(subjectIds).size !== subjectIds.length
      || !equalJson(subjectIds, [...subjectIds].sort(compareUtf8))
      || subjectIds.some((id) => !workIds.includes(id))
    ) {
      throw new Error(`${label}.subject_ids must be unique, sorted, and bind known work ids`);
    }
  };
  const validStringSet = (values, label, { nonempty = true } = {}) => {
    stringArray(values, label, { nonempty });
    if (
      new Set(values).size !== values.length
      || !equalJson(values, [...values].sort(compareUtf8))
    ) {
      throw new Error(`${label} must be unique and sorted`);
    }
  };
  const validateEvidence = (field, item) => {
    const label = `route predicate ${field} evidence`;
    if (!plainObject(item) || item.evidence_type !== ROUTE_EVIDENCE_TYPES[field]) {
      throw new Error(`${label} must use its predicate-specific evidence type`);
    }
    if (field === "adequate_spec") {
      exactKeys(item, ["criterion_ids", "evidence_type", "subject_ids"], label);
      validSubjectIds(item.subject_ids, label);
      validStringSet(item.criterion_ids, `${label}.criterion_ids`);
      if (item.criterion_ids.some((id) => !artifactCriteria.has(id))) {
        throw new Error(`${label} names a criterion outside the artifact`);
      }
    } else if (field === "ambiguous") {
      exactKeys(item, ["defect", "evidence_type", "subject_ids"], label);
      validSubjectIds(item.subject_ids, label);
      nonEmptyString(item.defect, `${label}.defect`);
    } else if (field === "code_bearing" || field === "decision_only_non_code") {
      exactKeys(item, ["evidence_type", "path_classes", "subject_ids"], label);
      validSubjectIds(item.subject_ids, label);
      validStringSet(item.path_classes, `${label}.path_classes`);
      if (item.path_classes.some((pathClass) =>
        !record.requested_path_classes.includes(pathClass))) {
        throw new Error(`${label} path classes must come from requested_path_classes`);
      }
    } else if (field === "localized") {
      exactKeys(
        item,
        [
          "component",
          "evidence_type",
          "excluded_change_classes",
          "regression_test_target",
          "subject_ids",
        ],
        label,
      );
      validSubjectIds(item.subject_ids, label);
      nonEmptyString(item.component, `${label}.component`);
      if (
        !equalJson(item.excluded_change_classes, [
          "artifact",
          "cross-component",
          "dispatch",
          "public-interface",
          "schema",
        ])
      ) {
        throw new Error(`${label} must rule out every non-local change class`);
      }
      exactKeys(
        item.regression_test_target,
        ["path", "symbol"],
        `${label}.regression_test_target`,
      );
      nonEmptyString(item.regression_test_target.path, `${label}.regression_test_target.path`);
      nonEmptyString(item.regression_test_target.symbol, `${label}.regression_test_target.symbol`);
    } else if (field === "reproduced") {
      exactKeys(
        item,
        [
          "command",
          "evidence_type",
          "failing_observation",
          "repository_basis",
          "subject_ids",
        ],
        label,
      );
      validSubjectIds(item.subject_ids, label);
      nonEmptyString(item.command, `${label}.command`);
      nonEmptyString(item.failing_observation, `${label}.failing_observation`);
      validateBasis(item.repository_basis, `${label}.repository_basis`);
      if (!equalJson(item.repository_basis, repositoryBasis)) {
        throw new Error(`${label} repository basis is stale or mismatched`);
      }
    } else if (field === "root_caused") {
      exactKeys(
        item,
        [
          "anchors",
          "causal_trace",
          "contrary_contract_gap_ruled_out",
          "evidence_type",
          "subject_ids",
        ],
        label,
      );
      validSubjectIds(item.subject_ids, label);
      nonEmptyString(item.causal_trace, `${label}.causal_trace`);
      if (
        !Array.isArray(item.anchors)
        || item.anchors.length === 0
        || item.anchors.some((anchor) => {
          try {
            exactKeys(anchor, ["path", "symbol"], `${label}.anchor`);
            nonEmptyString(anchor.path, `${label}.anchor.path`);
            nonEmptyString(anchor.symbol, `${label}.anchor.symbol`);
            return false;
          } catch {
            return true;
          }
        })
        || item.contrary_contract_gap_ruled_out !== true
      ) {
        throw new Error(`${label} requires exact file/symbol anchors and a ruled-out contract gap`);
      }
    } else if (field === "spec_gap") {
      exactKeys(item, ["criterion_ids", "evidence_type", "subject_ids"], label);
      validSubjectIds(item.subject_ids, label);
      validStringSet(item.criterion_ids, `${label}.criterion_ids`);
      if (!equalJson(item.criterion_ids, [...artifactCriteria].sort(compareUtf8))) {
        throw new Error(`${label} must retain the exhaustive artifact criterion search`);
      }
    } else if (field === "wrong_decision") {
      exactKeys(
        item,
        ["clause", "decision_id", "evidence_type", "subject_ids"],
        label,
      );
      validSubjectIds(item.subject_ids, label);
      nonEmptyString(item.decision_id, `${label}.decision_id`);
      nonEmptyString(item.clause, `${label}.clause`);
    }
  };
  for (const field of ROUTE_PREDICATE_FIELDS) {
    exactKeys(
      p[field],
      ["evidence", "missing_evidence_reason", "value"],
      `route predicate ${field}`,
    );
    if (
      typeof p[field].value !== "boolean"
      || !Array.isArray(p[field].evidence)
      || p[field].evidence.some((item) => {
        try {
          validateEvidence(field, item);
          return false;
        } catch {
          return true;
        }
      })
      || (p[field].value
        ? p[field].evidence.length === 0 || p[field].missing_evidence_reason !== null
        : p[field].evidence.length !== 0
          || typeof p[field].missing_evidence_reason !== "string"
          || p[field].missing_evidence_reason.length === 0)
    ) {
      throw new Error(`route predicate ${field} lacks closed structured typed evidence or missing-evidence reason`);
    }
    predicateValues[field] = p[field].value;
    predicateEvidence[field] = p[field].evidence;
  }
  if (!ROUTE_ACTIVATIONS.has(activation)) {
    throw new Error(`route activation is invalid: ${String(activation)}`);
  }
  for (const mapping of record.mappings) {
    nonEmptyString(mapping.work_id, "route mapping work_id");
    if (mapping.result === "criteria") {
      exactKeys(mapping, ["criterion_ids", "result", "work_id"], "route mapping");
      stringArray(mapping.criterion_ids, "route mapping criterion_ids", { nonempty: true });
      if (
        new Set(mapping.criterion_ids).size !== mapping.criterion_ids.length
        || mapping.criterion_ids.some((criterion) => !artifactCriteria.has(criterion))
      ) {
        throw new Error(`route mapping ${mapping.work_id} names a criterion outside the artifact criterion set`);
      }
    } else if (mapping.result === "wrong_decision") {
      exactKeys(mapping, ["clause", "decision_id", "result", "work_id"], "route mapping");
      nonEmptyString(mapping.decision_id, "route mapping decision_id");
      nonEmptyString(mapping.clause, "route mapping clause");
    } else if (mapping.result === "spec_gap") {
      exactKeys(
        mapping,
        ["exhaustive_criterion_search", "result", "work_id"],
        "route mapping",
      );
      stringArray(
        mapping.exhaustive_criterion_search,
        "route mapping exhaustive_criterion_search",
        { nonempty: true },
      );
      if (
        new Set(mapping.exhaustive_criterion_search).size
          !== mapping.exhaustive_criterion_search.length
        ||
        !equalJson(
          [...new Set(mapping.exhaustive_criterion_search)].sort(compareUtf8),
          [...artifactCriteria].sort(compareUtf8),
        )
      ) {
        throw new Error(`${mapping.work_id} spec-gap search must cover the complete artifact criterion set`);
      }
    } else if (mapping.result === "ambiguous") {
      exactKeys(mapping, ["reason", "result", "work_id"], "route mapping");
      nonEmptyString(mapping.reason, "route mapping reason");
    } else {
      throw new Error(`route mapping result is invalid for ${mapping.work_id}`);
    }
  }
  if (
    predicateValues.adequate_spec
    && record.mappings.some((mapping) => mapping.result !== "criteria")
  ) {
    throw new Error("adequate_spec requires criterion mappings for every work id");
  }
  if (
    predicateValues.wrong_decision
    && !record.mappings.some((mapping) => mapping.result === "wrong_decision")
  ) {
    throw new Error("wrong_decision lacks a matching work-id mapping");
  }
  if (
    predicateValues.spec_gap
    && !record.mappings.some((mapping) => mapping.result === "spec_gap")
  ) {
    throw new Error("spec_gap lacks a matching work-id mapping");
  }
  if (
    predicateValues.ambiguous
    && !record.mappings.some((mapping) => mapping.result === "ambiguous")
  ) {
    throw new Error("ambiguous lacks a matching work-id mapping");
  }
  for (const [field, mappingResult] of [
    ["wrong_decision", "wrong_decision"],
    ["spec_gap", "spec_gap"],
    ["ambiguous", "ambiguous"],
  ]) {
    if (predicateValues[field]) {
      const mappedWorkIds = record.mappings
        .filter((mapping) => mapping.result === mappingResult)
        .map((mapping) => mapping.work_id);
      const evidencedWorkIds = new Set(
        predicateEvidence[field].flatMap((evidence) => evidence.subject_ids),
      );
      if (mappedWorkIds.some((workId) => !evidencedWorkIds.has(workId))) {
        throw new Error(`${field} evidence must bind every mapped work id`);
      }
    }
  }
  for (const field of [
    "adequate_spec",
    "decision_only_non_code",
    "localized",
    "reproduced",
    "root_caused",
  ]) {
    if (predicateValues[field]) {
      const evidencedWorkIds = new Set(
        predicateEvidence[field].flatMap((evidence) => evidence.subject_ids),
      );
      if (workIds.some((workId) => !evidencedWorkIds.has(workId))) {
        throw new Error(`${field} evidence must bind every work id`);
      }
    }
  }
  if (predicateValues.adequate_spec) {
    for (const mapping of record.mappings) {
      const evidencedCriteria = new Set(
        predicateEvidence.adequate_spec
          .filter((evidence) => evidence.subject_ids.includes(mapping.work_id))
          .flatMap((evidence) => evidence.criterion_ids),
      );
      if (mapping.criterion_ids.some((criterion) => !evidencedCriteria.has(criterion))) {
        throw new Error(
          "adequate_spec evidence must bind every mapped work id to its exact criteria",
        );
      }
    }
  }
  if (predicateValues.wrong_decision) {
    for (const mapping of record.mappings.filter(
      (item) => item.result === "wrong_decision",
    )) {
      if (!predicateEvidence.wrong_decision.some(
        (evidence) =>
          evidence.subject_ids.includes(mapping.work_id)
          && evidence.decision_id === mapping.decision_id
          && evidence.clause === mapping.clause,
      )) {
        throw new Error("wrong_decision evidence must match the exact decision and clause");
      }
    }
  }
  if (predicateValues.spec_gap) {
    for (const mapping of record.mappings.filter(
      (item) => item.result === "spec_gap",
    )) {
      if (!predicateEvidence.spec_gap.some(
        (evidence) =>
          evidence.subject_ids.includes(mapping.work_id)
          && equalJson(evidence.criterion_ids, mapping.exhaustive_criterion_search),
      )) {
        throw new Error("spec_gap evidence must match the exhaustive mapped criterion search");
      }
    }
  }
  const executablePathClasses = new Set([
    "build",
    "package",
    "runtime",
    "source",
    "test",
    "tests",
  ]);
  const hasExplicitExecutablePath = record.requested_path_classes.some(
    (pathClass) => executablePathClasses.has(pathClass),
  );
  const allDecisionOnlyPaths = record.requested_path_classes.every(
    (pathClass) => ["metadata", "prose"].includes(pathClass),
  );
  if (
    (hasExplicitExecutablePath && !predicateValues.code_bearing)
    || (predicateValues.decision_only_non_code && !allDecisionOnlyPaths)
  ) {
    throw new Error(
      "requested_path_classes contradict the code_bearing or decision_only_non_code predicate",
    );
  }
  if (predicateValues.code_bearing) {
    const evidencedClasses = new Set(
      predicateEvidence.code_bearing.flatMap((evidence) => evidence.path_classes),
    );
    if (
      !record.requested_path_classes.some((pathClass) => evidencedClasses.has(pathClass))
    ) {
      throw new Error("code_bearing evidence must bind a requested path class");
    }
  }
  if (predicateValues.decision_only_non_code) {
    const evidencedClasses = new Set(
      predicateEvidence.decision_only_non_code.flatMap(
        (evidence) => evidence.path_classes,
      ),
    );
    if (record.requested_path_classes.some((pathClass) => !evidencedClasses.has(pathClass))) {
      throw new Error("decision_only_non_code evidence must bind every requested path class");
    }
  }
  const selected = (precedence, route) => ({
    classification: {
      ...record,
      route_result: route,
      selected_precedence: precedence,
    },
    precedence,
    route,
  });
  const pValue = predicateValues;
  if (
    (pValue.code_bearing && pValue.decision_only_non_code)
    || (pValue.decision_only_non_code
      && (pValue.adequate_spec
        || pValue.reproduced
        || pValue.root_caused
        || pValue.localized))
    || (pValue.localized
      && (!pValue.code_bearing
        || !pValue.adequate_spec
        || !pValue.reproduced
        || !pValue.root_caused))
    || (pValue.root_caused && !pValue.reproduced)
    || (pValue.adequate_spec
      && (pValue.wrong_decision || pValue.spec_gap || pValue.ambiguous))
  ) {
    throw new Error("route predicates contain contradictory or mutually exclusive state");
  }
  if (pValue.wrong_decision) return selected(1, "shaping");
  if (pValue.spec_gap) return selected(2, "spec-reconvergence");
  if (pValue.ambiguous || (!pValue.adequate_spec && !pValue.decision_only_non_code)) {
    return selected(3, "fail-closed-ambiguous");
  }
  if (pValue.decision_only_non_code) return selected(4, "direct-executor-decision");
  if (
    pValue.adequate_spec
    && pValue.reproduced
    && pValue.root_caused
    && pValue.localized
  ) {
    return selected(5, "direct-executor-localized-slip");
  }
  if (pValue.adequate_spec && pValue.code_bearing) {
    if (activation === "experiment-arm-c" || activation === "active-adoption") {
      return selected(6, "implementation-planner");
    }
    return selected(6, "direct-executor-pre-adoption");
  }
  return selected(7, "fail-closed-unclassified");
}

function validateOverrides(overrides, hostsMetadata) {
  if (!plainObject(overrides)) throw new Error("resource overrides must be an object");
  const knownHosts = new Set(Object.keys(hostsMetadata.resource_defaults ?? {}));
  for (const [host, classes] of Object.entries(overrides)) {
    if (!knownHosts.has(host) || !plainObject(classes)) {
      throw new Error(`unknown resource override host ${host}`);
    }
    for (const key of Object.keys(classes)) {
      if (!["reasoning-heavy", "execution-medium"].includes(key)) {
        throw new Error(`unknown resource class ${key}`);
      }
    }
  }
}

async function probeSelectors({ capabilityProbe, defaults, host, selectors, surface }) {
  if (
    !plainObject(defaults.selector_capability_source)
    || !plainObject(defaults.selector_capability_probe)
  ) {
    throw new Error(`resource capability source/probe is unavailable for ${host}/${surface}`);
  }
  const result = await capabilityProbe({
    host,
    probe: defaults.selector_capability_probe,
    selectors,
    source: defaults.selector_capability_source,
    surface,
  });
  exactKeys(
    result,
    [
      "host",
      "observed_at",
      "permitted",
      "probe_identity",
      "probe_version",
      "requested_selectors",
      "response_field",
      "response_field_payload",
      "source_identity",
      "source_version",
      "surface",
    ],
    "resource capability probe result",
  );
  if (
    !plainObject(result)
    || result.source_identity !== defaults.selector_capability_source.identity
    || result.source_version !== defaults.selector_capability_source.version
    || result.probe_identity !== defaults.selector_capability_probe.identity
    || result.probe_version !== defaults.selector_capability_probe.version
    || result.response_field !== defaults.selector_capability_probe.response_field
    || result.host !== host
    || result.surface !== surface
    || !equalJson(result.requested_selectors, selectors)
    || !Array.isArray(result.response_field_payload)
    || selectors.some((selector) => !result.response_field_payload.includes(selector))
    || typeof result.observed_at !== "string"
    || Number.isNaN(Date.parse(result.observed_at))
    || !Array.isArray(result.permitted)
    || selectors.some((selector) => !result.permitted.includes(selector))
  ) {
    throw new Error(`resource capability probe did not prove every selector for ${host}/${surface}`);
  }
  return result;
}

export async function resolveResourceBinding({
  armAPremiumSelector,
  capabilityProbe,
  context,
  host,
  hostsMetadata,
  overrides = {},
  surface,
}) {
  validateOverrides(overrides, hostsMetadata);
  const baseline = hostsMetadata.pre_adoption_direct_executor?.[host];
  if (!baseline || typeof baseline.selector !== "string") {
    throw new Error(`missing pre-adoption direct executor for ${host}`);
  }
  if (baseline.surface_id !== surface) {
    throw new Error(
      `requested surface ${surface} does not match pre-adoption surface ${String(baseline.surface_id)}`,
    );
  }
  if (context === "inactive-ordinary-production") {
    return {
      binding_context: context,
      executor: baseline.selector,
      planner: null,
      selection_source_identity: baseline.selection_source_identity,
    };
  }
  const defaults = hostsMetadata.resource_defaults?.[host];
  if (
    !defaults
    || !Array.isArray(defaults.surfaces)
    || !defaults.surfaces.includes(surface)
  ) {
    throw new Error(`resource binding surface ${surface} is undeclared for host ${host}`);
  }
  if (context === "experiment-arm-a") {
    if (armAPremiumSelector !== baseline.selector) {
      throw new Error("arm A selector must equal the pre-adoption baseline");
    }
    const capability = await probeSelectors({
      capabilityProbe,
      defaults,
      host,
      selectors: [armAPremiumSelector],
      surface,
    });
    return {
      binding_context: context,
      capability,
      executor: armAPremiumSelector,
      planner: null,
      selection_source_identity: baseline.selection_source_identity,
    };
  }
  const required = CONTEXT_CLASSES[context];
  if (!required) throw new Error(`unknown resource binding context ${context}`);
  if (!defaults || !plainObject(defaults.classes)) {
    throw new Error(`missing resource defaults for ${host}`);
  }
  const effective = {};
  for (const resourceClass of required) {
    const selector = overrides[host]?.[resourceClass] ?? defaults.classes[resourceClass];
    if (typeof selector !== "string" || selector.length === 0) {
      throw new Error(`missing resource class ${resourceClass} for ${host}`);
    }
    effective[resourceClass] = selector;
  }
  const selectors = [...new Set(Object.values(effective))];
  const capability = await probeSelectors({
    capabilityProbe,
    defaults,
    host,
    selectors,
    surface,
  });
  return {
    binding_context: context,
    capability,
    defaults_version: hostsMetadata.resource_defaults_version,
    effective_map: effective,
    executor: effective["execution-medium"],
    overrides_used: overrides[host] ?? {},
    planner: effective["reasoning-heavy"] ?? null,
  };
}

export function normalizeBillableCall(raw, normalization, rates) {
  if (!plainObject(raw) || !plainObject(normalization) || !Array.isArray(normalization.buckets)) {
    throw new Error("token normalization input is invalid");
  }
  if (normalization.buckets.length === 0) {
    throw new Error("token normalization requires a non-empty bucket partition");
  }
  const billable = [];
  const bucketNames = new Set();
  const sourceFields = new Set();
  const partitionFields = new Set();
  const parents = new Map();
  const children = new Map();
  if (
    !Array.isArray(normalization.informational_fields)
    || normalization.informational_fields.some((field) => typeof field !== "string")
    || new Set(normalization.informational_fields).size
      !== normalization.informational_fields.length
  ) {
    throw new Error("token normalization informational fields are invalid or duplicated");
  }
  for (const rule of normalization.buckets) {
    if (plainObject(rule) && rule.subtract?.includes(rule.field)) {
      throw new Error(`token bucket ${String(rule.bucket)} cannot subtract its own source field`);
    }
    if (
      !plainObject(rule)
      || typeof rule.bucket !== "string"
      || rule.bucket.length === 0
      || typeof rule.field !== "string"
      || rule.field.length === 0
      || !Array.isArray(rule.subtract)
      || rule.subtract.some((field) => typeof field !== "string" || field.length === 0)
      || new Set(rule.subtract).size !== rule.subtract.length
      || bucketNames.has(rule.bucket)
    ) {
      throw new Error("token normalization bucket rule is invalid or duplicated");
    }
    bucketNames.add(rule.bucket);
    if (sourceFields.has(rule.field)) {
      throw new Error(`token source partition field ${rule.field} is duplicated`);
    }
    sourceFields.add(rule.field);
    partitionFields.add(rule.field);
    children.set(rule.field, rule.subtract);
    for (const field of rule.subtract) {
      if (parents.has(field)) {
        throw new Error(
          `token partition field ${field} has shared parents ${parents.get(field)} and ${rule.field}`,
        );
      }
      parents.set(field, rule.field);
    }
    const source = raw[rule.field];
    if (!Number.isSafeInteger(source) || source < 0) {
      throw new Error(`token field ${rule.field} is missing or invalid`);
    }
    let count = source;
    for (const field of rule.subtract) {
      partitionFields.add(field);
      if (!Number.isSafeInteger(raw[field]) || raw[field] < 0) {
        throw new Error(`token subtraction field ${field} is missing or invalid`);
      }
      count -= raw[field];
    }
    if (count < 0) throw new Error(`token partition produces a negative residual for ${rule.bucket}`);
    const rate = rates[rule.bucket];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0) {
      throw new Error(`missing priced bucket ${rule.bucket}`);
    }
    billable.push({ bucket: rule.bucket, count, rate });
  }
  const informational = new Set(normalization.informational_fields);
  const missingLeafFields = [...partitionFields].filter(
    (field) => !sourceFields.has(field),
  );
  if (missingLeafFields.length > 0) {
    throw new Error(
      `token partition lacks leaf buckets for ${missingLeafFields.sort(compareUtf8).join(", ")}`,
    );
  }
  const visitState = new Map();
  const visit = (field) => {
    if (visitState.get(field) === "visiting") {
      throw new Error(`token partition contains a cycle at ${field}; expected an acyclic forest`);
    }
    if (visitState.get(field) === "visited") return;
    visitState.set(field, "visiting");
    for (const child of children.get(field) ?? []) visit(child);
    visitState.set(field, "visited");
  };
  for (const field of sourceFields) visit(field);
  if ([...informational].some((field) => partitionFields.has(field))) {
    throw new Error("token normalization informational fields cannot overlap billable fields");
  }
  for (const field of informational) {
    if (!Number.isSafeInteger(raw[field]) || raw[field] < 0) {
      throw new Error(`informational token field ${field} is missing or invalid`);
    }
  }
  const declaredFields = new Set([...partitionFields, ...informational]);
  const unknownFields = Object.keys(raw).filter((field) => !declaredFields.has(field));
  if (unknownFields.length > 0) {
    throw new Error(`unclassified provider field ${unknownFields.sort(compareUtf8).join(", ")}`);
  }
  if (
    canonicalJson([...Object.keys(rates)].sort(compareUtf8))
    !== canonicalJson([...bucketNames].sort(compareUtf8))
  ) {
    throw new Error("priced token buckets must exactly match normalized leaf buckets");
  }
  const totalTokens = billable.reduce((total, item) => total + item.count, 0);
  return {
    billable_buckets: billable,
    informational: Object.fromEntries(
      (normalization.informational_fields ?? []).map((field) => [field, raw[field]]),
    ),
    total_tokens: totalTokens,
    weighted_cost: billable.reduce(
      (total, item) => total + item.count * item.rate,
      0,
    ),
  };
}

function validAnalysisRuns(runs) {
  return runs.filter((run) =>
    run.upstream_status === "valid" && run.measurement_valid === true);
}

function groupByTaskAndArm(runs) {
  const grouped = new Map();
  for (const run of runs) grouped.set(`${run.task}\0${run.arm}\0${run.repetition}`, run);
  return grouped;
}

export function evaluateFutility(runs) {
  const valid = validAnalysisRuns(runs);
  const tasks = [...new Set(valid.map((run) => run.task))].sort(compareUtf8);
  const groups = groupByTaskAndArm(valid);
  const complete = (
    tasks.length === 3
    && valid.length === 9
    && tasks.every((task) =>
      ["A", "B", "C"].every((arm) => groups.has(`${task}\0${arm}\0${1}`)))
  );
  if (!complete) return { complete: false, futile: false, reasons: ["incomplete-valid-matched-block"] };
  let cQualityFailures = 0;
  let anyEfficiencyWin = false;
  for (const task of tasks) {
    const a = groups.get(`${task}\0A\0${1}`);
    const c = groups.get(`${task}\0C\0${1}`);
    if (a.accepted_quality === 1 && c.accepted_quality === 0) cQualityFailures += 1;
    if (
      c.premium_tokens < a.premium_tokens
      || c.total_weighted_cost < a.total_weighted_cost
    ) {
      anyEfficiencyWin = true;
    }
  }
  const reasons = [];
  if (cQualityFailures >= 2) reasons.push("c-unaccepted-on-two-a-accepted-tasks");
  if (!anyEfficiencyWin) reasons.push("no-matched-premium-token-or-cost-win");
  return { complete: true, futile: reasons.length > 0, reasons };
}

function armSummary(runs, arm) {
  const selected = runs.filter((run) => run.arm === arm);
  const accepted = selected.reduce((total, run) => total + run.accepted_quality, 0);
  const totalCost = selected.reduce((total, run) => total + run.total_weighted_cost, 0);
  return {
    accepted,
    blocking_finding_runs: selected.reduce(
      (total, run) => total + run.blocking_finding_run,
      0,
    ),
    cost_per_acceptance: accepted === 0 ? "positive-infinity" : totalCost / accepted,
    elapsed_ms: selected.reduce(
      (total, run) => total + run.total_elapsed_ms,
      0,
    ),
    premium_tokens: selected.reduce((total, run) => total + run.premium_tokens, 0),
    remediation: selected.reduce(
      (total, run) => total + run.remediation_dispatches,
      0,
    ),
    total_tokens: selected.reduce(
      (total, run) => total + run.total_tokens,
      0,
    ),
    total_weighted_cost: totalCost,
  };
}

export function evaluateAdoption(runs) {
  const valid = validAnalysisRuns(runs);
  const tasks = [...new Set(valid.map((run) => run.task))].sort(compareUtf8);
  const grid = new Set(
    valid.map((run) => `${run.task}\0${run.arm}\0${run.repetition}`),
  );
  const exactGrid = (
    valid.length === 27
    && tasks.length === 3
    && grid.size === 27
    && tasks.every((task) =>
      ["A", "B", "C"].every((arm) =>
        [1, 2, 3].every((repetition) =>
          grid.has(`${task}\0${arm}\0${repetition}`))))
  );
  const countByArm = Object.fromEntries(
    ["A", "B", "C"].map((arm) => [arm, valid.filter((run) => run.arm === arm).length]),
  );
  const complete = exactGrid && Object.values(countByArm).every((count) => count === 9);
  const arms = Object.fromEntries(["A", "B", "C"].map((arm) => [arm, armSummary(valid, arm)]));
  const aCost = arms.A.cost_per_acceptance;
  const cCost = arms.C.cost_per_acceptance;
  const costPass = (
    (Number.isFinite(aCost) && aCost > 0 && Number.isFinite(cCost) && cCost <= 0.8 * aCost)
    || (aCost === "positive-infinity" && Number.isFinite(cCost))
  );
  const baselineA = (
    complete
    && arms.C.accepted >= arms.A.accepted - 1
    && arms.C.blocking_finding_runs <= arms.A.blocking_finding_runs
    && arms.C.premium_tokens <= 0.7 * arms.A.premium_tokens
    && costPass
  );
  let mediumB = false;
  if (complete && arms.C.accepted >= arms.B.accepted + 1) mediumB = true;
  else if (
    complete
    && arms.C.accepted === arms.B.accepted
    && arms.B.remediation > 0
  ) {
    mediumB = (
      (arms.B.remediation - arms.C.remediation) / arms.B.remediation
      >= 0.2
    );
  }
  return {
    adoption_eligible: baselineA && mediumB,
    arms,
    baseline_a_floor: baselineA,
    complete_grid: complete,
    medium_b_advantage: mediumB,
    valid_run_count: valid.length,
  };
}

export function validateExperimentPreregistration(preregistration) {
  if (!plainObject(preregistration)) {
    throw new Error("experiment preregistration must be an object");
  }
  exactKeys(
    preregistration,
    [
      "activation",
      "adoption_truth_tables",
      "bindings",
      "commands",
      "metrics",
      "price_snapshot",
      "randomized_order",
      "remediation_bound",
      "replacement_tasks",
      "review_procedures",
      "rules",
      "tasks",
    ],
    "experiment preregistration",
  );
  if (preregistration.activation !== "inactive-experiment-only") {
    throw new Error("experiment preregistration must preserve inactive production");
  }
  const strata = ["large", "medium", "small"];
  const validateTasks = (tasks, label) => {
    if (!plainObject(tasks) || !equalJson(Object.keys(tasks).sort(), strata)) {
      throw new Error(`${label} must contain exactly the small, medium, and large strata`);
    }
    for (const [stratum, task] of Object.entries(tasks)) {
      exactKeys(
        task,
        [
          "code_bearing",
          "repository_basis",
          "revision",
          "spec_id",
          "status",
          "task_id",
        ],
        `${label}.${stratum}`,
      );
      for (const field of ["revision", "spec_id", "task_id"]) {
        nonEmptyString(task[field], `${label}.${stratum}.${field}`);
      }
      if (task.status !== "ratified" || task.code_bearing !== true) {
        throw new Error(`${label}.${stratum} must be a ratified code-bearing specification`);
      }
      validateBasis(task.repository_basis, `${label}.${stratum}.repository_basis`);
      if (task.repository_basis.revision !== task.revision) {
        throw new Error(`${label}.${stratum} revision must equal its repository basis`);
      }
    }
  };
  validateTasks(preregistration.tasks, "tasks");
  validateTasks(preregistration.replacement_tasks, "replacement_tasks");
  for (const stratum of strata) {
    const original = preregistration.tasks[stratum];
    const replacement = preregistration.replacement_tasks[stratum];
    if (
      original.task_id === replacement.task_id
      || original.spec_id === replacement.spec_id
      || original.revision === replacement.revision
      || equalJson(original.repository_basis, replacement.repository_basis)
    ) {
      throw new Error(
        `replacement_tasks.${stratum} must have a distinct task, spec, revision, and repository basis`,
      );
    }
  }

  const expectedCells = strata
    .flatMap((stratum) => ["A", "B", "C"].map((arm) => `${stratum}:${arm}`))
    .sort(compareUtf8);
  if (
    !Array.isArray(preregistration.randomized_order)
    || !equalJson([...preregistration.randomized_order].sort(compareUtf8), expectedCells)
  ) {
    throw new Error("randomized_order must contain every stratum/arm cell exactly once");
  }
  if (preregistration.remediation_bound !== 2) {
    throw new Error("experiment preregistration must use the shared two-remediation bound");
  }
  if (
    !plainObject(preregistration.commands)
    || !equalJson(Object.keys(preregistration.commands).sort(compareUtf8), ["tests", "typechecks"])
    || !Array.isArray(preregistration.commands.tests)
    || preregistration.commands.tests.length === 0
    || !Array.isArray(preregistration.commands.typechecks)
    || preregistration.commands.typechecks.length === 0
  ) {
    throw new Error("preregistration must retain required test and typecheck commands");
  }
  for (const command of [
    ...preregistration.commands.tests,
    ...preregistration.commands.typechecks,
  ]) {
    nonEmptyString(command, "preregistered command");
  }
  if (
    new Set(preregistration.commands.tests).size !== preregistration.commands.tests.length
    || new Set(preregistration.commands.typechecks).size
      !== preregistration.commands.typechecks.length
  ) {
    throw new Error("preregistered commands must be unique within each command class");
  }
  if (
    !plainObject(preregistration.review_procedures)
    || !equalJson(
      Object.keys(preregistration.review_procedures).sort(compareUtf8),
      ["code_review", "conformance"],
    )
    || Object.values(preregistration.review_procedures)
      .some((identity) => typeof identity !== "string" || identity.length === 0)
  ) {
    throw new Error("preregistration must retain exact nonempty conformance and code-review procedure identities");
  }
  if (
    !plainObject(preregistration.rules)
    || !equalJson(Object.keys(preregistration.rules).sort(compareUtf8), ["acceptance", "futility"])
    || Object.values(preregistration.rules)
      .some((identity) => typeof identity !== "string" || identity.length === 0)
    || !plainObject(preregistration.adoption_truth_tables)
    || !equalJson(
      Object.keys(preregistration.adoption_truth_tables).sort(compareUtf8),
      ["baseline_a", "medium_b"],
    )
    || Object.values(preregistration.adoption_truth_tables)
      .some((identity) => typeof identity !== "string" || identity.length === 0)
    || !Array.isArray(preregistration.metrics)
    || preregistration.metrics.length !== EXPERIMENT_METRICS.length
    || !equalJson(
      [...new Set(preregistration.metrics)].sort(compareUtf8),
      [...EXPERIMENT_METRICS].sort(compareUtf8),
    )
  ) {
    throw new Error("preregistration must retain exact rule/truth-table identities and the full fixed metrics");
  }
  const bindings = preregistration.bindings;
  if (
    !plainObject(bindings)
    || !equalJson(Object.keys(bindings).sort(compareUtf8), ["arm_a", "arm_b", "arm_c"])
    || !plainObject(bindings.arm_a)
    || !plainObject(bindings.arm_b)
    || !plainObject(bindings.arm_c)
  ) {
    throw new Error("preregistration must retain all three resource bindings");
  }
  const armA = bindings.arm_a;
  const validateCapabilityBinding = (binding, label) => {
    for (const field of [
      "capability_probe_identity",
      "capability_source_identity",
      "host",
      "surface",
    ]) {
      nonEmptyString(binding[field], `${label}.${field}`);
    }
    if (!/^[0-9a-f]{64}$/.test(binding.capability_response_identity)) {
      throw new Error(`${label}.capability_response_identity must be lowercase SHA-256`);
    }
    if (
      typeof binding.capability_observed_at !== "string"
      || Number.isNaN(Date.parse(binding.capability_observed_at))
    ) {
      throw new Error(`${label}.capability_observed_at must be a valid observed time`);
    }
  };
  exactKeys(
    armA,
    [
      "capability_observed_at",
      "capability_probe_identity",
      "capability_response_identity",
      "capability_source_identity",
      "executor_model_id",
      "host",
      "premium_selector",
      "pre_adoption_selector",
      "reviewer_model_id",
      "surface",
    ],
    "bindings.arm_a",
  );
  exactKeys(
    bindings.arm_b,
    [
      "capability_observed_at",
      "capability_probe_identity",
      "capability_response_identity",
      "capability_source_identity",
      "effective_resource_map",
      "executor_model_id",
      "host",
      "reviewer_model_id",
      "surface",
    ],
    "bindings.arm_b",
  );
  exactKeys(
    bindings.arm_c,
    [
      "capability_observed_at",
      "capability_probe_identity",
      "capability_response_identity",
      "capability_source_identity",
      "effective_resource_map",
      "executor_model_id",
      "host",
      "planner_model_id",
      "reviewer_model_id",
      "surface",
    ],
    "bindings.arm_c",
  );
  validateCapabilityBinding(armA, "bindings.arm_a");
  validateCapabilityBinding(bindings.arm_b, "bindings.arm_b");
  validateCapabilityBinding(bindings.arm_c, "bindings.arm_c");
  for (const field of [
    "capability_probe_identity",
    "capability_source_identity",
    "host",
    "surface",
  ]) {
    if (
      bindings.arm_b[field] !== armA[field]
      || bindings.arm_c[field] !== armA[field]
    ) {
      throw new Error(
        `matched arm bindings must share the same ${field} capability proof`,
      );
    }
  }
  if (
    typeof armA.executor_model_id !== "string"
    || armA.premium_selector !== armA.pre_adoption_selector
    || armA.executor_model_id !== armA.premium_selector
  ) {
    throw new Error("arm A premium selector must equal the capability-proven pre-adoption selector");
  }
  if (
    typeof bindings.arm_b.executor_model_id !== "string"
    || typeof bindings.arm_b.reviewer_model_id !== "string"
    || bindings.arm_b.effective_resource_map?.["execution-medium"]
      !== bindings.arm_b.executor_model_id
    || typeof bindings.arm_c.executor_model_id !== "string"
    || typeof bindings.arm_c.planner_model_id !== "string"
    || typeof bindings.arm_c.reviewer_model_id !== "string"
    || bindings.arm_c.effective_resource_map?.["execution-medium"]
      !== bindings.arm_c.executor_model_id
    || bindings.arm_c.effective_resource_map?.["reasoning-heavy"]
      !== bindings.arm_c.planner_model_id
  ) {
    throw new Error("arm B/C model ids must equal their capability-proven effective resource maps");
  }
  if (typeof armA.reviewer_model_id !== "string") {
    throw new Error("arm A must retain its exact reviewer model id");
  }

  const snapshot = preregistration.price_snapshot;
  if (plainObject(snapshot)) {
    exactKeys(snapshot, ["dated_identity", "models", "observed_at"], "price_snapshot");
  }
  if (
    !plainObject(snapshot)
    || typeof snapshot.dated_identity !== "string"
    || snapshot.dated_identity.length === 0
    || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.observed_at ?? "")
    || !plainObject(snapshot.models)
  ) {
    throw new Error("preregistration must retain a dated price snapshot and model tables");
  }
  const requiredModelIds = new Set([
    armA.executor_model_id,
    armA.reviewer_model_id,
    bindings.arm_b.executor_model_id,
    bindings.arm_b.reviewer_model_id,
    bindings.arm_c.executor_model_id,
    bindings.arm_c.planner_model_id,
    bindings.arm_c.reviewer_model_id,
  ]);
  for (const modelId of requiredModelIds) {
    const model = snapshot.models[modelId];
    if (
      !plainObject(model)
      || !["premium", "medium"].includes(model.tier)
      || !plainObject(model.normalization)
      || !plainObject(model.rates)
    ) {
      throw new Error(`price snapshot lacks complete normalization/rates for ${modelId}`);
    }
    exactKeys(model, ["normalization", "rates", "tier"], `price snapshot model ${modelId}`);
    exactKeys(
      model.normalization,
      ["buckets", "informational_fields"],
      `price snapshot model ${modelId} normalization`,
    );
    const raw = {};
    for (const rule of model.normalization.buckets ?? []) {
      raw[rule.field] = 0;
      for (const field of rule.subtract ?? []) raw[field] = 0;
    }
    for (const field of model.normalization.informational_fields ?? []) raw[field] = 0;
    normalizeBillableCall(raw, model.normalization, model.rates);
  }
  if (
    snapshot.models[armA.executor_model_id].tier !== "premium"
    || snapshot.models[bindings.arm_c.planner_model_id].tier !== "premium"
    || snapshot.models[bindings.arm_b.executor_model_id].tier !== "medium"
    || snapshot.models[bindings.arm_c.executor_model_id].tier !== "medium"
  ) {
    throw new Error("preregistered premium/medium bindings contradict the price snapshot tiers");
  }
  return preregistration;
}

function validateRunResult(
  run,
  {
    arm,
    preregistration,
    repetition,
    task,
  },
) {
  if (!plainObject(run) || !["A", "B", "C"].includes(run.arm)) {
    throw new Error("experiment run result is invalid");
  }
  exactKeys(
    run,
    [
      "ambiguities_caught_before_implementation",
      "arm",
      "code_review_blocking_observed",
      "code_review_findings",
      "command_outcomes",
      "conformance_findings",
      "conformance_verdict",
      "executor_deviations",
      "fixture_proof",
      "independent_upstream_finding",
      "invalid_packet_anchors",
      "model_calls",
      "remediation_dispatches_by_type",
      "repetition",
      "repository_basis",
      "required_tests_pass",
      "required_typechecks_pass",
      "resource_binding_proof",
      "review_history",
      "task",
      "terminal_code_review_blocking",
      "unused_plan_steps",
      "upstream_status",
    ],
    "experiment run",
  );
  if (run.arm !== arm || run.repetition !== repetition || run.task !== task.task_id) {
    throw new Error(
      `runner result identity does not match requested task/arm/repetition cell ${task.task_id}/${arm}/${repetition}`,
    );
  }
  validateBasis(run.repository_basis, "experiment run repository_basis");
  if (!equalJson(run.repository_basis, task.repository_basis)) {
    throw new Error("experiment run repository revision/worktree basis differs from its preregistered task");
  }
  exactKeys(
    run.fixture_proof,
    [
      "fixture_id",
      "fresh",
      "isolated",
      "repository_basis",
      "spec_id",
      "task_id",
    ],
    "experiment run fixture_proof",
  );
  nonEmptyString(run.fixture_proof.fixture_id, "experiment run fixture_proof.fixture_id");
  if (
    run.fixture_proof.fresh !== true
    || run.fixture_proof.isolated !== true
    || run.fixture_proof.spec_id !== task.spec_id
    || run.fixture_proof.task_id !== task.task_id
    || !equalJson(run.fixture_proof.repository_basis, task.repository_basis)
  ) {
    throw new Error("experiment run lacks fresh isolated identical-basis fixture proof");
  }
  const binding = preregistration.bindings[`arm_${arm.toLowerCase()}`];
  if (!equalJson(run.resource_binding_proof, binding)) {
    throw new Error("experiment run resource proof differs from its preregistered arm binding");
  }
  exactKeys(run.command_outcomes, ["tests", "typechecks"], "experiment run command_outcomes");
  const validateCommandOutcomes = (kind, summary) => {
    const expected = preregistration.commands[kind];
    const outcomes = run.command_outcomes[kind];
    if (!Array.isArray(outcomes) || outcomes.length !== expected.length) {
      throw new Error(`experiment run ${kind} command outcomes are incomplete`);
    }
    for (let index = 0; index < outcomes.length; index += 1) {
      exactKeys(outcomes[index], ["command", "passed"], `${kind} command outcome`);
      if (
        outcomes[index].command !== expected[index]
        || typeof outcomes[index].passed !== "boolean"
      ) {
        throw new Error(`experiment run ${kind} command outcome differs from preregistration`);
      }
    }
    if (outcomes.every((outcome) => outcome.passed) !== summary) {
      throw new Error(`experiment run ${kind} aggregate contradicts command outcomes`);
    }
  };
  if (
    typeof run.required_tests_pass !== "boolean"
    || typeof run.required_typechecks_pass !== "boolean"
    || !["PASS", "FAIL", "UPSTREAM-INDICTED"].includes(run.conformance_verdict)
    || typeof run.terminal_code_review_blocking !== "boolean"
    || typeof run.code_review_blocking_observed !== "boolean"
  ) {
    throw new Error("experiment run lacks required test/typecheck/review outcomes");
  }
  validateCommandOutcomes("tests", run.required_tests_pass);
  validateCommandOutcomes("typechecks", run.required_typechecks_pass);
  for (const field of [
    "ambiguities_caught_before_implementation",
    "code_review_findings",
    "conformance_findings",
    "executor_deviations",
    "invalid_packet_anchors",
    "unused_plan_steps",
  ]) {
    stringArray(run[field], `experiment run ${field}`);
  }
  const byType = run.remediation_dispatches_by_type;
  const remediationTypes = ["executor retry", "planner retry", "reviewer-return loop"];
  if (
    !plainObject(byType)
    || !equalJson(Object.keys(byType).sort(compareUtf8), remediationTypes.sort(compareUtf8))
    || remediationTypes.some((type) => !Number.isSafeInteger(byType[type]) || byType[type] < 0)
  ) {
    throw new Error("experiment run remediation dispatches must be classified exactly once");
  }
  if (run.arm !== "C" && byType["planner retry"] !== 0) {
    throw new Error("planner retry is available only to the planner treatment arm");
  }
  run.remediation_dispatches = remediationTypes
    .reduce((total, type) => total + byType[type], 0);
  if (
    !Number.isInteger(run.remediation_dispatches)
    || run.remediation_dispatches < 0
    || run.remediation_dispatches > 2
  ) {
    throw new Error("experiment run exceeds the shared two-dispatch remediation budget");
  }
  run.accepted_quality = (
    run.required_tests_pass
    && run.required_typechecks_pass
    && run.conformance_verdict === "PASS"
    && !run.terminal_code_review_blocking
  ) ? 1 : 0;
  run.blocking_finding_run = run.code_review_blocking_observed ? 1 : 0;
  if (!Array.isArray(run.model_calls) || run.model_calls.length === 0) {
    throw new Error("experiment run must retain every raw model call");
  }
  const expectedModelForRole = (role) => {
    if (role === "planner" || role === "planner-remediation") {
      return binding.planner_model_id;
    }
    if (role === "conformance-reviewer" || role === "code-reviewer") {
      return binding.reviewer_model_id;
    }
    if (
      ["executor", "executor-remediation", "reviewer-return-executor"].includes(role)
    ) {
      return binding.executor_model_id;
    }
    return null;
  };
  let premiumTokens = 0;
  let totalTokens = 0;
  let totalWeightedCost = 0;
  let totalElapsed = 0;
  const observedRoles = [];
  const observedAttempts = new Set();
  run.model_calls = run.model_calls.map((call) => {
    exactKeys(
      call,
      ["attempt", "elapsed_ms", "model_id", "raw_provider_fields", "role"],
      "raw model call",
    );
    const expectedModel = expectedModelForRole(call.role);
    if (
      !expectedModel
      || call.model_id !== expectedModel
      || !Number.isSafeInteger(call.attempt)
      || call.attempt < 1
      || !Number.isSafeInteger(call.elapsed_ms)
      || call.elapsed_ms < 0
    ) {
      throw new Error(`model call role/model/attempt/time is invalid for ${call.role}`);
    }
    if (observedAttempts.has(call.attempt)) {
      throw new Error(`model call attempt ${call.attempt} is duplicated`);
    }
    if (call.attempt !== observedAttempts.size + 1) {
      throw new Error(
        `model call attempt ${call.attempt} for ${call.role} is not contiguous at sequence ${observedAttempts.size + 1}`,
      );
    }
    observedAttempts.add(call.attempt);
    observedRoles.push(call.role);
    const price = preregistration.price_snapshot.models[call.model_id];
    const normalized = normalizeBillableCall(
      call.raw_provider_fields,
      price.normalization,
      price.rates,
    );
    totalTokens += normalized.total_tokens;
    totalWeightedCost += normalized.weighted_cost;
    totalElapsed += call.elapsed_ms;
    if (price.tier === "premium") premiumTokens += normalized.total_tokens;
    return {
      ...call,
      arm,
      billable_buckets: normalized.billable_buckets,
      informational: normalized.informational,
      price_identity: preregistration.price_snapshot.dated_identity,
      repetition,
      task: task.task_id,
      total_tokens: normalized.total_tokens,
      weighted_cost: normalized.weighted_cost,
    };
  });
  const expectedRoles = [];
  if (arm === "C") {
    expectedRoles.push("planner");
    expectedRoles.push(
      ...Array(byType["planner retry"]).fill("planner-remediation"),
    );
  }
  expectedRoles.push("executor");
  expectedRoles.push(
    ...Array(byType["executor retry"]).fill("executor-remediation"),
  );
  expectedRoles.push("conformance-reviewer", "code-reviewer");
  for (let index = 0; index < byType["reviewer-return loop"]; index += 1) {
    expectedRoles.push(
      "reviewer-return-executor",
      "conformance-reviewer",
      "code-reviewer",
    );
  }
  if (!equalJson(observedRoles, expectedRoles)) {
    throw new Error(
      `model call sequence/cardinality differs from arm ${arm} and classified remediations`,
    );
  }
  if (!Array.isArray(run.review_history)) {
    throw new Error("experiment run review history must be an array");
  }
  const expectedReviewRounds = byType["reviewer-return loop"] + 1;
  if (run.review_history.length !== expectedReviewRounds * 2) {
    throw new Error("experiment run review history does not match classified reviewer-return loops");
  }
  let blockingCodeReviewObserved = false;
  for (let round = 1; round <= expectedReviewRounds; round += 1) {
    const conformance = run.review_history[(round - 1) * 2];
    const codeReview = run.review_history[(round - 1) * 2 + 1];
    for (const entry of [conformance, codeReview]) {
      exactKeys(entry, ["blocking", "reviewer", "round", "verdict"], "review history entry");
    }
    if (
      conformance.reviewer !== "conformance-reviewer"
      || conformance.round !== round
      || typeof conformance.blocking !== "boolean"
      || !["PASS", "FAIL", "UPSTREAM-INDICTED"].includes(conformance.verdict)
      || conformance.blocking === (conformance.verdict === "PASS")
    ) {
      throw new Error(`experiment run conformance review history is invalid at round ${round}`);
    }
    if (
      codeReview.reviewer !== "code-reviewer"
      || codeReview.round !== round
      || typeof codeReview.blocking !== "boolean"
      || !["CLEAN", "PASS-WITH-ADVISORIES", "BLOCK"].includes(codeReview.verdict)
      || codeReview.blocking !== (codeReview.verdict === "BLOCK")
    ) {
      throw new Error(`experiment run code-review history is invalid at round ${round}`);
    }
    if (codeReview.blocking) blockingCodeReviewObserved = true;
    const terminal = round === expectedReviewRounds;
    if (!terminal && !conformance.blocking && !codeReview.blocking) {
      throw new Error("reviewer-return loop lacks a preceding classified blocking review");
    }
    if (
      terminal
      && (
        conformance.verdict !== run.conformance_verdict
        || codeReview.blocking !== run.terminal_code_review_blocking
        || (run.accepted_quality === 1
          && !["CLEAN", "PASS-WITH-ADVISORIES"].includes(codeReview.verdict))
      )
    ) {
      throw new Error("terminal review history contradicts the run's terminal review outcome");
    }
  }
  if (blockingCodeReviewObserved !== run.code_review_blocking_observed) {
    throw new Error("review history contradicts observed blocking code-review incidence");
  }
  run.measurement_valid = true;
  run.premium_tokens = premiumTokens;
  run.total_elapsed_ms = totalElapsed;
  run.total_tokens = totalTokens;
  run.total_weighted_cost = totalWeightedCost;
  if (
    run.upstream_status === "invalidated-upstream"
    && (typeof run.independent_upstream_finding !== "string"
      || run.independent_upstream_finding.length === 0)
  ) {
    throw new Error("upstream invalidation requires an independent finding");
  }
  if (run.upstream_status === "valid" && run.independent_upstream_finding !== null) {
    throw new Error("valid upstream run cannot carry an invalidation finding");
  }
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function projectResolvedPath(target) {
  let cursor = path.resolve(target);
  const missing = [];
  while (true) {
    try {
      const resolved = await realpath(cursor);
      return path.resolve(resolved, ...missing.reverse());
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      missing.push(path.basename(cursor));
      cursor = parent;
    }
  }
}

async function prepareEvidenceRoot(evidenceRoot, repoRoot) {
  const repositoryIdentity = await realpath(repoRoot);
  const projectedIdentity = await projectResolvedPath(evidenceRoot);
  if (isWithin(repositoryIdentity, projectedIdentity)) {
    throw new Error("planning evidence root filesystem identity must be outside the source repository");
  }
  await mkdir(evidenceRoot, { recursive: true });
  const evidenceIdentity = await realpath(evidenceRoot);
  if (isWithin(repositoryIdentity, evidenceIdentity)) {
    throw new Error("planning evidence root filesystem identity must be outside the source repository");
  }
  return evidenceIdentity;
}

export async function runPlanningExperiment({
  evidenceRoot,
  preregistration,
  repoRoot,
  runCell,
}) {
  validateExperimentPreregistration(preregistration);
  const evidenceIdentity = await prepareEvidenceRoot(evidenceRoot, repoRoot);
  await writeFile(
    path.join(evidenceIdentity, "preregistration.json"),
    `${JSON.stringify(preregistration, null, 2)}\n`,
    { flag: "wx" },
  );

  const results = [];
  const invalidationOverhead = [];
  const effectiveTasks = structuredClone(preregistration.tasks);
  const observedFixtureIds = new Set();
  const validateFreshRun = (run, identity) => {
    validateRunResult(run, identity);
    const fixtureId = run.fixture_proof.fixture_id;
    if (observedFixtureIds.has(fixtureId)) {
      throw new Error(`experiment run reuses non-fresh fixture identity ${fixtureId}`);
    }
    observedFixtureIds.add(fixtureId);
  };
  const runOrder = async (repetition, taskMap = effectiveTasks) => {
    for (const cell of preregistration.randomized_order) {
      const [stratum, arm] = cell.split(":");
      if (!(stratum in taskMap) || !["A", "B", "C"].includes(arm)) {
        throw new Error(`invalid randomized experiment cell ${cell}`);
      }
      const run = await runCell({ arm, repetition, stratum, task: taskMap[stratum] });
      validateFreshRun(run, {
        arm,
        preregistration,
        repetition,
        task: taskMap[stratum],
      });
      results.push(run);
    }
  };
  const processInvalidations = async (throughRepetition) => {
    for (const [stratum, task] of Object.entries(effectiveTasks)) {
      const taskRuns = results.filter((run) => run.task === task.task_id);
      const invalid = taskRuns.find(
        (run) => run.upstream_status === "invalidated-upstream",
      );
      if (!invalid) continue;
      if (task.task_id === preregistration.replacement_tasks[stratum].task_id) {
        throw new Error(`same-stratum replacement ${task.task_id} was independently invalidated`);
      }
      for (const run of taskRuns) {
        run.upstream_status = "invalidated-upstream";
        run.independent_upstream_finding = invalid.independent_upstream_finding;
      }
      invalidationOverhead.push(...taskRuns);
      for (let index = results.length - 1; index >= 0; index -= 1) {
        if (results[index].task === task.task_id) results.splice(index, 1);
      }
      effectiveTasks[stratum] = preregistration.replacement_tasks[stratum];
      for (let repetition = 1; repetition <= throughRepetition; repetition += 1) {
        for (const cell of preregistration.randomized_order) {
          const [cellStratum, arm] = cell.split(":");
          if (cellStratum !== stratum) continue;
          const replacement = effectiveTasks[stratum];
          const run = await runCell({
            arm,
            repetition,
            stratum,
            task: replacement,
          });
          validateFreshRun(run, {
            arm,
            preregistration,
            repetition,
            task: replacement,
          });
          if (run.upstream_status === "invalidated-upstream") {
            throw new Error(`same-stratum replacement ${replacement.task_id} is invalid`);
          }
          results.push(run);
        }
      }
    }
  };

  await runOrder(1);
  await processInvalidations(1);
  let futility = evaluateFutility(results.filter((run) => run.repetition === 1));
  if (!futility.complete) throw new Error("phase one did not produce a complete valid matched block");
  if (!futility.futile) {
    await runOrder(2);
    await processInvalidations(2);
    futility = evaluateFutility(results.filter((run) => run.repetition === 1));
    await runOrder(3);
    await processInvalidations(3);
    futility = evaluateFutility(results.filter((run) => run.repetition === 1));
  }
  const adoption = evaluateAdoption(results);
  if (futility.futile) adoption.adoption_eligible = false;
  const outcome = {
    adoption,
    futility,
    invalidation_overhead: invalidationOverhead,
    invalidation_overhead_summary: {
      elapsed_ms: invalidationOverhead.reduce(
        (total, run) => total + run.total_elapsed_ms,
        0,
      ),
      remediation_dispatches: invalidationOverhead.reduce(
        (total, run) => total + run.remediation_dispatches,
        0,
      ),
      run_count: invalidationOverhead.length,
      total_tokens: invalidationOverhead.reduce(
        (total, run) => total + run.total_tokens,
        0,
      ),
      total_weighted_cost: invalidationOverhead.reduce(
        (total, run) => total + run.total_weighted_cost,
        0,
      ),
    },
    production_activation_changed: false,
    results,
  };
  await writeFile(
    path.join(evidenceIdentity, "results.json"),
    `${JSON.stringify(outcome, null, 2)}\n`,
    { flag: "wx" },
  );
  return outcome;
}
