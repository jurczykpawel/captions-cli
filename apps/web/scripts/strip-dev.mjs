#!/usr/bin/env node
// Remove dev-only harness pages + test fixtures from the production build.
// Playwright sets KEEP_DEV=1 so its preview build keeps them.
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

if (process.env.KEEP_DEV) {
  console.log('KEEP_DEV set — keeping dev harness pages + fixtures.');
} else {
  for (const p of ['dev', 'test']) {
    rmSync(join(dist, p), { recursive: true, force: true });
  }
  console.log('Stripped dist/dev and dist/test from the production build.');
}
