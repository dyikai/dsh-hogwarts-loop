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
| Finding record, batch validation, convergence cap, and evaluation guide | markdown contract + synthetic and repository-derived cases | `skill/references/review-contract.md`, `skill/references/evaluation.md`, `skill/assets/eval-*.md` |
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

## Review discipline

The [review contract](skill/references/review-contract.md) keeps a few rules:
validate blocking candidates before repair, preserve evidence and finding IDs,
and independently check the fix rather than repeating the whole review.
Complete repair/re-review rounds and evidence-only batches have separate budgets;
normal proof gathering is not counted as another repair round. Eligible same-root
advisor-guided diagnosis or implementation has a narrow precedence rule, without
a code-edit prerequisite; it is not a budget reset or exemption for blind probe
churn or unrelated work (see Escalation below).

One reviewer is the default. Specialists cover an actual changed risk or unresolved
question, not every file in a broad category. Required human approvals remain in
force. These are workflow instructions, not host permissions or runtime enforcement.

[Evaluation](skill/references/evaluation.md) distinguishes fixture checks from real
before/after review comparisons. A [repository-derived pair and repair replay](skill/assets/eval-legacy-inputs.md)
complements the synthetic cases; [scoring and provenance](skill/assets/eval-legacy-expectations.md)
stay outside reviewer context. None of these artifacts is a model-quality score.

Working plans, progress lists and review reports stay in the session or task-scoped
temporary storage by default, not in Git or behind `.gitignore`. Only an explicitly
approved, maintained roadmap/design document is durable; the shipped plan template
is a product asset, not a filled-in execution report.

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
| `voldemort` | one-problem escalation advisor (read-only) | `deepseek-v4-pro` |

### Escalation: Voldemort

Harry makes **three independent attempts on the same unresolved problem**: each needs a substantive approach, implementation and validation evidence. “Same-root” tracks stable failure and acceptance criteria, with a proven root or unproven hypotheses; exact root proof is not required, and changing diagnostic hypotheses does not reset attempts. A red gate can end a failed attempt before review; confirmed same-root P1 or P2 failures after implementation also qualify. Repeated commands, progress messages, evidence-only probes and different roots do not count. If attempt three succeeds, do not escalate. Otherwise **Harry promptly reports all three approaches and exact failure evidence to Albus**, rather than retrying independently.

Albus brings in `voldemort` as a **read-only one-problem escalation advisor**, with the spec/acceptance, changes and failures from each attempt, ruled-out causes and current hypothesis. Voldemort thinks, diagnoses and provides executable next steps, hypotheses and bounded acceptance signals; he never edits code, runs builds/tests, commits, self-closes a fix or takes other checkpoints. Albus relays advice to **the same Harry child**, who always implements/tests, then relays actual results and failure reports back so Voldemort can adjust. Severus independently closes the fix.

Continue until solved with **no fixed collaboration-round or total-attempt cap**. Preserve the first three attempts and cumulative history. Albus reassesses every round and arranges bounded diagnosis **or** implementation: an evidence-driven new/revised hypothesis or diagnostic question, named commands, time/scenario limits and decidable signals. Diagnosis requires no code edits; Harry executes and reports actual results to the read-only advisor through Albus, and evidence must be validated before authorizing repair. The [review contract](skill/references/review-contract.md) lets such work on this already eligible problem exceed cumulative repair/evidence counts, including diagnostic-only rounds, without recurring human-extension requests. Unescalated checkpoints and unrelated problems retain ordinary budgets; blind probe churn is not licensed. Never hide unlimited retries or blindly repeat ineffective work. Scope and mandatory approvals remain; honor human stops and report real permission, environment or external-prerequisite blockers honestly.

**Guidance ends at independent problem closure, not checkpoint completion.** Albus records the scoped evidence/exit and stops advisor dispatches; Harry continues independently. The same advisor child keeps memory but no standing task. A different problem needs its own three failures and fresh Albus scope/exit brief. [Problem-scoped advisor lifecycle](skill/references/review-contract.md#problem-scoped-advisor-lifecycle) defines target verification and unrelated-red attribution: local closure is not checkpoint APPROVE or permission to commit a red checkpoint.

The *Escalation* section of [skill/SKILL.md](skill/SKILL.md) is the workflow rule; `DEFAULT_ROLES` in [index.js](index.js) defines the cast. These are **agent work contracts, not runtime ACLs or automatic counters**. Harry/Voldemort continuations prepend the current persona, including for historical children, without replacing the child or its creation-time model. Frozen old personas remain for identity matching only.

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
        ├── eval-expectations.md  # answers kept separate from the targets
        ├── eval-legacy-inputs.md # repository-derived paired / staged snapshots
        └── eval-legacy-expectations.md # provenance, scoring and replay protocol
```

## Known limits

- The settings entry is a **page the plugin registers itself** (`settings.section`), not a form the host auto-generates from `Config` — that renderer does not exist in this client version yet (`autoGenerate` is not consumed by any built-in client).
- The first dispatch uses a continuable `spawn` backend; later dispatches resume that child. One-shot backends cannot satisfy the persistent-role contract. `fork`-style backends inherit the parent's route and cannot provide independent per-role model selection.
- `delegation.maxDepth` defaults to `1`: a child cannot dispatch further down.
- Children join the parent session's current agent preset and use its tools.
- The plugin is **profile-level**: install it once and every session in this profile sees `hogwarts_dispatch` and the `hogwarts-loop` skill.

## License

[MIT](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/LICENSE) © [dyikai](https://github.com/dyikai)
