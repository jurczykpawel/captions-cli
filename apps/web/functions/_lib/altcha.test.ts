import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { createChallenge, verifySolution } from './altcha';

// Solve the PoW the way the browser widget does: find the number whose
// SHA-256(salt + number) equals the challenge, then base64 the payload.
async function solve(secret: string): Promise<string> {
  const c = await createChallenge(secret);
  let number = -1;
  for (let n = 0; n <= c.maxnumber; n++) {
    if (createHash('sha256').update(c.salt + n).digest('hex') === c.challenge) {
      number = n;
      break;
    }
  }
  expect(number).toBeGreaterThanOrEqual(0);
  return btoa(JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number, salt: c.salt, signature: c.signature }));
}

test('verifySolution accepts a correctly solved challenge', async () => {
  const secret = 'altcha_test_secret';
  expect(await verifySolution(await solve(secret), secret)).toBe(true);
});

test('verifySolution rejects wrong secret, garbage, and empty input', async () => {
  const secret = 'altcha_test_secret';
  const good = await solve(secret);
  expect(await verifySolution(good, 'other_secret')).toBe(false);
  expect(await verifySolution('not-base64-{', secret)).toBe(false);
  expect(await verifySolution('', secret)).toBe(false);
});

test('verifySolution rejects a tampered number', async () => {
  const secret = 'altcha_test_secret';
  const c = await createChallenge(secret);
  // Claim a number without doing the work — hash won't match the challenge.
  const forged = btoa(JSON.stringify({ algorithm: 'SHA-256', challenge: c.challenge, number: 999999, salt: c.salt, signature: c.signature }));
  expect(await verifySolution(forged, secret)).toBe(false);
});

test('verifySolution rejects an expired challenge', async () => {
  const secret = 'altcha_test_secret';
  const salt = `deadbeef?expires=${Math.floor(Date.now() / 1000) - 10}`;
  const challenge = createHash('sha256').update(salt + '5').digest('hex');
  // sign with a throwaway to shape the payload; expiry is checked before signature
  const payload = btoa(JSON.stringify({ algorithm: 'SHA-256', challenge, number: 5, salt, signature: 'x' }));
  expect(await verifySolution(payload, secret)).toBe(false);
});
