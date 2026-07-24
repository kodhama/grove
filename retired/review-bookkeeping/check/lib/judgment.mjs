// The judgment handoff shape (adr-0015 Decision 1 + Consequence 4).
//
// A reviewer emits ONLY its judgment — the verdict token, the subject (paths
// it reviewed), the findings, and the producer/reviewer attribution (the
// separation authority, adr-0012 AC7). It is CI-agnostic FROM THE REVIEWER'S
// SIDE: it carries NOTHING about grove-fp-1, manifest_hashes, the §A.2 record
// envelope, the check, or the pull request — a reviewer emitting it knows
// nothing of CI. The machine (the record-emitter) turns this into the stamped
// §A.2 record; the reviewer never sees that transformation.
//
// Carrier: a fenced `grove-review-judgment` block containing YAML, mirroring
// grove's `grove-verdict` / `grove-review-declaration` / `grove-test-deps`
// machine-readable fenced-block precedent. `schema` is the judgment block's OWN
// version (not the record schema — the reviewer's side stays record-oblivious).

import { parseYaml, YamlError } from './yaml.mjs';
import { extractFencedBlocks } from './blocks.mjs';

export class JudgmentError extends Error {}

const REVIEWS = new Set(['conformance', 'code-reviewer', 'spec-adversary', 'decision-adversary']);

// Return the raw inner text of every fenced grove-review-judgment block.
export function extractJudgmentBlocks(body) {
  return extractFencedBlocks(body, 'grove-review-judgment');
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

// parseJudgment(innerText) -> { review, verdict, subject:[...], producer,
//                               reviewer, findings }
// Fail-closed: any structural defect throws JudgmentError (never a silently
// degraded judgment). The parse is deliberately narrow — exactly the reviewer's
// natural output, no record/fingerprint fields.
export function parseJudgment(innerText) {
  let obj;
  try {
    obj = parseYaml(innerText);
  } catch (e) {
    throw new JudgmentError(
      `judgment block is not parseable YAML: ${e instanceof YamlError ? e.message : e}`,
    );
  }
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new JudgmentError('judgment block must be a YAML mapping');
  }
  if (obj.schema !== 1) {
    throw new JudgmentError(`unsupported judgment schema: ${JSON.stringify(obj.schema)} (expected 1)`);
  }
  if (!REVIEWS.has(obj.review)) {
    throw new JudgmentError(`unknown review: ${JSON.stringify(obj.review)}`);
  }
  if (!isNonEmptyString(obj.verdict)) {
    throw new JudgmentError('verdict must be a non-empty string');
  }
  if (!Array.isArray(obj.subject) || obj.subject.length === 0) {
    throw new JudgmentError('subject must be a non-empty list of paths');
  }
  const subject = [];
  for (const s of obj.subject) {
    if (!isNonEmptyString(s)) throw new JudgmentError(`subject entries must be non-empty path strings: ${JSON.stringify(s)}`);
    subject.push(s);
  }
  if (!isNonEmptyString(obj.producer)) {
    throw new JudgmentError('producer (the agent that produced the subject) is required (adr-0012 AC7)');
  }
  if (!isNonEmptyString(obj.reviewer)) {
    throw new JudgmentError('reviewer (the agent that produced this judgment) is required (adr-0012 AC7)');
  }
  if (!('findings' in obj)) {
    throw new JudgmentError('findings key is required (it may be empty — that yields a vacuous record)');
  }
  const findings = obj.findings == null ? '' : String(obj.findings);
  return {
    review: obj.review,
    verdict: String(obj.verdict),
    subject,
    producer: String(obj.producer),
    reviewer: String(obj.reviewer),
    findings,
  };
}
