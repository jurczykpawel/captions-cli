// Shared types + premium data for the CF Pages Functions. The premium data
// lives in _premium-assets.json (gitignored, bundled into the function only —
// never in the static site), so premium is served only by these gated endpoints.
//
// Gating is stateless: a Sellf-issued license token is verified offline against
// the seller's JWKS (see sellf-license.ts). No KV, no minted keys, no webhook.
import assets from '../_premium-assets.json';

export { verifySellfToken, parseClaims, type Claims, type VerifyResult } from './sellf-license';
export { allowedTiers, presetsForTier } from './tiers';

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export interface PremiumPreset {
  slug: string;
  tier: string;
  description: string;
  css: string;
  timelineJs?: string;
}

export const PREMIUM_PRESETS = (assets as { presets: PremiumPreset[] }).presets ?? [];

/** R2 object key for the buyer's CLI pack ZIP (premium tier only). */
export const PREMIUM_ZIP_KEY = 'captions-premium.zip';

/** Minimal binding shapes (avoids pulling @cloudflare/workers-types). */
export interface Env {
  PREMIUM_BUCKET: { get(key: string): Promise<{ body: ReadableStream } | null> };
  /** Sellf JWKS endpoint, e.g. https://sellf.techskills.academy/api/licenses/jwks?seller=<id> */
  SELLF_JWKS_URL: string;
}

export type Ctx = { request: Request; env: Env };
