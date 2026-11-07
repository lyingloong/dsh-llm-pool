# Contributing

Thanks for helping improve `dsh-llm-pool`.

## Development

The plugin is plain ESM with no runtime dependencies and no build step.

```sh
npm run verify   # static checks + unit tests
npm test         # unit tests only
npm run check    # package/bundle validation + syntax checks
```

Install a local checkout into a DSH profile as a linked bundle:

```sh
dsh plugin --profile desktop add <absolute path to this repository>
```

Restart the profile after changing linked package files unless the deployment's
HMR watches them. Configuration edits made from the panel hot-reload the
`llm-pool` entry.

## Repository layout

| Path | Purpose |
|---|---|
| `index.js` | Host entry: provider registration, listeners, HTTP API. |
| `lib/pool.js` | Pure config normalization, capability merge, failure taxonomy. |
| `lib/manager.js` | Assignment state, balancing, cooldowns, adapter and stream fallback. |
| `lib/server.js` | Authenticated status/save/test routes. |
| `client.js` | Models-settings panel (platform React module). |
| `test/` | Node test runner suites with a fake LLM. |
| `docs/architecture.md` | Runtime state and algorithm reference. |

## Invariants to preserve

1. **Fail-soft metadata.** `resolveModel` must never throw for a temporarily
   unavailable target route. A throw hides the whole provider group from the
   model picker; report the failure when streaming instead.
2. **No post-content concatenation.** Internal failover is allowed only before
   the first visible chunk. After that, return the provider failure and let
   `dsh-llm-retry` retry the durable step.
3. **Never swallow `IMAGE_OFFLOAD_REQUIRED`.** The image-offload executor needs
   the failure and its `offloadImages` count.
4. **Sticky first, balance globally.** A session keeps its member per pool and
   model; only a failed/ineligible route reassigns it. New sessions choose the
   least-loaded member.
5. **Conservative capability claims.** Context/output take the minimum,
   reasoning the intersection, and prompt/tool update modes only when every
   available member supports them.
6. **No new runtime dependencies.** Keep the host half importable from a
   profile without installing extra packages.

## Tests

Add a test for every new selection rule, failure class, capability merge, or
config-validation rule. The fake LLM in `test/manager.test.mjs` can script
success, failure, partial output, empty output, and replay state.

## Pull requests

- Keep changes focused and explain the user-visible behavior.
- Update `CHANGELOG.md` for user-visible changes and `README.md` /
  `README.en.md` for config or behavior changes.
- Run `npm run verify` before opening the PR.
- Mention any limitation that could not be verified (for example browser
  rendering or a real provider call).

## Release

1. Bump `package.json` and `CHANGELOG.md`.
2. Run `npm run verify`.
3. Commit, tag `vX.Y.Z`, push the branch and tag.
4. Optionally publish with `npm publish` (the package name is
   `dsh-llm-pool`).
