// Gate-profile machinery (adr-0018).
//
// A gate-profile assigns C2 (who OWNS each gate — `human` | `agent`) to grove's
// four gates: intent / spec / build / ship (D4 — the profile is a single C2
// axis; C1 enforcement strength is grove-fixed and lives in the internal
// enforcement.toml, never here). The four rows in `.grove/gates.toml` ARE the
// source of truth (D7 — an explicit full table, no runtime inheritance to
// resolve); `seeded_from` is a non-authoritative provenance marker only.
//
// The FLOOR (F1): every profile must keep at least one human-owned intent-locus
// gate, where the eligible loci are the front `intent` gate OR `ship`
// (`intent = human` OR `ship = human`). guardian/steward pass at the front;
// initiator passes at ship. An all-agent (both loci agent) profile is illegal.
//
// The load-time floor-guard (D8): whatever reads gates.toml to sequence a run
// validates the floor on every read. When the profile cannot be honored —
// MISSING, UNREADABLE/malformed, or FLOOR-VIOLATING — it falls back to the
// `guardian` preset (the most conservative shipped preset) plus a loud warning.
// One unified rule for every bad state; the floor stays enforced (guardian has a
// human intent gate) and non-silent (the warning).

// The generated third-party parser bundle (adr-0048 D2). It lives under
// runtime/dispatch/lib/ because spec-0004 fixes the installable package root
// to an exact top-level entry list, so a new runtime/vendor/ root would need a
// spec amendment; every runtime that reads a borrowed format imports it from
// there, as lifecycle.mjs already does.
import { parseTomlDocument } from '../../dispatch/lib/parsers.mjs';

// The four gates, in pipeline order.
export const GATE_ROWS = ['intent', 'spec', 'build', 'ship'];

// The intent-locus gates the floor may be satisfied at (F1): the front `intent`
// gate or `ship`. spec/build are NOT intent loci — a human there is irrelevant
// to the floor.
export const INTENT_LOCUS_GATES = ['intent', 'ship'];

const C2_VALUES = ['human', 'agent'];

// D3 — the three shipped presets, pure C2 rows (D4). initiator's distinctness is
// a C2 difference at the FRONT intent gate (agent), not a C1 difference (F1 fix).
export const PRESETS = Object.freeze({
  guardian: Object.freeze({ intent: 'human', spec: 'human', build: 'agent', ship: 'human' }),
  steward: Object.freeze({ intent: 'human', spec: 'agent', build: 'agent', ship: 'human' }),
  initiator: Object.freeze({ intent: 'agent', spec: 'agent', build: 'agent', ship: 'human' }),
});

// D1 — the shipped default preset (setup seeds this unless the user opts otherwise).
export const DEFAULT_PRESET = 'steward';

// D8 — the unified fallback preset when a profile cannot be honored.
export const FALLBACK_PRESET = 'guardian';

// Expand a named preset into { seededFrom, gates }. The rows are a fresh copy —
// the caller owns them (the file, not the preset, is the source of truth once
// written). Throws on an unknown name (never silently defaults).
export function expandPreset(name) {
  const rows = PRESETS[name];
  if (rows == null) {
    throw new Error(`unknown preset "${name}" — known presets: ${Object.keys(PRESETS).join(', ')}`);
  }
  return { seededFrom: name, gates: { ...rows } };
}

// The FLOOR validator (F1). Reads the four rows DIRECTLY. Returns
// { ok, reason? }. Rejects: a non-object, a missing row, an UNKNOWN/extra row
// (the exact GATE_ROWS set, never a superset — a stray gate key is a consumer
// error worth catching), an invalid C2 value, and — the load-bearing check —
// 0 human-owned intent-locus gates.
export function validateFloor(gates) {
  if (gates == null || typeof gates !== 'object') {
    return { ok: false, reason: 'no gate rows to validate' };
  }
  for (const row of GATE_ROWS) {
    const v = gates[row];
    if (v == null) return { ok: false, reason: `missing gate row "${row}"` };
    if (!C2_VALUES.includes(v)) {
      return { ok: false, reason: `gate "${row}" has invalid C2 value ${JSON.stringify(v)} (expected "human" | "agent")` };
    }
  }
  for (const k of Object.keys(gates)) {
    if (!GATE_ROWS.includes(k)) {
      return { ok: false, reason: `unknown gate row "${k}" (the gate set is exactly ${GATE_ROWS.join(', ')})` };
    }
  }
  const humanLoci = INTENT_LOCUS_GATES.filter((g) => gates[g] === 'human');
  if (humanLoci.length === 0) {
    return {
      ok: false,
      reason: `floor violated: 0 human intent-locus gates (need intent = human OR ship = human; both are "agent")`,
    };
  }
  return { ok: true };
}

