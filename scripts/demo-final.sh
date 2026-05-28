#!/usr/bin/env bash
# Final review demo. Generates a clean synthetic source (gradient + TTS
# audio via macOS `say`), then renders every preset through BOTH engines
# so you can pick the looks you want before shipping.
#
# Output: ~/Downloads/caption-demos-final/
#   <preset>-ass.mp4
#   <preset>-hf.mp4
#   <preset>-compare.png   # ASS | HF, frame at 6 s

set -euo pipefail

OUT_DIR="$HOME/Downloads/caption-demos-final"
WORK_DIR="$(mktemp -d)"
IMAGE="${IMAGE:-captions-cli:full}"
SOURCE="$WORK_DIR/source.mp4"
NARRATION="ReelStack caption styles. Eight presets available. Pick your favorite look. Same render, zero cost."

PRESETS=(
  text
  outline-pop
  hormozi
  pop-word
  pill
  glow
  underline-sweep
  box-highlight
  single-word
)

mkdir -p "$OUT_DIR"

# 1. Synthetic gradient background (12 s).
echo "→ generating gradient background…"
ffmpeg -y -f lavfi \
  -i "gradients=s=1080x1920:c0=0x141428:c1=0x3a1f5c:type=radial:speed=0.01:duration=12" \
  -t 12 -pix_fmt yuv420p "$WORK_DIR/bg.mp4" 2>/dev/null

# 2. TTS narration via macOS `say` (English, deterministic).
echo "→ synthesising narration with say…"
say -v Daniel "$NARRATION" -o "$WORK_DIR/voice.aiff"

# 3. Mux video + audio → final source.
echo "→ muxing source video…"
ffmpeg -y -i "$WORK_DIR/bg.mp4" -i "$WORK_DIR/voice.aiff" \
  -c:v copy -c:a aac -b:a 96k -shortest "$SOURCE" 2>/dev/null

run_one() {
  local engine="$1"; local preset="$2"
  echo "    ${engine}/${preset}…"
  docker run --rm \
    -v "$WORK_DIR:/work" \
    -v captions-cache:/data \
    "$IMAGE" \
    /work/source.mp4 \
    --engine "$engine" \
    --preset "$preset" \
    --lang en \
    --upcoming "#8E8E9C" \
    --output "/work/${preset}-${engine}.mp4" \
    2>&1 | grep -E "render:|done|Error" || true
}

# 4. Render every preset × both engines.
for preset in "${PRESETS[@]}"; do
  echo "[$preset]"
  run_one ass "$preset"
  run_one hf  "$preset"
  cp "$WORK_DIR/${preset}-ass.mp4" "$OUT_DIR/"
  cp "$WORK_DIR/${preset}-hf.mp4"  "$OUT_DIR/"
  ffmpeg -y -ss 6 -i "$OUT_DIR/${preset}-ass.mp4" -frames:v 1 "$OUT_DIR/${preset}-ass.png" 2>/dev/null
  ffmpeg -y -ss 6 -i "$OUT_DIR/${preset}-hf.mp4"  -frames:v 1 "$OUT_DIR/${preset}-hf.png"  2>/dev/null
  ffmpeg -y -i "$OUT_DIR/${preset}-ass.png" -i "$OUT_DIR/${preset}-hf.png" \
    -filter_complex "hstack=inputs=2" \
    "$OUT_DIR/${preset}-compare.png" 2>/dev/null || echo "    compare png failed"
done

# 5. Cleanup.
rm -rf "$WORK_DIR"

echo
echo "Done. open $OUT_DIR"
echo "  18 MP4s (9 presets × 2 engines) + 9 side-by-side PNGs"
