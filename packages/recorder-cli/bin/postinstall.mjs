#!/usr/bin/env node
/**
 * Best-effort Chromium download so global / npx installs work out of the box.
 * - Skip with PROTOTYPE_RECORDER_CLI_SKIP_BROWSER=1 (or in CI, which installs browsers
 *   explicitly with `npx playwright install --with-deps chromium`).
 * - Never fails the install; if it can't run, tells the user to run
 *   `prototype-recorder-cli setup` later.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

if (process.env.PROTOTYPE_RECORDER_CLI_SKIP_BROWSER === "1" || process.env.CI === "true") {
  console.log("[postinstall] skipping Chromium download (run `prototype-recorder-cli setup` when needed).");
  process.exit(0);
}

try {
  const require = createRequire(import.meta.url);
  let cli;
  for (const spec of ["playwright/cli.js", "playwright-core/cli.js"]) {
    try {
      cli = require.resolve(spec);
      break;
    } catch {
      /* try next */
    }
  }
  if (cli) {
    execFileSync(process.execPath, [cli, "install", "chromium"], { stdio: "inherit" });
  } else {
    console.log("[postinstall] Playwright CLI not found yet; run `prototype-recorder-cli setup` after install.");
  }
} catch (e) {
  console.log(
    "[postinstall] Chromium install skipped/failed; run `prototype-recorder-cli setup` later. (" +
      (e && e.message ? e.message : e) +
      ")"
  );
}
