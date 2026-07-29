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
  TABLE_HEADER_LINE,
  minimalAbortedCursor,
  oneLineFailure,
  parseCursor,
  probeStatus,
  runInstantMismatch,
  serializeCursor,
  statusLinePattern,
  timestampFailure,
  validateSubjectPath,
} from './cursor.mjs';
import { parseToml } from './toml.mjs';

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
  const openedInvalid = timestampFailure('opened', opened);
  if (openedInvalid) return fail(plan, `open-run refused: ${openedInvalid}`);
  if (typeof intent !== 'string' || intent.trim() === '') {
    return fail(plan, 'open-run requires a one-line intent');
  }
  const intentInvalid = oneLineFailure('intent', intent);
  if (intentInvalid) return fail(plan, `open-run refused: ${intentInvalid}`);
  const instantMismatch = runInstantMismatch(runId, opened);
  if (instantMismatch) return fail(plan, `open-run refused: ${instantMismatch}`);
  if (!Array.isArray(subjects) || subjects.length === 0) {
    return fail(plan, 'open-run requires a non-empty subjects list of repo-relative file paths');
  }
  for (const subject of subjects) {
    const invalid = validateSubjectPath(subject);
    if (invalid) return fail(plan, `open-run refused: ${invalid}`);
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

  const content = serializeCursor({
    schema: 1,
    run: runId,
    opened,
    intent,
    subjects,
    status: 'open',
  });
  // Round-trip gate: every serialized value must parse back to itself
  // before anything is written — anything the parser's strict escape set
  // cannot round-trip (a carriage return in the intent, a control
  // character in a subject) is rejected pre-write, naming the field.
  const fidelity = roundTripFailure({ runId, opened, intent, subjects });
  if (fidelity) {
    return fail(plan, `open-run refused: planned cursor does not round-trip — ${fidelity}`);
  }
  const reparse = parseCursor(content, { runId });
  if (!reparse.ok) {
    return fail(plan, `open-run refused: planned cursor does not round-trip (${reparse.reason})`);
  }
  plan.actions.push(action({
    type: 'write',
    path: `.grove/runs/${runId}/cursor.toml`,
    content,
    expected: { kind: 'file', content: null },
    confirmationRequired: true,
  }));
  plan.summary = `open-run plans the confirm-gated cursor create for ${runId}`;
  return plan;
}

function roundTripFailure({ runId, opened, intent, subjects }) {
  const probes = [
    ['run', runId],
    ['opened', opened],
    ['intent', intent],
    ...subjects.map((subject, index) => [`subjects[${index}] (${JSON.stringify(subject)})`, subject]),
  ];
  for (const [field, value] of probes) {
    const failure = fieldRoundTripFailure(field, value);
    if (failure) return failure;
  }
  return null;
}

// One serialized value, probed back through the strict parser. Used by every
// cursor-writing plan (open's whole-cursor gate, abort's reason, close's
// timestamp): a value the parser cannot round-trip must be rejected
// pre-write, or the successfully written cursor becomes a standing defect.
function fieldRoundTripFailure(field, value) {
  let parsed;
  try {
    parsed = parseToml(`probe = ${JSON.stringify(String(value))}\n`);
  } catch (error) {
    return `field ${field}: ${error.message}`;
  }
  if (parsed.probe !== String(value)) {
    return `field ${field}: value changes across serialize/parse`;
  }
  return null;
}

