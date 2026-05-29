// Shared types + premium data for the CF Pages Functions. The premium data
// lives in _premium-assets.json (gitignored, bundled into the function only —
// never in the static site), so premium is served only by these gated endpoints.
import assets from '../_premium-assets.json';

export { verifyHmacHex, normEmail, entitlementKey, b64ToBytes, json } from './crypto';

export interface PremiumPreset {
  slug: string;
  tier: string;
  description: string;
  css: string;
  timelineJs?: string;
}

export const PREMIUM_PRESETS = (assets as { presets: PremiumPreset[] }).presets ?? [];
export const PREMIUM_ZIP_B64 = (assets as { zipBase64: string }).zipBase64 ?? '';

/** Sellf product slug that grants this premium pack. */
export const PREMIUM_SLUG = 'captions-premium-styles';

/** Minimal KV shape (avoids pulling @cloudflare/workers-types). */
export interface Env {
  PREMIUM: { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> };
  SELLF_WEBHOOK_SECRET: string;
}

export type Ctx = { request: Request; env: Env };
