## Naming register

An instance of one of grove's chartered roles is officially a **grove
agent** (or just **agent** where grove is already the surrounding
context — inside this repo, for instance). **Druid** is real, sanctioned
vocabulary — welcome and encouraged in conversation, casual explanation,
and marketing copy — but it is never the operative or defining term.

Rule of thumb: **if you're explaining, druid is fine; if you're
defining, write agent.**

- ✅ Chat, explaining casually: *"grove's twelve druids each tend one
  stage of the pipeline."*
- ✅ LP/marketing, as a passing aside: *"twelve agents — or, as we like
  to call them, druids — tending the grove."*
- ❌ A charter or decision defining what the role *is*: write *"a grove
  agent is a stateless cold-started role…"*, never *"a druid is…"*
- ❌ Anywhere machine-read or identity-bearing — file names,
  frontmatter, CLI flags — always the specific role name (`executor`,
  `dispatcher`, …) or `agent`, never `druid`.

Same register split applies to `dispatcher` (official) vs. `archdruid`
(conversational/marketing only). See `decisions/adr-0002-agent-vocabulary.md`
for the full rationale.

<!-- trellis:begin (managed by trellis — edit .trellis/, not this block) -->
This project follows **Trellis** — working rules you are expected to follow while you work here. They are imported below:
@.trellis/trellis.md
<!-- trellis:end -->
