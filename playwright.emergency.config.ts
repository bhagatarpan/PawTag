import { defineConfig } from '@playwright/test';

/**
 * Isolated browser checks for the emergency lost-pet widget and the finder
 * landing control (pnpm test:e2e:emergency). Dedicated ports so the suite
 * never attaches to a running dev server; the finder app must be previewed
 * alongside the web app because one test crosses into it.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'emergency-widget.check.ts',
  timeout: 60_000,
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  use: { baseURL: 'http://127.0.0.1:3112' },
  webServer: [
    {
      command: 'pnpm --filter @pawtag/web preview --port 3112 --strictPort',
      url: 'http://127.0.0.1:3112',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @pawtag/finder preview --port 3113 --strictPort',
      url: 'http://127.0.0.1:3113',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
