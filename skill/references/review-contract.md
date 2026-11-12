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

Checkpoint approval requires accounted-for candidates, independent closure of fixes and the
full gate on the final tree, plus the mandatory ablation readiness in `ablation.md`.
Confirmed P1s must be fixed, never waived; P2s must be
fixed or explicitly waived by an authorized decision-maker with scope and reason.
Required verification must be completed or explicitly risk-accepted as above;
that cannot waive a confirmed P1 or a mandatory human approval. Carry P3s rather
than launching cosmetic repair rounds. Model consensus is not human authorization.

## Problem-scoped advisor lifecycle

An escalation brief binds Voldemort to one problem ID or stable failure/acceptance
identifier, its scope, and problem-level exit criteria with required verification.
Unlimited guided rounds apply only while that problem remains open, not to the
whole checkpoint or plan. Bounded diagnosis/implementation and all safety rules
below still apply.

Harry supplies the repair snapshot, required target gates and acceptance evidence,
including affected paths. Severus may perform a scope-limited **read-only problem
closure** while the checkpoint is unfinished or red only if the remaining work or
failures are demonstrably unrelated and this problem's required verification and
affected paths are satisfied. If required problem verification is red or attribution
is unclear, do not close. No P1/P2, required proof or approval is waived. Report
**problem closed**, not checkpoint APPROVE; the whole checkpoint still needs its
full green gate and normal independent approval before commit.

Immediately stop dispatching Voldemort when Severus independently closes the
problem. Albus records the closure evidence and advisor exit; Harry continues
independently in the same child without waiting for checkpoint completion. The
Voldemort child keeps memory but has no standing task or automatic continuation;
do not destroy or replace it. Do not send it remaining work or routine follow-up.

For later use, each different problem needs its own three independent failures,
Albus's fresh authorization and a new scoped brief to the same Voldemort child.
Neither counts nor the guided-work budget exception transfer from a closed problem.
Do not rename an unresolved problem to reset its history. A genuine reopening uses
the changed-premise/new-evidence rule above; Albus must reassess eligibility and
explicitly reauthorize its scope, never infer standing advisor authorization.

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
  the third. If it approves, pass. Otherwise apply the ordinary stop rule or the
  narrowly eligible advisor-guided collaboration below before more author work.
- For ordinary work outside the eligible collaboration below, after two evidence
  batches already-confirmed work may still be repaired within its remaining round
  budget. If required evidence remains unresolved, stop and reassess; do not issue
  a third evidence-only batch automatically. Exhausting evidence budget is not an
  implementation failure or grounds for escalation.
- At either ordinary limit, state what remains open and whether the approach,
  scope or review is at fault. Stop/report, or obtain explicit human authorization
  for a changed approach, finite additional budget and stop condition. Preserve
  counts and unresolved findings across re-scoping, reviewer changes and escalation.

### Precedence: one established root in advisor-guided collaboration

Here **same-root** means the same stable problem/failure and acceptance criteria
(`SKILL.md`), with a proven root or explicitly unproven hypotheses. Precise root
proof is not required before escalation; a changed diagnostic hypothesis does not
reset attempts. Unrelated independent defects remain separate.

The three independent attempts in `SKILL.md` count substantive approaches,
implementation and validation evidence on one root, **not review rounds**. A red
gate can end an attempt before review; confirmed same-root P1 or P2 failures can
also qualify. Probes alone, repeated commands, messages and unrelated roots cannot.
A third attempt that succeeds does not escalate. Harry actively reports the third
failure to Albus; he does not keep retrying independently.

Once Albus checks that three genuine same-root failures occurred and brings in
Voldemort as read-only advisor, **that problem's guided diagnosis or implementation
takes precedence over ordinary repair and evidence caps**. Do not stop it under an old
two-Voldemort, five-total-attempt or independent-phase limit. There is no fixed
collaboration-round or total-attempt cap, nor a fresh human-permission request at
every multiple of a budget. Harry remains the same implementer/test-runner child;
Voldemort diagnoses and advises through Albus, and Severus independently closes.

Albus records the original attempts, cumulative repair/evidence totals and guided
rounds without resetting them. Before **each** guided round he reassesses actual
results and relays the advisor's new or revised hypothesis or diagnostic question
for this same stable problem. Authorize a bounded diagnosis or implementation:
name the commands, time/scenario limits and decidable acceptance or diagnostic
signals. Harry executes and returns actual results/failures and any code changes;
Albus sends these to the read-only advisor before deciding the next step. Guided
diagnosis does not require code changes, even when the precise root is unknown.
Inspect and validate the evidence before authorizing repair; guidance never
licenses fixing an unconfirmed new defect.

Such guided diagnosis or implementation **may exceed ordinary cumulative
repair/evidence totals**, including diagnostic-only rounds. Do not stop solely on
those totals or demand another human budget extension at fixed intervals. The
exception is for evidence-driven next questions on this already eligible problem,
not blind probe churn: do not repeat ineffective probes without a new/revised
hypothesis or diagnostic question justified by actual evidence, relabel an old
request, or hide unlimited retries in a batch. Inconclusive/setup-failed results
still count and must inform Albus's reassessment; they are not automatic passes.
Unescalated work and unrelated problems still obey ordinary budgets. New candidates
still require validation before repair; unrelated ones cannot borrow the exception
merely because another problem entered collaboration.

Scope, evidence, mandatory approvals and independent closure do not weaken. Honor
human stop requests and honestly report real permission, environment or external
prerequisite blockers; never fabricate completion. These are agent instructions,
not tool ACLs or runtime counters.

Examples: one successful repro and repair uses rounds=1, evidence=1. For ordinary
unescalated work, two inconclusive probe-only batches stop further automatic
probing even at rounds=0. Three repair rounds on different roots do not establish
escalation eligibility. Three genuine failures on one problem do: Albus can
arrange later **Harry** diagnostic-only or implementation rounds under advisor
guidance without a budget-extension approval, while retaining the totals. Always obtain the final closure verdict and triage
new serious findings.

## Feedback

At checkpoint close, note useful findings, false alarms, anything missed, rounds
and evidence batches used, and measured cost if available. Keep this in the
session/working plan, not a new audit bundle. `evaluation.md` explains how to test
whether these rules actually improve outcomes; passing repository tests alone
cannot answer that question.
