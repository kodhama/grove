---
name: set-profile
description: Switch the grove gate-profile to a named preset — steward, guardian, or initiator — by re-expanding its rows into .grove/gates.toml wholesale, showing the diff and confirming before writing, then re-running the floor validator. Use when the user asks to change, switch, set, or reset which gates they own (their gate-profile / oversight level).
---

# Switch the gate-profile to a preset

The gate-profile (`adr-0018`) assigns **C2** — who is *required* at each of
grove's four gates (`intent` / `spec` / `build` / `ship`), `human` or `agent` —
and lives at the consumer-authoritative **`.grove/gates.toml`**. This skill
performs a **wholesale switch** to a named preset (`adr-0018` D7): it
**replaces** the current four rows (including any hand-edits) with the preset's,
updates the `seeded_from` provenance marker, and re-runs the floor validator.
It **never writes silently** — it shows the effective diff and confirms first.

*(C1 — enforcement strength — is grove-fixed and NOT touched here; it lives in
`.grove/internal/enforcement.toml`, `adr-0018` D4. This skill owns `gates.toml`
wholesale, `adr-0018` D9.)*

## 0. Input

- One preset name: **`steward`**, **`guardian`**, or **`initiator`**. If the
  user didn't name one, ask which — and offer the one-liners in step 2. Any
  other name is an error: say so and stop (never guess a preset).

## 1. Preconditions

- This skill edits `.grove/gates.toml`. If `.grove/` doesn't exist, grove isn't
  composed here — point the user to `/grove:setup` and stop.
- If `.grove/gates.toml` is **absent**, this is a first write rather than a
  switch — say so, then proceed (you'll create it from the preset in step 4).

## 2. The three presets (their C2 rows)

| Preset | intent | spec | build | ship | one-liner |
|---|---|---|---|---|---|
| **steward** *(default)* | human | agent | agent | human | you approve direction + final result; agents handle spec and build |
| **guardian** | human | human | agent | human | you also approve the spec before build |
| **initiator** | agent | agent | agent | human | you kick off intent and approve only the final result |

**The floor** (`adr-0018`, `floor-intent-gate`): every preset keeps at least one
human-owned intent-locus gate — `intent = human` **or** `ship = human`. All
three presets satisfy it (steward/guardian at `intent`, initiator at `ship`), so
a clean switch to any of them is floor-safe by construction.

## 3. Show the diff and confirm — never silent

Read the current `.grove/gates.toml` `[gates]` rows (if the file exists). Show
the user the **effective change**, row by row — current value → preset value —
naming every row that changes and calling out that **any hand-edited rows will
be replaced** (this is a wholesale switch, not a merge). Then **ask for explicit
confirmation** before writing. On anything other than a clear yes, stop and
write nothing.

## 4. Write the new profile

On confirmation, write `.grove/gates.toml` with:

- `seeded_from = "<preset>"` — updated to the newly applied preset;
- the four `[gates]` rows set to the preset's C2 values from the table above;
- the `[trigger]` and `[intent_external]` sections **preserved** from the
  existing file if present (they are not part of a preset; a switch changes only
  the four C2 rows and `seeded_from`). If the file didn't exist, seed those two
  sections from the vendored template
  `${CLAUDE_PLUGIN_ROOT}/reference/gates/gates.toml`.

## 5. Re-run the floor validator — the load-time guard

Validate the file you just wrote with the bundled guard (`adr-0018` D8), so a
mistake is caught immediately and identically to how a run-sequencing read would
catch it:

```sh
node .grove/internal/gates/bin/resolve-profile.mjs .grove/gates.toml
```

- **Exit 0** — the profile is clean and satisfies the floor. Done.
- **Exit 2** — the guard fell back to `guardian` with a loud warning (printed to
  stderr). A clean preset switch should never trigger this; if it does, the file
  was written wrong or hand-corrupted — surface the warning verbatim, do **not**
  leave a floor-violating file in place, and restore/rewrite it.

If the machinery isn't installed at `.grove/internal/gates/` (an older or
partial install), say so and validate by hand against the floor rule in step 2
rather than skipping the check silently.

## 6. Confirm

Tell the user exactly what changed: the preset now in effect, each row's new
value, that `seeded_from` was updated, and that the floor validator passed
(exit 0). Note they can hand-tune a single row directly in `.grove/gates.toml`
afterward — the rows are the source of truth; `seeded_from` is provenance only.
