#!/usr/bin/env node
import { resolve } from 'node:path';

import { prepareCodexSupportProbe } from '../lib/codex-probe.mjs';

function usage() {
  process.stdout.write(
    'Usage: npm run probe:codex --prefix plugins/grove/release -- [--output <outside-repo-directory>]\n' +
    'Prepares an isolated support-probe bundle and never launches Codex.\n',
  );
}

async function main(argv) {
  let outputRoot = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      usage();
      return;
    }
    if (argument === '--output') {
      const value = argv[index + 1];
      if (!value) throw new Error('--output requires a directory');
      outputRoot = resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }

  const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..', '..');
  const result = await prepareCodexSupportProbe({ repositoryRoot, outputRoot });
  process.stdout.write(
    `Prepared isolated Grove Codex support probe at:\n  ${result.outputRoot}\n\n` +
    'No Codex process was launched and no existing Codex state was read or changed.\n' +
    'Run this command from a separate Terminal window:\n' +
    `  ${result.runCommand}\n\n` +
    'The runner uses fresh CODEX_HOME/CODEX_SQLITE_HOME state, sequential non-ephemeral phases, ' +
    'per-phase timeouts, and retained JSONL evidence.\n',
  );
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`Grove Codex probe preparation failed: ${error.message}\n`);
  process.exitCode = 1;
});
