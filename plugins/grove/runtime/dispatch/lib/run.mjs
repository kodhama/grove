// Run operations (spec-0006 §The confirm-gate extension; INV5–INV10).
// open-run / close-run / abort-run each follow the identical
// plan → disclose → confirm-exact-action-ids → apply flow, and apply goes
// through the SAME shared applyPlan enforcement the lifecycle core uses —
// never a parallel re-implementation of the gate. The operations differ
// only in WHO may confirm: open and abort action ids are confirmable only
// through the user-facing confirm gate; the ordinary-close action id is
// pre-confirmed solely by the guard's exit-0 verdict, which close-run
// obtains immediately before apply.
import { spawnSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyPlan } from '../../lifecycle/lib/lifecycle.mjs';
import {
  RUN_ID,
  minimalAbortedCursor,
  parseCursor,
  serializeCursor,
} from './cursor.mjs';

const OPERATIONS = Object.freeze(['open-run', 'close-run', 'abort-run']);
const GUARD = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', 'bin', 'guard.mjs',
);

export function describeRunOperation(operation) {
  if (!OPERATIONS.includes(operation)) {
    throw new Error(`unknown run operation "${operation}"`);
  }
  return {
    operation,
    flow: ['plan', 'disclose', 'confirm-exact-action-ids', 'apply'],
    rules: [
      'Every cursor write goes through the shared applyPlan enforcement; a failed plan is pre-write and cannot be applied.',
      operation === 'close-run'
        ? "The ordinary-close action is pre-confirmed solely by the guard's exit-0 verdict, obtained immediately before apply; no user confirmation gates the completion record."
        : 'Show the exact plan and obtain explicit user confirmation of every action id before apply.',
      'No run operation takes a surface invocation record: the cursor is host-neutral run state inside .grove/runs/.',
      'Perform no git action and make no landing recommendation.',
      'A stale open cursor resolves only by adopt or confirmed abort-run, never silently.',
    ],
    cli: {
      plan: `node <grove-plugin-root>/runtime/dispatch/bin/grove-run.mjs plan ${operation} <request.json>`,
      apply: 'node <grove-plugin-root>/runtime/dispatch/bin/grove-run.mjs apply <plan.json> <confirmation.json>',
    },
  };
}

export async function planOpenRun(input) {
  const repoRoot = resolve(input.repoRoot);
  const plan = newPlan(repoRoot, 'open-run');
  const { runId, opened, intent, subjects } = input;
  if (typeof runId !== 'string' || !RUN_ID.test(runId)) {
    return fail(plan, `open-run requires a run id matching the run-id grammar ${RUN_ID}, got ${JSON.stringify(runId)}`);
  }
  if (typeof opened !== 'string' || opened === '') {
    return fail(plan, 'open-run requires the opened RFC 3339 timestamp');
  }
  if (typeof intent !== 'string' || intent.trim() === '') {
    return fail(plan, 'open-run requires a one-line intent');
  }
  if (
    !Array.isArray(subjects)
    || subjects.some((item) => typeof item !== 'string' || item === '')
  ) {
    return fail(plan, 'open-run requires subjects as repo-relative file paths');
  }

  if (!(await pathExists(join(repoRoot, '.grove')))) {
    const setup = await setupCommand(input);
    return fail(plan, `Grove is not composed here — no .grove/ consumer floor exists; run ${setup} first`);
  }
  const open = await listOpenCursors(repoRoot);
  if (open.length > 0) {
    return fail(
      plan,
      `open-run refused: open cursor(s) already exist — ${open.join(', ')} — `
        + 'resolve first by adopt (resume that run) or confirmed abort-run; those are the only resolutions',
    );
  }

  plan.actions.push(action({
    type: 'write',
    path: `.grove/runs/${runId}/cursor.toml`,
    content: serializeCursor({
      schema: 1,
      run: runId,
      opened,
      intent,
      subjects,
      status: 'open',
    }),
    expected: { kind: 'file', content: null },
    confirmationRequired: true,
  }));
  plan.summary = `open-run plans the confirm-gated cursor create for ${runId}`;
  return plan;
}

