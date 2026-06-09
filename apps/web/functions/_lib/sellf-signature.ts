// Verify Sellf's outbound webhook signature (replay-resistant, versioned).
//
//   X-Sellf-Signature: t=<unix_s>,v1=<HMAC-SHA256(secret, "<t>.<rawBody>")>  (lowercase hex)
//
// The timestamp is signed INSIDE the MAC, so a captured header can't be replayed
// with a different body or time. Receivers recompute the MAC over `${t}.${rawBody}`,
// constant-time compare, and reject anything outside a ±tolerance window.
// Port of sellf admin-panel/src/lib/services/webhook-queue/signature.ts to WebCrypto.
const enc = new TextEncoder();
const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

export function parseSignatureHeader(header: string): { t: number | null; v1: string | null } {
  let t: number | null = null;
  let v1: string | null = null;
  for (const part of header.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 't' && /^\d+$/.test(value)) t = Number(value);
    else if (key === 'v1') v1 = value;
  }
  return { t, v1 };
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string,
  opts: { toleranceSeconds?: number; nowSeconds?: number } = {},
): Promise<boolean> {
  if (!secret || !signatureHeader) return false;
  const { t, v1 } = parseSignatureHeader(signatureHeader);
  if (t === null || !v1) return false;

  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(now - t) > tolerance) return false;

  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  return timingSafeEqualHex(expected, v1);
}
