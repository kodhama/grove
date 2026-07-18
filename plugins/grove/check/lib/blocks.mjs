// Shared fenced-block extraction. grove's machine-readable surfaces are all
// fenced blocks with a tag info-string (grove-verdict, grove-review-policy,
// grove-review-declaration, grove-test-deps).

// Extract every `<tag>` block, with its document-order index and well-formed
// status (spec-0002 §A.1 "Block delimitation and index", v4 / adr-0019).
//
// A block runs from its opening ```<tag> fence to the FIRST of:
//   - a bare closing fence (``` with only whitespace after the ticks) => WELL-FORMED
//   - the NEXT opening ```<tag> fence (which terminates the still-open block
//     and starts its own) => the terminated block is MALFORMED (unclosed)
//   - end-of-input => MALFORMED (unclosed)
// A FOREIGN info-string fence (e.g. ```python) is NOT a terminator: it stays
// inner content (it is neither a bare fence nor a same-tag opening fence).
//
// Every opening `<tag>` fence gets a 0-based document-order index — well-formed
// AND malformed alike — so a malformed/unclosed block occupies an index but is
// inert on its own and never swallows a following sibling.
//
// Returns: [{ index, inner, wellFormed }] in document order.
export function extractTaggedBlocks(body, tag) {
  if (body == null) return [];
  const open = new RegExp('^\\s*`{3,}' + tag + '\\s*$');
  const bareFence = /^\s*`{3,}\s*$/;
  const lines = String(body).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let index = 0;
  let i = 0;
  const n = lines.length;
  while (i < n) {
    if (open.test(lines[i])) {
      const blockIndex = index++;
      i++; // consume the opening fence
      const inner = [];
      let wellFormed = false;
      while (i < n) {
        if (bareFence.test(lines[i])) { wellFormed = true; i++; break; }
        // The next opening <tag> fence terminates this (still-open => malformed)
        // block WITHOUT being consumed — the outer loop re-reads it as the start
        // of the following block, so a sibling is never swallowed.
        if (open.test(lines[i])) break;
        inner.push(lines[i]);
        i++;
      }
      blocks.push({ index: blockIndex, inner: inner.join('\n'), wellFormed });
    } else {
      i++;
    }
  }
  return blocks;
}

// The single-block surfaces (grove-review-policy, grove-review-declaration,
// grove-test-deps) consume only WELL-FORMED (bare-closed) blocks' inner text.
// Preserved contract: an array of inner strings, malformed blocks dropped.
export function extractFencedBlocks(body, tag) {
  return extractTaggedBlocks(body, tag)
    .filter((b) => b.wellFormed)
    .map((b) => b.inner);
}
