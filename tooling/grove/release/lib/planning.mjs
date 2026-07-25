import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
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
      ids.push(entry.id);
    }
    if (JSON.stringify(ids) !== JSON.stringify([...ids].sort(compareUtf8))) {
      throw new Error(`risks_and_gaps.${name} must sort by id`);
    }
  }
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
      const red = referencedSlices.findIndex((slice) => slice.phase === "red");
      const green = referencedSlices.findIndex((slice) => slice.phase === "green");
      if (red === -1 || green === -1 || red >= green) {
        throw new Error(`${criterion} must place red before green`);
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
        if (!referencedSlices[red].test_anchor_ids.includes(testId)) {
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

  validateRiskCollection(packet.risks_and_gaps, criterionSet);
  if (packet.outcome === "executable") {
    if (implementCount === 0) throw new Error("executable packet requires at least one implement criterion");
    if (packet.criterion_test_map.some((entry) => entry.disposition === "blocked")) {
      throw new Error("executable packet cannot contain blocked criteria");
    }
    if (
      [...packet.risks_and_gaps.blockers, ...packet.risks_and_gaps.ambiguities]
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

export function buildWorkScope({ sources, coverage }) {
  if (!Array.isArray(sources) || sources.length === 0) throw new Error("work scope requires sources");
  if (!Array.isArray(coverage)) throw new Error("work scope coverage must be an array");
  const orderedInputs = [
    sources[0],
    ...sources.slice(1).sort((left, right) =>
      compareUtf8(left.locator, right.locator)
      || compareUtf8(left.revision, right.revision)),
  ];
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
  for (const source of sourceRecords) {
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
        const bytes = Buffer.from(source.bytes_base64, "base64")
          .subarray(interval.start_byte, interval.end_byte);
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
    source_coverage: sourceCoverage,
    sources: sourceRecords,
    work_items: workItems,
    work_scope_identity: sha256(identityBytes),
  };
}

export function classifyRoute(record, { activation }) {
  if (!plainObject(record) || !plainObject(record.predicates)) {
    throw new Error("route classification record is invalid");
  }
  const workIds = record.work_scope?.work_items?.map((item) => item.work_id) ?? [];
  if (
    !Array.isArray(record.mappings)
    || record.mappings.length !== workIds.length
    || new Set(record.mappings.map((item) => item.work_id)).size !== workIds.length
    || workIds.some((id) => !record.mappings.some((item) => item.work_id === id))
  ) {
    throw new Error("route classification must map every work id exactly once");
  }
  const p = record.predicates;
  if (p.wrong_decision) return { precedence: 1, route: "shaping" };
  if (p.spec_gap) return { precedence: 2, route: "spec-reconvergence" };
  if (p.ambiguous || (!p.adequate_spec && !p.decision_only_non_code)) {
    return { precedence: 3, route: "fail-closed-ambiguous" };
  }
  if (p.decision_only_non_code) return { precedence: 4, route: "direct-executor-decision" };
  if (p.adequate_spec && p.reproduced && p.root_caused && p.localized) {
    return { precedence: 5, route: "direct-executor-localized-slip" };
  }
  if (p.adequate_spec && p.code_bearing) {
    if (activation === "experiment-arm-c" || activation === "active-adoption") {
      return { precedence: 6, route: "implementation-planner" };
    }
    return { precedence: 6, route: "direct-executor-pre-adoption" };
  }
  return { precedence: 7, route: "fail-closed-unclassified" };
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
  if (
    !plainObject(result)
    || result.source_identity !== defaults.selector_capability_source.identity
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
  if (context === "inactive-ordinary-production") {
    return {
      binding_context: context,
      executor: baseline.selector,
      planner: null,
      selection_source_identity: baseline.selection_source_identity,
    };
  }
  const defaults = hostsMetadata.resource_defaults?.[host];
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
  const billable = [];
  const bucketNames = new Set();
  for (const rule of normalization.buckets) {
    if (
      !plainObject(rule)
      || typeof rule.bucket !== "string"
      || typeof rule.field !== "string"
      || !Array.isArray(rule.subtract)
      || rule.subtract.some((field) => typeof field !== "string")
      || bucketNames.has(rule.bucket)
    ) {
      throw new Error("token normalization bucket rule is invalid or duplicated");
    }
    bucketNames.add(rule.bucket);
    const source = raw[rule.field];
    if (!Number.isSafeInteger(source) || source < 0) {
      throw new Error(`token field ${rule.field} is missing or invalid`);
    }
    let count = source;
    for (const field of rule.subtract) {
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
    premium_tokens: selected.reduce((total, run) => total + run.premium_tokens, 0),
    remediation: selected.reduce(
      (total, run) => total + run.remediation_dispatches,
      0,
    ),
    total_weighted_cost: totalCost,
  };
}

export function evaluateAdoption(runs) {
  const valid = validAnalysisRuns(runs);
  const countByArm = Object.fromEntries(
    ["A", "B", "C"].map((arm) => [arm, valid.filter((run) => run.arm === arm).length]),
  );
  const complete = valid.length === 27 && Object.values(countByArm).every((count) => count === 9);
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
    medium_b_advantage: mediumB,
    valid_run_count: valid.length,
  };
}

export function validateExperimentPreregistration(preregistration) {
  if (!plainObject(preregistration)) {
    throw new Error("experiment preregistration must be an object");
  }
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
        ["code_bearing", "revision", "spec_id", "status", "task_id"],
        `${label}.${stratum}`,
      );
      for (const field of ["revision", "spec_id", "task_id"]) {
        nonEmptyString(task[field], `${label}.${stratum}.${field}`);
      }
      if (task.status !== "ratified" || task.code_bearing !== true) {
        throw new Error(`${label}.${stratum} must be a ratified code-bearing specification`);
      }
    }
  };
  validateTasks(preregistration.tasks, "tasks");
  validateTasks(preregistration.replacement_tasks, "replacement_tasks");
  for (const stratum of strata) {
    if (
      preregistration.tasks[stratum].task_id
      === preregistration.replacement_tasks[stratum].task_id
    ) {
      throw new Error(`replacement_tasks.${stratum} must name a distinct task`);
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
    !plainObject(preregistration.review_procedures)
    || typeof preregistration.review_procedures.conformance !== "string"
    || typeof preregistration.review_procedures.code_review !== "string"
  ) {
    throw new Error("preregistration must retain conformance and code-review procedures");
  }
  if (
    !plainObject(preregistration.rules)
    || typeof preregistration.rules.acceptance !== "string"
    || typeof preregistration.rules.futility !== "string"
    || !plainObject(preregistration.adoption_truth_tables)
    || typeof preregistration.adoption_truth_tables.baseline_a !== "string"
    || typeof preregistration.adoption_truth_tables.medium_b !== "string"
    || !Array.isArray(preregistration.metrics)
    || preregistration.metrics.length === 0
  ) {
    throw new Error("preregistration must retain rules, metrics, and adoption truth tables");
  }
  if (
    !plainObject(preregistration.price_snapshot)
    || typeof preregistration.price_snapshot.dated_identity !== "string"
    || typeof preregistration.price_snapshot.normalization_identity !== "string"
  ) {
    throw new Error("preregistration must retain a dated price and normalization identity");
  }

  const bindings = preregistration.bindings;
  if (
    !plainObject(bindings)
    || !plainObject(bindings.arm_a)
    || !plainObject(bindings.arm_b)
    || !plainObject(bindings.arm_c)
  ) {
    throw new Error("preregistration must retain all three resource bindings");
  }
  const armA = bindings.arm_a;
  if (
    typeof armA.capability_probe_identity !== "string"
    || typeof armA.executor_model_id !== "string"
    || armA.premium_selector !== armA.pre_adoption_selector
    || armA.executor_model_id !== armA.premium_selector
  ) {
    throw new Error("arm A premium selector must equal the capability-proven pre-adoption selector");
  }
  if (
    typeof bindings.arm_b.capability_probe_identity !== "string"
    || typeof bindings.arm_b.executor_model_id !== "string"
    || bindings.arm_b.effective_resource_map?.["execution-medium"]
      !== bindings.arm_b.executor_model_id
    || typeof bindings.arm_c.capability_probe_identity !== "string"
    || typeof bindings.arm_c.executor_model_id !== "string"
    || typeof bindings.arm_c.planner_model_id !== "string"
    || bindings.arm_c.effective_resource_map?.["execution-medium"]
      !== bindings.arm_c.executor_model_id
    || bindings.arm_c.effective_resource_map?.["reasoning-heavy"]
      !== bindings.arm_c.planner_model_id
  ) {
    throw new Error("arm B/C model ids must equal their capability-proven effective resource maps");
  }
  return preregistration;
}

function validateRunResult(run) {
  if (!plainObject(run) || !["A", "B", "C"].includes(run.arm)) {
    throw new Error("experiment run result is invalid");
  }
  if (
    typeof run.required_tests_pass !== "boolean"
    || typeof run.required_typechecks_pass !== "boolean"
    || !["PASS", "FAIL", "UPSTREAM-INDICTED"].includes(run.conformance_verdict)
    || typeof run.terminal_code_review_blocking !== "boolean"
    || typeof run.code_review_blocking_observed !== "boolean"
  ) {
    throw new Error("experiment run lacks required test/typecheck/review outcomes");
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
  if (
    run.upstream_status === "invalidated-upstream"
    && (typeof run.independent_upstream_finding !== "string"
      || run.independent_upstream_finding.length === 0)
  ) {
    throw new Error("upstream invalidation requires an independent finding");
  }
}

export async function runPlanningExperiment({
  evidenceRoot,
  preregistration,
  repoRoot,
  runCell,
}) {
  const relative = path.relative(path.resolve(repoRoot), path.resolve(evidenceRoot));
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error("planning evidence root must be outside the source repository");
  }
  validateExperimentPreregistration(preregistration);
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(
    path.join(evidenceRoot, "preregistration.json"),
    `${JSON.stringify(preregistration, null, 2)}\n`,
  );

  const results = [];
  const invalidationOverhead = [];
  const effectiveTasks = structuredClone(preregistration.tasks);
  const runOrder = async (repetition, taskMap = effectiveTasks) => {
    for (const cell of preregistration.randomized_order) {
      const [stratum, arm] = cell.split(":");
      if (!(stratum in taskMap) || !["A", "B", "C"].includes(arm)) {
        throw new Error(`invalid randomized experiment cell ${cell}`);
      }
      const run = await runCell({ arm, repetition, stratum, task: taskMap[stratum] });
      validateRunResult(run);
      results.push(run);
    }
  };
  await runOrder(1);

  for (const [stratum, task] of Object.entries(effectiveTasks)) {
    const taskRuns = results.filter((run) => run.task === task.task_id);
    if (taskRuns.some((run) => run.upstream_status === "invalidated-upstream")) {
      invalidationOverhead.push(...taskRuns);
      for (let index = results.length - 1; index >= 0; index -= 1) {
        if (results[index].task === task.task_id) results.splice(index, 1);
      }
      effectiveTasks[stratum] = preregistration.replacement_tasks[stratum];
      for (const arm of ["A", "B", "C"]) {
        const run = await runCell({
          arm,
          repetition: 1,
          stratum,
          task: effectiveTasks[stratum],
        });
        validateRunResult(run);
        results.push(run);
      }
    }
  }

  const futility = evaluateFutility(results);
  if (!futility.complete) throw new Error("phase one did not produce a complete valid matched block");
  if (!futility.futile) {
    await runOrder(2);
    await runOrder(3);
  }
  const adoption = evaluateAdoption(results);
  const outcome = {
    adoption,
    futility,
    invalidation_overhead: invalidationOverhead,
    production_activation_changed: false,
    results,
  };
  await writeFile(
    path.join(evidenceRoot, "results.json"),
    `${JSON.stringify(outcome, null, 2)}\n`,
  );
  return outcome;
}
