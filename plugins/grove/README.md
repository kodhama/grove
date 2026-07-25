# Grove dual-host package

Grove packages one canonical agent methodology for Claude Code and Codex. The
normative role and companion prose remains in the repository's
[`charters/`](../../charters/) directory. Host payloads are generated
projections and loading adapters; they are not independent copies to edit.
Runtime reference projections omit the source artifact front matter while
retaining the canonical prose. The lifecycle, relations, and versioning
companions each ship once at their established `reference/*.md` path.

The package version proposed by this branch is read from [`VERSION`](VERSION).
The maintainer's merge of that version change is the human release act; this
branch does not publish or self-release it.

## Build and validate

From the repository root:

```sh
npm run generate --prefix tooling/grove/build
npm run check --prefix tooling/grove/build
npm run docs --prefix tooling/grove/release
npm test --prefix tooling/grove/release
npm run check --prefix tooling/grove/release
```

Generation is deterministic. Its check mode reports stale, missing, or
unexpected projections without writing. Release validation checks the Claude
and Codex manifests against `VERSION`, validates the surface record and
evidence paths, rejects plugin-carried Codex custom-agent TOML, and verifies
the matrix-derived support tables in both READMEs.

`npm run check:release --prefix tooling/grove/release` is intentionally
stricter: it also rejects every `candidate` surface. A release cannot be
tagged until each candidate is backed by a complete support record and
promoted to `supported`, or is explicitly classified `unsupported`.

## Prepare the isolated Codex support probe

From the repository root, on a clean committed candidate:

```sh
npm run prepare:codex --prefix tooling/grove/probes
```

Preparation runs the generated-package, release-package, and static Codex
composition checks; snapshots the exact candidate; and creates a local
marketplace, isolated `CODEX_HOME`/SQLite/temp roots, structured prompts,
schemas, and an evidence runner. Because candidate surfaces are never
write-authorized, fresh-consumer plan generation uses a separately hash-bound
composition-only copy whose one candidate row is temporarily marked supported.
The marketplace and all evidence still use the untouched exact candidate
snapshot. The seam is recorded in `probe-manifest.json`. Preparation **never
launches Codex**, reads existing Codex state, copies credentials, or changes
the source surface matrix.

The command prints one `node .../run-probe.mjs` command to run from a separate
interactive Terminal. First run that command with `--preflight`; the
non-interactive preflight verifies the exact package digest, launcher bytes,
composition seam, and every source-side harness module hash without launching
Codex. The normal runner then authenticates only the isolated home,
verifies it has exactly one enabled Grove candidate, and executes sequential
non-ephemeral phases: both driving roles, three native batches of four, a
separate executor/reviewer check, the scoped dispatcher, and the executor
config/addendum sentinels. The probe-local config caps subagent concurrency at
one, pins `gpt-5.6-sol` with MultiAgentV2, and explicitly trusts only the
fresh isolated consumer so Codex loads its project-scoped launchers. Native
spawns use the exact launcher id with no history fork. Each phase has a bounded
timeout and retains JSONL, exact argv,
timestamps, exit code, stderr, structured output, and a minimal mapping from
each persisted spawn call to the observed custom-agent role, agent path,
parent thread, CLI version/model/provider/backend, exact child discovery JSON,
and raw session-metadata hash recorded by the isolated Codex session. Every
retained phase artifact, plus the plugin inventory and Codex version, is bound
into the candidate record by SHA-256; roots are unique per phase and child
lineage must resolve to that phase's root.
This safe projection remains with the logs; full session metadata and
instructions remain only in the isolated home.

The runner writes an incomplete attempt at the first failure. On success it
writes a validator-clean **candidate** support record, but never promotes
`metadata/surfaces.json`. The validator checks internal structure and artifact bindings;
an independent reviewer must still compare those hashes with the retained raw
files and inspect the raw events before promotion. That review is the external
trust boundary: the JSON validator does not claim to authenticate who created
the files. The isolated home may contain login state, so do not archive it.
After retaining evidence, run the printed `--sanitize` command to remove only
that marked probe home, SQLite state, and runtime temp directory.

