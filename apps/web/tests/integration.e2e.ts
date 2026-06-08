import { test, expect } from '@playwright/test';

// Full flow with whisper stubbed (no model download). The basic tier is unlocked
// by pasting a Sellf license token; the gated Worker is mocked.
test('upload -> transcribe -> preview -> token unlock (basic) -> clean export', async ({ page }) => {
  test.setTimeout(90_000);

  await page.addInitScript(() => {
    (window as unknown as { __captionsTestHooks: unknown }).__captionsTestHooks = {
      transcribe: async () => [
        { text: 'hello', startTime: 0, endTime: 0.5 },
        { text: 'world', startTime: 0.5, endTime: 1.2 },
      ],
    };
  });
  // Mock the gated Worker: a basic-tier token. Basic styles are bundled, so no
  // premium presets need to be returned.
  await page.route('**/api/premium', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tier: 'basic', presets: [] }),
    }),
  );

  await page.goto('/');

  // Upload the fixture video.
  await page.setInputFiles('#file-input', 'public/test/tiny.mp4');
  await expect(page.locator('#workspace')).toBeVisible();
  await expect(page.locator('#preview-video')).toBeVisible();

  // Generate captions (stubbed) -> preview built.
  await page.click('#transcribe-btn');
  await expect(page.locator('#preset-step')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#captions .word')).toHaveCount(2);

  // Re-generate must work (e.g. after changing model/language/video): the button
  // re-enables and a second run rebuilds the captions. Regression guard.
  await expect(page.locator('#transcribe-btn')).toBeEnabled();
  await page.click('#transcribe-btn');
  await expect(page.locator('#captions .word')).toHaveCount(2);
  await expect(page.locator('#transcribe-btn')).toBeEnabled();

  // Clicking a basic style PREVIEWS it live (no gate); card active but locked.
  const basicCard = page.locator('.preset-card[data-tier="basic"]').first();
  await expect(basicCard).toHaveClass(/is-locked/);
  await basicCard.click();
  await expect(basicCard).toHaveClass(/is-active/);

  // Export always works -> a WATERMARKED video + the "unlock" CTA.
  await page.click('#export-btn');
  const download = page.locator('#download-link');
  await expect(download).toBeVisible({ timeout: 60_000 });
  await expect(download).toHaveAttribute('href', /^blob:/);
  await expect(page.locator('#unlock-cta')).toBeVisible();

  // The unlock CTA scrolls to the panel; paste a (mocked) Sellf token to unlock.
  await page.click('#unlock-btn');
  await page.fill('#premium-token', 'header.signature');
  await page.click('#unlock-premium-btn');
  await expect(basicCard).not.toHaveClass(/is-locked/);
  await expect(page.locator('#unlock-cta')).toBeHidden();

  // After unlock the export reruns clean -> download present.
  await page.click('#export-btn');
  await expect(download).toBeVisible({ timeout: 60_000 });
});
