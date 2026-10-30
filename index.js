/**
 * Host half of `@dyikai/dsh-hogwarts-loop`.
 *
 * Registers two profile-wide capabilities:
 *
 * 1. the `hogwarts-loop` runtime skill — the plan → build → review → commit
 *    discipline with its `references/` and `assets/` kept beside this package;
 * 2. the `hogwarts_dispatch` tool — starts or continues ONE managed subagent
 *    per cast role on that role's *configured* LLM route, which is the whole
 *    point of the bundle.
 *
 * A role is bound to one child for the lifetime of its parent session. The
 * binding is derived from the parent session log (the subagent catalog plus
 * this tool's own results), so it survives idle periods, plugin reloads, and
 * resuming the same parent session. The log is authoritative; process memory
 * holds only the creation mutex and a bounded cache of conclusively identified
 * legacy children.
 *
 * @module @dyikai/dsh-hogwarts-loop
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'

/** Package directory; `skill/` is resolved from here. */
const HERE = import.meta.dirname

/**
 * The fixed cast. `seat` names the responsibility, `persona` opens the first brief
 * this role receives, and `provider`/`model` are the route defaults the Config
 * schema publishes. `legacyPersonas` freezes exact pre-update persona strings so
 * unmigrated legacy children remain identifiable without weakening matching.
 */
export const DEFAULT_ROLES = {
  harry: {
    seat: 'implementer',
    provider: 'deepseek-official',
    model: 'deepseek-flash',
    persona:
      'You are Harry, the implementer of the Hogwarts loop. You build exactly one checkpoint to spec, run every gate the checkpoint calls for (build, tests, lint, fmt) during development, and hand back a green tree with the raw evidence. You report every deviation from the plan, you stay inside the checkpoint scope, and you never commit. You capture red-before-fix repro evidence on the reviewed snapshot, never reset the tree to manufacture it, and you never report unresolved verification as passed.',
    legacyPersonas: Object.freeze([
      'You are Harry, the implementer of the Hogwarts loop. You build exactly one checkpoint to spec, run every gate the checkpoint calls for (build, tests, lint, fmt) during development, and hand back a green tree with the raw evidence. You report every deviation from the plan, you stay inside the checkpoint scope, and you never commit.',
    ]),
  },
  severus: {
    seat: 'reviewer (correctness lead)',
    provider: 'deepseek-official',
    model: 'deepseek-v4-pro',
    persona:
      "You are Severus, the independent reviewer of the Hogwarts loop. You verify the checkpoint against the spec and re-derive it from the source of truth rather than trusting the implementer's summary. Review time is read time: no builds, no test runs, no compiles. You probe adversarially by reading and reasoning, and when a suspicion can only be settled by execution you return a prove-or-refute request instead of running it yourself. For blocking findings, give a stable ID, severity, concrete failure and guard/evidence; keep non-blocking notes brief. Always return the closure verdict on a delivered repair; the orchestrator applies the separate repair and evidence budgets before more author work. You rule — APPROVE or REQUEST-CHANGES — and you never edit code.",
    legacyPersonas: Object.freeze([
      "You are Severus, the independent reviewer of the Hogwarts loop. You verify the checkpoint against the spec and re-derive it from the source of truth rather than trusting the implementer's summary. Review time is read time: no builds, no test runs, no compiles. You probe adversarially by reading and reasoning, and when a suspicion can only be settled by execution you return a prove-or-refute request instead of running it yourself. You give every finding a stable ID, severity, evidence status (candidate/confirmed/refuted/needs-evidence) and disposition, and you stop automatic review cycles at the checkpoint convergence cap. You rule — APPROVE or REQUEST-CHANGES — and you never edit code.",
      "You are Severus, the independent reviewer of the Hogwarts loop. You verify the checkpoint against the spec and re-derive it from the source of truth rather than trusting the implementer's summary. Review time is read time: no builds, no test runs, no compiles. You probe adversarially by reading and reasoning, and when a suspicion can only be settled by execution you return a prove-or-refute request instead of running it yourself. You rule — APPROVE or REQUEST-CHANGES with P1/P2/P3 findings — and you never edit code.",
    ]),
  },
  alastor: {
    seat: 'security specialist',
    provider: 'deepseek-official',
    model: 'deepseek-v4-pro',
    persona:
      'You are Alastor, the security specialist of the reviewer bench. You audit the checkpoint for security and privacy defects — trust boundaries, injection, secrets, authorization, unsafe defaults, data exposure — and you rule only on what you can substantiate by reading. You cover a named security-relevant change or unresolved security claim that the existing review has not settled; you do not duplicate an unchanged, already-covered boundary. You never edit code.',
    legacyPersonas: Object.freeze([
      'You are Alastor, the security specialist of the reviewer bench. You audit the checkpoint for security and privacy defects — trust boundaries, injection, secrets, authorization, unsafe defaults, data exposure — and you rule only on what you can substantiate by reading. You are the required scoped lens whenever a sensitive surface is named, and you validate security candidates without taking over the whole review. You never edit code.',
      'You are Alastor, the security specialist of the reviewer bench. You audit the checkpoint for security and privacy defects — trust boundaries, injection, secrets, authorization, unsafe defaults, data exposure — and you rule only on what you can substantiate by reading. You never edit code.',
    ]),
  },
  filius: {
    seat: 'performance specialist',
    provider: 'deepseek-official',
    model: 'deepseek-flash',
    persona:
      'You are Filius, the performance specialist of the reviewer bench. You audit the checkpoint for algorithmic cost, allocation and I/O amplification, needless re-computation, and regressions in hot paths, and you rule only on what you can substantiate by reading. You never edit code.',
  },
  minerva: {
    seat: 'concurrency specialist',
    provider: 'deepseek-official',
    model: 'deepseek-flash',
    persona:
      'You are Minerva, the concurrency specialist of the reviewer bench. You audit the checkpoint for races, lost updates, deadlocks, ordering assumptions, cancellation and teardown gaps, and you rule only on what you can substantiate by reading. You never edit code.',
  },
  argus: {
    seat: 'closeout UI walkthrough',
    provider: 'deepseek-official',
    model: 'deepseek-flash',
    persona:
      'You are Argus, the closeout UI walkthrough reviewer. Only when the plan carries design links, you launch the artifact the implementer already built and compare what renders against the design: layout, spacing, type, color, states, and interaction. You never rebuild it and you never edit code.',
  },
  voldemort: {
    seat: 'escalation implementer',
    provider: 'deepseek-official',
    model: 'deepseek-v4-pro',
    persona:
      'You are Voldemort, the escalation implementer of the Hogwarts loop. You work exactly as Harry does — you build one change to spec, run every gate it calls for (build, tests, lint, fmt) during development, and hand back a green tree with the raw evidence. Two things differ: you run on the stronger model configured for this seat, and you are woken for ONE specific problem the implementer already failed three times — never to take over his remaining work. Your brief names that problem; you fix that problem and nothing else, you do not pick up other checkpoints, you do not "clean up while you are here", and when the problem is resolved and reviewed you stop and hand control back. You report every deviation, you stay inside the escalated scope, and you never commit. The checkpoint convergence cap and the same-root attempt limits are separate counters; you never reset either.',
    legacyPersonas: Object.freeze([
      'You are Voldemort, the escalation implementer of the Hogwarts loop. You work exactly as Harry does — you build one change to spec, run every gate it calls for (build, tests, lint, fmt) during development, and hand back a green tree with the raw evidence. Two things differ: you run on the stronger model configured for this seat, and you are woken for ONE specific problem the implementer already failed three times — never to take over his remaining work. Your brief names that problem; you fix that problem and nothing else, you do not pick up other checkpoints, you do not "clean up while you are here", and when the problem is resolved and reviewed you stop and hand control back. You report every deviation, you stay inside the escalated scope, and you never commit.',
    ]),
  },
}

