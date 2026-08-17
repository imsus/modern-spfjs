import { expect, test } from '@playwright/test';

test.describe('view transitions', () => {
  test('transitions run by default for spf-links', async ({ page }) => {
    await page.goto('/');
    await page.click('#link-about');
    await expect(page.locator('#text')).toHaveText('About via SPF');

    // spfdone fires after the transition finishes — wait for it rather than
    // racing the animation.
    await expect.poll(() => page.evaluate(() => window.__lastTransitioned)).toBe(true);
  });

  test('spf-no-transition opts a link out', async ({ page }) => {
    await page.goto('/');
    await page.click('#link-notransition');
    await expect(page.locator('#text')).toHaveText('About via SPF');

    await expect.poll(() => page.evaluate(() => window.__lastTransitioned)).toBe(false);
  });

  test('prefers-reduced-motion disables transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.click('#link-about');
    await expect(page.locator('#text')).toHaveText('About via SPF');

    await expect.poll(() => page.evaluate(() => window.__lastTransitioned)).toBe(false);
  });
});
