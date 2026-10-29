# Synthetic evaluation expectations — scoring side

> **Synthetic, not historical.** These are product examples, not incidents and
> not a measured benchmark. Keep this file away from the reviewer prompt and the
> target workspace; it exists so a human or local evaluator can score a report
> against expected outcomes without leaking answers into `eval-inputs.md`.

Score by defect and required decision, not by prose similarity. A report that
finds the right defect with the wrong evidence status is not a full credit: the
contract's point is that severity, evidence status, and disposition stay
distinct.

## E1 — Tenant cache

- **Expected defect:** cross-tenant disclosure. Tenant A's rows for a query are
  cached under a key that ignores the tenant; tenant B issuing the same query
  gets A's cached rows. `db.search` filtering by `userId` does not help because
  the cache hit happens before it.
- **Provenance:** `cp-introduced` (the cache is new in this change).
- **Stage / evidence:** the reviewer's report is a `candidate` with a complete
  static chain — not `confirmed` at report time. The non-origin validator may
  confirm it statically from the chain plus the guard check; if execution is
  truly required, it authorizes a two-tenant repro **before repair** and confirms
  from that red evidence. Requiring `confirmed` from the original reporter is a
  scoring miss.
- **Severity / disposition:** `P1` once confirmed / `fix-required`; closure only
  after independent re-review of the fixed state (`closed-fixed`).
- **Record:** file:line on the cache key; trigger "two tenants, same query";
  guard checked: none exists; validation evidence: static chain or the bounded
  two-tenant repro through the real search entrypoint.
- **Security route:** a sensitive surface (cross-tenant data) is named, so the
  scoped security lens is required and the candidate is in the validation batch.
- **No waiver:** a confirmed P1 is never waived. Approving this checkpoint is a
  miss.
- **Noise:** do not add blocking findings for "cache has no eviction" unless the
  scenario demonstrates a consequence; an unbounded-growth observation is at
  most P3 here.

## E2 — Request limit parser

- **Expected defect:** none blocking. `Number(raw)` yields `NaN` for non-numeric
  input; `Number.isInteger(NaN)` is `false`, so the guard rejects it. Negative,
  zero, fractional, and greater-than-100 inputs are also rejected by the
  existing guard. The `RangeError` reaches the 400 handler.
- **Severity / evidence / disposition:** no P1/P2. If a reviewer posts the
  "missing NaN check" claim, the correct resolution is `refuted` with the guard
  counterexample; a wording/style note may be `P3` and carried.
- **Validator action:** check the guard, close the candidate, do not relay a
  repair. A false-positive finding here is noise for the eval.
- **Noise:** this case tests that an existing guard is recognized, not that every
  input is enumerated.

## E3 — Long-press unit test

- **Expected defect:** the delivered green test bypasses the shipping entrypoint
  (`poll` called directly). On the idle path the timer callback sets
  `timerFired` but requests no frame, so `poll` never runs and the long press is
  never accepted. The unit suite cannot detect this.
- **Severity / evidence / disposition:** `P1` once confirmed. At report time the
  finding is `candidate`. A non-origin validator may confirm a complete static
  no-wake chain if the scheduling claim is fully established by source; if that
  runtime claim needs execution, it is `needs-evidence` and E authorizes
  **evidence collection only** — an integration test through the real frame loop
  that drives the idle interval and asserts acceptance. Either way, approval is
  blocked until confirmation; no repair before that.
- **Approval:** must not approve. "All tests pass" is not evidence for the
  untouched path, and zero confirmed findings does not clear unresolved required
  verification.
- **Prove-or-refute shape:** request names the reviewed snapshot, the idle input
  (press, no events, advance 500 ms), the real frame-loop entrypoint, the oracle
  `accepted === true`, and the pre-fix red evidence (then the green after the
  authorized fix if the repro route is required).
- **Escaped-defect note:** if this checkpoint were approved and the long press
  failed in use, that is an escaped defect; record it, do not call it proof that
  the reviewer was wrong in general.