/** Stable role list, in cast order. */
const ROLE_NAMES = Object.freeze(Object.keys(DEFAULT_ROLES))
const ROLE_NAME_SET = new Set(ROLE_NAMES)

/**
 * One role's editable route. `roles` is the volatile node: schemastery forbids a
 * volatile field inside another volatile field, so the reference lives on the
 * object and every leaf stays plain — which is also what makes a Settings write
 * take effect on the next dispatch without a reload.
 * @param {{ seat: string, provider: string, model: string }} defaults
 */
function roleSchema(defaults) {
  return z
    .object({
      provider: z
        .string()
        .default(defaults.provider)
        .description(`${defaults.seat}: registered LLM route name, for example deepseek-official.`),
      model: z
        .string()
        .default(defaults.model)
        .description(`${defaults.seat}: model id on that route, for example deepseek-v4-pro.`),
      reasoningEffort: z
        .string()
        .description(
          `${defaults.seat}: optional reasoning effort id offered by the provider (for example off/low/high/max, or a provider-specific one such as xhigh); empty uses the model default.`,
        ),
      maxTokens: z
        .number()
        .description(`${defaults.seat}: optional output token cap; empty uses the model default.`),
    })
    .description(`${defaults.seat}: the model this role runs on.`)
}

/**
 * Plugin configuration. The top-level `delegation` and `roles` nodes are the
 * volatile fields: that is what the client settings form projects, and it lets
 * this plugin read the live value at dispatch time instead of freezing the value
 * seen at activation.
 */
export const Config = z.object({
  delegation: z
    .object({
      provider: z
        .string()
        .default('spawn')
        .description(
          'Subagent backend. Must be a local, non-inheriting continuable backend (for example `spawn`); one-shot/external and fork-style backends cannot host one child per role on the configured model.',
        ),
      maxDepth: z
        .number()
        .default(1)
        .description('Delegation depth cap; 1 lets a role do the work but not delegate further.'),
    })
    .description('How each role is started.')
    .volatile(),
  roles: z
    .object(
      Object.fromEntries(Object.entries(DEFAULT_ROLES).map(([key, role]) => [key, roleSchema(role)])),
    )
    .description('Per-role LLM route.')
    .volatile(),
})

/** Characters a child label may carry before the runtime truncates it anyway. */
const LABEL_LIMIT = 120

/**
 * Identity marker prepended to a child's durable catalog label. The token after
 * the prefix is the role binding; anything after the separator is display-only
 * (the per-dispatch description) and never participates in identity.
 */
const LABEL_PREFIX = 'hogwarts:'
const LABEL_SEPARATOR = ' · '

/** Host-only session projection key for the role → child bindings. */
export const PROJECTION_KEY = 'hogwartsBindings'
/** Bump when the fold shape or semantics change. */
const PROJECTION_STATE_VERSION = 2

/**
 * Share only the in-flight mutex across ESM generations during plugin reload.
 * Bindings still come exclusively from the session log. Settled tails remove
 * themselves, so the process-global registry retains no session history.
 */
const LOCK_REGISTRY = Symbol.for('@dyikai/dsh-hogwarts-loop/dispatch-locks/v1')
const DISPATCH_LOCKS = (globalThis[LOCK_REGISTRY] ??= new Map())
/** Derived identity of an immutable legacy child log; bounded because the data never changes. */
const LEGACY_ROLE_CACHE = new Map()
const LEGACY_ROLE_CACHE_LIMIT = 256

/** A dispatch refusal that is safe to show to the model and the user. */
export class HogwartsDispatchError extends Error {
  /**
   * @param {string} message actionable explanation
   * @param {string} code stable failure class
   * @param {ErrorOptions} [options]
   */
  constructor(message, code, options) {
    super(message, options)
    this.name = 'HogwartsDispatchError'
    this.code = code
  }
}

/** @param {unknown} value */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Read one config value. Volatile fields arrive as references exposing `get()`;
 * anything else (an absent schema default, a hand-written patch value) is used
 * as-is. A reference that yields `undefined` falls back to the code default.
 * @param {unknown} value
 * @param {any} fallback
 */
function readRef(value, fallback) {
  const current =
    value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
  return current === undefined ? fallback : current
}

/**
 * Drop a leading YAML frontmatter block. Filesystem skills need it to be
 * discovered; a runtime-registered skill gets its metadata from the registration
 * instead, so the body must not repeat it.
 * @param {string} text
 */
function stripFrontmatter(text) {
  if (!text.startsWith('---\n')) return text
  const end = text.indexOf('\n---\n', 4)
  return end === -1 ? text : text.slice(end + 5).replace(/^\n+/, '')
}

/**
 * Prepend the role's persona to the task brief. The child sees only this text.
 * @param {string} persona
 * @param {string} task
 */
export function composePrompt(persona, task) {
  const brief = task.trim()
  return persona === '' ? brief : `${persona}\n\n---\n\n${brief}`
}

/**
 * Extract the text from a message's content blocks. Tool results and user
 * messages both use the same block shape.
 * @param {unknown} content
 * @returns {string}
 */
