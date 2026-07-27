---
name: set-profile
description: "Plan and explicitly apply a named Grove gate preset through the shared lifecycle core. Use when the user asks to switch, set, or reset their Grove gate profile."
---
<!-- GENERATED — DO NOT EDIT; canonical-source: plugins/grove/runtime/lifecycle/lib/lifecycle.mjs; sha256: 354991fbcb2436a242a871a14ae1b86625608f7e4181f75c65584307ac295380 -->

# Grove set-profile adapter

This is a read-through entrypoint, not a lifecycle authority. Resolve the
active installed Grove plugin root as the directory four levels above this file, then run:

```text
node <grove-plugin-root>/runtime/lifecycle/bin/grove-operation.mjs describe set-profile
```

Follow that emitted contract exactly. Do not infer, recreate, or extend set-profile
semantics from this adapter.