- **Noise:** do not require an executable test for every deterministic static
  claim; here the runtime scheduling path is the point.

## E4 — Save repair

- **Two findings, two stable IDs.**
- **Original leak (same ID; still open):** on a rejected `write`, the repaired
  `catch { return }` returns before `await close(file)`, so the handle is still
  leaked. The repair did **not** fix the reported leak. Keep the original stable
  ID open; if a prior round wrongly closed it, reopen that same ID with the newly
  checked evidence. Never post a duplicate leak finding and never erase the old
  bug. Its original blocking severity is unchanged.
- **Repair-introduced regression (new ID):** swallowing the `write` error makes
  `save` return normally, so callers record a successful save even though data
  was never written. This is a fresh, distinct finding — not a duplicate of the
  leak — provenance `repair-introduced`.
- **Stage / evidence:** the new regression starts as `candidate` with a clear
  static chain. The non-origin validator may confirm it statically from the
  `catch`/return path; if execution is truly required, it authorizes a forced
  `write`-rejection repro **before repair** and confirms from the red evidence.
  Requiring `confirmed` from the reporting reviewer is a scoring miss.
- **Severity / disposition:** the silent-success regression is `P1` once
  confirmed / `fix-required` / never waived. The leak stays blocking at its
  original severity. Closure for either requires independent re-review of the
  fixed state; Harry's F report cannot self-close them.
- **Scope check:** look for the same class of early-return/swallowed-error on the
  adjacent cleanup path; route anything outside this increment explicitly.
- **Validator action:** re-derive the leak and the new success-path chain; if a
  repro is required, inspect the real `save` entrypoint, forced write failure,
  oracle and pre-fix stamp. Do not accept a direct catch-only unit test as proof
  of the caller-visible consequence.
- **Noise:** do not merge the two consequences into one finding; do not report the
  original leak as a new P1; do not close the original because the code changed.

## E5 — Third cycle

- **Expected decision:** the checkpoint has reached the three-cycle convergence
  cap with blocking findings unresolved. Stop the automatic next
  review/response cycle; do not dispatch a fourth automatic cycle.
- **Counters:** preserve the checkpoint cycle counter at 3 (cap reached) and the
  same-root Harry attempt counter at 3. Do not reset either by re-scoping,
  renaming, swapping the reviewer, or escalating.
- **F4:** triage and route the newly confirmed P1. It must not be dropped to hit
  the cap; it remains blocking and its security lens/validation is in the batch.
- **Escalation:** because the same root has had three failed Harry attempts, the
  once-only Voldemort escalation is eligible, but it must be part of the explicit
  reassessment decision, is capped at two attempts, and does not authorize more
  review cycles by itself. If both limits apply, the stricter limit wins: no
  fourth Harry, no third Voldemort, no automatic cycle past the cap.
- **Explicit record:** the reassessment names the unresolved IDs and statuses,
  the approach/scope/reviewer-churn diagnosis, the bounded authorization (owner,
  remaining budget, stop condition) or the stop-and-report decision.
- **Approval:** none. A request to "just run one more review" without the
  recorded authorization is the auto-reset loophole.
- **Noise:** do not escalate merely because three cycles passed; escalation
  requires the same-root failure evidence, not churn alone.

## Scoring notes

For each case record:

- expected blocking defect found and correctly classified (severity, evidence,
  disposition);
- false positives on the guarded case (E2) and avoidable duplicate postings;
- whether the stage route was right: E1/E4 start `candidate` then confirm
  statically or via required pre-fix repro; E3 is `needs-evidence` when the
  runtime scheduling claim is not proven; E5 keeps its supplied confirmed input;
- whether stable IDs and provenance were preserved (E4: original leak ID stays
  open, repair regression gets a new ID; E5);
- convergence cycles used, if the case was run as a sequence.

Compare only runs over the same frozen target snapshots with the non-treatment
variables held equal; record exactly which prompt/model/tool/config intentionally
differs. Do not report a measured model score unless the protocol was actually
executed.
