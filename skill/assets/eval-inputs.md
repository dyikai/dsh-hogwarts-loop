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

Treat these as three independent checkpoint histories, using the default budgets:

- **A:** Three author repairs each received an independent re-review. The same
  confirmed P1 authorization defect `F-auth` remains open after the third verdict.
  Harry has failed three implementation attempts on that root. No evidence-only
  batches have been needed; Voldemort has not been used.
- **B:** One runtime defect used one evidence-only batch, then a successful repair
  and re-review. That re-review found a different candidate whose scheduling
  premise needs execution. No implementation attempt failed on the new root.
- **C:** Two bounded evidence-only batches failed to settle a required timing
  question. No repair has been attempted; the question still blocks acceptance.

For each history, give the current counters, next permitted action and any required
approval. Explain whether escalation is applicable. Do not change the histories.