export function textOfContent(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => isRecord(block) && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

/**
 * Parse the role token out of a child label. Labels written by this version are
 * `hogwarts:<role> · <description>`; anything else is a legacy/unrelated label.
 * @param {string} label
 * @param {ReadonlySet<string>} roleNames
 * @returns {{ marked: boolean, role: string | null, unknownRole?: true }}
 */
export function parseRoleLabel(label, roleNames) {
  if (typeof label !== 'string') return { marked: false, role: null }
  if (!label.startsWith(LABEL_PREFIX)) return { marked: false, role: null }
  const rest = label.slice(LABEL_PREFIX.length)
  const separator = rest.indexOf(LABEL_SEPARATOR)
  const role = separator === -1 ? rest : rest.slice(0, separator)
  if (roleNames.has(role)) return { marked: true, role }
  return { marked: true, role: null, unknownRole: true }
}

/**
 * Build the durable catalog label for a role's child. The description is the
 * per-dispatch display label; the role prefix is identity.
 * @param {string} role
 * @param {string} description
 * @returns {string}
 */
export function formatLabel(role, description) {
  const display = typeof description === 'string' ? description.trim() : ''
  const label = display === '' ? `${LABEL_PREFIX}${role}` : `${LABEL_PREFIX}${role}${LABEL_SEPARATOR}${display}`
  return label.slice(0, LABEL_LIMIT)
}

/**
 * Parse the text this tool renders into a tool result. Kept compatible with the
 * pre-persistence render (`started <role> on <route> as subagent <id>`) so a
 * legacy session's own log is a sound source of role bindings.
 * @param {unknown} text
 * @returns {{ action: 'started' | 'continued', role: string, childId: string } | null}
 */
export function parseDispatchResultText(text) {
  if (typeof text !== 'string') return null
  const value = text.trim()
  const started = /^started\s+(\S+)\s+on\s+(\S+)\s+as subagent\s+(\S+)/.exec(value)
  if (started !== null) return { action: 'started', role: started[1], childId: started[3] }
  const continued = /^continued\s+(\S+)\s+as subagent\s+(\S+)/.exec(value)
  if (continued !== null) return { action: 'continued', role: continued[1], childId: continued[2] }
  return null
}

/** Validate one catalog entry in a restored projection checkpoint. */
function assertCatalogEntry(entry) {
  if (!isRecord(entry)) throw new TypeError('hogwarts bindings: catalog entry must be an object')
  if (typeof entry.childId !== 'string' || entry.childId === '') {
    throw new TypeError('hogwarts bindings: catalog entry childId must be a non-empty string')
  }
  if (!['continuable', 'one-shot', 'external', 'unknown'].includes(entry.mode)) {
    throw new TypeError('hogwarts bindings: catalog entry mode is invalid')
  }
  if (typeof entry.label !== 'string') throw new TypeError('hogwarts bindings: catalog entry label must be a string')
  if (entry.role !== null && typeof entry.role !== 'string') {
    throw new TypeError('hogwarts bindings: catalog entry role must be a string or null')
  }
  if (typeof entry.marked !== 'boolean') throw new TypeError('hogwarts bindings: catalog entry marked must be boolean')
  if (entry.corrupt !== undefined && typeof entry.corrupt !== 'boolean') {
    throw new TypeError('hogwarts bindings: catalog entry corrupt must be boolean')
  }
  if (entry.conflict !== undefined && typeof entry.conflict !== 'boolean') {
    throw new TypeError('hogwarts bindings: catalog entry conflict must be boolean')
  }
  if (entry.unknownRole !== undefined && typeof entry.unknownRole !== 'boolean') {
    throw new TypeError('hogwarts bindings: catalog entry unknownRole must be boolean')
  }
}

/**
 * Schema for the projection state. The projection service expects a `.parse`
 * schema; this package deliberately has no Zod dependency, so the state is
 * validated with the same plain-JSON checks used when it is folded.
 */
const bindingsStateSchema = {
  parse(value) {
    if (!isRecord(value)) throw new TypeError('hogwarts bindings: state must be an object')
    if (!Number.isSafeInteger(value.inheritedEventCount) || value.inheritedEventCount < 0) {
      throw new TypeError('hogwarts bindings: inheritedEventCount must be a non-negative integer')
    }
    if (!Array.isArray(value.catalog)) throw new TypeError('hogwarts bindings: catalog must be an array')
    for (const entry of value.catalog) assertCatalogEntry(entry)
    if (!isRecord(value.calls)) throw new TypeError('hogwarts bindings: calls must be an object')
    for (const call of Object.values(value.calls)) {
      if (!isRecord(call) || typeof call.role !== 'string') {
        throw new TypeError('hogwarts bindings: pending call must carry a role')
      }
    }
    if (!isRecord(value.resultBindings)) throw new TypeError('hogwarts bindings: resultBindings must be an object')
    for (const ids of Object.values(value.resultBindings)) {
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || id === '')) {
        throw new TypeError('hogwarts bindings: resultBindings values must be non-empty string arrays')
      }
    }
    if (!Array.isArray(value.corrupt)) throw new TypeError('hogwarts bindings: corrupt must be an array')
    for (const item of value.corrupt) {
      if (!isRecord(item) || typeof item.reason !== 'string') {
        throw new TypeError('hogwarts bindings: corrupt entries must carry a reason')
      }
      if (item.role !== undefined && typeof item.role !== 'string') {
        throw new TypeError('hogwarts bindings: corrupt entry role must be a string')
      }
    }
    return value
  },
}

/** Merge one catalog fact into the projection state without inventing precedence. */
function applyCatalog(state, event) {
  const data = event.data
  if (!isRecord(data) || typeof data.childId !== 'string' || data.childId === '') {
    return {
      ...state,
      corrupt: [...state.corrupt, { reason: 'malformed subagent/catalog payload', seq: event.seq }],
    }
  }
  const mode = data.mode
  if (!['continuable', 'one-shot', 'external', 'unknown'].includes(mode)) {
    return {
      ...state,
      corrupt: [...state.corrupt, { reason: `subagent/catalog has invalid mode ${JSON.stringify(mode)}`, seq: event.seq }],
    }
  }
  const label = typeof data.label === 'string' ? data.label : ''
  const parsed = parseRoleLabel(label, ROLE_NAME_SET)
  const entry = {
    childId: data.childId,
    mode,
    label,
    role: parsed.role,
    marked: parsed.marked,
    ...(parsed.unknownRole === true ? { unknownRole: true } : {}),
  }
  const index = state.catalog.findIndex((candidate) => candidate.childId === entry.childId)
  if (index === -1) return { ...state, catalog: [...state.catalog, entry] }
  const existing = state.catalog[index]
  // A readable complete entry is authoritative over the migration's `unknown`
  // placeholder, matching the subagent catalog reader's own precedence.
  if (existing.mode === 'unknown' && entry.mode !== 'unknown') {
    const catalog = state.catalog.map((candidate, at) => (at === index ? entry : candidate))
    return { ...state, catalog }
  }
  if (entry.mode === 'unknown' && existing.mode !== 'unknown') return state
  if (
    existing.mode === entry.mode &&
    existing.label === entry.label &&
    existing.role === entry.role &&
    existing.marked === entry.marked
  ) {
    return state
  }
  const catalog = state.catalog.map((candidate, at) =>
    at === index ? { ...candidate, conflict: true } : candidate,
  )
  return { ...state, catalog }
}

