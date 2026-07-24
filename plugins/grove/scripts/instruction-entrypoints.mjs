#!/usr/bin/env node

import {
  chmod,
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = resolve(SCRIPT_DIR, "..", ".claude-plugin", "plugin.json");
const COMMANDS = new Set(["compose", "strip", "check"]);

class ContractRefusal extends Error {}

function lineRecords(text) {
  const records = [];
  let offset = 0;

  while (offset < text.length) {
    const match = /(\r\n|\n|\r)/g;
    match.lastIndex = offset;
    const found = match.exec(text);
    const contentEnd = found ? found.index : text.length;
    const end = found ? found.index + found[0].length : text.length;
    records.push({
      content: text.slice(offset, contentEnd),
      newline: found?.[0] ?? "",
      start: offset,
      contentEnd,
      end,
    });
    offset = end;
  }

  return records;
}

function markdownColumnWidth(text, startColumn = 0) {
  let column = startColumn;
  for (const character of text) {
    column =
      character === "\t" ? column + (4 - (column % 4)) : column + 1;
  }
  return column;
}

function consumeIndentColumns(text, startColumn, width) {
  let column = startColumn;
  const target = startColumn + width;
  let index = 0;
  while (index < text.length && column < target) {
    const character = text[index];
    if (character !== " " && character !== "\t") return null;
    column =
      character === "\t" ? column + (4 - (column % 4)) : column + 1;
    index += 1;
  }
  if (column < target) return null;
  return `${" ".repeat(column - target)}${text.slice(index)}`;
}

function splitFenceIndent(text, startColumn) {
  let column = startColumn;
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character !== " " && character !== "\t") break;
    const nextColumn =
      character === "\t" ? column + (4 - (column % 4)) : column + 1;
    if (nextColumn - startColumn > 3) return null;
    column = nextColumn;
    index += 1;
  }
  return { content: text.slice(index), column };
}

function openingFence(content) {
  const containers = [];
  let rest = content;
  let column = 0;

  while (true) {
    const quote = rest.match(/^ {0,3}>[ \t]?/);
    if (quote) {
      containers.push({ kind: "quote" });
      column = markdownColumnWidth(quote[0], column);
      rest = rest.slice(quote[0].length);
      continue;
    }
    const list = rest.match(
      /^ {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]{1,4}/,
    );
    if (list) {
      const nextColumn = markdownColumnWidth(list[0], column);
      containers.push({
        kind: "list",
        indentColumns: nextColumn - column,
      });
      column = nextColumn;
      rest = rest.slice(list[0].length);
      continue;
    }
    break;
  }

  const indented = splitFenceIndent(rest, column);
  if (!indented) return null;
  const opening = indented.content.match(/^(`{3,}|~{3,})(.*)$/);
  if (!opening) return null;
  if (opening[1][0] === "`" && opening[2].includes("`")) return null;
  return {
    character: opening[1][0],
    length: opening[1].length,
    containers,
  };
}

function contentInsideFenceContainer(content, containers) {
  let rest = content;
  let column = 0;
  for (const container of containers) {
    if (container.kind === "quote") {
      const quote = rest.match(/^ {0,3}>[ \t]?/);
      if (!quote) return null;
      column = markdownColumnWidth(quote[0], column);
      rest = rest.slice(quote[0].length);
      continue;
    }

    const consumed = consumeIndentColumns(
      rest,
      column,
      container.indentColumns,
    );
    if (consumed === null) {
      if (rest.trim() === "") continue;
      return null;
    }
    rest = consumed;
    column += container.indentColumns;
  }
  return { content: rest, column };
}

function activeLineRecords(text) {
  const active = [];
  let fence = null;

  for (const record of lineRecords(text)) {
    if (fence) {
      const contained = contentInsideFenceContainer(
        record.content,
        fence.containers,
      );
      if (contained !== null) {
        const indented = splitFenceIndent(contained.content, contained.column);
        const closing = indented?.content.match(/^(`+|~+)[ \t]*$/);
        if (
          closing &&
          closing[1][0] === fence.character &&
          closing[1].length >= fence.length
        ) {
          fence = null;
        }
        continue;
      }
      fence = null;
    }

    const opening = openingFence(record.content);
    if (opening) {
      fence = opening;
      continue;
    }

    active.push(record);
  }

  return active;
}

function classifyLine(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith("<!-- grove:begin") && trimmed.endsWith("-->")) {
    return "begin";
  }
  if (trimmed.startsWith("<!-- grove:end") && trimmed.endsWith("-->")) {
    return "end";
  }
  if (trimmed === "@AGENTS.md" || trimmed === "@./AGENTS.md") {
    return "agents-import";
  }
  if (trimmed === "@CLAUDE.md" || trimmed === "@./CLAUDE.md") {
    return "claude-import";
  }
  return null;
}

