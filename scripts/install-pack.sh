#!/usr/bin/env bash
# install-pack.sh — copy a pack's .ts files into the engine-ass preset
# directory and regenerate the index.
#
#   ./scripts/install-pack.sh free       # only clean-white (default state)
#   ./scripts/install-pack.sh basic      # free + basic
#   ./scripts/install-pack.sh premium    # free + basic + premium (full)
#
# This is build-time tooling. The .ts files in packs/ are gitignored
# (basic + premium are paid). Free pack lives in source control.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRESETS_DIR="$ROOT/packages/engine-ass/src/presets"
PACKS_DIR="$ROOT/packs"

TIER="${1:-free}"
case "$TIER" in
  free|basic|premium) ;;
  *) echo "Usage: $0 <free|basic|premium>"; exit 1 ;;
esac

echo "→ resetting $PRESETS_DIR to free pack only…"
# Wipe everything except clean-white.ts and index.ts. Anything else in
# the dir got copied here by a previous install — clean slate.
find "$PRESETS_DIR" -maxdepth 1 -type f -name '*.ts' \
  ! -name 'clean-white.ts' ! -name 'index.ts' -delete

if [[ "$TIER" == "basic" || "$TIER" == "premium" ]]; then
  echo "→ installing basic pack…"
  cp "$PACKS_DIR"/basic/*.ts "$PRESETS_DIR/"
fi
if [[ "$TIER" == "premium" ]]; then
  echo "→ installing premium pack…"
  cp "$PACKS_DIR"/premium/*.ts "$PRESETS_DIR/"
fi

echo "→ regenerating presets/index.ts…"
node "$ROOT/scripts/generate-presets-index.mjs"

echo
echo "Installed tier: $TIER"
ls "$PRESETS_DIR" | grep '\.ts$' | grep -v 'index.ts' | wc -l | xargs printf "Active presets: %s\n"
