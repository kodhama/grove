#!/usr/bin/env node
// Run-operation CLI (spec-0006 §The confirm-gate extension), mirroring
// runtime/lifecycle/bin/grove-operation.mjs: describe / plan / apply.
// These are runtime operations invoked by the entry skills — NOT lifecycle
// skills; they add no row to the lifecycle inventory.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  applyRunPlan,
  describeRunOperation,
  planAbortRun,
  planCloseRun,
  planOpenRun,
} from '../lib/run.mjs';

const planners = {
  'open-run': planOpenRun,
  'close-run': planCloseRun,
  'abort-run': planAbortRun,
};

async function main(argv) {
  const [command, subject, requestPath] = argv;
  if (command === 'describe') {
    if (!subject) usage();
    process.stdout.write(`${JSON.stringify(describeRunOperation(subject), null, 2)}\n`);
    return;
  }
  if (command === 'plan') {
    const planner = planners[subject];
    if (!planner || !requestPath) usage();
    const request = JSON.parse(await readFile(resolve(requestPath), 'utf8'));
    request.repoRoot = resolve(request.repoRoot ?? process.cwd());
    const plan = await planner(request);
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    if (!plan.ok) process.exitCode = 2;
    return;
  }
  if (command === 'apply') {
    if (!subject) usage();
    const plan = JSON.parse(await readFile(resolve(subject), 'utf8'));
    const confirmation = requestPath
      ? JSON.parse(await readFile(resolve(requestPath), 'utf8'))
      : {};
    const result = await applyRunPlan(plan, {
      confirmedActionIds: confirmation.confirmed_action_ids ?? [],
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  usage();
}

function usage() {
  throw new Error(
    'usage: grove-run.mjs plan <open-run|close-run|abort-run> <request.json> | '
      + 'apply <plan.json> [confirmation.json] | describe <operation>',
  );
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`grove run operation failed: ${error.message}\n`);
  process.exitCode = 1;
});
