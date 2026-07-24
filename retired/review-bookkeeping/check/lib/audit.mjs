// grove-audit parsing, residue derivation, freshness, separation, and the
// audit emitter (spec-0003 §B–§C; adr-0023 D4, phase 1). Shadow machinery:
// NOTHING here is read by the shipped spec-0002 check (spec-0003 INV1 — audit
// blocks are inert to it by fail-closed non-recognition).
//
// The record embodies the adr-0015 judgment/stamp split one level up (§C.2):
// the AUDITOR supplies only judgment — `auditor`, `dispositions` ({owed, why}
// per judgment-residue file), `findings` — and the EMITTER stamps every
// machine-computable binding by importing this package's own code:
//   - `coverage_residue`  — diff_files ∖ ask_covered_files, with per-path
//     content hashes at the audited HEAD (fingerprint.mjs pathHashAt);
//   - `content_fingerprint` — grove-fp-1 over diff_files at HEAD (blob-byte
//     basis: a no-op rebase stays fresh, fail-open F7);
//   - `policy_fingerprint` — grove-fp-1 over the policy carriers at the
//     protected-branch commit (fail-open F5);
//   - `record_hwm` — the typed record-stream high-water mark, sentinel 0 over
//     a typed-record-free stream (fail-closed: any future typed comment
//     stales; §C.1, F2);
//   - `flagged` — the §A.3 inert-per-subject rows (asks.mjs), machine-derived.
// Each stamped field is a CI-recomputable FACT, never a claim.

import { parseYaml, YamlError } from './yaml.mjs';
import { extractFencedBlocks, extractTaggedBlocks } from './blocks.mjs';
import { groveFp1, pathHashAt } from './fingerprint.mjs';
import { artifactMeta } from './frontmatter.mjs';
import { inJurisdiction } from './scope.mjs';
import { askCoveredFiles, flaggedRows, parseAskComment } from './asks.mjs';
import { parseComment, checkAdmissibility } from './records.mjs';

// --- parse / validate (§C.1; carrier, delimitation, isolation = §A.1) ---

