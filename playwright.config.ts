import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    locale: "en-US",
    screenshot: "only-on-failure",
    timezoneId: "America/Los_Angeles",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { colorScheme: "light" },
    },
    {
      name: "mobile",
      use: {
        colorScheme: "dark",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: "bash scripts/start-e2e-server.sh",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
