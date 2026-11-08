# Marketplace

`dsh-llm-pool` is submitted to the community DSH plugin hub at
<https://dsh-plugin.org> under the **Models & Reasoning** category.

- Submission issue:
  <https://github.com/dshplugin/dsh-plugin-hub/issues/668>
- npm package:
  <https://www.npmjs.com/package/dsh-llm-pool>
- Landing page:
  <https://lyingloong.github.io/dsh-llm-pool/>
- Expected detail page after review:
  <https://dsh-plugin.org/plugins/lyingloong/dsh-llm-pool>

## Other plugin directories

| Directory | Mechanism | Status |
|---|---|---|
| [dsh.so](https://www.dsh.so/) | GitHub/npm crawler plus a submit form; also publishes a format-1 index at `https://cdn.dsh.so/market/index.json` | Auto-discovery queued; manual form still useful |
| [dshplugin.dev](https://dshplugin.dev/) | Daily `dsh-plugin` topic crawler plus editorial submit form | Topic discovery queued; not listed yet |
| [dshbase](https://dshbase.com/zh/plugins/directory/) | `dsh-plugin` topic discovery / catalog | Auto-discovery queued |
| [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) ([dshmarket](https://dshmarket.com/), [awesome-dsh-plugin.com](https://awesome-dsh-plugin.com/)) | One YAML file per plugin, PR | PRs submitted: [#13135](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/13135) (this plugin), [#13136](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/13136) (`dsh-auto-workflow`) |
| Official DeepSeek Harness marketplace | Announced 2026-11-06; not open for submissions yet | Wait for launch |

`dsh-market` / `dsh-plugin-catalog` also serve the format-1 index
`https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json`; the same catalog
powers `dshmarket.com` and `awesome-dsh-plugin.com`.

## Install commands

One-step npm install (recommended):

```sh
dsh plugin --profile web add dsh-llm-pool
```

Source install:

```sh
dsh plugin --profile web add github:lyingloong/dsh-llm-pool
```

## Submission checklist

- [x] Public GitHub repository
- [x] GitHub topic `dsh-plugin`
- [x] Root `package.json`
- [x] `apply(ctx)` export
- [x] README install command
- [x] Category: Models & Reasoning
- [x] License: MIT
- [x] Compatibility notes
- [x] Demo / real verification record
- [x] Permissions and external-service notes
- [x] Published `0.1.0` to npmjs
- [ ] Publish `0.1.1` (generic examples) and remove `0.1.0`
- [ ] Add the “Listed on dsh-plugin.org” badge after the listing is live

## After the listing is live

1. Confirm the detail page above.
2. Add the listing badge to `README.md` and `README.en.md`:

   ```md
   [![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/lyingloong/dsh-llm-pool)
   ```

3. Comment on the submission issue with the published npm version and the
   listing URL so reviewers can verify the one-step install.
