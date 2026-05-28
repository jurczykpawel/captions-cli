#!/usr/bin/env bash
# Render every preset through BOTH engines using the captions-cli:full
# Docker image, then ffmpeg-stack the matching frames so you can spot
# the look differences side-by-side.
#
# Output: ~/Downloads/caption-engines-compare/
#   <preset>-ass.mp4
#   <preset>-hf.mp4
#   <preset>-compare.png       # ASS | HF, frame at 6 s

set -euo pipefail

INPUT="${1:-$HOME/Downloads/agent-vs-chatbot.mp4}"
LANG_CODE="${LANG_CODE:-pl}"
OUT_DIR="$HOME/Downloads/caption-engines-compare"
WORK_DIR="$(mktemp -d)"
IMAGE="${IMAGE:-captions-cli:full}"

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
cp "$INPUT" "$WORK_DIR/input.mp4"

run_one() {
  local engine="$1"; local preset="$2"
  echo "  ${engine}/${preset}…"
  docker run --rm \
    -v "$WORK_DIR:/work" \
    -v captions-cache:/data \
    "$IMAGE" \
    /work/input.mp4 \
    --engine "$engine" \
    --preset "$preset" \
    --lang "$LANG_CODE" \
    --upcoming "#8E8E9C" \
    --output "/work/${preset}-${engine}.mp4" \
    2>&1 | grep -E "render:|done|Error" || true
}

for preset in "${PRESETS[@]}"; do
  echo "[$preset]"
  run_one ass "$preset"
  run_one hf  "$preset"
  cp "$WORK_DIR/${preset}-ass.mp4" "$OUT_DIR/"
  cp "$WORK_DIR/${preset}-hf.mp4"  "$OUT_DIR/"
  ffmpeg -y -ss 6 -i "$OUT_DIR/${preset}-ass.mp4" -frames:v 1 "$OUT_DIR/${preset}-ass.png" 2>/dev/null
  ffmpeg -y -ss 6 -i "$OUT_DIR/${preset}-hf.mp4"  -frames:v 1 "$OUT_DIR/${preset}-hf.png"  2>/dev/null
  # Plain hstack — left = ASS, right = HF. (drawtext filter requires
  # libfreetype which not every ffmpeg build has; the filename + side
  # already encode which is which.)
  ffmpeg -y -i "$OUT_DIR/${preset}-ass.png" -i "$OUT_DIR/${preset}-hf.png" \
    -filter_complex "hstack=inputs=2" \
    "$OUT_DIR/${preset}-compare.png" 2>/dev/null || echo "  compare failed"
  echo "  → $OUT_DIR/${preset}-compare.png"
done

rm -rf "$WORK_DIR"
echo
echo "Done. open $OUT_DIR"
