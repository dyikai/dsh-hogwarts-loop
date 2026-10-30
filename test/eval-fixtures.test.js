import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

// Execute the actual shipped snippets, not a second copy or prose assertions.
// These fixtures deliberately contain defects. This checks their ground truth,
// not agent quality or enforcement of the textual review process.
const inputs = ['eval-inputs.md', 'eval-legacy-inputs.md'].map((name) =>
  readFileSync(new URL(`../skill/assets/${name}`, import.meta.url), 'utf8'),
).join('\n')

function fixture(id, globals = {}, block = 0) {
  const section = inputs.split(/^## /m).find((part) => part.startsWith(`${id} —`))
  assert.ok(section, `missing case ${id}`)
  const code = [...section.matchAll(/^```js\n([\s\S]*?)^```/gm)][block]?.[1]
  assert.ok(code, `missing JavaScript in ${id}/${block}`)
  const names = [...code.matchAll(/^export (?:async )?function (\w+)/gm)].map((match) => match[1])
  return runInNewContext(
    `${code.replace(/^export /gm, '')}\n({ ${names.join(', ')} })`,
    globals,
    { timeout: 1000 },
  )
}

test('E1 cache hit crosses tenants before the database guard runs', async () => {
  const { search } = fixture('E1')
  const calls = []
  const db = { search: async (tenant, query) => {
    calls.push([tenant, query])
    return [{ owner: tenant }]
  } }
  const first = await search('tenant-a', 'same-query', db)
  const second = await search('tenant-b', 'same-query', db)
  assert.equal(second, first)
  assert.equal(second[0].owner, 'tenant-a')
  assert.deepEqual(calls, [['tenant-a', 'same-query']])
})

test('E2 existing guard rejects invalid limits before calling page', () => {
  const calls = []
  const { list } = fixture('E2', { page: (n) => { calls.push(n); return n } })
  for (const raw of ['abc', '', '0', '-1', '1.5', '101', 'Infinity', undefined]) {
    assert.throws(() => list(raw), { name: 'RangeError', message: 'limit' })
  }
  assert.deepEqual(calls, [])
  assert.equal(list('1'), 1)
  assert.equal(list('100'), 100)
  assert.deepEqual(calls, [1, 100])
})

test('E3 timer alone does not accept; the direct poll makes the supplied test green', () => {
  const timers = []
  const { press, poll } = fixture('E3', { setTimeout: (callback, delay) => {
    assert.equal(delay, 500)
    timers.push(callback)
  } })
  const rec = { armed: false, timerFired: false, accepted: false, lastFrame: 0 }
  press(rec)
  assert.equal(timers.length, 1)
  timers[0]()
  assert.equal(rec.timerFired, true)
  assert.equal(rec.accepted, false)
  poll(rec)
  assert.equal(rec.accepted, true)
  // No real scheduler is exercised: this demonstrates the unit-test gap only.
})

test('E4 original and repair both leak on rejection; repair also hides the error', async () => {
  const failure = new Error('write failed')
  const file = { name: 'fixture' }
  for (const block of [0, 1]) {
    const closed = []
    const { save } = fixture('E4', {
      write: async () => { throw failure },
      close: async (target) => { closed.push(target) },
    }, block)
    if (block === 0) await assert.rejects(save(file), (error) => error === failure)
    else assert.equal(await save(file), undefined)
    assert.deepEqual(closed, [])

    const success = fixture('E4', {
      write: async () => {},
      close: async (target) => { closed.push(target) },
    }, block)
    await success.save(file)
    assert.deepEqual(closed, [file])
  }
})

for (const [snapshot, distinctParents, distinctChildren] of [
  ['L1', 2, 2], ['L2', 4, 2], ['L3', 4, 4],
]) {
  test(`${snapshot} frozen identity replay checks reads, not merely returned roles`, async () => {
    const identify = fixture('L0').createResolver()
    const { caseIds } = fixture(snapshot)
    const parents = new Set()
    const children = new Set()
    const reads = []
    for (const version of ['pre-1.0.4', '1.0.4']) {
      for (const role of ['severus', 'alastor']) {
        const { parentId, childId } = caseIds(version, role)
        parents.add(parentId)
        children.add(childId)
        const identity = await identify(childId, async (id) => {
          assert.equal(id, childId)
          reads.push(`${version}/${role}`)
          return role
        })
        // All snapshots pass the old role assertion, including the faulty ones.
        assert.equal(identity, role)
        assert.equal(await identify(childId, () => assert.fail('immutable child reread')), role)
      }
    }
    assert.equal(parents.size, distinctParents)
    assert.equal(children.size, distinctChildren)
    const expected = ['pre-1.0.4/severus', 'pre-1.0.4/alastor']
    if (snapshot === 'L3') expected.push('1.0.4/severus', '1.0.4/alastor')
    assert.deepEqual(reads, expected)
  })
}
