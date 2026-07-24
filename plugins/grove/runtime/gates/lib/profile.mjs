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

// A minimal TOML reader for gates.toml's shape (D7): top-level scalars, `[section]`
// headers, and per-key `"string"` / bool / `["a", "b"]` values. Deliberately
// small — gates.toml is a fixed, grove-written shape, not arbitrary TOML.
// Throws on a line it cannot parse (a malformed profile must NOT parse into a
// half-populated object that could sneak past the floor; the guard treats a
// throw as "unreadable" and falls back).
export function parseGatesToml(text) {
  if (typeof text !== 'string') throw new Error('gates.toml: no text to parse');
  const root = {};
  let section = root;
  const lines = text.split(/\r\n?|\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = stripComment(lines[i]);
    const line = raw.trim();
    if (line === '') continue;
    const sectionMatch = line.match(/^\[([A-Za-z0-9_]+)\]$/);
    if (sectionMatch) {
      const name = sectionMatch[1];
      if (!(name in root)) root[name] = {};
      section = root[name];
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!kv) throw new Error(`gates.toml: cannot parse line ${i + 1}: ${JSON.stringify(lines[i])}`);
    // Reject a duplicate key within a section fail-closed (matching
    // check/lib/toml.mjs): a last-wins overwrite is a parse-vs-display
    // divergence — a human reads the first, the parser keeps the last.
    if (Object.prototype.hasOwnProperty.call(section, kv[1])) {
      throw new Error(`gates.toml: duplicate key "${kv[1]}" on line ${i + 1}`);
    }
    section[kv[1]] = parseValue(kv[2].trim(), i + 1);
  }
  // adr-0021 D2, fail-closed (code-review HIGH on 670759d): a DECLARED
  // top-level runtime_dir that is not a non-empty string (boolean, array,
  // empty/whitespace-only) is wrong-but-present — THROW so it routes through
  // the loud guardian fallback (exit 2 + warning), exactly the charter's
  // "wrong-but-present fails loudly" semantics. A silent narrow-to-null here
  // would make it indistinguishable from never-declared, defeating the
  // declared-vs-missing distinction. (Numbers and duplicate keys already
  // throw in parseValue / the duplicate guard.)
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

function stripComment(line) {
  // Strip a `#` comment that is not inside a string. gates.toml carries only
  // simple values, so a `#` outside quotes begins a comment.
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inString = !inString;
    else if (ch === '#' && !inString) return line.slice(0, i);
  }
  return line;
}

function parseValue(v, lineNo) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) return v.slice(1, -1);
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((item) => {
      const s = item.trim();
      if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) return s.slice(1, -1);
      throw new Error(`gates.toml: non-string array item on line ${lineNo}: ${JSON.stringify(s)}`);
    });
  }
  throw new Error(`gates.toml: unsupported value on line ${lineNo}: ${JSON.stringify(v)}`);
}

// The loud fallback warning (D8). Named so callers surface an identical message.
export function fallbackWarning(cause) {
  return (
    `gates.toml ${cause} — running at ${FALLBACK_PRESET} (human at intent + spec + ship) ` +
    `until restored; run /grove:set-profile <preset> to rebuild it.`
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
