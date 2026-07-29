---
name: remove
description: "Inventory and explicitly remove only selected Grove-owned consumer surfaces through the shared lifecycle core. Use when the user asks to remove, uninstall, undo, or take Grove out of a repository."
---
<!-- GENERATED — DO NOT EDIT; canonical-source: plugins/grove/runtime/lifecycle/lib/lifecycle.mjs; sha256: 581b768be35b2babbda910dc4c2c14a74f5775e38e62a1ca832e1d09df6dd891 -->

# Grove remove adapter

This is a read-through entrypoint, not a lifecycle authority. Resolve the
active installed Grove plugin root as the directory four levels above this file, then run:

```text
node <grove-plugin-root>/runtime/lifecycle/bin/grove-operation.mjs describe remove
```

Follow that emitted contract exactly. Do not infer, recreate, or extend remove
semantics from this adapter.
