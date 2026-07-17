// Upstream: spec-0002 INV9 (record channel — read verdict records ONLY from
// the PR comment stream via the platform API, read IN FULL, paginated to
// exhaustion; a truncated read SHALL be a red error, never a partial verdict),
// §A.1 (records live as one structured comment on the change request), §A.4
// (admissibility from platform edit metadata + poster policy). The GitHub
// record-stream reader is the shell realizing that channel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapComment,
  nextPageUrl,
  readRecordStream,
  RecordStreamError,
} from '../shell/record-stream.mjs';
import { checkAdmissibility } from '../lib/records.mjs';

// A minimal GitHub REST issue-comment object.
const ghComment = (over = {}) => ({
  id: 42,
  body: 'a review',
  user: { login: 'agent-b' },
  author_association: 'MEMBER',
  created_at: '2026-07-16T00:00:00Z',
  updated_at: '2026-07-16T00:00:00Z',
  ...over,
});

// A fake fetch Response.
const fakeRes = ({ ok = true, status = 200, body = [], link = null } = {}) => ({
  ok,
  status,
  headers: { get: (n) => (n.toLowerCase() === 'link' ? link : null) },
  json: async () => body,
});

// --- mapComment (§A.1, §A.4): GitHub REST shape -> core comment shape ---

test('mapComment maps the GitHub REST issue-comment onto the core shape', () => {
  const c = mapComment(ghComment());
  assert.equal(c.id, 42);
  assert.equal(c.body, 'a review');
  assert.equal(c.author, 'agent-b');
  assert.equal(c.authorAssociation, 'MEMBER');
  assert.equal(c.createdAt, '2026-07-16T00:00:00Z');
  assert.equal(c.updatedAt, '2026-07-16T00:00:00Z');
});

test('mapComment carries edit metadata so §A.4 admissibility rejects an edited comment', () => {
  // GitHub marks an edited comment with updated_at != created_at.
  const edited = mapComment(ghComment({ updated_at: '2026-07-16T02:00:00Z' }));
  const a = checkAdmissibility(edited, {});
  assert.equal(a.admissible, false);
  assert.equal(a.cause, 'edited');
  // and an unedited one from a MEMBER is admissible
  assert.equal(checkAdmissibility(mapComment(ghComment()), {}).admissible, true);
});

test('mapComment tolerates a missing user/body (deleted-user edge) without throwing', () => {
  const c = mapComment(ghComment({ user: null, body: null }));
  assert.equal(c.author, null);
  assert.equal(c.body, '');
});

// --- nextPageUrl: RFC-5988 Link header parsing (pagination cursor) ---

test('nextPageUrl extracts the rel="next" target', () => {
  const link =
    '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=9>; rel="last"';
  assert.equal(nextPageUrl(link), 'https://api.github.com/x?page=2');
});

test('nextPageUrl returns null on the final page (no next rel)', () => {
  const link = '<https://api.github.com/x?page=8>; rel="prev", <https://api.github.com/x?page=1>; rel="first"';
  assert.equal(nextPageUrl(link), null);
  assert.equal(nextPageUrl(null), null);
  assert.equal(nextPageUrl(''), null);
});

// --- readRecordStream: paginate to exhaustion (INV9 read-in-full) ---

test('reads the full stream, paginating to exhaustion — all comments across pages', async () => {
  const p2 = 'https://api.github.com/repos/o/r/issues/7/comments?per_page=100&page=2';
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      return fakeRes({ body: [ghComment({ id: 1 }), ghComment({ id: 2 })], link: `<${p2}>; rel="next"` });
    }
    return fakeRes({ body: [ghComment({ id: 3 })], link: null });
  };
  const comments = await readRecordStream({ fetchImpl, owner: 'o', repo: 'r', prNumber: 7, token: 't' });
  assert.deepEqual(comments.map((c) => c.id), [1, 2, 3]);
  assert.equal(calls.length, 2); // followed the next link to exhaustion
});