export async function planCloseRun(input) {
  const repoRoot = resolve(input.repoRoot);
  const plan = newPlan(repoRoot, 'close-run');
  const { runId, closed } = input;
  if (typeof closed !== 'string' || closed === '') {
    return fail(plan, 'close-run requires the closed RFC 3339 timestamp');
  }
  const cursor = await readCursor(repoRoot, runId);
  if (!cursor.ok) return fail(plan, cursor.reason);
  if (!cursor.parsed.ok) {
    return fail(plan, `close-run cannot close a malformed cursor (${cursor.parsed.reason}); the only exit is confirmed abort-run`);
  }
  if (cursor.parsed.cursor.status !== 'open') {
    return fail(plan, `close-run requires an open cursor; ${runId} is ${cursor.parsed.cursor.status}`);
  }

  // Close and abort write ONLY status/closed(/reason): a textual edit of the
  // existing bytes, never a re-serialization, so the byte-diff is exactly
  // those lines (INV8).
  const content = editCursorText(cursor.text, 'closed', [
    `closed = ${JSON.stringify(closed)}`,
  ]);
  if (content == null) {
    return fail(plan, `close-run cannot locate the single status line in ${runId}`);
  }
  plan.actions.push(action({
    type: 'write',
    path: `.grove/runs/${runId}/cursor.toml`,
    content,
    expected: { kind: 'file', content: cursor.text },
    // Pre-confirmed at plan time solely by the guard's exit-0 verdict,
    // which applyRunPlan obtains immediately before apply.
    confirmationRequired: false,
    guardLicensed: true,
  }));
  plan.summary = `close-run plans the guard-licensed close of ${runId}`;
  return plan;
}

export async function planAbortRun(input) {
  const repoRoot = resolve(input.repoRoot);
  const plan = newPlan(repoRoot, 'abort-run');
  const { runId, closed, reason } = input;
  if (typeof closed !== 'string' || closed === '') {
    return fail(plan, 'abort-run requires the closed RFC 3339 timestamp');
  }
  if (typeof reason !== 'string' || reason.trim() === '' || reason.includes('\n')) {
    return fail(plan, 'abort-run requires a one-line reason');
  }
  const cursor = await readCursor(repoRoot, runId);
  if (!cursor.ok) return fail(plan, cursor.reason);

  plan.wholeFileReplacement = false;
  let content;
  if (cursor.parsed.ok) {
    if (cursor.parsed.cursor.status !== 'open') {
      return fail(plan, `abort-run requires an open cursor; ${runId} is ${cursor.parsed.cursor.status}`);
    }
    // Well-formed: the whole-file replacement path is UNREACHABLE — this is
    // a field edit preserving every open-time byte (INV8).
    content = editCursorText(cursor.text, 'aborted', [
      `closed = ${JSON.stringify(closed)}`,
      `reason = ${JSON.stringify(reason)}`,
    ]);
    if (content == null) {
      return fail(plan, `abort-run cannot locate the single status line in ${runId}`);
    }
  } else {
    // INV8's one named exception, reachable ONLY through the
    // unparseable-or-schema-invalid defect row: a trustworthy field edit
    // inside a file that fails parse or schema is undefined, so a confirmed
    // abort replaces the file whole with the minimal aborted shape.
    plan.wholeFileReplacement = true;
    content = minimalAbortedCursor({ runId, closed, reason });
  }
  plan.actions.push(action({
    type: 'write',
    path: `.grove/runs/${runId}/cursor.toml`,
    content,
    expected: { kind: 'file', content: cursor.text },
    confirmationRequired: true,
  }));
  plan.summary = plan.wholeFileReplacement
    ? `abort-run plans the confirm-gated WHOLE-FILE replacement of the malformed cursor ${runId} (${cursor.parsed.reason})`
    : `abort-run plans the confirm-gated abort of ${runId}`;
  return plan;
}

