// A deliberately small TOML-subset reader for the consumer config files
// adr-0018 D9/D10 introduces: `.grove/review.toml` (scope + corpus policy) and
// the internal review-wiring file (the two carrier keys). Both are FLAT — no
// `[section]` tables — so this reader handles exactly:
//   - `key = "string"`
//   - `key = ["a", "b", ...]`  (arrays of quoted strings — inline OR multi-line,
//     with an optional trailing comma; grove#92)
//   - `key = true` / `key = false`
//   - `#` comments (whole-line or trailing, outside quotes)
// Anything else throws — fail-closed, never a silent misparse (the same
// discipline as the YAML subset reader). Zero-dependency, node built-ins only.

export class TomlError extends Error {}

function stripComment(line) {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inString = !inString;
    else if (ch === '#' && !inString) return line.slice(0, i);
  }
  return line;
}

// Net array-bracket depth outside quoted strings; > 0 means an array opened in
// `s` is still unclosed (its value continues on following lines).
function bracketDepth(s) {
  let inString = false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') inString = !inString;
    else if (!inString) {
      if (ch === '[') depth += 1;
      else if (ch === ']') depth -= 1;
    }
  }
  return depth;
}

function parseValue(v, lineNo) {
  const s = v.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') return s.slice(1, -1);
  if (s[0] === '[' && s[s.length - 1] === ']') {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    // Naive comma split (paths in these files carry no commas). A trailing
    // comma is valid TOML, so a single empty final item is dropped — but any
    // OTHER empty item (e.g. `["a",,"b"]`) still throws, fail-closed.
    const items = inner.split(',').map((x) => x.trim());
    if (items.length > 0 && items[items.length - 1] === '') items.pop();
    return items.map((it) => {
      if (it.length >= 2 && it[0] === '"' && it[it.length - 1] === '"') return it.slice(1, -1);
      throw new TomlError(`non-string array item on line ${lineNo}: ${JSON.stringify(it)}`);
    });
  }
  throw new TomlError(`unsupported value on line ${lineNo}: ${JSON.stringify(v)}`);
}

export function parseToml(text) {
  if (text == null) throw new TomlError('no text to parse');
  const out = {};
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = stripComment(lines[i]).trim();
    if (line === '') continue;
    if (line[0] === '[') throw new TomlError(`unexpected table header on line ${i + 1}: ${JSON.stringify(lines[i])} (this reader is flat-only)`);
    const eq = line.indexOf('=');
    if (eq < 0) throw new TomlError(`expected "key = value" on line ${i + 1}: ${JSON.stringify(lines[i])}`);
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z0-9_]+$/.test(key)) throw new TomlError(`invalid key on line ${i + 1}: ${JSON.stringify(key)}`);
    if (Object.prototype.hasOwnProperty.call(out, key)) throw new TomlError(`duplicate key "${key}" on line ${i + 1}`);

    const startLine = i;
    let valueText = line.slice(eq + 1);
    // grove#92: a value that opens an array but does not close it on this line
    // continues on following lines — accumulate (comment-stripped) until the
    // brackets balance, or fail closed at EOF. A single-line inline array (depth
    // already 0) skips this and parses exactly as before.
    if (valueText.trim()[0] === '[' && bracketDepth(valueText) > 0) {
      const parts = [valueText];
      let balanced = false;
      while (i + 1 < lines.length) {
        i += 1;
        parts.push(stripComment(lines[i]));
        if (bracketDepth(parts.join('\n')) <= 0) {
          balanced = true;
          break;
        }
      }
      if (!balanced) throw new TomlError(`unterminated array starting on line ${startLine + 1}`);
      valueText = parts.join(' ');
    }
    out[key] = parseValue(valueText, startLine + 1);
  }
  return out;
}
