import { test, expect } from '@playwright/test';

test('caption renderer builds word DOM and advances state on seek', async ({ page }) => {
  await page.goto('/dev/renderer');
  await page.waitForFunction(() => (window as unknown as { __capReady?: boolean }).__capReady === true);

  await expect(page.locator('#captions .word')).toHaveCount(3);

  // At 0.6s: word 0 is past, word 1 is active, word 2 still upcoming.
  await page.evaluate(() => (window as unknown as { __cap: { seek(t: number): void } }).__cap.seek(0.6));
  await expect(page.locator('#cue-0-w-0')).toHaveClass(/word--past/);
  await expect(page.locator('#cue-0-w-1')).toHaveClass(/word--active/);
  await expect(page.locator('#cue-0-w-2')).toHaveClass(/word--upcoming/);

  // At 1.2s: all words past/active appropriately (word 2 active).
  await page.evaluate(() => (window as unknown as { __cap: { seek(t: number): void } }).__cap.seek(1.2));
  await expect(page.locator('#cue-0-w-2')).toHaveClass(/word--active/);
});
