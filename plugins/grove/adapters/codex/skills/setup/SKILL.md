---
name: setup
description: "Compose Grove's shared consumer floor and the invoking host's bounded adapter through the shared lifecycle core. Use when the user asks to set up, add, install, or compose Grove in a repository."
---
<!-- GENERATED — DO NOT EDIT; canonical-source: plugins/grove/runtime/lifecycle/lib/lifecycle.mjs; sha256: 354991fbcb2436a242a871a14ae1b86625608f7e4181f75c65584307ac295380 -->

# Grove setup adapter

This is a read-through entrypoint, not a lifecycle authority. Resolve the
active installed Grove plugin root as the directory four levels above this file, then run:

```text
node <grove-plugin-root>/runtime/lifecycle/bin/grove-operation.mjs describe setup
```

Follow that emitted contract exactly. Do not infer, recreate, or extend setup
semantics from this adapter.
