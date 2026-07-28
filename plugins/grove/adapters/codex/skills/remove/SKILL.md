---
name: remove
description: "Inventory and explicitly remove only selected Grove-owned consumer surfaces through the shared lifecycle core. Use when the user asks to remove, uninstall, undo, or take Grove out of a repository."
---
<!-- GENERATED — DO NOT EDIT; canonical-source: plugins/grove/runtime/lifecycle/lib/lifecycle.mjs; sha256: 5f90f79c76d221019e41b8677c587d2889147678e62267dc4c630ccea99a8bb9 -->

# Grove remove adapter

This is a read-through entrypoint, not a lifecycle authority. Resolve the
active installed Grove plugin root as the directory four levels above this file, then run:

```text
node <grove-plugin-root>/runtime/lifecycle/bin/grove-operation.mjs describe remove
```

Follow that emitted contract exactly. Do not infer, recreate, or extend remove
semantics from this adapter.
