// The canonical source of plugins/grove/runtime/dispatch/lib/parsers.mjs —
// the generated third-party parser bundle (adr-0048 D1/D2).
//
// THIS FILE IS HAND-WRITTEN AND DELIBERATELY THIN. It is the whole of the
// grove-authored code inside a ~300 KB generated artifact, so anything added
// here ships to every consumer inside a file marked DO NOT EDIT, where nobody
// will look for it. Grove's policy — fail-closed classification, the schema
// clause, the frontmatter delimiter, null-prototype hardening, error mapping —
// lives in the hand-written runtime modules that IMPORT this bundle, never in
// the bundle itself.
//
// The one thing that does belong here is the YAML dialect: spec-0006
// §Frontmatter reading fixes it at "YAML 1.2, core schema" precisely so the
// class of a subject is not decided by a build flag no spec text mentions
// (INV16). Fixing it at this single boundary is what makes that unforgeable by
// a call site.
import { parse as smolTomlParse, stringify as smolTomlStringify } from "smol-toml";
import { parse as yamlParse } from "yaml";

// spec-0006 §Frontmatter reading, second clause; adr-0048 D6.
//
// `logLevel` belongs here for the same reason the dialect does: it is the
// parser's OWN output channel, not a classification policy, and a call site
// that forgot it would write into the guard's report channel. The library
// logs warnings — an unresolved tag, a collection used as a mapping key —
// through `process.emitWarning`, which lands on stderr, which is exactly the
// guard's non-blocking channel (`stop-guard.sh`: "guard 1 -> 1, non-blocking
// stderr report"). A warning interleaved there corrupts an operator report.
//
// MEASURED, and the reason this is `"error"` rather than the obvious
// `"silent"`: at `"silent"` the library stops THROWING as well as logging.
// Under it a multi-document stream returns its first document instead of
// throwing, and a duplicate key resolves last-wins — the two fail-closed
// properties spec-0006 INV28 and §Frontmatter reading depend on, both lost
// silently. `"error"` suppresses the warning log and keeps every throw.
const YAML_1_2_CORE = Object.freeze({
  version: "1.2",
  schema: "core",
  logLevel: "error",
});

/** Parse one YAML 1.2 core-schema document. Throws on a malformed document. */
export function parseYamlDocument(text) {
  return yamlParse(text, YAML_1_2_CORE);
}

/** Parse one TOML document. Throws on a malformed document. */
export function parseTomlDocument(text) {
  return smolTomlParse(text);
}

/** Serialize a value as TOML. Throws on a value TOML cannot express. */
export function stringifyTomlDocument(value) {
  return smolTomlStringify(value);
}
