![Hogwarts Loop](https://raw.githubusercontent.com/dyikai/dsh-hogwarts-loop/main/icon.svg)

# dsh-hogwarts-loop

[English](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/README.md)

[![npm version](https://img.shields.io/npm/v/@dyikai/dsh-hogwarts-loop)](https://www.npmjs.com/package/@dyikai/dsh-hogwarts-loop)
[![GitHub stars](https://img.shields.io/github/stars/dyikai/dsh-hogwarts-loop?style=social)](https://github.com/dyikai/dsh-hogwarts-loop)

**把「计划 → 实现 → 审查 → 提交」打包成 [DeepSeek Harness](https://www.deepseek.com/harness/) 插件。** 每个演员一个子代理，并各自跑在**可独立配置的模型**上。

[`@dyikai/dsh-hogwarts-loop`](https://www.npmjs.com/package/@dyikai/dsh-hogwarts-loop) 把 `hogwarts-loop` 那套纪律产品化：让一个大工程以「一个个小 checkpoint、逐个独立验证」的节奏，从计划一路走到评审通过的提交。方法论以 skill 形式提供，每个演员都是通过同一个工具派发的托管子代理，每个角色背后的模型在客户端里配置，而不是写死在提示词里。

## 它带来什么

| 能力 | 形态 | 位置 |
| --- | --- | --- |
| 循环方法论 + 每个角色的详细职责 | `hogwarts-loop` skill（也可用 `/hogwarts-loop` 手动触发） | `skill/SKILL.md`、`skill/references/*.md` |
| 发现记录、批量验证、收敛上限与评估指南 | Markdown 契约 + 合成及仓库来源用例 | `skill/references/review-contract.md`、`skill/references/evaluation.md`、`skill/assets/eval-*.md` |
| 同一父会话内按角色创建或继续原子代理 | `hogwarts_dispatch` 工具 | 由 `index.js` 注册 |
| 按角色编辑 provider / 模型 / 推理强度 / 输出上限 | **设置 → 霍格沃茨循环**，以及 Plugins 页里本插件那一行的 Configure | `client.js`（浏览器半边） |

```jsonc
// 首次创建 Harry；CP1 通过后，再次调用会继续原来的 Harry。
hogwarts_dispatch({ role: "harry", description: "CP1 build", prompt: "…首次简报…" })
hogwarts_dispatch({ role: "harry", description: "CP2 build", prompt: "…下一项简报…" })
```

**同一父 session，每个角色只有一个子会话。** 跨 CP 和修复轮次保持相同 `childId`；改变 `description`、完成 CP、进入 inactive 状态都不会新建 Harry。Harry 和 Severus 等不同角色各自保留独立上下文。派发不等待执行结束：收到该角色的报告后再安排下一个 CP；并发调用同一角色不等于多个并行工作者。

插件重载、恢复同一父 session 后仍会找回原角色。恢复失败不会静默换人；旧历史中存在多个无法唯一确定的角色时会报错，不擅自选择。只有真正的新父 session 才创建新班底，并从计划文档恢复工作背景。

返回结果区分 `started` 和 `continued`：创建时报告所用 provider/model，继续时返回已有 childId，不声称已经套用新默认模型。`cwd` 仅用于首次创建；后续调用携带非空 `cwd` 会被拒绝，请省略它以保留子代理已有的工作目录。列表标签保留首次 `description`，后续简报不会重新命名子代理。

## 条件式消融

技能要求 Harry 每次交付都报告复杂度；触发[消融规则](skill/references/ablation.md)后，
先实际删除或替换设计单元做对照实验，不降低原验收标准，再验证组合后的最终版本，
交给 Severus 审查证据。这是流程门禁，不是运行时自动扫描代码体量；直接手工派发会
跳过技能的 checkpoint 纪律。阈值与计量口径只在上述规则中维护。

## 审查纪律

[评审契约](skill/references/review-contract.md)保留几条核心规则：阻断候选先验证再修复，
保留证据和稳定 ID，修复后独立验证，不反复重审已解决的问题。
完整的“修复→复审”轮次与纯采证批次分别限额；正常取证不再多算一次修复轮次。
满足条件的同问题顾问指导诊断或实施有特定优先规则，不以改代码为前提，不重置累计历史，也不豁免盲目探针 churn 或无关工作（见下文升级路径）。

默认一名审查者。专家针对实际改变的风险或未解决的问题补位，不因碰到某类文件就
自动多派一个角色。必须的人类审批仍须遵守；这些是流程指令，不是 Host 权限或运行时门禁。

[评测指南](skill/references/evaluation.md)区分样例正确性测试与真实的新旧 review 对比。
除合成样例外，还提供[仓库来源的配对及修复重放案例](skill/assets/eval-legacy-inputs.md)，
[来源与评分说明](skill/assets/eval-legacy-expectations.md)与审查上下文隔离。
这些材料和通过的单元测试都不代表模型质量得分。

工作计划、进度和评审报告默认保留在会话或任务级临时目录，不进 Git，也不用
`.gitignore` 隐藏。只有用户明确批准、长期维护的 roadmap/design 文档是持久化例外；
随包提供的计划模板是产品资源，不是填写好的执行报告。

## 安装

需要 Node.js ≥ 20 和一个 DeepSeek Harness profile。

### 用 Add plugin 向导安装

在 **Add plugin** 向导的搜索框里输入 `@dyikai/dsh-hogwarts-loop`，点 **Install**。

### 用 `dsh` CLI 安装

```sh
dsh plugin --profile web add @dyikai/dsh-hogwarts-loop
dsh web
```

无需构建，也无需重启 —— 但注意下面的重新加载说明。

### 从本地 checkout 安装

```text
plugin_manager -> { action: "install_bundle", target: "<path-to-this-repo>" }
```

卸载：

```text
plugin_manager -> { action: "remove_bundle", target: "@dyikai/dsh-hogwarts-loop" }
```

安装后（或改过 `client.js` 之后）**需要重新加载一次页面**，浏览器才会加载客户端模块、设置项才会出现；Host 半边会跟着插件行一起重组。

## 使用

**插件本身不是任务，没有「启动」按钮。** 装进 profile 之后它一直在后台提供三样东西：`hogwarts_dispatch` 工具、`hogwarts-loop` 技能、以及设置页。所以「让它工作」= 触发这个技能，技能再指挥主代理去派发；插件不触发也会在线，只是没人用它。

三种触发方式：

1. **直接调用技能** —— 输入 `/hogwarts-loop`，技能内容会注入当前会话。
2. **说人话** —— 「用 hogwarts loop 把这个里程碑拆成 checkpoint，逐个实现、评审、提交」。技能目录里带描述，任务匹配时模型也会自己加载。
3. **只想手工派发一次** —— 「用 `hogwarts_dispatch` 派 harry 去做 X」。这会直接用插件能力，跳过技能里的 checkpoint / 评审纪律。

怎么确认它真的在干活：

- 会话里出现 `hogwarts_dispatch` 的工具调用；
- 同一角色的后续派发返回相同的 `childId`；
- 子代理的会话日志里 `agentModel` 和 `config.model` 等于该角色配置的模型（例如 `harry` 是 `deepseek-flash`、`severus` 是 `deepseek-v4-pro`），而不是主会话的模型。

## 在客户端配置模型

**设置（侧栏底部的设置入口）→ 「霍格沃茨循环」** 是主入口，注册在设置面板的 `settings.section`（order 60）。

同一个表单还有第二个入口：**Plugins（侧栏）→ Installed plugins → `@dyikai/dsh-hogwarts-loop` → 行 `hogwarts-loop` → Configure**（`plugins.row.config`）。

页面会列出每个演员，每个角色一行：**`Provider` 和 `模型` 都是下拉框**，选项来自 Host 的模型目录（`remote.session.modelCatalog()`，按 provider 分组）；切换 Provider 会自动把模型切到该 provider 下的第一项。`推理强度` 也是下拉框，选项按所选模型实际支持的档位生成（留空＝模型默认）；`最大输出 token` 可填可空。下方还有 `派发设置`（子代理后端、派发深度上限）。

改完点 **保存** —— 所有改动作为一个原子、带版本栅栏的 `mutate` 写入当前 profile 的该条目，**下一次创建新角色时生效**，不需要重装、也不需要重启。继续已有角色时保留原子会话，不套用新的创建默认值，也不会为了切换模型而换人。

默认值（即没有覆盖时的行为）：

| 角色 | 席位 | 默认模型 |
| --- | --- | --- |
| `harry` | 实现者（写代码、跑 gate） | `deepseek-flash` |
| `severus` | 主评审（正确性，只读不改） | `deepseek-v4-pro` |
| `alastor` | 安全评审 | `deepseek-v4-pro` |
| `filius` | 性能评审 | `deepseek-flash` |
| `minerva` | 并发评审 | `deepseek-flash` |
| `argus` | 收尾 UI 走查 | `deepseek-flash` |
| `voldemort` | 单问题升级顾问（只读指导） | `deepseek-v4-pro` |

### 升级路径：Voldemort

Harry 对**同一个尚未解决的问题独立尝试三次**。“同根因”按稳定失败表现和验收标准关联：已知则记录根因，未知则记录待证假设；不要求升级前已经证明精确根因，换诊断假设也不重置次数。每次须有实质方案、实施及验证证据；红 gate 可以直接结束一次失败尝试，不必先绿或先进入评审。实际实施后经确认的同根因 P1 或 P2 失败也可计入；重复命令、进度消息、纯证据探针和不同根因不能凑数。第三次成功不升级；仍失败则 **Harry 必须主动把三次方案和确切失败证据报告 Albus**，不能继续内部独立自试。

Albus 带上验收标准、三次改动及失败、已排除项和当前假设，引入 `voldemort` 作为**只读的单问题升级顾问**。Voldemort 思考、诊断，给出可执行下一步、待验证假设及有界验收信号；不编辑代码、不跑构建测试、不提交、不自判闭环、不接其他 checkpoint。Albus 将方案转交**同一个 Harry 子会话**，Harry 始终负责实施和测试；再由 Albus 把实际结果及失败报告回传 Voldemort 调整思路，Severus 独立关闭修复。

持续协作直到问题解决，**没有固定协作轮数或总尝试上限**。保留前三次及累计历史；Albus 每轮重评，安排有界的诊断**或**实施：依据实际证据提出新／修正假设或诊断问题，指定命令、时间／场景界限和可判定信号。诊断无需先改代码，由 Harry 执行并经 Albus 回传只读顾问；验证现有证据、确认缺陷后才能授权修复。[评审契约](skill/references/review-contract.md)允许该已合法升级问题的指导工作（含纯诊断轮次）超过累计 repair／evidence 数，不因固定次数截停或再次要求人类扩额。未升级的普通 checkpoint 和无关问题仍受原预算约束；不得盲重跑、换标签凑轮或在单批内藏无限重试。范围和必要审批不变；遵守人类停止要求，诚实报告真实权限、环境或外部前置条件阻塞。

[skill/SKILL.md](skill/SKILL.md) 的 *Escalation* 是流程规则，[index.js](index.js) 的 `DEFAULT_ROLES` 定义角色。这些是 **agent 工作契约，不是运行时 ACL 或自动计数器**。Harry/Voldemort 续接会重发当前 persona，旧子角色也一样，不替换 child 或创建时模型；冻结的旧 persona 只用于识别历史身份。

> 表单写入的是 **profile 的该插件条目**（`cordis.patch.yml` 里的 `hogwarts-loop` 行）。想手工改或批量改也可以直接写那行的 `config`，字段定义见 `index.js` 里导出的 `Config`。

**Albus 就是你自己**（主会话），它的模型由会话的模型选择器决定，不由本插件控制；插件只决定它派发出去的每一个子代理。

### 为什么表单长这样

- 表单同时注册到 **设置面板** 的 `settings.section` 和 **Plugins 页** 的 `plugins.row.config`（key = `@dyikai/dsh-hogwarts-loop#hogwarts-loop`），两处渲染同一个 `FormBody`。
- 设置面板那条通过共享的 `settings.describe` 镜像找到本插件条目的命名空间（按 `hogwarts-loop` 后缀匹配，兼容 `include:` 前缀），再用 `ctx.configForms.get(ns)` 取到带版本栅栏的写入入口；Plugins 页那条由页面直接把已绑定的 `form` 传进来，所以完全不用猜命名空间。
- Host 侧导出的 `Config` 把 `delegation` / `roles` 两个**顶层对象**标成 `.volatile()`（schemastery 不允许 volatile 嵌套，引用只能落在对象上）：这既是设置服务把该条目视为「可编辑」并服务于设置面板的前提，也让新角色创建时读到的永远是**当前默认值**，而不是插件激活那一刻的快照。
- 下拉框读不到模型目录时（例如登录态失效、目录请求失败），同一位置会退化成文本框，页面不会因此不可用。
- 创建角色时模型写错不会静默失败：`hogwarts_dispatch` 新建前先校验路由，错误直接作为可操作的工具错误返回。

## 验证真实路由

派发一个角色后，子代理的会话日志会记录真实路由。会话目录在 `~/.dsh/sessions/<encoded-cwd>/<childId>/` 下，其中 `<encoded-cwd>` 是项目路径把分隔符换成短横线后的形式：

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

期望看到 `agentModel` / `config.model` 等于该角色配置的模型。

## 仓库结构

```
.
├── package.json              # @dyikai/dsh-hogwarts-loop；dsh.bundle.patch + dsh.client
├── cordis.patch.yml          # 插入 hogwarts-loop 这一行
├── index.js                  # Host 半边：Config schema、skill 注册、hogwarts_dispatch
├── client.js                 # 浏览器半边：设置面板 + Plugins 页的按角色配置表单
├── locale/{en,zh}.json       # Plugin Manager 里显示的名称与说明
├── icon.svg                  # 插件图标
└── skill/
    ├── SKILL.md              # 循环总览 + 「用 hogwarts_dispatch 派发」
    ├── references/*.md       # planner / implementer / reviewer / loop / example /
    │                         # review-contract / evaluation
    └── assets/
        ├── plan-template.md  # 计划模板：风险、审查台账、收敛计数
        ├── eval-inputs.md    # 合成种子输入（可给审查者）
        ├── eval-expectations.md  # 与输入分离的期望答案
        ├── eval-legacy-inputs.md # 仓库来源的配对／分阶段快照
        └── eval-legacy-expectations.md # 来源、评分与重放方法
```

## 已知边界

- 设置项是**插件自己注册的页面**（`settings.section`），不是 Host 根据 `Config` 自动生成的表单 —— 后者在本版本客户端还没有渲染器（`autoGenerate` 尚未被任何内置客户端消费）。
- 首次派发使用支持继续执行的 `spawn` 后端，后续派发继续原子会话。一次性后端无法满足持久角色约定；`fork` 类后端继承父会话路由，不能提供独立的角色模型选择。
- `delegation.maxDepth` 默认 `1`：子代理不能再往下派发。
- 子代理会加入父会话当前的 agent preset，沿用它那套工具。
- 插件是 **profile 级** 的：装一次，该 profile 下所有会话都能看到 `hogwarts_dispatch` 和 `hogwarts-loop` 技能。

## 许可证

[MIT](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/LICENSE) © [dyikai](https://github.com/dyikai)
