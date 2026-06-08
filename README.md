# captions-cli

[![CI](https://github.com/jurczykpawel/captions-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/jurczykpawel/captions-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun%20%E2%89%A51.1-black)](https://bun.sh)

**Burn word-level karaoke captions onto videos. Local Whisper + pluggable render engine. Zero SaaS.**

A one-command CLI that does what Submagic / CapCut Pro / Veed / Descript do — transcribe audio
with Whisper, then render an animated caption overlay onto your video. Difference: it runs on
your machine, with open-source tools, with no monthly fee, and your video never leaves the
laptop.

```bash
captions reel.mp4                                   # free style (text)
captions reel.mp4 --preset pill --lang pl           # basic pack
captions reel.mp4 --preset hormozi                  # premium pack
# → reel-captioned.mp4
```

## Quick start (no terminal experience needed)

You don't need to know how to code. You need [Docker Desktop](https://www.docker.com/products/docker-desktop/)
(free) and about 5 minutes.

1. **Install Docker Desktop** and open it — wait until its whale icon says *running*.
2. **Put your video in one folder.** Example: a folder `videos` with `reel.mp4` inside.
3. **Open a terminal in that folder:**
   - **macOS:** right-click the folder in Finder → *New Terminal at Folder*.
   - **Windows:** open the folder, click the address bar, type `cmd`, press Enter.
4. **Paste this one line** and press Enter. Change `reel.mp4` to your filename, and `en` to
   your spoken language (`pl`, `de`, `es`, …):
   ```bash
   docker run --rm -v "$PWD:/work" -v captions-cache:/data ghcr.io/jurczykpawel/captions-cli:latest /work/reel.mp4 --lang en
   ```
   On **Windows** use `"%cd%:/work"` instead of `"$PWD:/work"`.
5. **Done.** A new `reel-captioned.mp4` appears next to your video. The first run downloads a
   ~140 MB speech model (one time); after that it's instant and fully offline.

That's it — nothing is uploaded, no account, no subscription. Want other caption styles, a
one-line installer, or to run without Docker? See [Install](#install) below.

## Make it a real `captions` command

Don't want to paste the long `docker run …` line every time? Install a tiny wrapper once, then
just run `captions yourvideo.mp4 --lang pl` from any folder. It finds your video, mounts its
folder into the container, and writes the captioned copy right next to it.

**macOS / Linux:**

```bash
sudo curl -fsSL https://raw.githubusercontent.com/jurczykpawel/captions-cli/main/scripts/captions \
  -o /usr/local/bin/captions && sudo chmod +x /usr/local/bin/captions
```

**Windows (PowerShell):** download [`captions.cmd`](scripts/captions.cmd) **and**
[`captions.ps1`](scripts/captions.ps1) into one folder that's on your `PATH`.

Then, from anywhere:

```bash
captions reel.mp4 --lang pl
captions ~/Videos/talk.mp4 --lang en
captions --list-presets
```

Still uses the Docker image under the hood (so Docker must be running) — but nothing else to
install. Want a **native** binary with no Docker at all? That's also a real `captions` command —
see [Install](#install) (Options B, C, E).

## Style packs

Captions are organized into **three tiers**. The free `text` preset ships in the public
image; basic and premium unlock with a one-time [Sellf](https://sellf.techskills.academy)
license token (basic is free — confirm your email; premium is a one-time purchase). One
token unlocks both the web app and the CLI pack download.

| Tier | What | Unlock |
|---|---|---|
| **Free** | `text` — plain white captions. Always readable. | included |
| **Basic** | a handful of word-timing styles (`box-highlight`, `pill`, …) | free — email on Sellf → token |
| **Premium** | the full catalogue (glow, hormozi, outline-pop, single-word, underline-sweep, pop-word, paper-cutout, hype, …) | one-time purchase → token |

Run `captions --list-presets` to see what's installed. See [`PACKS.md`](PACKS.md) for the
tier design and the licensing model.

## Render engine

Captions render through the **HF engine** — Hyperframes (HTML+CSS+GSAP via headless
Chromium), the same `{css, timelineJs}` format the web app uses. It needs `ffmpeg` (mux)
plus `hyperframes` (which provisions its own headless Chromium); a 41 s clip renders in
~40 s. `--engine` defaults to `hf`.

```bash
captions reel.mp4                  # free `text` preset
captions reel.mp4 --preset glow    # a premium style (needs the premium pack)
```

## Why this exists

Submagic is 19-69 USD/month. CapCut Pro is 89 PLN/month. Veed.io is 25 EUR/month. Descript
Creator is 24 USD/month. They all run [Whisper](https://github.com/openai/whisper) (open-source
since 2022) plus [ffmpeg](https://ffmpeg.org) (open-source since 2000). Your laptop has both.

A 60-second reel transcribes in ~3 s on an M-series Mac, then the HF engine burns the
captions. Free, offline, no watermark.

This CLI is the open-source companion to a TechSkills Academy guide on captioning video locally.
Free, MIT-licensed, no watermark.

## Install

Pick one. Listed easiest → most flexible.

### Option A — Docker (zero local deps)

**Pre-built images are published to GHCR with each
[release](https://github.com/jurczykpawel/captions-cli/releases)** (tags `:latest` / `:full`,
plus the version, e.g. `:1.0.0`). The image carries ffmpeg, whisper.cpp, hyperframes +
headless Chromium and the compiled binary (~1.6 GB, linux/amd64; on Apple Silicon it runs
under emulation):

```bash
docker pull ghcr.io/jurczykpawel/captions-cli:latest
docker run --rm \
  -v "$PWD:/work" \
  -v "captions-cache:/data" \
  ghcr.io/jurczykpawel/captions-cli:latest \
  /work/reel.mp4 --lang pl
```

The named volume `captions-cache` persists the Whisper model (~140 MB) — the first run
downloads it, subsequent runs are offline.

Or build the image yourself (always works, no release needed):

```bash
git clone https://github.com/jurczykpawel/captions-cli
cd captions-cli
docker build -f Dockerfile.full -t captions-cli .
docker run --rm -v "$PWD:/work" -v "captions-cache:/data" captions-cli /work/reel.mp4 --lang pl
```

> The public image ships the **free** `text` preset. Paid packs are built into private
> images — see [Building images with paid packs](#building-images-with-paid-packs).

### Option B — one-liner installer (Mac + Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/jurczykpawel/captions-cli/main/install.sh | bash
```

Installs `ffmpeg`, `whisper-cpp`, `bun` and `hyperframes` (the HF engine, which provisions
its own headless Chromium), then **builds** the `captions` binary from source and drops it
into `/usr/local/bin`. Idempotent — safe to re-run.

### Option C — pre-built binary (no Node, no Bun)

Grab the binary for your OS from [Releases](https://github.com/jurczykpawel/captions-cli/releases)
(available from v1.0.0 on), then install the system tools manually:

```bash
brew install ffmpeg whisper-cpp           # Mac
sudo apt install ffmpeg                    # Linux (whisper.cpp from source)
npm install -g hyperframes                 # HF engine (needs Node 22+ once)
chmod +x /usr/local/bin/captions
```

`hyperframes` provisions its own headless Chromium on first use. The binary is ~60 MB
(Bun runtime is baked in). No Node/Bun required to **run** the binary itself.

### Option D — VPS via Stackpilot (`./local/deploy.sh captions-cli`)

If you already use [Stackpilot](https://github.com/jurczykpawel/stackpilot) to manage a VPS,
captions-cli ships as a built-in app:

```bash
./local/deploy.sh captions-cli                # installs the image (~1.6 GB)
```

The installer pulls the Docker image and drops a `/usr/local/bin/captions` wrapper that mounts
`$PWD` as `/work`. Then you SSH in and use the CLI like a native binary:

```bash
ssh user@vps
cd ~/captions
captions reel.mp4 --preset hormozi --lang pl
```

Same UX as local Docker (Option A), zero hosting setup.

### Option E — from source (developers)

```bash
brew install ffmpeg whisper-cpp bun       # Mac
git clone https://github.com/jurczykpawel/captions-cli
cd captions-cli
bun install                               # workspaces install
bun run captions video.mp4
```

Build your own standalone binary:

```bash
bun run build                             # → ./dist/captions
```

## Project layout

This is a **Bun workspaces monorepo**. The render engine is a package the CLI dispatches
by `--engine` flag (currently one: `hf`).

```
captions-cli/
├── package.json                 # workspaces: ["packages/*"]
├── packages/
│   ├── core/                    # shared: types, ffprobe, transcribe, cue grouping
│   ├── engine-hf/               # Hyperframes (CSS+GSAP) + presets/  — the only engine
│   │   └── src/presets/         # only `text.ts` ships in git; basic + premium
│   │                            # are gitignored, repopulated at build time
│   └── cli/                     # bin entry, dispatcher
├── packs/                       # GITIGNORED — paid pack source
│   └── hf/{basic,premium}/      # Hyperframes preset packs
├── apps/web/                    # in-browser captioner (Astro + CF Pages)
├── scripts/
│   ├── install-pack.sh          # `./install-pack.sh <free|basic|premium>`
│   ├── generate-presets-index.mjs   # auto-generates presets/index.ts
│   └── deploy-web.sh            # build + deploy the web app
├── PACKS.md                     # tier design + licensing model
├── Dockerfile.full              # the image (HF engine, ~1.6 GB)
├── install.sh                   # Mac + Linux installer
└── README.md
```

### Building images with paid packs

The public repo ships only the free `text` preset. Owners of the basic/premium packs
drop the `.ts` files into `packs/hf/` and bake them into a private image:

```bash
./scripts/install-pack.sh premium       # copies packs/* into presets/, regenerates index.ts
docker build -f Dockerfile.full -t captions-cli:premium .
./scripts/install-pack.sh free          # restore git-clean state (free pack only)
```

## Preset designer (offline)

`studio/index.html` is a self-contained HTML+JS app. Open it in any modern
browser via `file://` — no server, no backend. Tweak typography / outline /
animation / position with live CSS preview, then click **Download .ts** to
get a ready-to-drop preset file. Move it into `packs/hf/premium/`, run
`./scripts/install-pack.sh premium`, and the CLI sees your custom slug.

```bash
open studio/index.html      # macOS
xdg-open studio/index.html  # Linux
```

The preview matches the HF render — typography, colour, and active-state
effects are the same CSS the engine rasterises.

## Usage

```bash
captions <video.mp4> [options]
captions --list-presets [--engine hf]
captions --list-engines
captions --help
```

Common recipes:

```bash
# Default look (free `text` preset, English)
captions reel.mp4

# Polish, Hormozi-style, custom highlight colour (basic pack)
captions reel.mp4 --preset hormozi --lang pl --color "#F59E0B"

# Submagic-style: one word at a time (premium pack)
captions reel.mp4 --preset single-word

# 3-state karaoke (past white / active amber / upcoming grey)
captions reel.mp4 --preset outline-pop --upcoming "#8E8E9C"

# Switch to HF engine for CSS-perfect glow
captions reel.mp4 --engine hf --preset glow

# Custom output path
captions reel.mp4 --output viral.mp4

# Use OpenAI Whisper API instead of local whisper-cpp
export OPENAI_API_KEY=sk-…
captions reel.mp4 --whisper openai
```

## Preset catalog

Run `captions --list-presets` for the live list of what's installed. Captions are a
parametric model (animation × highlight mode × colours) split into three tiers, unlocked
with a Sellf license token — see [Style packs](#style-packs).

- **Free** — `text` (plain white captions, no word-timing highlight).
- **Basic** — word-timing styles: `box-highlight`, `pill`.
- **Premium** — the full catalogue: `glow`, `hormozi`, `outline-pop`, `pop-word`,
  `single-word`, `underline-sweep`, `paper-cutout`, `paper-cutout-typed`, `hype`, …

## All options

```
--engine <name>          hf (default)
--preset <slug>          caption look (see --list-presets). Default: text
--output <path>          Default: <input>-captioned.mp4
--lang <code>            Whisper language (en, pl, de, fr, …). Default: en
--color <hex>            Active word colour. Default: #F59E0B (amber)
--upcoming <hex>         Not-yet-spoken word colour (3-state karaoke)
--position <0-100>       Vertical % from top (65 = cross-platform safe zone). Default: 65
--font-size <px>         Default: 64
--font-color <hex>       Past-word colour. Default: #FFFFFF
--whisper <provider>     whisper-cpp (default, free, local) | openai
--whisper-model <id>     ggml-tiny|base|small|medium|large-v3-turbo.bin
                         Default: ggml-base.bin (~140 MB, balanced)
```

## How it works

```
input.mp4
  └─ ffprobe → duration + dimensions
       └─ ffmpeg → 16 kHz mono WAV (audio extract)
            └─ whisper-cpp / OpenAI → word-level timestamps
                 └─ groupWordsIntoCues → cues (≤5 words / ≤3 s each)
                      └─ engine=hf → hyperframes → headless Chromium → MP4
```

Three colour states per word are tracked by the HF engine: a GSAP timeline applies
`.word--past` / `.word--active` / `.word--upcoming` classes per frame, and the preset's
CSS rules style them.

Both engines respect the same 3 colours: past = `--font-color`, active = `--color`,
upcoming = `--upcoming` (defaults to past when omitted).

## Whisper providers

**`whisper-cpp` (default)** — runs locally, free, offline. Requires `whisper-cli` on PATH
(`brew install whisper-cpp`). Models live in `~/.cache/whisper.cpp/`.

**`openai`** — OpenAI's hosted Whisper API. Requires `OPENAI_API_KEY`. Costs ~$0.006 per audio
minute. Faster than whisper-cpp on slower CPUs and on languages where small whisper-cpp models
hallucinate.

## Whisper model cheat-sheet

| Model | Size | Speed | Quality | When to use |
|---|---|---|---|---|
| `ggml-tiny.bin` | 39 MB | fastest | low | Quick drafts, English-only |
| `ggml-base.bin` | 140 MB | fast | OK | **Default** — good balance |
| `ggml-small.bin` | 466 MB | medium | good | Multilingual, mid-quality |
| `ggml-medium.bin` | 1.4 GB | slow | great | Long-form, proper nouns |
| `ggml-large-v3-turbo.bin` | 1.5 GB | medium | best | Production captions |

Override with `--whisper-model ggml-small.bin` etc.

## Three-state karaoke

Each word goes through three states as the timeline plays:

- **Past** (already spoken) → `--font-color` (default white)
- **Active** (being spoken now) → `--color` (default amber `#F59E0B`)
- **Upcoming** (not yet spoken) → `--upcoming` (default = past, so 2-state)

Pass `--upcoming "#8E8E9C"` for the full Submagic-style 3-state read where unspoken words are
dimmed grey and "fill in" as they're hit.

## Troubleshooting

| Error | Fix |
|---|---|
| `whisper-cli: command not found` | `brew install whisper-cpp` |
| `ffmpeg: command not found` | `brew install ffmpeg` |
| `hyperframes: command not found` | `npm i -g hyperframes` (or `bun add -g hyperframes`). Or use the Docker image, which ships it. |
| Wrong language detected | Pass `--lang pl` (or whatever) explicitly |
| Captions misaligned | Try `--whisper-model ggml-large-v3-turbo.bin` |
| `OpenAI Whisper failed: 401` | `export OPENAI_API_KEY=sk-…` |
| Render takes minutes on first HF run | Hyperframes downloads Chromium (~150 MB). Subsequent fast. |
| Polish diacritics garbled | Default `ggml-base.bin` handles Polish; if still wrong, try `ggml-large-v3-turbo.bin` |

## License

MIT. Built on top of:

- [ffmpeg](https://ffmpeg.org) — LGPL/GPL
- [Hyperframes](https://hyperframes.heygen.com) — the HF render engine
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — MIT
- [Bun](https://bun.com) — MIT (only at build time when compiling the standalone binary)

## See also

- **TechSkills Academy guide** (Polish) — on captioning video locally; this CLI is its
  open-source companion.
- **ReelStack** — the larger reel-generation pipeline (TTS + LLM director) these caption
  presets were originally extracted from; captions-cli is the minimal standalone carve-out.
