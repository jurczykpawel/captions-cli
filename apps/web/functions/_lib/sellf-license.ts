// Offline verification of Sellf-issued license tokens. The token rides on the
// purchase webhook as `license.token`; we verify it here with no callback to
// Sellf at request time — just the seller's public keys from the JWKS endpoint.
//
// Token: `payloadB64url.sigB64url`. payload = base64url(JSON(claims)). The
// signature is ECDSA P-256 / SHA-256 over the ASCII bytes of the payload segment.
//
// Interop note: Sellf signs with node `createSign('SHA256').sign()`, which emits
// an ASN.1 DER signature. WebCrypto's `verify` wants raw IEEE-P1363 r||s, so we
// convert DER -> raw before verifying. The public key arrives as SPKI PEM and is
// converted PEM -> DER for importKey('spki', …).

export interface Claims {
  v: number;
  kid: string;
  product: string;
  email: string;
  order: string;
  tier: string | null;
  iat: number;
  exp: number | null;
}

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function parseClaims(token: string): Claims | null {
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  try {
    const json = new TextDecoder().decode(b64urlToBytes(token.slice(0, dot)));
    return JSON.parse(json) as Claims;
  } catch {
    return null;
  }
}

// PEM (SPKI) -> DER bytes for importKey('spki', …).
function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  return b64urlToBytes(body);
}

// ASN.1 DER ECDSA signature (SEQUENCE{ INTEGER r, INTEGER s }) -> raw r||s
// (64 bytes for P-256). Strips minimal-encoding leading zeros and left-pads.
function derToRaw(der: Uint8Array): Uint8Array {
  let offset = 2; // skip SEQUENCE tag (0x30) + length byte
  if (der[1] & 0x80) offset += der[1] & 0x7f; // long-form length
  const readInt = (): Uint8Array => {
    if (der[offset] !== 0x02) throw new Error('bad DER INTEGER');
    let len = der[offset + 1];
    let start = offset + 2;
    while (len > 0 && der[start] === 0x00) {
      start++;
      len--;
    }
    offset = start + len;
    return der.slice(start, start + len);
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return raw;
}

export async function verifyTokenSignature(token: string, publicKeyPem: string): Promise<boolean> {
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  try {
    const signed = new TextEncoder().encode(token.slice(0, dot));
    const raw = derToRaw(b64urlToBytes(token.slice(dot + 1)));
    const key = await crypto.subtle.importKey(
      'spki',
      pemToDer(publicKeyPem),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, raw, signed);
  } catch {
    return false;
  }
}

export interface JwksKey {
  kid: string;
  alg: string;
  pem: string;
}
type FetchImpl = (url: string) => Promise<Response>;

interface CacheEntry {
  keys: JwksKey[];
  freshUntil: number; // serve without refetching
  staleUntil: number; // serve on a failed refresh (outage), don't fail closed
}
const jwksCache = new Map<string, CacheEntry>();
const JWKS_FRESH_MS = 300_000; // 5 min
const JWKS_STALE_MS = 7 * 24 * 60 * 60_000; // 7 days serve-stale-on-error

/** Test seam: clears the in-memory JWKS cache. */
export function __resetJwksCache(): void {
  jwksCache.clear();
}

/**
 * Parse a pinned JWKS snapshot (`{ keys: [{ kid, alg, pem }] }`) from an env
 * var. This is the durable fallback used only when the live JWKS endpoint is
 * unreachable AND nothing is cached (e.g. a cold isolate during an outage).
 * It's public-key material — safe to keep in config / archive in the vault.
 */
export function parseJwksJson(raw: string | null | undefined): JwksKey[] {
  if (!raw) return [];
  try {
    const body = JSON.parse(raw) as { keys?: JwksKey[] };
    if (!Array.isArray(body.keys)) return [];
    return body.keys.filter((k): k is JwksKey => !!k && !!k.kid && !!k.pem);
  } catch {
    return [];
  }
}

async function loadJwks(
  url: string,
  fetchImpl: FetchImpl,
  fallbackKeys: JwksKey[],
  nowMs: number,
): Promise<JwksKey[]> {
  const hit = jwksCache.get(url);
  if (hit && hit.freshUntil > nowMs) return hit.keys;

  try {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`jwks ${res.status}`);
    const body = (await res.json()) as { keys?: JwksKey[] };
    const keys = body.keys ?? [];
    // Treat an empty key set as a soft failure so it can't overwrite good keys.
    if (keys.length === 0) throw new Error('jwks empty');
    jwksCache.set(url, { keys, freshUntil: nowMs + JWKS_FRESH_MS, staleUntil: nowMs + JWKS_STALE_MS });
    return keys;
  } catch (err) {
    // A transient JWKS outage (or an empty response) must not revoke every
    // valid token. Prefer the last-known-good keys, then a durable pinned
    // snapshot, before failing closed.
    if (hit && hit.staleUntil > nowMs) return hit.keys;
    if (fallbackKeys.length > 0) return fallbackKeys;
    throw err;
  }
}

export type VerifyResult =
  | { valid: true; tier: string | null; claims: Claims }
  | { valid: false; reason: 'malformed' | 'unknown_kid' | 'bad_signature' | 'expired' | 'jwks_error' };

export async function verifySellfToken(
  token: string,
  jwksUrl: string,
  opts: { fetchImpl?: FetchImpl; now?: number; fallbackKeys?: JwksKey[]; cacheNowMs?: number } = {},
): Promise<VerifyResult> {
  const fetchImpl = opts.fetchImpl ?? ((u: string) => fetch(u));
  const claims = parseClaims(token);
  if (!claims) return { valid: false, reason: 'malformed' };

  let keys: JwksKey[];
  try {
    keys = await loadJwks(jwksUrl, fetchImpl, opts.fallbackKeys ?? [], opts.cacheNowMs ?? Date.now());
  } catch {
    return { valid: false, reason: 'jwks_error' };
  }

  const jwk = keys.find((k) => k.kid === claims.kid);
  if (!jwk) return { valid: false, reason: 'unknown_kid' };
  if (!(await verifyTokenSignature(token, jwk.pem))) return { valid: false, reason: 'bad_signature' };

  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) return { valid: false, reason: 'expired' };
  return { valid: true, tier: claims.tier, claims };
}
