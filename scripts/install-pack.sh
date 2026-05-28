#!/usr/bin/env bash
# install-pack.sh — copy a pack's .ts files into BOTH engines' preset
# directories and regenerate their indexes.
#
#   ./scripts/install-pack.sh free       # only the free presets (default state)
#   ./scripts/install-pack.sh basic      # free + basic
#   ./scripts/install-pack.sh premium    # free + basic + premium (full)
#
# This is build-time tooling. The .ts files in packs/ are gitignored
# (basic + premium are paid). Free presets live in source control
# (engine-ass: clean-white.ts, engine-hf: text.ts).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACKS_DIR="$ROOT/packs"

TIER="${1:-free}"
case "$TIER" in
  free|basic|premium) ;;
  *) echo "Usage: $0 <free|basic|premium>"; exit 1 ;;
esac

# install_engine <engine> <presets-dir> <free-file>
install_engine() {
  local engine="$1" presets_dir="$2" free_file="$3"

  echo "→ [$engine] resetting to free pack only…"
  # Wipe every preset except the free one and the generated index.
  find "$presets_dir" -maxdepth 1 -type f -name '*.ts' \
    ! -name "$free_file" ! -name 'index.ts' -delete

  if [[ "$TIER" == "basic" || "$TIER" == "premium" ]]; then
    echo "→ [$engine] installing basic pack…"
    cp "$PACKS_DIR/$engine"/basic/*.ts "$presets_dir/"
  fi
  if [[ "$TIER" == "premium" ]]; then
    echo "→ [$engine] installing premium pack…"
    cp "$PACKS_DIR/$engine"/premium/*.ts "$presets_dir/"
  fi

  echo "→ [$engine] regenerating index.ts…"
  node "$ROOT/scripts/generate-presets-index.mjs" "$engine"

  local count
  count=$(find "$presets_dir" -maxdepth 1 -type f -name '*.ts' ! -name 'index.ts' | wc -l | tr -d ' ')
  echo "   [$engine] active presets: $count"
}

install_engine ass "$ROOT/packages/engine-ass/src/presets" clean-white.ts
install_engine hf  "$ROOT/packages/engine-hf/src/presets"  text.ts

echo
echo "Installed tier: $TIER (both engines)"
