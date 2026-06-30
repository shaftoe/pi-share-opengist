# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-06-30

### Changed

- **deps**: update dependencies (#2)
- update readme
- update README.md

### Fixed

- add support for gistviewer.l3x.in

## [0.1.0] - 2026-06-30

### Added

- Initial release of `@alexanderfortin/pi-share-opengist`.
- `/share-og` command: exports the current Pi session to the same
  self-contained HTML produced by `/export` and uploads it to a self-hosted
  [Opengist](https://github.com/thomiceli/opengist) instance via the Opengist
  REST API (`POST /api/gists`).
- Enriched gist metadata: description is now `pi: <title> (<model>) <cwd>`
  and the file is named `pi-<slug>-<utcstamp>.html`, derived from the session
  name, cwd, and active model.
- Gists are **unlisted by default** (reachable by link, not listed publicly),
  via Opengist's native `visibility` field. Override with
  `PI_OPENGIST_VISIBILITY` (`public` | `unlisted` | `private`); the legacy
  `PI_OPENGIST_PUBLIC=true` still maps to `public`.
- Honors `PI_SHARE_VIEWER_URL` to build `<viewer>#<gistId>` links; otherwise
  returns the raw Opengist URL.
- Abortable upload via `ctx.signal`.
- Optional in-process fast path (`PI_OPENGIST_USE_INPROCESS=1`) that deep-imports
  Pi's internal `exportSessionToHtml` instead of shelling out to `pi --export`.

### Changed

- Switched the create-gist request body from GitHub's boolean `public` to
  Opengist's `visibility` enum (`public` | `unlisted` | `private`), defaulting
  to `unlisted`.
- Fixed HTML export to pass an explicit output path to `pi --export` and to
  parse the `Exported to: <path>` stdout line correctly.

[0.1.1]: https://github.com/shaftoe/pi-share-opengist/compare/v0.1.0...v0.1.1
