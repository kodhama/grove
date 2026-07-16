// grove-fp-1 fingerprint (spec-0002 §A.3).
//
// grove-fp-1(I, C):
//   1. Sort I by raw byte order of the path string (after dedup).
//   2. For each p: b = blob bytes of p at C if present, else the sentinel
//      "\x00ABSENT\x00"; emit L_p = hex(sha256(utf8(p))) ":" hex(sha256(b)).
//   3. fingerprint = "grove-fp-1:" hex(sha256(utf8(join(L_p, "\n")))).
//
// The check always recomputes over HEAD; the recorded value is never trusted.

import { createHash } from 'node:crypto';

const ABSENT = Buffer.from('\x00ABSENT\x00', 'latin1'); // [0x00, A,B,S,E,N,T, 0x00]

function sha256hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// tree: a Map<path, content> or a function path -> content|undefined.
// Content is treated as utf8 text; a missing entry is ABSENT.
function blobOf(tree, path) {
  let content;
  if (tree == null) content = undefined;
  else if (typeof tree.get === 'function') content = tree.get(path);
  else if (typeof tree === 'function') content = tree(path);
  else content = tree[path];
  if (content === undefined || content === null) return ABSENT;
  if (Buffer.isBuffer(content)) return content;
  return Buffer.from(String(content), 'utf8');
}

// Sort by raw byte order of the utf8-encoded path string.
function byteSort(paths) {
  return [...paths].sort((a, b) =>
    Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')));
}

export function groveFp1(inputPaths, tree) {
  const uniq = [...new Set(inputPaths)];
  const sorted = byteSort(uniq);
  const lines = sorted.map((p) => {
    const pathHash = sha256hex(Buffer.from(p, 'utf8'));
    const blobHash = sha256hex(blobOf(tree, p));
    return `${pathHash}:${blobHash}`;
  });
  const digest = sha256hex(Buffer.from(lines.join('\n'), 'utf8'));
  return `grove-fp-1:${digest}`;
}

// Per-path content hash, for §D reason attribution only (never the verdict).
export function pathHashAt(tree, path) {
  return sha256hex(blobOf(tree, path));
}
