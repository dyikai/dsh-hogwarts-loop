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
| Finding record, batch validation, convergence cap, and evaluation guide | markdown contract + synthetic seed cases | `skill/references/review-contract.md`, `skill/references/evaluation.md`, `skill/assets/eval-*.md` |
| Create or continue the same cast member within a parent session | the `hogwarts_dispatch` tool | registered by `index.js` |
| Edit provider / model / effort / output cap per role | **Settings → Hogwarts Loop**, plus the Plugins page row for this plugin | `client.js` (browser half) |

```jsonc
// First call creates Harry; after CP1 passes, the next call continues him.
hogwarts_dispatch({ role: "harry", description: "CP1 build", prompt: "<first brief>" })
hogwarts_dispatch({ role: "harry", description: "CP2 build", prompt: "<next brief>" })
```

**One parent session, one child per role.** Checkpoints and fix rounds keep the same `childId`; changing `description`, completing a CP, or becoming inactive does not create a new Harry. Each role is independent, so Harry and Severus retain separate histories. Dispatch is nonblocking: wait for a role's report before assigning its next CP; concurrent calls to that role do not create parallel workers.

Bindings survive plugin reload and resuming the same parent session. A continuation failure never silently creates a replacement. Older histories with ambiguous role bindings require intervention instead of guessing. A genuinely new parent session starts its own cast, rehydrated from the plan.

Results distinguish `started` from `continued`. Creation reports the configured provider/model; continuation identifies the existing child rather than claiming it uses newly edited defaults. `cwd` is creation-only: a non-empty `cwd` on a later call is rejected. Omit it to preserve the child's established working directory. The roster label keeps the first `description`; later briefs do not relabel the child.

## Conditional ablation

The skill requires a complexity report on every Harry delivery. When the
[ablation policy](skill/references/ablation.md) triggers, Harry runs controlled
removal/substitution experiments without weakening acceptance, verifies the
combined survivor, and gives Severus the evidence to audit. This is a workflow
gate, not a runtime code-size scanner; direct manual dispatch skips the skill's
checkpoint discipline. Thresholds and counting rules have one canonical home.

## Review findings and convergence

Review behavior is specified as a **textual workflow contract**, not as host
permissions. The canonical rules are in
[`skill/references/review-contract.md`](skill/references/review-contract.md).

- Every finding keeps **severity** (P1/P2/P3), **evidence status**
  (`candidate` / `confirmed` / `refuted` / `needs-evidence`) and **disposition**
  separate, with a stable ID, provenance, source snapshot, file:line, causal
  chain, the guard checked, and validation evidence.
- Between the review report and the fix relay, Albus batch-validates every
  blocking and security candidate in **one non-origin pass** — not one agent per
  finding. A zero-confirmed-findings report does not silently approve unresolved
  required verification. A confirmed P1 is never waived; P2 waivers are explicit
  and attributed; P3s are carried, not auto-fixed.
- After **three completed review/response cycles** without resolution, automatic
  iteration stops and Albus records an explicit reassessment with preserved
  counters. This checkpoint-wide cap is separate from the same-root Harry (max 3)
  / Voldemort (max 2) attempt limits; neither resets the other and churn alone
  never triggers escalation.
- A lightweight security triage runs every checkpoint; named sensitive surfaces
  (auth/permissions, secrets, untrusted input, CI/release/install, crypto, PII,
  external trust boundaries) require the scoped security lens. The plan carries
  boundary → evidence → owner → budget/stop plus a named human approver and
  rollback owner where policy, release, deployment or migration requires them.
  Model consensus does not replace a required human signoff.
- **Evaluation is lightweight and honest.**
  [`skill/references/evaluation.md`](skill/references/evaluation.md) defines the
  feedback fields and a small **synthetic** seed corpus kept as separate target
  inputs and expected answers. It is not a measured benchmark: accepted fixes are
  not ground truth, and no model score is claimed without actually running the
  comparison on the same frozen snapshot with non-treatment variables held equal
  and the intentional prompt/model/tool/config change recorded.
- **Working plans are not commits.** Checkpoint plans, progress lists and review
  reports default to session memory or a task-scoped temp root outside the
  workspace; they are not committed and are not hidden behind `.gitignore`. A
  user-approved, maintained roadmap/design document is the durable exception.
  `skill/assets/plan-template.md` is a product template, not a per-run commit.

