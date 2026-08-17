import { expect, test } from '@playwright/test';

const STREAM_PARTS = ['title', 'url', 'head', 'attr', 'body', 'foot', 'done'];

test.describe('streaming', () => {
  test('streamed parts arrive incrementally, in order, and are applied', async ({ page }) => {
    await page.goto('/');
    await page.click('#link-stream');

    // All parts recorded by the time the navigation settles.
    await page.waitForFunction(() => window.__parts.length === 7);

    const parts = await page.evaluate(() => window.__parts);
    expect(parts.map((p) => p.part)).toEqual(STREAM_PARTS);

    // Parts were delivered over time (streaming), not all at once: timestamps
    // are strictly increasing (the harness writes 120ms apart).
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].t).toBeGreaterThan(parts[i - 1].t);
    }

    // The aggregated response was applied: fragment, attribute, title, URL.
    await expect(page.locator('#text')).toHaveText('Streamed content');
    await expect(page.locator('#content')).toHaveAttribute('data-streamed', 'yes');
    await expect(page).toHaveTitle('Stream — SPF');
    expect(page.url()).toBe('http://127.0.0.1:4173/stream');
  });
});