// Apply through the one shared gate. For close-run the operation itself
// obtains the guard's exit-0 license immediately before apply and supplies
// the pre-confirmed action id; for open/abort only the caller's
// user-confirmed ids pass through.
export async function applyRunPlan(plan, { confirmedActionIds = [] } = {}) {
  if (!plan?.ok) throw new Error('cannot apply a failed run plan');
  let ids = [...confirmedActionIds];
  if (plan.operation === 'close-run') {
    const verdict = runGuard(plan.repoRoot);
    if (verdict.status !== 0) {
      const report = `${verdict.stdout ?? ''}${verdict.stderr ?? ''}`.trim();
      throw new Error(
        `close-run refused: the guard exited ${verdict.status}, not 0 — close is denied while `
          + `owed work or a defect stands.\n${report}`,
      );
    }
    ids = plan.actions
      .filter((item) => item.guardLicensed)
      .map((item) => item.id);
  }
  return applyPlan(plan, { confirmedActionIds: ids });
}

function runGuard(repoRoot) {
  return spawnSync(process.execPath, [GUARD, '--repo', repoRoot], {
    encoding: 'utf8',
  });
}

async function readCursor(repoRoot, runId) {
  if (typeof runId !== 'string' || !RUN_ID.test(runId)) {
    return { ok: false, reason: `run id ${JSON.stringify(runId)} fails the run-id grammar` };
  }
  let text;
  try {
    text = await readFile(join(repoRoot, '.grove', 'runs', runId, 'cursor.toml'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ok: false, reason: `no cursor exists for run ${runId}` };
    }
    throw error;
  }
  return { ok: true, text, parsed: parseCursor(text, { runId }) };
}

// Matches the open-status assignment with the SAME tolerance parseCursor's
// parser has — optional whitespace, an optional trailing comment, an
// optional \r — so a well-formed non-canonical cursor can always close and
// abort through the field edit (a byte-exact match here wedged such cursors
// against INV8's deliberately unreachable whole-file path). The matched line
// is replaced with the canonical assignment; the file's line-ending style is
// preserved for the replacement and the appended lines.
const OPEN_STATUS_LINE = /^status\s*=\s*"open"\s*(?:#.*)?\r?$/;

function editCursorText(text, newStatus, appendLines) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split('\n');
  const matched = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => OPEN_STATUS_LINE.test(line));
  if (matched.length !== 1) return null;
  const keepCR = matched[0].line.endsWith('\r') ? '\r' : '';
  lines[matched[0].index] = `status = ${JSON.stringify(newStatus)}${keepCR}`;
  const next = lines.join('\n');
  const trailing = next.endsWith('\n') ? '' : eol;
  return `${next}${trailing}${appendLines.join(eol)}${eol}`;
}

async function listOpenCursors(repoRoot) {
  const runsRoot = join(repoRoot, '.grove', 'runs');
  const open = [];
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
    let text;
    try {
      text = await readFile(join(runsRoot, run, 'cursor.toml'), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    const parsed = parseCursor(text, { runId: run });
    if (parsed.ok ? parsed.cursor.status === 'open' : statusUnreadableOrOpen(text)) {
      open.push(`.grove/runs/${run}/cursor.toml`);
    }
  }
  return open;
}

function statusUnreadableOrOpen(text) {
  const matches = [...String(text).matchAll(/^status = "(open|closed|aborted)"\s*$/gm)];
  if (matches.length !== 1) return true; // fail closed: unreadable status is open
  return matches[0][1] === 'open';
}

async function setupCommand(input) {
  try {
    const config = JSON.parse(await readFile(
      join(resolve(input.packageRoot), 'metadata', 'hosts.json'),
      'utf8',
    ));
    const command = config.hosts?.[input.host]?.setup_command;
    if (typeof command === 'string' && command !== '') return command;
  } catch {
    // fall through
  }
  return input.host === 'codex' ? 'grove setup' : '/grove:setup';
}

function newPlan(repoRoot, operation) {
  return {
    ok: true,
    operation,
    repoRoot,
    summary: '',
    actions: [],
    skipped: [],
    refusals: [],
  };
}

function fail(plan, reason) {
  plan.ok = false;
  plan.summary = reason;
  plan.actions = [];
  return plan;
}

function action(value) {
  return { ...value, id: `${value.type}:${value.path}` };
}

async function pathExists(path) {
  return stat(path).then(() => true, (error) => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
}
