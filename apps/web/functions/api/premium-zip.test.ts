import { test, expect, describe, mock, beforeEach, afterEach } from 'bun:test';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { onRequestGet } from './premium-zip';
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

const bucket = { get: async () => ({ body: new Response('ZIPDATA').body as ReadableStream }) };

function get(token: string | null) {
  const url = token === null ? 'http://x/api/premium-zip' : `http://x/api/premium-zip?token=${encodeURIComponent(token)}`;
  return onRequestGet({
    request: new Request(url),
    env: { SELLF_JWKS_URL: JWKS, PREMIUM_BUCKET: bucket },
  } as never);
}

describe('GET /api/premium-zip', () => {
  beforeEach(() => __resetJwksCache());
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test('400 when token missing', async () => {
    const res = await get(null);
    expect(res.status).toBe(400);
  });

  test('403 for a basic-tier token (ZIP is premium-only)', async () => {
    const { publicKey, privateKey } = kp();
    mockJwks('k1', publicKey);
    const res = await get(tokenFor('basic', privateKey));
    expect(res.status).toBe(403);
  });

  test('200 streams the ZIP for a premium token', async () => {
    const { publicKey, privateKey } = kp();
    mockJwks('k1', publicKey);
    const res = await get(tokenFor('premium', privateKey));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');
    expect(await res.text()).toBe('ZIPDATA');
  });
});
