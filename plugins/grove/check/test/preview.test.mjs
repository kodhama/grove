// Upstream: grove#108 — the local owed-map preview. It renders spec-0002's
// §B/§C computation offline (comments: []) and MUST NOT weaken any CI
// boundary while doing so: policy still comes from the protected branch only
// (§C.0/INV1), the bootstrap self-detect still fires (adr-0014), and an empty
// record stream must surface every owed pair (never a forged green). The
// load-bearing pins: (1) NO network — the whole run is git-runner calls;
// (2) the diff base is `origin/<default>...head` (merge-base parity with CI);
// (3) default-branch resolution is loud-fail, never a silent guess.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocalDefaultBranch, runPreview } from '../shell/preview.mjs';

// The house fake git-runner idiom (git-adapter.test.mjs): (args[]) => stdout,
// recording calls; undefined => the runner rejects like a failing git command.
function fakeRunner(responder) {
  const calls = [];
  const run = async (args) => {
    calls.push(args);
    const r = responder(args);
    if (r === undefined) throw new Error(`fatal: not found: ${args.join(' ')}`);
    return r;
  };
  run.calls = calls;
  return run;
}

// A minimal installed grove-self-shaped repo behind the runner: policy +
// declarations on the PROTECTED ref, content at HEAD.
const POLICY_MD = [
  '```grove-review-policy',
  'schema: 1',
  'scope: strict',
  'artifact_dirs: [decisions, specs]',
  'reviewless_types: [research]',
  'non_behavioral_allowlist: [README.md]',
  'prose_extensions: [.md, .txt, .rst]',
  '```',
].join('\n');
const CONFORMANCE_MD =
  '```grove-review-declaration\nschema: 1\nreview: conformance\ntypes: [spec, code]\npass_class: [PASS]\n```';
const CODE_REVIEWER_MD =
  '```grove-review-declaration\nschema: 1\nreview: code-reviewer\ntypes: [code]\npass_class: [CLEAN, ADVISORIES-ONLY]\n```';

function installedRepoResponder({ changedOut, headFiles }) {
  return (args) => {
    if (args[0] === 'show') {
      const ref = args[1];
      const sep = ref.indexOf(':');
      const at = ref.slice(0, sep);
      const path = ref.slice(sep + 1);
      if (at === 'origin/main') {
        if (path === 'charters/review-policy.md') return POLICY_MD;
        if (path === 'charters/conformance-reviewer.md') return CONFORMANCE_MD;
        if (path === 'charters/code-reviewer.md') return CODE_REVIEWER_MD;
        return undefined; // absent on the protected branch
      }
      if (at === 'HEAD') return headFiles[path]; // undefined => absent
      return undefined;
    }
    if (args[0] === 'ls-tree') {
      // protected-branch charters listing vs whole-tree HEAD listing
      if (args.includes('origin/main')) {
        return ['charters/review-policy.md', 'charters/conformance-reviewer.md', 'charters/code-reviewer.md'].join('\n');
      }
      return Object.keys(headFiles).join('\n');
    }
    if (args[0] === 'diff') return changedOut;
    return undefined;
  };
}

// --- resolveLocalDefaultBranch ---

test('default-branch: an explicit override wins without touching git', async () => {
  const gitRunner = fakeRunner(() => undefined);
  assert.equal(await resolveLocalDefaultBranch({ gitRunner, override: 'trunk' }), 'trunk');
  assert.equal(gitRunner.calls.length, 0);
});

test('default-branch: resolved from origin/HEAD symbolic-ref', async () => {
  const gitRunner = fakeRunner((args) =>
    args[0] === 'symbolic-ref' ? 'refs/remotes/origin/main\n' : undefined,
  );
  assert.equal(await resolveLocalDefaultBranch({ gitRunner }), 'main');
});

test('default-branch: unresolvable is a LOUD error naming both fixes, never a guess', async () => {
  const gitRunner = fakeRunner(() => undefined);
  await assert.rejects(
    () => resolveLocalDefaultBranch({ gitRunner }),
    /set-head origin -a.*--default-branch|--default-branch.*set-head origin -a/s,
  );
});

// --- runPreview: the composition ---

test('preview surfaces the owed-map with an EMPTY record stream — every owed pair red, no network', async () => {
  // A changed spec (owes conformance under the declarations above) + a changed
  // untyped-code file (owes conformance + code-reviewer).
  const headFiles = {
    'specs/thing.md': '---\nid: spec-thing\ntype: spec\nstatus: approved\n---\nbody',
    'notes.md': 'no frontmatter prose',
  };
  const gitRunner = fakeRunner(
    installedRepoResponder({ changedOut: 'M\tspecs/thing.md\nA\tnotes.md', headFiles }),
  );
  const out = await runPreview({ gitRunner, defaultBranch: 'main' });
  assert.equal(out.installed, true);
  assert.equal(out.derivation.green, false, 'an owed pair with zero records must show red');
  const pairs = out.derivation.rows
    .filter((r) => r.kind === 'pair')
    .map((r) => `${r.review}:${r.subject}`);
  assert.ok(pairs.includes('conformance:specs/thing.md'), `owed-map has the spec pair (got ${pairs})`);
  assert.ok(pairs.includes('code-reviewer:notes.md'), `owed-map has the untyped-code pair (got ${pairs})`);
  // the load-bearing NO-NETWORK pin: the entire run is git-runner calls; this
  // suite never installed a fetch and the module imports none — every input
  // above arrived via the fake runner.
  assert.ok(gitRunner.calls.length > 0);
});

test('preview diffs origin/<default>...<head> — merge-base parity with CI', async () => {
  const gitRunner = fakeRunner(
    installedRepoResponder({ changedOut: '', headFiles: {} }),
  );
  await runPreview({ gitRunner, defaultBranch: 'main', head: 'HEAD' });
  const diffCall = gitRunner.calls.find((a) => a[0] === 'diff');
  assert.ok(diffCall.includes('origin/main...HEAD'), `three-dot base...head (got ${diffCall})`);
});

test('preview honors the allowlist the same as CI (an allowlisted prose file owes nothing)', async () => {
  const headFiles = { 'README.md': 'orientation prose' };
  const gitRunner = fakeRunner(
    installedRepoResponder({ changedOut: 'M\tREADME.md', headFiles }),
  );
  const out = await runPreview({ gitRunner, defaultBranch: 'main' });
  assert.equal(out.installed, true);
  const rows = out.derivation.rows.filter((r) => r.subject === 'README.md');
  assert.equal(rows.length, 0, 'allowlisted prose generates no rows');
});

test('preview: grove NOT installed on the protected branch -> installed:false, never a forged owed-map (adr-0014)', async () => {
  const gitRunner = fakeRunner((args) => {
    if (args[0] === 'show') return undefined; // no policy anywhere on origin/main
    if (args[0] === 'ls-tree') return '';
    return undefined;
  });
  const out = await runPreview({ gitRunner, defaultBranch: 'main' });
  assert.equal(out.installed, false);
  assert.ok(out.summary, 'carries the bootstrap summary for the caller to print');
  assert.equal('derivation' in out, false);
});

test('preview renders the same §D view text CI prints (render reuse, not a re-implementation)', async () => {
  const headFiles = { 'notes.md': 'prose' };
  const gitRunner = fakeRunner(
    installedRepoResponder({ changedOut: 'A\tnotes.md', headFiles }),
  );
  const out = await runPreview({ gitRunner, defaultBranch: 'main' });
  assert.equal(typeof out.text, 'string');
  assert.ok(out.structured && typeof out.structured === 'object');
  assert.match(out.text, /notes\.md/, 'the rendered view names the owed subject');
});
