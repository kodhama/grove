# The story receipt

One page per story, filled from observed values and posted as the hand-back's
work note. Every field that records something observed has a slot saying how
it was observed, and a fallback for when it could not be: `unverified`, or
"not reported by harness". **Never cut an "observed how" slot or its fallback
to shorten the receipt.** Without the slot, the field becomes a guess the
receipt allows.

The maintainer reads it too, as a comment on the work item, so it opens with
one point-first line, written to the reader rule in the repo's project
instructions where they set one. The fields below it are the depth that line
points into.

```text
<the outcome, as Outcome below gives it, and what the maintainer must do, if anything — e.g. "PR ready for review; nothing for you yet: the lead accepts it, then asks you to merge">

Story:           <work item id and link>   Source: <plan, spec or unit, with its section; for a
                  defect, the work item itself>
Owner:           <session name, read from the live system>   Worktree: <path>   Branch: <name>
Started:         <date and time>   Base: <full SHA the branch was cut from>
Operating model: <own team | fully delegated to <runner>>

Model requested: <model + effort, as the lead asked, or "none requested">
Model actual:    <model + effort>
Observed how:    <harness-reported source: run log line, status output, session metadata —
                  never the launch flag, a manager's label, or the model's own say-so.
                  "unverified" where the harness exposes none; never a guess>

Usage reported:  <number + the field it came from, or "not reported by harness" — never a
                  guess or an invented zero; say where it is a client-side estimate>
Duration:        <wall clock, start → end>
Retries:         <count + what triggered each>
Interventions:   <every human touch: answered questions, nudges, restarts — 0 is a result>
Restarts:        <each one: time, in place or new session, handoff path — or "none">

Bindings:        <bindings file path>, complete at <its complete.at>; "the routing table changed
                  since the earlier setup" and when, if a setup said so
Rebound:         <operation: from → to, why, when — or "none">
By fallback:     <operation: suggested <names> unavailable, step run by fallback — or "none">
Not run:         <operation: why, e.g. "browser-test: no page touched" — or "none">
Decided myself:  <the calls you made without asking, one line each — or "none">

Evidence:        <PR link / head and base SHAs / diff stat>
Checks:          <each check as its command and result; any required check that did not run,
                  with the lead's decision that allowed it>
Acceptance:      <one file:line citation per acceptance condition; for a defect, the
                  regression test that failed before the fix, with the failure observed,
                  or, where the triage row's "How to verify" names a manual check only,
                  that check's steps and what was observed, and why no automated test
                  is possible>
Reviewed by:     <one entry per in-session review, before or after the pull request opened. The
                  reviewer: its performer, and the subagent you started for it or the reviewers
                  the performer started itself, saying which — always named, never blank, never
                  your own context — and whether it started fresh or as a fork of your context>
                 <its model, or "unverified" where the route carries no model receipt; the
                  reviewer is named either way, since only the model identity is in doubt>
                 <what it read: the commit, or each file's blob, it ran on, and its start and
                  end times>
                 <observed how: the call that started it, in your transcript, for performer
                  and context; the model the reviewer's own transcript records, or the run
                  log or status output where its route keeps one, for its model, and the
                  same for the commands that show what it read. A model the call asked for
                  is a request, not the model that ran. "unverified" for any part they do
                  not show — never your account or the reviewer's, never the launch flag>
PR round:        <what the automated reviewers raised, what you fixed, what went to the lead>
Shipped revision:<head SHA> — <for each changed file, grouping files that share a verdict:
                  covered in session by <reviewer> | covered by content only, by <reviewer>, a
                  fork: not independent | not covered in session, with the change and its
                  time> — <then reviewed by <automated reviewer> on this head | self-checked
                  against the findings only>
                 <observed how: each review's times and what it read, against every change
                  after it (an edit, a formatter or other command that rewrites files, a
                  commit) and the head's committer time, never its author time, which an
                  amend or a fixup rebase keeps, from the transcripts and the branch history;
                  the pull request's review record for an automated reviewer;
                  "unverified" where they do not show it — never from memory or anyone's
                  account of it>
Not verified:    <what you did not verify, said plainly — or "nothing">
Outcome:         <PR ready for review | blocked: <reason> | abandoned> — <one line why>
Skill got wrong: <the one thing this skill or its routing table should have said, or "nothing">
```

**Reviewed by and Shipped revision come from the record, not the account.**
A worker's account of its own reviews has been wrong in both directions: one
reported a fix folded in before review when the reviewers had read the tree
before it, and another called its final head self-checked when a review of it
had run. Both were careful reports. Only the times and what each review read
show what happened:

- **A review covers the content it read, and nothing else.** An edit made
  while a reviewer is running, or a fix applied from its findings once it has
  ended, is covered only if a review then read the changed content.
- **It covers the shipped head file by file**: a file is covered when a
  review was pointed at it and its content at the head is the content that
  review read, the same commit or the same blob. Any other changed file is
  listed under "not covered in session", with the change and its time.
- **A fork of your context is not someone else.** A reviewer that inherited
  your context is recorded as forked. A file only a fork read is "covered by
  content only": that does not meet the skill's review rule, even when the
  fork read the right commit.

After the pull request is marked ready, the head is usually reviewed again by
an automated reviewer that finished on the head commit, by either signal step
7 of the skill accepts; name it after the in-session verdict. Where none did,
the line says "self-checked".

**Bindings.** The receipt states which performer ran each step; the bindings
file and the session's transcripts, which the file lists, are what prove it.
A rebind or a fallback that is in the bindings file but missing here, or the
other way round, is a defect in the receipt.
