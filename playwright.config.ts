import { defineConfig } from '@playwright/test';
import { e2ePaths } from './tests/e2e/paths';

const paths = e2ePaths();
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1050 },
    channel:
      process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/dev.mjs',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    env: {
      TSE_ENV: 'fixture',
      ATLAS_DB: paths.fixture,
      OFFICIAL_DB: paths.official,
      SIMULATED_DB: paths.simulated,
      HISTORY_DB: paths.history,
    },
    timeout: 30000,
  },
});