// gates.toml is TOML, and TOML is read by the dependency now (adr-0048 D1/D3).
// What stays hand-written is the SHAPE — and that is not a stylistic
// preference, it is the security property this function used to carry in its
// narrowness. The old reader accepted `"string"`, bool and `["a","b"]` and
// nothing else, and its comment said why: "a malformed profile must NOT parse
// into a half-populated object that could sneak past the floor; the guard
// treats a throw as 'unreadable' and falls back". A permissive parser accepts
// those same inputs SUCCESSFULLY, so swapping the syntax layer and stopping
// there would stop the loud D8 fallback from ever firing on them.
//
// So the split is D1's, applied in two layers with the second one right behind
// the first: the LIBRARY decides what is legal TOML, `assertGatesShape` decides
// which legal documents are a gate profile, and it throws the same class of
// error the line reader threw so `resolveProfile`'s fallback path is unchanged.
//
// WHAT THE SHAPE CONSTRAINS, and what it deliberately does not. It constrains
// VALUE TYPES and NESTING DEPTH — the two things adr-0018 D7 actually declares
// about this file ("an explicit full table", top-level scalars plus one level
// of `[section]`). It does NOT constrain key or string SPELLING: a dotted key,
// a quoted key, a quoted section header, a literal string and a multi-line
// string are legal TOML spellings of documents already inside the shape, and
// grove does not define TOML, so it does not get to be stricter than the parser
// it delegates to. Those spellings used to throw and drop the consumer to
// guardian; they are now read as what they say.
//
// MEASURED SCOPE, recorded so the claim is no larger than the evidence. The
// FLOOR was never reachable past `validateFloor` under either reader: an
// all-agent profile spelled with dotted keys, an inline table, quoted keys or
// literal strings fell back to guardian both before and after, because the
// floor validator reads the four rows whatever spelled them. What the
// narrowness actually protected is CONSERVATISM ELSEWHERE IN THE FILE — a
// `[trigger]` key holding a number forced the guardian fallback, and without
// `assertGatesShape` it would silently stop doing so and honour whatever
// weaker profile the file declares.

