import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

// process.cwd() is apps/web (Playwright config dir).
const ROOT = resolve(process.cwd(), '../../');
const PACKS = resolve(ROOT, 'packs/hf/premium');
const ASSETS = resolve(ROOT, 'apps/web/functions/_premium-assets.json');

test.describe('premium unlock', () => {
  test.skip(!existsSync(PACKS), 'private premium packs not present (free clone)');

  test('enter license key -> premium unlocks + CLI download appears + clean export', async ({ page }) => {
    test.setTimeout(90_000);
    // Build the real premium data; mock the gated Worker (astro preview can't run Functions).
    execSync('bun scripts/build-premium-pack.mjs', { cwd: ROOT, stdio: 'ignore' });
    const assets = JSON.parse(readFileSync(ASSETS, 'utf8')) as { presets: unknown[] };

    await page.addInitScript(() => {
      (window as unknown as { __captionsTestHooks: unknown }).__captionsTestHooks = {
        skipAltcha: true,
        transcribe: async () => [
          { text: 'hello', startTime: 0, endTime: 0.5 },
          { text: 'world', startTime: 0.5, endTime: 1.2 },
        ],
      };
    });
    await page.route('**/api/premium', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ presets: assets.presets }) }),
    );

    await page.goto('/');
    await page.setInputFiles('#file-input', 'public/test/tiny.mp4');
    await page.click('#transcribe-btn');
    await expect(page.locator('#preset-step')).toBeVisible({ timeout: 30_000 });

    const premiumCard = page.locator('.preset-card[data-tier="premium"]').first();
    await expect(premiumCard).toHaveClass(/is-locked/);

    // Unlock with the license key (emailed after purchase).
    await page.fill('#premium-key', 'cap_test0123456789abcdef');
    await page.click('#unlock-premium-btn');
    await expect(premiumCard).not.toHaveClass(/is-locked/, { timeout: 15_000 });
    await expect(page.locator('#download-cli-link')).toBeVisible();

    // Premium previews live and exports without a watermark.
    await premiumCard.click();
    await expect(premiumCard).toHaveClass(/is-active/);
    await page.click('#export-btn');
    const download = page.locator('#download-link');
    await expect(download).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('#unlock-cta')).toBeHidden();
  });
});
