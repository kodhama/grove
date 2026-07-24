// Frontmatter extraction (spec-0002 §B, §A.3, §C.7).
// A grove artifact carries a leading `---` ... `---` YAML frontmatter block.
// A file with none is code (the caller applies "no frontmatter => code").

import { parseYaml } from './yaml.mjs';

const FM_RE = /^---\n([\s\S]*?)\n---(\n|$)/;

export function parseFrontmatter(content) {
  if (content == null) return null;
  const m = FM_RE.exec(String(content).replace(/\r\n?/g, '\n'));
  if (!m) return null;
  const obj = parseYaml(m[1]);
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return null;
  return obj;
}

function asList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}

export function artifactMeta(content) {
  const fm = parseFrontmatter(content);
  if (fm == null) {
    return { hasFrontmatter: false, id: null, type: null, status: null, implements: null, depends_on: [] };
  }
  return {
    hasFrontmatter: true,
    id: fm.id != null ? String(fm.id) : null,
    type: fm.type != null ? String(fm.type) : null,
    status: fm.status != null ? String(fm.status) : null,
    implements: fm.implements != null ? String(fm.implements) : null,
    depends_on: asList(fm.depends_on),
  };
}
