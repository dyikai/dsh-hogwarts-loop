# Worked example & sizing heuristics

Abstract rules are cheap; a concrete run is what makes them stick. This walks a
real milestone through the whole loop — starting with **Albus's Plan stage** (how
the spec became checkpoints, and how they were *sized*), then one full review
round-trip that shows why the builder/reviewer separation earns its keep. (Drawn
from an actual engine milestone: an animation + scheduler + frame-pipeline build
in a Rust UI framework. Details are real but the lessons are general.)

## The Plan stage — how Albus sizes checkpoints

Planning is the first act of the loop and its highest-leverage decision: Albus
reads the source of truth and decomposes it into checkpoints. Get this wrong and
every later review is either shallow (checkpoint too big) or ceremonial (too
small). Heuristics that held up:

- **Slice by independently-verifiable capability, not by file or by layer.** Each
  checkpoint should have its own gate that can go green on its own. "The scheduler
  works" is a checkpoint; "edit these four files" is not.
- **Put a foundation/infra checkpoint first.** The types, the core data
  structures, the thing everything else imports. Reviewing it deeply once pays off
  every checkpoint after.
- **Lay a regression baseline before a risky rewrite.** If a later checkpoint
  rewrites a hot path, spend a checkpoint *first* recording the current behavior
  (a smoke suite, golden outputs) so you can prove the rewrite didn't break it.
- **Concentrate the risky/breaking work into its own checkpoint.** Controlled
  API breaks, tricky concurrency, the migration that touches many call sites —
  gather these into one checkpoint and review it hardest (this is where you might
  ask for a *full* review even on the fix round), rather than smearing breakage
  across several.
- **Order by dependency; note what can run in parallel.** Two checkpoints that
  don't touch each other can proceed independently.
- **Size to reviewability.** The real test: can Severus hold the diff in his head
  and walk its untested paths? If not, split finer. A checkpoint too big to
  review deeply defeats the purpose.
- **End with a closeout checkpoint** — docs, acceptance mapping, contract
  reconciliation. It's real work; give it its own slot.
- Typical milestone lands around **5–9 checkpoints**.

### The Plan Albus produced

The milestone's spec had ~13 implementation steps (S1–S13). Albus grouped them
into 8 checkpoints — this table *is* the working plan's checkpoint map, the output
of the Plan stage that then drives every build/review below (the working plan's
storage is a separate decision; it is session/temp by default, not a committed
file):

| CP | What | Why it's its own checkpoint |
|----|------|------------------------------|
| CP0 | Regression baseline (smoke suite of existing examples) | Baseline before the CP3 hot-path rewrite — proves no regression later |
| CP1 | Foundation: time type, debug types, scheduler rewrite | The infra everything imports; reviewed deeply once |
| CP2 | Two small independent steps (platform hook, stats fields) | Small, low-risk, parallelizable — kept out of the big checkpoints |
| CP3 | Frame-pipeline rewrite + injection | The riskiest rewrite → **deepest review** |
| CP4 | Animation core (controller, curves, tween) | A coherent feature slice with its own property tests |
| CP5 | View + gesture integration (animated views, fling, long-press) | First real consumer of the core; integration surface |
| CP6 | Multi-window + a public-API refactor (2 controlled breaks) | Breaking changes concentrated here → **full review** |
| CP7 | Closeout: demo, CI gates, acceptance doc, contract sync | Docs + verification as a first-class checkpoint |

Note the shape: baseline → foundation → small parallel steps → risky rewrite →
feature → integration → concentrated-breaks → closeout. Risk is front-loaded and
isolated; the deepest reviews land on CP3 and CP6 by design.

## Worked review round-trip — the bug the loop caught

This is the single clearest case for why Severus must not be the author. It is a
teaching reconstruction under the current contract, not a transcript of the
historical run; where the old run used a reviewer-written repro, the text says
so instead of presenting it as current practice.

**CP5 delivered a long-press recognizer.** Harry's report: feature built, unit
tests green, gates pass. The unit tests fired a 500 ms timer via a `MockClock`,
called the recognizer's timer-flush directly, and asserted the long-press was
accepted. All green. A single-agent workflow ships here.

**Severus didn't just re-read — he walked the path the tests didn't.** He asked:
*what actually happens on the idle path — user presses and holds, no further
input events at all?* (The literal definition of a long press.) He traced the
real integration path through the frame loop:

