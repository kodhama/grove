#!/usr/bin/env node
// grove-guard (spec-0006 §The guard). Deterministic and zero-model: Node,
// filesystem and git only — no model call, no network, no writes.
//
// Direct CLI exit codes: 0 clean (close permitted); 3 owed work (one stdout
// line per enabled instance); 2 defect (one stderr line per defect; owed and
// defect reports both emitted, exit 2 wins); 1 internal error.
//
// Hook mode (--hook, stdin = the Stop hook's JSON): emits the channel-ready
// payload the thin wrapper only maps — supervisor context without the
// continuation flag holds via single-line {"decision":"block","reason":...}
// on stdout exit 0; observer context or stop_hook_active:true reports on
// stderr exit 1; internal errors report "grove-guard error:" on stderr
// exit 4. (The hook-mode payload contract is this implementation's
// concretization — spec-0006 defines the wrapper's mapping, not the
// guard/wrapper division; disclosed.)
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bindSubject,
  collectRecords,
  computeEnabled,
  deriveChangeSet,
} from '../lib/guard-core.mjs';
import { parseCursor } from '../lib/cursor.mjs';
import { loadTransitions } from '../lib/transitions.mjs';

const OBSERVER_CLASSES = new Set(['decision', 'spec', 'charter', 'unclaimed']);

async function main() {
  const args = process.argv.slice(2);
  let repoRoot = process.cwd();
  let hookMode = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--repo') {
      repoRoot = resolve(args[index + 1] ?? '');
      index += 1;
    } else if (args[index] === '--hook') {
      hookMode = true;
    } else {
      throw new Error(`unknown argument: ${args[index]}`);
    }
  }
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

  let hookInput = {};
  if (hookMode) hookInput = await readHookInput();

  const evaluation = await evaluate({ repoRoot, packageRoot });

  if (!hookMode) {
    for (const instance of evaluation.enabled) {
      process.stdout.write(`${owedLine(instance)}\n`);
    }
    // §Staleness: the guard lists every open cursor at every guard moment —
    // one line, riding the hold/defect output (a clean exit 0 stays silent).
    if (
      evaluation.openCursors.length > 0
      && (evaluation.enabled.length > 0 || evaluation.defects.length > 0)
    ) {
      process.stderr.write(`grove-guard: open cursors: ${evaluation.openCursors.join(', ')}\n`);
    }
    for (const defect of evaluation.defects) {
      process.stderr.write(`grove-guard defect: ${defect.path}: ${defect.reason}\n`);
    }
    if (evaluation.defects.length > 0) process.exitCode = 2;
    else if (evaluation.enabled.length > 0) process.exitCode = 3;
    else process.exitCode = 0;
    return;
  }

  const reportable = evaluation.enabled.length > 0 || evaluation.defects.length > 0;
  if (!reportable) {
    process.exitCode = 0;
    return;
  }
  const continuation = hookInput.stop_hook_active === true;
  if (evaluation.mode === 'supervisor' && !continuation) {
    // Hold channel: the documented Stop blocking form, single-line JSON.
    const reason = holdReason(evaluation);
    process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
    process.exitCode = 0;
    return;
  }
  if (evaluation.mode === 'supervisor') {
    // Single-hold bound: report without holding, one line on the
    // non-blocking stderr channel.
    process.stderr.write(`grove-guard (supervisor): ${holdReason(evaluation)}\n`);
    process.exitCode = 1;
    return;
  }
  // Observer: one line per stop event, never a hold, no dedup state.
  if (evaluation.enabled.length > 0) {
    process.stderr.write(`grove-guard (observer): ${observerSummary(evaluation.enabled)}\n`);
  }
  for (const defect of evaluation.defects) {
    process.stderr.write(`grove-guard defect: ${defect.path}: ${defect.reason}\n`);
  }
  process.exitCode = 1;
}

