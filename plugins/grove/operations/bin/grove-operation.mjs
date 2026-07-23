#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyPlan,
  describeOperation,
  planRefresh,
  planRemove,
  planSetProfile,
  planSetup,
} from '../lib/lifecycle.mjs';

const planners = {
  setup: planSetup,
  refresh: planRefresh,
  'set-profile': planSetProfile,
  remove: planRemove,
};

async function main(argv) {
  const [command, subject, requestPath] = argv;
  if (command === 'describe') {
    if (!subject) usage();
    process.stdout.write(`${JSON.stringify(describeOperation(subject), null, 2)}\n`);
    return;
  }
  if (command === 'plan') {
    const planner = planners[subject];
    if (!planner || !requestPath) usage();
    const request = JSON.parse(await readFile(resolve(requestPath), 'utf8'));
    request.repoRoot = resolve(request.repoRoot ?? process.cwd());
    request.packageRoot = resolve(
      request.packageRoot
        ?? dirname(dirname(dirname(fileURLToPath(import.meta.url)))),
    );
    const plan = await planner(request);
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    if (!plan.ok) process.exitCode = 2;
    return;
  }
  if (command === 'apply') {
    if (!subject || !requestPath) usage();
    const plan = JSON.parse(await readFile(resolve(subject), 'utf8'));
    const confirmation = JSON.parse(await readFile(resolve(requestPath), 'utf8'));
    const result = await applyPlan(plan, {
      confirmedActionIds: confirmation.confirmed_action_ids,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  usage();
}

function usage() {
  throw new Error(
    'usage: grove-operation.mjs plan <setup|refresh|set-profile|remove> <request.json> | ' +
    'apply <plan.json> <confirmation.json> | describe <operation>',
  );
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`grove operation failed: ${error.message}\n`);
  process.exitCode = 1;
});