function inspectText(text, label) {
  const classified = activeLineRecords(text).map((record) => ({
    ...record,
    kind: classifyLine(record.content),
  }));
  const begins = classified.filter((record) => record.kind === "begin");
  const ends = classified.filter((record) => record.kind === "end");
  const agentsImports = classified.filter(
    (record) => record.kind === "agents-import",
  );
  const claudeImports = classified.filter(
    (record) => record.kind === "claude-import",
  );

  if (begins.length !== ends.length || begins.length > 1) {
    throw new ContractRefusal(
      `${label} has unmatched or repeated Grove markers`,
    );
  }
  if (begins.length === 1 && begins[0].start >= ends[0].start) {
    throw new ContractRefusal(`${label} has a Grove end marker before its begin`);
  }

  const block =
    begins.length === 1
      ? {
          start: begins[0].start,
          end: ends[0].end,
          text: text.slice(begins[0].start, ends[0].end),
        }
      : null;

  return { block, agentsImports, claudeImports };
}

function newlineFor(text) {
  const match = text.match(/\r\n|\n|\r/);
  return match?.[0] ?? "\n";
}

function normalizeNewlines(text) {
  return text.replace(/\r\n|\r/g, "\n");
}

function renderBlock(version, newline = "\n") {
  return [
    "<!-- grove:begin (managed by grove — dials live in .grove/, not this block) -->",
    "Work items matching a grove workflow (W1–W6 — e.g. a bug report → the bug",
    "pipeline, a research ask → divergent research) run as grove runs, sequenced",
    "through grove's chartered agent roles, loaded from the grove plugin as",
    "`grove:<role>` subagents (all thirteen). Anything else — conversation, trivial",
    "asks, out-of-scope questions — proceeds normally. This repo's dials live in",
    "`.grove/` (see its README). Version skew (adr-0026 D4): at role start, if the",
    "installed grove plugin's version differs from the stamp below, disclose the",
    "divergence loudly in your report and continue — the stamp is the in-repo",
    "ratified record, never a lock; grove never enforces it.",
    `grove plugin@${version}`,
    "",
    "Shared project instructions live in unmarked prose in `AGENTS.md`; add new",
    "shared rules there, put Claude-only rules in `.claude/rules/`, and edit Grove",
    "dials in `.grove/`. Do not hand-edit this block or the `CLAUDE.md` adapter.",
    "<!-- grove:end -->",
    "",
  ].join(newline);
}

function blockWithExistingFinalNewline(block, version, newline) {
  const rendered = renderBlock(version, newline);
  return /(?:\r\n|\n|\r)$/.test(block.text)
    ? rendered
    : rendered.slice(0, -newline.length);
}

function replaceBlock(text, block, version) {
  const newline = newlineFor(text);
  return (
    text.slice(0, block.start) +
    blockWithExistingFinalNewline(block, version, newline) +
    text.slice(block.end)
  );
}

function appendBlock(text, version) {
  const newline = newlineFor(text);
  const rendered = renderBlock(version, newline);
  if (text.length === 0) return rendered;
  if (/(?:\r\n|\n|\r)$/.test(text)) return `${text}${newline}${rendered}`;
  return `${text}${newline}${newline}${rendered}`;
}

function removeBlock(text, block) {
  if (!block) return text;
  return text.slice(0, block.start) + text.slice(block.end);
}

function replaceLineContent(text, record, replacement) {
  return (
    text.slice(0, record.start) +
    replacement +
    text.slice(record.contentEnd)
  );
}

function ensureAgentsImport(text) {
  const inspected = inspectText(text, "CLAUDE.md");
  const imports = inspected.agentsImports;

  if (imports.length === 0) {
    const newline = newlineFor(text);
    return text.length === 0
      ? `@AGENTS.md${newline}`
      : `@AGENTS.md${newline}${newline}${text}`;
  }

  let output = text;
  const [first, ...duplicates] = imports;
  for (const duplicate of duplicates.reverse()) {
    output = output.slice(0, duplicate.start) + output.slice(duplicate.end);
  }
  output = replaceLineContent(output, first, "@AGENTS.md");
  return output;
}

function assertNoImportCycle(agentsText) {
  const inspected = inspectText(agentsText, "AGENTS.md");
  if (inspected.claudeImports.length > 0) {
    throw new ContractRefusal(
      "AGENTS.md imports CLAUDE.md and would create an instruction cycle",
    );
  }
}

export function composeTexts({ agentsText, claudeText, version }) {
  assertNoImportCycle(agentsText);
  const agents = inspectText(agentsText, "AGENTS.md");
  const claude = inspectText(claudeText, "CLAUDE.md");

  let nextAgents;
  let nextClaude;
  let migratedFrom = null;

  if (agents.block && claude.block) {
    if (agentsText !== claudeText) {
      throw new ContractRefusal(
        "AGENTS.md and CLAUDE.md both contain non-identical Grove-bearing content",
      );
    }
    nextAgents = replaceBlock(agentsText, agents.block, version);
    nextClaude = `@AGENTS.md${newlineFor(claudeText)}`;
    migratedFrom = "byte-identical-copy";
  } else if (agents.block) {
    nextAgents = replaceBlock(agentsText, agents.block, version);
    nextClaude = ensureAgentsImport(claudeText);
  } else if (claude.block) {
    nextAgents = appendBlock(agentsText, version);
    nextClaude = ensureAgentsImport(removeBlock(claudeText, claude.block));
    migratedFrom = "CLAUDE.md";
  } else {
    nextAgents = appendBlock(agentsText, version);
    nextClaude = ensureAgentsImport(claudeText);
  }

  return {
    agentsText: nextAgents,
    claudeText: nextClaude,
    migratedFrom,
  };
}