// The values a gates.toml entry may hold (adr-0018 D7). Anything else — a
// number, a float, a date or time, an inline table, a mixed or nested array —
// is outside the declared shape.
function isDeclaredValue(value) {
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

// A `[section]`: a plain table, and plain is load-bearing. smol-toml returns a
// TomlDate for every date and time form, and `typeof` reports that as an
// object — so a prototype check, not a `typeof`, is what keeps a datetime from
// being read as an empty section.
function isSection(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function assertGatesShape(root) {
  for (const [key, value] of Object.entries(root)) {
    if (isDeclaredValue(value)) continue;
    if (isSection(value)) {
      for (const [inner, innerValue] of Object.entries(value)) {
        if (isDeclaredValue(innerValue)) continue;
        throw new Error(
          `gates.toml: [${key}] ${inner} is outside the declared shape `
            + '(a string, a boolean, or an array of strings)',
        );
      }
      continue;
    }
    throw new Error(
      `gates.toml: ${key} is outside the declared shape (a string, a boolean, `
        + 'an array of strings, or one level of table)',
    );
  }
}

// Reads gates.toml (D7). Throws on anything the parser refuses AND on anything
// outside the shape above — a malformed profile must NOT parse into a
// half-populated object that could sneak past the floor; the guard treats a
// throw as "unreadable" and falls back.
export function parseGatesToml(text) {
  if (typeof text !== 'string') throw new Error('gates.toml: no text to parse');
  let root;
  try {
    root = parseTomlDocument(text);
  } catch (error) {
    // WRAPPED (adr-0048): every parse call site is wrapped, and this one is
    // re-framed rather than re-thrown raw so the message keeps naming the file
    // the operator has to fix. `resolveProfile` reports it as "unreadable".
    throw new Error(`gates.toml: ${error && error.message}`);
  }
  assertGatesShape(root);
  // adr-0021 D2, fail-closed (code-review HIGH on 670759d): a DECLARED
  // top-level runtime_dir that is not a non-empty string (boolean, array,
  // empty/whitespace-only) is wrong-but-present — THROW so it routes through
  // the loud guardian fallback (exit 2 + warning), exactly the charter's
  // "wrong-but-present fails loudly" semantics. A silent narrow-to-null here
  // would make it indistinguishable from never-declared, defeating the
  // declared-vs-missing distinction. (A NUMBER runtime_dir is refused one line
  // earlier by the shape check, which names the shape rather than the key —
  // still a throw, still the loud fallback.)
  if ('runtime_dir' in root) {
    if (typeof root.runtime_dir !== 'string' || root.runtime_dir.trim() === '') {
      throw new Error(
        `gates.toml: runtime_dir must be a non-empty string path, got ${JSON.stringify(root.runtime_dir)}`,
      );
    }
  }
  return {
    seededFrom: typeof root.seeded_from === 'string' ? root.seeded_from : null,
    // adr-0021 D2 — optional top-level key: where the gates machinery lives
    // (<runtime_dir>/bin/resolve-profile.mjs). Absent (null) means the caller
    // assumes the installed default `.grove/internal/gates/`. Declared, never
    // searched — the key keeps "declared elsewhere on purpose" distinguishable
    // from "missing, broken" (adr-0018 D8 stays loud). Top-level only: a
    // runtime_dir inside [gates] is an unknown gate row and fails the floor
    // validator's strictness. The value passes through VERBATIM — no trim or
    // normalization — so a whitespace-padded path is surfaced as written
    // (visibly padded, loud at invocation), never silently rewritten.
    runtimeDir: 'runtime_dir' in root ? root.runtime_dir : null,
    gates: root.gates || {},
    trigger: root.trigger || {},
    intentExternal: root.intent_external || {},
  };
}

// The loud fallback warning (D8). Named so callers surface an identical message.
//
// Names the OPERATION, not a host invocation. This said "run /grove:set-profile
// <preset>", which is the Claude slash form, and `resolveProfile` has no host to
// resolve it against — `resolve-profile.mjs` takes none — so every Codex user
// with an unreadable gates.toml was told to run a command their host does not
// have. The lifecycle layer resolves the invocation through
// `adapter.set_profile_command`; this layer cannot, so it says the neutral thing
// rather than guessing.
export function fallbackWarning(cause) {
  return (
    `gates.toml ${cause} — running at ${FALLBACK_PRESET} (human at intent + spec + ship) ` +
    `until restored; run Grove's set-profile operation to rebuild it.`
  );
}

// D8 — the load-time floor-guard. Resolve the effective gate-profile from an
// on-disk gates.toml (passed as `text`; `null` means the file is missing). A
// caller that hit an I/O error reading the file (a NON-ENOENT failure —
// permissions, I/O) passes `ioErrorMessage` so it is reported as "unreadable",
// distinct from a genuinely absent file. Returns
// { gates, seededFrom, source: 'file'|'fallback', warning, floor }. One unified
// rule: MISSING (text null) | UNREADABLE (I/O error, or parse throws) |
// FLOOR-VIOLATING (validateFloor fails) => the guardian fallback + a loud
// warning. A clean, floor-satisfying file resolves as-is with warning === null.
export function resolveProfile({ text, ioErrorMessage = null } = {}) {
  const fallback = (cause) => {
    const gates = { ...PRESETS[FALLBACK_PRESET] };
    return {
      gates,
      seededFrom: FALLBACK_PRESET,
      source: 'fallback',
      warning: fallbackWarning(cause),
      floor: validateFloor(gates),
    };
  };

  if (ioErrorMessage != null) return fallback(`unreadable (${ioErrorMessage})`);
  if (text == null) return fallback('missing');

  let parsed;
  try {
    parsed = parseGatesToml(text);
  } catch (e) {
    return fallback(`unreadable (${e && e.message ? e.message : 'parse error'})`);
  }

  const floor = validateFloor(parsed.gates);
  if (!floor.ok) return fallback(`floor-violating (${floor.reason})`);

  return {
    gates: parsed.gates,
    seededFrom: parsed.seededFrom,
    source: 'file',
    warning: null,
    floor,
    // adr-0021 D2 — surface runtime_dir only when the file declares it, so the
    // resolved output on a profile WITHOUT the key stays byte-identical (AC2:
    // zero migration for existing installs).
    ...(parsed.runtimeDir != null ? { runtimeDir: parsed.runtimeDir } : {}),
  };
}