The skill's rules do not install tool ACLs, approval prompts, or runtime state
machinery. Direct manual dispatch bypasses the skill's checkpoint discipline, and
host-level permissions must still be configured at the host.

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
- repeated dispatches to the same role return the same `childId`;
- the child's session log records `agentModel` and `config.model` equal to that role's configured route (for example `harry` on `deepseek-flash`, `severus` on `deepseek-v4-pro`), not the main session's model.

## Configure the cast

**Settings → Hogwarts Loop** (the settings entry at the bottom of the sidebar) is the main entry. It registers as a `settings.section` with order 60.

The same form has a second entry point: **Plugins → Installed plugins → `@dyikai/dsh-hogwarts-loop` → the `hogwarts-loop` row → Configure** (`plugins.row.config`).

The page lists every cast member, one row each: **provider** and **model** are dropdowns fed by the host's model catalog (`remote.session.modelCatalog()`, grouped per provider); switching the provider switches the model to that provider's first entry. **Reasoning effort** is a dropdown built from the levels the selected model actually supports (blank = the model default), and the **max output tokens** field may be left empty. Below them, **Dispatch settings** holds the subagent backend and the delegation depth cap.

Save writes every change as a single atomic, version-fenced `mutate` to this plugin's row in the current profile. **The next newly created role uses it** — no reinstall and no restart. Continuing an existing role preserves its child session and does not apply new creation defaults or replace it to switch models.

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

These two numbers live in the *Escalation* section of [skill/SKILL.md](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/skill/SKILL.md) — the skill text is the rule. The cast itself is defined by `DEFAULT_ROLES` in [index.js](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/index.js). The separate checkpoint-wide three-cycle convergence cap (and its precedence with these attempt limits) is in [skill/references/review-contract.md](skill/references/review-contract.md).

> The form writes this plugin's **profile row** (the `hogwarts-loop` entry in `cordis.patch.yml`). Editing that row's `config` by hand or in bulk works too; the field definitions are the `Config` export in `index.js`.

**Albus is you** — the main session. Its model is chosen by the session's model picker and is not controlled by this plugin; the plugin only decides the route of every subagent it dispatches.

### Why the form looks like this

- The form registers twice — in the settings panel's `settings.section` and in the Plugins page's `plugins.row.config` (key `@dyikai/dsh-hogwarts-loop#hogwarts-loop`) — and both render the same `FormBody`.
- The settings-panel entry resolves this plugin's namespace through the shared `settings.describe` mirror (matching the `hogwarts-loop` suffix, so an `include:` prefix still works) and then gets a version-fenced write handle via `ctx.configForms.get(ns)`. The Plugins entry receives the bound `form` directly from the page, so it never has to guess a namespace.
- On the host side, `Config` marks the two top-level objects `delegation` and `roles` as `.volatile()` (schemastery cannot nest volatile, so the reference has to sit on the object). That is both what makes the settings service treat the entry as editable and serve the settings panel, and what guarantees new role creation reads the **current** defaults rather than a snapshot taken when the plugin activated.
- When the model catalog cannot be read (expired login, failed catalog request), the same fields fall back to text inputs instead of breaking the page.
- A wrong creation-time model is never a silent failure: `hogwarts_dispatch` validates the route before creating a role and returns an actionable tool error.

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
    ├── references/*.md       # planner / implementer / reviewer / loop / example /
    │                         # review-contract / evaluation
    └── assets/
        ├── plan-template.md  # working plan: risk, review ledger, convergence
        ├── eval-inputs.md    # synthetic seed targets (reviewer-safe)
        └── eval-expectations.md  # answers kept separate from the targets
```

## Known limits

- The settings entry is a **page the plugin registers itself** (`settings.section`), not a form the host auto-generates from `Config` — that renderer does not exist in this client version yet (`autoGenerate` is not consumed by any built-in client).
- The first dispatch uses a continuable `spawn` backend; later dispatches resume that child. One-shot backends cannot satisfy the persistent-role contract. `fork`-style backends inherit the parent's route and cannot provide independent per-role model selection.
- `delegation.maxDepth` defaults to `1`: a child cannot dispatch further down.
- Children join the parent session's current agent preset and use its tools.
- The plugin is **profile-level**: install it once and every session in this profile sees `hogwarts_dispatch` and the `hogwarts-loop` skill.

## License

[MIT](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/LICENSE) © [dyikai](https://github.com/dyikai)
