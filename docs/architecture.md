# Architecture

This document is the maintainer reference for `dsh-llm-pool`. User-facing
behavior lives in `README.md`; this file explains how the runtime realizes it.

## Goals and non-goals

**Goals**

- Expose multiple real DSH provider routes as one virtual provider with unified
  model ids.
- Keep each session/subagent on one member per unified model for KV-cache
  reuse, while balancing new sessions globally.
- Fail over automatically when a member cannot serve a request, without mixing
  two providers' outputs.
- Compose capabilities conservatively so the agent loop never dispatches a
  request the selected route cannot validate.

**Non-goals**

- Replacing the provider adapters. Wire protocols, credentials, streaming,
  tools, and replay remain owned by the existing adapters.
- Running a local HTTP proxy.
- Nested pools, weighted quotas, persistent assignments, or parallel hedging
  (candidates for later releases).

## Data flow

```text
Session / subagent / compaction / title
        provider = "pool-a", model = "model-a"
                         │
                         ▼
                ctx.llm.prepareCall / stream
                         │  outer request (logged by the loop)
                         ▼
        dsh-llm-pool adapter (one instance, all pool routes)
          ├─ resolveModel(): composed capability metadata
          ├─ planOrder(): sticky / round-robin / failover / test
          └─ inner streams: ctx.llm.stream({ provider, model, ... })
                         │
                         ▼
      real adapter (dsh-llm-pi-ai / dsh-llm-deepseek / ...)
```

The outer request is what the agent loop logs as `provider: "<pool>"`,
`model: "<unified>"`. Inner requests are internal delegations: they are not
logged, and their assistant content still reaches the outer stream.

## Modules

| File | Responsibility |
|---|---|
| `lib/pool.js` | Pure normalization, capability merge, failure taxonomy, aggregation. |
| `lib/manager.js` | Live assignment/health state, candidate selection, adapter, stream loop. |
| `lib/server.js` | Authenticated status/save/test HTTP API. |
| `index.js` | Applies config, registers routes, wires lifecycle listeners and API. |
| `client.js` | Models-settings panel; fetches the API above. |

## Runtime state (process-local)

| Map | Key | Value / meaning |
|---|---|---|
| `preferred` | `scope + pool` | Preferred member for a Session and pool. |
| `preferredCounts` | `pool + member` | Live Sessions bound to each member. |
| `overrides` | `scope + pool + model` | Model-specific member when the preferred one cannot serve that model. |
| `overrideCounts` | `pool + model + member` | Live model overrides for balancing. |
| `sessionIndex` | `scope` | Keys owned by a Session, used by `session/disposed` cleanup. |
| `cooldowns` | `provider + ("*" or target model)` | Route/provider cooldown until a timestamp. |
| `routeStats` | `provider + target model` | Success/failure counters and last error. |
| `targetInfo` | `provider + target model` | Cached `resolveModelInfo` result or error. |
| `merged` | `pool + unified model` | Cached composed model metadata. |
| `recent` | ring buffer | Last 300 attempts for status/UI. |

`scope` is the Session id. Calls without a Session share `__anonymous__`;
calls whose synthetic Session id starts with `llm-pool-test:` never create an
assignment and are used by the panel's test action.

## Selection algorithm

1. **Eligible candidates**
   - Every effective target of the unified model, in `members` order.
   - Drop routes whose provider is not currently registered.
   - Drop routes whose resolved metadata cannot accept request images.
   - Drop routes that cannot serve the requested reasoning effort; an
     `effortMap` entry can satisfy it with a different target-side id.
   - Routes whose metadata lookup failed remain eligible (unknown), so a
     transient catalog failure can still be attempted and fail over.

2. **Order**
   - `test`: requested member first if present, otherwise a test cursor.
   - `round-robin`: rotate by a per-pool/model cursor.
   - `failover`: first eligible candidate.
   - `sticky`:
     - No preferred member: choose the least-loaded eligible member by
       `preferredCounts`, record it, then use it.
     - Preferred serves the model: use it, even if it is cooling (the cooling
       filter below will try others).
     - Preferred exists but does not serve the model: use/create a model
       override balanced by `overrideCounts`.
   - In all non-test modes, non-cooling candidates come first; cooling
     candidates are appended by earliest recovery. If every candidate is
     cooling, the list is still tried (fail-open).

3. **Attempt loop**
   - Build the inner request with the concrete route and target model.
   - Emit content chunks immediately; buffer `usage`.
   - On success with content: emit buffered usage and the finish chunk, record
     success, and reassign the sticky binding if the fallback actually served.
   - On success with no content: synthesize `EMPTY_RESPONSE` and continue.
   - On failure before any content: record failure/cooldown and continue.
   - On failure after content: emit the failure and stop (no concatenation).
   - On `aborted`: emit and stop.
   - On `IMAGE_OFFLOAD_REQUIRED`: emit and stop; the loop's image-offload
     executor owns recovery.
   - When all candidates fail: aggregate a terminal failure whose code prefers
     a request-specific failure, otherwise a retryable transient code, and
     whose message lists every route.

## Sticky assignment lifecycle

- A new Session's first call chooses the least-loaded member for that pool and
  unified model (global counts, process-wide).
- Later calls reuse the preferred member while it serves the model and is
  registered.
