// The per-package test-deps ledger (spec-0002 §A.3 step 3; adr-0006 dec 4).
//
// Q8 convention pinned here (see retired/review-bookkeeping/check/test-deps.md):
//   - file -> package: a code path belongs to the package rooted at the
//     nearest ancestor directory containing a `test-deps.md`.
//   - format: a fenced ```grove-test-deps``` block with `schema`, `specs`
//     (each may carry @vN), `decisions`.
//   - the check reads only that block; version suffixes are stripped at
//     resolution.

import { parseYaml } from './yaml.mjs';
import { extractFencedBlocks } from './blocks.mjs';

const LEDGER_FILENAME = 'test-deps.md';

function treeHas(tree, path) {
  if (tree == null) return false;
  if (typeof tree.has === 'function') return tree.has(path);
  return Object.prototype.hasOwnProperty.call(tree, path);
}

function treeGet(tree, path) {
  if (tree == null) return undefined;
  if (typeof tree.get === 'function') return tree.get(path);
  return tree[path];
}

// Ancestor directories of a code path, deepest first.
function ancestorDirs(codePath) {
  const parts = codePath.split('/');
  parts.pop(); // drop filename
  const dirs = [];
  while (parts.length > 0) {
    dirs.push(parts.join('/'));
    parts.pop();
  }
  dirs.push(''); // repo root
  return dirs;
}

// findLedger(tree, codePath) ->
//   { found: true, path, specs, decisions, ids } | { found: false }
export function findLedger(tree, codePath) {
  for (const dir of ancestorDirs(codePath)) {
    const ledgerPath = dir === '' ? LEDGER_FILENAME : `${dir}/${LEDGER_FILENAME}`;
    if (!treeHas(tree, ledgerPath)) continue;
    const blocks = extractFencedBlocks(treeGet(tree, ledgerPath), 'grove-test-deps');
    if (blocks.length === 0) {
      // a ledger file present but carrying no readable block: fail-closed
      return { found: false, path: ledgerPath, reason: 'no-block' };
    }
    let parsed;
    try {
      parsed = parseYaml(blocks[0]);
    } catch {
      return { found: false, path: ledgerPath, reason: 'malformed' };
    }
    const specs = toList(parsed && parsed.specs);
    const decisions = toList(parsed && parsed.decisions);
    return { found: true, path: ledgerPath, specs, decisions, ids: [...specs, ...decisions] };
  }
  return { found: false };
}

function toList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}
