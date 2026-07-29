---
name: setup
description: "Compose Grove's shared consumer floor and the invoking host's bounded adapter through the shared lifecycle core. Use when the user asks to set up, add, install, or compose Grove in a repository."
---
<!-- GENERATED — DO NOT EDIT; canonical-source: plugins/grove/runtime/lifecycle/lib/lifecycle.mjs; sha256: 5b9ef5b9be0635d6a9d023e90dd5ba0fd50a1b90d8aa522acecdec02d2b6cbb0 -->

# Grove setup adapter

This is a read-through entrypoint, not a lifecycle authority. Resolve the
active installed Grove plugin root as the directory four levels above this file, then run:

```text
node <grove-plugin-root>/runtime/lifecycle/bin/grove-operation.mjs describe setup
```

Follow that emitted contract exactly. Do not infer, recreate, or extend setup
semantics from this adapter.
