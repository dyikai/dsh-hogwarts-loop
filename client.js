/**
 * Browser half of `@dyikai/dsh-hogwarts-loop`.
 *
 * Registers the plugin's configuration form in two places over the same body:
 *
 * - `settings.section` — a page inside the Settings panel, which finds the
 *   profile entry's settings namespace through the shared describe mirror and
 *   binds `ctx.configForms`.
 * - `plugins.row.config` — the Plugins-page form on the bundle row
 *   (`<package>#<row>`), which the page binds and hands over ready-made.
 *
 * Provider and model are dropdowns fed by the Host model catalog
 * (`remote.session.modelCatalog()`), grouped per provider. When the catalog is
 * unavailable the same fields fall back to text inputs so the page never blocks.
 * Every edit is staged locally and submitted as one revision-fenced `mutate`.
 */

window.__ModuleLoader__.load({
  id: '@dyikai/dsh-hogwarts-loop',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale dictionary namespace owned by this plugin. */
    const NS = 'hogwartsLoop'

    /** Locale strings; the Client locale service routes the active one. */
    const EN = {
      title: 'Hogwarts Loop',
      intro: 'Each role keeps one child per session. Saved model settings apply to newly created roles, not existing children.',
      roles: 'Cast',
      delegation: 'Delegation',
      provider: 'Provider',
      model: 'Model',
      effort: 'Reasoning effort',
      effortDefault: 'Model default',
      maxTokens: 'Max tokens',
      maxTokensPlaceholder: 'Model default',
      backend: 'Backend',
      depth: 'Depth cap',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      loading: 'Loading configuration…',
      missing: 'No settings entry found for this plugin. Namespaces served:',
      unavailable: 'This entry has no client-visible settings namespace.',
      readOnly: 'This profile does not accept settings writes.',
      noForm: 'No editable configuration is attached to this entry.',
      rejected: 'The Host rejected these values. Check that the provider, model, and reasoning effort are all supported by that provider.',
      summary: 'Per-role model routing for the Hogwarts loop.',
      catalogError: 'Model catalog unavailable — type the ids instead.',
      'seat.harry': 'Implementer',
      'seat.severus': 'Reviewer (correctness)',
      'seat.alastor': 'Security',
      'seat.filius': 'Performance',
      'seat.minerva': 'Concurrency',
      'seat.argus': 'UI walkthrough',
      'seat.voldemort': 'Escalation implementer (one problem)',
    }
    const ZH = {
      title: '霍格沃茨循环',
      intro: '同一会话内每个角色复用一个子代理；保存的模型设置仅用于新建角色，不改变已有子会话。',
      roles: '演员表',
      delegation: '派发设置',
      provider: 'Provider',
      model: '模型',
      effort: '推理强度',
      effortDefault: '模型默认',
      maxTokens: '最大输出 token',
      maxTokensPlaceholder: '模型默认',
      backend: '子代理后端',
      depth: '派发深度上限',
      save: '保存',
      saving: '保存中…',
      saved: '已保存',
      loading: '正在读取配置…',
      missing: '没有找到本插件的设置条目。Host 提供的命名空间：',
      unavailable: '该条目没有客户端可见的设置命名空间。',
      readOnly: '当前 profile 不接受设置写入。',
      noForm: '该条目没有可编辑的配置。',
      rejected: 'Host 拒绝了这些值，请检查 Provider / 模型 / 推理强度 是否都是该 provider 支持的值。',
      summary: '霍格沃茨循环的按角色模型配置。',
      catalogError: '读不到模型目录，先手工填 provider / 模型 id。',
      'seat.harry': '实现者',
      'seat.severus': '主评审（正确性）',
      'seat.alastor': '安全评审',
      'seat.filius': '性能评审',
      'seat.minerva': '并发评审',
      'seat.argus': 'UI 走查',
      'seat.voldemort': '升级实现者（只解被升级的单个难题）',
    }

    /** Effort ids used when the catalog does not describe the selected model. */
    const FALLBACK_EFFORTS = ['off', 'low', 'high', 'max']

    const COLORS = {
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      border: 'var(--dsw-alias-border-l1)',
      card: 'var(--dsw-alias-bg-layer-1)',
      input: 'var(--dsw-alias-bg-layer-2)',
      brand: 'var(--dsw-alias-brand-primary)',
      warn: 'var(--dsw-alias-state-warn-primary)',
      error: 'var(--dsw-alias-state-error-primary)',
      success: 'var(--dsw-alias-state-success-primary)',
    }

    const STYLES = {
      wrap: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '2px 0 8px' },
      intro: { margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: COLORS.muted },
      sectionTitle: {
        margin: '4px 0 0',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: COLORS.muted,
      },
      card: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '12px 14px',
        border: `1px solid ${COLORS.border}`,
        borderRadius: '10px',
        background: COLORS.card,
      },
      cardHead: { display: 'flex', alignItems: 'baseline', gap: '8px' },
      roleName: { fontSize: '13px', fontWeight: 600, color: COLORS.text },
      seat: { fontSize: '11.5px', color: COLORS.muted },
      row: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
      field: { display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 160px', minWidth: '140px' },
      label: { fontSize: '11.5px', color: COLORS.muted },
      input: {
        boxSizing: 'border-box',
        width: '100%',
        padding: '6px 9px',
        border: `1px solid ${COLORS.border}`,
        borderRadius: '7px',
        background: COLORS.input,
        color: COLORS.text,
        font: 'inherit',
        fontSize: '12.5px',
        lineHeight: 1.4,
        outline: 'none',
      },
      footer: { display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '2px' },
      note: { margin: 0, fontSize: '12px', color: COLORS.muted },
      status: { fontSize: '12px' },
    }

    /** Stable idle mirror snapshot, so the external store never returns a fresh object. */
    const IDLE_MIRROR = { status: 'idle', view: undefined, error: null }

    /**
     * Read one nested value without assuming the shape is present.
     * @param {unknown} value
     * @param {string[]} path
     */
    function readPath(value, path) {
      let current = value
      for (const key of path) {
        if (current === null || typeof current !== 'object') return undefined
        current = current[key]
      }
      return current
    }

    /** @param {any} t @param {string} key @param {string} fallback */
    function label(t, key, fallback) {
      const text = t(key)
      return typeof text === 'string' && text !== '' && text !== key ? text : fallback
    }

    /**
     * Keep a configured value selectable even when the catalog no longer lists it
     * (an older route, a provider that failed to load), so opening the page never
     * silently rewrites the stored value.
     * @param {Array<[string, string]>} pairs
     * @param {any} current
     * @returns {Array<[string, string]>}
     */
    function withCurrent(pairs, current) {
      if (current === undefined || current === null || current === '') return pairs
      const value = String(current)
      if (pairs.some(([id]) => id === value)) return pairs
      return [[value, value], ...pairs]
    }

    /** @param {{ label: string, value: any, onChange: (v: any) => void, disabled: boolean, placeholder?: string }} props */
    function TextField(props) {
      return h(
        'label',
        { style: STYLES.field },
        h('span', { style: STYLES.label }, props.label),
        h('input', {
          type: 'text',
          value: props.value === undefined || props.value === null ? '' : String(props.value),
          placeholder: props.placeholder,
          disabled: props.disabled,
          spellCheck: false,
          onChange: (event) => props.onChange(event.target.value),
          style: STYLES.input,
        }),
      )
    }

    /** @param {{ label: string, value: any, onChange: (v: any) => void, disabled: boolean, choices: Array<[string, string]> }} props */
    function SelectField(props) {
      return h(
        'label',
        { style: STYLES.field },
        h('span', { style: STYLES.label }, props.label),
        h(
          'select',
          {
            value: props.value === undefined || props.value === null ? '' : String(props.value),
            disabled: props.disabled,
            onChange: (event) => props.onChange(event.target.value),
            style: STYLES.input,
          },
          props.choices.map(([value, text]) => h('option', { key: value, value }, text)),
        ),
      )
    }

    /**
     * Load the Host model catalog (provider groups + advertised models) and keep
     * it fresh: adapter changes and settings commits both change what is routable.
     * @param {any} remote the `remote` client service
     */
    function useModelCatalog(remote) {
      const [catalog, setCatalog] = React.useState({ status: 'loading', groups: [] })
      React.useEffect(() => {
        let alive = true
        const load = () => {
          Promise.resolve()
            .then(() => remote.session.modelCatalog())
            .then((result) => {
              if (!alive) return
              if (result && result.ok && result.value) {
                setCatalog({ status: 'ready', groups: result.value.groups || [] })
                return
              }
              setCatalog((previous) => ({
                status: previous.groups.length > 0 ? 'ready' : 'error',
                groups: previous.groups,
              }))
            })
            .catch(() => {
              if (!alive) return
              setCatalog((previous) => ({
                status: previous.groups.length > 0 ? 'ready' : 'error',
                groups: previous.groups,
              }))
            })
        }
        load()
        const disposers = []
        try {
          disposers.push(remote.$on('llm/adapters-updated', load))
          disposers.push(remote.$on('settings/document-updated', load))
        } catch {
          /* invalidations are an optimization; the initial load still stands */
        }
        return () => {
          alive = false
          for (const dispose of disposers) {
            try {
              dispose()
            } catch {
              /* ignore teardown noise */
            }
          }
        }
      }, [remote])
      return catalog
    }

    /**
     * One role's route editor. Provider and model are dropdowns over the live
     * catalog; changing the provider re-points the model at that provider's first
     * entry when the current model does not belong to it.
     * @param {{ name: string, read: Function, write: Function, t: any, disabled: boolean, catalog: any }} props
     */
    function RoleCard(props) {
      const { name, read, write, t, disabled, catalog } = props
      const at = (field) => ['roles', name, field]

      const groups = catalog.status === 'ready' ? catalog.groups : []
      const provider = read(at('provider'), '')
      const modelId = read(at('model'), '')
      const effort = read(at('reasoningEffort'), '')
      const group = groups.find((entry) => entry && entry.id === provider)
      const models = (group && group.models) || []
      const model = models.find((entry) => entry && entry.id === modelId)
      const efforts = (model && model.reasoning && model.reasoning.efforts) || []
      const dropdowns = groups.length > 0

      const providerChoices = withCurrent(
        groups.map((entry) => [entry.id, entry.name || entry.id]),
        provider,
      )
      const modelChoices = withCurrent(
        models.map((entry) => [entry.id, entry.name || entry.id]),
        modelId,
      )
      const effortPairs =
        efforts.length > 0
          ? efforts.map((entry) => [entry.id, entry.name || entry.id])
          : FALLBACK_EFFORTS.map((id) => [id, id])
      const effortChoices = [
        ['', t('effortDefault')],
        ...withCurrent(effortPairs, effort === '' ? undefined : effort),
      ]

      return h(
        'div',
        { style: STYLES.card },
        h(
          'div',
          { style: STYLES.cardHead },
          h('span', { style: STYLES.roleName }, name),
          h('span', { style: STYLES.seat }, label(t, `seat.${name}`, '')),
        ),
        h(
          'div',
          { style: STYLES.row },
          dropdowns
            ? h(SelectField, {
                label: t('provider'),
                value: provider,
                disabled,
                choices: providerChoices,
                onChange: (next) => {
                  write(at('provider'), next)
                  const nextGroup = groups.find((entry) => entry && entry.id === next)
                  const nextModels = (nextGroup && nextGroup.models) || []
                  if (nextModels.length > 0 && !nextModels.some((entry) => entry.id === modelId)) {
                    write(at('model'), nextModels[0].id)
                  }
                },
              })
            : h(TextField, {
                label: t('provider'),
                value: provider,
                disabled,
                onChange: (next) => write(at('provider'), next),
              }),
          dropdowns
            ? h(SelectField, {
                label: t('model'),
                value: modelId,
                disabled,
                choices: modelChoices,
                onChange: (next) => write(at('model'), next),
              })
            : h(TextField, {
                label: t('model'),
                value: modelId,
                disabled,
                onChange: (next) => write(at('model'), next),
              }),
        ),
        h(
          'div',
          { style: STYLES.row },
          h(SelectField, {
            label: t('effort'),
            value: effort,
            disabled,
            choices: effortChoices,
            onChange: (next) => write(at('reasoningEffort'), next),
          }),
          h(TextField, {
            label: t('maxTokens'),
            value: read(at('maxTokens'), ''),
            disabled,
            placeholder: t('maxTokensPlaceholder'),
            onChange: (next) => {
              const trimmed = String(next).trim()
              write(at('maxTokens'), trimmed === '' ? '' : Number(trimmed))
            },
          }),
        ),
      )
    }

    /**
     * The editable body shared by both registration sites. `state` is a
     * `ConfigFormSnapshot`; `mutate` is the revision-fenced write path.
     * @param {{ state: any, mutate: Function, t: any, catalog: any }} props
     */
    function FormBody(props) {
      const { state, mutate, t, catalog } = props
      const value = (state && state.value) || {}
      const [edits, setEdits] = React.useState({})
      const [phase, setPhase] = React.useState('idle')
      const [message, setMessage] = React.useState('')

      const keyOf = (path) => path.join('.')
      const read = (path, fallback) => {
        const key = keyOf(path)
        if (Object.prototype.hasOwnProperty.call(edits, key)) return edits[key]
        const resolved = readPath(value, path)
        return resolved === undefined || resolved === null ? fallback : resolved
      }
      const write = (path, next) => {
        setEdits((previous) => ({ ...previous, [keyOf(path)]: next }))
        setPhase('idle')
        setMessage('')
      }

      const dirty = Object.keys(edits).length > 0
      const disabled = state !== undefined && state !== null && state.writable === false

      const save = () => {
        const ops = Object.keys(edits).map((key) => {
          const path = key.split('.')
          const next = edits[key]
          if (next === '' || next === undefined || next === null) return { op: 'unset', path }
          return { op: 'set', path, value: next }
        })
        if (ops.length === 0) return
        setPhase('saving')
        Promise.resolve()
          .then(() => mutate(ops, state === undefined || state === null ? undefined : state.revision))
          .then((accepted) => {
            if (accepted) {
              setEdits({})
              setPhase('saved')
              setMessage('')
              return
            }
            setPhase('error')
            setMessage(t('rejected'))
          })
          .catch((error) => {
            setPhase('error')
            setMessage(String((error && error.message) || error))
          })
      }

      const statusColor =
        phase === 'error' ? COLORS.error : phase === 'saved' ? COLORS.success : COLORS.muted
      const statusText =
        phase === 'saving'
          ? t('saving')
          : phase === 'saved'
            ? t('saved')
            : phase === 'error'
              ? message
              : ''

      return h(
        'div',
        { style: STYLES.wrap },
        h('p', { style: STYLES.intro }, t('intro')),
        catalog.status === 'error'
          ? h('p', { style: { ...STYLES.note, color: COLORS.warn } }, t('catalogError'))
          : null,
        h('p', { style: STYLES.sectionTitle }, t('roles')),
        ...Object.keys(value.roles || {}).map((name) =>
          h(RoleCard, { key: name, name, read, write, t, disabled, catalog }),
        ),
        h('p', { style: STYLES.sectionTitle }, t('delegation')),
        h(
          'div',
          { style: STYLES.card },
          h(
            'div',
            { style: STYLES.row },
            h(TextField, {
              label: t('backend'),
              value: read(['delegation', 'provider'], 'spawn'),
              disabled,
              onChange: (next) => write(['delegation', 'provider'], next),
            }),
            h(TextField, {
              label: t('depth'),
              value: read(['delegation', 'maxDepth'], 1),
              disabled,
              onChange: (next) => {
                const trimmed = String(next).trim()
                write(['delegation', 'maxDepth'], trimmed === '' ? '' : Number(trimmed))
              },
            }),
          ),
        ),
        h(
          'div',
          { style: STYLES.footer },
          h(
            'button',
            {
              type: 'button',
              onClick: save,
              disabled: !dirty || disabled || phase === 'saving',
              style: {
                padding: '6px 16px',
                border: `1px solid ${dirty && !disabled ? 'transparent' : COLORS.border}`,
                borderRadius: '7px',
                cursor: dirty && !disabled ? 'pointer' : 'default',
                background: dirty && !disabled ? COLORS.brand : COLORS.input,
                // The brand accent is a light surface in the dark theme, so the
                // label takes the base background color instead of white.
                color: dirty && !disabled ? 'var(--dsw-alias-bg-base)' : COLORS.muted,
                font: 'inherit',
                fontSize: '12.5px',
                fontWeight: 500,
              },
            },
            t('save'),
          ),
          statusText === ''
            ? null
            : h('span', { style: { ...STYLES.status, color: statusColor } }, statusText),
        ),
      )
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.session', 'configForms'],
      apply(ctx) {
        let t = (key) => key
        try {
          ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }))
          t = ctx.locale.bind(NS)
        } catch {
          t = (key) => EN[key] || key
        }

        /** Resolve a string, falling back to the English dictionary. */
        const tr = (key) => {
          try {
            const text = t(key)
            if (typeof text === 'string' && text !== '' && text !== key) return text
          } catch {
            /* fall through */
          }
          return EN[key] || key
        }

        /** The form once a catalog is available (or has failed to load). */
        function CatalogForm(props) {
          const catalog = useModelCatalog(ctx.remote)
          return h(FormBody, { state: props.state, mutate: props.mutate, t: props.t, catalog })
        }

        function BoundForm(props) {
          const form = React.useMemo(() => ctx.configForms.get(props.ns), [props.ns])
          return h(LiveForm, { form, t: tr })
        }

        /** Bind a `ctx.configForms` entry and keep it live. */
        function LiveForm(props) {
          const form = props.form
          const t = props.t
          const subscribe = React.useCallback((listener) => form.subscribe(listener), [form])
          const getSnapshot = React.useCallback(() => form.getSnapshot(), [form])
          const state = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
          const mutate = React.useCallback((ops, revision) => form.mutate(ops, revision), [form])
          if (!state || state.status === 'loading') return h('p', { style: STYLES.note }, t('loading'))
          if (state.status === 'unavailable') return h('p', { style: STYLES.note }, t('unavailable'))
          return h(
            React.Fragment,
            null,
            state.writable === false
              ? h('p', { style: { ...STYLES.note, color: COLORS.warn } }, t('readOnly'))
              : null,
            h(CatalogForm, { state, mutate, t }),
          )
        }

        /**
         * Pick this plugin's settings namespace out of the shared describe mirror.
         * The Host names a namespace after its profile entry (the loader may
         * prefix the row with its include), so match the name first and fall back
         * to the shape of our own config value.
         * @param {any[]} rows
         * @returns {string | undefined}
         */
        function pickNamespace(rows) {
          for (const row of rows) {
            const ns = row && row.ns
            if (
              typeof ns === 'string' &&
              (ns === 'hogwarts-loop' || ns.endsWith(':hogwarts-loop') || ns.endsWith('/hogwarts-loop'))
            ) {
              return ns
            }
          }
          for (const row of rows) {
            const value = row && row.value
            if (
              value !== null &&
              typeof value === 'object' &&
              value.roles !== null &&
              typeof value.roles === 'object' &&
              Object.prototype.hasOwnProperty.call(value.roles, 'harry')
            ) {
              return row.ns
            }
          }
          return undefined
        }

        /** Live mirror of the Host settings document. */
        function useDescribe() {
          const face = React.useMemo(() => {
            try {
              return ctx.configForms.describe()
            } catch {
              return undefined
            }
          }, [])
          const subscribe = React.useCallback(
            (listener) => (face === undefined ? () => {} : face.subscribe(listener)),
            [face],
          )
          const getSnapshot = React.useCallback(
            () => (face === undefined ? IDLE_MIRROR : face.getSnapshot()),
            [face],
          )
          const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
          React.useEffect(() => {
            if (face !== undefined) Promise.resolve(face.ensure()).catch(() => {})
          }, [face])
          return snapshot
        }

        /** The Settings-panel section. */
        function SettingsSection() {
          const snapshot = useDescribe()
          const rows = (snapshot && snapshot.view && snapshot.view.namespaces) || []
          const ns = pickNamespace(rows)
          if (ns !== undefined) return h(BoundForm, { key: ns, ns })
          if (snapshot && snapshot.status === 'ready') {
            const listed = rows
              .map((row) => (row && row.ns) || '')
              .filter((name) => name !== '')
              .join(', ')
            return h('p', { style: STYLES.note }, `${tr('missing')} [${listed || '-'}]`)
          }
          return h('p', { style: STYLES.note }, tr('loading'))
        }

        /** The Plugins-page row form: the page hands over a bound form. */
        const PluginsRowConfig = (props) => {
          if (props.view === 'summary') return h('span', null, tr('summary'))
          const form = props.form
          if (form === undefined || form === null) {
            return h('p', { style: STYLES.note }, tr('noForm'))
          }
          const state = form.state
          if (!state || state.status === 'loading') return h('p', { style: STYLES.note }, tr('loading'))
          if (state.status === 'unavailable') return h('p', { style: STYLES.note }, tr('unavailable'))
          return h(
            React.Fragment,
            null,
            state.writable === false
              ? h('p', { style: { ...STYLES.note, color: COLORS.warn } }, tr('readOnly'))
              : null,
            h(CatalogForm, { state, mutate: form.mutate, t: tr }),
          )
        }

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'hogwarts-loop',
              order: 62,
              label: () => label(tr, 'title', 'Hogwarts Loop'),
              locale: NS,
            },
            SettingsSection,
          ),
        )

        ctx.slots.inject('plugins.row.config', () =>
          ctx.slots.register(
            {
              name: 'plugins.row.config',
              key: '@dyikai/dsh-hogwarts-loop#hogwarts-loop',
              locale: NS,
            },
            PluginsRowConfig,
          ),
        )
      },
    }
  },
})
