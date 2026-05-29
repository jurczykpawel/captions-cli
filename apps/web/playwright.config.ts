import { defineConfig, devices } from '@playwright/test';

// Non-default port so the test server never collides with a running Astro dev
// stack (dragnarok / cuemera / etc.).
const PORT = 4399;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  // Restore the free-only public state after the suite (no-op on a free clone).
  // The full pack is installed in the webServer command below so the build that
  // gets served includes every tier; this teardown undoes that leaky state.
  globalTeardown: './tests/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Install the full pack (basic+premium) before the build so the served app
    // has every tier; no-op on a free clone with no private packs. globalTeardown
    // restores the free-only state afterwards.
    command: `[ -d ../../packs/hf/premium ] && bash ../../scripts/install-pack.sh premium; KEEP_DEV=1 bun run build && bun run astro preview --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
