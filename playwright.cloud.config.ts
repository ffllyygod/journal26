import { defineConfig } from '@playwright/test';

const env = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54399',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
};

// The real app and Supabase client against e2e/cloud/mock-supabase.mjs.
export default defineConfig({
  testDir: './e2e/cloud',
  workers: 1,
  use: { baseURL: 'http://localhost:3128', viewport: { width: 1366, height: 850 } },
  webServer: [
    {
      command: 'node e2e/cloud/mock-supabase.mjs',
      url: 'http://localhost:54399/__row',
      reuseExistingServer: false,
    },
    {
      command: 'npx next build && npx next start -p 3128',
      url: 'http://localhost:3128/login',
      env,
      reuseExistingServer: false,
      timeout: 180000,
    },
  ],
});