/** Remember a pending `hogwarts_dispatch` call until its tool result commits. */
function applyToolCall(state, event) {
  const data = event.data
  if (!isRecord(data) || data.name !== 'hogwarts_dispatch') return state
  const callId = typeof data.callId === 'string' ? data.callId : ''
  if (callId === '') return state
  let args
  try {
    args = JSON.parse(data.arguments)
  } catch {
    return state
  }
  if (!isRecord(args) || typeof args.role !== 'string') return state
  return {
    ...state,
    calls: {
      ...state.calls,
      [callId]: {
        role: args.role,
      },
    },
  }
}

/** Fold this tool's own result into durable role → child bindings. */
function applyToolResult(state, event) {
  const data = event.data
  const message = isRecord(data) && isRecord(data.message) ? data.message : undefined
  if (message === undefined) return state
  const fromSource = isRecord(message.source) ? message.source.callId : undefined
  const callId =
    typeof message.toolCallId === 'string'
      ? message.toolCallId
      : typeof fromSource === 'string'
        ? fromSource
        : ''
  if (callId === '' || !Object.hasOwn(state.calls, callId)) return state
  const pending = state.calls[callId]
  const calls = { ...state.calls }
  delete calls[callId]
  if (message.isError === true) return { ...state, calls }
  const parsed = parseDispatchResultText(textOfContent(message.content))
  if (parsed === null) return { ...state, calls }
  if (parsed.role !== pending.role) {
    return {
      ...state,
      calls,
      corrupt: [
        ...state.corrupt,
        {
          reason: `tool result names role ${JSON.stringify(parsed.role)} but the call named ${JSON.stringify(pending.role)}`,
          role: pending.role,
          seq: event.seq,
        },
      ],
    }
  }
  const existing = state.resultBindings[parsed.role] ?? []
  const resultBindings = existing.includes(parsed.childId)
    ? state.resultBindings
    : { ...state.resultBindings, [parsed.role]: [...existing, parsed.childId] }
  return { ...state, calls, resultBindings }
}

/**
 * The host-only `hogwartsBindings` projection. It folds the parent session's
 * durable subagent catalog and this tool's own results; fork-inherited events
 * are excluded so a fork starts its own cast.
 * @returns {{
 *   key: string,
 *   stateSchema: { parse(value: unknown): unknown },
 *   init(header: unknown, inheritedEventCount: number): any,
 *   apply(state: any, event: any): any,
 *   stateVersion: number,
 * }}
 */
export function makeBindingsProjection() {
  return {
    key: PROJECTION_KEY,
    stateSchema: bindingsStateSchema,
    init: (_header, inheritedEventCount) => ({
      inheritedEventCount,
      catalog: [],
      calls: {},
      resultBindings: {},
      corrupt: [],
    }),
    apply: (state, event) => {
      if (event.seq < state.inheritedEventCount) return state
      if (event.type === 'subagent/catalog') return applyCatalog(state, event)
      if (event.type === 'tool/call') return applyToolCall(state, event)
      if (event.type === 'tool/result') return applyToolResult(state, event)
      return state
    },
    stateVersion: PROJECTION_STATE_VERSION,
  }
}

/** Describe candidate children for an actionable ambiguous-binding error. */
function describeCandidates(candidates, state) {
  return [...candidates].map((childId) => {
    const label = state.catalog.find((entry) => entry.childId === childId)?.label
    return label ? `${childId} (${label})` : childId
  }).join(', ')
}

/** Reject corrupt state entries that would make this role's binding unsafe. */
function assertStateUsable(state, role) {
  for (const item of state.corrupt) {
    if (item.role === undefined || item.role === role) {
      throw new HogwartsDispatchError(
        `hogwarts_dispatch: the durable Hogwarts binding log is corrupt (${item.reason}${item.seq === undefined ? '' : ` at seq ${item.seq}`}). Refusing to guess or start another ${role}. Stop this dispatch edge and inspect the failure without editing the append-only log; move work to a new parent session if the recorded history cannot be used safely.`,
        'CORRUPT_BINDING',
      )
    }
  }
  // A child can carry only one role. Cross-role facts mean the log was edited
  // or two responses were mixed, and picking either interpretation is unsafe.
  const catalogRoleByChild = new Map()
  for (const entry of state.catalog) {
    if (entry.role === null) continue
    const prior = catalogRoleByChild.get(entry.childId)
    if (prior !== undefined && prior !== entry.role) {
      throw new HogwartsDispatchError(
        `hogwarts_dispatch: subagent ${entry.childId} is recorded under both ${prior} and ${entry.role}. Refusing to guess. Inspect the parent session log before retrying.`,
        'CORRUPT_BINDING',
      )
    }
    catalogRoleByChild.set(entry.childId, entry.role)
  }
  const resultRoleByChild = new Map()
  for (const [boundRole, childIds] of Object.entries(state.resultBindings)) {
    for (const childId of childIds) {
      const prior = resultRoleByChild.get(childId)
      if (prior !== undefined && prior !== boundRole) {
        throw new HogwartsDispatchError(
          `hogwarts_dispatch: subagent ${childId} is bound to both ${prior} and ${boundRole}. Refusing to guess. Inspect the parent session log before retrying.`,
          'CORRUPT_BINDING',
        )
      }
      resultRoleByChild.set(childId, boundRole)
      const catalogRole = catalogRoleByChild.get(childId)
      if (catalogRole !== undefined && catalogRole !== boundRole) {
        throw new HogwartsDispatchError(
          `hogwarts_dispatch: subagent ${childId} is recorded as ${catalogRole} in the catalog but bound to ${boundRole} by a tool result. Refusing to guess. Inspect the parent session log before retrying.`,
          'CORRUPT_BINDING',
        )
      }
    }
  }
  for (const entry of state.catalog) {
    if (entry.unknownRole === true) {
      throw new HogwartsDispatchError(
        `hogwarts_dispatch: subagent ${entry.childId} carries the Hogwarts label ${JSON.stringify(entry.label)}, but its role is not in this cast (${ROLE_NAMES.join(', ')}). Refusing to guess. Stop this dispatch edge and verify the plugin version; use a new parent session if the historical role is unsupported.`,
        'CORRUPT_BINDING',
      )
    }
    if (entry.conflict === true) {
      throw new HogwartsDispatchError(
        `hogwarts_dispatch: subagent ${entry.childId} has conflicting durable catalog records. Refusing to guess which one is the ${role} child. Inspect the parent session log before retrying.`,
        'CORRUPT_BINDING',
      )
    }
    if (entry.corrupt === true && (entry.role === role || entry.role === null)) {
      throw new HogwartsDispatchError(
        `hogwarts_dispatch: subagent ${entry.childId} has a corrupt durable catalog record. Refusing to guess or start another ${role}. Inspect the parent session log before retrying.`,
        'CORRUPT_BINDING',
      )
    }
  }
}