// Return the raw inner text of every well-formed fenced grove-audit block.
export function extractAuditBlocks(body) {
  return extractFencedBlocks(body, 'grove-audit');
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

// A present-but-empty map serializes as a bare key (`dispositions:`), which
// the YAML subset parses to null — recognized as the empty map iff the key is
// PRESENT. An absent required key stays a schema failure.
function asMap(obj, key) {
  if (!(key in obj)) return null;
  const v = obj[key];
  if (v == null) return {};
  return isPlainObject(v) ? v : null;
}

function validDispositions(map) {
  const out = {};
  for (const [path, entry] of Object.entries(map)) {
    if (!isPlainObject(entry)) return null;
    if (!Array.isArray(entry.owed)) return null; // may be empty ("owes nothing", stated)
    for (const r of entry.owed) if (typeof r !== 'string') return null;
    // `why` key required; a bare key parses to null => '' (the records.mjs
    // findings precedent) — empty is vacuous at evaluation (§C.5), not inert.
    if (!('why' in entry)) return null;
    const why = entry.why == null ? '' : String(entry.why);
    out[path] = { owed: entry.owed.map(String), why };
  }
  return out;
}

function validFlagged(list) {
  const out = [];
  for (const row of list) {
    if (!isPlainObject(row)) return null;
    if (!isNonEmptyString(row.path) || !isNonEmptyString(row.cause)) return null;
    out.push({ path: row.path, cause: row.cause, comment: row.comment });
  }
  return out;
}

// Validate a parsed block against the §C.1 schema. Returns the record object
// or null on non-recognition (=> inert, fail-closed).
function validate(obj) {
  if (!isPlainObject(obj)) return null;
  if (obj.schema !== 1) return null; // absent or != 1 => inert (§C.1)
  if (!isNonEmptyString(obj.auditor)) return null;
  const coverage = asMap(obj, 'coverage_residue');
  if (coverage == null) return null;
  for (const h of Object.values(coverage)) if (typeof h !== 'string') return null;
  if (!isNonEmptyString(obj.content_fingerprint)) return null;
  if (!isNonEmptyString(obj.policy_fingerprint)) return null;
  // typed HWM: a non-negative integer; 0 is the pinned empty-stream sentinel
  if (!Number.isInteger(obj.record_hwm) || obj.record_hwm < 0) return null;
  const flaggedRaw = 'flagged' in obj ? (obj.flagged == null ? [] : obj.flagged) : null;
  if (flaggedRaw == null || !Array.isArray(flaggedRaw)) return null;
  const flagged = validFlagged(flaggedRaw);
  if (flagged == null) return null;
  const dispositionsRaw = asMap(obj, 'dispositions');
  if (dispositionsRaw == null) return null;
  const dispositions = validDispositions(dispositionsRaw);
  if (dispositions == null) return null;
  return {
    schema: 1,
    auditor: obj.auditor,
    coverage_residue: { ...coverage },
    content_fingerprint: obj.content_fingerprint,
    policy_fingerprint: obj.policy_fingerprint,
    record_hwm: obj.record_hwm,
    flagged,
    dispositions,
    ...(obj.findings != null ? { findings: String(obj.findings) } : {}),
    ...(obj.audited_at_commit != null ? { audited_at_commit: String(obj.audited_at_commit) } : {}),
  };
}

function parseBlock({ inner, index, wellFormed }) {
  if (!wellFormed) return { status: 'inert', cause: 'unclosed', blockIndex: index };
  let parsed;
  try {
    parsed = parseYaml(inner);
  } catch (e) {
    // Fail-closed: ANY parser throw yields an inert block, never an escape.
    return { status: 'inert', cause: e instanceof YamlError ? 'malformed' : 'parse-error', blockIndex: index };
  }
  const record = validate(parsed);
  if (record == null) return { status: 'inert', cause: 'schema', blockIndex: index };
  return { status: 'record', record, blockIndex: index };
}

// Parse a comment into { status: 'none'|'multi', blocks } — the exact shape of
// records.mjs parseComment, over the grove-audit tag (per-block isolation).
export function parseAuditComment(comment) {
  const richBlocks = extractTaggedBlocks(comment.body, 'grove-audit');
  if (richBlocks.length === 0) return { status: 'none', blocks: [] };
  return { status: 'multi', blocks: richBlocks.map(parseBlock) };
}

// --- the two residues (§B.1; INV9, INV10 — both pure set-math) ---

function toSet(v) {
  return v instanceof Set ? v : new Set(v || []);
}

// R_cov = diff_files ∖ ask_covered_files. Pure set difference, in diff order.
// A covered path outside diff_files is harmless surplus (Terms).
export function coverageResidue(diffFiles, askCovered) {
  const covered = toSet(askCovered);
  return (diffFiles || []).filter((f) => !covered.has(f));
}

function treeGet(tree, path) {
  if (tree == null) return undefined;
  if (typeof tree.get === 'function') return tree.get(path);
  return tree[path];
}

// R_judg = { f ∈ R_cov : f in-jurisdiction ∧ no HEAD frontmatter `type:` }.
// In `strict` mode in-jurisdiction = diff_files; in `scoped` mode it is the
// spec-0002 §C.2 step-0 subset (scope.mjs, cited not respelled). The type
// basis is ANY frontmatter `type:` declaration, recognized or not
// (frontmatter.mjs) — a typed file is deterministically resolved and never
// needs a disposition.
export function judgmentResidue({ diffFiles, askCovered, tree, policy } = {}) {
  const scoped = policy != null && policy.scope === 'scoped';
  return coverageResidue(diffFiles, askCovered).filter((f) => {
    if (scoped && !inJurisdiction(f, tree, policy)) return false;
    return artifactMeta(treeGet(tree, f)).type == null;
  });
}

// The residue-conditional rule (§B.2, INV11): empty R_judg => no audit owed.
export function auditOwed(rJudg) {
  return toSet(rJudg).size > 0;
}

// --- policy carriers (Terms: discovered from the §C.1 assembly, never
// hardcoded — a new declaration file changes the set, hence the fingerprint) ---

export function policyCarriers(policy) {
  const out = [];
  if (policy && policy.reviewPolicyPath != null) out.push(policy.reviewPolicyPath);
  for (const p of (policy && policy.declarationPaths) || []) out.push(p);
  return out;
}

// --- the typed record stream and its high-water mark (§C.3.3) ---

// A comment is a typed-record-stream member iff it carries at least one
// EXACT-TAG grove-review-ask or grove-verdict opening fence — well-formed or
// not (a recognized fence with a malformed/unclosed block still counts,
// fail-closed in the invalidating direction). A typo'd tag never registers
// under the inherited tokenizer (blocks.mjs), so it neither covers nor
// stales; prose and grove-audit blocks are never members (F6).
function carriesTypedFence(body) {
  return (
    extractTaggedBlocks(body, 'grove-review-ask').length > 0 ||
    extractTaggedBlocks(body, 'grove-verdict').length > 0
  );
}

// The HWM over ONE comment-stream snapshot: highest typed comment id, or the
// pinned sentinel 0 over a typed-record-free stream (§C.1, F2 — under which
// any future typed comment stales, fail-closed).
export function typedRecordHwm(comments) {
  let hwm = 0;
  for (const c of comments || []) {
    if (typeof c.id === 'number' && c.id > hwm && carriesTypedFence(c.body)) hwm = c.id;
  }
  return hwm;
}

// The typed-record comments past a given HWM, in stream order (§C.3 rule 3's
// invalidating class; §D.1 metric 5's race count). Exported so the comparator
// counts races over the SAME membership rule freshness stales on — one home,
// never a second implementation (spec-0003 §D.1, phase 2).
export function typedRacesPast(comments, hwm) {
  return (comments || []).filter(
    (c) => typeof c.id === 'number' && c.id > hwm && carriesTypedFence(c.body),
  );
}

// --- freshness (§C.3; INV13 — evaluated, during shadow only reported) ---

// An audit record is fresh iff all three bindings recompute equal:
//   content — grove-fp-1 over the CURRENT diff_files at the CURRENT HEAD;
//   policy  — grove-fp-1 over the policy carriers at the CURRENT protected-
//             branch commit (content OR membership change stales);
//   stream  — no comment past record_hwm carries a typed exact-tag fence.
// Returns { fresh, stale: ['content'|'policy'|'stream'] } naming each failed
// binding (§D.1 metric 4 consumes the name).
export function auditFreshness(record, { diffFiles, tree, carrierPaths, protectedTree, comments } = {}) {
  const stale = [];
  if (groveFp1(diffFiles || [], tree) !== record.content_fingerprint) stale.push('content');
  if (groveFp1(carrierPaths || [], protectedTree) !== record.policy_fingerprint) stale.push('policy');
  if (typedRacesPast(comments, record.record_hwm).length > 0) stale.push('stream');
  return { fresh: stale.length === 0, stale };
}

// --- auditor separation (§C.4; INV14) ---

// P = the `producer` values plus every ask record's `resumed_by` value, drawn
// from every SCHEMA-VALID grove-review-ask and grove-verdict block in the
// full stream — admissible or not (rejection never un-produces). Reviewers
// are not producers; verdicts contribute `producer` only.
export function separationSet(comments) {
  const p = new Set();
  for (const c of comments || []) {
    for (const b of parseAskComment(c).blocks) {
      if (b.status !== 'record') continue;
      p.add(b.record.producer);
      if (b.record.resumed_by != null) p.add(b.record.resumed_by);
    }
    for (const b of parseComment(c).blocks) {
      if (b.status !== 'record') continue;
      p.add(b.record.producer);
    }
  }
  return p;
}

// §C.4: spec-0002 §A.4 inherited whole (records.mjs checkAdmissibility),
// PLUS the separation rule: auditor ∈ P => inadmissible. Same trusted-
// self-reported tier as spec-0002 §C.4 — no new concession class.
export function checkAuditAdmissibility(comment, record, { posterPolicy = {}, producers } = {}) {
  const base = checkAdmissibility(comment, posterPolicy);
  if (!base.admissible) return base;
  if (toSet(producers).has(record.auditor)) {
    return { admissible: false, cause: 'auditor-separation' };
  }
  return { admissible: true };
}

// --- vacuity, one level up (§C.5; INV15) ---

// A per-R_judg-file disposition is required; a missing entry, or one whose
// `why` is empty/whitespace, satisfies NOTHING for that path. `owed: []` with
// a non-empty `why` satisfies ("owes nothing", stated). An audit body empty
// of dispositions satisfies nothing.
export function dispositionCoverage(record, rJudg) {
  const satisfied = [];
  const unsatisfied = [];
  for (const path of rJudg || []) {
    const entry = record.dispositions[path];
    if (entry == null) unsatisfied.push({ path, cause: 'missing-disposition' });
    else if (entry.why.trim() === '') unsatisfied.push({ path, cause: 'vacuous-why' });
    else satisfied.push(path);
  }
  return { satisfied, unsatisfied };
}

// --- serializer + emitter (§C.2) ---

const FENCE_LINE = /(^|\n)\s*`{3,}/;

function yamlScalar(v) {
  return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function requireScalar(name, v) {
  if (!isNonEmptyString(v)) throw new Error(`serializeAudit: ${name} must be a non-empty string`);
  if (/[\n\r]/.test(v)) throw new Error(`serializeAudit: ${name} must be single-line`);
  return v.trim();
}

// A 3+-backtick line inside the block would terminate the fence early
// (spec-0002 §A.1 delimitation) — refuse rather than emit a broken record.
function requireFenceSafe(name, text) {
  if (FENCE_LINE.test(text)) {
    throw new Error(`serializeAudit: ${name} must not contain a code-fence line`);
  }
  return text;
}

function pushBlockScalar(lines, indent, key, text) {
  requireFenceSafe(key, text);
  if (text === '') {
    // transcription, adr-0015: an empty judgment text is emitted as a bare
    // key (parses to '' => vacuous at evaluation), never invented content
    lines.push(`${indent}${key}:`);
    return;
  }
  lines.push(`${indent}${key}: |`);
  for (const l of String(text).split(/\r\n?|\n/)) lines.push(l === '' ? '' : `${indent}  ${l}`);
}

// Serialize a §C.1 record object into one fenced grove-audit block. The
// output is exactly what parseAuditComment accepts (round-trip by
// construction). Fails LOUDLY on anything unserializable.
export function serializeAudit(record) {
  const lines = ['```grove-audit', 'schema: 1'];
  lines.push(`auditor: ${yamlScalar(requireScalar('auditor', record.auditor))}`);
  const coverage = Object.entries(record.coverage_residue || {});
  if (coverage.length === 0) lines.push('coverage_residue:');
  else {
    lines.push('coverage_residue:');
    for (const [p, h] of coverage) lines.push(`  ${p}: ${h}`);
  }
  lines.push(`content_fingerprint: ${yamlScalar(requireScalar('content_fingerprint', record.content_fingerprint))}`);
  lines.push(`policy_fingerprint: ${yamlScalar(requireScalar('policy_fingerprint', record.policy_fingerprint))}`);
  if (!Number.isInteger(record.record_hwm) || record.record_hwm < 0) {
    throw new Error('serializeAudit: record_hwm must be a non-negative integer');
  }
  lines.push(`record_hwm: ${record.record_hwm}`);
  const flagged = record.flagged || [];
  if (flagged.length === 0) lines.push('flagged: []');
  else {
    lines.push('flagged:');
    for (const row of flagged) {
      lines.push('  -');
      lines.push(`    path: ${yamlScalar(requireScalar('flagged path', row.path))}`);
      lines.push(`    cause: ${yamlScalar(requireScalar('flagged cause', row.cause))}`);
      if (row.comment != null) lines.push(`    comment: ${row.comment}`);
    }
  }
  const dispositions = Object.entries(record.dispositions || {});
  if (dispositions.length === 0) lines.push('dispositions:');
  else {
    lines.push('dispositions:');
    for (const [path, entry] of dispositions) {
      if (!isPlainObject(entry) || !Array.isArray(entry.owed) || typeof entry.why !== 'string') {
        throw new Error(`serializeAudit: disposition for ${path} must be { owed: list, why: string }`);
      }
      lines.push(`  ${path}:`);
      lines.push(`    owed: [${entry.owed.map((r) => yamlScalar(requireScalar('owed review id', r))).join(', ')}]`);
      pushBlockScalar(lines, '    ', 'why', entry.why);
    }
  }
  if (record.findings != null) pushBlockScalar(lines, '', 'findings', String(record.findings));
  if (record.audited_at_commit != null) {
    lines.push(`audited_at_commit: ${yamlScalar(requireScalar('audited_at_commit', record.audited_at_commit))}`);
  }
  lines.push('```');
  return lines.join('\n');
}

