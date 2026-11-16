import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5316", viewport: { width: 1440, height: 1100 }, screenshot: "only-on-failure" },
  webServer: {
    command: `${process.platform === "win32" ? "npm.cmd" : "npm"} run dev -- --port 5316 --strictPort`,
    url: "http://127.0.0.1:5316", reuseExistingServer: !process.env.CI,
  },
});