/** Candidate children for one role from durable result bindings and marked catalog rows. */
function markedCandidates(state, role) {
  const candidates = new Set(state.resultBindings[role] ?? [])
  for (const entry of state.catalog) {
    if (entry.role === role && entry.corrupt !== true) candidates.add(entry.childId)
  }
  return candidates
}

/** Verify one chosen child is not a known one-shot/external/unknown backend. */
function assertContinuableEntry(state, childId, role) {
  const entries = state.catalog.filter((entry) => entry.childId === childId)
  if (entries.length > 1) {
    const modes = new Set(entries.map((entry) => entry.mode))
    const roles = new Set(entries.map((entry) => entry.role))
    if (modes.size > 1 || roles.size > 1 || entries.some((entry) => entry.conflict === true)) {
      throw new HogwartsDispatchError(
        `hogwarts_dispatch: subagent ${childId} has conflicting durable catalog records. Refusing to continue ${role}. Inspect the parent session log before retrying.`,
        'CORRUPT_BINDING',
      )
    }
  }
  if (entries.some((entry) => entry.role !== null && entry.role !== role)) {
    throw new HogwartsDispatchError(
      `hogwarts_dispatch: subagent ${childId} is recorded under a different role than ${role}. Refusing to guess. Inspect the parent session log before retrying.`,
      'CORRUPT_BINDING',
    )
  }
  const entry = entries[0]
  if (entry === undefined) return
  if (entry.mode !== 'continuable') {
    throw new HogwartsDispatchError(
      `hogwarts_dispatch: ${role} is bound to subagent ${childId}, but that child is mode "${entry.mode}" and cannot accept a follow-up brief. Refusing to start a replacement. This child's recorded mode cannot be changed by selecting another backend. Stop this edge, or start a genuinely new parent session with a supported backend.`,
      'UNSUPPORTED_BINDING',
    )
  }
}

/**
 * Identify which cast role started an unmarked legacy child by reading that
 * child's first user message. The child log is immutable, so successful reads
 * are cached; a cache miss always falls back to the durable log.
 * @param {any} ctx
 * @param {string} childId
 * @returns {Promise<{ role?: string | null, ambiguous?: string[], error?: unknown }>}
 */
async function identifyLegacyChild(ctx, childId) {
  const cached = LEGACY_ROLE_CACHE.get(childId)
  if (cached !== undefined) return cached
  const query = typeof ctx?.get === 'function' ? ctx.get('sessionQuery') : ctx?.sessionQuery
  if (query === undefined || typeof query.readSession !== 'function') {
    return { error: new Error('the sessionQuery service is unavailable') }
  }
  try {
    const snapshot = await query.readSession(childId)
    const inherited = snapshot?.inheritedEventCount ?? 0
    if (!Array.isArray(snapshot?.events) || !Number.isSafeInteger(inherited) || inherited < 0 || inherited > snapshot.events.length) {
      return { error: new Error('the legacy session has an invalid event history or inherited boundary') }
    }
    const own = snapshot.events.slice(inherited)
    const firstUser = own.find((event) => {
      if (event?.type !== 'user/message' || !isRecord(event.data)) return false
      return Array.isArray(event.data.content) || isRecord(event.data.message)
    })
    const content = firstUser === undefined
      ? undefined
      : Array.isArray(firstUser.data.content)
        ? firstUser.data.content
        : firstUser.data.message?.content
    const text = textOfContent(content)
    if (firstUser === undefined || text.trim() === '') {
      // Catalog publication can precede logging the accepted first task. This
      // is unresolved identity, not proof that the child is unrelated; never
      // cache it, because the task may become readable on the next attempt.
      return { error: new Error('the legacy child has no readable first task yet; its role is unresolved') }
    }
    const matches = ROLE_NAMES.filter((role) => {
      const { persona, legacyPersonas = [] } = DEFAULT_ROLES[role]
      return [persona, ...legacyPersonas].some((identity) => text.startsWith(identity))
    })
    let identified
    if (matches.length === 0) identified = { role: null }
    else if (matches.length === 1) identified = { role: matches[0] }
    else identified = { ambiguous: matches }
    if (LEGACY_ROLE_CACHE.size >= LEGACY_ROLE_CACHE_LIMIT) {
      const oldest = LEGACY_ROLE_CACHE.keys().next().value
      if (oldest !== undefined) LEGACY_ROLE_CACHE.delete(oldest)
    }
    LEGACY_ROLE_CACHE.set(childId, identified)
    return identified
  } catch (error) {
    return { error }
  }
}

/** Collect legacy candidates as well as marked/result candidates, never as a fallback. */
async function legacyCandidatesForRole(state, role, ctx, signal) {
  // A correlated successful tool result already proves this child's role.
  // Do not require reading that child's log again, or count it twice.
  const identifiedIds = new Set(Object.values(state.resultBindings).flat())
  const entries = state.catalog.filter(
    (entry) =>
      entry.role === null &&
      entry.marked === false &&
      entry.corrupt !== true &&
      entry.conflict !== true &&
      !identifiedIds.has(entry.childId) &&
      ['continuable', 'one-shot', 'unknown'].includes(entry.mode),
  )
  const matches = []
  for (const entry of entries) {
    throwIfAborted(signal)
    const identified = await identifyLegacyChild(ctx, entry.childId)
    throwIfAborted(signal)
    if (identified.error !== undefined) {
      const detail = identified.error instanceof Error ? identified.error.message : String(identified.error)
      throw new HogwartsDispatchError(
        `hogwarts_dispatch: could not identify legacy child ${entry.childId} (${detail}). Refusing to create or choose ${role} while that child's role is unresolved. Wait for its first task to be logged or restore read access, then retry; otherwise stop this edge. Archiving does not remove its durable binding.`,
        'LEGACY_UNREADABLE',
        { cause: identified.error },
      )
    }
    if (Array.isArray(identified.ambiguous)) {
      if (identified.ambiguous.includes(role)) matches.push(entry)
      continue
    }
    if (identified.role === role) matches.push(entry)
  }
  return matches
}

/**
 * Resolve the durable child for one role. Returns `null` only when the log
 * proves no child exists; every ambiguous, unsupported, or corrupt state throws
 * instead of silently picking or creating one.
 * @param {any} state
 * @param {string} role
 * @param {any} ctx
 * @returns {Promise<{ childId: string } | null>}
 */