1. Press arms a 500 ms timer, one frame renders.
2. The event loop sleeps until the timer deadline.
3. The timer fires — but its callback only *sets a flag*; it doesn't request a
   frame.
4. So the "should we render again?" check sees nothing pending → **no frame is
   scheduled**.
5. The gesture arena is only polled *inside* a frame → the poll never runs → the
   long-press is never accepted.

Result: the long-press only fired when the user *released* — it had degraded to
"fires on release," losing its entire point. **The unit tests passed because they
called the flush directly, bypassing the exact frame-loop wiring that was
broken.**

**The finding still needed execution evidence — and under the current protocol
Severus does not run it.** He returns a prove-or-refute request with the
finding ID, the reviewed snapshot, the idle-path input, the real frame-loop
entrypoint, the oracle (`accepted === true`), and the test to write. Harry writes
the test and returns it red on the reviewed snapshot; only after non-origin
confirmation does he apply the fix and record green on the fixed tree with both
source stamps (`review-contract.md`). (The original run predates the no-build
rule and used a reviewer-written throwaway repro; that is not the current
discipline, and the historical step is not retrofitted as if it were.) The static
trace is what makes the candidate worth testing; the red repro is what confirms
it.

**The round-trip (edges D→E→F→C in `loop.md`):**
- Severus → REQUEST-CHANGES: one P1 **candidate**, *long-press never accepts on
  the idle path*, with the trace and the prove-or-refute request.
- Albus batch-validates the blocking candidate (one non-origin pass; the static
  trace plus the requested oracle/entrypoint) before relaying it. The candidate
  is `needs-evidence`, so E authorizes evidence collection only — not repair.
- Harry runs the unchanged integration test red on the reviewed snapshot and
  returns the raw output plus the pre-fix stamp; the non-origin validator checks
  the oracle/entrypoint and confirms. No repair happened before this point.
- Harry fixes: the timer callback now also requests a frame, so the loop re-arms
  and the arena is polled. One-line core fix.
- Harry keeps the test unchanged and returns green on the fixed tree with the
  second stamp: an **integration** test that drives the idle path end-to-end
  (the thing the original unit test bypassed), locking the bug against recurrence.
- Severus re-reviews the fix and post-fix evidence: confirms the gate is green on
  the fixed state by auditing Harry's fix-round evidence (command, raw output,
  tree-state stamps — he runs nothing himself, per `loop.md`'s Gate economy),
  confirms the test exercises the previously-broken path (not another direct-call
  bypass), reuses the same finding ID, and closes it; APPROVE. The checkpoint
  used **two** review/response cycles (the pre-fix evidence report and the repair
  report), so the convergence cap is not in play.

**The lesson, generalized:** green tests mean "what the author thought to test
passed," not "the code is correct." The bugs that ship are the ones on the paths
the author didn't think about — the idle case, the empty case, the reentrant
call, the concurrent window. An independent reviewer whose job is to *find* those
paths is the mechanism that catches them. Everything else in this skill exists to
support that one move.

## The same bug as a finding record

Under the current contract, the example above would be recorded like this. This
table is a **teaching reconstruction** of the same defect under the current
`review-contract.md`, not a recovered historical record.

| Field | Value |
| --- | --- |
| ID | `F-CP5-1` (reused on re-review; never renumbered) |
| Severity | P1 — the gesture never accepts on its literal path |
| Evidence | `candidate` at review → `needs-evidence` (repro authorized) → `confirmed` by a non-origin validator from the pre-fix red evidence → `closed-fixed` only after independent re-review of the fixed state and post-fix evidence |
| Provenance | `cp-introduced` |
| Trigger | press and hold, no further input, advance 500 ms |
| Location | `recognizer.js:<timer callback>` → `frame-loop.js:<poll>` |
| Chain | timer sets flag → no frame requested → arena not polled → never accepted |
| Guard checked | the unit test bypasses the frame loop; no production guard |
| Validation | non-origin batch marks needs-evidence and authorizes evidence collection; validator confirms from red; Severus re-reviews fix and green |
| Closure | independent re-review + regression test retained; Harry's F report only proposed it |

If a checkpoint instead spends **three completed review/response cycles** with
blocking findings still open, the loop stops automatic iteration and records the
reassessment decision — the counters are preserved, new serious findings are
still triaged, and a fourth automatic cycle is not queued. That cap is separate
from the per-problem Harry/Voldemort attempt limits; the full precedence rule is
in `review-contract.md`.
