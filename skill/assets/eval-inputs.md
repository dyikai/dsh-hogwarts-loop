# Synthetic evaluation inputs — targets only

> **Synthetic, not historical.** These are small product examples written for
> this skill. They are not real incidents and they are not a measured
> precision/recall report. Use them only with `review-contract.md`.
>
> Do not read or paste `eval-expectations.md` while acting as the reviewer; the
> answers belong on the scoring side. All cases are deliberately short so one
> evaluator can score them by hand.

For E1–E4, act as the **reporting reviewer**. Give concrete findings, guards checked
and any evidence still needed; distinguish a new candidate from an already
confirmed finding. Do not edit code or run tests. E5 asks for the orchestrator's
next decision, not a new code review. These are smoke cases, not a full-loop run.

## E1 — Tenant cache

Review this synthetic change to a search service.

```js
// search-cache.js (new)
const cache = new Map()

export function cacheKey(_userId, query) {
  return `search:${query}`
}

export async function search(userId, query, db) {
  const key = cacheKey(userId, query)
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const rows = await db.search(userId, query)
  cache.set(key, rows)
  return rows
}
```

The shipping path resolves the tenant from the session, calls
`search(session.userId, req.query.q, db)`, and returns the rows to the caller.
`db.search` itself filters by `userId`. There is no cache invalidation code.

## E2 — Request limit parser

Review this synthetic helper and its call site.

```js
// query.js
export function parseLimit(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new RangeError('limit')
  return n
}

export function list(rawLimit) {
  return page(parseLimit(rawLimit))
}
```

Callers pass the raw query-string value. The service has a request-level error
handler that maps `RangeError` to HTTP 400; nothing else catches it.

## E3 — Long-press unit test

A checkpoint adds a long-press recognizer and reports a green unit suite.

```js
// recognizer.js
export function press(rec) {
  rec.armed = true
  setTimeout(() => {
    rec.timerFired = true
  }, 500)
}

export function poll(rec) {
  if (rec.timerFired) rec.accepted = true
}

// frame-loop.js (shipping path)
export function onFrame(rec, now) {
  if (now - rec.lastFrame >= 16) poll(rec)
}
```

The timer callback only sets `timerFired`; it does not request another frame.
The event loop sleeps until the timer deadline when there is no other work. The
delivered test calls `press(rec)`, advances a fake clock by 500 ms, calls
`poll(rec)` directly, and asserts `rec.accepted === true`.

Review the delivery. State what evidence, if any, is still required before this
checkpoint can be approved.

## E4 — Save repair

The original code was:

```js
export async function save(file) {
  await write(file)
  await close(file)
}
```

The prior independently confirmed finding `F-save-close` (P2) says a failed
`write` leaves the handle open. The author claims this repair fixes it:

```js
export async function save(file) {
  try {
    await write(file)
  } catch {
    return
  }
  await close(file)
}
```

Callers treat a normal return as a successful save. Review the repair increment
and the affected path, not the rest of the module.

## E5 — Next action

Treat these as independent checkpoint histories, using the default budgets and
one-root advisor-guided precedence. The facts below are supplied, not discoveries:

- **A:** Three author repairs each received an independent re-review. The same
  confirmed P1 authorization defect `F-auth` remains open after the third verdict.
  Harry has failed three implementation attempts on that root. No evidence-only
  batches have been needed; Voldemort has not been used.
- **B:** One runtime defect used one evidence-only batch, then a successful repair
  and re-review. That re-review found a different candidate whose scheduling
  premise needs execution. No implementation attempt failed on the new root.
- **C:** Two bounded evidence-only batches failed to settle a required timing
  question. No repair has been attempted; the question still blocks acceptance.
- **D:** A's problem has since had three advisor-guided Harry implementations,
  each with a changed hypothesis, substantive code changes, bounded validation
  and an independent failing re-review. It is still open. Voldemort supplied only
  advice through Albus, and Harry's existing child did every edit and test. No
  evidence-only batches have been used. There is no human stop or real blocker.
- **E:** Independent attempt three on one problem passed its gates and Severus
  independently closed it. Three completed repair/re-review rounds, no probes.
- **F:** Three completed failed repair/re-review rounds concern three unrelated
  root causes: one substantive independent attempt per root, no probes.
- **G:** Harry's three different implementations for one P2 acceptance failure
  each ended with the required gate red, before review. Two earlier evidence-only
  batches have been used. The failure is stable but its precise root cause remains
  unproven; the three attempts tested different diagnostic hypotheses. Harry has
  reported and Albus has legitimately introduced Voldemort. Based on actual
  evidence, the advisor proposes a new diagnostic question that must be settled
  before choosing a safe repair: named commands, time/scenario limits and decidable
  signals, no code edits. First decide at guided rounds=0. Then decide again after
  three such bounded diagnostic rounds, each reassessed from actual results with
  a new/revised question; evidence=5, guided rounds=3, the same acceptance failure
  remains, and the advisor has a further evidence-driven bounded diagnostic plan.
  There is no human stop or real external blocker; no unrelated defect is involved.
- **H:** Harry has two substantive failed implementations on one problem, followed
  by four command reruns, progress messages and one evidence-only probe. No third
  implementation or re-review has occurred; rounds=2, evidence=1.

- **I:** Guided problem `F-auth` has met its scoped exit verification: Harry supplied
  target-gate/affected-path evidence and the repair snapshot; Severus independently
  confirmed closure. The checkpoint still has unfinished work and a red gate
  demonstrably caused only by an unrelated feature.
- **J:** After I, a different problem `F-cache` has zero failures, then one failed
  independent implementation. Later it has three genuine independent failures of
  its own. The existing Voldemort child retains `F-auth` history throughout.
- **K:** Harry proposes closing the guided problem but its required target gate
  remains red, or the remaining red cannot be clearly attributed to unrelated work.
  Some other checkpoint tests pass; Voldemort believes the fix is sufficient.

For each history, give the current counters, next permitted action and any required
approval. Explain whether escalation is applicable. Do not change the histories.
