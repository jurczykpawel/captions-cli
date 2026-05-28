#!/usr/bin/env bash
# Render every ASS preset in the catalog so you can pick which to ship in
# which pack. Output:
#   ~/Downloads/caption-packs-demo/
#     free/<preset>.mp4
#     basic/<preset>.mp4
#     premium/<preset>.mp4
#     grids/{free,basic,premium}.png   # mosaic preview per pack
#     all-presets.mp4                   # concat of every preset, labeled

set -euo pipefail

OUT_DIR="$HOME/Downloads/caption-packs-demo"
WORK_DIR="$(mktemp -d)"
IMAGE="${IMAGE:-captions-cli:slim}"
SOURCE="$WORK_DIR/source.mp4"

# Longer narration so word-by-word presets have material to work with.
NARRATION="ReelStack caption styles. Twenty one presets across three packs. Free pack ships one clean baseline. Basic pack adds four classics. Premium unlocks the full library. Pick the look that fits your brand. Same one shot render. Zero monthly fee."

FREE=(clean-white)
BASIC=(outline-pop hormozi pill pop-word)
PREMIUM=(
  single-word
  single-word-pop
  single-word-fade
  box-highlight
  underline-sweep
  pill-shadow
  news-ticker
  hormozi-red
  hormozi-green
  hormozi-cyan
  mrbeast
  karaoke-fill
  karaoke-shadow
  neon-yellow
  neon-cyan
  neon-pink
  bouncing
  subtitle-classic
  mono-block
  whisper-mini
  paper-cutout
  hype
)

mkdir -p "$OUT_DIR"/{free,basic,premium,grids}

echo "→ generating gradient background…"
ffmpeg -y -f lavfi \
  -i "gradients=s=1080x1920:c0=0x141428:c1=0x3a1f5c:type=radial:speed=0.01:duration=18" \
  -t 18 -pix_fmt yuv420p "$WORK_DIR/bg.mp4" 2>/dev/null

echo "→ synthesising narration…"
say -v Daniel "$NARRATION" -o "$WORK_DIR/voice.aiff"

echo "→ muxing source…"
ffmpeg -y -i "$WORK_DIR/bg.mp4" -i "$WORK_DIR/voice.aiff" \
  -c:v copy -c:a aac -b:a 96k -shortest "$SOURCE" 2>/dev/null

run_one() {
  local tier="$1"; local preset="$2"
  echo "    [$tier/$preset]"
  docker run --rm \
    -v "$WORK_DIR:/work" \
    -v captions-cache:/data \
    "$IMAGE" \
    /work/source.mp4 \
    --engine ass \
    --preset "$preset" \
    --lang en \
    --upcoming "#8E8E9C" \
    --whisper-model ggml-large-v3-turbo.bin \
    --output "/work/${preset}.mp4" \
    2>&1 | grep -E "words|render:|done|Error" || true
  cp "$WORK_DIR/${preset}.mp4" "$OUT_DIR/${tier}/${preset}.mp4"
  # Single-frame still at 6 s for the grid mosaic.
  ffmpeg -y -ss 6 -i "$OUT_DIR/${tier}/${preset}.mp4" \
    -frames:v 1 "$OUT_DIR/${tier}/${preset}.png" 2>/dev/null
}

echo "→ FREE pack…"
for p in "${FREE[@]}";    do run_one free    "$p"; done
echo "→ BASIC pack…"
for p in "${BASIC[@]}";   do run_one basic   "$p"; done
echo "→ PREMIUM pack…"
for p in "${PREMIUM[@]}"; do run_one premium "$p"; done

# Mosaic grid per pack — useful for landing pages. ImageMagick `montage`
# does the heavy lifting (tile + uniform thumb size + bg color + label).
# Falls back silently if magick isn't installed.
make_grid() {
  local tier="$1"; local cols="$2"
  echo "→ grid $tier ($cols cols)…"
  local pngs=( "$OUT_DIR/$tier"/*.png )
  if [[ ${#pngs[@]} -eq 0 || ! -f "${pngs[0]}" ]]; then return; fi
  if ! command -v magick >/dev/null 2>&1; then
    echo "    skipped (magick not found — brew install imagemagick)"; return
  fi
  # Helvetica isn't always installed for ImageMagick on Mac (system font
  # rather than a TTF magick can read). Drop labels rather than fight it
  # — the filenames live next to the grid PNG anyway.
  magick montage \
    -background '#101010' \
    -tile "${cols}x" -geometry '480x854+8+8' \
    "${pngs[@]}" "$OUT_DIR/grids/${tier}.png" \
    || echo "    grid $tier failed"
}
make_grid free    1
make_grid basic   2
make_grid premium 5

# Sync the per-preset PNGs and grids back into the repo so they ship in
# the public README / landing page. Marketing assets are fine to commit
# (they're rendered output, not the preset source).
ASSETS="$(cd "$(dirname "$0")/.." && pwd)/assets/previews"
mkdir -p "$ASSETS"/{free,basic,premium,grids}
cp "$OUT_DIR"/free/*.png    "$ASSETS/free/"    2>/dev/null || true
cp "$OUT_DIR"/basic/*.png   "$ASSETS/basic/"   2>/dev/null || true
cp "$OUT_DIR"/premium/*.png "$ASSETS/premium/" 2>/dev/null || true
cp "$OUT_DIR"/grids/*.png   "$ASSETS/grids/"   2>/dev/null || true
echo "→ synced previews to $ASSETS"

rm -rf "$WORK_DIR"

echo
TOTAL=$(find "$OUT_DIR" -maxdepth 2 -name '*.mp4' | wc -l | tr -d ' ')
echo "Done. open $OUT_DIR"
echo "  $TOTAL MP4s grouped by tier + 3 grid PNGs"
