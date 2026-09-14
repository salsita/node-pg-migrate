import { defineConfig, devices } from '@playwright/test';

// keep in sync with `base` in docs/.vitepress/config.mts
const base = '/node-pg-migrate/';
const port = 4173;
const url = `http://localhost:${port}${base}`;

// Browser smoke tests for the built docs site; see test/docs/README.md
export default defineConfig({
  testDir: 'test/docs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: url,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm run docs:preview --port ${port}`,
    url,
    reuseExistingServer: !process.env.CI,
  },
});