export async function resolveRoleBinding(state, role, ctx, signal) {
  if (state === undefined) {
    throw new HogwartsDispatchError(
      'hogwarts_dispatch: the durable Hogwarts binding projection is unavailable. The sessionProjections service did not return state for this session, so starting a child could create a duplicate. Reload the plugin profile and retry.',
      'PROJECTION_UNAVAILABLE',
    )
  }
  throwIfAborted(signal)
  assertStateUsable(state, role)
  const candidates = markedCandidates(state, role)
  if (candidates.size <= 1) {
    for (const entry of await legacyCandidatesForRole(state, role, ctx, signal)) {
      candidates.add(entry.childId)
    }
  }
  if (candidates.size > 1) {
    throw new HogwartsDispatchError(
      `hogwarts_dispatch: ${role} has ${candidates.size} possible children in this session (${describeCandidates(candidates, state)}). Refusing to pick one or start another. Stop this dispatch edge; the user may explicitly choose an existing child for manual continuation, or move work to a new parent session. Archiving children does not clear these immutable bindings.`,
      'AMBIGUOUS_BINDING',
    )
  }
  if (candidates.size === 0) return null
  const [childId] = candidates
  assertContinuableEntry(state, childId, role)
  return { childId }
}

/** Current configured route for one role, read from the live configuration. */
function currentRoute(rolesRef, roleName) {
  const defaults = DEFAULT_ROLES[roleName]
  const roles = readRef(rolesRef, {})
  const node = isRecord(roles) && isRecord(roles[roleName]) ? roles[roleName] : {}
  return {
    provider: readRef(node.provider, defaults.provider),
    model: readRef(node.model, defaults.model),
    reasoningEffort: readRef(node.reasoningEffort, undefined),
    maxTokens: readRef(node.maxTokens, undefined),
  }
}

/** Current delegation policy, read from the live configuration. */
function currentDelegation(delegationRef) {
  const node = readRef(delegationRef, {})
  const view = isRecord(node) ? node : {}
  return {
    provider: readRef(view.provider, 'spawn'),
    maxDepth: readRef(view.maxDepth, 1),
  }
}

/**
 * Fail the tool call — not later, in an opaque completion notice — when a role's
 * configured route is unusable in this profile. A mistyped provider or model is
 * the most likely failure of this bundle.
 * @param {any} ctx
 * @param {string} roleName
 * @param {{ provider: string, model: string }} route
 * @param {AbortSignal} signal
 */
async function validateRoute(ctx, roleName, route, signal) {
  const advice =
    'Change it in the Plugins page (Hogwarts Loop → Configure) or in this profile entry\'s `config`.'
  let registered = []
  try {
    registered = (ctx.llm.listProviders?.() ?? []).map((entry) => entry.id)
  } catch {
    registered = []
  }
  if (registered.length > 0 && !registered.includes(route.provider)) {
    throw new HogwartsDispatchError(
      `Hogwarts role "${roleName}" is configured for provider "${route.provider}", which this profile does not register (registered: ${registered.join(', ')}). ${advice}`,
      'INVALID_ROUTE',
    )
  }
  try {
    await ctx.llm.resolveModelInfo(route.provider, route.model, signal)
  } catch (error) {
    if (signal?.aborted === true) throw abortError(signal)
    const detail = error instanceof Error ? error.message : String(error)
    throw new HogwartsDispatchError(
      `Hogwarts role "${roleName}" is configured for ${route.provider}/${route.model}, which this profile cannot serve: ${detail}. ${advice}`,
      'INVALID_ROUTE',
      { cause: error },
    )
  }
}

/**
 * A Hogwarts child must live on a local, continuable, non-inheriting backend.
 * External/one-shot providers cannot accept the next checkpoint, and a
 * fork-style provider inherits the parent's context/route instead of running on
 * the role's configured model. Both are rejected before creation.
 * @param {any} ctx
 * @param {string} providerName
 */
function assertContinuableProvider(ctx, providerName) {
  if (typeof ctx.subagents.getProvider !== 'function') {
    throw new HogwartsDispatchError(
      `hogwarts_dispatch: this runtime does not expose subagent provider capabilities, so it cannot verify that delegation.provider "${providerName}" keeps one continuable child per role. Update the runtime or use a supported backend.`,
      'UNSUPPORTED_BACKEND',
    )
  }
  const provider = ctx.subagents.getProvider(providerName)
  if (provider === undefined) {
    const known = typeof ctx.subagents.list === 'function' ? ctx.subagents.list() : []
    throw new HogwartsDispatchError(
      `hogwarts_dispatch: subagent backend "${providerName}" is not registered in this profile${known.length === 0 ? '' : ` (registered: ${known.join(', ')})`}. Set delegation.provider to a local continuable backend such as "spawn".`,
      'UNSUPPORTED_BACKEND',
    )
  }
  if (typeof provider.prepareContinuable !== 'function') {
    throw new HogwartsDispatchError(
      `hogwarts_dispatch: subagent backend "${providerName}" cannot host a continuable Hogwarts child; it is a one-shot/external backend. Hogwarts roles must keep the same child across checkpoints, so set delegation.provider to a local continuable backend such as "spawn".`,
      'UNSUPPORTED_BACKEND',
    )
  }
  if (provider.inheritsParentContext === true) {
    throw new HogwartsDispatchError(
      `hogwarts_dispatch: subagent backend "${providerName}" inherits its parent's context and route, so it cannot run this role on the configured model. Set delegation.provider to a fresh local backend such as "spawn".`,
      'UNSUPPORTED_BACKEND',
    )
  }
  if (provider.capabilities?.agentOptions !== true) {
    throw new HogwartsDispatchError(
      `hogwarts_dispatch: subagent backend "${providerName}" does not accept per-child agent options, so it cannot run this role on the configured model. Set delegation.provider to a backend such as "spawn".`,
      'UNSUPPORTED_BACKEND',
    )
  }
}

/** One consistent cancellation Error regardless of the caller's abort reason. */
function abortError(signal) {
  const reason = signal?.reason
  if (reason instanceof Error) return reason
  const error = new Error('hogwarts_dispatch cancelled')
  error.name = 'AbortError'
  return error
}

/** Reject a pre-aborted call and surface a real Error for abort-aware callers. */
function throwIfAborted(signal) {
  if (signal?.aborted === true) throw abortError(signal)
}

/** Wait for the preceding same-role call without making an aborted queued call wait. */
function waitForPrevious(previous, signal) {
  if (signal === undefined) return previous.then(() => undefined, () => undefined)
  if (signal.aborted === true) return Promise.reject(abortError(signal))
  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const onAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(abortError(signal))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    previous.then(
      () => {
        if (settled) return
        settled = true
        cleanup()
        resolve(undefined)
      },
      () => {
        if (settled) return
        settled = true
        cleanup()
        resolve(undefined)
      },
    )
  })
}

