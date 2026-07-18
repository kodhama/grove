// A deliberately small TOML-subset reader for the consumer config files
// adr-0018 D9/D10 introduces: `.grove/review.toml` (scope + corpus policy) and
// the internal review-wiring file (the two carrier keys). Both are FLAT — no
// `[section]` tables — so this reader handles exactly:
//   - `key = "string"`
//   - `key = ["a", "b", ...]`  (inline arrays of quoted strings)
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

function parseValue(v, lineNo) {
  const s = v.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') return s.slice(1, -1);
  if (s[0] === '[' && s[s.length - 1] === ']') {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((item) => {
      const it = item.trim();
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
    out[key] = parseValue(line.slice(eq + 1), i + 1);
  }
  return out;
}