export async function planCloseRun(input) {
  const repoRoot = resolve(input.repoRoot);
  const plan = newPlan(repoRoot, 'close-run');
  const { runId, closed } = input;
  if (typeof closed !== 'string' || closed === '') {
    return fail(plan, 'close-run requires the closed RFC 3339 timestamp');
  }
  const closedInvalid = timestampFailure('closed', closed);
  if (closedInvalid) return fail(plan, `close-run refused: ${closedInvalid}`);
  const closedFidelity = fieldRoundTripFailure('closed', closed);
  if (closedFidelity) {
    return fail(plan, `close-run refused: planned edit does not round-trip — ${closedFidelity}`);
  }
  const cursor = await readCursor(repoRoot, runId);
  if (!cursor.ok) return fail(plan, cursor.reason);
  if (!cursor.parsed.ok) {
    return fail(plan, `close-run cannot close a malformed cursor (${cursor.parsed.reason}); the only exit is confirmed abort-run`);
  }
  if (cursor.parsed.cursor.status !== 'open') {
    return fail(plan, `close-run requires an open cursor; ${runId} is ${cursor.parsed.cursor.status}`);
  }

  const closeAction = buildCloseAction(cursor.text, runId, closed);
  if (!closeAction.ok) {
    return fail(plan, `close-run refused: ${closeAction.reason}`);
  }
  // The identifying fields applyRunPlan reconstructs the licensed action
  // from — the plan FILE is caller-supplied and never trusted.
  plan.run = runId;
  plan.closed = closed;
  plan.actions.push(closeAction.action);
  plan.summary = `close-run plans the guard-licensed close of ${runId}`;
  return plan;
}

// THE single construction of the ordinary-close action, used by planCloseRun
// AND by applyRunPlan's licensing reconstruction so the two cannot diverge.
// Close and abort write ONLY status/closed(/reason): a textual edit of the
// existing bytes, never a re-serialization, so the byte-diff is exactly
// those lines (INV8). Returns a result, never a bare action: the two callers
// report the SAME refusal reason, and the post-edit validity gate below needs
// to name which of the two failures it hit.
function buildCloseAction(cursorText, runId, closed) {
  const content = editCursorText(cursorText, 'closed', [
    `closed = ${JSON.stringify(closed)}`,
  ]);
  if (content == null) {
    return { ok: false, reason: `cannot locate the single root-table status line in ${runId}` };
  }
  // The gate planOpenRun already has, on the edit path too: bytes are planned
  // only if they parse AND validate. Refusing is the fail-closed choice here
  // and costs nothing — close-run already refuses a malformed cursor outright
  // ("the only exit is confirmed abort-run"), so an edit that would MAKE one
  // is the same class of refusal.
  const reparse = parseCursor(content, { runId });
  if (!reparse.ok) {
    return {
      ok: false,
      reason: `the planned edit of ${runId} does not validate (${reparse.reason}); nothing was written`,
    };
  }
  return {
    ok: true,
    action: action({
      type: 'write',
      path: `.grove/runs/${runId}/cursor.toml`,
      content,
      expected: { kind: 'file', content: cursorText },
      // Pre-confirmed solely by the guard's exit-0 verdict, obtained by
      // applyRunPlan immediately before apply — and only after the action
      // reconstructs from the plan's identifying fields.
      confirmationRequired: false,
      guardLicensed: true,
    }),
  };
}

