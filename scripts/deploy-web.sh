#!/usr/bin/env bash
# Standard deploy for the web app (apps/web):
#   1. build (regenerates premium assets + previews from the private pack)
#   2. push the premium pack ZIP to R2 (streamed by /api/premium-zip)
#   3. deploy to Cloudflare Pages
#
# Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment.
# The premium ZIP is uploaded to R2 (never embedded in the Worker), so updating
# a pack is just: re-run this script.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HAVE_PACKS=0
[ -d "$ROOT/packs/hf/premium" ] && HAVE_PACKS=1

# Install the full pack so basic + premium tiers ship; restore the free-only
# (public) state afterwards so the tree never sits in a leaky state.
restore_free() { [ "$HAVE_PACKS" = 1 ] && "$ROOT/scripts/install-pack.sh" free >/dev/null; }
trap restore_free EXIT
[ "$HAVE_PACKS" = 1 ] && "$ROOT/scripts/install-pack.sh" premium

cd "$ROOT/apps/web"
bun run build

ZIP="$ROOT/dist-pack/captions-premium.zip"
if [ -f "$ZIP" ]; then
  echo "Uploading premium pack to R2…"
  bunx wrangler r2 object put captions-premium/captions-premium.zip --file "$ZIP" --remote
else
  echo "No premium pack present (free build) — skipping R2 upload."
fi

bunx wrangler pages deploy dist --project-name captions --branch main
