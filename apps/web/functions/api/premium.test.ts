import { test, expect, describe, mock, beforeEach, afterEach } from 'bun:test';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { onRequestPost } from './premium';
import { __resetJwksCache } from '../_lib/sellf-license';

function kp() {
  return generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function tokenFor(tier: string, priv: string, kid = 'k1') {
  const claims = { v: 1, kid, product: 'p', email: 'a@b.c', order: 'o', tier, iat: 1700000000, exp: null };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = createSign('SHA256').update(payload).end().sign(priv).toString('base64url');
  return `${payload}.${sig}`;
}

const JWKS = 'https://sellf.example/api/licenses/jwks?seller=s1';
const realFetch = globalThis.fetch;

function mockJwks(kid: string, pem: string) {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify({ keys: [{ kid, alg: 'ES256', pem }] }), { status: 200 })),
  ) as typeof fetch;
}

function post(token: unknown, env: { SELLF_JWKS_URL: string }) {
  const body = token === undefined ? '{}' : JSON.stringify({ token });
  return onRequestPost({ request: new Request('http://x/api/premium', { method: 'POST', body }), env } as never);
}

describe('POST /api/premium', () => {
  beforeEach(() => __resetJwksCache());
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test('400 when token missing', async () => {
    const res = await post(undefined, { SELLF_JWKS_URL: JWKS });
    expect(res.status).toBe(400);
  });

  test('403 on a bogus token', async () => {
    mockJwks('k1', 'not-a-key');
    const res = await post('bad.bad', { SELLF_JWKS_URL: JWKS });
    expect(res.status).toBe(403);
  });

  test('200 returns tier + presets for a valid premium token', async () => {
    const { publicKey, privateKey } = kp();
    mockJwks('k1', publicKey);
    const res = await post(tokenFor('premium', privateKey), { SELLF_JWKS_URL: JWKS });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tier: string; presets: unknown[] };
    expect(body.tier).toBe('premium');
    expect(Array.isArray(body.presets)).toBe(true);
  });
});
