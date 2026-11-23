/**
 * GRO-80 — the project-lead skill's own text: what a lead does with a
 * receipt's `Exception:` line. The worker may hand back ready on a receipt
 * check that fails on exactly one operation's line, which the Exception pastes
 * and explains; this pins the lead's rule for it. What the check itself prints
 * is pinned in test/supervision-receipt-check.test.ts ("GRO-80 · what the
 * lead's rerun can show").
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SKILL = join(__dirname, "..", "skills/project-lead/SKILL.md");

describe("SKILL.md — a receipt's Exception at a ready hand-back (GRO-80)", () => {
  // Whitespace collapsed, so a check does not depend on where a line wraps.
  const skill = readFileSync(SKILL, "utf8").replace(/\s+/g, " ");
  const section = (heading: string) => {
    const start = skill.indexOf(`## ${heading}`);
    expect(start, heading).toBeGreaterThan(-1);
    const next = skill.indexOf(" ## ", start + 3);
    return skill.slice(start, next === -1 ? undefined : next);
  };
  const handBack = () => section("7. A hand-back");
  const CLAIMS = "1. **Check the claims.**";
  const EXCEPTION = "2. **Check an Exception yourself.**";
  const ACCEPT = "3. **Accept on the evidence.**";
  /** The new item, from its number up to the next item's. */
  const item = () => {
    const text = handBack();
    const start = text.indexOf(EXCEPTION);
    const end = text.indexOf(ACCEPT);
    return start < 0 || end < start ? "" : text.slice(start, end);
  };

  it("sits right after Check the claims and before Accept on the evidence", () => {
    const text = handBack();
    const claims = text.indexOf(CLAIMS);
    const exception = text.indexOf(EXCEPTION);
    expect(claims).toBeGreaterThan(-1);
    expect(exception).toBeGreaterThan(claims);
    expect(text.indexOf(ACCEPT)).toBeGreaterThan(exception);
  });

  it("reruns the check itself when the Exception is not none, and needs exactly the pasted operation's line to fail", () => {
    const text = item();
    expect(text).toContain("Where the receipt's `Exception:` field is not \"none\", rerun the receipt check");
    expect(text).toContain("It must fail on exactly one line, the one the Exception pastes, word for word");
    expect(text).toContain("an operation's line, never a table, override or body line");
  });

  it("sends back any other result: two lines or more, a table, override or body line, or a line that differs", () => {
    expect(item()).toContain(
      "Any other result goes back to the worker: two failing lines or more, a table, override or body line, or a failing line that differs from the one pasted.",
    );
  });

  it("accepts the stated reason only on evidence the check cannot see", () => {
    const text = item();
    expect(text).toContain("accept it only on evidence the check cannot see");
    expect(text).toContain("the operation did not apply to this story");
    expect(text).toContain(
      "it ran where the check cannot read, such as a reviewer run as its own command-line process, shown by the session file it wrote",
    );
    expect(text).toContain("Otherwise it goes back.");
  });

  it("never accepts an Exception on a review operation unless that review's read names the final head", () => {
    expect(item()).toContain(
      "Never accept an Exception on a review operation, `review` or `doc-review`, unless the read that review recorded names the pull request's final head.",
    );
  });

  it("names an accepted Exception in the merge request, in the item that asks for the merge", () => {
    expect(item()).toContain("An Exception you accept goes in your merge request (item 7).");
    const text = handBack();
    const merge = text.slice(text.indexOf("7. **Ask the maintainer to merge**"), text.indexOf("8. **Merge only on their approval**"));
    expect(merge).toContain("how the acceptance is met");
    expect(merge).toContain("naming any Exception you accepted by its line, its reason and its evidence");
  });

  it("the Never list lets the lead read a worker's bindings only to rerun its receipt check", () => {
    expect(section("Never")).toContain(
      "The one use you make of them is rerunning a worker's receipt check for an Exception (step 7, item 2).",
    );
  });

  it("the receipt's Exception field asks for what the lead accepts on", () => {
    const receipt = readFileSync(join(__dirname, "..", "skills/story-worker/references/receipt.md"), "utf8");
    const field = (receipt.match(/^Exception:.*(?:\n[ \t]+.*)*/m)?.[0] ?? "").replace(/\s+/g, " ");
    expect(field).toContain("with the evidence the check cannot see");
    expect(field).toContain("such as the session file a reviewer run as its own command-line process wrote");
    expect(field).toContain(
      "A review operation's line is accepted only where the read that review recorded names the pull request's final head",
    );
  });

  it("every cross-reference to a hand-back item follows the renumbering", () => {
    expect(skill).toContain("goes to triage (step 7, item 5)");
    expect(skill).toContain("that head goes through items 1 to 5 again");
    expect(skill).toContain("read items 1 to 3 through");
    expect(skill).toContain("item 3 then reads `plan` in that earlier check");
    expect(skill).not.toMatch(/step 7, item 4\b|items 1 to 4\b|read items 1 and 2\b|item 2 then reads/);
  });
});
