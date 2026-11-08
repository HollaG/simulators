import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  // Software WebGL in headless CI renders more slowly than a desktop GPU.
  timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:5312', viewport: { width: 1440, height: 1080 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --port 5312 --strictPort`, url: 'http://127.0.0.1:5312', reuseExistingServer: !process.env.CI },
});
