# Conditional ablation — prove which complexity earns its place

Harry measures every delivery and fix report before it enters review. A green
suite establishes correctness evidence, not necessity of every design choice.
This file is the canonical policy; do not duplicate its thresholds in briefs.

## Trigger: any one condition is enough

| Measure | Default trigger |
| --- | --- |
| Added or rewritten production lines | **300 or more** |
| Semantically changed production files | **8 or more** |
| New independent layers or mechanisms | **2 or more** |
| High-cost addition | Any new persistence mechanism, external dependency, cross-module shared mutable state, or generic extension framework |

These are experiment triggers, not quality scores or mandatory size limits.
Albus may set project-specific thresholds in the plan **before implementation**,
with reasons; do not raise them after seeing a large diff to avoid experiments.

### Count consistently, without building a metrics framework

- Initial measurement is checkpoint-start → current tree, including staged,
  unstaged, and untracked changes in scope. Record baseline and tree hashes.
- Count the added side of the semantic production diff: a rewritten surviving
  line counts once. Never use net additions or additions plus deletions.
- Exclude tests, documentation, blank/comment-only lines, generated output,
  pure formatting, unchanged moved code, rename-only and deletion-only changes.
  Count actual edits within moved files; code-containing lines count. Runtime
  configuration/assets count; test-only scripts do not.
- Ordinary diff/numstat output is raw evidence, not automatically the normalized
  count. Record excluded paths/hunks and deductions. A conservative overcount
  may trigger experiments; an uncertain count must not silently waive them.
- Count files once. A mechanism is a separately removable responsibility with
  its own state, lifecycle or invariant—not every helper or file. Name each
  mechanism and locate it. Record the four high-cost flags individually.
- If below every trigger, report **not triggered** with the measurements; no
  experiment is required. Thresholds do not force speculative cleanup.

## Experiment contract

1. **Freeze a green candidate.** Preserve its source and gate evidence; list the
   original behavior, compatibility, safety and performance acceptance criteria.
   Baseline checks follow the project's gate economy; a final full gate is still
   required on the surviving tree. Do not overwrite someone else's work.
2. **Select 1–3 deletion hypotheses per round.** Prefer one-use abstractions,
   redundant state/provenance, unsupported compatibility scaffolding, speculative
   extension points, or custom machinery already supplied by the platform.
   Name the design unit, simpler alternative, falsification check and expected
   cost. An additional round needs a named uncovered hypothesis and bounded
   budget—not a desire to reach an arbitrary reduction percentage.
3. **Change one unit at a time.** Each independent variant starts from the same
   frozen candidate. Actually remove or substitute it; a prose justification is
   not an experiment. Save the variant patch and stamp. Harry alone executes
   experiments; a reviewer never edits or runs them.
4. **Judge against unchanged acceptance.** Run relevant behavior tests and fast
   gates. Add missing falsification tests where needed; do not delete, skip or
   weaken acceptance to get green. A private-shape test failure is not by itself
   evidence that the design is necessary: justify any assertion adaptation and
   keep behavior coverage. Measure I/O/allocation counts when relevant; passing
   mocked tests is not a performance benchmark or live-runtime verification.
5. **Keep or revert with evidence.** Keep a simpler variant only if acceptance
   and the agreed cost budget remain satisfied. Record real failures and restore
   rejected variants. If evidence is insufficient, retain the mechanism and
   report the unresolved experiment; do not claim it was proven necessary.
6. **Compose and verify.** Combine accepted variants, rerun the required gates
   on that exact surviving tree, and send Severus the evidence and changed code.
   Missing required experiments or unvalidated survivors block review readiness.
   If the environment cannot execute a required experiment, Albus must obtain
   an explicit human waiver or stop; uncertainty is not an automatic pass.

A rejected deletion can be a successful experiment. A still-large survivor can
satisfy this gate: do not loop until it falls below the trigger. Fewer lines alone
are not a win; fewer state models, lifecycles or indirect steps are stronger
results. Do not compress readable code to manufacture a percentage.

Experiment patches, raw logs, snapshots and scratch reports are temporary review
inputs, not default repository deliverables. Follow `loop.md` (Temporary artifacts)
for storage and Albus-owned cleanup after review; preserve only concise outcomes
and necessary regression tests unless the user explicitly requests the evidence.

## Repair rounds and handoff

After a validated ablation, measure subsequent complexity from that survivor,
not from the previous report. Subthreshold fixes therefore accumulate until
another trigger is met. Before the first validated ablation, retain the
checkpoint-start baseline. Only a validated survivor resets this baseline;
rejected/waived/unrun experiments do not. Scope a repeat to newly introduced
complexity, while retaining earlier acceptance constraints.

Harry's delivery/fix report includes:

- `baseline → tree`, production lines/files, named mechanisms, high-cost flags,
  exclusions, and `not triggered | triggered`.
- When triggered, the candidate baseline and experiment table:
  `ID | unit removed/replaced | variant stamp/patch | command + raw result |
  behavior/cost change | keep/revert/unresolved + reason`.
- Combined-survivor stamp, final gate output, retained risks and next repair
  baseline. Link raw artifacts instead of repeating long logs in every brief.

Albus checks readiness before review. Severus audits trigger arithmetic,
meaningful deletion attempts, unchanged acceptance, rejected-variant restoration,
composition interactions and final evidence. He does not rerun experiments;
missing proof returns to Harry. Necessity is conditional on the tested contract,
not a claim that no simpler implementation could ever exist.
