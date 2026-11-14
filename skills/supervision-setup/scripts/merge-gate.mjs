/** Run the gate on every load, including imports by a command wrapper. */
import process from "node:process";
import { main } from "./merge-gate-checks.mjs";

process.exitCode = main(process.argv.slice(2));
