import { defineConfig } from '@playwright/test';

// Runs against the browser-local demo, which needs no database. Live Supabase behaviour is
// covered by the manual checks in docs/SETUP.md.
export default defineConfig({
  testDir: './e2e',
  testIgnore: 'cloud/**',
  fullyParallel: false,
  use: { baseURL: 'http://localhost:3127' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 850 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  webServer: {
    command: 'npx next build && npx next start -p 3127',
    url: 'http://localhost:3127/demo',
    reuseExistingServer: true,
    timeout: 180000,
  },
});