/**
 * Serialize one parent/role dispatch. The lock is a mutex, never the binding
 * store; ESM reload generations share it while the log holds durable identity.
 *
 * The map entry is the *tail* of the chain, not the caller's body promise: an
 * aborted queued caller must remain in the chain until the running caller
 * finishes, otherwise a later call could start beside it and create a second
 * child. The entry is removed only after the chain itself settles.
 */
async function withRoleLock(key, signal, run) {
  const previous = DISPATCH_LOCKS.get(key) ?? Promise.resolve()
  let release
  const tail = new Promise((resolve) => {
    release = resolve
  })
  const queued = previous.then(() => tail, () => tail)
  DISPATCH_LOCKS.set(key, queued)
  void queued.finally(() => {
    if (DISPATCH_LOCKS.get(key) === queued) DISPATCH_LOCKS.delete(key)
  })
  try {
    await waitForPrevious(previous, signal)
    throwIfAborted(signal)
    return await run()
  } finally {
    release()
  }
}

/** Read the host-only binding state for one live parent session. */
function readBindingsState(ctx, session) {
  const service = ctx?.sessionProjections
  if (service === undefined || typeof service.stateOf !== 'function') {
    throw new HogwartsDispatchError(
      'hogwarts_dispatch: the sessionProjections service is unavailable, so durable role bindings cannot be read. Reload the plugin profile and retry.',
      'PROJECTION_UNAVAILABLE',
    )
  }
  let state
  try {
    state = service.stateOf(session, PROJECTION_KEY)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new HogwartsDispatchError(
      `hogwarts_dispatch: could not read the durable Hogwarts bindings (${detail}). Refusing to start a child because that could create a duplicate. Reload the plugin profile and retry.`,
      'PROJECTION_UNAVAILABLE',
      { cause: error },
    )
  }
  if (state === undefined) {
    throw new HogwartsDispatchError(
      'hogwarts_dispatch: the durable Hogwarts binding projection is not registered for this session. Reload the plugin profile and retry.',
      'PROJECTION_UNAVAILABLE',
    )
  }
  return state
}

/**
 * A creation that fails after publication must not create a duplicate on
 * retry. Re-read the log to recover membership, not to infer startup success:
 * the runtime may dispose the activation after appending the catalog fact.
 * A known child id belongs in the error; only fulfilled startup is success.
 */
async function recoverPublishedChild(ctx, session, role) {
  let state
  try {
    state = readBindingsState(ctx, session)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new HogwartsDispatchError(
      `hogwarts_dispatch: starting ${role} failed, and the durable binding log could not be read to decide whether the child was published (${detail}). Do not retry blindly: restore binding-log access and inspect the subagent roster to determine whether an existing child must be continued. Archiving does not reset its binding.`,
      'PUBLICATION_UNCERTAIN',
      { cause: error },
    )
  }
  assertStateUsable(state, role)
  const candidates = markedCandidates(state, role)
  const fresh = [...candidates.keys()]
  if (fresh.length === 0) return null
  if (fresh.length > 1) {
    throw new HogwartsDispatchError(
      `hogwarts_dispatch: starting ${role} failed after publication and the log now shows several new candidate children (${fresh.join(', ')}). Refusing to guess. Inspect the subagent roster before retrying.`,
      'AMBIGUOUS_BINDING',
    )
  }
  const childId = fresh[0]
  assertContinuableEntry(state, childId, role)
  return childId
}

/**
 * Build the dispatch implementation for one plugin activation. Exported so the
 * node:test suite can exercise the real algorithm with fake service contracts
 * instead of paying for model calls.
 * @param {any} ctx
 * @param {any} config
 */
export function createDispatcher(ctx, config) {
  const roleNames = ROLE_NAMES
  const rolesRef = config?.roles
  const delegationRef = config?.delegation

  return {
    currentRoute: (roleName) => currentRoute(rolesRef, roleName),
    currentDelegation: () => currentDelegation(delegationRef),
    async execute(args, exec) {
      const role = args?.role
      const defaults = DEFAULT_ROLES[role]
      if (defaults === undefined) {
        throw new HogwartsDispatchError(
          `unknown Hogwarts role "${String(role)}"; configured roles: ${roleNames.join(', ')}`,
          'UNKNOWN_ROLE',
        )
      }
      if (exec?.agent === undefined) {
        throw new HogwartsDispatchError('hogwarts_dispatch requires an owning agent session', 'NO_AGENT')
      }
      const session = exec.agent.session
      if (session === undefined) {
        throw new HogwartsDispatchError(
          'hogwarts_dispatch could not read the parent session, so it cannot persist a role binding.',
          'NO_SESSION',
        )
      }
      const parentId = exec.agent.id
      if (typeof parentId !== 'string' || parentId === '') {
        throw new HogwartsDispatchError('hogwarts_dispatch requires a parent session id', 'NO_SESSION')
      }
      const prompt = typeof args?.prompt === 'string' ? args.prompt.trim() : ''
      if (prompt === '') {
        throw new HogwartsDispatchError(
          `hogwarts_dispatch requires a non-empty prompt for ${role}; it is the child's entire brief.`,
          'INVALID_PROMPT',
        )
      }
      const cwd = typeof args?.cwd === 'string' && args.cwd !== '' ? args.cwd : undefined
      const signal = exec.signal
      const key = `${parentId}\u0000${role}`

      return withRoleLock(key, signal, async () => {
        const state = readBindingsState(ctx, session)
        const binding = await resolveRoleBinding(state, role, ctx, signal)
        if (binding !== null) {
          if (cwd !== undefined) {
            throw new HogwartsDispatchError(
              `hogwarts_dispatch: ${role} is already bound to child ${binding.childId}, and cwd may only be chosen when that role is first started. Omit cwd to continue in the child's established working directory.`,
              'CWD_ON_CONTINUATION',
            )
          }
          throwIfAborted(signal)
          try {
            await ctx.subagents.sendMessage(exec.agent, binding.childId, [{ type: 'text', text: prompt }], {
              signal,
            })
          } catch (error) {
            if (signal?.aborted === true) throw abortError(signal)
            const detail = error instanceof Error ? error.message : String(error)
            throw new HogwartsDispatchError(
              `hogwarts_dispatch: ${role} is bound to child ${binding.childId}, but continuing it failed: ${detail}. Refusing to start a replacement; fix the continuation and retry the same call.`,
              'CONTINUATION_FAILED',
              { cause: error },
            )
          }
          return { role, action: 'continued', childId: binding.childId }
        }

        const delegation = currentDelegation(delegationRef)
        assertContinuableProvider(ctx, delegation.provider)
        const route = currentRoute(rolesRef, role)
        await validateRoute(ctx, role, route, signal)

        /** @type {Record<string, unknown>} */
        const agentOptions = { provider: route.provider, model: route.model }
        const effort = route.reasoningEffort
        if (typeof effort === 'string' && effort !== '') agentOptions.reasoningEffort = effort
        if (typeof route.maxTokens === 'number' && route.maxTokens > 0) agentOptions.maxTokens = route.maxTokens

        /** @type {Record<string, unknown>} */
        const request = {
          prompt: [{ type: 'text', text: composePrompt(defaults.persona, prompt) }],
          parent: exec.agent,
          agentOptions,
        }
        if (cwd !== undefined) request.cwd = cwd
        const maxDepth =
          typeof ctx.subagents.resolveMaxDepth === 'function'
            ? ctx.subagents.resolveMaxDepth(delegation.maxDepth)
            : undefined
        if (maxDepth !== undefined) request.maxDepth = maxDepth

        const description =
          typeof args?.description === 'string' && args.description.trim() !== ''
            ? args.description.trim()
            : defaults.seat
        const label = formatLabel(role, description)

        let activation
        try {
          activation = await ctx.subagents.startActivation({
            provider: delegation.provider,
            label,
            request,
            signal,
            delivery: 'parent',
          })
        } catch (error) {
          const recovered = await recoverPublishedChild(ctx, session, role)
          if (recovered !== null) {
            const detail = error instanceof Error ? error.message : String(error)
            throw new HogwartsDispatchError(
              `hogwarts_dispatch: starting ${role} failed (${detail}), but child ${recovered} is recorded in the catalog. Startup success is not confirmed and the runtime may have disposed it. No replacement will be created; inspect that child's state before retrying continuation of the same child.`,
              'START_FAILED_WITH_BINDING',
              { cause: error },
            )
          }
          if (signal?.aborted === true) throw abortError(signal)
          throw error
        }

        // The runtime owns outcome reporting and cleanup; this secondary handle
        // only exists to keep an unobserved rejection from surfacing as noise.
        Promise.resolve(activation.result).catch(() => {})

        return {
          role,
          action: 'started',
          childId: String(activation.childId),
          provider: route.provider,
          model: route.model,
        }
      })
    },
  }
}

