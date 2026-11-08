# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/lyingloong/dsh-llm-pool/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/lyingloong/dsh-llm-pool/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/lyingloong/dsh-llm-pool/releases/tag/v0.1.0
