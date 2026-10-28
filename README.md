# dsh-hogwarts

把 `hogwarts-loop` 那套「计划 → 实现 → 审查 → 提交」的大工程节奏，打包成 **当前项目的 DeepSeek Harness 插件**：每个角色（Harry / Severus / 教授评审席）都是一个独立子代理，并且**每个角色的模型都能在客户端里配置**。

装好之后，模型拿到两样东西：

| 能力 | 形态 | 位置 |
| --- | --- | --- |
| 循环方法论 + 每个角色的详细职责 | `hogwarts-loop` skill（`/hogwarts-loop` 可手动触发） | `.agents/skills/hogwarts-loop/` → `skill/` |
| 按角色派发子代理，并强制走该角色配置的模型 | `hogwarts_dispatch` 工具 | 本插件 `index.js`（随 profile 加载） |

```jsonc
// 一次调用 = 一个角色 = 该角色配置的模型
hogwarts_dispatch({ role: "harry",   description: "checkpoint 3 build",  prompt: "…完整简报…" })
hogwarts_dispatch({ role: "severus", description: "review checkpoint 3", prompt: "…完整简报…" })
```

`hogwarts_dispatch` 立刻返回 child id，**不等待**结果；子代理的产出会以完成通知（completion notice）的形式回到 Albus 的会话里。

## 如何触发

**插件本身不是任务，没有「启动」按钮。** 装进 profile 之后它一直在后台提供三样东西：
`hogwarts_dispatch` 工具、`hogwarts-loop` 技能、以及设置页。所以「让它工作」= 触发这个技能，
技能再指挥 Albus 去调工具；插件不触发也会在线，只是没人用它。

三种触发方式：

1. **直接调用技能**：输入 `/hogwarts-loop`，技能内容会注入当前会话。
2. **说人话**：「用 hogwarts loop 把这个里程碑拆成 checkpoint，逐个实现、评审、提交」。
   技能目录里带描述，任务匹配时模型也会自己加载。
3. **只想手工派发一次**：「用 `hogwarts_dispatch` 派 harry 去做 X」——这会直接用插件能力，
   跳过技能里的 checkpoint / 评审纪律。

怎么确认用的是**项目里这份**技能（而不是 `~/.agents/skills` 里那份旧的）：

- 注入的技能资源里 `Base directory` 应是
  `/Users/dyikai/Desktop/Projects/Personal/dsh-hogwarts/.agents/skills/hogwarts-loop`；
- 内容里应有 `### Escalation: Voldemort` 一节（旧版没有），以及
  「Settings → Hogwarts Loop」这类配置指引。

怎么确认插件真的在干活：

- 会话里出现 `hogwarts_dispatch` 的工具调用；
- 子代理会话日志的 `subagent/descriptor` 里 `agentModel` 等于该角色配置的模型
  （例如 `harry` 是 `deepseek-flash`、`severus` 是 `deepseek-v4-pro`）；
- 派发后用 `list_agents` 能看到对应名字的队友。

## 在客户端配置模型

**Settings（侧栏底部的设置入口） → 「霍格沃茨循环」**。这是主入口，注册在设置面板的 `settings.section`（order 60）。

同一个表单还有第二个入口：**Plugins（侧栏） → Installed plugins → `@local/dsh-hogwarts-loop` → 行 `hogwarts-loop` → Configure**（`plugins.row.config`）。

页面会列出 6 个演员，每个角色一行：**`Provider` 和 `模型` 都是下拉框**，选项来自 Host 的模型目录（`remote.session.modelCatalog()`，按 provider 分组）；切换 Provider 会自动把模型切到该 provider 下的第一项。`推理强度` 也是下拉框，选项按所选模型实际支持的档位生成（留空＝模型默认）；`最大输出 token` 可填可空。下方还有 `派发设置`（子代理后端、派发深度上限）。改完点 **保存** —— 所有改动作为一个原子 `mutate` 写入当前 profile 的该条目，带版本栅栏；**下一次派发立即生效**，不需要重装、也不需要重启。

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

给 Harry 的问题**最多三次尝试**（一次尝试 = 一轮 build → gate → review）。三次都没通过
（gate 仍红，或 Severus 对**同一个根因**继续给 P1），就把这个问题**升级一次**给
`voldemort`，升级简报必须带上：checkpoint 验收标准、三次各自改了什么、每次的确切失败证据、
已经排除的可能。

