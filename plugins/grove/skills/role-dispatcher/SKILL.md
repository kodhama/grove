---
name: role-dispatcher
description: "One-shot dispatch advisor for a bounded workflow classification or next-dispatch recommendation; the full dispatcher remains in the driving session."
---
<!-- GENERATED — DO NOT EDIT; canonical-source: charters/dispatcher.md; sha256: 9961fd1792f3b21343aec90ade15335bd4c4f681c83fbf99410bddef0850ceef -->

Canonical source: `charters/dispatcher.md`
Canonical digest: `9961fd1792f3b21343aec90ade15335bd4c4f681c83fbf99410bddef0850ceef`
Exposure: `driving-session, scoped-advisor`

Select the exposure from the invoking context:

- When the launcher developer instruction contains the exact selector `Grove exposure selector: scoped-advisor`, read [the scoped canonical dispatcher projection](../../reference/charters/dispatcher.md#scoped-agent-boundary) from the `scoped-agent-boundary` fragment. Apply only that fragment's one-shot advisor scope; do not enact the driving-session dispatcher.
- Otherwise, only when acting as the driving session, read [the full canonical dispatcher projection](../../reference/charters/dispatcher.md) and follow it as the complete dispatcher contract.
- If neither condition is true, stop and report the exposure mismatch rather than choosing a role silently.
