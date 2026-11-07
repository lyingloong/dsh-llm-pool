# Marketplace

`dsh-llm-pool` is submitted to the community DSH plugin hub at
<https://dsh-plugin.org> under the **Models & Reasoning** category.

- Submission issue:
  <https://github.com/dshplugin/dsh-plugin-hub/issues/668>
- Expected detail page after review:
  <https://dsh-plugin.org/plugins/lyingloong/dsh-llm-pool>

## Install commands

Source install (available now):

```sh
dsh plugin --profile web add github:lyingloong/dsh-llm-pool
```

One-step npm install (available after the package is published):

```sh
dsh plugin --profile web add dsh-llm-pool
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
- [ ] Publish to npmjs (required for the in-DSH Plugin Hub; this machine is
  not logged in to npm yet)
- [ ] Add the “Listed on dsh-plugin.org” badge after the listing is live

## After npm publication

1. Publish from the repository root:

   ```sh
   npm login
   npm publish --access public
   ```

   `prepublishOnly` runs `npm run verify` automatically.

2. Update the submission issue's install command to:

   ```text
   dsh plugin --profile web add dsh-llm-pool
   ```

3. Confirm the generated listing page, then add the badge:

   ```md
   [![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/lyingloong/dsh-llm-pool)
   ```
