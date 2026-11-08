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
- [x] Published to npmjs (`dsh-llm-pool@0.1.0`)
- [ ] Add the “Listed on dsh-plugin.org” badge after the listing is live

## After the listing is live

1. Confirm the detail page above.
2. Add the listing badge to `README.md` and `README.en.md`:

   ```md
   [![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/lyingloong/dsh-llm-pool)
   ```

3. Comment on the submission issue with the published npm version and the
   listing URL so reviewers can verify the one-step install.
