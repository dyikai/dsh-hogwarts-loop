# Synthetic smoke-case expectations — scoring side

Keep these answers outside the evaluated reviewer's accessible context. Score
actual defects, guards and decisions, not matching vocabulary. These toy cases do
not establish general precision/recall or full-loop performance (`evaluation.md`).

## E1 — Tenant cache

The new cache leaks tenant A's results to tenant B for the same query. Its key
omits the tenant and a hit bypasses `db.search`'s tenant filter. Expect a P1
candidate with that chain; a non-origin check can confirm it statically. Do not
require a repro for this deterministic case. The changed isolation boundary
needs explicit security coverage, not necessarily an additional reviewer if that
coverage is already present. No approval while the confirmed leak remains.

"No eviction" alone is not another blocking finding without a demonstrated
consequence. Count the leak once, not once per affected line.

## E2 — Request limit parser

No blocking defect established. `Number.isInteger(NaN)` is false; the existing
guard rejects non-numeric, zero, negative, fractional and over-100 inputs. The
request handler converts `RangeError` to HTTP 400. A "missing NaN check" finding
is a false positive; refute it with the guard and do not repair it.

## E3 — Long-press unit test

The delivered test bypasses the shipping scheduler by calling `poll` directly.
The timer sets a flag but does not request a frame. The claimed integration
behavior is not established by that green unit result. Name the idle-path issue
and require evidence through the real event/frame loop before approval if the
no-wake premise cannot be settled statically. Request a bounded author-side probe
with acceptance as the oracle, not another direct call to `poll`.

An execution-only claim stays `needs-evidence` until a non-origin check confirms
it from a relevant pre-fix result. The reviewer does not execute it. An inconclusive
probe is not a fix, and a green private-seam test does not close the gap.

## E4 — Save repair

Keep **`F-save-close` open under the same ID**: rejected `write` still skips
`close`, now via `return`. The repair also introduces a separate swallowed-error
regression: callers see successful completion after a failed save. Report that
as a new candidate with a different ID and repair provenance. Its severity must
be justified from the stated caller contract; do not award points for a status
word while overlooking either failure. Both chains are statically inspectable.
A repair claim is not independent closure.

## E5 — Next action

- **A:** rounds=3, evidence=0, failed same-root attempts=3. No fourth automatic
  repair. Reassess with `F-auth` still blocking; a bounded human-authorized
  continuation may use the once-only Voldemort escalation, preserving all counts.
  It cannot grant a fourth Harry attempt or more than two Voldemort attempts.
- **B:** rounds=1, evidence=1. A second bounded evidence batch is allowed. If it
  confirms the new defect, a second repair/re-review round remains available.
  Do not stop because evidence plus repair supposedly consumed two repair rounds;
  no same-root failure threshold has been reached.
- **C:** rounds=0, evidence=2. Reassess/stop rather than dispatch a third automatic
  probe. Do not approve unresolved required proof or escalate on probe count.
  Continuing needs explicit human authorization, a changed approach and a finite
  budget. Counts remain visible.

Also distinguish an already delivered third repair from a fourth author action:
its closure verdict must still be obtained and may approve the checkpoint. E5
checks decision conformance only; it does not measure real agent convergence.
