import { test, expect, describe, mock, beforeEach } from 'bun:test';
import { generateKeyPairSync, createSign } from 'node:crypto';
import {
  parseClaims,
  verifyTokenSignature,
  verifySellfToken,
  parseJwksJson,
  __resetJwksCache,
  type Claims,
} from './sellf-license';

// Sign exactly like Sellf: base64url(JSON(claims)) is the signed string; node
// createSign emits a DER signature; base64url it.
function signLikeSellf(claims: Claims, privateKeyPem: string): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = createSign('SHA256').update(payload).end().sign(privateKeyPem).toString('base64url');
  return `${payload}.${sig}`;
}

function freshKeypair() {
  return generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

const baseClaims: Claims = {
  v: 1,
  kid: 'testkid',
  product: 'captions-premium-styles',
  email: 'a@b.c',
  order: 'ord_1',
  tier: 'premium',
  iat: 1700000000,
  exp: null,
};

function jwksResponse(kid: string, pem: string): Response {
  return new Response(JSON.stringify({ keys: [{ kid, alg: 'ES256', pem }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const JWKS = 'https://sellf.example/api/licenses/jwks?seller=s1';

describe('parseClaims', () => {
  test('decodes the payload segment to claims', () => {
    const { privateKey } = freshKeypair();
    const token = signLikeSellf(baseClaims, privateKey);
    expect(parseClaims(token)).toEqual(baseClaims);
  });
  test('returns null on malformed token', () => {
    expect(parseClaims('not-a-token')).toBeNull();
    expect(parseClaims('')).toBeNull();
  });
});

describe('verifyTokenSignature', () => {
  test('accepts a genuine Sellf-style (DER) signature via WebCrypto', async () => {
    const { publicKey, privateKey } = freshKeypair();
    const token = signLikeSellf(baseClaims, privateKey);
    expect(await verifyTokenSignature(token, publicKey)).toBe(true);
  });
  test('rejects a tampered payload', async () => {
    const { publicKey, privateKey } = freshKeypair();
    const token = signLikeSellf(baseClaims, privateKey);
    const sig = token.split('.')[1];
    const forged =
      Buffer.from(JSON.stringify({ ...baseClaims, email: 'evil@x' })).toString('base64url') + '.' + sig;
    expect(await verifyTokenSignature(forged, publicKey)).toBe(false);
  });
  test('rejects a signature from a different key', async () => {
    const { privateKey } = freshKeypair();
    const { publicKey: otherPub } = freshKeypair();
    const token = signLikeSellf(baseClaims, privateKey);
    expect(await verifyTokenSignature(token, otherPub)).toBe(false);
  });
});

describe('verifySellfToken', () => {
  beforeEach(() => __resetJwksCache());

  test('returns valid + tier for a good token (kid match)', async () => {
    const { publicKey, privateKey } = freshKeypair();
    const claims = { ...baseClaims, kid: 'k1', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = signLikeSellf(claims, privateKey);
    const res = await verifySellfToken(token, JWKS, {
      fetchImpl: mock(() => Promise.resolve(jwksResponse('k1', publicKey))),
    });
    expect(res).toEqual({ valid: true, tier: 'premium', claims });
  });

  test('rejects an expired token', async () => {
    const { publicKey, privateKey } = freshKeypair();
    const claims = { ...baseClaims, kid: 'k1', exp: Math.floor(Date.now() / 1000) - 10 };
    const token = signLikeSellf(claims, privateKey);
    const res = await verifySellfToken(token, JWKS, {
      fetchImpl: mock(() => Promise.resolve(jwksResponse('k1', publicKey))),
    });
    expect(res).toEqual({ valid: false, reason: 'expired' });
  });

  test('rejects when kid not in JWKS', async () => {
    const { publicKey, privateKey } = freshKeypair();
    const token = signLikeSellf({ ...baseClaims, kid: 'missing' }, privateKey);
    const res = await verifySellfToken(token, JWKS, {
      fetchImpl: mock(() => Promise.resolve(jwksResponse('k1', publicKey))),
    });
    expect(res).toEqual({ valid: false, reason: 'unknown_kid' });
  });

  test('rejects a malformed token without fetching', async () => {
    const fetchMock = mock(() => Promise.resolve(jwksResponse('k1', 'x')));
    const res = await verifySellfToken('garbage', JWKS, { fetchImpl: fetchMock });
    expect(res).toEqual({ valid: false, reason: 'malformed' });
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  test('caches JWKS within TTL (one fetch for two verifies)', async () => {
    const { publicKey, privateKey } = freshKeypair();
    const token = signLikeSellf({ ...baseClaims, kid: 'k1', exp: null }, privateKey);
    const fetchMock = mock(() => Promise.resolve(jwksResponse('k1', publicKey)));
    await verifySellfToken(token, JWKS, { fetchImpl: fetchMock });
    await verifySellfToken(token, JWKS, { fetchImpl: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('JWKS resilience (key rotation / outage)', () => {
  beforeEach(() => __resetJwksCache());

  const okThenFail = (publicKey: string) => {
    let calls = 0;
    return mock(() => {
      calls++;
      return calls === 1
        ? Promise.resolve(jwksResponse('k1', publicKey))
        : Promise.reject(new Error('JWKS endpoint down'));
    });
  };

  test('serves stale keys when a later JWKS refresh fails (outage)', async () => {
    const { publicKey, privateKey } = freshKeypair();
    const token = signLikeSellf({ ...baseClaims, kid: 'k1', exp: null }, privateKey);
    const fetchImpl = okThenFail(publicKey);

    // t0: warm the cache.
    const first = await verifySellfToken(token, JWKS, { fetchImpl, cacheNowMs: 1000 });
    expect(first.valid).toBe(true);

    // t0 + 6min: past the 5min fresh TTL → refetch attempt fails → serve stale.
    const second = await verifySellfToken(token, JWKS, { fetchImpl, cacheNowMs: 1000 + 360_000 });
    expect(second.valid).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('falls back to a pinned JWKS snapshot when the endpoint is down (cold isolate)', async () => {
    const { publicKey, privateKey } = freshKeypair();
    const token = signLikeSellf({ ...baseClaims, kid: 'k1', exp: null }, privateKey);
    const fetchImpl = mock(() => Promise.reject(new Error('JWKS endpoint down')));

    const res = await verifySellfToken(token, JWKS, {
      fetchImpl,
      fallbackKeys: [{ kid: 'k1', alg: 'ES256', pem: publicKey }],
    });
    expect(res).toEqual({ valid: true, tier: 'premium', claims: { ...baseClaims, kid: 'k1', exp: null } });
  });

  test('fails closed when the endpoint is down and there is no cache or fallback', async () => {
    const { privateKey } = freshKeypair();
    const token = signLikeSellf({ ...baseClaims, kid: 'k1', exp: null }, privateKey);
    const fetchImpl = mock(() => Promise.reject(new Error('JWKS endpoint down')));
    const res = await verifySellfToken(token, JWKS, { fetchImpl });
    expect(res).toEqual({ valid: false, reason: 'jwks_error' });
  });

  test('an empty JWKS response does not overwrite good cached keys', async () => {
    const { publicKey, privateKey } = freshKeypair();
    const token = signLikeSellf({ ...baseClaims, kid: 'k1', exp: null }, privateKey);
    let calls = 0;
    const fetchImpl = mock(() => {
      calls++;
      return calls === 1
        ? Promise.resolve(jwksResponse('k1', publicKey))
        : Promise.resolve(new Response(JSON.stringify({ keys: [] }), { status: 200 }));
    });
    await verifySellfToken(token, JWKS, { fetchImpl, cacheNowMs: 1000 });
    const res = await verifySellfToken(token, JWKS, { fetchImpl, cacheNowMs: 1000 + 360_000 });
    expect(res.valid).toBe(true); // stale good keys win over an empty refresh
  });
});

describe('parseJwksJson', () => {
  test('parses the {keys:[…]} snapshot used for the env fallback', () => {
    const raw = JSON.stringify({ keys: [{ kid: 'k1', alg: 'ES256', pem: 'PEM' }] });
    expect(parseJwksJson(raw)).toEqual([{ kid: 'k1', alg: 'ES256', pem: 'PEM' }]);
  });
  test('returns [] for missing / malformed / keyless input', () => {
    expect(parseJwksJson(undefined)).toEqual([]);
    expect(parseJwksJson('')).toEqual([]);
    expect(parseJwksJson('not json')).toEqual([]);
    expect(parseJwksJson('{"nope":1}')).toEqual([]);
  });
});
