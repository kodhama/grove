#!/usr/bin/env node
import path from "node:path";
import {
  buildProjectionSet,
  checkProjectionSet,
  writeProjectionSet,
} from "../lib/generate.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");
const args = new Set(process.argv.slice(2));
const unknown = [...args].filter((arg) => arg !== "--check");
if (unknown.length > 0) {
  console.error(`unknown arguments: ${unknown.join(", ")}`);
  process.exitCode = 2;
} else {
  try {
    const outputs = await buildProjectionSet({ repoRoot });
    if (args.has("--check")) {
      const result = await checkProjectionSet({ repoRoot, outputs });
      if (!result.ok) {
        for (const name of result.stale) console.error(`stale: ${name}`);
        for (const name of result.missing) console.error(`missing: ${name}`);
        for (const name of result.unexpected) {
          console.error(`unexpected: ${name}`);
        }
        process.exitCode = 1;
      } else {
        console.log(`generated projections clean (${outputs.size} files)`);
      }
    } else {
      await writeProjectionSet({ repoRoot, outputs });
      console.log(`generated ${outputs.size} projections`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
