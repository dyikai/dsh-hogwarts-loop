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
| 发现记录、批量验证、收敛上限与评估指南 | Markdown 契约 + 合成种子用例 | `skill/references/review-contract.md`、`skill/references/evaluation.md`、`skill/assets/eval-*.md` |
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

## 审查发现与收敛

审查行为是一套**文本化流程契约**，不是 Host 的权限机制。规范定义见
[`skill/references/review-contract.md`](skill/references/review-contract.md)。

- 每条发现分开记录**严重级**（P1/P2/P3）、**证据状态**
  （`candidate` / `confirmed` / `refuted` / `needs-evidence`）与**处置**
  （修复、显式豁免、结转、关闭、转出范围等），并带稳定 ID、来源快照、
  provenance（既有 / 本 CP 引入 / 修复引入）、触发输入、file:line、因果链、
  已检查的既有防护或反例、验证责任人与证据。
- 审查报告与修复转交之间，Albus 对**所有阻断候选和安全候选做一次非原始报告者的
  批量验证**，不是一条发现派一个代理。即使没有 confirmed P1/P2，只要仍有必需的
  未决验证，也不能静默通过。confirmed P1 永不豁免；P2 豁免必须显式、具名、限定范围；
  P3 只结转，不自动做无关修饰。
- 同一 checkpoint 完成**三轮 review/response 仍未收敛**时，停止自动进入下一轮，
  由 Albus 做显式重评估并保留计数器。它与同根因的 Harry（最多 3 次）/ Voldemort
  （最多 2 次）尝试上限是不同维度：互不重置，也不因为审查反复而升级。
- 每个 checkpoint 都做轻量安全分诊；出现具名敏感面（权限/鉴权、密钥、不可信输入、
  CI/发布/安装、加密、PII、外部信任边界）时必须启用限定范围的安全审查。计划里要写
  boundary → evidence → owner → budget/stop，以及在策略、发布、部署或迁移需要时
  指名的人类审批人和回滚责任人；模型共识不能替代必须的人类签核。
- **评估是轻量且诚实的。** [`skill/references/evaluation.md`](skill/references/evaluation.md)
  定义反馈字段和一组**合成**种子用例，目标输入与期望答案分开保存。它不是实测基准：
  被接受的修复不等于 ground truth，未真正跑过同一冻结快照、保持非处理变量一致并记录
  有意改变的 prompt/model/tool/config 的对比，就不声称
  任何模型得分。
- **工作用计划不进默认提交。** checkpoint 计划、进度清单、审查报告默认放会话记忆或
  工作区外的任务级临时目录，不提交，也不用 `.gitignore` 掩盖；只有用户明确批准、
  长期维护的 roadmap/design 文档才是持久化例外。`skill/assets/plan-template.md`
  是产品模板，不是每次运行的提交物。

这些规则不会安装工具 ACL、审批提示或运行时状态机；直接手工派发会绕过技能的
checkpoint 纪律，Host 级权限仍需在 Host 配置。

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
| `voldemort` | 升级实现者（只解被升级的单个难题） | `deepseek-v4-pro` |

### 升级路径：Voldemort

给 Harry 的问题**最多三次尝试**（一次尝试 = 一轮 build → gate → review）。三次都没通过（gate 仍红，或 Severus 对**同一个根因**继续给 P1），就把这个问题**升级一次**给 `voldemort`，升级简报必须带上：checkpoint 验收标准、三次各自改了什么、每次的确切失败证据、已经排除的可能。

Voldemort 与 Harry **是完全相同的实现者**：同样的 checkpoint scope、同样的 gate、同样的「绿树 + 原始证据」、同样不提交；区别只有模型更强、以及他拿到的是三次失败的历史。他的授权是**一个具体问题，不是整份清单**：只改这个问题需要改的东西，不接手剩下的 checkpoint，不「顺手清理」，问题修好并通过 Severus 之后控制权就回到 Harry。他**最多两次尝试**，成果同样要过 Severus 才能提交。两次都失败就**停下来**：汇报问题、五次尝试（3 + 2）、证据、已排除项和可选方案 —— 不会再派第四次 Harry，也不会派第三次 Voldemort，更不会为了让 gate 变绿而偷偷扩大范围。

这两组数字写在 [skill/SKILL.md](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/skill/SKILL.md) 的 *Escalation* 一节里（技能文本即规则），角色本身则由 [index.js](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/index.js) 的 `DEFAULT_ROLES` 定义。另有一个**每 checkpoint 三轮 review/response 的收敛上限**，以及它与上述尝试上限的优先级规则，见 [skill/references/review-contract.md](skill/references/review-contract.md)。

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
        └── eval-expectations.md  # 与输入分离的期望答案
```

## 已知边界

- 设置项是**插件自己注册的页面**（`settings.section`），不是 Host 根据 `Config` 自动生成的表单 —— 后者在本版本客户端还没有渲染器（`autoGenerate` 尚未被任何内置客户端消费）。
- 首次派发使用支持继续执行的 `spawn` 后端，后续派发继续原子会话。一次性后端无法满足持久角色约定；`fork` 类后端继承父会话路由，不能提供独立的角色模型选择。
- `delegation.maxDepth` 默认 `1`：子代理不能再往下派发。
- 子代理会加入父会话当前的 agent preset，沿用它那套工具。
- 插件是 **profile 级** 的：装一次，该 profile 下所有会话都能看到 `hogwarts_dispatch` 和 `hogwarts-loop` 技能。

## 许可证

[MIT](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/LICENSE) © [dyikai](https://github.com/dyikai)
