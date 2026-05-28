import { test, expect } from '@playwright/test';

// Full flow with whisper stubbed (no model download) and Listmonk mocked.
test('upload -> transcribe -> preview -> email unlock -> export', async ({ page }) => {
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
  await page.route(/\/api\/public\/subscription/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 1 } }) }),
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

  // Clicking a basic style PREVIEWS it live (no gate); card active but locked.
  const basicCard = page.locator('.preset-card[data-tier="basic"]').first();
  await expect(basicCard).toHaveClass(/is-locked/);
  await basicCard.click();
  await expect(basicCard).toHaveClass(/is-active/);
  await expect(page.locator('#email-dialog')).toHaveJSProperty('open', false);

  // Export always works -> a WATERMARKED video + the "remove watermark" CTA.
  await page.click('#export-btn');
  const download = page.locator('#download-link');
  await expect(download).toBeVisible({ timeout: 60_000 });
  await expect(download).toHaveAttribute('href', /^blob:/);
  await expect(page.locator('#unlock-cta')).toBeVisible();

  // The unlock CTA opens the email dialog.
  await page.click('#unlock-btn');
  await expect(page.locator('#email-dialog')).toHaveJSProperty('open', true);
  // Dialog is centered, not pinned to the top-left corner.
  const box = await page.locator('#email-dialog').boundingBox();
  expect(box!.x).toBeGreaterThan(100);
  expect(box!.y).toBeGreaterThan(50);

  // Neutralize altcha (offline), submit -> unlock -> clean re-export.
  await page.evaluate(() => document.querySelector('altcha-widget')?.remove());
  await page.fill('#email-input', 'tester@example.com');
  await page.check('#tos-checkbox');
  await page.click('#email-submit');
  await expect(page.locator('#email-dialog')).toHaveJSProperty('open', false);
  await expect(basicCard).not.toHaveClass(/is-locked/);

  // After unlock the export reruns clean -> download present, no watermark CTA.
  await expect(download).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#unlock-cta')).toBeHidden();
});