Voldemort 与 Harry **是完全相同的实现者**：同样的 checkpoint scope、同样的 gate、同样的「绿树 + 原始证据」、同样不提交；区别只有模型更强、以及他拿到的是三次失败的历史。他的授权是**一个具体问题，不是整份清单**：只改这个问题需要改的东西，不接手剩下的 checkpoint，不「顺手清理」，问题修好并通过 Severus 之后控制权就回到 Harry。他**最多两次尝试**，成果同样要过 Severus 才能提交。两次都失败就**停下来**：
向你汇报问题、五次尝试（3 + 2）、证据、已排除项和可选方案 —— 不会再派第四次 Harry、
也不会派第三次 Voldemort，更不会为了让 gate 变绿而偷偷扩大范围。

这两组数字写在 [skill/SKILL.md](skill/SKILL.md) 的 *Escalation* 一节里（技能文本即规则），
角色本身则由 [index.js](index.js) 的 `DEFAULT_ROLES` 定义。

> 表单写入的是 **profile 的该插件条目**（`cordis.patch.yml` 里的 `hogwarts-loop` 行）。想手工改或批量改也可以直接写那行的 `config`，字段定义见 `index.js` 里导出的 `Config`。

**Albus 就是你自己**（主会话），它的模型由会话的模型选择器决定，不由本插件控制；插件只决定它派发出去的每一个子代理。

### 为什么表单长这样

- 表单同时注册到 **设置面板** 的 `settings.section` 和 **Plugins 页** 的 `plugins.row.config`（key = `@local/dsh-hogwarts-loop#hogwarts-loop`），两处渲染同一个 `FormBody`。
- 设置面板那条通过共享的 `settings.describe` 镜像找到本插件条目的命名空间（按 `hogwarts-loop` 后缀匹配，兼容 `include:` 前缀），再用 `ctx.configForms.get(ns)` 取到带版本栅栏的写入入口；Plugins 页那条由页面直接把已绑定的 `form` 传进来，所以完全不用猜命名空间。
- Host 侧导出的 `Config` 把 `delegation` / `roles` 两个**顶层对象**标成 `.volatile()`（schemastery 不允许 volatile 嵌套，引用只能落在对象上）：这既是设置服务把该条目视为「可编辑」并服务于设置面板的前提，也让派发时读到的永远是**当前值**，而不是插件激活那一刻的快照。
- 下拉框读不到模型目录时（例如登录态失效、目录请求失败），同一位置会退化成文本框，页面不会因此不可用。
- 模型写错不会静默失败：`hogwarts_dispatch` 派发前先校验路由，错误直接作为工具错误返回，并列出当前已注册的 provider。

## 安装 / 卸载

```bash
# 安装（把本目录作为 bundle 装进当前 profile）
plugin_manager -> { action: "install_bundle", target: "/Users/dyikai/Desktop/Projects/Personal/dsh-hogwarts" }

# 卸载
plugin_manager -> { action: "remove_bundle", target: "@local/dsh-hogwarts-loop" }
```

安装后：

- profile 的 `cordis.patch.yml` 会多一条 `- id: hogwarts-loop, name: '@local/dsh-hogwarts-loop'`；
- 这个 package 以 **链接** 方式装进 profile，本目录里的改动会在下一次 Plugin Manager 操作 / profile 重组时生效；
- **装了插件（或改了 `client.js`）之后需要重新加载一次页面**，浏览器才会加载客户端模块、设置项才会出现；Host 半边跟着行一起重组即可。

## 验证

派发一个角色后，子代理的会话日志会记录真实路由：

```bash
node -e '
const fs=require("node:fs"),zlib=require("node:zlib");
const base="/Users/dyikai/.dsh/sessions/--Users-dyikai-Desktop-Projects-Personal-dsh-hogwarts--/<childId>";
const f=fs.readdirSync(base).find(n=>n.endsWith(".zstd"));
const ev=zlib.zstdDecompressSync(fs.readFileSync(base+"/"+f)).toString("utf8").split("\n").filter(Boolean).map(JSON.parse);
console.log(ev.find(e=>e.type==="subagent/descriptor")?.data);
console.log(ev.find(e=>e.type==="request/header")?.data.header.config);
'
```

期望看到 `agentModel` / `config.model` 等于该角色配置的模型，而不是主会话的模型。

## 结构

```
.
├── package.json              # @local/dsh-hogwarts-loop；dsh.bundle.patch + dsh.client
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