/**
 * @param {string[]} roleNames
 */
function parameterSchema(roleNames) {
  const seats = roleNames.map((key) => `\`${key}\` (${DEFAULT_ROLES[key].seat})`).join(', ')
  return {
    type: 'object',
    additionalProperties: false,
    required: ['role', 'description', 'prompt'],
    properties: {
      role: {
        type: 'string',
        enum: roleNames,
        description: `The cast member to start or continue: ${seats}.`,
      },
      description: {
        type: 'string',
        description:
          'Per-dispatch label shown when the role is first started (for example `checkpoint 3 build`). Not identity: `role` selects the child.',
      },
      prompt: {
        type: 'string',
        description:
          'The complete brief for this dispatch. The child does not see this conversation, so restate the spec, checkpoint scope, repo conventions, gates, and constraints. On a continuation this is the next brief for the same child.',
      },
      cwd: {
        type: 'string',
        description:
          'Optional absolute working directory when the role is first started; omit to inherit the caller\'s. Rejected on a continuation, which keeps the child\'s directory.',
      },
    },
  }
}

/** Tool description: one child per role, start/continue, and nonblocking delivery. */
const TOOL_DESCRIPTION = [
  "Start or continue the one managed subagent for a Hogwarts-loop role; creation uses that role's configured model, while a continuation keeps the child's creation-time model.",
  'Each role has one child per parent session: the first call starts it; later calls send the brief to that same child across checkpoints, idle periods, and reloads. An ambiguous or unusable binding fails instead of starting a duplicate.',
  'Use this instead of `subagent`, `subagent_fork`, or `spawn_teammate` whenever you run the plan→build→review→commit loop: Harry builds a checkpoint, Severus reviews it, Alastor/Filius/Minerva/Argus form the specialist bench, and `voldemort` is the escalation implementer woken for one specific problem the implementer has failed three times (same duties as Harry, stronger model, at most two attempts) — he resolves that problem only and never takes over the rest of the implementer\'s work.',
  "The call returns a child id immediately and does not wait — the child's result arrives later as a completion notice, so start independent dispatches together in one message and keep working.",
  '`prompt` must be the child\'s entire brief: it does not see this conversation.',
].join(' ')

/**
 * Register the skill, the durable binding projection, and the dispatch tool for
 * one activation.
 * @param {any} ctx
 * @param {any} config validated plugin config carrying volatile references
 */
export function apply(ctx, config) {
  const roleNames = ROLE_NAMES
  const dispatcher = createDispatcher(ctx, config)

  ctx.effect(() => ctx.sessionProjections.register(makeBindingsProjection()))

  ctx.effect(() =>
    ctx.skills.register({
      name: 'hogwarts-loop',
      description:
        'Run a full plan→build→review→commit loop for a large engineering effort. Albus (you) reads the spec and writes a checkpoint plan; Harry builds each checkpoint, Severus and the specialist bench review it, and Albus commits only after it passes.',
      whenToUse:
        'Use when the user wants to plan and then execute a large milestone, refactor, or multi-file effort with independent review between build and commit, or when the user invokes /hogwarts-loop.',
      source: 'runtime',
      invocation: { modelInvocable: true, userInvocable: true },
      resourceBase: { kind: 'directory', path: join(HERE, 'skill') },
      content: stripFrontmatter(readFileSync(join(HERE, 'skill', 'SKILL.md'), 'utf8')),
    }),
  )

  ctx.effect(() =>
    ctx.tools.register({
      name: 'hogwarts_dispatch',
      description: TOOL_DESCRIPTION,
      parameters: parameterSchema(roleNames),
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['role', 'action', 'childId'],
          properties: {
            role: { type: 'string' },
            action: { type: 'string', enum: ['started', 'continued'] },
            childId: { type: 'string' },
            provider: { type: 'string' },
            model: { type: 'string' },
          },
        },
        render: (_args, value) => [
          {
            type: 'text',
            text:
              value.action === 'continued'
                ? `continued ${value.role} as subagent ${value.childId}`
                : `started ${value.role} on ${value.provider}/${value.model} as subagent ${value.childId}`,
          },
        ],
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        return dispatcher.execute(args, exec)
      },
    }),
  )
}

export const name = 'hogwarts-loop'
export const inject = ['tools', 'skills', 'subagents', 'llm', 'sessionProjections']
