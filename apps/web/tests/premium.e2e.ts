import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

// process.cwd() is apps/web (Playwright config dir).
const ROOT = resolve(process.cwd(), '../../');
const PACKS = resolve(ROOT, 'packs/hf/premium');
const ZIP = resolve(ROOT, 'dist-pack/captions-premium.zip');

test.describe('premium pack', () => {
  test.skip(!existsSync(PACKS), 'private premium packs not present (free clone)');

  test.beforeAll(() => {
    execSync('bun scripts/build-premium-pack.mjs', { cwd: ROOT, stdio: 'ignore' });
  });

  test('buy/load: a premium .zip unlocks premium styles', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      (window as unknown as { __captionsTestHooks: unknown }).__captionsTestHooks = {
        skipAltcha: true,
        transcribe: async () => [
          { text: 'hello', startTime: 0, endTime: 0.5 },
          { text: 'world', startTime: 0.5, endTime: 1.2 },
        ],
      };
    });

    await page.goto('/');
    await page.setInputFiles('#file-input', 'public/test/tiny.mp4');
    await page.click('#transcribe-btn');
    await expect(page.locator('#preset-step')).toBeVisible({ timeout: 30_000 });

    // Premium is locked and not in the build: clicking shows the buy/load panel.
    const premiumCard = page.locator('.preset-card[data-tier="premium"]').first();
    await expect(premiumCard).toHaveClass(/is-locked/);
    await premiumCard.click();
    await expect(page.locator('#premium-status')).toContainText(/pack|paczk/i);

    // Load the purchased pack -> premium unlocks.
    await page.setInputFiles('#premium-file', ZIP);
    await expect(premiumCard).not.toHaveClass(/is-locked/, { timeout: 15_000 });

    // Now a premium style previews live and exports without a watermark.
    await premiumCard.click();
    await expect(premiumCard).toHaveClass(/is-active/);
    await page.click('#export-btn');
    const download = page.locator('#download-link');
    await expect(download).toBeVisible({ timeout: 60_000 });
    await expect(download).toHaveAttribute('href', /^blob:/);
    await expect(page.locator('#unlock-cta')).toBeHidden();
  });
});
