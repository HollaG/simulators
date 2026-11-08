import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5311",
    viewport: { width: 1440, height: 1100 },
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `${process.platform === "win32" ? "npm.cmd" : "npm"} run dev -- --port 5311 --strictPort`,
    url: "http://127.0.0.1:5311",
    reuseExistingServer: !process.env.CI,
  },
});