test('sends auth + api-version headers and hits the issue-comments endpoint', async () => {
  let seenUrl, seenHeaders;
  const fetchImpl = async (url, opts) => {
    seenUrl = url;
    seenHeaders = opts.headers;
    return fakeRes({ body: [], link: null });
  };
  await readRecordStream({ fetchImpl, owner: 'acme', repo: 'grove', prNumber: 12, token: 'sekret' });
  assert.match(seenUrl, /\/repos\/acme\/grove\/issues\/12\/comments/);
  assert.equal(seenHeaders.Authorization, 'Bearer sekret');
  assert.ok(seenHeaders.Accept.includes('github'));
  assert.ok('X-GitHub-Api-Version' in seenHeaders);
});

// --- INV9's teeth: a truncated / failed read is a HARD RED ERROR, never a
//     silent partial verdict ---

test('INV9: a failed page fetch (non-2xx) is a hard error, NOT a partial stream', async () => {
  const p2 = 'https://api.github.com/x?page=2';
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls === 1) return fakeRes({ body: [ghComment({ id: 1 })], link: `<${p2}>; rel="next"` });
    return fakeRes({ ok: false, status: 500 }); // page 2 fails mid-pagination
  };
  await assert.rejects(
    () => readRecordStream({ fetchImpl, owner: 'o', repo: 'r', prNumber: 1, token: 't' }),
    (err) => {
      assert.ok(err instanceof RecordStreamError);
      assert.equal(err.status, 500);
      return true;
    },
  );
});

test('INV9: a fetch that rejects (network) propagates as an error, never a partial', async () => {
  const fetchImpl = async () => {
    throw new Error('ECONNRESET');
  };
  await assert.rejects(() => readRecordStream({ fetchImpl, owner: 'o', repo: 'r', prNumber: 1, token: 't' }));
});

test('INV9: a page whose body is not a JSON array is a hard error (malformed/truncated payload)', async () => {
  const fetchImpl = async () => fakeRes({ body: { message: 'Not Found' }, link: null });
  await assert.rejects(
    () => readRecordStream({ fetchImpl, owner: 'o', repo: 'r', prNumber: 1, token: 't' }),
    (err) => err instanceof RecordStreamError,
  );
});

test('INV9: the first page failing errors outright — no comments returned', async () => {
  const fetchImpl = async () => fakeRes({ ok: false, status: 403 });
  await assert.rejects(
    () => readRecordStream({ fetchImpl, owner: 'o', repo: 'r', prNumber: 1, token: 't' }),
    (err) => err instanceof RecordStreamError && err.status === 403,
  );
});

// --- Finding 2: a self-referential / looping `Link: rel="next"` must not spin
//     forever. A detected cycle is a hard RecordStreamError (never a partial —
//     INV9), and the normal multi-page walk still terminates cleanly. ---

test('INV9: a self-referential rel="next" Link is a hard error (cycle guard), never an infinite loop', async () => {
  // Every page points its `next` at the same URL: without a guard this spins
  // forever. With one it must throw a RecordStreamError.
  const loopUrl = 'https://api.github.com/repos/o/r/issues/1/comments?per_page=100&page=2';
  const fetchImpl = async () =>
    fakeRes({ body: [ghComment({ id: 1 })], link: `<${loopUrl}>; rel="next"` });
  await assert.rejects(
    () => readRecordStream({ fetchImpl, owner: 'o', repo: 'r', prNumber: 1, token: 't' }),
    (err) => {
      assert.ok(err instanceof RecordStreamError);
      assert.match(err.message, /cycle|loop/i);
      return true;
    },
  );
});

test('the normal multi-page walk (distinct next URLs) still terminates cleanly under the cycle guard', async () => {
  const p2 = 'https://api.github.com/repos/o/r/issues/7/comments?per_page=100&page=2';
  const p3 = 'https://api.github.com/repos/o/r/issues/7/comments?per_page=100&page=3';
  const fetchImpl = async (url) => {
    if (!url.includes('page=2') && !url.includes('page=3')) {
      return fakeRes({ body: [ghComment({ id: 1 })], link: `<${p2}>; rel="next"` });
    }
    if (url.includes('page=2')) return fakeRes({ body: [ghComment({ id: 2 })], link: `<${p3}>; rel="next"` });
    return fakeRes({ body: [ghComment({ id: 3 })], link: null });
  };
  const comments = await readRecordStream({ fetchImpl, owner: 'o', repo: 'r', prNumber: 7, token: 't' });
  assert.deepEqual(comments.map((c) => c.id), [1, 2, 3]);
});
