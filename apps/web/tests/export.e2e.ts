import { test, expect } from '@playwright/test';

test('mediabunny engine exports an mp4 blob from a real video', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/dev/export');
  await page.waitForFunction(
    () => {
      const w = window as unknown as Record<string, unknown>;
      return Boolean(w.__exportResult || w.__exportError);
    },
    null,
    { timeout: 80_000 },
  );

  const { result, error, engineId } = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    return { result: w.__exportResult, error: w.__exportError, engineId: w.__engineId };
  });

  expect(error, `export error (engine=${engineId}): ${error}`).toBeFalsy();
  expect((result as { size: number } | undefined)?.size ?? 0).toBeGreaterThan(1000);
  expect((result as { type: string } | undefined)?.type).toBe('video/mp4');
});
