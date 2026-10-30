# Does the review actually help?

The outcome to improve is **real defects caught with fewer false-positive repairs
and less review effort**. More findings, more rules and more passing repository
tests are not substitutes for that outcome. No before/after model-quality result
is supplied with this skill.

## Keep ordinary feedback small

At pass or stop, record a short note in the session/working plan:
- counts of confirmed/refuted/needs-evidence findings and any escaped defects;
- repair rounds and evidence batches used, including why a limit was reached;
- measured time/tokens/tool cost, or "unavailable".

An accepted fix is not ground truth. Review the underlying failure before using
it as a positive example. Keep temporary transcripts/logs outside the workspace
and clean them after their consumers finish (`loop.md`). Do not commit run reports
by default or turn every checkpoint into a benchmark exercise.

## Two different checks

`assets/eval-inputs.md` and `assets/eval-expectations.md` are **synthetic smoke
cases**, not a representative benchmark. Inputs go to the reviewer; expectations
stay with the scorer, outside the reviewer's accessible evaluation context.
E1–E4 exercise finding quality; E5 exercises orchestration decisions. Do not score
an orchestrator's supplied facts as if the reviewer discovered them.

`assets/eval-legacy-inputs.md` adds a repository-derived test-isolation case with
faulty/partial/correct snapshots. Its separate `eval-legacy-expectations.md` holds
source anchors, paired scoring, a sequential repair replay carrying actual reports,
and a full-loop variant where the author must produce its own repair. The partial
repair is synthetic; it is not a claimed historical agent response. This is one
verified repository seed, not representative coverage or a historical false-alarm
corpus. Accumulate further cases only from independently verified incidents.

Repository fixture tests execute the JavaScript examples to check their ground
truth (including deliberately faulty behavior). They do not run agents, enforce
the prose workflow, or measure review quality. Dispatcher compatibility tests
protect role reuse; they also say nothing about finding precision or recall.

## Small controlled comparison, not a new framework

Before claiming an improvement:

1. Freeze a small set of representative **real repository diffs**: verified bugs,
   clean changes and repairs that introduce a new defect. Have someone outside
   the compared runs establish the expected defects and relevant guards. Keep
   commit messages, fixes and gold answers out of the target context. The shipped
   toy cases may check the setup, but cannot replace this set.
2. Compare the old and proposed instructions on those same snapshots. Hold the
   model, tools and other non-treatment variables fixed; record the intentional
   difference. Use fresh, isolated contexts, not persistent production roles that
   remember earlier answers. Repeat small samples before trusting a lucky run.
3. If the claim concerns **the loop**, exercise the loop: candidate report →
   independent validation → author evidence/repair → incremental re-review.
   A reporting-reviewer-only run measures detection, not validation, closure,
   convergence or the cost of handoffs. The scripted legacy replay checks closure
   across actual reviewer turns but supplies repairs; it does not measure author
   performance or full-loop cost. Keep these result types distinct.
4. Score defect matches rather than wording: true findings and misses, false
   alarms that survived validation, unnecessary repairs, remaining/new defects
   after closure, productive work stopped by a budget, and actual review cost.
   Record rounds and evidence batches separately. Wrongly closing an unfixed
   defect is a miss even if the report uses every required status word.
5. Prefer the smaller policy when it catches the same important defects at lower
   cost. If detection improves but cost/noise rises, report that tradeoff instead
   of collapsing it into a single score. Preserve counterexamples when tuning.

There is no automatic or paid runner here. A run needs its own authorized scope
and budget; this guide is not permission to start agents or spend credits.
Without a comparison, report only the changes made and tests actually executed.
Do not describe a documentation refactor or a green test suite as measured review
improvement.
