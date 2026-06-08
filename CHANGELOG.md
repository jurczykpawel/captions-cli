# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **HF is now the only render engine.** The ASS (`ffmpeg`+`libass`) engine was removed —
  the HF engine (HTML+CSS+GSAP via headless Chromium) renders every tier and is the same
  format the web app uses. `--engine` defaults to `hf`; the default preset is `text`.
- **Licensing moved to Sellf offline tokens.** Premium/basic unlock is a Sellf-issued
  license token verified offline against Sellf's JWKS (no bespoke key store). One token,
  `tier` claim decides what unlocks, in both the web app and the CLI pack download.

### Removed
- `Dockerfile.slim` (ASS-only image). The single image is `Dockerfile.full` (published as
  `:latest`/`:full`). `libass` is no longer a requirement.

## [1.0.0] - 2026-05-28

First public release.

### Added
- Word-level karaoke caption burn-in for videos — local Whisper transcription plus a
  pluggable render engine, no SaaS.
- **ASS engine** (default): `ffmpeg` + `libass`, ~3s render for a 60s clip, slim image.
- **HF engine** (`--engine hf`): Hyperframes (HTML+CSS+GSAP via headless Chromium) for
  CSS-perfect effects.
- 3-tier preset model: free `clean-white` (open source) plus basic (4) and premium (20)
  paid packs built into separate images.
- Two transcription providers: local `whisper-cpp` (default, free, offline) and the hosted
  OpenAI Whisper API (`--whisper openai`).
- Three-state karaoke colouring (past / active / upcoming) with configurable colours,
  font size, and vertical position.
- Docker images (`Dockerfile.slim`, `Dockerfile.full`), one-line installer, and a
  from-source build path (Bun workspaces monorepo).
- `captions` wrapper scripts (macOS/Linux + Windows) that hide the `docker run`
  boilerplate — run `captions video.mp4 --lang pl` from any folder.
- Offline preset designer (`studio/index.html`).

[Unreleased]: https://github.com/jurczykpawel/captions-cli/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jurczykpawel/captions-cli/releases/tag/v1.0.0
