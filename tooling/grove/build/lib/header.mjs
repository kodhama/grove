// THE generated-file header, in one place. Every generated artifact carries
// the same sentence — the orphan detector greps its literal `GENERATED — DO
// NOT EDIT` — and only the comment syntax differs by output language.
//
// The `//` form is new with adr-0048: the generator emitted only the `<!-- -->`
// and `#` forms, neither of which a `.mjs` output can carry.
const PREFIXES = Object.freeze({
  "<!--": (body) => `<!-- ${body} -->`,
  "#": (body) => `# ${body}`,
  "//": (body) => `// ${body}`,
});

export function generatedHeader(source, digest, prefix = "<!--") {
  const wrap = PREFIXES[prefix];
  if (!wrap) throw new Error(`unknown generated-header comment prefix: ${prefix}`);
  return wrap(
    `GENERATED — DO NOT EDIT; canonical-source: ${source}; sha256: ${digest}`,
  );
}
