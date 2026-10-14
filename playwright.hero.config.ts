import { defineConfig } from '@playwright/test';

/**
 * Isolated hero-slider E2E run: dedicated port + fresh preview build, so the
 * suite never attaches to a developer dev server (or its live CMS data) that
 * happens to be running on the default port.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /(hero-slider\.spec|hero-visual-capture)\.ts$/,
  timeout: 60_000,
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  use: {
    baseURL: 'http://127.0.0.1:3111',
  },
  webServer: {
    command: 'pnpm --filter @pawtag/web preview --port 3111 --strictPort',
    url: 'http://127.0.0.1:3111',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
