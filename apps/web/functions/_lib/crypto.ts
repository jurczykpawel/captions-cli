// Pure helpers (no premium data import) so they're unit-testable on their own.
const enc = new TextEncoder();

/** Verify Sellf's X-Sellf-Signature = hex HMAC-SHA256(body) with the endpoint secret. */
export async function verifyHmacHex(secret: string, body: string, sigHex: string): Promise<boolean> {
  if (!secret || !sigHex) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (expected.length !== sigHex.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sigHex.charCodeAt(i);
  return diff === 0;
}

export function normEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function entitlementKey(email: string): string {
  return `buyer:${email}`;
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
