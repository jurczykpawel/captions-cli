import { test, expect, describe } from 'bun:test';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature, parseSignatureHeader } from './sellf-signature';

const SECRET = 'whsec_test_secret';

// Sign exactly like Sellf: header = `t=<t>,v1=HMAC(secret, "<t>.<rawBody>")`.
function sign(rawBody: string, t: number, secret = SECRET): string {
  const mac = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${mac}`;
}

const body = JSON.stringify({ event: 'purchase.completed', data: { x: 1 } });

describe('parseSignatureHeader', () => {
  test('parses t + v1, order-independent', () => {
    expect(parseSignatureHeader('t=123,v1=abc')).toEqual({ t: 123, v1: 'abc' });
    expect(parseSignatureHeader('v1=abc,t=123')).toEqual({ t: 123, v1: 'abc' });
  });
  test('rejects malformed', () => {
    expect(parseSignatureHeader('garbage')).toEqual({ t: null, v1: null });
    expect(parseSignatureHeader('t=notnum,v1=abc')).toEqual({ t: null, v1: 'abc' });
  });
});

describe('verifyWebhookSignature', () => {
  test('accepts a fresh, correctly-signed body', async () => {
    const now = 1_700_000_000;
    const header = sign(body, now);
    expect(await verifyWebhookSignature(SECRET, body, header, { nowSeconds: now })).toBe(true);
  });

  test('rejects a tampered body', async () => {
    const now = 1_700_000_000;
    const header = sign(body, now);
    expect(await verifyWebhookSignature(SECRET, body + 'x', header, { nowSeconds: now })).toBe(false);
  });

  test('rejects a wrong secret', async () => {
    const now = 1_700_000_000;
    const header = sign(body, now, 'other_secret');
    expect(await verifyWebhookSignature(SECRET, body, header, { nowSeconds: now })).toBe(false);
  });

  test('rejects a replayed (out-of-window) timestamp', async () => {
    const t = 1_700_000_000;
    const header = sign(body, t);
    // now is 6 minutes after the signature → outside the ±5 min window
    expect(await verifyWebhookSignature(SECRET, body, header, { nowSeconds: t + 6 * 60 })).toBe(false);
  });

  test('accepts within the window', async () => {
    const t = 1_700_000_000;
    const header = sign(body, t);
    expect(await verifyWebhookSignature(SECRET, body, header, { nowSeconds: t + 4 * 60 })).toBe(true);
  });

  test('rejects empty/malformed header or missing secret', async () => {
    expect(await verifyWebhookSignature(SECRET, body, '', { nowSeconds: 1 })).toBe(false);
    expect(await verifyWebhookSignature('', body, sign(body, 1), { nowSeconds: 1 })).toBe(false);
  });
});
