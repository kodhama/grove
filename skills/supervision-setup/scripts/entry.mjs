/** Entry detection shared by importable command-line scripts. */
import { realpathSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Use the runtime's entry flag, or compare both realpaths on older runtimes. */
export function isEntry(meta) {
  if (meta.main !== undefined) return meta.main;
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(meta.url));
  } catch {
    return false;
  }
}
