import { defineConfig, devices } from "@playwright/test";
import { VIEWPORT, NAV_TIMEOUT, ACTION_TIMEOUT } from "./src/config.js";

/**
 * Shared Playwright configuration.
 *
 * The walkthrough is driven by a standalone script (src/record-walkthrough.ts)
 * that launches its own browser context so it can control video recording and
 * the injected cursor precisely. This config documents the canonical settings
 * (viewport, WebM video, Chromium, generous hosted-page timeouts) and is used
 * if you run the project through `@playwright/test`.
 */
export default defineConfig({
  testDir: "./src",
  timeout: 180_000,
  expect: { timeout: ACTION_TIMEOUT },
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "./test-results",
  use: {
    baseURL: process.env.PROTOTYPE_URL,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    headless: process.env.HEADED !== "1",
    navigationTimeout: NAV_TIMEOUT,
    actionTimeout: ACTION_TIMEOUT,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: {
      mode: "on",
      size: VIEWPORT,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: VIEWPORT },
    },
  ],
});
