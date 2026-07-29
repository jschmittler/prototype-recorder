/**
 * Headed authentication setup.
 *
 * The default prototype (a published figma.site) needs NO authentication, so
 * this script is only required if you point PROTOTYPE_URL at a link that gates
 * access behind Figma sign-in. It:
 *   1. opens a headed Chromium window,
 *   2. navigates to the prototype URL,
 *   3. lets YOU complete Figma authentication manually in that window,
 *   4. waits until you confirm in this terminal,
 *   5. saves the browser storage state to auth/figma-storage-state.json,
 *   6. closes the browser.
 *
 * The recording command reuses that storage state automatically.
 *
 * This script never asks for, stores, prints, or hard-codes passwords, and it
 * does not attempt to bypass MFA/SSO/org policy. If the page redirects to an
 * Autodesk or Figma SSO flow, complete it yourself in the opened window.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { getPrototypeUrl, VIEWPORT, STORAGE_STATE_PATH, NAV_TIMEOUT } from "./config.js";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a))));
}

export async function main() {
  const url = getPrototypeUrl();
  console.log(`[auth] opening headed Chromium for: ${url}`);
  console.log("[auth] Complete any Figma sign-in in the opened window.");

  const browser = await chromium.launch({ headless: false, args: ["--disable-notifications"] });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });

  await prompt(
    "\n[auth] When you have finished authenticating in the browser window, press ENTER here to save the session… "
  );

  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`[auth] storage state saved to: ${STORAGE_STATE_PATH}`);
  console.log("[auth] (this file is git-ignored and must never be committed)");

  await context.close();
  await browser.close();
  console.log("[auth] done. Now run: npm run walkthrough:record");
}

const invokedDirectly = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[auth] FATAL", err);
    process.exit(1);
  });
}
