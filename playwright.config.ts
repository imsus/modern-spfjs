import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E for modern-spf.
 *
 * The test harness is a zero-dependency Node HTTP server (e2e/server.mjs)
 * that serves a small SPF test app and implements the wire protocol from
 * docs/protocol.md (single JSON + NDJSON streaming). The library IIFE build
 * (dist/index.iife.js) is served from the repo — run `pnpm build` first
 * (the `test:e2e` script does this automatically).
 */
export default defineConfig({
  testDir: './e2e',
  // The harness server keeps shared request counters (/__counts); tests assert
  // deltas, so files run serially on one worker.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'node e2e/server.mjs',
    url: 'http://127.0.0.1:4173/__ready',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
