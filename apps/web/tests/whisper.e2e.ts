import { test, expect } from '@playwright/test';

// Real transformers.js Whisper (tiny, WASM) on a speech fixture. Slow: downloads
// the model + runs inference. This is the proof that word timestamps work.
test('real whisper produces word-level timestamps', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/dev/whisper');
  await page.waitForFunction(
    () => {
      const w = window as unknown as Record<string, unknown>;
      return Boolean(w.__whisper || w.__whisperError);
    },
    null,
    { timeout: 280_000 },
  );

  const r = await page.evaluate(() => {
    const w = window as unknown as { __whisper?: unknown; __whisperError?: string };
    return { whisper: w.__whisper as Record<string, number | string> | undefined, error: w.__whisperError };
  });

  expect(r.error, `whisper error: ${r.error}`).toBeFalsy();
  expect(Number(r.whisper?.wordCount ?? 0)).toBeGreaterThan(0);
  // Timestamps must span the clip, not cluster at the end (the chunk bug).
  expect(Number(r.whisper?.firstStart)).toBeLessThan(Number(r.whisper?.lastEnd));
  // Recognises at least one expected word.
  expect(String(r.whisper?.text ?? '')).toMatch(/hello|world|test|caption/);
});
