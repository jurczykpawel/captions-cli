import { test, expect } from '@playwright/test';

test('english home renders hero, privacy claims and upload entry', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Captions/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Caption your video');
  await expect(page.getByText('never uploaded to any server')).toBeVisible();
  await expect(page.locator('[data-dropzone]')).toBeVisible();
});

test('polish home renders and language switch returns to english', async ({ page }) => {
  await page.goto('/pl');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dodaj napisy do wideo');
  await page.getByRole('navigation', { name: 'Language' }).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Caption your video');
});

test('legal pages render in both locales', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Privacy Policy');
  await page.goto('/pl/terms');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Regulamin');
});