The Codex probe does not satisfy the cross-host shallow/deep discovery cases
by itself. [`tooling/grove/probes/host-discovery-contract.json`](../../tooling/grove/probes/host-discovery-contract.json)
is the explicit release-blocking external artifact contract for clean
marketplace installs on Claude and Codex at both shallow and eight-level-deep
paths containing spaces. Those S22/S23 cases remain unpassed until all four
live-host evidence bundles exist and pass independent review.

## Install through Claude

The existing Claude marketplace channel remains:

```text
/plugin marketplace add kodhama/stewards
/plugin install grove@kodhama
/grove:setup
```

Start a fresh session after installation. On a matrix-supported Claude
surface, generated agents load from the plugin; setup composes only Grove's
repo-owned floor and the managed instruction block.

## Install through Codex

Codex distribution uses the host-native catalog in `kodhama/stewards`.
That catalog—not this package repository—owns
`.agents/plugins/marketplace.json` and points its `grove` entry at a released
Grove package:

```sh
codex plugin marketplace add kodhama/stewards
codex plugin add grove@kodhama
```

Start a fresh Codex task, then invoke Grove setup with an explicit surface id.
Codex plugins supply skills and references, not native custom-agent
definitions. On an eligible bridge surface, setup composes thin project
launchers under `.codex/agents/`; the plugin itself contains no custom-agent
TOML and the launchers contain no charter body.

No in-repository `.agents/plugins/marketplace.json` is created here. The
catalog change is an outside-repository deliverable with its own branch and
review.

## Current surface evidence

The table below is generated from
[`metadata/surfaces.json`](metadata/surfaces.json). “Candidate” means the
loading primitive is available for integration testing, not that the surface
is supported for release.

<!-- grove-surface-matrix:begin (generated from plugins/grove/metadata/surfaces.json) -->
| Surface | Release state | Load/bridge state | Disclosure |
|---|---|---|---|
| `claude-interactive` | Unsupported | host-native | The package has an established interactive load path, but Grove does not claim 0.3.0 support until the complete release record passes. |
| `claude-cloud` | Unsupported | host-native | Unsupported until a fresh cloud session proves the full role-discovery contract. |
| `claude-github-action` | Unsupported | host-native | Unsupported until the action load path passes the full role-discovery contract. |
| `claude-headless` | Unsupported | host-native | Unsupported in 0.3.0; the local plugin load command is known, but no role-discovery claim is inferred from a probe blocked before inference. |
| `claude-agent-sdk` | Unsupported | host-native | Unsupported until the local-plugin SDK load passes the full role-discovery contract. |
| `codex-cli-interactive` | Unsupported | unknown | Unsupported; Grove will not infer parity from codex exec. |
| `codex-exec-non-ephemeral` | Candidate — not supported | bridge-viable | Bridge-viable after the v4 package split; candidate only until a fresh non-ephemeral Codex support record passes against the exact package snapshot. |
| `codex-exec-ephemeral` | Unsupported | partial-primitive | Unsupported; partial skill loading is not a Grove role bridge. |
| `codex-desktop-local` | Unsupported | unknown | Unsupported until a desktop-local bridge and full support record pass. |
| `codex-cloud-web` | Unsupported | unknown | Unsupported; no Grove role-loading claim is made for cloud/web. |
| `codex-ide` | Unsupported | documentation-constraint | Unsupported until an IDE-specific load path is verified. |
| `codex-sdk` | Unsupported | unknown | Unsupported; no Grove role-loading claim is made for the SDK. |
<!-- grove-surface-matrix:end -->

The retained Codex spike record proves only the result it names. Release
support is earned per exact matrix row; evidence never flows between rows.

## Package boundaries

- `adapters/` contains generated host projections and thin host-specific
  loading adapters; `reference/` contains generated runtime references.
- `runtime/` contains only shipped lifecycle and gate-resolution machinery.
- `metadata/` contains package inventories, ownership records, the package
  allowlist, and the sole support authority, `metadata/surfaces.json`.
- `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` carry the same
  value as `VERSION`.
- `tooling/grove/build/`, `tooling/grove/release/`, and
  `tooling/grove/probes/` are repository tooling and are not packaged.
- `retired/review-bookkeeping/` preserves the dormant ADR-0027 machinery
  outside the production package.

For role definitions, dispatch behavior, and workflow semantics, read the
canonical charters rather than this packaging guide.
