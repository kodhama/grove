// The GitHub record-stream reader (spec-0002 INV9, §A.1, §A.4).
//
// The check reads verdict records ONLY from the PR's comment stream via the
// platform API — the PR conversation ("issue") comments. It reads the stream
// IN FULL: paginating to exhaustion by following the REST `Link: rel="next"`
// cursor. A truncated or failed read is a HARD RED ERROR (RecordStreamError),
// never a verdict computed over a partial stream (INV9's teeth). Each comment
// (+ its edit/author metadata) is mapped onto the core's comment shape so
// §A.4 admissibility (`lib/records.mjs`) can reject edited / unauthorized
// records from the platform metadata.
//
// `fetchImpl` is injected so the pagination loop, truncation detection, and
// mapping are unit-tested against fakes; the real `fetch` (global) is the only
// untested line, wired in by `bin/check.mjs`.

export class RecordStreamError extends Error {
  constructor(message, { status, url, cause } = {}) {
    super(message);
    this.name = 'RecordStreamError';
    this.status = status;
    this.url = url;
    if (cause !== undefined) this.cause = cause;
  }
}

// Map a GitHub REST issue-comment object onto the core comment shape
// (`lib/records.mjs`: parseRecord / checkAdmissibility). GitHub marks an edited
// comment with `updated_at != created_at`; carrying both feeds §A.4's unedited
// check. `author_association` feeds the default poster policy; `user.login` is
// the poster identity for a configured record-poster allowlist.
export function mapComment(raw) {
  return {
    id: raw.id,
    body: raw.body == null ? '' : String(raw.body),
    author: raw.user && raw.user.login != null ? raw.user.login : null,
    authorAssociation: raw.author_association != null ? raw.author_association : null,
    createdAt: raw.created_at != null ? raw.created_at : null,
    updatedAt: raw.updated_at != null ? raw.updated_at : null,
  };
}

// Parse an RFC-5988 Link header, returning the rel="next" target URL or null.
export function nextPageUrl(linkHeader) {
  if (!linkHeader) return null;
  for (const part of String(linkHeader).split(',')) {
    const m = /<([^>]+)>\s*;\s*(.+)/.exec(part.trim());
    if (!m) continue;
    if (/\brel\s*=\s*"?next"?/.test(m[2])) return m[1];
  }
  return null;
}

function requestHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'grove-review-bookkeeping-check',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// readRecordStream({ fetchImpl, owner, repo, prNumber, token, perPage?, apiBase? })
//   -> Promise<comment[]>   (mapped to the core shape, in platform order)
//
// Paginates the issue-comments endpoint to exhaustion. Any non-2xx page, any
// fetch rejection, and any non-array payload is a hard RecordStreamError — the
// function never returns a partial stream (INV9).
export async function readRecordStream({
  fetchImpl,
  owner,
  repo,
  prNumber,
  token,
  perPage = 100,
  apiBase = 'https://api.github.com',
}) {
  if (typeof fetchImpl !== 'function') {
    throw new RecordStreamError('readRecordStream requires a fetch implementation');
  }
  const base = String(apiBase).replace(/\/$/, '');
  let url = `${base}/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=${perPage}`;
  const headers = requestHeaders(token);
  const comments = [];

  // Pagination cycle guard (Finding 2). A self-referential or looping
  // `Link: rel="next"` (a URL already visited) must not spin forever; a
  // monotonically-increasing but never-terminating cursor is bounded by the
  // page cap. Either breach is a hard RecordStreamError — never a partial
  // stream (INV9), same fail-closed teeth as a truncated read.
  const visited = new Set();
  const MAX_PAGES = 10000;

  while (url) {
    if (visited.has(url)) {
      throw new RecordStreamError(`record-stream pagination cycle detected: Link rel="next" revisited ${url}`, {
        url,
      });
    }
    visited.add(url);
    if (visited.size > MAX_PAGES) {
      throw new RecordStreamError(
        `record-stream exceeded ${MAX_PAGES} pages without terminating — aborting rather than returning a partial`,
        { url },
      );
    }
    let res;
    try {
      res = await fetchImpl(url, { headers });
    } catch (e) {
      // A network-level failure mid-pagination is a truncated read: red, never
      // a partial verdict.
      throw new RecordStreamError(`record-stream fetch failed: ${e.message}`, { url, cause: e });
    }
    if (!res || !res.ok) {
      throw new RecordStreamError(
        `record-stream page returned HTTP ${res ? res.status : 'no-response'}`,
        { status: res ? res.status : undefined, url },
      );
    }
    let page;
    try {
      page = await res.json();
    } catch (e) {
      throw new RecordStreamError(`record-stream page body unreadable: ${e.message}`, { url, cause: e });
    }
    if (!Array.isArray(page)) {
      throw new RecordStreamError('record-stream page was not a JSON array (truncated/error payload)', { url });
    }
    for (const raw of page) comments.push(mapComment(raw));
    url = nextPageUrl(res.headers && res.headers.get ? res.headers.get('link') : null);
  }

  return comments;
}