export function stripTexts({ agentsText, claudeText }) {
  const agents = inspectText(agentsText, "AGENTS.md");
  const claude = inspectText(claudeText, "CLAUDE.md");
  return {
    agentsText: removeBlock(agentsText, agents.block),
    claudeText: removeBlock(claudeText, claude.block),
    removed: Number(Boolean(agents.block)) + Number(Boolean(claude.block)),
  };
}

export function checkTexts({ agentsText, claudeText, version }) {
  assertNoImportCycle(agentsText);
  const agents = inspectText(agentsText, "AGENTS.md");
  const claude = inspectText(claudeText, "CLAUDE.md");
  if (!agents.block) {
    throw new ContractRefusal("AGENTS.md does not contain a Grove block");
  }
  if (claude.block) {
    throw new ContractRefusal("CLAUDE.md still contains a Grove block");
  }
  if (claude.agentsImports.length !== 1) {
    throw new ContractRefusal(
      "CLAUDE.md must contain exactly one active AGENTS.md import",
    );
  }
  if (claude.agentsImports[0].content !== "@AGENTS.md") {
    throw new ContractRefusal(
      "CLAUDE.md adapter must be the exact standalone line @AGENTS.md",
    );
  }

  const expected = normalizeNewlines(renderBlock(version)).trimEnd();
  const actual = normalizeNewlines(agents.block.text).trimEnd();
  if (actual !== expected) {
    throw new ContractRefusal(
      `AGENTS.md Grove block does not match plugin version ${version}`,
    );
  }

  return { version };
}

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function existingMode(path) {
  try {
    return (await stat(path)).mode;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeAtomically(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(
    dirname(path),
    `.${basename(path)}.grove-${process.pid}-${Math.random()
      .toString(16)
      .slice(2)}.tmp`,
  );
  const mode = await existingMode(path);
  try {
    await writeFile(temporary, content, "utf8");
    if (mode !== null) await chmod(temporary, mode);
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function applyTransformedWrites({
  agentsPath,
  agentsText,
  claudePath,
  claudeText,
  transformed,
  write = writeAtomically,
}) {
  if (transformed.agentsText !== agentsText) {
    await write(agentsPath, transformed.agentsText);
  }
  if (transformed.claudeText !== claudeText) {
    await write(claudePath, transformed.claudeText);
  }
}

async function pluginVersion() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error(`missing plugin version in ${MANIFEST_PATH}`);
  }
  return manifest.version;
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (!COMMANDS.has(command)) {
    throw new Error("expected command: compose, strip, or check");
  }

  let projectRoot = null;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] !== "--project-root" || index + 1 >= rest.length) {
      throw new Error(`unexpected argument: ${rest[index]}`);
    }
    projectRoot = rest[index + 1];
    index += 1;
  }
  if (!projectRoot) throw new Error("--project-root is required");

  return {
    command,
    projectRoot: isAbsolute(projectRoot)
      ? projectRoot
      : resolve(process.cwd(), projectRoot),
  };
}

async function run(argv) {
  const { command, projectRoot } = parseArguments(argv);
  const agentsPath = join(projectRoot, "AGENTS.md");
  const claudePath = join(projectRoot, "CLAUDE.md");
  const [agentsText, claudeText] = await Promise.all([
    readOptional(agentsPath),
    readOptional(claudePath),
  ]);

  if (command === "check") {
    const version = await pluginVersion();
    checkTexts({ agentsText, claudeText, version });
    return {
      command,
      changed: false,
      agentsPath,
      claudePath,
      version,
    };
  }

  const version = command === "compose" ? await pluginVersion() : null;
  const transformed =
    command === "compose"
      ? composeTexts({ agentsText, claudeText, version })
      : stripTexts({ agentsText, claudeText });
  const changed =
    transformed.agentsText !== agentsText ||
    transformed.claudeText !== claudeText;

  if (changed) {
    await applyTransformedWrites({
      agentsPath,
      agentsText,
      claudePath,
      claudeText,
      transformed,
    });
  }

  return {
    command,
    changed,
    agentsPath,
    claudePath,
    ...(command === "compose"
      ? { migratedFrom: transformed.migratedFrom, version }
      : { removed: transformed.removed }),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(await run(process.argv.slice(2)))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error instanceof ContractRefusal ? 2 : 1;
  }
}
