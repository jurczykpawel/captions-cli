# AGENTS.md — captions-cli

Primary instructions for coding agents working in this repo. (`CLAUDE.md` is a symlink to
this file.)

## What this is

A CLI that burns word-level karaoke captions onto videos, fully local: Whisper for
speech-to-text, then a pluggable render engine. No SaaS. MIT-licensed, open-source companion
to a TechSkills Academy guide on captioning video locally.

## Stack & layout

Bun workspaces monorepo. The render engine is a package the CLI selects by `--engine`
(currently one: `hf`). The engine registry makes adding another straightforward.

```
packages/
  core/         types, ffprobe (probe.ts), audio extract + transcribe (transcribe.ts),
                cue grouping. No engine-specific code.
  engine-hf/    Hyperframes engine (the only engine): HTML+CSS+GSAP rendered via
                headless Chromium. presets/ holds the catalog. Works in the CLI and,
                via the same {css, timelineJs} format, in the web app.
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
with ffmpeg and look at the burned-in captions). The HF engine needs `ffmpeg` (mux) plus
`hyperframes` on PATH (it provisions its own headless Chromium); if you can't run it locally,
verify via the Docker image (`Dockerfile.full`).

## Preset packs — important

- Three tiers: **free** (open source), **basic** (paid), **premium** (paid). The free preset
  is `text` (hf); basic + premium are gitignored paid packs.
- `engine-hf/src/presets/` is git-ignored EXCEPT the free preset (`text.ts`) and `index.ts`.
- `index.ts` is **generated** by `scripts/generate-presets-index.mjs [hf]` from whatever
  `.ts` files are present. Each preset exports a `definition` with a `tier:` field; the
  generator orders free → basic → premium.
- **Never commit `index.ts` importing presets not tracked in git** — a fresh clone would fail
  to build (`Cannot find module './hormozi'`). Before committing, restore the public state:
  `./scripts/install-pack.sh free`. CI's `bun run build` step and the `preset-leak-guard` test
  guard against regressions here.
- Paid `.ts` files live in `packs/hf/{basic,premium}/` (git-ignored). `install-pack.sh`
  copies them into `engine-hf/src/presets/` and regenerates the index for private images.

## Conventions

- Comments only where the *why* is non-obvious; no narration of *what* the code does.
- Keep changes minimal and scoped. Don't add abstractions a task doesn't need.
- User-facing errors should be one clear line (the CLI prints `Error: <message>`, no stack).
- No secrets, personal data, or internal URLs in the repo.
