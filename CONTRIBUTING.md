# Contributing to captions-cli

Thanks for your interest! This is a small, focused tool — bug fixes, new ASS/HF presets,
language/whisper tweaks, and docs improvements are all welcome.

## Dev setup

Requires [Bun](https://bun.sh) ≥ 1.1, `ffmpeg` **built with libass**, and `whisper-cli`
(from `whisper-cpp`).

```bash
git clone https://github.com/jurczykpawel/captions-cli
cd captions-cli
bun install
bun run captions path/to/video.mp4 --lang en      # run from source
```

Verify your ffmpeg has libass (the ASS engine needs it):

```bash
ffmpeg -filters | grep subtitles    # must print a line; if empty, brew reinstall ffmpeg
```

No libass and don't want to install it? Develop against the Docker image instead:

```bash
docker build -f Dockerfile.slim -t captions-cli:slim .
docker run --rm -v "$PWD:/work" -v captions-cache:/data captions-cli:slim /work/video.mp4 --lang en
```

## Project layout

Bun workspaces monorepo. Each engine is its own package; the CLI dispatches by `--engine`.

```
packages/
  core/         shared types, ffprobe, transcribe, cue grouping
  engine-ass/   ffmpeg + libass renderer + presets/
  engine-hf/    Hyperframes (CSS + GSAP) renderer
  cli/          bin entry + engine dispatcher
```

See [`AGENTS.md`](AGENTS.md) for a deeper architecture tour.

## Before you open a PR

```bash
bun run build        # compiles the standalone binary — must succeed
bun run typecheck    # zero type errors
captions <a real video.mp4> --lang en   # smoke-test the actual pipeline end to end
```

- **Run the real CLI on a real clip.** A type-check passing is not proof captions render.
- Keep changes minimal and focused; match the existing code style.
- Comments only where the *why* is non-obvious.

## Presets

The public repo ships only the free `clean-white` preset. `packages/engine-ass/src/presets/`
is git-ignored except `clean-white.ts` and `index.ts`. `index.ts` is **generated** by
`scripts/generate-presets-index.mjs` — never hand-edit it, and never commit it in a state that
imports presets not tracked in git (CI's `bun run build` will fail if you do). To work with
local packs:

```bash
./scripts/install-pack.sh free      # restore the public (free-only) state before committing
```

New community presets are welcome as additions to the **free** tier — open a PR adding a
`<slug>.ts` with `tier: 'free'` and a preview, and run the generator.

## Reporting bugs

Open an issue with: the exact command, the input video's resolution/duration, your OS,
`ffmpeg -version`, and `captions --list-engines` output.
