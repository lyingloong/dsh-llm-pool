# dsh-llm-pool

[![CI](https://github.com/lyingloong/dsh-llm-pool/actions/workflows/ci.yml/badge.svg)](https://github.com/lyingloong/dsh-llm-pool/actions/workflows/ci.yml)
[English](README.en.md) | 简体中文

为 DeepSeek Harness 增加“统一服务商 / 模型池”：把多个真实模型渠道组合成一个虚拟服务商，在模型选择器里像普通渠道一样选择它。默认按会话/子代理做**粘性分配 + 全局负载均衡**（尽量让一个会话一直用同一个渠道，保住 KV cache）；调用失败时自动切换到下一个可用渠道。

> 当前版本面向 DSH `0.2.1-rc.5`。仓库名 / 包名：`dsh-llm-pool`。

## 功能

- **统一服务商**：一个虚拟 provider 路由，例如 `ustc-pool`，下面挂 `ustc`、`ustc-dhsun`、`ustc-qhwang` 等真实渠道。
- **统一模型**：在虚拟 provider 下定义 `deepseek-flash`、`model-a` 等模型；每个统一模型可映射到不同渠道的不同实际模型 id。
- **会话粘性 + 全局均衡**（默认）：
  - 新会话/子代理第一次调用时，选当前会话数最少的成员渠道；
  - 之后该会话的同一统一模型一直用这个渠道，避免每次调用换渠道导致前缀缓存失效；
  - 失败时自动切换，并粘在成功的渠道上。
- **失败自动切换**：只在产生可见输出前静默切换；已经输出内容后再失败，交给 DSH 自带的 `dsh-llm-retry` 按 step 重试，不拼接两个渠道的回复。
- **能力合并**：上下文窗口取保守最小值、输出上限取最小值、推理档位取交集（可手动覆盖/映射）、图片取并集；能力不匹配的渠道在调用时自动跳过。
- **健康冷却**：认证/配额/限流/服务端/超时等失败进入冷却，避免反复打到坏渠道；全部冷却时 fail-open 选最早恢复的。
- **图形化配置**：设置 → 模型页底部的“统一服务商池”面板可以查看状态、编辑渠道/模型映射、测试模型。
- **可观测**：面板显示每个会话分配、每个路由的成功/失败、冷却、最近调用和实际命中的成员。

## 安装

### 从 GitHub 安装

```sh
dsh plugin --profile desktop add github:lyingloong/dsh-llm-pool
```

也可以先用本地 checkout 安装再开发：

```sh
dsh plugin --profile desktop add C:\Users\lazeloong\Code\dsh-plugin
```

安装后重启/刷新桌面端，打开 **设置 → 模型**，页面底部会出现“统一服务商池”。

> 如果你的 profile 里存在已从 npm 撤包的老插件（例如 `dsh-model-tester@0.1.2`），`pnpm install` 可能因为无法重新解析它而失败；这是安装环境的问题，不是本插件。需要先把那个依赖改成可解析的本地来源，或移除它。安装时可以通过插件管理器的 registry 选项指定 `https://registry.npmmirror.com` 绕过已撤包版本。

## 配置

配置保存在当前 profile 的 `cordis.patch.yml` 中，也可以通过面板保存。完整示例见 [`examples/ustc-pool.yml`](examples/ustc-pool.yml)。简例：

```yaml
- id: llm-pool
  name: dsh-llm-pool
  config:
    # 可选：虚拟 provider 在会话里失败后的重试策略（交给 dsh-llm-retry）
    retryPolicy:
      mode: normal
      maxRetries: 2
    providers:
      ustc-pool:
        displayName: USTC 统一池
        # sticky | round-robin | failover；默认 sticky
        strategy: sticky
        members: [ustc, ustc-dhsun, ustc-qhwang]
        models:
          - id: deepseek-flash
            name: DeepSeek Flash
            targets:
              ustc: deepseek-flash
              ustc-dhsun: deepseek-flash
              ustc-qhwang: deepseek-flash
          - id: model-a
            name: 模型 A
            targets:
              ustc: deepseek-flash
              ustc-dhsun: deepseek-v4.1-flash
              ustc-qhwang: deepseek-flash
            # 可选：统一能力覆盖
            contextWindow: 262144
            maxTokens: 131072
            input: [text, image]
            efforts: [off, low, medium, high, max]
            defaultEffort: high
            # 每个渠道的推理档位映射（统一档位 -> 该渠道实际档位）
            effortMap:
              ustc-qhwang:
                max: high
        # 可选：覆盖失败冷却时间（毫秒）
        cooldown:
          authMs: 600000
          serverMs: 30000
```

### 字段

| 字段 | 说明 |
|---|---|
| `providers.<id>` | 虚拟 provider 路由名；必须与已有 provider 不重名（不能直接叫 `ustc`）。 |
| `displayName` | 模型选择器里显示的名称。 |
| `strategy` | `sticky`（默认，会话粘性）/ `round-robin`（每次调用轮询）/ `failover`（固定第一个可用）。 |
| `members` | 有序的真实 provider 路由列表；也是轮询/分配顺序。 |
| `models[].id` | 统一模型 id（模型选择器里显示）。 |
| `models[].name` | 可选显示名，默认等于 id。 |
| `models[].targets` | `成员 -> 实际模型 id` 的映射。省略时默认所有成员使用同名模型。 |
| `models[].contextWindow` | 可选；默认取所有可用成员的最小上下文窗口。 |
| `models[].maxTokens` | 可选；默认取所有可用成员的最小输出上限。 |
| `models[].input` | 可选；`[text]` / `[text, image]`。默认：任一成员支持图片就声明支持。 |
| `models[].efforts` | 可选；统一推理档位列表。默认取所有可用成员的交集。 |
| `models[].defaultEffort` | 可选；必须在 `efforts` 中。 |
| `models[].effortMap` | 可选；`成员 -> {统一档位: 该成员档位}`（如 `max: high`）。 |
| `providers.<id>.cooldown` | 可选；覆盖默认冷却时长（毫秒）。 |
| `retryPolicy` | 可选；虚拟 provider 的 `dsh-llm-retry` 策略。 |

## 使用

1. 在真实渠道里配好各自的 endpoint / key / 模型（本插件复用它们，不需要再配密钥）。
2. 在 **设置 → 模型** 底部面板点“新增统一服务商”，选择成员、自动聚合模型、调整映射，保存。
3. 在会话的 `/model` 或输入框模型菜单里选择 `ustc-pool` 下的统一模型。
4. 子代理、默认模型、AgentTeams 成员也可以直接选择这个虚拟 provider。
5. 在面板里点模型行的“测试”可以发起一次真实流式调用，确认映射和渠道可用。

## 行为细节

### 会话粘性分配

- 分配粒度是 **会话 + 统一服务商 + 统一模型**。一个会话通常只有一个统一模型，所以等价于“一个会话一个渠道”。
- 新会话第一次调用时，在所有候选渠道里选当前绑定会话数最少的；数量相同则轮转。
- 如果该会话的绑定渠道不支持某个统一模型，会为该模型单独分配一个覆盖渠道，并同样按全局负载均衡。
- 失败后如果切换到了备用渠道并且成功，会把该会话的绑定改到备用渠道；后续调用继续用它。
- 渠道被删除/未注册时，下次调用会重新分配。
- 进程重启后内存中的绑定会重置，新会话重新均衡；会话已选择的 provider/model 不受影响。

### 失败语义

| 情况 | 行为 |
|---|---|
| 首 token 前失败（认证、配额、限流、5xx、超时、空响应等） | 记录失败/冷却，尝试下一个候选 |
| 已经产生可见输出后失败 | 原样返回失败 finish，交给 `dsh-llm-retry` 重试；不会拼接两个渠道 |
| `ABORTED` | 原样返回，不切换 |
| `IMAGE_OFFLOAD_REQUIRED` | 原样返回给 loop，不吞掉（图片卸载逻辑需要看到它） |
| 全部候选失败 | 返回聚合失败，消息里列出每个候选的 code/message；优先保留可重试的 transient code |
| 所有候选都在冷却 | fail-open，按最早恢复时间尝试 |

### 能力合并

- **上下文窗口**：取可用成员最小值（可手动覆盖）。这样压缩/计量不会超过任何一个成员的容量。
- **最大输出**：取可用成员最小值。
- **推理档位**：默认取所有可用成员的交集；`efforts` 可显式扩大；`effortMap` 可把统一档位映射到渠道档位。不支持当前档位的渠道会被跳过。
- **图片**：任一成员支持图片就在统一模型上声明支持；实际调用时优先/仅选支持图片的成员。
- **system prompt / tool update**：保守合并，避免把不支持 in-history 更新的渠道带进错误状态。

### KV cache 权衡

严格每次调用轮询会让相邻请求落到不同渠道，前缀缓存基本无法复用。本插件默认 `sticky`，让一个会话尽量待在一个渠道上；只有失败、渠道不可用或模型不匹配时才切换。如果确实想做严格轮询，把 `strategy` 设为 `round-robin`。

## 开发

无构建步骤，纯 ESM，无运行时依赖：

```sh
npm run verify   # 静态检查 + 单元测试
npm test         # 27 个单元测试
npm run check    # package/bundle 校验 + 语法检查
```

文件：

- [`index.js`](index.js) — Host 入口，注册虚拟 provider 和 HTTP API。
- [`lib/pool.js`](lib/pool.js) — 配置归一化、能力合并、失败分类/聚合（纯逻辑）。
- [`lib/manager.js`](lib/manager.js) — 会话粘性分配、负载均衡、冷却、adapter 与回退流。
- [`lib/server.js`](lib/server.js) — `/llm-pool/status`、`/llm-pool/save`、`/llm-pool/test`。
- [`client.js`](client.js) — 设置 → 模型页底部的面板。
- [`docs/architecture.md`](docs/architecture.md) — 运行时状态、选择算法、失败语义和维护不变量。
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — 开发、测试、发布流程。
- [`CHANGELOG.md`](CHANGELOG.md) — 版本变更记录。

## 已知限制

- 已经输出内容后失败无法无缝续接；由 `dsh-llm-retry` 重试整个 step。
- 会话绑定、健康状态、最近调用都在内存中，重启或保存配置后重置。
- 默认上下文取最小可能偏保守，可能比单个大窗口渠道更早触发压缩；可手动覆盖。
- 配置面板是手写表单；推理档位映射、输入类型、冷却等高级字段请用“高级 JSON”。
- 不同真实渠道对同一模型的实现可能不同（工具调用质量、格式），切换后行为可能略有差异。
- 不支持嵌套统一服务商（池成员不能是另一个池）。
- 测试功能会发起真实的、会计费的模型请求。

## 贡献与安全

- 开发与 PR 规范见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。
- 漏洞请通过 GitHub 私有安全公告报告，见 [`SECURITY.md`](SECURITY.md)；不要公开贴出 provider 密钥。
- 设计不变量和新手引导见 [`docs/architecture.md`](docs/architecture.md)。

## License

[MIT](LICENSE) © lyingloong
