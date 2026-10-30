# Session-identity case — provenance and scoring only

Keep this file, other snapshots, repository history and test answers outside the
evaluated agents' accessible context. Supply only L0 plus the current snapshot
from `eval-legacy-inputs.md`, and earlier outputs in the sequential replay.
This is a maintained regression case, not a per-run report or a model score.

## Provenance and limits

This case derives from real review finding **HW-R4**, identified in this repository
on 2026-10-29. It concerns test isolation, not a production cache defect or an
invented historical incident. The source anchors are Git blob hashes, not commits:

- Before: `test/hogwarts-dispatch.test.js`, blob
  `09f56360bc93d89c219f22262c2b7c6cdd389149`, the `HISTORICAL_PERSONAS` loop.
- Cache context: `index.js`, blob `bb7a4ddca97ceb1562357d0d766d8d579dbcaad5`,
  `identifyLegacyChild` and its module-level cache keyed only by child ID.
- Corrected test: blob `144990680d92df12ae6e0e60429afb9cdcd6d405`; IDs include
  `version + role`, and a read-call assertion ensures each frozen prompt is read.

The embedded snapshots are reduced executable reproductions; the hashes identify
where they came from, not external files that must exist to run the fixtures.
A/C preserve the observed before/after ID expressions. B is a **synthetic failed
repair** that changes only the parent ID; no agent is claimed to have proposed it.
The context omits role decoding, host projections and concurrency. Its model
results cannot be generalized to those paths or to overall repository recall.

Ground truth was checked in the real dispatcher tests: adding the read assertion
before repairing the IDs produced exactly two failures (1.0.4 Severus/Alastor,
zero reads); changing both IDs while retaining that assertion made all six
historical cases pass. `node --test test/eval-fixtures.test.js` independently
checks the shipped reduced snapshots; `node --test test/hogwarts-dispatch.test.js`
checks current real dispatcher behavior. Neither command evaluates a model.

## Independent paired review

Run L0+A and L0+C separately, in fresh contexts with neutral labels. Do not show
an agent its counterpart or a filename that announces the expected verdict.

- **A:** a P2 test-coverage candidate is warranted. The old-version case caches
  the identity under `frozen-${role}`; the new-version case uses that same key
  despite its fresh fake query, so its own prompt is never read. Role equality
  still passes. Changing production caching is not required to fix test isolation.
- **C:** the IDs separate every supplied version/role pair. In this bounded case,
  the old collision finding must not recur and does not justify another repair.
  Asking for a direct read assertion is a useful strengthening, not evidence
  that C still collides. The actual repository fix includes that assertion.

Score A detection and C harmful false-positive repairs separately. A report that
finds A but still requires a collision repair in C fails the pair. Other material
claims need their own chain; do not demand a predetermined report wording.

## Sequential repair replay — not a supplied-history quiz

After authorizing an evaluation run, release snapshots one at a time to the same
reviewer context. Record actual outputs before the next step; do not manufacture
prior findings to force the expected path. The scorer may be a human. Validation
must be by someone other than the reporter/code author, not self-confirmation.

1. Give L0+A, with no prior finding. Score the actual candidate report. If it misses
   the isolation defect, record a miss and stop this replay rather than feed the
   answer. Validate its chain and record the reporter's chosen ID, e.g. `F1`.
2. Present A→B as the author's proposed repair, carrying the real prior report and
   validation. Require a closure verdict: `F1` stays open under the same ID because
   the child key is unchanged. This is completed repair/re-review round 1.
3. Present B→C with the real accumulated record. Require another closure verdict:
   `F1` closes with the distinct child-key argument; no cosmetic repair follows.
   This is round 2. Static validation needs zero evidence-only batches. If the
   run actually requests probes, count and bound them instead of inventing zero.

Record lost/duplicate IDs, premature closure at B, repeated false findings at C,
repairs requested, actual rounds/probes and measured cost. This is a **scripted
multi-turn closure evaluation**: the supplied repairs standardize the challenge;
it does not measure an author's repair ability or end-to-end loop cost.

## Full-loop variant

For an authorized full-loop comparison, supply only L0+A and let the real validator
and author respond and repair; do not inject B/C or the expected finding. Evaluate
the produced fix by the unchanged behavioral oracle: within one resolver, every
version/role case must invoke its own read once and return its correct identity;
repeating a real immutable child may still hit cache. Preserve actual before/after
code and outputs until scoring. Accept behaviorally equivalent repairs, not just
C's spelling. Use the review contract's budgets and stop conditions. Report this
separately from the scripted replay; no full-loop or model comparison has been run
merely by shipping this case.