- If the preferred member cannot serve a particular model, the Session gets a
  model override chosen from that model's eligible members.
- If a fallback succeeds, the applicable binding is moved to the winner:
  - preferred binding when the fallback came from the preferred path;
  - model override when the request used an override.
- `session/disposed` removes every binding owned by the Session and decrements
  the counts.
- Plugin reload (config change/HMR) creates a new manager, so bindings and
  cooldowns reset. This is deliberate: the new config may change memberships.

## Capability composition

| Capability | Rule | Why |
|---|---|---|
| `contextWindow` | Per-model override, else minimum over resolvable members, else 262144. | Token pressure/compaction must not exceed any member. |
| `defaultMaxTokens` | Per-model override, else minimum over members that declare one. | Avoid a cap the smallest route rejects. |
| `reasoning.efforts` | Explicit `efforts`, else intersection of member efforts; names from the first member. | Selector must not offer a level some members reject silently. |
| `reasoning.defaultEffort` | Explicit, else a common member default, else the first canonical effort. | Deterministic selection. |
| `inputModalities` | Explicit `input`, else union: image if any resolvable member supports it. | The outer runtime must pass images through; the inner adapter projects for text-only targets. |
| `systemPromptUpdate` | `in-history` only when every resolvable member declares it. | Avoid relying on unsupported prompt updates. |
| `toolUpdate` | `in-history` if all declare it; `addition-only` if all declare some mode; otherwise absent. | Keeps deferred tool activation correct across mixed adapters. |
| image pricing | Undefined (neutral estimate). | Only affects token accounting. |

The merge is fail-soft: unresolved targets are excluded from capability claims
but remain eligible for dispatch (except for image/effort checks when their
metadata is known).

## Failure taxonomy

| Codes | Fallback | Cooldown |
|---|---|---|
| `AUTH`, `MISSING_CREDENTIAL`, `INVALID_CREDENTIAL`, `QUOTA`, `ACCOUNT_QUOTA`, `NO_ADAPTER` | yes | provider-wide, 10 min (configurable) |
| `RATE_LIMIT` | yes | model route, `providerRetryAfterMs` or 60 s |
| `SERVER`, `TIMEOUT`, `TRANSPORT` | yes | model route, 30 s |
| `EMPTY_RESPONSE` | yes | model route, 15 s |
| `CONTEXT_WINDOW_EXCEEDED` | yes | none |
| `INVALID_REQUEST`, `UNSUPPORTED_*`, `INVALID_PREPARED_CALL` | yes | none |
| unknown code | yes | none |
| `ABORTED`, `IMAGE_OFFLOAD_REQUIRED` | no | none |

Cooldowns are capped by the pool's `cooldown.maxMs` (default 15 min). A success
clears both the provider-wide and the model-route cooldown.

## Retry interplay

- The pool handles one pass over its candidates per `stream()` call.
- The virtual provider's `providerRetryPolicy` is captured by
  `dsh-llm-retry`; the default is normal mode with two retries and the standard
  transient codes.
- A pre-token failure after all candidates have been tried can therefore be
  retried by the loop; the retry rotates/assigns under the same sticky rules.
- A post-content failure is returned as the provider's terminal failure, then
  retried by `dsh-llm-retry` as a durable step. The next attempt can land on a
  different member; partial output is never merged.

## Replay envelope

Assistant messages produced through a pool carry an opaque wrapper:

```js
{
  __llmPool: 1,
  provider: "provider-a",
  model: "model-a",
  inner: <the target adapter's replayState>
}
```

When a later request targets the same `provider`/`model`, the wrapper is
unwrapped and the message's source is rewritten to that concrete route before
the inner call, so the target adapter can validate and reuse its native replay
metadata. For any other target the source is left as the pool route, and
`dsh-llm` strips the unusable replay state.

## Config normalization

- Unknown fields are ignored for forward compatibility.
- Invalid pools/models are omitted with diagnostics rather than aborting the
  plugin; diagnostics are exposed in the panel.
- Pool ids must be valid route names and must not collide with a registered
  provider. A collision skips that pool with an error diagnostic.
- Nested pools are rejected: a pool member cannot be another pool id.
- `targets` omitted means "same model id on every member"; an explicit map
  limits membership.
- Retry policy is normalized into the exact resolved shape expected by
  `dsh-llm-retry`.

## Testing strategy

- `test/pool.test.mjs` covers normalization, merge, failure classification and
  aggregation.
- `test/manager.test.mjs` uses a fake `llm` and scripted streams to cover
  balancing, sticky assignment, pre/post-content failure, empty responses,
  image and reasoning filters, test sessions, disposal, replay, and metadata.
- `test/server.test.mjs` covers status projection and the save/validation
  path with a fake config editor.
- `test/apply.test.mjs` covers provider registration and collision handling
  with a fake Cordis context.
- `scripts/check.mjs` validates the manifest, bundle patch, and syntax.

## Known limitations

- No durable assignment/health state; a restart or plugin reload rebalances.
- No parallel hedging or quota weights.
- Post-content failures cannot be streamed seamlessly.
- Context composition is conservative; large-window-only members may trigger
  compaction earlier than necessary unless overridden.
- The basic panel form does not edit every advanced field; the advanced JSON
  view is the complete configuration surface.
- Browser rendering of the panel is verified only through slot registration in
  environments without browser automation.
