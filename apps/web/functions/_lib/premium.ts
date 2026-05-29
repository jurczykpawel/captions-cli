// Shared types + premium data for the CF Pages Functions. The premium data
// lives in _premium-assets.json (gitignored, bundled into the function only —
// never in the static site), so premium is served only by these gated endpoints.
import assets from '../_premium-assets.json';

export { verifyHmacHex, normEmail, entitlementKey, generateLicenseKey, json } from './crypto';
export { sendLicenseEmail } from './ses';

export interface PremiumPreset {
  slug: string;
  tier: string;
  description: string;
  css: string;
  timelineJs?: string;
}

export const PREMIUM_PRESETS = (assets as { presets: PremiumPreset[] }).presets ?? [];

/** Sellf product slug that grants this premium pack. */
export const PREMIUM_SLUG = 'captions-premium-styles';

/** R2 object key for the buyer's CLI pack ZIP. */
export const PREMIUM_ZIP_KEY = 'captions-premium.zip';

/** Minimal binding shapes (avoids pulling @cloudflare/workers-types). */
export interface Env {
  PREMIUM: { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> };
  PREMIUM_BUCKET: { get(key: string): Promise<{ body: ReadableStream } | null> };
  SELLF_WEBHOOK_SECRET: string;
  SES_ACCESS_KEY_ID: string;
  SES_SECRET_ACCESS_KEY: string;
  SES_REGION: string;
  SES_FROM: string;
}

export type Ctx = { request: Request; env: Env };
