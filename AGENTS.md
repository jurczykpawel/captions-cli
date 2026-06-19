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
- The pack sources are the shared catalogue in **reelstack-modules** (sibling repo). Run
  `node scripts/sync-caption-templates.mjs` (honours `REELSTACK_MODULES_DIR`) to mirror its
  HF caption presets into `packs/hf/` — it wraps each into an `HfPresetDefinition` with a
  tier + description from the manifest in that script. captions authors no caption look of
  its own beyond the free `text` baseline.

## Deploy — web app (captions.techskills.academy, CF Pages)

**Deploy is manual and run from a local machine — on purpose. There is no CI/auto-deploy.**

```bash
# from repo root, with CF creds in the env (token + account id are in Vaultwarden:
# "Cloudflare API - R2 + Workers" — token has Pages Edit + R2 Edit):
export CLOUDFLARE_API_TOKEN=…  CLOUDFLARE_ACCOUNT_ID=…
./scripts/deploy-web.sh
```

What it does: `install-pack.sh premium` (so basic+premium ship) → `bun run build` →
upload the premium pack ZIP to R2 (`captions-premium` bucket, streamed by `/api/premium-zip`)
→ `wrangler pages deploy dist --project-name captions --branch main`. A `trap` restores the
free-only state on exit, so the tree never sits in a leaky state.

**Why manual, not CI:** the paid packs (`packs/hf/{basic,premium}`, `_premium-assets.json`)
are git-ignored and come from the private **reelstack-modules** sibling repo (see Preset packs
above). A GitHub Actions checkout has no packs, so `build-premium-pack.mjs` emits empty stubs —
CI would ship a **free-only build with broken premium** (no premium presets, empty ZIP). So
`.github/workflows/ci.yml` only type-checks / tests / builds the free pack and **never deploys**;
deploy must run where `packs/` is present. If the packs are stale, refresh them first:
`node scripts/sync-caption-templates.mjs && ./scripts/install-pack.sh premium`.
(Automating this would need CI to fetch reelstack-modules via a deploy key — a `workflow_dispatch`
manual-trigger is the safe option if ever wanted; on-push auto-deploy to a license-gated product
is deliberately avoided.)

**Prod-only CF secrets** (set once with `wrangler pages secret put … --project-name captions`,
persist across deploys, never in the repo; values in Vaultwarden): `SELLF_WEBHOOK_SECRET`
(verifies the Sellf webhook `t=,v1=` HMAC), `SELLF_JWKS_FALLBACK` (pinned public JWKS snapshot,
"Captions — Sellf License JWKS (public)"), `SES_*` (token-delivery email). `SELLF_JWKS_URL` is a
public `[vars]` in `wrangler.toml`. A secret change only binds on the **next deploy**.

**Post-deploy sanity:** site returns 200; `POST /api/premium` with a junk token returns **403**
(not 500 — proves JWKS verification path is alive); the bundle contains the `loadedBasic` string.

## Conventions

- Comments only where the *why* is non-obvious; no narration of *what* the code does.
- Keep changes minimal and scoped. Don't add abstractions a task doesn't need.
- User-facing errors should be one clear line (the CLI prints `Error: <message>`, no stack).
- No secrets, personal data, or internal URLs in the repo.
