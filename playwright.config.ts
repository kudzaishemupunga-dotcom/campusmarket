import { existsSync } from 'node:fs';
import { chromium, defineConfig, devices } from '@playwright/test';

const useSystemChrome = (() => {
  try {
    return !existsSync(chromium.executablePath());
  } catch {
    return true;
  }
})();

const pglitePort = process.env.PGLITE_SUPABASE_PORT || '54329';
const nextPort = process.env.PLAYWRIGHT_PORT || '3105';
const appUrl = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${nextPort}`;
const supabaseUrl = `http://127.0.0.1:${pglitePort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: appUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(useSystemChrome ? { channel: 'chrome' } : {}) },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: 'node tests/helpers/supabase-pglite-server.mjs',
          url: `${supabaseUrl}/health`,
          reuseExistingServer: false,
          timeout: 60_000,
          env: {
            PGLITE_SUPABASE_PORT: pglitePort,
            SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_local_e2e_service_role_key',
          },
        },
        {
          command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${nextPort}`,
          url: appUrl,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            NEXT_DIST_DIR: 'test-results/.next-e2e',
            NEXT_PUBLIC_SITE_URL: appUrl,
            NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_e2e_test_key',
            SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_local_e2e_service_role_key',
          },
        },
      ],
});
