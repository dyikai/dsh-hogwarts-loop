# Evaluation and lightweight feedback

Canonical guidance for learning from review outcomes without turning the loop
into a benchmark product. This file owns the feedback fields, the synthetic seed
corpus, and the honest limits of any comparison. `review-contract.md` owns the
finding lifecycle; this file consumes its vocabulary.

## What to record

Keep the record lightweight and concise, in the working plan or the conversation
— not in a per-run audit bundle:

- review/response cycles used against the checkpoint convergence cap;
- outcomes by severity and evidence status: `candidate` → `confirmed` /
  `refuted` / `needs-evidence`, confirmed findings fixed vs explicitly waived
  P2, P3s carried;
- escaped defects: a defect found after APPROVE or commit, with provenance
  (`pre-existing`, `cp-introduced`, `repair-introduced`) and how it escaped;
- when actually available, wall-clock time and token/cost per cycle, plus the
  reviewer configuration (role/model, prompt/contract revision, available
  tools). If a number was not measured, write "unavailable" — never estimate it
  as if it were measured;
- the configuration and snapshot used for any comparison, so a later run is
  reproducible.

These entries are feedback about the process. Raw logs, evaluator transcripts
and scoring scratch files are temporary artifacts under `loop.md`; they are not
repository deliverables.

## What the numbers do and do not mean

- An accepted fix is **not ground truth**. It can be accepted for budget,
  compatibility, or a P2 waiver while remaining wrong.
- Finding counts are **not recall**. A reviewer that reports no defects has not
  demonstrated correctness, and a reviewer that reports many has not
  demonstrated coverage.
- A green suite is evidence about the tests that ran, not about the paths they
  bypass (`review-contract.md`).
- Do not compare raw counts across different snapshots or non-treatment
  variables. Compare only the same target snapshots, record exactly which
  prompt/tool/model/config intentionally differs, and hold everything else equal.
- **Never claim an actual model score without running the protocol.** No
  measured reviewer improvement is claimed by the docs or by the contract tests;
  the synthetic seeds are examples, not a score.
- No external paid model runner, nightly scheduler, or evaluation framework is
  part of this skill. This guide does not call a live model or provider; a
  human/local evaluator runs the comparison and records the outcome.

## Synthetic seed corpus

The corpus lives beside the plan template:

- `../assets/eval-inputs.md` — target inputs only, safe to hand to a reviewer;
- `../assets/eval-expectations.md` — the expected answers and scoring notes.

Keep them separate. Never paste the expectations into a reviewer prompt, a
workspace, or a child's brief; that leaks answers and invalidates the run. The
files are clearly labelled **synthetic**: they are product examples written for
this skill, not historical incidents, not a measured precision/recall report,
and not claims about any model.

The seed set is intentionally small but covers the cases that change a review
outcome:

| ID | Case | What it exercises |
| --- | --- | --- |
| E1 | Cross-tenant cache leak | a real executable/security defect with provenance and a no-waiver P1 |
| E2 | Guarded parser | a guarded false positive that should be refuted, not fixed |
| E3 | Green unit test, untested integration path | `needs-evidence` blocking and the no-silent-approval rule |
| E4 | Save repair | the original leak stays open under the same ID, plus a repair-introduced silent-success regression with a new ID |
| E5 | Three cycles plus a new P1 | the convergence cap, counter preservation, and escalation precedence |

### Running a manual comparison

1. Freeze the target snapshot(s) and every **non-treatment variable**; decide
   exactly which prompt, tool, model, or config parameter is the variable under
   test. Run in a fresh evaluation context, not a persistent production role with
   prior answers. Give the reviewer only `eval-inputs.md` (or the specific case)
   and the review contract; withhold gold and previous-run answers.
2. Collect the report. Map each finding to the expectation by defect and stable
   ID, not by wording.
3. Record the outcomes: expected blocking defect found at the right evidence
   stage, false positives on the guarded case, correct `needs-evidence` routing,
   whether the repair regression was caught without closing the original leak,
   and the convergence decision.
4. Compare two configurations only on the same frozen snapshots with the
   non-treatment variables held equal; record exactly which prompt/model/tool/
   config intentionally differs. Report recall-of-expected-defects,
   noise/false-positive count, evidence-stage correctness and convergence cycles
   separately — never a single "score".
5. Keep the run artifacts outside the workspace for the review window and clean
   them up when done (`loop.md`, Temporary artifacts). If no run was executed,
   say so.

### Growing the corpus

Future cases may come from expert-verified incidents, postmortems, reverts, and
clean diffs that should produce little or no noise. For each addition:

- keep the target input and the expected answer in separate files;
- label the provenance (synthetic vs observed) and remove client secrets or
  private data;
- record the expected finding's severity, evidence status, disposition and the
  evidence that would confirm it — not just "should find a bug";
- rescore when a prompt, tool, persona, model, or contract change could move the
  result.

## Contract tests are not model quality

Unit and static fixture checks validate that the contract documents and seed
files exist, stay consistent, and keep inputs separate from expectations. They
do **not** evaluate a model's review quality, and passing them must never be
reported as a measured evaluation result.
