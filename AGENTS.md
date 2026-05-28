# AGENTS.md — captions-cli

Primary instructions for coding agents working in this repo. (`CLAUDE.md` is a symlink to
this file.)

## What this is

A CLI that burns word-level karaoke captions onto videos, fully local: Whisper for
speech-to-text, then a pluggable render engine. No SaaS. MIT-licensed, open companion to a
TechSkills Academy lead magnet.

## Stack & layout

Bun workspaces monorepo. Each engine is its own package; the CLI picks one by `--engine`.

```
packages/
  core/         types, ffprobe (probe.ts), audio extract + transcribe (transcribe.ts),
                cue grouping. No engine-specific code.
  engine-ass/   default engine. Builds an .ass subtitle file from a preset, then runs
                ffmpeg's `subtitles` filter (needs libass). presets/ holds the catalog.
  engine-hf/    Hyperframes engine: HTML+CSS+GSAP rendered via headless Chromium.
  cli/          bin/captions-cli.ts (arg parsing + pipeline) and src/engines.ts (registry).
```

Pipeline: `ffprobe → ffmpeg (16kHz mono wav) → whisper → groupWordsIntoCues → engine.render → mp4`.

## Build / run / verify

```bash
bun install
bun run captions video.mp4 --lang en   # run from source
bun run build                           # compile standalone binary → dist/captions
bun run typecheck                       # all packages, zero errors
```

**Verification rule:** running the type-checker or a build is NOT proof a change works. The
surface is the CLI — run `captions` on a real clip and inspect the output mp4 (extract a frame
with ffmpeg and look at the burned-in captions). The ASS engine needs an `ffmpeg` built with
libass (`ffmpeg -filters | grep subtitles`); if yours lacks it, verify via the Docker image.

## Preset packs — important

- Three tiers: **free** (`clean-white`, open source), **basic** (paid), **premium** (paid).
- `packages/engine-ass/src/presets/` is git-ignored EXCEPT `clean-white.ts` and `index.ts`.
- `index.ts` is **generated** by `scripts/generate-presets-index.mjs` from whatever `.ts`
  files are present. It scans for a `tier:` field and orders free → basic → premium.
- **Never commit `index.ts` importing presets not tracked in git** — a fresh clone would fail
  to build (`Cannot find module './hormozi'`). Before committing, restore the public state:
  `./scripts/install-pack.sh free`. CI's `bun run build` step guards against regressions here.
- Paid `.ts` files live in `packs/{basic,premium}/` (git-ignored). `install-pack.sh` copies
  them into `presets/` and regenerates the index for building private images.

## Conventions

- Comments only where the *why* is non-obvious; no narration of *what* the code does.
- Keep changes minimal and scoped. Don't add abstractions a task doesn't need.
- User-facing errors should be one clear line (the CLI prints `Error: <message>`, no stack).
- No secrets, personal data, or internal URLs in the repo.
