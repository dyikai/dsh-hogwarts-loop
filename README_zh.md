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
| 按角色派发子代理，并强制走该角色配置的模型 | `hogwarts_dispatch` 工具 | 由 `index.js` 注册 |
| 按角色编辑 provider / 模型 / 推理强度 / 输出上限 | **设置 → 霍格沃茨循环**，以及 Plugins 页里本插件那一行的 Configure | `client.js`（浏览器半边） |

```jsonc
// 一次调用 = 一个角色 = 该角色配置的模型
hogwarts_dispatch({ role: "harry",   description: "checkpoint 3 build",  prompt: "…完整简报…" })
hogwarts_dispatch({ role: "severus", description: "review checkpoint 3", prompt: "…完整简报…" })
```

`hogwarts_dispatch` 立刻返回 child id，**不等待**结果；子代理的产出会以完成通知（completion notice）的形式回到主会话。

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
- `list_agents` 能看到你派发的那位演员；
- 子代理的会话日志里 `agentModel` 和 `config.model` 等于该角色配置的模型（例如 `harry` 是 `deepseek-flash`、`severus` 是 `deepseek-v4-pro`），而不是主会话的模型。

## 在客户端配置模型

**设置（侧栏底部的设置入口）→ 「霍格沃茨循环」** 是主入口，注册在设置面板的 `settings.section`（order 60）。

同一个表单还有第二个入口：**Plugins（侧栏）→ Installed plugins → `@dyikai/dsh-hogwarts-loop` → 行 `hogwarts-loop` → Configure**（`plugins.row.config`）。

页面会列出每个演员，每个角色一行：**`Provider` 和 `模型` 都是下拉框**，选项来自 Host 的模型目录（`remote.session.modelCatalog()`，按 provider 分组）；切换 Provider 会自动把模型切到该 provider 下的第一项。`推理强度` 也是下拉框，选项按所选模型实际支持的档位生成（留空＝模型默认）；`最大输出 token` 可填可空。下方还有 `派发设置`（子代理后端、派发深度上限）。

改完点 **保存** —— 所有改动作为一个原子、带版本栅栏的 `mutate` 写入当前 profile 的该条目，**下一次派发立即生效**，不需要重装、也不需要重启。

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

这两组数字写在 [skill/SKILL.md](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/skill/SKILL.md) 的 *Escalation* 一节里（技能文本即规则），角色本身则由 [index.js](https://github.com/dyikai/dsh-hogwarts-loop/blob/main/index.js) 的 `DEFAULT_ROLES` 定义。

> 表单写入的是 **profile 的该插件条目**（`cordis.patch.yml` 里的 `hogwarts-loop` 行）。想手工改或批量改也可以直接写那行的 `config`，字段定义见 `index.js` 里导出的 `Config`。

**Albus 就是你自己**（主会话），它的模型由会话的模型选择器决定，不由本插件控制；插件只决定它派发出去的每一个子代理。

### 为什么表单长这样

- 表单同时注册到 **设置面板** 的 `settings.section` 和 **Plugins 页** 的 `plugins.row.config`（key = `@dyikai/dsh-hogwarts-loop#hogwarts-loop`），两处渲染同一个 `FormBody`。
- 设置面板那条通过共享的 `settings.describe` 镜像找到本插件条目的命名空间（按 `hogwarts-loop` 后缀匹配，兼容 `include:` 前缀），再用 `ctx.configForms.get(ns)` 取到带版本栅栏的写入入口；Plugins 页那条由页面直接把已绑定的 `form` 传进来，所以完全不用猜命名空间。
- Host 侧导出的 `Config` 把 `delegation` / `roles` 两个**顶层对象**标成 `.volatile()`（schemastery 不允许 volatile 嵌套，引用只能落在对象上）：这既是设置服务把该条目视为「可编辑」并服务于设置面板的前提，也让派发时读到的永远是**当前值**，而不是插件激活那一刻的快照。
- 下拉框读不到模型目录时（例如登录态失效、目录请求失败），同一位置会退化成文本框，页面不会因此不可用。
- 模型写错不会静默失败：`hogwarts_dispatch` 派发前先校验路由，错误直接作为工具错误返回，并列出当前已注册的 provider。

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
├── skill/
│   ├── SKILL.md              # 循环总览 + 「用 hogwarts_dispatch 派发」
│   ├── references/*.md       # planner / implementer / reviewer / loop / example
│   └── assets/plan-template.md
└── .agents/skills/hogwarts-loop -> ../../skill   # 项目级 skill（优先级高于用户级）
```

### 为什么 `.agents/skills` 是个软链接

Harness 的 skill 目录按 **层** 归并：同一层内 `project > runtime > user`，而**更近的层整条胜出**。用户级的 `~/.agents/skills/hogwarts-loop` 落在 preset 作用域那一层，优先级高于 Host 插件注册的全局 runtime skill。所以要让 `/hogwarts-loop` 真的指向本项目这份内容，必须把它暴露成 **项目级** skill：`.agents/skills/hogwarts-loop` 软链到 `skill/`，一份内容、两处可见。

插件里的 runtime 注册保留作回退来源（读的是同一个 `skill/SKILL.md`）。

> `.agents/` 常被全局 gitignore 忽略，所以本仓库**不带**这个软链接。克隆后重建一次即可：
>
> ```bash
> mkdir -p .agents/skills && ln -sfn ../../skill .agents/skills/hogwarts-loop
> ```
>
> 不建也能用：插件内置的 runtime 注册会兜底提供 `hogwarts-loop` 技能，只是少了项目层的优先级。

## 已知边界

- 设置项是**插件自己注册的页面**（`settings.section`），不是 Host 根据 `Config` 自动生成的表单 —— 后者在本版本客户端还没有渲染器（`autoGenerate` 尚未被任何内置客户端消费）。
- `hogwarts_dispatch` 用 `spawn`（全新子代理）派发。`fork` 类后端为了复用 KV cache 会继承父会话的路由，**不能**换模型，所以本插件不支持 `fork`。
- `delegation.maxDepth` 默认 `1`：子代理不能再往下派发。
- 子代理会加入父会话当前的 agent preset，沿用它那套工具。
- 插件是 **profile 级** 的：装一次，所有会话都能看到 `hogwarts_dispatch`；但项目级 skill 只在本项目作为 cwd 时被发现。
