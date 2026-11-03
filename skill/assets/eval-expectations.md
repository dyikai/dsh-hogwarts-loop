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

- **A:** rounds=3, evidence=0, independent failed attempts=3 on one root. Harry
  reports to Albus, who brings in the read-only advisor with all three approaches
  and failures. Albus may relay the next bounded plan to the same Harry without
  a human budget-extension approval. The ordinary repair cap does not truncate
  eligible guided work. `F-auth` remains blocking until independent closure.
- **B:** rounds=1, evidence=1. A second bounded evidence batch is allowed. If it
  confirms the new defect, a second repair/re-review round remains available.
  Do not stop because evidence plus repair supposedly consumed two repair rounds;
  no same-root failure threshold has been reached.
- **C:** rounds=0, evidence=2. Reassess/stop rather than dispatch a third automatic
  probe. Do not approve unresolved required proof or escalate on probe count.
  Continuing needs explicit human authorization, a changed approach and a finite
  budget. Counts remain visible.

- **D:** cumulative rounds=6, evidence=0, independent failures=3, guided rounds=3.
  Albus returns actual failures to Voldemort for revised advice, reassesses and
  arranges bounded guided round 4; the same Harry implements/tests and Severus
  independently closes. No two-advisor-round, five-total-attempt or three-repair
  cutoff, no counter reset and no recurring human-extension approval. No blind
  repetition; keep the established scope and any mandatory approvals.
- **E:** rounds=3, evidence=0; attempt three succeeded and was independently closed.
  No escalation; follow normal checkpoint approval/commit rules.
- **F:** rounds=3, evidence=0, failed attempts per root=1. No escalation: unrelated
  roots do not sum to three. Ordinary repair cap applies; reassess/stop or obtain
  a finite human-authorized extension, not this problem's collaboration allowance.
- **G:** rounds=0, evidence=2, independent failures=3 for the same stable problem.
  Red gates can end attempts before review; P2 acceptance failures qualify, and
  the precise root need not already be proven. Changed diagnostic hypotheses do
  not reset the history. Albus may relay a bounded diagnostic-only round to the
  same Harry at evidence=2, without requiring code changes or human budget-extension
  approval. Even after three more guided diagnostic rounds (rounds=0, evidence=5,
  independent failures=3, guided rounds=3), Albus may authorize the next bounded
  diagnosis on this same problem. Each needs an evidence-driven new/revised
  hypothesis or diagnostic question, named commands, time/scenario limits and
  decidable signals; Harry executes/reports, Voldemort only analyzes, and Albus
  reassesses before the next round. Preserve totals, validate evidence before
  authorizing repair and obtain Severus's independent closure. Do not blindly
  repeat, hide unbounded retries, or extend this allowance to ordinary C or
  unrelated problems. No approval while the required gate is red.
- **H:** rounds=2, evidence=1, independent failures=2, not seven. Reruns/messages
  and the probe do not add attempts. No escalation yet; a third substantive
  independent implementation is permitted within the ordinary repair budget.

Also obtain the closure verdict on an already delivered third repair; it may
approve the checkpoint. E5 checks declared decision conformance only; it does not
run agents, enforce behavior or measure real agent convergence.
