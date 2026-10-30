# Review contract

The goal is fewer missed defects and fewer unnecessary repairs, not more review
paperwork. This file owns finding validation, closure and review budgets.
`loop.md` describes transport; `reviewer.md` describes review technique and lenses.
These are instructions for agents, not a runtime state machine or tool ACL.

## Report a defect, not a checklist

For each blocking finding, give a stable ID, severity, location, and a concrete
chain: **input/state → path → wrong consequence**, including the guard checked.
Identify the reviewed snapshot once per report. Add provenance when it matters
(pre-existing, checkpoint-introduced or repair-introduced); don't repeat metadata
that is already clear. P3 observations need no full finding ledger.

Severity describes impact if true: P1 is a blocking correctness/security defect;
P2 is a blocking spec, contract or required-verification gap; P3 is non-blocking.
Evidence is separate: `candidate`, `confirmed`, `refuted`, or `needs-evidence`.
A suggested repair is not proof, and `confirmed` does not mean fixed.

## Validate before asking for repairs

Albus checks blocking and security candidates in one batch, not by spawning an
agent per finding. For each claim, a reviewer other than its origin or code author
checks the chain and strongest plausible counterexample. Albus can do this by reading; only
an unresolved, consequential question needs another reviewer.

- A complete static code/data-flow chain can confirm a defect. Do not demand a
  running test merely because the finding concerns executable code.
- Refute a claim when a guard or counterexample defeats it; record why and do not
  send it for repair. A refutation covers that scenario, not every related bug.
- If execution is necessary, mark `needs-evidence`: name the owner, real entrypoint,
  observable result, bounded scenario and finite command/time budget. Harry runs
  the probe; reviewers do not build or execute it. An evidence request is not an
  authorization to repair an unconfirmed defect.
- Inspect that evidence before authorizing repair. A setup failure or a private
  test seam that bypasses the shipping path does not confirm the claim. Required
  unresolved evidence blocks approval; silence and an old green suite do not
  resolve it. A risk acceptance must be explicit, scoped and attributable to the
  authorized risk owner, never inferred by the agents.

## Fix and re-review

For a required repro, preserve the same test and capture its red result before
repair and green result after, with source stamps and raw output. Never alter the
shared tree to fabricate a missed pre-fix run; report the evidence gap honestly.
For a statically settled finding, inspect the fixed code and relevant gate
results instead. Add regression tests where they protect behavior, not to satisfy
an arbitrary test-per-finding quota.

The author reports the fix; an independent reviewer verifies closure. Re-review
only the fix increment, affected adjacent paths and gate evidence. Reuse the same
ID when the defect remains; reopen it only for a changed premise or new evidence.
A new repair-introduced defect gets a new ID and does not erase the old one.
Check a demonstrated class of bug within the checkpoint; route out-of-scope
instances explicitly instead of silently expanding the work.

Approval requires accounted-for candidates, independent closure of fixes and the
full gate on the final tree. Confirmed P1s must be fixed, never waived; P2s must be
fixed or explicitly waived by an authorized decision-maker with scope and reason.
Required verification must be completed or explicitly risk-accepted as above;
that cannot waive a confirmed P1 or a mandatory human approval. Carry P3s rather
than launching cosmetic repair rounds. Model consensus is not human authorization.

## Bound repair rounds and evidence separately

Use two checkpoint-wide budgets. These defaults are safety bounds, not measured
optimal settings. Record only the counts used and any decision to extend them.

| Budget | Default | Count when |
| --- | --- | --- |
| Repair/re-review rounds | 3 | The author's fix or substantive contest/no-change response has received an independent re-review verdict |
| Evidence-only batches | 2 | The author returns substantive results from an authorized evidence request, including inconclusive or setup-failed results |

The initial review is not a repair round. A probe, confirmation, repair and its
re-review are **one repair round plus one evidence batch**, not two repair rounds.
Batch the currently known evidence requests. Each batch has the finite execution
limit agreed before dispatch; don't hide open-ended retries inside it. Changing
the scenario, finding ID or report label does not create a free evidence batch.
Progress messages and raw log chunks do not count as new reports. A response that
only supplies evidence is not a contest/no-change repair response.

- Always allow the re-review that closes an already delivered repair, including
  the third. If it approves, pass. If the third completed repair round still has
  blockers, do not dispatch a fourth repair automatically.
- After two evidence batches, already-confirmed work may still be repaired within
  its remaining round budget. If required evidence remains unresolved, stop and
  reassess; do not issue a third evidence-only batch automatically. Exhausting
  evidence budget is not an implementation failure or grounds for escalation.
- At either limit, state what remains open and whether the approach, scope or
  review is at fault. Stop/report, or obtain explicit human authorization for a
  changed approach, a finite additional budget and a stop condition. Keep counts
  and unresolved findings across re-scoping, reviewer changes and escalation.
- The separate same-root Harry (3) / Voldemort (2) attempt limits in `SKILL.md`
  remain absolute. Escalation requires actual failed implementation attempts on
  that root, not review churn or probes. If both limits apply, satisfy both; a
  human extension of the checkpoint budget does not add implementation attempts.

Examples: one successful repro and repair uses rounds=1, evidence=1. A second new
runtime finding may use the second evidence batch and a second repair round.
Two inconclusive probes stop further automatic probing even at rounds=0. Three
failed repair/re-review rounds stop a fourth repair, but never suppress a new
serious finding or the final closure verdict.

## Feedback

At checkpoint close, note useful findings, false alarms, anything missed, rounds
and evidence batches used, and measured cost if available. Keep this in the
session/working plan, not a new audit bundle. `evaluation.md` explains how to test
whether these rules actually improve outcomes; passing repository tests alone
cannot answer that question.
