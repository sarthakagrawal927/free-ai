import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-live',
  timeout: 90_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8787',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'PLAYGROUND_ENABLED=true npm run env:sync && npx wrangler dev --local --port 8787',
    url: 'http://127.0.0.1:8787/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
