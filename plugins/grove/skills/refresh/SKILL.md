---
name: refresh
description: "Refresh Grove-managed consumer files and only the invoking host's adapter through the shared lifecycle core. Use when the user asks to refresh, update, upgrade, or roll out Grove in an existing repository."
---
<!-- GENERATED — DO NOT EDIT; canonical-source: plugins/grove/operations/lib/lifecycle.mjs; sha256: f22dc542e998394d9acb76d5d5a224f6294e3104cc38f3f1fde030dc413fc50b -->

# Grove refresh adapter

This is a read-through entrypoint, not a lifecycle authority. Resolve the
Grove plugin root as the directory two levels above this file, then run:

```text
node <grove-plugin-root>/operations/bin/grove-operation.mjs describe refresh
```

Follow that emitted contract exactly. Do not infer, recreate, or extend refresh
semantics from this adapter.
