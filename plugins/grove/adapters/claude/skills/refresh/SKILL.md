---
name: refresh
description: "Refresh Grove-managed consumer files and only the invoking host's adapter through the shared lifecycle core. Use when the user asks to refresh, update, upgrade, or roll out Grove in an existing repository."
---
<!-- GENERATED — DO NOT EDIT; canonical-source: plugins/grove/runtime/lifecycle/lib/lifecycle.mjs; sha256: 38f7a42f481a09802d4a4e3e610afcb2a51eeff805ecb11e3a55f0751c268c41 -->

# Grove refresh adapter

This is a read-through entrypoint, not a lifecycle authority. Resolve the
active installed Grove plugin root as the directory four levels above this file, then run:

```text
node <grove-plugin-root>/runtime/lifecycle/bin/grove-operation.mjs describe refresh
```

Follow that emitted contract exactly. Do not infer, recreate, or extend refresh
semantics from this adapter.
