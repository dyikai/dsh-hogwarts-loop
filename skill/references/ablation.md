# Mandatory ablation — prove which complexity earns its place

Every checkpoint, regardless of size or complexity, must complete at least one
bounded experiment with an actual deletion or simpler substitution before checkpoint
approval review. A green suite establishes correctness evidence, not necessity of
every design choice. This file is the canonical policy; other briefs reference it.

## Choose a meaningful, bounded experiment

Complexity affects hypothesis selection and experiment scale, not eligibility.
Choose from the current changed artifacts or related design units, against the
checkpoint's unchanged content, behavior or scenario acceptance. Do not manufacture
runtime code just to have something to delete. Checkpoints limited to documentation,
tests, configuration or deletion-only work are not exempt.

For example: consolidate repeated instructions into one canonical rule and references;
remove redundant setup while preserving test behavior and scenario coverage; remove
an unnecessary override and verify effective settings; or simplify a remaining
affected caller or contract after deletion and check compatibility.

If there is no meaningful executable experiment, or the environment blocks it,
Albus must obtain an explicit human waiver or stop. Record the blocker and any
attributed waiver; do not self-declare N/A or an unrun experiment completed. A waiver
is a reported exception, not experiment evidence or permission to weaken acceptance.

## Experiment contract

1. **Freeze a green candidate.** Preserve its source and gate evidence; list the
   original behavior, compatibility, safety and performance acceptance criteria.
   Baseline checks follow the project's gate economy. Do not overwrite someone
   else's work.
2. **Select 1–3 deletion hypotheses per round.** Prefer one-use abstractions,
   redundant state/provenance, unsupported compatibility scaffolding, speculative
   extension points, or custom machinery already supplied by the platform.
   Name the design unit, simpler alternative, falsification check and expected
   cost. An additional round needs a named uncovered hypothesis and bounded
   budget—not a desire to reach an arbitrary reduction percentage.
3. **Change one unit at a time.** Each independent variant starts from the same
   frozen candidate. Actually remove or substitute it; a prose justification is
   not an experiment. Save the variant patch and stamp plus raw command output.
   Harry alone executes experiments; a reviewer never edits or runs them.
4. **Judge against unchanged acceptance.** Run relevant behavior tests and fast
   gates, or applicable content/scenario checks for non-runtime artifacts. Add
   missing falsification tests where needed; do not delete, skip or weaken acceptance
   to get green. A private-shape test failure is not by itself evidence that the
   design is necessary: justify any assertion adaptation and keep behavior coverage.
   Measure I/O/allocation counts when relevant; passing mocked tests is not a
   performance benchmark or live-runtime verification. Content-contract checks
   verify declarations, not actual agent behavior or LLM compliance.
5. **Keep or revert with evidence.** Keep a simpler variant only if acceptance
   and the agreed cost budget remain satisfied. Record real failures and restore
   rejected variants. If evidence is insufficient, retain the mechanism and
   report the unresolved experiment; do not claim it was proven necessary.
6. **Compose and verify.** Combine accepted variants and run the final full gate
   on that exact surviving tree under the project's gate economy; send Severus the
   evidence and changed artifacts. Missing experiments or unvalidated survivors
   block review readiness, subject only to an explicit human waiver reported above.

A rejected deletion can be a completed experiment. A still-large survivor can
satisfy this gate. Fewer lines alone are not a win; fewer state models, lifecycles
or indirect steps are stronger results. Do not compress readable code to
manufacture a percentage. An accepted survivor does not require you to recursively
ablate the experiment's own simplification indefinitely.

Experiment patches, raw logs, snapshots and scratch reports are temporary review
inputs, not default repository deliverables. Follow `loop.md` (Temporary artifacts)
for storage and Albus-owned cleanup after review; preserve only concise outcomes
and necessary regression tests unless the user explicitly requests the evidence.

## Repair rounds and handoff

If a repair changes the candidate, however small the fix, run or update experiments
for the new or affected hypotheses before re-review, and verify the final combination.
Use the prior validated survivor and its evidence to scope the repair increment;
earlier acceptance still applies. A tiny fix cannot bypass this requirement.

For the same unchanged tree and acceptance, an evidence-only handoff may reuse
already completed valid experiments, citing their candidate, variants, results and
survivor stamps. This is evidence reuse, not a no-experiment exemption. A changed
acceptance contract requires reassessing the affected experiments; do not cite stale
proof. Reusing valid evidence does not require rerunning experiments for every message.

Harry's delivery/fix report includes mandatory ablation evidence:

- Checkpoint baseline, green candidate source/stamp and gate evidence, unchanged
  acceptance, selected hypotheses and bounded validation commands/scenarios.
- Experiment table:
  `ID | unit removed/replaced | variant stamp/patch | command + raw result |
  behavior/cost change | keep/revert/unresolved + reason`.
- Combined-survivor stamp and final gate output, retained risks, and any evidence
  reuse or explicit human waiver. Link raw artifacts instead of repeating long
  logs in every brief.

Albus checks readiness before review. Severus audits meaningful deletion attempts,
unchanged acceptance, rejected-variant restoration, composition interactions,
repair coverage or evidence reuse, and final evidence. He does not rerun experiments;
missing proof returns to Harry. Necessity is conditional on the tested contract,
not a claim that no simpler implementation could ever exist.
