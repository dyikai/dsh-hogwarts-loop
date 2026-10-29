import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_ROLES,
  HogwartsDispatchError,
  PROJECTION_KEY,
  composePrompt,
  createDispatcher,
  makeBindingsProjection,
  parseDispatchResultText,
  parseRoleLabel,
  resolveRoleBinding,
  textOfContent,
} from '../index.js'

/* ------------------------------------------------------------------ *
 * Fakes for the exact service contracts used by the dispatcher.
 * ------------------------------------------------------------------ */

class FakeSession {
  constructor(id, { inheritedEventCount = 0, inheritedEvents = [], header = {} } = {}) {
    this.id = id
    this.inheritedEventCount = inheritedEventCount
    this.header = { id, version: 4, createdAt: 0, isSeeded: inheritedEventCount > 0, ...header }
    this.events = [...inheritedEvents]
    this.seq = this.events.length
  }

  append(type, data) {
    const event = { type, seq: this.seq, time: this.seq, data }
    this.seq += 1
    this.events.push(event)
    return event
  }

  catalog(childId, { label = '', mode = 'continuable', createdAt = 1, version = 0 } = {}) {
    return this.append('subagent/catalog', { version, childId, childCreatedAt: createdAt, mode, label })
  }
}

class ProjectionHost {
  constructor() {
    this.defs = new Map()
    this.failStateOf = false
  }

  register(definition) {
    this.defs.set(definition.key, definition)
    return () => {
      if (this.defs.get(definition.key) === definition) this.defs.delete(definition.key)
    }
  }

  stateOf(session, key) {
    if (this.failStateOf) throw new Error('projection read failed')
    const definition = this.defs.get(key)
    if (definition === undefined) return undefined
    let state = definition.init(session.header, session.inheritedEventCount)
    for (const event of session.events) state = definition.apply(state, event)
    return definition.stateSchema.parse(state)
  }
}

class FakeSubagents {
  constructor() {
    this.providers = {
      spawn: {
        name: 'spawn',
        capabilities: { agentOptions: true, agentPreset: false, outputSchema: false, depthLimit: true },
        inheritsParentContext: false,
        async prepareContinuable() {
          return {}
        },
      },
    }
    this.startCalls = []
    this.sendCalls = []
    this.nextId = 1
    this.beforePublish = null
    this.afterPublish = null
    this.sendError = null
  }

  getProvider(name) {
    return this.providers[name]
  }

  list() {
    return Object.keys(this.providers)
  }

  resolveMaxDepth(configured) {
    return configured
  }

  async startActivation(spec) {
    this.startCalls.push(spec)
    const childId = spec.childId ?? `child-${this.nextId++}`
    if (this.beforePublish !== null) await this.beforePublish(spec, childId)
    spec.request.parent.session.append('subagent/catalog', {
      version: 0,
      childId,
      childCreatedAt: Date.now(),
      mode: 'continuable',
      label: spec.label,
    })
    if (this.afterPublish !== null) await this.afterPublish(spec, childId)
    return {
      childId,
      messageId: `message-${childId}`,
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      dispose: async () => {},
    }
  }

  async sendMessage(sender, childId, content, options) {
    this.sendCalls.push({ sender, childId, content, options })
    if (this.sendError !== null) throw this.sendError
    return `message-${this.sendCalls.length}`
  }
}

class FakeLlm {
  constructor() {
    this.providers = [{ id: 'deepseek-official' }]
    this.resolved = []
  }

  listProviders() {
    return this.providers
  }

  async resolveModelInfo(provider, model) {
    this.resolved.push({ provider, model })
    if (model === 'bad-model') throw new Error('model is not served')
    return { provider, model }
  }
}

class FakeSessionQuery {
  constructor() {
    this.sessions = new Map()
  }

  add(childId, { events, inheritedEventCount = 0 }) {
    this.sessions.set(childId, {
      session: { id: childId, version: 4, createdAt: 0, isSeeded: inheritedEventCount > 0 },
      inheritedEventCount,
      events,
    })
  }

  async readSession(childId) {
    const snapshot = this.sessions.get(childId)
    if (snapshot === undefined) throw new Error(`no persisted session ${childId}`)
    return snapshot
  }
}

function makeConfig() {
  return {
    delegation: { provider: 'spawn', maxDepth: 1 },
    roles: Object.fromEntries(
      Object.entries(DEFAULT_ROLES).map(([role, defaults]) => [
        role,
        {
          provider: defaults.provider,
          model: defaults.model,
          reasoningEffort: '',
          maxTokens: undefined,
        },
      ]),
    ),
  }
}

function makeCtx(options = {}) {
  const projections = options.projections ?? new ProjectionHost()
  projections.register(makeBindingsProjection())
  const subagents = options.subagents ?? new FakeSubagents()
  const sessionQuery = options.sessionQuery ?? new FakeSessionQuery()
  const llm = options.llm ?? new FakeLlm()
  const ctx = {
    sessionProjections: projections,
    subagents,
    llm,
    get(name) {
      return name === 'sessionQuery' ? sessionQuery : undefined
    },
    effect(fn) {
      const disposer = fn()
      return typeof disposer === 'function' ? disposer : () => {}
    },
    skills: { register: () => () => {} },
    tools: { register: () => () => {} },
  }
  return { ctx, projections, subagents, sessionQuery, llm }
}

