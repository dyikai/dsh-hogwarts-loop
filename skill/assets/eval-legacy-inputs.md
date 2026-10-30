# Repository-derived session-identity case — inputs only

Give the evaluated reviewer the shared context and **one** snapshot at a time.
Do not expose the other snapshots, provenance, expectations or test answers.
For independent paired runs, use fresh contexts and neutral snapshot labels.
The scorer's protocol is in `eval-legacy-expectations.md`.

## L0 — Shared context

The application has immutable child-session histories and globally unique child
IDs. It caches a child's decoded role by child ID; parent IDs are not cache keys.
The code below reduces that read/cache path, not the complete dispatcher:

```js
export function createResolver() {
  const cache = new Map()
  return async function identify(childId, readFirstTask) {
    const cached = cache.get(childId)
    if (cached !== undefined) return cached
    const identity = await readFirstTask(childId)
    cache.set(childId, identity)
    return identity
  }
}
```

A compatibility test uses **one resolver across all cases**, as a single imported
module would. For each case it creates a fresh fake parent and query service. The
fake query supplies that version's frozen prompt; `readFirstTask` reads it and
returns its decoded role. Cases run sequentially, awaited, for `pre-1.0.4` and
then `1.0.4`, using roles `severus` and `alastor`. Both versions' prompts are valid.

The test computes its fake IDs with the supplied snapshot. It then calls
`identify(childId, readFirstTask)` and asserts that the expected role is returned.
Each version must exercise **its own** frozen prompt, not another case's evidence.
The production cache is intentional: immutable real sessions may be read once.
Review test isolation, not a hypothetical collision of real session IDs.

## L1 — Snapshot A

```js
export function caseIds(version, role) {
  return {
    parentId: `parent-frozen-${role}`,
    childId: `frozen-${role}`,
  }
}
```

Review against the shared contract. Report any blocking defect with its causal
chain and the guard checked, or explain why no blocking defect is established.

## L2 — Snapshot B

```js
export function caseIds(version, role) {
  return {
    parentId: `parent-frozen-${version}-${role}`,
    childId: `frozen-${role}`,
  }
}
```

Review this increment and existing findings against the same contract. State which
findings remain or can close, why, and whether another repair is necessary.

## L3 — Snapshot C

```js
export function caseIds(version, role) {
  return {
    parentId: `parent-frozen-${version}-${role}`,
    childId: `frozen-${version}-${role}`,
  }
}
```

Review this increment and existing findings against the same contract. State which
findings remain or can close, why, and whether another repair is necessary.
