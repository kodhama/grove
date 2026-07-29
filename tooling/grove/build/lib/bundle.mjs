// The third-party parser bundle and its licence notices (adr-0048 D2/D8/D9).
//
// adr-0048 D2 delivers dependencies through the generate-and-commit pipeline
// grove already has rather than by vendoring source or installing at the
// consumer: the bundler emits ONE generated module into the plugin tree with
// the same GENERATED header and digest every other projection carries, and
// `--check` catches drift. This module is that emitter.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

import {
  BUNDLED_DEPENDENCIES,
  BUNDLER_PACKAGE,
  NOTICES_PATH,
  PARSER_BUNDLE_ENTRY,
  PARSER_BUNDLE_PATH,
  PARSER_BUNDLE_SOURCE,
  PERMITTED_BUNDLE_LICENCES,
} from "../config.mjs";
import { generatedHeader } from "./header.mjs";

// Read in this order; the first that exists is the notice. `LICENSE` covers
// both current dependencies — the list exists so a future permissive
// dependency that spells it differently fails loudly rather than shipping with
// no notice at all.
const LICENCE_FILENAMES = Object.freeze([
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "LICENCE",
  "LICENCE.md",
  "COPYING",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readOptional(absolute) {
  try {
    return await readFile(absolute, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

// One installed package's redistribution facts, read from the INSTALLED tree
// rather than from a hand-kept list: the version and licence id come from its
// own manifest, the notice from its own licence file.
async function dependencyNotice(workspaceRoot, name) {
  const root = path.join(workspaceRoot, "node_modules", name);
  const manifest = await readOptional(path.join(root, "package.json"));
  if (manifest === null) {
    throw new Error(
      `cannot bundle: ${name} is not installed at node_modules/${name} — run \`npm ci\` at the workspace root first`,
    );
  }
  const { version, license } = JSON.parse(manifest);
  if (typeof version !== "string" || version === "") {
    throw new Error(`cannot bundle: ${name} declares no version`);
  }
  if (!PERMITTED_BUNDLE_LICENCES.includes(license)) {
    // adr-0048 D9: permissive only. Copyleft reaches grove's own code where
    // permissive licences never do, so it needs its own decision rather than a
    // build that quietly accepts it.
    throw new Error(
      `cannot bundle: ${name}@${version} is licensed ${JSON.stringify(license)}, which is not one of ${PERMITTED_BUNDLE_LICENCES.join(", ")} (adr-0048 D9)`,
    );
  }

  let text = null;
  for (const filename of LICENCE_FILENAMES) {
    text = await readOptional(path.join(root, filename));
    if (text !== null) break;
  }
  if (text === null || text.trim() === "") {
    throw new Error(
      `cannot bundle: ${name}@${version} ships no licence text (looked for ${LICENCE_FILENAMES.join(", ")}); ${license} requires the notice be reproduced wherever the bytes travel`,
    );
  }
  // The notice is embedded VERBATIM inside a /* */ banner so the bundle's own
  // bytes carry it. A licence text containing the block-comment terminator
  // would end that comment early and silently truncate the notice — and turn
  // the rest of the licence into executable-looking garbage.
  if (text.includes("*/")) {
    throw new Error(
      `cannot bundle: ${name}@${version}'s licence text contains a block-comment terminator and cannot be embedded verbatim`,
    );
  }
  return { name, version, license, text: text.trimEnd() };
}

function noticeSections(notices) {
  return notices
    .map(({ name, version, license, text }) =>
      `--- ${name} ${version} (${license}) ---\n\n${text}\n`)
    .join("\n");
}

// The generated NOTICES.md. `reference/` is a permitted package-root entry
// (spec-0004:238), so this needs no spec-0004 amendment — unlike the
// package-root THIRD-PARTY-NOTICES.md the obvious approach would have written,
// which that same line forbids.
function noticesDocument(notices, entryDigest) {
  return [
    generatedHeader(PARSER_BUNDLE_SOURCE, entryDigest),
    "",
    "# Third-party notices",
    "",
    "Grove redistributes the packages below as bundled bytes inside",
    `\`${PARSER_BUNDLE_PATH.slice("plugins/grove/".length)}\`. Their licences require the`,
    "copyright notice and licence text be reproduced wherever those bytes travel,",
    "so the same text is ALSO emitted as a banner inside the bundle itself — this",
    "file can be separated from the bundle, and the obligation cannot.",
    "",
    "This file is generated from the installed dependency tree (adr-0048 D9). A",
    "hand-written notice file drifts on the first version bump; this one cannot.",
    "",
    ...notices.map(({ name, version, license, text }) => [
      `## ${name} ${version} — ${license}`,
      "",
      "```text",
      text,
      "```",
      "",
    ].join("\n")),
  ].join("\n");
}

// Every package whose bytes actually reached the output, derived from esbuild's
// own metafile rather than from the declaration. This is what catches a
// TRANSITIVE dependency arriving with no notice: the declared list would still
// look complete.
function bundledPackages(metafile) {
  const found = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    const match = input.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//);
    if (match) found.add(match[1]);
  }
  return [...found].sort();
}

export async function buildParserBundle({ buildPackageRoot, workspaceRoot }) {
  const entryAbsolute = path.join(buildPackageRoot, PARSER_BUNDLE_ENTRY);
  const entry = await readOptional(entryAbsolute);
  if (entry === null) {
    throw new Error(`missing parser bundle entry module: ${PARSER_BUNDLE_SOURCE}`);
  }
  const entryDigest = sha256(entry);

  const notices = [];
  for (const name of [...BUNDLED_DEPENDENCIES].sort()) {
    notices.push(await dependencyNotice(workspaceRoot, name));
  }
  const bundlerManifest = await readOptional(
    path.join(workspaceRoot, "node_modules", BUNDLER_PACKAGE, "package.json"),
  );
  if (bundlerManifest === null) {
    throw new Error(
      `cannot bundle: ${BUNDLER_PACKAGE} is not installed — run \`npm ci\` at the workspace root first`,
    );
  }
  const bundlerVersion = JSON.parse(bundlerManifest).version;

  const header = generatedHeader(PARSER_BUNDLE_SOURCE, entryDigest, "//");
  // The SECOND line, and it is load-bearing rather than decorative: the entry
  // module's digest does not determine these bytes on its own. Measured —
  // esbuild 0.21.5, 0.25.0 and 0.28.1 produce three different digests and three
  // different sizes from one unchanged entry module. A reader comparing only
  // the canonical digest would conclude a changed bundle was unchanged.
  const versions =
    `// BUNDLED — ${notices.map(({ name, version, license }) => `${name} ${version} (${license})`).join(", ")}`
    + `; bundler ${BUNDLER_PACKAGE} ${bundlerVersion}. The canonical digest above does not determine these bytes on its own.`;

  const banner = [
    header,
    versions,
    "/*",
    "Third-party notices, reproduced so they travel with the bytes (adr-0048 D9).",
    `The same text is generated to ${NOTICES_PATH}.`,
    "",
    noticeSections(notices),
    "*/",
    // MEASURED, not defensive. esbuild emits `__require(...)` for CommonJS
    // dependencies — and yaml's export map points node at a CommonJS build — but
    // an ES module has no `require`, so those calls throw
    // `Dynamic require of "process" is not supported` the moment yaml's composer
    // is loaded. From a directory with no node_modules that is fatal, which is
    // exactly the shipped situation: the plugin cache has no install step.
    // Binding a real require to this module's own URL is the fix.
    'import { createRequire as __groveCreateRequire } from "node:module";',
    "const require = __groveCreateRequire(import.meta.url);",
    "",
  ].join("\n");

  // REPRODUCIBILITY, measured rather than expected — `--check` compares bytes,
  // so a bundler that is not deterministic turns the digest gate into a source
  // of false drift (adr-0048 Consequences).
  //
  //   same version, same machine, three runs ......... byte-identical
  //   esbuild 0.28.1 on darwin/arm64, linux/arm64 and
  //     linux/amd64 (what CI runs) ................... byte-identical,
  //                                                    sha256 e7654a61…
  //   esbuild 0.21.5 / 0.25.0 / 0.28.1, one entry .... THREE different digests
  //                                                    and three sizes
  //
  // So the exact pin is load-bearing and the caret is not merely discouraged;
  // and the fallback the plan reserved — a recorded-digest bundle.lock.json,
  // strictly weaker because it is verified rather than re-derived — is NOT
  // needed. `absWorkingDir` is the workspace root so every path esbuild writes
  // into the output is repo-relative; no absolute path leaks (grepped).
  const result = await build({
    entryPoints: [path.posix.join("tooling/grove/build", PARSER_BUNDLE_ENTRY)],
    absWorkingDir: workspaceRoot,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    // UNMINIFIED, deliberately (adr-0048 Consequences). Minification roughly
    // halves the size but makes shipped third-party code unreviewable, which
    // cuts against the audit consequence the decision names as its real cost —
    // and it makes the digest far more sensitive to bundler churn.
    minify: false,
    // Keeps upstream's own legal comments where they already are, in addition
    // to the banner above.
    legalComments: "inline",
    banner: { js: banner },
    metafile: true,
    write: false,
  });

  const bundled = bundledPackages(result.metafile);
  const declared = [...BUNDLED_DEPENDENCIES].sort();
  if (JSON.stringify(bundled) !== JSON.stringify(declared)) {
    throw new Error(
      `cannot bundle: the emitted bundle contains ${bundled.join(", ") || "no packages"} but the declared, noticed set is ${declared.join(", ")} — every package whose bytes ship carries a reproduction obligation`,
    );
  }
  if (result.outputFiles.length !== 1) {
    throw new Error(
      `cannot bundle: expected exactly one output file, got ${result.outputFiles.length}`,
    );
  }

  return {
    code: result.outputFiles[0].text,
    notices: noticesDocument(notices, entryDigest),
    dependencies: notices,
    bundlerVersion,
    entryDigest,
  };
}