function makeExec(parent, signal = new AbortController().signal) {
  return { agent: { id: parent.id, session: parent }, signal }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/* ------------------------------------------------------------------ *
 * Pure helpers.
 * ------------------------------------------------------------------ */

test('label parsing separates role identity from the per-dispatch description', () => {
  const roles = new Set(Object.keys(DEFAULT_ROLES))
  assert.deepEqual(parseRoleLabel('hogwarts:harry · checkpoint 3 build', roles), {
    marked: true,
    role: 'harry',
  })
  assert.deepEqual(parseRoleLabel('hogwarts:harry', roles), { marked: true, role: 'harry' })
  assert.deepEqual(parseRoleLabel('checkpoint 3 build', roles), { marked: false, role: null })
  assert.deepEqual(parseRoleLabel('hogwarts:gandalf · old', roles), {
    marked: true,
    role: null,
    unknownRole: true,
  })
})

test('dispatch result text is parsed for both started and continued renders', () => {
  assert.deepEqual(
    parseDispatchResultText('started harry on spawn/deepseek-flash as subagent child-1'),
    { action: 'started', role: 'harry', childId: 'child-1' },
  )
  assert.deepEqual(parseDispatchResultText('continued harry as subagent child-1'), {
    action: 'continued',
    role: 'harry',
    childId: 'child-1',
  })
  assert.equal(parseDispatchResultText('unrelated output'), null)
  assert.equal(textOfContent([{ type: 'text', text: 'a' }, { type: 'thinking', text: 'b' }]), 'a')
  assert.equal(
    composePrompt('persona', 'brief'),
    'persona\n\n---\n\nbrief',
  )
})

test('the host-only projection has the documented key and folds only own events', () => {
  const projection = makeBindingsProjection()
  assert.equal(projection.key, PROJECTION_KEY)
  assert.equal(projection.stateVersion, 2)
  const session = new FakeSession('fork-projection', { inheritedEventCount: 0 })
  let state = projection.init(session.header, 0)
  state = projection.apply(state, {
    type: 'subagent/catalog',
    seq: 0,
    data: { version: 0, childId: 'a', childCreatedAt: 1, mode: 'continuable', label: 'hogwarts:harry · CP1' },
  })
  assert.equal(state.catalog.length, 1)
  // A fork reads the same event with an inherited prefix: it must not adopt it.
  const forked = projection.init(session.header, 1)
  assert.equal(
    projection.apply(forked, {
      type: 'subagent/catalog',
      seq: 0,
      data: { version: 0, childId: 'a', childCreatedAt: 1, mode: 'continuable', label: 'hogwarts:harry · CP1' },
    }),
    forked,
  )
})

/* ------------------------------------------------------------------ *
 * Sequential checkpoints and identity.
 * ------------------------------------------------------------------ */

test('sequential checkpoints continue the same child and never start a second one', async () => {
  const parent = new FakeSession('parent-sequential')
  const { ctx, subagents } = makeCtx()
  const dispatch = createDispatcher(ctx, makeConfig())

  const first = await dispatch.execute(
    { role: 'harry', description: 'CP1 build', prompt: 'build checkpoint 1' },
    makeExec(parent),
  )
  assert.equal(first.action, 'started')
  assert.equal(first.provider, 'deepseek-official')
  assert.equal(first.model, 'deepseek-flash')
  assert.match(first.childId, /^child-/)
  assert.equal(subagents.startCalls.length, 1)
  assert.match(subagents.startCalls[0].label, /^hogwarts:harry · CP1 build$/)
  assert.equal(subagents.startCalls[0].provider, 'spawn')
  assert.equal(subagents.startCalls[0].delivery, 'parent')
  assert.equal(subagents.startCalls[0].request.maxDepth, 1)
  assert.equal(subagents.startCalls[0].request.agentOptions.model, 'deepseek-flash')
  assert.match(textOfContent(subagents.startCalls[0].request.prompt), /^You are Harry/)
  assert.match(textOfContent(subagents.startCalls[0].request.prompt), /build checkpoint 1$/)

  const second = await dispatch.execute(
    { role: 'harry', description: 'CP2 build', prompt: 'build checkpoint 2' },
    makeExec(parent),
  )
  assert.deepEqual(second, { role: 'harry', action: 'continued', childId: first.childId })
  assert.equal(subagents.startCalls.length, 1)
  assert.equal(subagents.sendCalls.length, 1)
  assert.equal(subagents.sendCalls[0].childId, first.childId)
  assert.deepEqual(subagents.sendCalls[0].content, [{ type: 'text', text: 'build checkpoint 2' }])

  const third = await dispatch.execute(
    { role: 'harry', description: 'CP2 fix round', prompt: 'fix the review findings' },
    makeExec(parent),
  )
  assert.equal(third.action, 'continued')
  assert.equal(third.childId, first.childId)
  assert.equal(subagents.startCalls.length, 1)
})

test('config changes do not replace a child and a continued result does not claim the new route', async () => {
  const parent = new FakeSession('parent-config-change')
  const { ctx, subagents, llm } = makeCtx()
  const config = makeConfig()
  const dispatch = createDispatcher(ctx, config)

  const first = await dispatch.execute(
    { role: 'harry', description: 'CP1', prompt: 'build' },
    makeExec(parent),
  )
  assert.equal(first.provider, 'deepseek-official')
  assert.equal(first.model, 'deepseek-flash')

  config.roles.harry = {
    provider: 'not-registered',
    model: 'not-served',
    reasoningEffort: 'max',
    maxTokens: 4096,
  }

  const second = await dispatch.execute(
    { role: 'harry', description: 'CP2', prompt: 'build again' },
    makeExec(parent),
  )
  assert.equal(second.action, 'continued')
  assert.equal(second.childId, first.childId)
  assert.equal(second.provider, undefined)
  assert.equal(second.model, undefined)
  // The invalid new route was never consulted: the existing child owns its route.
  assert.equal(llm.resolved.length, 1)
  assert.equal(subagents.startCalls.length, 1)
})

test('idle/resume or a fresh plugin activation recovers the binding from the session log', async () => {
  const parent = new FakeSession('parent-reactivation')
  const subagents = new FakeSubagents()
  const firstHost = new ProjectionHost()
  const firstCtx = makeCtx({ subagents, projections: firstHost })
  const first = await createDispatcher(firstCtx.ctx, makeConfig()).execute(
    { role: 'harry', description: 'CP1', prompt: 'build' },
    makeExec(parent),
  )
  assert.equal(first.action, 'started')

  // A second activation is a fresh projection host and a fresh dispatcher:
  // there is no in-memory binding to reuse.
  const secondHost = new ProjectionHost()
  const secondCtx = makeCtx({ subagents, projections: secondHost })
  const second = await createDispatcher(secondCtx.ctx, makeConfig()).execute(
    { role: 'harry', description: 'CP2', prompt: 'build next' },
    makeExec(parent),
  )
  assert.equal(second.action, 'continued')
  assert.equal(second.childId, first.childId)
  assert.equal(subagents.startCalls.length, 1)
  assert.equal(subagents.sendCalls.length, 1)
})

test('distinct parents and distinct roles remain independent', async () => {
  const parentA = new FakeSession('parent-a')
  const parentB = new FakeSession('parent-b')
  const { ctx, subagents } = makeCtx()
  const dispatch = createDispatcher(ctx, makeConfig())

  const harryA = await dispatch.execute({ role: 'harry', prompt: 'A harry' }, makeExec(parentA))
  const harryB = await dispatch.execute({ role: 'harry', prompt: 'B harry' }, makeExec(parentB))
  const severusA = await dispatch.execute({ role: 'severus', prompt: 'A severus' }, makeExec(parentA))
  const harryAAgain = await dispatch.execute({ role: 'harry', prompt: 'A harry again' }, makeExec(parentA))

  assert.equal(subagents.startCalls.length, 3)
  assert.equal(subagents.sendCalls.length, 1)
  assert.notEqual(harryA.childId, harryB.childId)
  assert.notEqual(harryA.childId, severusA.childId)
  assert.equal(harryAAgain.childId, harryA.childId)
  assert.equal(subagents.sendCalls[0].childId, harryA.childId)
})

/* ------------------------------------------------------------------ *
 * Concurrency and cancellation.
 * ------------------------------------------------------------------ */

test('same-parent concurrent calls create at most one child', async () => {
  const parent = new FakeSession('parent-concurrent')
  const { ctx, subagents } = makeCtx()
  const dispatch = createDispatcher(ctx, makeConfig())
  const gate = deferred()
  subagents.beforePublish = async () => {
    await gate.promise
  }

  const firstPromise = dispatch.execute({ role: 'harry', prompt: 'first' }, makeExec(parent))
  const secondPromise = dispatch.execute({ role: 'harry', prompt: 'second' }, makeExec(parent))
  await tick()
  assert.equal(subagents.startCalls.length, 1, 'the second call must wait for the first')

  gate.resolve()
  const [first, second] = await Promise.all([firstPromise, secondPromise])
  assert.equal(first.action, 'started')
  assert.equal(second.action, 'continued')
  assert.equal(second.childId, first.childId)
  assert.equal(subagents.startCalls.length, 1)
  assert.equal(subagents.sendCalls.length, 1)
  assert.equal(subagents.sendCalls[0].childId, first.childId)
})

test('an aborted queued call rejects promptly, releases its lock, and does not create a child', async () => {
  const parent = new FakeSession('parent-cancel-queue')
  const { ctx, subagents } = makeCtx()
  const dispatch = createDispatcher(ctx, makeConfig())
  const gate = deferred()
  subagents.beforePublish = async () => {
    await gate.promise
  }

  const firstPromise = dispatch.execute({ role: 'harry', prompt: 'first' }, makeExec(parent))
  await tick()
  assert.equal(subagents.startCalls.length, 1)

  const controller = new AbortController()
  const secondPromise = dispatch.execute(
    { role: 'harry', prompt: 'second' },
    makeExec(parent, controller.signal),
  )
  await tick()
  controller.abort(new Error('user cancelled the queued dispatch'))
  await assert.rejects(secondPromise, /user cancelled the queued dispatch/)
  assert.equal(subagents.startCalls.length, 1, 'the queued call never starts a child')

  // An aborted queued caller must not delete the mutex while the first call is
  // still running: a third call has to wait, not start beside it.
  subagents.beforePublish = null
  const thirdPromise = dispatch.execute({ role: 'harry', prompt: 'third' }, makeExec(parent))
  await tick()
  assert.equal(subagents.startCalls.length, 1, 'the third call waits for the running first call')

  gate.resolve()
  const first = await firstPromise
  assert.equal(first.action, 'started')
  const third = await thirdPromise
  assert.equal(third.action, 'continued')
  assert.equal(third.childId, first.childId)
  assert.equal(subagents.startCalls.length, 1)
  assert.equal(subagents.sendCalls.length, 1)
})

/* ------------------------------------------------------------------ *
 * Creation failure windows.
 * ------------------------------------------------------------------ */

test('a pre-publication creation failure is retryable and does not leave a binding', async () => {
  const parent = new FakeSession('parent-prepublication')
  const { ctx, subagents } = makeCtx()
  const dispatch = createDispatcher(ctx, makeConfig())
  let failOnce = true
  subagents.beforePublish = async () => {
    if (failOnce) {
      failOnce = false
      throw new Error('provider rejected the start before publication')
    }
  }

  await assert.rejects(
    dispatch.execute({ role: 'harry', prompt: 'first' }, makeExec(parent)),
    /provider rejected the start before publication/,
  )
  assert.equal(parent.events.filter((event) => event.type === 'subagent/catalog').length, 0)

  const retry = await dispatch.execute({ role: 'harry', prompt: 'retry' }, makeExec(parent))
  assert.equal(retry.action, 'started')
  assert.equal(subagents.startCalls.length, 2)
  assert.equal(parent.events.filter((event) => event.type === 'subagent/catalog').length, 1)
})

test('a start failure whose binding log cannot be read is not blindly retryable', async () => {
  const parent = new FakeSession('parent-publication-uncertain')
  const { ctx, subagents, projections } = makeCtx()
  const dispatch = createDispatcher(ctx, makeConfig())
  subagents.beforePublish = async () => {
    projections.failStateOf = true
    throw new Error('start rejected before the caller could observe publication')
  }

  await assert.rejects(
    dispatch.execute({ role: 'harry', prompt: 'first' }, makeExec(parent)),
    (error) => {
      assert.ok(error instanceof HogwartsDispatchError)
      assert.equal(error.code, 'PUBLICATION_UNCERTAIN')
      assert.match(error.message, /Do not retry blindly/)
      return true
    },
  )
  assert.equal(subagents.startCalls.length, 1)
  assert.equal(parent.events.filter((event) => event.type === 'subagent/catalog').length, 0)
})

test('catalog append followed by startup rollback reports failure and preserves the child binding', async () => {
  const parent = new FakeSession('parent-postpublication')
  const { ctx, subagents } = makeCtx()
  const dispatch = createDispatcher(ctx, makeConfig())
  const failure = new Error('catalog committed but startup rolled back')
  let disposed = false
  subagents.afterPublish = async () => {
    disposed = true // submitMaterialized disposes before rejecting in the real runtime.
    throw failure
  }

  await assert.rejects(
    dispatch.execute({ role: 'harry', prompt: 'first' }, makeExec(parent)),
    error => {
      assert.equal(error.code, 'START_FAILED_WITH_BINDING')
      assert.equal(error.cause, failure)
      assert.match(error.message, /child-1/)
      assert.match(error.message, /success is not confirmed/)
      return true
    },
  )
  assert.equal(disposed, true)
  assert.equal(subagents.startCalls.length, 1)
  assert.equal(parent.events.filter(event => event.type === 'subagent/catalog').length, 1)
  assert.equal(subagents.sendCalls.length, 0, 'a failed start must not automatically replay the task')

  const second = await dispatch.execute({ role: 'harry', prompt: 'retry after inspecting child' }, makeExec(parent))
  assert.equal(second.action, 'continued')
  assert.equal(second.childId, 'child-1')
  assert.equal(subagents.startCalls.length, 1)
})

test('a continuation failure is reported and never respawns the role', async () => {
  const parent = new FakeSession('parent-continuation-failure')
  const { ctx, subagents } = makeCtx()
  const dispatch = createDispatcher(ctx, makeConfig())
  const first = await dispatch.execute({ role: 'harry', prompt: 'first' }, makeExec(parent))
  subagents.sendError = new Error('the child session is unavailable')

  await assert.rejects(
    dispatch.execute({ role: 'harry', prompt: 'second' }, makeExec(parent)),
    (error) => {
      assert.ok(error instanceof HogwartsDispatchError)
      assert.equal(error.code, 'CONTINUATION_FAILED')
      assert.match(error.message, /Refusing to start a replacement/)
      return true
    },
  )
  assert.equal(subagents.startCalls.length, 1)
  assert.equal(first.action, 'started')

  // The failed continuation released its lock; the same child can be retried
  // without creating a replacement.
  subagents.sendError = null
  const retry = await dispatch.execute({ role: 'harry', prompt: 'second retry' }, makeExec(parent))
  assert.equal(retry.action, 'continued')
  assert.equal(retry.childId, first.childId)
  assert.equal(subagents.startCalls.length, 1)
  assert.equal(subagents.sendCalls.length, 2)
})

test('an aborted continuation rejects as cancelled and never respawns', async () => {
  const parent = new FakeSession('parent-abort-continuation')
  const { ctx, subagents } = makeCtx()
  const dispatch = createDispatcher(ctx, makeConfig())
  const first = await dispatch.execute({ role: 'harry', prompt: 'first' }, makeExec(parent))

  const controller = new AbortController()
  const originalSend = subagents.sendMessage.bind(subagents)
  subagents.sendMessage = async () => {
    controller.abort(new Error('cancelled mid-continuation'))
    throw controller.signal.reason
  }
  await assert.rejects(
    dispatch.execute({ role: 'harry', prompt: 'second' }, makeExec(parent, controller.signal)),
    /cancelled mid-continuation/,
  )
  assert.equal(subagents.startCalls.length, 1, 'an aborted continuation never starts a replacement')

  subagents.sendMessage = originalSend
  const retry = await dispatch.execute({ role: 'harry', prompt: 'second retry' }, makeExec(parent))
  assert.equal(retry.action, 'continued')
  assert.equal(retry.childId, first.childId)
  assert.equal(subagents.startCalls.length, 1)
})

/* ------------------------------------------------------------------ *
 * cwd contract.
 * ------------------------------------------------------------------ */

test('cwd is creation-only; a continuation rejects retargeting instead of silently ignoring it', async () => {
  const parent = new FakeSession('parent-cwd')
  const { ctx, subagents } = makeCtx()
  const dispatch = createDispatcher(ctx, makeConfig())

  const first = await dispatch.execute(
    { role: 'harry', cwd: '/repo', prompt: 'first' },
    makeExec(parent),
  )
  assert.equal(first.action, 'started')
  assert.equal(subagents.startCalls[0].request.cwd, '/repo')

  await assert.rejects(
    dispatch.execute({ role: 'harry', cwd: '/elsewhere', prompt: 'second' }, makeExec(parent)),
    (error) => {
      assert.ok(error instanceof HogwartsDispatchError)
      assert.equal(error.code, 'CWD_ON_CONTINUATION')
      return true
    },
  )
  assert.equal(subagents.sendCalls.length, 0)
  assert.equal(subagents.startCalls.length, 1)

  const continuation = await dispatch.execute({ role: 'harry', prompt: 'third' }, makeExec(parent))
  assert.equal(continuation.action, 'continued')
  assert.equal(continuation.childId, first.childId)
})

/* ------------------------------------------------------------------ *
 * Legacy sessions.
 * ------------------------------------------------------------------ */

test('an unambiguous legacy tool result binding is adopted', async () => {
  const parent = new FakeSession('parent-legacy-clear')
  parent.append('tool/call', {
    turn: 1,
    step: 1,
    callId: 'legacy-call-1',
    name: 'hogwarts_dispatch',
    arguments: JSON.stringify({ role: 'harry', description: 'CP1', prompt: 'old brief' }),
  })
  parent.append('tool/result', {
    turn: 1,
    step: 1,
    message: {
      role: 'tool',
      toolCallId: 'legacy-call-1',
      isError: false,
      content: [{ type: 'text', text: 'started harry on spawn/deepseek-flash as subagent legacy-harry' }],
    },
  })
  parent.catalog('legacy-harry', { label: 'CP1' })

  const { ctx, subagents } = makeCtx()
  const result = await createDispatcher(ctx, makeConfig()).execute(
    { role: 'harry', description: 'CP2', prompt: 'next brief' },
    makeExec(parent),
  )
  assert.equal(result.action, 'continued')
  assert.equal(result.childId, 'legacy-harry')
  assert.equal(subagents.startCalls.length, 0)
  assert.equal(subagents.sendCalls.length, 1)
})

test('an ambiguous legacy history fails safely instead of picking a Harry or adding another', async () => {
  const parent = new FakeSession('parent-legacy-ambiguous')
  for (const [index, childId] of ['legacy-harry-a', 'legacy-harry-b'].entries()) {
    const callId = `legacy-call-${index}`
    parent.append('tool/call', {
      turn: 1,
      step: index + 1,
      callId,
      name: 'hogwarts_dispatch',
      arguments: JSON.stringify({ role: 'harry', description: `CP${index + 1}`, prompt: 'brief' }),
    })
    parent.append('tool/result', {
      turn: 1,
      step: index + 1,
      message: {
        role: 'tool',
        toolCallId: callId,
        isError: false,
        content: [
          {
            type: 'text',
            text: `started harry on spawn/deepseek-flash as subagent ${childId}`,
          },
        ],
      },
    })
    parent.catalog(childId, { label: `CP${index + 1}` })
  }

  const { ctx, subagents } = makeCtx()
  await assert.rejects(
    createDispatcher(ctx, makeConfig()).execute(
      { role: 'harry', prompt: 'next brief' },
      makeExec(parent),
    ),
    (error) => {
      assert.ok(error instanceof HogwartsDispatchError)
      assert.equal(error.code, 'AMBIGUOUS_BINDING')
      assert.match(error.message, /legacy-harry-a/)
      assert.match(error.message, /legacy-harry-b/)
      return true
    },
  )
  assert.equal(subagents.startCalls.length, 0)
})

test('legacy children without a tool result are identified by their first persona-tagged brief', async () => {
  const parent = new FakeSession('parent-legacy-persona')
  parent.catalog('legacy-persona-harry', { label: 'checkpoint 2 build' })
  const { ctx, subagents, sessionQuery } = makeCtx()
  sessionQuery.add('legacy-persona-harry', {
    events: [
      {
        type: 'user/message',
        seq: 0,
        time: 0,
        data: {
          content: [{ type: 'text', text: composePrompt(DEFAULT_ROLES.harry.persona, 'old brief') }],
        },
      },
    ],
  })

  const result = await createDispatcher(ctx, makeConfig()).execute(
    { role: 'harry', prompt: 'next brief' },
    makeExec(parent),
  )
  assert.equal(result.action, 'continued')
  assert.equal(result.childId, 'legacy-persona-harry')
  assert.equal(subagents.startCalls.length, 0)
  assert.equal(subagents.sendCalls.length, 1)
})

test('a fork ignores inherited catalog and result facts and starts its own cast', async () => {
  const inheritedCall = {
    type: 'tool/call',
    seq: 0,
    time: 0,
    data: {
      turn: 1,
      step: 1,
      callId: 'inherited-call',
      name: 'hogwarts_dispatch',
      arguments: JSON.stringify({ role: 'harry', description: 'CP1', prompt: 'old' }),
    },
  }
  const inheritedResult = {
    type: 'tool/result',
    seq: 1,
    time: 0,
    data: {
      message: {
        role: 'tool',
        toolCallId: 'inherited-call',
        content: [
          {
            type: 'text',
            text: 'started harry on spawn/deepseek-flash as subagent parent-harry',
          },
        ],
      },
    },
  }
  const inheritedCatalog = {
    type: 'subagent/catalog',
    seq: 2,
    time: 0,
    data: {
      version: 0,
      childId: 'parent-harry',
      childCreatedAt: 1,
      mode: 'continuable',
      label: 'hogwarts:harry · parent CP1',
    },
  }
  const parent = new FakeSession('parent-fork-source')
  const fork = new FakeSession('fork-child', {
    inheritedEventCount: 3,
    inheritedEvents: [inheritedCall, inheritedResult, inheritedCatalog],
  })

  const { ctx, subagents } = makeCtx()
  const result = await createDispatcher(ctx, makeConfig()).execute(
    { role: 'harry', prompt: 'fork brief' },
    makeExec(fork),
  )
  assert.equal(result.action, 'started')
  assert.notEqual(result.childId, 'parent-harry')
  assert.equal(subagents.startCalls.length, 1)
  assert.equal(subagents.sendCalls.length, 0)
  assert.equal(parent.events.length, 0)
})

/* ------------------------------------------------------------------ *
 * Unsupported, corrupt, and ambiguous durable states.
 * ------------------------------------------------------------------ */

test('a one-shot configured backend is rejected before creating a child', async () => {
  const parent = new FakeSession('parent-oneshot-backend')
  const { ctx, subagents } = makeCtx()
  subagents.providers.spawn = {
    name: 'spawn',
    capabilities: {},
    inheritsParentContext: false,
    async start() {
      throw new Error('must not be called')
    },
  }

  await assert.rejects(
    createDispatcher(ctx, makeConfig()).execute({ role: 'harry', prompt: 'brief' }, makeExec(parent)),
    (error) => {
      assert.ok(error instanceof HogwartsDispatchError)
      assert.equal(error.code, 'UNSUPPORTED_BACKEND')
      assert.match(error.message, /one-shot\/external/)
      return true
    },
  )
  assert.equal(subagents.startCalls.length, 0)
})

test('a fork-style backend is rejected because it cannot run the role on its configured model', async () => {
  const parent = new FakeSession('parent-fork-backend')
  const { ctx, subagents } = makeCtx()
  subagents.providers.fork = {
    name: 'fork',
    capabilities: { agentOptions: true, agentPreset: false, outputSchema: true, depthLimit: true },
    inheritsParentContext: true,
    async prepareContinuable() {
      return {}
    },
  }
  const config = makeConfig()
  config.delegation.provider = 'fork'

  await assert.rejects(
    createDispatcher(ctx, config).execute({ role: 'harry', prompt: 'brief' }, makeExec(parent)),
    (error) => {
      assert.ok(error instanceof HogwartsDispatchError)
      assert.equal(error.code, 'UNSUPPORTED_BACKEND')
      assert.match(error.message, /inherits its parent/)
      return true
    },
  )
  assert.equal(subagents.startCalls.length, 0)
})

test('a one-shot legacy binding is refused, not replaced', async () => {
  const parent = new FakeSession('parent-oneshot-binding')
  parent.append('tool/call', {
    turn: 1,
    step: 1,
    callId: 'oneshot-call',
    name: 'hogwarts_dispatch',
    arguments: JSON.stringify({ role: 'harry', description: 'CP1', prompt: 'old' }),
  })
  parent.append('tool/result', {
    turn: 1,
    step: 1,
    message: {
      role: 'tool',
      toolCallId: 'oneshot-call',
      isError: false,
      content: [{ type: 'text', text: 'started harry on spawn/deepseek-flash as subagent legacy-oneshot' }],
    },
  })
  parent.catalog('legacy-oneshot', { mode: 'one-shot', label: 'CP1' })

  const { ctx, subagents } = makeCtx()
  await assert.rejects(
    createDispatcher(ctx, makeConfig()).execute({ role: 'harry', prompt: 'brief' }, makeExec(parent)),
    (error) => {
      assert.ok(error instanceof HogwartsDispatchError)
      assert.equal(error.code, 'UNSUPPORTED_BINDING')
      return true
    },
  )
  assert.equal(subagents.startCalls.length, 0)
})

test('a corrupt catalog fact fails the dispatch instead of being ignored', async () => {
  const parent = new FakeSession('parent-corrupt-catalog')
  parent.append('subagent/catalog', {
    version: 0,
    childId: 'corrupt-child',
    childCreatedAt: 1,
    mode: 'not-a-mode',
    label: 'who knows',
  })

  const { ctx, subagents } = makeCtx()
  await assert.rejects(
    createDispatcher(ctx, makeConfig()).execute({ role: 'harry', prompt: 'brief' }, makeExec(parent)),
    (error) => {
      assert.ok(error instanceof HogwartsDispatchError)
      assert.equal(error.code, 'CORRUPT_BINDING')
      return true
    },
  )
  assert.equal(subagents.startCalls.length, 0)
})

test('an unrecognized Hogwarts role marker fails instead of guessing', async () => {
  const parent = new FakeSession('parent-unknown-role')
  parent.catalog('stale-child', { label: 'hogwarts:gandalf · old role' })
  const { ctx, subagents } = makeCtx()

  await assert.rejects(
    createDispatcher(ctx, makeConfig()).execute({ role: 'harry', prompt: 'brief' }, makeExec(parent)),
    (error) => {
      assert.ok(error instanceof HogwartsDispatchError)
      assert.equal(error.code, 'CORRUPT_BINDING')
      assert.match(error.message, /gandalf/)
      return true
    },
  )
  assert.equal(subagents.startCalls.length, 0)
})

test('a child recorded under two roles is rejected as corrupt', async () => {
  const parent = new FakeSession('parent-cross-role')
  parent.append('tool/call', {
    turn: 1,
    step: 1,
    callId: 'cross-role-call',
    name: 'hogwarts_dispatch',
    arguments: JSON.stringify({ role: 'severus', description: 'review', prompt: 'old' }),
  })
  parent.append('tool/result', {
    turn: 1,
    step: 1,
    message: {
      role: 'tool',
      toolCallId: 'cross-role-call',
      isError: false,
      content: [
        {
          type: 'text',
          text: 'started severus on deepseek-official/deepseek-v4-pro as subagent shared-child',
        },
      ],
    },
  })
  parent.catalog('shared-child', { label: 'hogwarts:harry · CP1' })

  const { ctx, subagents } = makeCtx()
  await assert.rejects(
    createDispatcher(ctx, makeConfig()).execute({ role: 'harry', prompt: 'brief' }, makeExec(parent)),
    (error) => {
      assert.ok(error instanceof HogwartsDispatchError)
      assert.equal(error.code, 'CORRUPT_BINDING')
      assert.match(error.message, /both|recorded as/)
      return true
    },
  )
  assert.equal(subagents.startCalls.length, 0)
})

/* ------------------------------------------------------------------ *
 * Route validation and registration surface.
 * ------------------------------------------------------------------ */

test('a bad creation route fails before publication and remains retryable', async () => {
  const parent = new FakeSession('parent-bad-route')
  const config = makeConfig()
  config.roles.harry.model = 'bad-model'
  const { ctx, subagents } = makeCtx()
  const dispatch = createDispatcher(ctx, config)

  await assert.rejects(
    dispatch.execute({ role: 'harry', prompt: 'brief' }, makeExec(parent)),
    (error) => {
      assert.ok(error instanceof HogwartsDispatchError)
      assert.equal(error.code, 'INVALID_ROUTE')
      return true
    },
  )
  assert.equal(subagents.startCalls.length, 0)

  config.roles.harry.model = 'deepseek-flash'
  const retry = await dispatch.execute({ role: 'harry', prompt: 'brief' }, makeExec(parent))
  assert.equal(retry.action, 'started')
})

test('a projection read failure before creation refuses to start a child', async () => {
  const parent = new FakeSession('parent-projection-read-failure')
  const { ctx, subagents, projections } = makeCtx()
  projections.failStateOf = true

  await assert.rejects(
    createDispatcher(ctx, makeConfig()).execute({ role: 'harry', prompt: 'brief' }, makeExec(parent)),
    (error) => {
      assert.ok(error instanceof HogwartsDispatchError)
      assert.equal(error.code, 'PROJECTION_UNAVAILABLE')
      assert.match(error.message, /Refusing to start a child/)
      return true
    },
  )
  assert.equal(subagents.startCalls.length, 0)
})

test('apply registers the projection, skill, and the started/continued output contract', async () => {
  const { apply, inject } = await import('../index.js')
  let registeredTool
  let registeredProjection
  const ctx = {
    effect(fn) {
      fn()
      return () => {}
    },
    sessionProjections: {
      register(definition) {
        registeredProjection = definition
        return () => {}
      },
    },
    skills: { register: () => () => {} },
    tools: {
      register(definition) {
        registeredTool = definition
        return () => {}
      },
    },
  }
  apply(ctx, makeConfig())

  assert.equal(registeredProjection.key, PROJECTION_KEY)
  assert.equal(registeredProjection.stateVersion, 2)
  assert.equal(registeredTool.name, 'hogwarts_dispatch')
  assert.deepEqual(registeredTool.output.schema.required, ['role', 'action', 'childId'])
  assert.deepEqual(registeredTool.output.schema.properties.action.enum, ['started', 'continued'])
  assert.equal(inject.includes('sessionProjections'), true)

  assert.equal(
    registeredTool.output.render({}, {
      role: 'harry',
      action: 'started',
      childId: 'child-1',
      provider: 'deepseek-official',
      model: 'deepseek-flash',
    })[0].text,
    'started harry on deepseek-official/deepseek-flash as subagent child-1',
  )
  assert.equal(
    registeredTool.output.render({}, { role: 'harry', action: 'continued', childId: 'child-1' })[0].text,
    'continued harry as subagent child-1',
  )
})

/* ------------------------------------------------------------------ *
 * Projection state validation and direct resolution.
 * ------------------------------------------------------------------ */

test('resolveRoleBinding returns null only when the log proves no child exists', async () => {
  const { ctx } = makeCtx()
  const projection = makeBindingsProjection()
  const state = projection.init({}, 0)
  assert.equal(await resolveRoleBinding(state, 'harry', ctx), null)
  await assert.rejects(resolveRoleBinding(undefined, 'harry', ctx), (error) => {
    assert.equal(error.code, 'PROJECTION_UNAVAILABLE')
    return true
  })
})

/* Severus regression cases: module replacement and mixed legacy identity. */

test('overlapping ESM generations share the role creation mutex', async () => {
  const reloaded = await import('../index.js?reload-regression')
  const parent = new FakeSession('parent-esm-reload')
  const { ctx, subagents } = makeCtx()
  const gate = deferred()
  subagents.beforePublish = () => gate.promise
  const first = createDispatcher(ctx, makeConfig()).execute({ role: 'harry', prompt: 'first' }, makeExec(parent))
  const second = reloaded.createDispatcher(ctx, makeConfig()).execute({ role: 'harry', prompt: 'second' }, makeExec(parent))
  try {
    await tick()
    assert.equal(subagents.startCalls.length, 1, 'a replacement module must wait for the old generation')
  } finally {
    gate.resolve()
  }
  const [a, b] = await Promise.all([first, second])
  assert.equal(a.childId, b.childId)
  assert.equal(b.action, 'continued')
  assert.equal(subagents.startCalls.length, 1)
})

function legacyTask(role) {
  return { type: 'user/message', seq: 0, time: 0, data: { role: 'user', content: [
    { type: 'text', text: composePrompt(DEFAULT_ROLES[role].persona, 'legacy task') },
  ] } }
}

for (const knownSource of ['catalog', 'result']) {
  test(`a ${knownSource} binding plus a different persona-only Harry is ambiguous`, async () => {
    const parent = new FakeSession(`parent-mixed-${knownSource}`)
    const knownId = `known-${knownSource}`
    if (knownSource === 'catalog') {
      parent.catalog(knownId, { label: 'hogwarts:harry · CP1' })
    } else {
      parent.catalog(knownId, { label: 'old CP1' })
      parent.append('tool/call', { callId: 'known-call', name: 'hogwarts_dispatch', arguments: JSON.stringify({ role: 'harry' }) })
      parent.append('tool/result', { message: { toolCallId: 'known-call', content: [
        { type: 'text', text: `started harry on provider/model as subagent ${knownId}` },
      ] } })
    }
    const legacyId = `extra-legacy-${knownSource}`
    parent.catalog(legacyId, { label: 'old CP2' })
    const { ctx, subagents, sessionQuery } = makeCtx()
    sessionQuery.add(legacyId, { events: [legacyTask('harry')] })
    await assert.rejects(createDispatcher(ctx, makeConfig()).execute({ role: 'harry', prompt: 'next' }, makeExec(parent)), error => {
      assert.equal(error.code, 'AMBIGUOUS_BINDING')
      assert.ok(error.message.includes(knownId) && error.message.includes(legacyId))
      assert.match(error.message, /Archiving children does not clear/)
      return true
    })
    assert.equal(subagents.startCalls.length, 0)
    assert.equal(subagents.sendCalls.length, 0)
  })
}

for (const initialEvents of [[], [{ type: 'user/message', seq: 0, data: { content: [] } }]]) {
  test(`an unresolved legacy first task is not absent or negatively cached (${initialEvents.length} events)`, async () => {
    const childId = `legacy-empty-task-${initialEvents.length}`
    const parent = new FakeSession(`parent-${childId}`)
    parent.catalog(childId, { label: 'old assignment' })
    const { ctx, subagents, sessionQuery } = makeCtx()
    sessionQuery.add(childId, { events: initialEvents })
    const dispatch = createDispatcher(ctx, makeConfig())
    await assert.rejects(dispatch.execute({ role: 'harry', prompt: 'first' }, makeExec(parent)), error => error.code === 'LEGACY_UNREADABLE')
    assert.equal(subagents.startCalls.length, 0)
    assert.equal(subagents.sendCalls.length, 0)
    // The next read has the now-logged task. The unresolved prior read was not cached.
    sessionQuery.add(childId, { events: [legacyTask('harry')] })
    const result = await dispatch.execute({ role: 'harry', prompt: 'next' }, makeExec(parent))
    assert.equal(result.action, 'continued')
    assert.equal(result.childId, childId)
    assert.equal(subagents.startCalls.length, 0)
  })
}

for (const role of ['harry', 'severus']) {
  test(`conflicting catalog roles block ${role}, including the overwritten role`, async () => {
    const parent = new FakeSession(`parent-conflicting-roles-${role}`)
    parent.catalog('conflicting-child', { label: 'hogwarts:harry · first' })
    parent.catalog('conflicting-child', { label: 'hogwarts:severus · conflicting' })
    const { ctx, subagents } = makeCtx()
    await assert.rejects(createDispatcher(ctx, makeConfig()).execute({ role, prompt: 'next' }, makeExec(parent)), error => error.code === 'CORRUPT_BINDING')
    assert.equal(subagents.startCalls.length, 0)
    assert.equal(subagents.sendCalls.length, 0)
  })
}

test('corrupt-log guidance never asks to edit or remove immutable records', async () => {
  const parent = new FakeSession('parent-corrupt-guidance')
  parent.append('subagent/catalog', { mode: 'invalid' })
  const { ctx } = makeCtx()
  await assert.rejects(createDispatcher(ctx, makeConfig()).execute({ role: 'harry', prompt: 'first' }, makeExec(parent)), error => {
    assert.equal(error.code, 'CORRUPT_BINDING')
    assert.match(error.message, /without editing the append-only log/)
    assert.doesNotMatch(error.message, /remove the offending record|[Aa]rchive.*then retry/)
    return true
  })
})

test('multiple bindings published before a rejected start remain ambiguous without another creation', async () => {
  const parent = new FakeSession('parent-ablation-multiple-published')
  const { ctx, subagents } = makeCtx()
  subagents.afterPublish = async () => {
    parent.catalog('extra-published-harry', { label: 'hogwarts:harry · conflicting publication' })
    throw new Error('startup failed with two catalog candidates')
  }
  const dispatch = createDispatcher(ctx, makeConfig())
  for (const prompt of ['first', 'retry']) {
    await assert.rejects(dispatch.execute({ role: 'harry', prompt }, makeExec(parent)), error => {
      assert.equal(error.code, 'AMBIGUOUS_BINDING')
      assert.match(error.message, /child-1/)
      assert.match(error.message, /extra-published-harry/)
      return true
    })
  }
  assert.equal(subagents.startCalls.length, 1)
  assert.equal(subagents.sendCalls.length, 0)
})

test('conclusive legacy identity avoids repeated full reads and survives a later read outage', async () => {
  const parent = new FakeSession('parent-ablation-cache-budget')
  parent.catalog('cache-budget-harry', { label: 'hogwarts:harry · first' })
  parent.catalog('cache-budget-unrelated', { label: 'unrelated old child' })
  const { ctx, subagents, sessionQuery } = makeCtx()
  sessionQuery.add('cache-budget-unrelated', { events: [{ type: 'user/message', seq: 0, data: {
    content: [{ type: 'text', text: 'Unrelated task, not a Hogwarts persona.' }],
  } }] })
  const readSession = sessionQuery.readSession.bind(sessionQuery)
  let reads = 0
  sessionQuery.readSession = async id => {
    if (++reads > 1) throw new Error('legacy storage temporarily unavailable')
    return readSession(id)
  }
  const dispatch = createDispatcher(ctx, makeConfig())
  for (const prompt of ['one', 'two', 'three']) {
    const result = await dispatch.execute({ role: 'harry', prompt }, makeExec(parent))
    assert.equal(result.childId, 'cache-budget-harry')
    assert.equal(result.action, 'continued')
  }
  assert.equal(reads, 1)
  assert.equal(subagents.startCalls.length, 0)
  assert.equal(subagents.sendCalls.length, 3)
})

test('lean checkpoint payload preserves labels and result correlation after serialization', async () => {
  const projection = makeBindingsProjection()
  let state = projection.init({}, 0)
  state = projection.apply(state, { type: 'subagent/catalog', seq: 0, data: {
    version: 0, childId: 'lean-child', childCreatedAt: 123, mode: 'continuable', label: 'hogwarts:harry · original description',
  } })
  state = projection.apply(state, { type: 'tool/call', seq: 1, data: {
    name: 'hogwarts_dispatch', callId: 'lean-call', arguments: JSON.stringify({ role: 'harry', description: 'redundant pending description' }),
  } })
  state = projection.stateSchema.parse(JSON.parse(JSON.stringify(state)))
  assert.equal(Object.hasOwn(state.catalog[0], 'createdAt'), false)
  assert.equal(Object.hasOwn(state.calls['lean-call'], 'description'), false)
  assert.equal(state.catalog[0].label, 'hogwarts:harry · original description')
  state = projection.apply(state, { type: 'tool/result', seq: 2, data: { message: {
    source: { callId: 'lean-call' }, content: [{ type: 'text', text: 'started harry on provider/model as subagent lean-child' }],
  } } })
  assert.deepEqual(state.resultBindings.harry, ['lean-child'])
  assert.deepEqual(state.calls, {})
  const { ctx } = makeCtx()
  assert.equal((await resolveRoleBinding(state, 'harry', ctx)).childId, 'lean-child')
})

test('a corrupt projection checkpoint is rejected by the state schema', () => {
  const projection = makeBindingsProjection()
  assert.throws(() => projection.stateSchema.parse({ inheritedEventCount: -1 }), /inheritedEventCount/)
  assert.throws(
    () =>
      projection.stateSchema.parse({
        inheritedEventCount: 0,
        catalog: [],
        calls: {},
        resultBindings: {},
        corrupt: [{ role: 7 }],
      }),
    /corrupt/,
  )
})
