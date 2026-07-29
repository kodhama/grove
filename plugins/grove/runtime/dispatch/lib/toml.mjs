// Hand-rolled strict TOML subset for grove's dispatch data (spec-0006).
// Zero-dependency by the same rule as the rest of the shipped runtime
// (parseProfile in runtime/lifecycle is the precedent). Deliberately closed:
// it accepts exactly the shapes grove's dispatch files use — top-level
// key/value pairs, [[array-of-tables]] headers, quoted strings, non-negative
// integers, and single- or multi-line arrays of quoted strings — and fails
// loudly on everything else. Leniency here would be a fail-open: a rule or
// cursor that silently parses to something other than what its author wrote
// is a rule nobody validated.

const BARE_KEY = /^[A-Za-z0-9_-]+$/;
const INTEGER = /^(0|[1-9][0-9]*)$/;

// A backslash run of ODD length escapes the character after it; a prev-char
// check misreads "a\\" + quote as escaped and swallows the string.
function isEscaped(text, position) {
  let count = 0;
  let index = position - 1;
  while (index >= 0 && text[index] === '\\') {
    count += 1;
    index -= 1;
  }
  return count % 2 === 1;
}

export function parseToml(text) {
  if (String(text).charCodeAt(0) === 0xfeff) {
    throw new Error('line 1: byte-order mark is invalid; keys start at byte 0');
  }
  // Null-prototype tables: a "__proto__" key becomes plain own data, so no
  // parsed document can reach Object.prototype (prototype pollution).
  const root = Object.create(null);
  let current = root;
  const lines = String(text).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = stripComment(lines[index], lineNumber);
    if (line === '') continue;

    const arrayHeader = line.match(/^\[\[([^\]]+)\]\]$/);
    if (arrayHeader) {
      const name = arrayHeader[1].trim();
      if (!BARE_KEY.test(name)) {
        throw new Error(`line ${lineNumber}: invalid table array name "${name}"`);
      }
      if (!(name in root)) root[name] = [];
      if (!Array.isArray(root[name])) {
        throw new Error(`line ${lineNumber}: "${name}" is already a non-array value`);
      }
      current = Object.create(null);
      root[name].push(current);
      continue;
    }
    if (line.startsWith('[')) {
      throw new Error(`line ${lineNumber}: unsupported table header "${line}"`);
    }

    const eq = line.indexOf('=');
    if (eq === -1) {
      throw new Error(`line ${lineNumber}: invalid line "${line}"`);
    }
    const key = line.slice(0, eq).trim();
    if (!BARE_KEY.test(key)) {
      throw new Error(`line ${lineNumber}: invalid key "${key}"`);
    }
    if (Object.prototype.hasOwnProperty.call(current, key)) {
      throw new Error(`line ${lineNumber}: duplicate key "${key}"`);
    }
    let rawValue = line.slice(eq + 1).trim();
    if (rawValue.startsWith('[') && !balancedArray(rawValue)) {
      // Multi-line array: consume until the closing bracket line.
      while (index + 1 < lines.length) {
        index += 1;
        rawValue += `\n${stripComment(lines[index], index + 1)}`;
        if (balancedArray(rawValue)) break;
      }
      if (!balancedArray(rawValue)) {
        throw new Error(`line ${lineNumber}: unterminated array for "${key}"`);
      }
    }
    current[key] = parseValue(rawValue, lineNumber, key);
  }
  return root;
}

function stripComment(rawLine, lineNumber) {
  let inString = false;
  for (let position = 0; position < rawLine.length; position += 1) {
    const character = rawLine[position];
    if (character === '"' && !isEscaped(rawLine, position)) {
      inString = !inString;
    } else if (character === '#' && !inString) {
      return rawLine.slice(0, position).trim();
    }
  }
  if (inString) {
    throw new Error(`line ${lineNumber}: unterminated string`);
  }
  return rawLine.trim();
}

function balancedArray(value) {
  let depth = 0;
  let inString = false;
  for (let position = 0; position < value.length; position += 1) {
    const character = value[position];
    if (character === '"' && !isEscaped(value, position)) inString = !inString;
    else if (!inString && character === '[') depth += 1;
    else if (!inString && character === ']') depth -= 1;
  }
  return depth === 0 && !inString;
}

function parseValue(raw, lineNumber, key) {
  const value = raw.trim();
  if (value === '') {
    throw new Error(`line ${lineNumber}: "${key}" has no value`);
  }
  if (value.startsWith('"')) return parseString(value, lineNumber, key);
  if (INTEGER.test(value)) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      throw new Error(
        `line ${lineNumber}: integer for "${key}" exceeds the safe range: ${value}`,
      );
    }
    return parsed;
  }
  if (value.startsWith('[')) return parseArray(value, lineNumber, key);
  throw new Error(
    `line ${lineNumber}: unsupported or unquoted value for "${key}": ${value}`,
  );
}

function parseString(value, lineNumber, key) {
  if (value.length < 2 || !value.endsWith('"')) {
    throw new Error(`line ${lineNumber}: invalid string for "${key}"`);
  }
  const body = value.slice(1, -1);
  let result = '';
  for (let position = 0; position < body.length; position += 1) {
    const character = body[position];
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) {
      throw new Error(
        `line ${lineNumber}: raw control character in "${key}"; use an escape`,
      );
    }
    if (character === '"') {
      throw new Error(`line ${lineNumber}: invalid string for "${key}"`);
    }
    if (character !== '\\') {
      result += character;
      continue;
    }
    position += 1;
    const escaped = body[position];
    if (escaped === '"') result += '"';
    else if (escaped === '\\') result += '\\';
    else if (escaped === 'n') result += '\n';
    else if (escaped === 't') result += '\t';
    else {
      throw new Error(
        `line ${lineNumber}: unsupported escape \\${escaped ?? ''} in "${key}"`,
      );
    }
  }
  return result;
}

function parseArray(value, lineNumber, key) {
  if (!value.endsWith(']')) {
    throw new Error(`line ${lineNumber}: invalid array for "${key}"`);
  }
  const inner = value.slice(1, -1);
  // Commas are the ONLY separators; a newline never separates items, so
  // comma-less multi-line entries fail as one malformed token instead of
  // silently splitting.
  const tokens = [];
  let token = '';
  let inString = false;
  for (let position = 0; position < inner.length; position += 1) {
    const character = inner[position];
    if (character === '"' && !isEscaped(inner, position)) {
      inString = !inString;
      token += character;
    } else if (character === ',' && !inString) {
      tokens.push(token);
      token = '';
    } else if ((character === '[' || character === ']') && !inString) {
      throw new Error(`line ${lineNumber}: nested arrays are unsupported in "${key}"`);
    } else {
      token += character;
    }
  }
  tokens.push(token);
  // TOML permits one trailing comma: a single blank FINAL token is dropped;
  // any other blank token ( ["a",,"b"] / [,"a"] ) is an empty array token.
  if (tokens.length > 0 && tokens[tokens.length - 1].trim() === '') tokens.pop();
  return tokens.map((item) => {
    const trimmed = item.trim();
    if (trimmed === '') {
      throw new Error(`line ${lineNumber}: empty array token in "${key}"`);
    }
    if (!trimmed.startsWith('"')) {
      throw new Error(
        `line ${lineNumber}: unsupported or unquoted array item in "${key}": ${trimmed}`,
      );
    }
    return parseString(trimmed, lineNumber, key);
  });
}
