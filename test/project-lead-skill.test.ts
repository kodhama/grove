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

  it("names each input of the rerun from what the receipt carries, and leaves --pr-body out", () => {
    const text = item();
    expect(text).toContain("`--bindings` from its Bindings field");
    expect(text).toContain("`--since` from its Started time where it has one");
    expect(text).toContain(
      "a `--not-run` for each operation its pasted check shows as `not reached (declared by caller)`, which must match its Not run list",
    );
    expect(text).not.toContain("a `--not-run` for each entry in its Not run list");
    expect(text).toContain("`--handoff` where its pasted check shows one");
    expect(text).toContain("no `--pr-body`, since item 1 reads the body");
  });

  it("sends back an Exception the lead cannot rerun: not run only where it did not apply, else blocked or a DECISION to the maintainer", () => {
    const text = item();
    expect(text).toContain(
      "An Exception you cannot rerun, such as a cloud worker's, whose bindings file or transcripts your machine cannot read, goes back, for the worker to run the operation where the check can read it.",
    );
    expect(text).toContain(
      "The worker declares the operation not run in the receipt's Not run list only where it did not apply to this story",
    );
    expect(text).toContain(
      "otherwise it hands back blocked or raises a `DECISION`, and you put the Exception and its evidence to the maintainer.",
    );
    expect(text).not.toContain("can always");
    expect(text).not.toContain("never loops");
  });

  it("a not-run declared for an operation that applied is no route around this item", () => {
    expect(item()).toContain(
      "a not-run declared for an operation that applied is no way around this item",
    );
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
    expect(item()).toContain("An Exception you or the maintainer accepted goes in your merge request (item 7).");
    const text = handBack();
    const merge = text.slice(text.indexOf("7. **Ask the maintainer to merge**"), text.indexOf("8. **Merge only on their approval**"));
    expect(merge).toContain("how the acceptance is met");
    expect(merge).toContain("naming any Exception you or the maintainer accepted by its line, its reason and its evidence");
  });

  it("the Never list lets the lead read a worker's bindings only to rerun its receipt check", () => {
    expect(section("Never")).toContain(
      "The one use you make of them is rerunning a worker's receipt check for an Exception (step 7, item 2).",
    );
  });

  it("the Never list's carve-out is the receipt-check command only, read-only, and a gap goes back to the worker", () => {
    const never = section("Never");
    expect(never).toContain("That command is the only one you run on them, and it only reads.");
    expect(never).toContain(
      "Any gap the rerun shows, other than the one line an accepted Exception pastes, goes back to the worker: you never fix or rebind it.",
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
    expect(field).toContain(
      "Only an operation's line can be excepted: a table or override line means you rerun setup and then the check, and a body line means you fix the body and rerun the check",
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

/**
 * GRO-83 — a sent-back worker's re-hand-back that declares an applied operation
 * not run gets no green route. Story-worker declares `--not-run` only for an
 * operation that did not apply; a failing line stays a failing line on a
 * re-hand-back; and the lead compares the two receipts' Not run lists. Also the
 * lead's item 2 and item 7 wording (F1, F2, F3, P3s) and item 3's carve-out for
 * a story built from a plan unit written before its Started time.
 */
describe("GRO-83 · the not-run route on a re-hand-back", () => {
  const flat = (text: string) => text.replace(/\s+/g, " ");
  const lead = flat(readFileSync(SKILL, "utf8"));
  const worker = flat(readFileSync(join(__dirname, "..", "skills/story-worker/SKILL.md"), "utf8"));
  const sectionOf = (text: string, heading: string) => {
    const start = text.indexOf(`## ${heading} `);
    expect(start, heading).toBeGreaterThan(-1);
    const next = text.indexOf(" ## ", start + 3);
    return text.slice(start, next === -1 ? undefined : next);
  };
  const between = (text: string, from: string, to: string) => {
    const start = text.indexOf(from);
    const end = text.indexOf(to, start + 1);
    return start < 0 || end < start ? "" : text.slice(start, end);
  };
  const handBack = () => sectionOf(lead, "7. A hand-back");
  const item2 = () => between(handBack(), "2. **Check an Exception yourself.**", "3. **Accept on the evidence.**");
  const item3 = () => between(handBack(), "3. **Accept on the evidence.**", "4. **Review it again, from fresh context.**");
  const item7 = () => between(handBack(), "7. **Ask the maintainer to merge**", "8. **Merge only on their approval**");
  const step3 = () => sectionOf(worker, "3. Plan");
  const step8 = () => sectionOf(worker, "8. Hand back");
  const comesBack = () => sectionOf(worker, "A hand-back that comes back");

  it("F4: story-worker declares --not-run only for an operation that did not apply", () => {
    expect(step8()).toContain(
      "Add `--not-run <table/op>,...` for each operation that did not apply to this story, the receipt's Not run list, and for `story-worker/post-work-note` and `story-worker/hand-back` when their first use is the hand-back still to come.",
    );
    expect(worker).not.toContain("for each operation this story did not run");
  });

  it("F4: an applied operation is never declared not run; its line is the Exception, and more failing lines are not ready", () => {
    expect(step8()).toContain(
      "An operation that applied and did not run, or that ran where the check cannot read it, is never declared not run: its failing line goes in the receipt's `Exception:` field, and where the check then fails on more than one line, the story is not ready: hand back blocked or raise a `DECISION`.",
    );
  });

  it("F4: a re-hand-back passes the earlier Not run list again only for operations that did not apply, and a failing line stays failing", () => {
    expect(comesBack()).toContain(
      "Pass the earlier receipt's Not run list as `--not-run` again only for operations that did not apply to this story. A line that failed in the earlier check stays a failing line unless that operation now runs where the check reads it.",
    );
  });

  it("F4: the lead compares a returned hand-back's Not run list with the earlier receipt's", () => {
    expect(item2()).toContain(
      "On a hand-back that comes back, compare its Not run list with the earlier receipt's: an operation that moved from a failing line to Not run goes back to the worker, unless it did not apply to this story.",
    );
  });

  it("F1: an Exception the lead cannot rerun goes back for the worker to run the operation where the check can read it", () => {
    expect(item2()).toContain(
      "An Exception you cannot rerun, such as a cloud worker's, whose bindings file or transcripts your machine cannot read, goes back, for the worker to run the operation where the check can read it.",
    );
  });

  it("F2: the lead follows the maintainer's ruling, and items 2 and 7 name an Exception either of them accepted", () => {
    expect(item2()).toContain("Once the maintainer rules on an Exception put to them, follow that ruling.");
    expect(item2()).toContain("An Exception you or the maintainer accepted goes in your merge request (item 7).");
    expect(item7()).toContain("naming any Exception you or the maintainer accepted");
    expect(handBack()).not.toContain("An Exception you accept goes");
  });

  it("F3: judging the reason comes before the escalation to the maintainer", () => {
    const text = item2();
    const judge = text.indexOf("Then judge the reason it gives");
    const maintainer = text.indexOf("you put the Exception and its evidence to the maintainer");
    expect(judge).toBeGreaterThan(-1);
    expect(maintainer).toBeGreaterThan(judge);
  });

  it("P3: the rerun's --since is conditional, and its --not-run list comes from the pasted check's declared lines", () => {
    const text = item2();
    expect(text).toContain("`--since` from its Started time where it has one");
    expect(text).toContain(
      "a `--not-run` for each operation its pasted check shows as `not reached (declared by caller)`, which must match its Not run list but for `post-work-note` and `hand-back` declared before their first use",
    );
  });

  it("P3: the Never list's send-back does not cover the one excepted line", () => {
    expect(sectionOf(lead, "Never")).toContain(
      "Any gap the rerun shows, other than the one line an accepted Exception pastes, goes back to the worker",
    );
  });

  it("item 3: a story built from a plan unit written before its Started time lists `plan` as not run, in both skills", () => {
    expect(step3()).toContain(
      "or when it was built from a plan unit written before its Started time, whose `Plan:` line names that unit by a path that resolves.",
    );
    expect(item3()).toContain(
      "One built from a plan unit written before its Started time lists `plan` under Not run, and its `Plan:` line names that unit by a path that resolves: its `plan` under Not run sends it back only when that line is missing or does not resolve.",
    );
    // The rest of item 3 holds: no other story that is not a defect lists `plan` as not run, and an unused planner goes back.
    expect(item3()).toContain("So does one that lists `plan` as not run for any other story that is not a defect");
    expect(item3()).toContain("shows `plan` as `bound-but-unused` for a story that is not a defect: a planner was bound and never called.");
  });
});
