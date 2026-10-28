/**
 * Host half of `@local/dsh-hogwarts-loop`.
 *
 * Registers two profile-wide capabilities:
 *
 * 1. the `hogwarts-loop` runtime skill — the plan → build → review → commit
 *    discipline with its `references/` and `assets/` kept beside this package;
 * 2. the `hogwarts_dispatch` tool — starts one managed subagent per cast role on
 *    that role's *configured* LLM route, which is the whole point of the bundle.
 *
 * The exported `Config` is what makes the cast editable in the client: the
 * Settings/Plugins config page (`client.js`) renders those fields and writes them
 * into this profile entry, so the row carries the per-role routes. Every field
 * is `.volatile()`, which is both what the form exposes and what lets this
 * plugin read the current value at dispatch time instead of freezing it at
 * activation.
 *
 * @module @local/dsh-hogwarts-loop
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'

/** Package directory; `skill/` is resolved from here. */
const HERE = import.meta.dirname

/**
 * The fixed cast. `seat` names the responsibility, `persona` opens every brief
 * this role receives, and `provider`/`model` are the route defaults the Config
 * schema publishes.
 */
const DEFAULT_ROLES = {
  harry: {
    seat: 'implementer',
    provider: 'deepseek-official',
    model: 'deepseek-flash',
    persona:
      'You are Harry, the implementer of the Hogwarts loop. You build exactly one checkpoint to spec, run every gate the checkpoint calls for (build, tests, lint, fmt) during development, and hand back a green tree with the raw evidence. You report every deviation from the plan, you stay inside the checkpoint scope, and you never commit.',
  },
  severus: {
    seat: 'reviewer (correctness lead)',
    provider: 'deepseek-official',
    model: 'deepseek-v4-pro',
    persona:
      "You are Severus, the independent reviewer of the Hogwarts loop. You verify the checkpoint against the spec and re-derive it from the source of truth rather than trusting the implementer's summary. Review time is read time: no builds, no test runs, no compiles. You probe adversarially by reading and reasoning, and when a suspicion can only be settled by execution you return a prove-or-refute request instead of running it yourself. You rule — APPROVE or REQUEST-CHANGES with P1/P2/P3 findings — and you never edit code.",
  },
  alastor: {
    seat: 'security specialist',
    provider: 'deepseek-official',
    model: 'deepseek-v4-pro',
    persona:
      'You are Alastor, the security specialist of the reviewer bench. You audit the checkpoint for security and privacy defects — trust boundaries, injection, secrets, authorization, unsafe defaults, data exposure — and you rule only on what you can substantiate by reading. You never edit code.',
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
      'You are Voldemort, the escalation implementer of the Hogwarts loop. You work exactly as Harry does — you build one change to spec, run every gate it calls for (build, tests, lint, fmt) during development, and hand back a green tree with the raw evidence. Two things differ: you run on the stronger model configured for this seat, and you are woken for ONE specific problem the implementer already failed three times — never to take over his remaining work. Your brief names that problem; you fix that problem and nothing else, you do not pick up other checkpoints, you do not "clean up while you are here", and when the problem is resolved and reviewed you stop and hand control back. You report every deviation, you stay inside the escalated scope, and you never commit.',
  },
}

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
        .description('Subagent backend. `spawn` is the only backend that may retarget a child LLM route.'),
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
function composePrompt(persona, task) {
  const brief = task.trim()
  return persona === '' ? brief : `${persona}\n\n---\n\n${brief}`
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
        description: `The cast member to start: ${seats}.`,
      },
      description: {
        type: 'string',
        description: 'Short label for this child, shown in the roster and completion notice (for example `checkpoint 3 build`).',
      },
      prompt: {
        type: 'string',
        description:
          'The complete brief. The child does not see this conversation, so restate the spec, checkpoint scope, repo conventions, gates, and constraints.',
      },
      cwd: {
        type: 'string',
        description: 'Optional absolute working directory for the child; omit to inherit the caller directory.',
      },
    },
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
    throw new Error(
      `Hogwarts role "${roleName}" is configured for provider "${route.provider}", which this profile does not register (registered: ${registered.join(', ')}). ${advice}`,
    )
  }
  try {
    await ctx.llm.resolveModelInfo(route.provider, route.model, signal)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Hogwarts role "${roleName}" is configured for ${route.provider}/${route.model}, which this profile cannot serve: ${detail}. ${advice}`,
    )
  }
}

/** Tool description: what it starts, when to prefer it, and that it does not wait. */
const TOOL_DESCRIPTION = [
  "Start one managed subagent for a Hogwarts-loop role, on that role's configured model.",
  'Use this instead of `subagent`, `subagent_fork`, or `spawn_teammate` whenever you run the plan→build→review→commit loop: Harry builds a checkpoint, Severus reviews it, Alastor/Filius/Minerva/Argus form the specialist bench, and `voldemort` is the escalation implementer woken for one specific problem the implementer has failed three times (same duties as Harry, stronger model, at most two attempts) — he resolves that problem only and never takes over the rest of the implementer\'s work.',
  "The call returns a child id immediately and does not wait — the child's result arrives later as a completion notice, so start independent dispatches together in one message and keep working.",
  '`prompt` must be the child\'s entire brief: it does not see this conversation.',
].join(' ')

/**
 * Register the skill and the dispatch tool for one activation.
 * @param {any} ctx
 * @param {any} config validated plugin config carrying volatile references
 */
export function apply(ctx, config) {
  const roleNames = Object.keys(DEFAULT_ROLES)
  // `roles` and `delegation` are the volatile fields: the Loader hands over a
  // stable reference whose `get()` resolves the current value, so every read
  // below goes through `readRef` instead of touching the wrapper.
  const rolesRef = config?.roles
  const delegationRef = config?.delegation

  /**
   * Current route for one role, read from the live configuration.
   * @param {string} roleName
   */
  function currentRoute(roleName) {
    const defaults = DEFAULT_ROLES[roleName]
    const roles = readRef(rolesRef, {})
    const node = (roles !== null && typeof roles === 'object' && roles[roleName]) || {}
    return {
      provider: readRef(node.provider, defaults.provider),
      model: readRef(node.model, defaults.model),
      reasoningEffort: readRef(node.reasoningEffort, undefined),
      maxTokens: readRef(node.maxTokens, undefined),
    }
  }

  function currentDelegation() {
    const node = readRef(delegationRef, {})
    const view = node !== null && typeof node === 'object' ? node : {}
    return {
      provider: readRef(view.provider, 'spawn'),
      maxDepth: readRef(view.maxDepth, 1),
    }
  }

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
          required: ['role', 'provider', 'model', 'childId'],
          properties: {
            role: { type: 'string' },
            provider: { type: 'string' },
            model: { type: 'string' },
            childId: { type: 'string' },
          },
        },
        render: (_args, value) => [
          {
            type: 'text',
            text: `started ${value.role} on ${value.provider}/${value.model} as subagent ${value.childId}`,
          },
        ],
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const defaults = DEFAULT_ROLES[args.role]
        if (defaults === undefined) {
          throw new Error(
            `unknown Hogwarts role "${args.role}"; configured roles: ${roleNames.join(', ')}`,
          )
        }
        if (exec.agent === undefined) {
          throw new Error('hogwarts_dispatch requires an owning agent session')
        }

        const route = currentRoute(args.role)
        await validateRoute(ctx, args.role, route, exec.signal)

        /** @type {Record<string, unknown>} */
        const agentOptions = { provider: route.provider, model: route.model }
        const effort = route.reasoningEffort
        if (typeof effort === 'string' && effort !== '') agentOptions.reasoningEffort = effort
        if (typeof route.maxTokens === 'number' && route.maxTokens > 0) agentOptions.maxTokens = route.maxTokens

        /** @type {Record<string, unknown>} */
        const request = {
          prompt: [{ type: 'text', text: composePrompt(defaults.persona, args.prompt) }],
          parent: exec.agent,
          agentOptions,
        }
        if (typeof args.cwd === 'string' && args.cwd !== '') request.cwd = args.cwd

        const delegation = currentDelegation()
        const maxDepth = ctx.subagents.resolveMaxDepth(delegation.maxDepth)
        if (maxDepth !== undefined) request.maxDepth = maxDepth

        const label = (typeof args.description === 'string' && args.description.trim() !== ''
          ? args.description.trim()
          : defaults.seat
        ).slice(0, LABEL_LIMIT)

        const activation = await ctx.subagents.startActivation({
          provider: delegation.provider,
          label,
          request,
          signal: exec.signal,
          delivery: 'parent',
        })

        // The runtime owns outcome reporting and cleanup; this secondary handle
        // only exists to keep an unobserved rejection from surfacing as noise.
        Promise.resolve(activation.result).catch(() => {})

        return {
          role: args.role,
          provider: route.provider,
          model: route.model,
          childId: String(activation.childId),
        }
      },
    }),
  )
}

export const name = 'hogwarts-loop'
export const inject = ['tools', 'skills', 'subagents', 'llm']
