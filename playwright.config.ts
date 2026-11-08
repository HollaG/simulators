import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173/simulators/",
    viewport: { width: 1440, height: 1100 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `${process.platform === "win32" ? "npm.cmd" : "npm"} run preview`,
    url: "http://127.0.0.1:4173/simulators/",
    reuseExistingServer: !process.env.CI,
  },
});
