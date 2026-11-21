# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-21

### Added

- Auto limits (default on): discover context/output/input modalities through
  DSH and learn image-count / tool-result-image support from provider
  rejections. Auto ignores manual limit fields; turning it off restores them.
- Proactive image offload: once Auto knows an image-count cap, an over-budget
  request returns `IMAGE_OFFLOAD_REQUIRED` before calling a provider.
- Panel Auto switch and per-model Auto summary.

### Fixed

- Images nested in tool-result content are counted, and tool-result image
  support can be tracked per member.
- The Models panel API now registers when `webServer` / `connection` services
  become available after a cold start, instead of staying at HTTP 404.

### Distribution

- Published `dsh-llm-pool@0.2.0` to npm (latest).

## [0.1.2] - 2026-11-21

### Fixed

- Translate a provider's image-budget rejection (for example “carries 32 image
  items, above this model's limit of 10”, or an unsupported multimodal
  function output) into DSH's `IMAGE_OFFLOAD_REQUIRED` signal carrying
  `offloadImages`. DSH's image-offload executor can then replace the oldest
  images with placeholders and retry instead of failing every pool candidate.
- Count images nested in tool-result content, and preserve `offloadImages`
  through finish/failure chunks.

### Distribution

- Published `dsh-llm-pool@0.1.2` to npm (latest).

## [0.1.1] - 2026-11-08

### Added

- Market-facing repository assets: original icon (SVG + PNG), real
  verification/demo record, compatibility and permission documentation.
- GitHub Pages landing page (`site/`) deployed from `main` with the official
  Pages Actions workflow.
- `prepublishOnly` verification hook and a package icon field.

### Changed

- Generic provider/model example names throughout README, docs, examples, and
  the landing page; removed deployment-specific test route names.
- README install guidance now uses the market's `--profile web add ...`
  convention with an explicit note for other profile names.

### Distribution

- Published `dsh-llm-pool@0.1.1` to npm (latest).
- Deprecated `0.1.0`; npm blocks unpublish for bypass-2FA granular tokens, so
  removing it requires an interactive OTP or a classic token.

## [0.1.0] - 2026-11-07

### Added

- Virtual LLM provider routes (`providers.<id>`) backed by ordered real
  provider members.
- Unified models with per-member target-model mapping, including the default
  "same model id on every member" behavior.
- Session-sticky, globally balanced assignment for sessions and subagents:
  new sessions go to the least-loaded member, then stay there for cache
  reuse.
- Automatic pre-token failover with per-route health cooldowns; a successful
  fallback becomes the session's new assignment.
- Capability composition: conservative context/output windows, reasoning
  effort intersection with per-member mapping, image modality union, and
  conservative prompt/tool update modes.
- Replay-envelope wrapping so a provider's native replay metadata is restored
  when the same member serves a later request.
- Three strategies: `sticky` (default), `round-robin`, and `failover`.
- Authenticated Models-settings panel with pool editor, auto-aggregation from
  member model catalogs, per-model tests, route health, assignments, and
  recent attempts.
- HTTP API: `GET /llm-pool/status`, `POST /llm-pool/save`,
  `POST /llm-pool/test`.
- 27 unit tests covering config normalization, capability merge, sticky
  balancing, failover, cooldowns, replay, provider catalog metadata, and save
  validation.

### Security

- The panel API uses the same authenticated connection gate as the Models
  page; no provider keys are stored, read, or logged by this plugin.

### Distribution

- Published `dsh-llm-pool@0.1.0` to npm.

[Unreleased]: https://github.com/lyingloong/dsh-llm-pool/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/lyingloong/dsh-llm-pool/releases/tag/v0.2.0
[0.1.2]: https://www.npmjs.com/package/dsh-llm-pool/v/0.1.2
[0.1.1]: https://github.com/lyingloong/dsh-llm-pool/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/lyingloong/dsh-llm-pool/releases/tag/v0.1.0
