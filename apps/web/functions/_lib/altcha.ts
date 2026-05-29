// Self-hosted ALTCHA (proof-of-work) challenge + verification.
//
// Why self-hosted: Listmonk lives on a different subdomain and sends no CORS
// headers, so the browser can't call its altcha/subscription endpoints
// directly. The email form posts to our own same-origin /api/subscribe, which
// verifies the PoW here — real server-side verification, not a trusted token.
const enc = new TextEncoder();
const MAXNUMBER = 100_000;
const TTL_MS = 5 * 60_000;

const toHex = (buf: ArrayBuffer): string =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256Hex(s: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

async function hmacHex(secret: string, s: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(s)));
}

export interface AltchaChallenge {
  algorithm: 'SHA-256';
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
}

export async function createChallenge(secret: string): Promise<AltchaChallenge> {
  const rand = toHex(crypto.getRandomValues(new Uint8Array(12)).buffer);
  const salt = `${rand}?expires=${Math.floor((Date.now() + TTL_MS) / 1000)}`;
  const number = Math.floor(Math.random() * MAXNUMBER);
  const challenge = await sha256Hex(salt + number);
  const signature = await hmacHex(secret, challenge);
  return { algorithm: 'SHA-256', challenge, maxnumber: MAXNUMBER, salt, signature };
}

/** Verify a base64 altcha solution payload against our signing secret. */
export async function verifySolution(payloadB64: string, secret: string): Promise<boolean> {
  if (!payloadB64 || !secret) return false;
  let p: { algorithm?: string; challenge?: string; number?: number; salt?: string; signature?: string };
  try {
    p = JSON.parse(atob(payloadB64));
  } catch {
    return false;
  }
  if (p.algorithm !== 'SHA-256' || !p.salt || !p.challenge || !p.signature || typeof p.number !== 'number') {
    return false;
  }
  const expires = /[?&]expires=(\d+)/.exec(p.salt);
  if (expires && Number(expires[1]) * 1000 < Date.now()) return false;
  if ((await sha256Hex(p.salt + p.number)) !== p.challenge) return false;
  const signature = await hmacHex(secret, p.challenge);
  if (signature.length !== p.signature.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ p.signature.charCodeAt(i);
  return diff === 0;
}
