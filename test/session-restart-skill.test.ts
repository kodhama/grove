/**
 * MQ-359 (plan U6b) — the session-restart skill's own text, for the parts a
 * script cannot drive. Split from test/session-restart.test.ts, which holds
 * the scripts' scenarios against a stub herdr, to keep each file under the
 * test size cap.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SCRIPTS = join(__dirname, "..", "skills/session-restart/scripts");

/**
 * The parts of the restart that run inside the session's own turns, through
 * MCP tools and the model, are instructions a script cannot drive. The skill
 * text is checked for them here; the live AE4 and AE6 runs prove them
 * (MQ-359, lead's call, 2026-09-29).
 */
describe("SKILL.md — what only the session can do (MQ-359, U6b)", () => {
  // Whitespace collapsed, so a check does not depend on where a line wraps.
  const skill = readFileSync(join(SCRIPTS, "..", "SKILL.md"), "utf8").replace(/[ \n]+/g, " ");
  const section = (heading: string) => {
    const start = skill.indexOf(`## ${heading}`);
    expect(start, heading).toBeGreaterThan(-1);
    const next = skill.indexOf(" ## ", start + 3);
    return skill.slice(start, next === -1 ? undefined : next);
  };

  it("starts the helper only through the launcher, never by hand", () => {
    expect(skill).toMatch(/start-restart\.sh --bindings/);
    expect(skill).not.toMatch(/nohup/);
  });

  it("the handoff runs the receipt check with node from supervision-setup's folder, not a repo's npm script", () => {
    const receipt = section("Receipt check");
    expect(receipt).toMatch(
      /`node <supervision-setup's folder>\/scripts\/receipt-check\.mjs --bindings <the bindings file>`/,
    );
    expect(skill).not.toMatch(/npm run/);
  });

  it("after the clear, reruns setup seeded with the handoff before any task work (R22)", () => {
    expect(section("After the clear")).toMatch(/supervision-setup`, seeded with the handoff/);
  });

  it("the outgoing session does not end until successor-up appears, and tells the maintainer when it does not", () => {
    const outgoing = section("New session: the outgoing session");
    expect(outgoing).toMatch(/Wait for `successor-up`/);
    expect(outgoing).toMatch(/If it does not appear in time, tell the maintainer and stay up/);
    expect(outgoing).toMatch(/Once it appears, start no more timers and end your last turn/);
  });

  it("the successor posts successor-up and announces its actual name and ref (R32, AE4)", () => {
    const successor = section("New session: the successor");
    expect(successor).toMatch(/Post `successor-up/);
    expect(successor).toMatch(/actual name and your ref/);
  });

  it("the successor takes the herdr name only once the outgoing session has exited (AE4)", () => {
    // Live AE4, 2026-09-29: `herdr agent start <name>` refused the name with
    // agent_name_taken while the outgoing session held it, and
    // `herdr agent rename` gave it to the successor once that session exited.
    const outgoing = section("New session: the outgoing session");
    expect(outgoing).not.toMatch(/herdr agent start <name> /);
    // KTD9: herdr names are [a-z][a-z0-9_-]{0,31}, so a suffix must fit in 32.
    expect(outgoing).toMatch(/temporary herdr name/);
    expect(outgoing).toMatch(/first 30\s+characters/);
    expect(outgoing).not.toMatch(/<name>-next/);
    expect(section("New session: the successor")).toMatch(
      /herdr agent rename "\$HERDR_PANE_ID" <the handoff's herdr name>/,
    );
  });

  it("the successor rechecks its bindings before it posts successor-up through one (PR #823 review)", () => {
    const successor = section("New session: the successor");
    const setup = successor.indexOf("Run `supervision-setup`, seeded with the handoff");
    expect(setup).toBeGreaterThan(-1);
    expect(setup).toBeLessThan(successor.indexOf("Post `successor-up"));
  });

  it("a successor that cannot reach the outgoing pane asks the maintainer to close it (R35, PR #823 review)", () => {
    expect(section("New session: the successor")).toMatch(
      /`type-into-pane` is\s+unbound or cannot reach that pane[\s\S]*ask the\s+maintainer to close it/,
    );
  });

  it("the successor closes the outgoing session only through close-outgoing.sh, the helper's own checks (PR #823 review)", () => {
    const successor = section("New session: the successor");
    expect(successor).toMatch(/scripts\/close-outgoing\.sh/);
    expect(successor).toMatch(/`not sent: …`[\s\S]*tell the maintainer/);
    expect(successor).not.toMatch(/type `\/exit`\s+into it through/);
  });

  it("the outgoing session's wait for successor-up has a wake source and a bound (#823 review)", () => {
    const outgoing = section("New session: the outgoing session");
    expect(outgoing).toMatch(/background timer/);
    expect(outgoing).toMatch(/30 minutes/);
    expect(outgoing).toMatch(/start no more timers/);
  });

  it("marks the new-session steps as Claude Code only, a Codex session's identity reading unknown (#823 review)", () => {
    for (const heading of ["New session: the outgoing session", "New session: the successor"])
      expect(section(heading), heading).toMatch(/Claude Code only[\s\S]*MQ-366/);
  });

  it("the handoff records the herdr name the successor takes (KTD10, #823 review)", () => {
    expect(skill).toMatch(/- herdr name: <value> \(`herdr agent get \$HERDR_PANE_ID`\)/);
    expect(section("New session: the successor")).toMatch(/<the handoff's herdr name>/);
  });

  it("the handoff carries the filled table inline, with the header a remote successor's setup needs (KTD10)", () => {
    // The template holds headings of its own, so it runs to the next section.
    const template = skill.slice(
      skill.indexOf("## Handoff template"),
      skill.indexOf("## After the clear"),
    );
    expect(template).toMatch(/## Routing table/);
    expect(template).toMatch(/- harness: /);
    expect(template).toMatch(/- transcripts: /);
  });
});
