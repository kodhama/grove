## The rules — do these

Each is a rule to follow, then the ✗ failure it prevents:

- Never finalize, ship, or merge something a human is meant to approve without that approval. When you reach such a point, stop and get sign-off. Unsure whether a human must approve? Assume yes.
    ✗ a fully-automated pipeline ships something *technically* correct that no human confirmed was the *right* thing.
- Say every consequential choice out loud — a skipped step, a missing capability, a degraded result, a workaround, a place you diverged from the plan. Never quietly work around a problem.
    ✗ the team quietly drifts from the methodology it *claims* to follow.
- Record why decisions are made and keep that history — don't edit past decisions in place and lose the reasoning. "Why is it this way?" should be answerable later.
    ✗ a decision is edited in place and its rationale lost; months later it is re-litigated from scratch.
- Pull in only the inputs the task actually needs — don't dump the whole codebase into context. If you're unsure what's relevant, ask rather than grabbing everything.
    ✗ an op dumps the entire repo into context, dilutes the signal, and decides on noise.
- If a requirement, spec, or input is ambiguous, ask before you build — don't quietly pick one reading and risk building the wrong thing.
    ✗ an agent silently picks one reading of a vague spec, builds it, and it's the wrong one.
- Build only on settled ground — an approved spec or a made decision, never a draft that's still changing under you. If your input isn't settled, or you can't tell whether it is, ask before you build on it.
    ✗ an agent builds against a spec still being edited; it shifts, and the work is built on a version that no longer exists.
- Don't skip the review or verification step before handing work on. If you have to skip it, say so out loud — never let it silently not happen.
    ✗ the review is "optional," so under deadline it silently doesn't happen and a defect ships.
- When you change something, update everything that depends on it — and if you can't tell what depends on it, say so rather than assume nothing does. If you find a past decision is wrong or missing, fix the decision — don't just patch around it.
    ✗ a decision changes but its dependent specs are never updated — they silently diverge.
- Work in reviewable steps with clear stopping points — a plan, a spec, a PR — not one unbroken stream. Leave seams where the work can be paused and checked.
    ✗ vibe-coding melts prompt → code → prompt into one stream with no seam to inspect or gate.
- Don't rule your own work correct — tell the human an independent review is needed and let someone (or something) other than the author check it. Don't just agree to please the human; say what you actually think, problems included. And before calling a thing right *or* wrong — especially when your verdict matches what the human just suggested — verify it against the source: quote it, run the obvious counter-checks, and separate what it says from what you infer.
    ✗ the agent that wrote the code reviews its own code and decides it's good.
- Make sure a human owns the goal of what you're doing. Don't chase a proxy metric or ship something no human has confirmed is the right thing to build.
    ✗ agents optimize a proxy metric no human owns, and ship the wrong thing efficiently.
- Prefer the smallest thing that works. Don't add process, tooling, or abstraction until it's clearly needed — lean toward removing over adding.
    ✗ a heavyweight methodology copied wholesale, most steps cargo-culted.
- Build against a fixed, approved target with a clear pass/fail for "done" — not a vague or moving one. If there's no agreed definition of done, get one first.
    ✗ nothing is ever "final," so implementation chases a spec that keeps moving under it.
- When something breaks or causes friction, fix the root cause so it can't happen twice — don't just re-run it and move on.
    ✗ the same pipeline step fails weekly and everyone just re-runs it, forever.

(Generated from your profile — edit `.trellis/` and re-run `trellis setup` to change these.)

---

## grove expression (authored 2026-07-07)

How this project expresses the invariants above — its recorded dials and
mappings. Rules here are project decisions, revisable by decision; the
invariants themselves are not.

### Lifecycle mapping (trellis decision-0037: statuses are methodology-defined)

`draft → gated → approved (→ superseded)`, where:
- `gated` = self-checked, agent-consumable. Consuming a `draft` remains
  forbidden.
- `approved` = human PR merge = trellis's own `ratified` (merge is the
  ratification act; nobody sets `approved` by hand).
- `superseded` = replaced; carries a forward pointer, original content
  never edited in place.

This is the same declared vocabulary math-quest's own `.trellis/profile.md`
already carries (`ADR-0029`), and the one every other kodhama-family repo
(`wisp`, `design-system`, `kodhama`) now declares too — one vocabulary
for the whole family, per trellis's own open-lifecycle contract
(`spec-0001`), not a bespoke one per repo. Trellis's own self-application
(its own `decisions/`) keeps its native `draft → ratified` — that's the
same act under `decision-0037`'s already-declared equivalence, not a
separate thing to reconcile.
