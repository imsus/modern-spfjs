import { expect, test } from '@playwright/test';

test.describe('navigation', () => {
  test('clicking an spf-link swaps the fragment without a full page load', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => window.__loads)).toBe(1);

    await page.click('#link-about');

    // Fragment content, title and URL are updated…
    await expect(page.locator('#text')).toHaveText('About via SPF');
    await expect(page).toHaveTitle('About — SPF');
    expect(page.url()).toBe('http://127.0.0.1:4173/about');

    // …and the page was never reloaded.
    await expect.poll(() => page.evaluate(() => window.__loads)).toBe(1);
  });

  test('navigation pushes a history entry and back returns to the previous page', async ({
    page,
  }) => {
    await page.goto('/');
    await page.click('#link-about');
    await expect(page.locator('#text')).toHaveText('About via SPF');

    await page.click('#link-stream');
    await expect(page.locator('#text')).toHaveText('Streamed content');

    await page.goBack();
    await expect(page.locator('#text')).toHaveText('About via SPF');
    expect(page.url()).toBe('http://127.0.0.1:4173/about');
    await expect.poll(() => page.evaluate(() => window.__loads)).toBe(1);
  });
});
