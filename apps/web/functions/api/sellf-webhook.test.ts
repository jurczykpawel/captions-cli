import { test, expect, describe, mock, afterEach } from 'bun:test';
import { createHmac } from 'node:crypto';
import { onRequestPost } from './sellf-webhook';

const SECRET = 'whsec_test';
const SES_ENV = {
  SELLF_WEBHOOK_SECRET: SECRET,
  SES_ACCESS_KEY_ID: 'AKIA_test',
  SES_SECRET_ACCESS_KEY: 'secret_test',
  SES_REGION: 'eu-west-1',
  SES_FROM: 'noreply@techskills.academy',
};

function makeReq(payload: unknown, opts: { t?: number; secret?: string } = {}) {
  const raw = JSON.stringify(payload);
  const t = opts.t ?? Math.floor(Date.now() / 1000);
  const mac = createHmac('sha256', opts.secret ?? SECRET).update(`${t}.${raw}`).digest('hex');
  return new Request('http://x/api/sellf-webhook', {
    method: 'POST',
    headers: { 'X-Sellf-Signature': `t=${t},v1=${mac}`, 'content-type': 'application/json' },
    body: raw,
  });
}

const call = (req: Request) => onRequestPost({ request: req, env: SES_ENV } as never);

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const purchase = (extra: Record<string, unknown> = {}) => ({
  event: 'purchase.completed',
  timestamp: new Date().toISOString(),
  data: {
    customer: { email: 'buyer@example.com' },
    product: { slug: 'captions-premium-styles' },
    license: { token: 'header.signature', kid: 'k1' },
    ...extra,
  },
});

describe('POST /api/sellf-webhook', () => {
  test('401 on a bad signature', async () => {
    const req = makeReq(purchase(), { secret: 'wrong' });
    expect((await call(req)).status).toBe(401);
  });

  test('200 ignored for a non-captions product (no email sent)', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('', { status: 200 })));
    globalThis.fetch = fetchMock as typeof fetch;
    const req = makeReq({ ...purchase(), data: { ...purchase().data, product: { slug: 'something-else' } } });
    expect((await call(req)).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  test('200 with no token (e.g. free event pre-patch) — no email', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('', { status: 200 })));
    globalThis.fetch = fetchMock as typeof fetch;
    const p = purchase();
    delete (p.data as Record<string, unknown>).license;
    const req = makeReq(p);
    expect((await call(req)).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  test('200 + sends the token via SES for a captions purchase', async () => {
    // aws4fetch calls global fetch with a signed Request object.
    let sesUrl = '';
    let sesBody = '';
    const fetchMock = mock(async (input: Request) => {
      sesUrl = input.url;
      sesBody = await input.clone().text().catch(() => '');
      return new Response('{}', { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const res = await call(makeReq(purchase()));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sesUrl).toContain('amazonaws.com/v2/email'); // SES endpoint hit
    expect(sesBody).toContain('header.signature'); // the token is in the email body
  });

  test('200 ignored for an unrelated event', async () => {
    const req = makeReq({ ...purchase(), event: 'subscription.created' });
    expect((await call(req)).status).toBe(200);
  });
});
