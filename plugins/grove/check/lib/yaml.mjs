// A deliberately small YAML-subset parser.
//
// Why hand-rolled: this check ships as a dependency-light vendored plugin
// asset (spec-0002 dispatch: node built-ins only, no npm deps). The subset
// covers exactly what grove's machine-readable surfaces use: frontmatter,
// the fenced policy/declaration/verdict/ledger blocks. Supported:
//   - mappings (`key: value`), nested by indentation
//   - block sequences (`- item`)
//   - flow sequences (`[a, b, c]`)
//   - scalars: plain, single/double quoted, integers
//   - block scalars (`|`), used by verdict `findings`
//   - inline `#` comments (outside quotes/flow brackets)
// Anything outside the subset throws — fail-closed, never a silent misparse.

export class YamlError extends Error {}

function stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  let depth = 0; // flow [] / {} nesting
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inSingle) {
      if (c === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (c === '\\') { i++; continue; }
      if (c === '"') inDouble = false;
      continue;
    }
    if (c === "'") { inSingle = true; continue; }
    if (c === '"') { inDouble = true; continue; }
    if (c === '[' || c === '{') { depth++; continue; }
    if (c === ']' || c === '}') { if (depth > 0) depth--; continue; }
    if (c === '#' && depth === 0 && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function indentOf(line) {
  const m = line.match(/^(\s*)/);
  return m[1].length;
}

function parseScalar(raw) {
  const s = raw.trim();
  if (s === '') return null;
  if (s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s[0] === '"' && s[s.length - 1] === '"') {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (s[0] === "'" && s[s.length - 1] === "'") {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  return s;
}

function parseFlowSeq(raw) {
  const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  if (inner === '') return [];
  // split on commas not inside quotes
  const parts = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;
  for (const c of inner) {
    if (inSingle) { cur += c; if (c === "'") inSingle = false; continue; }
    if (inDouble) { cur += c; if (c === '"') inDouble = false; continue; }
    if (c === "'") { inSingle = true; cur += c; continue; }
    if (c === '"') { inDouble = true; cur += c; continue; }
    if (c === ',') { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts.map((p) => parseScalar(p));
}

function isFlowSeq(s) {
  const t = s.trim();
  return t[0] === '[' && t[t.length - 1] === ']';
}

// Parse a run of lines (already comment-stripped, tabs rejected) at a given
// minimum indent into a value. Returns [value, nextIndex].
function parseBlock(lines, start, minIndent) {
  // Determine the block indent from the first non-blank line at/above minIndent.
  let i = start;
  while (i < lines.length && lines[i].content.trim() === '') i++;
  if (i >= lines.length) return [null, i];
  const blockIndent = lines[i].indent;
  if (blockIndent < minIndent) return [null, start];

  const first = lines[i].content.trim();
  if (first.startsWith('- ') || first === '-') {
    return parseSeq(lines, i, blockIndent);
  }
  return parseMap(lines, i, blockIndent);
}

function parseSeq(lines, start, indent) {
  const arr = [];
  let i = start;
  while (i < lines.length) {
    if (lines[i].content.trim() === '') { i++; continue; }
    if (lines[i].indent < indent) break;
    if (lines[i].indent > indent) throw new YamlError(`unexpected indent in sequence: "${lines[i].content}"`);
    const body = lines[i].content.trim();
    if (!(body === '-' || body.startsWith('- '))) break;
    const rest = body === '-' ? '' : body.slice(2).trim();
    if (rest === '') {
      const [val, next] = parseBlock(lines, i + 1, indent + 1);
      arr.push(val);
      i = next;
    } else if (isFlowSeq(rest)) {
      arr.push(parseFlowSeq(rest));
      i++;
    } else {
      arr.push(parseScalar(rest));
      i++;
    }
  }
  return [arr, i];
}

function parseMap(lines, start, indent) {
  const obj = {};
  let i = start;
  while (i < lines.length) {
    if (lines[i].content.trim() === '') { i++; continue; }
    if (lines[i].indent < indent) break;
    if (lines[i].indent > indent) throw new YamlError(`unexpected indent in mapping: "${lines[i].content}"`);
    const body = lines[i].content.trim();
    if (body.startsWith('- ')) break;
    const colon = findKeyColon(body);
    if (colon < 0) throw new YamlError(`expected "key: value": "${body}"`);
    const key = body.slice(0, colon).trim();
    const rest = body.slice(colon + 1).trim();
    if (rest === '') {
      const [val, next] = parseBlock(lines, i + 1, indent + 1);
      obj[key] = val;
      i = next;
    } else if (rest === '|' || rest === '>') {
      const [val, next] = parseBlockScalar(lines, i + 1, indent, rest === '>');
      obj[key] = val;
      i = next;
    } else if (isFlowSeq(rest)) {
      obj[key] = parseFlowSeq(rest);
      i++;
    } else {
      obj[key] = parseScalar(rest);
      i++;
    }
  }
  return [obj, i];
}

function parseBlockScalar(lines, start, parentIndent, folded) {
  const out = [];
  let i = start;
  let scalarIndent = null;
  while (i < lines.length) {
    const line = lines[i];
    if (line.content.trim() === '') { out.push(''); i++; continue; }
    if (line.indent <= parentIndent) break;
    if (scalarIndent === null) scalarIndent = line.indent;
    out.push(line.raw.slice(scalarIndent));
    i++;
  }
  // trim trailing blank lines
  while (out.length && out[out.length - 1] === '') out.pop();
  const text = folded ? out.join(' ') : out.join('\n');
  return [text, i];
}

function findKeyColon(s) {
  let inSingle = false;
  let inDouble = false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inSingle) { if (c === "'") inSingle = false; continue; }
    if (inDouble) { if (c === '"') inDouble = false; continue; }
    if (c === "'") { inSingle = true; continue; }
    if (c === '"') { inDouble = true; continue; }
    if (c === '[' || c === '{') { depth++; continue; }
    if (c === ']' || c === '}') { if (depth) depth--; continue; }
    if (c === ':' && depth === 0 && (i + 1 >= s.length || /\s/.test(s[i + 1]))) {
      return i;
    }
  }
  return -1;
}

export function parseYaml(text) {
  if (text == null) return null;
  const rawLines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const lines = rawLines.map((raw) => {
    if (raw.includes('\t')) {
      // tabs are not valid YAML indentation; reject fail-closed
      const idt = indentOf(raw);
      if (raw.slice(0, idt).includes('\t')) throw new YamlError('tab in indentation');
    }
    const content = stripComment(raw);
    return { raw, content, indent: indentOf(content) };
  });
  // top-level: find first non-blank
  let i = 0;
  while (i < lines.length && lines[i].content.trim() === '') i++;
  if (i >= lines.length) return {};
  const [val] = parseBlock(lines, i, lines[i].indent);
  return val;
}
