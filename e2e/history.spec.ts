import { expect, test } from '@playwright/test';

test.describe('history navigation', () => {
  test('back to an SPF-visited page restores from cache without a new request', async ({
    page,
  }) => {
    await page.goto('/');
    await page.click('#link-about');
    await expect(page.locator('#text')).toHaveText('About via SPF');
    await page.click('#link-stream');
    await expect(page.locator('#text')).toHaveText('Streamed content');

    const countsBefore = await (await page.request.get('/__counts')).json();
    const aboutRequestsBefore = countsBefore['/about'] ?? 0;

    // Back to /about: served from the response cache (memory tier) — no new
    // SPF request, no full page load.
    await page.goBack();
    await expect(page.locator('#text')).toHaveText('About via SPF');
    expect(page.url()).toBe('http://127.0.0.1:4173/about');

    const countsAfter = await (await page.request.get('/__counts')).json();
    expect(countsAfter['/about'] ?? 0).toBe(aboutRequestsBefore);
    await expect.poll(() => page.evaluate(() => window.__loads)).toBe(1);
  });

  test('back to a page never visited via SPF degrades to a full browser load', async ({ page }) => {
    await page.goto('/');
    await page.click('#link-about');
    await expect(page.locator('#text')).toHaveText('About via SPF');

    // Count document loads: a full (cross-document) navigation fires 'load'.
    let loads = 0;
    page.on('load', () => {
      loads += 1;
    });

    // The home entry was never pushed by SPF (no spf state), so the browser
    // handles the traverse itself: a full page load, not a protocol fetch.
    await page.goBack();
    await expect(page.locator('#text')).toHaveText('Home page content');
    expect(page.url()).toBe('http://127.0.0.1:4173/');
    expect(loads).toBe(1);
  });
});
