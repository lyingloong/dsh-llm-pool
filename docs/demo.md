# Verification / demo

This is a maintainer verification record from the development environment on
2026-11-07. It is real output, not a mockup. Provider route names are redacted
and replaced with `provider-a`, `provider-b`, and `provider-c`; the test used
three real routes from a deployment profile.

```text
pool:     pool-a
members:  provider-a → provider-b → provider-c
model:    model-a
DSH:      0.2.1-rc.5 (desktop profile)
```

## Unit tests and CI

```text
$ npm run verify
check ok: 10 ESM files, package manifest, bundle patch
ℹ tests 27
ℹ pass 27
ℹ fail 0
```

GitHub Actions runs the same command on Node 22 and 24. Latest runs:
<https://github.com/lyingloong/dsh-llm-pool/actions>

## End-to-end call through the virtual provider

A subagent was created with an explicit target override:

```js
const text = await agent('请只回复 ok，不要使用任何工具。', {
  provider: 'pool-a',
  model: 'model-a',
})
// text === 'ok'
```

The provider route resolved through `dsh-llm-pool`, the adapter selected a real
member, and the real provider returned successfully.

## Automatic failover

A temporary probe pool mapped the first member to a deliberately nonexistent
model:

```text
pool-probe
  members: [provider-a, provider-b]
  model-a.targets:
    provider-a: nonexistent-model-xyz   ← fails with UNKNOWN_MODEL
    provider-b: model-a                ← succeeds
```

The same subagent call returned `ok`, proving that the pre-token failure was
recorded, the next member was tried, and the successful fallback became the
session's assignment. The probe pool was removed afterwards.

## Panel and API registration

- The client bundle registers the Models-page footer slot:
  `settings.models.footer` occupant `llm-pool-footer` is active.
- The authenticated panel API is mounted:
  `/llm-pool/status` returns HTTP 401 without the browser session cookie, while
  a nonexistent route returns 404.
- The plugin entry `include:llm-pool` is active in the Loader.

A screenshot of the rendered panel is intentionally not committed here until
it can be captured from a live browser session; the slot, API, and real model
calls above are verified independently.