export async function planAbortRun(input) {
  const repoRoot = resolve(input.repoRoot);
  const plan = newPlan(repoRoot, 'abort-run');
  const { runId, closed, reason } = input;
  if (typeof closed !== 'string' || closed === '') {
    return fail(plan, 'abort-run requires the closed RFC 3339 timestamp');
  }
  const closedInvalid = timestampFailure('closed', closed);
  if (closedInvalid) return fail(plan, `abort-run refused: ${closedInvalid}`);
  // The shared one-line contract, replacing a local `includes('\n')` that let
  // a lone CR through.
  const reasonInvalid = oneLineFailure('reason', reason);
  if (reasonInvalid) return fail(plan, `abort-run requires a one-line reason: ${reasonInvalid}`);
  for (const [field, value] of [['reason', reason], ['closed', closed]]) {
    const fidelity = fieldRoundTripFailure(field, value);
    if (fidelity) {
      return fail(plan, `abort-run refused: planned edit does not round-trip — ${fidelity}`);
    }
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
      return fail(plan, `abort-run cannot locate the single root-table status line in ${runId}`);
    }
    // Same pre-write gate as close's, and REFUSAL rather than a fall-through
    // to the whole-file shape below — deliberately. INV8 pins that exception
    // to the unparseable-or-schema-invalid input row and AC5 reds it if it
    // becomes reachable on a well-formed cursor, so widening it here would
    // need a spec amendment. Abort's escape-hatch duty is met by the
    // root-table scoping instead: the edit that used to produce invalid bytes
    // now produces valid ones, so this gate is a belt, not the exit.
    const reparse = parseCursor(content, { runId });
    if (!reparse.ok) {
      return fail(
        plan,
        `abort-run refused: the planned edit of ${runId} does not validate `
          + `(${reparse.reason}); nothing was written`,
      );
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
// the pre-confirmed action id — but the plan arrives from a CALLER-SUPPLIED
// file (the CLI reads plan JSON from disk), so nothing in it is trusted:
// the licensed action is RECONSTRUCTED from the plan's identifying fields
// (repoRoot + run + closed) through buildCloseAction — the same code
// planCloseRun used — and the RECONSTRUCTION is what gets applied. The
// caller's action array is never handed to applyPlan on this branch: the
// candidate is compared to the reconstruction (id, path, type, content, and
// the planned file precondition), and then discarded in favour of it, so no
// second action in a forged plan file has anything to ride on. The previous
// revision of this comment (4aebb4f) claimed the comparison alone made the
// caller's array safe — "only an action matching that reconstruction … is
// ever confirmed". It did not: an UNFLAGGED second action carrying the
// licensed id was applied, because `reconstructCloseLicense` only ever sees
// the `guardLicensed` ones and applyPlan authorized by id string.
// `guardLicensed` is a hint, never authority; a plan carrying licensed
// actions that do not reconstruct is itself a defect and is refused.
export async function applyRunPlan(plan, { confirmedActionIds = [] } = {}) {
  if (!plan?.ok) throw new Error('cannot apply a failed run plan');
  if (plan.operation === 'close-run') {
    const { licensed, discarded } = await reconstructCloseLicense(plan);
    const verdict = runGuard(plan.repoRoot);
    if (verdict.status !== 0) {
      const report = `${verdict.stdout ?? ''}${verdict.stderr ?? ''}`.trim();
      throw new Error(
        `close-run refused: the guard exited ${verdict.status}, not 0 — close is denied while `
          + `owed work or a defect stands.\n${report}`,
      );
    }
    // Narrowed, never trusted — and never silent: a discarded action is
    // reported as a refusal so a tampered or stale plan file leaves a trace
    // in the apply result rather than vanishing.
    const narrowed = {
      ...plan,
      actions: [licensed],
      refusals: [
        ...(Array.isArray(plan.refusals) ? plan.refusals : []),
        ...discarded.map((item) => ({
          path: typeof item?.path === 'string' ? item.path : null,
          reason: 'close-run applies only the reconstructed guard-licensed cursor write; '
            + 'this planned action was discarded unapplied',
        })),
      ],
    };
    return applyPlan(narrowed, { confirmedActionIds: [licensed.id] });
  }
  return applyPlan(plan, { confirmedActionIds: [...confirmedActionIds] });
}

async function reconstructCloseLicense(plan) {
  const runId = plan.run;
  if (typeof runId !== 'string' || !RUN_ID.test(runId)) {
    throw new Error(
      'close-run refused: the plan carries no grammatical run id among its identifying fields; nothing can be licensed',
    );
  }
  if (typeof plan.closed !== 'string' || plan.closed === '') {
    throw new Error(
      'close-run refused: the plan carries no closed timestamp among its identifying fields; nothing can be licensed',
    );
  }
  const actions = Array.isArray(plan.actions) ? plan.actions : [];
  const flagged = actions.filter((item) => item?.guardLicensed);
  if (flagged.length !== 1) {
    throw new Error(
      `close-run licenses exactly one reconstructed action; this plan flags ${flagged.length} `
        + 'guardLicensed action(s) — guardLicensed is a hint, never authority, and a plan '
        + 'carrying unreconstructable licensed actions is itself a defect',
    );
  }
  const cursor = await readCursor(resolve(plan.repoRoot), runId);
  if (!cursor.ok) {
    throw new Error(`close-run refused: ${cursor.reason}`);
  }
  const reconstruction = buildCloseAction(cursor.text, runId, plan.closed);
  if (!reconstruction.ok) {
    throw new Error(`close-run refused: ${reconstruction.reason}`);
  }
  const expected = reconstruction.action;
  const candidate = flagged[0];
  // The planned file precondition is part of the equality set, and it is
  // checked FIRST — the candidate's `expected` is what applyPlan's post-plan
  // drift preflight would have compared, and a licensed action that carries
  // none skips that preflight entirely once the reconstruction is what gets
  // applied.
  if (candidate.expected?.kind !== 'file' || typeof candidate.expected.content !== 'string') {
    throw new Error(
      `close-run refused: the plan's guardLicensed action carries no file precondition for `
        + `${expected.path}; the post-plan drift check cannot run and nothing can be licensed`,
    );
  }
  // A cursor edited between plan and apply is drift, not forgery. Both end in
  // the same refusal, but naming it forgery sent an operator hunting for an
  // attacker after an ordinary concurrent edit. `expected.expected.content` is
  // the cursor's CURRENT bytes by construction (buildCloseAction reads them).
  if (candidate.expected.content !== expected.expected.content) {
    throw new Error(
      `close-run refused: ${expected.path} changed after planning; nothing was applied — `
        + 're-plan the close (the planned action records different cursor bytes than the file now holds)',
    );
  }
  if (
    candidate.id !== expected.id
    || candidate.path !== expected.path
    || candidate.type !== expected.type
    || candidate.content !== expected.content
  ) {
    throw new Error(
      `close-run refused: the plan's guardLicensed action does not reconstruct as the cursor `
        + `status-write at ${expected.path} (id/path/type/content must all match the recomputed `
        + 'action; guardLicensed is a hint, never authority)',
    );
  }
  return {
    licensed: expected,
    discarded: actions.filter((item) => item !== candidate),
  };
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

// The open-status matcher is cursor.mjs's statusLinePattern — the ONE
// grammar derived from toml.mjs's line handling (leading/trailing trim,
// key/value trim around '=', trailing comment, trailing \r) — so a
// well-formed non-canonical cursor can always close and abort through the
// field edit (a stricter match here wedged such cursors against INV8's
// deliberately unreachable whole-file path, twice). The matched line is
// replaced with the canonical assignment; the file's line-ending style is
// preserved for the replacement and the appended lines.
const OPEN_STATUS_LINE = statusLinePattern('open');

// The edit is scoped to the ROOT table — the lines before the first
// TABLE_HEADER_LINE — because that is where every declared cursor key lives.
// Both halves need the scope. Appending at end-of-file put `closed`/`reason`
// inside a trailing `[[claims]]` table (a shape parseCursor accepts: `claims`
// is declared, and its presence is a defect on a parseable cursor, never a
// parse failure), so a well-formed open cursor was edited into a
// schema-INVALID aborted one — "aborted cursor requires a closed timestamp".
// Counting status lines file-wide had the mirror bug: a `status` key inside
// such a table made the count 2 and wedged the edit. In a cursor with no table
// header — everything any shipped path writes — the produced bytes are
// unchanged.
function editCursorText(text, newStatus, appendLines) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split('\n');
  const headerIndex = lines.findIndex((line) => TABLE_HEADER_LINE.test(line));
  const rootEnd = headerIndex === -1 ? lines.length : headerIndex;
  const matched = lines
    .slice(0, rootEnd)
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => OPEN_STATUS_LINE.test(line));
  if (matched.length !== 1) return null;
  const keepCR = matched[0].line.endsWith('\r') ? '\r' : '';
  lines[matched[0].index] = `status = ${JSON.stringify(newStatus)}${keepCR}`;
  if (rootEnd === lines.length) {
    const next = lines.join('\n');
    const trailing = next.endsWith('\n') ? '' : eol;
    return `${next}${trailing}${appendLines.join(eol)}${eol}`;
  }
  const keepCRLF = eol === '\r\n' ? '\r' : '';
  lines.splice(rootEnd, 0, ...appendLines.map((line) => `${line}${keepCRLF}`));
  return lines.join('\n');
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
  const status = probeStatus(text);
  if (status == null) return true; // fail closed: unreadable status is open
  return status === 'open';
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
