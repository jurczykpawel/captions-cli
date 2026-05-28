# AGENTS.md — captions-cli

Primary instructions for coding agents working in this repo. (`CLAUDE.md` is a symlink to
this file.)

## What this is

A CLI that burns word-level karaoke captions onto videos, fully local: Whisper for
speech-to-text, then a pluggable render engine. No SaaS. MIT-licensed, open-source companion
to a TechSkills Academy guide on captioning video locally.

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

- Three tiers: **free** (open source), **basic** (paid), **premium** (paid). Applies to BOTH
  engines — the free preset is `clean-white` (ass) and `text` (hf).
- Each engine's `src/presets/` dir is git-ignored EXCEPT its free preset and `index.ts`
  (`clean-white.ts` for ass, `text.ts` for hf).
- `index.ts` is **generated** by `scripts/generate-presets-index.mjs <ass|hf>` from whatever
  `.ts` files are present. Each preset exports a `definition` with a `tier:` field; the
  generator orders free → basic → premium.
- **Never commit `index.ts` importing presets not tracked in git** — a fresh clone would fail
  to build (`Cannot find module './hormozi'`). Before committing, restore the public state:
  `./scripts/install-pack.sh free`. CI's `bun run build` step and the `preset-leak-guard` test
  guard against regressions here.
- Paid `.ts` files live in `packs/<engine>/{basic,premium}/` (git-ignored). `install-pack.sh`
  copies them into each engine's `presets/` and regenerates both indexes for private images.

## Conventions

- Comments only where the *why* is non-obvious; no narration of *what* the code does.
- Keep changes minimal and scoped. Don't add abstractions a task doesn't need.
- User-facing errors should be one clear line (the CLI prints `Error: <message>`, no stack).
- No secrets, personal data, or internal URLs in the repo.
