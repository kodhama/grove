---
name: remove
description: "Inventory and explicitly remove only selected Grove-owned consumer surfaces through the shared lifecycle core. Use when the user asks to remove, uninstall, undo, or take Grove out of a repository."
---
<!-- GENERATED — DO NOT EDIT; canonical-source: plugins/grove/operations/lib/lifecycle.mjs; sha256: f22dc542e998394d9acb76d5d5a224f6294e3104cc38f3f1fde030dc413fc50b -->

# Grove remove adapter

This is a read-through entrypoint, not a lifecycle authority. Resolve the
Grove plugin root as the directory two levels above this file, then run:

```text
node <grove-plugin-root>/operations/bin/grove-operation.mjs describe remove
```

Follow that emitted contract exactly. Do not infer, recreate, or extend remove
semantics from this adapter.
