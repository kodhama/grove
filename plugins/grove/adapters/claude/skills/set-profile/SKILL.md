---
name: set-profile
description: "Plan and explicitly apply a named Grove gate preset through the shared lifecycle core. Use when the user asks to switch, set, or reset their Grove gate profile."
---
<!-- GENERATED — DO NOT EDIT; canonical-source: plugins/grove/runtime/lifecycle/lib/lifecycle.mjs; sha256: 38f7a42f481a09802d4a4e3e610afcb2a51eeff805ecb11e3a55f0751c268c41 -->

# Grove set-profile adapter

This is a read-through entrypoint, not a lifecycle authority. Resolve the
active installed Grove plugin root as the directory four levels above this file, then run:

```text
node <grove-plugin-root>/runtime/lifecycle/bin/grove-operation.mjs describe set-profile
```

Follow that emitted contract exactly. Do not infer, recreate, or extend set-profile
semantics from this adapter.
