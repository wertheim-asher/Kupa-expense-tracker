// Smoke test on a phone screen (SPEC section 14): the core flow in demo mode, end to end.
// Run: npm run test:e2e   (first time on a computer: npx playwright install chromium)

import { defineConfig, devices } from '@playwright/test'

const PORT = 4180

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // The iPhone 13 screen, touch and user agent, in Chromium (installed everywhere the tests run).
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: `http://localhost:${PORT}`,
    locale: 'he-IL',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
