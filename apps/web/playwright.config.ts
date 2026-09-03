import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "list",
  timeout: 45_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      // Pixel 5 is Chromium-based, so CI only needs one browser download.
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      // Effects are viewport-independent CSS, and both suites mutate shared
      // demo rows — the creator's theme and the seeded site's draft — so
      // running them in both projects at once would have the two clobbering
      // each other's writes. site.spec.ts is read-only and stays in both.
      testIgnore: /(effects|studio)\.spec\.ts/,
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "pipe",
  },
});
