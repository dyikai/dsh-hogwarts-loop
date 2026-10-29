# Synthetic evaluation inputs — targets only

> **Synthetic, not historical.** These are small product examples written for
> this skill. They are not real incidents and they are not a measured
> precision/recall report. Use them only with `review-contract.md`.
>
> Do not read or paste `eval-expectations.md` while acting as the reviewer; the
> answers belong on the scoring side. All cases are deliberately short so one
> evaluator can score them by hand.

For each case, act as the **reporting reviewer**: produce findings with stable
IDs, severity, evidence status, disposition, the required record fields, and the
next evidence step. Report a new finding as `candidate` unless the case itself
states it is already independently confirmed; confirmation and closure are
separate stages (`review-contract.md`). Do not edit code and do not run builds or
tests.

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

A finding reported that a failed `write` leaves the handle open, so the repair
changed it to:

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

## E5 — Third cycle

One checkpoint has completed three review/response cycles:

- cycle 1: F1 (`P2`) confirmed and fixed;
- cycle 2: F2 (`P2`) confirmed and fixed, F3 (`P3`) recorded;
- cycle 3: F4 (`P1`, security) confirmed on the new repair path; the verdict is
  still REQUEST-CHANGES;
- the same "error handling" root has now had three Harry attempts and the third
  attempt still has an open blocking finding.

No approval has been issued. Review the next action. State the counters you
would preserve, whether any automatic dispatch is allowed, what happens to F4,
and whether escalation is available. Do not mark the checkpoint approved.
