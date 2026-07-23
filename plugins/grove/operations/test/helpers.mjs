import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { after } from 'node:test';

const fixtureRoots = new Set();

after(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
});

export async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'grove-operations-'));
  fixtureRoots.add(root);
  const packageRoot = join(root, 'package');
  const repoRoot = join(root, 'consumer');
  await mkdir(join(packageRoot, 'gates', 'lib'), { recursive: true });
  await mkdir(join(packageRoot, 'gates', 'bin'), { recursive: true });
  await mkdir(join(packageRoot, 'reference', 'gates'), { recursive: true });
  await mkdir(join(packageRoot, 'build', 'generated'), { recursive: true });
  await mkdir(join(packageRoot, 'install'), { recursive: true });
  await mkdir(repoRoot, { recursive: true });

  await writeFile(join(packageRoot, 'VERSION'), '0.3.0\n');
  await writeFile(join(packageRoot, 'gates', 'package.json'), '{"type":"module"}\n');
  await writeFile(join(packageRoot, 'gates', 'lib', 'profile.mjs'), 'export const ok = true;\n');
  await writeFile(join(packageRoot, 'gates', 'bin', 'resolve-profile.mjs'), '#!/usr/bin/env node\n');
  await writeFile(join(packageRoot, 'reference', 'gates', 'enforcement.toml'), 'schema = 1\n');
  await writeFile(join(packageRoot, 'reference', 'gates', 'gates.toml'), gatesTemplate());
  await writeFile(
    join(packageRoot, 'install', 'config-tokens.json'),
    JSON.stringify({
      schema_version: 1,
      tokens: ['TEST_CMD', 'ARTIFACT_DIRS'],
      list_tokens: ['ARTIFACT_DIRS'],
    }) + '\n',
  );
  await writeFile(
    join(packageRoot, 'surfaces.json'),
    JSON.stringify({
      schema_version: 1,
      version: '0.3.0',
      rows: [
        {
          surface_id: 'claude-interactive',
          host: 'claude',
          bridge_state: 'host-native',
          release_state: 'supported',
          load_path: 'plugin-agents',
          evidence: ['fixture'],
        },
        {
          surface_id: 'codex-exec-non-ephemeral',
          host: 'codex',
          bridge_state: 'bridge-viable',
          release_state: 'candidate',
          load_path: 'project-launchers',
          evidence: ['fixture'],
        },
        {
          surface_id: 'codex-exec-ephemeral',
          host: 'codex',
          bridge_state: 'partial',
          release_state: 'unsupported',
          missing_capability: 'plugin-relative role reference unverified',
          disclosure: 'Grove native roles are unavailable on ephemeral codex exec.',
        },
      ],
    }, null, 2) + '\n',
  );
  await writeFile(
    join(packageRoot, 'build', 'generated', 'codex-launchers.json'),
    JSON.stringify({
      generated: true,
      source: 'roles.json',
      launchers: [
        {
          canonical_id: 'executor',
          native_id: 'grove_executor',
          exposure: 'cold-native',
          source: 'charters/executor.md',
          digest: 'abc',
          output: '.codex/agents/grove_executor.toml',
          content: '# GENERATED — DO NOT EDIT; canonical-source: charters/executor.md; sha256: abc\nname = "grove_executor"\n',
        },
        {
          canonical_id: 'dispatcher',
          native_id: 'grove_dispatcher_advisor',
          exposure: 'scoped-advisor',
          source: 'charters/dispatcher.md',
          digest: 'def',
          output: '.codex/agents/grove_dispatcher_advisor.toml',
          content: '# GENERATED — DO NOT EDIT; canonical-source: charters/dispatcher.md; sha256: def\nname = "grove_dispatcher_advisor"\n',
        },
      ],
    }, null, 2) + '\n',
  );
  return { root, packageRoot, repoRoot };
}

export function gatesTemplate() {
  return `# consumer-authoritative
seeded_from = "steward"
runtime_dir = ".custom/gates/"

[gates]
intent = "human"
spec = "agent"
build = "agent"
ship = "human"

[trigger]
sources = ["human-ask", "cron"]

[intent_external]
enabled = false
`;
}

export const claudeInvocation = Object.freeze({
  host: 'claude',
  surface: { surface_id: 'claude-interactive', provenance: 'user-explicit' },
});

export const codexInvocation = Object.freeze({
  host: 'codex',
  surface: { surface_id: 'codex-exec-non-ephemeral', provenance: 'user-explicit' },
});
