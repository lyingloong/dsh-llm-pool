# dsh-llm-pool

[![CI](https://github.com/lyingloong/dsh-llm-pool/actions/workflows/ci.yml/badge.svg)](https://github.com/lyingloong/dsh-llm-pool/actions/workflows/ci.yml)
English | [简体中文](README.md)

Unified model providers for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
Combine several real provider routes into one virtual provider and pick it like
any other provider from the model selector.

By default a session (or subagent) is **sticky** to one member per unified
model — new sessions are balanced globally across members, while an existing
session keeps its provider for KV-cache reuse. A failed route is retried on the
next eligible member automatically.

> Target: DSH `0.2.1-rc.5`. Repository / package name: `dsh-llm-pool`.

## Features

- **Virtual providers** such as `ustc-pool` with ordered real members
  (`ustc`, `ustc-dhsun`, `ustc-qhwang`, …).
- **Unified models** such as `deepseek-flash`; each member may map a unified
  model to a different real model id.
- **Session-sticky global balancing**: the first call for a session chooses the
  least-loaded member; later calls reuse it. A failed member hands the session
  to the successful fallback.
- **Automatic failover before the first visible token**. After content has been
  emitted, the failure is returned to the agent loop and `dsh-llm-retry`
  retries the durable step instead of concatenating two providers' output.
- **Capability composition**: minimum context/output window, reasoning-effort
  intersection with per-member mapping, image union, and conservative
  prompt/tool-update claims. Ineligible members are skipped per request.
- **Health cooldowns** for auth, quota, rate limit, server, timeout, transport,
  and empty responses; if every candidate is cooling the pool fails open to the
  earliest recovery.
- **Models-settings panel** with pool editing, automatic model aggregation from
  member catalogs, per-model live tests, assignments, route health, and recent
  attempts.
- **Native replay preservation** when a later request targets the same concrete
  member.

## Install

From GitHub:

```sh
dsh plugin --profile desktop add github:lyingloong/dsh-llm-pool
```

From a local checkout:

```sh
dsh plugin --profile desktop add <absolute path to this repository>
```

Refresh the Web UI, then open **Settings → Models**. The “统一服务商池” panel is
at the bottom of the page.

If your profile contains an old unpublished package (for example
`dsh-model-tester@0.1.2`), `pnpm install` can fail while trying to resolve it.
Pass `https://registry.npmmirror.com` as the plugin manager's registry, or
replace/remove that dependency first.

## Quick configuration

The full example is [`examples/ustc-pool.yml`](examples/ustc-pool.yml).

```yaml
- id: llm-pool
  name: dsh-llm-pool
  config:
    providers:
      ustc-pool:
        displayName: USTC Pool
        strategy: sticky        # sticky | round-robin | failover
        members: [ustc, ustc-dhsun, ustc-qhwang]
        models:
          - id: deepseek-flash
            name: DeepSeek Flash
            targets:
              ustc: deepseek-flash
              ustc-dhsun: deepseek-flash
              ustc-qhwang: deepseek-flash
```

Omit `targets` to use the same model id on every member. Per-model
`contextWindow`, `maxTokens`, `input`, `efforts`, `defaultEffort`, and
`effortMap` are optional; see [`docs/architecture.md`](docs/architecture.md).

## Usage

1. Configure the real provider routes (endpoints, credentials, models) as
   usual. The pool never stores or reads their keys.
2. Create a pool in **Settings → Models → 统一服务商池**, or use the YAML entry.
3. Select `ustc-pool` → `deepseek-flash` (or another unified model) from
   `/model` or the composer model menu.
4. Subagents, the default model, and AgentTeams members can select the virtual
   provider as well.
5. Use **Test** on a model row to make one real streaming call and verify the
   mapping and member selection.

## Design choices

- **Sticky beats per-call round-robin for cache.** Per-call rotation destroys
  prefix-cache reuse. Use `strategy: round-robin` only when spreading load
  matters more than cache.
- **Only one pass over candidates per stream.** Before content is visible the
  pool tries the next eligible member; after content, the loop's retry owns
  recovery.
- **Conservative capabilities.** Context and output take the minimum; reasoning
  takes the intersection; image support is the union and is filtered per
  request. Override at the unified-model level when needed.
- **Assignments and health are in-memory.** A restart or plugin reload
  rebalances sessions; selected provider/model ids survive.

## Development

No build step, no runtime dependencies:

```sh
npm run verify   # static checks + unit tests
npm test         # 27 unit tests
npm run check    # package/bundle validation + syntax
```

Repository layout, architecture, failure taxonomy, replay envelope, and
maintainer invariants are documented in [`docs/architecture.md`](docs/architecture.md).
See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development and release flow.

## Limitations

- A post-content failure cannot be streamed seamlessly.
- No durable assignments, weights, quotas, nested pools, or parallel hedging.
- Conservative context composition may compact earlier than a large-window
  member would require; override `contextWindow` if needed.
- The basic editor does not expose every advanced field; use “高级 JSON” for
  reasoning maps, input types, cooldowns, etc.
- The test action makes real, billable provider requests.

## Security

The plugin never stores, reads, or logs provider keys. Panel routes use the
authenticated DSH browser connection gate. Report vulnerabilities privately per
[`SECURITY.md`](SECURITY.md).

## License

[MIT](LICENSE) © lyingloong
