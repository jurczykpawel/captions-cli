import { test, expect } from 'bun:test';
import { createHmac } from 'node:crypto';
import { verifyHmacHex, normEmail, b64ToBytes } from './crypto';

// Sellf signs: hex HMAC-SHA256 of the raw body with the endpoint secret.
const sign = (secret: string, body: string) => createHmac('sha256', secret).update(body).digest('hex');

test('verifyHmacHex accepts a valid Sellf-style signature', async () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ event: 'purchase.completed', data: { customer: { email: 'a@b.com' } } });
  expect(await verifyHmacHex(secret, body, sign(secret, body))).toBe(true);
});

test('verifyHmacHex rejects tampered body, wrong secret, or empty inputs', async () => {
  const secret = 'whsec_test';
  const body = '{"a":1}';
  const good = sign(secret, body);
  expect(await verifyHmacHex(secret, '{"a":2}', good)).toBe(false);
  expect(await verifyHmacHex('other', body, good)).toBe(false);
  expect(await verifyHmacHex(secret, body, '')).toBe(false);
  expect(await verifyHmacHex('', body, good)).toBe(false);
});

test('normEmail lowercases and trims', () => {
  expect(normEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  expect(normEmail(undefined)).toBe('');
});

test('b64ToBytes round-trips', () => {
  const bytes = b64ToBytes(btoa('hello'));
  expect(new TextDecoder().decode(bytes)).toBe('hello');
});
