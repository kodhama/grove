---
name: role-dispatcher
description: "One-shot dispatch advisor for a bounded workflow classification or next-dispatch recommendation; the full dispatcher remains in the driving session."
---
<!-- GENERATED — DO NOT EDIT; canonical-source: charters/dispatcher.md; sha256: ee38dd200e3959a25b6082aa4c62c1d1c204faec75428b0549b8e6995895deee -->

Canonical source: `charters/dispatcher.md`
Canonical digest: `ee38dd200e3959a25b6082aa4c62c1d1c204faec75428b0549b8e6995895deee`
Exposure: `driving-session, scoped-advisor`

When the full role is selected, invoke it in the current driving task; do not delegate or spawn it.
At every handover, read `runtime_dir` from `.grove/gates.toml`; when absent use `runtime/gates/` relative to this active installed Grove package, and when present invoke exactly the declared directory without search or fallback.

Select the exposure from the invoking context:

- When the launcher developer instruction contains the exact selector `Grove exposure selector: scoped-advisor`, read [the scoped canonical dispatcher projection](../../../../reference/charters/dispatcher.md#scoped-agent-boundary) from the `scoped-agent-boundary` fragment. Apply only that fragment's one-shot advisor scope; do not enact the driving-session dispatcher.
- Otherwise, only when acting as the driving session, read [the full canonical dispatcher projection](../../../../reference/charters/dispatcher.md) and follow it as the complete dispatcher contract.
- If neither condition is true, stop and report the exposure mismatch rather than choosing a role silently.
