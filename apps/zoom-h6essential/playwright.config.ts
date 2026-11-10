import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5315",
    viewport: { width: 1440, height: 1100 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `${process.platform === "win32" ? "npm.cmd" : "npm"} run dev -- --port 5315 --strictPort`,
    url: "http://127.0.0.1:5315",
    reuseExistingServer: !process.env.CI,
  },
});
