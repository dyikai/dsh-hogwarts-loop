![Hogwarts Loop](https://raw.githubusercontent.com/dyikai/dsh-hogwarts-loop/main/icon.svg)

# dsh-hogwarts-loop

[中文](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/README_zh.md)

[![npm version](https://img.shields.io/npm/v/@dyikai/dsh-hogwarts-loop)](https://www.npmjs.com/package/@dyikai/dsh-hogwarts-loop)
[![GitHub stars](https://img.shields.io/github/stars/dyikai/dsh-hogwarts-loop?style=social)](https://github.com/dyikai/dsh-hogwarts-loop)

**Plan → build → review → commit, as a [DeepSeek Harness](https://www.deepseek.com/harness/) plugin.** One subagent per cast member, each dispatched on **its own configurable model**.

[`@dyikai/dsh-hogwarts-loop`](https://www.npmjs.com/package/@dyikai/dsh-hogwarts-loop) packages the `hogwarts-loop` discipline: take a large engineering effort from a plan to reviewed, committed code in small, independently verified checkpoints. The methodology ships as a skill, every cast member is a managed subagent started through one tool, and the model behind each role is set in the client instead of being baked into the prompt.

## What it adds

| Capability | Form | Where it lives |
| --- | --- | --- |
| The loop methodology and each role's detailed duties | the `hogwarts-loop` skill (also triggerable as `/hogwarts-loop`) | `skill/SKILL.md`, `skill/references/*.md` |
| Start one cast member on that role's configured model | the `hogwarts_dispatch` tool | registered by `index.js` |
| Edit provider / model / effort / output cap per role | **Settings → Hogwarts Loop**, plus the Plugins page row for this plugin | `client.js` (browser half) |

```jsonc
// one call = one role = that role's configured model
hogwarts_dispatch({ role: "harry",   description: "checkpoint 3 build",  prompt: "<full brief>" })
hogwarts_dispatch({ role: "severus", description: "review checkpoint 3", prompt: "<full brief>" })
```

`hogwarts_dispatch` returns a child id immediately and does **not** wait. The child's result arrives later as a completion notice in the main session.

## Install

Requires Node.js ≥ 20 and a DeepSeek Harness profile.

### From the Add plugin wizard

Type `@dyikai/dsh-hogwarts-loop` into the **Add plugin** wizard's search box and click **Install**.

### With the `dsh` CLI

```sh
dsh plugin --profile web add @dyikai/dsh-hogwarts-loop
dsh web
```

No build step and no restart, but see the reload note below.

### From a local checkout

```text
plugin_manager -> { action: "install_bundle", target: "<path-to-this-repo>" }
```

To uninstall:

```text
plugin_manager -> { action: "remove_bundle", target: "@dyikai/dsh-hogwarts-loop" }
```

After installing — or after changing `client.js` — **reload the page once** so the browser half loads and the settings section appears. The host half reassembles together with the plugin row.

## Use it

The plugin is not a task and has no start button. Once installed it is always present, providing three things: the `hogwarts_dispatch` tool, the `hogwarts-loop` skill, and the settings page. "Making it work" means triggering the skill, which in turn directs the main agent to dispatch. The plugin stays loaded even when nobody triggers it.

Three ways in:

1. **Call the skill directly** — type `/hogwarts-loop` and its content is injected into the current session.
2. **Say what you want** — *"plan this milestone with the hogwarts loop, then implement, review and commit each checkpoint"*. The skill carries a description, so the model also loads it by itself when a task matches.
3. **Dispatch once by hand** — *"use `hogwarts_dispatch` to send harry to do X"*. This uses the plugin directly and skips the checkpoint / review discipline in the skill.

How to tell it is really working:

- a `hogwarts_dispatch` tool call shows up in the session;
- `list_agents` lists the cast member you dispatched;
- the child's session log records `agentModel` and `config.model` equal to that role's configured route (for example `harry` on `deepseek-flash`, `severus` on `deepseek-v4-pro`), not the main session's model.

## Configure the cast

**Settings → Hogwarts Loop** (the settings entry at the bottom of the sidebar) is the main entry. It registers as a `settings.section` with order 60.

The same form has a second entry point: **Plugins → Installed plugins → `@dyikai/dsh-hogwarts-loop` → the `hogwarts-loop` row → Configure** (`plugins.row.config`).

The page lists every cast member, one row each: **provider** and **model** are dropdowns fed by the host's model catalog (`remote.session.modelCatalog()`, grouped per provider); switching the provider switches the model to that provider's first entry. **Reasoning effort** is a dropdown built from the levels the selected model actually supports (blank = the model default), and the **max output tokens** field may be left empty. Below them, **Dispatch settings** holds the subagent backend and the delegation depth cap.

Save writes every change as a single atomic, version-fenced `mutate` to this plugin's row in the current profile. **The next dispatch uses it immediately** — no reinstall and no restart.

Defaults (the behaviour when nothing is overridden):

| Role | Seat | Default model |
| --- | --- | --- |
| `harry` | implementer (writes the code, runs the gates) | `deepseek-flash` |
| `severus` | reviewer (correctness lead; read-only) | `deepseek-v4-pro` |
| `alastor` | security specialist | `deepseek-v4-pro` |
| `filius` | performance specialist | `deepseek-flash` |
| `minerva` | concurrency specialist | `deepseek-flash` |
| `argus` | closeout UI walkthrough | `deepseek-flash` |
| `voldemort` | escalation implementer (one escalated problem only) | `deepseek-v4-pro` |

### Escalation: Voldemort

Harry gets **at most three attempts** at a problem (one attempt = one build → gate → review round). If all three fail — the gate is still red, or Severus keeps raising the **same root cause** as P1 — the problem is escalated **once** to `voldemort`. The escalation brief must carry the checkpoint acceptance criteria, what each of the three attempts changed, the exact failure evidence for each, and the possibilities already ruled out.

Voldemort is **exactly the same implementer as Harry**: same checkpoint scope, same gates, same "green tree plus raw evidence", and he does not commit either. The only differences are a stronger model and the history of three failed attempts. His mandate is **one specific problem, not the whole checklist**: he changes what that problem needs, he does not take over the remaining checkpoints, he does not "clean up while he is here", and once the problem is fixed and has passed Severus, control returns to Harry. He gets **at most two attempts**, and his work must also pass Severus before it is committed. If both fail, the loop **stops**: report the problem, the five attempts (3 + 2), the evidence, what was ruled out, and the options — no fourth Harry, no third Voldemort, and no quietly widening the scope to turn the gates green.

These two numbers live in the *Escalation* section of [skill/SKILL.md](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/skill/SKILL.md) — the skill text is the rule. The cast itself is defined by `DEFAULT_ROLES` in [index.js](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/index.js).

> The form writes this plugin's **profile row** (the `hogwarts-loop` entry in `cordis.patch.yml`). Editing that row's `config` by hand or in bulk works too; the field definitions are the `Config` export in `index.js`.

**Albus is you** — the main session. Its model is chosen by the session's model picker and is not controlled by this plugin; the plugin only decides the route of every subagent it dispatches.

### Why the form looks like this

- The form registers twice — in the settings panel's `settings.section` and in the Plugins page's `plugins.row.config` (key `@dyikai/dsh-hogwarts-loop#hogwarts-loop`) — and both render the same `FormBody`.
- The settings-panel entry resolves this plugin's namespace through the shared `settings.describe` mirror (matching the `hogwarts-loop` suffix, so an `include:` prefix still works) and then gets a version-fenced write handle via `ctx.configForms.get(ns)`. The Plugins entry receives the bound `form` directly from the page, so it never has to guess a namespace.
- On the host side, `Config` marks the two top-level objects `delegation` and `roles` as `.volatile()` (schemastery cannot nest volatile, so the reference has to sit on the object). That is both what makes the settings service treat the entry as editable and serve the settings panel, and what guarantees dispatch reads the **current** value rather than a snapshot taken when the plugin activated.
- When the model catalog cannot be read (expired login, failed catalog request), the same fields fall back to text inputs instead of breaking the page.
- A wrong model is never a silent failure: `hogwarts_dispatch` validates the route before dispatching, and returns the error as a tool error with the list of currently registered providers.

## Verify the routing

After dispatching a role, the child's session log records the real route. Session directories live under `~/.dsh/sessions/<encoded-cwd>/<childId>/`, where `<encoded-cwd>` is the project path with separators turned into dashes:

```bash
node -e '
const fs = require("node:fs"), zlib = require("node:zlib");
const base = `${process.env.HOME}/.dsh/sessions/<encoded-cwd>/<childId>`;
const f = fs.readdirSync(base).find((n) => n.endsWith(".zstd"));
const ev = zlib.zstdDecompressSync(fs.readFileSync(`${base}/${f}`))
  .toString("utf8").split("\n").filter(Boolean).map(JSON.parse);
console.log(ev.find((e) => e.type === "subagent/descriptor")?.data);
console.log(ev.find((e) => e.type === "request/header")?.data.header.config);
'
```

Expect `agentModel` / `config.model` to equal that role's configured model.

## Repository layout

```
.
├── package.json              # @dyikai/dsh-hogwarts-loop; dsh.bundle.patch + dsh.client
├── cordis.patch.yml          # inserts the hogwarts-loop row
├── index.js                  # host half: Config schema, skill registration, hogwarts_dispatch
├── client.js                 # browser half: per-role config form in Settings and on the Plugins page
├── locale/{en,zh}.json       # plugin name and description in the Plugin Manager
├── icon.svg                  # plugin icon
└── skill/
    ├── SKILL.md              # the loop overview + "dispatch with hogwarts_dispatch"
    ├── references/*.md       # planner / implementer / reviewer / loop / example
    └── assets/plan-template.md
```

## Known limits

- The settings entry is a **page the plugin registers itself** (`settings.section`), not a form the host auto-generates from `Config` — that renderer does not exist in this client version yet (`autoGenerate` is not consumed by any built-in client).
- `hogwarts_dispatch` dispatches with `spawn` (a fresh subagent). `fork`-style backends inherit the parent session's route to reuse the KV cache and therefore **cannot** retarget the model, so this plugin does not support `fork`.
- `delegation.maxDepth` defaults to `1`: a child cannot dispatch further down.
- Children join the parent session's current agent preset and use its tools.
- The plugin is **profile-level**: install it once and every session in this profile sees `hogwarts_dispatch` and the `hogwarts-loop` skill.

## License

[MIT](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/LICENSE) © [dyikai](https://github.com/dyikai)