// emitAudit — the machine half of §C.2, one call:
//   judgment       — the auditor's { auditor, dispositions, findings? }
//   diffFiles      — the §C.2/Terms diff_files (HEAD-present paths)
//   asks           — [{ record, commentId }] ADMISSIBLE schema-valid ask
//                    records (callers gate via records.mjs checkAdmissibility)
//   reviewlessTypes— the protected-branch policy's positive declaration
//   tree           — the HEAD tree (frontmatter type basis + per-path hashes)
//   carrierPaths   — policyCarriers(policy) at the protected-branch commit
//   protectedTree  — the protected-branch tree (policy fingerprint basis)
//   comments       — the ONE comment-stream snapshot the auditor derived from
//                    (one read, one watermark — §C.2, N3)
//   auditedAtCommit— optional informational field, never freshness authority
// Returns { record, block }. The judgment passes through transcribed; every
// binding is stamped from this package's own recomputable code (INV12).
export function emitAudit({
  judgment,
  diffFiles = [],
  asks = [],
  reviewlessTypes = [],
  tree,
  carrierPaths = [],
  protectedTree,
  comments = [],
  auditedAtCommit,
} = {}) {
  if (!isPlainObject(judgment)) throw new Error('emitAudit: judgment must be an object');
  const dispositions = judgment.dispositions == null ? {} : judgment.dispositions;
  if (!isPlainObject(dispositions)) throw new Error('emitAudit: judgment.dispositions must be a map');
  // ONE HEAD-frontmatter basis for effectiveness, residues, and flagged rows
  // (the adr-0015 shared-basis discipline, applied to the audit itself).
  const ctx = {
    typeOf: (p) => artifactMeta(treeGet(tree, p)).type,
    reviewlessTypes,
  };
  const rCov = coverageResidue(diffFiles, askCoveredFiles(asks, ctx));
  const coverage_residue = {};
  for (const p of rCov) coverage_residue[p] = pathHashAt(tree, p);
  const record = {
    schema: 1,
    auditor: judgment.auditor,
    coverage_residue,
    content_fingerprint: groveFp1(diffFiles, tree),
    policy_fingerprint: groveFp1(carrierPaths, protectedTree),
    record_hwm: typedRecordHwm(comments),
    flagged: flaggedRows(asks, ctx),
    dispositions,
    ...(judgment.findings != null ? { findings: String(judgment.findings) } : {}),
    ...(auditedAtCommit != null ? { audited_at_commit: String(auditedAtCommit) } : {}),
  };
  const block = serializeAudit(record); // throws loudly on unserializable judgment
  return { record, block };
}