async function evaluate({ repoRoot, packageRoot }) {
  let transitions;
  try {
    transitions = loadTransitions(await readFile(
      join(packageRoot, 'reference', 'dispatch', 'transitions.toml'),
      'utf8',
    ));
  } catch (error) {
    // An invalid or missing SHIPPED rules file leaves the guard unable to
    // evaluate anything: internal error, never a silent pass. (Disclosed
    // concretization — the spec does not name this failure's class.)
    throw new Error(`shipped transitions are unusable: ${error.message}`);
  }

  const cursors = await inspectCursors(repoRoot);
  const defects = [...cursors.defects];
  const { records, defects: recordDefects } = await collectRecords({ repoRoot });
  defects.push(...recordDefects);

  const changeSet = await deriveChangeSet({ repoRoot });
  const mode = cursors.openForMode.length > 0 ? 'supervisor' : 'observer';

  let subjects = [];
  if (mode === 'supervisor') {
    // Union over every parseable open cursor's subjects (the multi-open
    // defect rides beside the union, resolution adopt/abort down to one).
    const union = new Set();
    for (const cursor of cursors.evaluable) {
      for (const path of cursor.subjects) union.add(path);
    }
    subjects = await Promise.all(
      [...union].sort().map((path) => bindSubject({ repoRoot, path, changeSet })),
    );
  } else {
    // Observer scope: frontmatter-governed artifacts only, excluding
    // reviewless; code subjects and absent paths are supervisor-mode
    // coverage via the subject list.
    const bound = await Promise.all(
      [...changeSet].sort().map((path) => bindSubject({ repoRoot, path, changeSet })),
    );
    subjects = bound.filter((subject) =>
      subject.state === 'present'
      && subject.classes.some((cls) => OBSERVER_CLASSES.has(cls)));
  }

  const enabled = computeEnabled({ transitions, subjects, records });
  return { mode, enabled, defects, openCursors: cursors.openForMode };
}

async function inspectCursors(repoRoot) {
  const runsRoot = join(repoRoot, '.grove', 'runs');
  const evaluable = [];
  const openForMode = [];
  const defects = [];
  let runs = [];
  try {
    runs = (await readdir(runsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const run of runs) {
    const relative = `.grove/runs/${run}/cursor.toml`;
    let text;
    try {
      text = await readFile(join(runsRoot, run, 'cursor.toml'), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    const parsed = parseCursor(text, { runId: run });
    if (parsed.ok) {
      if (parsed.claimsPresent) {
        defects.push({ path: relative, reason: 'cursor carries the reserved claims key' });
      }
      if (parsed.cursor.status === 'open') {
        evaluable.push({ path: relative, subjects: parsed.cursor.subjects });
        openForMode.push(relative);
      }
      continue;
    }
    defects.push({ path: relative, reason: parsed.reason });
    // Fail closed: a cursor whose status cannot be read is open for mode
    // selection; its subjects are unreadable, so it is not evaluated.
    const status = probeStatus(text);
    if (status == null || status === 'open') openForMode.push(relative);
  }
  if (openForMode.length > 1) {
    defects.push({
      path: '.grove/runs/',
      reason: `more than one open cursor: ${openForMode.join(', ')} — resolve by adopt or confirmed abort-run down to one`,
    });
  }
  return { evaluable, openForMode, defects };
}

function probeStatus(text) {
  const matches = [...String(text).matchAll(/^status = "(open|closed|aborted)"\s*$/gm)];
  return matches.length === 1 ? matches[0][1] : null;
}

function owedLine(instance) {
  return `grove-guard: ${instance.id} enabled for ${instance.subject} — missing ${instance.missingRecordType} record`;
}

function holdReason(evaluation) {
  const parts = [];
  for (const instance of evaluation.enabled) {
    parts.push(`${instance.id} enabled for ${instance.subject} — missing ${instance.missingRecordType} record`);
  }
  for (const defect of evaluation.defects) {
    parts.push(`defect: ${defect.path}: ${defect.reason}`);
  }
  if (evaluation.openCursors.length > 0) {
    // §Staleness: every hold names every open cursor path.
    parts.push(`open cursors: ${evaluation.openCursors.join(', ')}`);
  }
  parts.push(
    'Resolutions: produce the missing record(s); if this run is dead, adopt the cursor or abort it via confirmed abort-run. A defect denies close until its named file is resolved.',
  );
  return parts.join(' | ');
}

function observerSummary(enabled) {
  const bySubject = new Map();
  for (const instance of enabled) {
    const types = bySubject.get(instance.subject) ?? [];
    if (!types.includes(instance.missingRecordType)) types.push(instance.missingRecordType);
    bySubject.set(instance.subject, types);
  }
  return [...bySubject]
    .map(([subject, types]) => `${subject} owes ${types.join(', ')}`)
    .join('; ');
}

async function readHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw === '') return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`unreadable hook input: ${error.message}`);
  }
}

const hookRequested = process.argv.includes('--hook');

// Belt for the pre-main corner: a crash outside the promise chain would
// otherwise surface as a raw non-zero exit that the wrapper could mistake
// for the observer channel. Route every escape through the internal-error
// channel instead.
function internalCrash(error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`grove-guard error: ${message}\n`);
  process.exit(hookRequested ? 4 : 1);
}
process.on('uncaughtException', internalCrash);
process.on('unhandledRejection', internalCrash);

main().catch((error) => {
  process.stderr.write(`grove-guard error: ${error.message}\n`);
  process.exitCode = hookRequested ? 4 : 1;
});
