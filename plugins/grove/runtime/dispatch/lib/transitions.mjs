// Transition-rule validation (spec-0006 §Transition rules as data;
// INV13–INV15). The dispatcher charter remains authoritative for the rules'
// meaning; this module validates their evaluable encoding with a closed
// grammar and rejects — never trusts — every itinerary shape S15 names.
import { parseTomlDocument } from './parsers.mjs';

export const RECORD_TYPES = Object.freeze([
  'conformance',
  'decision-adversary',
  'spec-adversary',
  'code-review',
]);

export const SUBJECT_CLASSES = Object.freeze([
  'missing',
  'decision',
  'spec',
  'charter',
  'reviewless',
  'unclaimed',
  'code',
  'implements-bearing',
]);

const TRANSITION_KEYS = Object.freeze(['id', 'fire', 'preconditions', 'postconditions']);
const ID_GRAMMAR = /^t-[a-z0-9][a-z0-9-]*$/;
// The class position admits a ` ∪ `-joined union of subject-class table rows:
// the spec's own Initial rule set writes its classes as unions, so the
// evaluable encoding carries them the same way. (Disclosed concretization —
// the grammar line names one row; the rule set requires unions.)
const CHANGED = /^changed\(([a-z-]+(?: ∪ [a-z-]+)*), \$s\)$/;
const RECORD = /^record\(([a-z-]+), \$s\)$/;
const NO_RECORD = /^no-record\(([a-z-]+), \$s\)$/;

export function parsePredicate(text) {
  if (typeof text !== 'string') return null;
  const changed = text.match(CHANGED);
  if (changed) {
    const classes = changed[1].split(' ∪ ');
    if (classes.some((item) => !SUBJECT_CLASSES.includes(item))) return null;
    if (new Set(classes).size !== classes.length) return null;
    return { form: 'changed', classes, text };
  }
  const record = text.match(RECORD);
  if (record) {
    if (!RECORD_TYPES.includes(record[1])) return null;
    return { form: 'record', recordType: record[1], text };
  }
  const noRecord = text.match(NO_RECORD);
  if (noRecord) {
    if (!RECORD_TYPES.includes(noRecord[1])) return null;
    return { form: 'no-record', recordType: noRecord[1], text };
  }
  return null;
}

export function validateTransitions(root) {
  const rootKeys = Object.keys(root ?? {});
  for (const key of rootKeys) {
    if (key !== 'schema' && key !== 'transition') {
      throw new Error(`transitions.toml: undeclared root key "${key}"`);
    }
  }
  if (root?.schema !== 1) {
    throw new Error(
      `transitions.toml: schema must be 1, found ${JSON.stringify(root?.schema)}`,
    );
  }
  if (!Array.isArray(root.transition) || root.transition.length === 0) {
    throw new Error('transitions.toml: at least one [[transition]] is required');
  }

  const seenIds = new Set();
  const transitions = [];
  root.transition.forEach((table, index) => {
    const label = typeof table.id === 'string' && table.id !== ''
      ? `transition "${table.id}"`
      : `transition #${index + 1}`;

    for (const key of Object.keys(table)) {
      if (!TRANSITION_KEYS.includes(key)) {
        // No key exists for naming a successor, a next step, a phase, or an
        // ordering (INV15) — reject every undeclared key, whatever its name.
        throw new Error(`transitions.toml: ${label}: undeclared key "${key}"`);
      }
    }
    if (typeof table.id !== 'string' || !ID_GRAMMAR.test(table.id)) {
      throw new Error(
        `transitions.toml: ${label}: id ${JSON.stringify(table.id)} fails ^t-[a-z0-9][a-z0-9-]*$`,
      );
    }
    if (seenIds.has(table.id)) {
      throw new Error(`transitions.toml: duplicate transition id "${table.id}"`);
    }
    seenIds.add(table.id);
    if (typeof table.fire !== 'string' || table.fire.trim() === '') {
      throw new Error(`transitions.toml: ${label}: fire must be one non-empty action`);
    }

    const preconditions = parsePredicateList(table.preconditions, label, 'preconditions');
    if (preconditions.length === 0) {
      throw new Error(
        `transitions.toml: ${label}: preconditions shall be non-empty — a bare `
          + 'event → agent pair is the itinerary shape this schema rejects',
      );
    }
    const postconditions = parsePredicateList(table.postconditions, label, 'postconditions');

    const namedRecords = postconditions.filter((item) => item.form === 'record');
    if (namedRecords.length === 0) {
      throw new Error(
        `transitions.toml: ${label}: postconditions name no record — every `
          + 'transition names at least one record whose absence its preconditions entail',
      );
    }
    for (const posted of namedRecords) {
      const guard = `no-record(${posted.recordType}, $s)`;
      if (!preconditions.some((item) => item.text === guard)) {
        throw new Error(
          `transitions.toml: ${label}: postcondition "${posted.text}" requires `
            + `"${guard}" among the preconditions (self-disabling check)`,
        );
      }
    }
    transitions.push({
      id: table.id,
      fire: table.fire,
      preconditions,
      postconditions,
    });
  });
  return transitions;
}

function parsePredicateList(value, label, field) {
  if (!Array.isArray(value)) {
    throw new Error(`transitions.toml: ${label}: ${field} must be an array of predicates`);
  }
  return value.map((item) => {
    const predicate = parsePredicate(item);
    if (!predicate) {
      throw new Error(
        `transitions.toml: ${label}: undeclared predicate form in ${field}: `
          + `${JSON.stringify(item)}`,
      );
    }
    return predicate;
  });
}

export function loadTransitions(text) {
  let root;
  try {
    root = parseTomlDocument(text);
  } catch (error) {
    throw new Error(`transitions.toml: ${error.message}`);
  }
  return validateTransitions(root);
}
